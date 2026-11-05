import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';
const meta=JSON.parse(await fs.readFile('assets/asphalt-source.json','utf8'));
const entries=[['Diffuse','color','jpg'],['nor_gl','normal','png'],['Rough','rough','png']];
const provenance=await Promise.all(entries.map(async([source,kind,ext])=>{const file=meta[source]['2k'].jpg;const res=await fetch(file.url);if(!res.ok)throw new Error('asset download '+res.status);const data=Buffer.from(await res.arrayBuffer());const dest=`assets/textures/asphalt-${kind}.${ext}`;if(ext==='png')await sharp(data).png().toFile(dest);else await fs.writeFile(dest,data);return{source:file.url,license:'CC0',local:dest,sha256:crypto.createHash('sha256').update(data).digest('hex'),image:await sharp(data).metadata()};}));
await fs.writeFile('assets/asphalt-provenance.json',JSON.stringify(provenance,null,2));console.log(provenance.map(p=>({file:p.local,width:p.image.width,height:p.image.height})));
