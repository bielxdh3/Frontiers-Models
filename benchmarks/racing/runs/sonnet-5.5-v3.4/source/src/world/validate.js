// validateWorld(): the world-integrity invariants of the spec (section 3.2), checked by code.
// Runs at load in dev mode (?dev=1) and in the automated tests. Throws via assertWorld() on any violation.
import { SHOULDER } from './track.js';
import { DEG } from '../core/util.js';

export const LIMITS = {
  terrainAboveRoad: 0.02,    // m
  edgeGap: 0.15,             // m
  objectFloatBury: 0.30,     // m (rocks may sink)
  maxBank: 12 * DEG,
  maxGrade: 0.14,
  minRadius: 25,             // m
};

export function validateWorld(world, opts = {}) {
  const { track: T, terrain } = world;
  const errors = [];
  const stats = {};
  const err = (code, msg) => { if (errors.length < 400) errors.push({ code, msg }); };
  const tmp = { x: 0, y: 0, z: 0 };

  // ---- road geometry limits
  let maxBank = 0, maxGrade = 0, minR = Infinity;
  for (let i = 0; i < T.N; i++) {
    maxBank = Math.max(maxBank, Math.abs(T.bank[i]));
    maxGrade = Math.max(maxGrade, Math.abs(T.grade[i]));
    if (Math.abs(T.kappa[i]) > 1e-6) minR = Math.min(minR, 1 / Math.abs(T.kappa[i]));
  }
  stats.maxBankDeg = +(maxBank / DEG).toFixed(2);
  stats.maxGradePct = +(maxGrade * 100).toFixed(2);
  stats.minRadiusM = +minR.toFixed(1);
  stats.lengthM = +T.length.toFixed(1);
  if (maxBank > LIMITS.maxBank) err('bank', `lateral slope ${(maxBank / DEG).toFixed(1)} deg > 12`);
  if (maxGrade > LIMITS.maxGrade) err('grade', `longitudinal slope ${(maxGrade * 100).toFixed(1)} % > 14`);
  if (minR < LIMITS.minRadius) err('radius', `curve radius ${minR.toFixed(1)} m < 25`);

  // ---- terrain vs road surface
  let worstAbove = -Infinity, worstGap = 0;
  const step = opts.sampleStep || 2;
  for (let i = 0; i < T.N; i += step) {
    const s = T.s[i];
    if (terrain.inBridgeSpan(s)) continue;
    const h = T.w[i] * 0.5, c = h + SHOULDER;
    // inside the road width: terrain must not poke above the surface
    for (let k = 0; k <= 8; k++) {
      const lat = -h + (2 * h * k) / 8;
      T.roadPoint(i, lat, 0, tmp);
      const dy = terrain.sample(tmp.x, tmp.z) - tmp.y;
      if (dy > worstAbove) worstAbove = dy;
      if (dy > LIMITS.terrainAboveRoad) { err('terrain-above-road', `terrain ${dy.toFixed(3)} m above road at s=${s.toFixed(0)} lat=${lat.toFixed(1)}`); break; }
    }
    // edge gap: road edge (outer shoulder edge) vs the terrain 15 cm beyond it
    // (the bridge abutments +-4 m are a structure, not a terrain/road junction)
    const br = T.json.bridge;
    if (br && s > br.s0 - 4 && s < br.s1 + 4) continue;
    for (const side of [-1, 1]) {
      T.roadPoint(i, side * c, 0, tmp);
      const ex = tmp.x, ey = tmp.y, ez = tmp.z;
      T.roadPoint(i, side * (c + 0.15), 0, tmp);
      const gap = Math.abs(terrain.sample(tmp.x, tmp.z) - ey);
      worstGap = Math.max(worstGap, gap);
      if (gap > LIMITS.edgeGap) { err('edge-gap', `gap ${gap.toFixed(3)} m at road edge s=${s.toFixed(0)} side=${side}`); }
    }
  }
  stats.worstTerrainAboveRoad = +worstAbove.toFixed(4);
  stats.worstEdgeGap = +worstGap.toFixed(4);

  // ---- objects: exclusion strip, floating/buried, house overlap
  const objs = world.objects || {};
  const all = [];
  for (const key of Object.keys(objs)) for (const o of objs[key]) all.push(o);
  stats.objects = all.length;
  const q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 }, tmpQ = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
  let inStrip = 0, floating = 0;
  for (const o of all) {
    if (o.skipValidation) continue;
    T.nearest(o.x, o.z, 200, -1, q);
    const h = T.w[q.i] * 0.5;
    const r = o.r || 0;
    let nearest = Math.abs(q.lat) - r;
    if (o.hw !== undefined && o.hd !== undefined && o.rot !== undefined) {
      // oriented footprint (houses): the true distance to the road is that of the closest point of the box, not of its bounding circle
      const c = Math.cos(o.rot), sn = Math.sin(o.rot); nearest = Infinity;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const px = o.x + c * o.hw * u + sn * o.hd * v, pz = o.z - sn * o.hw * u + c * o.hd * v;
        T.nearest(px, pz, 200, q.i, tmpQ); nearest = Math.min(nearest, Math.abs(tmpQ.lat));
      }
    }
    if (nearest < h + SHOULDER - 1e-3 && !o.onRoadBy) {
      inStrip++;
      err('exclusion', `${o.kind} at (${o.x.toFixed(1)},${o.z.toFixed(1)}) lat=${q.lat.toFixed(1)} r=${r.toFixed(1)} inside exclusion strip`);
    }
    if (o.baseY !== undefined) {
      const ty = terrain.sample(o.x, o.z);
      const diff = o.baseY - ty;
      const tol = o.kind === 'rock' ? { lo: -2.5, hi: LIMITS.objectFloatBury } : { lo: -LIMITS.objectFloatBury, hi: LIMITS.objectFloatBury };
      if (diff > tol.hi || diff < tol.lo) { floating++; err('float-bury', `${o.kind} base ${diff.toFixed(2)} m from terrain at (${o.x.toFixed(1)},${o.z.toFixed(1)})`); }
    }
  }
  stats.exclusionViolations = inStrip; stats.floatBury = floating;
  // houses: oriented-box overlap
  const houses = (objs.houses || []);
  let overlaps = 0;
  for (let a = 0; a < houses.length; a++) {
    for (let b = a + 1; b < houses.length; b++) {
      const A = houses[a], B = houses[b];
      const dx = B.x - A.x, dz = B.z - A.z;
      if (dx * dx + dz * dz > (A.r + B.r) * (A.r + B.r)) continue;
      if (obbOverlap(A, B)) { overlaps++; err('house-overlap', `houses ${a} and ${b} overlap`); }
    }
  }
  stats.houseOverlaps = overlaps;

  // ---- checkpoints on the road and in sequence
  const cps = T.checkpoints;
  let prev = -1, bad = 0;
  for (const s of cps) {
    if (s < prev) { bad++; err('checkpoint-order', `checkpoint s=${s} out of order`); }
    prev = s;
    const i = T.sToIndex(s);
    T.nearest(T.px[i], T.pz[i], 5, i, q);
    if (Math.abs(q.lat) > T.w[i] * 0.5) { bad++; err('checkpoint-off-road', `checkpoint s=${s} off the road`); }
  }
  stats.checkpoints = cps.length;

  return { ok: errors.length === 0, errors, stats };
}

export function assertWorld(world, opts) {
  const r = validateWorld(world, opts);
  if (!r.ok) {
    const head = r.errors.slice(0, 8).map(e => `  [${e.code}] ${e.msg}`).join('\n');
    throw new Error(`validateWorld FAILED (${r.errors.length} violation(s)):\n${head}`);
  }
  return r;
}

// oriented rectangles {x,z,hw,hd,rot} (rot = yaw radians, same convention as the renderer: local x axis -> (cos, -sin) in (x, z))
function obbOverlap(A, B) {
  const ca = Math.cos(A.rot), sa = Math.sin(A.rot), cb = Math.cos(B.rot), sb = Math.sin(B.rot);
  const axes = [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]];
  const dx = B.x - A.x, dz = B.z - A.z;
  for (const [ax, az] of axes) {
    const rA = A.hw * Math.abs(ax * ca + az * -sa) + A.hd * Math.abs(ax * sa + az * ca);
    const rB = B.hw * Math.abs(ax * cb + az * -sb) + B.hd * Math.abs(ax * sb + az * cb);
    if (Math.abs(dx * ax + dz * az) > rA + rB) return false;
  }
  return true;
}
