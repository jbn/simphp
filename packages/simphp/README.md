# simphp

The **original PHP 4.1.1 engine** (December 2001, Zend Engine 1.1.1) compiled to
WebAssembly, as a library. It is the engine behind the
[PHP 4.1.1 Simulator](https://simphp.infinitefun.com): the real C sources, with
output checked byte for byte against a native i386 Linux build. It includes an
optional emulated MySQL 3.23 server.

Runs in Node and in (classic) Web Workers.

```js
const { createSimPHP } = require('simphp');   // or: import { createSimPHP } from 'simphp'

const php = await createSimPHP();              // compile once, run many times
const r = await php.run({
  args: ['-q', '/var/www/hello.php'],
  files: { '/var/www/hello.php': '<?php echo "Hello from ", PHP_VERSION, "\\n";' },
});
new TextDecoder().decode(r.stdout);            // "Hello from 4.1.1\n"
```

## The model: one process per run

PHP 4.1.1 had no CLI SAPI and no embed SAPI. This is the **CGI binary**, and
every `run()` starts a fresh process (a new instance of the compiled wasm
module), the way Apache forked PHP for each hit. Nothing leaks between runs.

* **In:** argv, environment, stdin, and a filesystem (`files`: absolute path →
  string / `Uint8Array` / `{ data, mtime, mode }`, or `'/dir/': null`).
* **Out:** `stdout`, `stderr`, `exitCode`, and the persistent directories
  (`/var/www`, `/tmp`, `/etc`, `/home`, `/var/mail`, `/var/lib/mysql`) as
  `result.files`.

To keep state across runs (sessions in `/tmp`, uploaded or written files, MySQL
databases), pass `result.files` back in as the next run's `files`.

A run is synchronous wasm, so it blocks its thread. In a browser, use a
Worker.

## API

### `createSimPHP(opts?) → Promise<SimPHP>`

| option | |
|---|---|
| `jspi` | `'auto'` (default), `true` or `false`. The JS Promise Integration build runs PHP on a larger stack, which allows deeper PHP recursion. Chrome/Edge have JSPI. Node needs `--experimental-wasm-jspi` (Node 24). |
| `mysql` | `true` starts the emulated MySQL 3.23 server on the bundled sql.js. You can also pass your own initialised sql.js module. |
| `baseUrl` | Web Worker only: the URL of this package's `dist/` directory. |

### `php.run(opts) → Promise<RunResult>`

`args`, `env`, `stdin`, `files`, `cwd`, `mysqld` (set `false` to run without
the server), `maxOutput`, `collectFiles`. The result has
`{ stdout, stderr, exitCode, aborted, crash, files, elapsedMs }`. `crash` is set
where the native binary would have segfaulted (runaway recursion). The exit
code is then 139.

`args` takes php-cgi flags: `-q` (no headers), `-v`, `-i`, `-m`, `-l`, `-s`,
`-d key=value`. `/etc/php.ini` is read when present. `dist/ini/` has the stock
`php.ini-dist` and `php.ini-recommended`.

### `php.request(req) → Promise<{ status, reason, headers, body, result }>`

This serves one HTTP request the way Apache 1.3 ran PHP as a CGI. The URL path
maps to `/var/www`, headers become `HTTP_*` variables, and the body is the POST
data:

```js
const res = await php.request({
  method: 'POST',
  url: '/login.php?next=home',
  headers: { Cookie: 'PHPSESSID=abc', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'user=ann&pass=x',
  files,
});
res.status, res.headers, res.body          // parsed CGI output (Status:/Location: honoured)
files = res.result.files;                  // keep the session file for the next request
```

A crash returns a 500. This is not a web server: it doesn't route static files,
handle directory indexes or follow redirects. Those are left to you.

### Also exported

`cgiEnv(req)` builds the CGI environment. `SimPHP.parseCGI(bytes)` splits CGI
output into status, headers and body. `SimPHP.create({ createPHP, wasmModule,
SQL, MysqlServer })` is the low-level constructor if you load `dist/` yourself
(e.g. from a bundler or a module worker).

## In a Web Worker

Serve the package (including `dist/`) as static files:

```js
// worker.js (a classic worker)
importScripts('/simphp/index.js');
const ready = self.createSimPHP({ baseUrl: '/simphp/dist', mysql: true });
self.onmessage = async (e) => postMessage(await (await ready).run(e.data));
```

## MySQL

With `mysql` enabled, PHP's real `mysql_*` functions and the bundled libmysql
3.23.39 client connect to `/tmp/mysql.sock` or `127.0.0.1:3306`, and an
emulated MySQL 3.23.49 server answers over the wire protocol. It runs on SQLite
and reproduces MySQL 3.23's visible behavior and error messages. Databases
persist as `/var/lib/mysql/<db>.sqlite` in `result.files`. Any user and password
is accepted. SQL outside the common subset may not behave exactly like MySQL.

## What's faithful and what isn't

See the [simulator README](../../README.md). In short: it is 32-bit, with x87
float semantics, glibc sort/`random()`/`strftime()`, Linux errno texts and time
zones via `TZ`. The box is offline (no DNS, `fsockopen()` fails). `exec()`
and friends run an emulated `/bin/sh` with about 45 commands. `mail()` goes to
`/var/mail/outbox`.

## Building

`dist/` is copied from the simulator's `web/` directory by `npm run sync`,
which runs automatically on `npm pack`/`npm publish`. Build the engine first
with `./build.sh` at the repository root. `npm test` runs the smoke tests.

## License

simphp's own code is MIT. The engine in `dist/` is PHP 4.1.1 (PHP License
2.02) with a modified Zend Engine (Zend License 0.92, which is the Q Public
License 1.0). It also contains libbcmath (LGPL 2+), PCRE, expat, Henry
Spencer's regex, the MySQL 3.23 client library and Emscripten's runtime. The
emulated MySQL server uses sql.js (MIT). Every notice and license text is in
`dist/licenses/` (start with `NOTICE.txt`). The complete source, including all
changes to PHP, is at https://github.com/jbn/simphp.

This product includes PHP, freely available from http://www.php.net/

If you redistribute the engine, for example by bundling `dist/` into an app,
keep `dist/licenses/` with it and point to the source.
