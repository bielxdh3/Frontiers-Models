import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Rewind,
  FastForward,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CelestialBodyData,
  Language,
  ScaleMode,
  TimeBookmark,
} from '../types/solarSystem';
import {
  MAX_SUPPORTED_DATE_MS,
  MIN_SUPPORTED_DATE_MS,
} from '../engine/ephemeris';
import {
  formatSimulationDateUtc,
  formatTimeRatePhrase,
} from '../utils/formatters';

interface TimeControllerBarProps {
  simTimeMs: number;
  isPlaying: boolean;
  direction: 1 | -1;
  speedMultiplier: number; // Non-negative magnitude
  withinValidity: boolean;
  boundaryReachedMessage: string | null;
  selectedBody: CelestialBodyData;
  scaleMode: ScaleMode;
  lang: Language;
  bookmarks: TimeBookmark[];
  onTogglePlay: () => void;
  onToggleDirection: () => void;
  onChangeSpeed: (newSpeed: number, autoPauseIfZero?: boolean) => void;
  onStepTimeMs: (deltaMs: number) => void;
  onJumpToDateMs: (newTimeMs: number) => void;
  onGoToNow: () => void;
  onResetSimulation: () => void;
  onAddBookmark: (title: string) => void;
  onDeleteBookmark: (id: string) => void;
  onSelectBookmark: (bm: TimeBookmark) => void;
  onToggleScaleMode: () => void;
  onOpenScaleLab: () => void;
}

const SPEED_PRESETS: Array<{ value: number; labelPt: string; labelEn: string }> = [
  { value: 1, labelPt: '1× (Real)', labelEn: '1× (Real)' },
  { value: 10, labelPt: '10×', labelEn: '10×' },
  { value: 100, labelPt: '100×', labelEn: '100×' },
  { value: 1000, labelPt: '1.000×', labelEn: '1,000×' },
  { value: 3600, labelPt: '1 h/s', labelEn: '1 hr/s' },
  { value: 86400, labelPt: '1 dia/s (86.400×)', labelEn: '1 day/s (86,400×)' },
  { value: 604800, labelPt: '1 sem/s', labelEn: '1 wk/s' },
  { value: 2592000, labelPt: '30 d/s', labelEn: '30 d/s' },
];

export const TimeControllerBar: React.FC<TimeControllerBarProps> = ({
  simTimeMs,
  isPlaying,
  direction,
  speedMultiplier,
  withinValidity,
  boundaryReachedMessage,
  selectedBody,
  scaleMode,
  lang,
  bookmarks,
  onTogglePlay,
  onToggleDirection,
  onChangeSpeed,
  onStepTimeMs,
  onJumpToDateMs,
  onGoToNow,
  onResetSimulation,
  onAddBookmark,
  onDeleteBookmark,
  onSelectBookmark,
  onToggleScaleMode,
  onOpenScaleLab,
}) => {
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);
  const [customRateInput, setCustomRateInput] = useState(String(speedMultiplier));
  const [rateError, setRateError] = useState<string | null>(null);
  const [dateInputIso, setDateInputIso] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('');
  const [timelineSpan, setTimelineSpan] = useState<'year' | 'epoch'>('year');

  const { multiplierText, phraseText } = formatTimeRatePhrase(
    speedMultiplier,
    direction,
    !isPlaying,
    lang
  );

  // Convert speedMultiplier [0, 31557600] <-> logarithmic slider [0, 100]
  const sliderVal =
    speedMultiplier <= 0
      ? 0
      : Math.min(100, Math.max(1, (Math.log10(Math.max(1, speedMultiplier)) / 7.5) * 100));

  const handleSliderChange = (val: number) => {
    setRateError(null);
    if (val <= 0.5) {
      onChangeSpeed(0, true);
      setCustomRateInput('0');
      return;
    }
    const computed = Math.round(Math.pow(10, (val / 100) * 7.5));
    onChangeSpeed(computed, false);
    setCustomRateInput(String(computed));
  };

  const handleApplyCustomRate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customRateInput.trim().replace(',', '.');
    const parsed = Number(cleaned);
    if (!cleaned || !Number.isFinite(parsed)) {
      setRateError(
        lang === 'pt-BR'
          ? 'Insira um número finito válido (ex.: 86400 ou -3600).'
          : 'Enter a valid finite number (e.g., 86400 or -3600).'
      );
      return;
    }
    const maxRate = 31557600 * 5; // Max 5 Julian years per second
    if (Math.abs(parsed) > maxRate) {
      setRateError(
        lang === 'pt-BR'
          ? 'Taxa máxima suportada: ±157.788.000× (5 anos julianos/s).'
          : 'Maximum supported rate: ±157,788,000× (5 Julian yrs/s).'
      );
      return;
    }
    setRateError(null);
    if (parsed === 0) {
      onChangeSpeed(0, true);
      return;
    }
    if ((parsed < 0 && direction > 0) || (parsed > 0 && direction < 0)) {
      onToggleDirection();
    }
    onChangeSpeed(Math.abs(parsed), false);
  };

  const handleApplyDateInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateInputIso.trim()) {
      setDateError(
        lang === 'pt-BR'
          ? 'Escolha uma data entre 1800-01-01 e 2050-12-31 UTC.'
          : 'Select a date between 1800-01-01 and 2050-12-31 UTC.'
      );
      return;
    }
    const parsedMs = Date.parse(
      dateInputIso.includes('T') ? `${dateInputIso}Z` : `${dateInputIso}T12:00:00Z`
    );
    if (!Number.isFinite(parsedMs)) {
      setDateError(
        lang === 'pt-BR' ? 'Data inválida.' : 'Invalid date format.'
      );
      return;
    }
    if (parsedMs < MIN_SUPPORTED_DATE_MS || parsedMs > MAX_SUPPORTED_DATE_MS) {
      setDateError(
        lang === 'pt-BR'
          ? 'Fora do intervalo efeméride JPL (1800–2050 EC).'
          : 'Outside supported JPL ephemeris range (1800–2050 CE).'
      );
      return;
    }
    setDateError(null);
    onJumpToDateMs(parsedMs);
  };

  return (
    <section
      aria-label={lang === 'pt-BR' ? 'Controle de Tempo e Escala' : 'Time & Scale Controller'}
      className="w-full max-w-5xl mx-auto px-2 sm:px-4 pointer-events-auto"
      data-ui-overlay="true"
    >
      {/* Validity / Boundary Alert */}
      {(boundaryReachedMessage || !withinValidity) && (
        <div
          role="status"
          className="mb-2 px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-400/60 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {boundaryReachedMessage ??
                (lang === 'pt-BR'
                  ? 'Limite do intervalo nominal JPL (1800–2050 EC) atingido.'
                  : 'JPL nominal validity boundary (1800–2050 CE) reached.')}
            </span>
          </div>
          <button
            type="button"
            onClick={onResetSimulation}
            className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-semibold text-[11px]"
          >
            {lang === 'pt-BR' ? 'Restaurar Época' : 'Restore Epoch'}
          </button>
        </div>
      )}

      {/* Expandable Advanced Time, Calendar & Scrubber Drawer */}
      {showAdvancedDrawer && (
        <div className="mb-2 p-3.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="font-semibold text-sky-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>
                {lang === 'pt-BR'
                  ? 'Calendário Científico UTC, Passos Únicos e Velocidade Precisa'
                  : 'UTC Scientific Calendar, Single-Step & Precise Rate'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Intervalo válido JPL Tabela 1: 01/01/1800 a 31/12/2050 UTC'
                : 'Supported JPL Table 1 interval: 1800-01-01 to 2050-12-31 UTC'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Logarithmic Slider + Custom Numeric Rate Input */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-300">
                {lang === 'pt-BR'
                  ? 'Controle Logarítmico e Taxa Personalizada (s/s)'
                  : 'Logarithmic Slider & Custom Rate (s/s)'}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={sliderVal}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                aria-label={
                  lang === 'pt-BR' ? 'Velocidade logarítmica' : 'Logarithmic speed slider'
                }
                className="w-full accent-sky-400"
              />
              <form onSubmit={handleApplyCustomRate} className="flex gap-1.5">
                <input
                  type="text"
                  value={customRateInput}
                  onChange={(e) => setCustomRateInput(e.target.value)}
                  placeholder="86400"
                  aria-label={
                    lang === 'pt-BR'
                      ? 'Multiplicador de tempo personalizado'
                      : 'Custom time multiplier'
                  }
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white tabular-nums text-xs"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400"
                >
                  {lang === 'pt-BR' ? 'Aplicar' : 'Apply'}
                </button>
              </form>
              {rateError && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {rateError}
                </p>
              )}
            </div>

            {/* Single-Step Controls */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                {lang === 'pt-BR'
                  ? 'Avanço de Passo Único (Pausa após avançar)'
                  : 'Single-Step Advance (Pauses after step)'}
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: '−7d', ms: -7 * 86400000 },
                  { label: '−1d', ms: -86400000 },
                  { label: '−1h', ms: -3600000 },
                  { label: '+1m', ms: 60000 },
                  { label: '+1h', ms: 3600000 },
                  { label: '+1d', ms: 86400000 },
                  { label: '+7d', ms: 7 * 86400000 },
                  { label: '+30d', ms: 30 * 86400000 },
                ].map((st) => (
                  <button
                    key={st.label}
                    type="button"
                    onClick={() => onStepTimeMs(st.ms)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-sky-500/25 border border-slate-700 text-slate-200 text-[11px] font-medium tabular-nums"
                  >
                    {st.label}
                  </button>
                ))}
                {selectedBody.orbitalPeriodDays && (
                  <button
                    type="button"
                    onClick={() =>
                      onStepTimeMs(selectedBody.orbitalPeriodDays! * 86400000)
                    }
                    className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-[11px] font-medium"
                  >
                    {lang === 'pt-BR'
                      ? `+1 Órbita de ${selectedBody.name[lang]}`
                      : `+1 ${selectedBody.name[lang]} Orbit`}
                  </button>
                )}
              </div>
            </div>

            {/* Direct Date Editor & Timeline Scrubber */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300">
                  {lang === 'pt-BR' ? 'Ir para Data (UTC):' : 'Jump to Date (UTC):'}
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setTimelineSpan(timelineSpan === 'year' ? 'epoch' : 'year')
                    }
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700"
                  >
                    {timelineSpan === 'year'
                      ? lang === 'pt-BR'
                        ? 'Zoom: ±1 Ano'
                        : 'Span: ±1 Yr'
                      : '1800–2050'}
                  </button>
                </div>
              </div>
              <form onSubmit={handleApplyDateInput} className="flex gap-1.5">
                <input
                  type="date"
                  min="1800-01-01"
                  max="2050-12-31"
                  value={
                    dateInputIso ||
                    new Date(simTimeMs).toISOString().slice(0, 10)
                  }
                  onChange={(e) => setDateInputIso(e.target.value)}
                  aria-label={lang === 'pt-BR' ? 'Data UTC' : 'UTC Date'}
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400"
                >
                  {lang === 'pt-BR' ? 'Ir' : 'Go'}
                </button>
              </form>
              {dateError && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {dateError}
                </p>
              )}

              {/* Timeline Scrubber */}
              <div>
                <input
                  type="range"
                  min={
                    timelineSpan === 'epoch'
                      ? MIN_SUPPORTED_DATE_MS
                      : Math.max(MIN_SUPPORTED_DATE_MS, simTimeMs - 365.25 * 86400000)
                  }
                  max={
                    timelineSpan === 'epoch'
                      ? MAX_SUPPORTED_DATE_MS
                      : Math.min(MAX_SUPPORTED_DATE_MS, simTimeMs + 365.25 * 86400000)
                  }
                  step={86400000}
                  value={simTimeMs}
                  onChange={(e) => onJumpToDateMs(Number(e.target.value))}
                  aria-label={
                    lang === 'pt-BR'
                      ? 'Linha do tempo da simulação'
                      : 'Simulation timeline scrubber'
                  }
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks & Historical/Model Events Drawer (Section 27) */}
      {showBookmarksDrawer && (
        <div className="mb-2 p-3.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Bookmark className="w-4 h-4" />
              <span>
                {lang === 'pt-BR'
                  ? 'Marcadores de Tempo e Eventos Educativos'
                  : 'Time Bookmarks & Educational Events'}
              </span>
            </span>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const title =
                  newBookmarkTitle.trim() ||
                  `${selectedBody.name[lang]} (${new Date(simTimeMs)
                    .toISOString()
                    .slice(0, 10)})`;
                onAddBookmark(title);
                setNewBookmarkTitle('');
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={newBookmarkTitle}
                onChange={(e) => setNewBookmarkTitle(e.target.value)}
                placeholder={
                  lang === 'pt-BR'
                    ? 'Nome do marcador atual...'
                    : 'Bookmark current instant...'
                }
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300"
              >
                {lang === 'pt-BR' ? '+ Salvar Instante' : '+ Bookmark Instant'}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
            {bookmarks.map((bm) => {
              const badgeColor =
                bm.category === 'historical_event'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : bm.category === 'model_approximate'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                    : bm.category === 'schematic_alignment'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/40';
              const badgeLabel =
                bm.category === 'historical_event'
                  ? lang === 'pt-BR'
                    ? 'Evento Histórico Real'
                    : 'Historical Sourced Event'
                  : bm.category === 'model_approximate'
                    ? lang === 'pt-BR'
                      ? 'Evento Aproximado do Modelo'
                      : 'Model Approximate Event'
                    : bm.category === 'schematic_alignment'
                      ? lang === 'pt-BR'
                        ? 'Demonstração Esquemática'
                        : 'Schematic Demonstration'
                      : lang === 'pt-BR'
                        ? 'Marcador do Usuário'
                        : 'User Bookmark';

              return (
                <div
                  key={bm.id}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-1.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}
                      >
                        {badgeLabel}
                      </span>
                      {bm.category === 'user' && (
                        <button
                          type="button"
                          onClick={() => onDeleteBookmark(bm.id)}
                          aria-label={
                            lang === 'pt-BR' ? 'Excluir marcador' : 'Delete bookmark'
                          }
                          className="text-slate-400 hover:text-rose-400 text-[11px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="font-semibold text-white mt-1">{bm.title}</div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {formatSimulationDateUtc(bm.simTimeMs, lang)}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                      {bm.description[lang]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectBookmark(bm)}
                    className="w-full py-1 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 font-semibold text-sky-300 transition text-[11px]"
                  >
                    {lang === 'pt-BR' ? 'Visitar Instante' : 'Visit Instant'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Compact Bottom Bar */}
      <div className="px-3 py-2 rounded-2xl bg-slate-950/90 border border-slate-700/80 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Playback, Direction & Date */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleDirection}
            aria-label={
              lang === 'pt-BR' ? 'Inverter direção do tempo' : 'Reverse time direction'
            }
            aria-pressed={direction < 0}
            title={
              lang === 'pt-BR'
                ? 'Inverter direção (preserva estado pausado)'
                : 'Reverse direction (preserves paused state)'
            }
            className={`p-2 rounded-xl border transition ${
              direction < 0
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={
              isPlaying
                ? lang === 'pt-BR'
                  ? 'Pausar simulação (Espaço)'
                  : 'Pause simulation (Space)'
                : lang === 'pt-BR'
                  ? 'Retomar simulação (Espaço)'
                  : 'Play simulation (Space)'
            }
            className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition shadow-md"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => onStepTimeMs(86400000 * direction)}
            title={
              lang === 'pt-BR'
                ? 'Avançar 1 dia (passo único)'
                : 'Step 1 day (single step)'
            }
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
          >
            <FastForward className="w-4 h-4" />
          </button>

          {/* Current Simulation Date & Effective Rate Readout */}
          <div className="pl-1.5 pr-2 border-l border-slate-800">
            <div className="font-mono font-semibold text-white text-xs sm:text-sm tabular-nums">
              {formatSimulationDateUtc(simTimeMs, lang)}
            </div>
            <div className="text-[11px] text-sky-300 tabular-nums flex items-center gap-1.5">
              <span className="font-bold">{multiplierText}</span>
              <span className="text-slate-400">•</span>
              <span>{phraseText}</span>
            </div>
          </div>
        </div>

        {/* Center: Speed Presets */}
        <div className="hidden xl:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {SPEED_PRESETS.map((preset) => {
            const active = Math.abs(speedMultiplier - preset.value) < 0.5;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChangeSpeed(preset.value, false);
                  setCustomRateInput(String(preset.value));
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium tabular-nums transition ${
                  active
                    ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'pt-BR' ? preset.labelPt : preset.labelEn}
              </button>
            );
          })}
        </div>

        {/* Right: Scale Badge, Now, Reset Simulation, Drawers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Scale Badge with Immediate Route to Explanation (Section 19) */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700/80 p-0.5">
            <button
              type="button"
              onClick={onToggleScaleMode}
              title={
                scaleMode === 'exploration'
                  ? lang === 'pt-BR'
                    ? 'Escala de Exploração ativa (raios e distâncias ajustados para leitura). Clique para alternar para Escala Relativa.'
                    : 'Exploration Scale active (adjusted radii & distances). Click to switch to Relative Scale.'
                  : lang === 'pt-BR'
                    ? 'Escala Relativa ativa (distâncias lineares em UA e proporções reais de diâmetro planetário). Clique para alternar.'
                    : 'Relative Scale active (linear AU distances & real planetary diameter ratios). Click to toggle.'
              }
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                scaleMode === 'relative'
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                  : 'bg-sky-500/20 text-sky-200'
              }`}
            >
              {scaleMode === 'exploration'
                ? lang === 'pt-BR'
                  ? 'Escala: Exploração'
                  : 'Scale: Exploration'
                : lang === 'pt-BR'
                  ? 'Escala: Relativa (UA)'
                  : 'Scale: Relative (AU)'}
            </button>
            <button
              type="button"
              onClick={onOpenScaleLab}
              className="px-2 py-1 text-[10px] text-slate-300 hover:text-sky-300 font-medium"
              title={
                lang === 'pt-BR'
                  ? 'Abrir Laboratório de Escala e detalhes das proporções'
                  : 'Open Scale Laboratory and ratio details'
              }
            >
              {lang === 'pt-BR' ? 'Lab' : 'Lab'}
            </button>
          </div>

          <button
            type="button"
            onClick={onGoToNow}
            title={
              lang === 'pt-BR'
                ? 'Mover relógio da simulação para a data e hora atuais (UTC)'
                : 'Move simulation clock to current real-world UTC date and time'
            }
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 font-semibold text-[11px] transition"
          >
            {lang === 'pt-BR' ? 'Agora' : 'Now'}
          </button>

          <button
            type="button"
            onClick={onResetSimulation}
            title={
              lang === 'pt-BR'
                ? 'Redefinir Simulação: retorna à época inicial da sessão (20/03/2025 12:00 UTC) e velocidade padrão (não altera a câmera)'
                : 'Reset Simulation: returns to session-start epoch (2025-03-20 12:00 UTC) and default rate (does not reset camera)'
            }
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            aria-label={lang === 'pt-BR' ? 'Redefinir Simulação' : 'Reset Simulation'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBookmarksDrawer((v) => !v);
              setShowAdvancedDrawer(false);
            }}
            aria-expanded={showBookmarksDrawer}
            title={
              lang === 'pt-BR'
                ? 'Marcadores de Tempo e Eventos'
                : 'Time Bookmarks & Events'
            }
            className={`p-1.5 rounded-xl border transition ${
              showBookmarksDrawer
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAdvancedDrawer((v) => !v);
              setShowBookmarksDrawer(false);
            }}
            aria-expanded={showAdvancedDrawer}
            title={
              lang === 'pt-BR'
                ? 'Controle Avançado de Velocidade, Passo Único e Calendário UTC'
                : 'Advanced Speed Slider, Single-Step & UTC Calendar'
            }
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition ${
              showAdvancedDrawer
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {lang === 'pt-BR' ? 'Tempo+' : 'Time+'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
