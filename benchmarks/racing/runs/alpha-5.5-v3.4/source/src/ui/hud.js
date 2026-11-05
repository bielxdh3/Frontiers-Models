// Race HUD drawn on a 2D canvas over the WebGL canvas (never blurred):
// position, lap, current/best lap time, speed, gear + RPM arc, minimap,
// countdown and race messages.
export function fmtTime(t, ms = true) {
  if (!isFinite(t) || t <= 0) return ms ? '-:--.---' : '-:--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return ms ? `${m}:${s.toFixed(3).padStart(6, '0')}` : `${m}:${Math.floor(s).toString().padStart(2, '0')}`;
}

export class HUD {
  constructor(canvas, world) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.world = world; this.visible = false;
    this._buildMap();
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.c.width = Math.round(innerWidth * dpr); this.c.height = Math.round(innerHeight * dpr);
    this.dpr = dpr;
  }
  _buildMap() {
    const T = this.world.track;
    const pts = [];
    for (let s = 0; s < T.length; s += 8) { const f = T.frame(s, {}); pts.push([f.x, f.z]); }
    // rotate so the long axis is horizontal
    let mx = 0, mz = 0; for (const p of pts) { mx += p[0]; mz += p[1]; } mx /= pts.length; mz /= pts.length;
    let sxx = 0, szz = 0, sxz = 0; for (const p of pts) { const dx = p[0] - mx, dz = p[1] - mz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    this.mapRot = -ang; this.mapC = [mx, mz];
    const r = this._rot.bind(this);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { const q = r(p[0], p[1]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    this.mapBox = { x0, x1, y0, y1 };
    this.mapPts = pts.map((p) => r(p[0], p[1]));
    const sf = T.frame(T.features.startS, {}); this.mapStart = r(sf.x, sf.z);
  }
  _rot(x, z) { const c = Math.cos(this.mapRot), s = Math.sin(this.mapRot); const dx = x - this.mapC[0], dz = z - this.mapC[1]; return [dx * c - dz * s, dx * s + dz * c]; }

  draw(G) {
    const g = this.g, W = this.c.width, H = this.c.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    if (!this.visible || !G.race) return;
    const k = Math.min(W / 1920, H / 1080);
    g.setTransform(k, 0, 0, k, 0, 0);
    const w = W / k, h = H / k;
    const race = G.race, car = G.player, me = race.E[0];
    const font = (sz, wt = 700, it = true) => `${it ? 'italic ' : ''}${wt} ${sz}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    const grads = this._grads || (this._grads = new Map());
    const panel = (x, y, ww, hh, a = 0.42) => {
      const key = x + ',' + y + ',' + ww + ',' + a; // gradients are cached (no per-frame allocation)
      let gr = grads.get(key);
      if (!gr) { gr = g.createLinearGradient(x, y, x + ww, y); gr.addColorStop(0, `rgba(12,9,8,${a})`); gr.addColorStop(1, `rgba(12,9,8,${a * 0.35})`); grads.set(key, gr); }
      g.fillStyle = gr; g.beginPath(); g.moveTo(x + 14, y); g.lineTo(x + ww, y); g.lineTo(x + ww - 14, y + hh); g.lineTo(x, y + hh); g.closePath(); g.fill();
    };
    g.textBaseline = 'alphabetic';
    // ---------------- position + lap (top-left)
    const pos = race.position(0), n = race.E.length;
    panel(36, 34, 330, 132);
    g.fillStyle = '#fff4e6'; g.font = font(92, 800); g.textAlign = 'left';
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 8;
    g.fillText(String(pos), 58, 132);
    const pw = g.measureText(String(pos)).width;
    g.font = font(34, 700); g.fillStyle = '#ffb25b'; g.fillText('º', 60 + pw, 92);
    g.font = font(38, 600); g.fillStyle = 'rgba(255,244,230,0.75)'; g.fillText('/' + n, 64 + pw + 26, 132);
    g.font = font(17, 700, false); g.fillStyle = 'rgba(255,244,230,0.6)'; g.fillText('POSIÇÃO', 214, 72);
    const lapNow = Math.min(race.cfg.laps, me.lapsDone + 1);
    g.font = font(40, 800); g.fillStyle = '#fff4e6'; g.fillText(`${lapNow}`, 214, 128);
    const lw = g.measureText(`${lapNow}`).width;
    g.font = font(26, 600); g.fillStyle = 'rgba(255,244,230,0.7)'; g.fillText(`/${race.cfg.laps}`, 218 + lw, 128);
    g.font = font(17, 700, false); g.fillStyle = 'rgba(255,244,230,0.6)'; g.fillText('VOLTA', 214, 150);
    g.shadowBlur = 0;
    // mini standings
    const st = race.standings();
    let y = 200;
    for (let r = 0; r < st.length; r++) {
      const e = st[r];
      const isMe = e.isPlayer;
      panel(36, y - 24, 300, 32, isMe ? 0.62 : 0.34);
      g.fillStyle = isMe ? '#ffb25b' : 'rgba(255,244,230,0.8)'; g.font = font(18, 800); g.textAlign = 'left';
      g.fillText(String(r + 1), 52, y - 1);
      g.fillStyle = '#' + e.livery.color.toString(16).padStart(6, '0'); g.fillRect(80, y - 18, 6, 22);
      g.fillStyle = isMe ? '#fff4e6' : 'rgba(255,244,230,0.85)'; g.font = font(18, isMe ? 800 : 600, false);
      g.fillText(e.name, 96, y - 1);
      if (e.finished) { g.textAlign = 'right'; g.fillStyle = '#9fe6a0'; g.font = font(15, 700, false); g.fillText('FIM', 320, y - 2); }
      y += 36;
    }
    // ---------------- times (top-right)
    const cur = race.state === 'running' || race.state === 'finished' ? (me.finished ? me.lapTimes[me.lapTimes.length - 1] : race.clock - me.lapStart) : 0;
    panel(w - 420, 34, 384, 132);
    g.textAlign = 'right';
    g.font = font(16, 700, false); g.fillStyle = 'rgba(255,244,230,0.6)'; g.fillText('TEMPO DA VOLTA', w - 60, 64);
    g.font = font(50, 700); g.fillStyle = '#fff4e6'; g.fillText(fmtTime(cur), w - 58, 116);
    g.font = font(16, 700, false); g.fillStyle = 'rgba(255,244,230,0.6)'; g.fillText('MELHOR', w - 230, 150);
    g.font = font(24, 700); g.fillStyle = '#ffb25b'; g.fillText(fmtTime(me.best), w - 58, 150);
    // ---------------- speedo (bottom-right)
    const cx = w - 190, cy = h - 170, R = 128;
    const s = car.spec;
    const rpmN = Math.max(0, Math.min(1, car.rpm / (s.redline + 300)));
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineCap = 'butt';
    g.fillStyle = 'rgba(12,9,8,0.42)'; g.beginPath(); g.arc(cx, cy, R + 26, 0, Math.PI * 2); g.fill();
    const segs = 40;
    for (let i = 0; i < segs; i++) {
      const u0 = i / segs, u1 = (i + 0.78) / segs;
      const rpmAt = u0 * (s.redline + 300);
      const on = u0 < rpmN;
      g.strokeStyle = rpmAt > s.redline - 400 ? (on ? '#ff4a2a' : 'rgba(255,74,42,0.28)') : on ? '#ffd29a' : 'rgba(255,244,230,0.16)';
      g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, R, a0 + (a1 - a0) * u0, a0 + (a1 - a0) * u1); g.stroke();
    }
    // rpm labels
    g.fillStyle = 'rgba(255,244,230,0.55)'; g.font = font(14, 700, false); g.textAlign = 'center';
    for (let r = 0; r <= Math.floor((s.redline + 300) / 1000); r++) {
      const u = (r * 1000) / (s.redline + 300); const a = a0 + (a1 - a0) * u;
      g.fillText(String(r), cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30) + 5);
    }
    const kmh = Math.round(car.speed * 3.6);
    g.fillStyle = '#fff4e6'; g.font = font(78, 800); g.textAlign = 'center';
    g.fillText(String(kmh), cx, cy + 28);
    g.font = font(16, 700, false); g.fillStyle = 'rgba(255,244,230,0.6)'; g.fillText('KM/H', cx, cy + 54);
    const gear = car.reverse ? 'R' : car.held ? 'N' : String(car.gear);
    g.fillStyle = car.limiter ? '#ff4a2a' : '#ffb25b'; g.font = font(40, 800);
    g.fillText(gear, cx, cy - 46);
    g.font = font(13, 700, false); g.fillStyle = 'rgba(255,244,230,0.55)'; g.fillText('×1000 RPM', cx, cy + 96);
    // ---------------- minimap (bottom-left)
    const mb = this.mapBox, mw = 400, mh = Math.round(Math.min(300, Math.max(150, mw * (mb.y1 - mb.y0) / (mb.x1 - mb.x0) + 44)));
    this._minimap(g, 36, h - 36 - mh, mw, mh, G);
    // ---------------- countdown / messages
    const cd = race.countdownValue();
    if (cd) {
      const ph = (race.phaseT % 1);
      g.globalAlpha = Math.max(0, 1 - ph * 0.8);
      g.font = font(220 + ph * 40, 900); g.textAlign = 'center'; g.fillStyle = '#fff4e6';
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24;
      g.fillText(String(cd), w / 2, h * 0.42);
      g.shadowBlur = 0; g.globalAlpha = 1;
    }
    let my = h * 0.25;
    for (const m of race.messages) {
      const a = Math.min(1, m.t * 2);
      g.globalAlpha = a;
      g.font = font(m.kind === 'go' ? 120 : 52, 900); g.textAlign = 'center';
      g.fillStyle = m.kind === 'warn' ? '#ff6a4a' : m.kind === 'go' ? '#9fe6a0' : '#fff4e6';
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 18;
      g.fillText(m.text, w / 2, m.kind === 'go' ? h * 0.42 : my);
      g.shadowBlur = 0; g.globalAlpha = 1;
      my += 64;
    }
    if (G.camCtl.mode === 'hood') { g.font = font(14, 700, false); g.fillStyle = 'rgba(255,244,230,0.5)'; g.textAlign = 'left'; g.fillText('CÂMERA: CAPÔ  [C]', 36, h - 24); }
  }

  _minimap(g, x, y, w, h, G) {
    const B = this.mapBox, pad = 22;
    const sc = Math.min((w - pad * 2) / (B.x1 - B.x0), (h - pad * 2) / (B.y1 - B.y0));
    const ox = x + w / 2 - ((B.x0 + B.x1) / 2) * sc, oy = y + h / 2 - ((B.y0 + B.y1) / 2) * sc;
    g.fillStyle = 'rgba(12,9,8,0.38)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 14) : g.rect(x, y, w, h); g.fill();
    g.lineJoin = 'round'; g.lineCap = 'round';
    const path = () => { g.beginPath(); this.mapPts.forEach((p, i) => (i ? g.lineTo(ox + p[0] * sc, oy + p[1] * sc) : g.moveTo(ox + p[0] * sc, oy + p[1] * sc))); g.closePath(); };
    path(); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9; g.stroke();
    path(); g.strokeStyle = 'rgba(255,244,230,0.85)'; g.lineWidth = 4.5; g.stroke();
    // start line
    g.fillStyle = '#ffb25b'; g.beginPath(); g.arc(ox + this.mapStart[0] * sc, oy + this.mapStart[1] * sc, 5, 0, Math.PI * 2); g.fill();
    const cars = G.sim.cars;
    for (let i = cars.length - 1; i >= 0; i--) {
      const p = this._rot(cars[i].pos.x, cars[i].pos.z);
      const e = G.race.E[i];
      g.fillStyle = '#' + e.livery.color.toString(16).padStart(6, '0');
      g.strokeStyle = i === 0 ? '#ffffff' : 'rgba(0,0,0,0.7)'; g.lineWidth = i === 0 ? 3 : 2;
      g.beginPath(); g.arc(ox + p[0] * sc, oy + p[1] * sc, i === 0 ? 8 : 6, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
}
