import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, STEP, aiInput } from '../src/sim.js';
import { MAX_REPLAY_BYTES, parseReplay, sampleReplay, validateReplay } from '../src/replay.js';
import { ReplayLibrary, loadPreferences, readRecords, writeRecord } from '../src/storage.js';

function run(course = 'coastal') { const s = new Simulation({ course }, 'harness'); for (let i = 0; i < 30000 && s.status !== 'done'; i++) s.step(s.status === 'racing' ? aiInput(s, s.cars[0], 2) : {}, STEP); return s; }
const completed = run(), fixture = completed.replay();
class KV { map = new Map(); fail = false; getItem(k) { return this.map.get(k) ?? null; } setItem(k, v) { if (this.fail) throw new Error('Quota'); this.map.set(k, v); } removeItem(k) { this.map.delete(k); } }
class Files {
  files = new Map(); fail = false;
  async getFileHandle(name, options = {}) {
    if (!this.files.has(name) && !options.create) throw new DOMException('Missing', 'NotFoundError');
    const root = this;
    return { async getFile() { const body = root.files.get(name) || ''; return { size: new TextEncoder().encode(body).byteLength, text: async () => body }; }, async createWritable() { let pending = ''; return { async write(body) { if (root.fail) throw new Error('Quota'); pending = body; }, async close() { root.files.set(name, pending); }, async abort() {} }; } };
  }
  async *entries() { for (const name of this.files.keys()) yield [name, {}]; }
  async removeEntry(name) { if (this.fail) throw new Error('Denied'); this.files.delete(name); }
}
class Locks { tail = Promise.resolve(); request(name, callback) { const p = this.tail.then(callback); this.tail = p.catch(() => {}); return p; } }
async function library() { const kv = new KV(), root = new Files(), locks = new Locks(), lib = new ReplayLibrary({ kv, root, locks, namespace: 'solstice.test.unit' }); await lib.init(); return { lib, kv, root, locks }; }

test('completed authentic recording round-trips and has stable bidirectional historical seeking', () => {
  const replay = parseReplay(JSON.stringify(fixture)); assert.equal(replay.frames.length, fixture.frames.length); assert.equal(replay.result.duration, completed.time);
  const before = sampleReplay(replay, 30), after = sampleReplay(replay, 90), backwards = sampleReplay(replay, 30);
  assert.deepEqual(before, backwards); assert.notDeepEqual(before.cars[0], after.cars[0]); assert.notDeepEqual(before.env, after.env); assert.equal(sampleReplay(replay, 1e9).time, replay.result.duration);
});
test('recovery discontinuities do not interpolate through scenery; damage is historical', () => {
  const sim = new Simulation({}, 'harness');
  for (let i = 0; i < 1200; i++) sim.step({ throttle: 1, steer: .4 }, STEP);
  const damaged = Math.max(...sim.cars[0].damage); assert.ok(damaged > 0);
  sim.recover(sim.cars[0]); sim.step({}); for (let i = 0; i < 20; i++) sim.step({ throttle: 1 }); sim.finish('partial');
  const r = validateReplay(sim.replay()), event = r.events.find(e => e.type === 'recover');
  const at = sampleReplay(r, event.t + .02); assert.equal(at.cars[0].epoch, 1);
  const earliest = sampleReplay(r, 0); assert.deepEqual(earliest.cars[0].damage, [0, 0, 0]); assert.ok(Math.max(...at.cars[0].damage) >= damaged - .001);
  const collision = r.events.find(e => e.type === 'collision'); const a = sampleReplay(r, collision.t + .2); sampleReplay(r, 0); assert.deepEqual(sampleReplay(r, collision.t + .2), a);
});
test('malformed, oversized, compressed, unsupported and non-finite replays are rejected', () => {
  assert.throws(() => parseReplay('{"format":'), /complete JSON/); assert.throws(() => parseReplay('x'.repeat(MAX_REPLAY_BYTES + 1)), /8 MiB/); assert.throws(() => parseReplay('H4sIAAAA'), /complete JSON/);
  for (const mutate of [r => r.version = 99, r => r.frames[2].t = -1, r => r.frames[0].c[0][0] = NaN, r => r.frames[0].c[0][6] = 9, r => r.frames[0].c[0][13] = 9999, r => r.cars[0].model = 'https://bad.example/payload', r => r.events.push({ t: 0, type: 'execute', car: 0, value: 0 })]) { const r = structuredClone(fixture); mutate(r); assert.throws(() => validateReplay(r)); }
});
test('angle wrap uses the short rotation and seek direction never changes it', () => {
  const r = structuredClone(fixture); r.frames[0].c[0][3] = Math.PI - .02; r.frames[1].c[0][3] = -Math.PI + .02;
  const middle = sampleReplay(r, r.frames[1].t / 2); assert.ok(Math.abs(middle.cars[0].heading) > 3.1);
});
test('five-entry capacity, cancellation and explicit replacement retain the right files', async () => {
  const { lib, root } = await library(); const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await lib.save(fixture, { origin: 'harness' })).entry.id);
  const prior = JSON.stringify(lib.manifest()), attempt = await lib.save(fixture, { origin: 'harness' }); assert.ok(attempt.full); assert.equal(JSON.stringify(lib.manifest()), prior); assert.equal(root.files.size, 5);
  const replaced = await lib.save(fixture, { origin: 'harness', replaceId: ids[2], expectedRevision: attempt.revision });
  assert.equal(lib.manifest().entries.length, 5); assert.ok(!lib.manifest().entries.some(e => e.id === ids[2])); assert.ok(lib.manifest().entries.some(e => e.id === replaced.entry.id)); assert.equal(root.files.size, 5);
});
test('concurrent attempts at slot five serialize; stale replacements are refused', async () => {
  const { lib } = await library(); for (let i = 0; i < 4; i++) await lib.save(fixture);
  const out = await Promise.all([lib.save(fixture), lib.save(fixture)]); assert.equal(out.filter(r => r.full).length, 1); assert.equal(lib.manifest().entries.length, 5);
  const full = out.find(r => r.full), id = full.entries[0].id; await lib.remove(full.entries[1].id);
  await assert.rejects(lib.save(fixture, { replaceId: id, expectedRevision: full.revision }), /Another tab/);
});
test('failed replacement preserves all previous entries and orphan recovery respects capacity', async () => {
  const { lib, kv, root } = await library(); for (let i = 0; i < 5; i++) await lib.save(fixture);
  const prior = lib.manifest(), id = prior.entries[0].id; kv.fail = true;
  await assert.rejects(lib.save(fixture, { replaceId: id, expectedRevision: prior.revision }), /metadata/); kv.fail = false;
  assert.deepEqual(lib.manifest(), prior); assert.equal(root.files.size, 6);
  const listing = await lib.list(); assert.equal(listing.orphans.length, 1); assert.equal(listing.capacity, 5);
  const attempt = await lib.save(listing.orphans[0].replay, { recoveredFile: listing.orphans[0].file, origin: 'imported' }); assert.ok(attempt.full); assert.equal(root.files.size, 6);
});
test('failed body write or denied storage never claims success', async () => {
  const { lib, root } = await library(); const first = await lib.save(fixture); root.fail = true;
  await assert.rejects(lib.save(fixture, { replaceId: first.entry.id }), /could not be written/); assert.equal(lib.manifest().entries[0].id, first.entry.id);
  root.fail = false; lib.available = false; await assert.rejects(lib.save(fixture), /unavailable/);
});
test('file ingestion provenance and impossible metadata cannot write personal-best records', async () => {
  const { lib, kv, locks } = await library(), forged = structuredClone(fixture); forged.origin = 'local'; forged.result.best = .001;
  await lib.save(parseReplay(JSON.stringify(forged)), { origin: 'imported' }); assert.equal(lib.manifest().entries[0].origin, 'imported'); assert.deepEqual(readRecords(kv, 'solstice.test.unit'), {});
  await assert.rejects(writeRecord(kv, locks, completed, 'solstice.v1'), /disposable test storage/);
  assert.equal(await writeRecord(kv, locks, completed, 'solstice.test.unit'), true); assert.ok(Object.values(readRecords(kv, 'solstice.test.unit'))[0].time > 30);
  const partial = new Simulation({}, 'local'); partial.finish('partial'); assert.equal(await writeRecord(kv, locks, partial), false);
});
test('corrupt preferences fall back safely; valid binding mappings survive reload', () => {
  const kv = new KV(); kv.setItem('solstice.v1.prefs', '{broken'); assert.equal(loadPreferences(kv).quality, 'Medium');
  const p = loadPreferences(kv); p.quality = 'Low'; p.bindings.throttle = 'ArrowUp'; kv.setItem('solstice.v1.prefs', JSON.stringify(p)); assert.equal(loadPreferences(kv).bindings.throttle, 'ArrowUp');
  p.bindings.brake = 'ArrowUp'; kv.setItem('solstice.v1.prefs', JSON.stringify(p)); assert.equal(loadPreferences(kv).bindings.throttle, 'KeyW');
});
