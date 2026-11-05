import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
export class Post{
 constructor(renderer,scene,camera){this.composer=new EffectComposer(renderer);this.composer.addPass(new RenderPass(scene,camera));this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.10,.3,1.25);this.composer.addPass(this.bloom);this.motion=new ShaderPass({uniforms:{tDiffuse:{value:null},amount:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float amount;varying vec2 vUv;void main(){vec2 v=(vUv-vec2(.5,.48))*amount;vec4 c=texture2D(tDiffuse,vUv)*.60;c+=texture2D(tDiffuse,vUv-v)*.25;c+=texture2D(tDiffuse,vUv-v*2.)*.15;gl_FragColor=c;}'});this.composer.addPass(this.motion);this.composer.addPass(new OutputPass());}
 render(speed,high){this.bloom.enabled=high;this.motion.enabled=high;this.motion.uniforms.amount.value=Math.max(0,speed-15)*.00007;this.composer.render();}
 resize(width,height,ratio){this.composer.setPixelRatio(ratio);this.composer.setSize(width,height);}
}
