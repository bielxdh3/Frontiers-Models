import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function patch(fn,nu=48,nv=24,reverse=false){
 const p=[],uv=[],indices=[];
 for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const v=fn(i/nu,j/nv);p.push(v.x,v.y,v.z);uv.push(i/nu,j/nv);}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j;indices.push(...(reverse?[a,a+1,a+nv+1,a+1,a+nv+2,a+nv+1]:[a,a+nv+1,a+1,a+1,a+nv+1,a+nv+2]));}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const tube=(pts,r=.012)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.max(24,pts.length*6),r,10,false);
function consolidate(group){
 const buckets=new Map();
 for(const mesh of [...group.children]){if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.userData.keep)continue;mesh.updateMatrix();const clone=mesh.geometry.clone().applyMatrix4(mesh.matrix),g=clone.index?clone.toNonIndexed():clone;
  for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(g);group.remove(mesh);
 }
 for(const [material,geometries]of buckets){const geometry=mergeGeometries(geometries,false),mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);for(const g of geometries)g.dispose();}
}
function hullGeometry(hatch){
 const s=new THREE.Shape();
 // Shared analytic side contour: no triangle-centroid wheel cutouts.
 s.moveTo(-2.22,.27);s.lineTo(-2.26,.62);s.bezierCurveTo(-2.24,.77,-2.08,.85,-1.83,.87);
 s.bezierCurveTo(-1.55,.96,-1.12,.98,-.75,.94);s.bezierCurveTo(-.2,.91,.52,.91,.92,.89);
 s.bezierCurveTo(1.23,.91,1.61,.88,1.88,.78);s.bezierCurveTo(2.17,.74,2.29,.68,2.29,.60);
 s.lineTo(2.24,.29);s.quadraticCurveTo(2.08,.25,1.82,.27);
 s.absarc(1.35,.385,.465,-.249,Math.PI+.249,false);
 s.lineTo(-.885,.27);s.absarc(-1.35,.385,.465,-.249,Math.PI+.249,false);
 s.lineTo(-2.22,.27);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:1.72,steps:12,bevelEnabled:true,bevelThickness:.055,bevelSize:.035,bevelSegments:6,curveSegments:64}),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i),sx=p.getZ(i)-.86;
  const wide=1+.05*Math.exp(-Math.pow((z-1.35)/.55,2))+.055*Math.exp(-Math.pow((z+1.35)/.6,2));
  const nose=1-.115*Math.pow(Math.abs(z)/2.35,6),shoulder=1-.06*Math.max(0,y-.62);
  p.setXYZ(i,-sx*wide*nose*shoulder,y+.035*Math.pow(1-Math.min(1,Math.abs(sx)/.92),2),z*(hatch?.92:1));
 }
 g.clearGroups();g.deleteAttribute('normal');const welded=mergeVertices(g,.0001);welded.computeVertexNormals();return welded;
}
export function createCar(m,model='gt',color='#175467',number=7){
 const hatch=model==='hatch',length=hatch?.92:1,root=new THREE.Group();root.name=hatch?'Brisa RS':'Vela GT';root.userData={type:'car',model,number};
 const paint=m.paint(color),carbon=m.mat('rubber','#353c40',{roughness:.47,metalness:.15}),rimMat=m.mat('metal','#c6b699',{metalness:.92,roughness:.26}),brakeMat=m.mat('metal','#cb4e26',{metalness:.45,roughness:.45});
 const glass=m.glass.clone();glass.color.set('#527480');glass.roughness=.065;glass.metalness=.18;glass.opacity=.94;glass.envMapIntensity=1.65;glass.side=THREE.DoubleSide;
 const mesh=(g,mat,parent=root)=>{const o=new THREE.Mesh(g,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const rounded=(size,mat,pos,rad=.03,parent=root)=>{const o=mesh(new RoundedBoxGeometry(...size,4,rad),mat,parent);o.position.copy(pos);return o;};
 const hull=hullGeometry(hatch),hullMesh=mesh(hull,paint);hullMesh.updateMatrixWorld(true);
 const surfaceX=(side,y,z)=>{const hit=new THREE.Raycaster(V(side*2,y,z),V(-side,0,0)).intersectObject(hullMesh,false)[0];return hit?hit.point.x+side*.012:side*.94;};
 // Cabin surfaces share their exact roof/windshield/beltline coordinates.
 const rear=hatch?-1.62:-1.35,roofRear=hatch?-1.14:-.61,roofFront=hatch?.23:.10,front=.89;
 const height=hatch?1.49:1.29,roofWidth=hatch?.615:.59;
 const topAt=z=>z<roofRear?.94+(height-.94)*(z-rear)/(roofRear-rear):z>roofFront?.94+(height-.94)*(front-z)/(front-roofFront):height+.018*Math.sin((z-roofRear)/(roofFront-roofRear)*Math.PI);
 const widthAt=z=>z<roofRear?.76+(roofWidth-.76)*(z-rear)/(roofRear-rear):z>roofFront?.74+(roofWidth-.74)*(front-z)/(front-roofFront):roofWidth;
 for(const [za,zb,material]of [[rear,roofRear,glass],[roofRear,roofFront,paint],[roofFront,front,glass]])mesh(patch((u,v)=>{const z=za+(zb-za)*u,x=(v*2-1)*widthAt(z);return V(x,topAt(z)+.025*(1-(v*2-1)**2),z*length);},48,32),material);
 for(const side of[-1,1]){
  mesh(patch((u,v)=>{const z=rear+(front-rear)*u,lowX=.745+.018*Math.sin(u*Math.PI),x=THREE.MathUtils.lerp(lowX,widthAt(z),v);return V(side*(x+.007*Math.sin(v*Math.PI)),.94+(topAt(z)-.94)*v,z*length);},96,18,side>0),glass);
  mesh(tube([V(side*.74,.94,front*length),V(side*(roofWidth+.012),height,roofFront*length)],.034),paint);
  mesh(tube([V(side*.76,.94,rear*length),V(side*(roofWidth+.012),height,roofRear*length)],hatch?.055:.045),paint);
  const rail=[];for(let i=0;i<=12;i++){const z=roofRear+(roofFront-roofRear)*i/12;rail.push(V(side*(roofWidth+.005),topAt(z)+.005,z*length));}mesh(tube(rail,.021),paint);
  mesh(tube([V(side*.758,.94,rear*length),V(side*.771,.94,-.3*length),V(side*.747,.94,front*length)],.012),carbon);
  const bz=-.40;mesh(tube([V(side*.767,.94,bz*length),V(side*(widthAt(bz)+.008),topAt(bz),bz*length)],.018),carbon);
  mesh(tube([V(side*.90,.87,.7*length),V(side*.914,.60,.62*length),V(side*.905,.33,.55*length),V(side*.90,.31,-.75*length),V(side*.915,.57,-.89*length),V(side*.90,.89,-.86*length)],.0045),carbon);
  rounded([.025,.025,.16],m.chrome,V(side*.932,.80,-.66*length),.009);
  const mirror=mesh(new THREE.SphereGeometry(1,28,16),paint);mirror.scale.set(.145,.065,.13);mirror.position.set(side*1.04,1.025,.64*length);
  mesh(tube([V(side*.765,.98,.64*length),V(side*.99,1.02,.64*length)],.018),carbon);
  const face=mesh(new THREE.SphereGeometry(1,20,12),m.chrome);face.scale.set(.12,.045,.008);face.position.set(side*1.045,1.027,.52*length);
  rounded([.085,.095,2.17*length],carbon,V(side*.894,.278,-.05*length),.035);
 }
 rounded([1.30,.20,1.45*length],m.dark,V(0,.76,-.23*length),.09);
 for(const side of[-1,1]){const seat=mesh(new THREE.SphereGeometry(1,20,16),m.dark);seat.scale.set(.22,.30,.16);seat.position.set(side*.32,1.05,-.38*length);}
 rounded([1.76,.055,.28],carbon,V(0,.245,2.17*length),.025);
 rounded([1.22,.205,.085],carbon,V(0,.455,2.335*length),.075);
 for(let i=0;i<19;i++)rounded([.018,.14,.025],m.metal,V((i-9)*.057,.45,2.386*length),.006);
 const white=new THREE.MeshStandardMaterial({color:'#fff3d4',emissive:'#fff2d8',emissiveIntensity:1.7,roughness:.2});
 const red=new THREE.MeshStandardMaterial({color:'#710e07',emissive:'#ff2107',emissiveIntensity:1.5,roughness:.2});
 for(const side of[-1,1]){
  const optic=rounded([.38,.10,.08],carbon,V(side*.61,.645,2.30*length),.042);optic.rotation.y=side*.12;
  const led=rounded([.31,.018,.018],white,V(side*.61,.674,2.345*length),.008);led.rotation.y=side*.12;
  for(const x of[.53,.65]){const lens=mesh(new THREE.SphereGeometry(.024,16,12),m.chrome);lens.position.set(side*x,.631,2.35*length);}
  rounded([.20,.16,.055],carbon,V(side*.74,.445,2.30*length),.025);
  rounded([.72,.105,.055],carbon,V(side*.43,.736,-2.22*length),.028);
  rounded([.65,.018,.016],red,V(side*.43,.755,-2.253*length),.008);
  const exhaust=mesh(new THREE.CylinderGeometry(.065,.07,.14,32,1,true),m.chrome);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.65,.365,-2.25*length);
  const mouth=mesh(new THREE.CircleGeometry(.058,32),carbon);mouth.rotation.y=Math.PI;mouth.position.set(side*.65,.365,-2.325*length);
 }
 rounded([1.62,.18,.18],carbon,V(0,.33,-2.18*length),.05);
 for(const x of[-.55,-.28,0,.28,.55])rounded([.025,.145,.32],carbon,V(x,.29,-2.20*length),.01);
 if(!hatch){for(const side of[-1,1]){const stand=rounded([.035,.22,.11],carbon,V(side*.61,1.01,-1.89),.012);stand.rotation.x=-.12;}
  mesh(patch((u,v)=>V((u-.5)*1.91,1.13+.035*Math.sin(v*Math.PI),-1.94+(v-.5)*.27),64,16),carbon).material.side=THREE.DoubleSide;
  for(const side of[-1,1])rounded([.025,.13,.34],carbon,V(side*.955,1.14,-1.94),.015);
 }else rounded([1.32,.05,.25],paint,V(0,1.50,roofRear*length),.024);
 const stripe=m.mat('paint','#e5d9ba',{roughness:.9,metalness:.15});
 const topSamples=new Map(),hp=hull.attributes.position;for(let i=0;i<hp.count;i++){const z=hp.getZ(i);if(Math.abs(hp.getX(i))<.07&&z>.85*length){const k=Math.round(z*10000);topSamples.set(k,Math.max(topSamples.get(k)||0,hp.getY(i)));}}
 const samples=[...topSamples].sort((a,b)=>a[0]-b[0]);const hoodY=z=>{for(let i=1;i<samples.length;i++)if(samples[i][0]>=z*10000){const a=samples[i-1],b=samples[i];return THREE.MathUtils.lerp(a[1],b[1],(z*10000-a[0])/(b[0]-a[0]));}return samples.at(-1)?.[1]||.8;};
 for(const side of[-1,1])mesh(patch((u,v)=>{const z=(.94+u*1.19)*length,x=side*(.09+v*.07);return V(x,hoodY(z)-.004,z);},64,4),stripe);
 const wheels=[];
 for(const side of[-1,1])for(const axle of[-1.35,1.35]){
  const steering=new THREE.Group();steering.position.set(side*.895,.385,axle*length);root.add(steering);const spin=new THREE.Group();steering.add(spin);wheels.push({steering,spin,front:axle>0,side,axle:axle*length});
  const tyre=mesh(new THREE.TorusGeometry(.293,.092,24,72),m.rubber,spin);tyre.rotation.y=Math.PI/2;tyre.scale.z=1.38;
  for(const direction of[-1,1]){const ring=mesh(new THREE.TorusGeometry(.257,.015,12,72),rimMat,spin);ring.rotation.y=Math.PI/2;ring.position.x=direction*.105;}
  const disc=mesh(new THREE.CylinderGeometry(.218,.218,.025,64),m.metal,spin);disc.rotation.z=Math.PI/2;disc.position.x=side*.065;
  const hub=mesh(new THREE.CylinderGeometry(.047,.047,.235,32),rimMat,spin);hub.rotation.z=Math.PI/2;
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const spoke=rounded([.034,.22,.022],rimMat,V(side*.112,Math.cos(a)*.135,Math.sin(a)*.135),.009,spin);spoke.rotation.x=a;}
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2;const hole=mesh(new THREE.CircleGeometry(.006,8),carbon,spin);hole.rotation.y=side*Math.PI/2;hole.position.set(side*.08,Math.cos(a)*.19,Math.sin(a)*.19);}
  rounded([.08,.14,.07],brakeMat,V(side*.07,.025,-.18),.023,steering);consolidate(spin);
 }
 const label=document.createElement('canvas');label.width=label.height=1024;const ctx=label.getContext('2d');ctx.fillStyle='#e9e1ce';ctx.beginPath();ctx.roundRect(65,125,880,720,35);ctx.fill();ctx.fillStyle='#1c343e';ctx.font='bold 550px Arial';ctx.textAlign='center';ctx.fillText(String(number).padStart(2,'0'),512,665);ctx.font='bold 58px Arial';ctx.fillText('SOLMARE',512,782);const map=new THREE.CanvasTexture(label);map.colorSpace=THREE.SRGBColorSpace;const decal=new THREE.MeshStandardMaterial({map,transparent:true,roughness:.5});
 for(const side of[-1,1]){const plate=mesh(new THREE.PlaneGeometry(.56,.42,6,4),decal);plate.rotation.y=side*Math.PI/2;plate.position.set(surfaceX(side,.64,-.06)+side*.01,.64,-.06);}
 consolidate(root);
 const sh=document.createElement('canvas');sh.width=sh.height=1024;const sc=sh.getContext('2d'),gradient=sc.createRadialGradient(512,512,70,512,512,500);gradient.addColorStop(0,'rgba(2,6,10,.68)');gradient.addColorStop(.6,'rgba(2,6,10,.40)');gradient.addColorStop(1,'rgba(2,6,10,0)');sc.fillStyle=gradient;sc.fillRect(0,0,1024,1024);
 const shadow=mesh(new THREE.PlaneGeometry(2.65,5.25,4,4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sh),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;shadow.castShadow=false;
 let triangles=0;const mats=new Set();root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const mat of(Array.isArray(o.material)?o.material:[o.material]))mats.add(mat.uuid);}});
 Object.assign(root.userData,{triangles,materials:mats.size,paint,wheels,glass,setNumber(value){root.userData.number=value;ctx.clearRect(0,0,1024,1024);ctx.fillStyle='#e9e1ce';ctx.beginPath();ctx.roundRect(65,125,880,720,35);ctx.fill();ctx.fillStyle='#1c343e';ctx.font='bold 550px Arial';ctx.textAlign='center';ctx.fillText(String(value).padStart(2,'0'),512,665);ctx.font='bold 58px Arial';ctx.fillText('SOLMARE',512,782);map.needsUpdate=true;},update(v,dt){for(const w of wheels){w.steering.rotation.y=w.front?v.steer*.37:0;w.spin.rotation.x=v.distance/.385;}red.emissiveIntensity=v.brake>.1?4.5:1.35;}});return root;
}

