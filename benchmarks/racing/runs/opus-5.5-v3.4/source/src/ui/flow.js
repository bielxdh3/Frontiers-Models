// Screen flow (DOM over the 3D view): Menu -> Garage -> Config -> grid intro ->
// race HUD -> Results, plus Pause and Settings overlays. Keyboard, mouse and
// gamepad navigation with one focus model; UI sounds on every action.
import { CAR_SPECS, LIVERIES } from '../car/specs.js';
import { DIFFICULTY } from '../ai/driver.js';
import { fmtTime } from './hud.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class Flow {
  constructor(game, root) {
    this.G = game; this.root = root; this.stack = []; this.nav = null; this.screen = null;
    this.cfg = { laps: 3, difficulty: 'normal', spec: 'gt', livery: 0 };
    root.addEventListener('pointerdown', () => this.G.audio.start());
  }

  // ---------------------------------------------------------------- generic
  _show(el, items, { back = null, cls = '' } = {}) {
    if (this.screen) this.screen.remove();
    this.screen = el; el.classList.add('screen'); if (cls) el.classList.add(cls);
    this.root.appendChild(el);
    this.nav = { items, i: 0, back };
    items.forEach((it, k) => {
      it.el.addEventListener('mouseenter', () => { if (this.nav && this.nav.items === items && this.nav.i !== k) { this.nav.i = k; this._focus(); this.G.audio.ui('nav'); } });
      it.el.addEventListener('click', (ev) => { this.G.audio.start(); if (this.nav.items !== items) return; this.nav.i = k; this._focus(); if (it.onClick) it.onClick(ev); else if (it.act) { this.G.audio.ui('confirm'); it.act(); } });
    });
    this._focus();
    requestAnimationFrame(() => el.classList.add('in'));
  }
  _overlay(el, items, opts = {}) {
    // modal on top of the current screen (pause / settings during race)
    if (this.modal) this.modal.el.remove(); else this.baseNav = this.nav;
    el.classList.add('screen', 'modal'); this.root.appendChild(el);
    this.modal = { el };
    this.nav = { items, i: 0, back: opts.back || null };
    items.forEach((it, k) => {
      it.el.addEventListener('mouseenter', () => { if (this.nav.items === items && this.nav.i !== k) { this.nav.i = k; this._focus(); this.G.audio.ui('nav'); } });
      it.el.addEventListener('click', (ev) => { if (this.nav.items !== items) return; this.nav.i = k; this._focus(); if (it.onClick) it.onClick(ev); else if (it.act) { this.G.audio.ui('confirm'); it.act(); } });
    });
    this._focus();
    requestAnimationFrame(() => el.classList.add('in'));
  }
  _closeOverlay() { if (!this.modal) return; this.modal.el.remove(); this.modal = null; this.nav = this.baseNav || null; this.baseNav = null; this._focus(); }
  _focus() { if (!this.nav) return; this.nav.items.forEach((it, k) => it.el.classList.toggle('focus', k === this.nav.i)); }
  clear() { if (this.screen) this.screen.remove(); this.screen = null; this.nav = null; if (this.modal) { this.modal.el.remove(); this.modal = null; } this.baseNav = null; }

  /** polled once per frame from the game loop */
  poll(input) {
    if (!this.nav) return;
    const a = (n) => input.action(n);
    const N = this.nav;
    if (a('up')) { N.i = (N.i + N.items.length - 1) % N.items.length; this._focus(); this.G.audio.ui('nav'); }
    else if (a('down')) { N.i = (N.i + 1) % N.items.length; this._focus(); this.G.audio.ui('nav'); }
    const it = N.items[N.i];
    if (a('left') && it && it.left) { it.left(); this.G.audio.ui('nav'); }
    else if (a('right') && it && it.right) { it.right(); this.G.audio.ui('nav'); }
    else if (a('confirm') && it) { if (it.act) { this.G.audio.ui('confirm'); it.act(); } else if (it.right) { it.right(); this.G.audio.ui('nav'); } }
    else if (a('back') && N.back) { this.G.audio.ui('back'); N.back(); }
  }

  _btn(label, act, cls = '') { const el = h('button', 'item ' + cls, `<span>${label}</span>`); return { el, act }; }
  _option(label, values, get, set) {
    const el = h('div', 'item option');
    el.innerHTML = `<span class="lab">${label}</span><span class="val"><i class="arr l">◀</i><b></b><i class="arr r">▶</i></span>`;
    const b = el.querySelector('b');
    const render = () => { const v = get(); const o = values.find((x) => x.v === v) || values[0]; b.textContent = o.t; };
    const step = (d) => { const k = values.findIndex((x) => x.v === get()); const n = values[(k + d + values.length) % values.length]; set(n.v); render(); };
    el.querySelector('.l').addEventListener('click', (e) => { e.stopPropagation(); step(-1); this.G.audio.ui('nav'); });
    el.querySelector('.r').addEventListener('click', (e) => { e.stopPropagation(); step(1); this.G.audio.ui('nav'); });
    render();
    return { el, left: () => step(-1), right: () => step(1), onClick: () => { step(1); this.G.audio.ui('nav'); } };
  }
  _slider(label, get, set) {
    const el = h('div', 'item option slider');
    el.innerHTML = `<span class="lab">${label}</span><span class="val"><span class="bar"><span class="fill"></span></span><b></b></span>`;
    const fill = el.querySelector('.fill'), b = el.querySelector('b');
    const render = () => { const v = get(); fill.style.width = `${Math.round(v * 100)}%`; b.textContent = `${Math.round(v * 100)}`; };
    const step = (d) => { set(Math.max(0, Math.min(1, Math.round((get() + d) * 10) / 10))); render(); };
    el.querySelector('.bar').addEventListener('click', (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); set(Math.max(0, Math.min(1, Math.round(((e.clientX - r.left) / r.width) * 10) / 10))); render(); this.G.audio.ui('nav'); });
    render();
    return { el, left: () => step(-0.1), right: () => step(0.1), onClick: () => {} };
  }
  _hint(html) { return h('div', 'hint', html); }

  // ---------------------------------------------------------------- screens
  menu() {
    const el = h('div', 'menu');
    el.appendChild(h('div', 'brand', `<div class="logo">COSTA<br>DOURADA</div><div class="tag">Circuito do pôr do sol · ${(this.G.world.track.length / 1000).toFixed(2).replace('.', ',')} km · 4 zonas</div>`));
    const list = h('nav', 'list');
    const items = [
      this._btn('Correr', () => this.garage()),
      this._btn('Configurações', () => this.settings(() => this.menu())),
      this._btn('Controles', () => this.controls(() => this.menu())),
    ];
    items.forEach((i) => list.appendChild(i.el));
    el.appendChild(list);
    el.appendChild(this._hint('<kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> confirmar · <kbd>Esc</kbd> voltar · controle: <kbd>A</kbd>/<kbd>B</kbd>'));
    this._show(el, items, {});
    this.G.enterMenu();
  }

  garage() {
    const G = this.G, cfg = this.cfg;
    const el = h('div', 'garage');
    el.appendChild(h('div', 'title', 'Garagem'));
    const card = h('div', 'card');
    const name = h('div', 'carname'), kind = h('div', 'carkind'), stats = h('div', 'stats');
    card.append(name, kind, stats);
    const sw = h('div', 'swatches');
    LIVERIES.forEach((l, k) => { const s = h('span', 'sw'); s.style.background = hex(l.color); s.style.setProperty('--acc', hex(l.accent)); s.title = l.name; s.addEventListener('click', () => { cfg.livery = k; upd(); G.audio.ui('nav'); }); sw.appendChild(s); });
    const livName = h('div', 'livname');
    const render = () => {
      const sp = CAR_SPECS[cfg.spec];
      name.textContent = sp.name; kind.textContent = `${sp.kind} · ${sp.drive === 'rwd' ? 'tração traseira' : 'tração integral'}`;
      const pw = (sp.torquePeak * sp.redline) / 7121 / 1.36; // rough hp
      const bars = [['Potência', Math.min(1, pw / 520), `${Math.round(pw * 1.36)} cv`], ['Peso', 1 - (sp.mass - 1100) / 500, `${sp.mass} kg`], ['Aderência', (sp.gripF + sp.gripR) / 2 / 1.4, ''], ['Rotação máx.', sp.redline / 8000, `${sp.redline} rpm`]];
      stats.innerHTML = bars.map(([l, v, t]) => `<div class="st"><span>${l}</span><i><em style="width:${Math.round(Math.max(0.1, Math.min(1, v)) * 100)}%"></em></i><b>${t}</b></div>`).join('');
      [...sw.children].forEach((c, k) => c.classList.toggle('on', k === cfg.livery));
      livName.textContent = LIVERIES[cfg.livery].name + ' · nº ' + LIVERIES[cfg.livery].number;
    };
    const upd = () => { render(); G.setGarageCar(cfg.spec, cfg.livery); };
    const carOpt = this._option('Carro', Object.values(CAR_SPECS).map((s) => ({ v: s.id, t: s.name })), () => cfg.spec, (v) => { cfg.spec = v; upd(); });
    const livOpt = this._option('Pintura', LIVERIES.map((l, k) => ({ v: k, t: l.name })), () => cfg.livery, (v) => { cfg.livery = v; upd(); });
    const cont = this._btn('Continuar', () => this.config());
    const back = this._btn('Voltar', () => this.menu(), 'ghost');
    const list = h('nav', 'list');
    [carOpt, livOpt].forEach((i) => list.appendChild(i.el));
    list.appendChild(sw); list.appendChild(livName);
    [cont, back].forEach((i) => list.appendChild(i.el));
    card.appendChild(list);
    el.appendChild(card);
    el.appendChild(this._hint('<kbd>◀</kbd><kbd>▶</kbd> trocar · <kbd>Enter</kbd> continuar · <kbd>Esc</kbd> voltar'));
    this._show(el, [carOpt, livOpt, cont, back], { back: () => this.menu() });
    G.enterGarage(cfg.spec, cfg.livery);
    render();
  }

  config() {
    const G = this.G, cfg = this.cfg;
    const el = h('div', 'config');
    el.appendChild(h('div', 'title', 'Corrida'));
    const card = h('div', 'card');
    const list = h('nav', 'list');
    const laps = this._option('Voltas', [{ v: 3, t: '3 voltas' }, { v: 6, t: '6 voltas' }], () => cfg.laps, (v) => { cfg.laps = v; });
    const diff = this._option('Dificuldade', Object.entries(DIFFICULTY).map(([k, d]) => ({ v: k, t: d.name })), () => cfg.difficulty, (v) => { cfg.difficulty = v; });
    const qual = this._option('Qualidade', [{ v: 'alta', t: 'Alta' }, { v: 'baixa', t: 'Baixa' }], () => G.settings.quality, (v) => G.applyQuality(v));
    const go = this._btn('Largar', () => this.startRace(), 'primary');
    const back = this._btn('Voltar', () => this.garage(), 'ghost');
    [laps, diff, qual, go, back].forEach((i) => list.appendChild(i.el));
    card.appendChild(list);
    card.appendChild(h('div', 'note', `${CAR_SPECS[cfg.spec].name} · ${LIVERIES[cfg.livery].name} · 5 adversários`));
    el.appendChild(card);
    el.appendChild(this._hint('<kbd>◀</kbd><kbd>▶</kbd> alterar · <kbd>Enter</kbd> largar · <kbd>Esc</kbd> voltar'));
    this._show(el, [laps, diff, qual, go, back], { back: () => this.garage() });
  }

  startRace() {
    this.clear();
    this.G.startRace({ ...this.cfg });
    this.intro();
  }

  intro() {
    const G = this.G, race = G.race;
    const el = h('div', 'intro');
    const rows = [...race.E].sort((a, b) => a.slot - b.slot).map((e) => `<li class="${e.isPlayer ? 'me' : ''}"><b>${e.slot + 1}</b><i style="background:${hex(e.livery.color)}"></i><span>${e.name}</span><em>${e.spec.name}</em></li>`).join('');
    el.innerHTML = `<div class="lower"><div class="track">COSTA DOURADA <span>${race.cfg.laps} voltas · ${DIFFICULTY[race.cfg.difficulty].name}</span></div><ol>${rows}</ol></div><div class="skip">Enter: pular</div>`;
    const skip = { el: h('div'), act: () => { if (G.race && G.race.state === 'intro') G.race.phaseT = 99; } };
    this._show(el, [skip], {});
  }
  hideIntro() { this.clear(); }

  pause() {
    const G = this.G;
    const el = h('div', 'pause');
    el.appendChild(h('div', 'title', 'Pausa'));
    const card = h('div', 'card'); const list = h('nav', 'list');
    const items = [
      this._btn('Continuar', () => { this._closeOverlay(); G.resume(); }),
      this._btn('Reiniciar', () => { this._closeOverlay(); G.restartRace(); this.intro(); }),
      this._btn('Configurações', () => { this.settingsOverlay(); }),
      this._btn('Menu principal', () => { this._closeOverlay(); G.quitToMenu(); this.menu(); }, 'ghost'),
    ];
    items.forEach((i) => list.appendChild(i.el)); card.appendChild(list); el.appendChild(card);
    this._overlay(el, items, { back: () => { this._closeOverlay(); G.resume(); } });
  }

  _settingsItems(onBack) {
    const G = this.G, A = G.audio;
    const qual = this._option('Qualidade gráfica', [{ v: 'alta', t: 'Alta' }, { v: 'baixa', t: 'Baixa' }], () => G.settings.quality, (v) => G.applyQuality(v));
    const vm = this._slider('Volume geral', () => A.settings.master, (v) => { A.setVolumes({ master: v }); G.saveSettings(); });
    const ve = this._slider('Efeitos', () => A.settings.effects, (v) => { A.setVolumes({ effects: v }); G.saveSettings(); });
    const vmu = this._slider('Música', () => A.settings.music, (v) => { A.setVolumes({ music: v }); G.saveSettings(); });
    const ctl = this._btn('Controles', () => this.controls(onBack ? () => this.settings(onBack) : null, !onBack));
    const back = this._btn('Voltar', () => (onBack ? onBack() : (this._closeOverlay(), this.pause())), 'ghost');
    return [qual, vm, ve, vmu, ctl, back];
  }
  settings(onBack) {
    const el = h('div', 'settings'); el.appendChild(h('div', 'title', 'Configurações'));
    const card = h('div', 'card'); const list = h('nav', 'list');
    const items = this._settingsItems(onBack);
    items.forEach((i) => list.appendChild(i.el)); card.appendChild(list); el.appendChild(card);
    el.appendChild(this._hint('<kbd>◀</kbd><kbd>▶</kbd> ajustar · <kbd>Esc</kbd> voltar'));
    this._show(el, items, { back: onBack });
  }
  settingsOverlay() {
    const el = h('div', 'settings'); el.appendChild(h('div', 'title', 'Configurações'));
    const card = h('div', 'card'); const list = h('nav', 'list');
    const items = this._settingsItems(null);
    items.forEach((i) => list.appendChild(i.el)); card.appendChild(list); el.appendChild(card);
    this._overlay(el, items, { back: () => { this._closeOverlay(); this.pause(); } });
  }
  controls(onBack, overlay = false) {
    const el = h('div', 'controls'); el.appendChild(h('div', 'title', 'Controles'));
    const card = h('div', 'card');
    const rows = [['Acelerar', 'W / ↑', 'RT'], ['Frear / ré', 'S / ↓', 'LT'], ['Esterçar', 'A D / ← →', 'Analógico esquerdo'], ['Freio de mão', 'Espaço', 'A'], ['Câmera (perseguição / capô)', 'C', 'Y'], ['Pausa', 'Esc / P', 'Start'], ['Reposicionar carro', 'R', 'Back']];
    card.innerHTML = `<table class="ctl"><tr><th></th><th>Teclado</th><th>Controle</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td><kbd>${r[1]}</kbd></td><td><kbd>${r[2]}</kbd></td></tr>`).join('')}</table>`;
    const back = this._btn('Voltar', () => { if (overlay) { this._closeOverlay(); this.settingsOverlay(); } else onBack(); }, 'ghost');
    card.appendChild(back.el); el.appendChild(card);
    if (overlay) this._overlay(el, [back], { back: back.act }); else this._show(el, [back], { back: back.act });
  }

  results() {
    const G = this.G, race = G.race;
    const el = h('div', 'results'); el.appendChild(h('div', 'title', 'Resultado'));
    const card = h('div', 'card wide');
    const table = h('table', 'res');
    card.appendChild(table);
    const list = h('nav', 'list row');
    const again = this._btn('Correr de novo', () => { G.restartRace(); this.intro(); }, 'primary');
    const menu = this._btn('Menu', () => { G.quitToMenu(); this.menu(); }, 'ghost');
    list.append(again.el, menu.el); card.appendChild(list);
    el.appendChild(card);
    const render = () => {
      if (!G.race) return;
      const rows = race.results();
      const win = rows[0] ? rows[0].time : 0;
      table.innerHTML = `<tr><th>Pos</th><th>Piloto</th><th>Carro</th><th>Tempo total</th><th>Dif.</th><th>Melhor volta</th></tr>` + rows.map((r, k) => `<tr class="${r.isPlayer ? 'me' : ''}"><td>${k + 1}</td><td><i style="background:${hex(r.livery.color)}"></i>${r.name}</td><td>${r.car}</td><td>${r.projected ? '≈ ' : ''}${fmtTime(r.time)}</td><td>${k ? '+' + (r.time - win).toFixed(3) : '—'}</td><td>${fmtTime(r.best)}</td></tr>`).join('');
    };
    render();
    this._resTimer = setInterval(() => { if (this.screen !== el) { clearInterval(this._resTimer); return; } render(); }, 500);
    this._show(el, [again, menu], {});
  }
}
