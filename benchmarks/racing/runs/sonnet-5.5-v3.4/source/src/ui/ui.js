// DOM user interface: main menu, garage, setup, grid presentation, countdown, HUD, pause, results, settings.
import { CAR_SPECS, CAR_LIST, LIVERIES } from '../physics/car-specs.js';

const fmt = t => { if (!isFinite(t)) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
export { fmt as formatTime };

export class UI {
  constructor(root, h) {
    this.root = root; this.h = h; this.cur = null; this.sel = { carIdx: 0, livery: 0, laps: 3, diff: 'normal', quality: h.quality || 'high' };
    this.vol = { master: 0.8, sfx: 0.9, music: 0.5 };
    root.innerHTML = `
    <div id="scr-menu" class="screen"><div class="box"><h1 class="title">COSTA DOURADA</h1><div class="sub">Pôr do sol · 5 rivais</div>
      <div class="col btns"><button class="btn big" id="btn-play">Jogar</button><button class="btn" id="btn-settings">Configurações</button></div></div>
      <div class="foot">↑ ↓ ← → / WASD dirigir · Espaço freio de mão · C câmera · R resetar · Esc pausa · Gamepad suportado</div></div>
    <div id="scr-garage" class="screen"><button class="btn navbtn" id="g-prev" style="left:4vw">‹</button><button class="btn navbtn" id="g-next" style="left:calc(4vw + 70px)">›</button>
      <div class="sidepanel panel"><h2>Garagem</h2><h3 id="g-name"></h3><div id="g-blurb" style="opacity:.8;font-size:14px;margin-bottom:12px"></div>
        <div id="g-stats"></div><div class="lbl">Pintura</div><div class="swatches" id="g-sw"></div><div id="g-liv" style="font-size:13px;opacity:.8"></div>
        <div class="row" style="margin-top:22px"><button class="btn small" id="g-back">Voltar</button><button class="btn" id="g-ok" style="flex:1">Continuar</button></div></div>
      <div class="hint">← → trocar carro · 1–6 pintura · Enter continuar</div></div>
    <div id="scr-setup" class="screen"><div class="sidepanel panel" style="right:auto;left:5vw"><h2>Configuração da corrida</h2>
      <div class="lbl">Voltas</div><div class="opt" id="o-laps"><button class="btn small" data-v="3">3 voltas</button><button class="btn small" data-v="6">6 voltas</button></div>
      <div class="lbl">Dificuldade</div><div class="opt" id="o-diff"><button class="btn small" data-v="easy">Fácil</button><button class="btn small" data-v="normal">Normal</button><button class="btn small" data-v="hard">Difícil</button></div>
      <div class="lbl">Qualidade gráfica</div><div class="opt" id="o-q"><button class="btn small" data-v="low">Baixa</button><button class="btn small" data-v="high">Alta</button></div>
      <div class="row" style="margin-top:18px"><button class="btn small" id="s-back">Voltar</button><button class="btn big" id="s-go" style="flex:1">Largar</button></div></div></div>
    <div id="scr-grid" class="screen"><div class="list panel"><h2>GRID DE LARGADA</h2><div id="gp-list"></div></div></div>
    <div id="hud"><div class="pos panel"><div class="big" id="h-pos">1<small>/6</small></div><div class="lap" id="h-lap">Volta 1/3</div></div>
      <div class="times panel"><div class="t" id="h-cur">00:00.000</div><div class="b" id="h-best">Melhor --:--.---</div></div>
      <canvas id="h-map" width="230" height="170"></canvas>
      <div class="speed panel"><div><span class="kmh" id="h-kmh">0</span><span class="u">KM/H</span></div><div class="gear"><div class="rpm"><i id="h-rpm"></i></div><div class="g" id="h-gear">N</div></div></div>
      <div id="fpsbox"></div></div>
    <div id="cd"></div><div id="toast"></div>
    <div id="scr-pause" class="screen"><div class="center panel"><h2>Pausa</h2><div class="col"><button class="btn big" id="p-cont">Continuar</button><button class="btn" id="p-restart">Reiniciar</button><button class="btn" id="p-set">Configurações</button><button class="btn" id="p-menu">Menu principal</button></div></div></div>
    <div id="scr-results" class="screen"><div class="center panel"><h2>Resultados</h2><table class="res"><thead><tr><th>#</th><th>Piloto</th><th>Carro</th><th>Tempo</th><th>Melhor volta</th></tr></thead><tbody id="r-body"></tbody></table>
      <div class="row" style="justify-content:center"><button class="btn big" id="r-again">Correr de novo</button><button class="btn" id="r-menu">Menu</button></div></div></div>
    <div id="scr-settings" class="screen"><div class="center panel"><h2>Configurações</h2>
      <div class="slider"><span>Geral</span><input type="range" id="v-master" min="0" max="100" value="80"><b id="vv-master">80</b></div>
      <div class="slider"><span>Efeitos</span><input type="range" id="v-sfx" min="0" max="100" value="90"><b id="vv-sfx">90</b></div>
      <div class="slider"><span>Música</span><input type="range" id="v-music" min="0" max="100" value="50"><b id="vv-music">50</b></div>
      <div class="lbl" style="text-align:left">Qualidade gráfica (recarrega o jogo)</div><div class="opt" id="st-q" style="justify-content:center"><button class="btn small" data-v="low">Baixa</button><button class="btn small" data-v="high">Alta</button></div>
      <div class="keys"><kbd>W A S D</kbd> / setas — acelerar, frear, esterçar · <kbd>Espaço</kbd> freio de mão · <kbd>C</kbd> câmera · <kbd>R</kbd> resetar · <kbd>Esc</kbd> pausa<br>Gamepad: gatilhos acelera/freia · analógico esquerdo esterça · A freio de mão · Y câmera · X resetar · Start pausa</div>
      <button class="btn big" id="st-back" style="width:100%">Voltar</button></div></div>
    <div id="flash"></div>`;
    const $ = id => root.querySelector('#' + id);
    this.$ = $;
    $('btn-play').onclick = () => h.onPlay(); $('btn-settings').onclick = () => this.openSettings('menu');
    $('g-prev').onclick = () => this.garageStep(-1); $('g-next').onclick = () => this.garageStep(1);
    $('g-back').onclick = () => h.onMenu(); $('g-ok').onclick = () => h.onGarageOk(this.sel);
    $('s-back').onclick = () => h.onGarage(); $('s-go').onclick = () => h.onStart({ ...this.sel });
    $('p-cont').onclick = () => h.onResume(); $('p-restart').onclick = () => h.onRestart(); $('p-menu').onclick = () => h.onMenu(); $('p-set').onclick = () => this.openSettings('pause');
    $('r-again').onclick = () => h.onAgain(); $('r-menu').onclick = () => h.onMenu();
    $('st-back').onclick = () => { this.show(this.settingsFrom || 'menu'); };
    const group = (id, key, fmtv) => { const g = $(id); g.querySelectorAll('button').forEach(b => b.onclick = () => { this.sel[key] = fmtv ? fmtv(b.dataset.v) : b.dataset.v; this.refreshOpts(); h.onOption?.(key, this.sel[key]); }); };
    group('o-laps', 'laps', v => +v); group('o-diff', 'diff'); group('o-q', 'quality'); group('st-q', 'quality');
    for (const k of ['master', 'sfx', 'music']) $('v-' + k).oninput = e => { this.vol[k] = +e.target.value / 100; $('vv-' + k).textContent = e.target.value; h.onVolume?.(k, this.vol[k]); };
    this.liveries = LIVERIES;
    const sw = $('g-sw'); LIVERIES.forEach((l, i) => { const d = document.createElement('div'); d.className = 'sw'; d.style.background = l.paint; d.title = l.name; d.dataset.i = i; d.onclick = () => this.pickLivery(i); sw.appendChild(d); });
    this.refreshOpts(); this.garageRefresh();
    this.map = null; this.toastT = 0;
  }

  show(name) {
    for (const el of this.root.querySelectorAll('.screen')) el.classList.remove('on');
    this.cur = name;
    const el = this.root.querySelector('#scr-' + name); if (el) el.classList.add('on');
    this.root.querySelector('#hud').classList.toggle('on', name === 'hud' || name === 'pause' || name === 'grid');
    if (name === 'pause') this.root.querySelector('#hud').classList.add('on');
  }
  hideAll() { this.show('none'); }
  hudVisible(v) { this.root.querySelector('#hud').classList.toggle('on', v); }

  refreshOpts() {
    const mark = (id, val) => this.$(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', String(b.dataset.v) === String(val)));
    mark('o-laps', this.sel.laps); mark('o-diff', this.sel.diff); mark('o-q', this.sel.quality); mark('st-q', this.sel.quality);
  }
  openSettings(from) { this.settingsFrom = from; this.show('settings'); }

  garageStep(d) { this.sel.carIdx = (this.sel.carIdx + d + CAR_LIST.length) % CAR_LIST.length; this.garageRefresh(); this.h.onGarageChange?.(this.sel); }
  pickLivery(i) { this.sel.livery = i; this.garageRefresh(); this.h.onGarageChange?.(this.sel); }
  garageRefresh() {
    const spec = CAR_SPECS[CAR_LIST[this.sel.carIdx]];
    this.$('g-name').textContent = spec.name; this.$('g-blurb').textContent = spec.blurb;
    const lv = LIVERIES[this.sel.livery]; this.$('g-liv').textContent = `${lv.name} · nº ${lv.number}`;
    const stat = (label, v, txt) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div><span>${txt}</span></div>`;
    const top = spec.id === 'gt' ? 0.9 : 0.8, acc = spec.id === 'gt' ? 0.78 : 0.86, hand = spec.id === 'gt' ? 0.7 : 0.9;
    this.$('g-stats').innerHTML = stat('Vel. máxima', top, spec.id === 'gt' ? '205' : '192') + stat('Aceleração', acc, spec.id === 'gt' ? '4.9s' : '4.5s') + stat('Estabilidade', hand, spec.drive) + stat('Peso', spec.mass / 1500, spec.mass + 'kg');
    this.root.querySelectorAll('.sw').forEach((s, i) => s.classList.toggle('sel', i === this.sel.livery));
  }

  // ---------------------------------------------------------------- race UI
  setGrid(list) { this.$('gp-list').innerHTML = list.map(c => `<div class="gp"><b>${c.pos}</b><span>${c.name}${c.isPlayer ? ' (você)' : ''}</span><span style="opacity:.7">${c.car}</span></div>`).join(''); }
  countdown(text, go = false) { const c = this.$('cd'); c.textContent = text; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); c.style.color = go ? '#7dff9a' : '#fff'; }
  toast(msg, ms = 1600) { const t = this.$('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('show'), ms); }
  flash(v) { this.$('flash').style.opacity = v; }

  initMap(track) {
    const c = this.$('h-map'), W = c.width, H = c.height;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < track.N; i += 8) { x0 = Math.min(x0, track.px[i]); x1 = Math.max(x1, track.px[i]); z0 = Math.min(z0, track.pz[i]); z1 = Math.max(z1, track.pz[i]); }
    const pad = 12, sc = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
    const ox = (W - (x1 - x0) * sc) / 2, oz = (H - (z1 - z0) * sc) / 2;
    const base = document.createElement('canvas'); base.width = W; base.height = H; const g = base.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const trace = () => { g.beginPath(); for (let i = 0; i <= track.N; i += 6) { const k = i % track.N; const x = ox + (track.px[k] - x0) * sc, y = oz + (track.pz[k] - z0) * sc; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.closePath(); };
    g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 7; trace(); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3.2; trace(); g.stroke();
    // start line
    g.fillStyle = '#ffc24d'; const sx = ox + (track.px[0] - x0) * sc, sy = oz + (track.pz[0] - z0) * sc; g.fillRect(sx - 3, sy - 7, 6, 14);
    this.map = { base, x0, z0, sc, ox, oz, ctx: c.getContext('2d'), W, H };
  }
  drawMap(cars) {
    const m = this.map; if (!m) return; const g = m.ctx; g.clearRect(0, 0, m.W, m.H); g.drawImage(m.base, 0, 0);
    for (const c of cars) { const x = m.ox + (c.x - m.x0) * m.sc, y = m.oz + (c.z - m.z0) * m.sc; g.fillStyle = c.player ? '#ff8a3d' : 'rgba(255,255,255,.9)'; g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, c.player ? 5 : 3.2, 0, 7); g.fill(); g.stroke(); }
  }
  setHud(d) {
    const $ = this.$;
    $('h-pos').innerHTML = `${d.pos}<small>/${d.n}</small>`;
    $('h-lap').textContent = `Volta ${d.lap}/${d.laps}`;
    $('h-cur').textContent = fmt(d.cur); $('h-best').textContent = 'Melhor ' + fmt(d.best);
    $('h-kmh').textContent = Math.round(d.kmh); $('h-gear').textContent = d.gear; $('h-rpm').style.width = Math.round(d.rpm * 100) + '%';
  }
  setFps(txt) { const f = this.$('fpsbox'); f.textContent = txt; f.style.display = txt ? 'block' : 'none'; }

  showResults(rows, playerId) {
    this.$('r-body').innerHTML = rows.map((r, k) => `<tr class="${r.id === playerId ? 'me' : ''}"><td>${k + 1}</td><td>${r.name}</td><td style="opacity:.75">${r.car}</td><td>${r.finished ? '' : '≈ '}${fmt(r.time)}</td><td>${fmt(r.best)}</td></tr>`).join('');
    this.show('results');
  }
}
