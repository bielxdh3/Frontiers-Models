import { CARS, COURSES, RIVALS } from './catalog.js';
import { angleDelta, clamp, lerp, makeTrack, mod, smooth } from './math.js';

export const STEP = 1 / 60;
export const EMPTY_INPUT = Object.freeze({ throttle: 0, brake: 0, steer: 0, nitro: false, drift: false, recover: false });
const round = n => Math.round(n * 1000) / 1000;
export function environmentAt(t, initialWeather = 0, initialDay = 1) {
  const cycle = [0, .38, 1, .55, 0], starts = [0, 1, 2];
  const k = Math.floor(t / 36), blend = smooth((t % 36 - 20) / 16);
  const a = cycle[(starts[initialWeather] + k) % cycle.length], b = cycle[(starts[initialWeather] + k + 1) % cycle.length];
  const cloud = lerp(a, b, blend), wet = clamp((cloud - .25) / .75, 0, 1);
  return { cloud, wet, day: mod([.12, .28, .48, .68][initialDay] + t / 780, 1) };
}
export function createCar(track, modelId, id, name, s, lane, color) {
  const model = CARS.find(c => c.id === modelId) || CARS[0], p = track.at(s);
  return {
    id, name, model: model.id, color: color || model.color,
    x: p.x + p.nx * lane, y: p.y, z: p.z + p.nz * lane,
    heading: Math.atan2(p.tx, p.tz), vx: 0, vz: 0, speed: 0, steer: 0, yaw: 0,
    damage: [0, 0, 0], nitro: 100, boosting: false, drifting: false, ghost: 0, epoch: 0,
    near: p.i, lateral: lane, impactCooldown: 0, impact: 0, wheelSpin: 0,
    p: { unwrapped: s, lastS: mod(s, track.length), passed: 0, lapStart: 0, valid: true, invalidReason: '', laps: [], finishTime: null },
    ai: { lane, targetLane: lane, stuck: 0, decision: 0, recoveryCooldown: 0 }
  };
}
export function progressValue(car, track) {
  if (car.p.finishTime !== null) return track.length * track.laps + 1;
  const gap = track.length / track.gates;
  return car.p.passed * gap + clamp(car.p.unwrapped - car.p.passed * gap, -gap, gap - .001);
}
export function standings(cars, track) {
  return [...cars].sort((a, b) => {
    if (a.p.finishTime !== null && b.p.finishTime !== null) return a.p.finishTime - b.p.finishTime || a.id - b.id;
    if (a.p.finishTime !== null) return -1;
    if (b.p.finishTime !== null) return 1;
    return progressValue(b, track) - progressValue(a, track) || a.id - b.id;
  });
}
export function markInvalid(car, reason) { car.p.valid = false; car.p.invalidReason ||= reason; }
export function advanceProgress(car, track, oldDistance, onGate, elapsed, notify) {
  const p = car.p, spacing = track.length / track.gates, threshold = (p.passed + 1) * spacing;
  if (p.finishTime !== null || !onGate || p.unwrapped <= oldDistance || oldDistance > threshold || p.unwrapped < threshold) return false;
  p.passed++;
  notify?.('gate', car, p.passed);
  if (p.passed % track.gates === 0) {
    p.laps.push({ time: elapsed - p.lapStart, valid: p.valid, reason: p.invalidReason });
    p.lapStart = elapsed; p.valid = true; p.invalidReason = '';
    notify?.('lap', car, p.laps.length);
    if (p.laps.length === track.laps) { p.finishTime = elapsed; notify?.('finish', car, elapsed); }
  }
  return true;
}
export function aiInput(sim, car, overrideDifficulty) {
  if (car.p.finishTime !== null) return { ...EMPTY_INPUT, brake: 1 };
  const diff = overrideDifficulty ?? sim.setup.difficulty, track = sim.track, model = CARS.find(m => m.id === car.model);
  const near = track.nearest(car.x, car.z, car.near);
  const speed = Math.max(0, car.speed), anticipation = [1.0, 1.3, 1.65][diff];
  let curvature = 0;
  for (const distance of [22, 45, 75 * anticipation]) {
    const a = track.at(near.s + distance * .35), b = track.at(near.s + distance);
    curvature = Math.max(curvature, Math.abs(angleDelta(Math.atan2(a.tx, a.tz), Math.atan2(b.tx, b.tz))) / (distance * .65));
  }
  car.ai.decision -= STEP;
  if (car.ai.decision <= 0) {
    car.ai.decision = [1.0, .55, .28][diff];
    car.ai.targetLane = (car.id % 2 ? -1 : 1) * (1.0 + car.id * .15);
    const traffic = sim.cars.filter(other => other !== car && other.p.finishTime === null).map(other => {
      const q = track.nearest(other.x, other.z, other.near);
      return { other, ahead: mod(q.s - near.s + track.length / 2, track.length) - track.length / 2, lane: q.lateral };
    });
    const lead = traffic.find(t => t.ahead > 0 && t.ahead < 32 + speed * .3 && Math.abs(t.lane - car.lateral) < 3.8);
    if (lead) {
      const choices = [-5.2, 5.2].filter(lane => !traffic.some(t => Math.abs(t.ahead) < 16 && Math.abs(t.lane - lane) < 3.8));
      if (choices.length) car.ai.targetLane = choices.sort((a, b) => Math.abs(a - car.lateral) - Math.abs(b - car.lateral))[0];
    } else if (diff > 0) {
      const behind = traffic.find(t => t.ahead < -5 && t.ahead > -20);
      if (behind && curvature < .006) car.ai.targetLane = clamp(behind.lane, -3.5, 3.5);
    }
  }
  car.ai.lane = lerp(car.ai.lane, car.ai.targetLane, STEP * (diff + 1));
  const lookahead = 12 + speed * [.54, .62, .7][diff], target = track.at(near.s + lookahead);
  const error = angleDelta(car.heading, Math.atan2(target.x + target.nx * car.ai.lane - car.x, target.z + target.nz * car.ai.lane - car.z));
  const yawCoefficient = Math.max(.45, speed / 2.7 * model.steer / (1 + speed * .065));
  const wobble = Math.sin(sim.time * (1.4 + car.id * .17) + car.id * 5) * [.08, .025, .008][diff];
  const steer = clamp(error * 2.8 / yawCoefficient + wobble, -1, 1);
  const skill = car.id ? RIVALS[car.id - 1].skill : 1;
  let targetSpeed = Math.min(model.top * [.88, .95, .99][diff], Math.sqrt(([7.0, 9.2, 10.8][diff] * (1 - .28 * sim.env.wet)) / (curvature + .0005))) * skill;
  targetSpeed *= 1 - .12 * sim.env.wet;
  for (const other of sim.cars) {
    if (other === car || other.ghost > 0) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading), side = dx * Math.cos(car.heading) - dz * Math.sin(car.heading);
    if (ahead > 0 && ahead < 11 + speed * .22 && Math.abs(side) < 2.5) targetSpeed = Math.min(targetSpeed, Math.max(6, other.speed - 2));
  }
  const nitro = diff > 0 && curvature < [0, .0018, .0032][diff] && car.nitro > [100, 72, 50][diff] && speed > 25 && speed < targetSpeed + 8 && Math.abs(error) < .13;
  return { throttle: speed < targetSpeed + .6 ? 1 : 0, brake: speed > targetSpeed + 2 ? clamp((speed - targetSpeed) / 6, 0, 1) : 0, steer, drift: false, nitro, recover: car.ai.stuck > 5 && car.ai.recoveryCooldown <= 0 };
}

export class Simulation {
  constructor(setup = {}, source = 'local') {
    this.setup = { course: 'coastal', car: 'tern', weather: 0, daylight: 1, difficulty: 1, ...setup };
    this.track = makeTrack(COURSES.find(c => c.id === this.setup.course) || COURSES[0]);
    this.source = source; this.status = 'countdown'; this.countdown = 3; this.time = 0;
    this.env = environmentAt(0, this.setup.weather, this.setup.daylight);
    this.cars = [createCar(this.track, this.setup.car, 0, 'You', 0, this.track.mode === 'race' ? 3.8 : 0)];
    if (this.track.mode === 'race') RIVALS.forEach((r, i) => this.cars.push(createCar(this.track, r.model, i + 1, r.name, -9 * (Math.floor(i / 2) + 1), r.line, r.color)));
    this.remaining = 22; this.score = 0; this.combo = 1; this.comboAge = 0; this.cleanDistance = 0; this.earnedDistance = 0;
    this.events = []; this.frames = []; this.nextSample = 0; this.result = null; this.lastMessage = ''; this.messageUntil = 0;
    this.startedAt = new Date().toISOString(); this.recoverHeld = false; this.forceSample = false;
  }
  message(text) { this.lastMessage = text; this.messageUntil = this.time + 2.5; }
  event(type, car, value = 0) {
    this.events.push({ t: round(this.time), type, car: car.id, value: round(value) });
    if (type === 'collision' || type === 'recover') this.forceSample = true;
    if (car.id !== 0) return;
    if (type === 'gate' && this.track.mode === 'rush') {
      this.remaining += 5.5; this.score += Math.round(200 * this.combo); this.combo = Math.min(5, this.combo + .25); this.comboAge = 0;
      this.message(`CHECKPOINT ${value} / ${this.track.gates}  ·  +5.5 seconds`);
    }
    if (type === 'lap' && this.track.mode !== 'rush') this.message(`LAP ${value} COMPLETE${car.p.laps.at(-1).valid ? '' : ' · invalid lap'}`);
    if (type === 'recover') this.message('Rejoined behind the last gate · current lap invalid');
    if (type === 'collision') { this.combo = 1; this.comboAge = 0; this.cleanDistance = 0; this.message('CONTACT · combo reset'); }
  }
  recover(car) {
    const spacing = this.track.length / this.track.gates;
    const s = Math.max(-22, car.p.passed * spacing - 9), p = this.track.at(s);
    const lane = (car.id % 2 ? -1 : 1) * 3.4;
    car.x = p.x + p.nx * lane; car.z = p.z + p.nz * lane; car.y = p.y;
    car.heading = Math.atan2(p.tx, p.tz); car.vx = car.vz = car.speed = car.yaw = car.steer = 0;
    car.nitro = Math.max(0, car.nitro - 8); car.boosting = car.drifting = false;
    car.p.unwrapped = s; car.p.lastS = mod(s, this.track.length); car.near = p.i;
    car.ghost = 1.5; car.epoch++; car.ai.stuck = 0; car.ai.recoveryCooldown = 8;
    markInvalid(car, 'Recovery'); this.event('recover', car);
  }
  hit(car, strength, side = 0) {
    if (car.impactCooldown > 0 || car.ghost > 0 || strength < 2.4) return;
    car.impactCooldown = .35; car.impact = clamp(strength / 16, .15, 1);
    car.damage[side] = clamp(car.damage[side] + strength / 40, 0, 1);
    this.event('collision', car, strength);
  }
  drive(car, rawInput, dt) {
    const input = { ...EMPTY_INPUT, ...rawInput }, model = CARS.find(m => m.id === car.model), p = car.p;
    if (p.finishTime !== null) { car.boosting = car.drifting = false; car.vx = car.vz = car.speed = 0; return; }
    car.impactCooldown = Math.max(0, car.impactCooldown - dt); car.impact *= Math.exp(-dt * 7);
    car.ghost = Math.max(0, car.ghost - dt); car.ai.recoveryCooldown -= dt;
    let q = this.track.nearest(car.x, car.z, car.near), speed = car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading);
    const offroad = Math.abs(q.lateral) > this.track.width / 2 + .5;
    if (offroad) markInvalid(car, 'Left the paved road');
    car.steer = lerp(car.steer, clamp(input.steer, -1, 1), 1 - Math.exp(-dt * 11));
    car.drifting = !!input.drift && Math.abs(speed) > 10 && Math.abs(car.steer) > .12;
    car.boosting = !!input.nitro && car.nitro > .5 && input.throttle > 0 && speed > 5 && !offroad;
    if (car.boosting) car.nitro = Math.max(0, car.nitro - 25 * dt);
    else car.nitro = Math.min(100, car.nitro + (car.drifting ? 9 : 2.8) * dt);
    const grip = model.grip * (1 - .43 * this.env.wet) * (car.drifting ? .23 : 1) * (offroad ? .6 : 1);
    const yawTarget = speed / 2.7 * Math.tan(car.steer * model.steer / (1 + Math.abs(speed) * .065)) * (car.drifting ? 1.15 : 1) * (1 - .12 * this.env.wet);
    car.yaw = lerp(car.yaw, yawTarget, 1 - Math.exp(-dt * 8));
    car.heading = mod(car.heading + car.yaw * dt + Math.PI, Math.PI * 2) - Math.PI;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading), rx = fz, rz = -fx;
    let forward = car.vx * fx + car.vz * fz, lateral = car.vx * rx + car.vz * rz;
    lateral *= Math.exp(-dt * grip);
    let force = clamp(input.throttle, 0, 1) * model.acceleration * (1 - .22 * clamp(forward / model.top, 0, 1));
    if (car.boosting) force += 10;
    const targetTop = model.top + (car.boosting ? 14 : 0);
    if (forward > targetTop) force -= (forward - targetTop) * 3;
    if (input.brake) force -= forward > 1 ? 27 * (1 - .28 * this.env.wet) * input.brake : (forward > -8 ? 7 * input.brake : 0);
    if (forward < -.5 && input.throttle) force += 12;
    const next = this.track.at(q.s + 3), slope = (next.y - q.y) / 3;
    force -= .0018 * forward * Math.abs(forward) + .06 * forward + (offroad ? .7 * forward : 0) + slope * 6;
    if (!input.throttle && !input.brake && Math.abs(forward) < .3) forward = 0;
    forward += force * dt;
    car.vx = fx * forward + rx * lateral; car.vz = fz * forward + rz * lateral;
    car.x += car.vx * dt; car.z += car.vz * dt;
    q = this.track.nearest(car.x, car.z, car.near); car.near = q.i; car.lateral = q.lateral; car.y = q.y;
    const barrier = this.track.width / 2 + 5.4 - model.width / 2;
    if (Math.abs(q.lateral) > barrier) {
      const sign = Math.sign(q.lateral), penetration = Math.abs(q.lateral) - barrier;
      car.x -= q.nx * sign * penetration; car.z -= q.nz * sign * penetration;
      const normalSpeed = (car.vx * q.nx + car.vz * q.nz) * sign;
      if (normalSpeed > 0) {
        car.vx -= q.nx * sign * normalSpeed * 1.38; car.vz -= q.nz * sign * normalSpeed * 1.38;
        car.vx *= .86; car.vz *= .86; car.boosting = car.drifting = false;
        this.hit(car, Math.abs(normalSpeed) + Math.abs(forward) * .10, sign > 0 ? 2 : 1);
      }
    }
    const ds = mod(q.s - p.lastS + this.track.length / 2, this.track.length) - this.track.length / 2;
    const old = p.unwrapped;
    if (Math.abs(ds) < Math.max(10, Math.hypot(car.vx, car.vz) * dt * 2 + 2)) p.unwrapped += ds;
    else { markInvalid(car, 'Route discontinuity'); this.message('Route missed · recover to the last gate'); }
    p.lastS = q.s;
    advanceProgress(car, this.track, old, Math.abs(q.lateral) <= this.track.width / 2 + 4.8, this.time, this.event.bind(this));
    car.speed = car.vx * fx + car.vz * fz; car.wheelSpin += car.speed * dt / .35;
    if (car.id) car.ai.stuck = Math.abs(car.speed) < 2 ? car.ai.stuck + dt : Math.max(0, car.ai.stuck - dt * .4);
    if (car.id === 0 && this.track.mode === 'rush') {
      const earned = Math.min(Math.max(0, p.unwrapped - this.earnedDistance), Math.max(0, car.speed) * dt + 1);
      this.earnedDistance = Math.max(this.earnedDistance, p.unwrapped);
      if (earned > 0 && !offroad && car.speed > 15) {
        this.cleanDistance += earned;
        this.score += earned * (car.drifting ? 3 : car.boosting ? 1.5 : .6) * this.combo;
        if (this.cleanDistance > 160) { this.cleanDistance -= 160; this.combo = Math.min(5, this.combo + .25); this.comboAge = 0; this.message(car.drifting ? 'FLOW · drift linked' : 'CLEAN LINE · combo linked'); }
      }
    }
  }
  contacts() {
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j];
      if (a.ghost > 0 || b.ghost > 0 || a.p.finishTime !== null || b.p.finishTime !== null) continue;
      let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      // Two capsule-like contact circles per vehicle produce meaningful nose/tail contacts.
      const along = Math.abs(dx * Math.sin(a.heading) + dz * Math.cos(a.heading));
      const radius = along > d * .65 ? 4.1 : 2.15;
      if (d >= radius) continue;
      if (d < .01) { dx = .01; d = .01; }
      const nx = dx / d, nz = dz / d, push = (radius - d) * .51;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
      const relative = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (relative > 0) {
        const impulse = relative * .65;
        a.vx -= nx * impulse; a.vz -= nz * impulse; b.vx += nx * impulse; b.vz += nz * impulse;
        this.hit(a, relative, 0); this.hit(b, relative, 0);
        a.boosting = a.drifting = b.boosting = b.drifting = false;
      }
    }
  }
  step(input = EMPTY_INPUT, dt = STEP) {
    if (this.status === 'paused' || this.status === 'done') return;
    if (this.status === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 1e-6) { this.status = 'racing'; this.record(); this.nextSample = .1; }
      return;
    }
    this.time += dt;
    this.env = environmentAt(this.time, this.setup.weather, this.setup.daylight);
    if (input.recover && !this.recoverHeld) this.recover(this.cars[0]);
    this.recoverHeld = !!input.recover;
    for (const car of this.cars) {
      const controls = car.id ? aiInput(this, car) : input;
      if (car.id && controls.recover) this.recover(car);
      this.drive(car, controls, dt);
    }
    this.contacts();
    if (this.track.mode === 'rush') { this.remaining = Math.max(0, this.remaining - dt); this.comboAge += dt; if (this.comboAge > 9 && this.combo > 1) { this.combo = 1; this.comboAge = 0; this.message('Flow faded · build another combo'); } }
    if (this.time + 1e-6 >= this.nextSample || this.forceSample) { this.record(); this.nextSample = this.time + .1; this.forceSample = false; }
    if (this.cars[0].p.finishTime !== null) this.finish('completed');
    else if (this.track.mode === 'rush' && this.remaining <= 0) this.finish('failed');
    else if (this.time >= 1799) this.finish('partial', 'Recording time limit reached; run retired.');
  }
  pause() {
    if (this.status !== 'racing' && this.status !== 'countdown') return;
    this.beforePause = this.status; this.status = 'paused';
    this.cars.forEach(c => { c.boosting = c.drifting = false; }); this.recoverHeld = false;
  }
  resume() { if (this.status === 'paused') this.status = this.beforePause || 'racing'; }
  finish(outcome, reason = '') {
    if (this.status === 'done') return this.result;
    this.status = 'done'; this.record();
    const player = this.cars[0], valid = player.p.laps.filter(l => l.valid).map(l => l.time);
    this.result = { outcome, reason, mode: this.track.mode, duration: this.time, laps: structuredClone(player.p.laps), best: outcome === 'completed' && valid.length ? Math.min(...valid) : null, score: Math.floor(this.score), standings: standings(this.cars, this.track).map(c => ({ id: c.id, name: c.name, finishTime: c.p.finishTime, progress: progressValue(c, this.track), laps: c.p.laps.length })), source: this.source };
    this.cars.forEach(c => { c.boosting = c.drifting = false; });
    return this.result;
  }
  record() {
    const frame = { t: round(this.time), w: [round(this.env.cloud), round(this.env.wet), round(this.env.day)], h: [round(this.remaining), Math.floor(this.score), round(this.combo)], c: this.cars.map(c => [c.x, c.y, c.z, c.heading, c.speed, c.steer, ...c.damage, c.nitro, +c.boosting, +c.drifting, c.p.unwrapped, c.p.passed, +c.p.valid, c.ghost, c.epoch, c.p.finishTime ?? -1, c.p.lapStart, c.impact].map(round)) };
    if (this.frames.at(-1)?.t === frame.t) this.frames[this.frames.length - 1] = frame;
    else this.frames.push(frame);
  }
  replay() {
    if (!this.result) return null;
    return { format: 'solstice-replay', version: 1, origin: this.source === 'harness' ? 'harness' : 'local', created: this.startedAt, setup: { ...this.setup }, cars: this.cars.map(({ id, name, model, color }) => ({ id, name, model, color })), result: structuredClone(this.result), frames: this.frames, events: this.events };
  }
}
