/* 숫자/날짜/파일명 포맷 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoanFormat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function comma(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function won(n) { return comma(n) + '원'; }

  /** 300000000 → "3억 원", 150000000 → "1억 5,000만 원" */
  function koreanUnit(n) {
    if (!(n > 0)) return '';
    var eok = Math.floor(n / 100000000);
    var man = Math.floor((n % 100000000) / 10000);
    var rest = n % 10000;
    var parts = [];
    if (eok) parts.push(comma(eok) + '억');
    if (man) parts.push(comma(man) + '만');
    if (rest) parts.push(comma(rest));
    return parts.join(' ') + ' 원';
  }

  /** 차트 축 라벨용 축약: 1.5억, 500만 */
  function compact(n) {
    if (n >= 100000000) return trim(n / 100000000) + '억';
    if (n >= 10000) return trim(n / 10000) + '만';
    return comma(n);
  }
  function trim(x) { return String(Math.round(x * 10) / 10); }

  function pad(n, w) { return String(n).padStart(w || 2, '0'); }

  function stamp(date) {
    return {
      ymd: date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()),
      hm: pad(date.getHours()) + pad(date.getMinutes())
    };
  }

  /** 파일명 금지 문자 제거, 공백은 _, 비면 loan */
  function sanitizeTitle(title) {
    var t = String(title == null ? '' : title)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/^\.+|\.+$/g, '');
    if (t.length > 60) t = t.slice(0, 60);
    return t || 'loan';
  }

  /** 제목_YYYYMMDD_HHMM (확장자 제외) */
  function fileBase(title, date) {
    var s = stamp(date || new Date());
    return sanitizeTitle(title) + '_' + s.ymd + '_' + s.hm;
  }
  function fileName(title, date) { return fileBase(title, date) + '.json'; }

  /** 파일명에서 제목/날짜 복원 (저장 목록용) */
  function parseFileName(name) {
    var base = name.replace(/\.json$/i, '');
    var m = /^(.*?)_(\d{8})_(\d{4})(?:_\d+)?$/.exec(base);
    if (!m) return { title: base.replace(/_/g, ' '), sortKey: '', date: '' };
    var d = m[2], t = m[3];
    return {
      title: m[1].replace(/_/g, ' '),
      sortKey: m[2] + m[3],
      date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + ' ' + t.slice(0, 2) + ':' + t.slice(2)
    };
  }

  return {
    comma: comma, won: won, koreanUnit: koreanUnit, compact: compact,
    sanitizeTitle: sanitizeTitle, fileBase: fileBase, fileName: fileName, parseFileName: parseFileName
  };
});
