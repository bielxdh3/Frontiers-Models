import fs from 'node:fs';
import { createWorld } from '../src/world/world.js';
const json = JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url)));
const world = await createWorld({ json }); const T = world.track, terr = world.terrain, b = json.bridge, tmp = { x: 0, y: 0, z: 0 };
const rows = [];
for (let s = b.s0 - 40; s <= b.s1 + 40; s += 10) { const i = T.indexAtS(s); T.roadPoint(i, 0, 0, tmp); const ry = tmp.y; const ty = terr.sample(tmp.x, tmp.z); T.roadPoint(i, T.w[i] / 2 + 6, 0, tmp); const tyL = terr.sample(tmp.x, tmp.z); T.roadPoint(i, -T.w[i] / 2 - 6, 0, tmp); const tyR = terr.sample(tmp.x, tmp.z); rows.push(`s=${s} road=${ry.toFixed(1)} under=${ty.toFixed(1)} clear=${(ry - ty).toFixed(1)} sideL=${tyL.toFixed(1)} sideR=${tyR.toFixed(1)} w=${T.w[i]}`); }
console.log(rows.join('\n')); console.log(JSON.stringify(b), 'terrain bridge', terr.bridgeS0, terr.bridgeS1);
