/*
 * simphp-core: runs the PHP 4.1.1 CGI binary (compiled to wasm) the way a
 * web server would -- one fresh process per request.
 *
 * Works in a Web Worker (importScripts) and in Node (require).
 *
 *   const sim = await SimPHP.create({ createPHP, wasmBinary });
 *   const r = await sim.run({ files, script, args, env, stdin, iniFile });
 *
 * `files` maps absolute paths to string|Uint8Array and is written into a
 * fresh in-memory filesystem before each run. The result carries the
 * filesystem back out (for persistence of sessions, uploads, fopen(..,'w')).
 */
(function (root) {
  'use strict';

  const enc = new TextEncoder();
  const toBytes = (v) => (typeof v === 'string' ? enc.encode(v) : v);

  // Directories the simulator treats as the persistent "disk".
  const PERSIST_DIRS = ['/var/www', '/tmp', '/etc', '/home', '/var/mail', '/var/lib/mysql'];

  // A few files every Linux box of the era had (Red Hat 7.2). They are not
  // reported back as user files unless a script changes them.
  const SYSTEM_FILES = {
    '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nbin:x:1:1:bin:/bin:/sbin/nologin\n' +
      'daemon:x:2:2:daemon:/sbin:/sbin/nologin\nadm:x:3:4:adm:/var/adm:/sbin/nologin\n' +
      'mail:x:8:12:mail:/var/spool/mail:/sbin/nologin\nftp:x:14:50:FTP User:/var/ftp:/sbin/nologin\n' +
      'nobody:x:99:99:Nobody:/:/sbin/nologin\napache:x:48:48:Apache:/var/www:/bin/false\n' +
      'mysql:x:27:27:MySQL Server:/var/lib/mysql:/bin/bash\n',
    '/etc/group': 'root:x:0:root\nbin:x:1:root,bin,daemon\ndaemon:x:2:root,bin,daemon\nmail:x:12:mail\n' +
      'nobody:x:99:\nusers:x:100:\napache:x:48:\nmysql:x:27:\n',
    '/etc/hosts': '# Do not remove the following line, or various programs\n' +
      '# that require network functionality will fail.\n127.0.0.1\t\tsimphp localhost.localdomain localhost\n',
    '/etc/hostname': 'simphp\n',
    '/etc/resolv.conf': 'search localdomain\nnameserver 127.0.0.1\n',
    '/etc/issue': 'Red Hat Linux release 7.2 (Enigma)\nKernel \\r on an \\m\n\n',
    '/etc/redhat-release': 'Red Hat Linux release 7.2 (Enigma)\n',
    '/etc/shells': '/bin/sh\n/bin/bash\n/sbin/nologin\n',
  };
  const SYSTEM_BYTES = {};
  for (const k of Object.keys(SYSTEM_FILES)) SYSTEM_BYTES[k] = enc.encode(SYSTEM_FILES[k]);
  const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  // The file access mysqld gets: errors are Linux errnos (the mysqld
  // process runs as root, so permissions don't stop it)
  function mysqldFiles(FS) {
    // Emscripten's errno numbers (WASI) -> Linux: ENOENT EACCES EEXIST ENOTDIR EISDIR
    const LINUX = { 44: 2, 2: 13, 20: 17, 54: 20, 31: 21 };
    const errno = (e) => (e && LINUX[e.errno]) || 2;
    return {
      mkdirp(path) { try { mkdirp(FS, path); } catch (e) {} },
      read(path) { try { return FS.readFile(path); } catch (e) { return null; } },
      stat(path) { try { return { mode: FS.stat(path).mode }; } catch (e) { return null; } },
      write(path, data) {
        try { FS.writeFile(path, data); FS.chmod(path, 0o666); return 0; } catch (e) { return errno(e); }
      },
    };
  }

  function mkdirp(FS, path) {
    const parts = path.split('/').filter(Boolean);
    let cur = '';
    for (const p of parts) {
      cur += '/' + p;
      try { FS.mkdir(cur); } catch (e) { /* exists */ }
    }
  }

  function walk(FS, dir, out) {
    let names;
    try { names = FS.readdir(dir); } catch (e) { return; }
    for (const n of names) {
      if (n === '.' || n === '..') continue;
      const p = (dir === '/' ? '' : dir) + '/' + n;
      let st;
      try { st = FS.stat(p); } catch (e) { continue; }
      if (FS.isDir(st.mode)) { out[p + '/'] = null; walk(FS, p, out); }
      else if (FS.isFile(st.mode)) {
        const data = FS.readFile(p);
        if (SYSTEM_BYTES[p] && sameBytes(SYSTEM_BYTES[p], data)) continue;
        out[p] = { data, mtime: st.mtime.getTime() };
      }
    }
  }

  class SimPHP {
    // SQL: an initialised sql.js module; when given, an emulated MySQL server
    // (mysqld.js) listens on /tmp/mysql.sock and 127.0.0.1:3306.
    static async create({ createPHP, wasmBinary, wasmModule, SQL, MysqlServer }) {
      if (!wasmModule) wasmModule = await WebAssembly.compile(wasmBinary);
      const sim = new SimPHP(createPHP, wasmModule);
      if (SQL) {
        const Server = MysqlServer || (typeof root.MysqlServer !== 'undefined' ? root.MysqlServer : require('./mysqld.js'));
        sim.mysqld = new Server(SQL);
      }
      return sim;
    }

    constructor(createPHP, wasmModule) {
      this.createPHP = createPHP;
      this.wasmModule = wasmModule;
      this.mysqld = null;
    }

    /**
     * opts.args     argv after argv[0] (e.g. ['-q', '/var/www/index.php'])
     * opts.env      environment (CGI variables); replaces the default env
     * opts.stdin    string|Uint8Array fed to stdin (POST body)
     * opts.files    { '/abs/path': string|Uint8Array|{data,mtime}, '/dir/': null }
     * opts.cwd      working directory
     */
    async run(opts) {
      const stdinBytes = toBytes(opts.stdin || '');
      let stdinPos = 0;
      const out = [];
      let outLen = 0;
      const err = [];
      let chunk = new Uint8Array(65536), chunkLen = 0;
      const flush = () => {
        if (chunkLen) { out.push(chunk.slice(0, chunkLen)); outLen += chunkLen; chunkLen = 0; }
      };
      const limit = opts.maxOutput || 64 * 1024 * 1024;
      let exitCode = null;
      let aborted = null;
      let crash = null;
      const t0 = Date.now();

      const mysqld = opts.mysqld !== false ? this.mysqld : null;
      if (mysqld) {
        // mysqld runs on the same simulated machine, in the same time zone
        if (mysqld.setTimeZone) mysqld.setTimeZone((opts.env && opts.env.TZ) || 'UTC');
        mysqld.syncFrom(opts.files);
      }

      let Module;
      const moduleArgs = {
        simphpServices: mysqld ? {
          connect: (path, port) => ((path && /mysql\.sock$/.test(path)) || port === 3306 ? mysqld.connect() : null),
        } : null,
        noInitialRun: true,
        instantiateWasm: (imports, ok) => {
          WebAssembly.instantiate(this.wasmModule, imports).then((inst) => ok(inst, this.wasmModule));
          return {};
        },
        print: () => {}, printErr: () => {},
        quit: (status, toThrow) => { exitCode = status; throw toThrow; },
        preRun: [(M) => {
          const FS = M.FS;
          FS.init(
            () => (stdinPos < stdinBytes.length ? stdinBytes[stdinPos++] : null),
            (b) => {
              if (b === null) return;
              if (outLen + chunkLen >= limit) { aborted = 'output limit exceeded'; return; }
              chunk[chunkLen++] = b;
              if (chunkLen === chunk.length) flush();
            },
            (b) => { if (b !== null) err.push(b); }
          );
          // Linux default umask 022: new files 0644, directories 0755.
          const mknod = FS.mknod;
          FS.mknod = (path, mode, dev) => mknod.call(FS, path, mode & ~0o022, dev);
          // Emscripten injects USER/LOGNAME/PATH/PWD/HOME/LANG/_ defaults
          // unless a key is explicitly set to undefined.
          const ENV = M.ENV;
          for (const k of Object.keys(ENV)) delete ENV[k];
          for (const k of ['USER', 'LOGNAME', 'PATH', 'PWD', 'HOME', 'LANG', '_']) ENV[k] = undefined;
          Object.assign(ENV, opts.env || {});
          for (const d of PERSIST_DIRS) mkdirp(FS, d);
          for (const d of ['/bin', '/usr/bin', '/usr/sbin', '/var/log', '/var/spool/mail', '/home/nobody', '/root', '/proc']) mkdirp(FS, d);
          const files = opts.files || {};
          for (const path of Object.keys(SYSTEM_BYTES)) {
            if (files[path] === undefined) { FS.writeFile(path, SYSTEM_BYTES[path]); FS.chmod(path, 0o644); }
          }
          for (const path of Object.keys(files).sort()) {
            const v = files[path];
            if (path.endsWith('/')) { mkdirp(FS, path); try { FS.chmod(path.replace(/\/$/, ''), 0o755); } catch (e) {} continue; }
            mkdirp(FS, path.substring(0, path.lastIndexOf('/')) || '/');
            const data = v && v.data !== undefined ? v.data : v;
            FS.writeFile(path, toBytes(data));
            FS.chmod(path, v && v.mode ? v.mode : 0o644);
            if (v && v.mtime) { try { FS.utime(path, v.mtime, v.mtime); } catch (e) {} }
          }
          if (opts.cwd) { mkdirp(FS, opts.cwd); FS.chdir(opts.cwd); }
          // mysqld reads and writes files on the same machine (LOAD DATA
          // INFILE, SELECT ... INTO OUTFILE, LOAD_FILE())
          if (mysqld) mysqld.fs = mysqldFiles(FS);
        }],
      };

      Module = await this.createPHP(moduleArgs);
      try {
        // (the JSPI build's callMain is async: PHP then runs on a separate,
        // larger wasm stack, allowing deeper PHP recursion)
        let rc = Module.callMain(opts.args || []);
        if (rc && typeof rc.then === 'function') rc = await rc;
        if (exitCode === null) exitCode = rc;
      } catch (e) {
        if (e && e.name === 'ExitStatus') exitCode = e.status;
        else if (e instanceof WebAssembly.RuntimeError || e instanceof RangeError) {
          // The native binary would have died on a signal here: stack
          // exhaustion (deep recursion) and wild memory accesses are SIGSEGV.
          crash = { signal: 'SIGSEGV', number: 11, detail: e.message + (opts.debug ? '\n' + e.stack : '') };
          exitCode = 128 + 11;
        } else { aborted = String(e && e.stack || e); }
      }
      flush();
      if (mysqld) mysqld.fs = null;

      const stdout = new Uint8Array(outLen);
      let o = 0;
      for (const c of out) { stdout.set(c, o); o += c.length; }

      const fsOut = {};
      if (opts.collectFiles !== false) {
        for (const d of PERSIST_DIRS) walk(Module.FS, d, fsOut);
        if (mysqld) mysqld.exportTo(fsOut);
      }

      return {
        stdout,
        stderr: new Uint8Array(err),
        exitCode,
        aborted,
        crash,
        files: fsOut,
        elapsedMs: Date.now() - t0,
      };
    }
  }

  /** Split CGI output into { status, headers[], body } like a web server does. */
  SimPHP.parseCGI = function (bytes) {
    // headers end at the first \r\n\r\n or \n\n
    let i = 0, end = -1, bodyStart = 0;
    for (; i < bytes.length - 1; i++) {
      if (bytes[i] === 10 && bytes[i + 1] === 10) { end = i; bodyStart = i + 2; break; }
      if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
        end = i; bodyStart = i + 4; break;
      }
    }
    if (end < 0) return { status: 200, reason: 'OK', headers: [], body: bytes };
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, end));
    const headers = [];
    let status = 200, reason = 'OK', explicitStatus = false;
    for (const line of head.split(/\r?\n/)) {
      // PHP 4.1.1's CGI SAPI passes header("HTTP/1.0 404 Not Found") through verbatim
      const st = line.match(/^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/i);
      if (st) { status = +st[1]; reason = st[2] || reason; explicitStatus = true; continue; }
      const m = line.match(/^([^:]+):\s?(.*)$/);
      if (!m) continue;
      if (m[1].toLowerCase() === 'status') {
        const s = m[2].match(/^(\d{3})\s*(.*)$/);
        if (s) { status = +s[1]; reason = s[2] || reason; explicitStatus = true; }
        continue;
      }
      headers.push([m[1], m[2]]);
    }
    if (!explicitStatus && headers.some(([k]) => k.toLowerCase() === 'location')) { status = 302; reason = 'Found'; }
    if (!explicitStatus || !reason) reason = SimPHP.REASONS[status] || reason;
    return { status, reason, headers, body: bytes.subarray(bodyStart) };
  };

  SimPHP.REASONS = {
    200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found',
    303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 400: 'Bad Request',
    401: 'Authorization Required', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
    500: 'Internal Server Error', 501: 'Method Not Implemented', 503: 'Service Temporarily Unavailable',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SimPHP;
  else root.SimPHP = SimPHP;
})(typeof self !== 'undefined' ? self : this);
