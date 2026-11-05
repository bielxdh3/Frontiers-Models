import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {random,validateWorld} from './track.js';
import {InstanceBatch,foliageMaterials,treePrototype,rockPrototype,propPrototype,combine} from './scenery.js';
import {createOcean} from './ocean.js';
import {housePrototype,churchPrototype} from './buildings.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
export class World{
 constructor(scene,track,terrain,materials,lighting){
  Object.assign(this,{scene,track,terrain,materials,lighting});this.objects=[];this.colliders=[];this.rng=random(track.data.seed);this.batch=new InstanceBatch(scene);this.prototypes=new Map();this.foliage=foliageMaterials(materials);this.time=0;
 }
 prototype(type,variant=0){const key=type+variant;if(!this.prototypes.has(key)){let parts;if(['palm','pine','olive','bush'].includes(type))parts=treePrototype(type,this.materials,this.foliage,variant);else if(type==='rock')parts=rockPrototype(this.materials,variant+3);else parts=propPrototype(type,this.materials);this.prototypes.set(key,parts);}return this.prototypes.get(key);}
 place(type,s,offset,scale=1,variant=0,angle=null){
  const f=this.track.at(s,offset),position=this.terrain.raycast(f.p.x,f.p.z),radius=({palm:4.7,pine:4.6,olive:3.2,bush:1.35,rock:1.2,bench:1.1,lamp:1.2,bollard:.2,planter:.55,fence:1.3}[type]||1)*scale;
  if(this.track.nearest(position.x,position.z).distance-radius<this.track.width/2+3)return null;
  if(this.objects.some(o=>o.type==='house'&&Math.hypot(o.position.x-position.x,o.position.z-position.z)<o.radius+radius+.3))return null;
  const matrix=new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromAxisAngle(V(0,1,0),angle??this.rng()*Math.PI*2),V(scale,scale,scale));
  const tint=new THREE.Color().setRGB(.88+this.rng()*.12,.88+this.rng()*.12,.84+this.rng()*.13);
  this.batch.add(type+variant,this.prototype(type,variant),matrix,tint);
  const object={id:`${type}-${this.objects.length}`,type:type==='rock'?'rock':['palm','pine','olive','bush'].includes(type)?'vegetation':'prop',species:['palm','pine','olive','bush'].includes(type)?type:null,s,offset,position,radius,scale};this.objects.push(object);return object;
 }
 ribbon(start,end,left,right,material,lift=.018,step=2){
  const count=Math.max(2,Math.ceil((end-start)/step)),p=[],uv=[],index=[];
  for(let i=0;i<=count;i++)for(const offset of[left,right]){const f=this.track.at(start+(end-start)*i/count,offset);p.push(f.p.x,f.p.y+lift,f.p.z);uv.push(offset===left?0:1,i/count);}
  for(let i=0;i<count;i++){const a=i*2;index.push(a,a+2,a+1,a+1,a+2,a+3);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
 }
 structure(s,offset,geometry,material,lift=0){const f=this.track.at(s,offset),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(this.terrain.raycast(f.p.x,f.p.z));mesh.position.y+=lift;mesh.rotation.y=f.yaw;mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;}
 signTexture(text,sub='',color='#e6dbc4'){
  const c=document.createElement('canvas');c.width=2048;c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#19313a';ctx.fillRect(0,0,2048,1024);ctx.fillStyle=color;ctx.fillRect(0,0,22,1024);ctx.fillRect(2026,0,22,1024);ctx.textAlign='center';ctx.font='bold 440px Arial';ctx.fillText(text,1024,590,1900);ctx.font='90px Arial';ctx.fillText(sub,1024,800,1850);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 shoreOffset(s,height=.35){let best=-80,error=Infinity;for(let offset=-25;offset>=-160;offset-=.5){const p=this.track.at(s,offset).p,d=Math.abs(this.terrain.sample(p.x,p.z)-height);if(d<error){error=d;best=offset;}}return best;}
 addRoadDetails(){
  const m=this.materials;const group=new THREE.Group();
  for(let s=0;s<this.track.length;s+=18){const patch=this.ribbon(s,s+5,-.055,.055,m.line,.022,1);this.scene.remove(patch);group.add(patch);}
  for(const part of combine(group)){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.receiveShadow=true;this.scene.add(mesh);}
  // Rubber marks use two translucent, textured strips along the actual road.
  const rubber=m.mat('rubber','#23282c',{transparent:true,opacity:.15,depthWrite:false,roughness:.83});for(const off of[-1.15,1.15])this.ribbon(0,this.track.length,off-.12,off+.12,rubber,.026,3);
  const checkCanvas=document.createElement('canvas');checkCanvas.width=checkCanvas.height=1024;const ctx=checkCanvas.getContext('2d');for(let y=0;y<4;y++)for(let x=0;x<20;x++){ctx.fillStyle=(x+y)%2?'#203037':'#e3d8bc';ctx.fillRect(x*51.2,y*256,52,257);}const checkMap=new THREE.CanvasTexture(checkCanvas);checkMap.colorSpace=THREE.SRGBColorSpace;
  this.ribbon(160,161.8,-5.35,5.35,new THREE.MeshStandardMaterial({map:checkMap,normalMap:m.textures.paint.normalMap,roughness:.8}),.027,.3);
  const grid=new THREE.Group();for(let row=0;row<3;row++)for(const lane of[-2.3,2.3]){const s=153-row*7;for(const mesh of[this.ribbon(s,s+.12,lane-1.15,lane+1.15,m.line,.027,.03),this.ribbon(s,s+1.1,lane-1.15,lane-1.03,m.line,.027,.3),this.ribbon(s,s+1.1,lane+1.03,lane+1.15,m.line,.027,.3)]){this.scene.remove(mesh);grid.add(mesh);}}for(const part of combine(grid)){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.receiveShadow=true;this.scene.add(mesh);}
  const curbGroup=new THREE.Group(),red=m.mat('paint','#bd6141',{roughness:.85});for(let s=this.track.length*.27;s<this.track.length*.49;s+=3)for(const side of[-1,1]){if(this.track.curvature(s)<.013)continue;const mesh=this.ribbon(s,s+3.03,side<0?-6.15:5.5,side<0?-5.5:6.15,Math.floor(s/3)%2?red:m.line,.035,1);this.scene.remove(mesh);curbGroup.add(mesh);}for(const part of combine(curbGroup)){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.receiveShadow=true;this.scene.add(mesh);}
 }
 addCoast(){
  const m=this.materials,rng=this.rng,end=this.track.length*.235;this.ocean=createOcean(this.terrain,this.lighting.sunDirection);this.scene.add(this.ocean.mesh);
  for(let s=20;s<end;s+=21){const offset=16+rng()*7;this.place('palm',s,offset,.78+rng()*.32,Math.floor(rng()*3));if(s%63<25)this.place('palm',s+8,-(18+rng()*12),.73+rng()*.25,Math.floor(rng()*3));}
  for(let s=4;s<end;s+=5.4)for(const side of[-1,1]){this.place('bush',s,side*(10+rng()*18),.24+rng()*.5,Math.floor(rng()*3));if(rng()>.35)this.place('bush',s+2,side*(13+rng()*22),.55+rng()*.5,Math.floor(rng()*3));}
  for(let s=45;s<end;s+=39){this.place('lamp',s,10.4,1,0,this.track.at(s).yaw);this.place('bench',s+8,-12.5,1,0,this.track.at(s).yaw);this.place('planter',s+12,10.6,1.15);this.place('bush',s+12,10.6,.43);}
  const shoreRocks=[];for(let s=12;s<end;s+=24){const object=this.place('rock',s,-(82+rng()*42),1.3+rng()*2.5,Math.floor(rng()*3));if(object&&object.position.y<.4&&object.position.y+object.scale>0)shoreRocks.push(object);}
  for(let s=0;s<end;s+=12){this.place('rock',s,-(20+rng()*15),.5+rng()*1.2,Math.floor(rng()*3));this.place('fence',s,-15.5,1,0,this.track.at(s).yaw);}
  for(let s=20;s<end;s+=24){this.place('rock',s,44+rng()*32,3+rng()*4,Math.floor(rng()*3));for(let j=0;j<3;j++)this.place('bush',s+j*3,13+rng()*25,.65+rng()*.55,Math.floor(rng()*3));}
  for(let s=50;s<end;s+=75){const off=this.shoreOffset(s,0);for(let j=0;j<5;j++){const object=this.place('rock',s+j*2.1,off+(j%2)*2-3,.65+rng()*1.25,j%3);if(object)shoreRocks.unshift(object);}}
  this.shoreRocks=shoreRocks;this.ocean.setRocks(shoreRocks);
  // Low shoreline wall and guard barrier are road furniture, derived by arc length.
  const wallMaterial=m.mat('stone','#c7b995',{roughness:.95});const wallGroup=new THREE.Group();
  for(let s=0;s<end;s+=3){const f=this.track.at(s,-7.3),wall=new THREE.Mesh(new RoundedBoxGeometry(.40,.62,3.05,3,.04),wallMaterial);wall.position.copy(f.p);wall.position.y+=.31;wall.rotation.y=f.yaw;wallGroup.add(wall);}
  for(const part of combine(wallGroup)){const wall=new THREE.Mesh(part.geometry,part.material);wall.castShadow=true;wall.receiveShadow=true;this.scene.add(wall);}
  for(let s=40;s<end;s+=85){const f=this.track.at(s,8.8);const pole=this.structure(s,8.8,new THREE.CylinderGeometry(.045,.06,5.7,12,3),m.metal,2.85);const flagMat=new THREE.MeshStandardMaterial({map:this.signTexture('SOLMARE','COASTLINE RACING'),normalMap:m.textures.paint.normalMap,side:THREE.DoubleSide,roughness:.82});const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.6,8,8),flagMat);flag.position.copy(f.p).add(V(0,4.2,.72));flag.rotation.y=f.yaw+Math.PI/2;this.scene.add(flag);}
  const frameMaterial=m.mat('metal','#536465',{metalness:.6,roughness:.4});for(const side of[-1,1])this.structure(160,side*8.8,new RoundedBoxGeometry(.32,7.4,.38,4,.05),frameMaterial,3.7);
  const f=this.track.at(160),gantry=new THREE.Mesh(new RoundedBoxGeometry(18.1,1.25,.28,4,.08),new THREE.MeshStandardMaterial({map:this.signTexture('S O L M A R E','COSTA SOLMARE · 2.85 KM'),normalMap:m.textures.paint.normalMap,roughness:.65}));gantry.position.copy(f.p).add(V(0,7.0,0));gantry.rotation.y=f.yaw;gantry.castShadow=true;this.scene.add(gantry);
  this.batch.flush();
 }
 addHouse(s,offset,variant,landmark=false){
  const key=landmark?'church':'house'+variant;if(!this.prototypes.has(key))this.prototypes.set(key,landmark?churchPrototype(this.materials):housePrototype(this.materials,variant));const model=this.prototypes.get(key),f=this.track.at(s,offset),pos=this.terrain.raycast(f.p.x,f.p.z),yaw=f.yaw-Math.sign(offset)*Math.PI/2,q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),yaw);
  if(this.track.nearest(pos.x,pos.z).distance-model.radius<8.5)return false;
  if(this.objects.some(o=>o.type==='house'&&Math.hypot(o.position.x-pos.x,o.position.z-pos.z)<o.radius+model.radius+1))return false;
  const corners=[];for(const x of[-model.width/2-.3,model.width/2+.3])for(const z of[-model.depth/2-.3,model.depth/2+.3]){const p=V(x,0,z).applyQuaternion(q).add(pos);corners.push(this.terrain.sample(p.x,p.z));}
  const lift=Math.max(.10,Math.max(...corners)-pos.y+.08),matrix=new THREE.Matrix4().compose(pos.clone().add(V(0,lift,0)),q,V(1,1,1));
  this.batch.add(landmark?'church':'house'+variant,model.parts,matrix,new THREE.Color('#ffffff'));
  // Foundation bottom follows the same heightfield at every edge sample.
  const positions=[],uv=[],indices=[],width=model.width+.55,depth=model.depth+.55;
  const vertex=(x,z,top)=>{const p=V(x,0,z).applyQuaternion(q).add(pos);p.y=top?pos.y+lift:this.terrain.sample(p.x,p.z)-.015;positions.push(p.x,p.y,p.z);uv.push(x/2,z/2);return positions.length/3-1;};
  for(let side=0;side<4;side++)for(let j=0;j<8;j++){const t=j/8,t2=(j+1)/8;const edge=(t)=>side===0?[-width/2+t*width,-depth/2]:side===1?[width/2,-depth/2+t*depth]:side===2?[width/2-t*width,depth/2]:[-width/2,depth/2-t*depth];const a=edge(t),b=edge(t2),i0=vertex(...a,false),i1=vertex(...b,false),i2=vertex(...a,true),i3=vertex(...b,true);indices.push(i0,i2,i1,i1,i2,i3);}
  for(let x=0;x<4;x++)for(let z=0;z<4;z++){const a=vertex(-width/2+x*width/4,-depth/2+z*depth/4,true),b=vertex(-width/2+(x+1)*width/4,-depth/2+z*depth/4,true),c=vertex(-width/2+x*width/4,-depth/2+(z+1)*depth/4,true),d=vertex(-width/2+(x+1)*width/4,-depth/2+(z+1)*depth/4,true);indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();const footing=new THREE.Mesh(geometry,this.materials.mat('stone','#b6aa92',{side:THREE.DoubleSide}));footing.receiveShadow=true;this.scene.add(footing);
  this.objects.push({id:'house-'+this.objects.length,type:landmark?'landmark':'house',variant,position:pos,radius:model.radius,s,offset,height:lift+model.height});
  this.colliders.push({position:pos.clone(),radius:model.radius,height:lift+model.height,type:'house'});return true;
 }
 addGuardrail(start,end,side,style='metal'){
  const m=this.materials,material=style==='stone'?m.mat('stone','#d2c4ab'):style==='wood'?m.mat('bark','#ad9b73'):m.mat('metal','#adb5b0',{metalness:.8,roughness:.5}),group=new THREE.Group();
  for(let s=start;s<end;s+=3.5){const f=this.track.at(s,side*6.86);let rail;
   if(style==='stone'){rail=new THREE.Mesh(new RoundedBoxGeometry(.40,.85,3.52,3,.025),material);rail.position.copy(f.p).add(V(0,.425,0));}
   else{rail=new THREE.Mesh(new RoundedBoxGeometry(.16,.31,3.52,3,.035),material);rail.position.copy(f.p).add(V(0,.72,0));const post=new THREE.Mesh(new RoundedBoxGeometry(.10,1.0,.12,3,.015),material);post.position.copy(f.p).add(V(0,.5,0));post.rotation.y=f.yaw;group.add(post);}
   rail.rotation.set(-Math.atan2(f.t.y,Math.hypot(f.t.x,f.t.z)),f.yaw,0,'YXZ');group.add(rail);
  }
  for(const part of combine(group)){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);}
 }
 addCliff(){
  const rng=this.rng,L=this.track.length,start=L*.235,end=L*.515;
  for(const side of[-1,1])this.addGuardrail(start,end,side);
  for(let s=start;s<end;s+=13){const f=this.track.at(s),inland=f.right.x>0?1:-1;this.place('rock',s,inland*(21+rng()*16),2.8+rng()*5.5,Math.floor(rng()*3));this.place('bush',s,-inland*(12+rng()*14),.6+rng()*.6,Math.floor(rng()*3));if(rng()>.55)this.place('olive',s,inland*(33+rng()*12),.65+rng()*.4,Math.floor(rng()*3));}
  for(let s=start;s<end;s+=5.5)for(const side of[-1,1]){this.place('bush',s,side*(10+rng()*13),.3+rng()*.55,Math.floor(rng()*3));this.place('rock',s+2,side*(12+rng()*7),.35+rng()*.55,Math.floor(rng()*3));}
  // Chevrons identify the tight section without artificial route walls.
  const signMat=new THREE.MeshStandardMaterial({map:this.signTexture('› › ›','','#e6b66b'),normalMap:this.materials.textures.paint.normalMap,side:THREE.DoubleSide});
  for(const fraction of[.30,.345,.39,.445]){const s=L*fraction;this.structure(s,9.4,new RoundedBoxGeometry(.09,2.0,.09,3,.015),this.materials.metal,1.0);this.structure(s,9.4,new THREE.PlaneGeometry(2.8,.8,8,4),signMat,2.1);}
  this.batch.flush();
 }
 addVillage(){
  const L=this.track.length,start=L*.515,end=L*.765;let count=0;
  const paving=this.materials.mat('stone','#d9ccb7',{roughness:1});for(const side of[-1,1]){const mesh=this.ribbon(start+30,end-20,side<0?-26:7.5,side<0?-7.5:26,paving,.02,2);const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;for(let i=0;i<p.count;i++){p.setY(i,this.terrain.sample(p.getX(i),p.getZ(i))+.018);uv.setXY(i,p.getX(i)/3,p.getZ(i)/3);}mesh.geometry.computeVertexNormals();}
  for(let s=start+47;s<end-45;s+=34)for(const side of[-1,1]){if(this.addHouse(s+(side>0?5:0),side*(16.7+(count%3)*.65),count%6))count++;}
  this.addHouse(start+165,-43,0,true);
  for(const side of[-1,1])this.addGuardrail(start,end,side,'stone');
  for(let s=start+12;s<end;s+=11)for(const side of[-1,1]){this.place('bollard',s,side*9.2,.9);if(Math.floor(s/11)%3===0){this.place('planter',s,side*10.2,1.15);this.place('bush',s,side*10.2,.5,1);}else this.place('bush',s,side*10.2,.4,2);}
  for(let s=start+22;s<end-20;s+=50){this.place('lamp',s,9.7,1,0,this.track.at(s).yaw);this.place('bench',s+8,-10.2,1,0,this.track.at(s).yaw);}
  const plazaS=start+165;for(let i=0;i<7;i++){this.place('olive',plazaS-30+i*10,-28-(i%2)*7,.85,i%3);this.place('bench',plazaS-25+i*9,-22,1,0,this.track.at(plazaS).yaw);}
  for(let s=start;s<end;s+=14)for(const side of[-1,1]){this.place('olive',s,side*(34+this.rng()*15),.85+this.rng()*.3,Math.floor(this.rng()*3));this.place('bush',s+4,side*(12+this.rng()*24),.6+this.rng()*.4,Math.floor(this.rng()*3));}
  this.batch.flush();
 }
 addForest(){
  const L=this.track.length,start=L*.765,end=L,rng=this.rng;
  for(let s=start;s<end;s+=9)for(const side of[-1,1]){this.place(rng()>.27?'pine':'olive',s,side*(16+rng()*16),.72+rng()*.45,Math.floor(rng()*3));if(rng()>.35)this.place('pine',s+3,side*(38+rng()*30),.8+rng()*.6,Math.floor(rng()*3));}
  for(let s=start;s<end;s+=4.5)for(const side of[-1,1]){this.place('bush',s,side*(10.5+rng()*16),.4+rng()*.85,Math.floor(rng()*3));if(rng()>.5)this.place('rock',s,side*(12+rng()*8),.4+rng()*.8,Math.floor(rng()*3));}
  for(const side of[-1,1]){this.addGuardrail(start,L*.88,side);this.addGuardrail(L*.92,end,side);}
  this.addBridge();this.batch.flush();
 }
 addBridge(){
  const a=this.track.length*this.track.data.bridge.from,b=this.track.length*this.track.data.bridge.to,m=this.materials;
  for(const side of[-1,1]){
   this.addGuardrail(a,b,side,'stone');
   for(let s=a;s<=b;s+=9){const f=this.track.at(s,side*7.05),column=new THREE.Mesh(new RoundedBoxGeometry(.8,1.28,.8,4,.06),m.mat('stone','#cbbfa7'));column.position.copy(f.p).add(V(0,.64,0));column.rotation.y=f.yaw;column.castShadow=true;column.receiveShadow=true;this.scene.add(column);}
  }
  this.ribbon(a,b,-6.65,6.65,m.mat('stone','#b7aa8e'),-.12,1);
  for(const s of[a+2,b-2])for(const side of[-1,1]){this.place('lamp',s,side*9.6,1,0,this.track.at(s).yaw);}
  const steel=m.mat('metal','#64877c',{metalness:.7,roughness:.48}),archGroup=new THREE.Group();for(const side of[-1,1]){const points=[];for(let i=0;i<=64;i++){const t=i/64,f=this.track.at(a+(b-a)*t,side*6.8);points.push(f.p.clone().add(V(0,.7+11*Math.sin(Math.PI*t),0)));}const arch=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),128,.19,12,false),steel);archGroup.add(arch);for(let i=1;i<12;i++){const t=i/12,f=this.track.at(a+(b-a)*t,side*6.8),h=11*Math.sin(t*Math.PI);const rod=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,h,12,4),steel);rod.position.copy(f.p).add(V(0,.7+h/2,0));archGroup.add(rod);}}
  for(const part of combine(archGroup)){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);}
  const material=m.mat('stone','#a79a81');
  for(let s=a+10;s<b-5;s+=22)for(const side of[-1,1]){const frame=this.track.at(s,side*7.2),arch=new THREE.Mesh(new THREE.TorusGeometry(7.0,.50,16,48,Math.PI),material);arch.rotation.y=frame.yaw+Math.PI/2;arch.position.copy(frame.p).add(V(0,-7.4,0));arch.castShadow=true;arch.receiveShadow=true;this.scene.add(arch);}
 }
 addRemainingZones(){this.addGuardrail(0,this.track.length*.235,1,'wood');this.addCliff();this.addVillage();this.addForest();}
 decorateTerrain(ground){
  const material=ground.material;material.onBeforeCompile=shader=>{shader.uniforms.sandColor={value:this.materials.textures.sand.map};shader.uniforms.rockColor={value:this.materials.textures.stone.map};shader.vertexShader='varying vec3 vGroundWorld;varying vec3 vGroundNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundWorld=(modelMatrix*vec4(position,1.)).xyz;vGroundNormal=normalize(mat3(modelMatrix)*normal);');shader.fragmentShader='varying vec3 vGroundWorld;varying vec3 vGroundNormal;uniform sampler2D sandColor;uniform sampler2D rockColor;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float macro=sin(vGroundWorld.x*.079+sin(vGroundWorld.z*.019)*3.)*.12+sin(vGroundWorld.z*.041+vGroundWorld.x*.022)*.11;
  float coast=(1.-smoothstep(0.,55.,vGroundWorld.x))*(1.-smoothstep(8.,18.,vGroundWorld.y));float wet=1.-smoothstep(.2,1.8,vGroundWorld.y);
  diffuseColor.rgb*=vec3(.9+macro,.95+macro,.85+macro);diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(rockColor,vGroundWorld.zy/4.).rgb*.95,smoothstep(.12,.4,1.-abs(normalize(vGroundNormal).y)));
  diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(sandColor,vGroundWorld.xz/7.).rgb*(.9+macro*.3),coast);
  diffuseColor.rgb*=mix(1.,.52,wet*coast);
  `);shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.22,wet*coast);');};material.needsUpdate=true;
 }
 update(time,position=null,quality='high'){this.time=time;this.ocean?.update(time);if(position&&this.shoreRocks)this.ocean.setRocks([...this.shoreRocks].sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position)));if(position)for(const mesh of this.batch.meshes){const b=mesh.boundingSphere,range=quality==='low'?185:350;mesh.visible=Math.hypot(b.center.x-position.x,b.center.z-position.z)<range+b.radius;}}
 validate(){return validateWorld(this.track,this.terrain,this.objects);}
 stats(){const bins=Array.from({length:Math.ceil(this.track.length/100)},()=>0);for(const o of this.objects)bins[Math.min(bins.length-1,Math.floor(o.s/100))]++;return{objects:this.objects.length,houseCount:this.objects.filter(o=>o.type==='house').length,houseVariants:[...new Set(this.objects.filter(o=>o.type==='house').map(o=>o.variant))].length,species:[...new Set(this.objects.map(o=>o.species).filter(Boolean))],propsPer100m:bins};}
}

