import { Language } from '../types/solarSystem';

/**
 * Optional, user-activated Web Audio & Speech Synthesis controller (Section 42).
 * Never autoplays on page load; describes ambient sound as artistic atmosphere and
 * maps orbital periods to pitch only as an explicitly labeled educational sonification.
 */
class ObservatoryAudioController {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private isAmbientRunning = false;

  public isWebAudioSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
    );
  }

  public isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private ensureContext(): AudioContext | null {
    if (!this.isWebAudioSupported()) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setAmbientEnabled(enabled: boolean): boolean {
    if (!enabled) {
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
      }
      this.isAmbientRunning = false;
      return false;
    }

    const ctx = this.ensureContext();
    if (!ctx) return false;

    if (!this.ambientOsc1) {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 110; // A2 warm drone

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 164.81; // E3 fifth

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);

      osc1.start();
      osc2.start();

      this.ambientGain = gain;
      this.ambientOsc1 = osc1;
      this.ambientOsc2 = osc2;
    }

    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.4);
    }
    this.isAmbientRunning = true;
    return true;
  }

  public playUiFeedback(type: 'select' | 'step' | 'capture', enabled: boolean): void {
    if (!enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;

    if (type === 'select') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.07);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.11);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    } else {
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Educational orbital period sonification: maps orbital period (days) onto an audible pitch (Hz)
   * using f = 220 * (365.25 / periodDays)^0.32 clamped between 90 Hz and 880 Hz.
   */
  public playOrbitalSonification(periodDays: number): number | null {
    const ctx = this.ensureContext();
    if (!ctx || !Number.isFinite(periodDays) || periodDays <= 0) return null;

    const freq = Math.max(90, Math.min(880, 261.63 * Math.pow(365.25 / periodDays, 0.32)));
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.78);
    return Math.round(freq);
  }

  public speakTourStop(text: string, lang: Language, enabled: boolean): boolean {
    this.stopSpeech();
    if (!enabled || !this.isSpeechSupported()) return false;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  public stopSpeech(): void {
    if (this.isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech cancellation errors
      }
    }
  }
}

export const audioController = new ObservatoryAudioController();
