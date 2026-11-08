// Generates track.json — the single source of truth of the world — deterministically.
// The lap is a chain of circular arcs joined by common tangents (exact closure, controlled radii).
// Elevation follows the natural hillside (landform.smoothGround) under a grade limit.
// Usage: node scripts/make-track.mjs [--map]   (writes track.json and verification/map-preview.png with --map)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLandform } from '../src/world/landform.js';
import { TrackData, SHOULDER } from '../src/world/track.js';
import { smoothstep, clamp, DEG } from '../src/core/util.js';
import { savePNG } from '../tools/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 20261107;
const lf = createLandform(SEED);

// ---------------------------------------------------------------- layout (map coords: X east, N north)
// dir: +1 = clockwise (right turn), -1 = counter-clockwise (left turn)
const CIRCLES = [
  { name: 'E',  c: [620, 72],   r: 72,  dir: +1 },   // end of the east descent -> into the beach straight
  { name: 'W1', c: [-280, 42],  r: 42,  dir: +1 },   // U-turn at the west end of the beach (start of the climb)
  { name: 'H2', c: [-20, 182],  r: 32,  dir: -1 },   // left hairpin
  { name: 'H3', c: [-262, 268], r: 38,  dir: +1 },   // right hairpin onto the plateau
  { name: 'V1', c: [-40, 476],  r: 170, dir: -1 },   // gentle left sweep of the village S-bend (plaza side)
  { name: 'V2', c: [66, 152.6], r: 170, dir: +1 },   // gentle right sweep back to the east
  { name: 'Z',  c: [604, 234.6], r: 88,  dir: +1 },  // right turn: plateau edge -> east descent
];

const W = { Z1: 12.0, Z2: 10.6, Z3: 11.0, Z4: 11.5 };
const START_X = 500;          // start/finish line on the beach straight (heading west)
const GRID_BACK = 70;         // metres of straight behind the line used by the grid

// ---------------------------------------------------------------- circle-chain path
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function tangent(A, B) {
  const D = sub(B.c, A.c), dist = Math.hypot(D[0], D[1]);
  const k = B.dir * B.r - A.dir * A.r;
  const beta = Math.atan2(D[1], D[0]);
  const alpha = beta + Math.asin(clamp(k / dist, -1, 1));
  const d = [Math.cos(alpha), Math.sin(alpha)];
  const nu = [Math.sin(alpha), -Math.cos(alpha)];             // right(d)
  const PA = [A.c[0] - A.dir * A.r * nu[0], A.c[1] - A.dir * A.r * nu[1]];
  const PB = [B.c[0] - B.dir * B.r * nu[0], B.c[1] - B.dir * B.r * nu[1]];
  const L = (PB[0] - PA[0]) * d[0] + (PB[1] - PA[1]) * d[1];
  return { alpha, d, PA, PB, L };
}
function buildPath() {
  const n = CIRCLES.length;
  const tans = [];
  for (let i = 0; i < n; i++) tans.push(tangent(CIRCLES[i], CIRCLES[(i + 1) % n]));
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const C = CIRCLES[i], tin = tans[(i - 1 + n) % n], tout = tans[i];
    const pin = tin.PB, pout = tout.PA;
    const a0 = Math.atan2(pin[1] - C.c[1], pin[0] - C.c[0]);
    const a1 = Math.atan2(pout[1] - C.c[1], pout[0] - C.c[0]);
    let sweep = C.dir > 0 ? a0 - a1 : a1 - a0;
    while (sweep < 0) sweep += 2 * Math.PI;
    while (sweep >= 2 * Math.PI) sweep -= 2 * Math.PI;
    pieces.push({ type: 'arc', name: C.name, C, a0, sweep, len: sweep * C.r });
    pieces.push({ type: 'line', from: tout.PA, to: tout.PB, len: tout.L, name: C.name + '>' + CIRCLES[(i + 1) % n].name });
  }
  return pieces;
}
function samplePath(pieces) {
  const pts = [];  // {X,N,piece,s}
  let s = 0;
  for (const p of pieces) {
    if (p.type === 'arc') {
      const steps = Math.max(2, Math.ceil(p.sweep / (6 * DEG)));
      for (let k = 0; k < steps; k++) {
        const a = p.C.dir > 0 ? p.a0 - (k / steps) * p.sweep : p.a0 + (k / steps) * p.sweep;
        pts.push({ X: p.C.c[0] + p.C.r * Math.cos(a), N: p.C.c[1] + p.C.r * Math.sin(a), piece: p.name, s: s + (k / steps) * p.len, arc: true });
      }
    } else {
      const steps = Math.max(1, Math.ceil(p.len / 24));
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        pts.push({ X: p.from[0] + (p.to[0] - p.from[0]) * f, N: p.from[1] + (p.to[1] - p.from[1]) * f, piece: p.name, s: s + f * p.len, arc: false });
      }
    }
    s += p.len;
  }
  return { pts, total: s };
}

const pieces = buildPath();
const bad = pieces.filter(p => p.type === 'line' && p.len < 5);
if (bad.length) console.warn('WARNING: very short tangent(s):', bad.map(b => b.name + '=' + b.len.toFixed(1)).join(', '));
let { pts: raw, total } = samplePath(pieces);

// start the list at the start line on the beach straight (X = START_X, N ~ 0), heading west
let k0 = 0, best = 1e9;
for (let i = 0; i < raw.length; i++) {
  const p = raw[i];
  if (p.piece === 'E>W1') { const d = Math.abs(p.X - START_X); if (d < best) { best = d; k0 = i; } }
}
// ensure an exact point at START_X: insert by interpolating along the straight
{
  const a = raw[k0], b = raw[(k0 + 1) % raw.length];
  if (a.piece === b.piece) {
    const f = (a.X - START_X) / (a.X - b.X);
    if (f > 0 && f < 1) {
      const ins = { X: START_X, N: a.N + (b.N - a.N) * f, piece: a.piece, s: a.s + (b.s - a.s) * f, arc: false };
      raw.splice(k0 + 1, 0, ins); k0 = k0 + 1;
    }
  }
}
raw = raw.slice(k0).concat(raw.slice(0, k0));
{ const s0 = raw[0].s; for (const p of raw) { p.s = (p.s - s0 + total) % total; } }

// ---------------------------------------------------------------- elevation (follow the hill, limit the grade)
const M = raw.length;
const ds = []; for (let i = 0; i < M; i++) { const a = raw[i], b = raw[(i + 1) % M]; ds.push(Math.hypot(b.X - a.X, b.N - a.N)); }
let y = raw.map(p => lf.smoothGround(p.X, -p.N));
const Gmax = 0.082;
function limitGrade(y, iters = 60) {
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < M; i++) { const j = (i + 1) % M; const m = Gmax * ds[i]; if (y[j] - y[i] > m) y[j] = y[i] + m; else if (y[i] - y[j] > m) y[j] = y[j] + (y[i] - y[j]) - 0; }
  }
  return y;
}
function smoothLoop(y, sigmaM, passes = 1) {
  // gaussian-ish smoothing in arc-length space
  const cum = [0]; for (let i = 0; i < M; i++) cum.push(cum[i] + ds[i]);
  const Ltot = cum[M];
  for (let pass = 0; pass < passes; pass++) {
    const out = new Array(M);
    for (let i = 0; i < M; i++) {
      let acc = 0, wsum = 0;
      for (let k = -M / 2 | 0; k <= (M / 2 | 0); k++) {
        const j = (i + k + M) % M;
        let d = Math.abs(cum[j] - cum[i]); d = Math.min(d, Ltot - d);
        if (d > sigmaM * 3) continue;
        const wgt = Math.exp(-(d * d) / (2 * sigmaM * sigmaM));
        acc += y[j] * wgt; wsum += wgt;
      }
      out[i] = acc / wsum;
    }
    y = out;
  }
  return y;
}
// symmetric grade limiter: when a pair of neighbours is too steep, move both towards each other
// (least-squares-like projection) so the road straddles the hillside instead of always sitting in a cut
function limitBoth(y, g = Gmax) {
  for (let it = 0; it < 400; it++) {
    let worst = 0;
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M, m = g * ds[i], d = y[j] - y[i];
      if (Math.abs(d) > m) { const ex = (Math.abs(d) - m) * 0.5 * Math.sign(d); y[i] += ex; y[j] -= ex; worst = Math.max(worst, Math.abs(d) - m); }
    }
    if (worst < 1e-4) break;
  }
  return y;
}
y = smoothLoop(y, 22, 2);
y = limitBoth(y, 0.072);
y = smoothLoop(y, 12, 2);

// ---------------------------------------------------------------- bridge over the ravine on the plateau edge (X ~ 520, N ~ 300)
function inRavine(p) { return Math.abs(p.X - lf.ravineX(p.N)) < 54 && p.N > 215 && p.N < 400; }
let bi0 = -1, bi1 = -1;
for (let i = 0; i < M; i++) if (inRavine(raw[i]) && raw[i].piece === 'V2>Z') { if (bi0 < 0) bi0 = i; bi1 = i; }
if (bi0 >= 0) {
  const a = (bi0 - 1 + M) % M, b = (bi1 + 1) % M;     // flat-grade deck between the two abutment points
  const ya = y[a], yb = y[b];
  let acc = 0, tot = 0; for (let i = a; i !== b; i = (i + 1) % M) tot += ds[i];
  for (let i = a, run = 0; i !== (b + 1) % M; run += ds[i], i = (i + 1) % M) y[i] = ya + (yb - ya) * (run / tot);
  console.log(`bridge: control points ${bi0}..${bi1}, span ~${tot.toFixed(0)} m, deck y ${ya.toFixed(1)} -> ${yb.toFixed(1)}`);
}

// ---------------------------------------------------------------- width & bank
function zoneOfPiece(p, idx) { return null; }
const widthAt = i => {
  const p = raw[i];
  const x = p.X, n = p.N;
  // zone widths blended by position along the lap (resolved later by s); here by geography
  return null;
};

// bank from signed curvature of the raw path (right turn +)
const kap = new Array(M).fill(0);
for (let i = 0; i < M; i++) {
  const p = raw[i];
  if (p.arc) {
    const c = CIRCLES.find(c => c.name === p.piece);
    kap[i] = c.dir / c.r;
  }
}
let bank = kap.map(k => clamp(k * 175, -6.5, 6.5));   // degrees; positive banks into right turns (right edge lower)
// smooth bank over ~30 m so it eases in/out
bank = smoothLoop(bank, 18, 1);

// ---------------------------------------------------------------- assemble control points
const widthByS = [];    // filled after we know the zone boundaries by geography
function zoneName(i) {
  const p = raw[i];
  const piece = p.piece;
  if (piece === 'E>W1' || piece === 'E') return 'Z1';
  if (['W1', 'W1>H2', 'H2', 'H2>H3', 'H3'].includes(piece)) return 'Z2';
  if (['H3>V1', 'V1', 'V1>V2', 'V2', 'V2>Z'].includes(piece)) {
    // village: from the top of the climb to the end of the plaza sweep; Z4 starts east of X=330
    return p.X < 330 ? 'Z3' : 'Z4';
  }
  return 'Z4';
}
const zones = raw.map((_, i) => zoneName(i));
// widths blended over ~60 m
let wArr = zones.map(z => W[z]);
wArr = smoothLoop(wArr, 22, 1);

const points = raw.map((p, i) => [
  +p.X.toFixed(3), +y[i].toFixed(3), +(-p.N).toFixed(3), +wArr[i].toFixed(3), +bank[i].toFixed(3),
]);

const json = {
  version: 1,
  name: 'Costa Dourada',
  seed: SEED,
  closed: true,
  note: 'Single source of truth for the world. points = [x, y, z, width(m), bank(deg, + = right edge lower)]. Everything else is derived.',
  points,
  zones: [], sections: [], checkpoints: [],
};

// ---------------------------------------------------------------- derive features in the dense frame
let T = new TrackData(json);
const N = T.N;
// zone ranges by control-point geography -> dense s: map each control point to the nearest dense sample
function sOfControl(i) { const p = points[i]; const q = T.nearest(p[0], p[2], 50); return q.s; }
const cs = points.map((_, i) => sOfControl(i));
function rangeOf(zn) {
  // contiguous run (possibly wrapping) of control points with this zone
  const idx = []; for (let i = 0; i < M; i++) if (zones[i] === zn) idx.push(i);
  // find the start of the run: first idx whose predecessor isn't in zone
  let st = idx.find(i => zones[(i - 1 + M) % M] !== zn);
  let en = idx.find(i => zones[(i + 1) % M] !== zn);
  let s0 = cs[st], s1 = cs[(en + 1) % M];
  if (s1 <= s0) s1 += T.length;
  return [s0, s1];
}
const zn = ['Z1', 'Z2', 'Z3', 'Z4'];
for (const z of zn) { const [s0, s1] = rangeOf(z); json.zones.push({ id: z, name: { Z1: 'Orla', Z2: 'Falesia', Z3: 'Vila', Z4: 'Bosque e descida' }[z], s0: +s0.toFixed(1), s1: +s1.toFixed(1) }); }

// bridge range in dense samples
{
  let first = -1, last = -1;
  for (let i = 0; i < N; i++) {
    const x = T.px[i], z = T.pz[i];
    if (Math.abs(x - lf.ravineX(-z)) < 54 && -z > 215 && -z < 400 && zoneOfDense(i) === 'Z4') { if (first < 0) first = i; last = i; }
  }
  function zoneOfDense(i) { return 'Z4'; }
  if (first >= 0) {
    json.bridge = { s0: +(T.s[first] - 6).toFixed(1), s1: +(T.s[last] + 6).toFixed(1) };
  }
}

// barrier sections: rule-based by zone; Z2/Z4 pick side by terrain drop
const sections = [];
const gnd = (x, z) => lf.smoothGround(x, z);
function sideInfo(i) {
  const half = T.w[i] * 0.5;
  const off = half + SHOULDER + 8;
  const L = T.roadPoint(i, -off), R = T.roadPoint(i, off);
  return { dropL: T.py[i] - gnd(L.x, L.z), dropR: T.py[i] - gnd(R.x, R.z) };
}
let cur = null;
function pushSec(s0, s1, left, right) { sections.push({ s0: +s0.toFixed(1), s1: +s1.toFixed(1), left, right }); }
const barrierFor = (zone, drop) => {
  if (zone === 'Z1') return { type: 'wall', off: 0 };
  if (zone === 'Z3') return { type: 'wall', off: 0 };
  // Z2 / Z4: lower side guardrail, higher side rock wall (or low wall when the ground is level)
  if (drop > 1.2) return { type: 'guardrail', off: 0 };
  if (drop < -1.2) return { type: 'rock', off: 0 };
  return { type: 'wall', off: 0 };
};
const zoneAtS = s => { const i = T.sToIndex(s); for (const z of json.zones) { let a = z.s0, b = z.s1; const ss = s < a ? s + T.length : s; if (ss >= a && ss < b) return z.id; } return 'Z4'; };
let segStart = 0, prevKey = null, prevL = null, prevR = null;
const bridgeAt = i => json.bridge && ((T.s[i] >= json.bridge.s0 && T.s[i] <= json.bridge.s1));
for (let i = 0; i < N; i++) {
  const zone = zoneAtS(T.s[i]);
  const half = T.w[i] * 0.5;
  const si = sideInfo(i);
  let L = barrierFor(zone, si.dropL), R = barrierFor(zone, si.dropR);
  if (bridgeAt(i)) { L = { type: 'parapet', off: half + 0.55 }; R = { type: 'parapet', off: half + 0.55 }; }
  else {
    const o = { guardrail: half + SHOULDER - 0.7, wall: half + SHOULDER - 0.35, rock: half + SHOULDER - 0.1 };
    L.off = +o[L.type].toFixed(2); R.off = +o[R.type].toFixed(2);
  }
  const key = L.type + '|' + R.type + '|' + (bridgeAt(i) ? 'b' : '');
  if (key !== prevKey) {
    if (prevKey !== null) pushSec(segStart, T.s[i], prevL, prevR);
    segStart = T.s[i]; prevKey = key; prevL = L; prevR = R;
  } else { prevL = L; prevR = R; }
}
if (prevKey !== null) pushSec(segStart, T.length, prevL, prevR);
// merge tiny sections (flicker) into neighbours
const merged = [];
for (const s of sections) {
  const last = merged[merged.length - 1];
  if (last && (s.s1 - s.s0) < 14) { last.s1 = s.s1; continue; }
  if (last && last.left.type === s.left.type && last.right.type === s.right.type) { last.s1 = s.s1; continue; }
  merged.push(s);
}
json.sections = merged;

// checkpoints every ~250 m (s = 0 is the start/finish line)
const nCp = Math.round(T.length / 250);
json.checkpoints = Array.from({ length: nCp }, (_, k) => +(k * T.length / nCp).toFixed(1));
json.start = { s: 0, gridBack: GRID_BACK, line: { x: START_X } };
json.landmarks = { startS: 0, lengthM: +T.length.toFixed(1) };

// final track (re-build to make sure features parse)
T = new TrackData(json);

// ---------------------------------------------------------------- report
let maxGrade = 0, minR = 1e9, maxBank = 0, gmin = 1e9, gmax = -1e9;
for (let i = 0; i < T.N; i++) {
  maxGrade = Math.max(maxGrade, Math.abs(T.grade[i]));
  if (Math.abs(T.kappa[i]) > 1e-6) minR = Math.min(minR, 1 / Math.abs(T.kappa[i]));
  maxBank = Math.max(maxBank, Math.abs(T.bank[i]));
  gmin = Math.min(gmin, T.py[i]); gmax = Math.max(gmax, T.py[i]);
}
console.log(`length ${T.length.toFixed(1)} m, N=${T.N}`);
console.log(`max grade ${(maxGrade * 100).toFixed(1)} %, min radius ${minR.toFixed(1)} m, max bank ${(maxBank / DEG).toFixed(1)} deg, y ${gmin.toFixed(1)}..${gmax.toFixed(1)}`);
for (const z of json.zones) console.log(`  ${z.id} ${z.name.padEnd(18)} s ${z.s0}..${z.s1}  (${(z.s1 - z.s0).toFixed(0)} m)`);
console.log('bridge', JSON.stringify(json.bridge), 'sections', json.sections.length);
for (const s of json.sections) console.log(`   ${s.s0}-${s.s1}: L=${s.left.type} R=${s.right.type}`);
let z2min = 1e9, z2max = -1e9; for (let i = 0; i < T.N; i++) if (T.zone[i] === 1) { z2min = Math.min(z2min, T.py[i]); z2max = Math.max(z2max, T.py[i]); }
console.log(`Z2 elevation gain ${(z2max - z2min).toFixed(1)} m (${z2min.toFixed(1)} -> ${z2max.toFixed(1)})`);

fs.writeFileSync(path.join(ROOT, 'track.json'), JSON.stringify(json));
console.log('wrote track.json', (fs.statSync(path.join(ROOT, 'track.json')).size / 1024).toFixed(1), 'KB');

// ---------------------------------------------------------------- map preview
if (process.argv.includes('--map')) {
  const x0 = -620, x1 = 980, n0 = -150, n1 = 640, mpp = 1.15;
  const Wp = Math.round((x1 - x0) / mpp), Hp = Math.round((n1 - n0) / mpp);
  const img = new Uint8Array(Wp * Hp * 4);
  const hgt = new Float32Array(Wp * Hp);
  for (let py = 0; py < Hp; py++) for (let px = 0; px < Wp; px++) {
    const X = x0 + px * mpp, Nn = n1 - py * mpp;
    hgt[py * Wp + px] = lf.G(X, -Nn);
  }
  for (let py = 0; py < Hp; py++) for (let px = 0; px < Wp; px++) {
    const h = hgt[py * Wp + px];
    const hx = hgt[py * Wp + Math.min(Wp - 1, px + 1)] - hgt[py * Wp + Math.max(0, px - 1)];
    const hy = hgt[Math.min(Hp - 1, py + 1) * Wp + px] - hgt[Math.max(0, py - 1) * Wp + px];
    const shade = clamp(0.72 + (-hx * 0.5 + hy * 0.5) * 0.12, 0.35, 1.2);
    let r, g, b;
    if (h < 0) { const t = clamp(-h / 25, 0, 1); r = 40 - 20 * t; g = 130 - 50 * t; b = 190 - 40 * t; if (h > -1.2) { r = 230; g = 235; b = 245; } }
    else { const t = clamp(h / 70, 0, 1); r = 190 * (1 - t) + 110 * t; g = 180 * (1 - t) + 130 * t; b = 110 * (1 - t) + 90 * t; if (h < 3.5) { r = 224; g = 205; b = 150; } }
    const contour = Math.abs(((h + 2.5) % 5) - 2.5) < 0.12 && h > 0;
    const k = (py * Wp + px) * 4;
    img[k] = clamp(r * shade * (contour ? 0.7 : 1), 0, 255); img[k + 1] = clamp(g * shade * (contour ? 0.7 : 1), 0, 255); img[k + 2] = clamp(b * shade * (contour ? 0.7 : 1), 0, 255); img[k + 3] = 255;
  }
  const dot = (X, Nn, rad, col) => {
    const cx = Math.round((X - x0) / mpp), cy = Math.round((n1 - Nn) / mpp);
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue; const px = cx + dx, py = cy + dy;
      if (px < 0 || py < 0 || px >= Wp || py >= Hp) continue; const k = (py * Wp + px) * 4; img[k] = col[0]; img[k + 1] = col[1]; img[k + 2] = col[2];
    }
  };
  const zc = { 0: [255, 220, 40], 1: [255, 60, 60], 2: [255, 80, 220], 3: [30, 230, 230] };
  for (let i = 0; i < T.N; i++) {
    const inBr = json.bridge && T.s[i] >= json.bridge.s0 && T.s[i] <= json.bridge.s1;
    dot(T.px[i], -T.pz[i], inBr ? 3 : 2, inBr ? [255, 140, 0] : zc[T.zone[i]]);
  }
  dot(START_X, 0, 5, [255, 255, 255]);
  fs.mkdirSync(path.join(ROOT, 'verification'), { recursive: true });
  savePNG(path.join(ROOT, 'verification', 'map-preview.png'), Wp, Hp, img);
  console.log('map', Wp, 'x', Hp);
}
