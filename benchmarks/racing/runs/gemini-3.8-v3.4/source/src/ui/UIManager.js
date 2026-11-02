// src/ui/UIManager.js
// Handles all screen flows, HUD, Minimap, Garage, Options, Pause, and Results.

import { LIVERIES } from '../models/CarModelBuilder.js';

export class UIManager {
  constructor(gameApp) {
    this.game = gameApp;
    this.currentScreen = 'menu'; // 'menu', 'garage', 'settings', 'countdown', 'race', 'pause', 'results'

    this.dom = {
      menuScreen: document.getElementById('screen-menu'),
      garageScreen: document.getElementById('screen-garage'),
      hud: document.getElementById('screen-hud'),
      pauseMenu: document.getElementById('screen-pause'),
      resultsScreen: document.getElementById('screen-results'),
      countdownOverlay: document.getElementById('countdown-overlay'),

      // HUD elements
      hudPosition: document.getElementById('hud-pos-val'),
      hudLap: document.getElementById('hud-lap-val'),
      hudCurrentTime: document.getElementById('hud-cur-time'),
      hudBestTime: document.getElementById('hud-best-time'),
      hudSpeed: document.getElementById('hud-speed-num'),
      hudGear: document.getElementById('hud-gear-val'),
      hudRpmBar: document.getElementById('hud-rpm-fill'),
      hudNotification: document.getElementById('hud-notification'),
      minimapCanvas: document.getElementById('minimap-canvas'),

      // Garage elements
      carName: document.getElementById('garage-car-name'),
      liveryList: document.getElementById('garage-liveries'),

      // Results
      resultsList: document.getElementById('results-standings-list')
    };

    this.minimapCtx = this.dom.minimapCanvas ? this.dom.minimapCanvas.getContext('2d') : null;
    this.bindEvents();
  }

  bindEvents() {
    // Menu buttons
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.onclick = () => {
        this.game.audio.init();
        this.game.audio.playUIClick();
        this.showScreen('garage');
      };
    }

    // Garage buttons
    const btnPrevCar = document.getElementById('btn-prev-car');
    const btnNextCar = document.getElementById('btn-next-car');
    if (btnPrevCar) btnPrevCar.onclick = () => this.game.cycleSelectedCar(-1);
    if (btnNextCar) btnNextCar.onclick = () => this.game.cycleSelectedCar(1);

    const btnStartRace = document.getElementById('btn-start-race');
    if (btnStartRace) {
      btnStartRace.onclick = () => {
        this.game.audio.playUIClick();
        this.game.startRace();
      };
    }

    const btnBackToMenu = document.getElementById('btn-back-menu');
    if (btnBackToMenu) {
      btnBackToMenu.onclick = () => {
        this.game.audio.playUIClick();
        this.showScreen('menu');
      };
    }

    // Setup options: Laps, Difficulty, Quality
    const lapButtons = document.querySelectorAll('.lap-opt');
    lapButtons.forEach(btn => {
      btn.onclick = () => {
        lapButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.game.setLaps(parseInt(btn.dataset.laps, 10));
      };
    });

    const diffButtons = document.querySelectorAll('.diff-opt');
    diffButtons.forEach(btn => {
      btn.onclick = () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.game.setDifficulty(btn.dataset.diff);
      };
    });

    const qualButtons = document.querySelectorAll('.qual-opt');
    qualButtons.forEach(btn => {
      btn.onclick = () => {
        qualButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.game.setQualityPreset(btn.dataset.qual);
      };
    });

    // Pause buttons
    const btnResume = document.getElementById('btn-pause-resume');
    if (btnResume) btnResume.onclick = () => this.game.togglePause();

    const btnRestart = document.getElementById('btn-pause-restart');
    if (btnRestart) btnRestart.onclick = () => this.game.restartRace();

    const btnExitRace = document.getElementById('btn-pause-exit');
    if (btnExitRace) btnExitRace.onclick = () => this.game.exitToMenu();

    // Results buttons
    const btnRaceAgain = document.getElementById('btn-race-again');
    if (btnRaceAgain) btnRaceAgain.onclick = () => this.game.restartRace();

    const btnResultsMenu = document.getElementById('btn-results-menu');
    if (btnResultsMenu) btnResultsMenu.onclick = () => this.game.exitToMenu();

    // Sound Sliders
    const sliderMaster = document.getElementById('vol-master');
    if (sliderMaster) {
      sliderMaster.oninput = (e) => {
        this.game.audio.masterGain.gain.value = parseFloat(e.target.value);
      };
    }
  }

  showScreen(name) {
    this.currentScreen = name;
    const screens = [
      this.dom.menuScreen,
      this.dom.garageScreen,
      this.dom.hud,
      this.dom.pauseMenu,
      this.dom.resultsScreen,
      this.dom.countdownOverlay
    ];

    screens.forEach(s => {
      if (s) s.style.display = 'none';
    });

    if (name === 'menu' && this.dom.menuScreen) {
      this.dom.menuScreen.style.display = 'flex';
    } else if (name === 'garage' && this.dom.garageScreen) {
      this.dom.garageScreen.style.display = 'flex';
      this.updateGarageUI();
    } else if (name === 'race') {
      if (this.dom.hud) this.dom.hud.style.display = 'block';
    } else if (name === 'pause' && this.dom.pauseMenu) {
      if (this.dom.hud) this.dom.hud.style.display = 'block';
      this.dom.pauseMenu.style.display = 'flex';
    } else if (name === 'results' && this.dom.resultsScreen) {
      this.dom.resultsScreen.style.display = 'flex';
    }
  }

  updateGarageUI() {
    const selCar = this.game.selectedCarType;
    if (this.dom.carName) {
      this.dom.carName.textContent = (selCar === 'gt_coupe') ? 'VELOCE GT-8 COUPE' : 'STRADA R-TURBO HATCH';
    }

    if (this.dom.liveryList) {
      this.dom.liveryList.innerHTML = '';
      LIVERIES.forEach((liv, idx) => {
        const btn = document.createElement('div');
        btn.className = `livery-swatch ${idx === this.game.selectedLiveryIndex ? 'active' : ''}`;
        btn.style.backgroundColor = `#${liv.color.toString(16).padStart(6, '0')}`;
        btn.title = `#${liv.number} - ${liv.name}`;
        btn.onclick = () => {
          this.game.selectLivery(idx);
          this.updateGarageUI();
        };
        this.dom.liveryList.appendChild(btn);
      });
    }
  }

  showCountdown(numberOrText) {
    if (!this.dom.countdownOverlay) return;
    this.dom.countdownOverlay.style.display = 'flex';
    this.dom.countdownOverlay.textContent = numberOrText;
    this.dom.countdownOverlay.className = `countdown-anim ${numberOrText === 'GO!' ? 'go' : ''}`;

    if (numberOrText === '') {
      this.dom.countdownOverlay.style.display = 'none';
    }
  }

  showNotification(msg, duration = 2.5) {
    if (!this.dom.hudNotification) return;
    this.dom.hudNotification.textContent = msg;
    this.dom.hudNotification.style.opacity = '1';
    setTimeout(() => {
      if (this.dom.hudNotification) this.dom.hudNotification.style.opacity = '0';
    }, duration * 1000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  updateHUD(raceState) {
    if (this.currentScreen !== 'race' && this.currentScreen !== 'pause') return;

    if (this.dom.hudPosition) {
      const suffix = ['ST', 'ND', 'RD', 'TH', 'TH', 'TH'][raceState.position - 1] || 'TH';
      this.dom.hudPosition.innerHTML = `<span>${raceState.position}</span><small>${suffix}</small> / 6`;
    }

    if (this.dom.hudLap) {
      this.dom.hudLap.textContent = `${Math.min(raceState.lap, raceState.totalLaps)} / ${raceState.totalLaps}`;
    }

    if (this.dom.hudCurrentTime) {
      this.dom.hudCurrentTime.textContent = this.formatTime(raceState.currentLapTime);
    }

    if (this.dom.hudBestTime) {
      this.dom.hudBestTime.textContent = raceState.bestLapTime > 0 ? this.formatTime(raceState.bestLapTime) : '--:--.---';
    }

    if (this.dom.hudSpeed) {
      this.dom.hudSpeed.textContent = Math.round(raceState.speedKmh);
    }

    if (this.dom.hudGear) {
      this.dom.hudGear.textContent = raceState.speedKmh < 1.0 && raceState.brake > 0 ? 'R' : raceState.gear;
    }

    if (this.dom.hudRpmBar) {
      const pct = Math.min(100, Math.max(0, ((raceState.rpm - 850) / (7500 - 850)) * 100));
      this.dom.hudRpmBar.style.width = `${pct}%`;
      this.dom.hudRpmBar.style.backgroundColor = (pct > 90) ? '#ff2a2a' : (pct > 75 ? '#ffaa00' : '#00e5ff');
    }

    // Draw Minimap
    this.drawMinimap(raceState.vehicles, raceState.trackPoints);
  }

  drawMinimap(vehicles, trackPoints) {
    if (!this.minimapCtx || !trackPoints || trackPoints.length === 0) return;
    const ctx = this.minimapCtx;
    const w = this.dom.minimapCanvas.width;
    const h = this.dom.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Track bounds: X: -1050 to 550, Z: -500 to 450
    const minX = -950, maxX = 450;
    const minZ = -450, maxZ = 350;

    const toMapX = (x) => 15 + ((x - minX) / (maxX - minX)) * (w - 30);
    const toMapY = (z) => 15 + ((z - minZ) / (maxZ - minZ)) * (h - 30);

    // Draw Track Line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';

    for (let i = 0; i < trackPoints.length; i += 4) {
      const p = trackPoints[i];
      const mx = toMapX(p.x);
      const my = toMapY(p.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw Finish Line marker
    const pStart = trackPoints[0];
    ctx.fillStyle = '#ffbb00';
    ctx.beginPath();
    ctx.arc(toMapX(pStart.x), toMapY(pStart.z), 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw Vehicles
    for (const v of vehicles) {
      const mx = toMapX(v.position.x);
      const my = toMapY(v.position.z);

      ctx.beginPath();
      if (v.isPlayer) {
        ctx.fillStyle = '#00f0ff';
        ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = '#ff3344';
        ctx.arc(mx, my, 3.8, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  showResults(standings) {
    this.showScreen('results');
    if (!this.dom.resultsList) return;

    this.dom.resultsList.innerHTML = '';
    standings.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = `results-row ${entry.isPlayer ? 'player-row' : ''}`;
      
      const timeStr = entry.finished 
        ? this.formatTime(entry.totalTime) 
        : `≈ ${this.formatTime(entry.projectedTime)}`;

      row.innerHTML = `
        <span class="res-pos">${idx + 1}</span>
        <span class="res-name">${entry.name}</span>
        <span class="res-car">${entry.car}</span>
        <span class="res-best">${entry.bestLap > 0 ? this.formatTime(entry.bestLap) : '--:--.---'}</span>
        <span class="res-total">${timeStr}</span>
      `;
      this.dom.resultsList.appendChild(row);
    });
  }
}
