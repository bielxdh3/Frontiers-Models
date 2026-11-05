// validateWorld(): static invariants of section 3.2, checked by code.
// Throws (or returns errors) when any invariant is violated.
import { shoulderWidth, profileOffset, EXCLUSION } from './profile.js';

const DEG = 180 / Math.PI;

export function validateWorld(world, { throwOnError = false } = {}) {
  const { track: T, terrain, collision } = world;
  const errors = [];
  const stats = {};
  const err = (code, msg, data) => { if (errors.length < 400) errors.push({ code, msg, ...data }); };
  const bridge = T.features.bridge;
  const hit = {};

  // 1. terrain above the road surface inside the track width (> 0.02 m)
  // 2. gap between road edge and terrain (> 0.15 m)
  let maxAbove = -Infinity, maxGap = 0, samples = 0;
  for (let s = 0; s < T.length; s += 1.0) {
    const onBridge = T.inRange(s, bridge.s0 - 1, bridge.s1 + 1);
    const fr = T.frame(s, {});
    const hw = fr.w * 0.5;
    {
      for (let k = -10; k <= 10; k++) {
        const d = (k / 10) * hw;
        const p = T.point(s, d);
        const r = collision.drivable.query(p[0], p[2], p[1] + 0.5, hit);
        const roadY = r ? r.y : p[1];
        const th = terrain.heightAt(p[0], p[2]);
        const above = th - roadY;
        samples++;
        if (above > maxAbove) maxAbove = above;
        if (above > 0.02) err('TERRAIN_ABOVE_ROAD', `terrain ${above.toFixed(3)} m above road`, { s: +s.toFixed(1), d: +d.toFixed(2) });
      }
      // road mesh outer edge vs terrain just outside (a bridge deck is exempt by design)
      const sh = shoulderWidth(T, s);
      if (!onBridge) for (const side of [-1, 1]) {
        const ad = hw + sh;
        const p = T.point(s, side * ad);
        const edgeY = p[1] + profileOffset(T, s, ad, hw);
        const th = terrain.heightAt(p[0], p[2]);
        const gap = Math.abs(edgeY - th);
        if (gap > maxGap) maxGap = gap;
        if (gap > 0.15) err('EDGE_GAP', `road edge / terrain gap ${gap.toFixed(3)} m`, { s: +s.toFixed(1), side });
      }
    }
  }
  stats.maxTerrainAboveRoad = +maxAbove.toFixed(4);
  stats.maxEdgeGap = +maxGap.toFixed(4);
  stats.surfaceSamples = samples;

  // 3. objects inside exclusion strip / 4. floating or buried bases / 5. house overlap
  const objs = world.placed || [];
  let excl = 0, floatErr = 0;
  for (const o of objs) {
    if (o.kind === 'infra') continue;
    // clearance to the asphalt edge of every track pass nearby (not only the nearest one)
    const ps = T.passesNear(o.x, o.z, 60, []);
    let clearance = Infinity;
    for (const p of ps) clearance = Math.min(clearance, p.dist - p.hw - o.radius);
    if (!ps.length) { const pr = T.project(o.x, o.z, {}); clearance = pr.dist - pr.hw - o.radius; }
    if (clearance < EXCLUSION - 1e-3) { excl++; err('EXCLUSION', `${o.kind} ${o.name || ''} ${clearance.toFixed(2)} m from track edge`, { x: +o.x.toFixed(1), z: +o.z.toFixed(1) }); }
    if (o.footprint) {
      let worst = 0;
      for (const [fx, fz] of o.footprint) {
        const g = world.groundHeight(fx, fz);
        const dy = o.baseY - g;
        if (o.kind === 'rock') { if (dy > 0.3) worst = Math.max(worst, dy); }
        else if (Math.abs(dy) > Math.abs(worst)) worst = dy;
      }
      const limit = o.kind === 'house' ? (o.plinth || 0.3) : 0.3;
      if (o.kind !== 'rock' && (worst > 0.3 || -worst > limit)) { floatErr++; err('BASE_OFFSET', `${o.kind} base ${worst > 0 ? 'floating' : 'buried'} ${Math.abs(worst).toFixed(2)} m`, { x: +o.x.toFixed(1), z: +o.z.toFixed(1) }); }
      if (o.kind === 'rock' && worst > 0.3) { floatErr++; err('BASE_OFFSET', `rock floating ${worst.toFixed(2)} m`, { x: +o.x.toFixed(1), z: +o.z.toFixed(1) }); }
    }
  }
  const houses = objs.filter((o) => o.kind === 'house');
  let overlaps = 0;
  for (let i = 0; i < houses.length; i++) for (let j = i + 1; j < houses.length; j++) {
    if (obbOverlap(houses[i].obb, houses[j].obb)) { overlaps++; err('HOUSE_OVERLAP', `houses ${i} and ${j} overlap`, { x: +houses[i].x.toFixed(1), z: +houses[i].z.toFixed(1) }); }
  }
  stats.objects = objs.length; stats.houses = houses.length; stats.exclusionViolations = excl; stats.baseViolations = floatErr; stats.houseOverlaps = overlaps;

  // 6. lateral bank, 7. longitudinal grade, 8. min radius
  let maxBank = 0, maxGrade = 0, minR = Infinity, minRs = 0;
  for (let i = 0; i < T.M; i++) {
    const b = Math.abs(T.B[i]) * DEG; if (b > maxBank) maxBank = b;
    const g = Math.abs(T.grade[i]); if (g > maxGrade) maxGrade = g;
  }
  // radius from the circumscribed circle of points 6 m apart
  for (let i = 0; i < T.M; i++) {
    const a = (i - 6 + T.M) % T.M, c = (i + 6) % T.M;
    const R = circumR(T.px[a], T.pz[a], T.px[i], T.pz[i], T.px[c], T.pz[c]);
    if (R < minR) { minR = R; minRs = i * T.ds; }
  }
  if (maxBank > 12) err('BANK', `bank ${maxBank.toFixed(2)} deg > 12`, {});
  if (maxGrade > 0.14) err('GRADE', `grade ${(maxGrade * 100).toFixed(2)} % > 14`, {});
  if (minR < 25) err('RADIUS', `min radius ${minR.toFixed(1)} m < 25`, { s: +minRs.toFixed(1) });
  stats.maxBankDeg = +maxBank.toFixed(3); stats.maxGradePct = +(maxGrade * 100).toFixed(3); stats.minRadius = +minR.toFixed(2); stats.minRadiusAtS = +minRs.toFixed(1);
  stats.length = +T.length.toFixed(2);

  // 9. checkpoints on track and in sequence
  const cps = world.checkpoints || [];
  let prevS = -1;
  cps.forEach((cp, k) => {
    const pr = T.project(cp.x, cp.z, {});
    if (pr.dist > 0.5) err('CHECKPOINT_OFF', `checkpoint ${k} ${pr.dist.toFixed(2)} m off the spline`, {});
    if (k > 0 && !(cp.s > prevS)) err('CHECKPOINT_ORDER', `checkpoint ${k} out of sequence`, {});
    prevS = cp.s;
  });
  stats.checkpoints = cps.length;

  const result = { ok: errors.length === 0, errors, stats };
  if (throwOnError && !result.ok) {
    const e = new Error(`validateWorld failed: ${errors.length} errors, first: ${errors[0].code} ${errors[0].msg}`);
    e.result = result; throw e;
  }
  return result;
}

function circumR(ax, az, bx, bz, cx, cz) {
  const a = Math.hypot(bx - cx, bz - cz), b = Math.hypot(ax - cx, az - cz), c = Math.hypot(ax - bx, az - bz);
  const area2 = Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az));
  if (area2 < 1e-9) return Infinity;
  return (a * b * c) / (2 * area2);
}

export function obbOverlap(A, B) {
  // A, B: {cx, cz, hx, hz, ang}
  const axes = [];
  for (const o of [A, B]) { const c = Math.cos(o.ang), s = Math.sin(o.ang); axes.push([c, s], [-s, c]); }
  for (const [ax, az] of axes) {
    const pa = projObb(A, ax, az), pb = projObb(B, ax, az);
    if (pa[1] <= pb[0] + 0.01 || pb[1] <= pa[0] + 0.01) return false;
  }
  return true;
}
function projObb(o, ax, az) {
  const c = Math.cos(o.ang), s = Math.sin(o.ang);
  const center = o.cx * ax + o.cz * az;
  const r = Math.abs((c * ax + s * az) * o.hx) + Math.abs((-s * ax + c * az) * o.hz);
  return [center - r, center + r];
}
