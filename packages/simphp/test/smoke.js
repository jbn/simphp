// Smoke tests for the package entry points (run `npm run sync` first).
'use strict';
const assert = require('assert/strict');
const { createSimPHP, cgiEnv } = require('..');

const dec = (b) => new TextDecoder().decode(b);
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

let php, phpSQL;

test('CLI-style run', async () => {
  const r = await php.run({
    args: ['-q', '/var/www/a.php', 'x'],
    files: { '/var/www/a.php': '<?php echo PHP_VERSION, " ", $argv[1], " ", 2147483647 + 1;' },
  });
  assert.equal(r.exitCode, 0);
  assert.equal(dec(r.stdout), '4.1.1 x 2147483648');
});

test('include, stdin and files written back', async () => {
  const r = await php.run({
    args: ['-q', '/var/www/main.php'],
    cwd: '/var/www',
    stdin: 'hello',
    files: {
      '/var/www/main.php': '<?php include "lib/f.php"; $in = fopen("php://stdin", "r"); $fp = fopen("/tmp/out.txt", "w"); fwrite($fp, shout(fgets($in, 100))); ?>',
      '/var/www/lib/f.php': '<?php function shout($s) { return strtoupper($s); } ?>',
    },
  });
  assert.equal(r.exitCode, 0, dec(r.stdout));
  assert.equal(dec(r.files['/tmp/out.txt'].data), 'HELLO');
});

test('CGI request with POST, headers and a session round trip', async () => {
  const files = {
    '/var/www/s.php': '<?php session_start(); if (!isset($_SESSION["n"])) $_SESSION["n"] = 0; $_SESSION["n"]++; ' +
      'header("X-Name: " . $_POST["name"]); echo $_SESSION["n"], " ", $_SERVER["REQUEST_METHOD"], " ", $_GET["q"];',
  };
  const r1 = await php.request({ method: 'POST', url: '/s.php?q=1', body: 'name=Ann', files });
  assert.equal(r1.status, 200);
  assert.equal(dec(r1.body), '1 POST 1');
  assert.ok(r1.headers.some(([k, v]) => k === 'X-Name' && v === 'Ann'));
  const cookie = r1.headers.find(([k]) => k === 'Set-Cookie')[1].split(';')[0];
  const r2 = await php.request({ url: '/s.php?q=2', headers: { Cookie: cookie }, files: r1.result.files });
  assert.equal(dec(r2.body), '2 GET 2');
});

test('404-style header and redirect status', async () => {
  const files = {
    '/var/www/nf.php': '<?php header("HTTP/1.0 404 Not Found"); echo "gone";',
    '/var/www/go.php': '<?php header("Location: /x.php");',
  };
  assert.equal((await php.request({ url: '/nf.php', files })).status, 404);
  assert.equal((await php.request({ url: '/go.php', files })).status, 302);
});

test('runaway recursion is a crash, and a 500 over CGI', async () => {
  const files = { '/var/www/r.php': '<?php function f($n) { return f($n + 1); } f(0);' };
  const r = await php.run({ args: ['-q', '/var/www/r.php'], files });
  assert.equal(r.crash && r.crash.signal, 'SIGSEGV');
  assert.equal(r.exitCode, 139);
  assert.equal((await php.request({ url: '/r.php', files })).status, 500);
});

test('php.ini from /etc', async () => {
  const r = await php.run({
    args: ['-q', '/var/www/i.php'],
    files: { '/etc/php.ini': 'precision = 4\n', '/var/www/i.php': '<?php echo 1/3;' },
  });
  assert.equal(dec(r.stdout), '0.3333');
});

test('cgiEnv', () => {
  const env = cgiEnv({ method: 'post', url: '/a/b.php?x=1', headers: { 'User-Agent': 'UA', 'Content-Type': 'text/plain' }, body: 'é' });
  assert.equal(env.REQUEST_METHOD, 'POST');
  assert.equal(env.SCRIPT_FILENAME, '/var/www/a/b.php');
  assert.equal(env.SCRIPT_NAME, '/a/b.php');
  assert.equal(env.QUERY_STRING, 'x=1');
  assert.equal(env.HTTP_USER_AGENT, 'UA');
  assert.equal(env.CONTENT_TYPE, 'text/plain');
  assert.equal(env.CONTENT_LENGTH, '2');
});

test('MySQL server, with state carried in files', async () => {
  const files = {
    '/var/www/m1.php': '<?php mysql_connect("localhost", "root", ""); mysql_select_db("test"); ' +
      'mysql_query("CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY, s VARCHAR(10))"); ' +
      'mysql_query("INSERT INTO t VALUES (NULL, \'a\')"); mysql_query("INSERT INTO t VALUES (1, \'b\')"); echo mysql_errno(), ": ", mysql_error();',
    '/var/www/m2.php': '<?php mysql_connect("localhost"); $r = mysql_query("SELECT id, s FROM test.t"); while ($row = mysql_fetch_row($r)) echo implode("=", $row);',
  };
  const r1 = await phpSQL.run({ args: ['-q', '/var/www/m1.php'], files });
  assert.equal(dec(r1.stdout), "1062: Duplicate entry '1' for key 1");
  assert.ok(r1.files['/var/lib/mysql/test.sqlite']);
  const r2 = await phpSQL.run({ args: ['-q', '/var/www/m2.php'], files: r1.files });
  assert.equal(dec(r2.stdout), '1=a');
});

test('MySQL off: the classic socket error', async () => {
  const r = await php.run({ args: ['-q', '/var/www/c.php'], files: { '/var/www/c.php': '<?php @mysql_connect("localhost"); echo mysql_error();' } });
  assert.equal(dec(r.stdout), "Can't connect to local MySQL server through socket '/tmp/mysql.sock' (2)");
});

(async () => {
  php = await createSimPHP();
  phpSQL = await createSimPHP({ mysql: true });
  console.log(`build: ${php.build}`);
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
  }
  console.log(`${tests.length - failed}/${tests.length} passed`);
  process.exitCode = failed ? 1 : 0;
})();
