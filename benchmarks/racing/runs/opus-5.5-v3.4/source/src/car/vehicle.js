// Arcade vehicle physics with weight: rigid body + 4 raycast suspensions,
// slip-angle tire forces with a friction circle, simple drivetrain.
// Identical for the player and the AI. Local frame: +X right, +Y up, -Z forward.
import * as THREE from 'three';
import { SURF } from '../world/collision.js';

const G = 9.81;
const MU = { [SURF.ASPHALT]: 1.0, [SURF.CURB]: 0.93, [SURF.GRAVEL]: 0.62, [SURF.SIDEWALK]: 0.85, [SURF.SAND]: 0.5, [SURF.GRASS]: 0.58, [SURF.BRIDGE]: 1.0, [SURF.DIRT]: 0.62, [SURF.ROCK]: 0.7 };
const ROLL_DRAG = { [SURF.ASPHALT]: 0.012, [SURF.CURB]: 0.02, [SURF.GRAVEL]: 0.09, [SURF.SIDEWALK]: 0.02, [SURF.SAND]: 0.16, [SURF.GRASS]: 0.1, [SURF.BRIDGE]: 0.012, [SURF.DIRT]: 0.08, [SURF.ROCK]: 0.05 };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix3();
const _surf = {};

export class Vehicle {
  constructor(spec, id = 0) {
    this.spec = spec; this.id = id;
    this.mass = spec.mass;
    const l = spec.length, w = spec.width, h = spec.height;
    this.Iloc = new THREE.Vector3((spec.mass / 12) * (h * h + l * l) * 1.25, (spec.mass / 12) * (w * w + l * l) * 1.2, (spec.mass / 12) * (w * w + h * h) * 1.6);
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3(); this.angVel = new THREE.Vector3();
    this.prevPos = new THREE.Vector3(); this.prevQuat = new THREE.Quaternion();
    const a = spec.wheelbase * (1 - spec.frontBias), b = spec.wheelbase * spec.frontBias;
    this.axleF = -a; this.axleR = b;
    const staticComp = (spec.mass * G * 0.25) / spec.spring;
    const mountY = -spec.cgHeight + spec.wheelRadius + (spec.rest - staticComp);
    this.wheels = [
      { x: -spec.trackF / 2, z: -a, front: true, left: true },
      { x: spec.trackF / 2, z: -a, front: true, left: false },
      { x: -spec.trackR / 2, z: b, front: false, left: true },
      { x: spec.trackR / 2, z: b, front: false, left: false },
    ].map((wh) => ({ ...wh, y: mountY, comp: 0, prevComp: 0, contact: false, load: 0, spin: 0, angle: 0, steer: 0, slipLat: 0, slipLong: 0, surf: SURF.ASPHALT, onRoad: true, dist: 0, hitY: 0, driven: false }));
    for (const wh of this.wheels) wh.driven = spec.drive === 'awd' || (spec.drive === 'rwd' ? !wh.front : wh.front);
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.gear = 1; this.rpm = spec.idleRpm; this.shiftTimer = 0; this.limiter = false; this.clutch = 1;
    this.events = []; // gear, impact, scrape
    this.scrape = 0; this.impact = 0; this.speed = 0; this.slip = 0; this.airTime = 0;
    this.reverse = false; this.brakeLight = 0; this.steerAngle = 0;
    this.body = [
      [-0.9, -0.32, -2.15], [0.9, -0.32, -2.15], [-0.9, -0.32, 2.15], [0.9, -0.32, 2.15],
      [-0.65, 0.72, -0.8], [0.65, 0.72, -0.8], [-0.65, 0.72, 0.9], [0.65, 0.72, 0.9],
      [0, -0.34, 0],
    ];
    this.half = { x: spec.width * 0.49, z: spec.length * 0.49 };
    this.frozen = false; this.held = false;
    this.allowReverse = true;
  }

  place(x, y, z, heading) {
    // heading: angle of forward direction in XZ (atan2(fz, fx))
    this.pos.set(x, y, z);
    // forward (-Z local) must map to (cos h, 0, sin h): rotation about Y by angle
    const yaw = -heading - Math.PI / 2;
    this.quat.setFromAxisAngle(_v.set(0, 1, 0), yaw);
    this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    this.gear = 1; this.rpm = this.spec.idleRpm; this.shiftTimer = 0;
    for (const w of this.wheels) { w.comp = 0; w.prevComp = 0; w.spin = 0; }
  }
  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.quat); }
  right(out = new THREE.Vector3()) { return out.set(1, 0, 0).applyQuaternion(this.quat); }
  up(out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(this.quat); }
  heading() { const f = this.forward(_v3); return Math.atan2(f.z, f.x); }

  engineTorque(rpm) {
    const s = this.spec;
    let k;
    if (rpm < s.torqueRpm) k = 0.6 + 0.4 * Math.sin((Math.PI / 2) * Math.max(0, rpm - 600) / (s.torqueRpm - 600));
    else k = 1 - 0.3 * ((rpm - s.torqueRpm) / (s.redline - s.torqueRpm)) ** 2;
    return s.torquePeak * Math.max(0.2, k);
  }

  step(dt, world) {
    if (this.frozen) { this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat); return; }
    const s = this.spec;
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    const inp = this.input;
    const R = _m.setFromMatrix4(_m4.makeRotationFromQuaternion(this.quat));
    const e = R.elements; // column-major: right = (e0,e1,e2), up = (e3,e4,e5), back = (e6,e7,e8)
    const rx = e[0], ry = e[1], rz = e[2], ux = e[3], uy = e[4], uz = e[5], fx = -e[6], fy = -e[7], fz = -e[8];
    const F = _force.set(0, -G * this.mass, 0), T = _torque.set(0, 0, 0);
    const vel = this.vel, w = this.angVel, pos = this.pos;
    this.speed = vel.length();
    const vLongCar = vel.x * fx + vel.y * fy + vel.z * fz;

    // ---- steering (speed dependent) ----
    const vAbs = Math.abs(vLongCar);
    const steerMax = s.steerMax * (0.22 + 0.78 / (1 + (vAbs / 23) ** 1.6));
    this.steerAngle = inp.steer * steerMax;

    // ---- drivetrain ----
    const gears = s.gears;
    let gearRatio = this.reverse ? -s.reverse : gears[this.gear - 1];
    let drivenSpeed = 0, nDriven = 0;
    for (const wh of this.wheels) if (wh.driven) { drivenSpeed += wh.spin * s.wheelRadius; nDriven++; }
    drivenSpeed /= Math.max(1, nDriven);
    const wheelRpm = Math.abs(drivenSpeed) / s.wheelRadius * Math.abs(gearRatio) * s.finalDrive * 60 / (2 * Math.PI);
    const thr = inp.throttle;
    const clutchRpm = s.idleRpm + thr * 3400 * Math.max(0, 1 - vAbs / 9);
    let targetRpm = Math.max(wheelRpm, clutchRpm, s.idleRpm);
    if (this.shiftTimer > 0) targetRpm = Math.max(s.idleRpm, this.rpm * (1 - dt * 2));
    if (this.held) targetRpm = s.idleRpm + thr * (s.redline * 0.72 - s.idleRpm); // clutch in on the grid: free revving
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 22);
    this.limiter = false;
    let engT = 0;
    if (this.shiftTimer > 0) { this.shiftTimer -= dt; }
    else {
      engT = this.engineTorque(this.rpm) * thr;
      if (this.rpm >= s.redline) { engT = 0; this.limiter = thr > 0.5; this.rpm = s.redline - 120; }
      engT -= (1 - thr) * s.torquePeak * (0.06 + 0.1 * this.rpm / s.redline) * (vAbs > 1 ? 1 : 0);
    }
    if (this.held) { engT = 0; this.limiter = false; }
    // automatic gearbox
    if (!this.reverse && this.shiftTimer <= 0 && !this.held) {
      if (this.rpm > s.shiftUp && this.gear < gears.length && thr > 0.2) { this.gear++; this.shiftTimer = 0.14; this.events.push({ t: 'gear', up: true, gear: this.gear }); }
      else if (this.gear > 1 && wheelRpm * (gears[this.gear - 2] / gears[this.gear - 1]) < s.shiftUp * 0.86 && this.rpm < s.shiftDown) { this.gear--; this.shiftTimer = 0.1; this.events.push({ t: 'gear', up: false, gear: this.gear }); }
    }
    // reverse handling: hold brake when (almost) stopped
    if (!this.reverse && vLongCar < 0.6 && inp.brake > 0.5 && thr < 0.1 && this.allowReverse && !this.held) this.reverse = true;
    if (this.reverse && (thr > 0.1 || vLongCar > 0.5)) { if (thr > 0.1 && vLongCar > -0.5) this.reverse = false; }
    gearRatio = this.reverse ? -s.reverse : gears[this.gear - 1];
    const wheelTorqueTotal = engT * gearRatio * s.finalDrive * 0.9;
    const revDrive = this.reverse ? inp.brake : 0;

    // ---- wheels ----
    let anyContact = false, slipAcc = 0, scrapeSurf = 0;
    let compL = 0, compR = 0;
    for (const wh of this.wheels) {
      // mount point
      const mx = pos.x + rx * wh.x + ux * wh.y + (-fx) * wh.z;
      const my = pos.y + ry * wh.x + uy * wh.y + (-fy) * wh.z;
      const mz = pos.z + rz * wh.x + uz * wh.y + (-fz) * wh.z;
      world.surface(mx, mz, my + 0.4, _surf);
      const upY = Math.max(0.35, uy);
      const dist = (my - _surf.y) / upY;
      wh.dist = dist; wh.hitY = _surf.y;
      wh.prevComp = wh.comp;
      const comp = s.rest + s.wheelRadius - dist;
      wh.surf = _surf.type; wh.onRoad = _surf.road;
      if (comp > 0) {
        wh.contact = true; anyContact = true;
        wh.comp = Math.min(comp, s.maxTravel + 0.08);
      } else { wh.contact = false; wh.comp = 0; }
      if (wh.left) compL += wh.comp; else compR += wh.comp;
      const wn = wh._n || (wh._n = [0, 0, 0]), wm = wh._m || (wh._m = [0, 0, 0]); // reused: no per-step garbage
      wn[0] = _surf.nx; wn[1] = _surf.ny; wn[2] = _surf.nz; wm[0] = mx; wm[1] = my; wm[2] = mz;
    }
    const arb = s.antiRoll * s.spring * (compL - compR) * 0.5;
    for (const wh of this.wheels) {
      if (!wh.contact) { wh.load = 0; wh.slipLat = 0; wh.slipLong = 0; wh.spin *= 0.995; continue; }
      const [nx, ny, nz] = wh._n;
      const [mx, my, mz] = wh._m;
      const compVel = (wh.comp - wh.prevComp) / dt;
      let Fs = s.spring * wh.comp + s.damper * compVel + (wh.left ? arb : -arb);
      if (wh.comp > s.maxTravel) Fs += (wh.comp - s.maxTravel) * s.spring * 12; // bump stop
      Fs = Math.max(0, Fs);
      wh.load = Fs;
      // contact point
      const cx = mx - ux * (wh.dist), cy = my - uy * (wh.dist), cz = mz - uz * (wh.dist);
      // suspension force along car up at mount
      addForceAt(F, T, pos, ux * Fs, uy * Fs, uz * Fs, mx, my, mz);
      // wheel direction
      const st = wh.front ? this.steerAngle * (1 + (wh.left === (this.steerAngle < 0) ? 0.08 : -0.04)) : 0;
      wh.steer = st;
      const cs = Math.cos(st), sn = Math.sin(st);
      // rotate forward around up by -st (positive steer = right)
      let wfx = fx * cs + rx * sn, wfy = fy * cs + ry * sn, wfz = fz * cs + rz * sn;
      // project onto surface plane
      const dn = wfx * nx + wfy * ny + wfz * nz; wfx -= nx * dn; wfy -= ny * dn; wfz -= nz * dn;
      const wl = Math.hypot(wfx, wfy, wfz) || 1; wfx /= wl; wfy /= wl; wfz /= wl;
      // right = f x n
      const wrx = wfy * nz - wfz * ny, wry = wfz * nx - wfx * nz, wrz = wfx * ny - wfy * nx;
      // contact velocity
      const ox = cx - pos.x, oy = cy - pos.y, oz = cz - pos.z;
      const vcx = vel.x + (w.y * oz - w.z * oy), vcy = vel.y + (w.z * ox - w.x * oz), vcz = vel.z + (w.x * oy - w.y * ox);
      const vLong = vcx * wfx + vcy * wfy + vcz * wfz;
      const vLat = vcx * wrx + vcy * wry + vcz * wrz;
      const mu = (MU[wh.surf] ?? 0.7) * (wh.front ? s.gripF : s.gripR);
      const Nload = Fs;
      const maxF = mu * Nload;
      // lateral
      const alpha = Math.atan2(vLat, Math.max(Math.abs(vLong), 1.5));
      const apk = 0.115;
      let lat = Math.min(Math.abs(alpha) / apk, 1);
      lat *= 1 - 0.22 * smooth(apk, apk + 0.55, Math.abs(alpha));
      let Flat = -Math.sign(alpha) * lat * maxF;
      const lowV = smooth(4, 1, Math.abs(vLong));
      if (lowV > 0) { const damp = -vLat * (Nload / G) / dt * 0.5; Flat = Flat * (1 - lowV) + Math.max(-maxF, Math.min(maxF, damp)) * lowV; }
      let hb = !wh.front && inp.handbrake > 0.5;
      if (hb) Flat *= 0.42;
      // longitudinal
      let Flong = 0;
      if (wh.driven) {
        const share = this.spec.drive === 'awd' ? (wh.front ? 0.4 : 0.6) * 0.5 : 0.5;
        Flong += (wheelTorqueTotal * share) / s.wheelRadius;
        if (revDrive > 0) Flong -= revDrive * 2600 * share;
      }
      const brakeIn = this.held ? 1 : this.reverse ? 0 : inp.brake;
      if (brakeIn > 0 && Math.abs(vLong) > 0.05) {
        const bf = s.brake * brakeIn * (wh.front ? 0.62 : 0.38) * 0.5;
        Flong -= Math.sign(vLong) * Math.min(bf, maxF * 0.98, Math.abs(vLong) * (this.mass * 0.25) / dt);
      }
      if (hb) Flong -= Math.sign(vLong) * Math.min(maxF * 0.75, Math.abs(vLong) * (this.mass * 0.25) / dt);
      // rolling resistance / off-road drag
      Flong -= Math.sign(vLong) * Math.min(Math.abs(vLong) * this.mass * 0.25 / dt, Nload * (ROLL_DRAG[wh.surf] ?? 0.05));
      // hold when stopped and no throttle
      if ((thr < 0.05 || this.held) && revDrive < 0.05 && Math.abs(vLong) < 0.4) Flong = -vLong * (this.mass * 0.25) / dt * 0.6;
      // traction / friction circle
      let demandLong = Flong;
      const tot = Math.hypot(Flong, Flat);
      let wheelSlip = 0;
      if (tot > maxF) {
        const k = maxF / tot;
        if (wh.driven && Math.abs(Flong) > maxF * 0.9) wheelSlip = Math.min(1, (Math.abs(demandLong) - maxF * 0.9) / (maxF + 1));
        Flong *= k; Flat *= k;
      }
      wh.slipLat = Math.abs(vLat); wh.slipLong = wheelSlip;
      slipAcc += Math.max(0, Math.abs(vLat) - 1.2) + wheelSlip * 6 + (hb ? Math.abs(vLong) * 0.2 : 0);
      // wheel spin (visual / rpm)
      const free = vLong / s.wheelRadius;
      const lock = (brakeIn > 0.95 && !wh.driven) || hb ? 0.15 : 1;
      wh.spin = free * lock + (wh.driven ? Math.sign(wheelTorqueTotal || 1) * wheelSlip * 45 : 0);
      wh.angle = (wh.angle + wh.spin * dt) % (Math.PI * 2);
      // apply tire force at a point raised towards the CoM (arcade roll reduction)
      const ax = cx * 0.55 + (pos.x - ux * 0.0) * 0.45, ay = cy * 0.55 + pos.y * 0.45, az = cz * 0.55 + pos.z * 0.45;
      const Fx = wfx * Flong + wrx * Flat, Fy = wfy * Flong + wry * Flat, Fz = wfz * Flong + wrz * Flat;
      addForceAt(F, T, pos, Fx, Fy, Fz, ax, ay, az);
      if (wh.surf === SURF.SAND || wh.surf === SURF.GRASS || wh.surf === SURF.GRAVEL || wh.surf === SURF.DIRT) scrapeSurf += Math.abs(vLong);
    }
    this.slip = slipAcc;
    this.offroad = scrapeSurf;
    this.airTime = anyContact ? 0 : this.airTime + dt;

    // ---- aero ----
    const sp = this.speed;
    const drag = 0.5 * 1.225 * s.cdA * sp;
    F.x -= vel.x * drag; F.y -= vel.y * drag; F.z -= vel.z * drag;
    const df = 0.5 * 1.225 * s.clA * sp * sp;
    F.x -= ux * df; F.y -= uy * df; F.z -= uz * df;

    // ---- body/ground contact (penalty) ----
    for (const b of this.body) {
      const px = pos.x + rx * b[0] + ux * b[1] - fx * b[2];
      const py = pos.y + ry * b[0] + uy * b[1] - fy * b[2];
      const pz = pos.z + rz * b[0] + uz * b[1] - fz * b[2];
      world.surface(px, pz, py + 1.0, _surf);
      const pen = _surf.y - py;
      if (pen > 0) {
        const ox = px - pos.x, oy = py - pos.y, oz = pz - pos.z;
        const vpx = vel.x + (w.y * oz - w.z * oy), vpy = vel.y + (w.z * ox - w.x * oz), vpz = vel.z + (w.x * oy - w.y * ox);
        const vn = vpx * _surf.nx + vpy * _surf.ny + vpz * _surf.nz;
        const Fn = Math.max(0, 260000 * pen - 18000 * vn);
        let tx = vpx - _surf.nx * vn, ty = vpy - _surf.ny * vn, tz = vpz - _surf.nz * vn;
        const tl = Math.hypot(tx, ty, tz);
        const Ff = tl > 0.01 ? Math.min(Fn * 0.45, tl * this.mass * 2) / tl : 0;
        addForceAt(F, T, pos, _surf.nx * Fn - tx * Ff, _surf.ny * Fn - ty * Ff, _surf.nz * Fn - tz * Ff, px, py, pz);
        if (pen > 0.25) { pos.x += _surf.nx * (pen - 0.25); pos.y += _surf.ny * (pen - 0.25); pos.z += _surf.nz * (pen - 0.25); }
        if (Fn > 15000 && b[1] < 0) this.events.push({ t: 'bottom', f: Fn });
      }
    }

    // ---- integrate ----
    vel.x += (F.x / this.mass) * dt; vel.y += (F.y / this.mass) * dt; vel.z += (F.z / this.mass) * dt;
    // angular: to local
    const tlx = T.x * rx + T.y * ry + T.z * rz, tly = T.x * ux + T.y * uy + T.z * uz, tlz = -(T.x * fx + T.y * fy + T.z * fz);
    const wlx = w.x * rx + w.y * ry + w.z * rz, wly = w.x * ux + w.y * uy + w.z * uz, wlz = -(w.x * fx + w.y * fy + w.z * fz);
    const I = this.Iloc;
    // gyroscopic term omitted for stability (arcade)
    let alx = tlx / I.x, aly = tly / I.y, alz = tlz / I.z;
    let nwx = wlx + alx * dt, nwy = wly + aly * dt, nwz = wlz + alz * dt;
    // damping (roll / pitch stronger)
    const dmp = anyContact ? 1 : 0.2;
    nwx *= 1 - 1.2 * dt * dmp; nwz *= 1 - 1.4 * dt * dmp; nwy *= 1 - 0.25 * dt * dmp;
    // back to world (local z axis = back = -f)
    w.x = rx * nwx + ux * nwy - fx * nwz; w.y = ry * nwx + uy * nwy - fy * nwz; w.z = rz * nwx + uz * nwy - fz * nwz;
    pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
    const wl = Math.hypot(w.x, w.y, w.z);
    if (wl > 1e-6) { _q.setFromAxisAngle(_v.set(w.x / wl, w.y / wl, w.z / wl), wl * dt); this.quat.premultiply(_q).normalize(); }

    this.brakeLight = (!this.reverse && inp.brake > 0.05) || inp.handbrake > 0.5 ? 1 : 0;
  }

  /** resolve against barrier segments and circles; returns impact info */
  collideStatic(world, dt) {
    const pos = this.pos, vel = this.vel, w = this.angVel;
    const f = this.forward(_v3); const hx = this.half.x, hz = this.half.z;
    const fx = f.x, fz = f.z; const fl = Math.hypot(fx, fz) || 1; const ffx = fx / fl, ffz = fz / fl; // planar forward
    const rrx = -ffz, rrz = ffx; // planar right
    const ids = _ids; world.barriers.near(pos.x, pos.z, hz + 2, ids);
    let hitAny = false;
    for (const id of ids) {
      const sg = world.barriers.segs[id];
      if (pos.y + 0.6 < sg.y0 || pos.y - 0.4 > sg.y1) continue;
      // closest point on segment to OBB: test OBB corners vs segment line and segment endpoints vs OBB
      const sx = sg.bx - sg.ax, sz = sg.bz - sg.az, L = sg.len || 1;
      const tx = sx / L, tz = sz / L; // tangent
      let nx = -tz, nz = tx; // normal
      // side of car center
      const side = (pos.x - sg.ax) * nx + (pos.z - sg.az) * nz;
      if (side < 0) { nx = -nx; nz = -nz; }
      // OBB support in -n direction
      const ext = Math.abs(rrx * nx + rrz * nz) * hx + Math.abs(ffx * nx + ffz * nz) * hz;
      const centerDist = Math.abs(side);
      const pen = ext - centerDist;
      if (pen <= 0) continue;
      // make sure the contact lies within the segment extent (project center onto segment)
      const along = (pos.x - sg.ax) * tx + (pos.z - sg.az) * tz;
      if (along < -ext || along > L + ext) continue;
      if (along < 0 || along > L) {
        // endpoint region: treat endpoint as point vs OBB
        const ex = along < 0 ? sg.ax : sg.bx, ez = along < 0 ? sg.az : sg.bz;
        const lx = (ex - pos.x) * rrx + (ez - pos.z) * rrz, lz = (ex - pos.x) * ffx + (ez - pos.z) * ffz;
        if (Math.abs(lx) > hx || Math.abs(lz) > hz) continue;
        const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
        if (px < pz) { nx = -Math.sign(lx) * rrx; nz = -Math.sign(lx) * rrz; this._resolve(nx, nz, px, ex, ez, sg, dt); }
        else { nx = -Math.sign(lz) * ffx; nz = -Math.sign(lz) * ffz; this._resolve(nx, nz, pz, ex, ez, sg, dt); }
        hitAny = true; continue;
      }
      // contact point: deepest OBB corner
      let best = null, bd = Infinity;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = pos.x + rrx * hx * a + ffx * hz * b, cz = pos.z + rrz * hx * a + ffz * hz * b;
        const d = (cx - sg.ax) * nx + (cz - sg.az) * nz;
        if (d < bd) { bd = d; best = [cx, cz]; }
      }
      this._resolve(nx, nz, pen, best[0], best[1], sg, dt);
      hitAny = true;
    }
    // circles (trunks, posts)
    const cids = _cids; world.circles.near(pos.x, pos.z, hz + 1, cids);
    for (const id of cids) {
      const c = world.circles.items[id];
      const lx = (c.x - pos.x) * rrx + (c.z - pos.z) * rrz, lz = (c.x - pos.x) * ffx + (c.z - pos.z) * ffz;
      const qx = Math.max(-hx, Math.min(hx, lx)), qz = Math.max(-hz, Math.min(hz, lz));
      const dx = lx - qx, dz = lz - qz; const d = Math.hypot(dx, dz);
      if (d >= c.r) continue;
      let nlx, nlz, pen;
      if (d > 1e-4) { nlx = -dx / d; nlz = -dz / d; pen = c.r - d; }
      else { const px = hx - Math.abs(lx), pz = hz - Math.abs(lz); if (px < pz) { nlx = -Math.sign(lx); nlz = 0; pen = px + c.r; } else { nlx = 0; nlz = -Math.sign(lz); pen = pz + c.r; } }
      const nx = nlx * rrx + nlz * ffx, nz = nlx * rrz + nlz * ffz;
      this._resolve(nx, nz, pen, pos.x + qx * rrx + qz * ffx, pos.z + qx * rrz + qz * ffz, { type: 'post' }, dt);
      hitAny = true;
    }
    if (!hitAny) this.scrape = Math.max(0, this.scrape - dt * 6);
    return hitAny;
  }

  _resolve(nx, nz, pen, cx, cz, sg, dt) {
    const pos = this.pos, vel = this.vel, w = this.angVel;
    pos.x += nx * pen; pos.z += nz * pen;
    const ox = cx - pos.x, oz = cz - pos.z, oy = 0;
    // velocity at contact
    const vcx = vel.x + (w.y * oz - w.z * oy), vcz = vel.z + (w.x * oy - w.y * ox);
    const vn = vcx * nx + vcz * nz;
    if (vn >= 0) return;
    // effective mass with yaw inertia
    const rxn = ox * nz - oz * nx; // (r x n).y
    const Iy = this.Iloc.y;
    const invM = 1 / this.mass + (rxn * rxn) / Iy;
    const e = 0.18;
    const j = (-(1 + e) * vn) / invM;
    vel.x += (j * nx) / this.mass; vel.z += (j * nz) / this.mass;
    w.y -= (rxn * j) / Iy;
    // friction along tangent
    const tx = -nz, tz = nx;
    const vt = vcx * tx + vcz * tz;
    const jt = Math.max(-Math.abs(j) * 0.35, Math.min(Math.abs(j) * 0.35, -vt / invM));
    vel.x += (jt * tx) / this.mass; vel.z += (jt * tz) / this.mass;
    const impactSpeed = -vn;
    if (impactSpeed > 1.2) this.events.push({ t: 'impact', v: impactSpeed, kind: sg.type || 'wall', x: cx, z: cz });
    this.scrape = Math.min(1, this.scrape + dt * 10) ;
    this.scrapeSpeed = Math.abs(vt);
    this.lastContactType = sg.type;
  }
}

const _force = new THREE.Vector3(), _torque = new THREE.Vector3(), _m4 = new THREE.Matrix4();
const _ids = [], _cids = [];

function addForceAt(F, T, pos, fx, fy, fz, px, py, pz) {
  F.x += fx; F.y += fy; F.z += fz;
  const rx = px - pos.x, ry = py - pos.y, rz = pz - pos.z;
  T.x += ry * fz - rz * fy; T.y += rz * fx - rx * fz; T.z += rx * fy - ry * fx;
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** car vs car (2D OBB SAT) impulse resolution */
export function collideCars(A, B) {
  const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z;
  if (dx * dx + dz * dz > 36) return null;
  if (Math.abs(A.pos.y - B.pos.y) > 1.6) return null;
  const fa = A.forward(_fa), fb = B.forward(_fb);
  const la = Math.hypot(fa.x, fa.z) || 1, lb = Math.hypot(fb.x, fb.z) || 1;
  const af = [fa.x / la, fa.z / la], ar = [-af[1], af[0]];
  const bf = [fb.x / lb, fb.z / lb], br = [-bf[1], bf[0]];
  const axes = [ar, af, br, bf];
  let minPen = Infinity, nAxis = null;
  for (const ax of axes) {
    const ra = Math.abs(ar[0] * ax[0] + ar[1] * ax[1]) * A.half.x + Math.abs(af[0] * ax[0] + af[1] * ax[1]) * A.half.z;
    const rb = Math.abs(br[0] * ax[0] + br[1] * ax[1]) * B.half.x + Math.abs(bf[0] * ax[0] + bf[1] * ax[1]) * B.half.z;
    const d = dx * ax[0] + dz * ax[1];
    const pen = ra + rb - Math.abs(d);
    if (pen <= 0) return null;
    if (pen < minPen) { minPen = pen; nAxis = d > 0 ? [ax[0], ax[1]] : [-ax[0], -ax[1]]; }
  }
  // push apart (n from A to B)
  const [nx, nz] = nAxis;
  const tm = A.mass + B.mass;
  A.pos.x -= nx * minPen * (B.mass / tm); A.pos.z -= nz * minPen * (B.mass / tm);
  B.pos.x += nx * minPen * (A.mass / tm); B.pos.z += nz * minPen * (A.mass / tm);
  // contact point approx: midpoint between centers shifted
  const cx = (A.pos.x + B.pos.x) / 2, cz = (A.pos.z + B.pos.z) / 2;
  const rax = cx - A.pos.x, raz = cz - A.pos.z, rbx = cx - B.pos.x, rbz = cz - B.pos.z;
  const va = [A.vel.x + A.angVel.y * raz, A.vel.z - A.angVel.y * rax];
  const vb = [B.vel.x + B.angVel.y * rbz, B.vel.z - B.angVel.y * rbx];
  const rvn = (vb[0] - va[0]) * nx + (vb[1] - va[1]) * nz;
  if (rvn >= 0) return { pen: minPen, v: 0 };
  const raxn = rax * nz - raz * nx, rbxn = rbx * nz - rbz * nx;
  const invM = 1 / A.mass + 1 / B.mass + (raxn * raxn) / A.Iloc.y + (rbxn * rbxn) / B.Iloc.y;
  const e = 0.25;
  const j = (-(1 + e) * rvn) / invM;
  A.vel.x -= (j * nx) / A.mass; A.vel.z -= (j * nz) / A.mass;
  B.vel.x += (j * nx) / B.mass; B.vel.z += (j * nz) / B.mass;
  A.angVel.y += (raxn * j) / A.Iloc.y * 0.6; B.angVel.y -= (rbxn * j) / B.Iloc.y * 0.6;
  // friction
  const tx = -nz, tz = nx;
  const rvt = (vb[0] - va[0]) * tx + (vb[1] - va[1]) * tz;
  const jt = Math.max(-j * 0.3, Math.min(j * 0.3, -rvt / (1 / A.mass + 1 / B.mass)));
  A.vel.x -= (jt * tx) / A.mass; A.vel.z -= (jt * tz) / A.mass;
  B.vel.x += (jt * tx) / B.mass; B.vel.z += (jt * tz) / B.mass;
  const imp = -rvn;
  if (imp > 0.8) { A.events.push({ t: 'impact', v: imp, kind: 'car', x: cx, z: cz }); B.events.push({ t: 'impact', v: imp, kind: 'car', x: cx, z: cz }); }
  return { pen: minPen, v: imp };
}
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3();
