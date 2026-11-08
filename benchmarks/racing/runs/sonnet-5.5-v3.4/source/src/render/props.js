// Roadside props: lamp posts, bollards, delineators, signs and sponsor boards, benches, bins, planters, café sets, parasols and loungers,
// post-and-rail / sand fences, tyre stacks, hay bales, cairns, boulders (also standing in the sea) and the viewpoint (mirante).
// Everything is procedural (lathe / rounded / tube / displaced-icosahedron geometry, never a bare cube), PBR-textured, instanced per ~350 m chunk.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBuilder } from './meshbuild.js';
import { BUILD_ID } from './shaders.js';
import { getProc } from './proctex.js';
import { chainPatch } from './common.js';

const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4, E3 = new THREE.Euler();
const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new M4().compose(new V3(x, y, z), new Q4().setFromEuler(E3.set(rx, ry, rz)), new V3(sx, sy, sz));
const C = { graphite: [0.15, 0.17, 0.17], green: [0.11, 0.26, 0.19], white: [0.93, 0.93, 0.9], black: [0.05, 0.05, 0.06], yellow: [0.95, 0.74, 0.1], orange: [1, 0.42, 0.06], grey: [0.55, 0.57, 0.58], glass: [0.95, 0.9, 0.7], red: [0.8, 0.12, 0.1], wood: [0.85, 0.68, 0.48], woodDark: [0.55, 0.38, 0.24], navy: [0.08, 0.14, 0.3] };

// ----------------------------------------------------------------------------------------------- tiny value noise for the boulders
function hash3(x, y, z, s) { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vn(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm3 = (x, y, z, s) => vn(x, y, z, s) * 0.55 + vn(x * 2.1, y * 2.1, z * 2.1, s + 7) * 0.28 + vn(x * 4.3, y * 4.3, z * 4.3, s + 13) * 0.17;

/** displaced icosahedron: smooth silhouette + facets, box-projected metre UVs, wet darker band at the foot */
function rockGeometry(seed, detail, flat, layer) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1, dx = x / l, dy = y / l, dz = z / l;
    let r = 0.78 + 0.5 * fbm3(dx * 1.7 + seed, dy * 1.7, dz * 1.7, seed) + 0.10 * Math.abs(vn(dx * 5.1, dy * 5.1, dz * 5.1, seed + 3) - 0.5);
    let yy = dy * r * flat;
    if (yy < -0.35) yy = -0.35 + (yy + 0.35) * 0.15;                  // buried flat base
    p.setXYZ(i, dx * r * (1 + 0.2 * Math.sin(seed * 3.1)), yy, dz * r * (1 - 0.15 * Math.cos(seed * 2.3)));
  }
  g.computeVertexNormals();
  g = g.toNonIndexed();
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count, uv = new Float32Array(n * 2), col = new Float32Array(n * 3), am = new Float32Array(n).fill(layer), ai = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 3) {
    let ax = 0, ay = 0, az = 0;
    for (let k = 0; k < 3; k++) { ax += nor.getX(i + k); ay += nor.getY(i + k); az += nor.getZ(i + k); }
    ax = Math.abs(ax); ay = Math.abs(ay); az = Math.abs(az);
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(i + k), y = pos.getY(i + k), z = pos.getZ(i + k);
      let u, v; if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
      uv[(i + k) * 2] = u + seed * 0.37; uv[(i + k) * 2 + 1] = v + seed * 0.21;
      const wet = y < -0.05 ? 0.62 + 0.38 * Math.min(1, (y + 0.35) / 0.3) : 1;
      const tone = 0.82 + 0.3 * vn(x * 3 + seed, y * 3, z * 3, seed + 21);
      col[(i + k) * 3] = tone * wet; col[(i + k) * 3 + 1] = tone * wet * 0.98; col[(i + k) * 3 + 2] = tone * wet * 0.95;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(am, 1)); g.setAttribute('aInst', new THREE.BufferAttribute(ai, 4));
  g.computeBoundingSphere(); g.computeBoundingBox();
  g.userData.tris = n / 3;
  return g;
}

// ----------------------------------------------------------------------------------------------- primitives -> MeshBuilder
function lathe(mb, x, y, z, pts, seg, o = {}) {
  const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  let arc = 0, rmax = 0.05; for (let k = 1; k < pts.length; k++) arc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); for (const p of pts) rmax = Math.max(rmax, p[0]);
  mb.addGeo(g, at(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, o.sx ?? 1, o.sy ?? 1, o.sz ?? 1), { ...o, uvU: Math.PI * 2 * rmax, uvV: arc });
}
function cyl(mb, x, y, z, r0, r1, h, seg, o = {}) {      // y = base
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, !o.cap);
  mb.addGeo(g, at(x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0), { ...o, uvU: Math.PI * 2 * Math.max(r0, r1), uvV: h });
}
function rbox(mb, x, y, z, w, h, d, rad, o = {}) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(rad, Math.min(w, h, d) * 0.45));
  mb.addGeo(g, at(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0), { ...o, planar: o.planar ?? true });
}
function sph(mb, x, y, z, rx, ry, rz, seg, o = {}) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(5, (seg * 0.65) | 0));
  mb.addGeo(g, at(x, y, z, 0, 0, 0, rx, ry, rz), { ...o, planar: true });
}
function tube(mb, pts, r, o = {}) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])));
  const g = new THREE.TubeGeometry(c, o.segs ?? 14, r, 8, false);
  mb.addGeo(g, new M4(), { ...o, uvU: 1, uvV: c.getLength() });
}
function torus(mb, x, y, z, R, r, rx, o = {}) {
  const g = new THREE.TorusGeometry(R, r, o.tseg ?? 10, o.rseg ?? 22);
  mb.addGeo(g, at(x, y, z, rx, o.ry || 0, 0), { ...o, planar: true });
}

// ----------------------------------------------------------------------------------------------- procedural textures (>= 1024 px)
function cv(w, h) { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); return c; }
function ctex(c, srgb = true, repeat = false) { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; }
let sd = 17; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
function signAtlas() {
  const c = cv(1024, 1024), g = c.getContext('2d');
  const cell = (cx, cy, fn) => { g.save(); g.translate(cx * 512, cy * 512); g.beginPath(); g.rect(0, 0, 512, 512); g.clip(); fn(); g.restore(); };
  // (0,0) chevron
  cell(0, 0, () => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#111'; g.lineWidth = 22; g.strokeRect(20, 20, 472, 472);
    g.strokeStyle = '#111'; g.lineWidth = 46; g.lineJoin = 'miter';
    for (const dx of [-120, 20, 160]) { g.beginPath(); g.moveTo(150 + dx, 110); g.lineTo(290 + dx, 256); g.lineTo(150 + dx, 402); g.stroke(); }
  });
  // (1,0) warning triangle
  cell(1, 0, () => {
    g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#c8191f'; g.lineWidth = 36; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(256, 60); g.lineTo(462, 420); g.lineTo(50, 420); g.closePath(); g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 30; g.lineCap = 'round'; g.beginPath(); g.moveTo(175, 365); g.bezierCurveTo(190, 250, 320, 290, 335, 190); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(335, 150); g.lineTo(368, 215); g.lineTo(300, 205); g.closePath(); g.fill();
  });
  // (0,1) speed limit
  cell(0, 1, () => {
    g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#c8191f'; g.beginPath(); g.arc(256, 256, 218, 0, 7); g.fill();
    g.fillStyle = '#f7f5ee'; g.beginPath(); g.arc(256, 256, 166, 0, 7); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 190px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('50', 256, 274);
  });
  // (1,1) street plate
  cell(1, 1, () => {
    g.fillStyle = '#1b3f8b'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#f4f2ea'; g.lineWidth = 16; g.strokeRect(24, 24, 464, 464);
    g.fillStyle = '#f4f2ea'; g.font = 'bold 74px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Rua da', 256, 190); g.fillText('Praia', 256, 300);
    g.font = '40px Arial, sans-serif'; g.fillText('Centro  →', 256, 410);
  });
  return ctex(c);
}
function boardTexture(v) {
  const c = cv(2048, 512), g = c.getContext('2d');
  if (v === 0) {
    const gr = g.createLinearGradient(0, 0, 2048, 0); gr.addColorStop(0, '#0b1d44'); gr.addColorStop(1, '#16407a'); g.fillStyle = gr; g.fillRect(0, 0, 2048, 512);
    g.fillStyle = '#ffb347'; g.fillRect(0, 0, 2048, 36); g.fillRect(0, 476, 2048, 36);
    g.fillStyle = '#f6f2e6'; g.font = 'bold 230px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('COSTA DOURADA', 1024, 230);
    g.font = '70px Arial, sans-serif'; g.fillStyle = '#ffb347'; g.fillText('GRANDE PRÊMIO · PÔR DO SOL', 1024, 400);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(1, '#e24a2b'); g.fillStyle = gr; g.fillRect(0, 0, 2048, 512);
    for (let x = 0; x < 2048; x += 128) { g.fillStyle = (x / 128) % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'; g.fillRect(x, 0, 128, 512); }
    g.fillStyle = '#fff6e5'; g.font = 'bold 210px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SOL & MAR', 1024, 220);
    g.font = '76px Arial, sans-serif'; g.fillText('Café Atlântico · Sorvetes · Praia', 1024, 400);
  }
  return ctex(c);
}
function rubberTexture() {
  const c = cv(1024, 1024), g = c.getContext('2d'); sd = 5; g.fillStyle = '#1c1c1d'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { const v = 20 + rnd() * 40; g.fillStyle = `rgba(${v},${v},${v + 2},${0.2 + rnd() * 0.5})`; g.fillRect(rnd() * 1024, rnd() * 1024, 1 + rnd() * 3, 1 + rnd() * 3); }
  for (let i = 0; i < 40; i++) { const x = rnd() * 1024, y = rnd() * 1024, r = 20 + rnd() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,110,95,0.22)'); gr.addColorStop(1, 'rgba(120,110,95,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  return ctex(c, true, true);
}
function strawTexture() {
  const c = cv(1024, 1024), g = c.getContext('2d'); sd = 9; g.fillStyle = '#c9a54a'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 7000; i++) { const x = rnd() * 1024, y = rnd() * 1024, l = 30 + rnd() * 120, a = (rnd() - 0.5) * 0.3, v = 150 + rnd() * 90; g.strokeStyle = `rgba(${v},${v * 0.82 | 0},${v * 0.38 | 0},${0.25 + rnd() * 0.45})`; g.lineWidth = 1 + rnd() * 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return ctex(c, true, true);
}

// ----------------------------------------------------------------------------------------------- the prop catalogue
/** each entry: [{ mat: 'build'|'metal'|'cloth'|'sign0..3'|'board0|1'|'rubber'|'straw', geo: MeshBuilder }] in local space (+z faces away from the road) */
function buildCatalogue() {
  const B = BUILD_ID, cat = {};
  const part = (list, mat, mb) => { list.push({ mat, mb }); return mb; };

  // ---- lamp posts (0 promenade arm, 1 village twin lantern, 2 bridge globe)
  for (const v of [0, 1, 2]) {
    const L = [], m = new MeshBuilder(), tall = v === 2 ? 2.7 : v === 1 ? 4.2 : 4.9, col = v === 1 ? C.black : C.graphite;
    lathe(m, 0, 0, 0, [[0.001, 0], [0.19, 0], [0.19, 0.14], [0.13, 0.26], [0.085, 0.44], [0.07, 0.7]], 16, { color: col });
    cyl(m, 0, 0.68, 0, 0.07, v === 2 ? 0.05 : 0.044, tall - 0.68, 14, { color: col, cap: true });
    torus(m, 0, 1.25, 0, 0.075, 0.018, Math.PI / 2, { color: C.yellow, tseg: 6, rseg: 16 });
    if (v === 0) {
      tube(m, [[0, tall - 0.05, 0], [0, tall + 0.32, 0.12], [0, tall + 0.38, 0.62], [0, tall + 0.3, 1.0]], 0.038, { color: col });
      lathe(m, 0, tall + 0.18, 1.0, [[0.001, 0.14], [0.17, 0.12], [0.30, 0.02], [0.33, -0.04], [0.22, -0.1], [0.001, -0.13]], 20, { color: col });
      sph(m, 0, tall + 0.1, 1.0, 0.22, 0.07, 0.22, 14, { color: C.glass });
    } else if (v === 1) {
      for (const sx of [-1, 1]) {
        tube(m, [[0, tall - 0.3, 0], [sx * 0.18, tall - 0.12, 0], [sx * 0.55, tall - 0.2, 0], [sx * 0.62, tall - 0.48, 0]], 0.03, { color: col });
        lathe(m, sx * 0.62, tall - 0.95, 0, [[0.001, 0.46], [0.07, 0.42], [0.20, 0.36], [0.24, 0.26], [0.12, 0.01], [0.001, 0]], 14, { color: col });
        sph(m, sx * 0.62, tall - 0.72, 0, 0.17, 0.2, 0.17, 12, { color: C.glass });
      }
      lathe(m, 0, tall - 0.1, 0, [[0.001, 0.38], [0.04, 0.26], [0.1, 0.1], [0.12, 0]], 12, { color: col });
    } else {
      sph(m, 0, tall + 0.24, 0, 0.24, 0.24, 0.24, 14, { color: C.glass });
      lathe(m, 0, tall - 0.02, 0, [[0.001, 0], [0.16, 0], [0.19, 0.09], [0.12, 0.15], [0.001, 0.16]], 12, { color: col });
    }
    part(L, 'metal', m); cat['lamp' + v] = L;
  }
  cat.lamp = cat.lamp0; cat['lamp-bridge'] = cat.lamp2;

  // ---- bollards
  for (const v of [0, 1]) {
    const L = [], m = new MeshBuilder();
    lathe(m, 0, 0, 0, [[0.001, 0], [0.19, 0], [0.19, 0.6], [0.17, 0.68], [0.12, 0.75], [0.001, 0.77]], 18, { mat: v ? B.rustic_stone_wall : B.concrete_wall_007, color: v ? [0.9, 0.86, 0.78] : [0.95, 0.95, 0.93] });
    lathe(m, 0, 0.42, 0, [[0.186, 0], [0.196, 0], [0.196, 0.09], [0.186, 0.09]], 18, { mat: B.concrete_wall_007, color: v ? [0.25, 0.25, 0.27] : C.yellow });
    part(L, 'build', m); cat['bollard' + v] = L;
  }
  cat.bollard = cat.bollard0;

  // ---- delineator post
  { const L = [], m = new MeshBuilder();
    cyl(m, 0, 0, 0, 0.05, 0.036, 1.18, 10, { color: C.white, cap: true });
    cyl(m, 0, 0.62, 0, 0.0455, 0.0425, 0.2, 10, { color: C.black });
    rbox(m, 0, 0.96, -0.04, 0.085, 0.16, 0.03, 0.012, { color: C.orange });
    sph(m, 0, 1.19, 0, 0.04, 0.03, 0.04, 8, { color: C.white });
    part(L, 'metal', m); cat.delineator = L; }

  // ---- sign posts + boards
  const signPost = (h) => { const m = new MeshBuilder(); cyl(m, 0, 0, 0, 0.048, 0.04, h, 10, { color: C.grey, cap: true }); cyl(m, 0, h * 0.5, 0.0, 0.052, 0.052, 0.04, 10, { color: C.graphite }); return m; };
  const signBoard = (cu, cv_, w, h, y) => { const m = new MeshBuilder(); rbox(m, 0, y, -0.06, w, h, 0.045, 0.018, { color: [1, 1, 1], planar: false }); const uv = m.uv; for (let k = 0; k < uv.length; k += 2) { uv[k] = cu * 0.5 + THREE.MathUtils.clamp(uv[k], 0, 1) * 0.5; uv[k + 1] = (1 - cv_) * 0.5 + THREE.MathUtils.clamp(uv[k + 1], 0, 1) * 0.5; } return m; };
  cat.chevron = [{ mat: 'metal', mb: signPost(1.55) }, { mat: 'sign', mb: signBoard(0, 0, 0.92, 0.92, 1.42) }];
  cat.warn = [{ mat: 'metal', mb: signPost(1.75) }, { mat: 'sign', mb: signBoard(1, 0, 0.84, 0.84, 1.5) }];
  cat.warn1 = [{ mat: 'metal', mb: signPost(2.1) }, { mat: 'sign', mb: signBoard(0, 1, 0.78, 0.78, 1.8) }, { mat: 'sign', mb: signBoard(1, 1, 0.7, 0.7, 2.5) }];

  // ---- sponsor boards 6 x 1.5 on two posts
  for (const v of [0, 1]) {
    const m = new MeshBuilder(), f = new MeshBuilder();
    for (const sx of [-1, 1]) { cyl(m, sx * 2.6, 0, 0.0, 0.1, 0.085, 2.1, 12, { color: C.graphite, cap: true }); rbox(m, sx * 2.6, 0.05, 0, 0.35, 0.1, 0.35, 0.03, { color: C.graphite }); }
    rbox(m, 0, 1.8, 0.04, 6.3, 1.65, 0.14, 0.04, { color: C.graphite });
    rbox(f, 0, 1.8, -0.045, 6.0, 1.5, 0.04, 0.012, { color: [1, 1, 1], planar: false });
    cat['board' + v] = [{ mat: 'metal', mb: m }, { mat: 'board' + v, mb: f }];
  }
  cat.board = cat.board0;

  // ---- bench
  { const L = [], m = new MeshBuilder(), cc = new MeshBuilder();
    for (let k = 0; k < 5; k++) rbox(m, 0, 0.47, -0.2 + k * 0.1, 1.8, 0.045, 0.085, 0.018, { mat: B.wooden_planks, color: [0.95 - k * 0.02, 0.78, 0.6] });
    for (let k = 0; k < 3; k++) rbox(m, 0, 0.66 + k * 0.14, 0.23 - k * 0.03, 1.8, 0.1, 0.04, 0.016, { mat: B.wooden_planks, color: [0.92, 0.74, 0.56], rx: -0.2 });
    for (const sx of [-1, 1]) { rbox(cc, sx * 0.82, 0.24, 0.02, 0.09, 0.48, 0.52, 0.025, { mat: B.concrete_wall_007, color: [0.9, 0.9, 0.88] }); rbox(cc, sx * 0.82, 0.78, 0.26, 0.07, 0.62, 0.07, 0.02, { mat: B.concrete_wall_007, color: [0.85, 0.85, 0.83], rx: -0.2 }); }
    part(L, 'build', m); part(L, 'build', cc); cat.bench = L; }

  // ---- litter bin
  { const L = [], m = new MeshBuilder();
    lathe(m, 0, 0, 0, [[0.001, 0.02], [0.2, 0.02], [0.2, 0.08], [0.255, 0.86], [0.27, 0.9], [0.2, 0.93]], 16, { color: C.green });
    torus(m, 0, 0.9, 0, 0.255, 0.022, Math.PI / 2, { color: C.graphite, tseg: 6, rseg: 18 });
    lathe(m, 0, 0.9, 0, [[0.27, 0], [0.25, 0.08], [0.16, 0.16], [0.04, 0.2], [0.001, 0.2]], 16, { color: C.graphite });
    cyl(m, 0.18, 0.0, 0, 0.012, 0.012, 0.0, 4, { color: C.black });
    part(L, 'metal', m); cat.bin = L; }

  // ---- planter with flowers
  { const L = [], m = new MeshBuilder(); sd = 41;
    lathe(m, 0, 0, 0, [[0.001, 0], [0.38, 0], [0.5, 0.12], [0.55, 0.56], [0.6, 0.63], [0.56, 0.68], [0.47, 0.64], [0.001, 0.58]], 20, { mat: B.rustic_stone_wall, color: [1, 0.93, 0.82] });
    sph(m, 0, 0.6, 0, 0.46, 0.14, 0.46, 12, { mat: B.dry_ground_rocks, color: [0.34, 0.24, 0.17] });
    const cols = [[0.88, 0.12, 0.18], [0.98, 0.78, 0.15], [0.95, 0.45, 0.62], [0.97, 0.97, 0.95]];
    for (let k = 0; k < 16; k++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 0.36; sph(m, Math.cos(a) * r, 0.78 + rnd() * 0.12, Math.sin(a) * r, 0.085, 0.07, 0.085, 7, { mat: B.painted_plaster_wall, color: cols[k % 4] }); }
    for (let k = 0; k < 9; k++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 0.34; sph(m, Math.cos(a) * r, 0.68 + rnd() * 0.08, Math.sin(a) * r, 0.17, 0.1, 0.17, 8, { mat: B.painted_plaster_wall, color: [0.2 + rnd() * 0.1, 0.45 + rnd() * 0.15, 0.16] }); }
    part(L, 'build', m); cat.planter = L; }

  // ---- parasol (pole + canopy), beach version and café version share the builder
  const parasol = (R, h, withTable) => {
    const L = [], pole = new MeshBuilder(), can = new MeshBuilder(), wood = new MeshBuilder();
    cyl(pole, 0, 0, 0, 0.032, 0.026, h, 8, { color: C.grey, cap: true }); sph(pole, 0, h + 0.2, 0, 0.035, 0.05, 0.035, 8, { color: C.grey });
    const g = new THREE.ConeGeometry(R, 0.42, 20, 3, true); g.translate(0, 0.21, 0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); p.setY(i, y - 0.1 * (r / R) * (r / R) + 0.03 * Math.sin(Math.atan2(z, x) * 10) * (r / R)); }
    g.computeVertexNormals();
    can.addGeo(g, at(0, h - 0.02, 0), { color: [1, 1, 1], uvU: R * 6, uvV: R * 1.2 });
    part(L, 'metal', pole); part(L, 'cloth', can);
    if (withTable) {
      lathe(wood, 0, 0, 0, [[0.001, 0.01], [0.22, 0.01], [0.04, 0.05], [0.035, 0.7], [0.37, 0.72], [0.37, 0.76], [0.001, 0.76]], 18, { mat: B.wooden_planks, color: [0.9, 0.78, 0.62] });
      for (const a of [0.6, 2.9]) { const cx = Math.cos(a) * 0.62, cz = Math.sin(a) * 0.62;
        rbox(wood, cx, 0.45, cz, 0.42, 0.04, 0.42, 0.015, { mat: B.wooden_planks, color: [0.85, 0.72, 0.52], ry: -a });
        rbox(wood, cx + Math.cos(a) * 0.2, 0.7, cz + Math.sin(a) * 0.2, 0.04, 0.4, 0.4, 0.015, { mat: B.wooden_planks, color: [0.85, 0.72, 0.52], ry: -a });
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(wood, cx + dx * 0.17, 0, cz + dz * 0.17, 0.016, 0.014, 0.45, 6, { mat: B.wooden_planks, color: [0.5, 0.36, 0.25] }); }
      part(L, 'build', wood);
    }
    return L;
  };
  cat.parasol = parasol(1.45, 2.3, false); cat.cafe = parasol(1.2, 2.2, true);

  // ---- sun lounger (wood frame + cushion)
  { const L = [], w = new MeshBuilder(), cl = new MeshBuilder();
    rbox(w, 0, 0.24, 0, 0.62, 0.05, 1.3, 0.02, { mat: B.wooden_planks, color: [0.95, 0.85, 0.7] });
    rbox(w, 0, 0.5, 0.78, 0.62, 0.05, 0.7, 0.02, { mat: B.wooden_planks, color: [0.95, 0.85, 0.7], rx: -0.62 });
    for (const [x, z] of [[-0.28, -0.55], [0.28, -0.55], [-0.28, 0.5], [0.28, 0.5]]) cyl(w, x, 0, z, 0.026, 0.022, 0.24, 6, { mat: B.wooden_planks, color: [0.7, 0.55, 0.4] });
    rbox(cl, 0, 0.29, -0.02, 0.56, 0.06, 1.2, 0.025, { color: [1, 1, 1] }); rbox(cl, 0, 0.55, 0.77, 0.56, 0.06, 0.62, 0.025, { color: [1, 1, 1], rx: -0.62 });
    part(L, 'build', w); part(L, 'cloth', cl); cat.lounger = L; }

  // ---- fences
  { const L = [], m = new MeshBuilder();
    for (const sx of [-1, 1]) cyl(m, sx * 1.2, -0.1, 0, 0.06, 0.05, 1.4, 10, { mat: B.wooden_planks, color: [0.8, 0.68, 0.56], cap: true });
    for (const y of [0.55, 1.0]) rbox(m, 0, y, 0.05, 2.5, 0.08, 0.1, 0.03, { mat: B.wooden_planks, color: [0.88, 0.76, 0.6] });
    rbox(m, 0, 0.78, 0.0, 2.2, 0.06, 0.05, 0.02, { mat: B.wooden_planks, color: [0.84, 0.72, 0.56], rz: 0.4 });
    part(L, 'build', m); cat.fence = L; }
  { const L = [], m = new MeshBuilder();
    for (const sx of [-1, 1]) cyl(m, sx * 1.2, -0.1, 0, 0.05, 0.04, 1.25, 8, { mat: B.wooden_planks, color: [0.75, 0.62, 0.5], cap: true });
    for (let k = 0; k < 15; k++) rbox(m, -1.2 + k * 0.171, 0.5, 0.0, 0.075, 0.95, 0.03, 0.01, { mat: B.wooden_planks, color: [0.95 - (k % 3) * 0.03, 0.82, 0.66] });
    tube(m, [[-1.2, 0.95, 0.03], [0, 0.93, 0.03], [1.2, 0.95, 0.03]], 0.008, { color: C.grey }); tube(m, [[-1.2, 0.1, 0.03], [0, 0.09, 0.03], [1.2, 0.1, 0.03]], 0.008, { color: C.grey });
    part(L, 'build', m); cat.sandfence = L; }

  // ---- tyre stack + hay bales
  { const L = [], m = new MeshBuilder();
    for (const [x, z, n] of [[-0.34, 0, 3], [0.34, 0, 3], [0, 0.55, 3]]) for (let k = 0; k < n; k++) torus(m, x, 0.16 + k * 0.3, z, 0.3, 0.16, Math.PI / 2, { color: [1, 1, 1], tseg: 8, rseg: 16 });
    part(L, 'rubber', m); cat.tyres = L; }
  { const L = [], m = new MeshBuilder();
    const bale = (x, y, z, ry) => { const g = new THREE.CylinderGeometry(0.55, 0.55, 1.25, 20, 1, false); mb_add(m, g, at(x, y, z, 0, ry, Math.PI / 2)); };
    function mb_add(mb, g, mtx) { mb.addGeo(g, mtx, { color: [1, 1, 1], planar: true }); }
    bale(-0.5, 0.55, 0, 0.1); bale(0.7, 0.55, 0.05, -0.05); bale(0.1, 1.5, 0.02, 0.5);
    part(L, 'straw', m); cat.hay = L; }
  // ---- cairn (stacked stones)
  { const L = [], m = new MeshBuilder(); const g = rockGeometry(3, 1, 0.7, B.dry_ground_rocks);
    [[0, 0, 0.36], [0.03, 0.26, 0.28], [-0.02, 0.46, 0.22], [0.02, 0.62, 0.16], [0, 0.74, 0.1]].forEach(([x, y, r], k) => m.addGeo(g, at(x, y, 0, 0, k * 1.3, 0, r, r * 0.7, r), { mat: B.dry_ground_rocks, color: [0.9, 0.88, 0.85], planar: true }));
    part(L, 'build', m); cat.cairn = L; }
  return cat;
}

/** the viewpoint: stone-walled terrace on a retaining plinth with a timber deck, benches and a coin telescope; built around (0,0,0) facing +z.
 *  deck = {top, bottom}: local heights of the terrace surface and of the plinth foot (so it never floats on a slope). */
function buildMirante(deck) {
  const B = BUILD_ID, L = [], pl = new MeshBuilder(), st = new MeshBuilder(), wd = new MeshBuilder(), mt = new MeshBuilder(), yT = deck.top, hP = Math.max(0.6, yT - deck.bottom);
  rbox(pl, 0, deck.bottom + hP / 2, 0, 11.8, hP, 7.8, 0.14, { mat: B.rustic_stone_wall, color: [0.88, 0.84, 0.76] });
  for (let a = -4; a <= 4; a++) for (let b = -2; b <= 2; b++) rbox(st, a * 1.3, 0.1, b * 1.4, 1.28, 0.2, 1.38, 0.03, { mat: B.cobblestone_floor_01, color: [0.95 - ((a + b) & 1) * 0.04, 0.92, 0.86] });
  const wallSeg = (x, z, ry, len) => { rbox(st, x, 0.58, z, len, 0.78, 0.42, 0.05, { mat: B.rustic_stone_wall, color: [0.95, 0.9, 0.8], ry }); rbox(st, x, 1.0, z, len + 0.1, 0.1, 0.55, 0.03, { mat: B.rustic_stone_wall, color: [0.9, 0.86, 0.78], ry }); };
  for (let a = -4; a <= 4; a++) wallSeg(a * 1.3, 3.55, 0, 1.3);
  for (let b = -2; b <= 2; b++) { wallSeg(-5.9, b * 1.4, Math.PI / 2, 1.4); wallSeg(5.9, b * 1.4, Math.PI / 2, 1.4); }
  for (let k = 0; k < 14; k++) rbox(wd, 0, 0.23, -2.4 + k * 0.2, 5.2, 0.04, 0.18, 0.012, { mat: B.wooden_planks, color: [0.9 - (k % 3) * 0.04, 0.74, 0.56] });
  for (const sx of [-1.9, 1.9]) { for (let k = 0; k < 4; k++) rbox(wd, sx, 0.65, -1.0 + k * 0.095, 1.4, 0.04, 0.08, 0.015, { mat: B.wooden_planks, color: [0.88, 0.7, 0.52] }); for (const dx of [-0.6, 0.6]) rbox(st, sx + dx, 0.43, -0.85, 0.08, 0.4, 0.4, 0.02, { mat: B.concrete_wall_007, color: [0.9, 0.9, 0.88] }); }
  cyl(mt, 0, 0.2, 2.2, 0.07, 0.06, 0.95, 10, { color: C.graphite, cap: true });
  lathe(mt, 0, 1.12, 2.2, [[0.001, 0], [0.11, 0], [0.13, 0.08], [0.11, 0.3], [0.08, 0.34], [0.001, 0.34]], 14, { color: C.graphite });
  cyl(mt, 0, 1.1, 2.0, 0.05, 0.075, 0.3, 10, { color: C.grey, cap: true, rx: Math.PI / 2 });
  cyl(mt, -5.0, 0.2, -2.2, 0.05, 0.035, 5.2, 10, { color: C.grey, cap: true });
  for (const mb of [st, wd, mt]) for (let k = 1; k < mb.pos.length; k += 3) mb.pos[k] += yT;       // lift the terrace above the plinth
  L.push({ mat: 'build', mb: pl }, { mat: 'build', mb: st }, { mat: 'build', mb: wd }, { mat: 'metal', mb: mt });
  return L;
}

// ----------------------------------------------------------------------------------------------- the renderer
const SHADOW_KINDS = new Set(['lamp', 'lamp-bridge', 'board', 'rock', 'bench', 'cafe', 'parasol', 'hay', 'tyres', 'planter', 'cairn', 'lounger']);
export class Props {
  constructor(world, lighting, materials, quality) {
    this.world = world; this.lighting = lighting; this.q = quality;
    this.group = new THREE.Group(); this.group.name = 'props';
    this.stats = { instances: 0, meshes: 0, tris: 0, byKind: {} }; this.seaRocks = [];
    const procs = getProc();
    const build = materials.makeBuilding('props-build');
    const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, map: procs.metalA, normalMap: procs.grainN, normalScale: new THREE.Vector2(0.3, 0.3), metalness: 0.55, roughness: 0.46, vertexColors: true });
    metal.name = 'props-metal'; chainPatch(metal, lighting, null, 'props-metal-v1'); materials.audit.push({ name: 'props-metal', material: metal, near: true });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, map: procs.clothA, normalMap: procs.clothN, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, vertexColors: true });
    cloth.name = 'props-cloth'; chainPatch(cloth, lighting, null, 'props-cloth-v1'); materials.audit.push({ name: 'props-cloth', material: cloth, near: true });
    const rubber = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rubberTexture(), normalMap: procs.grainN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.85, metalness: 0, vertexColors: true });
    rubber.name = 'props-rubber'; chainPatch(rubber, lighting, null, 'props-rubber-v1'); materials.audit.push({ name: 'props-rubber', material: rubber, near: true });
    const straw = new THREE.MeshStandardMaterial({ color: 0xffffff, map: strawTexture(), normalMap: procs.grainN, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.95, metalness: 0, vertexColors: true });
    straw.name = 'props-straw'; chainPatch(straw, lighting, null, 'props-straw-v1'); materials.audit.push({ name: 'props-straw', material: straw, near: true });
    const atlas = signAtlas();
    const sign = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas, normalMap: procs.grainN, normalScale: new THREE.Vector2(0.12, 0.12), roughness: 0.5, metalness: 0.1, vertexColors: true });
    sign.name = 'props-sign'; chainPatch(sign, lighting, null, 'props-sign-v1'); materials.audit.push({ name: 'props-sign', material: sign, near: true });
    const mkBoard = (v) => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: boardTexture(v), normalMap: procs.grainN, normalScale: new THREE.Vector2(0.1, 0.1), roughness: 0.5, metalness: 0.1, vertexColors: true }); m.name = 'props-board' + v; chainPatch(m, lighting, null, 'props-board-v1' + v); materials.audit.push({ name: 'props-board' + v, material: m, near: true }); return m; };
    this.mats = { build, metal, cloth, rubber, straw, sign, board0: mkBoard(0), board1: mkBoard(1) };
    this.cat = buildCatalogue();
    this.rocks = [rockGeometry(1, 4, 0.8, BUILD_ID.seaside_rock), rockGeometry(2, 4, 0.7, BUILD_ID.dry_ground_rocks), rockGeometry(3, 3, 0.85, BUILD_ID.seaside_rock), rockGeometry(4, 3, 0.6, BUILD_ID.dry_ground_rocks)];
    this.chunkMeshes = [];
  }

  /** hide chunks that are too far away to matter (draw-call budget) */
  update(camera) {
    const far = this.q && this.q.name === 'low' ? 380 : 560, x = camera.position.x, z = camera.position.z;
    for (const c of this.chunkMeshes) c.im.visible = Math.max(0, Math.hypot(c.cx - x, c.cz - z) - c.r) < far;
  }

  _geo(mb) { const g = mb.toGeometry({ withInst: true }); return g; }

  /** items: [{kind,x,y,z,yaw,s,v,tint,sea,zone}] from placeProps() */
  build(items) {
    const CH = 350, chunks = new Map();
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
    const keyOf = (it) => `${Math.floor(it.x / CH)},${Math.floor(it.z / CH)}`;
    for (const it of items) {
      if (it.kind === 'mirante') { this._addMirante(it); continue; }
      if (it.kind === 'rock') this.stats.byKind.rock = (this.stats.byKind.rock || 0) + 1;
      const key = keyOf(it) + '|' + (it.kind === 'rock' ? 'rock' + (it.v & 3) : it.kind + (it.kind === 'lamp' ? it.v : it.kind === 'bollard' ? it.v : it.kind === 'warn' ? it.v : it.kind === 'board' ? it.v : ''));
      let c = chunks.get(key); if (!c) chunks.set(key, c = { kind: it.kind, v: it.v, list: [] });
      c.list.push(it);
      if (it.sea) this.seaRocks.push({ x: it.x, z: it.z, r: 1.25 * it.s });
    }
    for (const [key, c] of chunks) {
      const parts = this._parts(c);
      for (const pt of parts) {
        const g = pt.geo.clone(); const n = c.list.length; const tinted = pt.material === this.mats.cloth;
        const im = new THREE.InstancedMesh(g, pt.material, n), aP = new Float32Array(n * 4);
        c.list.forEach((it, k) => {
          q.setFromAxisAngle(up, it.yaw); p.set(it.x, it.y, it.z); const s = it.kind === 'rock' ? it.s : 1; sc.set(s, c.kind === 'rock' ? s * (0.8 + 0.4 * ((it.v >> 2) % 3) / 2) : s, s);
          m4.compose(p, q, sc); im.setMatrixAt(k, m4);
          const t = (it.tint && (tinted || c.kind === 'bollard')) ? it.tint : [1, 1, 1];     // only canopies / cushions / bollards take the palette tint
          color.setRGB(t[0], t[1], t[2]); im.setColorAt(k, color);
          aP[k * 4 + 3] = it.y;
        });
        // tint only the cloth / bollard stripe / parasol canopy: everything else keeps its own vertex colours (tint [1,1,1])
        g.setAttribute('aInstP', new THREE.InstancedBufferAttribute(aP, 4));
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.castShadow = SHADOW_KINDS.has(c.kind); im.receiveShadow = true; im.name = `prop-${c.kind}`;
        this.chunkMeshes.push({ im, cx: im.boundingSphere.center.x, cz: im.boundingSphere.center.z, r: im.boundingSphere.radius });
        im.userData.prop = c.kind; im.userData.tris = pt.tris;
        this.group.add(im); this.stats.meshes++; this.stats.instances += n; this.stats.tris += pt.tris * n;
        this.stats.byKind[c.kind] = (this.stats.byKind[c.kind] || 0) + (pt === parts[0] ? n : 0);
      }
    }
    return this;
  }

  _parts(c) {
    this._cache = this._cache || new Map();
    const id = c.kind === 'rock' ? 'rock' + (c.list[0].v & 3) : c.kind + ((c.kind === 'lamp' || c.kind === 'bollard' || c.kind === 'warn' || c.kind === 'board') ? c.v : '');
    if (this._cache.has(id)) return this._cache.get(id);
    let out;
    if (c.kind === 'rock') { const g = this.rocks[c.list[0].v & 3]; out = [{ geo: g, material: this.mats.build, tris: g.userData.tris }]; }
    else {
      let def = this.cat[c.kind];
      if (c.kind === 'lamp') def = this.cat['lamp' + (c.v | 0)]; else if (c.kind === 'bollard') def = this.cat['bollard' + (c.v | 0)]; else if (c.kind === 'warn') def = c.v ? this.cat.warn1 : this.cat.warn; else if (c.kind === 'board') def = this.cat['board' + (c.v | 0)];
      out = def.map((d) => { const g = this._geo(d.mb); const material = this.mats[d.mat] || this.mats.sign; return { geo: g, material, tris: g.index.count / 3 }; });
    }
    this._cache.set(id, out); return out;
  }

  _addMirante(it) {
    this.mirante = buildMirante(it.deck || { top: 0.3, bottom: -0.7 });
    const grp = new THREE.Group(); grp.name = 'mirante'; grp.position.set(it.x, it.y, it.z); grp.rotation.y = it.yaw;
    let tris = 0;
    for (const d of this.mirante) {
      const g = this._geo(d.mb); const material = this.mats[d.mat]; const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); tris += g.index.count / 3;
      if (d.mat === 'build') { const aP = new Float32Array(g.attributes.position.count * 4); for (let k = 0; k < aP.length; k += 4) aP[k + 3] = it.y; g.setAttribute('aInstP', new THREE.BufferAttribute(aP, 4)); }
    }
    // retaining stub below the terrace so it never floats on a slope
    this.group.add(grp); this.stats.meshes += this.mirante.length; this.stats.tris += tris; this.stats.byKind.mirante = 1;
    this.mirantePos = { x: it.x, y: it.y, z: it.z, yaw: it.yaw };
  }
}
