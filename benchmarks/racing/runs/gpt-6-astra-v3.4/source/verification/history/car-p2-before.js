import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {clamp} from './track.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function surface(fn,nu=96,nv=64){
 const p=[],uv=[],idx=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const v=fn(i/nu,j/nv);p.push(v.x,v.y,v.z);uv.push(i/nu,j/nv);}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j;idx.push(a,a+nv+1,a+1,a+1,a+nv+1,a+nv+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function profile(z,values){const t=(z+2.3)/4.6*(values.length-1),i=clamp(Math.floor(t),0,values.length-2),f=clamp(t-i,0,1);return THREE.MathUtils.lerp(values[i],values[i+1],f*f*(3-2*f));}
function tube(points,r=.012,segments=32){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,r,8,false);}
export function createCar(materials,model='gt',color='#d54a26',number=7){
 const root=new THREE.Group();root.name=model==='gt'?'Vela GT':'Brisa RS';root.userData={type:'car',model,number};const paint=materials.paint(color),m=materials;
 const mesh=(g,mat,parent=root)=>{const o=new THREE.Mesh(g,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const hatch=model==='hatch',bodyLength=hatch?4.22:4.6;
 const bodyFn=(u,v)=>{
  const z=-2.3+u*4.6,a=v*Math.PI*2,w=profile(z,hatch?[.77,.93,.95,.91,.95,.87,.74]:[.79,.94,.99,.91,.98,.94,.78]);
  const top=profile(z,hatch?[.78,.99,1.0,.99,.94,.86,.72]:[.74,.97,1.00,.97,.94,.86,.71]);
  let x=w*Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.4),y=.53+(Math.cos(a)>0?top-.53:.26)*Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.45);
  y+=.035*Math.pow(Math.abs(x)/w,4)*(Math.exp(-(((z-1.38)/.48)**2))+Math.exp(-(((z+1.38)/.48)**2)));
  return V(x,y,z*bodyLength/4.6);
 };
 const bodyGeo=surface(bodyFn,192,96),bp=bodyGeo.attributes.position,bi=bodyGeo.index.array,kept=[];
 for(let i=0;i<bi.length;i+=3){let x=0,y=0,z=0;for(let j=0;j<3;j++){x+=bp.getX(bi[i+j])/3;y+=bp.getY(bi[i+j])/3;z+=bp.getZ(bi[i+j])/3;}const wheelHole=Math.abs(x)>.7&&[-1.38,1.38].some(ax=>(z-ax*bodyLength/4.6)**2+(y-.385)**2<.442**2);if(!wheelHole)kept.push(bi[i],bi[i+1],bi[i+2]);}bodyGeo.setIndex(kept);mesh(bodyGeo,paint);
 for(const end of[0,1]){const pos=[],idx=[],uv=[];const z=(end?1:-1)*bodyLength/2;pos.push(0,.47,z);uv.push(.5,.5);for(let j=0;j<=96;j++){const p=bodyFn(end,j/96);pos.push(p.x,p.y,p.z);uv.push(p.x*.5+.5,p.y);}for(let j=0;j<96;j++){if(end)idx.push(0,j+2,j+1);else idx.push(0,j+1,j+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();mesh(g,paint);}
 for(const side of[-1,1])for(const axle of[-1.38,1.38]){const pts=[];for(let i=0;i<=40;i++){const a=-.35+i/40*(Math.PI+.7);pts.push(V(side*.965,.385+Math.sin(a)*.443,(axle+Math.cos(a)*.443)*bodyLength/4.6));}mesh(tube(pts,.012,64),paint);}
 // Separate, curved glass canopy and painted roof: original silhouettes, no downloaded mesh.
 const rear=hatch?-1.50:-1.23,front=.91,roofHeight=hatch?1.51:1.32,roofFront=hatch?.10:.16,roofRear=hatch?-.95:-.55;
 const canopy=(u,v)=>{
  const z=rear+(front-rear)*u,a=v*Math.PI,w=.75*(.94+.06*Math.sin(u*Math.PI)),e=z<roofRear?(z-rear)/(roofRear-rear):z>roofFront?(front-z)/(front-roofFront):1;
  return V(Math.cos(a)*w,.93+(roofHeight-.93)*Math.pow(Math.sin(a),.23)*e,z);
 };
 const canopyGeometry=surface(canopy,100,60);
 const canopyIndices=[[],[]], originalIndices=canopyGeometry.index.array;for(let u=0;u<100;u++)for(let v=0;v<60;v++){const z=rear+(front-rear)*(u+.5)/100,q=(v+.5)/60;const roof=z>roofRear&&z<roofFront&&q>.17&&q<.83,lower=q<.018||q>.982,pillar=(Math.abs(q-.19)<.018||Math.abs(q-.81)<.018)&&(z>roofFront-.02||z<roofRear+.02),bPillar=Math.abs(z+.38)<.027;const mi=roof||lower||pillar||bPillar?1:0;for(let k=0;k<6;k++)canopyIndices[mi].push(originalIndices[(u*60+v)*6+k]);}canopyGeometry.setIndex([...canopyIndices[0],...canopyIndices[1]]);canopyGeometry.addGroup(0,canopyIndices[0].length,0);canopyGeometry.addGroup(canopyIndices[0].length,canopyIndices[1].length,1);
 const glazing=mesh(canopyGeometry,[m.glass,paint]);glazing.userData.glass=true;glazing.material.forEach(m=>m.side=THREE.DoubleSide);
 // Four slender pillars follow the canopy, leaving reflections visible in all windows.
 for(const side of[-1,1]){
  mesh(tube([V(side*.762,.92,rear+.06),V(side*.77,.94,-.1),V(side*.745,.92,front-.08)],.016),m.chrome);
  mesh(tube([V(side*.87,.80,.75),V(side*.914,.48,.62),V(side*.92,.37,-.81),V(side*.91,.8,-.87)],.006),m.dark);
  const handle=mesh(new RoundedBoxGeometry(.035,.035,.18,3,.015),m.chrome);handle.position.set(side*.936,.80,-.61);
  const mirror=mesh(new THREE.SphereGeometry(1,24,16),paint);mirror.scale.set(.18,.085,.15);mirror.position.set(side*1.03,1.04,.65);
  const mirrorStem=mesh(tube([V(side*.75,.96,.65),V(side*1.02,1.04,.65)],.025),m.dark);
  const mirrorGlass=mesh(new THREE.SphereGeometry(1,18,12),m.chrome);mirrorGlass.scale.set(.14,.06,.012);mirrorGlass.position.set(side*1.035,1.045,.52);
 }
 const interior=mesh(new THREE.SphereGeometry(1,32,24),m.dark);interior.position.set(0,.78,-.21);interior.scale.set(.72,.29,.96);
 // Splitter and diffuser have bevelled surfaces rather than visible primitives.
 for(const z of[-2.16,2.17]){const splitter=mesh(new RoundedBoxGeometry(1.79,.08,.27,5,.04),m.dark);splitter.position.set(0,.29,z*bodyLength/4.6);}
 const grille=mesh(new RoundedBoxGeometry(1.16,.19,.055,5,.06),m.dark);grille.position.set(0,.44,bodyLength/2-.015);
 for(let j=0;j<15;j++){const slat=mesh(new RoundedBoxGeometry(.014,.145,.03,2,.005),m.metal);slat.position.set((j-7)*.065,.44,bodyLength/2+.02);}
 const headlight=new THREE.MeshStandardMaterial({color:'#e7fbff',emissive:'#d7f6ff',emissiveIntensity:2.4,roughness:.13,metalness:.2});
 const rearLight=new THREE.MeshStandardMaterial({color:'#741408',emissive:'#ff260d',emissiveIntensity:1.5,roughness:.16});
 for(const side of[-1,1]){
  mesh(tube([V(side*.39,.665,bodyLength/2-.04),V(side*.62,.70,bodyLength/2-.08),V(side*.80,.73,bodyLength/2-.20)],.028),headlight);
  mesh(tube([V(side*.14,.79,-bodyLength/2+.01),V(side*.54,.80,-bodyLength/2+.005),V(side*.80,.75,-bodyLength/2+.10)],.022),rearLight);
  const exhaust=mesh(new THREE.CylinderGeometry(.07,.07,.15,32,1,true),m.chrome);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.65,.40,-bodyLength/2-.035);
  const mouth=mesh(new THREE.CircleGeometry(.058,24),m.dark);mouth.rotation.y=Math.PI;mouth.position.set(side*.65,.40,-bodyLength/2-.115);
 }
 for(const x of[-.63,-.32,0,.32,.63]){const fin=mesh(new RoundedBoxGeometry(.035,.19,.4,3,.012),m.dark);fin.position.set(x,.33,-bodyLength/2+.12);}
 if(!hatch){
  for(const x of[-.63,.63]){const stand=mesh(new RoundedBoxGeometry(.045,.23,.11,3,.015),m.dark);stand.position.set(x,.97,-1.89);stand.rotation.x=-.2;}
  const wing=mesh(surface((u,v)=>{const x=(u-.5)*1.94,z=-1.97+(v-.5)*.30;return V(x,1.11+.035*Math.sin(v*Math.PI)+.025*(x*x),z);},48,12),paint);wing.material.side=THREE.DoubleSide;
 }else{const lip=mesh(new RoundedBoxGeometry(1.31,.055,.26,5,.025),paint);lip.position.set(0,1.44,-1.24);}
 // Wheel assembly includes shaped tyre, rim, spokes, ventilated disc and caliper.
 const wheels=[];
 for(const side of[-1,1])for(const axle of[-1.38,1.38]){
  const steering=new THREE.Group();steering.position.set(side*.92,.385,axle*bodyLength/4.6);root.add(steering);const wheel=new THREE.Group();steering.add(wheel);wheels.push({steering,wheel,front:axle>0});
  const tyre=mesh(new THREE.TorusGeometry(.292,.095,20,72),m.rubber,wheel);tyre.rotation.y=Math.PI/2;tyre.scale.z=1.45;
  for(const out of[-1,1]){const rim=mesh(new THREE.TorusGeometry(.258,.017,12,72),m.chrome,wheel);rim.rotation.y=Math.PI/2;rim.position.x=out*.115;}
  const disc=mesh(new THREE.CylinderGeometry(.222,.222,.023,64),m.metal,wheel);disc.rotation.z=Math.PI/2;disc.position.x=side*.075;
  const hub=mesh(new THREE.CylinderGeometry(.052,.052,.26,24),m.chrome,wheel);hub.rotation.z=Math.PI/2;
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const spoke=mesh(new RoundedBoxGeometry(.04,.223,.027,3,.012),m.chrome,wheel);spoke.rotation.x=a;spoke.position.set(side*.124,Math.cos(a)*.135,Math.sin(a)*.135);}
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const hole=mesh(new THREE.CircleGeometry(.007,6),m.dark,wheel);hole.rotation.y=side*Math.PI/2;hole.position.set(side*.089,Math.cos(a)*.19,Math.sin(a)*.19);}
  const caliper=mesh(new RoundedBoxGeometry(.065,.145,.075,4,.02),m.paint('#c34a23'),steering);caliper.position.set(side*.09,.02,-.19);
 }
 // Bespoke typography/livery; no brands from the visual references.
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.clearRect(0,0,1024,1024);ctx.fillStyle='#f0e6cc';ctx.beginPath();ctx.roundRect(64,100,880,760,80);ctx.fill();ctx.fillStyle='#172a31';ctx.font='bold 590px Arial';ctx.textAlign='center';ctx.fillText(String(number).padStart(2,'0'),512,670);ctx.font='bold 66px Arial';ctx.fillText('S O L M A R E',512,790);const decalMap=new THREE.CanvasTexture(c);decalMap.colorSpace=THREE.SRGBColorSpace;
 const decalMat=new THREE.MeshStandardMaterial({map:decalMap,transparent:true,roughness:.4,polygonOffset:true,polygonOffsetFactor:-2});decalMat.userData.exempt='livery decal';
 for(const side of[-1,1]){const decal=mesh(new THREE.PlaneGeometry(.72,.60,4,4),decalMat);decal.rotation.y=side*Math.PI/2;decal.position.set(side*.923,.65,-.04);}
 // Subtle contact occlusion under the tyres and chassis.
 const sh=document.createElement('canvas');sh.width=sh.height=1024;const sc=sh.getContext('2d'),grad=sc.createRadialGradient(512,512,60,512,512,500);grad.addColorStop(0,'rgba(8,12,15,.6)');grad.addColorStop(.55,'rgba(8,12,15,.33)');grad.addColorStop(1,'rgba(8,12,15,0)');sc.fillStyle=grad;sc.fillRect(0,0,1024,1024);
 const shadow=mesh(new THREE.PlaneGeometry(2.8,5.5,4,4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sh),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;shadow.castShadow=false;shadow.userData.exempt='contact shadow';
 let triangles=0;const mats=new Set();root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const mat of(Array.isArray(o.material)?o.material:[o.material]))mats.add(mat.uuid);}});root.userData.triangles=triangles;root.userData.materials=mats.size;
 root.userData.update=(v,dt)=>{for(const w of wheels){w.steering.rotation.y=w.front?v.steer*.37:0;w.wheel.rotation.x+=v.speed*dt/.385;}rearLight.emissiveIntensity=v.brake>.1?5:1.3;};
 root.userData.paint=paint;
 return root;
}
