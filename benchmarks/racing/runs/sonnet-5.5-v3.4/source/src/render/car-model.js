// Two procedural cars (GT coupe + hot hatch): lofted smooth bodies with carved wheel arches, greenhouse with real glass,
// separate PBR materials (clearcoat paint, glass, chrome, rubber, matte plastic, emissive lamps, brake discs, calipers...).
import * as THREE from 'three';
import { profile, loftBody, mergeGeoms, buildTire, buildRim, buildDisc, buildCaliper, makeBlobTexture } from './car-geometry.js';
import { CAR_SPECS, LIVERIES } from '../physics/car-specs.js';
import { chainPatch } from './common.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ------------------------------------------------------------------------------------------- designs
const DESIGNS = {
  gt: {
    L: 4.55, frontOverhang: 0.88,
    yb: [[-2.275, 0.32], [-2.24, 0.20], [-2.15, 0.145], [-1.9, 0.14], [-1.0, 0.15], [0.8, 0.16], [1.6, 0.18], [2.0, 0.23], [2.2, 0.30], [2.275, 0.40]],
    yt: [[-2.275, 0.50], [-2.24, 0.555], [-2.15, 0.60], [-2.0, 0.665], [-1.6, 0.735], [-1.1, 0.785], [-0.82, 0.84], [-0.55, 0.905], [0.9, 0.915], [1.35, 0.965], [1.55, 0.985], [1.9, 0.97], [2.15, 0.90], [2.275, 0.78]],
    w: [[-2.275, 0.72], [-2.24, 0.80], [-2.15, 0.88], [-1.9, 0.935], [-1.5, 0.955], [-0.9, 0.95], [0.0, 0.93], [0.9, 0.95], [1.5, 0.965], [1.9, 0.95], [2.15, 0.90], [2.275, 0.76]],
    n: [[-2.275, 3.2], [-2.0, 3.8], [-1.0, 4.3], [1.0, 4.3], [2.0, 3.8], [2.275, 3.2]],
    sill: 0.075, flare: 0.022,
    cabin: {
      z0: -0.86, z1: 1.40, n: 2.9, belt: 0.91,
      roof: [[-0.86, 0.84], [-0.7, 1.0], [-0.5, 1.14], [-0.28, 1.245], [-0.05, 1.29], [0.4, 1.30], [0.7, 1.265], [1.0, 1.15], [1.25, 1.03], [1.4, 0.975]],
      wBelt: [[-0.86, 0.84], [-0.6, 0.885], [0.2, 0.905], [0.9, 0.88], [1.4, 0.78]],
      wRoof: [[-0.86, 0.64], [-0.4, 0.60], [0.4, 0.60], [1.0, 0.54], [1.4, 0.46]],
      win: { side: [-0.18, 1.06], ws: [-0.80, -0.18], rear: [0.82, 1.28] },
    },
    wheel: { Rr: 0.254, tireW: [0.255, 0.295], spokes: 10, style: 0, disc: 0.165 },
    headY: 0.66, tailY: 0.88, hasWing: true, splitter: true,
  },
  hatch: {
    L: 4.0, frontOverhang: 0.80,
    yb: [[-2.0, 0.34], [-1.96, 0.22], [-1.85, 0.175], [-1.5, 0.17], [0.8, 0.19], [1.6, 0.20], [1.9, 0.26], [2.0, 0.36]],
    yt: [[-2.0, 0.52], [-1.93, 0.60], [-1.7, 0.70], [-1.3, 0.785], [-0.95, 0.845], [-0.62, 0.93], [1.5, 0.95], [1.82, 0.985], [1.95, 0.93], [2.0, 0.84]],
    w: [[-2.0, 0.70], [-1.96, 0.78], [-1.85, 0.865], [-1.6, 0.915], [-0.8, 0.92], [0.6, 0.92], [1.4, 0.92], [1.8, 0.90], [1.95, 0.84], [2.0, 0.72]],
    n: [[-2.0, 3.2], [-1.7, 3.8], [-0.8, 4.2], [1.2, 4.2], [1.8, 3.8], [2.0, 3.2]],
    sill: 0.06, flare: 0.028,
    cabin: {
      z0: -0.98, z1: 1.97, n: 3.0, belt: 0.93,
      roof: [[-0.98, 0.845], [-0.82, 0.99], [-0.55, 1.19], [-0.25, 1.37], [0.05, 1.43], [1.0, 1.45], [1.35, 1.425], [1.62, 1.31], [1.82, 1.14], [1.97, 0.96]],
      wBelt: [[-0.98, 0.84], [-0.7, 0.885], [0.3, 0.9], [1.4, 0.89], [1.97, 0.80]],
      wRoof: [[-0.98, 0.64], [-0.4, 0.62], [0.5, 0.62], [1.4, 0.60], [1.97, 0.56]],
      win: { side: [-0.28, 1.62], ws: [-0.90, -0.30], rear: [1.40, 1.86] },
    },
    wheel: { Rr: 0.229, tireW: [0.225, 0.235], spokes: 5, style: 1, disc: 0.150 },
    headY: 0.68, tailY: 0.90, hasWing: false, splitter: false,
  },
};

// ------------------------------------------------------------------------------------------- shared procedural textures
let _tex = null;
function makeNormalCanvas(size, octaves, strength, seed) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  const h = new Float32Array(size * size);
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let o = 0; o < octaves; o++) {
    const cells = 8 << o, grid = new Float32Array((cells + 1) * (cells + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    // make it tile
    for (let i = 0; i <= cells; i++) { grid[i * (cells + 1) + cells] = grid[i * (cells + 1)]; grid[cells * (cells + 1) + i] = grid[i]; }
    const amp = Math.pow(0.55, o);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = grid[iy * (cells + 1) + ix], b = grid[iy * (cells + 1) + ix + 1], c2 = grid[(iy + 1) * (cells + 1) + ix], d = grid[(iy + 1) * (cells + 1) + ix + 1];
      h[y * size + x] += amp * (a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty);
    }
  }
  const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xm = h[y * size + (x + size - 1) % size], xp = h[y * size + (x + 1) % size], ym = h[((y + size - 1) % size) * size + x], yp = h[((y + 1) % size) * size + x];
    let nx = (xm - xp) * strength, ny = (ym - yp) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * size + x) * 4;
    d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function sharedTextures() {
  if (_tex) return _tex;
  _tex = {
    peel: makeNormalCanvas(1024, 3, 3.2, 11),         // orange-peel clearcoat
    grain: makeNormalCanvas(1024, 4, 5.0, 29),        // matte plastic grain
    rubber: makeNormalCanvas(1024, 5, 7.0, 53),       // rubber micro-relief
    blob: makeBlobTexture(1024),
  };
  return _tex;
}


// ------------------------------------------------------------------------------------------- paint shader: lamps, grille, panel gaps (object space, anti-aliased)
const PAINT_GLSL = {
  vertHeader: `varying vec3 vOP; varying vec3 vON;`,
  vertBody: `vOP = position; vON = normal;`,
  fragHeader: `varying vec3 vOP; varying vec3 vON;
uniform float uL; uniform vec4 uHead; uniform vec4 uTail; uniform float uBrake; uniform vec4 uCab; uniform vec3 uLamp;
float gMaskLamp; float gMaskDark; vec3 gEmis; float gGr; float gFrame;
float rrect(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float aa(float d){ return smoothstep(0.003, -0.003, d); }
float lineZ(float z, float z0, float w){ return smoothstep(w, w * 0.35, abs(z - z0)); }
`,
  fragMap: `{
  vec3 P = vOP; vec3 N = normalize(vON);
  float zF = -uL * 0.5, zB = uL * 0.5, ax = abs(P.x);
  gMaskLamp = 0.0; gMaskDark = 0.0; gEmis = vec3(0.0);
  // --- tail lamps (rear face + wrap-around)
  float tail = aa(rrect(vec2(ax - uTail.x, P.y - uTail.y), uTail.zw, 0.028)) * smoothstep(zB - 0.55, zB - 0.20, P.z) * step(-0.1, N.z + abs(N.x) * 0.8);
  float bars = 0.55 + 0.45 * step(0.5, fract(P.y * 55.0));
  vec3 tailCol = mix(vec3(0.35, 0.0, 0.0), vec3(1.0, 0.05, 0.02), bars);
  gEmis += tail * tailCol * (0.8 + 4.5 * uBrake);
  gMaskLamp += tail;
  // --- head lamps (front face + wrap-around)
  float hd = aa(rrect(vec2(ax - uHead.x, P.y - uHead.y + (ax - uHead.x) * 0.0), uHead.zw, 0.035)) * smoothstep(zF + 0.62, zF + 0.30, P.z) * step(-0.1, -N.z + abs(N.x) * 0.8);
  float ring = 0.65 + 0.35 * smoothstep(0.5, 0.2, abs(fract(length(vec2(ax - uHead.x + 0.12, P.y - uHead.y)) * 9.0) - 0.5));
  gEmis += hd * vec3(1.0, 0.95, 0.85) * (0.9 + 0.6 * ring);
  gMaskLamp += hd;
  // --- grille + intakes (front), diffuser (rear)
  float gr = aa(rrect(vec2(P.x, P.y - 0.40), vec2(0.50, 0.085), 0.03)) * step(0.1, -N.z) * smoothstep(zF + 0.50, zF + 0.25, P.z);
  float in2 = aa(rrect(vec2(ax - 0.64, P.y - 0.28), vec2(0.17, 0.045), 0.02)) * step(0.1, -N.z) * smoothstep(zF + 0.55, zF + 0.25, P.z);
  float dif = smoothstep(0.42, 0.34, P.y) * smoothstep(zB - 0.40, zB - 0.20, P.z) * step(0.1, N.z);
  float slat = 0.3 + 0.7 * smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(P.y * 230.0));
  gGr = gr; gFrame = clamp(aa(rrect(vec2(P.x, P.y - 0.40), vec2(0.515, 0.10), 0.04)) * step(0.1, -N.z) * smoothstep(zF + 0.50, zF + 0.25, P.z) - gr, 0.0, 1.0);
  gMaskDark = max(in2, dif);
  gEmis += 0.0;
  // --- panel gaps / handles (thin dark lines)
  float side = smoothstep(0.55, 0.8, abs(N.x));
  float gap = 0.0;
  float yBand = smoothstep(0.30, 0.34, P.y) * smoothstep(0.92, 0.88, P.y);
  gap += lineZ(P.z, uCab.x, 0.0028) * side * yBand;                     // door front edge
  gap += lineZ(P.z, uCab.y, 0.0028) * side * yBand;                     // door rear edge
  gap += lineZ(P.z, uCab.z, 0.0025) * step(0.7, N.y) * smoothstep(0.9, 0.7, ax);     // bonnet / boot shut line (top)
  gap += lineZ(P.y, 0.30, 0.0024) * side * step(uCab.x, P.z) * step(P.z, uCab.y);    // sill line
  float handle = aa(rrect(vec2(P.z - uCab.w, P.y - 0.82), vec2(0.075, 0.012), 0.01)) * side;
  gMaskDark = max(gMaskDark, clamp(gap * 0.85 + handle * 0.7, 0.0, 1.0) * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), clamp(gMaskLamp * 0.85 + gMaskDark * (gr + in2 + dif > 0.0 ? 0.97 : 1.0), 0.0, 1.0) * clamp(gMaskLamp + gMaskDark, 0.0, 1.0));
  float slatX = 0.55 + 0.45 * step(0.5, fract(P.x * 34.0));
  vec3 grilleCol = mix(vec3(0.012), vec3(0.20, 0.21, 0.23), slat * 0.7 * slatX);
  diffuseColor.rgb = mix(diffuseColor.rgb, grilleCol, gGr);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.70, 0.72, 0.76), gFrame);
}`,
  fragEmissive: `totalEmissiveRadiance += gEmis;`,
  fragRough: `float roughnessFactor = mix(roughness, 0.07, clamp(gMaskLamp, 0.0, 1.0)); roughnessFactor = mix(roughnessFactor, 0.55, clamp(gMaskDark, 0.0, 1.0)); roughnessFactor = mix(roughnessFactor, 0.5, gGr); roughnessFactor = mix(roughnessFactor, 0.16, gFrame);`,
  fragMetal: `float metalnessFactor = mix(metalness, 0.0, clamp(gMaskLamp + gMaskDark + gGr, 0.0, 1.0)); metalnessFactor = mix(metalnessFactor, 1.0, gFrame);`,
};
function paintCustom(uniforms) {
  return (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + PAINT_GLSL.vertHeader).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + PAINT_GLSL.vertBody);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PAINT_GLSL.fragHeader)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + PAINT_GLSL.fragMap)
      .replace('#include <roughnessmap_fragment>', PAINT_GLSL.fragRough)
      .replace('#include <metalnessmap_fragment>', PAINT_GLSL.fragMetal)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + PAINT_GLSL.fragEmissive);
  };
}

// ------------------------------------------------------------------------------------------- materials
export function createCarMaterials(lighting, env, liveryIdx, spec) {
  const T = sharedTextures();
  const liv = LIVERIES[liveryIdx % LIVERIES.length];
  const envMap = env ? env.envTarget.texture : null;
  const mk = (m, custom = null) => { if (envMap) { m.envMap = envMap; if (env.rotY !== undefined) m.envMapRotation.set(0, -env.rotY, 0); } chainPatch(m, lighting, custom, 'car-' + m.type + (custom ? '-paint' : '')); return m; };
  const des = DESIGNS[spec.id];
  const cabz = des.cabin;
  const U = { uL: { value: des.L }, uHead: { value: new THREE.Vector4(0.64, des.headY, 0.20, 0.045) }, uTail: { value: new THREE.Vector4(0.62, des.tailY, 0.27, 0.042) }, uBrake: { value: 0 }, uCab: { value: new THREE.Vector4(cabz.z0 + 0.38, cabz.z0 + 1.28, cabz.z0 + 0.02, cabz.z0 + 1.02) }, uLamp: { value: new THREE.Vector3() } };
  const paint = mk(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(liv.paint), metalness: 0.42, roughness: 0.36, clearcoat: 1.0, clearcoatRoughness: 0.11,
    vertexColors: true, normalMap: T.peel, normalScale: new THREE.Vector2(0.28, 0.28), clearcoatNormalMap: T.peel, clearcoatNormalScale: new THREE.Vector2(0.1, 0.1), envMapIntensity: 0.62,
  }), paintCustom(U));
  paint.name = 'paint-clearcoat';
  paint.userData.uniforms = U;
  const glass = mk(new THREE.MeshPhysicalMaterial({ color: 0x0b1117, metalness: 0.0, roughness: 0.03, transparent: true, opacity: 0.80, clearcoat: 1.0, clearcoatRoughness: 0.0, envMapIntensity: 2.0, side: THREE.FrontSide }));
  glass.name = 'glass';
  const chrome = mk(new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 1.0, roughness: 0.06, normalMap: T.grain, normalScale: new THREE.Vector2(0.08, 0.08), envMapIntensity: 2.2 }));
  chrome.name = 'chrome';
  const rubber = mk(new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0, roughness: 0.82, normalMap: T.rubber, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.6 }));
  rubber.name = 'rubber';
  const plastic = mk(new THREE.MeshStandardMaterial({ color: 0x171717, metalness: 0, roughness: 0.62, normalMap: T.grain, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.9 }));
  plastic.name = 'plastic-matte';
  const head = mk(new THREE.MeshStandardMaterial({ color: 0xdfe9ff, emissive: new THREE.Color(0xfff2d8), emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.08, envMapIntensity: 1.6 }));
  head.name = 'headlamp';
  const tail = mk(new THREE.MeshStandardMaterial({ color: 0x5a0508, emissive: new THREE.Color(0xff1008), emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.15, envMapIntensity: 1.2 }));
  tail.name = 'taillamp';
  const rim = mk(new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1.0, roughness: 0.30, normalMap: T.grain, normalScale: new THREE.Vector2(0.12, 0.12), envMapIntensity: 1.0 }));
  rim.name = 'rim-metal';
  const disc = mk(new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 1.0, roughness: 0.42, normalMap: T.grain, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.2 }));
  disc.name = 'brake-disc';
  const caliper = mk(new THREE.MeshPhysicalMaterial({ color: liv.accent === '#f2f2f2' ? 0xd01820 : 0xe8c020, metalness: 0.2, roughness: 0.4, clearcoat: 0.8, normalMap: T.peel, normalScale: new THREE.Vector2(0.2, 0.2) }));
  caliper.name = 'caliper';
  const interior = mk(new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0, roughness: 0.9, normalMap: T.grain, normalScale: new THREE.Vector2(0.4, 0.4) }));
  interior.name = 'interior-dark';
  const plate = mk(new THREE.MeshStandardMaterial({ color: 0xe9e7df, metalness: 0, roughness: 0.5, normalMap: T.grain, normalScale: new THREE.Vector2(0.15, 0.15) }));
  plate.name = 'plate';
  const accent = mk(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(liv.accent), metalness: 0.2, roughness: 0.4, clearcoat: 0.9, normalMap: T.peel, normalScale: new THREE.Vector2(0.2, 0.2) }));
  accent.name = 'accent-paint';
  return { paint, glass, chrome, rubber, plastic, head, tail, rim, disc, caliper, interior, plate, accent, livery: liv };
}

// ------------------------------------------------------------------------------------------- geometry assembly
function section(des) {
  const yb = profile(des.yb), yt = profile(des.yt), w = profile(des.w), n = profile(des.n);
  return { yb, yt, w, n };
}

/** triangles of a geometry */
const triCount = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** build the static parts (body, cabin, details) for one car: returns {meshes:[{geo,matKey,cast}], tris} */
function buildStatic(spec, des, lod) {
  const L = des.L, zFront = -L / 2;
  const zf = zFront + des.frontOverhang, zr = zf + spec.wheelbase;     // axle z in box coords
  const th = (spec.trackF / 2), tr = (spec.trackR / 2);
  const R = spec.wheelR;
  const sec = section(des);
  const flareF = des.flare, flareR = des.flare;
  const arches = [];
  const tireWF = des.wheel.tireW[0], tireWR = des.wheel.tireW[1];
  for (const side of [-1, 1]) {
    arches.push({ z: zf, y: R, r: R + 0.05, xin: th - tireWF / 2 - 0.055, side });
    arches.push({ z: zr, y: R, r: R + 0.05, xin: tr - tireWR / 2 - 0.055, side });
  }
  const S = lod === 0 ? 190 : lod === 1 ? 70 : 30, M = lod === 0 ? 128 : lod === 1 ? 44 : 22;
  const gaussFlare = z => flareF * Math.exp(-Math.pow((z - zf) / 0.62, 2)) + flareR * Math.exp(-Math.pow((z - zr) / 0.62, 2));
  const bodySect = z => {
    const w = sec.w(z) + gaussFlare(z);
    return { yb: sec.yb(z), yt: sec.yt(z), w, n: sec.n(z), wb: w - des.sill };
  };
  const bulge = z => (z < -0.85 ? 0.028 * Math.min(1, (-0.85 - z) / 0.6) : z > 1.3 ? 0.018 : 0);
  const body = loftBody({ L, S, M, sect: bodySect, arches, bulge });
  const meshes = [];
  meshes.push({ geo: body.geometry, matKey: 'paint', cast: true });

  // ---- greenhouse (glass + frame)
  const cb = des.cabin;
  const roof = profile(cb.roof), wBelt = profile(cb.wBelt), wRoof = profile(cb.wRoof);
  const cL = cb.z1 - cb.z0, cS = lod === 0 ? 70 : lod === 1 ? 32 : 16, cM = lod === 0 ? 56 : lod === 1 ? 28 : 16;
  // cabin loft runs along z from cb.z0 to cb.z1: reuse loftBody with an offset
  const zc = (cb.z0 + cb.z1) / 2;
  const lowerTop = profile(des.yt);
  const cabin = loftBody({
    L: cL, S: cS, M: cM, darkBottom: false,
    sect: zz => {
      const z = zz + zc;                         // loft uses z in [-cL/2, cL/2]
      const top = roof(z);
      const bot = Math.min(lowerTop(z) - 0.05, top - 0.03);
      return { yb: bot, yt: Math.max(top, bot + 0.012), w: wBelt(z), wt: wRoof(z), n: cb.n, wb: wBelt(z) };
    },
  });
  // shift into box coords
  const cpos = cabin.geometry.attributes.position;
  for (let i = 0; i < cpos.count; i++) cpos.setZ(i, cpos.getZ(i) + zc);
  // apply top narrowing (wt) which loftBody supports via sect.wt
  cabin.geometry.computeVertexNormals();
  const { frame, glass } = splitGlass(cabin.geometry, des, roof, wRoof);
  if (typeof location !== 'undefined' && /dev=1/.test(location.search)) console.log('cabin tris', cabin.geometry.index.count / 3, 'glass tris', glass.index ? glass.index.count / 3 : 0, 'frame', frame.index.count / 3);
  meshes.push({ geo: frame, matKey: 'paint', cast: true });
  meshes.push({ geo: glass, matKey: 'glass', cast: false });

  // ---- lamps, grille, details (patches that follow the body surface)
  if (lod < 2) {
    for (const m of detailMeshes(spec, des, zf, zr, L, lod)) meshes.push(m);
  }
  // interior: dashboard, seats, wheel (seen through the glass)
  if (lod === 0) for (const m of interiorMeshes(spec, des, cb)) meshes.push(m);

  let tris = 0; for (const m of meshes) tris += triCount(m.geo);
  return { meshes, tris, zf, zr, th, tr, L };
}

/** separate window glass from the frame of the greenhouse (windows inset by 6 mm so a paint frame remains) */
function splitGlass(geo, des, roof, wRoof) {
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, idx = geo.index.array;
  const frameIdx = [], glassTris = [];
  const win = des.cabin.win;
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f], b = idx[f + 1], c = idx[f + 2];
    const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
    const nx = (nor[a * 3] + nor[b * 3] + nor[c * 3]) / 3, ny = (nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1]) / 3, nz = (nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2]) / 3;
    const roofY = roof(cz), belt = des.cabin.belt ?? 0.93;
    let isGlass = false;
    // side windows
    if (Math.abs(nx) > 0.55 && cz > win.side[0] && cz < win.side[1] && cy > belt + 0.04 && cy < roofY - 0.085) isGlass = true;
    // windshield / rear window (faces looking mostly forward/back and up)
    if (cz > win.ws[0] && cz < win.ws[1] && nz < -0.25 && ny > 0.35 && Math.abs(cx) < wRoof(cz) + 0.17 && cy > belt - 0.07 && Math.abs(cx) < wRoof(cz) + 0.17 * 1.0) isGlass = true;
    if (cz > win.rear[0] && cz < win.rear[1] && nz > 0.25 && ny > 0.25 && Math.abs(cx) < wRoof(cz) + 0.1) isGlass = true;
    if (isGlass) glassTris.push(a, b, c); else frameIdx.push(a, b, c);
  }
  const frame = new THREE.BufferGeometry();
  frame.setAttribute('position', geo.attributes.position); frame.setAttribute('normal', geo.attributes.normal); frame.setAttribute('uv', geo.attributes.uv); frame.setAttribute('color', geo.attributes.color);
  frame.setIndex(frameIdx);
  // glass: duplicate used vertices, push 6 mm inwards along the normal
  const map = new Map(), gp = [], gn = [], gi = [];
  for (const v of glassTris) {
    if (!map.has(v)) { map.set(v, gp.length / 3); gp.push(pos[v * 3] - nor[v * 3] * 0.006, pos[v * 3 + 1] - nor[v * 3 + 1] * 0.006, pos[v * 3 + 2] - nor[v * 3 + 2] * 0.006); gn.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); }
    gi.push(map.get(v));
  }
  const glass = new THREE.BufferGeometry();
  glass.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gp), 3)); glass.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(gn), 3));
  glass.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((gp.length / 3) * 2), 2));
  glass.setIndex(gi);
  return { frame, glass };
}

/** copy the faces of `geo` selected by `pred(cx,cy,cz,nx,ny,nz)` offset along their normals (lens / grille patches) */
function patch(geo, pred, off, maxV = 1e9) {
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, idx = geo.index.array;
  const map = new Map(), P = [], N = [], I = [];
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f], b = idx[f + 1], c = idx[f + 2];
    if (a >= maxV || b >= maxV || c >= maxV) continue;
    const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
    const nx = (nor[a * 3] + nor[b * 3] + nor[c * 3]) / 3, ny = (nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1]) / 3, nz = (nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2]) / 3;
    if (!pred(cx, cy, cz, nx, ny, nz)) continue;
    for (const v of [a, b, c]) {
      if (!map.has(v)) { map.set(v, P.length / 3); P.push(pos[v * 3] + nor[v * 3] * off, pos[v * 3 + 1] + nor[v * 3 + 1] * off, pos[v * 3 + 2] + nor[v * 3 + 2] * off); N.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); }
      I.push(map.get(v));
    }
  }
  if (!I.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((P.length / 3) * 2), 2)); g.setIndex(I);
  return g;
}

function lampPatches(body, des, L, maxV) {
  const out = [];
  const zF = -L / 2, zB = L / 2;
  // headlamps: wrap-around lens on the front corners
  const hy = des.headY;
  const h = patch(body, (x, y, z, nx, ny, nz) => z < zF + 0.62 && Math.abs(x) > 0.36 && Math.abs(x) < 0.90 && y > hy - 0.065 && y < hy + 0.075 && (nz < -0.12 || (Math.abs(nx) > 0.3 && z < zF + 0.3)), 0.004, maxV);
  if (h) out.push({ geo: h, matKey: 'head', cast: false });
  // taillamps
  const ty = des.tailY;
  const t = patch(body, (x, y, z, nx, ny, nz) => z > zB - 0.50 && Math.abs(x) > 0.30 && Math.abs(x) < 0.92 && y > ty - 0.075 && y < ty + 0.035 && (nz > 0.15 || (Math.abs(nx) > 0.35 && z > zB - 0.2)), 0.004, maxV);
  if (t) out.push({ geo: t, matKey: 'tail', cast: false });
  // lower grille / intake (dark plastic patch) and rear diffuser area
  const g = patch(body, (x, y, z, nx, ny, nz) => z < zF + 0.24 && Math.abs(x) < 0.52 && y > 0.24 && y < 0.46 && nz < -0.35, 0.006, maxV);
  if (g) out.push({ geo: g, matKey: 'plastic', cast: false });
  const g2 = patch(body, (x, y, z, nx, ny, nz) => z < zF + 0.34 && Math.abs(x) > 0.40 && Math.abs(x) < 0.82 && y > 0.20 && y < 0.34 && nz < -0.3, 0.005, maxV);
  if (g2) out.push({ geo: g2, matKey: 'plastic', cast: false });
  const d = patch(body, (x, y, z, nx, ny, nz) => z > zB - 0.34 && Math.abs(x) < 0.78 && y < 0.50 && nz > 0.25, 0.006, maxV);
  if (d) out.push({ geo: d, matKey: 'plastic', cast: false });
  return out;
}

function tubeGeo(rad, len, segR = 16, segL = 4, openEnded = true) { const g = new THREE.CylinderGeometry(rad, rad, len, segR, segL, openEnded); return g; }
function capsule(len, r, segs = 10) { return new THREE.CapsuleGeometry(r, len, 4, segs); }

function detailMeshes(spec, des, zf, zr, L, lod) {
  const out = [];
  const zF = -L / 2, zB = L / 2;
  // grille slats (round bars)
  const slats = [];
  for (let k = 0; k < 7; k++) {
    const g = capsule(0.70, 0.0075, 6); g.rotateZ(Math.PI / 2); g.translate(0, 0.27 + k * 0.026, zF + 0.065 + 0.004 * (k % 2)); slats.push(g);
  }
  // exhaust tips
  const ex = [];
  for (const x of [-0.5, 0.5]) { const g = tubeGeo(0.045, 0.14, 20, 2); g.rotateX(Math.PI / 2); g.translate(x, 0.28, zB - 0.02); ex.push(g); }
  out.push({ geo: mergeGeoms(ex.map(withUV)), matKey: 'chrome', cast: false });
  // mirrors
  const mir = [];
  const mz = des.cabin.z0 + 0.52, my = 0.99;
  for (const s of [-1, 1]) { const g = new THREE.SphereGeometry(0.085, 18, 12); g.scale(0.55, 0.62, 1.0); g.translate(s * (des.w[4][1] + 0.12), my, mz); mir.push(g); }
  out.push({ geo: mergeGeoms(mir.map(withUV)), matKey: 'paint', cast: true });
  // door handles / side vents (small capsules)
  const hd = [];
  for (const s of [-1, 1]) { const g = capsule(0.12, 0.012, 8); g.rotateX(Math.PI / 2); g.translate(s * (des.w[6][1] + 0.002), 0.86, des.cabin.z0 + 1.15); hd.push(g); }
  out.push({ geo: mergeGeoms(hd.map(withUV)), matKey: 'chrome', cast: false });
  // licence plates
  const pl = [];
  { const g = new THREE.PlaneGeometry(0.52, 0.12, 6, 2); g.translate(0, 0.55, zB + 0.012); pl.push(g); const g2 = new THREE.PlaneGeometry(0.52, 0.12, 6, 2); g2.rotateY(Math.PI); g2.translate(0, 0.30, zF + 0.04); pl.push(g2); }
  out.push({ geo: mergeGeoms(pl.map(withUV)), matKey: 'plate', cast: false });
  // front splitter / rear lip (extruded aerofoil-like shape, many triangles)
  if (des.splitter) {
    const sp = new THREE.CapsuleGeometry(0.03, 1.55, 3, 10); sp.rotateZ(Math.PI / 2); sp.scale(1, 0.55, 5.0); sp.translate(0, 0.135, zF + 0.04);
    out.push({ geo: withUV(sp), matKey: 'plastic', cast: true });
  }
  // rear wing (aerofoil extruded + endplates + swan-neck stays)
  if (des.hasWing) {
    const shape = new THREE.Shape();
    const pts = [[0, 0], [0.04, 0.035], [0.12, 0.05], [0.24, 0.046], [0.34, 0.025], [0.36, 0.008], [0.34, -0.004], [0.2, -0.002], [0.08, -0.012], [0.0, 0]];
    shape.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) shape.lineTo(p[0], p[1]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
    g.rotateY(Math.PI / 2); g.translate(-0.81, 1.115, zB - 0.52 - 0.04);
    out.push({ geo: withUV(g), matKey: 'accent', cast: true });
    const ep = [];
    for (const s of [-1, 1]) { const e = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }); e.scale(1.5, 4.6, 1); e.translate(-0.5, 0, 0); e.translate(0, 1.07, 0); e.rotateY(0); e.translate(s * 0.81, 0.0, zB - 0.52); ep.push(withUV(e)); }
    // stays
    const st = [];
    for (const s of [-1, 1]) { const g2 = capsule(0.17, 0.016, 8); g2.translate(s * 0.34, 1.03, zB - 0.46); st.push(withUV(g2)); }
    out.push({ geo: mergeGeoms(st), matKey: 'plastic', cast: true });
  } else {
    // roof-end spoiler for the hatch
    const g = new THREE.CapsuleGeometry(0.02, 1.15, 3, 10); g.rotateZ(Math.PI / 2); g.scale(1, 1.4, 5.5); g.translate(0, des.cabin.roof[des.cabin.roof.length - 4][1] + 0.0, des.cabin.z1 - 0.62);
    out.push({ geo: withUV(g), matKey: 'accent', cast: true });
  }
  return out;
}
function withUV(g) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; }

function interiorMeshes(spec, des, cb) {
  const out = [];
  const z0 = cb.z0 + 0.45;
  // dashboard slab, seats (rounded), steering wheel, centre console
  const dash = new THREE.SphereGeometry(0.5, 24, 14); dash.scale(0.82, 0.12, 0.28); dash.translate(0, 0.98, z0 + 0.05);
  const seats = [];
  for (const s of [-1, 1]) {
    const base = new THREE.SphereGeometry(0.28, 20, 14); base.scale(0.85, 0.35, 1.0); base.translate(s * 0.36, 0.6, z0 + 0.9);
    const back = new THREE.SphereGeometry(0.28, 20, 14); back.scale(0.9, 1.15, 0.30); back.translate(s * 0.36, 0.88, z0 + 1.28);
    seats.push(base, back);
  }
  const wheel = new THREE.TorusGeometry(0.17, 0.017, 10, 30); wheel.rotateY(0); wheel.rotateX(-0.28); wheel.translate(-0.36, 0.97, z0 + 0.42);
  const cons = new THREE.SphereGeometry(0.3, 18, 12); cons.scale(0.3, 0.3, 1.3); cons.translate(0, 0.66, z0 + 0.95);
  out.push({ geo: mergeGeoms([dash, ...seats, wheel, cons].map(withUV)), matKey: 'interior', cast: false });
  return out;
}

// ------------------------------------------------------------------------------------------- the model
export class CarModel {
  /**
   * @param {string} carId 'gt' | 'hatch'  @param {number} livery  @param {object} ctx {lighting, env}  @param {number} lod 0 high
   */
  constructor(carId, livery, ctx, lod = 0) {
    this.carId = carId; this.spec = CAR_SPECS[carId]; this.des = DESIGNS[carId]; this.lod = lod;
    this.mats = createCarMaterials(ctx.lighting, ctx.env, livery, this.spec);
    const spec = this.spec, des = this.des;
    const st = buildStatic(spec, des, lod);
    this.root = new THREE.Group(); this.root.name = `car-${carId}-${livery}`;
    this.body = new THREE.Group(); this.root.add(this.body);
    // box-centre origin -> CoM origin: front axle (box) = zf, front axle (physics) = zF
    const zFphys = -(1 - spec.frontWeight) * spec.wheelbase;
    this.zOff = -(st.zf - zFphys);                 // add to box z to get physics-frame z
    const yOff = -spec.cgH + 0.055;                 // ground plane at rest (physics y of ground)
    this.body.position.set(0, yOff, this.zOff);
    this.tris = st.tris;
    for (const m of st.meshes) {
      const mesh = new THREE.Mesh(m.geo, this.mats[m.matKey]);
      mesh.castShadow = m.cast; mesh.receiveShadow = true; mesh.userData.carPart = m.matKey;
      this.body.add(mesh);
    }
    // wheels
    this.wheels = [];
    const wcfg = des.wheel;
    const mirrorMat = new THREE.Matrix4();
    const segTire = lod === 0 ? 72 : lod === 1 ? 36 : 18, segRim = lod === 0 ? 56 : lod === 1 ? 28 : 14;
    for (let wi = 0; wi < 4; wi++) {
      const front = wi < 2, side = (wi % 2 === 0) ? -1 : 1;
      const g = new THREE.Group();
      const tw = front ? wcfg.tireW[0] : wcfg.tireW[1];
      const tire = new THREE.Mesh(buildTire(spec.wheelR, tw, wcfg.Rr + 0.01, segTire), this.mats.rubber); tire.castShadow = true; tire.receiveShadow = true;
      const rimW = tw * 0.82;
      const rim = new THREE.Mesh(buildRim(wcfg.Rr, rimW, wcfg.spokes, segRim, wcfg.style), this.mats.rim); rim.castShadow = true; rim.position.x = tw * 0.04;
      g.add(tire, rim);
      if (lod < 2) {
        const disc = new THREE.Mesh(buildDisc(wcfg.disc, 0.028, segRim), this.mats.disc); disc.position.x = -tw * 0.08; g.add(disc);
        const cal = new THREE.Mesh(buildCaliper(wcfg.disc * 0.98, 0.07, 12), this.mats.caliper); cal.position.x = -tw * 0.08; cal.rotation.x = front ? 0.5 : -0.5 + Math.PI; g.add(cal);
      }
      const holder = new THREE.Group(); holder.add(g);
      if (side < 0) g.scale.x = -1;          // left wheels are mirrored (outer face towards -x)
      holder.rotation.order = 'YXZ';
      this.body.parent.add(holder);
      this.wheels.push({ holder, inner: g, front, side, tw });
    }
    // contact shadow (tessellated so it is never a 2-triangle quad)
    const T = sharedTextures();
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.28, spec.length * 1.12, 6, 10), new THREE.MeshBasicMaterial({ map: T.blob, transparent: true, depthWrite: false, opacity: 0.8, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 2;
    this.blobHolder = new THREE.Group(); this.blobHolder.add(this.blob);
    this.root.matrixAutoUpdate = true;
    this._brake = 0;
  }

  /** pose from the physics vehicle (world transform of the CoM + per-wheel suspension) */
  update(v, dt, { braking = 0 } = {}) {
    this.root.position.set(v.p[0], v.p[1], v.p[2]);
    this.root.quaternion.set(v.q[0], v.q[1], v.q[2], v.q[3]);
    const s = this.spec;
    for (let i = 0; i < 4; i++) {
      const w = v.wheels[i], h = this.wheels[i];
      const hubD = Math.min(Math.max((w.contact ? w.hitDist - s.wheelR : s.susp.rest + s.susp.droop), s.susp.rest - s.susp.maxComp), s.susp.rest + s.susp.droop);
      // wheels hang from the mount point along the body's down axis; lateral position adds the tyre half width offset so the outer face is flush
      h.holder.position.set(w.m[0], w.m[1] - hubD, w.m[2]);
      h.holder.rotation.y = -(h.front ? v.steer : 0);
      h.holder.rotation.x = -w.spin;
    }
    // brake lamps
    const k = braking > 0.05 ? 1 : 0;
    this._brake += (k - this._brake) * Math.min(1, dt * 30);
    this.mats.paint.userData.uniforms.uBrake.value = this._brake;
    // contact shadow: flat tessellated quad on the ground plane under the car (world space)
    let n = 0, ax = 0, ay = 0, az = 0, nx = 0, ny = 0, nz = 0;
    for (const w of v.wheels) { if (w.contact) { n++; ax += w.cp[0]; ay += w.cp[1]; az += w.cp[2]; nx += w.n[0]; ny += w.n[1]; nz += w.n[2]; } }
    this.blobHolder.visible = n > 0;
    if (n > 0) {
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const fwd = v.forward;
      // basis: up = n ; forward' = fwd - n (fwd.n) ; right' = forward' x n
      const d = fwd[0] * nx + fwd[1] * ny + fwd[2] * nz;
      let fx = fwd[0] - nx * d, fy = fwd[1] - ny * d, fz = fwd[2] - nz * d; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      const rx = fy * nz - fz * ny, ry = fz * nx - fx * nz, rz = fx * ny - fy * nx;
      const m = this._m || (this._m = new THREE.Matrix4());
      m.set(rx, nx, -fx, 0, ry, ny, -fy, 0, rz, nz, -fz, 0, 0, 0, 0, 1);       // columns: right, up, back
      this.blobHolder.quaternion.setFromRotationMatrix(m);
      const zc = this.zOff * 0;
      this.blobHolder.position.set(ax / n + nx * 0.025 + fx * 0.04, ay / n + ny * 0.025 + fy * 0.04, az / n + nz * 0.025 + fz * 0.04);
    }
  }
  addTo(scene) { scene.add(this.root); scene.add(this.blobHolder); }
}

export { DESIGNS };
