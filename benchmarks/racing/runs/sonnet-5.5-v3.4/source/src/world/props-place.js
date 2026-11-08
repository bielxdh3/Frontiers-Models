// Deterministic roadside props, placed by distance along the spline + lateral offset beyond the exclusion strip, then dropped onto the
// terrain. Every item is registered in world.objects.props (kind, x, z, r, baseY) so validateWorld() checks exclusion and floating/buried.
import { SHOULDER, BARRIER } from './track.js';
import { rng } from '../core/util.js';
import { SpatialHash } from './populate.js';

export const PROP_KINDS = ['lamp', 'lamp-bridge', 'bollard', 'delineator', 'chevron', 'warn', 'board', 'bench', 'bin', 'planter', 'cafe', 'fence', 'sandfence', 'parasol', 'lounger', 'tyres', 'hay', 'rock', 'mirante', 'cairn'];

export function placeProps(world, blocked, seed = 21) {
  const T = world.track, terr = world.terrain, R = rng(seed * 131 + 5), items = [], used = new SpatialHash(1.0);
  const L = T.length;
  const tmp = { x: 0, y: 0, z: 0 };
  const counts = {};
  const reg = (kind, x, z, r, baseY, extra = {}) => { world.objects.props.push({ kind, x, z, r, baseY, ...extra }); };

  /** lat (m from the centre line) for an item of radius r that sits `extra` metres beyond the exclusion strip */
  const latOf = (i, r, extra) => T.w[i] * 0.5 + SHOULDER + r + 0.12 + extra;
  const barrierAt = (i, side) => (side < 0 ? T.barL[i] : T.barR[i]);

  /** try to put one prop; returns the item or null */
  const put = (kind, i, side, extra, o = {}) => {
    const r = o.r ?? 0.4;
    if (barrierAt(i, side) === BARRIER.ROCK && !o.allowRock) return null;
    if (T.bridge[T.wrap(i)] && !o.bridge) return null;
    const lat = latOf(i, r, extra) * side;
    T.roadPoint(i, lat, 0, tmp);
    const x = tmp.x, z = tmp.z, ty = terr.sample(x, z);
    if (ty < (o.minY ?? 0.5) || ty > (o.maxY ?? 400)) return null;
    if (Math.abs(ty - tmp.y) > (o.maxDrop ?? 5)) return null;
    if (o.flat) { const a = terr.sample(x + o.flat, z), b = terr.sample(x - o.flat, z), c = terr.sample(x, z + o.flat), d = terr.sample(x, z - o.flat); if (Math.max(a, b, c, d, ty) - Math.min(a, b, c, d, ty) > (o.flatTol ?? 0.5)) return null; }
    if (blocked.hit(x, z, r, 0.2) || used.hit(x, z, r * 0.8)) return null;
    const yaw = o.yaw ?? Math.atan2(T.rx[i] * side, T.rz[i] * side);      // faces away from the road by default (local +z -> outward)
    const it = { kind, x, y: ty - (o.sink ?? 0), z, yaw: yaw + (o.yawJit ? (R() - 0.5) * o.yawJit : 0), s: o.s ?? 1, v: o.v ?? 0, tint: o.tint ?? null, side, i, zone: T.zone[i], sea: !!o.sea };
    items.push(it); used.add(x, z, r, null); blocked.add(x, z, r, null);
    reg(kind, x, z, r, ty - (o.sink ?? 0), o.sea ? { sea: true } : {});
    counts[kind] = (counts[kind] || 0) + 1;
    return it;
  };
  const free = (kind, x, z, ty, r, o = {}) => {     // free placement (rocks in the water, mirante): no road relation, still checked against the strip
    if (blocked.hit(x, z, r, 0.2) || used.hit(x, z, r * 0.8)) return null;
    const it = { kind, x, y: ty - (o.sink ?? 0), z, yaw: o.yaw ?? R() * 6.283, s: o.s ?? 1, v: o.v ?? 0, tint: o.tint ?? null, side: 0, i: -1, zone: o.zone ?? 0, sea: !!o.sea };
    items.push(it); used.add(x, z, r, null); blocked.add(x, z, r, null);
    reg(kind, x, z, r, ty - (o.sink ?? 0), o.sea ? { sea: true } : {});
    counts[kind] = (counts[kind] || 0) + 1;
    return it;
  };
  const seaSide = (i, side) => { T.roadPoint(i, side * (T.w[i] * 0.5 + SHOULDER + 10), 0, tmp); return terr.sample(tmp.x, tmp.z) < 3.7; };
  const palette = [[0.92, 0.35, 0.22], [0.95, 0.78, 0.25], [0.2, 0.55, 0.75], [0.96, 0.96, 0.92], [0.85, 0.2, 0.35], [0.25, 0.65, 0.5]];

  // ------------------------------------------------------------------ along the lap
  for (let s = 0; s < L; s += 1) {
    const i = T.indexAtS(s), zone = T.zone[i], onBridge = !!T.bridge[i];
    const kap = Math.abs(T.kappa[i]);
    if (onBridge) continue;
    // ---- every zone: slim delineator posts every 24 m on open sections (not on walls of the promenade / village)
    if (zone !== 0 && zone !== 2 && s % 24 === 0) for (const side of [-1, 1]) put('delineator', i, side, 0.3, { r: 0.12, s: 1 });
    // ---- Z1: the promenade
    if (zone === 0) {
      if (s % 30 === 0) { const side = seaSide(i, 1) ? -1 : 1; put('lamp', i, side, 0.4, { r: 0.35 }); }                    // lamps on the land side
      if (s % 11 === 3) { const side = seaSide(i, 1) ? -1 : 1; put('bollard', i, side, 0.2, { r: 0.2, tint: palette[(s / 11) % 2 | 0] }); }
      if (s % 11 === 7) { const side = seaSide(i, 1) ? 1 : -1; put('bollard', i, side, 0.2, { r: 0.2 }); }
      if (s % 47 === 12) { const side = seaSide(i, 1) ? -1 : 1; put('bench', i, side, 0.6, { r: 1.0, yawJit: 0.12 }); }
      if (s % 61 === 30) { const side = seaSide(i, 1) ? -1 : 1; put('bin', i, side, 0.5, { r: 0.35 }); }
      if (s % 101 === 40) { const side = seaSide(i, 1) ? -1 : 1; put('board', i, side, 1.4, { r: 3.0, v: (s / 101) % 2 | 0 }); }
      // beach side: sand fences, parasols, loungers, driftwood rocks
      const sea = seaSide(i, -1) ? -1 : (seaSide(i, 1) ? 1 : 0);
      if (sea) {
        if (s % 6 === 2 && R() < 0.62) put('sandfence', i, sea, 2.2 + R() * 1.5, { r: 1.2, minY: 1.0, v: (R() * 2) | 0 });
        if (s % 17 === 5 && R() < 0.8) { const it = put('parasol', i, sea, 6 + R() * 14, { r: 1.5, minY: 0.9, maxY: 2.6, tint: palette[(R() * palette.length) | 0], v: 0 }); if (it) put('lounger', i, sea, 6 + R() * 14, { r: 1.0, minY: 0.9, maxY: 2.6, yaw: it.yaw + 0.25 }); }
        if (s % 9 === 4 && R() < 0.55) put('rock', i, sea, 3 + R() * 40, { r: 0.7, minY: 0.45, maxY: 2.2, s: 0.5 + R() * 0.7, v: (R() * 4) | 0, sink: 0.12, allowRock: true });
      }
    }
    // ---- Z2: the cliff road
    if (zone === 1) {
      if (kap > 1 / 95 && s % 11 === 0) for (const side of [-1, 1]) put('chevron', i, side, 0.9, { r: 0.55, v: 0, flat: 0 });
      else if (s % 37 === 0) put('warn', i, (s / 37) % 2 ? 1 : -1, 1.0, { r: 0.45 });
      if (s % 7 === 0) for (const side of [-1, 1]) if (barrierAt(i, side) === BARRIER.ROCK) { if (R() < 0.7) put('rock', i, side, 1.5 + R() * 12, { r: 1.2, s: 0.8 + R() * 2.2, v: (R() * 4) | 0, sink: 0.35, allowRock: true, minY: 2, maxDrop: 12 }); }
      if (s % 8 === 3) for (const side of [-1, 1]) if (barrierAt(i, side) !== BARRIER.ROCK && R() < 0.28) put('fence', i, side, 2.4 + R() * 3, { r: 1.2, v: 0, maxDrop: 3, minY: 2 });
      if (kap > 1 / 70 && s % 15 === 7 && R() < 0.8) { const side = R() < 0.5 ? -1 : 1; put(R() < 0.5 ? 'tyres' : 'hay', i, side, 1.4, { r: 1.0 }); }
      if (s % 19 === 9) { const side = R() < 0.5 ? -1 : 1; put('rock', i, side, 3 + R() * 25, { r: 1.2, s: 1.0 + R() * 2.5, v: (R() * 4) | 0, sink: 0.4, allowRock: true, minY: 2, maxDrop: 14 }); }
    }
    // ---- Z3: the village street
    if (zone === 2) {
      if (s % 20 === 0) for (const side of [-1, 1]) put('lamp', i, side, 0.3, { r: 0.35, v: 1 });
      if (s % 8 === 2) for (const side of [-1, 1]) put('bollard', i, side, 0.15, { r: 0.2, v: 1 });
      if (s % 26 === 6) { const side = (s / 26) % 2 ? 1 : -1; put('bench', i, side, 1.0, { r: 1.0, yawJit: 0.1 }); }
      if (s % 38 === 15) { const side = (s / 38) % 2 ? -1 : 1; put('bin', i, side, 0.8, { r: 0.35 }); }
      if (s % 23 === 9) { const side = (s / 23) % 2 ? 1 : -1; put('planter', i, side, 0.9, { r: 0.6, tint: palette[(R() * palette.length) | 0] }); }
      if (s % 43 === 21) { const side = (s / 43) % 2 ? -1 : 1; put('cafe', i, side, 1.8, { r: 1.6, tint: palette[(R() * palette.length) | 0] }); }
      if (s % 61 === 40) put('warn', i, 1, 1.0, { r: 0.45, v: 1 });
      if (s % 13 === 5 && R() < 0.4) { const side = R() < 0.5 ? -1 : 1; put('rock', i, side, 4 + R() * 12, { r: 0.7, s: 0.4 + R() * 0.7, v: (R() * 4) | 0, sink: 0.15, allowRock: true }); }
    }
    // ---- Z4: pines and the descent
    if (zone === 3) {
      if (kap > 1 / 90 && s % 12 === 0) for (const side of [-1, 1]) put('chevron', i, side, 0.9, { r: 0.55 });
      if (s % 8 === 3 && R() < 0.5) { const side = R() < 0.5 ? -1 : 1; put('rock', i, side, 1.5 + R() * 18, { r: 1.2, s: 0.7 + R() * 2.4, v: (R() * 4) | 0, sink: 0.35, allowRock: true, minY: 2, maxDrop: 14 }); }
      if (s % 9 === 4) for (const side of [-1, 1]) if (R() < 0.3) put('fence', i, side, 2.0 + R() * 2, { r: 1.2, maxDrop: 3, minY: 2 });
      if (s % 53 === 10) put('cairn', i, R() < 0.5 ? -1 : 1, 3 + R() * 4, { r: 0.5 });
    }
  }

  // ---- bridge parapet lamps (on the deck: allowed inside the strip, positioned from the road surface)
  const br = world.json.bridge;
  if (br) {
    for (let s = br.s0 + 6; s < br.s1 - 4; s += 12) {
      const i = T.indexAtS(s);
      for (const side of [-1, 1]) {
        const lat = side * (T.w[i] * 0.5 + 0.62);
        T.roadPoint(i, lat, 0, tmp);
        const it = { kind: 'lamp-bridge', x: tmp.x, y: tmp.y, z: tmp.z, yaw: Math.atan2(T.rx[i] * side, T.rz[i] * side), s: 1, v: 2, tint: null, side, i, zone: T.zone[i], sea: false };
        items.push(it); used.add(tmp.x, tmp.z, 0.3, null);
        reg('lamp-bridge', tmp.x, tmp.z, 0.3, tmp.y, { onRoadBy: true, skipValidation: true });
        counts['lamp-bridge'] = (counts['lamp-bridge'] || 0) + 1;
      }
    }
    // bridge approaches: a pair of tall delineators/markers at each end, and tyre-free hay-free simple posts
  }

  // ---- rocks standing in the sea along the Orla (white water rings are drawn by the sea shader from these positions)
  {
    const z1 = world.json.zones.find((z) => z.id === 'Z1');
    let tries = 0, placed = 0;
    for (let s = z1.s0; s < z1.s1 && placed < 30 && tries < 4000; s += 11, tries++) {
      const i = T.indexAtS(s % L);
      for (const side of [-1, 1]) {
        if (!seaSide(i, side)) continue;
        for (let k = 0; k < 2 && placed < 30; k++) {
          const d = 18 + R() * 120, lat = side * (T.w[i] * 0.5 + SHOULDER + d);
          T.roadPoint(i, lat, 0, tmp);
          const ty = terr.sample(tmp.x, tmp.z);
          if (ty > -0.4 || ty < -2.3) continue;
          const sc = Math.max(0.9 + R() * 2.2, (-ty + 1.0 + 0.5) / 0.85);          // tall enough to stand out of the water
          if (free('rock', tmp.x, tmp.z, ty, 1.4 * sc, { s: sc, v: (R() * 4) | 0, sink: 0.5, sea: true, zone: 0 })) placed++;
        }
      }
    }
  }

  // ---- a second ring of rocks right at the waterline (8..26 m off the wet-sand line) so every beach view has rocks with white water in it
  {
    const z1 = world.json.zones.find((z) => z.id === 'Z1');
    let placed = 0;
    for (let s = z1.s0 + 30; s < z1.s1 - 30 && placed < 14; s += 53) {
      const i = T.indexAtS(s % L);
      for (const side of [-1, 1]) {
        if (!seaSide(i, side)) continue;
        let lat = T.w[i] * 0.5 + SHOULDER + 6, shore = null;
        for (let k = 0; k < 120; k++, lat += 1) { T.roadPoint(i, side * lat, 0, tmp); if (terr.sample(tmp.x, tmp.z) < 0.05) { shore = lat; break; } }
        if (shore === null) continue;
        for (let n = 0; n < 2 && placed < 14; n++) {
          const d = shore + 4 + R() * 14; T.roadPoint(i, side * d, 0, tmp); const ty = terr.sample(tmp.x, tmp.z);
          if (ty > -0.3 || ty < -1.6) continue;
          const sc = Math.max(0.8 + R() * 1.3, (-ty + 0.9 + 0.45) / 0.85);
          if (free('rock', tmp.x, tmp.z, ty, 1.4 * sc, { s: sc, v: (R() * 4) | 0, sink: 0.45, sea: true, zone: 0 })) placed++;
        }
      }
    }
  }

  // ---- the viewpoint (mirante): a terrace on a stone plinth, on the outside of the Z2 serpentine, as high as a reasonably even site allows
  {
    const z2 = world.json.zones.find((z) => z.id === 'Z2');
    let best = null;
    for (let s = z2.s0 + 40; s < z2.s1 - 40; s += 4) {
      const i = T.indexAtS(s);
      for (const side of [-1, 1]) {
        if (barrierAt(i, side) === BARRIER.ROCK) continue;
        for (const d of [6, 10, 14, 20, 28]) {
          T.roadPoint(i, side * (T.w[i] * 0.5 + SHOULDER + d + 6.5), 0, tmp);
          const x = tmp.x, z = tmp.z, y0 = terr.sample(x, z);
          if (y0 < 18) continue;
          let lo = 1e9, hi = -1e9;
          for (let a = -6.5; a <= 6.5; a += 3.25) for (let b = -6.5; b <= 6.5; b += 3.25) { const h = terr.sample(x + a, z + b); lo = Math.min(lo, h); hi = Math.max(hi, h); }
          if (hi - lo > 3.4 || blocked.hit(x, z, 8.5, 0.5)) continue;
          const score = y0 - 5 * (hi - lo);
          if (!best || score > best.score) best = { x, z, y: y0, lo, hi, i, side, s, score };
        }
      }
    }
    if (best) {
      const gx = terr.sample(best.x + 20, best.z) - terr.sample(best.x - 20, best.z), gz = terr.sample(best.x, best.z + 20) - terr.sample(best.x, best.z - 20);
      const yaw = Math.atan2(-gx, -gz);                                  // the terrace faces downhill, towards the sea
      const it = free('mirante', best.x, best.z, best.y, 8.5, { yaw, zone: 1 });
      if (it) { it.deck = { top: best.hi - best.y + 0.35, bottom: best.lo - best.y - 0.7 }; world.stats.mirante = { x: +best.x.toFixed(1), z: +best.z.toFixed(1), y: +best.y.toFixed(1), s: +best.s.toFixed(0), deckTop: +it.deck.top.toFixed(2) }; }
    }
  }

  world.stats.props = { total: items.length, counts };
  return items;
}
