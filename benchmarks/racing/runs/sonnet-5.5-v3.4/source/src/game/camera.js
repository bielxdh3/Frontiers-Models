// Camera rig: chase (6 m back, 1.8 m up, horizon in the upper third, speed-dependent FOV, spring), bonnet, live menu flyby,
// grid presentation sweep, garage turntable. The camera never enters terrain/walls (lateral barrier clamp + ground clearance).
import * as THREE from 'three';

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

export class CameraRig {
  constructor(camera, world) {
    this.cam = camera; this.world = world; this.T = world.track;
    this.mode = 'menu';
    this.yaw = 0; this.pos = new THREE.Vector3(); this.inited = false; this.fov = 65; this.shake = 0; this.t = 0;
    this.v3 = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.gq = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
    this.gtmp = { y: 0, nx: 0, ny: 1, nz: 0, surf: 0, mu: 1, rr: 0, drag: 0, i: 0, lat: 0, s: 0 };
    this.hint = -1; this.violations = 0; this.minClear = 1e9; this.lookTarget = new THREE.Vector3();
    this.manual = null;
  }

  setMode(m) { this.mode = m; this.inited = false; this.t = 0; }

  /** keep a world position out of terrain, walls and houses (everything outside the barrier line) */
  _constrain(p, margin = 0.7) {
    const T = this.T, q = T.nearest(p.x, p.z, 200, this.hint, this.gq);
    this.hint = q.i;
    const side = q.lat < 0 ? -1 : 1, i = q.i;
    const type = side < 0 ? T.barL[i] : T.barR[i], off = side < 0 ? T.barOffL[i] : T.barOffR[i];
    let moved = false;
    if (type && Math.abs(q.lat) > off - 0.45) {
      const target = off - 0.45, delta = (Math.abs(q.lat) - target);
      p.x -= side * T.rx[i] * delta; p.z -= side * T.rz[i] * delta; moved = true;
    }
    this.world.ground.query(p.x, p.z, this.hint, this.gtmp);
    const gy = this.gtmp.y;
    if (p.y < gy + margin) { p.y = gy + margin; moved = true; }
    this.minClear = Math.min(this.minClear, p.y - gy);
    return moved;
  }

  /** @param ctx {dt, car (Vehicle), speed, latG, lookAhead, flyCar, grid:{...}} */
  update(dt, ctx) {
    this.t += dt;
    const cam = this.cam;
    if (this.manual) { cam.position.copy(this.manual.pos); cam.lookAt(this.manual.target); if (cam.fov !== this.manual.fov) { cam.fov = this.manual.fov; cam.updateProjectionMatrix(); } return; }
    switch (this.mode) {
      case 'chase': this._chase(dt, ctx); break;
      case 'hood': this._hood(dt, ctx); break;
      case 'menu': this._menu(dt, ctx); break;
      case 'grid': this._grid(dt, ctx); break;
      case 'garage': this._garage(dt, ctx); break;
    }
    if (Math.abs(cam.fov - this.fov) > 0.02) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }

  _look(pos, yaw, pitch, roll = 0) {
    const cam = this.cam; cam.position.copy(pos);
    this.e.set(pitch, -yaw, roll, 'YXZ'); cam.quaternion.setFromEuler(this.e);
  }

  _chase(dt, { car }) {
    const v = car, f = v.forward, speed = Math.max(0, v.speed);
    const heading = Math.atan2(f[0], -f[2]);
    let vyaw = heading;
    if (speed > 5) vyaw = Math.atan2(v.v[0], -v.v[2]);
    const diff = Math.max(-0.55, Math.min(0.55, wrap(vyaw - heading)));
    const targetYaw = heading + diff * 0.5;
    if (!this.inited) { this.yaw = targetYaw; this.fov = 66; }
    this.yaw += wrap(targetYaw - this.yaw) * (1 - Math.exp(-dt * 6.5));
    const dist = 6.0 + Math.min(1.3, speed * 0.02), h = 1.78 + Math.min(0.2, speed * 0.003);
    const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const want = this.v3.set(v.p[0] - fx * dist, v.p[1] - 0.2 + h, v.p[2] - fz * dist);
    if (!this.inited) { this.pos.copy(want); this.inited = true; }
    else {
      const kh = 1 - Math.exp(-dt * 18), kv = 1 - Math.exp(-dt * 9);
      this.pos.x += (want.x - this.pos.x) * kh; this.pos.z += (want.z - this.pos.z) * kh; this.pos.y += (want.y - this.pos.y) * kv;
    }
    this._constrain(this.pos, 0.75);
    // pitch: horizon in the upper third (~12 deg down), tiny dynamic pitch on throttle/brake; roll from lateral g
    const pitch = -0.215 - (v.longG || 0) * 0.02;
    const roll = -(v.latG || 0) * 0.018;
    this.shake *= Math.exp(-dt * 6);
    const sh = this.shake;
    this._look(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh)), this.yaw, pitch, roll);
    this.fov += (62 + Math.min(14, speed * 0.24) - this.fov) * (1 - Math.exp(-dt * 4));
  }

  _hood(dt, { car }) {
    const v = car, p = [0, 0, 0];
    v.local(0, 0.52, -1.05, p);
    this.v3.set(p[0], p[1], p[2]);
    this.cam.position.copy(this.v3);
    this.cam.quaternion.set(v.q[0], v.q[1], v.q[2], v.q[3]);
    this.q.setFromEuler(this.e.set(-0.03, 0, 0, 'YXZ')); this.cam.quaternion.multiply(this.q);
    this.fov += (76 + Math.min(8, Math.max(0, v.speed) * 0.12) - this.fov) * (1 - Math.exp(-dt * 4));
    this.inited = true;
  }

  _menu(dt, { flyCar }) {
    const T = this.T;
    // orbit around the lead car of the live background race, slowly changing azimuth/height
    const car = flyCar;
    const a = this.t * 0.11 + 0.8, r = 15 + 8 * Math.sin(this.t * 0.07), h = 3.2 + 3.2 * (0.5 + 0.5 * Math.sin(this.t * 0.05));
    const px = car ? car.p[0] : T.px[0], py = car ? car.p[1] : T.py[0], pz = car ? car.p[2] : T.pz[0];
    const f = car ? car.forward : [-1, 0, 0];
    const heading = Math.atan2(f[0], -f[2]);
    const az = heading + Math.PI + 0.9 * Math.sin(a);
    const want = new THREE.Vector3(px + Math.sin(az) * r, py + h, pz - Math.cos(az) * r);
    if (!this.inited) { this.pos.copy(want); this.inited = true; this.lookTarget.set(px, py + 0.8, pz); }
    this.pos.lerp(want, 1 - Math.exp(-dt * 2.2));
    this._constrain(this.pos, 1.0);
    this.lookTarget.lerp(new THREE.Vector3(px + f[0] * 4, py + 0.9, pz + f[2] * 4), 1 - Math.exp(-dt * 3));
    this.cam.position.copy(this.pos); this.cam.lookAt(this.lookTarget);
    this.fov += (52 - this.fov) * (1 - Math.exp(-dt * 3));
  }

  _grid(dt, { gridCars, player }) {
    // sweep: from ahead of the pole row, low, looking back at the pack -> sliding back towards the player, ending behind it
    const T = this.T, L = T.length, k = smooth(this.t / 4.6);
    const sA = L - 4, sB = (player ? player.sTrack : L - 40) - 9.0;
    const s = sA + (sB - sA) * k;
    const i = T.indexAtS(s);
    const lat = (1 - k) * 5.2 + k * 0.0;
    const p = T.roadPoint(i, lat, 0);
    const h = 1.05 + 1.0 * k;
    const pos = new THREE.Vector3(p.x, p.y + h, p.z);
    const tgt = new THREE.Vector3();
    if (player) tgt.set(player.v.p[0], player.v.p[1] + 0.4, player.v.p[2]);
    // look at the pack centre first, then the player
    let cx = 0, cy = 0, cz = 0, n = 0; for (const c of gridCars || []) { cx += c.v.p[0]; cy += c.v.p[1]; cz += c.v.p[2]; n++; }
    if (n) { cx /= n; cy /= n; cz /= n; tgt.lerp(new THREE.Vector3(cx, cy + 0.4, cz), 1 - k); }
    this.cam.position.copy(pos); this.cam.lookAt(tgt);
    this.fov += (44 + 22 * k - this.fov) * (1 - Math.exp(-dt * 5));
    this.inited = true;
  }

  _garage(dt, { turntable }) {
    const c = turntable || { x: 0, y: 0, z: 0, yaw: 0 };
    const r = 6.8 + 0.5 * Math.sin(this.t * 0.4), a = c.yaw + Math.PI + 0.55;
    const pos = new THREE.Vector3(c.x + Math.sin(a) * r, c.y + 1.05 + 0.25 * Math.sin(this.t * 0.3), c.z - Math.cos(a) * r);
    this.cam.position.copy(pos); this.cam.lookAt(c.x, c.y + 0.75, c.z);
    this.fov = 36; this.inited = true;
  }

  impact(k) { this.shake = Math.max(this.shake, Math.min(0.14, k * 0.18)); }
}
