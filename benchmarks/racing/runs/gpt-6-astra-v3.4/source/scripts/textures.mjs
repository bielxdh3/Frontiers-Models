import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('assets/textures',{recursive:true});
let seed=34014;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
const presets={asphalt:[2048,61,63,64,21],earth:[1024,166,149,107,25],stone:[1024,177,163,135,30],plaster:[1024,225,213,186,9],rubber:[1024,30,32,35,7],metal:[1024,220,222,225,3],paint:[1024,247,247,247,1.7],bark:[1024,111,94,70,30],leaf:[1024,111,136,67,25],tile:[1024,166,83,49,24]};
for(const[name,[n,r,g,b,noise]]of Object.entries(presets)){
 const rgb=Buffer.alloc(n*n*3),normal=Buffer.alloc(n*n*3),rough=Buffer.alloc(n*n),height=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const k=y*n+x,grain=(rand()-.5)*noise,macro=Math.sin(x*.017+Math.cos(y*.011)*3)*Math.sin(y*.019)*noise*.3;
  let detail=0;if(name==='asphalt'){detail=rand()<.13?(rand()-.4)*40:0;detail-=Math.pow(Math.max(0,Math.sin(x*.007+y*.013)*Math.cos(y*.009)),12)*15;}
  if(name==='stone')detail-=Math.pow(Math.abs(Math.sin(y*.023+Math.sin(x*.02)*.4)),30)*25;
  if(name==='bark')detail+=Math.sin(x*.2+Math.sin(y*.013)*4)*20;
  if(name==='tile')detail+=Math.sin(x/n*Math.PI*16)*12-(y%(n/8)<5?25:0);
  height[k]=grain+detail;for(let c=0;c<3;c++)rgb[k*3+c]=Math.max(0,Math.min(255,[r,g,b][c]+grain+macro+detail));
  rough[k]=name==='paint'?55+grain:name==='metal'?95+grain:195+grain;
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const k=y*n+x,dx=(height[y*n+(x+1)%n]-height[y*n+(x+n-1)%n])*.012,dy=(height[((y+1)%n)*n+x]-height[((y+n-1)%n)*n+x])*.012,l=Math.hypot(dx,dy,1);
  normal[k*3]=128-dx/l*127;normal[k*3+1]=128-dy/l*127;normal[k*3+2]=128+127/l;
 }
 await Promise.all([sharp(rgb,{raw:{width:n,height:n,channels:3}}).jpeg({quality:94}).toFile(`assets/textures/${name}-color.jpg`),sharp(normal,{raw:{width:n,height:n,channels:3}}).png().toFile(`assets/textures/${name}-normal.png`),sharp(rough,{raw:{width:n,height:n,channels:1}}).png().toFile(`assets/textures/${name}-rough.png`)]);
 console.log(name,n);
}
