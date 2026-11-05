import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mix,smooth,clamp,rng} from './track.js';
const UP=new THREE.Vector3(0,1,0);
export class World {
 constructor(scene,track,renderer){this.scene=scene;this.track=track;this.renderer=renderer;this.materials={};this.batches=new Map();this.animated=[];this.time={value:0};this.random=rng();this.detailGroups=[];this.stage=1;}
 async materialsInit(progress){
  const loader=new THREE.TextureLoader();let done=0;
  await Promise.all(['asphalt','sand','rock','grass','plaster','tile','bark','paint','metal','rubber','leaves','wood'].map(async name=>{
   const maps=await Promise.all(['albedo.jpg','normal.png','roughness.jpg'].map(s=>loader.loadAsync(`./assets/${name}-${s}`)));
   for(const t of maps){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy())}
   maps[0].colorSpace=THREE.SRGBColorSpace;
   const mat=new THREE.MeshStandardMaterial({map:maps[0],normalMap:maps[1],roughnessMap:maps[2],roughness:1,normalScale:new THREE.Vector2(.35,.35)});
   if(name==='metal'){mat.metalness=.8;mat.roughness=.5}this.materials[name]=mat;progress?.(++done/13);
  }));
  const hdri=await new RGBELoader().loadAsync('./assets/sunset.hdr');hdri.mapping=THREE.EquirectangularReflectionMapping;
  this.scene.environment=hdri;this.scene.environmentIntensity=.45;this.hdri=hdri;progress?.(1);
 }
 mat(name,color,extra={}){const mat=this.materials[name].clone();if(color)mat.color.set(color);Object.assign(mat,extra);return mat}
 add(geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m}
 batch(key,geo,mat,matrix,color){if(!this.batches.has(key))this.batches.set(key,{geo,mat,matrices:[],colors:[]});const b=this.batches.get(key);b.matrices.push(matrix.clone());b.colors.push(color)}
 flush(){const obj=new THREE.Object3D();for(const [key,b] of this.batches){const m=new THREE.InstancedMesh(b.geo,b.mat,b.matrices.length);for(let i=0;i<b.matrices.length;i++){m.setMatrixAt(i,b.matrices[i]);if(b.colors[i])m.setColorAt(i,new THREE.Color(b.colors[i]))}m.castShadow=true;m.receiveShadow=true;m.userData.kind=key;this.scene.add(m);this.detailGroups.push(m)}this.batches.clear()}
 matrix(p,scale=new THREE.Vector3(1,1,1),yaw=0){return new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromAxisAngle(UP,yaw),scale)}
 sky(){
  const sunDir=new THREE.Vector3(-.20,.14,1).normalize();this.sunDir=sunDir;
  const sky=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sun:{value:sunDir}},vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vD;uniform vec3 sun;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}void main(){vec3 d=normalize(vD);float h=max(d.y,0.);vec3 c=mix(vec3(.9,.46,.18),vec3(.08,.25,.45),smoothstep(0.,.23,h));float s=max(dot(d,sun),0.);c+=vec3(1.,.58,.2)*pow(s,25.)*.18;c=mix(c,vec3(1.,.87,.62),smoothstep(.99965,.99983,s));vec2 uv=d.xz/(max(.11,d.y))*.65;float n=noise(uv*3.)*.6+noise(uv*7.)*.3+noise(uv*16.)*.1;float cloud=smoothstep(.59,.74,n)*smoothstep(.10,.23,h)* (1.-smoothstep(.45,.78,h));c=mix(c,vec3(.82,.77,.69),cloud*.65);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  this.skyMesh=this.add(new THREE.SphereGeometry(8000,48,24),sky);this.skyMesh.castShadow=false;this.skyMesh.frustumCulled=false;
  this.scene.fog=new THREE.Fog('#a7b8b4',180,2300);
  const hemi=new THREE.HemisphereLight('#aacfee','#9c7047',.35);this.scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffdc9c',3.1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.near=.5;sun.shadow.camera.far=350;sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;sun.shadow.radius=3;this.scene.add(sun,sun.target);this.sun=sun;
 }
 road(){
  const t=this.track;const pos=[],uv=[],ind=[],colors=[];
  // Same indexed ribbon is queried as the road collider; no independent flat collider.
  for(let i=0;i<=t.count;i++)for(const d of [-t.width/2,t.width/2]){const f=t.at(i*t.step,d);pos.push(f.p.x,f.p.y,f.p.z);uv.push(d/5.7,i*t.step/5.7);const c=.9+.1*Math.sin(i*.037);colors.push(c,c,c)}
  for(let i=0;i<t.count;i++){const a=i*2;ind.push(a,a+2,a+1,a+1,a+2,a+3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(ind);g.computeVertexNormals();
  const mat=this.mat('asphalt',0xc0c4c2,{vertexColors:true,roughness:.95});this.roadMesh=this.add(g,mat);this.roadMesh.castShadow=false;
  this.ribbon(-t.width/2+.18,.12,this.mat('plaster','#efe8cb'),.018);this.ribbon(t.width/2-.18,.12,this.mat('plaster','#efe8cb'),.018);
  const dashmat=this.mat('plaster','#dfd9be');const dashgeo=new THREE.PlaneGeometry(.13,4,1,8);dashgeo.rotateX(-Math.PI/2);
  for(let s=10;s<t.length;s+=12){const f=t.at(s);f.p.y+=.022;this.batch('road-dashes',dashgeo,dashmat,this.matrix(f.p,new THREE.Vector3(1,1,1),f.yaw))}
  this.flush();
 }
 ribbon(offset,width,mat,height=.025,from=0,to=1){const t=this.track,p=[],uv=[],idx=[];let n=0;for(let s=from*t.length;s<=to*t.length+2;s+=2){for(const d of [offset-width/2,offset+width/2]){const f=t.at(s,d);p.push(f.p.x,f.p.y+height,f.p.z);uv.push(d*2,s*.1)}if(n>0){let a=(n-1)*2;idx.push(a,a+2,a+1,a+1,a+2,a+3)}n++}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=this.add(g,mat);m.castShadow=false;return m}
 terrain(){
  const t=this.track,g=t.makeHeightfield(),pos=[],uv=[],colors=[],idx=[];
  const sand=new THREE.Color('#baa476'),grass=new THREE.Color('#717d41'),rock=new THREE.Color('#948a70');
  for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++){const x=g.minX+i*g.size,z=g.minZ+j*g.size,h=g.heights[j*g.nx+i];pos.push(x,h,z);uv.push(x/7,z/7);let c=sand.clone().lerp(grass,smooth(-305,-140,x));c.lerp(rock,smooth(20,65,h)*.55);c.multiplyScalar(.84+.16*Math.sin(x*.07)*Math.sin(z*.08));colors.push(c.r,c.g,c.b);if(i<g.nx-1&&j<g.nz-1){const a=j*g.nx+i;idx.push(a,a+g.nx,a+1,a+1,a+g.nx,a+g.nx+1)}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();
  const mat=this.mat('sand','#ffffff',{vertexColors:true});mat.normalScale.set(.7,.7);const mesh=this.add(geo,mat);mesh.castShadow=false;this.terrainMesh=mesh;
 }
 update(time,focus){this.time.value=time;if(focus){this.skyMesh.position.copy(focus);const lightAnchor=focus.clone();lightAnchor.x=Math.round(lightAnchor.x/1)*1;lightAnchor.z=Math.round(lightAnchor.z/1)*1;this.sun.target.position.copy(lightAnchor);this.sun.position.copy(lightAnchor).addScaledVector(this.sunDir,190)}for(const fn of this.animated)fn(time)}
}
