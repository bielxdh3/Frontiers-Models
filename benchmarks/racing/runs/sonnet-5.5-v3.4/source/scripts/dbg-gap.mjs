import fs from 'node:fs';
import { TrackData, SHOULDER } from '../src/world/track.js';
import { createTerrain } from '../src/world/terrain.js';
const T = new TrackData(JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url))));
const terrain = createTerrain(T, T.json.seed); terrain.build();
const tmp = {};
for (const s of [1198, 1206, 1214, 2480]) {
  const i = T.sToIndex(s); const h = T.w[i]/2, c = h + SHOULDER;
  for (const side of [1, -1]) {
    const e = T.roadPoint(i, side*c, 0, {}); const o = T.roadPoint(i, side*(c+0.15), 0, {});
    const info = {}; const ha = terrain.heightAnalytic(o.x, o.z, info);
    console.log(`s=${s} side=${side} roadEdgeY=${e.y.toFixed(3)} terrainGrid=${terrain.sample(o.x,o.z).toFixed(3)} analytic=${ha.toFixed(3)} d=${info.d.toFixed(2)} c=${c.toFixed(2)} cut=${info.cut.toFixed(2)} G=${terrain.lf.G(o.x,o.z).toFixed(2)}`);
  }
}
