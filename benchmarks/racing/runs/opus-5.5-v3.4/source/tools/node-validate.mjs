// Runs world generation + validateWorld() in Node (no browser) for fast iteration.
import fs from 'node:fs';
import { generateWorld, validateWorld } from '../src/world/world.js';
import { RacingLine } from '../src/ai/racingLine.js';
import { Scatter, scatterZ1, scatterZ2, scatterZ4 } from '../src/world/scatter.js';
import { layoutVillage } from '../src/world/village.js';

const json = JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url)));
const t0 = performance.now();
const world = generateWorld(json, { racingLine: (t) => new RacingLine(t), scatter: (w) => { const S = new Scatter(w); layoutVillage(S); scatterZ1(S); scatterZ2(S); scatterZ4(S); w.scatter = S; } });
const t1 = performance.now();
const res = validateWorld(world);
const t2 = performance.now();
console.log('gen ms', (t1 - t0).toFixed(0), world.timings, 'validate ms', (t2 - t1).toFixed(0));
console.log('length', world.track.length.toFixed(1), 'drivable tris', world.road.drivable.count(), 'barrier runs', world.barriers.runs.length, 'segments', world.barriers.grid.segs.length);
console.log('stats', JSON.stringify(res.stats));
const byCode = {};
for (const e of res.errors) { byCode[e.code] = (byCode[e.code] || 0) + 1; }
console.log('ok', res.ok, 'errors', res.errors.length, byCode);
for (const e of res.errors.slice(0, 25)) console.log('  ', JSON.stringify(e));
const counts = {};
for (const r of world.barriers.runs) counts[r.type] = (counts[r.type] || 0) + (r.i1 - r.i0) * r.step;
console.log('barrier metres', counts);

// placement statistics
const T = world.track;
const near = world.placed.filter((o) => { const p = T.project(o.x, o.z, {}); o._s = p.s; o._d = p.dist - p.hw; return o._d < 50; });
const houses = near.filter((o) => o.kind === 'house' && o._d < 30);
const styles = new Set(houses.map((h) => h.style));
const species = new Set(world.scatter.items.filter((i) => i.cat === 'tree').map((i) => i.type));
const bins = new Array(Math.ceil(T.length / 100)).fill(0);
for (const o of near) if (o.kind === 'prop') bins[Math.min(bins.length - 1, Math.floor(o._s / 100))]++;
console.log('houses<30m', houses.length, 'styles', [...styles].join(','), 'species', [...species].join(','));
console.log('props per 100 m: min', Math.min(...bins), 'avg', (bins.reduce((a, b) => a + b, 0) / bins.length).toFixed(1), 'bins', bins.join(' '));
console.log('total items', world.scatter.items.length, 'by cat', JSON.stringify(world.scatter.items.reduce((a, i) => { a[i.cat] = (a[i.cat] || 0) + 1; return a; }, {})));
