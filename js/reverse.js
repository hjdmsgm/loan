/* 역산 페이지: 월 상환금 → 받을 수 있는 최대 대출금 */
(function () {
  'use strict';
  var Calc = LoanCalc, F = LoanFormat, V = LoanValidate;

  var $ = function (id) { return document.getElementById(id); };
  var fields = { payment: $('f-payment'), rate: $('f-rate'), years: $('f-years'), grace: $('f-grace') };

  function method() { return document.querySelector('input[name="method"]:checked').value; }

  function update() {
    var raw = { payment: fields.payment.value, rate: fields.rate.value, years: fields.years.value, grace: fields.grace.value };
    var check = V.validateReverse(raw, method());

    ['payment', 'rate', 'years', 'grace'].forEach(function (k) {
      var msg = check.errors[k] || '';
      $('e-' + k).textContent = msg;
      fields[k].closest('.field').classList.toggle('invalid', !!msg);
      fields[k].setAttribute('aria-invalid', msg ? 'true' : 'false');
    });

    // 월 상환금 표기: 한글 숫자 + 실제 금액(원)
    var pay = V.parsePayment(raw.payment);
    $('h-payment').textContent = pay.error ? '' : F.koreanWords(pay.won);
    $('h-payment-won').textContent = pay.error ? '' : '(' + F.won(pay.won) + ')';
    $('h-payment-line').hidden = !!pay.error;

    if (!check.ok) {
      $('result').hidden = true;
      $('schedule-card').hidden = true;
      $('empty').hidden = false;
      return;
    }
    $('empty').hidden = true;
    $('result').hidden = false;
    $('schedule-card').hidden = false;

    var sol = Calc.solvePrincipal(check.values, V.LIMITS.maxPrincipal);
    render(check.values, sol);
  }

  function render(input, sol) {
    var s = sol.result.summary, g = input.graceMonths, equal = input.method === Calc.METHODS.EQUAL_PRINCIPAL;
    var notes = [];

    $('hero-amount').textContent = F.won(sol.principal);
    $('hero-sub').textContent = F.koreanWords(sol.principal);

    if (equal) {
      $('st-payment-label').textContent = g ? '거치 후 첫 달 납입액' : '첫 달 납입액';
      $('st-payment').textContent = F.won(s.firstPayment);
      notes.push('입력한 상환금 ' + F.won(input.targetPayment) + ' 이하가 되는 가장 큰 금액이에요.');
      notes.push('마지막 달 납입액은 ' + F.won(s.lastPayment) + '이에요.');
    } else {
      $('st-payment-label').textContent = g ? '거치 후 월 납입액' : '월 납입액';
      $('st-payment').textContent = F.won(s.monthlyPayment);
      notes.push('입력한 상환금 ' + F.won(input.targetPayment) + ' 이하가 되는 가장 큰 금액이에요.');
    }
    if (g) {
      notes.push('거치 ' + g + '개월 동안은 매월 이자 ' + F.won(s.gracePayment) + '만 내요.');
    }
    if (sol.capped) notes.push('대출금 한도(' + F.koreanWords(V.LIMITS.maxPrincipal).replace(' 원', '') + ' 원)까지만 계산해요. 이 상환금이면 더 큰 금액도 가능해요.');
    $('hero-notes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');

    $('st-interest').textContent = F.won(s.totalInterest);
    $('st-total').textContent = F.won(s.totalPayment);
    $('st-count').textContent = F.comma(s.paymentCount) + '회';

    $('open-calc').href = 'index.html#p=' + sol.principal + '&r=' + input.annualRate + '&y=' + input.termYears +
      '&g=' + g + '&m=' + input.method;

    LoanChart.render($('chart'), Calc.aggregateByYear(sol.result.schedule));
    LoanSchedule.render($('schedule'), sol.result.schedule, g);
    $('schedule-note').textContent = g ? '흐리게 표시된 회차는 거치 기간(이자만 납부)이에요.' : '';
  }

  /* ---------- 이벤트 ---------- */
  fields.payment.addEventListener('input', function () { LoanInputs.formatDecimal(fields.payment); update(); });
  fields.rate.addEventListener('input', function () {
    var v = fields.rate.value.replace(/[^\d.\-]/g, '');
    if (v !== fields.rate.value) fields.rate.value = v;
    update();
  });
  [fields.years, fields.grace].forEach(function (el) {
    el.addEventListener('input', function () {
      var v = el.value.replace(/[^\d.\-]/g, '').slice(0, 6);
      if (v !== el.value) el.value = v;
      update();
    });
  });
  document.querySelectorAll('input[name="method"]').forEach(function (r) { r.addEventListener('change', update); });
  $('loan-form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('promo-close').addEventListener('click', function () { $('promo').hidden = true; });

  update();
})();
