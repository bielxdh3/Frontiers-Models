// Deterministic 2D gradient noise + fbm (seeded permutation). No dependencies.
import { rng } from './util.js';

export function makeNoise(seed = 1) {
  const r = rng(seed * 7919 + 13);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a); gy[i] = Math.sin(a);
  }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const d = (h, dx, dy) => gx[h] * dx + gy[h] * dy;
    const u = fade(xf), v = fade(yf);
    const x1 = d(aa, xf, yf) + u * (d(ba, xf - 1, yf) - d(aa, xf, yf));
    const x2 = d(ab, xf, yf - 1) + u * (d(bb, xf - 1, yf - 1) - d(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.4142; // ~[-1,1]
  }
  function fbm(x, y, oct = 4, lac = 2.03, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) {
      s += a * noise2(x * f + i * 17.3, y * f - i * 9.1);
      n += a; a *= gain; f *= lac;
    }
    return s / n;
  }
  // ridged multifractal-ish noise in [0,1] (for rock strata / crags)
  function ridged(x, y, oct = 4) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) {
      const v = 1 - Math.abs(noise2(x * f + i * 5.7, y * f + i * 3.3));
      s += a * v * v; n += a; a *= 0.5; f *= 2.1;
    }
    return s / n;
  }
  return { noise2, fbm, ridged };
}
