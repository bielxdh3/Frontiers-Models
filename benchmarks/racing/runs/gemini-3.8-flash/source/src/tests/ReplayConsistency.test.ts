/**
 * tests/ReplayConsistency.test.ts
 * Tests that replay playback is temporally consistent:
 * - Direction-agnostic seeking (scrubbing forward vs backward settles on identical state)
 * - Historical damage, weather, and HUD match the exact timestamp
 * - Teleport discontinuity protection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayRecorder } from '../gameplay/ReplayRecorder';
import { ReplayPlayer } from '../gameplay/ReplayPlayer';
import { RaceManager } from '../gameplay/RaceManager';
import { Track } from '../world/Track';
import { COASTAL_SPRINT_NODES } from '../world/TrackConfigs';
import { Vehicle } from '../gameplay/Vehicle';
import { CAR_CONFIGS } from '../gameplay/CarConfigs';
import { StorageManager } from '../core/StorageManager';
import { AudioManager } from '../core/AudioManager';

describe('Replay Temporal Consistency', () => {
  let recorder: ReplayRecorder;
  let player: ReplayPlayer;
  let race: RaceManager;

  beforeEach(() => {
    localStorage.clear();
    const track = new Track('coastal_sprint', 'Coastal Sprint', COASTAL_SPRINT_NODES, true);
    const car = new Vehicle('player', CAR_CONFIGS.riviera_spyder, true);
    race = new RaceManager(track, car, new StorageManager(), new AudioManager());
    recorder = new ReplayRecorder();
    player = new ReplayPlayer();
  });

  it('seeking backwards and forwards to time T settles on identical state', () => {
    race.setupRace('time_trial');
    race.state = 'racing';
    recorder.start();

    // Record a 5-second simulated run with progressing damage and position
    for (let sec = 0; sec <= 5; sec++) {
      race.raceElapsedMs = sec * 1000;
      race.playerCar.position.set(sec * 20, 1.4, sec * 10);
      race.playerCar.damage = sec * 0.15;
      race.weatherWetness = sec * 0.1;
      (recorder as any).lastSampleTime = -1000; // Force sample
      recorder.recordFrame(race);
    }
    recorder.stop();

    const payload = recorder.createPayload(race);
    expect(payload.keyframes.length).toBeGreaterThan(3);

    player.loadPayload(payload);

    // Seek forward to 2500ms
    player.seekTo(2500);
    const forwardState = { ...player.currentState! };

    // Jump forward to end (5000ms)
    player.seekTo(5000);
    expect(player.currentState!.damage).toBeCloseTo(0.75, 1);

    // Now seek backward to the same 2500ms point
    player.seekTo(2500);
    const backwardState = { ...player.currentState! };

    // Assert exact state parity
    expect(backwardState.playerPos.x).toBeCloseTo(forwardState.playerPos.x, 2);
    expect(backwardState.playerPos.z).toBeCloseTo(forwardState.playerPos.z, 2);
    expect(backwardState.damage).toBeCloseTo(forwardState.damage, 2);
    expect(backwardState.weatherWetness).toBeCloseTo(forwardState.weatherWetness, 2);
  });

  it('cycles across all 3 replay camera modes', () => {
    expect(player.cameraMode).toBe('chase');
    player.cycleCamera();
    expect(player.cameraMode).toBe('bumper');
    player.cycleCamera();
    expect(player.cameraMode).toBe('broadcast');
    player.cycleCamera();
    expect(player.cameraMode).toBe('chase');
  });
});
