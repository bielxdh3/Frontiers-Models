// Audio engine (Web Audio). Created on the first user interaction.
// Buses: player, ai, sfx, ambient, ui, music -> volume groups -> master ->
// glue compressor -> limiter -> soft-clip ceiling (-1.6 dBFS max, hard guarantee)
// -> tap (peak meter / recorder worklet) -> destination.
// Player engine: real recorded loops at 6-7 RPM bands per car, equal-power
// crossfade by log-RPM, playbackRate = rpm / bandRpm, on-load / off-load layers,
// ignition cut on gear changes, limiter bounce, lift-off pops.
import { loadBank } from './bank.js';
import { SURF } from '../world/collision.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const MAX_AI_VOICES = 5;
const AI_ON = 150, AI_OFF = 175; // m, hysteresis for AI voice culling
const AI_BANDS = { gt: [850, 3150, 5050, 6900], hatch: [800, 3500, 5300, 7100] };

export class AudioEngine {
  constructor() {
    this.ctx = null; this.bank = null; this.started = false; this.ready = false;
    this.settings = { master: 0.85, effects: 0.9, music: 0.6 };
    this.sources = new Set(); this.maxSources = 0; this.maxLogical = 0;
    this.eventLog = []; this.rec = null; this.paused = false; this.race = null;
    this.musicTrack = null; this.musicWant = 'menu';
    this._lis = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, init: false };
    this._hintS = 0; this._bellTimer = 25;
  }

  load(progress) { this._loadP = loadBank(progress).then((b) => { this.bank = b; return b; }); return this._loadP; }

  /** call from a user-gesture handler (click / key). Safe to call many times. */
  start() {
    if (this.started) return this._startP;
    this.started = true;
    try { this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 }); } catch (e) { console.warn('Audio indisponível', e); return Promise.resolve(); }
    this._startP = this._build().catch((e) => { console.warn('Audio init falhou', e); });
    return this._startP;
  }

  async _build() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.master = G(this.settings.master);
    this.fxVol = G(this.settings.effects);
    this.musicVol = G(this.settings.music);
    this.buses = { player: G(1.0), ai: G(0.5), sfx: G(0.9), ambient: G(0.75), ui: G(0.7), music: G(0.45) };
    // race group (player/ai/sfx) gets the pause muffle
    this.raceGroup = G(1); this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.5;
    this.ambGroup = G(1);
    this.buses.player.connect(this.raceGroup); this.buses.ai.connect(this.raceGroup); this.buses.sfx.connect(this.raceGroup);
    this.raceGroup.connect(this.muffle).connect(this.fxVol);
    this.buses.ambient.connect(this.ambGroup).connect(this.fxVol);
    this.buses.ui.connect(this.fxVol);
    this.buses.music.connect(this.musicVol).connect(this.master);
    this.fxVol.connect(this.master);
    // dynamics
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.22;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    const pre = G(0.8);
    const clip = ctx.createWaveShaper(); clip.curve = softClipCurve(0.6, 0.83); clip.oversample = 'none';
    this.master.connect(comp).connect(lim).connect(pre).connect(clip);
    this.ceiling = 0.83;
    this.out = clip;
    try {
      await ctx.audioWorklet.addModule('./src/audio/recorder-worklet.js');
      this.tap = new AudioWorkletNode(ctx, 'master-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
      this.tap.port.onmessage = (e) => this._onTap(e.data);
      clip.connect(this.tap).connect(ctx.destination);
      this.out = this.tap;
    } catch (e) { console.warn('AudioWorklet indisponível; sem medição de pico', e); clip.connect(ctx.destination); }
    this.streamDest = ctx.createMediaStreamDestination();
    this.out.connect(this.streamDest);
    await this._loadP;
    this._buildAmbience();
    this.ready = true;
    this.setMusic(this.musicWant);
    if (this._pendingRace) { const [g, a] = this._pendingRace; this._pendingRace = null; this.beginRace(g, a); }
  }

  // ---------------------------------------------------------------- utilities
  _track(src) {
    this.sources.add(src);
    src.addEventListener('ended', () => { this.sources.delete(src); try { src.disconnect(); } catch (e) { /* */ } });
    if (this.sources.size > this.maxSources) this.maxSources = this.sources.size;
    return src;
  }
  _loop(name, dest, { rate = 1, offset = null, gain = 0 } = {}) {
    const ctx = this.ctx, buf = this.bank.sounds[name];
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(g).connect(dest);
    s.start(ctx.currentTime + 0.01, offset ?? Math.random() * buf.duration);
    this._track(s);
    return { s, g };
  }
  /** one-shot sample; pos -> positional (PannerNode) */
  oneShot(name, { gain = 1, rate = 1, bus = 'sfx', pos = null, lowpass = 0, offset = 0, dur } = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx, buf = this.bank.sounds[name]; if (!buf) return null;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    let n = s.connect(g);
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; n = n.connect(f); }
    if (pos) { const p = this._panner(); setPos(p, pos[0], pos[1], pos[2], ctx.currentTime, true); n = n.connect(p); }
    n.connect(this.buses[bus]);
    s.start(ctx.currentTime, offset, dur);
    this._track(s);
    return s;
  }
  _panner(ref = 8, roll = 1.0) {
    return new PannerNode(this.ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, maxDistance: 2000, rolloffFactor: roll, coneInnerAngle: 360 });
  }
  logEvent(type, detail = '') {
    if (!this.rec || !this.ctx) return;
    const t = this.ctx.currentTime - this.rec.t0;
    this.eventLog.push({ t: +t.toFixed(2), type, detail: String(detail) });
  }
  _onTap(m) {
    if (m.type === 'peak') { this._peakRes && this._peakRes(m.peak); this._peakRes = null; }
    else if (m.type === 'chunk' && this.rec) { this.rec.L.push(m.L); this.rec.R.push(m.R); }
    else if (m.type === 'done' && this.rec) { this.rec.peak = m.peak; this._recRes && this._recRes(); }
  }

  // ---------------------------------------------------------------- settings / state
  setVolumes({ master, effects, music } = {}) {
    if (master != null) this.settings.master = master;
    if (effects != null) this.settings.effects = effects;
    if (music != null) this.settings.music = music;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.master, t, 0.05);
    this.fxVol.gain.setTargetAtTime(this.settings.effects, t, 0.05);
    this.musicVol.gain.setTargetAtTime(this.settings.music, t, 0.05);
  }
  setPaused(p) {
    this.paused = p;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(p ? 380 : 20000, t, 0.06);
    this.raceGroup.gain.setTargetAtTime(p ? 0.3 : 1, t, 0.06);
    this.ambGroup.gain.setTargetAtTime(p ? 0.35 : 1, t, 0.1);
  }
  setMusic(which) {
    this.musicWant = which;
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (this.musicTrack && this.musicTrack.which === which) return;
    if (this.musicTrack) { const m = this.musicTrack; m.g.gain.setTargetAtTime(0, t, 0.4); clearTimeout(m.timer); setTimeout(() => { try { m.s.stop(); } catch (e) { /* */ } }, 2500); this.musicTrack = null; }
    if (!which) return;
    const name = which === 'results' ? 'music2' : 'music';
    const play = () => {
      const buf = this.bank.sounds[name];
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
      s.connect(g).connect(this.buses.music); s.start(); this._track(s);
      const m = { which, s, g };
      // seamless-ish re-trigger 1.2 s before the end (fade-out baked into the sample)
      m.timer = setTimeout(() => { if (this.musicTrack === m) { this.musicTrack = null; this.setMusic(which); } }, (buf.duration - 1.2) * 1000);
      this.musicTrack = m;
    };
    play();
  }

  // ---------------------------------------------------------------- UI (own synthesis)
  ui(kind) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.005, bus = this.buses.ui;
    const tone = (f, t0, dur, type = 'triangle', g = 0.2, f2 = 0) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      const a = ctx.createGain(); a.gain.setValueAtTime(0, t0); a.gain.linearRampToValueAtTime(g, t0 + 0.006); a.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
      o.connect(a).connect(bus); o.start(t0); o.stop(t0 + dur + 0.03); this._track(o);
    };
    if (kind === 'nav') tone(1046, t, 0.07, 'triangle', 0.1);
    else if (kind === 'confirm') { tone(784, t, 0.1, 'triangle', 0.15); tone(1175, t + 0.075, 0.16, 'triangle', 0.15); }
    else if (kind === 'back') { tone(880, t, 0.08, 'triangle', 0.13); tone(587, t + 0.06, 0.13, 'triangle', 0.13); }
    else if (kind === 'count') { tone(659, t, 0.34, 'sine', 0.32); tone(1318, t, 0.25, 'sine', 0.07); }
    else if (kind === 'go') { tone(1318, t, 0.75, 'sine', 0.34); tone(2637, t, 0.45, 'sine', 0.07); tone(659, t, 0.6, 'triangle', 0.1); }
    else if (kind === 'lap') { tone(988, t, 0.14, 'sine', 0.2); tone(1318, t + 0.12, 0.22, 'sine', 0.2); }
    else if (kind === 'finish') { [523, 659, 784, 1046, 1318].forEach((f, k) => tone(f, t + k * 0.11, 0.5, 'triangle', 0.17)); tone(1046, t + 0.6, 0.9, 'sine', 0.14); }
  }

  // ---------------------------------------------------------------- ambience beds (persistent)
  _buildAmbience() {
    const ctx = this.ctx, A = this.buses.ambient;
    const lp = (f) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; return b; };
    this.amb = {};
    const bed = (name, chain = null) => { const dest = chain || A; const v = this._loop(name, dest); this.amb[name] = v; return v; };
    this.wavesLP = lp(7000); this.wavesLP.connect(A);
    bed('waves', this.wavesLP); bed('surf', this.wavesLP);
    bed('gulls'); bed('gust'); bed('crowd'); bed('birds'); bed('cicadaA'); bed('cicadaB');
    // speed wind belongs to the race/sfx group (pause-muffled); created here once
    this.windLP = lp(800); this.windHP = ctx.createBiquadFilter(); this.windHP.type = 'highpass'; this.windHP.frequency.value = 120;
    this.windLP.connect(this.windHP).connect(this.buses.sfx);
    this.wind = this._loop('wind', this.windLP);
    // bell tower: positional
    this.bellPanner = this._panner(40, 0.6);
    this.bellPanner.connect(A);
  }

  _ambienceTargets(G) {
    const W = G.world, T = W.track, p = this._lis;
    const o = T.projectNear(p.x, p.z, this._hintS, 60, this._po || (this._po = {}));
    if (Math.abs(o.d) > 120 || !this._hintInit) { const o2 = T.project(p.x, p.z, this._po2 || (this._po2 = {})); o.s = o2.s; o.d = o2.d; this._hintInit = true; }
    this._hintS = o.s;
    const zoneDist = (z) => { let best = Infinity; for (const r of T.zoneList) if (r.zone === z) { const a = T.inRange(o.s, r.s0, r.s1) ? 0 : Math.min(Math.abs(T.delta(o.s, r.s0)), Math.abs(T.delta(o.s, r.s1))); best = Math.min(best, a); } return best + Math.max(0, Math.abs(o.d) - 30) * 0.5; };
    const w = this._zw || (this._zw = [0, 0, 0, 0, 0]);
    for (let z = 1; z <= 4; z++) w[z] = smooth(170, 0, zoneDist(z));
    const zc = W.terrain.coastZ(p.x);
    const seaDist = Math.max(0, zc - p.z);
    const alt = Math.max(0, p.y);
    const pl = W.village && W.village.plaza && W.village.plaza.fountain;
    const village = pl ? smooth(260, 25, Math.hypot(p.x - pl.x, p.z - pl.z)) : 0;
    return {
      waves: 0.42 * smooth(380, 25, seaDist) * (0.35 + 0.65 * Math.max(w[1], w[2] * 0.7)),
      surf: 0.5 * smooth(110, 8, seaDist + alt * 1.5),
      wavesLP: 7000 - 5800 * smooth(8, 70, alt + seaDist * 0.05),
      gulls: 0.32 * smooth(300, 30, seaDist) * Math.max(w[1], 0.4 * w[2]),
      gust: 0.42 * w[2] * (0.55 + 0.45 * smooth(10, 60, alt)),
      crowd: 0.36 * Math.max(village, 0.25 * w[3]),
      birds: 0.5 * Math.max(w[4], 0.25 * w[3]),
      cicadaA: 0.36 * Math.max(w[4], 0.2 * w[2]),
      cicadaB: 0.28 * w[4],
      village, zoneW: w, s: o.s,
    };
  }

  // ---------------------------------------------------------------- race voices
  /** menu attract mode: every car is an AI voice, no player layers */
  beginAttract(G) { this.beginRace(G, true); }
  beginRace(G, attract = false) {
    if (!this.ready) { this._pendingRace = [G, attract]; return; }
    this.endRace();
    const ctx = this.ctx;
    const player = attract ? null : G.sim.cars[0];
    const R = this.race = { G, player, attract, engine: null, ai: [], load: 0, prevThr: 0, sq: 0, skid: false, onBridge: false, rel: [], lastImpact: 0, popT: 0 };
    if (attract) { for (let i = 0; i < G.sim.cars.length; i++) R.ai.push({ car: G.sim.cars[i], voice: null, active: false, dist: 1e9 }); R.rel = G.sim.cars.map(() => 0); return; }
    R.engine = new EngineVoice(this, this.bank.engines[player.spec.id], this.buses.player, null);
    const P = this.buses.player, S = this.buses.sfx;
    const f = (type, freq, q = 0.7, gain = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = freq; b.Q.value = q; if (gain) b.gain.value = gain; return b; };
    // tyres: two squeal layers
    R.sqHP = f('highpass', 380); R.sqHP.connect(S);
    R.sqA = this._loop('squealA', R.sqHP); R.sqB = this._loop('squealB', R.sqHP);
    // rolling: asphalt (road loop), curb (road loop + AM rumble), bridge (hollow EQ), loose (gravel loop: gravel/dirt, sand, grass)
    R.asphLP = f('lowpass', 900); R.asphLP.connect(P);
    R.asph = this._loop('road', R.asphLP);
    R.curbAM = ctx.createGain(); R.curbAM.gain.value = 0; R.curbLP = f('lowpass', 1400); R.curbAM.connect(R.curbLP).connect(P);
    R.curb = this._loop('road', R.curbAM, { rate: 1.3 }); // its gain node drives level, curbAM carries the stripe modulation
    R.curbOsc = ctx.createOscillator(); R.curbOsc.type = 'square'; R.curbOsc.frequency.value = 20; R.curbDepth = ctx.createGain(); R.curbDepth.gain.value = 0;
    R.curbOsc.connect(R.curbDepth).connect(R.curbAM.gain); R.curbOsc.start(); this._track(R.curbOsc);
    R.brPk1 = f('peaking', 165, 1.4, 9); R.brPk2 = f('peaking', 420, 2.0, 5); R.brLP = f('lowpass', 1100); R.brPk1.connect(R.brPk2).connect(R.brLP).connect(P);
    R.bridge = this._loop('road', R.brPk1, { rate: 0.9 });
    R.gravLP = f('lowpass', 3500); R.gravLP.connect(P); R.grav = this._loop('gravel', R.gravLP);
    R.sandBP = f('bandpass', 1500, 0.55); R.sandBP.connect(P); R.sand = this._loop('gravel', R.sandBP, { rate: 0.8 });
    R.grassLP = f('lowpass', 750); R.grassLP.connect(P); R.grass = this._loop('gravel', R.grassLP, { rate: 0.62 });
    // scrape against barriers
    R.scHP = f('highpass', 500); R.scHP.connect(S); R.scrape = this._loop('scrape', R.scHP);
    for (let i = 1; i < G.sim.cars.length; i++) R.ai.push({ car: G.sim.cars[i], voice: null, active: false, dist: 1e9 });
    R.rel = G.sim.cars.map(() => 0);
    R.voiceBaseline = this.sources.size;
  }
  endRace() {
    this._pendingRace = null;
    const R = this.race; if (!R) return;
    this.race = null;
    const t = this.ctx.currentTime;
    const kill = (v) => { if (!v) return; v.g.gain.setTargetAtTime(0, t, 0.03); try { v.s.stop(t + 0.2); } catch (e) { /* */ } };
    for (const a of R.ai) if (a.voice) a.voice.stop();
    if (!R.engine) return;
    R.engine.stop();
    [R.sqA, R.sqB, R.asph, R.curb, R.bridge, R.grav, R.sand, R.grass, R.scrape].forEach(kill);
    try { R.curbOsc.stop(t + 0.2); } catch (e) { /* */ }
  }

  _updateRace(dt, G) {
    const R = this.race, ctx = this.ctx, t = ctx.currentTime;
    if (!R.player) { this._updateAI(dt, G); return; }
    const car = R.player, s = car.spec;
    const sp = car.speed;
    // ---- engine
    let thr = car.input.throttle;
    if (car.shiftTimer > 0) thr = 0;
    R.load += (thr - R.load) * (1 - Math.exp(-dt * 12));
    const rn = clamp((car.rpm - s.idleRpm) / (s.redline - s.idleRpm), 0, 1);
    const level = 0.62 * (0.55 + 0.45 * rn) * (0.72 + 0.28 * R.load);
    R.engine.update(car.rpm, R.load, level, 1, car.limiter, rn);
    // lift-off pops at high rpm
    if (R.prevThr > 0.75 && car.input.throttle < 0.2 && rn > 0.62 && t > R.popT) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) setTimeout(() => this.oneShot('backfire', { gain: 0.16 + Math.random() * 0.12, rate: 0.85 + Math.random() * 0.35, bus: 'player', lowpass: 2600 }), 60 + k * (70 + Math.random() * 90));
      R.popT = t + 1.2;
    }
    R.prevThr = car.input.throttle;
    // ---- events (gear, impacts, bottoming)
    for (const ev of car.events) {
      if (ev.t === 'gear') {
        R.engine.cutDip(ev.up ? 0.11 : 0.07);
        this.oneShot('shift', { gain: ev.up ? 0.22 : 0.15, rate: 0.9 + Math.random() * 0.2, bus: 'player', lowpass: 3000 });
        this.logEvent('troca_marcha', (ev.up ? '+' : '-') + ev.gear);
      } else if (ev.t === 'impact') this._impact(ev, null, true);
      else if (ev.t === 'bottom' && t - (R.lastBottom || 0) > 0.25) { R.lastBottom = t; this.oneShot('clank', { gain: 0.25, rate: 0.55, bus: 'sfx', lowpass: 700 }); }
    }
    // ---- tyres
    let nPaved = 0, nC = 0; const cnt = {};
    for (const w of car.wheels) {
      if (!w.contact) continue; nC++;
      const k = w.surf; cnt[k] = (cnt[k] || 0) + 1;
      if (k === SURF.ASPHALT || k === SURF.CURB || k === SURF.BRIDGE || k === SURF.SIDEWALK) nPaved++;
    }
    const fr = (k) => (nC ? (cnt[k] || 0) / 4 : 0);
    const sqT = smooth(2.0, 10, car.slip) * (nPaved / 4) * smooth(2, 6, sp);
    R.sq += (sqT - R.sq) * (1 - Math.exp(-dt * 10));
    R.sqA.g.gain.setTargetAtTime(0.55 * R.sq, t, 0.03); R.sqB.g.gain.setTargetAtTime(0.3 * R.sq * R.sq, t, 0.03);
    R.sqA.s.playbackRate.setTargetAtTime(0.88 + 0.22 * R.sq + sp * 0.0015, t, 0.05); R.sqB.s.playbackRate.setTargetAtTime(1.05 + 0.15 * R.sq, t, 0.05);
    if (!R.skid && R.sq > 0.32) { R.skid = true; this.logEvent('derrapagem', `${(sp * 3.6).toFixed(0)} km/h`); }
    else if (R.skid && R.sq < 0.12) R.skid = false;
    // ---- rolling per surface
    const roll = smooth(0.5, 40, sp) ** 0.8;
    const rate = 0.7 + Math.min(0.75, sp / 55);
    const pr = G.sim.progress[0];
    const br = G.world.track.features.bridge;
    const onBridge = G.world.track.inRange(pr.s, br.s0, br.s1) && fr(SURF.BRIDGE) + fr(SURF.ASPHALT) > 0.4;
    if (onBridge !== R.onBridge) {
      R.onBridge = onBridge;
      this.oneShot('clank', { gain: 0.22, rate: 0.7, bus: 'sfx', lowpass: 1200 }); // expansion joint
      this.logEvent(onBridge ? 'ponte_entrada' : 'ponte_saida', `s=${pr.s.toFixed(0)}`);
    }
    const fA = (fr(SURF.ASPHALT) + fr(SURF.SIDEWALK) * 0.8) * (onBridge ? 0 : 1);
    const fB = onBridge ? fr(SURF.BRIDGE) + fr(SURF.ASPHALT) : fr(SURF.BRIDGE);
    R.asph.g.gain.setTargetAtTime(0.42 * roll * fA, t, 0.05); R.asph.s.playbackRate.setTargetAtTime(rate, t, 0.05);
    R.bridge.g.gain.setTargetAtTime(0.6 * roll * fB, t, 0.05); R.bridge.s.playbackRate.setTargetAtTime(rate * 0.92, t, 0.05);
    const fCurb = fr(SURF.CURB);
    R.curb.g.gain.setTargetAtTime(0.55 * roll * fCurb, t, 0.03); R.curbOsc.frequency.setTargetAtTime(clamp(sp / 1.0, 4, 70), t, 0.03);
    R.curbDepth.gain.setTargetAtTime(fCurb > 0 ? 0.45 : 0, t, 0.02); R.curbAM.gain.setTargetAtTime(fCurb > 0 ? 0.55 : 0, t, 0.02);
    R.grav.g.gain.setTargetAtTime(0.5 * roll * (fr(SURF.GRAVEL) + fr(SURF.DIRT) + fr(SURF.ROCK) * 0.6), t, 0.05); R.grav.s.playbackRate.setTargetAtTime(0.75 + sp / 90, t, 0.05);
    R.sand.g.gain.setTargetAtTime(0.55 * roll * fr(SURF.SAND), t, 0.05);
    R.grass.g.gain.setTargetAtTime(0.6 * roll * fr(SURF.GRASS), t, 0.05);
    // ---- scrape
    const scr = clamp(car.scrape, 0, 1) * smooth(1, 12, car.scrapeSpeed || 0);
    R.scrape.g.gain.setTargetAtTime(0.5 * scr, t, 0.04); R.scrape.s.playbackRate.setTargetAtTime(0.8 + clamp((car.scrapeSpeed || 0) / 40, 0, 0.6), t, 0.05);
    if (scr > 0.3 && !R.scraping) { R.scraping = true; this.logEvent('raspao', car.lastContactType || ''); } else if (scr < 0.05) R.scraping = false;
    // ---- AI engines (positional, Doppler, culling)
    this._updateAI(dt, G);
  }

  _impact(ev, pos, isPlayer) {
    const t = this.ctx.currentTime;
    const R = this.race;
    if (R && t - R.lastImpact < 0.12) return;
    if (R) R.lastImpact = t;
    const v = ev.v;
    const g = clamp(v / 16, 0.08, 1);
    const p = pos || null;
    if (v > 9) { this.oneShot('crash', { gain: 0.9 * g, rate: 0.92 + Math.random() * 0.16, pos: p }); this.oneShot('metal', { gain: 0.5 * g, rate: 0.9, pos: p }); }
    else if (v > 3.5) this.oneShot('metal', { gain: 0.75 * g, rate: 0.9 + Math.random() * 0.25, pos: p });
    else this.oneShot('clank', { gain: 0.6 * g + 0.1, rate: 0.85 + Math.random() * 0.3, pos: p, lowpass: ev.kind === 'car' ? 2500 : 0 });
    if (isPlayer) this.logEvent('colisao', `${ev.kind} ${v.toFixed(1)} m/s`);
  }

  _updateAI(dt, G) {
    const R = this.race, ctx = this.ctx, t = ctx.currentTime, L = this._lis;
    const c = 343, dop = 0.5; // "light" Doppler: half the physical shift
    for (const a of R.ai) { const p = a.car.pos; a.dist = Math.hypot(p.x - L.x, p.y - L.y, p.z - L.z); }
    const order = R.ai; order.sort((a, b) => a.dist - b.dist); // in place: no per-frame allocation
    let nActive = 0, near = 0;
    for (const a of order) {
      const want = (a.active ? a.dist < AI_OFF : a.dist < AI_ON) && nActive < MAX_AI_VOICES;
      if (want) {
        nActive++;
        if (!a.voice) {
          const bands = this.bank.engines[a.car.spec.id].filter((b) => AI_BANDS[a.car.spec.id].includes(b.rpm));
          a.voice = new EngineVoice(this, bands, this.buses.ai, this._panner(7, 1.1));
        }
        a.active = true;
        const car = a.car, p = car.pos, v = car.vel;
        const dx = L.x - p.x, dy = L.y - p.y, dz = L.z - p.z, dl = Math.hypot(dx, dy, dz) || 1;
        const vs = (v.x * dx + v.y * dy + v.z * dz) / dl; // source towards listener
        const vl = -(L.vx * dx + L.vy * dy + L.vz * dz) / dl; // listener towards source
        const k = clamp((c + vl * dop) / (c - vs * dop), 0.85, 1.18);
        a.dop = a.dop ? a.dop + (k - a.dop) * (1 - Math.exp(-dt * 8)) : k;
        const rn = clamp((car.rpm - car.spec.idleRpm) / (car.spec.redline - car.spec.idleRpm), 0, 1);
        const thr = car.shiftTimer > 0 ? 0 : car.input.throttle;
        a.load = (a.load || 0) + (thr - (a.load || 0)) * (1 - Math.exp(-dt * 10));
        a.voice.update(car.rpm, a.load, 0.55 * (0.6 + 0.4 * rn), a.dop, car.limiter, rn);
        setPos(a.voice.panner, p.x, p.y + 0.5, p.z, t);
        for (const ev of car.events) if (ev.t === 'impact' && a.dist < 60) this._impact(ev, [ev.x, p.y + 0.4, ev.z], false);
        near += smooth(60, 5, a.dist);
        // pass-by log (relative progress sign flip close to the player)
        if (R.player) {
          const pr = G.sim.progress, i = G.sim.cars.indexOf(car);
          const rel = (pr[0].dist || 0) - (pr[i].dist || 0);
          const sgn = Math.sign(rel);
          if (R.rel[i] && sgn && sgn !== R.rel[i] && a.dist < 25) this.logEvent('passagem_ia', `IA ${i} ${sgn > 0 ? 'ultrapassada' : 'passou'}`);
          if (sgn) R.rel[i] = sgn;
        }
      } else if (a.voice) { a.voice.stop(); a.voice = null; a.active = false; }
      else a.active = false;
    }
    // the pack never drowns the player: duck the AI bus as more cars crowd around
    this.buses.ai.gain.setTargetAtTime(0.5 / (1 + 0.35 * Math.max(0, near - 1)), t, 0.2);
    R.nAIVoices = nActive;
  }

  // ---------------------------------------------------------------- per frame
  update(dt, G) {
    if (!this.ready || !G.camera) return;
    const ctx = this.ctx, t = ctx.currentTime, cam = G.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements, L = this._lis;
    const x = e[12], y = e[13], z = e[14];
    if (L.init && dt > 0) {
      const k = 1 - Math.exp(-dt * 6);
      L.vx += ((x - L.x) / dt - L.vx) * k; L.vy += ((y - L.y) / dt - L.vy) * k; L.vz += ((z - L.z) / dt - L.vz) * k;
      if (Math.hypot(x - L.x, z - L.z) > 30) { L.vx = L.vy = L.vz = 0; } // teleport
    }
    L.x = x; L.y = y; L.z = z; L.init = true;
    const li = ctx.listener;
    if (li.positionX) {
      li.positionX.setTargetAtTime(x, t, 0.02); li.positionY.setTargetAtTime(y, t, 0.02); li.positionZ.setTargetAtTime(z, t, 0.02);
      li.forwardX.setTargetAtTime(-e[8], t, 0.02); li.forwardY.setTargetAtTime(-e[9], t, 0.02); li.forwardZ.setTargetAtTime(-e[10], t, 0.02);
      li.upX.setTargetAtTime(e[4], t, 0.02); li.upY.setTargetAtTime(e[5], t, 0.02); li.upZ.setTargetAtTime(e[6], t, 0.02);
    } else { li.setPosition(x, y, z); li.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
    // ambience
    const A = this._ambienceTargets(G);
    for (const k of ['waves', 'surf', 'gulls', 'gust', 'crowd', 'birds', 'cicadaA', 'cicadaB']) this.amb[k].g.gain.setTargetAtTime(A[k], t, 0.6);
    this.wavesLP.frequency.setTargetAtTime(A.wavesLP, t, 0.5);
    this.ambState = A;
    // church bells (distant, positional at the belfry)
    const ch = G.world.village && G.world.village.church;
    if (ch && ch.bellPos) {
      this._bellTimer -= dt;
      const d = Math.hypot(ch.bellPos[0] - x, ch.bellPos[2] - z);
      if (this._bellTimer <= 0 && d < 650) {
        this._bellTimer = 40 + Math.random() * 35;
        setPos(this.bellPanner, ch.bellPos[0], ch.bellPos[1], ch.bellPos[2], t, true);
        const s = ctx.createBufferSource(); s.buffer = this.bank.sounds.bells; const g = ctx.createGain(); g.gain.value = 0.7;
        s.connect(g).connect(this.bellPanner); s.start(); this._track(s);
        this.logEvent('sinos', `${d.toFixed(0)} m`);
      }
      if (this._prevVillage != null && A.village > 0.3 && this._prevVillage <= 0.3) this._bellTimer = Math.min(this._bellTimer, 1.5);
      this._prevVillage = A.village;
    }
    // speed wind (player car or camera)
    const pc = this.race ? this.race.player : null;
    const spd = pc ? pc.speed : Math.hypot(L.vx, L.vz) * 0.3;
    const wv = smooth(6, 70, spd);
    this.wind.g.gain.setTargetAtTime(0.06 + 0.5 * wv * wv, t, 0.1);
    this.windLP.frequency.setTargetAtTime(500 + 3800 * wv, t, 0.1);
    this.wind.s.playbackRate.setTargetAtTime(0.85 + 0.35 * wv, t, 0.2);
    if (this.race && !this.paused) this._updateRace(dt, G);
    const logical = this.voiceCounts().logical;
    if (logical > this.maxLogical) this.maxLogical = logical;
  }

  /** logical voices: player engine (1), each AI engine (1), tyre/roll/scrape/wind loops, ambience beds, one-shots */
  voiceCounts() {
    const R = this.race;
    const ai = R ? R.ai.filter((a) => a.voice).length : 0;
    const raceLoops = R && R.engine ? 9 : 0;
    const beds = this.amb ? Object.keys(this.amb).length + 1 : 0;
    const engineSources = R && R.engine ? R.engine.srcs.length : 0;
    let oneShots = 0; for (const s of this.sources) if (!s.loop && s.buffer) oneShots++;
    const persistent = (R && R.engine ? 1 : 0) + ai + raceLoops + beds;
    return { sources: this.sources.size, logical: persistent + oneShots, persistent, oneShots, aiVoices: ai, engineSources, beds };
  }
  playerEngineInfo() {
    const R = this.race; if (!R || !R.engine) return null;
    return { sampleBased: R.engine.srcs.every((b) => b.s.buffer instanceof AudioBuffer), bands: R.engine.srcs.map((b) => ({ rpm: b.rpm, seconds: +b.s.buffer.duration.toFixed(3), channels: b.s.buffer.numberOfChannels })), oscillatorAsMainSound: false };
  }

  // ---------------------------------------------------------------- measurement / recording
  peak() { if (!this.tap) return Promise.resolve(null); return new Promise((r) => { this._peakRes = r; this.tap.port.postMessage({ cmd: 'peak' }); }); }
  resetPeak() { if (this.tap) this.tap.port.postMessage({ cmd: 'resetPeak' }); this.maxSources = this.sources.size; this.maxLogical = 0; }
  startRecording() {
    if (!this.tap) return false;
    this.rec = { t0: this.ctx.currentTime, L: [], R: [], peak: 0 };
    this.eventLog = [];
    this.maxSources = this.sources.size; this.maxLogical = 0;
    this.tap.port.postMessage({ cmd: 'start' });
    return true;
  }
  async stopRecording() {
    if (!this.rec) return null;
    const done = new Promise((r) => { this._recRes = r; });
    this.tap.port.postMessage({ cmd: 'stop' });
    await done;
    const r = this.rec; this.rec = null;
    const n = r.L.reduce((a, b) => a + b.length, 0);
    const L = new Float32Array(n), Rr = new Float32Array(n); let o = 0;
    for (let i = 0; i < r.L.length; i++) { L.set(r.L[i], o); Rr.set(r.R[i], o); o += r.L[i].length; }
    this.lastRecording = { sampleRate: this.ctx.sampleRate, L, R: Rr, peak: r.peak, events: this.eventLog.slice(), maxSources: this.maxSources, maxLogical: this.maxLogical };
    return { seconds: n / this.ctx.sampleRate, peak: r.peak, peakDb: 20 * Math.log10(Math.max(1e-9, r.peak)), events: this.eventLog.length };
  }
  /** 16-bit stereo WAV of the last recording, returned in base64 slices (for the verifier) */
  recordingWavB64(slice, sliceSamples = 1 << 20) {
    const r = this.lastRecording; if (!r) return null;
    const n = r.L.length; const nSlices = Math.ceil(n / sliceSamples);
    if (slice == null) return { slices: nSlices, samples: n, sampleRate: r.sampleRate };
    const a = slice * sliceSamples, b = Math.min(n, a + sliceSamples);
    const head = slice === 0 ? 44 : 0;
    const buf = new ArrayBuffer(head + (b - a) * 4); const dv = new DataView(buf);
    if (head) {
      const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
      dv.setUint32(24, r.sampleRate, true); dv.setUint32(28, r.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
    }
    let o = head;
    for (let i = a; i < b; i++) { dv.setInt16(o, Math.max(-32767, Math.min(32767, Math.round(r.L[i] * 32767))), true); dv.setInt16(o + 2, Math.max(-32767, Math.min(32767, Math.round(r.R[i] * 32767))), true); o += 4; }
    const bytes = new Uint8Array(buf); let s = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
}

class EngineVoice {
  constructor(A, bands, dest, panner) {
    const ctx = A.ctx;
    this.A = A; this.panner = panner;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    if (panner) { this.out.connect(panner); panner.connect(dest); } else this.out.connect(dest);
    this.sum = ctx.createGain();
    this.onEQ = ctx.createBiquadFilter(); this.onEQ.type = 'peaking'; this.onEQ.frequency.value = 2200; this.onEQ.Q.value = 0.8; this.onEQ.gain.value = 3;
    this.onG = ctx.createGain(); this.onG.gain.value = 0.5;
    this.offLP = ctx.createBiquadFilter(); this.offLP.type = 'lowpass'; this.offLP.frequency.value = 1200; this.offLP.Q.value = 1.1;
    this.offG = ctx.createGain(); this.offG.gain.value = 0.5;
    this.cut = ctx.createGain();
    this.sum.connect(this.onEQ).connect(this.onG).connect(this.cut);
    this.sum.connect(this.offLP).connect(this.offG).connect(this.cut);
    this.cut.connect(this.out);
    // rev-limiter bounce: square LFO into the cut gain (depth 0 unless limiting)
    this.lfo = ctx.createOscillator(); this.lfo.type = 'square'; this.lfo.frequency.value = 16;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth).connect(this.cut.gain); this.lfo.start(); A._track(this.lfo);
    const t0 = ctx.currentTime + 0.02;
    this.srcs = bands.map((b) => {
      const s = ctx.createBufferSource(); s.buffer = b.buffer; s.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(g).connect(this.sum);
      s.start(t0, Math.random() * b.buffer.duration);
      A._track(s);
      return { s, g, rpm: b.rpm, lr: Math.log(b.rpm) };
    });
    this.cutUntil = 0;
  }
  update(rpm, load, level, rateMul = 1, limiter = false, rn = 0) {
    const ctx = this.A.ctx, t = ctx.currentTime;
    const B = this.srcs, n = B.length, lr = Math.log(Math.max(300, rpm));
    let i = 0; while (i < n - 2 && lr > B[i + 1].lr) i++;
    for (let k = 0; k < n; k++) {
      let w = 0;
      if (lr <= B[0].lr) w = k === 0 ? 1 : 0;
      else if (lr >= B[n - 1].lr) w = k === n - 1 ? 1 : 0;
      else if (k === i || k === i + 1) { const u = clamp((lr - B[i].lr) / (B[i + 1].lr - B[i].lr), 0, 1); w = k === i ? Math.cos(u * Math.PI / 2) : Math.sin(u * Math.PI / 2); }
      B[k].g.gain.setTargetAtTime(w, t, 0.02);
      B[k].s.playbackRate.setTargetAtTime(clamp(rpm / B[k].rpm, 0.45, 2.2) * rateMul, t, 0.012);
    }
    this.onG.gain.setTargetAtTime(0.3 + 0.7 * load, t, 0.03);
    this.offG.gain.setTargetAtTime(0.62 * (1 - load), t, 0.03);
    this.offLP.frequency.setTargetAtTime(650 + 1500 * rn, t, 0.05);
    this.out.gain.setTargetAtTime(level, t, 0.03);
    if (t > this.cutUntil) {
      this.cut.gain.setTargetAtTime(limiter ? 0.62 : 1, t, 0.01);
      this.lfoDepth.gain.setTargetAtTime(limiter ? 0.38 : 0, t, 0.006);
    }
  }
  cutDip(dur) {
    const t = this.A.ctx.currentTime;
    this.cut.gain.cancelScheduledValues(t);
    this.cut.gain.setTargetAtTime(0.28, t, 0.008);
    this.cut.gain.setTargetAtTime(1, t + dur, 0.03);
    this.cutUntil = t + dur + 0.06;
  }
  stop() {
    const ctx = this.A.ctx, t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.03);
    for (const b of this.srcs) { try { b.s.stop(t + 0.25); } catch (e) { /* */ } }
    try { this.lfo.stop(t + 0.25); } catch (e) { /* */ }
    setTimeout(() => { try { this.out.disconnect(); if (this.panner) this.panner.disconnect(); } catch (e) { /* */ } }, 600);
  }
}

function setPos(p, x, y, z, t, now = false) {
  if (p.positionX) {
    if (now) { p.positionX.setValueAtTime(x, t); p.positionY.setValueAtTime(y, t); p.positionZ.setValueAtTime(z, t); }
    else { p.positionX.setTargetAtTime(x, t, 0.03); p.positionY.setTargetAtTime(y, t, 0.03); p.positionZ.setTargetAtTime(z, t, 0.03); }
  } else p.setPosition(x, y, z);
}

function softClipCurve(knee, ceil) {
  const N = 4096, c = new Float32Array(N);
  const span = ceil - knee;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x);
    const y = a <= knee ? a : knee + span * Math.tanh((a - knee) / span);
    c[i] = Math.sign(x) * Math.min(y, ceil);
  }
  return c;
}
