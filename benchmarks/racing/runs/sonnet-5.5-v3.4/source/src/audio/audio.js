// Web Audio engine for the game.
//  * Player + AI engines are SAMPLE based: 7 cycle-aligned loops per car cut from real CC0 recordings (4 rpm bands per source, 2 timbres),
//    cross-faded by a global per-car pitch curve; two layers (on-throttle / lift-off) share the same loops; shift cut + rev-limiter gate.
//  * Tyres (rolling per surface, squeal ~ slip), wind ~ speed, guard-rail scrape, collisions ~ impulse, gear clack, bridge joints.
//  * Ambience per zone (waves+gulls / wind / village+bells / forest+cicadas) blended along the track, church bells positional.
//  * Buses: player, AI, effects, ambience, UI, music -> reverb send -> pause stage -> master -> compressor -> look-ahead limiter (worklet).
//  * AudioContext is created on the first user gesture; buffers are decoded beforehand with an OfflineAudioContext (no gesture needed).
import { CAR_SPECS } from '../physics/car-specs.js';
import { SURF } from '../physics/ground.js';

const BASE = './assets/audio/';
const SFX_NAMES = ['squeal', 'rolling-asphalt', 'rolling-gravel', 'wind', 'scrape', 'crash-big', 'crash-med', 'crash-glass', 'gear', 'handbrake'];
const AMB_NAMES = ['ocean', 'gulls', 'village', 'chat', 'forest', 'cicadas', 'crowd', 'bells'];
const MUSIC_NAMES = ['title', 'result'];          // CC0 tracks by MintoDog (OpenGameArt): menu/garage/setup and results only
const C_SOUND = 343;
export const MAX_AI_VOICES = 5;
const AI_RANGE = 190;
const SIGMA = 0.30;                       // width (ln playback-rate) of one rpm band
const PITCH = { v8: { lo: 46, hi: 185 }, turbo: { lo: 52, hi: 235 } };   // target fundamental (Hz) at idle / redline
const BLEND = 90;                         // m: half width of the zone ambience crossfade

// ambience gain per zone [Orla, Falesia, Vila, Bosque]
const AMB_MIX = {
  ocean:   [1.00, 0.55, 0.20, 0.10],
  gulls:   [0.60, 0.38, 0.16, 0.00],
  windlow: [0.10, 0.65, 0.12, 0.22],
  village: [0.00, 0.00, 0.85, 0.00],
  chat:    [0.00, 0.00, 0.55, 0.00],
  crowd:   [0.00, 0.00, 0.28, 0.00],
  forest:  [0.00, 0.00, 0.00, 1.00],
  cicadas: [0.00, 0.00, 0.06, 0.75],
};
const AMB_LEVEL = { ocean: 0.9, gulls: 0.55, windlow: 0.5, village: 0.8, chat: 0.7, crowd: 0.55, forest: 0.85, cicadas: 0.55 };

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

async function fetchDecode(octx, url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('audio fetch ' + url + ' -> ' + r.status);
  return octx.decodeAudioData(await r.arrayBuffer());
}

function zoneWeights(zones, L, s, out) {
  let tot = 0;
  for (let k = 0; k < zones.length; k++) {
    const z = zones[k]; let best = -1e9;
    for (const off of [-L, 0, L]) { const ss = s + off; const d = Math.min(ss - z.s0, z.s1 - ss); if (d > best) best = d; }
    const w = sstep(-BLEND, BLEND, best); out[k] = w; tot += w;
  }
  if (tot < 1e-6) { out.fill(1 / zones.length); return out; }
  for (let k = 0; k < zones.length; k++) out[k] /= tot;
  return out;
}

/** a looping BufferSource -> gain -> destination that disconnects itself while silent (saves CPU) */
class Loop {
  constructor(A, buf, dest, { chain = [], offset = true, tc = 0.06 } = {}) {
    const ctx = A.ctx; this.A = A; this.dest = dest; this.tc = tc;
    this.s = ctx.createBufferSource(); this.s.buffer = buf; this.s.loop = true; this.s.loopStart = 0; this.s.loopEnd = buf.duration;
    this.g = ctx.createGain(); this.g.gain.value = 0;
    let n = this.s; this.nodes = [this.s];
    for (const f of chain) { n.connect(f); n = f; this.nodes.push(f); }
    n.connect(this.g); this.nodes.push(this.g);
    this.s.start(0, offset ? Math.random() * buf.duration : 0);
    A._trackSrc(this.s);
    this.connected = false; this.target = 0; this.idle = 0;
  }
  set(gain, dt, rate) {
    const now = this.A.ctx.currentTime;
    this.target = gain;
    this.g.gain.setTargetAtTime(gain, now, this.tc);
    if (rate !== undefined) this.s.playbackRate.setTargetAtTime(rate, now, 0.05);
    if (gain > 0.004) { this.idle = 0; if (!this.connected) { this.g.connect(this.dest); this.connected = true; } }
    else if (this.connected) { this.idle += dt; if (this.idle > 0.7) { this.g.disconnect(); this.connected = false; } }
  }
  get audible() { return this.connected && this.target > 0.01; }
  dispose() { try { this.s.stop(); } catch {} for (const n of this.nodes) { try { n.disconnect(); } catch {} } this.connected = false; }
}

/** one engine: 7 looped recordings -> rpm-band crossfade -> on/off layers -> tone -> shift cut -> out */
class EngineVoice {
  constructor(A, { kind, spec, dest, positional, label }) {
    const ctx = A.ctx; this.A = A; this.kind = kind; this.label = label; this.positional = positional; this.dest = dest;
    const e = spec.engine; this.idle = e.idle; this.red = e.redline; this.lim = e.limiter;
    const P = PITCH[kind];
    this.f0lo = P.lo; this.alpha = Math.log(P.hi / P.lo) / Math.log(e.redline / e.idle);
    this.loops = A.bank.cars[kind];
    this.sum = ctx.createGain();
    this.srcs = this.loops.map((L) => {
      const s = ctx.createBufferSource(); s.buffer = L.buf; s.loop = true; s.loopStart = 0; s.loopEnd = L.buf.duration;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.sum);
      s.start(0, Math.random() * L.buf.duration); A._trackSrc(s);
      return { s, g, f0: L.f0, file: L.file, w: 0, dur: L.buf.duration };
    });
    this.onG = ctx.createGain(); this.offG = ctx.createGain();
    this.offLP = ctx.createBiquadFilter(); this.offLP.type = 'lowpass'; this.offLP.frequency.value = 1150; this.offLP.Q.value = 0.6;
    this.t1 = ctx.createBiquadFilter(); this.t2 = ctx.createBiquadFilter();
    if (kind === 'v8') { this.t1.type = 'lowshelf'; this.t1.frequency.value = 170; this.t1.gain.value = 4.0; this.t2.type = 'peaking'; this.t2.frequency.value = 2400; this.t2.Q.value = 0.7; this.t2.gain.value = -2.0; }
    else { this.t1.type = 'highshelf'; this.t1.frequency.value = 2600; this.t1.gain.value = 3.5; this.t2.type = 'peaking'; this.t2.frequency.value = 1500; this.t2.Q.value = 0.9; this.t2.gain.value = 2.0; }
    this.cut = ctx.createGain(); this.out = ctx.createGain(); this.out.gain.value = 0;
    this.sum.connect(this.onG); this.sum.connect(this.offLP); this.offLP.connect(this.offG);
    this.onG.connect(this.t1); this.offG.connect(this.t1); this.t1.connect(this.t2); this.t2.connect(this.cut); this.cut.connect(this.out);
    if (kind === 'turbo') {                      // turbo flutter / spool: band-passed wind recording
      this.whS = ctx.createBufferSource(); this.whS.buffer = A.buf('wind'); this.whS.loop = true; this.whS.start(0, Math.random() * 20); A._trackSrc(this.whS);
      this.whBP = ctx.createBiquadFilter(); this.whBP.type = 'bandpass'; this.whBP.frequency.value = 2600; this.whBP.Q.value = 1.4;
      this.whG = ctx.createGain(); this.whG.gain.value = 0;
      this.whS.connect(this.whBP); this.whBP.connect(this.whG); this.whG.connect(this.cut);
    }
    this.lpD = null; this.pan = null; this.tail = this.out;
    if (positional) {
      this.lpD = ctx.createBiquadFilter(); this.lpD.type = 'lowpass'; this.lpD.frequency.value = 12000; this.lpD.Q.value = 0.4;
      this.pan = A._panner([0, 0, 0]);
      this.out.connect(this.lpD); this.lpD.connect(this.pan); this.tail = this.pan;
    }
    this.connected = false; this.rpmS = this.idle; this.load = 0; this.dopS = 1; this.lastThr = 0; this.bovT = -9; this.shiftCut = 1; this.limGate = false;
    this.level = 0; this.active = false;
  }
  setActive(a) {
    if (a === this.active) return;
    this.active = a;
    if (a && !this.connected) { this.tail.connect(this.dest); this.connected = true; }
    else if (!a && this.connected) { this.tail.disconnect(); this.connected = false; }
  }
  /** fundamental (Hz) the loops must be played at for this rpm */
  pitch(rpm) { return this.f0lo * Math.pow(Math.max(rpm, this.idle * 0.85) / this.idle, this.alpha); }
  update(dt, now, { rpm, throttle, shifting, dop = 1, gain = 1 }) {
    if (!this.active) return;
    const k = 1 - Math.exp(-dt / 0.03);
    this.rpmS += (rpm - this.rpmS) * k;
    this.load += (throttle - this.load) * (1 - Math.exp(-dt / 0.10));
    this.dopS += (dop - this.dopS) * (1 - Math.exp(-dt / 0.08));
    const T = this.pitch(this.rpmS);
    let sw = 0;
    for (const L of this.srcs) { const lr = Math.log(T / L.f0); L.w = Math.exp(-0.5 * (lr / SIGMA) * (lr / SIGMA)); sw += L.w * L.w; }
    const norm = 1 / Math.sqrt(sw + 1e-9);
    for (const L of this.srcs) {
      const rate = clamp((T / L.f0) * this.dopS, 0.5, 2.3);
      L.s.playbackRate.value = rate;
      L.g.gain.setTargetAtTime(L.w * norm, now, 0.035);
    }
    const rf = clamp((this.rpmS - this.idle) / (this.red - this.idle), 0, 1);
    const lvl = (0.50 + 0.50 * Math.pow(rf, 0.8)) * gain;
    this.onG.gain.setTargetAtTime(0.24 + 0.76 * this.load, now, 0.05);
    this.offG.gain.setTargetAtTime(0.70 * (1 - this.load) * (0.5 + 0.5 * rf), now, 0.05);
    this.offLP.frequency.setTargetAtTime(700 + 1500 * rf, now, 0.08);
    this.out.gain.setTargetAtTime(lvl, now, 0.05);
    this.level = lvl;
    // shift cut + rev limiter gate
    const lim = this.rpmS > this.lim - 90 && throttle > 0.6;
    if (lim) {
      const per = 0.078; let t = Math.ceil(now / per) * per;
      this.cut.gain.cancelScheduledValues(now); this.cut.gain.setValueAtTime(((Math.round(now / per) & 1) ? 0.30 : 1), now);
      for (let i = 0; i < 6; i++, t += per) this.cut.gain.setValueAtTime(((Math.round(t / per) & 1) ? 0.30 : 1), t);
      this.limGate = true;
    } else {
      if (this.limGate) { this.cut.gain.cancelScheduledValues(now); this.limGate = false; }
      this.cut.gain.setTargetAtTime(shifting ? 0.32 : 1, now, shifting ? 0.012 : 0.03);
    }
    if (this.whG) {
      this.whG.gain.setTargetAtTime(0.34 * this.load * sstep(0.30, 0.95, rf), now, 0.08);
      this.whBP.frequency.setTargetAtTime(1800 + 2600 * rf, now, 0.1);
      // blow-off valve when lifting hard from boost
      if (this.lastThr > 0.7 && throttle < 0.15 && rf > 0.35 && now - this.bovT > 0.6) { this.bovT = now; this.A._bov(this.dest, this.positional ? this.pan : null); }
    }
    this.lastThr = throttle;
  }
  dispose() {
    for (const L of this.srcs) { try { L.s.stop(); } catch {} try { L.s.disconnect(); L.g.disconnect(); } catch {} }
    if (this.whS) { try { this.whS.stop(); } catch {} try { this.whS.disconnect(); } catch {} }
    for (const n of [this.sum, this.onG, this.offG, this.offLP, this.t1, this.t2, this.cut, this.out, this.lpD, this.pan, this.whBP, this.whG]) { if (n) { try { n.disconnect(); } catch {} } }
    this.connected = false; this.active = false;
  }
}

export class GameAudio {
  constructor() {
    this.ctx = null; this.ready = false; this.failed = null; this.loaded = false; this.limiterKind = 'none';
    this.vol = { master: 0.85, sfx: 0.9, music: 0.5 };
    this.bufs = new Map(); this.bank = null; this.ambLoaded = false;
    this.stats = { voices: 0, aiVoices: 0, maxVoices: 0, maxAiVoices: 0, peak: 0, peakDb: -120, gainReductionDb: 0, liveSources: 0, shots: 0, ctxState: 'none' };
    this.liveSrc = new Set(); this.log = []; this.paused = false; this.mode = 'menu';
    this.race = null; this.fx = null; this.amb = null; this.rec = null; this.recT0 = null;
    this.zone = new Float32Array(4); this.zoneT = new Float32Array(4); this.zoneSet = false;
    this.track = null; this.bellPos = null; this.lastBridge = false; this.revTarget = 0;
    this.t = 0;
    try { const v = JSON.parse(localStorage.getItem('racing.vol') || 'null'); if (v) Object.assign(this.vol, v); } catch {}
  }

  setTrack(track) { this.track = track; }
  buf(n) { return this.bufs.get(n); }

  // ------------------------------------------------------------------ loading (no gesture needed)
  preload(onProgress = () => {}) {
    if (this._pre) return this._pre;
    this._pre = (async () => {
      const oc = new OfflineAudioContext(2, 2048, 44100);
      const bank = await (await fetch(BASE + 'engine-bank.json')).json();
      const jobs = [];
      for (const k of Object.keys(bank.cars)) for (const L of bank.cars[k]) jobs.push(() => fetchDecode(oc, './' + L.file).then((b) => { L.buf = b; }));
      for (const n of SFX_NAMES) jobs.push(() => fetchDecode(oc, BASE + 'sfx/' + n + '.wav').then((b) => { this.bufs.set(n, b); }));
      let done = 0; const total = jobs.length + AMB_NAMES.length + MUSIC_NAMES.length;
      await Promise.all(jobs.map((j) => j().then(() => onProgress(++done / total))));
      this.bank = bank; this.loaded = true;
      // ambience is large (26 MB): decode in the background, layers fade in when they arrive
      this._ambJob = Promise.all(AMB_NAMES.map((n) => fetchDecode(oc, BASE + 'amb/' + n + '.wav').then((b) => { this.bufs.set(n, b); onProgress(++done / total); this._ambArrived(n); })))
        .then(() => { this.ambLoaded = true; });
      this._musicJob = Promise.all(MUSIC_NAMES.map((n) => fetchDecode(oc, BASE + 'music/' + n + '.ogg').then((b) => { this.bufs.set(n, b); onProgress(++done / total); }).catch(() => {})));
      return true;
    })();
    return this._pre;
  }

  // ------------------------------------------------------------------ context (first gesture)
  unlock() {
    if (this._unlocking) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this._unlocking; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.failed = 'no-webaudio'; return Promise.resolve(false); }
    this.ctx = new AC({ latencyHint: 'interactive', sampleRate: 48000 });
    const resumed = this.ctx.resume().catch(() => {});
    this._unlocking = (async () => {
      await resumed; await this.preload();
      await this._build();
      this.ready = true; this.stats.ctxState = this.ctx.state;
      this.setVolumes(this.vol);
      if (this.mode === 'menu') this._ambStart();
      return true;
    })().catch((e) => { this.failed = String(e && e.message || e); console.warn('audio init failed:', this.failed); return false; });
    return this._unlocking;
  }

  async _build() {
    const ctx = this.ctx;
    this.pre = ctx.createGain(); this.master = ctx.createGain(); this.master.gain.value = this.vol.master * 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -17; this.comp.knee.value = 14; this.comp.ratio.value = 3.2; this.comp.attack.value = 0.006; this.comp.release.value = 0.22;
    let lim = null;
    try {
      await ctx.audioWorklet.addModule('./src/audio/limiter-worklet.js');
      lim = new AudioWorkletNode(ctx, 'limiter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      lim.port.onmessage = (e) => this._limMsg(e.data);
      this.limiterKind = 'worklet-lookahead';
    } catch (e) {
      this.limiterKind = 'fallback-compressor+clip';
      const c2 = ctx.createDynamicsCompressor(); c2.threshold.value = -4; c2.knee.value = 0; c2.ratio.value = 20; c2.attack.value = 0.001; c2.release.value = 0.08;
      const sh = ctx.createWaveShaper(); const cur = new Float32Array(4097); for (let i = 0; i < cur.length; i++) { const x = (i / 2048) - 1; cur[i] = clamp(x, -0.89, 0.89); } sh.curve = cur;
      c2.connect(sh); lim = { connect: (d) => sh.connect(d), disconnect: () => sh.disconnect(), _in: c2 };
      this._fallbackIn = c2;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048; sh.connect(this.analyser);
    }
    this.limiter = lim;
    this.master.connect(this.comp);
    if (this._fallbackIn) { this.comp.connect(this._fallbackIn); lim.connect(ctx.destination); } else { this.comp.connect(lim); lim.connect(ctx.destination); }
    this.pre.connect(this.master);
    // world stage (pause muffle) + buses
    this.worldSum = ctx.createGain(); this.pauseLP = ctx.createBiquadFilter(); this.pauseLP.type = 'lowpass'; this.pauseLP.frequency.value = 20000; this.pauseLP.Q.value = 0.5;
    this.pauseG = ctx.createGain(); this.worldSum.connect(this.pauseLP); this.pauseLP.connect(this.pauseG); this.pauseG.connect(this.pre);
    const mk = (g) => { const n = ctx.createGain(); n.gain.value = g; return n; };
    this.bus = { player: mk(0.62), ai: mk(0.40), sfx: mk(0.78), amb: mk(0.50), ui: mk(0.55), music: mk(0.40) };
    for (const k of ['player', 'ai', 'sfx', 'amb']) this.bus[k].connect(this.worldSum);
    this.bus.ui.connect(this.pre); this.bus.music.connect(this.pre);
    // reverb (bridge / village streets): synthetic impulse, deterministic noise
    this.conv = ctx.createConvolver(); this.conv.buffer = this._impulse(1.5, 2.6); this.revG = mk(0); this.revOut = mk(0.8);
    this.bus.player.connect(this.revG); this.bus.sfx.connect(this.revG); this.revG.connect(this.conv); this.conv.connect(this.revOut); this.revOut.connect(this.worldSum);
    this._buildFx(); this._buildAmb();
    this.listenerReady = true;
  }

  _limMsg(m) {
    if (m.type === 'meter') {
      this.stats.peak = Math.max(this.stats.peak, m.peak); this.stats.peakDb = 20 * Math.log10(Math.max(this.stats.peak, 1e-6));
      this.stats.gainReductionDb = -20 * Math.log10(Math.max(m.gr, 1e-4));
    } else if (m.type === 'rec' && this.rec) { this.rec.L.push(m.L); this.rec.R.push(m.R); this.rec.frames += m.L.length; }
    else if (m.type === 'rec-end' && this.rec) { this.rec.sr = m.sampleRate; if (this.rec.resolve) this.rec.resolve(); }
  }

  _impulse(sec, decay) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / n; lp += (rnd() - lp) * (0.55 - 0.4 * t); d[i] = lp * Math.pow(1 - t, decay) * (i < 40 ? i / 40 : 1); }
      for (const [dt, a] of [[0.011, 0.5], [0.019, 0.38], [0.031, 0.3], [0.047, 0.22]]) d[Math.floor(dt * sr) + c * 9] += a * (c ? -1 : 1);
    }
    return b;
  }

  _panner(p) {
    const n = this.ctx.createPanner(); n.panningModel = 'equalpower'; n.distanceModel = 'inverse'; n.refDistance = 6; n.rolloffFactor = 1.5; n.maxDistance = 600;
    n.positionX.value = p[0]; n.positionY.value = p[1]; n.positionZ.value = p[2]; return n;
  }

  _trackSrc(s) { this.liveSrc.add(s); s.addEventListener('ended', () => { this.liveSrc.delete(s); }); }

  // ------------------------------------------------------------------ static layers: player tyres/wind/contact + zone ambience
  _buildFx() {
    const ctx = this.ctx, B = this.bus.sfx, f = {};
    const bq = (type, freq, q = 0.7, g = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; n.gain.value = g; return n; };
    // rolling: one asphalt source feeds asphalt / kerb / bridge paths, one gravel source feeds gravel / sand / grass paths
    const asph = this.buf('rolling-asphalt'), grav = this.buf('rolling-gravel');
    f.asphSrc = ctx.createBufferSource(); f.asphSrc.buffer = asph; f.asphSrc.loop = true; f.asphSrc.start(0, Math.random() * asph.duration); this._trackSrc(f.asphSrc);
    f.gravSrc = ctx.createBufferSource(); f.gravSrc.buffer = grav; f.gravSrc.loop = true; f.gravSrc.start(0, Math.random() * grav.duration); this._trackSrc(f.gravSrc);
    const path = (src, filters, dest) => { let n = src; for (const x of filters) { n.connect(x); n = x; } const g = ctx.createGain(); g.gain.value = 0; n.connect(g); g.connect(dest); return g; };
    f.gAsph = path(f.asphSrc, [bq('lowpass', 7500, 0.5)], B);
    f.kerbMod = ctx.createGain(); f.kerbMod.gain.value = 0.55;
    f.gKerb = path(f.asphSrc, [bq('lowpass', 3200, 0.7), f.kerbMod], B);
    f.kerbLfo = ctx.createOscillator(); f.kerbLfo.type = 'sine'; f.kerbLfo.frequency.value = 20;            // control signal only (rumble-strip rhythm)
    f.kerbDepth = ctx.createGain(); f.kerbDepth.gain.value = 0.45; f.kerbLfo.connect(f.kerbDepth); f.kerbDepth.connect(f.kerbMod.gain); f.kerbLfo.start();
    f.gBridge = path(f.asphSrc, [bq('bandpass', 430, 0.9), bq('peaking', 900, 1.2, 4)], B);
    f.gGrav = path(f.gravSrc, [bq('lowpass', 8000, 0.5)], B);
    f.gSand = path(f.gravSrc, [bq('lowpass', 1900, 0.6)], B);
    f.gGrass = path(f.gravSrc, [bq('lowpass', 850, 0.6)], B);
    f.squeal = new Loop(this, this.buf('squeal'), B, { chain: [bq('highpass', 380, 0.6)], tc: 0.04 });
    f.windLP = bq('lowpass', 800, 0.7);
    f.wind = new Loop(this, this.buf('wind'), B, { chain: [f.windLP], tc: 0.1 });
    f.scrape = new Loop(this, this.buf('scrape'), B, { chain: [bq('lowpass', 4200, 0.5)], tc: 0.03 });
    f.last = { bridgeT: 0, scrapeEnv: 0, skidOn: false, scrapeOn: false };
    this.fx = f;
  }

  _buildAmb() {
    const ctx = this.ctx;
    this.amb = { layers: {}, bells: null };
    for (const n of AMB_NAMES) if (this.buf(n)) this._ambMake(n);
    // cliff / forest wind bed: the speed-wind recording, low-passed, driven by zone instead of speed
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.5;
    this.amb.layers.windlow = new Loop(this, this.buf('wind'), this.bus.amb, { chain: [lp], tc: 0.5 });
  }
  _ambArrived(n) { if (this.amb && !this.amb.layers[n] && n !== 'bells') this._ambMake(n); else if (this.amb && n === 'bells' && !this.amb.bells) this._ambMake('bells'); }
  _ambMake(n) {
    const ctx = this.ctx, A = this.amb, buf = this.buf(n);
    if (!buf || !ctx) return;
    if (n === 'bells') {
      const p = this._panner(this.bellPos || [0, 0, 0]); p.refDistance = 70; p.rolloffFactor = 1.1; p.maxDistance = 2000;
      A.bells = new Loop(this, buf, p, { tc: 0.3 }); p.connect(this.bus.amb); A.bellPan = p; return;
    }
    A.layers[n] = new Loop(this, buf, this.bus.amb, { tc: 0.35 });
  }
  _ambStart() { /* layers are driven by update(); nothing to start */ }
  setBellPos(p) { this.bellPos = p; if (this.amb && this.amb.bellPan) { this.amb.bellPan.positionX.value = p[0]; this.amb.bellPan.positionY.value = p[1]; this.amb.bellPan.positionZ.value = p[2]; } }

  // ------------------------------------------------------------------ volumes, pause, music
  setVolumes(v) {
    Object.assign(this.vol, v);
    try { localStorage.setItem('racing.vol', JSON.stringify(this.vol)); } catch {}
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master * 0.9, now, 0.03);
    for (const k of ['player', 'ai', 'sfx', 'amb']) {
      const base = { player: 0.62, ai: 0.40, sfx: 0.78, amb: 0.50 }[k];
      this.bus[k].gain.setTargetAtTime(base * (k === 'sfx' || k === 'amb' ? this.vol.sfx : 1), now, 0.03);
    }
    this.bus.ui.gain.setTargetAtTime(0.55 * this.vol.sfx, now, 0.03);
    this.bus.music.gain.setTargetAtTime(0.40 * this.vol.music, now, 0.03);
  }
  setPaused(p) {
    this.paused = p; if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.pauseG.gain.setTargetAtTime(p ? 0.16 : 1, now, 0.07);
    this.pauseLP.frequency.setTargetAtTime(p ? 420 : 20000, now, 0.06);
    this.logEvent(p ? 'pause' : 'resume');
  }
  setMode(m) { this.mode = m; this._musicSync(); }
  /** menu / garage / setup -> title theme; results -> result theme; nothing during the race (spec: music only in menu/results) */
  _musicWanted() { return ['menu', 'garage', 'setup'].includes(this.mode) ? 'title' : this.mode === 'results' ? 'result' : null; }
  _musicSync() {
    if (!this.ready || !this.bus) return;
    const want = this._musicWanted(), cur = this.music;
    if (cur && cur.name === want) return;
    if (want && !this.buf(want)) return;                        // not decoded yet: retried every frame
    const ctx = this.ctx, now = ctx.currentTime;
    if (cur) { cur.g.gain.cancelScheduledValues(now); cur.g.gain.setTargetAtTime(0, now, 0.35); const old = cur; setTimeout(() => { try { old.src.stop(); old.src.disconnect(); old.g.disconnect(); } catch {} }, 1800); this.music = null; }
    if (want) {
      const src = ctx.createBufferSource(); src.buffer = this.buf(want); src.loop = true; const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.bus.music);
      src.start(0); this._trackSrc(src); g.gain.setTargetAtTime(1, now, 0.6); this.music = { name: want, src, g };
    }
  }

  // ------------------------------------------------------------------ races: voices come and go with the race
  beginRace(cars, { demo = false } = {}) {
    if (!this.ready) { this._pending = { cars, demo }; return; }
    this.endRace();
    const voices = new Map();
    for (const rc of cars) {
      const spec = CAR_SPECS[rc.carId], kind = spec.engineSound;
      const ve = new EngineVoice(this, { kind, spec, dest: rc.isPlayer && !demo ? this.bus.player : this.bus.ai, positional: !(rc.isPlayer && !demo), label: rc.name });
      ve.setActive(rc.isPlayer && !demo);
      voices.set(rc.id, ve);
    }
    this.race = { voices, cars, demo, prev: new Map(), lastImpact: new Map(), pass: new Map(), t: 0, lastShot: 0 };
    this.logEvent('race-begin', { cars: cars.length, demo });
  }
  endRace() {
    if (!this.race) return;
    for (const v of this.race.voices.values()) v.dispose();
    this.race = null;
    if (this.fx) { this.fx.squeal.set(0, 1); this.fx.wind.set(0, 1); this.fx.scrape.set(0, 1); for (const g of ['gAsph', 'gKerb', 'gBridge', 'gGrav', 'gSand', 'gGrass']) this.fx[g].gain.value = 0; }
  }
  /** engine demo for the garage: a scripted rev of one car's sound (temporary voice on the player bus) */
  revDemo(carId) {
    if (!this.ready) return;
    if (this._demo) { this._demo.v.dispose(); this._demo = null; }
    const spec = CAR_SPECS[carId], kind = spec.engineSound;
    const v = new EngineVoice(this, { kind, spec, dest: this.bus.player, positional: false, label: 'garage' });
    v.setActive(true); this._demo = { v, t: 0, spec };
  }
  _demoUpdate(dt, now) {
    const d = this._demo; if (!d) return;
    d.t += dt; const t = d.t, e = d.spec.engine;
    let rpm, thr;
    if (t < 0.5) { rpm = e.idle; thr = 0; } else if (t < 1.5) { const u = (t - 0.5); rpm = lerp(e.idle, e.redline * 0.72, sstep(0, 1, u)); thr = 1; }
    else if (t < 1.9) { rpm = e.redline * 0.72; thr = 1; } else if (t < 3.4) { const u = (t - 1.9) / 1.5; rpm = lerp(e.redline * 0.72, e.idle, sstep(0, 1, u)); thr = 0; }
    else if (t < 3.9) { rpm = e.idle; thr = 0; } else { d.v.dispose(); this._demo = null; return; }
    d.v.update(dt, now, { rpm, throttle: thr, shifting: false, gain: 0.9 });
  }

  // ------------------------------------------------------------------ one-shots
  _shot(name, { gain = 1, rate = 1, bus = null, pos = null, lp = 0, delay = 0, hp = 0 } = {}) {
    const b = this.buf(name); if (!b || !this.ready) return null;
    const ctx = this.ctx, nodes = [], s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; nodes.push(s);
    const g = ctx.createGain(); g.gain.value = gain; nodes.push(g); s.connect(g); let n = g;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; n.connect(f); n = f; nodes.push(f); }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n.connect(f); n = f; nodes.push(f); }
    if (pos) { const p = this._panner(pos); n.connect(p); n = p; nodes.push(p); }
    n.connect(bus || this.bus.sfx);
    this.stats.shots++;
    s.onended = () => { this.stats.shots--; for (const x of nodes) { try { x.disconnect(); } catch {} } };
    s.start(ctx.currentTime + delay);
    return s;
  }
  _bov(dest, pan) {                           // turbo blow-off: a burst of band-passed wind recording
    const ctx = this.ctx, b = this.buf('wind'); if (!b) return;
    const s = ctx.createBufferSource(); s.buffer = b; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 1.0;
    const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.002, t + 0.42);
    s.connect(bp); bp.connect(g); g.connect(pan || dest); s.start(t, Math.random() * 20, 0.5); this.stats.shots++;
    s.onended = () => { this.stats.shots--; for (const x of [s, bp, g]) { try { x.disconnect(); } catch {} } };
  }

  /** UI sounds are synthesised (allowed by the brief for UI/ambience only) */
  ui(name) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.004;
    const tone = (f, t, dur, type = 'triangle', vol = 0.3, f2 = null) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.bus.ui); o.start(t); o.stop(t + dur + 0.02); this.stats.shots++;
      o.onended = () => { this.stats.shots--; try { o.disconnect(); g.disconnect(); } catch {} };
    };
    switch (name) {
      case 'nav': tone(640, t0, 0.07, 'triangle', 0.22); break;
      case 'ok': tone(520, t0, 0.09, 'triangle', 0.26); tone(780, t0 + 0.075, 0.16, 'triangle', 0.26); break;
      case 'back': tone(560, t0, 0.07, 'triangle', 0.22); tone(380, t0 + 0.06, 0.13, 'triangle', 0.22); break;
      case 'count': tone(880, t0, 0.22, 'sine', 0.34); tone(1760, t0, 0.12, 'sine', 0.08); break;
      case 'go': tone(1320, t0, 0.65, 'sine', 0.36); tone(1980, t0, 0.45, 'triangle', 0.14); tone(660, t0, 0.5, 'sine', 0.16); break;
      case 'flag': [784, 988, 1175, 1568].forEach((f, i) => tone(f, t0 + i * 0.11, 0.5, 'triangle', 0.26)); tone(392, t0, 0.9, 'sine', 0.2); break;
      case 'lap': tone(988, t0, 0.14, 'triangle', 0.26); tone(1318, t0 + 0.1, 0.24, 'triangle', 0.26); break;
      case 'toast': tone(700, t0, 0.1, 'sine', 0.16, 900); break;
      case 'pause': tone(500, t0, 0.1, 'triangle', 0.2, 330); break;
      case 'resume': tone(330, t0, 0.1, 'triangle', 0.2, 500); break;
      default: tone(600, t0, 0.06, 'triangle', 0.2);
    }
  }

  // ------------------------------------------------------------------ per-frame update
  /** c = { cam:{x,y,z,fx,fy,fz,ux,uy,uz,vx,vy,vz}, cars, player, s (track s for ambience), raceT, state } */
  update(dt, c) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime; this.t += dt;
    this.stats.ctxState = ctx.state;
    this._listener(c.cam, now);
    this._demoUpdate(dt, now);
    if (this.t - (this._mt || 0) > 0.5) { this._mt = this.t; this._musicSync(); }
    if (this._pending && this.ready) { const p = this._pending; this._pending = null; this.beginRace(p.cars, { demo: p.demo }); }
    if (this.analyser) { const a = this._abuf || (this._abuf = new Float32Array(2048)); this.analyser.getFloatTimeDomainData(a); let m = 0; for (let i = 0; i < a.length; i++) { const x = Math.abs(a[i]); if (x > m) m = x; } this.stats.peak = Math.max(this.stats.peak, m); this.stats.peakDb = 20 * Math.log10(Math.max(this.stats.peak, 1e-6)); }
    const R = this.race;
    let aiAct = 0, voices = 0;
    if (R) {
      R.t = c.raceT || 0;
      const cam = c.cam, P = c.player;
      // --- AI voices: nearest MAX_AI_VOICES within range are alive, the rest are silent
      const ais = [];
      for (const rc of R.cars) {
        const vo = R.voices.get(rc.id); if (!vo) continue;
        if (rc.isPlayer && !R.demo) continue;
        const dx = rc.v.p[0] - cam.x, dy = rc.v.p[1] - cam.y, dz = rc.v.p[2] - cam.z;
        ais.push({ rc, vo, d: Math.hypot(dx, dy, dz), dx, dy, dz });
      }
      ais.sort((a, b) => a.d - b.d);
      ais.forEach((a, k) => {
        const on = k < MAX_AI_VOICES && a.d < AI_RANGE;
        a.vo.setActive(on);
        if (!on) return;
        aiAct++;
        const v = a.rc.v, pan = a.vo.pan;
        pan.positionX.setValueAtTime(v.p[0], now); pan.positionY.setValueAtTime(v.p[1], now); pan.positionZ.setValueAtTime(v.p[2], now);
        const inv = 1 / Math.max(a.d, 0.5), nx = a.dx * inv, ny = a.dy * inv, nz = a.dz * inv;
        const vr = (v.v[0] - (cam.vx || 0)) * nx + (v.v[1] - (cam.vy || 0)) * ny + (v.v[2] - (cam.vz || 0)) * nz;      // + = receding
        const dop = clamp(1 - 0.5 * vr / C_SOUND, 0.93, 1.07);
        a.vo.lpD.frequency.setTargetAtTime(clamp(15000 - a.d * 85, 2200, 15000), now, 0.1);
        a.vo.update(dt, now, { rpm: v.rpm, throttle: v.throttle, shifting: v.shiftTimer > 0, dop, gain: 1.0 });
        // pass-by detection (sign change of the longitudinal offset in the listener frame, close by)
        const along = a.dx * (cam.fx || 0) + a.dz * (cam.fz || 0), prev = R.prev.get(a.rc.id);
        if (prev !== undefined && Math.sign(prev) !== Math.sign(along) && a.d < 20 && this.t - (R.pass.get(a.rc.id) || -9) > 3) {
          R.pass.set(a.rc.id, this.t);
          this.logEvent('ai-pass', { ai: a.rc.name, dir: prev > 0 ? 'player-overtakes' : 'ai-overtakes', dist: +a.d.toFixed(1) });
          this._shot('wind', { gain: clamp(0.12 + Math.abs(vr) / 120, 0, 0.5), rate: 1.3, lp: 5200, hp: 500, bus: this.bus.sfx, pos: [v.p[0], v.p[1], v.p[2]] });
        }
        R.prev.set(a.rc.id, along);
        // AI crash / scrape heard from a distance
        const ev = v.ev;
        if (ev.impact > 0.1 && this.t - (R.lastImpact.get(a.rc.id) || -9) > 0.25) {
          R.lastImpact.set(a.rc.id, this.t);
          this._crash(ev.impact, [v.p[0], v.p[1], v.p[2]]);
        }
      });
      // --- player
      if (P && !R.demo) {
        const vo = R.voices.get(P.id), v = P.v;
        if (vo) { vo.setActive(true); vo.update(dt, now, { rpm: v.rpm, throttle: v.throttle, shifting: v.shiftTimer > 0, gain: 1.0 }); }
        this._playerFx(dt, now, P, c);
      } else if (this.fx) { this._fxSilence(dt); }
    } else if (this.fx) this._fxSilence(dt);
    this._ambience(dt, now, c);
    // --- reverb send: bridge deck / village streets
    this.revG.gain.setTargetAtTime(this.revTarget, now, 0.25);
    // --- voice accounting
    if (R) for (const vo of R.voices.values()) if (vo.active && vo.out) voices++;
    const f = this.fx;
    if (f) { for (const k of ['gAsph', 'gKerb', 'gBridge', 'gGrav', 'gSand', 'gGrass']) if (f._lastG && f._lastG[k] > 0.01) voices++; for (const l of [f.squeal, f.wind, f.scrape]) if (l.audible) voices++; }
    if (this.amb) { for (const l of Object.values(this.amb.layers)) if (l.audible) voices++; if (this.amb.bells && this.amb.bells.audible) voices++; }
    voices += this.stats.shots + (this._demo ? 1 : 0) + (this.music ? 1 : 0);
    this.stats.voices = voices; this.stats.aiVoices = aiAct; this.stats.liveSources = this.liveSrc.size;
    if (voices > this.stats.maxVoices) this.stats.maxVoices = voices;
    if (aiAct > this.stats.maxAiVoices) this.stats.maxAiVoices = aiAct;
  }

  _listener(cam, now) {
    if (!cam) return; const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.setValueAtTime(cam.x, now); L.positionY.setValueAtTime(cam.y, now); L.positionZ.setValueAtTime(cam.z, now);
      L.forwardX.setValueAtTime(cam.fx, now); L.forwardY.setValueAtTime(cam.fy, now); L.forwardZ.setValueAtTime(cam.fz, now);
      L.upX.setValueAtTime(cam.ux, now); L.upY.setValueAtTime(cam.uy, now); L.upZ.setValueAtTime(cam.uz, now);
    } else { L.setPosition(cam.x, cam.y, cam.z); L.setOrientation(cam.fx, cam.fy, cam.fz, cam.ux, cam.uy, cam.uz); }
  }

  _fxSilence(dt) {
    const f = this.fx; f._lastG = f._lastG || {}; const now = this.ctx.currentTime;
    for (const g of ['gAsph', 'gKerb', 'gBridge', 'gGrav', 'gSand', 'gGrass']) { f[g].gain.setTargetAtTime(0, now, 0.05); f._lastG[g] = 0; }
    f.squeal.set(0, dt); f.wind.set(0, dt); f.scrape.set(0, dt);
  }

  _playerFx(dt, now, P, c) {
    const f = this.fx, v = P.v, R = this.race; f._lastG = f._lastG || {};
    const sp = Math.hypot(v.v[0], v.v[2]);
    // surface mix from the wheels that touch the ground
    const w = { asph: 0, kerb: 0, bridge: 0, grav: 0, sand: 0, grass: 0 }; let n = 0, skid = 0;
    for (const wh of v.wheels) {
      if (!wh.contact) continue; n++;
      switch (wh.surf) {
        case SURF.KERB: w.kerb++; break; case SURF.BRIDGE: w.bridge++; break; case SURF.GRAVEL: case SURF.ROCK: w.grav++; break;
        case SURF.SAND: case SURF.WATER: w.sand++; break; case SURF.GRASS: w.grass++; break; default: w.asph++;
      }
      if (wh.surf === SURF.ASPHALT || wh.surf === SURF.KERB || wh.surf === SURF.BRIDGE || wh.surf === SURF.COBBLE) skid = Math.max(skid, wh.skid);
    }
    const air = v.airborne > 0.12 ? 0.15 : 1;
    const base = sstep(0.4, 9, sp) * (0.30 + 0.70 * sstep(4, 65, sp)) * air / 4;
    const setG = (k, val) => { f[k].gain.setTargetAtTime(val, now, 0.07); f._lastG[k] = val; };
    setG('gAsph', base * w.asph * 0.85); setG('gKerb', base * w.kerb * 1.1); setG('gBridge', base * w.bridge * 1.0);
    setG('gGrav', base * w.grav * 1.0); setG('gSand', base * w.sand * 0.95); setG('gGrass', base * w.grass * 0.8);
    const rr = clamp(0.78 + sp / 105, 0.78, 1.5);
    f.asphSrc.playbackRate.setTargetAtTime(rr, now, 0.08); f.gravSrc.playbackRate.setTargetAtTime(clamp(0.85 + sp / 140, 0.85, 1.35), now, 0.08);
    f.kerbLfo.frequency.setTargetAtTime(clamp(sp / 1.3, 5, 48), now, 0.1);
    // squeal ~ slip
    const sq = sstep(0.16, 0.85, skid) * 0.85 * sstep(2, 8, sp);
    f.squeal.set(sq, dt, 0.82 + 0.5 * skid + 0.1 * clamp(sp / 60, 0, 1));
    if (sq > 0.35 && !f.last.skidOn) { f.last.skidOn = true; this.logEvent('skid', { slip: +skid.toFixed(2), kmh: Math.round(sp * 3.6) }); }
    else if (sq < 0.12) f.last.skidOn = false;
    // wind
    const wi = Math.pow(clamp(sp / 75, 0, 1), 1.7);
    f.wind.set(0.9 * wi, dt, 0.9 + 0.3 * wi); f.windLP.frequency.setTargetAtTime(260 + sp * 95, now, 0.1);
    // scrape (guard-rail / wall contact)
    const ev = v.ev;
    f.last.scrapeEnv = Math.max(ev.scrape, f.last.scrapeEnv * Math.exp(-dt / 0.14));
    const sc = f.last.scrapeEnv > 0.04 ? clamp(f.last.scrapeEnv, 0, 1) * 0.8 : 0;
    f.scrape.set(sc, dt, 0.8 + 0.5 * clamp(sp / 50, 0, 1));
    if (sc > 0.15 && !f.last.scrapeOn) { f.last.scrapeOn = true; this.logEvent('scrape', { level: +sc.toFixed(2) }); } else if (sc < 0.05) f.last.scrapeOn = false;
    // shifts
    if (ev.shifts > 0) {
      this._shot('gear', { gain: ev.shiftDir > 0 ? 0.42 : 0.55, rate: ev.shiftDir > 0 ? 1.0 : 0.88, bus: this.bus.sfx, lp: 6000 });
      this.logEvent('shift', { dir: ev.shiftDir > 0 ? 'up' : 'down', gear: v.gear, rpm: Math.round(v.rpm) });
    }
    // impact
    if (ev.impact > 0.06 && this.t - (R.lastImpact.get(P.id) || -9) > 0.18) {
      R.lastImpact.set(P.id, this.t);
      this._crash(ev.impact, null); this.logEvent('impact', { level: +ev.impact.toFixed(2), body: !!ev.bodyHit, kmh: Math.round(sp * 3.6) });
    }
    // bridge: hollow rolling + expansion-joint thumps, reverb send
    const onBridge = w.bridge >= 2;
    if (onBridge !== this.lastBridge) { this.lastBridge = onBridge; this.logEvent(onBridge ? 'bridge-enter' : 'bridge-exit', { kmh: Math.round(sp * 3.6) }); }
    if (onBridge && sp > 6) {
      f.last.bridgeT += dt * sp;
      if (f.last.bridgeT > 14) { f.last.bridgeT -= 14; this._shot('gear', { gain: 0.35, rate: 0.34, lp: 330, bus: this.bus.sfx }); }
    }
    const zi = this.track ? this.track.zoneAt(P.hint >= 0 ? P.hint : 0) : 0;
    this.revTarget = onBridge ? 0.32 : (zi === 2 ? 0.07 : 0.015);
  }

  _crash(level, pos) {
    const o = { bus: this.bus.sfx, pos };
    if (level < 0.22) this._shot('crash-med', { ...o, gain: 0.25 + level * 1.6, rate: 1.35 + Math.random() * 0.15, lp: 7000 });
    else if (level < 0.6) this._shot('crash-med', { ...o, gain: 0.6 + level * 0.7, rate: 0.95 + Math.random() * 0.1 });
    else { this._shot('crash-big', { ...o, gain: 0.75 + level * 0.25, rate: 0.96 + Math.random() * 0.08 }); if (level > 0.8) this._shot('crash-glass', { ...o, gain: 0.4, delay: 0.03 }); }
  }

  _ambience(dt, now, c) {
    const A = this.amb; if (!A) return;
    let s = c.s ?? 0;
    const T = this.track; const L = T ? T.length : 3047.5;
    zoneWeights(T ? T.zones : [{ s0: 0, s1: L }], L, s, this.zoneT);
    const w = this.zoneT;
    const quiet = (this.mode === 'menu' || this.mode === 'garage') ? 1 : 1;
    for (const [n, layer] of Object.entries(A.layers)) {
      const mix = AMB_MIX[n]; let g = 0; for (let k = 0; k < mix.length; k++) g += mix[k] * (w[k] || 0);
      layer.set(g * AMB_LEVEL[n] * quiet, dt);
    }
    if (A.bells) A.bells.set(0.75, dt);
  }

  // ------------------------------------------------------------------ logging, recording, audit
  logEvent(type, d = {}) {
    const ct = this.ctx ? this.ctx.currentTime : 0;
    const e = { type, ct: +ct.toFixed(3), rt: this.recT0 !== null ? +(ct - this.recT0).toFixed(3) : null, race: this.race ? +(this.race.t || 0).toFixed(2) : null, ...d };
    this.log.push(e); if (this.log.length > 6000) this.log.splice(0, 1000);
  }
  startRecording() {
    if (!this.ready || !this.limiter || !this.limiter.port) return false;
    this.rec = { L: [], R: [], frames: 0, sr: this.ctx.sampleRate, resolve: null };
    this.recT0 = this.ctx.currentTime; this.limiter.port.postMessage('peak-reset'); this.limiter.port.postMessage('rec-start');
    this.stats.peak = 0; return true;
  }
  stopRecording() {
    if (!this.rec) return Promise.resolve(null);
    const r = this.rec;
    return new Promise((res) => {
      r.resolve = () => {
        const n = r.frames, pcm = new Int16Array(n * 2); let peak = 0, o = 0, sq = 0;
        for (let ci = 0; ci < r.L.length; ci++) {
          const L = r.L[ci], Rr = r.R[ci];
          for (let i = 0; i < L.length; i++) {
            const a = L[i], b = Rr[i]; peak = Math.max(peak, Math.abs(a), Math.abs(b)); sq += a * a + b * b;
            pcm[o++] = Math.max(-32768, Math.min(32767, Math.round(a * 32767))); pcm[o++] = Math.max(-32768, Math.min(32767, Math.round(b * 32767)));
          }
        }
        const sr = r.sr, bytes = new Uint8Array(44 + pcm.length * 2), dv = new DataView(bytes.buffer);
        const wr = (p, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(p + i, s.charCodeAt(i)); };
        wr(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); wr(8, 'WAVE'); wr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
        dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
        bytes.set(new Uint8Array(pcm.buffer), 44);
        this.wav = bytes;
        this.recInfo = { frames: n, seconds: +(n / sr).toFixed(2), sampleRate: sr, peakLinear: peak, peakDbfs: 20 * Math.log10(Math.max(peak, 1e-9)), rmsDbfs: 20 * Math.log10(Math.max(Math.sqrt(sq / Math.max(1, n * 2)), 1e-9)), bytes: bytes.length };
        this.rec = null; this.recT0 = null; res(this.recInfo);
      };
      this.limiter.port.postMessage('rec-stop');
    });
  }
  /** base64 slice of the recorded wav (offset/length in bytes; length multiple of 3 keeps the pieces concatenable) */
  wavChunk(offset, length) {
    const b = this.wav.subarray(offset, Math.min(this.wav.length, offset + length)); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  /** what the scene audit (13.1 test 8) needs: the player's engine must be built from AudioBuffers */
  audit() {
    const out = { engineIsSampled: false, playerEngine: null, kinds: {}, oscillatorsInEnginePath: 0, limiter: this.limiterKind, contextRate: this.ctx ? this.ctx.sampleRate : 0 };
    if (!this.bank) return out;
    for (const k of Object.keys(this.bank.cars)) {
      const loops = this.bank.cars[k];
      out.kinds[k] = { loops: loops.length, bands: loops.map((L) => ({ file: L.file, f0: L.f0, seconds: +L.buf.duration.toFixed(3), channels: L.buf.numberOfChannels, sampleRate: L.buf.sampleRate, acf: L.acf })), sources: [...new Set(loops.map((L) => L.src))] };
    }
    const P = this.race && [...this.race.voices.values()].find((v) => !v.positional);
    if (P) out.playerEngine = { kind: P.kind, bufferSources: P.srcs.length, buffersBound: P.srcs.filter((s) => s.s.buffer).length, bands: P.srcs.map((s) => ({ f0: s.f0, file: s.file })) };
    out.engineIsSampled = !!(out.playerEngine && out.playerEngine.buffersBound >= 4);
    return out;
  }
  /** bookkeeping for the "restart 3x" test */
  snapshot() { return { liveSources: this.liveSrc.size, voices: this.stats.voices, shots: this.stats.shots, raceVoices: this.race ? this.race.voices.size : 0, aiVoices: this.stats.aiVoices, ctx: this.ctx ? this.ctx.state : 'none' }; }
}
