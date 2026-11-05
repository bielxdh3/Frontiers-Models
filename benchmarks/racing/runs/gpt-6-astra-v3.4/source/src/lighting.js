import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
export async function setupLighting(scene,renderer){
 const source=await new RGBELoader().loadAsync('assets/sunset.hdr');source.mapping=THREE.EquirectangularReflectionMapping;
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(source).texture;scene.environmentIntensity=.42;scene.environmentRotation.y=1.0;source.dispose();pmrem.dispose();
 const sunDirection=new THREE.Vector3(-.22,.14,.96).normalize();
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,64,32),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,uniforms:{sun:{value:sunDirection}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection;uniform vec3 sun;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec3 d=normalize(vDirection);float y=max(d.y,0.);vec3 warm=vec3(.96,.77,.56),blue=vec3(.22,.49,.71);vec3 c=mix(warm,blue,1.-exp(-y*4.8));float s=max(dot(d,sun),0.);c+=vec3(.2,.095,.025)*pow(s,16.);c+=vec3(.4,.20,.055)*pow(s,110.);float disk=smoothstep(.99991,.99996,s);c=mix(c,vec3(1.,.96,.76),disk);vec2 cp=d.xz/(d.y+.24)*3.;float cloud=noise(cp)*.55+noise(cp*2.1)*.28+noise(cp*4.2)*.17;cloud=smoothstep(.66,.80,cloud)*smoothstep(.12,.26,d.y);c=mix(c,vec3(.84,.75,.65),cloud*.27);gl_FragColor=vec4(pow(c,vec3(2.2)),1.);}`}));sky.name='Atmospheric sky';sky.userData.exempt='sky';scene.add(sky);
 const sun=new THREE.DirectionalLight('#ffdbab',3.0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const d=48;Object.assign(sun.shadow.camera,{left:-d,right:d,top:d,bottom:-d,near:1,far:460});sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=2;scene.add(sun,sun.target);
 const fill=new THREE.HemisphereLight('#8ab9d4','#403728',.30);scene.add(fill);
 scene.fog=new THREE.Fog('#c6d3d0',210,1550);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 return{sun,sky,sunDirection,update(position){const texel=96/sun.shadow.mapSize.x,snapped=new THREE.Vector3(Math.round(position.x/texel)*texel,Math.round(position.y/texel)*texel,Math.round(position.z/texel)*texel);sun.position.copy(snapped).addScaledVector(sunDirection,250);sun.target.position.copy(snapped);sky.position.copy(position);},quality(high){sun.shadow.mapSize.set(high?2048:1024,high?2048:1024);sun.shadow.map?.dispose();sun.shadow.map=null;}};
}


