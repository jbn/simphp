/*
 * simphp: the original PHP 4.1.1 engine compiled to WebAssembly.
 *
 *   const { createSimPHP } = require('simphp');
 *   const php = await createSimPHP();
 *   const r = await php.run({ args: ['-q', '/var/www/a.php'], files: { '/var/www/a.php': '<?php echo 1+1;' } });
 *
 * Works in Node (require/import) and in a classic Web Worker
 * (importScripts('.../simphp/index.js') then self.createSimPHP({ baseUrl })).
 * Each run() starts a fresh PHP process, the way a CGI server forks php per
 * request; state lives only in the `files` you pass in and get back.
 */
(function (root) {
  'use strict';

  const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node) && typeof require === 'function';
  const IS_WORKER = !IS_NODE && typeof importScripts === 'function';

  const hasJSPI = () => typeof WebAssembly.Suspending === 'function' && typeof WebAssembly.promising === 'function';

  let SimPHP = IS_NODE ? require('./dist/simphp-core.js') : root.SimPHP;

  function pickBuild(jspi) {
    if (jspi === 'auto') return hasJSPI() ? 'php-jspi' : 'php';
    if (jspi && !hasJSPI()) {
      throw new Error('simphp: jspi requested but this runtime lacks JS Promise Integration' +
        (IS_NODE ? ' (try node --experimental-wasm-jspi)' : ''));
    }
    return jspi ? 'php-jspi' : 'php';
  }

  async function fetchModule(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('simphp: could not load ' + url + ' (' + resp.status + ')');
    if (WebAssembly.compileStreaming && (resp.headers.get('content-type') || '').includes('wasm')) {
      return WebAssembly.compileStreaming(resp);
    }
    return WebAssembly.compile(await resp.arrayBuffer());
  }

  /**
   * Load the engine once; the returned instance runs any number of scripts.
   *
   * opts.jspi     'auto' (default) | true | false. The JSPI build runs PHP on
   *               a larger stack, allowing deeper PHP recursion.
   * opts.mysql    true to start the emulated MySQL 3.23 server on the bundled
   *               sql.js, or an initialised sql.js module to use instead.
   * opts.baseUrl  (Web Worker) URL of the package's dist/ directory.
   */
  async function createSimPHP(opts = {}) {
    const build = pickBuild(opts.jspi === undefined ? 'auto' : opts.jspi);
    let createPHP, wasmModule, SQL = null, MysqlServer;

    if (IS_NODE) {
      const path = require('path');
      const fs = require('fs');
      const dist = path.join(__dirname, 'dist');
      createPHP = require(path.join(dist, build + '.js'));
      wasmModule = await WebAssembly.compile(fs.readFileSync(path.join(dist, build + '.wasm')));
      if (opts.mysql) {
        MysqlServer = require('./dist/mysqld.js');
        SQL = opts.mysql === true
          ? await require('./dist/sqljs/sql-wasm.js')({ locateFile: (f) => path.join(dist, 'sqljs', f) })
          : opts.mysql;
      }
    } else if (IS_WORKER) {
      const base = opts.baseUrl === undefined ? '' : opts.baseUrl.replace(/\/?$/, '/');
      const scripts = [base + build + '.js', base + 'simphp-core.js'];
      if (opts.mysql) scripts.push(base + 'mysqld.js');
      if (opts.mysql === true) scripts.push(base + 'sqljs/sql-wasm.js');
      importScripts(...scripts);
      SimPHP = root.SimPHP;
      SimPHP.prototype.request = request;
      createPHP = root.createPHP;
      MysqlServer = root.MysqlServer;
      wasmModule = await fetchModule(base + build + '.wasm');
      if (opts.mysql) {
        SQL = opts.mysql === true ? await root.initSqlJs({ locateFile: (f) => base + 'sqljs/' + f }) : opts.mysql;
      }
    } else {
      throw new Error('simphp: run it in Node or a (classic) Web Worker; a run blocks its thread. ' +
        'Elsewhere, load dist/ yourself and call SimPHP.create({ createPHP, wasmModule }).');
    }

    const sim = await SimPHP.create({ createPHP, wasmModule, SQL, MysqlServer });
    sim.build = build;
    return sim;
  }

  const SERVER_SOFTWARE = 'Apache/1.3.22 (Unix)';
  const DOCROOT = '/var/www';

  /**
   * The CGI/1.1 environment Apache 1.3 hands PHP for a request, as the
   * simulator's web server builds it. `url` is a path on the server
   * (e.g. '/index.php?x=1'); `headers` become HTTP_* variables.
   */
  function cgiEnv(req) {
    const u = new URL(req.url || '/', 'http://localhost');
    const scriptPath = req.scriptFilename || DOCROOT + decodeURIComponent(u.pathname);
    const method = (req.method || 'GET').toUpperCase();
    const env = {
      SERVER_SOFTWARE,
      SERVER_NAME: 'localhost',
      SERVER_ADDR: '127.0.0.1',
      SERVER_PORT: '80',
      SERVER_ADMIN: 'webmaster@localhost',
      SERVER_SIGNATURE: '<ADDRESS>' + SERVER_SOFTWARE + ' Server at localhost Port 80</ADDRESS>\n',
      SERVER_PROTOCOL: 'HTTP/1.1',
      GATEWAY_INTERFACE: 'CGI/1.1',
      REQUEST_METHOD: method,
      QUERY_STRING: u.search ? u.search.slice(1) : '',
      REQUEST_URI: u.pathname + u.search,
      SCRIPT_NAME: scriptPath.startsWith(DOCROOT) ? scriptPath.slice(DOCROOT.length) : u.pathname,
      SCRIPT_FILENAME: scriptPath,
      PATH_TRANSLATED: scriptPath,
      DOCUMENT_ROOT: DOCROOT,
      REMOTE_ADDR: '127.0.0.1',
      REMOTE_PORT: '32768',
      REDIRECT_STATUS: '200',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      HTTP_HOST: 'localhost',
    };
    for (const [k, v] of Object.entries(req.headers || {})) {
      const name = k.toUpperCase().replace(/-/g, '_');
      if (name === 'CONTENT_TYPE' || name === 'CONTENT_LENGTH') env[name] = String(v);
      else env['HTTP_' + name] = String(v);
    }
    if (req.body !== undefined && req.body !== null) {
      const len = typeof req.body === 'string' ? new TextEncoder().encode(req.body).length : req.body.length;
      env.CONTENT_LENGTH = String(len);
      if (!env.CONTENT_TYPE) env.CONTENT_TYPE = 'application/x-www-form-urlencoded';
    }
    return Object.assign(env, req.env);
  }

  /**
   * Run one HTTP request through PHP as a CGI and parse the response.
   * Takes run() options too (files, mysqld, maxOutput, ...).
   * Resolves to { status, reason, headers, body, result }.
   */
  async function request(req) {
    const env = cgiEnv(req);
    const result = await this.run(Object.assign({}, req, {
      args: req.args || [],
      env,
      stdin: req.body || '',
      cwd: req.cwd || env.SCRIPT_FILENAME.substring(0, env.SCRIPT_FILENAME.lastIndexOf('/')) || '/',
    }));
    if (result.crash || result.aborted || result.exitCode === null) {
      return { status: 500, reason: 'Internal Server Error', headers: [], body: new Uint8Array(0), result };
    }
    return Object.assign(SimPHP.parseCGI(result.stdout), { result });
  }

  if (SimPHP) SimPHP.prototype.request = request;

  const api = { createSimPHP, cgiEnv, get SimPHP() { return SimPHP || root.SimPHP; } };
  if (IS_NODE && typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.createSimPHP = createSimPHP; root.cgiEnv = cgiEnv; }
})(typeof self !== 'undefined' ? self : this);
