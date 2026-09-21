import { JD_PRIMARY_END, JD_PRIMARY_START, SESSION_JD, clampJd } from './science.js';

export const DEFAULT_RATE = 86400;

export function defaultState() {
  return {
    lang: 'pt',
    jd: SESSION_JD,
    playing: true,
    direction: 1,
    rate: DEFAULT_RATE,
    resumeRate: DEFAULT_RATE,
    allowExtended: false,
    boundary: null,
    selectedId: null,
    followId: null,
    scaleMode: 'exploration',
    presentation: 'natural',
    quality: 'auto',
    effectiveQuality: 'high',
    labels: 'major',
    labelDensity: 'normal',
    orbits: 'all',
    trails: false,
    trailHours: 240,
    layers: {
      moons: false,
      dwarfs: true,
      small: true,
      asteroids: true,
      kuiper: false,
      grid: false,
      axes: false,
      velocity: false,
      nodes: false,
      faintRings: false,
    },
    frame: 'sun',
    tool: null,
    toolSnapshot: null,
    compareIds: ['earth', 'mars'],
    compareRef: 'earth',
    compareLog: false,
    compareSpin: false,
    compareFreezeJd: null,
    measure: null,
    measureHistory: [],
    tour: null,
    photo: false,
    labs: {
      seasons: { body: 'earth', tilt: 23.44, orbit: 0, latitude: -23, revealed: false, experimental: false },
      moon: { elongation: 90, inclination: 5.145, node: 0, useSim: false },
      kepler: {
        central: 'sun',
        massKg: 1.9885e30,
        radiusKm: 695700,
        aKm: 149597870.7,
        e: 0.2,
        testMassKg: 1,
        weightMassKg: 70,
        running: false,
        angle: 0,
      },
      scale: { view: 'sizes', log: false, includeSun: true, earthMm: 10, ids: ['sun', 'earth', 'jupiter', 'saturn'] },
      beyond: { stage: 0, origin: 'sun' },
    },
    favorites: [],
    recent: [],
    visited: [],
    viewpoints: [],
    bookmarks: [],
    journal: [],
    journalDraft: '',
    onboarding: { welcome: true, hints: { camera: false, select: false, time: false, scale: false }, checklistHidden: false },
    checklist: { planet: false, moon: false, reverse: false, compare: false, scale: false },
    activityProgress: {},
    activityRun: null,
    sequence: null,
    tourProgress: {},
    milestones: {},
    prefs: {
      units: 'metric',
      uiScale: 'md',
      panelOpacity: 0.88,
      reducedMotion: false,
      highContrast: false,
      background: 0.85,
      ambient: false,
      uiSound: false,
      narration: false,
      muted: true,
      catchUp: false,
      simplified: false,
    },
    venusRadar: false,
    tidalOverlay: false,
    distractionFree: false,
    navigatorOpen: true,
    inspectorOpen: false,
    inspectorTab: 'overview',
    search: '',
    sort: 'catalog',
    filter: 'all',
    helpOpen: false,
    settingsOpen: false,
    paletteOpen: false,
    stepId: 'day',
    scrubbing: false,
    scrubWasPlaying: false,
    message: null,
    storageNote: '',
    importPreview: null,
    fps: 0,
    qualityNote: '',
    webglOk: true,
    contextLost: false,
    openedSourcesFor: null,
    didCompleteOrbit: null,
    prediction: {},
    cameraKeys: false,
    panMode: false,
    pendingFocus: null,
    lastLiveMeasure: null,
    audioReady: false,
    recording: false,
    photoFreezeWasPlaying: false,
    hiddenWasPlaying: false,
    trailBreakNote: false,
    scaleExplained: false,
    commandQuery: '',
  };
}

export const state = defaultState();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn();
}

export function commit(mutator) {
  mutator(state);
  emit();
}

export function integrate(realDt) {
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (hidden && !state.prefs.catchUp) return;
  if (!state.playing || !(state.rate > 0)) return;
  if (state.scrubbing || state.photo) return;
  const deltaDays = (realDt * state.rate * state.direction) / 86400;
  const clamped = clampJd(state.jd + deltaDays, state.allowExtended);
  state.jd = clamped.jd;
  if (clamped.hit) {
    state.playing = false;
    state.boundary = clamped;
    emit();
  }
}

export function accuracyNow() {
  if (state.jd >= JD_PRIMARY_START && state.jd <= JD_PRIMARY_END) return 'primary';
  if (state.allowExtended) return 'extended';
  return 'primary';
}
