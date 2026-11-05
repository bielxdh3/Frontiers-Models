// Builds render meshes for the generated world (terrain, road, curbs, barriers).
import * as THREE from 'three';
import { TerrainMesh } from './terrainMesh.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildRoadMeshes(world, mats) {
  const g = new THREE.Group(); g.name = 'road';
  for (const c of world.road.chunks) {
    const a = new THREE.Mesh(c.asphalt, mats.asphalt); a.receiveShadow = true; a.name = 'asphalt'; a.userData.audit = { kind: 'road', near: true };
    const s = new THREE.Mesh(c.shoulder, mats.shoulder[c.zone] || mats.shoulder[1]); s.receiveShadow = true; s.name = 'shoulder'; s.userData.audit = { kind: 'road', near: true };
    const k = new THREE.Mesh(c.skirt, mats.skirt); k.receiveShadow = true; k.name = 'skirt'; k.userData.audit = { kind: 'road', near: true };
    g.add(a, s, k);
  }
  if (world.road.curbs.length) { const m = new THREE.Mesh(mergeGeometries(world.road.curbs), mats.curb); m.receiveShadow = true; m.name = 'curb'; m.userData.audit = { kind: 'curb', near: true }; g.add(m); }
  return g;
}

export function buildTerrainMesh(world, material, opts) {
  return new TerrainMesh(world.terrain, world.track, material, opts);
}

/** simple extruded barrier visuals (refined geometry lives in props/barrierMeshes) */
export function buildBarrierMeshesSimple(world, mats) {
  const g = new THREE.Group(); g.name = 'barriers';
  for (const r of world.barriers.runs) {
    const pos = [], ind = [];
    const h = r.height, wdt = r.type === 'guardrail' || r.type === 'mirante' ? 0.12 : 0.4;
    for (let k = 0; k < r.pts.length; k++) {
      const p = r.pts[k], q = r.pts[Math.min(r.pts.length - 1, k + 1)], o = r.pts[Math.max(0, k - 1)];
      let tx = q.x - o.x, tz = q.z - o.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz, nz = tx;
      const y0 = p.y - 0.4, y1 = p.y + h;
      pos.push(p.x - nx * wdt, y0, p.z - nz * wdt, p.x - nx * wdt, y1, p.z - nz * wdt, p.x + nx * wdt, y1, p.z + nz * wdt, p.x + nx * wdt, y0, p.z + nz * wdt);
    }
    for (let k = 0; k < r.pts.length - 1; k++) {
      const a = k * 4, b = (k + 1) * 4;
      for (let j = 0; j < 3; j++) ind.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(ind); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats.barrier[r.type] || mats.barrier.default);
    m.material.side = THREE.DoubleSide; m.castShadow = true; m.receiveShadow = true; m.name = 'barrier-' + r.type;
    g.add(m);
  }
  return g;
}
