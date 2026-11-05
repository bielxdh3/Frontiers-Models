// Scatter: houses, vegetation and props positioned relative to the spline
// (arc length s + lateral offset d), validated against the exclusion strips of
// every nearby track pass, and set on the ground by raycast.
import { RNG, smoothstep } from '../core/rng.js';
import { EXCLUSION } from './profile.js';

export class Scatter {
  constructor(world) {
    this.world = world; this.T = world.track; this.rng = new RNG(world.track.seed ^ 0x5ca7);
    this.items = []; // {cat, type, x, y, z, rot, scale, color, radius}
    this.hash = new Map(); this.cell = 6;
    this._passes = [];
    world.placed = world.placed || [];
  }
  _key(i, j) { return i * 100003 + j; }
  _near(x, z, r) {
    const c = this.cell, out = [];
    for (let j = Math.floor((z - r - 12) / c); j <= Math.floor((z + r + 12) / c); j++) for (let i = Math.floor((x - r - 12) / c); i <= Math.floor((x + r + 12) / c); i++) {
      const a = this.hash.get(this._key(i, j)); if (a) for (const o of a) out.push(o);
    }
    return out;
  }
  free(x, z, r, gap = 0.3) {
    for (const o of this._near(x, z, r)) if (Math.hypot(o.x - x, o.z - z) < o.radius + r + gap) return false;
    return true;
  }
  /** clearance to the asphalt edge of every track pass within reach */
  edgeClear(x, z, r) {
    const ps = this.T.passesNear(x, z, 40, this._passes);
    let best = Infinity;
    for (const p of ps) best = Math.min(best, p.dist - p.hw - r);
    return best;
  }
  ground(x, z) { return this.world.groundHeight(x, z, 1e4); }
  slope(x, z) { return this.world.terrain.slopeAt(x, z); }
  /** try to place; returns item or null */
  place(cat, type, x, z, { radius = 0.5, rot = 0, scale = 1, color = null, minEdge = EXCLUSION, maxSlope = 0.55, minH = 0.4, maxH = 1e9, gap = 0.3, kind = null, footprint = null, sink = 0, register = true, onRoadOK = false } = {}) {
    if (this.edgeClear(x, z, radius) < minEdge + 0.05) return null;
    const y = this.ground(x, z);
    if (y < minH || y > maxH) return null;
    if (this.slope(x, z) > maxSlope) return null;
    if (!this.free(x, z, radius, gap)) return null;
    const fr0 = footprint ?? radius * 0.6;
    if (cat !== 'rock') for (const [fx, fz] of [[x + fr0, z], [x - fr0, z], [x, z + fr0], [x, z - fr0]]) if (Math.abs(this.ground(fx, fz) - y) > 0.24) return null;
    const it = { cat, type, x, y: y - sink, z, rot, scale, color, radius };
    this.items.push(it);
    const k = this._key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.hash.get(k); if (!a) { a = []; this.hash.set(k, a); } a.push(it);
    if (register) {
      const fr = footprint ?? radius * 0.6;
      const fp = [[x, z], [x + fr, z], [x - fr, z], [x, z + fr], [x, z - fr]];
      this.world.placed.push({ kind: kind || (cat === 'tree' ? 'tree' : cat === 'rock' ? 'rock' : 'prop'), name: type, x, z, radius, baseY: it.y + sink, footprint: fp });
    }
    return it;
  }
  /** half-buried rock (exempt from the floating rule: rocks may sink) */
  placeRock(x, z, size, R, minEdge = EXCLUSION) {
    if (this.edgeClear(x, z, size) < minEdge) return null;
    if (!this.free(x, z, size, 0.2)) return null;
    // lowest ground under the footprint so the rock never floats
    let y = Infinity; for (const [fx, fz] of [[x, z], [x + size, z], [x - size, z], [x, z + size], [x, z - size]]) y = Math.min(y, this.ground(fx, fz));
    const it = { cat: 'rock', type: 'rock' + Math.floor(R.float() * 4), x, y: y - size * 0.3, z, rot: R.range(0, 6.28), scale: [size * R.range(1, 1.6), size * R.range(0.6, 1.0), size * R.range(0.9, 1.4)], color: null, radius: size };
    this.items.push(it);
    const k = this._key(Math.floor(x / this.cell), Math.floor(z / this.cell)); let a = this.hash.get(k); if (!a) { a = []; this.hash.set(k, a); } a.push(it);
    this.world.placed.push({ kind: 'rock', name: it.type, x, z, radius: size, baseY: it.y, footprint: [[x, z]] });
    return it;
  }
  /** helper: world xz at (s, d) */
  at(s, d) { const p = this.T.point(s, d); return [p[0], p[2]]; }
  zoneRanges(zone) { return this.T.zoneList.filter((z) => z.zone === zone).map((z) => [z.s0, z.s1]); }
}

const TINT = (rng, base, v) => { const k = 1 - v / 2 + rng.float() * v; return ((Math.min(255, (base >> 16 & 255) * k) << 16) | (Math.min(255, (base >> 8 & 255) * k) << 8) | Math.min(255, (base & 255) * k)); };

export function scatterZ1(S) {
  const T = S.T, R = S.rng, W = S.world;
  const ranges = S.zoneRanges(1);
  const tree = (type, x, z, opt = {}) => S.place('tree', type, x, z, { radius: opt.radius ?? 0.45, rot: R.range(0, 6.28), scale: R.range(0.85, 1.15), color: TINT(R, 0xffffff, 0.22), maxSlope: 0.6, ...opt });
  for (const [s0, s1] of ranges) {
    for (let s = s0 + 4; s < s1 - 4; s += 1) {
      const hw = T.halfWidth(s);
      // north side (right, +d): palms, lamps, benches, bins, shrubs
      if (Math.floor(s) % 22 === 0) { const [x, z] = S.at(s, hw + R.range(10.5, 13)); tree('palm', x, z, { radius: 0.4 }); }
      if (Math.floor(s) % 20 === 7) { const [x, z] = S.at(s, hw + 3.4); S.place('prop', 'lamp', x, z, { radius: 0.25, rot: yawFace(...dirToRoad(T, s, 1)) }); }
      if (Math.floor(s) % 14 === 0) { const [x, z] = S.at(s, -(hw + 3.3)); S.place('prop', 'flag', x, z, { radius: 0.15, rot: yawAlong(T, s) + Math.PI, maxSlope: 1.2, gap: 0.05 }); }
      if (Math.floor(s) % 100 === 50) { const [x, z] = S.at(s, hw + 3.6); S.place('prop', 'kmstone', x, z, { radius: 0.3, rot: yawAlong(T, s), maxSlope: 1.2, gap: 0.1 }); }
      if (Math.floor(s) % 45 === 18) { const [x, z] = S.at(s, hw + 4.6); S.place('prop', 'bench', x, z, { radius: 1.0, rot: yawAlong(T, s), maxSlope: 0.25 }); }
      if (Math.floor(s) % 45 === 26) { const [x, z] = S.at(s, hw + 4.2); S.place('prop', 'bin', x, z, { radius: 0.3 }); }
      if (Math.floor(s) % 9 === 3) { const [x, z] = S.at(s, hw + R.range(14, 26)); tree(R.chance(0.3) ? 'shrubFlower' : 'shrub', x, z, { radius: 0.9, scale: R.range(0.7, 1.3) }); }
      if (Math.floor(s) % 4 === 1) { const [x, z] = S.at(s, hw + R.range(3.2, 9)); S.place('grass', 'grass', x, z, { radius: 0.3, rot: R.range(0, 6.28), scale: R.range(0.7, 1.3), gap: 0, register: true, kind: 'tree' }); }
      // south side (beach, -d)
      if (Math.floor(s) % 22 === 11) { const [x, z] = S.at(s, -(hw + R.range(10.5, 12))); tree('palm', x, z, { radius: 0.4, minH: 0.8 }); }
      if (Math.floor(s) % 20 === 17) { const [x, z] = S.at(s, -(hw + 3.4)); S.place('prop', 'lamp', x, z, { radius: 0.25, rot: yawFace(...dirToRoad(T, s, -1)) }); }
      if (Math.floor(s) % 12 === 0) {
        // beach fence segments along the dune line
        const d = -(hw + 16 + 2 * Math.sin(s * 0.03));
        const [x, z] = S.at(s, d); S.place('prop', 'fence', x, z, { radius: 2.0, rot: yawAlong(T, s) + R.range(-0.08, 0.08), maxSlope: 0.4, minH: 0.8, gap: 0.1 });
      }
      if (Math.floor(s) % 16 === 5) {
        // umbrellas + loungers on the beach (between fence and water)
        const beachW = Math.max(10, beachWidth(W, T, s) - 18);
        const d = -(hw + 20 + R.range(0, beachW));
        const [x, z] = S.at(s, d);
        if (S.place('prop', 'umbrella', x, z, { radius: 1.4, rot: R.range(0, 6.28), minH: 0.7, maxSlope: 0.3 })) {
          const a = R.range(0, 6.28);
          S.place('prop', 'lounger', x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6, { radius: 0.9, rot: a + Math.PI / 2, minH: 0.7, maxSlope: 0.3, gap: 0.05 });
        }
      }
      if (Math.floor(s) % 140 === 70) { const bw = beachWidth(W, T, s); const [x, z] = S.at(s, -(hw + 24 + bw * 0.35)); S.place('prop', 'tower', x, z, { radius: 1.6, rot: roadYaw(T, s) + Math.PI, minH: 0.6, maxSlope: 0.3 }); }
      if (Math.floor(s) % 95 === 40) { const bw = beachWidth(W, T, s); const [x, z] = S.at(s, -(hw + 14 + bw * 0.85)); S.place('prop', 'boat', x, z, { radius: 2.2, rot: roadYaw(T, s) + R.range(1.2, 1.9), minH: 0.25, maxSlope: 0.3 }); }
    }
  }
  // hillside above the north side: stone pines, olives, cypresses and shrubs in clumps
  for (const [s0, s1] of ranges) {
    for (let s = s0; s < s1; s += 7) {
      const hw = T.halfWidth(s);
      for (let k = 0; k < 3; k++) {
        const d = hw + R.range(20, 130);
        const [x, z] = S.at(s + R.range(-3, 3), d);
        const clump = W.terrain.noise.noise(x / 60, z / 60);
        if (clump < -0.05 && R.chance(0.7)) continue;
        const r = R.float();
        const type = r < 0.25 ? 'pine' : r < 0.45 ? 'olive' : r < 0.55 ? 'cypress' : r < 0.8 ? 'shrub' : 'shrubFlower';
        tree(type, x, z, { radius: type === 'pine' ? 0.6 : type.startsWith('shrub') ? 0.9 : 0.45, maxSlope: 0.75, gap: type === 'pine' ? 3 : 0.8 });
      }
    }
  }
  // cut slope right above the north side: half-buried rock outcrops + shrubs (breaks the bare talus)
  for (const [s0, s1] of ranges) {
    for (let s = s0; s < s1; s += 3.5) {
      const hw = T.halfWidth(s);
      const d = hw + R.range(4.5, 22);
      const [x, z] = S.at(s + R.range(-1.5, 1.5), d);
      if (S.slope(x, z) < 0.25) continue;
      if (R.chance(0.55)) { const sz = R.range(0.5, 1.9); S.placeRock(x, z, sz, R); }
      else S.place('tree', R.chance(0.35) ? 'shrubFlower' : 'shrub', x, z, { radius: 0.7, footprint: 0.25, rot: R.range(0, 6.28), scale: R.range(0.55, 1.0), color: TINT(R, 0xffffff, 0.25), maxSlope: 0.95 });
    }
  }
  scatterCoastRocks(S);
}

/** rocks in the water / at the waterline around both ends of the beach and the headland (relative to the Z1/Z2 spline) */
export function scatterCoastRocks(S) {
  const T = S.T, R = S.rng, W = S.world;
  const tr = W.terrain;
  S.foamStamps = S.foamStamps || [];
  // walk the shoreline along the track's z-range using the terrain's coast function (anchored to the main straight)
  const bb = T.bounds;
  for (let x = bb.minX - 160; x < bb.maxX + 140; x += R.range(5, 11)) {
    const cliff = Math.max(smoothstep(-170, -320, x), smoothstep(700, 860, x));
    const density = 0.18 + cliff * 0.75 + smoothstep(-60, -200, x) * 0.3 + smoothstep(420, 560, x) * 0.3;
    if (!R.chance(density)) continue;
    const zc = tr.coastZ(x);
    const out = R.range(-4, 16) + cliff * R.range(0, 10);
    const z = zc + out;
    const size = R.range(0.7, 2.4) * (1 + cliff * 0.8);
    const y = tr.heightAt(x, z);
    if (y > 1.2) continue;
    if (S.edgeClear(x, z, size) < 6) continue;
    if (!S.free(x, z, size, 0.2)) continue;
    const wet = y < 0.15;
    const it = { cat: 'rock', type: 'rock' + (Math.floor(R.float() * 4)), x, y: y - size * (wet ? 0.22 : 0.35), z, rot: R.range(0, 6.28), scale: [size * R.range(1, 1.5), size * (wet ? R.range(1.05, 1.6) : R.range(0.7, 1.1)), size * R.range(0.9, 1.3)], color: null, radius: size };
    S.items.push(it);
    const k = S._key(Math.floor(x / S.cell), Math.floor(z / S.cell)); let a = S.hash.get(k); if (!a) { a = []; S.hash.set(k, a); } a.push(it);
    W.placed.push({ kind: 'rock', name: it.type, x, z, radius: size, baseY: it.y, footprint: [[x, z]] });
    if (wet) {
      S.foamStamps.push([x, z, size * 1.1]);
      // a few smaller companions around the big one (clusters read better than single domes)
      const nC = 1 + Math.floor(R.float() * 3);
      for (let c = 0; c < nC; c++) {
        const ang = R.range(0, 6.28), dd = size * R.range(1.3, 2.2), cx = x + Math.cos(ang) * dd, cz = z + Math.sin(ang) * dd, cs = size * R.range(0.3, 0.55);
        const cy = tr.heightAt(cx, cz); if (cy > 0.15) continue;
        const ci = { cat: 'rock', type: 'rock' + (Math.floor(R.float() * 4)), x: cx, y: cy - cs * 0.25, z: cz, rot: R.range(0, 6.28), scale: [cs * R.range(1, 1.4), cs * R.range(1.0, 1.5), cs * R.range(0.9, 1.3)], color: null, radius: cs };
        S.items.push(ci);
        W.placed.push({ kind: 'rock', name: ci.type, x: cx, z: cz, radius: cs, baseY: ci.y, footprint: [[cx, cz]] });
        S.foamStamps.push([cx, cz, cs * 1.1]);
      }
    }
  }
}

export function roadYaw(T, s) { const f = T.frame(s, {}); return Math.atan2(f.tx, f.tz); }
/** yaw so that local +X runs along the road tangent (local -Z then faces the road for right-side objects) */
export function yawAlong(T, s) { const f = T.frame(s, {}); return Math.atan2(-f.tz, f.tx); }
/** yaw so that local +X points along (dx, dz) */
export function yawFace(dx, dz) { return Math.atan2(-dz, dx); }
function dirToRoad(T, s, side) { const f = T.frame(s, {}); return [-f.rx * side, -f.rz * side]; }
export function beachWidth(W, T, s) {
  const f = T.frame(s, {});
  const zc = W.terrain.coastZ(f.x);
  return Math.max(0, zc - f.z - f.w / 2 - 12);
}
export { TINT };

/** Z2 falesia: rock-face formations on the uphill side, shrubs/pines, delineators, chevrons, viewpoint */
export function scatterZ2(S) {
  const T = S.T, R = S.rng, W = S.world;
  const ranges = S.zoneRanges(2);
  const runs = W.barriers.runs;
  const kindAt = (s, side) => { for (const r of runs) if (r.side === side && T.inRange(s, r.i0 * r.step, r.i1 * r.step)) return r.type; return null; };
  const tree = (type, x, z, opt = {}) => S.place('tree', type, x, z, { radius: opt.radius ?? 0.45, rot: R.range(0, 6.28), scale: R.range(0.85, 1.15), color: TINT(R, 0xffffff, 0.22), maxSlope: 0.7, ...opt });
  for (const [s0, s1] of ranges) {
    for (let s = s0; s < s1; s += 1) {
      const hw = T.halfWidth(s);
      for (const side of [-1, 1]) {
        const k = kindAt(s, side);
        if (k === 'retaining' && Math.floor(s) % 3 === 0) {
          // rock wall: big stretched rocks just behind the retaining wall, overlapping
          const sz = R.range(2.2, 4.8);
          const [x, z] = S.at(s + R.range(-1, 1), side * (hw + 4.2 + sz * 0.7 + R.range(0, 1.5)));
          const it = S.placeRock(x, z, sz, R, 3.0);
          if (it) { it.scale = [sz * R.range(1.0, 1.5), sz * R.range(1.2, 2.0), sz * R.range(0.9, 1.3)]; it.y -= sz * 0.15; }
        }
        if (Math.floor(s) % 12 === (side > 0 ? 3 : 9)) { const [x, z] = S.at(s, side * (hw + 3.35)); S.place('prop', 'delineator', x, z, { radius: 0.1, rot: yawAlong(T, s), maxSlope: 1.2, gap: 0.05 }); }
        if (Math.floor(s) % 100 === 50 && side > 0) { const [x, z] = S.at(s, side * (hw + 3.6)); S.place('prop', 'kmstone', x, z, { radius: 0.3, rot: yawAlong(T, s), maxSlope: 1.2, gap: 0.1 }); }
        if (Math.floor(s) % 6 === 0) {
          const d = hw + R.range(6, 40);
          const [x, z] = S.at(s + R.range(-2, 2), side * d);
          const r = R.float();
          tree(r < 0.35 ? 'shrub' : r < 0.5 ? 'shrubFlower' : r < 0.7 ? 'cypress' : r < 0.85 ? 'pine' : 'olive', x, z, { radius: r < 0.5 ? 0.6 : 0.5, footprint: 0.3, maxSlope: 0.85, gap: 1.0 });
        }
        if (Math.floor(s) % 5 === 2) { const [x, z] = S.at(s, side * (hw + R.range(3.3, 6))); S.place('grass', 'grass', x, z, { radius: 0.3, rot: R.range(0, 6.28), scale: R.range(0.7, 1.2), gap: 0, kind: 'tree', maxSlope: 1.0 }); }
      }
    }
  }
  // chevrons on the outside of tight corners
  for (let s = 0; s < T.length; s += 6) {
    if (T.zoneAt(s) === 1 || T.zoneAt(s) === 3) continue;
    const c = T.frame(s, {}).curv;
    if (Math.abs(c) < 1 / 70) continue;
    if (Math.floor(s / 6) % 2) continue;
    const outer = c > 0 ? -1 : 1; // right turn -> outer is left
    const hw = T.halfWidth(s);
    const [x, z] = S.at(s, outer * (hw + 3.4));
    const f = T.frame(s, {});
    S.place('prop', 'chevron', x, z, { radius: 0.7, rot: yawFace(-f.rx * outer, -f.rz * outer) + Math.PI / 2 * 0 + (outer > 0 ? Math.PI : 0) * 0, maxSlope: 1.3, gap: 0.3 });
  }
  dressBanks(S, 2, 3.6);
  // viewpoint (mirante): benches, telescopes, lamp on the platform beyond the balustrade
  const m = T.features.mirante;
  for (let k = -2; k <= 2; k++) {
    const s = m.s + k * 8;
    const hw = T.halfWidth(s);
    const [bx, bz] = S.at(s, m.side * (hw + 5.5));
    S.place('prop', k % 2 ? 'telescope' : 'bench', bx, bz, { radius: k % 2 ? 0.3 : 0.95, rot: yawAlong(T, s) + (m.side > 0 ? 0 : Math.PI), maxSlope: 0.6, gap: 0.3 });
    if (k === 0) { const [lx, lz] = S.at(s + 3, m.side * (hw + 8.5)); S.place('prop', 'lamp', lx, lz, { radius: 0.25, maxSlope: 0.6 }); }
  }
}

/** dress steep cut/fill banks near the road with half-buried rocks, shrubs and trees */
export function dressBanks(S, zone, every = 3.2) {
  const T = S.T, R = S.rng;
  for (const [s0, s1] of S.zoneRanges(zone)) for (let s = s0; s < s1; s += every) {
    const hw = T.halfWidth(s);
    for (const side of [-1, 1]) {
      const d = hw + R.range(4.5, 26);
      const [x, z] = S.at(s + R.range(-1.5, 1.5), side * d);
      const sl = S.slope(x, z);
      if (sl < 0.3) continue;
      const r = R.float();
      if (r < 0.4) S.placeRock(x, z, R.range(0.6, 2.2), R);
      else if (r < 0.75) S.place('tree', R.chance(0.3) ? 'shrubFlower' : 'shrub', x, z, { radius: 0.7, footprint: 0.22, rot: R.range(0, 6.28), scale: R.range(0.6, 1.1), color: TINT(R, 0xffffff, 0.25), maxSlope: 1.0, gap: 0.3 });
      else S.place('tree', zone === 4 ? (R.chance(0.6) ? 'pine' : 'olive') : (R.chance(0.5) ? 'cypress' : 'olive'), x, z, { radius: 0.5, footprint: 0.2, rot: R.range(0, 6.28), scale: R.range(0.75, 1.1), color: TINT(R, 0xffffff, 0.22), maxSlope: 0.95, gap: 2.0 });
    }
  }
}

/** Z4 bosque: dense stone pines / olives / cypresses with undergrowth; keep a sky corridor over the road */
export function scatterZ4(S) {
  const T = S.T, R = S.rng, W = S.world;
  const ranges = S.zoneRanges(4);
  const bridge = T.features.bridge;
  const tree = (type, x, z, opt = {}) => S.place('tree', type, x, z, { radius: opt.radius ?? 0.5, rot: R.range(0, 6.28), scale: R.range(0.8, 1.2), color: TINT(R, 0xffffff, 0.25), maxSlope: 0.7, ...opt });
  for (const [s0, s1] of ranges) {
    for (let s = s0; s < s1; s += 1) {
      const hw = T.halfWidth(s);
      const onBridge = T.inRange(s, bridge.s0 - 6, bridge.s1 + 6);
      for (const side of [-1, 1]) {
        if (Math.floor(s) % 12 === (side > 0 ? 2 : 8)) { const [x, z] = S.at(s, side * (hw + 3.35)); S.place('prop', 'delineator', x, z, { radius: 0.1, rot: yawAlong(T, s), maxSlope: 1.2, gap: 0.05 }); }
        if (Math.floor(s) % 100 === 50 && side > 0) { const [x, z] = S.at(s, side * (hw + 3.6)); S.place('prop', 'kmstone', x, z, { radius: 0.3, rot: yawAlong(T, s), maxSlope: 1.2, gap: 0.1 }); }
        if (onBridge) continue;
        // first row: pines / olives close to the road (crowns overhang a little, sky stays open)
        if (Math.floor(s) % 9 === (side > 0 ? 0 : 4)) {
          const [x, z] = S.at(s + R.range(-2, 2), side * (hw + R.range(7.5, 11)));
          tree(R.chance(0.65) ? 'pine' : 'olive', x, z, { radius: 0.6, gap: 2.5 });
        }
        // deeper forest
        if (Math.floor(s) % 3 === 0) {
          for (let k = 0; k < 2; k++) {
            const d = hw + R.range(12, 140);
            const [x, z] = S.at(s + R.range(-4, 4), side * d);
            const r = R.float();
            tree(r < 0.5 ? 'pine' : r < 0.75 ? 'olive' : r < 0.85 ? 'cypress' : 'shrub', x, z, { radius: r < 0.75 ? 0.6 : 0.5, gap: r < 0.5 ? 3.5 : 1.2, maxSlope: 0.75 });
          }
        }
        // undergrowth near the edge
        if (Math.floor(s) % 3 === 1) { const [x, z] = S.at(s, side * (hw + R.range(3.4, 7))); tree(R.chance(0.25) ? 'shrubFlower' : 'shrub', x, z, { radius: 0.6, footprint: 0.3, scale: R.range(0.6, 1.0), gap: 0.4, maxSlope: 0.9 }); }
        if (Math.floor(s) % 2 === 0) { const [x, z] = S.at(s + R.range(-1, 1), side * (hw + R.range(3.2, 9))); S.place('grass', 'grass', x, z, { radius: 0.3, rot: R.range(0, 6.28), scale: R.range(0.7, 1.3), gap: 0, kind: 'tree', maxSlope: 1.0 }); }
        if (Math.floor(s) % 40 === 11 && R.chance(0.6)) { const [x, z] = S.at(s, side * (hw + R.range(4, 7))); S.placeRock(x, z, R.range(0.5, 1.2), R); }
      }
    }
  }
  dressBanks(S, 4, 2.6);
  // picnic spot near the bridge end
  const sb = bridge.s1 + 30;
  for (let k = 0; k < 3; k++) { const [x, z] = S.at(sb + k * 7, 1 * (T.halfWidth(sb) + R.range(6, 10))); S.place('prop', 'picnic', x, z, { radius: 1.1, rot: yawAlong(T, sb), maxSlope: 0.4, gap: 0.5 }); }
}
