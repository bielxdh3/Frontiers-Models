import * as THREE from 'three';
import { CAR_LIVERIES } from '../cars/car-builder.js';
import { CAR_SPECS } from '../physics/vehicle-physics.js';

export function formatRaceTime(sec, approx = false) {
  if (sec == null || !Number.isFinite(sec)) return '--:--.--';
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  const whole = Math.floor(rem);
  const cs = Math.floor((rem - whole) * 100);
  const txt = `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  return approx ? `≈ ${txt}` : txt;
}

// Section 10 — Complete UI Flow, Sunset Garage, ~5s Grid Intro, 3-2-1 Countdown, Discrete HUD, Minimap, Pause & Results
export class RaceUiController {
  constructor(app) {
    this.app = app;
    this.screen = 'menu'; // 'menu' | 'garage' | 'config' | 'intro' | 'countdown' | 'racing' | 'paused' | 'results'
    this.prevScreenForSettings = 'menu';

    this.selectedModel = 'gt';
    this.selectedLivery = 0;
    this.selectedLaps = 3;
    this.selectedDifficulty = 'normal';
    this.selectedQuality = 'high';

    this.introDurationSec = 4.8; // ~5s Grid Presentation (Section 10)
    this.phaseTimer = 0;
    this.lastCountdownDigit = null;
    this.garageOrbitAngle = 0.65;
    this.menuCameraS = 40;

    // Locate Start/Finish gantry emissive light pods to synchronize 3-2-1 lights!
    this.gantryLightMat = null;
    app.propsAndFlora.group.traverse((obj) => {
      if (obj.isMesh && obj.userData.auditRole === 'emissive' && obj.material) {
        this.gantryLightMat = obj.material;
      }
    });

    this._cacheDom();
    this._buildLiverySwatches();
    this._bindEvents();
    this._precomputeMinimapPath();
  }

  _cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      menu: $('menu-screen'),
      garage: $('garage-screen'),
      config: $('config-screen'),
      settings: $('settings-screen'),
      intro: $('intro-banner'),
      countdown: $('countdown-overlay'),
      countdownText: $('countdown-text'),
      hud: $('hud'),
      pause: $('pause-screen'),
      results: $('results-screen'),

      garageTitle: $('garage-car-title'),
      garageDesc: $('garage-car-desc'),
      btnCarGt: $('btn-car-gt'),
      btnCarHatch: $('btn-car-hatch'),
      swatches: $('livery-swatches'),

      introTitle: $('intro-title'),
      introSub: $('intro-sub'),

      hudPos: $('hud-pos'),
      hudLap: $('hud-lap'),
      hudLapsTotal: $('hud-laps-total'),
      hudTimeCur: $('hud-time-cur'),
      hudTimeBest: $('hud-time-best'),
      hudSpeed: $('hud-speed'),
      hudGear: $('hud-gear'),
      hudRpmFill: $('hud-rpm-fill'),
      hudRpmText: $('hud-rpm-text'),
      hudCamLabel: $('hud-cam-label'),
      hudWrongWay: $('hud-wrongway'),
      minimap: $('minimap-canvas'),

      resultsHeadline: $('results-headline'),
      resultsTbody: $('results-tbody'),

      volMaster: $('vol-master'),
      volMasterVal: $('vol-master-val'),
      volSfx: $('vol-sfx'),
      volSfxVal: $('vol-sfx-val'),
      volMusic: $('vol-music'),
      volMusicVal: $('vol-music-val')
    };
    this.minimapCtx = this.els.minimap ? this.els.minimap.getContext('2d') : null;
  }

  _buildLiverySwatches() {
    const container = this.els.swatches;
    if (!container) return;
    container.innerHTML = '';
    CAR_LIVERIES.forEach((liv, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-swatch${idx === this.selectedLivery ? ' active' : ''}`;
      btn.style.background = `linear-gradient(135deg, ${liv.primary} 62%, ${liv.accent} 100%)`;
      btn.dataset.livery = String(idx);
      btn.title = `#${liv.number} ${liv.name}`;
      btn.setAttribute('aria-label', `Pintura ${liv.name} número ${liv.number}`);
      btn.textContent = liv.number;
      btn.addEventListener('click', () => {
        this.app.audio.playUiSound('nav');
        this.selectCarAndLivery(this.selectedModel, idx);
      });
      container.appendChild(btn);
    });
  }

  _bindEvents() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

    // 1. Main Menu
    on('btn-menu-garage', () => {
      this.app.audio.ensureStarted();
      this.app.audio.playUiSound('confirm');
      this.showGarage();
    });
    on('btn-menu-settings', () => {
      this.app.audio.ensureStarted();
      this.app.audio.playUiSound('nav');
      this.openSettings('menu');
    });

    // 2. Garage
    on('btn-car-gt', () => {
      this.app.audio.playUiSound('nav');
      this.selectCarAndLivery('gt', this.selectedLivery);
    });
    on('btn-car-hatch', () => {
      this.app.audio.playUiSound('nav');
      this.selectCarAndLivery('hatch', this.selectedLivery);
    });
    on('btn-garage-back', () => {
      this.app.audio.playUiSound('nav');
      this.showMenu();
    });
    on('btn-garage-next', () => {
      this.app.audio.playUiSound('confirm');
      this.showConfig();
    });

    // 3. Race Config segmented controls
    document.querySelectorAll('#cfg-laps-group .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.audio.playUiSound('nav');
        this.setLaps(Number(btn.dataset.laps) || 3);
      });
    });
    document.querySelectorAll('#cfg-diff-group .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.audio.playUiSound('nav');
        this.setDifficulty(btn.dataset.diff || 'normal');
      });
    });
    document.querySelectorAll('#cfg-quality-group .seg-btn, #opt-quality-group .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.audio.playUiSound('nav');
        this.setQuality(btn.dataset.quality || 'high');
      });
    });

    on('btn-config-back', () => {
      this.app.audio.playUiSound('nav');
      this.showGarage();
    });
    on('btn-start-race', () => {
      this.app.audio.ensureStarted();
      this.app.audio.playUiSound('confirm');
      this.startRaceSequence();
    });

    // Settings Modal
    on('btn-settings-close', () => {
      this.app.audio.playUiSound('confirm');
      this.els.settings?.classList.add('hidden');
      if (this.prevScreenForSettings === 'paused') {
        this.els.pause?.classList.remove('hidden');
        this.screen = 'paused';
      } else {
        this.els.menu?.classList.remove('hidden');
        this.screen = 'menu';
      }
    });

    const bindVol = (el, valEl, key) => {
      el?.addEventListener('input', () => {
        const v = Number(el.value);
        if (valEl) valEl.textContent = `${v}%`;
        this.app.audio.setVolumes({ [key]: v / 100 });
      });
    };
    bindVol(this.els.volMaster, this.els.volMasterVal, 'master');
    bindVol(this.els.volSfx, this.els.volSfxVal, 'sfx');
    bindVol(this.els.volMusic, this.els.volMusicVal, 'music');

    // Pause Menu
    on('btn-pause-resume', () => {
      this.app.audio.playUiSound('confirm');
      this.resumeRace();
    });
    on('btn-pause-restart', () => {
      this.app.audio.playUiSound('confirm');
      this.restartRace();
    });
    on('btn-pause-settings', () => {
      this.app.audio.playUiSound('nav');
      this.openSettings('paused');
    });
    on('btn-pause-menu', () => {
      this.app.audio.playUiSound('nav');
      this.showMenu();
    });

    // Results Screen
    on('btn-results-again', () => {
      this.app.audio.playUiSound('confirm');
      this.startRaceSequence();
    });
    on('btn-results-menu', () => {
      this.app.audio.playUiSound('nav');
      this.showMenu();
    });
  }

  _hideAllOverlays() {
    for (const key of ['menu', 'garage', 'config', 'settings', 'intro', 'countdown', 'hud', 'pause', 'results']) {
      this.els[key]?.classList.add('hidden');
    }
  }

  _precomputeMinimapPath() {
    const samples = this.app.world.spline.samples;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < samples.length; i += 4) {
      const s = samples[i];
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const scale = 178 / Math.max(spanX, spanZ);
    this.mapTransform = {
      toX: (x) => 110 + (x - (minX + maxX) * 0.5) * scale,
      toY: (z) => 110 + (z - (minZ + maxZ) * 0.5) * scale
    };
  }

  setLaps(laps) {
    this.selectedLaps = laps === 6 ? 6 : 3;
    if (this.els.hudLapsTotal) this.els.hudLapsTotal.textContent = String(this.selectedLaps);
    document.querySelectorAll('#cfg-laps-group .seg-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.laps) === this.selectedLaps);
    });
  }

  setDifficulty(diff) {
    this.selectedDifficulty = ['easy', 'normal', 'hard'].includes(diff) ? diff : 'normal';
    document.querySelectorAll('#cfg-diff-group .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.diff === this.selectedDifficulty);
    });
  }

  setQuality(quality) {
    this.selectedQuality = quality === 'low' ? 'low' : 'high';
    document.querySelectorAll('#cfg-quality-group .seg-btn, #opt-quality-group .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.quality === this.selectedQuality);
    });
    this.app.applyQualityPreset(this.selectedQuality);
  }

  selectCarAndLivery(modelId, liveryIndex) {
    this.selectedModel = modelId === 'hatch' ? 'hatch' : 'gt';
    this.selectedLivery = ((liveryIndex % CAR_LIVERIES.length) + CAR_LIVERIES.length) % CAR_LIVERIES.length;

    this.els.btnCarGt?.classList.toggle('active', this.selectedModel === 'gt');
    this.els.btnCarHatch?.classList.toggle('active', this.selectedModel === 'hatch');
    document.querySelectorAll('#livery-swatches .color-swatch').forEach((sw, idx) => {
      sw.classList.toggle('active', idx === this.selectedLivery);
    });

    if (this.els.garageTitle) {
      this.els.garageTitle.textContent = this.selectedModel === 'gt' ? 'Solare GT' : 'Vento RS';
    }
    if (this.els.garageDesc) {
      this.els.garageDesc.textContent = this.selectedModel === 'gt'
        ? 'Cupê GT baixo de linhas fluidas, aerodinâmica equilibrada e timbre grave.'
        : 'Hot hatch compacto de entre-eixos curto, retomada ágil e motor girador.';
    }

    this.app.rebuildGridCars(this.selectedModel, this.selectedLivery);
    if (this.screen === 'garage') {
      this._stageGarageTurntable();
    }
  }

  // 1. Live-Background Main Menu (5 AIs circulating live on coastal circuit in background!)
  showMenu() {
    this._hideAllOverlays();
    this.screen = 'menu';
    this.app.audio.setPaused(false);
    this.app.audio.stopRaceVoices();
    this.app.particles.reset();

    const { physics, vehicles, carVisuals } = this.app;
    physics.resetLogs();
    physics.spawnGrid(vehicles);
    // Park player car out of sight in pit bay while 5 AIs drive the live background coastal circuit
    carVisuals[0].root.visible = false;
    physics.placeCarOnSpline(vehicles[0], 25, 0);
    for (let i = 1; i < vehicles.length; i++) {
      carVisuals[i].root.visible = true;
      physics.placeCarOnSpline(vehicles[i], 40 + i * 24, (i % 2 === 0 ? -1.8 : 1.8));
      vehicles[i].vx = Math.sin(vehicles[i].yaw) * 28;
      vehicles[i].vz = Math.cos(vehicles[i].yaw) * 28;
      vehicles[i].forwardSpeed = 28;
    }
    physics.racePhase = 'racing';
    this.app.camController.mode = 'scripted';
    this.els.menu?.classList.remove('hidden');
  }

  // 2. Sunset Garage (Car rotating in warm golden-hour sunset light on Z1 coastal promenade)
  showGarage() {
    this._hideAllOverlays();
    this.screen = 'garage';
    this.app.audio.stopRaceVoices();
    this.app.particles.reset();
    this._stageGarageTurntable();
    this.els.garage?.classList.remove('hidden');
  }

  _stageGarageTurntable() {
    const { physics, vehicles, carVisuals } = this.app;
    physics.racePhase = 'menu';
    carVisuals[0].root.visible = true;
    // Place showcase car on sunlit Z1 coastal promenade overlooking beach & sea
    physics.placeCarOnSpline(vehicles[0], 145.0, 1.2);
    for (let i = 1; i < vehicles.length; i++) {
      carVisuals[i].root.visible = false;
    }
    this.app.camController.mode = 'scripted';
  }

  // 3. Race Configuration
  showConfig() {
    this._hideAllOverlays();
    this.screen = 'config';
    if (this.app.carVisuals[0] && !this.app.carVisuals[0].root.visible) {
      this._stageGarageTurntable();
    }
    this.els.config?.classList.remove('hidden');
  }

  openSettings(fromScreen = 'menu') {
    this.prevScreenForSettings = fromScreen;
    this.els.menu?.classList.add('hidden');
    this.els.pause?.classList.add('hidden');
    this.els.settings?.classList.remove('hidden');
    this.screen = 'settings';
  }

  // 4. Start Race Sequence: ~5s Grid Presentation -> 3-2-1 Countdown -> Race!
  startRaceSequence({ skipIntro = false } = {}) {
    this._hideAllOverlays();
    const { physics, vehicles, carVisuals, camController, audio, particles } = this.app;

    particles.reset();
    for (let i = 0; i < carVisuals.length; i++) {
      carVisuals[i].root.visible = true;
    }

    physics.resetLogs();
    physics.totalLaps = this.selectedLaps;
    physics.spawnGrid(vehicles);
    audio.setPaused(false);
    audio.startRaceVoices(
      vehicles[0].modelId,
      vehicles.slice(1).map(v => v.modelId)
    );

    if (this.els.hudLapsTotal) this.els.hudLapsTotal.textContent = String(this.selectedLaps);
    if (this.els.introTitle) {
      this.els.introTitle.textContent = `Circuito Costa Dourada · ${this.selectedLaps} Voltas`;
    }
    if (this.els.introSub) {
      const diffName = this.selectedDifficulty === 'easy' ? 'Fácil' : this.selectedDifficulty === 'hard' ? 'Difícil' : 'Normal';
      this.els.introSub.textContent = `6 carros no grid · IA ${diffName} · Pôr do sol seco`;
    }

    if (skipIntro) {
      this._enterCountdown();
    } else {
      this.screen = 'intro';
      physics.racePhase = 'intro';
      this.phaseTimer = this.introDurationSec;
      camController.mode = 'scripted';
      this._setGantryLight('#ff9d2e', 1.6);
      this.els.intro?.classList.remove('hidden');
    }
  }

  _enterCountdown() {
    this._hideAllOverlays();
    this.screen = 'countdown';
    this.app.physics.racePhase = 'countdown';
    this.phaseTimer = 3.0;
    this.lastCountdownDigit = null;
    this.app.camController.mode = 'chase';
    this.app.camController.snapToVehicle(this.app.playerCar);
    this.els.countdown?.classList.remove('hidden');
    this.els.hud?.classList.remove('hidden');
  }

  _enterRacing() {
    this.screen = 'racing';
    this.app.physics.racePhase = 'racing';
    this._setGantryLight('#2ef56e', 3.2);
    this.app.audio.playUiSound('go');
    if (this.els.countdownText) this.els.countdownText.textContent = 'LARGADA!';
    this.phaseTimer = 0.75; // Keep "LARGADA!" visible briefly without blocking controls
  }

  _setGantryLight(hex, intensity) {
    if (!this.gantryLightMat) return;
    this.gantryLightMat.emissive.set(hex);
    this.gantryLightMat.emissiveIntensity = intensity;
  }

  pauseRace() {
    if (this.screen !== 'racing' && this.screen !== 'countdown') return;
    this._pausedFromScreen = this.screen;
    this.screen = 'paused';
    this.app.audio.setPaused(true);
    this.els.pause?.classList.remove('hidden');
  }

  resumeRace() {
    if (this.screen !== 'paused') return;
    this.els.pause?.classList.add('hidden');
    this.screen = this._pausedFromScreen || 'racing';
    this.app.audio.setPaused(false);
  }

  restartRace({ skipIntro = true } = {}) {
    this.app.audio.setPaused(false);
    this.startRaceSequence({ skipIntro });
  }

  showResults() {
    this._hideAllOverlays();
    this.screen = 'results';
    this.app.audio.playUiSound('finish');
    // Lower engine voices cleanly into post-race cooldown & bring back menu/results music
    this.app.audio.stopRaceVoices();

    const sorted = [...this.app.vehicles].sort((a, b) => a.position - b.position);
    const pPos = this.app.playerCar.position;
    if (this.els.resultsHeadline) {
      this.els.resultsHeadline.textContent = pPos === 1
        ? '1º Lugar — Vitória na Costa Dourada!'
        : `${pPos}º Lugar — Bandeirada Final`;
    }

    if (this.els.resultsTbody) {
      this.els.resultsTbody.innerHTML = '';
      for (const car of sorted) {
        const tr = document.createElement('tr');
        if (car.isPlayer) tr.className = 'is-player';
        const modelLabel = CAR_SPECS[car.modelId]?.name || car.modelId;
        const bestTxt = formatRaceTime(car.bestLapTime, false);
        const totalTxt = formatRaceTime(car.finishTime, car.projectedFinish);
        tr.innerHTML = `
          <td>${car.position}º</td>
          <td>${car.name}</td>
          <td>#${CAR_LIVERIES[car.liveryIndex % CAR_LIVERIES.length].number} ${modelLabel}</td>
          <td>${bestTxt}</td>
          <td>${totalTxt}</td>
        `;
        this.els.resultsTbody.appendChild(tr);
      }
    }

    this.els.results?.classList.remove('hidden');
  }

  update(dt) {
    const { physics, vehicles, playerCar, camera, lighting } = this.app;

    // 1. Live Menu Camera (tracks AI #1 cruising around coastal peninsula)
    if (this.screen === 'menu' || (this.screen === 'settings' && this.prevScreenForSettings === 'menu')) {
      const leadAi = vehicles[1];
      const fx = Math.sin(leadAi.yaw);
      const fz = Math.cos(leadAi.yaw);
      const rx = -Math.cos(leadAi.yaw);
      const rz = Math.sin(leadAi.yaw);
      camera.fov = 56;
      camera.position.set(leadAi.x - fx * 9.5 + rx * 4.2, leadAi.y + 3.2, leadAi.z - fz * 9.5 + rz * 4.2);
      camera.lookAt(leadAi.x + fx * 10.0, leadAi.y + 0.9, leadAi.z + fz * 10.0);
      camera.updateProjectionMatrix();
      lighting.update(new THREE.Vector3(leadAi.x, leadAi.y, leadAi.z), 95, 'scripted');
      return;
    }

    // 2. Sunset Garage Turntable Camera (smooth 360° orbit in warm sunset light)
    if (this.screen === 'garage' || this.screen === 'config') {
      this.garageOrbitAngle += dt * 0.42;
      const rad = 4.65;
      const baseG = playerCar.y - playerCar.spec.wheelRadius - 0.16;
      camera.fov = 45;
      camera.position.set(
        playerCar.x + Math.cos(this.garageOrbitAngle) * rad,
        baseG + 1.18,
        playerCar.z + Math.sin(this.garageOrbitAngle) * rad
      );
      camera.lookAt(playerCar.x, baseG + 0.62, playerCar.z);
      camera.updateProjectionMatrix();
      lighting.update(new THREE.Vector3(playerCar.x, baseG, playerCar.z), 0, 'scripted');
      return;
    }

    // 3. ~5s Grid Presentation Sweep
    if (this.screen === 'intro') {
      this.phaseTimer -= dt;
      const u = 1.0 - Math.max(0, this.phaseTimer / this.introDurationSec); // 0 -> 1
      const spline = this.app.world.spline;
      const L = spline.totalLength;
      const camS = spline.wrapS(L - 4.0 - u * 34.0);
      const lookS = spline.wrapS(L - 22.0);
      const camPt = spline.roadPoint(camS, 4.4 - u * 1.6, 1.45 + u * 0.65);
      const lookPt = spline.roadPoint(lookS, -0.4, 0.85);
      camera.fov = 52;
      camera.position.set(camPt.x, camPt.y, camPt.z);
      camera.lookAt(lookPt.x, lookPt.y, lookPt.z);
      camera.updateProjectionMatrix();
      lighting.update(new THREE.Vector3(lookPt.x, lookPt.y, lookPt.z), 0, 'scripted');

      if (this.phaseTimer <= 0) {
        this._enterCountdown();
      }
      return;
    }

    // 4. 3-2-1 Countdown
    if (this.screen === 'countdown') {
      this.phaseTimer -= dt;
      const digit = Math.max(1, Math.ceil(this.phaseTimer));
      if (digit !== this.lastCountdownDigit && this.phaseTimer > 0) {
        this.lastCountdownDigit = digit;
        if (this.els.countdownText) this.els.countdownText.textContent = String(digit);
        this._setGantryLight('#ff3b24', 2.8);
        this.app.audio.playUiSound('countdown');
      }
      this._updateHudDom();
      if (this.phaseTimer <= 0) {
        this._enterRacing();
      }
      return;
    }

    // 5. Active Race -> HUD + Finish Check
    if (this.screen === 'racing') {
      if (this.phaseTimer > 0) {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.els.countdown?.classList.add('hidden');
        }
      }
      this._updateHudDom();

      if (physics.racePhase === 'finished') {
        this.showResults();
      }
    }
  }

  _updateHudDom() {
    const { playerCar, vehicles, camController, world } = this.app;
    const e = this.els;
    if (e.hudPos) e.hudPos.textContent = String(playerCar.position);
    if (e.hudLap) e.hudLap.textContent = String(Math.min(this.selectedLaps, playerCar.lap));
    if (e.hudLapsTotal) e.hudLapsTotal.textContent = String(this.selectedLaps);
    if (e.hudTimeCur) e.hudTimeCur.textContent = formatRaceTime(playerCar.currentLapTime, false);
    if (e.hudTimeBest) e.hudTimeBest.textContent = formatRaceTime(playerCar.bestLapTime, false);
    if (e.hudSpeed) e.hudSpeed.textContent = String(Math.round(playerCar.speedKmh));
    if (e.hudGear) e.hudGear.textContent = playerCar.forwardSpeed < -1.2 ? 'R' : String(playerCar.gear);

    const rpmPct = Math.max(8, Math.min(100, (playerCar.rpm / playerCar.spec.redlineRpm) * 100));
    if (e.hudRpmFill) e.hudRpmFill.style.width = `${rpmPct.toFixed(1)}%`;
    if (e.hudRpmText) e.hudRpmText.textContent = `${Math.round(playerCar.rpm)} RPM`;
    if (e.hudCamLabel) e.hudCamLabel.textContent = camController.mode === 'hood' ? 'CAPÔ' : 'PERSEGUIÇÃO';

    // Wrong-way check
    if (e.hudWrongWay) {
      const smp = world.spline.sampleAt(playerCar.s);
      const dotFwd = Math.sin(playerCar.yaw) * smp.fxz_x + Math.cos(playerCar.yaw) * smp.fxz_z;
      const wrongWay = playerCar.speedKmh > 18 && dotFwd < -0.35;
      e.hudWrongWay.classList.toggle('hidden', !wrongWay);
    }

    this._drawMinimap(vehicles);
  }

  _drawMinimap(vehicles) {
    const ctx = this.minimapCtx;
    if (!ctx || !this.mapTransform) return;
    const { toX, toY } = this.mapTransform;
    const samples = this.app.world.spline.samples;

    ctx.clearRect(0, 0, 220, 220);

    // Track dark halo + crisp warm asphalt ribbon
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < samples.length; i += 6) {
      const x = toX(samples[i].x);
      const y = toY(samples[i].z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(8, 12, 18, 0.85)';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(232, 220, 198, 0.55)';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Start/Finish gold tick at s = 0
    const s0 = samples[0];
    const sx = toX(s0.x), sy = toY(s0.z);
    ctx.strokeStyle = '#ffd07b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - s0.rxz_x * 8, sy - s0.rxz_z * 8);
    ctx.lineTo(sx + s0.rxz_x * 8, sy + s0.rxz_z * 8);
    ctx.stroke();

    // 5 AI markers
    for (let i = 1; i < vehicles.length; i++) {
      const c = vehicles[i];
      const cx = toX(c.x);
      const cy = toY(c.z);
      ctx.fillStyle = CAR_LIVERIES[c.liveryIndex % CAR_LIVERIES.length].primary;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Player highlighted directional chevron marker on top
    const p = vehicles[0];
    const px = toX(p.x);
    const py = toY(p.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(p.yaw), -Math.cos(p.yaw)));
    ctx.fillStyle = '#ffd07b';
    ctx.strokeStyle = '#0f141c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.8, 5.8);
    ctx.lineTo(0, 3.2);
    ctx.lineTo(-5.8, 5.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
