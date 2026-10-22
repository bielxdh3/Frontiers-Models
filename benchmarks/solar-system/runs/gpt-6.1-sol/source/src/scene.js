import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {catalog,byId,majorIds,childrenOf,bodyName} from './data.js';
import {positionsAt,displayPositions,displayRadius,toDisplay,orbitPosition,elementsAt,subtract,length,DAY,AU,TAU,RAD,MIN_DATE,MAX_DATE} from './science.js';

const vec=a=>new THREE.Vector3(...a);
const ease=t=>t*t*(3-2*t);
function rng(seed=71){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function proceduralTexture(b){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d'),random=rng(b.id.split('').reduce((s,x)=>s+x.charCodeAt(0),0));
 c.fillStyle=b.color;c.fillRect(0,0,512,256);
 if(['gas','ice'].includes(b.type)||b.id==='venus'){
  for(let y=0;y<256;y++){const k=.5+.5*Math.sin(y*.32+Math.sin(y*.04)*3);c.fillStyle=`rgba(${b.id==='neptune'?'25,67,141':'110,76,40'},${.08+k*.24})`;c.fillRect(0,y,512,1);}
  if(b.id==='jupiter'){c.fillStyle='#9c5e40';c.beginPath();c.ellipse(315,165,29,12,-.1,0,TAU);c.fill();}
 }else if(b.id==='sun'){
  for(let i=0;i<12000;i++){c.fillStyle=`rgba(255,${110+random()*100|0},40,${random()*.5})`;c.fillRect(random()*512,random()*256,random()*6+1,random()*4+1);}
 }else if(b.id==='earth'){
  c.fillStyle='#265982';c.fillRect(0,0,512,256);c.fillStyle='#637451';
  const continents=[[[50,35],[100,25],[145,48],[125,70],[113,87],[95,95],[75,72],[55,60]],[[122,94],[153,113],[155,148],[144,185],[122,169],[112,130]],[[240,78],[279,75],[296,110],[276,150],[255,147],[237,110]],[[251,45],[300,30],[365,36],[414,59],[440,77],[413,96],[367,88],[338,108],[311,81],[280,67]],[[399,153],[432,148],[456,173],[429,184],[405,174]]];
  for(const points of continents){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  c.fillStyle='#dbdedc';c.fillRect(0,0,512,13);c.fillRect(0,237,512,19);
  c.strokeStyle='#eeeeee55';c.lineWidth=7;for(let i=0;i<14;i++){c.beginPath();c.ellipse(random()*512,random()*220,random()*35+10,4,-.2,0,TAU);c.stroke();}
 }else{
  for(let i=0;i<2100;i++){const x=random()*512,y=random()*256,r=random()<.95?random()*5:random()*18;c.fillStyle=`rgba(${b.id==='io'?'121,73,17':'35,32,30'},${.06+random()*.18})`;c.beginPath();c.ellipse(x,y,r,r*.8,0,0,TAU);c.fill();if(r>8){c.strokeStyle='#f5eee51b';c.stroke();}}
  if(b.id==='mars'){c.fillStyle='#eee8dc';c.fillRect(0,0,512,9);c.fillRect(0,248,512,8);}
  if(['europa','enceladus'].includes(b.id)){c.strokeStyle='#8d9caa88';c.lineWidth=1;for(let i=0;i<35;i++){c.beginPath();c.moveTo(random()*512,0);c.bezierCurveTo(random()*512,100,random()*512,190,random()*512,256);c.stroke();}}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,211,144,.8)');g.addColorStop(.23,'rgba(255,165,70,.35)');g.addColorStop(.48,'rgba(232,114,29,.10)');g.addColorStop(1,'rgba(180,80,15,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
function planetMaterial(texture,sun=false){return new THREE.ShaderMaterial({uniforms:{map:{value:texture},sunDirection:{value:new THREE.Vector3(1,0,0)},ambient:{value:.13},isSun:{value:sun?1:0},exposure:{value:1}},vertexShader:`varying vec2 vUv; varying vec3 vNormal; void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform sampler2D map; uniform vec3 sunDirection; uniform float ambient; uniform float isSun; uniform float exposure; varying vec2 vUv; varying vec3 vNormal; void main(){vec3 color=texture2D(map,vUv).rgb;float d=dot(normalize(vNormal),sunDirection);float diffuse=max(d,0.0);float terminator=smoothstep(-0.06,0.25,d);float light=ambient+(1.1-ambient)*diffuse;light=mix(light,1.38,isSun);color*=light*exposure;gl_FragColor=vec4(color,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});}

export class ObservatoryScene {
 constructor(host,labelHost,getState,events){
  this.host=host;this.labelHost=labelHost;this.getState=getState;this.events=events;this.items={};this.labels={};this.paths={};this.history=[];this.future=[];this.cameraMode='overview';this.focusId=null;this.localSystem=null;this.transition=null;this.lastReal=null;this.stats={fps:0,frames:0,frameMs:0};this.trailPoints=[];this.assetFailures=[];this.disposed=false;this.effectiveQuality='medium';
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.001,20000);this.camera.position.set(115,128,160);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor('#080d14',1);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('role','img');this.host.appendChild(this.renderer.domElement);
  // Keep the extension while the context is alive; getExtension may return null during loss.
  this.contextRecovery=this.renderer.getContext().getExtension('WEBGL_lose_context');
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.zoomSpeed=.75;this.controls.rotateSpeed=.55;this.controls.minDistance=.01;this.controls.maxDistance=650;this.controls.target.set(0,0,0);this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
  this.sphere=new THREE.SphereGeometry(1,64,40);this.moonSphere=new THREE.SphereGeometry(1,32,24);
  for(const b of catalog.filter(x=>x.type!=='region'))this.createBody(b);
  this.createStars();this.createBelts();this.createOverlays();
  this.selection=new THREE.Sprite(new THREE.SpriteMaterial({map:this.markerTexture(),transparent:true,opacity:.6,depthTest:false}));this.scene.add(this.selection);
  this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#e7bb8c',transparent:true,opacity:.65}));this.scene.add(this.trail);
  this.ruler=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:'#8cd5d4',dashSize:.7,gapSize:.35,transparent:true,opacity:.8}));this.scene.add(this.ruler);this.ruler.visible=false;
  this.pulse=new THREE.Mesh(new THREE.SphereGeometry(.23,12,8),new THREE.MeshBasicMaterial({color:'#c7fbff'}));this.scene.add(this.pulse);this.pulse.visible=false;
  this.axisArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),8,0x93c6d5,1,.4);this.scene.add(this.axisArrow);this.axisArrow.visible=false;
  this.velocityArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),7,0xe5bf88,1,.4);this.scene.add(this.velocityArrow);this.velocityArrow.visible=false;
  this.tidalArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),4,0xd5b69c,.7,.25);this.scene.add(this.tidalArrow);this.tidalArrow.visible=false;
  this.apsisMarkers=[0,1].map(i=>{const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:this.markerTexture(),color:i?'#9bc8d4':'#e6bc83',transparent:true,depthTest:false}));this.scene.add(marker);return marker;});
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.projected=[];
  this.onPointerDown=e=>{this.pointerStart={x:e.clientX,y:e.clientY};this.manual();};this.onPointerUp=e=>this.pick(e);this.onWheel=()=>this.manual();this.renderer.domElement.addEventListener('pointerdown',this.onPointerDown);this.renderer.domElement.addEventListener('pointerup',this.onPointerUp);this.renderer.domElement.addEventListener('wheel',this.onWheel,{passive:true});
  this.onKey=e=>{if(e.target!==this.renderer.domElement)return;const step=.08;if(e.key==='ArrowLeft')this.orbit(step,0);else if(e.key==='ArrowRight')this.orbit(-step,0);else if(e.key==='ArrowUp')this.orbit(0,-step);else if(e.key==='ArrowDown')this.orbit(0,step);else if(e.key==='+'||e.key==='=')this.zoom(.83);else if(e.key==='-')this.zoom(1.2);else return;e.preventDefault();};this.renderer.domElement.addEventListener('keydown',this.onKey);
  this.onVisibility=()=>{this.lastReal=null;if(document.hidden)this.events.onSuspend?.();};document.addEventListener('visibilitychange',this.onVisibility);
  this.onLost=e=>{e.preventDefault();this.lost=true;this.events.onContext?.(true);};this.onRestored=()=>{this.lost=false;this.lastReal=null;this.events.onContext?.(false);};this.renderer.domElement.addEventListener('webglcontextlost',this.onLost);this.renderer.domElement.addEventListener('webglcontextrestored',this.onRestored);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.lastScale=null;this.lastQuality=null;this.pathYear=null;
  this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);this.loadTextures();
 }
 markerTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.strokeStyle='#f4c28a';ctx.lineWidth=1.5;for(let i=0;i<4;i++){ctx.save();ctx.translate(32,32);ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.moveTo(-24,-13);ctx.lineTo(-24,-24);ctx.lineTo(-13,-24);ctx.stroke();ctx.restore();}return new THREE.CanvasTexture(c);}
 createBody(b){
  const position=new THREE.Group(),axis=new THREE.Group();axis.rotation.z=(b.tilt||0)*RAD;position.add(axis);this.scene.add(position);
  let geometry=b.type==='moon'?this.moonSphere:this.sphere;
  if(['vesta','phobos','deimos'].includes(b.id)){geometry=geometry.clone();const vertices=geometry.attributes.position;for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),f=1+.07*Math.sin(x*5+y*3)+.05*Math.sin(z*7-x*2);vertices.setXYZ(i,x*f,y*f,z*f);}geometry.computeVertexNormals();}
  const texture=proceduralTexture(b);const material=planetMaterial(texture,b.id==='sun');const surface=new THREE.Mesh(geometry,material);axis.add(surface);surface.userData.bodyId=b.id;
  if(['vesta','phobos','deimos','haumea'].includes(b.id))surface.scale.set(b.id==='haumea'?1.75:1.4,.8,1);
  const item={position,axis,surface,material,fallback:texture};this.items[b.id]=item;
  if(['earth','venus','mars','titan','uranus','neptune'].includes(b.id)){
   const atmosphere=new THREE.Mesh(this.sphere,new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(b.id==='mars'?'#a76640':b.id==='titan'?'#b88e48':'#528aa6')}},vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 color;varying vec3 vN;varying vec3 vV;void main(){float rim=pow(1.0-max(dot(normalize(vN),normalize(vV)),0.0),3.5);gl_FragColor=vec4(color,rim*.32);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));atmosphere.scale.setScalar(1.065);axis.add(atmosphere);item.atmosphere=atmosphere;
  }
  if(b.id==='sun'){const corona=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.52}));position.add(corona);item.corona=corona;}
  if(b.id==='saturn'||b.id==='uranus'){
   const geometry=new THREE.RingGeometry(b.id==='saturn'?1.26:1.55,b.id==='saturn'?2.36:2.05,192,36);geometry.rotateX(-Math.PI/2);
   const cs=[],ps=geometry.attributes.position;
   for(let i=0;i<ps.count;i++){const r=Math.hypot(ps.getX(i),ps.getZ(i));let light=.55+.2*Math.sin(r*120)+.09*Math.sin(r*600);if(r>1.91&&r<1.99)light=.06;const col=new THREE.Color(b.id==='saturn'?'#cfc0a4':'#b2c8c6').multiplyScalar(light);cs.push(col.r,col.g,col.b);}
   geometry.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));const rings=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:b.id==='saturn'?.83:.24,depthWrite:false}));axis.add(rings);item.rings=rings;
  }
  if(b.id==='comet'){
   const coma=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:'#b9e6df',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.28}));coma.scale.setScalar(7);position.add(coma);item.coma=coma;
   const tailGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,12)]);const tail=new THREE.Line(tailGeo,new THREE.LineBasicMaterial({color:'#89d6e6',transparent:true,opacity:.5}));this.scene.add(tail);item.tail=tail;
   const dust=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#c4b493',transparent:true,opacity:.5}));this.scene.add(dust);item.dust=dust;
  }
  const label=document.createElement('button');label.className='body-label';label.type='button';label.tabIndex=-1;label.dataset.body=b.id;label.innerHTML='<span class="label-dot"></span><span class="label-name"></span>';label.style.setProperty('--body-color',b.color);label.addEventListener('click',()=>this.events.onSelect(b.id,false));this.labelHost.appendChild(label);this.labels[b.id]=label;
 }
 async loadTextures(){
  const loader=new THREE.TextureLoader();
  this.assetFailures=[];
  await Promise.allSettled(catalog.filter(b=>b.texture&&!this.items[b.id].loadedTexture).map(async b=>{
   try{const texture=await loader.loadAsync(`/textures/${b.texture}.jpg`);if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(this.renderer.capabilities.getMaxAnisotropy(),8);this.items[b.id].material.uniforms.map.value=texture;this.items[b.id].loadedTexture=texture;
   }catch(e){if(!this.assetFailures.includes(b.id))this.assetFailures.push(b.id);}
  }));
  if(!this.disposed){this.events.onAssets?.(this.assetFailures);if(this.items.earth.clouds)return;try{const clouds=await loader.loadAsync('/textures/earth_clouds.jpg');if(this.disposed){clouds.dispose();return;}const cloudMaterial=new THREE.ShaderMaterial({uniforms:{map:{value:clouds},sunDirection:{value:new THREE.Vector3()}},vertexShader:'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D map;uniform vec3 sunDirection;varying vec2 vUv;varying vec3 vN;void main(){float a=texture2D(map,vUv).r*.35;float light=.04+max(dot(normalize(vN),sunDirection),0.0)*.96;gl_FragColor=vec4(vec3(light),a);}',transparent:true,depthWrite:false});const mesh=new THREE.Mesh(this.sphere,cloudMaterial);mesh.scale.setScalar(1.012);this.items.earth.axis.add(mesh);this.items.earth.clouds=mesh;}catch(e){/* Earth remains recognizable without cloud imagery. */}}
 }
 createStars(){
  const random=rng(809),positions=[],colors=[],sizes=[];
  for(let i=0;i<3500;i++){const z=random()*2-1,theta=random()*TAU,r=1600,rr=Math.sqrt(1-z*z),color=new THREE.Color().setHSL(.55+random()*.1,.1+random()*.18,.4+random()*.45);positions.push(Math.cos(theta)*rr*r,z*r,Math.sin(theta)*rr*r);colors.push(color.r,color.g,color.b);sizes.push(i);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));this.stars=new THREE.Points(geo,new THREE.PointsMaterial({size:.95,vertexColors:true,transparent:true,opacity:.7,sizeAttenuation:false,depthWrite:false}));this.scene.add(this.stars);
 }
 createBelts(){
  this.belts=[];const random=rng(410);for(const [min,max,count] of [[2.12,3.3,1700],[30,50,1300]]){
   const raw=[];for(let i=0;i<count;i++){const angle=random()*TAU,r=min+(max-min)*random();raw.push([Math.cos(angle)*r*AU,(random()-.5)*.03*r*AU,Math.sin(angle)*r*AU]);}
   const mesh=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:'#82919b',size:.9,transparent:true,opacity:.28,sizeAttenuation:false}));this.scene.add(mesh);this.belts.push({raw,mesh});
  }
 }
 createOverlays(){this.grid=new THREE.GridHelper(200,24,'#263b4b','#15212d');this.grid.material.transparent=true;this.grid.material.opacity=.25;this.scene.add(this.grid);}
 rebuildPaths(time,mode){
  for(const b of catalog.filter(x=>x.type!=='region'&&x.id!=='sun')){
   const el=elementsAt(b,time),points=[];for(let i=0;i<=240;i++)points.push(vec(toDisplay(orbitPosition(el,TAU*i/240),mode,b.type==='moon',b.parent)));
   let path=this.paths[b.id];if(!path){path=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#4d667b',transparent:true,opacity:.23}));this.scene.add(path);this.paths[b.id]=path;}
   path.geometry.dispose();path.geometry=new THREE.BufferGeometry().setFromPoints(points);
  }
  for(const belt of this.belts){belt.mesh.geometry.dispose();belt.mesh.geometry=new THREE.BufferGeometry().setFromPoints(belt.raw.map(x=>vec(toDisplay(x,mode))));}
 }
 resize(){const {clientWidth:w,clientHeight:h}=this.host;if(w<1||h<1)return;this.width=w;this.height=h;this.safeOffset=null;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
 updateQuality(setting){const quality=setting==='auto'?this.effectiveQuality:setting;this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='medium'?1.5:2));this.renderer.setSize(this.width,this.height,false);this.stars.geometry.setDrawRange(0,quality==='low'?1000:quality==='medium'?2300:3500);this.lastQuality=setting;}
 manual(){this.transition=null;this.events.onManual?.();}
 recordHistory(){const v=this.snapshot();if(this.history.length>14)this.history.shift();this.history.push(v);this.future=[];}
 snapshot(){const target=this.focusId&&this.displays?.[this.focusId]?vec(this.displays[this.focusId]):this.controls.target;const offset=this.camera.position.clone().sub(target);return {target:this.focusId||'sun',offset:offset.toArray(),targetOffset:this.controls.target.clone().sub(target).toArray(),distance:offset.length(),mode:this.cameraMode,system:this.localSystem,targetPosition:this.controls.target.toArray()};}
 restore(snapshot){if(!snapshot)return;this.cameraMode=snapshot.mode||'focus';const anchored=!['overview','free'].includes(this.cameraMode);this.focusId=anchored?(snapshot.target||'sun'):null;this.localSystem=snapshot.system||null;const pos=anchored?vec(this.displays?.[this.focusId]||[0,0,0]):vec(snapshot.targetPosition||[0,0,0]);this.controls.target.copy(pos).add(vec(anchored?(snapshot.targetOffset||[0,0,0]):[0,0,0]));this.camera.position.copy(pos).add(vec(snapshot.offset));this.lastTarget=anchored?pos.clone():null;this.controls.minDistance=anchored?Math.max(1e-8,displayRadius(this.focusId,this.getState().settings.scale)*1.18):3;this.transition=null;this.controls.update();this.events.onCamera?.(this.cameraMode);}
 historyBack(){const prev=this.history.pop();if(prev){this.future.push(this.snapshot());this.restore(prev);}}
 historyForward(){const next=this.future.pop();if(next){this.history.push(this.snapshot());this.restore(next);}}
 focus(id,mode='focus',record=true,preset=null){
  if(!this.items[id])return;if(record)this.recordHistory();const state=this.getState(),scale=state.settings.scale;
  this.focusId=id;this.cameraMode=mode;this.localSystem=mode==='system'?id:null;
  const radius=displayRadius(id,scale)*(id==='saturn'?2.7:id==='uranus'?2.1:1.15);
  let distance=radius*5.6;
  if(mode==='system'){const kids=childrenOf(id);distance=Math.max(radius*6,...kids.map(b=>length(toDisplay(subtract(this.physical[b.id],this.physical[id]),scale,true,id))*3.2));}
  // Fit to the free scene area, including mobile bottom sheets and desktop panels.
  const narrow=this.width<700;distance*=narrow?1.45:1.1;distance*=Math.max(1,1/this.camera.aspect);
  const tilt=(byId[id].tilt||0)*RAD,pole=new THREE.Vector3(-Math.sin(tilt),Math.cos(tilt),0),equator=new THREE.Vector3(Math.cos(tilt),Math.sin(tilt),1).normalize();
  const direction=preset==='polar'?pole:preset==='equatorial'?equator:id==='saturn'?equator.multiplyScalar(1.3).addScaledVector(pole,.85):preset==='cinematic'?new THREE.Vector3(1,.25,1.7):new THREE.Vector3(1,.55,1.6);
  const offset=direction.normalize().multiplyScalar(distance),now=performance.now();
  this.transition={id,fromCamera:this.camera.position.clone(),fromTarget:this.controls.target.clone(),offset,start:now,duration:state.settings.reducedMotion?0:1000};
  this.controls.minDistance=Math.max(radius*1.18,scale==='relative'?1e-6:.1);this.controls.maxDistance=650;this.lastTarget=vec(this.displays[id]);this.events.onCamera?.(mode);
 }
 overview(preset='default',record=true){
  if(record)this.recordHistory();this.focusId=null;this.localSystem=null;this.cameraMode='overview';this.controls.minDistance=3;this.controls.maxDistance=1500;this.transition=null;
  const p=preset==='top'?[.1,190,.1]:preset==='cinematic'?[120,38,130]:[112,122,148];this.camera.position.set(...p);this.controls.target.set(0,0,0);this.controls.update();this.events.onCamera?.('overview');
 }
 free(){this.focusId=null;this.localSystem=null;this.cameraMode='free';this.transition=null;this.events.onCamera?.('free');}
 zoom(factor){this.manual();this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();}
 orbit(theta,phi){this.manual();const off=this.camera.position.clone().sub(this.controls.target),s=new THREE.Spherical().setFromVector3(off);s.theta+=theta;s.phi=Math.max(.02,Math.min(Math.PI-.02,s.phi+phi));this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();}
 pan(x,y){this.manual();const factor=this.camera.position.distanceTo(this.controls.target)*.06;const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrix,0).multiplyScalar(x*factor),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrix,1).multiplyScalar(y*factor);this.camera.position.add(right).add(up);this.controls.target.add(right).add(up);this.controls.update();}
 clearTrail(){this.trailPoints=[];this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry();}
 jump(){this.clearTrail();this.pathYear=null;this.lastReal=null;}
 setMeasurement(measurement){this.measurement=measurement;}
 sendPulse(){this.pulseStart=performance.now();}
 pick(e){
  if(!this.pointerStart||Math.hypot(e.clientX-this.pointerStart.x,e.clientY-this.pointerStart.y)>6)return;
  const rect=this.renderer.domElement.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
  this.pointer.set(x/rect.width*2-1,-y/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hits=this.raycaster.intersectObjects(Object.values(this.items).filter(item=>item.position.visible).map(item=>item.surface));
  const small=this.projected.filter(p=>p.visible&&Math.hypot(p.x-x,p.y-y)<Math.max(13,p.radius));
  const ids=[...new Set([...hits.map(h=>h.object.userData.bodyId),...small.map(p=>p.id)])];
  if(ids.length>1)this.events.onAmbiguous?.(ids);else if(ids[0])this.events.onSelect(ids[0],false);
 }
 updateLabels(state){
  this.projected=[];const occupied=[],selected=state.selected,mode=state.settings.labels;
  const ids=Object.keys(this.items).sort((a,b)=>(b===selected?10:0)-(a===selected?10:0));
  const cameraDirection=this.camera.getWorldDirection(new THREE.Vector3());
  for(const id of ids){
   const item=this.items[id],pos=item.position.position.clone(),p=pos.clone().project(this.camera),x=(p.x*.5+.5)*this.width,y=(-p.y*.5+.5)*this.height;
   const radius=displayRadius(id,state.settings.scale)/Math.max(.00001,this.camera.position.distanceTo(pos))*this.height/(2*Math.tan(this.camera.fov*Math.PI/360));
   const inFront=pos.clone().sub(this.camera.position).dot(cameraDirection)>0;
   let visible=item.position.visible&&inFront&&p.z<1&&x>10&&x<this.width-60&&y>75&&y<this.height-100;
   this.projected.push({id,x,y,radius,visible});
   const label=this.labels[id];label.querySelector('.label-name').textContent=bodyName(id,state.settings.lang);label.setAttribute('aria-label',bodyName(id,state.settings.lang));label.classList.toggle('selected',id===selected);label.classList.toggle('locator',state.settings.scale==='relative');
   if(mode==='none'||(mode==='major'&&!majorIds.includes(id)&&id!==selected)||(mode==='selected'&&id!==selected)||(mode==='favorites'&&!state.favorites.includes(id)&&id!==selected)||(mode==='system'&&!(id===selected||byId[id].parent===selected||byId[id].parent===byId[selected]?.parent)))visible=false;
   let lx=x+Math.max(radius,4)+9,ly=y-8;
   if(visible&&id!==selected){if(occupied.some(q=>Math.abs(q.x-lx)<85&&Math.abs(q.y-ly)<23))visible=false;const blocked=Object.keys(this.items).some(other=>{if(other===id||!this.items[other].position.visible)return false;const center=this.items[other].position.position;const ray=pos.clone().sub(this.camera.position).normalize(),d=center.clone().sub(this.camera.position).dot(ray);if(d<=0||d>=this.camera.position.distanceTo(pos))return false;return this.camera.position.clone().addScaledVector(ray,d).distanceTo(center)<displayRadius(other,state.settings.scale)*.96;});if(blocked)visible=false;}
   if(visible)occupied.push({x:lx,y:ly});label.style.transform=`translate(${lx}px,${ly}px)`;label.hidden=!visible;
  }
  this.events.onMap?.(this.displays,this.camera.position);
 }
 frame(now){
  if(this.disposed)return;this.raf=requestAnimationFrame(this.frame);const delta=this.lastReal==null?0:Math.min((now-this.lastReal)/1000,.25);this.lastReal=now;if(document.hidden||this.lost)return;
  const state=this.getState(),clock=state.clock;
  if(state.labClock?.running)state.labClock.elapsed+=delta;
  const safeOffset=this.width<700&&(state.inspector||state.tour)&&!state.photo;
  if(safeOffset!==this.safeOffset){if(safeOffset)this.camera.setViewOffset(this.width,this.height,0,this.height*.24,this.width,this.height);else this.camera.clearViewOffset();this.safeOffset=safeOffset;}
  if(!clock.paused){clock.time+=delta*clock.rate*clock.direction*1000;if(clock.time<=MIN_DATE||clock.time>=MAX_DATE){clock.time=Math.max(MIN_DATE,Math.min(MAX_DATE,clock.time));clock.paused=true;this.events.onBoundary?.();}}
  this.physical=positionsAt(clock.time);this.displays=displayPositions(this.physical,state.settings.scale);
  const mode=state.settings.scale,year=Math.floor((clock.time-946728000000)/(365.25*DAY*1000));
  if(mode!==this.lastScale||year!==this.pathYear){this.rebuildPaths(clock.time,mode);if(this.lastScale&&mode!==this.lastScale){this.clearTrail();if(this.focusId)this.focus(this.focusId,this.cameraMode,false);}this.lastScale=mode;this.pathYear=year;}
  if(state.settings.quality!==this.lastQuality)this.updateQuality(state.settings.quality);
  const selection=state.selected,parent=byId[selection]?.type==='moon'?byId[selection].parent:selection;
  for(const b of catalog.filter(x=>this.items[x.id])){
   const item=this.items[b.id];item.position.position.set(...this.displays[b.id]);const r=displayRadius(b.id,mode);item.position.scale.setScalar(r);
   item.position.visible=majorIds.includes(b.id)||(b.type==='moon'&&(b.parent===parent||b.parent===this.localSystem))||(state.settings.smallBodies&&b.type!=='moon')||b.id===selection;
   if(this.localSystem&&b.id===this.localSystem)item.position.visible=true;
   if(b.rotationDays){const signedPeriod=b.rotationDays<0&&b.tilt>90?Math.abs(b.rotationDays):b.rotationDays;let angle=clock.time/(signedPeriod*DAY*1000)*TAU;if(b.type==='moon'){const local=subtract(this.physical[b.id],this.physical[b.parent]);angle=Math.atan2(local[1],local[0])+Math.PI;}item.surface.rotation.y=angle;}
   if(item.clouds)item.clouds.rotation.y=clock.time/(DAY*1000)*TAU*.96;
   const phys=this.physical[b.id];item.material.uniforms.sunDirection.value.set(-phys[0],-phys[2],phys[1]).normalize();item.material.uniforms.ambient.value=state.settings.presentation==='natural'?.035:.19;item.material.uniforms.exposure.value=state.settings.exposure;
   if(item.coma)item.coma.material.opacity=Math.min(.5,1.8/Math.max(1,(length(phys)/AU)**2));
   if(item.clouds)item.clouds.material.uniforms.sunDirection.value.copy(item.material.uniforms.sunDirection.value);
   if(item.corona){item.corona.scale.setScalar(4.2);item.corona.material.opacity=state.settings.presentation==='natural'?.25:.54;}
   if(item.atmosphere)item.atmosphere.visible=state.settings.presentation!=='natural'&&state.settings.quality!=='low';
   const path=this.paths[b.id];if(path){path.visible=state.settings.orbits!=='none'&&item.position.visible&&(state.settings.orbits==='all'||state.settings.orbits==='selected'&&b.id===selection||state.settings.orbits==='system'&&(b.parent===parent||b.id===parent));path.material.color.set(b.id===selection?'#a98b66':'#3c5266');path.material.opacity=b.id===selection?.52:.22;if(b.type==='moon')path.position.set(...this.displays[b.parent]);}
   if(item.tail){const p=vec(this.displays[b.id]),away=p.clone().normalize(),tail=p.clone().addScaledVector(away,Math.min(14,30/Math.max(1,length(phys)/AU)));item.tail.geometry.setFromPoints([p,tail]);item.tail.visible=item.position.visible;item.dust.geometry.setFromPoints([p,p.clone().lerp(tail,.5).add(new THREE.Vector3(0,1,1)),tail.clone().add(new THREE.Vector3(0,1.5,3))]);item.dust.visible=item.position.visible;}
  }
  this.belts.forEach(b=>b.mesh.visible=state.settings.smallBodies||['asteroidBelt','kuiperBelt'].includes(selection));this.grid.visible=state.settings.grid;
  this.stars.position.copy(this.camera.position);this.stars.material.opacity=state.settings.background*.8;
  if(this.focusId&&this.displays[this.focusId]){
   const target=vec(this.displays[this.focusId]);
   if(this.transition){const t=this.transition.duration===0?1:Math.min(1,(now-this.transition.start)/this.transition.duration),k=ease(t);this.controls.target.copy(this.transition.fromTarget).lerp(target,k);this.camera.position.copy(this.transition.fromCamera).lerp(target.clone().add(this.transition.offset),k);if(t>=1)this.transition=null;}
   else if(this.lastTarget){const move=target.clone().sub(this.lastTarget);this.camera.position.add(move);this.controls.target.add(move);}
   this.lastTarget=target;
  }
  this.controls.update();
  if(this.displays[selection]){
   const target=vec(this.displays[selection]),r=displayRadius(selection,mode),d=this.camera.position.distanceTo(target);this.selection.position.copy(target);this.selection.scale.setScalar(Math.max(r*3,d/this.height*28));this.selection.visible=state.settings.labels!=='none'&&!state.photo&&r/d*this.height/(2*Math.tan(this.camera.fov*Math.PI/360))<16;
   this.axisArrow.visible=state.settings.axes;this.axisArrow.position.copy(target);this.axisArrow.setDirection(new THREE.Vector3(-Math.sin((byId[selection].tilt||0)*RAD),Math.cos((byId[selection].tilt||0)*RAD),0));this.axisArrow.setLength(r*3.4,r*.5,r*.2);
   this.velocityArrow.visible=state.settings.velocity&&selection!=='sun';if(this.velocityArrow.visible){const t2=Math.min(MAX_DATE,clock.time+60000),t1=t2===clock.time?clock.time-60000:clock.time,p2=positionsAt(t2),p1=positionsAt(t1);this.velocityArrow.position.copy(target);this.velocityArrow.setDirection(vec(toDisplay(subtract(p2[selection],p1[selection]),'relative')).normalize());this.velocityArrow.setLength(r*4,r*.6,r*.2);}
   this.tidalArrow.visible=state.settings.tidal&&byId[selection].type==='moon';if(this.tidalArrow.visible){this.tidalArrow.position.copy(target);this.tidalArrow.setDirection(vec(this.displays[byId[selection].parent]).sub(target).normalize());this.tidalArrow.setLength(r*5,r*.5,r*.2);}
   this.apsisMarkers.forEach((marker,index)=>{marker.visible=state.settings.apsides&&selection!=='sun';if(marker.visible){const body=byId[selection],el=elementsAt(body,clock.time),p=toDisplay(orbitPosition(el,index*Math.PI),mode,body.type==='moon',body.parent);marker.position.copy(vec(p));if(body.type==='moon')marker.position.add(vec(this.displays[body.parent]));marker.scale.setScalar(Math.max(r*.5,this.camera.position.distanceTo(marker.position)/this.height*16));}});
   if(state.settings.trail&&now-(this.lastTrailDraw||0)>120&&this.lastTrailTime!==clock.time){this.trailPoints.push({position:target.clone(),time:clock.time,id:selection});this.trailPoints=this.trailPoints.filter(p=>p.id===selection&&Math.abs(clock.time-p.time)<state.settings.trailDays*DAY*1000).slice(-400);this.lastTrailTime=clock.time;this.lastTrailDraw=now;this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry().setFromPoints(this.trailPoints.map(p=>p.position));this.trail.material.opacity=state.settings.trailFade?.45:.85;}
   this.trail.visible=state.settings.trail;
  }else this.selection.visible=false;
  if(this.measurement){const m=this.measurement,p=m.frozen?displayPositions(positionsAt(m.time),mode):this.displays;this.ruler.visible=true;this.ruler.geometry.setFromPoints([vec(p[m.a]),vec(p[m.b])]);this.ruler.computeLineDistances();if(this.pulseStart){const fraction=(now-this.pulseStart)/4000;this.pulse.visible=fraction<=1;this.pulse.position.copy(vec(p[m.a])).lerp(vec(p[m.b]),Math.min(fraction,1));if(fraction>1)this.pulseStart=null;}}else{this.ruler.visible=false;this.pulse.visible=false;}
  if(now-(this.lastLabelUpdate||0)>80){this.updateLabels(state);this.lastLabelUpdate=now;}
  this.renderer.render(this.scene,this.camera);this.stats.frames++;if(!this.stats.start)this.stats.start=now;
  if(now-this.stats.start>=1500){this.stats.fps=Math.round(this.stats.frames*1000/(now-this.stats.start));this.stats.frameMs=1000/this.stats.fps;this.stats.frames=0;this.stats.start=now;
   if(state.settings.quality==='auto'){if(this.stats.fps<27){this.lowWindows=(this.lowWindows||0)+1;this.highWindows=0;}else if(this.stats.fps>54){this.highWindows=(this.highWindows||0)+1;this.lowWindows=0;}if(this.lowWindows>=3&&this.effectiveQuality!=='low'){this.effectiveQuality='low';this.updateQuality('auto');this.lowWindows=0;}if(this.highWindows>=8&&this.effectiveQuality==='low'){this.effectiveQuality='medium';this.updateQuality('auto');this.highWindows=0;}}
   this.events.onStats?.({...this.stats,quality:state.settings.quality==='auto'?this.effectiveQuality:state.settings.quality,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,drawCalls:this.renderer.info.render.calls});}
 }
 async capture({width,height,caption,labels,lang,selected,time,scale,exposure}){
  const max=this.renderer.capabilities.maxTextureSize;if(width>Math.min(4096,max)||height>Math.min(4096,max)||width*height>12e6)throw Error('Capture limit exceeded');
  const output=document.createElement('canvas');output.width=width;output.height=height;const c=output.getContext('2d');
  // Crop the already rendered frame, preserving the visible camera composition.
  const input=this.renderer.domElement,srcAspect=input.width/input.height,dstAspect=width/height;let sw=input.width,sh=input.height,sx=0,sy=0;
  if(srcAspect>dstAspect){sw=sh*dstAspect;sx=(input.width-sw)/2;}else{sh=sw/dstAspect;sy=(input.height-sh)/2;}
  c.drawImage(input,sx,sy,sw,sh,0,0,width,height);
  if(labels){c.font=`${Math.max(12,width/110)}px sans-serif`;c.fillStyle='#d9e4e9';for(const p of this.projected){if(this.labels[p.id].hidden)continue;const x=(p.x/this.width*input.width-sx)/sw*width,y=(p.y/this.height*input.height-sy)/sh*height;if(x>0&&x<width-50&&y>40&&y<height-80)c.fillText(bodyName(p.id,lang),x+12,y-8);}}
  if(caption){const h=Math.max(68,height*.09);c.fillStyle='#080d14db';c.fillRect(0,height-h,width,h);c.fillStyle='#efc99e';c.font=`600 ${Math.max(16,width/65)}px sans-serif`;c.fillText(`ÓRBITA  /  ${bodyName(selected,lang)}`,width*.035,height-h*.58);c.fillStyle='#aab4bf';c.font=`${Math.max(11,width/110)}px sans-serif`;c.fillText(`${new Date(time).toISOString().slice(0,16)} UTC · ${scale==='relative'?(lang==='pt'?'Escala real':'True scale'):(lang==='pt'?'Escala de exploração':'Exploration scale')} · Solar System Scope / INOVE · CC BY 4.0`,width*.035,height-h*.22);}
  return new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('PNG export failed')),'image/png'));
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);const c=this.renderer.domElement;c.removeEventListener('pointerdown',this.onPointerDown);c.removeEventListener('pointerup',this.onPointerUp);c.removeEventListener('wheel',this.onWheel);c.removeEventListener('keydown',this.onKey);c.removeEventListener('webglcontextlost',this.onLost);c.removeEventListener('webglcontextrestored',this.onRestored);this.controls.dispose();const textures=new Set(),geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);if(m.uniforms?.map?.value)textures.add(m.uniforms.map.value);}}});Object.values(this.items).forEach(i=>textures.add(i.fallback));textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();c.remove();this.labelHost.replaceChildren();}
}
