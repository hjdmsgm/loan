/* 저장 데이터: JSON 직렬화/호환 파싱, CSV */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoanStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var METHOD_ALIASES = {
    'annuity': 'annuity', 'equal-payment': 'annuity', 'equal_payment': 'annuity',
    'equalpayment': 'annuity', 'equal-principal-interest': 'annuity', '원리금균등': 'annuity',
    'equal-principal': 'equal-principal', 'equal_principal': 'equal-principal',
    'equalprincipal': 'equal-principal', 'principal': 'equal-principal', '원금균등': 'equal-principal'
  };

  function buildDocument(title, input, result, now) {
    return {
      app: 'loan-calculator',
      version: 1,
      savedAt: (now || new Date()).toISOString(),
      title: title || '',
      input: {
        principal: input.principal,
        annualRate: input.annualRate,
        termYears: input.termYears,
        termMonths: input.termYears * 12,
        method: input.method,
        graceMonths: input.graceMonths || 0
      },
      summary: result.summary,
      schedule: result.schedule.map(function (r) {
        return { month: r.month, payment: r.payment, principal: r.principal, interest: r.interest, balance: r.balance };
      })
    };
  }

  /** 저장 파일 → {title, input}. 형식이 올바르지 않으면 Error. 이전 파일 호환 처리 포함 */
  function parseDocument(text) {
    var doc;
    try { doc = typeof text === 'string' ? JSON.parse(text) : text; }
    catch (e) { throw new Error('JSON 파일을 읽을 수 없어요. 이 앱에서 저장한 파일인지 확인해 주세요.'); }
    if (!doc || typeof doc !== 'object' || !doc.input || typeof doc.input !== 'object')
      throw new Error('대출 입력 정보(input)가 없는 파일이에요. 이 앱에서 저장한 파일을 선택해 주세요.');

    var i = doc.input;
    var title = doc.title != null ? doc.title : (doc.memo != null ? doc.memo : (i.memo != null ? i.memo : ''));

    var termYears = i.termYears;
    if (termYears == null && i.termMonths != null) termYears = Number(i.termMonths) / 12;
    if (!Number.isInteger(Number(termYears)))
      throw new Error('대출 기간을 정수 년으로 변환할 수 없어요. (termMonths가 12의 배수가 아니에요)');

    var rawMethod = String(i.method == null ? '' : i.method);
    var method = METHOD_ALIASES[rawMethod.toLowerCase()] || METHOD_ALIASES[rawMethod] || null;
    if (!method) throw new Error('알 수 없는 상환 방식이에요: ' + rawMethod);

    return {
      title: String(title),
      input: {
        principal: Number(i.principal),
        annualRate: Number(i.annualRate),
        termYears: Number(termYears),
        method: method,
        graceMonths: Number(i.graceMonths || 0)
      }
    };
  }

  /** 엑셀용 CSV (UTF-8 BOM, CRLF) */
  function scheduleToCsv(schedule, graceMonths) {
    var lines = ['회차,구분,납입액,원금,이자,남은 원금'];
    schedule.forEach(function (r) {
      lines.push([r.month, r.month <= (graceMonths || 0) ? '거치' : '', r.payment, r.principal, r.interest, r.balance].join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  return { buildDocument: buildDocument, parseDocument: parseDocument, scheduleToCsv: scheduleToCsv };
});
