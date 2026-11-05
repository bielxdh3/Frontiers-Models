// Track: the single source of truth. A closed centripetal Catmull-Rom spline
// through control points [x, y, z, width, bankDeg] from track.json.
// Everything else in the world (road mesh, colliders, terrain conform,
// barriers, checkpoints, racing line, scatter) is derived from this object.

const DEG = Math.PI / 180;

function crCentripetal(p0, p1, p2, p3, t) {
  // Barry-Goldman pyramidal formulation, alpha = 0.5, for one coordinate set (x,y,z)
  const d01 = Math.max(1e-4, Math.pow(dist3(p0, p1), 0.5));
  const d12 = Math.max(1e-4, Math.pow(dist3(p1, p2), 0.5));
  const d23 = Math.max(1e-4, Math.pow(dist3(p2, p3), 0.5));
  const t0 = 0, t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
  const tt = t1 + (t2 - t1) * t;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const A1 = ((t1 - tt) * p0[k] + (tt - t0) * p1[k]) / (t1 - t0);
    const A2 = ((t2 - tt) * p1[k] + (tt - t1) * p2[k]) / (t2 - t1);
    const A3 = ((t3 - tt) * p2[k] + (tt - t2) * p3[k]) / (t3 - t2);
    const B1 = ((t2 - tt) * A1 + (tt - t0) * A2) / (t2 - t0);
    const B2 = ((t3 - tt) * A2 + (tt - t1) * A3) / (t3 - t1);
    out[k] = ((t2 - tt) * B1 + (tt - t1) * B2) / (t2 - t1);
  }
  return out;
}
function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function crUniform(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

export class Track {
  constructor(json) {
    this.json = json;
    this.seed = json.seed;
    this.seaLevel = json.seaLevel ?? 0;
    const cps = json.controlPoints;
    this.N = cps.length;
    this.cp = cps.map((c) => ({ p: [c[0], c[1], c[2]], w: c[3], bank: c[4] * DEG }));
    this._buildTable();
    this._resample(1.0);
    this._buildGrid();
    this._zones();
  }

  _evalU(u) {
    const N = this.N;
    const i = Math.floor(u) % N, f = u - Math.floor(u);
    const P = (k) => this.cp[((i + k) % N + N) % N];
    const p = crCentripetal(P(-1).p, P(0).p, P(1).p, P(2).p, f);
    const w = crUniform(P(-1).w, P(0).w, P(1).w, P(2).w, f);
    const b = crUniform(P(-1).bank, P(0).bank, P(1).bank, P(2).bank, f);
    return { p, w, b };
  }

  _buildTable() {
    const K = 64; // sub-samples per control segment
    const n = this.N * K;
    this.tabU = new Float64Array(n + 1);
    this.tabS = new Float64Array(n + 1);
    let prev = this._evalU(0).p, s = 0;
    this.tabU[0] = 0; this.tabS[0] = 0;
    for (let j = 1; j <= n; j++) {
      const u = j / K;
      const p = this._evalU(u % this.N).p;
      s += dist3(prev, p);
      this.tabU[j] = u; this.tabS[j] = s; prev = p;
    }
    this.length = s;
  }

  sToU(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    let lo = 0, hi = this.tabS.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.tabS[m] <= s) lo = m; else hi = m; }
    const f = (s - this.tabS[lo]) / Math.max(1e-9, this.tabS[hi] - this.tabS[lo]);
    return this.tabU[lo] + (this.tabU[hi] - this.tabU[lo]) * f;
  }
  uToS(u) {
    const N = this.N;
    u = ((u % N) + N) % N;
    const K = 64; const j = Math.min(this.tabU.length - 2, Math.floor(u * K));
    const f = u * K - j;
    return this.tabS[j] + (this.tabS[j + 1] - this.tabS[j]) * f;
  }

  _resample(ds0) {
    const M = Math.round(this.length / ds0);
    const ds = this.length / M;
    this.M = M; this.ds = ds;
    const px = new Float64Array(M), py = new Float64Array(M), pz = new Float64Array(M);
    const W = new Float32Array(M), B = new Float32Array(M), U = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      const u = this.sToU(i * ds);
      const e = this._evalU(u);
      px[i] = e.p[0]; py[i] = e.p[1]; pz[i] = e.p[2]; W[i] = e.w; B[i] = e.b; U[i] = u;
    }
    // frames
    const T = new Float32Array(M * 3), R = new Float32Array(M * 3), Nn = new Float32Array(M * 3), Rb = new Float32Array(M * 3);
    const curv = new Float32Array(M), grade = new Float32Array(M), heading = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      const a = (i - 1 + M) % M, b = (i + 1) % M;
      let tx = px[b] - px[a], ty = py[b] - py[a], tz = pz[b] - pz[a];
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      // right (horizontal) = cross(T, up)
      let rx = -tz, rz = tx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
      // unbanked normal N0 = cross(R, T)
      const n0x = 0 * tz - rz * ty, n0y = rz * tx - rx * tz, n0z = rx * ty - 0 * tx;
      const cb = Math.cos(B[i]), sb = Math.sin(B[i]);
      T.set([tx, ty, tz], i * 3);
      R.set([rx, 0, rz], i * 3);
      Rb.set([rx * cb - n0x * sb, 0 * cb - n0y * sb, rz * cb - n0z * sb], i * 3);
      Nn.set([n0x * cb + rx * sb, n0y * cb, n0z * cb + rz * sb], i * 3);
      grade[i] = ty / Math.max(1e-6, Math.hypot(tx, tz));
      heading[i] = Math.atan2(tz, tx);
    }
    for (let i = 0; i < M; i++) {
      const a = (i - 2 + M) % M, b = (i + 2) % M;
      let dh = heading[b] - heading[a];
      while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      const segLen = Math.hypot(px[b] - px[a], pz[b] - pz[a]);
      curv[i] = dh / Math.max(1e-6, segLen); // + = right turn (clockwise from above, z south)
    }
    Object.assign(this, { px, py, pz, W, B, U, T, R, Rb, Nn, curv, grade, heading });
  }

  _buildGrid() {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.M; i++) { minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]); minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]); }
    this.bounds = { minX, maxX, minZ, maxZ };
    const cs = 8; this.gcs = cs;
    this.gx0 = minX - 200; this.gz0 = minZ - 200;
    this.gnx = Math.ceil((maxX - minX + 400) / cs); this.gnz = Math.ceil((maxZ - minZ + 400) / cs);
    const cells = new Map();
    for (let i = 0; i < this.M; i++) {
      const cx = Math.floor((this.px[i] - this.gx0) / cs), cz = Math.floor((this.pz[i] - this.gz0) / cs);
      const key = cz * this.gnx + cx;
      let arr = cells.get(key); if (!arr) { arr = []; cells.set(key, arr); } arr.push(i);
    }
    this.cells = cells;
  }

  _zones() {
    this.zoneList = this.json.zones.map((z) => ({ zone: z.zone, s0: this.uToS(z.u0), s1: z.u1 >= this.N ? this.length : this.uToS(z.u1) }));
    const f = this.json.features;
    this.features = {
      startS: this.uToS(f.startLineU || 0),
      gridSlots: f.gridSlots, gridSpacing: f.gridSpacing,
      bridge: { s0: this.uToS(f.bridge.u0), s1: this.uToS(f.bridge.u1), deck: f.bridge.deckThickness },
      mirante: { s: this.uToS(f.mirante.u), side: f.mirante.side, length: f.mirante.length, depth: f.mirante.depth },
      plaza: { s0: this.uToS(f.plaza.u0), s1: this.uToS(f.plaza.u1), side: f.plaza.side },
      church: { s: this.uToS(f.church.u), side: f.church.side, offset: f.church.offset },
      village: { s0: this.uToS(f.village.u0), s1: this.uToS(f.village.u1) },
      beach: { s0: this.uToS(f.beach.u0), s1: this.uToS(f.beach.u1) },
    };
  }

  zoneAt(s) {
    s = this.wrap(s);
    for (const z of this.zoneList) if (s >= z.s0 && s < z.s1) return z.zone;
    return 1;
  }
  wrap(s) { const L = this.length; return ((s % L) + L) % L; }
  /** signed shortest distance from a to b along the loop */
  delta(a, b) { let d = b - a; const L = this.length; d = ((d % L) + L) % L; if (d > L / 2) d -= L; return d; }
  inRange(s, s0, s1) { s = this.wrap(s); s0 = this.wrap(s0); s1 = this.wrap(s1); return s0 <= s1 ? s >= s0 && s <= s1 : s >= s0 || s <= s1; }

  /** interpolated frame at arc length s */
  frame(s, out = {}) {
    s = this.wrap(s);
    const f = s / this.ds; const i = Math.floor(f) % this.M; const j = (i + 1) % this.M; const t = f - Math.floor(f);
    const L = (A, k) => A[i * 3 + k] + (A[j * 3 + k] - A[i * 3 + k]) * t;
    out.x = this.px[i] + (this.px[j] - this.px[i]) * t;
    out.y = this.py[i] + (this.py[j] - this.py[i]) * t;
    out.z = this.pz[i] + (this.pz[j] - this.pz[i]) * t;
    out.tx = L(this.T, 0); out.ty = L(this.T, 1); out.tz = L(this.T, 2);
    out.rx = L(this.R, 0); out.rz = L(this.R, 2);
    out.rbx = L(this.Rb, 0); out.rby = L(this.Rb, 1); out.rbz = L(this.Rb, 2);
    out.nx = L(this.Nn, 0); out.ny = L(this.Nn, 1); out.nz = L(this.Nn, 2);
    out.w = this.W[i] + (this.W[j] - this.W[i]) * t;
    out.bank = this.B[i] + (this.B[j] - this.B[i]) * t;
    out.curv = this.curv[i] + (this.curv[j] - this.curv[i]) * t;
    out.s = s;
    return out;
  }
  halfWidth(s) { const fr = this.frame(s, _fr); return fr.w * 0.5; }

  /** world point on the (banked) road plane at lateral offset d (+ = right of travel) */
  point(s, d, out = [0, 0, 0]) {
    const fr = this.frame(s, _fr);
    const dd = d / Math.cos(fr.bank);
    out[0] = fr.x + fr.rbx * dd; out[1] = fr.y + fr.rby * dd; out[2] = fr.z + fr.rbz * dd;
    return out;
  }
  /** road plane height at (s, d), d measured horizontally */
  heightAt(s, d) { const fr = this.frame(s, _fr); return fr.y + fr.rby * (d / Math.cos(fr.bank)); }

  /** refine projection of (x,z) near sample index i -> {s, d, dist} */
  _refine(i, x, z, out) {
    const M = this.M;
    let best = null;
    for (const k of [i - 1, i]) {
      const a = ((k % M) + M) % M, b = (a + 1) % M;
      const ax = this.px[a], az = this.pz[a], bx = this.px[b], bz = this.pz[b];
      const vx = bx - ax, vz = bz - az; const L2 = vx * vx + vz * vz;
      let t = ((x - ax) * vx + (z - az) * vz) / L2; t = Math.max(0, Math.min(1, t));
      const cx = ax + vx * t, cz = az + vz * t;
      const dist = Math.hypot(x - cx, z - cz);
      if (!best || dist < best.dist) best = { a, t, dist };
    }
    const s = this.wrap((best.a + best.t) * this.ds);
    const fr = this.frame(s, _fr);
    const d = (x - fr.x) * fr.rx + (z - fr.z) * fr.rz;
    out.s = s; out.d = d; out.dist = Math.abs(d); out.y = fr.y + fr.rby * (d / Math.cos(fr.bank)); out.hw = fr.w * 0.5;
    return out;
  }

  /** global nearest projection (2D) */
  project(x, z, out = {}) {
    const cs = this.gcs; const cx = Math.floor((x - this.gx0) / cs), cz = Math.floor((z - this.gz0) / cs);
    let bestI = -1, bestD = Infinity;
    for (let r = 1; r <= 40 && bestI < 0; r += 3) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const arr = this.cells.get((cz + dz) * this.gnx + (cx + dx)); if (!arr) continue;
        for (const i of arr) { const d2 = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2; if (d2 < bestD) { bestD = d2; bestI = i; } }
      }
    }
    if (bestI < 0) { // fallback brute force
      for (let i = 0; i < this.M; i++) { const d2 = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2; if (d2 < bestD) { bestD = d2; bestI = i; } }
    }
    return this._refine(bestI, x, z, out);
  }

  /** projection restricted to a window around a hint s (for progress tracking) */
  projectNear(x, z, hintS, win = 40, out = {}) {
    const i0 = Math.round(this.wrap(hintS) / this.ds);
    const n = Math.ceil(win / this.ds);
    let bestI = -1, bestD = Infinity;
    for (let k = -n; k <= n; k++) {
      const i = ((i0 + k) % this.M + this.M) % this.M;
      const d2 = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
      if (d2 < bestD) { bestD = d2; bestI = i; }
    }
    return this._refine(bestI, x, z, out);
  }

  /** all distinct passes of the track within radius of (x,z) */
  passesNear(x, z, radius, out = []) {
    out.length = 0;
    const cs = this.gcs; const r = Math.ceil(radius / cs) + 1;
    const cx = Math.floor((x - this.gx0) / cs), cz = Math.floor((z - this.gz0) / cs);
    const cand = _cand; cand.length = 0;
    const r2 = (radius + 2) * (radius + 2);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const arr = this.cells.get((cz + dz) * this.gnx + (cx + dx)); if (!arr) continue;
      for (const i of arr) { const d2 = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2; if (d2 <= r2) cand.push(i, d2); }
    }
    if (!cand.length) return out;
    // group by index continuity (wrap-aware); pick local minima
    const idx = []; for (let k = 0; k < cand.length; k += 2) idx.push([cand[k], cand[k + 1]]);
    idx.sort((a, b) => a[0] - b[0]);
    const groups = [];
    let g = [idx[0]];
    for (let k = 1; k < idx.length; k++) {
      if (idx[k][0] - idx[k - 1][0] > 12) { groups.push(g); g = []; }
      g.push(idx[k]);
    }
    groups.push(g);
    // merge wrap-around group
    if (groups.length > 1 && groups[0][0][0] < 12 && this.M - 1 - groups[groups.length - 1].at(-1)[0] < 12) {
      const last = groups.pop(); groups[0] = last.concat(groups[0]);
    }
    for (const grp of groups) {
      let best = grp[0]; for (const e of grp) if (e[1] < best[1]) best = e;
      const o = this._refine(best[0], x, z, {});
      if (o.dist <= radius) out.push(o);
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }
}
const _fr = {};
const _cand = [];
