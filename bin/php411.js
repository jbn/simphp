#!/usr/bin/env node
// Command-line front end: run a local PHP script through the wasm PHP 4.1.1.
//   node bin/php411.js [php-cgi flags] script.php
// The script's directory is mounted at /var/www so include() works.
'use strict';
const fs = require('fs');
const path = require('path');
const SimPHP = require('../web/simphp-core.js');
const createPHP = require('../web/php.js');

function mountDir(dir, prefix, files, depth = 0) {
  if (depth > 6) return;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!n.startsWith('.') && n !== 'node_modules') mountDir(p, prefix + '/' + n, files, depth + 1); }
    else if (st.size < 8 << 20) files[prefix + '/' + n] = { data: fs.readFileSync(p), mtime: st.mtimeMs };
  }
}

(async () => {
  const argv = process.argv.slice(2);
  const files = {};
  const args = [];
  let cwd = '/var/www';
  for (const a of argv) {
    if (!a.startsWith('-') && fs.existsSync(a) && fs.statSync(a).isFile()) {
      const abs = path.resolve(a);
      mountDir(path.dirname(abs), '/var/www', files);
      args.push('/var/www/' + path.basename(abs));
    } else args.push(a);
  }
  let stdin = '';
  if (!process.stdin.isTTY) { try { stdin = fs.readFileSync(0); } catch (e) {} }
  // The emulated MySQL server (set SIMPHP_MYSQL=0 to run without one)
  let SQL = null;
  if (process.env.SIMPHP_MYSQL !== '0') {
    const initSqlJs = require('../web/vendor/sqljs/sql-wasm.js');
    SQL = await initSqlJs({ locateFile: (f) => path.join(__dirname, '../web/vendor/sqljs', f) });
  }
  const sim = await SimPHP.create({ createPHP, SQL, wasmBinary: fs.readFileSync(path.join(__dirname, '../web/php.wasm')) });
  const r = await sim.run({ args, files, cwd, stdin, env: { PATH: '/usr/local/bin:/usr/bin:/bin', ...(process.env.SIMPHP_ENV ? JSON.parse(process.env.SIMPHP_ENV) : {}) }, collectFiles: false });
  process.stdout.write(r.stdout);
  if (r.stderr.length) process.stderr.write(r.stderr);
  if (r.crash) process.stderr.write('Segmentation fault\n');
  if (r.aborted) process.stderr.write('[simphp] ' + r.aborted + '\n');
  process.exitCode = r.exitCode || 0;
})();
