import {mkdir,cp,rm,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=path.resolve(root,'dist');
if(path.dirname(destination)!==path.resolve(root))throw Error('Invalid build directory');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const p of ['index.html','style.css','src','assets','vendor','track.json'])await cp(path.join(root,p),path.join(destination,p),{recursive:true,filter:source=>!/(?:source-\d+\.html|-(?:normal|rough)\.jpg)$/.test(source)});
async function size(dir){let total=0;for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);total+=entry.isDirectory()?await size(p):(await stat(p)).size;}return total;}
const bytes=await size(destination);if(bytes>400*1024*1024)throw Error('Build exceeds 400 MB');await writeFile(path.join(root,'verification/build.json'),JSON.stringify({bytes,MiB:bytes/1024/1024,referencesIncluded:false},null,2));console.log(`Static build: ${(bytes/1024/1024).toFixed(2)} MiB. Reference images excluded.`);
