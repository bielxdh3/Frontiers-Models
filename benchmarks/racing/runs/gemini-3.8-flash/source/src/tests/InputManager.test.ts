/**
 * tests/InputManager.test.ts
 * Tests keyboard bindings, conflict detection, and reset behaviors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager, DEFAULT_KEY_BINDINGS } from '../core/InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    localStorage.clear();
    input = new InputManager();
  });

  it('loads default keybindings correctly', () => {
    const bindings = input.getBindings();
    expect(bindings.accelerate).toBe(DEFAULT_KEY_BINDINGS.accelerate);
    expect(bindings.brake).toBe(DEFAULT_KEY_BINDINGS.brake);
    expect(bindings.handbrake).toBe(DEFAULT_KEY_BINDINGS.handbrake);
    expect(bindings.nitro).toBe(DEFAULT_KEY_BINDINGS.nitro);
  });

  it('detects conflicting key assignments and rejects duplicate keys', () => {
    // Attempt to bind brake to the same key as accelerate ('KeyW')
    const result = input.setBinding('brake', 'KeyW');
    expect(result.success).toBe(false);
    expect(result.conflictWith).toBe('accelerate');

    // Original bindings must remain untouched
    expect(input.getBindings().brake).toBe(DEFAULT_KEY_BINDINGS.brake);
  });

  it('successfully rebinds to an available key and persists', () => {
    const result = input.setBinding('accelerate', 'KeyI');
    expect(result.success).toBe(true);
    expect(input.getBindings().accelerate).toBe('KeyI');

    // Check persistence
    const reloaded = new InputManager();
    expect(reloaded.getBindings().accelerate).toBe('KeyI');
  });

  it('resets bindings back to default cleanly', () => {
    input.setBinding('accelerate', 'KeyI');
    input.resetToDefaults();
    expect(input.getBindings().accelerate).toBe(DEFAULT_KEY_BINDINGS.accelerate);
  });

  it('formats display labels accurately for UI and special keys', () => {
    expect(InputManager.getKeyDisplay('Space')).toBe('Spacebar');
    expect(InputManager.getKeyDisplay('ShiftLeft')).toBe('Left Shift');
    expect(InputManager.getKeyDisplay('ArrowUp')).toBe('↑');
    expect(InputManager.getKeyDisplay('KeyW')).toBe('W');
  });
});
