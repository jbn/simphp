// A small /bin/sh for the simulated server.
//
// PHP 4 starts every external program through popen() (exec, system,
// passthru, shell_exec, backticks, popen(), mail()); src/simphp_sys.c routes
// those here. The shell runs synchronously against the in-memory filesystem
// and mimics a 2001 Linux box (GNU fileutils/textutils/sh-utils era) running
// Apache as `nobody`. Data is handled as byte strings (one char per byte).
addToLibrary({
  $simphpSh__deps: ['$FS', '$simphpZone', 'getenv', '$UTF8ToString', '$stringToUTF8OnStack', '$stackSave', '$stackRestore', 'simphp_sleep_ms'],
  $simphpSh: {
    UNAME: { s: 'Linux', n: 'simphp', r: '2.4.16', v: '#1 Fri Dec 21 12:00:00 PST 2001', m: 'i686', p: 'unknown', o: 'GNU/Linux' },

    getenv: function (name) {
      var sp = stackSave();
      var p = _getenv(stringToUTF8OnStack(name));
      stackRestore(sp);
      return p ? UTF8ToString(p) : null;
    },

    bytesToStr: function (u8) {
      var s = '';
      for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return s;
    },
    strToBytes: function (s) {
      var u8 = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i) & 0xff;
      return u8;
    },

    // --- tokenizer --------------------------------------------------------
    // Returns tokens: {t:'w', v, glob} words, {t:'op', v} operators.
    tokenize: function (src, ctx) {
      var toks = [], i = 0, n = src.length;
      var word = null, glob = false;
      var self = this;
      function push() { if (word !== null) { toks.push({ t: 'w', v: word, glob: glob }); word = null; glob = false; } }
      function add(s) { word = (word === null ? '' : word) + s; }
      function readVar() {
        // at src[i] === '$'
        var m;
        var rest = src.slice(i + 1);
        if (rest[0] === '(') {
          var depth = 1, j = i + 2;
          while (j < n && depth) { if (src[j] === '(') depth++; else if (src[j] === ')') depth--; j++; }
          var inner = src.slice(i + 2, j - 1);
          i = j;
          return self.subst(inner, ctx);
        }
        if ((m = rest.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}/))) { i += 1 + m[0].length; return self.var(m[1], ctx); }
        if ((m = rest.match(/^([A-Za-z_][A-Za-z0-9_]*|[?$#0-9])/))) { i += 1 + m[0].length; return self.var(m[1], ctx); }
        i++;
        return '$';
      }
      while (i < n) {
        var c = src[i];
        if (c === '\\') { add(src[i + 1] === undefined ? '' : src[i + 1]); i += 2; continue; }
        if (c === "'") { var e = src.indexOf("'", i + 1); if (e < 0) e = n; add(src.slice(i + 1, e)); i = e + 1; continue; }
        if (c === '"') {
          i++;
          add('');
          while (i < n && src[i] !== '"') {
            if (src[i] === '\\' && '$`"\\\n'.indexOf(src[i + 1]) >= 0) { add(src[i + 1]); i += 2; }
            else if (src[i] === '$') add(readVar());
            else if (src[i] === '`') { var b = src.indexOf('`', i + 1); if (b < 0) b = n; add(self.subst(src.slice(i + 1, b), ctx)); i = b + 1; }
            else { add(src[i]); i++; }
          }
          i++;
          continue;
        }
        if (c === '`') { var bq = src.indexOf('`', i + 1); if (bq < 0) bq = n; add(self.subst(src.slice(i + 1, bq), ctx)); i = bq + 1; continue; }
        if (c === '$') { add(readVar()); continue; }
        if (c === ' ' || c === '\t') { push(); i++; continue; }
        if (c === '\n') { push(); toks.push({ t: 'op', v: ';' }); i++; continue; }
        if (c === '#' && word === null) { while (i < n && src[i] !== '\n') i++; continue; }
        var ops = ['2>&1', '1>&2', '>&2', '2>>', '>>', '2>', '|', '>', '<'];
        var op = null;
        for (var k = 0; k < ops.length; k++) {
          if (src.startsWith(ops[k], i)) {
            // "2>" only counts as an operator at the start of a word
            if (ops[k][0] === '2' && word !== null) continue;
            op = ops[k]; break;
          }
        }
        if (op) { push(); toks.push({ t: 'op', v: op }); i += op.length; continue; }
        if (c === '*' || c === '?' || c === '[') glob = true;
        add(c);
        i++;
      }
      push();
      return toks;
    },

    // Split a command line at top-level list operators (; && || & newline),
    // respecting quotes, $(...) and backticks. Expansion then happens per
    // command, right before it runs (so `cd /tmp && echo $(pwd)` works).
    splitList: function (src) {
      var parts = [], cur = '', i = 0, n = src.length, depth = 0;
      while (i < n) {
        var c = src[i];
        if (c === '\\') { cur += src.substr(i, 2); i += 2; continue; }
        if (c === "'") { var e = src.indexOf("'", i + 1); if (e < 0) e = n - 1; cur += src.slice(i, e + 1); i = e + 1; continue; }
        if (c === '"') {
          var j = i + 1;
          while (j < n && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
          cur += src.slice(i, j + 1); i = j + 1; continue;
        }
        if (c === '`') { var b = src.indexOf('`', i + 1); if (b < 0) b = n - 1; cur += src.slice(i, b + 1); i = b + 1; continue; }
        if (c === '$' && src[i + 1] === '(') { depth++; cur += '$('; i += 2; continue; }
        if (c === ')' && depth) { depth--; cur += c; i++; continue; }
        if (!depth) {
          var op = src.startsWith('&&', i) ? '&&' : src.startsWith('||', i) ? '||' : (c === ';' || c === '\n') ? ';'
            : (c === '&' && src[i + 1] !== '>' && src[i - 1] !== '>') ? '&' : null;
          if (op) { parts.push({ src: cur, op: op }); cur = ''; i += op.length; continue; }
        }
        cur += c; i++;
      }
      parts.push({ src: cur, op: ';' });
      return parts;
    },

    var: function (name, ctx) {
      if (name === '?') return String(ctx.status);
      if (name === '$') return String(ctx.pid);
      if (name === '#') return '0';
      if (name === '0') return 'sh';
      if (ctx.vars.hasOwnProperty(name)) return ctx.vars[name];
      var v = this.getenv(name);
      return v === null ? '' : v;
    },

    subst: function (cmd, ctx) {
      var sub = { cwd: ctx.cwd, vars: Object.assign({}, ctx.vars), status: ctx.status, pid: ctx.pid, err: ctx.err };
      var r = this.runList(cmd, '', sub);
      return r.out.replace(/\n+$/, '');
    },

    // --- parser / executor --------------------------------------------------
    runList: function (src, stdin, ctx) {
      var parts = this.splitList(src);
      var out = '', status = 0, prevOp = ';';
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        var run = prevOp === ';' || prevOp === '&' || (prevOp === '&&' && status === 0) || (prevOp === '||' && status !== 0);
        prevOp = part.op;
        if (!run || !part.src.trim()) continue;
        var toks = this.tokenize(part.src, ctx);
        var pipeline = [];
        var cmd = { argv: [], redir: [], assign: {} };
        for (var i = 0; i < toks.length; i++) {
          var tk = toks[i];
          if (tk.t === 'op' && tk.v === '|') { pipeline.push(cmd); cmd = { argv: [], redir: [], assign: {} }; continue; }
          if (tk.t === 'op') {
            if (tk.v === '2>&1' || tk.v === '1>&2' || tk.v === '>&2') { cmd.redir.push({ op: tk.v }); continue; }
            var target = toks[i + 1] && toks[i + 1].t === 'w' ? toks[i + 1].v : '';
            cmd.redir.push({ op: tk.v, file: target });
            i++;
            continue;
          }
          var am = !cmd.argv.length && tk.v.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (am) cmd.assign[am[1]] = am[2];
          else if (tk.glob) Array.prototype.push.apply(cmd.argv, this.glob(tk.v, ctx));
          else cmd.argv.push(tk.v);
        }
        pipeline.push(cmd);
        var r = this.runPipeline(pipeline, stdin, ctx);
        stdin = '';
        out += r.out;
        status = r.status;
        ctx.status = status;
        if (ctx.exit !== undefined) break;
      }
      return { out: out, status: ctx.exit !== undefined ? ctx.exit : status };
    },

    runPipeline: function (cmds, stdin, ctx) {
      var data = stdin, status = 0, out = '';
      for (var c = 0; c < cmds.length; c++) {
        var cmd = cmds[c];
        var input = c === 0 ? data : out;
        var toErr = false, mergeErr = false, errFile = null, outFile = null, outAppend = false, errAppend = false;
        for (var r of cmd.redir) {
          if (r.op === '<') {
            var rd = this.readFile(r.file, ctx);
            if (rd === null) { ctx.err('sh: ' + r.file + ': No such file or directory\n'); return { out: '', status: 1 }; }
            input = rd;
          } else if (r.op === '>' || r.op === '>>') { outFile = r.file; outAppend = r.op === '>>'; }
          else if (r.op === '2>' || r.op === '2>>') { errFile = r.file; errAppend = r.op === '2>>'; }
          else if (r.op === '2>&1') mergeErr = true;
          else if (r.op === '1>&2' || r.op === '>&2') toErr = true;
        }
        if (!cmd.argv.length) { Object.assign(ctx.vars, cmd.assign); out = ''; status = 0; continue; }
        var errBuf = '';
        var sub = Object.assign({}, ctx, { err: (s) => { errBuf += s; } });
        var res = this.exec(cmd.argv, input, sub, cmd.assign);
        if (sub.cwd !== ctx.cwd) ctx.cwd = sub.cwd;
        if (sub.exit !== undefined) ctx.exit = sub.exit;
        var o = res.out || '';
        if (mergeErr) { o += errBuf; errBuf = ''; }
        if (errFile !== null) { if (errFile !== '/dev/null') this.writeFile(errFile, errBuf, errAppend, ctx); errBuf = ''; }
        if (errBuf) ctx.err(errBuf);
        if (toErr) { ctx.err(o); o = ''; }
        if (outFile !== null) { if (outFile !== '/dev/null') this.writeFile(outFile, o, outAppend, ctx); o = ''; }
        out = o;
        status = res.code;
      }
      return { out: out, status: status };
    },

    // --- filesystem helpers --------------------------------------------------
    abs: function (p, ctx) {
      if (!p) return ctx.cwd;
      if (p === '~' || p.startsWith('~/')) p = '/home/nobody' + p.slice(1);
      var parts = (p[0] === '/' ? p : ctx.cwd + '/' + p).split('/');
      var outp = [];
      for (var s of parts) {
        if (!s || s === '.') continue;
        if (s === '..') outp.pop(); else outp.push(s);
      }
      return '/' + outp.join('/');
    },
    stat: function (p) { try { return FS.stat(p); } catch (e) { return null; } },
    readFile: function (p, ctx) {
      if (p === '/dev/null') return '';
      var a = this.abs(p, ctx);
      var st = this.stat(a);
      if (!st || FS.isDir(st.mode)) return null;
      return this.bytesToStr(FS.readFile(a));
    },
    writeFile: function (p, data, append, ctx) {
      var a = this.abs(p, ctx);
      var prev = append ? (this.readFile(a, ctx) || '') : '';
      try { FS.writeFile(a, this.strToBytes(prev + data)); return true; } catch (e) { ctx.err('sh: ' + p + ': Permission denied\n'); return false; }
    },
    glob: function (pattern, ctx) {
      var dir = pattern.lastIndexOf('/') >= 0 ? pattern.slice(0, pattern.lastIndexOf('/')) || '/' : '.';
      var base = pattern.slice(pattern.lastIndexOf('/') + 1);
      var re = new RegExp('^' + base.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      var names;
      try { names = FS.readdir(this.abs(dir, ctx)); } catch (e) { return [pattern]; }
      var hits = names.filter((nm) => nm !== '.' && nm !== '..' && (nm[0] !== '.' || base[0] === '.') && re.test(nm)).sort();
      if (!hits.length) return [pattern];
      return hits.map((nm) => (dir === '.' ? nm : (dir === '/' ? '/' : dir + '/') + nm));
    },

    // --- time ----------------------------------------------------------------
    strftime: function (fmt, ms) {
      var info = simphpZone().info(ms);
      var d = new Date(ms + info.off * 1000);
      var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var p2 = (x) => String(x).padStart(2, '0');
      var yday = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
      var off = info.off, offs = (off < 0 ? '-' : '+') + p2(Math.floor(Math.abs(off) / 3600)) + p2(Math.floor(Math.abs(off) % 3600 / 60));
      var h12 = d.getUTCHours() % 12 || 12;
      var map = {
        a: DAYS[d.getUTCDay()].slice(0, 3), A: DAYS[d.getUTCDay()], b: MONS[d.getUTCMonth()].slice(0, 3), h: MONS[d.getUTCMonth()].slice(0, 3),
        B: MONS[d.getUTCMonth()], d: p2(d.getUTCDate()), e: String(d.getUTCDate()).padStart(2, ' '), H: p2(d.getUTCHours()),
        I: p2(h12), M: p2(d.getUTCMinutes()), S: p2(d.getUTCSeconds()), m: p2(d.getUTCMonth() + 1), y: p2(d.getUTCFullYear() % 100),
        Y: String(d.getUTCFullYear()), Z: info.abbr, z: offs, s: String(Math.floor(ms / 1000)), j: String(yday).padStart(3, '0'),
        p: d.getUTCHours() < 12 ? 'AM' : 'PM', u: String(d.getUTCDay() || 7), w: String(d.getUTCDay()), n: '\n', t: '\t', '%': '%',
      };
      map.D = map.m + '/' + map.d + '/' + map.y; map.T = map.H + ':' + map.M + ':' + map.S; map.R = map.H + ':' + map.M;
      map.F = map.Y + '-' + map.m + '-' + map.d; map.r = map.I + ':' + map.M + ':' + map.S + ' ' + map.p;
      map.c = map.a + ' ' + map.b + ' ' + map.e + ' ' + map.T + ' ' + map.Y;
      return fmt.replace(/%([a-zA-Z%])/g, (m0, k) => (map.hasOwnProperty(k) ? map[k] : m0));
    },

    // --- commands --------------------------------------------------------------
    exec: function (argv, stdin, ctx, assign) {
      var name = argv[0].replace(/^(\/usr\/local\/bin|\/usr\/bin|\/bin|\/usr\/sbin|\/sbin)\//, '');
      var fn = this.cmds[name];
      if (!fn) {
        ctx.err('sh: ' + argv[0] + ': command not found\n');
        return { out: '', code: 127 };
      }
      try {
        var r = fn.call(this, argv.slice(1), stdin, ctx, assign || {});
        return { out: r.out || '', code: r.code || 0 };
      } catch (e) {
        ctx.err(name + ': ' + e.message + '\n');
        return { out: '', code: 1 };
      }
    },

    cmds: {
      'true': () => ({}),
      'false': () => ({ code: 1 }),
      ':': () => ({}),
      exit: function (a, i, ctx) { ctx.exit = a.length ? (parseInt(a[0], 10) & 255) : ctx.status; return { code: ctx.exit }; },
      echo: function (a) {
        var nl = true, esc = false;
        while (a.length && /^-[neE]+$/.test(a[0])) { if (a[0].includes('n')) nl = false; if (a[0].includes('e')) esc = true; a = a.slice(1); }
        var s = a.join(' ');
        if (esc) s = s.replace(/\\(n|t|\\|a|b|r|0[0-7]{0,3}|c)/g, (m, k) => ({ n: '\n', t: '\t', '\\': '\\', a: '\x07', b: '\b', r: '\r', c: '' }[k] ?? String.fromCharCode(parseInt(k, 8))));
        return { out: s + (nl ? '\n' : '') };
      },
      printf: function (a) {
        if (!a.length) return { code: 1 };
        var fmt = a[0].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
        var args = a.slice(1), k = 0, out = '';
        do {
          out += fmt.replace(/%([-0 ]?\d*)(?:\.(\d+))?([sdifxXoc%])/g, (m, flags, prec, c) => {
            if (c === '%') return '%';
            var v = args[k++] ?? '';
            var s;
            if (c === 's') s = prec ? v.slice(0, +prec) : v;
            else if (c === 'c') s = v.slice(0, 1);
            else if (c === 'f') s = (parseFloat(v) || 0).toFixed(prec ? +prec : 6);
            else { var num = parseInt(v, 10) || 0; s = c === 'x' ? num.toString(16) : c === 'X' ? num.toString(16).toUpperCase() : c === 'o' ? num.toString(8) : String(num); }
            var w = parseInt(flags.replace(/[-0 ]/, ''), 10) || 0;
            if (s.length < w) s = flags[0] === '-' ? s.padEnd(w) : s.padStart(w, flags[0] === '0' ? '0' : ' ');
            return s;
          });
        } while (k > 0 && k < args.length);
        return { out: out };
      },
      pwd: function (a, i, ctx) { return { out: ctx.cwd + '\n' }; },
      cd: function (a, i, ctx) {
        var t = this.abs(a[0] || '/home/nobody', ctx);
        var st = this.stat(t);
        if (!st || !FS.isDir(st.mode)) { ctx.err('sh: cd: ' + (a[0] || '') + ': No such file or directory\n'); return { code: 1 }; }
        ctx.cwd = t;
        return {};
      },
      sh: function (a, stdin, ctx) {
        if (a[0] === '-c' && a.length > 1) {
          var sub = { cwd: ctx.cwd, vars: {}, status: 0, pid: ctx.pid + 1, err: ctx.err };
          var r = this.runList(a[1], stdin, sub);
          return { out: r.out, code: r.status };
        }
        if (!a.length) { var r2 = this.runList(stdin, '', { cwd: ctx.cwd, vars: {}, status: 0, pid: ctx.pid + 1, err: ctx.err }); return { out: r2.out, code: r2.status }; }
        var script = this.readFile(a[0], ctx);
        if (script === null) { ctx.err('sh: ' + a[0] + ': No such file or directory\n'); return { code: 127 }; }
        var r3 = this.runList(script, stdin, { cwd: ctx.cwd, vars: {}, status: 0, pid: ctx.pid + 1, err: ctx.err });
        return { out: r3.out, code: r3.status };
      },
      bash: function (a, stdin, ctx) { return this.cmds.sh.call(this, a, stdin, ctx); },
      whoami: () => ({ out: 'nobody\n' }),
      id: () => ({ out: 'uid=99(nobody) gid=99(nobody) groups=99(nobody)\n' }),
      hostname: () => ({ out: 'simphp\n' }),
      uname: function (a) {
        var U = this.UNAME, flags = a.join('').replace(/-/g, '');
        if (!flags) flags = 's';
        if (flags.includes('a')) flags = 'snrvmpo';
        var out = [];
        for (var f of 'snrvmpo') if (flags.includes(f)) out.push(U[f]);
        return { out: out.join(' ') + '\n' };
      },
      date: function (a) {
        var ms = Date.now(), fmt = '%a %b %e %H:%M:%S %Z %Y', saveTZ = null;
        for (var k = 0; k < a.length; k++) {
          if (a[k][0] === '+') fmt = a[k].slice(1);
          else if (a[k] === '-u' || a[k] === '--utc') saveTZ = true;
          else if (a[k] === '-d' || a[k] === '--date') { var t = Date.parse(a[++k]); if (!isNaN(t)) ms = t; }
        }
        if (saveTZ) {
          var d = new Date(ms), p2 = (x) => String(x).padStart(2, '0');
          var DAYS = 'SunMonTueWedThuFriSat', MONS = 'JanFebMarAprMayJunJulAugSepOctNovDec';
          return { out: fmt === '%a %b %e %H:%M:%S %Z %Y'
            ? DAYS.substr(d.getUTCDay() * 3, 3) + ' ' + MONS.substr(d.getUTCMonth() * 3, 3) + ' ' + String(d.getUTCDate()).padStart(2) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()) + ' UTC ' + d.getUTCFullYear() + '\n'
            : fmt + '\n' };
        }
        return { out: this.strftime(fmt, ms) + '\n' };
      },
      sleep: function (a) { var s = parseFloat(a[0]) || 0; _simphp_sleep_ms(s * 1000); return {}; },
      env: function (a, i, ctx) {
        var keys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'PWD', 'TZ', 'LANG', 'SERVER_SOFTWARE', 'SERVER_NAME', 'GATEWAY_INTERFACE', 'REQUEST_METHOD', 'QUERY_STRING', 'REQUEST_URI', 'SCRIPT_NAME', 'SCRIPT_FILENAME', 'DOCUMENT_ROOT', 'REMOTE_ADDR', 'HTTP_HOST', 'HTTP_USER_AGENT'];
        var out = '';
        for (var k of keys) { var v = this.getenv(k); if (v !== null) out += k + '=' + v + '\n'; }
        for (var vk in ctx.vars) out += vk + '=' + ctx.vars[vk] + '\n';
        return { out: out };
      },
      printenv: function (a) { if (!a.length) return this.cmds.env.call(this, a); var v = this.getenv(a[0]); return v === null ? { code: 1 } : { out: v + '\n' }; },
      which: function (a) {
        var out = '', code = 0;
        for (var c of a) {
          if (this.cmds[c]) out += (c === 'sendmail' ? '/usr/sbin/' : '/bin/') + c + '\n';
          else code = 1;
        }
        return { out: out, code: code };
      },
      cat: function (a, stdin, ctx) {
        if (!a.length || (a.length === 1 && a[0] === '-')) return { out: stdin };
        var out = '', code = 0;
        for (var f of a) {
          if (f === '-') { out += stdin; continue; }
          var d = this.readFile(f, ctx);
          if (d === null) {
            var st = this.stat(this.abs(f, ctx));
            ctx.err('cat: ' + f + ': ' + (st ? 'Is a directory' : 'No such file or directory') + '\n');
            code = 1;
          } else out += d;
        }
        return { out: out, code: code };
      },
      ls: function (a, i, ctx) {
        var opts = '', paths = [];
        for (var x of a) { if (x[0] === '-' && x.length > 1) opts += x.slice(1); else paths.push(x); }
        if (!paths.length) paths = ['.'];
        var long = opts.includes('l'), all = opts.includes('a'), almost = opts.includes('A');
        var self = this, out = '', code = 0;
        var MONS = 'JanFebMarAprMayJunJulAugSepOctNovDec';
        function modeStr(m) {
          var t = FS.isDir(m) ? 'd' : FS.isLink(m) ? 'l' : '-';
          var r = '';
          for (var b = 8; b >= 0; b--) r += (m & (1 << b)) ? 'rwx'[(8 - b) % 3] : '-';
          return t + r;
        }
        function line(name, st) {
          if (!long) return name + '\n';
          var d = new Date(st.mtime.getTime());
          var six = Date.now() - d.getTime() > 182 * 86400000 || d.getTime() > Date.now() + 3600000;
          var when = MONS.substr(d.getMonth() * 3, 3) + ' ' + String(d.getDate()).padStart(2) + ' ' +
            (six ? ' ' + d.getFullYear() : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
          var size = FS.isDir(st.mode) ? 4096 : st.size;
          return modeStr(st.mode) + '    1 nobody   nobody   ' + String(size).padStart(8) + ' ' + when + ' ' + name + '\n';
        }
        var files = [], dirs = [];
        for (var p of paths) {
          var ap = self.abs(p, ctx), st = self.stat(ap);
          if (!st) { ctx.err('ls: ' + p + ': No such file or directory\n'); code = 1; continue; }
          if (FS.isDir(st.mode) && !opts.includes('d')) dirs.push([p, ap]); else files.push([p, st]);
        }
        for (var f of files.sort()) out += line(f[0], f[1]);
        dirs.forEach(function (dd, idx) {
          var names = FS.readdir(dd[1]).filter((nm) => all || (almost ? nm !== '.' && nm !== '..' : nm[0] !== '.')).sort();
          if (paths.length > 1) out += (idx || files.length ? '\n' : '') + dd[0] + ':\n';
          var body = '', blocks = 0;
          for (var nm of names) {
            var st2 = self.stat(dd[1] + '/' + nm);
            if (!st2) continue;
            blocks += Math.ceil((FS.isDir(st2.mode) ? 4096 : st2.size) / 1024);
            body += line(nm, st2);
          }
          if (long) out += 'total ' + blocks + '\n';
          out += body;
        });
        return { out: out, code: code };
      },
      head: function (a, stdin, ctx) { return this.headtail(a, stdin, ctx, true); },
      tail: function (a, stdin, ctx) { return this.headtail(a, stdin, ctx, false); },
      wc: function (a, stdin, ctx) {
        var opts = '', files = [];
        for (var x of a) { if (x[0] === '-' && x.length > 1) opts += x.slice(1); else files.push(x); }
        if (!opts) opts = 'lwc';
        var self = this;
        function count(s, name) {
          var cols = [];
          if (opts.includes('l')) cols.push((s.match(/\n/g) || []).length);
          if (opts.includes('w')) cols.push((s.match(/\S+/g) || []).length);
          if (opts.includes('c')) cols.push(s.length);
          return cols.map((c) => String(c).padStart(7)).join(' ') + (name ? ' ' + name : '') + '\n';
        }
        if (!files.length) return { out: count(stdin, '') };
        var out = '';
        for (var f of files) { var d = self.readFile(f, ctx); if (d === null) { ctx.err('wc: ' + f + ': No such file or directory\n'); continue; } out += count(d, f); }
        return { out: out };
      },
      grep: function (a, stdin, ctx) {
        var opts = '', pat = null, files = [];
        for (var k = 0; k < a.length; k++) {
          if (a[k] === '-e') pat = a[++k];
          else if (a[k][0] === '-' && a[k].length > 1 && pat === null) opts += a[k].slice(1);
          else if (pat === null) pat = a[k];
          else files.push(a[k]);
        }
        if (pat === null) { ctx.err('Usage: grep [OPTION]... PATTERN [FILE]...\n'); return { code: 2 }; }
        var src = opts.includes('F') ? pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          : opts.includes('E') ? pat : this.bre(pat);
        var re = new RegExp(src, opts.includes('i') ? 'i' : '');
        var inputs = files.length ? files.map((f) => [f, this.readFile(f, ctx)]) : [['(standard input)', stdin]];
        var out = '', matched = 0, multi = files.length > 1;
        for (var inp of inputs) {
          if (inp[1] === null) { ctx.err('grep: ' + inp[0] + ': No such file or directory\n'); continue; }
          var lines = inp[1].split('\n');
          if (lines[lines.length - 1] === '') lines.pop();
          var cnt = 0;
          lines.forEach((l, idx) => {
            if (re.test(l) !== opts.includes('v')) {
              cnt++;
              if (!opts.includes('c') && !opts.includes('l') && !opts.includes('q')) out += (multi ? inp[0] + ':' : '') + (opts.includes('n') ? (idx + 1) + ':' : '') + l + '\n';
            }
          });
          if (opts.includes('c')) out += (multi ? inp[0] + ':' : '') + cnt + '\n';
          if (opts.includes('l') && cnt) out += inp[0] + '\n';
          matched += cnt;
        }
        return { out: opts.includes('q') ? '' : out, code: matched ? 0 : 1 };
      },
      sort: function (a, stdin, ctx) {
        var opts = '', files = [];
        for (var x of a) { if (x[0] === '-' && x.length > 1) opts += x.slice(1); else files.push(x); }
        var data = files.length ? files.map((f) => this.readFile(f, ctx) || '').join('') : stdin;
        var lines = data.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        var cmp = opts.includes('n')
          ? (x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0) || (x < y ? -1 : x > y ? 1 : 0)
          : opts.includes('f') ? (x, y) => { var X = x.toUpperCase(), Y = y.toUpperCase(); return X < Y ? -1 : X > Y ? 1 : 0; }
          : (x, y) => (x < y ? -1 : x > y ? 1 : 0);
        lines.sort(cmp);
        if (opts.includes('r')) lines.reverse();
        if (opts.includes('u')) lines = lines.filter((l, k) => k === 0 || cmp(l, lines[k - 1]) !== 0);
        return { out: lines.length ? lines.join('\n') + '\n' : '' };
      },
      uniq: function (a, stdin) {
        var c = a.includes('-c');
        var lines = stdin.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        var out = '', prev = null, n = 0;
        var flush = () => { if (prev !== null) out += (c ? String(n).padStart(7) + ' ' : '') + prev + '\n'; };
        for (var l of lines) { if (l === prev) n++; else { flush(); prev = l; n = 1; } }
        flush();
        return { out: out };
      },
      tr: function (a, stdin) {
        var del = a[0] === '-d';
        var expand = (s) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/(.)-(.)/g, (m, x, y) => {
          var r = ''; for (var k = x.charCodeAt(0); k <= y.charCodeAt(0); k++) r += String.fromCharCode(k); return r;
        }).replace(/\[:upper:\]/g, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').replace(/\[:lower:\]/g, 'abcdefghijklmnopqrstuvwxyz');
        if (del) { var set = expand(a[1] || ''); return { out: stdin.split('').filter((ch) => !set.includes(ch)).join('') }; }
        var s1 = expand(a[0] || ''), s2 = expand(a[1] || '');
        return { out: stdin.split('').map((ch) => { var k = s1.indexOf(ch); return k < 0 ? ch : (s2[k] ?? s2[s2.length - 1] ?? ch); }).join('') };
      },
      cut: function (a, stdin) {
        var d = '\t', fields = null, chars = null;
        for (var k = 0; k < a.length; k++) {
          var x = a[k];
          if (x.startsWith('-d')) d = x.length > 2 ? x.slice(2) : a[++k];
          else if (x.startsWith('-f')) fields = x.length > 2 ? x.slice(2) : a[++k];
          else if (x.startsWith('-c')) chars = x.length > 2 ? x.slice(2) : a[++k];
        }
        var sel = (spec, n) => {
          var idx = [];
          for (var part of spec.split(',')) {
            var m = part.split('-');
            var lo = m[0] ? +m[0] : 1, hi = m.length > 1 ? (m[1] ? +m[1] : n) : lo;
            for (var q = lo; q <= Math.min(hi, n); q++) idx.push(q - 1);
          }
          return idx;
        };
        var lines = stdin.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        return { out: lines.map((l) => {
          if (chars) return sel(chars, l.length).map((q) => l[q]).join('');
          var parts = l.split(d);
          if (parts.length === 1) return l;
          return sel(fields || '1', parts.length).map((q) => parts[q]).join(d);
        }).join('\n') + (lines.length ? '\n' : '') };
      },
      touch: function (a, i, ctx) { for (var f of a) { var p = this.abs(f, ctx); if (!this.stat(p)) FS.writeFile(p, new Uint8Array(0)); else FS.utime(p, Date.now(), Date.now()); } return {}; },
      mkdir: function (a, i, ctx) {
        var parents = a.includes('-p'), code = 0;
        for (var f of a.filter((x) => x[0] !== '-')) {
          var p = this.abs(f, ctx);
          if (parents) { var cur = ''; for (var seg of p.split('/').filter(Boolean)) { cur += '/' + seg; if (!this.stat(cur)) FS.mkdir(cur); } }
          else if (this.stat(p)) { ctx.err("mkdir: cannot create directory `" + f + "': File exists\n"); code = 1; }
          else { try { FS.mkdir(p); } catch (e) { ctx.err("mkdir: cannot create directory `" + f + "': No such file or directory\n"); code = 1; } }
        }
        return { code: code };
      },
      rm: function (a, i, ctx) {
        var opts = a.filter((x) => x[0] === '-').join(''), code = 0, self = this;
        function rmr(p) {
          var st = self.stat(p);
          if (FS.isDir(st.mode)) { for (var nm of FS.readdir(p)) if (nm !== '.' && nm !== '..') rmr(p + '/' + nm); FS.rmdir(p); }
          else FS.unlink(p);
        }
        for (var f of a.filter((x) => x[0] !== '-')) {
          var p = this.abs(f, ctx), st = this.stat(p);
          if (!st) { if (!opts.includes('f')) { ctx.err('rm: cannot remove `' + f + "': No such file or directory\n"); code = 1; } continue; }
          if (FS.isDir(st.mode) && !opts.includes('r') && !opts.includes('R')) { ctx.err('rm: `' + f + "' is a directory\n"); code = 1; continue; }
          rmr(p);
        }
        return { code: code };
      },
      rmdir: function (a, i, ctx) { for (var f of a) { try { FS.rmdir(this.abs(f, ctx)); } catch (e) { ctx.err("rmdir: `" + f + "': " + (this.stat(this.abs(f, ctx)) ? 'Directory not empty' : 'No such file or directory') + '\n'); return { code: 1 }; } } return {}; },
      cp: function (a, i, ctx) {
        var args = a.filter((x) => x[0] !== '-');
        if (args.length < 2) { ctx.err('cp: missing file argument\n'); return { code: 1 }; }
        var dst = this.abs(args.pop(), ctx), dstSt = this.stat(dst);
        for (var f of args) {
          var d = this.readFile(f, ctx);
          if (d === null) { ctx.err('cp: cannot stat `' + f + "': No such file or directory\n"); return { code: 1 }; }
          var target = dstSt && FS.isDir(dstSt.mode) ? dst + '/' + f.split('/').pop() : dst;
          FS.writeFile(target, this.strToBytes(d));
        }
        return {};
      },
      mv: function (a, i, ctx) {
        var args = a.filter((x) => x[0] !== '-');
        var dst = this.abs(args.pop(), ctx), dstSt = this.stat(dst);
        for (var f of args) {
          var src = this.abs(f, ctx);
          if (!this.stat(src)) { ctx.err('mv: cannot stat `' + f + "': No such file or directory\n"); return { code: 1 }; }
          FS.rename(src, dstSt && FS.isDir(dstSt.mode) ? dst + '/' + src.split('/').pop() : dst);
        }
        return {};
      },
      basename: function (a) { var s = (a[0] || '').replace(/\/+$/, ''); s = s.slice(s.lastIndexOf('/') + 1); if (a[1] && s.endsWith(a[1]) && s !== a[1]) s = s.slice(0, -a[1].length); return { out: s + '\n' }; },
      dirname: function (a) { var s = (a[0] || '').replace(/\/+$/, ''); var k = s.lastIndexOf('/'); return { out: (k < 0 ? '.' : k === 0 ? '/' : s.slice(0, k)) + '\n' }; },
      expr: function (a) {
        if (a.length === 3) {
          var x = a[0], op = a[1], y = a[2], nx = parseInt(x, 10), ny = parseInt(y, 10), r;
          switch (op) {
            case '+': r = nx + ny; break; case '-': r = nx - ny; break; case '*': r = nx * ny; break;
            case '/': r = Math.trunc(nx / ny); break; case '%': r = nx % ny; break;
            case '=': r = x === y ? 1 : 0; break; case '!=': r = x !== y ? 1 : 0; break;
            case '<': r = nx < ny ? 1 : 0; break; case '>': r = nx > ny ? 1 : 0; break;
            default: return { code: 2 };
          }
          return { out: r + '\n', code: r === 0 ? 1 : 0 };
        }
        return { out: (a[0] || '') + '\n' };
      },
      test: function (a, i, ctx) { return { code: this.testExpr(a, ctx) ? 0 : 1 }; },
      '[': function (a, i, ctx) { if (a[a.length - 1] === ']') a = a.slice(0, -1); return { code: this.testExpr(a, ctx) ? 0 : 1 }; },
      ps: () => ({ out: '  PID TTY          TIME CMD\n    1 ?        00:00:04 init\n  612 ?        00:00:00 httpd\n  613 ?        00:00:00 httpd\n' }),
      uptime: () => ({ out: ' 12:00:00  up 42 days,  3:14,  0 users,  load average: 0.08, 0.03, 0.01\n' }),
      df: () => ({ out: 'Filesystem           1k-blocks      Used Available Use% Mounted on\n/dev/hda1              8254240   3121908   4713040  40% /\n' }),
      sendmail: function (a, stdin, ctx) { return this.sendmail(a, stdin, ctx); },
      mail: function (a, stdin, ctx) {
        var subj = '', to = [];
        for (var k = 0; k < a.length; k++) { if (a[k] === '-s') subj = a[++k]; else to.push(a[k]); }
        return this.sendmail(to, 'To: ' + to.join(', ') + '\nSubject: ' + subj + '\n\n' + stdin, ctx);
      },
    },

    headtail: function (a, stdin, ctx, head) {
      var n = 10, files = [];
      for (var k = 0; k < a.length; k++) {
        if (a[k] === '-n') n = parseInt(a[++k], 10);
        else if (/^-\d+$/.test(a[k])) n = parseInt(a[k].slice(1), 10);
        else if (/^-n\d+$/.test(a[k])) n = parseInt(a[k].slice(2), 10);
        else files.push(a[k]);
      }
      var data = files.length ? (this.readFile(files[0], ctx) ?? '') : stdin;
      var lines = data.split('\n');
      var trailing = lines[lines.length - 1] === '';
      if (trailing) lines.pop();
      var sel = head ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n));
      return { out: sel.length ? sel.join('\n') + (trailing || sel.length < lines.length ? '\n' : '') : '' };
    },

    testExpr: function (a, ctx) {
      if (a[0] === '!') return !this.testExpr(a.slice(1), ctx);
      if (a.length === 1) return a[0] !== '';
      if (a.length === 2) {
        var st = this.stat(this.abs(a[1], ctx));
        switch (a[0]) {
          case '-e': return !!st; case '-f': return !!st && FS.isFile(st.mode); case '-d': return !!st && FS.isDir(st.mode);
          case '-s': return !!st && st.size > 0; case '-r': case '-w': return !!st; case '-x': return !!st && !!(st.mode & 0o111);
          case '-z': return a[1] === ''; case '-n': return a[1] !== '';
        }
      }
      if (a.length === 3) {
        var x = a[0], y = a[2];
        switch (a[1]) {
          case '=': case '==': return x === y; case '!=': return x !== y;
          case '-eq': return +x === +y; case '-ne': return +x !== +y; case '-lt': return +x < +y;
          case '-le': return +x <= +y; case '-gt': return +x > +y; case '-ge': return +x >= +y;
        }
      }
      return false;
    },

    // POSIX basic regular expression -> JS
    bre: function (p) {
      var out = '';
      for (var i = 0; i < p.length; i++) {
        var c = p[i];
        if (c === '\\' && i + 1 < p.length) {
          var d = p[++i];
          out += '(){}|+?'.includes(d) ? d : '\\' + d;
        } else if ('(){}|+?'.includes(c)) out += '\\' + c;
        else out += c;
      }
      return out;
    },

    // sendmail -t -i: accept the message and deliver it into an mbox on disk
    sendmail: function (a, msg, ctx) {
      var from = 'nobody@localhost', rcpts = [], useHeaders = false;
      for (var k = 0; k < a.length; k++) {
        if (a[k] === '-t') useHeaders = true;
        else if (a[k] === '-f' || a[k] === '-r') from = a[++k];
        else if (/^-f./.test(a[k])) from = a[k].slice(2);
        else if (a[k][0] !== '-') rcpts.push(a[k]);
      }
      msg = msg.replace(/\r\n/g, '\n');
      var sep = msg.indexOf('\n\n');
      var head = sep >= 0 ? msg.slice(0, sep) : msg, body = sep >= 0 ? msg.slice(sep + 2) : '';
      var headers = head.split('\n');
      if (useHeaders) {
        for (var h of headers) {
          var m = h.match(/^(To|Cc|Bcc):\s*(.*)$/i);
          if (m) rcpts = rcpts.concat(m[2].split(',').map((x) => x.trim()).filter(Boolean));
        }
        headers = headers.filter((h) => !/^Bcc:/i.test(h));
      }
      if (!rcpts.length) { ctx.err('No recipient addresses found in header\n'); return { code: 64 }; }
      var fm = headers.find((h) => /^From:/i.test(h));
      var envFrom = fm ? (fm.match(/<([^>]+)>/) || [null, fm.replace(/^From:\s*/i, '')])[1] : from;
      var now = Date.now();
      var stamp = this.strftime('%a %b %e %H:%M:%S %Y', now);
      var rfc = this.strftime('%a, %e %b %Y %H:%M:%S %z (%Z)', now);
      var qid = 'f' + Math.random().toString(36).slice(2, 13).toUpperCase().replace(/[^A-Z0-9]/g, '0');
      var id = this.strftime('%Y%m%d%H%M%S', now) + '.' + qid;
      var extra = ['Return-Path: <' + envFrom + '>',
        'Received: (from nobody@localhost)\n\tby simphp (8.11.6/8.11.6) id ' + qid + ';\n\t' + rfc];
      if (!headers.some((h) => /^Date:/i.test(h))) extra.push('Date: ' + rfc);
      if (!headers.some((h) => /^From:/i.test(h))) extra.push('From: ' + from);
      if (!headers.some((h) => /^Message-Id:/i.test(h))) extra.push('Message-Id: <' + id + '@simphp>');
      var mbox = 'From ' + envFrom + '  ' + stamp + '\n' + extra.concat(headers.filter(Boolean)).join('\n') +
        '\nX-Envelope-To: ' + rcpts.join(', ') + '\n\n' + body.replace(/^From /gm, '>From ') + (body.endsWith('\n') ? '' : '\n') + '\n';
      try { FS.mkdir('/var'); } catch (e) {}
      try { FS.mkdir('/var/mail'); } catch (e) {}
      this.writeFile('/var/mail/outbox', mbox, true, ctx);
      return {};
    },
  },

  simphp_shell__deps: ['$simphpSh', '$FS', 'malloc', '$UTF8ToString'],
  simphp_shell: (cmdPtr, inPtr, inLen, outPtrPtr, outLenPtr) => {
    var Sh = simphpSh;
    var cmd = UTF8ToString(cmdPtr);
    var input = inPtr ? Sh.bytesToStr(HEAPU8.subarray(inPtr, inPtr + inLen)) : '';
    var errStream = null;
    try { errStream = FS.getStream(2); } catch (e) {}
    var ctx = {
      cwd: FS.cwd(), vars: {}, status: 0, pid: 1000 + Math.floor(Math.random() * 30000),
      err: (s) => { if (errStream && s) { var b = Sh.strToBytes(s); FS.write(errStream, b, 0, b.length); } },
    };
    var r;
    try { r = Sh.runList(cmd, input, ctx); } catch (e) { ctx.err('sh: ' + e.message + '\n'); r = { out: '', status: 2 }; }
    var bytes = Sh.strToBytes(r.out);
    var p = _malloc(bytes.length || 1);
    HEAPU8.set(bytes, p);
    {{{ makeSetValue('outPtrPtr', '0', 'p', '*') }}};
    {{{ makeSetValue('outLenPtr', '0', 'bytes.length', 'i32') }}};
    return r.status;
  },
});
