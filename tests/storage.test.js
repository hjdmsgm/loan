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

test('검증', () => {
  const ok = V.validate({ principal: '300,000,000', rate: '4.2', years: '30', grace: '12' }, 'annuity');
  assert.ok(ok.ok);
  assert.equal(ok.values.graceMonths, 12);
  assert.ok(V.validate({ principal: '0', rate: '4', years: '30', grace: '' }, 'annuity').errors.principal);
  assert.ok(V.validate({ principal: '1,000,000,001', rate: '4', years: '30', grace: '' }, 'annuity').errors.principal);
  assert.ok(V.validate({ principal: '1', rate: '4.1234', years: '30', grace: '' }, 'annuity').errors.rate);
  assert.ok(V.validate({ principal: '1', rate: '30.1', years: '30', grace: '' }, 'annuity').errors.rate);
  assert.ok(V.validate({ principal: '1', rate: '4', years: '51', grace: '' }, 'annuity').errors.years);
  assert.ok(V.validate({ principal: '1', rate: '4', years: '3.5', grace: '' }, 'annuity').errors.years);
  assert.ok(V.validate({ principal: '1', rate: '4', years: '1', grace: '12' }, 'annuity').errors.grace);
  assert.ok(V.validate({ principal: '1', rate: '4', years: '1', grace: '11' }, 'annuity').ok);
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
