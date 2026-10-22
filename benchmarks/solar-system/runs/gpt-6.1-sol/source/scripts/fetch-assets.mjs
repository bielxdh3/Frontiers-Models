import { mkdir, writeFile, readFile, rename, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);
await mkdir('public/textures', {recursive:true});
const names = ['sun','mercury','venus_atmosphere','earth_daymap','earth_clouds','moon','mars','jupiter','saturn','uranus','neptune'];
await Promise.all(names.map(async name => {
  const url = `https://www.solarsystemscope.com/textures/download/2k_${name}.jpg`;
  try {
    const temp=`public/textures/${name}.part`;
    await run('curl.exe',['--silent','--show-error','--fail','--location','--max-time','20','--output',temp,url]);
    const data=await readFile(temp);
    if(data[0]!==255||data[1]!==216){await unlink(temp);throw Error('Not an image');}
    await rename(temp,`public/textures/${name}.jpg`);
    console.log(`${name}: ${data.length} bytes`);
  } catch(e) { console.log(`${name}: procedural fallback (${e.message})`); }
}));
await mkdir('public/fonts', {recursive:true});
try {
  const {stdout:css}=await run('curl.exe',['--silent','--fail','--location','--max-time','15','https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap']);
  const url=css.match(/url\((https:[^)]+)\)/)?.[1];
  if(url) {await run('curl.exe',['--silent','--fail','--location','--max-time','15','--output','public/fonts/manrope.woff2',url]);console.log('Manrope bundled');}
} catch(e) {console.log('System font fallback');}
