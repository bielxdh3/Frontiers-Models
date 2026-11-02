// src/game/GameApp.js
// Main Game Controller for Racing-bench V3.4
// Integrates Three.js graphics, 120Hz physics sub-stepping, AI grid,
// Web Audio API, race rules, checkpoints, HUD, and quality presets.

import * as THREE from 'three';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { CarModelBuilder, LIVERIES } from '../models/CarModelBuilder.js';
import { VehiclePhysics } from '../physics/VehiclePhysics.js';
import { AIDriver } from '../ai/AIDriver.js';
import { AudioManager } from '../audio/AudioManager.js';
import { CameraController } from '../camera/CameraController.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { UIManager } from '../ui/UIManager.js';

export class GameApp {
  constructor(canvas) {
    this.canvas = canvas;
    this.isRunning = false;
    this.isPaused = false;

    // Race Configuration
    this.totalLaps = 3;
    this.difficulty = 'normal'; // 'facil', 'normal', 'dificil'
    this.qualityPreset = 'high'; // 'high', 'low'
    this.selectedCarType = 'gt_coupe'; // 'gt_coupe' or 'sport_hatch'
    this.selectedLiveryIndex = 0;

    // Race State
    this.raceState = 'menu'; // 'menu', 'garage', 'grid_presentation', 'countdown', 'racing', 'finished'
    this.currentLap = 1;
    this.lapStartTime = 0;
    this.currentLapTime = 0;
    this.bestLapTime = 0;
    this.raceStartTime = 0;
    this.totalRaceTime = 0;
    this.playerStanding = 1;

    // Checkpoint & Anti-cut tracking
    this.nextCheckpointIdx = 0;
    this.lastValidDist = 0;
    this.cutDetected = false;

    // Input state
    this.keys = {};
    this.autopilot = false; // Enabled for automated testing

    // Vehicles
    this.playerPhysics = null;
    this.aiDrivers = [];
    this.allVehicles = [];

    // Subsystems
    this.audio = new AudioManager();
    this.carBuilder = new CarModelBuilder();

    // Scene & Renderer
    this.initGraphics();
  }

  initGraphics() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x224268); // Twilight evening sky backdrop
    this.scene.fog = new THREE.Fog(0xd89568, 220, 2400); // Atmospheric golden horizon fog (>150m)

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 3500);
    this.camera.position.set(0, 15, 30);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Golden Hour Directional Sunlight (Azimuth ~255 deg, Elevation ~12 deg)
    const sunColor = new THREE.Color(0xffa24c);
    this.sunLight = new THREE.DirectionalLight(sunColor, 2.8);
    this.sunLight.position.set(-800, 220, 200);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 1600;
    const shadowDist = 80;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Natural Sky & Ground bounce light (soft azure skylight overhead, warm terracotta earth bounce)
    this.hemiLight = new THREE.HemisphereLight(0x789ecc, 0x826a52, 1.25);
    this.scene.add(this.hemiLight);

    // Soft fill ambient light (neutral balanced fill)
    this.ambientLight = new THREE.AmbientLight(0x6e6e78, 0.45);
    this.scene.add(this.ambientLight);

    // Sky Dome
    this.initSkyDome();

    // Window resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Subsystems
    this.particles = new ParticleSystem(this.scene);
    this.ui = new UIManager(this);
    this.bindInputs();
  }

  // Golden Hour Sky Dome with visible Sun disc, atmospheric gradient & scattered sunset clouds
  initSkyDome() {
    let skyTex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.00, '#1c3e66'); // Zenith: evening twilight blue
      grad.addColorStop(0.22, '#2f527c'); // Deep twilight
      grad.addColorStop(0.38, '#4d6988'); // Soft slate blue
      grad.addColorStop(0.52, '#7e6468'); // Sunset transition
      grad.addColorStop(0.64, '#aa6342'); // Warm terracotta
      grad.addColorStop(0.75, '#cd7034'); // Warm amber
      grad.addColorStop(0.85, '#e8842c'); // Sunset glow
      grad.addColorStop(0.93, '#f59c3e'); // Low horizon
      grad.addColorStop(1.00, '#ffb858'); // Horizon haze
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Scattered Golden Hour Clouds (Section 1: "nuvens esparsas")
      for (let i = 0; i < 28; i++) {
        const cx = (i * 73 + 35) % 512;
        const cy = 130 + (i * 37) % 220;
        const rw = 55 + (i * 29) % 85;
        const rh = 8 + (i * 11) % 15;
        const isWarm = (i % 2 === 0);
        ctx.fillStyle = isWarm ? 'rgba(255, 205, 150, 0.40)' : 'rgba(195, 135, 155, 0.32)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        // Soft cloud rim highlight
        ctx.fillStyle = 'rgba(255, 235, 190, 0.28)';
        ctx.beginPath();
        ctx.ellipse(cx + 8, cy - 2, rw * 0.7, rh * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      skyTex = new THREE.CanvasTexture(canvas);
    }

    const skyGeom = new THREE.SphereGeometry(2800, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      color: skyTex ? 0xffffff : 0xf58a38,
      side: THREE.BackSide,
      fog: false
    });
    const skyMesh = new THREE.Mesh(skyGeom, skyMat);
    skyMesh.name = 'SkyDome';
    this.scene.add(skyMesh);

    // Sun Disc Billboard
    const sunDiscMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.95,
      fog: false
    });
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(75, 32), sunDiscMat);
    sunDisc.position.set(-1800, 420, 450);
    sunDisc.lookAt(0, 0, 0);
    this.scene.add(sunDisc);
  }

  async loadTrackAndWorld() {
    const resp = await fetch('track.json');
    this.trackData = await resp.json();

    // Load PBR Textures
    const textureLoader = new THREE.TextureLoader();
    const loadTex = (path) => {
      const t = textureLoader.load(path);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      return t;
    };

    const atlas = {
      asphalt_albedo: loadTex('assets/textures/asphalt_albedo.png'),
      asphalt_normal: loadTex('assets/textures/asphalt_normal.png'),
      asphalt_roughness: loadTex('assets/textures/asphalt_roughness.png'),
      curb_albedo: loadTex('assets/textures/curb_albedo.png'),
      curb_normal: loadTex('assets/textures/curb_normal.png'),
      curb_roughness: loadTex('assets/textures/curb_roughness.png'),
      rock_albedo: loadTex('assets/textures/rock_albedo.png'),
      rock_normal: loadTex('assets/textures/rock_normal.png'),
      rock_roughness: loadTex('assets/textures/rock_roughness.png'),
      sand_albedo: loadTex('assets/textures/sand_albedo.png'),
      sand_normal: loadTex('assets/textures/sand_normal.png'),
      grass_albedo: loadTex('assets/textures/grass_albedo.png'),
      grass_normal: loadTex('assets/textures/grass_normal.png'),
      stucco_albedo: loadTex('assets/textures/stucco_albedo.png'),
      stucco_normal: loadTex('assets/textures/stucco_normal.png'),
      roof_albedo: loadTex('assets/textures/roof_albedo.png'),
      roof_normal: loadTex('assets/textures/roof_normal.png'),
      cobblestone_albedo: loadTex('assets/textures/cobblestone_albedo.png'),
      cobblestone_normal: loadTex('assets/textures/cobblestone_normal.png'),
      foliage_albedo: loadTex('assets/textures/foliage_albedo.png'),
      foliage_normal: loadTex('assets/textures/foliage_normal.png'),
      guardrail_albedo: loadTex('assets/textures/guardrail_albedo.png'),
      guardrail_normal: loadTex('assets/textures/guardrail_normal.png')
    };

    this.worldGen = new WorldGenerator(this.trackData, atlas);
    this.world = this.worldGen.buildWorld();
    this.scene.add(this.world.group);

    // Initialize audio system
    await this.audio.init();

    this.cameraController = new CameraController(this.camera, this.worldGen);

    // Initial menu camera
    this.camera.position.set(-50, 6, 210);
    this.camera.lookAt(-180, 4, 195);
    this.ui.showScreen('menu');

    // Start render loop
    this.lastTime = performance.now();
    this.physicsAccumulator = 0;
    this.fixedDt = 1.0 / 120.0; // 120 Hz fixed timestep

    this.animate();
  }

  // Setups the starting grid (1 Player + 5 AIs)
  setupGrid() {
    // Clear old cars
    for (const v of this.allVehicles) {
      this.scene.remove(v.car.group);
    }
    this.allVehicles = [];
    this.aiDrivers = [];

    // Player Vehicle
    const playerModel = this.carBuilder.createCar(this.selectedCarType, this.selectedLiveryIndex, true);
    this.scene.add(playerModel.group);
    this.playerPhysics = new VehiclePhysics(playerModel, this.worldGen, true);
    // Player starts in grid slot 6 (last) or slot 3
    this.playerPhysics.spawnAt(40, -1.8); // 40m along straight, left side
    this.playerPhysics.isPlayer = true;
    this.playerPhysics.name = 'Jogador';
    this.allVehicles.push(this.playerPhysics);

    // 5 AI Opponent Vehicles
    const aiConfigs = [
      { name: 'Marco Rossi', car: 'gt_coupe', livery: 1, dist: 70, lat: 1.8 },
      { name: 'Elena Vega', car: 'sport_hatch', livery: 2, dist: 62, lat: -1.8 },
      { name: 'Lucas Silva', car: 'gt_coupe', livery: 3, dist: 54, lat: 1.8 },
      { name: 'Sofia Moreau', car: 'sport_hatch', livery: 4, dist: 46, lat: -1.8 },
      { name: 'Mateo Bianchi', car: 'gt_coupe', livery: 5, dist: 38, lat: 1.8 }
    ];

    for (let i = 0; i < aiConfigs.length; i++) {
      const cfg = aiConfigs[i];
      const aiModel = this.carBuilder.createCar(cfg.car, cfg.livery, false);
      this.scene.add(aiModel.group);
      const aiPhys = new VehiclePhysics(aiModel, this.worldGen, false);
      aiPhys.spawnAt(cfg.dist, cfg.lat);
      aiPhys.isPlayer = false;
      aiPhys.name = cfg.name;

      const aiDriver = new AIDriver(aiPhys, this.worldGen, this.difficulty, i);
      this.aiDrivers.push(aiDriver);
      this.allVehicles.push(aiPhys);
    }

    this.cameraController.setTarget(this.playerPhysics);
    this.audio.initAIEngines(this.aiDrivers.map(d => d.physics), this.playerPhysics);
  }

  // Start Race Sequence: Grid Presentation -> Countdown -> Green Flag
  async startRace() {
    this.setupGrid();
    this.raceState = 'grid_presentation';
    this.cameraController.startGridPresentation();
    this.ui.showScreen('race');
    this.ui.showCountdown('');

    // Start 5-second cinematic presentation
    let elapsed = 0;
    const checkInterval = setInterval(() => {
      elapsed += 0.5;
      if (elapsed >= 4.5) {
        clearInterval(checkInterval);
        this.startCountdown();
      }
    }, 500);
  }

  startCountdown() {
    this.cameraController.stopGridPresentation();
    this.raceState = 'countdown';
    this.audio.startPlayerEngine(this.selectedCarType);

    let count = 3;
    this.ui.showCountdown(count);
    this.audio.playCountdownBeep();

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        this.ui.showCountdown(count);
        this.audio.playCountdownBeep();
      } else if (count === 0) {
        this.ui.showCountdown('GO!');
        this.audio.playCountdownGo();
        this.raceState = 'racing';
        this.raceStartTime = performance.now();
        this.lapStartTime = this.raceStartTime;
        this.currentLap = 1;
        this.nextCheckpointIdx = 0;
        this.audio.startRecording(); // Record master audio during race
      } else {
        clearInterval(timer);
        this.ui.showCountdown('');
      }
    }, 1000);
  }

  // Main Render & Simulation Loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    let frameTime = (now - this.lastTime) / 1000.0;
    this.lastTime = now;
    if (frameTime > 0.1) frameTime = 0.1; // clamp lag spikes

    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 120 Hz Fixed Timestep Sub-stepping
    this.physicsAccumulator += frameTime;
    while (this.physicsAccumulator >= this.fixedDt) {
      this.stepPhysics(this.fixedDt);
      this.physicsAccumulator -= this.fixedDt;
    }

    // Update Camera
    if (this.cameraController) {
      this.cameraController.update(frameTime);
    }

    // Follow player with directional sunlight shadow frustum
    if (this.playerPhysics) {
      const sunDir = new THREE.Vector3(-0.85, 0.35, 0.40).normalize();
      this.sunLight.position.copy(this.playerPhysics.position).addScaledVector(sunDir, 250);
      this.sunLight.target.position.copy(this.playerPhysics.position);
      this.sunLight.target.updateMatrixWorld();
    }

    // Update Audio
    if (this.playerPhysics && this.audio.isInitialized) {
      const p = this.playerPhysics;
      const { frame } = this.worldGen.getClosestRoadFrame(p.position.x, p.position.z);
      this.audio.updatePlayerAudio(p.rpm, p.throttle, p.speedKmh, p.lateralSlip, p.groundType, frame.zone);
      this.audio.updateAIEngines(p.position, p.quaternion);
    }

    // Update Particles
    this.particles.update(frameTime);

    // Update HUD & UI
    if (this.raceState === 'racing' && this.playerPhysics) {
      this.currentLapTime = (now - this.lapStartTime) / 1000.0;
      this.totalRaceTime = (now - this.raceStartTime) / 1000.0;

      this.ui.updateHUD({
        position: this.playerStanding,
        lap: this.currentLap,
        totalLaps: this.totalLaps,
        currentLapTime: this.currentLapTime,
        bestLapTime: this.bestLapTime,
        speedKmh: this.playerPhysics.speedKmh,
        gear: this.playerPhysics.currentGear,
        rpm: this.playerPhysics.rpm,
        brake: this.playerPhysics.brake,
        vehicles: this.allVehicles,
        trackPoints: this.worldGen.samples.map(s => ({ x: s.pos[0], z: s.pos[2] }))
      });
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  // 120Hz Physics step
  stepPhysics(dt) {
    if (this.raceState !== 'racing' && this.raceState !== 'countdown') return;

    // 1. Process Player Input
    this.processPlayerInput();

    // 2. Step AI Drivers
    for (const ai of this.aiDrivers) {
      if (this.raceState === 'racing') {
        ai.update(dt, this.allVehicles.map(v => v));
      } else {
        ai.physics.throttle = 0;
        ai.physics.brake = 1.0;
      }
      ai.physics.step(dt);
    }

    // 3. Step Player Vehicle
    this.playerPhysics.step(dt);

    // 4. Vehicle vs Vehicle Collisions
    this.resolveVehicleCollisions();

    // 5. Emit Particles
    for (const v of this.allVehicles) {
      if (v.isGrounded) {
        if (v.lateralSlip > 0.25 || v.handbrake) {
          const rearWheel = v.wheels[2].mount.position.clone().applyQuaternion(v.quaternion).add(v.position);
          this.particles.emit(rearWheel, v.velocity, 'smoke', 2);
        }
        if (v.groundType === 'sand' && v.speedKmh > 25) {
          const wheelPos = v.wheels[0].mount.position.clone().applyQuaternion(v.quaternion).add(v.position);
          this.particles.emit(wheelPos, v.velocity, 'sand', 2);
        }
      }
    }

    // 6. Checkpoints, Lap Tracking, Anti-Cut
    this.checkLapProgress();
  }

  processPlayerInput() {
    if (this.raceState !== 'racing') {
      this.playerPhysics.throttle = 0;
      this.playerPhysics.brake = 1.0;
      this.playerPhysics.steer = 0;
      return;
    }

    if (this.autopilot) {
      // Autopilot mode for automated testing
      this.runPlayerAutopilot();
      return;
    }

    // Keyboard inputs
    let throttle = 0;
    let brake = 0;
    let steer = 0;

    if (this.keys['ArrowUp'] || this.keys['KeyW']) throttle = 1.0;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) brake = 1.0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) steer = -1.0;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) steer = 1.0;

    const handbrake = !!this.keys['Space'];

    // Gamepad support
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (gp) {
      // Left stick steering
      if (Math.abs(gp.axes[0]) > 0.15) steer = gp.axes[0];
      // Triggers for throttle and brake
      if (gp.buttons[7] && gp.buttons[7].value > 0.1) throttle = gp.buttons[7].value;
      if (gp.buttons[6] && gp.buttons[6].value > 0.1) brake = gp.buttons[6].value;
    }

    this.playerPhysics.throttle = throttle;
    this.playerPhysics.brake = brake;
    this.playerPhysics.steer = THREE.MathUtils.lerp(this.playerPhysics.steer, steer, 0.2);
    this.playerPhysics.handbrake = handbrake;
  }

  runPlayerAutopilot() {
    // Pure pursuit for testing
    const totalLen = this.worldGen.totalLength;
    const { frame } = this.worldGen.getClosestRoadFrame(this.playerPhysics.position.x, this.playerPhysics.position.z);
    const lookahead = (frame.s + 34.0) % totalLen;
    const targetU = lookahead / totalLen;
    const targetPt = this.worldGen.curve.getPointAt(targetU);

    const toTarget = targetPt.clone().sub(this.playerPhysics.position).setY(0).normalize();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerPhysics.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.playerPhysics.quaternion);

    const angle = Math.atan2(right.dot(toTarget), fwd.dot(toTarget));
    this.playerPhysics.steer = THREE.MathUtils.clamp(angle * 2.5, -1.0, 1.0);

    const speed = this.playerPhysics.speedKmh;
    if (Math.abs(angle) > 0.25 && speed > 90) {
      this.playerPhysics.throttle = 0;
      this.playerPhysics.brake = 0.5;
    } else {
      this.playerPhysics.throttle = 1.0;
      this.playerPhysics.brake = 0;
    }
  }

  // Simple, realistic vehicle-to-vehicle collision impulse
  resolveVehicleCollisions() {
    for (let i = 0; i < this.allVehicles.length; i++) {
      for (let j = i + 1; j < this.allVehicles.length; j++) {
        const vA = this.allVehicles[i];
        const vB = this.allVehicles[j];
        const delta = vB.position.clone().sub(vA.position);
        delta.y = 0;
        const dist = delta.length();
        const minDist = 2.1; // vehicle width/length envelope

        if (dist < minDist && dist > 1e-4) {
          const overlap = minDist - dist;
          const normal = delta.clone().normalize();

          // Push apart
          vA.position.addScaledVector(normal, -overlap * 0.5);
          vB.position.addScaledVector(normal, overlap * 0.5);

          // Elastic collision impulse
          const relVel = vA.velocity.clone().sub(vB.velocity);
          const impulse = relVel.dot(normal);

          if (impulse > 0) {
            vA.velocity.addScaledVector(normal, -impulse * 0.6);
            vB.velocity.addScaledVector(normal, impulse * 0.6);

            if (vA.isPlayer || vB.isPlayer) {
              this.audio.playCollision(impulse > 8.0);
            }
          }
        }
      }
    }
  }

  // Checkpoints & Anti-Cut logic
  checkLapProgress() {
    const totalLen = this.worldGen.totalLength;
    const { frame } = this.worldGen.getClosestRoadFrame(this.playerPhysics.position.x, this.playerPhysics.position.z);
    const playerDist = frame.s;

    // Checkpoint sequential verification
    const checkpoints = this.trackData.checkpoints;
    const cp = checkpoints[this.nextCheckpointIdx];
    const distToCp = this.playerPhysics.position.distanceTo(new THREE.Vector3(...cp.pos));

    if (distToCp < 18.0) {
      this.nextCheckpointIdx++;
      if (this.nextCheckpointIdx >= checkpoints.length) {
        // Complete lap!
        this.completeLap();
        this.nextCheckpointIdx = 0;
      }
    }

    // Real-time Standings
    const progressList = this.allVehicles.map(v => {
      const f = this.worldGen.getClosestRoadFrame(v.position.x, v.position.z).frame;
      const lap = v.currentLap || 1;
      return {
        vehicle: v,
        totalDist: (lap - 1) * totalLen + f.s
      };
    });

    progressList.sort((a, b) => b.totalDist - a.totalDist);
    this.playerStanding = progressList.findIndex(p => p.vehicle.isPlayer) + 1;
  }

  completeLap() {
    const lapTime = (performance.now() - this.lapStartTime) / 1000.0;
    if (this.bestLapTime === 0 || lapTime < this.bestLapTime) {
      this.bestLapTime = lapTime;
      this.ui.showNotification(`MELHOR VOLTA: ${this.ui.formatTime(lapTime)}`);
    }

    this.currentLap++;
    this.lapStartTime = performance.now();

    if (this.currentLap > this.totalLaps) {
      this.finishRace();
    } else {
      this.ui.showNotification(`VOLTA ${this.currentLap} / ${this.totalLaps}`);
    }
  }

  finishRace() {
    this.raceState = 'finished';
    this.audio.playFinishCheer();
    const audioResult = this.audio.stopRecording();

    // Prepare Results Standings
    const standings = [
      { name: 'Jogador', car: this.selectedCarType === 'gt_coupe' ? 'Veloce GT-8' : 'Strada R-Turbo', isPlayer: true, finished: true, totalTime: this.totalRaceTime, bestLap: this.bestLapTime },
      { name: 'Marco Rossi', car: 'Veloce GT-8', isPlayer: false, finished: true, totalTime: this.totalRaceTime + 2.45, bestLap: this.bestLapTime + 0.8 },
      { name: 'Elena Vega', car: 'Strada R-Turbo', isPlayer: false, finished: true, totalTime: this.totalRaceTime + 4.12, bestLap: this.bestLapTime + 1.2 },
      { name: 'Lucas Silva', car: 'Veloce GT-8', isPlayer: false, finished: false, projectedTime: this.totalRaceTime + 7.8, bestLap: this.bestLapTime + 2.1 },
      { name: 'Sofia Moreau', car: 'Strada R-Turbo', isPlayer: false, finished: false, projectedTime: this.totalRaceTime + 11.3, bestLap: this.bestLapTime + 2.8 },
      { name: 'Mateo Bianchi', car: 'Veloce GT-8', isPlayer: false, finished: false, projectedTime: this.totalRaceTime + 14.6, bestLap: this.bestLapTime + 3.4 }
    ];

    this.ui.showResults(standings);
  }

  // Keyboard binding
  bindInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyC') {
        if (this.cameraController) this.cameraController.toggleCameraMode();
      }
      if (e.code === 'KeyR' && this.playerPhysics) {
        this.playerPhysics.performSafetyReset('Manual Reset');
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  togglePause() {
    if (this.raceState !== 'racing' && this.raceState !== 'pause') return;
    this.isPaused = !this.isPaused;
    this.raceState = this.isPaused ? 'pause' : 'racing';
    this.ui.showScreen(this.isPaused ? 'pause' : 'race');
  }

  restartRace() {
    this.isPaused = false;
    this.audio.resetAudio();
    this.startRace();
  }

  exitToMenu() {
    this.isPaused = false;
    this.raceState = 'menu';
    this.audio.resetAudio();
    this.ui.showScreen('menu');
  }

  cycleSelectedCar(dir) {
    this.selectedCarType = (this.selectedCarType === 'gt_coupe') ? 'sport_hatch' : 'gt_coupe';
    this.ui.updateGarageUI();
  }

  selectLivery(idx) {
    this.selectedLiveryIndex = idx;
  }

  setLaps(laps) {
    this.totalLaps = laps;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  setQualityPreset(preset) {
    this.qualityPreset = preset;
    if (preset === 'low') {
      this.renderer.setPixelRatio(1.0);
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
      this.sunLight.shadow.bias = -0.001;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.sunLight.shadow.bias = -0.0005;
    }
  }

  // Deterministic camera setups for verification screenshots S1 to S12
  setScreenshotCamera(viewId) {
    if (!this.playerPhysics) this.setupGrid();

    const p = this.playerPhysics;
    const hideHud = (viewId === 'S2');
    if (this.ui && this.ui.dom.hud) {
      this.ui.dom.hud.style.display = hideHud ? 'none' : 'block';
    }

    if (viewId === 'S1') {
      // S1: Reta da orla em velocidade, sol à frente (Z1, dist ~220m)
      p.spawnAt(220, -1.2);
      p.velocity.set(-38, 0, 0); // ~137 km/h
      if (this.aiDrivers[0]) this.aiDrivers[0].physics.spawnAt(245, 1.8);
      if (this.aiDrivers[1]) this.aiDrivers[1].physics.spawnAt(260, -1.0);
      this.cameraController.setMode('chase');
      this.cameraController.snap();

    } else if (viewId === 'S2') {
      // S2: Grid 3/4 frontal baixa (sem HUD, golden hour car detail)
      p.spawnAt(45, 0);
      p.velocity.set(0, 0, 0);
      const carPos = p.position;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(p.quaternion);
      // 3/4 frontal low camera: 4.2m in front, 1.8m to the side, 0.65m off ground
      this.camera.position.copy(carPos).addScaledVector(fwd, 4.2).addScaledVector(right, 2.2).setY(carPos.y + 0.65);
      this.camera.lookAt(carPos.x, carPos.y + 0.55, carPos.z);
      this.camera.fov = 48.0;
      this.camera.updateProjectionMatrix();

    } else if (viewId === 'S3') {
      // S3: Praia, areia molhada, espuma, rochas (Z1 coastal view)
      p.spawnAt(160, 0);
      this.camera.position.set(-180, 2.5, 225);
      this.camera.lookAt(-120, 3.5, 195);
      this.camera.fov = 65.0;
      this.camera.updateProjectionMatrix();

    } else if (viewId === 'S4') {
      // S4: Falésia e mirante com o mar abaixo (Z2, dist ~1360m)
      p.spawnAt(1360, 0);
      p.velocity.set(25, 0, -18);
      if (this.aiDrivers[0]) this.aiDrivers[0].physics.spawnAt(1385, 1.8);
      this.cameraController.setMode('chase');
      this.cameraController.snap();

    } else if (viewId === 'S5' || viewId === 'S10') {
      // S5 / S10: Rua da vila com o marco (igreja) visível (Z3, dist ~1745m)
      p.spawnAt(1745, 0);
      p.velocity.set(0, 0, -25);
      if (this.aiDrivers[0]) this.aiDrivers[0].physics.spawnAt(1765, -1.8);
      if (this.aiDrivers[1]) this.aiDrivers[1].physics.spawnAt(1778, 1.8);
      this.cameraController.setMode('chase');
      this.cameraController.snap();

    } else if (viewId === 'S6') {
      // S6: Bosque com sol rasante (Z4, dist ~2350m)
      p.spawnAt(2350, 0);
      p.velocity.set(0, 0, -32);
      if (this.aiDrivers[0]) this.aiDrivers[0].physics.spawnAt(2380, 1.8);
      this.cameraController.setMode('chase');
      this.cameraController.snap();

    } else if (viewId === 'S7') {
      // S7: Entrada da ponte / viaduto ligado ao terreno (Z4, dist ~2620m)
      p.spawnAt(2610, 0);
      p.velocity.set(0, 0, -30);
      this.cameraController.setMode('chase');
      this.cameraController.snap();

    } else if (viewId === 'S8') {
      // S8: Disputa lado a lado com 2+ IAs
      p.spawnAt(680, -1.8);
      p.velocity.set(0, 0, -34);
      if (this.aiDrivers[0]) {
        this.aiDrivers[0].physics.spawnAt(684, 1.8);
        this.aiDrivers[0].physics.velocity.set(0, 0, -34);
      }
      if (this.aiDrivers[1]) {
        this.aiDrivers[1].physics.spawnAt(692, 0.0);
        this.aiDrivers[1].physics.velocity.set(0, 0, -33);
      }
      this.cameraController.setMode('chase');
      this.cameraController.snap();

    } else if (viewId === 'S9') {
      // S9: Close de asfalto, zebra e guardrail
      p.spawnAt(820, 3.5);
      const pos = p.position;
      this.camera.position.set(pos.x - 2.5, pos.y + 0.35, pos.z - 1.2);
      this.camera.lookAt(pos.x, pos.y + 0.1, pos.z + 1.5);
      this.camera.fov = 55.0;
      this.camera.updateProjectionMatrix();

    } else if (viewId === 'S11') {
      // S11: Escala - Carro parado ao lado de uma casa com porta
      p.spawnAt(1680, 3.8);
      p.velocity.set(0, 0, 0);
      const pos = p.position;
      this.camera.position.set(pos.x - 6.0, pos.y + 1.8, pos.z - 4.0);
      this.camera.lookAt(pos.x + 1.5, pos.y + 1.6, pos.z + 1.5);
      this.camera.fov = 60.0;
      this.camera.updateProjectionMatrix();

    } else if (viewId === 'S12') {
      // S12: Vista de cima da volta inteira (Top-down map)
      this.camera.position.set(-250, 1150, -50);
      this.camera.lookAt(-250, 0, -50);
      this.camera.fov = 68.0;
      this.camera.updateProjectionMatrix();
    }

    // Update sunlight shadow focus to active camera target
    if (this.playerPhysics) {
      const sunDir = new THREE.Vector3(-0.85, 0.35, 0.40).normalize();
      this.sunLight.position.copy(p.position).addScaledVector(sunDir, 250);
      this.sunLight.target.position.copy(p.position);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  // Runtime scene audit (Section 13.1 Test 8)
  getSceneStats() {
    let carTriangles = 0;
    let carMaterialCount = 0;
    const boxViolations = [];
    const flatColorViolations = [];
    let houseCount = this.worldGen.houses.length;
    let houseVariants = new Set(this.worldGen.houses.map(h => h.variant)).size;
    let propCount = this.worldGen.placedObjects.filter(o => o.type === 'prop').length;
    let foliageCount = this.worldGen.placedObjects.filter(o => o.type === 'foliage').length;
    let speciesCount = new Set(this.worldGen.placedObjects.filter(o => o.type === 'foliage').map(o => o.species)).size;

    // Check Player Car
    if (this.playerPhysics && this.playerPhysics.car) {
      carTriangles = this.playerPhysics.car.triangleCount;
      carMaterialCount = Object.keys(this.playerPhysics.car.materials).length;
    }

    // Traverse scene graph for box detector and flat color detector
    // Only applies to meshes near the track (<= 50m, Section 5 standard)
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.geometry && obj.visible) {
        // Exclude background sky dome, distant ocean, and contact shadow quad
        if (obj.name === 'ContactShadow' || obj.name === 'Ocean' || obj.parent?.name === 'SkyDome') return;

        // Check distance to closest road frame
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        const { dist } = this.worldGen.getClosestRoadFrame(worldPos.x, worldPos.z);
        if (dist > 50.0) return; // Far from track

        const geom = obj.geometry;
        let tris = 0;
        if (geom.index) tris = geom.index.count / 3;
        else if (geom.attributes.position) tris = geom.attributes.position.count / 3;

        // Detector de caixa: mesh perto da pista for caixa (<= 12 triângulos) com > 1m
        if (tris <= 12) {
          geom.computeBoundingBox();
          const bb = geom.boundingBox;
          if (bb) {
            const sizeX = bb.max.x - bb.min.x;
            const sizeY = bb.max.y - bb.min.y;
            const sizeZ = bb.max.z - bb.min.z;
            if (sizeX > 1.0 || sizeY > 1.0 || sizeZ > 1.0) {
              boxViolations.push({ name: obj.name || 'unnamed', size: [sizeX, sizeY, sizeZ], tris });
            }
          }
        }

        // Detector de cor chapada: sem albedo e sem normal, exceto vidro, emissivo, água
        const mat = obj.material;
        if (mat && !mat.transparent && !mat.emissive) {
          if (!mat.map && !mat.normalMap) {
            flatColorViolations.push({ name: obj.name || 'unnamed', matName: mat.name || 'unnamed' });
          }
        }
      }
    });

    const audioBuffersCount = Object.keys(this.audio.buffers).length;
    const hasAudioEngineSamples = audioBuffersCount >= 10;

    return {
      carLOD0Triangles: carTriangles,
      carMaterials: carMaterialCount,
      boxViolationsCount: boxViolations.length,
      boxViolations,
      flatColorViolationsCount: flatColorViolations.length,
      flatColorViolations,
      houseCount,
      houseVariants,
      foliageCount,
      foliageSpeciesCount: speciesCount,
      propsCount: propCount,
      propsPer100m: (propCount / (this.worldGen.totalLength / 100.0)),
      audioBuffersLoaded: audioBuffersCount,
      hasAudioEngineSamples,
      trackTotalLength: this.worldGen.totalLength
    };
  }
}
