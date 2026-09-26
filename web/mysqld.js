/*
 * mysqld.js -- an emulated MySQL 3.23 server for the PHP 4.1.1 simulator.
 *
 * PHP's real mysql extension (and the libmysql 3.23.39 client bundled with
 * PHP 4.1.1) connects to /tmp/mysql.sock or 127.0.0.1:3306; phpsim routes that
 * socket here. This file speaks the MySQL 3.23 wire protocol (protocol 10)
 * and executes queries on SQLite (sql.js), translating the MySQL dialect and
 * reproducing MySQL 3.23 behaviour where scripts can see it: implicit column
 * defaults, case-insensitive string comparison, AUTO_INCREMENT on 0/NULL,
 * "changed rows" for UPDATE, TIMESTAMP(14) columns, SHOW/DESCRIBE output,
 * error numbers and messages.
 *
 * Each MySQL database is its own SQLite database, persisted by the embedder
 * as /var/lib/mysql/<db>.sqlite on the simulated disk.
 */
(function (root) {
  'use strict';

  const SERVER_VERSION = '3.23.49';
  const PROTOCOL_VERSION = 10;
  const CAPS = 1 | 2 | 4 | 8 | 16 | 64 | 128 | 256 | 8192; // LONG_PASSWORD FOUND_ROWS LONG_FLAG CONNECT_WITH_DB NO_SCHEMA ODBC LOCAL_FILES IGNORE_SPACE TRANSACTIONS
  const STATUS_AUTOCOMMIT = 2;

  // enum_field_types
  const T = {
    DECIMAL: 0, TINY: 1, SHORT: 2, LONG: 3, FLOAT: 4, DOUBLE: 5, NULL: 6, TIMESTAMP: 7, LONGLONG: 8, INT24: 9,
    DATE: 10, TIME: 11, DATETIME: 12, YEAR: 13, ENUM: 247, SET: 248, TINY_BLOB: 249, MEDIUM_BLOB: 250,
    LONG_BLOB: 251, BLOB: 252, VAR_STRING: 253, STRING: 254,
  };
  // field flags
  const F = {
    NOT_NULL: 1, PRI_KEY: 2, UNIQUE_KEY: 4, MULTIPLE_KEY: 8, BLOB: 16, UNSIGNED: 32, ZEROFILL: 64, BINARY: 128,
    ENUM: 256, AUTO_INCREMENT: 512, TIMESTAMP: 1024, SET: 2048,
  };

  class SqlError extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  }

  // ---------------------------------------------------------------------------
  // Byte strings: everything on the wire is bytes; we keep them as JS strings
  // with one char per byte (latin1), which SQLite stores losslessly.
  // ---------------------------------------------------------------------------
  const bytesToStr = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return s;
  };
  const strToBytes = (s) => {
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i) & 0xff;
    return u8;
  };

  // ---------------------------------------------------------------------------
  // Tokenizer for the MySQL dialect
  // ---------------------------------------------------------------------------
  // token: { t: 'ws'|'str'|'num'|'id'|'qid'|'op'|'var'|'hex', v, raw }
  function tokenize(sql) {
    const out = [];
    let i = 0;
    const n = sql.length;
    while (i < n) {
      const c = sql[i];
      const start = i;
      if (/\s/.test(c)) { while (i < n && /\s/.test(sql[i])) i++; out.push({ t: 'ws', v: ' ', raw: sql.slice(start, i) }); continue; }
      if (c === '#' || (c === '-' && sql[i + 1] === '-' && (sql[i + 2] === ' ' || sql[i + 2] === '\t' || sql[i + 2] === '\n' || i + 2 >= n))) {
        while (i < n && sql[i] !== '\n') i++;
        out.push({ t: 'ws', v: ' ', raw: sql.slice(start, i) });
        continue;
      }
      if (c === '/' && sql[i + 1] === '*') {
        if (sql[i + 2] === '!') {
          // MySQL executable comment /*! ... */ -- its content is SQL
          let j = i + 3;
          while (j < n && /\d/.test(sql[j])) j++;
          const end = sql.indexOf('*/', j);
          const inner = sql.slice(j, end < 0 ? n : end);
          out.push(...tokenize(inner));
          i = end < 0 ? n : end + 2;
          continue;
        }
        const end = sql.indexOf('*/', i + 2);
        i = end < 0 ? n : end + 2;
        out.push({ t: 'ws', v: ' ', raw: sql.slice(start, i) });
        continue;
      }
      if (c === "'" || c === '"') {
        let v = '';
        i++;
        while (i < n) {
          const d = sql[i];
          if (d === '\\' && i + 1 < n) {
            const e = sql[i + 1];
            v += ({ '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a', '%': '\\%', _: '\\_' })[e] ?? e;
            i += 2;
            continue;
          }
          if (d === c) {
            if (sql[i + 1] === c) { v += c; i += 2; continue; }
            i++;
            break;
          }
          v += d;
          i++;
        }
        out.push({ t: 'str', v, raw: sql.slice(start, i) });
        continue;
      }
      if (c === '`') {
        const end = sql.indexOf('`', i + 1);
        const v = sql.slice(i + 1, end < 0 ? n : end);
        i = end < 0 ? n : end + 1;
        out.push({ t: 'qid', v, raw: sql.slice(start, i) });
        continue;
      }
      if (c === '0' && (sql[i + 1] === 'x' || sql[i + 1] === 'X') && /[0-9a-fA-F]/.test(sql[i + 2] || '')) {
        i += 2;
        while (i < n && /[0-9a-fA-F]/.test(sql[i])) i++;
        out.push({ t: 'hex', v: sql.slice(start + 2, i), raw: sql.slice(start, i) });
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        while (i < n && /[0-9]/.test(sql[i])) i++;
        if (sql[i] === '.' ) { i++; while (i < n && /[0-9]/.test(sql[i])) i++; }
        if ((sql[i] === 'e' || sql[i] === 'E') && /[-+0-9]/.test(sql[i + 1] || '')) {
          i++; if (sql[i] === '-' || sql[i] === '+') i++;
          while (i < n && /[0-9]/.test(sql[i])) i++;
        }
        // identifiers may start with digits in MySQL (e.g. 1abc)
        if (i < n && /[A-Za-z_$]/.test(sql[i])) {
          while (i < n && /[A-Za-z0-9_$]/.test(sql[i])) i++;
          out.push({ t: 'id', v: sql.slice(start, i), raw: sql.slice(start, i) });
          continue;
        }
        out.push({ t: 'num', v: sql.slice(start, i), raw: sql.slice(start, i) });
        continue;
      }
      if (/[A-Za-z_$\x80-\xff]/.test(c)) {
        while (i < n && /[A-Za-z0-9_$\x80-\xff]/.test(sql[i])) i++;
        out.push({ t: 'id', v: sql.slice(start, i), raw: sql.slice(start, i) });
        continue;
      }
      if (c === '@') {
        i++;
        if (sql[i] === '@') i++;
        while (i < n && /[A-Za-z0-9_.$]/.test(sql[i])) i++;
        out.push({ t: 'var', v: sql.slice(start, i), raw: sql.slice(start, i) });
        continue;
      }
      const three = sql.substr(i, 3);
      const two = sql.substr(i, 2);
      if (three === '<=>') { i += 3; out.push({ t: 'op', v: '<=>', raw: three }); continue; }
      if (['<=', '>=', '<>', '!=', '||', '&&', '<<', '>>', ':='].includes(two)) { i += 2; out.push({ t: 'op', v: two, raw: two }); continue; }
      i++;
      out.push({ t: 'op', v: c, raw: c });
    }
    return out;
  }

  const isWs = (t) => t && t.t === 'ws';
  const kw = (t) => (t && t.t === 'id' ? t.v.toUpperCase() : null);
  const sig = (toks) => toks.filter((t) => !isWs(t));
  const rawOf = (toks) => toks.map((t) => t.raw).join('');

  function splitTopLevel(toks, sepOp = ',') {
    const parts = [];
    let cur = [];
    let depth = 0;
    for (const t of toks) {
      if (t.t === 'op' && t.v === '(') depth++;
      if (t.t === 'op' && t.v === ')') depth--;
      if (depth === 0 && t.t === 'op' && t.v === sepOp) { parts.push(cur); cur = []; continue; }
      cur.push(t);
    }
    parts.push(cur);
    return parts;
  }
  function trimWs(toks) {
    let a = 0, b = toks.length;
    while (a < b && isWs(toks[a])) a++;
    while (b > a && isWs(toks[b - 1])) b--;
    return toks.slice(a, b);
  }
  function matchParen(toks, i) {
    let depth = 0;
    for (let j = i; j < toks.length; j++) {
      if (toks[j].t === 'op' && toks[j].v === '(') depth++;
      if (toks[j].t === 'op' && toks[j].v === ')') { depth--; if (depth === 0) return j; }
    }
    return -1;
  }
  function nextSig(toks, i) { for (let j = i; j < toks.length; j++) if (!isWs(toks[j])) return j; return -1; }

  // SQLite literal for a byte string
  function sqlStr(v) {
    if (v.indexOf('\0') >= 0) {
      // strings with NUL bytes travel as BLOBs (sql.js reads TEXT as C strings)
      let hex = '';
      for (let i = 0; i < v.length; i++) hex += (v.charCodeAt(i) & 0xff).toString(16).padStart(2, '0');
      return "X'" + hex + "'";
    }
    return "'" + v.replace(/'/g, "''") + "'";
  }
  const qid = (name) => '"' + String(name).replace(/"/g, '""') + '"';
  const identName = (t) => (t.t === 'qid' ? t.v : t.v);

  // Functions renamed because the name is an SQLite keyword or has different semantics
  const FN_RENAME = {
    LEFT: 'my_left', RIGHT: 'my_right', IF: 'my_if', CONCAT: 'my_concat', REPLACE: 'replace', MOD: 'my_mod',
    CURRENT_TIMESTAMP: 'now', CURRENT_DATE: 'curdate', CURRENT_TIME: 'curtime', GLOB: 'my_glob',
    ROUND: 'my_round', TRUNCATE: 'my_truncate', RAND: 'my_rand', LENGTH: 'my_length', HEX: 'my_hex',
  };
  const NILADIC = { CURRENT_TIMESTAMP: 'now()', CURRENT_DATE: 'curdate()', CURRENT_TIME: 'curtime()', LOCALTIME: 'now()', NOW: null };
  const INTERVAL_UNITS = ['SECOND', 'MINUTE', 'HOUR', 'DAY', 'MONTH', 'YEAR', 'MINUTE_SECOND', 'HOUR_MINUTE', 'DAY_HOUR', 'YEAR_MONTH', 'HOUR_SECOND', 'DAY_MINUTE', 'DAY_SECOND', 'WEEK', 'QUARTER'];

  // Render tokens as SQLite SQL (general expression-level translation)
  const WORDISH = { id: 1, num: 1, qid: 1, str: 1, hex: 1, var: 1 };
  function render(toks) {
    let out = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      // token lists may have had their whitespace stripped: keep words apart
      if (i > 0 && WORDISH[t.t] && WORDISH[toks[i - 1].t]) out += ' ';
      switch (t.t) {
        case 'ws': out += ' '; break;
        case 'str': {
          out += sqlStr(t.v);
          // MySQL's LIKE escape character is backslash by default
          let back = i - 1;
          while (back >= 0 && isWs(toks[back])) back--;
          if (back >= 0 && kw(toks[back]) === 'LIKE' && t.v.indexOf('\\') >= 0) {
            const nx = nextSig(toks, i + 1);
            if (nx < 0 || kw(toks[nx]) !== 'ESCAPE') out += " ESCAPE '\\'";
          }
          break;
        }
        case 'qid': out += qid(t.v); break;
        case 'hex': out += "CAST(X'" + (t.v.length % 2 ? '0' + t.v : t.v) + "' AS TEXT)"; break;
        case 'num': out += t.v; break;
        case 'var': out += 'NULL'; break;
        case 'op':
          if (t.v === '||') out += ' OR ';
          else if (t.v === '&&') out += ' AND ';
          else if (t.v === '<=>') out += ' IS ';
          else if (t.v === '!' && !(toks[i + 1] && toks[i + 1].t === 'op' && toks[i + 1].v === '=')) out += ' NOT ';
          else out += t.v;
          break;
        case 'id': {
          const K = t.v.toUpperCase();
          const nx = nextSig(toks, i + 1);
          const isCall = nx >= 0 && toks[nx].t === 'op' && toks[nx].v === '(';
          if (K === 'INTERVAL' && !isCall) {
            // INTERVAL expr unit  -> handled by DATE_ADD rewriting; standalone "d + INTERVAL n DAY"
            out += 'INTERVAL';
            break;
          }
          if (!isCall && NILADIC[K]) { out += NILADIC[K]; break; }
          if (K === 'DIV') { out += '/'; break; }
          if (K === 'MOD' && !isCall) { out += '%'; break; }
          if ((K === 'REGEXP' || K === 'RLIKE') && !isCall) { out += 'REGEXP'; break; }
          if (K === 'BINARY' && !isCall) { break; }
          if (['STRAIGHT_JOIN', 'SQL_SMALL_RESULT', 'SQL_BIG_RESULT', 'SQL_BUFFER_RESULT', 'HIGH_PRIORITY', 'SQL_NO_CACHE', 'SQL_CACHE', 'LOW_PRIORITY', 'DELAYED', 'QUICK'].includes(K)) {
            out += K === 'STRAIGHT_JOIN' && isJoinContext(toks, i) ? 'JOIN' : '';
            break;
          }
          if (isCall && FN_RENAME[K]) { out += FN_RENAME[K]; break; }
          out += t.v;
          break;
        }
        default: out += t.raw;
      }
    }
    return out;
  }
  function isJoinContext(toks, i) {
    let b = i - 1;
    while (b >= 0 && isWs(toks[b])) b--;
    return b >= 0 && !(kw(toks[b]) === 'SELECT');
  }

  // DATE_ADD(d, INTERVAL n unit) / DATE_SUB / ADDDATE / SUBDATE  and  expr +/- INTERVAL n unit
  function rewriteIntervals(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const K = kw(t);
      if ((K === 'DATE_ADD' || K === 'DATE_SUB' || K === 'ADDDATE' || K === 'SUBDATE')) {
        const p = nextSig(toks, i + 1);
        if (p >= 0 && toks[p].v === '(') {
          const e = matchParen(toks, p);
          const args = splitTopLevel(toks.slice(p + 1, e));
          if (args.length === 2) {
            const a2 = sig(args[1]);
            if (kw(a2[0]) === 'INTERVAL') {
              const unit = kw(a2[a2.length - 1]);
              const expr = trimWs(args[1]).slice(1, -1);
              const sign = (K === 'DATE_SUB' || K === 'SUBDATE') ? '-1' : '1';
              out.push({ t: 'id', v: 'my_date_add', raw: 'my_date_add' }, { t: 'op', v: '(', raw: '(' },
                ...rewriteIntervals(args[0]), { t: 'op', v: ',', raw: ',' }, { t: 'op', v: '(', raw: '(' },
                ...rewriteIntervals(expr), { t: 'op', v: ')', raw: ')' }, { t: 'op', v: '*', raw: '*' },
                { t: 'num', v: sign, raw: sign }, { t: 'op', v: ',', raw: ',' },
                { t: 'str', v: unit || 'DAY', raw: '' }, { t: 'op', v: ')', raw: ')' });
              i = e;
              continue;
            }
            // ADDDATE(d, n) means days
            if (K === 'ADDDATE' || K === 'SUBDATE') {
              const sign = K === 'SUBDATE' ? '-1' : '1';
              out.push({ t: 'id', v: 'my_date_add', raw: 'my_date_add' }, { t: 'op', v: '(', raw: '(' },
                ...rewriteIntervals(args[0]), { t: 'op', v: ',', raw: ',' }, { t: 'op', v: '(', raw: '(' },
                ...rewriteIntervals(args[1]), { t: 'op', v: ')', raw: ')' }, { t: 'op', v: '*', raw: '*' },
                { t: 'num', v: sign, raw: sign }, { t: 'op', v: ',', raw: ',' }, { t: 'str', v: 'DAY', raw: '' }, { t: 'op', v: ')', raw: ')' });
              i = e;
              continue;
            }
          }
        }
      }
      out.push(t);
    }
    // expr + INTERVAL n UNIT  (only the simple "<operand> +/- INTERVAL <num|str> UNIT" form)
    const res = [];
    for (let i = 0; i < out.length; i++) {
      const t = out[i];
      if (kw(t) === 'INTERVAL' && res.length) {
        let b = res.length - 1;
        while (b >= 0 && isWs(res[b])) b--;
        const opTok = res[b];
        if (opTok && opTok.t === 'op' && (opTok.v === '+' || opTok.v === '-')) {
          const v = nextSig(out, i + 1), u = v >= 0 ? nextSig(out, v + 1) : -1;
          if (v >= 0 && u >= 0 && INTERVAL_UNITS.includes(kw(out[u]))) {
            // find the left operand (one token or a parenthesised group) before opTok
            let a = b - 1;
            while (a >= 0 && isWs(res[a])) a--;
            let startL = a;
            if (res[a] && res[a].t === 'op' && res[a].v === ')') {
              let depth = 0;
              for (let k = a; k >= 0; k--) {
                if (res[k].t === 'op' && res[k].v === ')') depth++;
                if (res[k].t === 'op' && res[k].v === '(') { depth--; if (depth === 0) { startL = k; break; } }
              }
              let f = startL - 1;
              while (f >= 0 && isWs(res[f])) f--;
              if (f >= 0 && res[f].t === 'id') startL = f;
            }
            const left = res.splice(startL);
            const lhs = left.slice(0, left.length - (left.length - (b - startL)));
            const sign = opTok.v === '-' ? '-1' : '1';
            res.push({ t: 'id', v: 'my_date_add', raw: 'my_date_add' }, { t: 'op', v: '(', raw: '(' }, ...lhs,
              { t: 'op', v: ',', raw: ',' }, { t: 'op', v: '(', raw: '(' }, out[v], { t: 'op', v: ')', raw: ')' },
              { t: 'op', v: '*', raw: '*' }, { t: 'num', v: sign, raw: sign }, { t: 'op', v: ',', raw: ',' },
              { t: 'str', v: kw(out[u]), raw: '' }, { t: 'op', v: ')', raw: ')' });
            i = u;
            continue;
          }
        }
      }
      res.push(t);
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // Date/time helpers (MySQL semantics, local time of the server)
  // ---------------------------------------------------------------------------
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function fmtDateTime(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function parseMyDate(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      // YYYYMMDDHHMMSS or YYYYMMDD numbers
      const s = String(Math.trunc(v));
      if (s.length === 14) return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
      if (s.length === 8) return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
      return null;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{2,4})[-/.:](\d{1,2})[-/.:](\d{1,2})(?:[ T](\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?/);
    if (m) {
      let y = +m[1];
      if (m[1].length === 2) y += y < 70 ? 2000 : 1900;
      return new Date(y, +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }
    m = s.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return null;
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dateFormat(d, fmt) {
    const ord = (n) => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    const h12 = d.getHours() % 12 || 12;
    const yday = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;
    const map = {
      a: DAYS[d.getDay()].slice(0, 3), b: MONTHS[d.getMonth()].slice(0, 3), c: String(d.getMonth() + 1), D: ord(d.getDate()),
      d: pad(d.getDate()), e: String(d.getDate()), f: '000000', H: pad(d.getHours()), h: pad(h12), I: pad(h12), i: pad(d.getMinutes()),
      j: pad(yday, 3), k: String(d.getHours()), l: String(h12), M: MONTHS[d.getMonth()], m: pad(d.getMonth() + 1),
      p: d.getHours() < 12 ? 'AM' : 'PM', r: pad(h12) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM'),
      S: pad(d.getSeconds()), s: pad(d.getSeconds()), T: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()),
      U: pad(Math.floor((yday - 1 + new Date(d.getFullYear(), 0, 1).getDay()) / 7)), W: DAYS[d.getDay()], w: String(d.getDay()),
      Y: String(d.getFullYear()), y: pad(d.getFullYear() % 100), '%': '%',
    };
    return String(fmt).replace(/%(.)/g, (m0, k) => (map[k] !== undefined ? map[k] : k));
  }
  function addInterval(d, n, unit) {
    const r = new Date(d.getTime());
    n = Number(n) || 0;
    switch (String(unit).toUpperCase()) {
      case 'SECOND': r.setSeconds(r.getSeconds() + n); break;
      case 'MINUTE': r.setMinutes(r.getMinutes() + n); break;
      case 'HOUR': r.setHours(r.getHours() + n); break;
      case 'WEEK': r.setDate(r.getDate() + 7 * n); break;
      case 'MONTH': r.setMonth(r.getMonth() + n); break;
      case 'QUARTER': r.setMonth(r.getMonth() + 3 * n); break;
      case 'YEAR': r.setFullYear(r.getFullYear() + n); break;
      default: r.setDate(r.getDate() + n);
    }
    return r;
  }
  // MySQL 3.23 PASSWORD() (the pre-4.1 hash)
  function oldPassword(pw) {
    let nr = 1345345333, add = 7, nr2 = 0x12345671;
    for (let i = 0; i < pw.length; i++) {
      const c = pw.charCodeAt(i);
      if (c === 32 || c === 9) continue;
      nr = (nr ^ ((((nr & 63) + add) * c) + Math.imul(nr, 256))) >>> 0;
      nr2 = (nr2 + ((Math.imul(nr2, 256) ^ nr) >>> 0)) >>> 0;
      add += c;
    }
    return ((nr & 0x7fffffff) >>> 0).toString(16).padStart(8, '0') + ((nr2 & 0x7fffffff) >>> 0).toString(16).padStart(8, '0');
  }
  // MD5 over byte strings
  function md5(str) {
    const K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const bytes = strToBytes(str);
    const len = bytes.length, nblk = ((len + 8) >> 6) + 1;
    const w = new Uint32Array(nblk * 16);
    for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[len >> 2] |= 0x80 << ((len % 4) * 8);
    w[nblk * 16 - 2] = (len * 8) >>> 0;
    w[nblk * 16 - 1] = Math.floor(len / 0x20000000);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < w.length; o += 16) {
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const tmp = d; d = c; c = b;
        const x = (a + f + K[i] + w[o + g]) >>> 0;
        const s = S[(i >> 4) * 4 + (i % 4)];
        b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0;
        a = tmp;
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    return [a0, b0, c0, d0].map((v) => [0, 8, 16, 24].map((s) => ((v >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
  }

  // Format a value the way MySQL 3.23 sends it (text protocol)
  function fmtNumber(v) {
    if (Number.isInteger(v)) return String(v);
    if (!isFinite(v)) return String(v);
    let s = v.toPrecision(15);
    if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  // ---------------------------------------------------------------------------
  // Column metadata (the MySQL view of a table), stored in __phpsim_meta
  // ---------------------------------------------------------------------------
  const INT_TYPES = { TINYINT: [T.TINY, 4, -128, 127, 255], SMALLINT: [T.SHORT, 6, -32768, 32767, 65535], MEDIUMINT: [T.INT24, 9, -8388608, 8388607, 16777215],
    INT: [T.LONG, 11, -2147483648, 2147483647, 4294967295], INTEGER: [T.LONG, 11, -2147483648, 2147483647, 4294967295], BIGINT: [T.LONGLONG, 20, -9223372036854775808, 9223372036854775807, 18446744073709551615] };

  function parseColumnDef(toks) {
    // toks: significant tokens of "name type ... attributes"
    const col = { name: identName(toks[0]), notNull: false, def: undefined, autoInc: false, unsigned: false, zerofill: false, binary: false, key: '', comment: '' };
    let i = 1;
    let type = (kw(toks[i]) || 'CHAR');
    i++;
    if (type === 'DOUBLE' && kw(toks[i]) === 'PRECISION') i++;
    if (type === 'NATIONAL') { type = kw(toks[i]); i++; }
    if (type === 'CHARACTER') { type = 'CHAR'; if (kw(toks[i]) === 'VARYING') { type = 'VARCHAR'; i++; } }
    let args = null;
    if (toks[i] && toks[i].v === '(') {
      const e = matchParen(toks, i);
      args = splitTopLevel(toks.slice(i + 1, e)).map((a) => a.filter((t) => !isWs(t)));
      i = e + 1;
    }
    col.baseType = type;
    if (type === 'BOOL' || type === 'BOOLEAN') { col.baseType = 'TINYINT'; args = [[{ t: 'num', v: '1' }]]; }
    if (type === 'DEC' || type === 'NUMERIC' || type === 'FIXED') col.baseType = 'DECIMAL';
    if (type === 'REAL') col.baseType = 'DOUBLE';
    if (type === 'INTEGER') col.baseType = 'INT';
    if (col.baseType === 'ENUM' || col.baseType === 'SET') {
      col.values = (args || []).map((a) => (a[0] ? a[0].v : ''));
    } else if (args) {
      col.length = parseInt(args[0] && args[0][0] ? args[0][0].v : '', 10);
      if (args[1] && args[1][0]) col.decimals = parseInt(args[1][0].v, 10);
    }
    for (; i < toks.length; i++) {
      const K = kw(toks[i]);
      if (K === 'UNSIGNED') col.unsigned = true;
      else if (K === 'ZEROFILL') { col.zerofill = true; col.unsigned = true; }
      else if (K === 'BINARY') col.binary = true;
      else if (K === 'NOT' && kw(toks[i + 1]) === 'NULL') { col.notNull = true; i++; }
      else if (K === 'NULL') col.notNull = false;
      else if (K === 'DEFAULT') {
        const t = toks[++i];
        if (t.t === 'op' && (t.v === '-' || t.v === '+')) { col.def = t.v + toks[++i].v; }
        else col.def = kw(t) === 'NULL' ? null : t.v;
      } else if (K === 'AUTO_INCREMENT') { col.autoInc = true; col.notNull = true; }
      else if (K === 'PRIMARY') { col.key = 'PRI'; col.notNull = true; if (kw(toks[i + 1]) === 'KEY') i++; }
      else if (K === 'KEY') { if (!col.key) col.key = 'PRI'; col.notNull = true; }
      else if (K === 'UNIQUE') { if (col.key !== 'PRI') col.key = 'UNI'; if (kw(toks[i + 1]) === 'KEY') i++; }
      else if (K === 'COMMENT') { col.comment = toks[++i] ? toks[i].v : ''; }
      else if (K === 'REFERENCES') break;
      else if (K === 'CHARACTER' || K === 'CHARSET' || K === 'COLLATE') { i++; if (kw(toks[i]) === 'SET') i++; }
    }
    finishColumn(col);
    return col;
  }

  function finishColumn(col) {
    const bt = col.baseType;
    let display;
    if (INT_TYPES[bt]) {
      const info = INT_TYPES[bt];
      col.type = info[0];
      if (!col.length) col.length = bt === 'BIGINT' ? 20 : info[1] - (col.unsigned ? 1 : 0);
      display = bt.toLowerCase().replace('integer', 'int') + '(' + col.length + ')';
      col.kind = 'int';
    } else if (bt === 'FLOAT' || bt === 'DOUBLE') {
      col.type = bt === 'FLOAT' ? T.FLOAT : T.DOUBLE;
      display = bt.toLowerCase() + (col.length ? '(' + col.length + ',' + (col.decimals || 0) + ')' : '');
      if (!col.length) col.length = bt === 'FLOAT' ? 12 : 22;
      if (col.decimals === undefined) col.decimals = 31;
      col.kind = 'real';
    } else if (bt === 'DECIMAL') {
      col.type = T.DECIMAL;
      if (!col.length) col.length = 10;
      if (col.decimals === undefined) col.decimals = 0;
      display = 'decimal(' + col.length + ',' + col.decimals + ')';
      col.length = col.length + (col.decimals ? 1 : 0) + 1;
      col.kind = 'decimal';
    } else if (bt === 'DATE') { col.type = T.DATE; col.length = 10; display = 'date'; col.kind = 'date'; }
    else if (bt === 'DATETIME') { col.type = T.DATETIME; col.length = 19; display = 'datetime'; col.kind = 'datetime'; }
    else if (bt === 'TIME') { col.type = T.TIME; col.length = 8; display = 'time'; col.kind = 'time'; }
    else if (bt === 'YEAR') { col.type = T.YEAR; col.length = col.length || 4; display = 'year(' + col.length + ')'; col.kind = 'year'; }
    else if (bt === 'TIMESTAMP') {
      col.type = T.TIMESTAMP;
      col.length = col.length && [2, 4, 6, 8, 10, 12, 14].includes(col.length) ? col.length : 14;
      display = 'timestamp(' + col.length + ')';
      col.kind = 'timestamp';
      col.unsigned = true; col.zerofill = true;
    } else if (bt === 'CHAR' || bt === 'VARCHAR') {
      col.type = bt === 'CHAR' ? T.STRING : T.VAR_STRING;
      if (!col.length && col.length !== 0) col.length = 1;
      display = bt.toLowerCase() + '(' + col.length + ')' + (col.binary ? ' binary' : '');
      col.kind = 'string';
    } else if (/^(TINY|MEDIUM|LONG)?(BLOB|TEXT)$/.test(bt)) {
      const m = bt.match(/^(TINY|MEDIUM|LONG)?(BLOB|TEXT)$/);
      col.type = { TINY: T.TINY_BLOB, MEDIUM: T.MEDIUM_BLOB, LONG: T.LONG_BLOB }[m[1]] || T.BLOB;
      col.length = { TINY: 255, MEDIUM: 16777215, LONG: 4294967295 }[m[1]] || 65535;
      col.isBlob = true;
      if (m[2] === 'BLOB') col.binary = true;
      display = bt.toLowerCase();
      col.kind = 'string';
    } else if (bt === 'ENUM' || bt === 'SET') {
      col.type = T.STRING;
      col.length = bt === 'ENUM' ? Math.max(1, ...col.values.map((v) => v.length)) : col.values.join(',').length;
      display = bt.toLowerCase() + '(' + col.values.map((v) => "'" + v.replace(/'/g, "''") + "'").join(',') + ')';
      col.kind = bt === 'ENUM' ? 'enum' : 'set';
    } else {
      col.type = T.STRING; col.length = col.length || 1; display = bt.toLowerCase(); col.kind = 'string';
    }
    if (col.unsigned && !['timestamp'].includes(col.kind)) display += ' unsigned';
    if (col.zerofill && col.kind !== 'timestamp') display += ' zerofill';
    col.display = display;
    // MySQL 3.23: NOT NULL columns without a default get an implicit one
    if (col.def === undefined) {
      if (col.autoInc) col.def = null;
      else if (col.kind === 'timestamp') col.def = null;
      else if (col.notNull) col.def = implicitDefault(col);
      else col.def = null;
    }
  }

  function implicitDefault(col) {
    switch (col.kind) {
      case 'int': case 'real': return '0';
      case 'decimal': return col.decimals ? '0.' + '0'.repeat(col.decimals) : '0';
      case 'date': return '0000-00-00';
      case 'datetime': return '0000-00-00 00:00:00';
      case 'time': return '00:00:00';
      case 'year': return '0000';
      case 'enum': return col.values[0] || '';
      default: return '';
    }
  }

  function sqliteColumnSql(col) {
    let s = qid(col.name) + ' ';
    if (col.autoInc) return s + 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const aff = { int: 'INTEGER', real: 'REAL', decimal: 'NUMERIC', year: 'INTEGER' }[col.kind] || (col.isBlob && col.binary ? 'BLOB' : 'TEXT');
    s += aff;
    if (col.notNull) s += ' NOT NULL';
    if (col.def !== null && col.def !== undefined) s += ' DEFAULT ' + sqlStr(String(col.def));
    if ((col.kind === 'string' || col.kind === 'enum' || col.kind === 'set') && !col.binary) s += ' COLLATE NOCASE';
    return s;
  }

  // Normalise a value stored in a column (runs inside triggers)
  function normalize(kind, v, len, extra) {
    if (v === null || v === undefined) return v;
    switch (kind) {
      case 'int': {
        let n;
        if (typeof v === 'number') n = Math.round(v);
        else { const m = String(v).trim().match(/^[-+]?\d+(\.\d*)?([eE][-+]?\d+)?/); n = m ? Math.round(parseFloat(m[0])) : 0; }
        const info = INT_TYPES[extra.bt] || INT_TYPES.INT;
        const lo = extra.unsigned ? 0 : info[2], hi = extra.unsigned ? info[4] : info[3];
        if (n < lo) n = lo;
        if (n > hi) n = hi;
        return n;
      }
      case 'real': case 'decimal': {
        if (typeof v === 'number') return kind === 'decimal' && extra.decimals !== undefined ? Number(v.toFixed(extra.decimals)) : v;
        const m = String(v).trim().match(/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/);
        const n = m ? parseFloat(m[0]) : 0;
        return kind === 'decimal' && extra.decimals !== undefined ? Number(n.toFixed(extra.decimals)) : n;
      }
      case 'string': {
        if (v instanceof Uint8Array) return len && v.length > len ? v.slice(0, len) : v;
        let s = typeof v === 'number' ? fmtNumber(v) : String(v);
        if (len && s.length > len) s = s.slice(0, len);
        if (extra.fixed) s = s.replace(/ +$/, '');
        return s;
      }
      case 'enum': {
        const s = typeof v === 'number' ? extra.values[v - 1] ?? '' : String(v);
        const hit = extra.values.find((x) => x.toLowerCase() === s.toLowerCase());
        return hit !== undefined ? hit : '';
      }
      case 'set': {
        const parts = String(v).split(',').map((x) => x.trim()).filter(Boolean);
        return extra.values.filter((x) => parts.some((p) => p.toLowerCase() === x.toLowerCase())).join(',');
      }
      case 'date': case 'datetime': case 'timestamp': case 'time': case 'year': {
        if (kind === 'year') { const n = parseInt(v, 10); if (isNaN(n)) return 0; return n < 70 ? n + 2000 : n < 100 ? n + 1900 : (n >= 1901 && n <= 2155 ? n : 0); }
        if (kind === 'time') {
          const m = String(v).match(/^(-?\d+):(\d{1,2})(?::(\d{1,2}))?/);
          return m ? m[1].padStart(2, '0') + ':' + pad(m[2]) + ':' + pad(m[3] || 0) : '00:00:00';
        }
        const d = parseMyDate(v);
        if (!d || isNaN(d.getTime())) {
          if (/^0000-00-00/.test(String(v))) return kind === 'date' ? '0000-00-00' : '0000-00-00 00:00:00';
          return kind === 'date' ? '0000-00-00' : kind === 'timestamp' ? '0000-00-00 00:00:00' : '0000-00-00 00:00:00';
        }
        return kind === 'date' ? fmtDateTime(d).slice(0, 10) : fmtDateTime(d);
      }
      default: return v;
    }
  }

  // ---------------------------------------------------------------------------
  // The server
  // ---------------------------------------------------------------------------
  class MysqlServer {
    constructor(SQL) {
      this.SQL = SQL;
      this.dbs = new Map();          // name -> sql.js Database
      this.loaded = new Map();       // name -> bytes we loaded or last exported (to detect outside changes)
      this.dirty = new Set();
      this.nextThread = 1;
      this.started = Date.now();
      this.questions = 0;
      this.conns = new Set();
    }

    // --- storage ------------------------------------------------------------
    // files: { '/var/lib/mysql/<db>.sqlite': Uint8Array|{data} }
    syncFrom(files) {
      const seen = new Set();
      for (const [path, f] of Object.entries(files || {})) {
        const m = path.match(/^\/var\/lib\/mysql\/([^/]+)\.sqlite$/);
        if (!m || !f) continue;
        const name = m[1];
        const bytes = f.data !== undefined ? f.data : f;
        seen.add(name);
        const prev = this.loaded.get(name);
        if (this.dbs.has(name) && prev && (prev === bytes || (prev.length === bytes.length && prev.every((b, i) => b === bytes[i])))) continue;
        if (this.dbs.has(name)) try { this.dbs.get(name).close(); } catch (e) {}
        this.dbs.set(name, this.openDb(bytes));
        this.loaded.set(name, bytes);
      }
      // databases removed from disk go away
      for (const name of [...this.dbs.keys()]) {
        if (!seen.has(name) && this.loaded.has(name)) { try { this.dbs.get(name).close(); } catch (e) {} this.dbs.delete(name); this.loaded.delete(name); }
      }
      if (!this.dbs.size) this.initDefaultDatabases();
    }
    exportTo(out) {
      for (const name of this.dirty) {
        const db = this.dbs.get(name);
        const path = '/var/lib/mysql/' + name + '.sqlite';
        if (!db) { delete out[path]; continue; }
        const bytes = db.export();
        // sql.js reopens the database inside export(), dropping custom functions
        this.registerFunctions(db);
        this.loaded.set(name, bytes);
        out[path] = { data: bytes, mtime: Date.now() };
      }
      for (const name of this.dbs.keys()) {
        const path = '/var/lib/mysql/' + name + '.sqlite';
        if (!(path in out) && this.loaded.has(name)) out[path] = { data: this.loaded.get(name), mtime: Date.now() };
      }
      this.dirty.clear();
      return out;
    }
    initDefaultDatabases() {
      // A fresh MySQL 3.23 install has the `mysql` grant database and `test`.
      const mysql = this.createDb('mysql');
      this.runScript(mysql, [
        "CREATE TABLE user (Host char(60) binary DEFAULT '' NOT NULL, User char(16) binary DEFAULT '' NOT NULL, Password char(16) binary DEFAULT '' NOT NULL, Select_priv enum('N','Y') DEFAULT 'N' NOT NULL, Insert_priv enum('N','Y') DEFAULT 'N' NOT NULL, Update_priv enum('N','Y') DEFAULT 'N' NOT NULL, Delete_priv enum('N','Y') DEFAULT 'N' NOT NULL, PRIMARY KEY Host (Host,User))",
        "INSERT INTO user VALUES ('localhost','root','','Y','Y','Y','Y'),('phpsim','root','','Y','Y','Y','Y'),('localhost','','','N','N','N','N'),('phpsim','','','N','N','N','N')",
        "CREATE TABLE db (Host char(60) binary DEFAULT '' NOT NULL, Db char(64) binary DEFAULT '' NOT NULL, User char(16) binary DEFAULT '' NOT NULL, PRIMARY KEY Host (Host,Db,User))",
        "INSERT INTO db VALUES ('%','test',''),('%','test\\\\_%','')",
        "CREATE TABLE host (Host char(60) binary DEFAULT '' NOT NULL, Db char(64) binary DEFAULT '' NOT NULL, PRIMARY KEY Host (Host,Db))",
        "CREATE TABLE func (name char(64) binary DEFAULT '' NOT NULL, ret tinyint(1) DEFAULT '0' NOT NULL, dl char(128) DEFAULT '' NOT NULL, type enum ('function','aggregate') NOT NULL, PRIMARY KEY (name))",
        "CREATE TABLE tables_priv (Host char(60) binary DEFAULT '' NOT NULL, Db char(64) binary DEFAULT '' NOT NULL, User char(16) binary DEFAULT '' NOT NULL, Table_name char(60) binary DEFAULT '' NOT NULL, PRIMARY KEY (Host,Db,User,Table_name))",
        "CREATE TABLE columns_priv (Host char(60) binary DEFAULT '' NOT NULL, Db char(64) binary DEFAULT '' NOT NULL, User char(16) binary DEFAULT '' NOT NULL, Table_name char(64) binary DEFAULT '' NOT NULL, Column_name char(64) binary DEFAULT '' NOT NULL, PRIMARY KEY (Host,Db,User,Table_name,Column_name))",
      ]);
      this.createDb('test');
    }
    runScript(name, stmts) {
      const conn = new Connection(this, { internal: true });
      conn.db = name;
      for (const s of stmts) conn.execute(s);
    }
    openDb(bytes) {
      const db = bytes ? new this.SQL.Database(bytes) : new this.SQL.Database();
      this.registerFunctions(db);
      db.run('CREATE TABLE IF NOT EXISTS __phpsim_meta (tbl TEXT PRIMARY KEY, def TEXT)');
      return db;
    }
    createDb(name) {
      const db = this.openDb(null);
      this.dbs.set(name, db);
      this.dirty.add(name);
      return name;
    }
    dropDb(name) {
      const db = this.dbs.get(name);
      if (db) try { db.close(); } catch (e) {}
      this.dbs.delete(name);
      this.dirty.add(name);
    }

    registerFunctions(db) {
      const srv = this;
      const reg = (name, fn, arities) => {
        for (const n of arities || [fn.length]) {
          const args = Array.from({ length: n }, (_, i) => 'a' + i).join(',');
          // sql.js registers with func.length arguments
          const wrapped = new Function('f', 'return function(' + args + '){ return f.apply(null, arguments); }')(fn);
          db.create_function(name, wrapped);
        }
      };
      const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
      const now = () => fmtDateTime(new Date());
      reg('now', now); reg('sysdate', now);
      reg('curdate', () => fmtDateTime(new Date()).slice(0, 10));
      reg('current_date', () => fmtDateTime(new Date()).slice(0, 10));
      reg('curtime', () => fmtDateTime(new Date()).slice(11));
      reg('unix_timestamp', function (d) {
        if (arguments.length === 0) return Math.floor(Date.now() / 1000);
        const x = parseMyDate(d);
        return x ? Math.floor(x.getTime() / 1000) : 0;
      }, [0, 1]);
      reg('from_unixtime', function (t, fmt) {
        const d = new Date(Number(t) * 1000);
        return arguments.length > 1 ? dateFormat(d, fmt) : fmtDateTime(d);
      }, [1, 2]);
      reg('date_format', (d, fmt) => { const x = parseMyDate(d); return x ? dateFormat(x, fmt) : null; });
      reg('time_format', (d, fmt) => {
        const m = String(d).match(/(\d+):(\d+):(\d+)/);
        if (!m) return null;
        return dateFormat(new Date(2000, 0, 1, +m[1], +m[2], +m[3]), fmt);
      });
      reg('my_date_add', (d, n, unit) => {
        const x = parseMyDate(d);
        if (!x) return null;
        const r = addInterval(x, n, unit);
        const hasTime = /\d\d:\d\d/.test(String(d)) || !['DAY', 'WEEK', 'MONTH', 'YEAR', 'QUARTER', 'YEAR_MONTH'].includes(String(unit).toUpperCase());
        return hasTime ? fmtDateTime(r) : fmtDateTime(r).slice(0, 10);
      });
      const part = (fn) => (d) => { const x = parseMyDate(d); return x ? fn(x) : null; };
      reg('year', part((x) => x.getFullYear())); reg('month', part((x) => x.getMonth() + 1));
      reg('dayofmonth', part((x) => x.getDate())); reg('day', part((x) => x.getDate()));
      reg('dayofweek', part((x) => x.getDay() + 1)); reg('weekday', part((x) => (x.getDay() + 6) % 7));
      reg('dayofyear', part((x) => Math.floor((x - new Date(x.getFullYear(), 0, 1)) / 86400000) + 1));
      reg('hour', (d) => { const m = String(d).match(/(\d+):\d+(:\d+)?$/); return m ? +m[1] : (parseMyDate(d) || { getHours: () => null }).getHours(); });
      reg('minute', (d) => { const m = String(d).match(/:(\d+)(:\d+)?$/); return m ? +m[1] : null; });
      reg('second', (d) => { const m = String(d).match(/:\d+:(\d+)$/); return m ? +m[1] : 0; });
      reg('dayname', part((x) => DAYS[x.getDay()])); reg('monthname', part((x) => MONTHS[x.getMonth()]));
      reg('week', function (d) { const x = parseMyDate(d); if (!x) return null; const j = new Date(x.getFullYear(), 0, 1); return Math.floor(((x - j) / 86400000 + j.getDay()) / 7); }, [1, 2]);
      reg('to_days', part((x) => Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000) + 719528));
      reg('from_days', (n) => { const d = new Date((Number(n) - 719528) * 86400000); return d.toISOString().slice(0, 10); });
      reg('sec_to_time', (s) => { s = Number(s); const sign = s < 0 ? '-' : ''; s = Math.abs(s); return sign + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); });
      reg('time_to_sec', (t) => { const m = String(t).match(/(-?)(\d+):(\d+)(?::(\d+))?/); return m ? (m[1] ? -1 : 1) * (+m[2] * 3600 + +m[3] * 60 + +(m[4] || 0)) : 0; });
      reg('period_add', (p, n) => { p = Number(p); let y = Math.floor(p / 100), m = p % 100 + Number(n); y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return y * 100 + m; });
      const concat = function () { for (const a of arguments) if (a === null) return null; return Array.from(arguments).map((a) => (typeof a === 'number' ? fmtNumber(a) : String(a))).join(''); };
      reg('my_concat', concat, range(1, 32));
      reg('concat_ws', function (sep) {
        if (sep === null) return null;
        return Array.from(arguments).slice(1).filter((a) => a !== null).map((a) => (typeof a === 'number' ? fmtNumber(a) : String(a))).join(sep);
      }, range(2, 32));
      reg('my_if', (c, a, b) => (c && c !== '0' && Number(c) !== 0 ? a : b));
      reg('my_left', (s, n) => (s === null ? null : String(s).slice(0, Math.max(0, Number(n)))));
      reg('my_right', (s, n) => (s === null ? null : (Number(n) <= 0 ? '' : String(s).slice(-Number(n)))));
      reg('mid', (s, p, l) => (s === null ? null : String(s).substr(Number(p) - 1, l === undefined ? undefined : Number(l))), [2, 3]);
      reg('locate', function (sub, s, pos) { if (s === null || sub === null) return null; const i = String(s).toLowerCase().indexOf(String(sub).toLowerCase(), (pos || 1) - 1); return i + 1; }, [2, 3]);
      reg('position', (sub, s) => String(s).toLowerCase().indexOf(String(sub).toLowerCase()) + 1);
      reg('lcase', (s) => (s === null ? null : String(s).toLowerCase())); reg('ucase', (s) => (s === null ? null : String(s).toUpperCase()));
      reg('space', (n) => ' '.repeat(Math.max(0, Number(n))));
      reg('repeat', (s, n) => (s === null ? null : String(s).repeat(Math.max(0, Number(n)))));
      reg('reverse', (s) => (s === null ? null : String(s).split('').reverse().join('')));
      reg('lpad', (s, n, p) => { s = String(s); n = Number(n); if (s.length >= n) return s.slice(0, n); if (!p) return null; while (s.length < n) s = String(p) + s; return s.slice(s.length - n); });
      reg('rpad', (s, n, p) => { s = String(s); n = Number(n); if (s.length >= n) return s.slice(0, n); if (!p) return null; while (s.length < n) s += String(p); return s.slice(0, n); });
      reg('ascii', (s) => (s === null ? null : (String(s).charCodeAt(0) || 0)));
      reg('ord', (s) => (s === null ? null : (String(s).charCodeAt(0) || 0)));
      reg('my_length', (s) => (s === null ? null : s instanceof Uint8Array ? s.length : (typeof s === 'number' ? fmtNumber(s) : String(s)).length));
      reg('char_length', (s) => (s === null ? null : String(s).length)); reg('character_length', (s) => (s === null ? null : String(s).length));
      reg('octet_length', (s) => (s === null ? null : String(s).length));
      reg('md5', (s) => (s === null ? null : md5(typeof s === 'number' ? fmtNumber(s) : String(s))));
      reg('password', (s) => (s === null ? null : (String(s) === '' ? '' : oldPassword(String(s)))));
      reg('encrypt', (s) => (s === null ? null : 'ab' + md5(String(s)).slice(0, 11)), [1, 2]);
      reg('database', () => srv._currentDb || null);
      reg('user', () => 'root@localhost'); reg('system_user', () => 'root@localhost'); reg('session_user', () => 'root@localhost');
      reg('version', () => SERVER_VERSION + '-log');
      reg('connection_id', () => srv._currentThread || 1);
      reg('last_insert_id', function (v) { if (arguments.length) { srv._lastInsertId = Number(v); return v; } return srv._lastInsertId || 0; }, [0, 1]);
      reg('found_rows', () => srv._foundRows || 0);
      reg('my_rand', function (seed) {
        if (arguments.length && seed !== null) { srv._rand = mysqlRand(Number(seed)); }
        if (!srv._rand) srv._rand = mysqlRand(Math.floor(Date.now() / 1000));
        return srv._rand();
      }, [0, 1]);
      reg('floor', (x) => (x === null ? null : Math.floor(Number(x))));
      reg('ceiling', (x) => (x === null ? null : Math.ceil(Number(x)))); reg('ceil', (x) => (x === null ? null : Math.ceil(Number(x))));
      reg('my_round', function (x, d) {
        if (x === null) return null;
        d = arguments.length > 1 ? Number(d) : 0;
        const f = Math.pow(10, d);
        const r = Math.round(Math.abs(Number(x)) * f) / f * Math.sign(Number(x));
        return d > 0 ? Number(r.toFixed(d)) : r;
      }, [1, 2]);
      reg('my_truncate', (x, d) => { const f = Math.pow(10, Number(d)); return Math.trunc(Number(x) * f) / f; });
      reg('pow', (a, b) => Math.pow(a, b)); reg('power', (a, b) => Math.pow(a, b));
      reg('sqrt', (a) => (a < 0 ? null : Math.sqrt(a))); reg('exp', (a) => Math.exp(a));
      reg('ln', (a) => (a <= 0 ? null : Math.log(a))); reg('log', function (a, b) { return arguments.length > 1 ? Math.log(b) / Math.log(a) : (a <= 0 ? null : Math.log(a)); }, [1, 2]);
      reg('log10', (a) => (a <= 0 ? null : Math.log10(a))); reg('log2', (a) => Math.log2(a));
      reg('pi', () => 3.141593);
      for (const f of ['sin', 'cos', 'tan', 'asin', 'acos', 'atan']) reg(f, (a) => Math[f](a));
      reg('atan2', (a, b) => Math.atan2(a, b)); reg('cot', (a) => 1 / Math.tan(a));
      reg('degrees', (a) => a * 180 / Math.PI); reg('radians', (a) => a * Math.PI / 180);
      reg('sign', (a) => Math.sign(a)); reg('my_mod', (a, b) => (Number(b) === 0 ? null : Number(a) % Number(b)));
      reg('greatest', function () { if ([...arguments].includes(null)) return null; return [...arguments].reduce((m, v) => (v > m ? v : m)); }, range(2, 16));
      reg('least', function () { if ([...arguments].includes(null)) return null; return [...arguments].reduce((m, v) => (v < m ? v : m)); }, range(2, 16));
      reg('format', (x, d) => { const n = Number(x).toFixed(Number(d)); const [i, f] = n.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); });
      reg('isnull', (x) => (x === null ? 1 : 0));
      reg('strcmp', (a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
      reg('find_in_set', (s, list) => { const i = String(list).split(',').findIndex((x) => x.toLowerCase() === String(s).toLowerCase()); return i + 1; });
      reg('field', function (s) { const a = [...arguments].slice(1); const i = a.findIndex((x) => x !== null && String(x).toLowerCase() === String(s).toLowerCase()); return i + 1; }, range(2, 32));
      reg('elt', function (n) { const a = [...arguments].slice(1); return a[Number(n) - 1] ?? null; }, range(2, 32));
      reg('substring_index', (s, d, n) => {
        s = String(s); d = String(d); n = Number(n);
        const parts = s.split(d);
        return n > 0 ? parts.slice(0, n).join(d) : parts.slice(n).join(d);
      });
      reg('soundex', (s) => {
        s = String(s).toUpperCase().replace(/[^A-Z]/g, '');
        if (!s) return '';
        const codes = { B: 1, F: 1, P: 1, V: 1, C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2, D: 3, T: 3, L: 4, M: 5, N: 5, R: 6 };
        let out = s[0], last = codes[s[0]] || 0;
        for (let i = 1; i < s.length; i++) { const c = codes[s[i]] || 0; if (c && c !== last) out += c; if (s[i] !== 'H' && s[i] !== 'W') last = c; }
        return out.padEnd(4, '0');
      });
      reg('my_hex', (x) => (typeof x === 'number' ? Math.trunc(x).toString(16).toUpperCase() : (x instanceof Uint8Array ? bytesToStr(x) : String(x)).split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase()));
      reg('bin', (x) => Math.trunc(Number(x)).toString(2)); reg('oct', (x) => Math.trunc(Number(x)).toString(8));
      reg('conv', (x, from, to) => { const n = parseInt(String(x), Number(from)); return isNaN(n) ? '0' : n.toString(Number(to)).toUpperCase(); });
      reg('inet_aton', (s) => { const p = String(s).split('.').map(Number); return p.length === 4 ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null; });
      reg('inet_ntoa', (n) => { n = Number(n); return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); });
      reg('get_lock', (n, t) => 1); reg('release_lock', (n) => 1); reg('is_free_lock', (n) => 1);
      reg('benchmark', (n, e) => 0);
      reg('regexp', (re, s) => {
        if (re === null || s === null) return null;
        try { return new RegExp(String(re), 'i').test(String(s)) ? 1 : 0; } catch (e) { return 0; }
      });
      reg('my_glob', (a, b) => 0);
      reg('phpsim_norm', (kind, v, len, extra) => normalize(kind, v, len, extra ? JSON.parse(extra) : {}));
      reg('phpsim_now', now);
    }
  }

  // MySQL 3.23's RAND() generator (my_rnd with max_value 0x3FFFFFFF)
  function mysqlRand(seed) {
    const max = 0x3FFFFFFF;
    let s1 = (seed * 0x10001 + 55555555) % max, s2 = (seed * 0x10000001) % max;
    return () => {
      s1 = (s1 * 3 + s2) % max;
      s2 = (s1 + s2 + 33) % max;
      return s1 / max;
    };
  }

  // ---------------------------------------------------------------------------
  // A client connection: protocol + query execution
  // ---------------------------------------------------------------------------
  class Connection {
    constructor(server, opts = {}) {
      this.srv = server;
      this.internal = !!opts.internal;
      this.threadId = server.nextThread++;
      this.db = null;
      this.inbuf = new Uint8Array(0);
      this.out = [];
      this.outLen = 0;
      this.authed = false;
      this.closed = false;
      this.lastInsertId = 0;
      this.scramble = 'phpsimXX'.split('').map(() => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join('');
      if (!this.internal) this.greet();
    }

    // --- framing -------------------------------------------------------------
    send(payload, seq) {
      const b = typeof payload === 'string' ? strToBytes(payload) : payload;
      const hdr = new Uint8Array([b.length & 255, (b.length >> 8) & 255, (b.length >> 16) & 255, seq & 255]);
      this.out.push(hdr, b);
      this.outLen += 4 + b.length;
    }
    read(max) {
      const buf = new Uint8Array(Math.min(max, this.outLen));
      let o = 0;
      while (o < buf.length && this.out.length) {
        const head = this.out[0];
        const take = Math.min(head.length, buf.length - o);
        buf.set(head.subarray(0, take), o);
        o += take;
        if (take === head.length) this.out.shift(); else this.out[0] = head.subarray(take);
      }
      this.outLen -= o;
      return buf;
    }
    write(bytes) {
      const merged = new Uint8Array(this.inbuf.length + bytes.length);
      merged.set(this.inbuf);
      merged.set(bytes, this.inbuf.length);
      this.inbuf = merged;
      while (this.inbuf.length >= 4) {
        const len = this.inbuf[0] | (this.inbuf[1] << 8) | (this.inbuf[2] << 16);
        if (this.inbuf.length < 4 + len) break;
        const seq = this.inbuf[3];
        const payload = this.inbuf.slice(4, 4 + len);
        this.inbuf = this.inbuf.slice(4 + len);
        this.onPacket(payload, seq);
      }
    }
    close() { this.closed = true; this.srv.conns.delete(this); }

    lenc(n) {
      if (n < 251) return String.fromCharCode(n);
      if (n < 65536) return '\xfc' + String.fromCharCode(n & 255, n >> 8);
      if (n < 16777216) return '\xfd' + String.fromCharCode(n & 255, (n >> 8) & 255, n >> 16);
      return '\xfe' + String.fromCharCode(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255, 0, 0, 0, 0);
    }
    lstr(s) { return s === null ? '\xfb' : this.lenc(s.length) + s; }
    int2(n) { return String.fromCharCode(n & 255, (n >> 8) & 255); }
    int3(n) { return String.fromCharCode(n & 255, (n >> 8) & 255, (n >> 16) & 255); }
    int4(n) { return String.fromCharCode(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }

    greet() {
      const p = String.fromCharCode(PROTOCOL_VERSION) + SERVER_VERSION + '-log\0' + this.int4(this.threadId) +
        this.scramble + '\0' + this.int2(CAPS) + '\x08' + this.int2(STATUS_AUTOCOMMIT) + '\0'.repeat(13);
      this.send(p, 0);
    }
    ok(seq, affected = 0, insertId = 0, info = '') {
      let p = '\0' + this.lenc(affected) + this.lenc(insertId) + this.int2(STATUS_AUTOCOMMIT);
      if (info) p += this.lstr(info);
      this.send(p, seq);
    }
    err(seq, code, msg) { this.send('\xff' + this.int2(code) + msg, seq); }
    eof(seq) { this.send('\xfe', seq); }

    fieldPacket(f, withDefault) {
      let p = this.lstr(f.table || '') + this.lstr(f.name) + this.lstr(this.int3(Math.min(f.length || 0, 0xffffff))) +
        this.lstr(String.fromCharCode(f.type)) + this.lstr(this.int2(f.flags || 0) + String.fromCharCode(f.decimals || 0));
      if (withDefault) p += this.lstr(f.def === undefined ? null : f.def);
      return p;
    }
    sendResult(res, seq) {
      this.send(this.lenc(res.fields.length), seq++);
      for (const f of res.fields) this.send(this.fieldPacket(f, false), seq++);
      this.eof(seq++);
      for (const row of res.rows) this.send(row.map((v) => this.lstr(v)).join(''), seq++);
      this.eof(seq++);
    }

    // --- commands ------------------------------------------------------------
    onPacket(p, seq) {
      const s = bytesToStr(p);
      if (!this.authed) {
        // client_flag(2) max_packet(3) user\0 scramble\0 [db\0]
        const flags = p[0] | (p[1] << 8);
        let i = 5;
        const uEnd = s.indexOf('\0', i);
        this.user = s.slice(i, uEnd < 0 ? s.length : uEnd);
        i = uEnd + 1;
        const pEnd = s.indexOf('\0', i);
        i = pEnd < 0 ? s.length : pEnd + 1;
        let db = null;
        if ((flags & 8) && i < s.length) { const dEnd = s.indexOf('\0', i); db = s.slice(i, dEnd < 0 ? s.length : dEnd); }
        this.authed = true;
        if (db) {
          if (!this.srv.dbs.has(db)) return this.err(seq + 1, 1049, "Unknown database '" + db + "'");
          this.db = db;
        }
        this.srv.conns.add(this);
        return this.ok(seq + 1);
      }
      const cmd = p[0];
      const arg = s.slice(1);
      this.srv.questions++;
      try {
        switch (cmd) {
          case 1: this.closed = true; return undefined;                      // COM_QUIT
          case 2:                                                             // COM_INIT_DB
            if (!this.srv.dbs.has(arg)) return this.err(seq + 1, 1049, "Unknown database '" + arg + "'");
            this.db = arg;
            return this.ok(seq + 1);
          case 3: {                                                           // COM_QUERY
            const res = this.execute(arg);
            if (res.rows) return this.sendResult(res, seq + 1);
            return this.ok(seq + 1, res.affected || 0, res.insertId || 0, res.info || '');
          }
          case 4: {                                                           // COM_FIELD_LIST
            const z = arg.indexOf('\0');
            const table = z < 0 ? arg : arg.slice(0, z);
            const wild = z < 0 ? '' : arg.slice(z + 1);
            const meta = this.tableMeta(table, true);
            let q = seq + 1;
            for (const c of meta.columns) {
              if (wild && !likeMatch(c.name, wild)) continue;
              this.send(this.fieldPacket(this.fieldFromColumn(c, table), true), q++);
            }
            return this.eof(q);
          }
          case 5:                                                             // COM_CREATE_DB
            this.execute('CREATE DATABASE `' + arg + '`');
            return this.ok(seq + 1, 1);
          case 6:                                                             // COM_DROP_DB
            this.execute('DROP DATABASE `' + arg + '`');
            return this.ok(seq + 1, 0);
          case 7: case 8: case 14: return this.ok(seq + 1);                  // REFRESH SHUTDOWN PING
          case 9: {                                                           // COM_STATISTICS
            const up = Math.max(1, Math.floor((Date.now() - this.srv.started) / 1000));
            const txt = 'Uptime: ' + up + '  Threads: ' + Math.max(1, this.srv.conns.size) + '  Questions: ' + this.srv.questions +
              '  Slow queries: 0  Opens: ' + (this.srv.dbs.size * 3) + '  Flush tables: 1  Open tables: 0 Queries per second avg: ' +
              (this.srv.questions / up).toFixed(3);
            return this.send(txt, seq + 1);
          }
          case 10: return this.sendResult(this.processList(), seq + 1);     // COM_PROCESS_INFO
          case 12: return this.ok(seq + 1);                                  // COM_PROCESS_KILL
          default: return this.err(seq + 1, 1047, 'Unknown command');
        }
      } catch (e) {
        if (e instanceof SqlError) return this.err(seq + 1, e.code, e.message);
        return this.err(seq + 1, 1064, 'You have an error in your SQL syntax near \'' + String(e.message).slice(0, 80) + '\' at line 1');
      }
    }

    processList() {
      const rows = [...this.srv.conns].map((c) => [String(c.threadId), c.user || 'root', 'localhost', c.db, c === this ? 'Query' : 'Sleep', '0', null, c === this ? 'show processlist' : null]);
      return this.makeResult(['Id', 'User', 'Host', 'db', 'Command', 'Time', 'State', 'Info'], rows);
    }

    // --- SQL -----------------------------------------------------------------
    database() {
      if (!this.db || !this.srv.dbs.has(this.db)) throw new SqlError(1046, 'No Database Selected');
      return this.srv.dbs.get(this.db);
    }

    execute(sql) {
      this.srv._currentDb = this.db;
      this.srv._currentThread = this.threadId;
      this.srv._lastInsertId = this.lastInsertId;
      let toks = tokenize(sql);
      // one statement per query; a trailing ';' is allowed
      const semi = toks.findIndex((t) => t.t === 'op' && t.v === ';');
      if (semi >= 0) {
        const rest = sig(toks.slice(semi + 1));
        if (rest.length) throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks.slice(semi)).slice(0, 80) + "' at line 1");
        toks = toks.slice(0, semi);
      }
      const s = sig(toks);
      if (!s.length) throw new SqlError(1065, 'Query was empty');
      const K = kw(s[0]);
      try {
        switch (K) {
          case 'SELECT': return this.select(toks, sql);
          case 'INSERT': case 'REPLACE': return this.insert(toks, sql);
          case 'UPDATE': return this.update(toks, sql);
          case 'DELETE': return this.del(toks, sql);
          case 'CREATE': return this.create(toks, sql);
          case 'DROP': return this.drop(toks, sql);
          case 'ALTER': return this.alter(toks, sql);
          case 'SHOW': return this.show(s, sql);
          case 'DESCRIBE': case 'DESC': return this.describe(identName(s[1]), s[2] ? identName(s[2]) : null);
          case 'EXPLAIN':
            if (kw(s[1]) === 'SELECT') return this.makeResult(['table', 'type', 'possible_keys', 'key', 'key_len', 'ref', 'rows', 'Extra'], [['', 'ALL', null, null, null, null, '1', '']]);
            return this.describe(identName(s[1]));
          case 'USE':
            if (!this.srv.dbs.has(identName(s[1]))) throw new SqlError(1049, "Unknown database '" + identName(s[1]) + "'");
            this.db = identName(s[1]);
            return {};
          case 'TRUNCATE': return this.del(tokenize('DELETE FROM ' + rawOf(s.slice(kw(s[1]) === 'TABLE' ? 2 : 1))), sql);
          case 'SET': case 'LOCK': case 'UNLOCK': case 'BEGIN': case 'COMMIT': case 'ROLLBACK': case 'FLUSH':
          case 'GRANT': case 'REVOKE': case 'KILL': case 'RESET': case 'PURGE': case 'DO': case 'HANDLER':
            return {};
          case 'OPTIMIZE': case 'REPAIR': case 'CHECK': case 'ANALYZE': case 'BACKUP': case 'RESTORE': {
            const tables = splitTopLevel(s.slice(kw(s[1]) === 'TABLE' ? 2 : 1)).map((p) => (p[0] ? identName(p[0]) : ''));
            const op = K.toLowerCase();
            return this.makeResult(['Table', 'Op', 'Msg_type', 'Msg_text'], tables.map((t) => [this.db + '.' + t, op, 'status', op === 'optimize' || op === 'analyze' ? 'Table is already up to date' : 'OK']));
          }
          default:
            throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks).trim().slice(0, 80) + "' at line 1");
        }
      } catch (e) {
        if (e instanceof SqlError) throw e;
        throw this.mapError(e, sql, toks);
      }
    }

    mapError(e, sql, toks) {
      const m = String(e && e.message || e);
      let r;
      if ((r = m.match(/no such table: (?:\w+\.)?(\S+)/))) return new SqlError(1146, "Table '" + this.db + '.' + r[1] + "' doesn't exist");
      if ((r = m.match(/no such column: (\S+)/))) return new SqlError(1054, "Unknown column '" + r[1] + "' in 'field list'");
      if ((r = m.match(/ambiguous column name: (\S+)/))) return new SqlError(1052, "Column: '" + r[1] + "' in field list is ambiguous");
      if ((r = m.match(/table (\S+) already exists/))) return new SqlError(1050, "Table '" + r[1].replace(/"/g, '') + "' already exists");
      if ((r = m.match(/NOT NULL constraint failed: \S+\.(\S+)/))) return new SqlError(1048, "Column '" + r[1] + "' cannot be null");
      if (/(\d+) values for (\d+) columns|has \d+ columns but \d+ values were supplied|values were supplied/.test(m)) return new SqlError(1136, "Column count doesn't match value count at row 1");
      if ((r = m.match(/UNIQUE constraint failed: (.*)$/))) return new SqlError(1062, "Duplicate entry '" + (this._dupValue || '') + "' for key " + (this._dupKey || 1));
      if ((r = m.match(/near "([^"]*)": syntax error/))) {
        const raw = rawOf(toks);
        let at = raw.indexOf(r[1]);
        if (at < 0) at = 0;
        return new SqlError(1064, "You have an error in your SQL syntax near '" + raw.slice(at).slice(0, 80) + "' at line 1");
      }
      if (/incomplete input/.test(m)) return new SqlError(1064, "You have an error in your SQL syntax near '' at line 1");
      if ((r = m.match(/no such function: (\S+)/))) {
        const raw = rawOf(toks);
        const at = raw.toLowerCase().indexOf(r[1].toLowerCase() + '(');
        return new SqlError(1064, "You have an error in your SQL syntax near '" + (at >= 0 ? raw.slice(at + r[1].length) : raw).slice(0, 80) + "' at line 1");
      }
      if (/wrong number of arguments/.test(m)) return new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks).slice(0, 80) + "' at line 1");
      return new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks).trim().slice(0, 80) + "' at line 1");
    }

    makeResult(names, rows, types) {
      return {
        fields: names.map((n, i) => ({ table: '', name: n, length: Math.max(n.length, ...rows.map((r) => (r[i] === null ? 0 : String(r[i]).length)), 1), type: (types && types[i]) || T.VAR_STRING, flags: 0, decimals: 0 })),
        rows: rows.map((r) => r.map((v) => (v === null || v === undefined ? null : String(v)))),
      };
    }

    // --- metadata ------------------------------------------------------------
    tableMeta(name, mustExist) {
      const db = this.database();
      const r = db.exec('SELECT def FROM __phpsim_meta WHERE tbl = ' + sqlStr(name));
      if (r.length && r[0].values.length) return JSON.parse(r[0].values[0][0]);
      // a table created some other way: derive from SQLite
      const info = db.exec('PRAGMA table_info(' + qid(name) + ')');
      if (!info.length) {
        if (mustExist) throw new SqlError(1146, "Table '" + this.db + '.' + name + "' doesn't exist");
        return null;
      }
      return {
        name, keys: [], columns: info[0].values.map((v) => {
          const col = { name: v[1], baseType: /INT/i.test(v[2]) ? 'INT' : /REAL|FLOA|DOUB/i.test(v[2]) ? 'DOUBLE' : 'VARCHAR', length: 255, notNull: !!v[3], def: v[4], key: v[5] ? 'PRI' : '' };
          finishColumn(col);
          return col;
        }),
      };
    }
    saveMeta(meta) {
      this.database().run('INSERT OR REPLACE INTO __phpsim_meta (tbl, def) VALUES (?, ?)', [meta.name, JSON.stringify(meta)]);
    }
    listTables() {
      const r = this.database().exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name != '__phpsim_meta' ORDER BY name");
      return r.length ? r[0].values.map((v) => v[0]) : [];
    }
    fieldFromColumn(c, table) {
      let flags = 0;
      if (c.notNull) flags |= F.NOT_NULL;
      if (c.key === 'PRI') flags |= F.PRI_KEY;
      if (c.key === 'UNI') flags |= F.UNIQUE_KEY;
      if (c.key === 'MUL') flags |= F.MULTIPLE_KEY;
      if (c.isBlob) flags |= F.BLOB;
      if (c.unsigned) flags |= F.UNSIGNED;
      if (c.zerofill) flags |= F.ZEROFILL;
      if (c.binary) flags |= F.BINARY;
      if (c.kind === 'enum') flags |= F.ENUM;
      if (c.kind === 'set') flags |= F.SET;
      if (c.autoInc) flags |= F.AUTO_INCREMENT;
      if (c.kind === 'timestamp') flags |= F.TIMESTAMP;
      return { table, name: c.name, length: c.length, type: c.type, flags, decimals: c.kind === 'real' || c.kind === 'decimal' ? (c.decimals || 0) : 0, def: c.def === null ? undefined : c.def };
    }

    // --- statements ----------------------------------------------------------
    create(toks, sql) {
      const s = sig(toks);
      let i = 1;
      if (kw(s[i]) === 'TEMPORARY') i++;
      if (kw(s[i]) === 'DATABASE' || kw(s[i]) === 'SCHEMA') {
        i++;
        let ifNot = false;
        if (kw(s[i]) === 'IF') { ifNot = true; i += 3; }
        const name = identName(s[i]);
        if (this.srv.dbs.has(name)) {
          if (ifNot) return {};
          throw new SqlError(1007, "Can't create database '" + name + "'. Database exists");
        }
        this.srv.createDb(name);
        return { affected: 1 };
      }
      if (kw(s[i]) === 'UNIQUE' || kw(s[i]) === 'INDEX' || kw(s[i]) === 'FULLTEXT') {
        const unique = kw(s[i]) === 'UNIQUE';
        while (kw(s[i]) !== 'INDEX') i++;
        const idx = identName(s[i + 1]);
        const table = identName(s[i + 3]);
        const p = s.findIndex((t, k) => k > i + 3 && t.v === '(');
        const cols = splitTopLevel(s.slice(p + 1, matchParen(s, p))).map((c) => identName(c[0]));
        this.addIndex(table, idx, cols, unique ? 'UNI' : 'MUL');
        return {};
      }
      if (kw(s[i]) !== 'TABLE') throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks).trim().slice(0, 80) + "' at line 1");
      i++;
      let ifNot = false;
      if (kw(s[i]) === 'IF') { ifNot = true; i += 3; }
      let name = identName(s[i]);
      if (s[i + 1] && s[i + 1].v === '.') { name = identName(s[i + 2]); i += 2; }
      const db = this.database();
      if (this.listTables().some((t) => t.toLowerCase() === name.toLowerCase())) {
        if (ifNot) return {};
        throw new SqlError(1050, "Table '" + name + "' already exists");
      }
      i++;
      if (!s[i] || s[i].v !== '(') {
        // CREATE TABLE t SELECT ...
        const selStart = s.findIndex((t, k) => k >= i && kw(t) === 'SELECT');
        if (selStart < 0) throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks).slice(0, 80) + "' at line 1");
        const selToks = tokenize(rawOf(s.slice(selStart)).replace(/\s+/g, ' '));
        db.run('CREATE TABLE ' + qid(name) + ' AS ' + this.translateSelect(selToks).sql);
        this.srv.dirty.add(this.db);
        return { affected: db.getRowsModified() };
      }
      const e = matchParen(s, i);
      const defs = splitTopLevel(s.slice(i + 1, e)).map((d) => d.filter((t) => !isWs(t))).filter((d) => d.length);
      const meta = { name, columns: [], keys: [] };
      let pk = null;
      const indexes = [];
      for (const d of defs) {
        const K = kw(d[0]);
        const colsOf = (from) => {
          const p = d.findIndex((t, k) => k >= from && t.v === '(');
          return splitTopLevel(d.slice(p + 1, matchParen(d, p))).map((c) => identName(c.filter((t) => !isWs(t))[0]));
        };
        if (K === 'PRIMARY') { pk = colsOf(0); continue; }
        if (K === 'KEY' || K === 'INDEX') { indexes.push({ name: d[1] && d[1].v !== '(' ? identName(d[1]) : null, cols: colsOf(0), kind: 'MUL' }); continue; }
        if (K === 'UNIQUE') {
          let k = 1;
          if (kw(d[k]) === 'KEY' || kw(d[k]) === 'INDEX') k++;
          indexes.push({ name: d[k] && d[k].v !== '(' ? identName(d[k]) : null, cols: colsOf(0), kind: 'UNI' });
          continue;
        }
        if (K === 'FULLTEXT') { continue; }
        if (K === 'CONSTRAINT' || K === 'FOREIGN' || K === 'CHECK' || K === 'INDEX') continue;
        meta.columns.push(parseColumnDef(d));
      }
      const auto = meta.columns.find((c) => c.autoInc);
      if (pk) for (const c of meta.columns) if (pk.some((p) => p.toLowerCase() === c.name.toLowerCase())) { c.key = 'PRI'; c.notNull = true; if (c.def === null && !c.autoInc) c.def = implicitDefault(c); }
      for (const ix of indexes) for (const c of meta.columns) if (!c.key && c.name.toLowerCase() === ix.cols[0].toLowerCase()) c.key = ix.kind;
      // first TIMESTAMP column is auto-set on insert and update
      const ts = meta.columns.find((c) => c.kind === 'timestamp');
      if (ts) ts.autoTs = true;
      const colSql = meta.columns.map(sqliteColumnSql);
      if (pk && !(auto && pk.length === 1 && pk[0].toLowerCase() === auto.name.toLowerCase())) {
        if (auto) throw new SqlError(1075, 'Incorrect table definition; There can only be one auto column and it must be defined as a key');
        colSql.push('PRIMARY KEY (' + pk.map(qid).join(', ') + ')');
      }
      meta.keys = [];
      if (pk || auto) meta.keys.push({ name: 'PRIMARY', cols: pk || [auto.name], kind: 'PRI' });
      db.run('CREATE TABLE ' + qid(name) + ' (' + colSql.join(', ') + ')');
      // auto_increment start value
      const optStart = s.slice(e + 1);
      for (let k = 0; k < optStart.length; k++) {
        if (kw(optStart[k]) === 'AUTO_INCREMENT' && auto) {
          const v = optStart[k + 1] && optStart[k + 1].v === '=' ? optStart[k + 2] : optStart[k + 1];
          const start = parseInt(v && v.v, 10);
          if (start > 1) db.run("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)", [name, start - 1]);
        }
      }
      this.saveMeta(meta);
      for (const ix of indexes) this.addIndex(name, ix.name || ix.cols[0], ix.cols, ix.kind, true);
      this.makeTriggers(meta);
      this.srv.dirty.add(this.db);
      return {};
    }

    addIndex(table, idx, cols, kind, skipMeta) {
      const db = this.database();
      const meta = this.tableMeta(table, true);
      let name = idx;
      const used = new Set(meta.keys.map((k) => k.name.toLowerCase()));
      if (used.has(name.toLowerCase())) { let n = 2; while (used.has((idx + '_' + n).toLowerCase())) n++; name = idx + '_' + n; }
      db.run('CREATE ' + (kind === 'UNI' ? 'UNIQUE ' : '') + 'INDEX ' + qid(table + '__' + name) + ' ON ' + qid(table) + ' (' + cols.map(qid).join(', ') + ')');
      meta.keys.push({ name, cols, kind });
      for (const c of meta.columns) if (!c.key && c.name.toLowerCase() === cols[0].toLowerCase()) c.key = kind;
      this.saveMeta(meta);
      this.srv.dirty.add(this.db);
    }

    // AFTER INSERT/UPDATE triggers normalise values the way MySQL 3.23 stores them
    makeTriggers(meta) {
      const db = this.database();
      const t = meta.name;
      db.run('DROP TRIGGER IF EXISTS ' + qid(t + '__ins'));
      db.run('DROP TRIGGER IF EXISTS ' + qid(t + '__upd'));
      const sets = [];
      for (const c of meta.columns) {
        if (c.autoInc) continue;
        let extra = null;
        if (c.kind === 'int') extra = { bt: c.baseType, unsigned: c.unsigned };
        else if (c.kind === 'decimal') extra = { decimals: c.decimals };
        else if (c.kind === 'string') extra = { fixed: c.baseType === 'CHAR' };
        else if (c.kind === 'enum' || c.kind === 'set') extra = { values: c.values };
        else if (['real', 'date', 'datetime', 'time', 'year', 'timestamp'].includes(c.kind)) extra = {};
        if (!extra) continue;
        const len = c.kind === 'string' && !c.isBlob ? c.length : (c.isBlob ? c.length : 0);
        sets.push(qid(c.name) + ' = phpsim_norm(' + sqlStr(c.kind) + ', ' + qid(c.name) + ', ' + len + ', ' + sqlStr(JSON.stringify(extra)) + ')');
      }
      const ts = meta.columns.find((c) => c.autoTs);
      const where = ' WHERE rowid = NEW.rowid';
      const insSets = sets.slice();
      if (ts) insSets.push(qid(ts.name) + ' = CASE WHEN NEW.' + qid(ts.name) + ' IS NULL OR NEW.' + qid(ts.name) + " = '' OR NEW." + qid(ts.name) + ' = 0 THEN phpsim_now() ELSE ' + qid(ts.name) + ' END');
      if (insSets.length) db.run('CREATE TRIGGER ' + qid(t + '__ins') + ' AFTER INSERT ON ' + qid(t) + ' BEGIN UPDATE ' + qid(t) + ' SET ' + insSets.join(', ') + where + '; END');
      const updSets = sets.slice();
      if (ts) updSets.push(qid(ts.name) + ' = CASE WHEN NEW.' + qid(ts.name) + ' IS OLD.' + qid(ts.name) + ' THEN phpsim_now() ELSE ' + qid(ts.name) + ' END');
      if (updSets.length) db.run('CREATE TRIGGER ' + qid(t + '__upd') + ' AFTER UPDATE ON ' + qid(t) + ' BEGIN UPDATE ' + qid(t) + ' SET ' + updSets.join(', ') + where + '; END');
    }

    drop(toks) {
      const s = sig(toks);
      const K = kw(s[1]);
      if (K === 'DATABASE' || K === 'SCHEMA') {
        let i = 2, ifEx = false;
        if (kw(s[i]) === 'IF') { ifEx = true; i += 2; }
        const name = identName(s[i]);
        if (!this.srv.dbs.has(name)) {
          if (ifEx) return {};
          throw new SqlError(1008, "Can't drop database '" + name + "'. Database doesn't exist");
        }
        this.srv.dropDb(name);
        if (this.db === name) this.db = null;
        return { affected: 0 };
      }
      if (K === 'INDEX') {
        const idx = identName(s[2]);
        const table = identName(s[4]);
        const meta = this.tableMeta(table, true);
        this.database().run('DROP INDEX IF EXISTS ' + qid(table + '__' + idx));
        meta.keys = meta.keys.filter((k) => k.name !== idx);
        this.saveMeta(meta);
        this.srv.dirty.add(this.db);
        return {};
      }
      if (K === 'TABLE' || K === 'TEMPORARY') {
        let i = K === 'TEMPORARY' ? 3 : 2, ifEx = false;
        if (kw(s[i]) === 'IF') { ifEx = true; i += 2; }
        const names = splitTopLevel(s.slice(i)).map((p) => identName(p.filter((t) => !isWs(t)).slice(-1)[0]));
        const existing = this.listTables();
        const missing = names.filter((n) => !existing.some((e) => e.toLowerCase() === n.toLowerCase()));
        if (missing.length && !ifEx) throw new SqlError(1051, "Unknown table '" + missing.join(',') + "'");
        const db = this.database();
        for (const n of names) {
          if (missing.includes(n)) continue;
          db.run('DROP TABLE ' + qid(n));
          db.run('DELETE FROM __phpsim_meta WHERE tbl = ?', [n]);
        }
        this.srv.dirty.add(this.db);
        return {};
      }
      throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(toks).trim().slice(0, 80) + "' at line 1");
    }

    alter(toks) {
      const s = sig(toks);
      let i = 1;
      if (kw(s[i]) === 'IGNORE') i++;
      i++; // TABLE
      const table = identName(s[i]);
      const meta = this.tableMeta(table, true);
      const db = this.database();
      const specs = splitTopLevel(s.slice(i + 1));
      for (const spec0 of specs) {
        const spec = spec0.filter((t) => !isWs(t));
        const K = kw(spec[0]);
        if (K === 'ADD') {
          let k = 1;
          if (kw(spec[k]) === 'INDEX' || kw(spec[k]) === 'KEY' || kw(spec[k]) === 'UNIQUE' || kw(spec[k]) === 'PRIMARY' || kw(spec[k]) === 'FULLTEXT') {
            const kind = kw(spec[k]) === 'UNIQUE' ? 'UNI' : kw(spec[k]) === 'PRIMARY' ? 'PRI' : 'MUL';
            const p = spec.findIndex((t) => t.v === '(');
            const cols = splitTopLevel(spec.slice(p + 1, matchParen(spec, p))).map((c) => identName(c.filter((t) => !isWs(t))[0]));
            const nameTok = spec[p - 1];
            const idx = nameTok && !['INDEX', 'KEY', 'UNIQUE', 'PRIMARY', 'FULLTEXT'].includes(kw(nameTok)) ? identName(nameTok) : (kind === 'PRI' ? 'PRIMARY' : cols[0]);
            if (kind === 'PRI') {
              for (const c of meta.columns) if (cols.includes(c.name)) { c.key = 'PRI'; c.notNull = true; }
              meta.keys.push({ name: 'PRIMARY', cols, kind: 'PRI' });
              db.run('CREATE UNIQUE INDEX ' + qid(table + '__PRIMARY') + ' ON ' + qid(table) + ' (' + cols.map(qid).join(', ') + ')');
              this.saveMeta(meta);
            } else this.addIndex(table, idx, cols, kind);
            continue;
          }
          if (kw(spec[k]) === 'COLUMN') k++;
          const col = parseColumnDef(spec.slice(k).filter((t) => !['FIRST', 'AFTER'].includes(kw(t))));
          db.run('ALTER TABLE ' + qid(table) + ' ADD COLUMN ' + sqliteColumnSql(col));
          meta.columns.push(col);
        } else if (K === 'DROP') {
          let k = 1;
          if (kw(spec[k]) === 'INDEX' || kw(spec[k]) === 'KEY') {
            const idx = identName(spec[k + 1]);
            db.run('DROP INDEX IF EXISTS ' + qid(table + '__' + idx));
            meta.keys = meta.keys.filter((x) => x.name !== idx);
            continue;
          }
          if (kw(spec[k]) === 'PRIMARY') { meta.keys = meta.keys.filter((x) => x.kind !== 'PRI'); continue; }
          if (kw(spec[k]) === 'COLUMN') k++;
          const name = identName(spec[k]);
          this.rebuildTable(meta, meta.columns.filter((c) => c.name.toLowerCase() !== name.toLowerCase()), {});
          continue;
        } else if (K === 'CHANGE' || K === 'MODIFY') {
          let k = 1;
          if (kw(spec[k]) === 'COLUMN') k++;
          const oldName = identName(spec[k]);
          const col = parseColumnDef(spec.slice(K === 'CHANGE' ? k + 1 : k).filter((t) => !['FIRST', 'AFTER'].includes(kw(t))));
          const cols = meta.columns.map((c) => (c.name.toLowerCase() === oldName.toLowerCase() ? Object.assign(col, { key: col.key || c.key }) : c));
          this.rebuildTable(meta, cols, { [col.name]: oldName });
          continue;
        } else if (K === 'RENAME') {
          const to = identName(spec[spec.length - 1]);
          db.run('ALTER TABLE ' + qid(table) + ' RENAME TO ' + qid(to));
          db.run('DELETE FROM __phpsim_meta WHERE tbl = ?', [table]);
          meta.name = to;
          this.saveMeta(meta);
          this.makeTriggers(meta);
          this.srv.dirty.add(this.db);
          return {};
        } else if (K === 'ALTER') {
          // ALTER [COLUMN] c SET DEFAULT v | DROP DEFAULT
          let k = 1;
          if (kw(spec[k]) === 'COLUMN') k++;
          const name = identName(spec[k]);
          const c = meta.columns.find((x) => x.name.toLowerCase() === name.toLowerCase());
          if (c) c.def = kw(spec[k + 1]) === 'SET' ? spec[k + 3].v : implicitDefault(c);
          this.rebuildTable(meta, meta.columns, {});
          continue;
        }
      }
      this.saveMeta(meta);
      this.makeTriggers(meta);
      this.srv.dirty.add(this.db);
      const n = db.exec('SELECT count(*) FROM ' + qid(meta.name))[0].values[0][0];
      return { affected: n, info: 'Records: ' + n + '  Duplicates: 0  Warnings: 0' };
    }

    rebuildTable(meta, newCols, renames) {
      const db = this.database();
      const tmp = meta.name + '__rebuild';
      const auto = newCols.find((c) => c.autoInc);
      const pk = (meta.keys.find((k) => k.kind === 'PRI') || {}).cols;
      const colSql = newCols.map(sqliteColumnSql);
      if (pk && !(auto && pk.length === 1)) colSql.push('PRIMARY KEY (' + pk.filter((p) => newCols.some((c) => c.name === p)).map(qid).join(', ') + ')');
      db.run('DROP TRIGGER IF EXISTS ' + qid(meta.name + '__ins'));
      db.run('DROP TRIGGER IF EXISTS ' + qid(meta.name + '__upd'));
      db.run('CREATE TABLE ' + qid(tmp) + ' (' + colSql.join(', ') + ')');
      const existing = new Set(meta.columns.map((c) => c.name));
      const pairs = newCols.map((c) => [c.name, renames[c.name] || c.name]).filter(([, from]) => existing.has(from));
      db.run('INSERT INTO ' + qid(tmp) + ' (' + pairs.map((p) => qid(p[0])).join(', ') + ') SELECT ' + pairs.map((p) => qid(p[1])).join(', ') + ' FROM ' + qid(meta.name));
      db.run('DROP TABLE ' + qid(meta.name));
      db.run('ALTER TABLE ' + qid(tmp) + ' RENAME TO ' + qid(meta.name));
      meta.columns = newCols;
      for (const k of meta.keys) {
        if (k.kind === 'PRI') continue;
        if (k.cols.every((c) => newCols.some((n) => n.name === c))) {
          db.run('CREATE ' + (k.kind === 'UNI' ? 'UNIQUE ' : '') + 'INDEX IF NOT EXISTS ' + qid(meta.name + '__' + k.name) + ' ON ' + qid(meta.name) + ' (' + k.cols.map(qid).join(', ') + ')');
        }
      }
    }

    // SELECT: translate, run, and describe the columns like MySQL would
    translateSelect(toks) {
      toks = rewriteIntervals(toks);
      const s = toks;
      // find the select list (between SELECT [options] and FROM at depth 0)
      let i = s.findIndex((t) => kw(t) === 'SELECT');
      let j = i + 1;
      while (j < s.length && (isWs(s[j]) || ['DISTINCT', 'DISTINCTROW', 'ALL', 'STRAIGHT_JOIN', 'SQL_SMALL_RESULT', 'SQL_BIG_RESULT', 'SQL_BUFFER_RESULT', 'HIGH_PRIORITY', 'SQL_NO_CACHE', 'SQL_CACHE', 'SQL_CALC_FOUND_ROWS'].includes(kw(s[j])))) j++;
      let depth = 0, end = s.length;
      for (let k = j; k < s.length; k++) {
        if (s[k].t === 'op' && s[k].v === '(') depth++;
        if (s[k].t === 'op' && s[k].v === ')') depth--;
        if (depth === 0 && ['FROM', 'INTO', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'PROCEDURE', 'UNION'].includes(kw(s[k]))) { end = k; break; }
      }
      const items = splitTopLevel(s.slice(j, end));
      const outItems = [];
      const colRefs = [];
      for (const item of items) {
        const t = trimWs(item);
        const st = sig(t);
        let alias = null;
        let exprToks = t;
        // alias: expr [AS] name
        if (st.length >= 3 && kw(st[st.length - 2]) === 'AS') { alias = identName(st[st.length - 1]); exprToks = t.slice(0, t.lastIndexOf(st[st.length - 2])); }
        else if (st.length >= 2 && (st[st.length - 1].t === 'id' || st[st.length - 1].t === 'qid' || st[st.length - 1].t === 'str') && !(st[st.length - 2].t === 'op' && st[st.length - 2].v === '.') &&
          !['DESC', 'ASC', 'END', 'NULL', 'TRUE', 'FALSE'].includes(kw(st[st.length - 1])) && !(st[st.length - 2].t === 'op' && /[-+*/%=<>]/.test(st[st.length - 2].v)) &&
          !['AS', 'IS', 'NOT', 'AND', 'OR', 'LIKE', 'REGEXP', 'THEN', 'ELSE', 'WHEN', 'IN', 'BETWEEN', 'INTERVAL', 'BINARY'].includes(kw(st[st.length - 2]))) {
          alias = st[st.length - 1].t === 'str' ? st[st.length - 1].v : identName(st[st.length - 1]);
          exprToks = t.slice(0, t.lastIndexOf(st[st.length - 1]));
        }
        const est = sig(exprToks);
        const isStar = est.length && est[est.length - 1].v === '*' && (est.length === 1 || (est.length === 3 && est[1].v === '.'));
        const simpleCol = (est.length === 1 && (est[0].t === 'id' || est[0].t === 'qid')) ? { table: null, col: identName(est[0]) }
          : (est.length === 3 && est[1].v === '.' && (est[2].t === 'id' || est[2].t === 'qid')) ? { table: identName(est[0]), col: identName(est[2]) } : null;
        let sqlItem = render(exprToks);
        if (isStar) { outItems.push(sqlItem); colRefs.push({ star: true, table: est.length === 3 ? identName(est[0]) : null }); continue; }
        const name = alias !== null ? alias : simpleCol ? simpleCol.col : rawOf(exprToks).trim();
        sqlItem += ' AS ' + qid(name);
        outItems.push(sqlItem);
        colRefs.push({ name, simple: simpleCol });
      }
      const sqlOut = render(s.slice(0, j)) + ' ' + outItems.join(', ') + ' ' + render(s.slice(end)).replace(/\bFROM\s+DUAL\b/i, '');
      return { sql: sqlOut, colRefs, fromToks: s.slice(end) };
    }

    tablesInFrom(fromToks) {
      // table names and aliases mentioned after FROM/JOIN
      const s = sig(fromToks);
      const out = [];
      for (let k = 0; k < s.length; k++) {
        const K = kw(s[k]);
        if (K === 'FROM' || K === 'JOIN' || (s[k].v === ',' && out.length)) {
          let n = k + 1;
          if (s[n] && s[n].v === '(') continue;
          if (!s[n] || !(s[n].t === 'id' || s[n].t === 'qid')) continue;
          let table = identName(s[n]);
          if (s[n + 1] && s[n + 1].v === '.') { table = identName(s[n + 2]); n += 2; }
          let alias = table;
          if (kw(s[n + 1]) === 'AS') alias = identName(s[n + 2]);
          else if (s[n + 1] && (s[n + 1].t === 'id' || s[n + 1].t === 'qid') && !['WHERE', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'JOIN', 'ON', 'USING', 'GROUP', 'ORDER', 'LIMIT', 'HAVING', 'NATURAL', 'CROSS', 'STRAIGHT_JOIN', 'USE', 'IGNORE', 'FORCE'].includes(kw(s[n + 1]))) alias = identName(s[n + 1]);
          out.push({ table, alias });
        }
      }
      return out;
    }

    select(toks) {
      const db = this.db ? this.database() : null;
      const tr = this.translateSelect(toks);
      const tables = this.tablesInFrom(tr.fromToks);
      if (tables.length && !db) throw new SqlError(1046, 'No Database Selected');
      const engine = db || this.scratchDb();
      let stmt;
      try { stmt = engine.prepare(tr.sql); } catch (e) { throw this.mapError(e, '', toks); }
      const names = stmt.getColumnNames();
      const rows = [];
      try {
        while (stmt.step()) rows.push(stmt.get());
      } finally { stmt.free(); }
      // column metadata
      const metas = {};
      for (const t of tables) {
        try { metas[t.alias.toLowerCase()] = { table: t.table, meta: this.tableMeta(t.table, false) }; } catch (e) {}
      }
      const findCol = (tableAlias, col) => {
        const cands = tableAlias ? [metas[tableAlias.toLowerCase()]] : Object.values(metas);
        for (const m of cands) {
          if (!m || !m.meta) continue;
          const c = m.meta.columns.find((x) => x.name.toLowerCase() === col.toLowerCase());
          if (c) return { c, table: m.table, alias: tableAlias || m.table };
        }
        return null;
      };
      // expand refs to one per output column (stars expand to table columns)
      const refs = [];
      for (const r of tr.colRefs) {
        if (r.star) {
          const list = r.table ? [metas[r.table.toLowerCase()]] : tables.map((t) => metas[t.alias.toLowerCase()]);
          for (const m of list) if (m && m.meta) for (const c of m.meta.columns) refs.push({ col: c, table: m.table });
        } else refs.push(r);
      }
      const fields = names.map((n, k) => {
        const r = refs[k] || {};
        let c = r.col ? { c: r.col, table: r.table } : null;
        if (!c && r.simple) c = findCol(r.simple.table, r.simple.col);
        if (c) { const f = this.fieldFromColumn(c.c, c.table); f.name = n; f._col = c.c; return f; }
        // expression: infer from the values
        let type = T.VAR_STRING, len = 0, dec = 0, flags = 0;
        const vals = rows.map((row) => row[k]).filter((v) => v !== null);
        if (vals.length && vals.every((v) => typeof v === 'number')) {
          if (vals.every((v) => Number.isInteger(v))) { type = T.LONGLONG; len = 21; flags = F.NOT_NULL; } else { type = T.DOUBLE; len = 23; dec = 31; }
        }
        for (const v of vals) len = Math.max(len, (typeof v === 'number' ? fmtNumber(v) : String(v)).length);
        return { table: '', name: n, length: len, type, flags, decimals: dec };
      });
      const outRows = rows.map((row) => row.map((v, k) => this.formatValue(v, fields[k]._col)));
      this.srv._foundRows = outRows.length;
      return { fields, rows: outRows };
    }

    scratchDb() {
      if (!this.srv._scratch) this.srv._scratch = this.srv.openDb(null);
      return this.srv._scratch;
    }

    formatValue(v, col) {
      if (v === null || v === undefined) return null;
      if (v instanceof Uint8Array) return bytesToStr(v);
      if (col) {
        if (col.kind === 'decimal' && typeof v === 'number') return v.toFixed(col.decimals || 0);
        if (col.kind === 'timestamp') {
          const d = parseMyDate(v);
          const full = d ? d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) : '00000000000000';
          const len = col.length || 14;
          return len === 2 ? full.slice(2, 4) : len === 4 || len === 6 || len === 8 || len === 10 || len === 12 ? (len === 4 || len === 6 || len === 10 || len === 12 ? full.slice(2, 2 + len) : full.slice(0, len)) : full;
        }
        if (col.kind === 'int' && col.zerofill && typeof v === 'number') return String(v).padStart(col.length, '0');
        if (col.kind === 'real' && typeof v === 'number' && col.decimals !== undefined && col.decimals < 31) return v.toFixed(col.decimals);
      }
      if (typeof v === 'number') return fmtNumber(v);
      return String(v);
    }

    // INSERT / REPLACE
    insert(toks) {
      const db = this.database();
      const s = sig(toks);
      let i = 1, verb = kw(s[0]) === 'REPLACE' ? 'REPLACE' : 'INSERT', ignore = false;
      while (['LOW_PRIORITY', 'DELAYED', 'HIGH_PRIORITY', 'IGNORE', 'INTO'].includes(kw(s[i]))) { if (kw(s[i]) === 'IGNORE') ignore = true; i++; }
      let table = identName(s[i]);
      if (s[i + 1] && s[i + 1].v === '.') { table = identName(s[i + 2]); i += 2; }
      const meta = this.tableMeta(table, true);
      i++;
      let cols = null;
      let valuesSql = null;
      let tuples = null;
      if (s[i] && s[i].v === '(' && !(kw(s[i + 1]) === 'SELECT')) {
        const e = matchParen(s, i);
        cols = splitTopLevel(s.slice(i + 1, e)).map((c) => identName(c.filter((t) => !isWs(t)).slice(-1)[0]));
        i = e + 1;
      }
      const K = kw(s[i]);
      if (K === 'SET') {
        const assigns = splitTopLevel(s.slice(i + 1));
        cols = [];
        const vals = [];
        for (const a of assigns) {
          const eq = a.findIndex((t) => t.v === '=');
          cols.push(identName(a.slice(0, eq).filter((t) => !isWs(t)).slice(-1)[0]));
          vals.push(a.slice(eq + 1));
        }
        tuples = [vals];
      } else if (K === 'VALUES' || K === 'VALUE') {
        tuples = [];
        let k = i + 1;
        while (k < s.length) {
          if (s[k].v === '(') {
            const e = matchParen(s, k);
            tuples.push(splitTopLevel(s.slice(k + 1, e)));
            k = e + 1;
          } else k++;
        }
      } else if (K === 'SELECT' || (s[i] && s[i].v === '(')) {
        valuesSql = this.translateSelect(tokenize(rawOf(s.slice(i)).replace(/^\(|\)$/g, ''))).sql;
      } else throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(s.slice(i)).slice(0, 80) + "' at line 1");
      const allCols = meta.columns.map((c) => c.name);
      const colList = cols || allCols;
      for (const c of colList) {
        if (!meta.columns.some((m) => m.name.toLowerCase() === c.toLowerCase())) throw new SqlError(1054, "Unknown column '" + c + "' in 'field list'");
      }
      const auto = meta.columns.find((c) => c.autoInc);
      const autoIdx = auto ? colList.findIndex((c) => c.toLowerCase() === auto.name.toLowerCase()) : -1;
      let sql = (verb === 'REPLACE' ? 'REPLACE' : ignore ? 'INSERT OR IGNORE' : 'INSERT') + ' INTO ' + qid(table) + ' (' + colList.map(qid).join(', ') + ') ';
      if (tuples) {
        const rendered = [];
        let rowNo = 0;
        for (const tup of tuples) {
          rowNo++;
          if (tup.length !== colList.length) throw new SqlError(1136, "Column count doesn't match value count at row " + rowNo);
          rendered.push('(' + tup.map((v, k) => {
            const st = sig(v);
            if (k === autoIdx && st.length === 1 && (kw(st[0]) === 'NULL' || (st[0].t === 'num' && Number(st[0].v) === 0) || (st[0].t === 'str' && (st[0].v === '' || Number(st[0].v) === 0)))) return 'NULL';
            if (st.length === 1 && kw(st[0]) === 'DEFAULT') {
              const c = meta.columns.find((x) => x.name.toLowerCase() === colList[k].toLowerCase());
              return c && c.def !== null && c.def !== undefined ? sqlStr(String(c.def)) : 'NULL';
            }
            // MySQL stores NULL in a NOT NULL column as the implicit default (multi-row) -- keep SQLite's error for single rows
            return render(rewriteIntervals(v));
          }).join(', ') + ')');
        }
        sql += 'VALUES ' + rendered.join(', ');
      } else sql += valuesSql;
      this._dupValue = null;
      this._dupKey = 1;
      if (tuples && tuples.length === 1) {
        // remember the values of unique keys for "Duplicate entry" messages
        const keyCols = meta.keys.filter((k) => k.kind !== 'MUL');
        for (let ki = 0; ki < keyCols.length; ki++) {
          const vals = keyCols[ki].cols.map((kc) => {
            const at = colList.findIndex((c) => c.toLowerCase() === kc.toLowerCase());
            if (at < 0) return null;
            const st = sig(tuples[0][at]);
            return st.length === 1 ? st[0].v : rawOf(tuples[0][at]).trim();
          });
          if (vals.every((v) => v !== null)) {
            const where = keyCols[ki].cols.map((kc, x) => qid(kc) + ' = ' + sqlStr(String(vals[x]))).join(' AND ');
            try {
              const hit = db.exec('SELECT 1 FROM ' + qid(table) + ' WHERE ' + where + ' LIMIT 1');
              if (hit.length && hit[0].values.length) { this._dupValue = vals.join('-'); this._dupKey = ki + 1; break; }
            } catch (e) {}
          }
        }
      }
      const before = verb === 'REPLACE' ? this.countRows(table) : 0;
      db.run(sql);
      let affected = db.getRowsModified();
      if (verb === 'REPLACE') affected += Math.max(0, before + affected - this.countRows(table));
      this.srv.dirty.add(this.db);
      let insertId = 0;
      if (auto && affected) {
        const last = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        insertId = tuples && tuples.length > 1 ? last - (db.getRowsModified() - 1) : last;
        this.lastInsertId = insertId;
      }
      const info = tuples && tuples.length > 1 ? 'Records: ' + tuples.length + '  Duplicates: ' + (tuples.length - affected) + '  Warnings: 0' : valuesSql ? 'Records: ' + affected + '  Duplicates: 0  Warnings: 0' : '';
      return { affected, insertId, info };
    }

    countRows(table) {
      return this.database().exec('SELECT count(*) FROM ' + qid(table))[0].values[0][0];
    }

    whereOrderLimit(s, from) {
      // split tail tokens into WHERE / ORDER BY / LIMIT parts
      let where = null, order = null, limit = null, k = from, depth = 0;
      let cur = null, buf = [];
      const flush = () => { if (cur === 'WHERE') where = buf; if (cur === 'ORDER') order = buf.slice(1); if (cur === 'LIMIT') limit = buf; };
      for (; k < s.length; k++) {
        const t = s[k];
        if (t.v === '(') depth++;
        if (t.v === ')') depth--;
        const K = kw(t);
        if (depth === 0 && (K === 'WHERE' || K === 'ORDER' || K === 'LIMIT')) { flush(); cur = K; buf = []; continue; }
        buf.push(t);
      }
      flush();
      return { where, order, limit };
    }

    update(toks) {
      const db = this.database();
      const s = sig(toks);
      let i = 1;
      while (['LOW_PRIORITY', 'IGNORE'].includes(kw(s[i]))) i++;
      const table = identName(s[i]);
      const meta = this.tableMeta(table, true);
      if (kw(s[i + 1]) !== 'SET') throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(s.slice(i + 1)).slice(0, 80) + "' at line 1");
      // assignments run up to WHERE/ORDER/LIMIT
      let k = i + 2, depth = 0;
      for (; k < s.length; k++) {
        if (s[k].v === '(') depth++;
        if (s[k].v === ')') depth--;
        if (depth === 0 && ['WHERE', 'ORDER', 'LIMIT'].includes(kw(s[k]))) break;
      }
      const assigns = splitTopLevel(s.slice(i + 2, k)).map((a) => {
        const eq = a.findIndex((t) => t.v === '=');
        const col = identName(a.slice(0, eq).filter((t) => !isWs(t)).slice(-1)[0]);
        if (!meta.columns.some((c) => c.name.toLowerCase() === col.toLowerCase())) throw new SqlError(1054, "Unknown column '" + col + "' in 'field list'");
        return { col, expr: render(rewriteIntervals(a.slice(eq + 1))) };
      });
      const { where, order, limit } = this.whereOrderLimit(s, k);
      let cond = where ? '(' + render(rewriteIntervals(where)) + ')' : '1';
      // MySQL counts (and touches) only rows whose values actually change
      cond += ' AND NOT (' + assigns.map((a) => qid(a.col) + ' IS (' + a.expr + ') COLLATE BINARY').join(' AND ') + ')';
      if (order || limit) cond = 'rowid IN (SELECT rowid FROM ' + qid(table) + ' WHERE ' + cond + (order ? ' ORDER BY ' + render(order) : '') + (limit ? ' LIMIT ' + render(limit) : '') + ')';
      const matched = db.exec('SELECT count(*) FROM ' + qid(table) + (where ? ' WHERE ' + render(rewriteIntervals(where)) : ''))[0].values[0][0];
      db.run('UPDATE ' + qid(table) + ' SET ' + assigns.map((a) => qid(a.col) + ' = ' + a.expr).join(', ') + ' WHERE ' + cond);
      const changed = db.getRowsModified();
      this.srv.dirty.add(this.db);
      return { affected: changed, info: 'Rows matched: ' + (limit ? Math.min(matched, Number(render(limit))) || matched : matched) + '  Changed: ' + changed + '  Warnings: 0' };
    }

    del(toks) {
      const db = this.database();
      const s = sig(toks);
      let i = 1;
      while (['LOW_PRIORITY', 'QUICK', 'IGNORE'].includes(kw(s[i]))) i++;
      if (kw(s[i]) === 'FROM') i++;
      const table = identName(s[i]);
      this.tableMeta(table, true);
      const { where, order, limit } = this.whereOrderLimit(s, i + 1);
      if (!where && !limit) {
        // MySQL 3.23 recreates the table: affected rows are reported as 0 and
        // AUTO_INCREMENT starts over
        db.run('DELETE FROM ' + qid(table));
        try { db.run('DELETE FROM sqlite_sequence WHERE name = ?', [table]); } catch (e) {}
        this.srv.dirty.add(this.db);
        return { affected: 0 };
      }
      let cond = where ? render(rewriteIntervals(where)) : '1';
      if (order || limit) cond = 'rowid IN (SELECT rowid FROM ' + qid(table) + ' WHERE ' + cond + (order ? ' ORDER BY ' + render(order) : '') + (limit ? ' LIMIT ' + render(limit) : '') + ')';
      db.run('DELETE FROM ' + qid(table) + ' WHERE ' + cond);
      this.srv.dirty.add(this.db);
      return { affected: db.getRowsModified() };
    }

    describe(table, like) {
      const meta = this.tableMeta(table, true);
      const rows = meta.columns
        .filter((c) => !like || likeMatch(c.name, like))
        .map((c) => [c.name, c.display, c.notNull ? '' : 'YES', c.key || '', c.def === undefined ? null : c.def, c.autoInc ? 'auto_increment' : '']);
      return this.makeResult(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'], rows);
    }

    show(s) {
      const K = kw(s[1]);
      const likeAt = s.findIndex((t) => kw(t) === 'LIKE');
      const like = likeAt >= 0 ? s[likeAt + 1].v : null;
      if (K === 'DATABASES') {
        const names = [...this.srv.dbs.keys()].sort().filter((n) => !like || likeMatch(n, like));
        return this.makeResult(['Database'], names.map((n) => [n]));
      }
      if (K === 'TABLES' || (K === 'OPEN' && kw(s[2]) === 'TABLES')) {
        const fromAt = s.findIndex((t) => kw(t) === 'FROM' || kw(t) === 'IN');
        const dbName = fromAt >= 0 ? identName(s[fromAt + 1]) : this.db;
        if (!dbName) throw new SqlError(1046, 'No Database Selected');
        if (!this.srv.dbs.has(dbName)) throw new SqlError(1049, "Unknown database '" + dbName + "'");
        const save = this.db;
        this.db = dbName;
        const names = this.listTables().filter((n) => !like || likeMatch(n, like));
        this.db = save;
        return this.makeResult(['Tables_in_' + dbName + (like ? ' (' + like + ')' : '')], names.map((n) => [n]));
      }
      if (K === 'COLUMNS' || K === 'FIELDS' || (K === 'FULL' && (kw(s[2]) === 'COLUMNS' || kw(s[2]) === 'FIELDS'))) {
        const fromAt = s.findIndex((t) => kw(t) === 'FROM' || kw(t) === 'IN');
        const r = this.describe(identName(s[fromAt + 1]), like);
        return r;
      }
      if (K === 'INDEX' || K === 'KEYS' || K === 'INDEXES') {
        const fromAt = s.findIndex((t) => kw(t) === 'FROM' || kw(t) === 'IN');
        const table = identName(s[fromAt + 1]);
        const meta = this.tableMeta(table, true);
        const rows = [];
        for (const k of meta.keys) k.cols.forEach((c, n) => rows.push([table, k.kind === 'MUL' ? '1' : '0', k.name, String(n + 1), c, 'A', null, null, null, '']));
        return this.makeResult(['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name', 'Collation', 'Cardinality', 'Sub_part', 'Packed', 'Comment'], rows);
      }
      if (K === 'TABLE' && kw(s[2]) === 'STATUS') {
        const names = this.listTables().filter((n) => !like || likeMatch(n, like));
        const now = fmtDateTime(new Date());
        const rows = names.map((n) => {
          const cnt = this.countRows(n);
          let ai = null;
          try { const r = this.database().exec('SELECT seq FROM sqlite_sequence WHERE name = ' + sqlStr(n)); ai = r.length ? String(r[0].values[0][0] + 1) : null; } catch (e) {}
          const meta = this.tableMeta(n, false);
          if (meta && meta.columns.some((c) => c.autoInc) && ai === null) ai = '1';
          return [n, 'MyISAM', 'Dynamic', String(cnt), cnt ? '20' : '0', String(cnt * 20), '4294967295', '1024', '0', ai, now, now, null, '', ''];
        });
        return this.makeResult(['Name', 'Type', 'Row_format', 'Rows', 'Avg_row_length', 'Data_length', 'Max_data_length', 'Index_length', 'Data_free', 'Auto_increment', 'Create_time', 'Update_time', 'Check_time', 'Create_options', 'Comment'], rows);
      }
      if (K === 'CREATE' && kw(s[2]) === 'TABLE') {
        const table = identName(s[3]);
        const meta = this.tableMeta(table, true);
        const lines = meta.columns.map((c) => '  `' + c.name + '` ' + c.display + (c.notNull ? ' NOT NULL' : '') +
          (c.def !== null && c.def !== undefined ? " default '" + c.def + "'" : c.notNull || c.autoInc ? '' : ' default NULL') + (c.autoInc ? ' auto_increment' : ''));
        for (const k of meta.keys) lines.push('  ' + (k.kind === 'PRI' ? 'PRIMARY KEY' : (k.kind === 'UNI' ? 'UNIQUE KEY ' : 'KEY ') + '`' + k.name + '`') + ' (`' + k.cols.join('`,`') + '`)');
        return this.makeResult(['Table', 'Create Table'], [[table, 'CREATE TABLE `' + table + '` (\n' + lines.join(',\n') + '\n) TYPE=MyISAM']]);
      }
      if (K === 'VARIABLES') {
        const vars = [['back_log', '50'], ['basedir', '/usr/'], ['character_set', 'latin1'], ['concurrent_insert', 'ON'], ['connect_timeout', '5'],
          ['datadir', '/var/lib/mysql/'], ['have_bdb', 'NO'], ['have_innodb', 'NO'], ['have_isam', 'YES'], ['have_raid', 'NO'], ['have_symlink', 'YES'],
          ['have_openssl', 'NO'], ['interactive_timeout', '28800'], ['key_buffer_size', '8388600'], ['language', '/usr/share/mysql/english/'],
          ['log', 'OFF'], ['long_query_time', '10'], ['lower_case_table_names', '0'], ['max_allowed_packet', '1048576'], ['max_connections', '100'],
          ['max_heap_table_size', '16777216'], ['pid_file', '/var/lib/mysql/phpsim.pid'], ['port', '3306'], ['protocol_version', '10'],
          ['skip_networking', 'OFF'], ['socket', '/tmp/mysql.sock'], ['table_type', 'MYISAM'], ['timezone', 'PST'], ['tmpdir', '/tmp/'],
          ['version', SERVER_VERSION + '-log'], ['wait_timeout', '28800']];
        return this.makeResult(['Variable_name', 'Value'], vars.filter((v) => !like || likeMatch(v[0], like)));
      }
      if (K === 'STATUS') {
        const up = Math.max(1, Math.floor((Date.now() - this.srv.started) / 1000));
        const st = [['Aborted_clients', '0'], ['Aborted_connects', '0'], ['Connections', String(this.srv.nextThread - 1)], ['Open_tables', '0'],
          ['Questions', String(this.srv.questions)], ['Slow_queries', '0'], ['Threads_connected', String(Math.max(1, this.srv.conns.size))], ['Uptime', String(up)]];
        return this.makeResult(['Variable_name', 'Value'], st.filter((v) => !like || likeMatch(v[0], like)));
      }
      if (K === 'PROCESSLIST' || (K === 'FULL' && kw(s[2]) === 'PROCESSLIST')) return this.processList();
      if (K === 'GRANTS') return this.makeResult(['Grants for root@localhost'], [['GRANT ALL PRIVILEGES ON *.* TO \'root\'@\'localhost\' WITH GRANT OPTION']]);
      throw new SqlError(1064, "You have an error in your SQL syntax near '" + rawOf(s.slice(1)).slice(0, 80) + "' at line 1");
    }
  }

  function likeMatch(str, pattern) {
    let re = '^';
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === '\\' && i + 1 < pattern.length) { re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
      if (c === '%') re += '.*';
      else if (c === '_') re += '.';
      else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(re + '$', 'i').test(str);
  }

  MysqlServer.prototype.connect = function () { return new Connection(this); };
  MysqlServer.SERVER_VERSION = SERVER_VERSION;
  MysqlServer.tokenize = tokenize;

  if (typeof module !== 'undefined' && module.exports) module.exports = MysqlServer;
  else root.MysqlServer = MysqlServer;
})(typeof self !== 'undefined' ? self : this);
