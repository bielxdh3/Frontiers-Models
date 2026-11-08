// Procedural Mediterranean village: 8 house designs (recessed windows with frames/shutters, doors, terracotta tile roofs with eaves,
// balconies / awnings / flower boxes / chimneys), a church with bell tower and a lighthouse. Every wall is a real mesh with openings
// (never a box with a pasted facade). Plaster colour/texture is chosen per instance.
import * as THREE from 'three';
import { MeshBuilder } from './meshbuild.js';
import { BUILD_ID } from './shaders.js';
import { rng } from '../core/util.js';

const ROOF_A = BUILD_ID.clay_roof_tiles_03, ROOF_B = BUILD_ID.clay_roof_tiles_02, STONE = BUILD_ID.stone_wall, STONE2 = BUILD_ID.rustic_stone_wall;
const WOOD = BUILD_ID.wood_shutter, PLANK = BUILD_ID.wooden_planks, CONC = BUILD_ID.concrete_wall_007;

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** wall with openings; origin = bottom-left corner seen from outside, n = outward normal, up = [0,1,0] */
function facade(mb, { o, n, width, height, openings = [], mat = -1, baseMat = STONE, baseH = 0.9, color = [1, 1, 1], inst = [0, 0, 0, 0] }) {
  const up = [0, 1, 0], u = cross(up, n);
  const P = (uu, vv, d = 0) => [o[0] + u[0] * uu + up[0] * vv - n[0] * d, o[1] + u[1] * uu + up[1] * vv - n[1] * d, o[2] + u[2] * uu + up[2] * vv - n[2] * d];
  const vs = new Set([0, height, Math.min(baseH, height)]);
  for (const op of openings) { vs.add(op.v0); vs.add(op.v1); }
  const vl = [...vs].sort((a, b) => a - b);
  for (let k = 0; k < vl.length - 1; k++) {
    const va = vl[k], vb = vl[k + 1]; if (vb - va < 1e-4) continue;
    const blocks = openings.filter(op => op.v0 <= va + 1e-4 && op.v1 >= vb - 1e-4).sort((a, b) => a.u0 - b.u0);
    let cur = 0;
    const segs = [];
    for (const b of blocks) { if (b.u0 > cur + 1e-4) segs.push([cur, b.u0]); cur = Math.max(cur, b.u1); }
    if (cur < width - 1e-4) segs.push([cur, width]);
    const m = vb <= baseH + 1e-4 ? baseMat : mat;
    for (const [a, b] of segs) mb.quad(P(a, va), P(b, va), P(b, vb), P(a, vb), { mat: m, color, inst, uvs: [[a, va], [b, va], [b, vb], [a, vb]] });
  }
  // openings: reveal, glass, frame, sill, lintel, shutters
  for (const op of openings) {
    const rev = 0.20, w = op.u1 - op.u0, h = op.v1 - op.v0;
    const wallC = color;
    mb.quad(P(op.u0, op.v0), P(op.u0, op.v0, rev), P(op.u0, op.v1, rev), P(op.u0, op.v1), { mat, color: wallC, inst, uvScale: 1 });
    mb.quad(P(op.u1, op.v0), P(op.u1, op.v1), P(op.u1, op.v1, rev), P(op.u1, op.v0, rev), { mat, color: wallC, inst });
    mb.quad(P(op.u0, op.v0), P(op.u1, op.v0), P(op.u1, op.v0, rev), P(op.u0, op.v0, rev), { mat, color: [wallC[0] * 0.9, wallC[1] * 0.9, wallC[2] * 0.9], inst });
    mb.quad(P(op.u0, op.v1), P(op.u0, op.v1, rev), P(op.u1, op.v1, rev), P(op.u1, op.v1), { mat, color: [wallC[0] * 0.8, wallC[1] * 0.8, wallC[2] * 0.8], inst });
    const isDoor = op.kind === 'door';
    if (isDoor) {
      mb.quad(P(op.u0 + 0.05, op.v0, rev - 0.02), P(op.u1 - 0.05, op.v0, rev - 0.02), P(op.u1 - 0.05, op.v1 - 0.04, rev - 0.02), P(op.u0 + 0.05, op.v1 - 0.04, rev - 0.02), { mat: PLANK, color: op.doorColor || [0.5, 0.33, 0.2], uvs: [[0, 0], [w, 0], [w, h], [0, h]] });
      mb.quad(P(op.u0 + 0.12, op.v1 - 0.55, rev - 0.03), P(op.u1 - 0.12, op.v1 - 0.55, rev - 0.03), P(op.u1 - 0.12, op.v1 - 0.12, rev - 0.03), P(op.u0 + 0.12, op.v1 - 0.12, rev - 0.03), { mat: -1, color: [0.03, 0.04, 0.05], inst });
    } else {
      // glass: darker at the bottom, sky-ish gradient at the top (fake reflection)
      const g0 = [0.025, 0.03, 0.04], g1 = [0.16, 0.22, 0.28];
      const i0 = mb.count;
      const cs = [[op.u0, op.v0, g0], [op.u1, op.v0, g0], [op.u1, op.v1, g1], [op.u0, op.v1, g1]];
      const nn = [-n[0] * -1, n[1], n[2]];
      cs.forEach(c => { const p = P(c[0], c[1], rev - 0.01); mb.vert(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], -1, inst); });
      mb.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      // mullions
      const fr = op.frame || [0.92, 0.9, 0.85], t = 0.06;
      mb.quad(P(op.u0, op.v0, rev - 0.02), P(op.u1, op.v0, rev - 0.02), P(op.u1, op.v0 + t, rev - 0.02), P(op.u0, op.v0 + t, rev - 0.02), { mat: -1, color: fr, inst });
      mb.quad(P(op.u0, op.v1 - t, rev - 0.02), P(op.u1, op.v1 - t, rev - 0.02), P(op.u1, op.v1, rev - 0.02), P(op.u0, op.v1, rev - 0.02), { mat: -1, color: fr, inst });
      mb.quad(P((op.u0 + op.u1) / 2 - 0.025, op.v0, rev - 0.02), P((op.u0 + op.u1) / 2 + 0.025, op.v0, rev - 0.02), P((op.u0 + op.u1) / 2 + 0.025, op.v1, rev - 0.02), P((op.u0 + op.u1) / 2 - 0.025, op.v1, rev - 0.02), { mat: -1, color: fr, inst });
      mb.quad(P(op.u0, (op.v0 + op.v1) / 2 - 0.025, rev - 0.02), P(op.u1, (op.v0 + op.v1) / 2 - 0.025, rev - 0.02), P(op.u1, (op.v0 + op.v1) / 2 + 0.025, rev - 0.02), P(op.u0, (op.v0 + op.v1) / 2 + 0.025, rev - 0.02), { mat: -1, color: fr, inst });
    }
    // outer frame (proud of the wall) + sill + lintel
    const fc = op.frame || [0.93, 0.91, 0.86], fw = 0.08, pr = 0.035;
    const bar = (a0, a1, b0, b1, col) => { mb.quad(P(a0, b0, -pr), P(a1, b0, -pr), P(a1, b1, -pr), P(a0, b1, -pr), { mat: -1, color: col, inst }); };
    bar(op.u0 - fw, op.u0, op.v0 - fw, op.v1 + fw, fc); bar(op.u1, op.u1 + fw, op.v0 - fw, op.v1 + fw, fc);
    bar(op.u0, op.u1, op.v1, op.v1 + fw, fc);
    if (!isDoor) { // projecting sill slab
      mb.quad(P(op.u0 - 0.12, op.v0 - 0.02, -0.12), P(op.u1 + 0.12, op.v0 - 0.02, -0.12), P(op.u1 + 0.12, op.v0 - 0.02, 0), P(op.u0 - 0.12, op.v0 - 0.02, 0), { mat: STONE2, color: [1, 0.97, 0.92], inst });
      mb.quad(P(op.u0 - 0.12, op.v0 - 0.02, -0.12), P(op.u1 + 0.12, op.v0 - 0.02, -0.12), P(op.u1 + 0.12, op.v0 - 0.12, -0.10), P(op.u0 - 0.12, op.v0 - 0.12, -0.10), { mat: STONE2, color: [0.9, 0.87, 0.8], inst });
    }
    if (op.shutters) {
      const sc = op.shutters, sw = Math.min(w * 0.5, 0.62);
      for (const [a, b] of [[op.u0 - sw - 0.06, op.u0 - 0.06], [op.u1 + 0.06, op.u1 + sw + 0.06]]) {
        mb.quad(P(a, op.v0 - 0.03, -0.05), P(b, op.v0 - 0.03, -0.05), P(b, op.v1 + 0.03, -0.05), P(a, op.v1 + 0.03, -0.05), { mat: WOOD, color: sc, uvs: [[0, 0], [sw, 0], [sw, h], [0, h]] });
        // louvre ribs
        for (let r = 1; r < 6; r++) { const vv = op.v0 + (h * r) / 6; mb.quad(P(a, vv, -0.05), P(b, vv, -0.05), P(b, vv + 0.018, -0.075), P(a, vv + 0.018, -0.075), { mat: WOOD, color: [sc[0] * 0.8, sc[1] * 0.8, sc[2] * 0.8], inst }); }
      }
    }
  }
}

function slopeQuad(mb, p0, p1, p2, p3, mat, color, inst) { mb.quad(p0, p1, p2, p3, { mat, color, inst }); }

/** gable / hip roof over a W x D footprint (x width, z depth) at wall-top height H */
function roof(mb, { W, D, H, pitch, ov = 0.55, ridgeX = true, hip = false, mat = ROOF_A, color = [1, 1, 1], inst = [0, 0, 0, 0] }) {
  const hw = W / 2 + ov, hd = D / 2 + ov, span = ridgeX ? D / 2 : W / 2;
  const yR = H + span * pitch, yE = H - ov * pitch;
  if (!hip) {
    if (ridgeX) {
      // front (+z) and back (-z) slopes
      mb.quad([-hw, yE, hd], [hw, yE, hd], [hw, yR, 0], [-hw, yR, 0], { mat, color, inst });
      mb.quad([hw, yE, -hd], [-hw, yE, -hd], [-hw, yR, 0], [hw, yR, 0], { mat, color, inst });
      // gable wall triangles (plaster) at +x / -x
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2);
        const tri = sx > 0 ? [[x, H, D / 2], [x, H, -D / 2], [x, yR - ov * 0.0, 0]] : [[x, H, -D / 2], [x, H, D / 2], [x, yR, 0]];
        mb.tri(tri[0], tri[1], tri[2], { mat: -1, color: [1, 1, 1], inst, uvs: [[0, 0], [D, 0], [D / 2, span * pitch]] });
        // gable-end roof edge (barge board)
        const xo = sx * hw;
        mb.quad([xo, yE, sx > 0 ? hd : -hd], [xo, yR, 0], [xo - sx * 0.14, yR, 0], [xo - sx * 0.14, yE, sx > 0 ? hd : -hd], { mat: -1, color: [0.86, 0.8, 0.7], inst });
      }
      // fascia under the eaves
      for (const sz of [-1, 1]) mb.quad([-hw, yE, sz * hd], [hw, yE, sz * hd], [hw, yE - 0.16, sz * hd], [-hw, yE - 0.16, sz * hd], { mat: -1, color: [0.78, 0.72, 0.62], inst });
    } else {
      mb.quad([hw, yE, hd], [hw, yE, -hd], [0, yR, -hd], [0, yR, hd], { mat, color, inst });
      mb.quad([-hw, yE, -hd], [-hw, yE, hd], [0, yR, hd], [0, yR, -hd], { mat, color, inst });
      for (const sz of [-1, 1]) {
        const z = sz * (D / 2);
        const tri = sz > 0 ? [[-W / 2, H, z], [W / 2, H, z], [0, yR, z]] : [[W / 2, H, z], [-W / 2, H, z], [0, yR, z]];
        mb.tri(tri[0], tri[1], tri[2], { mat: -1, color: [1, 1, 1], inst, uvs: [[0, 0], [W, 0], [W / 2, span * pitch]] });
        const zo = sz * hd; mb.quad([sz > 0 ? hw : -hw, yE, zo], [0, yR, zo], [0, yR, zo - sz * 0.14], [sz > 0 ? hw : -hw, yE, zo - sz * 0.14], { mat: -1, color: [0.86, 0.8, 0.7], inst });
      }
      for (const sx of [-1, 1]) mb.quad([sx * hw, yE, -hd], [sx * hw, yE, hd], [sx * hw, yE - 0.16, hd], [sx * hw, yE - 0.16, -hd], { mat: -1, color: [0.78, 0.72, 0.62], inst });
    }
  } else {
    const yR2 = H + (Math.min(W, D) / 2) * pitch;
    const rx = Math.max(0, W / 2 - D / 2), rz = Math.max(0, D / 2 - W / 2);
    const r0 = W >= D ? [-rx, yR2, 0] : [0, yR2, -rz], r1 = W >= D ? [rx, yR2, 0] : [0, yR2, rz];
    const o = { mat, color, inst };
    mb.quad([-hw, yE, hd], [hw, yE, hd], r1, r0, o);                       // front (+z)
    mb.quad([hw, yE, -hd], [-hw, yE, -hd], r0, r1, o);                     // back (-z)
    if (W >= D) { mb.quad([hw, yE, hd], [hw, yE, -hd], r1, r1, o); mb.quad([-hw, yE, -hd], [-hw, yE, hd], r0, r0, o); }
    else { mb.quad([hw, yE, hd], [hw, yE, -hd], r0, r1, o); mb.quad([-hw, yE, -hd], [-hw, yE, hd], r1, r0, o); }
    for (const sz of [-1, 1]) mb.quad([-hw, yE, sz * hd], [hw, yE, sz * hd], [hw, yE - 0.16, sz * hd], [-hw, yE - 0.16, sz * hd], { mat: -1, color: [0.78, 0.72, 0.62], inst });
    for (const sx of [-1, 1]) mb.quad([sx * hw, yE, -hd], [sx * hw, yE, hd], [sx * hw, yE - 0.16, hd], [sx * hw, yE - 0.16, -hd], { mat: -1, color: [0.78, 0.72, 0.62], inst });
  }
  return yR;
}

/** underside of the eaves (so the overhang is not see-through) */
function soffit(mb, W, D, H, ov, pitch, inst) {
  const yE = H - ov * pitch;
  mb.quad([-(W / 2 + ov), yE - 0.16, D / 2 + ov], [W / 2 + ov, yE - 0.16, D / 2 + ov], [W / 2 + ov, H - 0.02, D / 2], [-(W / 2 + ov), H - 0.02, D / 2], { mat: -1, color: [0.5, 0.45, 0.38], inst });
  mb.quad([W / 2 + ov, yE - 0.16, -(D / 2 + ov)], [-(W / 2 + ov), yE - 0.16, -(D / 2 + ov)], [-(W / 2 + ov), H - 0.02, -D / 2], [W / 2 + ov, H - 0.02, -D / 2], { mat: -1, color: [0.5, 0.45, 0.38], inst });
}

function chimney(mb, x, z, y0, h, inst) {
  const r = 0.34;
  for (const [dx, dz, nx, nz] of [[1, 0, 1, 0], [-1, 0, -1, 0], [0, 1, 0, 1], [0, -1, 0, -1]]) {
    const c = [x + dx * r, y0, z + dz * r], tx = -dz, tz = dx;
    mb.quad([c[0] - tx * r, y0, c[2] - tz * r], [c[0] + tx * r, y0, c[2] + tz * r], [c[0] + tx * r * 0.9, y0 + h, c[2] + tz * r * 0.9], [c[0] - tx * r * 0.9, y0 + h, c[2] - tz * r * 0.9], { mat: STONE, color: [0.95, 0.9, 0.84], inst });
  }
  mb.quad([x - r * 1.15, y0 + h, z + r * 1.15], [x + r * 1.15, y0 + h, z + r * 1.15], [x + r * 1.15, y0 + h, z - r * 1.15], [x - r * 1.15, y0 + h, z - r * 1.15], { mat: STONE, color: [0.7, 0.66, 0.6], inst });
  mb.cylinder(x, z, y0 + h, y0 + h + 0.22, 0.2, 0.16, 8, { color: [0.28, 0.2, 0.17] });
}

function balcony(mb, x0, x1, y, zFront, depth, inst, rail = [0.12, 0.12, 0.13]) {
  const t = 0.12;
  mb.quad([x0, y, zFront + depth], [x1, y, zFront + depth], [x1, y, zFront], [x0, y, zFront], { mat: STONE2, color: [0.95, 0.92, 0.86], inst });
  mb.quad([x0, y - t, zFront], [x1, y - t, zFront], [x1, y - t, zFront + depth], [x0, y - t, zFront + depth], { mat: STONE2, color: [0.8, 0.77, 0.7], inst });
  mb.quad([x0, y - t, zFront + depth], [x1, y - t, zFront + depth], [x1, y, zFront + depth], [x0, y, zFront + depth], { mat: STONE2, color: [0.88, 0.85, 0.8], inst });
  mb.quad([x0, y, zFront + depth], [x0, y - t, zFront + depth], [x0, y - t, zFront], [x0, y, zFront], { mat: STONE2, color: [0.88, 0.85, 0.8], inst });
  mb.quad([x1, y - t, zFront + depth], [x1, y, zFront + depth], [x1, y, zFront], [x1, y - t, zFront], { mat: STONE2, color: [0.88, 0.85, 0.8], inst });
  const n = Math.max(4, Math.round((x1 - x0) / 0.14));
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n; mb.cylinder(x, zFront + depth - 0.04, y, y + 0.98, 0.016, 0.016, 6, { color: rail, cap: false }); }
  for (const yy of [y + 0.98, y + 0.5]) mb.cylinder(x0, zFront + depth - 0.04, yy, yy + 0.0, 0.0, 0.0, 3, { cap: false });
  // top / mid rails as thin beams
  for (const [yy, th] of [[y + 0.98, 0.045], [y + 0.5, 0.02]]) {
    mb.quad([x0, yy + th, zFront + depth - 0.02], [x1, yy + th, zFront + depth - 0.02], [x1, yy + th, zFront + depth - 0.07], [x0, yy + th, zFront + depth - 0.07], { mat: -1, color: rail, inst });
    mb.quad([x0, yy, zFront + depth - 0.02], [x1, yy, zFront + depth - 0.02], [x1, yy + th, zFront + depth - 0.02], [x0, yy + th, zFront + depth - 0.02], { mat: -1, color: rail, inst });
  }
}

function awning(mb, x0, x1, yTop, zFront, inst, c1, c2) {
  const n = Math.max(6, Math.round((x1 - x0) / 0.3)), d = 1.15, drop = 0.5;
  for (let k = 0; k < n; k++) {
    const a = x0 + ((x1 - x0) * k) / n, b = x0 + ((x1 - x0) * (k + 1)) / n;
    mb.quad([a, yTop, zFront], [b, yTop, zFront], [b, yTop - drop, zFront + d], [a, yTop - drop, zFront + d], { mat: -1, color: k % 2 ? c1 : c2, inst });
    mb.quad([a, yTop - drop, zFront + d], [b, yTop - drop, zFront + d], [b, yTop - drop - 0.14, zFront + d], [a, yTop - drop - 0.14, zFront + d], { mat: -1, color: k % 2 ? c1 : c2, inst });
  }
}

function flowerBox(mb, x0, x1, y, zFront, inst, R) {
  const w = x1 - x0, h = 0.22, d = 0.24;
  const col = [0.55, 0.33, 0.2];
  mb.quad([x0, y, zFront + d], [x1, y, zFront + d], [x1, y + h, zFront + d], [x0, y + h, zFront + d], { mat: WOOD, color: col, inst });
  mb.quad([x0, y + h, zFront + d], [x1, y + h, zFront + d], [x1, y + h, zFront], [x0, y + h, zFront], { mat: -1, color: [0.12, 0.09, 0.07], inst });
  for (let k = 0; k < Math.max(3, w / 0.22); k++) {
    const x = x0 + 0.1 + R() * (w - 0.2), zc = zFront + 0.05 + R() * 0.16, hh = 0.14 + R() * 0.14, pink = R() < 0.6;
    mb.cylinder(x, zc, y + h, y + h + hh, 0.1, 0.12, 5, { color: [0.18 + R() * 0.1, 0.4 + R() * 0.15, 0.15], cap: true });
    mb.cylinder(x, zc, y + h + hh, y + h + hh + 0.05, 0.08, 0.06, 5, { color: pink ? [0.95, 0.35 + R() * 0.2, 0.55] : [0.98, 0.95, 0.9], cap: true });
  }
}

// ------------------------------------------------------------------------------------------------ variants
const SHUTTER_COLS = [[0.2, 0.45, 0.3], [0.25, 0.4, 0.62], [0.5, 0.3, 0.2], [0.18, 0.3, 0.2], [0.65, 0.2, 0.18], [0.35, 0.35, 0.38]];

export function buildHouse(variant, seed) {
  const R = rng(seed + variant * 977), mb = new MeshBuilder(), inst = [0, 0, 0, 0];
  const V = [
    { W: 9.6, D: 7.2, F: 2, pitch: 0.46, ridgeX: true, hip: false, balcony: true, awning: false, chimney: true, flower: true },
    { W: 6.4, D: 8.4, F: 3, pitch: 0.56, ridgeX: false, hip: false, balcony: false, awning: true, chimney: false, flower: true },
    { W: 8.2, D: 8.2, F: 2, pitch: 0.42, ridgeX: true, hip: true, balcony: false, awning: false, chimney: true, flower: false },
    { W: 11.2, D: 6.8, F: 2, pitch: 0.4, ridgeX: true, hip: false, balcony: true, awning: true, chimney: true, flower: true },
    { W: 7.4, D: 7.0, F: 3, pitch: 0.5, ridgeX: true, hip: false, balcony: true, awning: false, chimney: true, flower: true },
    { W: 12.6, D: 6.4, F: 2, pitch: 0.38, ridgeX: true, hip: false, balcony: false, awning: false, chimney: false, flower: true },
    { W: 6.0, D: 5.6, F: 2, pitch: 0.6, ridgeX: false, hip: false, balcony: false, awning: false, chimney: true, flower: true },
    { W: 11.8, D: 8.6, F: 3, pitch: 0.4, ridgeX: true, hip: true, balcony: true, awning: true, chimney: true, flower: false },
  ][variant % 8];
  const { W, D, F } = V, floorH = 3.05, H = F * floorH, hw = W / 2, hd = D / 2;
  const shut = SHUTTER_COLS[(R() * SHUTTER_COLS.length) | 0], doorCol = [0.35 + R() * 0.2, 0.22 + R() * 0.12, 0.14];
  const frame = R() < 0.5 ? [0.94, 0.92, 0.88] : [0.86, 0.78, 0.66];
  // foundation plinth (hides slopes)
  for (const [o, n, w] of [[[-hw - 0.04, -1.6, hd + 0.04], [0, 0, 1], W + 0.08], [[hw + 0.04, -1.6, -hd - 0.04], [0, 0, -1], W + 0.08], [[hw + 0.04, -1.6, hd + 0.04], [1, 0, 0], D + 0.08], [[-hw - 0.04, -1.6, -hd - 0.04], [-1, 0, 0], D + 0.08]])
    facade(mb, { o, n, width: w, height: 2.2, mat: STONE, baseMat: STONE, baseH: 9, color: [0.9, 0.87, 0.82], inst: [0, 0, 0, 0] });
  // facades: front (+z, with door), back, left, right
  const wins = (width, floorsCount, withDoor, doorU) => {
    const ops = [];
    const cols = Math.max(2, Math.round(width / 2.6));
    for (let f = 0; f < floorsCount; f++) for (let c = 0; c < cols; c++) {
      const cu = (width * (c + 0.5)) / cols, ww = 0.95, y0 = f * floorH + 0.95, hh = 1.45;
      if (withDoor && f === 0 && Math.abs(cu - doorU) < 1.5) continue;
      ops.push({ u0: cu - ww / 2, u1: cu + ww / 2, v0: y0, v1: y0 + hh, kind: 'window', shutters: (R() < 0.8) ? shut : null, frame });
    }
    if (withDoor) ops.push({ u0: doorU - 0.55, u1: doorU + 0.55, v0: 0.18, v1: 2.35, kind: 'door', doorColor: doorCol, frame });
    return ops;
  };
  const doorU = W * (0.3 + R() * 0.4);
  const frontOps = wins(W, F, true, doorU);
  facade(mb, { o: [-hw, 0, hd], n: [0, 0, 1], width: W, height: H, openings: frontOps, color: [1, 1, 1], mat: -1, baseMat: STONE, baseH: 0.8 });
  facade(mb, { o: [hw, 0, -hd], n: [0, 0, -1], width: W, height: H, openings: wins(W, F, false, 0), color: [1, 1, 1], mat: -1, baseMat: STONE, baseH: 0.8 });
  facade(mb, { o: [hw, 0, hd], n: [1, 0, 0], width: D, height: H, openings: wins(D, F, false, 0).filter((_, k) => k % 2 === 0 || F === 3), color: [1, 1, 1], mat: -1, baseMat: STONE, baseH: 0.8 });
  facade(mb, { o: [-hw, 0, -hd], n: [-1, 0, 0], width: D, height: H, openings: wins(D, F, false, 0).filter((_, k) => k % 2 === 1 || F === 3), color: [1, 1, 1], mat: -1, baseMat: STONE, baseH: 0.8 });
  // floor bands + cornice (extra relief)
  for (let f = 1; f <= F; f++) {
    const y = f * floorH - (f === F ? 0.08 : 0.0);
    for (const [o, n, w] of [[[-hw, y, hd], [0, 0, 1], W], [[hw, y, -hd], [0, 0, -1], W], [[hw, y, hd], [1, 0, 0], D], [[-hw, y, -hd], [-1, 0, 0], D]]) {
      const u = cross([0, 1, 0], n);
      const P = (uu, vv, d) => [o[0] + u[0] * uu + 0 - n[0] * d * -1, o[1] + vv, o[2] + u[2] * uu - n[2] * d * -1];
      const h = f === F ? 0.22 : 0.14, pr = f === F ? 0.16 : 0.08;
      mb.quad(P(0, 0, 0), P(w, 0, 0), P(w, 0, pr), P(0, 0, pr), { mat: -1, color: [0.95, 0.93, 0.88], inst });
      mb.quad(P(0, 0, pr), P(w, 0, pr), P(w, h, pr), P(0, h, pr), { mat: -1, color: [0.97, 0.95, 0.9], inst });
      mb.quad(P(0, h, pr), P(w, h, pr), P(w, h, 0), P(0, h, 0), { mat: -1, color: [1, 0.98, 0.94], inst });
    }
  }
  // corner quoins (stone blocks) up the front corners
  for (const sx of [-1, 1]) for (let k = 0; k < H / 0.5; k++) {
    const y = k * 0.5, w = k % 2 ? 0.42 : 0.3, x = sx * (hw);
    mb.quad([x - sx * w, y, hd + 0.02], [x + sx * 0.0, y, hd + 0.02], [x, y + 0.44, hd + 0.02], [x - sx * w, y + 0.44, hd + 0.02], { mat: STONE2, color: [0.95, 0.9, 0.82], inst, uvs: [[0, 0], [w, 0], [w, 0.44], [0, 0.44]] });
  }
  // roof
  const ov = 0.6;
  const yR = roof(mb, { W, D, H, pitch: V.pitch, ov, ridgeX: V.ridgeX, hip: V.hip, mat: R() < 0.7 ? ROOF_A : ROOF_B, color: [0.92 + R() * 0.14, 0.9 + R() * 0.12, 0.88 + R() * 0.1], inst });
  soffit(mb, W, D, H, ov, V.pitch, inst);
  if (V.chimney) chimney(mb, (R() < 0.5 ? -1 : 1) * hw * 0.55, (V.ridgeX ? 0 : hd * 0.4), H + (V.ridgeX ? V.pitch * hd * 0.5 : 0.8), 1.6 + R() * 0.6, inst);
  // front features
  if (V.balcony && F >= 2) {
    const cu = frontOps.filter(o => o.kind === 'window' && o.v0 > floorH - 0.2 && o.v0 < floorH + 1.4)[0];
    if (cu) balcony(mb, -hw + cu.u0 - 0.5, -hw + cu.u1 + 0.5, floorH + 0.05, hd, 1.0, inst);
  }
  if (V.awning) {
    const w0 = frontOps.filter(o => o.kind === 'window' && o.v0 < floorH - 0.5)[0];
    if (w0) awning(mb, -hw + w0.u0 - 0.25, -hw + w0.u1 + 0.25, 2.55, hd, inst, [0.92, 0.9, 0.85], SHUTTER_COLS[(R() * 6) | 0]);
  }
  if (V.flower) for (const o of frontOps) if (o.kind === 'window' && o.v0 < floorH + 1.5 && R() < 0.7) flowerBox(mb, -hw + o.u0 - 0.05, -hw + o.u1 + 0.05, o.v0 - 0.08, hd, inst, R);
  // door step
  mb.quad([-hw + doorU - 0.8, 0.0, hd + 0.5], [-hw + doorU + 0.8, 0.0, hd + 0.5], [-hw + doorU + 0.8, 0.0, hd], [-hw + doorU - 0.8, 0.0, hd], { mat: STONE2, color: [0.9, 0.86, 0.8], inst });
  mb.quad([-hw + doorU - 0.8, -0.2, hd + 0.5], [-hw + doorU + 0.8, -0.2, hd + 0.5], [-hw + doorU + 0.8, 0.0, hd + 0.5], [-hw + doorU - 0.8, 0.0, hd + 0.5], { mat: STONE2, color: [0.82, 0.78, 0.72], inst });
  const geo = mb.toGeometry();
  geo.userData = { W, D, H, yR, tris: mb.triangles, doorU };
  return geo;
}

// ------------------------------------------------------------------------------------------------ landmarks
export function buildChurch(seed = 5) {
  const R = rng(seed), mb = new MeshBuilder(), inst = [0, 0, 0, 0];
  const NW = 9.0, NL = 17.0, NH = 9.5;            // nave: x width, z length (door at +z)
  const hw = NW / 2, hl = NL / 2;
  const white = [1, 0.97, 0.92];
  facade(mb, { o: [-hw, 0, hl], n: [0, 0, 1], width: NW, height: NH, openings: [{ u0: NW / 2 - 1.1, u1: NW / 2 + 1.1, v0: 0.1, v1: 4.0, kind: 'door', doorColor: [0.3, 0.2, 0.13], frame: [0.9, 0.85, 0.75] }, { u0: NW / 2 - 0.55, u1: NW / 2 + 0.55, v0: 6.0, v1: 7.6, kind: 'window', frame: [0.9, 0.85, 0.75] }], mat: -1, baseMat: STONE, baseH: 1.0, color: white });
  facade(mb, { o: [hw, 0, -hl], n: [0, 0, -1], width: NW, height: NH, openings: [], mat: -1, baseMat: STONE, baseH: 1.0, color: white });
  const sideOps = []; for (let k = 0; k < 4; k++) sideOps.push({ u0: 2.6 + k * 3.4, u1: 3.6 + k * 3.4, v0: 3.2, v1: 6.2, kind: 'window', frame: [0.9, 0.85, 0.75] });
  facade(mb, { o: [hw, 0, hl], n: [1, 0, 0], width: NL, height: NH, openings: sideOps, mat: -1, baseMat: STONE, baseH: 1.0, color: white });
  facade(mb, { o: [-hw, 0, -hl], n: [-1, 0, 0], width: NL, height: NH, openings: sideOps, mat: -1, baseMat: STONE, baseH: 1.0, color: white });
  // nave roof (gable along z): reuse roof() by swapping axes -> build manually
  const yE = NH - 0.4, yR = NH + hw * 0.48;
  const hwO = hw + 0.5, hlO = hl + 0.5;
  mb.quad([-hwO, yE, hlO], [-hwO, yE, -hlO], [0, yR, -hlO], [0, yR, hlO], { mat: ROOF_A, color: [0.95, 0.92, 0.9], inst });
  mb.quad([hwO, yE, -hlO], [hwO, yE, hlO], [0, yR, hlO], [0, yR, -hlO], { mat: ROOF_A, color: [0.95, 0.92, 0.9], inst });
  mb.tri([-hw, NH, hl], [hw, NH, hl], [0, yR - 0.05, hl], { mat: -1, color: white, inst, uvs: [[0, 0], [NW, 0], [NW / 2, hw * 0.48]] });
  // bell tower, attached at the front-left corner: 5.2 x 5.2 base
  const tx = -hw - 2.0, tz = hl - 2.6, TS = 5.2, TH = 21.0;
  const tw = TS / 2;
  const stage = (y0, y1, ops, col, mat) => {
    for (const [o, n] of [[[tx - tw, y0, tz + tw], [0, 0, 1]], [[tx + tw, y0, tz - tw], [0, 0, -1]], [[tx + tw, y0, tz + tw], [1, 0, 0]], [[tx - tw, y0, tz - tw], [-1, 0, 0]]])
      facade(mb, { o, n, width: TS, height: y1 - y0, openings: ops, mat, baseMat: STONE, baseH: y0 < 1 ? 1.6 : 0, color: col });
  };
  stage(-0.5, 9.0, [], white, -1);
  stage(9.0, 15.5, [{ u0: TS / 2 - 0.5, u1: TS / 2 + 0.5, v0: 2.2, v1: 5.2, kind: 'window', frame: [0.9, 0.85, 0.75] }], white, -1);
  stage(15.5, TH, [{ u0: TS / 2 - 0.65, u1: TS / 2 + 0.65, v0: 0.6, v1: 4.2, kind: 'window', frame: [0.9, 0.85, 0.75] }], [1, 0.95, 0.88], -1);
  // cornice + pyramid spire (tiled)
  for (const [o, n] of [[[tx - tw - 0.3, TH, tz + tw + 0.3], [0, 0, 1]], [[tx + tw + 0.3, TH, tz - tw - 0.3], [0, 0, -1]], [[tx + tw + 0.3, TH, tz + tw + 0.3], [1, 0, 0]], [[tx - tw - 0.3, TH, tz - tw - 0.3], [-1, 0, 0]]]) {
    const u = cross([0, 1, 0], n); const P = (a, b, d) => [o[0] + u[0] * a + n[0] * d, o[1] + b, o[2] + u[2] * a + n[2] * d];
    mb.quad(P(0, 0, 0), P(TS + 0.6, 0, 0), P(TS + 0.6, 0.35, 0), P(0, 0.35, 0), { mat: STONE2, color: [0.9, 0.86, 0.8], inst });
  }
  const sp = TH + 9.0;
  const c = [[tx - tw - 0.2, tz - tw - 0.2], [tx + tw + 0.2, tz - tw - 0.2], [tx + tw + 0.2, tz + tw + 0.2], [tx - tw - 0.2, tz + tw + 0.2]];
  for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; mb.tri([b[0], TH + 0.35, b[1]], [a[0], TH + 0.35, a[1]], [tx, sp, tz], { mat: ROOF_B, color: [0.95, 0.9, 0.88], inst, uvs: [[0, 0], [5.4, 0], [2.7, 9.4]] }); }
  // cross on the spire
  mb.cylinder(tx, tz, sp, sp + 2.0, 0.07, 0.07, 6, { color: [0.2, 0.2, 0.22] }); mb.cylinder(tx, tz, sp + 1.3, sp + 1.38, 0.5, 0.5, 6, { color: [0.2, 0.2, 0.22] });
  const geo = mb.toGeometry(); geo.userData = { W: NW + 4, D: NL, H: sp + 2, tris: mb.triangles, towerX: tx, towerZ: tz };
  return geo;
}

export function buildLighthouse() {
  const mb = new MeshBuilder(), inst = [0, 0, 0, 0];
  const H = 22, r0 = 3.0, r1 = 1.8;
  // tapered tower with red/white bands (stone base)
  const bands = 7;
  for (let k = 0; k < bands; k++) {
    const y0 = (H * k) / bands, y1 = (H * (k + 1)) / bands, ra = r0 + (r1 - r0) * (y0 / H), rb = r0 + (r1 - r0) * (y1 / H);
    mb.cylinder(0, 0, y0, y1, ra, rb, 28, { mat: k < 1 ? STONE : -1, color: k % 2 ? [0.78, 0.12, 0.1] : [0.97, 0.95, 0.9], cap: false, uvScale: 1 });
  }
  mb.cylinder(0, 0, H, H + 0.4, 2.6, 2.6, 28, { mat: CONC, color: [0.5, 0.5, 0.52] });         // gallery slab
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; mb.cylinder(Math.cos(a) * 2.5, Math.sin(a) * 2.5, H + 0.4, H + 1.4, 0.035, 0.035, 5, { color: [0.15, 0.15, 0.16], cap: false }); }
  mb.cylinder(0, 0, H + 1.4, H + 1.5, 2.56, 2.56, 28, { color: [0.15, 0.15, 0.16] });
  mb.cylinder(0, 0, H + 0.4, H + 3.8, 1.35, 1.25, 20, { mat: -1, color: [0.1, 0.14, 0.17], cap: false });  // lantern glass drum (dark)
  mb.cylinder(0, 0, H + 3.8, H + 5.4, 1.6, 0.12, 20, { mat: -1, color: [0.78, 0.12, 0.1] });            // cap
  mb.cylinder(0, 0, H + 5.4, H + 6.2, 0.08, 0.08, 6, { color: [0.2, 0.2, 0.22] });
  const geo = mb.toGeometry(); geo.userData = { H: H + 6.2, tris: mb.triangles };
  return geo;
}

// ------------------------------------------------------------------------------------------------ placement
/** place houses along the village street (zone Z3) and a few elsewhere; returns [{variant,x,y,z,yaw,plaster,tint,hw,hd,r,...}] and fills `blocked` */
export function placeHouses(world, blocked, seed = 9) {
  const T = world.track, R = rng(seed * 313 + 5), out = [];
  const SH = 3.0;
  const placedOBB = [];
  const overlaps = (x, z, yaw, hw, hd) => {
    // simple circle + OBB test against previously placed houses
    for (const o of placedOBB) {
      const dx = o.x - x, dz = o.z - z; if (dx * dx + dz * dz > (o.r + Math.hypot(hw, hd) + 1.2) ** 2) continue;
      if (obbOverlap({ x, z, hw: hw + 1.0, hd: hd + 1.0, rot: yaw }, { x: o.x, z: o.z, hw: o.hw + 1.0, hd: o.hd + 1.0, rot: o.rot })) return true;
    }
    return false;
  };
  const tp = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
  const sizes = [[9.6, 7.2], [6.4, 8.4], [8.2, 8.2], [11.2, 6.8], [7.4, 7.0], [12.6, 6.4], [6.0, 5.6], [11.8, 8.6]];
  const tryHouse = (i, side, extra, variant, slopeMax = 0.09) => {
    const [W, D] = sizes[variant], half = T.w[i] * 0.5;
    const rad = Math.hypot(W / 2, D / 2);
    // front faces the road: centre at lateral = edge + 3 + front half depth + extra
    const lat = side * (half + SH + 1.4 + D / 2 + extra);
    const p = T.roadPoint(i, lat, 0);
    // facade (+z local) must face the road centre line: yaw so that +z points toward the track
    const dirx = T.rx[i] * -side, dirz = T.rz[i] * -side;            // from house to the road (horizontal)
    const yaw = Math.atan2(dirx, dirz);
    const hwx = W / 2, hdz = D / 2;
    // footprint corners on terrain for slope check
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let ymin = 1e9, ymax = -1e9;
    for (const [ax, az] of [[-hwx, -hdz], [hwx, -hdz], [hwx, hdz], [-hwx, hdz], [0, 0]]) {
      const x = p.x + ax * c + az * s, z = p.z - ax * s + az * c;
      const y = world.terrain.sample(x, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    }
    if (ymax - ymin > slopeMax * Math.max(W, D) + 0.2) return null;
    if (ymin < 3.4) return null;
    // keep the whole footprint (incl. eave overhang) outside the exclusion strip
    const q = T.nearest(p.x, p.z, 120, -1, tp);
    if (Math.abs(q.lat) - rad - 0.9 < half + SH) {
      // oriented footprint check against the strip: each corner must lie beyond the strip
      let ok = true;
      for (const [ax, az] of [[-hwx - 0.7, -hdz - 0.7], [hwx + 0.7, -hdz - 0.7], [hwx + 0.7, hdz + 0.7], [-hwx - 0.7, hdz + 0.7]]) {
        const x = p.x + ax * c + az * s, z = p.z - ax * s + az * c;
        const qq = T.nearest(x, z, 120, -1, tp); if (Math.abs(qq.lat) < T.w[qq.i] * 0.5 + SH + 0.2) { ok = false; break; }
      }
      if (!ok) return null;
    }
    if (overlaps(p.x, p.z, yaw, hwx, hdz)) return null;
    const baseY = world.terrain.sample(p.x, p.z);
    const plaster = R() < 0.45 ? 0 : (1 + ((R() * 3) | 0));
    const hues = [[1, 1, 1], [1.05, 0.93, 0.8], [1.0, 0.82, 0.78], [0.82, 0.9, 1.0], [1.05, 1.0, 0.78], [0.95, 0.85, 0.7]];
    const h = { variant, x: p.x, z: p.z, y: baseY, yaw, plaster, tint: hues[(R() * hues.length) | 0], hw: hwx, hd: hdz, rot: yaw, r: rad, kind: 'house', baseY, W, D };
    placedOBB.push({ x: p.x, z: p.z, hw: hwx + 0.7, hd: hdz + 0.7, rot: yaw, r: rad });
    blocked.add(p.x, p.z, rad + 1.0, h);
    out.push(h);
    return h;
  };
  // ---- the village street
  const z3 = world.json.zones.find(z => z.id === 'Z3');
  for (const side of [-1, 1]) {
    let s = z3.s0 + 12 + R() * 6;
    while (s < z3.s1 - 14) {
      const i = T.indexAtS(s);
      const v = (R() * 8) | 0;
      const extra = R() * 3.5 + (R() < 0.18 ? 6 : 0);
      const h = tryHouse(i, side, extra, v);
      if (h) s += h.W + 1.2 + R() * 3.0; else s += 3.5;
    }
  }
  // second row behind the first, more irregular, so the village feels dense
  for (const side of [-1, 1]) {
    let s = z3.s0 + 30 + R() * 10;
    while (s < z3.s1 - 20) {
      const i = T.indexAtS(s);
      const h = tryHouse(i, side, 14 + R() * 10, (R() * 8) | 0);
      s += (h ? h.W : 0) + 6 + R() * 8;
    }
  }
  // ---- a few seaside/farm buildings elsewhere (beach bars, farmhouses)
  const z1 = world.json.zones.find(z => z.id === 'Z1');
  for (let s = 40; s < 900; s += 60 + R() * 60) { const i = T.indexAtS(s); const h = tryHouse(i, 1, 4 + R() * 22, [6, 0, 2, 5][(R() * 4) | 0], 0.12); if (h) h.isBeach = true; }
  const z4 = world.json.zones.find(z => z.id === 'Z4');
  for (let s = z4.s0 + 40; s < z4.s1 - 60; s += 90 + R() * 80) { const i = T.indexAtS(s); tryHouse(i, R() < 0.5 ? -1 : 1, 18 + R() * 30, [6, 2, 0][(R() * 3) | 0], 0.12); }
  world.stats.houses = out.length;
  return out;
}

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
