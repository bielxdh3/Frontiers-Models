// The viaduct over the ravine at the end of Z4: concrete deck (follows the road, banking included), five pairs of tapered piers with cross-beams and
// footings, and stone-faced abutments buried in the hillside at both ends. Everything is derived from track.json (bridge.s0 / bridge.s1).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MeshBuilder } from './meshbuild.js';
import { BUILD_ID } from './shaders.js';

const V3 = THREE.Vector3;

/** quad whose normal points to `out` (swaps the winding when needed) */
function quadOut(mb, p0, p1, p2, p3, out, o) {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) mb.quad(p0, p1, p2, p3, o); else mb.quad(p0, p3, p2, p1, o);
}

export function buildBridge(world, materials) {
  const T = world.track, terr = world.terrain, br = world.json.bridge;
  if (!br) return null;
  const group = new THREE.Group(); group.name = 'bridge';
  const mat = materials.makeBuilding('bridge-structure', { instanced: false });
  const mb = new MeshBuilder(), B = BUILD_ID;
  const half = T.w[T.indexAtS((br.s0 + br.s1) / 2)] * 0.5 + 0.75, thick = 1.45;
  const tmp = { x: 0, y: 0, z: 0 }, tmp2 = { x: 0, y: 0, z: 0 };
  const P = (i, lat, dy = 0) => { T.roadPoint(i, lat, 0, tmp); return [tmp.x, tmp.y + dy, tmp.z]; };
  const di = Math.max(1, Math.round(3 / T.ds)), i0 = T.indexAtS(br.s0 - 3), i1 = T.indexAtS(br.s1 + 3);
  const concrete = { mat: B.concrete_wall_007, color: [0.86, 0.84, 0.80] }, stone = { mat: B.rustic_stone_wall, color: [0.95, 0.9, 0.82] };
  let tris = 0;
  // ---- deck: left / right faces and the underside, from the actual (banked) road edges
  for (let i = i0; ; i = T.wrap(i + di)) {
    const j = T.wrap(i + di);
    const Li = P(i, -half), Lj = P(j, -half), Ri = P(i, half), Rj = P(j, half);
    const down = (p, d = thick) => [p[0], p[1] - d, p[2]];
    const rx = T.rx[i], rz = T.rz[i];
    quadOut(mb, Li, Lj, down(Lj), down(Li), [-rx, 0, -rz], { ...concrete, uvScale: 1 });
    quadOut(mb, Ri, Rj, down(Rj), down(Ri), [rx, 0, rz], { ...concrete, uvScale: 1 });
    quadOut(mb, down(Li), down(Lj), down(Rj), down(Ri), [0, -1, 0], { ...concrete, color: [0.7, 0.68, 0.65] });
    // a stone fascia band under the parapet line
    const f = (p, d) => [p[0], p[1] - d, p[2]];
    quadOut(mb, f(Li, 0.0), f(Lj, 0.0), f(Lj, 0.35), f(Li, 0.35), [-rx, 0, -rz], { ...stone });
    quadOut(mb, f(Ri, 0.0), f(Rj, 0.0), f(Rj, 0.35), f(Ri, 0.35), [rx, 0, rz], { ...stone });
    if (j === T.wrap(i1)) break; if (i === i1) break;
    if (((j - i0 + T.N) % T.N) > ((i1 - i0 + T.N) % T.N)) break;
  }
  // ---- piers
  const add = (g, m4, o) => mb.addGeo(g, m4, o);
  const at = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new V3(sx, sy, sz));
  const span = br.s1 - br.s0, nP = 5;
  for (let k = 1; k <= nP; k++) {
    const s = br.s0 + (span * k) / (nP + 1), i = T.indexAtS(s), yaw = Math.atan2(T.rx[i], T.rz[i]) + Math.PI / 2;
    T.roadPoint(i, 0, 0, tmp2); const deckBottom = tmp2.y - thick, cx = tmp2.x, cz = tmp2.z, rx = T.rx[i], rz = T.rz[i];
    const beamY = deckBottom - 0.55;
    // cross-beam under the deck
    add(new RoundedBoxGeometry(half * 2 - 1.2, 1.1, 2.0, 2, 0.18), at(cx, beamY, cz, yaw), { ...concrete, planar: true });
    for (const side of [-1, 1]) {
      const x = cx + rx * side * 3.3, z = cz + rz * side * 3.3, g0 = Math.min(terr.sample(x, z), terr.sample(x + 1.5, z), terr.sample(x - 1.5, z), terr.sample(x, z + 1.5), terr.sample(x, z - 1.5)) - 1.4;
      const h = beamY - 0.55 - g0;
      const col = new THREE.CylinderGeometry(0.95, 1.35, h, 16, 1, false);
      add(col, at(x, g0 + h / 2, z, yaw, 1, 1, 1.55), { ...concrete, uvU: 6, uvV: h });
      add(new RoundedBoxGeometry(3.4, 1.4, 4.4, 2, 0.2), at(x, g0 + 0.3, z, yaw), { ...concrete, color: [0.78, 0.76, 0.72], planar: true });         // footing, buried
    }
  }
  // ---- abutments: stone-faced blocks that tie the deck into the hillside
  for (const end of [0, 1]) {
    const s = end ? br.s1 - 4.5 : br.s0 + 4.5, i = T.indexAtS(s), yaw = Math.atan2(T.rx[i], T.rz[i]) + Math.PI / 2;
    T.roadPoint(i, 0, 0, tmp2); const cx = tmp2.x, cz = tmp2.z, rx = T.rx[i], rz = T.rz[i], deckBottom = tmp2.y - thick;
    let low = 1e9; for (const a of [-half, 0, half]) for (const d of [-4.5, 0, 4.5]) { const x = cx + rx * a + (-rz) * d, z = cz + rz * a + rx * d; low = Math.min(low, terr.sample(x, z)); }
    const h = deckBottom + thick * 0.35 - (low - 1.6);
    add(new RoundedBoxGeometry(half * 2 + 1.4, h, 9.5, 2, 0.25), at(cx, low - 1.6 + h / 2, cz, yaw), { ...stone, planar: true });
    // wing walls hugging the slope
    for (const side of [-1, 1]) add(new RoundedBoxGeometry(0.9, h * 0.8, 9.0, 2, 0.15), at(cx + rx * side * (half + 0.9), low - 1.6 + h * 0.4, cz + rz * side * (half + 0.9), yaw), { ...stone, planar: true });
  }
  const g = mb.toGeometry({ withInst: true });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'bridge'; mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  tris = g.index.count / 3;
  group.userData.tris = tris;
  return { group, tris };
}
