// window.__RACING__ : the hooks used by the verifier (tests, screenshots, sweep, performance, audio). Nothing here is used by normal play.
import * as THREE from 'three';
import { CAR_LIST } from '../physics/car-specs.js';
import { sceneStats, skyFraction } from './audit.js';
import { LapRecorder } from './recorder.js';

export function installApi(api, game, S) {
  const T = game.T;
  const r2 = (x) => +x.toFixed(2);
  Object.defineProperties(api, {
    fps: { get: () => game.fps },
    state: { get: () => game.state },
    race: { get: () => game.race },
    player: { get: () => game.race && game.race.player },
  });
  Object.assign(api, {
    game, S, world: S.world, scene: S.scene, camera: S.camera, renderer: S.renderer, env: S.env, lighting: S.lighting, materials: S.materials,
    post: S.post, barriers: S.barriers, veg: S.veg, village: S.village, sea: S.sea, audio: game.audio, ui: game.ui, cam: game.cam,

    // ---- flow
    startRace({ car = 'gt', livery = 0, laps = 3, diff = 'normal' } = {}) {
      game.sel = { ...game.sel, carIdx: Math.max(0, CAR_LIST.indexOf(car)), livery, laps, diff }; game.ui.sel = { ...game.ui.sel, ...game.sel };
      game.startRace(game.sel); return game.state;
    },
    skipToRace() { let n = 0; while (game.state === 'grid' && n++ < 400) game.advance(0.1); n = 0; while (game.state === 'countdown' && n++ < 100) game.advance(0.1); return game.state; },
    autoStart(o) { api.startRace(o); if (o.skip !== false) api.skipToRace(); return game.state; },
    autopilot(on = true) { const p = game.race && game.race.player; if (p) p.autopilot = !!on; return !!p; },
    advance(sec) { game.advance(sec); return { t: game.race ? +game.race.t.toFixed(2) : 0, state: game.state }; },
    pause(p) { game.pause(p); return game.paused; },
    toMenu() { game.toMenu(); return game.state; },
    restart() { game.restartRace(); return game.state; },
    click(id) { const el = game.ui.$(id) || document.getElementById(id); if (el) el.click(); return !!el; },
    key(code, down = true) { if (down) { game.input.down.add(code); game.input.pressed.add(code); } else game.input.down.delete(code); },
    fakeInput(inp) { game._fakeInput = inp; },
    /** test-only manual drive: inp = controls object, or null to give the car back to the autopilot */
    drive(inp) { const p = game.race && game.race.player; if (!p) return false; game._fakeInput = inp || null; p.autopilot = !inp; return true; },
    setFast(on) { game._fast = !!on; },

    // ---- camera
    setCamera(pos, target, fov = 65, up = [0, 1, 0]) { game.cam.manual = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), fov }; S.camera.up.set(...up); },
    freeze(on) { game._freeze = !!on; return game._freeze; },
    hud(on) { game.ui.hudVisible(!!on); game.testHooks.noUi = !on; if (!on) game.ui.show('none'); else if (game.race) game.ui.show('hud'); return true; },
    clearCamera() { game.cam.manual = null; S.camera.up.set(0, 1, 0); },
    camInfo() { const c = S.camera; return { pos: c.position.toArray().map(r2), fov: r2(c.fov), mode: game.cam.mode, violations: game.cam.violations, minClear: r2(game.cam.minClear) }; },

    // ---- placing cars (screenshots, tests)
    teleport(i, s, lat = 0, speed = 0) { const R = game.race || game.demo; return !!R && !!game.teleport(R.cars[i], s, lat, speed); },
    placePlayer(s, lat = 0, speed = 0) { const p = game.race && game.race.player; if (!p) return false; game.teleport(p, s, lat, speed); return true; },
    /** AI cars in a loose pack around the player: [{dS, lat}] relative to the player's s, same speed */
    pack(list, speed) {
      const R = game.race; if (!R) return false; const p = R.player; const ai = R.cars.filter((c) => !c.isPlayer);
      list.forEach((o, k) => { if (ai[k]) game.teleport(ai[k], p.sTrack + o.dS, o.lat, speed); });
      return true;
    },

    // ---- measurements
    perfStart() { game.frameMs.length = 0; game.perfOn = true; },
    perfStop() {
      game.perfOn = false; const a = game.frameMs.slice().sort((x, y) => x - y); if (!a.length) return null;
      const mean = a.reduce((s, x) => s + x, 0) / a.length, n1 = Math.max(1, Math.ceil(a.length * 0.01)); const worst = a.slice(-n1); const w1 = worst.reduce((s, x) => s + x, 0) / worst.length;
      return { frames: a.length, avgFps: +(1000 / mean).toFixed(1), low1Fps: +(1000 / w1).toFixed(1), p50ms: +a[Math.floor(a.length * 0.5)].toFixed(2), p99ms: +a[Math.floor(a.length * 0.99)].toFixed(2), maxMs: +a[a.length - 1].toFixed(1) };
    },
    heap() { const m = performance.memory; return m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize } : null; },
    renderInfo() { const i = S.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0 }; },
    raceSnapshot() {
      const R = game.race; if (!R) return null;
      return {
        state: game.state, raceState: R.state, t: r2(R.t), laps: R.laps, stats: R.stats, resets: R.cars.map((c) => c.resets), log: R.log.slice(-20),
        cars: R.cars.map((c) => ({ id: c.id, name: c.name, pos: c.position, lap: c.lapsDone, s: r2(c.sTrack), lat: r2(c.lat), kmh: r2(c.v.speed * 3.6), finished: c.finished, finishTime: r2(c.finishTime), best: isFinite(c.bestLap) ? r2(c.bestLap) : null, onRoad: c.onRoad, stuck: r2(c.stuckTime), projected: r2(c.projected) })),
      };
    },
    sceneStats() { return sceneStats(S, game); },
    skyFraction() { return skyFraction(S, game); },
    validate() { const r = S.validate(); return { ok: r.ok, errors: r.errors.slice(0, 20), stats: r.stats }; },
    recorder(w, h) { api._rec = new LapRecorder(game, w, h); return true; },
    camStats() { return { ...game.camStats }; },
    audioSnapshot() { return { ...game.audio.snapshot(), stats: { ...game.audio.stats }, limiter: game.audio.limiterKind }; },
  });
}
