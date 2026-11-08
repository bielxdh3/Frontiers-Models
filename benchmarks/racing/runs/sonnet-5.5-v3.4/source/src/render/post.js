// Post-processing: HDR render target (MSAA) -> bloom -> tone mapping (ACES) + sRGB output.
// Motion blur (camera-only, car masked) and ambient occlusion are added in later passes.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Speed blur: radial zoom blur that grows towards the screen edges and is zero around the player's car (centre) -> the car and the HUD (DOM) stay sharp.
const BLUR = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.54) }, uAspect: { value: 1.78 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uStrength, uAspect; uniform vec2 uCenter; varying vec2 vUv;
    void main(){
      vec2 d = vUv - uCenter; float r = length(vec2(d.x * uAspect, d.y));
      float m = smoothstep(0.34, 0.95, r) * uStrength;
      vec3 c = vec3(0.0);
      for (int i = 0; i < 9; i++) { float t = float(i) / 8.0; c += texture2D(tDiffuse, uCenter + d * (1.0 - m * 0.085 * t)).rgb; }
      gl_FragColor = vec4(c / 9.0, 1.0);
    }`,
};

// Colour grade in linear HDR, before tone mapping: gentle contrast about mid-grey, saturation, warm highlights / cool shadows, vignette.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uContrast: { value: 1.30 }, uSat: { value: 1.22 }, uClarity: { value: 0.42 }, uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) }, uShadow: { value: new THREE.Vector3(0.90, 0.98, 1.10) }, uHigh: { value: new THREE.Vector3(1.10, 1.0, 0.84) }, uVig: { value: 0.32 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uContrast, uSat, uVig, uClarity; uniform vec2 uTexel; uniform vec3 uShadow, uHigh; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      { vec3 b = (texture2D(tDiffuse, vUv + vec2(uTexel.x * 2.0, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(uTexel.x * 2.0, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y * 2.0)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y * 2.0)).rgb) * 0.25;
        float lc = dot(c, vec3(0.2126, 0.7152, 0.0722)), lb = dot(b, vec3(0.2126, 0.7152, 0.0722)); float lk = clamp(lc + (lc - lb) * uClarity, 0.0, lc * 1.6 + 0.05); c *= lk / max(lc, 1e-4); }
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = 0.18 * pow(max(c, vec3(1e-4)) / 0.18, vec3(uContrast));
      c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSat);
      float sh = 1.0 - smoothstep(0.0, 0.30, l), hi = smoothstep(0.30, 1.6, l);
      c *= mix(vec3(1.0), uShadow, sh) * mix(vec3(1.0), uHigh, hi);
      vec2 q = vUv - 0.5; c *= 1.0 - uVig * dot(q, q) * 1.6;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, q, size) {
  const w = size.w, h = size.h;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.msaa, colorSpace: THREE.LinearSRGBColorSpace });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  const render = new RenderPass(scene, camera);
  composer.addPass(render);
  let bloom = null;
  if (q.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.5, 1.1);
    composer.addPass(bloom);
  }
  const blur = new ShaderPass(BLUR); blur.enabled = false;
  if (q.motionBlur) composer.addPass(blur);
  const grade = new ShaderPass(GRADE); grade.uniforms.uTexel.value.set(1 / w, 1 / h);
  composer.addPass(grade);
  const output = new OutputPass();
  composer.addPass(output);
  return {
    composer, render, bloom, output, grade, blur,
    setSize(w, h) { composer.setSize(w, h); grade.uniforms.uTexel.value.set(1 / w, 1 / h); },
    setMotion(k, aspect) { if (!q.motionBlur) return; blur.enabled = k > 0.02; blur.uniforms.uStrength.value = k; blur.uniforms.uAspect.value = aspect; },
    setCamera(c) { render.camera = c; },
    renderFrame(dt) { composer.render(dt); },
    dispose() { composer.dispose(); rt.dispose(); },
  };
}
