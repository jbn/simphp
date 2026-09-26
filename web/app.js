/*
 * PHP 4.1.1 Simulator -- UI and the simulated Apache/1.3 + CGI web server.
 *
 * The PHP engine itself runs in worker.js (the real PHP 4.1.1 C code compiled
 * to wasm). This file plays the part of the web server and the web browser:
 * it maps URLs to files, builds CGI environments, keeps a cookie jar,
 * follows redirects, and routes links/forms from the rendered page back in.
 */
/* global CodeMirror, SimPHP */
(function () {
  'use strict';

  const { DOCROOT, DEFAULT_UA, PHP_EXT, toBytes, isBinary, b64, unb64, escapeHtml, fmtSize, dirname, sameBytes,
    shellSplit, compress, decompress, appendHl } = SimWeb;
  const STORE_KEY = 'simphp.workspace.v1';
  const enc = new TextEncoder();
  const $ = (id) => document.getElementById(id);

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

  const decodeText = (bytes, charset) => SimWeb.decodeText(bytes, charset || state.settings.charset);

  // --------------------------------------------------------------------------
  // Engine (worker) and the simulated web server
  // --------------------------------------------------------------------------
  const engine = new SimWeb.Engine({
    killSeconds: () => state.settings.kill,
    onStatus: (kind, text, build) => {
      if (build) $('engine-status').title = build === 'php-jspi' ? 'Engine: PHP 4.1.1 CGI (wasm, JSPI stack)' : 'Engine: PHP 4.1.1 CGI (wasm)';
      setEngineStatus(kind, text);
    },
  });
  const server = new SimWeb.Server({
    engine,
    files: snapshotFiles,
    absorb: absorbFiles,
    settings: () => ({ tz: state.settings.tz, mysql: !!state.settings.mysql, follow: state.settings.follow, ua: state.ua }),
    cookies: () => state.cookies,
    log: (text, isErr) => log(text, isErr, true),
  });

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
  // Cookie jar (kept by the server; shown in the Request tab)
  // --------------------------------------------------------------------------
  function renderCookies() {
    const lines = Object.entries(state.cookies).map(([n, c]) =>
      n + '=' + c.value + (c.expires ? '   (expires ' + new Date(c.expires).toUTCString() + ')' : '   (session)'));
    $('cookie-view').textContent = lines.length ? lines.join('\n') : '(no cookies)';
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
    try {
      const chain = await server.request(req, (cur) => {
        state.url = cur.url;
        $('url').value = cur.url;
        $('url-method').textContent = cur.method;
      });
      renderCookies();
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
    const ctype = SimWeb.contentType(res);
    const charset = (ctype.match(/charset=([\w-]+)/i) || [])[1];
    $('source-view').textContent = isBinary(res.body) ? '(binary response, ' + fmtSize(res.body.length) + ')' : decodeText(res.body, charset);
    SimWeb.renderExchange($('headers-view'), chain, state.ua);
    showPageHtml(SimWeb.pageHtml(req, res, state.settings.charset));
    setStatus(SimWeb.statusHtml(res, chain.length - 1));
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

  function showPageHtml(html) {
    $('page-empty').hidden = true;
    state.lastPage = { url: state.url };
    $('page-frame').srcdoc = SimWeb.frameDoc(html);
  }

  // Messages from the rendered page
  window.addEventListener('message', async (ev) => {
    const frame = $('page-frame');
    if (ev.source !== frame.contentWindow) return;
    const base = state.url;
    const a = await SimWeb.pageAction(ev.data, base);
    if (!a) return;
    if (a.external) window.open(a.external, '_blank', 'noopener');
    else if (a.blocked) toast('Form posts to ' + a.blocked + ' — outside the simulated server');
    else if (a.nav) navigate(a.nav);
    else if (a.resources) server.loadResources(a.resources, base, frame, () => state.url !== base);
  });

  // --------------------------------------------------------------------------
  // CLI mode
  // --------------------------------------------------------------------------
  async function runCli() {
    if (state.busy) return;
    flushEditor();
    state.busy = true;
    $('btn-run').disabled = true;
    setEngineStatus('busy', 'running…');
    const out = $('cli-output');
    const script = state.current || DOCROOT + '/index.php';
    out.textContent = '';
    try {
      const t0 = performance.now();
      const r = await server.cli({ script, flags: shellSplit($('cli-args').value), extra: shellSplit($('cli-extra').value), stdin: $('cli-stdin').value });
      const shown = 'php ' + r.args.map((a) => (/[\s"']/.test(a) ? "'" + a + "'" : a)).join(' ');
      appendHl(out, '$ ' + shown.replace(DOCROOT + '/', '') + '\n', 'exit');
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
