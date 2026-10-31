/**
 * tests/RaceManager.test.ts
 * Tests the three game modes:
 * - Time Trial: 3 laps, best valid single lap, invalid lap handling, zero false records
 * - Race vs AI: 6 cars, standings ordered by distance & laps, finished status
 * - Checkpoint Run: countdown timer, checkpoint bonus time, score combo, failure on timeout
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { RaceManager } from '../gameplay/RaceManager';
import { Track } from '../world/Track';
import { COASTAL_SPRINT_NODES } from '../world/TrackConfigs';
import { Vehicle } from '../gameplay/Vehicle';
import { CAR_CONFIGS } from '../gameplay/CarConfigs';
import { StorageManager } from '../core/StorageManager';
import { AudioManager } from '../core/AudioManager';

describe('RaceManager Modes and Rules', () => {
  let track: Track;
  let player: Vehicle;
  let storage: StorageManager;
  let audio: AudioManager;
  let race: RaceManager;

  beforeEach(() => {
    localStorage.clear();
    track = new Track('coastal_sprint', 'Coastal Sprint', COASTAL_SPRINT_NODES, true);
    player = new Vehicle('player', CAR_CONFIGS.riviera_spyder, true);
    storage = new StorageManager();
    audio = new AudioManager();
    race = new RaceManager(track, player, storage, audio);
  });

  it('countdown sequence freezes race clock until GO!', () => {
    race.setupRace('time_trial');
    expect(race.state).toBe('countdown');

    const dt = 1 / 60;
    // Step for 1 second
    for (let i = 0; i < 60; i++) {
      race.update(dt);
    }
    expect(race.state).toBe('countdown');
    expect(race.raceElapsedMs).toBe(0); // Clock must NOT advance during countdown

    // Step through remaining countdown to GO!
    for (let i = 0; i < 150; i++) {
      race.update(dt);
    }
    expect(race.state).toBe('racing');
    expect(race.raceElapsedMs).toBeGreaterThan(0);
  });

  it('Time Trial records valid and invalid laps, selecting the best valid lap', () => {
    race.setupRace('time_trial');
    race.state = 'racing';

    // Simulate Lap 1 (Valid: 40,000ms)
    race.currentLapTimeMs = 40000;
    player.isLapValid = true;
    (race as any).onCarCompletedLap(player);

    expect(race.lapTimes.length).toBe(1);
    expect(race.lapTimes[0].isValid).toBe(true);
    expect(race.bestValidLapMs).toBe(40000);

    // Simulate Lap 2 (Invalid shortcut/recovery: 25,000ms)
    race.currentLapTimeMs = 25000;
    player.isLapValid = false;
    (race as any).onCarCompletedLap(player);

    expect(race.lapTimes.length).toBe(2);
    expect(race.lapTimes[1].isValid).toBe(false);
    // Best valid lap must remain 40,000ms (invalid 25s lap is rejected)
    expect(race.bestValidLapMs).toBe(40000);

    // Simulate Lap 3 (Valid faster: 38,000ms)
    race.currentLapTimeMs = 38000;
    player.isLapValid = true;
    (race as any).onCarCompletedLap(player);

    expect(race.lapTimes.length).toBe(3);
    expect(race.bestValidLapMs).toBe(38000);
  });

  it('Time Trial with all 3 invalid laps produces no best valid lap and no personal record', () => {
    race.setupRace('time_trial');
    race.state = 'racing';

    for (let lap = 1; lap <= 3; lap++) {
      race.currentLapTimeMs = 35000;
      player.isLapValid = false;
      (race as any).onCarCompletedLap(player);
    }

    expect(race.bestValidLapMs).toBeNull();
    expect(storage.getBestRecord('coastal_sprint')).toBeNull();
  });

  it('Race vs AI standings correctly ranks 6 concurrent cars by lap and track progress', () => {
    race.setupRace('race', 'normal');
    race.state = 'racing';

    expect(race.allCars.length).toBe(6);
    expect(race.standings.length).toBe(6);

    // Give player lead progress
    player.currentLap = 2;
    player.currentDistanceAlongTrack = 500;

    // AI car 1 is behind
    race.aiControllers[0].vehicle.currentLap = 2;
    race.aiControllers[0].vehicle.currentDistanceAlongTrack = 300;

    // AI car 2 is a lap behind
    race.aiControllers[1].vehicle.currentLap = 1;
    race.aiControllers[1].vehicle.currentDistanceAlongTrack = 800;

    (race as any).updateStandings();

    expect(race.standings[0].id).toBe(player.id);
    expect(race.standings[0].position).toBe(1);
    expect(race.standings[1].id).toBe(race.aiControllers[0].vehicle.id);
    expect(race.standings[1].position).toBe(2);
  });

  it('Checkpoint Run increments bonus time, arcade score, and triggers timeout on zero', () => {
    race.setupRace('checkpoint');
    race.state = 'racing';

    const initialTime = race.checkpointTimeRemaining;
    (race as any).onPlayerPassedCheckpoint(0);

    expect(race.checkpointTimeRemaining).toBeGreaterThan(initialTime);
    expect(race.arcadeScore).toBeGreaterThan(0);

    // Force time expiration
    race.checkpointTimeRemaining = 0.05;
    race.update(0.1);

    expect(race.state).toBe('finished');
    expect(race.isCheckpointSuccess).toBe(false); // Timed out
  });
});
