#!/usr/bin/env node
// Snapshot tests for the emulated MySQL server (web/mysqld.js), driven through
// PHP 4.1.1's real mysql extension. Each tests/mysql/*.php runs against a fresh
// server; its output must match tests/mysql/<name>.out.
//   node tests/mysql-test.js [--update]
'use strict';
const fs = require('fs');
const path = require('path');
const PHPSim = require('../web/phpsim-core.js');
const createPHP = require('../web/php.js');
const initSqlJs = require('../web/vendor/sqljs/sql-wasm.js');

const DIR = path.join(__dirname, 'mysql');
const update = process.argv.includes('--update');

(async () => {
  const SQL = await initSqlJs({ locateFile: (f) => path.join(__dirname, '../web/vendor/sqljs', f) });
  const wasmModule = await WebAssembly.compile(fs.readFileSync(path.join(__dirname, '../web/php.wasm')));
  let pass = 0, fail = 0;
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.php')).sort()) {
    const sim = await PHPSim.create({ createPHP, wasmModule, SQL });
    const r = await sim.run({ args: ['-q', '/var/www/' + f], env: { TZ: 'UTC' }, cwd: '/var/www',
      files: { ['/var/www/' + f]: fs.readFileSync(path.join(DIR, f)) }, collectFiles: false });
    const got = Buffer.from(r.stdout).toString('latin1');
    const expFile = path.join(DIR, f.replace(/\.php$/, '.out'));
    if (update || !fs.existsSync(expFile)) { fs.writeFileSync(expFile, got, 'latin1'); console.log('wrote ' + path.basename(expFile)); continue; }
    const exp = fs.readFileSync(expFile, 'latin1');
    if (exp === got) { pass++; continue; }
    fail++;
    const a = exp.split('\n'), b = got.split('\n');
    const i = a.findIndex((l, k) => l !== b[k]);
    console.log(`FAIL ${f} line ${i + 1}\n  expected: ${JSON.stringify(a[i])}\n  got:      ${JSON.stringify(b[i])}`);
  }
  console.log(`\nmysql: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
