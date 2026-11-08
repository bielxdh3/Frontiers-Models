// Terrain: one heightfield, carved to the road, used for BOTH the render mesh and the collider.
//   h(x,z) = natural landform G, clamped into a cut/fill cone around the road corridor.
// Inside the corridor (asphalt + shoulder) the ground is the banked road plane minus 6 cm, so the road
// mesh sits on it with no gap and no z-fight. Nothing here depends on three.js.
import { createLandform } from './landform.js';
import { SHOULDER } from './track.js';
import { clamp, smoothstep, smin, smax } from '../core/util.js';
import { makeNoise } from '../core/noise.js';

export const TILE = 64;
const UNDER = 0.05;                 // terrain sits this far below the road surface inside the corridor
const CUT_SLOPE = 0.62, FILL_SLOPE = 0.46;
const MIN_TALUD = 7.0;              // soft shoulder rounding width (m)
const FLAT_EXTRA = 2.2;             // terrain stays on the road plane this far beyond the paved shoulder (keeps grid interpolation exact at the road edge)
const BRIDGE_FREE = 9;              // metres kept as causeway at each bridge end before the span

// inner region (all levels at 64 m granularity) — chosen to be a multiple of 1024 for the outer ring
export const REGION = { x0: -1024, x1: 2048, z0: -1536, z1: 1024 };
export const RING = { x0: -3072, x1: 4096, z0: -4096, z1: 3072, tile: 1024 };

export class Terrain {
  constructor(track, landform) {
    this.track = track;
    this.lf = landform;
    this.noise = makeNoise((landform.seed || 1) * 31 + 5);
    this.tiles = new Map();       // key "tx,tz" -> {level, n, cell, x0, z0, h:Float32Array((n+1)^2)}
    this.chunks = [];
    this.bridgeS0 = track.json.bridge ? track.json.bridge.s0 + BRIDGE_FREE : -1;
    this.bridgeS1 = track.json.bridge ? track.json.bridge.s1 - BRIDGE_FREE : -1;
    this._q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
  }

  inBridgeSpan(s) { return this.bridgeS0 >= 0 && s > this.bridgeS0 && s < this.bridgeS1; }

  /** analytic terrain height; fills `info` (optional) with {d, lat, i, cut, zone, onRoad} */
  heightAnalytic(x, z, info) {
    const T = this.track, lf = this.lf;
    const g = lf.G(x, z);
    const q = T.nearest(x, z, 120, -1, this._q);
    const i = q.i, t = q.t;
    const wI = T.w[i] + (T.w[(i + 1) % T.N] - T.w[i]) * t;
    const c = wI * 0.5 + SHOULDER + FLAT_EXTRA;
    const lat = q.lat;
    if (info) { info.d = q.d; info.lat = lat; info.i = i; info.s = q.s; info.c = c; info.zone = T.zone[i]; info.onRoad = false; info.cut = 0; info.bridge = T.bridge[i]; }
    if (this.inBridgeSpan(q.s)) return g;
    const al = Math.abs(lat);
    if (al <= c) {
      if (info) info.onRoad = true;
      return T.roadY(i, t, lat) - UNDER;
    }
    // cut / fill cone measured from the corridor edge
    const side = lat < 0 ? -1 : 1;
    const yEdge = T.roadY(i, t, side * c) - UNDER;
    const tt = al - c;
    const wob = 1 + 0.22 * this.noise.fbm(x / 17, z / 17, 3);      // organic variation of the slope face
    const hi = yEdge + CUT_SLOPE * wob * tt;
    const lo = yEdge - FILL_SLOPE * wob * tt;
    let h = smin(smax(g, lo, 1.4), hi, 1.4);
    // soft shoulder rounding: blend from the plane edge over MIN_TALUD metres
    const k = smoothstep(0, MIN_TALUD, tt);
    h = yEdge + (h - yEdge) * k;
    if (info) info.cut = h - yEdge;
    return h;
  }

  // ------------------------------------------------------------------ tile building
  _tileKey(tx, tz) { return tx + ',' + tz; }

  /** decide the level for every 64 m tile of REGION, build height grids, then geometry chunks */
  build(onProgress) {
    const T = this.track;
    const tx0 = REGION.x0 / TILE, tx1 = REGION.x1 / TILE, tz0 = REGION.z0 / TILE, tz1 = REGION.z1 / TILE;
    const list = [];
    for (let tz = tz0; tz < tz1; tz++) for (let tx = tx0; tx < tx1; tx++) {
      const cx = (tx + 0.5) * TILE, cz = (tz + 0.5) * TILE;
      const q = T.nearest(cx, cz, 1200, -1, this._q);
      const dmin = q.d - TILE * 0.72;
      const level = dmin < 75 ? 0 : dmin < 220 ? 1 : dmin < 560 ? 2 : 3;
      list.push({ tx, tz, level });
    }
    const cellOf = [2, 4, 8, 16];
    let done = 0;
    for (const e of list) {
      const n = TILE / cellOf[e.level];
      const x0 = e.tx * TILE, z0 = e.tz * TILE;
      // extended grid (1 extra ring) so normals are continuous across tile borders
      const m = n + 3;
      const hh = new Float32Array(m * m);
      const info = (e.level < 3) ? new Float32Array(m * m * 4) : null;
      const tmp = {};
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
        const x = x0 + (i - 1) * cellOf[e.level], z = z0 + (j - 1) * cellOf[e.level];
        const h = this.heightAnalytic(x, z, tmp);
        hh[j * m + i] = h;
        if (info) {
          const k = (j * m + i) * 4;
          info[k] = clamp((tmp.d - tmp.c) / 90, 0, 1);
          info[k + 1] = tmp.zone + (tmp.bridge ? 0.5 : 0);
          info[k + 2] = clamp(tmp.cut / 14, -1, 1);
          info[k + 3] = tmp.onRoad ? 1 : 0;
        }
      }
      // collider grid = the visible (n+1)^2 vertices
      const grid = new Float32Array((n + 1) * (n + 1));
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) grid[j * (n + 1) + i] = hh[(j + 1) * m + (i + 1)];
      this.tiles.set(this._tileKey(e.tx, e.tz), { level: e.level, n, cell: cellOf[e.level], x0, z0, grid, ext: hh, info, m });
      if ((++done & 63) === 0 && onProgress) onProgress(done / list.length);
    }
    this._buildChunks();
    this._buildRing();
    return this;
  }

  // ------------------------------------------------------------------ queries (collider)
  /** height of the terrain grid at (x,z) using the same triangulation as the render mesh */
  sample(x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    const tile = this.tiles.get(tx + ',' + tz);
    if (!tile) return this.heightAnalytic(x, z);
    const fx = (x - tile.x0) / tile.cell, fz = (z - tile.z0) / tile.cell;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i >= tile.n) i = tile.n - 1; if (j >= tile.n) j = tile.n - 1;
    const u = fx - i, v = fz - j, w = tile.n + 1, g = tile.grid;
    const h00 = g[j * w + i], h10 = g[j * w + i + 1], h01 = g[(j + 1) * w + i], h11 = g[(j + 1) * w + i + 1];
    // diagonal from (i,j) to (i+1,j+1)
    if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
    return h00 + (h11 - h01) * u + (h01 - h00) * v;
  }
  /** surface normal of the grid triangle under (x,z) */
  normal(x, z, out = { x: 0, y: 1, z: 0 }) {
    const e = 0.5;
    const hx = this.sample(x + e, z) - this.sample(x - e, z);
    const hz = this.sample(x, z + e) - this.sample(x, z - e);
    const L = Math.hypot(hx, 2 * e, hz);
    out.x = -hx / L; out.y = 2 * e / L; out.z = -hz / L;
    return out;
  }

  // ------------------------------------------------------------------ geometry
  _emitTile(tile, buf) {
    const { n, cell, x0, z0, ext, info, m, level } = tile;
    const base = buf.vcount;
    const w = n + 1;
    const skirt = level === 0 ? 2.5 : level === 1 ? 4 : level === 2 ? 8 : level === 3 ? 14 : 60;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const e = (j + 1) * m + (i + 1);
      const h = ext[e];
      const hxm = ext[e - 1], hxp = ext[e + 1], hzm = ext[e - m], hzp = ext[e + m];
      let nx = (hxm - hxp), nz = (hzm - hzp), ny = 2 * cell;
      const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
      buf.pos.push(x0 + i * cell, h, z0 + j * cell);
      buf.nrm.push(nx, ny, nz);
      if (info) { const k = e * 4; buf.inf.push(info[k], info[k + 1], info[k + 2], info[k + 3]); }
      else buf.inf.push(1, 0, 0, 0);
      buf.vcount++;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = base + j * w + i, b = a + 1, c = a + w, d = c + 1;
      buf.idx.push(a, c, d, a, d, b);        // shared diagonal a-d (matches sample()); normal +y
    }
    // skirts on the four borders
    const edge = (list) => {
      const start = buf.vcount;
      for (const vi of list) {
        const s = vi * 3;
        buf.pos.push(buf.pos[s], buf.pos[s + 1] - skirt, buf.pos[s + 2]);
        buf.nrm.push(buf.nrm[s], buf.nrm[s + 1], buf.nrm[s + 2]);
        const q = vi * 4; buf.inf.push(buf.inf[q], buf.inf[q + 1], buf.inf[q + 2], buf.inf[q + 3]);
        buf.vcount++;
      }
      for (let k = 0; k < list.length - 1; k++) {
        const a = list[k], b = list[k + 1], c = start + k, d = start + k + 1;
        buf.idx.push(a, c, b, b, c, d, a, b, c, b, d, c);   // both windings: skirt visible from either side
      }
    };
    const top = [], bottom = [], left = [], right = [];
    for (let i = 0; i <= n; i++) { top.push(base + i); bottom.push(base + n * w + i); }
    for (let j = 0; j <= n; j++) { left.push(base + j * w); right.push(base + j * w + n); }
    edge(top); edge(bottom); edge(left); edge(right);
  }

  _buildChunks() {
    const CH = 4; // tiles per chunk edge
    const groups = new Map();
    for (const [key, tile] of this.tiles) {
      const [tx, tz] = key.split(',').map(Number);
      const cx = Math.floor(tx / CH), cz = Math.floor(tz / CH);
      const gk = cx + ',' + cz;
      let g = groups.get(gk);
      if (!g) { g = { cx, cz, buf: { pos: [], nrm: [], inf: [], idx: [], vcount: 0 }, hasHi: false }; groups.set(gk, g); }
      this._emitTile(tile, g.buf);
      if (tile.level < 2) g.hasHi = true;
    }
    this.chunks = [];
    for (const g of groups.values()) {
      const b = g.buf;
      let ymin = 1e9, ymax = -1e9;
      for (let k = 1; k < b.pos.length; k += 3) { ymin = Math.min(ymin, b.pos[k]); ymax = Math.max(ymax, b.pos[k]); }
      this.chunks.push({
        key: g.cx + ',' + g.cz, hi: g.hasHi,
        positions: new Float32Array(b.pos), normals: new Float32Array(b.nrm), infos: new Float32Array(b.inf),
        indices: b.vcount > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx),
        bounds: { x0: g.cx * CH * TILE, x1: (g.cx + 1) * CH * TILE, z0: g.cz * CH * TILE, z1: (g.cz + 1) * CH * TILE, y0: ymin, y1: ymax },
      });
    }
  }

  /** coarse 1024 m tiles (64 m cells) all around the inner region, so the land fades into the haze */
  _buildRing() {
    const out = [];
    const R = RING, T1 = R.tile, cells = 16, cell = T1 / cells;
    for (let z = R.z0; z < R.z1; z += T1) for (let x = R.x0; x < R.x1; x += T1) {
      const inside = x >= REGION.x0 && x + T1 <= REGION.x1 && z >= REGION.z0 && z + T1 <= REGION.z1;
      const overlaps = x < REGION.x1 && x + T1 > REGION.x0 && z < REGION.z1 && z + T1 > REGION.z0;
      if (inside || overlaps) continue;
      const buf = { pos: [], nrm: [], inf: [], idx: [], vcount: 0 };
      const m = cells + 3, ext = new Float32Array(m * m);
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) ext[j * m + i] = this.lf.G(x + (i - 1) * cell, z + (j - 1) * cell);
      this._emitTile({ n: cells, cell, x0: x, z0: z, ext, info: null, m, level: 4 }, buf);
      let ymin = 1e9, ymax = -1e9;
      for (let k = 1; k < buf.pos.length; k += 3) { ymin = Math.min(ymin, buf.pos[k]); ymax = Math.max(ymax, buf.pos[k]); }
      out.push({
        key: 'ring' + x + ',' + z, hi: false,
        positions: new Float32Array(buf.pos), normals: new Float32Array(buf.nrm), infos: new Float32Array(buf.inf),
        indices: new Uint16Array(buf.idx),
        bounds: { x0: x, x1: x + T1, z0: z, z1: z + T1, y0: ymin, y1: ymax },
      });
    }
    this.chunks.push(...out);
  }

  /** coarse sea-floor height map (1 texel = `res` m) for the water shader: returns Float32Array + meta */
  seaDepthMap(x0, z0, size, texels) {
    const a = new Float32Array(texels * texels);
    const res = size / texels;
    for (let j = 0; j < texels; j++) for (let i = 0; i < texels; i++) {
      const x = x0 + (i + 0.5) * res, z = z0 + (j + 0.5) * res;
      a[j * texels + i] = this.sample(x, z);
    }
    return { data: a, x0, z0, size, texels };
  }
}

export function createTerrain(track, seed) {
  const lf = createLandform(seed);
  return new Terrain(track, lf);
}
