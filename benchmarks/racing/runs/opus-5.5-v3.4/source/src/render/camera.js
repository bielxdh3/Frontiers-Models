// Chase camera (~6 m behind, ~1.8 m above, speed-based FOV, spring) and hood
// camera, with collision against terrain, barriers and houses (smooth pull-in).
import * as THREE from 'three';

const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3();

export class CarCamera {
  constructor(camera, world) {
    this.camera = camera; this.world = world;
    this.mode = 'chase';
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.heading = 0; this.pull = 1; this.fov = 62; this.initialized = false;
    this.lag = new THREE.Vector3();
    this.shake = 0;
    this.insideGeometry = 0; // counter for tests
    this.houseBoxes = []; // filled by scatter: {cx, cz, hx, hz, ang, y0, y1}
  }
  reset() { this.initialized = false; }

  update(dt, car, interp) {
    const cam = this.camera;
    const p = interp.pos, q = interp.quat;
    const f = _f.set(0, 0, -1).applyQuaternion(q);
    const fh = Math.hypot(f.x, f.z) || 1;
    const targetHeading = Math.atan2(f.z / fh, f.x / fh);
    const v = car.vel;
    const speed = Math.hypot(v.x, v.z);
    if (!this.initialized) { this.heading = targetHeading; this.pos.set(0, 0, 0); this.initialized = true; this.pull = 1; }
    // blend heading towards velocity direction at speed (drift reads better)
    let velHeading = targetHeading;
    if (speed > 6) velHeading = Math.atan2(v.z, v.x);
    let dh = angDiff(this.heading, lerpAngle(targetHeading, velHeading, 0.35));
    this.heading += dh * (1 - Math.exp(-dt * 7.5));
    const hx = Math.cos(this.heading), hz = Math.sin(this.heading);

    if (this.mode === 'hood') {
      const up = _u.set(0, 1, 0).applyQuaternion(q);
      cam.position.set(p.x + f.x * 0.55 + up.x * 0.98, p.y + f.y * 0.55 + up.y * 0.98, p.z + f.z * 0.55 + up.z * 0.98);
      _t.set(cam.position.x + f.x * 20, cam.position.y + f.y * 20 + up.y * 0.0, cam.position.z + f.z * 20);
      cam.up.copy(up);
      cam.lookAt(_t);
      this.fov += (66 + Math.min(1, speed / 70) * 8 - this.fov) * (1 - Math.exp(-dt * 3));
      cam.fov = this.fov; cam.near = 0.08; cam.updateProjectionMatrix();
      return;
    }
    cam.up.set(0, 1, 0);
    const dist = 6.0, height = 1.8;
    // acceleration lag (spring in car frame)
    const desired = _d.set(p.x - hx * dist, p.y + height, p.z - hz * dist);
    // camera collision: pull in along the line car->camera
    const anchor = _t.set(p.x, p.y + 1.1, p.z);
    const clear = this._clearance(anchor, desired);
    this.pull += (clear - this.pull) * (1 - Math.exp(-dt * (clear < this.pull ? 14 : 3)));
    desired.lerpVectors(anchor, desired, this.pull);
    // keep above ground
    const g = this.world.groundHeight(desired.x, desired.z, desired.y + 3);
    if (desired.y < g + 0.6) desired.y = g + 0.6;
    if (this.pos.lengthSq() === 0) this.pos.copy(desired);
    const k = 1 - Math.exp(-dt * 12);
    this.pos.x += (desired.x - this.pos.x) * k; this.pos.z += (desired.z - this.pos.z) * k;
    this.pos.y += (desired.y - this.pos.y) * (1 - Math.exp(-dt * 6));
    const g2 = this.world.groundHeight(this.pos.x, this.pos.z, this.pos.y + 3);
    if (this.pos.y < g2 + 0.45) { this.pos.y = g2 + 0.45; }
    cam.position.copy(this.pos);
    // look target slightly ahead of the car -> horizon in the upper third
    this.look.set(p.x + hx * 5.0, p.y + 0.95, p.z + hz * 5.0);
    cam.lookAt(this.look);
    const targetFov = 60 + Math.min(1, speed / 72) * 14;
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-dt * 2.5));
    cam.fov = this.fov; cam.near = 0.15; cam.updateProjectionMatrix();
    // invariant: camera never inside terrain / houses
    if (this.pos.y < g2 + 0.2 || this._insideHouse(this.pos)) this.insideGeometry++;
  }

  _clearance(a, b) {
    // returns fraction [0.25, 1] of the segment a->b free of geometry
    let best = 1;
    const N = 10;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      const gh = this.world.groundHeight(x, z, y + 4);
      if (gh > y - 0.35) { best = Math.min(best, Math.max(0.25, (i - 1) / N)); break; }
      const q = this._q || (this._q = { x: 0, y: 0, z: 0 }); q.x = x; q.y = y; q.z = z;
      if (this._insideHouse(q, 0.6)) { best = Math.min(best, Math.max(0.25, (i - 1) / N)); break; }
    }
    // barriers that are taller than the camera path (street walls)
    const segs = this.world.collision.barriers;
    const ids = _ids; segs.near((a.x + b.x) / 2, (a.z + b.z) / 2, 5, ids);
    for (const id of ids) {
      const s = segs.segs[id];
      if (s.y1 < Math.min(a.y, b.y) - 0.2) continue;
      const t = segIntersect(a.x, a.z, b.x, b.z, s.ax, s.az, s.bx, s.bz);
      if (t !== null) {
        const yAt = a.y + (b.y - a.y) * t;
        if (yAt < s.y1 + 0.3) best = Math.min(best, Math.max(0.25, t - 0.08));
      }
    }
    return best;
  }
  _insideHouse(p, margin = 0) {
    for (const h of this.houseBoxes) {
      const dx = p.x - h.cx, dz = p.z - h.cz;
      if (Math.abs(dx) > h.r + margin + 1 || Math.abs(dz) > h.r + margin + 1) continue;
      const c = Math.cos(h.ang), s = Math.sin(h.ang);
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (Math.abs(lx) < h.hx + margin && Math.abs(lz) < h.hz + margin && p.y > h.y0 && p.y < h.y1 + margin) return true;
    }
    return false;
  }
}
const _ids = [];
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function lerpAngle(a, b, t) { return a + angDiff(a, b) * t; }
function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz;
  const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
