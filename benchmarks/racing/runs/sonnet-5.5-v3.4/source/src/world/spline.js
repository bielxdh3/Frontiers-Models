// Closed centripetal Catmull-Rom spline through N-dimensional control points (Barry-Goldman form).
// The first 3 components are x,y,z (used for knot spacing); extra components (width, bank) ride along.
export class ClosedSpline {
  /** @param {number[][]} pts control points [x,y,z,...extra] ; @param {number} alpha 0.5 = centripetal */
  constructor(pts, alpha = 0.5) {
    this.pts = pts;
    this.n = pts.length;
    this.dim = pts[0].length;
    this.alpha = alpha;
    this.knots = []; // per segment: [t0,t1,t2,t3]
    for (let i = 0; i < this.n; i++) {
      const p0 = pts[(i - 1 + this.n) % this.n], p1 = pts[i], p2 = pts[(i + 1) % this.n], p3 = pts[(i + 2) % this.n];
      const d = (a, b) => Math.pow(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) + 1e-9, alpha);
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      this.knots.push([t0, t1, t2, t3]);
    }
  }
  /** evaluate segment i (from pts[i] to pts[i+1]) at u in [0,1]; writes into out (length dim) */
  eval(i, u, out = new Array(this.dim)) {
    const n = this.n, P = this.pts;
    const p0 = P[(i - 1 + n) % n], p1 = P[i % n], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const [t0, t1, t2, t3] = this.knots[i % n];
    const t = t1 + (t2 - t1) * u;
    const k01 = (t1 - t0) || 1e-9, k12 = (t2 - t1) || 1e-9, k23 = (t3 - t2) || 1e-9;
    const k02 = (t2 - t0) || 1e-9, k13 = (t3 - t1) || 1e-9;
    for (let c = 0; c < this.dim; c++) {
      const a1 = ((t1 - t) * p0[c] + (t - t0) * p1[c]) / k01;
      const a2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / k12;
      const a3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / k23;
      const b1 = ((t2 - t) * a1 + (t - t0) * a2) / k02;
      const b2 = ((t3 - t) * a2 + (t - t1) * a3) / k13;
      out[c] = ((t2 - t) * b1 + (t - t1) * b2) / k12;
    }
    return out;
  }
  /**
   * Re-parameterise by arc length: returns { length, samples:[{seg,u,s}] } with `count` uniform samples.
   * Fine pre-sampling (sub per segment) gives the cumulative length table.
   */
  resample(spacing = 1.0, sub = 32) {
    const tmpA = new Array(this.dim), tmpB = new Array(this.dim);
    const table = []; // {seg,u,s}
    let s = 0;
    let prev = this.eval(0, 0, tmpA).slice(0, 3);
    table.push({ seg: 0, u: 0, s: 0 });
    for (let i = 0; i < this.n; i++) {
      for (let k = 1; k <= sub; k++) {
        const u = k / sub;
        const q = this.eval(i, u, tmpB);
        s += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
        prev = [q[0], q[1], q[2]];
        table.push({ seg: i, u, s });
      }
    }
    const length = s;
    const count = Math.max(8, Math.round(length / spacing));
    const ds = length / count;
    const out = [];
    let j = 0;
    for (let m = 0; m < count; m++) {
      const target = m * ds;
      while (j < table.length - 2 && table[j + 1].s <= target) j++;
      const a = table[j], b = table[j + 1];
      const f = (target - a.s) / ((b.s - a.s) || 1e-9);
      // a and b may sit on different segments (u=1 of seg i == u=0 of seg i+1)
      let seg = a.seg, u = a.u;
      if (b.seg === a.seg) u = a.u + (b.u - a.u) * f;
      else { // a.u == 1 (end of seg) -> start of next segment
        seg = b.seg; u = b.u * f;
      }
      out.push({ seg, u, s: target });
    }
    return { length, count, ds, samples: out };
  }
}
