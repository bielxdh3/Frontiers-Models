// Section 3.3, 8, 9, 10 — 120 Hz Fixed-Timestep Vehicle Physics, Collisions, Checkpoints & Runtime Invariants

export const FIXED_DT = 1 / 120;

export const CAR_SPECS = {
  gt: {
    id: 'gt',
    name: 'Solare GT',
    length: 4.54,
    width: 1.92,
    height: 1.26,
    wheelBase: 2.68,
    trackWidth: 1.64,
    wheelRadius: 0.345,
    maxSpeed: 54.5,      // ~196 km/h
    engineForce: 10.6,   // m/s^2 peak low-gear thrust
    brakeForce: 19.5,
    handbrakeForce: 13.0,
    maxSteerRad: 0.44,   // ~25.2 deg at low speed
    gripAsphalt: 13.8,
    redlineRpm: 7400,
    idleRpm: 920,
    gearRatios: [3.45, 2.38, 1.76, 1.36, 1.09, 0.90]
  },
  hatch: {
    id: 'hatch',
    name: 'Vento RS',
    length: 4.30,
    width: 1.86,
    height: 1.38,
    wheelBase: 2.56,
    trackWidth: 1.60,
    wheelRadius: 0.335,
    maxSpeed: 53.0,      // ~191 km/h
    engineForce: 11.1,   // punchier low-end acceleration
    brakeForce: 20.0,
    handbrakeForce: 13.5,
    maxSteerRad: 0.46,
    gripAsphalt: 14.1,
    redlineRpm: 7600,
    idleRpm: 1020,
    gearRatios: [3.55, 2.44, 1.81, 1.40, 1.12, 0.93]
  }
};

export function sampleWorldSurface(world, x, z, fromY = 200.0) {
  const rHit = world.roadCollider ? world.roadCollider.raycastDown(x, z, fromY) : null;
  const tHit = world.terrain.raycastDown(x, z);
  if (rHit && rHit.y >= tHit.y - 0.12) {
    return rHit;
  }
  const proj = world.spline.projectXZ(x, z);
  return { ...tHit, proj };
}

export class VehicleState {
  constructor({ index, isPlayer, modelId, liveryIndex, name }) {
    this.index = index;
    this.isPlayer = isPlayer;
    this.modelId = modelId in CAR_SPECS ? modelId : 'gt';
    this.spec = CAR_SPECS[this.modelId];
    this.liveryIndex = liveryIndex;
    this.name = name || (isPlayer ? 'Você' : `IA ${index}`);

    // Pose & velocities
    this.x = 0;
    this.y = 4.5;
    this.z = 260;
    this.yaw = Math.PI * 0.5; // +X heading in Three.js (sin(yaw)=+1, cos(yaw)=0)
    this.pitch = 0;
    this.roll = 0;
    this.bodyRoll = 0;
    this.bodyPitch = 0;

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.speedKmh = 0;
    this.slipRatio = 0;

    // Controls
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.handbrake = 0;
    this.steerVisual = 0;

    // Drivetrain
    this.gear = 1;
    this.rpm = this.spec.idleRpm;
    this.shiftTimer = 0;
    this.lastGearShiftTime = -10;
    this.atLimiter = false;

    // 4 Wheels: [FL, FR, RL, RR]
    this.wheelSpin = 0;
    this.wheelCompression = [0, 0, 0, 0];
    this.wheelGroundDist = [0, 0, 0, 0];
    this.wheelContact = [true, true, true, true];
    this.surface = 'asphalt';
    this.inAir = false;
    this.airTime = 0;

    // Spline & Race Progress
    this.s = 0;
    this.d = 0;
    this.zone = 'Z1';
    this.isBridge = false;
    this.lastValidS = 0;
    this.lap = 1;
    this.completedLaps = 0;
    this.nextCheckpoint = 1;
    this.checkpointsMask = 1; // bit 0 (start line) active
    this.currentLapTime = 0;
    this.bestLapTime = null;
    this.totalRaceTime = 0;
    this.finished = false;
    this.projectedFinish = false;
    this.finishTime = null;
    this.position = index + 1;

    // Timers & events
    this.offTrackTimer = 0;
    this.stuckTimer = 0;
    this.falseStartBog = 0;
    this.scrapeIntensity = 0;
    this.lastCollisionForce = 0;
    this.lastCollisionTime = -10;
  }
}

export class PhysicsWorld {
  constructor(world) {
    this.world = world;
    this.spline = world.spline;
    this.vehicles = [];
    this.accumulator = 0;
    this.simTime = 0;
    this.racePhase = 'menu'; // 'menu' | 'intro' | 'countdown' | 'racing' | 'finished'
    this.totalLaps = 3;

    // Section 3.3 & 13.1 Test 6 + 13.2 Audio event logs
    this.integrityLog = [];
    this.gameplayResetLog = [];
    this.eventLog = [];
    this.overtakeCount = 0;
    this._lastAiOrder = null;
  }

  resetLogs() {
    this.integrityLog.length = 0;
    this.gameplayResetLog.length = 0;
    this.eventLog.length = 0;
    this.overtakeCount = 0;
    this._lastAiOrder = null;
  }

  // Spawn 6-car 2x3 staggered starting grid strictly by downward raycast onto Z1 road surface (Section 3.3)
  spawnGrid(vehicles) {
    this.vehicles = vehicles;
    this.accumulator = 0;
    this.simTime = 0;
    const L = this.spline.totalLength;

    // Grid slots behind Start/Finish line (s = L - 8 back to L - 43); player starts P6 or P4 for exciting pack racing!
    // Slot 0 = P1 front-left, Slot 1 = P2 front-right, ..., Slot 5 = P6 rear-right
    for (let i = 0; i < vehicles.length; i++) {
      const car = vehicles[i];
      // Place AI in slots 0..4 and Player in slot 4 (3rd row inside) or slot 5 so S8 & pack racing happen naturally
      const gridSlot = car.isPlayer ? 4 : (i < 4 ? i : 5);
      const row = Math.floor(gridSlot / 2);
      const col = gridSlot % 2;
      const spawnS = this.spline.wrapS(L - (9.0 + row * 9.5 + col * 3.8));
      const spawnD = col === 0 ? -2.45 : 2.45;

      this.placeCarOnSpline(car, spawnS, spawnD);
      car.lap = 1;
      car.completedLaps = 0;
      car.nextCheckpoint = 1;
      car.checkpointsMask = 1;
      car.currentLapTime = 0;
      car.bestLapTime = null;
      car.totalRaceTime = 0;
      car.finished = false;
      car.projectedFinish = false;
      car.finishTime = null;
      car.position = gridSlot + 1;
    }
    this._updatePositions();
  }

  placeCarOnSpline(car, s, d = 0) {
    const ws = this.spline.wrapS(s);
    const pt = this.spline.roadPoint(ws, d, 0.0);
    const smp = pt.sample;
    // Raycast onto actual road/terrain surface at (pt.x, pt.z) — NEVER fixed height!
    const surf = sampleWorldSurface(this.world, pt.x, pt.z, pt.y + 8.0);

    car.x = pt.x;
    car.z = pt.z;
    car.y = surf.y + car.spec.wheelRadius + 0.16;
    car.yaw = Math.atan2(smp.fxz_x, smp.fxz_z);
    car.pitch = -Math.asin(Math.max(-0.3, Math.min(0.3, smp.fy)));
    car.roll = smp.bankRad;
    car.bodyRoll = 0;
    car.bodyPitch = 0;

    car.vx = 0;
    car.vy = 0;
    car.vz = 0;
    car.yawRate = 0;
    car.forwardSpeed = 0;
    car.lateralSpeed = 0;
    car.speedKmh = 0;
    car.slipRatio = 0;
    car.gear = 1;
    car.rpm = car.spec.idleRpm;
    car.s = ws;
    car.d = d;
    car.zone = smp.zone;
    car.isBridge = smp.isBridge;
    car.lastValidS = ws;
    car.offTrackTimer = 0;
    car.stuckTimer = 0;
    car.inAir = false;
    car.airTime = 0;
    car.scrapeIntensity = 0;
    car.wheelContact = [true, true, true, true];
    car.wheelGroundDist = [0, 0, 0, 0];
  }

  step(dt, aiControllerFn = null) {
    const clampedDt = Math.min(0.1, Math.max(0, dt));
    this.accumulator += clampedDt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 10) {
      if (aiControllerFn) aiControllerFn(FIXED_DT);
      this.substep(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
  }

  substep(dt) {
    this.simTime += dt;
    const isRacing = this.racePhase === 'racing';
    const isCountdown = this.racePhase === 'countdown';

    for (let i = 0; i < this.vehicles.length; i++) {
      const car = this.vehicles[i];
      car.scrapeIntensity *= 0.86;
      car.lastCollisionForce *= 0.90;

      if (isCountdown) {
        // Hold on grid during 3-2-1; allow revving; penalize full-throttle jump start so false start gives zero advantage
        const targetRpm = car.spec.idleRpm + car.throttle * (car.spec.redlineRpm * 0.72 - car.spec.idleRpm);
        car.rpm += (targetRpm - car.rpm) * Math.min(1, dt * 10);
        car.steerVisual += (car.steer * car.spec.maxSteerRad - car.steerVisual) * Math.min(1, dt * 14);
        if (car.isPlayer && car.throttle > 0.85) {
          car.falseStartBog = 0.55; // Slight clutch bog on GO if trying to jump start!
        } else if (car.isPlayer && car.throttle < 0.4) {
          car.falseStartBog = Math.max(0, car.falseStartBog - dt * 2.0);
        }
        continue;
      }

      if (!isRacing && this.racePhase !== 'finished') {
        continue;
      }

      this._integrateVehicle(car, dt);
      this._resolveBarriersAndObstacles(car, dt);
      this._checkRuntimeInvariantsAndProgress(car, dt);
    }

    if (isRacing || this.racePhase === 'finished') {
      this._resolveCarCollisions();
      this._updatePositions();
    }
  }

  _integrateVehicle(car, dt) {
    const spec = car.spec;
    const sinY = Math.sin(car.yaw);
    const cosY = Math.cos(car.yaw);
    // Forward vector in XZ: (sin(yaw), cos(yaw)), Right vector in XZ: (-cos(yaw), sin(yaw)) -> check:
    // Wait: at yaw = PI/2 (+X), sinY = 1, cosY = 0 -> fwd = (1, 0). Driver right on +X is +Z = (0, 1) = (-cosY, sinY)!
    // Verify cross: fwd x up = (sinY, 0, cosY) x (0, 1, 0) = (-cosY, 0, sinY)! Exact match!
    const fx = sinY;
    const fz = cosY;
    const rx = -cosY;
    const rz = sinY;

    // Decompose horizontal velocity into forward & lateral components
    let vFwd = car.vx * fx + car.vz * fz;
    let vLat = car.vx * rx + car.vz * rz;

    // 4-wheel raycast onto exact Road + Terrain colliders
    const halfWB = spec.wheelBase * 0.5;
    const halfTW = spec.trackWidth * 0.5;
    const wheelLocals = [
      [ halfWB, -halfTW], // FL
      [ halfWB,  halfTW], // FR
      [-halfWB, -halfTW], // RL
      [-halfWB,  halfTW]  // RR
    ];

    let sumSurfY = 0;
    let maxSurfY = -Infinity;
    let groundedCount = 0;
    let dominantSurface = 'asphalt';
    let frontY = 0, rearY = 0, leftY = 0, rightY = 0;

    for (let w = 0; w < 4; w++) {
      const [lf, lr] = wheelLocals[w];
      const wx = car.x + fx * lf + rx * lr;
      const wz = car.z + fz * lf + rz * lr;
      const hit = sampleWorldSurface(this.world, wx, wz, car.y + 3.5);
      sumSurfY += hit.y;
      if (hit.y > maxSurfY) maxSurfY = hit.y;
      if (w < 2) frontY += hit.y * 0.5; else rearY += hit.y * 0.5;
      if (w % 2 === 0) leftY += hit.y * 0.5; else rightY += hit.y * 0.5;

      const hubRestY = car.y - 0.16;
      const wheelBottomY = hubRestY - spec.wheelRadius;
      const distToGround = wheelBottomY - hit.y;
      car.wheelGroundDist[w] = Math.max(0, distToGround);

      if (distToGround <= 0.22) {
        car.wheelContact[w] = true;
        groundedCount++;
        car.wheelCompression[w] = Math.max(-0.12, Math.min(0.14, -distToGround));
      } else {
        car.wheelContact[w] = false;
        car.wheelCompression[w] = -0.12;
      }
      if (w === 2 || hit.surface !== 'asphalt') {
        dominantSurface = hit.surface;
      }
    }

    const centerHit = sampleWorldSurface(this.world, car.x, car.z, car.y + 3.5);
    if (centerHit.y > maxSurfY) maxSurfY = centerHit.y;
    const avgSurfY = sumSurfY * 0.25;
    car.surface = dominantSurface;
    const targetChassisY = Math.max(avgSurfY, centerHit.y - 0.06) + spec.wheelRadius + 0.16;

    if (groundedCount > 0 || car.y <= targetChassisY + 0.08) {
      car.inAir = false;
      car.airTime = 0;
      // Critically damped vertical suspension spring
      const yErr = targetChassisY - car.y;
      car.vy += (yErr * 165.0 - car.vy * 22.0) * dt;
      car.y += car.vy * dt;
      // Hard anti-sink floor so chassis floorpan NEVER drops below road/terrain crest (Section 3.3)
      const minAllowedY = maxSurfY + spec.wheelRadius + 0.04;
      if (car.y < minAllowedY) {
        car.y = minAllowedY;
        if (car.vy < 0) car.vy = 0;
      }
    } else {
      car.inAir = true;
      car.airTime += dt;
      car.vy -= 9.81 * 1.35 * dt;
      car.y += car.vy * dt;
      if (car.y <= targetChassisY) {
        car.y = targetChassisY;
        car.vy = 0;
        car.inAir = false;
      }
    }

    // Align chassis pitch & roll smoothly to terrain/road slope
    const slopePitch = -Math.atan2(frontY - rearY, spec.wheelBase);
    const slopeRoll = Math.atan2(rightY - leftY, spec.trackWidth);
    car.pitch += (slopePitch - car.pitch) * Math.min(1, dt * 16);
    car.roll += (slopeRoll - car.roll) * Math.min(1, dt * 16);

    // Surface grip & rolling drag modifiers
    let surfaceGripMul = 1.0;
    let rollingDrag = 0.22;
    if (car.surface === 'curb') {
      surfaceGripMul = 0.94;
      rollingDrag = 0.25;
    } else if (car.surface === 'grass') {
      surfaceGripMul = 0.72;
      rollingDrag = 1.15;
    } else if (car.surface === 'sand') {
      surfaceGripMul = 0.64;
      rollingDrag = 1.65;
    }

    if (car.falseStartBog > 0) {
      car.falseStartBog = Math.max(0, car.falseStartBog - dt);
    }

    // Speed-dependent steering response
    const absSpeed = Math.abs(vFwd);
    const speedFactor = 1.0 / (1.0 + Math.pow(absSpeed / 27.0, 1.35));
    const maxSteerNow = spec.maxSteerRad * (0.28 + 0.72 * speedFactor);
    const targetSteerAngle = car.steer * maxSteerNow;
    car.steerVisual += (targetSteerAngle - car.steerVisual) * Math.min(1, dt * 15.0);

    // Automatic 6-speed gearbox & RPM simulation
    this._updateGearbox(car, absSpeed, dt);

    // Longitudinal acceleration / braking / reverse
    let longAcc = 0;
    const bogMul = car.falseStartBog > 0 ? 0.35 : 1.0;
    const shiftCut = car.shiftTimer > 0 ? 0.25 : 1.0;

    if (!car.inAir) {
      if (car.throttle > 0.01) {
        const topRatio = Math.min(1.0, absSpeed / spec.maxSpeed);
        const torqueCurve = (1.0 - 0.58 * topRatio * topRatio) * shiftCut * bogMul;
        longAcc += car.throttle * spec.engineForce * torqueCurve * (0.75 + 0.25 * surfaceGripMul);
      }
      if (car.brake > 0.01) {
        if (vFwd > 0.8) {
          longAcc -= car.brake * spec.brakeForce * surfaceGripMul;
        } else {
          // Reverse gear up to -14 m/s
          longAcc -= car.brake * spec.engineForce * 0.55;
        }
      }
      if (car.handbrake > 0.1) {
        longAcc -= Math.sign(vFwd) * spec.handbrakeForce * 0.6;
      }

      // Gravity grade component along forward axis
      longAcc -= 9.81 * Math.sin(-car.pitch) * 0.65;
    }

    // Aerodynamic + rolling resistance
    const aeroDrag = 0.0029 * vFwd * Math.abs(vFwd);
    vFwd += (longAcc - aeroDrag - rollingDrag * vFwd) * dt;
    vFwd = Math.max(-14.0, Math.min(spec.maxSpeed * 1.05, vFwd));

    // Arcade-with-weight cornering & controllable drift
    if (!car.inAir && Math.abs(vFwd) > 0.4) {
      const steerSign = vFwd >= 0 ? 1 : -1;
      const desiredYawRate = (Math.min(34.0, Math.abs(vFwd)) / spec.wheelBase) * Math.tan(car.steerVisual) * steerSign;
      const grip = spec.gripAsphalt * surfaceGripMul * (car.handbrake > 0.1 ? 0.52 : 1.0);
      car.yawRate += (desiredYawRate - car.yawRate) * Math.min(1, dt * (8.5 + grip * 0.35));

      // Centripetal transfer & lateral tire grip restoring force (allows smooth controllable rear slip!)
      vLat -= vFwd * car.yawRate * 0.22 * dt;
      const latDamp = Math.min(1, grip * 0.52 * dt);
      vLat *= (1.0 - latDamp);
    } else {
      car.yawRate *= (1.0 - Math.min(1, 5.0 * dt));
      vLat *= (1.0 - Math.min(1, 3.0 * dt));
    }

    car.yaw += car.yawRate * dt;
    const nSin = Math.sin(car.yaw);
    const nCos = Math.cos(car.yaw);
    const nFx = nSin, nFz = nCos;
    const nRx = -nCos, nRz = nSin;

    car.vx = nFx * vFwd + nRx * vLat;
    car.vz = nFz * vFwd + nRz * vLat;

    car.x += car.vx * dt;
    car.z += car.vz * dt;

    car.forwardSpeed = vFwd;
    car.lateralSpeed = vLat;
    car.speedKmh = Math.hypot(car.vx, car.vz) * 3.6;
    car.wheelSpin += (vFwd / spec.wheelRadius) * dt;

    // Tire slip metric (squeal proportional to lateral slip + hard brake/burnout)
    const latSlip = Math.abs(vLat) / Math.max(4.0, Math.abs(vFwd));
    const brakeSlip = (car.brake > 0.8 && absSpeed > 14) ? 0.28 : 0;
    const hbSlip = (car.handbrake > 0.2 && absSpeed > 6) ? 0.55 : 0;
    car.slipRatio = car.inAir ? 0 : Math.min(1.0, Math.max(0, latSlip * 1.65 - 0.14) + brakeSlip + hbSlip);

    // Dynamic visual body roll & pitch from lateral/longitudinal G
    const targetBodyRoll = Math.max(-0.075, Math.min(0.075, -(vFwd * car.yawRate) * 0.0038));
    const targetBodyPitch = Math.max(-0.045, Math.min(0.045, -longAcc * 0.0022));
    car.bodyRoll += (targetBodyRoll - car.bodyRoll) * Math.min(1, dt * 11.0);
    car.bodyPitch += (targetBodyPitch - car.bodyPitch) * Math.min(1, dt * 11.0);
  }

  _updateGearbox(car, absSpeed, dt) {
    const spec = car.spec;
    if (car.shiftTimer > 0) car.shiftTimer = Math.max(0, car.shiftTimer - dt);

    const ratios = spec.gearRatios;
    const topPerGear = ratios.map((_, idx) => spec.maxSpeed * ((idx + 1) / ratios.length) * (idx === 0 ? 1.18 : 1.02));

    let desiredGear = car.gear;
    if (absSpeed > topPerGear[car.gear - 1] * 0.94 && car.gear < ratios.length && car.shiftTimer <= 0) {
      desiredGear = car.gear + 1;
    } else if (car.gear > 1 && absSpeed < topPerGear[car.gear - 2] * 0.76 && car.shiftTimer <= 0) {
      desiredGear = car.gear - 1;
    }

    if (desiredGear !== car.gear) {
      const oldGear = car.gear;
      car.gear = desiredGear;
      car.shiftTimer = 0.13;
      car.lastGearShiftTime = this.simTime;
      if (car.isPlayer) {
        this.eventLog.push({ type: 'gear_shift', time: +this.simTime.toFixed(2), from: oldGear, to: desiredGear });
      }
    }

    const gearMinSpeed = car.gear === 1 ? 0 : topPerGear[car.gear - 2] * 0.52;
    const gearMaxSpeed = topPerGear[car.gear - 1];
    const u = Math.max(0, Math.min(1.04, (absSpeed - gearMinSpeed) / Math.max(4.0, gearMaxSpeed - gearMinSpeed)));
    let targetRpm = spec.idleRpm + u * (spec.redlineRpm - spec.idleRpm);
    if (absSpeed < 2.0 && car.throttle > 0.1) {
      targetRpm = Math.max(targetRpm, spec.idleRpm + car.throttle * 2600);
    }

    // Rev limiter oscillation near redline
    if (targetRpm >= spec.redlineRpm * 0.985 && car.throttle > 0.5) {
      car.atLimiter = true;
      const flutter = Math.sin(this.simTime * 88.0) * 145;
      targetRpm = spec.redlineRpm - 90 + flutter;
    } else {
      car.atLimiter = false;
    }

    if (car.shiftTimer > 0) targetRpm *= 0.86;
    car.rpm += (targetRpm - car.rpm) * Math.min(1, dt * 16.0);
  }

  _resolveBarriersAndObstacles(car, dt) {
    const proj = this.spline.projectXZ(car.x, car.z);
    car.s = proj.s;
    car.d = proj.d;
    car.zone = proj.zone;
    car.isBridge = proj.isBridge;

    const halfCarW = car.spec.width * 0.5;
    const barriers = this.world.barrierRuns || [];

    // 1. Check continuous spline-aligned guardrails, walls, and bridge parapets
    for (let i = 0; i < barriers.length; i++) {
      const b = barriers[i];
      if (proj.s < b.sStart - 1.5 || proj.s > b.sEnd + 1.5) continue;
      if (Math.sign(proj.d) !== b.sideSign) continue;

      const limitAbsD = proj.halfWidth + b.latOffset - halfCarW;
      if (proj.absD > limitAbsD) {
        // Push car cleanly back inside barrier face
        const penetration = proj.absD - limitAbsD;
        const smp = proj.sample;
        const pushSign = -b.sideSign; // push toward track centerline
        car.x += smp.rxz_x * pushSign * (penetration + 0.01);
        car.z += smp.rxz_z * pushSign * (penetration + 0.01);

        // Reflect/damp velocity component into barrier + align yaw gently along rail
        const vInto = (car.vx * smp.rxz_x + car.vz * smp.rxz_z) * b.sideSign;
        if (vInto > 0) {
          const impact = vInto;
          car.vx -= smp.rxz_x * b.sideSign * (vInto * 1.18);
          car.vz -= smp.rxz_z * b.sideSign * (vInto * 1.18);
          // Tangential guardrail scrape friction
          car.vx *= 0.985;
          car.vz *= 0.985;
          car.scrapeIntensity = Math.min(1.0, Math.max(car.scrapeIntensity, Math.hypot(car.vx, car.vz) / 28.0));
          if (impact > 3.2) {
            car.lastCollisionForce = Math.max(car.lastCollisionForce, Math.min(1.0, impact / 18.0));
            car.lastCollisionTime = this.simTime;
            if (car.isPlayer) {
              this.eventLog.push({ type: 'barrier_collision', time: +this.simTime.toFixed(2), impact: +impact.toFixed(2) });
            }
          }
        }
        // Gently steer yaw parallel to barrier so car glides along guardrail realistically
        const trackYaw = Math.atan2(smp.fxz_x, smp.fxz_z);
        let dYaw = trackYaw - car.yaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        if (Math.abs(dYaw) < 1.1) {
          car.yaw += dYaw * Math.min(1, dt * 7.5);
        }
      }
    }

    // 2. Hard corridor corridor bound (+/- 34 m from centerline) & Building / Rock / Tree solid colliders
    if (proj.absD > proj.halfWidth + 28.0) {
      const over = proj.absD - (proj.halfWidth + 28.0);
      const smp = proj.sample;
      const pushSign = proj.d >= 0 ? -1 : 1;
      car.x += smp.rxz_x * pushSign * over;
      car.z += smp.rxz_z * pushSign * over;
      car.vx *= 0.85;
      car.vz *= 0.85;
    }

    const solidCircles = this.world.obstacleColliders || [];
    const carRadius = car.spec.width * 0.56;
    for (let i = 0; i < solidCircles.length; i++) {
      const obs = solidCircles[i];
      const dx = car.x - obs.x;
      const dz = car.z - obs.z;
      const minD = carRadius + obs.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 1e-6) {
        const dist = Math.sqrt(d2);
        const nx = dx / dist;
        const nz = dz / dist;
        const pen = minD - dist;
        car.x += nx * (pen + 0.02);
        car.z += nz * (pen + 0.02);
        const vn = car.vx * nx + car.vz * nz;
        if (vn < 0) {
          const imp = -vn;
          car.vx -= nx * vn * 1.25;
          car.vz -= nz * vn * 1.25;
          if (imp > 2.5) {
            car.lastCollisionForce = Math.max(car.lastCollisionForce, Math.min(1.0, imp / 16.0));
            car.lastCollisionTime = this.simTime;
            if (car.isPlayer) {
              this.eventLog.push({ type: 'object_collision', time: +this.simTime.toFixed(2), impact: +imp.toFixed(2) });
            }
          }
        }
      }
    }
  }

  _resolveCarCollisions() {
    const N = this.vehicles.length;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = this.vehicles[i];
        const b = this.vehicles[j];
        if (Math.abs(a.y - b.y) > 1.8) continue;

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > 26.0 || distSq < 1e-6) continue;

        // Anisotropic capsule/ellipse radius based on relative angle along car bodies
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;

        const effRadius = (car) => {
          const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
          const cosA = Math.abs(fx * nx + fz * nz);
          const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
          const hl = car.spec.length * 0.47;
          const hw = car.spec.width * 0.48;
          return Math.hypot(hl * cosA, hw * sinA);
        };

        const minSep = effRadius(a) + effRadius(b);
        if (dist < minSep) {
          const pen = (minSep - dist) * 0.52;
          a.x -= nx * pen;
          a.z -= nz * pen;
          b.x += nx * pen;
          b.z += nz * pen;

          const rvx = b.vx - a.vx;
          const rvz = b.vz - a.vz;
          const relVn = rvx * nx + rvz * nz;
          if (relVn < 0) {
            const restitution = 0.28;
            const jImp = -(1 + restitution) * relVn * 0.5;
            a.vx -= nx * jImp;
            a.vz -= nz * jImp;
            b.vx += nx * jImp;
            b.vz += nz * jImp;

            const force = Math.min(1.0, Math.abs(relVn) / 15.0);
            if (force > 0.14) {
              a.lastCollisionForce = Math.max(a.lastCollisionForce, force);
              b.lastCollisionForce = Math.max(b.lastCollisionForce, force);
              a.lastCollisionTime = this.simTime;
              b.lastCollisionTime = this.simTime;
              if (a.isPlayer || b.isPlayer) {
                this.eventLog.push({ type: 'car_collision', time: +this.simTime.toFixed(2), force: +force.toFixed(2) });
              }
            }
          }
        }
      }
    }
  }

  _checkRuntimeInvariantsAndProgress(car, dt) {
    // Re-sample ground directly below car center for Section 3.3 runtime invariants
    const surf = sampleWorldSurface(this.world, car.x, car.z, car.y + 4.0);
    const proj = surf.proj;
    car.s = proj.s;
    car.d = proj.d;

    // Section 3.3 Check 1: Chassis floorpan NEVER below road/terrain surface; fall-out-of-world detection
    const chassisBottomY = car.y - car.spec.wheelRadius;
    const outOfBounds = Math.abs(car.x) > 895 || car.z < -795 || car.z > 455 || !Number.isFinite(car.y);
    const belowTerrain = chassisBottomY < surf.y - 0.02;

    if (outOfBounds || belowTerrain) {
      this.integrityLog.push({
        time: +this.simTime.toFixed(3),
        car: car.name,
        reason: outOfBounds ? 'out_of_world' : 'below_surface',
        x: +car.x.toFixed(2),
        y: +car.y.toFixed(2),
        surfY: +surf.y.toFixed(2)
      });
      this.placeCarOnSpline(car, car.lastValidS, 0);
      return;
    }

    // Track last valid on-road spline point
    if (proj.absD <= proj.halfWidth * 0.92 && !car.inAir) {
      car.lastValidS = proj.s;
    }

    // Section 8 Gameplay Auto-Reset: >3s off-track or stopped (during active race before finishing)
    if (this.racePhase === 'racing' && !car.finished) {
      if (proj.absD > proj.halfWidth + 2.6) {
        car.offTrackTimer += dt;
      } else {
        car.offTrackTimer = Math.max(0, car.offTrackTimer - dt * 2.0);
      }

      if (this.simTime > 4.0 && Math.abs(car.forwardSpeed) < 1.1) {
        car.stuckTimer += dt;
      } else {
        car.stuckTimer = 0;
      }

      const overturned = Math.abs(car.roll) > 1.25 || Math.abs(car.pitch) > 1.25;
      if (overturned || car.offTrackTimer > 3.1 || car.stuckTimer > 3.2) {
        this.gameplayResetLog.push({
          time: +this.simTime.toFixed(2),
          car: car.name,
          reason: overturned ? 'overturned' : (car.offTrackTimer > 3.1 ? 'off_track_3s' : 'stopped_3s')
        });
        this.placeCarOnSpline(car, car.lastValidS, 0);
        return;
      }
    }

    // Section 10: Sequential Checkpoints & Anti-Cut Lap Counting
    if (this.racePhase === 'racing' && !car.finished) {
      car.currentLapTime += dt;
      car.totalRaceTime += dt;

      const cps = this.spline.checkpoints;
      const cpCount = cps.length;
      const targetCp = cps[car.nextCheckpoint];
      const deltaToCp = Math.abs(this.spline.shortestDeltaS(car.s, targetCp.s));

      // Must pass within checkpoint gate corridor (|d| <= halfWidth + 4.0m) in strict sequence!
      if (deltaToCp < 24.0 && proj.absD <= proj.halfWidth + 4.0) {
        if (car.nextCheckpoint === 0) {
          // Crossing Start/Finish line ONLY counts if ALL checkpoints 1..(cpCount-1) were visited!
          const allMask = (1 << cpCount) - 1;
          if (car.checkpointsMask === allMask && car.currentLapTime > 12.0) {
            if (!car.bestLapTime || car.currentLapTime < car.bestLapTime) {
              car.bestLapTime = car.currentLapTime;
            }
            car.completedLaps += 1;
            car.currentLapTime = 0;
            car.checkpointsMask = 1;
            car.nextCheckpoint = 1;

            if (car.completedLaps >= this.totalLaps) {
              car.finished = true;
              car.finishTime = car.totalRaceTime;
              if (car.isPlayer) {
                this._finalizeRaceWithProjectedAiTimes();
              }
            } else {
              car.lap = car.completedLaps + 1;
            }
          }
        } else {
          car.checkpointsMask |= (1 << car.nextCheckpoint);
          car.nextCheckpoint = (car.nextCheckpoint + 1) % cpCount;
        }
      }
    }
  }

  _finalizeRaceWithProjectedAiTimes() {
    this.racePhase = 'finished';
    const L = this.spline.totalLength;
    for (const car of this.vehicles) {
      if (!car.finished) {
        const coveredDist = car.completedLaps * L + this._validatedLapProgressM(car);
        const totalNeeded = this.totalLaps * L;
        const remainingM = Math.max(15.0, totalNeeded - coveredDist);
        const avgPace = Math.max(18.0, coveredDist / Math.max(1.0, car.totalRaceTime));
        car.projectedFinish = true;
        car.finished = true;
        car.finishTime = car.totalRaceTime + remainingM / avgPace;
      }
    }
  }

  _validatedLapProgressM(car) {
    // Anti-cut progress: bounded by sequential checkpoint index so cutting never inflates position!
    const cpCount = this.spline.checkpoints.length;
    const cpStep = this.spline.totalLength / cpCount;
    const maxValidatedCp = car.nextCheckpoint === 0 ? cpCount - 1 : car.nextCheckpoint - 1;
    const maxAllowedS = Math.min(this.spline.totalLength, (maxValidatedCp + 1.25) * cpStep);
    // Avoid wrap jump near s = totalLength - 20 before crossing start
    if (maxValidatedCp === 0 && car.s > this.spline.totalLength * 0.75) {
      return 0;
    }
    return Math.min(car.s, maxAllowedS);
  }

  _updatePositions() {
    const L = this.spline.totalLength;
    const sorted = [...this.vehicles].sort((a, b) => {
      if (a.finished && b.finished && a.finishTime != null && b.finishTime != null) {
        return a.finishTime - b.finishTime;
      }
      const progA = a.completedLaps * L + this._validatedLapProgressM(a);
      const progB = b.completedLaps * L + this._validatedLapProgressM(b);
      return progB - progA;
    });

    for (let i = 0; i < sorted.length; i++) {
      sorted[i].position = i + 1;
    }

    // Track AI-vs-AI overtakes for Test 5 ("ao menos 1 ultrapassagem entre IAs")
    if (this.racePhase === 'racing' && this.simTime > 3.0) {
      const aiOrder = sorted.filter(c => !c.isPlayer).map(c => c.index).join(',');
      if (this._lastAiOrder && this._lastAiOrder !== aiOrder) {
        this.overtakeCount++;
      }
      this._lastAiOrder = aiOrder;
    }
  }
}
