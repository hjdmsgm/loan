/* GitHub Contents API 연동 + 연결 설정 저장 */
(function (root) {
  'use strict';

  var API = 'https://api.github.com';
  var CFG_KEY = 'loan.gh.config';
  var TOKEN_KEY = 'loan.gh.token';

  /* ---------- 연결 설정 (브라우저 저장소) ---------- */
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  function loadConfig() {
    var cfg = safe(function () { return JSON.parse(localStorage.getItem(CFG_KEY)); }, null) || {};
    var token = safe(function () { return localStorage.getItem(TOKEN_KEY); }, null);
    var fromLocal = !!token;
    if (!token) token = safe(function () { return sessionStorage.getItem(TOKEN_KEY); }, null);
    return {
      owner: cfg.owner || '', repo: cfg.repo || '', branch: cfg.branch || 'main',
      folder: cfg.folder || 'results', remember: cfg.remember != null ? cfg.remember : fromLocal,
      token: token || '', isPublic: !!cfg.isPublic
    };
  }

  function saveConfig(cfg) {
    safe(function () {
      localStorage.setItem(CFG_KEY, JSON.stringify({
        owner: cfg.owner, repo: cfg.repo, branch: cfg.branch, folder: cfg.folder,
        remember: cfg.remember, isPublic: !!cfg.isPublic
      }));
    });
    // 토큰은 선택에 따라 한 곳에만 둔다
    safe(function () { localStorage.removeItem(TOKEN_KEY); });
    safe(function () { sessionStorage.removeItem(TOKEN_KEY); });
    if (cfg.token) {
      safe(function () { (cfg.remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, cfg.token); });
    }
  }

  /** 연결 해제: 저장된 토큰을 모두 삭제 (나머지 입력값은 유지) */
  function clearToken() {
    safe(function () { localStorage.removeItem(TOKEN_KEY); });
    safe(function () { sessionStorage.removeItem(TOKEN_KEY); });
  }

  function isConfigured(cfg) { return !!(cfg.token && cfg.owner && cfg.repo); }

  /* ---------- 오류 ---------- */
  function GitHubError(status, apiMessage, message) {
    this.name = 'GitHubError';
    this.status = status;
    this.apiMessage = apiMessage || '';
    this.message = message;
  }
  GitHubError.prototype = Object.create(Error.prototype);

  function explain(status, apiMessage, ctx) {
    var msg = String(apiMessage || '');
    switch (status) {
      case 401:
        return '토큰이 올바르지 않거나 만료되었어요. GitHub에서 토큰을 새로 발급한 뒤 연결 설정에 다시 입력해 주세요.';
      case 403:
        if (/rate limit/i.test(msg)) return 'GitHub 요청 한도를 넘었어요. 잠시 후 다시 시도해 주세요.';
        return '이 토큰에 권한이 없어요. fine-grained 토큰의 대상 저장소에 Repository permissions → Contents: "Read and write"가 설정되어 있는지 확인해 주세요.';
      case 404:
        if (ctx === 'list') return null; // 폴더가 아직 없음 → 빈 목록으로 처리
        return '저장소, 브랜치 또는 파일을 찾을 수 없어요. 아이디·저장소·브랜치 철자를 확인하고, 토큰이 이 Private 저장소에 접근할 수 있도록 선택되어 있는지 확인해 주세요.';
      case 422:
        if (ctx === 'save') return '저장 요청이 거부되었어요. 같은 이름의 파일이 이미 있거나 브랜치·폴더 이름이 올바르지 않을 수 있어요. 연결 설정을 확인해 주세요.';
        return '요청이 올바르지 않아요. 브랜치·폴더 이름을 확인해 주세요.';
      default:
        return 'GitHub 요청에 실패했어요 (' + status + '). ' + msg;
    }
  }

  async function request(cfg, path, opts, ctx) {
    opts = opts || {};
    var res;
    try {
      res = await fetch(API + path, {
        method: opts.method || 'GET',
        headers: Object.assign({
          'Accept': opts.accept || 'application/vnd.github+json',
          'Authorization': 'Bearer ' + cfg.token,
          'X-GitHub-Api-Version': '2022-11-28'
        }, opts.body ? { 'Content-Type': 'application/json' } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      throw new GitHubError(0, '', '네트워크 연결에 실패했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    }
    if (!res.ok) {
      var apiMsg = '';
      try { apiMsg = (await res.json()).message || ''; } catch (e) { /* ignore */ }
      throw new GitHubError(res.status, apiMsg, explain(res.status, apiMsg, ctx));
    }
    return res;
  }

  function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function repoPath(cfg) { return '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo); }
  function cleanFolder(f) { return String(f || '').trim().replace(/^\/+|\/+$/g, '') || 'results'; }

  function toBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  /* ---------- 기능 ---------- */

  /** 저장소·브랜치·쓰기 권한 확인. 반환: {isPublic, warnings[]} */
  async function verify(cfg) {
    var res = await request(cfg, repoPath(cfg), {}, 'connect');
    var repo = await res.json();
    var warnings = [];
    if (repo.permissions && repo.permissions.push === false)
      throw new GitHubError(403, '', '이 토큰에는 저장소 쓰기 권한이 없어요. 토큰의 Contents 권한을 "Read and write"로 설정해 주세요.');
    if (!repo.permissions)
      warnings.push('쓰기 권한은 확인하지 못했어요. 저장할 때 오류가 나면 토큰의 Contents 권한을 확인해 주세요.');
    await request(cfg, repoPath(cfg) + '/branches/' + encodePath(cfg.branch), {}, 'connect');
    if (!repo.private)
      warnings.push('이 저장소는 Public이에요. 저장한 대출 정보가 누구에게나 공개됩니다. Private 저장소 사용을 권장해요.');
    return { isPublic: !repo.private, warnings: warnings };
  }

  /** 파일 저장. 같은 이름이 있으면(422) _2, _3 … 을 붙여 재시도. 반환: 실제 저장된 파일명 */
  async function saveFile(cfg, fileName, text, title) {
    var folder = cleanFolder(cfg.folder);
    var dot = fileName.lastIndexOf('.');
    var stem = fileName.slice(0, dot), ext = fileName.slice(dot);
    var content = toBase64(text);
    for (var n = 1; n <= 5; n++) {
      var name = n === 1 ? fileName : stem + '_' + n + ext;
      try {
        await request(cfg, repoPath(cfg) + '/contents/' + encodePath(folder + '/' + name), {
          method: 'PUT',
          body: { message: 'Add loan result: ' + (title || 'loan'), content: content, branch: cfg.branch }
        }, 'save');
        return name;
      } catch (e) {
        var exists = e instanceof GitHubError && e.status === 422 && /sha/i.test(e.apiMessage);
        if (!exists || n === 5) throw e;
      }
    }
  }

  /** 저장 목록 (최신순). 폴더가 없으면 빈 배열 */
  async function listFiles(cfg, parseFileName) {
    var folder = cleanFolder(cfg.folder);
    var res;
    try {
      res = await request(cfg, repoPath(cfg) + '/contents/' + encodePath(folder) + '?ref=' + encodeURIComponent(cfg.branch), {}, 'list');
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
    var items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter(function (f) { return f.type === 'file' && /\.json$/i.test(f.name); })
      .map(function (f) { var p = parseFileName(f.name); return { name: f.name, path: f.path, title: p.title, date: p.date, sortKey: p.sortKey }; })
      .sort(function (a, b) { return a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : (a.name < b.name ? 1 : -1); });
  }

  async function loadFile(cfg, path) {
    var res = await request(cfg, repoPath(cfg) + '/contents/' + encodePath(path) + '?ref=' + encodeURIComponent(cfg.branch),
      { accept: 'application/vnd.github.raw+json' }, 'load');
    return res.text();
  }

  root.LoanGitHub = {
    loadConfig: loadConfig, saveConfig: saveConfig, clearToken: clearToken, isConfigured: isConfigured,
    cleanFolder: cleanFolder, verify: verify, saveFile: saveFile, listFiles: listFiles, loadFile: loadFile,
    GitHubError: GitHubError
  };
})(window);
