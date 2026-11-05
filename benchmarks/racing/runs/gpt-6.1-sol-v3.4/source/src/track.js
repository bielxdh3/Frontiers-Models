import * as THREE from 'three';
import data from '../track.json' with {type:'json'};
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const mix = (a,b,t)=>a+(b-a)*t;
export const smooth = (a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function rng(seed=3704){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
export class Track {
  constructor(){
    this.data=data; this.width=data.width;
    this.curve=new THREE.CatmullRomCurve3(data.points.map(p=>new THREE.Vector3(p[0],3+(p[1]-3)*.94,p[2])),true,'centripetal');
    this.curve.arcLengthDivisions=6000; this.length=this.curve.getLength(); this.count=Math.ceil(this.length/2);this.step=this.length/this.count;
    this.frames=[];
    for(let i=0;i<this.count;i++){
      const t=i/this.count,p=this.curve.getPointAt(t),tan=this.curve.getTangentAt(t).normalize(),right=new THREE.Vector3(tan.z,0,-tan.x).normalize();
      const ahead=this.curve.getTangentAt((t+0.001)%1),behind=this.curve.getTangentAt((t-0.001+1)%1);
      const cross=behind.z*ahead.x-behind.x*ahead.z;
      const curvature=Math.atan2(cross,behind.x*ahead.x+behind.z*ahead.z)/(0.002*this.length);
      const bank=clamp(-curvature*1.6,-0.065,0.065);
      this.frames.push({p,tan,right,curvature,bank,s:i*this.step,t,zone:data.zones.find(z=>t>=z.start&&t<z.end)?.id||4});
    }
    this.objects=[];this.checkpoints=Array.from({length:data.checkpoints},(_,i)=>this.at(i*this.length/data.checkpoints));
    this.grid={minX:-1000,maxX:750,minZ:-1000,maxZ:950,size:5};
    this.buckets=new Map();
    for(let i=0;i<this.count;i++){const p=this.frames[i].p;const key=Math.floor(p.x/35)+','+Math.floor(p.z/35);if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key).push(i)}
  }
  at(s,d=0){
    s=(s%this.length+this.length)%this.length; const f=s/this.step,i=Math.floor(f),a=this.frames[i],b=this.frames[(i+1)%this.count],k=f-i;
    const p=a.p.clone().lerp(b.p,k),tan=a.tan.clone().lerp(b.tan,k).normalize(),right=new THREE.Vector3(tan.z,0,-tan.x).normalize(),bank=mix(a.bank,b.bank,k);
    p.addScaledVector(right,d);p.y+=bank*d;
    return {p,tan,right,bank,curvature:mix(a.curvature,b.curvature,k),s,t:s/this.length,zone:a.zone,yaw:Math.atan2(tan.x,tan.z)};
  }
  project(x,z,hint){
    let best=Infinity,out=null,indices=[];
    if(hint!==undefined){const n=Math.round(hint/this.step);for(let j=-24;j<=24;j++)indices.push((n+j+this.count)%this.count)}
    else {const bx=Math.floor(x/35),bz=Math.floor(z/35);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const a=this.buckets.get((bx+dx)+','+(bz+dz));if(a)indices.push(...a)}if(!indices.length)indices=this.frames.map((_,i)=>i)}
    for(const i of indices){const a=this.frames[i],b=this.frames[(i+1)%this.count];const vx=b.p.x-a.p.x,vz=b.p.z-a.p.z,seg=vx*vx+vz*vz;const u=clamp(((x-a.p.x)*vx+(z-a.p.z)*vz)/seg,0,1);const px=a.p.x+u*vx,pz=a.p.z+u*vz;const ds=(x-px)**2+(z-pz)**2;if(ds<best){best=ds;const right=a.right;out={s:(i+u)*this.step,d:(x-px)*right.x+(z-pz)*right.z,distance:Math.sqrt(ds),y:mix(a.p.y,b.p.y,u),bank:mix(a.bank,b.bank,u),zone:a.zone}}}
    return out;
  }
  rawHeight(x,z){
    const n=this.project(x,z);const dist=n.distance,road=n.y+n.bank*n.d;
    const base=5+13*Math.sin(x*.008)*Math.cos(z*.004)+10*Math.sin((x+z)*.005);
    // Ocean is west of the shoreline; the shore is derived from the coastal spline.
    const coast=this.frames[Math.floor(clamp((z+520)/1000,0,.275)*this.count)].p.x;
    const sea=smooth(coast-8,coast-85,x);
    let wild=base+32*smooth(-150,300,x)+9*Math.sin(z*.012+x*.009);
    if(x>=-365)wild=Math.max(2.5,wild);
    if(x<-365)wild=mix(-7,wild,smooth(-470,-365,x));
    const blend=smooth(this.width/2+8,this.width/2+23,dist);
    return mix(road-.055,wild,blend);
  }
  makeHeightfield(){
    const g=this.grid;g.nx=Math.round((g.maxX-g.minX)/g.size)+1;g.nz=Math.round((g.maxZ-g.minZ)/g.size)+1;
    g.heights=new Float32Array(g.nx*g.nz);
    for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++)g.heights[j*g.nx+i]=this.rawHeight(g.minX+i*g.size,g.minZ+j*g.size);
    return g;
  }
  height(x,z){
    const g=this.grid;if(!g.heights)return this.rawHeight(x,z);
    const fx=clamp((x-g.minX)/g.size,0,g.nx-1.001),fz=clamp((z-g.minZ)/g.size,0,g.nz-1.001),i=Math.floor(fx),j=Math.floor(fz),a=fx-i,b=fz-j;
    const h00=g.heights[j*g.nx+i],h10=g.heights[j*g.nx+i+1],h01=g.heights[(j+1)*g.nx+i],h11=g.heights[(j+1)*g.nx+i+1];
    // Exactly the two triangles used by the visible heightfield.
    return a+b<=1?h00+a*(h10-h00)+b*(h01-h00):h11+(1-a)*(h01-h11)+(1-b)*(h10-h11);
  }
  ground(x,z,hint){const n=this.project(x,z,hint);return n.distance<=this.width/2+.65?n.y+n.bank*n.d:this.height(x,z)}
  place(s,offset,kind,radius=1){const f=this.at(s,offset);const n=this.project(f.p.x,f.p.z);if(n.distance< this.width/2+3+radius)return null;f.p.y=this.height(f.p.x,f.p.z);const obj={kind,s,offset,radius,p:f.p.clone(),yaw:f.yaw,zone:f.zone};this.objects.push(obj);return obj}
  validateWorld(){
    const errors=[];let maxGrade=0,maxBank=0,minRadius=Infinity,maxRoadOverlap=0,maxEdgeGap=0;
    for(const f of this.frames){maxGrade=Math.max(maxGrade,Math.abs(f.tan.y/Math.hypot(f.tan.x,f.tan.z)));maxBank=Math.max(maxBank,Math.abs(Math.atan(f.bank)*180/Math.PI));minRadius=Math.min(minRadius,1/Math.max(Math.abs(f.curvature),1e-9));
      for(const d of [-this.width/2,-3,0,3,this.width/2]){const p=this.at(f.s,d).p;const h=this.height(p.x,p.z);maxRoadOverlap=Math.max(maxRoadOverlap,h-p.y);if(Math.abs(d)===this.width/2)maxEdgeGap=Math.max(maxEdgeGap,Math.abs(h-p.y))}
    }
    if(maxGrade>.14)errors.push('Longitudinal grade exceeds 14%: '+maxGrade);
    if(maxBank>12)errors.push('Road bank exceeds 12 degrees');if(minRadius<25)errors.push('Curve radius below 25m: '+minRadius);
    if(maxRoadOverlap>.02)errors.push('Terrain intrudes into road: '+maxRoadOverlap.toFixed(3));if(maxEdgeGap>.15)errors.push('Road/terrain gap exceeds .15m: '+maxEdgeGap.toFixed(3));
    for(const o of this.objects){const n=this.project(o.p.x,o.p.z);if(n.distance<this.width/2+3+o.radius-.01)errors.push('Exclusion band: '+o.kind);if(o.supportSamples){for(const p of o.supportSamples)if(Math.abs(p.y-this.height(p.x,p.z))>.3)errors.push('Unsupported foundation: '+o.kind)}else if(o.kind!=='rock'&&Math.abs(o.p.y-this.height(o.p.x,o.p.z))>.3)errors.push('Unsupported object: '+o.kind)}
    const houses=this.objects.filter(o=>o.kind==='house');for(let i=0;i<houses.length;i++)for(let j=i+1;j<houses.length;j++)if(houses[i].p.distanceTo(houses[j].p)<houses[i].radius+houses[j].radius)errors.push('Overlapping houses');
    for(let i=0;i<this.checkpoints.length;i++){const c=this.checkpoints[i];if(this.project(c.p.x,c.p.z).distance>.05||Math.abs(c.s-i*this.length/this.checkpoints.length)>.01)errors.push('Invalid checkpoint '+i)}
    return {ok:errors.length===0,errors,length:this.length,maxGrade,maxBank,minRadius,maxRoadOverlap,maxEdgeGap,objects:this.objects.length};
  }
}
