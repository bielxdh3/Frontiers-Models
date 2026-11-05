import * as THREE from 'three';
export function createOcean(terrain,sunDirection){
 const heights=new THREE.DataTexture(terrain.heights,terrain.cols,terrain.rows,THREE.RedFormat,THREE.FloatType);heights.minFilter=heights.magFilter=THREE.LinearFilter;heights.needsUpdate=true;
 const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},sun:{value:sunDirection},heightMap:{value:heights},bounds:{value:new THREE.Vector4(terrain.minX,terrain.minZ,(terrain.cols-1)*terrain.resolution,(terrain.rows-1)*terrain.resolution)},foamRocks:{value:Array.from({length:24},()=>new THREE.Vector3(100000,100000,0))}},
  vertexShader:`uniform float time;varying vec3 world;void main(){vec3 p=position;p.z+=sin(p.x*.017+p.y*.024+time*.7)*.13+sin(p.x*.035-p.y*.018+time)*.08;vec4 w=modelMatrix*vec4(p,1.);world=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform float time;uniform vec3 sun;uniform sampler2D heightMap;uniform vec4 bounds;uniform vec3 foamRocks[24];varying vec3 world;
  float wave(vec2 p){p+=vec2(sin(p.y*.14+time*.13),sin(p.x*.09-p.y*.07))*2.;return sin(p.x*.42+p.y*.11+time*1.6)*.055+sin(p.x*.19-p.y*.29+time*.9)*.065+sin(p.x*1.14+p.y*.36+time*2.1)*.012+sin(p.x*8.5+p.y*6.2+time*3.2)*.012+sin(p.x*18.1-p.y*4.9+time*4.1)*.006;}
  float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec2 uv=(world.xz-bounds.xy)/bounds.zw;float height=texture2D(heightMap,clamp(uv,0.,1.)).r;if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)height=-20.;float depth=max(0.,.13-height),w=wave(world.xz);float dx=(wave(world.xz+vec2(.02,0))-w)/.02,dz=(wave(world.xz+vec2(0,.02))-w)/.02;vec3 n=normalize(vec3(-dx*1.8,1.,-dz*1.8)),view=normalize(cameraPosition-world),r=reflect(-view,n);float fresnel=.025+.975*pow(1.-max(dot(n,view),0.),5.);vec3 deep=vec3(.008,.075,.12),shallow=vec3(.055,.28,.24);vec3 water=mix(shallow,deep,smoothstep(0.,12.,depth));vec3 sky=mix(vec3(.10,.21,.28),vec3(.43,.58,.67),clamp(r.y*2.8,0.,1.));vec3 color=mix(water,sky,fresnel*.35+.08);float glint=pow(max(dot(r,sun),0.),420.);color+=vec3(2.6,1.8,.75)*glint;float shore=1.-smoothstep(.1,1.7,depth);float wash=.5+.5*sin(depth*7.-time*1.3+sin(world.z*.22)*.8);float foam=shore*smoothstep(.45,.8,wash)*(.65+.35*noise(floor(world.xz*7.)));for(int i=0;i<24;i++){float dist=length(world.xz-foamRocks[i].xy)-foamRocks[i].z;foam=max(foam,(1.-smoothstep(.0,1.5,abs(dist)))*(.5+.5*sin(dist*5.-time*2.+world.z)));}foam*=smoothstep(.18,.74,noise(floor(world.xz*18.)));color*=.88+.12*dot(n,sun);color=mix(color,vec3(.76,.83,.76),clamp(foam*.90,0.,1.));float distance=length(cameraPosition-world);color=mix(color,vec3(.56,.66,.69),smoothstep(550.,5000.,distance));gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(16000,16000,250,250),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(0,.13,0);mesh.name='Mediterranean water';mesh.userData.surface='water';return{mesh,update(t){material.uniforms.time.value=t;},setRocks(rocks){for(let i=0;i<Math.min(24,rocks.length);i++)material.uniforms.foamRocks.value[i].set(rocks[i].position.x,rocks[i].position.z,rocks[i].radius*.65);}};
}



