import fs from 'node:fs';
import { createWorld } from '../src/world/world.js';
const json = JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url)));
const w = await createWorld({ json }); const T = w.track;
for (const z of json.zones) { let lo = 1e9, hi = -1e9, sLo = 0, sHi = 0; for (let s = z.s0; s < z.s1; s += T.ds) { const i = T.indexAtS(s % T.length); const y = T.py[i]; if (y < lo) { lo = y; sLo = s; } if (y > hi) { hi = y; sHi = s; } } console.log(z.id, z.name, 'len', Math.round(z.s1 - z.s0), 'm  road y', lo.toFixed(1), '->', hi.toFixed(1), 'gain', (hi - lo).toFixed(1)); }
let lo = 1e9, hi = -1e9; for (let i = 0; i < T.N; i++) { lo = Math.min(lo, T.py[i]); hi = Math.max(hi, T.py[i]); } console.log('lap: length', T.length.toFixed(1), 'min y', lo.toFixed(1), 'max y', hi.toFixed(1));
let hairpins = 0, prev = 0; for (let i = 0; i < T.N; i++) { const k = T.kappa[i]; if (Math.abs(k) > 1 / 45 && Math.sign(k) !== prev) { hairpins++; prev = Math.sign(k); } } console.log('tight-curve sign changes (R<45 m):', hairpins);
