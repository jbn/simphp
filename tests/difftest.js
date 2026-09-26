#!/usr/bin/env node
// Differential test: run every tests/corpus/*.php on
//   (a) native PHP 4.1.1 built for i386 Linux/glibc (reference/Dockerfile)
//   (b) the wasm build
// with identical paths/env, and compare stdout byte-for-byte.
//
//   node tests/difftest.js [-v] [name-filter]
//
// Reference outputs are cached in tests/corpus/.ref keyed by content hash.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const SimPHP = require('../web/simphp-core.js');
const createPHP = require('../web/php.js');

const ROOT = path.join(__dirname, '..');
const CORPUS = path.join(__dirname, 'corpus');
const REF = path.join(CORPUS, '.ref');
const IMAGE = 'simphp-reference';
const ENV = { TZ: 'UTC', PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/root', LANG: 'C' };

const verbose = process.argv.includes('-v');
const filter = process.argv.slice(2).find((a) => !a.startsWith('-'));

function listCorpus() {
  return fs.readdirSync(CORPUS).filter((f) => f.endsWith('.php') && (!filter || f.includes(filter))).sort();
}
const hashOf = (f) => crypto.createHash('sha1').update(fs.readFileSync(path.join(CORPUS, f)))
  .update(fs.existsSync(path.join(CORPUS, f + '.stdin')) ? fs.readFileSync(path.join(CORPUS, f + '.stdin')) : '')
  .update(fs.existsSync(path.join(CORPUS, f + '.post')) ? fs.readFileSync(path.join(CORPUS, f + '.post')) : '')
  .digest('hex').slice(0, 16);

// A corpus file can declare a CGI request instead of a command-line run:
//   // CGI: POST /form.php?a=1
//   // COOKIE: x=1; y=2
//   // CONTENT-TYPE: multipart/form-data; boundary=XyZ
// with the request body in <file>.post (sent on stdin, like Apache does).
function cgiFor(f) {
  const src = fs.readFileSync(path.join(CORPUS, f), 'latin1');
  const m = src.match(/^\/\/ CGI: (GET|POST) (\S+)$/m);
  if (!m) return null;
  const [pathPart, query = ''] = m[2].split('?');
  const env = {
    SERVER_SOFTWARE: 'Apache/1.3.22 (Unix)', SERVER_NAME: 'localhost', SERVER_PORT: '80', GATEWAY_INTERFACE: 'CGI/1.1',
    SERVER_PROTOCOL: 'HTTP/1.1', REQUEST_METHOD: m[1], QUERY_STRING: query, REQUEST_URI: m[2], SCRIPT_NAME: pathPart,
    SCRIPT_FILENAME: '/t/' + f, PATH_TRANSLATED: '/t/' + f, DOCUMENT_ROOT: '/t', REMOTE_ADDR: '127.0.0.1', REDIRECT_STATUS: '200',
    HTTP_HOST: 'localhost', HTTP_USER_AGENT: 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)',
  };
  const ck = src.match(/^\/\/ COOKIE: (.*)$/m);
  if (ck) env.HTTP_COOKIE = ck[1];
  const postFile = path.join(CORPUS, f + '.post');
  const body = fs.existsSync(postFile) ? fs.readFileSync(postFile) : Buffer.alloc(0);
  if (m[1] === 'POST') {
    const ct = src.match(/^\/\/ CONTENT-TYPE: (.*)$/m);
    env.CONTENT_TYPE = ct ? ct[1] : 'application/x-www-form-urlencoded';
    env.CONTENT_LENGTH = String(body.length);
  }
  return { env, body };
}

function argsFor(f) {
  const src = fs.readFileSync(path.join(CORPUS, f), 'latin1');
  const m = src.match(/^\/\/ ARGS: (.*)$/m);
  return m ? m[1].split(' ').filter(Boolean) : [];
}

function refresh(files) {
  fs.mkdirSync(REF, { recursive: true });
  const stale = files.filter((f) => !fs.existsSync(path.join(REF, f + '.' + hashOf(f) + '.out')));
  if (!stale.length) return;
  console.log(`reference: running ${stale.length} script(s) in docker (${IMAGE})...`);
  const lines = ['set +e', 'mkdir -p /t && cp -r /corpus/. /t/ && cd /t'];
  for (const f of stale) {
    const h = hashOf(f);
    const cgi = cgiFor(f);
    const q = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`;
    if (cgi) {
      const stdin = fs.existsSync(path.join(CORPUS, f + '.post')) ? `/t/${f}.post` : '/dev/null';
      lines.push(`rm -rf /tmp/simphp && mkdir -p /tmp/simphp && cd /t && env -i ${Object.entries({ ...ENV, ...cgi.env }).map(([k, v]) => `${k}=${q(v)}`).join(' ')} ` +
        `timeout 60 php < ${stdin} > /out/${f}.${h}.out 2>/out/${f}.${h}.err; echo $? > /out/${f}.${h}.rc`);
      continue;
    }
    const stdin = fs.existsSync(path.join(CORPUS, f + '.stdin')) ? `/t/${f}.stdin` : '/dev/null';
    const extra = argsFor(f).map((a) => `'${a}'`).join(' ');
    lines.push(`rm -rf /tmp/simphp && mkdir -p /tmp/simphp && cd /t && env -i ${Object.entries(ENV).map(([k, v]) => `${k}='${v}'`).join(' ')} ` +
      `timeout 60 php -q /t/${f} ${extra} < ${stdin} > /out/${f}.${h}.out 2>/out/${f}.${h}.err; echo $? > /out/${f}.${h}.rc`);
  }
  const script = path.join(REF, 'run.sh');
  fs.writeFileSync(script, lines.join('\n') + '\n');
  execFileSync('docker', ['run', '--rm', '--platform', 'linux/386', '--tmpfs', '/tmp', '--network', 'none', '-v', `${CORPUS}:/corpus:ro`, '-v', `${REF}:/out`,
    IMAGE, 'sh', '/out/run.sh'], { stdio: 'inherit' });
}

function mountCorpus(dir = CORPUS, prefix = '/t', files = {}) {
  for (const f of fs.readdirSync(dir)) {
    if (f === '.ref') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) mountCorpus(p, prefix + '/' + f, files);
    else files[prefix + '/' + f] = fs.readFileSync(p);
  }
  return files;
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

(async () => {
  const files = listCorpus();
  refresh(files);
  const sim = await SimPHP.create({ createPHP, wasmBinary: fs.readFileSync(path.join(ROOT, 'web/php.wasm')) });
  const mounted = mountCorpus();
  let pass = 0, fail = 0;
  for (const f of files) {
    const h = hashOf(f);
    const ref = fs.readFileSync(path.join(REF, `${f}.${h}.out`));
    const stdinFile = path.join(CORPUS, f + '.stdin');
    const cgi = cgiFor(f);
    const r = cgi
      ? await sim.run({ args: [], env: { ...ENV, ...cgi.env }, cwd: '/t', files: { ...mounted, '/tmp/simphp/': null }, stdin: cgi.body, collectFiles: false })
      : await sim.run({ args: ['-q', '/t/' + f, ...argsFor(f)], env: ENV, cwd: '/t', files: { ...mounted, '/tmp/simphp/': null },
        stdin: fs.existsSync(stdinFile) ? fs.readFileSync(stdinFile) : '', collectFiles: false });
    const got = Buffer.from(r.stdout);
    if (Buffer.compare(ref, got) === 0) { pass++; if (verbose) console.log('ok   ' + f); continue; }
    fail++;
    const i = firstDiff(ref, got);
    const lineNo = ref.subarray(0, i).toString('latin1').split('\n').length;
    console.log(`DIFF ${f} (line ${lineNo})` + (r.aborted ? ` [${r.aborted}]` : ''));
    const ctx = (buf) => JSON.stringify(buf.subarray(Math.max(0, i - 60), i + 80).toString('latin1'));
    console.log('   native: ' + ctx(ref));
    console.log('   wasm:   ' + ctx(got));
  }
  console.log(`\n${pass} identical, ${fail} different (of ${files.length})`);
  process.exitCode = fail ? 1 : 0;
})();
