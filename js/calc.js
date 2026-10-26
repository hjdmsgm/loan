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

  /** 기준 납입액: 원리금균등은 (거치 후) 월 납입액, 원금균등은 (거치 후) 첫 달 납입액 */
  function basisPayment(summary, method) {
    return method === METHODS.EQUAL_PRINCIPAL ? summary.firstPayment : summary.monthlyPayment;
  }

  /**
   * 상환금으로 대출금 역산: 기준 납입액이 targetPayment 이하가 되는 최대 대출금(원)을 찾는다.
   * calculate()로 직접 검증하는 이분 탐색이라 정방향 계산 결과와 항상 일치한다.
   * @param {{targetPayment:number, annualRate:number, termYears:number, method:string, graceMonths?:number}} input
   * @param {number} maxPrincipal 탐색 상한(원)
   * @returns {{principal:number, capped:boolean, result:Object}}
   */
  function solvePrincipal(input, maxPrincipal) {
    var base = {
      annualRate: input.annualRate, termYears: input.termYears,
      method: input.method, graceMonths: input.graceMonths || 0
    };
    function run(p) { return calculate(Object.assign({ principal: p }, base)); }
    function pay(r) { return basisPayment(r.summary, input.method); }

    var top = run(maxPrincipal);
    if (pay(top) <= input.targetPayment) return { principal: maxPrincipal, capped: true, result: top };

    var lo = 1, hi = maxPrincipal; // 불변식: pay(lo) <= target < pay(hi)
    if (pay(run(lo)) > input.targetPayment) return { principal: 0, capped: false, result: null };
    while (hi - lo > 1) {
      var mid = Math.floor((lo + hi) / 2);
      if (pay(run(mid)) <= input.targetPayment) lo = mid; else hi = mid;
    }
    return { principal: lo, capped: false, result: run(lo) };
  }

  return { METHODS: METHODS, calculate: calculate, aggregateByYear: aggregateByYear, solvePrincipal: solvePrincipal, basisPayment: basisPayment };
});
