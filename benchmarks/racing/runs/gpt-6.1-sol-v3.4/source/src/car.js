import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {clamp,mix} from './track.js';
const palettes=['#de653d','#e4c564','#57a8ad','#e9e4d6','#4e73aa','#b35269'];
export {palettes};
function sweep(sections,around=96,length=180,arches=false){
 const curves=Array.from({length:3},(_,c)=>new THREE.SplineCurve(sections.map(s=>new THREE.Vector2(s[0],s[c+1]))));
 function section(z){let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;const a=sections[i],b=sections[i+1],t=clamp((z-a[0])/(b[0]-a[0]),0,1),e=t*t*(3-2*t);return [mix(a[1],b[1],e),mix(a[2],b[2],e),mix(a[3],b[3],e)]}
 const pos=[],uv=[],idx=[];const start=sections[0][0],end=sections.at(-1)[0];
 for(let j=0;j<=length;j++){const z=mix(start,end,j/length),[w,base,height]=section(z);for(let i=0;i<=around;i++){const a=i/around*Math.PI*2,sa=Math.sin(a),ca=Math.cos(a),cy=(ca+1)*.5;let x=(arches?Math.sign(sa)*Math.pow(Math.abs(sa),.36):sa)*w,y=base+(arches?(.5+.5*Math.sign(ca)*Math.pow(Math.abs(ca),.5)):cy)*height;pos.push(x,y,z);uv.push(i/around,j/length)}}
 for(let j=0;j<length;j++)for(let i=0;i<around;i++){const a=j*(around+1)+i,b=a+around+1;const x=pos[a*3],y=pos[a*3+1],z=pos[a*3+2];if(arches&&Math.abs(x)>.67&&y<.78&&Math.min(Math.abs(z-1.42),Math.abs(z+1.42))<.44)continue;idx.push(a,b,a+1,a+1,b,b+1)}
 for(const endcap of [0,length]){const [w,base,height]=section(mix(start,end,endcap/length));const mid=pos.length/3;pos.push(0,base+height*.5,mix(start,end,endcap/length));uv.push(.5,.5);for(let i=0;i<around;i++){const a=endcap*(around+1)+i;if(endcap===0)idx.push(mid,a,a+1);else idx.push(mid,a+1,a)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function makeCar(world,model=0,color=palettes[0],number=7){
 const root=new THREE.Group();root.name=model?'NOVA R / Sport hatch':'AUREL GT / Grand tourer';root.userData.isCar=true;root.userData.model=model;const body=new THREE.Group();root.add(body);
 const paint=new THREE.MeshPhysicalMaterial({color,metalness:.58,roughness:.3,clearcoat:1,clearcoatRoughness:.14,map:world.materials.paint.map,normalMap:world.materials.paint.normalMap,normalScale:new THREE.Vector2(.025,.025),roughnessMap:world.materials.paint.roughnessMap,envMapIntensity:1.15});
 const carbon=world.mat('rubber','#32383a',{roughness:.78}),chrome=world.mat('metal','#b6c8cc',{metalness:.98,roughness:.19}),rim=world.mat('metal','#b1b8b8',{metalness:.88,roughness:.28}),tire=world.mat('rubber','#7c7d7a',{roughness:.96});
 const glass=new THREE.MeshPhysicalMaterial({color:'#2d5260',metalness:.48,roughness:.12,transparent:true,opacity:.94,envMapIntensity:1.4,clearcoat:1,side:THREE.DoubleSide});
 const light=new THREE.MeshStandardMaterial({color:'#d3f0ff',emissive:'#b3d7f2',emissiveIntensity:2,roughness:.15});const brake=new THREE.MeshStandardMaterial({color:'#791b16',emissive:'#f02c14',emissiveIntensity:.5});
 function mesh(g,m,parent=body,x=0,y=0,z=0){const obj=new THREE.Mesh(g,m);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj}
 function round(w,h,d,m,x,y,z,r=.06,parent=body){return mesh(new RoundedBoxGeometry(w,h,d,3,r),m,parent,x,y,z)}
 const sections=model?[
 [-2.12,.18,.38,.28],[-2.03,.89,.3,.62],[-1.6,.98,.29,.72],[-.7,.93,.3,.69],[.5,.9,.3,.63],[1.42,.98,.3,.65],[1.96,.91,.34,.43],[2.13,.2,.42,.13]
 ]:[[-2.32,.76,.34,.37],[-2.19,.92,.28,.61],[-1.45,1,.28,.74],[-.5,.91,.28,.65],[.65,.91,.28,.58],[1.42,.98,.29,.58],[2.13,.87,.32,.39],[2.32,.75,.35,.29]];
 mesh(sweep(sections,96,180,true),paint);
 // Continuous glazed canopy, with an independently curved painted roof.
 const cabinSections=model?[[-1.9,.64,.91,.03],[-1.47,.74,.92,.58],[-.8,.74,.91,.7],[.45,.66,.88,.68],[1.02,.56,.86,.03]]:[[-1.48,.66,.92,.02],[-.85,.69,.91,.52],[.25,.66,.88,.55],[1.04,.55,.84,.02]];
 mesh(sweep(cabinSections,64,90),glass);
 const roofSections=model?[[-1.45,.64,1.44,.04],[-1.22,.68,1.5,.08],[-.5,.68,1.54,.07],[.26,.59,1.48,.05]]:[[-.85,.58,1.37,.035],[-.6,.61,1.42,.05],[.17,.59,1.39,.04],[.3,.54,1.34,.025]];
 mesh(sweep(roofSections,48,48),paint);
 // Pillars are shaped tubes following the canopy, rather than a solid black cabin.
 const tube=(pts,r,mat=paint,parent=body)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),20,r,8,false),mat,parent);
 for(const side of [-1,1]){
  tube([[side*.64,.89,1.04],[side*.65,1.16,.67],[side*.59,model?1.51:1.4,.24]],.035);
  tube([[side*.7,.94,model?-1.86:-1.48],[side*.72,1.2,model?-1.65:-1.16],[side*.63,model?1.51:1.39,model?-1.3:-.8]],.045);
  tube([[side*.71,.91,-.4],[side*.7,1.17,-.4],[side*.63,model?1.58:1.43,-.4]],.028,carbon);
  tube([[side*.9,.42,-1],[side*.94,.4,0],[side*.9,.42,1.08]],.045,carbon);
  round(.1,.045,.23,chrome,side*.925,.84,-.35,.018);
  const mirror=mesh(new THREE.SphereGeometry(1,20,12),paint,body,side*1.07,1,.77);mirror.scale.set(.16,.08,.21);
  round(.025,.11,.22,glass,side*1.19,1,.76,.015);
  // Narrow DRLs and layered tail light lens.
  const head=round(.51,.05,.09,light,side*.58,.65,model?2.02:2.25,.025);head.rotation.y=side*-.18;
  round(.58,.055,.075,brake,side*.57,.81,model?-2.055:-2.22,.025);
  round(.32,.10,.15,carbon,side*.56,.43,2.16,.035);
  round(.12,.11,.23,chrome,side*.61,.34,model?-2.12:-2.25,.035);
  for(const z of [-1.42,1.42]){
   const arch=mesh(new THREE.TorusGeometry(.445,.034,8,42,Math.PI),paint,body,side*.92,.42,z);arch.rotation.y=Math.PI/2;
  }
 }
 round(1.5,.17,.16,carbon,0,.36,model?2.13:2.33,.04);round(1.55,.22,.14,carbon,0,.39,model?-2.14:-2.34,.05);
 for(let x=-.65;x<=.65;x+=.26)round(.025,.17,.4,carbon,x,.29,-2.08,.01);
 // Rear wing: bowed airfoil, end plates and two supports.
 const wing=mesh(sweep([[-.18,.87,0,.045],[0,.92,.015,.055],[.18,.86,.01,.025]],40,20),carbon,body,0,model?1.47:1.11,model?-1.95:-1.99);
 for(const side of [-1,1]){round(.035,.27,.35,paint,side*.89,model?1.54:1.17,model?-1.94:-1.99,.015);round(.035,.25,.1,chrome,side*.56,model?1.32:.96,model?-1.9:-1.98,.01)}
 // Visible interior silhouettes underneath reflective, partially transparent glazing.
 for(const side of [-1,1]){const seat=mesh(new THREE.SphereGeometry(1,16,12),carbon,body,side*.31,.99,-.25);seat.scale.set(.25,.35,.23);round(.39,.15,.5,carbon,side*.3,.73,-.1,.07)}
 const wheelGeo=new THREE.TorusGeometry(.306,.099,20,64),wheelRim=new THREE.TorusGeometry(.244,.025,12,48),diskGeo=new THREE.CylinderGeometry(.218,.218,.035,48);diskGeo.rotateZ(Math.PI/2);
 const wheels=[];
 for(const x of [-.95,.95])for(const z of [-1.42,1.42]){
  const steer=new THREE.Group();steer.position.set(x,.408,z);root.add(steer);const spin=new THREE.Group();steer.add(spin);
  const tyre=mesh(wheelGeo,tire,spin);tyre.rotation.y=Math.PI/2;
  const sideMat=world.mat('rubber','#9b9c98',{roughness:.86});const sidewall=mesh(new THREE.TorusGeometry(.31,.056,10,64),sideMat,spin);sidewall.rotation.y=Math.PI/2;sidewall.position.x=Math.sign(x)*.06;
  const disc=mesh(diskGeo,chrome,steer,Math.sign(x)*.03);
  const ring=mesh(wheelRim,rim,spin,Math.sign(x)*.093);ring.rotation.y=Math.PI/2;
  const hub=mesh(new THREE.CylinderGeometry(.068,.068,.08,24),chrome,spin,Math.sign(x)*.1);hub.rotation.z=Math.PI/2;
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const spoke=round(.055,.034,.21,rim,Math.sign(x)*.107,Math.sin(a)*.13,Math.cos(a)*.13,.011,spin);spoke.rotation.x=-a}
  round(.085,.13,.11,world.mat('metal','#da573b'),Math.sign(x)*.045,.045,.16,.03,steer);
  wheels.push({steer,spin,front:z>0});
 }
 // Original number and crest drawn into a local texture; no real brands.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,1024);ctx.fillStyle='#f2eadd';ctx.beginPath();ctx.arc(512,512,363,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#1a3035';ctx.lineWidth=12;ctx.beginPath();ctx.arc(512,512,337,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#1a3035';ctx.font='italic 700 460px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),500,530);const numberTex=new THREE.CanvasTexture(canvas);numberTex.colorSpace=THREE.SRGBColorSpace;
 const decal=new THREE.MeshStandardMaterial({map:numberTex,transparent:true,roughness:.4,polygonOffset:true,polygonOffsetFactor:-2});
 for(const side of [-1,1]){const d=mesh(new THREE.PlaneGeometry(.67,.67,3,3),decal,body,side*.918,.65,-.13);d.rotation.y=side*Math.PI/2;d.castShadow=false}
 const plateCanvas=document.createElement('canvas');plateCanvas.width=1024;plateCanvas.height=1024;const pc=plateCanvas.getContext('2d');pc.fillStyle='#e0e0d0';pc.fillRect(0,0,1024,1024);pc.fillStyle='#1d3039';pc.font='bold 120px Arial';pc.textAlign='center';pc.fillText('DORADA',512,555);const plateTex=new THREE.CanvasTexture(plateCanvas);plateTex.colorSpace=THREE.SRGBColorSpace;const plate=mesh(new THREE.PlaneGeometry(.48,.13),new THREE.MeshStandardMaterial({map:plateTex,roughness:.5}),body,0,.58,model?-2.14:-2.335);plate.rotation.y=Math.PI;
 root.userData.materials={paint,brake};root.userData.wheels=wheels;root.userData.body=body;
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=1024;const cc=contactCanvas.getContext('2d');cc.scale(1,.65);const gradient=cc.createRadialGradient(512,780,80,512,780,510);gradient.addColorStop(0,'#000000c0');gradient.addColorStop(.6,'#00000075');gradient.addColorStop(1,'#00000000');cc.fillStyle=gradient;cc.fillRect(0,0,1024,1600);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.2,5.3,4,6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,opacity:.5,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;root.add(shadow);
 root.userData.update=(c,time)=>{root.position.set(c.x,c.y+.015,c.z);root.rotation.set(-c.pitch,c.yaw,-c.roll,'YXZ');body.position.y=Math.sin(time*8)*Math.min(c.v*.0008,.012);for(const w of wheels){w.steer.rotation.y=w.front?c.steer*.3:0;w.spin.rotation.x=time*-c.v/.408}brake.emissiveIntensity=c.brake>.1?4:.5};
 const mergeGroup=group=>{const byMat=new Map();for(const m of [...group.children]){if(!m.isMesh)continue;m.updateMatrix();const g=m.geometry.clone().applyMatrix4(m.matrix);const key=m.material.uuid;if(!byMat.has(key))byMat.set(key,{material:m.material,geos:[]});byMat.get(key).geos.push(g.index?g.toNonIndexed():g);group.remove(m)}for(const {material,geos} of byMat.values()){const g=mergeGeometries(geos);const m=new THREE.Mesh(g,material);m.castShadow=m.receiveShadow=true;group.add(m)}};
 mergeGroup(body);for(const w of wheels){mergeGroup(w.spin);mergeGroup(w.steer)}
 return root;
}
