/* 입력 검증: 문자열 입력 → 값 + 오류 문구 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoanValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = { minPrincipal: 1, maxPrincipal: 100000000000, principalDecimals: 3, maxRate: 30, rateDecimals: 3, minYears: 1, maxYears: 50 };
  var PRINCIPAL_UNIT = 1000; // 대출 원금은 천원 단위로 입력한다 (예: 437,000 → 437,000,000원)

  /** 천원 단위 입력 문자열 → {won} 또는 {error} */
  function parsePrincipal(input) {
    var s = String(input == null ? '' : input).replace(/,/g, '').trim();
    if (!s) return { error: '대출 원금을 입력해 주세요. 천원 단위예요. 예: 437,000 (= 4억 3,700만 원)' };
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return { error: '숫자만 입력해 주세요. 천원 단위예요. 예: 437,000 (= 4억 3,700만 원)' };
    if ((s.split('.')[1] || '').length > LIMITS.principalDecimals)
      return { error: '소수점은 셋째 자리까지만 입력할 수 있어요. 예: 437000.5' };
    var won = Math.round(Number(s) * PRINCIPAL_UNIT);
    if (won < LIMITS.minPrincipal || won > LIMITS.maxPrincipal)
      return { error: '대출 원금은 천원 단위로 0보다 크고 100,000,000(1,000억 원) 이하로 입력해 주세요.' };
    return { won: won };
  }

  /** raw: {principal, rate, years, grace} 문자열 */
  function validate(raw, method) {
    var errors = {}, v = {};

    var pr = parsePrincipal(raw.principal);
    if (pr.error) errors.principal = pr.error;
    else v.principal = pr.won;

    var rStr = String(raw.rate || '').trim();
    if (!rStr) errors.rate = '연 이자율을 입력해 주세요. 이자가 없으면 0을 입력하세요.';
    else if (!/^(\d+\.?\d*|\.\d+)$/.test(rStr)) errors.rate = '0 이상의 숫자로 입력해 주세요. 예: 4.2';
    else if ((rStr.split('.')[1] || '').length > LIMITS.rateDecimals)
      errors.rate = '소수점 셋째 자리까지만 입력할 수 있어요. 예: 4.125';
    else if (Number(rStr) > LIMITS.maxRate) errors.rate = '연 이자율은 0~30% 사이로 입력해 주세요.';
    else v.annualRate = Number(rStr);

    var yStr = String(raw.years || '').trim();
    if (!yStr) errors.years = '대출 기간(년)을 입력해 주세요.';
    else if (!/^\d+$/.test(yStr)) errors.years = '대출 기간은 소수 없이 1~50 사이의 정수로 입력해 주세요. 예: 30';
    else if (Number(yStr) < LIMITS.minYears || Number(yStr) > LIMITS.maxYears)
      errors.years = '대출 기간은 1~50년 사이로 입력해 주세요.';
    else v.termYears = Number(yStr);

    var gStr = String(raw.grace == null ? '' : raw.grace).trim();
    if (gStr === '') v.graceMonths = 0;
    else if (!/^\d+$/.test(gStr)) errors.grace = '거치 기간은 개월 수를 정수로 입력해 주세요. 없으면 0을 입력하세요.';
    else if (v.termYears !== undefined && Number(gStr) >= v.termYears * 12)
      errors.grace = '거치 기간은 대출 기간(' + v.termYears * 12 + '개월)보다 짧아야 해요. ' +
        (v.termYears * 12 - 1) + '개월 이하로 입력해 주세요.';
    else v.graceMonths = Number(gStr);

    v.method = method;
    var ok = Object.keys(errors).length === 0;
    return { ok: ok, errors: errors, values: ok ? v : null };
  }

  return { LIMITS: LIMITS, PRINCIPAL_UNIT: PRINCIPAL_UNIT, parsePrincipal: parsePrincipal, validate: validate };
});
