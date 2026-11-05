// Game: owns renderer, world, simulation, cameras, audio, UI flow and the loop.
// Modes: menu (live track: AI cars racing + cinematic cameras), garage (car on
// a turntable in the low sun), race (intro -> 3-2-1 -> running -> finished),
// results. A sandbox mode (?cars=N) is kept for the authoring tools.
import * as THREE from 'three';
import { generateWorld, validateWorld } from './world/world.js';
import { RacingLine } from './ai/racingLine.js';
import { AIDriver } from './ai/driver.js';
import { Sim, FIXED_DT } from './sim.js';
import { CAR_SPECS, LIVERIES } from './car/specs.js';
import { buildCar } from './car/carModel.js';
import { CarCamera } from './render/camera.js';
import { Input } from './input.js';
import { Renderer, MASK_LAYER, QUALITY } from './render/renderer.js';
import { loadPBR, setAnisotropy } from './render/textures.js';
import { buildRoadMeshes, buildTerrainMesh } from './render/worldScene.js';
import { buildWorldMaterials } from './render/worldMaterials.js';
import { createSea, createFoamMask } from './render/sea.js';
import { Scatter, scatterZ1, scatterZ2, scatterZ4 } from './world/scatter.js';
import { layoutVillage } from './world/village.js';
import { villageMaterials, buildVillageRender } from './render/villageRender.js';
import { buildBridge } from './render/bridge.js';
import { buildScatterRender } from './render/scatterRender.js';
import { buildBarrierMeshes } from './render/barrierMeshes.js';
import { buildGantry } from './render/landmarks.js';
import { Particles } from './render/particles.js';
import { AudioEngine } from './audio/audio.js';
import { Race, AI_NAMES, PLAYER_SLOT, INTRO_TIME } from './race.js';
import { HUD } from './ui/hud.js';
import { Flow } from './ui/flow.js';
import { Harness } from './testing/harness.js';

const params = new URLSearchParams(location.search);
const SETTINGS_KEY = 'costa-dourada-settings-v1';

export class Game {
  constructor(canvas, hud, ui) {
    this.canvas = canvas; this.hudCanvas = hud; this.ui = ui;
    this.params = params;
    this.dev = params.has('dev') || params.has('test');
    this.input = new Input();
    this.frameTimes = []; this.frameLog = null;
    this.ready = false; this.time = 0; this.mode = 'loading'; this.paused = false;
    this.audio = new AudioEngine();
    this.settings = { quality: 'alta' };
    this._loadSettings();
    const kick = () => this.audio.start();
    addEventListener('keydown', kick); addEventListener('pointerdown', kick);
    this.viewPool = new Map();
    this.carViews = [];
  }

  _loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s) { if (s.quality && QUALITY[s.quality]) this.settings.quality = s.quality; if (s.volumes) this.audio.setVolumes(s.volumes); }
    } catch (e) { /* storage unavailable */ }
    if (params.has('quality') && QUALITY[params.get('quality')]) this.settings.quality = params.get('quality');
  }
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ quality: this.settings.quality, volumes: this.audio.settings })); } catch (e) { /* */ }
  }

  async init(progress0) {
    const tl0 = performance.now(); this.loadPhases = [];
    const progress = (label, f) => { const last = this.loadPhases[this.loadPhases.length - 1]; if (!last || last[0] !== label) this.loadPhases.push([label, Math.round(performance.now() - tl0)]); progress0(label, f); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    let audioF = 0;
    const audioP = this.audio.load((f) => { audioF = f; });
    progress('Lendo track.json', 0.02); await tick();
    const json = await (await fetch('./track.json')).json();
    this.trackJson = json;
    progress('Gerando pista e terreno', 0.06); await tick();
    this.world = generateWorld(json, { racingLine: (t) => new RacingLine(t), scatter: (w) => { const S = new Scatter(w); layoutVillage(S); scatterZ1(S); scatterZ2(S); scatterZ4(S); w.scatter = S; } });
    const W = this.world;
    progress('Validando mundo', 0.3); await tick();
    this.validation = validateWorld(W);
    if (this.dev) {
      console.log('[validateWorld]', this.validation.ok ? 'OK' : 'FAILED', JSON.stringify(this.validation.stats));
      if (!this.validation.ok) console.error('[validateWorld] errors', JSON.stringify(this.validation.errors.slice(0, 20)));
    }
    progress('Iluminação (HDRI)', 0.35); await tick();
    this.R = new Renderer(this.canvas);
    this.R.quality = QUALITY[this.settings.quality];
    await this.R.init(json);
    setAnisotropy(this.R.r.capabilities.getMaxAnisotropy());
    this.renderer = this.R.r; this.camera = this.R.camera; this.scene = this.R.scene;
    progress('Texturas', 0.45); await tick();
    this.pbr = { fabric: await loadPBR('Fabric030'), metal: await loadPBR('Metal032'), chrome: await loadPBR('Metal049A'), rubber: await loadPBR('Rubber004') };
    progress('Sombras do terreno', 0.52); await tick();
    this.R.setTerrainShadow(W.terrain);
    progress('Cenário', 0.55); await tick();
    await this._buildScene();
    progress('Carros', 0.75); await tick();
    this.sim = new Sim(W);
    this.sim.onStep = (dt) => { if (this.race) this.race.step(dt); };
    this.camCtl = new CarCamera(this.camera, W);
    this.camCtl.houseBoxes = W.placed.filter((o) => o.kind === 'house').map((o) => ({ cx: o.obb.cx, cz: o.obb.cz, hx: o.obb.hx + 0.3, hz: o.obb.hz + 0.3, ang: o.obb.ang, y0: o.baseY - 2, y1: o.baseY + (o.style === 'church' ? 35 : 13), r: Math.hypot(o.obb.hx, o.obb.hz) }));
    // pre-build every car / livery combination used by menu and races (geometry is shared)
    for (const sp of Object.values(CAR_SPECS)) for (const l of LIVERIES) { this._view(sp, l); await tick(); }
    this.particles = new Particles(this.scene, this.R.sunColor);
    this.hud = new HUD(this.hudCanvas, W);
    progress('Sons', 0.86);
    while (audioF < 1) { progress(`Sons ${Math.round(audioF * 100)}%`, 0.86 + audioF * 0.05); await Promise.race([audioP, new Promise((r) => setTimeout(r, 100))]); if (audioF >= 1) break; }
    await audioP;
    progress('Compilando shaders', 0.92); await tick();
    this.sandbox = params.has('cars');
    if (this.sandbox) this._spawnTest(); else this._attractCars();
    this._fixMaterialSharing();
    this.R.registerTree(this.scene);
    this._assignDepthMaterials();
    this._applyRuntimeQuality();
    this._compileAll();
    progress('Pronto', 1);
    this.ready = true;
    this.flow = new Flow(this, this.ui);
    this.harness = new Harness(this);
    if (!this.sandbox) this.flow.menu();
    this.last = performance.now(); this.acc = 0;
    this.renderer.setAnimationLoop((t) => this._frame(t));
  }

  /** a material drawn by both instanced and plain meshes makes three re-derive the program on every
   *  switch (per-draw CPU + garbage): plain meshes get their own copy */
  _fixMaterialSharing() {
    const instMats = new Set();
    this.scene.traverse((o) => { if (o.isInstancedMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => instMats.add(m)); });
    const copies = new Map();
    this.scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || !instMats.has(o.material)) return;
      const m = o.material;
      if (m.onBeforeCompile && m.onBeforeCompile.toString().length > 30 || (m.userData && m.userData.onBeforeCompile)) return; // keep custom shaders shared
      let c = copies.get(m); if (!c) { c = m.clone(); c.name = m.name; copies.set(m, c); }
      o.material = c;
    });
    this.materialCopies = copies.size;
  }
  /** shadow pass: one depth material per (instanced, instance colour, side, map, alpha) configuration,
   *  instead of three's single shared one that flips program state between objects */
  _assignDepthMaterials() {
    const cache = new Map();
    const assign = (o) => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      const m = o.material;
      const key = `${o.isInstancedMesh ? 1 : 0}|${o.instanceColor ? 1 : 0}|${m.side}|${m.shadowSide ?? 'n'}|${m.map ? 1 : 0}|${m.alphaMap ? 1 : 0}|${m.alphaTest > 0 ? m.uuid : 0}|${m.displacementMap ? 1 : 0}`;
      let d = cache.get(key); if (!d) { d = new THREE.MeshDepthMaterial(); d.name = 'depth:' + key; cache.set(key, d); }
      o.customDepthMaterial = d;
    };
    this.scene.traverse(assign);
    for (const v of this.viewPool.values()) v.root.traverse(assign);
    this.depthMaterials = cache.size;
  }

  /** compile every program now (all car views + world) so nothing hitches later */
  _compileAll() {
    const tmp = [];
    for (const v of this.viewPool.values()) if (!v.root.parent) { this.scene.add(v.root, v.contact); tmp.push(v); }
    this.renderer.compile(this.scene, this.camera);
    for (const v of tmp) this.scene.remove(v.root, v.contact);
  }

  async _buildScene() {
    const W = this.world, scene = this.scene;
    const mats = await buildWorldMaterials(W, this.R);
    this.worldMats = mats;
    this.terrainMesh = buildTerrainMesh(W, mats.terrain, { lodScale: 1 });
    scene.add(this.terrainMesh.group);
    const std = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const roadMats = { asphalt: mats.asphalt, shoulder: mats.shoulder, skirt: mats.skirt, curb: mats.curb,
      barrier: { default: std(0xbbbbbb, 0.6), guardrail: std(0xcfd3d6, 0.4, 0.6), retaining: std(0x9b8f7f), streetwall: std(0xd9c9a8) } };
    scene.add(buildRoadMeshes(W, roadMats));
    const ms = mats.sets;
    const extra = await Promise.all(['Bark012', 'Bark014', 'Bark001', 'Planks037A', 'Wood049', 'Bricks089', 'Bricks100', 'Plaster001', 'Metal032', 'Fabric030', 'RoofingTiles014A', 'PavingStones070'].map((id) => loadPBR(id)));
    const X = Object.fromEntries(extra.map((e) => [e.id, e]));
    const propSets = { metal: X.Metal032, planks: X.Planks037A, wood: X.Wood049, concrete: ms.concrete, stone: X.Bricks089, rock: ms.rock, plaster: X.Plaster001, fabric: X.Fabric030 };
    this.scatterR = buildScatterRender(scene, W.scatter, { bark: { Bark012: X.Bark012, Bark014: X.Bark014, Bark001: X.Bark001 }, prop: propSets }, this.R.quality);
    const bm = buildBarrierMeshes(W, { stone: X.Bricks089, stone2: X.Bricks100, plaster: X.Plaster001, concrete: ms.concrete, metal: X.Metal032 }, this.scatterR.field, this.scatterR.pm);
    scene.add(bm.group);
    this.scatterR.field.build();
    this.gantry = buildGantry(W, this.scatterR.pm);
    scene.add(this.gantry.group);
    const vm = villageMaterials({ plaster: X.Plaster001, stone: X.Bricks089, trim: ms.concrete, wood: X.Wood049, roof: X.RoofingTiles014A, metal: X.Metal032, fabric: X.Fabric030 }, this.scatterR.foliageTex);
    this.village = buildVillageRender(W, vm, { cobble: X.PavingStones070, trim: ms.concrete });
    scene.add(this.village);
    scene.add(buildBridge(W, { stone: X.Bricks100 }));
    this.foamMask = createFoamMask(W.terrain);
    for (const [x, z, r] of (W.scatter.foamStamps || [])) this.foamMask.stamp(x, z, r);
    this.sea = createSea(this.R.atmGLSL, W.terrain, this.foamMask);
    this.sea.userData.rocks = (W.scatter.foamStamps || []).map(([x, z, r]) => [x, z, r]);
    scene.add(this.sea);
  }

  // ---------------------------------------------------------------- cars
  _view(spec, livery) {
    const key = spec.id + ':' + livery.id;
    let v = this.viewPool.get(key);
    if (!v) { v = buildCar(spec, livery, this.pbr); v.key = key; this.viewPool.set(key, v); if (this.R) this.R.registerTree(v.root); }
    return v;
  }
  /** list: [{ spec, livery, s, d }] -> index 0 is the "player" car (camera / HUD / audio focus) */
  setupCars(list) {
    for (const v of this.carViews) { this.scene.remove(v.root, v.contact); v.root.traverse((o) => o.layers.disable(MASK_LAYER)); }
    this.sim.clear();
    this.carViews = [];
    list.forEach((c, i) => {
      const car = this.sim.addCar(c.spec, i);
      this.sim.placeOnTrack(car, c.s, c.d, i);
      const v = this._view(c.spec, c.livery);
      if (i === 0) v.root.traverse((o) => o.layers.enable(MASK_LAYER));
      this.scene.add(v.root, v.contact);
      this.carViews.push(v);
    });
    this.player = this.sim.cars[0];
    this.particles && this.particles.clear();
    this.camCtl.reset();
  }

  _attractCars() {
    const T = this.world.track, s0 = T.features.startS + 260;
    const list = LIVERIES.map((l, k) => ({ spec: k % 2 ? CAR_SPECS.hatch : CAR_SPECS.gt, livery: l, s: T.wrap(s0 + Math.floor(k / 2) * 34 + (k % 2) * 9), d: k % 2 ? 2.4 : -2.4 }));
    this.setupCars(list);
    this.sim.cars.forEach((car, i) => { this.sim.drivers[i] = new AIDriver(car, this.world, this.world.racingLine, { difficulty: 'normal', skill: 0.95 + 0.012 * i, seed: 40 + i }); this.sim.progress[i].raceActive = true; });
  }

  _spawnTest() {
    const W = this.world, sim = this.sim;
    const startS = W.track.features.startS;
    const n = +(params.get('cars') || 1);
    const list = [];
    for (let i = 0; i < n; i++) list.push({ spec: i % 2 ? CAR_SPECS.hatch : CAR_SPECS.gt, livery: LIVERIES[i % LIVERIES.length], s: params.has('s') ? +params.get('s') : startS - 12 - i * 8, d: i % 2 ? 2.6 : -2.6 });
    this.setupCars(list);
    for (let i = 0; i < n; i++) if (params.has('auto') || i > 0) sim.drivers[i] = new AIDriver(sim.cars[i], W, W.racingLine, { difficulty: 'normal', seed: i + 1 });
    if (params.has('ts')) sim.timeScale = +params.get('ts');
    if (params.get('cam') === 'top') this.camMode = 'top';
    if (params.has('freeze')) for (const c of sim.cars) c.frozen = true;
    this.mode = 'sandbox';
  }

  setStartLights(n, color = 'red') {
    const c = new THREE.Color(color === 'green' ? 0x30ff50 : 0xff2010);
    this.gantry.lights.forEach((m, k) => { m.emissive.copy(c); m.emissiveIntensity = k < n ? 7 : 0; m.color.set(k < n ? (color === 'green' ? 0x0c3010 : 0x300806) : 0x220806); });
  }

  // ---------------------------------------------------------------- modes
  enterMenu() {
    if (this.mode === 'menu') return;
    this._leaveRace();
    this.mode = 'menu'; this.paused = false; this.sim.timeScale = 1;
    this.hud.visible = false;
    this._attractCars();
    this.audio.beginAttract(this);
    this.audio.setMusic('menu');
    this.cine = null;
  }
  enterGarage(specId, livIdx) {
    this._leaveRace();
    this.mode = 'garage'; this.hud.visible = false;
    this.garage = this.garage || { angle: 0.6 };
    this.setGarageCar(specId, livIdx);
    this.audio.endRace();
    this.audio.setMusic('menu');
  }
  setGarageCar(specId, livIdx) {
    const T = this.world.track;
    const s = T.wrap(T.features.startS + 70);
    this.setupCars([{ spec: CAR_SPECS[specId], livery: LIVERIES[livIdx], s, d: 0 }]);
    const car = this.sim.cars[0]; car.frozen = true;
    this.garage.s = s;
  }
  _leaveRace() {
    if (this.race) { this.audio.endRace(); this.race = null; }
    this.setStartLights(0);
    this.paused = false; this.audio.setPaused(false);
  }

  startRace(cfg) {
    this._leaveRace();
    this.raceCfg = { laps: 3, difficulty: 'normal', spec: 'gt', livery: 0, autopilot: params.has('autopilot'), ...cfg };
    const C = this.raceCfg, T = this.world.track;
    const race = new Race(this, C);
    const pSpec = CAR_SPECS[C.spec], pLiv = LIVERIES[C.livery];
    const others = LIVERIES.filter((l, k) => k !== C.livery);
    const aiSpecs = [CAR_SPECS.gt, CAR_SPECS.hatch, CAR_SPECS.hatch, CAR_SPECS.gt, CAR_SPECS.hatch];
    const aiSlots = [0, 1, 2, 4, 5];
    const entrants = [{ name: 'Você', spec: pSpec, livery: pLiv, isPlayer: true, slot: PLAYER_SLOT }];
    aiSlots.forEach((slot, k) => entrants.push({ name: AI_NAMES[k], spec: aiSpecs[k], livery: others[k], isPlayer: false, slot }));
    this.setupCars(entrants.map((e) => { const g = race.gridSlot(e.slot); return { spec: e.spec, livery: e.livery, s: g.s, d: g.d }; }));
    this.race = race;
    race.init(entrants);
    this.mode = 'race'; this.paused = false;
    this.camCtl.mode = this.camCtl.mode === 'hood' ? 'hood' : 'chase';
    this.hud.visible = false;
    this.sim.timeScale = C.timeScale || 1;
    this.setStartLights(0);
    this.audio.setMusic(null);
    this.audio.beginRace(this);
    this.introT = 0;
    this.R.post.snapExposure();
  }
  restartRace() { const c = { ...this.raceCfg }; this.startRace(c); }
  quitToMenu() { this._leaveRace(); this.mode = 'none'; this.enterMenu(); }
  pause() { if (this.mode !== 'race' || this.paused) return; this.paused = true; this.audio.setPaused(true); }
  resume() { this.paused = false; this.audio.setPaused(false); this.last = performance.now(); }
  onPlayerFinished() {
    // results after a short beat on the line
    setTimeout(() => { if (this.race && this.race.state === 'finished' && this.mode === 'race') { this.mode = 'results'; this.hud.visible = false; this.audio.setMusic('results'); this.flow.results(); this.cine = null; } }, 2500);
  }

  applyQuality(name) {
    if (!QUALITY[name] || name === this.settings.quality) return;
    this.settings.quality = name;
    this.R.setQuality(name);
    this._applyRuntimeQuality();
    this._compileAll();
    this.saveSettings();
  }
  _applyRuntimeQuality() {
    const q = this.R.quality;
    this.terrainMesh.lodScale = q.terrainLod;
    this.scatterR.field.distScale = q.vegDist;
    this.scatterR.field.shadowDist = q.name === 'Baixa' ? 80 : 150;
    this.scatterR.field.vegShadowR = q.vegShadowR || 110; this.scatterR.field._shadowAt = null;
  }

  // ---------------------------------------------------------------- per frame
  _updateCarViews(alpha) {
    const sim = this.sim, camPos = this.camera.position;
    for (let i = 0; i < sim.cars.length; i++) {
      const c = sim.cars[i], v = this.carViews[i];
      v.root.position.lerpVectors(c.prevPos, c.pos, alpha);
      v.root.quaternion.slerpQuaternions(c.prevQuat, c.quat, alpha);
      c.wheels.forEach((w, k) => {
        const wv = v.wheels[k];
        wv.pivot.position.y = w.y - (c.spec.rest - w.comp);
        wv.pivot.rotation.y = -w.steer;
        wv.spin.rotation.x = -w.angle;
      });
      v.mats.tail.emissiveIntensity = c.brakeLight ? 5.5 : 0.9;
      const d = v.root.position.distanceTo(camPos);
      const far = d > this.R.quality.carLod1Dist && v.bodyLods.length > 1;
      v.bodyLods[0].visible = !far; if (v.bodyLods[1]) v.bodyLods[1].visible = far;
      for (const w of v.wheels) { w.lods[0].visible = !far; w.lods[1].visible = far; w.caliper.visible = !far; }
      let gy = 0, n = 0; for (const w of c.wheels) { if (w.contact) { gy += w.hitY; n++; } }
      if (n) gy /= n; else gy = this.world.groundHeight(c.pos.x, c.pos.z, c.pos.y + 1);
      v.contact.position.set(v.root.position.x, gy + 0.025, v.root.position.z);
      _f.set(0, 0, -1).applyQuaternion(v.root.quaternion);
      v.contact.rotation.y = Math.atan2(-_f.x, -_f.z);
      v.contact.material.opacity = 0.82 * Math.max(0, 1 - Math.max(0, c.pos.y - c.spec.cgHeight - gy) * 1.5);
    }
  }

  _frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.renderer.info.autoReset = false; this.lastInfo = { calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles }; this.renderer.info.reset();
    this.time += dt;
    this.frameTimes.push(dt); if (this.frameTimes.length > 600) this.frameTimes.shift();
    if (this.frameLog) this.frameLog.push(dt);
    const sim = this.sim, race = this.race;
    this.input.poll(dt, this.player ? this.player.speed : 0);
    let consumed = false;
    if (this.mode === 'race' && race) {
      if (!this.paused && this.input.action('pause') && !(this.flow && this.flow.modal)) { this.pause(); this.flow.pause(); consumed = true; }
      if (this.input.action('camera')) this.camCtl.mode = this.camCtl.mode === 'chase' ? 'hood' : 'chase';
    } else if (this.mode === 'sandbox' && this.input.action('camera')) this.camCtl.mode = this.camCtl.mode === 'chase' ? 'hood' : 'chase';
    if (this.flow && !consumed) this.flow.poll(this.input);
    const stepping = !this.paused;
    if (stepping) {
      if ((this.mode === 'race' || this.mode === 'sandbox') && !sim.drivers[0] && this.player) {
        const p = this.player.input;
        p.throttle = this.input.throttle; p.brake = this.input.brake; p.steer = this.input.steer; p.handbrake = this.input.handbrake;
        if (this.mode === 'race' && race && race.state === 'running' && this.input.action('reset')) sim.resetCar(0, 'manual');
      }
      if (race && this.mode === 'race') {
        const prev = race.state;
        race.update(dt);
        if (prev === 'intro' && race.state !== 'intro') { this.flow.hideIntro(); this.hud.visible = true; this.camCtl.reset(); }
      }
      if (this.mode === 'garage') this.garage.angle += dt * 0.32;
      this.acc += dt * sim.timeScale;
      let n = 0;
      const maxSteps = Math.max(40, Math.ceil(sim.timeScale * 14));
      const tS = performance.now();
      while (this.acc >= FIXED_DT && n < maxSteps) { sim.step(FIXED_DT); this.acc -= FIXED_DT; n++; }
      if (n >= maxSteps) this.acc = 0;
      if (this.prof) this.prof.sim += performance.now() - tS;
    }
    const alpha = this.paused ? 1 : this.acc / FIXED_DT;
    this._updateCarViews(alpha);
    this._camera(dt);
    const tP = performance.now();
    if (stepping) for (let i = 0; i < sim.cars.length; i++) this.particles.fromCar(sim.cars[i], dt * sim.timeScale, i);
    if (stepping) this.particles.sprayRocks(this.world.scatter.foamStamps, this.camera.position, dt);
    this.particles.update(this.paused ? 0 : dt, this.camera, this.R.quality.scale);
    const tW = performance.now();
    this.terrainMesh.update(this.camera.position);
    this.sea.userData.update(this.camera, this.time);
    this.scatterR.field.update(this.camera.position);
    this.scatterR.pm.flag.userData.time.value = this.time;
    this.worldMats.terrain.userData.uniforms.uTime.value = this.time;
    const tA = performance.now();
    this.audio.update(dt, this);
    const tA2 = performance.now();
    for (const c of sim.cars) c.events.length = 0;
    const cine = this.mode === 'menu' || this.mode === 'results' || this.mode === 'garage' || (race && race.state === 'intro') || this.camMode === 'fixed' || this.camMode === 'top';
    this.R.post.blurAmount = cine ? 0.08 : 0.32;
    const tR = performance.now();
    this.R.render(dt, this.time, true);
    const tH = performance.now();
    if (this.hud) this.hud.draw(this);
    const tE = performance.now();
    if (this.prof) { const P = this.prof; P.n++; P.particles += tW - tP; P.world += tA - tW; P.audio += tA2 - tA; P.render += tH - tR; P.hud += tE - tH; P.frame += dt * 1000; }
    if (this.onAfterFrame) this.onAfterFrame();
    this.input.endFrame();
  }
  /** dev: per-section CPU time (ms/frame) over the last call window */
  profStart() { this.prof = { n: 0, sim: 0, particles: 0, world: 0, audio: 0, render: 0, hud: 0, frame: 0 }; }
  profEnd() { const P = this.prof; this.prof = null; if (!P || !P.n) return null; const o = {}; for (const k of Object.keys(P)) if (k !== 'n') o[k] = +(P[k] / P.n).toFixed(2); o.frames = P.n; return o; }

  _camera(dt) {
    const pv = this.carViews[0] && this.carViews[0].root;
    if (this.camMode === 'top') { this._topCamera(); return; }
    if (this.camMode === 'fixed') return;
    if (this.mode === 'menu') { this._cinematic(dt, null); return; }
    if (this.mode === 'results') { this._cinematic(dt, 0); return; }
    if (this.mode === 'garage') { this._garageCamera(); return; }
    if (this.mode === 'race' && this.race && this.race.state === 'intro') { this._introCamera(); return; }
    if (pv) this.camCtl.update(dt, this.player, { pos: pv.position, quat: pv.quaternion });
  }

  _garageCamera() {
    const v = this.carViews[0]; if (!v) return;
    const car = this.sim.cars[0];
    // turntable: the car itself rotates; the camera sits on the sun side so the paint catches the low light
    const base = car.pos;
    const q = new THREE.Quaternion().setFromAxisAngle(_up, this.garage.angle);
    v.root.quaternion.copy(car.quat).premultiply(q);
    v.contact.rotation.y += 0; // contact shadow follows in _updateCarViews next frame
    const sd = this.R.sunDir; const l = Math.hypot(sd.x, sd.z) || 1;
    const ang = Math.atan2(sd.z / l, sd.x / l) + 0.75;
    const D = 8.6, cx = base.x + Math.cos(ang) * D, cz = base.z + Math.sin(ang) * D;
    const g = this.world.groundHeight(cx, cz, base.y + 5);
    this.camera.position.set(cx, Math.max(g + 0.6, base.y + 0.95), cz);
    this.camera.up.set(0, 1, 0);
    // aim to the right of the car so it sits in the left 60% of the frame (the card is on the right)
    const rx = -Math.sin(ang), rz = Math.cos(ang);
    this.camera.lookAt(base.x - rx * 1.9, base.y + 0.05, base.z - rz * 1.9);
    this.camera.fov = 36; this.camera.near = 0.15; this.camera.updateProjectionMatrix();
  }

  _introCamera() {
    // ~5 s fly-past along the grid, from the pole car back to the player
    const race = this.race, T = this.world.track;
    const u = Math.min(1, race.phaseT / INTRO_TIME);
    const e = u * u * (3 - 2 * u);
    const sFront = race.gridSlot(0).s + 9, sBack = race.gridSlot(PLAYER_SLOT).s - 9;
    const s = sFront + T.delta(sFront, sBack) * e;
    const side = 7.5 - 4.5 * e;
    const p = T.point(s, side), q = T.point(s - 6 - 10 * e, 0);
    const g = this.world.groundHeight(p[0], p[2], p[1] + 20);
    const hgt = 1.3 + 2.2 * Math.sin(Math.PI * e) + 0.8 * e;
    this.camera.position.set(p[0], Math.max(g + 0.8, p[1] + hgt), p[2]);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(q[0], q[1] + 0.7, q[2]);
    this.camera.fov = 52 - 6 * e; this.camera.near = 0.15; this.camera.updateProjectionMatrix();
  }

  /** trackside cinematic cameras following a car (menu attract mode / results) */
  _cinematic(dt, follow) {
    const sim = this.sim, T = this.world.track;
    let c = this.cine;
    const pickTarget = () => (follow != null ? follow : (c ? (c.target + 1 + Math.floor(Math.random() * (sim.cars.length - 1))) % sim.cars.length : 0));
    const car = c ? sim.cars[c.target] : null;
    const pr = c ? sim.progress[c.target] : null;
    if (!c || c.t > c.dur || (pr && T.delta(c.s, pr.s) > 14 && c.kind !== 'heli')) {
      const target = pickTarget();
      const prT = sim.progress[target];
      const kinds = ['side', 'side', 'low', 'heli'];
      for (let attempt = 0; attempt < 8; attempt++) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const ahead = kind === 'heli' ? 20 + Math.random() * 30 : 38 + Math.random() * 30;
        const s = T.wrap(prT.s + ahead);
        const fr = T.frame(s, {});
        const side = Math.random() < 0.5 ? -1 : 1;
        const off = kind === 'heli' ? 22 + Math.random() * 18 : fr.w / 2 + 3.5 + Math.random() * 5;
        const p = T.point(s, side * off);
        const g = this.world.groundHeight(p[0], p[2], p[1] + 60);
        const hgt = kind === 'heli' ? 14 + Math.random() * 14 : kind === 'low' ? 0.7 : 1.4 + Math.random() * 2.2;
        const pos = new THREE.Vector3(p[0], Math.max(g, p[1]) + hgt, p[2]);
        if (this.camCtl._insideHouse(pos, 1.0)) continue;
        // line of sight to the road at the camera's station
        const tgt = new THREE.Vector3(fr.x, fr.y + 1, fr.z);
        if (this.camCtl._clearance(tgt, pos) < 0.95) continue;
        c = this.cine = { target, s, pos, t: 0, dur: kind === 'heli' ? 6.5 : 9, kind, fov: kind === 'heli' ? 38 : 30 + Math.random() * 12, look: null };
        this.R.post.snapExposure();
        break;
      }
      if (!c) { c = this.cine = { target, s: prT.s, pos: this.camera.position.clone(), t: 0, dur: 2, kind: 'side', fov: 45, look: null }; }
    }
    c.t += dt;
    const tv = this.carViews[c.target].root.position;
    if (c.kind === 'heli') c.pos.y += dt * 0.6;
    const lk = c.look || (c.look = tv.clone());
    lk.lerp(tv, 1 - Math.exp(-dt * 9));
    this.camera.position.copy(c.pos); this.camera.up.set(0, 1, 0);
    this.camera.lookAt(lk.x, lk.y + 0.5, lk.z);
    const d = c.pos.distanceTo(tv);
    const fov = THREE.MathUtils.clamp(c.fov * (40 / Math.max(14, d)), 12, 55);
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 3)); this.camera.near = 0.2; this.camera.updateProjectionMatrix();
  }

  _topCamera() {
    const b = this.world.track.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, (b.maxZ - b.minZ) * this.camera.aspect) * 0.62;
    this.camera.position.set(cx, span / Math.tan((this.camera.fov * Math.PI) / 360) + 50, cz + 1);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(cx, 0, cz);
    this.camera.far = 16000; this.camera.updateProjectionMatrix();
  }

  // ---------- dev / test API ----------
  setCameraMode(m) { this.camMode = m; if (m !== 'top') { this.camera.up.set(0, 1, 0); this.camCtl.reset(); } }
  carCamera(i, right, up, fwd, lookUp = 0.5, lookFwd = 0, fov = 50) {
    this.camMode = 'fixed';
    const c = this.carViews[i].root;
    c.updateMatrixWorld();
    const p = new THREE.Vector3(right, up, -fwd).applyMatrix4(c.matrixWorld);
    const l = new THREE.Vector3(0, lookUp, -lookFwd).applyMatrix4(c.matrixWorld);
    this.camera.position.copy(p); this.camera.up.set(0, 1, 0); this.camera.lookAt(l);
    this.camera.fov = fov; this.camera.updateProjectionMatrix();
  }
  teleport(i, s, d = 0, v = 20) {
    const c = this.sim.cars[i];
    this.sim.placeOnTrack(c, s, d, i);
    const f = c.forward(new THREE.Vector3()); c.vel.copy(f).multiplyScalar(v); c.prevPos.copy(c.pos);
    for (const w of c.wheels) w.spin = v / c.spec.wheelRadius;
    const sp = c.spec, rpmAt = (g) => (v / sp.wheelRadius) * g * sp.finalDrive * 60 / (2 * Math.PI);
    let g = 1; while (g < sp.gears.length && rpmAt(sp.gears[g - 1]) > sp.shiftUp * 0.92) g++;
    c.gear = g; c.rpm = Math.max(sp.idleRpm, rpmAt(sp.gears[g - 1])); c.shiftTimer = 0;
    this.camCtl.reset(); if (this.camMode === 'fixed' || this.camMode === 'top') this.camMode = null;
    this.R.post.snapExposure();
  }
  setCam(px, py, pz, lx, ly, lz, fov = 55) {
    this.camMode = 'fixed';
    this.camera.position.set(px, py, pz); this.camera.up.set(0, 1, 0); this.camera.lookAt(lx, ly, lz);
    this.camera.fov = fov; this.camera.updateProjectionMatrix();
  }
  trackCam(s, d, h, lookAhead = 30, lookD = 0, lookH = 1, fov = 55) {
    const T = this.world.track;
    const p = T.point(s, d), q = T.point(s + lookAhead, lookD);
    const g = this.world.groundHeight(p[0], p[2], p[1] + 50);
    this.setCam(p[0], Math.max(g, p[1]) + h, p[2], q[0], q[1] + lookH, q[2], fov);
  }
  rockCam(minX, maxX, dist = 9, h = 0.8) {
    const rocks = (this.world.scatter.foamStamps || []).filter(([x]) => x > minX && x < maxX).sort((a, b) => b[2] - a[2]);
    if (!rocks.length) return null;
    const [x, z, r] = rocks[0];
    const sd = this.R.sunDir; const l = Math.hypot(sd.x, sd.z);
    const px = x - (sd.x / l) * dist, pz = z - (sd.z / l) * dist + 3;
    const g = this.world.terrain.heightAt(px, pz);
    this.setCam(px, Math.max(g, 0.2) + h, pz, x, 0.3, z, 58);
    return [x, z, r];
  }
  setAutopilot(on) {
    if (!this.player) return;
    this.sim.drivers[0] = on ? new AIDriver(this.player, this.world, this.world.racingLine, { difficulty: 'dificil', skill: 1, seed: 77 }) : null;
    if (this.raceCfg) this.raceCfg.autopilot = on;
  }
  fps() { const a = this.frameTimes.slice(-120); const avg = a.reduce((x, y) => x + y, 0) / a.length; return 1 / avg; }
  state() {
    const sim = this.sim, r = this.race;
    return {
      mode: this.mode, paused: this.paused, time: sim.time,
      race: r ? { state: r.state, clock: r.clock, laps: r.cfg.laps, cut: r.cutCount, events: r.events.slice(-40), standings: r.standings().map((e) => ({ i: e.i, name: e.name, lapsDone: e.lapsDone, next: e.next, dist: +e.dist.toFixed(1), finished: e.finished, best: e.best, lapTimes: e.lapTimes })) } : null,
      cars: sim.cars.map((c, i) => ({ dist: +(sim.progress[i].dist || 0).toFixed(1), s: sim.progress[i].s, d: sim.progress[i].d, speed: c.speed, gear: c.gear, rpm: Math.round(c.rpm), resets: sim.progress[i].resets, y: c.pos.y, offTrack: sim.progress[i].offTrack, stopped: sim.progress[i].stopped })),
      log: sim.log.slice(-20), invariantList: sim.invariantEvents.slice(0, 10), invariantEvents: sim.invariantEvents.length, camInside: this.camCtl.insideGeometry,
      carTris: this.carViews.map((v) => v.tris),
    };
  }
  validate() { return validateWorld(this.world); }
}
const _f = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
