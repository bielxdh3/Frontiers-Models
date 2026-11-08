// Driver controller: pure-pursuit steering on the racing line + speed control, with overtaking and avoidance.
// The same controller drives the 5 AI cars (and the player's autopilot, which is allowed only in tests).
export const DIFFICULTY = {
  easy:   { grip: 0.86, aggression: 0.35, vTop: 0.90, look: 1.15, name: 'Fácil' },
  normal: { grip: 0.94, aggression: 0.65, vTop: 0.96, look: 1.0, name: 'Normal' },
  hard:   { grip: 1.00, aggression: 0.95, vTop: 1.00, look: 0.9, name: 'Difícil' },
};

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class Driver {
  /**
   * @param {RacingLine} line  @param {TrackData} T  @param {object} opts {skill, lineBias, difficulty}
   */
  constructor(line, T, opts = {}) {
    this.line = line; this.T = T;
    this.skill = opts.skill ?? 1.0;               // per-driver speed factor
    this.lineBias = opts.lineBias ?? 0;           // preferred lateral offset (m)
    this.diff = DIFFICULTY[opts.difficulty || 'normal'];
    this.offTarget = 0; this.off = 0;             // overtaking / avoidance offset added to the line
    this.idx = -1;
    this.state = { steer: 0, throttle: 0, brake: 0, handbrake: 0, assist: 0.3, tc: 0.6 };
    this.stuckTimer = 0;
    this.lastBlockT = 0;
  }

  /**
   * @param {Vehicle} car  @param {Vehicle[]} others  @param {number} dt
   * @returns the control state {steer, throttle, brake, handbrake, assist}
   */
  update(car, others, dt) {
    const T = this.T, L = this.line, N = T.N;
    const px = car.p[0], pz = car.p[2];
    const q = T.nearest(px, pz, 300, this.idx, this._nq || (this._nq = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 }));
    this.idx = q.i;
    const i0 = q.i;
    const speed = Math.max(0.0, car.speed);
    const fwd = car.forward;

    // ---- avoidance / overtaking: look for cars ahead within ~38 m
    let aheadGap = 1e9, aheadV = 0, aheadLat = 0, sideBlockL = false, sideBlockR = false;
    const myS = q.s, Ltot = T.length;
    for (const o of others) {
      if (o === car) continue;
      const dx = o.p[0] - px, dz = o.p[2] - pz;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > 55 * 55) continue;
      const fwdD = dx * fwd[0] + dz * fwd[2];
      const rgt = car.right;
      const latD = dx * rgt[0] + dz * rgt[2];          // + = other is on my right
      if (fwdD > -6 && fwdD < 7 && Math.abs(latD) < 3.4) { if (latD > 0) sideBlockR = true; else sideBlockL = true; }
      if (fwdD > 2 && fwdD < 38 && Math.abs(latD) < 2.6) {
        const gap = fwdD - (car.spec.length + o.spec.length) * 0.5;
        if (gap < aheadGap) { aheadGap = gap; aheadV = o.speed; aheadLat = latD; }
      }
    }
    let desiredOff = 0;
    if (aheadGap < 26) {
      // pass on the side with more room, only if we are faster or the leader is slow
      const goRight = aheadLat < 0 ? true : (aheadLat > 0 ? false : (this.lineSide ?? (this.lineSide = (car.id % 2 ? 1 : -1) > 0)));
      let dir = goRight ? 1 : -1;
      if (dir > 0 && sideBlockR) dir = -1; else if (dir < 0 && sideBlockL) dir = 1;
      desiredOff = dir * (2.1 + this.diff.aggression);
    }
    if (sideBlockL && !sideBlockR && desiredOff === 0) desiredOff = 0.9;
    if (sideBlockR && !sideBlockL && desiredOff === 0) desiredOff = -0.9;
    this.offTarget = desiredOff;
    this.off += clamp(this.offTarget - this.off, -2.2 * dt, 2.2 * dt);

    // ---- pure pursuit on the line (+ offsets), clamped inside the asphalt
    const Ld = clamp((9 + 0.42 * speed) * this.diff.look, 8, 44);
    const steps = Math.max(1, Math.round(Ld / T.ds));
    const ti = (i0 + steps) % N;
    const half = T.w[ti] * 0.5;
    const lat = clamp(L.off[ti] + this.lineBias + this.off, -(half - 1.6), half - 1.6);
    const cb = Math.cos(T.bank[ti]);
    const tx = T.px[ti] + T.rx[ti] * cb * lat, tz = T.pz[ti] + T.rz[ti] * cb * lat;
    const dx = tx - px, dz = tz - pz;
    const rgt = car.right;
    const lx = dx * rgt[0] + dz * rgt[2], lz = dx * fwd[0] + dz * fwd[2];
    const alpha = Math.atan2(lx, Math.max(lz, 0.5));
    const wb = car.spec.wheelbase;
    const delta = Math.atan2(2 * wb * Math.sin(alpha), Math.max(Ld, 1));
    const limA = car.spec.maxSteer / (1 + Math.pow(Math.max(speed, 0) / 18, 1.8));
    let steer = clamp(delta / limA, -1, 1);
    if (speed < 6) steer *= clamp(0.55 + speed / 8, 0.55, 1);       // gentle at the standing start (no snap oversteer)

    // ---- speed: profile some metres ahead, scaled by difficulty & driver skill
    const la = Math.max(8, speed * 0.55);
    const si = (i0 + Math.round(la / T.ds)) % N;
    let vt = L.v[i0] ;
    for (let k = 0; k <= Math.round(la / T.ds); k += 3) { const v2 = L.v[(i0 + k) % N]; if (v2 < vt) vt = v2; }
    vt = Math.min(vt, L.v[si]) * this.diff.grip ** 0.5 * this.diff.vTop * this.skill;
    // do not rear-end the car in front
    if (aheadGap < 30) {
      const follow = aheadV + Math.max(0, (aheadGap - 5)) * 0.9;
      if (this.off === 0 || Math.abs(this.off) < 1.2) vt = Math.min(vt, Math.max(follow, aheadV * 0.9));
    }
    const err = vt - speed;
    let throttle = clamp(err * 0.45, 0, 1), brake = clamp(-err * 0.32 - 0.02, 0, 1);
    if (err > -0.8) brake = 0;
    if (speed < 2 && vt > 4) { throttle = 1; brake = 0; }
    // lateral-slip protection: lift off when the car is sliding
    const slip = Math.abs(car.latG);
    if (slip > 1.35 && throttle > 0.3) throttle *= 0.5;
    this.state.steer = steer; this.state.throttle = throttle; this.state.brake = brake; this.state.handbrake = 0;
    return this.state;
  }
}
