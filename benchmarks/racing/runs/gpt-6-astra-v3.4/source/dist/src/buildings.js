import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {combine} from './scenery.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function rectPath(x,y,w,h){const p=new THREE.Path();p.moveTo(x,y);p.lineTo(x,y+h);p.lineTo(x+w,y+h);p.lineTo(x+w,y);p.closePath();return p;}
function wall(width,height,windows,door){
 const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(width/2,height);shape.lineTo(-width/2,height);shape.closePath();
 for(const win of windows)shape.holes.push(rectPath(win.x-.54,win.y,1.08,1.42));
 if(door)shape.holes.push(rectPath(-.53,.06,1.06,2.1));
 const g=new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,curveSegments:4});g.clearGroups();return g;
}
export function housePrototype(m,variant){
 const colors=['#e5cf9f','#bf9e79','#d7ae90','#d8dbc6','#e1c89e','#d6b5a2'],shutters=['#40645d','#45626b','#687955','#785b4a','#4b7172','#7a5e52'];
 const w=6.6+(variant%3)*.45,d=5.5+(variant%2)*.5,floors=variant%3===2?3:2,h=floors*3,root=new THREE.Group();
 const plaster=m.mat('plaster',colors[variant],{roughness:.96}),stone=m.mat('stone','#d0c1a5',{roughness:.94}),wood=m.mat('bark',shutters[variant],{roughness:.82}),roofMat=m.mat('tile',variant%2?'#c6aa89':'#d3ad90',{roughness:.9}),iron=m.mat('metal','#3c4845',{metalness:.7,roughness:.5}),glass=m.glass.clone();glass.color.set('#4d6c70');glass.envMapIntensity=.8;glass.opacity=.97;
 const leafMaterial=m.mat('leaf','#739e68'),doorMaterial=m.mat('bark','#715b40');
 const add=(geometry,material,pos=V(0,0,0),parent=root)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(pos);parent.add(mesh);return mesh;};
 // One segment per bevel is sufficient for these 22 mm architectural edges.
 // Keep the physical recesses, shutters and frames without oversampling them.
 const block=(x,y,z,material,pos,parent=root)=>add(new RoundedBoxGeometry(x,y,z,1,.022),material,pos,parent);
 function facade(width,rotation,z,x=0,front=false){
  const group=new THREE.Group();group.rotation.y=rotation;group.position.set(x,0,z);root.add(group);const windows=[];
  for(let floor=0;floor<floors;floor++)for(const side of[-1,1])windows.push({x:side*width*.28,y:floor*3+1.0});
  add(wall(width,h,windows,front),plaster,V(0,0,0),group);
  for(const win of windows){const cx=win.x,cy=win.y+.71;
   add(new THREE.PlaneGeometry(1.05,1.4,4,4),glass,V(cx,cy,.025),group);
   block(1.36,.105,.15,stone,V(cx,win.y-.03,.28),group);block(1.36,.105,.13,stone,V(cx,win.y+1.46,.28),group);
   for(const side of[-1,1]){block(.10,1.52,.13,stone,V(cx+side*.62,cy,.28),group);const panel=block(.33,1.37,.075,wood,V(cx+side*.91,cy,.30),group);panel.rotation.y=side*.15;for(let j=0;j<8;j++)block(.28,.035,.04,wood,V(cx+side*.91,win.y+.1+j*.16,.35),group);}
   block(.035,1.4,.05,wood,V(cx,cy,.08),group);block(1.03,.035,.05,wood,V(cx,cy,.08),group);
   if((variant+Math.round(win.y))%2===0){block(1.3,.22,.30,stone,V(cx,win.y-.20,.39),group);for(let k=0;k<7;k++){const leaf=add(new THREE.SphereGeometry(.14,12,8),leafMaterial,V(cx+(k-3)*.16,win.y-.02,.4),group);leaf.scale.y=.6;}}
  }
  if(front){block(1.0,2.06,.08,doorMaterial,V(0,1.08,.035),group);for(const side of[-1,1])block(.12,2.25,.19,stone,V(side*.61,1.12,.3),group);block(1.36,.16,.19,stone,V(0,2.25,.3),group);add(new THREE.SphereGeometry(.04,12,8),iron,V(.33,1.0,.11),group);}
 }
 facade(w,0,d/2,0,true);facade(w,Math.PI,-d/2);facade(d,Math.PI/2,0,w/2);facade(d,-Math.PI/2,0,-w/2);
 block(w+.45,.24,d+.45,stone,V(0,h-.03,0));
 // Pitched roof: subdivided physical planes, tiles in both albedo and normals.
 for(const side of[-1,1]){const geo=new THREE.PlaneGeometry(w/2+.55,d+.85,18,24);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++){const x=(p.getX(i)+(w/2+.55)/2);p.setXYZ(i,side*x,h+1.45-x*.38,p.getZ(i));uv.setXY(i,uv.getX(i)*3,uv.getY(i)*5);}if(side<0){const idx=geo.index.array;for(let i=0;i<idx.length;i+=3){const t=idx[i];idx[i]=idx[i+1];idx[i+1]=t;}}geo.computeVertexNormals();const roof=add(geo,roofMat);roof.material.side=THREE.DoubleSide;}
 const gable=new THREE.Shape();gable.moveTo(-w/2,0);gable.lineTo(w/2,0);gable.lineTo(0,1.45);gable.closePath();for(const side of[-1,1]){const g=new THREE.ExtrudeGeometry(gable,{depth:.18,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,steps:2});g.clearGroups();add(g,plaster,V(0,h,side*d/2));}
 block(.62,1.5,.65,stone,V(w*.25,h+1.5,-d*.18));block(.82,.16,.85,stone,V(w*.25,h+2.28,-d*.18));
 if(variant%2===0){
  block(2.1,.16,1.12,stone,V(0,3.05,d/2+.66));for(const side of[-1,1])block(.05,.87,1.0,iron,V(side*1.01,3.52,d/2+.70));block(2.1,.045,.045,iron,V(0,3.96,d/2+1.2));for(let i=0;i<11;i++)block(.025,.82,.025,iron,V((i-5)*.19,3.51,d/2+1.2));
 }else{
  const awningMat=m.mat('paint',variant===1?'#638278':'#b5724f',{roughness:.9,side:THREE.DoubleSide});const awning=add(new THREE.PlaneGeometry(2.65,1.4,12,8),awningMat,V(0,2.55,d/2+.65));awning.rotation.x=-1.22;
 }
 return{parts:combine(root),width:w,depth:d,height:h+2.4,radius:Math.hypot(w/2+.5,d/2+1.3),variant};
}
export function churchPrototype(m){
 const root=new THREE.Group(),stone=m.mat('stone','#dfccb0'),roof=m.mat('tile','#ae8c6b'),dark=m.mat('rubber','#343b3a');
 const mesh=(g,mat,p)=>{const o=new THREE.Mesh(g,mat);o.position.copy(p);root.add(o);return o;};
 const block=(w,h,d,mat,p)=>mesh(new RoundedBoxGeometry(w,h,d,5,.06),mat,p);
 block(9,8,13,stone,V(0,4,0));
 const front=new THREE.Shape();front.moveTo(-4.5,0);front.lineTo(4.5,0);front.lineTo(0,3);front.closePath();const g=new THREE.ExtrudeGeometry(front,{depth:13.4,bevelEnabled:true,bevelThickness:.1,bevelSize:.1,bevelSegments:3});g.clearGroups();mesh(g,roof,V(0,8,-6.7));
 block(4.1,18.5,4.1,stone,V(-6,9.25,3));block(4.6,.4,4.6,stone,V(-6,14.7,3));block(4.7,.4,4.7,stone,V(-6,18.4,3));
 for(const side of[-1,1]){block(1.45,2.5,.06,dark,V(-6+side*1.0,16.8,5.08));const arch=mesh(new THREE.TorusGeometry(.73,.13,12,32,Math.PI),stone,V(-6+side*1.0,18.0,5.14));}
 const spire=mesh(new THREE.ConeGeometry(3,5.0,8,8),roof,V(-6,21,3));spire.rotation.y=Math.PI/8;
 block(.16,2.0,.16,dark,V(-6,24.3,3));block(1.1,.16,.16,dark,V(-6,24.6,3));
 block(2.25,3.5,.08,m.mat('bark','#6e5845'),V(0,1.75,6.55));mesh(new THREE.TorusGeometry(1.13,.18,12,40,Math.PI),stone,V(0,3.5,6.64));
 const glass=m.glass.clone();glass.color.set('#56777c');const round=mesh(new THREE.CircleGeometry(.9,48),glass,V(0,6.25,6.61));mesh(new THREE.TorusGeometry(.98,.12,12,48),stone,V(0,6.25,6.65));
 return{parts:combine(root),radius:13.5,height:25,width:16,depth:15};
}
