import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/index.html':path));if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}const info=await stat(file);if(!info.isFile())throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Static production assets: http://127.0.0.1:${port}`));
