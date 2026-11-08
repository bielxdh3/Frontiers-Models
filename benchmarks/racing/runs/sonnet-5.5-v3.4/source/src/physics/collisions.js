// Collisions: car vs barrier (walls derived from the track spline sections) and car vs car (2D OBB + impulse).
// Barriers come from track.json sections (barL/barR + lateral offsets), so they follow the road exactly.
import { BARRIER } from '../world/track.js';

const RESTITUTION_WALL = 0.2, FRICTION_WALL = 0.32;
const RESTITUTION_CAR = 0.22, FRICTION_CAR = 0.3;

export class Collisions {
  constructor(track) {
    this.T = track;
    this._q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
    this._pt = [0, 0, 0]; this._vp = [0, 0, 0];
  }

  /** barrier collisions for one car. Returns max penetration found (m). */
  barriers(car, dt) {
    const T = this.T, q = this._q, pt = this._pt, vp = this._vp, s = car.spec;
    let maxPen = 0;
    const hw = s.width * 0.5, hl = s.length * 0.5, zc = (car.zF + car.zR) * 0.5;
    const yl = -s.cgH + 0.55;
    // 8 points: corners + mid-sides
    const pts = [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl], [-hw, 0], [hw, 0], [0, -hl], [0, hl]];
    for (let k = 0; k < pts.length; k++) {
      car.local(pts[k][0], yl, zc + pts[k][1], pt);
      T.nearest(pt[0], pt[2], 80, car.hint >= 0 ? car.hint : -1, q);
      const i = q.i, side = q.lat < 0 ? -1 : 1;
      const type = side < 0 ? T.barL[i] : T.barR[i];
      if (!type) continue;
      const off = side < 0 ? T.barOffL[i] : T.barOffR[i];
      const pen = Math.abs(q.lat) - off;
      if (pen <= 0) continue;
      if (pen > 6) continue;           // far beyond any wall: not a wall contact (fell off / different road piece)
      // inward normal (horizontal, towards the road centre)
      const nx = -side * T.rx[i], nz = -side * T.rz[i];
      car.velocityAt(pt, vp);
      const vn = vp[0] * nx + vp[2] * nz;
      maxPen = Math.max(maxPen, pen);
      // position correction (applied once after the loop for the deepest point)
      if (pen > 0.001) { car.p[0] += nx * pen * 0.55; car.p[2] += nz * pen * 0.55; }
      if (vn < 0) {
        const im = car.invMassAlong(nx, 0, nz, pt);
        const J = -(1 + RESTITUTION_WALL) * vn / im;
        car.applyImpulse(nx * J, 0, nz * J, pt);
        // friction along the wall
        const tx = vp[0] - vn * nx, ty = vp[1], tz = vp[2] - vn * nz;
        const tl = Math.hypot(tx, ty, tz);
        if (tl > 0.01) {
          const ux = tx / tl, uy = ty / tl, uz = tz / tl;
          const imt = car.invMassAlong(ux, uy, uz, pt);
          const Jt = Math.min(tl / imt, FRICTION_WALL * J);
          car.applyImpulse(-ux * Jt, -uy * Jt, -uz * Jt, pt);
        }
        car.ev.impact = Math.max(car.ev.impact, Math.min(1, -vn / 14));
        car.ev.bodyHit = 1;
      }
      car.ev.scrape = Math.max(car.ev.scrape, Math.min(1, (Math.hypot(vp[0], vp[2]) - Math.abs(vn)) / 30 + 0.15));
    }
    return maxPen;
  }

  /** car vs car, all pairs close enough */
  cars(list) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) this._pair(list[a], list[b]);
    }
  }

  _box(car) {
    const s = car.spec, ax = car.ax;
    let fx = -ax[6], fz = -ax[8];
    let l = Math.hypot(fx, fz); fx /= l; fz /= l;
    const zc = (car.zF + car.zR) * 0.5;
    const c = [0, 0, 0]; car.local(0, 0, zc, c);
    return { cx: c[0], cz: c[2], cy: c[1], fx, fz, rx: -fz, rz: fx, hw: s.width * 0.5, hl: s.length * 0.5 };
  }

  _pair(A, B) {
    const dx = B.p[0] - A.p[0], dz = B.p[2] - A.p[2];
    if (dx * dx + dz * dz > 36) return;
    if (Math.abs(B.p[1] - A.p[1]) > 1.6) return;
    const a = this._box(A), b = this._box(B);
    const axes = [[a.fx, a.fz], [a.rx, a.rz], [b.fx, b.fz], [b.rx, b.rz]];
    let minPen = Infinity, nx = 0, nz = 0;
    const cdx = b.cx - a.cx, cdz = b.cz - a.cz;
    for (let k = 0; k < 4; k++) {
      const [ux, uz] = axes[k];
      const ra = a.hl * Math.abs(ux * a.fx + uz * a.fz) + a.hw * Math.abs(ux * a.rx + uz * a.rz);
      const rb = b.hl * Math.abs(ux * b.fx + uz * b.fz) + b.hw * Math.abs(ux * b.rx + uz * b.rz);
      let d = cdx * ux + cdz * uz;
      const pen = ra + rb - Math.abs(d);
      if (pen <= 0) return;
      if (pen < minPen) { minPen = pen; const sg = d < 0 ? -1 : 1; nx = ux * sg; nz = uz * sg; }
    }
    // contact point: midpoint between the deepest corners along the normal
    const cornersOf = (o) => [[o.hl, o.hw], [o.hl, -o.hw], [-o.hl, o.hw], [-o.hl, -o.hw]].map(([l, w]) => [o.cx + o.fx * l + o.rx * w, o.cz + o.fz * l + o.rz * w]);
    const ca = cornersOf(a), cb = cornersOf(b);
    let pa = ca[0], pb = cb[0], ma = -Infinity, mb = Infinity;
    for (const c of ca) { const d = c[0] * nx + c[1] * nz; if (d > ma) { ma = d; pa = c; } }
    for (const c of cb) { const d = c[0] * nx + c[1] * nz; if (d < mb) { mb = d; pb = c; } }
    const P = [(pa[0] + pb[0]) * 0.5, (A.p[1] + B.p[1]) * 0.5 - 0.1, (pa[1] + pb[1]) * 0.5];
    const vA = [0, 0, 0], vB = [0, 0, 0];
    A.velocityAt(P, vA); B.velocityAt(P, vB);
    const rvx = vB[0] - vA[0], rvz = vB[2] - vA[2];
    const vn = rvx * nx + rvz * nz;
    // separate (mass equal split)
    const sep = minPen * 0.5 + 0.002;
    A.p[0] -= nx * sep * 0.5; A.p[2] -= nz * sep * 0.5; B.p[0] += nx * sep * 0.5; B.p[2] += nz * sep * 0.5;
    if (vn < 0) {
      const im = A.invMassAlong(nx, 0, nz, P) + B.invMassAlong(nx, 0, nz, P);
      const J = -(1 + RESTITUTION_CAR) * vn / im;
      A.applyImpulse(-nx * J, 0, -nz * J, P);
      B.applyImpulse(nx * J, 0, nz * J, P);
      // friction
      const tx = rvx - vn * nx, tz = rvz - vn * nz, tl = Math.hypot(tx, tz);
      if (tl > 0.02) {
        const ux = tx / tl, uz = tz / tl;
        const imt = A.invMassAlong(ux, 0, uz, P) + B.invMassAlong(ux, 0, uz, P);
        const Jt = Math.min(tl / imt, FRICTION_CAR * J);
        A.applyImpulse(ux * Jt, 0, uz * Jt, P); B.applyImpulse(-ux * Jt, 0, -uz * Jt, P);
      }
      const imp = Math.min(1, -vn / 12);
      A.ev.impact = Math.max(A.ev.impact, imp); B.ev.impact = Math.max(B.ev.impact, imp);
      A.ev.bodyHit = 1; B.ev.bodyHit = 1;
    }
  }
}
