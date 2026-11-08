// Game: state machine (menu with live background -> garage -> setup -> grid presentation -> 3-2-1 -> race -> results -> again/menu),
// fixed-step physics at 120 Hz, 6 cars (1 player + 5 AI with the same physics), camera rig, HUD, audio, particles and the test API.
import * as THREE from 'three';
import { Vehicle } from '../physics/vehicle.js';
import { CAR_SPECS, CAR_LIST, LIVERIES } from '../physics/car-specs.js';
import { Driver } from '../ai/driver.js';
import { CarModel } from '../render/car-model.js';
import { Race, RaceCar } from './race.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { UI } from '../ui/ui.js';
import { PHYS, RULES, AI_NAMES } from './config.js';
import { GameAudio } from '../audio/audio.js';
import { cameraInside } from './audit.js';

const DT = PHYS.dt;
const ROSTER = [
  { name: AI_NAMES[0], carId: 'gt', skill: 1.000, bias: -1.3 },
  { name: AI_NAMES[1], carId: 'hatch', skill: 0.986, bias: 1.5 },
  { name: AI_NAMES[2], carId: 'gt', skill: 0.972, bias: -0.5 },
  { name: AI_NAMES[3], carId: 'hatch', skill: 0.958, bias: 0.8 },
  { name: AI_NAMES[4], carId: 'gt', skill: 0.944, bias: 0.0 },
  { name: AI_NAMES[5], carId: 'hatch', skill: 0.93, bias: -0.9 },
];
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };

export class Game {
  constructor(S, uiRoot, params) {
    this.S = S; this.params = params; this.uiRoot = uiRoot;
    const { camera, world, lighting, env } = S;
    this.world = world; this.T = world.track; this.camera = camera; this.scene = S.scene; this.renderer = S.renderer;
    this.qName = S.state.qName;
    this.cam = new CameraRig(camera, world);
    this.input = new Input(window);
    this.particles = new Particles(S.scene, lighting);
    this.audio = new GameAudio(); this.audio.setTrack(world.track);
    if (S.village && S.village.church) { const c = S.village.church; this.audio.setBellPos([c.x, c.y + (c.height || 20) * 0.8, c.z]); }
    this.state = 'loading'; this.paused = false; this.race = null; this.demo = null; this.garage = null;
    this.acc = 0; this.clock = 0; this.last = performance.now(); this.lastFov = 0;
    this.gridT = 0; this.gridDur = RULES.gridPresentation; this.finishT = 0; this.evIdx = 0; this.lastCount = -1; this.lampT = 0;
    this.sel = Object.assign({ carIdx: 0, livery: 0, laps: 3, diff: 'normal', quality: this.qName }, LS('racing.sel') || {}); this.sel.quality = this.qName;
    this.lastSel = null; this.pin = { steer: 0, throttle: 0, brake: 0, handbrake: 0, assist: 0.45 };
    this.frameMs = []; this.perfOn = false; this.fps = 0; this._fpsN = 0; this._fpsT = performance.now();
    this.hudT = 0; this.mapT = 0; this.stats = { restarts: 0, races: 0, frames: 0 };
    this.camPrev = new THREE.Vector3(); this.camVel = new THREE.Vector3(); this.manualCam = null;
    this.forceChase = false; this.testHooks = { noUi: false };
    this.camView = 'chase'; this.camStats = { frames: 0, violations: 0, minClear: 1e9, log: [] };
    this._loop = this._loop.bind(this);
    this.ui = new UI(uiRoot, {
      quality: this.qName,
      onPlay: () => this.toGarage(), onGarage: () => this.setState('garage'), onGarageOk: (s) => { this.sel = { ...this.sel, ...s }; LS('racing.sel', this.sel); this.setState('setup'); },
      onStart: (s) => { this.sel = { ...this.sel, ...s }; LS('racing.sel', this.sel); this.startRace(this.sel); },
      onResume: () => this.pause(false), onRestart: () => this.restartRace(), onMenu: () => this.toMenu(), onAgain: () => this.startRace(this.lastSel || this.sel),
      onVolume: (k, v) => this.audio.setVolumes({ [k]: v }),
      onOption: (k, v) => this._option(k, v),
      onGarageChange: (s) => { this.sel = { ...this.sel, ...s }; this._garageCar(); this.audio.ui('nav'); },
    });
    this.ui.sel = { ...this.ui.sel, ...this.sel }; this.ui.refreshOpts(); this.ui.garageRefresh();
    this.ui.vol = { ...this.audio.vol };
    for (const k of ['master', 'sfx', 'music']) { const el = this.ui.$('v-' + k); el.value = Math.round(this.audio.vol[k] * 100); this.ui.$('vv-' + k).textContent = el.value; }
    this.ui.initMap(this.T);
    this._wireUiSounds();
  }

  // ------------------------------------------------------------------ boot
  async init(onProgress = () => {}) {
    this.audio.preload((p) => onProgress(p));
    this.setState('menu');
    // make sure every shader program is linked before the first frame (no first-frame stall, no programs deleted while compiling)
    try { await this.S.renderer.compileAsync(this.S.scene, this.camera); } catch (e) { console.warn('compileAsync', e); }
    this.camera.updateMatrixWorld(); this.S.lighting.update(this.camera, this.scene.fog); this.S.post.renderFrame(0);
    return this;
  }
  start() { this.last = performance.now(); requestAnimationFrame(this._loop); }

  _wireUiSounds() {
    const root = this.uiRoot;
    let lastNav = 0;
    root.addEventListener('mouseover', (e) => { const b = e.target.closest && e.target.closest('.btn,.sw'); if (b && performance.now() - lastNav > 70) { lastNav = performance.now(); this.audio.ui('nav'); } });
    root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.btn,.sw'); if (!b) return; this.audio.ui(/back|menu|restart/.test(b.id) ? 'back' : 'ok'); });
    const unlock = () => { this.audio.unlock().then((ok) => { if (ok) this._audioReady(); }); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.race && !this.paused && ['racing', 'countdown'].includes(this.state)) this.pause(true); });
  }
  _audioReady() { if (this._audioStarted) return; this._audioStarted = true; this._syncAudioRace(); }

  _option(k, v) {
    if (k === 'quality' && v !== this.qName) {
      LS('racing.sel', { ...this.sel, quality: v });
      this.ui.toast('Aplicando qualidade…', 1200);
      setTimeout(() => { const u = new URL(location.href); u.searchParams.set('q', v); location.href = u.toString(); }, 350);
    } else { this.sel = { ...this.sel, [k]: v }; LS('racing.sel', this.sel); }
    this.audio.ui('ok');
  }

  // ------------------------------------------------------------------ cars
  _models(carId, livery, lods = [0, 1]) {
    const ctx = { lighting: this.S.lighting, env: this.S.env };
    return lods.map((l) => { const m = new CarModel(carId, livery, ctx, l); m.addTo(this.scene); return m; });
  }
  _disposeModels(models) {
    for (const m of models) {
      this.scene.remove(m.root); this.scene.remove(m.blobHolder);
      m.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      m.blob.geometry.dispose(); m.blob.material.dispose();
      for (const k of Object.keys(m.mats)) if (m.mats[k] && m.mats[k].isMaterial) m.mats[k].dispose();
    }
  }
  _makeCar(id, o) {
    const spec = CAR_SPECS[o.carId], v = new Vehicle(spec, this.world.ground, id);
    const driver = new Driver(this.S.racing, this.T, { difficulty: o.difficulty, skill: o.skill, lineBias: o.bias });
    const models = this._models(o.carId, o.livery, o.isPlayer ? [0] : [0, 1]);
    const rc = new RaceCar(id, v, { name: o.name, isPlayer: !!o.isPlayer, driver, livery: o.livery, carId: o.carId, model: models[0] });
    rc.models = models; rc.lod = 0; rc.gridSlot = o.slot; return rc;
  }
  _disposeRace(r) {
    if (!r) return;
    for (const c of r.cars) this._disposeModels(c.models);
    r.cars.length = 0;
  }
  _buildRace({ laps, diff, carIdx, livery, withPlayer, demo }) {
    const race = new Race(this.world, { laps, difficulty: diff });
    const liveries = LIVERIES.map((_, i) => i).filter((i) => i !== livery);
    const d = diff || 'normal';
    let id = 0;
    const slots = withPlayer ? [0, 1, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
    if (withPlayer) race.addCar(this._makeCar(id++, { name: 'Você', carId: CAR_LIST[carIdx], livery, isPlayer: true, difficulty: 'hard', skill: 1, bias: 0, slot: 3 }));
    const n = withPlayer ? 5 : 6;
    for (let k = 0; k < n; k++) {
      const r = ROSTER[k];
      race.addCar(this._makeCar(id++, { name: r.name, carId: r.carId, livery: liveries[k % liveries.length], difficulty: demo ? 'hard' : d, skill: r.skill, bias: r.bias, slot: slots[k] }));
    }
    race.placeOnGrid(); race.vs = race.cars.map((c) => c.v);
    return race;
  }

  // ------------------------------------------------------------------ state machine
  setState(s) {
    const prev = this.state; this.state = s;
    const ui = this.ui, cam = this.cam;
    this.audio.setMode(s);
    switch (s) {
      case 'menu':
        this._disposeGarage(); this._endRaceAudio();
        if (!this.demo) { this.demo = this._buildRace({ laps: 99, diff: 'hard', carIdx: 0, livery: 0, withPlayer: false, demo: true }); this.demo.go(); this.evIdx = 0; }
        this.race = null; ui.show('menu'); cam.setMode('menu'); this._syncAudioRace(); this.paused = false; break;
      case 'garage':
        this._disposeDemo(); this._garageCar(); ui.show('garage'); cam.setMode('garage'); this._syncAudioRace(); break;
      case 'setup': ui.show('setup'); break;
      case 'grid':
        this.gridT = 0; ui.setGrid(this.race.cars.slice().sort((a, b) => a.gridSlot - b.gridSlot).map((c, k) => ({ pos: k + 1, name: c.name, isPlayer: c.isPlayer, car: CAR_SPECS[c.carId].name })));
        ui.show('grid'); cam.setMode('grid'); this.S.barriers.gantry?.setLights(0); this.lastCount = -1; break;
      case 'countdown': ui.show('hud'); cam.setMode(this.camView); this.race.startCountdown(); this.lastCount = -1; this.lampT = 0; break;
      case 'racing': break;
      case 'finished': this.finishT = 0; break;
      case 'results': break;
    }
  }

  toMenu() { this._disposeRace(this.race); this.race = null; this._disposeGarage(); this.ui.hudVisible(false); this.paused = false; this._cdClear(); this.setState('menu'); }
  toGarage() { this.setState('garage'); }

  startRace(sel) {
    this.stats.races++;
    this._disposeDemo(); this._disposeGarage(); this._disposeRace(this.race);
    this.lastSel = { ...sel };
    this.race = this._buildRace({ laps: sel.laps, diff: sel.diff, carIdx: sel.carIdx, livery: sel.livery, withPlayer: true });
    this.race.vs = this.race.cars.map((c) => c.v);
    this.paused = false; this.evIdx = 0; this.acc = 0; this._cdClear();
    this._syncAudioRace(); this.setState('grid');
    this.gridDur = this._fast ? 0.2 : RULES.gridPresentation;
    this.audio.ui('ok');
  }
  restartRace() {
    this.stats.restarts++; const sel = this.lastSel || this.sel;
    this.pause(false, true);
    this.startRace(sel); this.gridDur = 2.2;
  }

  pause(p, silent = false) {
    if (p === this.paused) return;
    if (p && !['racing', 'countdown', 'finished'].includes(this.state)) return;
    this.paused = p; this.audio.setPaused(p);
    if (p) { this.ui.show('pause'); if (!silent) this.audio.ui('pause'); }
    else { this.ui.show('hud'); this.ui.hudVisible(true); if (!silent) this.audio.ui('resume'); this.last = performance.now(); }
  }

  _endRaceAudio() { this.audio.endRace(); this._audioRaceFor = null; }
  _syncAudioRace() {
    if (!this.audio.ready) return;
    const R = this.race || this.demo;
    if (!R) { if (this._audioRaceFor) this._endRaceAudio(); return; }
    if (this._audioRaceFor === R) return;
    this.audio.beginRace(R.cars, { demo: R === this.demo }); this._audioRaceFor = R;
  }
  _disposeDemo() { if (this.demo) { if (this._audioRaceFor === this.demo) this._endRaceAudio(); this._disposeRace(this.demo); this.demo = null; } }

  // ------------------------------------------------------------------ garage (a parked car on the start straight)
  _garageCar() {
    const { carIdx, livery } = this.sel; const carId = CAR_LIST[carIdx];
    if (this.garage && this.garage.carId === carId && this.garage.livery === livery) return;
    const T = this.T, i = T.indexAtS(T.length - 22), p = T.roadPoint(i, 0.0, 0);
    const sameCar = this.garage && this.garage.carId === carId;
    if (this.garage) this._disposeModels(this.garage.models);
    const v = sameCar ? this.garage.v : new Vehicle(CAR_SPECS[carId], this.world.ground, 99);
    if (!sameCar) { v.reset(p.x, p.z, T.heading[i], i, 0); for (let k = 0; k < 120; k++) v.step(DT, { steer: 0, throttle: 0, brake: 1, handbrake: 1, assist: 0, held: true }); }
    const models = this._models(carId, livery, [0]);
    this.garage = { carId, livery, v, models, turn: { x: p.x, y: p.y, z: p.z, yaw: T.heading[i] } };
    if (!sameCar) this.audio.revDemo(carId);
  }
  _disposeGarage() { if (this.garage) { this._disposeModels(this.garage.models); this.garage = null; } }

  // ------------------------------------------------------------------ the fixed-step simulation tick
  _playerInput() {
    const R = this.race, p = R && R.player;
    if (this._fakeInput) return this._fakeInput;
    if (!p || this.paused || !['countdown', 'racing'].includes(this.state)) return { steer: 0, throttle: 0, brake: 0, handbrake: 0, assist: 0.45 };
    return this.pin;
  }
  _tick(race, dt, pin) {
    const cars = race.cars, vs = race.vs, ctl = race.controls(pin, dt);
    for (let k = 0; k < cars.length; k++) cars[k].v.step(dt, ctl[k]);
    this.world.collisions.cars(vs);
    const st = race.stats;
    for (let k = 0; k < vs.length; k++) {
      const pen = this.world.collisions.barriers(vs[k], dt);
      if (pen > st.maxWallPen) st.maxWallPen = pen;
      if (pen > 1.5) { st.colliderCross++; race.log.push({ t: race.t, car: cars[k].id, type: 'collider-crossing', pen: +pen.toFixed(2) }); }
      const a = vs[k].airborne; if (a > st.maxAirborne) st.maxAirborne = a;
    }
    race.update(dt);
  }
  /** one simulation tick for whatever is running (shared by the frame loop and advance()) */
  _simTick(dt) {
    const st = this.state;
    if (st === 'menu') { if (this.demo) this._tick(this.demo, dt, null); return; }
    if (st === 'garage' || st === 'setup') { if (this.garage) this.garage.v.step(dt, { steer: 0, throttle: 0, brake: 1, handbrake: 1, assist: 0, held: true }); return; }
    const R = this.race; if (!R) return;
    if (st === 'grid') {
      this.gridT += dt; this._tick(R, dt, this._playerInput());
      if (this.gridT >= this.gridDur) this.setState('countdown');
      return;
    }
    this._tick(R, dt, this._playerInput());
    if (st === 'countdown' && R.state === 'racing') this._onGo();
    else if (st === 'racing' && R.state === 'finished') this._onPlayerFinish();
    else if (st === 'finished') { this.finishT += dt; if (this.finishT >= 3.6) this._showResults(); }
    this._events(R);
  }

  _cdClear() { const c = this.ui.$('cd'); if (c) { c.classList.remove('show'); c.textContent = ''; } }
  _onGo() { this.state = 'racing'; this.ui.countdown('VAI!', true); this.audio.ui('go'); this.S.barriers.gantry?.setLights(5, true); this.lampT = 0; this.lastCount = 0; }
  _onPlayerFinish() {
    this.state = 'finished'; this.finishT = 0; const p = this.race.player;
    this.ui.toast(`BANDEIRADA! ${p.position}º lugar`, 3200); this.audio.ui('flag');
  }
  _showResults() {
    const R = this.race; if (!R || this.state === 'results') return;
    R.projectTimes();
    const rows = R.cars.slice().sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : a.projected - b.projected))
      .map((c) => ({ id: c.id, name: c.name, car: CAR_SPECS[c.carId].name, finished: c.finished, time: c.finished ? c.finishTime : c.projected, best: c.bestLap }));
    this.results = rows;
    this.state = 'results'; this.ui.showResults(rows, R.player.id); this.ui.hudVisible(false); this._cdClear(); this.cam.setMode('menu');
  }
  _events(R) {
    while (this.evIdx < R.events.length) {
      const e = R.events[this.evIdx++];
      const p = R.player;
      if (!p || e.car !== p.id) continue;
      if (e.type === 'lap') {
        const best = p.bestLap === e.time;
        if (!this._silentEv) { this.ui.toast(`Volta ${e.lap}  ${this._fmt(e.time)}${best ? '  ·  MELHOR' : ''}`, 2600); if (e.lap < R.laps) this.audio.ui('lap'); }
      } else if (e.type === 'reset' && e.reason !== 'manual') { if (!this._silentEv) this.ui.toast('Voltando à pista', 1500); }
    }
    if (R.events.length > 2000) { R.events.splice(0, R.events.length - 500); this.evIdx = Math.min(this.evIdx, R.events.length); }
  }
  _fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; }

  // ------------------------------------------------------------------ frame loop
  _loop(now) {
    requestAnimationFrame(this._loop);
    let dt = (now - this.last) / 1000; this.last = now; dt = Math.min(dt, 0.1);
    if (dt <= 0) return;
    this.frame(dt, now);
  }
  frame(dt, now = performance.now()) {
    this.stats.frames++;
    if (this.perfOn) this.frameMs.push(dt * 1000);
    this._fpsN++; if (now - this._fpsT > 1000) { this.fps = this._fpsN * 1000 / (now - this._fpsT); this._fpsN = 0; this._fpsT = now; }
    this.clock += dt;
    this._guard('input', () => this._input(dt));
    this.input.pressed.clear();
    if (!this.paused && !this._freeze) {
      this.acc += dt; let n = 0;
      this._guard('sim', () => { while (this.acc >= DT && n < PHYS.maxSubSteps) { this._simTick(DT); this.acc -= DT; n++; } });
      if (this.acc > DT * 4) this.acc = 0;
    }
    this._guard('countdown', () => this._countdownUi(dt));
    this._guard('sync', () => this._sync(dt));
    this._guard('camera', () => this._cameraUpdate(dt));
    this._guard('effects', () => this._effects(dt));
    this._guard('audio', () => this._audioUpdate(dt));
    this._clearEvents();
    this._guard('hud', () => this._hud(dt));
    this._render(dt);
  }
  /** a failure in one subsystem must not freeze the whole frame; it is reported (first 3 per site) and the game keeps running */
  _guard(site, fn) {
    try { fn(); } catch (e) {
      const n = (this._errN = this._errN || {})[site] = ((this._errN || {})[site] || 0) + 1;
      if (n <= 3) { console.error(`[${site}]`, e); try { window.__RACING__.errors.push(`[${site}] ${e && e.stack || e}`); } catch {} }
    }
  }

  _input(dt) {
    const inp = this.input, st = this.state;
    this.pin = inp.poll(dt);
    const confirm = inp.action('confirm'), esc = inp.action('pause'), bksp = inp.action('back'), back = esc || bksp;
    if (st === 'menu') { if (confirm) this.toGarage(); }
    else if (st === 'garage') {
      if (inp.action('left')) this.ui.garageStep(-1);
      if (inp.action('right')) this.ui.garageStep(1);
      for (let i = 0; i < 6; i++) if (inp.hit('Digit' + (i + 1))) this.ui.pickLivery(i);
      if (confirm) this.ui.$('g-ok').click(); else if (back) this.ui.$('g-back').click();
    } else if (st === 'setup') { if (confirm) this.ui.$('s-go').click(); else if (back) this.ui.$('s-back').click(); }
    else if (st === 'grid') { if (confirm) this.gridT = Math.max(this.gridT, this.gridDur - 0.01); }
    else if (st === 'results') { if (confirm) this.startRace(this.lastSel || this.sel); else if (back) this.toMenu(); }
    else if (this.paused) { if (esc || confirm) this.pause(false); }
    else if (st === 'countdown' || st === 'racing' || st === 'finished') {
      if (esc) this.pause(true);
      if (inp.action('camera')) { this.camView = this.camView === 'chase' ? 'hood' : 'chase'; this.cam.setMode(this.camView); }
      if (inp.action('reset') && this.race && this.state === 'racing') this.race.resetCar(this.race.player, 'manual');
    }
    inp.pressed.clear();
  }

  _countdownUi(dt) {
    const R = this.race; if (!R) return;
    if (this.state === 'countdown') {
      if (R.count !== this.lastCount && R.count > 0) { this.lastCount = R.count; this.ui.countdown(String(R.count)); this.audio.ui('count'); }
      const lit = Math.min(5, Math.floor(R.countT * 5 / 3) + 1);
      this.S.barriers.gantry?.setLights(lit, false);
    } else if (this.state === 'racing' || this.state === 'finished') {
      if (this.lampT < 50) { this.lampT += dt; if (this.lampT > 1.8) { this.S.barriers.gantry?.setLights(0); this.lampT = 99; } }
    }
  }

  /** poses of every model + LOD switching */
  _sync(dt) {
    const R = this.race || this.demo;
    const cp = this.camera.position;
    if (R) {
      const braking = (c) => (c.isPlayer ? this.pin.brake > 0.1 : c.v.brake > 0.1) && c.v.speed > 1 ? 1 : 0;
      for (const c of R.cars) {
        const v = c.v, dx = v.p[0] - cp.x, dz = v.p[2] - cp.z, d2 = dx * dx + dz * dz;
        const want = d2 < 60 * 60 || c.isPlayer ? 0 : 1;
        c.lod = want;
        c.models.forEach((m, k) => { const on = k === (c.models.length > 1 ? want : 0); m.root.visible = on; if (!on) m.blobHolder.visible = false; });
        const m = c.models[c.models.length > 1 ? want : 0];
        m.update(v, dt, { braking: braking(c) });
      }
    }
    if (this.garage && (this.state === 'garage' || this.state === 'setup')) this.garage.models[0].update(this.garage.v, dt, { braking: 0 });
  }

  _cameraUpdate(dt) {
    const st = this.state, R = this.race, cam = this.cam;
    const lead = st === 'menu' ? (this.demo && (this.demo.order ? this.demo.order[0] : this.demo.cars[0])) : (R && R.cars.find((c) => c.position === 1));
    cam.update(dt, {
      car: R && R.player ? R.player.v : null, flyCar: st === 'results' ? (R && R.player ? R.player.v : lead && lead.v) : (lead ? lead.v : null),
      gridCars: R ? R.cars : [], player: R ? R.player : null, turntable: this.garage && this.garage.turn,
    });
    this.camera.updateMatrixWorld();
    if (R && R.player && ['countdown', 'racing', 'finished'].includes(st)) {
      const bad = cameraInside(this.world, this.camera.position), cs = this.camStats; cs.frames++;
      if (bad) { cs.violations++; if (cs.log.length < 20) cs.log.push({ t: +R.t.toFixed(2), what: bad, p: this.camera.position.toArray().map((x) => +x.toFixed(1)) }); }
      cs.minClear = Math.min(cs.minClear, this.cam.minClear);
    }
    if (Math.abs(this.camera.fov - this.lastFov) > 0.5) { this.S.lighting.resize(); this.lastFov = this.camera.fov; }
    this.camVel.copy(this.camera.position).sub(this.camPrev).multiplyScalar(1 / Math.max(dt, 1e-3)); this.camPrev.copy(this.camera.position);
    if (this.camVel.lengthSq() > 160000) this.camVel.set(0, 0, 0);
  }

  _effects(dt) {
    const R = this.race || this.demo; if (!R || this.paused) { this.particles.update(this.paused ? 0 : dt, this.renderer, this.camera); return; }
    const cp = this.camera.position;
    for (const c of R.cars) this.particles.emitVehicle(c.v, c.id, dt, cp);
    if (R.player && R.player.v.ev.impact > 0.05) { this.cam.impact(R.player.v.ev.impact); }
    for (const c of R.cars) if (c.v.ev.impact > 0.1) this.particles.burst(c.v.p[0], c.v.p[1] + 0.5, c.v.p[2], Math.round(6 + c.v.ev.impact * 24), 2 + c.v.ev.impact * 6);
    this.particles.update(dt, this.renderer, this.camera);
  }

  _audioUpdate(dt) {
    if (!this.audio.ready) return;
    this._syncAudioRace();
    const R = this.race || this.demo, cam = this.camera, m = cam.matrixWorld.elements;
    let s = 0; if (R) { const p = R.player || (R.order && R.order[0]) || R.cars[0]; s = p ? p.sTrack : 0; }
    if (!this.paused || true) {
      this.audio.update(dt, {
        cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z, fx: -m[8], fy: -m[9], fz: -m[10], ux: m[4], uy: m[5], uz: m[6], vx: this.camVel.x, vy: this.camVel.y, vz: this.camVel.z },
        cars: R ? R.cars : [], player: this.race ? this.race.player : null, s, raceT: R ? R.t : 0, state: this.state,
      });
    }
  }
  _clearEvents() {
    for (const R of [this.race, this.demo]) if (R) for (const c of R.cars) { const e = c.v.ev; e.shifts = 0; e.impact = 0; e.scrape = 0; e.bodyHit = 0; }
  }

  _hud(dt) {
    const ui = this.ui, R = this.race;
    this.hudT += dt; this.mapT += dt;
    if (!R || !['countdown', 'racing', 'finished', 'grid'].includes(this.state) && !this.paused) return;
    const p = R.player; if (!p) return;
    if (this.hudT > 1 / 15) {
      this.hudT = 0;
      const v = p.v, e = v.spec.engine;
      ui.setHud({
        pos: p.position || 1, n: R.cars.length, lap: Math.min(R.laps, p.lapsDone + 1), laps: R.laps, cur: p.startCrossed || this.state !== 'racing' ? p.currentLapTime : 0,
        best: p.bestLap, kmh: Math.abs(v.speed) * 3.6, gear: v.reverse ? 'R' : (Math.abs(v.speed) < 0.6 && v.throttle < 0.05 ? 'N' : String(v.gear)), rpm: Math.min(1, Math.max(0, (v.rpm - e.idle) / (e.limiter - e.idle))),
      });
      ui.setFps(this.params.get('fps') === '1' ? `${this.fps.toFixed(0)} fps · ${this.qName}` : '');
    }
    if (this.mapT > 1 / 20) { this.mapT = 0; ui.drawMap(R.cars.map((c) => ({ x: c.v.p[0], z: c.v.p[2], player: c.isPlayer }))); }
  }

  _render(dt) {
    const S = this.S, t = this.clock;
    { const R = this.race, p = R && R.player; const sp = p && ['racing', 'finished'].includes(this.state) && !this.paused ? Math.abs(p.v.speed) : 0; S.post.setMotion(Math.min(1, Math.max(0, (sp - 36) / 38)) * 0.9, this.camera.aspect); }
    S.materials.update(t);
    S.lighting.update(this.camera, this.scene.fog);
    S.sea.update(t, this.camera); S.barriers.update(t); S.veg.update(t, this.camera); S.props.update(this.camera);
    this.renderer.info.reset();
    S.post.renderFrame(dt);
    if (this.afterRender) this.afterRender();
  }

  // ------------------------------------------------------------------ fast-forward (tests): same tick, no rendering
  advance(seconds, { sync = true } = {}) {
    const n = Math.round(seconds / DT); this._silentEv = true;
    for (let i = 0; i < n; i++) {
      if (this.paused) break; this._simTick(DT);
      if (i % 12 === 11 && this.race && this.race.player && ['countdown', 'racing', 'finished'].includes(this.state)) this._cameraUpdate(0.1);     // the chase camera keeps following (integrity test)
    }
    this._silentEv = false;
    if (sync) { this._clearEvents(); }
  }

  /** place a race car on the road at track position s (lat metres), with a speed along the road; keeps the race bookkeeping consistent */
  teleport(rc, s, lat = 0, speed = 0) {
    const T = this.T, L = T.length, ss = ((s % L) + L) % L, i = T.indexAtS(ss), p = T.roadPoint(i, lat, 0), v = rc.v;
    v.reset(p.x, p.z, T.heading[i], i, 0);
    if (speed) { const f = v.forward; v.v[0] = f[0] * speed; v.v[1] = f[1] * speed; v.v[2] = f[2] * speed; for (const w of v.wheels) w.omega = speed / v.spec.wheelR; }
    rc.hint = i; rc.sPrev = rc.sTrack = ss; rc.lost = false; rc.offTime = rc.stuckTime = rc.flipTime = rc.lostTime = 0;
    rc.distance = (rc.startCrossed ? rc.lapsDone * L : -L) + ss; if (rc.driver) rc.driver.idx = -1;
    return rc;
  }
}
