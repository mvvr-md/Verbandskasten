// Einfacher Testserver, der die App wie GitHub Pages unter /Verbandskasten/ ausliefert.
// Aufruf: node tools/serve.js [port]   →   http://localhost:8080/Verbandskasten/
// Service Worker funktionieren nur über https oder localhost.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = '/Verbandskasten/';
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return send(res, 400, 'Ungültige Adresse');
  }
  if (pathname === '/' || pathname === BASE.slice(0, -1)) {
    res.writeHead(302, { Location: BASE });
    return res.end();
  }
  if (!pathname.startsWith(BASE)) return send(res, 404, 'Nicht gefunden');

  let rel = pathname.slice(BASE.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  // Keine versteckten oder privaten Ordner ausliefern (.git, _private, _import …)
  if (rel.split('/').some((p) => p.startsWith('.') || p.startsWith('_'))) {
    return send(res, 404, 'Nicht gefunden');
  }
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Verboten');

  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Nicht gefunden');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, HOST, () => {
  console.log(`Verbandskasten läuft unter http://localhost:${PORT}${BASE}`);
});
