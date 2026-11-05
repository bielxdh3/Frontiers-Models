// Simulation: fixed-timestep physics for all cars, progress tracking,
// runtime invariants (section 3.3) and safety resets.
import * as THREE from 'three';
import { Vehicle, collideCars } from './car/vehicle.js';
import { SURF } from './world/collision.js';

export const FIXED_DT = 1 / 120;

export class Sim {
  constructor(world) {
    this.world = world; this.track = world.track; this.col = world.collision;
    this.cars = []; this.progress = []; this.drivers = [];
    this.time = 0; this.log = []; this.invariantEvents = []; this.eventsThisStep = [];
    this.raceActive = false; this.timeScale = 1;
    this._surf = {};
  }
  clear() { this.cars.length = 0; this.progress.length = 0; this.drivers.length = 0; }
  addCar(spec, id) {
    const car = new Vehicle(spec, id);
    this.cars.push(car);
    this.progress.push({ s: 0, lastValidS: 0, lastValidT: 0, offTrack: 0, stopped: 0, flipped: 0, raceActive: false, resets: 0, onAsphalt: true });
    this.drivers.push(null);
    return car;
  }

  /** place a car on the road surface at (s, lateral d) by raycast, heading along the track */
  placeOnTrack(car, s, d, idx) {
    const T = this.track;
    const p = T.point(s, d);
    const fr = T.frame(s, {});
    const heading = Math.atan2(fr.tz, fr.tx);
    // raycast down from above onto the drivable surface
    const surf = this.col.surface(p[0], p[2], p[1] + 5, this._surf);
    const h = car.spec;
    const staticComp = (h.mass * 9.81 * 0.25) / h.spring;
    const y = surf.y + h.cgHeight + 0.02;
    car.place(p[0], y, p[2], heading);
    // pitch to the road grade
    const pitch = Math.atan2(fr.ty, Math.hypot(fr.tx, fr.tz));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    car.quat.multiply(q); car.prevQuat.copy(car.quat);
    const pr = this.progress[idx ?? this.cars.indexOf(car)];
    if (pr) { pr.s = T.wrap(s); pr.prevS = pr.s; pr.lastValidS = pr.s; pr.offTrack = 0; pr.stopped = 0; pr.flipped = 0; }
    void staticComp;
  }

  resetCar(i, reason) {
    const car = this.cars[i], pr = this.progress[i];
    const s = this.track.wrap(pr.lastValidS - 4);
    const line = this.world.racingLine;
    const d = line ? line.offsetAt(s) * 0.5 : 0;
    this.placeOnTrack(car, s, d, i);
    pr.resets++;
    const ev = { t: +this.time.toFixed(3), car: i, reason, s: +s.toFixed(1) };
    this.log.push(ev);
    if (reason === 'below_terrain' || reason === 'through_collider' || reason === 'fell_out') this.invariantEvents.push(ev);
    if (this.onReset) this.onReset(i, reason);
  }

  step(dt) {
    const cars = this.cars, T = this.track;
    this.time += dt;
    for (let i = 0; i < cars.length; i++) {
      const d = this.drivers[i];
      if (d) d.update(dt, cars, this.progress[i]);
    }
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      c.step(dt, this.col);
      c.collideStatic(this.col, dt);
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collideCars(cars[i], cars[j]);
    // progress + invariants
    for (let i = 0; i < cars.length; i++) this._track(i, dt);
    if (this.onStep) this.onStep(dt);
  }

  _track(i, dt) {
    const car = this.cars[i], pr = this.progress[i], T = this.track;
    const p = car.pos;
    const o = T.projectNear(p.x, p.z, pr.s, 40, _o);
    pr.prevS = pr.s; pr.s = o.s; pr.d = o.d; pr.hw = o.hw;
    pr.dist = (pr.dist || 0) + T.delta(pr.prevS, o.s);
    // --- invariant: body below ground / out of world ---
    const g = this.col.surface(p.x, p.z, p.y + 0.3, this._surf);
    const groundY = this.col.surface(p.x, p.z, p.y + 50, _s2).y;
    if (p.y < -25 || !isFinite(p.y)) { this.resetCar(i, 'fell_out'); return; }
    if (p.y < groundY - 0.05) { this.resetCar(i, 'below_terrain'); return; }
    // --- invariant: passed through a barrier collider ---
    const ids = _ids; this.col.barriers.near(p.x, p.z, 4, ids);
    for (const id of ids) {
      const s = this.col.barriers.segs[id];
      if (segCross(car.prevPos.x, car.prevPos.z, p.x, p.z, s.ax, s.az, s.bx, s.bz)) {
        if (p.y < s.y1 + 0.2) { this.resetCar(i, 'through_collider'); return; }
      }
    }
    // --- validity / safety resets (gameplay) ---
    const onAsphalt = Math.abs(o.d) < o.hw + 0.4;
    const up = car.up(_u);
    pr.onAsphalt = onAsphalt;
    if (onAsphalt && up.y > 0.8 && Math.abs(o.d) < o.hw - 0.5 && car.speed > 3) { pr.lastValidS = o.s; pr.lastValidT = this.time; }
    if (up.y < 0.25) pr.flipped += dt; else pr.flipped = 0;
    if (!onAsphalt) pr.offTrack += dt; else pr.offTrack = 0;
    if (pr.raceActive && car.speed < 1.0) pr.stopped += dt; else pr.stopped = 0;
    if (pr.flipped > 1.5) { this.resetCar(i, 'flipped'); return; }
    if (pr.offTrack > 3.0) { this.resetCar(i, 'off_track'); return; }
    if (pr.stopped > 3.0 && pr.raceActive) { this.resetCar(i, 'stopped'); return; }
    void g;
  }
}
const _o = {}, _s2 = {}, _ids = [];
const _u = new THREE.Vector3();
function segCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  if (d1 * d2 >= 0) return false;
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return d3 * d4 < 0;
}
export { SURF };
