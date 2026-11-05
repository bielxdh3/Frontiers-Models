// Race rules: grid, 3-2-1 start (cars held on the brakes, no jump-start gain),
// sequential checkpoint gates (a lap only counts if every gate was crossed in
// order, so cutting the track never counts), lap timing, live positions from
// progress along the spline, finish + projected ("≈") times for the AIs.
import * as THREE from 'three';
import { AIDriver } from './ai/driver.js';

export const AI_NAMES = ['R. Moreau', 'L. Castellano', 'T. Andrade', 'M. Okafor', 'S. Lindqvist'];
// per-grid-slot AI skill (slower cars start ahead, so the pack reshuffles)
const SLOT_SKILL = [0.962, 0.972, 0.99, 1.0, 1.0, 0.982];
export const PLAYER_SLOT = 3;
export const INTRO_TIME = 5.0;
export const COUNT_STEP = 1.0;

export class Race {
  constructor(game, cfg) {
    this.G = game; this.cfg = cfg; // { laps, difficulty, playerSpec, playerLivery }
    this.T = game.world.track; this.L = this.T.length;
    this.startS = this.T.features.startS;
    this.state = 'intro'; this.clock = 0; this.phaseT = 0; this.lastCount = 0;
    this.gates = game.world.checkpoints.map((c) => {
      const fr = this.T.frame(c.s, {});
      const half = c.hw + 9;
      return { s: c.s, ax: fr.x - fr.rx * half, az: fr.z - fr.rz * half, bx: fr.x + fr.rx * half, bz: fr.z + fr.rz * half, tx: fr.tx, tz: fr.tz };
    });
    // gate 0 must be the start/finish line
    this.gates.sort((a, b) => this.T.wrap(a.s - this.startS) - this.T.wrap(b.s - this.startS));
    this.gateAlong = this.gates.map((g) => this.T.wrap(g.s - this.startS));
    this.messages = []; this.events = [];
    this.cutCount = 0;
  }

  /** entrants: [{ name, spec, livery, isPlayer }] in grid order (slot 0 = pole). Cars must be set up by the game. */
  init(entrants) {
    const sim = this.G.sim;
    this.E = entrants.map((e, i) => ({ ...e, i, slot: e.slot, lapsDone: 0, next: 0, crossedStart: false, lapStart: 0, lapTimes: [], best: Infinity, finished: false, finishTime: 0, dist: 0, along: 0, raceDist: 0, invalidLap: false, cutWarn: 0 }));
    for (const e of this.E) {
      const car = sim.cars[e.i];
      if (!e.isPlayer || this.cfg.autopilot) sim.drivers[e.i] = new AIDriver(car, this.G.world, this.G.world.racingLine, { difficulty: this.cfg.difficulty, skill: e.isPlayer ? 1 : SLOT_SKILL[e.slot] || 1, seed: e.i + 1 });
      else sim.drivers[e.i] = null;
      car.allowReverse = true;
      sim.progress[e.i].raceActive = false;
    }
    this.hold(true);
  }

  gridSlot(k) {
    const s = this.T.wrap(this.startS - 14 - k * this.T.features.gridSpacing);
    return { s, d: k % 2 ? 2.7 : -2.7 };
  }

  hold(on) {
    for (const c of this.G.sim.cars) { c.held = on; }
  }

  // ---------------------------------------------------------------- per frame (wall-clock phases)
  update(dt) {
    if (this.state === 'intro') {
      this.phaseT += dt;
      if (this.phaseT >= INTRO_TIME) { this.state = 'countdown'; this.phaseT = 0; this.lastCount = 0; }
    }
    if (this.state === 'countdown') {
      this.phaseT += dt;
      const n = Math.floor(this.phaseT / COUNT_STEP) + 1; // 1..3 then go
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n <= 3) { this.G.audio.ui('count'); this.G.setStartLights(n === 1 ? 2 : n === 2 ? 4 : 5, 'red'); }
        else { this.go(); }
      }
    }
    for (const m of this.messages) m.t -= dt;
    this.messages = this.messages.filter((m) => m.t > 0);
  }
  countdownValue() { return this.state === 'countdown' ? Math.max(1, 3 - Math.floor(this.phaseT / COUNT_STEP)) : 0; }

  go() {
    this.state = 'running'; this.clock = 0; this.phaseT = 0;
    this.G.audio.ui('go'); this.G.setStartLights(5, 'green');
    setTimeout(() => this.G.setStartLights(0), 2500);
    const sim = this.G.sim;
    for (const e of this.E) {
      const car = sim.cars[e.i];
      // same launch state for everybody: revving on the grid gives no advantage
      car.rpm = Math.min(car.rpm, car.spec.idleRpm + 1800); car.gear = 1; car.shiftTimer = 0;
      sim.progress[e.i].raceActive = true; e.lapStart = 0;
    }
    this.hold(false);
    this.say('VAI!', 1.2, 'go');
    this.events.push({ t: 0, type: 'start' });
  }

  say(text, t = 2, kind = '') { this.messages.push({ text, t, kind }); }

  // ---------------------------------------------------------------- per physics step
  step(dt) {
    if (this.state !== 'running' && this.state !== 'finished') return;
    this.clock += dt;
    const sim = this.G.sim, T = this.T, total = this.gates.length;
    for (const e of this.E) {
      const pr = sim.progress[e.i];
      const prev = e.lastS ?? pr.s, cur = pr.s;
      e.lastS = cur;
      const dlt = T.delta(prev, cur);
      // gates are passed along the progress projection (continuous, so running wide still counts);
      // a discontinuous jump forward (shortcut / teleport) credits no gate at all
      if (!e.finished && dlt > 0 && dlt < 30 && Math.abs(pr.d || 0) < (pr.hw || 5) + 25) {
        const k = e.next % total;
        const g = this.gates[k];
        if (T.delta(prev, g.s) > 0 && T.delta(g.s, cur) >= 0) this._passGate(e, k);
        else if (e.crossedStart && e.next >= 2 && e.next < total && T.delta(prev, this.gates[0].s) > 0 && T.delta(this.gates[0].s, cur) >= 0) this._cut(e);
      }
      // race distance for positions (capped at the next required gate: no gain from cutting)
      let along = T.wrap(cur - this.startS);
      if (!e.crossedStart) along = along > this.L / 2 ? along - this.L : along;
      const cap = e.crossedStart ? (e.next < total ? this.gateAlong[e.next] + 25 : this.L + 25) : 30;
      if (along > cap) along = cap;
      e.along = along;
      e.raceDist = e.lapsDone * this.L + along;
      if (!e.finished) e.dist = e.raceDist;
    }
  }

  _passGate(e, k) {
    const total = this.gates.length;
    if (k === 0) {
      if (!e.crossedStart) { e.crossedStart = true; e.next = 1; return; }
      if (e.next === total || e.next === 0) {
        // lap complete
        const lt = this.clock - e.lapStart;
        e.lapTimes.push(lt); e.lapStart = this.clock; e.lapsDone++; e.next = 1;
        if (lt < e.best) e.best = lt;
        this.events.push({ t: this.clock, type: 'lap', car: e.i, lap: e.lapsDone, time: lt });
        if (e.isPlayer) {
          if (e.lapsDone < this.cfg.laps) { this.G.audio.ui('lap'); this.say(e.lapsDone === this.cfg.laps - 1 ? 'VOLTA FINAL' : `VOLTA ${e.lapsDone + 1}`, 2.2); }
        }
        if (e.lapsDone >= this.cfg.laps && !e.finished) this._finish(e);
        return;
      }
      return;
    }
    e.next = k + 1;
    if (e.next > total) e.next = total;
  }

  _cut(e) {
    this.cutCount++;
    this.events.push({ t: this.clock, type: 'cut', car: e.i, missing: e.next });
    if (e.isPlayer) this.say('CORTE — VOLTA NÃO CONTA', 2.5, 'warn');
    // the lap restarts from scratch at the line: all gates have to be crossed again
    e.next = 1; e.lapStart = this.clock; e.invalidLap = true;
  }

  _finish(e) {
    e.finished = true; e.finishTime = this.clock;
    this.events.push({ t: this.clock, type: 'finish', car: e.i, time: this.clock });
    if (e.isPlayer) {
      this.state = 'finished'; this.finishClock = this.clock;
      this.G.audio.ui('finish');
      this.say('BANDEIRADA!', 3, 'go');
      // player car continues on autopilot through the cool-down lap
      const sim = this.G.sim;
      if (!sim.drivers[e.i]) sim.drivers[e.i] = new AIDriver(sim.cars[e.i], this.G.world, this.G.world.racingLine, { difficulty: 'facil', seed: 99 });
      if (this.G.onPlayerFinished) this.G.onPlayerFinished();
    }
  }

  // ---------------------------------------------------------------- standings
  /** live order; cached per simulation clock value (called by the HUD every frame and the monitor every step) */
  standings() {
    if (this._stClock === this.clock && this._st) return this._st;
    const arr = this._stArr || (this._stArr = [...this.E]);
    arr.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1;
      return b.dist - a.dist;
    });
    this._st = arr; this._stClock = this.clock;
    return arr;
  }
  position(i) { const st = this.standings(); for (let k = 0; k < st.length; k++) if (st[k].i === i) return k + 1; return 0; }

  /** results table; unfinished cars get a projected time from their average speed so far */
  results() {
    const total = this.cfg.laps * this.L;
    const rows = this.standings().map((e) => {
      let time = e.finishTime, projected = false;
      if (!e.finished) {
        const covered = Math.max(1, e.dist + (this.gridOffset(e) || 0));
        const avg = covered / Math.max(1, this.clock);
        time = this.clock + Math.max(0, total - e.dist) / Math.max(5, avg);
        projected = true;
      }
      return { i: e.i, name: e.name, car: e.spec.name, livery: e.livery, isPlayer: e.isPlayer, time, projected, best: e.best, laps: e.lapsDone };
    });
    // projected rows must never claim a better time than a car that actually finished ahead of them
    rows.sort((a, b) => a.time - b.time);
    return rows;
  }
  gridOffset(e) { return 14 + e.slot * this.T.features.gridSpacing; }
}

export { THREE };
