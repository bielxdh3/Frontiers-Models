// Node smoke test: build track + terrain, run validateWorld, time the build.
import fs from 'node:fs';
import { TrackData } from '../src/world/track.js';
import { createTerrain } from '../src/world/terrain.js';
import { validateWorld } from '../src/world/validate.js';
const t0 = performance.now();
const T = new TrackData(JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url))));
console.log('track', T.N, 'samples', (performance.now() - t0).toFixed(0), 'ms');
const t1 = performance.now();
const terrain = createTerrain(T, T.json.seed);
terrain.build();
console.log('terrain', terrain.tiles.size, 'tiles', terrain.chunks.length, 'chunks', (performance.now() - t1).toFixed(0), 'ms');
let tris = 0; for (const c of terrain.chunks) tris += c.indices.length / 3;
console.log('terrain triangles', tris);
const t2 = performance.now();
const r = validateWorld({ track: T, terrain, objects: {} });
console.log('validate', (performance.now() - t2).toFixed(0), 'ms', JSON.stringify(r.stats));
console.log('ok', r.ok, 'errors', r.errors.length);
for (const e of r.errors.slice(0, 12)) console.log('  ', e.code, e.msg);
