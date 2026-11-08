// TrackData: dense, arc-length-uniform samples derived from the single source of truth (track.json).
// Everything downstream (road mesh, colliders, terrain corridor, barriers, AI line, props) reads this.
import { ClosedSpline } from './spline.js';
import { DEG } from '../core/util.js';

export const SHOULDER = 3.0;        // paved/gravel shoulder band beyond the asphalt edge (also the object exclusion strip)
export const BARRIER = { NONE: 0, GUARDRAIL: 1, WALL: 2, ROCK: 3, FENCE: 4, PARAPET: 5 };
export const BARRIER_NAME = ['none', 'guardrail', 'wall', 'rock', 'fence', 'parapet'];
export const ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4'];

export class TrackData {
  constructor(json) {
    this.json = json;
    const pts = json.points.map(p => [p[0], p[1], p[2], p[3], p[4] * DEG]);
    this.spline = new ClosedSpline(pts, 0.5);
    const rs = this.spline.resample(1.0, 40);
    const N = this.N = rs.count;
    this.length = rs.length;
    this.ds = rs.ds;

    const f = k => new Float64Array(N);
    this.px = f(); this.py = f(); this.pz = f();
    this.w = f(); this.bank = f(); this.s = f();
    const tmp = new Array(5);
    for (let i = 0; i < N; i++) {
      const smp = rs.samples[i];
      this.spline.eval(smp.seg, smp.u, tmp);
      this.px[i] = tmp[0]; this.py[i] = tmp[1]; this.pz[i] = tmp[2];
      this.w[i] = tmp[3]; this.bank[i] = tmp[4]; this.s[i] = smp.s;
    }
    // frames
    this.tx = f(); this.ty = f(); this.tz = f();      // 3D unit tangent
    this.rx = f(); this.rz = f();                     // horizontal unit right (R0)
    this.kappa = f(); this.heading = f(); this.grade = f();
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let dx = this.px[b] - this.px[a], dy = this.py[b] - this.py[a], dz = this.pz[b] - this.pz[a];
      const L = Math.hypot(dx, dy, dz);
      dx /= L; dy /= L; dz /= L;
      this.tx[i] = dx; this.ty[i] = dy; this.tz[i] = dz;
      const h = Math.hypot(dx, dz);
      this.rx[i] = -dz / h; this.rz[i] = dx / h;
      this.heading[i] = Math.atan2(dx, -dz);
      this.grade[i] = dy / h;
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N, b = (i + 2) % N;
      let d = this.heading[b] - this.heading[a];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.kappa[i] = d / (this.ds * 4);          // + = right turn
    }
    this._buildHash();
    this._buildSections(json);
  }

  static async load(url = './track.json') {
    const r = await fetch(url);
    return new TrackData(await r.json());
  }

  wrap(i) { const N = this.N; return ((i % N) + N) % N; }
  sToIndex(s) { return this.wrap(Math.round(s / this.ds)); }
  wrapS(s) { const L = this.length; return ((s % L) + L) % L; }

  /** half asphalt width at sample i */
  half(i) { return this.w[i] * 0.5; }
  /** half width of the flat corridor (asphalt + shoulder) at sample i */
  corridor(i) { return this.w[i] * 0.5 + SHOULDER; }

  /** world position of the point at lateral offset `lat` (right +) from the centreline of sample i (fractional t to i+1) */
  roadPoint(i, lat, t = 0, out = { x: 0, y: 0, z: 0 }) {
    const j = (i + 1) % this.N;
    const cb = Math.cos(this.bank[i]), sb = Math.sin(this.bank[i]);
    const cb2 = Math.cos(this.bank[j]), sb2 = Math.sin(this.bank[j]);
    const x = this.px[i] + (this.px[j] - this.px[i]) * t;
    const y = this.py[i] + (this.py[j] - this.py[i]) * t;
    const z = this.pz[i] + (this.pz[j] - this.pz[i]) * t;
    const rx = this.rx[i] + (this.rx[j] - this.rx[i]) * t, rz = this.rz[i] + (this.rz[j] - this.rz[i]) * t;
    const c = cb + (cb2 - cb) * t, sn = sb + (sb2 - sb) * t;
    out.x = x + rx * c * lat; out.z = z + rz * c * lat; out.y = y - sn * lat;
    return out;
  }
  /** road surface height at sample i / t / lateral */
  roadY(i, t, lat) {
    const j = (i + 1) % this.N;
    const y = this.py[i] + (this.py[j] - this.py[i]) * t;
    const sn = Math.sin(this.bank[i]) + (Math.sin(this.bank[j]) - Math.sin(this.bank[i])) * t;
    return y - sn * lat;
  }
  /** unit up-normal of the road surface (banked) at sample i */
  normalAt(i, out = { x: 0, y: 1, z: 0 }) {
    // U = R x T with R = R0 cosb - U0 sinb  -> compute from road gradients
    const tx = this.tx[i], ty = this.ty[i], tz = this.tz[i];
    const cb = Math.cos(this.bank[i]), sb = Math.sin(this.bank[i]);
    const rx = this.rx[i] * cb, rz = this.rz[i] * cb, ry = -sb;
    // cross(R, T)
    let nx = ry * tz - rz * ty, ny = rz * tx - rx * tz, nz = rx * ty - ry * tx;
    const L = Math.hypot(nx, ny, nz); out.x = nx / L; out.y = ny / L; out.z = nz / L;
    return out;
  }

  // ---------- spatial hash over samples ----------
  _buildHash() {
    this.cell = 16;
    const h = new Map();
    for (let i = 0; i < this.N; i++) {
      const k = this._key(Math.floor(this.px[i] / this.cell), Math.floor(this.pz[i] / this.cell));
      let a = h.get(k);
      if (!a) { a = []; h.set(k, a); }
      a.push(i);
    }
    this.hash = h;
    // coarse hash (every 4th sample) with big cells, for far queries (terrain build)
    this.cell2 = 96;
    const h2 = new Map();
    for (let i = 0; i < this.N; i += 4) {
      const k = this._key(Math.floor(this.px[i] / this.cell2), Math.floor(this.pz[i] / this.cell2));
      let a = h2.get(k);
      if (!a) { a = []; h2.set(k, a); }
      a.push(i);
    }
    this.hash2 = h2;
    this._q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
  }
  _key(ix, iz) { return (ix + 4096) * 8192 + (iz + 4096); }

  /**
   * Nearest point on the centre line in plan view.
   * Returns a reused object {i,t,s,lat,d,dh,y}; lat>0 = right of travel; d = horizontal distance; y = road height under the point.
   * `maxD` bounds the search (default 400). `hint` (sample index) speeds up repeated queries for a moving body.
   */
  nearest(x, z, maxD = 400, hint = -1, out = this._q) {
    let best = -1, bd = Infinity;
    if (hint >= 0) {
      // local scan around the previous index (cars move < a few samples per step)
      const N = this.N;
      let bi = hint, bdl = Infinity;
      for (let k = -24; k <= 24; k++) {
        const i = (hint + k + N) % N;
        const dx = x - this.px[i], dz = z - this.pz[i];
        const d2 = dx * dx + dz * dz;
        if (d2 < bdl) { bdl = d2; bi = i; }
      }
      // accept the local answer only if it is plausibly the global nearest (close enough)
      if (bdl < 60 * 60) { best = bi; bd = bdl; }
    }
    if (best < 0) {
      // global search via hash rings
      const cs = this.cell;
      const cx = Math.floor(x / cs), cz = Math.floor(z / cs);
      const maxR = Math.ceil(maxD / cs);
      for (let r = 0; r <= maxR; r++) {
        for (let ix = cx - r; ix <= cx + r; ix++) {
          for (let iz = cz - r; iz <= cz + r; iz++) {
            if (r > 0 && Math.abs(ix - cx) !== r && Math.abs(iz - cz) !== r) continue;
            const a = this.hash.get(this._key(ix, iz));
            if (!a) continue;
            for (let q = 0; q < a.length; q++) {
              const i = a[q];
              const dx = x - this.px[i], dz = z - this.pz[i];
              const d2 = dx * dx + dz * dz;
              if (d2 < bd) { bd = d2; best = i; }
            }
          }
        }
        if (best >= 0 && Math.sqrt(bd) < r * cs) break;
      }
      if (best < 0) { // far away: coarse hash then refine
        const cs2 = this.cell2;
        const cx2 = Math.floor(x / cs2), cz2 = Math.floor(z / cs2);
        let bc = -1, bcd = Infinity;
        for (let r = 0; r < 64 && bc < 0; r++) {
          for (let ix = cx2 - r; ix <= cx2 + r; ix++) for (let iz = cz2 - r; iz <= cz2 + r; iz++) {
            if (r > 0 && Math.abs(ix - cx2) !== r && Math.abs(iz - cz2) !== r) continue;
            const a = this.hash2.get(this._key(ix, iz));
            if (!a) continue;
            for (const i of a) {
              const dx = x - this.px[i], dz = z - this.pz[i];
              const d2 = dx * dx + dz * dz;
              if (d2 < bcd) { bcd = d2; bc = i; }
            }
          }
        }
        best = bc; bd = bcd;
        // refine locally
        const N = this.N;
        for (let k = -6; k <= 6; k++) {
          const i = (bc + k + N) % N;
          const dx = x - this.px[i], dz = z - this.pz[i];
          const d2 = dx * dx + dz * dz;
          if (d2 < bd) { bd = d2; best = i; }
        }
      }
    }
    // segment refinement: test (best-1 -> best) and (best -> best+1)
    const N = this.N;
    let bestI = best, bestT = 0, bestD2 = Infinity;
    for (let side = -1; side <= 0; side++) {
      const a = (best + side + N) % N, b = (a + 1) % N;
      const ax = this.px[a], az = this.pz[a];
      const ex = this.px[b] - ax, ez = this.pz[b] - az;
      const L2 = ex * ex + ez * ez + 1e-12;
      let t = ((x - ax) * ex + (z - az) * ez) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const fx = ax + ex * t, fz = az + ez * t;
      const d2 = (x - fx) * (x - fx) + (z - fz) * (z - fz);
      if (d2 < bestD2) { bestD2 = d2; bestI = a; bestT = t; }
    }
    const i = bestI, t = bestT, j = (i + 1) % N;
    const fx = this.px[i] + (this.px[j] - this.px[i]) * t, fz = this.pz[i] + (this.pz[j] - this.pz[i]) * t;
    let rx = this.rx[i] + (this.rx[j] - this.rx[i]) * t, rz = this.rz[i] + (this.rz[j] - this.rz[i]) * t;
    const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    const dh = (x - fx) * rx + (z - fz) * rz;
    const cb = Math.cos(this.bank[i]) + (Math.cos(this.bank[j]) - Math.cos(this.bank[i])) * t;
    const lat = dh / cb;
    out.i = i; out.t = t; out.dh = dh; out.lat = lat;
    out.d = Math.sqrt(bestD2);
    out.s = (i + t) * this.ds;
    out.y = this.roadY(i, t, lat);
    return out;
  }

  // ---------- sections: zones, barriers, bridge, curbs ----------
  _buildSections(json) {
    const N = this.N;
    this.zone = new Uint8Array(N);
    this.barL = new Uint8Array(N); this.barR = new Uint8Array(N);
    this.barOffL = new Float32Array(N); this.barOffR = new Float32Array(N);
    this.bridge = new Uint8Array(N);
    this.curbL = new Uint8Array(N); this.curbR = new Uint8Array(N);
    this.surface = new Uint8Array(N);        // 0 asphalt, 1 cobble (village)
    const idx = s => this.wrap(Math.round(s / this.ds));
    for (const z of json.zones) {
      const zi = ZONE_IDS.indexOf(z.id);
      for (let s = z.s0; s < z.s1; s += this.ds) this.zone[idx(s)] = zi;
    }
    const setBar = (arr, off, sec, typeName, offs) => {
      const t = BARRIER[typeName.toUpperCase()] ?? 0;
      for (let i = idx(sec.s0), n = Math.round((sec.s1 - sec.s0) / this.ds); n >= 0; n--, i = (i + 1) % N) {
        arr[i] = t; off[i] = offs;
      }
    };
    this.sections = json.sections;
    for (const sec of json.sections) {
      const half = 0;
      if (sec.left) setBar(this.barL, this.barOffL, sec, sec.left.type, sec.left.off);
      if (sec.right) setBar(this.barR, this.barOffR, sec, sec.right.type, sec.right.off);
      if (sec.surface === 'cobble') for (let i = idx(sec.s0), n = Math.round((sec.s1 - sec.s0) / this.ds); n >= 0; n--, i = (i + 1) % N) this.surface[i] = 1;
    }
    if (json.bridge) {
      const b = json.bridge;
      for (let i = idx(b.s0), n = Math.round((b.s1 - b.s0) / this.ds); n >= 0; n--, i = (i + 1) % N) this.bridge[i] = 1;
    }
    // zebra kerbs on corner insides: |kappa| over a threshold for a stretch, plus lead-in / lead-out
    const th = 1 / 140;
    const mark = new Int8Array(N);
    for (let i = 0; i < N; i++) mark[i] = this.kappa[i] > th ? 1 : this.kappa[i] < -th ? -1 : 0;
    const ext = 14;
    for (let i = 0; i < N; i++) {
      if (mark[i] === 0) continue;
      for (let k = -ext; k <= ext; k++) {
        const j = (i + k + N) % N;
        if (mark[i] > 0) this.curbR[j] = 1; else this.curbL[j] = 1;
      }
    }
    // no kerbs on the bridge or where a wall already sits at the edge
    for (let i = 0; i < N; i++) if (this.bridge[i]) { this.curbL[i] = 0; this.curbR[i] = 0; }
    this.checkpoints = (json.checkpoints || []).slice();
    this.zones = json.zones;
  }

  zoneAt(i) { return this.zone[this.wrap(i)]; }
  isBridge(i) { return this.bridge[this.wrap(i)] === 1; }
  /** index of the sample at distance s */
  indexAtS(s) { return this.sToIndex(this.wrapS(s)); }
}
