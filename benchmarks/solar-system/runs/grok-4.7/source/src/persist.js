import { getBody } from './catalog.js';
import { MAX_RATE, SESSION_JD } from './science.js';
import { state } from './state.js';

export const STORAGE_KEY = 'sso.observatory.v1';

const MAX_TEXT = 4000;
const MAX_ITEMS = 200;

function memory() {
  try {
    const k = '__sso_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable() {
  return memory();
}

function cleanText(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').slice(0, max);
}

function cleanId(id) {
  return typeof id === 'string' && getBody(id) ? id : null;
}

function cleanNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

export function packState(includeJournal = true) {
  return {
    version: 1,
    lang: state.lang,
    jd: state.jd,
    playing: state.playing,
    direction: state.direction,
    rate: state.rate,
    scaleMode: state.scaleMode,
    presentation: state.presentation,
    quality: state.quality,
    labels: state.labels,
    orbits: state.orbits,
    favorites: state.favorites,
    viewpoints: state.viewpoints,
    bookmarks: state.bookmarks,
    journal: includeJournal ? state.journal : [],
    onboarding: state.onboarding,
    checklist: state.checklist,
    activityProgress: state.activityProgress,
    tourProgress: state.tourProgress,
    milestones: state.milestones,
    prefs: state.prefs,
    keplerPresets: state.keplerPresets || [],
    selectedId: state.selectedId,
  };
}

export function validateBundle(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['not-object'], data: null };
  if (raw.version !== 1) return { ok: false, errors: ['version'], data: null };
  const data = {
    version: 1,
    lang: raw.lang === 'en' ? 'en' : 'pt',
    favorites: [],
    viewpoints: [],
    bookmarks: [],
    journal: [],
    dropped: [],
  };
  if (Array.isArray(raw.favorites)) {
    for (const id of raw.favorites.slice(0, MAX_ITEMS)) {
      const clean = cleanId(id);
      if (clean) data.favorites.push(clean);
      else data.dropped.push('favorite');
    }
  }
  if (Array.isArray(raw.viewpoints)) {
    for (const item of raw.viewpoints.slice(0, MAX_ITEMS)) {
      const targetId = cleanId(item?.targetId);
      const radius = cleanNumber(item?.radius, 1e-6, 1e7);
      if (!targetId || radius == null || typeof item?.title !== 'string') {
        data.dropped.push('viewpoint');
        continue;
      }
      data.viewpoints.push({
        id: cleanText(item.id || '', 80) || `vp-${data.viewpoints.length}`,
        title: cleanText(item.title, 120),
        targetId,
        theta: cleanNumber(item.theta, -20, 20) ?? 0.6,
        phi: cleanNumber(item.phi, 0.05, Math.PI - 0.05) ?? 1.1,
        radius,
        scaleMode: item.scaleMode === 'relative' ? 'relative' : 'exploration',
        restoreDate: Boolean(item.restoreDate),
        jd: cleanNumber(item.jd, -1e7, 1e7),
        labels: typeof item.labels === 'string' ? item.labels : 'major',
        orbits: typeof item.orbits === 'string' ? item.orbits : 'all',
      });
    }
  }
  if (Array.isArray(raw.bookmarks)) {
    for (const item of raw.bookmarks.slice(0, MAX_ITEMS)) {
      const jd = cleanNumber(item?.jd, -1e7, 1e7);
      if (jd == null || typeof item?.name !== 'string') {
        data.dropped.push('bookmark');
        continue;
      }
      data.bookmarks.push({
        id: cleanText(item.id || '', 80) || `bm-${data.bookmarks.length}`,
        name: cleanText(item.name, 120),
        jd,
        scaleMode: item.scaleMode === 'relative' ? 'relative' : 'exploration',
        bodyId: cleanId(item.bodyId),
      });
    }
  }
  if (Array.isArray(raw.journal)) {
    for (const item of raw.journal.slice(0, MAX_ITEMS)) {
      if (typeof item?.text !== 'string') {
        data.dropped.push('journal');
        continue;
      }
      data.journal.push({
        id: cleanText(item.id || '', 80) || `jn-${data.journal.length}`,
        text: cleanText(item.text),
        bodyId: cleanId(item.bodyId),
        jd: cleanNumber(item.jd, -1e7, 1e7) ?? SESSION_JD,
        measurement: cleanText(item.measurement || '', 500),
      });
    }
  }
  if (raw.prefs && typeof raw.prefs === 'object') data.prefs = raw.prefs;
  if (raw.onboarding && typeof raw.onboarding === 'object') data.onboarding = raw.onboarding;
  if (raw.checklist && typeof raw.checklist === 'object') data.checklist = raw.checklist;
  if (raw.activityProgress && typeof raw.activityProgress === 'object') data.activityProgress = raw.activityProgress;
  if (raw.tourProgress && typeof raw.tourProgress === 'object') data.tourProgress = raw.tourProgress;
  if (raw.milestones && typeof raw.milestones === 'object') data.milestones = raw.milestones;
  if (Array.isArray(raw.keplerPresets)) data.keplerPresets = raw.keplerPresets.slice(0, 30);
  data.jd = cleanNumber(raw.jd, -1e7, 1e7);
  data.rate = cleanNumber(raw.rate, 0, MAX_RATE);
  data.direction = raw.direction === -1 ? -1 : 1;
  data.playing = Boolean(raw.playing);
  data.scaleMode = raw.scaleMode === 'relative' ? 'relative' : 'exploration';
  data.presentation = raw.presentation === 'enhanced' ? 'enhanced' : 'natural';
  data.labels = typeof raw.labels === 'string' ? raw.labels : 'major';
  data.orbits = typeof raw.orbits === 'string' ? raw.orbits : 'all';
  data.selectedId = cleanId(raw.selectedId);
  data.lang = raw.lang === 'en' ? 'en' : 'pt';
  if (data.dropped.length) errors.push('partial');
  return { ok: true, errors, data };
}

export function saveLocal() {
  if (!storageAvailable()) {
    state.storageNote = 'unavailable';
    return { ok: false, reason: 'unavailable' };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packState(true)));
    state.storageNote = '';
    return { ok: true };
  } catch {
    state.storageNote = 'full';
    return { ok: false, reason: 'full' };
  }
}

export function loadLocal() {
  if (!storageAvailable()) return { ok: false, reason: 'unavailable' };
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return { ok: false, reason: 'empty' };
    const parsed = JSON.parse(text);
    return validateBundle(parsed);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export function applyBundle(data, { merge = true } = {}) {
  if (!merge) {
    state.favorites = [];
    state.viewpoints = [];
    state.bookmarks = [];
    state.journal = [];
  }
  const have = new Set(state.favorites);
  for (const id of data.favorites || []) if (!have.has(id)) state.favorites.push(id);
  if (!merge) state.viewpoints = data.viewpoints || [];
  else state.viewpoints = state.viewpoints.concat(data.viewpoints || []);
  if (!merge) state.bookmarks = data.bookmarks || [];
  else state.bookmarks = state.bookmarks.concat(data.bookmarks || []);
  if (!merge) state.journal = data.journal || [];
  else state.journal = state.journal.concat(data.journal || []);
  if (data.prefs) state.prefs = { ...state.prefs, ...sanitizePrefs(data.prefs) };
  if (data.lang) state.lang = data.lang;
  if (data.scaleMode) state.scaleMode = data.scaleMode;
  if (data.labels) state.labels = data.labels;
  if (data.orbits) state.orbits = data.orbits;
  if (data.presentation) state.presentation = data.presentation;
  if (data.jd) state.jd = data.jd;
  if (data.rate != null) state.rate = data.rate;
  if (data.selectedId) state.selectedId = data.selectedId;
  if (data.onboarding) state.onboarding = { ...state.onboarding, ...data.onboarding };
  if (data.checklist) state.checklist = { ...state.checklist, ...data.checklist };
  if (data.activityProgress) state.activityProgress = { ...state.activityProgress, ...data.activityProgress };
  if (data.tourProgress) state.tourProgress = { ...state.tourProgress, ...data.tourProgress };
  if (data.milestones) state.milestones = { ...state.milestones, ...data.milestones };
  if (data.keplerPresets) state.keplerPresets = data.keplerPresets;
}

function sanitizePrefs(prefs) {
  const next = {};
  if (prefs.units === 'familiar' || prefs.units === 'metric') next.units = prefs.units;
  if (['sm', 'md', 'lg'].includes(prefs.uiScale)) next.uiScale = prefs.uiScale;
  const opacity = Number(prefs.panelOpacity);
  if (Number.isFinite(opacity)) next.panelOpacity = Math.min(1, Math.max(0.45, opacity));
  for (const key of ['reducedMotion', 'highContrast', 'ambient', 'uiSound', 'narration', 'muted', 'catchUp', 'simplified']) {
    if (typeof prefs[key] === 'boolean') next[key] = prefs[key];
  }
  const bg = Number(prefs.background);
  if (Number.isFinite(bg)) next.background = Math.min(1, Math.max(0, bg));
  return next;
}

export function sceneShare() {
  return {
    v: 1,
    body: state.selectedId,
    jd: state.jd,
    scale: state.scaleMode,
    labels: state.labels,
    orbits: state.orbits,
    presentation: state.presentation,
    follow: state.followId,
  };
}
