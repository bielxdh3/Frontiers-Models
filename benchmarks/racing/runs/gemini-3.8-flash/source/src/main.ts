/**
 * main.ts
 * Central game application bootstrap and coordinator:
 * - Initializes Three.js Scene, WebGL2 Renderer, Audio, Input, Storage, and UI
 * - Coordinates state machines: Menu, Garage Turntable, Active Race, Pause, Results, Replay, Photo Studio
 * - Executes fixed-step 60Hz physics and smooth interpolated rendering
 */

import * as THREE from 'three';
import { StorageManager, ReplayPayload } from './core/StorageManager';
import { InputManager } from './core/InputManager';
import { AudioManager } from './core/AudioManager';
import { GraphicsRenderer } from './graphics/Renderer';
import { Simulation } from './core/Simulation';
import { Track } from './world/Track';
import {
  COASTAL_SPRINT_NODES,
  RIVIERA_GP_NODES,
  HORIZON_RUSH_NODES
} from './world/TrackConfigs';
import { TrackBuilder } from './world/TrackBuilder';
import { Environment } from './world/Environment';
import { Vehicle } from './gameplay/Vehicle';
import { CAR_CONFIGS } from './gameplay/CarConfigs';
import { CarVisuals } from './graphics/CarVisuals';
import { RaceManager, GameMode } from './gameplay/RaceManager';
import { ReplayRecorder } from './gameplay/ReplayRecorder';
import { ReplayPlayer } from './gameplay/ReplayPlayer';
import { ChaseCamera } from './graphics/ChaseCamera';
import { ReplayCamera } from './graphics/ReplayCamera';
import { PhotoStudio } from './graphics/PhotoStudio';
import { UIController } from './ui/UIController';

export class GameApp {
  public scene: THREE.Scene;
  public renderer: GraphicsRenderer;
  public storage: StorageManager;
  public input: InputManager;
  public audio: AudioManager;

  // World and Environment
  public environment: Environment;
  public tracks: Record<string, Track> = {};
  public currentTrack: Track;
  private currentTrackMeshGroup: THREE.Group | null = null;

  // Vehicles and Visuals
  public playerCar: Vehicle;
  public playerVisuals: CarVisuals;
  public aiVisuals: CarVisuals[] = [];

  // Managers
  public raceManager: RaceManager;
  public replayRecorder: ReplayRecorder;
  public replayPlayer: ReplayPlayer;
  public simulation: Simulation;

  // Cameras
  public chaseCamera: ChaseCamera;
  public replayCamera: ReplayCamera;
  public photoStudio: PhotoStudio;

  // UI
  public ui: UIController;

  // Global App Mode
  public currentAppMode: 'menu' | 'garage' | 'race' | 'paused' | 'results' | 'replay' | 'photo' = 'menu';
  private garageTurntableAngle = 0;

  constructor() {
    // 1. Core Canvas and Renderer
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new GraphicsRenderer(canvas);
    this.scene = new THREE.Scene();

    // 2. Core Subsystems
    this.storage = new StorageManager();
    this.input = new InputManager();
    this.audio = new AudioManager();

    // 3. Environment & Lighting
    this.environment = new Environment(this.scene);

    // 4. Initialize Tracks
    this.tracks.coastal_sprint = new Track('coastal_sprint', 'Coastal Sprint', COASTAL_SPRINT_NODES, true);
    this.tracks.riviera_gp = new Track('riviera_gp', 'Riviera Grand Prix', RIVIERA_GP_NODES, true);
    this.tracks.horizon_rush = new Track('horizon_rush', 'Horizon Rush', HORIZON_RUSH_NODES, true);
    this.currentTrack = this.tracks.coastal_sprint;

    // 5. Initialize Player Vehicle
    const defaultCarCfg = CAR_CONFIGS.riviera_spyder;
    this.playerCar = new Vehicle('player', defaultCarCfg, true);
    this.playerVisuals = new CarVisuals(this.playerCar);
    this.scene.add(this.playerVisuals.group);

    // 6. Cameras & Tools
    this.chaseCamera = new ChaseCamera();
    this.replayCamera = new ReplayCamera();
    this.photoStudio = new PhotoStudio();

    // 7. Race & Replay Managers
    this.raceManager = new RaceManager(this.currentTrack, this.playerCar, this.storage, this.audio);
    this.replayRecorder = new ReplayRecorder();
    this.replayPlayer = new ReplayPlayer();

    // 8. Fixed-Step Simulation Loop (60 Hz)
    this.simulation = new Simulation((dt) => this.fixedPhysicsStep(dt));

    // 9. UI Layer
    const uiRoot = document.getElementById('ui-root') as HTMLElement;
    this.ui = new UIController(
      uiRoot,
      this.storage,
      this.input,
      this.audio,
      this.renderer,
      this.photoStudio
    );

    this.wireUICallbacks();
    this.setupTrack(this.currentTrack);
    this.setupGaragePreview(this.playerCar.config.id);

    // Apply saved preferences
    const savedSettings = this.storage.getSettings();
    this.renderer.applyQuality(savedSettings.quality);
    this.audio.setVolume(savedSettings.masterVolume);
    this.audio.setMuted(savedSettings.isMuted);

    // Start render loop
    this.simulation.start();
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private wireUICallbacks(): void {
    // Start active race
    this.ui.onStartRace = () => {
      this.startNewRace(
        this.ui.selectedMode,
        this.ui.selectedTrackId,
        this.ui.selectedCarId,
        this.ui.selectedDifficulty,
        this.ui.selectedWeather,
        this.ui.selectedTimeOfDay
      );
    };

    // Restart race
    this.ui.onRestartRace = () => {
      this.startNewRace(
        this.raceManager.mode,
        this.raceManager.track.id,
        this.playerCar.config.id,
        this.ui.selectedDifficulty,
        this.raceManager.weatherType,
        this.raceManager.timeOfDay
      );
    };

    // Resume from pause
    this.ui.onResumeRace = () => {
      this.currentAppMode = 'race';
      this.raceManager.resume();
      this.simulation.resetTime();
    };

    // Retire run
    this.ui.onRetireRace = () => {
      this.raceManager.retireRace();
      this.replayRecorder.stop();
      const payload = this.replayRecorder.createPayload(this.raceManager);
      this.currentAppMode = 'results';
      this.ui.showResults(this.raceManager, payload);
    };

    // Enter Replay Viewer
    this.ui.onEnterReplay = (payload: ReplayPayload) => {
      this.enterReplayMode(payload);
    };

    // Exit Replay Viewer
    this.ui.onExitReplay = () => {
      this.replayPlayer.pause();
      this.currentAppMode = 'menu';
      this.setupGaragePreview(this.playerCar.config.id);
    };

    // Signature Feature: Photo Studio
    this.ui.onOpenPhotoStudio = () => {
      this.currentAppMode = 'photo';
      this.photoStudio.activate(this.playerCar);
    };

    this.ui.onClosePhotoStudio = () => {
      if (this.replayPlayer.payload && this.ui.transientReplayPayload) {
        this.currentAppMode = 'replay';
        this.ui.showScreen('replay-hud');
      } else {
        this.currentAppMode = 'paused';
        this.ui.showScreen('pause');
      }
    };

    // Garage Car Switch
    this.ui.onSelectCarPreview = (carId: string) => {
      this.setupGaragePreview(carId);
    };
  }

  private setupTrack(track: Track): void {
    if (this.currentTrackMeshGroup) {
      this.scene.remove(this.currentTrackMeshGroup);
    }
    this.currentTrack = track;
    this.currentTrackMeshGroup = TrackBuilder.buildTrackMesh(track);
    this.scene.add(this.currentTrackMeshGroup);
    this.raceManager.track = track;
  }

  private setupGaragePreview(carId: string): void {
    const config = CAR_CONFIGS[carId] || CAR_CONFIGS.riviera_spyder;

    // Remove old player visuals
    this.scene.remove(this.playerVisuals.group);

    this.playerCar = new Vehicle('player', config, true);
    this.playerVisuals = new CarVisuals(this.playerCar);
    this.scene.add(this.playerVisuals.group);

    // Place car on seaside vista for preview
    this.playerCar.reset(new THREE.Vector3(0, 1.4, 0), new THREE.Quaternion());
    this.currentAppMode = 'garage';
  }

  private startNewRace(
    mode: GameMode,
    trackId: string,
    carId: string,
    difficulty: any,
    weather: any,
    timeOfDay: any
  ): void {
    // 1. Setup Track
    const track = this.tracks[trackId] || this.tracks.coastal_sprint;
    if (this.currentTrack.id !== track.id) {
      this.setupTrack(track);
    }

    // 2. Setup Player Car
    const config = CAR_CONFIGS[carId] || CAR_CONFIGS.riviera_spyder;
    this.scene.remove(this.playerVisuals.group);
    this.playerCar = new Vehicle('player', config, true);
    this.playerVisuals = new CarVisuals(this.playerCar);
    this.scene.add(this.playerVisuals.group);

    // 3. Clear and build AI Car Visuals
    this.aiVisuals.forEach((v) => this.scene.remove(v.group));
    this.aiVisuals = [];

    // 4. Initialize Race Manager
    this.raceManager.playerCar = this.playerCar;
    this.raceManager.setupRace(mode, difficulty, weather, timeOfDay);

    // Build visual models for all active AI opponents
    this.raceManager.aiControllers.forEach((ai) => {
      const vis = new CarVisuals(ai.vehicle);
      this.scene.add(vis.group);
      this.aiVisuals.push(vis);
    });

    // 5. Reset Chase Camera
    this.chaseCamera.reset(this.playerCar);

    // 6. Start Replay Recorder
    this.replayRecorder.start();

    // 7. Transition to Active Race
    this.currentAppMode = 'race';
    this.simulation.resetTime();
  }

  private enterReplayMode(payload: ReplayPayload): void {
    // Ensure track matches replay payload
    const track = this.tracks[payload.metadata.trackId] || this.tracks.coastal_sprint;
    if (this.currentTrack.id !== track.id) {
      this.setupTrack(track);
    }

    // Ensure player car matches
    const config = CAR_CONFIGS[payload.metadata.carId] || CAR_CONFIGS.riviera_spyder;
    this.scene.remove(this.playerVisuals.group);
    this.playerCar = new Vehicle('player', config, true);
    this.playerVisuals = new CarVisuals(this.playerCar);
    this.scene.add(this.playerVisuals.group);

    // Ensure AI models exist if opponents are in payload
    this.aiVisuals.forEach((v) => this.scene.remove(v.group));
    this.aiVisuals = [];

    const firstFrame = payload.keyframes[0];
    if (firstFrame && firstFrame.opp) {
      this.raceManager.aiControllers = [];
      firstFrame.opp.forEach((_, idx) => {
        const dummyAI = new Vehicle(`opp_${idx}`, CAR_CONFIGS.corsica_gt, false);
        const vis = new CarVisuals(dummyAI);
        this.scene.add(vis.group);
        this.aiVisuals.push(vis);
      });
    }

    this.replayPlayer.loadPayload(payload);
    this.ui.setupReplayControls(this.replayPlayer);
    this.currentAppMode = 'replay';
  }

  /**
   * Fixed-step physics update (60 Hz)
   */
  private fixedPhysicsStep(dt: number): void {
    if (this.currentAppMode === 'race') {
      const rawInput = this.input.getRawInput();

      // Check for pause toggle
      if (rawInput.pause) {
        this.currentAppMode = 'paused';
        this.raceManager.pause();
        this.ui.showScreen('pause');
        return;
      }

      // 1. Update Player Vehicle
      const playerInputs = {
        throttle: this.raceManager.state === 'racing' ? rawInput.throttle : 0,
        steer: rawInput.steer,
        drift: rawInput.drift,
        nitro: this.raceManager.state === 'racing' && rawInput.nitro,
        recover: rawInput.recover
      };

      this.playerCar.update(dt, playerInputs, this.currentTrack, this.raceManager.weatherWetness);

      // Play impact audio on collisions
      if (this.playerCar.hasNewImpact) {
        this.audio.playImpact(this.playerCar.lastImpactIntensity);
      }

      // 2. Update AI Rivals
      this.raceManager.aiControllers.forEach((ai) => {
        ai.update(dt, this.currentTrack, this.raceManager.allCars, this.raceManager.weatherWetness);
      });

      // 3. Vehicle-to-Vehicle Collisions (All 6 cars)
      const allCars = this.raceManager.allCars;
      for (let i = 0; i < allCars.length; i++) {
        for (let j = i + 1; j < allCars.length; j++) {
          allCars[i].handleVehicleCollision(allCars[j]);
        }
      }

      // 4. Update Race Manager (Laps, Standings, Combos, Timers)
      this.raceManager.update(dt);

      // 5. Record Replay Keyframe
      this.replayRecorder.recordFrame(this.raceManager);

      // 6. Update Continuous Audio
      this.audio.updateVehicleAudio(
        this.playerCar.speedKmh,
        playerInputs.throttle,
        this.playerCar.isDrifting,
        this.playerCar.isNitroActive
      );

      // 7. Check if race finished
      if (this.raceManager.state === 'finished') {
        this.replayRecorder.stop();
        const payload = this.replayRecorder.createPayload(this.raceManager);
        this.currentAppMode = 'results';
        this.ui.showResults(this.raceManager, payload);
      }
    } else if (this.currentAppMode === 'replay') {
      this.replayPlayer.update(dt);
      this.replayPlayer.applyToScene(this.playerCar, this.raceManager.aiControllers, this.currentTrack);
      this.ui.updateReplayTimeline(this.replayPlayer);
    }
  }

  /**
   * Main render loop (interpolated rendering at display refresh rate)
   */
  private renderLoop(time: number): void {
    requestAnimationFrame((t) => this.renderLoop(t));

    // Advance fixed-step physics accumulator
    this.simulation.advanceFrame(time);

    const dt = 1 / 60; // Nominal frame delta for visual smoothing
    const isNight = this.environment.isNight(this.raceManager.daylightTime);

    let activeCamera: THREE.Camera = this.chaseCamera.camera;

    if (this.currentAppMode === 'race' || this.currentAppMode === 'paused') {
      // 1. Update Visual Models
      this.playerVisuals.updateVisuals(isNight);
      this.aiVisuals.forEach((vis) => vis.updateVisuals(isNight));

      // 2. Update Environment & Sky
      this.environment.update(
        dt,
        this.raceManager.daylightTime,
        this.raceManager.weatherWetness,
        this.playerCar.position
      );

      // 3. Update Chase Camera
      const reducedMotion = this.storage.getSettings().reducedMotion;
      this.chaseCamera.update(dt, this.playerCar, reducedMotion);
      activeCamera = this.chaseCamera.camera;

      // 4. Update Active Race HUD
      if (this.currentAppMode === 'race') {
        this.ui.updateHUD(this.raceManager);
      }

    } else if (this.currentAppMode === 'replay') {
      // Update Visuals from Replay State
      this.playerVisuals.updateVisuals(isNight);
      this.aiVisuals.forEach((vis) => vis.updateVisuals(isNight));

      const daylight = this.replayPlayer.currentState?.daylightTime ?? this.raceManager.daylightTime;
      const wetness = this.replayPlayer.currentState?.weatherWetness ?? this.raceManager.weatherWetness;

      this.environment.update(dt, daylight, wetness, this.playerCar.position);

      this.replayCamera.update(dt, this.replayPlayer.cameraMode, this.playerCar, this.currentTrack);
      activeCamera = this.replayCamera.camera;

    } else if (this.currentAppMode === 'photo') {
      // Signature Feature: Photo Studio active
      this.playerVisuals.updateVisuals(isNight);
      this.photoStudio.updateCameraTransform();
      activeCamera = this.photoStudio.camera;

    } else if (this.currentAppMode === 'garage' || this.currentAppMode === 'menu') {
      // Turntable preview in menu and garage
      this.garageTurntableAngle += 0.008;
      const radius = 6.2;
      const camX = Math.sin(this.garageTurntableAngle) * radius;
      const camZ = Math.cos(this.garageTurntableAngle) * radius;

      this.chaseCamera.camera.position.set(camX, 2.2, camZ);
      this.chaseCamera.camera.lookAt(0, 0.8, 0);
      activeCamera = this.chaseCamera.camera;

      this.playerVisuals.updateVisuals(false);
      this.environment.update(dt, 14.0, 0.0, new THREE.Vector3(0, 0, 0));
    }

    // Render WebGL frame
    this.renderer.render(this.scene, activeCamera);
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
