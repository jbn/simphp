/*
 * PHP 4.1.1 Simulator -- UI and the simulated Apache/1.3 + CGI web server.
 *
 * The PHP engine itself runs in worker.js (the real PHP 4.1.1 C code compiled
 * to wasm). This file plays the part of the web server and the web browser:
 * it maps URLs to files, builds CGI environments, keeps a cookie jar,
 * follows redirects, and routes links/forms from the rendered page back in.
 */
/* global CodeMirror, PHPSim */
(function () {
  'use strict';

  const DOCROOT = '/var/www';
  const SERVER_SOFTWARE = 'Apache/1.3.22 (Unix)';
  const DEFAULT_UA = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)';
  const PHP_EXT = /\.(php|php3|php4|phtml)$/i;
  const STORE_KEY = 'phpsim.workspace.v1';
  const enc = new TextEncoder();
  const $ = (id) => document.getElementById(id);

  const MIME = {
    html: 'text/html', htm: 'text/html', txt: 'text/plain', css: 'text/css', js: 'application/x-javascript',
    xml: 'text/xml', gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    ico: 'image/x-icon', svg: 'image/svg+xml', json: 'text/plain', inc: 'text/plain', phps: 'text/plain',
  };

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const state = {
    files: {},            // abs path -> { data: Uint8Array, mtime } ; dirs: 'path/' -> null
    current: DOCROOT + '/index.php',
    mode: 'web',
    url: '/index.php',
    history: [],
    hIndex: -1,
    cookies: {},          // name -> { value, expires (ms|null) }
    settings: { tz: '', ini: 'none', kill: 60, charset: 'auto', follow: true, mysql: true },
    ua: DEFAULT_UA,
    cli: { args: '-q', extra: '', stdin: '' },
    busy: false,
    logCount: 0,
    lastPage: null,       // { url, html }
  };

  // --------------------------------------------------------------------------
  // Byte helpers
  // --------------------------------------------------------------------------
  const toBytes = (s) => (typeof s === 'string' ? enc.encode(s) : s);
  function isUtf8(bytes) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true; } catch (e) { return false; }
  }
  function decodeText(bytes, charset) {
    let cs = (charset || state.settings.charset || 'auto').toLowerCase();
    if (cs === 'iso-8859-1' || cs === 'latin1') cs = 'windows-1252';
    if (cs === 'auto') cs = isUtf8(bytes) ? 'utf-8' : 'windows-1252';
    try { return new TextDecoder(cs).decode(bytes); } catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }
  function isBinary(bytes) {
    const n = Math.min(bytes.length, 4096);
    for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
    return !isUtf8(bytes.subarray(0, n)) && n > 0 && !isUtf8(bytes);
  }
  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  const dirname = (p) => p.substring(0, p.lastIndexOf('/')) || '/';

  // --------------------------------------------------------------------------
  // Engine (worker) management
  // --------------------------------------------------------------------------
  const engine = {
    worker: null,
    ready: null,
    seq: 0,
    pending: new Map(),
    spawn() {
      if (this.worker) this.worker.terminate();
      for (const [, p] of this.pending) p.reject(new Error('engine restarted'));
      this.pending.clear();
      this.worker = new Worker('worker.js');
      setEngineStatus('loading', 'loading engine…');
      this.ready = new Promise((resolve, reject) => {
        this.worker.onmessage = (ev) => {
          const m = ev.data;
          if (m.type === 'ready') {
            $('engine-status').title = m.build === 'php-jspi'
              ? 'Engine: PHP 4.1.1 CGI (wasm, JSPI stack)' : 'Engine: PHP 4.1.1 CGI (wasm)';
            setEngineStatus('ready', 'PHP 4.1.1 ready');
            resolve();
          }
          else if (m.type === 'fatal') { setEngineStatus('error', 'engine failed'); reject(new Error(m.error)); }
          else if (m.type === 'result') {
            const p = this.pending.get(m.id);
            if (!p) return;
            this.pending.delete(m.id);
            clearTimeout(p.timer);
            if (m.error) p.reject(new Error(m.error)); else p.resolve(m.result);
          }
        };
        this.worker.onerror = (e) => { setEngineStatus('error', 'engine error'); reject(new Error(e.message || 'worker error')); };
      });
      this.worker.postMessage({ type: 'init' });
      return this.ready;
    },
    async run(request) {
      await this.ready;
      const id = ++this.seq;
      const killMs = Math.max(5, +state.settings.kill || 60) * 1000;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(Object.assign(new Error('killed'), { killed: true, seconds: killMs / 1000 }));
          this.spawn();
        }, killMs);
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ type: 'run', id, request });
      });
    },
  };

  function setEngineStatus(kind, text) {
    const el = $('engine-status');
    el.className = 'engine-status ' + kind;
    el.textContent = text;
  }

  // --------------------------------------------------------------------------
  // Filesystem helpers
  // --------------------------------------------------------------------------
  function setFile(path, data) {
    state.files[path] = { data: toBytes(data), mtime: Date.now() };
  }
  function fileText(path) {
    const f = state.files[path];
    return f ? decodeText(f.data, 'auto') : '';
  }
  function snapshotFiles() {
    flushEditor();
    const out = {};
    for (const [p, f] of Object.entries(state.files)) out[p] = f ? { data: f.data, mtime: f.mtime } : null;
    return out;
  }
  function absorbFiles(files) {
    // The PHP process returns the complete persistent disk (/var/www, /tmp, /etc, /home).
    const next = {};
    for (const [p, f] of Object.entries(files)) next[p] = f ? { data: f.data, mtime: f.mtime } : null;
    const editorPath = state.current;
    const before = state.files[editorPath];
    state.files = next;
    const after = state.files[editorPath];
    if (after && before && !sameBytes(after.data, before.data)) loadEditor(editorPath, true);
    else if (!after && before) {
      toast(editorPath + ' was deleted by the script');
      pickDefaultFile();
    }
    renderTree();
    persist();
  }
  const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  // --------------------------------------------------------------------------
  // Editor
  // --------------------------------------------------------------------------
  let cm = null;
  let fallbackTa = null;
  let loadingEditor = false;

  function modeFor(path) {
    if (PHP_EXT.test(path) || /\.inc$/i.test(path)) return 'application/x-httpd-php';
    if (/\.html?$/i.test(path)) return 'htmlmixed';
    if (/\.css$/i.test(path)) return 'css';
    if (/\.js$/i.test(path)) return 'javascript';
    if (/\.xml$/i.test(path)) return 'xml';
    if (/\.ini(-dist|-recommended)?$/i.test(path)) return 'properties';
    return 'text/plain';
  }

  function initEditor() {
    const host = $('editor');
    if (window.CodeMirror) {
      cm = CodeMirror(host, {
        value: '', mode: 'application/x-httpd-php', lineNumbers: true, indentUnit: 4, tabSize: 4,
        indentWithTabs: false, matchBrackets: true, lineWrapping: false,
        extraKeys: {
          'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run(),
          'Ctrl-S': () => { flushEditor(); persist(); toast('Saved'); }, 'Cmd-S': () => { flushEditor(); persist(); toast('Saved'); },
          Tab: (c) => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'),
        },
      });
      cm.on('change', () => { if (!loadingEditor) { markDirty(true); scheduleAutosave(); } });
    } else {
      fallbackTa = document.createElement('textarea');
      fallbackTa.className = 'fallback';
      fallbackTa.spellcheck = false;
      host.appendChild(fallbackTa);
      fallbackTa.addEventListener('input', () => { markDirty(true); scheduleAutosave(); });
      fallbackTa.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      });
    }
  }
  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => { flushEditor(); persist(); }, 800);
  }
  function editorValue() { return cm ? cm.getValue() : fallbackTa.value; }
  function setEditorValue(v, path) {
    loadingEditor = true;
    if (cm) {
      cm.setOption('mode', modeFor(path));
      cm.setOption('readOnly', false);
      cm.setValue(v);
      cm.clearHistory();
    } else fallbackTa.value = v;
    loadingEditor = false;
  }
  let editorBinary = false;
  function loadEditor(path, keepCursor) {
    const f = state.files[path];
    state.current = path;
    const cursor = keepCursor && cm ? cm.getCursor() : null;
    editorBinary = !!(f && isBinary(f.data));
    if (editorBinary) {
      setEditorValue('/* binary file: ' + fmtSize(f.data.length) + ' — not editable */', path);
      if (cm) cm.setOption('readOnly', true);
    } else setEditorValue(f ? decodeText(f.data, 'auto') : '', path);
    if (cursor) cm.setCursor(cursor);
    $('editor-filename').textContent = path.startsWith(DOCROOT + '/') ? path.slice(DOCROOT.length + 1) : path;
    $('cli-script').textContent = path.startsWith(DOCROOT + '/') ? path.slice(DOCROOT.length + 1) : path;
    markDirty(false);
    renderTree();
  }
  function markDirty(d) { $('editor-dirty').hidden = !d; }
  function flushEditor() {
    if (editorBinary || !state.current) return;
    const v = editorValue();
    const f = state.files[state.current];
    const bytes = enc.encode(v);
    if (!f || !sameBytes(f.data, bytes)) state.files[state.current] = { data: bytes, mtime: Date.now() };
    markDirty(false);
  }
  function pickDefaultFile() {
    const candidates = Object.keys(state.files).filter((p) => state.files[p] && p.startsWith(DOCROOT + '/'));
    const pick = candidates.find((p) => p === DOCROOT + '/index.php') || candidates.sort()[0];
    if (pick) loadEditor(pick);
    else { state.current = null; setEditorValue('', 'x.php'); renderTree(); }
  }

  // --------------------------------------------------------------------------
  // File tree
  // --------------------------------------------------------------------------
  function renderTree() {
    const tree = $('file-tree');
    tree.textContent = '';
    const groups = [
      { root: DOCROOT, label: '/var/www', editable: true },
      { root: '/etc', label: '/etc', editable: true },
      { root: '/tmp', label: '/tmp', editable: false },
      { root: '/home', label: '/home', editable: true },
      { root: '/var/mail', label: '/var/mail', editable: false },
      { root: '/var/lib/mysql', label: '/var/lib/mysql', editable: false },
    ];
    for (const g of groups) {
      const paths = Object.keys(state.files)
        .filter((p) => state.files[p] && p.startsWith(g.root + '/'))
        .sort((a, b) => {
          const da = a.split('/').length, db = b.split('/').length;
          return a.localeCompare(b) + 0 * (da - db);
        });
      if (!paths.length && g.root !== DOCROOT) continue;
      const head = document.createElement('div');
      head.className = 'tree-dir';
      head.textContent = g.label + '/';
      tree.appendChild(head);
      for (const p of paths) {
        const rel = p.slice(g.root.length + 1);
        const row = document.createElement('div');
        row.className = 'tree-file' + (p === state.current ? ' active' : '') + (g.editable ? '' : ' server');
        row.setAttribute('role', 'treeitem');
        row.title = p + ' — ' + fmtSize(state.files[p].data.length) + (g.root === DOCROOT && /\.(php\d?|phtml|html?)$/i.test(p) ? ' (double-click to open in the browser)' : '');
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = rel;
        row.appendChild(name);
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = g.editable ? '' : fmtSize(state.files[p].data.length);
        row.appendChild(meta);
        const del = document.createElement('button');
        del.className = 'del';
        del.title = 'Delete ' + rel;
        del.textContent = '×';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm('Delete ' + p + '?')) return;
          delete state.files[p];
          if (p === state.current) pickDefaultFile();
          renderTree();
          persist();
        });
        row.appendChild(del);
        row.addEventListener('click', () => { flushEditor(); loadEditor(p); });
        row.addEventListener('dblclick', () => {
          if (g.root === DOCROOT) { navigate({ url: '/' + rel, method: 'GET' }); }
        });
        tree.appendChild(row);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Cookie jar
  // --------------------------------------------------------------------------
  function parseCookieDate(s) {
    // PHP 4 format: "Fri, 25-Sep-2026 21:43:01 GMT"
    let t = Date.parse(s);
    if (isNaN(t)) {
      const m = s.match(/(\d{1,2})-(\w{3})-(\d{2,4}) (\d{2}):(\d{2}):(\d{2})/);
      if (m) {
        const mon = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[2]) / 3;
        let y = +m[3]; if (y < 100) y += y < 70 ? 2000 : 1900;
        t = Date.UTC(y, mon, +m[1], +m[4], +m[5], +m[6]);
      }
    }
    return isNaN(t) ? null : t;
  }
  function absorbCookies(headers) {
    for (const [k, v] of headers) {
      if (k.toLowerCase() !== 'set-cookie') continue;
      const parts = v.split(';');
      const [name, ...rest] = parts[0].split('=');
      const value = rest.join('=');
      let expires = null;
      for (const attr of parts.slice(1)) {
        const [ak, ...av] = attr.trim().split('=');
        if (ak.toLowerCase() === 'expires') expires = parseCookieDate(av.join('='));
      }
      const n = name.trim();
      if (!n) continue;
      if (expires !== null && expires <= Date.now()) delete state.cookies[n];
      else state.cookies[n] = { value, expires };
    }
    renderCookies();
  }
  function cookieHeader() {
    const now = Date.now();
    const out = [];
    for (const [n, c] of Object.entries(state.cookies)) {
      if (c.expires !== null && c.expires <= now) { delete state.cookies[n]; continue; }
      out.push(n + '=' + c.value);
    }
    return out.join('; ');
  }
  function renderCookies() {
    const lines = Object.entries(state.cookies).map(([n, c]) =>
      n + '=' + c.value + (c.expires ? '   (expires ' + new Date(c.expires).toUTCString() + ')' : '   (session)'));
    $('cookie-view').textContent = lines.length ? lines.join('\n') : '(no cookies)';
  }

  // --------------------------------------------------------------------------
  // The simulated web server
  // --------------------------------------------------------------------------
  function resolveUrl(href, base) {
    const u = new URL(href, 'http://localhost' + (base || state.url || '/'));
    return u;
  }

  function apacheError(status, reason, body) {
    const html = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<HTML><HEAD>\n<TITLE>' + status + ' ' + reason +
      '</TITLE>\n</HEAD><BODY>\n<H1>' + reason + '</H1>\n' + body + '<P>\n<HR>\n<ADDRESS>' + SERVER_SOFTWARE +
      ' Server at localhost Port 80</ADDRESS>\n</BODY></HTML>\n';
    return { status, reason, headers: [['Content-Type', 'text/html; charset=iso-8859-1']], body: enc.encode(html), php: false };
  }

  function buildEnv(req, u, scriptPath, extra) {
    const scriptName = scriptPath.slice(DOCROOT.length);
    const env = {
      SERVER_SOFTWARE,
      SERVER_NAME: 'localhost',
      SERVER_ADDR: '127.0.0.1',
      SERVER_PORT: '80',
      SERVER_ADMIN: 'webmaster@localhost',
      SERVER_SIGNATURE: '<ADDRESS>' + SERVER_SOFTWARE + ' Server at localhost Port 80</ADDRESS>\n',
      SERVER_PROTOCOL: 'HTTP/1.1',
      GATEWAY_INTERFACE: 'CGI/1.1',
      REQUEST_METHOD: req.method,
      QUERY_STRING: u.search ? u.search.slice(1) : '',
      REQUEST_URI: u.pathname + u.search,
      SCRIPT_NAME: scriptName,
      SCRIPT_FILENAME: scriptPath,
      PATH_TRANSLATED: scriptPath,
      DOCUMENT_ROOT: DOCROOT,
      REMOTE_ADDR: '127.0.0.1',
      REMOTE_PORT: String(32768 + Math.floor(Math.random() * 28000)),
      REDIRECT_STATUS: '200',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      HTTP_HOST: 'localhost',
      HTTP_USER_AGENT: state.ua || DEFAULT_UA,
      HTTP_ACCEPT: 'image/gif, image/x-xbitmap, image/jpeg, image/pjpeg, */*',
      HTTP_ACCEPT_LANGUAGE: 'en-us',
      HTTP_ACCEPT_ENCODING: 'gzip, deflate',
      HTTP_CONNECTION: 'Keep-Alive',
    };
    if (extra) env.PATH_INFO = extra;
    const cookie = cookieHeader();
    if (cookie) env.HTTP_COOKIE = cookie;
    if (req.referer) env.HTTP_REFERER = 'http://localhost' + req.referer;
    if (req.method === 'POST') {
      env.CONTENT_TYPE = req.ctype || 'application/x-www-form-urlencoded';
      env.CONTENT_LENGTH = String(req.body ? req.body.length : 0);
    }
    if (state.settings.tz) env.TZ = state.settings.tz;
    return env;
  }

  async function serve(req) {
    const u = resolveUrl(req.url);
    let path;
    try { path = decodeURIComponent(u.pathname); } catch (e) { path = u.pathname; }
    if (path.includes('\0') || path.split('/').includes('..')) return apacheError(400, 'Bad Request', '<P>Your browser sent a request that this server could not understand.\n');
    let fsPath = DOCROOT + path;
    let pathInfo = '';
    const isDir = (p) => Object.keys(state.files).some((k) => k.startsWith(p.replace(/\/$/, '') + '/'));
    if (!state.files[fsPath] && !fsPath.endsWith('/') && isDir(fsPath)) {
      return { status: 301, reason: 'Moved Permanently', headers: [['Location', 'http://localhost' + path + '/' + u.search]], body: enc.encode(''), php: false };
    }
    if (fsPath.endsWith('/')) {
      const idx = ['index.php', 'index.html', 'index.htm', 'index.php3', 'index.phtml'].map((n) => fsPath + n).find((p) => state.files[p]);
      if (!idx) return apacheError(403, 'Forbidden', '<P>You don\'t have permission to access ' + escapeHtml(path) + '\non this server.\n');
      fsPath = idx;
    }
    if (!state.files[fsPath]) {
      // Apache-style PATH_INFO: /script.php/extra/stuff
      const m = fsPath.match(/^(.*?\.(?:php\d?|phtml))(\/.*)$/i);
      if (m && state.files[m[1]]) { fsPath = m[1]; pathInfo = m[2]; }
      else return apacheError(404, 'Not Found', '<P>The requested URL ' + escapeHtml(path) + ' was not found on this server.\n');
    }
    if (!PHP_EXT.test(fsPath)) {
      const ext = (fsPath.match(/\.([^./]+)$/) || [])[1] || '';
      const type = MIME[ext.toLowerCase()] || 'text/plain';
      return { status: 200, reason: 'OK', headers: [['Last-Modified', new Date(state.files[fsPath].mtime).toUTCString()], ['Content-Type', type]], body: state.files[fsPath].data, php: false };
    }
    const env = buildEnv(req, u, fsPath, pathInfo);
    const t0 = performance.now();
    const r = await engine.run({
      args: [], env, stdin: req.body || '', files: snapshotFiles(), cwd: dirname(fsPath), mysqld: !!state.settings.mysql,
    });
    let res = PHPSim.parseCGI(r.stdout);
    const headersDone = hasHeaderEnd(r.stdout);
    if (r.crash) {
      // Apache 1.3 + CGI: a dead child with no complete headers is a 500;
      // otherwise the partial page already went out to the browser.
      apacheLog('notice', 'child pid ' + (1000 + Math.floor(Math.random() * 30000)) + ' exit signal Segmentation fault (11)', false);
      if (!headersDone) {
        apacheLog('error', 'Premature end of script headers: ' + fsPath, true);
        res = apache500();
      }
    } else if (!headersDone && r.stdout.length === 0) {
      apacheLog('error', 'Premature end of script headers: ' + fsPath, true);
      res = apache500();
    }
    res.php = true;
    res.stderr = r.stderr;
    res.exitCode = r.exitCode;
    res.aborted = r.aborted;
    res.elapsed = performance.now() - t0;
    res.phpElapsed = r.elapsedMs;
    res.env = env;
    absorbFiles(r.files);
    return res;
  }

  function hasHeaderEnd(b) {
    for (let i = 0; i < b.length - 1; i++) {
      if (b[i] === 10 && b[i + 1] === 10) return true;
      if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return true;
    }
    return false;
  }

  function apache500() {
    return apacheError(500, 'Internal Server Error',
      'The server encountered an internal error or\nmisconfiguration and was unable to complete\nyour request.<P>\n' +
      'Please contact the server administrator,\n webmaster@localhost and inform them of the time the error occurred,\n' +
      'and anything you might have done that may have\ncaused the error.<P>\n' +
      'More information about this error may be available\nin the server error log.\n');
  }

  // Apache 1.3 error_log line: [Wed Dec 26 10:43:10 2001] [error] [client 127.0.0.1] ...
  function apacheLog(level, msg, isErr) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = d.toDateString().replace(/ (\d{4})$/, '') + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + d.getFullYear();
    log('[' + stamp + '] [' + level + ']' + (level === 'error' ? ' [client 127.0.0.1]' : '') + ' ' + msg, isErr, true);
  }

  function responseHead(res) {
    const lines = ['HTTP/1.1 ' + res.status + ' ' + res.reason, 'Date: ' + new Date().toUTCString(), 'Server: ' + SERVER_SOFTWARE];
    for (const [k, v] of res.headers) lines.push(k + ': ' + v);
    if (!res.headers.some(([k]) => /^content-type$/i.test(k))) lines.push('Content-Type: text/plain');
    lines.push('Content-Length: ' + res.body.length, 'Connection: close');
    return lines;
  }

  function contentType(res) {
    const h = res.headers.find(([k]) => /^content-type$/i.test(k));
    return h ? h[1] : 'text/plain';
  }

  // --------------------------------------------------------------------------
  // Browser: navigation, history, rendering
  // --------------------------------------------------------------------------
  async function navigate(req, opts = {}) {
    if (state.busy) return;
    state.busy = true;
    $('btn-run').disabled = true;
    setEngineStatus('busy', 'running…');
    setStatus('<span class="hl-dim">requesting ' + escapeHtml(req.method + ' ' + req.url) + ' …</span>');
    const chain = [];
    try {
      let cur = Object.assign({}, req);
      let res;
      for (let hop = 0; hop < 10; hop++) {
        state.url = cur.url;
        $('url').value = cur.url;
        $('url-method').textContent = cur.method;
        res = await serve(cur);
        if (res.php) absorbCookies(res.headers);
        chain.push({ req: cur, res });
        const loc = res.headers.find(([k]) => /^location$/i.test(k));
        if (loc && res.status >= 300 && res.status < 400 && state.settings.follow) {
          const next = resolveUrl(loc[1], cur.url);
          if (next.host !== 'localhost') break;
          cur = { method: 'GET', url: next.pathname + next.search, referer: cur.referer };
          continue;
        }
        break;
      }
      const final = chain[chain.length - 1];
      state.url = final.req.url;
      $('url').value = final.req.url;
      $('url-method').textContent = final.req.method;
      if (!opts.fromHistory) {
        state.history = state.history.slice(0, state.hIndex + 1);
        state.history.push(final.req);
        state.hIndex = state.history.length - 1;
      }
      updateNavButtons();
      showResponse(final.req, final.res, chain);
    } catch (e) {
      if (e.killed) {
        log('[simulator] PHP process killed after ' + e.seconds + 's (hard limit). The script ignored max_execution_time.', true);
        setStatus('<span class="bad">killed</span> after ' + e.seconds + 's — see Log');
        showPageHtml('<body style="font:14px sans-serif;padding:20px"><h3>Process killed</h3><p>The script ran longer than the hard limit of ' + e.seconds + ' seconds (Server settings).</p></body>');
      } else {
        log('[simulator] ' + (e.stack || e), true);
        setStatus('<span class="bad">error</span> ' + escapeHtml(String(e.message || e)));
      }
    } finally {
      state.busy = false;
      $('btn-run').disabled = false;
      if ($('engine-status').classList.contains('busy')) setEngineStatus('ready', 'PHP 4.1.1 ready');
      persist();
    }
  }

  function updateNavButtons() {
    $('nav-back').disabled = state.hIndex <= 0;
    $('nav-fwd').disabled = state.hIndex >= state.history.length - 1;
  }

  function setStatus(html) { $('status-text').innerHTML = html; }

  function showResponse(req, res, chain) {
    const ctype = contentType(res);
    const charset = (ctype.match(/charset=([\w-]+)/i) || [])[1];
    const body = res.body;

    // Source
    $('source-view').textContent = isBinary(body) ? '(binary response, ' + fmtSize(body.length) + ')' : decodeText(body, charset);

    // Headers (whole exchange, including redirects)
    const hv = $('headers-view');
    hv.textContent = '';
    chain.forEach(({ req: q, res: r }, i) => {
      const reqLines = [q.method + ' ' + q.url + ' HTTP/1.1', 'Host: localhost', 'User-Agent: ' + (state.ua || DEFAULT_UA)];
      if (r.env && r.env.HTTP_COOKIE) reqLines.push('Cookie: ' + r.env.HTTP_COOKIE);
      if (q.referer) reqLines.push('Referer: http://localhost' + q.referer);
      if (q.method === 'POST') reqLines.push('Content-Type: ' + (q.ctype || 'application/x-www-form-urlencoded'), 'Content-Length: ' + (q.body ? q.body.length : 0));
      appendHl(hv, '> ', 'hl-dim'); appendHl(hv, reqLines[0] + '\n', 'hl-status');
      reqLines.slice(1).forEach((l) => { appendHl(hv, '> ', 'hl-dim'); appendHeaderLine(hv, l); });
      appendHl(hv, '\n');
      const head = responseHead(r);
      appendHl(hv, '< ', 'hl-dim'); appendHl(hv, head[0] + '\n', 'hl-status');
      head.slice(1).forEach((l) => { appendHl(hv, '< ', 'hl-dim'); appendHeaderLine(hv, l); });
      if (i < chain.length - 1) appendHl(hv, '\n— following redirect —\n\n', 'hl-dim');
    });

    // Log (the CGI's stderr lands in Apache's error_log verbatim)
    if (res.stderr && res.stderr.length) log(decodeText(res.stderr), true, true);
    if (res.aborted) log('[simulator] ' + res.aborted, true);

    // Page
    if (/^image\//i.test(ctype)) {
      showPageHtml('<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#e8e8e8"><img src="data:' + ctype + ';base64,' + b64(body) + '"></body>');
    } else if (/^text\/html/i.test(ctype) || (!res.php && /\.html?$/i.test(req.url))) {
      showPageHtml(decodeText(body, charset));
    } else if (/^(text\/|application\/(x-)?javascript|application\/xml)/i.test(ctype)) {
      showPageHtml('<pre style="word-wrap:break-word;white-space:pre-wrap;margin:8px;font:13px monospace">' + escapeHtml(decodeText(body, charset)) + '</pre>');
    } else {
      showPageHtml('<body style="font:14px sans-serif;padding:20px"><p>The server sent <b>' + escapeHtml(ctype) + '</b> (' + fmtSize(body.length) + '). A browser would offer to download it.</p></body>');
    }

    // Status bar
    const cls = res.status < 300 ? 'ok' : res.status < 400 ? 'redir' : 'bad';
    const parts = ['<span class="' + cls + '">' + res.status + ' ' + escapeHtml(res.reason) + '</span>', escapeHtml(ctype.split(';')[0]), fmtSize(body.length)];
    if (res.php) parts.push(Math.round(res.phpElapsed) + ' ms');
    else parts.push('static');
    if (chain.length > 1) parts.push((chain.length - 1) + ' redirect' + (chain.length > 2 ? 's' : ''));
    setStatus(parts.join(' · '));
  }

  function appendHl(el, text, cls) {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    el.appendChild(s);
  }
  function appendHeaderLine(el, line) {
    const i = line.indexOf(':');
    if (i < 0) { appendHl(el, line + '\n'); return; }
    appendHl(el, line.slice(0, i + 1), 'hl-name');
    appendHl(el, line.slice(i + 1) + '\n');
  }

  function log(text, isErr, raw) {
    const lv = $('log-view');
    if (!raw) appendHl(lv, '[' + new Date().toLocaleTimeString() + '] ', 'hl-dim');
    appendHl(lv, text.replace(/\s+$/, '') + '\n', isErr ? 'hl-err' : '');
    lv.scrollTop = lv.scrollHeight;
    if (isErr && !document.querySelector('.tab[data-tab="log"]').classList.contains('active')) {
      state.logCount++;
      $('log-badge').textContent = state.logCount;
      $('log-badge').hidden = false;
    }
  }

  // Script injected into rendered pages so that links, forms and relative
  // resources go back through the simulated server.
  const SHIM = '<script>(' + function () {
    var P = window.parent;
    function send(m) { m.__phpsim = 1; P.postMessage(m, '*'); }
    function nav(href, target) { send({ type: 'nav', href: href }); }
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href],area[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || /^(javascript:|mailto:)/i.test(href)) return;
      e.preventDefault();
      if (href.charAt(0) === '#') {
        var id = decodeURIComponent(href.slice(1));
        var t = id ? (document.getElementById(id) || document.getElementsByName(id)[0]) : document.body;
        if (t && t.scrollIntoView) t.scrollIntoView();
        return;
      }
      nav(href);
    });
    function collect(form, submitter) {
      var fd;
      try { fd = new FormData(form, submitter || undefined); } catch (err) { fd = new FormData(form); if (submitter && submitter.name) fd.append(submitter.name, submitter.value); }
      var entries = [];
      fd.forEach(function (v, k) { entries.push([k, v]); });
      if (submitter && submitter.type === 'image' && submitter.name) {
        entries.push([submitter.name + '.x', '1']); entries.push([submitter.name + '.y', '1']);
      }
      send({
        type: 'submit', action: form.getAttribute('action') || '',
        method: (form.getAttribute('method') || 'get').toLowerCase(),
        enctype: (form.getAttribute('enctype') || 'application/x-www-form-urlencoded').toLowerCase(),
        entries: entries,
      });
    }
    document.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      e.preventDefault();
      collect(e.target, e.submitter);
    });
    var realSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () { collect(this, null); };
    // Relative images/stylesheets are fetched from the simulated server.
    var pending = {};
    function wantResources() {
      var list = [];
      var els = document.querySelectorAll('img[src],input[type=image][src],link[rel~=stylesheet][href],body[background],td[background],table[background]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var attr = el.hasAttribute('src') ? 'src' : el.hasAttribute('href') ? 'href' : 'background';
        var v = el.getAttribute(attr);
        if (!v || /^(data:|blob:|https?:\/\/(?!localhost[/:]|localhost$))/i.test(v) || /^\/\//.test(v)) continue;
        (pending[v] = pending[v] || []).push([el, attr]);
        if (list.indexOf(v) < 0) list.push(v);
      }
      if (list.length) send({ type: 'resources', urls: list });
      send({ type: 'title', title: document.title });
    }
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (!m || m.__phpsimParent !== 1 || m.type !== 'resource') return;
      (pending[m.url] || []).forEach(function (p) {
        if (p[1] === 'background') p[0].style.backgroundImage = 'url("' + m.dataUrl + '")';
        else p[0].setAttribute(p[1], m.dataUrl);
      });
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wantResources);
    else wantResources();
    void realSubmit;
  } + ')();</' + 'script>';

  // The rendered page must not fetch relative URLs from the real host (they
  // belong to the simulated server); point its base URL at a host that can
  // never resolve, and let the shim fetch them through the simulator instead.
  const BASE = '<base href="http://phpsim.invalid/">';

  function showPageHtml(html) {
    $('page-empty').hidden = true;
    const m = html.match(/^\s*<!doctype[^>]*>/i);
    const doc = m ? m[0] + BASE + SHIM + html.slice(m[0].length) : BASE + SHIM + html;
    state.lastPage = { url: state.url };
    $('page-frame').srcdoc = doc;
  }

  // Messages from the rendered page
  window.addEventListener('message', async (ev) => {
    const frame = $('page-frame');
    if (ev.source !== frame.contentWindow) return;
    const m = ev.data;
    if (!m || m.__phpsim !== 1) return;
    const base = state.url;
    if (m.type === 'nav') {
      const u = resolveUrl(m.href, base);
      if (u.host !== 'localhost') {
        window.open(u.href, '_blank', 'noopener');
        return;
      }
      navigate({ method: 'GET', url: u.pathname + u.search, referer: base });
    } else if (m.type === 'submit') {
      const u = resolveUrl(m.action || base, base);
      if (u.host !== 'localhost') { toast('Form posts to ' + u.host + ' — outside the simulated server'); return; }
      if (m.method === 'post') {
        const req = { method: 'POST', url: u.pathname + u.search, referer: base };
        if (m.enctype === 'multipart/form-data') {
          const fd = new FormData();
          for (const [k, v] of m.entries) {
            if (v instanceof File) fd.append(k, v, v.name);
            else fd.append(k, v);
          }
          const r = new Request('http://localhost/', { method: 'POST', body: fd });
          req.ctype = r.headers.get('content-type');
          req.body = new Uint8Array(await r.arrayBuffer());
        } else if (m.enctype === 'text/plain') {
          req.ctype = 'text/plain';
          req.body = enc.encode(m.entries.map(([k, v]) => k + '=' + (v instanceof File ? v.name : v)).join('\r\n'));
        } else {
          req.ctype = 'application/x-www-form-urlencoded';
          req.body = enc.encode(formEncode(m.entries));
        }
        navigate(req);
      } else {
        u.search = '?' + formEncode(m.entries);
        navigate({ method: 'GET', url: u.pathname + u.search, referer: base });
      }
    } else if (m.type === 'resources') {
      loadResources(m.urls.slice(0, 24), base);
    }
  });

  function formEncode(entries) {
    // application/x-www-form-urlencoded as browsers of the era sent it (spaces as +)
    return entries.map(([k, v]) => {
      const val = v instanceof File ? v.name : String(v);
      return encodeURIComponent(k).replace(/%20/g, '+') + '=' + encodeURIComponent(val).replace(/%20/g, '+');
    }).join('&');
  }

  async function loadResources(urls, base) {
    // Serve sub-resources one at a time after the page itself, like a browser
    // with a single connection. PHP-generated images (e.g. phpinfo()'s logo)
    // run through the engine too.
    for (const url of urls) {
      if (state.url !== base) return;
      const u = resolveUrl(url, base);
      if (u.host !== 'localhost') continue;
      try {
        while (state.busy) await new Promise((r) => setTimeout(r, 30));
        state.busy = true;
        const res = await serve({ method: 'GET', url: u.pathname + u.search, referer: base });
        state.busy = false;
        if (res.status !== 200) continue;
        const ctype = contentType(res).split(';')[0];
        const dataUrl = 'data:' + ctype + ';base64,' + b64(res.body);
        const frame = $('page-frame');
        if (frame.contentWindow) frame.contentWindow.postMessage({ __phpsimParent: 1, type: 'resource', url, dataUrl }, '*');
      } catch (e) {
        state.busy = false;
      }
    }
  }

  // --------------------------------------------------------------------------
  // CLI mode
  // --------------------------------------------------------------------------
  function shellSplit(s) {
    const out = [];
    const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2] !== undefined ? m[2] : m[3]);
    return out;
  }

  async function runCli() {
    if (state.busy) return;
    flushEditor();
    state.busy = true;
    $('btn-run').disabled = true;
    setEngineStatus('busy', 'running…');
    const out = $('cli-output');
    const flags = shellSplit($('cli-args').value);
    const extra = shellSplit($('cli-extra').value);
    const script = state.current || DOCROOT + '/index.php';
    const standalone = flags.some((f) => /^-[vimh?]$/.test(f));
    const args = standalone ? flags : [...flags, script, ...extra];
    const shown = 'php ' + args.map((a) => (/[\s"']/.test(a) ? "'" + a + "'" : a)).join(' ');
    out.textContent = '';
    appendHl(out, '$ ' + shown.replace(DOCROOT + '/', '') + '\n', 'exit');
    try {
      const t0 = performance.now();
      const env = {
        PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/root', USER: 'root', LOGNAME: 'root',
        SHELL: '/bin/bash', TERM: 'xterm', PWD: dirname(script), LANG: 'C',
      };
      if (state.settings.tz) env.TZ = state.settings.tz;
      const r = await engine.run({ args, env, stdin: $('cli-stdin').value, files: snapshotFiles(), cwd: dirname(script), mysqld: !!state.settings.mysql });
      absorbFiles(r.files);
      appendHl(out, decodeText(r.stdout));
      if (r.stderr.length) appendHl(out, decodeText(r.stderr), 'stderr');
      if (r.crash) appendHl(out, (r.stdout.length && r.stdout[r.stdout.length - 1] !== 10 ? '\n' : '') + 'Segmentation fault\n', 'stderr');
      if (r.aborted) appendHl(out, '\n[simulator] ' + r.aborted + '\n', 'stderr');
      const ms = Math.round(performance.now() - t0);
      appendHl(out, (r.stdout.length && r.stdout[r.stdout.length - 1] !== 10 ? '\n' : '') + '[exit status ' + r.exitCode + ']\n', 'exit' + (r.exitCode ? ' bad' : ''));
      setStatus('<span class="' + (r.exitCode ? 'bad' : 'ok') + '">exit ' + r.exitCode + '</span> · ' + fmtSize(r.stdout.length) + ' · ' + ms + ' ms');
    } catch (e) {
      if (e.killed) appendHl(out, '\nKilled (hard limit of ' + e.seconds + 's)\n', 'stderr');
      else appendHl(out, '\n' + (e.stack || e) + '\n', 'stderr');
      setStatus('<span class="bad">error</span>');
    } finally {
      state.busy = false;
      $('btn-run').disabled = false;
      setEngineStatus('ready', 'PHP 4.1.1 ready');
      persist();
    }
  }

  // --------------------------------------------------------------------------
  // Run button / modes
  // --------------------------------------------------------------------------
  function run() {
    flushEditor();
    persist();
    if (state.mode === 'cli') return runCli();
    const h = state.history[state.hIndex];
    // Re-send the current request (like pressing reload); a POST re-posts.
    if (h && h.url === state.url) return navigate(Object.assign({}, h), { fromHistory: true });
    return navigate(requestFromPanel(state.url));
  }

  function requestFromPanel(url) {
    const method = $('req-method').value;
    const req = { method, url };
    if (method === 'POST') {
      req.ctype = $('req-ctype').value;
      req.body = enc.encode($('req-body').value);
    }
    return req;
  }

  function setMode(mode) {
    state.mode = mode;
    $('mode-web').classList.toggle('active', mode === 'web');
    $('mode-cli').classList.toggle('active', mode === 'cli');
    $('mode-web').setAttribute('aria-checked', mode === 'web');
    $('mode-cli').setAttribute('aria-checked', mode === 'cli');
    $('web-view').hidden = mode !== 'web';
    $('cli-view').hidden = mode !== 'cli';
    persist();
  }

  // --------------------------------------------------------------------------
  // Persistence & sharing
  // --------------------------------------------------------------------------
  let persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 250);
  }
  function persistNow() {
    clearTimeout(persistTimer);
    {
      try {
        const files = {};
        for (const [p, f] of Object.entries(state.files)) files[p] = f ? [b64(f.data), f.mtime] : null;
        const data = {
          files, current: state.current, mode: state.mode, url: state.url, cookies: state.cookies,
          settings: state.settings, ua: state.ua,
          cli: { args: $('cli-args').value, extra: $('cli-extra').value, stdin: $('cli-stdin').value },
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable or full: the session still works */ }
    }
  }
  function restore() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      state.files = {};
      for (const [p, f] of Object.entries(d.files || {})) state.files[p] = f ? { data: unb64(f[0]), mtime: f[1] } : null;
      state.current = d.current;
      state.url = d.url || '/index.php';
      state.cookies = d.cookies || {};
      Object.assign(state.settings, d.settings || {});
      state.ua = d.ua || DEFAULT_UA;
      if (d.cli) { $('cli-args').value = d.cli.args; $('cli-extra').value = d.cli.extra; $('cli-stdin').value = d.cli.stdin; }
      setMode(d.mode === 'cli' ? 'cli' : 'web');
      return Object.keys(state.files).length > 0;
    } catch (e) { return false; }
  }

  async function compress(str) {
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function decompress(s) {
    const bytes = unb64(s.replace(/-/g, '+').replace(/_/g, '/'));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }
  async function share() {
    flushEditor();
    const files = {};
    for (const [p, f] of Object.entries(state.files)) {
      if (!f || !(p.startsWith(DOCROOT + '/') || p === '/etc/php.ini')) continue;
      if (isBinary(f.data)) continue;
      files[p] = decodeText(f.data, 'utf-8');
    }
    const payload = JSON.stringify({ v: 1, files, url: state.url, mode: state.mode, current: state.current,
      cli: { args: $('cli-args').value, extra: $('cli-extra').value, stdin: $('cli-stdin').value } });
    try {
      const hash = '#w=' + await compress(payload);
      const link = location.href.split('#')[0] + hash;
      history.replaceState(null, '', hash);
      try { await navigator.clipboard.writeText(link); toast('Link copied to clipboard'); }
      catch (e) { toast('Link is in the address bar'); }
    } catch (e) { toast('Sharing needs a browser with CompressionStream'); }
  }
  async function loadShared() {
    const m = location.hash.match(/^#w=([\w-]+)/);
    if (!m) return false;
    try {
      const d = JSON.parse(await decompress(m[1]));
      // keep the visitor's own workspace recoverable
      try {
        const mine = localStorage.getItem(STORE_KEY);
        if (mine) localStorage.setItem(STORE_KEY + '.before-share', mine);
      } catch (e) {}
      state.files = {};
      for (const [p, t] of Object.entries(d.files)) setFile(p, t);
      state.url = d.url || '/index.php';
      state.current = d.current;
      if (d.cli) { $('cli-args').value = d.cli.args || '-q'; $('cli-extra').value = d.cli.extra || ''; $('cli-stdin').value = d.cli.stdin || ''; }
      setMode(d.mode === 'cli' ? 'cli' : 'web');
      history.replaceState(null, '', location.pathname + location.search);
      toast('Loaded shared files');
      return true;
    } catch (e) { toast('Could not read the shared link'); return false; }
  }

  // --------------------------------------------------------------------------
  // Examples
  // --------------------------------------------------------------------------
  let examples = [];
  async function loadExampleList() {
    try {
      examples = await (await fetch('examples/index.json')).json();
      const sel = $('examples');
      for (const ex of examples) {
        const o = document.createElement('option');
        o.value = ex.id;
        o.textContent = ex.title;
        sel.appendChild(o);
      }
    } catch (e) { /* examples optional */ }
  }
  async function loadExample(id, silent) {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    const texts = await Promise.all(ex.files.map((f) => fetch('examples/' + ex.id + '/' + f).then((r) => r.text())));
    for (const p of Object.keys(state.files)) if (p.startsWith(DOCROOT + '/')) delete state.files[p];
    ex.files.forEach((f, i) => setFile(DOCROOT + '/' + f, texts[i]));
    state.history = []; state.hIndex = -1; updateNavButtons();
    state.url = '/' + ex.entry;
    $('url').value = state.url;
    $('req-method').value = 'GET';
    loadEditor(DOCROOT + '/' + ex.entry);
    if (ex.mode === 'cli') {
      $('cli-args').value = ex.args || '-q';
      $('cli-extra').value = ex.extra || '';
      $('cli-stdin').value = ex.stdin || '';
      setMode('cli');
    } else setMode('web');
    persist();
    if (!silent) run();
  }

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------
  const TZ_CHOICES = ['UTC', 'GMT', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Moscow',
    'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'EST5EDT', 'PST8PDT'];
  function initSettings() {
    const sel = $('set-tz');
    let local = '';
    try { local = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = 'unset — the machine\'s zone' + (local ? ' (' + local + ')' : '');
    sel.appendChild(o0);
    for (const tz of TZ_CHOICES) {
      const o = document.createElement('option');
      o.value = tz; o.textContent = 'TZ=' + tz;
      sel.appendChild(o);
    }
    sel.value = state.settings.tz || '';
    if (sel.value !== (state.settings.tz || '')) {
      const o = document.createElement('option'); o.value = o.textContent = state.settings.tz; sel.appendChild(o); sel.value = state.settings.tz;
    }
    sel.addEventListener('change', () => { state.settings.tz = sel.value; persist(); });
    $('set-ini').value = state.files['/etc/php.ini'] ? (state.settings.ini === 'none' ? 'dist' : state.settings.ini) : 'none';
    $('set-ini').addEventListener('change', async (e) => {
      const v = e.target.value;
      state.settings.ini = v;
      if (v === 'none') {
        delete state.files['/etc/php.ini'];
        if (state.current === '/etc/php.ini') pickDefaultFile();
      } else {
        const txt = await (await fetch('ini/php.ini-' + v)).text();
        setFile('/etc/php.ini', txt);
        toast('Created /etc/php.ini from php.ini-' + v);
      }
      renderTree();
      persist();
    });
    $('set-kill').value = state.settings.kill;
    $('set-kill').addEventListener('change', (e) => { state.settings.kill = Math.max(5, +e.target.value || 60); persist(); });
    $('set-charset').value = state.settings.charset;
    $('set-charset').addEventListener('change', (e) => { state.settings.charset = e.target.value; persist(); });
    $('set-mysql').checked = state.settings.mysql !== false;
    $('set-mysql').addEventListener('change', (e) => { state.settings.mysql = e.target.checked; persist(); });
    $('btn-reset-mysql').addEventListener('click', () => {
      if (!confirm('Delete all MySQL databases? (A fresh server starts with `mysql` and `test`.)')) return;
      for (const p of Object.keys(state.files)) if (p.startsWith('/var/lib/mysql/')) delete state.files[p];
      renderTree(); persist(); toast('Databases reset');
    });
    $('set-follow').checked = state.settings.follow;
    $('set-follow').addEventListener('change', (e) => { state.settings.follow = e.target.checked; persist(); });
    $('req-ua').value = state.ua;
    $('req-ua').addEventListener('change', (e) => { state.ua = e.target.value || DEFAULT_UA; persist(); });
  }
  function toggleSettings(show) {
    $('settings').hidden = !show;
    $('btn-settings').setAttribute('aria-expanded', String(show));
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // --------------------------------------------------------------------------
  // Wire-up
  // --------------------------------------------------------------------------
  const STARTER = `<html>
<head><title>My first PHP 4 page</title></head>
<body>
<?php
  // Everything here runs on the real PHP 4.1.1 engine.
  echo "<h1>Hello from PHP " . phpversion() . "!</h1>\\n";

  $visitors = array("Rasmus", "Zeev", "Andi");
  foreach ($visitors as $i => $name) {
      echo "<p>" . ($i + 1) . ". $name</p>\\n";
  }

  echo "<p>Today is " . date("l, F jS, Y") . ".</p>";
?>
</body>
</html>
`;

  async function main() {
    initEditor();
    engine.spawn().catch((e) => { log('[simulator] failed to start the engine: ' + e.message, true); });
    await loadExampleList();

    const fromShare = await loadShared();
    const restored = fromShare || restore();
    if (!restored) {
      setFile(DOCROOT + '/index.php', STARTER);
      state.current = DOCROOT + '/index.php';
    }
    initSettings();
    if (!state.current || !state.files[state.current]) pickDefaultFile(); else loadEditor(state.current);
    $('url').value = state.url;
    renderTree();
    renderCookies();
    setMode(state.mode);

    $('btn-run').addEventListener('click', run);
    $('mode-web').addEventListener('click', () => setMode('web'));
    $('mode-cli').addEventListener('click', () => setMode('cli'));
    $('url-form').addEventListener('submit', (e) => {
      e.preventDefault();
      let v = $('url').value.trim().replace(/^https?:\/\/localhost(:\d+)?/i, '');
      if (!v.startsWith('/')) v = '/' + v;
      navigate(requestFromPanel(v));
    });
    $('nav-back').addEventListener('click', () => {
      if (state.hIndex > 0) { state.hIndex--; navigate(Object.assign({}, state.history[state.hIndex]), { fromHistory: true }); }
    });
    $('nav-fwd').addEventListener('click', () => {
      if (state.hIndex < state.history.length - 1) { state.hIndex++; navigate(Object.assign({}, state.history[state.hIndex]), { fromHistory: true }); }
    });
    $('nav-reload').addEventListener('click', run);
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === t.dataset.tab));
      if (t.dataset.tab === 'log') { state.logCount = 0; $('log-badge').hidden = true; }
    }));
    $('examples').addEventListener('change', (e) => {
      const id = e.target.value;
      e.target.value = '';
      if (!id) return;
      flushEditor();
      loadExample(id);
    });
    $('btn-share').addEventListener('click', share);
    $('btn-settings').addEventListener('click', () => toggleSettings(true));
    $('btn-close-settings').addEventListener('click', () => toggleSettings(false));
    $('settings').addEventListener('click', (e) => { if (e.target === $('settings')) toggleSettings(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('settings').hidden) toggleSettings(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !(cm && cm.hasFocus())) { e.preventDefault(); run(); }
    });
    $('btn-new-file').addEventListener('click', () => {
      const name = prompt('New file (relative to /var/www, or an absolute path):', 'test.php');
      if (!name) return;
      const p = name.startsWith('/') ? name : DOCROOT + '/' + name.replace(/^\.?\//, '');
      if (state.files[p] && !confirm(p + ' exists. Open it?')) return;
      flushEditor();
      if (!state.files[p]) setFile(p, PHP_EXT.test(p) ? '<?php\n\n?>\n' : '');
      loadEditor(p);
      if (p.startsWith(DOCROOT + '/') && /\.(php\d?|phtml|html?)$/i.test(p)) {
        state.url = p.slice(DOCROOT.length);
        $('url').value = state.url;
      }
      persist();
    });
    $('btn-reset-tmp').addEventListener('click', () => {
      for (const p of Object.keys(state.files)) if (p.startsWith('/tmp/')) delete state.files[p];
      renderTree(); persist(); toast('/tmp cleared (sessions and uploads gone)');
    });
    $('btn-reset-all').addEventListener('click', () => {
      if (!confirm('Delete every file, cookie and setting and start over?')) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      history.replaceState(null, '', location.pathname);
      location.reload();
    });
    $('btn-clear-cookies').addEventListener('click', () => { state.cookies = {}; renderCookies(); persist(); });
    $('req-method').addEventListener('change', () => { $('url-method').textContent = $('req-method').value; });
    ['cli-args', 'cli-extra', 'cli-stdin'].forEach((id) => $(id).addEventListener('change', persist));
    $('cli-args').addEventListener('keydown', (e) => { if (e.key === 'Enter') runCli(); });
    $('cli-extra').addEventListener('keydown', (e) => { if (e.key === 'Enter') runCli(); });
    window.addEventListener('beforeunload', () => { flushEditor(); persistNow(); });

    await engine.ready.catch(() => {});
    run();
  }

  main();
})();
