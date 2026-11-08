// Race rules: grid, countdown, checkpoints in sequence (shortcuts do not count), laps, live positions by track progress,
// finish with projected times for the rest ("≈"), automatic resets (logged), integrity counters.
import { GRID, RULES } from './config.js';
import { Driver } from '../ai/driver.js';

export class RaceCar {
  constructor(id, vehicle, { name, isPlayer = false, driver = null, livery = 0, carId = 'gt', model = null }) {
    this.id = id; this.v = vehicle; this.name = name; this.isPlayer = isPlayer; this.driver = driver; this.livery = livery; this.carId = carId; this.model = model;
    this.reset0();
  }
  reset0() {
    this.sTrack = 0; this.sPrev = 0; this.hint = -1; this.lat = 0; this.lost = false;
    this.startCrossed = false; this.lapsDone = 0; this.cpNext = 1; this.cpLastS = 0;
    this.lapStartT = 0; this.lapTimes = []; this.bestLap = Infinity; this.currentLapTime = 0;
    this.distance = 0; this.finished = false; this.finishTime = 0; this.resets = 0;
    this.offTime = 0; this.stuckTime = 0; this.flipTime = 0; this.lostTime = 0; this.position = 0;
    this.onRoad = true; this.maxSpeed = 0; this.lastPassS = 0; this.projected = 0; this.avgSpeed = 0;
    this.stuckAi = 0;
  }
}

export class Race {
  /**
   * @param {object} world  @param {object} opts {laps, difficulty}
   */
  constructor(world, opts = {}) {
    this.world = world; this.T = world.track;
    this.laps = opts.laps || 3; this.difficulty = opts.difficulty || 'normal';
    this.cars = []; this.player = null;
    this.state = 'grid';            // grid | countdown | racing | finished
    this.t = 0; this.count = 0;     // race clock since GO; countdown value (3,2,1,0)
    this.countT = 0;
    this.events = [];               // log: resets, finishes, laps
    this.log = [];                  // integrity log (under-terrain, collider crossing, camera) used by tests
    this.nCp = this.T.checkpoints.length;
    this.cpS = this.T.checkpoints.slice();
    this.playerFinishedAt = -1;
    this.stats = { underTerrain: 0, aiStuck: 0, overtakesAI: 0, maxVoices: 0, wallHits: 0, colliderCross: 0, maxWallPen: 0, maxAirborne: 0, fellOut: 0 };
    this._tq = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
    this.prevOrderAI = null;
  }

  addCar(rc) { this.cars.push(rc); if (rc.isPlayer) this.player = rc; return rc; }

  /** grid slot k (0 = pole): returns {x,z,yaw,i} */
  slot(k) {
    const T = this.T, row = k >> 1, col = k & 1;
    const d = GRID.rowStart + row * GRID.rowSpacing + GRID.carOffset;
    const s = T.length - d;
    const i = T.indexAtS(s);
    const lat = (col === 0 ? -1 : 1) * GRID.laneOffset;
    const p = T.roadPoint(i, lat, 0);
    return { x: p.x, z: p.z, yaw: T.heading[i], i, s, lat };
  }

  placeOnGrid() {
    this.cars.forEach((c, k) => {
      const sl = this.slot(c.gridSlot ?? k);
      c.v.reset(sl.x, sl.z, sl.yaw, sl.i, 0.0);
      c.reset0();
      c.sTrack = sl.s; c.sPrev = sl.s; c.hint = sl.i; c.distance = sl.s - this.T.length; c.cpLastS = sl.s;
      c.startCrossed = false; c.lapsDone = 0; c.cpNext = 1;
    });
    this.state = 'grid'; this.t = 0; this.events.length = 0;
  }

  startCountdown() { this.state = 'countdown'; this.count = RULES.countdown; this.countT = 0; }
  go() { this.state = 'racing'; this.t = 0; for (const c of this.cars) { c.lapStartT = 0; } }

  /** per-physics-tick control assignment for all cars (player controls come from `playerInput`) */
  controls(playerInput, dt) {
    const out = [];
    const holding = this.state === 'grid' || this.state === 'countdown';
    const vs = this.cars.map(c => c.v);
    for (const c of this.cars) {
      let inp;
      if (holding) inp = { steer: 0, throttle: c.isPlayer ? (playerInput?.throttle || 0) : 0, brake: 1, handbrake: 1, assist: 0.3, held: true };
      else if (c.isPlayer && !c.autopilot) inp = playerInput;
      else if (c.driver) inp = c.driver.update(c.v, vs, dt);
      else inp = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
      if (c.finished && !c.isPlayer && c.driver) inp = c.driver.update(c.v, vs, dt);
      out.push(inp);
    }
    return out;
  }

  /** after physics: track progress, checkpoints, laps, resets, positions */
  update(dt) {
    const T = this.T, L = T.length;
    if (this.state === 'countdown') {
      this.countT += dt;
      const left = RULES.countdown - Math.floor(this.countT);
      this.count = Math.max(0, left);
      if (this.countT >= RULES.countdown + 0.05) { this.go(); }
    } else if (this.state === 'racing' || this.state === 'finished') this.t += dt;

    for (const c of this.cars) {
      const v = c.v;
      const q = T.nearest(v.p[0], v.p[2], 300, c.hint, this._tq);
      c.hint = q.i; c.lat = q.lat;
      const half = T.w[q.i] * 0.5;
      c.onRoad = Math.abs(q.lat) <= half + 1.2;
      let sNow = q.s;
      let d = sNow - c.sTrack; if (d < -L / 2) d += L; else if (d > L / 2) d -= L;
      const racing = this.state === 'racing' || (this.state === 'finished');
      if (racing) {
        if (Math.abs(d) <= RULES.cutJump) {
          c.lost = false;
          const prev = c.sTrack;
          let ns = prev + d;
          if (ns >= L) {                         // crossed the finish line forward
            ns -= L;
            if (!c.startCrossed) { c.startCrossed = true; c.cpNext = 1; c.lapStartT = this.t; }
            else if (!c.finished) {
              if (c.cpNext >= this.nCp) this._lapDone(c);
              else this.events.push({ t: this.t, car: c.id, type: 'line-no-lap', cp: c.cpNext });   // a shortcut: no lap
            }
          } else if (ns < 0) {                   // crossed backwards
            ns += L;
            if (c.startCrossed && c.lapsDone === 0 && c.cpNext === 1) c.startCrossed = false;
          }
          // checkpoints: forward crossing in sequence only
          if (c.startCrossed && c.cpNext < this.nCp && !c.finished) {
            const sc = this.cpS[c.cpNext];
            if (prev < sc && ns >= sc && ns - sc < RULES.checkpointTol) { c.cpLastS = sc; c.cpNext++; this.events.push({ t: this.t, car: c.id, type: 'cp', k: c.cpNext - 1 }); }
          }
          c.sPrev = c.sTrack; c.sTrack = ns;
          c.distance = c.startCrossed ? c.lapsDone * L + ns : ns - L;
        } else {
          c.lost = true;
        }
      } else {
        // grid: follow position without logic
        c.sPrev = c.sTrack; c.sTrack = sNow; c.distance = sNow - L;
      }
      if (racing) {
        c.currentLapTime = this.t - c.lapStartT;
        c.maxSpeed = Math.max(c.maxSpeed, v.speed);
        // ---- automatic resets
        const flipped = v.up[1] < 0.2;
        c.flipTime = flipped ? c.flipTime + dt : 0;
        c.offTime = (!c.onRoad && Math.abs(q.lat) > half + 3.6) ? c.offTime + dt : 0;
        c.lostTime = c.lost ? c.lostTime + dt : 0;
        c.stuckTime = (Math.abs(v.speed) < 1.2 && this.t > 4 && !c.finished) ? c.stuckTime + dt : 0;
        c.slowAiTime = (!c.isPlayer && Math.abs(v.speed) < 2.6 && this.t > 3.5 && !c.finished) ? (c.slowAiTime || 0) + dt : 0;      // AI crawling / pinned: recover quickly (no AI may stay stuck > 5 s)
        const fell = v.p[1] < -30; if (fell) this.stats.fellOut++;
        const below = v.bodyBelow > 0.3 || fell;
        let why = null;
        if (below) why = 'under-terrain'; else if (c.flipTime > RULES.flipReset) why = 'flipped'; else if (c.offTime > RULES.offRoadReset) why = 'off-road'; else if (c.lostTime > RULES.offRoadReset) why = 'shortcut'; else if (c.stuckTime > RULES.stuckReset || c.slowAiTime > 3.2) why = 'stuck';
        if (why) this.resetCar(c, why);
      }
    }
    // ---- positions
    const order = this.cars.slice().sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.distance - a.distance));
    order.forEach((c, k) => { c.position = k + 1; });
    this.order = order;
    if (this.state === 'racing' || this.state === 'finished') this._watchAI(dt);
    // finishing
    if (this.state === 'racing' && this.player && this.player.finished) { this.state = 'finished'; this.playerFinishedAt = this.t; this.player.autopilot = true; }
    if (this.state === 'finished') this.projectTimes();
  }

  /** integrity bookkeeping used by the tests: AI stuck / off the road > 5 s, overtakes between AI cars */
  _watchAI(dt) {
    const ai = this.cars.filter((c) => !c.isPlayer && !c.finished);
    for (const c of ai) {
      const slow = Math.abs(c.v.speed) < 3.0 && this.t > 3;
      c.stuckAi = slow ? c.stuckAi + dt : 0;
      c.offAi = !c.onRoad && Math.abs(c.lat) > this.T.w[Math.max(0, c.hint)] * 0.5 + 2.5 ? (c.offAi || 0) + dt : 0;
      c.maxStuckAi = Math.max(c.maxStuckAi || 0, c.stuckAi, c.offAi || 0);
      if (c.stuckAi > 5 && !c._stuckFlag) { c._stuckFlag = true; this.stats.aiStuck++; this.log.push({ t: this.t, car: c.id, type: 'ai-stuck', s: +c.sTrack.toFixed(0) }); }
      if (c.stuckAi === 0) c._stuckFlag = false;
    }
    if (!this._pair) this._pair = new Map();
    for (let i = 0; i < ai.length; i++) for (let j = i + 1; j < ai.length; j++) {
      const a = ai[i], b = ai[j], d = a.distance - b.distance, key = a.id * 16 + b.id, prev = this._pair.get(key);
      if (prev !== undefined && prev !== 0 && Math.sign(d) !== prev && Math.abs(d) < 14 && this.t > 4 && !a.lost && !b.lost) {
        this.stats.overtakesAI++;
        this.events.push({ t: this.t, car: d > 0 ? a.id : b.id, passed: d > 0 ? b.id : a.id, type: 'overtake', ai: true });
      }
      this._pair.set(key, Math.sign(d));
    }
  }

  _lapDone(c) {
    const lt = this.t - c.lapStartT;
    c.lapTimes.push(lt); c.bestLap = Math.min(c.bestLap, lt);
    c.lapsDone++; c.cpNext = 1; c.lapStartT = this.t;
    this.events.push({ t: this.t, car: c.id, type: 'lap', lap: c.lapsDone, time: lt });
    if (c.lapsDone >= this.laps) { c.finished = true; c.finishTime = this.t; this.events.push({ t: this.t, car: c.id, type: 'finish', time: c.finishTime }); }
  }

  resetCar(c, why) {
    const T = this.T, L = T.length;
    const s = c.finished ? c.sTrack : c.cpLastS;
    const i = T.indexAtS(s);
    const p = T.roadPoint(i, 0, 0);
    // do not drop the car on top of another one: nudge ahead until free
    let ss = s, tries = 0;
    for (; tries < 8; tries++) {
      const pi = T.indexAtS(ss); const pp = T.roadPoint(pi, 0, 0);
      const busy = this.cars.some(o => o !== c && Math.hypot(o.v.p[0] - pp.x, o.v.p[2] - pp.z) < 6);
      if (!busy) break; ss += 7;
    }
    const ii = T.indexAtS(ss), pp = T.roadPoint(ii, 0, 0);
    c.v.reset(pp.x, pp.z, T.heading[ii], ii, 0.0);
    // keep rolling speed so the AI does not hold up the pack (human: stops)
    c.hint = ii; c.sTrack = ss % L; c.sPrev = c.sTrack; c.lost = false; c.offTime = c.stuckTime = c.flipTime = c.lostTime = 0; c.resets++;
    c.distance = (c.startCrossed ? c.lapsDone * L : -L) + c.sTrack;
    const ev = { t: this.t, car: c.id, type: 'reset', reason: why, s: +ss.toFixed(1), player: c.isPlayer };
    this.events.push(ev); this.log.push(ev);
    if (why === 'under-terrain') this.stats.underTerrain++;
    c.slowAiTime = 0; c.stuckAi = 0; c.offAi = 0; c._stuckFlag = false;
    if (c.driver) { c.driver.off = 0; }
  }

  projectTimes() {
    const L = this.T.length, N = this.laps;
    for (const c of this.cars) {
      if (c.finished) { c.projected = c.finishTime; continue; }
      const done = Math.max(1, c.distance + L);
      const avg = Math.max(8, done / Math.max(1, this.t));
      c.avgSpeed = avg;
      c.projected = this.t + Math.max(0, (N * L - c.distance)) / avg;
    }
  }

  /** gap (s) of every car to the player, used by the HUD */
  snapshot() {
    return this.cars.map(c => ({ id: c.id, name: c.name, pos: c.position, lap: Math.min(this.laps, c.lapsDone + 1), dist: c.distance, finished: c.finished, time: c.finished ? c.finishTime : c.projected }));
  }
}
