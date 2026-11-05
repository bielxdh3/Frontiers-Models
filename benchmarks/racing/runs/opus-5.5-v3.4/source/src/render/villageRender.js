// Village rendering: merged house geometry per material, church with bell
// tower, plaza paving draped on the terrain pad, fountain.
import * as THREE from 'three';
import { buildHouse, newAccumulators, HOUSE_MATERIALS } from '../world/houses.js';
import { withRepeat, loadedTextures } from './textures.js';

function canvasTex(w, h, draw, srgb = true) { const W = Math.max(1024, w), H = Math.max(1024, h); const c = document.createElement('canvas'); c.width = W; c.height = H; const g2 = c.getContext('2d'); g2.setTransform(W / w, 0, 0, H / h, 0, 0); draw(g2, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.src = 'generated-village'; loadedTextures.add(t); return t; }

export function villageMaterials(sets, foliageTex) {
  const std = (set, opt = {}) => {
    const m = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.orm, aoMap: opt.ao ? set.orm : null, roughness: opt.roughness ?? 1, metalness: opt.metalness ?? 0, color: opt.color ?? 0xffffff, vertexColors: !!opt.vc, name: opt.name });
    return m;
  };
  const shutterTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#f4f4f4'); gr.addColorStop(0.7, '#c9c9c9'); gr.addColorStop(1, '#8a8a8a'); g.fillStyle = gr; g.fillRect(8, y + 1, w - 16, 14); } g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); g.fillRect(0, h / 2 - 4, w, 8); });
  const winTex = canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2b3440'); gr.addColorStop(1, '#0d1116'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(235,225,205,0.75)'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w * 0.25, h * 0.55, w * 0.12, h); g.lineTo(0, h); g.fill(); g.beginPath(); g.moveTo(w, 0); g.quadraticCurveTo(w * 0.75, h * 0.55, w * 0.88, h); g.lineTo(w, h); g.fill(); g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(w * 0.3, 0, w * 0.4, h); });
  const awnTex = canvasTex(512, 128, (g, w, h) => { const cols = ['#e9e2d2', '#2f6f63', '#e9e2d2', '#b7442e']; for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect((i * w) / 16, 0, w / 16 + 1, h); } });
  const M = {
    plaster: std(withRepeat(sets.plaster, 1), { vc: true, name: 'house-plaster', ao: false }),
    stone: std(withRepeat(sets.stone, 1), { name: 'house-stone', vc: true }),
    trim: std(withRepeat(sets.trim, 1), { color: 0xeee3cf, name: 'house-trim' }),
    wood: std(withRepeat(sets.wood, 1), { vc: true, name: 'house-wood' }),
    shutter: new THREE.MeshStandardMaterial({ map: shutterTex, normalMap: sets.wood.normalMap, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, name: 'house-shutter' }),
    glass: new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.12, metalness: 0.05, envMapIntensity: 1.3, name: 'house-window-glass' }),
    roof: std(withRepeat(sets.roof, 1), { name: 'house-roof-tiles', ao: true, vc: true }),
    roofcap: std(withRepeat(sets.roof, 1), { color: 0xc98a6a, name: 'house-roof-ridge' }),
    iron: std(withRepeat(sets.metal, 1), { color: 0x2a2826, metalness: 0.6, roughness: 0.6, name: 'house-iron' }),
    awning: new THREE.MeshStandardMaterial({ map: awnTex, normalMap: sets.fabric.normalMap, roughness: 0.9, side: THREE.DoubleSide, name: 'house-awning' }),
    terracotta: std(withRepeat(sets.plaster, 1), { color: 0xb5603c, name: 'house-terracotta' }),
    flowers: new THREE.MeshStandardMaterial({ map: foliageTex.shrubFlower, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, name: 'house-flowers' }),
    woodDark: std(withRepeat(sets.wood, 1), { color: 0x6e5240, name: 'house-wood-dark' }),
  };
  M.glass.userData.audit = 'glass';
  return M;
}

function accToMeshes(acc, M, group, name) {
  for (const k of HOUSE_MATERIALS) {
    const A = acc[k]; if (!A.idx.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
    g.setIndex(A.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(A.idx, 1) : new THREE.Uint16BufferAttribute(A.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, M[k]);
    // thin iron railings do not cast (costly, and thin shadows shimmer); walls, trims, roofs, wood and stone do
    mesh.castShadow = k !== 'glass' && k !== 'flowers' && k !== 'iron'; mesh.receiveShadow = true;
    mesh.name = `${name}:${k}`; mesh.userData.audit = { kind: 'house', part: k };
    group.add(mesh);
  }
}

export function buildVillageRender(world, M, sets) {
  const V = world.village; const group = new THREE.Group(); group.name = 'village';
  // houses merged in two spatial buckets (each side of the plaza) for culling
  const buckets = new Map();
  for (const h of V.houses) {
    const key = Math.floor(h.x / 600) + ',' + Math.floor(h.z / 600);
    let acc = buckets.get(key); if (!acc) { acc = newAccumulators(); buckets.set(key, acc); }
    const info = buildHouse(acc, { x: h.x, y: h.y, z: h.z, yaw: h.yaw, W: h.W, D: h.D, style: h.style, seed: h.seed });
    h.info = info;
  }
  for (const [k, acc] of buckets) accToMeshes(acc, M, group, 'houses' + k);
  // church
  const acc = newAccumulators();
  buildChurch(acc, V.church);
  accToMeshes(acc, M, group, 'church');
  // plaza paving
  group.add(plazaMesh(world, sets));
  group.add(fountain(V.plaza.fountain, sets));
  return group;
}

function plazaMesh(world, sets) {
  const T = world.track, P = world.village.plaza;
  const pos = [], uv = [], idx = [];
  const ds = 2, dd = 2;
  const L = T.delta(P.s0, P.s1);
  const nS = Math.ceil(L / ds), nD = Math.ceil((P.d1 - P.d0) / dd);
  for (let i = 0; i <= nS; i++) for (let j = 0; j <= nD; j++) {
    const s = P.s0 + (i / nS) * L, d = P.d0 + (j / nD) * (P.d1 - P.d0);
    const p = T.point(s, P.side * d);
    const y = world.terrain.heightAt(p[0], p[2]) + 0.05;
    pos.push(p[0], y, p[2]); uv.push(p[0] * 0.42, p[2] * 0.42);
  }
  for (let i = 0; i < nS; i++) for (let j = 0; j < nD; j++) {
    const a = i * (nD + 1) + j, b = a + 1, c = a + nD + 1, d = c + 1;
    if (P.side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // make sure normals point up
  const n = g.attributes.normal; if (n.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  const s = withRepeat(sets.cobble, 1);
  const m = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.orm, aoMap: s.orm, roughness: 1, name: 'plaza-cobbles' });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'plaza'; mesh.userData.audit = { kind: 'plaza' };
  return mesh;
}

function fountain(f, sets) {
  const grp = new THREE.Group(); grp.name = 'fountain';
  const st = withRepeat(sets.trim, 1.2);
  const stone = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.orm, roughness: 1, color: 0xe8dcc6, name: 'fountain-stone' });
  const basin = new THREE.LatheGeometry([[0, 0], [3.2, 0], [3.25, 0.55], [3.0, 0.62], [2.85, 0.25], [0, 0.25]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  const column = new THREE.LatheGeometry([[0, 0.2], [0.55, 0.2], [0.45, 0.4], [0.28, 1.4], [0.9, 1.55], [0.95, 1.7], [0.3, 1.75], [0.22, 2.4], [0.5, 2.5], [0.1, 2.75], [0, 2.8]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const m1 = new THREE.Mesh(basin, stone), m2 = new THREE.Mesh(column, stone);
  for (const m of [m1, m2]) { m.castShadow = true; m.receiveShadow = true; m.userData.audit = { kind: 'prop', type: 'fountain' }; }
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 40), new THREE.MeshStandardMaterial({ color: 0x2c5560, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5, name: 'fountain-water' }));
  water.material.userData.audit = 'water'; water.rotation.x = -Math.PI / 2; water.position.y = 0.48; water.userData.audit = { kind: 'water' };
  grp.add(m1, m2, water);
  grp.position.set(f.x, f.y - 0.05, f.z);
  return grp;
}

/** church: nave with tall windows + rose window, door with surround, gable roof, bell tower with belfry */
function buildChurch(acc, c) {
  // reuse the house builder primitives through a lightweight local builder
  const cx = Math.cos(c.yaw), sx = Math.sin(c.yaw);
  const T = (x, y, z) => [c.x + x * cx - z * sx, c.y + y, c.z + x * sx + z * cx];
  const N = (x, y, z) => [x * cx - z * sx, y, x * sx + z * cx];
  const quad = (mat, a, b, cc, d, n, uvs) => {
    const A = acc[mat], base = A.pos.length / 3;
    for (const p of [a, b, cc, d]) A.pos.push(...T(...p));
    const nn = N(...n); for (let k = 0; k < 4; k++) { A.nor.push(...nn); A.col.push(0.98, 0.95, 0.88); }
    for (const u of uvs) A.uv.push(...u);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (g[0] * n[0] + g[1] * n[1] + g[2] * n[2] >= 0) A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); else A.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  const box = (mat, x0, y0, z0, x1, y1, z1, s = 0.5) => {
    quad(mat, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], [[x0 * s, y0 * s], [x1 * s, y0 * s], [x1 * s, y1 * s], [x0 * s, y1 * s]]);
    quad(mat, [x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], [[x1 * s, y0 * s], [x0 * s, y0 * s], [x0 * s, y1 * s], [x1 * s, y1 * s]]);
    quad(mat, [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], [[z1 * s, y0 * s], [z0 * s, y0 * s], [z0 * s, y1 * s], [z1 * s, y1 * s]]);
    quad(mat, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]]);
    quad(mat, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]]);
  };
  // walls with openings: simplified by stacking wall pieces around the openings
  const W = c.W, D = c.D, H = 11, yb = -0.8;
  const wallPieces = (mat, z, n, openings) => {
    // vertical strips between openings
    const xs = [0, ...openings.flatMap((o) => [o.u, o.u + o.w]), W].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      const op = openings.find((o) => Math.abs(o.u - x0) < 1e-6 && Math.abs(o.u + o.w - x1) < 1e-6);
      const t = n[2] < 0 ? 0 : 0;
      if (!op) { quad(mat, [x0, yb, z], [x1, yb, z], [x1, H, z], [x0, H, z], n, [[x0 * 0.5, yb * 0.5], [x1 * 0.5, yb * 0.5], [x1 * 0.5, H * 0.5], [x0 * 0.5, H * 0.5]]); continue; }
      quad(mat, [x0, yb, z], [x1, yb, z], [x1, op.v, z], [x0, op.v, z], n, [[x0 * 0.5, yb * 0.5], [x1 * 0.5, yb * 0.5], [x1 * 0.5, op.v * 0.5], [x0 * 0.5, op.v * 0.5]]);
      quad(mat, [x0, op.v + op.h, z], [x1, op.v + op.h, z], [x1, H, z], [x0, H, z], n, [[x0 * 0.5, (op.v + op.h) * 0.5], [x1 * 0.5, (op.v + op.h) * 0.5], [x1 * 0.5, H * 0.5], [x0 * 0.5, H * 0.5]]);
      const zi = z + (n[2] < 0 ? 0.35 : -0.35);
      quad(op.mat || 'glass', [x0, op.v, zi], [x1, op.v, zi], [x1, op.v + op.h, zi], [x0, op.v + op.h, zi], n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // reveals
      quad(mat, [x0, op.v, z], [x0, op.v, zi], [x0, op.v + op.h, zi], [x0, op.v + op.h, z], [1, 0, 0], [[0, 0], [0.2, 0], [0.2, 1], [0, 1]]);
      quad(mat, [x1, op.v, zi], [x1, op.v, z], [x1, op.v + op.h, z], [x1, op.v + op.h, zi], [-1, 0, 0], [[0, 0], [0.2, 0], [0.2, 1], [0, 1]]);
      quad(mat, [x0, op.v + op.h, z], [x1, op.v + op.h, z], [x1, op.v + op.h, zi], [x0, op.v + op.h, zi], [0, -1, 0], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]]);
      // stone surround
      box('trim', x0 - 0.22, op.v + op.h, z - 0.06 * (n[2] < 0 ? 1 : -1), x1 + 0.22, op.v + op.h + 0.35, z, 0.8);
    }
  };
  wallPieces('stone', 0, [0, 0, -1], [{ u: W / 2 - 1.1, v: 0, w: 2.2, h: 4.2, mat: 'woodDark' }]);
  wallPieces('stone', D, [0, 0, 1], []);
  // side walls with tall windows
  for (const [x, n] of [[0, [-1, 0, 0]], [W, [1, 0, 0]]]) {
    const ops = [3.5, 8.5, 13.5, 18.5].map((zz) => ({ z: zz, w: 1.2, v: 4.2, h: 4.5 }));
    let prev = 0;
    for (const o of ops) {
      quad('stone', [x, yb, prev], [x, yb, o.z - o.w / 2], [x, H, o.z - o.w / 2], [x, H, prev], n, [[prev * 0.5, yb * 0.5], [(o.z - o.w / 2) * 0.5, yb * 0.5], [(o.z - o.w / 2) * 0.5, H * 0.5], [prev * 0.5, H * 0.5]]);
      quad('stone', [x, yb, o.z - o.w / 2], [x, yb, o.z + o.w / 2], [x, o.v, o.z + o.w / 2], [x, o.v, o.z - o.w / 2], n, [[0, 0], [0.6, 0], [0.6, 2], [0, 2]]);
      quad('stone', [x, o.v + o.h, o.z - o.w / 2], [x, o.v + o.h, o.z + o.w / 2], [x, H, o.z + o.w / 2], [x, H, o.z - o.w / 2], n, [[0, 0], [0.6, 0], [0.6, 1], [0, 1]]);
      const xi = x + (n[0] < 0 ? 0.35 : -0.35);
      quad('glass', [xi, o.v, o.z - o.w / 2], [xi, o.v, o.z + o.w / 2], [xi, o.v + o.h, o.z + o.w / 2], [xi, o.v + o.h, o.z - o.w / 2], n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      quad('stone', [x, o.v, o.z - o.w / 2], [xi, o.v, o.z - o.w / 2], [xi, o.v + o.h, o.z - o.w / 2], [x, o.v + o.h, o.z - o.w / 2], [0, 0, 1], [[0, 0], [0.2, 0], [0.2, 1], [0, 1]]);
      quad('stone', [xi, o.v, o.z + o.w / 2], [x, o.v, o.z + o.w / 2], [x, o.v + o.h, o.z + o.w / 2], [xi, o.v + o.h, o.z + o.w / 2], [0, 0, -1], [[0, 0], [0.2, 0], [0.2, 1], [0, 1]]);
      prev = o.z + o.w / 2;
    }
    quad('stone', [x, yb, prev], [x, yb, D], [x, H, D], [x, H, prev], n, [[prev * 0.5, yb * 0.5], [D * 0.5, yb * 0.5], [D * 0.5, H * 0.5], [prev * 0.5, H * 0.5]]);
  }
  // rose window (octagonal disc) on the facade above the door
  {
    const A = acc.glass, base = A.pos.length / 3; const cxr = W / 2, cyr = 7.6, rr = 1.4, z = -0.05;
    A.pos.push(...T(cxr, cyr, z)); A.nor.push(...N(0, 0, -1)); A.uv.push(0.5, 0.5); A.col.push(1, 1, 1);
    for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; A.pos.push(...T(cxr + Math.cos(a) * rr, cyr + Math.sin(a) * rr, z)); A.nor.push(...N(0, 0, -1)); A.uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5); A.col.push(1, 1, 1); }
    for (let k = 0; k < 16; k++) A.idx.push(base, base + 1 + k + 1, base + 1 + k);
    box('trim', cxr - rr - 0.2, cyr - rr - 0.2, -0.12, cxr + rr + 0.2, cyr - rr, 0, 0.8);
  }
  // cornice + gable roof (ridge along z)
  box('trim', -0.3, H - 0.3, -0.3, W + 0.3, H, D + 0.3, 0.8);
  const ridge = 4.4, ex = 0.6;
  const sl = Math.hypot(W / 2 + ex, ridge);
  // each slope is laid as overlapping tile courses (every lower edge sits proud of the course
  // below), with eave fascia boards and a ridge cap
  const rows = 9, lift = 0.06;
  for (const sgn of [-1, 1]) {
    const xe = sgn < 0 ? -ex : W + ex;
    const nrm = [sgn * ridge / sl, (W / 2 + ex) / sl, 0];
    const ox = nrm[0] * lift, oy = nrm[1] * lift;
    for (let k = 0; k < rows; k++) {
      const t0 = k / rows, t1 = (k + 1) / rows;
      const x0 = xe + (W / 2 - xe) * t0, y0 = H + ridge * t0, x1 = xe + (W / 2 - xe) * t1, y1 = H + ridge * t1;
      const u1 = (D + 2 * ex) * 0.6, v0 = t0 * sl * 0.6, v1 = t1 * sl * 0.6;
      quad('roof', [x0 + ox, y0 + oy, -ex], [x0 + ox, y0 + oy, D + ex], [x1, y1, D + ex], [x1, y1, -ex], nrm, [[0, v0], [u1, v0], [u1, v1], [0, v1]]);
      quad('roof', [x0, y0, -ex], [x0, y0, D + ex], [x0 + ox, y0 + oy, D + ex], [x0 + ox, y0 + oy, -ex], [sgn * 0.6, -0.8, 0], [[0, v0], [u1, v0], [u1, v0 + 0.03], [0, v0 + 0.03]]);
    }
    box('woodDark', sgn < 0 ? -ex - 0.06 : W + ex - 0.06, H - 0.28, -ex, sgn < 0 ? -ex + 0.06 : W + ex + 0.06, H + 0.06, D + ex, 0.8);
  }
  box('roof', W / 2 - 0.2, H + ridge - 0.06, -ex - 0.05, W / 2 + 0.2, H + ridge + 0.16, D + ex + 0.05, 0.6);
  // paneled double door in the recessed portal (leaf plane at z = 0.35)
  for (const [u0, u1] of [[W / 2 - 1.08, W / 2 - 0.04], [W / 2 + 0.04, W / 2 + 1.08]]) {
    for (const [v0, v1] of [[0.25, 1.3], [1.5, 2.65], [2.85, 3.95]]) box('woodDark', u0 + 0.13, v0, 0.3, u1 - 0.13, v1, 0.35, 0.8);
    box('iron', (u0 + u1) / 2 + (u0 < W / 2 - 0.5 ? 0.32 : -0.32) - 0.03, 1.95, 0.27, (u0 + u1) / 2 + (u0 < W / 2 - 0.5 ? 0.32 : -0.32) + 0.03, 2.25, 0.3, 1);
  }
  box('woodDark', W / 2 - 0.05, 0, 0.31, W / 2 + 0.05, 4.2, 0.35, 0.8);
  for (const [z, n] of [[0, [0, 0, -1]], [D, [0, 0, 1]]]) {
    const A = acc.stone, base = A.pos.length / 3;
    for (const p of [[0, H, z], [W, H, z], [W / 2, H + ridge - 0.1, z]]) { A.pos.push(...T(...p)); A.nor.push(...N(...n)); A.col.push(1, 1, 1); }
    A.uv.push(0, 0, W * 0.5, 0, W * 0.25, ridge * 0.5);
    if (n[2] < 0) A.idx.push(base, base + 2, base + 1); else A.idx.push(base, base + 1, base + 2);
  }
  // bell tower beside the facade
  const tu = c.tower.u, tw = c.tower.w, th = c.tower.h;
  const tx0 = tu, tx1 = tu + tw, tz0 = -0.5, tz1 = tw - 0.5;
  box('stone', tx0, yb, tz0, tx1, th - 6, tz1, 0.5);
  box('trim', tx0 - 0.25, th - 6, tz0 - 0.25, tx1 + 0.25, th - 5.6, tz1 + 0.25, 0.8);
  // belfry: 4 corner pillars + arches
  for (const [px, pz] of [[tx0, tz0], [tx1 - 0.9, tz0], [tx0, tz1 - 0.9], [tx1 - 0.9, tz1 - 0.9]]) box('stone', px, th - 5.6, pz, px + 0.9, th - 1.2, pz + 0.9, 0.5);
  box('trim', tx0 - 0.25, th - 1.2, tz0 - 0.25, tx1 + 0.25, th - 0.8, tz1 + 0.25, 0.8);
  // pyramidal roof
  const pcx = (tx0 + tx1) / 2, pcz = (tz0 + tz1) / 2, ph = 4.2, e2 = 0.35;
  const apex = [pcx, th - 0.8 + ph, pcz];
  const cs = [[tx0 - e2, th - 0.8, tz0 - e2], [tx1 + e2, th - 0.8, tz0 - e2], [tx1 + e2, th - 0.8, tz1 + e2], [tx0 - e2, th - 0.8, tz1 + e2]];
  for (let k = 0; k < 4; k++) {
    const a = cs[k], b = cs[(k + 1) % 4];
    const mx = (a[0] + b[0]) / 2 - pcx, mz = (a[2] + b[2]) / 2 - pcz; const l = Math.hypot(mx, mz);
    const A = acc.roof, base = A.pos.length / 3;
    for (const p of [a, b, apex]) { A.pos.push(...T(...p)); A.col.push(1, 1, 1); }
    const nn = N(mx / l * 0.7, 0.7, mz / l * 0.7); for (let q = 0; q < 3; q++) A.nor.push(...nn);
    A.uv.push(0, 0, tw * 0.6, 0, tw * 0.3, ph * 0.7);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e3 = [apex[0] - a[0], apex[1] - a[1], apex[2] - a[2]];
    const g = [e1[1] * e3[2] - e1[2] * e3[1], e1[2] * e3[0] - e1[0] * e3[2], e1[0] * e3[1] - e1[1] * e3[0]];
    if (g[0] * mx + g[2] * mz >= 0) A.idx.push(base, base + 1, base + 2); else A.idx.push(base, base + 2, base + 1);
  }
  // cross
  box('iron', pcx - 0.06, apex[1], pcz - 0.06, pcx + 0.06, apex[1] + 1.6, pcz + 0.06, 1);
  box('iron', pcx - 0.45, apex[1] + 1.0, pcz - 0.06, pcx + 0.45, apex[1] + 1.12, pcz + 0.06, 1);
  // bell (approximate with stacked boxes -> trimmed later by the lathe bell below)
  box('iron', pcx - 0.5, th - 4.2, pcz - 0.5, pcx + 0.5, th - 3.0, pcz + 0.5, 1);
  c.bellPos = T(pcx, th - 3.5, pcz);
  c.towerTop = T(pcx, apex[1] + 1.6, pcz);
}
