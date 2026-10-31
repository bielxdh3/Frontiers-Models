import { CARS, COURSES } from './catalog.js';
import { angleDelta, clamp, lerp, makeTrack } from './math.js';

export const MAX_REPLAY_BYTES = 8 * 1024 * 1024;
export const MAX_FRAMES = 22002;
const fail = message => { throw new Error(message); };
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const integer = (x, lo, hi) => num(x, lo, hi) && Number.isInteger(x);
const text = (x, max) => typeof x === 'string' && x.length <= max;
export function parseReplay(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_REPLAY_BYTES || new TextEncoder().encode(raw).byteLength > MAX_REPLAY_BYTES) fail('Replay is larger than the 8 MiB limit.');
  let value;
  try { value = JSON.parse(raw); } catch { fail('This file is not a complete JSON replay. Choose a .solstice export.'); }
  return validateReplay(value);
}
export function validateReplay(r) {
  if (!obj(r) || r.format !== 'solstice-replay' || r.version !== 1) fail('Unsupported replay format or version. This game reads Solstice v1 recordings.');
  const setup = r.setup;
  if (!obj(setup) || !COURSES.some(c => c.id === setup.course) || !CARS.some(c => c.id === setup.car) || !integer(setup.weather, 0, 2) || !integer(setup.daylight, 0, 3) || !integer(setup.difficulty, 0, 2)) fail('Replay has invalid race settings.');
  const track = makeTrack(COURSES.find(c => c.id === setup.course));
  const count = track.mode === 'race' ? 6 : 1;
  if (!Array.isArray(r.cars) || r.cars.length !== count || !r.cars.every((c, i) => obj(c) && c.id === i && text(c.name, 24) && CARS.some(m => m.id === c.model) && /^#[0-9a-f]{6}$/i.test(c.color))) fail('Replay has invalid vehicle identities.');
  if (!obj(r.result) || !['completed', 'failed', 'partial'].includes(r.result.outcome) || !num(r.result.duration, 0, 1800) || !num(r.result.score, 0, 1e8) || !Array.isArray(r.result.laps) || r.result.laps.length > track.laps || !r.result.laps.every(l => obj(l) && num(l.time, 0, 1800) && typeof l.valid === 'boolean' && text(l.reason, 100))) fail('Replay has invalid result metadata.');
  const duration = r.result.duration;
  if (!Array.isArray(r.frames) || r.frames.length < 1 || r.frames.length > MAX_FRAMES) fail('Replay sample count is outside the supported limits.');
  let last = -1;
  for (const f of r.frames) {
    if (!obj(f) || !num(f.t, 0, duration + .002) || f.t <= last || (last >= 0 && f.t - last > .22) || !Array.isArray(f.w) || f.w.length !== 3 || !f.w.every(v => num(v, 0, 1)) || !Array.isArray(f.h) || f.h.length !== 3 || !num(f.h[0], 0, 120) || !num(f.h[1], 0, 1e8) || !num(f.h[2], 1, 5) || !Array.isArray(f.c) || f.c.length !== count) fail('Replay contains invalid timestamps, climate or HUD samples.');
    last = f.t;
    for (const c of f.c) {
      if (!Array.isArray(c) || c.length !== 20 || !c.every(Number.isFinite) || !num(c[0], -15000, 15000) || !num(c[1], -100, 400) || !num(c[2], -15000, 15000) || !num(c[3], -Math.PI - .002, Math.PI + .002) || !num(c[4], -40, 140) || !num(c[5], -1, 1) || !c.slice(6, 9).every(v => num(v, 0, 1)) || !num(c[9], 0, 100) || ![10, 11, 14].every(i => integer(c[i], 0, 1)) || !num(c[12], -200, track.length * track.laps + 500) || !integer(c[13], 0, track.gates * track.laps) || !num(c[15], 0, 10) || !integer(c[16], 0, 10000) || !(c[17] === -1 || num(c[17], 0, duration + .002)) || !num(c[18], 0, duration + .002) || !num(c[19], 0, 1)) fail('Replay contains an out-of-range vehicle sample.');
    }
  }
  if (Math.abs(r.frames[0].t) > .002 || Math.abs(r.frames.at(-1).t - duration) > .003) fail('Replay does not cover its declared duration.');
  if (!Array.isArray(r.events) || r.events.length > 16000 || !r.events.every(e => obj(e) && num(e.t, 0, duration + .002) && ['gate', 'lap', 'finish', 'collision', 'recover'].includes(e.type) && integer(e.car, 0, count - 1) && num(e.value, 0, 1e6))) fail('Replay event data is invalid.');
  if (!text(r.created, 32) || !Number.isFinite(Date.parse(r.created))) fail('Replay date is invalid.');
  // Copy only known fields; no file-supplied HTML, resource URLs, settings or storage keys survive.
  return {
    format: r.format, version: 1, origin: ['local', 'harness', 'imported'].includes(r.origin) ? r.origin : 'imported', created: r.created,
    setup: { course: setup.course, car: setup.car, weather: setup.weather, daylight: setup.daylight, difficulty: setup.difficulty },
    cars: r.cars.map(c => ({ id: c.id, name: c.name, model: c.model, color: c.color })),
    result: { outcome: r.result.outcome, reason: text(r.result.reason, 150) ? r.result.reason : '', mode: track.mode, duration, score: r.result.score, laps: r.result.laps.map(l => ({ time: l.time, valid: l.valid, reason: l.reason })), best: num(r.result.best, 0, 1800) ? r.result.best : null },
    frames: r.frames.map(f => ({ t: f.t, w: f.w.slice(), h: f.h.slice(), c: f.c.map(c => c.slice()) })),
    events: r.events.map(e => ({ t: e.t, type: e.type, car: e.car, value: e.value }))
  };
}
export function sampleReplay(replay, time) {
  const t = clamp(time, 0, replay.result.duration), frames = replay.frames;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frames[mid].t <= t) lo = mid; else hi = mid - 1; }
  const a = frames[lo], b = frames[Math.min(lo + 1, frames.length - 1)], mix = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  const cars = a.c.map((values, i) => {
    const c = values.slice(), next = b.c[i];
    if (c[16] === next[16]) {
      for (const index of [0, 1, 2, 4, 5, 9, 12]) c[index] = lerp(c[index], next[index], mix);
      c[3] += angleDelta(c[3], next[3]) * mix;
      c[15] = Math.max(0, c[15] - (t - a.t));
    }
    return { ...replay.cars[i], x: c[0], y: c[1], z: c[2], heading: c[3], speed: c[4], steer: c[5], damage: c.slice(6, 9), nitro: c[9], boosting: !!c[10], drifting: !!c[11], ghost: c[15], epoch: c[16], impact: 0, wheelSpin: t * c[4] / .35, p: { unwrapped: c[12], passed: c[13], valid: !!c[14], finishTime: c[17] < 0 ? null : c[17], lapStart: c[18], laps: replay.result.laps.slice(0, Math.floor(c[13] / COURSES.find(track => track.id === replay.setup.course).gates)) } };
  });
  return { time: t, cars, env: { cloud: lerp(a.w[0], b.w[0], mix), wet: lerp(a.w[1], b.w[1], mix), day: a.w[2] + angleDelta(a.w[2] * Math.PI * 2, b.w[2] * Math.PI * 2) / (Math.PI * 2) * mix }, remaining: b.h[0] > a.h[0] + 1 ? Math.max(0, a.h[0] - (t - a.t)) : lerp(a.h[0], b.h[0], mix), score: a.h[1], combo: a.h[2] };
}
