/* 연도별 원금+이자 누적 막대 차트 (HTML/CSS, 툴팁·키보드 지원) */
(function (root) {
  'use strict';
  var F = root.LoanFormat;

  function niceMax(v) {
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * exp;
  }

  function render(container, years) {
    var maxVal = Math.max.apply(null, years.map(function (y) { return y.payment; }));
    var top = niceMax(maxVal || 1);
    var ticks = [1, 0.75, 0.5, 0.25, 0].map(function (t) { return top * t; });
    var labelEvery = years.length <= 12 ? 1 : years.length <= 30 ? 5 : 10;

    var html = '<div class="chart-wrap"><div class="y-axis" aria-hidden="true">' +
      ticks.map(function (t, i) { return '<span style="top:' + i * 25 + '%">' + (t ? F.compact(t) : '0') + '</span>'; }).join('') +
      '</div><div class="plot">' +
      ticks.map(function (t, i) { return '<i class="grid" style="top:' + i * 25 + '%"></i>'; }).join('') +
      '<div class="cols" role="list" aria-label="연도별 상환액 막대 차트">' +
      years.map(function (y, i) {
        var h = y.payment / top * 100;
        var pPct = y.payment ? y.principal / y.payment * 100 : 0;
        return '<div class="col" role="listitem" tabindex="0" data-i="' + i + '" aria-label="' + label(y) + '">' +
          '<div class="bar" style="height:' + h + '%"><span class="seg-i" style="height:' + (100 - pPct) + '%"></span>' +
          '<span class="seg-p" style="height:' + pPct + '%"></span></div></div>';
      }).join('') + '</div>' +
      '<div class="tooltip" role="status" hidden></div></div>' +
      '<div class="x-axis" aria-hidden="true"><span class="spacer"></span><div class="xcols">' +
      years.map(function (y) {
        var show = y.year === 1 || y.year % labelEvery === 0 || y.year === years.length && years.length % labelEvery > 2;
        return '<span>' + (show ? y.year + '년' : '') + '</span>';
      }).join('') + '</div></div></div>';
    container.innerHTML = html;
    bind(container, years);
  }

  function label(y) {
    return y.year + '년차, 원금 ' + F.won(y.principal) + ', 이자 ' + F.won(y.interest) + ', 합계 ' + F.won(y.payment);
  }

  function bind(container, years) {
    var chart = container.querySelector('.chart-wrap');
    var plot = container.querySelector('.plot');
    var tip = container.querySelector('.tooltip');
    var cols = Array.prototype.slice.call(container.querySelectorAll('.col'));
    var current = -1;

    function show(i) {
      var y = years[i];
      current = i;
      chart.classList.add('has-active');
      cols.forEach(function (c, idx) { c.classList.toggle('active', idx === i); });
      tip.innerHTML = '<strong>' + y.year + '년차</strong>' +
        '<div><i class="dot p"></i>원금<b>' + F.won(y.principal) + '</b></div>' +
        '<div><i class="dot i"></i>이자<b>' + F.won(y.interest) + '</b></div>' +
        '<div class="sum">합계<b>' + F.won(y.payment) + '</b></div>';
      tip.hidden = false;
      // 막대 옆에 배치: 막대가 왼쪽 절반이면 오른쪽, 아니면 왼쪽에 둔다
      var pr = plot.getBoundingClientRect();
      var br = cols[i].querySelector('.bar').getBoundingClientRect();
      var tw = tip.offsetWidth, gap = 8;
      var left = (br.left + br.width / 2 - pr.left) < pr.width / 2 ? br.right - pr.left + gap : br.left - pr.left - tw - gap;
      left = Math.max(0, Math.min(left, pr.width - tw));
      tip.style.left = left + 'px';
      tip.style.top = '0px';
    }
    function hide() {
      current = -1;
      chart.classList.remove('has-active');
      cols.forEach(function (c) { c.classList.remove('active'); });
      tip.hidden = true;
    }

    cols.forEach(function (c, i) {
      c.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse') show(i); });
      c.addEventListener('pointerout', function (e) { if (e.pointerType === 'mouse') hide(); });
      c.addEventListener('click', function () { show(i); });      // 터치: 탭하면 고정, 다른 막대 탭하면 전환
      c.addEventListener('focus', function () { show(i); });       // 키보드 Tab
      c.addEventListener('blur', function () { if (current === i) hide(); });
      c.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (n !== null && cols[n]) { e.preventDefault(); cols[n].focus(); }
        if (e.key === 'Escape') hide();
      });
    });

    // 빈 곳을 탭/클릭하면 숨김
    if (container._outside) document.removeEventListener('pointerdown', container._outside);
    container._outside = function (e) {
      if (!container.contains(e.target) || !e.target.closest('.col')) {
        if (current !== -1) { hide(); if (document.activeElement && document.activeElement.classList.contains('col')) document.activeElement.blur(); }
      }
    };
    document.addEventListener('pointerdown', container._outside);
  }

  root.LoanChart = { render: render };
})(window);
