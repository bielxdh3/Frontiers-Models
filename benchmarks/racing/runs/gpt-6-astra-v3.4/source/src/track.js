import * as THREE from 'three';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wrap=(x,l)=>((x%l)+l)%l;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export class Track{
 constructor(data){
  this.data=data;this.width=data.width;this.n=data.samples;this.start=data.startLine;
  this.curve=new THREE.CatmullRomCurve3(data.controlPoints.map(p=>new THREE.Vector3(...p.position)),true,'centripetal');
  this.curve.arcLengthDivisions=16000;this.length=this.curve.getLength();this.step=this.length/this.n;
  this.frames=[];this.hash=new Map();
  for(let i=0;i<=this.n;i++){
   const u=i/this.n,p=this.curve.getPointAt(u),t=this.curve.getTangentAt(u).normalize(),right=new THREE.Vector3(t.z,0,-t.x).normalize();
   const bank=data.controlPoints[Math.floor(u*data.controlPoints.length)%data.controlPoints.length].bank*Math.PI/180;
   this.frames.push({p,t,right,bank,s:i*this.step});
   const k=`${Math.floor(p.x/50)},${Math.floor(p.z/50)}`;if(!this.hash.has(k))this.hash.set(k,[]);this.hash.get(k).push(i%this.n);
  }
  this.checkpoints=Array.from({length:data.checkpoints},(_,i)=>({index:i,s:wrap(this.start+i*this.length/data.checkpoints,this.length)}));
 }
 at(s,offset=0){
  const d=wrap(s,this.length)/this.step,i=Math.floor(d),q=d-i,a=this.frames[i],b=this.frames[i+1];
  const p=a.p.clone().lerp(b.p,q),t=a.t.clone().lerp(b.t,q).normalize(),right=new THREE.Vector3(t.z,0,-t.x).normalize();
  p.addScaledVector(right,offset);p.y+=Math.tan(a.bank)*offset;
  return{p,t,right,bank:a.bank,s:wrap(s,this.length),yaw:Math.atan2(t.x,t.z)};
 }
 nearest(x,z){
  const cx=Math.floor(x/50),cz=Math.floor(z/50);let candidates=[];
  for(let r=1;r<=6;r++){
   for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){if(r>1&&Math.abs(a)<r&&Math.abs(b)<r)continue;const list=this.hash.get(`${cx+a},${cz+b}`);if(list)candidates.push(...list);}
   if(candidates.length>3)break;
  }
  if(!candidates.length)candidates=this.frames.slice(0,this.n).map((_,i)=>i);
  let best=Infinity,result;
  for(const i of candidates){const a=this.frames[i].p,b=this.frames[i+1].p,dx=b.x-a.x,dz=b.z-a.z;
   const q=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+q*dx,pz=a.z+q*dz,dist=(x-px)**2+(z-pz)**2;
   if(dist<best){best=dist;const right=this.frames[i].right;result={s:(i+q)*this.step,distance:Math.sqrt(dist),offset:(x-px)*right.x+(z-pz)*right.z,height:a.y+q*(b.y-a.y),i};}
  }return result;
 }
 zone(s){return this.data.zones.find(z=>wrap(s,this.length)/this.length<z.to)||this.data.zones[3];}
 curvature(s){const a=this.at(s-7).t,b=this.at(s+7).t;return a.angleTo(b)/14;}
 roadHeight(x,z){const n=this.nearest(x,z);return n.height+Math.tan(this.frames[n.i].bank)*n.offset;}
}
export class Terrain{
 constructor(track,resolution=2){
  this.track=track;this.resolution=resolution;this.minX=-360;this.minZ=-780;this.cols=Math.ceil(1480/resolution)+1;this.rows=Math.ceil(1400/resolution)+1;
  this.heights=new Float32Array(this.cols*this.rows);
  for(let z=0;z<this.rows;z++)for(let x=0;x<this.cols;x++)this.heights[z*this.cols+x]=this.designHeight(this.minX+x*resolution,this.minZ+z*resolution);
 }
 designHeight(x,z){
  const n=this.track.nearest(x,z),road=n.height-.075;
  const rocky=4*Math.sin(x*.025)*Math.sin(z*.017)+2*Math.cos(z*.047+x*.021);
  const inland=7+smooth(0,700,x)*47+rocky+Math.sin(z*.004)*7;
  const coast= -5+smooth(-150,25,x)*(inland+5);
  const townStart=this.track.length*.515,townEnd=this.track.length*.765;
  const town=smooth(townStart,townStart+40,n.s)*(1-smooth(townEnd-40,townEnd,n.s)),flat=this.track.width/2+5+town*60;
  return THREE.MathUtils.lerp(road,coast,smooth(flat,flat+10,n.distance));
 }
 sample(x,z){
  const gx=clamp((x-this.minX)/this.resolution,0,this.cols-1.0001),gz=clamp((z-this.minZ)/this.resolution,0,this.rows-1.0001),ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
  const a=this.heights[iz*this.cols+ix],b=this.heights[iz*this.cols+ix+1],c=this.heights[(iz+1)*this.cols+ix],d=this.heights[(iz+1)*this.cols+ix+1];
  return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
 }
 raycast(x,z){return new THREE.Vector3(x,this.sample(x,z),z);}
 geometry(){
  const p=[],uv=[],col=[],idx=[];const color=new THREE.Color();
  for(let z=0;z<this.rows;z++)for(let x=0;x<this.cols;x++){
   const wx=this.minX+x*this.resolution,wz=this.minZ+z*this.resolution,h=this.heights[z*this.cols+x];p.push(wx,h,wz);uv.push(wx/18,wz/18);
   const sand=1-smooth(1,15,h);color.setRGB(.86+sand*.12,.88+sand*.08,.80+sand*.12);col.push(color.r,color.g,color.b);
  }
  for(let z=0;z<this.rows-1;z++)for(let x=0;x<this.cols-1;x++){const a=z*this.cols+x,b=a+1,c=a+this.cols,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
 }
}
export function roadGeometry(track,from=-track.width/2,to=track.width/2,lift=0){
 const p=[],uv=[],idx=[];
 for(let i=0;i<=track.n;i++){for(const offset of [from,to]){const f=track.at(i*track.step,offset);p.push(f.p.x,f.p.y+lift,f.p.z);uv.push((offset+track.width/2)/track.width,i*track.step/track.width);}}
 for(let i=0;i<track.n;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function validateWorld(track,terrain,objects=[]){
 const errors=[],stats={length:track.length,maxGrade:0,minRadius:Infinity,maxEdgeGap:0,maxTerrainAbove:0,objects:objects.length};
 for(let s=0;s<track.length;s+=2){const f=track.at(s),grade=Math.abs(f.t.y)/Math.hypot(f.t.x,f.t.z),curv=track.curvature(s),radius=1/Math.max(curv,1e-9);stats.maxGrade=Math.max(stats.maxGrade,grade);stats.minRadius=Math.min(stats.minRadius,radius);
  if(grade>.14)errors.push(`grade ${s.toFixed(1)}: ${grade}`);if(radius<25)errors.push(`radius ${s.toFixed(1)}: ${radius}`);if(Math.abs(f.bank)>12*Math.PI/180)errors.push('bank');
  for(const offset of [-5.5,-3,0,3,5.5]){const p=track.at(s,offset).p,d=terrain.sample(p.x,p.z)-p.y;stats.maxTerrainAbove=Math.max(stats.maxTerrainAbove,d);if(d>.02)errors.push(`terrain above road ${s.toFixed(1)} ${d}`);if(Math.abs(offset)===5.5){stats.maxEdgeGap=Math.max(stats.maxEdgeGap,Math.abs(d));if(Math.abs(d)>.15)errors.push(`edge gap ${s.toFixed(1)} ${d}`);}}
 }
 for(const o of objects){const n=track.nearest(o.position.x,o.position.z);if(n.distance-o.radius<track.width/2+3-.01)errors.push(`exclusion ${o.id}`);if(o.type!=='rock'&&Math.abs(o.position.y-terrain.sample(o.position.x,o.position.z))>.3)errors.push(`floating ${o.id}`);}
 const houses=objects.filter(o=>o.type==='house');for(let i=0;i<houses.length;i++)for(let j=i+1;j<houses.length;j++)if(Math.hypot(houses[i].position.x-houses[j].position.x,houses[i].position.z-houses[j].position.z)<houses[i].radius+houses[j].radius)errors.push(`house overlap ${i}/${j}`);
 for(let i=0;i<track.checkpoints.length;i++){const cp=track.checkpoints[i];if(cp.index!==i||cp.s!==wrap(track.start+i*track.length/track.checkpoints.length,track.length))errors.push('checkpoints');}
 if(track.length<2500||track.length>3500)errors.push(`length ${track.length}`);
 return{ok:errors.length===0,errors,stats};
}
