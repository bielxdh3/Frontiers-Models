// Development only. Vite removes this module and the installation branch from production.
import { STEP, aiInput, EMPTY_INPUT } from './sim.js';
import { parseReplay, sampleReplay } from './replay.js';
import { readRecords } from './storage.js';

export async function installHarness(app, hooks) {
  await app.library.init();
  app.harnessBusy = true;
  const state = () => ({ namespace: app.namespace, source: app.source, screen: app.screen, status: app.sim?.status, time: app.sim?.time, countdown: app.sim?.countdown, cars: app.sim?.cars.map(c => ({ id: c.id, name: c.name, x: c.x, z: c.z, heading: c.heading, speed: c.speed, damage: c.damage.slice(), nitro: c.nitro, drifting: c.drifting, boosting: c.boosting, ghost: c.ghost, progress: structuredClone(c.p) })), result: app.sim?.result, frames: app.sim?.frames.length, env: app.sim?.env, remaining: app.sim?.remaining, score: app.sim?.score, combo: app.sim?.combo, held: [...app.held], prefs: structuredClone(app.prefs), dirty: app.dirty });
  window.__solsticeTest = {
    state,
    audio() { return { active: app.audio.ready, state: app.audio.context?.state || 'uninitialized', voices: app.audio.voices.size, engineGain: app.audio.engine?.gain.value || 0 }; },
    async begin(setup = {}) { app.setup = { ...app.setup, ...setup }; await hooks.startRace(); app.harnessBusy = true; return state(); },
    async advance(seconds, policy = 'auto', difficulty = 2) {
      if (!app.sim || seconds < 0 || seconds > 900) throw new Error('Invalid bounded harness step.');
      app.harnessBusy = true;
      const count = Math.ceil(seconds / STEP);
      for (let i = 0; i < count; i++) {
        if (app.sim.status === 'done' || app.sim.status === 'paused') break;
        const controls = policy === 'auto' && app.sim.status === 'racing' ? aiInput(app.sim, app.sim.cars[0], difficulty) : policy === 'keyboard' ? hooks.input() : typeof policy === 'object' ? policy : EMPTY_INPUT;
        app.sim.step(controls, STEP);
        if (i && i % 1200 === 0) await new Promise(r => requestAnimationFrame(r));
      }
      if (app.sim.status === 'done') hooks.finishRun(); else if (app.screen === 'race') hooks.updateHUD();
      // Fast fixed-step batches can move many kilometres between rendered frames.
      // Snap the viewing camera to the real resulting state, without changing any physics.
      app.renderer.snap = true;
      app.renderer.render(hooks.displayState(), app.screen, STEP, { menuTime: app.menuTime, ...app.photo });
      return state();
    },
    realtime(enabled) { app.harnessBusy = !enabled; },
    replay() { return app.lastReplay || app.sim?.replay(); },
    inspectReplay(t) { const r = app.lastReplay || app.playback?.data; return r ? sampleReplay(r, t) : null; },
    async save(options = {}) { return app.library.save(app.lastReplay, { origin: 'harness', ...options }); },
    async import(raw, options = {}) { return app.library.save(parseReplay(raw), { origin: 'imported', ...options }); },
    async list() { const l = await app.library.list(); return { ...l, entries: l.entries.map(({ replay, ...e }) => e), orphans: l.orphans.map(({ replay, ...e }) => e) }; },
    records() { return readRecords(hooks.kv, app.namespace); },
    openReplay() { hooks.openReplay(app.lastReplay, { origin: 'harness', temporary: true }); },
    openLibrary: hooks.showLibrary,
    denyStorage(denied = true) { app.library.available = !denied; app.library.warning = denied ? 'Persistent storage denied by development test. Export remains available.' : ''; },
    failManifest(enabled = true) {
      app.library.kv = enabled ? { getItem: k => hooks.kv.getItem(k), removeItem: k => hooks.kv.removeItem(k), setItem: (k, v) => { if (k === app.library.key) throw new DOMException('Test quota exhausted', 'QuotaExceededError'); hooks.kv.setItem(k, v); } } : hooks.kv;
    },
    async purge() {
      if (!app.namespace.startsWith('solstice.test.')) throw new Error('Only isolated test storage can be purged.');
      await navigator.locks.request(`${app.namespace}.write`, async () => {
        if (app.library.root) for await (const [name] of app.library.root.entries()) await app.library.root.removeEntry(name);
        for (const suffix of ['library', 'prefs', 'records', 'probe']) hooks.kv.removeItem(`${app.namespace}.${suffix}`);
      });
      app.library.kv = hooks.kv; app.library.available = true; app.library.warning = '';
    },
    graphics() { const r = app.renderer; const gl = r.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info'); return { quality: app.prefs.quality, size: [r.canvas.width, r.canvas.height], drawCalls: r.renderer.info.render.calls, triangles: r.renderer.info.render.triangles, geometries: r.renderer.info.memory.geometries, textures: r.renderer.info.memory.textures, shadows: r.renderer.shadowMap.enabled, shadowMapSize: r.sun.shadow.mapSize.x, rainBudget: r.rainCount, sceneryInstances: (r.batches?.meshes || []).filter(m => m.userData.detail).reduce((sum, m) => sum + m.count, 0), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), activeAnimationOwners: 1 }; },
    loseContext() { app.renderer.renderer.forceContextLoss(); },
    restoreContext() { app.renderer.renderer.forceContextRestore(); }
  };
}
