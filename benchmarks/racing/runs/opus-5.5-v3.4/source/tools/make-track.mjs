// Authoring tool: builds track.json (the single source of truth of the world)
// from a turtle description (straights + constant-radius arcs), solves loop
// closure, smooths elevation and writes dense control points
// [x, y, z, width, bankDeg] for a closed centripetal Catmull-Rom spline.
// Run: node tools/make-track.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'track.json');

// heading theta: direction (cos t, sin t) in the XZ plane; +X east, +Z south.
// turn > 0 = right turn (clockwise seen from above).
const START = { x: 150, z: 60, theta: Math.PI }; // start line, heading west

// Elevation keys are given at the END of each segment (metres above sea).
// zone: 1 Orla, 2 Falesia, 3 Vila, 4 Bosque
function segments(Lz, Least) {
  return [
    // --- Z1 Orla (start line -> west) ---
    { t: 'S', len: 390, h: 4.2, zone: 1, w: 12, tag: 'orla-oeste' },
    { t: 'A', R: 260, turn: -6, h: 4.6, zone: 1, w: 12 },
    // --- Z2 Falesia (serpentine up the headland) ---
    { t: 'S', len: 180, h: 15.5, zone: 2, w: 11.5, tag: 'leg1' },
    { t: 'A', R: 34, turn: 180, h: 19.5, zone: 2, w: 11.5, tag: 'hairpin1' },
    { t: 'S', len: 185, h: 32.0, zone: 2, w: 11.5, tag: 'leg2' },
    { t: 'A', R: 34, turn: -180, h: 36.0, zone: 2, w: 11.5, tag: 'hairpin2' },
    { t: 'S', len: 185, h: 47.5, zone: 2, w: 11.5, tag: 'leg3' },
    { t: 'A', R: 37, turn: 180, h: 50.5, zone: 2, w: 11.5, tag: 'hairpin3' },
    { t: 'S', len: 120, h: 53.0, zone: 2, w: 11.5, tag: 'leg4-mirante' },
    // --- Z3 Vila ---
    { t: 'A', R: 140, turn: -14, h: 53.5, zone: 3, w: 11, tag: 'vila-entrada' },
    { t: 'S', len: 120, h: 54.5, zone: 3, w: 11, tag: 'vila-rua1' },
    { t: 'A', R: 95, turn: 26, h: 55.0, zone: 3, w: 11, tag: 'vila-praca' },
    { t: 'S', len: 90, h: 54.5, zone: 3, w: 11, tag: 'vila-rua2' },
    { t: 'A', R: 110, turn: -24, h: 54.0, zone: 3, w: 11, tag: 'vila-esse1' },
    { t: 'S', len: 70, h: 53.5, zone: 3, w: 11, tag: 'vila-esse2' },
    { t: 'A', R: 120, turn: 12, h: 53.0, zone: 3, w: 11, tag: 'vila-rua3' },
    { t: 'S', len: 80, h: 52.0, zone: 3, w: 11, tag: 'vila-saida' },
    // --- Z4 Bosque e descida ---
    { t: 'A', R: 90, turn: 40, h: 50.0, zone: 4, w: 11.5, tag: 'bosque-entrada' },
    { t: 'S', len: 90, h: 45.5, zone: 4, w: 11.5, tag: 'bosque-reta' },
    { t: 'A', R: 100, turn: -50, h: 41.0, zone: 4, w: 11.5, tag: 'bosque-esse1' },
    { t: 'S', len: 60, h: 38.5, zone: 4, w: 11.5, tag: 'bosque-esse2' },
    { t: 'A', R: 90, turn: 50, h: 35.0, zone: 4, w: 11.5, tag: 'bosque-esse3' },
    { t: 'S', len: 40, h: 33.5, zone: 4, w: 11.5, tag: 'bosque-esse4' },
    { t: 'A', R: 120, turn: -40, h: 31.0, zone: 4, w: 11.5, tag: 'bosque-curva-ponte' },
    { t: 'S', len: 120, h: 27.0, zone: 4, w: 11.5, tag: 'ponte' },
    { t: 'A', R: 65, turn: 130, h: 15.0, zone: 4, w: 11.5, tag: 'bosque-curva' },
    { t: 'S', len: Lz, h: 10.0, zone: 4, w: 11.5, tag: 'descida' },
    { t: 'A', R: 90, turn: 56, h: 4.6, zone: 4, w: 12, tag: 'retorno-orla' },
    // --- back in Z1 (east part of the main straight, grid) ---
    { t: 'S', len: Least, h: 4.0, zone: 1, w: 12, tag: 'orla-leste-grid' },
  ];
}

function walk(segs, step = 0.25) {
  let { x, z, theta } = START;
  const pts = [];
  let s = 0;
  const segInfo = [];
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i];
    const s0 = s;
    if (g.t === 'S') {
      const n = Math.max(1, Math.ceil(g.len / step));
      const d = g.len / n;
      for (let k = 0; k < n; k++) {
        pts.push({ x, z, theta, s, seg: i, k: 0 });
        x += Math.cos(theta) * d; z += Math.sin(theta) * d; s += d;
      }
    } else {
      const ang = (g.turn * Math.PI) / 180;
      const len = Math.abs(ang) * g.R;
      const n = Math.max(1, Math.ceil(len / step));
      const d = len / n;
      const kappa = Math.sign(ang) / g.R;
      for (let k = 0; k < n; k++) {
        pts.push({ x, z, theta, s, seg: i, k: kappa });
        // exact arc integration for one sub-step
        const th2 = theta + kappa * d;
        if (Math.abs(kappa) > 1e-9) {
          x += (Math.sin(th2) - Math.sin(theta)) / kappa;
          z += (-Math.cos(th2) + Math.cos(theta)) / kappa;
        } else { x += Math.cos(theta) * d; z += Math.sin(theta) * d; }
        theta = th2; s += d;
      }
    }
    segInfo.push({ i, s0, s1: s, ...g });
  }
  return { x, z, theta, pts, length: s, segInfo };
}

// Solve closure for the two free straight lengths with Newton iterations.
function solve() {
  let p = [40, 540];
  for (let it = 0; it < 50; it++) {
    const f = (q) => { const r = walk(segments(q[0], q[1]), 0.5); return [r.x - START.x, r.z - START.z]; };
    const f0 = f(p);
    if (Math.hypot(f0[0], f0[1]) < 1e-4) break;
    const h = 0.01;
    const fa = f([p[0] + h, p[1]]);
    const fb = f([p[0], p[1] + h]);
    const J = [[(fa[0] - f0[0]) / h, (fb[0] - f0[0]) / h], [(fa[1] - f0[1]) / h, (fb[1] - f0[1]) / h]];
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    const dx = (J[1][1] * -f0[0] - J[0][1] * -f0[1]) / det;
    const dz = (-J[1][0] * -f0[0] + J[0][0] * -f0[1]) / det;
    p = [p[0] + dx, p[1] + dz];
  }
  return p;
}

const [Lz, Least] = solve();
const segs = segments(Lz, Least);
const W = walk(segs, 0.25);
const total = W.length;
const headingErr = ((W.theta - START.theta) / (2 * Math.PI));
console.log('free lengths', Lz.toFixed(2), Least.toFixed(2), 'total', total.toFixed(1), 'closure', (W.x - START.x).toFixed(4), (W.z - START.z).toFixed(4), 'turns', headingErr.toFixed(4));
if (Lz < 15 || Least < 120) throw new Error('closure produced too short free segments');

// ---- elevation profile: piecewise linear between segment-end keys, then gaussian smoothing (wrapping) ----
const N = Math.round(total / 0.25);
const ds = total / N;
const keyS = [0], keyH = [segs[segs.length - 1].h];
for (const si of W.segInfo) { keyS.push(si.s1); keyH.push(si.h); }
function linH(s) {
  s = ((s % total) + total) % total;
  for (let i = 1; i < keyS.length; i++) if (s <= keyS[i]) { const u = (s - keyS[i - 1]) / (keyS[i] - keyS[i - 1]); return keyH[i - 1] + (keyH[i] - keyH[i - 1]) * u; }
  return keyH[keyH.length - 1];
}
function gaussSmooth(fn, sigma) {
  const out = new Float64Array(N);
  const r = Math.ceil(3 * sigma / ds);
  const wts = []; let wsum = 0;
  for (let k = -r; k <= r; k++) { const w = Math.exp(-0.5 * (k * ds / sigma) ** 2); wts.push(w); wsum += w; }
  const raw = new Float64Array(N);
  for (let i = 0; i < N; i++) raw[i] = fn(i * ds);
  for (let i = 0; i < N; i++) { let a = 0; for (let k = -r; k <= r; k++) a += raw[(i + k + N) % N] * wts[k + r]; out[i] = a / wsum; }
  return out;
}
const H = gaussSmooth(linH, 22);
// curvature (signed, 1/m) smoothed, for bank
const kRaw = (s) => { const i = Math.min(W.pts.length - 1, Math.floor(s / 0.25)); return W.pts[i].k; };
const Ksm = gaussSmooth(kRaw, 12);
const widthRaw = (s) => { const i = Math.min(W.pts.length - 1, Math.floor(s / 0.25)); return segs[W.pts[i].seg].w; };
const Wsm = gaussSmooth(widthRaw, 15);
const zoneAt = (s) => { const i = Math.min(W.pts.length - 1, Math.floor(s / 0.25)); return segs[W.pts[i].seg].zone; };

// grade check on the smoothed profile
let maxGrade = 0;
for (let i = 0; i < N; i++) { const g = Math.abs(H[(i + 1) % N] - H[i]) / ds; if (g > maxGrade) maxGrade = g; }
console.log('max grade (authoring)', (maxGrade * 100).toFixed(2) + '%');

// ---- control points every ~10 m ----
const CP_SPACING = 10;
const nCP = Math.round(total / CP_SPACING);
const cps = [];
for (let c = 0; c < nCP; c++) {
  const s = (c / nCP) * total;
  const i = Math.min(W.pts.length - 1, Math.round(s / 0.25));
  const p = W.pts[i];
  const j = Math.min(N - 1, Math.round(s / ds));
  const bankDeg = Math.max(-6, Math.min(6, Ksm[j] * 190));
  cps.push([+p.x.toFixed(3), +H[j].toFixed(3), +p.z.toFixed(3), +Wsm[j].toFixed(3), +bankDeg.toFixed(3)]);
}

// features referenced by control-point parameter u (0..nCP), derived from segment tags
const uOf = (s) => +((s / total) * nCP).toFixed(4);
const segBy = (tag) => W.segInfo.find((g) => g.tag === tag);
const zones = [];
let curZ = zoneAt(0), zStart = 0;
for (let s = 0; s < total; s += 1) { const z = zoneAt(s); if (z !== curZ) { zones.push({ zone: curZ, u0: uOf(zStart), u1: uOf(s) }); curZ = z; zStart = s; } }
zones.push({ zone: curZ, u0: uOf(zStart), u1: nCP });
// merge the wrap-around Z1 pieces is left to the runtime (zones list is ordered by u)

const ponte = segBy('ponte');
const mir = segBy('leg4-mirante');
const praca = segBy('vila-praca');
const vila = segBy('vila-entrada');
const vilaEnd = segBy('vila-saida');
const grid = segBy('orla-leste-grid');

const track = {
  name: 'Circuito da Costa Dourada',
  version: 1,
  units: 'metres',
  seed: 20261101,
  closed: true,
  spline: 'centripetal-catmull-rom',
  seaLevel: 0,
  sun: { azimuthDeg: 252, elevationDeg: 7.5 },
  controlPointFormat: ['x', 'y', 'z', 'width', 'bankDeg'],
  controlPoints: cps,
  zones,
  features: {
    startLineU: 0,
    gridSlots: 6,
    gridSpacing: 8.5,
    bridge: { u0: uOf(ponte.s0 + 18), u1: uOf(ponte.s1 - 14), deckThickness: 1.4 },
    mirante: { u: uOf(mir.s0 + 62), side: 1, length: 46, depth: 9 },
    plaza: { u0: uOf(praca.s0 - 20), u1: uOf(praca.s1 + 24), side: -1 },
    church: { u: uOf(praca.s0 + 22), side: -1, offset: 34 },
    village: { u0: uOf(vila.s0 - 40), u1: uOf(vilaEnd.s1 + 10) },
    beach: { u0: uOf(grid.s0 + 40), u1: uOf(360) },
  },
  authoring: {
    generator: 'tools/make-track.mjs',
    totalLengthApprox: +total.toFixed(2),
    freeLengths: [+Lz.toFixed(3), +Least.toFixed(3)],
    segments: W.segInfo.map((g) => ({ tag: g.tag || null, type: g.t, s0: +g.s0.toFixed(1), s1: +g.s1.toFixed(1), zone: g.zone })),
  },
};
fs.writeFileSync(OUT, JSON.stringify(track, null, 1));
console.log('wrote', OUT, 'controlPoints', nCP);

// debug svg of the layout
const xs = cps.map((c) => c[0]), zs = cps.map((c) => c[2]);
const minX = Math.min(...xs) - 50, maxX = Math.max(...xs) + 50, minZ = Math.min(...zs) - 50, maxZ = Math.max(...zs) + 50;
const col = { 1: '#e8a33d', 2: '#b05a3c', 3: '#5c6bc0', 4: '#2e7d32' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}" width="1400" height="${Math.round(1400 * (maxZ - minZ) / (maxX - minX))}"><rect x="${minX}" y="${minZ}" width="${maxX - minX}" height="${maxZ - minZ}" fill="#f4f1ea"/>`;
for (let c = 0; c < nCP; c++) {
  const a = cps[c], b = cps[(c + 1) % nCP];
  const z = zoneAt((c / nCP) * total);
  svg += `<line x1="${a[0]}" y1="${a[2]}" x2="${b[0]}" y2="${b[2]}" stroke="${col[z]}" stroke-width="${a[3]}" stroke-linecap="round"/>`;
  if (c % 10 === 0) svg += `<text x="${a[0] + 8}" y="${a[2]}" font-size="14" fill="#222">${c} (${a[1].toFixed(0)}m)</text>`;
}
svg += `</svg>`;
const dbg = process.env.TRACK_SVG;
if (dbg) { fs.writeFileSync(dbg, svg); console.log('svg ->', dbg); }
