import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mix,clamp,smooth,rng} from './track.js';
import {houseTemplate} from './village.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function combine(geos){const g=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));g.computeVertexNormals();return g}
function branch(a,b,r1,r2){const dir=b.clone().sub(a),g=new THREE.CylinderGeometry(r2,r1,dir.length(),8,3);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),dir.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g}
function leaf(a,b,width){const dir=b.clone().sub(a),side=V(-dir.z,0,dir.x).normalize().multiplyScalar(width),mid=a.clone().lerp(b,.46);mid.y+=width*.15;const p=[...a.toArray(),...mid.clone().add(side).toArray(),...b.toArray(),...mid.clone().sub(side).toArray()];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.5,.5,1,1,.5],2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();return g}
function treeGeometry(type,seed=3704){const random=rng(seed),wood=[],leaves=[];
 if(type==='palm'){
  const height=8;for(let i=0;i<16;i++){const a=V(.7*(i/16)**2,i*.5,0),b=V(.7*((i+1)/16)**2,(i+1)*.5,0);wood.push(branch(a,b,.19-i*.004,.185-i*.004))}
  const crown=V(.7,8,0);for(let i=0;i<13;i++){const angle=i/13*Math.PI*2+.2,len=3.1+random(),pts=[];for(let j=0;j<=10;j++){const u=j/10;pts.push(crown.clone().add(V(Math.cos(angle)*len*u,Math.sin(u*Math.PI)*1.1-u*.9,Math.sin(angle)*len*u)))}for(let j=0;j<10;j++)wood.push(branch(pts[j],pts[j+1],.035,.018));for(let j=1;j<10;j++)for(const side of [-1,1]){const u=j/10,dir=V(Math.cos(angle+side*.82),0,Math.sin(angle+side*.82)).multiplyScalar(.8*Math.sin(u*Math.PI)+.25);dir.y=-.35-u*.2;leaves.push(leaf(pts[j],pts[j].clone().add(dir),.10))}}
 }else if(type==='pine'){
  wood.push(branch(V(),V(.3,8,0),.31,.13));for(let i=0;i<16;i++){const a=i*2.4,center=V(Math.cos(a)*(1.1+random()*2),7.1+random()*1.5,Math.sin(a)*(1.2+random()*1.8));wood.push(branch(V(.2,4.5,0),center,.12,.04));for(let j=0;j<34;j++){const ang=random()*6.28,r=Math.sqrt(random())*1.65,p=center.clone().add(V(Math.cos(ang)*r,random()*.8,Math.sin(ang)*r));for(let k=0;k<3;k++)leaves.push(leaf(p.clone().add(V(-.35,0,0)),p.clone().add(V(.35,.45,0)),.38))}}
 }else if(type==='olive'){
  wood.push(branch(V(),V(.3,2.5,.2),.25,.16));for(let i=0;i<12;i++){const a=i*2.4,center=V(Math.cos(a)*1.9,3.2+random()*1.3,Math.sin(a)*1.9);wood.push(branch(V(.3,1.8,.2),center,.13,.035));for(let j=0;j<45;j++){const ang=random()*6.28,r=Math.sqrt(random())*1.25,p=center.clone().add(V(Math.cos(ang)*r,(random()-.5)*1.2,Math.sin(ang)*r));const d=V(random()-.5,random()*.7,random()-.5).multiplyScalar(.9);leaves.push(leaf(p,p.clone().add(d),.16))}}
 }else{
  for(let i=0;i<180;i++){const a=random()*6.28,r=Math.sqrt(random())*1.3,p=V(Math.cos(a)*r,.25+random()*.8,Math.sin(a)*r);leaves.push(leaf(p,p.clone().add(V((random()-.5)*.7,.25+random()*.4,(random()-.5)*.7)),.23))}wood.push(branch(V(),V(0,.6,0),.06,.02));
 }
 return {wood:combine(wood),leaves:combine(leaves)};
}
export class Scenery {
 constructor(world){this.w=world;this.t=world.track;this.random=rng(3704);this.geos={};for(const type of ['palm','pine','olive','shrub'])this.geos[type]=treeGeometry(type);this.wood=world.mat('bark','#b5a08a');this.foliage=world.mat('leaves','#b2bc89',{side:THREE.DoubleSide,roughness:.85});this.foliage.normalScale.set(.5,.5);this.round=new RoundedBoxGeometry(1,1,1,2,.06);this.rock=new THREE.IcosahedronGeometry(1,2);const p=this.rock.attributes.position;for(let i=0;i<p.count;i++){const v=V().fromBufferAttribute(p,i);v.multiplyScalar(.8+this.random()*.35);p.setXYZ(i,v.x,v.y,v.z)}this.rock.computeVertexNormals();this.rockMat=world.mat('rock','#afa595');}
 tree(s,offset,type,scale=1){const o=this.t.place(s,offset,type,type==='shrub'?1:1.5);if(!o||o.p.y<.8)return;const yaw=this.random()*6.28,sc=V(scale*(.88+this.random()*.22),scale,scale);const matrix=this.w.matrix(o.p,sc,yaw);this.w.batch(type+'-trunks',this.geos[type].wood,this.wood,matrix);this.w.batch(type+'-foliage',this.geos[type].leaves,this.foliage,matrix,new THREE.Color().setHSL(type==='olive'?.23:.24,.2+this.random()*.15,.55+this.random()*.12));}
 stone(s,offset,scale=1){const o=this.t.place(s,offset,'rock',Math.max(1,scale));if(!o)return;o.p.y-=scale*.3;this.w.batch('rocks',this.rock,this.rockMat,this.w.matrix(o.p,V(scale*1.4,scale,scale),this.random()*6.28))}
 furniture(s,offset,type='bollard'){
  const w=this.w,o=this.t.place(s,offset,type,.4);if(!o)return;
  if(type==='lamp'){
   const mat=w.mat('metal','#344548');const pole=new THREE.CylinderGeometry(.065,.09,5.8,8,3);pole.translate(0,2.9,0);w.batch('lamps',pole,mat,w.matrix(o.p));const lamp=new RoundedBoxGeometry(.55,.13,.25,2,.03);lamp.translate(.2,5.8,0);w.batch('lamp-heads',lamp,w.materials.metal,w.matrix(o.p));
  }else if(type==='bench'){
   for(let i=0;i<4;i++){const g=new RoundedBoxGeometry(1.7,.06,.11,2,.02);g.translate(0,.52,i*.13-.2);w.batch('bench-slats',g,w.materials.wood,w.matrix(o.p,V(1,1,1),o.yaw))}for(const x of [-.65,.65]){const g=new THREE.CylinderGeometry(.035,.035,.5,8,2);g.translate(x,.25,0);w.batch('bench-legs',g,w.materials.metal,w.matrix(o.p,V(1,1,1),o.yaw))}
  }else{
   const g=new THREE.CylinderGeometry(.10,.13,.75,10,3);g.translate(0,.375,0);w.batch('bollards',g,w.materials.rock,w.matrix(o.p));
  }
 }
 rails(from,to,coast=false){
  const w=this.w,t=this.t,metal=w.mat('metal','#b4bec2');const railGeo=new RoundedBoxGeometry(.11,.24,4.05,2,.035),postGeo=new THREE.CylinderGeometry(.045,.06,.75,8,2);postGeo.translate(0,.375,0);
  for(let s=from*t.length;s<to*t.length;s+=4)for(const side of [-1,1]){const f=t.at(s,(t.width/2+.55)*side);if(coast){const wallGeo=new RoundedBoxGeometry(.45,.55,4.04,2,.08);w.batch('coastal-walls',wallGeo,w.mat('rock','#c5b79b'),w.matrix(f.p.clone().add(V(0,.25,0)),V(1,1,1),f.yaw))}else{w.batch('guardrails',railGeo,metal,w.matrix(f.p.clone().add(V(0,.65,0)),V(1,1,1),f.yaw));w.batch('rail-posts',postGeo,metal,w.matrix(f.p,V(1,1,1),f.yaw))}}
 }
 coast(){
  this.ocean();const w=this.w,t=this.t;this.rails(0,.285,true);this.rails(.975,1,true);
  // Two worn shoulder strips and a denser, planted promenade.
  const stone=w.mat('rock','#d2c5aa');for(const d of [-6.8,6.8])w.ribbon(d,1.5,stone,-.02,0,.285);
  for(let s=0;s<t.length*.285;s+=18){if(s%36<18)this.tree(s,12.6,'palm',.9+this.random()*.3);this.tree(s+7,-12-this.random()*6,'palm',.88+this.random()*.28);for(let i=0;i<4;i++)this.tree(s+i*4,19+this.random()*10,'shrub',.6+this.random()*.5);this.furniture(s,9.3,'bollard');if(Math.floor(s/18)%3===0)this.furniture(s,11,'bench');if(Math.floor(s/18)%4===0)this.furniture(s,10,'lamp');if(Math.floor(s/18)%2===0)this.stone(s,-27-this.random()*35,1.2+this.random()*1.8)}
  // Grid is located on the straight rather than at the spline seam.
  const paint=w.mat('plaster','#ece8d5'),g=new THREE.PlaneGeometry(.12,3,1,8);g.rotateX(-Math.PI/2);
  for(let row=0;row<3;row++)for(const side of [-1,1]){const s=100-row*8;for(const d of [side*2.3-1,side*2.3+1]){const f=t.at(s,d);f.p.y+=.025;w.batch('grid',g,paint,w.matrix(f.p,V(1,1,1),f.yaw))}}
  const f=t.at(111);const post=new THREE.CylinderGeometry(.14,.2,6.5,12,3);post.translate(0,3.25,0);for(const d of [-7.5,7.5])w.batch('start-arch',post,w.materials.metal,w.matrix(t.at(111,d).p));
  const banner=new RoundedBoxGeometry(15.3,.85,.25,3,.12);const arch=w.add(banner,w.mat('paint','#164952'));arch.position.copy(f.p).add(V(0,6.2,0));arch.rotation.y=f.yaw;
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.scale(1,8);ctx.fillStyle='#15414c';ctx.fillRect(0,0,2048,128);ctx.fillStyle='#f5e4c4';ctx.font='700 52px Arial';ctx.textAlign='center';ctx.fillText('C O S T A   D O R A D A',1024,84);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const bm=new THREE.MeshStandardMaterial({map:tex,roughness:.55,side:THREE.DoubleSide});const label=new THREE.Mesh(new THREE.PlaneGeometry(14.5,.8,16,2),bm);label.position.copy(f.p).add(V(0,6.2,-.14));label.rotation.y=f.yaw+Math.PI;w.scene.add(label);
  for(let s=5;s<t.length*.285;s+=42){const side=Math.floor(s/42)%2?1:-1;const f=t.at(s,side*7.7);const pole=new THREE.CylinderGeometry(.04,.04,3.4,8,2);pole.translate(0,1.7,0);w.batch('flagpoles',pole,w.materials.metal,w.matrix(f.p));const geo=new THREE.PlaneGeometry(.65,2.1,5,6);const a=geo.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getY(i)*4)*.09);const flag=new THREE.Mesh(geo,w.mat('paint',side===1?'#d19b59':'#316c75',{side:THREE.DoubleSide}));flag.position.copy(f.p).add(V(.35,2.3,0));flag.rotation.y=f.yaw;flag.castShadow=true;w.scene.add(flag)}
  this.w.flush();
 }
 ocean(){
  const w=this.w,time=w.time;
  const water=new THREE.ShaderMaterial({uniforms:{time,sun:{value:w.sunDir}},vertexShader:`varying vec3 vP;varying vec3 vN;uniform float time;void main(){vec3 p=position;float a=p.x*.07+p.z*.025-time*.8;float b=p.z*.13-p.x*.035+time*.65;p.y+=sin(a)*.12+sin(b)*.055+sin(p.x*.43+p.z*.3+time*1.2)*.018;vP=p;vN=normalize(vec3(-cos(a)*.0084+cos(b)*.0019,1.,-cos(a)*.003-cos(b)*.007));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec3 vP;varying vec3 vN;uniform float time;uniform vec3 sun;void main(){vec3 eye=normalize(cameraPosition-vP),n=normalize(vN+vec3(sin(vP.z*1.9+time)*.014,0.,sin(vP.x*2.5+time)*.014));float fres=pow(1.-max(dot(eye,n),0.),4.);float deep=smoothstep(-390.,-700.,vP.x);vec3 c=mix(vec3(.06,.35,.31),vec3(.018,.15,.21),deep);c=mix(c,vec3(.43,.58,.66),fres*.7);float spec=pow(max(dot(reflect(-sun,n),eye),0.),240.);c+=spec*vec3(2.4,1.5,.6);float sparkle=pow(max(dot(reflect(-sun,n),eye),0.),28.)*.06;c+=vec3(.8,.5,.2)*sparkle;gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  const g=new THREE.PlaneGeometry(22000,22000,240,240);g.rotateX(-Math.PI/2);g.translate(-10300,.2,0);const m=w.add(g,water);m.castShadow=false;
  // Foam follows the actual heightfield waterline found by surface intersection.
  const p=[],uv=[],idx=[];let n=0;
  for(let z=-920;z<=900;z+=4){let a=-600,b=-355;for(let j=0;j<14;j++){const x=(a+b)/2;if(this.t.height(x,z)>.28)b=x;else a=x}const x=(a+b)/2;for(let k=0;k<2;k++){p.push(x-k*5,.32,z);uv.push(k,z*.04)}if(n){const i=(n-1)*2;idx.push(i,i+2,i+1,i+1,i+2,i+3)}n++}
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(p,3));fg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));fg.setIndex(idx);fg.computeVertexNormals();
  const foam=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time},vertexShader:`varying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.x+=sin(time*.6+uv.y*.4)*.6;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;void main(){float wave=sin(vUv.x*21.-time*1.2+sin(vUv.y*1.2)*1.2)*.5+.5;float edge=sin(vUv.x*3.14159);float fleck=sin(vUv.y*52.+vUv.x*43.+time)*sin(vUv.y*23.-vUv.x*71.);float alpha=edge*(.18+pow(wave,6.)*.5+max(0.,fleck)*.13);gl_FragColor=vec4(.86,.91,.85,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});w.add(fg,foam).castShadow=false;
  // Sea rocks use spline offsets and stand in foam rings.
  for(let s=20;s<this.t.length*.27;s+=67){this.stone(s,-70-this.random()*12,2+this.random()*2)}
 }
 rest(){
  const w=this.w,t=this.t;this.rails(.285,.975);
  const curb=w.mat('plaster','#ffffff',{vertexColors:true});
  for(const side of [-1,1]){const m=w.ribbon(side*5.95,.62,curb,.055);const p=m.geometry.attributes.position,c=[];for(let i=0;i<p.count;i++){const red=Math.floor(i/2/2)%2===0;c.push(red?.65:.88,red?.12:.84,red?.075:.72)}m.geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3))}
  for(const d of [-1.55,1.55])w.ribbon(d,.36,w.mat('rubber','#171e21',{transparent:true,opacity:.16}),.023);
  // Cliff rock formations, roadside planting and varied forest layers.
  for(let s=.285*t.length;s<.515*t.length;s+=8){this.stone(s,15+this.random()*4,1.5+this.random()*2);if(Math.floor(s/8)%3===0)this.stone(s,28+this.random()*16,5+this.random()*6);this.tree(s,-13-this.random()*4,'shrub',.8+this.random()*.6);this.tree(s+4,23+this.random()*14,'olive',.9+this.random()*.35)}
  const colors=['#e6ceae','#e2c088','#cc9681','#b4c7c1','#d5c8ae','#dbc79d'];
  this.templates=Array.from({length:6},(_,i)=>houseTemplate(i));this.houseCount=0;const foundationPositions=[],foundationUV=[];
  for(let s=t.length*.526;s<t.length*.727;s+=23){for(const side of [-1,1]){
   const variant=this.houseCount%6,temp=this.templates[variant],offset=side*(17+this.random()*2),at=s+(side===1?6:0);
   const f=t.at(at,offset);if(t.objects.some(o=>o.kind==='house'&&o.p.distanceTo(f.p)<temp.radius+o.radius))continue;
   const o=t.place(at,offset,'house',temp.radius);if(!o)continue;o.variant=variant;o.height=temp.height;o.width=temp.width;o.depth=temp.depth;o.yaw=f.yaw-side*Math.PI/2;
   // Each foundation follows every metre of its footprint, including on slopes.
   const local=(x,z)=>V(o.p.x+Math.cos(o.yaw)*x+Math.sin(o.yaw)*z,0,o.p.z-Math.sin(o.yaw)*x+Math.cos(o.yaw)*z);
   const corners=[[-temp.width/2,-temp.depth/2],[temp.width/2,-temp.depth/2],[temp.width/2,temp.depth/2],[-temp.width/2,temp.depth/2]],edges=[];o.supportSamples=[];
   for(let edge=0;edge<4;edge++){const a=corners[edge],b=corners[(edge+1)%4],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1]));for(let j=0;j<=n;j++){const p=local(mix(a[0],b[0],j/n),mix(a[1],b[1],j/n));p.y=t.height(p.x,p.z);o.supportSamples.push(p);if(j<n){const q=local(mix(a[0],b[0],(j+1)/n),mix(a[1],b[1],(j+1)/n));q.y=t.height(q.x,q.z);edges.push([p,q])}}}
   o.p.y=Math.max(...o.supportSamples.map(p=>p.y))+.08;
   for(const [a,b] of edges){const p=[a.clone().add(V(0,-.035,0)),V(a.x,o.p.y+.03,a.z),V(b.x,o.p.y+.03,b.z),b.clone().add(V(0,-.035,0))];for(const i of [0,1,2,0,2,3]){foundationPositions.push(...p[i].toArray());foundationUV.push((i===0||i===1)?0:a.distanceTo(b),p[i].y*.5)}}
   const materials={wall:w.mat('plaster',colors[variant]),trim:w.mat('rock','#e6dac1'),roof:w.mat('tile','#ddab8a',{side:THREE.DoubleSide}),glass:new THREE.MeshPhysicalMaterial({color:'#426877',roughness:.16,metalness:.46,clearcoat:1,transparent:true,opacity:.95}),wood:w.mat('wood',['#32545e','#6e6860','#8b5f43','#35666b','#58675e','#8a6e42'][variant]),iron:w.mat('metal','#384e50'),green:this.foliage};
   for(const [name,g] of Object.entries(temp.geometries))w.batch('house-'+variant+'-'+name,g,materials[name],w.matrix(o.p,V(1,1,1),o.yaw));this.houseCount++;
  }}
  const foundation=new THREE.BufferGeometry();foundation.setAttribute('position',new THREE.Float32BufferAttribute(foundationPositions,3));foundation.setAttribute('uv',new THREE.Float32BufferAttribute(foundationUV,2));foundation.computeVertexNormals();w.add(foundation,w.mat('rock','#ac9b7a',{side:THREE.DoubleSide}));
  this.landmark();
  for(let s=.515*t.length;s<.735*t.length;s+=12){this.furniture(s,10.2,'bollard');if(Math.floor(s/12)%3===0){this.tree(s+3,-11.8,'olive',.7);this.furniture(s,11.5,'lamp')}this.tree(s+5,11,'shrub',.5)}
  for(let s=.735*t.length;s<.978*t.length;s+=9){for(const side of [-1,1]){this.tree(s,side*(12+this.random()*3),Math.floor(s/9)%3===0?'olive':'pine',.8+this.random()*.42);this.tree(s+3,side*(22+this.random()*18),this.random()>.4?'pine':'olive',.9+this.random()*.6);this.tree(s+4,side*(11.2+this.random()*2),'shrub',.65+this.random()*.8);if(Math.floor(s/9)%3===0)this.stone(s+5,side*19,1.5)}}
  // Fill every 100m bin with actual placed, visible props, rather than metadata counts.
  for(let s=0;s<t.length;s+=8){const zone=t.at(s).zone;if(zone!==3){this.tree(s+2,10.8,'shrub',.45+this.random()*.4);this.tree(s+3,-10.8,'shrub',.45+this.random()*.4);this.furniture(s,Math.floor(s/8)%2?9.7:-9.7)}else{this.furniture(s,9.7);this.furniture(s+4,-9.7)}}
  this.bridge();this.roadSigns();w.flush();
 }
 landmark(){
  const w=this.w,t=this.t,o=t.place(t.length*t.data.landmark.at,t.data.landmark.offset,'lighthouse',4.5);if(!o)return;this.landmarkPosition=o.p.clone();
  const white=w.mat('plaster','#ebe1ca'),red=w.mat('plaster','#c47a58'),metal=w.mat('metal','#3b5156');
  const profile=[V(0,0),V(3.7,0),V(3.6,.4),V(3.0,.8),V(2.7,4),V(2.25,18),V(2.2,20),V(2.6,20.2),V(2.65,20.5)];
  const geo=new THREE.LatheGeometry(profile,48);const tower=w.add(geo,white);tower.position.copy(o.p);for(const h of [7,14]){const r=2.7-(h-4)*.45/14;const stripe=w.add(new THREE.CylinderGeometry(r-.04,r+.04,1.3,48,2,true),red);stripe.position.copy(o.p).add(V(0,h,0))}
  const balcony=w.add(new THREE.CylinderGeometry(3.15,3.15,.3,48,2),white);balcony.position.copy(o.p).add(V(0,20.45,0));
  const glass=new THREE.MeshPhysicalMaterial({color:'#aac2bd',transparent:true,opacity:.62,metalness:.25,roughness:.1,side:THREE.DoubleSide});const lantern=w.add(new THREE.CylinderGeometry(2.15,2.15,2.4,16,2,true),glass);lantern.position.copy(o.p).add(V(0,21.8,0));
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2,post=new THREE.CylinderGeometry(.04,.04,2.7,8,2);post.translate(Math.cos(a)*2.17,21.8,Math.sin(a)*2.17);w.batch('lighthouse-bars',post,metal,w.matrix(o.p))}
  const cap=w.add(new THREE.SphereGeometry(2.5,32,12,0,Math.PI*2,0,Math.PI/2),metal);cap.scale.y=.55;cap.position.copy(o.p).add(V(0,23.1,0));
  const lamp=w.add(new THREE.SphereGeometry(.6,16,12),new THREE.MeshBasicMaterial({color:'#ffe3a3'}));lamp.position.copy(o.p).add(V(0,21.8,0));
  for(let i=0;i<8;i++){const g=new RoundedBoxGeometry(.8,1.45,.12,2,.05);const a=i/8*Math.PI*2;const m=w.add(g,metal);m.position.copy(o.p).add(V(Math.cos(a)*2.55,9.5,Math.sin(a)*2.55));m.rotation.y=-a+Math.PI/2}
  // A small planted square at the foot of the beacon.
  for(let i=0;i<8;i++){const at=o.s+(i-4)*8;this.tree(at,o.offset-9,'olive',.85);this.furniture(at,o.offset-5,'bench')}
 }
 bridge(){
  const w=this.w,t=this.t,{from,to}=t.data.bridge,stone=w.mat('rock','#c3bba6');
  for(let s=from*t.length;s<to*t.length;s+=3.5)for(const side of [-1,1]){const f=t.at(s,side*6.55);const g=new RoundedBoxGeometry(.7,.92,3.55,3,.07);w.batch('bridge-parapets',g,stone,w.matrix(f.p.clone().add(V(0,.45,0)),V(1,1,1),f.yaw));if(Math.floor(s/3.5)%2===0){const p=new RoundedBoxGeometry(.95,1.25,.95,3,.07);w.batch('bridge-pilasters',p,stone,w.matrix(f.p.clone().add(V(0,.6,0)),V(1,1,1),f.yaw))}}
  for(const edge of [from,to])for(const side of [-1,1]){const f=t.at(edge*t.length,side*7.2);const plinth=new RoundedBoxGeometry(2.2,2.4,3,3,.1);w.batch('bridge-abutments',plinth,stone,w.matrix(f.p.clone().add(V(0,-.7,0)),V(1,1,1),f.yaw))}
 }
 roadSigns(){
  const w=this.w,t=this.t;
  for(let s=80;s<t.length;s+=145){const f=t.at(s),curvature=t.at(s+45).curvature,side=curvature>0?-1:1;const o=t.place(s,side*9.2,'sign',.4);if(!o)continue;const pole=new THREE.CylinderGeometry(.04,.045,2.3,8,2);pole.translate(0,1.15,0);w.batch('signposts',pole,w.materials.metal,w.matrix(o.p));const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#e6cf93';ctx.fillRect(0,0,1024,1024);ctx.strokeStyle='#183a40';ctx.lineWidth=55;ctx.strokeRect(30,30,964,964);ctx.beginPath();ctx.moveTo(curvature>0?350:674,250);ctx.lineTo(curvature>0?674:350,512);ctx.lineTo(curvature>0?350:674,774);ctx.lineWidth=110;ctx.stroke();const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const mat=w.mat('paint','#ffffff');mat.map=tex;const m=w.add(new RoundedBoxGeometry(1,.85,.07,2,.04),mat);m.position.copy(o.p).add(V(0,2.05,0));m.rotation.y=f.yaw+Math.PI;}
 }
}
