// Procedural Mediterranean vegetation (own work): palm, stone pine, olive,
// cypress, shrub (incl. flowering oleander) and grass tufts. Trunks are
// tapered/bent tubes with bark PBR textures; foliage uses generated alpha
// textures on curved fronds / card clusters with outward normals.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/rng.js';
import { loadedTextures } from '../render/textures.js';

// textures are rasterised at >= 1024 px per side; drawing code keeps its logical size (w, h)
function cv(w, h) { const W = Math.max(1024, w), H = Math.max(1024, h); const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').setTransform(W / w, 0, 0, H / h, 0, 0); return c; }
function canvasTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.userData.src = 'generated-foliage'; loadedTextures.add(t); return t;
}
const rgb = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

// ---------------- foliage textures ----------------
export function makeFoliageTextures() {
  const R = mulberry32(77);
  // palm frond: rachis along x, leaflets angled outward
  const pf = cv(1024, 256), p = pf.getContext('2d');
  p.clearRect(0, 0, 1024, 256);
  for (let i = 0; i < 150; i++) {
    const t = i / 150; const x = 40 + t * 950; const len = 115 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) + 10;
    for (const side of [-1, 1]) {
      const ang = side * (0.55 + 0.25 * t) + (R() - 0.5) * 0.12;
      const g = 70 + R() * 40, gg = 95 + R() * 50;
      p.strokeStyle = rgb(g * 0.5, gg, g * 0.35); p.lineWidth = 4.5 - t * 2.5; p.lineCap = 'round';
      p.beginPath(); p.moveTo(x, 128); p.quadraticCurveTo(x + Math.cos(ang) * len * 0.5, 128 + Math.sin(ang) * len * 0.45, x + Math.cos(ang) * len * 0.95 + 18, 128 + Math.sin(ang) * len); p.stroke();
    }
  }
  p.strokeStyle = rgb(120, 110, 60); p.lineWidth = 5; p.beginPath(); p.moveTo(20, 128); p.lineTo(1000, 128); p.stroke();
  // stone pine needle clusters
  const pn = cv(512, 512), q = pn.getContext('2d');
  q.clearRect(0, 0, 512, 512);
  for (let c = 0; c < 70; c++) {
    const cx = 40 + R() * 432, cy = 40 + R() * 432, rr = 22 + R() * 38;
    const base = 0.75 + R() * 0.35;
    for (let k = 0; k < 70; k++) {
      const a = R() * Math.PI * 2, l = rr * (0.5 + R() * 0.5);
      q.strokeStyle = rgb(40 * base, (78 + R() * 30) * base, 36 * base); q.lineWidth = 1.6;
      q.beginPath(); q.moveTo(cx, cy); q.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); q.stroke();
    }
  }
  // olive leaves: narrow, two-tone silvery green
  const ol = cv(512, 512), o = ol.getContext('2d');
  o.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 1300; i++) {
    const x = 20 + R() * 472, y = 20 + R() * 472;
    const dx = x - 256, dy = y - 256; if (dx * dx + dy * dy > 236 * 236) continue;
    const a = R() * Math.PI * 2, l = 12 + R() * 10;
    const silver = R() < 0.45;
    o.fillStyle = silver ? rgb(150 + R() * 30, 160 + R() * 25, 140 + R() * 20) : rgb(70 + R() * 25, 92 + R() * 25, 58 + R() * 15);
    o.save(); o.translate(x, y); o.rotate(a); o.beginPath(); o.ellipse(0, 0, l, 2.6, 0, 0, Math.PI * 2); o.fill(); o.restore();
  }
  // shrub leaves (broader, glossy dark) + oleander flowers variant
  const sh = cv(512, 512), s = sh.getContext('2d');
  const shf = cv(512, 512), sf = shf.getContext('2d');
  for (const [ctx, flowers] of [[s, false], [sf, true]]) {
    ctx.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      const x = 16 + R() * 480, y = 16 + R() * 480; const dx = x - 256, dy = y - 256; if (dx * dx + dy * dy > 240 * 240) continue;
      const a = R() * Math.PI * 2, l = 10 + R() * 12;
      ctx.fillStyle = rgb(45 + R() * 30, 75 + R() * 40, 35 + R() * 20);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, l, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (flowers) for (let i = 0; i < 160; i++) {
      const x = 30 + R() * 452, y = 30 + R() * 452; const dx = x - 256, dy = y - 256; if (dx * dx + dy * dy > 220 * 220) continue;
      const pink = R() < 0.7; ctx.fillStyle = pink ? rgb(225, 105 + R() * 40, 150 + R() * 30) : rgb(245, 240, 232);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 3.2, 2, a, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // grass tuft blades
  const gr = cv(512, 256), g = gr.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) {
    const x = 10 + R() * 492, hgt = 90 + R() * 150; const lean = (R() - 0.5) * 60;
    const dry = R();
    g.strokeStyle = dry < 0.55 ? rgb(150 + R() * 40, 135 + R() * 30, 80 + R() * 20) : rgb(85 + R() * 30, 110 + R() * 30, 55);
    g.lineWidth = 2.2 + R() * 1.8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + lean * 0.3, 256 - hgt * 0.6, x + lean, 256 - hgt); g.stroke();
  }
  const T = (c) => { const t = canvasTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  return { palm: T(pf), pine: T(pn), olive: T(ol), shrub: T(sh), shrubFlower: T(shf), grass: T(gr) };
}

// ---------------- geometry helpers ----------------
function tube(path, radiusFn, radial = 8, segs = 10, uvScale = 1) {
  // path: array of Vector3 (bottom to top)
  const pos = [], nor = [], uv = [], idx = [];
  const n = path.length;
  let prevN = new THREE.Vector3(1, 0, 0);
  let vAcc = 0;
  for (let i = 0; i < n; i++) {
    const p = path[i];
    const t = new THREE.Vector3().subVectors(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]).normalize();
    let nn = prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize();
    if (nn.lengthSq() < 0.1) nn = new THREE.Vector3(0, 0, 1);
    prevN = nn;
    const b = new THREE.Vector3().crossVectors(t, nn);
    const r = radiusFn(i / (n - 1));
    if (i > 0) vAcc += path[i].distanceTo(path[i - 1]);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const d = nn.clone().multiplyScalar(Math.cos(a)).add(b.clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r); nor.push(d.x, d.y, d.z);
      uv.push((k / radial) * uvScale, vAcc / (2 * Math.PI * 0.2) * uvScale * 0.5);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k, b2 = a + radial + 1;
    idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}

/** a curved strip (frond / leaf card) from base point along dir, with droop */
function frond(base, dir, len, width, droop, rnd, segs = 7) {
  const pos = [], nor = [], uv = [], idx = [];
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = width * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * 0.5 + 0.03;
    const p = base.clone().addScaledVector(dir, len * t);
    p.y += len * (0.35 * t - droop * t * t);
    const twist = (rnd() - 0.5) * 0.2;
    const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(dir, twist);
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(side, w * s).addScaledVector(up, -Math.abs(s) * w * 0.25);
      pos.push(q.x, q.y, q.z);
      const nn = up.clone().addScaledVector(side, s * 0.3).normalize(); nor.push(nn.x, nn.y, nn.z);
      uv.push(t, s < 0 ? 0 : 1);
    }
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}

/** cluster of crossed cards distributed on an ellipsoid shell, normals outward from the canopy centre */
function canopy(center, rx, ry, rz, count, cardSize, rnd, flatTop = 0) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    // random point on/inside shell
    let u = rnd() * 2 - 1, th = rnd() * Math.PI * 2; const sq = Math.sqrt(1 - u * u);
    let dx = sq * Math.cos(th), dy = u, dz = sq * Math.sin(th);
    if (flatTop && dy > 0.2) dy = 0.2 + (dy - 0.2) * (1 - flatTop);
    const shell = 0.72 + rnd() * 0.32;
    const p = new THREE.Vector3(center.x + dx * rx * shell, center.y + dy * ry * shell, center.z + dz * rz * shell);
    const s = cardSize * (0.75 + rnd() * 0.5);
    const g = new THREE.PlaneGeometry(s, s, 1, 1);
    g.rotateX(-Math.PI / 2 + (rnd() - 0.5) * 1.4); g.rotateY(rnd() * Math.PI * 2); g.rotateZ((rnd() - 0.5) * 0.9);
    g.translate(p.x, p.y, p.z);
    // outward normals (soft canopy shading)
    const nA = g.attributes.normal, pA = g.attributes.position;
    for (let k = 0; k < nA.count; k++) {
      const nx = (pA.getX(k) - center.x) / rx, ny = (pA.getY(k) - center.y) / ry + 0.35, nz = (pA.getZ(k) - center.z) / rz;
      const l = Math.hypot(nx, ny, nz) || 1; nA.setXYZ(k, nx / l, ny / l, nz / l);
    }
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function clean(g) { const n = g.index ? g : g; if (n.attributes.uv1) n.deleteAttribute('uv1'); return n; }

// ---------------- species ----------------
export const SPECIES = ['palm', 'pine', 'olive', 'cypress', 'shrub', 'shrubFlower', 'grass'];

export function buildSpecies(kind, variant) {
  const rnd = mulberry32(1000 + variant * 31 + kind.length * 7);
  if (kind === 'palm') {
    const h = 7 + rnd() * 3;
    const lean = new THREE.Vector3((rnd() - 0.5) * 1.4, 0, (rnd() - 0.5) * 1.4);
    const path = []; for (let i = 0; i <= 12; i++) { const t = i / 12; path.push(new THREE.Vector3(lean.x * t * t, h * t, lean.z * t * t)); }
    const trunk = tube(path, (t) => 0.24 - 0.08 * t + 0.02 * Math.sin(t * 70), 9, 12, 2);
    const top = path[path.length - 1];
    const fronds = [];
    const n = 15 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
      const tilt = rnd();
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      fronds.push(frond(top.clone().add(new THREE.Vector3(0, -0.1, 0)), dir, 3.2 + rnd() * 1.4, 0.95 + rnd() * 0.35, 0.65 + tilt * 0.6, rnd));
    }
    // a few dead hanging fronds
    for (let i = 0; i < 4; i++) { const a = rnd() * Math.PI * 2; fronds.push(frond(top.clone().add(new THREE.Vector3(0, -0.4, 0)), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 2.4, 0.6, 1.6, rnd, 5)); }
    return { trunk: clean(trunk), foliage: clean(mergeGeometries(fronds)), height: h + 1.5, radius: 0.35, crown: 4.2, foliageTex: 'palm', bark: 'Bark012' };
  }
  if (kind === 'pine') {
    // stone pine: tall trunk, umbrella canopy
    const h = 10 + rnd() * 5;
    const lean = new THREE.Vector3((rnd() - 0.5) * 2.4, 0, (rnd() - 0.5) * 2.4);
    const path = []; for (let i = 0; i <= 10; i++) { const t = i / 10; path.push(new THREE.Vector3(lean.x * Math.sin(t * 1.4), h * 0.72 * t, lean.z * Math.sin(t * 1.4))); }
    const parts = [tube(path, (t) => 0.42 - 0.22 * t, 10, 10, 2)];
    const top = path[path.length - 1];
    // branches forking into the canopy
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2 + rnd();
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * 2.6, 1.4 + rnd() * 1.2, Math.sin(a) * 2.6));
      const bp = []; for (let i = 0; i <= 5; i++) { const t = i / 5; bp.push(top.clone().lerp(end, t).add(new THREE.Vector3(0, Math.sin(t * Math.PI) * 0.4, 0))); }
      parts.push(tube(bp, (t) => 0.17 - 0.1 * t, 6, 5, 1));
    }
    const cw = 4.4 + rnd() * 1.6;
    const cen = top.clone().add(new THREE.Vector3(0, 2.0, 0));
    const fol = canopy(cen, cw, 1.5, cw * (0.85 + rnd() * 0.25), 150, 2.6, rnd, 0.75);
    return { trunk: clean(mergeGeometries(parts)), foliage: clean(fol), height: cen.y + 1.6, radius: 0.5, crown: cw, foliageTex: 'pine', bark: 'Bark014' };
  }
  if (kind === 'olive') {
    const h = 4 + rnd() * 2;
    const parts = [];
    const stems = 2 + Math.floor(rnd() * 2);
    for (let s = 0; s < stems; s++) {
      const a = rnd() * Math.PI * 2, sp = 0.6 + rnd() * 0.8;
      const path = []; for (let i = 0; i <= 8; i++) { const t = i / 8; path.push(new THREE.Vector3(Math.cos(a) * sp * t + Math.sin(t * 6 + s) * 0.12, h * 0.55 * t, Math.sin(a) * sp * t + Math.cos(t * 5 + s) * 0.12)); }
      parts.push(tube(path, (t) => 0.26 - 0.14 * t + 0.03 * Math.sin(t * 20 + s), 8, 8, 1.5));
    }
    const cen = new THREE.Vector3(0, h * 0.72, 0);
    const fol = canopy(cen, 2.4 + rnd() * 0.6, 1.6, 2.3 + rnd() * 0.6, 120, 1.7, rnd, 0.15);
    return { trunk: clean(mergeGeometries(parts)), foliage: clean(fol), height: h + 1.5, radius: 0.4, crown: 2.6, foliageTex: 'olive', bark: 'Bark001' };
  }
  if (kind === 'cypress') {
    const h = 9 + rnd() * 4;
    const path = []; for (let i = 0; i <= 6; i++) path.push(new THREE.Vector3(0, h * 0.5 * (i / 6), 0));
    const trunk = tube(path, () => 0.18, 6, 6, 1);
    // spindle of cards (columnar)
    const parts = [];
    for (let i = 0; i < 90; i++) {
      const t = rnd(); const y = 0.6 + t * (h - 0.6); const r = 1.05 * Math.sin(Math.PI * Math.min(1, (y / h) * 0.95 + 0.04)) * (0.6 + 0.4 * (1 - y / h));
      const a = rnd() * Math.PI * 2;
      const g = new THREE.PlaneGeometry(1.5, 1.9);
      g.rotateY(a); g.translate(Math.cos(a) * r * 0.6, y, Math.sin(a) * r * 0.6);
      const nA = g.attributes.normal; for (let k = 0; k < nA.count; k++) nA.setXYZ(k, Math.cos(a) * 0.8, 0.45, Math.sin(a) * 0.8);
      parts.push(g);
    }
    return { trunk: clean(trunk), foliage: clean(mergeGeometries(parts)), height: h, radius: 0.3, crown: 1.1, foliageTex: 'pine', bark: 'Bark014' };
  }
  if (kind === 'shrub' || kind === 'shrubFlower') {
    const r = 0.8 + rnd() * 0.7;
    const fol = canopy(new THREE.Vector3(0, r * 0.55, 0), r, r * 0.65, r, 34, 1.1, rnd, 0.1);
    return { trunk: null, foliage: clean(fol), height: r * 1.3, radius: r * 0.8, crown: r, foliageTex: kind, bark: null };
  }
  if (kind === 'grass') {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.9, 0.55, 3, 2); g.translate(0, 0.27, 0);
      // bend the blades: upper rows lean out and droop a little, edges curl back
      const P = g.attributes.position;
      for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); const t = y / 0.55; P.setZ(k, P.getZ(k) + t * t * 0.16 + Math.abs(x) * 0.12); P.setY(k, y - t * t * 0.04); }
      g.rotateY((i / 3) * Math.PI + rnd() * 0.3); parts.push(g);
    }
    const fol = mergeGeometries(parts);
    const nA = fol.attributes.normal; for (let k = 0; k < nA.count; k++) nA.setXYZ(k, 0, 1, 0);
    return { trunk: null, foliage: clean(fol), height: 0.6, radius: 0.3, crown: 0.45, foliageTex: 'grass', bark: null };
  }
  throw new Error('unknown species ' + kind);
}

export function foliageMaterial(tex, name) {
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, name, envMapIntensity: 0.6 });
  // transmission-like back lighting for foliage (sun through leaves)
  m.userData.programKey = 'foliage';
  m.userData.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      #ifdef USE_INSTANCING_COLOR
      #endif
      #include <opaque_fragment>`);
  };
  return m;
}
