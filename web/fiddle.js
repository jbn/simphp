/*
 * PHP 4.1.1 Fiddle -- a jsfiddle-style front end for the simulator.
 *
 * Each fiddle is a project with its own server disk (web root files, /tmp,
 * MySQL databases, php.ini), cookie jar and settings. Everything is saved to
 * IndexedDB (fiddle-store.js) as you type, so a reload picks up where you
 * left off. The web server itself is shared with the classic UI (simweb.js).
 */
/* global CodeMirror, SimWeb, FiddleStore */
(function () {
  'use strict';

  const { DOCROOT, DEFAULT_UA, PHP_EXT, isBinary, escapeHtml, fmtSize, dirname, sameBytes,
    shellSplit, compress, decompress, appendHl } = SimWeb;
  const enc = new TextEncoder();
  const $ = (id) => document.getElementById(id);
  const PREFS_KEY = 'simphp.fiddle.prefs';
  const EDITABLE_ROOTS = ['/var/www/', '/etc/', '/home/', '/tmp/'];
  const WEB_PAGE = /\.(php\d?|phtml|html?)$/i;

  const store = new FiddleStore();
  let projects = [];          // project records (for the list)
  let P = null;               // the open fiddle (see openContext)
  let examples = [];
  const prefs = { autorun: false, wrap: false, side: true, split: 50 };

  // --------------------------------------------------------------------------
  // Small helpers
  // --------------------------------------------------------------------------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const rel = (p) => (p.startsWith(DOCROOT + '/') ? p.slice(DOCROOT.length + 1) : p);
  const decodeText = (bytes, charset) => SimWeb.decodeText(bytes, charset || (P ? P.rec.settings.charset : 'auto'));

  function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 7 * 86400) return Math.round(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** A user-typed file name -> absolute path, or null if unusable. */
  function toAbsPath(name) {
    let n = String(name || '').trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (!n) return null;
    const abs = n.startsWith('/') ? n : DOCROOT + '/' + n.replace(/^(\.\/)+/, '');
    const parts = abs.split('/');
    if (parts.includes('..') || parts.includes('.') || abs.includes('\0')) return null;
    if (!EDITABLE_ROOTS.some((r) => abs.startsWith(r) && abs.length > r.length)) return null;
    return abs;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }

  function loadPrefs() {
    try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) { /* defaults */ }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* per-viewer nicety only */ }
  }

  // --------------------------------------------------------------------------
  // Engine
  // --------------------------------------------------------------------------
  function setEngineStatus(kind, text) {
    const el = $('engine-status');
    el.className = 'engine-status ' + kind;
    el.textContent = text;
  }
  const engine = new SimWeb.Engine({
    killSeconds: () => (P ? P.rec.settings.kill : 60),
    onStatus: (kind, text, build) => {
      if (build) $('engine-status').title = build === 'php-jspi' ? 'Engine: PHP 4.1.1 CGI (wasm, JSPI stack)' : 'Engine: PHP 4.1.1 CGI (wasm)';
      setEngineStatus(kind, kind === 'ready' ? 'PHP 4.1.1' : text);
    },
  });

  // --------------------------------------------------------------------------
  // Fiddle records
  // --------------------------------------------------------------------------
  function newRecord(name) {
    const now = Date.now();
    return {
      id: uid(), name: name || 'Untitled fiddle', created: now, updated: now,
      entry: '/index.php', url: '/index.php', mode: 'web',
      open: [], current: null, fileCount: 0,
      cli: { args: '-q', extra: '', stdin: '', script: '' },
      req: { method: 'GET', ctype: 'application/x-www-form-urlencoded', body: '' },
      cookies: {}, ua: DEFAULT_UA,
      settings: { tz: '', ini: 'none', kill: 60, charset: 'auto', mysql: true, follow: true },
    };
  }

  const STARTER = {
    'index.php': `<?php
// The entry page (marked with a star in the file list). Every request runs
// the real PHP 4.1.1 engine as a CGI, the way Apache 1.3 did in 2001.
include 'lib/greeting.php';
?>
<html>
<head>
  <title>Hello, PHP 4</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<h1><?php echo greet(isset($HTTP_GET_VARS['name']) ? $HTTP_GET_VARS['name'] : 'world'); ?></h1>

<form method="get">
  Your name: <input name="name">
  <input type="submit" value="Greet me">
</form>

<p class="small">PHP <?php echo phpversion(); ?> &middot; <?php echo date('D, d M Y H:i:s'); ?></p>
</body>
</html>
`,
    'lib/greeting.php': `<?php
// Included by index.php. Add as many files and folders as you like.
function greet($who)
{
    $who = htmlspecialchars(ucfirst(trim($who)));
    return "Hello, $who!";
}
?>
`,
    'style.css': `body { font-family: Georgia, serif; margin: 2em; background: #fdfdf6; color: #222; }
h1 { color: #4f5b93; }
.small { font-size: 0.85em; color: #777; }
`,
  };
  const BLANK = { 'index.php': '<?php\n\necho "Hello, world!\\n";\n\n?>\n' };

  function filesFrom(map) {
    const out = {};
    const now = Date.now();
    for (const [name, text] of Object.entries(map)) {
      const p = name.startsWith('/') ? name : DOCROOT + '/' + name;
      out[p] = { data: enc.encode(text), mtime: now };
    }
    return out;
  }

  /** Create and save a fiddle, then open it. */
  async function createFiddle(rec, files) {
    rec.fileCount = Object.keys(files).filter((p) => files[p] && p.startsWith(DOCROOT + '/')).length;
    const main = rec.entry && files[DOCROOT + rec.entry] ? DOCROOT + rec.entry : Object.keys(files).find((p) => files[p] && PHP_EXT.test(p));
    if (!rec.open.length && main) { rec.open = [main]; rec.current = main; }
    const changes = {};
    for (const [p, f] of Object.entries(files)) changes[p] = f;
    try { await store.save(rec, changes); } catch (e) { toast('Could not save: ' + (e.message || e)); }
    projects = projects.filter((r) => r.id !== rec.id).concat([rec]);
    await openFiddle(rec.id, { rec, files });
  }

  // --------------------------------------------------------------------------
  // The open fiddle
  // --------------------------------------------------------------------------
  // P = { rec, files, changed: Set<path>, snap, busy, history, hIndex, server }
  // Each open gets a fresh context; late results from a previous fiddle's
  // PHP process still land in (and are saved to) their own context.
  function openContext(rec, files) {
    const ctx = { rec, files, changed: new Set(), snap: null, busy: false, history: [], hIndex: -1, url: rec.url || rec.entry };
    ctx.server = new SimWeb.Server({
      engine,
      files: () => {
        if (ctx === P) flushEdits();
        ctx.snap = Object.assign({}, ctx.files);
        return ctx.snap;
      },
      absorb: (next) => absorbFiles(ctx, next),
      settings: () => ({ tz: rec.settings.tz, mysql: rec.settings.mysql !== false, follow: rec.settings.follow !== false, ua: rec.ua }),
      cookies: () => rec.cookies,
      log: (text, isErr) => { if (ctx === P) log(text, isErr, true); },
    });
    return ctx;
  }

  async function openFiddle(id, preloaded) {
    if (P) { flushEdits(); await saveNow(P); }
    let rec, files;
    if (preloaded) ({ rec, files } = preloaded);
    else {
      rec = await store.getProject(id);
      if (!rec) { toast('That fiddle no longer exists'); return false; }
      files = await store.getFiles(id);
    }
    rec = Object.assign(newRecord(), rec, { settings: Object.assign(newRecord().settings, rec.settings) });
    P = openContext(rec, files);
    store.setMeta('last', rec.id).catch(() => {});
    history.replaceState(null, '', location.pathname + location.search + '#f=' + rec.id);

    editor.reset();
    const open = (rec.open || []).filter((p) => files[p]);
    rec.open = open;
    if (!rec.current || !files[rec.current]) rec.current = open[0] || defaultFile();
    if (rec.current && !rec.open.includes(rec.current)) rec.open.push(rec.current);

    $('project-name').value = rec.name;
    document.title = rec.name + ' — PHP 4.1.1 Fiddle';
    $('url').value = P.url;
    $('url-method').textContent = 'GET';
    $('log-view').textContent = '';
    $('source-view').textContent = '';
    $('headers-view').textContent = '';
    $('cli-output').textContent = '';
    $('page-frame').removeAttribute('srcdoc');
    $('page-empty').hidden = false;
    setLogBadge(0);
    setStatus('ready');
    syncControls();
    setMode(rec.mode, true);
    if (rec.current) showFile(rec.current);
    else editor.show(null);
    renderAll();
    updateNavButtons();
    setSaveState('saved');
    engine.ready.then(() => { if (P && P.rec === rec) run(); }, () => {});
    return true;
  }

  function defaultFile() {
    const ps = Object.keys(P.files).filter((p) => P.files[p] && p.startsWith(DOCROOT + '/')).sort();
    return ps.find((p) => p === DOCROOT + P.rec.entry) || ps.find((p) => PHP_EXT.test(p)) || ps[0] || null;
  }

  /** The disk as it came back from a PHP process. */
  function absorbFiles(ctx, next) {
    const prev = ctx.files;
    const snap = ctx.snap || {};
    const out = {};
    for (const [p, f] of Object.entries(next)) out[p] = f ? { data: f.data, mtime: f.mtime } : null;
    // Files the user edited while the process ran keep the user's version.
    for (const p of Object.keys(prev)) {
      if (prev[p] !== snap[p] && (out[p] === undefined || (snap[p] && out[p] && sameBytes(out[p].data, snap[p].data)))) out[p] = prev[p];
    }
    const changedHere = [];
    for (const p of new Set([...Object.keys(prev), ...Object.keys(out)])) {
      const a = prev[p], b = out[p];
      const same = a === b || (a && b && a.mtime === b.mtime && sameBytes(a.data, b.data)) || (a === null && b === null);
      if (!same) { ctx.changed.add(p); changedHere.push(p); }
    }
    ctx.files = out;
    if (!changedHere.length) return;
    if (ctx === P) {
      for (const p of changedHere) {
        if (!editor.isOpen(p)) continue;
        if (!out[p]) { closeTab(p, true); toast(rel(p) + ' was deleted by the script'); }
        else if (!pendingEdits.has(p)) editor.reload(p);
      }
      renderFiles();
      renderServerFiles();
      renderCliScripts();
    }
    persist(ctx, changedHere.some((p) => p.startsWith(DOCROOT + '/')));
  }

  // --------------------------------------------------------------------------
  // Saving
  // --------------------------------------------------------------------------
  let saveTimer = null;
  function persist(ctx, touch) {
    ctx = ctx || P;
    if (!ctx) return;
    if (touch) ctx.touch = true;
    if (ctx !== P) { saveNow(ctx); return; }
    setSaveState('unsaved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(ctx), 350);
  }

  async function saveNow(ctx) {
    ctx = ctx || P;
    if (!ctx) return;
    if (ctx === P) { clearTimeout(saveTimer); flushEdits(); }
    const rec = ctx.rec;
    const changes = {};
    for (const p of ctx.changed) changes[p] = ctx.files[p];
    ctx.changed.clear();
    if (ctx.touch || Object.keys(changes).length) {
      rec.updated = Date.now();
      rec.fileCount = Object.keys(ctx.files).filter((p) => ctx.files[p] && p.startsWith(DOCROOT + '/')).length;
    }
    ctx.touch = false;
    if (ctx === P) setSaveState('saving');
    try {
      await store.save(rec, changes);
      if (ctx === P && !ctx.changed.size && !pendingEdits.size) setSaveState(store.persistent ? 'saved' : 'memory');
      announce(rec.id);
    } catch (e) {
      for (const p of Object.keys(changes)) ctx.changed.add(p);
      if (ctx === P) setSaveState('error');
      toast('Could not save: ' + (e && e.name === 'QuotaExceededError' ? 'browser storage is full' : (e.message || e)));
    }
    const i = projects.findIndex((r) => r.id === rec.id);
    if (i >= 0) projects[i] = rec; else projects.push(rec);
    renderProjects();
  }

  function setSaveState(s) {
    const el = $('save-state');
    el.dataset.state = s;
    el.textContent = { saved: 'saved', unsaved: 'editing…', saving: 'saving…', error: 'not saved!', memory: 'not persistent' }[s];
  }

  // Other tabs: keep the fiddle list fresh.
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('simphp-fiddle') : null;
  const tabId = uid();
  function announce(id) { if (channel) channel.postMessage({ from: tabId, id }); }
  if (channel) {
    let t = null;
    channel.onmessage = (ev) => {
      if (!ev.data || ev.data.from === tabId) return;
      clearTimeout(t);
      t = setTimeout(async () => {
        projects = await store.listProjects();
        if (P && !projects.some((r) => r.id === P.rec.id)) projects.push(P.rec);
        else if (P) projects = projects.map((r) => (r.id === P.rec.id ? P.rec : r));
        renderProjects();
        if (P && ev.data.id === P.rec.id) toast('This fiddle was also changed in another tab');
      }, 300);
    };
  }

  // --------------------------------------------------------------------------
  // Editor (CodeMirror documents, one per open file; textarea fallback)
  // --------------------------------------------------------------------------
  const pendingEdits = new Set();
  let flushTimer = null;
  let autorunTimer = null;

  function modeFor(path) {
    if (PHP_EXT.test(path) || /\.inc$/i.test(path)) return 'application/x-httpd-php';
    if (/\.html?$/i.test(path)) return 'htmlmixed';
    if (/\.css$/i.test(path)) return 'css';
    if (/\.js$/i.test(path)) return 'javascript';
    if (/\.xml$/i.test(path)) return 'xml';
    if (/\.ini(-dist|-recommended)?$/i.test(path) || /\/php\.ini$/.test(path)) return 'properties';
    return 'text/plain';
  }

  function fileState(path) {
    const f = P.files[path];
    if (!f) return { text: '', binary: false };
    if (isBinary(f.data)) return { text: '/* binary file: ' + fmtSize(f.data.length) + ' — not editable */', binary: true };
    return { text: decodeText(f.data, 'auto'), binary: false };
  }

  const editor = {
    cm: null, ta: null, docs: new Map(), cur: null, silent: false,
    init() {
      const host = $('editor');
      if (window.CodeMirror) {
        this.cm = CodeMirror(host, {
          value: '', mode: 'application/x-httpd-php', lineNumbers: true, indentUnit: 4, tabSize: 4,
          indentWithTabs: false, matchBrackets: true, lineWrapping: prefs.wrap,
          extraKeys: {
            'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run(),
            'Ctrl-S': () => saveShortcut(), 'Cmd-S': () => saveShortcut(),
            Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end')),
          },
        });
      } else {
        this.ta = document.createElement('textarea');
        this.ta.className = 'fallback';
        this.ta.spellcheck = false;
        host.appendChild(this.ta);
        this.ta.addEventListener('input', () => { if (this.cur) onEdit(this.cur); });
      }
    },
    entry(path) {
      let d = this.docs.get(path);
      if (!d) {
        const s = fileState(path);
        d = { binary: s.binary, text: s.text };
        if (this.cm) {
          d.doc = CodeMirror.Doc(s.text, modeFor(path));
          d.doc.on('change', () => { if (!this.silent) onEdit(path); });
        }
        this.docs.set(path, d);
      }
      return d;
    },
    show(path) {
      if (this.ta && this.cur && this.docs.has(this.cur)) this.docs.get(this.cur).text = this.ta.value;
      this.cur = path;
      if (!path) {
        if (this.cm) { this.cm.swapDoc(CodeMirror.Doc('', 'text/plain')); this.cm.setOption('readOnly', 'nocursor'); } else { this.ta.value = ''; this.ta.disabled = true; }
        $('editor').classList.add('empty');
        return;
      }
      $('editor').classList.remove('empty');
      const d = this.entry(path);
      if (this.cm) {
        this.cm.swapDoc(d.doc);
        this.cm.setOption('readOnly', d.binary);
      } else {
        this.ta.value = d.text;
        this.ta.readOnly = d.binary;
        this.ta.disabled = false;
      }
    },
    value(path) {
      const d = this.docs.get(path);
      if (!d) return null;
      if (d.doc) return d.doc.getValue();
      return path === this.cur ? this.ta.value : d.text;
    },
    isOpen(path) { return this.docs.has(path); },
    isBinary(path) { const d = this.docs.get(path); return !!(d && d.binary); },
    reload(path) {
      const d = this.docs.get(path);
      if (!d) return;
      const s = fileState(path);
      d.binary = s.binary;
      if (d.doc) {
        if (d.doc.getValue() === s.text) return;
        const cursor = d.doc.getCursor();
        this.silent = true;
        d.doc.setValue(s.text);
        d.doc.setCursor(cursor);
        this.silent = false;
        if (path === this.cur) this.cm.setOption('readOnly', s.binary);
      } else {
        d.text = s.text;
        if (path === this.cur) this.ta.value = s.text;
      }
    },
    rename(from, to) {
      const d = this.docs.get(from);
      if (!d) return;
      this.docs.delete(from);
      if (this.cur !== from) return; // recreated from the (saved) file when shown
      this.docs.set(to, d);
      this.cur = to;
      if (this.cm) this.cm.setOption('mode', modeFor(to));
    },
    close(path) { this.docs.delete(path); if (this.cur === path) this.cur = null; },
    reset() { this.docs.clear(); this.cur = null; pendingEdits.clear(); },
    focus() { if (this.cm) this.cm.focus(); else this.ta.focus(); },
    hasFocus() { return this.cm ? this.cm.hasFocus() : document.activeElement === this.ta; },
    setWrap(on) { if (this.cm) this.cm.setOption('lineWrapping', on); },
  };

  function onEdit(path) {
    pendingEdits.add(path);
    setSaveState('unsaved');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { flushEdits(); persist(); }, 400);
    if (prefs.autorun) {
      clearTimeout(autorunTimer);
      autorunTimer = setTimeout(() => { if (P && !P.busy) run(); }, 1200);
    }
  }

  /** Copy edited documents into the fiddle's disk. */
  function flushEdits() {
    clearTimeout(flushTimer);
    if (!P) return;
    for (const path of pendingEdits) {
      if (editor.isBinary(path)) continue;
      const v = editor.value(path);
      if (v === null) continue;
      const bytes = enc.encode(v);
      const f = P.files[path];
      if (f && sameBytes(f.data, bytes)) continue;
      P.files[path] = { data: bytes, mtime: Date.now() };
      P.changed.add(path);
      if (path.startsWith(DOCROOT + '/')) P.touch = true;
    }
    pendingEdits.clear();
  }

  function saveShortcut() {
    flushEdits();
    saveNow().then(() => toast(store.persistent ? 'Saved in this browser' : 'Browser storage is unavailable; this fiddle only lives in this tab'));
  }

  // --------------------------------------------------------------------------
  // Tabs and file lists
  // --------------------------------------------------------------------------
  function showFile(path) {
    if (!P.rec.open.includes(path)) P.rec.open.push(path);
    P.rec.current = path;
    editor.show(path);
    renderTabs();
    renderFiles();
    renderServerFiles();
    persist();
  }

  function closeTab(path, silent) {
    if (!silent) flushEdits();
    const open = P.rec.open;
    const i = open.indexOf(path);
    if (i >= 0) open.splice(i, 1);
    editor.close(path);
    if (P.rec.current === path) {
      const next = open[Math.min(i, open.length - 1)] || null;
      P.rec.current = next;
      editor.show(next);
    }
    renderTabs();
    renderFiles();
    renderServerFiles();
    persist();
  }

  function renderTabs() {
    const bar = $('file-tabs');
    bar.textContent = '';
    for (const p of P.rec.open) {
      const t = document.createElement('div');
      t.className = 'fz-tab' + (p === P.rec.current ? ' active' : '') + (p === DOCROOT + P.rec.entry ? ' entry' : '');
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(p === P.rec.current));
      t.title = p;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = rel(p);
      t.appendChild(name);
      const x = document.createElement('button');
      x.className = 'x';
      x.title = 'Close ' + rel(p);
      x.textContent = '×';
      x.addEventListener('click', (e) => { e.stopPropagation(); closeTab(p); });
      t.appendChild(x);
      t.addEventListener('click', () => { flushEdits(); showFile(p); editor.focus(); });
      t.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(p); });
      bar.appendChild(t);
    }
    if (!P.rec.open.length) {
      const hint = document.createElement('span');
      hint.className = 'fz-tabs-empty';
      hint.textContent = 'Open a file from the list, or press + to create one.';
      bar.appendChild(hint);
    }
    if (bar.querySelector('.active')) bar.querySelector('.active').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function iconBtn(label, title, onClick, cls) {
    const b = document.createElement('button');
    b.className = 'row-btn' + (cls ? ' ' + cls : '');
    b.title = title;
    b.setAttribute('aria-label', title);
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  function renderFiles() {
    const list = $('file-list');
    const editing = list.querySelector('input.inline-edit');
    if (editing) return; // don't disturb a name being typed
    list.textContent = '';
    const paths = Object.keys(P.files).filter((p) => p.startsWith(DOCROOT + '/')).sort((a, b) => {
      // folders before files at each level, like most file explorers
      const pa = a.slice(DOCROOT.length + 1).split('/'), pb = b.slice(DOCROOT.length + 1).split('/');
      for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        if (pa[i] === pb[i]) continue;
        const da = i < pa.length - 1 || (i === pa.length - 1 && a.endsWith('/')), db = i < pb.length - 1 || (i === pb.length - 1 && b.endsWith('/'));
        if (da !== db) return da ? -1 : 1;
        return pa[i].localeCompare(pb[i]);
      }
      return pa.length - pb.length;
    });
    const shownDirs = new Set();
    for (const p of paths) {
      const r = rel(p).replace(/\/$/, '');
      const parts = r.split('/');
      // directory rows
      for (let i = 0; i < parts.length - (p.endsWith('/') ? 0 : 1); i++) {
        const d = parts.slice(0, i + 1).join('/');
        if (shownDirs.has(d)) continue;
        shownDirs.add(d);
        const row = document.createElement('div');
        row.className = 'fz-file dir';
        row.style.setProperty('--depth', i);
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = parts[i] + '/';
        row.appendChild(name);
        row.appendChild(iconBtn('+', 'New file in ' + d + '/', () => startNewFile(d + '/')));
        row.appendChild(iconBtn('×', 'Delete folder ' + d + '/', () => deletePath(DOCROOT + '/' + d + '/'), 'del'));
        list.appendChild(row);
      }
      if (p.endsWith('/') || !P.files[p]) continue;
      list.appendChild(fileRow(p, parts[parts.length - 1], parts.length - 1));
    }
    if (!paths.length) {
      const e = document.createElement('p');
      e.className = 'side-empty';
      e.textContent = 'No files yet.';
      list.appendChild(e);
    }
  }

  function fileRow(p, label, depth) {
    const isEntry = p === DOCROOT + P.rec.entry;
    const row = document.createElement('div');
    row.className = 'fz-file' + (p === P.rec.current ? ' active' : '') + (isEntry ? ' entry' : '');
    row.style.setProperty('--depth', depth);
    row.setAttribute('role', 'treeitem');
    row.title = p + ' — ' + fmtSize(P.files[p].data.length);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = label;
    row.appendChild(name);
    if (p.startsWith(DOCROOT + '/')) {
      if (WEB_PAGE.test(p)) {
        row.appendChild(iconBtn('★', isEntry ? 'Entry page (Run and ⌂ go here)' : 'Make this the entry page', () => setEntry(p), 'star' + (isEntry ? ' on' : '')));
        row.appendChild(iconBtn('▶', 'Open ' + rel(p) + ' in the Result pane', () => { setMode('web'); navigate({ method: 'GET', url: '/' + rel(p) }); }));
      }
    }
    row.appendChild(iconBtn('✎', 'Rename ' + rel(p), () => startRename(p, row)));
    row.appendChild(iconBtn('×', 'Delete ' + rel(p), () => deletePath(p), 'del'));
    row.addEventListener('click', () => { flushEdits(); showFile(p); });
    row.addEventListener('dblclick', () => editor.focus());
    return row;
  }

  function renderServerFiles() {
    const list = $('server-list');
    list.textContent = '';
    const paths = Object.keys(P.files).filter((p) => P.files[p] && !p.startsWith(DOCROOT + '/')).sort();
    $('server-count').textContent = paths.length ? String(paths.length) : '';
    let lastDir = null;
    for (const p of paths) {
      const d = dirname(p);
      if (d !== lastDir) {
        const h = document.createElement('div');
        h.className = 'fz-file dir';
        h.innerHTML = '<span class="name"></span>';
        h.firstChild.textContent = d + '/';
        list.appendChild(h);
        lastDir = d;
      }
      const row = fileRow(p, p.slice(d.length + 1), 1);
      row.classList.add('server');
      row.querySelector('.name').insertAdjacentHTML('afterend', '<span class="meta">' + fmtSize(P.files[p].data.length) + '</span>');
      list.appendChild(row);
    }
    if (!paths.length) {
      const e = document.createElement('p');
      e.className = 'side-empty';
      e.textContent = 'Sessions, uploads, mail and MySQL databases your scripts create show up here.';
      list.appendChild(e);
    }
  }

  function renderCliScripts() {
    const sel = $('cli-script');
    const scripts = Object.keys(P.files).filter((p) => P.files[p] && PHP_EXT.test(p) && !p.startsWith('/tmp/')).sort();
    const want = P.rec.cli.script && P.files[P.rec.cli.script] ? P.rec.cli.script : (P.files[DOCROOT + P.rec.entry] ? DOCROOT + P.rec.entry : scripts[0]);
    sel.textContent = '';
    for (const p of scripts) {
      const o = document.createElement('option');
      o.value = p;
      o.textContent = rel(p);
      sel.appendChild(o);
    }
    if (want) sel.value = want;
  }

  function renderProjects() {
    const list = $('project-list');
    const q = $('project-filter').value.trim().toLowerCase();
    list.textContent = '';
    const sorted = projects.slice().sort((a, b) => b.updated - a.updated);
    $('project-count').textContent = String(sorted.length);
    for (const r of sorted) {
      if (q && !r.name.toLowerCase().includes(q)) continue;
      const row = document.createElement('div');
      row.className = 'fz-project' + (P && r.id === P.rec.id ? ' active' : '');
      row.tabIndex = 0;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = r.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = (r.fileCount || 0) + ' file' + (r.fileCount === 1 ? '' : 's') + ' · ' + ago(r.updated);
      meta.title = 'Last changed ' + new Date(r.updated).toLocaleString();
      const text = document.createElement('div');
      text.className = 'text';
      text.append(name, meta);
      row.appendChild(text);
      row.appendChild(iconBtn('×', 'Delete “' + r.name + '”', () => deleteFiddle(r), 'del'));
      const open = () => { if (!P || r.id !== P.rec.id) { closeSideOnMobile(); openFiddle(r.id); } };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      list.appendChild(row);
    }
  }

  function renderExamples() {
    const list = $('example-list');
    list.textContent = '';
    for (const ex of examples) {
      const row = document.createElement('button');
      row.className = 'fz-project example';
      row.title = 'Create a new fiddle from this example';
      row.innerHTML = '<span class="text"><span class="name"></span><span class="meta"></span></span>';
      row.querySelector('.name').textContent = ex.title;
      row.querySelector('.meta').textContent = ex.files.length + ' file' + (ex.files.length === 1 ? '' : 's') + (ex.mode === 'cli' ? ' · CLI' : '');
      row.addEventListener('click', () => { closeSideOnMobile(); fromExample(ex); });
      list.appendChild(row);
    }
  }

  function renderAll() {
    renderTabs();
    renderFiles();
    renderServerFiles();
    renderCliScripts();
    renderProjects();
    renderCookies();
  }

  // --------------------------------------------------------------------------
  // File operations
  // --------------------------------------------------------------------------
  function inlineInput(host, value, onCommit, before) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit';
    input.spellcheck = false;
    input.value = value;
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      input.remove();
      if (commit && v && v !== value) onCommit(v);
      else { renderFiles(); }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    if (before) host.insertBefore(input, before); else host.prepend(input);
    input.focus();
    const dot = value.lastIndexOf('.');
    input.setSelectionRange(value.lastIndexOf('/') + 1, dot > value.lastIndexOf('/') ? dot : value.length);
    return input;
  }

  function startNewFile(prefix) {
    const list = $('file-list');
    if (list.querySelector('input.inline-edit')) return;
    const empty = list.querySelector('.side-empty');
    if (empty) empty.remove();
    const input = inlineInput(list, (prefix || '') + 'new.php', (name) => createFile(name));
    input.placeholder = 'name.php or folder/name.php';
  }

  function createFile(name) {
    const p = toAbsPath(name);
    if (!p) { toast('Not a usable file name: ' + name); renderFiles(); return; }
    flushEdits();
    if (p.endsWith('/')) {
      P.files[p] = null;
      P.changed.add(p);
    } else if (P.files[p]) {
      toast(rel(p) + ' already exists');
    } else {
      delete P.files[dirname(p) + '/'];
      P.changed.add(dirname(p) + '/');
      P.files[p] = { data: enc.encode(PHP_EXT.test(p) ? '<?php\n\n?>\n' : ''), mtime: Date.now() };
      P.changed.add(p);
      if (!Object.keys(P.files).some((q) => P.files[q] && q !== p && WEB_PAGE.test(q) && q.startsWith(DOCROOT + '/')) && WEB_PAGE.test(p) && p.startsWith(DOCROOT + '/')) setEntry(p, true);
    }
    P.touch = true;
    renderFiles();
    renderCliScripts();
    if (P.files[p]) { showFile(p); editor.focus(); if (editor.cm) editor.cm.setCursor({ line: 1, ch: 0 }); }
    persist();
  }

  function startRename(p, row) {
    const list = row.parentNode;
    const old = rel(p);
    row.hidden = true;
    inlineInput(list, old, (name) => renamePath(p, name), row);
  }

  function renamePath(from, name) {
    const to = toAbsPath(name);
    if (!to || to.endsWith('/')) { toast('Not a usable file name: ' + name); renderFiles(); return; }
    if (P.files[to]) { toast(rel(to) + ' already exists'); renderFiles(); return; }
    flushEdits();
    P.files[to] = P.files[from];
    delete P.files[from];
    P.changed.add(from).add(to);
    editor.rename(from, to);
    P.rec.open = P.rec.open.map((q) => (q === from ? to : q));
    if (P.rec.current === from) P.rec.current = to;
    if (DOCROOT + P.rec.entry === from) P.rec.entry = to.startsWith(DOCROOT + '/') ? to.slice(DOCROOT.length) : P.rec.entry;
    if (P.rec.cli.script === from) P.rec.cli.script = to;
    P.touch = true;
    renderAll();
    persist();
  }

  function deletePath(p) {
    const isDir = p.endsWith('/');
    const victims = Object.keys(P.files).filter((q) => q === p || (isDir && q.startsWith(p)));
    const n = victims.filter((q) => P.files[q]).length;
    if (!confirm(isDir ? 'Delete ' + rel(p) + ' and the ' + n + ' file' + (n === 1 ? '' : 's') + ' in it?' : 'Delete ' + rel(p) + '?')) return;
    flushEdits();
    for (const q of victims) {
      delete P.files[q];
      P.changed.add(q);
      if (editor.isOpen(q)) closeTab(q, true);
    }
    P.touch = true;
    renderAll();
    persist();
  }

  function setEntry(p, quiet) {
    P.rec.entry = p.slice(DOCROOT.length);
    P.url = P.rec.entry;
    $('url').value = P.url;
    renderTabs();
    renderFiles();
    renderCliScripts();
    persist();
    if (!quiet) toast(rel(p) + ' is now the entry page');
  }

  async function uploadFiles(fileList, dir) {
    let n = 0;
    for (const file of fileList) {
      const p = toAbsPath((dir || '') + file.name);
      if (!p) continue;
      P.files[p] = { data: new Uint8Array(await file.arrayBuffer()), mtime: file.lastModified || Date.now() };
      P.changed.add(p);
      if (editor.isOpen(p)) editor.reload(p);
      n++;
    }
    if (!n) return;
    P.touch = true;
    renderAll();
    persist();
    toast('Added ' + n + ' file' + (n === 1 ? '' : 's') + ' to /var/www');
  }

  // --------------------------------------------------------------------------
  // Browser (web mode)
  // --------------------------------------------------------------------------
  function setStatus(html) { $('status-text').innerHTML = html; }

  function setBusy(on) {
    P.busy = on;
    $('btn-run').disabled = on;
    $('btn-run').classList.toggle('running', on);
    if (on) setEngineStatus('busy', 'running…');
    else if ($('engine-status').classList.contains('busy')) setEngineStatus('ready', 'PHP 4.1.1');
  }

  async function navigate(req, opts = {}) {
    const ctx = P;
    if (ctx.busy) return;
    flushEdits();
    setBusy(true);
    setStatus('<span class="hl-dim">requesting ' + escapeHtml(req.method + ' ' + req.url) + ' …</span>');
    try {
      const chain = await ctx.server.request(req, (cur) => {
        if (ctx !== P) return;
        ctx.url = cur.url;
        $('url').value = cur.url;
        $('url-method').textContent = cur.method;
      });
      if (ctx !== P) return;
      const final = chain[chain.length - 1];
      ctx.url = ctx.rec.url = final.req.url;
      $('url').value = final.req.url;
      $('url-method').textContent = final.req.method;
      if (!opts.fromHistory) {
        ctx.history = ctx.history.slice(0, ctx.hIndex + 1);
        ctx.history.push(final.req);
        ctx.hIndex = ctx.history.length - 1;
      }
      updateNavButtons();
      renderCookies();
      showResponse(final.req, final.res, chain);
    } catch (e) {
      if (ctx !== P) return;
      if (e.killed) {
        log('[simulator] PHP process killed after ' + e.seconds + 's (hard limit). The script ignored max_execution_time.', true);
        setStatus('<span class="bad">killed</span> after ' + e.seconds + 's — see Console');
        showPageHtml('<body style="font:14px sans-serif;padding:20px"><h3>Process killed</h3><p>The script ran longer than the hard limit of ' + e.seconds + ' seconds (Settings).</p></body>');
      } else {
        log('[simulator] ' + (e.stack || e), true);
        setStatus('<span class="bad">error</span> ' + escapeHtml(String(e.message || e)));
      }
    } finally {
      ctx.busy = false;
      if (ctx === P) setBusy(false);
      persist(ctx);
    }
  }

  function updateNavButtons() {
    $('nav-back').disabled = P.hIndex <= 0;
    $('nav-fwd').disabled = P.hIndex >= P.history.length - 1;
  }

  function showResponse(req, res, chain) {
    const ctype = SimWeb.contentType(res);
    const charset = (ctype.match(/charset=([\w-]+)/i) || [])[1];
    $('source-view').textContent = isBinary(res.body) ? '(binary response, ' + fmtSize(res.body.length) + ')' : decodeText(res.body, charset);
    SimWeb.renderExchange($('headers-view'), chain, P.rec.ua);
    showPageHtml(SimWeb.pageHtml(req, res, P.rec.settings.charset));
    setStatus(SimWeb.statusHtml(res, chain.length - 1));
  }

  function showPageHtml(html) {
    $('page-empty').hidden = true;
    P.pageUrl = P.url;
    $('page-frame').srcdoc = SimWeb.frameDoc(html);
  }

  window.addEventListener('message', async (ev) => {
    const frame = $('page-frame');
    if (!P || ev.source !== frame.contentWindow) return;
    const ctx = P;
    const base = ctx.url;
    const a = await SimWeb.pageAction(ev.data, base);
    if (!a || ctx !== P) return;
    if (a.external) window.open(a.external, '_blank', 'noopener');
    else if (a.blocked) toast('Form posts to ' + a.blocked + ' — outside the simulated server');
    else if (a.nav) navigate(a.nav);
    else if (a.resources) ctx.server.loadResources(a.resources, base, frame, () => ctx !== P || ctx.url !== base);
  });

  function log(text, isErr, raw) {
    const lv = $('log-view');
    if (!raw) appendHl(lv, '[' + new Date().toLocaleTimeString() + '] ', 'hl-dim');
    appendHl(lv, text.replace(/\s+$/, '') + '\n', isErr ? 'hl-err' : '');
    lv.scrollTop = lv.scrollHeight;
    if (isErr && !document.querySelector('.tab[data-tab="log"]').classList.contains('active')) setLogBadge(logCount + 1);
  }
  let logCount = 0;
  function setLogBadge(n) {
    logCount = n;
    $('log-badge').textContent = n;
    $('log-badge').hidden = !n;
  }

  function renderCookies() {
    const lines = Object.entries(P.rec.cookies).map(([n, c]) =>
      n + '=' + c.value + (c.expires ? '   (expires ' + new Date(c.expires).toUTCString() + ')' : '   (session)'));
    $('cookie-view').textContent = lines.length ? lines.join('\n') : '(no cookies)';
  }

  function requestFromPanel(url) {
    const r = P.rec.req;
    const req = { method: r.method, url };
    if (r.method === 'POST') { req.ctype = r.ctype; req.body = enc.encode(r.body); }
    return req;
  }

  // --------------------------------------------------------------------------
  // CLI mode
  // --------------------------------------------------------------------------
  async function runCli() {
    const ctx = P;
    if (ctx.busy) return;
    flushEdits();
    setBusy(true);
    const out = $('cli-output');
    const script = $('cli-script').value || DOCROOT + ctx.rec.entry;
    out.textContent = '';
    try {
      const t0 = performance.now();
      const r = await ctx.server.cli({ script, flags: shellSplit(ctx.rec.cli.args), extra: shellSplit(ctx.rec.cli.extra), stdin: ctx.rec.cli.stdin });
      if (ctx !== P) return;
      const shown = 'php ' + r.args.map((a) => (/[\s"']/.test(a) ? "'" + a + "'" : a)).join(' ');
      appendHl(out, '$ ' + shown.replace(DOCROOT + '/', '') + '\n', 'exit');
      appendHl(out, decodeText(r.stdout));
      if (r.stderr.length) appendHl(out, decodeText(r.stderr), 'stderr');
      const nl = r.stdout.length && r.stdout[r.stdout.length - 1] !== 10 ? '\n' : '';
      if (r.crash) appendHl(out, nl + 'Segmentation fault\n', 'stderr');
      if (r.aborted) appendHl(out, '\n[simulator] ' + r.aborted + '\n', 'stderr');
      appendHl(out, (r.crash ? '' : nl) + '[exit status ' + r.exitCode + ']\n', 'exit' + (r.exitCode ? ' bad' : ''));
      setStatus('<span class="' + (r.exitCode ? 'bad' : 'ok') + '">exit ' + r.exitCode + '</span> · ' + fmtSize(r.stdout.length) + ' · ' + Math.round(performance.now() - t0) + ' ms');
    } catch (e) {
      if (ctx !== P) return;
      if (e.killed) appendHl(out, '\nKilled (hard limit of ' + e.seconds + 's)\n', 'stderr');
      else appendHl(out, '\n' + (e.stack || e) + '\n', 'stderr');
      setStatus('<span class="bad">error</span>');
    } finally {
      ctx.busy = false;
      if (ctx === P) setBusy(false);
      persist(ctx);
    }
  }

  // --------------------------------------------------------------------------
  // Run / modes
  // --------------------------------------------------------------------------
  function run() {
    if (!P || P.busy) return;
    clearTimeout(autorunTimer);
    flushEdits();
    if (P.rec.mode === 'cli') return runCli();
    const h = P.history[P.hIndex];
    // Re-send the current request (like pressing reload); a POST re-posts.
    if (h && h.url === P.url) return navigate(Object.assign({}, h), { fromHistory: true });
    return navigate(requestFromPanel(P.url));
  }

  function setMode(mode, quiet) {
    P.rec.mode = mode === 'cli' ? 'cli' : 'web';
    const cli = P.rec.mode === 'cli';
    $('mode-web').classList.toggle('active', !cli);
    $('mode-cli').classList.toggle('active', cli);
    $('mode-web').setAttribute('aria-checked', String(!cli));
    $('mode-cli').setAttribute('aria-checked', String(cli));
    $('web-view').hidden = cli;
    $('cli-view').hidden = !cli;
    if (!quiet) persist();
  }

  // --------------------------------------------------------------------------
  // New / fork / examples / share / delete
  // --------------------------------------------------------------------------
  function uniqueName(base) {
    const names = new Set(projects.map((r) => r.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(base + ' (' + i + ')')) return base + ' (' + i + ')';
  }

  function newFiddle() {
    const rec = newRecord(uniqueName('Untitled fiddle'));
    return createFiddle(rec, filesFrom(BLANK));
  }

  async function forkFiddle() {
    flushEdits();
    await saveNow();
    const src = P.rec;
    const rec = JSON.parse(JSON.stringify(Object.assign({}, src, { id: uid(), name: uniqueName(src.name.replace(/ \(fork( \d+)?\)$/, '') + ' (fork)') })));
    rec.created = rec.updated = Date.now();
    const files = {};
    for (const [p, f] of Object.entries(P.files)) files[p] = f ? { data: f.data.slice(), mtime: f.mtime } : null;
    await createFiddle(rec, files);
    toast('Forked — you are now editing the copy');
  }

  async function fromExample(ex) {
    try {
      const texts = await Promise.all(ex.files.map((f) => fetch('examples/' + ex.id + '/' + f).then((r) => { if (!r.ok) throw new Error(f); return r.text(); })));
      const map = {};
      ex.files.forEach((f, i) => { map[f] = texts[i]; });
      const rec = newRecord(uniqueName(ex.title));
      rec.entry = rec.url = '/' + ex.entry;
      rec.open = [DOCROOT + '/' + ex.entry];
      rec.current = rec.open[0];
      if (ex.mode === 'cli') {
        rec.mode = 'cli';
        rec.cli = { args: ex.args || '-q', extra: ex.extra || '', stdin: ex.stdin || '', script: DOCROOT + '/' + ex.entry };
      }
      await createFiddle(rec, filesFrom(map));
    } catch (e) { toast('Could not load the example'); }
  }

  async function share() {
    flushEdits();
    const files = {};
    for (const [p, f] of Object.entries(P.files)) {
      if (!f || !(p.startsWith(DOCROOT + '/') || p === '/etc/php.ini')) continue;
      if (isBinary(f.data)) continue;
      files[p] = SimWeb.decodeText(f.data, 'utf-8');
    }
    // Same payload as the classic UI's share links (plus name/entry), so links work in both.
    const payload = JSON.stringify({
      v: 1, files, url: P.rec.entry, mode: P.rec.mode, current: P.rec.current, name: P.rec.name, entry: P.rec.entry,
      settings: P.rec.settings, cli: { args: P.rec.cli.args, extra: P.rec.cli.extra, stdin: P.rec.cli.stdin },
    });
    try {
      const link = location.href.split('#')[0] + '#w=' + await compress(payload);
      try { await navigator.clipboard.writeText(link); toast('Link copied — it contains every text file of this fiddle'); }
      catch (e) { prompt('Copy this link:', link); }
    } catch (e) { toast('Sharing needs a browser with CompressionStream'); }
  }

  async function fromShareLink(code) {
    try {
      const d = JSON.parse(await decompress(code));
      const rec = newRecord(uniqueName(d.name || 'Shared fiddle'));
      const entry = d.entry || (d.url && d.url.split('?')[0]) || '/index.php';
      rec.entry = rec.url = entry;
      rec.mode = d.mode === 'cli' ? 'cli' : 'web';
      if (d.current && d.files[d.current]) { rec.current = d.current; rec.open = [d.current]; }
      if (d.cli) Object.assign(rec.cli, { args: d.cli.args || '-q', extra: d.cli.extra || '', stdin: d.cli.stdin || '' });
      if (d.settings) Object.assign(rec.settings, d.settings);
      if (d.files['/etc/php.ini'] && rec.settings.ini === 'none') rec.settings.ini = 'dist';
      await createFiddle(rec, filesFrom(d.files));
      toast('Opened the shared fiddle as a new fiddle');
      return true;
    } catch (e) {
      toast('Could not read the shared link');
      return false;
    }
  }

  async function deleteFiddle(r) {
    if (!confirm('Delete “' + r.name + '” and all its files? This cannot be undone.')) return;
    const wasOpen = P && P.rec.id === r.id;
    if (wasOpen) { clearTimeout(saveTimer); P.changed.clear(); pendingEdits.clear(); }
    await store.deleteProject(r.id).catch(() => {});
    projects = projects.filter((x) => x.id !== r.id);
    announce(r.id);
    if (wasOpen) {
      P = null;
      const next = projects.slice().sort((a, b) => b.updated - a.updated)[0];
      if (next) await openFiddle(next.id);
      else await newFiddle();
    } else renderProjects();
    toast('Deleted “' + r.name + '”');
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
    try { local = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = 'unset — the machine\'s zone' + (local ? ' (' + local + ')' : '');
    sel.appendChild(o0);
    for (const tz of TZ_CHOICES) {
      const o = document.createElement('option');
      o.value = tz; o.textContent = 'TZ=' + tz;
      sel.appendChild(o);
    }
    const s = () => P.rec.settings;
    sel.addEventListener('change', () => { s().tz = sel.value; persist(); });
    $('set-ini').addEventListener('change', async (e) => {
      const v = e.target.value;
      s().ini = v;
      if (v === 'none') {
        if (editor.isOpen('/etc/php.ini')) closeTab('/etc/php.ini', true);
        delete P.files['/etc/php.ini'];
      } else {
        try {
          const txt = await (await fetch('ini/php.ini-' + v)).text();
          P.files['/etc/php.ini'] = { data: enc.encode(txt), mtime: Date.now() };
          if (editor.isOpen('/etc/php.ini')) editor.reload('/etc/php.ini');
          toast('Created /etc/php.ini from php.ini-' + v);
        } catch (err) { toast('Could not load php.ini-' + v); }
      }
      P.changed.add('/etc/php.ini');
      renderServerFiles();
      persist();
    });
    $('set-kill').addEventListener('change', (e) => { s().kill = Math.min(600, Math.max(5, +e.target.value || 60)); persist(); });
    $('set-charset').addEventListener('change', (e) => { s().charset = e.target.value; persist(); });
    $('set-mysql').addEventListener('change', (e) => { s().mysql = e.target.checked; persist(); });
    $('set-follow').addEventListener('change', (e) => { s().follow = e.target.checked; persist(); });
    $('set-wrap').checked = prefs.wrap;
    $('set-wrap').addEventListener('change', (e) => { prefs.wrap = e.target.checked; editor.setWrap(prefs.wrap); savePrefs(); });
    $('set-autorun').checked = prefs.autorun;
    $('set-autorun').addEventListener('change', (e) => { prefs.autorun = e.target.checked; savePrefs(); });
    $('req-ua').addEventListener('change', (e) => { P.rec.ua = e.target.value || DEFAULT_UA; persist(); });
    $('req-method').addEventListener('change', (e) => { P.rec.req.method = e.target.value; $('url-method').textContent = e.target.value; persist(); });
    $('req-ctype').addEventListener('change', (e) => { P.rec.req.ctype = e.target.value; persist(); });
    $('req-body').addEventListener('input', (e) => { P.rec.req.body = e.target.value; persist(); });
    $('cli-args').addEventListener('input', (e) => { P.rec.cli.args = e.target.value; persist(); });
    $('cli-extra').addEventListener('input', (e) => { P.rec.cli.extra = e.target.value; persist(); });
    $('cli-stdin').addEventListener('input', (e) => { P.rec.cli.stdin = e.target.value; persist(); });
    $('cli-script').addEventListener('change', (e) => { P.rec.cli.script = e.target.value; persist(); });
    $('btn-delete-project').addEventListener('click', () => { toggleSettings(false); deleteFiddle(P.rec); });
  }

  /** Show the open fiddle's settings in the controls. */
  function syncControls() {
    const s = P.rec.settings;
    const tz = $('set-tz');
    if (s.tz && ![...tz.options].some((o) => o.value === s.tz)) {
      const o = document.createElement('option'); o.value = o.textContent = s.tz; tz.appendChild(o);
    }
    tz.value = s.tz || '';
    $('set-ini').value = P.files['/etc/php.ini'] ? (s.ini === 'none' ? 'dist' : s.ini) : 'none';
    $('set-kill').value = s.kill;
    $('set-charset').value = s.charset;
    $('set-mysql').checked = s.mysql !== false;
    $('set-follow').checked = s.follow !== false;
    $('req-ua').value = P.rec.ua || DEFAULT_UA;
    $('req-method').value = P.rec.req.method;
    $('req-ctype').value = P.rec.req.ctype;
    $('req-body').value = P.rec.req.body;
    $('cli-args').value = P.rec.cli.args;
    $('cli-extra').value = P.rec.cli.extra;
    $('cli-stdin').value = P.rec.cli.stdin;
  }

  function toggleSettings(show) {
    $('settings').hidden = !show;
    $('btn-settings').setAttribute('aria-expanded', String(show));
    if (show && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((e) => {
        $('storage-info').textContent = store.persistent
          ? 'This site uses ' + fmtSize(e.usage || 0) + ' of about ' + fmtSize(e.quota || 0) + ' available.'
          : 'Browser storage is unavailable here, so fiddles will not survive a reload.';
      }).catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // Layout: sidebar and the editor/output splitter
  // --------------------------------------------------------------------------
  const narrow = () => window.matchMedia('(max-width: 860px)').matches;
  function applySide() {
    const show = narrow() ? document.body.classList.contains('side-open') : prefs.side;
    document.body.classList.toggle('side-hidden', !narrow() && !prefs.side);
    $('btn-side').setAttribute('aria-expanded', String(show));
  }
  function toggleSide() {
    if (narrow()) document.body.classList.toggle('side-open');
    else { prefs.side = !prefs.side; savePrefs(); }
    applySide();
    if (editor.cm) setTimeout(() => editor.cm.refresh(), 0);
  }
  function closeSideOnMobile() { if (narrow()) { document.body.classList.remove('side-open'); applySide(); } }

  function applySplit() {
    $('work').style.setProperty('--split', prefs.split + '%');
    if (editor.cm) editor.cm.refresh();
  }
  function initSplitter() {
    const g = $('gutter');
    const work = $('work');
    g.addEventListener('pointerdown', (e) => {
      if (narrow()) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');
      const move = (ev) => {
        const r = work.getBoundingClientRect();
        prefs.split = Math.round(Math.min(80, Math.max(20, (ev.clientX - r.left) / r.width * 100)) * 10) / 10;
        work.style.setProperty('--split', prefs.split + '%');
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        document.body.classList.remove('dragging');
        savePrefs();
        applySplit();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    g.addEventListener('dblclick', () => { prefs.split = 50; savePrefs(); applySplit(); });
    g.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      prefs.split = Math.min(80, Math.max(20, prefs.split + (e.key === 'ArrowLeft' ? -2 : 2)));
      savePrefs();
      applySplit();
    });
    applySplit();
  }

  // --------------------------------------------------------------------------
  // Wire-up
  // --------------------------------------------------------------------------
  function bind() {
    $('btn-run').addEventListener('click', run);
    $('btn-new').addEventListener('click', () => { closeSideOnMobile(); newFiddle(); });
    $('btn-fork').addEventListener('click', forkFiddle);
    $('btn-share').addEventListener('click', share);
    $('btn-side').addEventListener('click', toggleSide);
    $('mode-web').addEventListener('click', () => setMode('web'));
    $('mode-cli').addEventListener('click', () => setMode('cli'));
    $('project-name').addEventListener('input', (e) => {
      P.rec.name = e.target.value.trim() || 'Untitled fiddle';
      document.title = P.rec.name + ' — PHP 4.1.1 Fiddle';
      persist(P, true);
    });
    $('project-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editor.focus(); } });
    $('project-name').addEventListener('blur', (e) => { e.target.value = P.rec.name; });
    $('project-filter').addEventListener('input', renderProjects);

    $('btn-new-file').addEventListener('click', () => startNewFile(''));
    $('work').addEventListener('pointerdown', closeSideOnMobile);
    $('upload').addEventListener('change', (e) => { uploadFiles([...e.target.files]); e.target.value = ''; });
    const side = $('side');
    side.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); side.classList.add('drop'); } });
    side.addEventListener('dragleave', (e) => { if (!side.contains(e.relatedTarget)) side.classList.remove('drop'); });
    side.addEventListener('drop', (e) => { e.preventDefault(); side.classList.remove('drop'); uploadFiles([...e.dataTransfer.files]); });
    $('btn-reset-state').addEventListener('click', () => {
      if (!confirm('Delete /tmp (sessions, uploads), mail, all MySQL databases and the cookie jar of this fiddle?')) return;
      for (const p of Object.keys(P.files)) {
        if (/^\/(tmp|var\/mail|var\/lib\/mysql)\//.test(p)) { delete P.files[p]; P.changed.add(p); if (editor.isOpen(p)) closeTab(p, true); }
      }
      P.rec.cookies = {};
      renderAll();
      persist();
      toast('Server state reset');
    });

    $('url-form').addEventListener('submit', (e) => {
      e.preventDefault();
      let v = $('url').value.trim().replace(/^https?:\/\/localhost(:\d+)?/i, '');
      if (!v.startsWith('/')) v = '/' + v;
      navigate(requestFromPanel(v));
    });
    $('nav-back').addEventListener('click', () => {
      if (P.hIndex > 0) { P.hIndex--; navigate(Object.assign({}, P.history[P.hIndex]), { fromHistory: true }); }
    });
    $('nav-fwd').addEventListener('click', () => {
      if (P.hIndex < P.history.length - 1) { P.hIndex++; navigate(Object.assign({}, P.history[P.hIndex]), { fromHistory: true }); }
    });
    $('nav-reload').addEventListener('click', run);
    $('nav-home').addEventListener('click', () => navigate({ method: 'GET', url: P.rec.entry }));
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === t.dataset.tab));
      if (t.dataset.tab === 'log') setLogBadge(0);
    }));
    $('btn-clear-log').addEventListener('click', () => { $('log-view').textContent = ''; });
    $('btn-clear-cookies').addEventListener('click', () => { P.rec.cookies = {}; renderCookies(); persist(); });
    $('cli-args').addEventListener('keydown', (e) => { if (e.key === 'Enter') runCli(); });
    $('cli-extra').addEventListener('keydown', (e) => { if (e.key === 'Enter') runCli(); });

    $('btn-settings').addEventListener('click', () => toggleSettings(true));
    $('btn-close-settings').addEventListener('click', () => toggleSettings(false));
    $('settings').addEventListener('click', (e) => { if (e.target === $('settings')) toggleSettings(false); });
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape' && !$('settings').hidden) toggleSettings(false);
      if (mod && e.key === 'Enter' && !editor.hasFocus()) { e.preventDefault(); run(); }
      if (mod && (e.key === 's' || e.key === 'S') && !editor.hasFocus()) { e.preventDefault(); saveShortcut(); }
    });
    // IndexedDB writes are asynchronous; start them as the page goes away.
    const flushAll = () => { if (P) saveNow(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
    window.addEventListener('pagehide', flushAll);
    window.addEventListener('hashchange', async () => {
      const w = location.hash.match(/^#w=([\w-]+)/);
      if (w) { await fromShareLink(w[1]); return; }
      const f = location.hash.match(/^#f=([\w-]+)/);
      if (f && (!P || P.rec.id !== f[1])) openFiddle(f[1]);
    });
    window.matchMedia('(max-width: 860px)').addEventListener('change', () => { document.body.classList.remove('side-open'); applySide(); applySplit(); });
  }

  async function loadExamples() {
    try {
      examples = await (await fetch('examples/index.json')).json();
      renderExamples();
    } catch (e) { /* examples are optional */ }
  }

  async function main() {
    loadPrefs();
    applySide();
    editor.init();
    initSplitter();
    initSettings();
    bind();
    engine.spawn().catch((e) => { log('[simulator] failed to start the engine: ' + e.message, true); });
    loadExamples();

    if (!(await store.open())) toast('Browser storage is unavailable: fiddles will only last until you close this tab');
    projects = await store.listProjects().catch(() => []);

    const shared = location.hash.match(/^#w=([\w-]+)/);
    if (shared && await fromShareLink(shared[1])) return;
    const wanted = (location.hash.match(/^#f=([\w-]+)/) || [])[1] || await store.getMeta('last').catch(() => null);
    if (wanted && projects.some((r) => r.id === wanted) && await openFiddle(wanted)) return;
    const recent = projects.slice().sort((a, b) => b.updated - a.updated)[0];
    if (recent) { await openFiddle(recent.id); return; }
    await createFiddle(newRecord('Hello, PHP 4'), filesFrom(STARTER));
  }

  main();
})();
