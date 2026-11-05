import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {random} from './track.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
export function combine(group){
 const byMaterial=new Map();group.updateMatrixWorld(true);
 group.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const n=g.index?g.toNonIndexed():g;for(const key of Object.keys(n.attributes))if(!['position','normal','uv'].includes(key))n.deleteAttribute(key);if(!byMaterial.has(o.material))byMaterial.set(o.material,[]);byMaterial.get(o.material).push(n);}});
 return [...byMaterial].map(([material,geos])=>{const geometry=mergeGeometries(geos);for(const g of geos)g.dispose();return{geometry,material};});
}
function add(root,geometry,material,position=V(0,0,0),scale=null){const m=new THREE.Mesh(geometry,material);m.position.copy(position);if(scale)m.scale.copy(scale);root.add(m);return m;}
function branch(root,points,r,material){return add(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,r,8,false),material);}
function blade(start,end,side,width){
 const p=[],uv=[],idx=[];for(let i=0;i<=4;i++){const t=i/4,center=start.clone().lerp(end,t);center.y+=Math.sin(t*Math.PI)*.14;const w=Math.sin(t*Math.PI)*width;for(const sign of[-1,1]){const q=center.clone().addScaledVector(side,w*sign);p.push(q.x,q.y,q.z);uv.push((sign+1)/2,t);}}
 for(let i=0;i<4;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function leafAlpha(){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d'),rng=random(440);ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);ctx.fillStyle='#fff';
 for(let i=0;i<2600;i++){const x=rng()*1024,y=rng()*1024;ctx.save();ctx.translate(x,y);ctx.rotate(rng()*Math.PI);ctx.beginPath();ctx.ellipse(0,0,4+rng()*8,2+rng()*3,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
export function foliageMaterials(m){const alpha=leafAlpha();return{palm:m.mat('leaf','#7c914a',{side:THREE.DoubleSide,roughness:.92,normalScale:new THREE.Vector2(.18,.18)}),leaf:m.mat('leaf','#b4bd91',{alphaMap:alpha,alphaTest:.11,side:THREE.DoubleSide,roughness:1}),pine:m.mat('leaf','#99ad75',{alphaMap:alpha,alphaTest:.11,side:THREE.DoubleSide,roughness:1}),bark:m.mat('bark','#b0a084',{roughness:1})};}
export function treePrototype(species,m,f,variant=0){
 const root=new THREE.Group(),rng=random(519+variant*113+species.length),h=species==='palm'?10:species==='pine'?9:species==='olive'?5:1.25;
 if(species==='palm'){
  const bend=.5+variant*.2,stem=[V(0,0,0),V(.12,3,.06),V(bend*.65,7,.15),V(bend,h,.22)];branch(root,stem,.20,f.bark);
  for(let k=0;k<14;k++){const a=k*Math.PI*2/14+rng()*.2,dir=V(Math.cos(a),0,Math.sin(a)),cross=V(-dir.z,0,dir.x),len=3.4+rng()*.9,origin=V(bend,h,.22),pts=[];
   for(let i=0;i<=10;i++){const t=i/10,q=origin.clone().addScaledVector(dir,len*t);q.y+=Math.sin(t*Math.PI)*.65-t*t*1.8;pts.push(q);}branch(root,pts,.025,f.palm);
   for(let j=1;j<18;j++){const t=j/18,center=origin.clone().addScaledVector(dir,len*t);center.y+=Math.sin(t*Math.PI)*.65-t*t*1.8;for(const sign of[-1,1]){const tip=center.clone().addScaledVector(cross,sign*.95*Math.sqrt(1-t)).addScaledVector(dir,.35);tip.y-=.23+.45*t;add(root,blade(center,tip,dir,.055),f.palm);}}
  }
 }else if(species==='pine'||species==='olive'){
  branch(root,[V(0,0,0),V(.12,h*.4,.1),V(-.15,h*.76,0)],species==='pine'?.24:.29,f.bark);
  const clusters=species==='pine'?13:18;
  for(let i=0;i<clusters;i++){const a=rng()*Math.PI*2,r=Math.sqrt(rng())*(species==='pine'?2.7:1.9),y=h*(species==='pine'?.76:.62)+rng()*h*.2,point=V(Math.cos(a)*r,y,Math.sin(a)*r);
   if(i%3===0)branch(root,[V(0,h*.35,0),V(point.x*.5,h*.58,point.z*.5),point],.06,f.bark);
   const g=new THREE.SphereGeometry(1,16,12),p=g.attributes.position;for(let j=0;j<p.count;j++){const v=V(p.getX(j),p.getY(j),p.getZ(j)),noise=1+.1*Math.sin(v.x*13+variant)*Math.sin(v.z*11+v.y*8);p.setXYZ(j,v.x*noise,v.y*noise,v.z*noise);}g.computeVertexNormals();
   add(root,g,species==='pine'?f.pine:f.leaf,point,V(species==='pine'?1.7:1.25,species==='pine'?.7:1.0,species==='pine'?1.5:1.1));
  }
 }else{
  for(let i=0;i<7;i++){const a=rng()*Math.PI*2,r=rng()*.6;add(root,new THREE.SphereGeometry(1,12,10),f.leaf,V(Math.cos(a)*r,.35+rng()*.35,Math.sin(a)*r),V(.7,.65,.7));}
 }
 return combine(root);
}
export class InstanceBatch{
 constructor(scene){this.scene=scene;this.items=new Map();this.meshes=[];this.serial=0;}
 add(key,parts,matrix,color){if(!this.items.has(key))this.items.set(key,{parts,instances:[]});this.items.get(key).instances.push({matrix,color});}
 flush(){for(const [key,{parts,instances}]of this.items){const cells=new Map();for(const instance of instances){const e=instance.matrix.elements,cell=`${Math.floor(e[12]/180)},${Math.floor(e[14]/180)}`;if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(instance);}for(const list of cells.values()){const serial=this.serial++,entityIds=list.map((_,i)=>`${key}:${serial}:${i}`);for(const part of parts){const mesh=new THREE.InstancedMesh(part.geometry,part.material,list.length);mesh.name=key;mesh.userData.entityIds=entityIds;mesh.userData.entityType=key.startsWith('house')?'house':key.startsWith('church')?'landmark':/^(palm|pine|olive|bush)/.test(key)?'vegetation':key.startsWith('rock')?'rock':'prop';mesh.userData.variant=key;mesh.castShadow=true;mesh.receiveShadow=true;for(let i=0;i<list.length;i++){mesh.setMatrixAt(i,list[i].matrix);if(list[i].color)mesh.setColorAt(i,list[i].color);}mesh.computeBoundingSphere();this.scene.add(mesh);this.meshes.push(mesh);}}}this.items.clear();}
}
export function rockPrototype(m,seed=1){const rng=random(seed),g=new THREE.SphereGeometry(1,20,14),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.16*Math.sin(x*8+seed)*Math.cos(z*9-y*7);p.setXYZ(i,x*k,(y+1)*.5*k,z*k);}g.computeVertexNormals();return[{geometry:g,material:m.mat('stone','#b6ad94',{roughness:1,normalScale:new THREE.Vector2(.9,.9)})}];}
export function propPrototype(type,m){
 const root=new THREE.Group(),metal=m.mat('metal','#4b5551',{metalness:.65,roughness:.55}),wood=m.mat('bark','#b8a57d'),stone=m.mat('stone','#d1c3a3');
 const box=(x,y,z,mat,pos)=>add(root,new RoundedBoxGeometry(x,y,z,1,.025),mat,pos);
 if(type==='bench'){
  for(let i=0;i<5;i++)box(1.8,.06,.10,wood,V(0,.48,(i-2)*.12));for(let i=0;i<3;i++)box(1.8,.08,.09,wood,V(0,.75+i*.13,-.32));for(const x of[-.65,.65]){box(.06,.5,.46,metal,V(x,.25,0));box(.05,.95,.05,metal,V(x,.48,-.3));}
 }else if(type==='lamp'){
  branch(root,[V(0,0,0),V(0,5.5,0),V(0,6.2,.3),V(0,6.1,1.0)],.055,metal);add(root,new THREE.SphereGeometry(1,16,12),metal,V(0,6.08,1),V(.28,.1,.36));add(root,new THREE.SphereGeometry(.12,16,12),new THREE.MeshStandardMaterial({color:'#ffe4ae',emissive:'#ffba65',emissiveIntensity:1.2}),V(0,6,1));
 }else if(type==='bollard'){
  add(root,new THREE.CylinderGeometry(.10,.15,.82,16,3),stone,V(0,.41,0));add(root,new THREE.SphereGeometry(.12,16,12),stone,V(0,.83,0));
 }else if(type==='planter'){
  add(root,new THREE.CylinderGeometry(.48,.34,.62,24,4,true),stone,V(0,.31,0));add(root,new THREE.CylinderGeometry(.45,.45,.1,24),m.dark,V(0,.55,0));
 }else if(type==='fence'){
  for(const x of[-1.2,1.2])add(root,new THREE.CylinderGeometry(.055,.07,1.05,10,4),wood,V(x,.525,0));for(const y of[.4,.85])box(2.5,.09,.06,wood,V(0,y,0));
 }
 return combine(root);
}

