// Terrain: a heightfield generated from the track (single source of truth).
// 1) natural coastal relief h0 (bay, headland, hills, ravine under the bridge)
// 2) conform pass: lowered/raised to touch the road, flat shelf + 6-15 m talus
// The same heightfield (with the same triangulation) is used for the mesh and
// for the collider queries.
import { Noise2D, smoothstep, clamp, lerp } from '../core/rng.js';
import { SHOULDER, SHELF_EXTRA, terrainProfileOffset, shoulderWidth } from './profile.js';

export const TERRAIN_DELTA = 0.06; // terrain sits this far below the road plane under the road

export class Terrain {
  constructor(track, opts = {}) {
    this.track = track;
    this.cell = opts.cell ?? 2;
    this.x0 = opts.x0 ?? -1300; this.z0 = opts.z0 ?? -1400;
    this.x1 = opts.x1 ?? 1500; this.z1 = opts.z1 ?? 800;
    this.nx = Math.round((this.x1 - this.x0) / this.cell) + 1;
    this.nz = Math.round((this.z1 - this.z0) / this.cell) + 1;
    this.h = new Float32Array(this.nx * this.nz);
    this.noise = new Noise2D(track.seed ^ 0x51ab);
    this.noise2 = new Noise2D(track.seed ^ 0x77e1);
    this.edge = { 1: { shoulder: SHOULDER[1] }, 2: { shoulder: SHOULDER[2] }, 3: { shoulder: SHOULDER[3] }, 4: { shoulder: SHOULDER[4] } };
    this._prepFeatures();
    this._buildValley();
  }

  // ---- reference geometry derived from the spline ----
  _prepFeatures() {
    const T = this.track;
    const b = T.features.bridge;
    const sm = T.wrap((b.s0 + T.delta(b.s0, b.s1) / 2));
    const fr = T.frame(sm, {});
    this.bridgeMid = { x: fr.x, y: fr.y, z: fr.z, rx: fr.rx, rz: fr.rz, tx: fr.tx, tz: fr.tz, s: sm, half: Math.abs(T.delta(b.s0, b.s1)) / 2 };
    // coast: piecewise-smooth shoreline z(x), anchored to the main straight (Z1)
    const fs = T.frame(T.features.startS, {});
    this.straightZ = fs.z;
    const zs = fs.z;
    this.coastPts = [[-1400, zs - 10], [-800, zs + 5], [-560, zs + 24], [-420, zs + 40], [-300, zs + 50], [-210, zs + 62], [-90, zs + 80],
      [80, zs + 92], [260, zs + 90], [430, zs + 82], [600, zs + 66], [760, zs + 44], [950, zs + 20], [1600, zs - 20]];
  }
  /** broad valley around the forest descent (Z4), stamped from the spline: avoids deep cuttings */
  _buildValley() {
    const T = this.track, cell = 4, R = 175;
    const pts = [];
    for (let s = 0; s < T.length; s += 3) if (T.zoneAt(s) === 4) { const f = T.frame(s, {}); pts.push([f.x, f.y, f.z]); }
    if (!pts.length) return;
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const p of pts) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[2]); d = Math.max(d, p[2]); }
    const vx0 = a - R, vz0 = c - R, vnx = Math.ceil((b - a + 2 * R) / cell) + 1, vnz = Math.ceil((d - c + 2 * R) / cell) + 1;
    const tgt = new Float32Array(vnx * vnz).fill(1e9), wt = new Float32Array(vnx * vnz);
    const rc = Math.ceil(R / cell);
    for (const [px, py, pz] of pts) {
      const ci = Math.round((px - vx0) / cell), cj = Math.round((pz - vz0) / cell);
      for (let j = Math.max(0, cj - rc); j <= Math.min(vnz - 1, cj + rc); j++) for (let i = Math.max(0, ci - rc); i <= Math.min(vnx - 1, ci + rc); i++) {
        const dist = Math.hypot(vx0 + i * cell - px, vz0 + j * cell - pz);
        if (dist > R) continue;
        const k = j * vnx + i;
        const v = py + 2.5 + 0.12 * Math.max(0, dist - 16);
        if (v < tgt[k]) tgt[k] = v;
        const w = smoothstep(R, 75, dist);
        if (w > wt[k]) wt[k] = w;
      }
    }
    this.valley = { x0: vx0, z0: vz0, nx: vnx, nz: vnz, cell, tgt, wt };
  }
  _valleyAt(x, z) {
    const V = this.valley; if (!V) return null;
    const fx = (x - V.x0) / V.cell, fz = (z - V.z0) / V.cell;
    if (fx < 0 || fz < 0 || fx >= V.nx - 1 || fz >= V.nz - 1) return null;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * V.nx + i;
    const L = (A) => (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + V.nx] * (1 - u) + A[k + V.nx + 1] * u) * v;
    const w = L(V.wt); if (w <= 0) return null;
    return [Math.min(V.tgt[k], V.tgt[k + 1], V.tgt[k + V.nx], V.tgt[k + V.nx + 1]) < 1e8 ? L(V.tgt) : 1e9, w];
  }
  coastZ(x) {
    const P = this.coastPts;
    if (x <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (x <= P[i][0]) {
      const a = P[i - 1], c = P[i]; const t = (x - a[0]) / (c[0] - a[0]);
      const s = t * t * (3 - 2 * t);
      return a[1] + (c[1] - a[1]) * s + 6 * this.noise.noise(x / 90, 3.3);
    }
    return P[P.length - 1][1];
  }

  /** natural relief before conforming */
  h0(x, z) {
    const N = this.noise, N2 = this.noise2;
    const zc = this.coastZ(x);
    const din = zc - z; // + inland (north), - sea
    // cliff weight: rocky headland west, rocky point east
    const cliff = Math.max(smoothstep(-170, -320, x), smoothstep(700, 860, x));
    let h;
    if (din < 0) {
      const t = -din;
      const sandy = t < 70 ? -t * 0.035 : -2.45 - (t - 70) * 0.11;
      const rocky = -t * 0.32 - 1.0;
      h = Math.max(-38, lerp(sandy, rocky, cliff));
      // the seabed is a clean slope near the waterline (relief only from ~20 m out): on a 3.5 % beach,
      // ±0.35 m of noise at the shore made pools and sand bars flicker under the moving water
      h += 0.35 * N.noise(x / 23, z / 23) * (1 - cliff) * smoothstep(18, 60, t) + 1.2 * N.fbm(x / 40, z / 40, 3) * cliff;
    } else {
      // beach then hillside
      const beach = smoothstep(0, 52, din) * 2.7 + 0.45 * N.fbm(x / 31, z / 31, 3) * smoothstep(6, 30, din);
      const tt = Math.max(0, din - 52);
      let hill = 2.7 + tt * 0.235 - Math.max(0, tt - 230) * 0.11 + Math.max(0, tt - 420) * 0.12;
      hill += 5.5 * N.fbm(x / 170, z / 170, 4) * smoothstep(20, 120, tt);
      hill += 9 * N2.ridged(x / 260, z / 260, 4) * smoothstep(250, 600, tt);
      const cliffTop = 15 + 6 * N.fbm(x / 70, z / 70, 3);
      const rockyLand = Math.min(cliffTop, din * 1.4) + Math.max(0, din - 12) * 0.2 + 2.0 * N.fbm(x / 35, z / 35, 3);
      h = lerp(din < 52 ? beach : hill, Math.max(rockyLand, hill * 0.9), cliff);
      // far mountains (north)
      const far = smoothstep(500, 1100, din);
      h += far * (90 + 120 * N2.ridged(x / 520, z / 520, 5));
    }
    // valley around the forest descent (lower only)
    const vv = this._valleyAt(x, z);
    if (vv && vv[0] < 1e8 && h > vv[0]) h -= (h - vv[0]) * vv[1] * 0.92;
    // ravine crossing under the bridge (perpendicular to the road there)
    const B = this.bridgeMid;
    const dx = x - B.x, dz = z - B.z;
    const along = dx * B.rx + dz * B.rz; // along ravine axis
    const across = dx * B.tx + dz * B.tz; // across (parallel to road)
    const meander = 14 * N.noise(along / 90, 1.7) * smoothstep(20, 90, Math.abs(along));
    const ac = Math.abs(across - meander);
    const floorY = B.y - 17 - Math.max(0, along) * 0.05; // floor drops towards the sea side
    const crest = B.half - 9; // ravine reaches deck level just inside the abutments
    const rav = floorY + Math.max(0, ac - 8) * (17 / Math.max(10, crest - 8)) * 0.88 + Math.max(0, ac - crest - 4) * 0.5;
    const ravW = smoothstep(260, 160, Math.abs(along));
    if (ravW > 0) h = lerp(h, Math.min(h, rav), ravW);
    return h;
  }

  idx(i, j) { return j * this.nx + i; }

  generate() {
    const { nx, nz, cell, x0, z0 } = this;
    const h = this.h;
    for (let j = 0; j < nz; j++) {
      const z = z0 + j * cell;
      for (let i = 0; i < nx; i++) h[j * nx + i] = this.h0(x0 + i * cell, z);
    }
    this.h0Copy = new Float32Array(h);
    this._conform();
    this._smoothShelfEdges();
  }

  edgeFor(s) { return this.edge[this.track.zoneAt(s)]; }

  /** per-pass conform target for terrain point at horizontal lateral distance d */
  _passTarget(p, h0v) {
    const T = this.track;
    const hw = p.hw;
    const ad = Math.abs(p.d);
    const zone = T.zoneAt(p.s);
    const sh = shoulderWidth(T, p.s);
    const meshEdge = hw + sh;
    // extra flat pads derived from track features: village terraces, church plaza, viewpoint
    let extra = 0;
    const F = T.features;
    const side = Math.sign(p.d) || 1;
    if (T.inRange(p.s, F.village.s0, F.village.s1)) {
      const into = Math.min(Math.abs(T.delta(F.village.s0, p.s)), Math.abs(T.delta(p.s, F.village.s1)));
      extra = Math.max(extra, 13 * smoothstep(0, 30, into));
    }
    if (side === F.plaza.side && T.inRange(p.s, F.plaza.s0, F.plaza.s1)) {
      const into = Math.min(Math.abs(T.delta(F.plaza.s0, p.s)), Math.abs(T.delta(p.s, F.plaza.s1)));
      extra = Math.max(extra, 54 * smoothstep(0, 22, into));
    }
    if (side === F.mirante.side && T.inRange(p.s, F.mirante.s - F.mirante.length / 2, F.mirante.s + F.mirante.length / 2)) {
      const into = Math.min(Math.abs(T.delta(F.mirante.s - F.mirante.length / 2, p.s)), Math.abs(T.delta(p.s, F.mirante.s + F.mirante.length / 2)));
      extra = Math.max(extra, 11 * smoothstep(0, 10, into));
    }
    const shelfEnd = meshEdge + SHELF_EXTRA + extra;
    // road plane (+ mesh profile offset) extended beyond the edge with a small outward fall
    const dClamped = Math.sign(p.d) * Math.min(ad, meshEdge);
    const prof = terrainProfileOffset(T, p.s, Math.min(ad, meshEdge), hw);
    let t = T.heightAt(p.s, dClamped) + prof - TERRAIN_DELTA - Math.min(0.6, Math.max(0, ad - meshEdge) * 0.012);
    const dh = h0v - t;
    let W;
    if (dh > 0) W = zone === 2 ? clamp(6 + 0.25 * dh, 6, 9) : clamp(6 + 0.5 * dh, 6, 12);
    else W = clamp(7 + 0.6 * -dh, 7, 15);
    let w = 1 - smoothstep(shelfEnd, shelfEnd + W, ad);
    // bridge span: do not conform (the ravine stays under the deck), ramp at abutments
    const b = T.features.bridge;
    let clampY = Infinity;
    if (T.inRange(p.s, b.s0 - 2, b.s1 + 2)) {
      const inside = T.inRange(p.s, b.s0, b.s1);
      const into = inside ? Math.min(Math.abs(T.delta(b.s0, p.s)), Math.abs(T.delta(p.s, b.s1))) : 0;
      w *= 1 - smoothstep(2, 9, into);
      // terrain must stay under the deck (+1 m clearance), relaxing laterally
      const drop = smoothstep(0, 9, into) * (b.deck + 1.0);
      clampY = T.heightAt(p.s, 0) - drop + Math.max(0, ad - (meshEdge + 1.5)) * 1.1;
    }
    return { t, w, shelf: ad <= shelfEnd && w >= 0.999, clampY };
  }

  _conform() {
    const { nx, nz, cell, x0, z0 } = this;
    const T = this.track;
    const h = this.h;
    const passes = [];
    const R = 34; // max influence radius (hw 6 + 1.6 + 2 + 15 + margin)
    const RB = 92; // inside the village / plaza / viewpoint boxes (wide pads)
    const F = T.features, boxes = [];
    const boxOf = (s0, s1, m) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let s = s0; s <= s1; s += 4) { const fr = T.frame(s, {}); a = Math.min(a, fr.x); b = Math.max(b, fr.x); c = Math.min(c, fr.z); d = Math.max(d, fr.z); } return [a - m, b + m, c - m, d + m]; };
    const v0 = F.village.s0, v1 = v0 + T.delta(v0, F.village.s1);
    boxes.push(boxOf(v0, v1, 75));
    boxes.push(boxOf(F.mirante.s - F.mirante.length, F.mirante.s + F.mirante.length, 40));
    const bb = T.bounds;
    const i0 = Math.max(0, Math.floor((bb.minX - RB - 10 - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((bb.maxX + RB + 10 - x0) / cell));
    const j0 = Math.max(0, Math.floor((bb.minZ - RB - 10 - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((bb.maxZ + RB + 10 - z0) / cell));
    this.roadMask = new Uint8Array(nx * nz); // 2 = shelf, 1 = talus
    for (let j = j0; j <= j1; j++) {
      const z = z0 + j * cell;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + i * cell;
        let rr = R;
        for (const b of boxes) if (x > b[0] && x < b[1] && z > b[2] && z < b[3]) { rr = RB; break; }
        T.passesNear(x, z, rr, passes);
        if (!passes.length) continue;
        const k = j * nx + i;
        const h0v = h[k];
        let shelfT = null, shelfD = Infinity, sumW = 0, acc = 0;
        for (const p of passes) {
          const r = this._passTarget(p, h0v);
          p._clampY = r.clampY;
          if (r.shelf && p.dist < shelfD) { shelfT = r.t; shelfD = p.dist; }
          if (r.w > 0) { sumW += r.w; acc += r.w * (r.t - h0v); }
        }
        let clampY = Infinity;
        for (const p of passes) { if (p._clampY < clampY) clampY = p._clampY; }
        if (shelfT !== null) { h[k] = shelfT; this.roadMask[k] = 2; }
        else if (sumW > 0) { h[k] = h0v + acc / Math.max(1, sumW); this.roadMask[k] = 1; }
        if (h[k] > clampY) { h[k] = clampY; this.roadMask[k] = 3; }
      }
    }
  }

  _smoothShelfEdges() {
    // light smoothing of talus-only vertices to soften kinks (shelf vertices untouched)
    const { nx, nz } = this;
    const h = this.h, m = this.roadMask;
    const src = new Float32Array(h);
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i;
      if (m[k] !== 1) continue;
      let ok = true;
      for (const o of [-1, 1, -nx, nx]) if (m[k + o] === 2) { ok = false; break; }
      if (!ok) continue;
      h[k] = src[k] * 0.5 + (src[k - 1] + src[k + 1] + src[k - nx] + src[k + nx]) * 0.125;
    }
  }


  /** splat weights (7 layers) per heightfield vertex: sand, dryGrass, rock, forest, gravel, grass, rock2 */
  computeSplat() {
    const { cell: cell0, x0, z0 } = this;
    const SD = 2; // splat at half the heightfield resolution (4 m)
    const nx = Math.ceil(this.nx / SD), nz = Math.ceil(this.nz / SD), cell = cell0 * SD;
    this.splatW = nx; this.splatH = nz;
    const T = this.track;
    const A = new Uint8Array(nx * nz * 4), B = new Uint8Array(nx * nz * 4);
    const coast = new Float32Array(nx); for (let i = 0; i < nx; i++) coast[i] = this.coastZ(x0 + i * cell);
    const N = this.noise, N2 = this.noise2;
    const n = [0, 1, 0];
    // coarse track proximity (zone + distance) every 4 vertices
    const step = 2;
    const cw = Math.ceil(nx / step) + 1, ch = Math.ceil(nz / step) + 1;
    const cz = new Uint8Array(cw * ch), cd = new Float32Array(cw * ch);
    const bb = T.bounds;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const x = x0 + i * step * cell, z = z0 + j * step * cell;
      if (x < bb.minX - 300 || x > bb.maxX + 300 || z < bb.minZ - 300 || z > bb.maxZ + 300) { cz[j * cw + i] = 0; cd[j * cw + i] = 1e4; continue; }
      const ps = T.passesNear(x, z, 140, _passes);
      if (!ps.length) { cz[j * cw + i] = 0; cd[j * cw + i] = 1e4; continue; }
      cz[j * cw + i] = T.zoneAt(ps[0].s); cd[j * cw + i] = ps[0].dist;
    }
    for (let j = 0; j < nz; j++) {
      const z = z0 + j * cell;
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * cell;
        const k = j * nx + i;
        const hk = Math.min(this.nz - 1, j * SD) * this.nx + Math.min(this.nx - 1, i * SD);
        const h = this.h[hk];
        this.normalAt(x + 0.01, z + 0.01, n);
        const slope = Math.acos(Math.min(1, n[1]));
        const din = coast[i] - z;
        const cliff = Math.max(smoothstep(-170, -320, x), smoothstep(700, 860, x));
        const ci = Math.min(cw - 1, Math.round(i / step)), cj = Math.min(ch - 1, Math.round(j / step));
        const zone = cz[cj * cw + ci], dist = cd[cj * cw + ci];
        const nz1 = N.noise(x / 23, z / 23) * 0.7 + N.noise(x / 9, z / 9) * 0.3, nz2 = N2.noise(x / 70, z / 70);
        let sand = smoothstep(104, 86, din) * smoothstep(9.0, 6.0, h) * (1 - cliff * 0.85);
        sand = Math.max(sand, smoothstep(0.2, -0.6, h) * (1 - cliff * 0.7));
        let rock = smoothstep(0.62, 0.95, slope) + cliff * smoothstep(-2, 4, din) * smoothstep(50, 10, din) * 0.9;
        rock += smoothstep(0.45, 0.62, slope) * (0.4 + 0.3 * nz1);
        if (zone === 2 && dist < 40) rock += smoothstep(0.35, 0.6, slope) * 0.8;
        rock = Math.min(1, rock);
        let forest = 0;
        if (zone === 4 && dist < 130) forest = smoothstep(130, 25, dist) * (0.75 + 0.25 * nz2);
        forest = Math.max(forest, smoothstep(330, 420, din) * smoothstep(0.1, 0.4, nz2 + 0.15) * 0.8);
        let gravel = 0;
        const rm = this.roadMask[hk];
        if (rm === 2) gravel = 0.85; else if (rm === 1) gravel = 0.35 + 0.25 * nz1;
        if (rm === 3) gravel = 0.6;
        let grass = 0;
        if (zone === 3 && dist < 70) grass = smoothstep(70, 15, dist) * smoothstep(-0.1, 0.35, nz1) * 0.7;
        grass = Math.max(grass, smoothstep(0.25, 0.55, nz2) * 0.25 * smoothstep(60, 200, din));
        let dry = 0.45 + 0.2 * nz1;
        const rock2 = rock * smoothstep(-0.2, 0.3, nz2);
        rock = rock - rock2 * 0.7;
        // priorities
        const rk = Math.min(1, rock + rock2);
        sand *= 1 - rk * 0.8; forest *= 1 - rk; gravel *= 1 - rk * 0.5; grass *= 1 - rk; dry *= 1 - rk * 0.9;
        dry *= 1 - sand; forest *= 1 - sand; grass *= 1 - sand;
        dry *= 1 - forest * 0.75; grass *= 1 - forest * 0.6;
        dry *= 1 - gravel * 0.6; forest *= 1 - gravel * 0.5;
        const w = [sand, dry, Math.max(0, rock), forest, gravel, grass, rock2];
        let sum = 0; for (const v of w) sum += Math.max(0, v);
        const inv = sum > 0 ? 255 / sum : 0;
        A[k * 4] = w[0] * inv; A[k * 4 + 1] = w[1] * inv; A[k * 4 + 2] = Math.max(0, w[2]) * inv; A[k * 4 + 3] = w[3] * inv;
        B[k * 4] = w[4] * inv; B[k * 4 + 1] = w[5] * inv; B[k * 4 + 2] = w[6] * inv; B[k * 4 + 3] = 0;
      }
    }
    this.splatA = A; this.splatB = B;
    return { A, B };
  }


  /**
   * Baked terrain shadow volume for the fixed sun: for every sample, the height
   * below which a point is shadowed by terrain upstream (towards the sun).
   * Single pass in sun order: S(p) = max(h(p'), S(p')) - step * tan(elevation).
   */
  computeShadowHeight(sunDir, SD = 2) {
    const nx = Math.ceil(this.nx / SD), nz = Math.ceil(this.nz / SD), cell = this.cell * SD;
    const hl = Math.hypot(sunDir.x, sunDir.z);
    const dx = sunDir.x / hl, dz = sunDir.z / hl, tanE = sunDir.y / hl;
    const H = new Float32Array(nx * nz), S = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = this.h[Math.min(this.nz - 1, j * SD) * this.nx + Math.min(this.nx - 1, i * SD)];
    const order = new Uint32Array(nx * nz); const key = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; order[k] = k; key[k] = -(i * dx + j * dz); }
    order.sort((a, b) => key[a] - key[b]);
    const step = cell;
    const samp = (A, fx, fz) => {
      if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return -1e9;
      const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), u = fx - i, v = fz - j;
      const a = A[j * nx + i], b = A[j * nx + i + 1], c = A[(j + 1) * nx + i], d = A[(j + 1) * nx + i + 1];
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    };
    for (let q = 0; q < order.length; q++) {
      const k = order[q], i = k % nx, j = (k - i) / nx;
      const fx = i + dx, fz = j + dz;
      const up = Math.max(samp(H, fx, fz), samp(S, fx, fz));
      S[k] = up - step * tanE;
    }
    this.shadowH = S; this.shadowW = nx; this.shadowHt = nz;
    return S;
  }

  // ---- queries (same triangulation as the mesh: diagonal from (i+1,j) to (i,j+1)) ----
  heightAt(x, z) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.nx - 1 || j >= this.nz - 1) return -40;
    const u = fx - i, v = fz - j;
    const h = this.h, nx = this.nx, k = j * nx + i;
    const a = h[k], b = h[k + 1], c = h[k + nx], d = h[k + nx + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  normalAt(x, z, out = [0, 1, 0]) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.nx - 1 || j >= this.nz - 1) { out[0] = 0; out[1] = 1; out[2] = 0; return out; }
    const u = fx - i, v = fz - j, c = this.cell;
    const h = this.h, nx = this.nx, k = j * nx + i;
    const a = h[k], b = h[k + 1], cc = h[k + nx], d = h[k + nx + 1];
    let dhdx, dhdz;
    if (u + v <= 1) { dhdx = (b - a) / c; dhdz = (cc - a) / c; } else { dhdx = (d - cc) / c; dhdz = (d - b) / c; }
    const l = Math.hypot(dhdx, 1, dhdz);
    out[0] = -dhdx / l; out[1] = 1 / l; out[2] = -dhdz / l;
    return out;
  }
  vertexHeight(i, j) { i = clamp(i, 0, this.nx - 1); j = clamp(j, 0, this.nz - 1); return this.h[j * this.nx + i]; }
  slopeAt(x, z) { const n = this.normalAt(x, z, _n); return Math.acos(clamp(n[1], -1, 1)); }
}
const _n = [0, 1, 0];
const _passes = [];
