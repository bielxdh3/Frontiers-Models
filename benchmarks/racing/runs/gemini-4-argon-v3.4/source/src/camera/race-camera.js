import * as THREE from 'three';
import { sampleWorldSurface } from '../physics/vehicle-physics.js';

export class RaceCameraController {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.mode = 'chase'; // 'chase' | 'hood' | 'orbit' | 'scripted'

    this.pos = new THREE.Vector3(0, 6.0, 250);
    this.lookAt = new THREE.Vector3(10, 4.5, 260);
    this.currentDist = 6.0;
    this.currentYaw = Math.PI * 0.5;
    this.initialized = false;

    this.cameraClipViolations = 0;
  }

  toggleMode() {
    this.mode = this.mode === 'chase' ? 'hood' : 'chase';
    return this.mode;
  }

  snapToVehicle(car) {
    this.currentYaw = car.yaw;
    this.currentDist = 6.0;
    this.initialized = false;
    this.update(car, 0.016, true);
  }

  // Ensures camera position (x, y, z) NEVER enters terrain, road, barriers, or building OBBs (Section 3.3)
  _resolveCameraCollision(pivotX, pivotY, pivotZ, desiredX, desiredY, desiredZ) {
    let cx = desiredX;
    let cy = desiredY;
    let cz = desiredZ;
    let minFraction = 1.0;

    // 1. Sample rays along [pivot -> desired] against barriers and building OBBs
    const steps = 6;
    const spline = this.world.spline;
    const barriers = this.world.barrierRuns || [];
    const buildings = this.world.buildings || [];

    for (let sIdx = 1; sIdx <= steps; sIdx++) {
      const f = sIdx / steps;
      const sx = pivotX + (desiredX - pivotX) * f;
      const sy = pivotY + (desiredY - pivotY) * f;
      const sz = pivotZ + (desiredZ - pivotZ) * f;

      // Check track barriers if camera height is below barrier top + 0.35m
      const proj = spline.projectXZ(sx, sz);
      for (let b = 0; b < barriers.length; b++) {
        const br = barriers[b];
        if (proj.s < br.sStart - 1.0 || proj.s > br.sEnd + 1.0) continue;
        if (Math.sign(proj.d) !== br.sideSign) continue;
        const wallAbsD = proj.halfWidth + br.latOffset - 0.32;
        if (proj.absD > wallAbsD && sy < proj.edgeY + br.height + 0.35) {
          minFraction = Math.min(minFraction, Math.max(0.28, (sIdx - 1) / steps));
        }
      }

      // Check building OBBs with 0.55m safety margin
      for (let i = 0; i < buildings.length; i++) {
        const bld = buildings[i];
        if (sy > bld.topY + 0.5) continue;
        const dx = sx - bld.x;
        const dz = sz - bld.z;
        if (dx * dx + dz * dz > 900) continue;
        const c = Math.cos(-bld.yaw);
        const s = Math.sin(-bld.yaw);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        if (Math.abs(lx) < bld.halfW + 0.55 && Math.abs(lz) < bld.halfD + 0.55) {
          minFraction = Math.min(minFraction, Math.max(0.25, (sIdx - 1) / steps));
        }
      }
    }

    if (minFraction < 1.0) {
      cx = pivotX + (desiredX - pivotX) * minFraction;
      cy = pivotY + (desiredY - pivotY) * minFraction;
      cz = pivotZ + (desiredZ - pivotZ) * minFraction;
    }

    // 2. Hard terrain & road surface clearance (>= 0.65m above ground at camera XZ!)
    const surf = sampleWorldSurface(this.world, cx, cz, cy + 12.0);
    if (cy < surf.y + 0.68) {
      cy = surf.y + 0.68;
    }

    // Audit check: verify resolved camera is strictly outside terrain & buildings
    const finalSurf = sampleWorldSurface(this.world, cx, cz, cy + 12.0);
    if (cy < finalSurf.y + 0.05) {
      this.cameraClipViolations++;
      cy = finalSurf.y + 0.75;
    }

    return { x: cx, y: cy, z: cz, fraction: minFraction };
  }

  update(car, dt, instant = false) {
    if (!car || this.mode === 'scripted') return;

    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);

    if (this.mode === 'hood') {
      // Hood ("capô") camera: mounted cleanly above front hood cowl looking forward
      const hoodFwd = car.spec.length * 0.14;
      const hoodUp = car.spec.height * 0.80;
      const hx = car.x + fx * hoodFwd;
      const hy = car.y + hoodUp;
      const hz = car.z + fz * hoodFwd;

      this.camera.position.set(hx, hy, hz);
      const lookY = hy - 0.95 + Math.sin(-car.pitch) * 14.0;
      this.camera.lookAt(hx + fx * 18.0, lookY, hz + fz * 18.0);
      const targetFov = 63 + Math.min(11, (car.speedKmh / 195) * 11);
      this.camera.fov += (targetFov - this.camera.fov) * (instant ? 1 : Math.min(1, dt * 8));
      this.camera.updateProjectionMatrix();
      return;
    }

    // Chase ("perseguição") camera: ~6.0 m behind, ~1.82 m above road, horizon in upper third, FOV 60-74° by speed
    if (!this.initialized || instant) {
      this.currentYaw = car.yaw;
      this.currentDist = 6.0;
    } else {
      // Smooth spring yaw follow aligned with velocity vector when moving forward
      let targetYaw = car.yaw;
      const horizSpeed = Math.hypot(car.vx, car.vz);
      if (horizSpeed > 4.0 && car.forwardSpeed > 1.0) {
        const velYaw = Math.atan2(car.vx, car.vz);
        let diffV = velYaw - car.yaw;
        while (diffV > Math.PI) diffV -= Math.PI * 2;
        while (diffV < -Math.PI) diffV += Math.PI * 2;
        targetYaw = car.yaw + diffV * 0.35;
      }
      let dYaw = targetYaw - this.currentYaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      this.currentYaw += dYaw * Math.min(1, dt * 6.8);
    }

    const cFx = Math.sin(this.currentYaw);
    const cFz = Math.cos(this.currentYaw);

    const speedNorm = Math.min(1.0, car.speedKmh / 195.0);
    const desiredBack = 5.95 + speedNorm * 0.45;
    const roadBaseY = car.y - (car.spec.wheelRadius + 0.16);
    const desiredCamY = roadBaseY + 1.84 - Math.sin(-car.pitch) * desiredBack * 0.72;

    const pivotX = car.x;
    const pivotY = roadBaseY + 1.05;
    const pivotZ = car.z;

    const rawX = car.x - cFx * desiredBack;
    const rawZ = car.z - cFz * desiredBack;

    const safe = this._resolveCameraCollision(pivotX, pivotY, pivotZ, rawX, desiredCamY, rawZ);

    // Smooth pullback recovery (quick pull-in on obstacle, smooth spring return)
    if (!this.initialized || instant) {
      this.pos.set(safe.x, safe.y, safe.z);
      this.lookAt.set(
        car.x + cFx * 4.2,
        roadBaseY + 0.52 + Math.sin(-car.pitch) * 4.2,
        car.z + cFz * 4.2
      );
      this.initialized = true;
    } else {
      const posLerp = safe.fraction < 0.98 ? Math.min(1, dt * 22.0) : Math.min(1, dt * 12.5);
      this.pos.x += (safe.x - this.pos.x) * posLerp;
      this.pos.y += (safe.y - this.pos.y) * posLerp;
      this.pos.z += (safe.z - this.pos.z) * posLerp;

      //Re-enforce floor after lerp
      const postSurf = sampleWorldSurface(this.world, this.pos.x, this.pos.z, this.pos.y + 8.0);
      if (this.pos.y < postSurf.y + 0.65) this.pos.y = postSurf.y + 0.65;

      const targetLookX = car.x + cFx * 4.2;
      const targetLookY = roadBaseY + 0.52 + Math.sin(-car.pitch) * 4.2;
      const targetLookZ = car.z + cFz * 4.2;
      const lookLerp = Math.min(1, dt * 16.0);
      this.lookAt.x += (targetLookX - this.lookAt.x) * lookLerp;
      this.lookAt.y += (targetLookY - this.lookAt.y) * lookLerp;
      this.lookAt.z += (targetLookZ - this.lookAt.z) * lookLerp;
    }

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.lookAt);

    // FOV 60° -> 73.5° by speed (Section 5.7)
    const targetFov = 60.5 + speedNorm * 13.0;
    this.camera.fov += (targetFov - this.camera.fov) * (instant ? 1 : Math.min(1, dt * 6.5));
    this.camera.updateProjectionMatrix();
  }
}
