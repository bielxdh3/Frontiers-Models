/**
 * ReplayRecorder.ts
 * Captures historical race state keyframes at bounded intervals (e.g. 20 Hz)
 * capturing player, 5 AI rivals, damage, weather, daylight, and race progression.
 */

import { ReplayKeyframe, ReplayMetadata, ReplayPayload } from '../core/StorageManager';
import { RaceManager } from './RaceManager';

export class ReplayRecorder {
  private keyframes: ReplayKeyframe[] = [];
  private sampleIntervalMs = 50; // 20 Hz sampling
  private lastSampleTime = -1000;
  private isRecording = false;

  public start(): void {
    this.keyframes = [];
    this.lastSampleTime = -1000;
    this.isRecording = true;
  }

  public stop(): void {
    this.isRecording = false;
  }

  public recordFrame(raceManager: RaceManager): void {
    if (!this.isRecording) return;
    if (raceManager.state !== 'racing' && raceManager.state !== 'countdown') return;

    const currentT = raceManager.raceElapsedMs;
    if (currentT - this.lastSampleTime < this.sampleIntervalMs) {
      return;
    }
    this.lastSampleTime = currentT;

    const player = raceManager.playerCar;
    const playerPos = player.position;
    const playerRot = player.rotation;

    // Capture 5 AI rivals
    const oppFrames = raceManager.aiControllers.map((ai) => ({
      p: [ai.vehicle.position.x, ai.vehicle.position.y, ai.vehicle.position.z] as [number, number, number],
      r: [ai.vehicle.rotation.x, ai.vehicle.rotation.y, ai.vehicle.rotation.z, ai.vehicle.rotation.w] as [number, number, number, number],
      dmg: ai.vehicle.damage
    }));

    const playerStanding = raceManager.standings.find((s) => s.isPlayer)?.position || 1;

    this.keyframes.push({
      t: Math.round(currentT),
      p: [
        Number(playerPos.x.toFixed(2)),
        Number(playerPos.y.toFixed(2)),
        Number(playerPos.z.toFixed(2))
      ],
      r: [
        Number(playerRot.x.toFixed(4)),
        Number(playerRot.y.toFixed(4)),
        Number(playerRot.z.toFixed(4)),
        Number(playerRot.w.toFixed(4))
      ],
      v: Math.round(player.speedKmh),
      d: Number(Math.min(1.0, Math.abs(player.driftAngle)).toFixed(2)),
      n: Math.round(player.nitroAmount),
      dmg: Number(player.damage.toFixed(2)),
      lap: player.currentLap,
      cp: raceManager.currentCheckpointIndex,
      pos: playerStanding,
      opp: oppFrames,
      weatherWetness: Number(raceManager.weatherWetness.toFixed(2)),
      daylightTime: Number(raceManager.daylightTime.toFixed(2))
    });
  }

  public createPayload(raceManager: RaceManager): ReplayPayload {
    const isCompleted = raceManager.state === 'finished';
    const duration = this.keyframes.length > 0
      ? this.keyframes[this.keyframes.length - 1].t
      : Math.round(raceManager.raceElapsedMs);

    const metadata: ReplayMetadata = {
      id: 'rep_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      title: `${raceManager.track.name} - ${raceManager.mode.toUpperCase().replace('_', ' ')}`,
      mode: raceManager.mode,
      trackId: raceManager.track.id,
      carId: raceManager.playerCar.config.id,
      date: new Date().toISOString(),
      durationMs: duration,
      isCompleted,
      isImported: false, // Locally recorded run
      bestLapMs: raceManager.bestValidLapMs ?? undefined,
      finalPosition: raceManager.standings.find((s) => s.isPlayer)?.position,
      score: raceManager.mode === 'checkpoint' ? raceManager.arcadeScore : undefined
    };

    return {
      schemaVersion: 1,
      metadata,
      keyframes: [...this.keyframes]
    };
  }

  public getKeyframesCount(): number {
    return this.keyframes.length;
  }
}
