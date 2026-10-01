/* 회차별 스케줄표 */
(function (root) {
  'use strict';
  var F = root.LoanFormat;

  function render(container, schedule, graceMonths) {
    var rows = schedule.map(function (r) {
      var grace = r.month <= graceMonths;
      return '<tr' + (grace ? ' class="grace"' : '') + '><td>' + r.month + (grace ? ' <em>거치</em>' : '') + '</td>' +
        '<td>' + F.comma(r.payment) + '</td><td>' + F.comma(r.principal) + '</td>' +
        '<td>' + F.comma(r.interest) + '</td><td>' + F.comma(r.balance) + '</td></tr>';
    }).join('');
    container.innerHTML = '<table><thead><tr><th>회차</th><th>납입액</th><th>원금</th><th>이자</th><th>남은 원금</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
    container.scrollTop = 0;
  }

  root.LoanSchedule = { render: render };
})(window);
