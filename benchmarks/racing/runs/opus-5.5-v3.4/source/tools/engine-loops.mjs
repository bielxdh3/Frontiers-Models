// Authoring tool: cut seamless engine loops at several RPM bands from real recordings.
// For each band: find where the measured firing frequency reaches the target inside a
// time window, time-warp that window to constant pitch, cut an integer number of
// cycles and crossfade the seam (equal power). Writes 16-bit WAV + manifest.
// Usage: node tools/engine-loops.mjs <pcmDir> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { loadPCM, pitchTrack } from './engine-analyze.mjs';

const [, , pcmDir, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

// band specs: source file, search window [t0,t1] (s), target detected f0 (Hz), label rpm
const CARS = {
  gt: [
    { src: '712593', win: [5.5, 10.5], f: 53, rpm: 850, fmin: 30, fmax: 120 },
    { src: '213665', win: [28.0, 31.8], f: 132, rpm: 3150, fmin: 90, fmax: 330 },
    { src: '213665', win: [57.0, 61.8], f: 170, rpm: 4050, fmin: 90, fmax: 330 },
    { src: '213665', win: [57.0, 61.8], f: 212, rpm: 5050, fmin: 90, fmax: 330 },
    { src: '213665', win: [57.0, 61.8], f: 250, rpm: 5950, fmin: 90, fmax: 330 },
    { src: '213665', win: [1.0, 4.8], f: 290, rpm: 6900, fmin: 90, fmax: 330 },
  ],
  hatch: [
    { src: '141240', win: [26.0, 29.8], f: 25.6, rpm: 800, fmin: 15, fmax: 60 },
    { src: '141240', win: [60.0, 70.0], f: 84, rpm: 2550, fmin: 50, fmax: 200 },
    { src: '141240', win: [33.0, 40.5], f: 118, rpm: 3500, fmin: 60, fmax: 220 },
    { src: '141240', win: [33.0, 40.5], f: 150, rpm: 4450, fmin: 60, fmax: 220 },
    { src: '183654', win: [12.0, 22.6], f: 44, rpm: 5300, fmin: 25, fmax: 90 },
    { src: '183654', win: [12.0, 22.6], f: 51.5, rpm: 6200, fmin: 25, fmax: 90 },
    { src: '183654', win: [12.0, 22.6], f: 59, rpm: 7100, fmin: 25, fmax: 90 },
  ],
};

function median(a) { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }
function writeWav(file, x, sr) {
  const n = x.length; const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

const cache = new Map();
const manifest = {};
for (const [car, bands] of Object.entries(CARS)) {
  manifest[car] = [];
  for (const b of bands) {
    if (!cache.has(b.src)) cache.set(b.src, loadPCM(pcmDir, b.src));
    const { sr, x } = cache.get(b.src);
    const tr = pitchTrack(x.subarray(Math.floor(b.win[0] * sr), Math.floor(b.win[1] * sr)), sr, { fmin: b.fmin, fmax: b.fmax, hop: 256 })
      .map((p) => ({ ...p, t: p.t + b.win[0] }));
    // octave-robust smoothing: fold frequencies to the octave nearest the target
    const fold = tr.map((p) => { let f = p.f; while (f > b.f * 1.41) f /= 2; while (f < b.f / 1.41) f *= 2; return { ...p, f }; });
    const sm = fold.map((p, i) => ({ t: p.t, f: median(fold.slice(Math.max(0, i - 4), i + 5).map((q) => q.f)), c: p.clarity }));
    // best centre: closest to the target with good clarity
    let best = null;
    for (const p of sm) { if (p.c < 0.6) continue; const e = Math.abs(p.f - b.f); if (!best || e < best.e) best = { ...p, e }; }
    if (!best) throw new Error('no match for ' + car + ' ' + b.rpm);
    // window around the centre
    const W = Math.max(0.32, 10 / b.f);
    const t0 = best.t - W * 0.6, t1 = best.t + W * 0.6;
    const seg = sm.filter((p) => p.t >= t0 - 0.05 && p.t <= t1 + 0.05);
    // phase integration: phi(t) on a fine grid
    const N = Math.floor((t1 - t0) * sr);
    const fAt = (t) => { let k = 0; while (k < seg.length - 1 && seg[k + 1].t < t) k++; const a = seg[k], c = seg[Math.min(seg.length - 1, k + 1)]; const u = c.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (c.t - a.t))) : 0; return a.f + (c.f - a.f) * u; };
    const phi = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) phi[i] = phi[i - 1] + fAt(t0 + i / sr) / sr;
    // output: integer number of cycles at constant target pitch
    const ftarget = b.f;
    const cycles = Math.max(4, Math.floor(phi[N] * 0.82));
    const outLen = Math.round((cycles / ftarget) * sr);
    const xf = Math.round(Math.min(0.045 * sr, outLen * 0.25));
    const raw = new Float32Array(outLen + xf);
    let j = 0;
    const s0 = Math.floor(t0 * sr);
    for (let k = 0; k < raw.length; k++) {
      const want = ftarget * (k / sr); // cycles elapsed
      while (j < N - 1 && phi[j + 1] < want) j++;
      const u = (want - phi[j]) / Math.max(1e-9, phi[j + 1] - phi[j]);
      const ti = s0 + j + u;
      const i0 = Math.floor(ti), fr = ti - i0;
      raw[k] = (x[i0] || 0) * (1 - fr) + (x[i0 + 1] || 0) * fr;
    }
    // seamless loop: crossfade the tail (beyond outLen) into the head
    const loop = new Float32Array(outLen);
    for (let k = 0; k < outLen; k++) loop[k] = raw[k];
    for (let k = 0; k < xf; k++) { const a = k / xf; const gIn = Math.sin(a * Math.PI / 2), gOut = Math.cos(a * Math.PI / 2); loop[k] = raw[k] * gIn + raw[outLen + k] * gOut; }
    // remove DC and normalise RMS to -18 dBFS
    let mean = 0; for (const v of loop) mean += v; mean /= loop.length;
    let e = 0; for (let k = 0; k < loop.length; k++) { loop[k] -= mean; e += loop[k] * loop[k]; }
    const rms = Math.sqrt(e / loop.length); const g = 0.126 / Math.max(1e-6, rms);
    let pk = 0; for (let k = 0; k < loop.length; k++) { loop[k] *= g; pk = Math.max(pk, Math.abs(loop[k])); }
    if (pk > 0.95) for (let k = 0; k < loop.length; k++) loop[k] *= 0.95 / pk;
    const name = `${car}_${b.rpm}.wav`;
    writeWav(path.join(outDir, name), loop, sr);
    manifest[car].push({ rpm: b.rpm, file: name, src: b.src, t: +best.t.toFixed(3), f: +best.f.toFixed(2), cycles, seconds: +(outLen / sr).toFixed(3) });
    console.log(car, b.rpm, 'src', b.src, '@', best.t.toFixed(2) + 's', 'f', best.f.toFixed(1), 'cycles', cycles, 'len', (outLen / sr).toFixed(3) + 's');
  }
}
fs.writeFileSync(path.join(outDir, 'engine.json'), JSON.stringify(manifest, null, 1));
