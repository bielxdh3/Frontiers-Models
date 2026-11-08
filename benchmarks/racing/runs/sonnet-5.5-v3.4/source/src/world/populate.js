// Deterministic object placement derived from the spline + terrain (never from loose coordinates):
// every instance is positioned by distance along the track and lateral offset beyond the exclusion strip,
// then dropped onto the terrain height. Same seed -> same world.
import { SHOULDER } from './track.js';
import { rng, clamp, smoothstep } from '../core/util.js';
import { makeNoise } from '../core/noise.js';

export class SpatialHash {
  constructor(cell = 4) { this.cell = cell; this.m = new Map(); }
  _k(ix, iz) { return ix * 73856 + iz * 19349; }
  add(x, z, r, data) { const k = this._k(Math.floor(x / this.cell), Math.floor(z / this.cell)); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push({ x, z, r, data }); }
  /** true if a disc (x,z,r) overlaps anything stored (overlap = distance < r + stored.r) */
  hit(x, z, r, pad = 0) {
    const c = this.cell, R = Math.ceil((r + 14) / c), ix = Math.floor(x / c), iz = Math.floor(z / c);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
      const arr = this.m.get(this._k(ix + a, iz + b)); if (!arr) continue;
      for (const o of arr) { const dx = o.x - x, dz = o.z - z, rr = o.r + r + pad; if (dx * dx + dz * dz < rr * rr) return true; }
    }
    return false;
  }
}

/** terrain-aware helpers */
function surfaceAt(world, x, z) {
  const y = world.terrain.sample(x, z);
  const n = world.terrain.normal(x, z);
  return { y, ny: n.y };
}

/**
 * Vegetation. Returns [{sp,x,y,z,s,rot,tint,v,flower}] and registers trees/shrubs in world.objects.
 * `blocked` = SpatialHash with house footprints/props to keep clear.
 */
export function placeVegetation(world, blocked, seed = 7) {
  const T = world.track, R = rng(seed * 101 + 3), nz = makeNoise(seed + 11);
  const items = [], used = new SpatialHash(3.5);
  const tp = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
  const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4'];
  const tryPlace = (sp, x, z, rad, o = {}) => {
    const q = T.nearest(x, z, 140, -1, tp);
    const half = T.w[q.i] * 0.5;
    const edge = Math.abs(q.lat) - half - SHOULDER;          // distance beyond the exclusion strip
    if (edge < rad * (o.canopyOverhang ?? 0.55) + 0.4) return false;
    const sf = surfaceAt(world, x, z);
    if (sf.ny < (o.minNy ?? 0.82)) return false;
    if (sf.y < (o.minY ?? 3.0)) return false;
    if (world.terrain.inBridgeSpan(q.s) || T.bridge[q.i]) return false;
    if (blocked.hit(x, z, rad * 0.5, 0.8) || used.hit(x, z, rad * (o.spacing ?? 0.7))) return false;
    const s = (o.scale ?? 1) * (0.8 + R() * 0.5);
    const rot = R() * Math.PI * 2;
    const tint = o.tint ? o.tint(R) : [0.9 + R() * 0.2, 0.9 + R() * 0.2, 0.9 + R() * 0.2];
    items.push({ sp, x, y: sf.y - 0.05, z, s, rot, tint, v: (R() * 4) | 0, flower: !!o.flower, sx: 0.9 + R() * 0.25, zone: T.zone[q.i], edge });
    used.add(x, z, rad * s, null);
    (sp === 'shrub' || sp === 'grass' ? world.objects.props : world.objects.trees).push({ kind: sp === 'shrub' || sp === 'grass' ? 'plant' : 'tree', species: sp, x, z, r: sp === 'palm' ? 0.4 : 0.55, baseY: sf.y - 0.05 });
    return true;
  };
  const posAt = (i, side, d) => { const p = T.roadPoint(i, side * (T.w[i] * 0.5 + SHOULDER + d), 0); return [p.x, p.z]; };
  const green = r => [0.82 + r() * 0.3, 0.9 + r() * 0.25, 0.78 + r() * 0.3];
  const silver = r => [0.88 + r() * 0.25, 0.95 + r() * 0.2, 0.85 + r() * 0.2];

  // ---------------------------------------------------------------- along the track
  const step = 2.2;
  for (let s = 0; s < T.length; s += step) {
    const i = T.indexAtS(s), zone = T.zone[i];
    for (const side of [-1, 1]) {
      const jitter = () => (R() - 0.5) * step;
      const ii = T.wrap(i + Math.round(jitter()));
      const P = (d) => posAt(ii, side, d);
      // is this side a beach / cliff drop? test the ground 12 m out
      const [px, pz] = P(10); const gy = world.terrain.sample(px, pz);
      const seaside = gy < 3.7;
      if (zone === 0) {
        if (seaside) {
          if (R() < 0.55) tryPlace('grass', ...P(1.2 + R() * 7), 0.8, { minY: 2.2, minNy: 0.7, scale: 1.2, spacing: 0.9 });
          if (R() < 0.12) tryPlace('shrub', ...P(2 + R() * 8), 1.0, { minY: 2.6, flower: R() < 0.5, spacing: 1.2 });
        } else {
          if (R() < 0.17) tryPlace('palm', ...P(1.5 + R() * 6), 2.2, { scale: 1.0, tint: green, spacing: 1.6, canopyOverhang: 0.15 });
          if (R() < 0.62) tryPlace('shrub', ...P(1.5 + R() * 18), 1.1, { flower: R() < 0.4, tint: green });
          if (R() < 0.55) tryPlace('grass', ...P(1 + R() * 12), 0.8, { spacing: 0.9 });
          if (R() < 0.11) tryPlace('pine', ...P(12 + R() * 70), 3.0, { tint: green, scale: 1.0 });
          if (R() < 0.09) tryPlace('olive', ...P(6 + R() * 40), 2.4, { tint: silver });
        }
      } else if (zone === 1) {
        if (R() < 0.20) tryPlace('pine', ...P(3 + R() * 40), 3.0, { tint: green, minNy: 0.72 });
        if (R() < 0.14) tryPlace('olive', ...P(3 + R() * 36), 2.4, { tint: silver, minNy: 0.72 });
        if (R() < 0.55) tryPlace('shrub', ...P(1.2 + R() * 26), 1.1, { flower: R() < 0.3, tint: green, minNy: 0.68 });
        if (R() < 0.5) tryPlace('grass', ...P(0.8 + R() * 14), 0.8, { minNy: 0.65, spacing: 0.9 });
      } else if (zone === 2) {
        if (R() < 0.06) tryPlace('olive', ...P(2.5 + R() * 18), 2.4, { tint: silver });
        if (R() < 0.025) tryPlace('palm', ...P(2.5 + R() * 12), 2.2, { tint: green, spacing: 1.6, canopyOverhang: 0.15 });
        if (R() < 0.16) tryPlace('shrub', ...P(1.2 + R() * 9), 1.0, { flower: R() < 0.6, tint: green });
        if (R() < 0.20) tryPlace('grass', ...P(0.8 + R() * 8), 0.8, { spacing: 0.9 });
        if (R() < 0.07) tryPlace('pine', ...P(24 + R() * 60), 3.0, { tint: green });
      } else {
        if (R() < 0.50) tryPlace('pine', ...P(2.5 + R() * 52), 3.0, { tint: green, minNy: 0.74 });
        if (R() < 0.20) tryPlace('olive', ...P(2.5 + R() * 40), 2.4, { tint: silver, minNy: 0.74 });
        if (R() < 0.75) tryPlace('shrub', ...P(1.2 + R() * 30), 1.1, { flower: R() < 0.25, tint: green, minNy: 0.7 });
        if (R() < 0.6) tryPlace('grass', ...P(0.8 + R() * 16), 0.8, { minNy: 0.65, spacing: 0.9 });
      }
    }
  }
  const alongCount = items.length;

  // ---------------------------------------------------------------- far hills & plateau (cheap, seen at distance)
  const x0 = -700, x1 = 1500, z0 = -1100, z1 = 120;
  for (let x = x0; x < x1; x += 24) for (let z = z0; z < z1; z += 24) {
    const px = x + (R() - 0.5) * 24, pz = z + (R() - 0.5) * 24;
    const q = T.nearest(px, pz, 600, -1, tp);
    if (q.d < 38) continue;
    const forest = nz.fbm(px / 160, pz / 160, 3), dens = smoothstep(-0.05, 0.35, forest) * (0.2 + 0.8 * smoothstep(40, 220, q.d));
    if (R() > dens * 0.85) continue;
    const zone = T.zone[q.i];
    const sp = R() < (zone === 2 ? 0.3 : 0.62) ? 'pine' : R() < 0.75 ? 'olive' : 'shrub';
    tryPlace(sp, px, pz, sp === 'pine' ? 3.0 : sp === 'olive' ? 2.4 : 1.1, { tint: sp === 'olive' ? silver : green, minNy: 0.74, minY: 4.0, spacing: 0.9 });
  }
  world.stats.vegetation = { alongTrack: alongCount, total: items.length };
  return items;
}
