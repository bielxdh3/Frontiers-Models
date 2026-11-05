// Visual meshes for barrier runs (same polylines as the colliders): profile
// sweeps with PBR textures (stone parapets, plastered walls, retaining walls,
// W-beam guardrails with posts, bridge parapets, balustrades).
import * as THREE from 'three';
import { withRepeat } from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// profiles: [x (outward from road), y] closed-ish polylines in the vertical plane
const PROFILES = {
  promenade: { parts: [{ mat: 'stone', pts: [[-0.22, -0.45], [-0.22, 0.85], [0.22, 0.85], [0.22, -0.45]] }, { mat: 'cap', pts: [[-0.3, 0.83], [-0.3, 0.95], [-0.26, 0.99], [0.26, 0.99], [0.3, 0.95], [0.3, 0.83]] }] },
  lowwall: { parts: [{ mat: 'plaster', pts: [[-0.16, -0.45], [-0.16, 0.72], [0.16, 0.72], [0.16, -0.45]] }, { mat: 'cap', pts: [[-0.22, 0.7], [-0.22, 0.8], [-0.18, 0.84], [0.18, 0.84], [0.22, 0.8], [0.22, 0.7]] }] },
  retaining: { parts: [{ mat: 'stone', pts: [[-0.3, -0.45], [-0.24, 1.05], [0.3, 1.1], [0.35, -0.45]] }, { mat: 'cap', pts: [[-0.3, 1.02], [-0.3, 1.12], [0.34, 1.16], [0.34, 1.06]] }] },
  parapet: { parts: [{ mat: 'stone2', pts: [[-0.2, -1.4], [-0.2, 0.98], [0.25, 0.98], [0.25, -1.4]] }, { mat: 'cap', pts: [[-0.26, 0.96], [-0.26, 1.06], [0.3, 1.06], [0.3, 0.96]] }] },
  streetwall: { parts: [{ mat: 'stone', pts: [[-0.2, -0.45], [-0.2, 0.95], [0.25, 0.95], [0.25, -0.45]] }, { mat: 'cap', pts: [[-0.26, 0.93], [-0.26, 1.04], [0.3, 1.04], [0.3, 0.93]] }] },
  plazaedge: { parts: [{ mat: 'stone2', pts: [[-0.18, -0.45], [-0.18, 0.75], [0.18, 0.75], [0.18, -0.45]] }, { mat: 'cap', pts: [[-0.24, 0.73], [-0.24, 0.84], [0.24, 0.84], [0.24, 0.73]] }] },
  mirante: { parts: [{ mat: 'stone2', pts: [[-0.18, -0.45], [-0.18, 0.55], [0.18, 0.55], [0.18, -0.45]] }, { mat: 'cap', pts: [[-0.24, 0.53], [-0.24, 0.62], [0.24, 0.62], [0.24, 0.53]] }] },
  guardrail: { parts: [{ mat: 'galv', pts: [[-0.02, 0.48], [0.02, 0.5], [0.07, 0.56], [0.03, 0.62], [0.07, 0.69], [0.02, 0.76], [-0.02, 0.78], [-0.02, 0.48]] }] },
};

function sweep(pts, profile, uScale = 1) {
  const pos = [], uv = [], idx = [];
  const n = pts.length, m = profile.length;
  // per-vertex perimeter coordinate for v
  const per = [0]; for (let j = 1; j < m; j++) per.push(per[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const p = pts[k], a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const ox = -tz * p.side, oz = tx * p.side; // outward
    if (k > 0) acc += Math.hypot(p.x - pts[k - 1].x, p.z - pts[k - 1].z);
    for (let j = 0; j < m; j++) {
      const [px, py] = profile[j];
      pos.push(p.x + ox * px, p.y + py, p.z + oz * px);
      uv.push(acc * uScale, per[j] * uScale);
    }
  }
  for (let k = 0; k < n - 1; k++) for (let j = 0; j < m - 1; j++) {
    const a = k * m + j, b = a + m;
    if (pts[k].side > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

export function buildBarrierMeshes(world, sets, instances, propMats) {
  const mats = {
    stone: mk(withRepeat(sets.stone, 0.55), 'wall-stone'), stone2: mk(withRepeat(sets.stone2, 0.6), 'wall-stone-church'),
    plaster: mk(withRepeat(sets.plaster, 0.45), 'wall-plaster', 0xf0e6d4), cap: mk(withRepeat(sets.concrete, 0.7), 'wall-cap', 0xe2d8c8),
    galv: new THREE.MeshStandardMaterial({ map: withRepeat(sets.metal, 0.5).map, normalMap: withRepeat(sets.metal, 0.5).normalMap, color: 0xd4d8dc, metalness: 0.85, roughness: 0.42, side: THREE.DoubleSide, name: 'guardrail-steel' }),
  };
  const group = new THREE.Group(); group.name = 'barrier-visuals';
  const posts = [];
  // collect pieces per material and spatial bucket (~500 m), then merge -> few draw calls
  const buckets = new Map();
  for (const r of world.barriers.runs) {
    const prof = PROFILES[r.type]; if (!prof) continue;
    const chunk = 60;
    // split the run where houses stand directly on the street line (their facades + bollards replace the wall)
    const fronts = (world.village && world.village.fronts) || [];
    const covered = (p) => r.type === 'streetwall' && fronts.some((f) => f.side === r.side && world.track.inRange(p.s, f.s0, f.s1));
    const pieces = []; let cur = [];
    for (const p of r.pts) { if (covered(p)) { if (cur.length > 1) pieces.push(cur); cur = []; } else cur.push(p); }
    if (cur.length > 1) pieces.push(cur);
    for (const piece of pieces) for (let a = 0; a < piece.length - 1; a += chunk) {
      const pts = piece.slice(a, Math.min(piece.length, a + chunk + 1)).map((p) => ({ ...p, side: r.side }));
      if (pts.length < 2) continue;
      const mid = pts[Math.floor(pts.length / 2)];
      const bk = Math.floor(mid.x / 500) + ',' + Math.floor(mid.z / 500);
      for (const part of prof.parts) {
        const key = part.mat + '|' + bk;
        let b = buckets.get(key); if (!b) { b = { mat: part.mat, geos: [], types: new Set() }; buckets.set(key, b); }
        b.geos.push(sweep(pts, part.pts, 1)); b.types.add(r.type);
      }
    }
    if (r.type === 'guardrail') {
      for (let k = 0; k < r.pts.length; k += 2) { const p = r.pts[k]; const q = r.pts[Math.min(r.pts.length - 1, k + 1)]; posts.push([p.x, p.y, p.z, Math.atan2(-(q.z - p.z), q.x - p.x)]); }
    }
  }
  for (const b of buckets.values()) {
    const g = mergeGeometries(b.geos); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mats[b.mat]); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = 'barrier-' + [...b.types].join('+'); mesh.userData.audit = { kind: 'barrier', type: [...b.types].join('+') };
    group.add(mesh);
  }
  if (instances && posts.length) {
    instances.addType('guardpost', [{ geometry: postGeometry(), material: mats.galv, name: 'post' }], { maxDist: 450, kind: 'infra' });
    for (const [x, y, z, yaw] of posts) instances.add('guardpost', x, y, z, yaw, 1);
  }
  return { group, mats };
}

function mk(set, name, color = 0xffffff) {
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.orm, aoMap: set.orm, roughness: 1, color, name });
}

function postGeometry() {
  // C-section post with blockout
  const s = new THREE.Shape();
  s.moveTo(-0.05, -0.05); s.lineTo(0.05, -0.05); s.lineTo(0.05, -0.035); s.lineTo(-0.035, -0.035); s.lineTo(-0.035, 0.035); s.lineTo(0.05, 0.035); s.lineTo(0.05, 0.05); s.lineTo(-0.05, 0.05); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.15, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(-0.08, -0.45, 0);
  const blk = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); blk.rotateZ(Math.PI / 2); blk.translate(-0.02, 0.62, 0);
  const m = mergeGeos([g, blk]);
  return m;
}
function mergeGeos(list) {
  const pos = [], nor = [], uv = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2))); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
