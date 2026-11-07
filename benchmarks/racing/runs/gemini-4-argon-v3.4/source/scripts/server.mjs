import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.hdr': 'application/octet-stream',
  '.exr': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.glb': 'model/gltf-binary',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm'
};

export function startStaticServer(port = 4173, rootDir = ROOT_DIR) {
  const resolvedRoot = path.resolve(rootDir);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        let relPath = decodeURIComponent(reqUrl.pathname);
        if (relPath === '/' || relPath === '') relPath = '/index.html';

        const safePath = path.resolve(resolvedRoot, '.' + relPath);
        const relCheck = path.relative(resolvedRoot, safePath);
        if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        let targetPath = safePath;
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
          targetPath = path.join(targetPath, 'index.html');
        }

        if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Not Found: ${relPath}`);
          return;
        }

        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const stat = fs.statSync(targetPath);
        const range = req.headers.range;

        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          const start = match && match[1] ? parseInt(match[1], 10) : 0;
          const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
          if (start >= stat.size || end >= stat.size || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return;
          }
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(targetPath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(targetPath).pipe(res);
        }
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({
        server,
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT || 4173);
  startStaticServer(port).then(({ url }) => {
    console.log(`[server] Static server running offline at ${url}`);
  });
}
