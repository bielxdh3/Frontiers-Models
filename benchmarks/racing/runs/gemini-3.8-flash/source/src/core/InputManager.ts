/**
 * InputManager.ts
 * Manages physical keyboard input (KeyboardEvent.code), remapping, conflict detection,
 * browser focus ownership, and persistence to localStorage.
 */

export interface KeyBindings {
  accelerate: string;
  brake: string;
  steerLeft: string;
  steerRight: string;
  handbrake: string; // Drift
  nitro: string;
  recover: string;
  pause: string;
  camera: string;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  accelerate: 'KeyW',
  brake: 'KeyS',
  steerLeft: 'KeyA',
  steerRight: 'KeyD',
  handbrake: 'Space',
  nitro: 'ShiftLeft',
  recover: 'KeyR',
  pause: 'Escape',
  camera: 'KeyC'
};

// Alternative common defaults (e.g. Arrow keys) mapped simultaneously
export const ALTERNATE_KEYS: Record<string, keyof KeyBindings> = {
  ArrowUp: 'accelerate',
  ArrowDown: 'brake',
  ArrowLeft: 'steerLeft',
  ArrowRight: 'steerRight',
  KeyN: 'nitro',
  KeyP: 'pause'
};

export class InputManager {
  private bindings: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
  private activeKeys = new Set<string>();
  private listeners: Array<() => void> = [];
  private isCapturing = true;

  constructor() {
    this.loadBindings();
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isCapturing) return;

      // Prevent scrolling from gameplay keys during active driving
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        // Only prevent default if target is body or canvas (not an input field)
        const target = e.target as HTMLElement | null;
        if (!target || target.tagName !== 'INPUT') {
          e.preventDefault();
        }
      }

      this.activeKeys.add(e.code);
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.activeKeys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.clearAll();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearAll();
      }
    });
  }

  public setCapturing(capturing: boolean): void {
    this.isCapturing = capturing;
    if (!capturing) {
      this.clearAll();
    }
  }

  public clearAll(): void {
    this.activeKeys.clear();
  }

  public isActionActive(action: keyof KeyBindings): boolean {
    const boundKey = this.bindings[action];
    if (this.activeKeys.has(boundKey)) {
      return true;
    }
    // Also check alternative key mappings
    for (const [code, altAction] of Object.entries(ALTERNATE_KEYS)) {
      if (altAction === action && this.activeKeys.has(code)) {
        return true;
      }
    }
    return false;
  }

  public getRawInput() {
    let throttle = 0;
    if (this.isActionActive('accelerate')) throttle += 1;
    if (this.isActionActive('brake')) throttle -= 1;

    let steer = 0;
    if (this.isActionActive('steerLeft')) steer -= 1;
    if (this.isActionActive('steerRight')) steer += 1;

    return {
      throttle, // -1 (brake/rev) to +1 (accel)
      steer,    // -1 (left) to +1 (right)
      drift: this.isActionActive('handbrake'),
      nitro: this.isActionActive('nitro'),
      recover: this.isActionActive('recover'),
      pause: this.isActionActive('pause'),
      camera: this.isActionActive('camera')
    };
  }

  public getBindings(): KeyBindings {
    return { ...this.bindings };
  }

  public setBinding(action: keyof KeyBindings, code: string): { success: boolean; conflictWith?: keyof KeyBindings } {
    // Conflict detection: check if another action already has this exact code
    for (const [act, boundCode] of Object.entries(this.bindings)) {
      if (act !== action && boundCode === code) {
        return { success: false, conflictWith: act as keyof KeyBindings };
      }
    }

    this.bindings[action] = code;
    this.saveBindings();
    return { success: true };
  }

  public resetToDefaults(): void {
    this.bindings = { ...DEFAULT_KEY_BINDINGS };
    this.saveBindings();
  }

  private saveBindings(): void {
    try {
      localStorage.setItem('racing_bench_keybindings', JSON.stringify(this.bindings));
    } catch {
      // LocalStorage unavailable or disabled
    }
  }

  private loadBindings(): void {
    try {
      const data = localStorage.getItem('racing_bench_keybindings');
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const key of Object.keys(DEFAULT_KEY_BINDINGS) as Array<keyof KeyBindings>) {
            if (typeof parsed[key] === 'string') {
              this.bindings[key] = parsed[key];
            }
          }
        }
      }
    } catch {
      this.bindings = { ...DEFAULT_KEY_BINDINGS };
    }
  }

  public static getKeyDisplay(code: string): string {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'Space') return 'Spacebar';
    if (code === 'ShiftLeft') return 'Left Shift';
    if (code === 'ShiftRight') return 'Right Shift';
    if (code === 'ControlLeft') return 'Left Ctrl';
    if (code === 'ControlRight') return 'Right Ctrl';
    if (code === 'Escape') return 'Esc';
    if (code === 'ArrowUp') return '↑';
    if (code === 'ArrowDown') return '↓';
    if (code === 'ArrowLeft') return '←';
    if (code === 'ArrowRight') return '→';
    return code;
  }
}
