import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist'), port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), resolved = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) { res.writeHead(403).end(); return; }
    if (!(await stat(resolved)).isFile()) { res.writeHead(404).end(); return; }
    const body = await readFile(resolved); res.writeHead(200, { 'Content-Type': mime[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Solstice static build: http://127.0.0.1:${port}`));
