// Keyboard + gamepad input with smoothing for digital steering.
export class Input {
  constructor() {
    this.keys = new Set();
    this.steer = 0; this.throttle = 0; this.brake = 0; this.handbrake = 0;
    this.pressed = new Set(); // edge-triggered actions this frame
    this.usingPad = false;
    this.padPrev = {};
    this.bindings = {
      throttle: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      handbrake: ['Space'], camera: ['KeyC'], pause: ['Escape', 'KeyP'], reset: ['KeyR'],
      // menu navigation
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], confirm: ['Enter', 'NumpadEnter'], back: ['Escape', 'Backspace'],
    };
    this.bindings.left2 = this.bindings.left; this.bindings.right2 = this.bindings.right;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code); this.usingPad = false;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  down(action) { return this.bindings[action].some((k) => this.keys.has(k)); }
  hit(action) { return this.bindings[action].some((k) => this.pressed.has(k)); }

  poll(dt, speed = 0) {
    let pad = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    let thr = this.down('throttle') ? 1 : 0, brk = this.down('brake') ? 1 : 0, hb = this.down('handbrake') ? 1 : 0;
    let target = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let analog = false;
    this.padPressed = {};
    if (pad) {
      const b = (i) => (pad.buttons[i] ? pad.buttons[i].value : 0);
      const ax = pad.axes[0] || 0;
      const dz = Math.abs(ax) < 0.08 ? 0 : (ax - Math.sign(ax) * 0.08) / 0.92;
      if (Math.abs(dz) > 0.01 || b(7) > 0.05 || b(6) > 0.05) { this.usingPad = true; }
      if (this.usingPad) {
        thr = Math.max(thr, b(7)); brk = Math.max(brk, b(6)); hb = Math.max(hb, b(0) > 0.5 ? 1 : 0);
        if (Math.abs(dz) > 0.0) { target = Math.sign(dz) * Math.pow(Math.abs(dz), 1.4); analog = true; }
      }
      const edge = (i, name) => { const v = b(i) > 0.5; if (v && !this.padPrev[i]) this.padPressed[name] = true; this.padPrev[i] = v; };
      edge(3, 'camera'); edge(9, 'pause'); edge(8, 'reset'); edge(12, 'up'); edge(13, 'down'); edge(14, 'left'); edge(15, 'right'); edge(0, 'confirm'); edge(1, 'back');
    }
    if (analog) this.steer = target;
    else {
      const rate = target === 0 ? 5.5 : (Math.sign(target) !== Math.sign(this.steer) && this.steer !== 0 ? 7 : 2.6 + 1.5 / (1 + speed / 25));
      const d = target - this.steer;
      this.steer += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    }
    const r = 1 - Math.exp(-dt * 14);
    this.throttle += (thr - this.throttle) * r;
    this.brake += (brk - this.brake) * r;
    this.handbrake = hb;
  }
  action(name) { return this.hit(name) || (this.padPressed && this.padPressed[name]); }
  endFrame() { this.pressed.clear(); }
}
