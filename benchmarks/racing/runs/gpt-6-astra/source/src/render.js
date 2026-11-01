import * as THREE from 'three';
import { CARS, clamp, lerp, seedRandom, angleDiff } from './config.js';
import { courses } from './course.js';

const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
const mat=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.7,...options});
const boxGeo=new THREE.BoxGeometry(1,1,1);
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,10);
function box(parent,material,x,y,z,sx,sy,sz){const m=new THREE.Mesh(boxGeo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(parent,material,x,y,z,r,h){const m=new THREE.Mesh(cylinderGeo,material);m.position.set(x,y,z);m.scale.set(r,h,r);m.castShadow=true;parent.add(m);return m;}
function hull(sections){
  const verts=[],indices=[];
  for(const [z,w,b,t] of sections)for(const [x,y] of [[-.84*w,b],[-w,b+.13],[-w,t-.12],[-.8*w,t],[.8*w,t],[w,t-.12],[w,b+.13],[.84*w,b]])verts.push(x,y,z);
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=(j+1)*8+i,d=(j+1)*8+(i+1)%8;indices.push(a,c,b,b,c,d);}
  for(let i=1;i<7;i++){indices.push(0,i,i+1);const end=(sections.length-1)*8;indices.push(end,end+i+1,end+i);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function makeCar(id,color) {
  const spec=CARS.find(c=>c.id===id),group=new THREE.Group(),bodyMat=mat(color,{roughness:.27,metalness:.38});
  const dark=mat('#142e37',{roughness:.33,metalness:.4}),glass=mat('#447882',{roughness:.12,metalness:.6}),chrome=mat('#c2d4ce',{metalness:.7,roughness:.22}),rubber=mat('#17262b'),lamp=mat('#fff3bc',{emissive:'#fff4c2',emissiveIntensity:1.3});
  const tail=mat('#f84732',{emissive:'#ff3322',emissiveIntensity:.9}),decal=mat('#fff2d6',{roughness:.45});
  const shape=spec.shape,half=shape===2?2.6:shape===1?2.45:2.1;
  const body=new THREE.Mesh(hull([[-half,.88,.34,.85],[-half+.55,1.08,.3,1.02],[.2,1.07,.3,1.03],[half-.5,1,.36,.79],[half,.82,.46,.64]]),bodyMat);body.castShadow=true;body.receiveShadow=true;group.add(body);
  const cabin=new THREE.Mesh(hull([[-1.25,.78,.93,shape===2?1.32:1.48],[-.65,.73,.95,1.66],[.25,.7,.93,1.59],[.95,.75,.88,1.02]]),glass);cabin.castShadow=true;group.add(cabin);
  if(shape===0){box(group,dark,0,1.48,-.6,1.45,.16,.75);box(group,bodyMat,-.74,1.25,-.86,.12,.6,.3);box(group,bodyMat,.74,1.25,-.86,.12,.6,.3);}
  else {box(group,bodyMat,0,1.64,-.38,1.42,.12,1.22);box(group,bodyMat,0,1.35,-1.2,1.55,.13,.2);}
  box(group,dark,0,.47,half-.04,1.5,.17,.12);box(group,dark,0,.36,-half,1.85,.22,.17);
  box(group,decal,0,.82,1.3,shape===2?.25:.18,.025,1.25);
  box(group,decal,0,1.027,-1.65,.19,.022,.65);
  const lights=[];
  for(const s of [-1,1]) {
    lights.push(box(group,lamp,s*.65,.71,half-.02,.45,.13,.08));
    box(group,tail,s*.64,.77,-half-.02,.52,.12,.08);
    box(group,dark,s*1.1,1.13,.33,.3,.14,.23);
    box(group,dark,s*1.06,.38,-.05,.07,.16,2.55);
    box(group,chrome,s*.6,.37,-half-.13,.24,.16,.2);
  }
  if(shape===2){box(group,bodyMat,0,1.25,-2.15,2.2,.1,.4);for(const s of [-1,1])box(group,dark,s*.7,1.05,-2.1,.08,.4,.1);}
  const wheels=[];
  for(const x of [-1.02,1.02])for(const z of [-half*.64,half*.65]) {
    const holder=new THREE.Group();holder.position.set(x,.47,z);group.add(holder);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.44,.44,.34,16),rubber);tire.rotation.z=Math.PI/2;holder.add(tire);tire.castShadow=true;
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.355,10),chrome);hub.rotation.z=Math.PI/2;holder.add(hub);
    for(let k=0;k<5;k++){const spoke=box(holder,dark,Math.sign(x)*.19,0,0,.015,.055,.52);spoke.rotation.x=k*Math.PI/5;}
    wheels.push({holder,front:z>0});
  }
  const scars=new THREE.Group();group.add(scars);
  const scratch=mat('#394f51');
  for(let i=0;i<7;i++){const s=box(scars,scratch,(i-3)*.17,.847,1.4+(i%2)*.16,.028,.018,.55);s.rotation.y=.6;}
  for(const sign of [-1,1])for(let i=0;i<3;i++){const s=box(scars,scratch,sign*1.083,.62+i*.07,-.3,.012,.025,1.05);s.rotation.x=-.13;}
  const flameMat=new THREE.MeshBasicMaterial({color:'#65e8ff',transparent:true,opacity:.85,depthWrite:false});
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.27,1.8,8),flameMat);flame.rotation.x=-Math.PI/2;flame.position.set(0,.5,-half-.7);group.add(flame);
  const shadowMap=canvasTexture((ctx,w,h)=>{const gradient=ctx.createRadialGradient(w/2,h/2,4,w/2,h/2,w/2);gradient.addColorStop(0,'rgba(12,28,32,.8)');gradient.addColorStop(.45,'rgba(12,28,32,.55)');gradient.addColorStop(1,'rgba(12,28,32,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);},64,64);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.8,6.8),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.4,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;group.add(shadow);
  group.userData={body,bodyMat,baseColor:new THREE.Color(color),wheels,scars,flame,lights,tail,cabin};return group;
}
function strip(track,inner,outer,yOffset,material){
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=960;i++){const a=track.nodes[i];for(const off of [inner,outer]){positions.push(a.x+a.tz*off,a.y+yOffset,a.z-a.tx*off);uv.push(off/8,a.s/8);}if(i<960){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;return mesh;
}
function canvasTexture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function signTexture(text,small='',color='#173d44') {return canvasTexture((ctx,w,h)=>{ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.strokeStyle='#fff2d6';ctx.lineWidth=6;ctx.strokeRect(13,13,w-26,h-26);ctx.fillStyle='#fff2d6';ctx.textAlign='center';ctx.font='bold 56px Arial';ctx.fillText(text,w/2,85);ctx.font='24px Arial';ctx.fillText(small,w/2,129);},512,160);}
export class World {
  constructor(canvas,settings) {
    this.canvas=canvas;this.settings=settings;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#98d6de');this.scene.fog=new THREE.FogExp2('#acd9d8',.00115);
    this.camera=new THREE.PerspectiveCamera(54,1,.2,3500);this.camera.position.set(-240,20,-200);
    this.hemi=new THREE.HemisphereLight('#d6f6ff','#baa784',2.3);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight('#fff2d2',3.5);this.sun.position.set(-180,240,-100);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-65;this.sun.shadow.camera.right=65;this.sun.shadow.camera.top=65;this.sun.shadow.camera.bottom=-65;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=500;this.sun.shadow.bias=-.001;this.sun.shadow.normalBias=.08;this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.headlight=new THREE.SpotLight('#effdff',0,100,.65,.6,1);this.scene.add(this.headlight,this.headlight.target);
    this.environ=new THREE.Group();this.scene.add(this.environ);this.carGroup=new THREE.Group();this.scene.add(this.carGroup);this.carMeshes=[];this.detail=new THREE.Group();this.scene.add(this.detail);
    this.rainGeo=new THREE.BufferGeometry();const rain=new Float32Array(1200*6);this.rainGeo.setAttribute('position',new THREE.BufferAttribute(rain,3));this.rain=new THREE.LineSegments(this.rainGeo,new THREE.LineBasicMaterial({color:'#dbf3fa',transparent:true,opacity:.36,depthWrite:false}));this.scene.add(this.rain);
    const mist=canvasTexture((ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(.4,'rgba(255,255,255,.3)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);},64,64);
    this.particleGeo=new THREE.BufferGeometry();this.particleGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(180*3),3));this.particles=new THREE.Points(this.particleGeo,new THREE.PointsMaterial({color:'#e6f1e7',map:mist,size:.65,transparent:true,opacity:.4,depthWrite:false,alphaTest:.005}));this.scene.add(this.particles);
    this.scene.add(new THREE.AmbientLight('#fff7eb',.25));
    this.quality(settings);this.loadCourse('trial');this.setCars([{model:'brisa',color:CARS[0].color}]);this.lastView='';this.resize();
  }
  quality(settings) {
    this.settings=settings;const q={low:0,medium:1,high:2}[settings.quality];this.q=q;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)*settings.scale*(q===0?.7:q===1?.9:1));
    this.renderer.shadowMap.enabled=q>0;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.sun.castShadow=q>0;this.detail.visible=q>0;this.resize();
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  disposeGroup(g){const geos=new Set(),mats=new Set(),textures=new Set();g.traverse(o=>{if(o.geometry&&o.geometry!==boxGeo&&o.geometry!==cylinderGeo)geos.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){mats.add(m);if(m.map)textures.add(m.map);}});g.clear();geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());}
  loadCourse(id) {
    if(this.course?.id===id)return;this.disposeGroup(this.environ);this.disposeGroup(this.detail);this.course=courses[id];const track=this.course,random=seedRandom(id==='trial'?55:id==='race'?72:83);
    const roadTexture=canvasTexture((ctx,w,h)=>{ctx.fillStyle='#54656a';ctx.fillRect(0,0,w,h);for(let i=0;i<18000;i++){ctx.fillStyle=`rgba(210,218,215,${random()*.12})`;ctx.fillRect(random()*w,random()*h,1+random()*2,1+random()*2);}});roadTexture.wrapS=roadTexture.wrapT=THREE.RepeatWrapping;roadTexture.anisotropy=4;
    this.roadMat=mat('#a6b5b6',{map:roadTexture,roughness:.95,metalness:.03});
    const grass=mat('#72966a'),sand=mat('#dfbf8d'),edge=mat('#f5e6c9'),coral=mat('#e97856'),metal=mat('#a9c3bd',{metalness:.35}),white=mat('#faf2d9'),trunk=mat('#9a7952'),leaves=mat('#468e6c'),roof=mat('#c67c61'),window=mat('#365d68',{metalness:.2});
    const islandShape=new THREE.Shape();track.nodes.forEach((p,i)=>{if(i===0)islandShape.moveTo(p.x,-p.z);else islandShape.lineTo(p.x,-p.z);});
    const island=new THREE.Mesh(new THREE.ShapeGeometry(islandShape),grass);island.rotation.x=-Math.PI/2;island.position.y=-2;island.receiveShadow=true;this.environ.add(island);
    this.environ.add(strip(track,-track.width/2-36,track.width/2+36,-3.8,sand));
    for(const side of [-1,1]){
      const verts=[],idx=[];for(let i=0;i<=960;i++){const p=track.nodes[i],off=side*(track.width/2+36);verts.push(p.x+p.tz*off,p.y-3.8,p.z-p.tx*off,p.x+p.tz*(off+side*4),-8,p.z-p.tx*(off+side*4));if(i<960){const j=i*2;if(side>0)idx.push(j,j+1,j+2,j+1,j+3,j+2);else idx.push(j,j+2,j+1,j+1,j+2,j+3);}}
      const cliffGeo=new THREE.BufferGeometry();cliffGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));cliffGeo.setIndex(idx);cliffGeo.computeVertexNormals();const cliff=new THREE.Mesh(cliffGeo,mat('#bfac89',{flatShading:true,side:THREE.DoubleSide}));this.environ.add(cliff);
    }
    this.environ.add(strip(track,-track.width/2-27,track.width/2+27,-.5,grass));
    this.environ.add(strip(track,-track.width/2-3,track.width/2+3,-.03,sand));
    this.environ.add(strip(track,-track.width/2,track.width/2,.02,this.roadMat));
    for(const sign of [-1,1])this.environ.add(strip(track,sign*track.width/2-.13,sign*track.width/2+.13,.045,edge));
    // Original ocean shader: bounded analytic waves, depth colour and sun glints.
    this.oceanMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},light:{value:1}},vertexShader:`varying vec3 p;uniform float time;void main(){p=position;vec3 v=position;v.z+=sin(v.x*.021+time*.6)*.24+sin(v.y*.017+time*.45)*.25;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}`,fragmentShader:`varying vec3 p;uniform float time;uniform float light;void main(){float waves=sin(p.x*.042+p.y*.02+time*.9)*sin(p.y*.08-time*.7);float shimmer=pow(max(0.,waves),18.);vec3 c=mix(vec3(.035,.32,.40),vec3(.15,.65,.65),.5+.22*sin(p.x*.002+p.y*.003));c+=shimmer*.15;gl_FragColor=vec4(c*(.34+light*.8),1.);}`});
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(6500,6500,80,80),this.oceanMat);ocean.rotation.x=-Math.PI/2;ocean.position.y=-8;this.environ.add(ocean);
    const rockGeo=new THREE.IcosahedronGeometry(1,1);
    for(let i=0;i<20;i++){const hill=new THREE.Mesh(rockGeo,mat(i%2?'#7e9b80':'#acaf8a'));hill.position.set(750+random()*900,-40,-900+random()*1600);hill.scale.set(100+random()*200,100+random()*220,120+random()*190);this.environ.add(hill);}
    // Dense authored roadside rhythm, batched instances for the palms and posts.
    const postTransforms=[],trunkTransforms=[],leafTransforms=[],dashTransforms=[];const dummy=new THREE.Object3D();
    const push=(arr,x,y,z,sx,sy,sz,ry=0,rz=0)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,ry,rz);dummy.updateMatrix();arr.push(dummy.matrix.clone());};
    this.lamps=[];this.gateMeshes=[];
    for(let s=0;s<track.length;s+=12){const p=track.at(s);push(dashTransforms,p.x,p.y+.047,p.z,.16,.018,4,p.heading);
      for(const side of [-1,1]){const b=track.at(s,side*(track.width/2+3.6));push(postTransforms,b.x,b.y+.85,b.z,.24,1.7,.24,p.heading);}
    }
    for(let s=0;s<track.length;s+=30)for(const side of [-1,1]) {
      if(side===-1&&s%90<30)continue;const p=track.at(s,side*(track.width/2+9+random()*11)),height=6+random()*4;
      push(trunkTransforms,p.x,p.y+height/2-.3,p.z,.28,height,.28,p.heading,.08*side);
      for(let k=0;k<7;k++){const a=k*Math.PI*2/7;push(leafTransforms,p.x,p.y+height-.5,p.z,1+random()*.15,1,1+random()*.2,a);}
    }
    const instance=(geo,material,matrices,parent)=>{const mesh=new THREE.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);};
    const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.55,.5,1.2,.55,.5,1.2,0,0,0,.55,.5,1.2,0,-.8,4.2,-.55,.5,1.2,0,-.8,4.2,.55,.5,1.2],3));leafGeo.computeVertexNormals();leaves.side=THREE.DoubleSide;
    instance(boxGeo,edge,dashTransforms,this.environ);instance(boxGeo,coral,postTransforms,this.environ);instance(cylinderGeo,trunk,trunkTransforms,this.detail);instance(leafGeo,leaves,leafTransforms,this.detail);
    for(const side of [-1,1]) {
      const rail=strip(track,side*(track.width/2+3.5)-.13,side*(track.width/2+3.5)+.13,1.15,metal);this.environ.add(rail);
    }
    for(let i=0;i<track.gates;i++){
      const p=track.at(i*track.spacing),gate=new THREE.Group();gate.position.set(p.x,p.y,p.z);gate.rotation.y=p.heading;this.environ.add(gate);
      const gm=mat(i===0?'#f6e6c6':'#75cabb',{emissive:i===0?'#9e6738':'#286f68',emissiveIntensity:.25});
      for(const side of [-1,1])box(gate,gm,side*(track.width/2+4.5),3,0,.5,6,.55);
      box(gate,gm,0,6,0,track.width+9.5,.65,.65);
      const tex=signTexture(i===0?'MARÉ ALTA':`${String(i).padStart(2,'0')}  →`,i===0?'O LITORAL É SEU':'MANTENHA O RITMO');
      const banner=new THREE.Mesh(new THREE.PlaneGeometry(i===0?10:5,1.55),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));banner.position.set(0,5.7,-.4);banner.rotation.y=Math.PI;gate.add(banner);this.gateMeshes.push({gate,gm});
      if(i===0){for(let x=0;x<Math.floor(track.width);x++)for(let z=0;z<3;z++)box(gate,(x+z)%2?darkMaterial():white,x-track.width/2+.5,.06,z-1,1,.02,1);}
    }
    // Village, terraces and a waterfront promenade flank the town sector.
    const wallColors=['#efe0bc','#eeb99a','#a7cbc5','#ebd38e','#dba88f'];const wallMats=wallColors.map(c=>mat(c));
    for(let i=0;i<(id==='race'?40:23);i++){
      const s=track.length*(id==='race'?.3:.1)+i*19,side=i%2?1:-1,p=track.at(s,side*(track.width/2+13+random()*10)),h=5+random()*8;
      const g=new THREE.Group();g.position.set(p.x,p.y-.4,p.z);g.rotation.y=p.heading;this.environ.add(g);
      const wall=wallMats[i%wallMats.length];box(g,wall,0,h/2,0,8,h,7);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(6.2,2,4),roof);cap.rotation.y=Math.PI/4;cap.position.y=h+.9;g.add(cap);cap.castShadow=true;
      for(let level=0;level<Math.floor(h/2.8);level++)for(const x of [-2.3,0,2.3]){box(g,window,x,1.7+level*2.8,-3.54,1.05,1.45,.1);box(g,white,x,1+level*2.8,-3.66,1.25,.15,.3);}
      box(g,coral,0,2.8,-4,8,.2,1.5);box(g,white,0,.15,-4,9,.3,2);
    }
    // Stone bridge with genuine road continuity, piers and pylons.
    const bridgeS=track.length*.67;
    for(let j=-3;j<=3;j++){
      const p=track.at(bridgeS+j*15);for(const side of [-1,1]){const b=track.at(bridgeS+j*15,side*(track.width/2+5));box(this.environ,white,b.x,b.y/2-4,b.z,1.5,b.y+8,1.5);}
      if(Math.abs(j)===2){const g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.heading;this.environ.add(g);for(const side of [-1,1])box(g,white,side*(track.width/2+5),8,0,1.5,16,1.5);box(g,white,0,15,0,track.width+12,1.3,1.5);}
    }
    if(id==='race'||id==='rush') {
      this.tunnelStart=track.length*.78;this.tunnelEnd=this.tunnelStart+95;
      const tunnelMat=mat('#698982');
      for(let s=this.tunnelStart;s<this.tunnelEnd;s+=5){const p=track.at(s),g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.heading;this.environ.add(g);for(const side of [-1,1])box(g,tunnelMat,side*(track.width/2+4),4,0,1.8,8,5.1);box(g,tunnelMat,0,8,0,track.width+10,1.4,5.1);box(g,lampMaterial(),0,7.22,0,2,.05,1);}
    } else {this.tunnelStart=-1;this.tunnelEnd=-1;}
    for(let s=25;s<track.length;s+=65){const p=track.at(s,track.width/2+5);cylinder(this.environ,metal,p.x,p.y+3.8,p.z,.12,7.6);const lamp=box(this.environ,lampMaterial(),p.x,p.y+7.5,p.z,.8,.18,.8);this.lamps.push(lamp);}
    // Lighthouse and sailboats establish horizon and scale.
    const lp=track.at(track.length*.94,-45);cylinder(this.environ,white,lp.x,lp.y+8,lp.z,2.8,16);cylinder(this.environ,coral,lp.x,lp.y+12,lp.z,2.85,2);cylinder(this.environ,window,lp.x,lp.y+17,lp.z,2.2,2.4);const hat=new THREE.Mesh(new THREE.ConeGeometry(3.2,2.7,16),roof);hat.position.set(lp.x,lp.y+19,lp.z);this.environ.add(hat);
    this.boats=[];
    for(let i=0;i<8;i++){const g=new THREE.Group();g.position.set(-480-random()*650,-6.7,-800+random()*1800);g.rotation.y=random()*6;this.environ.add(g);const boat=new THREE.Mesh(hull([[-4,.4,-.5,0],[-2,1.4,-.7,.5],[2,1.4,-.7,.5],[4,.2,-.2,.2]]),white);g.add(boat);box(g,white,0,4.8,0,.1,10,.1);const sail=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,9,0,0,1.5,0,3.7,1.5,0],3)),new THREE.MeshStandardMaterial({color:i%2?'#fff5d7':'#e98b69',side:THREE.DoubleSide}));sail.geometry.computeVertexNormals();g.add(sail);this.boats.push(g);}
    this.batchStatic(this.environ);
    this.lastView='';
  }
  batchStatic(root){root.updateMatrixWorld(true);const buckets=new Map();root.traverse(m=>{if(m.isMesh&&!m.isInstancedMesh&&m.geometry===boxGeo){const key=m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);}});for(const group of buckets.values()){if(group.length<4)continue;const mesh=new THREE.InstancedMesh(boxGeo,group[0].material,group.length);group.forEach((m,i)=>{mesh.setMatrixAt(i,m.matrixWorld);m.removeFromParent();});mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}}
  setCars(identities) {
    const key=identities.map(c=>c.model+c.color).join('/');if(key===this.carKey)return;this.carKey=key;this.disposeGroup(this.carGroup);this.carMeshes=identities.map(c=>{const mesh=makeCar(c.model,c.color);this.carGroup.add(mesh);return mesh;});
  }
  updateCars(state,time) {
    this.setCars(state.cars);
    state.cars.forEach((c,i)=>{
      const m=this.carMeshes[i],d=m.userData;m.position.set(c.x,c.y+.1,c.z);m.rotation.set(0,c.heading,clamp(-c.steering*c.speed*.0009,-.07,.07));
      const p=this.course.project(c.x,c.z);m.rotation.x=p.slope;
      d.body.scale.z=1-c.damage*.04;d.body.position.x=c.damage*.055;d.bodyMat.color.copy(d.baseColor).lerp(new THREE.Color('#687577'),c.damage*.3);d.scars.visible=c.damage>.07;d.scars.scale.z=.3+c.damage*.7;
      d.cabin.rotation.z=c.damage*.025;d.flame.visible=c.boost;d.flame.scale.y=.8+Math.sin(time*35)*.2;
      d.wheels.forEach(({holder,front})=>{holder.rotation.y=front?c.steering*.36:0;holder.children.forEach(o=>{if(o.isMesh)o.rotation.x=c.route*.7;});});
      d.lights.forEach((l,j)=>l.visible=c.damage<.7||j===0);d.tail.emissiveIntensity=c.speed<15?1.8:.8;
      m.visible=c.ghost<=0||Math.floor(time*8)%2===0;
    });
  }
  environment(climate,time,player) {
    const {light,weather,wet}=climate;this.hemi.intensity=.6+light*1.7;this.sun.intensity=(.25+light*3)*(1-weather*.65);
    const sky=new THREE.Color('#8dcedc').lerp(new THREE.Color('#b7bfc3'),weather*.65).lerp(new THREE.Color('#102835'),1-light);
    const sunset=Math.max(0,1-Math.abs(climate.daylight-.68)/.12);sky.lerp(new THREE.Color('#e4b493'),sunset*.55);
    this.scene.background.copy(sky);this.scene.fog.color.copy(sky);this.scene.fog.density=.0009+weather*.0006;
    this.sun.color.set(sunset>.2?'#ffd2a3':'#fff1d5');
    const px=player?.x||0,py=player?.y||10,pz=player?.z||0;
    this.sun.position.set(px-120,py+220,pz-100);this.sun.target.position.set(px,py,pz);
    this.oceanMat.uniforms.time.value=time;this.oceanMat.uniforms.light.value=light;
    this.roadMat.roughness=.94-wet*.65;this.roadMat.metalness=.03+wet*.4;
    const isTunnel=player&&player.lastS>=this.tunnelStart&&player.lastS<=this.tunnelEnd;
    this.headlight.intensity=light<.4||isTunnel?70:0;
    if(player){const fx=Math.sin(player.heading),fz=Math.cos(player.heading);this.headlight.position.set(px+fx*1.7,py+1.4,pz+fz*1.7);this.headlight.target.position.set(px+fx*30,py+.1,pz+fz*30);}
    const count=weather>.55?Math.floor((this.q===0?150:this.q===1?500:1200)*(weather-.55)/.45):0;
    this.rain.visible=count>0;this.rainGeo.setDrawRange(0,count*2);const pos=this.rainGeo.attributes.position.array;
    for(let i=0;i<count;i++){const x=px+Math.sin(i*127.1)*40,z=pz+Math.sin(i*311.7)*40,y=py+((i*7.7-time*22)%35+35)%35;pos.set([x,y,z,x-.2,y-1.3,z-.12],i*6);}this.rainGeo.attributes.position.needsUpdate=true;
    const emit=player&&(player.drift||player.impact>.1||(wet>.4&&player.speed>15));this.particles.visible=!!emit;
    if(emit){const pp=this.particleGeo.attributes.position.array,n=this.q===0?20:this.q===1?60:130;this.particleGeo.setDrawRange(0,n);const f=Math.sin(player.heading),g=Math.cos(player.heading);for(let i=0;i<n;i++){const age=((time*3+i*.032)%1);pp.set([px-f*(2+age*8)+Math.sin(i*9)*age*2,py+.3+age*1.5,pz-g*(2+age*8)+Math.cos(i*7)*age*2],i*3);}this.particleGeo.attributes.position.needsUpdate=true;this.particles.material.color.set(player.impact>.1?'#ffc568':'#e6f3ee');}
    this.boats.forEach((b,i)=>{b.rotation.z=Math.sin(time*.5+i)*.035;});
    this.gateMeshes.forEach(({gm},i)=>{const next=player?player.nextGate%this.course.gates:1;gm.emissiveIntensity=i===next?.65:.16;});
  }
  render(state,view='drive',dt=.016,options={}) {
    this.loadCourse(state.setup.mode);this.updateCars(state,state.time);const p=state.cars[0];this.environment(state.climate,state.time,p);
    const forward=v3(Math.sin(p.heading),0,Math.cos(p.heading)),right=v3(forward.z,0,-forward.x),base=v3(p.x,p.y,p.z);
    let position,target,fov=54;
    if(view==='menu'||view==='garage'){
      const a=this.settings.reduced?-.65:-.65+Math.sin(options.wallTime*.055)*.08;
      position=base.clone().addScaledVector(forward,9.5).addScaledVector(right,view==='garage'?7.5:9.8);position.y+=4.2;
      target=base.clone().addScaledVector(right,view==='menu'?-3.4:0);target.y+=.7;position.applyAxisAngle(v3(0,1,0),0*a);fov=view==='garage'?37:45;
    } else if(view==='orbit') {
      const a=options.orbit??state.time*.13,r=options.zoom??15;position=base.clone().add(v3(Math.sin(a)*r,5+r*.15,Math.cos(a)*r));target=base.clone().add(v3(0,1,0));fov=48;
    } else if(view==='aerial') {
      position=base.clone().addScaledVector(forward,-25).addScaledVector(right,14);position.y+=45;target=base.clone().addScaledVector(forward,20);fov=53;
    } else {
      position=base.clone().addScaledVector(forward,-(10.5+Math.abs(p.speed)*.035));position.y+=4.7+Math.abs(p.speed)*.009;
      target=base.clone().addScaledVector(forward,16+Math.abs(p.speed)*.13);target.y+=1.5;
      const ahead=this.course.at((p.lastS??this.course.project(p.x,p.z).s)+24);target.y=Math.max(target.y,ahead.y+1);
      fov=56+clamp(p.speed,0,75)*.17+(p.boost?5:0);
    }
    const snap=this.lastView!==view||options.snap||this.settings.reduced||this.lastRecovery!==p.recovery||this.camera.position.distanceTo(position)>90;
    const factor=snap?1:1-Math.exp(-dt*7);
    this.camera.position.lerp(position,factor);if(!this.look)this.look=target.clone();else this.look.lerp(target,factor);
    this.camera.lookAt(this.look);this.camera.fov=lerp(this.camera.fov,fov,factor);this.camera.updateProjectionMatrix();this.lastView=view;this.lastRecovery=p.recovery;
    this.renderer.render(this.scene,this.camera);
  }
}
function darkMaterial(){return mat('#29454a');}
function lampMaterial(){return mat('#f8e7b7',{emissive:'#ffe8ac',emissiveIntensity:1.3});}
