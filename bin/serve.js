#!/usr/bin/env node
// Minimal static server for the simulator:  node bin/serve.js [port]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'web');
const PORT = +(process.argv[2] || process.env.PORT || 8411);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm', '.json': 'application/json', '.php': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || (file.includes('/ini/') ? 'text/plain; charset=utf-8' : 'application/octet-stream'),
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`PHP 4.1.1 simulator: http://localhost:${PORT}/`));
