import { ACTIVITIES, BEYOND_STAGES, CINEMATIC, COMPARE_PRESETS, EVENTS, GLOSSARY, MISSIONS, TOURS } from './content.js';
import { BODY_BY_ID, BODIES, DATA_DATES, JPL_ELEMENTS, MOON_MU, SIMPLE_ORBITS, getBody } from './catalog.js';
import { bodyAu, parentRelativeAu, systemAt } from './ephemeris.js';
import { accuracyNow, commit, emit, integrate, state, subscribe, DEFAULT_RATE } from './state.js';
import {
  AU_KM,
  DAY_SECONDS,
  DEMO_MONTH_SECONDS,
  JD_PRIMARY_END,
  JD_PRIMARY_START,
  SESSION_JD,
  WEEK_SECONDS,
  addCalendarMonths,
  angularSeparation,
  approximateSolarDay,
  axisPosition,
  clampJd,
  daylightHours,
  earthIfSize,
  ellipseApsisKm,
  formatDuration,
  formatJdUtc,
  formatNumber,
  formatSci,
  geometricDistanceKm,
  jplElementsAt,
  keplerPeriodSeconds,
  len,
  lightTimeSeconds,
  lunarPhase,
  parseRate,
  phaseIdFromElongation,
  signedRateToSlider,
  sliderToSignedRate,
  sphereGravity,
  surfaceSeparationKm,
  unixMsToJd,
  visViva,
  weightNewtons,
} from './science.js';
import { packState, saveLocal, sceneShare, storageAvailable, validateBundle } from './persist.js';

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`);
export const bi = (pt, en) => (state.lang === 'en' ? en : pt);
const tx = (v) => (!v ? '' : v[state.lang] || v.pt || '');
const PHASE = {
  new: ['Lua nova', 'New moon'],
  'waxing-crescent': ['Crescente', 'Waxing crescent'],
  'first-quarter': ['Quarto crescente', 'First quarter'],
  'waxing-gibbous': ['Gibosa crescente', 'Waxing gibbous'],
  full: ['Lua cheia', 'Full moon'],
  'waning-gibbous': ['Gibosa minguante', 'Waning gibbous'],
  'third-quarter': ['Quarto minguante', 'Third quarter'],
  'waning-crescent': ['Minguante', 'Waning crescent'],
};

let world;
let root;
let audioCtx;
let osc;
let saveTimer = 0;
let labelNodes = new Map();
let lastInspector = '';
let lastNav = '';
let lastStage = '';
let hiddenAt = 0;

export function mount(uiRoot, worldApi) {
  world = worldApi;
  root = uiRoot;
  root.innerHTML = shell();
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('pointerdown', onScrubDown);
  root.addEventListener('pointerup', onScrubUp);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  $('#scene')?.addEventListener('focus', () => { state.cameraKeys = true; });
  $('#scene')?.addEventListener('blur', () => { state.cameraKeys = false; });
  subscribe(() => {
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLocal(), 500);
  });
  applyPrefs();
  render();
  return { onSelect, onFocus, onCameraGrab, announce, start };
}

function shell() {
  return `
  <a class="skip" href="#navigator">${bi('Ir ao navegador', 'Skip to navigator')}</a>
  <header id="topbar" class="panel"></header>
  <nav id="navigator" class="panel" aria-label="${bi('Navegador de objetos', 'Object navigator')}"></nav>
  <aside id="inspector" class="panel hidden" aria-label="${bi('Inspetor', 'Inspector')}"></aside>
  <footer id="timebar" class="panel"></footer>
  <canvas id="minimap" width="148" height="148" aria-label="${bi('Mapa de orientação', 'Orientation map')}"></canvas>
  <div id="welcome" class="panel"></div>
  <div id="toast" class="panel hidden"></div>
  <div id="menu" class="panel hidden"></div>
  <div id="palette" class="panel hidden" role="dialog"></div>
  <div id="stage" class="panel hidden"></div>
  <div id="tourbar" class="panel hidden"></div>
  <div id="photobar" class="panel hidden"></div>
  <div id="check" class="panel"></div>
  <button id="restore" class="btn primary hidden" data-act="distraction">${bi('Mostrar interface', 'Show interface')}</button>
  <div id="live" class="sr" aria-live="polite"></div>`;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || !root.contains(btn)) return;
  act(btn.dataset.act, btn.dataset.arg || '');
}

function act(name, arg) {
  if (name === 'lang') return commit(() => { state.lang = state.lang === 'pt' ? 'en' : 'pt'; document.documentElement.lang = state.lang === 'en' ? 'en' : 'pt-BR'; });
  if (name === 'explore') {
    if (state.tool || state.photo) return closeTool();
    return commit(() => { state.menu = null; state.helpOpen = false; state.message = null; });
  }
  if (name === 'close-menu') return commit(() => { state.menu = null; state.paletteOpen = false; state.helpOpen = false; state.message = null; });
  if (name === 'menu') return commit(() => { state.menu = state.menu === arg ? null : arg; state.paletteOpen = false; });
  if (name === 'select') return onSelect(arg);
  if (name === 'focus') return onFocus(arg || state.selectedId);
  if (name === 'follow') return toggleFollow(arg || state.selectedId);
  if (name === 'overview') { world?.overview(state.prefs.reducedMotion); commit(() => { state.followId = null; }); return; }
  if (name === 'system') { if (state.selectedId) { state.layers.moons = true; world?.frameSystem(state.selectedId); emit(); } return; }
  if (name === 'play') return togglePlay();
  if (name === 'reverse') return commit(() => { state.direction *= -1; state.checklist.reverse = true; });
  if (name === 'rate') return setSigned(Number(arg));
  if (name === 'reset-sim') return commit(() => { state.jd = SESSION_JD; state.playing = true; state.direction = 1; state.rate = DEFAULT_RATE; state.resumeRate = DEFAULT_RATE; state.allowExtended = false; state.boundary = null; });
  if (name === 'reset-view') { world?.overview(state.prefs.reducedMotion); announce(bi('Só a câmera foi reposicionada.', 'Only the camera was reset.')); return; }
  if (name === 'now') return goJd(unixMsToJd(Date.now()));
  if (name === 'step') return step(Number(arg) || 1);
  if (name === 'orbit-complete') return completeOrbit();
  if (name === 'scale') return commit(() => {
    state.scaleMode = state.scaleMode === 'exploration' ? 'relative' : 'exploration';
    state.checklist.scale = true;
    if (state.scaleMode === 'relative') state.message = bi('Escala relativa: distâncias lineares. Os discos ficam pequenos de propósito. Use marcadores, enquadramento ou o laboratório.', 'Relative scale: linear distances. Disks are small on purpose. Use markers, framing, or the laboratory.');
  });
  if (name === 'labels') return commit(() => { state.labels = nextMode(state.labels, ['major', 'system', 'selected', 'favorites', 'none']); });
  if (name === 'orbits') return commit(() => { state.orbits = nextMode(state.orbits, ['all', 'selected', 'system', 'none']); });
  if (name === 'tool') return openTool(arg);
  if (name === 'close-tool') return closeTool();
  if (name === 'compare-add') return commit(() => { if (state.compareIds.length < 4 && arg && !state.compareIds.includes(arg)) state.compareIds.push(arg); state.checklist.compare = state.compareIds.length >= 2; });
  if (name === 'compare-del') return commit(() => { state.compareIds = state.compareIds.filter((id) => id !== arg); });
  if (name === 'compare-preset') return commit(() => { state.compareIds = arg.split(','); state.compareRef = state.compareIds[0]; state.checklist.compare = true; });
  if (name === 'fav') return commit(() => { state.favorites = state.favorites.includes(arg) ? state.favorites.filter((id) => id !== arg) : [...state.favorites, arg]; });
  if (name === 'welcome') return commit(() => { state.onboarding.welcome = false; state.onboarding.hints.camera = false; });
  if (name === 'tour') return startTour(arg);
  if (name === 'tour-pause') return commit(() => { if (state.tour) state.tour.status = state.tour.status === 'playing' ? 'paused' : 'playing'; });
  if (name === 'tour-next') return moveTour(1);
  if (name === 'tour-prev') return moveTour(-1);
  if (name === 'tour-restart') return commit(() => { if (state.tour) { state.tour.status = 'playing'; applyTourStop(); } });
  if (name === 'tour-exit') return exitTour();
  if (name === 'tour-jump') return commit(() => { if (state.tour) { state.tour.index = Number(arg); state.tour.status = 'paused'; applyTourStop(); } });
  if (name === 'activity') return startActivity(arg);
  if (name === 'activity-answer') return answerActivity(arg);
  if (name === 'distraction') return commit(() => { state.distractionFree = !state.distractionFree; });
  if (name === 'palette') return commit(() => { state.paletteOpen = !state.paletteOpen; state.commandQuery = ''; });
  if (name === 'help') return commit(() => { state.helpOpen = !state.helpOpen; state.menu = state.helpOpen ? 'help' : null; });
  if (name === 'tutorial') return commit(() => { state.onboarding.welcome = true; state.onboarding.hints = { camera: false, select: false, time: false, scale: false }; });
  if (name === 'bookmark') return addBookmark();
  if (name === 'goto-bookmark') return gotoBookmark(arg);
  if (name === 'del-bookmark') return commit(() => { state.bookmarks = state.bookmarks.filter((b) => b.id !== arg); });
  if (name === 'save-view') return saveView();
  if (name === 'load-view') return loadView(arg);
  if (name === 'del-view') return commit(() => { state.viewpoints = state.viewpoints.filter((v) => v.id !== arg); });
  if (name === 'save-note') return saveNote();
  if (name === 'del-note') return commit(() => { state.journal = state.journal.filter((n) => n.id !== arg); });
  if (name === 'ask-clear') return commit(() => { state.confirm = arg; });
  if (name === 'do-clear') return doClear(arg);
  if (name === 'cancel-confirm') return commit(() => { state.confirm = null; state.importPreview = null; });
  if (name === 'event') return openEvent(arg);
  if (name === 'extend') return commit(() => { state.allowExtended = true; state.boundary = null; state.message = bi('Modelo estendido ativo, com menor precisão, até os limites de 3000 a.C. e 3000 d.C.', 'Extended model on, with lower accuracy, out to 3000 BC and 3000 AD.'); });
  if (name === 'glossary') return commit(() => { state.tool = 'glossary'; state.glossaryId = arg || 'about-model'; state.menu = null; });
  if (name === 'mission') return openMission(arg);
  if (name === 'photo') return enterPhoto();
  if (name === 'shoot') return shoot();
  if (name === 'record') return toggleRecord();
  if (name === 'share') return shareScene();
  if (name === 'export') return download(JSON.stringify(packState(state.includeJournal !== false), null, 2), 'observatorio.json', 'application/json');
  if (name === 'import-apply') return applyImport(arg === 'replace');
  if (name === 'preset') return applyPreset(arg);
  if (name === 'reset-prefs') return commit(() => { state.prefs = { units: 'metric', uiScale: 'md', panelOpacity: 0.88, reducedMotion: false, highContrast: false, background: 0.85, ambient: false, uiSound: false, narration: false, muted: true, catchUp: false, simplified: false }; state.message = bi('Preferências visuais restauradas. Notas e marcadores continuam.', 'Visual preferences restored. Notes and bookmarks remain.'); });
  if (name === 'measure') return setMeasure(arg);
  if (name === 'pulse') return commit(() => { state.lightPulse = !state.lightPulse; });
  if (name === 'layer' && arg === 'includeSun') return commit(() => { state.labs.scale.includeSun = !state.labs.scale.includeSun; state.stageNonce = (state.stageNonce || 0) + 1; });
  if (name === 'layer') return commit(() => { state.layers[arg] = !state.layers[arg]; });
  if (name === 'lab-view') return commit(() => { state.labs.scale.view = arg; if (arg === 'distances') state.labs.scale.log = !state.labs.scale.log; state.stageNonce = (state.stageNonce || 0) + 1; });
  if (name === 'moon-preset') return commit(() => { state.labs.moon.elongation = Number(arg); if (Number(arg) === 0 || Number(arg) === 180) state.labs.moon.inclination = 0; state.stageNonce = (state.stageNonce || 0) + 1; });
  if (name === 'frame') return commit(() => { state.frame = state.frame === 'sun' ? (state.selectedId || 'earth') : 'sun'; state.followId = null; });
  if (name === 'venus') return commit(() => { state.venusRadar = !state.venusRadar; });
  if (name === 'tidal') return commit(() => { state.tidalOverlay = !state.tidalOverlay; });
  if (name === 'beyond') return commit(() => { state.tool = 'beyond'; state.labs.beyond.stage = Number(arg) || 0; state.menu = null; });
  if (name === 'lab-reset') return resetLab(arg);
  if (name === 'kepler-run') return commit(() => { state.labs.kepler.running = !state.labs.kepler.running; });
  if (name === 'kepler-reset') return commit(() => { state.labs.kepler.e = 0.2; state.labs.kepler.aKm = AU_KM; state.labs.kepler.running = false; state.labs.kepler.angle = 0; });
  if (name === 'kepler-save') return saveKepler();
  if (name === 'seasons-reveal') return commit(() => { state.labs.seasons.revealed = true; });
  if (name === 'check-hide') return commit(() => { state.checklistOpen = !state.checklistOpen; });
  if (name === 'nav') return commit(() => { state.navigatorOpen = !state.navigatorOpen; });
  if (name === 'inspector-collapse') return commit(() => { state.inspectorCollapsed = !state.inspectorCollapsed; });
  if (name === 'map') return commit(() => { state.mapOpen = !state.mapOpen; });
  if (name === 'filter') return commit(() => { state.filter = arg; });
  if (name === 'sort') return commit(() => { state.sort = arg; });
  if (name === 'pan') return commit(() => { state.panMode = !state.panMode; });
  if (name === 'units') return commit(() => { state.prefs.units = state.prefs.units === 'metric' ? 'familiar' : 'metric'; });
  if (name === 'presentation') return commit(() => { state.presentation = state.presentation === 'natural' ? 'enhanced' : 'natural'; });
  if (name === 'month') return goJd(addCalendarMonths(state.jd, Number(arg)));
  if (name === 'copy-measure') return copyMeasure();
  if (name === 'csv') return exportCsv();
  if (name === 'fullscreen') return fullscreen();
  if (name === 'hint-dismiss') return commit(() => { state.onboarding.hints[arg] = true; });
  return null;
}

function nextMode(current, list) {
  return list[(list.indexOf(current) + 1) % list.length];
}

export function onSelect(id, extras = []) {
  if (!getBody(id)) return;
  if (extras.length) {
    commit(() => { state.disambiguate = [id, ...extras]; });
    return;
  }
  commit(() => {
    state.selectedId = id;
    state.disambiguate = null;
    state.inspectorOpen = true;
    state.inspectorTab = 'overview';
    state.visited = state.visited.includes(id) ? state.visited : [...state.visited, id];
    state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 8);
    const type = getBody(id)?.type;
    if (type === 'planet' || type === 'dwarf' || type === 'moon') state.checklist.planet = true;
    if (type === 'moon') state.checklist.moon = true;
    if (!state.onboarding.hints.select) state.onboarding.hints.select = true;
    if (state.tour?.status === 'playing') state.tour.status = 'suspended';
  });
  announce(`${bi('Selecionado', 'Selected')}: ${tx(getBody(id).name)}`);
}

export function onFocus(id) {
  if (!id || !world) return;
  onSelect(id, []);
  const framing = getBody(id)?.rings && !getBody(id).rings.faint ? 'rings' : 'focus';
  world.focus(id, framing, state.prefs.reducedMotion);
}

function toggleFollow(id) {
  if (!id) return;
  commit(() => {
    state.followId = state.followId === id ? null : id;
    if (getBody(id)?.type === 'moon') state.checklist.moon = true;
  });
  if (state.followId) world?.focus(id, 'focus', state.prefs.reducedMotion);
}

export function onCameraGrab() {
  if (state.tour?.status === 'playing') commit(() => { state.tour.status = 'suspended'; });
}

function togglePlay() {
  commit(() => {
    if (state.playing) state.playing = false;
    else {
      if (!(state.rate > 0)) state.rate = state.resumeRate || DEFAULT_RATE;
      state.playing = true;
    }
  });
}

function setSigned(value) {
  if (!Number.isFinite(value)) return;
  commit(() => {
    if (value === 0) {
      if (state.rate > 0) state.resumeRate = state.rate;
      state.playing = false;
      return;
    }
    state.direction = value < 0 ? -1 : 1;
    state.rate = Math.min(5e7, Math.abs(value));
    state.resumeRate = state.rate;
    state.playing = true;
  });
}

function goJd(jd) {
  const gate = clampJd(jd, state.allowExtended);
  commit(() => {
    if (gate.hit && !state.allowExtended && (jd < JD_PRIMARY_START || jd > JD_PRIMARY_END)) {
      state.pendingJd = jd;
      state.boundary = gate;
      state.message = bi('Fora do ajuste principal 1800–2050. Continuar usa o modelo estendido, menos preciso.', 'Outside the primary 1800–2050 fit. Continuing uses the less precise extended model.');
      return;
    }
    if (gate.hit && state.allowExtended) {
      state.jd = gate.jd;
      state.playing = false;
      state.boundary = gate;
      return;
    }
    state.jd = gate.jd;
    state.boundary = null;
  });
}

function step(sign) {
  const body = getBody(state.selectedId);
  const sizes = { minute: 60, hour: 3600, day: DAY_SECONDS, week: WEEK_SECONDS };
  let seconds = sizes[state.stepId] || DAY_SECONDS;
  if (state.stepId === 'orbit' && body?.orbitalYears) seconds = body.orbitalYears * 365.25 * DAY_SECONDS;
  if (state.stepId === 'spin' && body?.rotationDays) seconds = Math.abs(body.rotationDays) * DAY_SECONDS;
  goJd(state.jd + (sign * seconds) / DAY_SECONDS);
  commit(() => { state.playing = false; });
}

function completeOrbit() {
  const body = getBody(state.selectedId);
  if (!body?.orbitalYears && !body?.satellitePeriodDays) {
    commit(() => { state.message = bi('Selecione um corpo com período orbital.', 'Select a body with an orbital period.'); });
    return;
  }
  const days = body.orbitalYears ? body.orbitalYears * 365.25 : body.satellitePeriodDays;
  commit(() => {
    state.jd += days;
    state.playing = false;
    state.didCompleteOrbit = body.id;
    state.message = bi(`Relógio avançado um período de ${tx(body.name)}. Os outros corpos também se moveram.`, `Clock advanced one period of ${tx(body.name)}. The other bodies moved too.`);
  });
}

function openTool(name) {
  commit(() => {
    const pausing = ['scale-lab', 'seasons', 'moon-lab', 'kepler'].includes(name);
    if (pausing && !state.toolSnapshot) state.toolSnapshot = { playing: state.playing, view: world?.getView() };
    if (pausing) state.playing = false;
    state.tool = name;
    state.menu = null;
    state.helpOpen = false;
    if (name === 'compare') state.compareFreezeJd = state.jd;
    if (name === 'measure' && state.selectedId) state.measure = { a: state.selectedId, b: state.measure?.b || 'sun', live: true };
    if (name === 'glossary') state.glossaryId = state.glossaryId || 'about-model';
  });
}

function closeTool() {
  const snap = state.toolSnapshot;
  const resumePhoto = state.photo ? state.photoFreezeWasPlaying : null;
  commit(() => {
    state.tool = null;
    state.photo = false;
    state.toolSnapshot = null;
    if (resumePhoto != null) state.playing = resumePhoto;
    else if (snap) state.playing = snap.playing;
  });
  if (snap?.view) world?.setView(snap.view);
}

function startTour(id) {
  const tour = TOURS.find((t) => t.id === id) || TOURS[0];
  commit(() => {
    state.tour = {
      id: tour.id,
      index: 0,
      status: 'playing',
      auto: true,
      snapshot: { labels: state.labels, orbits: state.orbits, scaleMode: state.scaleMode, rate: state.rate, playing: state.playing },
      overrides: {},
    };
    state.menu = null;
    state.tool = null;
    applyTourStop();
  });
}

function applyTourStop() {
  const tour = TOURS.find((t) => t.id === state.tour?.id);
  const stop = tour?.stops[state.tour.index];
  if (!stop) return;
  state.selectedId = stop.target;
  if (stop.scale) state.scaleMode = stop.scale;
  if (stop.target === 'asteroid-belt') state.layers.asteroids = true;
  const framing = stop.framing || 'focus';
  if (framing === 'overview') world?.overview(state.prefs.reducedMotion);
  else if (framing === 'system') world?.frameSystem(stop.target);
  else world?.focus(stop.target, framing === 'rings' ? 'rings' : framing === 'close' ? 'close' : 'focus', state.prefs.reducedMotion);
  if (state.prefs.narration && !state.prefs.muted) speak(tx(stop.text));
  const ms = 4200 + tx(stop.text).length * 42;
  state.tour.until = performance.now() + ms;
}

function moveTour(dir) {
  if (!state.tour) return;
  const tour = TOURS.find((t) => t.id === state.tour.id);
  commit(() => {
    state.tour.index = Math.min(tour.stops.length - 1, Math.max(0, state.tour.index + dir));
    state.tour.status = 'playing';
    applyTourStop();
  });
}

function exitTour() {
  const snap = state.tour?.snapshot;
  window.speechSynthesis?.cancel();
  commit(() => {
    if (snap && !state.tour.overrides.labels) state.labels = snap.labels;
    if (snap && !state.tour.overrides.orbits) state.orbits = snap.orbits;
    if (snap && !state.tour.overrides.scale) state.scaleMode = snap.scaleMode;
    if (snap) { state.rate = snap.rate; state.playing = snap.playing; }
    if (state.tour) state.tourProgress[state.tour.id] = Math.max(state.tourProgress[state.tour.id] || 0, state.tour.index + 1);
    state.tour = null;
  });
}

function tourTick(now) {
  if (!state.tour || state.tour.status !== 'playing' || !state.tour.auto) return;
  if (now < (state.tour.until || 0)) return;
  const tour = TOURS.find((t) => t.id === state.tour.id);
  if (state.tour.index >= tour.stops.length - 1) {
    commit(() => { state.tour.status = 'paused'; state.message = bi('Passeio concluído. Você pode sair ou rever uma parada.', 'Tour finished. You can exit or revisit a stop.'); });
    return;
  }
  moveTour(1);
}

function startActivity(id) {
  const activity = ACTIVITIES.find((a) => a.id === id);
  if (!activity) return;
  commit(() => {
    state.tool = 'activity';
    state.activityRun = { id, status: 'open' };
    state.menu = null;
    if (activity.type === 'select') state.selectedId = null;
    if (activity.type === 'moon-phase') { state.tool = 'moon-lab'; state.labs.moon.elongation = 20; }
    if (activity.type === 'tilt-zero') { state.tool = 'seasons'; state.labs.seasons.tilt = 23.44; state.labs.seasons.revealed = false; }
    if (activity.type === 'measure') { state.tool = 'measure'; state.measure = null; }
    if (activity.type === 'moon-count') { state.selectedId = activity.body; state.inspectorOpen = true; state.inspectorTab = 'moons'; }
    if (activity.body) state.selectedId = activity.body;
  });
}

function answerActivity(answer) {
  const run = state.activityRun;
  const activity = ACTIVITIES.find((a) => a.id === run?.id);
  if (!activity) return;
  let ok = false;
  if (activity.type === 'select' || activity.type === 'complete-orbit') ok = state.selectedId === activity.target || state.didCompleteOrbit === activity.target;
  if (activity.type === 'choice-body') ok = state.selectedId === activity.body && answer === activity.answer;
  if (activity.type === 'moon-phase') ok = Math.abs(state.labs.moon.elongation - activity.target) < 12;
  if (activity.type === 'tilt-zero') ok = Math.abs(state.labs.seasons.tilt) < 0.6 && state.labs.seasons.revealed;
  if (activity.type === 'measure') ok = state.measure && [state.measure.a, state.measure.b].sort().join() === activity.targets.slice().sort().join();
  if (activity.type === 'scale') ok = state.scaleMode === activity.mode && answer === activity.answer;
  if (activity.type === 'moon-count') ok = state.selectedId === activity.body && state.inspectorTab === 'moons' && Number(answer) === (getBody(activity.body)?.moons.length || 0);
  if (activity.type === 'complete-orbit') ok = state.didCompleteOrbit === activity.target;
  commit(() => {
    state.activityProgress[activity.id] = { status: ok ? 'done' : 'retry', answer };
    state.activityRun = { id: activity.id, status: ok ? 'done' : 'retry' };
    if (ok) state.message = bi('Certo. A explicação está na atividade.', 'Correct. The explanation is in the activity.');
    else state.message = bi('Ainda não. A explicação mostra o que o modelo está fazendo.', 'Not yet. The explanation shows what the model is doing.');
  });
}

function addBookmark() {
  const name = $('#bookmark-name')?.value?.trim();
  if (!name) return;
  commit(() => {
    state.bookmarks.push({ id: uid(), name, jd: state.jd, scaleMode: state.scaleMode, bodyId: state.selectedId });
  });
}

function gotoBookmark(id) {
  const mark = state.bookmarks.find((b) => b.id === id) || EVENTS.find((e) => e.id === id);
  if (!mark) return;
  if (mark.scaleMode) state.scaleMode = mark.scaleMode;
  if (mark.body || mark.bodyId) onSelect(mark.body || mark.bodyId, []);
  goJd(mark.jd);
}

function saveView() {
  const title = $('#view-name')?.value?.trim() || bi('Vista', 'View');
  const cam = world?.getView() || { theta: 0, phi: 1, radius: 10, targetId: state.selectedId || 'sun' };
  commit(() => {
    state.viewpoints.push({
      id: uid(), title, targetId: cam.targetId || state.selectedId || 'sun',
      theta: cam.theta, phi: cam.phi, radius: cam.radius, scaleMode: state.scaleMode,
      restoreDate: $('#view-date')?.checked || false, jd: state.jd, labels: state.labels, orbits: state.orbits,
    });
  });
}

function loadView(id) {
  const view = state.viewpoints.find((v) => v.id === id);
  if (!view) return;
  commit(() => {
    state.scaleMode = view.scaleMode;
    state.labels = view.labels || state.labels;
    state.orbits = view.orbits || state.orbits;
    if (view.restoreDate && view.jd) state.jd = view.jd;
    state.selectedId = view.targetId;
  });
  world?.setView(view);
  world?.focus(view.targetId, 'focus', state.prefs.reducedMotion);
}

function saveNote() {
  const text = state.journalDraft.trim();
  if (!text) return;
  commit(() => {
    state.journal.push({ id: uid(), text, bodyId: state.selectedId, jd: state.jd, measurement: state.measure ? measureText() : '' });
    state.journalDraft = '';
  });
}

function doClear(kind) {
  commit(() => {
    if (kind === 'journal') state.journal = [];
    if (kind === 'views') state.viewpoints = [];
    if (kind === 'bookmarks') state.bookmarks = [];
    if (kind === 'all') { state.journal = []; state.viewpoints = []; state.bookmarks = []; state.favorites = []; state.activityProgress = {}; }
    state.confirm = null;
  });
}

function openEvent(id) {
  const event = EVENTS.find((item) => item.id === id);
  if (!event) return;
  commit(() => { state.message = `${tx(event.title)}. ${tx(event.note)}`; });
  if (event.body) onSelect(event.body, []);
  goJd(event.jd);
}

function openMission(id) {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) return;
  commit(() => { state.tool = 'missions'; state.missionId = id; state.message = bi('Rota esquemática. Não é rastreamento ao vivo.', 'Schematic route. Not live tracking.'); });
  if (mission.destinations?.[0]) onSelect(mission.destinations[0], []);
}

function enterPhoto() {
  commit(() => {
    state.photo = true;
    state.photoFreezeWasPlaying = state.playing;
    state.photoFov = state.photoFov || 48;
    state.photoExposure = state.photoExposure || 1;
    state.menu = null;
  });
}

function shoot() {
  if (!world) return;
  const shot = world.capture(state.photoScale || 1);
  const image = composeShot(shot.url);
  const box = $('#shot-preview');
  if (box) box.innerHTML = `<img alt="${bi('Fotografia composta', 'Composed photograph')}" src="${image}" style="max-width:100%"/>`;
  const a = document.createElement('a');
  a.href = image;
  a.download = `observatorio-${state.jd.toFixed(2)}.png`;
  a.click();
  announce(bi('Imagem pronta para baixar.', 'Image ready to download.'));
}

function composeShot(url) {
  return url;
}

function toggleRecord() {
  const canvas = $('#scene');
  if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') {
    commit(() => { state.message = bi('Gravação de vídeo não está disponível neste navegador.', 'Video recording is not available in this browser.'); });
    return;
  }
  if (state.recording) {
    state.recorder?.stop();
    return;
  }
  const rec = new MediaRecorder(canvas.captureStream(30));
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.onstop = () => {
    state.recording = false;
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'observatorio.webm';
    a.click();
    emit();
  };
  rec.start();
  state.recorder = rec;
  state.recording = true;
  setTimeout(() => { if (state.recording) rec.stop(); }, 20000);
  emit();
}

async function shareScene() {
  const payload = JSON.stringify(sceneShare(), null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    commit(() => { state.message = bi('Configuração da cena copiada. Não é um link público permanente.', 'Scene configuration copied. It is not a permanent public link.'); });
  } catch {
    commit(() => { state.message = payload; });
  }
}

function applyImport(replace) {
  if (!state.importPreview?.ok) return;
  commit(() => {
    applyImported(state.importPreview.data, replace);
    state.importPreview = null;
    state.message = bi('Importação aplicada. Itens inválidos foram ignorados.', 'Import applied. Invalid items were ignored.');
  });
}

function applyImported(data, replace) {
  if (replace) {
    state.favorites = data.favorites || [];
    state.viewpoints = data.viewpoints || [];
    state.bookmarks = data.bookmarks || [];
    state.journal = data.journal || [];
  } else {
    state.favorites = [...new Set([...state.favorites, ...(data.favorites || [])])];
    state.viewpoints = state.viewpoints.concat(data.viewpoints || []);
    state.bookmarks = state.bookmarks.concat(data.bookmarks || []);
    state.journal = state.journal.concat(data.journal || []);
  }
}

function applyPreset(name) {
  commit(() => {
    if (name === 'cinematic') { state.presentation = 'enhanced'; state.labels = 'major'; state.orbits = 'selected'; state.prefs.background = 1; }
    if (name === 'classroom') { state.presentation = 'natural'; state.labels = 'major'; state.orbits = 'all'; state.prefs.background = 0.25; state.prefs.highContrast = true; }
    if (name === 'study') { state.presentation = 'natural'; state.labels = 'system'; state.orbits = 'system'; state.prefs.background = 0.55; }
    if (name === 'low') { state.quality = 'low'; state.prefs.background = 0.4; state.layers.asteroids = false; state.trails = false; }
    state.prefs.preset = name;
  });
}

function setMeasure(which) {
  const id = state.selectedId;
  if (!id) return;
  commit(() => {
    const current = state.measure || { a: id, b: 'sun', live: true };
    current[which] = id;
    state.measure = { ...current };
    state.measureHistory = [...state.measureHistory, { ...current, jd: state.jd, text: measureText() }].slice(-12);
  });
}

function saveKepler() {
  const k = state.labs.kepler;
  state.keplerPresets = state.keplerPresets || [];
  commit(() => { state.keplerPresets.push({ ...k, id: uid(), hypothetical: true }); });
}

function resetLab(name) {
  commit(() => {
    if (name === 'seasons') state.labs.seasons = { body: 'earth', tilt: 23.44, orbit: 0, latitude: -23, revealed: false, experimental: false };
    if (name === 'moon') state.labs.moon = { elongation: 90, inclination: 5.145, node: 0, useSim: false };
    if (name === 'scale') state.labs.scale = { view: 'sizes', log: false, includeSun: true, earthMm: 10, ids: ['sun', 'earth', 'jupiter', 'saturn'] };
  });
}

function copyMeasure() {
  const text = measureText();
  navigator.clipboard?.writeText(text).then(() => announce(bi('Medida copiada.', 'Measurement copied.')), () => announce(text));
}

function exportCsv() {
  const rows = [['a', 'b', 'jd', 'text'], ...state.measureHistory.map((m) => [m.a, m.b, m.jd, m.text])];
  download(rows.map((r) => r.join(',')).join('\n'), 'medidas.csv', 'text/csv');
}

function download(text, name, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function fullscreen() {
  const el = document.getElementById('app');
  if (!el.requestFullscreen) {
    commit(() => { state.message = bi('Tela cheia não está disponível neste navegador.', 'Fullscreen is not available in this browser.'); });
    return;
  }
  el.requestFullscreen().catch(() => announce(bi('O navegador recusou a tela cheia.', 'The browser refused fullscreen.')));
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = state.lang === 'en' ? 'en-US' : 'pt-BR';
  window.speechSynthesis.speak(utter);
}

function toggleAudio() {
  if (state.prefs.muted) {
    osc?.stop?.();
    audioCtx = null;
    return;
  }
  if (!state.prefs.ambient) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 72;
    g.gain.value = 0.012;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    osc = o;
    state.audioReady = true;
  } catch {
    state.audioReady = false;
    state.message = bi('O áudio não iniciou. O restante do observatório continua.', 'Audio did not start. The rest of the observatory continues.');
  }
}

export function announce(text) {
  const live = $('#live');
  if (live) live.textContent = text;
}

function onInput(e) {
  const t = e.target;
  if (t.id === 'search') { state.search = t.value; renderNav(); return; }
  if (t.id === 'command') { state.commandQuery = t.value; renderPalette(); return; }
  if (t.id === 'rate-number') return;
  if (t.id === 'speed') setSigned(sliderToSignedRate(Number(t.value)));
  if (t.id === 'scrub') {
    const span = Number(t.dataset.span) || 365;
    state.jd = Number(t.dataset.center) + ((Number(t.value) - 500) / 500) * span;
    live();
  }
  if (t.dataset.lab) updateLab(t.dataset.lab, t.value);
  if (t.id === 'note') state.journalDraft = t.value;
  if (t.id === 'bookmark-name' || t.id === 'view-name') return;
  if (t.name === 'pref') {
    commit(() => {
      if (t.dataset.pref === 'background' || t.dataset.pref === 'panelOpacity') state.prefs[t.dataset.pref] = Number(t.value);
      else if (t.dataset.pref === 'quality') state.quality = t.value;
      else state.prefs[t.dataset.pref] = t.checked;
      if (state.tour) state.tour.overrides[t.dataset.pref] = true;
    });
    if (t.dataset.pref === 'ambient' || t.dataset.pref === 'muted') toggleAudio();
  }
}

function onChange(e) {
  const t = e.target;
  if (t.id === 'rate-number') {
    const parsed = parseRate(t.value);
    if (!parsed.ok) {
      commit(() => { state.message = bi('Taxa inválida. Use um número finito, com vírgula ou ponto.', 'Invalid rate. Use a finite number, with a comma or a dot.'); });
      return;
    }
    setSigned(parsed.value);
  }
  if (t.id === 'date-field') {
    const jd = parseUtc(t.value);
    if (jd == null) commit(() => { state.message = bi('Data inválida. Use AAAA-MM-DDTHH:MM em UTC.', 'Invalid date. Use YYYY-MM-DDTHH:MM in UTC.'); });
    else goJd(jd);
  }
  if (t.id === 'step-size') commit(() => { state.stepId = t.value; });
  if (t.id === 'import-file') readImport(t.files?.[0]);
  if (t.id === 'lang-select') commit(() => { state.lang = t.value; document.documentElement.lang = t.value === 'en' ? 'en' : 'pt-BR'; });
}

function onScrubDown(e) {
  if (e.target.id !== 'scrub') return;
  state.scrubbing = true;
  state.scrubWasPlaying = state.playing;
  state.playing = false;
}
function onScrubUp(e) {
  if (e.target.id !== 'scrub') return;
  state.playing = state.scrubWasPlaying;
  state.scrubbing = false;
  emit();
}

function parseUtc(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(ms) ? null : unixMsToJd(ms);
}

function readImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      const result = validateBundle(json);
      commit(() => { state.importPreview = result.ok ? result : { ok: false, errors: result.errors }; });
    } catch {
      commit(() => { state.importPreview = { ok: false, errors: ['malformed'] }; });
    }
  };
  reader.readAsText(file);
}

function updateLab(key, value) {
  const n = Number(value);
  if (key === 'tilt') { state.labs.seasons.tilt = n; state.labs.seasons.experimental = Math.abs(n - 23.44) > 0.05; }
  if (key === 'orbit') state.labs.seasons.orbit = n;
  if (key === 'lat') state.labs.seasons.latitude = n;
  if (key === 'elong') state.labs.moon.elongation = n;
  if (key === 'inc') state.labs.moon.inclination = n;
  if (key === 'ecc') {
    if (n < 0 || n >= 0.95) state.message = bi('Este laboratório só aceita elipses presas. Parábola e hipérbole ficam de fora.', 'This laboratory only accepts bound ellipses. Parabolas and hyperbolas are unavailable.');
    else state.labs.kepler.e = n;
  }
  if (key === 'axis-a') state.labs.kepler.aKm = n * AU_KM;
  if (key === 'earthmm') state.labs.scale.earthMm = n;
  if (key === 'testmass') state.labs.kepler.testMassKg = n;
  if (key === 'weight') state.labs.kepler.weightMassKg = n;
  drawLabNumbers();
}

function onKey(e) {
  const typing = e.target.closest('input, textarea, select');
  if (e.code === 'Escape') {
    e.preventDefault();
    escapeLayer();
    return;
  }
  if (typing) return;
  if (e.repeat && !e.code.startsWith('Arrow')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'KeyR') world?.overview(state.prefs.reducedMotion);
  if (e.code === 'KeyO') act('orbits');
  if (e.code === 'KeyL') act('labels');
  if (e.code === 'KeyF') toggleFollow(state.selectedId);
  if (e.code === 'KeyG') onFocus(state.selectedId);
  if (e.code === 'KeyC') openTool('compare');
  if (e.code === 'KeyP') enterPhoto();
  if (e.code === 'KeyH' || e.code === 'Slash' && e.shiftKey) act('help');
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyK') { e.preventDefault(); act('palette'); }
  if (e.code === 'BracketLeft') world?.setView({ ...(world.getView()), theta: world.getView().theta - 0.4 });
  if (state.cameraKeys || document.activeElement === $('#scene')) {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Minus: 'inn', Equal: 'out' };
    if (map[e.code]) world?.setKey(map[e.code], true);
  }
}
function onKeyUp(e) {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Minus: 'inn', Equal: 'out' };
  if (map[e.code]) world?.setKey(map[e.code], false);
}
function escapeLayer() {
  if (state.paletteOpen) return commit(() => { state.paletteOpen = false; });
  if (state.helpOpen || state.menu) return commit(() => { state.helpOpen = false; state.menu = null; });
  if (state.confirm || state.importPreview) return commit(() => { state.confirm = null; state.importPreview = null; });
  if (state.disambiguate) return commit(() => { state.disambiguate = null; });
  if (state.photo) return commit(() => { state.photo = false; state.playing = state.photoFreezeWasPlaying; });
  if (state.tool) return closeTool();
  if (state.tour) return exitTour();
  if (state.distractionFree) return commit(() => { state.distractionFree = false; });
  $('#scene')?.blur();
}

function render() {
  applyPrefs();
  $('#topbar').innerHTML = topbar();
  renderNav();
  renderInspector();
  $('#timebar').innerHTML = document.activeElement?.closest?.('#timebar') ? $('#timebar').innerHTML : timebar();
  $('#welcome').classList.toggle('hidden', !state.onboarding.welcome);
  $('#welcome').innerHTML = welcome();
  $('#toast').classList.toggle('hidden', !state.message && !state.boundary);
  $('#toast').innerHTML = toast();
  $('#menu').classList.toggle('hidden', !state.menu);
  $('#menu').innerHTML = menu();
  $('#palette').classList.toggle('hidden', !state.paletteOpen);
  if (state.paletteOpen) renderPalette();
  $('#navigator').classList.toggle('open', state.navigatorOpen);
  $('#navigator').classList.toggle('hidden', state.distractionFree);
  $('#inspector').classList.toggle('hidden', !state.inspectorOpen || state.distractionFree || !state.selectedId);
  $('#inspector').classList.toggle('collapsed', state.inspectorCollapsed);
  document.body.classList.toggle('has-inspector', state.inspectorOpen && !state.distractionFree);
  document.body.classList.toggle('clean', state.distractionFree);
  document.body.classList.toggle('photo', state.photo);
  document.body.classList.toggle('tour-on', Boolean(state.tour));
  $('#restore').classList.toggle('hidden', !state.distractionFree);
  $('#minimap').classList.toggle('open', state.mapOpen);
  const stageKey = `${state.tool}|${state.lang}|${state.activityRun?.id}|${state.activityRun?.status}|${state.glossaryId}|${state.missionId}|${state.labs.scale.view}|${state.labs.scale.includeSun}|${state.labs.scale.log}|${state.labs.beyond.stage}|${state.confirm}|${state.importPreview?.ok}|${state.stageNonce || 0}`;
  if (stageKey !== lastStage) {
    lastStage = stageKey;
    $('#stage').classList.toggle('hidden', !state.tool || state.photo);
    $('#stage').innerHTML = stage();
  }
  $('#tourbar').classList.toggle('hidden', !state.tour);
  $('#tourbar').innerHTML = state.tour ? tourbar() : '';
  $('#photobar').classList.toggle('hidden', !state.photo);
  $('#photobar').innerHTML = state.photo ? photobar() : '';
  $('#check').innerHTML = checklist();
  $('#check').classList.toggle('hidden', state.onboarding.checklistHidden || state.distractionFree);
  drawLabNumbers();
}

function applyPrefs() {
  document.documentElement.dataset.ui = state.prefs.uiScale;
  document.documentElement.dataset.contrast = state.prefs.highContrast ? 'high' : 'normal';
  document.documentElement.style.setProperty('--panel-alpha', String(state.prefs.panelOpacity));
  document.title = bi('Observatório do Sistema Solar', 'Solar System Observatory');
}

function topbar() {
  const body = getBody(state.selectedId);
  const follow = state.followId ? bi('Seguindo', 'Following') : bi('Livre', 'Free');
  return `<div class="brand"><strong>${bi('Observatório do Sistema Solar', 'Solar System Observatory')}</strong><span class="num">${body ? tx(body.name) : bi('Visão geral', 'Overview')} · ${follow} · ${state.scaleMode === 'relative' ? bi('Relativa', 'Relative') : bi('Exploração', 'Exploration')}</span></div>
  <div class="row"><button class="btn primary" data-act="explore">${bi('Explorar', 'Explore')}</button>
  <button class="btn" data-act="menu" data-arg="learn">${bi('Aprender', 'Learn')}</button>
  <button class="btn" data-act="menu" data-arg="tools">${bi('Ferramentas', 'Tools')}</button>
  <button class="btn" data-act="menu" data-arg="settings">${bi('Ajustes', 'Settings')}</button></div>
  <div class="spacer"></div>
  <div class="row"><button class="icon" data-act="nav" aria-label="${bi('Navegador', 'Navigator')}">☰</button>
  <button class="icon" data-act="palette" aria-label="${bi('Comandos', 'Commands')}">⌘</button>
  <button class="btn" data-act="lang">${state.lang === 'pt' ? 'EN' : 'PT'}</button>
  <button class="icon" data-act="distraction" aria-label="${bi('Sem distrações', 'Distraction-free')}">▣</button>
  <button class="icon" data-act="help" aria-label="${bi('Ajuda', 'Help')}">?</button></div>`;
}

function renderNav() {
  const sig = `${state.lang}|${state.search}|${state.filter}|${state.sort}|${state.selectedId}|${state.favorites.join()}|${state.visited.join()}|${state.jd.toFixed(0)}`;
  const nav = $('#navigator');
  if (!nav.dataset.ready) {
    nav.dataset.ready = '1';
    nav.innerHTML = `<header><strong>${bi('Catálogo', 'Catalog')}</strong><button class="icon" data-act="nav" aria-label="${bi('Fechar', 'Close')}">×</button></header>
    <input id="search" placeholder="${bi('Buscar Terra, Saturno…', 'Search Earth, Saturn…')}" aria-label="${bi('Buscar', 'Search')}" />
    <div class="row" id="filters"></div><div id="results" class="scroll"></div>`;
  }
  if (sig === lastNav) return;
  lastNav = sig;
  const filterLabel = { all: bi('Tudo', 'All'), planet: bi('planetas', 'planets'), moon: bi('luas', 'moons'), dwarf: bi('anões', 'dwarfs'), small: bi('pequenos', 'small'), region: bi('regiões', 'regions') };
  $('#filters').innerHTML = ['all', 'planet', 'moon', 'dwarf', 'small', 'region'].map((f) => `<button class="btn ${state.filter === f ? 'active' : ''}" data-act="filter" data-arg="${f}">${filterLabel[f]}</button>`).join('');
  const q = norm(state.search);
  let list = BODIES.filter((b) => state.filter === 'all' || b.type === state.filter || b.group === state.filter || (state.filter === 'small' && (b.type === 'asteroid' || b.type === 'comet')));
  if (q) list = list.filter((b) => norm([b.name.pt, b.name.en, b.id, ...(b.aliases || [])].join(' ')).includes(q));
  if (!q && state.sort === 'catalog') list = BODIES.filter((b) => list.includes(b));
  if (state.sort === 'diameter') list = [...list].sort((a, b) => (b.radiusEqKm || 0) - (a.radiusEqKm || 0));
  if (state.sort === 'distance') list = [...list].sort((a, b) => (a.orbitalYears || 99) - (b.orbitalYears || 99));
  const results = $('#results');
  results.innerHTML = list.length ? list.map((b) => `<button class="nav-item" data-act="select" data-arg="${b.id}" ${state.selectedId === b.id ? 'aria-current="true"' : ''}>
    <i class="swatch" style="background:${b.color || '#789'}"></i><span>${tx(b.name)}<br><small>${tx(kindLabel(b))}${b.parent ? ` · ${tx(getBody(b.parent)?.name)}` : ''}</small></span>
    <small>${state.favorites.includes(b.id) ? '★' : ''}${state.visited.includes(b.id) ? ' •' : ''}</small></button>`).join('')
    : `<p class="sub">${bi('Nenhum resultado.', 'No results.')}</p><button class="btn" data-act="filter" data-arg="all">${bi('Limpar busca', 'Reset search')}</button>`;
  if (document.activeElement?.id !== 'search') $('#search').value = state.search;
}

function kindLabel(b) {
  if (b.hypothetical) return bi('Hipotético', 'Hypothetical');
  if (b.schematic) return bi('Esquema', 'Schematic');
  if (b.illustrative) return bi('Ilustrativo', 'Illustrative');
  if (b.model === 'jpl-planet' || b.model === 'jpl-emb') return bi('Simulado', 'Simulated');
  return bi('Educacional', 'Educational');
}

function renderInspector() {
  const body = getBody(state.selectedId);
  const box = $('#inspector');
  if (!body) { box.innerHTML = ''; return; }
  const sig = `${body.id}|${state.lang}|${state.inspectorTab}|${state.scaleMode}|${state.venusRadar}|${state.tidalOverlay}|${state.inspectorCollapsed}`;
  if (sig === lastInspector) return;
  lastInspector = sig;
  const tabs = ['overview', 'data', body.moons?.length || body.type === 'planet' ? 'moons' : null, 'sources'].filter(Boolean);
  box.innerHTML = `<header><strong>${tx(body.name)}</strong><button class="icon" data-act="inspector-collapse" aria-label="${bi('Recolher', 'Collapse')}">–</button></header>
  <div class="tabs">${tabs.map((tab) => `<button class="btn ${state.inspectorTab === tab ? 'active' : ''}" data-act="tab" data-arg="${tab}">${tabLabel(tab, body)}</button>`).join('')}</div>
  <div class="scroll" id="inspector-body">${inspectorBody(body)}</div>
  <div class="row">${actionsFor(body)}</div>`;
  box.querySelectorAll('[data-act="tab"]').forEach((btn) => btn.addEventListener('click', () => commit(() => {
    state.inspectorTab = btn.dataset.arg;
    if (btn.dataset.arg === 'sources') state.openedSourcesFor = body.id;
  })));
}

function tabLabel(tab, body) {
  const map = { overview: bi('Visão', 'Overview'), data: bi('Dados', 'Data'), moons: body.type === 'moon' ? bi('Sistema', 'System') : bi('Luas', 'Moons'), sources: bi('Fontes', 'Sources') };
  return map[tab];
}

function actionsFor(body) {
  return `<button class="btn primary" data-act="focus" data-arg="${body.id}">${bi('Enquadrar', 'Focus')}</button>
  <button class="btn" data-act="follow" data-arg="${body.id}">${bi('Seguir', 'Follow')}</button>
  <button class="btn" data-act="compare-add" data-arg="${body.id}">${bi('Comparar', 'Compare')}</button>
  <button class="btn" data-act="tool" data-arg="measure">${bi('Medir', 'Measure')}</button>
  <button class="btn" data-act="fav" data-arg="${body.id}">${state.favorites.includes(body.id) ? '★' : '☆'}</button>
  ${body.moons?.length ? `<button class="btn" data-act="system">${bi('Luas', 'Moons')}</button>` : ''}`;
}

function inspectorBody(body) {
  if (state.inspectorTab === 'sources') return sources(body);
  if (state.inspectorTab === 'moons') return moons(body);
  if (state.inspectorTab === 'data') return dataBlock(body);
  return `<p>${tx(body.summary)}</p><p class="sub">${(body.facts || []).map(tx).join(' ')}</p>
  <p class="num" data-live="dist"></p><p class="warn">${body.hypothetical ? bi('Modelo hipotético.', 'Hypothetical model.') : ''}</p>`;
}

function dataBlock(body) {
  const rows = [];
  const push = (k, v) => rows.push(`<div class="kv"><span>${k}</span><strong class="num">${v}</strong></div>`);
  if (body.radiusEqKm) push(bi('Diâmetro equatorial', 'Equatorial diameter'), `${formatNumber(body.radiusEqKm * 2, state.lang, 1)} km`);
  else push(bi('Diâmetro', 'Diameter'), statusWord(body.radiusStatus || 'na'));
  if (body.radiusMeanKm) push(bi('Raio médio', 'Mean radius'), `${formatNumber(body.radiusMeanKm, state.lang, 1)} km`);
  push(bi('Massa', 'Mass'), body.massKg ? `${formatSci(body.massKg, state.lang)} kg` : statusWord(body.massStatus || 'unavailable'));
  push(bi('Gravidade', 'Gravity'), body.gravityMs2 ? `${formatNumber(body.gravityMs2, state.lang, 2)} m/s²` : statusWord(body.gravityStatus || 'unavailable'));
  push(bi('Densidade', 'Density'), body.densityGcm3 ? `${formatNumber(body.densityGcm3, state.lang, 3)} g/cm³` : statusWord(body.densityStatus || 'unavailable'));
  if (body.rotationDays) push(bi('Rotação sideral', 'Sidereal rotation'), `${formatNumber(body.rotationDays, state.lang, 3)} d`);
  if (body.solarDayDays) push(bi('Dia solar', 'Solar day'), `${formatNumber(body.solarDayDays, state.lang, 3)} d`);
  if (body.orbitalYears) push(bi('Período sideral publicado', 'Published sidereal period'), `${formatNumber(body.orbitalYears, state.lang, 4)} a × 365,25 d`);
  if (body.satellitePeriodDays) push(bi('Período ao redor do planeta', 'Period around the planet'), `${formatNumber(body.satellitePeriodDays, state.lang, 3)} d`);
  if (body.axialTiltDeg != null) push(bi('Inclinação axial', 'Axial tilt'), `${formatNumber(body.axialTiltDeg, state.lang, 2)}°`);
  if (body.temperature?.typicalK) push(bi('Temperatura', 'Temperature'), `${formatNumber(body.temperature.typicalK, state.lang, 0)} K`);
  if (body.temperature?.minK) push(bi('Faixa de temperatura', 'Temperature range'), `${body.temperature.minK}–${body.temperature.maxK} K`);
  if (body.knownMoons != null) {
    push(bi('Luas conhecidas', 'Known moons'), `${body.knownMoons}`);
    push(bi('Luas exibidas', 'Moons on display'), `${body.moons?.length || 0}`);
  }
  push(bi('Distância instantânea ao Sol', 'Instantaneous Sun distance'), '<span data-live="sun"></span>');
  if (body.parent && body.parent !== 'sun') push(bi('Distância ao planeta', 'Distance to planet'), '<span data-live="parent"></span>');
  return `${rows.join('')}<p class="sub">${tx(body.gravityNote) || ''} ${tx(body.orbitNote) || ''} ${tx(body.temperature?.context) || ''}</p>`;
}

function statusWord(status) {
  return { na: bi('não se aplica', 'not applicable'), unknown: bi('desconhecido', 'unknown'), unavailable: bi('indisponível', 'unavailable'), disputed: bi('em disputa', 'disputed'), derived: bi('calculado', 'derived') }[status] || bi('indisponível', 'unavailable');
}

function moons(body) {
  const ids = body.moons?.length ? body.moons : (body.parent ? [body.parent] : []);
  const known = body.knownMoons != null ? `<p>${bi('Luas conhecidas', 'Known moons')}: ${body.knownMoons} · ${bi('Luas exibidas', 'Moons on display')}: ${body.moons?.length || 0}</p><p class="sub">${tx(body.knownMoonsNote) || DATA_DATES.moonCountsNote[state.lang] || DATA_DATES.moonCountsNote.pt}</p>` : '';
  return `${known}${ids.map((id) => `<button class="nav-item" data-act="select" data-arg="${id}"><i class="swatch" style="background:${getBody(id)?.color}"></i><span>${tx(getBody(id)?.name)}</span></button>`).join('')}`;
}

function sources(body) {
  return `<p class="sub">${bi('Representação', 'Representation')}: ${body.model}. ${bi('Diâmetro principal', 'Primary diameter')}: ${body.diameterBasis || 'n/a'}.</p>
  <ul>${(body.sources || []).map((s) => `<li><a href="${s.href}" target="_blank" rel="noreferrer">${tx(s.label)}</a></li>`).join('')}</ul>
  <button class="btn" data-act="glossary" data-arg="about-model">${bi('Sobre este modelo', 'About this model')}</button>`;
}

function timebar() {
  const signed = state.playing ? state.rate * state.direction : 0;
  const phrase = ratePhrase(state.rate);
  return `<div class="row"><button class="btn primary" data-act="play" aria-keyshortcuts="Space">${state.playing ? bi('Pausar', 'Pause') : bi('Reproduzir', 'Play')}</button>
  <button class="btn" data-act="reverse">${state.direction < 0 ? bi('Ré', 'Reverse') : bi('Frente', 'Forward')}</button>
  <strong class="num clock">${state.playing ? '' : bi('Pausado · ', 'Paused · ')}${phrase} · ${formatJdUtc(state.jd, state.lang)}</strong>
  <button class="btn" data-act="scale">${state.scaleMode === 'relative' ? bi('Relativa', 'Relative') : bi('Exploração', 'Exploration')}</button>
  <button class="btn" data-act="now">${bi('Agora', 'Now')}</button></div>
  <div class="row"><input id="speed" class="slider" type="range" min="0" max="1000" value="${Math.round(signedRateToSlider(state.playing ? state.rate * state.direction : 0))}" aria-label="${bi('Velocidade', 'Speed')}"/>
  <input id="rate-number" class="num" value="${formatNumber(signed, state.lang, 2)}" aria-label="${bi('Taxa numérica', 'Numeric rate')}"/>
  ${[1, 10, 100, 1000, 3600, 86400, WEEK_SECONDS, DEMO_MONTH_SECONDS].map((r) => `<button class="btn ${state.rate === r ? 'active' : ''}" data-act="rate" data-arg="${state.direction * r}">${presetName(r)}</button>`).join('')}</div>
  <details><summary>${bi('Data, passos e reinício', 'Date, steps, and reset')}</summary>
  <div class="row"><button class="btn" data-act="step" data-arg="-1">−</button>
  <select id="step-size" aria-label="${bi('Passo', 'Step')}">${[['minute', '1 min'], ['hour', '1 h'], ['day', '1 d'], ['week', bi('semana', 'week')], ['orbit', bi('órbita', 'orbit')], ['spin', bi('rotação', 'spin')]].map(([id, label]) => `<option value="${id}" ${state.stepId === id ? 'selected' : ''}>${label}</option>`).join('')}</select>
  <button class="btn" data-act="step" data-arg="1">+</button>
  <button class="btn" data-act="orbit-complete">${bi('Completar uma órbita', 'Complete one orbit')}</button>
  <button class="btn" data-act="month" data-arg="-1">${bi('Mês −', 'Month −')}</button>
  <button class="btn" data-act="month" data-arg="1">${bi('Mês +', 'Month +')}</button>
  <input id="date-field" value="${toField(state.jd)}" aria-label="${bi('Data UTC', 'UTC date')}"/>
  <button class="btn" data-act="reset-sim" title="${bi('Volta à data inicial e à velocidade padrão.', 'Returns to the initial date and default speed.')}">${bi('Reiniciar simulação', 'Reset simulation')}</button>
  <button class="btn" data-act="reset-view" title="${bi('Só a câmera.', 'Camera only.')}">${bi('Reiniciar vista', 'Reset view')}</button></div>
  <input id="scrub" type="range" min="0" max="1000" value="500" data-center="${state.jd}" data-span="365" aria-label="${bi('Linha do tempo', 'Timeline')}"/>
  </details>
  <p class="sub">${bi('Ajuste 1800–2050. 1× = tempo real. Padrão: 1 dia/s.', 'Fit 1800–2050. 1× = real time. Default: 1 day/s.')}</p>`;
}

function presetName(r) {
  if (r === 3600) return bi('1 h/s', '1 h/s');
  if (r === 86400) return bi('1 dia/s', '1 day/s');
  if (r === WEEK_SECONDS) return bi('1 sem/s', '1 wk/s');
  if (r === DEMO_MONTH_SECONDS) return bi('30 d/s', '30 d/s');
  return `${r}×`;
}
function ratePhrase(rate) {
  const map = [[1, bi('1 segundo por segundo', '1 second per second')], [10, bi('10 segundos por segundo', '10 seconds per second')], [100, bi('100 segundos por segundo', '100 seconds per second')], [1000, bi('1000 segundos por segundo', '1000 seconds per second')], [3600, bi('1 hora por segundo', '1 hour per second')], [86400, bi('1 dia por segundo', '1 day per second')], [WEEK_SECONDS, bi('1 semana por segundo', '1 week per second')], [DEMO_MONTH_SECONDS, bi('1 mês de demonstração (30 dias) por segundo', '1 demonstration month (30 days) per second')]];
  const hit = map.find(([v]) => Math.abs(v - rate) / v < 0.01);
  const dir = state.direction < 0 ? bi('para trás', 'backward') : bi('para a frente', 'forward');
  return `${hit ? hit[1] : `${formatNumber(rate, state.lang, 2)}×`} · ${dir}`;
}
function toField(jd) {
  const d = new Date((jd - 2440587.5) * 86400000);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function welcome() {
  return `<h2 class="h">${bi('O sistema está em movimento.', 'The system is already moving.')}</h2>
  <p class="sub">${bi('Arraste para orbitar, role para aproximar, clique para inspecionar. Toque duplo enquadra.', 'Drag to orbit, scroll to zoom, click to inspect. Double-click frames the target.')}</p>
  <div class="row"><button class="btn primary" data-act="welcome">${bi('Explorar livremente', 'Explore freely')}</button>
  <button class="btn sun" data-act="tour" data-arg="grand">${bi('Começar o grande passeio', 'Start the grand tour')}</button>
  <button class="btn" data-act="help">${bi('Aprender os controles', 'Learn the controls')}</button></div>`;
}

function toast() {
  const extra = state.boundary ? `<button class="btn sun" data-act="extend">${bi('Continuar com o modelo estendido', 'Continue with the extended model')}</button>` : '';
  return `<p>${state.message || ''}</p>${extra}<button class="btn" data-act="close-menu">${bi('Fechar', 'Close')}</button>`;
}

function menu() {
  if (state.menu === 'learn') return `<div class="cards">${TOURS.map((t) => `<button class="card" data-act="tour" data-arg="${t.id}"><strong>${tx(t.title)}</strong><br><span class="sub">${tx(t.summary)}</span></button>`).join('')}
  ${ACTIVITIES.slice(0, 6).map((a) => `<button class="card" data-act="activity" data-arg="${a.id}">${tx(a.title)}</button>`).join('')}
  <button class="btn" data-act="tool" data-arg="learn">${bi('Todas as atividades', 'All activities')}</button>
  <button class="btn" data-act="glossary" data-arg="about-model">${bi('Glossário', 'Glossary')}</button></div>`;
  if (state.menu === 'tools') return `<div class="row">
  ${[['compare', bi('Comparar', 'Compare')], ['measure', bi('Medir', 'Measure')], ['scale-lab', bi('Laboratório de escala', 'Scale laboratory')], ['seasons', bi('Estações', 'Seasons')], ['moon-lab', bi('Fases e eclipses', 'Phases and eclipses')], ['kepler', bi('Órbitas', 'Orbits')], ['beyond', bi('Além de Netuno', 'Beyond Neptune')], ['missions', bi('Missões', 'Missions')], ['journal', bi('Diário', 'Journal')], ['apparent', bi('Movimento aparente', 'Apparent motion')]].map(([id, label]) => `<button class="btn" data-act="tool" data-arg="${id}">${label}</button>`).join('')}
  <button class="btn" data-act="photo">${bi('Fotografia', 'Photo')}</button></div>`;
  if (state.menu === 'settings') return settings();
  if (state.menu === 'help') return help();
  return '';
}

function help() {
  return `<h2 class="h">${bi('Controles', 'Controls')}</h2>
  <p><kbd>Space</kbd> ${bi('pausa', 'pause')} · <kbd>R</kbd> ${bi('câmera', 'camera')} · <kbd>O</kbd> ${bi('órbitas', 'orbits')} · <kbd>L</kbd> ${bi('rótulos', 'labels')} · <kbd>Esc</kbd> ${bi('fecha a camada do topo', 'closes the top layer')} · <kbd>Ctrl+Shift+K</kbd> ${bi('comandos', 'commands')}</p>
  <p class="sub">${bi('Um clique inspeciona. Dois cliques enquadram. Seguir não muda o referencial físico. Em telas de toque, use o botão Deslocar para arrastar a cena com um dedo.', 'One click inspects. Two clicks frame. Follow does not change the physical frame. On touch screens, use Pan to drag the scene with one finger.')}</p>
  <button class="btn" data-act="tutorial">${bi('Recomeçar tutorial', 'Restart tutorial')}</button>
  <button class="btn" data-act="pan">${bi('Deslocar', 'Pan')}: ${state.panMode ? bi('ligado', 'on') : bi('desligado', 'off')}</button>`;
}

function settings() {
  const p = state.prefs;
  return `<h2 class="h">${bi('Ajustes', 'Settings')}</h2>
  <div class="grid-2"><label>${bi('Idioma', 'Language')}<select id="lang-select"><option value="pt" ${state.lang === 'pt' ? 'selected' : ''}>Português</option><option value="en" ${state.lang === 'en' ? 'selected' : ''}>English</option></select></label>
  <label>${bi('Qualidade', 'Quality')}<select name="pref" data-pref="quality"><option value="auto">Auto</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>
  <label class="row"><input name="pref" data-pref="reducedMotion" type="checkbox" ${p.reducedMotion ? 'checked' : ''}/> ${bi('Reduzir movimento', 'Reduce motion')}</label>
  <label class="row"><input name="pref" data-pref="highContrast" type="checkbox" ${p.highContrast ? 'checked' : ''}/> ${bi('Mais contraste', 'Higher contrast')}</label>
  <label class="row"><input name="pref" data-pref="simplified" type="checkbox" ${p.simplified ? 'checked' : ''}/> ${bi('Visual simplificado', 'Simplified visuals')}</label>
  <label class="row"><input name="pref" data-pref="catchUp" type="checkbox" ${p.catchUp ? 'checked' : ''}/> ${bi('Ao voltar da aba, recuperar no máximo 30 s (o padrão descarta o intervalo oculto)', 'When returning from a hidden tab, catch up at most 30 s (the default drops the hidden interval)')}</label>
  <label>${bi('Fundo', 'Background')} <input name="pref" data-pref="background" type="range" min="0" max="1" step="0.05" value="${p.background}"/></label>
  <label>${bi('Opacidade dos painéis', 'Panel opacity')} <input name="pref" data-pref="panelOpacity" type="range" min="0.5" max="1" step="0.02" value="${p.panelOpacity}"/></label>
  <div class="row">${['cinematic', 'classroom', 'study', 'low'].map((id) => `<button class="btn" data-act="preset" data-arg="${id}">${id}</button>`).join('')}</div>
  <label class="row"><input name="pref" data-pref="muted" type="checkbox" ${p.muted ? 'checked' : ''}/> ${bi('Mudo', 'Mute')}</label>
  <label class="row"><input name="pref" data-pref="ambient" type="checkbox" ${p.ambient ? 'checked' : ''}/> ${bi('Atmosfera sonora artística, não som do espaço', 'Artistic soundscape, not the sound of space')}</label>
  <label class="row"><input name="pref" data-pref="narration" type="checkbox" ${p.narration ? 'checked' : ''}/> ${bi('Narração do navegador, se existir', 'Browser narration, if available')}</label>
  <p class="sub">${bi('Não há trilha sonora de terceiros. A narração usa a voz do sistema e o texto continua sendo a fonte.', 'There is no third-party soundtrack. Narration uses the system voice, and the text remains the source.')}</p>
  <div class="row"><button class="btn" data-act="units">${bi('Unidades', 'Units')}: ${p.units}</button>
  <button class="btn" data-act="presentation">${state.presentation}</button>
  <button class="btn" data-act="export">${bi('Exportar dados', 'Export data')}</button>
  <label class="btn">${bi('Importar', 'Import')}<input id="import-file" type="file" accept="application/json" hidden/></label>
  <button class="btn" data-act="share">${bi('Copiar cena', 'Copy scene')}</button>
  <button class="btn" data-act="reset-prefs">${bi('Restaurar preferências visuais', 'Reset visual preferences')}</button>
  <button class="btn" data-act="ask-clear" data-arg="all">${bi('Apagar dados locais…', 'Clear local data…')}</button></div>
  ${state.importPreview ? `<div class="banner">${state.importPreview.ok ? bi('Pré-visualização pronta. Nada foi substituído ainda.', 'Preview ready. Nothing has been replaced yet.') : bi('Arquivo recusado.', 'File rejected.')}
  <button class="btn" data-act="import-apply" data-arg="merge">${bi('Mesclar', 'Merge')}</button>
  <button class="btn" data-act="import-apply" data-arg="replace">${bi('Substituir', 'Replace')}</button>
  <button class="btn" data-act="cancel-confirm">${bi('Cancelar', 'Cancel')}</button></div>` : ''}
  ${state.confirm ? `<div class="banner caution">${bi('Isto apaga o conjunto escolhido neste navegador e não apaga planetas.', 'This clears the chosen set in this browser and does not delete planets.')}
  <button class="btn" data-act="do-clear" data-arg="${state.confirm}">${bi('Apagar de verdade', 'Really clear')}</button>
  <button class="btn" data-act="cancel-confirm">${bi('Cancelar', 'Cancel')}</button></div>` : ''}
  <p class="sub">${bi('Diagnóstico', 'Diagnostics')}: ${state.webglOk ? 'WebGL' : bi('sem 3D', 'no 3D')} · <span data-live="fps"></span> fps · ${state.effectiveQuality} · ${state.storageNote || (storageAvailable() ? 'localStorage' : bi('sem armazenamento', 'no storage'))}</p>
  <p class="sub">${bi('Instalação offline não está ativa. A sessão carregada continua se a rede cair, mas um novo carregamento precisa dos arquivos.', 'Offline installation is not active. The loaded session continues if the network drops, but a fresh load needs the files.')}</p>`;
}

function stage() {
  if (state.tool === 'compare') return compareStage();
  if (state.tool === 'measure') return measureStage();
  if (state.tool === 'scale-lab') return scaleStage();
  if (state.tool === 'seasons') return seasonsStage();
  if (state.tool === 'moon-lab') return moonStage();
  if (state.tool === 'kepler') return keplerStage();
  if (state.tool === 'beyond') return beyondStage();
  if (state.tool === 'missions') return missionStage();
  if (state.tool === 'glossary') return glossaryStage();
  if (state.tool === 'journal') return journalStage();
  if (state.tool === 'learn' || state.tool === 'activity') return learnStage();
  if (state.tool === 'apparent') return apparentStage();
  return '';
}

function stageHead(title) {
  return `<header><h2 class="h">${title}</h2><button class="btn primary" data-act="close-tool">${bi('Voltar à vista anterior', 'Return to previous view')}</button></header>`;
}

function compareStage() {
  const ids = state.compareIds;
  const ref = getBody(state.compareRef) || getBody(ids[0]);
  const maxR = Math.max(...ids.map((id) => getBody(id)?.radiusEqKm || 1));
  return `${stageHead(bi('Comparação', 'Comparison'))}
  <div class="row">${COMPARE_PRESETS.map((p) => `<button class="btn" data-act="compare-preset" data-arg="${p.join(',')}">${tx(getBody(p[0]).name)} / ${tx(getBody(p[1]).name)}</button>`).join('')}</div>
  <div class="circles">${ids.map((id) => {
    const b = getBody(id);
    const px = 150 * ((b.radiusEqKm || 1) / maxR);
    return `<div><div class="ball" style="width:${px}px;height:${px}px;background:${b.color}"></div><div>${tx(b.name)}</div></div>`;
  }).join('')}</div>
  <p class="sub">${bi('Os círculos usam o diâmetro linear, não a área. Congelado em', 'Circles use linear diameter, not area. Frozen at')} ${formatJdUtc(state.compareFreezeJd || state.jd, state.lang)}.</p>
  <div class="scroll"><table class="table"><tr><th>${bi('Campo', 'Field')}</th>${ids.map((id) => `<th>${tx(getBody(id).name)} <button data-act="compare-del" data-arg="${id}">×</button></th>`).join('')}</tr>
  ${['diameter', 'mass', 'gravity', 'density', 'day', 'year'].map((field) => `<tr><td>${field}</td>${ids.map((id) => `<td>${compareCell(id, field, ref)}</td>`).join('')}</tr>`).join('')}
  </table></div>
  <button class="btn" data-act="csv">${bi('Exportar tabela', 'Export table')}</button>`;
}
function compareCell(id, field, ref) {
  const b = getBody(id);
  if (field === 'diameter') return b.radiusEqKm ? `${formatNumber(b.radiusEqKm * 2, state.lang, 0)} km` : statusWord('na');
  if (field === 'mass') return b.massKg && ref?.massKg ? `${formatNumber(b.massKg / ref.massKg, state.lang, 3)} ×` : statusWord(b.massStatus || 'unavailable');
  if (field === 'gravity') return b.gravityMs2 ? `${formatNumber(b.gravityMs2, state.lang, 2)}` : statusWord('unavailable');
  if (field === 'density') return b.densityGcm3 ? `${formatNumber(b.densityGcm3, state.lang, 2)}` : statusWord('unavailable');
  if (field === 'day') return b.rotationDays ? `${formatNumber(b.rotationDays, state.lang, 3)} d` : statusWord('na');
  if (field === 'year') return b.orbitalYears ? `${formatNumber(b.orbitalYears, state.lang, 3)} a` : statusWord(b.orbitStatus || 'na');
  return '';
}

function measureStage() {
  return `${stageHead(bi('Medição física', 'Physical measurement'))}
  <p class="sub">${bi('O número usa coordenadas físicas. O traço cruza a cena comprimida e não é a régua.', 'The number uses physical coordinates. The line crosses the compressed scene and is not the ruler.')}</p>
  <div class="row"><button class="btn" data-act="measure" data-arg="a">${bi('Ponta A = seleção', 'Endpoint A = selection')}</button>
  <button class="btn" data-act="measure" data-arg="b">${bi('Ponta B = seleção', 'Endpoint B = selection')}</button>
  <button class="btn" data-act="pulse">${bi('Pulso de luz acelerado', 'Accelerated light pulse')}</button>
  <button class="btn" data-act="copy-measure">${bi('Copiar', 'Copy')}</button></div>
  <p class="num" id="measure-readout"></p>`;
}

function scaleStage() {
  const s = state.labs.scale;
  const ids = s.includeSun ? s.ids : s.ids.filter((id) => id !== 'sun');
  const max = Math.max(...ids.map((id) => getBody(id).radiusEqKm));
  return `${stageHead(bi('Laboratório de escala', 'Scale laboratory'))}
  <div class="banner">${bi('Vista experimental. A câmera do Sistema Solar foi guardada.', 'Experimental view. The solar-system camera was saved.')} ${s.view === 'distances' && s.log ? bi('EIXO LOGARÍTMICO', 'LOGARITHMIC AXIS') : bi('EIXO LINEAR', 'LINEAR AXIS')}</div>
  <div class="row"><button class="btn" data-act="lab-view" data-arg="sizes">${bi('Tamanhos', 'Sizes')}</button>
  <button class="btn" data-act="lab-view" data-arg="distances">${bi('Distâncias', 'Distances')}</button>
  <button class="btn" data-act="lab-view" data-arg="true">${bi('Escala única', 'Single scale')}</button>
  <button class="btn" data-act="layer" data-arg="includeSun">${bi('Sol', 'Sun')}</button></div>
  <div class="circles">${ids.map((id) => {
    const b = getBody(id);
    const px = s.view === 'sizes' ? 160 * (b.radiusEqKm / max) : 28;
    return `<div class="ball" style="width:${Math.max(8, px)}px;height:${Math.max(8, px)}px;background:${b.color}">${tx(b.name)}</div>`;
  }).join('')}</div>
  <p>${bi('Se a Terra tivesse', 'If Earth were')} <input data-lab="earthmm" type="number" min="0.1" step="0.1" value="${s.earthMm}"/> mm</p>
  <div id="earth-size"></div>
  <button class="btn" data-act="lab-reset" data-arg="scale">${bi('Reiniciar laboratório', 'Reset laboratory')}</button>`;
}

function seasonsStage() {
  const s = state.labs.seasons;
  return `${stageHead(bi('Estações', 'Seasons'))}
  <div class="banner ${s.experimental ? 'caution' : ''}">${s.experimental ? bi('Inclinação experimental. O catálogo da Terra não muda.', 'Experimental tilt. Earth’s catalog does not change.') : bi('Inclinação de referência da Terra.', 'Earth’s reference tilt.')}</div>
  <label>${bi('Inclinação', 'Tilt')} <input data-lab="tilt" type="range" min="0" max="90" value="${s.tilt}"/></label>
  <label>${bi('Posição na órbita', 'Place in the orbit')} <input data-lab="orbit" type="range" min="0" max="360" value="${s.orbit}"/></label>
  <label>${bi('Latitude', 'Latitude')} <input data-lab="lat" type="range" min="-90" max="90" value="${s.latitude}"/></label>
  <p id="daylight" class="num"></p>
  <p class="sub">${bi('0° na órbita é o solstício de verão no hemisfério norte e de inverno no sul.', '0° in the orbit is northern summer solstice and southern winter.')}</p>
  <button class="btn" data-act="seasons-reveal">${bi('Ver o efeito da inclinação zero', 'See the zero-tilt effect')}</button>
  ${s.revealed ? `<p>${bi('Sem inclinação, o dia fica perto de 12 h e o contraste sazonal some.', 'Without tilt, the day stays near 12 h and the seasonal contrast disappears.')}</p>` : ''}
  <button class="btn" data-act="lab-reset" data-arg="seasons">${bi('Voltar à Terra', 'Back to Earth')}</button>`;
}

function moonStage() {
  const m = state.labs.moon;
  const illum = (1 - Math.cos(m.elongation * Math.PI / 180)) / 2;
  const name = PHASE[phaseIdFromElongation(m.elongation)];
  return `${stageHead(bi('Fases e eclipses', 'Phases and eclipses'))}
  <p>${bi('A fase é a parte iluminada vista da Terra. O eclipse é outro alinhamento e não explica as fases comuns.', 'Phase is the lit part seen from Earth. An eclipse is a different alignment and does not explain ordinary phases.')}</p>
  <label>${bi('Elongação', 'Elongation')} <input data-lab="elong" type="range" min="0" max="360" value="${m.elongation}"/></label>
  <label>${bi('Inclinação', 'Inclination')} <input data-lab="inc" type="range" min="0" max="10" step="0.1" value="${m.inclination}"/></label>
  <p class="num">${name ? (state.lang === 'en' ? name[1] : name[0]) : ''} · ${formatNumber(illum * 100, state.lang, 0)}%</p>
  <p class="sub">${Math.abs(m.inclination - 5.145) > 0.2 ? bi('Inclinação hipotética. Com 0°, o desenho produz eclipse todo mês. Isso não é uma previsão.', 'Hypothetical inclination. At 0°, the drawing produces an eclipse every month. That is not a prediction.') : bi('Inclinação média aproximada de 5,1°. Por isso nem todo alinhamento é eclipse.', 'Approximate mean inclination of 5.1°. That is why not every alignment is an eclipse.')}</p>
  <div class="row"><button class="btn" data-act="moon-preset" data-arg="90">${bi('Quarto', 'Quarter')}</button>
  <button class="btn" data-act="moon-preset" data-arg="0">${bi('Nova, esquemática', 'New, schematic')}</button>
  <button class="btn" data-act="moon-preset" data-arg="180">${bi('Cheia, esquemática', 'Full, schematic')}</button></div>
  <p>${bi('Umbra: sombra escura. Penumbra: sombra parcial. Classificar total ou anular aqui só vale para este desenho.', 'Umbra: dark shadow. Penumbra: partial shadow. Calling it total or annular here applies only to this drawing.')}</p>`;
}

function keplerStage() {
  const k = state.labs.kepler;
  const mass = k.massKg;
  const period = keplerPeriodSeconds(k.aKm, mass);
  const apsis = ellipseApsisKm(k.aKm, k.e);
  const g = sphereGravity(mass, k.radiusKm);
  const w = g.ok ? weightNewtons(k.weightMassKg, g.g) : { ok: false };
  const speed = apsis.ok ? visViva(k.aKm, apsis.periapsisKm, mass) : { ok: false };
  return `${stageHead(bi('Laboratório de órbitas', 'Orbit laboratory'))}
  <div class="banner caution">${bi('Modelo hipotético de dois corpos. Não altera a Terra nem o catálogo.', 'Hypothetical two-body model. It does not change Earth or the catalog.')}</div>
  <label>e <input data-lab="ecc" type="range" min="0" max="0.85" step="0.01" value="${k.e}"/></label>
  <label>a (UA) <input data-lab="axis-a" type="range" min="0.3" max="5" step="0.05" value="${k.aKm / AU_KM}"/></label>
  <p>${bi('Massa de teste desprezível', 'Negligible test mass')} <input data-lab="testmass" type="number" value="${k.testMassKg}"/> kg. ${bi('Mudá-la não muda o período.', 'Changing it does not change the period.')}</p>
  <p class="num">${period.ok ? formatDuration(period.seconds, state.lang) : '—'}</p>
  <p>${apsis.ok ? `${bi('Periastro', 'Periapsis')} ${formatSci(apsis.periapsisKm, state.lang)} km · ${bi('Apoastro', 'Apoapsis')} ${formatSci(apsis.apoapsisKm, state.lang)} km` : ''}</p>
  <p>${speed.ok ? `${formatNumber(speed.mps / 1000, state.lang, 2)} km/s ${bi('no periastro', 'at periapsis')}` : ''}</p>
  <p>${bi('Peso de uma massa', 'Weight of a mass')} <input data-lab="weight" type="number" value="${k.weightMassKg}"/> kg = ${w.ok ? formatNumber(w.newtons, state.lang, 1) : '—'} N</p>
  <div class="row"><button class="btn" data-act="kepler-run">${k.running ? bi('Pausar', 'Pause') : bi('Rodar', 'Run')}</button>
  <button class="btn" data-act="kepler-reset">${bi('Reiniciar', 'Reset')}</button>
  <button class="btn" data-act="kepler-save">${bi('Guardar predefinição hipotética', 'Save hypothetical preset')}</button></div>
  <p class="sub">${bi('T = 2π √(a³/GM). g = GM/r². W = mg. Sem forma irregular, rotação ou terceiros corpos.', 'T = 2π √(a³/GM). g = GM/r². W = mg. No irregular shape, rotation, or third bodies.')}</p>`;
}

function beyondStage() {
  const stageIndex = state.labs.beyond.stage;
  const item = BEYOND_STAGES[stageIndex];
  const max = BEYOND_STAGES[BEYOND_STAGES.length - 1].au;
  return `${stageHead(bi('Além de Netuno', 'Beyond Neptune'))}
  <div class="banner">${item.mapping === 'log' ? bi('LOGARÍTMICO', 'LOGARITHMIC') : item.mapping === 'linear' ? bi('LINEAR', 'LINEAR') : bi('ESQUEMÁTICO', 'SCHEMATIC')}</div>
  <h3>${tx(item.title)}</h3><p>${tx(item.text)}</p>
  <div class="progress"><span style="width:${axisPosition(item.au, { mode: item.mapping === 'log' ? 'log' : 'linear', min: item.mapping === 'log' ? 1 : 0, max, length: 100 })}%"></span></div>
  <p class="num">${formatNumber(item.au, state.lang, 0)} UA · ${formatDuration(lightTimeSeconds(item.au * AU_KM).seconds, state.lang)}</p>
  <div class="row">${BEYOND_STAGES.map((s, i) => `<button class="btn ${i === stageIndex ? 'active' : ''}" data-act="beyond" data-arg="${i}">${i + 1}</button>`).join('')}
  <button class="btn primary" data-act="close-tool">${bi('Voltar aos planetas', 'Return to the planets')}</button></div>`;
}

function missionStage() {
  const current = MISSIONS.find((m) => m.id === state.missionId);
  return `${stageHead(bi('Missões', 'Missions'))}
  <p class="sub">${bi('Silhuetas e rotas não são telemetria. Datas separadas de lançamento, encontro e fim.', 'Silhouettes and routes are not telemetry. Launch, encounter, and end dates stay separate.')}</p>
  ${MISSIONS.map((m) => `<article class="card"><strong>${m.name}</strong> · ${m.agency}<p>${tx(m.summary)}</p><p class="sub">${m.launch || ''} ${m.arrival || ''} ${m.end || ''} ${tx(m.encounter) || ''}</p><p class="sub">${tx(m.statusNote) || ''}</p><a href="${m.href}" target="_blank" rel="noreferrer">NASA</a> <button class="btn" data-act="mission" data-arg="${m.id}">${bi('Abrir', 'Open')}</button></article>`).join('')}
  ${current ? `<p class="banner">${current.name}</p>` : ''}`;
}

function glossaryStage() {
  const q = norm(state.search);
  const list = GLOSSARY.filter((g) => !q || norm([tx(g.title), ...(g.synonyms || [])].join(' ')).includes(q));
  const article = GLOSSARY.find((g) => g.id === state.glossaryId) || GLOSSARY[0];
  return `${stageHead(bi('Enciclopédia', 'Encyclopedia'))}
  <div class="grid-2"><div class="scroll">${list.map((g) => `<button class="nav-item" data-act="glossary" data-arg="${g.id}">${tx(g.title)}</button>`).join('')}</div>
  <article><h3>${tx(article.title)}</h3><p>${tx(article.short)}</p><p class="sub">${tx(article.deep)}</p>
  ${article.tool ? `<button class="btn" data-act="tool" data-arg="${article.tool}">${bi('Abrir exemplo', 'Open example')}</button>` : ''}</article></div>`;
}

function journalStage() {
  return `${stageHead(bi('Diário e vistas', 'Journal and views'))}
  <textarea id="note" aria-label="${bi('Nota', 'Note')}">${state.journalDraft}</textarea>
  <button class="btn primary" data-act="save-note">${bi('Guardar nota', 'Save note')}</button>
  ${state.journal.map((n) => `<p class="card">${n.text}<br><small>${formatJdUtc(n.jd, state.lang)}</small> <button data-act="del-note" data-arg="${n.id}">${bi('Apagar esta nota', 'Delete this note')}</button></p>`).join('') || `<p>${bi('Nenhuma nota.', 'No notes.')}</p>`}
  <input id="view-name" placeholder="${bi('Nome da vista', 'View name')}"/>
  <label><input id="view-date" type="checkbox"/> ${bi('Restaurar a data', 'Restore the date')}</label>
  <button class="btn" data-act="save-view">${bi('Guardar vista', 'Save view')}</button>
  ${state.viewpoints.map((v) => `<button class="btn" data-act="load-view" data-arg="${v.id}">${v.title}</button>`).join('')}
  <input id="bookmark-name" placeholder="${bi('Nome do instante', 'Instant name')}"/>
  <button class="btn" data-act="bookmark">${bi('Marcar instante', 'Bookmark instant')}</button>
  ${state.bookmarks.map((b) => `<button class="btn" data-act="goto-bookmark" data-arg="${b.id}">${b.name}</button>`).join('')}
  ${EVENTS.map((e) => `<button class="btn" data-act="event" data-arg="${e.id}">${e.kind}: ${tx(e.title)}</button>`).join('')}
  <button class="btn" data-act="ask-clear" data-arg="journal">${bi('Apagar todas as notas…', 'Clear all notes…')}</button>`;
}

function learnStage() {
  const run = ACTIVITIES.find((a) => a.id === state.activityRun?.id);
  return `${stageHead(bi('Atividades', 'Activities'))}
  <div class="cards">${ACTIVITIES.map((a) => `<button class="card" data-act="activity" data-arg="${a.id}"><strong>${tx(a.title)}</strong><br><span class="sub">${state.activityProgress[a.id]?.status || ''}</span></button>`).join('')}</div>
  ${run ? `<article class="card"><h3>${tx(run.title)}</h3><p>${tx(run.objective)}</p><p class="sub">${tx(run.hint)}</p>
  ${(run.choices || []).map((c) => `<button class="btn" data-act="activity-answer" data-arg="${c.id}">${tx(c.label)}</button>`).join('')}
  <button class="btn primary" data-act="activity-answer" data-arg="check">${bi('Verificar', 'Check')}</button>
  ${state.activityRun?.status ? `<p>${tx(run.explain)}</p>` : ''}</article>` : ''}`;
}

function apparentStage() {
  const samples = [];
  for (let i = 0; i <= 24; i += 1) {
    const jd = state.jd + i * 15;
    const earth = bodyAu('earth', jd, accuracyNow())?.au;
    const mars = bodyAu('mars', jd, accuracyNow())?.au;
    if (!earth || !mars) continue;
    const v = { x: mars.x - earth.x, y: mars.y - earth.y };
    samples.push(Math.atan2(v.y, v.x));
  }
  return `${stageHead(bi('Movimento aparente', 'Apparent motion'))}
  <p>${bi('Longitude eclíptica de Marte vista da Terra, sem tempo de luz, aberração ou topocentrismo. É uma geometria simplificada.', 'Ecliptic longitude of Mars as seen from Earth, without light time, aberration, or a topocentric observer. It is simplified geometry.')}</p>
  <p class="num">${samples.map((n) => formatNumber(n * 180 / Math.PI, state.lang, 0)).join(' · ')}</p>
  <p class="sub">${bi('Referencial atual', 'Current frame')}: ${state.frame === 'sun' ? bi('Sol', 'Sun') : tx(getBody(state.frame)?.name || getBody(state.selectedId)?.name)}</p>
  <button class="btn" data-act="frame">${bi('Alternar referencial visual', 'Toggle visual frame')}</button>`;
}

function tourbar() {
  const tour = TOURS.find((t) => t.id === state.tour.id);
  const stop = tour.stops[state.tour.index];
  return `<div class="progress"><span style="width:${((state.tour.index + 1) / tour.stops.length) * 100}%"></span></div>
  <strong>${tx(tour.title)} · ${state.tour.index + 1}/${tour.stops.length} · ${state.tour.status}</strong>
  <p>${tx(stop.text)}</p>
  <div class="row"><button class="btn" data-act="tour-prev">${bi('Anterior', 'Previous')}</button>
  <button class="btn" data-act="tour-pause">${state.tour.status === 'playing' ? bi('Pausar', 'Pause') : bi('Retomar', 'Resume')}</button>
  <button class="btn" data-act="tour-next">${bi('Próxima', 'Next')}</button>
  <button class="btn" data-act="tour-restart">${bi('Recomeçar parada', 'Restart stop')}</button>
  <button class="btn" data-act="tour-exit">${bi('Sair', 'Exit')}</button></div>
  <div class="row">${tour.stops.map((s, i) => `<button class="btn ${i === state.tour.index ? 'active' : ''}" data-act="tour-jump" data-arg="${i}">${i + 1}</button>`).join('')}</div>`;
}

function photobar() {
  return `<div class="row"><button class="btn primary" data-act="shoot">${bi('Salvar PNG', 'Save PNG')}</button>
  <button class="btn" data-act="record">${state.recording ? bi('Parar', 'Stop') : bi('Gravar 20 s', 'Record 20 s')}</button>
  <button class="btn" data-act="close-tool">${bi('Sair da foto', 'Exit photo')}</button>
  <button class="btn" data-act="fullscreen">${bi('Tela cheia', 'Fullscreen')}</button>
  ${CINEMATIC.map((c) => `<button class="btn" data-act="focus" data-arg="${c.target}">${tx(c.title)}</button>`).join('')}</div>
  <div id="shot-preview"></div>
  <p class="sub">${bi('A legenda em HTML não entra no arquivo. A imagem é a tela 3D.', 'HTML captions are not in the file. The image is the 3D view.')}</p>`;
}

function checklist() {
  const items = [['planet', bi('Visitar um planeta', 'Visit a planet')], ['moon', bi('Seguir uma lua', 'Follow a moon')], ['reverse', bi('Inverter o tempo', 'Reverse time')], ['compare', bi('Comparar dois corpos', 'Compare two bodies')], ['scale', bi('Ler a escala', 'Read the scale')]];
  const done = items.filter(([k]) => state.checklist[k]).length;
  return `<button class="btn" data-act="check-hide">${bi('Descobertas', 'Discoveries')} ${done}/5</button>
  ${state.checklistOpen ? `<ul>${items.map(([k, label]) => `<li>${state.checklist[k] ? '✓' : '○'} ${label}</li>`).join('')}</ul>` : ''}`;
}

function renderPalette() {
  const q = norm(state.commandQuery || '');
  const commands = [
    [bi('Enquadrar Saturno', 'Focus Saturn'), () => onFocus('saturn')],
    [bi('Pausar', 'Pause'), () => togglePlay()],
    [bi('Comparar', 'Compare'), () => openTool('compare')],
    [bi('Rótulos', 'Labels'), () => act('labels')],
    [bi('Grande passeio', 'Grand tour'), () => startTour('grand')],
  ];
  const bodies = BODIES.filter((b) => !q || norm(tx(b.name)).includes(q)).slice(0, 8);
  $('#palette').innerHTML = `<input id="command" placeholder="${bi('Comando ou corpo', 'Command or body')}" />
  ${commands.filter(([label]) => !q || norm(label).includes(q)).map(([label, fn], i) => `<button class="nav-item" data-cmd="${i}">${label}</button>`).join('')}
  ${bodies.map((b) => `<button class="nav-item" data-act="select" data-arg="${b.id}">${tx(b.name)}</button>`).join('')}`;
  $('#palette').querySelectorAll('[data-cmd]').forEach((btn, i) => btn.addEventListener('click', () => { commands[i][1](); commit(() => { state.paletteOpen = false; }); }));
}

function live() {
  const body = getBody(state.selectedId);
  if (body) {
    const row = bodyAu(body.id, state.jd, accuracyNow());
    const sun = row?.au ? geometricDistanceKm(row.au, { x: 0, y: 0, z: 0 }) : null;
    const sunText = sun?.ok ? `${formatNumber(sun.au, state.lang, 3)} UA` : '—';
    document.querySelectorAll('[data-live="sun"], [data-live="dist"]').forEach((n) => { n.textContent = sunText; });
    if (body.parent && body.parent !== 'sun') {
      const rel = parentRelativeAu(body.id, state.jd, accuracyNow());
      const node = document.querySelector('[data-live="parent"]');
      if (node && rel.ok) node.textContent = `${formatNumber(len(rel.au) * AU_KM, state.lang, 0)} km`;
    }
  }
  const fps = document.querySelector('[data-live="fps"]');
  if (fps) fps.textContent = formatNumber(state.fps || 0, state.lang, 0);
  const clock = document.querySelector('#timebar .clock');
  if (clock) clock.textContent = `${state.playing ? '' : bi('Pausado · ', 'Paused · ')}${ratePhrase(state.rate)} · ${formatJdUtc(state.jd, state.lang)}`;
  const readout = $('#measure-readout');
  if (readout && state.measure?.a && state.measure?.b) readout.textContent = measureText();
  const k = state.labs.kepler;
  if (k.running && state.tool === 'kepler') k.angle += 0.01;
}

function drawLabNumbers() {
  const day = $('#daylight');
  if (day && state.tool === 'seasons') {
    const result = daylightHours(state.labs.seasons);
    day.textContent = result.ok ? `${formatNumber(result.hours, state.lang, 1)} h · ${result.kind}` : '—';
  }
  const box = $('#earth-size');
  if (box && state.tool === 'scale-lab') {
    const earth = earthIfSize(state.labs.scale.earthMm, 6378.1366, 1);
    const jup = earthIfSize(state.labs.scale.earthMm, 71492, 5.2);
    box.textContent = earth.ok ? `${bi('Terra', 'Earth')} ${formatNumber(earth.diameterMm, state.lang, 1)} mm · 1 UA ${formatNumber(earth.sunDistanceMm / 1000, state.lang, 1)} m · ${bi('Júpiter', 'Jupiter')} ${formatNumber(jup.diameterMm, state.lang, 1)} mm` : '';
  }
}

function measureText() {
  const m = state.measure;
  if (!m?.a || !m?.b) return '';
  const A = bodyAu(m.a, state.jd, accuracyNow())?.au;
  const B = bodyAu(m.b, state.jd, accuracyNow())?.au;
  const dist = geometricDistanceKm(A, B);
  if (!dist.ok) return bi('Medida indisponível.', 'Measurement unavailable.');
  const light = lightTimeSeconds(dist.km);
  const radii = surfaceSeparationKm(dist.km, getBody(m.a)?.radiusEqKm || 0, getBody(m.b)?.radiusEqKm || 0);
  return `${tx(getBody(m.a).name)} → ${tx(getBody(m.b).name)}: ${formatSci(dist.km, state.lang)} km · ${formatNumber(dist.au, state.lang, 4)} UA · ${formatDuration(light.seconds, state.lang)} · ${bi('separação de superfícies', 'surface separation')} ${formatSci(radii.km, state.lang)} km`;
}

function placeLabels() {
  if (!world) return;
  const host = $('#labels');
  if (!host) return;
  const items = world.projections().filter((p) => showLabel(p.id) && !p.behind);
  const placed = [];
  const seen = new Set();
  for (const item of items.sort((a, b) => b.priority - a.priority)) {
    if (item.radiusPx < 2 && state.scaleMode === 'relative') item.x += 10;
    let hidden = false;
    for (const other of placed) {
      if (Math.hypot(other.x - item.x, other.y - item.y) < 46) hidden = item.priority < 80;
    }
    if (hidden && state.labelDensity !== 'high') continue;
    placed.push(item);
    seen.add(item.id);
    let node = labelNodes.get(item.id);
    if (!node) {
      node = document.createElement('button');
      node.className = 'label';
      node.addEventListener('click', () => onSelect(item.id, []));
      host.appendChild(node);
      labelNodes.set(item.id, node);
    }
    node.textContent = tx(getBody(item.id).name);
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    node.classList.toggle('selected', item.id === state.selectedId);
    node.classList.toggle('hidden', false);
  }
  for (const [id, node] of labelNodes) if (!seen.has(id)) node.classList.add('hidden');
}

function showLabel(id) {
  const body = getBody(id);
  if (!body || state.labels === 'none') return false;
  if (state.labels === 'selected') return id === state.selectedId;
  if (state.labels === 'favorites') return state.favorites.includes(id);
  if (state.labels === 'system') return id === state.selectedId || body.parent === state.selectedId || id === getBody(state.selectedId)?.parent;
  return body.type === 'planet' || id === 'sun' || id === 'moon';
}

function drawMap() {
  const canvas = $('#minimap');
  if (!canvas || !world) return;
  const ctx = canvas.getContext('2d');
  const data = world.mapData();
  ctx.clearRect(0, 0, 148, 148);
  ctx.fillStyle = '#10192a';
  ctx.fillRect(0, 0, 148, 148);
  const max = Math.max(20, ...data.pts.map((p) => Math.hypot(p.x, p.z)));
  const map = (x, z) => [74 + (x / max) * 60, 74 + (z / max) * 60];
  ctx.strokeStyle = '#355068';
  data.pts.forEach((p) => {
    ctx.beginPath();
    const [x, y] = map(p.x, p.z);
    ctx.arc(x, y, p.id === 'sun' ? 4 : 2, 0, Math.PI * 2);
    ctx.stroke();
  });
  const [cx, cy] = map(data.camera.x, data.camera.z);
  ctx.fillStyle = '#7fd3e8';
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}

function norm(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function start() {
  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden) {
      if (!hiddenAt) hiddenAt = now;
      last = now;
      return;
    }
    if (hiddenAt) {
      const gap = (now - hiddenAt) / 1000;
      hiddenAt = 0;
      if (state.prefs.catchUp && state.playing) integrate(Math.min(30, gap));
      last = now;
    }
    let dt = (now - last) / 1000;
    last = now;
    if (!state.prefs.catchUp) dt = Math.min(dt, 0.25);
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    integrate(dt);
    const cover = ['scale-lab', 'seasons', 'moon-lab', 'kepler'].includes(state.tool);
    if (world && state.webglOk && !cover && !state.contextLost) {
      world.update(dt);
      world.render();
      placeLabels();
      if (now % 200 < 32) drawMap();
    }
    if (now % 250 < 32) live();
    tourTick(now);
    const date = $('#date-field');
    if (date && document.activeElement !== date) date.value = toField(state.jd);
  };
  requestAnimationFrame(loop);
  world?.resize();
  window.addEventListener('resize', () => world?.resize());
  canvasClickMap();
}

function canvasClickMap() {
  $('#minimap')?.addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 74;
    const y = e.clientY - rect.top - 74;
    world?.pointTheta(Math.atan2(x, y));
  });
}

// Keep a few imported symbols used by future checks and avoid tree-shaking confusion in plain scripts.
void JPL_ELEMENTS;
void SIMPLE_ORBITS;
void MOON_MU;
void systemAt;
void angularSeparation;
void jplElementsAt;
void approximateSolarDay;
void BODY_BY_ID;
