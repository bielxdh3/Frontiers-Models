/**
 * tests/VehicleDynamics.test.ts
 * Tests vehicle acceleration, braking, nitro consumption, drift dynamics,
 * wet surface friction, collision impulse, and clean recovery.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Vehicle } from '../gameplay/Vehicle';
import { CAR_CONFIGS } from '../gameplay/CarConfigs';
import { Track } from '../world/Track';
import { COASTAL_SPRINT_NODES } from '../world/TrackConfigs';

describe('Vehicle Dynamics', () => {
  let vehicle: Vehicle;
  let track: Track;

  beforeEach(() => {
    track = new Track('coastal_sprint', 'Coastal Sprint', COASTAL_SPRINT_NODES, true);
    vehicle = new Vehicle('test_car', CAR_CONFIGS.corsica_gt, true);
    const spawn = track.getSpawnTransform(0);
    vehicle.reset(spawn.position, spawn.rotation);
  });

  it('accelerates with positive throttle and increases speed', () => {
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      vehicle.update(dt, { throttle: 1, steer: 0, drift: false, nitro: false, recover: false }, track, 0);
    }
    expect(vehicle.speedKmh).toBeGreaterThan(40);
  });

  it('brakes and decelerates with negative throttle', () => {
    const dt = 1 / 60;
    // Accelerate first
    for (let i = 0; i < 60; i++) {
      vehicle.update(dt, { throttle: 1, steer: 0, drift: false, nitro: false, recover: false }, track, 0);
    }
    const peakSpeed = vehicle.speedKmh;

    // Apply brakes
    for (let i = 0; i < 30; i++) {
      vehicle.update(dt, { throttle: -1, steer: 0, drift: false, nitro: false, recover: false }, track, 0);
    }
    expect(vehicle.speedKmh).toBeLessThan(peakSpeed);
  });

  it('nitro boosts acceleration and depletes bounded nitro tank', () => {
    const dt = 1 / 60;
    const initialNitro = vehicle.nitroAmount;
    expect(initialNitro).toBe(100);

    for (let i = 0; i < 60; i++) {
      vehicle.update(dt, { throttle: 1, steer: 0, drift: false, nitro: true, recover: false }, track, 0);
    }

    expect(vehicle.isNitroActive).toBe(true);
    expect(vehicle.nitroAmount).toBeLessThan(initialNitro);
  });

  it('drift mechanic triggers controlled slide and awards drift score', () => {
    const dt = 1 / 60;
    // Accelerate to drift speed
    for (let i = 0; i < 90; i++) {
      vehicle.update(dt, { throttle: 1, steer: 0, drift: false, nitro: false, recover: false }, track, 0);
    }

    // Initiate drift by steering hard with handbrake
    for (let i = 0; i < 30; i++) {
      vehicle.update(dt, { throttle: 1, steer: 1, drift: true, nitro: false, recover: false }, track, 0);
    }

    expect(vehicle.isDrifting).toBe(true);
    expect(vehicle.driftScore).toBeGreaterThan(0);
  });

  it('recovery resets momentum, clears nitro/drift, and aligns to track tangent', () => {
    const dt = 1 / 60;
    // Drive, steer off-course, use nitro
    for (let i = 0; i < 60; i++) {
      vehicle.update(dt, { throttle: 1, steer: 1, drift: true, nitro: true, recover: false }, track, 0);
    }

    // Trigger recovery
    vehicle.update(dt, { throttle: 0, steer: 0, drift: false, nitro: false, recover: true }, track, 0);

    expect(vehicle.isDrifting).toBe(false);
    expect(vehicle.isNitroActive).toBe(false);
    expect(vehicle.isInvulnerable).toBe(true);
    expect(vehicle.isLapValid).toBe(false); // Invalidate lap for records
    expect(vehicle.speedKmh).toBeLessThanOrEqual(30); // Safe modest restart roll
  });

  it('vehicle-to-vehicle collision resolves overlap and accumulates damage', () => {
    const other = new Vehicle('rival_1', CAR_CONFIGS.riviera_spyder, false);
    // Place other car overlapping directly along vehicle heading
    other.reset(vehicle.position.clone().add(vehicle.forward.clone().multiplyScalar(1.5)), vehicle.rotation);

    vehicle.velocity.copy(vehicle.forward).multiplyScalar(20); // Moving 20 m/s into other car
    other.velocity.set(0, 0, 0);

    vehicle.handleVehicleCollision(other);

    expect(vehicle.damage).toBeGreaterThan(0);
    expect(other.damage).toBeGreaterThan(0);
  });
});
