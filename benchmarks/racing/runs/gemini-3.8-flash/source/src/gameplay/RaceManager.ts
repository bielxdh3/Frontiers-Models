/**
 * RaceManager.ts
 * Authoritative orchestrator for all three gameplay modes:
 * 1. Time Trial (3 laps, best valid single lap, strict shortcut invalidation)
 * 2. Race vs AI (3 laps, 6 cars, real progress classification, unfinished car integrity)
 * 3. Checkpoint Run (countdown timer, bonus gates, combo scoring, success/timeout)
 */

import * as THREE from 'three';
import { Vehicle } from './Vehicle';
import { AICarController, AIDifficulty, AI_RIVALS } from './AICarController';
import { Track } from '../world/Track';
import { StorageManager, PersonalRecord } from '../core/StorageManager';
import { AudioManager } from '../core/AudioManager';

export type GameMode = 'time_trial' | 'race' | 'checkpoint';

export interface LapRecordInfo {
  lapNumber: number;
  timeMs: number;
  isValid: boolean;
}

export interface CompetitorResult {
  id: string;
  name: string;
  isPlayer: boolean;
  position: number;
  finished: boolean;
  totalTimeMs?: number;
  completedLaps: number;
  bestLapMs?: number;
}

export class RaceManager {
  public mode: GameMode = 'time_trial';
  public track: Track;
  public playerCar: Vehicle;
  public aiControllers: AICarController[] = [];
  public allCars: Vehicle[] = [];

  // Lifecycle State
  public state: 'setup' | 'countdown' | 'racing' | 'paused' | 'finished' | 'retired' = 'setup';
  public countdownTimer = 3.0; // 3 seconds countdown
  public raceElapsedMs = 0;
  public isCountdownActive = false;

  // Time Trial State
  public currentLapTimeMs = 0;
  public lapTimes: LapRecordInfo[] = [];
  public bestValidLapMs: number | null = null;
  public totalRequiredLaps = 3;

  // Checkpoint Run State
  public checkpointTimeRemaining = 45.0; // seconds
  public currentCheckpointIndex = 0;
  public totalCheckpoints = 14;
  public arcadeScore = 0;
  public comboMultiplier = 1.0;
  public comboTimer = 0;
  public isCheckpointSuccess = false;

  // Race Standings
  public standings: CompetitorResult[] = [];

  // Weather & Environment parameters
  public weatherType: 'sunny' | 'cloudy' | 'rainy' = 'sunny';
  public timeOfDay: 'morning' | 'daytime' | 'sunset' | 'night' = 'daytime';
  public weatherWetness = 0.0;
  public daylightTime = 12.0; // 0..24 hours

  private storageManager: StorageManager;
  private audioManager: AudioManager;
  private lastCountdownSecond = 4;

  constructor(
    track: Track,
    playerCar: Vehicle,
    storageManager: StorageManager,
    audioManager: AudioManager
  ) {
    this.track = track;
    this.playerCar = playerCar;
    this.storageManager = storageManager;
    this.audioManager = audioManager;
  }

  public setupRace(
    mode: GameMode,
    difficulty: AIDifficulty = 'normal',
    weather: 'sunny' | 'cloudy' | 'rainy' = 'sunny',
    timeOfDay: 'morning' | 'daytime' | 'sunset' | 'night' = 'daytime'
  ): void {
    this.mode = mode;
    this.weatherType = weather;
    this.timeOfDay = timeOfDay;
    this.weatherWetness = weather === 'rainy' ? 0.75 : weather === 'cloudy' ? 0.15 : 0.0;

    switch (timeOfDay) {
      case 'morning': this.daylightTime = 7.5; break;
      case 'daytime': this.daylightTime = 13.0; break;
      case 'sunset': this.daylightTime = 18.5; break;
      case 'night': this.daylightTime = 22.5; break;
    }

    this.state = 'countdown';
    this.countdownTimer = 3.2;
    this.lastCountdownSecond = 4;
    this.raceElapsedMs = 0;
    this.currentLapTimeMs = 0;
    this.lapTimes = [];
    this.bestValidLapMs = null;
    this.checkpointTimeRemaining = 45.0;
    this.currentCheckpointIndex = 0;
    this.arcadeScore = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.isCheckpointSuccess = false;

    // Reset player car to pole or grid slot
    const playerSpawn = this.track.getSpawnTransform(this.mode === 'race' ? 2 : 0); // 3rd on grid for race
    this.playerCar.reset(playerSpawn.position, playerSpawn.rotation);

    // Setup AI Opponents for Race mode
    this.aiControllers = [];
    this.allCars = [this.playerCar];

    if (this.mode === 'race') {
      const gridIndices = [0, 1, 3, 4, 5]; // 5 grid slots around player
      AI_RIVALS.forEach((identity, idx) => {
        const controller = new AICarController(identity, difficulty);
        const spawn = this.track.getSpawnTransform(gridIndices[idx]);
        controller.vehicle.reset(spawn.position, spawn.rotation);
        this.aiControllers.push(controller);
        this.allCars.push(controller.vehicle);
      });
    }

    this.updateStandings();
  }

  public update(dt: number): void {
    if (this.state === 'paused' || this.state === 'finished' || this.state === 'retired') {
      return;
    }

    // Dynamic Weather and Daylight live progression
    if (this.weatherType === 'rainy' && this.weatherWetness < 1.0) {
      this.weatherWetness = Math.min(1.0, this.weatherWetness + 0.015 * dt);
    }
    // Subtle daylight progression during race
    this.daylightTime = (this.daylightTime + 0.008 * dt) % 24;

    // Handle Countdown State
    if (this.state === 'countdown') {
      this.countdownTimer -= dt;
      const currentSec = Math.ceil(this.countdownTimer);

      if (currentSec !== this.lastCountdownSecond && currentSec > 0 && currentSec <= 3) {
        this.audioManager.playCountdownBeep(false);
        this.lastCountdownSecond = currentSec;
      }

      if (this.countdownTimer <= 0) {
        this.state = 'racing';
        this.audioManager.playCountdownBeep(true); // GO!
      }
      return; // Do not advance race clock or progression during countdown!
    }

    // Active Racing
    this.raceElapsedMs += dt * 1000;
    this.currentLapTimeMs += dt * 1000;

    // Update Progress for all cars
    this.updateTrackProgression(dt);

    // Update Checkpoint Run Timer & Combos
    if (this.mode === 'checkpoint') {
      this.updateCheckpointRun(dt);
    }

    // Update Standings (authoritative ordering by distance & laps)
    this.updateStandings();

    // Check Finish Conditions
    this.checkFinishConditions();
  }

  private updateTrackProgression(dt: number): void {
    const checkpoints = this.track.checkpoints;
    const numCheckpoints = checkpoints.length;

    for (const car of this.allCars) {
      const proj = this.track.projectPosition(car.position);

      // Checkpoint passing logic
      // Target checkpoint that car should pass next
      const nextExpectedCheckpoint = (car.lastPassedCheckpoint + 1) % numCheckpoints;
      const cpGate = checkpoints[nextExpectedCheckpoint];

      const toGate = new THREE.Vector3().subVectors(car.position, cpGate.position);
      const distToGate = toGate.length();

      // Plane crossing check
      if (distToGate < cpGate.width * 0.7) {
        const forwardDot = toGate.dot(cpGate.direction);
        if (forwardDot > -2.0 && forwardDot < 5.0) {
          // Checkpoint validated!
          car.lastPassedCheckpoint = nextExpectedCheckpoint;

          if (car.isPlayer) {
            if (this.mode === 'checkpoint') {
              this.onPlayerPassedCheckpoint(nextExpectedCheckpoint);
            }
          }

          // Check if start/finish gate (index 0) was crossed after all previous checkpoints!
          if (nextExpectedCheckpoint === 0 && car.lastPassedCheckpoint === 0) {
            // Completed a lap!
            this.onCarCompletedLap(car);
          }
        }
      }
    }
  }

  private onPlayerPassedCheckpoint(index: number): void {
    this.currentCheckpointIndex = index + 1;
    this.audioManager.playCheckpointChime();

    // Bonus time addition
    const bonusTime = 14.0;
    this.checkpointTimeRemaining = Math.min(99.0, this.checkpointTimeRemaining + bonusTime);

    // Score addition
    const basePoints = 500;
    this.arcadeScore += Math.floor(basePoints * this.comboMultiplier);

    // Check if reached end of course in Checkpoint Run
    if (this.currentCheckpointIndex >= this.totalCheckpoints) {
      this.isCheckpointSuccess = true;
      this.finishRace(true);
    }
  }

  private onCarCompletedLap(car: Vehicle): void {
    if (car.isPlayer) {
      const lapTime = this.currentLapTimeMs;
      const isValid = car.isLapValid;

      this.lapTimes.push({
        lapNumber: car.currentLap,
        timeMs: lapTime,
        isValid
      });

      if (isValid) {
        if (this.bestValidLapMs === null || lapTime < this.bestValidLapMs) {
          this.bestValidLapMs = lapTime;
        }

        // Save personal record locally if in Time Trial
        if (this.mode === 'time_trial') {
          const record: PersonalRecord = {
            trackId: this.track.id,
            carId: car.config.id,
            bestLapMs: lapTime,
            date: new Date().toISOString(),
            weather: this.weatherType,
            timeOfDay: this.timeOfDay
          };
          this.storageManager.savePersonalRecord(record);
        }
      }

      this.currentLapTimeMs = 0;
      car.isLapValid = true; // Reset validity for next lap
    }

    car.currentLap += 1;
  }

  private updateCheckpointRun(dt: number): void {
    this.checkpointTimeRemaining -= dt;

    // Combo system
    const playerSpeed = this.playerCar.speedKmh;
    const isCleanDriving = !this.playerCar.isOffRoad && !this.playerCar.hasNewImpact;

    if (playerSpeed > 115 || this.playerCar.isDrifting || this.playerCar.isNitroActive) {
      this.comboTimer += dt;
      if (this.comboTimer > 1.2) {
        this.comboMultiplier = Math.min(4.0, this.comboMultiplier + 0.15 * dt);
      }
      this.arcadeScore += Math.floor((playerSpeed * 0.15 + (this.playerCar.isDrifting ? 40 : 0)) * this.comboMultiplier * dt);
    } else {
      this.comboTimer = Math.max(0, this.comboTimer - dt * 2.0);
      if (this.comboTimer <= 0) {
        this.comboMultiplier = Math.max(1.0, this.comboMultiplier - dt * 0.5);
      }
    }

    // Time-out Failure
    if (this.checkpointTimeRemaining <= 0) {
      this.checkpointTimeRemaining = 0;
      this.isCheckpointSuccess = false;
      this.finishRace(false);
    }
  }

  private updateStandings(): void {
    const trackLen = this.track.totalLength;

    const results: CompetitorResult[] = this.allCars.map((car) => {
      const laps = car.currentLap - 1;
      const progressScore = laps * trackLen + car.currentDistanceAlongTrack;
      const isFinished = car.currentLap > this.totalRequiredLaps;

      const name = car.isPlayer
        ? 'Player'
        : (this.aiControllers.find((c) => c.vehicle.id === car.id)?.identity.name || 'Rival');

      return {
        id: car.id,
        name,
        isPlayer: car.isPlayer,
        position: 1,
        finished: isFinished,
        totalTimeMs: isFinished ? this.raceElapsedMs : undefined,
        completedLaps: laps,
        bestLapMs: car.isPlayer ? (this.bestValidLapMs ?? undefined) : undefined,
        _score: progressScore
      } as CompetitorResult & { _score: number };
    });

    // Sort by progress descending
    (results as Array<CompetitorResult & { _score: number }>).sort((a, b) => b._score - a._score);

    results.forEach((res, idx) => {
      res.position = idx + 1;
    });

    this.standings = results;
  }

  private checkFinishConditions(): void {
    if (this.mode === 'time_trial') {
      if (this.playerCar.currentLap > this.totalRequiredLaps) {
        this.finishRace(true);
      }
    } else if (this.mode === 'race') {
      if (this.playerCar.currentLap > this.totalRequiredLaps) {
        this.finishRace(true);
      }
    }
  }

  public finishRace(wonOrSuccess: boolean): void {
    if (this.state === 'finished') return;
    this.state = 'finished';
    this.audioManager.silenceAllContinuous();
    this.audioManager.playFinishJingle(wonOrSuccess);
  }

  public retireRace(): void {
    this.state = 'retired';
    this.audioManager.silenceAllContinuous();
  }

  public pause(): void {
    if (this.state === 'racing' || this.state === 'countdown') {
      this.state = 'paused';
      this.audioManager.silenceAllContinuous();
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'racing';
    }
  }
}
