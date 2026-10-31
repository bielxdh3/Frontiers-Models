/**
 * Vehicle.ts
 * Authoritative arcade vehicle dynamics engine.
 * - Fixed-step physics (60 Hz)
 * - Longitudinal acceleration, braking, reverse, drag
 * - Lateral cornering stiffness, slip angle, controllable drift
 * - Nitro boost with finite tank and drift recharge
 * - Wet weather grip reduction
 * - Progressive collision damage accumulation
 * - Barrier & vehicle-to-vehicle impulse collisions
 * - Clean off-track recovery with invulnerability grace
 */

import * as THREE from 'three';
import { CarConfig } from './CarConfigs';
import { Track } from '../world/Track';

export interface VehicleInputs {
  throttle: number; // -1 to +1
  steer: number;    // -1 (left) to +1 (right)
  drift: boolean;   // Handbrake
  nitro: boolean;
  recover: boolean;
}

export class Vehicle {
  public id: string;
  public config: CarConfig;
  public isPlayer: boolean;

  // 3D Rigid Body State
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public forward = new THREE.Vector3(0, 0, -1);
  public right = new THREE.Vector3(1, 0, 0);
  public up = new THREE.Vector3(0, 1, 0);
  public rotation = new THREE.Quaternion();

  // Angular / visual orientation
  public yaw = 0;          // Heading in radians
  public pitch = 0;        // Body dive / squat
  public roll = 0;         // Body cornering lean
  public steerAngle = 0;   // Front wheel angle
  public wheelRotation = 0;// Wheel spin animation angle

  // Dynamics & Mechanics
  public speedKmh = 0;
  public isDrifting = false;
  public driftAngle = 0;   // Angle between heading and velocity
  public driftScore = 0;   // Accumulated drift points during active slide
  public isNitroActive = false;
  public nitroAmount = 100;// 0 to 100
  public damage = 0;       // 0 (pristine) to 1.0 (heavy damage)

  // Recovery & Collision State
  public isInvulnerable = false;
  public invulnerabilityTimer = 0;
  public lastImpactIntensity = 0;
  public hasNewImpact = false;

  // Track progress tracking
  public currentDistanceAlongTrack = 0;
  public currentLap = 1;
  public lastPassedCheckpoint = -1;
  public isLapValid = true; // Invalidated if shortcut or recovery exploited
  public isOffRoad = false;

  constructor(id: string, config: CarConfig, isPlayer = false) {
    this.id = id;
    this.config = config;
    this.isPlayer = isPlayer;
    this.nitroAmount = config.nitroCapacity;
  }

  public reset(spawnPos: THREE.Vector3, spawnRot: THREE.Quaternion): void {
    this.position.copy(spawnPos);
    this.rotation.copy(spawnRot);
    this.velocity.set(0, 0, 0);

    // Compute forward and right from quaternion
    this.forward.set(0, 0, -1).applyQuaternion(this.rotation).normalize();
    this.right.set(1, 0, 0).applyQuaternion(this.rotation).normalize();
    this.yaw = Math.atan2(-this.forward.x, -this.forward.z);

    this.pitch = 0;
    this.roll = 0;
    this.steerAngle = 0;
    this.wheelRotation = 0;
    this.speedKmh = 0;
    this.isDrifting = false;
    this.driftAngle = 0;
    this.driftScore = 0;
    this.isNitroActive = false;
    this.nitroAmount = this.config.nitroCapacity;
    this.damage = 0;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
    this.hasNewImpact = false;

    this.currentLap = 1;
    this.lastPassedCheckpoint = -1;
    this.isLapValid = true;
    this.isOffRoad = false;
  }

  /**
   * Fixed-step update (dt is constant, e.g. 1/60s)
   */
  public update(dt: number, inputs: VehicleInputs, track: Track, weatherWetness: number): void {
    // 1. Handle Recovery Trigger
    if (inputs.recover) {
      this.recoverToTrack(track);
      return;
    }

    // 2. Invulnerability Timer
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= dt;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // Reset impact flag
    this.hasNewImpact = false;

    // 3. Project car position onto track to get ground elevation, banking, and road limits
    const proj = track.projectPosition(this.position);
    this.currentDistanceAlongTrack = proj.distanceAlongTrack;
    this.isOffRoad = proj.isOffRoad;

    // Follow track elevation smoothly
    const groundY = proj.nearestPoint.y + 0.35;
    this.position.y += (groundY - this.position.y) * Math.min(1.0, 15.0 * dt);

    // 4. Wet weather grip factor: decreases from 1.0 (dry) to 0.65 (full rain)
    const wetGripFactor = 1.0 - 0.35 * Math.max(0, Math.min(1, weatherWetness));

    // 5. Steering Dynamics
    const targetSteer = inputs.steer * this.config.maxSteerAngle;
    const steerRate = this.config.steerSpeed * (this.isDrifting ? this.config.driftControl : 1.0);
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, steerRate * dt);

    // 6. Nitro Logic
    if (inputs.nitro && this.nitroAmount > 2.0 && inputs.throttle > 0) {
      this.isNitroActive = true;
      this.nitroAmount = Math.max(0, this.nitroAmount - 26.0 * dt);
    } else {
      this.isNitroActive = false;
      // Natural slow recharge over time
      this.nitroAmount = Math.min(
        this.config.nitroCapacity,
        this.nitroAmount + this.config.nitroRechargeRate * dt
      );
    }

    // 7. Drift Logic
    const currentSpeed = this.velocity.length(); // m/s
    const speedKmh = currentSpeed * 3.6;

    if (inputs.drift && speedKmh > 25 && Math.abs(inputs.steer) > 0.1) {
      this.isDrifting = true;
    } else if (this.isDrifting) {
      if (speedKmh < 15 || (!inputs.drift && Math.abs(this.driftAngle) < 0.08)) {
        // Exit drift: award exit boost impulse and nitro recharge!
        if (this.driftScore > 20) {
          const boostMagnitude = Math.min(4.0, this.driftScore * 0.015);
          this.velocity.add(this.forward.clone().multiplyScalar(boostMagnitude));
          this.nitroAmount = Math.min(this.config.nitroCapacity, this.nitroAmount + 15);
        }
        this.isDrifting = false;
        this.driftScore = 0;
      }
    }

    if (this.isDrifting) {
      this.driftScore += (Math.abs(this.driftAngle) + 0.1) * speedKmh * dt;
    }

    // 8. Longitudinal Forces (Throttle, Brake, Reverse)
    let forwardAccel = 0;
    const maxKmh = this.isNitroActive ? this.config.nitroMaxSpeedKmh : this.config.maxSpeedKmh;
    const effectiveMaxSpeed = this.isOffRoad ? Math.min(maxKmh, 68) : maxKmh;
    const maxSpeedMs = effectiveMaxSpeed / 3.6;

    if (inputs.throttle > 0) {
      if (speedKmh < effectiveMaxSpeed) {
        forwardAccel += this.config.accelForce;
        if (this.isNitroActive) {
          forwardAccel += this.config.nitroThrust;
        }
      }
    } else if (inputs.throttle < 0) {
      const forwardDotVel = this.forward.dot(this.velocity);
      if (forwardDotVel > 0.5) {
        // Braking while moving forward
        forwardAccel -= this.config.brakeForce;
      } else {
        // Reverse gear
        const maxRevMs = this.config.reverseSpeedKmh / 3.6;
        if (currentSpeed < maxRevMs) {
          forwardAccel -= this.config.accelForce * 0.5;
        }
      }
    }

    // Aerodynamic Drag & Rolling Resistance
    const dragCoeff = this.isOffRoad ? 0.08 : 0.022;
    const rollingResistance = 1.2;
    const dragForce = (currentSpeed * currentSpeed * dragCoeff + rollingResistance) * Math.sign(this.forward.dot(this.velocity));

    // 9. Heading and Yaw Rate
    const turnAuthority = Math.min(1.0, currentSpeed / 8.0);
    const yawDelta = -this.steerAngle * turnAuthority * 2.2 * dt;
    this.yaw += yawDelta;

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    // 10. Velocity Integration & Lateral Grip
    // Decompose current velocity into longitudinal and lateral components
    const vForward = this.velocity.dot(this.forward);
    const vRight = this.velocity.dot(this.right);

    // Forward velocity update
    const newVForward = vForward + (forwardAccel - dragForce) * dt;

    // Lateral tire grip
    const effectiveGrip = (this.isDrifting ? this.config.driftGrip : this.config.baseGrip) * wetGripFactor;
    const lateralDamping = Math.exp(-effectiveGrip * dt * 4.0);
    const newVRight = vRight * lateralDamping;

    // Reconstruct velocity
    this.velocity.copy(this.forward).multiplyScalar(newVForward).add(this.right.clone().multiplyScalar(newVRight));

    // Update speed
    this.speedKmh = this.velocity.length() * 3.6;

    // Calculate drift slide angle
    if (this.speedKmh > 10) {
      this.driftAngle = Math.atan2(newVRight, Math.abs(newVForward));
    } else {
      this.driftAngle = 0;
    }

    // Integrate position
    this.position.addScaledVector(this.velocity, dt);

    // 11. Chassis Suspension Leaning (Pitch & Roll)
    // Pitch: dive under braking, squat under acceleration
    const targetPitch = (forwardAccel / 30.0) * 0.08;
    this.pitch += (targetPitch - this.pitch) * Math.min(1.0, 10.0 * dt);

    // Roll: centrifugal body roll away from corner
    const lateralG = (vForward * yawDelta) / (dt * 9.81);
    const targetRoll = -Math.max(-0.15, Math.min(0.15, lateralG * 0.08));
    this.roll += (targetRoll - this.roll) * Math.min(1.0, 12.0 * dt);

    // Update rotation quaternion
    const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
    this.rotation.setFromEuler(euler);

    // Wheel spin
    this.wheelRotation += (newVForward / this.config.wheelRadius) * dt;

    // 12. Barrier Collision Handling
    if (proj.hitBarrier && !this.isInvulnerable) {
      this.handleBarrierCollision(proj.lateralOffset, proj.forwardDir, proj.nearestPoint);
    }
  }

  private handleBarrierCollision(lateralOffset: number, trackForward: THREE.Vector3, nearestPt: THREE.Vector3): void {
    // Determine wall normal pointing back into track
    const trackRight = new THREE.Vector3().crossVectors(trackForward, new THREE.Vector3(0, 1, 0)).normalize();
    const wallNormal = trackRight.clone().multiplyScalar(lateralOffset > 0 ? -1 : 1);

    const normalVel = this.velocity.dot(wallNormal);
    if (normalVel < 0) {
      // Impact occurred!
      const impactSpeed = Math.abs(normalVel);
      this.lastImpactIntensity = Math.min(1.0, impactSpeed / 20.0);
      this.hasNewImpact = true;

      // Add visual damage
      this.damage = Math.min(1.0, this.damage + this.lastImpactIntensity * 0.22);

      // Bounce velocity with restitution
      const restitution = 0.35;
      this.velocity.sub(wallNormal.clone().multiplyScalar((1 + restitution) * normalVel));
      // Glance friction
      this.velocity.multiplyScalar(0.82);

      // Push back inside boundary
      const safeLateral = (lateralOffset > 0 ? 1 : -1) * (7.0 - 0.2);
      this.position.copy(nearestPt).add(trackRight.clone().multiplyScalar(safeLateral));
      this.position.y += 0.35;
    }
  }

  public handleVehicleCollision(other: Vehicle): void {
    if (this.isInvulnerable || other.isInvulnerable) return;

    const diff = new THREE.Vector3().subVectors(this.position, other.position);
    diff.y = 0;
    const dist = diff.length();
    const minSafeDist = 2.4; // Average car width/length radius

    if (dist < minSafeDist && dist > 0.001) {
      const normal = diff.clone().divideScalar(dist);
      const overlap = minSafeDist - dist;

      // Separate vehicles
      this.position.addScaledVector(normal, overlap * 0.5);
      other.position.addScaledVector(normal, -overlap * 0.5);

      // Elastic impulse exchange
      const relVel = new THREE.Vector3().subVectors(this.velocity, other.velocity);
      const velAlongNormal = relVel.dot(normal);

      if (velAlongNormal < 0) {
        const restitution = 0.4;
        const impulseMag = -(1 + restitution) * velAlongNormal * 0.5;
        const impulse = normal.clone().multiplyScalar(impulseMag);

        this.velocity.add(impulse);
        other.velocity.sub(impulse);

        const intensity = Math.min(1.0, Math.abs(velAlongNormal) / 18.0);
        if (intensity > 0.08) {
          this.damage = Math.min(1.0, this.damage + intensity * 0.15);
          other.damage = Math.min(1.0, other.damage + intensity * 0.15);
          this.lastImpactIntensity = intensity;
          this.hasNewImpact = true;
        }
      }
    }
  }

  public recoverToTrack(track: Track): void {
    const proj = track.projectPosition(this.position);

    // Place safely on centerline
    this.position.copy(proj.nearestPoint);
    this.position.y += 0.4;

    // Align heading along track tangent
    const tangent = proj.forwardDir;
    this.yaw = Math.atan2(-tangent.x, -tangent.z);
    this.rotation.setFromEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    this.forward.copy(tangent);
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    // Rejoin with modest starting roll speed (e.g. 25 km/h) rather than dead stop or unearned speed
    this.velocity.copy(tangent).multiplyScalar(25 / 3.6);
    this.speedKmh = 25;

    // Reset nitro & drift
    this.isDrifting = false;
    this.isNitroActive = false;
    this.driftAngle = 0;
    this.driftScore = 0;

    // Grant temporary non-collision grace
    this.isInvulnerable = true;
    this.invulnerabilityTimer = 1.6;

    // Invalidate current lap for Time Trial records!
    this.isLapValid = false;
  }
}
