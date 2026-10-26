/* 금액 입력창 공용 도우미 (콤마 자동, 단위 변환) */
(function (root) {
  'use strict';

  function commaInt(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /** 숫자·소수점만 남기고 정수부에 콤마를 자동으로 붙인다 (커서 위치 유지) */
  function formatDecimal(el) {
    var sig = function (s) { return s.replace(/[^\d.]/g, ''); };
    var before = sig(el.value.slice(0, el.selectionStart)).length;
    var raw = sig(el.value).slice(0, 16);
    var dot = raw.indexOf('.');
    var intPart = (dot < 0 ? raw : raw.slice(0, dot)).replace(/^0+(?=\d)/, '');
    var rest = dot < 0 ? '' : '.' + raw.slice(dot + 1).replace(/\./g, '');
    var formatted = commaInt(intPart) + rest;
    el.value = formatted;
    var pos = 0, seen = 0;
    while (pos < formatted.length && seen < before) { if (formatted[pos] !== ',') seen++; pos++; }
    try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
  }

  /** 원 단위 금액 → 입력 단위 문자열 (unit=1000000: 437000000 → "437", 437500000 → "437.5") */
  function toInputUnits(won, unit, decimals) {
    var s = String(parseFloat((won / unit).toFixed(decimals)));
    var parts = s.split('.');
    return commaInt(parts[0]) + (parts[1] ? '.' + parts[1] : '');
  }

  root.LoanInputs = { commaInt: commaInt, formatDecimal: formatDecimal, toInputUnits: toInputUnits };
})(window);
