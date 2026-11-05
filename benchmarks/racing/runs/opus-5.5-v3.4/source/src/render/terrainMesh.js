// Chunked terrain mesh with distance LODs and skirts, built from the same
// heightfield (and same triangulation) as the terrain collider.
import * as THREE from 'three';

const CH = 96; // cells per chunk
const LODS = [1, 2, 4, 8];
const LOD_DIST = [260, 560, 1200];

export class TerrainMesh {
  constructor(terrain, track, material, { lodScale = 1 } = {}) {
    this.terrain = terrain; this.material = material; this.lodScale = lodScale;
    this.group = new THREE.Group(); this.group.name = 'terrain';
    this.chunks = [];
    const t = terrain;
    const ncx = Math.ceil((t.nx - 1) / CH), ncz = Math.ceil((t.nz - 1) / CH);
    // distance of chunk centre to track (for which LODs to prebuild)
    for (let cz = 0; cz < ncz; cz++) for (let cx = 0; cx < ncx; cx++) {
      const i0 = cx * CH, j0 = cz * CH;
      const i1 = Math.min(t.nx - 1, i0 + CH), j1 = Math.min(t.nz - 1, j0 + CH);
      let maxH = -Infinity, minH = Infinity;
      for (let j = j0; j <= j1; j += 4) for (let i = i0; i <= i1; i += 4) { const h = t.h[j * t.nx + i]; if (h > maxH) maxH = h; if (h < minH) minH = h; }
      if (maxH < -7) continue; // deep sea floor: covered by opaque water
      const x0 = t.x0 + i0 * t.cell, z0 = t.z0 + j0 * t.cell, x1 = t.x0 + i1 * t.cell, z1 = t.z0 + j1 * t.cell;
      const cxw = (x0 + x1) / 2, czw = (z0 + z1) / 2;
      const pr = track.project(cxw, czw, {});
      const dTrack = Math.max(0, Math.hypot(pr.dist, 0) - 140);
      const need = LOD_DIST.map((d) => dTrack < d * lodScale + 60);
      const chunk = { i0, j0, i1, j1, cx: cxw, cz: czw, minH, maxH, lods: [], mesh: null, level: -1, dTrack };
      const mesh = new THREE.Mesh(undefined, material);
      mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'terrainChunk'; // terrain shadows are baked (shadow-height map)
      mesh.userData.audit = { kind: 'terrain' };
      chunk.mesh = mesh;
      for (let l = 0; l < LODS.length; l++) chunk.lods[l] = (l === LODS.length - 1 || need[l]) ? null : undefined; // null = build lazily but allowed
      this.chunks.push(chunk);
    }
    // prebuild all allowed LODs now (no hitches later)
    for (const c of this.chunks) {
      for (let l = 0; l < LODS.length; l++) if (c.lods[l] === null) c.lods[l] = this._build(c, LODS[l]);
      const first = c.lods.findIndex((g) => g);
      c.mesh.geometry = c.lods[c.lods.length - 1];
      c.level = c.lods.length - 1;
      this.group.add(c.mesh);
    }
  }

  _build(c, step) {
    const t = this.terrain;
    const nI = Math.ceil((c.i1 - c.i0) / step), nJ = Math.ceil((c.j1 - c.j0) / step);
    const vx = nI + 1, vz = nJ + 1;
    const nv = vx * vz;
    const border = 2 * (vx + vz) - 4;
    const pos = new Float32Array((nv + border) * 3), nor = new Float32Array((nv + border) * 3);
    const n = [0, 1, 0];
    let p = 0;
    const gi = (a) => Math.min(c.i1, c.i0 + a * step), gj = (b) => Math.min(c.j1, c.j0 + b * step);
    for (let b = 0; b < vz; b++) for (let a = 0; a < vx; a++) {
      const i = gi(a), j = gj(b);
      const x = t.x0 + i * t.cell, z = t.z0 + j * t.cell;
      pos[p * 3] = x; pos[p * 3 + 1] = t.h[j * t.nx + i]; pos[p * 3 + 2] = z;
      // smooth normal from central differences (consistent across LODs)
      const hl = t.vertexHeight(i - 1, j), hr = t.vertexHeight(i + 1, j), hd = t.vertexHeight(i, j - 1), hu = t.vertexHeight(i, j + 1);
      const nx = -(hr - hl) / (2 * t.cell), nz = -(hu - hd) / (2 * t.cell); const l = Math.hypot(nx, 1, nz);
      nor[p * 3] = nx / l; nor[p * 3 + 1] = 1 / l; nor[p * 3 + 2] = nz / l;
      p++;
    }
    const idx = [];
    for (let b = 0; b < nJ; b++) for (let a = 0; a < nI; a++) {
      const A = b * vx + a, B = A + 1, C = A + vx, D = C + 1;
      idx.push(A, C, B, B, C, D);
    }
    // skirts
    const drop = 1.5 + step * 1.2;
    const ring = [];
    for (let a = 0; a < vx; a++) ring.push(a);
    for (let b = 1; b < vz; b++) ring.push(b * vx + (vx - 1));
    for (let a = vx - 2; a >= 0; a--) ring.push((vz - 1) * vx + a);
    for (let b = vz - 2; b >= 1; b--) ring.push(b * vx);
    const skirtStart = p;
    for (const r of ring) {
      pos[p * 3] = pos[r * 3]; pos[p * 3 + 1] = pos[r * 3 + 1] - drop; pos[p * 3 + 2] = pos[r * 3 + 2];
      nor[p * 3] = nor[r * 3]; nor[p * 3 + 1] = nor[r * 3 + 1]; nor[p * 3 + 2] = nor[r * 3 + 2];
      p++;
    }
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length], a2 = skirtStart + k, b2 = skirtStart + ((k + 1) % ring.length);
      idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2); // both windings (cheap, avoids holes from any side)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, p * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, p * 3), 3));
    g.setIndex(nv + border > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }

  update(camPos) {
    for (const c of this.chunks) {
      const d = Math.max(0, Math.hypot(camPos.x - c.cx, camPos.z - c.cz) - 135);
      let want = LODS.length - 1;
      for (let l = 0; l < LOD_DIST.length; l++) if (d < LOD_DIST[l] * this.lodScale) { want = l; break; }
      // hysteresis
      if (want > c.level && d < LOD_DIST[Math.min(c.level, LOD_DIST.length - 1)] * this.lodScale + 25) want = c.level;
      while (want < c.lods.length - 1 && !c.lods[want]) want++;
      if (want !== c.level) { c.level = want; c.mesh.geometry = c.lods[want]; }
    }
  }
  triangleCount() { let n = 0; for (const c of this.chunks) n += c.mesh.geometry.index.count / 3; return n; }
}
