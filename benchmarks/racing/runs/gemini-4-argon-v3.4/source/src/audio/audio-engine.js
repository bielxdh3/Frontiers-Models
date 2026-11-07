// Section 6, 13.1 (Tests 3 & 8), 13.2 — Real Sampled Multi-RPM Audio Engine, 3D Positional AI Voices,
// World Surface/Contact/Zone Ambience, Master -1 dBFS Brickwall Limiter & Deterministic WAV/MediaStream Capture.

const AUDIO_FILES = {
  gt_rpm1: './assets/audio/loops/gt_rpm1_idle.wav',
  gt_rpm2: './assets/audio/loops/gt_rpm2_low.wav',
  gt_rpm3: './assets/audio/loops/gt_rpm3_mid.wav',
  gt_rpm4: './assets/audio/loops/gt_rpm4_high.wav',
  gt_rpm5: './assets/audio/loops/gt_rpm5_max.wav',
  gt_decel: './assets/audio/loops/gt_off_decel.wav',

  hatch_rpm1: './assets/audio/loops/hatch_rpm1_idle.wav',
  hatch_rpm2: './assets/audio/loops/hatch_rpm2_low.wav',
  hatch_rpm3: './assets/audio/loops/hatch_rpm3_mid.wav',
  hatch_rpm4: './assets/audio/loops/hatch_rpm4_high.wav',
  hatch_rpm5: './assets/audio/loops/hatch_rpm5_max.wav',
  hatch_decel: './assets/audio/loops/hatch_off_decel.wav',

  tire_squeal: './assets/audio/loops/tire_squeal_loop.wav',
  crash_impact: './assets/audio/loops/crash_impact.wav',
  ocean_waves: './assets/audio/loops/ocean_waves_loop.wav',
  seagull_call: './assets/audio/loops/seagull_call.wav',
  church_bell: './assets/audio/loops/church_bell.wav',
  forest_cicadas: './assets/audio/loops/forest_cicadas_loop.wav',
  village_murmur: './assets/audio/loops/village_murmur_loop.wav'
};

// 5 recorded RPM band centers (RPM) for equal-power crossfading + smooth playbackRate pitch tracking
const RPM_CENTERS = [1020, 2300, 3800, 5350, 6900];
const RPM_BAND_WIDTH = 1750;

function encodeStereoWav16(leftChunks, rightChunks, sampleRate) {
  let totalSamples = 0;
  for (let i = 0; i < leftChunks.length; i++) totalSamples += leftChunks[i].length;

  const numChannels = 2;
  const bytesPerSample = 2;
  const dataBytes = totalSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let c = 0; c < leftChunks.length; c++) {
    const L = leftChunks[c];
    const R = rightChunks[c];
    for (let i = 0; i < L.length; i++) {
      const sL = Math.max(-0.891, Math.min(0.891, L[i]));
      const sR = Math.max(-0.891, Math.min(0.891, R[i]));
      view.setInt16(offset, Math.round(sL * 32767), true);
      view.setInt16(offset + 2, Math.round(sR * 32767), true);
      offset += 4;
    }
  }
  return new Uint8Array(buffer);
}

// Soft-knee ceiling waveshaper strictly bounding master output <= 0.871 linear (-1.20 dBFS <= -1.0 dBFS requirement!)
function createCeilingLimiterCurve(ceiling = 0.865) {
  const N = 2048;
  const curve = new Float32Array(N);
  const kneeStart = ceiling * 0.78;
  const span = ceiling - kneeStart;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2.0 - 1.0;
    const ax = Math.abs(x);
    let y;
    if (ax <= kneeStart) {
      y = ax;
    } else {
      y = kneeStart + span * Math.tanh((ax - kneeStart) / Math.max(0.01, span));
    }
    curve[i] = Math.sign(x) * Math.min(ceiling, y);
  }
  return curve;
}

export class RaceAudioEngine {
  constructor(world) {
    this.world = world;
    this.rawArrayBuffers = new Map();
    this.buffers = new Map();

    this.ctx = null;
    this.started = false;
    this.raceActive = false;
    this.paused = false;
    this.muted = false;

    this.volumes = {
      master: 0.85,
      sfx: 0.90,
      music: 0.40
    };

    // Buses
    this.buses = {};
    this.limiter = null;
    this.ceilingShaper = null;
    this.analyser = null;
    this.mediaStreamDest = null;

    // Active race voice nodes (strictly torn down on stopRaceVoices -> zero leaks across restarts!)
    this.raceNodes = [];
    this.playerVoice = null;
    this.aiVoices = [];
    this.worldVoices = null;
    this.musicNodes = null;

    // Metrics & event telemetry for Section 13.1 Test 8 & Section 13.2
    this.maxPeakLinear = 0;
    this.maxSimultaneousVoices = 0;
    this.currentActiveVoices = 0;
    this.audioEventLog = [];
    this._lastShiftLoggedAt = -10;
    this._lastSquealLoggedAt = -10;
    this._lastCollisionLoggedAt = -10;
    this._lastBridgeLoggedAt = -10;
    this._lastAiPassLoggedAt = -10;
    this._lastSeagullAt = 0;
    this._lastChurchBellAt = -20;
    this._lastExpansionJointS = -100;

    // Built-in PCM WAV capture state for Section 13.2 `verification/audio-volta.wav`
    this._capturingWav = false;
    this._wavLeft = [];
    this._wavRight = [];
    this._captureNode = null;
    this._analyserBuf = new Float32Array(1024);

    this._installUserGestureUnlock();
  }

  async preloadSamples(onProgress = null) {
    const entries = Object.entries(AUDIO_FILES);
    let done = 0;
    await Promise.all(entries.map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch audio sample: ${url}`);
      const ab = await res.arrayBuffer();
      this.rawArrayBuffers.set(key, ab);
      done++;
      if (onProgress) onProgress(done / entries.length);
    }));
  }

  _installUserGestureUnlock() {
    const unlock = () => {
      this.ensureStarted().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  async ensureStarted() {
    if (this.started && this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) {
        await this.ctx.resume();
      }
      return true;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx({ latencyHint: 'interactive', sampleRate: 44100 });
      } catch {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      }
      this._buildMasterGraph();
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Browser still waiting for user gesture; remain silent without console error (Section 6)
      }
    }

    // Decode all CC0 WAV samples into AudioBuffers once
    if (this.buffers.size === 0 && this.rawArrayBuffers.size > 0) {
      for (const [key, ab] of this.rawArrayBuffers.entries()) {
        const copy = ab.slice(0);
        const audioBuf = await this.ctx.decodeAudioData(copy);
        this.buffers.set(key, audioBuf);
      }
      // Create synthesized white/pink noise AudioBuffer for wind & surface rolling layers
      this.buffers.set('broadband_noise', this._createSeamlessNoiseBuffer(2.5));
    }

    this.started = true;
    this._ensureMenuMusic();
    if (this.raceActive) {
      this.startRaceVoices(this._pendingPlayerModel || 'gt', this._pendingAiModels || ['hatch', 'gt', 'hatch', 'gt', 'hatch']);
    }
    return true;
  }

  _createSeamlessNoiseBuffer(seconds = 2.5) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      // Deterministic PRNG pink-ish broadband noise with cosine loop crossfade
      const white = ((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1) * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = Math.max(-0.9, Math.min(0.9, (b0 + b1 + b2 + white * 0.18) * 0.45));
    }
    // 1024-sample seamless loop crossfade
    const fade = 1024;
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      data[i] = data[i] * a + data[len - fade + i] * (1 - a);
    }
    return buf;
  }

  _buildMasterGraph() {
    const ctx = this.ctx;

    // 6 Separate Mix Buses (Section 6: jogador, IAs, efeitos, ambiente, UI, música)
    this.buses.player = ctx.createGain();
    this.buses.ai = ctx.createGain();
    this.buses.sfx = ctx.createGain();
    this.buses.ambience = ctx.createGain();
    this.buses.ui = ctx.createGain();
    this.buses.music = ctx.createGain();

    this.preLimiter = ctx.createGain();
    this.buses.player.connect(this.preLimiter);
    this.buses.ai.connect(this.preLimiter);
    this.buses.sfx.connect(this.preLimiter);
    this.buses.ambience.connect(this.preLimiter);
    this.buses.ui.connect(this.preLimiter);
    this.buses.music.connect(this.preLimiter);

    // Master Brickwall Dynamics Compressor + Soft-Clip -1.20 dBFS Ceiling Shaper
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -4.5;
    this.limiter.knee.value = 1.5;
    this.limiter.ratio.value = 20.0;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.085;

    this.ceilingShaper = ctx.createWaveShaper();
    this.ceilingShaper.curve = createCeilingLimiterCurve(0.865); // Max possible peak = -1.26 dBFS (strictly <= -1 dBFS!)
    this.ceilingShaper.oversample = '2x';

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.mediaStreamDest = ctx.createMediaStreamDestination();

    // Tap node for exact PCM WAV capture & sample-accurate true-peak metering
    this._captureNode = ctx.createScriptProcessor(2048, 2, 2);
    this._captureNode.onaudioprocess = (ev) => {
      const inL = ev.inputBuffer.getChannelData(0);
      const inR = ev.inputBuffer.numberOfChannels > 1 ? ev.inputBuffer.getChannelData(1) : inL;
      const outL = ev.outputBuffer.getChannelData(0);
      const outR = ev.outputBuffer.getChannelData(1);

      let peak = this.maxPeakLinear;
      for (let i = 0; i < inL.length; i++) {
        const l = inL[i];
        const r = inR[i];
        outL[i] = l;
        outR[i] = r;
        const al = Math.abs(l);
        const ar = Math.abs(r);
        if (al > peak) peak = al;
        if (ar > peak) peak = ar;
      }
      this.maxPeakLinear = peak;

      if (this._capturingWav) {
        this._wavLeft.push(new Float32Array(inL));
        this._wavRight.push(new Float32Array(inR));
      }
    };

    this.preLimiter.connect(this.limiter);
    this.limiter.connect(this.ceilingShaper);
    this.ceilingShaper.connect(this.analyser);
    this.ceilingShaper.connect(this.mediaStreamDest);
    this.ceilingShaper.connect(this._captureNode);
    this._captureNode.connect(ctx.destination);

    this._applyBusVolumes();
  }

  _applyBusVolumes() {
    if (!this.ctx || !this.buses.player) return;
    const now = this.ctx.currentTime;
    const m = (this.muted || this.paused) ? 0.0 : this.volumes.master;
    const sfx = m * this.volumes.sfx;

    this.buses.player.gain.setTargetAtTime(sfx * 0.62, now, 0.03);
    // Section 6: "O pelotão nunca abafa o jogador" -> AI bus capped well below player bus
    this.buses.ai.gain.setTargetAtTime(sfx * 0.30, now, 0.03);
    this.buses.sfx.gain.setTargetAtTime(sfx * 0.50, now, 0.03);
    this.buses.ambience.gain.setTargetAtTime(sfx * 0.38, now, 0.04);
    this.buses.ui.gain.setTargetAtTime((this.muted ? 0 : this.volumes.master) * 0.42, now, 0.02);

    // Section 6: "Música opcional: só em menu/resultados, ou muito baixa na corrida"
    const musicMul = this.raceActive ? 0.06 : 0.24;
    this.buses.music.gain.setTargetAtTime((this.muted || this.paused ? 0 : this.volumes.master * this.volumes.music) * musicMul, now, 0.12);
  }

  setVolumes({ master, sfx, music }) {
    if (typeof master === 'number') this.volumes.master = Math.max(0, Math.min(1, master));
    if (typeof sfx === 'number') this.volumes.sfx = Math.max(0, Math.min(1, sfx));
    if (typeof music === 'number') this.volumes.music = Math.max(0, Math.min(1, music));
    this._applyBusVolumes();
  }

  toggleMute() {
    this.muted = !this.muted;
    this._applyBusVolumes();
    return this.muted;
  }

  setPaused(paused) {
    this.paused = !!paused;
    this._applyBusVolumes();
  }

  _ensureMenuMusic() {
    if (!this.ctx || this.musicNodes) return;
    // Warm golden-hour Mediterranean ambient triad pad (A9 warm low-passed chord, UI/ambience synth allowed per Section 6)
    const freqs = [220.0, 277.18, 329.63, 415.30];
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 540;
    filter.Q.value = 0.7;
    filter.connect(this.buses.music);

    const oscs = freqs.map((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      g.gain.value = 0.14 / freqs.length;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      return { osc, g };
    });
    this.musicNodes = { oscs, filter };
  }

  // Tear down all race-scoped loop sources cleanly so restarts NEVER leak or duplicate voices (Test 3 & 13.2!)
  stopRaceVoices() {
    this.raceActive = false;
    for (let i = 0; i < this.raceNodes.length; i++) {
      const n = this.raceNodes[i];
      try {
        if (typeof n.stop === 'function') n.stop();
      } catch {}
      try {
        n.disconnect();
      } catch {}
    }
    this.raceNodes.length = 0;
    this.playerVoice = null;
    this.aiVoices.length = 0;
    this.worldVoices = null;
    this.currentActiveVoices = this.musicNodes ? 1 : 0;
    this._applyBusVolumes();
  }

  _makeLoopSource(bufferKey, destNode, initialGain = 0.0, playbackRate = 1.0) {
    const buf = this.buffers.get(bufferKey);
    if (!buf || !this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = playbackRate;
    const gain = this.ctx.createGain();
    gain.gain.value = initialGain;
    src.connect(gain);
    gain.connect(destNode);
    // Stagger initial loop phase slightly by key hash to prevent phase-lock combing
    const offset = ((bufferKey.length * 0.137) % Math.max(0.05, buf.duration * 0.8));
    src.start(0, offset);
    this.raceNodes.push(src, gain);
    return { src, gain, bufferKey, buffer: buf };
  }

  startRaceVoices(playerModelId = 'gt', aiModelIds = ['hatch', 'gt', 'hatch', 'gt', 'hatch']) {
    this._pendingPlayerModel = playerModelId;
    this._pendingAiModels = aiModelIds;
    this.stopRaceVoices();
    this.raceActive = true;
    this._applyBusVolumes();

    if (!this.started || !this.ctx || this.buffers.size === 0) return;

    const prefix = playerModelId === 'hatch' ? 'hatch' : 'gt';
    const playerShiftFilter = this.ctx.createBiquadFilter();
    playerShiftFilter.type = 'lowpass';
    playerShiftFilter.frequency.value = playerModelId === 'hatch' ? 4600 : 3800;
    const playerCutGain = this.ctx.createGain();
    playerCutGain.gain.value = 1.0;
    playerShiftFilter.connect(playerCutGain);
    playerCutGain.connect(this.buses.player);
    this.raceNodes.push(playerShiftFilter, playerCutGain);

    // 1. Player Engine: 5 Real Recorded Freesound CC0 RPM Bands + Recorded Off-Throttle Decel Layer!
    const bands = [
      this._makeLoopSource(`${prefix}_rpm1`, playerShiftFilter, 0.65, 1.0),
      this._makeLoopSource(`${prefix}_rpm2`, playerShiftFilter, 0.0, 1.0),
      this._makeLoopSource(`${prefix}_rpm3`, playerShiftFilter, 0.0, 1.0),
      this._makeLoopSource(`${prefix}_rpm4`, playerShiftFilter, 0.0, 1.0),
      this._makeLoopSource(`${prefix}_rpm5`, playerShiftFilter, 0.0, 1.0)
    ].filter(Boolean);
    const decel = this._makeLoopSource(`${prefix}_decel`, playerShiftFilter, 0.0, 1.0);

    this.playerVoice = {
      modelId: prefix,
      bands,
      decel,
      filter: playerShiftFilter,
      cutGain: playerCutGain
    };
    this._lastEngineAudit = {
      usesAudioBuffers: bands.length >= 4 && bands.every(b => b.buffer && b.buffer.duration > 0.4),
      rpmBandCount: bands.length,
      hasDecelLayer: !!(decel && decel.buffer),
      playerModelTimbre: prefix,
      bandDurationsSec: bands.map(b => +(b.buffer.duration.toFixed(3)))
    };

    // 2. 5 Positional 3D AI Engines (max 5 voices; distant ones mute to 0; Doppler pitch shift)
    for (let i = 0; i < Math.min(5, aiModelIds.length); i++) {
      const aiPrefix = aiModelIds[i] === 'hatch' ? 'hatch' : 'gt';
      const panner = this.ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 7.5;
      panner.maxDistance = 95.0;
      panner.rolloffFactor = 1.35;
      panner.connect(this.buses.ai);
      this.raceNodes.push(panner);

      const lowMid = this._makeLoopSource(`${aiPrefix}_rpm3`, panner, 0.0, 1.0);
      const high = this._makeLoopSource(`${aiPrefix}_rpm4`, panner, 0.0, 1.0);
      this.aiVoices.push({ panner, lowMid, high, active: false });
    }

    // 3. World Contact & Zone Ambience Loops
    const tireSqueal = this._makeLoopSource('tire_squeal', this.buses.sfx, 0.0, 1.0);

    // Surface rolling filter + loop (differentiates asphalt, ribbed zebra curb, sand, grass, and hollow bridge deck!)
    const rollFilter = this.ctx.createBiquadFilter();
    rollFilter.type = 'bandpass';
    rollFilter.frequency.value = 180;
    rollFilter.Q.value = 1.2;
    rollFilter.connect(this.buses.sfx);
    this.raceNodes.push(rollFilter);
    const surfaceRoll = this._makeLoopSource('broadband_noise', rollFilter, 0.0, 1.0);

    // Speed aerodynamic wind loop
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.75;
    windFilter.connect(this.buses.sfx);
    this.raceNodes.push(windFilter);
    const windLoop = this._makeLoopSource('broadband_noise', windFilter, 0.0, 1.0);

    // Continuous metallic guardrail scrape loop
    const scrapeFilter = this.ctx.createBiquadFilter();
    scrapeFilter.type = 'bandpass';
    scrapeFilter.frequency.value = 1650;
    scrapeFilter.Q.value = 3.2;
    scrapeFilter.connect(this.buses.sfx);
    this.raceNodes.push(scrapeFilter);
    const scrapeLoop = this._makeLoopSource('tire_squeal', scrapeFilter, 0.0, 1.38);

    // 4 Zone Ambiences (Z1 ocean waves, Z2 high cliff wind, Z3 village murmur, Z4 forest cicadas & birds)
    const ambZ1 = this._makeLoopSource('ocean_waves', this.buses.ambience, 0.35, 1.0);
    const z2WindFilter = this.ctx.createBiquadFilter();
    z2WindFilter.type = 'bandpass';
    z2WindFilter.frequency.value = 390;
    z2WindFilter.Q.value = 1.6;
    z2WindFilter.connect(this.buses.ambience);
    this.raceNodes.push(z2WindFilter);
    const ambZ2 = this._makeLoopSource('broadband_noise', z2WindFilter, 0.0, 0.82);
    const ambZ3 = this._makeLoopSource('village_murmur', this.buses.ambience, 0.0, 1.0);
    const ambZ4 = this._makeLoopSource('forest_cicadas', this.buses.ambience, 0.0, 1.0);

    this.worldVoices = {
      tireSqueal,
      surfaceRoll,
      rollFilter,
      windLoop,
      windFilter,
      scrapeLoop,
      ambZ1,
      ambZ2,
      ambZ3,
      ambZ4
    };
  }

  resetTelemetry() {
    this.maxPeakLinear = 0;
    this.maxSimultaneousVoices = 0;
    this.audioEventLog.length = 0;
    this._lastShiftLoggedAt = -10;
    this._lastSquealLoggedAt = -10;
    this._lastCollisionLoggedAt = -10;
    this._lastBridgeLoggedAt = -10;
    this._lastAiPassLoggedAt = -10;
  }

  startWavCapture() {
    this.resetTelemetry();
    this._wavLeft.length = 0;
    this._wavRight.length = 0;
    this._wavCaptureStartCtxTime = this.ctx ? this.ctx.currentTime : 0;
    this._capturingWav = true;
  }

  _logEvent(entry) {
    const wavSec = (this._capturingWav && this.ctx)
      ? Math.max(0, +(this.ctx.currentTime - (this._wavCaptureStartCtxTime || 0)).toFixed(2))
      : entry.time;
    this.audioEventLog.push({ ...entry, wavSec });
  }

  stopWavCapture() {
    this._capturingWav = false;
    const sr = this.ctx ? this.ctx.sampleRate : 48000;
    const wavBytes = encodeStereoWav16(this._wavLeft, this._wavRight, sr);
    this._wavLeft.length = 0;
    this._wavRight.length = 0;
    return {
      wavBytes,
      sampleRate: sr,
      report: this.getAudioReport()
    };
  }

  getMediaStream() {
    return this.mediaStreamDest ? this.mediaStreamDest.stream : null;
  }

  // UI & Countdown SFX (Section 6: navegação, confirmação, 3-2-1, bandeirada)
  playUiSound(kind = 'nav') {
    if (!this.started || !this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const triggerTone = (freq, dur, gainVal, type = 'triangle', delay = 0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.linearRampToValueAtTime(gainVal, now + delay + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(g);
      g.connect(this.buses.ui);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    if (kind === 'nav') {
      triggerTone(580, 0.065, 0.20, 'sine');
    } else if (kind === 'confirm') {
      triggerTone(523.25, 0.09, 0.24, 'triangle', 0);
      triggerTone(783.99, 0.14, 0.26, 'triangle', 0.055);
    } else if (kind === 'countdown') {
      triggerTone(440.0, 0.18, 0.34, 'triangle');
    } else if (kind === 'go') {
      triggerTone(880.0, 0.32, 0.38, 'triangle', 0);
      triggerTone(1318.5, 0.34, 0.24, 'sine', 0.02);
    } else if (kind === 'finish') {
      triggerTone(523.25, 0.18, 0.28, 'triangle', 0.00);
      triggerTone(659.25, 0.18, 0.28, 'triangle', 0.11);
      triggerTone(783.99, 0.22, 0.30, 'triangle', 0.22);
      triggerTone(1046.50, 0.42, 0.34, 'triangle', 0.34);
    }
  }

  _playOneShotSample(bufferKey, busNode, volume = 0.5, rate = 1.0) {
    const buf = this.buffers.get(bufferKey);
    if (!buf || !this.ctx || this.paused) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1.0, volume));
    src.connect(g);
    g.connect(busNode);
    src.start();
  }

  update(vehicles, camera, simTime, dt) {
    if (!this.started || !this.ctx || !this.raceActive || !this.playerVoice || this.paused) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const player = vehicles[0];
    if (!player) return;

    // Update Web Audio 3D listener pose to active camera
    const listener = ctx.listener;
    const camPos = camera.position;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(camPos.x, now, 0.02);
      listener.positionY.setTargetAtTime(camPos.y, now, 0.02);
      listener.positionZ.setTargetAtTime(camPos.z, now, 0.02);
    } else if (listener.setPosition) {
      listener.setPosition(camPos.x, camPos.y, camPos.z);
    }

    let activeVoiceCount = 0;

    // ------------------------------------------------------------------------
    // 1. Player Multi-Band Recorded Engine Crossfade + Load/Decel + Gearshift + Limiter
    // ------------------------------------------------------------------------
    const rpm = player.rpm;
    const onThrottle = Math.max(0.18, Math.min(1.0, player.throttle * 0.85 + 0.22));
    const offThrottle = Math.max(0.0, Math.min(0.75, (1.0 - player.throttle) * (rpm > 1900 ? 0.72 : 0.15)));

    for (let b = 0; b < this.playerVoice.bands.length; b++) {
      const band = this.playerVoice.bands[b];
      const center = RPM_CENTERS[b];
      const dist = Math.abs(rpm - center) / RPM_BAND_WIDTH;
      // Smooth equal-power cosine window across adjacent RPM bands
      const rawW = dist >= 1.0 ? 0.0 : Math.cos(dist * Math.PI * 0.5);
      const gainVal = rawW * onThrottle * 0.78;
      // Pitch-track recorded loop continuously around its natural center RPM
      const baseRate = player.modelId === 'hatch' ? 1.05 : 0.96;
      const rate = Math.max(0.62, Math.min(1.52, (rpm / center) * baseRate));

      band.gain.gain.setTargetAtTime(gainVal, now, 0.025);
      band.src.playbackRate.setTargetAtTime(rate, now, 0.025);
      if (gainVal > 0.02) activeVoiceCount++;
    }

    if (this.playerVoice.decel) {
      const decelRate = Math.max(0.68, Math.min(1.48, rpm / 4200));
      this.playerVoice.decel.gain.gain.setTargetAtTime(offThrottle * 0.58, now, 0.035);
      this.playerVoice.decel.src.playbackRate.setTargetAtTime(decelRate, now, 0.03);
      if (offThrottle > 0.03) activeVoiceCount++;
    }

    // Audible Gearshift Cut + Exhaust Burble Pop & Rev Limiter Flutter (Section 6 & 13.2)
    let cutMul = 1.0;
    if (player.shiftTimer > 0.01) {
      cutMul = 0.24;
      if (simTime - this._lastShiftLoggedAt > 0.25) {
        this._lastShiftLoggedAt = simTime;
        this._logEvent({ type: 'gear_shift', time: +simTime.toFixed(2), gear: player.gear, rpm: Math.round(rpm) });
        // Subtle exhaust overrun pop on high-RPM upshift
        if (rpm > 4200) {
          this._playOneShotSample(`${this.playerVoice.modelId}_decel`, this.buses.player, 0.22, 0.74);
        }
      }
    } else if (player.atLimiter) {
      cutMul = (Math.sin(simTime * 92.0) > 0) ? 1.0 : 0.28;
    }
    this.playerVoice.cutGain.gain.setTargetAtTime(cutMul, now, 0.008);
    this.playerVoice.filter.frequency.setTargetAtTime(
      (player.modelId === 'hatch' ? 2200 : 1850) + (rpm / 7500) * 3200 * onThrottle,
      now,
      0.03
    );

    // ------------------------------------------------------------------------
    // 2. 5 Positional 3D AI Engines with Distance Attenuation & Doppler (max 5 voices!)
    // ------------------------------------------------------------------------
    for (let i = 0; i < this.aiVoices.length; i++) {
      const aiCar = vehicles[i + 1];
      const slot = this.aiVoices[i];
      if (!aiCar || !slot.lowMid) continue;

      const dx = aiCar.x - player.x;
      const dy = aiCar.y - player.y;
      const dz = aiCar.z - player.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist > 82.0) {
        // Silence distant AI voices completely (Section 6: "No máximo 5 vozes ativas; as distantes silenciam")
        slot.lowMid.gain.gain.setTargetAtTime(0.0, now, 0.05);
        if (slot.high) slot.high.gain.gain.setTargetAtTime(0.0, now, 0.05);
        slot.active = false;
        continue;
      }

      slot.active = true;
      activeVoiceCount++;

      if (slot.panner.positionX) {
        slot.panner.positionX.setTargetAtTime(aiCar.x, now, 0.025);
        slot.panner.positionY.setTargetAtTime(aiCar.y, now, 0.025);
        slot.panner.positionZ.setTargetAtTime(aiCar.z, now, 0.025);
      } else if (slot.panner.setPosition) {
        slot.panner.setPosition(aiCar.x, aiCar.y, aiCar.z);
      }

      // Gentle Doppler shift from radial relative velocity along line-of-sight
      const invD = 1.0 / Math.max(1.0, dist);
      const rvx = (aiCar.vx - player.vx) * (dx * invD) + (aiCar.vz - player.vz) * (dz * invD);
      const doppler = Math.max(0.86, Math.min(1.15, 343.0 / (343.0 + rvx * 0.75)));

      const rpmNorm = Math.max(0, Math.min(1, (aiCar.rpm - 1200) / 6000));
      const distEnv = Math.max(0, 1.0 - dist / 82.0);
      slot.lowMid.gain.gain.setTargetAtTime((1.0 - rpmNorm * 0.55) * 0.55 * distEnv, now, 0.04);
      slot.lowMid.src.playbackRate.setTargetAtTime((0.76 + rpmNorm * 0.55) * doppler, now, 0.03);
      if (slot.high) {
        slot.high.gain.gain.setTargetAtTime(rpmNorm * 0.52 * distEnv, now, 0.04);
        slot.high.src.playbackRate.setTargetAtTime((0.80 + rpmNorm * 0.48) * doppler, now, 0.03);
      }

      if (dist < 8.5 && simTime > 4.0 && simTime - this._lastAiPassLoggedAt > 3.0) {
        this._lastAiPassLoggedAt = simTime;
        this._logEvent({ type: 'ai_pass', time: +simTime.toFixed(2), ai: aiCar.name, distM: +dist.toFixed(1) });
      }
    }

    // ------------------------------------------------------------------------
    // 3. Tires, Surface Rolling (Asphalt / Curb / Sand / Grass / Bridge), Wind & Collisions
    // ------------------------------------------------------------------------
    const wv = this.worldVoices;
    if (wv) {
      // Tire squeal proportional to slip
      const squealGain = (!player.inAir && player.slipRatio > 0.10)
        ? Math.min(0.68, (player.slipRatio - 0.10) * 0.85)
        : 0.0;
      if (wv.tireSqueal) {
        wv.tireSqueal.gain.gain.setTargetAtTime(squealGain, now, 0.03);
        wv.tireSqueal.src.playbackRate.setTargetAtTime(0.88 + player.slipRatio * 0.34, now, 0.04);
        if (squealGain > 0.04) activeVoiceCount++;
      }
      if (squealGain > 0.08 && simTime - this._lastSquealLoggedAt > 2.2) {
        this._lastSquealLoggedAt = simTime;
        this._logEvent({ type: 'tire_squeal', time: +simTime.toFixed(2), slip: +player.slipRatio.toFixed(2) });
      }

      // Surface rolling (asphalt, zebra curb, sand, grass, and hollow concrete bridge resonance!)
      const spdNorm = Math.min(1.0, player.speedKmh / 185.0);
      let rollFreq = 165 + spdNorm * 140;
      let rollQ = 1.1;
      let rollGain = player.inAir ? 0.0 : spdNorm * 0.20;

      if (player.isBridge && !player.inAir) {
        // Viaduct bridge hollow concrete deck resonance + expansion-joint thump every 18m (Section 6 & 13.2!)
        rollFreq = 128 + spdNorm * 95;
        rollQ = 3.4;
        rollGain = spdNorm * 0.36;
        if (Math.abs(player.s - this._lastExpansionJointS) > 18.0 && player.speedKmh > 25) {
          this._lastExpansionJointS = player.s;
          this._playOneShotSample('crash_impact', this.buses.sfx, 0.12 * spdNorm, 1.65);
        }
        if (simTime - this._lastBridgeLoggedAt > 4.0) {
          this._lastBridgeLoggedAt = simTime;
          this._logEvent({ type: 'bridge_roll', time: +simTime.toFixed(2), s: +player.s.toFixed(1) });
        }
      } else if (player.surface === 'curb') {
        rollFreq = 95 + spdNorm * 185;
        rollQ = 4.5;
        rollGain = spdNorm * 0.42;
      } else if (player.surface === 'sand') {
        rollFreq = 780 + spdNorm * 520;
        rollQ = 0.8;
        rollGain = spdNorm * 0.44;
      } else if (player.surface === 'grass') {
        rollFreq = 420 + spdNorm * 280;
        rollQ = 1.0;
        rollGain = spdNorm * 0.34;
      }

      if (wv.surfaceRoll) {
        wv.rollFilter.frequency.setTargetAtTime(rollFreq, now, 0.03);
        wv.rollFilter.Q.setTargetAtTime(rollQ, now, 0.03);
        wv.surfaceRoll.gain.gain.setTargetAtTime(rollGain, now, 0.03);
        if (rollGain > 0.03) activeVoiceCount++;
      }

      // Aerodynamic speed wind
      if (wv.windLoop) {
        const windGain = Math.pow(spdNorm, 1.85) * 0.36;
        wv.windFilter.frequency.setTargetAtTime(360 + spdNorm * 620, now, 0.05);
        wv.windLoop.gain.gain.setTargetAtTime(windGain, now, 0.05);
        if (windGain > 0.03) activeVoiceCount++;
      }

      // Continuous guardrail scrape + discrete collision impact one-shot
      if (wv.scrapeLoop) {
        const scGain = Math.min(0.48, player.scrapeIntensity * 0.52);
        wv.scrapeLoop.gain.gain.setTargetAtTime(scGain, now, 0.025);
        if (scGain > 0.03) activeVoiceCount++;
      }
      if (player.lastCollisionTime > this._lastCollisionLoggedAt + 0.08 && simTime - player.lastCollisionTime < 0.12) {
        this._lastCollisionLoggedAt = player.lastCollisionTime;
        const force = Math.max(0.18, Math.min(1.0, player.lastCollisionForce));
        this._playOneShotSample('crash_impact', this.buses.sfx, 0.65 * force, 0.88 + (1 - force) * 0.25);
        this._logEvent({ type: 'collision', time: +simTime.toFixed(2), force: +force.toFixed(2) });
      }

      // 4. Smooth Distance-Based Zone Ambiences (Z1 Coast, Z2 Cliff Wind, Z3 Village & Bells, Z4 Forest Cicadas)
      const s = player.s;
      const L = this.world.spline.totalLength;
      const distToS = (centerS) => {
        let d = Math.abs(s - centerS);
        if (d > L * 0.5) d = L - d;
        return d;
      };
      const wZ1 = Math.max(0, 1.0 - Math.min(distToS(180), distToS(2920)) / 480);
      const wZ2 = Math.max(0, 1.0 - distToS(890) / 520);
      const wZ3 = Math.max(0, 1.0 - distToS(1685) / 480);
      const wZ4 = Math.max(0, 1.0 - distToS(2360) / 520);

      if (wv.ambZ1) wv.ambZ1.gain.gain.setTargetAtTime(0.42 * wZ1, now, 0.15);
      if (wv.ambZ2) wv.ambZ2.gain.gain.setTargetAtTime(0.32 * wZ2, now, 0.15);
      if (wv.ambZ3) wv.ambZ3.gain.gain.setTargetAtTime(0.34 * wZ3, now, 0.15);
      if (wv.ambZ4) wv.ambZ4.gain.gain.setTargetAtTime(0.36 * wZ4, now, 0.15);
      activeVoiceCount += 2; // Dominant active ambience layers

      // Occasional coastal seagull call in Z1 & distant church bell toll in Z3 near s = 1685
      if (wZ1 > 0.45 && simTime - this._lastSeagullAt > 9.5) {
        this._lastSeagullAt = simTime;
        this._playOneShotSample('seagull_call', this.buses.ambience, 0.24 * wZ1, 0.96 + (simTime % 0.12));
      }
      if (wZ3 > 0.38 && simTime - this._lastChurchBellAt > 11.0) {
        this._lastChurchBellAt = simTime;
        this._playOneShotSample('church_bell', this.buses.ambience, 0.30 * wZ3, 1.0);
      }
    }

    this.currentActiveVoices = activeVoiceCount;
    if (activeVoiceCount > this.maxSimultaneousVoices) {
      this.maxSimultaneousVoices = activeVoiceCount;
    }

    // Fallback analyser peak check in case ScriptProcessor callback hasn't fired yet
    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(this._analyserBuf);
      for (let i = 0; i < this._analyserBuf.length; i++) {
        const a = Math.abs(this._analyserBuf[i]);
        if (a > this.maxPeakLinear) this.maxPeakLinear = a;
      }
    }
  }

  // Trigger a controlled collision impact sound & telemetry event (used when car collides or in verification test)
  notifyCollision(force = 0.5, simTime = 0) {
    if (!this.started || !this.ctx) return;
    const f = Math.max(0.15, Math.min(1.0, force));
    this._playOneShotSample('crash_impact', this.buses.sfx, 0.62 * f, 0.94);
    this._logEvent({ type: 'collision', time: +simTime.toFixed(2), force: +f.toFixed(2) });
  }

  getActiveVoiceNodeCount() {
    // Exact count of allocated live race AudioNodes (returns to 0 when stopped, identical on every restart!)
    return this.raceNodes.length;
  }

  getEngineSampleAudit() {
    if (this.playerVoice) {
      const bands = this.playerVoice.bands;
      return {
        currentlyPlaying: true,
        usesAudioBuffers: bands.length >= 4 && bands.every(b => b.buffer && b.buffer.duration > 0.4),
        rpmBandCount: bands.length,
        hasDecelLayer: !!(this.playerVoice.decel && this.playerVoice.decel.buffer),
        loadedSampleCount: this.buffers.size,
        playerModelTimbre: this.playerVoice.modelId,
        bandDurationsSec: bands.map(b => +(b.buffer.duration.toFixed(3)))
      };
    }
    if (this._lastEngineAudit) {
      return {
        currentlyPlaying: false,
        ...this._lastEngineAudit,
        loadedSampleCount: this.buffers.size
      };
    }
    const prefix = (this._pendingPlayerModel === 'hatch') ? 'hatch' : 'gt';
    const preloadedBands = [1, 2, 3, 4, 5].map(k => this.buffers.get(`${prefix}_rpm${k}`)).filter(Boolean);
    return {
      currentlyPlaying: false,
      usesAudioBuffers: preloadedBands.length >= 4 && preloadedBands.every(b => b.duration > 0.4),
      rpmBandCount: preloadedBands.length,
      hasDecelLayer: !!this.buffers.get(`${prefix}_decel`),
      loadedSampleCount: this.buffers.size,
      playerModelTimbre: prefix,
      bandDurationsSec: preloadedBands.map(b => +(b.duration.toFixed(3)))
    };
  }

  getAudioReport() {
    const peakLin = Math.max(1e-5, this.maxPeakLinear);
    const maxPeakDbfs = +(20 * Math.log10(peakLin)).toFixed(2);
    return {
      started: this.started,
      sampleRate: this.ctx ? this.ctx.sampleRate : null,
      maxPeakLinear: +this.maxPeakLinear.toFixed(4),
      maxPeakDbfs,
      withinMinus1DbfsLimit: maxPeakDbfs <= -1.0,
      maxSimultaneousVoices: this.maxSimultaneousVoices,
      currentActiveVoices: this.currentActiveVoices,
      allocatedRaceNodeCount: this.raceNodes.length,
      engineSampleAudit: this.getEngineSampleAudit(),
      events: [...this.audioEventLog]
    };
  }
}
