// Procedural Mediterranean houses (own work). Each house is built from real
// geometry: walls with recessed openings (reveals), stone surrounds, sills,
// shutters, recessed doors with steps, balconies with railings, awnings,
// flower boxes, tiled hip/gable roofs with eaves, chimneys. Six archetypes.
// Output is accumulated per material into big merged buffers (few draw calls).
import { mulberry32 } from '../core/rng.js';

export const HOUSE_STYLES = [
  { id: 0, name: 'caiada', walls: [[0.96, 0.95, 0.92]], shutters: [[0.2, 0.42, 0.62]], roof: 'hip', floors: [2, 3], balcony: 0.4, awning: 0.1, boxes: 0.6, stone: false },
  { id: 1, name: 'ocre-sobrado', walls: [[0.88, 0.68, 0.42], [0.84, 0.62, 0.38]], shutters: [[0.28, 0.42, 0.26]], roof: 'hip', floors: [3, 3], balcony: 0.9, awning: 0.2, boxes: 0.5, stone: false },
  { id: 2, name: 'salmao-loja', walls: [[0.92, 0.64, 0.56], [0.9, 0.7, 0.62]], shutters: [[0.92, 0.9, 0.86]], roof: 'gable', floors: [2, 3], balcony: 0.5, awning: 0.95, boxes: 0.3, stone: false },
  { id: 3, name: 'pedra', walls: [[1, 1, 1]], shutters: [[0.42, 0.3, 0.2]], roof: 'gable', floors: [2, 2], balcony: 0.2, awning: 0.0, boxes: 0.7, stone: true },
  { id: 4, name: 'amarela', walls: [[0.95, 0.84, 0.52], [0.93, 0.8, 0.46]], shutters: [[0.18, 0.36, 0.3]], roof: 'gable', floors: [2, 3], balcony: 0.6, awning: 0.3, boxes: 0.9, stone: false },
  { id: 5, name: 'terracota', walls: [[0.76, 0.42, 0.3], [0.7, 0.4, 0.3]], shutters: [[0.9, 0.86, 0.78]], roof: 'hip', floors: [2, 3], balcony: 0.7, awning: 0.4, boxes: 0.5, stone: false },
];

/** growable buffers per material */
export class GeoAcc {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get vcount() { return this.pos.length / 3; }
}

/** fold minor materials into shared ones (vertex colour carries the tint) -> fewer draw calls */
const REMAP = { roofcap: ['roof', [0.85, 0.62, 0.5]], woodDark: ['wood', [0.55, 0.42, 0.33]], terracotta: ['plaster', [0.74, 0.4, 0.26]] };
function remap(mat, color) { const r = REMAP[mat]; return r ? [r[0], (color[0] === 1 && color[1] === 1 && color[2] === 1) ? r[1] : color] : [mat, color]; }

/** true if triangle (a,b,c) is counter-clockwise seen from the side of n (local coords) */
function facing(a, b, c, n) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  return g[0] * n[0] + g[1] * n[1] + g[2] * n[2] >= 0;
}

/** local frame: x along the street, y up, z depth (front facade at z=0 faces -z) */
class Builder {
  constructor(acc, M) { this.acc = acc; this.M = M; } // M: 4x3 affine as [ux,uz, vx,vz, ox,oy,oz] (yaw only)
  _t(x, y, z) { const M = this.M; return [M.ox + x * M.cx - z * M.sx, M.oy + y, M.oz + x * M.sx + z * M.cx]; }
  _n(nx, ny, nz) { const M = this.M; return [nx * M.cx - nz * M.sx, ny, nx * M.sx + nz * M.cx]; }
  /** quad with corners a,b,c,d (counter-clockwise seen from the normal side) */
  quad(mat, a, b, c, d, n, uvs, color = [1, 1, 1]) {
    [mat, color] = remap(mat, color);
    const A = this.acc[mat]; const base = A.vcount;
    const nn = this._n(...n);
    for (let k = 0; k < 4; k++) { const p = [a, b, c, d][k]; A.pos.push(...this._t(...p)); A.nor.push(...nn); A.uv.push(...uvs[k]); A.col.push(...color); }
    if (facing(a, b, c, n)) A.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else A.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  /** axis-aligned box (6 quads), uv in metres * s */
  box(mat, x0, y0, z0, x1, y1, z1, color, s = 1) {
    const q = (a, b, c, d, n, u0, v0, u1, v1) => this.quad(mat, a, b, c, d, n, [[u0 * s, v0 * s], [u1 * s, v0 * s], [u1 * s, v1 * s], [u0 * s, v1 * s]], color);
    q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], x0, y0, x1, y1); // front (-z)
    q([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], -x1, y0, -x0, y1); // back
    q([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], -z1, y0, -z0, y1); // left
    q([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], z0, y0, z1, y1); // right
    q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], x0, z0, x1, z1); // top
    q([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], x0, z1, x1, z0); // bottom
  }
  tri(mat, a, b, c, n, uvs, color = [1, 1, 1]) {
    [mat, color] = remap(mat, color);
    const A = this.acc[mat]; const base = A.vcount; const nn = this._n(...n);
    for (let k = 0; k < 3; k++) { A.pos.push(...this._t(...[a, b, c][k])); A.nor.push(...nn); A.uv.push(...uvs[k]); A.col.push(...color); }
    if (facing(a, b, c, n)) A.idx.push(base, base + 1, base + 2); else A.idx.push(base, base + 2, base + 1);
  }
}

/**
 * Wall plane with rectangular openings. The wall lies in the plane given by
 * origin o, horizontal axis h (unit), outward normal n; size (len x height).
 * Openings: {u, v, w, h, depth, kind}. Produces wall quads around openings and
 * reveal faces; returns openings for detail placement.
 */
function wall(B, mat, o, hAxis, n, len, height, openings, color, uvS = 0.5) {
  // grid lines
  const us = new Set([0, len]), vs = new Set([0, height]);
  for (const op of openings) { us.add(op.u); us.add(op.u + op.w); vs.add(op.v); vs.add(op.v + op.h); }
  const U = [...us].sort((a, b) => a - b), V = [...vs].sort((a, b) => a - b);
  const P = (u, v, d = 0) => [o[0] + hAxis[0] * u + n[0] * d, o[1] + v, o[2] + hAxis[2] * u + n[2] * d];
  const inside = (u, v) => openings.some((op) => u > op.u + 1e-4 && u < op.u + op.w - 1e-4 && v > op.v + 1e-4 && v < op.v + op.h - 1e-4);
  for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < V.length - 1; j++) {
    const cu = (U[i] + U[i + 1]) / 2, cv = (V[j] + V[j + 1]) / 2;
    if (inside(cu, cv)) continue;
    const a = P(U[i], V[j]), b = P(U[i + 1], V[j]), c = P(U[i + 1], V[j + 1]), d = P(U[i], V[j + 1]);
    const ou = o[0] * 0.13 + o[2] * 0.11; // offset texture per wall
    B.quad(mat, a, b, c, d, n, [[(U[i] + ou) * uvS, V[j] * uvS], [(U[i + 1] + ou) * uvS, V[j] * uvS], [(U[i + 1] + ou) * uvS, V[j + 1] * uvS], [(U[i] + ou) * uvS, V[j + 1] * uvS]], color);
  }
  // reveals (recess sides) for each opening
  for (const op of openings) {
    const dp = -op.depth;
    const u0 = op.u, u1 = op.u + op.w, v0 = op.v, v1 = op.v + op.h;
    const s = uvS;
    // left side (faces +h)
    B.quad(mat, P(u0, v0, dp), P(u0, v0, 0), P(u0, v1, 0), P(u0, v1, dp), hAxis, [[0, v0 * s], [op.depth * s, v0 * s], [op.depth * s, v1 * s], [0, v1 * s]], color);
    // right side (faces -h)
    B.quad(mat, P(u1, v0, 0), P(u1, v0, dp), P(u1, v1, dp), P(u1, v1, 0), [-hAxis[0], 0, -hAxis[2]], [[0, v0 * s], [op.depth * s, v0 * s], [op.depth * s, v1 * s], [0, v1 * s]], color);
    // top (faces down)
    B.quad(mat, P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, dp), P(u0, v1, dp), [0, -1, 0], [[u0 * s, 0], [u1 * s, 0], [u1 * s, op.depth * s], [u0 * s, op.depth * s]], color);
    // bottom (faces up)
    B.quad(mat, P(u0, v0, dp), P(u1, v0, dp), P(u1, v0, 0), P(u0, v0, 0), [0, 1, 0], [[u0 * s, 0], [u1 * s, 0], [u1 * s, op.depth * s], [u0 * s, op.depth * s]], color);
  }
  return { P };
}

/**
 * Build one house into the accumulators. Returns footprint info.
 * opts: { x, y, z, yaw, W, D, style, seed }
 */
export function buildHouse(acc, opts) {
  const r = mulberry32(opts.seed);
  const st = HOUSE_STYLES[opts.style];
  const W = opts.W, D = opts.D;
  const floors = st.floors[0] + Math.floor(r() * (st.floors[1] - st.floors[0] + 1));
  const FH = 3.0, plinth = 0.45;
  const H = plinth + floors * FH;
  const cx = Math.cos(opts.yaw), sx = Math.sin(opts.yaw);
  const B = new Builder(acc, { cx, sx, ox: opts.x, oy: opts.y, oz: opts.z });
  const wallMat = st.stone ? 'stone' : 'plaster';
  const wc = st.stone ? [1, 1, 1] : st.walls[Math.floor(r() * st.walls.length)].map((c) => c * (0.94 + r() * 0.08));
  const shc = st.shutters[0].map((c) => c * (0.9 + r() * 0.15));
  const yb = -0.8; // foundation below the pad
  // ---- facades: front (z=0, normal -z), back (z=D, +z), left (x=0, -x), right (x=W, +x)
  const nWin = Math.max(2, Math.floor((W - 1.2) / 2.3));
  const spacing = W / nWin;
  const doorIdx = Math.floor(r() * nWin);
  const shop = r() < st.awning * 0.6;
  const frontOps = [];
  for (let f = 0; f < floors; f++) for (let k = 0; k < nWin; k++) {
    const u = k * spacing + spacing / 2;
    if (f === 0 && k === doorIdx) { frontOps.push({ u: u - 0.55, v: plinth - 0.3, w: 1.1, h: 2.3, depth: 0.22, kind: 'door' }); continue; }
    if (f === 0 && shop && Math.abs(k - doorIdx) === 1) { frontOps.push({ u: u - 0.85, v: plinth + 0.25, w: 1.7, h: 2.0, depth: 0.2, kind: 'shop' }); continue; }
    const ww = 0.85 + r() * 0.15, wh = f === 0 ? 1.35 : 1.5;
    frontOps.push({ u: u - ww / 2, v: plinth + f * FH + (f === 0 ? 0.9 : 0.8), w: ww, h: wh, depth: 0.2, kind: 'win', floor: f });
  }
  const sideOps = (len, seedK) => { const ops = []; const n = Math.max(1, Math.floor((len - 1.5) / 2.8)); const sp = len / n; for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) { if (r() < 0.25) continue; const u = k * sp + sp / 2; ops.push({ u: u - 0.4, v: plinth + f * FH + 0.85, w: 0.8, h: 1.3, depth: 0.18, kind: 'win', floor: f }); } return ops; };
  const backOps = sideOps(W, 1), leftOps = sideOps(D, 2), rightOps = sideOps(D, 3);
  const walls = [
    { o: [0, yb, 0], h: [1, 0, 0], n: [0, 0, -1], len: W, ops: frontOps },
    { o: [W, yb, D], h: [-1, 0, 0], n: [0, 0, 1], len: W, ops: backOps },
    { o: [0, yb, D], h: [0, 0, -1], n: [-1, 0, 0], len: D, ops: leftOps },
    { o: [W, yb, 0], h: [0, 0, 1], n: [1, 0, 0], len: D, ops: rightOps },
  ];
  for (const w of walls) {
    const ops = w.ops.map((op) => ({ ...op, v: op.v - yb }));
    const { P } = wall(B, wallMat, w.o, w.h, w.n, w.len, H - yb, ops, wc, st.stone ? 0.55 : 0.45);
    // details per opening
    for (const op of ops) {
      const u0 = op.u, u1 = op.u + op.w, v0 = op.v, v1 = op.v + op.h;
      const back = (u, v) => P(u, v, -op.depth);
      // glass / door panel at the back of the recess
      const pm = op.kind === 'door' ? 'wood' : 'glass';
      const pc = op.kind === 'door' ? shc : [1, 1, 1];
      B.quad(pm, back(u0, v0), back(u1, v0), back(u1, v1), back(u0, v1), w.n, [[0, 0], [1, 0], [1, 1], [0, 1]], pc);
      // stone surround (frame) slightly proud of the wall
      const fw = 0.1, fd = 0.035;
      const fr = (a0, b0, a1, b1) => {
        // a: u range, b: v range; build a thin slab on the wall plane
        const p00 = P(a0, b0, fd), p10 = P(a1, b0, fd), p11 = P(a1, b1, fd), p01 = P(a0, b1, fd);
        B.quad('trim', p00, p10, p11, p01, w.n, [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(([a, b]) => [a * 0.8, b * 0.8]));
        // top & side edges
        B.quad('trim', P(a0, b1, 0), P(a1, b1, 0), P(a1, b1, fd), P(a0, b1, fd), [0, 1, 0], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
        B.quad('trim', P(a0, b0, fd), P(a1, b0, fd), P(a1, b0, 0), P(a0, b0, 0), [0, -1, 0], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
      };
      if (op.kind !== 'shop') {
        fr(u0 - fw, v1, u1 + fw, v1 + fw); // lintel
        fr(u0 - fw, v0, u0, v1); fr(u1, v0, u1 + fw, v1);
      }
      if (op.kind === 'win') {
        // sill (protruding)
        const s0 = P(u0 - 0.12, v0 - 0.08, 0), s1 = P(u1 + 0.12, v0 - 0.08, 0);
        const sd = 0.13;
        const t = (p, d) => [p[0] + w.n[0] * d, p[1], p[2] + w.n[2] * d];
        B.quad('trim', t(s0, sd), t(s1, sd), t([s1[0], s1[1] + 0.08, s1[2]], sd), t([s0[0], s0[1] + 0.08, s0[2]], sd), w.n, [[0, 0], [1, 0], [1, 0.1], [0, 0.1]]);
        B.quad('trim', [s0[0], s0[1] + 0.08, s0[2]], [s1[0], s1[1] + 0.08, s1[2]], t([s1[0], s1[1] + 0.08, s1[2]], sd), t([s0[0], s0[1] + 0.08, s0[2]], sd), [0, 1, 0], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]]);
        // glazing bars (mullion + transom) inside the recess
        const bd = -op.depth + 0.03, uc = (u0 + u1) / 2, vc = v0 + op.h * 0.62;
        const bar = (a0, b0, a1, b1) => B.quad('wood', P(a0, b0, bd), P(a1, b0, bd), P(a1, b1, bd), P(a0, b1, bd), w.n, [[0, 0], [1, 0], [1, 1], [0, 1]], [0.92, 0.9, 0.86]);
        bar(uc - 0.025, v0, uc + 0.025, v1); bar(u0, vc - 0.025, u1, vc + 0.025);
        bar(u0, v0, u1, v0 + 0.05); bar(u0, v1 - 0.05, u1, v1); bar(u0, v0, u0 + 0.05, v1); bar(u1 - 0.05, v0, u1, v1);
        // open shutters on both sides (slatted panels)
        if (w.n[2] !== 0 || r() < 0.5) {
          const sw = op.w * 0.5 + 0.02;
          for (const [a, b] of [[u0 - fw - sw, u0 - fw], [u1 + fw, u1 + fw + sw]]) {
            const p0 = P(a, v0 - 0.02, 0.05), p1 = P(b, v0 - 0.02, 0.05), p2 = P(b, v1 + 0.02, 0.05), p3 = P(a, v1 + 0.02, 0.05);
            B.quad('shutter', p0, p1, p2, p3, w.n, [[0, 0], [1, 0], [1, 1], [0, 1]], shc);
          }
        }
        // flower box
        if (r() < st.boxes * 0.55 && op.floor >= 0) {
          const bx0 = u0 - 0.05, bx1 = u1 + 0.05, by = v0 - 0.32;
          const q0 = P(bx0, by, 0.05), q1 = P(bx1, by, 0.05), q2 = P(bx1, by + 0.24, 0.05), q3 = P(bx0, by + 0.24, 0.05);
          const t2 = (p, d) => [p[0] + w.n[0] * d, p[1], p[2] + w.n[2] * d];
          B.quad('terracotta', t2(q0, 0.22), t2(q1, 0.22), t2(q2, 0.22), t2(q3, 0.22), w.n, [[0, 0], [1, 0], [1, 0.3], [0, 0.3]]);
          B.quad('terracotta', t2(q3, 0.05), t2(q2, 0.05), t2(q2, 0.22), t2(q3, 0.22), [0, 1, 0], [[0, 0], [1, 0], [1, 0.3], [0, 0.3]]);
          // flowers: two crossed cards along the box
          const f0 = t2(P(bx0, by + 0.2, 0.05), 0.13), f1 = t2(P(bx1, by + 0.2, 0.05), 0.13);
          B.quad('flowers', f0, f1, [f1[0], f1[1] + 0.45, f1[2]], [f0[0], f0[1] + 0.45, f0[2]], w.n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        }
      }
      if (op.kind === 'door') {
        // step
        const p0 = P(u0 - 0.25, v0 - 0.18, 0), p1 = P(u1 + 0.25, v0 - 0.18, 0);
        const t = (p, d, dy = 0) => [p[0] + w.n[0] * d, p[1] + dy, p[2] + w.n[2] * d];
        B.quad('trim', t(p0, 0.45, 0.18), t(p1, 0.45, 0.18), t(p1, 0, 0.18), t(p0, 0, 0.18), [0, 1, 0], [[0, 0], [1, 0], [1, 0.4], [0, 0.4]]);
        B.quad('trim', t(p0, 0.45), t(p1, 0.45), t(p1, 0.45, 0.18), t(p0, 0.45, 0.18), w.n, [[0, 0], [1, 0], [1, 0.2], [0, 0.2]]);
        // door panels detail (raised panels)
        const bd = -op.depth + 0.02;
        B.quad('wood', P(u0 + 0.12, v0 + 0.25, bd), P(u0 + op.w / 2 - 0.06, v0 + 0.25, bd), P(u0 + op.w / 2 - 0.06, v1 - 0.3, bd), P(u0 + 0.12, v1 - 0.3, bd), w.n, [[0, 0], [1, 0], [1, 1], [0, 1]], shc.map((c) => c * 0.8));
        B.quad('wood', P(u0 + op.w / 2 + 0.06, v0 + 0.25, bd), P(u1 - 0.12, v0 + 0.25, bd), P(u1 - 0.12, v1 - 0.3, bd), P(u0 + op.w / 2 + 0.06, v1 - 0.3, bd), w.n, [[0, 0], [1, 0], [1, 1], [0, 1]], shc.map((c) => c * 0.8));
      }
      if (op.kind === 'shop' || (op.kind === 'door' && r() < st.awning)) {
        // striped awning (sloped, with a valance)
        const a0 = op.u - 0.25, a1 = op.u + op.w + 0.25, ay = op.v + op.h + 0.32;
        const t = (p, d, dy = 0) => [p[0] + w.n[0] * d, p[1] + dy, p[2] + w.n[2] * d];
        const q0 = P(a0, ay, 0), q1 = P(a1, ay, 0);
        B.quad('awning', q0, t(q0, 1.15, -0.5), t(q1, 1.15, -0.5), q1, [w.n[0] * 0.45, 0.9, w.n[2] * 0.45], [[0, 0], [0, 1], [3, 1], [3, 0]]);
        B.quad('awning', t(q0, 1.15, -0.5), t(q0, 1.15, -0.78), t(q1, 1.15, -0.78), t(q1, 1.15, -0.5), w.n, [[0, 0], [0, 0.25], [3, 0.25], [3, 0]]);
      }
    }
  }
  // ---- plinth band (stone) around the base
  const pb = 0.06;
  for (const w of walls) {
    const o = w.o, hA = w.h, n = w.n;
    const P = (u, v, d) => [o[0] + hA[0] * u + n[0] * d, v, o[2] + hA[2] * u + n[2] * d];
    B.quad('stone', P(0, yb, pb), P(w.len, yb, pb), P(w.len, plinth, pb), P(0, plinth, pb), n, [[0, 0], [w.len * 0.55, 0], [w.len * 0.55, (plinth - yb) * 0.55], [0, (plinth - yb) * 0.55]]);
    B.quad('stone', P(0, plinth, 0), P(w.len, plinth, 0), P(w.len, plinth, pb), P(0, plinth, pb), [0, 1, 0], [[0, 0], [w.len * 0.55, 0], [w.len * 0.55, 0.04], [0, 0.04]]);
  }
  // ---- balcony on the first floor across 2 windows
  if (r() < st.balcony && floors >= 2) {
    const bw = Math.min(W - 1.0, spacing * 2 + 0.6), bu = Math.max(0.5, (W - bw) / 2 + (r() - 0.5) * spacing);
    const by = plinth + FH - 0.05, bd = 0.95;
    B.box('trim', bu, by - 0.16, -bd, bu + bw, by, 0, [1, 1, 1], 0.8);
    // railing: top rail + balusters
    B.box('iron', bu, by + 0.98, -bd, bu + bw, by + 1.03, -bd + 0.05, [1, 1, 1], 1);
    B.box('iron', bu, by + 0.98, -bd, bu + 0.05, by + 1.03, 0, [1, 1, 1], 1);
    B.box('iron', bu + bw - 0.05, by + 0.98, -bd, bu + bw, by + 1.03, 0, [1, 1, 1], 1);
    for (let k = 0; k <= Math.floor(bw / 0.14); k++) { const xx = bu + k * 0.14; B.box('iron', xx, by, -bd + 0.01, xx + 0.02, by + 0.98, -bd + 0.03, [1, 1, 1], 1); }
    for (let k = 1; k < 7; k++) { const zz = -bd + k * 0.14; for (const xx of [bu, bu + bw - 0.02]) B.box('iron', xx, by, zz, xx + 0.02, by + 0.98, zz + 0.02, [1, 1, 1], 1); }
  }
  // ---- cornice
  B.box('trim', -0.12, H - 0.18, -0.12, W + 0.12, H, D + 0.12, [1, 1, 1], 0.7);
  // ---- roof
  const eave = 0.45, pitch = 0.42 + r() * 0.12;
  const rx0 = -eave, rx1 = W + eave, rz0 = -eave, rz1 = D + eave;
  const ridgeH = Math.min(W, D) / 2 * pitch + 0.1;
  const y0 = H, cy = H + ridgeH;
  const tile = (a, b, c, d, n, uvs) => B.quad('roof', a, b, c, d, n, uvs);
  const tileTri = (a, b, c, n, uvs) => B.tri('roof', a, b, c, n, uvs);
  const roofKind = st.roof;
  if (roofKind === 'gable') {
    // ridge along x (street), slopes front/back
    const zc = D / 2;
    const slopeL = Math.hypot(zc - rz0, ridgeH);
    const nF = [0, (zc - rz0) / slopeL, -ridgeH / slopeL], nB = [0, (zc - rz0) / slopeL, ridgeH / slopeL];
    tile([rx0, y0, rz0], [rx1, y0, rz0], [rx1, cy, zc], [rx0, cy, zc], nF, [[0, 0], [(rx1 - rx0) * 0.6, 0], [(rx1 - rx0) * 0.6, slopeL * 0.6], [0, slopeL * 0.6]]);
    tile([rx1, y0, rz1], [rx0, y0, rz1], [rx0, cy, zc], [rx1, cy, zc], nB, [[0, 0], [(rx1 - rx0) * 0.6, 0], [(rx1 - rx0) * 0.6, slopeL * 0.6], [0, slopeL * 0.6]]);
    // gable end walls (plaster triangles)
    B.tri(wallMat, [0, H, 0], [0, H, D], [0, cy - 0.05, zc], [-1, 0, 0], [[0, 0], [D * 0.45, 0], [D * 0.22, ridgeH * 0.45]], wc);
    B.tri(wallMat, [W, H, D], [W, H, 0], [W, cy - 0.05, zc], [1, 0, 0], [[0, 0], [D * 0.45, 0], [D * 0.22, ridgeH * 0.45]], wc);
    // fascia under the eave edges
    B.box('woodDark', rx0, y0 - 0.12, rz0, rx1, y0, rz0 + 0.06, [1, 1, 1], 1);
    B.box('woodDark', rx0, y0 - 0.12, rz1 - 0.06, rx1, y0, rz1, [1, 1, 1], 1);
    // ridge cap
    B.box('roofcap', rx0, cy - 0.04, zc - 0.1, rx1, cy + 0.08, zc + 0.1, [1, 1, 1], 1.2);
  } else {
    // hip roof
    const inset = Math.min(W, D) / 2;
    const zc = D / 2, xA = Math.min(W / 2, inset), xB = Math.max(W / 2, W - inset);
    const rp = (x, z) => [x, cy, z];
    const sF = Math.hypot(zc - rz0, ridgeH), sS = Math.hypot(xA - rx0, ridgeH);
    tile([rx0, y0, rz0], [rx1, y0, rz0], rp(xB, zc), rp(xA, zc), [0, (zc - rz0) / sF, -ridgeH / sF], [[0, 0], [(rx1 - rx0) * 0.6, 0], [(xB - rx0) * 0.6, sF * 0.6], [(xA - rx0) * 0.6, sF * 0.6]]);
    tile([rx1, y0, rz1], [rx0, y0, rz1], rp(xA, zc), rp(xB, zc), [0, (zc - rz0) / sF, ridgeH / sF], [[0, 0], [(rx1 - rx0) * 0.6, 0], [(rx1 - xA) * 0.6, sF * 0.6], [(rx1 - xB) * 0.6, sF * 0.6]]);
    tileTri([rx0, y0, rz1], [rx0, y0, rz0], rp(xA, zc), [-ridgeH / sS, (xA - rx0) / sS, 0], [[0, 0], [(rz1 - rz0) * 0.6, 0], [(zc - rz0) * 0.6, sS * 0.6]]);
    tileTri([rx1, y0, rz0], [rx1, y0, rz1], rp(xB, zc), [ridgeH / sS, (xA - rx0) / sS, 0], [[0, 0], [(rz1 - rz0) * 0.6, 0], [(zc - rz0) * 0.6, sS * 0.6]]);
    if (xB - xA > 0.05) B.box('roofcap', xA, cy - 0.04, zc - 0.1, xB, cy + 0.08, zc + 0.1, [1, 1, 1], 1.2);
    B.box('woodDark', rx0, y0 - 0.12, rz0, rx1, y0, rz0 + 0.06, [1, 1, 1], 1);
    B.box('woodDark', rx0, y0 - 0.12, rz1 - 0.06, rx1, y0, rz1, [1, 1, 1], 1);
  }
  // soffit (underside of the eave) so the overhang is solid
  B.quad('woodDark', [rx0, y0 - 0.02, rz1], [rx1, y0 - 0.02, rz1], [rx1, y0 - 0.02, rz0], [rx0, y0 - 0.02, rz0], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // ---- chimney
  if (r() < 0.6) {
    const chx = W * (0.25 + r() * 0.5), chz = D * (0.3 + r() * 0.4);
    B.box(wallMat, chx - 0.35, H, chz - 0.3, chx + 0.35, cy + 0.9, chz + 0.3, wc, 0.5);
    B.box('trim', chx - 0.45, cy + 0.9, chz - 0.4, chx + 0.45, cy + 1.0, chz + 0.4, [1, 1, 1], 0.8);
    B.box('roofcap', chx - 0.2, cy + 1.0, chz - 0.2, chx + 0.2, cy + 1.25, chz + 0.2, [1, 1, 1], 1);
  }
  return { floors, H: cy + 1.25, W, D, style: st.id };
}

export const HOUSE_MATERIALS = ['plaster', 'stone', 'trim', 'wood', 'shutter', 'glass', 'roof', 'iron', 'awning', 'flowers', 'roofcap', 'woodDark', 'terracotta'];
export function newAccumulators() { const a = {}; for (const m of HOUSE_MATERIALS) a[m] = new GeoAcc(); return a; }
