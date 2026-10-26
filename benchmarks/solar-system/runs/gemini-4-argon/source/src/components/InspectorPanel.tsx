import React, { useState } from 'react';
import {
  Camera,
  Compass,
  Eye,
  Heart,
  Info,
  Layers,
  Orbit,
  Ruler,
  Scale,
  Sparkles,
  Volume2,
  Bookmark,
  ExternalLink,
  X,
} from 'lucide-react';
import {
  ActiveTool,
  CameraMode,
  CelestialBodyData,
  EvaluatedBodyState,
  Language,
  UserPreferences,
} from '../types/solarSystem';
import { CATALOG_BY_ID, getChildMoons } from '../data/celestialCatalog';
import {
  formatDiameter,
  formatDistanceAuAndKm,
  formatNumber,
  formatPeriodDays,
  formatRotationHours,
  formatScientificMass,
  formatTemperatureK,
} from '../utils/formatters';
import { audioController } from '../utils/audioEngine';

interface InspectorPanelProps {
  body: CelestialBodyData;
  bodyState: EvaluatedBodyState | undefined;
  allStates: Record<string, EvaluatedBodyState>;
  preferences: UserPreferences;
  isFavorite: boolean;
  cameraMode: CameraMode;
  onSelectBody: (id: string, initiateFocus?: boolean) => void;
  onFocusBody: (id: string) => void;
  onToggleFollow: (id: string) => void;
  onFrameMoonsSystem: (parentId: string) => void;
  onToggleFavorite: (id: string) => void;
  onCompareWith: (id: string) => void;
  onMeasureFrom: (id: string) => void;
  onSaveViewpoint: () => void;
  onCompleteOneOrbit: (body: CelestialBodyData) => void;
  onToggleVenusRadar: () => void;
  onOpenEncyclopediaTerm: (termId: string) => void;
  onOpenTool: (tool: ActiveTool) => void;
  onCloseMobileSheet?: () => void;
}

const INLINE_TERM_HELP: Record<
  string,
  { title: Record<Language, string>; text: Record<Language, string>; articleId: string }
> = {
  sidereal: {
    title: { 'pt-BR': 'Rotação Sideral vs. Dia Solar', en: 'Sidereal Rotation vs. Solar Day' },
    text: {
      'pt-BR':
        'O período sideral é o tempo para girar 360° em relação às estrelas distantes. O dia solar é o tempo de um meio-dia solar ao seguinte, combinando a rotação com o movimento orbital.',
      en: 'Sidereal period is the time to rotate 360° relative to distant stars. Solar day is noon-to-noon, combining spin with orbital motion around the Sun.',
    },
    articleId: 'sidereal_vs_solar_day',
  },
  one_bar: {
    title: { 'pt-BR': 'Nível de Referência de 1 bar', en: '1-Bar Reference Surface' },
    text: {
      'pt-BR':
        'Gigantes gasosos e de gelo não possuem crosta sólida. Por convenção da UAI/JPL, o raio, a gravidade e a temperatura são medidos na altitude onde a pressão atmosférica é de 1 bar.',
      en: 'Gas and ice giants lack a solid surface. By IAU/JPL convention, radius, gravity, and temperature are defined at the altitude where atmospheric pressure equals 1 bar.',
    },
    articleId: 'mass_and_gravity',
  },
  semi_major: {
    title: {
      'pt-BR': 'Semieixo Maior vs. Distância Instantânea',
      en: 'Semi-Major Axis vs. Instantaneous Distance',
    },
    text: {
      'pt-BR':
        'O semieixo maior (a) é a média geométrica entre o periélio e o afélio da elipse orbital. A distância instantânea varia continuamente conforme o corpo percorre sua órbita.',
      en: 'The semi-major axis (a) is the orbital ellipse’s average radius between perihelion and aphelion. Instantaneous distance varies continuously as the body moves along its orbit.',
    },
    articleId: 'perihelion_aphelion',
  },
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  body,
  bodyState,
  allStates,
  preferences,
  isFavorite,
  cameraMode,
  onSelectBody,
  onFocusBody,
  onToggleFollow,
  onFrameMoonsSystem,
  onToggleFavorite,
  onCompareWith,
  onMeasureFrom,
  onSaveViewpoint,
  onCompleteOneOrbit,
  onToggleVenusRadar,
  onOpenEncyclopediaTerm,
  onOpenTool,
  onCloseMobileSheet,
}) => {
  const lang = preferences.language;
  const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'system' | 'sources'>(
    'overview'
  );
  const [openTermKey, setOpenTermKey] = useState<string | null>(null);
  const [sonifyFeedbackHz, setSonifyFeedbackHz] = useState<number | null>(null);

  const childMoons = getChildMoons(body.id);
  const parentBody = body.parentId ? CATALOG_BY_ID[body.parentId] : undefined;
  const hasSystemTab =
    childMoons.length > 0 || (body.category === 'moon' && Boolean(parentBody));

  // If current body has no system tab and user was on 'system', fallback to 'overview'
  const effectiveTab = activeTab === 'system' && !hasSystemTab ? 'overview' : activeTab;

  const isFollowingThis = cameraMode === 'follow';

  const handleSonify = () => {
    if (!body.orbitalPeriodDays) return;
    const hz = audioController.playOrbitalSonification(body.orbitalPeriodDays);
    setSonifyFeedbackHz(hz);
    setTimeout(() => setSonifyFeedbackHz(null), 2600);
  };

  return (
    <aside
      aria-label={
        lang === 'pt-BR'
          ? `Inspetor de objeto: ${body.name[lang]}`
          : `Object Inspector: ${body.name[lang]}`
      }
      style={{ backgroundColor: `rgba(9, 14, 28, ${preferences.panelOpacity})` }}
      className="flex flex-col w-full h-full rounded-2xl border border-slate-700/70 backdrop-blur-md text-slate-100 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800/90 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full shrink-0 border border-white/20 shadow-inner"
            style={{
              background: `radial-gradient(circle at 32% 32%, ${body.visual.accentColor}, ${body.visual.primaryColor} 60%, ${body.visual.secondaryColor})`,
            }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base font-bold tracking-tight text-white truncate">
                {body.name[lang]}
              </h2>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-sky-500/15 text-sky-300 border border-sky-400/30">
                {body.simulationTier === 'simulated'
                  ? lang === 'pt-BR'
                    ? 'Simulado'
                    : 'Simulated'
                  : body.simulationTier === 'schematic'
                    ? lang === 'pt-BR'
                      ? 'Esquemático'
                      : 'Schematic'
                    : lang === 'pt-BR'
                      ? 'Referência'
                      : 'Reference'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{body.subtype[lang]}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleFavorite(body.id)}
            aria-label={
              isFavorite
                ? lang === 'pt-BR'
                  ? 'Remover dos favoritos'
                  : 'Remove from favorites'
                : lang === 'pt-BR'
                  ? 'Adicionar aos favoritos'
                  : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={`p-1.5 rounded-lg border transition ${
              isFavorite
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          {onCloseMobileSheet && (
            <button
              type="button"
              onClick={onCloseMobileSheet}
              aria-label={lang === 'pt-BR' ? 'Fechar inspetor' : 'Close inspector'}
              className="p-1.5 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-300 hover:text-white lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Primary Action Bar */}
      <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onFocusBody(body.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>{lang === 'pt-BR' ? 'Focar' : 'Focus'}</span>
        </button>

        {body.simulationTier === 'simulated' && (
          <button
            type="button"
            onClick={() => onToggleFollow(body.id)}
            aria-pressed={isFollowingThis}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              isFollowingThis
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>
              {isFollowingThis
                ? lang === 'pt-BR'
                  ? 'Seguindo'
                  : 'Following'
                : lang === 'pt-BR'
                  ? 'Seguir'
                  : 'Follow'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onCompareWith(body.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>{lang === 'pt-BR' ? 'Comparar' : 'Compare'}</span>
        </button>

        <button
          type="button"
          onClick={() => onMeasureFrom(body.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>{lang === 'pt-BR' ? 'Medir daqui' : 'Measure'}</span>
        </button>

        {childMoons.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('system');
              onFrameMoonsSystem(body.id);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-xs font-medium transition"
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>
              {lang === 'pt-BR'
                ? `Luas (${childMoons.length})`
                : `Moons (${childMoons.length})`}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onSaveViewpoint}
          title={lang === 'pt-BR' ? 'Salvar ponto de vista atual' : 'Save current viewpoint'}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="sr-only sm:not-sr-only">
            {lang === 'pt-BR' ? 'Salvar Vista' : 'Save View'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenTool('photo_mode')}
          title={lang === 'pt-BR' ? 'Capturar fotografia' : 'Capture photograph'}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={lang === 'pt-BR' ? 'Seções do inspetor' : 'Inspector sections'}
        className="grid grid-flow-col auto-cols-fr border-b border-slate-800 text-xs font-semibold"
      >
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 border-b-2 transition ${
            effectiveTab === 'overview'
              ? 'border-sky-400 text-sky-300 bg-sky-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {lang === 'pt-BR' ? 'Visão Geral' : 'Overview'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === 'data'}
          onClick={() => setActiveTab('data')}
          className={`py-2.5 border-b-2 transition ${
            effectiveTab === 'data'
              ? 'border-sky-400 text-sky-300 bg-sky-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {lang === 'pt-BR' ? 'Dados' : 'Data'}
        </button>
        {hasSystemTab && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'system'}
            onClick={() => setActiveTab('system')}
            className={`py-2.5 border-b-2 transition ${
              effectiveTab === 'system'
                ? 'border-sky-400 text-sky-300 bg-sky-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'pt-BR' ? 'Sistema' : 'System'}
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === 'sources'}
          onClick={() => setActiveTab('sources')}
          className={`py-2.5 border-b-2 transition ${
            effectiveTab === 'sources'
              ? 'border-sky-400 text-sky-300 bg-sky-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {lang === 'pt-BR' ? 'Fontes' : 'Sources'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs leading-relaxed">
        {effectiveTab === 'overview' && (
          <>
            <p className="text-slate-200 text-[13px] leading-relaxed">
              {body.summary[lang]}
            </p>

            {/* Venus Radar Surface Reveal Toggle (Section 09) */}
            {body.id === 'venus' && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-amber-200">
                    {lang === 'pt-BR'
                      ? 'Revelação de Superfície por Radar'
                      : 'Radar Surface Reveal'}
                  </div>
                  <div className="text-[11px] text-amber-100/80">
                    {lang === 'pt-BR'
                      ? 'Alterna entre nuvens em luz visível e mapa ilustrativo derivado de radar (Magellan).'
                      : 'Switches between visible clouds and illustrative Magellan-style radar altimetry.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleVenusRadar}
                  aria-pressed={preferences.venusSurfaceRadarMode}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs shrink-0 border transition ${
                    preferences.venusSurfaceRadarMode
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-800 text-amber-200 border-amber-400/40'
                  }`}
                >
                  {preferences.venusSurfaceRadarMode
                    ? lang === 'pt-BR'
                      ? 'Radar Ativo'
                      : 'Radar On'
                    : lang === 'pt-BR'
                      ? 'Ver Radar'
                      : 'Show Radar'}
                </button>
              </div>
            )}

            {/* Key Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 tabular-nums">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {body.diameterDefinition === 'region_extent'
                    ? lang === 'pt-BR'
                      ? 'Extensão Regional'
                      : 'Region Extent'
                    : lang === 'pt-BR'
                      ? 'Diâmetro Médio'
                      : 'Mean Diameter'}
                </div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {formatDiameter(body.diameterKm, lang, preferences.unitSystem)}
                </div>
              </div>

              {body.id === 'sun' ? (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'pt-BR' ? 'Temperatura Fotosférica' : 'Photosphere Temp'}
                  </div>
                  <div className="text-sm font-semibold text-amber-300 mt-0.5">
                    {formatTemperatureK(body.meanTempK, lang)}
                  </div>
                </div>
              ) : body.category === 'moon' && body.parentId ? (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'pt-BR'
                      ? `Distância a ${parentBody?.name[lang] ?? ''}`
                      : `Distance to ${parentBody?.name[lang] ?? ''}`}
                  </div>
                  <div className="text-sm font-semibold text-sky-300 mt-0.5">
                    {formatNumber(
                      bodyState?.parentDistanceKm ?? body.parentDistanceKm,
                      lang,
                      0
                    )}{' '}
                    km
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'pt-BR'
                      ? 'Distância ao Sol (Instantânea)'
                      : 'Sun Distance (Instant)'}
                  </div>
                  <div className="text-sm font-semibold text-sky-300 mt-0.5">
                    {formatDistanceAuAndKm(
                      bodyState?.sunDistanceAu ?? body.semiMajorAxisAu,
                      bodyState?.sunDistanceKm ?? null,
                      lang
                    )}
                  </div>
                </div>
              )}

              {body.orbitalPeriodDays !== null && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'pt-BR' ? 'Período Orbital' : 'Orbital Period'}
                  </div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {formatPeriodDays(body.orbitalPeriodDays, lang)}
                  </div>
                </div>
              )}

              {body.knownMoons !== null && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'pt-BR'
                      ? 'Luas Exibidas / Conhecidas'
                      : 'Displayed / Known Moons'}
                  </div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {body.renderedMoons} / {body.knownMoons}{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      (ref. {body.knownMoonsRefDate.slice(0, 7)})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Curated Key Facts */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {lang === 'pt-BR' ? 'Destaques Científicos' : 'Scientific Highlights'}
              </h3>
              {body.keyFacts.map((fact, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex gap-2 items-start"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-slate-200">{fact[lang]}</p>
                </div>
              ))}
            </div>

            {/* Dwarf Planet Classification Box (Section 12) */}
            {body.classificationNote && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                <div className="font-semibold text-indigo-300 mb-1">
                  {lang === 'pt-BR'
                    ? 'Por que Planeta Anão? (Critérios da UAI)'
                    : 'Why a Dwarf Planet? (IAU Criteria)'}
                </div>
                <p className="text-slate-300 text-[11px]">
                  {body.classificationNote[lang]}
                </p>
              </div>
            )}

            {/* Complete One Orbit & Sonification Actions (Section 26 & 42) */}
            {body.orbitalPeriodDays && body.simulationTier === 'simulated' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCompleteOneOrbit(body)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-200 font-medium text-xs transition"
                >
                  <Orbit className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'pt-BR'
                      ? 'Avançar 1 Órbita Completa'
                      : 'Step 1 Complete Orbit'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSonify}
                  title={
                    lang === 'pt-BR'
                      ? 'Sonificação educativa: converte o período orbital em nota audível'
                      : 'Educational sonification: maps orbital period to audible pitch'
                  }
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-200 font-medium text-xs transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {sonifyFeedbackHz
                      ? `${sonifyFeedbackHz} Hz`
                      : lang === 'pt-BR'
                        ? 'Sonificar Órbita'
                        : 'Sonify Orbit'}
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {effectiveTab === 'data' && (
          <div className="space-y-3 tabular-nums">
            {/* Inline Contextual Term Help Drawer */}
            {openTermKey && INLINE_TERM_HELP[openTermKey] && (
              <div className="p-3 rounded-xl bg-sky-950/60 border border-sky-400/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-200">
                    {INLINE_TERM_HELP[openTermKey].title[lang]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenTermKey(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-slate-200">
                  {INLINE_TERM_HELP[openTermKey].text[lang]}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onOpenEncyclopediaTerm(INLINE_TERM_HELP[openTermKey].articleId)
                  }
                  className="text-[11px] font-semibold text-sky-300 hover:underline"
                >
                  {lang === 'pt-BR'
                    ? 'Ver artigo completo na Enciclopédia →'
                    : 'Read full article in Encyclopedia →'}
                </button>
              </div>
            )}

            {/* Live Instantaneous Values vs Static Parameters (Section 25) */}
            {body.id !== 'sun' && bodyState && (
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                    {lang === 'pt-BR'
                      ? 'Estado Instantâneo (Varia com o Tempo)'
                      : 'Instantaneous State (Time-Varying)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenTermKey('semi_major')}
                    className="text-[11px] text-sky-300 hover:underline flex items-center gap-0.5"
                  >
                    <Info className="w-3 h-3" />
                    <span>{lang === 'pt-BR' ? 'O que é isto?' : 'What is this?'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/70">
                    <span className="text-slate-400">
                      {lang === 'pt-BR'
                        ? 'Distância Instantânea ao Sol:'
                        : 'Instantaneous Sun Distance:'}
                    </span>
                    <span className="font-semibold text-sky-200">
                      {formatDistanceAuAndKm(
                        bodyState.sunDistanceAu,
                        bodyState.sunDistanceKm,
                        lang
                      )}
                    </span>
                  </div>

                  {body.category === 'moon' && parentBody && (
                    <div className="flex justify-between py-1 border-b border-slate-800/70">
                      <span className="text-slate-400">
                        {lang === 'pt-BR'
                          ? `Distância ao centro de ${parentBody.name[lang]}:`
                          : `Distance to ${parentBody.name[lang]} center:`}
                      </span>
                      <span className="font-semibold text-emerald-300">
                        {formatNumber(bodyState.parentDistanceKm, lang, 0)} km
                      </span>
                    </div>
                  )}

                  {bodyState.orbitalVelocityKms > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">
                        {lang === 'pt-BR'
                          ? 'Velocidade Orbital Instantânea:'
                          : 'Instantaneous Orbital Speed:'}
                      </span>
                      <span className="font-semibold text-white">
                        {formatNumber(bodyState.orbitalVelocityKms, lang, 2)} km/s
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Static Physical & Orbital Table */}
            <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/70 border border-slate-800 p-2.5">
              <div className="py-1.5 flex justify-between gap-2">
                <span className="text-slate-400">
                  {lang === 'pt-BR' ? 'Diâmetro (Definição):' : 'Diameter (Definition):'}
                </span>
                <span className="font-medium text-right text-white">
                  {formatDiameter(body.diameterKm, lang, preferences.unitSystem)}{' '}
                  <span className="text-[10px] text-slate-400">
                    ({body.diameterDefinition === 'mean_volumetric'
                      ? lang === 'pt-BR'
                        ? 'médio volumétrico'
                        : 'mean volumetric'
                      : body.dimensionsKm ?? body.diameterDefinition})
                  </span>
                </span>
              </div>

              <div className="py-1.5 flex justify-between gap-2">
                <span className="text-slate-400">
                  {lang === 'pt-BR' ? 'Massa:' : 'Mass:'}
                </span>
                <span className="font-medium text-right text-white">
                  {formatScientificMass(body.massKg, lang, preferences.unitSystem)}
                </span>
              </div>

              <div className="py-1.5 flex justify-between gap-2">
                <span className="text-slate-400">
                  {lang === 'pt-BR' ? 'Densidade Média:' : 'Bulk Density:'}
                </span>
                <span className="font-medium text-right text-white">
                  {body.densityGcm3 !== null
                    ? `${formatNumber(body.densityGcm3, lang, 3)} g/cm³`
                    : lang === 'pt-BR'
                      ? 'Não aplicável'
                      : 'Not applicable'}
                </span>
              </div>

              <div className="py-1.5 flex justify-between gap-2 items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <span>{lang === 'pt-BR' ? 'Gravidade:' : 'Gravity:'}</span>
                  {(body.subtype.en.includes('Giant') || body.id === 'sun') && (
                    <button
                      type="button"
                      onClick={() => setOpenTermKey('one_bar')}
                      className="text-sky-400 hover:text-sky-300"
                      title={body.gravityDefinition[lang]}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
                <span className="font-medium text-right text-white">
                  {body.gravityMs2 !== null
                    ? `${formatNumber(body.gravityMs2, lang, 2)} m/s²`
                    : lang === 'pt-BR'
                      ? 'Não aplicável'
                      : 'Not applicable'}
                </span>
              </div>

              <div className="py-1.5 flex justify-between gap-2 items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <span>{lang === 'pt-BR' ? 'Rotação Sideral:' : 'Sidereal Rotation:'}</span>
                  <button
                    type="button"
                    onClick={() => setOpenTermKey('sidereal')}
                    className="text-sky-400 hover:text-sky-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </span>
                <span className="font-medium text-right text-white">
                  {formatRotationHours(body.siderealRotationHours, lang)}
                </span>
              </div>

              {body.solarDayHours !== null && (
                <div className="py-1.5 flex justify-between gap-2">
                  <span className="text-slate-400">
                    {lang === 'pt-BR' ? 'Duração do Dia Solar:' : 'Solar Day Length:'}
                  </span>
                  <span className="font-medium text-right text-white">
                    {formatRotationHours(body.solarDayHours, lang)}
                  </span>
                </div>
              )}

              {body.axialTiltDeg !== null && (
                <div className="py-1.5 flex justify-between gap-2">
                  <span className="text-slate-400">
                    {lang === 'pt-BR' ? 'Inclinação Axial:' : 'Axial Tilt:'}
                  </span>
                  <span className="font-medium text-right text-white">
                    {formatNumber(body.axialTiltDeg, lang, 2)}°
                  </span>
                </div>
              )}

              {/* Do not display planetary orbital fields around itself for the Sun (Section 25) */}
              {body.id !== 'sun' && (
                <>
                  {body.category === 'moon' && body.parentDistanceKm !== null ? (
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-400">
                        {lang === 'pt-BR'
                          ? `Semieixo Maior (${parentBody?.name[lang] ?? 'Pai'}):`
                          : `Semi-Major Axis (${parentBody?.name[lang] ?? 'Parent'}):`}
                      </span>
                      <span className="font-medium text-right text-white">
                        {formatNumber(body.parentDistanceKm, lang, 0)} km
                      </span>
                    </div>
                  ) : (
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-400">
                        {lang === 'pt-BR'
                          ? 'Semieixo Maior Orbital (a):'
                          : 'Orbital Semi-Major Axis (a):'}
                      </span>
                      <span className="font-medium text-right text-white">
                        {formatDistanceAuAndKm(
                          body.semiMajorAxisAu,
                          body.semiMajorAxisAu
                            ? body.semiMajorAxisAu * 149597870.7
                            : null,
                          lang
                        )}
                      </span>
                    </div>
                  )}

                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400">
                      {lang === 'pt-BR' ? 'Período Orbital:' : 'Orbital Period:'}
                    </span>
                    <span className="font-medium text-right text-white">
                      {formatPeriodDays(body.orbitalPeriodDays, lang)}
                    </span>
                  </div>

                  {body.eccentricity !== null && (
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-400">
                        {lang === 'pt-BR' ? 'Excentricidade Orbital (e):' : 'Orbital Eccentricity (e):'}
                      </span>
                      <span className="font-medium text-right text-white">
                        {formatNumber(body.eccentricity, lang, 4)}
                      </span>
                    </div>
                  )}

                  {body.inclinationDeg !== null && (
                    <div className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-400">
                        {lang === 'pt-BR' ? 'Inclinação Orbital (I):' : 'Orbital Inclination (I):'}
                      </span>
                      <span className="font-medium text-right text-white">
                        {formatNumber(body.inclinationDeg, lang, 2)}°
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="py-1.5 flex justify-between gap-2">
                <span className="text-slate-400">
                  {lang === 'pt-BR' ? 'Temperatura de Referência:' : 'Reference Temperature:'}
                </span>
                <span className="font-medium text-right text-white">
                  {formatTemperatureK(body.meanTempK, lang)}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400">
              <strong className="text-slate-300">
                {lang === 'pt-BR' ? 'Contexto Térmico e Gravitacional: ' : 'Thermal & Gravity Context: '}
              </strong>
              {body.tempContext[lang]} — {body.gravityDefinition[lang]}.
            </div>
          </div>
        )}

        {effectiveTab === 'system' && (
          <div className="space-y-3">
            {parentBody && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'pt-BR' ? 'Corpo Central (Pai)' : 'Parent Body'}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{parentBody.name[lang]}</div>
                    <div className="text-[11px] text-slate-400">
                      {parentBody.subtype[lang]}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectBody(parentBody.id, true)}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-200 text-xs font-medium hover:bg-sky-500/30"
                  >
                    {lang === 'pt-BR' ? 'Ir para Corpo-Pai' : 'Go to Parent'}
                  </button>
                </div>
              </div>
            )}

            {body.knownMoons !== null && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">
                    {lang === 'pt-BR' ? 'Luas Exibidas em Cena:' : 'Displayed Moons in Scene:'}
                  </span>
                  <span className="font-bold text-sky-300">{body.renderedMoons}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">
                    {lang === 'pt-BR'
                      ? 'Total de Luas Confirmadas (UAI/JPL):'
                      : 'Total Confirmed Moons (IAU/JPL):'}
                  </span>
                  <span className="font-bold text-white">
                    {body.knownMoons}{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      ({body.knownMoonsRefDate})
                    </span>
                  </span>
                </div>
              </div>
            )}

            {childMoons.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {lang === 'pt-BR'
                      ? 'Satélites Selecionáveis deste Sistema'
                      : 'Selectable Satellites in This System'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => onFrameMoonsSystem(body.id)}
                    className="text-[11px] text-sky-300 hover:underline font-medium"
                  >
                    {lang === 'pt-BR' ? 'Enquadrar Grupo' : 'Frame Group'}
                  </button>
                </div>

                {childMoons.map((moon) => {
                  const mState = allStates[moon.id];
                  return (
                    <div
                      key={moon.id}
                      className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2 hover:border-sky-500/40 transition"
                    >
                      <div>
                        <div className="font-semibold text-white">{moon.name[lang]}</div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {formatNumber(
                            mState?.parentDistanceKm ?? moon.parentDistanceKm,
                            lang,
                            0
                          )}{' '}
                          km • {formatPeriodDays(moon.orbitalPeriodDays, lang)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectBody(moon.id, true)}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/40 text-xs hover:bg-sky-500/30"
                        >
                          {lang === 'pt-BR' ? 'Inspecionar' : 'Inspect'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {body.rings && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  {lang === 'pt-BR' ? 'Sistema de Anéis' : 'Ring System'}
                </div>
                <p className="text-[11px] text-slate-300">{body.rings.note[lang]}</p>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {lang === 'pt-BR' ? 'Extensão radial:' : 'Radial extent:'}{' '}
                  {formatNumber(body.rings.innerRadiusKm, lang, 0)} km –{' '}
                  {formatNumber(body.rings.outerRadiusKm, lang, 0)} km
                </div>
              </div>
            )}
          </div>
        )}

        {effectiveTab === 'sources' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-1">
              <div className="text-[11px] font-semibold text-amber-300">
                {lang === 'pt-BR'
                  ? 'Aproximação e Limites de Representação'
                  : 'Approximation & Representation Notes'}
              </div>
              <p className="text-[11px] text-slate-200">{body.uncertaintyNote[lang]}</p>
              {body.orbit && (
                <p className="text-[11px] text-slate-300 mt-1">
                  <strong>{lang === 'pt-BR' ? 'Modelo Orbital: ' : 'Orbital Model: '}</strong>
                  {body.orbit.modelNote[lang]} ({body.orbit.validStartYear}–
                  {body.orbit.validEndYear} EC).
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {lang === 'pt-BR' ? 'Manifesto de Ativo Visual' : 'Visual Asset Manifest'}
              </div>
              <div className="text-xs font-medium text-white">
                {body.assetManifest.description[lang]}
              </div>
              <div className="text-[11px] text-slate-400">
                {lang === 'pt-BR' ? 'Papel:' : 'Role:'} {body.assetManifest.role} •{' '}
                {body.assetManifest.resolution}
              </div>
              <div className="text-[11px] text-slate-400">
                {body.assetManifest.attribution}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {lang === 'pt-BR' ? 'Fontes Primárias Verificadas' : 'Verified Primary Sources'}
              </h4>
              {body.sources.map((src) => (
                <div
                  key={src.id}
                  className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sky-300">{src.title[lang]}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ref. {src.referenceDate}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">{src.institution}</div>
                  <p className="text-[11px] text-slate-400">{src.note[lang]}</p>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline pt-0.5"
                  >
                    <span>{src.url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
