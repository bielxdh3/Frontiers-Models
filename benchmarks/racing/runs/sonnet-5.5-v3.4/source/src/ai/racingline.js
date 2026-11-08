// Racing line + speed profile derived from the track spline (TrackData). Pure data, no rendering.
import { SHOULDER } from '../world/track.js';

export class RacingLine {
  /**
   * @param {TrackData} T
   * @param {{aLat:number, aBrake:number, aAccel:number, vTop:number}} p  grip/performance limits used for the speed profile
   */
  constructor(T, p = {}) {
    this.T = T;
    const N = T.N;
    this.off = new Float64Array(N);          // lateral offset (m, + = right) of the line
    this.x = new Float64Array(N); this.z = new Float64Array(N); this.y = new Float64Array(N);
    this.kappa = new Float64Array(N);
    this.v = new Float64Array(N);            // target speed profile (m/s)
    this.buildLine();
    this.buildProfile(p);
  }

  buildLine() {
    const T = this.T, N = T.N;
    const step = 4;                           // relaxation on a decimated set of points
    const M = Math.floor(N / step);
    const idx = Array.from({ length: M }, (_, k) => k * step);
    const off = new Float64Array(M), lim = new Float64Array(M);
    for (let k = 0; k < M; k++) {
      const i = idx[k];
      // keep clear of the edges, tighter where there is a barrier close to the asphalt
      const half = T.w[i] * 0.5;
      lim[k] = Math.max(0.5, half - 2.1);
    }
    const P = (k, o) => { const i = idx[k]; const cb = Math.cos(T.bank[i]); return [T.px[i] + T.rx[i] * cb * o, T.pz[i] + T.rz[i] * cb * o]; };
    for (let it = 0; it < 400; it++) {
      for (let k = 0; k < M; k++) {
        const a = P((k - 1 + M) % M, off[(k - 1 + M) % M]), b = P((k + 1) % M, off[(k + 1) % M]);
        const i = idx[k], cb = Math.cos(T.bank[i]);
        // move towards the midpoint of the neighbours, projected on the normal (right vector)
        const mx = (a[0] + b[0]) * 0.5, mz = (a[1] + b[1]) * 0.5;
        const target = ((mx - T.px[i]) * T.rx[i] + (mz - T.pz[i]) * T.rz[i]) / cb;
        off[k] += (target - off[k]) * 0.6;
        off[k] = Math.max(-lim[k], Math.min(lim[k], off[k]));
      }
    }
    // interpolate to every sample + light smoothing
    for (let i = 0; i < N; i++) {
      const f = i / step, k0 = Math.floor(f) % M, k1 = (k0 + 1) % M, t = f - Math.floor(f);
      this.off[i] = off[k0] + (off[k1] - off[k0]) * t;
    }
    for (let it = 0; it < 6; it++) {
      const c = new Float64Array(this.off);
      for (let i = 0; i < N; i++) this.off[i] = (c[(i - 3 + N) % N] + c[(i - 1 + N) % N] + c[i] * 2 + c[(i + 1) % N] + c[(i + 3) % N]) / 6;
    }
    for (let i = 0; i < N; i++) {
      const cb = Math.cos(T.bank[i]);
      this.x[i] = T.px[i] + T.rx[i] * cb * this.off[i];
      this.z[i] = T.pz[i] + T.rz[i] * cb * this.off[i];
      this.y[i] = T.py[i] - Math.sin(T.bank[i]) * this.off[i];
    }
    // curvature of the line (3 points, 6 m apart), + = right turn
    const h = 3;
    for (let i = 0; i < N; i++) {
      const a = (i - h + N) % N, b = (i + h) % N;
      const ax = this.x[i] - this.x[a], az = this.z[i] - this.z[a], bx = this.x[b] - this.x[i], bz = this.z[b] - this.z[i];
      const cross = ax * bz - az * bx;                 // + = turning towards +x from -z... sign fixed below
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      const ang = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
      this.kappa[i] = ang / ((la + lb) * 0.5);        // + = right turn (clockwise) in x-east / z-south coordinates
    }
    // smooth curvature a little
    for (let it = 0; it < 3; it++) {
      const c = new Float64Array(this.kappa);
      for (let i = 0; i < N; i++) this.kappa[i] = (c[(i - 2 + N) % N] + c[(i - 1 + N) % N] + c[i] + c[(i + 1) % N] + c[(i + 2) % N]) / 5;
    }
  }

  buildProfile({ aLat = 11.0, aBrake = 9.0, aAccel = 6.0, vTop = 62 } = {}) {
    const T = this.T, N = T.N, ds = T.ds;
    const v = this.v;
    for (let i = 0; i < N; i++) {
      const k = Math.abs(this.kappa[i]);
      // bumpy / sloped road: slight grip loss on steep grades
      v[i] = Math.min(vTop, k > 1e-5 ? Math.sqrt(aLat / k) : vTop);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = N * 2 - 1; i >= 0; i--) {          // braking (backward)
        const a = i % N, b = (i + 1) % N;
        v[a] = Math.min(v[a], Math.sqrt(v[b] * v[b] + 2 * aBrake * ds));
      }
      for (let i = 0; i < N * 2; i++) {               // acceleration (forward) with power fall-off
        const a = i % N, b = (i + 1) % N;
        const acc = Math.max(0.6, aAccel * (1 - Math.pow(v[a] / (vTop * 1.08), 2.2)));
        v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * acc * ds));
      }
    }
  }

  /** lap time estimate from the profile (s) */
  estimate() { let t = 0; for (let i = 0; i < this.T.N; i++) t += this.T.ds / Math.max(3, this.v[i]); return t; }
}
