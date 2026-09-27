#!/usr/bin/env node
// Runs PHP 4.1.1's own .phpt tests against the wasm build, mirroring the
// semantics of the original run-tests.php (CGI env, header skipping, and
// whitespace-insensitive line comparison).
//   node tests/run-phpt.js [dir-or-file ...]   (default: the 4.1.1 test dirs)
'use strict';
const fs = require('fs');
const path = require('path');
const SimPHP = require('../web/simphp-core.js');
const createPHP = require('../web/php.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'build/php-4.1.1');
const DEFAULT_DIRS = ['tests', 'ext/standard/tests', 'ext/xml/tests', 'ext/session/tests',
  'ext/ctype/tests', 'pear/tests'].map((d) => path.join(SRC, d));
// Bundled tests that fail on native PHP 4.1.1 too (tests/difftest.js shows our
// output is identical to it): they expect later behavior or a Latin-1 locale.
// They are reported but don't fail the run.
const KNOWN_FAILURES = new Set(['tests/lang/029.phpt', 'ext/standard/tests/math/pow.phpt', 'ext/xml/tests/007.phpt']);

function findTests(p, out) {
  const st = fs.statSync(p);
  if (st.isFile()) { if (p.endsWith('.phpt')) out.push(p); return out; }
  for (const n of fs.readdirSync(p).sort()) findTests(path.join(p, n), out);
  return out;
}

function parse(file) {
  const sec = {};
  let cur = null;
  for (const line of fs.readFileSync(file, 'latin1').split(/(?<=\n)/)) {
    const m = line.match(/^--([A-Z]+)--/);
    if (m) { cur = m[1]; sec[cur] = ''; continue; }
    if (cur) sec[cur] += cur === 'POST' ? line.trim() : line;
  }
  return sec;
}

// compare_results() from run-tests.php: concatenate trimmed non-blank lines.
function norm(s) {
  return s.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('');
}

function skipHeaders(s) {
  const lines = s.split('\n');
  let i = 0;
  while (i < lines.length) { if (lines[i++].trim() === '') break; }
  return lines.slice(i).join('\n');
}

(async () => {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const verbose = process.argv.includes('-v');
  const files = [];
  for (const t of (targets.length ? targets.map((t) => path.resolve(t)) : DEFAULT_DIRS)) {
    if (fs.existsSync(t)) findTests(t, files);
  }
  const sim = await SimPHP.create({ createPHP, wasmBinary: fs.readFileSync(path.join(ROOT, 'web/php.wasm')) });
  // shared fixtures (quicktester.inc, PEAR sources) at their source-tree paths
  const common = {};
  const mount = (d, depth = 0) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n), st = fs.statSync(p);
      if (st.isDirectory()) { if (depth < 4) mount(p, depth + 1); }
      else if (st.size < 1 << 20) common['/src/' + path.relative(SRC, p)] = fs.readFileSync(p);
    }
  };
  mount(path.join(SRC, 'tests'));
  mount(path.join(SRC, 'pear'));
  let pass = 0, fail = 0, skip = 0;
  const failed = [];
  for (const file of [...new Set(files)]) {
    const sec = parse(file);
    const dir = '/src/' + path.relative(SRC, path.dirname(file));
    const env = { PHP_TEST: '1', REDIRECT_STATUS: '1', QUERY_STRING: (sec.GET || '').replace(/\n$/, ''), PATH: '/bin' };
    const fsFiles = { ...common };
    // expose sibling fixture files (some tests read them)
    for (const n of fs.readdirSync(path.dirname(file))) {
      const p = path.join(path.dirname(file), n);
      if (fs.statSync(p).isFile() && fs.statSync(p).size < 1 << 20) fsFiles[dir + '/' + n] = fs.readFileSync(p);
    }
    const rel = path.relative(SRC, file);
    if (sec.SKIPIF !== undefined) {
      fsFiles[dir + '/phpt.skipif'] = Buffer.from(sec.SKIPIF, 'latin1');
      const r = await sim.run({ args: ['-q', '-f', dir + '/phpt.skipif'], cwd: dir, files: fsFiles, collectFiles: false,
        env: { ...env, REQUEST_METHOD: 'GET', PATH_TRANSLATED: dir + '/phpt.skipif', SCRIPT_FILENAME: dir + '/phpt.skipif' } });
      const o = skipHeaders(Buffer.from(r.stdout).toString('latin1'));
      if (o.split('\n')[0].trim().startsWith('skip')) { skip++; if (verbose) console.log('SKIP ' + rel); continue; }
    }
    fsFiles[dir + '/phpt.file'] = Buffer.from(sec.FILE || '', 'latin1');
    Object.assign(env, { PATH_TRANSLATED: dir + '/phpt.file', SCRIPT_FILENAME: dir + '/phpt.file' });
    let stdin = '';
    if (sec.POST !== undefined && sec.POST !== '') {
      Object.assign(env, { REQUEST_METHOD: 'POST', CONTENT_TYPE: 'application/x-www-form-urlencoded', CONTENT_LENGTH: String(sec.POST.length) });
      stdin = Buffer.from(sec.POST, 'latin1');
    } else if (sec.POST !== undefined) {
      // original writes an empty POST file -> still a POST request of length 0
      Object.assign(env, { REQUEST_METHOD: 'POST', CONTENT_TYPE: 'application/x-www-form-urlencoded', CONTENT_LENGTH: '0' });
    } else {
      Object.assign(env, { REQUEST_METHOD: 'GET', CONTENT_TYPE: '', CONTENT_LENGTH: '' });
    }
    const r = await sim.run({ args: ['-q', dir + '/phpt.file'], cwd: dir, files: fsFiles, env, stdin, collectFiles: false });
    const out = skipHeaders(Buffer.from(r.stdout).toString('latin1') + Buffer.from(r.stderr).toString('latin1'));
    const ok = norm(out) === norm(sec.EXPECT || '') && !(norm(out) === '' && norm(sec.EXPECT || '') === '');
    if (ok) { pass++; if (verbose) console.log('PASS ' + rel); }
    else {
      fail++; failed.push(rel);
      console.log((KNOWN_FAILURES.has(rel) ? 'FAIL (known) ' : 'FAIL ') + rel + '  (' + (sec.TEST || '').trim() + ')' + (r.aborted ? ' [' + r.aborted + ']' : ''));
      if (verbose) console.log('--- expected\n' + (sec.EXPECT || '') + '--- got\n' + out + '\n---');
    }
  }
  const unexpected = failed.filter((f) => !KNOWN_FAILURES.has(f));
  console.log(`\npassed ${pass}  failed ${fail} (${fail - unexpected.length} known)  skipped ${skip}  (total ${pass + fail + skip})`);
  process.exitCode = unexpected.length ? 1 : 0;
})();
