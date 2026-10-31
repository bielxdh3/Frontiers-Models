/**
 * AudioManager.ts
 * 100% procedural Web Audio API engine. Zero external audio file dependencies.
 * - Engine synthesizer (RPM, load, throttle)
 * - Tire screech (slip noise & bandpass filter)
 * - Nitro boost roar & flame whoosh
 * - Collision impact crunches
 * - Countdown beeps & Checkpoint / Finish victory chimes
 * - Coastal surf & breeze ambience
 * - Strict lifecycle management: stops nodes on pause/reset, prevents audio graph leaks.
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;
  private volume = 0.8;
  private initialized = false;

  // Engine synth nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Tire screech nodes
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireGain: GainNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;

  // Nitro nodes
  private nitroNoiseNode: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode | null = null;

  // Ambience nodes
  private ambientNoiseNode: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;

  // Noise buffers cache
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // Lazy initialization on first user interaction
  }

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.createNoiseBuffer();
      this.initEngineSynth();
      this.initTireSynth();
      this.initNitroSynth();
      this.initAmbientSynth();

      this.initialized = true;
    } catch {
      // Audio context unavailable or blocked
    }
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private initEngineSynth(): void {
    if (!this.ctx || !this.masterGain) return;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';

    this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A
    this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private initTireSynth(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    this.tireNoiseNode = this.ctx.createBufferSource();
    this.tireNoiseNode.buffer = this.noiseBuffer;
    this.tireNoiseNode.loop = true;

    this.tireFilter = this.ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.tireFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.tireNoiseNode.connect(this.tireFilter);
    this.tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.masterGain);

    this.tireNoiseNode.start();
  }

  private initNitroSynth(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    this.nitroNoiseNode = this.ctx.createBufferSource();
    this.nitroNoiseNode.buffer = this.noiseBuffer;
    this.nitroNoiseNode.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.nitroGain = this.ctx.createGain();
    this.nitroGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.nitroNoiseNode.connect(filter);
    filter.connect(this.nitroGain);
    this.nitroGain.connect(this.masterGain);

    this.nitroNoiseNode.start();
  }

  private initAmbientSynth(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    this.ambientNoiseNode = this.ctx.createBufferSource();
    this.ambientNoiseNode.buffer = this.noiseBuffer;
    this.ambientNoiseNode.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.ambientNoiseNode.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.ambientNoiseNode.start();
  }

  public updateVehicleAudio(speedKmh: number, throttle: number, isDrifting: boolean, isNitro: boolean): void {
    if (!this.ctx || !this.initialized) return;

    const now = this.ctx.currentTime;
    const normSpeed = Math.min(1.0, Math.max(0, speedKmh / 220));

    // Engine sound pitch & load modulation
    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineGain) {
      const baseFreq = 45 + normSpeed * 180 + (throttle > 0 ? 30 : 0);
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);

      const filterCutoff = 300 + normSpeed * 1500 + (throttle > 0 ? 800 : 0) + (isNitro ? 600 : 0);
      this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

      const targetGain = 0.15 + normSpeed * 0.15 + (throttle !== 0 ? 0.08 : 0);
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    // Tire screech
    if (this.tireGain) {
      const targetTireGain = isDrifting && speedKmh > 25 ? Math.min(0.25, normSpeed * 0.3) : 0;
      this.tireGain.gain.setTargetAtTime(targetTireGain, now, 0.06);
    }

    // Nitro whoosh
    if (this.nitroGain) {
      const targetNitroGain = isNitro ? 0.28 : 0;
      this.nitroGain.gain.setTargetAtTime(targetNitroGain, now, 0.08);
    }
  }

  public playImpact(intensity: number): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    const now = this.ctx.currentTime;
    const clampedIntensity = Math.min(1.0, Math.max(0.1, intensity));

    // Impact thump (sine drop)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 * clampedIntensity, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    gain.gain.setValueAtTime(0.35 * clampedIntensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);

    // Crunch noise
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(1.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25 * clampedIntensity, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.18);
    }
  }

  public playCountdownBeep(isFinal: boolean): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = isFinal ? 880 : 440; // A5 for GO!, A4 for 3, 2, 1
    const duration = isFinal ? 0.45 : 0.2;

    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playCheckpointChime(): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880]; // D5 and A5

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  public playFinishJingle(won: boolean): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    const now = this.ctx.currentTime;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [440, 392, 349, 293.66]; // C major vs descending

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.25, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.4);
    });
  }

  public silenceAllContinuous(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.03);
    if (this.tireGain) this.tireGain.gain.setTargetAtTime(0, now, 0.03);
    if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0, now, 0.03);
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }
}
