/* 화면 연결: 입력 → 검증 → 계산 → 렌더링, 저장/불러오기 */
(function () {
  'use strict';
  var Calc = LoanCalc, F = LoanFormat, V = LoanValidate, S = LoanStorage, GH = LoanGitHub;

  var $ = function (id) { return document.getElementById(id); };
  var fields = {
    principal: $('f-principal'), rate: $('f-rate'), years: $('f-years'), grace: $('f-grace')
  };
  var current = null; // { input, result }

  /* ---------- 입력 정리 ---------- */
  function onlyDigits(s) { return s.replace(/\D/g, ''); }

  function formatPrincipalInput(el) {
    var caret = el.selectionStart;
    var digitsBefore = onlyDigits(el.value.slice(0, caret)).length;
    var digits = onlyDigits(el.value).slice(0, 12).replace(/^0+(?=\d)/, '');
    var formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    el.value = formatted;
    // 숫자 개수를 기준으로 커서 위치 복원
    var pos = 0, seen = 0;
    while (pos < formatted.length && seen < digitsBefore) { if (formatted[pos] !== ',') seen++; pos++; }
    try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
  }

  function method() { return document.querySelector('input[name="method"]:checked').value; }

  /* ---------- 재계산 ---------- */
  function update() {
    var raw = {
      principal: fields.principal.value, rate: fields.rate.value,
      years: fields.years.value, grace: fields.grace.value
    };
    var check = V.validate(raw, method());

    ['principal', 'rate', 'years', 'grace'].forEach(function (k) {
      var msg = check.errors[k] || '';
      $('e-' + k).textContent = msg;
      fields[k].closest('.field').classList.toggle('invalid', !!msg);
      fields[k].setAttribute('aria-invalid', msg ? 'true' : 'false');
    });

    var pDigits = onlyDigits(raw.principal);
    var hint = $('h-principal');
    hint.textContent = pDigits ? F.koreanUnit(Number(pDigits)) : '';
    hint.classList.add('big');

    if (!check.ok) {
      current = null;
      $('result').hidden = true;
      $('schedule-card').hidden = true;
      $('empty').hidden = false;
      return;
    }
    $('empty').hidden = true;
    $('result').hidden = false;
    $('schedule-card').hidden = false;

    var result = Calc.calculate(check.values);
    current = { input: check.values, result: result };
    render(check.values, result);
  }

  function render(input, result) {
    var s = result.summary, g = input.graceMonths, equal = input.method === Calc.METHODS.EQUAL_PRINCIPAL;
    var notes = [];

    if (equal) {
      $('hero-label').textContent = g ? '거치 후 첫 달 납입액' : '첫 달 납입액';
      $('hero-amount').textContent = F.won(s.firstPayment);
      notes.push('마지막 달 납입액 ' + F.won(s.lastPayment));
      notes.push('원금은 매달 같고 이자가 줄어 납입액이 점점 줄어들어요.');
    } else {
      $('hero-label').textContent = g ? '거치 후 월 납입액' : '월 납입액';
      $('hero-amount').textContent = F.won(s.monthlyPayment);
      if (s.lastPayment !== s.monthlyPayment)
        notes.push('마지막 회차는 원 단위 보정으로 ' + F.won(s.lastPayment) + '이에요.');
    }
    if (g) {
      notes.push('거치 ' + g + '개월 동안은 매월 이자 ' + F.won(s.gracePayment) + '만 내요. (거치 중 이자 합계 ' + F.won(s.graceInterestTotal) + ')');
      notes.push('원금 상환은 ' + (input.termYears * 12 - g) + '개월 동안 진행돼요.');
    }
    $('hero-notes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');

    $('st-principal').textContent = F.won(input.principal);
    $('st-interest').textContent = F.won(s.totalInterest);
    $('st-total').textContent = F.won(s.totalPayment);
    $('st-count').textContent = F.comma(s.paymentCount) + '회';

    LoanChart.render($('chart'), Calc.aggregateByYear(result.schedule));
    LoanSchedule.render($('schedule'), result.schedule, g);
    $('schedule-note').textContent = g ? '흐리게 표시된 회차는 거치 기간(이자만 납부)이에요.' : '';
  }

  /* ---------- 토스트 / 다운로드 ---------- */
  var toastTimer;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }

  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function ensureResult() {
    if (current) return true;
    toast('입력값의 오류를 먼저 고쳐 주세요.');
    return false;
  }

  function buildJson() {
    var title = $('title-input').value.trim();
    var doc = S.buildDocument(title, current.input, current.result);
    return { title: title, text: JSON.stringify(doc, null, 2), name: F.fileName(title) };
  }

  /* ---------- 불러오기 ---------- */
  function applyLoaded(parsed) {
    var i = parsed.input;
    fields.principal.value = F.comma(i.principal);
    fields.rate.value = String(i.annualRate);
    fields.years.value = String(i.termYears);
    fields.grace.value = String(i.graceMonths || 0);
    document.querySelector('input[name="method"][value="' + i.method + '"]').checked = true;
    $('title-input').value = parsed.title;
    update();
    if (!current) toast('불러왔지만 값이 허용 범위를 벗어나 있어요. 입력란의 안내를 확인해 주세요.', 5000);
    else toast('불러왔어요. 저장된 입력값으로 다시 계산했어요.');
  }

  /* ---------- GitHub ---------- */
  var cfg = GH.loadConfig();

  function renderConn() {
    var el = $('conn-status');
    if (GH.isConfigured(cfg)) {
      el.classList.toggle('warn', cfg.isPublic);
      el.textContent = (cfg.isPublic ? '⚠ Public 저장소예요. 저장한 내용이 공개됩니다. ' : '') +
        '연결됨: ' + cfg.owner + '/' + cfg.repo + ' (' + cfg.branch + ' · ' + GH.cleanFolder(cfg.folder) + '/)';
    } else {
      el.classList.remove('warn');
      el.textContent = 'GitHub 저장소가 연결되지 않았어요. 연결하면 결과를 Private 저장소에 저장할 수 있어요.';
    }
  }

  function renderSavedList(items, errMsg) {
    var ul = $('saved-list');
    if (errMsg) { ul.innerHTML = '<li class="none"></li>'; ul.firstChild.textContent = errMsg; return; }
    if (!items.length) { ul.innerHTML = '<li class="none">저장된 결과가 없어요.</li>'; return; }
    ul.innerHTML = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var t = document.createElement('span'); t.className = 't'; t.textContent = it.title; t.title = it.title;
      var d = document.createElement('span'); d.className = 'd'; d.textContent = it.date;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = '불러오기';
      b.addEventListener('click', function () { loadFromGitHub(it, b); });
      li.append(t, d, b);
      ul.appendChild(li);
    });
  }

  async function refreshList() {
    var ul = $('saved-list');
    if (!GH.isConfigured(cfg)) { renderSavedList([], 'GitHub를 연결하면 저장 목록이 표시돼요.'); return; }
    ul.innerHTML = '<li class="none">불러오는 중…</li>';
    try { renderSavedList(await GH.listFiles(cfg, F.parseFileName)); }
    catch (e) { renderSavedList([], e.message); }
  }

  async function loadFromGitHub(item, btn) {
    btn.disabled = true;
    try { applyLoaded(S.parseDocument(await GH.loadFile(cfg, item.path))); }
    catch (e) { toast(e.message, 6000); }
    btn.disabled = false;
  }

  async function saveToGitHub() {
    if (!ensureResult()) return;
    if (!GH.isConfigured(cfg)) { openSettings('먼저 GitHub 저장소를 연결해 주세요.', 'err'); return; }
    var j = buildJson(), btn = $('btn-save');
    btn.disabled = true; btn.textContent = '저장 중…';
    try {
      var saved = await GH.saveFile(cfg, j.name, j.text, j.title || 'loan');
      toast('저장했어요: ' + saved);
      refreshList();
    } catch (e) { toast(e.message, 7000); }
    btn.disabled = false; btn.textContent = '저장';
  }

  /* ---------- 연결 설정 창 ---------- */
  var dlg = $('settings');
  function setMsg(text, kind) { var m = $('s-msg'); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }

  function openSettings(message, kind) {
    $('s-owner').value = cfg.owner; $('s-repo').value = cfg.repo;
    $('s-branch').value = cfg.branch; $('s-folder').value = cfg.folder;
    $('s-remember').checked = cfg.remember;
    $('s-token').value = '';
    $('s-token').placeholder = cfg.token ? '저장된 토큰 사용 중 (바꾸려면 새로 입력)' : 'github_pat_...';
    setMsg(message, kind);
    if (!dlg.open) dlg.showModal();
  }

  async function connect() {
    var next = {
      owner: $('s-owner').value.trim(), repo: $('s-repo').value.trim(),
      branch: $('s-branch').value.trim() || 'main', folder: GH.cleanFolder($('s-folder').value),
      remember: $('s-remember').checked, token: $('s-token').value.trim() || cfg.token
    };
    if (!next.owner || !next.repo) return setMsg('아이디와 저장소를 입력해 주세요.', 'err');
    if (!next.token) return setMsg('토큰을 입력해 주세요. GitHub → Settings → Developer settings → Fine-grained tokens에서 발급할 수 있어요.', 'err');

    var btn = $('s-connect'); btn.disabled = true; setMsg('연결을 확인하는 중…');
    try {
      var r = await GH.verify(next);
      next.isPublic = r.isPublic;
      cfg = next; GH.saveConfig(cfg);
      renderConn(); refreshList();
      setMsg('연결됐어요. 저장소, 브랜치, 쓰기 권한을 확인했어요.' + (r.warnings.length ? '\n\n⚠ ' + r.warnings.join('\n⚠ ') : ''), r.warnings.length ? 'warn' : 'ok');
    } catch (e) { setMsg(e.message, 'err'); }
    btn.disabled = false;
  }

  function disconnect() {
    GH.clearToken();
    cfg.token = ''; cfg.isPublic = false;
    GH.saveConfig(cfg);
    $('s-token').value = '';
    renderConn(); refreshList();
    setMsg('연결을 해제하고 저장된 토큰을 삭제했어요.', 'ok');
  }

  /* ---------- 이벤트 ---------- */
  fields.principal.addEventListener('input', function () { formatPrincipalInput(fields.principal); update(); });
  fields.rate.addEventListener('input', function () {
    var v = fields.rate.value.replace(/[^\d.\-]/g, '');
    if (v !== fields.rate.value) fields.rate.value = v;
    update();
  });
  [fields.years, fields.grace].forEach(function (el) {
    el.addEventListener('input', function () {
      // 소수점·음수는 지우지 않고 검증 오류로 안내한다 (문자 등은 제거)
      var v = el.value.replace(/[^\d.\-]/g, '').slice(0, 6);
      if (v !== el.value) el.value = v;
      update();
    });
  });
  document.querySelectorAll('input[name="method"]').forEach(function (r) { r.addEventListener('change', update); });
  $('loan-form').addEventListener('submit', function (e) { e.preventDefault(); });

  $('btn-save').addEventListener('click', saveToGitHub);
  $('title-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveToGitHub(); });
  $('btn-json').addEventListener('click', function () {
    if (!ensureResult()) return;
    var j = buildJson(); download(j.name, j.text, 'application/json');
  });
  $('btn-csv').addEventListener('click', function () {
    if (!ensureResult()) return;
    var name = F.fileBase($('title-input').value, new Date()) + '.csv';
    download(name, S.scheduleToCsv(current.result.schedule, current.input.graceMonths), 'text/csv;charset=utf-8');
  });
  $('btn-open').addEventListener('click', function () { $('file-input').click(); });
  $('file-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { try { applyLoaded(S.parseDocument(String(reader.result))); } catch (err) { toast(err.message, 6000); } };
    reader.onerror = function () { toast('파일을 읽지 못했어요. 다시 선택해 주세요.'); };
    reader.readAsText(file, 'utf-8');
  });

  $('btn-settings').addEventListener('click', function () { openSettings(); });
  $('btn-refresh').addEventListener('click', refreshList);
  $('s-connect').addEventListener('click', connect);
  $('s-disconnect').addEventListener('click', disconnect);
  $('s-close').addEventListener('click', function () { dlg.close(); });

  /* ---------- 시작 ---------- */
  renderConn();
  refreshList();
  update();
})();
