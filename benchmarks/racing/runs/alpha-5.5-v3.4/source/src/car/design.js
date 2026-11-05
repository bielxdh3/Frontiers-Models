// Parametric car body designs as implicit fields (negative inside).
// Model space: ground y = 0, x right (symmetric), z from front (-) to rear (+),
// origin at the middle of the wheelbase.

export function curve(pts) {
  // monotone cubic (Fritsch-Carlson) through [x, y] keypoints; clamped outside
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const sq = (x) => x * x;
const roundBox = (px, py, pz, bx, by, bz, r) => {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
};
const ellipsoid = (px, py, pz, rx, ry, rz) => { const k0 = Math.hypot(px / rx, py / ry, pz / rz); const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz)); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz); };

export const REGION = { PAINT: 0, GLASS: 1, TRIM: 2, PLASTIC: 3, HEAD: 4, TAIL: 5, CHROME: 6, GRILLE: 7 };

export function makeDesign(id) {
  return id === 'hatch' ? hatchDesign() : gtDesign();
}

function gtDesign() {
  const wb = 2.66, rw = 0.345, zF = -wb / 2, zR = wb / 2;
  const nose = -2.31, tail = 2.245;
  const D = { id: 'gt', wb, rw, zF, zR, nose, tail, width: 1.94, height: 1.24, trackF: 1.64, trackR: 1.66 };
  const top = curve([[nose, 0.4], [nose + 0.05, 0.515], [nose + 0.18, 0.575], [-1.9, 0.62], [-1.55, 0.675], [-1.1, 0.75], [-0.62, 0.835], [0.4, 0.9], [1.35, 0.95], [1.85, 0.958], [2.08, 0.99], [2.17, 0.975], [tail, 0.9]]);
  const bottom = curve([[nose, 0.2], [nose + 0.04, 0.12], [-1.9, 0.115], [1.5, 0.12], [1.75, 0.15], [tail - 0.05, 0.3], [tail, 0.36]]);
  const shoulder = curve([[nose, 0.4], [-1.9, 0.53], [-1.3, 0.62], [0, 0.6], [1.3, 0.66], [2.1, 0.68], [tail, 0.66]]);
  const hwz = curve([[nose, 0.62], [-2.15, 0.82], [-1.85, 0.905], [-1.3, 0.935], [-0.7, 0.905], [0.2, 0.905], [0.9, 0.94], [1.35, 0.955], [1.9, 0.92], [2.15, 0.85], [tail, 0.74]]);
  // greenhouse
  const zCowl = -0.6, zRf = 0.06, zRb = 0.5, zRw = 1.47;
  const belt = curve([[zCowl - 0.1, 0.84], [0.2, 0.88], [0.9, 0.915], [zRw, 0.95]]);
  const roof = curve([[zCowl - 0.12, 0.8], [zCowl, 0.85], [-0.35, 1.06], [-0.1, 1.185], [zRf, 1.225], [0.28, 1.24], [zRb, 1.228], [0.85, 1.15], [1.2, 1.04], [zRw, 0.955], [zRw + 0.2, 0.9]]);
  const cabHW = curve([[zCowl, 0.79], [-0.2, 0.775], [0.4, 0.77], [0.9, 0.76], [zRw, 0.7]]);
  const flare = (z, y, ax) => {
    let f = 0;
    f += 0.045 * Math.exp(-(sq((z - zF) / 0.6) + sq((y - 0.56) / 0.3)));
    f += 0.07 * Math.exp(-(sq((z - zR) / 0.62) + sq((y - 0.6) / 0.3)));
    // door sculpting (slight concavity) + side intake
    f -= 0.018 * Math.exp(-(sq((z - 0.15) / 0.55) + sq((y - 0.4) / 0.09)));
    return f;
  };
  D.body = (x, y, z) => {
    const ax = Math.abs(x);
    const yt0 = top(z), yb = bottom(z), ys = shoulder(z);
    let hw = hwz(z) + flare(z, y, ax);
    // fender peaks: hood lower in the middle
    const yt = yt0 - 0.03 * sq(ax / hw) + 0.088 * Math.exp(-sq((ax - 0.8) / 0.28)) * Math.exp(-sq((z - zF) / 0.78)) + 0.03 * Math.exp(-sq((ax - 0.82) / 0.3)) * Math.exp(-sq((z - zR) / 0.7)) - 0.015 * Math.exp(-sq(ax / 0.3)) * Math.exp(-sq((z + 1.4) / 0.6));
    let sh;
    const fw = Math.exp(-sq((z - zF) / 0.72));
    const ysF = ys + 0.05 * fw;
    if (y > ysF) { const pe = 2.6 + 2.4 * fw; const t = Math.min(1.2, (y - ysF) / Math.max(0.05, yt - ysF + 0.04)); sh = Math.pow(Math.max(0, 1 - Math.pow(t, pe)), 1 / pe); }
    else { const t = (ysF - y) / Math.max(0.05, ysF - yb); sh = 1 - 0.07 * t * t; }
    let f = smax(ax - hw * Math.max(0.2, sh), y - yt, 0.05);
    f = smax(f, yb - y, 0.03);
    // ends (plan view rounding)
    const zf = nose + 0.34 * Math.pow(Math.min(1, ax / 0.95), 3.2) + 0.05 * sq(Math.max(0, y - 0.3) / 0.3);
    const zr = tail - 0.24 * Math.pow(Math.min(1, ax / 0.95), 3.4) - 0.04 * sq((y - 0.62) / 0.3);
    f = smax(f, zf - z, 0.06); f = smax(f, z - zr, 0.05);
    // greenhouse
    const yr = roof(z) - 0.05 * sq(ax / 0.75);
    const hc = cabHW(z) - 0.2 * Math.max(0, y - belt(z));
    let c = smax(ax - hc, y - yr, 0.06);
    c = smax(c, (zCowl - 0.15) - z, 0.05); c = smax(c, z - (zRw + 0.25), 0.05);
    c = smax(c, belt(z) - 0.12 - y, 0.02);
    f = smin(f, c, 0.05);
    // mirrors
    const mr = smin(ellipsoid(ax - 0.99, y - 0.965, z + 0.36, 0.105, 0.055, 0.13), roundBox(ax - 0.9, y - 0.93, z + 0.33, 0.07, 0.015, 0.035, 0.012), 0.02);
    f = smin(f, mr, 0.012);
    // front splitter
    f = Math.min(f, roundBox(x, y - 0.118, z - nose - 0.12, 0.74, 0.01, 0.12, 0.008));
    // rear wing + supports
    const wingZ = 1.98, wingY = 1.105;
    const wz = z - wingZ, wy = y - wingY + wz * 0.12;
    const wing = roundBox(x, wy, wz, 0.86, 0.016, 0.155, 0.014);
    const sup = roundBox(ax - 0.52, y - 1.03, z - 2.0, 0.016, 0.08, 0.07, 0.01);
    f = Math.min(f, Math.min(wing, sup));
    // intakes / grille recess
    f = smax(f, -(roundBox(x, y - 0.3, z - nose - 0.02, 0.6, 0.095, 0.1, 0.04)), 0.02);
    f = smax(f, -(roundBox(ax - 0.76, y - 0.32, z - nose - 0.16, 0.11, 0.07, 0.12, 0.03)), 0.015);
    // side air intake ahead of rear wheel
    f = smax(f, -(ellipsoid(ax - 0.99, y - 0.5, z - 0.78, 0.07, 0.08, 0.28)), 0.02);
    // diffuser fins
    for (const fx of [0.22, 0.48]) f = Math.min(f, roundBox(ax - fx, y - 0.22, z - 2.07, 0.01, 0.1, 0.17, 0.006));
    // exhaust openings
    const ex = Math.hypot(ax - 0.4, y - 0.27);
    f = smax(f, -Math.max(ex - 0.05, Math.max(2.0 - z, z - 2.5)), 0.01);
    // wheel arches
    for (const [zw, ra] of [[zF, rw + 0.04], [zR, rw + 0.05]]) {
      const ar = Math.max(Math.hypot(y - rw, z - zw) - ra, 0.55 - ax);
      f = smax(f, -ar, 0.03);
    }
    return f;
  };
  // ---- regions ----
  const zA = (y) => zCowl + 0.1 + ((y - belt(zCowl)) / (1.2 - belt(zCowl))) * (zRf - zCowl);
  const zC = (y) => 0.98 - ((y - 0.9) / 0.33) * 0.55;
  D.glassFn = (x, y, z) => {
    const ax = Math.abs(x);
    const above = y - (belt(z) + 0.035);
    const hc = cabHW(z) - 0.2 * Math.max(0, y - belt(z));
    const ws = Math.min(above, (zRf - 0.06) - z, (hc - 0.085) - ax, z - (zCowl + 0.02));
    const side = Math.min(above, (roof(z) - 0.075) - y, z - zA(y), zC(y) - z, ax - (hc - 0.11));
    const rear = Math.min(above + 0.02, z - (zRb + 0.06), (zRw - 0.06) - z, (hc - 0.13) - ax);
    return Math.max(ws, side, rear);
  };
  D.headFn = (x, y, z) => {
    const ax = Math.abs(x);
    const e = sq((ax - 0.64) / 0.235) + sq((y - 0.585 + (ax - 0.64) * 0.16) / 0.048);
    return Math.min(1 - e, (nose + 0.6) - z) * 0.1;
  };
  D.tailFn = (x, y, z) => {
    const ax = Math.abs(x);
    return Math.min(0.03 - Math.abs(y - 0.86 + 0.03 * sq(ax / 0.85)), 0.88 - ax, z - 1.95);
  };
  D.regionOf = (x, y, z, nx, ny, nz) => {
    const ax = Math.abs(x);
    const g = D.glassFn(x, y, z);
    if (g > 0) return REGION.GLASS;
    if (g > -0.024 && y > belt(z) - 0.01) return REGION.TRIM;
    if (D.headFn(x, y, z) > 0 && z < 0) return REGION.HEAD;
    if (D.tailFn(x, y, z) > 0 && z > 0) return REGION.TAIL;
    // mirror glass
    if (ax > 0.9 && y > 0.92 && y < 1.02 && z > -0.36 && z < -0.2 && nz > 0.55) return REGION.CHROME;
    // exhaust
    if (Math.hypot(ax - 0.4, y - 0.27) < 0.062 && z > 2.0) return REGION.CHROME;
    // grille / intakes
    if (y > 0.17 && y < 0.43 && z < nose + 0.25) return REGION.GRILLE; // front intake band (exact borders)
    if (ax > 0.82 && y > 0.4 && y < 0.6 && z > 0.5 && z < 1.06 && nx * Math.sign(x) < 0.4) return REGION.GRILLE;
    // lower plastics: splitter, skirts, diffuser, wing (carbon), inner arches
    if (y < 0.235 || (z > 1.7 && y < 0.38)) return REGION.PLASTIC;
    if (Math.abs(y - 1.105 + (z - 1.98) * 0.12) < 0.03 && z > 1.8) return REGION.PLASTIC;
    for (const [zw, ra] of [[zF, rw + 0.04], [zR, rw + 0.05]]) {
      const dy = rw - y, dz = zw - z, dd = Math.hypot(dy, dz);
      if (dd < ra + 0.025 && ax > 0.53) return REGION.PLASTIC;
    }
    // intake recesses (inside the cut volumes) are black
    if (roundBox(x, y - 0.3, z - nose - 0.02, 0.61, 0.105, 0.11, 0.04) < 0.006) return REGION.GRILLE;
    if (roundBox(ax - 0.76, y - 0.32, z - nose - 0.16, 0.12, 0.08, 0.13, 0.03) < 0.006) return REGION.GRILLE;
    return REGION.PAINT;
  };
  D.levelSets = [D.glassFn, (x, y, z) => D.glassFn(x, y, z) + 0.024, D.headFn, D.tailFn, (x, y) => 0.235 - y, (x, y) => 0.17 - y,
    (x, y, z) => (rw + 0.065) - Math.hypot(y - rw, z - zF), (x, y, z) => (rw + 0.075) - Math.hypot(y - rw, z - zR),
    // exact region borders (no normal-dependent sawtooth): diffuser box, arch liners, wing strip, belt line
    (x, y, z) => z - 1.7, (x, y) => 0.38 - y, (x) => Math.abs(x) - 0.53, (x, y, z) => z - 1.8, (x, y, z) => 0.03 - Math.abs(y - 1.105 + (z - 1.98) * 0.12),
    (x, y, z) => y - belt(z) + 0.01, (x, y) => 0.43 - y, (x, y, z) => nose + 0.25 - z];
  D.bounds = { min: [-1.14, 0.05, nose - 0.06], max: [1.14, 1.3, tail + 0.08] };
  D.interior = { zSeat: 0.22, ySeat: 0.3, zDash: -0.42, yDash: 0.78, wheelZ: -0.2, wheelY: 0.86, seatX: 0.37, beltY: 0.86 };
  D.lightsPos = { head: [0.64, 0.585, nose + 0.12], tail: [0.6, 0.86, tail - 0.05] };
  D.exhaust = [[0.4, 0.27, tail - 0.02], [-0.4, 0.27, tail - 0.02]];
  D.liveryBounds = { zDoor: 0.1, yDoor: 0.42 };
  return D;
}

function hatchDesign() {
  const wb = 2.58, rw = 0.33, zF = -wb / 2, zR = wb / 2;
  const nose = -2.13, tail = 2.0;
  const D = { id: 'hatch', wb, rw, zF, zR, nose, tail, width: 1.84, height: 1.42, trackF: 1.56, trackR: 1.55 };
  const top = curve([[nose, 0.55], [nose + 0.1, 0.72], [-1.85, 0.8], [-1.4, 0.88], [-0.95, 0.97], [0.5, 1.0], [1.7, 1.02], [1.9, 1.02], [tail, 0.92]]);
  const bottom = curve([[nose, 0.34], [nose + 0.08, 0.15], [-1.8, 0.13], [1.5, 0.14], [1.78, 0.18], [tail, 0.36]]);
  const shoulder = curve([[nose, 0.5], [-1.8, 0.64], [-1.3, 0.7], [0, 0.7], [1.29, 0.74], [tail, 0.78]]);
  const hwz = curve([[nose, 0.66], [-1.95, 0.83], [-1.6, 0.885], [-1.29, 0.905], [-0.6, 0.88], [0.5, 0.88], [1.29, 0.915], [1.75, 0.9], [tail, 0.82]]);
  const zCowl = -0.92, zRf = -0.12, zRb = 1.36, zRw = 1.97;
  const belt = curve([[zCowl - 0.1, 0.97], [0.3, 1.0], [0.95, 1.035], [1.3, 1.1], [zRw, 1.11]]);
  const roof = curve([[zCowl - 0.12, 0.93], [zCowl, 0.98], [-0.6, 1.22], [-0.3, 1.36], [zRf, 1.405], [0.6, 1.42], [1.1, 1.41], [zRb, 1.385], [1.62, 1.3], [1.86, 1.16], [zRw, 1.08], [zRw + 0.12, 1.0]]);
  const cabHW = curve([[zCowl, 0.79], [0, 0.785], [1.0, 0.78], [1.6, 0.76], [zRw, 0.72]]);
  const flare = (z, y) => 0.06 * Math.exp(-(sq((z - zF) / 0.58) + sq((y - 0.6) / 0.3))) + 0.065 * Math.exp(-(sq((z - zR) / 0.58) + sq((y - 0.62) / 0.3))) - 0.014 * Math.exp(-(sq((z - 0.1) / 0.6) + sq((y - 0.48) / 0.09)));
  D.body = (x, y, z) => {
    const ax = Math.abs(x);
    const yt0 = top(z), yb = bottom(z), ys = shoulder(z);
    const hw = hwz(z) + flare(z, y);
    const yt = yt0 - 0.03 * sq(ax / hw) + 0.02 * Math.exp(-sq((ax - 0.68) / 0.16)) * Math.exp(-sq((z + 1.3) / 0.6));
    let sh;
    if (y > ys) { const t = Math.min(1.2, (y - ys) / Math.max(0.05, yt - ys + 0.04)); sh = Math.pow(Math.max(0, 1 - Math.pow(t, 3.2)), 1 / 3.2); }
    else { const t = (ys - y) / Math.max(0.05, ys - yb); sh = 1 - 0.05 * t * t; }
    let f = smax(ax - hw * Math.max(0.2, sh), y - yt, 0.045);
    f = smax(f, yb - y, 0.03);
    const zf = nose + 0.3 * Math.pow(Math.min(1, ax / 0.9), 2.6) + 0.05 * sq((y - 0.45) / 0.3);
    const zr = tail - 0.18 * Math.pow(Math.min(1, ax / 0.9), 3.0) - 0.03 * sq((y - 0.7) / 0.3);
    f = smax(f, zf - z, 0.05); f = smax(f, z - zr, 0.045);
    const yr = roof(z) - 0.045 * sq(ax / 0.78);
    const hc = cabHW(z) - 0.17 * Math.max(0, y - belt(z));
    let c = smax(ax - hc, y - yr, 0.055);
    c = smax(c, (zCowl - 0.15) - z, 0.05); c = smax(c, z - (zRw + 0.08), 0.04);
    c = smax(c, belt(z) - 0.12 - y, 0.02);
    f = smin(f, c, 0.045);
    // roof spoiler
    f = Math.min(f, roundBox(x, y - 1.39 + (z - 1.48) * 0.25, z - 1.5, 0.7, 0.02, 0.15, 0.014));
    // mirrors
    f = smin(f, smin(ellipsoid(ax - 0.93, y - 1.06, z + 0.66, 0.1, 0.06, 0.12), roundBox(ax - 0.85, y - 1.02, z + 0.63, 0.06, 0.015, 0.035, 0.01), 0.02), 0.012);
    // big front intake + fog light pods
    f = smax(f, -(roundBox(x, y - 0.33, z - nose - 0.02, 0.66, 0.12, 0.1, 0.05)), 0.02);
    f = smax(f, -(roundBox(x, y - 0.6, z - nose - 0.05, 0.36, 0.035, 0.1, 0.02)), 0.012);
    // central exhausts
    for (const ex0 of [0.07, -0.07]) { const ex = Math.hypot(x - ex0, y - 0.25); f = smax(f, -Math.max(ex - 0.045, 1.8 - z), 0.008); }
    // diffuser fins
    for (const fx of [0.2, 0.42]) f = Math.min(f, roundBox(ax - fx, y - 0.22, z - 1.86, 0.01, 0.09, 0.14, 0.006));
    for (const [zw, ra] of [[zF, rw + 0.055], [zR, rw + 0.055]]) {
      const ar = Math.max(Math.hypot(y - rw, z - zw) - ra, 0.52 - ax);
      f = smax(f, -ar, 0.03);
    }
    return f;
  };
  const zA = (y) => zCowl + 0.09 + ((y - belt(zCowl)) / (1.4 - belt(zCowl))) * (zRf - zCowl);
  D.glassFn = (x, y, z) => {
    const ax = Math.abs(x);
    const above = y - (belt(z) + 0.035);
    const hc = cabHW(z) - 0.17 * Math.max(0, y - belt(z));
    const ws = Math.min(above, (zRf - 0.06) - z, (hc - 0.08) - ax, z - (zCowl + 0.02));
    // side windows split by a B-pillar
    const sideBase = Math.min(above, (roof(z) - 0.08) - y, z - zA(y), ax - (hc - 0.11));
    const front = Math.min(sideBase, 0.36 - z);
    const back = Math.min(sideBase, z - 0.46, (1.12 - (y - 1.05) * 0.9) - z);
    const rear = Math.min(above + 0.04, z - (zRb + 0.1), (1.84) - z, (hc - 0.12) - ax, y - 1.12);
    return Math.max(ws, front, back, rear);
  };
  D.headFn = (x, y, z) => {
    const ax = Math.abs(x);
    const e = sq((ax - 0.62) / 0.22) + sq((y - 0.75 + (ax - 0.62) * 0.12) / 0.045);
    return Math.min(1 - e, (nose + 0.45) - z) * 0.1;
  };
  D.tailFn = (x, y, z) => {
    const ax = Math.abs(x);
    const e = sq((ax - 0.68) / 0.17) + sq((y - 0.99) / 0.085);
    return Math.min(1 - e, z - 1.7) * 0.1;
  };
  D.regionOf = (x, y, z, nx, ny, nz) => {
    const ax = Math.abs(x);
    const g = D.glassFn(x, y, z);
    if (g > 0) return REGION.GLASS;
    if (g > -0.024 && y > belt(z) - 0.01) return REGION.TRIM;
    if (y > belt(z) + 0.02 && z > -0.15 && z < 1.3 && ax > cabHW(z) - 0.2 && ny < 0.75) return REGION.TRIM; // blacked-out pillars
    if (D.headFn(x, y, z) > 0 && z < 0) return REGION.HEAD;
    if (D.tailFn(x, y, z) > 0 && z > 0) return REGION.TAIL;
    if (ax > 0.84 && y > 1.0 && y < 1.12 && z > -0.66 && z < -0.5 && nz > 0.55) return REGION.CHROME;
    if (Math.hypot(Math.abs(x) - 0.07, y - 0.25) < 0.055 && z > 1.8) return REGION.CHROME;
    if (y > 0.18 && y < 0.47 && z < nose + 0.25) return REGION.GRILLE; // front intake band (exact borders)
    if (y < 0.25 || (z > 1.7 && y < 0.36)) return REGION.PLASTIC;
    if (Math.abs(y - 1.39 + (z - 1.48) * 0.25) < 0.028 && z > 1.36 && z < 1.68) return REGION.PLASTIC;
    for (const zw of [zF, zR]) {
      const ra = rw + 0.055, dy = rw - y, dz = zw - z, dd = Math.hypot(dy, dz);
      if (dd < ra + 0.025 && ax > 0.5) return REGION.PLASTIC;
    }
    if (roundBox(x, y - 0.33, z - nose - 0.02, 0.67, 0.13, 0.11, 0.05) < 0.006) return REGION.GRILLE;
    if (roundBox(x, y - 0.6, z - nose - 0.05, 0.37, 0.045, 0.11, 0.02) < 0.006) return REGION.GRILLE;
    return REGION.PAINT;
  };
  D.levelSets = [D.glassFn, (x, y, z) => D.glassFn(x, y, z) + 0.024, D.headFn, D.tailFn, (x, y) => 0.25 - y, (x, y) => 0.18 - y,
    (x, y, z) => (rw + 0.08) - Math.hypot(y - rw, z - zF), (x, y, z) => (rw + 0.08) - Math.hypot(y - rw, z - zR),
    (x, y, z) => z - 1.7, (x, y) => 0.36 - y, (x) => Math.abs(x) - 0.5, (x, y, z) => 0.028 - Math.abs(y - 1.39 + (z - 1.48) * 0.25), (x, y, z) => z - 1.36, (x, y, z) => 1.68 - z,
    (x, y, z) => y - belt(z) + 0.01, (x, y) => 0.47 - y, (x, y, z) => nose + 0.25 - z];
  D.bounds = { min: [-1.08, 0.05, nose - 0.06], max: [1.08, 1.48, tail + 0.08] };
  D.interior = { zSeat: -0.05, ySeat: 0.34, zDash: -0.7, yDash: 0.92, wheelZ: -0.48, wheelY: 0.98, seatX: 0.36, beltY: 1.0 };
  D.lightsPos = { head: [0.62, 0.75, nose + 0.1], tail: [0.68, 0.99, tail - 0.05] };
  D.exhaust = [[0.07, 0.25, tail - 0.02], [-0.07, 0.25, tail - 0.02]];
  D.liveryBounds = { zDoor: 0.0, yDoor: 0.5 };
  return D;
}
