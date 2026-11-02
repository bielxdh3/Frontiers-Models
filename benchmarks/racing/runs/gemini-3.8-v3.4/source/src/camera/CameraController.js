// src/camera/CameraController.js
// Chase & Hood cameras with dynamic speed-dependent FOV, smooth damped spring,
// collision avoidance against terrain/geometry, and cinematic grid presentation.

import * as THREE from 'three';

export class CameraController {
  constructor(camera, worldGen) {
    this.camera = camera;
    this.worldGen = worldGen;

    this.mode = 'chase'; // 'chase', 'hood', 'cinematic'
    this.target = null; // VehiclePhysics

    // Chase camera parameters (Section 5.7: ~6m behind, ~1.8m above, horizon in upper third)
    this.chaseDistance = 6.0;
    this.chaseHeight = 1.75;
    this.lookAheadHeight = 1.65;
    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();

    // Dynamic FOV
    this.baseFov = 62.0;
    this.maxFov = 75.0;

    // Cinematic grid presentation
    this.cinematicTime = 0;
    this.isCinematic = false;
  }

  setTarget(vehiclePhysics) {
    this.target = vehiclePhysics;
    if (vehiclePhysics) {
      this.smoothPos.copy(vehiclePhysics.position).add(new THREE.Vector3(0, 2, -6));
      this.smoothLook.copy(vehiclePhysics.position);
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  snap() {
    if (!this.target) return;
    const targetPos = this.target.position;
    const targetQuat = this.target.quaternion;
    const speedKmh = this.target.speedKmh || 0;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(targetQuat);
    const up = new THREE.Vector3(0, 1, 0);

    const idealPos = targetPos.clone()
      .addScaledVector(fwd, -this.chaseDistance)
      .addScaledVector(up, this.chaseHeight);

    if (this.worldGen && this.worldGen.getTerrainHeight) {
      const terrY = this.worldGen.getTerrainHeight(idealPos.x, idealPos.z);
      const minHeightAboveGround = 0.65;
      if (idealPos.y < terrY + minHeightAboveGround) {
        idealPos.y = terrY + minHeightAboveGround;
        const toCar = targetPos.clone().sub(idealPos).setY(0).normalize();
        idealPos.addScaledVector(toCar, 1.2);
      }
    }

    this.smoothPos.copy(idealPos);

    const idealLook = targetPos.clone().addScaledVector(up, this.lookAheadHeight);
    idealLook.addScaledVector(fwd, 1.5 + (speedKmh / 100.0) * 2.0);
    this.smoothLook.copy(idealLook);

    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);

    const targetFov = this.baseFov + (speedKmh / 240.0) * (this.maxFov - this.baseFov);
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
  }

  toggleCameraMode() {
    this.mode = (this.mode === 'chase') ? 'hood' : 'chase';
  }

  startGridPresentation() {
    this.isCinematic = true;
    this.cinematicTime = 0;
  }

  stopGridPresentation() {
    this.isCinematic = false;
    this.mode = 'chase';
  }

  update(dt) {
    if (!this.target) return;
    const targetPos = this.target.position;
    const targetQuat = this.target.quaternion;
    const speedKmh = this.target.speedKmh;

    // 1. Cinematic Grid Presentation (~5 seconds sweeping around grid)
    if (this.isCinematic) {
      this.cinematicTime += dt;
      const angle = this.cinematicTime * 0.45;
      const radius = 9.5;
      const camX = targetPos.x + Math.cos(angle) * radius;
      const camZ = targetPos.z + Math.sin(angle) * radius;
      const camY = targetPos.y + 1.6 + Math.sin(this.cinematicTime * 0.8) * 0.6;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(targetPos.x, targetPos.y + 0.8, targetPos.z);
      this.camera.fov = 55.0;
      this.camera.updateProjectionMatrix();

      if (this.cinematicTime >= 5.0) {
        this.stopGridPresentation();
      }
      return;
    }

    // 2. Hood Camera
    if (this.mode === 'hood') {
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(targetQuat);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(targetQuat);

      // Mount on hood: 0.6m forward, 0.95m above ground
      const hoodPos = targetPos.clone().addScaledVector(fwd, 0.65).addScaledVector(up, 0.92);
      this.camera.position.copy(hoodPos);

      const lookTarget = hoodPos.clone().addScaledVector(fwd, 20.0);
      this.camera.lookAt(lookTarget);

      // Speed FOV
      const targetFov = this.baseFov + (speedKmh / 240.0) * (this.maxFov - this.baseFov);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.1);
      this.camera.updateProjectionMatrix();
      return;
    }

    // 3. Chase Camera (Standard mode)
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(targetQuat);
    const up = new THREE.Vector3(0, 1, 0);

    // Calculate ideal camera position behind the car
    // Backwards vector is -fwd
    const idealPos = targetPos.clone()
      .addScaledVector(fwd, -this.chaseDistance)
      .addScaledVector(up, this.chaseHeight);

    // Camera Collision Avoidance (Section 3.3 & 5.7):
    // Check if ideal position penetrates the terrain heightfield
    const terrY = this.worldGen.getTerrainHeight(idealPos.x, idealPos.z);
    const minHeightAboveGround = 0.65;
    if (idealPos.y < terrY + minHeightAboveGround) {
      // Pull camera forward and up along collision normal
      idealPos.y = terrY + minHeightAboveGround;
      // Shorten distance to car
      const toCar = targetPos.clone().sub(idealPos).setY(0).normalize();
      idealPos.addScaledVector(toCar, 1.2);
    }

    // Smooth spring interpolation
    const lerpFactor = THREE.MathUtils.clamp(dt * 8.5, 0, 1);
    this.smoothPos.lerp(idealPos, lerpFactor);

    // Smooth look-at target (slightly above car center)
    const idealLook = targetPos.clone().addScaledVector(up, this.lookAheadHeight);
    // Bias look-at slightly forward with speed
    idealLook.addScaledVector(fwd, 1.5 + (speedKmh / 100.0) * 2.0);
    this.smoothLook.lerp(idealLook, lerpFactor * 1.2);

    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);

    // Dynamic FOV with speed (62 to 75 deg)
    const targetFov = this.baseFov + (speedKmh / 240.0) * (this.maxFov - this.baseFov);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
    this.camera.updateProjectionMatrix();
  }
}
