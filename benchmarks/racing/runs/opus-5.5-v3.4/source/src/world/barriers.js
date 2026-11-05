// Barriers (guardrails, walls, retaining walls, parapets) positioned by
// distance along the spline. Produces both the collider segments and the
// run descriptions used to build the visual meshes.
import { SegmentGrid } from './collision.js';
import { shoulderWidth, curbHeight } from './profile.js';

export function dropSide(track, terrain, s) {
  // which side falls away (natural terrain), +1 right, -1 left, 0 none
  const fr = track.frame(s, {});
  const hw = fr.w / 2;
  const hL = terrain.h0(fr.x - fr.rx * (hw + 16), fr.z - fr.rz * (hw + 16));
  const hR = terrain.h0(fr.x + fr.rx * (hw + 16), fr.z + fr.rz * (hw + 16));
  if (hL < hR - 2.0 && hL < fr.y - 1) return -1;
  if (hR < hL - 2.0 && hR < fr.y - 1) return 1;
  return 0;
}

/**
 * Build barrier runs. Each run: {type, side, s0, s1, offset(s), height}
 * offset is measured from the centreline (horizontal, + right).
 */
export function buildBarriers(track, terrain) {
  const T = track, L = T.length;
  const step = 2.0;
  const n = Math.ceil(L / step);
  // classify each 2 m sample per side
  const kinds = { L: new Array(n), R: new Array(n) };
  const mir = T.features.mirante, plaza = T.features.plaza, bridge = T.features.bridge;
  const smoothDrop = new Array(n).fill(0);
  for (let i = 0; i < n; i++) smoothDrop[i] = dropSide(T, terrain, i * step);
  // majority filter over ±20 m to avoid flicker
  const drop = smoothDrop.map((_, i) => {
    let a = 0; for (let k = -10; k <= 10; k++) a += smoothDrop[(i + k + n) % n];
    return a > 3 ? 1 : a < -3 ? -1 : 0;
  });
  for (let i = 0; i < n; i++) {
    const s = i * step;
    const z = T.zoneAt(s);
    const onBridge = T.inRange(s, bridge.s0 - 3, bridge.s1 + 3);
    for (const side of [-1, 1]) {
      let k;
      if (onBridge) k = 'parapet';
      else if (z === 1) k = side === -1 ? 'promenade' : 'lowwall';
      else if (z === 2) k = drop[i] === side ? 'guardrail' : 'retaining';
      else if (z === 3) k = (plaza.side === side && T.inRange(s, plaza.s0, plaza.s1)) ? 'plazaedge' : 'streetwall';
      else k = 'guardrail';
      if (z === 2 && mir && side === mir.side && T.inRange(s, mir.s - mir.length / 2, mir.s + mir.length / 2)) k = 'mirante';
      kinds[side < 0 ? 'L' : 'R'][i] = k;
    }
  }
  // build runs (contiguous same kind)
  const runs = [];
  for (const sideKey of ['L', 'R']) {
    const side = sideKey === 'L' ? -1 : 1;
    const arr = kinds[sideKey];
    // rotate start so that a run does not straddle s=0 unnecessarily
    let start = 0; while (start < n && arr[start] === arr[(start - 1 + n) % n]) start++;
    if (start >= n) start = 0;
    let cur = arr[start], s0 = start;
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (k === n || arr[i] !== cur) {
        runs.push({ type: cur, side, i0: s0, i1: start + k, step });
        cur = arr[i]; s0 = start + k;
      }
    }
  }
  const grid = new SegmentGrid(8);
  const H = { guardrail: [0.82, 0.0], retaining: [1.1, 0], promenade: [0.95, 0], lowwall: [0.8, 0], parapet: [1.05, 0], streetwall: [2.2, 0], plazaedge: [0.9, 0], mirante: [1.05, 0] };
  for (const r of runs) {
    r.pts = [];
    for (let i = r.i0; i <= r.i1; i++) {
      const s = T.wrap(i * step);
      const off = barrierOffset(T, r.type, s);
      const fr = T.frame(s, {});
      const x = fr.x + fr.rx * off * r.side, zz = fr.z + fr.rz * off * r.side;
      const y = T.heightAt(s, off * r.side) + (r.type === 'parapet' || r.type === 'streetwall' || r.type === 'plazaedge' ? curbHeight(T, s) : 0);
      r.pts.push({ x, y, z: zz, s, off });
    }
    const [h] = H[r.type];
    r.height = h;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1];
      grid.add(a.x, a.z, b.x, b.z, Math.min(a.y, b.y) - 1.0, Math.max(a.y, b.y) + Math.max(1.2, h), r.type, r);
    }
  }
  return { runs, grid };
}

/** lateral offset (from centreline) of each barrier type */
export function barrierOffset(T, type, s) {
  const fr = T.frame(s, {});
  const hw = fr.w / 2;
  const sh = shoulderWidth(T, s);
  switch (type) {
    case 'guardrail': return hw + Math.min(1.1, sh - 0.3);
    case 'parapet': return hw + sh - 0.15;
    case 'retaining': return hw + sh + 0.35;
    case 'promenade': return hw + sh + 0.45;
    case 'lowwall': return hw + sh + 0.45;
    case 'streetwall': return hw + 3.25;
    case 'plazaedge': return hw + 3.25;
    case 'mirante': return hw + Math.min(1.1, sh - 0.3);
    default: return hw + sh;
  }
}

export function buildCheckpoints(track, spacing = 100) {
  const cps = [];
  const n = Math.floor(track.length / spacing);
  for (let k = 0; k < n; k++) {
    const s = track.wrap(track.features.startS + k * (track.length / n));
    const fr = track.frame(s, {});
    cps.push({ k, s, x: fr.x, y: fr.y, z: fr.z, hw: fr.w / 2 });
  }
  cps.sort((a, b) => a.s - b.s);
  // keep sequence relative to start (start at s=0 in our track)
  cps.forEach((c, i) => (c.k = i));
  return cps;
}
