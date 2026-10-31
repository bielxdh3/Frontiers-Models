/**
 * ReplayPlayer.ts
 * Direction-agnostic replay playback engine.
 * - Interpolated playback between sampled keyframes (SLERP for rotations, LERP for positions)
 * - Jump/seek forwards and backwards settling on identical historical state
 * - Discontinuity & teleport protection
 * - 3 distinct camera modes: Dynamic Chase, Bumper/Hood, Trackside/Broadcast
 * - Historical HUD data reflection
 */

import * as THREE from 'three';
import { ReplayKeyframe, ReplayPayload } from '../core/StorageManager';
import { Vehicle } from './Vehicle';
import { AICarController } from './AICarController';
import { Track } from '../world/Track';

export type ReplayCameraMode = 'chase' | 'bumper' | 'broadcast';

export interface InterpolatedReplayState {
  timestampMs: number;
  playerPos: THREE.Vector3;
  playerRot: THREE.Quaternion;
  speedKmh: number;
  driftIntensity: number;
  nitroAmount: number;
  damage: number;
  lap: number;
  checkpoint: number;
  position: number;
  weatherWetness: number;
  daylightTime: number;
  opponents: Array<{
    pos: THREE.Vector3;
    rot: THREE.Quaternion;
    damage: number;
  }>;
}

export class ReplayPlayer {
  public payload: ReplayPayload | null = null;
  public currentTimeMs = 0;
  public isPlaying = false;
  public playbackSpeed = 1.0; // 0.5x, 1.0x, 2.0x
  public cameraMode: ReplayCameraMode = 'chase';

  // Interpolated output values for rendering
  public currentState: InterpolatedReplayState | null = null;

  // Cached scratch vectors for GC-free interpolation
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  public loadPayload(payload: ReplayPayload): void {
    this.payload = payload;
    this.currentTimeMs = 0;
    this.isPlaying = true;
    this.playbackSpeed = 1.0;
    this.seekTo(0);
  }

  public play(): void {
    this.isPlaying = true;
  }

  public pause(): void {
    this.isPlaying = false;
  }

  public togglePlay(): void {
    this.isPlaying = !this.isPlaying;
  }

  public setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
  }

  public setCameraMode(mode: ReplayCameraMode): void {
    this.cameraMode = mode;
  }

  public cycleCamera(): void {
    if (this.cameraMode === 'chase') this.cameraMode = 'bumper';
    else if (this.cameraMode === 'bumper') this.cameraMode = 'broadcast';
    else this.cameraMode = 'chase';
  }

  public getDurationMs(): number {
    return this.payload?.metadata.durationMs || 0;
  }

  public update(dt: number): void {
    if (!this.payload || !this.isPlaying) return;

    this.currentTimeMs += dt * 1000 * this.playbackSpeed;
    const maxDuration = this.getDurationMs();

    if (this.currentTimeMs >= maxDuration) {
      this.currentTimeMs = maxDuration;
      this.isPlaying = false; // Stop at end
    }

    this.evaluateStateAtTime(this.currentTimeMs);
  }

  public seekTo(timeMs: number): void {
    if (!this.payload) return;
    const maxDuration = this.getDurationMs();
    this.currentTimeMs = Math.max(0, Math.min(maxDuration, timeMs));
    this.evaluateStateAtTime(this.currentTimeMs);
  }

  private evaluateStateAtTime(t: number): void {
    if (!this.payload || this.payload.keyframes.length === 0) return;

    const frames = this.payload.keyframes;
    if (frames.length === 1 || t <= frames[0].t) {
      this.currentState = this.createStateFromSingleFrame(frames[0]);
      return;
    }

    const lastIndex = frames.length - 1;
    if (t >= frames[lastIndex].t) {
      this.currentState = this.createStateFromSingleFrame(frames[lastIndex]);
      return;
    }

    // Binary search for surrounding keyframes
    let low = 0;
    let high = lastIndex;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (frames[mid].t <= t) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idxA = Math.max(0, high);
    const idxB = Math.min(lastIndex, idxA + 1);

    const frameA = frames[idxA];
    const frameB = frames[idxB];

    const span = frameB.t - frameA.t;
    const alpha = span > 0 ? Math.max(0, Math.min(1, (t - frameA.t) / span)) : 0;

    // Interpolate Player Position & Rotation
    this.v1.set(frameA.p[0], frameA.p[1], frameA.p[2]);
    this.v2.set(frameB.p[0], frameB.p[1], frameB.p[2]);

    // Teleport/discontinuity check: if distance > 15m, do not interpolate across scenery
    const playerPos = new THREE.Vector3();
    if (this.v1.distanceTo(this.v2) > 15.0) {
      playerPos.copy(alpha < 0.5 ? this.v1 : this.v2);
    } else {
      playerPos.lerpVectors(this.v1, this.v2, alpha);
    }

    this.q1.set(frameA.r[0], frameA.r[1], frameA.r[2], frameA.r[3]);
    this.q2.set(frameB.r[0], frameB.r[1], frameB.r[2], frameB.r[3]);
    const playerRot = new THREE.Quaternion().copy(this.q1).slerp(this.q2, alpha);

    // Interpolate Opponents
    const opponents = (frameA.opp || []).map((oppA, i) => {
      const oppB = frameB.opp?.[i] || oppA;
      const op1 = new THREE.Vector3(oppA.p[0], oppA.p[1], oppA.p[2]);
      const op2 = new THREE.Vector3(oppB.p[0], oppB.p[1], oppB.p[2]);
      const pos = new THREE.Vector3();
      if (op1.distanceTo(op2) > 15.0) {
        pos.copy(alpha < 0.5 ? op1 : op2);
      } else {
        pos.lerpVectors(op1, op2, alpha);
      }

      const or1 = new THREE.Quaternion(oppA.r[0], oppA.r[1], oppA.r[2], oppA.r[3]);
      const or2 = new THREE.Quaternion(oppB.r[0], oppB.r[1], oppB.r[2], oppB.r[3]);
      const rot = new THREE.Quaternion().copy(or1).slerp(or2, alpha);

      return {
        pos,
        rot,
        damage: oppA.dmg + (oppB.dmg - oppA.dmg) * alpha
      };
    });

    this.currentState = {
      timestampMs: t,
      playerPos,
      playerRot,
      speedKmh: Math.round(frameA.v + (frameB.v - frameA.v) * alpha),
      driftIntensity: frameA.d + (frameB.d - frameA.d) * alpha,
      nitroAmount: frameA.n + (frameB.n - frameA.n) * alpha,
      damage: frameA.dmg + (frameB.dmg - frameA.dmg) * alpha,
      lap: alpha < 0.5 ? frameA.lap : frameB.lap,
      checkpoint: alpha < 0.5 ? frameA.cp : frameB.cp,
      position: alpha < 0.5 ? frameA.pos : frameB.pos,
      weatherWetness: frameA.weatherWetness + (frameB.weatherWetness - frameA.weatherWetness) * alpha,
      daylightTime: frameA.daylightTime + (frameB.daylightTime - frameA.daylightTime) * alpha,
      opponents
    };
  }

  private createStateFromSingleFrame(frame: ReplayKeyframe): InterpolatedReplayState {
    return {
      timestampMs: frame.t,
      playerPos: new THREE.Vector3(frame.p[0], frame.p[1], frame.p[2]),
      playerRot: new THREE.Quaternion(frame.r[0], frame.r[1], frame.r[2], frame.r[3]),
      speedKmh: frame.v,
      driftIntensity: frame.d,
      nitroAmount: frame.n,
      damage: frame.dmg,
      lap: frame.lap,
      checkpoint: frame.cp,
      position: frame.pos,
      weatherWetness: frame.weatherWetness,
      daylightTime: frame.daylightTime,
      opponents: (frame.opp || []).map((o) => ({
        pos: new THREE.Vector3(o.p[0], o.p[1], o.p[2]),
        rot: new THREE.Quaternion(o.r[0], o.r[1], o.r[2], o.r[3]),
        damage: o.dmg
      }))
    };
  }

  public applyToScene(playerCar: Vehicle, aiControllers: AICarController[], track: Track): void {
    if (!this.currentState) return;

    // Apply player state
    playerCar.position.copy(this.currentState.playerPos);
    playerCar.rotation.copy(this.currentState.playerRot);
    playerCar.speedKmh = this.currentState.speedKmh;
    playerCar.isDrifting = this.currentState.driftIntensity > 0.15;
    playerCar.nitroAmount = this.currentState.nitroAmount;
    playerCar.damage = this.currentState.damage;
    playerCar.currentLap = this.currentState.lap;

    // Apply AI opponents state
    this.currentState.opponents.forEach((opp, i) => {
      if (aiControllers[i]) {
        aiControllers[i].vehicle.position.copy(opp.pos);
        aiControllers[i].vehicle.rotation.copy(opp.rot);
        aiControllers[i].vehicle.damage = opp.damage;
      }
    });
  }
}
