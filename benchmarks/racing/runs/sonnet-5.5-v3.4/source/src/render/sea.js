// Sea: camera-centred radial mesh (dense near, sparse far), multi-frequency waves (vertex + analytic normals),
// depth-driven colour (turquoise shallows -> deep blue), animated shore foam, sun glitter from the PBR sun + sky reflection from the HDRI.
import * as THREE from 'three';
import { chainPatch } from './common.js';
import { GLSL_NOISE } from './shaders.js';

const DEPTH_REGION = { x0: -1000, x1: 1500, z0: -120, z1: 1000, w: 1024, h: 512 };

export class Sea {
  constructor(world, lighting, env, quality) {
    this.time = { value: 0 };
    // ---- depth texture (terrain height; negative = below sea level)
    const R = DEPTH_REGION, data = new Uint16Array(R.w * R.h * 4);
    const toHalf = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < R.h; j++) for (let i = 0; i < R.w; i++) {
      const x = R.x0 + (i + 0.5) * (R.x1 - R.x0) / R.w, z = R.z0 + (j + 0.5) * (R.z1 - R.z0) / R.h;
      const h = world.terrain.sample(x, z);
      const k = (j * R.w + i) * 4;
      data[k] = toHalf(h); data[k + 1] = toHalf(h); data[k + 2] = toHalf(h); data[k + 3] = toHalf(1);
    }
    this.depthTex = new THREE.DataTexture(data, R.w, R.h, THREE.RGBAFormat, THREE.HalfFloatType);
    this.depthTex.minFilter = this.depthTex.magFilter = THREE.LinearFilter; this.depthTex.wrapS = this.depthTex.wrapT = THREE.ClampToEdgeWrapping; this.depthTex.needsUpdate = true;
    // ---- mesh
    const RINGS = quality.seaRings ?? 140, SEG = quality.seaSeg ?? 192, r0 = 1.5, rMax = 16000;
    const ratio = Math.pow(rMax / r0, 1 / (RINGS - 1));
    const pos = new Float32Array((RINGS * SEG + 1) * 3), idx = [];
    for (let i = 0; i < RINGS; i++) {
      const r = r0 * Math.pow(ratio, i);
      for (let j = 0; j < SEG; j++) { const a = (j / SEG) * Math.PI * 2; const o = (i * SEG + j) * 3; pos[o] = Math.cos(a) * r; pos[o + 1] = 0; pos[o + 2] = Math.sin(a) * r; }
    }
    const c = RINGS * SEG; pos[c * 3] = 0; pos[c * 3 + 1] = 0; pos[c * 3 + 2] = 0;
    for (let j = 0; j < SEG; j++) idx.push(c, (j + 1) % SEG, j);
    for (let i = 0; i < RINGS - 1; i++) for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b = i * SEG + (j + 1) % SEG, cc = (i + 1) * SEG + j, d = (i + 1) * SEG + (j + 1) % SEG;
      idx.push(a, b, cc, b, d, cc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), rMax); g.boundingBox = new THREE.Box3(new THREE.Vector3(-rMax, -5, -rMax), new THREE.Vector3(rMax, 5, rMax));
    const m = new THREE.MeshStandardMaterial({ color: 0x0a4a66, roughness: 0.06, metalness: 0, transparent: true, depthWrite: false, side: THREE.FrontSide });
    m.name = 'sea-water';
    m.envMap = env.envTarget.texture; m.envMapIntensity = 0.5; m.envMapRotation.set(0, -env.rotY, 0);
    const U = {
      uTime: this.time, tDepth: { value: this.depthTex }, uCam: { value: new THREE.Vector3() },
      uDepthRect: { value: new THREE.Vector4(R.x0, R.z0, R.x1 - R.x0, R.z1 - R.z0) },
      uRocks: { value: Array.from({ length: 48 }, () => new THREE.Vector4(0, 0, 0, 0)) },     // x, z, radius, 1 = active (white water ring around rocks)
    };
    this.rockU = U.uRocks;
    chainPatch(m, lighting, (shader) => {
      Object.assign(shader.uniforms, U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${WAVES}\nuniform float uTime; uniform vec3 uCam; varying vec3 vWP;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wpos0 = modelMatrix * vec4(transformed, 1.0);
          float distC = length(wpos0.xz - uCam.xz);
          vec3 ws0 = waveSum(wpos0.xz, uTime, distC);
          transformed.y += ws0.x;`)
        .replace('#include <project_vertex>', `#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${WAVES}\n${GLSL_NOISE}\nuniform float uTime; uniform vec3 uCam; uniform sampler2D tDepth; uniform vec4 uDepthRect; uniform vec4 uRocks[48]; varying vec3 vWP;\nfloat gFoam; float gDep;`)
        .replace('#include <map_fragment>', `
          {
            vec2 P2 = vWP.xz;
            float distC = length(P2 - uCam.xz);
            vec3 wv = waveSum(P2, uTime, distC);
            vec2 uvD = (P2 - uDepthRect.xy) / uDepthRect.zw;
            float inside = step(0.0, uvD.x) * step(uvD.x, 1.0) * step(0.0, uvD.y) * step(uvD.y, 1.0);
            float th = texture2D(tDepth, uvD).r;
            float dep = mix(60.0, -th, inside) + wv.x;
            gDep = dep;
            // colour by depth (turquoise shallows -> deep blue), absorption
            vec3 shallow = vec3(0.16, 0.58, 0.55), mid = vec3(0.04, 0.30, 0.42), deep = vec3(0.012, 0.085, 0.17);
            float tD = 1.0 - exp(-max(dep, 0.0) * 0.30);
            vec3 wc = mix(shallow, mid, smoothstep(0.0, 0.55, tD));
            wc = mix(wc, deep, smoothstep(0.45, 0.98, tD));
            wc *= 0.88 + 0.24 * fbm3(P2 * 0.06 + uTime * 0.02);
            // shore foam: swash line that breathes with the waves + lacy noise, plus faint crest foam far out
            float sw = 0.34 + 0.26 * sin(uTime * 0.9 + P2.x * 0.045 + fbm3(P2 * 0.03) * 5.0) + 0.12 * sin(uTime * 1.9 + P2.x * 0.13);
            float lace = fbm2(P2 * 1.25 + vec2(0.0, -uTime * 0.35));
            float band = smoothstep(sw + 0.55, sw * 0.4, dep) * smoothstep(-0.05, 0.12, dep);
            float foam = clamp(band * smoothstep(0.30, 0.72, lace + 0.35 * band), 0.0, 1.0);
            float edge = smoothstep(0.30, 0.0, dep) * smoothstep(-0.06, 0.02, dep);
            foam = max(foam, edge * 0.85);
            if (distC < 520.0) {
              float rf = 0.0;
              for (int k = 0; k < 48; k++) {
                vec4 rk = uRocks[k]; if (rk.w < 0.5) break;
                float dd = length(P2 - rk.xy), rad = rk.z * 0.95;
                float swell = 0.55 + 0.45 * sin(uTime * 0.8 + rk.x * 0.31 + rk.y * 0.17);
                float ring = smoothstep(rad + 3.4 * swell + 0.6, rad + 0.2, dd) * smoothstep(rad * 0.55, rad * 0.95, dd);
                float lc = fbm2(P2 * 1.9 + vec2(uTime * 0.22, -uTime * 0.18));
                rf = max(rf, clamp(ring * smoothstep(0.18, 0.62, lc + 0.55 * ring), 0.0, 1.0));
              }
              foam = max(foam, rf);
            }
            float crest = smoothstep(0.17, 0.30, wv.x * 1.4 + 0.12 * lace - 0.02) * (1.0 - smoothstep(200.0, 700.0, distC)) * smoothstep(3.0, 7.0, dep);
            foam = clamp(max(foam, crest * 0.35), 0.0, 1.0);
            gFoam = foam;
            diffuseColor.rgb = mix(wc, vec3(0.92, 0.94, 0.95) * (0.85 + 0.2 * lace), foam);
            diffuseColor.a = clamp(1.0 - exp(-max(dep, 0.0) * 1.15), 0.0, 1.0);
            diffuseColor.a = max(diffuseColor.a, foam * 0.95);
            diffuseColor.a *= step(-0.02, dep);
          }`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.05, 0.55, gFoam);')
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 wv2 = waveSum(vWP.xz, uTime, length(vWP.xz - uCam.xz));
            // fine ripples (animated gradient of a noise field)
            vec2 q = vWP.xz * 0.55 + vec2(uTime * 0.21, uTime * 0.12);
            float e = 0.12;
            float n0 = fbm3(q), nx = fbm3(q + vec2(e, 0.0)), nz = fbm3(q + vec2(0.0, e));
            float rip = 0.55 * (1.0 - smoothstep(60.0, 380.0, length(vWP.xz - uCam.xz))) * (1.0 - gFoam);
            vec3 nW = normalize(vec3(-wv2.y - (nx - n0) / e * 0.22 * rip, 1.0, -wv2.z - (nz - n0) / e * 0.22 * rip));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          }`);
    }, 'sea-v1');
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.renderOrder = 1; this.mesh.name = 'sea';
    this.uCam = U.uCam;
  }
  /** rocks standing in the water: [{x, z, r}] (max 48) get an animated ring of white water */
  setRocks(list) { this.rockU.value.forEach((v) => v.set(0, 0, 0, 0)); list.slice(0, 48).forEach((r, k) => this.rockU.value[k].set(r.x, r.z, r.r, 1)); }
  update(t, camera) {
    this.time.value = t;
    this.mesh.position.set(camera.position.x, 0, camera.position.z);
    this.uCam.value.copy(camera.position);
  }
}

const WAVES = /* glsl */`
const vec4 WV[5] = vec4[5](vec4(0.15, -1.0, 62.0, 0.21), vec4(-0.30, -0.90, 33.0, 0.115), vec4(0.55, -0.80, 17.5, 0.058), vec4(0.90, -0.40, 9.5, 0.030), vec4(-0.70, -0.70, 5.2, 0.015));
// returns (height, dh/dx, dh/dz); short waves fade with distance (they would alias)
vec3 waveSum(vec2 p, float t, float dist) {
  float h = 0.0; vec2 g = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    vec2 d = normalize(WV[i].xy);
    float L = WV[i].z, k = 6.2831853 / L, w = sqrt(9.81 * k);
    float fade = (i < 2) ? 1.0 : 1.0 - smoothstep(L * 14.0, L * 55.0, dist);
    float A = WV[i].w * fade;
    float ph = k * dot(d, p) - w * t + float(i) * 1.7;
    h += A * sin(ph); g += A * k * cos(ph) * d;
  }
  return vec3(h, g);
}`;
