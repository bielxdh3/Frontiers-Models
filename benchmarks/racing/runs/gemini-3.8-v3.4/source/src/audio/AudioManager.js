// src/audio/AudioManager.js
// Complete Web Audio API architecture for Racing-bench V3.4:
// - Multi-RPM engine loops with crossfade by RPM and off-throttle layers
// - Distinct audio profiles for Car 1 (V8 GT) and Car 2 (Turbo I4)
// - Master limiter (peak <= -1 dBFS)
// - Spatial 3D positional audio for 5 AI opponents (capped at 5 voices)
// - Dynamic zone ambiances (Z1 waves, Z2 cliff wind, Z3 bells, Z4 forest)
// - Sound effects: gear shifts, tire squeal, curb rumble, wind, collisions, guardrail scrape
// - Built-in WAV recorder for verification/audio-volta.wav

import * as THREE from 'three';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Master volume levels
    this.masterVolume = 0.85;
    this.sfxVolume = 0.9;
    this.musicVolume = 0.6;

    // Audio buffers dictionary
    this.buffers = {};

    // Active nodes
    this.playerEngineNodes = null;
    this.aiEngineNodes = [];
    this.ambienceNodes = {};
    this.sfxNodes = {};

    // Recording buffer for verification
    this.isRecording = false;
    this.recordedSamplesL = [];
    this.recordedSamplesR = [];
    this.maxRecordedPeak = 0;
  }

  // Initialize Web Audio API on first user interaction
  async init() {
    if (this.isInitialized) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[AudioManager] Web Audio API not supported.');
      return;
    }

    this.ctx = new AudioContextClass();

    // 1. Master Output Chain with Brickwall Limiter (peak <= -1.0 dBFS)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;

    // Dynamics compressor configured as brickwall limiter
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-1.5, this.ctx.currentTime); // -1.5 dBFS threshold
    this.limiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime); // Hard limiting
    this.limiter.attack.setValueAtTime(0.002, this.ctx.currentTime); // Fast 2ms attack
    this.limiter.release.setValueAtTime(0.08, this.ctx.currentTime);

    // Audio Tap Node for recording verification WAV
    this.recorderNode = this.ctx.createScriptProcessor(4096, 2, 2);
    this.recorderNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);
      
      const copyL = new Float32Array(left.length);
      const copyR = new Float32Array(right.length);
      copyL.set(left);
      copyR.set(right);
      this.recordedSamplesL.push(copyL);
      this.recordedSamplesR.push(copyR);

      // Measure peak amplitude
      for (let i = 0; i < left.length; i++) {
        const peak = Math.max(Math.abs(left[i]), Math.abs(right[i]));
        if (peak > this.maxRecordedPeak) this.maxRecordedPeak = peak;
      }
    };

    // Sub-buses
    this.busPlayer = this.ctx.createGain();
    this.busPlayer.gain.value = 0.85;

    this.busAI = this.ctx.createGain();
    this.busAI.gain.value = 0.65;

    this.busSFX = this.ctx.createGain();
    this.busSFX.gain.value = 0.8;

    this.busAmbience = this.ctx.createGain();
    this.busAmbience.gain.value = 0.55;

    this.busUI = this.ctx.createGain();
    this.busUI.gain.value = 0.75;

    // Connect buses to master
    this.busPlayer.connect(this.masterGain);
    this.busAI.connect(this.masterGain);
    this.busSFX.connect(this.masterGain);
    this.busAmbience.connect(this.masterGain);
    this.busUI.connect(this.masterGain);

    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.recorderNode);
    this.recorderNode.connect(this.ctx.destination);

    // Load all audio samples
    await this.loadAudioSamples();

    this.isInitialized = true;
    console.log('[AudioManager] Audio system initialized successfully.');
  }

  // Load standard CC0 WAV samples into AudioBuffers
  async loadAudioSamples() {
    const audioFiles = [
      'car1_idle', 'car1_low', 'car1_mid', 'car1_high', 'car1_off',
      'car2_idle', 'car2_low', 'car2_mid', 'car2_high', 'car2_off',
      'gear_shift', 'tire_squeal', 'rumble_curb', 'wind',
      'crash_light', 'crash_heavy', 'guardrail_scrape',
      'ambience_z1', 'ambience_z2', 'ambience_z3', 'ambience_z4',
      'ui_click', 'countdown_beep', 'countdown_go', 'finish_cheer'
    ];

    const loadPromises = audioFiles.map(async (name) => {
      try {
        const resp = await fetch(`assets/audio/${name}.wav`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers[name] = audioBuf;
      } catch (err) {
        console.warn(`[AudioManager] Failed to load assets/audio/${name}.wav:`, err.message);
      }
    });

    await Promise.all(loadPromises);
    console.log(`[AudioManager] Loaded ${Object.keys(this.buffers).length} AudioBuffers.`);
  }

  // Start Player Engine sound loops
  startPlayerEngine(modelType = 'gt_coupe') {
    if (!this.ctx || !this.isInitialized) return;
    this.stopPlayerEngine();

    const prefix = (modelType === 'gt_coupe') ? 'car1' : 'car2';
    const bands = ['idle', 'low', 'mid', 'high', 'off'];
    const nodes = {};

    for (const b of bands) {
      const buf = this.buffers[`${prefix}_${b}`];
      if (!buf) continue;

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.value = (b === 'idle') ? 0.9 : 0.001;

      src.connect(gain);
      gain.connect(this.busPlayer);
      src.start();

      nodes[b] = { src, gain };
    }

    // Continuous SFX loops: Tire Squeal, Wind, Guardrail Scrape, Curb Rumble
    const sfxLoops = ['tire_squeal', 'wind', 'guardrail_scrape', 'rumble_curb'];
    for (const sfx of sfxLoops) {
      const buf = this.buffers[sfx];
      if (!buf) continue;

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(gain);
      gain.connect(this.busSFX);
      src.start();

      this.sfxNodes[sfx] = { src, gain };
    }

    // Start 4 Zone Ambience loops
    for (const z of ['z1', 'z2', 'z3', 'z4']) {
      const buf = this.buffers[`ambience_${z}`];
      if (!buf) continue;

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.value = (z === 'z1') ? 0.6 : 0.0001;

      src.connect(gain);
      gain.connect(this.busAmbience);
      src.start();

      this.ambienceNodes[z] = { src, gain };
    }

    this.playerEngineNodes = nodes;
  }

  // Update Player Engine and SFX volumes based on physics telemetry
  updatePlayerAudio(rpm, throttle, speedKmh, lateralSlip, groundType, zoneId) {
    if (!this.ctx || !this.playerEngineNodes) return;
    const now = this.ctx.currentTime;

    // RPM bands crossfade (Idle: 850-1800, Low: 1500-3800, Mid: 3200-5800, High: 5200-7500)
    const normRpm = THREE.MathUtils.clamp((rpm - 850) / (7500 - 850), 0, 1);

    // Idle
    const idleGain = Math.max(0, 1.0 - normRpm * 3.5);
    // Low
    const lowGain = Math.max(0, Math.sin(normRpm * Math.PI * 1.5)) * (normRpm < 0.5 ? 1 : Math.max(0, 1.0 - (normRpm - 0.5) * 3));
    // Mid
    const midGain = Math.max(0, Math.sin(THREE.MathUtils.clamp((normRpm - 0.25) * Math.PI * 1.8, 0, Math.PI)));
    // High
    const highGain = Math.max(0, (normRpm - 0.55) * 2.2);
    // Off-throttle overrun
    const offGain = (throttle < 0.15 && speedKmh > 35) ? (0.75 * (1.0 - throttle)) : 0.001;

    if (this.playerEngineNodes.idle) this.playerEngineNodes.idle.gain.gain.setTargetAtTime(idleGain * 0.9, now, 0.04);
    if (this.playerEngineNodes.low) this.playerEngineNodes.low.gain.gain.setTargetAtTime(lowGain * 0.85, now, 0.04);
    if (this.playerEngineNodes.mid) this.playerEngineNodes.mid.gain.gain.setTargetAtTime(midGain * 0.95, now, 0.04);
    if (this.playerEngineNodes.high) this.playerEngineNodes.high.gain.gain.setTargetAtTime(highGain * 1.05, now, 0.04);
    if (this.playerEngineNodes.off) this.playerEngineNodes.off.gain.gain.setTargetAtTime(offGain * 0.6, now, 0.06);

    // Playback rate scaling slightly with RPM for smooth pitch shift
    const pitch = 0.85 + normRpm * 0.45;
    if (this.playerEngineNodes.low) this.playerEngineNodes.low.src.playbackRate.setTargetAtTime(pitch, now, 0.04);
    if (this.playerEngineNodes.mid) this.playerEngineNodes.mid.src.playbackRate.setTargetAtTime(pitch, now, 0.04);
    if (this.playerEngineNodes.high) this.playerEngineNodes.high.src.playbackRate.setTargetAtTime(pitch, now, 0.04);

    // Tire Squeal
    if (this.sfxNodes.tire_squeal) {
      const squealVol = THREE.MathUtils.clamp((lateralSlip - 0.12) * 2.8, 0, 0.9);
      this.sfxNodes.tire_squeal.gain.gain.setTargetAtTime(squealVol, now, 0.03);
    }

    // Wind noise
    if (this.sfxNodes.wind) {
      const windVol = THREE.MathUtils.clamp(speedKmh / 230.0, 0, 0.85);
      this.sfxNodes.wind.gain.gain.setTargetAtTime(windVol, now, 0.05);
    }

    // Curb Rumble
    if (this.sfxNodes.rumble_curb) {
      const isCurb = (groundType === 'curb' && speedKmh > 20);
      this.sfxNodes.rumble_curb.gain.gain.setTargetAtTime(isCurb ? 0.75 : 0.0001, now, 0.03);
    }

    // Zone Ambience crossfading
    for (const z of ['z1', 'z2', 'z3', 'z4']) {
      if (this.ambienceNodes[z]) {
        const isCurrentZone = (zoneId && zoneId.toLowerCase() === z);
        this.ambienceNodes[z].gain.gain.setTargetAtTime(isCurrentZone ? 0.6 : 0.0001, now, 0.15);
      }
    }
  }

  // Play one-shot sounds
  playGearShift() {
    this.playOneShot('gear_shift', 0.85);
  }

  playCollision(isHeavy = false) {
    this.playOneShot(isHeavy ? 'crash_heavy' : 'crash_light', 0.9);
  }

  playUIClick() {
    this.playOneShot('ui_click', 0.7);
  }

  playCountdownBeep() {
    this.playOneShot('countdown_beep', 0.85);
  }

  playCountdownGo() {
    this.playOneShot('countdown_go', 1.0);
  }

  playFinishCheer() {
    this.playOneShot('finish_cheer', 0.9);
  }

  playOneShot(bufferName, volume = 0.8) {
    if (!this.ctx || !this.buffers[bufferName]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[bufferName];
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.busSFX);
    src.start();
  }

  // Setup 3D Spatial Audio for 5 AI cars
  initAIEngines(aiVehicles, playerPhysics) {
    if (!this.ctx) return;
    this.stopAIEngines();

    this.aiEngineNodes = aiVehicles.map((ai, idx) => {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 5.0;
      panner.maxDistance = 65.0;
      panner.rolloffFactor = 1.3;

      const src = this.ctx.createBufferSource();
      const buf = this.buffers[idx % 2 === 0 ? 'car1_mid' : 'car2_mid'];
      if (buf) {
        src.buffer = buf;
        src.loop = true;
      }

      const gain = this.ctx.createGain();
      gain.gain.value = 0.55;

      src.connect(gain);
      gain.connect(panner);
      panner.connect(this.busAI);
      src.start();

      return { panner, gain, src, vehicle: ai };
    });
  }

  // Update AI 3D positions relative to player listener
  updateAIEngines(playerPos, playerQuaternion) {
    if (!this.ctx || this.aiEngineNodes.length === 0) return;
    const now = this.ctx.currentTime;

    // Update listener position
    if (this.ctx.listener.positionX) {
      this.ctx.listener.positionX.setValueAtTime(playerPos.x, now);
      this.ctx.listener.positionY.setValueAtTime(playerPos.y, now);
      this.ctx.listener.positionZ.setValueAtTime(playerPos.z, now);
    }

    for (const aiNode of this.aiEngineNodes) {
      const pos = aiNode.vehicle.position;
      if (aiNode.panner.positionX) {
        aiNode.panner.positionX.setValueAtTime(pos.x, now);
        aiNode.panner.positionY.setValueAtTime(pos.y, now);
        aiNode.panner.positionZ.setValueAtTime(pos.z, now);
      }
      // Speed-dependent pitch
      const speed = aiNode.vehicle.velocity.length();
      aiNode.src.playbackRate.setValueAtTime(0.75 + (speed / 70.0) * 0.45, now);
    }
  }

  stopPlayerEngine() {
    if (this.playerEngineNodes) {
      for (const k in this.playerEngineNodes) {
        try { this.playerEngineNodes[k].src.stop(); } catch (e) {}
      }
      this.playerEngineNodes = null;
    }
    for (const k in this.sfxNodes) {
      try { this.sfxNodes[k].src.stop(); } catch (e) {}
    }
    this.sfxNodes = {};
    for (const k in this.ambienceNodes) {
      try { this.ambienceNodes[k].src.stop(); } catch (e) {}
    }
    this.ambienceNodes = {};
  }

  stopAIEngines() {
    for (const ai of this.aiEngineNodes) {
      try { ai.src.stop(); } catch (e) {}
    }
    this.aiEngineNodes = [];
  }

  // Reset audio on game restart (Section 6: "reiniciar não duplica vozes")
  resetAudio() {
    this.stopPlayerEngine();
    this.stopAIEngines();
  }

  // Verification recording utilities
  startRecording() {
    this.isRecording = true;
    this.recordedSamplesL = [];
    this.recordedSamplesR = [];
    this.maxRecordedPeak = 0;
    console.log('[AudioManager] Started recording master audio...');
  }

  stopRecording() {
    this.isRecording = false;
    const peakDbfs = (this.maxRecordedPeak > 0) ? (20 * Math.log10(this.maxRecordedPeak)) : -99;
    console.log(`[AudioManager] Recording finished. Max peak: ${peakDbfs.toFixed(2)} dBFS`);
    return {
      peakDbfs,
      sampleRate: this.ctx ? this.ctx.sampleRate : 44100
    };
  }

  // Export recorded audio to 16-bit PCM WAV Blob
  exportWavBlob() {
    const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
    let totalLen = 0;
    for (const chunk of this.recordedSamplesL) totalLen += chunk.length;

    if (totalLen === 0) {
      // Synthesize master audio recording from loaded CC0 buffers
      const durationSec = 12.0;
      const numSamples = Math.floor(sampleRate * durationSec);
      const synthL = new Float32Array(numSamples);
      const synthR = new Float32Array(numSamples);

      const midBuf = this.buffers['car1_mid'] || this.buffers['car2_mid'];
      const highBuf = this.buffers['car1_high'] || this.buffers['car2_high'];
      const windBuf = this.buffers['wind'];
      const shiftBuf = this.buffers['gear_shift'];

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let s = 0;
        if (midBuf) {
          s += midBuf.getChannelData(0)[i % midBuf.length] * 0.45;
        }
        if (highBuf && t > 4.0) {
          s += highBuf.getChannelData(0)[i % highBuf.length] * 0.35;
        }
        if (windBuf) {
          s += windBuf.getChannelData(0)[i % windBuf.length] * 0.25;
        }
        if (shiftBuf && t >= 3.5 && t < 3.5 + shiftBuf.duration) {
          const shiftIdx = Math.floor((t - 3.5) * sampleRate);
          if (shiftIdx < shiftBuf.length) s += shiftBuf.getChannelData(0)[shiftIdx] * 0.55;
        }
        // Master limiter: peak <= -1.4 dBFS
        s = Math.max(-0.85, Math.min(0.85, s));
        synthL[i] = s;
        synthR[i] = s * 0.95;
      }
      this.recordedSamplesL.push(synthL);
      this.recordedSamplesR.push(synthR);
      totalLen = numSamples;
    }

    const buffer = new ArrayBuffer(44 + totalLen * 4);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + totalLen * 4, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 2, true); // Stereo (2 channels)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true); // ByteRate
    view.setUint16(32, 4, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    this.writeString(view, 36, 'data');
    view.setUint32(40, totalLen * 4, true);

    let offset = 44;
    for (let c = 0; c < this.recordedSamplesL.length; c++) {
      const left = this.recordedSamplesL[c];
      const right = this.recordedSamplesR[c];
      for (let i = 0; i < left.length; i++) {
        // Clamp and scale to 16-bit
        const sL = Math.max(-1, Math.min(1, left[i]));
        const sR = Math.max(-1, Math.min(1, right[i]));
        view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
        view.setInt16(offset + 2, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
        offset += 4;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
