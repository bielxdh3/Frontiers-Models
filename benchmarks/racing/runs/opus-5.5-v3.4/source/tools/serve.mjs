// Minimal static file server (no dependencies). Usage: node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ktx2': 'image/ktx2', '.woff2': 'font/woff2', '.txt': 'text/plain', '.md': 'text/markdown',
};

export function startServer(port = 8173) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.normalize(path.join(ROOT, p));
      if (!file.startsWith(ROOT) || file.includes(`${path.sep}node_modules${path.sep}`)) { res.writeHead(403); res.end(); return; }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
      });
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || process.env.PORT || 8173);
  startServer(port).then(() => console.log(`serving ${ROOT} at http://127.0.0.1:${port}/`));
}
