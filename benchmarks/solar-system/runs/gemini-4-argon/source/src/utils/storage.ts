import {
  CameraMode,
  HypotheticalOrbitPreset,
  JournalEntry,
  LabelMode,
  OrbitMode,
  PersistedStoreV1,
  SavedViewpoint,
  ScaleMode,
  TimeBookmark,
  UserPreferences,
} from '../types/solarSystem';
import { CATALOG_BY_ID } from '../data/celestialCatalog';
import { PRESET_TIME_BOOKMARKS } from '../data/educationalContent';
import {
  DEFAULT_SESSION_START_MS,
  MAX_SUPPORTED_DATE_MS,
  MIN_SUPPORTED_DATE_MS,
} from '../engine/ephemeris';

export const STORAGE_KEY_V1 = 'solar_system_observatory_store_v1';

export function getDefaultPreferences(): UserPreferences {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    language: 'pt-BR',
    scaleMode: 'exploration',
    presentationMode: 'natural',
    qualityPreset: 'high',
    workspacePreset: 'cinematic',
    labelMode: 'major',
    labelDensity: 'standard',
    orbitMode: 'all',
    showTrails: false,
    trailDurationDays: 90,
    showEclipticGrid: false,
    showCardinalIndicators: false,
    showPerihelionAphelion: false,
    showVelocityVectors: false,
    showAxialArrows: false,
    showTidalLockingOverlay: false,
    showAsteroidBelt: true,
    showKuiperBelt: true,
    backgroundIntensity: 0.85,
    cleanBackground: false,
    ambientExposure: 0.32,
    venusSurfaceRadarMode: false,
    interfaceSize: 'normal',
    panelOpacity: 0.9,
    highContrastLabels: false,
    reducedMotion: prefersReducedMotion,
    unitSystem: 'metric',
    backgroundCatchUp: false,
    soundEnabled: false,
    ambientAudioEnabled: false,
    uiSoundEnabled: false,
    narrationEnabled: false,
    onboardingCompleted: false,
  };
}

export function getDefaultPersistedStore(): PersistedStoreV1 {
  return {
    schemaVersion: 1,
    preferences: getDefaultPreferences(),
    favorites: ['earth', 'saturn', 'jupiter'],
    visitedBodies: ['sun', 'earth'],
    recentBodies: ['earth', 'sun'],
    discoveryChecklist: {
      visitPlanet: false,
      followMoon: false,
      reverseTime: false,
      compareBodies: false,
      inspectScale: false,
    },
    savedViewpoints: [
      {
        id: 'vp_earth_terminator',
        title: 'Terra no Terminador Solar',
        targetId: 'earth',
        cameraMode: 'focus',
        cameraOffset: { x: 3.4, y: 1.4, z: 3.2 },
        simTimeMs: DEFAULT_SESSION_START_MS,
        restoreDateOnVisit: false,
        scaleMode: 'exploration',
        labelMode: 'major',
        orbitMode: 'all',
        createdAt: '2025-03-20T12:00:00.000Z',
      },
      {
        id: 'vp_saturn_rings',
        title: 'Saturno Acima do Plano dos Anéis',
        targetId: 'saturn',
        cameraMode: 'focus',
        cameraOffset: { x: 8.5, y: 4.8, z: 8.5 },
        simTimeMs: DEFAULT_SESSION_START_MS,
        restoreDateOnVisit: false,
        scaleMode: 'exploration',
        labelMode: 'major',
        orbitMode: 'all',
        createdAt: '2025-03-20T12:00:00.000Z',
      },
    ],
    bookmarks: [...PRESET_TIME_BOOKMARKS],
    journalEntries: [],
    savedOrbitExperiments: [
      {
        id: 'preset_earth_like',
        name: 'Órbita Tipo Terra (Circular, 1 UA)',
        centralMassSolar: 1.0,
        semiMajorAxisAu: 1.0,
        eccentricity: 0.0167,
        testMassKg: 1000,
      },
      {
        id: 'preset_eccentric_comet',
        name: 'Órbita Elíptica Excêntrica (e = 0,65)',
        centralMassSolar: 1.0,
        semiMajorAxisAu: 2.5,
        eccentricity: 0.65,
        testMassKg: 500,
      },
    ],
    completedTours: [],
    completedActivities: [],
    activeActivitySequenceId: null,
  };
}

function sanitizeText(input: unknown, maxLength = 500, fallback = ''): string {
  if (typeof input !== 'string') return fallback;
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLength);
}

export interface StorageLoadResult {
  store: PersistedStoreV1;
  storageAvailable: boolean;
  recoveryWarnings: string[];
}

export function validateAndRecoverStore(raw: unknown): {
  store: PersistedStoreV1;
  warnings: string[];
} {
  const base = getDefaultPersistedStore();
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    warnings.push('Formato de dados inválido; restaurando configuração padrão.');
    return { store: base, warnings };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1) {
    warnings.push(
      `Versão de esquema não suportada (${String(obj.schemaVersion)}); entradas compatíveis foram recuperadas.`
    );
  }

  if (obj.preferences && typeof obj.preferences === 'object') {
    const p = obj.preferences as Record<string, unknown>;
    if (p.language === 'pt-BR' || p.language === 'en') base.preferences.language = p.language;
    if (p.scaleMode === 'exploration' || p.scaleMode === 'relative')
      base.preferences.scaleMode = p.scaleMode;
    if (p.presentationMode === 'natural' || p.presentationMode === 'enhanced')
      base.preferences.presentationMode = p.presentationMode;
    if (
      p.qualityPreset === 'auto' ||
      p.qualityPreset === 'high' ||
      p.qualityPreset === 'balanced' ||
      p.qualityPreset === 'low'
    )
      base.preferences.qualityPreset = p.qualityPreset;
    if (
      p.labelMode === 'major' ||
      p.labelMode === 'selected_system' ||
      p.labelMode === 'selected' ||
      p.labelMode === 'favorites' ||
      p.labelMode === 'none'
    )
      base.preferences.labelMode = p.labelMode;
    if (
      p.orbitMode === 'all' ||
      p.orbitMode === 'selected' ||
      p.orbitMode === 'selected_system' ||
      p.orbitMode === 'none'
    )
      base.preferences.orbitMode = p.orbitMode;
    if (typeof p.showTrails === 'boolean') base.preferences.showTrails = p.showTrails;
    if (typeof p.showEclipticGrid === 'boolean')
      base.preferences.showEclipticGrid = p.showEclipticGrid;
    if (typeof p.showCardinalIndicators === 'boolean')
      base.preferences.showCardinalIndicators = p.showCardinalIndicators;
    if (typeof p.showPerihelionAphelion === 'boolean')
      base.preferences.showPerihelionAphelion = p.showPerihelionAphelion;
    if (typeof p.showVelocityVectors === 'boolean')
      base.preferences.showVelocityVectors = p.showVelocityVectors;
    if (typeof p.showAxialArrows === 'boolean')
      base.preferences.showAxialArrows = p.showAxialArrows;
    if (typeof p.showTidalLockingOverlay === 'boolean')
      base.preferences.showTidalLockingOverlay = p.showTidalLockingOverlay;
    if (typeof p.showAsteroidBelt === 'boolean')
      base.preferences.showAsteroidBelt = p.showAsteroidBelt;
    if (typeof p.showKuiperBelt === 'boolean')
      base.preferences.showKuiperBelt = p.showKuiperBelt;
    if (typeof p.backgroundIntensity === 'number' && Number.isFinite(p.backgroundIntensity))
      base.preferences.backgroundIntensity = Math.max(0, Math.min(1, p.backgroundIntensity));
    if (typeof p.cleanBackground === 'boolean')
      base.preferences.cleanBackground = p.cleanBackground;
    if (typeof p.ambientExposure === 'number' && Number.isFinite(p.ambientExposure))
      base.preferences.ambientExposure = Math.max(0.05, Math.min(1, p.ambientExposure));
    if (typeof p.venusSurfaceRadarMode === 'boolean')
      base.preferences.venusSurfaceRadarMode = p.venusSurfaceRadarMode;
    if (p.interfaceSize === 'normal' || p.interfaceSize === 'large')
      base.preferences.interfaceSize = p.interfaceSize;
    if (typeof p.panelOpacity === 'number' && Number.isFinite(p.panelOpacity))
      base.preferences.panelOpacity = Math.max(0.65, Math.min(1, p.panelOpacity));
    if (typeof p.highContrastLabels === 'boolean')
      base.preferences.highContrastLabels = p.highContrastLabels;
    if (typeof p.reducedMotion === 'boolean') base.preferences.reducedMotion = p.reducedMotion;
    if (p.unitSystem === 'metric' || p.unitSystem === 'familiar')
      base.preferences.unitSystem = p.unitSystem;
    if (typeof p.onboardingCompleted === 'boolean')
      base.preferences.onboardingCompleted = p.onboardingCompleted;
  }

  if (Array.isArray(obj.favorites)) {
    base.favorites = obj.favorites.filter(
      (id): id is string => typeof id === 'string' && Boolean(CATALOG_BY_ID[id])
    );
  }

  if (Array.isArray(obj.visitedBodies)) {
    base.visitedBodies = obj.visitedBodies.filter(
      (id): id is string => typeof id === 'string' && Boolean(CATALOG_BY_ID[id])
    );
  }

  if (Array.isArray(obj.savedViewpoints)) {
    const validVps: SavedViewpoint[] = [];
    for (const item of obj.savedViewpoints) {
      if (!item || typeof item !== 'object') {
        warnings.push('Um ponto de vista salvo malformado foi ignorado.');
        continue;
      }
      const vp = item as Record<string, unknown>;
      const targetId = typeof vp.targetId === 'string' ? vp.targetId : '';
      if (!CATALOG_BY_ID[targetId]) {
        warnings.push(`Ponto de vista com corpo desconhecido (${targetId}) foi ignorado.`);
        continue;
      }
      const offset = (vp.cameraOffset as Record<string, unknown>) || {};
      validVps.push({
        id: sanitizeText(vp.id, 64, `vp_${Date.now()}_${validVps.length}`),
        title: sanitizeText(vp.title, 80, 'Ponto de Vista Salvo'),
        targetId,
        cameraMode: (vp.cameraMode as CameraMode) || 'focus',
        cameraOffset: {
          x: typeof offset.x === 'number' && Number.isFinite(offset.x) ? offset.x : 4,
          y: typeof offset.y === 'number' && Number.isFinite(offset.y) ? offset.y : 2,
          z: typeof offset.z === 'number' && Number.isFinite(offset.z) ? offset.z : 4,
        },
        simTimeMs:
          typeof vp.simTimeMs === 'number' && Number.isFinite(vp.simTimeMs)
            ? Math.max(MIN_SUPPORTED_DATE_MS, Math.min(MAX_SUPPORTED_DATE_MS, vp.simTimeMs))
            : DEFAULT_SESSION_START_MS,
        restoreDateOnVisit: Boolean(vp.restoreDateOnVisit),
        scaleMode: vp.scaleMode === 'relative' ? 'relative' : 'exploration',
        labelMode: (vp.labelMode as LabelMode) || 'major',
        orbitMode: (vp.orbitMode as OrbitMode) || 'all',
        createdAt: sanitizeText(vp.createdAt, 40, new Date().toISOString()),
      });
    }
    base.savedViewpoints = validVps;
  }

  if (Array.isArray(obj.bookmarks)) {
    const validBms: TimeBookmark[] = [];
    for (const item of obj.bookmarks) {
      if (!item || typeof item !== 'object') {
        warnings.push('Um marcador temporal malformado foi ignorado.');
        continue;
      }
      const bm = item as Record<string, unknown>;
      const targetId = typeof bm.targetId === 'string' && CATALOG_BY_ID[bm.targetId] ? bm.targetId : 'earth';
      const simTimeMs =
        typeof bm.simTimeMs === 'number' && Number.isFinite(bm.simTimeMs)
          ? Math.max(MIN_SUPPORTED_DATE_MS, Math.min(MAX_SUPPORTED_DATE_MS, bm.simTimeMs))
          : DEFAULT_SESSION_START_MS;
      const desc = (bm.description as Record<string, unknown>) || {};
      validBms.push({
        id: sanitizeText(bm.id, 64, `bm_${Date.now()}_${validBms.length}`),
        title: sanitizeText(bm.title, 100, 'Instante Marcado'),
        simTimeMs,
        targetId,
        scaleMode: bm.scaleMode === 'relative' ? 'relative' : 'exploration',
        category:
          bm.category === 'historical_event' ||
          bm.category === 'model_approximate' ||
          bm.category === 'schematic_alignment'
            ? bm.category
            : 'user',
        description: {
          'pt-BR': sanitizeText(desc['pt-BR'], 300, 'Marcador temporal salvo localmente.'),
          en: sanitizeText(desc.en, 300, 'Locally saved time bookmark.'),
        },
      });
    }
    if (validBms.length > 0) base.bookmarks = validBms;
  }

  if (Array.isArray(obj.journalEntries)) {
    const validJournal: JournalEntry[] = [];
    for (const item of obj.journalEntries) {
      if (!item || typeof item !== 'object') {
        warnings.push('Uma nota do diário malformada foi ignorada.');
        continue;
      }
      const je = item as Record<string, unknown>;
      const bodyId =
        typeof je.bodyId === 'string' && CATALOG_BY_ID[je.bodyId] ? je.bodyId : 'earth';
      validJournal.push({
        id: sanitizeText(je.id, 64, `je_${Date.now()}_${validJournal.length}`),
        title: sanitizeText(je.title, 100, 'Observação'),
        note: sanitizeText(je.note, 2000, ''),
        bodyId,
        simTimeMs:
          typeof je.simTimeMs === 'number' && Number.isFinite(je.simTimeMs)
            ? je.simTimeMs
            : DEFAULT_SESSION_START_MS,
        measurementSummary: je.measurementSummary
          ? sanitizeText(je.measurementSummary, 250)
          : undefined,
        createdAt: sanitizeText(je.createdAt, 40, new Date().toISOString()),
        updatedAt: sanitizeText(je.updatedAt, 40, new Date().toISOString()),
      });
    }
    base.journalEntries = validJournal;
  }

  if (Array.isArray(obj.savedOrbitExperiments)) {
    const validPresets: HypotheticalOrbitPreset[] = [];
    for (const item of obj.savedOrbitExperiments) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      validPresets.push({
        id: sanitizeText(p.id, 64, `orb_${Date.now()}_${validPresets.length}`),
        name: sanitizeText(p.name, 80, 'Experimento Orbital'),
        centralMassSolar:
          typeof p.centralMassSolar === 'number' && Number.isFinite(p.centralMassSolar)
            ? Math.max(0.1, Math.min(10, p.centralMassSolar))
            : 1.0,
        semiMajorAxisAu:
          typeof p.semiMajorAxisAu === 'number' && Number.isFinite(p.semiMajorAxisAu)
            ? Math.max(0.1, Math.min(50, p.semiMajorAxisAu))
            : 1.0,
        eccentricity:
          typeof p.eccentricity === 'number' && Number.isFinite(p.eccentricity)
            ? Math.max(0, Math.min(0.92, p.eccentricity))
            : 0.1,
        testMassKg:
          typeof p.testMassKg === 'number' && Number.isFinite(p.testMassKg)
            ? Math.max(1, Math.min(1e10, p.testMassKg))
            : 100,
      });
    }
    if (validPresets.length > 0) base.savedOrbitExperiments = validPresets;
  }

  if (Array.isArray(obj.completedTours)) {
    base.completedTours = obj.completedTours.filter((x): x is string => typeof x === 'string');
  }
  if (Array.isArray(obj.completedActivities)) {
    base.completedActivities = obj.completedActivities.filter(
      (x): x is string => typeof x === 'string'
    );
  }

  return { store: base, warnings };
}

export function loadPersistedStore(): StorageLoadResult {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        store: getDefaultPersistedStore(),
        storageAvailable: false,
        recoveryWarnings: ['Armazenamento local indisponível neste navegador; sessão em memória ativa.'],
      };
    }
    const rawText = window.localStorage.getItem(STORAGE_KEY_V1);
    if (!rawText) {
      return {
        store: getDefaultPersistedStore(),
        storageAvailable: true,
        recoveryWarnings: [],
      };
    }
    const parsed = JSON.parse(rawText);
    const { store, warnings } = validateAndRecoverStore(parsed);
    return {
      store,
      storageAvailable: true,
      recoveryWarnings: warnings,
    };
  } catch {
    return {
      store: getDefaultPersistedStore(),
      storageAvailable: false,
      recoveryWarnings: [
        'Os dados salvos localmente estavam corrompidos ou inacessíveis. O estado padrão foi restaurado com segurança.',
      ],
    };
  }
}

export function savePersistedStore(store: PersistedStoreV1): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/**
 * Bounded, versioned shareable scene representation (Section 52).
 * Never embeds private journal notes, browser identifiers, or unrelated store state.
 */
export interface ShareableSceneDescriptor {
  v: 1;
  target: string;
  time: number;
  scale: ScaleMode;
  mode: CameraMode;
  labels: LabelMode;
  orbits: OrbitMode;
}

export function encodeShareableSceneUrl(desc: ShareableSceneDescriptor): string {
  const params = new URLSearchParams();
  params.set('v', '1');
  params.set('target', desc.target);
  params.set('time', String(Math.round(desc.time)));
  params.set('scale', desc.scale);
  params.set('mode', desc.mode);
  params.set('labels', desc.labels);
  params.set('orbits', desc.orbits);
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'http://127.0.0.1:5173/';
  return `${baseUrl}?${params.toString()}`;
}

export function parseShareableSceneFromUrl(): Partial<ShareableSceneDescriptor> | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const target = params.get('target');
  if (!target || !CATALOG_BY_ID[target]) return null;
  const timeRaw = Number(params.get('time'));
  const scaleRaw = params.get('scale');
  return {
    v: 1,
    target,
    time:
      Number.isFinite(timeRaw) && timeRaw >= MIN_SUPPORTED_DATE_MS && timeRaw <= MAX_SUPPORTED_DATE_MS
        ? timeRaw
        : undefined,
    scale: scaleRaw === 'relative' ? 'relative' : 'exploration',
  };
}
