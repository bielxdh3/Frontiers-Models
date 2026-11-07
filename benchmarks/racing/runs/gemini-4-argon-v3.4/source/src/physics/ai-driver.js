// Section 9 — Competitive AI Driver (uses the exact same 120 Hz vehicle physics as the player!)
// Zero teleportation, zero rubber-banding, zero fabricated positions.

export const DIFFICULTY_PROFILES = {
  easy:   { label: 'Fácil',   speedScale: 0.86, accelCap: 0.85, cornerAggression: 0.88, lookAheadBase: 17.0 },
  normal: { label: 'Normal',  speedScale: 0.95, accelCap: 0.96, cornerAggression: 0.97, lookAheadBase: 15.5 },
  hard:   { label: 'Difícil', speedScale: 1.03, accelCap: 1.00, cornerAggression: 1.04, lookAheadBase: 14.2 }
};

export class AiDriverController {
  constructor(spline) {
    this.spline = spline;
    // Per-AI personality offsets so the 5 AIs naturally battle & overtake each other cleanly (Test 5!)
    this.personalities = [
      { paceWaveAmp: 0.045, paceWaveFreq: 0.0055, phase: 0.0,  prefLane: -0.9, brakeBias: 0.98 },
      { paceWaveAmp: 0.050, paceWaveFreq: 0.0071, phase: 1.4,  prefLane:  0.9, brakeBias: 1.02 },
      { paceWaveAmp: 0.048, paceWaveFreq: 0.0063, phase: 2.7,  prefLane: -0.4, brakeBias: 0.96 },
      { paceWaveAmp: 0.052, paceWaveFreq: 0.0082, phase: 4.1,  prefLane:  0.5, brakeBias: 1.03 },
      { paceWaveAmp: 0.046, paceWaveFreq: 0.0049, phase: 5.3,  prefLane:  0.0, brakeBias: 1.00 }
    ];
    this.laneOffsets = new Map();
  }

  updateVehicle(car, allVehicles, difficultyKey = 'normal', simTime = 0, dt = 1 / 120, isTestAutopilot = false) {
    const spline = this.spline;
    const diff = isTestAutopilot
      ? { speedScale: 1.01, accelCap: 1.0, cornerAggression: 1.02, lookAheadBase: 15.0 }
      : (DIFFICULTY_PROFILES[difficultyKey] || DIFFICULTY_PROFILES.normal);

    const pers = isTestAutopilot
      ? { paceWaveAmp: 0.0, paceWaveFreq: 0.0, phase: 0, prefLane: 0, brakeBias: 1.0 }
      : this.personalities[car.index % this.personalities.length];

    // Look ahead along derived racing line proportional to current speed
    const speedMs = Math.max(0, car.forwardSpeed);
    const lookAheadM = diff.lookAheadBase + speedMs * 0.48;
    const targetSample = spline.sampleRacingLine(car.s + lookAheadM);
    const nearSample = spline.sampleRacingLine(car.s + 6.0);
    const smpHere = spline.sampleAt(car.s);

    // Overtaking & collision avoidance lateral offset adjustment
    let desiredOverOffset = this.laneOffsets.get(car.index) ?? pers.prefLane;
    let carAheadClose = false;
    let emergencyBrake = 0;

    for (let i = 0; i < allVehicles.length; i++) {
      const other = allVehicles[i];
      if (other === car) continue;
      const ds = spline.shortestDeltaS(car.s, other.s);
      if (ds > -1.5 && ds < 24.0) {
        const latSep = car.d - other.d;
        if (Math.abs(latSep) < 2.65) {
          carAheadClose = true;
          // Choose the passing side already closer to `car.d` (unless near road edge) so AIs pass side-by-side instead of swerving across a rear bumper!
          const spaceLeft = (other.d - (-smpHere.halfWidth + 1.6));
          const spaceRight = ((smpHere.halfWidth - 1.6) - other.d);
          let passRight;
          if (spaceRight < 2.3) passRight = false;
          else if (spaceLeft < 2.3) passRight = true;
          else passRight = latSep >= 0;

          const passTargetD = passRight
            ? Math.min(smpHere.halfWidth - 1.5, other.d + 2.85)
            : Math.max(-smpHere.halfWidth + 1.5, other.d - 2.85);
          desiredOverOffset += (passTargetD - targetSample.offset - desiredOverOffset) * Math.min(1, dt * 5.2);

          if (ds > 0 && ds < 9.0 && Math.abs(latSep) < 1.95 && car.forwardSpeed > other.forwardSpeed - 0.5) {
            emergencyBrake = Math.max(emergencyBrake, Math.min(0.55, (9.0 - ds) / 11.0));
          }
        }
      }
    }

    if (!carAheadClose) {
      // Smoothly return toward optimal racing line + subtle personality lane
      const relaxTarget = pers.prefLane * 0.35;
      desiredOverOffset += (relaxTarget - desiredOverOffset) * Math.min(1, dt * 1.8);
    }

    const maxSafeLat = Math.max(1.2, smpHere.halfWidth - 1.65);
    const totalTargetD = Math.max(-maxSafeLat, Math.min(maxSafeLat, targetSample.offset + desiredOverOffset));
    this.laneOffsets.set(car.index, desiredOverOffset);

    const aimPt = spline.roadPoint(car.s + lookAheadM, totalTargetD, 0.0);
    const dx = aimPt.x - car.x;
    const dz = aimPt.z - car.z;
    const desiredYaw = Math.atan2(dx, dz);
    let yawErr = desiredYaw - car.yaw;
    while (yawErr > Math.PI) yawErr -= Math.PI * 2;
    while (yawErr < -Math.PI) yawErr += Math.PI * 2;

    // Proportional-derivative steering toward lookahead point
    const steerCmd = Math.max(-1.0, Math.min(1.0, yawErr * 2.15 - car.yawRate * 0.11));
    car.steer = steerCmd;

    // Target speed with braking zone anticipation + organic pace variation along track (enables natural AI overtakes!)
    const paceMod = 1.0 + pers.paceWaveAmp * Math.sin(car.s * pers.paceWaveFreq + pers.phase + simTime * 0.18);
    const baseTargetSpeed = Math.min(nearSample.targetSpeed, targetSample.targetSpeed * 1.04);
    const targetSpeed = baseTargetSpeed * diff.speedScale * diff.cornerAggression * paceMod * pers.brakeBias;

    const speedDiff = targetSpeed - speedMs;
    if (emergencyBrake > 0.1) {
      car.throttle = 0;
      car.brake = emergencyBrake;
    } else if (speedDiff > 0.6) {
      // Modulate throttle slightly in tight turns to prevent understeer off road
      const cornerThrottleScale = Math.max(0.45, 1.0 - Math.abs(steerCmd) * 0.38);
      car.throttle = Math.min(diff.accelCap, Math.max(0.25, speedDiff * 0.32)) * cornerThrottleScale;
      car.brake = 0;
    } else if (speedDiff < -1.4) {
      car.throttle = 0;
      car.brake = Math.min(0.95, (-speedDiff) * 0.14);
    } else {
      car.throttle = 0.22;
      car.brake = 0;
    }
    car.handbrake = 0;
  }
}
