import { ACTION_LABELS, CARS, DEFAULT_BINDINGS, DEFAULT_PREFS, bindingProblem } from './catalog.js';
import { MAX_REPLAY_BYTES, parseReplay, validateReplay } from './replay.js';
const FILE = /^r-[a-f0-9-]{36}\.solstice$/;
export function loadPreferences(kv, namespace = 'solstice.v1') {
  const defaults = structuredClone(DEFAULT_PREFS);
  try {
    const p = JSON.parse(kv.getItem(`${namespace}.prefs`) || 'null');
    if (!p || typeof p !== 'object') return defaults;
    if (['Low', 'Medium', 'High'].includes(p.quality)) defaults.quality = p.quality;
    if ([.65, .8, 1, 1.25].includes(p.scale)) defaults.scale = p.scale;
    if ([30, 60, 120].includes(p.fps)) defaults.fps = p.fps;
    if (Number.isFinite(p.volume) && p.volume >= 0 && p.volume <= 1) defaults.volume = p.volume;
    if (typeof p.muted === 'boolean') defaults.muted = p.muted;
    if (typeof p.reducedMotion === 'boolean') defaults.reducedMotion = p.reducedMotion;
    if (p.bindings && Object.keys(DEFAULT_BINDINGS).every(k => typeof p.bindings[k] === 'string' && !bindingProblem(p.bindings, k, p.bindings[k]))) defaults.bindings = Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map(k => [k, p.bindings[k]]));
    return defaults;
  } catch { return defaults; }
}
export function savePreferences(kv, prefs, namespace = 'solstice.v1') {
  try { kv.setItem(`${namespace}.prefs`, JSON.stringify(prefs)); return true; } catch { return false; }
}
export class ReplayLibrary {
  constructor({ namespace = 'solstice.v1', kv, root, locks } = {}) {
    this.namespace = namespace; this.kv = kv; this.root = root; this.locks = locks;
    this.key = `${namespace}.library`; this.warning = ''; this.available = false;
  }
  async init() {
    try {
      this.kv ||= globalThis.localStorage;
      this.locks ||= globalThis.navigator?.locks;
      if (!this.root) this.root = await navigator.storage.getDirectory().then(r => r.getDirectoryHandle(this.namespace.replaceAll('.', '-'), { create: true }));
      const probe = `${this.namespace}.probe`; this.kv.setItem(probe, '1'); this.kv.removeItem(probe);
      this.available = !!this.locks?.request;
      if (!this.available) this.warning = 'Safe concurrent saves are unavailable in this browser. Use file export; existing recordings can still be opened.';
    } catch { this.warning = 'Persistent replay storage is unavailable. Play normally, then export your temporary replay to a file.'; this.available = false; }
    return this;
  }
  manifest() {
    let m;
    try { m = JSON.parse(this.kv?.getItem(this.key) || '{"revision":0,"entries":[]}'); }
    catch { this.warning = 'Library metadata could not be read. Valid recording files are offered for recovery.'; return { revision: 0, entries: [] }; }
    if (!m || !Number.isSafeInteger(m.revision) || !Array.isArray(m.entries) || m.entries.length > 5 || !m.entries.every(e => e && FILE.test(e.file) && e.id === e.file.slice(2, -9) && ['local', 'imported', 'harness'].includes(e.origin) && typeof e.label === 'string' && e.label.length <= 100) || new Set(m.entries.map(e => e.file)).size !== m.entries.length) {
      this.warning = 'Library metadata is damaged. No files were deleted; use recovered recordings below.';
      return { revision: 0, entries: [] };
    }
    return m;
  }
  async readFile(file) {
    if (!this.root || !FILE.test(file)) throw new Error('Recording file is unavailable.');
    const f = await (await this.root.getFileHandle(file)).getFile();
    if (f.size > MAX_REPLAY_BYTES) throw new Error('Stored replay exceeds the supported file limit.');
    return parseReplay(await f.text());
  }
  async list() {
    const m = this.manifest(), entries = [], orphans = [], problems = [];
    for (const e of m.entries) {
      try { const replay = await this.readFile(e.file); entries.push({ ...e, replay }); }
      catch { problems.push(e); }
    }
    if (this.root) {
      let inspected = 0;
      try {
        for await (const [file] of this.root.entries()) {
          if (!FILE.test(file) || m.entries.some(e => e.file === file)) continue;
          if (++inspected > 32) { this.warning = 'More recovered files remain. Resolve the listed files and reopen the library.'; break; }
          try { orphans.push({ file, id: file.slice(2, -9), replay: await this.readFile(file), origin: 'imported' }); }
          catch { problems.push({ file, id: file.slice(2, -9), label: 'Incomplete recording file', orphan: true }); }
        }
      } catch { this.warning ||= 'Some recording files could not be read. File export remains available for the current run.'; }
    }
    return { revision: m.revision, entries, orphans, problems, capacity: m.entries.length, warning: this.warning, writable: this.available };
  }
  async save(replay, { origin = 'local', replaceId, expectedRevision, recoveredFile } = {}) {
    const checked = validateReplay(replay);
    const body = JSON.stringify(checked);
    if (new TextEncoder().encode(body).byteLength > MAX_REPLAY_BYTES) throw new Error('This recording is too large to save.');
    if (!this.available) throw new Error(this.warning || 'Persistent storage is unavailable. Export the replay instead.');
    return this.locks.request(`${this.namespace}.write`, async () => {
      const m = this.manifest();
      if (expectedRevision !== undefined && expectedRevision !== m.revision) throw new Error('Another tab changed the library. Reopen it and choose again; nothing was replaced.');
      const replacing = replaceId && m.entries.find(e => e.id === replaceId);
      if (replaceId && !replacing) throw new Error('That recording changed in another tab. Choose again.');
      if (m.entries.length >= 5 && !replacing) return { full: true, revision: m.revision, entries: m.entries };
      const id = recoveredFile ? recoveredFile.slice(2, -9) : crypto.randomUUID(), file = recoveredFile || `r-${id}.solstice`;
      if (!FILE.test(file)) throw new Error('Invalid recovered file.');
      if (!recoveredFile) {
        let writable;
        try { writable = await (await this.root.getFileHandle(file, { create: true })).createWritable(); await writable.write(body); await writable.close(); }
        catch { try { await writable?.abort(); } catch {} throw new Error('Replay could not be written. Your previous recordings are intact. Export this run instead.'); }
      }
      // Verify the complete new file before committing the small manifest.
      await this.readFile(file);
      const car = CARS.find(c => c.id === checked.setup.car);
      const entry = { id, file, origin, label: `${car.name} · ${checked.result.outcome}`, date: checked.created, duration: checked.result.duration, course: checked.setup.course };
      const entries = replacing ? m.entries.map(e => e.id === replaceId ? entry : e) : [...m.entries, entry];
      try { this.kv.setItem(this.key, JSON.stringify({ revision: m.revision + 1, entries })); }
      catch { throw new Error('Library metadata could not be saved. The new file is preserved as a recoverable recording; no old entry was replaced.'); }
      if (replacing && replacing.file !== file) { try { await this.root.removeEntry(replacing.file); } catch { this.warning = 'The replaced file remains available under recovered files.'; } }
      return { full: false, entry };
    });
  }
  async remove(id, orphanFile) {
    if (!this.available) throw new Error('Storage is read-only in this browser.');
    return this.locks.request(`${this.namespace}.write`, async () => {
      const m = this.manifest(), e = m.entries.find(e => e.id === id);
      const file = e?.file || orphanFile;
      if (!FILE.test(file)) throw new Error('Recording no longer exists.');
      // File first: a failed deletion leaves the prior manifest and entry intact.
      try { await this.root.removeEntry(file); } catch (err) { if (err.name !== 'NotFoundError') throw new Error('The file could not be deleted. Nothing was removed from the library.'); }
      try { this.kv.setItem(this.key, JSON.stringify({ revision: m.revision + 1, entries: m.entries.filter(x => x.id !== id) })); }
      catch { throw new Error('The recording file was deleted, but stale metadata remains. Reopen the library to remove the missing entry.'); }
    });
  }
  async forgetMissing(id) {
    if (!this.available) throw new Error('Storage is read-only.');
    return this.locks.request(`${this.namespace}.write`, async () => {
      const m = this.manifest();
      this.kv.setItem(this.key, JSON.stringify({ revision: m.revision + 1, entries: m.entries.filter(e => e.id !== id) }));
    });
  }
}
export async function writeRecord(kv, locks, sim, namespace = 'solstice.v1') {
  if (sim.source !== 'local' && sim.source !== 'harness') return false;
  if (sim.source === 'harness' && !namespace.startsWith('solstice.test.')) throw new Error('Harness records must use disposable test storage.');
  if (sim.status !== 'done' || sim.result?.outcome !== 'completed' || sim.track.mode !== 'trial' || sim.result.best === null) return false;
  const operation = () => {
    const key = `${namespace}.records`, context = `${sim.track.id}:${sim.setup.car}:${sim.setup.weather}:${sim.setup.daylight}`;
    let records = readRecords(kv, namespace);
    const old = records[context];
    if (old && old.time <= sim.result.best) return false;
    records[context] = { time: sim.result.best, car: sim.setup.car, course: sim.track.id, weather: sim.setup.weather, daylight: sim.setup.daylight, date: sim.startedAt, source: sim.source };
    kv.setItem(key, JSON.stringify(records)); return true;
  };
  return locks?.request ? locks.request(`${namespace}.records`, operation) : operation();
}
export function readRecords(kv, namespace = 'solstice.v1') {
  try {
    const values = JSON.parse(kv.getItem(`${namespace}.records`) || '{}');
    return Object.fromEntries(Object.entries(values).filter(([k, v]) => /^coastal:(tern|mistral|solano):[0-2]:[0-3]$/.test(k) && v && Number.isFinite(v.time) && v.time > 0 && v.time < 1800 && ['local', 'harness'].includes(v.source)));
  } catch { return {}; }
}
