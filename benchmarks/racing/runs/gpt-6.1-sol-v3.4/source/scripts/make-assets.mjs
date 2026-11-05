import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('public/assets',{recursive:true});
function rand(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
const defs={asphalt:[2048,[77,80,79],.8],sand:[1024,[191,169,124],.85],rock:[1024,[130,118,94],.95],grass:[1024,[95,111,60],.9],plaster:[1024,[212,204,182],.9],tile:[1024,[150,72,44],.8],bark:[1024,[92,76,57],.95],paint:[1024,[235,235,235],.25],metal:[1024,[173,180,177],.4],rubber:[1024,[40,42,43],.96],leaves:[1024,[85,111,48],.8],wood:[1024,[123,101,69],.87]};
for(const [name,[size,col,rough]] of Object.entries(defs)){
 const random=rand(3704+name.length),rgb=Buffer.alloc(size*size*3),nor=Buffer.alloc(size*size*3),rgh=Buffer.alloc(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,n=random(),macro=Math.sin(x/size*Math.PI*8+Math.sin(y/size*Math.PI*4))*Math.cos(y/size*Math.PI*6)*8;
  let v=(n-.5)*(name==='asphalt'?33:22)+macro;
  if(name==='tile'){const row=Math.floor(y/64);v+=Math.sin((x+(row%2)*32)/32*Math.PI)*15;if(y%64<4)v-=45}
  if(name==='bark'||name==='wood')v+=Math.sin(x*.15+Math.sin(y*.008)*2)*14;
  if(name==='asphalt'&&n>.985)v+=32;
  for(let c=0;c<3;c++)rgb[i*3+c]=Math.max(0,Math.min(255,col[c]+v));
  nor[i*3]=128+(random()-.5)*(name==='asphalt'?55:30);nor[i*3+1]=128+(random()-.5)*30;nor[i*3+2]=250;rgh[i]=Math.min(255,rough*255+(random()-.5)*25);
 }
 await sharp(rgb,{raw:{width:size,height:size,channels:3}}).jpeg({quality:86}).toFile(`public/assets/${name}-albedo.jpg`);
 await sharp(nor,{raw:{width:size,height:size,channels:3}}).png().toFile(`public/assets/${name}-normal.png`);
 await sharp(rgh,{raw:{width:size,height:size,channels:1}}).jpeg({quality:80}).toFile(`public/assets/${name}-roughness.jpg`);
 console.log('Original PBR:',name,size);
}
