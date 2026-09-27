# PHP 4.1.1 Simulator

The **original PHP 4.1.1 source code** (December 2001, Zend Engine 1.1.1),
compiled to WebAssembly and running in your browser behind a simulated 2001-era
Linux web server: Apache 1.3 with PHP as a CGI, a MySQL 3.23 server, a shell,
and sendmail.

This is not a re-implementation. The parser, the Zend executor, every builtin
function and the bundled extensions are the actual C sources from
`php-4.1.1.tar.gz`, built with Emscripten. Quirks, bugs, warning texts, float
formatting, 32-bit integer overflow, magic quotes and `register_globals` all
come from the real engine. Its output is checked **byte for byte** against a
native PHP 4.1.1 built for i386 Linux.

```
npm start            # http://localhost:8411/
```

Live at https://simphp.infinitefun.com.

## What you get

* **Fiddle** (`/fiddle.html`): a jsfiddle-style editor for many projects. Each
  fiddle has its own files and folders (tabs, rename, upload, an entry page),
  server state (`/tmp`, MySQL databases, cookies) and settings. Fiddles are
  saved to IndexedDB as you type, so a reload picks up where you left off.
  **Save** (Ctrl/⌘+S) keeps a numbered version you can restore or fork from
  the History list. **New**, **Fork**, **Share** and **Examples** each create
  a new fiddle.
* **Editor + a virtual server disk**: files under `/var/www`, plus `/etc/php.ini`,
  `/tmp` (sessions, uploads, logs), `/var/mail` and `/var/lib/mysql`. Everything
  persists in your browser.
* **Web mode**: a simulated `Apache/1.3.22 (Unix)` runs PHP as a CGI, the way
  4.1.1 was commonly deployed, starting a fresh PHP process per request with
  the real CGI environment.
  - **Browsing**: the rendered page acts as a browser. Links and form
    submissions (GET, POST, multipart uploads) go back into the server,
    cookies are kept (so sessions work), and redirects are followed.
  - **Inspection**: the Headers tab shows the raw HTTP exchange. `phpinfo()`
    even loads its logos through PHP's own `?=PHPE9568F34-...` requests.
  - **Crashes**: a crashing script gets Apache's `500` and an error-log entry.
* **MySQL 3.23**: `mysql_connect()` reaches an emulated MySQL 3.23.49 server
  (details below). It can be switched off to get the classic "Can't connect to
  local MySQL server through socket '/tmp/mysql.sock' (2)".
* **CLI mode**: runs the CGI binary from a shell as `php -q script.php args`
  (PHP 4.1.1 had no CLI SAPI yet), with stdin, argv and exit status. The flags
  `-s`, `-l`, `-v`, `-i`, `-m` and `-d key=value` work.
* **A small Linux**:
  - **Programs**: `exec()`, `system()`, `passthru()`, backticks and `popen()`
    run an emulated `/bin/sh` with about 45 common commands, pipes and
    redirection.
  - **Mail**: `mail()` goes through `/usr/sbin/sendmail -t -i` into
    `/var/mail/outbox`.
  - **System files and network**: Red Hat 7.2 `/etc` files exist, and the box
    is offline, so DNS and outbound connections fail realistically.
* **Server settings**: time zone (`TZ`), `php.ini` (none / dist / recommended),
  MySQL on/off, page encoding, and a hard kill timeout.
* **Share** puts all your files in a compressed URL. **Examples** cover forms
  and magic quotes, sessions, cookies and redirects, a MySQL guestbook, PHP 4
  objects, regexes, file I/O, errors, output buffering, XML/WDDX,
  bcmath/calendar, `exec()`/`mail()` and more.

## How faithful is it?

It's built from the pristine 4.1.1 sources with the configure flags of a stock
build: standard, PCRE, POSIX regex, XML (expat), sessions, **MySQL (bundled
libmysql 3.23.39)**, bcmath, calendar, ctype and WDDX. POSIX is left out because
there is no real process table in a browser.

`npm test` runs three checks:

* **PHP 4.1.1's own test suite** (`tests/run-phpt.js`, `run-tests.php`
  semantics): 101/104 pass. The other 3 produce output *identical to native
  4.1.1*: those bundled tests expected later behavior or a Latin-1 locale.
* **Differential testing** (`tests/difftest.js`): each of 96 scripts in
  `tests/corpus/` runs on the wasm build and on a **native PHP 4.1.1 compiled
  for i386 Linux/glibc** in Docker (`reference/Dockerfile`, offline, same
  configure flags), and stdout is compared byte for byte.
  - The scripts cover thousands of builtin calls: strings, arrays and sorting,
    math and float printing, dates in many time zones, PCRE/ereg, OO and
    references, errors, files, serialization, XML/WDDX, and exec/mail/MySQL
    error paths.
  - CGI requests are included too: GET/POST, multipart uploads, cookies and
    sessions.
  - **All 96 are identical.**
* **MySQL emulation snapshots** (`tests/mysql-test.js`).

Getting from "it compiles" to "byte-identical" meant reproducing the *platform*
PHP 4.1.1 ran on, not just its source. Each row below was found by differential
testing:

| i386 Linux behavior | What the simulator does |
|---|---|
| 32-bit `long` | wasm32 has 32-bit `long`: integers overflow to float at 2147483647 as they did. |
| x87 FPU: every float op is rounded to a 64-bit significand, then to double (`88.24*76.629 == 6761.74296` is **true**; `round(57.03*25.65, 3)` is `1462.82`) | Zend's `+ - * /`, `++`/`--`, `round()`, `pow()` and `deg2rad()` are emulated in extended precision (quad arithmetic rounded to 64 bits). |
| x87 `double→int`: out of range gives `0x80000000`; `(unsigned long)` goes through `fistpll` (`(int)1e10 === 1410065408`) | `-mno-nontrapping-fptoint` plus an i386-exact `DVAL_TO_LVAL`. |
| x86's negative "default NaN" (`sqrt(-1)` prints `-NAN`; glibc's `acos(2)` prints `NAN`) | NaN signs reproduced per operation. |
| gcc 2.95 didn't exploit undefined behavior (signed overflow, aliasing, uninitialized locals) | `-fwrapv -fno-strict-aliasing -ftrivial-auto-var-init=zero` (the first two on the reference build too). |
| glibc `qsort` is a stable merge sort, which decides the order of equal elements in `sort()`/`usort()` | glibc's `msort`, with the same comparator call order. |
| glibc `random()`, `atoi()` (saturating), `strftime()` (GNU flags, unknown conversions kept) | glibc algorithms reimplemented. |
| glibc's ctype table, read out of range by `ctype_digit(1000)` | The actual table bytes, captured from glibc. |
| `errno` values and `strerror()` texts (`stat failed ... (errno=2 - No such file or directory)`) | Emscripten's WASI numbers mapped to Linux i386 values and glibc messages where PHP shows them. |
| `TZ` environment, zone abbreviations (`JST`, `CEST`), POSIX TZ strings, DST gaps, 32-bit `time_t` | A zone engine on `Intl` plus tzdata abbreviations and glibc `mktime` rules. |
| µs `gettimeofday()` | High-resolution clock (`microtime()`, `uniqid()`). |
| `setitimer`/`SIGPROF` for `max_execution_time` (CPU time; `sleep()` doesn't count) | The executor polls a CPU-time deadline: "Maximum execution time of 30 seconds exceeded". |
| autoconf results of a glibc box (`isnan`, `isinf`, no `strlcpy`, `res_search`, ...) | Pinned in `build.sh`; the generated `php_config.h` matches the native one. |
| Undefined reads that happened to print data (`printf("%f", NAN)` prints `NaN\0IN`) | Same bytes reproduced, without the out-of-bounds read. |
| Segfaults on runaway recursion | wasm stack exhaustion is treated as SIGSEGV (Apache 500 / `Segmentation fault`, exit 139). |
| Offline host, C locale only, `nobody` user, Red Hat 7.2 `/etc` | Emulated at the libc level (`socket/connect/getaddrinfo`, `setlocale`, `getpwuid`). |

All changes to PHP itself are small `#ifdef __EMSCRIPTEN__` patches in
[`patches/`](patches/) (about 240 added lines in total). Everything else lives in
`src/` (libc-level replacements and Emscripten JS libraries) and `web/`.

### The MySQL server

PHP's real mysql extension and client library connect to `/tmp/mysql.sock` (or
`127.0.0.1:3306`), and `web/mysqld.js` answers over the MySQL 3.23 wire
protocol. Queries run on SQLite (sql.js) after dialect translation, and the
server reproduces what scripts can observe of MySQL 3.23:

* auto-increment on `NULL`/`0`/`''`;
* implicit defaults for `NOT NULL` columns, value truncation and clipping,
  `ENUM`/`SET`, `DECIMAL` formatting and `TIMESTAMP(14)` auto-update;
* case-insensitive string columns and "changed rows" `UPDATE` counts;
* `DELETE FROM t` reporting 0 rows;
* `db.table` names, with or without a selected database, and reads that join
  tables of several databases;
* `SHOW`/`DESCRIBE`/`SHOW CREATE TABLE`, and MySQL functions (`NOW`,
  `DATE_FORMAT`, `PASSWORD`, `CONCAT`, ...);
* MySQL error numbers and messages (`1062 Duplicate entry '1' for key 1`, ...).

Databases are stored as `/var/lib/mysql/<db>.sqlite` on the simulated disk. A
fresh server has the `mysql` and `test` databases, and any user/password is
accepted. It is an emulation, so SQL outside the common subset (`MATCH ...
AGAINST`, for example) may not behave exactly like MySQL.

### Known differences

* **Recursion depth**: PHP 4 recurses on the C stack for every PHP function
  call. Native segfaults at about 10,000 levels. Browsers allow about 6,500
  levels with JS Promise Integration (Chrome/Edge) or about 3,500 without.
  Deeper recursion gets the same segfault, just earlier.
* **Transcendental functions**: `pow()`, `exp()`, `sin()` etc. can differ from
  the x87 instructions in the last bit, which is invisible at PHP's default
  `precision=14`.
* **No network**: `fsockopen()` to remote hosts, `fopen("http://...")` and DNS
  fail as on an offline box.
* Pages render in a sandboxed iframe of *your* browser, not Netscape 4 or IE 6.

## Layout

```
build.sh               fetch sources, configure, make, link (plain + JSPI builds)
patches/               the source patches (see above)
src/simphp_sys.c       libc replacements: qsort, random, strftime, popen, sockets, x87 math, ...
src/simphp_lib.js      Emscripten JS library: clock, time zones, CPU time, socket services
src/simphp_shell.js    the emulated /bin/sh (+ sendmail)
src/simphp_force.h     force-included into the PHP build (errno/strftime redirections)
web/                   the app: index.html + app.js (classic), fiddle.html + fiddle.js + fiddle-store.js (fiddles),
                       simweb.js (web server shared by both), worker.js, simphp-core.js, mysqld.js, php*.wasm
bin/php411.js          PHP 4.1.1 in your terminal: node bin/php411.js -q script.php
bin/serve.js           static server for web/
tests/                 phpt runner, differential tests (+ corpus), MySQL snapshots
reference/Dockerfile   native PHP 4.1.1 for i386 Linux, the ground truth
```

## Building

```
./build.sh          # downloads php-4.1.1.tar.gz and emsdk on first run (~3 min)
./build.sh link     # relink only
npm test            # phpt + MySQL + differential tests (the last needs Docker)
```

## Deploying

`web/` is the whole site, and any static host can serve it. The live site is the
Cloudflare Pages project `simphp-infinitefun-com`:

```sh
npm run deploy      # wrangler pages deploy web --project-name simphp-infinitefun-com --branch main
```

Pushes to `main` that touch `web/` deploy automatically
(`.github/workflows/deploy.yml`). The workflow needs the repository secret
`CLOUDFLARE_API_TOKEN` (a token with *Cloudflare Pages: Edit*) and the variable
`CLOUDFLARE_ACCOUNT_ID`.

PHP 4.1.1 is released under the PHP License 2.02 (`build/php-4.1.1/LICENSE`).
sql.js is MIT-licensed (`web/vendor/sqljs/LICENSE`).
