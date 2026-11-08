import fs from 'node:fs';
import { createWorld } from '../src/world/world.js';
import { SHOULDER } from '../src/world/track.js';
const json = JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url)));
const world = await createWorld({ json }); const T = world.track, terr = world.terrain, tmp = {x:0,y:0,z:0};
const z2 = json.zones.find(z => z.id === 'Z2'); const out = [];
for (let s = z2.s0 + 20; s < z2.s1 - 20; s += 4) { const i = T.indexAtS(s);
  for (const side of [-1, 1]) for (const d of [8, 12, 16, 22, 30, 40]) {
    T.roadPoint(i, side * (T.w[i] * 0.5 + SHOULDER + d + 6), 0, tmp); const x = tmp.x, z = tmp.z, y0 = terr.sample(x, z);
    let lo = 1e9, hi = -1e9; for (let a = -6; a <= 6; a += 3) for (let b = -4; b <= 4; b += 2) { const h = terr.sample(x + a, z + b); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    out.push({ s, side, d, y0: +y0.toFixed(1), range: +(hi - lo).toFixed(2), road: +tmp.y.toFixed(1) });
  } }
out.sort((a, b) => a.range - b.range); console.log(out.slice(0, 12)); console.log('max y', Math.max(...out.map(o=>o.y0)));
