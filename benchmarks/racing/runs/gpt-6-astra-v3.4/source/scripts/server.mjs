import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.hdr':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2','.webm':'video/webm'};
export function serve(port=4173){
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   res.setHeader('Cache-Control','no-cache');res.setHeader('Cross-Origin-Opener-Policy','same-origin');
   fs.createReadStream(file).pipe(res);
  });
 });
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await serve(Number(process.env.PORT)||4173);console.log('Solmare running at http://127.0.0.1:4173');}
