// Procedural vegetation: 5 species (stone pine, olive, palm, flowering shrub, grass tufts), alpha-card foliage with
// hand-drawn 1024px atlases (generated in code), tapered/curved bark trunks, outward-facing normals for volume lighting,
// instanced per spatial chunk with two LODs and wind sway. No cone+cylinder trees.
import * as THREE from 'three';
import { chainPatch } from './common.js';
import { loadTexture2D } from './textures.js';
import { getProc } from './proctex.js';
import { rng } from '../core/util.js';

const cv = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });

// ------------------------------------------------------------------------------------------------ foliage atlases
function atlas(kind, seed) {
  const R = rng(seed), c = cv(1024, 1024), g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  if (kind === 'pine') {
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 520; i++) {
      const x = R() * 1024, y = R() * 1024, a0 = R() * Math.PI * 2, n = 16 + (R() * 8 | 0), len = 55 + R() * 75;
      const base = [hsl(100 + R() * 14, 38 + R() * 14, 17 + R() * 11), hsl(88 + R() * 10, 42 + R() * 12, 25 + R() * 12)][R() < 0.78 ? 0 : 1];
      g.strokeStyle = base; g.lineWidth = 1.6 + R() * 1.4;
      for (let k = 0; k < n; k++) { const a = a0 + (k - n / 2) * 0.1 + (R() - 0.5) * 0.09, l = len * (0.7 + R() * 0.4); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
  } else if (kind === 'olive') {
    for (let i = 0; i < 1500; i++) {
      const x = R() * 1024, y = R() * 1024, a = R() * Math.PI * 2, l = 40 + R() * 34, up = R() < 0.55;
      g.save(); g.translate(x, y); g.rotate(a); g.scale(1, 0.24);
      g.fillStyle = up ? hsl(72 + R() * 14, 22 + R() * 10, 27 + R() * 10) : hsl(70 + R() * 20, 12 + R() * 10, 58 + R() * 14);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, l * 0.9, l, 0); g.quadraticCurveTo(l * 0.5, -l * 0.9, 0, 0); g.fill(); g.restore();
    }
  } else if (kind === 'palm') {
    // one frond along the horizontal axis: rachis + pinnate leaflets (tip at the right)
    const midY = 512, N = 62;
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1), x = 36 + t * 930, y = midY + Math.sin(t * Math.PI) * -24 + t * t * 40;
      const len = 250 * (1 - t * 0.9) + 26, ang = 0.95 - t * 0.55;
      for (const sd of [-1, 1]) {
        g.strokeStyle = hsl(98 + R() * 12, 48 + R() * 12, 22 + t * 12 + R() * 8); g.lineWidth = 9 - t * 5;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len * 0.4, y + sd * len * 0.45 * Math.cos(ang), x + len * 0.78, y + sd * len * Math.sin(ang) * 0.85 + 18); g.stroke();
      }
    }
    g.strokeStyle = hsl(75, 38, 30); g.lineWidth = 8; g.beginPath(); g.moveTo(20, midY + 0); for (let k = 0; k <= 40; k++) { const t = k / 40; g.lineTo(36 + t * 930, midY + Math.sin(t * Math.PI) * -24 + t * t * 40); } g.stroke();
  } else if (kind === 'shrub' || kind === 'flower') {
    for (let i = 0; i < 520; i++) {
      const x = R() * 1024, y = R() * 1024, a = R() * Math.PI * 2, l = 34 + R() * 26;
      g.save(); g.translate(x, y); g.rotate(a); g.scale(1, 0.34);
      g.fillStyle = hsl(104 + R() * 20, 38 + R() * 14, 20 + R() * 14); g.beginPath(); g.arc(0, 0, l / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(-l * 0.12, -l * 0.1, l * 0.22, 0, Math.PI * 2); g.fill(); g.restore();
    }
    if (kind === 'flower') for (let i = 0; i < 90; i++) {
      const x = R() * 1024, y = R() * 1024, r = 12 + R() * 9; const col = R() < 0.5 ? hsl(335, 70 + R() * 20, 70 + R() * 15) : hsl(0, 0, 92);
      g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'hsl(48,80%,60%)'; g.beginPath(); g.arc(x, y, r * 0.28, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < 520; i++) {
      const x = R() * 1024, h = 160 + R() * 700, lean = (R() - 0.5) * 140, w = 3 + R() * 5;
      g.fillStyle = R() < 0.5 ? hsl(60 + R() * 20, 36 + R() * 20, 38 + R() * 18) : hsl(88 + R() * 16, 32 + R() * 12, 30 + R() * 12);
      g.beginPath(); g.moveTo(x - w, 1024); g.quadraticCurveTo(x + lean * 0.3, 1024 - h * 0.55, x + lean, 1024 - h); g.quadraticCurveTo(x + lean * 0.3 + w, 1024 - h * 0.5, x + w, 1024); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------------------------------------ geometry helpers
class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, vv, col) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, vv); this.c.push(col[0], col[1], col[2]); return this.p.length / 3 - 1; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** tapered tube along a polyline of Vector3 */
function tube(b, pts, radii, seg, col, uvTile = 1) {
  const base = b.p.length / 3, up = V(0, 1, 0);
  let acc = 0;
  for (let k = 0; k < pts.length; k++) {
    const t = k < pts.length - 1 ? pts[k + 1].clone().sub(pts[k]) : pts[k].clone().sub(pts[k - 1]); t.normalize();
    let a = new THREE.Vector3().crossVectors(t, up); if (a.lengthSq() < 1e-4) a.set(1, 0, 0); a.normalize();
    const bb = new THREE.Vector3().crossVectors(t, a).normalize();
    if (k > 0) acc += pts[k].distanceTo(pts[k - 1]);
    for (let j = 0; j <= seg; j++) {
      const ang = (j / seg) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
      const nx = a.x * c + bb.x * s, ny = a.y * c + bb.y * s, nz = a.z * c + bb.z * s;
      b.v(pts[k].x + nx * radii[k], pts[k].y + ny * radii[k], pts[k].z + nz * radii[k], nx, ny, nz, (j / seg) * Math.PI * 2 * radii[0] * uvTile, acc * uvTile, col);
    }
  }
  for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j < seg; j++) { const a = base + k * (seg + 1) + j, c = a + seg + 1; b.i.push(a, c, a + 1, a + 1, c, c + 1); }
}
/** foliage card: centre c, size w x h, spanned by axes ax/ay, shading normal n */
function card(b, c, ax, ay, w, h, n, uv, col) {
  const i0 = b.p.length / 3;
  const corners = [[-1, -1, uv[0], uv[1]], [1, -1, uv[2], uv[1]], [1, 1, uv[2], uv[3]], [-1, 1, uv[0], uv[3]]];
  for (const [sx, sy, u, v] of corners) b.v(c.x + ax.x * w * 0.5 * sx + ay.x * h * 0.5 * sy, c.y + ax.y * w * 0.5 * sx + ay.y * h * 0.5 * sy, c.z + ax.z * w * 0.5 * sx + ay.z * h * 0.5 * sy, n.x, n.y, n.z, u, v, col);
  b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}
/** scatter cards on a squashed sphere/dome */
function blob(b, centre, rx, ry, rz, count, cw, ch, R, uvRect, col, { domeOnly = false, up = 0.35 } = {}) {
  for (let k = 0; k < count; k++) {
    let x, y, z;
    do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1 || (domeOnly && y < -0.15));
    const pos = V(centre.x + x * rx, centre.y + y * ry, centre.z + z * rz);
    const nrm = V(x * 0.9, y * 0.9 + up, z * 0.9).normalize();
    const ax = new THREE.Vector3().crossVectors(nrm, V(0, 1, 0)); if (ax.lengthSq() < 0.01) ax.set(1, 0, 0); ax.normalize();
    const roll = R() * Math.PI * 2; ax.applyAxisAngle(nrm, roll);
    const ay = new THREE.Vector3().crossVectors(nrm, ax).normalize();
    const sc = 0.75 + R() * 0.6;
    const ao = 0.58 + 0.55 * Math.min(1, Math.max(0, (y + 0.45) / 1.25)) * (0.75 + 0.25 * Math.min(1, Math.hypot(x, z) + 0.2));
    const col2 = [col[0] * ao * (0.88 + R() * 0.24), col[1] * ao * (0.88 + R() * 0.24), col[2] * ao * (0.88 + R() * 0.24)];
    const u0 = R() * (1 - (uvRect[2] - uvRect[0])), v0 = R() * (1 - (uvRect[3] - uvRect[1]));
    card(b, pos, ax, ay, cw * sc, ch * sc, nrm, [u0, v0, u0 + (uvRect[2] - uvRect[0]), v0 + (uvRect[3] - uvRect[1])], col2);
  }
}

// ------------------------------------------------------------------------------------------------ species builders (lod 0 / 1)
function buildPine(lod, seed) {
  const R = rng(seed), H = 10.5 + R() * 2, trunk = new Buf(), leaf = new Buf();
  const pts = [], rad = [];
  const sway = V((R() - 0.5) * 1.2, 0, (R() - 0.5) * 1.2);
  const rings = lod === 0 ? 14 : 6;
  for (let k = 0; k <= rings; k++) { const t = k / rings; pts.push(V(sway.x * Math.sin(t * 2.2) * t, t * H, sway.z * Math.sin(t * 2.2 + 1) * t)); rad.push(0.36 * (1 - t * 0.62) + 0.04); }
  tube(trunk, pts, rad, lod === 0 ? 10 : 6, [1, 1, 1], 0.9);
  const top = pts[pts.length - 1];
  const clusters = lod === 0 ? 7 : 4;
  for (let k = 0; k < clusters; k++) {
    const a = R() * Math.PI * 2, d = k === 0 ? 0 : 1.2 + R() * 2.2;
    const c = V(top.x + Math.cos(a) * d, top.y - 1.7 + R() * 2.0 - (k === 0 ? 0 : 0.2), top.z + Math.sin(a) * d);
    if (k > 0) tube(trunk, [V(top.x * 0.9, top.y - 2.6 - R() * 2, top.z * 0.9), V((top.x + c.x) / 2, (top.y + c.y) / 2 - 1.1, (top.z + c.z) / 2), c.clone().add(V(0, -0.3, 0))], [0.1, 0.07, 0.045], 5, [1, 1, 1], 0.9);
    blob(leaf, c, 2.3, 0.85, 2.3, lod === 0 ? 84 : 20, lod === 0 ? 1.2 : 2.3, lod === 0 ? 0.95 : 1.9, R, [0, 0, 0.5, 0.5], [1.0, 1.02, 0.92], { domeOnly: true, up: 0.8 });
  }
  return { trunk: trunk.geo(), leaf: leaf.geo(), height: H + 2, radius: 4.2 };
}
function buildOlive(lod, seed) {
  const R = rng(seed), trunk = new Buf(), leaf = new Buf();
  const stems = lod === 0 ? 3 : 2;
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + R(), out = 0.5 + R() * 0.9, h = 2.4 + R() * 1.2;
    const pts = [], rad = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(V(Math.cos(a) * out * t * t + Math.sin(t * 5 + s) * 0.12, t * h, Math.sin(a) * out * t * t + Math.cos(t * 4 + s) * 0.12)); rad.push(0.22 * (1 - t * 0.45) + (k === 0 ? 0.08 : 0)); }
    tube(trunk, pts, rad, lod === 0 ? 9 : 5, [1, 1, 1], 1.1);
  }
  blob(leaf, V(0, 3.5, 0), 2.5, 1.55, 2.5, lod === 0 ? 330 : 60, lod === 0 ? 0.78 : 1.5, lod === 0 ? 0.56 : 1.05, R, [0, 0, 0.5, 0.5], [0.95, 1.0, 0.88], { up: 0.2 });
  return { trunk: trunk.geo(), leaf: leaf.geo(), height: 5.6, radius: 2.8 };
}
function buildPalm(lod, seed) {
  const R = rng(seed), trunk = new Buf(), leaf = new Buf(), H = 7 + R() * 2.5;
  const pts = [], rad = [], lean = V((R() - 0.5) * 0.9, 0, (R() - 0.5) * 0.9);
  const rings = lod === 0 ? 16 : 7;
  for (let k = 0; k <= rings; k++) { const t = k / rings; pts.push(V(lean.x * t * t, t * H, lean.z * t * t)); rad.push(0.23 * (1 - t * 0.3) + (k === 0 ? 0.05 : 0)); }
  tube(trunk, pts, rad, lod === 0 ? 10 : 6, [1, 1, 1], 0.6);
  const top = pts[pts.length - 1], nF = lod === 0 ? 16 : 9, segs = lod === 0 ? 7 : 4;
  for (let f = 0; f < nF; f++) {
    const ang = (f / nF) * Math.PI * 2 + R() * 0.3, len = 3.3 + R() * 1.2, elev = 0.2 + R() * 0.9;
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    const P0 = top.clone(), P1 = top.clone().addScaledVector(dir, len * 0.55).add(V(0, len * (0.55 + elev * 0.3), 0)), P2 = top.clone().addScaledVector(dir, len).add(V(0, -len * (0.12 + R() * 0.2), 0));
    const side = new THREE.Vector3().crossVectors(dir, V(0, 1, 0)).normalize();
    const i0 = leaf.p.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, a = (1 - t) * (1 - t), b2 = 2 * (1 - t) * t, c = t * t;
      const p = V(a * P0.x + b2 * P1.x + c * P2.x, a * P0.y + b2 * P1.y + c * P2.y, a * P0.z + b2 * P1.z + c * P2.z);
      const w = (lod === 0 ? 1.0 : 1.35) * (1 - t * 0.55) * (0.5 + Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * 0.5);
      const nrm = V(0, 1, 0).add(dir.clone().multiplyScalar(0.3)).normalize();
      leaf.v(p.x - side.x * w, p.y - side.y * w - 0.05 * t, p.z - side.z * w, nrm.x, nrm.y, nrm.z, t, 0.0, [1, 1, 1]);
      leaf.v(p.x + side.x * w, p.y + side.y * w - 0.05 * t, p.z + side.z * w, nrm.x, nrm.y, nrm.z, t, 1.0, [1, 1, 1]);
    }
    for (let s = 0; s < segs; s++) { const a = i0 + s * 2; leaf.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return { trunk: trunk.geo(), leaf: leaf.geo(), height: H + 2.5, radius: 4.2 };
}
function buildShrub(lod, seed) {
  const R = rng(seed), leaf = new Buf(); blob(leaf, V(0, 0.55, 0), 0.95, 0.62, 0.95, lod === 0 ? 70 : 24, lod === 0 ? 0.62 : 0.95, lod === 0 ? 0.45 : 0.7, R, [0, 0, 0.5, 0.5], [0.95, 1.0, 0.9], { domeOnly: true, up: 0.5 });
  return { trunk: null, leaf: leaf.geo(), height: 1.3, radius: 1.1 };
}
function buildGrass(lod, seed) {
  const R = rng(seed), leaf = new Buf(); const n = lod === 0 ? 6 : 3;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI + R() * 0.3, ax = V(Math.cos(a), 0, Math.sin(a)), ay = V(0, 1, 0), w = 0.55 + R() * 0.3, h = 0.45 + R() * 0.3;
    card(leaf, V((R() - 0.5) * 0.35, h / 2, (R() - 0.5) * 0.35), ax, ay, w, h, V(0, 1, 0), [0, 0, 1, 1], [0.95 + R() * 0.1, 0.95 + R() * 0.1, 0.9]);
  }
  return { trunk: null, leaf: leaf.geo(), height: 0.8, radius: 0.5 };
}

export const SPECIES = ['pine', 'olive', 'palm', 'shrub', 'grass'];
const BUILDERS = { pine: buildPine, olive: buildOlive, palm: buildPalm, shrub: buildShrub, grass: buildGrass };

// ------------------------------------------------------------------------------------------------ the system
export class Vegetation {
  constructor(world, lighting, materials, quality) {
    this.world = world; this.lighting = lighting; this.materials = materials; this.q = quality;
    this.group = new THREE.Group(); this.group.name = 'vegetation';
    this.time = { value: 0 };
    this.chunks = [];
    this.stats = { instances: 0, species: {} };
  }

  async init() {
    const procs = getProc();
    const flowerAtlas = atlas('flower', 505);
    this.atlases = { pine: atlas('pine', 101), olive: atlas('olive', 202), palm: atlas('palm', 303), shrub: atlas('shrub', 404), flower: flowerAtlas, grass: atlas('grass', 606) };
    const aniso = 8;
    const [pineBark, pineBarkN, palmBark, palmBarkN, oliveBark, oliveBarkN] = await Promise.all([
      loadTexture2D('pine_bark', 'albedo', { aniso }), loadTexture2D('pine_bark', 'normal', { aniso }),
      loadTexture2D('palm_tree_bark', 'albedo', { aniso }), loadTexture2D('palm_tree_bark', 'normal', { aniso }),
      loadTexture2D('bark_brown_02', 'albedo', { aniso }), loadTexture2D('bark_brown_02', 'normal', { aniso }),
    ]);
    const msaa = this.q.msaa > 0;
    const leafMat = (tex, name, tint) => {
      const m = new THREE.MeshStandardMaterial({ color: tint, map: tex, normalMap: procs.grainN, normalScale: new THREE.Vector2(0.15, 0.15), alphaTest: 0.4, alphaToCoverage: msaa, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, vertexColors: true });
      m.name = name;
      const self = this;
      chainPatch(m, this.lighting, (shader) => {
        shader.uniforms.uTimeW = this.time;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTimeW;').replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float wph = uTimeW * 1.6 + instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
            float wamp = clamp(position.y * 0.0075, 0.0, 0.07);
            transformed.x += sin(wph) * wamp * (1.0 + 0.5 * sin(wph * 2.3 + position.z));
            transformed.z += cos(wph * 0.9 + position.x) * wamp * 0.7;
          #endif`);
      }, 'leaf-v1');
      this.materials.audit.push({ name, material: m, near: true });
      return m;
    };
    const barkMat = (map, nmap, name) => {
      map.repeat.set(0.6, 0.6); nmap.repeat.set(0.6, 0.6);
      const m = new THREE.MeshStandardMaterial({ map, normalMap: nmap, normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.92, metalness: 0, vertexColors: true });
      m.name = name; chainPatch(m, this.lighting, null, 'bark-v1' + name); this.materials.audit.push({ name, material: m, near: true }); return m;
    };
    this.mats = {
      pineLeaf: leafMat(this.atlases.pine, 'foliage-pine', 0xffffff), oliveLeaf: leafMat(this.atlases.olive, 'foliage-olive', 0xffffff), palmLeaf: leafMat(this.atlases.palm, 'foliage-palm', 0xffffff),
      shrubLeaf: leafMat(this.atlases.shrub, 'foliage-shrub', 0xffffff), flowerLeaf: leafMat(this.atlases.flower, 'foliage-flower', 0xffffff), grassLeaf: leafMat(this.atlases.grass, 'foliage-grass', 0xffffff),
      pineBark: barkMat(pineBark, pineBarkN, 'bark-pine'), palmBark: barkMat(palmBark, palmBarkN, 'bark-palm'), oliveBark: barkMat(oliveBark, oliveBarkN, 'bark-olive'),
    };
    // geometry variants (3 per species per LOD)
    this.geo = {};
    for (const sp of SPECIES) {
      this.geo[sp] = [];
      for (let v = 0; v < (sp === 'grass' || sp === 'shrub' ? 3 : 4); v++) this.geo[sp].push([BUILDERS[sp](0, 1000 * SPECIES.indexOf(sp) + v * 7 + 3), BUILDERS[sp](1, 1000 * SPECIES.indexOf(sp) + v * 7 + 3)]);
    }
    let tris = 0; for (const sp of SPECIES) { const g = this.geo[sp][0][0]; tris += (g.leaf.index.count + (g.trunk ? g.trunk.index.count : 0)) / 3; }
    this.stats.trisPerSpeciesLOD0 = Math.round(tris / SPECIES.length);
  }

  /** place instances: list of {sp, x, y, z, s (scale), rot, tint:[r,g,b], flower:bool}; builds chunked instanced meshes */
  build(list) {
    const CH = 140, groups = new Map();
    for (const it of list) {
      const key = SPECIES.indexOf(it.sp) + '|' + Math.floor(it.x / CH) + '|' + Math.floor(it.z / CH) + '|' + (it.v % this.geo[it.sp].length) + (it.flower ? 'f' : '');
      let g = groups.get(key); if (!g) groups.set(key, g = { sp: it.sp, v: it.v % this.geo[it.sp].length, flower: !!it.flower, items: [], cx: 0, cz: 0 }); g.items.push(it);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (const g of groups.values()) {
      const parts = [];
      const [g0, g1] = this.geo[g.sp][g.v];
      const leafMat = g.flower ? this.mats.flowerLeaf : this.mats[g.sp + 'Leaf'];
      const barkMat = g.sp === 'pine' ? this.mats.pineBark : g.sp === 'palm' ? this.mats.palmBark : this.mats.oliveBark;
      let cx = 0, cz = 0; for (const it of g.items) { cx += it.x; cz += it.z; } cx /= g.items.length; cz /= g.items.length;
      const chunk = { cx, cz, near: [], far: [], radius: 0, sp: g.sp };
      for (const lod of [0, 1]) {
        const geo = lod === 0 ? g0 : g1;
        const meshes = [];
        for (const part of ['leaf', 'trunk']) {
          const geom = geo[part]; if (!geom) continue;
          const im = new THREE.InstancedMesh(geom, part === 'leaf' ? leafMat : barkMat, g.items.length);
          g.items.forEach((it, k) => {
            q.setFromAxisAngle(up, it.rot); p.set(it.x, it.y, it.z); sc.set(it.s * (it.sx || 1), it.s, it.s * (it.sx || 1));
            m4.compose(p, q, sc); im.setMatrixAt(k, m4);
            col.setRGB(it.tint[0], it.tint[1], it.tint[2]); im.setColorAt(k, col);
          });
          im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
          im.castShadow = lod === 0; im.receiveShadow = true; im.matrixAutoUpdate = false;
          meshes.push(im); this.group.add(im);
        }
        (lod === 0 ? chunk.near : chunk.far).push(...meshes);
        for (const im of meshes) im.visible = lod === 0;
      }
      let rmax = 0; for (const it of g.items) rmax = Math.max(rmax, Math.hypot(it.x - cx, it.z - cz) + 8 * it.s); chunk.radius = rmax;
      this.chunks.push(chunk);
      this.stats.instances += g.items.length; this.stats.species[g.sp] = (this.stats.species[g.sp] || 0) + g.items.length;
    }
  }

  update(t, camera) {
    this.time.value = t;
    const cx = camera.position.x, cz = camera.position.z;
    const low = this.q.name === 'low', nearD = low ? 105 : 150, DIST = low ? { grass: 110, shrub: 190, olive: 520, palm: 520, pine: 560 } : { grass: 170, shrub: 300, olive: 800, palm: 800, pine: 900 };
    for (const c of this.chunks) {
      const dx = c.cx - cx, dz = c.cz - cz, d2 = dx * dx + dz * dz;
      const dEdge = Math.max(0, Math.sqrt(d2) - c.radius), hide = DIST[c.sp] || 600;
      const isNear = dEdge < Math.min(nearD, hide), isFar = !isNear && dEdge < hide;
      for (const m of c.near) m.visible = isNear;
      for (const m of c.far) m.visible = isFar;
    }
  }
}
