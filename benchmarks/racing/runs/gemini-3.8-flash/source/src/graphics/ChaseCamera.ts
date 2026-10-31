/**
 * ChaseCamera.ts
 * Smooth third-person chase camera for active driving:
 * - Frames the road ahead with velocity lookahead
 * - Dynamic FOV expansion on nitro activation
 * - Gentle drift angle swing
 * - Reduced motion support (clamps shake and abrupt FOV leaps)
 */

import * as THREE from 'three';
import { Vehicle } from '../gameplay/Vehicle';

export class ChaseCamera {
  public camera: THREE.PerspectiveCamera;
  private currentPos = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();
  private baseFov = 65;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.1, 1500);
  }

  public reset(vehicle: Vehicle): void {
    const behind = vehicle.forward.clone().multiplyScalar(-7.0);
    this.currentPos.copy(vehicle.position).add(behind);
    this.currentPos.y += 2.6;

    this.currentLookAt.copy(vehicle.position).add(vehicle.forward.clone().multiplyScalar(12.0));
    this.currentLookAt.y += 1.0;

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public update(dt: number, vehicle: Vehicle, reducedMotion = false): void {
    const speedRatio = Math.min(1.0, vehicle.speedKmh / 230);

    // Target Camera Offset behind vehicle
    const distanceBehind = 6.8 + speedRatio * 1.5;
    const heightAbove = 2.4 + speedRatio * 0.4;

    // Follow vehicle orientation smoothly
    const behind = vehicle.forward.clone().multiplyScalar(-distanceBehind);
    const targetPos = vehicle.position.clone().add(behind);
    targetPos.y += heightAbove;

    // Gentle drift swing
    if (vehicle.isDrifting && !reducedMotion) {
      const swing = vehicle.right.clone().multiplyScalar(-vehicle.driftAngle * 1.8);
      targetPos.add(swing);
    }

    // Position interpolation
    const posLerp = reducedMotion ? 12.0 : 8.5;
    this.currentPos.lerp(targetPos, Math.min(1.0, posLerp * dt));
    this.camera.position.copy(this.currentPos);

    // Target Look-at ahead of car
    const lookAheadDist = 12.0 + speedRatio * 10.0;
    const targetLookAt = vehicle.position.clone().add(vehicle.forward.clone().multiplyScalar(lookAheadDist));
    targetLookAt.y += 1.1;

    this.currentLookAt.lerp(targetLookAt, Math.min(1.0, 10.0 * dt));
    this.camera.lookAt(this.currentLookAt);

    // Dynamic FOV boost on nitro
    let targetFov = this.baseFov;
    if (vehicle.isNitroActive && !reducedMotion) {
      targetFov += 12;
    }
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, 8.0 * dt);
    this.camera.updateProjectionMatrix();
  }
}
