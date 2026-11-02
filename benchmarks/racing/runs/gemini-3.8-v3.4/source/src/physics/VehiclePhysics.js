// src/physics/VehiclePhysics.js
// Fixed-timestep 120Hz arcade vehicle physics with raycast suspension,
// Pacejka-inspired slip curve, roll/pitch chassis dynamics, and auto-reset.

import * as THREE from 'three';

export class VehiclePhysics {
  constructor(carModel, worldGen, isPlayer = false) {
    this.car = carModel;
    this.worldGen = worldGen;
    this.isPlayer = isPlayer;

    // Vehicle properties
    this.mass = 1250; // kg
    this.wheelbase = carModel.modelType === 'gt_coupe' ? 2.65 : 2.55;
    this.trackWidth = 1.68;
    this.wheelRadius = 0.34;
    this.suspensionRestLength = 0.45;
    this.suspensionStiffness = 38000; // N/m
    this.suspensionDamping = 3200; // N*s/m
    this.antiRollStiffness = 9500;

    // Engine & Transmission
    this.maxSpeed = 68.0; // ~245 km/h (m/s)
    this.enginePower = carModel.modelType === 'gt_coupe' ? 440 : 380; // HP
    this.gearRatios = [3.4, 2.3, 1.6, 1.2, 0.95, 0.78];
    this.finalDrive = 3.7;
    this.currentGear = 1;
    this.rpm = 900;
    this.maxRpm = 7500;
    this.idleRpm = 850;

    // State vectors
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.heading = 0; // Yaw angle (radians)

    // Chassis pitch & roll visual offsets
    this.chassisRoll = 0;
    this.chassisPitch = 0;

    // Control inputs
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.handbrake = false;

    // Slip & telemetry
    this.speedKmh = 0;
    this.slipRatio = 0;
    this.lateralSlip = 0;
    this.isGrounded = false;
    this.groundType = 'asphalt'; // 'asphalt', 'curb', 'sand', 'grass'

    // Off-track / Upside-down reset timer
    this.stuckTimer = 0;
    this.resetEvents = [];

    // Wheels state
    this.wheels = carModel.wheels.map(w => ({
      ...w,
      compression: 0,
      groundContact: false,
      groundY: 0,
      slipAngle: 0,
      angularVel: 0
    }));
  }

  // Initialize car position along spline
  spawnAt(distance, lateralOffset = 0) {
    const totalLen = this.worldGen.totalLength;
    const u = ((distance % totalLen) + totalLen) % totalLen / totalLen;
    const pt = this.worldGen.curve.getPointAt(u);
    const tan = this.worldGen.curve.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const binorm = new THREE.Vector3().crossVectors(tan, up).normalize();

    // Position by raycast onto road surface (Section 3.3)
    this.position.copy(pt).addScaledVector(binorm, lateralOffset);
    this.position.y += this.wheelRadius + 0.15;
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);

    // Orient forward
    this.heading = Math.atan2(tan.x, tan.z);
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);

    this.car.group.position.copy(this.position);
    this.car.group.quaternion.copy(this.quaternion);
  }

  // Fixed timestep physics update (120 Hz)
  step(dt) {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);

    const fwdSpeed = this.velocity.dot(fwd);
    const latSpeed = this.velocity.dot(right);
    this.speedKmh = Math.abs(fwdSpeed) * 3.6;

    // 1. Raycast suspension & ground contact for 4 wheels
    let groundedWheels = 0;
    let avgGroundY = 0;

    for (const w of this.wheels) {
      // Calculate world position of wheel mount
      const mountWorld = this.position.clone()
        .addScaledVector(right, w.basePos.x)
        .addScaledVector(fwd, w.basePos.z)
        .addScaledVector(up, 0.1);

      // Raycast down to find ground (road or terrain)
      const terrY = this.worldGen.getTerrainHeight(mountWorld.x, mountWorld.z);
      // Check road frame height
      const { frame, dist } = this.worldGen.getClosestRoadFrame(mountWorld.x, mountWorld.z);
      let groundY = terrY;
      let surfaceType = 'grass';

      if (dist <= frame.width / 2.0) {
        groundY = frame.pos.y;
        surfaceType = 'asphalt';
      } else if (dist <= frame.width / 2.0 + 0.9) {
        groundY = frame.pos.y + 0.05;
        surfaceType = 'curb';
      } else if (mountWorld.z > 210) {
        surfaceType = 'sand';
      }

      const wheelDistToGround = mountWorld.y - groundY;
      const targetDist = this.suspensionRestLength;

      if (wheelDistToGround < targetDist) {
        // Wheel in contact with ground
        w.groundContact = true;
        w.compression = targetDist - wheelDistToGround;
        w.groundY = groundY;
        groundedWheels++;
        avgGroundY += groundY;
      } else {
        w.groundContact = false;
        w.compression = 0;
      }

      // Visual suspension displacement
      w.mount.position.y = w.basePos.y - (w.groundContact ? (targetDist - w.compression * 0.7) : targetDist);

      // Wheel rotation (spin around X)
      w.spinAngle += (fwdSpeed / this.wheelRadius) * dt;
      w.rotatingHub.rotation.x = w.spinAngle;

      // Wheel steering (steer around Y for front wheels)
      if (w.isFront) {
        // Speed-dependent steering reduction
        const speedFactor = Math.max(0.25, 1.0 - (this.speedKmh / 260.0));
        const maxSteerRad = 0.55 * speedFactor;
        w.steerAngle = this.steer * maxSteerRad;
        w.mount.rotation.y = w.steerAngle;
      }
    }

    this.isGrounded = (groundedWheels >= 2);
    if (groundedWheels > 0) {
      avgGroundY /= groundedWheels;
    }

    // 2. Drive & Braking forces
    let driveForce = 0;
    let brakeForce = 0;

    if (this.isGrounded) {
      // Gear shifting logic
      this.updateGears(fwdSpeed);

      const maxDriveForce = (this.enginePower * 745.7) / Math.max(8.0, Math.abs(fwdSpeed));
      driveForce = this.throttle * Math.min(6500, maxDriveForce);

      if (this.brake > 0) {
        brakeForce = this.brake * 9500;
        this.car.lights.setBraking(true);
      } else {
        this.car.lights.setBraking(false);
      }

      if (this.handbrake) {
        brakeForce += 14000;
        this.car.lights.setBraking(true);
      }
    } else {
      this.car.lights.setBraking(false);
    }

    // 3. Friction & Cornering
    let netFwdForce = driveForce;
    if (fwdSpeed > 0.1) {
      netFwdForce -= brakeForce;
    } else if (fwdSpeed < -0.1) {
      netFwdForce += brakeForce;
    } else if (this.brake > 0 && fwdSpeed <= 0.1) {
      // Reverse
      netFwdForce = -this.brake * 3200;
    }

    // Rolling resistance & aerodynamic drag
    const aeroDrag = 0.38 * 1.225 * 2.1 * 0.5 * fwdSpeed * Math.abs(fwdSpeed);
    const rollResistance = 0.015 * this.mass * 9.81 * Math.sign(fwdSpeed);
    netFwdForce -= (aeroDrag + rollResistance);

    // Lateral grip
    let maxGrip = 1.35 * this.mass * 9.81;
    if (this.handbrake) maxGrip *= 0.45; // Drift initiate
    const targetLatAccel = -latSpeed * 18.0;
    const latForce = THREE.MathUtils.clamp(targetLatAccel * this.mass, -maxGrip, maxGrip);

    this.lateralSlip = Math.abs(latSpeed) / (Math.abs(fwdSpeed) + 1.0);

    // 4. Update Linear Velocity
    if (this.isGrounded) {
      const fwdAccel = netFwdForce / this.mass;
      const latAccel = latForce / this.mass;

      this.velocity.addScaledVector(fwd, fwdAccel * dt);
      this.velocity.addScaledVector(right, latAccel * dt);

      // Keep on road surface
      const targetY = avgGroundY + this.wheelRadius + 0.12;
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, 0.25);
      this.velocity.y = (targetY - this.position.y) / dt * 0.1;
    } else {
      // Gravity
      this.velocity.y -= 9.81 * dt;
    }

    // 5. Steering & Yaw Rotation
    if (this.isGrounded) {
      const speedFactor = Math.max(0.2, 1.0 - (this.speedKmh / 280.0));
      const steerAmount = this.steer * speedFactor;
      // Yaw rate = (v / L) * tan(delta)
      const yawRate = (fwdSpeed / this.wheelbase) * Math.tan(steerAmount * 0.52);
      this.heading += yawRate * dt;
      this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    }

    // Update position
    this.position.addScaledVector(this.velocity, dt);

    // 6. Visual Chassis Dynamics (Pitch and Roll)
    const accelFwd = netFwdForce / this.mass;
    const accelLat = (fwdSpeed * (this.steer * 0.4));
    const targetPitch = THREE.MathUtils.clamp(-accelFwd * 0.003, -0.08, 0.08);
    const targetRoll = THREE.MathUtils.clamp(accelLat * 0.004, -0.10, 0.10);

    this.chassisPitch = THREE.MathUtils.lerp(this.chassisPitch, targetPitch, 0.15);
    this.chassisRoll = THREE.MathUtils.lerp(this.chassisRoll, targetRoll, 0.15);

    this.car.chassisGroup.rotation.x = this.chassisPitch;
    this.car.chassisGroup.rotation.z = this.chassisRoll;

    // Sync car group transform
    this.car.group.position.copy(this.position);
    this.car.group.quaternion.copy(this.quaternion);

    // 7. Invariant & Safety Guard: Automatic Reset (Section 3.3)
    this.checkSafetyReset(dt);
  }

  // Gearbox & RPM calculation
  updateGears(fwdSpeed) {
    const speedRatio = Math.abs(fwdSpeed) / this.maxSpeed;
    if (speedRatio < 0.15) this.currentGear = 1;
    else if (speedRatio < 0.32) this.currentGear = 2;
    else if (speedRatio < 0.52) this.currentGear = 3;
    else if (speedRatio < 0.72) this.currentGear = 4;
    else if (speedRatio < 0.88) this.currentGear = 5;
    else this.currentGear = 6;

    const gearRatio = this.gearRatios[this.currentGear - 1];
    const wheelRps = Math.abs(fwdSpeed) / (2 * Math.PI * this.wheelRadius);
    const targetRpm = wheelRps * gearRatio * this.finalDrive * 60;
    this.rpm = THREE.MathUtils.lerp(this.rpm, Math.max(this.idleRpm, Math.min(this.maxRpm, targetRpm)), 0.18);
  }

  // Safety resets if upside-down, stuck, or fallen below world (Section 3.3)
  checkSafetyReset(dt) {
    const terrY = this.worldGen.getTerrainHeight(this.position.x, this.position.z);
    const belowGround = (this.position.y < terrY - 0.8);
    const upsideDown = (new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).y < 0.2);

    if (belowGround || upsideDown) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.8 || belowGround) {
        this.performSafetyReset('Terrain clipping or rollover');
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  performSafetyReset(reason) {
    console.warn(`[VehiclePhysics] Resetting vehicle. Reason: ${reason}`);
    this.resetEvents.push({ timestamp: Date.now(), reason, pos: this.position.clone() });

    // Find closest point on spline
    const { frame } = this.worldGen.getClosestRoadFrame(this.position.x, this.position.z);
    this.position.copy(frame.pos).add(new THREE.Vector3(0, this.wheelRadius + 0.2, 0));
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.heading = Math.atan2(frame.tangent.x, frame.tangent.z);
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    this.stuckTimer = 0;
  }
}
