import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS, COURSES, DEFAULT_BINDINGS, bindingProblem } from '../src/catalog.js';
import { makeTrack } from '../src/math.js';
import { Simulation, STEP, advanceProgress, aiInput, createCar, environmentAt, markInvalid, standings } from '../src/sim.js';

function run(sim, seconds, policy = () => ({})) { for (let i = 0; i < seconds / STEP && sim.status !== 'done'; i++) sim.step(policy(sim), STEP); return sim; }
function autoplay(sim) { return sim.status === 'racing' ? aiInput(sim, sim.cars[0], 2) : {}; }
test('countdown gates physics and timers; pause freezes the complete authoritative state', () => {
  const sim = new Simulation({ course: 'riviera' }, 'harness'), start = JSON.stringify(sim.cars);
  run(sim, 2, () => ({ throttle: 1, nitro: true })); assert.equal(sim.time, 0); assert.equal(JSON.stringify(sim.cars), start);
  run(sim, 2, autoplay); assert.ok(sim.time > 0); sim.pause();
  const frozen = JSON.stringify({ cars: sim.cars, env: sim.env, time: sim.time, frames: sim.frames, countdown: sim.countdown });
  run(sim, 30, () => ({ throttle: 1, nitro: true, recover: true }));
  assert.equal(JSON.stringify({ cars: sim.cars, env: sim.env, time: sim.time, frames: sim.frames, countdown: sim.countdown }), frozen);
  sim.resume(); sim.step({}); assert.ok(sim.time > JSON.parse(frozen).time);
});
test('three authored routes have distinct geometry and usable continuous elevation', () => {
  const tracks = COURSES.map(makeTrack); assert.equal(new Set(tracks.map(t => Math.round(t.length))).size, 3);
  for (const track of tracks) { assert.ok(track.length > 2000); const a = track.at(0), b = track.at(track.length); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .001); for (let i = 1; i < 900; i++) assert.ok(Math.abs(track.samples[i].y - track.samples[i - 1].y) < 2); }
});
test('ordered gates reject reverse crossings, repeated contact, and skipped checkpoints', () => {
  const track = makeTrack(COURSES[0]), car = createCar(track, 'tern', 0, 'You', 0, 0), gap = track.length / track.gates;
  car.p.unwrapped = gap + .1; assert.equal(advanceProgress(car, track, gap - .1, true, 2), true); assert.equal(car.p.passed, 1);
  car.p.unwrapped = gap - .1; assert.equal(advanceProgress(car, track, gap + .1, true, 3), false);
  car.p.unwrapped = gap + .1; assert.equal(advanceProgress(car, track, gap - .1, true, 4), false);
  car.p.unwrapped = gap * 4; assert.equal(advanceProgress(car, track, gap * 3, true, 5), false); assert.equal(car.p.passed, 1);
  car.p.passed = track.gates - 1; car.p.unwrapped = track.length - .1; assert.equal(advanceProgress(car, track, track.length + .1, true, 6), false); assert.equal(car.p.laps.length, 0);
});
test('each lap is individually valid and exactly three laps terminate a Time Trial', () => {
  const sim = new Simulation({}, 'harness');
  run(sim, 500, s => { if (s.cars[0].p.laps.length === 0) markInvalid(s.cars[0], 'Test off-road'); return autoplay(s); });
  assert.equal(sim.status, 'done'); assert.equal(sim.result.outcome, 'completed'); assert.equal(sim.result.laps.length, 3);
  assert.deepEqual(sim.result.laps.map(l => l.valid), [false, true, true]);
  assert.equal(sim.result.best, Math.min(...sim.result.laps.filter(l => l.valid).map(l => l.time)));
  const frozen = JSON.stringify(sim.result); run(sim, 10, () => ({ throttle: 1 })); assert.equal(JSON.stringify(sim.result), frozen);
});
test('all-invalid Time Trial finishes honestly with no best valid lap', () => {
  const sim = new Simulation({}, 'harness'); run(sim, 500, s => { markInvalid(s.cars[0], 'Test invalid'); return autoplay(s); });
  assert.equal(sim.result.outcome, 'completed'); assert.equal(sim.result.laps.length, 3); assert.equal(sim.result.best, null); assert.ok(sim.result.laps.every(l => !l.valid)); assert.ok(sim.replay().frames.length > 100);
});
test('recovery rewinds to the last accepted gate, clears momentum and invalidates the lap', () => {
  const sim = new Simulation({}, 'harness'); run(sim, 15, autoplay); const c = sim.cars[0], passed = c.p.passed, before = c.p.unwrapped;
  assert.ok(passed > 0); c.boosting = c.drifting = true; sim.recover(c);
  assert.ok(c.p.unwrapped < before); assert.equal(c.p.passed, passed); assert.equal(c.p.valid, false); assert.equal(c.speed, 0); assert.equal(c.vx, 0); assert.equal(c.vz, 0); assert.equal(c.boosting, false); assert.equal(c.drifting, false); assert.equal(c.epoch, 1); assert.ok(c.ghost > 0);
});
test('all five rivals finish actual three-lap races on Easy, Normal and Hard', () => {
  const times = [];
  for (const difficulty of [0, 1, 2]) {
    const sim = new Simulation({ course: 'riviera', difficulty }, 'harness');
    for (let i = 0; i < 30000 && !sim.cars.slice(1).every(c => c.p.finishTime !== null); i++) sim.step({}, STEP);
    assert.equal(sim.cars.length, 6); assert.ok(sim.cars.slice(1).every(c => c.p.laps.length === 3 && c.p.passed === 84 && c.p.finishTime > 120));
    const finished = standings(sim.cars, sim.track); assert.equal(finished.at(-1).id, 0); assert.equal(finished.at(-1).p.finishTime, null);
    times.push(finished[0].p.finishTime); assert.ok(sim.events.some(e => e.type === 'collision'));
  }
  assert.ok(times[0] > times[1] && times[1] > times[2]);
});
test('six-car results preserve unfinished progress instead of inventing finish times', () => {
  const sim = new Simulation({ course: 'riviera' }, 'harness'); run(sim, 450, autoplay);
  assert.equal(sim.result.outcome, 'completed'); assert.equal(sim.result.standings.length, 6);
  assert.ok(sim.result.standings.some(c => c.finishTime === null)); assert.equal(sim.result.standings.find(c => c.id === 0).finishTime, sim.time);
});
test('checkpoint success and timeout both produce truthful replayable outcomes', () => {
  const success = run(new Simulation({ course: 'horizon' }, 'harness'), 450, autoplay);
  assert.equal(success.result.outcome, 'completed'); assert.equal(success.cars[0].p.passed, 16); assert.ok(success.remaining > 0); assert.ok(success.score > 1000); assert.ok(success.combo > 1);
  const failed = run(new Simulation({ course: 'horizon' }, 'harness'), 30); assert.equal(failed.result.outcome, 'failed'); assert.equal(failed.remaining, 0); assert.equal(failed.cars[0].p.passed, 0); assert.ok(failed.replay().frames.length > 150);
});
test('wetness and daylight evolve, and wet braking changes actual velocity', () => {
  const initial = environmentAt(0, 0, 1), later = environmentAt(80, 0, 1); assert.ok(later.wet > initial.wet); assert.notEqual(initial.day, later.day);
  const dry = new Simulation({ weather: 0 }, 'harness'), wet = new Simulation({ weather: 2 }, 'harness');
  for (const s of [dry, wet]) { s.status = 'racing'; const c = s.cars[0]; c.vz = 30; c.heading = 0; s.step({ brake: 1 }); }
  assert.ok(wet.cars[0].speed > dry.cars[0].speed);
});
test('nitro is finite and affects acceleration; intentional drift alters handling', () => {
  const normal = new Simulation({}, 'harness'), boost = new Simulation({}, 'harness');
  run(normal, 4, () => ({ throttle: 1 })); run(boost, 4, () => ({ throttle: 1, nitro: true }));
  assert.ok(boost.cars[0].speed > normal.cars[0].speed); assert.ok(boost.cars[0].nitro < 90);
  const grip = new Simulation({}, 'harness'), slide = new Simulation({}, 'harness');
  for (const s of [grip, slide]) { s.status = 'racing'; s.cars[0].heading = 0; s.cars[0].vz = 25; }
  run(grip, .4, () => ({ throttle: 1, steer: .6 })); run(slide, .4, () => ({ throttle: 1, steer: .6, drift: true }));
  assert.ok(slide.cars[0].drifting); assert.notEqual(slide.cars[0].x, grip.cars[0].x);
});
test('actual impacts accumulate damage, recovery retains it, and restart clears it', () => {
  const sim = new Simulation({}, 'harness'); run(sim, 23, () => ({ throttle: 1, steer: .5 })); const c = sim.cars[0]; assert.ok(Math.max(...c.damage) > 0);
  const damaged = c.damage.slice(); sim.recover(c); assert.deepEqual(c.damage, damaged);
  assert.deepEqual(new Simulation(sim.setup).cars[0].damage, [0, 0, 0]);
});
test('fixed-size stepping gives the same race outcome under 30, 60 and 144 Hz render schedules', () => {
  const runs = [30, 60, 144].map(fps => {
    const sim = new Simulation({}, 'harness'); let pending = 0;
    for (let frame = 0; frame < fps * 12; frame++) { pending += 1 / fps; while (pending + 1e-9 >= STEP) { sim.step(autoplay(sim)); pending -= STEP; } }
    return { time: sim.time, p: sim.cars[0].p, x: sim.cars[0].x, z: sim.cars[0].z };
  }); assert.deepEqual(runs[0], runs[1]); assert.deepEqual(runs[1], runs[2]);
});
test('binding changes reject conflicts and unsupported browser shortcuts', () => {
  assert.match(bindingProblem(DEFAULT_BINDINGS, 'nitro', 'KeyW'), /Already used/); assert.equal(bindingProblem(DEFAULT_BINDINGS, 'throttle', 'ArrowUp'), ''); assert.ok(bindingProblem(DEFAULT_BINDINGS, 'throttle', 'F5'));
  assert.equal(new Set(CARS.map(c => c.top)).size, 3); assert.equal(new Set(CARS.map(c => c.grip)).size, 3);
});
