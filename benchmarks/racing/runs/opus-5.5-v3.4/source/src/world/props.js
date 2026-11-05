// Procedural props (own work), all textured PBR, merged per material part,
// rendered through InstanceField. No plain boxes: every part is a lathe,
// extrusion, bevelled/rounded shape or displaced mesh.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/rng.js';
import { withRepeat, loadedTextures } from '../render/textures.js';

const V2 = (a, b) => new THREE.Vector2(a, b);
function lathe(profile, seg = 16) { return new THREE.LatheGeometry(profile.map(([r, y]) => V2(r, y)), seg); }
function rbox(w, h, d, r = 0.02, s = 2) { return new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2.1, h / 2.1, d / 2.1)); }
function cyl(r0, r1, h, seg = 12) { return new THREE.CylinderGeometry(r1, r0, h, seg, 1); }
function T(g, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }
function merge(list) {
  const norm = list.map((g) => { let n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; });
  return mergeGeometries(norm);
}
function canvasTex(w, h, draw) { const W = Math.max(1024, w), H = Math.max(1024, h); const c = document.createElement('canvas'); c.width = W; c.height = H; const g2 = c.getContext('2d'); g2.setTransform(W / w, 0, 0, H / h, 0, 0); draw(g2, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.src = 'generated-prop'; loadedTextures.add(t); return t; }

export function propMaterials(sets) {
  const M = {};
  const std = (set, rep, opt = {}) => {
    const s = withRepeat(set, rep, opt.repY ?? rep);
    const m = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.orm, roughness: opt.roughness ?? 1, metalness: opt.metalness ?? 0, color: opt.color ?? 0xffffff, name: opt.name });
    if (opt.metalMap) m.metalnessMap = s.orm;
    return m;
  };
  M.greenMetal = std(sets.metal, 2, { color: 0x3c5546, roughness: 0.75, metalness: 0.55, name: 'painted-metal' });
  M.whiteMetal = std(sets.metal, 2, { color: 0xe6e3dc, roughness: 0.7, metalness: 0.35, name: 'white-metal' });
  M.galv = std(sets.metal, 1.5, { color: 0xc9ced3, roughness: 0.6, metalness: 0.85, name: 'galvanized' });
  M.wood = std(sets.planks, 1, { color: 0xc9a27a, name: 'wood' });
  M.woodDark = std(sets.wood, 1.5, { color: 0x8a6a4e, name: 'wood-dark' });
  M.concrete = std(sets.concrete, 0.8, { name: 'concrete' });
  M.stone = std(sets.stone, 0.7, { name: 'stone' });
  M.rock = std(sets.rock, 0.4, { name: 'rock' });
  M.plaster = std(sets.plaster, 0.5, { color: 0xf1e7d6, name: 'plaster-white' });
  M.terracotta = std(sets.plaster, 0.6, { color: 0xb8643f, name: 'terracotta' });
  const stripes = canvasTex(512, 256, (g, w, h) => { const cols = ['#e8e1d3', '#2c6e9b', '#e8e1d3', '#d0563b']; for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); } });
  M.fabric = new THREE.MeshStandardMaterial({ map: stripes, normalMap: sets.fabric.normalMap, roughness: 0.92, side: THREE.DoubleSide, name: 'umbrella-fabric' });
  // fictional beach-club banner (hoist band, half sun over a wave) — not a national flag
  const flagTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e0702f'; g.fillRect(0, 0, w * 0.2, h);
    g.fillStyle = '#e9a93c'; g.beginPath(); g.arc(w * 0.6, h * 0.66, h * 0.3, Math.PI, 0); g.fill();
    g.strokeStyle = '#e9a93c'; g.lineWidth = 5;
    for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 7; g.beginPath(); g.moveTo(w * 0.6 + Math.cos(a) * h * 0.36, h * 0.66 + Math.sin(a) * h * 0.36); g.lineTo(w * 0.6 + Math.cos(a) * h * 0.47, h * 0.66 + Math.sin(a) * h * 0.47); g.stroke(); }
    g.fillStyle = '#17606b'; g.beginPath(); g.moveTo(w * 0.2, h); g.lineTo(w * 0.2, h * 0.7);
    for (let x = 0; x <= 1.0001; x += 0.05) g.lineTo(w * (0.2 + 0.8 * x), h * (0.72 + 0.07 * Math.sin(x * Math.PI * 3)));
    g.lineTo(w, h); g.closePath(); g.fill();
  });
  M.flag = new THREE.MeshStandardMaterial({ map: flagTex, normalMap: sets.fabric.normalMap, roughness: 0.9, side: THREE.DoubleSide, name: 'flag' });
  M.flag.userData.programKey = 'flag';
  M.flag.userData.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = M.flag.userData.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
        #endif
        float u = clamp(uv.x, 0.0, 1.0);
        transformed.z += sin(uTime * 4.2 - u * 7.0 + ph) * 0.12 * u + sin(uTime * 7.3 - u * 13.0 + ph) * 0.03 * u;
        transformed.y += sin(uTime * 3.1 - u * 5.0 + ph) * 0.03 * u;`);
  };
  M.flag.userData.time = { value: 0 };
  const signTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#c3281e';
    for (let i = 0; i < 3; i++) { const x = w * (0.18 + i * 0.3); g.beginPath(); g.moveTo(x, h * 0.15); g.lineTo(x + w * 0.16, h * 0.5); g.lineTo(x, h * 0.85); g.lineTo(x + w * 0.08, h * 0.85); g.lineTo(x + w * 0.24, h * 0.5); g.lineTo(x + w * 0.08, h * 0.15); g.closePath(); g.fill(); }
  });
  M.sign = new THREE.MeshStandardMaterial({ map: signTex, normalMap: sets.metal.normalMap, roughness: 0.5, metalness: 0.2, name: 'sign-chevron' });
  const bannerTex = canvasTex(1024, 128, (g, w, h) => { g.fillStyle = '#16232f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2b35b'; g.font = 'bold 80px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CIRCUITO DA COSTA DOURADA', w / 2, h / 2 + 4); });
  M.banner = new THREE.MeshStandardMaterial({ map: bannerTex, normalMap: sets.fabric.normalMap, roughness: 0.8, side: THREE.DoubleSide, name: 'banner' });
  M.lampGlass = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc98a, emissiveIntensity: 0.6, roughness: 0.2, name: 'lamp-glass' });
  M.lampGlass.userData.audit = 'emissive';
  M.reflector = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff7a10, emissiveIntensity: 0.25, roughness: 0.3, name: 'reflector' });
  M.reflector.userData.audit = 'emissive';
  return M;
}

/** each builder returns { parts:[{geometry, material, name}], radius, height } */
export function buildProps(M) {
  const P = {};
  P.lamp = () => {
    const pole = lathe([[0.0, 0], [0.16, 0], [0.16, 0.35], [0.09, 0.45], [0.075, 3.8], [0.06, 4.6], [0.0, 4.62]], 14);
    const arm = new THREE.TorusGeometry(0.45, 0.035, 6, 14, Math.PI * 0.75); T(arm, 0.45, 4.5, 0, 0, 0, 0);
    const head = lathe([[0, 0], [0.2, 0.0], [0.24, 0.12], [0.12, 0.28], [0, 0.32]], 14); T(head, 0.9, 4.05, 0);
    const glass = lathe([[0, 0], [0.17, 0.0], [0.15, -0.16], [0, -0.2]], 12); T(glass, 0.9, 4.06, 0);
    return { parts: [{ geometry: merge([pole, arm, head]), material: M.greenMetal, name: 'lamp' }, { geometry: merge([glass]), material: M.lampGlass, name: 'glass', castShadow: false }], radius: 0.25, height: 4.7 };
  };
  P.flag = () => {
    const pole = lathe([[0, 0], [0.07, 0], [0.05, 0.2], [0.035, 6.2], [0.05, 6.25], [0, 6.3]], 10);
    const flag = new THREE.PlaneGeometry(1.5, 0.95, 10, 4); T(flag, 0.78, 5.6, 0);
    return { parts: [{ geometry: merge([pole]), material: M.whiteMetal, name: 'pole' }, { geometry: flag, material: M.flag, name: 'cloth' }], radius: 0.15, height: 6.3 };
  };
  P.bench = () => {
    const slats = [];
    for (let i = 0; i < 4; i++) slats.push(T(rbox(1.8, 0.045, 0.1, 0.015), 0, 0.46, -0.16 + i * 0.11));
    for (let i = 0; i < 3; i++) slats.push(T(rbox(1.8, 0.1, 0.04, 0.015), 0, 0.62 + i * 0.13, 0.26, 0, -0.2));
    const legShape = new THREE.Shape(); legShape.moveTo(-0.25, 0); legShape.lineTo(-0.18, 0); legShape.lineTo(-0.1, 0.42); legShape.lineTo(0.22, 0.42); legShape.lineTo(0.3, 0.95); legShape.lineTo(0.24, 0.95); legShape.lineTo(0.16, 0.48); legShape.lineTo(-0.05, 0.48); legShape.lineTo(-0.13, 0.02); legShape.lineTo(0.25, 0.02); legShape.lineTo(0.25, 0); legShape.lineTo(-0.25, 0);
    const legs = [];
    for (const x of [-0.75, 0.75]) { const l = new THREE.ExtrudeGeometry(legShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }); l.rotateY(Math.PI / 2); l.translate(x, 0, 0); legs.push(l); }
    return { parts: [{ geometry: merge(slats), material: M.wood, name: 'slats' }, { geometry: merge(legs), material: M.greenMetal, name: 'frame' }], radius: 0.95, height: 1.0 };
  };
  P.bin = () => {
    const body = lathe([[0, 0], [0.24, 0], [0.26, 0.05], [0.26, 0.85], [0.28, 0.9], [0.22, 0.92], [0.2, 0.3], [0, 0.3]], 16);
    const lid = lathe([[0, 0.98], [0.27, 0.92], [0.29, 0.9], [0, 0.9]], 16);
    return { parts: [{ geometry: merge([body, lid]), material: M.greenMetal, name: 'bin' }], radius: 0.3, height: 1.0 };
  };
  P.umbrella = () => {
    const pole = cyl(0.03, 0.025, 2.4, 8); T(pole, 0, 1.2, 0);
    const canopy = lathe([[0.0, 2.55], [0.25, 2.5], [1.2, 2.18], [1.35, 2.08], [1.36, 2.02]], 8);
    const uv = canopy.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i));
    return { parts: [{ geometry: merge([pole]), material: M.whiteMetal, name: 'pole' }, { geometry: canopy, material: M.fabric, name: 'canopy' }], radius: 1.35, height: 2.6 };
  };
  P.lounger = () => {
    const frame = [T(rbox(0.06, 0.06, 1.9, 0.02), -0.32, 0.3, 0), T(rbox(0.06, 0.06, 1.9, 0.02), 0.32, 0.3, 0)];
    for (const z of [-0.85, 0.85]) for (const x of [-0.32, 0.32]) frame.push(T(cyl(0.02, 0.02, 0.3, 6), x, 0.15, z));
    const bed = T(rbox(0.66, 0.05, 1.3, 0.02), 0, 0.36, 0.25);
    const back = T(rbox(0.66, 0.05, 0.62, 0.02), 0, 0.55, -0.6, 0, 0.75);
    return { parts: [{ geometry: merge(frame), material: M.whiteMetal, name: 'frame' }, { geometry: merge([bed, back]), material: M.fabric, name: 'fabric' }], radius: 1.0, height: 0.9 };
  };
  P.fence = () => {
    const parts = [];
    for (const x of [-2, 2]) parts.push(T(cyl(0.06, 0.05, 1.35, 7), x, 0.62, 0));
    for (let i = 0; i < 34; i++) { const x = -1.95 + i * 0.118; const hgt = 1.05 + Math.sin(i * 1.7) * 0.06; parts.push(T(rbox(0.04, hgt, 0.018, 0.006, 1), x, hgt / 2 + 0.03, 0, 0, 0, Math.sin(i * 2.3) * 0.05)); }
    for (const y of [0.3, 0.85]) parts.push(T(cyl(0.008, 0.008, 4.0, 4), 0, y, 0.012, 0, 0, Math.PI / 2));
    return { parts: [{ geometry: merge(parts), material: M.woodDark, name: 'fence' }], radius: 2.0, height: 1.3 };
  };
  P.tower = () => {
    const parts = [];
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) parts.push(T(cyl(0.07, 0.07, 2.4, 8), x, 1.2, z));
    parts.push(T(rbox(2.2, 0.12, 2.2, 0.03), 0, 2.45, 0));
    const hut = T(rbox(1.7, 1.4, 1.7, 0.05), 0, 3.2, 0);
    const roofShape = lathe([[0, 4.35], [1.45, 3.85], [1.5, 3.8]], 4); roofShape.rotateY(Math.PI / 4);
    const ladder = [T(cyl(0.035, 0.035, 2.8, 6), -0.25, 1.3, 1.5, 0, 0.35), T(cyl(0.035, 0.035, 2.8, 6), 0.25, 1.3, 1.5, 0, 0.35)];
    for (let i = 0; i < 7; i++) ladder.push(T(cyl(0.02, 0.02, 0.5, 5), 0, 0.3 + i * 0.36, 1.98 - i * 0.13, 0, 0, Math.PI / 2));
    return { parts: [{ geometry: merge([...parts, ...ladder]), material: M.wood, name: 'wood' }, { geometry: merge([hut]), material: M.whiteMetal, name: 'hut' }, { geometry: roofShape, material: M.terracotta, name: 'roof' }], radius: 1.6, height: 4.4 };
  };
  P.boat = () => {
    // lofted hull
    const pos = [], idx = [];
    const L = 4.2, Wd = 1.5, Hh = 0.7, nS = 14, nC = 10;
    for (let i = 0; i <= nS; i++) {
      const t = i / nS; const z = (t - 0.5) * L;
      const w = Wd * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.7) * (t > 0.85 ? 1 - (t - 0.85) * 3 : 1);
      for (let k = 0; k <= nC; k++) { const a = Math.PI * (k / nC); const x = -Math.cos(a) * w; const y = Hh - Math.sin(a) * Hh * (0.85 + 0.15 * Math.cos(t * Math.PI)); pos.push(x, y + (t > 0.8 ? (t - 0.8) * 1.2 : 0), z); }
    }
    for (let i = 0; i < nS; i++) for (let k = 0; k < nC; k++) { const a = i * (nC + 1) + k, b = a + nC + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setIndex(idx);
    const uvs = []; for (let i = 0; i < pos.length; i += 3) uvs.push(pos[i + 2] * 0.5, pos[i + 1] * 0.8); hull.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); hull.computeVertexNormals();
    const seats = [T(rbox(1.2, 0.05, 0.3, 0.02), 0, 0.5, -0.5), T(rbox(1.3, 0.05, 0.3, 0.02), 0, 0.5, 0.6)];
    return { parts: [{ geometry: merge([hull]), material: M.whiteMetal, name: 'hull', side: true }, { geometry: merge(seats), material: M.wood, name: 'seats' }], radius: 2.2, height: 1.0 };
  };
  P.delineator = () => {
    const post = lathe([[0, 0], [0.07, 0], [0.065, 1.0], [0.05, 1.05], [0, 1.06]], 8);
    const refl = T(rbox(0.06, 0.16, 0.03, 0.01, 1), 0, 0.85, 0.06);
    return { parts: [{ geometry: merge([post]), material: M.whiteMetal, name: 'post' }, { geometry: merge([refl]), material: M.reflector, name: 'reflector', castShadow: false }], radius: 0.1, height: 1.05 };
  };
  P.chevron = () => {
    const posts = [T(cyl(0.035, 0.035, 1.6, 8), -0.45, 0.8, 0), T(cyl(0.035, 0.035, 1.6, 8), 0.45, 0.8, 0)];
    const panel = T(rbox(1.3, 0.6, 0.03, 0.02, 2), 0, 1.6, 0.04);
    // map the panel face with uv 0..1
    const uv = panel.attributes.uv; const p = panel.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 1.3 + 0.5, (p.getY(i) - 1.3) / 0.6);
    return { parts: [{ geometry: merge(posts), material: M.galv, name: 'posts' }, { geometry: merge([panel]), material: M.sign, name: 'panel' }], radius: 0.7, height: 1.9 };
  };
  P.planter = () => {
    const pot = lathe([[0, 0.05], [0.38, 0], [0.48, 0.55], [0.52, 0.6], [0.44, 0.62], [0.4, 0.45], [0, 0.45]], 14);
    return { parts: [{ geometry: pot, material: M.terracotta, name: 'pot' }], radius: 0.55, height: 0.65 };
  };
  P.bollard = () => {
    const b = lathe([[0, 0], [0.13, 0], [0.12, 0.08], [0.09, 0.15], [0.08, 0.8], [0.11, 0.86], [0.09, 0.92], [0, 0.98]], 12);
    return { parts: [{ geometry: b, material: M.greenMetal, name: 'bollard' }], radius: 0.15, height: 1.0 };
  };
  P.cafe = () => {
    const top = lathe([[0, 0.74], [0.38, 0.74], [0.38, 0.76], [0, 0.77]], 16);
    const leg = cyl(0.025, 0.025, 0.74, 8); T(leg, 0, 0.37, 0);
    const base = lathe([[0, 0], [0.24, 0], [0.18, 0.04], [0, 0.05]], 12);
    const chairs = [];
    for (const a of [0, Math.PI]) {
      const seat = T(rbox(0.42, 0.04, 0.42, 0.015), 0, 0.46, 0); const back = T(rbox(0.42, 0.42, 0.04, 0.015), 0, 0.7, 0.2);
      const legs = [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, z]) => T(cyl(0.015, 0.015, 0.46, 5), x, 0.23, z));
      const ch = merge([seat, back, ...legs]); ch.rotateY(a); ch.translate(Math.sin(a) * -0.62, 0, Math.cos(a) * -0.62); chairs.push(ch);
    }
    return { parts: [{ geometry: merge([top, leg, base]), material: M.whiteMetal, name: 'table' }, { geometry: merge(chairs), material: M.wood, name: 'chairs' }], radius: 1.0, height: 0.95 };
  };
  P.crate = () => ({ parts: [{ geometry: merge([rbox(0.8, 0.6, 0.6, 0.03), T(rbox(0.82, 0.08, 0.62, 0.02), 0, 0.2, 0), T(rbox(0.82, 0.08, 0.62, 0.02), 0, -0.2, 0)].map((g) => T(g, 0, 0.3, 0))), material: M.wood, name: 'crate' }], radius: 0.5, height: 0.62 });
  P.barrel = () => ({ parts: [{ geometry: lathe([[0, 0], [0.27, 0], [0.31, 0.2], [0.33, 0.45], [0.31, 0.7], [0.27, 0.9], [0, 0.9]], 14), material: M.woodDark, name: 'barrel' }], radius: 0.35, height: 0.9 });
  P.picnic = () => {
    const parts = [T(rbox(1.9, 0.05, 0.8, 0.015), 0, 0.75, 0), T(rbox(1.9, 0.05, 0.3, 0.015), 0, 0.45, 0.62), T(rbox(1.9, 0.05, 0.3, 0.015), 0, 0.45, -0.62)];
    for (const x of [-0.7, 0.7]) { parts.push(T(rbox(0.06, 0.95, 0.06, 0.01), x, 0.38, 0.35, 0, 0.5)); parts.push(T(rbox(0.06, 0.95, 0.06, 0.01), x, 0.38, -0.35, 0, -0.5)); }
    return { parts: [{ geometry: merge(parts), material: M.wood, name: 'picnic' }], radius: 1.1, height: 0.8 };
  };
  P.telescope = () => {
    const pole = lathe([[0, 0], [0.18, 0], [0.12, 0.1], [0.06, 1.1], [0, 1.12]], 10);
    const scope = cyl(0.09, 0.12, 0.55, 12); T(scope, 0, 1.28, 0, 0, Math.PI / 2 - 0.15);
    return { parts: [{ geometry: merge([pole, scope]), material: M.greenMetal, name: 'telescope' }], radius: 0.3, height: 1.4 };
  };
  P.kmstone = () => {
    const post = lathe([[0, 0], [0.2, 0], [0.2, 0.55], [0.17, 0.66], [0.1, 0.72], [0, 0.74]], 14);
    const cap = lathe([[0, 0.6], [0.205, 0.6], [0.18, 0.67], [0.11, 0.73], [0, 0.75]], 14);
    return { parts: [{ geometry: post, material: M.concrete, name: 'stone' }, { geometry: cap, material: M.terracotta, name: 'cap' }], radius: 0.22, height: 0.75 };
  };
  P.tires = () => {
    const parts = []; for (let i = 0; i < 4; i++) { const t = new THREE.TorusGeometry(0.3, 0.12, 8, 16); t.rotateX(Math.PI / 2); t.translate(0, 0.12 + i * 0.22, 0); parts.push(t); }
    return { parts: [{ geometry: merge(parts), material: M.rubberProp || M.woodDark, name: 'tires' }], radius: 0.45, height: 0.95 };
  };
  return P;
}

/** procedural rock (displaced icosphere), a few variants */
export function rockGeometry(seed, flat = 0.75) {
  const r = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const off = [r() * 10, r() * 10, r() * 10];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 2.1 + off[0]) * Math.cos(y * 2.7 + off[1]) * 0.18 + Math.sin(z * 3.3 + off[2] + x) * 0.12 + Math.sin(x * 7 + y * 5 + z * 6) * 0.04;
    const k = 1 + n;
    // jitter keyed by position: coincident vertices of neighbouring faces move together (no cracks)
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453, jit = 1 + 0.02 * (h - Math.floor(h));
    p.setXYZ(i, x * k * jit, y * k * flat, z * k);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.5 + p.getZ(i) * 0.3, p.getY(i) * 0.5);
  return g;
}
