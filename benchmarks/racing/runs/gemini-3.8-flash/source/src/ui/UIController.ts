/**
 * UIController.ts
 * Manages all HTML/DOM screens, user interactions, menus, race HUD,
 * replay controls, 5-slot replay library, settings, key rebinding,
 * and the Signature Feature Photo Studio interface.
 */

import { StorageManager, ReplayMetadata, ReplayPayload } from '../core/StorageManager';
import { InputManager, KeyBindings } from '../core/InputManager';
import { AudioManager } from '../core/AudioManager';
import { GraphicsRenderer, GraphicsQuality } from '../graphics/Renderer';
import { CAR_CONFIGS, CarConfig } from '../gameplay/CarConfigs';
import { TRACK_METADATA } from '../world/TrackConfigs';
import { GameMode, RaceManager } from '../gameplay/RaceManager';
import { AIDifficulty } from '../gameplay/AICarController';
import { ReplayPlayer } from '../gameplay/ReplayPlayer';
import { PhotoStudio } from '../graphics/PhotoStudio';

export type ScreenId =
  | 'menu'
  | 'garage'
  | 'setup'
  | 'hud'
  | 'pause'
  | 'results'
  | 'replay-hud'
  | 'replays'
  | 'settings'
  | 'photo';

export class UIController {
  private container: HTMLElement;
  private storage: StorageManager;
  private input: InputManager;
  private audio: AudioManager;
  private renderer: GraphicsRenderer;
  private photoStudio: PhotoStudio;

  // Selected pre-race configuration
  public selectedCarId = 'riviera_spyder';
  public selectedMode: GameMode = 'time_trial';
  public selectedTrackId = 'coastal_sprint';
  public selectedWeather: 'sunny' | 'cloudy' | 'rainy' = 'sunny';
  public selectedTimeOfDay: 'morning' | 'daytime' | 'sunset' | 'night' = 'daytime';
  public selectedDifficulty: AIDifficulty = 'normal';

  // Navigation Callbacks to Main Engine
  public onStartRace: () => void = () => {};
  public onRestartRace: () => void = () => {};
  public onResumeRace: () => void = () => {};
  public onRetireRace: () => void = () => {};
  public onEnterReplay: (payload: ReplayPayload) => void = () => {};
  public onExitReplay: () => void = () => {};
  public onOpenPhotoStudio: () => void = () => {};
  public onClosePhotoStudio: () => void = () => {};
  public onSelectCarPreview: (carId: string) => void = () => {};

  // Replay slot replacement modal state
  private pendingReplayPayload: ReplayPayload | null = null;

  // Key rebinding state
  private rebindingAction: keyof KeyBindings | null = null;

  // Transient completed replay (available after race finish without consuming slot)
  public transientReplayPayload: ReplayPayload | null = null;

  constructor(
    container: HTMLElement,
    storage: StorageManager,
    input: InputManager,
    audio: AudioManager,
    renderer: GraphicsRenderer,
    photoStudio: PhotoStudio
  ) {
    this.container = container;
    this.storage = storage;
    this.input = input;
    this.audio = audio;
    this.renderer = renderer;
    this.photoStudio = photoStudio;

    this.renderDOM();
    this.bindEvents();
    this.showScreen('menu');
  }

  public showScreen(screenId: ScreenId): void {
    const views = this.container.querySelectorAll('.ui-view');
    views.forEach((v) => v.classList.remove('active'));

    const target = this.container.querySelector(`#view-${screenId}`);
    if (target) {
      target.classList.add('active');
    }

    // Toggle Input Capture: active driving HUD captures input, menus release focus
    this.input.setCapturing(screenId === 'hud');

    if (screenId === 'replays') {
      this.refreshReplayLibraryList();
    } else if (screenId === 'settings') {
      this.refreshSettingsForm();
    } else if (screenId === 'garage') {
      this.refreshGarageSelection();
    }
  }

  private renderDOM(): void {
    this.container.innerHTML = `
      <!-- VIEW: MAIN MENU -->
      <div id="view-menu" class="ui-view">
        <div class="glass-panel menu-card">
          <h1 class="game-logo">Riviera</h1>
          <p>Cinematic Coastal 3D Arcade Racer</p>
          <div style="height: 12px;"></div>
          <button id="btn-menu-play" class="btn-primary">Race Now</button>
          <button id="btn-menu-garage" class="btn-secondary">The Garage</button>
          <button id="btn-menu-replays" class="btn-secondary">Replay Vault</button>
          <button id="btn-menu-settings" class="btn-secondary">Settings & Keys</button>
        </div>
      </div>

      <!-- VIEW: GARAGE -->
      <div id="view-garage" class="ui-view">
        <div class="glass-panel garage-sidebar">
          <h2>Vehicle Garage</h2>
          <div class="car-selector-tabs" id="garage-car-tabs"></div>
          <div id="garage-car-desc" style="margin-top: 10px;"></div>
          <div id="garage-car-stats"></div>
          <div style="display: flex; gap: 10px; margin-top: 16px;">
            <button id="btn-garage-select" class="btn-primary" style="flex: 1;">Select Car</button>
            <button id="btn-garage-back" class="btn-secondary">Back</button>
          </div>
        </div>
      </div>

      <!-- VIEW: PRE-RACE SETUP -->
      <div id="view-setup" class="ui-view">
        <div class="glass-panel setup-card">
          <h2>Race Configuration</h2>

          <div>
            <h3>1. Select Game Mode</h3>
            <div class="options-grid" id="setup-modes-grid">
              <div class="option-box selected" data-mode="time_trial" data-track="coastal_sprint">
                <div class="option-title">Time Trial</div>
                <div class="option-sub">Coastal Sprint (3 Laps)</div>
              </div>
              <div class="option-box" data-mode="race" data-track="riviera_gp">
                <div class="option-title">Race vs AI</div>
                <div class="option-sub">Riviera GP (6 Cars, 3 Laps)</div>
              </div>
              <div class="option-box" data-mode="checkpoint" data-track="horizon_rush">
                <div class="option-title">Checkpoint Run</div>
                <div class="option-sub">Horizon Rush (Combos & Clock)</div>
              </div>
            </div>
          </div>

          <div id="setup-difficulty-section" style="display: none;">
            <h3>AI Rival Difficulty</h3>
            <div class="options-grid">
              <div class="option-box" data-diff="easy">
                <div class="option-title">Easy</div>
                <div class="option-sub">Early braking, relaxed line</div>
              </div>
              <div class="option-box selected" data-diff="normal">
                <div class="option-title">Normal</div>
                <div class="option-sub">Competitive, balanced pacing</div>
              </div>
              <div class="option-box" data-diff="hard">
                <div class="option-title">Hard</div>
                <div class="option-sub">Late braking, maximum attack</div>
              </div>
            </div>
          </div>

          <div>
            <h3>2. Dynamic Conditions</h3>
            <div style="display: flex; gap: 12px;">
              <div style="flex: 1;">
                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">INITIAL WEATHER</label>
                <select id="setup-weather-select" class="photo-select" style="width: 100%; margin-top: 4px;">
                  <option value="sunny">Sunny (Clear / Maximum Grip)</option>
                  <option value="cloudy">Cloudy (Overcast)</option>
                  <option value="rainy">Rainy (Wet Asphalt / Long Drifts)</option>
                </select>
              </div>
              <div style="flex: 1;">
                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">TIME OF DAY</label>
                <select id="setup-time-select" class="photo-select" style="width: 100%; margin-top: 4px;">
                  <option value="morning">Morning (Golden Sunrise)</option>
                  <option value="daytime" selected>Daytime (Mediterranean Sun)</option>
                  <option value="sunset">Sunset (Vibrant Amber)</option>
                  <option value="night">Night (Moonlit Coast)</option>
                </select>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
            <button id="btn-setup-back" class="btn-secondary">Back to Menu</button>
            <button id="btn-setup-start" class="btn-primary">Launch Race</button>
          </div>
        </div>
      </div>

      <!-- VIEW: ACTIVE RACE HUD -->
      <div id="view-hud" class="ui-view">
        <div class="hud-top-bar">
          <div class="hud-badge" id="hud-mode-info">TIME TRIAL - LAP 1 / 3</div>
          <div class="hud-badge" id="hud-timer-info">00:00.000</div>
          <div class="hud-badge" id="hud-pos-info" style="display: none;">POS: 1 / 6</div>
        </div>

        <div id="hud-center-countdown" class="hud-center-countdown" style="display: none;">3</div>

        <div class="hud-bottom-bar">
          <div>
            <div id="hud-drift-banner" style="font-size: 20px; font-weight: 800; color: var(--sunset-orange); margin-bottom: 4px; display: none;">DRIFT +0</div>
            <div id="hud-lap-valid-banner" style="font-size: 14px; font-weight: 800; color: var(--racing-red); display: none;">⚠ LAP INVALIDATED</div>
            <div class="nitro-gauge">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: var(--vibrant-cyan);">
                <span>NITRO BOOST</span>
                <span id="hud-nitro-val">100%</span>
              </div>
              <div class="nitro-bar-bg">
                <div id="hud-nitro-fill" class="nitro-bar-fill" style="width: 100%;"></div>
              </div>
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
              [WASD/Arrows] Drive &bull; [Space] Drift &bull; [Shift] Nitro &bull; [R] Recover &bull; [Esc] Pause
            </div>
          </div>

          <div class="speedometer-container">
            <div class="speed-digital" id="hud-speed-val">0</div>
            <div class="speed-unit">KM / H</div>
          </div>
        </div>
      </div>

      <!-- VIEW: PAUSE MENU -->
      <div id="view-pause" class="ui-view">
        <div class="glass-panel modal-card" style="width: 380px; text-align: center;">
          <h2>Race Paused</h2>
          <button id="btn-pause-resume" class="btn-primary">Resume Racing</button>
          <button id="btn-pause-photo" class="btn-secondary" style="border-color: var(--sunset-orange);">📷 Photo Studio (Signature Feature)</button>
          <button id="btn-pause-restart" class="btn-secondary">Restart Race</button>
          <button id="btn-pause-settings" class="btn-secondary">Settings & Keys</button>
          <button id="btn-pause-retire" class="btn-danger">Retire / Return to Menu</button>
        </div>
      </div>

      <!-- VIEW: RESULTS SCREEN -->
      <div id="view-results" class="ui-view">
        <div class="glass-panel modal-card">
          <h2 id="results-title">Race Complete</h2>
          <p id="results-subtitle">Review your session results below.</p>
          <div id="results-body"></div>
          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button id="btn-results-watch-replay" class="btn-primary">Watch Replay</button>
            <button id="btn-results-save-replay" class="btn-secondary">Save Replay</button>
            <button id="btn-results-restart" class="btn-secondary">Restart</button>
            <button id="btn-results-menu" class="btn-secondary">Main Menu</button>
          </div>
        </div>
      </div>

      <!-- VIEW: REPLAY HUD -->
      <div id="view-replay-hud" class="ui-view">
        <div class="hud-top-bar">
          <div class="hud-badge" id="replay-hud-badge">REPLAY VIEWER &bull; CHASE CAM</div>
          <div class="hud-badge" id="replay-hud-time">00:00 / 00:00</div>
        </div>

        <div class="glass-panel replay-controls-card">
          <div class="timeline-row">
            <span id="replay-time-current" style="font-size: 13px; font-weight: 700; min-width: 50px;">00:00</span>
            <input type="range" id="replay-timeline-slider" class="timeline-slider" min="0" max="1000" value="0">
            <span id="replay-time-total" style="font-size: 13px; font-weight: 700; min-width: 50px;">00:00</span>
          </div>

          <div class="replay-buttons-row">
            <div style="display: flex; gap: 8px;">
              <button id="btn-replay-play" class="btn-secondary" style="padding: 8px 16px;">Pause</button>
              <button id="btn-replay-speed" class="btn-secondary" style="padding: 8px 14px;">1.0x</button>
              <button id="btn-replay-cam" class="btn-secondary" style="padding: 8px 16px;">Cam: Chase</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="btn-replay-photo" class="btn-secondary" style="padding: 8px 16px; border-color: var(--sunset-orange);">📷 Photo Studio</button>
              <button id="btn-replay-save" class="btn-secondary" style="padding: 8px 16px;">Save to Vault</button>
              <button id="btn-replay-export" class="btn-secondary" style="padding: 8px 16px;">Export .racingreplay</button>
              <button id="btn-replay-exit" class="btn-danger" style="padding: 8px 16px;">Exit Replay</button>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW: REPLAY VAULT (5-SLOT LIBRARY) -->
      <div id="view-replays" class="ui-view">
        <div class="glass-panel modal-card" style="width: 720px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2>Replay Vault</h2>
            <div id="replay-capacity-badge" class="hud-badge" style="font-size: 14px; padding: 6px 14px;">0 / 5 Slots Used</div>
          </div>
          <p>Local replay library (max 5 slots). Export and import portable <code>.racingreplay</code> files without cloud accounts.</p>

          <div id="replay-vault-list" style="margin-top: 10px;"></div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
            <div>
              <input type="file" id="replay-file-input" accept=".racingreplay,.json" style="display: none;">
              <button id="btn-vault-import" class="btn-secondary">Import Replay File</button>
            </div>
            <button id="btn-vault-back" class="btn-primary">Back to Menu</button>
          </div>
        </div>
      </div>

      <!-- VIEW: SETTINGS & KEY BINDINGS -->
      <div id="view-settings" class="ui-view">
        <div class="glass-panel modal-card" style="width: 640px;">
          <h2>Settings & Key Bindings</h2>

          <div>
            <h3>Graphics Quality Preset</h3>
            <div class="options-grid">
              <div class="option-box" data-quality="low">
                <div class="option-title">Low</div>
                <div class="option-sub">0.75x DPR, No Shadows</div>
              </div>
              <div class="option-box" data-quality="medium">
                <div class="option-title">Medium</div>
                <div class="option-sub">1.0x DPR, Standard Shadows</div>
              </div>
              <div class="option-box selected" data-quality="high">
                <div class="option-title">High</div>
                <div class="option-sub">Native DPR, Soft Shadows, Full FX</div>
              </div>
            </div>
          </div>

          <div>
            <h3>Audio & Motion Comfort</h3>
            <div style="display: flex; gap: 20px; align-items: center; margin-top: 8px;">
              <div style="flex: 1;">
                <label style="font-size: 12px; color: var(--text-muted); font-weight: 700;">MASTER VOLUME</label>
                <input type="range" id="settings-volume" min="0" max="100" value="80" style="width: 100%; accent-color: var(--vibrant-cyan);">
              </div>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
                <input type="checkbox" id="settings-mute"> Mute Audio
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
                <input type="checkbox" id="settings-reduced-motion"> Reduced Motion
              </label>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>Driving Keyboard Controls</h3>
              <button id="btn-settings-reset-keys" class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Reset Defaults</button>
            </div>
            <div id="settings-key-conflict-msg" style="color: var(--racing-red); font-size: 13px; font-weight: 700; margin-bottom: 6px; display: none;"></div>
            <table class="data-table" id="settings-bindings-table">
              <tbody></tbody>
            </table>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
            <button id="btn-settings-back" class="btn-primary">Save & Return</button>
          </div>
        </div>
      </div>

      <!-- VIEW: PHOTO STUDIO (SIGNATURE FEATURE) -->
      <div id="view-photo" class="ui-view">
        <div class="glass-panel photo-studio-card" id="photo-studio-panel">
          <h2>Riviera Photo Studio</h2>
          <p>Cinematic drone camera & coastal postcard studio.</p>

          <div class="photo-control-row">
            <label><span>Lens FOV (Zoom)</span><span id="photo-val-fov">50°</span></label>
            <input type="range" id="photo-fov" min="25" max="85" value="50">
          </div>

          <div class="photo-control-row">
            <label><span>Orbit Azimuth</span><span id="photo-val-azimuth">45°</span></label>
            <input type="range" id="photo-azimuth" min="0" max="360" value="45">
          </div>

          <div class="photo-control-row">
            <label><span>Distance</span><span id="photo-val-dist">7.5m</span></label>
            <input type="range" id="photo-dist" min="3" max="22" step="0.5" value="7.5">
          </div>

          <div class="photo-control-row">
            <label><span>Camera Height</span><span id="photo-val-height">1.8m</span></label>
            <input type="range" id="photo-height" min="-0.5" max="8" step="0.2" value="1.8">
          </div>

          <div class="photo-control-row">
            <label><span>Camera Roll / Dutch Tilt</span><span id="photo-val-roll">0°</span></label>
            <input type="range" id="photo-roll" min="-30" max="30" value="0">
          </div>

          <div class="photo-control-row">
            <label><span>Color Grading Filter</span></label>
            <select id="photo-filter-select" class="photo-select">
              <option value="golden_hour">Golden Hour (Warm Amber Coastal Glow)</option>
              <option value="riviera_80s">Retro Riviera 80s (Synthwave / Magenta)</option>
              <option value="cyber_coastal">Cyber Coastal (Electric Cyan)</option>
              <option value="vivid_tropical">Vivid Tropical (Azure & Emerald)</option>
              <option value="monochrome">Monochrome Noir</option>
              <option value="none">None (Clean Natural)</option>
            </select>
          </div>

          <div class="photo-control-row">
            <label><span>Postcard Stamp</span></label>
            <select id="photo-stamp-select" class="photo-select">
              <option value="riviera_gp">Riviera Grand Prix // Côte d'Azur</option>
              <option value="coastal_apex">Coastal Sprint // Apex Special</option>
              <option value="horizon_rush">Horizon Rush // Hillclimb Pass</option>
              <option value="none">None (Pristine Frame)</option>
            </select>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button id="btn-photo-capture" class="btn-primary" style="flex: 1;">📷 Capture Postcard PNG</button>
            <button id="btn-photo-close" class="btn-secondary">Exit Studio</button>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 4px;">
            Press [H] to toggle UI overlay for clean framing
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Main Menu Navigation
    this.container.querySelector('#btn-menu-play')?.addEventListener('click', () => {
      this.audio.init();
      this.showScreen('setup');
    });
    this.container.querySelector('#btn-menu-garage')?.addEventListener('click', () => {
      this.audio.init();
      this.showScreen('garage');
    });
    this.container.querySelector('#btn-menu-replays')?.addEventListener('click', () => {
      this.audio.init();
      this.showScreen('replays');
    });
    this.container.querySelector('#btn-menu-settings')?.addEventListener('click', () => {
      this.audio.init();
      this.showScreen('settings');
    });

    // Garage View Events
    this.container.querySelector('#btn-garage-back')?.addEventListener('click', () => {
      this.showScreen('menu');
    });
    this.container.querySelector('#btn-garage-select')?.addEventListener('click', () => {
      this.showScreen('setup');
    });

    // Mode Select Options
    const modeBoxes = this.container.querySelectorAll('#setup-modes-grid .option-box');
    modeBoxes.forEach((box) => {
      box.addEventListener('click', () => {
        modeBoxes.forEach((b) => b.classList.remove('selected'));
        box.classList.add('selected');

        const mode = box.getAttribute('data-mode') as GameMode;
        const track = box.getAttribute('data-track') || 'coastal_sprint';
        this.selectedMode = mode;
        this.selectedTrackId = track;

        // Show/hide difficulty section for race vs AI
        const diffSec = this.container.querySelector('#setup-difficulty-section') as HTMLElement;
        if (diffSec) {
          diffSec.style.display = mode === 'race' ? 'block' : 'none';
        }
      });
    });

    // Difficulty Options
    const diffBoxes = this.container.querySelectorAll('#setup-difficulty-section .option-box');
    diffBoxes.forEach((box) => {
      box.addEventListener('click', () => {
        diffBoxes.forEach((b) => b.classList.remove('selected'));
        box.classList.add('selected');
        this.selectedDifficulty = (box.getAttribute('data-diff') as AIDifficulty) || 'normal';
      });
    });

    // Setup Weather & Time
    const weatherSelect = this.container.querySelector('#setup-weather-select') as HTMLSelectElement;
    weatherSelect?.addEventListener('change', () => {
      this.selectedWeather = weatherSelect.value as any;
    });

    const timeSelect = this.container.querySelector('#setup-time-select') as HTMLSelectElement;
    timeSelect?.addEventListener('change', () => {
      this.selectedTimeOfDay = timeSelect.value as any;
    });

    // Launch Race
    this.container.querySelector('#btn-setup-start')?.addEventListener('click', () => {
      this.audio.init();
      this.onStartRace();
      this.showScreen('hud');
    });
    this.container.querySelector('#btn-setup-back')?.addEventListener('click', () => {
      this.showScreen('menu');
    });

    // Pause Menu Events
    this.container.querySelector('#btn-pause-resume')?.addEventListener('click', () => {
      this.onResumeRace();
      this.showScreen('hud');
    });
    this.container.querySelector('#btn-pause-restart')?.addEventListener('click', () => {
      this.onRestartRace();
      this.showScreen('hud');
    });
    this.container.querySelector('#btn-pause-photo')?.addEventListener('click', () => {
      this.onOpenPhotoStudio();
      this.showScreen('photo');
    });
    this.container.querySelector('#btn-pause-settings')?.addEventListener('click', () => {
      this.showScreen('settings');
    });
    this.container.querySelector('#btn-pause-retire')?.addEventListener('click', () => {
      this.onRetireRace();
    });

    // Results Screen Events
    this.container.querySelector('#btn-results-watch-replay')?.addEventListener('click', () => {
      if (this.transientReplayPayload) {
        this.onEnterReplay(this.transientReplayPayload);
        this.showScreen('replay-hud');
      }
    });
    this.container.querySelector('#btn-results-save-replay')?.addEventListener('click', async () => {
      if (this.transientReplayPayload) {
        const res = await this.storage.saveReplay(this.transientReplayPayload);
        if (res.full) {
          alert('Replay vault is full (max 5 slots). Please manage or replace an entry in the Replay Vault.');
        } else if (res.success) {
          alert('Replay saved to local vault successfully!');
        }
      }
    });
    this.container.querySelector('#btn-results-restart')?.addEventListener('click', () => {
      this.onRestartRace();
      this.showScreen('hud');
    });
    this.container.querySelector('#btn-results-menu')?.addEventListener('click', () => {
      this.showScreen('menu');
    });

    // Settings Quality Options
    const qualityBoxes = this.container.querySelectorAll('[data-quality]');
    qualityBoxes.forEach((box) => {
      box.addEventListener('click', () => {
        qualityBoxes.forEach((b) => b.classList.remove('selected'));
        box.classList.add('selected');
        const q = box.getAttribute('data-quality') as GraphicsQuality;
        this.renderer.applyQuality(q);
        const curr = this.storage.getSettings();
        this.storage.saveSettings({ ...curr, quality: q });
      });
    });

    // Audio Settings
    const volumeSlider = this.container.querySelector('#settings-volume') as HTMLInputElement;
    volumeSlider?.addEventListener('input', () => {
      const vol = Number(volumeSlider.value) / 100;
      this.audio.setVolume(vol);
      const curr = this.storage.getSettings();
      this.storage.saveSettings({ ...curr, masterVolume: vol });
    });

    const muteCheck = this.container.querySelector('#settings-mute') as HTMLInputElement;
    muteCheck?.addEventListener('change', () => {
      this.audio.setMuted(muteCheck.checked);
      const curr = this.storage.getSettings();
      this.storage.saveSettings({ ...curr, isMuted: muteCheck.checked });
    });

    const motionCheck = this.container.querySelector('#settings-reduced-motion') as HTMLInputElement;
    motionCheck?.addEventListener('change', () => {
      const curr = this.storage.getSettings();
      this.storage.saveSettings({ ...curr, reducedMotion: motionCheck.checked });
    });

    this.container.querySelector('#btn-settings-back')?.addEventListener('click', () => {
      this.showScreen('menu');
    });

    this.container.querySelector('#btn-settings-reset-keys')?.addEventListener('click', () => {
      this.input.resetToDefaults();
      const conflictMsg = this.container.querySelector('#settings-key-conflict-msg') as HTMLElement;
      if (conflictMsg) conflictMsg.style.display = 'none';
      this.refreshSettingsForm();
    });

    // Replay Vault File Import
    const fileInput = this.container.querySelector('#replay-file-input') as HTMLInputElement;
    this.container.querySelector('#btn-vault-import')?.addEventListener('click', () => {
      fileInput.click();
    });
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const text = await file.text();
      const validation = this.storage.validateAndParseImport(text);
      if (!validation.valid || !validation.payload) {
        alert(`Import rejected: ${validation.error}`);
        fileInput.value = '';
        return;
      }

      if (this.storage.isLibraryFull()) {
        const replace = confirm('Replay library is full (5/5). Overwrite the oldest entry?');
        if (!replace) {
          fileInput.value = '';
          return;
        }
        const oldestId = this.storage.getReplayMetadataList()[0]?.id;
        await this.storage.saveReplay(validation.payload, oldestId);
      } else {
        await this.storage.saveReplay(validation.payload);
      }

      fileInput.value = '';
      this.refreshReplayLibraryList();
      alert('Replay imported successfully!');
    });

    this.container.querySelector('#btn-vault-back')?.addEventListener('click', () => {
      this.showScreen('menu');
    });

    // Photo Studio Controls (Signature Feature)
    this.bindPhotoStudioControls();

    // Key rebinding listener
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.rebindingAction) {
        e.preventDefault();
        const res = this.input.setBinding(this.rebindingAction, e.code);
        const conflictMsg = this.container.querySelector('#settings-key-conflict-msg') as HTMLElement;

        if (!res.success) {
          if (conflictMsg) {
            conflictMsg.style.display = 'block';
            conflictMsg.textContent = `Conflict: Key "${InputManager.getKeyDisplay(e.code)}" is already bound to "${res.conflictWith}".`;
          }
        } else {
          if (conflictMsg) conflictMsg.style.display = 'none';
        }

        this.rebindingAction = null;
        this.refreshSettingsForm();
      }

      // 'H' key toggles photo studio UI for clean view
      if (e.code === 'KeyH') {
        const panel = this.container.querySelector('#photo-studio-panel') as HTMLElement;
        if (panel && this.container.querySelector('#view-photo')?.classList.contains('active')) {
          panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        }
      }
    });
  }

  private bindPhotoStudioControls(): void {
    const fovSlider = this.container.querySelector('#photo-fov') as HTMLInputElement;
    const fovVal = this.container.querySelector('#photo-val-fov') as HTMLElement;
    fovSlider?.addEventListener('input', () => {
      this.photoStudio.settings.fov = Number(fovSlider.value);
      if (fovVal) fovVal.textContent = `${fovSlider.value}°`;
      this.photoStudio.updateCameraTransform();
    });

    const azSlider = this.container.querySelector('#photo-azimuth') as HTMLInputElement;
    const azVal = this.container.querySelector('#photo-val-azimuth') as HTMLElement;
    azSlider?.addEventListener('input', () => {
      this.photoStudio.settings.azimuth = Number(azSlider.value);
      if (azVal) azVal.textContent = `${azSlider.value}°`;
      this.photoStudio.updateCameraTransform();
    });

    const distSlider = this.container.querySelector('#photo-dist') as HTMLInputElement;
    const distVal = this.container.querySelector('#photo-val-dist') as HTMLElement;
    distSlider?.addEventListener('input', () => {
      this.photoStudio.settings.distance = Number(distSlider.value);
      if (distVal) distVal.textContent = `${distSlider.value}m`;
      this.photoStudio.updateCameraTransform();
    });

    const heightSlider = this.container.querySelector('#photo-height') as HTMLInputElement;
    const heightVal = this.container.querySelector('#photo-val-height') as HTMLElement;
    heightSlider?.addEventListener('input', () => {
      this.photoStudio.settings.height = Number(heightSlider.value);
      if (heightVal) heightVal.textContent = `${heightSlider.value}m`;
      this.photoStudio.updateCameraTransform();
    });

    const rollSlider = this.container.querySelector('#photo-roll') as HTMLInputElement;
    const rollVal = this.container.querySelector('#photo-val-roll') as HTMLElement;
    rollSlider?.addEventListener('input', () => {
      this.photoStudio.settings.roll = Number(rollSlider.value);
      if (rollVal) rollVal.textContent = `${rollSlider.value}°`;
      this.photoStudio.updateCameraTransform();
    });

    const filterSelect = this.container.querySelector('#photo-filter-select') as HTMLSelectElement;
    filterSelect?.addEventListener('change', () => {
      this.photoStudio.settings.filter = filterSelect.value as any;
    });

    const stampSelect = this.container.querySelector('#photo-stamp-select') as HTMLSelectElement;
    stampSelect?.addEventListener('change', () => {
      this.photoStudio.settings.stamp = stampSelect.value as any;
    });

    this.container.querySelector('#btn-photo-capture')?.addEventListener('click', () => {
      this.photoStudio.captureAndExportSnapshot(this.renderer.canvas);
    });

    this.container.querySelector('#btn-photo-close')?.addEventListener('click', () => {
      this.onClosePhotoStudio();
    });
  }

  // --- Real-Time Active Race HUD Updates ---
  public updateHUD(raceManager: RaceManager): void {
    const player = raceManager.playerCar;

    // Speedometer
    const speedEl = this.container.querySelector('#hud-speed-val');
    if (speedEl) speedEl.textContent = Math.round(player.speedKmh).toString();

    // Nitro Fill
    const nitroFill = this.container.querySelector('#hud-nitro-fill') as HTMLElement;
    const nitroVal = this.container.querySelector('#hud-nitro-val');
    if (nitroFill && nitroVal) {
      const pct = Math.round((player.nitroAmount / player.config.nitroCapacity) * 100);
      nitroFill.style.width = `${pct}%`;
      nitroVal.textContent = `${pct}%`;
    }

    // Drift & Invalidation Banners
    const driftBanner = this.container.querySelector('#hud-drift-banner') as HTMLElement;
    if (driftBanner) {
      if (player.isDrifting && player.driftScore > 10) {
        driftBanner.style.display = 'block';
        driftBanner.textContent = `DRIFT +${Math.round(player.driftScore)}`;
      } else {
        driftBanner.style.display = 'none';
      }
    }

    const invalidBanner = this.container.querySelector('#hud-lap-valid-banner') as HTMLElement;
    if (invalidBanner) {
      invalidBanner.style.display = (!player.isLapValid && raceManager.mode === 'time_trial') ? 'block' : 'none';
    }

    // Mode-specific HUD indicators
    const modeBadge = this.container.querySelector('#hud-mode-info');
    const timerBadge = this.container.querySelector('#hud-timer-info');
    const posBadge = this.container.querySelector('#hud-pos-info') as HTMLElement;

    if (raceManager.mode === 'time_trial') {
      if (modeBadge) modeBadge.textContent = `TIME TRIAL &bull; LAP ${Math.min(3, player.currentLap)} / 3`;
      if (timerBadge) timerBadge.textContent = this.formatMs(raceManager.currentLapTimeMs);
      if (posBadge) posBadge.style.display = 'none';
    } else if (raceManager.mode === 'race') {
      if (modeBadge) modeBadge.textContent = `RACE &bull; LAP ${Math.min(3, player.currentLap)} / 3`;
      if (timerBadge) timerBadge.textContent = this.formatMs(raceManager.raceElapsedMs);
      if (posBadge) {
        posBadge.style.display = 'block';
        const rank = raceManager.standings.find((s) => s.isPlayer)?.position || 1;
        posBadge.textContent = `POS: ${rank} / 6`;
      }
    } else {
      // Checkpoint Run
      if (modeBadge) modeBadge.textContent = `CHECKPOINT ${raceManager.currentCheckpointIndex} / ${raceManager.totalCheckpoints}`;
      if (timerBadge) {
        const secs = Math.ceil(raceManager.checkpointTimeRemaining);
        timerBadge.textContent = `${secs}s (x${raceManager.comboMultiplier.toFixed(1)})`;
        (timerBadge as HTMLElement).style.color = secs <= 10 ? 'var(--racing-red)' : '#ffffff';
      }
      if (posBadge) {
        posBadge.style.display = 'block';
        posBadge.textContent = `SCORE: ${raceManager.arcadeScore}`;
      }
    }

    // Countdown Display
    const cdEl = this.container.querySelector('#hud-center-countdown') as HTMLElement;
    if (cdEl) {
      if (raceManager.state === 'countdown') {
        cdEl.style.display = 'block';
        const sec = Math.ceil(raceManager.countdownTimer);
        cdEl.textContent = sec > 0 ? sec.toString() : 'GO!';
        cdEl.style.color = sec <= 0 ? 'var(--vibrant-cyan)' : '#ffffff';
      } else {
        cdEl.style.display = 'none';
      }
    }
  }

  // --- Results Screen Rendering ---
  public showResults(raceManager: RaceManager, transientPayload: ReplayPayload): void {
    this.transientReplayPayload = transientPayload;
    const titleEl = this.container.querySelector('#results-title');
    const subEl = this.container.querySelector('#results-subtitle');
    const bodyEl = this.container.querySelector('#results-body');

    if (!titleEl || !bodyEl || !subEl) return;

    if (raceManager.mode === 'time_trial') {
      titleEl.textContent = 'Time Trial Complete';
      const best = raceManager.bestValidLapMs ? this.formatMs(raceManager.bestValidLapMs) : 'None (All Invalid)';
      subEl.textContent = `Best Valid Lap: ${best}`;

      let rows = '';
      raceManager.lapTimes.forEach((l) => {
        rows += `
          <tr>
            <td>Lap ${l.lapNumber}</td>
            <td>${this.formatMs(l.timeMs)}</td>
            <td>${l.isValid ? '<span style="color: var(--vibrant-cyan);">VALID</span>' : '<span style="color: var(--racing-red);">INVALID (CUT/RECOVERY)</span>'}</td>
          </tr>
        `;
      });

      bodyEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Lap</th><th>Lap Time</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (raceManager.mode === 'race') {
      const playerRank = raceManager.standings.find((s) => s.isPlayer)?.position || 1;
      titleEl.textContent = playerRank === 1 ? '🏆 VICTORY!' : `Finished: ${playerRank}th Place`;
      subEl.textContent = `Riviera Grand Prix &bull; 6 Cars &bull; 3 Laps`;

      let rows = '';
      raceManager.standings.forEach((s) => {
        rows += `
          <tr style="${s.isPlayer ? 'font-weight: 800; color: var(--vibrant-cyan);' : ''}">
            <td>${s.position}</td>
            <td>${s.name} ${s.isPlayer ? '(You)' : ''}</td>
            <td>${s.completedLaps >= 3 ? this.formatMs(s.totalTimeMs || 0) : `DNF (+${3 - s.completedLaps} laps)`}</td>
          </tr>
        `;
      });

      bodyEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Pos</th><th>Competitor</th><th>Outcome / Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else {
      // Checkpoint Run
      titleEl.textContent = raceManager.isCheckpointSuccess ? '🏁 CHECKPOINT RUN COMPLETE!' : '⏱ TIME EXPIRED!';
      subEl.textContent = `Final Arcade Score: ${raceManager.arcadeScore} &bull; Checkpoints: ${raceManager.currentCheckpointIndex} / ${raceManager.totalCheckpoints}`;

      bodyEl.innerHTML = `
        <div style="padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <p><strong>Gates Cleared:</strong> ${raceManager.currentCheckpointIndex} / ${raceManager.totalCheckpoints}</p>
          <p><strong>Max Combo Multiplier:</strong> x${raceManager.comboMultiplier.toFixed(1)}</p>
          <p><strong>Run Status:</strong> ${raceManager.isCheckpointSuccess ? 'Victory' : 'Timed Out'}</p>
        </div>
      `;
    }

    this.showScreen('results');
  }

  // --- Replay HUD Controls ---
  public setupReplayControls(player: ReplayPlayer): void {
    const slider = this.container.querySelector('#replay-timeline-slider') as HTMLInputElement;
    const playBtn = this.container.querySelector('#btn-replay-play');
    const speedBtn = this.container.querySelector('#btn-replay-speed');
    const camBtn = this.container.querySelector('#btn-replay-cam');
    const badge = this.container.querySelector('#replay-hud-badge');

    if (slider) {
      slider.max = player.getDurationMs().toString();
      slider.addEventListener('input', () => {
        player.seekTo(Number(slider.value));
      });
    }

    playBtn?.addEventListener('click', () => {
      player.togglePlay();
      playBtn.textContent = player.isPlaying ? 'Pause' : 'Play';
    });

    speedBtn?.addEventListener('click', () => {
      const speeds = [0.5, 1.0, 2.0];
      const nextIdx = (speeds.indexOf(player.playbackSpeed) + 1) % speeds.length;
      player.setPlaybackSpeed(speeds[nextIdx]);
      speedBtn.textContent = `${speeds[nextIdx]}x`;
    });

    camBtn?.addEventListener('click', () => {
      player.cycleCamera();
      camBtn.textContent = `Cam: ${player.cameraMode.toUpperCase()}`;
      if (badge) badge.textContent = `REPLAY VIEWER &bull; ${player.cameraMode.toUpperCase()} CAM`;
    });

    this.container.querySelector('#btn-replay-photo')?.addEventListener('click', () => {
      this.onOpenPhotoStudio();
      this.showScreen('photo');
    });

    this.container.querySelector('#btn-replay-save')?.addEventListener('click', async () => {
      if (player.payload) {
        const res = await this.storage.saveReplay(player.payload);
        if (res.full) {
          alert('Replay vault is full (max 5 slots). Please manage slots in the Vault.');
        } else if (res.success) {
          alert('Replay saved to local vault successfully!');
        }
      }
    });

    this.container.querySelector('#btn-replay-export')?.addEventListener('click', () => {
      if (player.payload) {
        this.storage.exportReplayToFile(player.payload);
      }
    });

    this.container.querySelector('#btn-replay-exit')?.addEventListener('click', () => {
      this.onExitReplay();
      this.showScreen('menu');
    });
  }

  public updateReplayTimeline(player: ReplayPlayer): void {
    const slider = this.container.querySelector('#replay-timeline-slider') as HTMLInputElement;
    const curTime = this.container.querySelector('#replay-time-current');
    const totTime = this.container.querySelector('#replay-time-total');
    const hudTime = this.container.querySelector('#replay-hud-time');

    if (slider && !slider.matches(':active')) {
      slider.value = Math.round(player.currentTimeMs).toString();
    }

    const curStr = this.formatTimeSecs(player.currentTimeMs);
    const totStr = this.formatTimeSecs(player.getDurationMs());

    if (curTime) curTime.textContent = curStr;
    if (totTime) totTime.textContent = totStr;
    if (hudTime) hudTime.textContent = `${curStr} / ${totStr}`;
  }

  // --- Replay Library Rendering (5 slots) ---
  private refreshReplayLibraryList(): void {
    const list = this.storage.getReplayMetadataList();
    const badge = this.container.querySelector('#replay-capacity-badge');
    if (badge) badge.textContent = `${list.length} / 5 Slots Used`;

    const listContainer = this.container.querySelector('#replay-vault-list');
    if (!listContainer) return;

    if (list.length === 0) {
      listContainer.innerHTML = '<p style="padding: 20px; text-align: center;">No saved replays found in local vault.</p>';
      return;
    }

    let html = '<table class="data-table"><thead><tr><th>Title / Mode</th><th>Car</th><th>Duration</th><th>Origin</th><th>Actions</th></tr></thead><tbody>';

    list.forEach((meta) => {
      html += `
        <tr>
          <td><strong>${meta.title}</strong><br><span style="font-size: 11px; color: var(--text-muted);">${meta.mode.toUpperCase()}</span></td>
          <td>${meta.carId}</td>
          <td>${this.formatTimeSecs(meta.durationMs)}</td>
          <td>${meta.isImported ? '<span style="color: var(--sunset-orange);">IMPORTED</span>' : '<span style="color: var(--vibrant-cyan);">LOCAL PLAY</span>'}</td>
          <td>
            <button class="btn-secondary btn-replay-open" data-id="${meta.id}" style="padding: 4px 8px; font-size: 12px;">Watch</button>
            <button class="btn-secondary btn-replay-export" data-id="${meta.id}" style="padding: 4px 8px; font-size: 12px;">Export</button>
            <button class="btn-danger btn-replay-del" data-id="${meta.id}" style="padding: 4px 8px; font-size: 12px;">Delete</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    listContainer.innerHTML = html;

    // Attach listeners
    listContainer.querySelectorAll('.btn-replay-open').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const payload = await this.storage.getReplayData(id);
        if (payload) {
          this.onEnterReplay(payload);
          this.showScreen('replay-hud');
        }
      });
    });

    listContainer.querySelectorAll('.btn-replay-export').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const payload = await this.storage.getReplayData(id);
        if (payload) {
          this.storage.exportReplayToFile(payload);
        }
      });
    });

    listContainer.querySelectorAll('.btn-replay-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        if (confirm('Delete this replay from local vault?')) {
          await this.storage.deleteReplay(id);
          this.refreshReplayLibraryList();
        }
      });
    });
  }

  // --- Garage Car Selection UI ---
  private refreshGarageSelection(): void {
    const tabsContainer = this.container.querySelector('#garage-car-tabs');
    const descContainer = this.container.querySelector('#garage-car-desc');
    const statsContainer = this.container.querySelector('#garage-car-stats');
    if (!tabsContainer || !descContainer || !statsContainer) return;

    tabsContainer.innerHTML = '';
    Object.values(CAR_CONFIGS).forEach((cfg) => {
      const btn = document.createElement('div');
      btn.className = `car-tab-btn ${cfg.id === this.selectedCarId ? 'selected' : ''}`;
      btn.innerHTML = `<strong>${cfg.name}</strong><br><span style="font-size: 11px; color: var(--text-muted);">${cfg.subtitle}</span>`;
      btn.addEventListener('click', () => {
        this.selectedCarId = cfg.id;
        this.onSelectCarPreview(cfg.id);
        this.refreshGarageSelection();
      });
      tabsContainer.appendChild(btn);
    });

    const activeCfg = CAR_CONFIGS[this.selectedCarId];
    descContainer.innerHTML = `<p>${activeCfg.description}</p>`;

    statsContainer.innerHTML = `
      <div class="stat-row">
        <div class="stat-label"><span>TOP SPEED</span><span>${activeCfg.maxSpeedKmh} KM/H</span></div>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width: ${(activeCfg.maxSpeedKmh / 260) * 100}%;"></div></div>
      </div>
      <div class="stat-row">
        <div class="stat-label"><span>ACCELERATION</span><span>${activeCfg.accelForce} G</span></div>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width: ${(activeCfg.accelForce / 18) * 100}%;"></div></div>
      </div>
      <div class="stat-row">
        <div class="stat-label"><span>CORNERING GRIP</span><span>${activeCfg.baseGrip}</span></div>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width: ${(activeCfg.baseGrip / 6) * 100}%;"></div></div>
      </div>
      <div class="stat-row">
        <div class="stat-label"><span>DRIFT CONTROL</span><span>${activeCfg.driftControl}</span></div>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width: ${(activeCfg.driftControl / 1.5) * 100}%;"></div></div>
      </div>
    `;
  }

  // --- Settings Form Rendering ---
  private refreshSettingsForm(): void {
    const settings = this.storage.getSettings();
    const bindings = this.input.getBindings();

    // Volume & Motion
    const volInput = this.container.querySelector('#settings-volume') as HTMLInputElement;
    if (volInput) volInput.value = Math.round(settings.masterVolume * 100).toString();

    const muteInput = this.container.querySelector('#settings-mute') as HTMLInputElement;
    if (muteInput) muteInput.checked = settings.isMuted;

    const motionInput = this.container.querySelector('#settings-reduced-motion') as HTMLInputElement;
    if (motionInput) motionInput.checked = settings.reducedMotion;

    // Quality preset active indicator
    this.container.querySelectorAll('[data-quality]').forEach((box) => {
      box.classList.toggle('selected', box.getAttribute('data-quality') === settings.quality);
    });

    // Key Bindings Table
    const tableBody = this.container.querySelector('#settings-bindings-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const actionLabels: Record<keyof KeyBindings, string> = {
      accelerate: 'Accelerate',
      brake: 'Brake / Reverse',
      steerLeft: 'Steer Left',
      steerRight: 'Steer Right',
      handbrake: 'Drift / Handbrake',
      nitro: 'Nitro Boost',
      recover: 'Recover Car to Track',
      pause: 'Pause Game',
      camera: 'Cycle Camera'
    };

    (Object.keys(actionLabels) as Array<keyof KeyBindings>).forEach((action) => {
      const code = bindings[action];
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${actionLabels[action]}</td>
        <td><button class="btn-secondary btn-bind-key" data-action="${action}" style="padding: 4px 12px; font-size: 13px;">${InputManager.getKeyDisplay(code)}</button></td>
      `;

      row.querySelector('.btn-bind-key')?.addEventListener('click', (e) => {
        const btn = e.target as HTMLElement;
        btn.textContent = 'Press Key...';
        btn.style.borderColor = 'var(--sunset-orange)';
        this.rebindingAction = action;
      });

      tableBody.appendChild(row);
    });
  }

  private formatMs(ms: number): string {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  private formatTimeSecs(ms: number): string {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
