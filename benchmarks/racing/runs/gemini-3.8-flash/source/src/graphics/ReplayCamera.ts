/**
 * ReplayCamera.ts
 * Implements the 3 required replay camera perspectives:
 * 1. Dynamic Chase (sweeping cinematic framing)
 * 2. Bumper / Hood (low asphalt perspective)
 * 3. Trackside / Broadcast (fixed roadside vantage points & aerial TV cameras)
 */

import * as THREE from 'three';
import { Vehicle } from '../gameplay/Vehicle';
import { ReplayCameraMode } from '../gameplay/ReplayPlayer';
import { Track } from '../world/Track';

export class ReplayCamera {
  public camera: THREE.PerspectiveCamera;
  private currentPos = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();

  // Trackside tower stations
  private currentTowerIndex = 0;
  private towerSwitchTimer = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  }

  public update(
    dt: number,
    mode: ReplayCameraMode,
    playerCar: Vehicle,
    track: Track
  ): void {
    const pos = playerCar.position;
    const fwd = playerCar.forward;

    if (mode === 'bumper') {
      // 1. Low Bumper / Hood Camera
      const bumperPos = pos.clone().add(fwd.clone().multiplyScalar(1.2));
      bumperPos.y += 0.65;
      this.camera.position.copy(bumperPos);

      const lookTarget = pos.clone().add(fwd.clone().multiplyScalar(25.0));
      lookTarget.y += 0.65;
      this.camera.lookAt(lookTarget);
      this.camera.fov = 72;
      this.camera.updateProjectionMatrix();

    } else if (mode === 'broadcast') {
      // 2. Trackside / Broadcast TV Camera
      const trackDist = playerCar.currentDistanceAlongTrack;
      const nearestCheckpoint = Math.floor((trackDist / track.totalLength) * track.checkpoints.length) % track.checkpoints.length;

      // Select roadside tower near upcoming checkpoint
      const cp = track.checkpoints[nearestCheckpoint];
      const towerPos = cp.position.clone();
      const right = new THREE.Vector3().crossVectors(cp.direction, new THREE.Vector3(0, 1, 0)).normalize();
      towerPos.add(right.multiplyScalar(16.0));
      towerPos.y += 8.0; // Elevated camera tower

      this.currentPos.lerp(towerPos, Math.min(1.0, 3.5 * dt));
      this.camera.position.copy(this.currentPos);

      // Track the player car smoothly
      const targetLook = pos.clone();
      targetLook.y += 0.8;
      this.currentLookAt.lerp(targetLook, Math.min(1.0, 8.0 * dt));
      this.camera.lookAt(this.currentLookAt);

      // Dynamic zoom based on distance to car
      const distToCar = this.camera.position.distanceTo(pos);
      this.camera.fov = Math.max(30, Math.min(65, 800 / Math.max(10, distToCar)));
      this.camera.updateProjectionMatrix();

    } else {
      // 3. Dynamic Cinematic Chase
      const behind = fwd.clone().multiplyScalar(-8.0);
      const targetPos = pos.clone().add(behind);
      targetPos.y += 3.2;

      this.currentPos.lerp(targetPos, Math.min(1.0, 6.0 * dt));
      this.camera.position.copy(this.currentPos);

      const targetLook = pos.clone().add(fwd.clone().multiplyScalar(10.0));
      targetLook.y += 1.0;
      this.currentLookAt.lerp(targetLook, Math.min(1.0, 7.0 * dt));
      this.camera.lookAt(this.currentLookAt);

      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
    }
  }
}
