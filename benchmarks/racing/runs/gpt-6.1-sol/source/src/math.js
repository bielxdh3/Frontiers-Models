export const TAU = Math.PI * 2;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mod = (x, m) => ((x % m) + m) % m;
export const angleDelta = (a, b) => mod(b - a + Math.PI, TAU) - Math.PI;
export const smooth = t => (t = clamp(t, 0, 1), t * t * (3 - 2 * t));
export function rng(seed = 1) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
export function timeLabel(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const value = Math.max(0, seconds);
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toFixed(2).padStart(5, '0')}`;
}
export function spline(points, u) {
  const n = points.length, f = mod(u, 1) * n, i = Math.floor(f), t = f - i;
  return [0, 1, 2].map(k => {
    const a = points[mod(i - 1, n)][k], b = points[i][k], c = points[(i + 1) % n][k], d = points[(i + 2) % n][k];
    return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  });
}
export function makeTrack(course) {
  const count = 900, raw = Array.from({ length: count }, (_, i) => spline(course.points, i / count));
  let length = 0;
  const samples = raw.map((v, i) => {
    const next = raw[(i + 1) % count], prev = raw[mod(i - 1, count)];
    const dx = next[0] - prev[0], dz = next[2] - prev[2], norm = Math.hypot(dx, dz);
    const sample = { x: v[0], y: v[1], z: v[2], tx: dx / norm, tz: dz / norm, nx: dz / norm, nz: -dx / norm, s: length, i };
    length += Math.hypot(next[0] - v[0], next[2] - v[2]);
    return sample;
  });
  const at = s => {
    s = mod(s, length);
    let lo = 0, hi = count - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (samples[mid].s <= s) lo = mid; else hi = mid - 1; }
    const a = samples[lo], b = samples[(lo + 1) % count];
    const t = (s - a.s) / ((lo === count - 1 ? length : b.s) - a.s);
    return { ...a, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t), tx: lerp(a.tx, b.tx, t), tz: lerp(a.tz, b.tz, t) };
  };
  const nearest = (x, z, hint) => {
    let best = Infinity, found = 0;
    const start = Number.isInteger(hint) ? hint - 28 : 0, end = Number.isInteger(hint) ? hint + 28 : count - 1;
    for (let j = start; j <= end; j++) {
      const i = mod(j, count), a = samples[i], b = samples[(i + 1) % count];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const px = a.x + dx * t, pz = a.z + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < best) { best = d; found = { ...a, x: px, z: pz, y: lerp(a.y, b.y, t), s: a.s + t * (i === count - 1 ? length - a.s : b.s - a.s), lateral: (x - px) * a.nx + (z - pz) * a.nz }; }
    }
    return found;
  };
  return { ...course, samples, length, at, nearest };
}
