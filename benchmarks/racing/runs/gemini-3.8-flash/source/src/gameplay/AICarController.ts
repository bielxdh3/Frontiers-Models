/**
 * AICarController.ts
 * Manages the 5 concurrent AI opponents with stable identities, distinct liveries,
 * nuanced path-following, local obstacle avoidance, dynamic overtaking,
 * and three fixed difficulty tiers (Easy, Normal, Hard).
 * STRICT RULE: No rubber-banding or catch-up handicaps.
 */

import * as THREE from 'three';
import { Vehicle, VehicleInputs } from './Vehicle';
import { Track } from '../world/Track';
import { CAR_CONFIGS } from './CarConfigs';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIRivalIdentity {
  id: string;
  name: string;
  number: number;
  carConfigId: string;
  bodyColor: number;
  accentColor: number;
  personality: 'aggressive' | 'smooth' | 'drifter' | 'speedster' | 'consistent';
}

export const AI_RIVALS: AIRivalIdentity[] = [
  {
    id: 'rival_rossi',
    name: 'Marco "Apex" Rossi',
    number: 7,
    carConfigId: 'monaco_hyperion',
    bodyColor: 0xcc0000,   // Racing Rosso Red
    accentColor: 0xffffff, // White stripes
    personality: 'aggressive'
  },
  {
    id: 'rival_vance',
    name: 'Elena "Breeze" Vance',
    number: 22,
    carConfigId: 'riviera_spyder',
    bodyColor: 0x00b4d8,   // Aqua Teal
    accentColor: 0xe0e1dd, // Silver Pearl
    personality: 'smooth'
  },
  {
    id: 'rival_tanaka',
    name: 'Kai "Drift" Tanaka',
    number: 88,
    carConfigId: 'riviera_spyder',
    bodyColor: 0xffb703,   // Gold Rush
    accentColor: 0x111111, // Gloss Black
    personality: 'drifter'
  },
  {
    id: 'rival_laurent',
    name: 'Sophie "Comet" Laurent',
    number: 14,
    carConfigId: 'corsica_gt',
    bodyColor: 0x4361ee,   // Electric Royal Blue
    accentColor: 0xf72585, // Neon Magenta
    personality: 'speedster'
  },
  {
    id: 'rival_silva',
    name: 'Lucas "Thunder" Silva',
    number: 55,
    carConfigId: 'corsica_gt',
    bodyColor: 0x2b9348,   // Emerald Green
    accentColor: 0xffea00, // Vibrant Canary Yellow
    personality: 'consistent'
  }
];

export class AICarController {
  public vehicle: Vehicle;
  public identity: AIRivalIdentity;
  public difficulty: AIDifficulty = 'normal';

  // AI State
  private targetLateralOffset = 0;
  private offsetChangeTimer = 0;
  private nitroCooldown = 0;
  private stuckTimer = 0;

  constructor(identity: AIRivalIdentity, difficulty: AIDifficulty) {
    this.identity = identity;
    this.difficulty = difficulty;
    const config = CAR_CONFIGS[identity.carConfigId] || CAR_CONFIGS.corsica_gt;
    this.vehicle = new Vehicle(identity.id, config, false);
    this.targetLateralOffset = (Math.random() - 0.5) * 4.0;
  }

  public update(dt: number, track: Track, allCars: Vehicle[], weatherWetness: number): void {
    const inputs = this.computeInputs(dt, track, allCars, weatherWetness);
    this.vehicle.update(dt, inputs, track, weatherWetness);

    // Check if car is stuck (e.g. against barrier for several seconds)
    if (this.vehicle.speedKmh < 5 && !this.vehicle.isInvulnerable) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 3.5) {
        this.vehicle.recoverToTrack(track);
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  private computeInputs(dt: number, track: Track, allCars: Vehicle[], weatherWetness: number): VehicleInputs {
    const inputs: VehicleInputs = {
      throttle: 0,
      steer: 0,
      drift: false,
      nitro: false,
      recover: false
    };

    const speed = this.vehicle.speedKmh;
    const pos = this.vehicle.position;

    // Difficulty tuning parameters (Strictly static, NO rubber-banding)
    let lookaheadDist = 28;
    let maxThrottle = 0.94;
    let cornerBrakeAggression = 1.0;
    let avoidanceStrength = 1.0;

    switch (this.difficulty) {
      case 'easy':
        lookaheadDist = 20;
        maxThrottle = 0.82;
        cornerBrakeAggression = 0.75; // Brakes earlier, drives slower
        avoidanceStrength = 1.3;
        break;
      case 'normal':
        lookaheadDist = 28;
        maxThrottle = 0.94;
        cornerBrakeAggression = 0.95;
        avoidanceStrength = 1.0;
        break;
      case 'hard':
        lookaheadDist = 36;
        maxThrottle = 1.0;
        cornerBrakeAggression = 1.25; // Late braker, pushes limits
        avoidanceStrength = 0.85;
        break;
    }

    // Dynamic racing line variation
    this.offsetChangeTimer -= dt;
    if (this.offsetChangeTimer <= 0) {
      this.offsetChangeTimer = 2.0 + Math.random() * 3.0;
      this.targetLateralOffset = (Math.random() - 0.5) * 5.0; // Stay inside road width
    }

    // 1. Calculate Target Point on Track ahead
    const currentDist = this.vehicle.currentDistanceAlongTrack;
    const targetDist = currentDist + Math.max(15, speed * 0.45 * (lookaheadDist / 28));

    const targetCenter = track.getPointAtDistance(targetDist);
    const targetTangent = track.getTangentAtDistance(targetDist);
    const targetRight = new THREE.Vector3().crossVectors(targetTangent, new THREE.Vector3(0, 1, 0)).normalize();

    // Desired world target point incorporating racing line offset
    const targetPoint = targetCenter.clone().add(targetRight.clone().multiplyScalar(this.targetLateralOffset));

    // 2. Obstacle / Other Cars Avoidance
    const toTarget = new THREE.Vector3().subVectors(targetPoint, pos);
    let avoidanceSteer = 0;

    for (const other of allCars) {
      if (other.id === this.vehicle.id) continue;
      const relPos = new THREE.Vector3().subVectors(other.position, pos);
      const forwardDist = relPos.dot(this.vehicle.forward);
      const lateralDist = relPos.dot(this.vehicle.right);

      // If car is ahead within collision threat zone
      if (forwardDist > 0 && forwardDist < 16 && Math.abs(lateralDist) < 3.2) {
        // Steer away from the other car
        const steerDir = lateralDist > 0 ? -1 : 1;
        avoidanceSteer += (steerDir * (18 - forwardDist) * 0.05) * avoidanceStrength;
      }
    }

    // 3. Compute Steering Angle to reach target point
    toTarget.y = 0;
    toTarget.normalize();
    const forward = this.vehicle.forward;
    const right = this.vehicle.right;

    const angleDiff = Math.atan2(toTarget.dot(right), toTarget.dot(forward));
    let desiredSteer = (angleDiff / 0.5) + avoidanceSteer;
    inputs.steer = Math.max(-1.0, Math.min(1.0, desiredSteer));

    // 4. Curvature & Speed Control (Braking before tight turns)
    const futureTang1 = track.getTangentAtDistance(currentDist + 15);
    const futureTang2 = track.getTangentAtDistance(currentDist + 35);
    const curveCurvature = 1.0 - Math.max(0, futureTang1.dot(futureTang2)); // 0 = straight, >0.2 = sharp curve

    // Safe cornering speed based on curvature and wetness
    const wetFriction = 1.0 - 0.3 * weatherWetness;
    const safeCornerSpeedKmh = Math.max(65, (180 - curveCurvature * 280) * wetFriction);

    if (speed > safeCornerSpeedKmh * (1.1 / cornerBrakeAggression)) {
      inputs.throttle = -0.8; // Apply braking before corner
    } else {
      inputs.throttle = maxThrottle;
    }

    // 5. Drift Behavior for Drifter Personality
    if (this.identity.personality === 'drifter' && curveCurvature > 0.12 && speed > 55) {
      inputs.drift = true;
    }

    // 6. Nitro Strategy on Straights
    this.nitroCooldown -= dt;
    if (
      curveCurvature < 0.04 &&
      speed > 110 &&
      this.vehicle.nitroAmount > 25 &&
      this.nitroCooldown <= 0
    ) {
      inputs.nitro = true;
      if (Math.random() < 0.05) {
        this.nitroCooldown = 4.0; // Pause nitro burst
      }
    }

    return inputs;
  }
}
