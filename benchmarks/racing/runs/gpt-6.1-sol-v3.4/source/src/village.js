import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export function houseTemplate(variant){
 const width=6.4+(variant%3)*.7,depth=6.6+(variant%2)*1.1,floors=variant%3===2?3:2,height=floors*3.0;
 const bins={wall:[],trim:[],roof:[],glass:[],wood:[],iron:[],green:[]};
 const put=(geo,bin,pos=V(),ry=0,rz=0)=>{geo.rotateZ(rz);geo.rotateY(ry);geo.translate(...pos.toArray());bins[bin].push(geo)};
 const box=(w,h,d,bin,x,y,z,ry=0)=>put(new RoundedBoxGeometry(w,h,d,2,.025),bin,V(x,y,z),ry);
 for(let side=0;side<4;side++){
  const w=side%2?depth:width,d=side%2?width:depth,angle=side*Math.PI/2,shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,height);shape.lineTo(-w/2,height);shape.closePath();
  for(let row=0;row<floors;row++)for(let col=0;col<3;col++){
   const x=(col-1)*w*.29,y=row*3+1.4,windowWidth=1.02,wh=1.5;
   if(row===0&&col===1&&side===0)continue;
   const hole=new THREE.Path();hole.moveTo(x-windowWidth/2,y-wh/2);hole.lineTo(x-windowWidth/2,y+wh/2);hole.lineTo(x+windowWidth/2,y+wh/2);hole.lineTo(x+windowWidth/2,y-wh/2);hole.closePath();shape.holes.push(hole);
   const local=(lx,ly,lz)=>V(Math.cos(angle)*lx+Math.sin(angle)*lz,ly,-Math.sin(angle)*lx+Math.cos(angle)*lz);
   put(new THREE.PlaneGeometry(1.02,1.5), 'glass',local(x,y,d/2-.11),angle);
   for(const sx of [-1,1])put(new RoundedBoxGeometry(.105,1.7,.16,2,.025),'trim',local(x+sx*.58,y,d/2+.06),angle);
   for(const sy of [-1,1])put(new RoundedBoxGeometry(1.27,.12,.21,2,.025),'trim',local(x,y+sy*.81,d/2+.09),angle);
   put(new RoundedBoxGeometry(.045,1.5,.07,2,.01),'wood',local(x,y,d/2-.045),angle);put(new RoundedBoxGeometry(1.02,.045,.07,2,.01),'wood',local(x,y,d/2-.045),angle);
   if(variant%2===0){for(const sx of [-1,1])put(new RoundedBoxGeometry(.38,1.47,.08,2,.02),'wood',local(x+sx*.83,y,d/2+.02),angle)}
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,curveSegments:4});g.translate(0,0,d/2-.26);g.rotateY(angle);put(g,'wall');
 }
 // Door has a 2.1m clear opening and a framed reveal.
 box(1.07,2.1,.12,'wood',0,1.05,depth/2+.03);for(const x of [-.64,.64])box(.14,2.3,.2,'trim',x,1.15,depth/2+.08);box(1.4,.15,.2,'trim',0,2.36,depth/2+.08);box(.07,.16,.07,'iron',.35,1.05,depth/2+.13);
 // Structural floor bands and corners break up the plaster surface.
 for(let level=0;level<=floors;level++){box(width+.16,.15,depth+.16,'trim',0,level*3+.04,0)}
 for(const x of [-1,1])for(const z of [-1,1])box(.16,height,.16,'trim',x*width/2,height/2,z*depth/2);
 // Gabled tiled roof with modeled eaves and visible ridge.
 const rise=1.45,half=(width+1)/2;for(const side of [-1,1]){const g=new THREE.PlaneGeometry(Math.hypot(half,rise),depth+1,40,12);const p=g.attributes.position;g.rotateX(-Math.PI/2);for(let i=0;i<p.count;i++){const x=p.getX(i);p.setY(i,p.getY(i)+Math.cos(x*22)*.023)}g.rotateZ(-side*Math.atan2(rise,half));g.translate(side*half/2,height+rise/2,0);put(g,'roof')}
 const cap=new THREE.CylinderGeometry(.13,.13,depth+1,12,2, false,0,Math.PI);cap.rotateX(Math.PI/2);put(cap,'roof',V(0,height+rise,0));
 for(const z of [-depth/2,depth/2]){const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(0,rise);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});put(g,'wall',V(0,height,z))}
 box(.65,1.7,.65,'wall',width*.28,height+1,depth*.2);box(.86,.15,.86,'trim',width*.28,height+1.85,depth*.2);
 if(variant%3!==1){
  box(2.7,.18,1.12,'trim',0,3.48,depth/2+.52);
  for(let i=0;i<13;i++)box(.035,.85,.035,'iron',-1.25+i*2.5/12,3.95,depth/2+1.05);box(2.7,.045,.045,'iron',0,4.4,depth/2+1.05);
  for(const x of [-1.25,1.25])box(.035,.85,1.05,'iron',x,3.96,depth/2+.53);
  box(1.6,.25,.35,'roof',0,3.65,depth/2+.75);for(let i=0;i<15;i++){const g=new THREE.IcosahedronGeometry(.13,1);put(g,'green',V((i/14-.5)*1.5,3.83+Math.sin(i)*.04,depth/2+.77))}
 }else{
  const canopy=new THREE.PlaneGeometry(3.3,1.6,12,4);canopy.rotateX(-Math.PI*.4);put(canopy,'wood',V(0,2.8,depth/2+.6));for(const x of [-1.65,1.65])box(.045,2.6,.045,'iron',x,1.3,depth/2+1.3);
 }
 const geometries={};for(const [name,arr] of Object.entries(bins)){if(arr.length)geometries[name]=mergeGeometries(arr.map(g=>g.index?g.toNonIndexed():g))}return {geometries,width,depth,height,radius:Math.hypot(width,depth)/2+.8};
}
