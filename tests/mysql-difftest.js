#!/usr/bin/env node
// Differential test for the emulated MySQL server: run every tests/mysql/*.php
//   (a) on native PHP 4.1.1 talking to a real MySQL 3.23.49 server
//       (reference/mysql.Dockerfile, image simphp-mysql-reference)
//   (b) on the wasm build talking to web/mysqld.js
// and compare stdout byte for byte. Each script gets a fresh server with the
// `mysql` and `test` databases of a new install.
//
//   node tests/mysql-difftest.js [-v] [--update-snapshots] [name-filter]
//
// Reference outputs are cached in tests/mysql/.ref keyed by content hash.
// --update-snapshots copies them to tests/mysql/<name>.out, the snapshots that
// tests/mysql-test.js checks without Docker.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const SimPHP = require('../web/simphp-core.js');
const createPHP = require('../web/php.js');
const initSqlJs = require('../web/vendor/sqljs/sql-wasm.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, 'mysql');
const REF = path.join(DIR, '.ref');
const IMAGE = 'simphp-mysql-reference';
const ENV = { TZ: 'UTC', PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/root', LANG: 'C' };

const verbose = process.argv.includes('-v');
const updateSnapshots = process.argv.includes('--update-snapshots');
const filter = process.argv.slice(2).find((a) => !a.startsWith('-'));

const list = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.php') && (!filter || f.includes(filter))).sort();
const hashOf = (f) => crypto.createHash('sha1').update(fs.readFileSync(path.join(DIR, f))).digest('hex').slice(0, 16);
const refFile = (f) => path.join(REF, `${f}.${hashOf(f)}.out`);

function refresh(files) {
  fs.mkdirSync(REF, { recursive: true });
  const stale = files.filter((f) => !fs.existsSync(refFile(f)));
  if (!stale.length) return;
  console.log(`reference: running ${stale.length} script(s) against MySQL 3.23.49 in docker (${IMAGE})...`);
  const env = Object.entries(ENV).map(([k, v]) => `${k}='${v}'`).join(' ');
  const lines = ['set +e', 'mkdir -p /var/www && cp /scripts/*.php /var/www/'];
  for (const f of stale) {
    const out = `/out/${path.basename(refFile(f))}`;
    lines.push(
      'rm -rf /tmp/mysql-data /tmp/mysql.sock /tmp/simphp && cp -a /usr/local/mysql/data /tmp/mysql-data',
      `env -i ${env} /usr/local/mysql/libexec/mysqld > /tmp/mysqld.log 2>&1 &`,
      'n=0; while [ ! -S /tmp/mysql.sock ] && [ $n -lt 300 ]; do sleep 0.1; n=$((n+1)); done',
      `cd /var/www && env -i ${env} timeout 120 php -q /var/www/${f} < /dev/null > ${out} 2> ${out}.err`,
      '/usr/local/mysql/bin/mysqladmin -uroot shutdown >/dev/null 2>&1; wait');
  }
  fs.writeFileSync(path.join(REF, 'run.sh'), lines.join('\n') + '\n');
  execFileSync('docker', ['run', '--rm', '--platform', 'linux/386', '--tmpfs', '/tmp', '--network', 'none',
    '-v', `${DIR}:/scripts:ro`, '-v', `${REF}:/out`, IMAGE, 'sh', '/out/run.sh'], { stdio: 'inherit' });
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

(async () => {
  const files = list();
  refresh(files);
  const SQL = await initSqlJs({ locateFile: (f) => path.join(ROOT, 'web/vendor/sqljs', f) });
  const wasmModule = await WebAssembly.compile(fs.readFileSync(path.join(ROOT, 'web/php.wasm')));
  let pass = 0, fail = 0;
  for (const f of files) {
    const ref = fs.readFileSync(refFile(f));
    if (updateSnapshots) fs.writeFileSync(path.join(DIR, f.replace(/\.php$/, '.out')), ref);
    const sim = await SimPHP.create({ createPHP, wasmModule, SQL });
    const r = await sim.run({ args: ['-q', '/var/www/' + f], env: ENV, cwd: '/var/www',
      files: { ['/var/www/' + f]: fs.readFileSync(path.join(DIR, f)) }, collectFiles: false });
    const got = Buffer.from(r.stdout);
    if (Buffer.compare(ref, got) === 0) { pass++; if (verbose) console.log('ok   ' + f); continue; }
    fail++;
    const i = firstDiff(ref, got);
    const lineNo = ref.subarray(0, i).toString('latin1').split('\n').length;
    const line = (buf) => { const s = buf.toString('latin1'); const a = s.lastIndexOf('\n', i - 1) + 1; const b = s.indexOf('\n', i); return JSON.stringify(s.slice(a, b < 0 ? s.length : b)); };
    console.log(`DIFF ${f} (line ${lineNo})` + (r.aborted ? ` [${r.aborted}]` : ''));
    console.log('   real:     ' + line(ref));
    console.log('   emulated: ' + line(got));
  }
  console.log(`\nmysql diff: ${pass} identical, ${fail} different (of ${files.length})`);
  process.exitCode = fail ? 1 : 0;
})();
