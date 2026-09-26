/*
 * simweb: the parts of the simulator that live in the page rather than the
 * worker -- the simulated Apache/1.3 + CGI web server, its cookie-keeping
 * "browser", and the shim that routes links/forms of a rendered page back in.
 *
 * Shared by the classic UI (app.js) and the fiddle UI (fiddle.js).
 *
 *   const engine = new SimWeb.Engine({ onStatus, killSeconds: () => 60 });
 *   const server = new SimWeb.Server({ engine, files, absorb, settings, cookies, log });
 *   const chain = await server.request({ method: 'GET', url: '/index.php' });
 */
/* global SimPHP */
(function (root) {
  'use strict';

  const DOCROOT = '/var/www';
  const SERVER_SOFTWARE = 'Apache/1.3.22 (Unix)';
  const DEFAULT_UA = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)';
  const PHP_EXT = /\.(php|php3|php4|phtml)$/i;
  const enc = new TextEncoder();

  const MIME = {
    html: 'text/html', htm: 'text/html', txt: 'text/plain', css: 'text/css', js: 'application/x-javascript',
    xml: 'text/xml', gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    ico: 'image/x-icon', svg: 'image/svg+xml', json: 'text/plain', inc: 'text/plain', phps: 'text/plain',
  };

  // --------------------------------------------------------------------------
  // Byte helpers
  // --------------------------------------------------------------------------
  const toBytes = (s) => (typeof s === 'string' ? enc.encode(s) : s);
  function isUtf8(bytes) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true; } catch (e) { return false; }
  }
  function decodeText(bytes, charset) {
    let cs = (charset || 'auto').toLowerCase();
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
  const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  function shellSplit(s) {
    const out = [];
    const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2] !== undefined ? m[2] : m[3]);
    return out;
  }

  // Share links: deflate-raw + base64url.
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

  // --------------------------------------------------------------------------
  // Engine: the worker that runs PHP processes
  // --------------------------------------------------------------------------
  class Engine {
    // onStatus(kind, text, build): kind is loading | ready | error
    constructor({ onStatus, killSeconds, workerUrl } = {}) {
      this.onStatus = onStatus || (() => {});
      this.killSeconds = killSeconds || (() => 60);
      this.workerUrl = workerUrl || 'worker.js';
      this.worker = null;
      this.ready = null;
      this.build = null;
      this.seq = 0;
      this.pending = new Map();
      this.queue = Promise.resolve();
    }
    spawn() {
      if (this.worker) this.worker.terminate();
      for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error('engine restarted')); }
      this.pending.clear();
      this.worker = new Worker(this.workerUrl);
      this.onStatus('loading', 'loading engine…');
      this.ready = new Promise((resolve, reject) => {
        this.worker.onmessage = (ev) => {
          const m = ev.data;
          if (m.type === 'ready') { this.build = m.build; this.onStatus('ready', 'PHP 4.1.1 ready', m.build); resolve(); }
          else if (m.type === 'fatal') { this.onStatus('error', 'engine failed'); reject(new Error(m.error)); }
          else if (m.type === 'result') {
            const p = this.pending.get(m.id);
            if (!p) return;
            this.pending.delete(m.id);
            clearTimeout(p.timer);
            if (m.error) p.reject(new Error(m.error)); else p.resolve(m.result);
          }
        };
        this.worker.onerror = (e) => { this.onStatus('error', 'engine error'); reject(new Error(e.message || 'worker error')); };
      });
      this.ready.catch(() => {});
      this.worker.postMessage({ type: 'init' });
      return this.ready;
    }
    /** Run one PHP process. Processes run one at a time, in call order. */
    run(request) {
      const p = this.queue.then(() => this._run(request));
      this.queue = p.catch(() => {});
      return p;
    }
    async _run(request) {
      await this.ready;
      // the disk is read when the process starts, after earlier ones wrote to it
      if (typeof request.files === 'function') request = Object.assign({}, request, { files: request.files() });
      const id = ++this.seq;
      const killMs = Math.max(5, +this.killSeconds() || 60) * 1000;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(Object.assign(new Error('killed'), { killed: true, seconds: killMs / 1000 }));
          this.spawn();
        }, killMs);
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ type: 'run', id, request });
      });
    }
  }

  // --------------------------------------------------------------------------
  // Cookies
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

  // --------------------------------------------------------------------------
  // The simulated web server (and the browser's cookie jar)
  // --------------------------------------------------------------------------
  class Server {
    /**
     * engine    an Engine
     * files()   the current disk: { '/abs/path': {data, mtime}, '/dir/': null }
     *           (called for routing, and again when a PHP process starts)
     * absorb(f) receives the disk back after a PHP process ran
     * settings() { tz, mysql, follow, ua }
     * cookies() the jar: name -> { value, expires (ms|null) }  (mutated in place)
     * log(text, isErr)  Apache error_log lines
     */
    constructor(opts) {
      this.engine = opts.engine;
      this.files = opts.files;
      this.absorb = opts.absorb || (() => {});
      this.settings = opts.settings || (() => ({}));
      this.cookies = opts.cookies || (() => ({}));
      this.log = opts.log || (() => {});
    }

    absorbCookies(headers) {
      const jar = this.cookies();
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
        if (expires !== null && expires <= Date.now()) delete jar[n];
        else jar[n] = { value, expires };
      }
    }
    cookieHeader() {
      const jar = this.cookies();
      const now = Date.now();
      const out = [];
      for (const [n, c] of Object.entries(jar)) {
        if (c.expires !== null && c.expires <= now) { delete jar[n]; continue; }
        out.push(n + '=' + c.value);
      }
      return out.join('; ');
    }

    buildEnv(req, u, scriptPath, extra) {
      const s = this.settings();
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
        SCRIPT_NAME: scriptPath.slice(DOCROOT.length),
        SCRIPT_FILENAME: scriptPath,
        PATH_TRANSLATED: scriptPath,
        DOCUMENT_ROOT: DOCROOT,
        REMOTE_ADDR: '127.0.0.1',
        REMOTE_PORT: String(32768 + Math.floor(Math.random() * 28000)),
        REDIRECT_STATUS: '200',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        HTTP_HOST: 'localhost',
        HTTP_USER_AGENT: s.ua || DEFAULT_UA,
        HTTP_ACCEPT: 'image/gif, image/x-xbitmap, image/jpeg, image/pjpeg, */*',
        HTTP_ACCEPT_LANGUAGE: 'en-us',
        HTTP_ACCEPT_ENCODING: 'gzip, deflate',
        HTTP_CONNECTION: 'Keep-Alive',
      };
      if (extra) env.PATH_INFO = extra;
      const cookie = this.cookieHeader();
      if (cookie) env.HTTP_COOKIE = cookie;
      if (req.referer) env.HTTP_REFERER = 'http://localhost' + req.referer;
      if (req.method === 'POST') {
        env.CONTENT_TYPE = req.ctype || 'application/x-www-form-urlencoded';
        env.CONTENT_LENGTH = String(req.body ? req.body.length : 0);
      }
      if (s.tz) env.TZ = s.tz;
      return env;
    }

    // Apache 1.3 error_log line: [Wed Dec 26 10:43:10 2001] [error] [client 127.0.0.1] ...
    apacheLog(level, msg, isErr) {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = d.toDateString().replace(/ (\d{4})$/, '') + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + d.getFullYear();
      this.log('[' + stamp + '] [' + level + ']' + (level === 'error' ? ' [client 127.0.0.1]' : '') + ' ' + msg, isErr);
    }

    /** One HTTP request -> response. */
    async serve(req) {
      const files = this.files();
      const u = resolveUrl(req.url);
      let path;
      try { path = decodeURIComponent(u.pathname); } catch (e) { path = u.pathname; }
      if (path.includes('\0') || path.split('/').includes('..')) return apacheError(400, 'Bad Request', '<P>Your browser sent a request that this server could not understand.\n');
      let fsPath = DOCROOT + path;
      let pathInfo = '';
      const isDir = (p) => Object.keys(files).some((k) => k.startsWith(p.replace(/\/$/, '') + '/'));
      if (!files[fsPath] && !fsPath.endsWith('/') && isDir(fsPath)) {
        return { status: 301, reason: 'Moved Permanently', headers: [['Location', 'http://localhost' + path + '/' + u.search]], body: enc.encode(''), php: false };
      }
      if (fsPath.endsWith('/')) {
        const idx = ['index.php', 'index.html', 'index.htm', 'index.php3', 'index.phtml'].map((n) => fsPath + n).find((p) => files[p]);
        if (!idx) return apacheError(403, 'Forbidden', '<P>You don\'t have permission to access ' + escapeHtml(path) + '\non this server.\n');
        fsPath = idx;
      }
      if (!files[fsPath]) {
        // Apache-style PATH_INFO: /script.php/extra/stuff
        const m = fsPath.match(/^(.*?\.(?:php\d?|phtml))(\/.*)$/i);
        if (m && files[m[1]]) { fsPath = m[1]; pathInfo = m[2]; }
        else return apacheError(404, 'Not Found', '<P>The requested URL ' + escapeHtml(path) + ' was not found on this server.\n');
      }
      if (!PHP_EXT.test(fsPath)) {
        const ext = (fsPath.match(/\.([^./]+)$/) || [])[1] || '';
        const type = MIME[ext.toLowerCase()] || 'text/plain';
        return { status: 200, reason: 'OK', headers: [['Last-Modified', new Date(files[fsPath].mtime).toUTCString()], ['Content-Type', type]], body: files[fsPath].data, php: false };
      }
      const env = this.buildEnv(req, u, fsPath, pathInfo);
      const t0 = performance.now();
      const r = await this.engine.run({
        args: [], env, stdin: req.body || '', files: this.files, cwd: dirname(fsPath), mysqld: this.settings().mysql !== false,
      });
      let res = SimPHP.parseCGI(r.stdout);
      const headersDone = hasHeaderEnd(r.stdout);
      if (r.crash) {
        // Apache 1.3 + CGI: a dead child with no complete headers is a 500;
        // otherwise the partial page already went out to the browser.
        this.apacheLog('notice', 'child pid ' + (1000 + Math.floor(Math.random() * 30000)) + ' exit signal Segmentation fault (11)', false);
        if (!headersDone) {
          this.apacheLog('error', 'Premature end of script headers: ' + fsPath, true);
          res = apache500();
        }
      } else if (!headersDone && r.stdout.length === 0) {
        this.apacheLog('error', 'Premature end of script headers: ' + fsPath, true);
        res = apache500();
      }
      res.php = true;
      res.stderr = r.stderr;
      res.exitCode = r.exitCode;
      res.aborted = r.aborted;
      res.elapsed = performance.now() - t0;
      res.phpElapsed = r.elapsedMs;
      res.env = env;
      this.absorb(r.files);
      if (res.stderr && res.stderr.length) this.log(decodeText(res.stderr), true);
      if (res.aborted) this.log('[simulator] ' + res.aborted, true);
      return res;
    }

    /**
     * A browser request: keeps cookies and follows redirects (when
     * settings().follow). onHop(req) is called before each hop.
     * Returns the chain [{req, res}, ...]; the last entry is the final page.
     */
    async request(req, onHop) {
      const chain = [];
      let cur = Object.assign({}, req);
      for (let hop = 0; hop < 10; hop++) {
        if (onHop) onHop(cur);
        const res = await this.serve(cur);
        if (res.php) this.absorbCookies(res.headers);
        chain.push({ req: cur, res });
        const loc = res.headers.find(([k]) => /^location$/i.test(k));
        if (loc && res.status >= 300 && res.status < 400 && this.settings().follow !== false) {
          const next = resolveUrl(loc[1], cur.url);
          if (next.host !== 'localhost') break;
          cur = { method: 'GET', url: next.pathname + next.search, referer: cur.referer };
          continue;
        }
        break;
      }
      return chain;
    }

    /** Run a script from a shell: php [flags] script [args] */
    async cli({ script, flags, extra, stdin }) {
      const standalone = flags.some((f) => /^-[vimh?]$/.test(f));
      const args = standalone ? flags : [...flags, script, ...extra];
      const env = {
        PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/root', USER: 'root', LOGNAME: 'root',
        SHELL: '/bin/bash', TERM: 'xterm', PWD: dirname(script), LANG: 'C',
      };
      const s = this.settings();
      if (s.tz) env.TZ = s.tz;
      const r = await this.engine.run({
        args, env, stdin: stdin || '', files: this.files, cwd: dirname(script), mysqld: s.mysql !== false,
      });
      this.absorb(r.files);
      r.args = args;
      return r;
    }

    /**
     * Sub-resources (images, stylesheets) of a rendered page, fetched one at a
     * time like a browser with a single connection. PHP-generated images
     * (phpinfo()'s logo) run through the engine too. stale() stops the loop
     * once the page has been replaced.
     */
    async loadResources(urls, base, frame, stale) {
      for (const url of urls.slice(0, 24)) {
        if (stale()) return;
        const u = resolveUrl(url, base);
        if (u.host !== 'localhost') continue;
        try {
          const res = await this.serve({ method: 'GET', url: u.pathname + u.search, referer: base });
          if (res.status !== 200 || stale()) continue;
          const ctype = contentType(res).split(';')[0];
          const dataUrl = 'data:' + ctype + ';base64,' + b64(res.body);
          if (frame.contentWindow) frame.contentWindow.postMessage({ __simphpParent: 1, type: 'resource', url, dataUrl }, '*');
        } catch (e) { /* a missing image is not fatal */ }
      }
    }
  }

  function resolveUrl(href, base) {
    return new URL(href, 'http://localhost' + (base || '/'));
  }

  function apacheError(status, reason, body) {
    const html = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<HTML><HEAD>\n<TITLE>' + status + ' ' + reason +
      '</TITLE>\n</HEAD><BODY>\n<H1>' + reason + '</H1>\n' + body + '<P>\n<HR>\n<ADDRESS>' + SERVER_SOFTWARE +
      ' Server at localhost Port 80</ADDRESS>\n</BODY></HTML>\n';
    return { status, reason, headers: [['Content-Type', 'text/html; charset=iso-8859-1']], body: enc.encode(html), php: false };
  }

  function apache500() {
    return apacheError(500, 'Internal Server Error',
      'The server encountered an internal error or\nmisconfiguration and was unable to complete\nyour request.<P>\n' +
      'Please contact the server administrator,\n webmaster@localhost and inform them of the time the error occurred,\n' +
      'and anything you might have done that may have\ncaused the error.<P>\n' +
      'More information about this error may be available\nin the server error log.\n');
  }

  function hasHeaderEnd(b) {
    for (let i = 0; i < b.length - 1; i++) {
      if (b[i] === 10 && b[i + 1] === 10) return true;
      if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return true;
    }
    return false;
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
  // Rendering
  // --------------------------------------------------------------------------
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

  /** The raw HTTP exchange of a request chain (including redirects) into el. */
  function renderExchange(el, chain, ua) {
    el.textContent = '';
    chain.forEach(({ req: q, res: r }, i) => {
      const reqLines = [q.method + ' ' + q.url + ' HTTP/1.1', 'Host: localhost', 'User-Agent: ' + (ua || DEFAULT_UA)];
      if (r.env && r.env.HTTP_COOKIE) reqLines.push('Cookie: ' + r.env.HTTP_COOKIE);
      if (q.referer) reqLines.push('Referer: http://localhost' + q.referer);
      if (q.method === 'POST') reqLines.push('Content-Type: ' + (q.ctype || 'application/x-www-form-urlencoded'), 'Content-Length: ' + (q.body ? q.body.length : 0));
      appendHl(el, '> ', 'hl-dim'); appendHl(el, reqLines[0] + '\n', 'hl-status');
      reqLines.slice(1).forEach((l) => { appendHl(el, '> ', 'hl-dim'); appendHeaderLine(el, l); });
      appendHl(el, '\n');
      const head = responseHead(r);
      appendHl(el, '< ', 'hl-dim'); appendHl(el, head[0] + '\n', 'hl-status');
      head.slice(1).forEach((l) => { appendHl(el, '< ', 'hl-dim'); appendHeaderLine(el, l); });
      if (i < chain.length - 1) appendHl(el, '\n— following redirect —\n\n', 'hl-dim');
    });
  }

  /** What the browser shows for a response, as an HTML document. */
  function pageHtml(req, res, charsetSetting) {
    const ctype = contentType(res);
    const charset = (ctype.match(/charset=([\w-]+)/i) || [])[1] || charsetSetting;
    const body = res.body;
    if (/^image\//i.test(ctype)) {
      return '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#e8e8e8"><img src="data:' + ctype + ';base64,' + b64(body) + '"></body>';
    }
    if (/^text\/html/i.test(ctype) || (!res.php && /\.html?$/i.test(req.url))) return decodeText(body, charset);
    if (/^(text\/|application\/(x-)?javascript|application\/xml)/i.test(ctype)) {
      return '<pre style="word-wrap:break-word;white-space:pre-wrap;margin:8px;font:13px monospace">' + escapeHtml(decodeText(body, charset)) + '</pre>';
    }
    return '<body style="font:14px sans-serif;padding:20px"><p>The server sent <b>' + escapeHtml(ctype) + '</b> (' + fmtSize(body.length) + '). A browser would offer to download it.</p></body>';
  }

  /** Status-bar summary of a response. */
  function statusHtml(res, hops) {
    const ctype = contentType(res);
    const cls = res.status < 300 ? 'ok' : res.status < 400 ? 'redir' : 'bad';
    const parts = ['<span class="' + cls + '">' + res.status + ' ' + escapeHtml(res.reason) + '</span>', escapeHtml(ctype.split(';')[0]), fmtSize(res.body.length)];
    parts.push(res.php ? Math.round(res.phpElapsed) + ' ms' : 'static');
    if (hops) parts.push(hops + ' redirect' + (hops > 1 ? 's' : ''));
    return parts.join(' · ');
  }

  // Script injected into rendered pages so that links, forms and relative
  // resources go back through the simulated server.
  const SHIM = '<script>(' + function () {
    var P = window.parent;
    function send(m) { m.__simphp = 1; P.postMessage(m, '*'); }
    function nav(href) { send({ type: 'nav', href: href }); }
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
      if (!m || m.__simphpParent !== 1 || m.type !== 'resource') return;
      (pending[m.url] || []).forEach(function (p) {
        if (p[1] === 'background') p[0].style.backgroundImage = 'url("' + m.dataUrl + '")';
        else p[0].setAttribute(p[1], m.dataUrl);
      });
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wantResources);
    else wantResources();
  } + ')();</' + 'script>';

  // The rendered page must not fetch relative URLs from the real host (they
  // belong to the simulated server); point its base URL at a host that can
  // never resolve, and let the shim fetch them through the simulator instead.
  const BASE = '<base href="http://simphp.invalid/">';

  /** srcdoc for the sandboxed page frame. */
  function frameDoc(html) {
    const m = html.match(/^\s*<!doctype[^>]*>/i);
    return m ? m[0] + BASE + SHIM + html.slice(m[0].length) : BASE + SHIM + html;
  }

  function formEncode(entries) {
    // application/x-www-form-urlencoded as browsers of the era sent it (spaces as +)
    return entries.map(([k, v]) => {
      const val = v instanceof File ? v.name : String(v);
      return encodeURIComponent(k).replace(/%20/g, '+') + '=' + encodeURIComponent(val).replace(/%20/g, '+');
    }).join('&');
  }

  /**
   * Turn a message from the page shim into what the browser should do:
   *   { nav: req } | { external: href } | { resources: urls } | { title } | null
   */
  async function pageAction(m, base) {
    if (!m || m.__simphp !== 1) return null;
    if (m.type === 'nav') {
      const u = resolveUrl(m.href, base);
      if (u.host !== 'localhost') return { external: u.href };
      return { nav: { method: 'GET', url: u.pathname + u.search, referer: base } };
    }
    if (m.type === 'submit') {
      const u = resolveUrl(m.action || base, base);
      if (u.host !== 'localhost') return { blocked: u.host };
      if (m.method !== 'post') {
        u.search = '?' + formEncode(m.entries);
        return { nav: { method: 'GET', url: u.pathname + u.search, referer: base } };
      }
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
      return { nav: req };
    }
    if (m.type === 'resources') return { resources: m.urls };
    if (m.type === 'title') return { title: m.title };
    return null;
  }

  root.SimWeb = {
    DOCROOT, SERVER_SOFTWARE, DEFAULT_UA, PHP_EXT,
    Engine, Server,
    toBytes, isUtf8, decodeText, isBinary, b64, unb64, escapeHtml, fmtSize, dirname, sameBytes, shellSplit,
    compress, decompress,
    resolveUrl, contentType, responseHead,
    appendHl, renderExchange, pageHtml, statusHtml, frameDoc, pageAction,
  };
})(typeof self !== 'undefined' ? self : this);
