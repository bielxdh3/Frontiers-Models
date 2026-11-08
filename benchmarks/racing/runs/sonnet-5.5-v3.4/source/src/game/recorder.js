// Verification aid: records the game canvas + a drawn copy of the HUD + the post-limiter master audio into one WebM (MediaRecorder).
// Used only by `npm run verify` (volta.webm). Playwright's own video has no audio track, hence this in-page recorder.
export class LapRecorder {
  constructor(game, W = 1280, H = 720) {
    this.g = game; this.W = W; this.H = H; this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H; this.ctx = this.cv.getContext('2d'); this.frames = 0;
  }
  start(fps = 30) {
    const a = this.g.audio;
    this.dest = a.ctx.createMediaStreamDestination(); a.limiter.connect(this.dest);
    const tracks = [...this.cv.captureStream(fps).getVideoTracks(), ...this.dest.stream.getAudioTracks()];
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    this.mr = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 160_000 });
    this.chunks = []; this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.start(1000); this.mime = mime; this.t0 = performance.now();
    this.g.afterRender = () => this.draw();
  }
  draw() {
    const now = performance.now(); if (now - (this._last || 0) < 31) return; this._last = now;
    const g = this.ctx, W = this.W, H = this.H, G = this.g, R = G.race;
    g.drawImage(G.renderer.domElement, 0, 0, W, H); this.frames++;
    if (!R || !R.player) return;
    const p = R.player, v = p.v, panel = (x, y, w, h) => { g.fillStyle = 'rgba(10,12,18,0.62)'; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1; g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.stroke(); };
    const fmt = (t) => { if (!isFinite(t)) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
    g.fillStyle = '#f4f1ea'; g.textBaseline = 'alphabetic';
    panel(16, 14, 118, 78); g.font = '800 40px Segoe UI, Arial'; g.fillText(String(p.position || 1), 28, 62); g.font = '600 18px Segoe UI, Arial'; g.fillStyle = '#c9c2b3'; g.fillText('/' + R.cars.length, 56, 62);
    g.font = '600 11px Segoe UI, Arial'; g.fillStyle = '#f4f1ea'; g.fillText(`VOLTA ${Math.min(R.laps, p.lapsDone + 1)}/${R.laps}`, 28, 82);
    panel(W - 190, 14, 176, 60); g.font = '700 26px Consolas, monospace'; g.textAlign = 'right'; g.fillStyle = '#f4f1ea'; g.fillText(fmt(p.currentLapTime), W - 26, 46); g.font = '11px Segoe UI, Arial'; g.fillStyle = '#c9c2b3'; g.fillText('Melhor ' + fmt(p.bestLap), W - 26, 64);
    panel(W - 210, H - 96, 196, 82); g.font = '800 54px Segoe UI, Arial'; g.fillStyle = '#f4f1ea'; g.fillText(String(Math.round(Math.abs(v.speed) * 3.6)), W - 78, H - 40); g.font = '600 12px Segoe UI, Arial'; g.fillStyle = '#c9c2b3'; g.textAlign = 'left'; g.fillText('KM/H', W - 72, H - 42);
    g.font = '800 26px Segoe UI, Arial'; g.fillStyle = '#ffc24d'; g.textAlign = 'right'; g.fillText(v.reverse ? 'R' : String(v.gear), W - 26, H - 22); g.textAlign = 'left';
    const e = v.spec.engine, k = Math.min(1, Math.max(0, (v.rpm - e.idle) / (e.limiter - e.idle))); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(W - 200, H - 30, 120, 6); g.fillStyle = k > 0.85 ? '#f54' : '#6fd'; g.fillRect(W - 200, H - 30, 120 * k, 6);
    const m = G.ui.map; if (m) { panel(16, H - 126, 172, 112); g.drawImage(m.base, 0, 0, m.W, m.H, 20, H - 122, 164, 104); for (const c of R.cars) { const x = 20 + ((m.ox + (c.v.p[0] - m.x0) * m.sc) / m.W) * 164, y = H - 122 + ((m.oz + (c.v.p[2] - m.z0) * m.sc) / m.H) * 104; g.fillStyle = c.isPlayer ? '#ff8a3d' : 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x, y, c.isPlayer ? 4 : 2.6, 0, 7); g.fill(); } }
  }
  async stop() {
    this.g.afterRender = null;
    await new Promise((r) => { this.mr.onstop = r; this.mr.stop(); });
    try { this.g.audio.limiter.disconnect(this.dest); } catch {}
    this.blob = new Blob(this.chunks, { type: 'video/webm' });
    return { bytes: this.blob.size, mime: this.mime, frames: this.frames, seconds: +((performance.now() - this.t0) / 1000).toFixed(1) };
  }
  async chunk(i, size) { const ab = await this.blob.slice(i * size, (i + 1) * size).arrayBuffer(); let s = ''; const b = new Uint8Array(ab); for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode.apply(null, b.subarray(k, k + 0x8000)); return btoa(s); }
}
