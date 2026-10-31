export class Soundscape {
  constructor() { this.ready = false; this.failed = false; this.lastEvent = 0; this.countBeat = 0; this.voices = new Set(); }
  async activate() {
    if (this.failed) return false;
    try {
      if (!this.context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return false;
        this.context = new Audio(); this.master = this.context.createGain(); this.master.connect(this.context.destination);
        this.engine = this.context.createGain(); this.engine.gain.value = 0;
        this.filter = this.context.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 550;
        this.engine.connect(this.filter); this.filter.connect(this.master);
        this.oscillators = [this.context.createOscillator(), this.context.createOscillator()];
        this.oscillators.forEach((o, i) => { o.type = i ? 'triangle' : 'sawtooth'; o.frequency.value = i ? 68 : 34; o.connect(this.engine); o.start(); });
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate), data = buffer.getChannelData(0);
        let seed = 17; for (let i = 0; i < data.length; i++) { seed = Math.imul(seed, 16807) >>> 0; data[i] = (seed / 4294967296) * 2 - 1; }
        this.noise = this.context.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
        this.noiseGain = this.context.createGain(); this.noiseGain.gain.value = 0;
        this.noiseFilter = this.context.createBiquadFilter(); this.noiseFilter.type = 'bandpass'; this.noiseFilter.frequency.value = 1800;
        this.noise.connect(this.noiseFilter); this.noiseFilter.connect(this.noiseGain); this.noiseGain.connect(this.master); this.noise.start();
      }
      await this.context.resume(); this.ready = this.context.state === 'running'; return this.ready;
    } catch { this.failed = true; return false; }
  }
  tone(type) {
    if (!this.ready) return;
    const frequencies = { countdown: [420, 420], go: [660, 990], gate: [620, 920], lap: [720, 1080], collision: [90, 35], recover: [220, 440], finish: [660, 1320] }[type] || [450, 600];
    const now = this.context.currentTime, oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type === 'collision' ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(frequencies[0], now); oscillator.frequency.exponentialRampToValueAtTime(frequencies[1], now + .17);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(type === 'collision' ? .24 : .13, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + .27);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(now); oscillator.stop(now + .30);
    const voice = { oscillator, gain }; this.voices.add(voice);
    oscillator.onended = () => { gain.disconnect(); oscillator.disconnect(); this.voices.delete(voice); };
  }
  update(car, active, prefs) {
    if (!this.ready) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, now, .03);
    const speed = Math.abs(car?.speed || 0), gear = Math.floor(speed / 13), rpm = 34 + (speed % 13) * 4.5 + gear * 6 + (car?.boosting ? 15 : 0);
    this.oscillators[0].frequency.setTargetAtTime(rpm, now, .06); this.oscillators[1].frequency.setTargetAtTime(rpm * 2.01, now, .06);
    this.engine.gain.setTargetAtTime(active ? .055 + Math.min(speed, 65) * .0007 : 0, now, .04);
    this.filter.frequency.setTargetAtTime(300 + speed * 15, now, .06);
    this.noiseGain.gain.setTargetAtTime(active ? (car?.drifting ? .10 : .005 + speed * .0002) : 0, now, .03);
  }
  silence() {
    if (!this.context) return;
    this.engine.gain.setTargetAtTime(0, this.context.currentTime, .015); this.noiseGain.gain.setTargetAtTime(0, this.context.currentTime, .015);
    for (const voice of this.voices) { voice.gain.gain.cancelScheduledValues(this.context.currentTime); voice.gain.gain.setValueAtTime(0, this.context.currentTime); try { voice.oscillator.stop(); } catch {} }
  }
}
