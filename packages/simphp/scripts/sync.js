#!/usr/bin/env node
// Copy the built engine from the simulator's web/ directory into dist/.
// Runs before `npm pack`/`npm publish`; run `./build.sh` at the repo root first.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const WEB = path.join(ROOT, 'web');
const DIST = path.join(__dirname, '../dist');

const FILES = [
  ['php.js', 'php.js'],
  ['php.wasm', 'php.wasm'],
  ['php-jspi.js', 'php-jspi.js'],
  ['php-jspi.wasm', 'php-jspi.wasm'],
  ['simphp-core.js', 'simphp-core.js'],
  ['mysqld.js', 'mysqld.js'],
  ['vendor/sqljs/sql-wasm.js', 'sqljs/sql-wasm.js'],
  ['vendor/sqljs/sql-wasm.wasm', 'sqljs/sql-wasm.wasm'],
  ['ini/php.ini-dist', 'ini/php.ini-dist'],
  ['ini/php.ini-recommended', 'ini/php.ini-recommended'],
];

fs.rmSync(DIST, { recursive: true, force: true });
for (const [from, to] of FILES) {
  const src = path.join(WEB, from);
  if (!fs.existsSync(src)) {
    console.error(`sync: missing ${path.relative(ROOT, src)} (run ./build.sh at the repo root)`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.join(DIST, to)), { recursive: true });
  fs.copyFileSync(src, path.join(DIST, to));
}

// License texts and notices for everything compiled into the binaries.
fs.cpSync(path.join(WEB, 'licenses'), path.join(DIST, 'licenses'), { recursive: true });

console.log(`sync: copied ${FILES.length} files into ${path.relative(process.cwd(), DIST) || '.'}`);
