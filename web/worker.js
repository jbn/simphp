/*
 * Web Worker hosting the PHP 4.1.1 "server". Each request gets a fresh PHP
 * process (a new wasm instance of the pre-compiled module), exactly like a
 * CGI web server forks php for every hit.
 */
/* global createPHP, PHPSim, MysqlServer, initSqlJs */

// With JS Promise Integration the engine runs on its own wasm stack, which is
// several times larger than a worker's native stack -- PHP 4's executor
// recurses in C for every PHP function call, so this sets the maximum PHP
// recursion depth. Fall back to the plain build elsewhere.
const USE_JSPI = typeof WebAssembly.Suspending === 'function' && typeof WebAssembly.promising === 'function';
const BUILD = USE_JSPI ? 'php-jspi' : 'php';
importScripts(BUILD + '.js', 'phpsim-core.js', 'mysqld.js', 'vendor/sqljs/sql-wasm.js');

// sql.js (SQLite) backs the emulated MySQL server; it is only loaded once a
// request runs with the server enabled.
let sqlPromise = null;
function getSQL() {
  if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: (f) => 'vendor/sqljs/' + f });
  return sqlPromise;
}

let simPromise = null;

function getSim() {
  if (!simPromise) {
    simPromise = (async () => {
      const resp = await fetch(BUILD + '.wasm');
      if (!resp.ok) throw new Error('could not load ' + BUILD + '.wasm (' + resp.status + ')');
      let wasmModule;
      if (WebAssembly.compileStreaming && (resp.headers.get('content-type') || '').includes('wasm')) {
        wasmModule = await WebAssembly.compileStreaming(resp);
      } else {
        wasmModule = await WebAssembly.compile(await resp.arrayBuffer());
      }
      return PHPSim.create({ createPHP, wasmModule });
    })();
  }
  return simPromise;
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    try {
      await getSim();
      self.postMessage({ type: 'ready', build: BUILD });
    } catch (e) {
      self.postMessage({ type: 'fatal', error: String(e && e.message || e) });
    }
    return;
  }
  if (msg.type === 'run') {
    try {
      const sim = await getSim();
      if (msg.request.mysqld && !sim.mysqld) sim.mysqld = new MysqlServer(await getSQL());
      const r = await sim.run(msg.request);
      const transfer = [r.stdout.buffer, r.stderr.buffer];
      self.postMessage({ type: 'result', id: msg.id, result: r }, transfer);
    } catch (e) {
      self.postMessage({ type: 'result', id: msg.id, error: String(e && e.stack || e) });
    }
  }
};
