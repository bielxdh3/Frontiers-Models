import React, { useState } from 'react';
import {
  Scale,
  Ruler,
  ArrowLeftRight,
  Plus,
  Trash2,
  Download,
  Zap,
  Lock,
  Unlock,
  Copy,
  Check,
  X,
} from 'lucide-react';
import {
  CelestialBodyData,
  EvaluatedBodyState,
  Language,
  MeasurementRecord,
  UserPreferences,
} from '../types/solarSystem';
import {
  CATALOG_BY_ID,
  CELESTIAL_CATALOG,
  CURATED_COMPARISON_PAIRS,
} from '../data/celestialCatalog';
import { calculatePhysicalMeasurement } from '../engine/ephemeris';
import {
  formatDiameter,
  formatDistanceAuAndKm,
  formatLightTime,
  formatNumber,
  formatPeriodDays,
  formatRotationHours,
  formatScientificMass,
  formatSimulationDateUtc,
  formatTemperatureK,
} from '../utils/formatters';

interface ComparisonWorkspaceProps {
  comparedIds: string[];
  preferences: UserPreferences;
  onChangeComparedIds: (ids: string[]) => void;
  onClose: () => void;
}

export const ComparisonWorkspace: React.FC<ComparisonWorkspaceProps> = ({
  comparedIds,
  preferences,
  onChangeComparedIds,
  onClose,
}) => {
  const lang = preferences.language;
  const [referenceId, setReferenceId] = useState<string>('earth');
  const [visualScaleMode, setVisualScaleMode] = useState<'linear' | 'log_labeled'>('linear');
  const [syncRotationPreview, setSyncRotationPreview] = useState<boolean>(false);
  const [addBodyId, setAddBodyId] = useState<string>('jupiter');
  const [copiedExport, setCopiedExport] = useState<boolean>(false);

  const bodies = comparedIds
    .map((id) => CATALOG_BY_ID[id])
    .filter((b): b is CelestialBodyData => Boolean(b));
  const refBody = CATALOG_BY_ID[referenceId] ?? CATALOG_BY_ID.earth;

  const maxDiameterKm = Math.max(
    1,
    ...bodies.map((b) =>
      b.diameterDefinition === 'region_extent' ? 1 : b.diameterKm
    )
  );

  const handleAddBody = () => {
    if (comparedIds.length >= 4 || comparedIds.includes(addBodyId)) return;
    onChangeComparedIds([...comparedIds, addBodyId]);
  };

  const handleRemoveBody = (id: string) => {
    if (comparedIds.length <= 2) return;
    onChangeComparedIds(comparedIds.filter((item) => item !== id));
  };

  const handleSwapOrder = (idxA: number, idxB: number) => {
    const next = [...comparedIds];
    const tmp = next[idxA];
    next[idxA] = next[idxB];
    next[idxB] = tmp;
    onChangeComparedIds(next);
  };

  const handleExportComparison = () => {
    const headers = [
      lang === 'pt-BR' ? 'Propriedade (Unidade)' : 'Property (Unit)',
      ...bodies.map((b) => b.name[lang]),
    ];
    const rows = [
      [
        lang === 'pt-BR' ? 'Categoria' : 'Category',
        ...bodies.map((b) => b.subtype[lang]),
      ],
      [
        lang === 'pt-BR'
          ? 'Diâmetro Volumétrico Médio (km)'
          : 'Mean Volumetric Diameter (km)',
        ...bodies.map((b) => String(b.diameterKm)),
      ],
      [
        lang === 'pt-BR'
          ? `Razão de Diâmetro (ref: ${refBody.name[lang]})`
          : `Diameter Ratio (ref: ${refBody.name[lang]})`,
        ...bodies.map((b) => (b.diameterKm / refBody.diameterKm).toFixed(4)),
      ],
      [
        lang === 'pt-BR' ? 'Massa (kg)' : 'Mass (kg)',
        ...bodies.map((b) => (b.massKg ? b.massKg.toExponential(4) : 'N/A')),
      ],
      [
        lang === 'pt-BR' ? 'Gravidade de Referência (m/s²)' : 'Reference Gravity (m/s²)',
        ...bodies.map((b) => (b.gravityMs2 !== null ? String(b.gravityMs2) : 'N/A')),
      ],
      [
        lang === 'pt-BR' ? 'Temperatura Absoluta Média (K)' : 'Mean Absolute Temp (K)',
        ...bodies.map((b) => (b.meanTempK !== null ? `${b.meanTempK} K` : 'N/A')),
      ],
      [
        lang === 'pt-BR' ? 'Nota de Aproximação' : 'Approximation Note',
        ...bodies.map((b) => b.approximationBadge[lang]),
      ],
    ];

    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar-system-comparison-${bodies.map((b) => b.id).join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={
        lang === 'pt-BR'
          ? 'Espaço de Trabalho de Comparação Planetária'
          : 'Planetary Comparison Workspace'
      }
      data-ui-overlay="true"
      className="w-full max-w-5xl mx-auto rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden flex flex-col max-h-[82vh]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              {lang === 'pt-BR'
                ? 'Comparação Científica de Mundos (2 a 4 Corpos)'
                : 'Scientific World Comparison (2 to 4 Bodies)'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Proporções lineares reais de diâmetro, razões físicas e referências explícitas.'
                : 'True linear diameter proportions, physical ratios, and explicit reference levels.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportComparison}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 transition"
          >
            {copiedExport ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{lang === 'pt-BR' ? 'Exportar CSV' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'pt-BR' ? 'Fechar comparação e voltar à cena' : 'Close comparison and return to scene'}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition"
          >
            <X className="w-4 h-4" />
            <span>{lang === 'pt-BR' ? 'Voltar à Cena' : 'Return to Scene'}</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Curated Pairs, Add Body, Reference Selector */}
      <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Curated Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400">
            {lang === 'pt-BR' ? 'Pares Curados:' : 'Curated Pairs:'}
          </span>
          {CURATED_COMPARISON_PAIRS.map((pair) => (
            <button
              key={pair.id}
              type="button"
              onClick={() => onChangeComparedIds(pair.bodyIds)}
              className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400/50 text-[11px] text-slate-200 transition"
            >
              {pair.label[lang]}
            </button>
          ))}
        </div>

        {/* Reference Body & Add Body */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-[11px] text-slate-300">
            <span>{lang === 'pt-BR' ? 'Referência (1,0×):' : 'Reference (1.0×):'}</span>
            <select
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-sky-300 font-semibold"
            >
              <option value="earth">{lang === 'pt-BR' ? 'Terra (1⊕)' : 'Earth (1⊕)'}</option>
              <option value="moon">{lang === 'pt-BR' ? 'Lua' : 'Moon'}</option>
              <option value="jupiter">{lang === 'pt-BR' ? 'Júpiter' : 'Jupiter'}</option>
              <option value="sun">{lang === 'pt-BR' ? 'Sol (1☉)' : 'Sun (1☉)'}</option>
            </select>
          </label>

          {comparedIds.length < 4 && (
            <div className="flex items-center gap-1">
              <select
                value={addBodyId}
                onChange={(e) => setAddBodyId(e.target.value)}
                aria-label={lang === 'pt-BR' ? 'Selecionar corpo para adicionar' : 'Select body to add'}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              >
                {CELESTIAL_CATALOG.filter((b) => b.simulationTier === 'simulated').map(
                  (b) => (
                    <option key={b.id} value={b.id}>
                      {b.name[lang]}
                    </option>
                  )
                )}
              </select>
              <button
                type="button"
                onClick={handleAddBody}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-200 font-semibold hover:bg-sky-500/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'pt-BR' ? 'Adicionar' : 'Add'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Workspace Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Visual Diameter Stage (Linear vs Labeled Logarithmic) */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                {visualScaleMode === 'linear'
                  ? lang === 'pt-BR'
                    ? 'Comparação Visual de Diâmetro — Escala Linear Real (1:1)'
                    : 'Visual Diameter Comparison — True Linear Scale (1:1)'
                  : lang === 'pt-BR'
                    ? 'Comparação Visual — Escala Logarítmica Rotulada (log₁₀ km)'
                    : 'Visual Comparison — Labeled Logarithmic Scale (log₁₀ km)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {visualScaleMode === 'linear'
                  ? lang === 'pt-BR'
                    ? 'O raio de cada disco é diretamente proporcional ao diâmetro físico real em quilômetros.'
                    : 'Each disk’s radius is directly proportional to its true physical diameter in kilometers.'
                  : lang === 'pt-BR'
                    ? 'ATENÇÃO: Modo logarítmico ativo para leitura de extremos. Clique em "Proporção Linear Real" para ver o tamanho verdadeiro.'
                    : 'NOTE: Logarithmic mode active for extreme ranges. Click "True Linear Proportions" for true scale.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisualScaleMode(visualScaleMode === 'linear' ? 'log_labeled' : 'linear')
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  visualScaleMode === 'linear'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-amber-500/20 border-amber-400 text-amber-200'
                }`}
              >
                {visualScaleMode === 'linear'
                  ? lang === 'pt-BR'
                    ? 'Alternar para Logarítmica (Extremos)'
                    : 'Switch to Logarithmic (Extremes)'
                  : lang === 'pt-BR'
                    ? 'Voltar à Proporção Linear Real (1:1)'
                    : 'Return to True Linear Proportions (1:1)'}
              </button>

              <button
                type="button"
                onClick={() => setSyncRotationPreview((v) => !v)}
                aria-pressed={syncRotationPreview}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300"
              >
                {syncRotationPreview
                  ? lang === 'pt-BR'
                    ? 'Rotação: Sincronizada (Apresentação)'
                    : 'Spin: Synchronized (Presentation)'
                  : lang === 'pt-BR'
                    ? 'Rotação: Taxas Científicas Relativas'
                    : 'Spin: Relative Scientific Rates'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end justify-items-center py-4 min-h-[160px] bg-slate-950/60 rounded-xl border border-slate-800/70 px-3">
            {bodies.map((body, idx) => {
              const ratioToMax = Math.max(0.002, body.diameterKm / maxDiameterKm);
              const diameterPx =
                visualScaleMode === 'linear'
                  ? Math.max(4, Math.round(ratioToMax * 116))
                  : Math.max(
                      16,
                      Math.round((Math.log10(Math.max(10, body.diameterKm)) / 6.2) * 116)
                    );
              const ratioToRef = body.diameterKm / refBody.diameterKm;

              return (
                <div
                  key={body.id}
                  className="flex flex-col items-center text-center gap-2 w-full"
                >
                  <div className="h-32 flex items-center justify-center">
                    <div
                      style={{
                        width: `${diameterPx}px`,
                        height: `${diameterPx}px`,
                        background: `radial-gradient(circle at 32% 32%, ${body.visual.accentColor}, ${body.visual.primaryColor} 65%, ${body.visual.secondaryColor})`,
                      }}
                      className="rounded-full border border-white/30 shadow-lg transition-all duration-300"
                      title={`${body.name[lang]}: ${formatDiameter(body.diameterKm, lang, 'metric')}`}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center justify-center gap-1">
                      <span>{body.name[lang]}</span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSwapOrder(idx - 1, idx)}
                          title={lang === 'pt-BR' ? 'Trocar ordem' : 'Swap order'}
                          className="text-slate-400 hover:text-sky-300"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                        </button>
                      )}
                      {bodies.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBody(body.id)}
                          title={lang === 'pt-BR' ? 'Remover da comparação' : 'Remove from comparison'}
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-sky-300 tabular-nums">
                      {formatNumber(ratioToRef, lang, ratioToRef < 0.1 ? 3 : 2)}×{' '}
                      {refBody.name[lang]}
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {formatNumber(body.diameterKm, lang, 1)} km
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aligned Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80">
                <th className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950/95 z-10">
                  {lang === 'pt-BR' ? 'Grandeza Física / Unidade' : 'Physical Quantity / Unit'}
                </th>
                {bodies.map((b) => (
                  <th key={b.id} className="p-3 font-bold text-white min-w-[160px]">
                    <div>{b.name[lang]}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {b.subtype[lang]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  {lang === 'pt-BR'
                    ? 'Diâmetro Volumétrico Médio (km)'
                    : 'Mean Volumetric Diameter (km)'}
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white font-semibold">
                    <div>{formatDiameter(b.diameterKm, lang, preferences.unitSystem)}</div>
                    <div className="text-[10px] text-sky-300">
                      {formatNumber(b.diameterKm / refBody.diameterKm, lang, 3)}×{' '}
                      {refBody.name[lang]}
                    </div>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  {lang === 'pt-BR' ? 'Massa (kg e razão)' : 'Mass (kg & ratio)'}
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white">
                    <div>{formatScientificMass(b.massKg, lang, preferences.unitSystem)}</div>
                    {b.massKg && refBody.massKg && (
                      <div className="text-[10px] text-sky-300">
                        {b.massKg / refBody.massKg >= 0.001
                          ? formatNumber(b.massKg / refBody.massKg, lang, 3)
                          : (b.massKg / refBody.massKg).toExponential(2)}
                        × {refBody.name[lang]}
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  {lang === 'pt-BR'
                    ? 'Gravidade de Referência (m/s²)'
                    : 'Reference Gravity (m/s²)'}
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white">
                    <div>
                      {b.gravityMs2 !== null
                        ? `${formatNumber(b.gravityMs2, lang, 2)} m/s²`
                        : lang === 'pt-BR'
                          ? 'Não aplicável'
                          : 'Not applicable'}
                    </div>
                    {b.gravityMs2 !== null && refBody.gravityMs2 !== null && (
                      <div className="text-[10px] text-slate-400">
                        {formatNumber(b.gravityMs2 / refBody.gravityMs2, lang, 2)}×{' '}
                        {refBody.name[lang]} ({b.gravityDefinition[lang]})
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  {lang === 'pt-BR' ? 'Densidade Média (g/cm³)' : 'Bulk Density (g/cm³)'}
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white">
                    {b.densityGcm3 !== null
                      ? `${formatNumber(b.densityGcm3, lang, 3)} g/cm³`
                      : lang === 'pt-BR'
                        ? 'Não aplicável'
                        : 'Not applicable'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  {lang === 'pt-BR'
                    ? 'Rotação Sideral vs. Dia Solar'
                    : 'Sidereal Spin vs. Solar Day'}
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white">
                    <div>
                      <span className="text-slate-400">Sideral: </span>
                      {formatRotationHours(b.siderealRotationHours, lang)}
                    </div>
                    <div>
                      <span className="text-slate-400">Solar: </span>
                      {formatRotationHours(b.solarDayHours, lang)}
                    </div>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  {lang === 'pt-BR'
                    ? 'Período Orbital e Distância Média'
                    : 'Orbital Period & Mean Distance'}
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white">
                    {b.id === 'sun' ? (
                      <span className="text-slate-400">
                        {lang === 'pt-BR'
                          ? 'Não aplicável (Estrela Central)'
                          : 'Not applicable (Central Star)'}
                      </span>
                    ) : (
                      <>
                        <div>{formatPeriodDays(b.orbitalPeriodDays, lang)}</div>
                        <div className="text-[10px] text-slate-400">
                          {b.category === 'moon' && b.parentDistanceKm
                            ? `${formatNumber(b.parentDistanceKm, lang, 0)} km (ao corpo-pai)`
                            : formatDistanceAuAndKm(b.semiMajorAxisAu, null, lang)}
                        </div>
                      </>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900/95">
                  <div>
                    {lang === 'pt-BR'
                      ? 'Temperatura Absoluta (Kelvin)'
                      : 'Absolute Temperature (Kelvin)'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {lang === 'pt-BR'
                      ? 'Razões calculadas exclusivamente na escala termodinâmica absoluta (K)'
                      : 'Ratios computed strictly on absolute thermodynamic scale (K)'}
                  </div>
                </td>
                {bodies.map((b) => (
                  <td key={b.id} className="p-3 text-white">
                    <div>{formatTemperatureK(b.meanTempK, lang)}</div>
                    {b.meanTempK && refBody.meanTempK && (
                      <div className="text-[10px] text-amber-300">
                        {formatNumber(b.meanTempK / refBody.meanTempK, lang, 2)}×{' '}
                        {refBody.name[lang]} (em Kelvin)
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface MeasurementToolPanelProps {
  fromId: string;
  toId: string;
  observerId: string;
  simTimeMs: number;
  bodyStates: Record<string, EvaluatedBodyState>;
  preferences: UserPreferences;
  history: MeasurementRecord[];
  isFrozen: boolean;
  frozenRecord: MeasurementRecord | null;
  pulseProgress: number | null;
  onChangeEndpoints: (fromId: string, toId: string, observerId: string) => void;
  onToggleFrozen: () => void;
  onSaveToHistory: () => void;
  onTriggerLightPulse: () => void;
  onClose: () => void;
}

export const MeasurementToolPanel: React.FC<MeasurementToolPanelProps> = ({
  fromId,
  toId,
  observerId,
  simTimeMs,
  bodyStates,
  preferences,
  history,
  isFrozen,
  frozenRecord,
  pulseProgress,
  onChangeEndpoints,
  onToggleFrozen,
  onSaveToHistory,
  onTriggerLightPulse,
  onClose,
}) => {
  const lang = preferences.language;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const liveResult = calculatePhysicalMeasurement(fromId, toId, bodyStates, observerId);
  const activeDisplay =
    isFrozen && frozenRecord
      ? {
          centerDistanceKm: frozenRecord.centerDistanceKm,
          surfaceDistanceKm: frozenRecord.surfaceDistanceKm,
          distanceAu: frozenRecord.distanceAu,
          lightTimeSeconds: frozenRecord.lightTimeSeconds,
          angularSeparationDeg: frozenRecord.angularSeparationDeg,
          valid: true,
        }
      : liveResult;

  const fromBody = CATALOG_BY_ID[fromId];
  const toBody = CATALOG_BY_ID[toId];
  const obsBody = CATALOG_BY_ID[observerId];

  const handleCopySummary = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div
      role="dialog"
      aria-label={
        lang === 'pt-BR'
          ? 'Régua de Distância Física e Demonstração de Tempo-Luz'
          : 'Physical Distance Ruler & Light-Travel Demonstration'
      }
      data-ui-overlay="true"
      className="w-full max-w-2xl rounded-2xl bg-slate-950/95 border border-amber-400/50 shadow-2xl backdrop-blur-xl text-slate-100 p-4 space-y-3 text-xs"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-white">
              {lang === 'pt-BR'
                ? 'Medidor de Distância Física e Pulso de Luz'
                : 'Physical Distance & Light-Travel Ruler'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Calculado a partir das coordenadas científicas reais (invariante à escala visual 3D).'
                : 'Calculated from physical scientific coordinates (invariant to 3D visual scale).'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
        >
          ✕
        </button>
      </div>

      {/* Endpoint Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-center">
        <div className="sm:col-span-3">
          <label className="block text-[10px] uppercase text-slate-400 mb-1">
            {lang === 'pt-BR' ? 'Origem (A)' : 'Origin (A)'}
          </label>
          <select
            value={fromId}
            onChange={(e) => onChangeEndpoints(e.target.value, toId, observerId)}
            aria-label={lang === 'pt-BR' ? 'Corpo de origem' : 'Origin body'}
            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
          >
            {CELESTIAL_CATALOG.filter((b) => b.simulationTier === 'simulated').map((b) => (
              <option key={b.id} value={b.id}>
                {b.name[lang]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1 flex justify-center pt-4">
          <button
            type="button"
            onClick={() => onChangeEndpoints(toId, fromId, observerId)}
            title={lang === 'pt-BR' ? 'Inverter pontos A e B' : 'Swap endpoints A and B'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-sky-500/20 border border-slate-700 text-sky-300"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-[10px] uppercase text-slate-400 mb-1">
            {lang === 'pt-BR' ? 'Destino (B)' : 'Destination (B)'}
          </label>
          <select
            value={toId}
            onChange={(e) => onChangeEndpoints(fromId, e.target.value, observerId)}
            aria-label={lang === 'pt-BR' ? 'Corpo de destino' : 'Destination body'}
            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
          >
            {CELESTIAL_CATALOG.filter((b) => b.simulationTier === 'simulated').map((b) => (
              <option key={b.id} value={b.id}>
                {b.name[lang]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Readout */}
      {fromId === toId ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200">
          {lang === 'pt-BR'
            ? 'Origem e destino são o mesmo corpo (distância = 0 km). Selecione dois corpos distintos para medir a separação.'
            : 'Origin and destination are the same body (distance = 0 km). Select two distinct bodies to measure separation.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">
              {lang === 'pt-BR' ? 'Centro a Centro (km)' : 'Center-to-Center (km)'}
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {formatNumber(activeDisplay.centerDistanceKm, lang, 0)} km
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">
              {lang === 'pt-BR' ? 'Unidades Astronômicas' : 'Astronomical Units'}
            </div>
            <div className="text-sm font-bold text-sky-300 mt-0.5">
              {formatNumber(activeDisplay.distanceAu, lang, 5)}{' '}
              {lang === 'pt-BR' ? 'UA' : 'AU'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">
              {lang === 'pt-BR' ? 'Tempo-Luz (Só Ida)' : 'One-Way Light-Time'}
            </div>
            <div className="text-sm font-bold text-amber-300 mt-0.5">
              {formatLightTime(activeDisplay.lightTimeSeconds, lang)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">
              {lang === 'pt-BR' ? 'Superfície a Superfície' : 'Surface-to-Surface'}
            </div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">
              {formatNumber(activeDisplay.surfaceDistanceKm, lang, 0)} km
            </div>
          </div>
        </div>
      )}

      {/* Angular Separation from Observer & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400">
            {lang === 'pt-BR' ? 'Separação angular vista de:' : 'Angular separation from:'}
          </label>
          <select
            value={observerId}
            onChange={(e) => onChangeEndpoints(fromId, toId, e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
          >
            <option value="earth">{lang === 'pt-BR' ? 'Terra' : 'Earth'}</option>
            <option value="sun">{lang === 'pt-BR' ? 'Sol' : 'Sun'}</option>
            <option value="mars">{lang === 'pt-BR' ? 'Marte' : 'Mars'}</option>
            <option value="jupiter">{lang === 'pt-BR' ? 'Júpiter' : 'Jupiter'}</option>
          </select>
          <span className="font-mono font-semibold text-sky-300">
            {activeDisplay.angularSeparationDeg !== undefined
              ? `${formatNumber(activeDisplay.angularSeparationDeg, lang, 2)}°`
              : '—'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleFrozen}
            aria-pressed={isFrozen}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-semibold transition ${
              isFrozen
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            {isFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>
              {isFrozen
                ? lang === 'pt-BR'
                  ? 'Medição Congelada'
                  : 'Frozen Measurement'
                : lang === 'pt-BR'
                  ? 'Medição ao Vivo'
                  : 'Live Measurement'}
            </span>
          </button>

          <button
            type="button"
            onClick={onTriggerLightPulse}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {pulseProgress !== null
                ? `${Math.round(pulseProgress * 100)}%`
                : lang === 'pt-BR'
                  ? 'Disparar Pulso de Luz'
                  : 'Send Light Pulse'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSaveToHistory}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-200 font-semibold hover:bg-sky-500/30"
          >
            {lang === 'pt-BR' ? '+ Registrar' : '+ Record'}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-400">
        {lang === 'pt-BR'
          ? `Nota do modelo: O pulso de luz 3D é acelerado para visualização e usa a distância instantânea entre ${fromBody?.name[lang]} e ${toBody?.name[lang]} (t = d/c), não uma solução iterativa de telemetria com receptor móvel.`
          : `Model note: The 3D light pulse is accelerated for visualization and uses instantaneous separation between ${fromBody?.name[lang]} and ${toBody?.name[lang]} (t = d/c), not an iterative moving-receiver telemetry solution.`}
      </p>

      {/* Measurement History */}
      {history.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-32 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === 'pt-BR' ? 'Histórico de Medições Salvas' : 'Saved Measurement History'}
          </div>
          {history.map((rec) => {
            const fName = CATALOG_BY_ID[rec.fromId]?.name[lang] ?? rec.fromId;
            const tName = CATALOG_BY_ID[rec.toId]?.name[lang] ?? rec.toId;
            const summaryStr = `${fName} → ${tName}: ${formatNumber(
              rec.distanceAu,
              lang,
              4
            )} UA (${formatNumber(rec.centerDistanceKm, lang, 0)} km | ${formatLightTime(
              rec.lightTimeSeconds,
              lang
            )}) @ ${formatSimulationDateUtc(rec.simTimeMs, lang)}`;

            return (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] tabular-nums"
              >
                <span className="truncate text-slate-200">{summaryStr}</span>
                <button
                  type="button"
                  onClick={() => handleCopySummary(summaryStr, rec.id)}
                  className="text-sky-400 hover:text-sky-300 shrink-0 flex items-center gap-1"
                >
                  {copiedId === rec.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
