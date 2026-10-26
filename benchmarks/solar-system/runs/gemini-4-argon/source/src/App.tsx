import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveTool,
  CameraMode,
  CelestialBodyData,
  HypotheticalOrbitPreset,
  MeasurementRecord,
  PersistedStoreV1,
  ReferenceFrame,
  SavedViewpoint,
  TimeBookmark,
  UserPreferences,
  WorkspacePreset,
} from './types/solarSystem';
import { CATALOG_BY_ID, CELESTIAL_CATALOG } from './data/celestialCatalog';
import { GUIDED_TOURS } from './data/educationalContent';
import {
  calculatePhysicalMeasurement,
  DEFAULT_SESSION_START_MS,
  evaluateSolarSystemState,
  MAX_SUPPORTED_DATE_MS,
  MIN_SUPPORTED_DATE_MS,
} from './engine/ephemeris';
import {
  getDefaultPersistedStore,
  getDefaultPreferences,
  loadPersistedStore,
  parseShareableSceneFromUrl,
  savePersistedStore,
} from './utils/storage';
import { audioController } from './utils/audioEngine';
import {
  SolarSystemViewport,
  ViewportHandle,
} from './components/SolarSystemViewport';
import { NavigatorPanel } from './components/NavigatorPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { TimeControllerBar } from './components/TimeControllerBar';
import {
  ComparisonWorkspace,
  MeasurementToolPanel,
} from './components/ComparisonAndMeasurementModal';
import {
  BeyondNeptuneModal,
  LunarLaboratoryModal,
  OrbitSandboxLaboratoryModal,
  ScaleLaboratoryModal,
  SeasonsLaboratoryModal,
} from './components/ScientificLaboratories';
import {
  ActiveTourState,
  LearnAndToursModal,
} from './components/LearnAndToursModal';
import {
  CollectionsAndPhotoModal,
  PhotoModeSettings,
} from './components/CollectionsAndPhotoModal';
import { OrientationMinimapAndOverlays } from './components/OrientationMinimapAndOverlays';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Camera,
  Compass,
  Eye,
  EyeOff,
  FlaskConical,
  Globe2,
  HelpCircle,
  Home,
  Info,
  Layers,
  Menu,
  Ruler,
  Scale,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';

interface ViewHistoryItem {
  bodyId: string;
  cameraMode: CameraMode;
}

export const App: React.FC = () => {
  // 1. Load persisted store & check URL share parameters
  const initialLoad = useMemo(() => {
    const loaded = loadPersistedStore();
    const shared = parseShareableSceneFromUrl();
    if (shared && shared.target) {
      loaded.store.preferences.scaleMode = shared.scale || loaded.store.preferences.scaleMode;
    }
    return { ...loaded, shared };
  }, []);

  const [store, setStore] = useState<PersistedStoreV1>(initialLoad.store);
  const [storageWarnings, setStorageWarnings] = useState<string[]>(
    initialLoad.recoveryWarnings
  );

  const preferences = store.preferences;
  const lang = preferences.language;

  // 2. Authoritative Simulation Clock State
  const [simTimeMs, setSimTimeMs] = useState<number>(
    initialLoad.shared?.time ?? DEFAULT_SESSION_START_MS
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(3600); // 1 hr/s default for lively motion
  const [boundaryMessage, setBoundaryMessage] = useState<string | null>(null);

  // 3. Selection, Camera, Reference Frame & View History Stack
  const [selectedBodyId, setSelectedBodyId] = useState<string>(
    initialLoad.shared?.target ?? 'earth'
  );
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    initialLoad.shared?.target ? 'focus' : 'overview'
  );
  const [referenceFrame, setReferenceFrame] = useState<ReferenceFrame>('sun');
  const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([
    {
      bodyId: initialLoad.shared?.target ?? 'earth',
      cameraMode: initialLoad.shared?.target ? 'focus' : 'overview',
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // 4. Active Tool / Modal / HUD Drawer State
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [encyclopediaArticleId, setEncyclopediaArticleId] =
    useState<string>('about_this_model');
  const [distractionFree, setDistractionFree] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [showOnboardingCard, setShowOnboardingCard] = useState<boolean>(
    !store.preferences.onboardingCompleted
  );

  // 5. Comparison & Measurement State
  const [comparedIds, setComparedIds] = useState<string[]>(['earth', 'mars']);
  const [measureFromId, setMeasureFromId] = useState<string>('earth');
  const [measureToId, setMeasureToId] = useState<string>('mars');
  const [measureObserverId, setMeasureObserverId] = useState<string>('sun');
  const [measureHistory, setMeasureHistory] = useState<MeasurementRecord[]>([]);
  const [measureFrozen, setMeasureFrozen] = useState<boolean>(false);
  const [frozenMeasurement, setFrozenMeasurement] =
    useState<MeasurementRecord | null>(null);
  const [lightPulseProgress, setLightPulseProgress] = useState<number | null>(null);

  // 6. Active Guided Tour & Photo Mode State
  const [activeTour, setActiveTour] = useState<ActiveTourState | null>(null);
  const [photoSettings, setPhotoSettings] = useState<PhotoModeSettings>({
    fov: 45,
    aspectGuide: 'viewport',
    showRuleOfThirds: true,
    includeCaption: true,
    includeLabelsInExport: true,
  });

  // 7. Viewport Imperative Handle & FPS Telemetry
  const viewportHandleRef = useRef<ViewportHandle | null>(null);
  const [fpsReadout, setFpsReadout] = useState<number>(60);

  // Persist store on change
  useEffect(() => {
    savePersistedStore(store);
  }, [store]);

  // Apply accessibility attributes to <html>
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-interface-size',
      preferences.interfaceSize
    );
    document.documentElement.setAttribute(
      'data-high-contrast',
      String(preferences.highContrastLabels)
    );
    document.documentElement.lang = preferences.language;
  }, [
    preferences.interfaceSize,
    preferences.highContrastLabels,
    preferences.language,
  ]);

  // Sync optional synthesized audio engine
  useEffect(() => {
    audioController.setAmbientEnabled(
      preferences.soundEnabled && preferences.ambientAudioEnabled
    );
  }, [preferences.soundEnabled, preferences.ambientAudioEnabled]);

  // 8. Authoritative Monotonic Simulation Clock Loop (Section 18)
  const lastFrameTimeRef = useRef<number | null>(null);
  const wasPlayingBeforeHiddenRef = useRef<boolean>(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasPlayingBeforeHiddenRef.current = isPlaying;
        lastFrameTimeRef.current = null;
      } else {
        lastFrameTimeRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      return;
    }

    let rafId = 0;
    const tick = (nowMs: number) => {
      if (document.visibilityState === 'hidden') {
        lastFrameTimeRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = nowMs;
      }
      // Cap frame delta at 100ms to prevent huge orbital jumps after tab switch
      const dtSec = Math.min(0.1, Math.max(0, (nowMs - lastFrameTimeRef.current) / 1000));
      lastFrameTimeRef.current = nowMs;

      if (dtSec > 0 && speedMultiplier > 0) {
        setSimTimeMs((prev) => {
          const next = prev + dtSec * 1000 * speedMultiplier * direction;
          if (next >= MAX_SUPPORTED_DATE_MS) {
            setIsPlaying(false);
            setBoundaryMessage(
              lang === 'pt-BR'
                ? 'Limite superior da efeméride JPL atingido (31 Dez 2050). Simulação pausada.'
                : 'Upper JPL ephemeris boundary reached (2050-12-31). Simulation paused.'
            );
            return MAX_SUPPORTED_DATE_MS;
          }
          if (next <= MIN_SUPPORTED_DATE_MS) {
            setIsPlaying(false);
            setBoundaryMessage(
              lang === 'pt-BR'
                ? 'Limite inferior da efeméride JPL atingido (01 Jan 1800). Simulação pausada.'
                : 'Lower JPL ephemeris boundary reached (1800-01-01). Simulation paused.'
            );
            return MIN_SUPPORTED_DATE_MS;
          }
          return next;
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speedMultiplier, direction, lang]);

  // Light pulse animation for Measurement Tool
  useEffect(() => {
    if (lightPulseProgress === null) return;
    const id = window.setInterval(() => {
      setLightPulseProgress((prev) => {
        if (prev === null || prev >= 1) return null;
        return Math.min(1, prev + 0.025);
      });
    }, 30);
    return () => window.clearInterval(id);
  }, [lightPulseProgress]);

  // 9. Evaluate Full Solar System State at Current Time & Scale
  const bodyStates = useMemo(
    () => evaluateSolarSystemState(simTimeMs, preferences.scaleMode),
    [simTimeMs, preferences.scaleMode]
  );

  const selectedBody: CelestialBodyData =
    CATALOG_BY_ID[selectedBodyId] ?? CATALOG_BY_ID.earth;
  const selectedBodyState = bodyStates[selectedBodyId];
  const withinValidity =
    simTimeMs >= MIN_SUPPORTED_DATE_MS && simTimeMs <= MAX_SUPPORTED_DATE_MS;

  // Helper to update preferences
  const updatePreferences = useCallback(
    (updater: (prev: UserPreferences) => UserPreferences) => {
      setStore((prev) => ({
        ...prev,
        preferences: updater(prev.preferences),
      }));
    },
    []
  );

  // Select body & record in history + discovery checklist
  const handleSelectBody = useCallback(
    (bodyId: string, initiateFocus = true) => {
      const target = CATALOG_BY_ID[bodyId];
      if (!target) return;

      setSelectedBodyId(bodyId);
      audioController.playUiFeedback(
        'select',
        preferences.soundEnabled && preferences.uiSoundEnabled
      );

      if (initiateFocus) {
        const nextMode: CameraMode =
          cameraMode === 'follow' ? 'follow' : 'focus';
        setCameraMode(nextMode);
        viewportHandleRef.current?.flyToBody(bodyId, nextMode);

        setViewHistory((prev) => {
          const sliced = prev.slice(0, historyIndex + 1);
          const last = sliced[sliced.length - 1];
          if (last && last.bodyId === bodyId) return sliced;
          const updated = [...sliced, { bodyId, cameraMode: nextMode }].slice(-25);
          setHistoryIndex(updated.length - 1);
          return updated;
        });
      }

      setStore((prev) => {
        const isPlanet = target.category === 'planet';
        const isMoon = target.category === 'moon';
        const visited = prev.visitedBodies.includes(bodyId)
          ? prev.visitedBodies
          : [...prev.visitedBodies, bodyId];
        const recent = [
          bodyId,
          ...prev.recentBodies.filter((id) => id !== bodyId),
        ].slice(0, 8);
        return {
          ...prev,
          visitedBodies: visited,
          recentBodies: recent,
          discoveryChecklist: {
            ...prev.discoveryChecklist,
            visitPlanet: prev.discoveryChecklist.visitPlanet || isPlanet,
            followMoon: prev.discoveryChecklist.followMoon || isMoon,
          },
        };
      });
    },
    [cameraMode, historyIndex]
  );

  // Back / Forward View History Navigation
  const handleHistoryBack = () => {
    if (historyIndex <= 0) return;
    const prevIdx = historyIndex - 1;
    const entry = viewHistory[prevIdx];
    if (!entry) return;
    setHistoryIndex(prevIdx);
    setSelectedBodyId(entry.bodyId);
    setCameraMode(entry.cameraMode);
    viewportHandleRef.current?.flyToBody(entry.bodyId, entry.cameraMode);
  };

  const handleHistoryForward = () => {
    if (historyIndex >= viewHistory.length - 1) return;
    const nextIdx = historyIndex + 1;
    const entry = viewHistory[nextIdx];
    if (!entry) return;
    setHistoryIndex(nextIdx);
    setSelectedBodyId(entry.bodyId);
    setCameraMode(entry.cameraMode);
    viewportHandleRef.current?.flyToBody(entry.bodyId, entry.cameraMode);
  };

  // Start Guided Tour (Section 37)
  const handleStartTour = useCallback(
    (tourId: string) => {
      const spec = GUIDED_TOURS.find((t) => t.id === tourId);
      if (!spec || spec.stops.length === 0) return;
      const firstStop = spec.stops[0];
      setActiveTour({
        tourId: spec.id,
        stopIndex: 0,
        isPaused: false,
        pacing: 'auto',
        savedScaleMode: preferences.scaleMode,
        savedSelectedId: selectedBodyId,
        remainingSeconds: firstStop.readingSeconds,
      });
      setSelectedBodyId(firstStop.targetId);
      viewportHandleRef.current?.flyToBody(
        firstStop.targetId,
        'focus',
        firstStop.cameraDistanceMultiplier,
        firstStop.cameraElevationDeg
      );
    },
    [preferences.scaleMode, selectedBodyId]
  );

  // Apply Workspace Preset (Section 42.1)
  const handleApplyWorkspacePreset = useCallback(
    (preset: WorkspacePreset) => {
      updatePreferences((prev) => {
        if (preset === 'cinematic') {
          return {
            ...prev,
            workspacePreset: 'cinematic',
            presentationMode: 'natural',
            labelMode: 'major',
            orbitMode: 'all',
            showEclipticGrid: false,
            showPerihelionAphelion: false,
            showVelocityVectors: false,
          };
        }
        if (preset === 'classroom') {
          return {
            ...prev,
            workspacePreset: 'classroom',
            presentationMode: 'enhanced',
            interfaceSize: 'large',
            highContrastLabels: true,
            labelMode: 'major',
            orbitMode: 'all',
            showEclipticGrid: true,
          };
        }
        if (preset === 'detailed_study') {
          return {
            ...prev,
            workspacePreset: 'detailed_study',
            labelMode: 'selected_system',
            orbitMode: 'all',
            showEclipticGrid: true,
            showPerihelionAphelion: true,
            showVelocityVectors: true,
            showAxialArrows: true,
          };
        }
        if (preset === 'low_power') {
          return {
            ...prev,
            workspacePreset: 'low_power',
            qualityPreset: 'low',
            showTrails: false,
            showAsteroidBelt: false,
            showKuiperBelt: false,
            reducedMotion: true,
          };
        }
        return { ...prev, workspacePreset: preset };
      });
    },
    [updatePreferences]
  );

  // Global Keyboard Shortcuts (Section 24)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (activeTool !== 'none') {
          setActiveTool('none');
          return;
        }
        if (distractionFree) {
          setDistractionFree(false);
          return;
        }
      }

      if (isInputFocused) return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setSpeedMultiplier((s) => Math.max(1, Math.round(s / 2)));
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setSpeedMultiplier((s) => Math.min(2592000 * 4, s * 2));
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setCameraMode('focus');
        viewportHandleRef.current?.flyToBody(selectedBodyId, 'focus');
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setCameraMode('overview');
        viewportHandleRef.current?.resetView();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        updatePreferences((p) => ({
          ...p,
          orbitMode:
            p.orbitMode === 'all'
              ? 'selected_system'
              : p.orbitMode === 'selected_system'
              ? 'none'
              : 'all',
        }));
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        updatePreferences((p) => ({
          ...p,
          showEclipticGrid: !p.showEclipticGrid,
        }));
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setActiveTool((t) => (t === 'comparison' ? 'none' : 'comparison'));
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setActiveTool((t) => (t === 'measurement' ? 'none' : 'measurement'));
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setActiveTool((t) => (t === 'photo_mode' ? 'none' : 'photo_mode'));
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === '/') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const idx = CELESTIAL_CATALOG.findIndex((b) => b.id === selectedBodyId);
        const delta = e.key === ']' ? 1 : -1;
        const nextIdx =
          (idx + delta + CELESTIAL_CATALOG.length) % CELESTIAL_CATALOG.length;
        handleSelectBody(CELESTIAL_CATALOG[nextIdx].id, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsOpen,
    activeTool,
    distractionFree,
    selectedBodyId,
    handleSelectBody,
    updatePreferences,
  ]);

  // Open Tool helper
  const handleOpenTool = useCallback(
    (tool: ActiveTool, articleId?: string) => {
      if (articleId) {
        setEncyclopediaArticleId(articleId);
      }
      if (tool === 'comparison') {
        setStore((prev) => ({
          ...prev,
          discoveryChecklist: {
            ...prev.discoveryChecklist,
            compareBodies: true,
          },
        }));
      }
      setActiveTool(tool);
    },
    []
  );

  // Toggle Scale Mode helper
  const handleToggleScaleMode = useCallback(() => {
    const nextScale =
      preferences.scaleMode === 'exploration' ? 'relative' : 'exploration';
    updatePreferences((p) => ({ ...p, scaleMode: nextScale }));
    viewportHandleRef.current?.invalidateTrails();
    setStore((prev) => ({
      ...prev,
      discoveryChecklist: {
        ...prev.discoveryChecklist,
        inspectScale: true,
      },
    }));
  }, [preferences.scaleMode, updatePreferences]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* FULL-VIEWPORT 3D SOLAR SYSTEM SCENE */}
      <SolarSystemViewport
        simTimeMs={simTimeMs}
        bodyStates={bodyStates}
        selectedBodyId={selectedBodyId}
        cameraMode={cameraMode}
        referenceFrame={referenceFrame}
        preferences={preferences}
        favorites={store.favorites}
        measurementEndpoints={
          activeTool === 'measurement'
            ? {
                fromId: measureFromId,
                toId: measureToId,
                pulseProgress: lightPulseProgress,
              }
            : null
        }
        photoFov={activeTool === 'photo_mode' ? photoSettings.fov : undefined}
        onSelectBody={(id, focus) => handleSelectBody(id, focus ?? true)}
        onCameraModeChange={setCameraMode}
        onManualCameraGesture={() => {
          // Pause automatic tour advancement if user manually orbits/pans camera (Section 49)
          if (activeTour && !activeTour.isPaused && activeTour.pacing === 'auto') {
            setActiveTour({ ...activeTour, isPaused: true });
          }
        }}
        onRegisterHandle={(h) => {
          viewportHandleRef.current = h;
        }}
        onFpsSample={setFpsReadout}
      />

      {/* STORAGE RECOVERY BANNER (IF ANY) */}
      {storageWarnings.length > 0 && (
        <div
          role="status"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs shadow-xl"
        >
          <span>{storageWarnings[0]}</span>
          <button
            type="button"
            onClick={() => setStorageWarnings([])}
            className="px-2 py-0.5 rounded bg-amber-800/60 hover:bg-amber-800 text-white font-semibold"
          >
            OK
          </button>
        </div>
      )}

      {/* DISTRACTION-FREE MODE RESTORE PILL (Section 09.3) */}
      {distractionFree && (
        <div className="fixed top-3 right-3 z-50">
          <button
            type="button"
            data-testid="restore-ui-btn"
            onClick={() => setDistractionFree(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs font-bold shadow-xl backdrop-blur-md"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            {lang === 'pt-BR' ? 'Restaurar Interface (Esc)' : 'Restore UI (Esc)'}
          </button>
        </div>
      )}

      {/* MAIN HUD CHROME (Hidden in Distraction-Free Mode or Photo Mode) */}
      {!distractionFree && activeTool !== 'photo_mode' && (
        <>
          {/* SLIM TOP OBSERVATORY HEADER BAR */}
          <header
            aria-label={
              lang === 'pt-BR'
                ? 'Barra Superior do Observatório'
                : 'Observatory Top Bar'
            }
            className="fixed top-0 left-0 right-0 z-40 h-13 px-2.5 sm:px-4 bg-slate-950/88 backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between gap-2"
          >
            {/* Left: Brand, Mobile Navigator Drawer Button & History Back/Forward/Home */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                aria-label={
                  lang === 'pt-BR' ? 'Alternar navegador de corpos' : 'Toggle body navigator'
                }
                className="lg:hidden p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 pr-1">
                <Globe2 className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="leading-tight">
                  <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white">
                    {lang === 'pt-BR'
                      ? 'Observatório do Sistema Solar'
                      : 'Solar System Observatory'}
                  </h1>
                  <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span>JPL Keplerian J2000</span>
                    <span>•</span>
                    <span className="font-mono text-emerald-400">{fpsReadout} FPS</span>
                  </div>
                </div>
              </div>

              {/* View History Back / Forward / Home Overview */}
              <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800">
                <button
                  type="button"
                  disabled={historyIndex <= 0}
                  onClick={handleHistoryBack}
                  title={lang === 'pt-BR' ? 'Vista Anterior' : 'Previous View'}
                  className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 disabled:opacity-35 text-slate-300 border border-slate-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={historyIndex >= viewHistory.length - 1}
                  onClick={handleHistoryForward}
                  title={lang === 'pt-BR' ? 'Próxima Vista' : 'Next View'}
                  className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 disabled:opacity-35 text-slate-300 border border-slate-800"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="home-overview-btn"
                  onClick={() => {
                    setCameraMode('overview');
                    viewportHandleRef.current?.resetView();
                  }}
                  title={
                    lang === 'pt-BR'
                      ? 'Visão Geral do Sistema Solar (H)'
                      : 'Solar System Overview (H)'
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-800"
                >
                  <Home className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden md:inline">
                    {lang === 'pt-BR' ? 'Visão Geral' : 'Overview'}
                  </span>
                </button>
              </div>
            </div>

            {/* Center: Scale Mode & Presentation Mode Pills + Quick Tool Launchers */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
              {/* Scale Mode Toggle Pill */}
              <button
                type="button"
                data-testid="top-scale-toggle-btn"
                onClick={handleToggleScaleMode}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                  preferences.scaleMode === 'relative'
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                    : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>
                  {preferences.scaleMode === 'exploration'
                    ? lang === 'pt-BR'
                      ? 'Escala: Exploração'
                      : 'Scale: Exploration'
                    : lang === 'pt-BR'
                    ? 'Escala: Relativa'
                    : 'Scale: Relative'}
                </span>
              </button>

              {/* Presentation Mode Toggle Pill (Natural vs Enhanced) */}
              <button
                type="button"
                data-testid="top-presentation-toggle-btn"
                onClick={() =>
                  updatePreferences((p) => ({
                    ...p,
                    presentationMode:
                      p.presentationMode === 'natural' ? 'enhanced' : 'natural',
                  }))
                }
                className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  preferences.presentationMode === 'enhanced'
                    ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {preferences.presentationMode === 'natural'
                    ? lang === 'pt-BR'
                      ? 'Visual: Natural'
                      : 'Visual: Natural'
                    : lang === 'pt-BR'
                    ? 'Visual: Realçado'
                    : 'Visual: Enhanced'}
                </span>
              </button>

              {/* Guided Tours & Learn Launcher */}
              <button
                type="button"
                data-testid="open-tours-btn"
                onClick={() => handleOpenTool('tours')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 whitespace-nowrap"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>{lang === 'pt-BR' ? 'Aprender e Tours' : 'Learn & Tours'}</span>
              </button>

              {/* Compare Bodies Launcher */}
              <button
                type="button"
                data-testid="open-comparison-btn"
                onClick={() => handleOpenTool('comparison')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'pt-BR' ? 'Comparar' : 'Compare'}</span>
              </button>

              {/* Distance & Light-Time Ruler Launcher */}
              <button
                type="button"
                data-testid="open-measurement-btn"
                onClick={() => handleOpenTool('measurement')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 whitespace-nowrap"
              >
                <Ruler className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'pt-BR' ? 'Medir' : 'Measure'}</span>
              </button>

              {/* Interactive Scientific Labs Dropdown / Quick Launcher */}
              <div className="relative group hidden lg:block">
                <button
                  type="button"
                  data-testid="open-labs-menu-btn"
                  onClick={() => handleOpenTool('orbit_lab')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 whitespace-nowrap"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                  <span>{lang === 'pt-BR' ? 'Laboratórios (5)' : 'Labs (5)'}</span>
                </button>
                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all absolute top-full left-0 mt-1 w-64 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                  {[
                    {
                      id: 'scale_lab' as ActiveTool,
                      label:
                        lang === 'pt-BR'
                          ? '1. Laboratório de Escala (1:1)'
                          : '1. Scale of Reality Lab (1:1)',
                    },
                    {
                      id: 'seasons_lab' as ActiveTool,
                      label:
                        lang === 'pt-BR'
                          ? '2. Estações e Inclinação Axial'
                          : '2. Seasons & Axial Tilt Lab',
                    },
                    {
                      id: 'moon_lab' as ActiveTool,
                      label:
                        lang === 'pt-BR'
                          ? '3. Fases da Lua e Eclipses'
                          : '3. Lunar Phases & Eclipse Lab',
                    },
                    {
                      id: 'orbit_lab' as ActiveTool,
                      label:
                        lang === 'pt-BR'
                          ? '4. Gravidade e Leis de Kepler'
                          : '4. Gravity & Kepler Orbit Sandbox',
                    },
                    {
                      id: 'outer_system' as ActiveTool,
                      label:
                        lang === 'pt-BR'
                          ? '5. Além de Netuno (Logarítmico)'
                          : '5. Beyond Neptune (Logarithmic)',
                    },
                  ].map((lab) => (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => handleOpenTool(lab.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-900 hover:text-cyan-300"
                    >
                      {lab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Search Command Palette, Collections, Photo Mode, Distraction-Free, Settings, Help & Mobile Inspector Toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                title={
                  lang === 'pt-BR'
                    ? 'Paleta de Busca e Comandos (Ctrl+K)'
                    : 'Search & Command Palette (Ctrl+K)'
                }
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="open-collections-btn"
                onClick={() => handleOpenTool('collections')}
                title={
                  lang === 'pt-BR'
                    ? 'Vistas Salvas, Favoritos e Diário'
                    : 'Saved Views, Favorites & Journal'
                }
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <Bookmark className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="open-photo-mode-btn"
                onClick={() => handleOpenTool('photo_mode')}
                title={
                  lang === 'pt-BR'
                    ? 'Modo Foto e Captura (P)'
                    : 'Photo Mode & Capture (P)'
                }
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <Camera className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="distraction-free-btn"
                onClick={() => setDistractionFree(true)}
                title={
                  lang === 'pt-BR'
                    ? 'Modo Sem Distrações (Ocultar Painéis)'
                    : 'Distraction-Free Mode (Hide Panels)'
                }
                className="hidden sm:flex p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <EyeOff className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="open-settings-btn"
                onClick={() => handleOpenTool('settings')}
                title={
                  lang === 'pt-BR'
                    ? 'Configurações, Sobreposições e Acessibilidade'
                    : 'Settings, Overlays & Accessibility'
                }
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                title={
                  lang === 'pt-BR' ? 'Atalhos e Ajuda (?)' : 'Shortcuts & Help (?)'
                }
                className="hidden sm:flex p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Mobile / Tablet Inspector Toggle */}
              <button
                type="button"
                data-testid="mobile-inspector-toggle-btn"
                onClick={() => setMobileInspectorOpen(!mobileInspectorOpen)}
                aria-label={
                  lang === 'pt-BR'
                    ? 'Alternar painel de inspeção'
                    : 'Toggle inspector panel'
                }
                className="lg:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 text-xs font-semibold"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="max-w-[72px] truncate">
                  {selectedBody.name[lang]}
                </span>
              </button>
            </div>
          </header>

          {/* LEFT CELESTIAL NAVIGATOR DRAWER (Desktop Docked + Mobile/Tablet Overlay) */}
          <div
            className={`fixed top-14 bottom-20 left-3 z-30 w-72 transition-transform duration-200 ${
              mobileNavOpen
                ? 'translate-x-0'
                : '-translate-x-[110%] lg:translate-x-0'
            }`}
          >
            <NavigatorPanel
              selectedBodyId={selectedBodyId}
              favorites={store.favorites}
              visitedBodies={store.visitedBodies}
              recentBodies={store.recentBodies}
              preferences={preferences}
              onSelectBody={(id, focus) => {
                handleSelectBody(id, focus ?? true);
                setMobileNavOpen(false);
              }}
              onSelectLocalPreset={(parentId, focusId) => {
                handleSelectBody(focusId, false);
                setCameraMode('parent_system');
                viewportHandleRef.current?.flyToBody(parentId, 'parent_system');
                setMobileNavOpen(false);
              }}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              onCloseMobileDrawer={() => setMobileNavOpen(false)}
            />
          </div>

          {/* RIGHT SCIENTIFIC INSPECTOR PANEL (Desktop Docked + Mobile/Tablet Sheet) */}
          <div
            className={`fixed top-14 bottom-20 right-3 z-30 w-[92vw] max-w-88 transition-transform duration-200 ${
              mobileInspectorOpen
                ? 'translate-x-0'
                : 'translate-x-[110%] lg:translate-x-0'
            }`}
          >
            <InspectorPanel
              body={selectedBody}
              bodyState={selectedBodyState}
              allStates={bodyStates}
              preferences={preferences}
              isFavorite={store.favorites.includes(selectedBodyId)}
              cameraMode={cameraMode}
              onSelectBody={(id, focus) => handleSelectBody(id, focus ?? true)}
              onFocusBody={(id) => {
                setCameraMode('focus');
                viewportHandleRef.current?.flyToBody(id, 'focus');
              }}
              onToggleFollow={(id) => {
                const nextMode: CameraMode =
                  cameraMode === 'follow' ? 'focus' : 'follow';
                setCameraMode(nextMode);
                viewportHandleRef.current?.flyToBody(id, nextMode);
              }}
              onFrameMoonsSystem={(parentId) => {
                setCameraMode('parent_system');
                viewportHandleRef.current?.flyToBody(parentId, 'parent_system');
              }}
              onToggleFavorite={(id) => {
                setStore((prev) => ({
                  ...prev,
                  favorites: prev.favorites.includes(id)
                    ? prev.favorites.filter((x) => x !== id)
                    : [...prev.favorites, id],
                }));
              }}
              onCompareWith={(id) => {
                if (!comparedIds.includes(id)) {
                  setComparedIds([id, id === 'earth' ? 'mars' : 'earth']);
                }
                handleOpenTool('comparison');
              }}
              onMeasureFrom={(id) => {
                setMeasureFromId(id);
                setMeasureToId(id === 'earth' ? 'mars' : 'earth');
                handleOpenTool('measurement');
              }}
              onSaveViewpoint={() => handleOpenTool('collections')}
              onCompleteOneOrbit={(body) => {
                const periodDays = body.orbitalPeriodDays ?? 365.256;
                const stepMs = periodDays * 86400 * 1000;
                const nextMs = Math.min(MAX_SUPPORTED_DATE_MS, simTimeMs + stepMs);
                setSimTimeMs(nextMs);
              }}
              onToggleVenusRadar={() =>
                updatePreferences((p) => ({
                  ...p,
                  venusSurfaceRadarMode: !p.venusSurfaceRadarMode,
                }))
              }
              onOpenEncyclopediaTerm={(termId) =>
                handleOpenTool('encyclopedia', termId)
              }
              onOpenTool={(tool) => handleOpenTool(tool)}
              onCloseMobileSheet={() => setMobileInspectorOpen(false)}
            />
          </div>

          {/* BOTTOM TIME CONTROLLER BAR */}
          <div className="fixed bottom-2 left-2 right-2 z-30 flex justify-center pointer-events-none">
            <div className="w-full max-w-3xl pointer-events-auto">
              <TimeControllerBar
                simTimeMs={simTimeMs}
                isPlaying={isPlaying}
                direction={direction}
                speedMultiplier={speedMultiplier}
                withinValidity={withinValidity}
                boundaryReachedMessage={boundaryMessage}
                selectedBody={selectedBody}
                scaleMode={preferences.scaleMode}
                lang={lang}
                bookmarks={store.bookmarks}
                onTogglePlay={() => {
                  setBoundaryMessage(null);
                  setIsPlaying((p) => !p);
                }}
                onToggleDirection={() => {
                  setBoundaryMessage(null);
                  setDirection((d) => (d === 1 ? -1 : 1));
                  setStore((prev) => ({
                    ...prev,
                    discoveryChecklist: {
                      ...prev.discoveryChecklist,
                      reverseTime: true,
                    },
                  }));
                }}
                onChangeSpeed={(newSpeed, autoPauseIfZero) => {
                  setBoundaryMessage(null);
                  if (autoPauseIfZero && newSpeed === 0) {
                    setIsPlaying(false);
                  } else {
                    setSpeedMultiplier(Math.max(1, newSpeed));
                  }
                }}
                onStepTimeMs={(deltaMs) => {
                  setBoundaryMessage(null);
                  setSimTimeMs((prev) =>
                    Math.max(
                      MIN_SUPPORTED_DATE_MS,
                      Math.min(MAX_SUPPORTED_DATE_MS, prev + deltaMs)
                    )
                  );
                }}
                onJumpToDateMs={(newTimeMs) => {
                  setBoundaryMessage(null);
                  setSimTimeMs(
                    Math.max(
                      MIN_SUPPORTED_DATE_MS,
                      Math.min(MAX_SUPPORTED_DATE_MS, newTimeMs)
                    )
                  );
                  viewportHandleRef.current?.invalidateTrails();
                }}
                onGoToNow={() => {
                  setBoundaryMessage(null);
                  const nowClamped = Math.max(
                    MIN_SUPPORTED_DATE_MS,
                    Math.min(MAX_SUPPORTED_DATE_MS, Date.now())
                  );
                  setSimTimeMs(nowClamped);
                  viewportHandleRef.current?.invalidateTrails();
                }}
                onResetSimulation={() => {
                  setBoundaryMessage(null);
                  setSimTimeMs(DEFAULT_SESSION_START_MS);
                  setDirection(1);
                  setSpeedMultiplier(3600);
                  setIsPlaying(true);
                  viewportHandleRef.current?.invalidateTrails();
                }}
                onAddBookmark={(title) => {
                  const bm: TimeBookmark = {
                    id: `bm_${Date.now()}`,
                    title,
                    simTimeMs,
                    targetId: selectedBodyId,
                    scaleMode: preferences.scaleMode,
                    category: 'user',
                    description: {
                      'pt-BR': 'Marcador temporal criado pelo usuário.',
                      en: 'User-created time bookmark.',
                    },
                  };
                  setStore((prev) => ({
                    ...prev,
                    bookmarks: [bm, ...prev.bookmarks],
                  }));
                }}
                onDeleteBookmark={(id) => {
                  setStore((prev) => ({
                    ...prev,
                    bookmarks: prev.bookmarks.filter((b) => b.id !== id),
                  }));
                }}
                onSelectBookmark={(bm) => {
                  setBoundaryMessage(null);
                  setSimTimeMs(bm.simTimeMs);
                  handleSelectBody(bm.targetId, true);
                  viewportHandleRef.current?.invalidateTrails();
                }}
                onToggleScaleMode={handleToggleScaleMode}
                onOpenScaleLab={() => handleOpenTool('scale_lab')}
              />
            </div>
          </div>
        </>
      )}

      {/* ORIENTATION MINIMAP, ONBOARDING CARD, COMMAND PALETTE, SHORTCUTS & SETTINGS */}
      <OrientationMinimapAndOverlays
        locale={lang}
        selectedBodyId={selectedBodyId}
        evaluatedStates={bodyStates}
        cameraYawRad={0}
        referenceFrame={referenceFrame}
        preferences={preferences}
        checklist={store.discoveryChecklist}
        activeTool={activeTool}
        isCommandPaletteOpen={isCommandPaletteOpen}
        isShortcutsOpen={isShortcutsOpen}
        showOnboardingCard={showOnboardingCard && !distractionFree}
        onSetReferenceFrame={setReferenceFrame}
        onSelectBody={(id) => handleSelectBody(id, true)}
        onUpdatePreferences={updatePreferences}
        onApplyWorkspacePreset={handleApplyWorkspacePreset}
        onResetVisualPreferences={() => {
          updatePreferences(() => getDefaultPreferences());
        }}
        onClearSavedUserData={() => {
          const fresh = getDefaultPersistedStore();
          setStore(fresh);
        }}
        onOpenTool={handleOpenTool}
        onStartTour={handleStartTour}
        onCloseCommandPalette={() => setIsCommandPaletteOpen(false)}
        onCloseShortcuts={() => setIsShortcutsOpen(false)}
        onDismissOnboarding={() => {
          setShowOnboardingCard(false);
          updatePreferences((p) => ({ ...p, onboardingCompleted: true }));
        }}
        onRestartOnboarding={() => {
          setShowOnboardingCard(true);
          updatePreferences((p) => ({ ...p, onboardingCompleted: false }));
        }}
      />

      {/* GUIDED TOURS HUD & LEARNING / MISSIONS / ENCYCLOPEDIA MODAL */}
      <LearnAndToursModal
        activeTool={activeTool}
        locale={lang}
        selectedBodyId={selectedBodyId}
        scaleMode={preferences.scaleMode}
        completedActivities={store.completedActivities}
        narrationEnabled={preferences.narrationEnabled}
        activeTour={activeTour}
        initialEncyclopediaArticleId={encyclopediaArticleId}
        onStartTour={handleStartTour}
        onUpdateTour={setActiveTour}
        onSelectBody={(id) => handleSelectBody(id, true)}
        onSetScaleMode={(mode) =>
          updatePreferences((p) => ({ ...p, scaleMode: mode }))
        }
        onSetSimTimeMs={(ms, pause) => {
          setSimTimeMs(ms);
          if (pause) setIsPlaying(false);
          viewportHandleRef.current?.invalidateTrails();
        }}
        onOpenTool={handleOpenTool}
        onCompleteActivity={(activityId) => {
          setStore((prev) => ({
            ...prev,
            completedActivities: prev.completedActivities.includes(activityId)
              ? prev.completedActivities
              : [...prev.completedActivities, activityId],
          }));
        }}
        onResetActivityProgress={() => {
          setStore((prev) => ({
            ...prev,
            completedActivities: [],
          }));
        }}
        onToggleNarration={() =>
          updatePreferences((p) => ({
            ...p,
            narrationEnabled: !p.narrationEnabled,
          }))
        }
        onCloseTool={() => setActiveTool('none')}
      />

      {/* COLLECTIONS, SAVED VIEWPOINTS, JOURNAL & PHOTO STUDIO */}
      <CollectionsAndPhotoModal
        activeTool={activeTool}
        locale={lang}
        selectedBodyId={selectedBodyId}
        simTimeMs={simTimeMs}
        isPlaying={isPlaying}
        scaleMode={preferences.scaleMode}
        cameraMode={cameraMode}
        labelMode={preferences.labelMode}
        orbitMode={preferences.orbitMode}
        ambientExposure={preferences.ambientExposure}
        backgroundIntensity={preferences.backgroundIntensity}
        store={store}
        photoSettings={photoSettings}
        onUpdatePhotoSettings={setPhotoSettings}
        onUpdateStore={setStore}
        onSelectBody={(id) => handleSelectBody(id, true)}
        onSetSimTimeMs={(ms, pause) => {
          setSimTimeMs(ms);
          if (pause) setIsPlaying(false);
        }}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onSetScaleMode={(mode) =>
          updatePreferences((p) => ({ ...p, scaleMode: mode }))
        }
        onSetLabelMode={(mode) =>
          updatePreferences((p) => ({ ...p, labelMode: mode }))
        }
        onSetOrbitMode={(mode) =>
          updatePreferences((p) => ({ ...p, orbitMode: mode }))
        }
        onSetAmbientExposure={(val) =>
          updatePreferences((p) => ({ ...p, ambientExposure: val }))
        }
        onSetBackgroundIntensity={(val) =>
          updatePreferences((p) => ({ ...p, backgroundIntensity: val }))
        }
        onApplyViewpoint={(vp: SavedViewpoint, restoreDate: boolean) => {
          handleSelectBody(vp.targetId, false);
          setCameraMode(vp.cameraMode);
          updatePreferences((p) => ({
            ...p,
            scaleMode: vp.scaleMode,
            labelMode: vp.labelMode,
            orbitMode: vp.orbitMode,
          }));
          if (restoreDate) {
            setSimTimeMs(vp.simTimeMs);
          }
          viewportHandleRef.current?.applySavedOffset(
            vp.targetId,
            vp.cameraOffset,
            vp.cameraMode
          );
        }}
        onCloseTool={() => setActiveTool('none')}
      />

      {/* BODY COMPARISON WORKSPACE MODAL */}
      {activeTool === 'comparison' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <ComparisonWorkspace
            comparedIds={comparedIds}
            preferences={preferences}
            onChangeComparedIds={setComparedIds}
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}

      {/* DISTANCE, LIGHT-TIME & ANGULAR MEASUREMENT PANEL */}
      {activeTool === 'measurement' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[95vw] max-w-2xl pointer-events-auto">
          <MeasurementToolPanel
            fromId={measureFromId}
            toId={measureToId}
            observerId={measureObserverId}
            simTimeMs={simTimeMs}
            bodyStates={bodyStates}
            preferences={preferences}
            history={measureHistory}
            isFrozen={measureFrozen}
            frozenRecord={frozenMeasurement}
            pulseProgress={lightPulseProgress}
            onChangeEndpoints={(from, to, obs) => {
              setMeasureFromId(from);
              setMeasureToId(to);
              setMeasureObserverId(obs);
            }}
            onToggleFrozen={() => {
              if (!measureFrozen) {
                const m = calculatePhysicalMeasurement(
                  measureFromId,
                  measureToId,
                  bodyStates,
                  measureObserverId
                );
                if (m.valid) {
                  setFrozenMeasurement({
                    id: `m_${Date.now()}`,
                    fromId: measureFromId,
                    toId: measureToId,
                    observerId: measureObserverId,
                    simTimeMs,
                    centerDistanceKm: m.centerDistanceKm,
                    surfaceDistanceKm: m.surfaceDistanceKm,
                    distanceAu: m.distanceAu,
                    lightTimeSeconds: m.lightTimeSeconds,
                    angularSeparationDeg: m.angularSeparationDeg ?? undefined,
                    isFrozen: true,
                    timestampIso: new Date().toISOString(),
                  });
                }
                setMeasureFrozen(true);
              } else {
                setMeasureFrozen(false);
                setFrozenMeasurement(null);
              }
            }}
            onSaveToHistory={() => {
              const m = calculatePhysicalMeasurement(
                measureFromId,
                measureToId,
                bodyStates,
                measureObserverId
              );
              if (!m.valid) return;
              const rec: MeasurementRecord = {
                id: `m_${Date.now()}`,
                fromId: measureFromId,
                toId: measureToId,
                observerId: measureObserverId,
                simTimeMs,
                centerDistanceKm: m.centerDistanceKm,
                surfaceDistanceKm: m.surfaceDistanceKm,
                distanceAu: m.distanceAu,
                lightTimeSeconds: m.lightTimeSeconds,
                angularSeparationDeg: m.angularSeparationDeg ?? undefined,
                isFrozen: measureFrozen,
                timestampIso: new Date().toISOString(),
              };
              setMeasureHistory((prev) => [rec, ...prev].slice(0, 12));
            }}
            onTriggerLightPulse={() => setLightPulseProgress(0)}
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}

      {/* 5 INTERACTIVE SCIENTIFIC LABORATORIES */}
      {activeTool === 'scale_lab' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <ScaleLaboratoryModal
            preferences={preferences}
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}

      {activeTool === 'seasons_lab' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <SeasonsLaboratoryModal
            preferences={preferences}
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}

      {activeTool === 'moon_lab' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <LunarLaboratoryModal
            preferences={preferences}
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}

      {activeTool === 'orbit_lab' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <OrbitSandboxLaboratoryModal
            preferences={preferences}
            savedPresets={store.savedOrbitExperiments}
            onSavePreset={(preset: HypotheticalOrbitPreset) =>
              setStore((prev) => ({
                ...prev,
                savedOrbitExperiments: [preset, ...prev.savedOrbitExperiments],
              }))
            }
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}

      {activeTool === 'outer_system' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md">
          <BeyondNeptuneModal
            preferences={preferences}
            onSelectBodyAndClose={(id) => {
              handleSelectBody(id, true);
              setActiveTool('none');
            }}
            onClose={() => setActiveTool('none')}
          />
        </div>
      )}
    </div>
  );
};
export default App;
