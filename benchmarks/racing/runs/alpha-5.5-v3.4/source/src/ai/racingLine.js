// Racing line derived from the spline: minimum-curvature lateral offsets
// (elastic band relaxation within the track width), then a speed profile
// from curvature with braking / acceleration passes.

export class RacingLine {
  constructor(track, { margin = 1.5, iterations = 900, mu = 1.15 } = {}) {
    this.track = track;
    const T = track, M = T.M;
    this.M = M; this.ds = T.ds;
    const off = new Float64Array(M);
    const hw = new Float64Array(M);
    for (let i = 0; i < M; i++) hw[i] = T.W[i] / 2;
    const px = (i) => T.px[i] + T.R[i * 3] * off[i];
    const pz = (i) => T.pz[i] + T.R[i * 3 + 2] * off[i];
    const K = 7;
    for (let it = 0; it < iterations; it++) {
      const a = it < iterations * 0.7 ? 0.5 : 0.25;
      for (let i = 0; i < M; i++) {
        const ia = (i - K + M) % M, ib = (i + K) % M;
        const mx = (px(ia) + px(ib)) / 2, mz = (pz(ia) + pz(ib)) / 2;
        const dx = mx - px(i), dz = mz - pz(i);
        const lat = dx * T.R[i * 3] + dz * T.R[i * 3 + 2];
        const lim = hw[i] - margin;
        off[i] = Math.max(-lim, Math.min(lim, off[i] + a * lat));
      }
    }
    // gaussian smoothing of offsets
    const sm = new Float64Array(M); const r = 6;
    for (let i = 0; i < M; i++) { let acc = 0, w = 0; for (let k = -r; k <= r; k++) { const g = Math.exp(-0.5 * (k / 3) ** 2); acc += off[(i + k + M) % M] * g; w += g; } sm[i] = acc / w; }
    for (let i = 0; i < M; i++) { const lim = hw[i] - margin; sm[i] = Math.max(-lim, Math.min(lim, sm[i])); }
    this.off = Float32Array.from(sm);
    // positions & curvature
    this.lx = new Float32Array(M); this.lz = new Float32Array(M); this.ly = new Float32Array(M);
    for (let i = 0; i < M; i++) { this.lx[i] = T.px[i] + T.R[i * 3] * sm[i]; this.lz[i] = T.pz[i] + T.R[i * 3 + 2] * sm[i]; this.ly[i] = T.py[i]; }
    this.kap = new Float32Array(M);
    const S = 6;
    for (let i = 0; i < M; i++) {
      const a = (i - S + M) % M, b = (i + S) % M;
      this.kap[i] = curvature(this.lx[a], this.lz[a], this.lx[i], this.lz[i], this.lx[b], this.lz[b]);
    }
    this.buildSpeed(mu);
  }

  buildSpeed(mu, vmax = 76, aBrake = 9.0, aAccel = 6.5) {
    const M = this.M, ds = this.ds, T = this.track;
    const v = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      let k = 0; for (let j = -3; j <= 3; j++) k = Math.max(k, Math.abs(this.kap[(i + j + M) % M]));
      // downhill/uphill and banking tweaks
      const g = 9.81 * mu * (1 + 0.04 * Math.min(1, v[i] / 60));
      v[i] = Math.min(vmax, Math.sqrt(g / Math.max(1e-5, k)));
    }
    // backward braking pass (2 loops for wrap)
    for (let pass = 0; pass < 2; pass++) for (let i = M - 1; i >= 0; i--) {
      const n = (i + 1) % M;
      const lim = Math.sqrt(v[n] * v[n] + 2 * aBrake * ds);
      if (v[i] > lim) v[i] = lim;
    }
    // forward acceleration pass
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < M; i++) {
      const p = (i - 1 + M) % M;
      const acc = aAccel * Math.max(0.25, 1 - v[p] / 85);
      const lim = Math.sqrt(v[p] * v[p] + 2 * acc * ds);
      if (v[i] > lim) v[i] = lim;
    }
    this.speed = v;
    this.mu = mu;
  }
  idx(s) { return ((Math.round(this.track.wrap(s) / this.ds) % this.M) + this.M) % this.M; }
  offsetAt(s) { const f = this.track.wrap(s) / this.ds; const i = Math.floor(f) % this.M, j = (i + 1) % this.M, t = f - Math.floor(f); return this.off[i] * (1 - t) + this.off[j] * t; }
  speedAt(s) { const f = this.track.wrap(s) / this.ds; const i = Math.floor(f) % this.M, j = (i + 1) % this.M, t = f - Math.floor(f); return this.speed[i] * (1 - t) + this.speed[j] * t; }
  curvatureAt(s) { return this.kap[this.idx(s)]; }
}

function curvature(ax, az, bx, bz, cx, cz) {
  const a = Math.hypot(bx - cx, bz - cz), b = Math.hypot(ax - cx, az - cz), c = Math.hypot(ax - bx, az - bz);
  const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  if (a * b * c < 1e-9) return 0;
  return (2 * cross) / (a * b * c);
}
