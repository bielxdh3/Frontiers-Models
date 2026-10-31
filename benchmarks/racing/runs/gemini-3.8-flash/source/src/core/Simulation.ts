/**
 * Simulation.ts
 * Fixed-step physics simulation loop (60 Hz, dt = 1/60s).
 * Clamps large delta-times (e.g. from backgrounded tab or lag spike)
 * ensuring deterministic progression, zero ghost acceleration, and stable car dynamics.
 */

export class Simulation {
  public static readonly FIXED_DT = 1 / 60; // 60 Hz physics step
  private static readonly MAX_ACCUMULATOR = 0.2; // Max 200ms catch-up to prevent spiral of death

  private accumulator = 0;
  private lastTime = 0;
  private isRunning = false;
  private updateFn: (dt: number) => void;

  constructor(updateFn: (dt: number) => void) {
    this.updateFn = updateFn;
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  public stop(): void {
    this.isRunning = false;
  }

  public resetTime(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  public advanceFrame(currentTime: number): void {
    if (!this.isRunning) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp huge frame jumps (e.g. from tab blur/unpause)
    if (delta > Simulation.MAX_ACCUMULATOR) {
      delta = Simulation.MAX_ACCUMULATOR;
    }

    this.accumulator += delta;

    while (this.accumulator >= Simulation.FIXED_DT) {
      this.updateFn(Simulation.FIXED_DT);
      this.accumulator -= Simulation.FIXED_DT;
    }
  }
}
