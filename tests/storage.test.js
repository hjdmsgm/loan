const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/format.js');
const V = require('../js/validate.js');
const S = require('../js/storage.js');
const C = require('../js/calc.js');

test('한글 단위', () => {
  assert.equal(F.koreanUnit(300000000), '3억 원');
  assert.equal(F.koreanUnit(150000000), '1억 5,000만 원');
  assert.equal(F.koreanUnit(1234), '1,234 원');
  assert.equal(F.koreanUnit(1000000000), '10억 원');
});

test('파일명', () => {
  const d = new Date(2026, 9, 1, 9, 5);
  assert.equal(F.fileName('내 집 마련: 1/2?', d), '내_집_마련_12_20261001_0905.json');
  assert.equal(F.fileName('', d), 'loan_20261001_0905.json');
  assert.equal(F.fileName('  <>|  ', d), 'loan_20261001_0905.json');
  assert.deepEqual(F.parseFileName('내_집_20261001_0905.json'),
    { title: '내 집', sortKey: '202610010905', date: '2026-10-01 09:05' });
});

test('한글 숫자', () => {
  assert.equal(F.koreanWords(437000000), '사억 삼천칠백만 원');
  assert.equal(F.koreanWords(300000000), '삼억 원');
  assert.equal(F.koreanWords(1000000000), '십억 원');
  assert.equal(F.koreanWords(150000000), '일억 오천만 원');
  assert.equal(F.koreanWords(100000000), '일억 원');
  assert.equal(F.koreanWords(10000), '일만 원');
  assert.equal(F.koreanWords(437500000), '사억 삼천칠백오십만 원');
  assert.equal(F.koreanWords(1234), '천이백삼십사 원');
  assert.equal(F.koreanWords(1), '일 원');
});

test('검증 (원금은 백만원 단위 입력)', () => {
  const v = (o) => V.validate({ principal: '437', rate: '4', years: '30', grace: '', ...o }, 'annuity');
  const ok = v({ principal: '300', rate: '4.2', grace: '12' });
  assert.ok(ok.ok);
  assert.equal(ok.values.principal, 300000000);
  assert.equal(ok.values.graceMonths, 12);
  assert.equal(v({ principal: '437.5' }).values.principal, 437500000);
  assert.equal(v({ principal: '437.500001' }).values.principal, 437500001);
  assert.equal(v({ principal: '100,000' }).values.principal, 100000000000); // 1,000억 원
  assert.equal(v({ principal: '0.000001' }).values.principal, 1);
  assert.ok(v({ principal: '0' }).errors.principal);
  assert.ok(v({ principal: '100,000.1' }).errors.principal);
  assert.ok(v({ principal: '437,000,000' }).errors.principal);
  assert.ok(v({ principal: '' }).errors.principal);
  assert.ok(v({ principal: 'abc' }).errors.principal);
  assert.ok(v({ principal: '1.1234567' }).errors.principal);
  assert.ok(v({ rate: '4.1234' }).errors.rate);
  assert.ok(v({ rate: '30.1' }).errors.rate);
  assert.ok(v({ years: '51' }).errors.years);
  assert.ok(v({ years: '3.5' }).errors.years);
  assert.ok(v({ years: '1', grace: '12' }).errors.grace);
  assert.ok(v({ years: '1', grace: '11' }).ok);
});

test('최대 대출금(1,000억 원)에서도 계산이 정확하다', () => {
  for (const method of ['annuity', 'equal-principal']) {
    const { schedule, summary } = C.calculate({ principal: 100000000000, annualRate: 30, termYears: 50, graceMonths: 12, method });
    assert.equal(schedule[schedule.length - 1].balance, 0);
    assert.equal(schedule.reduce((s, r) => s + r.principal, 0), 100000000000);
    assert.ok(Number.isSafeInteger(summary.totalPayment));
  }
  assert.equal(F.koreanWords(100000000000), '천억 원');
  assert.equal(F.compact(1500000000000), '1.5조');
});

test('저장 문서 왕복과 이전 파일 호환', () => {
  const input = { principal: 300000000, annualRate: 4.2, termYears: 30, method: 'annuity', graceMonths: 0 };
  const doc = S.buildDocument('테스트', input, C.calculate(input), new Date('2026-10-01T00:00:00Z'));
  assert.equal(doc.app, 'loan-calculator');
  assert.equal(doc.input.termMonths, 360);
  assert.equal(doc.schedule.length, 360);
  const back = S.parseDocument(JSON.stringify(doc));
  assert.equal(back.title, '테스트');
  assert.equal(back.input.termYears, 30);

  const old = S.parseDocument({ memo: '예전', input: { principal: 1, annualRate: 3, termMonths: 240, method: 'equal-principal' } });
  assert.equal(old.title, '예전');
  assert.equal(old.input.termYears, 20);
  assert.throws(() => S.parseDocument({ input: { principal: 1, annualRate: 3, termMonths: 25, method: 'annuity' } }));
  assert.throws(() => S.parseDocument('not json'));
});

test('CSV: BOM과 거치 구분', () => {
  const csv = S.scheduleToCsv([
    { month: 1, payment: 10, principal: 0, interest: 10, balance: 100 },
    { month: 2, payment: 60, principal: 50, interest: 10, balance: 50 }
  ], 1);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes('1,거치,10,0,10,100'));
  assert.ok(csv.includes('2,,60,50,10,50'));
});
