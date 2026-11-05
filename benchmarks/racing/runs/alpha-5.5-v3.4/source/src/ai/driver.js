import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
// AI driver: produces the same inputs a player would (throttle/brake/steer)
// for a Vehicle running the same physics. Follows the racing line with a
// target speed per section, brakes before corners, changes line to overtake
// and avoids obvious collisions. Difficulty scales target speed / aggression.

export const DIFFICULTY = {
  facil: { speed: 0.83, aggression: 0.25, react: 0.55, name: 'Fácil' },
  normal: { speed: 0.91, aggression: 0.55, react: 0.4, name: 'Normal' },
  dificil: { speed: 0.95, aggression: 0.85, react: 0.28, name: 'Difícil' },
};

export class AIDriver {
  constructor(car, world, line, { difficulty = 'normal', skill = 1, seed = 1 } = {}) {
    this.car = car; this.world = world; this.line = line; this.track = world.track;
    this.setDifficulty(difficulty, skill);
    this.lateral = 0; this.lateralTarget = 0; this.overtakeTimer = 0; this.stuck = 0;
    this.sHint = 0; this.phase = seed * 1.7;
    this.prevSteer = 0;
    this.rng = mulberry32(seed * 7919 + 13);
  }
  setDifficulty(d, skill = this.skill || 1) {
    this.diff = DIFFICULTY[d] || DIFFICULTY.normal; this.skill = skill;
  }

  update(dt, cars, progress) {
    const car = this.car, T = this.track, L = this.line;
    const p = car.pos;
    const pr = T.projectNear(p.x, p.z, progress.s, 30, _pr);
    const s = pr.s;
    const v = Math.hypot(car.vel.x, car.vel.z);
    const hw = pr.hw;
    // ---- traffic awareness ----
    let blockAhead = null, blockDist = Infinity;
    const fwd = car.forward(_f);
    for (const o of cars) {
      if (o === car) continue;
      const dx = o.pos.x - p.x, dz = o.pos.z - p.z;
      const along = dx * fwd.x + dz * fwd.z;
      if (along < -3 || along > 34) continue;
      const fr = T.frame(s, _fr);
      const latO = (o.pos.x - fr.x) * fr.rx + (o.pos.z - fr.z) * fr.rz;
      const myLat = pr.d;
      if (Math.abs(latO - myLat) < 2.3 && along > 0 && along < blockDist) { blockAhead = { o, along, latO }; blockDist = along; }
    }
    const lineOff = L.offsetAt(s + 8);
    if (blockAhead) {
      const ov = Math.hypot(blockAhead.o.vel.x, blockAhead.o.vel.z);
      const closing = v - ov;
      if (closing > -0.5 && this.overtakeTimer <= 0 && this.rng() < this.diff.aggression * dt * 6 + (blockDist < 10 ? 0.05 : 0)) {
        // choose side with more room
        const left = blockAhead.latO - 3.1, right = blockAhead.latO + 3.1;
        const lim = hw - 1.4;
        const canL = left > -lim, canR = right < lim;
        let side = 0;
        if (canL && canR) side = Math.abs(left - lineOff) < Math.abs(right - lineOff) ? -1 : 1;
        else if (canL) side = -1; else if (canR) side = 1;
        if (side) { this.lateralTarget = (side < 0 ? left : right) - lineOff; this.overtakeTimer = 3.5 + this.rng() * 1.5; }
      }
    }
    if (this.overtakeTimer > 0) { this.overtakeTimer -= dt; if (this.overtakeTimer <= 0) this.lateralTarget = 0; }
    this.lateral += (this.lateralTarget - this.lateral) * (1 - Math.exp(-dt * 1.4));
    // ---- steering: pure pursuit on racing line (+ lateral offset) ----
    const look = 5.5 + v * 0.42;
    const sa = s + look;
    let offA = L.offsetAt(sa) + this.lateral;
    const hwA = T.halfWidth(sa) - 1.3;
    offA = Math.max(-hwA, Math.min(hwA, offA));
    const tgt = T.point(sa, offA, _pt);
    const dx = tgt[0] - p.x, dz = tgt[2] - p.z;
    const rgt = car.right(_r);
    const latLocal = dx * rgt.x + dz * rgt.z, lonLocal = dx * fwd.x + dz * fwd.z;
    const alpha = Math.atan2(latLocal, Math.max(0.5, lonLocal));
    const wb = car.spec.wheelbase;
    let steerAngle = Math.atan2(2 * wb * Math.sin(alpha), look);
    const steerMax = car.spec.steerMax * (0.22 + 0.78 / (1 + (v / 23) ** 1.6));
    let steer = steerAngle / steerMax;
    // yaw damping (counter-steer when sliding)
    const slipAng = Math.atan2(car.vel.x * rgt.x + car.vel.z * rgt.z, Math.max(2, Math.abs(car.vel.x * fwd.x + car.vel.z * fwd.z)));
    steer += slipAng * 0.9;
    steer = Math.max(-1, Math.min(1, steer));
    this.prevSteer += (steer - this.prevSteer) * (1 - Math.exp(-dt / Math.max(0.03, this.diff.react * 0.12)));
    // ---- speed ----
    const k = this.diff.speed * this.skill;
    let vT = Infinity;
    for (let d = 0; d <= 60 + v * 1.1; d += 4) {
      const vs = L.speedAt(s + d) * k;
      // allowable speed now to reach vs at distance d with braking 8.5 m/s^2
      const vAllow = Math.sqrt(vs * vs + 2 * 8.2 * d);
      if (vAllow < vT) vT = vAllow;
    }
    if (this.overtakeTimer > 0) vT *= 0.985;
    if (blockAhead && blockDist < 9) { const ov = Math.hypot(blockAhead.o.vel.x, blockAhead.o.vel.z); if (Math.abs(this.lateral - this.lateralTarget) > 0.8 || this.lateralTarget === 0) vT = Math.min(vT, ov - 0.5 + blockDist * 0.25); }
    // off the asphalt -> careful
    if (Math.abs(pr.d) > hw) vT = Math.min(vT, 18);
    let thr = 0, brk = 0;
    const err = vT - v;
    if (err > 0) thr = Math.min(1, 0.25 + err * 0.35); else brk = Math.min(1, -err * 0.28);
    if (err < -0.4 && err > -1.2) { thr = 0; brk = 0.05; }
    // traction help on exit
    if (car.slip > 3.5) thr *= 0.6;
    // stuck recovery
    if (v < 1.5 && progress.raceActive) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    const inp = car.input;
    inp.steer = this.prevSteer; inp.throttle = thr; inp.brake = brk; inp.handbrake = 0;
    if (this.stuck > 2.0 && this.stuck < 3.2) { inp.throttle = 0; inp.brake = 1; inp.steer = -inp.steer; } // reverse out
    this.debug = { s, vT, v, offA, lateral: this.lateral };
  }
}
const _pr = {}, _fr = {}, _pt = [0, 0, 0];
const _f = new THREE.Vector3(), _r = new THREE.Vector3();
