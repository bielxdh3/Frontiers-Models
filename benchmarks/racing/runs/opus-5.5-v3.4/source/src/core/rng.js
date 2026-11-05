// Deterministic random numbers and gradient noise (own implementation).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) { this.next = mulberry32(seed); }
  float() { return this.next(); }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  chance(p) { return this.next() < p; }
  gauss() { let u = 0, v = 0; while (u === 0) u = this.next(); while (v === 0) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  fork(salt) { return new RNG(Math.floor(this.next() * 4294967296) ^ (salt * 2654435761)); }
}

// Hash-based 2D gradient noise (Perlin-style quintic fade), seeded.
export class Noise2D {
  constructor(seed) {
    const r = mulberry32(seed);
    this.perm = new Uint16Array(512);
    const p = new Uint16Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.gx = new Float32Array(256); this.gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; this.gx[i] = Math.cos(a); this.gy[i] = Math.sin(a); }
  }
  noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const P = this.perm;
    const h00 = P[P[X] + Y], h10 = P[P[X + 1] + Y], h01 = P[P[X] + Y + 1], h11 = P[P[X + 1] + Y + 1];
    const d00 = this.gx[h00] * xf + this.gy[h00] * yf;
    const d10 = this.gx[h10] * (xf - 1) + this.gy[h10] * yf;
    const d01 = this.gx[h01] * xf + this.gy[h01] * (yf - 1);
    const d11 = this.gx[h11] * (xf - 1) + this.gy[h11] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = d00 + (d10 - d00) * u, b = d01 + (d11 - d01) * u;
    return (a + (b - a) * v) * 1.4142;
  }
  fbm(x, y, oct = 5, lac = 2.0, gain = 0.5) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * this.noise(x * f + i * 17.13, y * f - i * 9.71); norm += amp; amp *= gain; f *= lac; }
    return s / norm;
  }
  ridged(x, y, oct = 5) {
    let s = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(this.noise(x * f + i * 31.7, y * f + i * 7.3)); s += amp * n * n; amp *= 0.5; f *= 2.03; }
    return s;
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
