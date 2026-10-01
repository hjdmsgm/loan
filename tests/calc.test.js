const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, aggregateByYear, METHODS } = require('../js/calc.js');

const base = { principal: 300000000, annualRate: 4.2, termYears: 30, graceMonths: 0 };

test('원리금균등 3억/4.2%/30년/거치 0', () => {
  const { summary, schedule } = calculate({ ...base, method: METHODS.ANNUITY });
  assert.equal(summary.monthlyPayment, 1467052);
  assert.equal(summary.totalInterest, 228138372);
  assert.equal(summary.paymentCount, 360);
  assert.equal(schedule[schedule.length - 1].balance, 0);
});

test('원리금균등 거치 12개월', () => {
  const { summary, schedule } = calculate({ ...base, method: METHODS.ANNUITY, graceMonths: 12 });
  assert.equal(summary.gracePayment, 1050000);
  assert.equal(summary.monthlyPayment, 1492433);
  assert.equal(schedule[11].payment, 1050000);
  assert.equal(schedule[11].principal, 0);
  assert.equal(schedule[12].payment, 1492433);
  assert.equal(schedule.length, 360);
  assert.equal(schedule[359].balance, 0);
});

test('원금균등 3억/4.2%/30년/거치 0', () => {
  const { summary, schedule } = calculate({ ...base, method: METHODS.EQUAL_PRINCIPAL });
  assert.equal(summary.firstPayment, 1883333);
  assert.equal(summary.lastPayment, 836370);
  assert.equal(schedule[schedule.length - 1].balance, 0);
});

test('금리 0% 원리금균등은 P/m', () => {
  const { summary, schedule } = calculate({
    principal: 12000000, annualRate: 0, termYears: 1, method: METHODS.ANNUITY, graceMonths: 0
  });
  assert.equal(summary.monthlyPayment, 1000000);
  assert.equal(summary.totalInterest, 0);
  assert.equal(schedule[11].balance, 0);
});

test('잔액 보정: 모든 조합에서 마지막 잔액 0, 원금 합 = 대출금', () => {
  const cases = [
    { principal: 100000000, annualRate: 3.333, termYears: 7, graceMonths: 5 },
    { principal: 1, annualRate: 30, termYears: 50, graceMonths: 0 },
    { principal: 1000, annualRate: 12.5, termYears: 1, graceMonths: 11 },
    { principal: 999999999, annualRate: 0.001, termYears: 50, graceMonths: 599 }
  ];
  for (const c of cases) {
    for (const method of [METHODS.ANNUITY, METHODS.EQUAL_PRINCIPAL]) {
      const { schedule } = calculate({ ...c, method });
      assert.equal(schedule[schedule.length - 1].balance, 0);
      assert.equal(schedule.reduce((s, r) => s + r.principal, 0), c.principal);
      assert.ok(schedule.every((r) => r.principal >= 0 && r.balance >= 0));
    }
  }
});

test('연도별 집계', () => {
  const { schedule, summary } = calculate({ ...base, method: METHODS.ANNUITY });
  const years = aggregateByYear(schedule);
  assert.equal(years.length, 30);
  assert.equal(years.reduce((s, y) => s + y.interest, 0), summary.totalInterest);
  assert.equal(years.reduce((s, y) => s + y.principal, 0), base.principal);
});
