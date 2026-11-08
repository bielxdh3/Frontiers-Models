// Node check of the placed world: validateWorld() + object densities per 100 m (props, houses, vegetation species).
import fs from 'node:fs';
import { createWorld } from '../src/world/world.js';
import { placeHouses } from '../src/render/houses.js';
import { placeVegetation, SpatialHash } from '../src/world/populate.js';
import { placeProps } from '../src/world/props-place.js';
import { validateWorld } from '../src/world/validate.js';
const json = JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url)));
const world = await createWorld({ json });
const T = world.track, blocked = new SpatialHash(6);
world.objects.houses = placeHouses(world, blocked, 9);
const propItems = placeProps(world, blocked, 21);
const veg = placeVegetation(world, blocked, 7);
const r = validateWorld(world);
console.log('validate ok=', r.ok, 'errors=', r.errors.length, JSON.stringify(r.stats));
for (const e of r.errors.slice(0, 15)) console.log('  ', e.code, e.msg);
// props per 100 m (within 50 m of the road, non-vegetation)
const q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 }, L = T.length, bins = new Array(Math.ceil(L / 100)).fill(0);
let near = 0;
for (const o of propItems) { T.nearest(o.x, o.z, 80, -1, q); const d = Math.abs(q.lat) - T.w[q.i] * 0.5; if (d <= 50) { bins[Math.min(bins.length - 1, Math.floor(q.s / 100))]++; near++; } }
console.log('props near road', near, 'per 100 m: min', Math.min(...bins), 'avg', (near / (L / 100)).toFixed(1), 'bins', bins.join(','));
const species = {}; for (const it of veg) species[it.sp] = (species[it.sp] || 0) + 1;
console.log('vegetation species', JSON.stringify(species));
const variants = new Set(world.objects.houses.map((h) => h.variant)); const nearH = world.objects.houses.filter((h) => { T.nearest(h.x, h.z, 80, -1, q); return Math.abs(q.lat) - T.w[q.i] * 0.5 < 30; }).length;
console.log('houses', world.objects.houses.length, 'variants', variants.size, 'within 30 m of the road', nearH);
console.log('props by kind', JSON.stringify(world.stats.props.counts), 'mirante', JSON.stringify(world.stats.mirante));
