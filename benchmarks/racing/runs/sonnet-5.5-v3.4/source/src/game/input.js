// Keyboard + gamepad input -> {steer, throttle, brake, handbrake} plus one-shot actions.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class Input {
  constructor(target = window) {
    this.down = new Set(); this.pressed = new Set(); this.steerSmooth = 0; this.throttleSmooth = 0; this.brakeSmooth = 0;
    this.padPrev = {};
    this.enabled = true;
    target.addEventListener('keydown', e => {
      if (e.repeat) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); return; }
      this.down.add(e.code); this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    target.addEventListener('keyup', e => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
    this.lastDevice = 'keyboard';
  }
  /** was this key pressed since the last call? (consumes) */
  hit(...codes) { let r = false; for (const c of codes) if (this.pressed.has(c)) { this.pressed.delete(c); r = true; } return r; }
  _pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  /** returns the drive controls; dt in seconds */
  poll(dt) {
    const k = this.down;
    const left = k.has('ArrowLeft') || k.has('KeyA'), right = k.has('ArrowRight') || k.has('KeyD');
    const up = k.has('ArrowUp') || k.has('KeyW'), dn = k.has('ArrowDown') || k.has('KeyS');
    let steerT = (right ? 1 : 0) - (left ? 1 : 0), thr = up ? 1 : 0, brk = dn ? 1 : 0, hb = k.has('Space') ? 1 : 0;
    // smoothing (keyboard feels analogue)
    const rate = steerT === 0 ? 10 : (Math.sign(steerT) !== Math.sign(this.steerSmooth) && this.steerSmooth !== 0 ? 14 : 6.5);
    this.steerSmooth += (steerT - this.steerSmooth) * (1 - Math.exp(-dt * rate));
    this.throttleSmooth += (thr - this.throttleSmooth) * (1 - Math.exp(-dt * 12));
    this.brakeSmooth += (brk - this.brakeSmooth) * (1 - Math.exp(-dt * 14));
    let steer = this.steerSmooth, throttle = this.throttleSmooth, brake = this.brakeSmooth;
    const pad = this._pad();
    this.pad = pad;
    if (pad) {
      const ax = Math.abs(pad.axes[0]) < 0.12 ? 0 : pad.axes[0];
      const sx = Math.sign(ax) * Math.pow(Math.abs(ax), 1.5);
      const rt = pad.buttons[7] ? pad.buttons[7].value : 0, lt = pad.buttons[6] ? pad.buttons[6].value : 0;
      if (Math.abs(sx) > 0.02 || rt > 0.05 || lt > 0.05) { steer = sx || steer; throttle = Math.max(throttle, rt); brake = Math.max(brake, lt); this.lastDevice = 'gamepad'; }
      if (pad.buttons[0] && pad.buttons[0].pressed) hb = 1;
      const edge = (name, idx) => { const now = !!(pad.buttons[idx] && pad.buttons[idx].pressed); if (now && !this.padPrev[name]) this.pressed.add(name); this.padPrev[name] = now; };
      edge('PadCamera', 3); edge('PadReset', 2); edge('PadPause', 9); edge('PadConfirm', 0); edge('PadBack', 1);
      edge('PadUp', 12); edge('PadDown', 13); edge('PadLeft', 14); edge('PadRight', 15);
    }
    return { steer: clamp(steer, -1, 1), throttle: clamp(throttle, 0, 1), brake: clamp(brake, 0, 1), handbrake: hb, assist: 0.45 };
  }
  action(name) {
    switch (name) {
      case 'pause': return this.hit('Escape', 'KeyP', 'PadPause');
      case 'camera': return this.hit('KeyC', 'PadCamera');
      case 'reset': return this.hit('KeyR', 'PadReset');
      case 'confirm': return this.hit('Enter', 'PadConfirm');
      case 'back': return this.hit('Backspace', 'PadBack');
      case 'left': return this.hit('ArrowLeft', 'PadLeft');
      case 'right': return this.hit('ArrowRight', 'PadRight');
      case 'up': return this.hit('ArrowUp', 'PadUp');
      case 'down': return this.hit('ArrowDown', 'PadDown');
    }
    return false;
  }
}
