// Arcade-with-weight vehicle: rigid body + 4 raycast suspensions + brush-style tyres + gearbox.
// No three.js dependency: runs headless in Node (tests, AI tuning) and in the browser, at a FIXED timestep.
import { SURF } from './ground.js';

const GRAV = 9.81, RHO = 1.2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

function lerpCurve(c, x) {
  if (x <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (x <= c[i][0]) { const t = (x - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
  }
  return c[c.length - 1][1];
}

export class Vehicle {
  constructor(spec, ground, id = 0) {
    const s = this.spec = spec;
    this.ground = ground; this.id = id;
    this.mass = s.mass;
    this.Ix = s.mass * (s.length * s.length + s.height * s.height) / 12 * 0.95;
    this.Iy = s.mass * (s.length * s.length + s.width * s.width) / 12 * 1.2;
    this.Iz = s.mass * (s.width * s.width + s.height * s.height) / 12 * 0.95;
    const L = s.wheelbase;
    this.zF = -(1 - s.frontWeight) * L; this.zR = s.frontWeight * L;   // axle z in body frame (forward = -z)
    const ym = -s.cgH + s.wheelR + s.susp.rest;
    this.wheels = [
      { front: true, side: -1, m: [-s.trackF / 2, ym, this.zF] },
      { front: true, side: 1, m: [s.trackF / 2, ym, this.zF] },
      { front: false, side: -1, m: [-s.trackR / 2, ym, this.zR] },
      { front: false, side: 1, m: [s.trackR / 2, ym, this.zR] },
    ];
    for (const w of this.wheels) {
      w.k = w.front ? s.susp.kF : s.susp.kR; w.c = w.front ? s.susp.cF : s.susp.cR;
      w.comp = 0; w.compPrev = 0; w.omega = 0; w.spin = 0; w.steer = 0; w.contact = false;
      w.load = 0; w.slipK = 0; w.slipA = 0; w.skid = 0; w.surf = 0; w.hitDist = 0;
      w.hub = [0, 0, 0]; w.cp = [0, 0, 0]; w.n = [0, 1, 0]; w.hint = -1; w.fx = 0; w.fy = 0; w.vlong = 0;
    }
    this.p = new Float64Array(3); this.v = new Float64Array(3); this.w = new Float64Array(3);
    this.q = new Float64Array([0, 0, 0, 1]);
    this.ax = new Float64Array(9);          // body axes in world: right(0..2) up(3..5) back(6..8)
    this.F = new Float64Array(3); this.Tq = new Float64Array(3);
    this.g = { y: 0, nx: 0, ny: 1, nz: 0, surf: 0, mu: 1, rr: 0.013, drag: 0, i: 0, lat: 0, s: 0, onRoad: true };
    // drivetrain
    this.gear = 1; this.rpm = s.engine.idle; this.shiftTimer = 0; this.reverse = false;
    this.throttle = 0; this.brake = 0; this.steerCmd = 0; this.steer = 0;
    this.clutch = 1;
    // telemetry
    this.speed = 0; this.latG = 0; this.longG = 0; this.airborne = 0; this.hint = -1;
    this.ev = { shifts: 0, shiftDir: 0, impact: 0, scrape: 0, bodyHit: 0 };
    this.bodyBelow = 0; this.flip = 0; this.onGroundWheels = 4;
    this.prevV = new Float64Array(3);
    this.hullPts = this._hull();
    this.updateAxes();
  }

  _hull() {
    const s = this.spec, hw = s.width / 2 * 0.98, hl = s.length / 2, y = -s.cgH + 0.30;
    const fz = -(hl - (-this.zF)) , rz = 0; // (unused)
    // 8 points around the footprint, expressed relative to the centre of the car box (CoM is near the middle)
    const zc = (this.zF + this.zR) / 2;     // box centre z relative to CoM
    const pts = [];
    for (const zz of [-hl, 0, hl]) for (const xx of [-hw, 0, hw]) { if (xx === 0 && zz === 0) continue; pts.push([xx, y, zc + zz]); }
    return pts;
  }

  // ------------------------------------------------------------------ pose helpers
  updateAxes() {
    const [x, y, z, w] = this.q, a = this.ax;
    a[0] = 1 - 2 * (y * y + z * z); a[1] = 2 * (x * y + z * w); a[2] = 2 * (x * z - y * w);
    a[3] = 2 * (x * y - z * w); a[4] = 1 - 2 * (x * x + z * z); a[5] = 2 * (y * z + x * w);
    a[6] = 2 * (x * z + y * w); a[7] = 2 * (y * z - x * w); a[8] = 1 - 2 * (x * x + y * y);
  }
  get forward() { const a = this.ax; return [-a[6], -a[7], -a[8]]; }
  get up() { const a = this.ax; return [a[3], a[4], a[5]]; }
  get right() { const a = this.ax; return [a[0], a[1], a[2]]; }
  /** yaw (heading, radians, 0 = north, clockwise) */
  get heading() { const a = this.ax; return Math.atan2(-a[6], a[8]); }
  local(lx, ly, lz, out) {
    const a = this.ax;
    out[0] = this.p[0] + a[0] * lx + a[3] * ly + a[6] * lz;
    out[1] = this.p[1] + a[1] * lx + a[4] * ly + a[7] * lz;
    out[2] = this.p[2] + a[2] * lx + a[5] * ly + a[8] * lz;
    return out;
  }

  /** place the car on the ground at (x,z) heading `yaw` (0 = north, clockwise), at rest */
  reset(x, z, yaw, hint = -1, yOffset = 0) {
    const g = this.g;
    this.ground.query(x, z, hint, g);
    const n = [g.nx, g.ny, g.nz];
    const f0 = [Math.sin(yaw), 0, -Math.cos(yaw)];
    // right = f x n ; forward' = n x right
    let r = [f0[1] * n[2] - f0[2] * n[1], f0[2] * n[0] - f0[0] * n[2], f0[0] * n[1] - f0[1] * n[0]];
    let rl = Math.hypot(r[0], r[1], r[2]); r = r.map(v => v / rl);
    const f = [n[1] * r[2] - n[2] * r[1], n[2] * r[0] - n[0] * r[2], n[0] * r[1] - n[1] * r[0]];
    // rotation matrix columns: right, up, back
    const m00 = r[0], m10 = r[1], m20 = r[2], m01 = n[0], m11 = n[1], m21 = n[2], m02 = -f[0], m12 = -f[1], m22 = -f[2];
    const tr = m00 + m11 + m22; let qx, qy, qz, qw;
    if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; qw = 0.25 * S; qx = (m21 - m12) / S; qy = (m02 - m20) / S; qz = (m10 - m01) / S; }
    else if (m00 > m11 && m00 > m22) { const S = Math.sqrt(1 + m00 - m11 - m22) * 2; qw = (m21 - m12) / S; qx = 0.25 * S; qy = (m01 + m10) / S; qz = (m02 + m20) / S; }
    else if (m11 > m22) { const S = Math.sqrt(1 + m11 - m00 - m22) * 2; qw = (m02 - m20) / S; qx = (m01 + m10) / S; qy = 0.25 * S; qz = (m12 + m21) / S; }
    else { const S = Math.sqrt(1 + m22 - m00 - m11) * 2; qw = (m10 - m01) / S; qx = (m02 + m20) / S; qy = (m12 + m21) / S; qz = 0.25 * S; }
    this.q.set([qx, qy, qz, qw]);
    this.p[0] = x + n[0] * (this.spec.cgH + 0.02 + yOffset); this.p[1] = g.y + n[1] * (this.spec.cgH + 0.02 + yOffset); this.p[2] = z + n[2] * (this.spec.cgH + 0.02 + yOffset);
    this.v.fill(0); this.w.fill(0);
    for (const w of this.wheels) { w.omega = 0; w.comp = 0.05; w.compPrev = 0.05; w.hint = hint; w.contact = false; w.skid = 0; }
    this.gear = 1; this.rpm = this.spec.engine.idle; this.shiftTimer = 0; this.reverse = false;
    this.steer = 0; this.hint = hint; this.bodyBelow = 0; this.flip = 0; this.airborne = 0;
    this.updateAxes();
  }

  // ------------------------------------------------------------------ main step
  step(dt, inp) {
    const s = this.spec, ax = this.ax, p = this.p, v = this.v, W = this.w;
    this.updateAxes();
    const fwd = [-ax[6], -ax[7], -ax[8]];
    const up = [ax[3], ax[4], ax[5]];
    const right = [ax[0], ax[1], ax[2]];
    const vFwd = v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2];
    const vRight = v[0] * right[0] + v[1] * right[1] + v[2] * right[2];
    const speedAbs = Math.hypot(v[0], v[1], v[2]);
    this.speed = vFwd;

    // ---------------- driver inputs -> steering angle
    const vAbs = Math.abs(vFwd);
    const lim = s.maxSteer / (1 + Math.pow(vAbs / 18, 1.8));
    let steerTarget = inp.steer * lim;
    // counter-steer assist while the car slides (keeps drifts catchable)
    const assist = inp.assist ?? 0.45;
    if (vAbs > 7) {
      const beta = Math.atan2(vRight, Math.max(vAbs, 1));
      steerTarget += clamp(beta * 0.9, -lim * 0.8, lim * 0.8) * assist * (Math.abs(inp.steer) < 0.6 ? 1 : 0.4);
    }
    steerTarget = clamp(steerTarget, -s.maxSteer, s.maxSteer);
    const rate = s.steerRate * (Math.abs(steerTarget) < Math.abs(this.steer) ? 1.8 : 1.0);
    this.steer += clamp(steerTarget - this.steer, -rate * dt, rate * dt);
    this.throttle = inp.throttle; this.brake = inp.brake;

    // ---------------- reverse / forward logic
    if (this.reverse) { if (inp.throttle > 0.1 && vFwd > -0.5) this.reverse = false; }
    else if (inp.brake > 0.2 && vFwd < 0.8 && inp.throttle < 0.1) this.reverse = true;
    const driveInput = this.reverse ? inp.brake : inp.throttle;
    const brakeInput = this.reverse ? 0 : inp.brake;

    // ---------------- gearbox + engine
    const gears = s.gears, nG = gears.length;
    const driven = this.wheels.filter(w => (s.drive === 'AWD') || !w.front);
    let wAvg = 0; for (const w of driven) wAvg += w.omega; wAvg /= driven.length;
    const ratioNow = this.reverse ? -3.1 : gears[this.gear - 1];
    const rpmWheel = Math.abs(wAvg) * Math.abs(ratioNow) * s.fd * 9.5493;
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      this.rpm += (Math.max(s.engine.idle, rpmWheel) - this.rpm) * Math.min(1, dt * 14);
    } else {
      const launch = this.gear === 1 || this.reverse ? s.engine.idle + driveInput * 1700 : s.engine.idle;
      const target = Math.max(rpmWheel, launch);
      this.rpm += (target - this.rpm) * Math.min(1, dt * 30);
      if (!this.reverse) {
        const rpmDown = this.gear > 1 ? rpmWheel * gears[this.gear - 2] / gears[this.gear - 1] : 0;
        if (this.gear < nG && this.rpm > s.engine.redline * 0.975 && driveInput > 0.05) this._shift(+1, s);
        else if (this.gear > 1 && ((rpmWheel < s.engine.redline * 0.36 && rpmDown < s.engine.redline * 0.9) || (brakeInput > 0.35 && rpmWheel < s.engine.redline * 0.55 && rpmDown < s.engine.redline * 0.85))) this._shift(-1, s);
      }
    }
    // engine torque -> wheel torque
    let engT = lerpCurve(s.engine.torque, this.rpm) * driveInput;
    if (this.rpm > s.engine.limiter) engT = 0;
    else if (this.rpm > s.engine.redline) engT *= 1 - (this.rpm - s.engine.redline) / (s.engine.limiter - s.engine.redline) * 0.8;
    if (driveInput < 0.02) engT = -lerpCurve(s.engine.torque, this.rpm) * 0.09 * (this.rpm / s.engine.redline);   // engine braking
    if (this.shiftTimer > 0) engT = 0;
    const totalRatio = ratioNow * s.fd;
    let wheelTq = engT * totalRatio * s.drivetrainEff;
    if (this.reverse) wheelTq *= 0.55;

    // ---------------- forces
    const F = this.F, Tq = this.Tq; F.fill(0); Tq.fill(0);
    F[1] -= this.mass * GRAV;
    const rr = [0, 0, 0];
    const gq = this.g;
    let contacts = 0, loadTotal = 0;
    const brakeF = brakeInput;
    const hb = inp.handbrake || 0;
    const tcLevel = inp.tc ?? 0.5;               // traction control: 0 off, 1 strong (AI cars use 1, the player 0.5)
    // drive torque split
    const split = (w) => s.drive === 'AWD' ? (w.front ? s.awdFront / 2 : (1 - s.awdFront) / 2) : (w.front ? 0 : 0.5);
    const o = [0, 0, 0];
    const dn = [-up[0], -up[1], -up[2]];
    for (let wi = 0; wi < 4; wi++) {
      const w = this.wheels[wi];
      this.local(w.m[0], w.m[1], w.m[2], o);
      const rayMax = s.susp.rest + s.susp.droop + s.wheelR;
      // ---- ray vs ground by Newton iterations on the height above ground
      let t = s.susp.rest + s.wheelR, hit = false;
      let gx = 0, gz = 0;
      for (let it = 0; it < 3; it++) {
        const px = o[0] + dn[0] * t, pz = o[2] + dn[2] * t;
        this.ground.query(px, pz, w.hint, gq, o[1] + 0.8);
        w.hint = gq.i;
        const fval = (o[1] + dn[1] * t) - gq.y;
        gx = -gq.nx / Math.max(gq.ny, 0.2); gz = -gq.nz / Math.max(gq.ny, 0.2);
        const fp = dn[1] - (gx * dn[0] + gz * dn[2]);
        if (Math.abs(fp) < 1e-4) break;
        t -= fval / fp;
        if (it === 0 && t < 0) t = 0;
      }
      w.hitDist = t;
      hit = t <= rayMax && t >= -0.3;
      w.contact = hit;
      // wheel rotation geometry
      const sa = w.front ? this.steer : 0;
      const cs = Math.cos(sa), sn = Math.sin(sa);
      // visual hub
      const hubD = Math.min(Math.max(t - s.wheelR, s.susp.rest - s.susp.maxComp), s.susp.rest + s.susp.droop);
      w.hub[0] = o[0] + dn[0] * hubD; w.hub[1] = o[1] + dn[1] * hubD; w.hub[2] = o[2] + dn[2] * hubD;
      if (!hit) {
        w.compPrev = w.comp; w.comp = 0; w.load = 0; w.skid *= 0.9;
        // free-spinning wheel decays / is driven
        const tq = wheelTq * split(w);
        w.omega += (tq - (brakeF * s.brakeTorque * (w.front ? s.brakeBias : 1 - s.brakeBias) + (w.front ? 0 : hb * 2400)) * Math.sign(w.omega || 1) * 0.3) / s.wheelI * dt;
        w.omega *= 0.998;
        w.spin += w.omega * dt;
        w.fx = w.fy = 0; w.slipK = w.slipA = 0;
        continue;
      }
      contacts++;
      const nrm = [gq.nx, gq.ny, gq.nz];
      w.n[0] = nrm[0]; w.n[1] = nrm[1]; w.n[2] = nrm[2];
      w.cp[0] = o[0] + dn[0] * t; w.cp[1] = o[1] + dn[1] * t; w.cp[2] = o[2] + dn[2] * t;
      w.surf = gq.surf;
      // ---- suspension
      const comp = clamp(s.susp.rest + s.wheelR - t, -s.susp.droop, s.susp.maxComp + 0.08);
      const dComp = (comp - w.comp) / dt;
      w.compPrev = w.comp; w.comp = comp;
      let Fs = w.k * comp + w.c * dComp;
      if (comp > s.susp.maxComp) Fs += 220000 * (comp - s.susp.maxComp);   // bump stop
      // anti-roll: handled after both wheels of the axle are known (see below)
      w._Fs = Fs;
    }
    // anti-roll bars
    for (const pair of [[0, 1, s.susp.arbF], [2, 3, s.susp.arbR]]) {
      const a = this.wheels[pair[0]], b = this.wheels[pair[1]];
      if (a.contact && b.contact) { const d = (a.comp - b.comp) * pair[2]; a._Fs += d; b._Fs -= d; }
    }
    // tyre forces
    const tire = s.tire;
    for (let wi = 0; wi < 4; wi++) {
      const w = this.wheels[wi];
      if (!w.contact) continue;
      const n = w.n;
      const Fs = Math.max(0, w._Fs);
      w.load = Fs; loadTotal += Fs;
      // suspension force along the contact normal, applied at the contact patch
      this._addForce(n[0] * Fs, n[1] * Fs, n[2] * Fs, w.cp);
      // contact point velocity
      const rx = w.cp[0] - p[0], ry = w.cp[1] - p[1], rz = w.cp[2] - p[2];
      const vcx = v[0] + (W[1] * rz - W[2] * ry), vcy = v[1] + (W[2] * rx - W[0] * rz), vcz = v[2] + (W[0] * ry - W[1] * rx);
      // wheel axes projected on the ground plane
      const sa = w.front ? this.steer : 0, cs = Math.cos(sa), sn = Math.sin(sa);
      let fx = fwd[0] * cs + right[0] * sn, fy = fwd[1] * cs + right[1] * sn, fz = fwd[2] * cs + right[2] * sn;
      const dnf = fx * n[0] + fy * n[1] + fz * n[2];
      fx -= n[0] * dnf; fy -= n[1] * dnf; fz -= n[2] * dnf;
      let fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      // right = f x n
      const lx = fy * n[2] - fz * n[1], ly = fz * n[0] - fx * n[2], lz = fx * n[1] - fy * n[0];
      const vlong = vcx * fx + vcy * fy + vcz * fz;
      const vlat = vcx * lx + vcy * ly + vcz * lz;
      w.vlong = vlong;
      const mu = tire.mu * gq_mu(w.surf) * (1 + 0.04 * Math.min(1, w.load / 5000));
      const Nn = Fs;
      // slip + implicit wheel spin
      const driveTq = wheelTq * split(w);
      const brakeTq = brakeF * s.brakeTorque * (w.front ? s.brakeBias : 1 - s.brakeBias) + (w.front ? 0 : hb * 2600);
      const vref = Math.max(Math.abs(vlong), 2.2);
      const sy = (vlat / Math.max(Math.abs(vlong), 2.5)) / tire.peakA;
      const R = s.wheelR;
      const force = (om) => {
        const sk = ((om * R - vlong) / vref) / tire.peakK;
        const sm = Math.hypot(sk, sy) + 1e-9;
        const f = Math.tanh(1.5 * sm) * (1 - tire.loss * smooth(1.3, 3.6, sm));
        return { fx: mu * Nn * f * sk / sm, fy: mu * Nn * f * sy / sm, sm, sk };
      };
      let om = w.omega;
      let TD = driveTq;
      // traction control (arcade): fade drive torque when the driven wheel spins up too far
      if (TD > 0) { const sk0 = (om * R - vlong) / vref / tire.peakK; const thr = 2.2 - 1.2 * tcLevel; if (sk0 > thr) TD *= clamp(1 - (sk0 - thr) * (0.35 + 0.8 * tcLevel), 0.3, 1); }
      for (let it = 0; it < 3; it++) {
        const f0 = force(om), f1 = force(om + 0.5);
        const dF = (f1.fx - f0.fx) / 0.5;
        const g = s.wheelI * (om - w.omega) / dt - TD + R * f0.fx;
        const dg = s.wheelI / dt + R * dF;
        om -= g / dg;
      }
      // brakes (ABS: back off if the wheel is about to lock)
      if (brakeTq > 0) {
        const lockSlip = (om * R - vlong) / vref;
        const abs = hb > 0.1 && !w.front ? 1 : (lockSlip < -0.22 ? 0.0 : 1.0);
        const dOm = (brakeTq * abs / s.wheelI) * dt;
        if (Math.abs(om) <= dOm) om = 0; else om -= Math.sign(om) * dOm;
      }
      w.omega = om; w.spin += om * dt;
      const fr = force(om);
      let Fx = fr.fx, Fy = fr.fy;
      // velocity-kill clamps keep the stiff low-speed regime stable (never overshoot zero relative velocity)
      const mEff = this.mass * 0.25;
      const killLat = mEff * Math.abs(vlat) / dt, killLon = mEff * Math.abs(vlong - om * R) / dt * 0.0 + 1e9;
      if (Math.abs(Fy) > killLat) Fy = Math.sign(Fy) * killLat;
      // rolling resistance + surface drag
      const rrF = gq_rr(w.surf) * Nn;
      const dragF = gq_drag(w.surf) * Nn * 0.02 * Math.abs(vlong);
      Fx -= Math.sign(vlong) * Math.min(rrF + dragF, Math.abs(vlong) * mEff / dt);
      w.fx = Fx; w.fy = Fy; w.slipK = fr.sk * tire.peakK; w.slipA = Math.atan2(vlat, Math.max(Math.abs(vlong), 1.5));
      // skid intensity for sound/particles
      const sl = clamp((fr.sm - 0.95) / 1.1, 0, 1) * clamp(Nn / 1800, 0, 1);
      w.skid = Math.max(sl, w.skid * 0.85);
      // apply tyre force at the contact patch
      this._addForce(fx * Fx - lx * Fy, fy * Fx - ly * Fy, fz * Fx - lz * Fy, w.cp);
    }
    this.onGroundWheels = contacts;
    this.airborne = contacts === 0 ? this.airborne + dt : 0;

    // aero: drag at CoM, downforce split between axles
    const vv = speedAbs;
    if (vv > 0.01) {
      const kd = 0.5 * RHO * s.cdA * vv;
      F[0] -= kd * v[0]; F[1] -= kd * v[1]; F[2] -= kd * v[2];
      const down = 0.5 * RHO * s.clA * vv * vv;
      const df = down * s.downFront, dr = down - df;
      const pF = [0, 0, 0], pR = [0, 0, 0];
      this.local(0, 0, this.zF, pF); this.local(0, 0, this.zR, pR);
      this._addForce(-up[0] * df, -up[1] * df, -up[2] * df, pF);
      this._addForce(-up[0] * dr, -up[1] * dr, -up[2] * dr, pR);
    }

    // chassis floor contacts (no sinking through the ground on big hits)
    this._chassisContacts(dt);

    // ---------------- integrate
    const m = this.mass;
    this.prevV[0] = v[0]; this.prevV[1] = v[1]; this.prevV[2] = v[2];
    v[0] += F[0] / m * dt; v[1] += F[1] / m * dt; v[2] += F[2] / m * dt;
    // angular: I^-1 (tau - w x Iw)
    const wx = W[0] * ax[0] + W[1] * ax[1] + W[2] * ax[2], wy = W[0] * ax[3] + W[1] * ax[4] + W[2] * ax[5], wz = W[0] * ax[6] + W[1] * ax[7] + W[2] * ax[8];
    const tx = Tq[0] * ax[0] + Tq[1] * ax[1] + Tq[2] * ax[2], ty = Tq[0] * ax[3] + Tq[1] * ax[4] + Tq[2] * ax[5], tz = Tq[0] * ax[6] + Tq[1] * ax[7] + Tq[2] * ax[8];
    // gyroscopic term (body frame)
    const gx = (this.Iz - this.Iy) * wy * wz, gy = (this.Ix - this.Iz) * wz * wx, gz = (this.Iy - this.Ix) * wx * wy;
    const ax_ = (tx + gx) / this.Ix, ay_ = (ty + gy) / this.Iy, az_ = (tz + gz) / this.Iz;
    W[0] += (ax[0] * ax_ + ax[3] * ay_ + ax[6] * az_) * dt;
    W[1] += (ax[1] * ax_ + ax[4] * ay_ + ax[7] * az_) * dt;
    W[2] += (ax[2] * ax_ + ax[5] * ay_ + ax[8] * az_) * dt;
    // mild angular damping (keeps arcade feel calm in the air)
    const ad = Math.exp(-0.12 * dt); W[0] *= ad; W[1] *= ad; W[2] *= ad;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    const q = this.q;
    const hx = W[0] * 0.5 * dt, hy = W[1] * 0.5 * dt, hz = W[2] * 0.5 * dt;
    const nqx = q[0] + (hx * q[3] + hy * q[2] - hz * q[1]);
    const nqy = q[1] + (hy * q[3] + hz * q[0] - hx * q[2]);
    const nqz = q[2] + (hz * q[3] + hx * q[1] - hy * q[0]);
    const nqw = q[3] + (-hx * q[0] - hy * q[1] - hz * q[2]);
    const ql = Math.hypot(nqx, nqy, nqz, nqw);
    q[0] = nqx / ql; q[1] = nqy / ql; q[2] = nqz / ql; q[3] = nqw / ql;
    // telemetry
    const invdt = 1 / dt;
    this.latG = ((v[0] - this.prevV[0]) * right[0] + (v[1] - this.prevV[1]) * right[1] + (v[2] - this.prevV[2]) * right[2]) * invdt / GRAV;
    this.longG = ((v[0] - this.prevV[0]) * fwd[0] + (v[1] - this.prevV[1]) * fwd[1] + (v[2] - this.prevV[2]) * fwd[2]) * invdt / GRAV;
    this.flip = up[1] < 0.25 ? this.flip + dt : 0;
    this.hint = this.wheels[0].hint;
  }

  _shift(dir, s) {
    this.gear += dir; this.shiftTimer = dir > 0 ? 0.20 : 0.15;
    this.ev.shifts++; this.ev.shiftDir = dir;
  }

  _addForce(fx, fy, fz, at) {
    const F = this.F, T = this.Tq, p = this.p;
    F[0] += fx; F[1] += fy; F[2] += fz;
    const rx = at[0] - p[0], ry = at[1] - p[1], rz = at[2] - p[2];
    T[0] += ry * fz - rz * fy; T[1] += rz * fx - rx * fz; T[2] += rx * fy - ry * fx;
  }

  /** soft floor-pan contacts: stops the body going through the ground when suspension bottoms out */
  _chassisContacts(dt) {
    const s = this.spec, g = this.g, W = this.w, v = this.v, p = this.p;
    const hw = s.width * 0.42, hl = s.length * 0.40, y = -s.cgH + 0.17;
    const zc = (this.zF + this.zR) / 2;
    const o = [0, 0, 0];
    for (const [xx, zz] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]]) {
      this.local(xx, y, zc + zz, o);
      this.ground.query(o[0], o[2], this.hint, g, o[1] + 1.2);
      const pen = g.y - o[1];
      if (pen > 0) {
        if (pen > 0.30) this.bodyBelow = Math.max(this.bodyBelow, pen);
        const rx = o[0] - p[0], ry = o[1] - p[1], rz = o[2] - p[2];
        const vx = v[0] + (W[1] * rz - W[2] * ry), vy = v[1] + (W[2] * rx - W[0] * rz), vz = v[2] + (W[0] * ry - W[1] * rx);
        const vn = vx * g.nx + vy * g.ny + vz * g.nz;
        const fn = Math.max(0, 140000 * pen - 6000 * vn);
        this._addForce(g.nx * fn, g.ny * fn, g.nz * fn, o);
        // scrape friction
        const tvx = vx - g.nx * vn, tvy = vy - g.ny * vn, tvz = vz - g.nz * vn;
        const tl = Math.hypot(tvx, tvy, tvz);
        if (tl > 0.05) { const ff = Math.min(0.45 * fn, tl * this.mass * 0.25 / dt); this._addForce(-tvx / tl * ff, -tvy / tl * ff, -tvz / tl * ff, o); this.ev.scrape = Math.max(this.ev.scrape, Math.min(1, tl / 25)); }
        if (fn > 6000) this.ev.impact = Math.max(this.ev.impact, Math.min(1, fn / 60000));
      }
    }
  }

  /** world-space impulse at a point (used by collision resolution) */
  applyImpulse(jx, jy, jz, at) {
    const m = this.mass, v = this.v, W = this.w, p = this.p, ax = this.ax;
    v[0] += jx / m; v[1] += jy / m; v[2] += jz / m;
    const rx = at[0] - p[0], ry = at[1] - p[1], rz = at[2] - p[2];
    const tx = ry * jz - rz * jy, ty = rz * jx - rx * jz, tz = rx * jy - ry * jx;
    const bx = tx * ax[0] + ty * ax[1] + tz * ax[2], by = tx * ax[3] + ty * ax[4] + tz * ax[5], bz = tx * ax[6] + ty * ax[7] + tz * ax[8];
    const ox = bx / this.Ix, oy = by / this.Iy, oz = bz / this.Iz;
    W[0] += ax[0] * ox + ax[3] * oy + ax[6] * oz;
    W[1] += ax[1] * ox + ax[4] * oy + ax[7] * oz;
    W[2] += ax[2] * ox + ax[5] * oy + ax[8] * oz;
  }
  /** effective inverse mass along a world direction at a point */
  invMassAlong(nx, ny, nz, at) {
    const p = this.p, ax = this.ax;
    const rx = at[0] - p[0], ry = at[1] - p[1], rz = at[2] - p[2];
    const cx = ry * nz - rz * ny, cy = rz * nx - rx * nz, cz = rx * ny - ry * nx;
    const bx = cx * ax[0] + cy * ax[1] + cz * ax[2], by = cx * ax[3] + cy * ax[4] + cz * ax[5], bz = cx * ax[6] + cy * ax[7] + cz * ax[8];
    return 1 / this.mass + bx * bx / this.Ix + by * by / this.Iy + bz * bz / this.Iz;
  }
  velocityAt(at, out) {
    const p = this.p, v = this.v, W = this.w;
    const rx = at[0] - p[0], ry = at[1] - p[1], rz = at[2] - p[2];
    out[0] = v[0] + (W[1] * rz - W[2] * ry); out[1] = v[1] + (W[2] * rx - W[0] * rz); out[2] = v[2] + (W[0] * ry - W[1] * rx);
    return out;
  }
}

import { SURF_PROPS } from './ground.js';
const gq_mu = k => SURF_PROPS[k].mu, gq_rr = k => SURF_PROPS[k].rr, gq_drag = k => SURF_PROPS[k].drag;
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
