import * as THREE from 'three';
import { TrackSpline } from './world/spline.js';
import { MaterialLibrary } from './world/materials.js';
import { TerrainHeightfield, buildRoadMeshAndCollider, buildTrackEdgeStructures } from './world/terrain-and-road.js';
import { validateWorld } from './world/validate-world.js';
import { PhysicsWorld, VehicleState, CAR_SPECS, FIXED_DT } from './physics/vehicle-physics.js';
import { AiDriverController } from './physics/ai-driver.js';
import { RaceCameraController } from './camera/race-camera.js';
import { LightingAndPostSystem } from './render/lighting.js';
import { CarBuilder, CAR_LIVERIES } from './cars/car-builder.js';
import { OceanSystem } from './world/ocean-and-beach.js';
import { CoastalPropsAndFloraSystem } from './world/props-and-flora.js';
import { VillageAndLandmarksSystem } from './world/village-and-landmarks.js';
import { WheelParticleSystem } from './render/particles.js';
import { RaceAudioEngine } from './audio/audio-engine.js';
import { RaceUiController } from './ui/ui-controller.js';

async function boot() {
  const barEl = document.getElementById('loading-bar');
  const statusEl = document.getElementById('loading-status');
  const setProgress = (p, msg) => {
    if (barEl) barEl.style.width = `${Math.round(p * 100)}%`;
    if (statusEl && msg) statusEl.textContent = msg;
  };

  setProgress(0.05, 'Carregando track.json...');
  const trackData = await (await fetch('./track.json')).json();
  const spline = new TrackSpline(trackData);

  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 0.25, 9500);

  setProgress(0.14, 'Carregando HDRI de pôr do sol CC0...');
  const lighting = new LightingAndPostSystem(renderer, scene, camera, trackData);
  await lighting.loadHdri('./assets/hdri/evening_road_01_puresky_2k.hdr');

  setProgress(0.28, 'Carregando materiais PBR CC0...');
  const matLib = new MaterialLibrary();
  await matLib.loadAll((f) => setProgress(0.28 + f * 0.28, 'Carregando texturas PBR...'));
  if (matLib.materials.road.userData.totalLengthUniform) {
    matLib.materials.road.userData.totalLengthUniform.value = spline.totalLength;
  }

  setProgress(0.58, 'Derivando estrada, terreno e colliders da spline única...');
  const terrain = new TerrainHeightfield(spline);
  const terrainMesh = terrain.buildMesh(matLib.materials.terrain);
  scene.add(terrainMesh);

  const { mesh: roadMesh, collider: roadCollider } = buildRoadMeshAndCollider(spline, matLib.materials.road);
  scene.add(roadMesh);

  const { group: edgeGroup, barrierRuns, bridgeMeta } = buildTrackEdgeStructures(spline, terrain, matLib);
  scene.add(edgeGroup);

  const world = {
    trackData,
    spline,
    terrain,
    terrainMesh,
    roadMesh,
    roadCollider,
    barrierRuns,
    bridge: bridgeMeta,
    placedObjects: [],
    buildings: [],
    obstacleColliders: []
  };

  setProgress(0.66, 'Construindo Z3 Vila Costeira, Igreja, Praça e Mirante da Falésia...');
  const villageAndLandmarks = new VillageAndLandmarksSystem(world, matLib);
  scene.add(villageAndLandmarks.group);
  world.village = villageAndLandmarks;

  setProgress(0.73, 'Populando Z1–Z4 (pórtico, palmeiras, pinheiros-mansos, oliveiras, rochas e mar)...');
  const propsAndFlora = new CoastalPropsAndFloraSystem(world, matLib);
  scene.add(propsAndFlora.group);

  const ocean = new OceanSystem(terrain, trackData, propsAndFlora.coastalRocks);
  scene.add(ocean.mesh);
  world.ocean = ocean;
  world.propsAndFlora = propsAndFlora;

  setProgress(0.80, 'Carregando amostras CC0 de motor real em múltiplas faixas de RPM...');
  const audio = new RaceAudioEngine(world);
  await audio.preloadSamples((f) => setProgress(0.80 + f * 0.10, 'Carregando amostras de áudio CC0...'));

  setProgress(0.91, 'Construindo grid de 6 carros e sistema de partículas...');
  const carBuilder = new CarBuilder(matLib);
  const particles = new WheelParticleSystem(scene, matLib);
  const physics = new PhysicsWorld(world);
  const aiController = new AiDriverController(spline);

  const aiNames = ['M. Costa', 'L. Bellini', 'R. Navarro', 'S. Moreau', 'T. Lindqvist'];
  const visualCache = new Map();
  const getCachedCarVisual = (slotIdx, modelId, liveryIndex) => {
    const key = `${slotIdx}_${modelId}_${liveryIndex}`;
    let vis = visualCache.get(key);
    if (!vis) {
      vis = carBuilder.createCar(modelId, liveryIndex);
      visualCache.set(key, vis);
    }
    return vis;
  };

  const vehicles = [];
  const carVisuals = [];
  for (let i = 0; i < 6; i++) {
    const isPlayer = i === 0;
    const modelId = i % 2 === 0 ? 'gt' : 'hatch';
    const vState = new VehicleState({
      index: i,
      isPlayer,
      modelId,
      liveryIndex: i,
      name: isPlayer ? 'Você' : aiNames[i - 1]
    });
    const vVisual = getCachedCarVisual(i, modelId, i);
    scene.add(vVisual.root);
    vehicles.push(vState);
    carVisuals.push(vVisual);
  }
  const playerCar = vehicles[0];

  const rebuildGridCars = (playerModelId = 'gt', playerLiveryIdx = 0) => {
    // Assign player model & livery, and give the 5 AIs distinct remaining liveries & alternating models
    const availLiveries = [];
    for (let l = 0; l < CAR_LIVERIES.length; l++) {
      if (l !== playerLiveryIdx) availLiveries.push(l);
    }
    for (let i = 0; i < 6; i++) {
      const mId = i === 0 ? playerModelId : ((i % 2 === 1) ? (playerModelId === 'gt' ? 'hatch' : 'gt') : playerModelId);
      const livIdx = i === 0 ? playerLiveryIdx : availLiveries[(i - 1) % availLiveries.length];
      const v = vehicles[i];
      v.modelId = mId;
      v.spec = CAR_SPECS[mId];
      v.liveryIndex = livIdx;

      const oldVis = carVisuals[i];
      const nextVis = getCachedCarVisual(i, mId, livIdx);
      if (oldVis !== nextVis) {
        scene.remove(oldVis.root);
        scene.add(nextVis.root);
        carVisuals[i] = nextVis;
      }
      carVisuals[i].syncFromVehicle(v);
    }
  };

  const applyQualityPreset = (quality = 'high') => {
    const q = quality === 'low' ? 'low' : 'high';
    lighting.setQuality(q);
    // Section 11: Low reduces shadows, far vegetation distance, internal res & post, while keeping 100% of PBR textures & shapes!
    const showFarFlora = q === 'high';
    for (const m of propsAndFlora.distantDetailMeshes) {
      m.visible = showFarFlora;
    }
    particles.instMesh.visible = true;
  };

  physics.spawnGrid(vehicles);

  setProgress(0.96, 'Verificando validateWorld() e pré-compilando shaders...');
  const validationReport = validateWorld(world, { throwOnError: true });

  const camController = new RaceCameraController(camera, world);
  camController.snapToVehicle(playerCar);

  const syncAllVisuals = () => {
    for (let i = 0; i < vehicles.length; i++) {
      carVisuals[i].syncFromVehicle(vehicles[i]);
    }
    ocean.update(physics.simTime);
    propsAndFlora.update(physics.simTime);
    lighting.update(carVisuals[0].root.position, playerCar.speedKmh, camController.mode);
  };
  syncAllVisuals();
  // Pre-compile shaders across scene so zone transitions have zero shader-compile hitch (Section 11)
  renderer.compile(scene, camera);

  // Wire UI Flow (starts on Live-Background Main Menu per Section 10)
  const app = {
    world,
    ocean,
    villageAndLandmarks,
    propsAndFlora,
    particles,
    audio,
    physics,
    vehicles,
    carVisuals,
    playerCar,
    aiController,
    camController,
    lighting,
    camera,
    scene,
    renderer,
    rebuildGridCars,
    applyQualityPreset
  };
  const ui = new RaceUiController(app);
  app.ui = ui;
  ui.showMenu();

  // Keyboard & Gamepad Input Handling
  const keys = new Set();
  let autopilotEnabled = false;

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyC' && (ui.screen === 'racing' || ui.screen === 'countdown')) {
      camController.toggleMode();
    } else if (e.code === 'KeyR' && ui.screen === 'racing' && !playerCar.finished) {
      physics.gameplayResetLog.push({ time: +physics.simTime.toFixed(2), car: playerCar.name, reason: 'manual_reset' });
      physics.placeCarOnSpline(playerCar, playerCar.lastValidS, 0);
    } else if (e.code === 'KeyM') {
      audio.toggleMute();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (ui.screen === 'racing' || ui.screen === 'countdown') ui.pauseRace();
      else if (ui.screen === 'paused') ui.resumeRace();
    } else if ((e.code === 'Enter' || e.code === 'Space') && ui.screen === 'intro') {
      ui._enterCountdown();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  const applyPlayerControls = () => {
    let throttle = (keys.has('KeyW') || keys.has('ArrowUp')) ? 1 : 0;
    let brake = (keys.has('KeyS') || keys.has('ArrowDown')) ? 1 : 0;
    let steer = ((keys.has('KeyA') || keys.has('ArrowLeft')) ? 1 : 0) + ((keys.has('KeyD') || keys.has('ArrowRight')) ? -1 : 0);
    let handbrake = keys.has('Space') ? 1 : 0;

    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const gp = pads && (pads[0] || pads[1] || pads[2] || pads[3]);
      if (gp) {
        const ax0 = gp.axes[0] || 0;
        if (Math.abs(ax0) > 0.12) steer = -ax0;
        if (gp.buttons[7]?.value > 0.05) throttle = Math.max(throttle, gp.buttons[7].value);
        if (gp.buttons[6]?.value > 0.05) brake = Math.max(brake, gp.buttons[6].value);
        if (gp.buttons[0]?.pressed) handbrake = 1;
      }
    }

    playerCar.throttle = Math.max(0, Math.min(1, throttle));
    playerCar.brake = Math.max(0, Math.min(1, brake));
    playerCar.steer = Math.max(-1, Math.min(1, steer));
    playerCar.handbrake = handbrake;
  };

  // Frame-Time Ring Buffer for Real FPS & 1% Low Telemetry (Section 13.3 & 13.4)
  const frameTimesMs = [];
  const MAX_FPS_SAMPLES = 600;
  const getFpsMetrics = () => {
    if (frameTimesMs.length === 0) return { avgFps: 60, onePercentLowFps: 60, sampleCount: 0 };
    let sum = 0;
    for (let i = 0; i < frameTimesMs.length; i++) sum += frameTimesMs[i];
    const avgMs = sum / frameTimesMs.length;
    const sortedDesc = [...frameTimesMs].sort((a, b) => b - a);
    const worstCount = Math.max(1, Math.ceil(sortedDesc.length * 0.01));
    let worstSum = 0;
    for (let i = 0; i < worstCount; i++) worstSum += sortedDesc[i];
    const p99Ms = worstSum / worstCount;
    return {
      avgFps: +(1000 / Math.max(1, avgMs)).toFixed(1),
      onePercentLowFps: +(1000 / Math.max(1, p99Ms)).toFixed(1),
      sampleCount: frameTimesMs.length
    };
  };

  setProgress(1.0, 'Pronto');
  document.getElementById('loading-screen')?.classList.add('hidden');

  const showRaceHudForCapture = (visible = true, freeze = true) => {
    if (scene.fog) {
      scene.fog.near = 190;
      scene.fog.far = 1900;
    }
    ui._hideAllOverlays();
    ui.screen = freeze ? 'scripted' : (visible ? 'racing' : 'scripted');
    for (let i = 0; i < carVisuals.length; i++) carVisuals[i].root.visible = true;
    if (visible) {
      ui.els.hud?.classList.remove('hidden');
      ui._updateHudDom();
    }
  };

  const primeMidRaceVehicle = (car, sCar) => {
    const cpCount = spline.checkpoints.length;
    const cpStep = spline.totalLength / cpCount;
    const passedCp = Math.min(cpCount - 1, Math.max(0, Math.floor(sCar / cpStep)));
    car.lap = 2;
    car.completedLaps = 1;
    car.finished = false;
    car.projectedFinish = false;
    car.finishTime = null;
    car.nextCheckpoint = (passedCp + 1) % cpCount;
    car.checkpointsMask = (1 << (passedCp + 1)) - 1;
    car.currentLapTime = (sCar / spline.totalLength) * 112.4;
    car.totalRaceTime = 112.8 + car.currentLapTime;
    car.bestLapTime = 111.85;
  };

  window.__RACING_BENCH__ = {
    gate: 'P6',
    world,
    ocean,
    villageAndLandmarks,
    propsAndFlora,
    particles,
    audio,
    ui,
    physics,
    vehicles,
    carVisuals,
    playerCar,
    aiController,
    camController,
    lighting,
    camera,
    scene,
    renderer,
    validateWorld: () => validateWorld(world, { throwOnError: true }),
    validationReport,
    setAutopilot: (v) => { autopilotEnabled = !!v; },
    setControlOverride: (ovr) => {
      window.__RB_CTRL_OVR__ = ovr
        ? { ...ovr, untilSimTime: physics.simTime + (ovr.durationSec ?? 0.5) }
        : null;
    },
    getFpsMetrics,
    resetFpsMetrics: () => { frameTimesMs.length = 0; },
    applyQualityPreset: (q) => ui.setQuality(q),
    countCarStats: () => carVisuals.map((cv) => {
      let tris = 0;
      const matSet = new Set();
      cv.root.traverse((obj) => {
        if (obj.isMesh && obj.userData.auditRole !== 'contact_shadow') {
          const g = obj.geometry;
          tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
          if (Array.isArray(obj.material)) obj.material.forEach(m => matSet.add(m));
          else if (obj.material) matSet.add(obj.material);
        }
      });
      return { name: cv.root.name, modelId: cv.root.userData.carModelId, triangles: Math.round(tris), materials: matSet.size };
    }),

    stagePackAtS: (sPlayer, settleSteps = 36, showHud = true, freeze = true) => {
      const relOffsets = [
        [0.0,  -1.65],
        [10.5,  1.85],
        [19.0, -1.45],
        [5.2,   2.15],
        [-14.5, 1.55],
        [28.5,  0.95]
      ];
      ui.setLaps(3);
      physics.totalLaps = 3;
      for (let i = 0; i < carVisuals.length; i++) carVisuals[i].root.visible = true;
      physics.racePhase = 'racing';
      autopilotEnabled = true;
      for (let i = 0; i < vehicles.length; i++) {
        const [ds, latD] = relOffsets[i % relOffsets.length];
        const car = vehicles[i];
        const sCar = spline.wrapS(sPlayer + ds);
        physics.placeCarOnSpline(car, sCar, latD);
        primeMidRaceVehicle(car, sCar);
        const rl = spline.sampleRacingLine(sCar);
        const initSpd = Math.min(36.5, rl.targetSpeed * 0.90);
        car.vx = Math.sin(car.yaw) * initSpd;
        car.vz = Math.cos(car.yaw) * initSpd;
        car.forwardSpeed = initSpd;
        car.speedKmh = initSpd * 3.6;
        car.gear = initSpd > 28 ? 4 : 3;
        car.rpm = 5500;
      }
      physics._updatePositions();
      for (let s = 0; s < settleSteps; s++) {
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          aiController.updateVehicle(v, vehicles, ui.selectedDifficulty, physics.simTime, FIXED_DT, v.isPlayer);
        }
        physics.substep(FIXED_DT);
      }
      camController.mode = 'chase';
      camera.fov = 64;
      camera.up.set(0, 1, 0);
      camera.updateProjectionMatrix();
      camController.snapToVehicle(playerCar);
      syncAllVisuals();
      ocean.update(physics.simTime);
      propsAndFlora.update(physics.simTime);
      lighting.update(new THREE.Vector3(playerCar.x, playerCar.y, playerCar.z), playerCar.speedKmh, 'chase');
      showRaceHudForCapture(showHud, freeze);
      lighting.render();
    },

    // S1: Reta da orla em velocidade, sol à frente (com HUD, IAs presentes, Alta — Refs 01, 02)
    setS1Camera: () => {
      ui.setQuality('high');
      window.__RACING_BENCH__.stagePackAtS(82.0, 32, true);
    },

    // S2: Carro no grid, 3/4 frontal baixa (SEM HUD — Ref 11)
    setS2Front34Camera: (carIdx = 0) => {
      ui.setQuality('high');
      physics.spawnGrid(vehicles);
      showRaceHudForCapture(false);
      camController.mode = 'scripted';
      const targetCar = vehicles[carIdx];
      const fx = Math.sin(targetCar.yaw);
      const fz = Math.cos(targetCar.yaw);
      const rx = -Math.cos(targetCar.yaw);
      const rz = Math.sin(targetCar.yaw);
      camera.fov = 44;
      camera.up.set(0, 1, 0);
      const baseG = targetCar.y - targetCar.spec.wheelRadius - 0.16;
      camera.position.set(
        targetCar.x + fx * 3.95 + rx * 2.55,
        baseG + 0.90,
        targetCar.z + fz * 3.95 + rz * 2.55
      );
      camera.lookAt(targetCar.x - fx * 0.25, baseG + 0.64, targetCar.z - fz * 0.25);
      camera.updateProjectionMatrix();
      syncAllVisuals();
      lighting.update(new THREE.Vector3(targetCar.x, baseG, targetCar.z), 0, 'scripted');
      lighting.render();
    },
    setS2Camera: (carIdx = 0) => window.__RACING_BENCH__.setS2Front34Camera(carIdx),

    // S3: Câmera baixa: areia molhada, espuma, rochas (Refs 02, 04)
    setS3Camera: () => {
      ui.setQuality('high');
      window.__RACING_BENCH__.stagePackAtS(155.0, 16, true);
      camController.mode = 'scripted';
      const camX = 128.0;
      const camZ = terrain.shorelineZ(camX) - 1.4;
      const gHit = terrain.raycastDown(camX, camZ);
      const lookX = 202.0;
      const lookZ = terrain.shorelineZ(lookX) - 0.8;
      camera.fov = 55;
      camera.up.set(0, 1, 0);
      camera.position.set(camX, gHit.y + 1.26, camZ);
      camera.lookAt(lookX, 1.55, lookZ);
      camera.updateProjectionMatrix();
      ocean.update(physics.simTime);
      propsAndFlora.update(physics.simTime);
      lighting.update(new THREE.Vector3(camX + 26, gHit.y, camZ + 2), 0, 'scripted');
      lighting.render();
    },

    // S4: Serpentina com o mar abaixo (Ref 02)
    setS4Camera: () => {
      ui.setQuality('high');
      window.__RACING_BENCH__.stagePackAtS(1038, 32, true);
    },

    // S5: Rua da vila com o marco visível em Alta (Refs 05, 06, 07)
    setS5Camera: () => {
      ui.setQuality('high');
      window.__RACING_BENCH__.stagePackAtS(1572, 32, true);
    },

    // S6: Bosque com sol rasante (Refs 08, 10)
    setS6Camera: () => {
      ui.setQuality('high');
      window.__RACING_BENCH__.stagePackAtS(2218, 32, true);
    },

    // S7: Entrada da ponte ligada ao terreno (Ref 14)
    setS7Camera: () => {
      ui.setQuality('high');
      const bs = spline.bridge.startS;
      window.__RACING_BENCH__.stagePackAtS(bs + 10.0, 20, true);
      camController.mode = 'scripted';
      const camPt = spline.roadPoint(bs - 7.5, -18.5, 0);
      const camHit = terrain.raycastDown(camPt.x, camPt.z);
      const lookPt = spline.roadPoint(bs + 34.0, 0.5, -3.4);
      camera.fov = 58;
      camera.up.set(0, 1, 0);
      camera.position.set(camPt.x, Math.max(camHit.y + 3.4, camPt.y + 3.8), camPt.z);
      camera.lookAt(lookPt.x, lookPt.y, lookPt.z);
      camera.updateProjectionMatrix();
      syncAllVisuals();
      lighting.update(new THREE.Vector3(lookPt.x, lookPt.y, lookPt.z), 0, 'scripted');
      lighting.render();
    },

    // S8: Jogador lado a lado com 2+ IAs (Refs 09, 13)
    setS8Camera: () => {
      ui.setQuality('high');
      ui.setLaps(3);
      physics.totalLaps = 3;
      const sBase = 2146.0; // Sweeping sunlit Z4 stone-pine & olive forest curve with 3-wide door-to-door battle (Ref 09 & 13)
      const packOffsets = [
        [0.00,  0.00], // Player center (#04)
        [0.45, -2.60], // AI 1 door-to-door left (#11)
        [0.65,  2.60], // AI 2 door-to-door right (#27)
        [9.40, -1.65], // AI 3 battling just ahead-left
        [14.2,  1.60], // AI 4 ahead-right
        [-16.5, 0.90]  // AI 5 behind chase camera so zero hood photobombing
      ];
      for (let i = 0; i < carVisuals.length; i++) carVisuals[i].root.visible = true;
      physics.racePhase = 'racing';
      autopilotEnabled = true;
      for (let i = 0; i < vehicles.length; i++) {
        const [ds, latD] = packOffsets[i];
        const car = vehicles[i];
        const sCar = spline.wrapS(sBase + ds);
        physics.placeCarOnSpline(car, sCar, latD);
        primeMidRaceVehicle(car, sCar);
        const spd = 34.5;
        car.vx = Math.sin(car.yaw) * spd;
        car.vz = Math.cos(car.yaw) * spd;
        car.forwardSpeed = spd;
        car.speedKmh = spd * 3.6;
        car.gear = 4;
        car.rpm = 6150;
      }
      physics._updatePositions();
      for (let step = 0; step < 2; step++) {
        for (let i = 0; i < vehicles.length; i++) {
          aiController.updateVehicle(vehicles[i], vehicles, 'normal', physics.simTime, FIXED_DT, vehicles[i].isPlayer);
        }
        physics.substep(FIXED_DT);
      }
      camController.mode = 'chase';
      camera.fov = 66;
      camera.up.set(0, 1, 0);
      camera.updateProjectionMatrix();
      camController.snapToVehicle(playerCar);
      syncAllVisuals();
      ocean.update(physics.simTime);
      propsAndFlora.update(physics.simTime);
      lighting.update(new THREE.Vector3(playerCar.x, playerCar.y, playerCar.z), playerCar.speedKmh, 'chase');
      showRaceHudForCapture(true, true);
      lighting.render();
    },

    // S9: Close de asfalto (2048^2), zebra chanfrada e guardrail metálico com pelotão ao fundo
    setS9Camera: () => {
      ui.setQuality('high');
      // At s=573..630 (side +1), beveled red/white curb AND galvanized W-beam steel guardrail coexist right beside 2048^2 asphalt
      window.__RACING_BENCH__.stagePackAtS(602.0, 10, true);
      camController.mode = 'scripted';
      const sCam = 577.5;
      const smp = spline.sampleAt(sCam);
      const camPt = spline.roadPoint(sCam, smp.halfWidth - 1.15, 0.56);
      const lookPt = spline.roadPoint(sCam + 16.5, smp.halfWidth - 0.28, 0.96);
      camera.fov = 54;
      camera.up.set(0, 1, 0);
      camera.position.set(camPt.x, camPt.y, camPt.z);
      camera.lookAt(lookPt.x, lookPt.y, lookPt.z);
      camera.updateProjectionMatrix();
      syncAllVisuals();
      lighting.update(new THREE.Vector3(lookPt.x, lookPt.y, lookPt.z), 0, 'scripted');
      lighting.render();
    },

    // S10: Posição exata de S5 em qualidade Baixa (Seção 11 & 13.4: mantém texturas PBR e formas 3D!)
    setS10Camera: () => {
      ui.setQuality('low');
      window.__RACING_BENCH__.stagePackAtS(1572, 32, true);
    },

    // S11: Carro parado ao lado de uma casa com porta (~2,1 m) e andares (~3 m) para prova de escala
    setS11Camera: () => {
      ui.setQuality('high');
      ui.setLaps(3);
      physics.totalLaps = 3;
      const house = world.scaleReferenceHouse;
      const sHouse = house ? house.s : (trackData.landmarks?.scaleHouseAtS || 1528);
      autopilotEnabled = false;
      physics.racePhase = 'countdown';
      const smp = spline.sampleAt(sHouse);
      physics.placeCarOnSpline(playerCar, sHouse - 0.6, smp.halfWidth - 1.35);
      primeMidRaceVehicle(playerCar, sHouse - 0.6);
      for (let i = 1; i < vehicles.length; i++) {
        const sAi = spline.wrapS(sHouse + 55 + i * 11);
        physics.placeCarOnSpline(vehicles[i], sAi, (i % 2 === 0 ? -2.0 : 2.0));
        primeMidRaceVehicle(vehicles[i], sAi);
      }
      physics._updatePositions();
      showRaceHudForCapture(true);
      camController.mode = 'scripted';
      const camPt = spline.roadPoint(sHouse + 9.2, -3.4, 0);
      const camHit = terrain.raycastDown(camPt.x, camPt.z);
      const doorLookX = house ? (playerCar.x * 0.48 + house.x * 0.52) : playerCar.x;
      const doorLookZ = house ? (playerCar.z * 0.48 + house.z * 0.52) : playerCar.z;
      camera.fov = 48;
      camera.up.set(0, 1, 0);
      camera.position.set(camPt.x, Math.max(camHit.y, camPt.y) + 1.72, camPt.z);
      camera.lookAt(doorLookX, playerCar.y + 1.45, doorLookZ);
      camera.updateProjectionMatrix();
      syncAllVisuals();
      lighting.update(new THREE.Vector3(playerCar.x, playerCar.y, playerCar.z), 0, 'scripted');
      lighting.render();
    },

    // S12: Vista de cima da volta inteira (3,02 km fechada: Z1 Orla, Z2 Falésia, Z3 Vila, Z4 Bosque e Ponte)
    setS12Camera: () => {
      ui.setQuality('high');
      window.__RACING_BENCH__.stagePackAtS(90.0, 12, true, true);
      if (scene.fog) {
        scene.fog.near = 1600;
        scene.fog.far = 4200;
      }
      camController.mode = 'scripted';
      camera.fov = 50;
      camera.position.set(-10, 835, -60);
      camera.up.set(0, 0, -1);
      camera.lookAt(-10, 22, -60);
      camera.updateProjectionMatrix();
      syncAllVisuals();
      lighting.update(new THREE.Vector3(-10, 22, -60), 0, 'scripted');
      lighting.render();
    },

    stepFast: (steps = 60) => {
      for (let s = 0; s < steps; s++) {
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          if (!v.isPlayer || autopilotEnabled) {
            aiController.updateVehicle(v, vehicles, ui.selectedDifficulty, physics.simTime, FIXED_DT, v.isPlayer);
          }
        }
        physics.substep(FIXED_DT);
      }
      syncAllVisuals();
      if (camController.mode !== 'scripted') {
        camController.update(playerCar, FIXED_DT, false);
      }
      audio.update(vehicles, camera, physics.simTime, FIXED_DT * steps);
      if (ui.screen === 'racing' && physics.racePhase === 'finished') {
        ui.showResults();
      } else if (ui.screen === 'racing') {
        ui._updateHudDom();
      }
    }
  };

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const rawMs = now - lastTime;
    lastTime = now;
    if (rawMs > 0.5 && rawMs < 250) {
      frameTimesMs.push(rawMs);
      if (frameTimesMs.length > MAX_FPS_SAMPLES) frameTimesMs.shift();
    }
    const dt = Math.min(0.05, Math.max(0.001, rawMs / 1000));

    const isPaused = ui.screen === 'paused' || (ui.screen === 'settings' && ui.prevScreenForSettings === 'paused');

    if (!isPaused && ui.screen !== 'scripted') {
      if ((ui.screen === 'racing' || ui.screen === 'countdown') && !autopilotEnabled) {
        applyPlayerControls();
      }

      const simActive = ui.screen === 'menu' ||
                        (ui.screen === 'settings' && ui.prevScreenForSettings === 'menu') ||
                        ui.screen === 'countdown' ||
                        ui.screen === 'racing';

      if (simActive) {
        physics.step(dt, (subDt) => {
          for (let i = 0; i < vehicles.length; i++) {
            const v = vehicles[i];
            if (!v.isPlayer || autopilotEnabled || ui.screen === 'menu') {
              aiController.updateVehicle(v, vehicles, ui.selectedDifficulty, physics.simTime, subDt, v.isPlayer);
            }
          }
          const ovr = window.__RB_CTRL_OVR__;
          if (ovr && physics.simTime < ovr.untilSimTime) {
            if (typeof ovr.throttle === 'number') playerCar.throttle = ovr.throttle;
            if (typeof ovr.brake === 'number') playerCar.brake = ovr.brake;
            if (typeof ovr.steer === 'number') playerCar.steer = ovr.steer;
            if (typeof ovr.handbrake === 'number') playerCar.handbrake = ovr.handbrake;
          }
        });
      }

      syncAllVisuals();
      if (camController.mode !== 'scripted') {
        camController.update(playerCar, dt, false);
      }
      if (ui.screen === 'racing') {
        particles.update(vehicles, camera, dt);
      }
      audio.update(vehicles, camera, physics.simTime, dt);
      ui.update(dt);
    }

    lighting.render();
  }
  requestAnimationFrame(animate);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    lighting.resize(window.innerWidth, window.innerHeight);
  });
}

boot().catch((err) => {
  console.error('[BOOT ERROR]', err);
  const st = document.getElementById('loading-status');
  if (st) st.textContent = 'Erro: ' + err.message;
});
