// Authoring tool: firing-frequency track of engine recordings (normalised autocorrelation).
// Usage: node tools/engine-analyze.mjs <pcmDir> <name> [fmin fmax]
import fs from 'node:fs';
import path from 'node:path';

export function loadPCM(dir, name) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, name + '.json')));
  const b = fs.readFileSync(path.join(dir, name + '.f32'));
  return { sr: meta.sr, x: new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) };
}

export function pitchTrack(x, sr, { fmin = 25, fmax = 450, win = 2048, hop = 512 } = {}) {
  const out = [];
  const lagMin = Math.floor(sr / fmax), lagMax = Math.ceil(sr / fmin);
  // light low-pass by 2-tap average to reduce hiss
  for (let s = 0; s + win + lagMax < x.length; s += hop) {
    let e = 0; for (let i = 0; i < win; i++) e += x[s + i] * x[s + i];
    const rms = Math.sqrt(e / win);
    let best = 0, bestLag = 0;
    const r = new Float32Array(lagMax + 1);
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let acc = 0, e2 = 0;
      for (let i = 0; i < win; i += 2) { acc += x[s + i] * x[s + i + lag]; e2 += x[s + i + lag] * x[s + i + lag]; }
      const v = acc / Math.sqrt((e / 2) * e2 + 1e-12);
      r[lag] = v;
      if (v > best) { best = v; bestLag = lag; }
    }
    // prefer the shortest lag with a peak close to the best (avoid octave errors)
    for (let lag = lagMin + 1; lag < bestLag; lag++) {
      if (r[lag] > 0.9 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { bestLag = lag; break; }
    }
    // parabolic refinement
    let lagF = bestLag;
    if (bestLag > lagMin && bestLag < lagMax) { const a = r[bestLag - 1], b = r[bestLag], c = r[bestLag + 1]; const den = a - 2 * b + c; if (Math.abs(den) > 1e-9) lagF = bestLag + 0.5 * (a - c) / den; }
    out.push({ t: (s + win / 2) / sr, f: sr / lagF, clarity: best, rms });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('engine-analyze.mjs')) {
  const [, , dir, name, fmin = '25', fmax = '450'] = process.argv;
  const { sr, x } = loadPCM(dir, name);
  const tr = pitchTrack(x, sr, { fmin: +fmin, fmax: +fmax });
  // summary per 0.5 s
  const bins = new Map();
  for (const p of tr) { const k = Math.floor(p.t * 2) / 2; let b = bins.get(k); if (!b) { b = []; bins.set(k, b); } b.push(p); }
  for (const [k, ps] of bins) {
    const good = ps.filter((p) => p.clarity > 0.5);
    const fs2 = good.map((p) => p.f).sort((a, b) => a - b);
    const med = fs2.length ? fs2[Math.floor(fs2.length / 2)] : 0;
    const rms = Math.sqrt(ps.reduce((a, p) => a + p.rms * p.rms, 0) / ps.length);
    console.log(k.toFixed(1).padStart(6), 'f0', med.toFixed(1).padStart(6), 'clar', (good.length / ps.length).toFixed(2), 'rms', rms.toFixed(3));
  }
}
