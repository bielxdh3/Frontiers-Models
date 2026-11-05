import sharp from 'sharp';
import {readdir} from 'node:fs/promises';
const names=(await readdir('benchmark/racing-v3.4/refs')).filter(x=>x.endsWith('.jpg'));
const tiles=await Promise.all(names.map(async(name,i)=>({input:await sharp('benchmark/racing-v3.4/refs/'+name).resize(480,270).png().toBuffer(),left:(i%4)*480,top:Math.floor(i/4)*300})));
await sharp({create:{width:1920,height:1200,channels:3,background:'#16242a'}}).composite(tiles).png().toFile('verification/reference-sheet.png');
