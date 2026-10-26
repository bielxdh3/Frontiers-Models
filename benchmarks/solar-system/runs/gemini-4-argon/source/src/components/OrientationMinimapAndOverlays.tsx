import React, { useMemo, useState } from 'react';
import {
  ActiveTool,
  EvaluatedBodyState,
  Language,
  PersistedStoreV1,
  ReferenceFrame,
  UserPreferences,
  WorkspacePreset,
} from '../types/solarSystem';
import { CATALOG_BY_ID, CELESTIAL_CATALOG, normalizeSearchText } from '../data/celestialCatalog';
import { GUIDED_TOURS } from '../data/educationalContent';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Compass,
  Eye,
  HelpCircle,
  Keyboard,
  Layers,
  Map,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';

interface OrientationMinimapAndOverlaysProps {
  locale: Language;
  selectedBodyId: string;
  evaluatedStates: Record<string, EvaluatedBodyState>;
  cameraYawRad: number;
  referenceFrame: ReferenceFrame;
  preferences: UserPreferences;
  checklist: PersistedStoreV1['discoveryChecklist'];
  activeTool: ActiveTool;
  isCommandPaletteOpen: boolean;
  isShortcutsOpen: boolean;
  showOnboardingCard: boolean;
  onSetReferenceFrame: (frame: ReferenceFrame) => void;
  onSelectBody: (id: string) => void;
  onUpdatePreferences: (updater: (prev: UserPreferences) => UserPreferences) => void;
  onApplyWorkspacePreset: (preset: WorkspacePreset) => void;
  onResetVisualPreferences: () => void;
  onClearSavedUserData: () => void;
  onOpenTool: (tool: ActiveTool, articleId?: string) => void;
  onStartTour: (tourId: string) => void;
  onCloseCommandPalette: () => void;
  onCloseShortcuts: () => void;
  onDismissOnboarding: () => void;
  onRestartOnboarding: () => void;
}

const MAJOR_MINIMAP_BODIES = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];

export const OrientationMinimapAndOverlays: React.FC<
  OrientationMinimapAndOverlaysProps
> = ({
  locale,
  selectedBodyId,
  evaluatedStates,
  cameraYawRad,
  referenceFrame,
  preferences,
  checklist,
  activeTool,
  isCommandPaletteOpen,
  isShortcutsOpen,
  showOnboardingCard,
  onSetReferenceFrame,
  onSelectBody,
  onUpdatePreferences,
  onApplyWorkspacePreset,
  onResetVisualPreferences,
  onClearSavedUserData,
  onOpenTool,
  onStartTour,
  onCloseCommandPalette,
  onCloseShortcuts,
  onDismissOnboarding,
  onRestartOnboarding,
}) => {
  const [minimapExpanded, setMinimapExpanded] = useState(true);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [confirmClearData, setConfirmClearData] = useState(false);

  const checklistCompletedCount = useMemo(
    () => Object.values(checklist).filter(Boolean).length,
    [checklist]
  );

  // Compute compressed radial position for the 140x140 top-down SVG minimap
  const minimapPoints = useMemo(() => {
    const earthState = evaluatedStates['earth'];
    const originX =
      referenceFrame === 'earth' && earthState
        ? earthState.heliocentricPositionAu.x
        : 0;
    const originZ =
      referenceFrame === 'earth' && earthState
        ? earthState.heliocentricPositionAu.z
        : 0;

    return MAJOR_MINIMAP_BODIES.map((id) => {
      const st = evaluatedStates[id];
      const body = CATALOG_BY_ID[id];
      if (!st || !body) return null;
      const dx = st.heliocentricPositionAu.x - originX;
      const dz = st.heliocentricPositionAu.z - originZ;
      const rAu = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      // Compressed √r radial mapping up to 62px radius
      const mappedR = Math.min(62, Math.sqrt(rAu) * 9.6);
      return {
        id,
        name: body.name[locale],
        color: body.visual.primaryColor,
        cx: 72 + Math.cos(angle) * mappedR,
        cy: 72 + Math.sin(angle) * mappedR,
        orbitR: Math.min(62, Math.sqrt(body.semiMajorAxisAu ?? 0) * 9.6),
        isSelected:
          id === selectedBodyId ||
          CATALOG_BY_ID[selectedBodyId]?.parentId === id,
      };
    }).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [evaluatedStates, referenceFrame, selectedBodyId, locale]);

  // Command Palette filtered items
  const commandItems = useMemo(() => {
    const q = normalizeSearchText(cmdQuery);
    const items: Array<{
      id: string;
      category: string;
      label: string;
      sublabel: string;
      action: () => void;
    }> = [];

    for (const body of CELESTIAL_CATALOG) {
      items.push({
        id: `body_${body.id}`,
        category: locale === 'pt-BR' ? 'Corpo Celeste' : 'Celestial Body',
        label: body.name[locale],
        sublabel: `${body.semiMajorAxisAu ?? 0} UA`,
        action: () => {
          onSelectBody(body.id);
          onCloseCommandPalette();
        },
      });
    }

    for (const tour of GUIDED_TOURS) {
      items.push({
        id: `tour_${tour.id}`,
        category: locale === 'pt-BR' ? 'Tour Guiado' : 'Guided Tour',
        label: tour.title[locale],
        sublabel: tour.durationEstimate[locale],
        action: () => {
          onStartTour(tour.id);
          onCloseCommandPalette();
        },
      });
    }

    const toolEntries: Array<{ tool: ActiveTool; label: string; sub: string }> = [
      {
        tool: 'comparison',
        label: locale === 'pt-BR' ? 'Comparar Corpos Celestes' : 'Compare Celestial Bodies',
        sub: locale === 'pt-BR' ? 'Comparação lado a lado (2 a 4 corpos)' : 'Side-by-side comparison',
      },
      {
        tool: 'measurement',
        label: locale === 'pt-BR' ? 'Régua de Distância e Tempo-Luz' : 'Distance & Light-Time Ruler',
        sub: locale === 'pt-BR' ? 'Medir UA, km e pulso de luz' : 'Measure AU, km, and light pulse',
      },
      {
        tool: 'orbit_lab',
        label: locale === 'pt-BR' ? 'Laboratório de Órbita e Gravidade (Kepler)' : 'Orbit & Gravity Lab (Kepler)',
        sub: locale === 'pt-BR' ? 'Leis de Kepler e gravidade esférica' : 'Kepler laws & spherical gravity',
      },
      {
        tool: 'moon_lab',
        label: locale === 'pt-BR' ? 'Laboratório de Fases Lunares e Eclipses' : 'Moon Phases & Eclipse Lab',
        sub: locale === 'pt-BR' ? 'Fases, umbra, penumbra e inclinação de 5,145°' : 'Phases, umbra, penumbra & 5.145° tilt',
      },
      {
        tool: 'seasons_lab',
        label: locale === 'pt-BR' ? 'Laboratório das Estações e Luz Solar' : 'Seasons & Sunlight Lab',
        sub: locale === 'pt-BR' ? 'Obliquidade axial, solstícios e fotoperíodo' : 'Axial tilt, solstices & day length',
      },
      {
        tool: 'scale_lab',
        label: locale === 'pt-BR' ? 'Laboratório de Escala da Realidade' : 'Scale of Reality Lab',
        sub: locale === 'pt-BR' ? 'Por que um mapa 1:1 é quase vazio' : 'Why a true 1:1 map is mostly empty',
      },
      {
        tool: 'outer_system',
        label: locale === 'pt-BR' ? 'Jornada Além de Netuno (Logarítmica)' : 'Beyond Neptune Journey (Logarithmic)',
        sub: locale === 'pt-BR' ? 'De 1 UA à Nuvem de Oort (~100.000 UA)' : 'From 1 AU to the Oort Cloud (~100,000 AU)',
      },
      {
        tool: 'encyclopedia',
        label: locale === 'pt-BR' ? 'Sobre Este Modelo Científico (Enciclopédia)' : 'About This Scientific Model (Encyclopedia)',
        sub: locale === 'pt-BR' ? 'Fontes JPL/NASA e limites keplerianos' : 'JPL/NASA sources & Keplerian boundaries',
      },
    ];

    for (const te of toolEntries) {
      items.push({
        id: `tool_${te.tool}`,
        category: locale === 'pt-BR' ? 'Ferramenta / Laboratório' : 'Tool / Laboratory',
        label: te.label,
        sublabel: te.sub,
        action: () => {
          onOpenTool(te.tool);
          onCloseCommandPalette();
        },
      });
    }

    if (!q) return items.slice(0, 14);
    return items
      .filter((it) =>
        normalizeSearchText(`${it.label} ${it.category} ${it.sublabel}`).includes(q)
      )
      .slice(0, 16);
  }, [cmdQuery, locale, onSelectBody, onStartTour, onOpenTool, onCloseCommandPalette]);

  return (
    <>
      {/* 1. COMPACT ORIENTATION MINIMAP & REFERENCE FRAME SELECTOR (Bottom-Left beside Navigator) */}
      {activeTool !== 'photo_mode' && (
        <aside
          aria-label={
            locale === 'pt-BR'
              ? 'Minimapa de Orientação e Seletor de Referencial'
              : 'Orientation Minimap & Reference Frame Selector'
          }
          data-testid="orientation-minimap"
          className="fixed bottom-36 left-3 lg:left-78 z-20 hidden xl:flex flex-col bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-xl text-slate-200 overflow-hidden transition-all w-48"
        >
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Map className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              {locale === 'pt-BR' ? 'Mapa Orbital (√r)' : 'Orbital Map (√r)'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMinimapExpanded(!minimapExpanded)}
            aria-label={
              minimapExpanded
                ? locale === 'pt-BR'
                  ? 'Recolher minimapa'
                  : 'Collapse minimap'
                : locale === 'pt-BR'
                ? 'Expandir minimapa'
                : 'Expand minimap'
            }
            className="p-0.5 rounded hover:bg-slate-800 text-slate-400"
          >
            {minimapExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {minimapExpanded && (
          <div className="p-2.5 space-y-2">
            {/* Reference Frame Selector */}
            <select
              aria-label={locale === 'pt-BR' ? 'Referencial de observação' : 'Reference frame'}
              value={referenceFrame}
              onChange={(e) => onSetReferenceFrame(e.target.value as ReferenceFrame)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200"
            >
              <option value="sun">
                {locale === 'pt-BR'
                  ? 'Referencial: Sol (Heliocêntrico)'
                  : 'Frame: Sun (Heliocentric)'}
              </option>
              <option value="earth">
                {locale === 'pt-BR'
                  ? 'Referencial: Terra (Retrógrado Aparente)'
                  : 'Frame: Earth (Apparent Retrograde)'}
              </option>
              <option value="local_parent">
                {locale === 'pt-BR'
                  ? 'Referencial: Sistema Local'
                  : 'Frame: Local Parent System'}
              </option>
            </select>

            {/* Top-Down SVG Minimap */}
            <div className="relative flex items-center justify-center bg-slate-950/90 rounded-xl border border-slate-800/80 p-1">
              <svg
                viewBox="0 0 144 144"
                className="w-36 h-36 select-none"
                role="img"
                aria-label={
                  locale === 'pt-BR'
                    ? 'Diagrama superior comprimido das órbitas planetárias'
                    : 'Compressed top-down diagram of planetary orbits'
                }
              >
                {/* North / +Z-Ecliptic Indicator */}
                <text
                  x="72"
                  y="10"
                  textAnchor="middle"
                  className="fill-slate-500 text-[7px] font-mono"
                >
                  N (Ecl.)
                </text>

                {/* Guide Rings */}
                {referenceFrame !== 'earth' &&
                  minimapPoints.map(
                    (pt) =>
                      pt.orbitR > 2 && (
                        <circle
                          key={`ring_${pt.id}`}
                          cx="72"
                          cy="72"
                          r={pt.orbitR}
                          fill="none"
                          stroke={pt.isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.14)'}
                          strokeWidth={pt.isSelected ? 1 : 0.6}
                        />
                      )
                  )}

                {/* Apparent Retrograde Loop Schematic when in Earth Frame */}
                {referenceFrame === 'earth' && (
                  <path
                    d="M 24 96 C 46 60, 88 46, 68 74 C 52 94, 96 68, 122 36"
                    fill="none"
                    stroke="rgba(248, 113, 113, 0.65)"
                    strokeWidth="1.3"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Camera Direction Cone */}
                <g
                  transform={`translate(72, 72) rotate(${(cameraYawRad * 180) / Math.PI})`}
                >
                  <polygon
                    points="0,0 -12,-28 12,-28"
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="rgba(56, 189, 248, 0.35)"
                    strokeWidth="0.6"
                  />
                </g>

                {/* Interactive Planet Dots */}
                {minimapPoints.map((pt) => (
                  <g
                    key={pt.id}
                    onClick={() => onSelectBody(pt.id)}
                    className="cursor-pointer"
                  >
                    <title>{pt.name}</title>
                    {pt.isSelected && (
                      <circle
                        cx={pt.cx}
                        cy={pt.cy}
                        r={5.5}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={1.2}
                      />
                    )}
                    <circle
                      cx={pt.cx}
                      cy={pt.cy}
                      r={pt.id === 'sun' ? 3.5 : pt.isSelected ? 3.2 : 2.3}
                      fill={pt.color}
                    />
                  </g>
                ))}
              </svg>
            </div>

            {referenceFrame === 'earth' ? (
              <p className="text-[10px] text-amber-300 leading-snug">
                {locale === 'pt-BR'
                  ? 'No referencial terrestre, quando a Terra (mais rápida a 1 UA) ultrapassa Marte (1,52 UA), Marte aparenta recuar temporariamente contra as estrelas de fundo (laço tracejado).'
                  : 'In Earth’s frame, as faster Earth (1 AU) overtakes Mars (1.52 AU), Mars appears to loop backward temporarily against background stars (dashed loop).'}
              </p>
            ) : (
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>
                  {locale === 'pt-BR'
                    ? 'Escala radial comprimida (√UA)'
                    : 'Compressed radial scale (√AU)'}
                </span>
                <span className="text-cyan-400 font-medium">
                  {locale === 'pt-BR' ? 'Clique para focar' : 'Click to focus'}
                </span>
              </div>
            )}
          </div>
        )}
      </aside>
      )}

      {/* 2. COLLAPSIBLE 5-ITEM DISCOVERY CHECKLIST PILL (Top-Left beside Navigator) */}
      {activeTool !== 'photo_mode' && (
        <div className="fixed top-15 left-78 z-20 hidden xl:block">
        <div className="bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 rounded-xl shadow-lg text-slate-200 overflow-hidden w-60">
          <button
            type="button"
            onClick={() => setChecklistExpanded(!checklistExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-slate-900/70 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              {locale === 'pt-BR' ? 'Primeiras Descobertas' : 'First Discoveries'}
            </span>
            <span className="font-mono text-[11px] text-cyan-300">
              {checklistCompletedCount}/5
            </span>
          </button>

          {checklistExpanded && (
            <div className="px-3 pb-2.5 pt-1 border-t border-slate-800/80 space-y-1.5 text-[11px]">
              {[
                {
                  done: checklist.visitPlanet,
                  label:
                    locale === 'pt-BR'
                      ? '1. Selecionar e inspecionar um planeta'
                      : '1. Select and inspect a planet',
                },
                {
                  done: checklist.followMoon,
                  label:
                    locale === 'pt-BR'
                      ? '2. Seguir uma lua em órbita'
                      : '2. Follow an orbiting moon',
                },
                {
                  done: checklist.reverseTime,
                  label:
                    locale === 'pt-BR'
                      ? '3. Reverter ou avançar a velocidade do tempo'
                      : '3. Reverse or scrub simulation time',
                },
                {
                  done: checklist.compareBodies,
                  label:
                    locale === 'pt-BR'
                      ? '4. Comparar dois mundos lado a lado'
                      : '4. Compare two worlds side-by-side',
                },
                {
                  done: checklist.inspectScale,
                  label:
                    locale === 'pt-BR'
                      ? '5. Alternar para Escala Relativa'
                      : '5. Switch to Relative Scale',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 ${
                    item.done ? 'text-emerald-300 line-through opacity-80' : 'text-slate-300'
                  }`}
                >
                  {item.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 3. NON-BLOCKING WELCOME ONBOARDING CARD */}
      {showOnboardingCard && (
        <aside
          aria-label={
            locale === 'pt-BR'
              ? 'Boas-vindas ao Observatório do Sistema Solar'
              : 'Welcome to the Solar System Observatory'
          }
          data-testid="welcome-onboarding-card"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-md bg-slate-950/92 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl p-3.5 text-slate-100 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                {locale === 'pt-BR'
                  ? 'Observatório Interativo 3D'
                  : 'Interactive 3D Observatory'}
              </span>
              <h2 className="text-sm font-bold text-white mt-0.5">
                {locale === 'pt-BR'
                  ? 'Bem-vindo ao Sistema Solar Vivo'
                  : 'Welcome to the Living Solar System'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onDismissOnboarding}
              aria-label={locale === 'pt-BR' ? 'Dispensar boas-vindas' : 'Dismiss welcome'}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {locale === 'pt-BR'
              ? 'Arraste para orbitar a câmera, role para dar zoom e clique em qualquer planeta ou lua para inspecionar dados reais da NASA/JPL. A cena já está ativa!'
              : 'Drag to orbit the camera, scroll to zoom, and click any planet or moon to inspect real NASA/JPL data. The live scene is already running!'}
          </p>

          <div className="grid grid-cols-1 gap-1.5 pt-1">
            <button
              type="button"
              data-testid="onboarding-start-grand-tour"
              onClick={() => {
                onDismissOnboarding();
                onStartTour('grand_tour');
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              {locale === 'pt-BR' ? 'Iniciar Grand Tour Guiado' : 'Start Guided Grand Tour'}
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="onboarding-explore-freely"
                onClick={onDismissOnboarding}
                className="py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
              >
                {locale === 'pt-BR' ? 'Explorar Livremente' : 'Explore Freely'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismissOnboarding();
                  onOpenTool('encyclopedia', 'about_this_model');
                }}
                className="py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700"
              >
                {locale === 'pt-BR' ? 'Sobre o Modelo' : 'About the Model'}
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 4. COMMAND PALETTE MODAL (Ctrl+K) */}
      {isCommandPaletteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={locale === 'pt-BR' ? 'Paleta de Comandos' : 'Command Palette'}
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 p-4 bg-slate-950/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
              <Search className="w-4 h-4 text-cyan-400" />
              <input
                type="search"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder={
                  locale === 'pt-BR'
                    ? 'Digite um planeta, lua, laboratório ou tour...'
                    : 'Type a planet, moon, laboratory, or tour...'
                }
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={onCloseCommandPalette}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white text-xs"
              >
                Esc
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-900">
              {commandItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-900/90 flex items-center justify-between gap-2 transition-colors"
                >
                  <div>
                    <div className="text-xs font-bold text-white">{item.label}</div>
                    <div className="text-[11px] text-slate-400">{item.sublabel}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-cyan-300 border border-slate-800">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. KEYBOARD SHORTCUTS & HELP MODAL (?) */}
      {isShortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={locale === 'pt-BR' ? 'Atalhos de Teclado e Ajuda' : 'Keyboard Shortcuts & Help'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md"
        >
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-bold text-white">
                  {locale === 'pt-BR'
                    ? 'Atalhos de Teclado e Controles de Câmera'
                    : 'Keyboard Shortcuts & Camera Controls'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseShortcuts}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'Space / K', desc: locale === 'pt-BR' ? 'Pausar / Reproduzir tempo' : 'Play / Pause time' },
                { key: 'J / L', desc: locale === 'pt-BR' ? 'Diminuir / Aumentar velocidade' : 'Slower / Faster time' },
                { key: 'F', desc: locale === 'pt-BR' ? 'Focar corpo selecionado' : 'Focus selected body' },
                { key: 'H', desc: locale === 'pt-BR' ? 'Visão Geral do Sistema Solar' : 'Home Solar System Overview' },
                { key: 'O', desc: locale === 'pt-BR' ? 'Alternar linhas de órbita' : 'Cycle orbit lines' },
                { key: 'G', desc: locale === 'pt-BR' ? 'Alternar grade da eclíptica' : 'Toggle ecliptic grid' },
                { key: 'C', desc: locale === 'pt-BR' ? 'Abrir comparação de corpos' : 'Open body comparison' },
                { key: 'M', desc: locale === 'pt-BR' ? 'Abrir régua de medição' : 'Open distance ruler' },
                { key: 'P', desc: locale === 'pt-BR' ? 'Modo Foto e Captura' : 'Photo Mode studio' },
                { key: '[ / ]', desc: locale === 'pt-BR' ? 'Corpo anterior / seguinte' : 'Previous / Next body' },
                { key: 'Ctrl+K / /', desc: locale === 'pt-BR' ? 'Buscar comando ou corpo' : 'Command & search palette' },
                { key: 'Esc', desc: locale === 'pt-BR' ? 'Fechar modal ou sair de modo' : 'Close dialog or exit mode' },
              ].map((sc) => (
                <div
                  key={sc.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800"
                >
                  <span className="text-slate-300">{sc.desc}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-cyan-300">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onCloseShortcuts();
                  onRestartOnboarding();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {locale === 'pt-BR' ? 'Reiniciar Cartão de Boas-Vindas' : 'Restart Welcome Onboarding'}
              </button>

              <button
                type="button"
                onClick={() => {
                  onCloseShortcuts();
                  onOpenTool('encyclopedia', 'about_this_model');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700"
              >
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                {locale === 'pt-BR' ? 'Sobre Este Modelo' : 'About This Model'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SETTINGS, OVERLAYS, ACCESSIBILITY & AUDIO MODAL */}
      {activeTool === 'settings' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            locale === 'pt-BR'
              ? 'Configurações, Sobreposições Científicas e Acessibilidade'
              : 'Settings, Scientific Overlays & Accessibility'
          }
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md"
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-bold text-white">
                  {locale === 'pt-BR'
                    ? 'Configurações, Sobreposições Científicas e Acessibilidade'
                    : 'Settings, Scientific Overlays & Accessibility'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenTool('none')}
                aria-label={locale === 'pt-BR' ? 'Fechar configurações' : 'Close settings'}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
              {/* Section A: Workspace Presets & Language */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                    {locale === 'pt-BR' ? 'Idioma e Unidades' : 'Language & Units'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePreferences((p) => ({ ...p, language: 'pt-BR' }))
                      }
                      className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold border ${
                        preferences.language === 'pt-BR'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      Português (pt-BR)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePreferences((p) => ({ ...p, language: 'en' }))
                      }
                      className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold border ${
                        preferences.language === 'en'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      English (en)
                    </button>
                  </div>

                  <div className="pt-1">
                    <label className="block text-slate-400 mb-1">
                      {locale === 'pt-BR'
                        ? 'Ênfase de Unidades no Inspetor:'
                        : 'Inspector Unit Emphasis:'}
                    </label>
                    <select
                      value={preferences.unitSystem}
                      onChange={(e) =>
                        onUpdatePreferences((p) => ({
                          ...p,
                          unitSystem: e.target.value as 'metric' | 'familiar',
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200"
                    >
                      <option value="metric">
                        {locale === 'pt-BR'
                          ? 'Científico / SI (UA, km, K, m/s²)'
                          : 'Scientific / SI (AU, km, K, m/s²)'}
                      </option>
                      <option value="familiar">
                        {locale === 'pt-BR'
                          ? 'Comparativo Terrestre (Terras, °C, g)'
                          : 'Earth-Relative (Earths, °C, g)'}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                    {locale === 'pt-BR'
                      ? 'Predefinições de Espaço de Trabalho'
                      : 'Workspace Presets'}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {
                          id: 'cinematic',
                          label: locale === 'pt-BR' ? 'Cinematográfico' : 'Cinematic',
                        },
                        {
                          id: 'classroom',
                          label: locale === 'pt-BR' ? 'Sala de Aula' : 'Classroom',
                        },
                        {
                          id: 'detailed_study',
                          label: locale === 'pt-BR' ? 'Estudo Detalhado' : 'Detailed Study',
                        },
                        {
                          id: 'low_power',
                          label: locale === 'pt-BR' ? 'Baixo Consumo' : 'Low Power',
                        },
                      ] as const
                    ).map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => onApplyWorkspacePreset(wp.id)}
                        className={`py-1.5 px-2.5 rounded-lg font-semibold border text-left ${
                          preferences.workspacePreset === wp.id
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        {wp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section B: Scientific Overlays & Guides */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                  <Layers className="w-3.5 h-3.5" />
                  {locale === 'pt-BR'
                    ? 'Sobreposições Científicas e Guias na Cena 3D'
                    : '3D Scene Scientific Overlays & Guides'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    {
                      key: 'showEclipticGrid' as const,
                      label: locale === 'pt-BR' ? 'Grade do Plano da Eclíptica' : 'Ecliptic Plane Grid',
                    },
                    {
                      key: 'showPerihelionAphelion' as const,
                      label:
                        locale === 'pt-BR'
                          ? 'Marcadores de Periélio / Afélio'
                          : 'Perihelion / Aphelion Markers',
                    },
                    {
                      key: 'showVelocityVectors' as const,
                      label:
                        locale === 'pt-BR'
                          ? 'Vetores de Velocidade e Direção'
                          : 'Orbital Velocity Vectors',
                    },
                    {
                      key: 'showAxialArrows' as const,
                      label:
                        locale === 'pt-BR'
                          ? 'Eixos de Rotação (Obliquidade)'
                          : 'Axial Tilt Spin Poles',
                    },
                    {
                      key: 'showTidalLockingOverlay' as const,
                      label:
                        locale === 'pt-BR'
                          ? 'Vetor de Travamento de Maré'
                          : 'Tidal Locking Vector',
                    },
                    {
                      key: 'showTrails' as const,
                      label: locale === 'pt-BR' ? 'Trilhas de Movimento Recente' : 'Recent Motion Trails',
                    },
                    {
                      key: 'showAsteroidBelt' as const,
                      label: locale === 'pt-BR' ? 'Cinturão de Asteroides' : 'Main Asteroid Belt',
                    },
                    {
                      key: 'showKuiperBelt' as const,
                      label: locale === 'pt-BR' ? 'Cinturão de Kuiper' : 'Kuiper Belt',
                    },
                    {
                      key: 'cleanBackground' as const,
                      label:
                        locale === 'pt-BR'
                          ? 'Fundo Limpo (Ocultar Estrelas)'
                          : 'Clean Background (Hide Stars)',
                    },
                  ].map((toggle) => (
                    <label
                      key={toggle.key}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(preferences[toggle.key])}
                        onChange={(e) =>
                          onUpdatePreferences((p) => ({
                            ...p,
                            [toggle.key]: e.target.checked,
                          }))
                        }
                        className="rounded accent-cyan-400"
                      />
                      <span className="text-slate-200">{toggle.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section C: Accessibility, Legibility & Performance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                    <Eye className="w-3.5 h-3.5" />
                    {locale === 'pt-BR'
                      ? 'Acessibilidade e Legibilidade'
                      : 'Accessibility & Legibility'}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">
                      {locale === 'pt-BR' ? 'Tamanho da Interface:' : 'Interface Size:'}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePreferences((p) => ({ ...p, interfaceSize: 'normal' }))
                        }
                        className={`px-2.5 py-1 rounded border ${
                          preferences.interfaceSize === 'normal'
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800'
                        }`}
                      >
                        {locale === 'pt-BR' ? 'Normal' : 'Normal'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePreferences((p) => ({ ...p, interfaceSize: 'large' }))
                        }
                        className={`px-2.5 py-1 rounded border ${
                          preferences.interfaceSize === 'large'
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800'
                        }`}
                      >
                        {locale === 'pt-BR' ? 'Grande' : 'Large'}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">
                      {locale === 'pt-BR' ? 'Rótulos de Alto Contraste' : 'High-Contrast Labels'}
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.highContrastLabels}
                      onChange={(e) =>
                        onUpdatePreferences((p) => ({
                          ...p,
                          highContrastLabels: e.target.checked,
                        }))
                      }
                      className="rounded accent-cyan-400"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">
                      {locale === 'pt-BR'
                        ? 'Movimento Reduzido (Transições Instantâneas)'
                        : 'Reduced Motion (Instant Camera Cuts)'}
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.reducedMotion}
                      onChange={(e) =>
                        onUpdatePreferences((p) => ({
                          ...p,
                          reducedMotion: e.target.checked,
                        }))
                      }
                      className="rounded accent-cyan-400"
                    />
                  </label>
                </div>

                {/* Audio & Quality */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                    <Volume2 className="w-3.5 h-3.5" />
                    {locale === 'pt-BR'
                      ? 'Áudio Opcional e Qualidade Gráfica'
                      : 'Optional Audio & Graphics Quality'}
                  </div>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">
                      {locale === 'pt-BR'
                        ? 'Ativar Áudio Sintetizado (Desativado por padrão)'
                        : 'Enable Synthesized Audio (Off by default)'}
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.soundEnabled}
                      onChange={(e) =>
                        onUpdatePreferences((p) => ({
                          ...p,
                          soundEnabled: e.target.checked,
                          ambientAudioEnabled: e.target.checked,
                          uiSoundEnabled: e.target.checked,
                        }))
                      }
                      className="rounded accent-cyan-400"
                    />
                  </label>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">
                      {locale === 'pt-BR' ? 'Qualidade de Renderização:' : 'Render Quality:'}
                    </span>
                    <select
                      value={preferences.qualityPreset}
                      onChange={(e) =>
                        onUpdatePreferences((p) => ({
                          ...p,
                          qualityPreset: e.target.value as UserPreferences['qualityPreset'],
                        }))
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                    >
                      <option value="auto">Auto</option>
                      <option value="high">{locale === 'pt-BR' ? 'Alta' : 'High'}</option>
                      <option value="balanced">
                        {locale === 'pt-BR' ? 'Equilibrada' : 'Balanced'}
                      </option>
                      <option value="low">{locale === 'pt-BR' ? 'Baixa' : 'Low'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section D: Independent Reset Controls (Section 42.3) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onResetVisualPreferences}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold"
                >
                  {locale === 'pt-BR'
                    ? 'Redefinir Preferências Visuais'
                    : 'Reset Visual Preferences'}
                </button>

                {!confirmClearData ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearData(true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-700/50 font-semibold"
                  >
                    {locale === 'pt-BR'
                      ? 'Limpar Dados Salvos (Vistas, Diário e Progresso)'
                      : 'Clear Saved Data (Views, Journal & Progress)'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-rose-300 font-semibold">
                      {locale === 'pt-BR' ? 'Confirmar limpeza?' : 'Confirm clear?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearSavedUserData();
                        setConfirmClearData(false);
                      }}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold"
                    >
                      {locale === 'pt-BR' ? 'Sim, Limpar' : 'Yes, Clear'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearData(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300"
                    >
                      {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
