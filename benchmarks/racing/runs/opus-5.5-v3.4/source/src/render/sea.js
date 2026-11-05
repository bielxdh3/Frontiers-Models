// Sea: camera-centred radial grid out to the horizon, Gerstner swell in several
// frequencies, procedural ripples, depth-based colour/transparency (sea floor
// from the terrain heightfield), sky reflection from the shared atmosphere
// model, sun glitter path, animated shore foam bands, foam around rocks.
import * as THREE from 'three';
import { NOISE_GLSL } from './sky.js';

const WAVES = [
  // dirX, dirZ, wavelength, amplitude, steepness
  [0.22, -0.97, 34, 0.26, 0.55],
  [-0.35, -0.94, 15, 0.11, 0.6],
  [0.55, -0.83, 9, 0.05, 0.5],
  [-0.7, -0.71, 5.5, 0.025, 0.45],
  [0.05, -1.0, 70, 0.22, 0.25],
];

export function createSea(atmGLSL, terrain, foamMask) {
  // depth texture (sea floor height) at 4 m
  const SD = 2, w = Math.ceil(terrain.nx / SD), h = Math.ceil(terrain.nz / SD);
  const floor = new Uint16Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) floor[j * w + i] = THREE.DataUtils.toHalfFloat(terrain.h[Math.min(terrain.nz - 1, j * SD) * terrain.nx + Math.min(terrain.nx - 1, i * SD)]);
  const floorTex = new THREE.DataTexture(floor, w, h, THREE.RedFormat, THREE.HalfFloatType);
  floorTex.magFilter = THREE.LinearFilter; floorTex.minFilter = THREE.LinearFilter; floorTex.needsUpdate = true;
  // radial grid
  const rings = 150, seg = 220;
  const pos = [], ind = [];
  pos.push(0, 0, 0);
  for (let r = 0; r < rings; r++) {
    const rad = 1.5 * Math.pow(1.065, r) - 1.0;
    for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; pos.push(Math.cos(a) * rad, 0, Math.sin(a) * rad); }
  }
  // last ring pushed to the horizon
  const lastR = 1.5 * Math.pow(1.065, rings - 1);
  for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; pos.push(Math.cos(a) * 14000, 0, Math.sin(a) * 14000); }
  for (let k = 0; k < seg; k++) ind.push(0, 1 + ((k + 1) % seg), 1 + k);
  for (let r = 0; r < rings; r++) for (let k = 0; k < seg; k++) {
    const a = 1 + r * seg + k, b = 1 + r * seg + ((k + 1) % seg), c = 1 + (r + 1) * seg + k, d = 1 + (r + 1) * seg + ((k + 1) % seg);
    ind.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(ind);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20000);
  void lastR;
  const wv = WAVES.map(([dx, dz, L, A, Q]) => { const l = Math.hypot(dx, dz); const k = (2 * Math.PI) / L; return new THREE.Vector4(dx / l, dz / l, k, A); });
  const wq = WAVES.map(([, , L, , Q]) => new THREE.Vector2(Q, Math.sqrt(9.81 * ((2 * Math.PI) / L))));
  const mat = new THREE.ShaderMaterial({
    name: 'sea',
    uniforms: {
      uTime: { value: 0 }, uWaves: { value: wv }, uWaveQ: { value: wq }, tFloor: { value: floorTex }, tFoam: { value: foamMask },
      uTerr: { value: new THREE.Vector4(terrain.x0, terrain.z0, terrain.x1 - terrain.x0, terrain.z1 - terrain.z0) }, uSunI: { value: 40 },
      uRocks: { value: Array.from({ length: 48 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec4 uWaves[5]; uniform vec2 uWaveQ[5]; uniform sampler2D tFloor; uniform vec4 uTerr;
      varying vec3 vW; varying vec3 vN; varying float vDepth; varying float vCrest;
      float floorAt(vec2 xz) { vec2 uv = (xz - uTerr.xy) / uTerr.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -40.0; return texture2D(tFloor, uv).r; }
      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        float fl = floorAt(p.xz);
        float depth = max(0.0, -fl);
        float att = 0.25 + 0.75 * smoothstep(0.3, 7.0, depth);
        vec3 o = vec3(0.0); vec3 n = vec3(0.0, 1.0, 0.0); float crest = 0.0;
        for (int i = 0; i < 5; i++) {
          vec2 D = uWaves[i].xy; float k = uWaves[i].z; float A = uWaves[i].w * att; float Q = uWaveQ[i].x; float om = uWaveQ[i].y;
          float th = k * dot(D, p.xz) - om * uTime;
          float c = cos(th), s = sin(th);
          o.x += Q * A * D.x * c; o.z += Q * A * D.y * c; o.y += A * s;
          n.x -= D.x * k * A * c; n.z -= D.y * k * A * c; n.y -= Q * k * A * s;
          crest += max(0.0, s) * A;
        }
        // waves fade out with distance (no aliasing near the horizon)
        float dist = length(p.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(400.0, 2500.0, dist);
        p += o * fade;
        vW = p; vN = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(n), fade)); vDepth = depth; vCrest = crest * fade;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D tFoam; uniform vec4 uTerr; uniform float uSunI; uniform sampler2D tFloor; uniform vec4 uRocks[48];
      varying vec3 vW; varying vec3 vN; varying float vDepth; varying float vCrest;
      ${atmGLSL}
      ${NOISE_GLSL}
      float floorAtF(vec2 xz) { vec2 uv = (xz - uTerr.xy) / uTerr.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -40.0; return texture2D(tFloor, uv).r; }
      vec2 rippleGrad(vec2 p) {
        float e = 0.08;
        float a = vnoise(p), b = vnoise(p + vec2(e, 0.0)), c = vnoise(p + vec2(0.0, e));
        return vec2(b - a, c - a) / e;
      }
      float foamTex(vec2 p) {
        float n = vnoise(p * 1.7) * 0.55 + vnoise(p * 4.3 + 3.1) * 0.3 + vnoise(p * 11.0) * 0.15;
        return smoothstep(0.42, 0.7, n);
      }
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        // detail ripples (fade with distance)
        float df = 1.0 - smoothstep(30.0, 600.0, dist);
        vec2 g1 = rippleGrad(vW.xz * 0.55 + vec2(uTime * 0.25, uTime * 0.18));
        vec2 g2 = rippleGrad(vW.xz * 1.6 - vec2(uTime * 0.4, -uTime * 0.31));
        vec3 N = normalize(vN + vec3(g1.x * 0.12 + g2.x * 0.06, 0.0, g1.y * 0.12 + g2.y * 0.06) * df);
        float depth = max(0.0, vW.y - floorAtF(vW.xz));
        // distant facets tilt towards the viewer: soften grazing Fresnel with distance
        vec3 Nf = normalize(N + V * 0.35 * smoothstep(40.0, 900.0, dist));
        float cosT = clamp(dot(Nf, V), 0.0, 1.0);
        float F = (0.02 + 0.98 * pow(1.0 - cosT, 5.0)) * 0.58;
        // a film of water over sand does not mirror the sky like open water: wet sand shows through
        F *= mix(0.3, 1.0, smoothstep(0.03, 0.6, depth));
        vec3 R = reflect(-V, N); R.y = max(R.y, 0.03);
        vec3 refl = atmSky(normalize(R + vec3(0.0, 0.06, 0.0))) * 0.7;
        // sun glitter path
        float sd = max(dot(R, ATM_SUN_DIR), 0.0);
        vec3 sunSpec = ATM_SUN_TINT * (pow(sd, 900.0) * uSunI + pow(sd, 90.0) * 1.6 + pow(sd, 12.0) * 0.12);
        // water body colour by depth (absorption)
        vec3 shallow = vec3(0.1, 0.44, 0.42), deep = vec3(0.012, 0.06, 0.11);
        float dk = 1.0 - exp(-depth * 0.32);
        vec3 body = mix(shallow, deep, dk);
        // lit by sky/sun (scattering)
        vec3 amb = ATM_ZENITH * 0.6 + ATM_HOR_SUN * 0.15;
        body *= amb * 1.4 + ATM_SUN_TINT * 0.35 * max(ATM_SUN_DIR.y + 0.2, 0.0);
        float alpha = 1.0 - exp(-depth * 0.85);
        // foam: shore bands moving in, swash line, rocks, crests
        // the beach is very flat (3.5 %): foam only in the last ~13 m, as thin swash lines running in
        float shore = 1.0 - smoothstep(0.03, 0.5, depth);
        float bands = sin(depth * 16.0 - uTime * 1.3 + vnoise(vW.xz * 0.08) * 5.0) * 0.5 + 0.5;
        float ft = foamTex(vW.xz * 0.9 + vec2(0.0, uTime * 0.12));
        float ft2 = foamTex(vW.xz * 2.3 - vec2(uTime * 0.07, 0.0));
        float foam = shore * smoothstep(0.8, 0.97, bands) * (0.45 + 0.8 * ft);
        // swash line: thin bright foam right at the water edge, broken by noise
        float edge = (1.0 - smoothstep(0.0, 0.32, depth)) * smoothstep(0.0, 0.03, depth + 0.02);
        foam = max(foam, edge * (0.62 + 0.6 * ft2));
        vec2 fuv = (vW.xz - uTerr.xy) / uTerr.zw;
        float rockF = texture2D(tFoam, fuv).r * 0.5;
        for (int i = 0; i < 48; i++) {
          vec4 rk = uRocks[i];
          if (rk.z <= 0.0) continue;
          float dd = length(vW.xz - rk.xy) - rk.z;
          float contact = 1.0 - smoothstep(0.0, 0.8 + rk.z * 0.25, dd);    // white band hugging the rock
          float ring = 1.0 - smoothstep(0.2, 3.6 + rk.z * 1.0, dd);          // wider, broken, pulsing
          float pulse = 0.55 + 0.45 * sin(uTime * 1.6 + rk.x * 0.3 - dd * 2.2);
          rockF = max(rockF, max(contact * 0.95, ring * pulse * 0.9));
        }
        float brk = smoothstep(0.18, 0.62, vnoise(vW.xz * 1.6 + uTime * 0.7) * 0.55 + ft * 0.65);
        foam = max(foam, rockF * (0.45 + 0.55 * brk) * 1.15);
        // whitecaps only where the water is deep enough to break (not across the shallow sand flat)
        foam = max(foam, smoothstep(0.18, 0.32, vCrest) * ft * 0.35 * (1.0 - smoothstep(60.0, 300.0, dist)) * smoothstep(1.5, 4.0, depth));
        foam = clamp(foam, 0.0, 1.0);
        vec3 foamCol = (ATM_SUN_TINT * 0.9 * max(0.25, dot(N, ATM_SUN_DIR) + 0.4) + amb * 1.2) * 0.95;
        // compose (premultiplied by alpha blending)
        float a = clamp(1.0 - (1.0 - alpha) * (1.0 - F), 0.0, 1.0);
        vec3 col = (body * alpha * (1.0 - F) + refl * F + sunSpec) / max(a, 0.001);
        col = mix(col, foamCol, foam); a = max(a, foam * 0.95);
        // aerial perspective
        float fogF = atmFogAmount(cameraPosition, vW);
        col = mix(col, atmFogColor(-V), fogF); a = mix(a, 1.0, fogF);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: true, fog: false,
  });
  mat.userData.audit = 'water';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sea'; mesh.frustumCulled = false; mesh.renderOrder = 1;
  mesh.userData.audit = { kind: 'water', exempt: 'water' };
  mesh.userData.rocks = [];
  let lastRockSort = -1;
  mesh.userData.update = (cam, t) => {
    mesh.position.set(Math.round(cam.position.x / 4) * 4, 0, Math.round(cam.position.z / 4) * 4);
    mat.uniforms.uTime.value = t;
    // nearest water rocks for analytic foam rings (re-sorted ~4x per second)
    if (mesh.userData.rocks.length && (t - lastRockSort > 0.25 || lastRockSort < 0)) {
      lastRockSort = t;
      const cx = cam.position.x, cz = cam.position.z;
      const arr = mesh.userData.rocks.map((r) => [r, (r[0] - cx) ** 2 + (r[1] - cz) ** 2]).sort((a, b) => a[1] - b[1]);
      const u = mat.uniforms.uRocks.value;
      for (let i = 0; i < 48; i++) { const r = arr[i]; if (r) u[i].set(r[0][0], r[0][1], r[0][2], 0); else u[i].set(0, 0, 0, 0); }
    }
  };
  return mesh;
}

/** foam mask texture over the terrain extent; stamp(x, z, r) paints radial foam */
export function createFoamMask(terrain) {
  const SD = 2, w = Math.ceil(terrain.nx / SD), h = Math.ceil(terrain.nz / SD);
  const data = new Uint8Array(w * h);
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  tex.userData.src = 'foam-mask';
  const cell = terrain.cell * SD;
  tex.stamp = (x, z, r) => {
    const ci = (x - terrain.x0) / cell, cj = (z - terrain.z0) / cell, rr = (r + 3.5) / cell;
    for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const d = Math.hypot(i - ci, j - cj) * cell;
      const v = d < r ? 1 : Math.max(0, 1 - (d - r) / 3.5);
      data[j * w + i] = Math.max(data[j * w + i], Math.round(v * 255));
    }
    tex.needsUpdate = true;
  };
  return tex;
}
