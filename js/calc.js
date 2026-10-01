/* 대출 상환 계산 (DOM 의존 없음, 브라우저/Node 겸용) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoanCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var METHODS = { ANNUITY: 'annuity', EQUAL_PRINCIPAL: 'equal-principal' };

  /**
   * @param {{principal:number, annualRate:number, termYears:number, method:string, graceMonths?:number}} input
   * @returns {{schedule:Array, summary:Object}}
   */
  function calculate(input) {
    var P = input.principal;
    var termMonths = input.termYears * 12;
    var grace = input.graceMonths || 0;
    var m = termMonths - grace; // 원금 상환 개월 수
    var r = input.annualRate / 100 / 12;
    var method = input.method;

    if (!(P > 0) || !(m > 0)) throw new RangeError('invalid loan input');

    var schedule = [];
    var balance = P;
    var i, interest;

    // 거치 기간: 이자만 납부
    for (i = 1; i <= grace; i++) {
      interest = Math.round(balance * r);
      schedule.push({ month: i, payment: interest, principal: 0, interest: interest, balance: balance });
    }

    var annuityPayment = 0;
    if (method === METHODS.ANNUITY) {
      if (r === 0) annuityPayment = Math.round(P / m);
      else {
        var pow = Math.pow(1 + r, m);
        annuityPayment = Math.round((P * r * pow) / (pow - 1));
      }
    }
    var equalPrincipal = Math.round(P / m);

    for (var k = 1; k <= m; k++) {
      interest = Math.round(balance * r);
      var principal;
      if (k === m) principal = balance; // 마지막 회차: 잔액이 정확히 0이 되도록 보정
      else if (method === METHODS.ANNUITY) principal = annuityPayment - interest;
      else principal = equalPrincipal;
      principal = Math.max(0, Math.min(principal, balance));
      balance -= principal;
      schedule.push({
        month: grace + k,
        payment: principal + interest,
        principal: principal,
        interest: interest,
        balance: balance
      });
    }

    var totalInterest = 0, graceInterest = 0;
    schedule.forEach(function (row, idx) {
      totalInterest += row.interest;
      if (idx < grace) graceInterest += row.interest;
    });

    var first = schedule[grace];
    var last = schedule[schedule.length - 1];
    var summary = {
      monthlyPayment: method === METHODS.ANNUITY ? annuityPayment : null,
      firstPayment: first.payment,
      lastPayment: last.payment,
      gracePayment: grace > 0 ? schedule[0].payment : 0,
      graceInterestTotal: graceInterest,
      totalInterest: totalInterest,
      totalPayment: P + totalInterest,
      paymentCount: schedule.length
    };
    return { schedule: schedule, summary: summary };
  }

  /** 회차별 스케줄 → 연도별(12회차 단위) 원금/이자 합계 */
  function aggregateByYear(schedule) {
    var years = [];
    schedule.forEach(function (row) {
      var y = Math.ceil(row.month / 12);
      var bucket = years[y - 1];
      if (!bucket) bucket = years[y - 1] = { year: y, principal: 0, interest: 0, payment: 0 };
      bucket.principal += row.principal;
      bucket.interest += row.interest;
      bucket.payment += row.payment;
    });
    return years;
  }

  return { METHODS: METHODS, calculate: calculate, aggregateByYear: aggregateByYear };
});
