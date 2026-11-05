// Collision world built from the same data as the visuals:
// - drivable triangles (the road mesh triangles themselves) in a uniform XZ grid
// - terrain heightfield (same triangulation as the terrain mesh)
// - barrier segments (guardrails, walls, rock faces, facades) in a grid
// - static circle obstacles (trunks, posts)

export const SURF = { ASPHALT: 0, CURB: 1, GRAVEL: 2, SIDEWALK: 3, SAND: 4, GRASS: 5, BRIDGE: 6, DIRT: 7, ROCK: 8 };
export const SURF_NAME = ['asphalt', 'curb', 'gravel', 'sidewalk', 'sand', 'grass', 'bridge', 'dirt', 'rock'];

export class TriangleGrid {
  constructor(cell = 4) { this.cell = cell; this.tris = []; this.types = []; this.map = new Map(); }
  add(ax, ay, az, bx, by, bz, cx, cy, cz, type) {
    const id = this.types.length;
    this.tris.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.types.push(type);
    const c = this.cell;
    const minX = Math.floor(Math.min(ax, bx, cx) / c), maxX = Math.floor(Math.max(ax, bx, cx) / c);
    const minZ = Math.floor(Math.min(az, bz, cz) / c), maxZ = Math.floor(Math.max(az, bz, cz) / c);
    for (let j = minZ; j <= maxZ; j++) for (let i = minX; i <= maxX; i++) {
      const k = (j + 4096) * 8192 + (i + 4096);
      let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(id);
    }
    return id;
  }
  finalize() { this.T = new Float32Array(this.tris); this.tris = null; this.Ty = new Uint8Array(this.types); }
  /** highest triangle under (x,z) whose height <= yMax. returns null or {y, n, type} */
  query(x, z, yMax, out) {
    const c = this.cell;
    const k = (Math.floor(z / c) + 4096) * 8192 + (Math.floor(x / c) + 4096);
    const a = this.map.get(k); if (!a) return null;
    const T = this.T;
    let best = -Infinity, bi = -1, bu = 0, bv = 0;
    for (let q = 0; q < a.length; q++) {
      const id = a[q], o = id * 9;
      const ax = T[o], az = T[o + 2], bx = T[o + 3], bz = T[o + 5], cx = T[o + 6], cz = T[o + 8];
      const v0x = bx - ax, v0z = bz - az, v1x = cx - ax, v1z = cz - az, v2x = x - ax, v2z = z - az;
      const den = v0x * v1z - v1x * v0z;
      if (Math.abs(den) < 1e-12) continue;
      const u = (v2x * v1z - v1x * v2z) / den;
      const v = (v0x * v2z - v2x * v0z) / den;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y = T[o + 1] + (T[o + 4] - T[o + 1]) * u + (T[o + 7] - T[o + 1]) * v;
      if (y <= yMax && y > best) { best = y; bi = id; bu = u; bv = v; }
    }
    if (bi < 0) return null;
    const o = bi * 9;
    // normal
    const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
    const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz);
    out.y = best; out.nx = nx / l; out.ny = ny / l; out.nz = nz / l; out.type = this.Ty[bi]; out.tri = bi;
    return out;
  }
  count() { return this.Ty ? this.Ty.length : this.types.length; }
}

// 2D segments with a vertical extent [y0, y1]; tested against car footprints.
export class SegmentGrid {
  constructor(cell = 8) { this.cell = cell; this.segs = []; this.map = new Map(); }
  add(ax, az, bx, bz, y0, y1, type, meta = null) {
    const id = this.segs.length;
    this.segs.push({ ax, az, bx, bz, y0, y1, type, meta, len: Math.hypot(bx - ax, bz - az) });
    const c = this.cell;
    const minX = Math.floor((Math.min(ax, bx) - 1) / c), maxX = Math.floor((Math.max(ax, bx) + 1) / c);
    const minZ = Math.floor((Math.min(az, bz) - 1) / c), maxZ = Math.floor((Math.max(az, bz) + 1) / c);
    for (let j = minZ; j <= maxZ; j++) for (let i = minX; i <= maxX; i++) {
      const k = (j + 4096) * 8192 + (i + 4096);
      let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(id);
    }
    return id;
  }
  /** collect segment ids near a circle */
  near(x, z, r, out) {
    out.length = 0;
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = this.map.get((j + 4096) * 8192 + (i + 4096)); if (!a) continue;
      for (const id of a) if (!out.includes(id)) out.push(id);
    }
    return out;
  }
}

export class CircleGrid {
  constructor(cell = 8) { this.cell = cell; this.items = []; this.map = new Map(); }
  add(x, z, r, y0, y1, type) {
    const id = this.items.length; this.items.push({ x, z, r, y0, y1, type });
    const c = this.cell;
    for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      const k = (j + 4096) * 8192 + (i + 4096);
      let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(id);
    }
  }
  near(x, z, r, out) {
    out.length = 0; const c = this.cell;
    for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      const a = this.map.get((j + 4096) * 8192 + (i + 4096)); if (!a) continue;
      for (const id of a) if (!out.includes(id)) out.push(id);
    }
    return out;
  }
}

export class CollisionWorld {
  constructor(terrain, drivable, barriers, circles) {
    this.terrain = terrain; this.drivable = drivable; this.barriers = barriers; this.circles = circles;
    this._hit = { y: 0, nx: 0, ny: 1, nz: 0, type: 0, tri: -1 };
    this._n = [0, 1, 0];
  }
  /** surface under (x,z) at or below yMax: road triangles take precedence over terrain when higher */
  surface(x, z, yMax, out) {
    const r = this.drivable.query(x, z, yMax, this._hit);
    const th = this.terrain.heightAt(x, z);
    if (r && r.y >= th - 0.001) {
      out.y = r.y; out.nx = r.nx; out.ny = r.ny; out.nz = r.nz; out.type = r.type; out.road = true;
      return out;
    }
    const n = this.terrain.normalAt(x, z, this._n);
    out.y = th; out.nx = n[0]; out.ny = n[1]; out.nz = n[2]; out.road = false;
    out.type = this.terrain.surfaceTypeAt ? this.terrain.surfaceTypeAt(x, z) : SURF.GRASS;
    return out;
  }
  groundHeight(x, z, yMax = 1e9) { const o = {}; return this.surface(x, z, yMax, o).y; }
}
