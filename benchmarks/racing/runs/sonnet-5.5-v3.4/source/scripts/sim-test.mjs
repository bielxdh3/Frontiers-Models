// Headless physics + AI smoke test: one car, one lap on the autopilot. Prints telemetry and integrity counters.
import fs from 'node:fs';
import { TrackData } from '../src/world/track.js';
import { createTerrain } from '../src/world/terrain.js';
import { Ground } from '../src/physics/ground.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { Collisions } from '../src/physics/collisions.js';
import { CAR_SPECS } from '../src/physics/car-specs.js';
import { RacingLine } from '../src/ai/racingline.js';
import { Driver } from '../src/ai/driver.js';

const carId = process.argv[2] || 'gt';
const laps = +(process.argv[3] || 1);
const T = new TrackData(JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url))));
const terrain = createTerrain(T, T.json.seed); terrain.build();
const ground = new Ground(T, terrain);
const col = new Collisions(T);
const line = new RacingLine(T, { aLat: 7.4, aBrake: 7.2, aAccel: 4.4, vTop: 52 });
console.log('profile lap estimate', line.estimate().toFixed(1), 's');
const car = new Vehicle(CAR_SPECS[carId], ground, 0);
car.reset(T.px[0], T.pz[0], T.heading[0], 0);
const drv = new Driver(line, T, { difficulty: 'hard' });
const dt = 1 / 120;
let t = 0, lastPrint = 0, prevS = 0, lapT = 0, laps_done = 0, maxV = 0, hits = 0, below = 0, minOn = 4, maxLat = 0;
const log = [];
const total = laps * T.length;
let travelled = 0, prevIdx = 0;
while (t < 400 && travelled < total + 5) {
  const inp = drv.update(car, [car], dt);
  car.ev.impact = 0; car.ev.scrape = 0; car.ev.bodyHit = 0;
  car.step(dt, inp);
  const pen = col.barriers(car, dt);
  if (pen > 0.02) hits++;
  if (car.bodyBelow > 0) { below++; }
  t += dt;
  const q = T.nearest(car.p[0], car.p[2], 100, car.hint, { });
  let d = q.s - prevS; if (d < -T.length / 2) d += T.length; if (d > T.length / 2) d -= T.length;
  travelled += d; prevS = q.s;
  maxV = Math.max(maxV, car.speed); maxLat = Math.max(maxLat, Math.abs(car.latG));
  if (car.airborne === 0) minOn = Math.min(minOn, car.onGroundWheels);
  if (t - lastPrint >= 5) {
    lastPrint = t;
    console.log(`t=${t.toFixed(0).padStart(3)} s=${q.s.toFixed(0).padStart(5)} lat=${q.lat.toFixed(1).padStart(5)} v=${(car.speed * 3.6).toFixed(0).padStart(3)}km/h g${car.gear} rpm=${car.rpm.toFixed(0)} latG=${car.latG.toFixed(2)} wheels=${car.onGroundWheels} y=${car.p[1].toFixed(1)}`);
  }
  if (Math.abs(q.lat) > 30 || car.p[1] < -5) { console.log('LEFT THE TRACK at s=', q.s.toFixed(0), 'lat', q.lat.toFixed(1), 'y', car.p[1].toFixed(1)); break; }
}
console.log(`done: simTime=${t.toFixed(1)}s travelled=${travelled.toFixed(0)}m maxV=${(maxV * 3.6).toFixed(0)}km/h wallHits(steps)=${hits} bodyBelow=${below} maxLatG=${maxLat.toFixed(2)} minWheelsOnGround=${minOn}`);
console.log(`avg speed ${(travelled / t * 3.6).toFixed(0)} km/h -> lap ${(T.length / (travelled / t)).toFixed(1)} s`);
