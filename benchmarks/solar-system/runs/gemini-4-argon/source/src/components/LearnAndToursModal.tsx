import React, { useEffect, useMemo, useState } from 'react';
import {
  ActiveTool,
  Language,
  ScaleMode,
} from '../types/solarSystem';
import {
  ENCYCLOPEDIA_ARTICLES,
  EncyclopediaArticle,
  GUIDED_TOURS,
  GuidedTourSpec,
  LEARNING_ACTIVITIES,
  LearningActivitySpec,
  SPACECRAFT_MISSIONS,
} from '../data/educationalContent';
import { CATALOG_BY_ID, normalizeSearchText } from '../data/celestialCatalog';
import {
  Award,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Compass,
  ExternalLink,
  HelpCircle,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

export interface ActiveTourState {
  tourId: string;
  stopIndex: number;
  isPaused: boolean;
  pacing: 'auto' | 'manual';
  savedScaleMode: ScaleMode;
  savedSelectedId: string;
  remainingSeconds: number;
}

interface LearnAndToursModalProps {
  activeTool: ActiveTool;
  locale: Language;
  selectedBodyId: string;
  scaleMode: ScaleMode;
  completedActivities: string[];
  narrationEnabled: boolean;
  activeTour: ActiveTourState | null;
  initialEncyclopediaArticleId?: string;
  onStartTour: (tourId: string) => void;
  onUpdateTour: (next: ActiveTourState | null) => void;
  onSelectBody: (id: string) => void;
  onSetScaleMode: (mode: ScaleMode) => void;
  onSetSimTimeMs: (ms: number, pause?: boolean) => void;
  onOpenTool: (tool: ActiveTool, articleId?: string) => void;
  onCompleteActivity: (activityId: string) => void;
  onResetActivityProgress: () => void;
  onToggleNarration: () => void;
  onCloseTool: () => void;
}

export const LearnAndToursModal: React.FC<LearnAndToursModalProps> = ({
  activeTool,
  locale,
  selectedBodyId,
  completedActivities,
  narrationEnabled,
  activeTour,
  initialEncyclopediaArticleId,
  onStartTour,
  onUpdateTour,
  onSelectBody,
  onSetScaleMode,
  onSetSimTimeMs,
  onOpenTool,
  onCompleteActivity,
  onResetActivityProgress,
  onToggleNarration,
  onCloseTool,
}) => {
  // Encyclopedia state & history stack
  const [encSearch, setEncSearch] = useState('');
  const [encCategory, setEncCategory] = useState<string>('all');
  const [encSelectedId, setEncSelectedId] = useState<string>(
    initialEncyclopediaArticleId || 'about_this_model'
  );
  const [encHistory, setEncHistory] = useState<string[]>([]);

  useEffect(() => {
    if (initialEncyclopediaArticleId && initialEncyclopediaArticleId !== encSelectedId) {
      setEncHistory((prev) => [...prev, encSelectedId]);
      setEncSelectedId(initialEncyclopediaArticleId);
    }
  }, [initialEncyclopediaArticleId]);

  const navigateEncyclopediaArticle = (articleId: string) => {
    if (articleId === encSelectedId) return;
    setEncHistory((prev) => [...prev, encSelectedId]);
    setEncSelectedId(articleId);
  };

  const popEncyclopediaHistory = () => {
    setEncHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setEncSelectedId(last);
      return prev.slice(0, -1);
    });
  };

  // Activities state
  const [selectedActivityId, setSelectedActivityId] = useState<string>(
    LEARNING_ACTIVITIES[0].id
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [activityThemeFilter, setActivityThemeFilter] = useState<string>('all');
  const [confirmResetActivities, setConfirmResetActivities] = useState(false);

  // Missions filter state
  const [missionEraFilter, setMissionEraFilter] = useState<string>('all');
  const [missionTypeFilter, setMissionTypeFilter] = useState<string>('all');
  const [missionDestinationFilter, setMissionDestinationFilter] = useState<string>('all');

  // Active Tour timer and narration effect
  const currentTourSpec: GuidedTourSpec | undefined = useMemo(
    () => (activeTour ? GUIDED_TOURS.find((t) => t.id === activeTour.tourId) : undefined),
    [activeTour]
  );

  const currentTourStop = useMemo(
    () =>
      currentTourSpec && activeTour
        ? currentTourSpec.stops[activeTour.stopIndex] || currentTourSpec.stops[0]
        : undefined,
    [currentTourSpec, activeTour]
  );

  // Apply stop target & optional temporary scale mode whenever tour stop changes
  useEffect(() => {
    if (!activeTour || !currentTourStop) return;
    onSelectBody(currentTourStop.targetId);
    if (currentTourStop.temporaryScaleMode) {
      onSetScaleMode(currentTourStop.temporaryScaleMode);
    } else {
      onSetScaleMode(activeTour.savedScaleMode);
    }

    // Optional Web Speech API synthesis if narrationEnabled is true
    if (narrationEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          `${currentTourStop.title[locale]}. ${currentTourStop.narrative[locale]}`
        );
        utterance.lang = locale === 'pt-BR' ? 'pt-BR' : 'en-US';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore if speech synthesis is blocked or unsupported
      }
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [activeTour?.tourId, activeTour?.stopIndex, narrationEnabled, locale]);

  // Countdown timer for automatic tour pacing
  useEffect(() => {
    if (!activeTour || activeTour.isPaused || activeTour.pacing !== 'auto' || !currentTourSpec) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!activeTour || !currentTourSpec) return;
      if (activeTour.remainingSeconds > 1) {
        onUpdateTour({
          ...activeTour,
          remainingSeconds: activeTour.remainingSeconds - 1,
        });
      } else {
        // Advance to next stop or pause at end
        if (activeTour.stopIndex + 1 < currentTourSpec.stops.length) {
          const nextStop = currentTourSpec.stops[activeTour.stopIndex + 1];
          onUpdateTour({
            ...activeTour,
            stopIndex: activeTour.stopIndex + 1,
            remainingSeconds: nextStop.readingSeconds,
          });
        } else {
          onUpdateTour({
            ...activeTour,
            isPaused: true,
            remainingSeconds: 0,
          });
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTour, currentTourSpec, onUpdateTour]);

  const handleExitTour = () => {
    if (!activeTour) return;
    onSetScaleMode(activeTour.savedScaleMode);
    onUpdateTour(null);
  };

  const handleJumpTourStop = (index: number) => {
    if (!activeTour || !currentTourSpec) return;
    const clamped = Math.max(0, Math.min(currentTourSpec.stops.length - 1, index));
    const stop = currentTourSpec.stops[clamped];
    onUpdateTour({
      ...activeTour,
      stopIndex: clamped,
      remainingSeconds: stop.readingSeconds,
    });
  };

  // Filtered Encyclopedia articles
  const filteredArticles = useMemo(() => {
    const q = normalizeSearchText(encSearch);
    return ENCYCLOPEDIA_ARTICLES.filter((art) => {
      if (encCategory !== 'all' && art.category !== encCategory) return false;
      if (!q) return true;
      const hay = normalizeSearchText(
        `${art.title['pt-BR']} ${art.title.en} ${art.shortDefinition[locale]} ${art.synonyms.join(' ')}`
      );
      return hay.includes(q);
    });
  }, [encSearch, encCategory, locale]);

  const currentArticle: EncyclopediaArticle = useMemo(
    () =>
      ENCYCLOPEDIA_ARTICLES.find((a) => a.id === encSelectedId) ||
      ENCYCLOPEDIA_ARTICLES[0],
    [encSelectedId]
  );

  // Filtered Missions
  const filteredMissions = useMemo(() => {
    return SPACECRAFT_MISSIONS.filter((m) => {
      if (missionEraFilter !== 'all' && m.era !== missionEraFilter) return false;
      if (missionTypeFilter !== 'all' && m.missionType !== missionTypeFilter) return false;
      if (
        missionDestinationFilter !== 'all' &&
        !m.targetIds.includes(missionDestinationFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [missionEraFilter, missionTypeFilter, missionDestinationFilter]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return LEARNING_ACTIVITIES.filter((a) => {
      if (activityThemeFilter === 'all') return true;
      if (activityThemeFilter === 'completed') return completedActivities.includes(a.id);
      if (activityThemeFilter === 'remaining') return !completedActivities.includes(a.id);
      return a.theme === activityThemeFilter;
    });
  }, [activityThemeFilter, completedActivities]);

  const currentActivity: LearningActivitySpec = useMemo(
    () =>
      LEARNING_ACTIVITIES.find((a) => a.id === selectedActivityId) ||
      LEARNING_ACTIVITIES[0],
    [selectedActivityId]
  );

  const isLearnModalOpen =
    activeTool === 'tours' ||
    activeTool === 'activities' ||
    activeTool === 'encyclopedia' ||
    activeTool === 'missions';

  return (
    <>
      {/* Active Guided Tour Non-Blocking HUD Overlay */}
      {activeTour && currentTourSpec && currentTourStop && (
        <aside
          aria-label={locale === 'pt-BR' ? 'Controle do Tour Guiado' : 'Guided Tour Controller'}
          data-testid="active-tour-hud"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-2xl bg-slate-950/92 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl p-4 text-slate-100 pointer-events-auto"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {currentTourSpec.title[locale]}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {locale === 'pt-BR' ? 'Parada' : 'Stop'} {activeTour.stopIndex + 1} /{' '}
                {currentTourSpec.stops.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Auto / Manual Pacing Toggle */}
              <button
                type="button"
                onClick={() =>
                  onUpdateTour({
                    ...activeTour,
                    pacing: activeTour.pacing === 'auto' ? 'manual' : 'auto',
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activeTour.pacing === 'auto'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {activeTour.pacing === 'auto'
                  ? `${locale === 'pt-BR' ? 'Automático' : 'Auto'} (${activeTour.remainingSeconds}s)`
                  : locale === 'pt-BR'
                  ? 'Ritmo Manual'
                  : 'Manual Pacing'}
              </button>

              {/* Optional Speech Synthesis Toggle */}
              <button
                type="button"
                onClick={onToggleNarration}
                title={
                  locale === 'pt-BR'
                    ? 'Alternar Narração por Voz (Opcional)'
                    : 'Toggle Voice Narration (Optional)'
                }
                className={`p-1.5 rounded-lg border transition-colors ${
                  narrationEnabled
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {narrationEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Exit Tour */}
              <button
                type="button"
                data-testid="exit-tour-btn"
                onClick={handleExitTour}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-700/50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {locale === 'pt-BR' ? 'Sair do Tour' : 'Exit Tour'}
              </button>
            </div>
          </div>

          <h3 className="text-base font-bold text-white mb-1">{currentTourStop.title[locale]}</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
            {currentTourStop.narrative[locale]}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Transport Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeTour.stopIndex === 0}
                onClick={() => handleJumpTourStop(activeTour.stopIndex - 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700"
              >
                <SkipBack className="w-3.5 h-3.5" />
                {locale === 'pt-BR' ? 'Anterior' : 'Prev'}
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateTour({
                    ...activeTour,
                    isPaused: !activeTour.isPaused,
                  })
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              >
                {activeTour.isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {locale === 'pt-BR' ? 'Retomar' : 'Resume'}
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    {locale === 'pt-BR' ? 'Pausar' : 'Pause'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleJumpTourStop(activeTour.stopIndex)}
                title={locale === 'pt-BR' ? 'Reiniciar Parada' : 'Restart Stop'}
                className="p-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={activeTour.stopIndex >= currentTourSpec.stops.length - 1}
                onClick={() => handleJumpTourStop(activeTour.stopIndex + 1)}
                data-testid="next-tour-stop-btn"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700"
              >
                {locale === 'pt-BR' ? 'Próximo' : 'Next'}
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              {/* Stop Jumper Select */}
              <select
                aria-label={locale === 'pt-BR' ? 'Pular para parada' : 'Jump to stop'}
                value={activeTour.stopIndex}
                onChange={(e) => handleJumpTourStop(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
              >
                {currentTourSpec.stops.map((st, idx) => (
                  <option key={st.id} value={idx}>
                    {st.title[locale]}
                  </option>
                ))}
              </select>
            </div>

            {/* Deeper Action Button */}
            {currentTourStop.deeperTool && (
              <button
                type="button"
                onClick={() => {
                  onUpdateTour({ ...activeTour, isPaused: true });
                  onOpenTool(currentTourStop.deeperTool!);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                {currentTourStop.deeperActionLabel[locale]}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main Learn, Tours, Missions & Encyclopedia Modal */}
      {isLearnModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            locale === 'pt-BR'
              ? 'Centro de Aprendizagem, Tours, Missões e Enciclopédia'
              : 'Learning Center, Tours, Missions & Encyclopedia'
          }
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
        >
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-950/95 border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            {/* Top Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900/90 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenTool('tours')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTool === 'tours'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  {locale === 'pt-BR' ? 'Tours Guiados (6)' : 'Guided Tours (6)'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTool('activities')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTool === 'activities'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  {locale === 'pt-BR'
                    ? `Atividades (${completedActivities.length}/${LEARNING_ACTIVITIES.length})`
                    : `Activities (${completedActivities.length}/${LEARNING_ACTIVITIES.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTool('missions')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTool === 'missions'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  {locale === 'pt-BR' ? 'Missões Espaciais (8)' : 'Spacecraft Missions (8)'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTool('encyclopedia')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTool === 'encyclopedia'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {locale === 'pt-BR' ? 'Enciclopédia e Modelo' : 'Encyclopedia & Model'}
                </button>
              </div>

              <button
                type="button"
                onClick={onCloseTool}
                aria-label={locale === 'pt-BR' ? 'Fechar janela' : 'Close dialog'}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* TAB 1: GUIDED TOURS */}
              {activeTool === 'tours' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {locale === 'pt-BR'
                          ? 'Jornadas Guiadas pelo Sistema Solar'
                          : 'Guided Solar System Journeys'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {locale === 'pt-BR'
                          ? 'Escolha um roteiro cinematográfico e científico. Você pode pausar, avançar manualmente ou sair a qualquer momento, restaurando sua escala original.'
                          : 'Choose a cinematic and scientific tour. You can pause, step manually, or exit anytime while restoring your prior scale.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {GUIDED_TOURS.map((tour) => (
                      <div
                        key={tour.id}
                        className="flex flex-col justify-between p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-cyan-400">
                              {tour.stops.length}{' '}
                              {locale === 'pt-BR' ? 'paradas' : 'stops'} •{' '}
                              {tour.durationEstimate[locale]}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-white mb-1">
                            {tour.title[locale]}
                          </h3>
                          <p className="text-xs font-medium text-slate-300 mb-2">
                            {tour.subtitle[locale]}
                          </p>
                          <p className="text-xs text-slate-400 leading-relaxed mb-3">
                            {tour.goal[locale]}
                          </p>

                          <div className="flex flex-wrap gap-1 mb-4">
                            {tour.stops.map((st, idx) => (
                              <span
                                key={st.id}
                                className="px-2 py-0.5 rounded text-[11px] bg-slate-950/90 text-slate-300 border border-slate-800"
                              >
                                {idx + 1}. {CATALOG_BY_ID[st.targetId]?.name[locale] || st.targetId}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`start-tour-${tour.id}`}
                          onClick={() => {
                            onStartTour(tour.id);
                            onCloseTool();
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {locale === 'pt-BR' ? 'Iniciar Tour Guiado' : 'Start Guided Tour'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: INTERACTIVE LEARNING ACTIVITIES */}
              {activeTool === 'activities' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Sidebar: Activity List & Milestones */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                          {locale === 'pt-BR' ? 'Progresso de Descoberta' : 'Discovery Progress'}
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          {completedActivities.length} / {LEARNING_ACTIVITIES.length}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                          style={{
                            width: `${(completedActivities.length / LEARNING_ACTIVITIES.length) * 100}%`,
                          }}
                        />
                      </div>

                      {/* Milestone Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            completedActivities.length >= 3
                              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          ★ {locale === 'pt-BR' ? 'Explorador (3+)' : 'Explorer (3+)'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            completedActivities.length >= 7
                              ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          ★★ {locale === 'pt-BR' ? 'Navegador Orbital (7+)' : 'Orbital Navigator (7+)'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            completedActivities.length >= 12
                              ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          ★★★ {locale === 'pt-BR' ? 'Astrônomo Completo (12)' : 'Master Astronomer (12)'}
                        </span>
                      </div>

                      {/* Filter & Reset Row */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <select
                          aria-label={locale === 'pt-BR' ? 'Filtrar atividades' : 'Filter activities'}
                          value={activityThemeFilter}
                          onChange={(e) => setActivityThemeFilter(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="all">
                            {locale === 'pt-BR' ? 'Todas as 12 atividades' : 'All 12 activities'}
                          </option>
                          <option value="remaining">
                            {locale === 'pt-BR' ? 'Pendentes' : 'Remaining'}
                          </option>
                          <option value="completed">
                            {locale === 'pt-BR' ? 'Concluídas' : 'Completed'}
                          </option>
                        </select>

                        {!confirmResetActivities ? (
                          <button
                            type="button"
                            onClick={() => setConfirmResetActivities(true)}
                            className="text-[11px] text-slate-400 hover:text-rose-300 underline"
                          >
                            {locale === 'pt-BR' ? 'Redefinir Progresso' : 'Reset Progress'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onResetActivityProgress();
                                setSelectedAnswers({});
                                setConfirmResetActivities(false);
                              }}
                              className="px-2 py-0.5 rounded text-[11px] bg-rose-600 text-white font-semibold"
                            >
                              {locale === 'pt-BR' ? 'Confirmar' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmResetActivities(false)}
                              className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300"
                            >
                              {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-1">
                      {filteredActivities.map((act) => {
                        const isDone = completedActivities.includes(act.id);
                        const isSelected = act.id === currentActivity.id;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => setSelectedActivityId(act.id)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                              isSelected
                                ? 'bg-cyan-950/50 border-cyan-500/60 text-white'
                                : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold leading-snug">
                                {act.title[locale]}
                              </div>
                              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {act.objective[locale]}
                              </div>
                            </div>
                            {isDone && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Active Activity Challenge */}
                  <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                          {locale === 'pt-BR' ? 'Desafio Interativo' : 'Interactive Challenge'}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white">
                          {currentActivity.title[locale]}
                        </h3>
                      </div>
                      {completedActivities.includes(currentActivity.id) && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {locale === 'pt-BR' ? 'Concluída' : 'Completed'}
                        </span>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        {locale === 'pt-BR' ? 'Objetivo:' : 'Objective:'}{' '}
                        <span className="font-normal text-slate-400">
                          {currentActivity.objective[locale]}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-cyan-300">
                        {locale === 'pt-BR' ? 'Tarefa na Cena:' : 'Scene Task:'}{' '}
                        <span className="font-normal text-slate-200">
                          {currentActivity.sceneTaskDescription[locale]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBody(currentActivity.startingBodyId);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                        >
                          {locale === 'pt-BR' ? 'Focar Alvo na Cena:' : 'Focus Target in Scene:'}{' '}
                          {CATALOG_BY_ID[currentActivity.startingBodyId]?.name[locale] ||
                            currentActivity.startingBodyId}
                          {selectedBodyId === currentActivity.startingBodyId ? ' ✓' : ''}
                        </button>

                        {currentActivity.recommendedTool && (
                          <button
                            type="button"
                            onClick={() => onOpenTool(currentActivity.recommendedTool!)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40"
                          >
                            {locale === 'pt-BR'
                              ? 'Abrir Laboratório Recomendado'
                              : 'Open Recommended Lab'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question & Options */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-white leading-relaxed">
                        {currentActivity.promptQuestion[locale]}
                      </p>

                      <div className="space-y-2">
                        {currentActivity.options.map((opt) => {
                          const chosenId = selectedAnswers[currentActivity.id];
                          const isChosen = chosenId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={`activity-opt-${opt.id}`}
                              onClick={() => {
                                setSelectedAnswers((prev) => ({
                                  ...prev,
                                  [currentActivity.id]: opt.id,
                                }));
                                if (opt.isCorrect) {
                                  onCompleteActivity(currentActivity.id);
                                }
                              }}
                              className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition-all ${
                                isChosen
                                  ? opt.isCorrect
                                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                                    : 'bg-amber-950/60 border-amber-500 text-amber-100'
                                  : 'bg-slate-950/70 border-slate-800 text-slate-200 hover:border-slate-700'
                              }`}
                            >
                              {opt.label[locale]}
                            </button>
                          );
                        })}
                      </div>

                      {/* Hint Toggle */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedHints((prev) => ({
                              ...prev,
                              [currentActivity.id]: !prev[currentActivity.id],
                            }))
                          }
                          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          {revealedHints[currentActivity.id]
                            ? locale === 'pt-BR'
                              ? 'Ocultar Dica'
                              : 'Hide Hint'
                            : locale === 'pt-BR'
                            ? 'Precisa de uma dica?'
                            : 'Need a hint?'}
                        </button>

                        {selectedAnswers[currentActivity.id] && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAnswers((prev) => {
                                const next = { ...prev };
                                delete next[currentActivity.id];
                                return next;
                              })
                            }
                            className="text-xs text-slate-400 hover:text-white underline"
                          >
                            {locale === 'pt-BR' ? 'Tentar novamente' : 'Try again'}
                          </button>
                        )}
                      </div>

                      {revealedHints[currentActivity.id] && (
                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200">
                          <strong>{locale === 'pt-BR' ? 'Dica:' : 'Hint:'}</strong>{' '}
                          {currentActivity.hint[locale]}
                        </div>
                      )}

                      {/* Immediate Feedback & Scientific Explanation */}
                      {selectedAnswers[currentActivity.id] && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
                            currentActivity.options.find(
                              (o) => o.id === selectedAnswers[currentActivity.id]
                            )?.isCorrect
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                              : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
                          }`}
                        >
                          <div className="font-bold">
                            {currentActivity.options.find(
                              (o) => o.id === selectedAnswers[currentActivity.id]
                            )?.isCorrect
                              ? locale === 'pt-BR'
                                ? 'Correto! Explicação Científica:'
                                : 'Correct! Scientific Explanation:'
                              : locale === 'pt-BR'
                              ? 'Ainda não! Veja o princípio físico e tente novamente:'
                              : 'Not quite! Review the physical principle and try again:'}
                          </div>
                          <p>{currentActivity.explanation[locale]}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SPACECRAFT & EXPLORATION HISTORY */}
              {activeTool === 'missions' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {locale === 'pt-BR'
                          ? 'Sondas Espaciais e História da Exploração'
                          : 'Spacecraft & Exploration History'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {locale === 'pt-BR'
                          ? 'Marcos históricos reais com datas de lançamento e encontro documentadas. As rotas são esquemáticas educacionais (não telemetria ao vivo).'
                          : 'Historically sourced milestones with launch and encounter dates. Trajectories are educational schematics (not live spacecraft telemetry).'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onStartTour('follow_discoveries');
                        onCloseTool();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      {locale === 'pt-BR'
                        ? 'Iniciar Tour "Siga as Descobertas"'
                        : 'Start "Follow the Discoveries" Tour'}
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={locale === 'pt-BR' ? 'Filtrar por destino' : 'Filter by destination'}
                      value={missionDestinationFilter}
                      onChange={(e) => setMissionDestinationFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="all">
                        {locale === 'pt-BR' ? 'Todos os Destinos' : 'All Destinations'}
                      </option>
                      <option value="moon">{locale === 'pt-BR' ? 'Lua' : 'Moon'}</option>
                      <option value="mars">{locale === 'pt-BR' ? 'Marte' : 'Mars'}</option>
                      <option value="ceres">Ceres / Vesta</option>
                      <option value="jupiter">{locale === 'pt-BR' ? 'Júpiter' : 'Jupiter'}</option>
                      <option value="saturn">{locale === 'pt-BR' ? 'Saturno / Titã' : 'Saturn / Titan'}</option>
                      <option value="uranus">{locale === 'pt-BR' ? 'Urano' : 'Uranus'}</option>
                      <option value="neptune">{locale === 'pt-BR' ? 'Netuno' : 'Neptune'}</option>
                      <option value="pluto">{locale === 'pt-BR' ? 'Plutão' : 'Pluto'}</option>
                    </select>

                    <select
                      aria-label={locale === 'pt-BR' ? 'Filtrar por tipo de missão' : 'Filter by mission type'}
                      value={missionTypeFilter}
                      onChange={(e) => setMissionTypeFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="all">
                        {locale === 'pt-BR' ? 'Todos os Tipos de Missão' : 'All Mission Types'}
                      </option>
                      <option value="flyby">{locale === 'pt-BR' ? 'Sobrevoo (Flyby)' : 'Flyby'}</option>
                      <option value="orbiter">{locale === 'pt-BR' ? 'Orbitador' : 'Orbiter'}</option>
                      <option value="lander_rover">
                        {locale === 'pt-BR' ? 'Lander / Rover' : 'Lander / Rover'}
                      </option>
                      <option value="crewed">{locale === 'pt-BR' ? 'Tripulada' : 'Crewed'}</option>
                    </select>

                    <select
                      aria-label={locale === 'pt-BR' ? 'Filtrar por era' : 'Filter by era'}
                      value={missionEraFilter}
                      onChange={(e) => setMissionEraFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="all">{locale === 'pt-BR' ? 'Todas as Eras' : 'All Eras'}</option>
                      <option value="pioneer_apollo">Apollo & Pioneer (1960–1975)</option>
                      <option value="grand_tour_era">Voyager Grand Tour (1977–1989)</option>
                      <option value="modern_orbiters">Cassini & Dawn (1997–2018)</option>
                      <option value="contemporary">New Horizons, Juno & Perseverance (2006–2025)</option>
                    </select>
                  </div>

                  {/* Mission Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredMissions.map((mission) => (
                      <div
                        key={mission.id}
                        className="p-4 rounded-xl bg-slate-900/85 border border-slate-800 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-bold text-white">{mission.name}</h3>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                              {mission.agency}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                            <div>
                              <span className="text-slate-400 block">
                                {locale === 'pt-BR' ? 'Lançamento:' : 'Launch:'}
                              </span>
                              <span className="font-mono text-slate-200">{mission.launchDate}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">
                                {locale === 'pt-BR' ? 'Encontro/Chegada:' : 'Encounter/Arrival:'}
                              </span>
                              <span className="font-mono text-slate-200">
                                {mission.arrivalOrEncounterDate}
                              </span>
                            </div>
                            <div className="col-span-2 pt-1 border-t border-slate-800/60">
                              <span className="text-slate-400">
                                {locale === 'pt-BR' ? 'Status (Ref. ' : 'Status (Ref. '}
                                {mission.statusReferenceDate}):{' '}
                              </span>
                              <span className="text-slate-200">
                                {mission.endDateOrStatus[locale]}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {mission.achievement[locale]}
                          </p>
                          <p className="text-[11px] text-amber-300/90 italic">
                            {mission.routeNote[locale]}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              onSetSimTimeMs(mission.historicalSimTimeMs, true);
                              onSelectBody(mission.targetIds[0]);
                              onCloseTool();
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                          >
                            {locale === 'pt-BR'
                              ? 'Ir para Data Histórica e Focar Alvo'
                              : 'Jump to Encounter Date & Focus Target'}
                          </button>

                          <a
                            href={mission.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300"
                          >
                            NASA
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: ENCYCLOPEDIA, GLOSSARY & MODEL TRANSPARENCY */}
              {activeTool === 'encyclopedia' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Column: Search & Article List */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={encSearch}
                        onChange={(e) => setEncSearch(e.target.value)}
                        placeholder={
                          locale === 'pt-BR'
                            ? 'Buscar conceito (ex.: UA, periélio, maré, modelo)...'
                            : 'Search concept (e.g., AU, perihelion, tidal, model)...'
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'all', label: locale === 'pt-BR' ? 'Todos' : 'All' },
                        { id: 'model', label: locale === 'pt-BR' ? 'Sobre o Modelo' : 'About Model' },
                        { id: 'orbital_mechanics', label: locale === 'pt-BR' ? 'Órbitas' : 'Orbits' },
                        { id: 'physical_properties', label: locale === 'pt-BR' ? 'Física' : 'Physics' },
                        { id: 'observation', label: locale === 'pt-BR' ? 'Observação' : 'Observation' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setEncCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            encCategory === cat.id
                              ? 'bg-cyan-500 text-slate-950 font-semibold'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5 max-h-[54vh] overflow-y-auto pr-1">
                      {filteredArticles.map((art) => (
                        <button
                          key={art.id}
                          type="button"
                          data-testid={`enc-article-${art.id}`}
                          onClick={() => navigateEncyclopediaArticle(art.id)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                            art.id === currentArticle.id
                              ? 'bg-cyan-950/60 border-cyan-500/60 text-white'
                              : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <div className="text-xs font-bold">{art.title[locale]}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                            {art.shortDefinition[locale]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Two-Level Article Reader */}
                  <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                          {locale === 'pt-BR'
                            ? 'Enciclopédia Científica (2 Níveis)'
                            : 'Scientific Encyclopedia (2-Level)'}
                        </span>
                        <h3 className="text-lg font-bold text-white">
                          {currentArticle.title[locale]}
                        </h3>
                      </div>

                      {encHistory.length > 0 && (
                        <button
                          type="button"
                          data-testid="encyclopedia-back-btn"
                          onClick={popEncyclopediaHistory}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          {locale === 'pt-BR' ? 'Artigo Anterior' : 'Previous Article'}
                        </button>
                      )}
                    </div>

                    {/* Level 1: Accessible Summary */}
                    <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                        {locale === 'pt-BR'
                          ? 'Nível 1 • Definição Essencial'
                          : 'Level 1 • Essential Definition'}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
                        {currentArticle.shortDefinition[locale]}
                      </p>
                    </div>

                    {/* Level 2: Deeper Physical & Mathematical Explanation */}
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                        {locale === 'pt-BR'
                          ? 'Nível 2 • Aprofundamento Físico e Limites do Modelo'
                          : 'Level 2 • Deeper Physics & Model Boundaries'}
                      </div>
                      {currentArticle.deeperExplanation[locale].split('\n').map((para, idx) => (
                        <p key={idx} className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {para}
                        </p>
                      ))}
                    </div>

                    {/* Interactive Actions & Institutional Source */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <div className="flex flex-wrap gap-2">
                        {currentArticle.linkedBodyId && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBody(currentArticle.linkedBodyId!);
                              onCloseTool();
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                          >
                            {locale === 'pt-BR' ? 'Inspecionar na Cena:' : 'Inspect in Scene:'}{' '}
                            {CATALOG_BY_ID[currentArticle.linkedBodyId]?.name[locale] ||
                              currentArticle.linkedBodyId}
                          </button>
                        )}

                        {currentArticle.linkedTool && currentArticle.linkedActionLabel && (
                          <button
                            type="button"
                            onClick={() => onOpenTool(currentArticle.linkedTool!)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40"
                          >
                            {currentArticle.linkedActionLabel[locale]}
                          </button>
                        )}
                      </div>

                      <a
                        href={currentArticle.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300"
                      >
                        {currentArticle.source.title[locale]} ({currentArticle.source.referenceDate})
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
