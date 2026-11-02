// src/ai/AIDriver.js
// Autonomous racing AI with pure pursuit lookahead, curvature speed profiling,
// lateral overtaking offset, and multi-vehicle collision avoidance.

import * as THREE from 'three';

export class AIDriver {
  constructor(vehiclePhysics, worldGen, difficulty = 'normal', aiIndex = 0) {
    this.physics = vehiclePhysics;
    this.worldGen = worldGen;
    this.difficulty = difficulty;
    this.aiIndex = aiIndex;

    // Difficulty parameters
    const diffParams = {
      facil: { speedMult: 0.82, lookahead: 28.0, aggr: 0.5 },
      normal: { speedMult: 0.92, lookahead: 32.0, aggr: 0.75 },
      dificil: { speedMult: 1.00, lookahead: 36.0, aggr: 0.95 }
    };
    this.params = diffParams[difficulty] || diffParams.normal;

    // Lateral racing line offset preference (-3.0m to +3.0m)
    this.baseLateralOffset = ((aiIndex % 2 === 0 ? 1 : -1) * (0.8 + (aiIndex * 0.5)));
    this.currentLateralOffset = this.baseLateralOffset;

    // Progress tracking
    this.currentSplineDist = 0;
    this.currentLap = 1;
    this.totalProgress = 0;
  }

  update(dt, allVehicles = []) {
    const totalLen = this.worldGen.totalLength;
    const pos = this.physics.position;

    // 1. Calculate current distance along spline
    const { frame } = this.worldGen.getClosestRoadFrame(pos.x, pos.z);
    this.currentSplineDist = frame.s;
    this.totalProgress = (this.currentLap - 1) * totalLen + this.currentSplineDist;

    // 2. Pure pursuit target point with speed-dependent lookahead
    const speed = Math.max(12.0, this.physics.velocity.length());
    const lookaheadDist = this.params.lookahead + (speed * 0.45);
    const targetDist = (this.currentSplineDist + lookaheadDist) % totalLen;

    const targetU = targetDist / totalLen;
    const targetPt = this.worldGen.curve.getPointAt(targetU);
    const targetTan = this.worldGen.curve.getTangentAt(targetU).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const targetBinorm = new THREE.Vector3().crossVectors(targetTan, up).normalize();

    // 3. Collision avoidance & Overtaking logic
    this.calculateOvertaking(allVehicles);

    // Apply lateral offset to target position
    const steerTarget = targetPt.clone().addScaledVector(targetBinorm, this.currentLateralOffset);

    // 4. Steering calculation (Heading error towards target point)
    const toTarget = steerTarget.clone().sub(pos);
    toTarget.y = 0;
    toTarget.normalize();

    const carFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.physics.quaternion);
    const carRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.physics.quaternion);

    const fwdDot = THREE.MathUtils.clamp(carFwd.dot(toTarget), -1, 1);
    const rightDot = carRight.dot(toTarget);

    // Steer proportional to angle difference
    const angleDiff = Math.atan2(rightDot, fwdDot);
    this.physics.steer = THREE.MathUtils.clamp(angleDiff * 2.8, -1.0, 1.0);

    // 5. Curvature-based Target Speed & Braking
    // Calculate curvature at lookahead point
    const uPrev = Math.max(0, targetU - 0.002);
    const uNext = Math.min(1, targetU + 0.002);
    const t0 = this.worldGen.curve.getTangentAt(uPrev);
    const t1 = this.worldGen.curve.getTangentAt(uNext);
    const dtTan = t1.clone().sub(t0);
    const ds = (uNext - uPrev) * totalLen;
    const curv = ds > 1e-4 ? (dtTan.length() / ds) : 0;

    // Cornering max speed: v_max = sqrt(grip * R) = sqrt(grip / curv)
    let maxCornerSpeed = 65.0; // m/s
    if (curv > 0.006) {
      const radius = 1.0 / curv;
      // lateral grip factor ~ 1.25g
      maxCornerSpeed = Math.sqrt(1.25 * 9.81 * radius) * this.params.speedMult;
    }

    const curSpeed = this.physics.velocity.length();

    // 6. Throttle & Brake controls
    if (curSpeed < maxCornerSpeed - 1.5) {
      // Accelerate
      this.physics.throttle = 1.0;
      this.physics.brake = 0.0;
    } else if (curSpeed > maxCornerSpeed + 1.0) {
      // Brake before corner
      this.physics.throttle = 0.0;
      this.physics.brake = THREE.MathUtils.clamp((curSpeed - maxCornerSpeed) / 8.0, 0.3, 1.0);
    } else {
      // Coast / maintain speed
      this.physics.throttle = 0.45;
      this.physics.brake = 0.0;
    }

    this.physics.handbrake = false;
  }

  // Avoid collisions with other cars and shift lanes to pass
  calculateOvertaking(allVehicles) {
    let closestAheadDist = Infinity;
    let vehicleAhead = null;
    const pos = this.physics.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.physics.quaternion);

    for (const other of allVehicles) {
      if (other === this.physics) continue;
      const toOther = other.position.clone().sub(pos);
      const distFwd = toOther.dot(fwd);
      const distLat = Math.abs(toOther.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(this.physics.quaternion)));

      // Vehicle ahead within 22m and in front corridor of 3.2m
      if (distFwd > 1.0 && distFwd < 25.0 && distLat < 3.2) {
        if (distFwd < closestAheadDist) {
          closestAheadDist = distFwd;
          vehicleAhead = other;
        }
      }
    }

    if (vehicleAhead) {
      // Slower car ahead: switch lane towards open side
      const otherLat = vehicleAhead.position.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(this.physics.quaternion));
      const evadeDir = otherLat > 0 ? -1 : 1;
      this.currentLateralOffset = THREE.MathUtils.lerp(this.currentLateralOffset, evadeDir * 2.8, 0.1);

      // If very close, modulate throttle
      if (closestAheadDist < 8.0) {
        this.physics.throttle *= 0.5;
        if (closestAheadDist < 4.0) {
          this.physics.brake = 0.6;
        }
      }
    } else {
      // Return smoothly to preferred line
      this.currentLateralOffset = THREE.MathUtils.lerp(this.currentLateralOffset, this.baseLateralOffset, 0.05);
    }
  }
}
