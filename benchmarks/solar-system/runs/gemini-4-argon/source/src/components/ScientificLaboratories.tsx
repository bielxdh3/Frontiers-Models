import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  ArrowLeft,
  Sun,
  Moon,
  Orbit,
  Ruler,
  Compass,
  Play,
  Pause,
  Sparkles,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';
import {
  HypotheticalOrbitPreset,
  Language,
  UserPreferences,
} from '../types/solarSystem';
import { CATALOG_BY_ID, CELESTIAL_CATALOG } from '../data/celestialCatalog';
import {
  AU_IN_KM,
  calculateSphericalGravityAndWeight,
  calculateTwoBodySandbox,
  degToRad,
  EARTH_RADIUS_KM,
  radToDeg,
  SPEED_OF_LIGHT_KMS,
} from '../engine/ephemeris';
import { formatLightTime, formatNumber } from '../utils/formatters';

// ============================================================================
// 1. DEDICATED SCALE LABORATORY (Section 20)
// ============================================================================
interface ScaleLaboratoryProps {
  preferences: UserPreferences;
  onClose: () => void;
}

export const ScaleLaboratoryModal: React.FC<ScaleLaboratoryProps> = ({
  preferences,
  onClose,
}) => {
  const lang = preferences.language;
  const [subView, setSubView] = useState<'sizes' | 'distances' | 'combined'>('sizes');
  const [includeSun, setIncludeSun] = useState<boolean>(true);
  const [sizeSubset, setSizeSubset] = useState<'all_planets' | 'rocky' | 'giants' | 'moons'>('all_planets');
  const [distanceAxisMode, setDistanceAxisMode] = useState<'linear' | 'logarithmic'>('linear');
  const [earthRefDiameterMm, setEarthRefDiameterMm] = useState<number>(14); // 14mm marble default

  const handleResetLab = () => {
    setSubView('sizes');
    setIncludeSun(true);
    setSizeSubset('all_planets');
    setDistanceAxisMode('linear');
    setEarthRefDiameterMm(14);
  };

  const sizeBodies = CELESTIAL_CATALOG.filter((b) => {
    if (b.id === 'sun') return includeSun && sizeSubset === 'all_planets';
    if (sizeSubset === 'rocky') {
      return ['mercury', 'venus', 'earth', 'mars', 'pluto', 'ceres'].includes(b.id);
    }
    if (sizeSubset === 'giants') {
      return ['jupiter', 'saturn', 'uranus', 'neptune', 'earth'].includes(b.id);
    }
    if (sizeSubset === 'moons') {
      return ['earth', 'moon', 'ganymede', 'titan', 'callisto', 'io', 'europa', 'triton'].includes(b.id);
    }
    return b.category === 'planet' || b.id === 'pluto';
  });

  const maxSizeDiamKm = Math.max(1, ...sizeBodies.map((b) => b.diameterKm));
  const scaleFactorMetersPerKm = (earthRefDiameterMm / 1000) / (EARTH_RADIUS_KM * 2);

  const distanceBodies = CELESTIAL_CATALOG.filter(
    (b) =>
      b.category === 'planet' ||
      b.id === 'ceres' ||
      b.id === 'pluto' ||
      b.id === 'eris'
  ).sort((a, b) => (a.semiMajorAxisAu ?? 0) - (b.semiMajorAxisAu ?? 0));

  return (
    <div
      role="dialog"
      aria-label={lang === 'pt-BR' ? 'Laboratório Dedicado de Escala' : 'Dedicated Scale Laboratory'}
      data-ui-overlay="true"
      className="w-full max-w-5xl mx-auto rounded-2xl bg-slate-950/95 border border-sky-400/50 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden flex flex-col max-h-[84vh]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              {lang === 'pt-BR'
                ? 'Laboratório Dedicado de Escala — Tamanhos, Distâncias e Escala Verdadeira'
                : 'Dedicated Scale Laboratory — Sizes, Distances & Combined True Scale'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Experimente proporções físicas exatas sem perder o enquadramento anterior da sua cena 3D.'
                : 'Inspect exact physical ratios without losing your previous 3D Solar System camera framing.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetLab}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'pt-BR' ? 'Redefinir Lab' : 'Reset Lab'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              {lang === 'pt-BR' ? 'Voltar à Vista Anterior' : 'Return to Previous View'}
            </span>
          </button>
        </div>
      </div>

      {/* Coordinated View Tabs */}
      <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setSubView('sizes')}
          className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
            subView === 'sizes'
              ? 'bg-sky-500/25 border-sky-400 text-sky-200'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {lang === 'pt-BR' ? '1. Tamanhos Relativos (Diâmetros)' : '1. Relative Sizes (Diameters)'}
        </button>
        <button
          type="button"
          onClick={() => setSubView('distances')}
          className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
            subView === 'distances'
              ? 'bg-sky-500/25 border-sky-400 text-sky-200'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {lang === 'pt-BR' ? '2. Distâncias Relativas (UA)' : '2. Relative Distances (AU)'}
        </button>
        <button
          type="button"
          onClick={() => setSubView('combined')}
          className={`px-3 py-1.5 rounded-xl font-semibold border transition ${
            subView === 'combined'
              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {lang === 'pt-BR'
            ? '3. Escala Verdadeira Combinada ("Se a Terra Tivesse Este Tamanho")'
            : '3. Combined True Scale ("If Earth Were This Size")'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {subView === 'sizes' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-300">
                  {lang === 'pt-BR' ? 'Recorte de Inspeção:' : 'Inspection Subset:'}
                </span>
                {[
                  { id: 'all_planets', pt: 'Sistema Planetário', en: 'Planetary Lineup' },
                  { id: 'rocky', pt: 'Rochosos e Anões (Zoom)', en: 'Rocky & Dwarfs (Zoom)' },
                  { id: 'giants', pt: 'Gigantes vs. Terra', en: 'Giants vs. Earth' },
                  { id: 'moons', pt: 'Grandes Luas vs. Terra', en: 'Major Moons vs. Earth' },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSizeSubset(sub.id as typeof sizeSubset)}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      sizeSubset === sub.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'pt-BR' ? sub.pt : sub.en}
                  </button>
                ))}
              </div>

              {sizeSubset === 'all_planets' && (
                <label className="flex items-center gap-2 cursor-pointer text-amber-200 font-medium">
                  <input
                    type="checkbox"
                    checked={includeSun}
                    onChange={(e) => setIncludeSun(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  <span>
                    {lang === 'pt-BR'
                      ? 'Incluir o Sol (1.391.400 km = 109,2× Terra)'
                      : 'Include the Sun (1,391,400 km = 109.2× Earth)'}
                  </span>
                </label>
              )}
            </div>

            {/* Lineup Stage with Visible Scale Bar */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {lang === 'pt-BR'
                    ? 'Escala Linear Comum de Diâmetro (proporção 1:1 exata entre todos os discos exibidos)'
                    : 'Shared Linear Diameter Scale (exact 1:1 ratio across all displayed disks)'}
                </span>
                <div className="flex items-center gap-2 font-mono text-sky-300">
                  <span className="inline-block w-16 h-1.5 bg-sky-400 rounded" />
                  <span>
                    ={' '}
                    {formatNumber(
                      Math.round(maxSizeDiamKm * 0.25),
                      lang,
                      0
                    )}{' '}
                    km
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-around gap-3 overflow-x-auto py-6 min-h-[210px] px-2">
                {sizeBodies.map((b) => {
                  const px = Math.max(3, Math.round((b.diameterKm / maxSizeDiamKm) * 165));
                  const earthRatio = b.diameterKm / (EARTH_RADIUS_KM * 2);
                  return (
                    <div
                      key={b.id}
                      className="flex flex-col items-center gap-2 shrink-0"
                    >
                      <div className="h-44 flex items-center justify-center">
                        <div
                          style={{
                            width: `${px}px`,
                            height: `${px}px`,
                            background: `radial-gradient(circle at 30% 30%, ${b.visual.accentColor}, ${b.visual.primaryColor} 65%, ${b.visual.secondaryColor})`,
                          }}
                          className="rounded-full border border-white/30 shadow-lg"
                        />
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-white">{b.name[lang]}</div>
                        <div className="text-[11px] text-sky-300 tabular-nums">
                          {formatNumber(earthRatio, lang, 2)}×{' '}
                          {lang === 'pt-BR' ? 'Terra' : 'Earth'}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {formatNumber(b.diameterKm, lang, 0)} km
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {subView === 'distances' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="font-bold text-white">
                  {distanceAxisMode === 'linear'
                    ? lang === 'pt-BR'
                      ? 'Modo do Eixo: Régua Linear Compartilhada (0 a 70 UA)'
                      : 'Axis Mode: Shared Linear Ruler (0 to 70 AU)'
                    : lang === 'pt-BR'
                      ? 'Modo do Eixo: Escala Logarítmica Rotulada (log₁₀ UA)'
                      : 'Axis Mode: Labeled Logarithmic Scale (log₁₀ AU)'}
                </div>
                <p className="text-[11px] text-slate-400">
                  {distanceAxisMode === 'linear'
                    ? lang === 'pt-BR'
                      ? 'Na régua linear, Mercúrio, Vênus, Terra e Marte ficam agrupados nos primeiros 2,2% da extensão até Éris (67,9 UA).'
                      : 'On a linear ruler, Mercury, Venus, Earth, and Mars cluster in the first 2.2% of the span out to Eris (67.9 AU).'
                    : lang === 'pt-BR'
                      ? 'Cada divisão principal multiplica a distância por 10× (0,1 UA → 1 UA → 10 UA → 100 UA).'
                      : 'Each major division multiplies distance by 10× (0.1 AU → 1 AU → 10 AU → 100 AU).'}
                </p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDistanceAxisMode('linear')}
                  className={`px-3 py-1.5 rounded-xl font-semibold border ${
                    distanceAxisMode === 'linear'
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  {lang === 'pt-BR' ? 'Eixo Linear (UA)' : 'Linear Axis (AU)'}
                </button>
                <button
                  type="button"
                  onClick={() => setDistanceAxisMode('logarithmic')}
                  className={`px-3 py-1.5 rounded-xl font-semibold border ${
                    distanceAxisMode === 'logarithmic'
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  {lang === 'pt-BR'
                    ? 'Eixo Logarítmico (Potências de 10)'
                    : 'Logarithmic Axis (Powers of 10)'}
                </button>
              </div>
            </div>

            {/* Distance Axis Chart */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
              <div className="relative h-28 bg-slate-950 rounded-xl border border-slate-800 px-6 flex items-center">
                <div className="w-full h-1 bg-slate-700 relative">
                  {/* Axis Ticks */}
                  {distanceAxisMode === 'linear'
                    ? [0, 10, 20, 30, 40, 50, 60, 70].map((auTick) => (
                        <div
                          key={auTick}
                          style={{ left: `${(auTick / 70) * 100}%` }}
                          className="absolute top-2 -translate-x-1/2 text-[10px] text-slate-400 font-mono"
                        >
                          | {auTick} UA
                        </div>
                      ))
                    : [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map((auTick) => {
                        const pct =
                          ((Math.log10(auTick) - Math.log10(0.2)) /
                            (Math.log10(100) - Math.log10(0.2))) *
                          100;
                        return (
                          <div
                            key={auTick}
                            style={{ left: `${pct}%` }}
                            className="absolute top-2 -translate-x-1/2 text-[10px] text-amber-300 font-mono"
                          >
                            | {auTick} UA
                          </div>
                        );
                      })}

                  {/* Body Markers */}
                  {distanceBodies.map((b, idx) => {
                    const au = b.semiMajorAxisAu ?? 1;
                    const pct =
                      distanceAxisMode === 'linear'
                        ? (au / 70) * 100
                        : ((Math.log10(au) - Math.log10(0.2)) /
                            (Math.log10(100) - Math.log10(0.2))) *
                          100;
                    const staggerTop = idx % 2 === 0 ? '-top-8' : '-top-14';
                    return (
                      <div
                        key={b.id}
                        style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group"
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white shadow"
                          style={{ backgroundColor: b.visual.primaryColor }}
                        />
                        <div
                          className={`absolute ${staggerTop} left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-900/95 border border-slate-700 text-[10px] text-slate-200`}
                        >
                          {b.name[lang]} ({formatNumber(au, lang, 2)} UA)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {subView === 'combined' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-400/40 space-y-2">
              <div className="font-bold text-amber-300 text-sm">
                {lang === 'pt-BR'
                  ? 'Por que o espaço parece quase vazio na Escala Verdadeira Combinada?'
                  : 'Why does space look almost empty in Combined True Scale?'}
              </div>
              <p className="text-slate-200 leading-relaxed">
                {lang === 'pt-BR'
                  ? 'A distância da Terra ao Sol (149.597.871 km) equivale a 11.740 diâmetros terrestres! Quando usamos a mesma escala física para diâmetros e distâncias simultaneamente, até mesmo Júpiter torna-se menor que 1 pixel numa visão do sistema inteiro. Use o modelo interativo abaixo para traduzir essa proporção para objetos cotidianos:'
                  : 'Earth’s distance from the Sun (149,597,871 km) equals 11,740 Earth diameters! When we use one identical physical scale for both diameters and distances simultaneously, even Jupiter shrinks below 1 pixel in a system-wide view. Use the interactive model below to map true scale onto everyday objects:'}
              </p>
            </div>

            {/* "If Earth were this size" Interactive Calculator */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-bold text-sky-300 text-sm">
                  {lang === 'pt-BR'
                    ? `"Se a Terra tivesse ${formatNumber(earthRefDiameterMm, lang, 1)} mm de diâmetro..."`
                    : `"If Earth were ${formatNumber(earthRefDiameterMm, lang, 1)} mm in diameter..."`}
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { mm: 2.5, pt: 'Grão de areia (2,5 mm)', en: 'Sand grain (2.5 mm)' },
                    { mm: 14, pt: 'Bolinha de gude (14 mm)', en: 'Glass marble (14 mm)' },
                    { mm: 27, pt: 'Moeda de R$ 1 (27 mm)', en: 'Coin (27 mm)' },
                    { mm: 70, pt: 'Bola de tênis (70 mm)', en: 'Tennis ball (70 mm)' },
                    { mm: 220, pt: 'Bola de futebol (220 mm)', en: 'Soccer ball (220 mm)' },
                  ].map((preset) => (
                    <button
                      key={preset.mm}
                      type="button"
                      onClick={() => setEarthRefDiameterMm(preset.mm)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition ${
                        Math.abs(earthRefDiameterMm - preset.mm) < 0.1
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lang === 'pt-BR' ? preset.pt : preset.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={500}
                  step={0.5}
                  value={earthRefDiameterMm}
                  onChange={(e) => setEarthRefDiameterMm(Number(e.target.value))}
                  aria-label={
                    lang === 'pt-BR'
                      ? 'Diâmetro de referência da Terra em milímetros'
                      : 'Reference Earth diameter in millimeters'
                  }
                  className="flex-1 accent-sky-400"
                />
                <input
                  type="number"
                  min={0.5}
                  max={5000}
                  step={0.5}
                  value={earthRefDiameterMm}
                  onChange={(e) =>
                    setEarthRefDiameterMm(Math.max(0.5, Number(e.target.value) || 14))
                  }
                  className="w-24 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-right font-mono"
                />
                <span className="text-slate-400">mm</span>
              </div>

              {/* Synchronized Scale Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs tabular-nums">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                      <th className="p-2.5">{lang === 'pt-BR' ? 'Corpo' : 'Body'}</th>
                      <th className="p-2.5">
                        {lang === 'pt-BR' ? 'Diâmetro Real' : 'True Diameter'}
                      </th>
                      <th className="p-2.5 text-sky-300">
                        {lang === 'pt-BR' ? 'Diâmetro no Modelo' : 'Scaled Diameter'}
                      </th>
                      <th className="p-2.5">
                        {lang === 'pt-BR' ? 'Distância Média Real' : 'True Mean Distance'}
                      </th>
                      <th className="p-2.5 text-amber-300">
                        {lang === 'pt-BR' ? 'Distância no Modelo' : 'Scaled Distance'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
                      (id) => {
                        const b = CATALOG_BY_ID[id];
                        if (!b) return null;
                        const scaledDiamMeters = b.diameterKm * scaleFactorMetersPerKm;
                        const scaledDiamStr =
                          scaledDiamMeters >= 1
                            ? `${formatNumber(scaledDiamMeters, lang, 2)} m`
                            : `${formatNumber(scaledDiamMeters * 1000, lang, 1)} mm`;

                        const trueDistKm =
                          b.id === 'sun'
                            ? 0
                            : b.id === 'moon'
                              ? b.parentDistanceKm ?? 384400
                              : (b.semiMajorAxisAu ?? 0) * AU_IN_KM;
                        const scaledDistMeters = trueDistKm * scaleFactorMetersPerKm;
                        const scaledDistStr =
                          b.id === 'sun'
                            ? '0 m (Origem)'
                            : scaledDistMeters >= 1000
                              ? `${formatNumber(scaledDistMeters / 1000, lang, 2)} km`
                              : `${formatNumber(scaledDistMeters, lang, 2)} m`;

                        return (
                          <tr key={b.id} className="hover:bg-slate-800/40">
                            <td className="p-2.5 font-semibold text-white">{b.name[lang]}</td>
                            <td className="p-2.5 text-slate-300">
                              {formatNumber(b.diameterKm, lang, 0)} km
                            </td>
                            <td className="p-2.5 font-bold text-sky-300">{scaledDiamStr}</td>
                            <td className="p-2.5 text-slate-300">
                              {b.id === 'sun'
                                ? '—'
                                : b.id === 'moon'
                                  ? `${formatNumber(trueDistKm, lang, 0)} km (Terra)`
                                  : `${formatNumber(b.semiMajorAxisAu, lang, 2)} UA`}
                            </td>
                            <td className="p-2.5 font-bold text-amber-300">{scaledDistStr}</td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. SEASONS, AXIAL TILT & DAYLIGHT LABORATORY (Section 32)
// ============================================================================
export const SeasonsLaboratoryModal: React.FC<{
  preferences: UserPreferences;
  onClose: () => void;
}> = ({ preferences, onClose }) => {
  const lang = preferences.language;
  const [planetId, setPlanetId] = useState<'earth' | 'mars' | 'uranus'>('earth');
  const baselineTilts: Record<'earth' | 'mars' | 'uranus', number> = {
    earth: 23.44,
    mars: 25.19,
    uranus: 97.77,
  };
  const [experimentalTiltDeg, setExperimentalTiltDeg] = useState<number>(23.44);
  const [orbitalLongitudeDeg, setOrbitalLongitudeDeg] = useState<number>(90); // 90 = June solstice configuration
  const [selectedLatDeg, setSelectedLatDeg] = useState<number>(45);
  const [predictionChoice, setPredictionChoice] = useState<string | null>(null);

  const isModified = Math.abs(experimentalTiltDeg - baselineTilts[planetId]) > 0.05;

  const handleSelectPlanet = (id: 'earth' | 'mars' | 'uranus') => {
    setPlanetId(id);
    setExperimentalTiltDeg(baselineTilts[id]);
  };

  // Effective obliquity in [-90, 90] for solar declination calculation
  const effectiveObliquityDeg =
    experimentalTiltDeg > 90 ? 180 - experimentalTiltDeg : experimentalTiltDeg;
  const subsolarDeclinationDeg =
    effectiveObliquityDeg * Math.sin(degToRad(orbitalLongitudeDeg));

  // Analytical daylight duration at selectedLatDeg (ignoring atmospheric refraction)
  // cos(hourAngle) = -tan(lat) * tan(declination)
  const latRad = degToRad(Math.max(-89.9, Math.min(89.9, selectedLatDeg)));
  const decRad = degToRad(Math.max(-89.9, Math.min(89.9, subsolarDeclinationDeg)));
  const cosH0 = -Math.tan(latRad) * Math.tan(decRad);

  const baseSolarDayHours =
    planetId === 'earth' ? 24.0 : planetId === 'mars' ? 24.66 : 17.24;

  let daylightHours: number;
  let daylightRegime: 'normal' | 'polar_day' | 'polar_night' = 'normal';
  if (cosH0 <= -1) {
    daylightHours = baseSolarDayHours;
    daylightRegime = 'polar_day';
  } else if (cosH0 >= 1) {
    daylightHours = 0;
    daylightRegime = 'polar_night';
  } else {
    const H0_rad = Math.acos(cosH0);
    daylightHours = (H0_rad / Math.PI) * baseSolarDayHours;
  }

  // Noon solar altitude above horizon: 90 - |lat - dec|
  const noonSolarElevationDeg = Math.max(
    0,
    90 - Math.abs(selectedLatDeg - subsolarDeclinationDeg)
  );

  // Determine Northern & Southern hemisphere season names together (Section 32)
  const getHemisphereSeasons = (): { north: string; south: string } => {
    if (effectiveObliquityDeg < 1.0) {
      return {
        north:
          lang === 'pt-BR'
            ? 'Sem estações por inclinação (iluminação constante)'
            : 'No tilt seasons (constant illumination)',
        south:
          lang === 'pt-BR'
            ? 'Sem estações por inclinação (iluminação constante)'
            : 'No tilt seasons (constant illumination)',
      };
    }
    if (subsolarDeclinationDeg > 4) {
      return {
        north: lang === 'pt-BR' ? 'Verão Boreal (Inclinado para o Sol)' : 'Northern Summer (Tilted toward Sun)',
        south: lang === 'pt-BR' ? 'Inverno Austral (Inclinado para longe)' : 'Southern Winter (Tilted away)',
      };
    }
    if (subsolarDeclinationDeg < -4) {
      return {
        north: lang === 'pt-BR' ? 'Inverno Boreal (Inclinado para longe)' : 'Northern Winter (Tilted away)',
        south: lang === 'pt-BR' ? 'Verão Austral (Inclinado para o Sol)' : 'Southern Summer (Tilted toward Sun)',
      };
    }
    return {
      north: lang === 'pt-BR' ? 'Equinócio (Primavera / Outono)' : 'Equinox (Spring / Autumn)',
      south: lang === 'pt-BR' ? 'Equinócio (Outono / Primavera)' : 'Equinox (Autumn / Spring)',
    };
  };

  const seasons = getHemisphereSeasons();

  return (
    <div
      role="dialog"
      aria-label={
        lang === 'pt-BR'
          ? 'Laboratório de Estações, Inclinação Axial e Luz Diurna'
          : 'Seasons, Axial Tilt & Daylight Laboratory'
      }
      data-ui-overlay="true"
      className="w-full max-w-5xl mx-auto rounded-2xl bg-slate-950/95 border border-amber-400/50 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden flex flex-col max-h-[84vh]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-400" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                {lang === 'pt-BR'
                  ? 'Laboratório de Estações, Inclinação Axial e Luz Solar'
                  : 'Seasons, Axial Tilt & Daylight Laboratory'}
              </h2>
              {isModified && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-200 text-[10px] font-bold uppercase">
                  {lang === 'pt-BR' ? 'Modo Hipotético Experimental' : 'Experimental Hypothetical Mode'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Alterações aqui são puramente experimentais e nunca modificam os dados canônicos do planeta.'
                : 'Changes here are purely experimental and never alter the canonical planet dataset.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isModified && (
            <button
              type="button"
              onClick={() => setExperimentalTiltDeg(baselineTilts[planetId])}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {lang === 'pt-BR'
                  ? `Restaurar ${baselineTilts[planetId]}°`
                  : `Restore ${baselineTilts[planetId]}°`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'pt-BR' ? 'Voltar à Cena' : 'Return to Scene'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
        {/* Left: Interactive SVG Sun-Planet Illumination Diagram */}
        <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(['earth', 'mars', 'uranus'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectPlanet(id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold border ${
                    planetId === id
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {CATALOG_BY_ID[id]?.name[lang]} ({baselineTilts[id]}°)
                </button>
              ))}
            </div>
            <span className="text-[11px] text-amber-300 font-mono">
              δ = {subsolarDeclinationDeg >= 0 ? '+' : ''}
              {formatNumber(subsolarDeclinationDeg, lang, 1)}°
            </span>
          </div>

          <div className="relative bg-slate-950 rounded-xl border border-slate-800 p-3 flex items-center justify-center">
            <svg
              viewBox="0 0 360 220"
              className="w-full max-w-[360px] h-auto"
              role="img"
              aria-label={
                lang === 'pt-BR'
                  ? `Diagrama de iluminação solar com inclinação de ${experimentalTiltDeg} graus`
                  : `Solar illumination diagram at ${experimentalTiltDeg} degrees tilt`
              }
            >
              {/* Incoming parallel sunlight rays from the left */}
              {[45, 78, 110, 142, 175].map((yPos) => (
                <g key={yPos}>
                  <line
                    x1="12"
                    y1={yPos}
                    x2="132"
                    y2={yPos}
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <polygon
                    points={`136,${yPos} 128,${yPos - 3.5} 128,${yPos + 3.5}`}
                    fill="#fbbf24"
                  />
                </g>
              ))}
              <text x="14" y="28" fill="#fbbf24" fontSize="11" fontWeight="bold">
                {lang === 'pt-BR' ? 'Luz Solar Paralela ☀️' : 'Parallel Sunlight ☀️'}
              </text>

              {/* Planet Group centered at (225, 110) */}
              <g transform="translate(225, 110)">
                {/* Tilted Axis & Equator */}
                <g
                  transform={`rotate(${
                    -subsolarDeclinationDeg
                  })`}
                >
                  {/* Rotation Axis */}
                  <line
                    x1="0"
                    y1="-88"
                    x2="0"
                    y2="88"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                  />
                  <text x="-8" y="-92" fill="#38bdf8" fontSize="11" fontWeight="bold">
                    N
                  </text>
                  <text x="-6" y="102" fill="#38bdf8" fontSize="11" fontWeight="bold">
                    S
                  </text>

                  {/* Planet Disk */}
                  <circle
                    cx="0"
                    cy="0"
                    r="66"
                    fill={
                      planetId === 'earth'
                        ? '#1d4ed8'
                        : planetId === 'mars'
                          ? '#c2410c'
                          : '#0891b2'
                    }
                  />

                  {/* Equator Line */}
                  <line
                    x1="-66"
                    y1="0"
                    x2="66"
                    y2="0"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Selected Latitude Parallel */}
                  {(() => {
                    const yLat = -Math.sin(degToRad(selectedLatDeg)) * 66;
                    const xHalf = Math.cos(degToRad(selectedLatDeg)) * 66;
                    return (
                      <g>
                        <line
                          x1={-xHalf}
                          y1={yLat}
                          x2={xHalf}
                          y2={yLat}
                          stroke="#fde047"
                          strokeWidth="2.5"
                        />
                        <circle cx={-xHalf * 0.5} cy={yLat} r="3.5" fill="#fde047" />
                      </g>
                    );
                  })()}
                </g>

                {/* Night Hemisphere Overlay (Always on the right half opposite the Sun rays) */}
                <path
                  d="M 0,-66 A 66,66 0 0,1 0,66 Z"
                  fill="rgba(2, 6, 23, 0.72)"
                />
                {/* Vertical Terminator Line */}
                <line
                  x1="0"
                  y1="-70"
                  x2="0"
                  y2="70"
                  stroke="#f8fafc"
                  strokeWidth="1.2"
                  strokeOpacity="0.6"
                />
              </g>
            </svg>
          </div>

          {/* Northern and Southern Hemisphere Seasons Together */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-sky-300 font-bold">
                {lang === 'pt-BR' ? 'Hemisfério Norte' : 'Northern Hemisphere'}
              </div>
              <div className="font-semibold text-white mt-0.5">{seasons.north}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-amber-300 font-bold">
                {lang === 'pt-BR' ? 'Hemisfério Sul' : 'Southern Hemisphere'}
              </div>
              <div className="font-semibold text-white mt-0.5">{seasons.south}</div>
            </div>
          </div>
        </div>

        {/* Right: Controls, Latitude Daylight Readout & Guided Question */}
        <div className="lg:col-span-6 space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            {/* Axial Tilt Control */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="font-semibold text-slate-200">
                  {lang === 'pt-BR'
                    ? '1. Inclinação Axial Experimental (Obliquidade):'
                    : '1. Experimental Axial Tilt (Obliquity):'}
                </label>
                <span className="font-mono font-bold text-sky-300">
                  {formatNumber(experimentalTiltDeg, lang, 2)}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={98}
                step={0.1}
                value={experimentalTiltDeg}
                onChange={(e) => setExperimentalTiltDeg(Number(e.target.value))}
                aria-label={
                  lang === 'pt-BR' ? 'Inclinação axial em graus' : 'Axial tilt in degrees'
                }
                className="w-full accent-sky-400"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setExperimentalTiltDeg(0)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 border border-slate-700 text-[11px] text-amber-300"
                >
                  {lang === 'pt-BR' ? 'Testar 0° (Sem Estações)' : 'Test 0° (No Seasons)'}
                </button>
                <button
                  type="button"
                  onClick={() => setExperimentalTiltDeg(23.44)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 border border-slate-700 text-[11px] text-slate-200"
                >
                  {lang === 'pt-BR' ? 'Terra Real (23,44°)' : 'Real Earth (23.44°)'}
                </button>
                <button
                  type="button"
                  onClick={() => setExperimentalTiltDeg(97.77)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 border border-slate-700 text-[11px] text-slate-200"
                >
                  {lang === 'pt-BR' ? 'Extremo Urano (97,77°)' : 'Uranus Extreme (97.77°)'}
                </button>
              </div>
            </div>

            {/* Orbital Position Control + Solstice/Equinox Presets */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="font-semibold text-slate-200">
                  {lang === 'pt-BR'
                    ? '2. Posição ao Longo da Órbita:'
                    : '2. Position Along the Orbit:'}
                </label>
                <span className="font-mono font-bold text-amber-300">
                  {Math.round(orbitalLongitudeDeg)}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={orbitalLongitudeDeg}
                onChange={(e) => setOrbitalLongitudeDeg(Number(e.target.value))}
                aria-label={
                  lang === 'pt-BR'
                    ? 'Longitude orbital sazonal'
                    : 'Seasonal orbital longitude'
                }
                className="w-full accent-amber-400"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 pt-1">
                {[
                  { deg: 0, pt: 'Equinócio (0°)', en: 'Equinox (0°)' },
                  { deg: 90, pt: 'Solstício N (90°)', en: 'N Solstice (90°)' },
                  { deg: 180, pt: 'Equinócio (180°)', en: 'Equinox (180°)' },
                  { deg: 270, pt: 'Solstício S (270°)', en: 'S Solstice (270°)' },
                ].map((p) => (
                  <button
                    key={p.deg}
                    type="button"
                    onClick={() => setOrbitalLongitudeDeg(p.deg)}
                    className={`px-2 py-1 rounded-lg border text-[11px] ${
                      Math.abs(orbitalLongitudeDeg - p.deg) < 5
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'pt-BR' ? p.pt : p.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Latitude Control & Daylight Duration Readout */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="font-semibold text-slate-200">
                  {lang === 'pt-BR'
                    ? '3. Latitude Selecionada (Linha Amarela):'
                    : '3. Selected Latitude (Yellow Parallel):'}
                </label>
                <span className="font-mono font-bold text-yellow-300">
                  {selectedLatDeg > 0
                    ? `${selectedLatDeg}° N`
                    : selectedLatDeg < 0
                      ? `${Math.abs(selectedLatDeg)}° S`
                      : '0° (Equador)'}
                </span>
              </div>
              <input
                type="range"
                min={-90}
                max={90}
                step={1}
                value={selectedLatDeg}
                onChange={(e) => setSelectedLatDeg(Number(e.target.value))}
                aria-label={lang === 'pt-BR' ? 'Latitude em graus' : 'Latitude in degrees'}
                className="w-full accent-yellow-400"
              />
            </div>

            {/* Qualitative & Quantitative Daylight Bar */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 tabular-nums">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">
                  {lang === 'pt-BR'
                    ? 'Duração Calculada do Dia Solar:'
                    : 'Calculated Daylight Duration:'}
                </span>
                <span className="font-bold text-amber-300 text-sm">
                  {formatNumber(daylightHours, lang, 1)} h / {baseSolarDayHours} h
                  {daylightRegime === 'polar_day'
                    ? lang === 'pt-BR'
                      ? ' (Dia Polar — Sol de 24h)'
                      : ' (Polar Day — Midnight Sun)'
                    : daylightRegime === 'polar_night'
                      ? lang === 'pt-BR'
                        ? ' (Noite Polar — 0h de Sol)'
                        : ' (Polar Night — 0h Sun)'
                      : ''}
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${(daylightHours / baseSolarDayHours) * 100}%` }}
                  className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full transition-all"
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>
                  {lang === 'pt-BR'
                    ? `Altura máxima do Sol ao meio-dia: ${formatNumber(noonSolarElevationDeg, lang, 1)}°`
                    : `Noon solar elevation angle: ${formatNumber(noonSolarElevationDeg, lang, 1)}°`}
                </span>
                <span>
                  {lang === 'pt-BR'
                    ? 'Horizonte geométrico idealizado'
                    : 'Idealized geometric horizon'}
                </span>
              </div>
            </div>
          </div>

          {/* Guided Interactive Question (Section 32) */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/35 border border-indigo-400/40 space-y-2">
            <div className="font-bold text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                {lang === 'pt-BR'
                  ? 'Desafio Guiado: Preveja e Experimente Inclinação 0°'
                  : 'Guided Prompt: Predict & Test 0° Axial Tilt'}
              </span>
            </div>
            <p className="text-[11px] text-slate-200">
              {lang === 'pt-BR'
                ? 'Antes ou depois de clicar em "Testar 0°", preveja: o que acontece com a duração do dia em qualquer latitude (exceto nos polos exatos) quando a inclinação é 0°?'
                : 'Predict what happens to daylight duration at any latitude when axial tilt is set to 0°:'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPredictionChoice('equal_12h');
                  setExperimentalTiltDeg(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition ${
                  predictionChoice === 'equal_12h'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                    : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {lang === 'pt-BR'
                  ? '✓ Dia e noite duram 50% cada (~12h) o ano todo e as estações desaparecem'
                  : '✓ Day and night last 50% each (~12h) all year and seasons vanish'}
              </button>
              <button
                type="button"
                onClick={() => setPredictionChoice('wrong')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition ${
                  predictionChoice === 'wrong'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {lang === 'pt-BR'
                  ? 'As estações ficam duas vezes mais extremas'
                  : 'Seasons become twice as extreme'}
              </button>
            </div>
            {predictionChoice && (
              <p className="text-[11px] text-emerald-200 pt-1">
                {lang === 'pt-BR'
                  ? 'Explicação: Com 0° de inclinação (δ = 0°), o terminador solar passa sempre pelos dois polos. Mova o controle de Latitude acima com inclinação 0° e veja que todas as latitudes recebem exatamente metade do dia sob luz solar!'
                  : 'Explanation: At 0° tilt (δ = 0°), the solar terminator always passes through both poles. Move the Latitude slider at 0° tilt to verify every latitude gets equal day and night!'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. LUNAR PHASES & ECLIPSE LABORATORY (Section 33)
// ============================================================================
export const LunarLaboratoryModal: React.FC<{
  preferences: UserPreferences;
  onClose: () => void;
}> = ({ preferences, onClose }) => {
  const lang = preferences.language;
  const [elongationDeg, setElongationDeg] = useState<number>(135); // 0 = New Moon, 180 = Full Moon
  const [inclinationDeg, setInclinationDeg] = useState<number>(5.145);
  const [nodeOffsetDeg, setNodeOffsetDeg] = useState<number>(90); // 0 = aligned with Sun-Earth line
  const [earthMoonDistanceKm, setEarthMoonDistanceKm] = useState<number>(384400); // Perigee 363300 to Apogee 405500

  const isHypotheticalTilt = Math.abs(inclinationDeg - 5.145) > 0.05;
  const rad = degToRad(elongationDeg);
  const illuminatedFraction = (1 - Math.cos(rad)) / 2;
  const isWaxing = elongationDeg > 0 && elongationDeg < 180;

  // Vertical elevation of Moon above/below ecliptic plane at current elongation
  const eclipticLatDeg =
    inclinationDeg * Math.sin(degToRad(elongationDeg - nodeOffsetDeg));

  // Apparent angular diameter of Sun (~0.533 deg at 1 AU) vs Moon (2 * atan(1737.4 / d))
  const sunAngularDeg = 0.533;
  const moonAngularDeg = radToDeg(2 * Math.atan(1737.4 / earthMoonDistanceKm));

  // Check if in solar or lunar eclipse alignment
  const nearNewMoon = elongationDeg < 8 || elongationDeg > 352;
  const nearFullMoon = Math.abs(elongationDeg - 180) < 8;
  const verticalAlignment = Math.abs(eclipticLatDeg);

  let eclipseState:
    | 'none'
    | 'solar_total'
    | 'solar_annular'
    | 'solar_partial'
    | 'lunar_total'
    | 'lunar_partial' = 'none';

  if (nearNewMoon && verticalAlignment < 1.45) {
    if (verticalAlignment < 0.52) {
      eclipseState = moonAngularDeg >= sunAngularDeg ? 'solar_total' : 'solar_annular';
    } else {
      eclipseState = 'solar_partial';
    }
  } else if (nearFullMoon && verticalAlignment < 1.55) {
    eclipseState = verticalAlignment < 0.75 ? 'lunar_total' : 'lunar_partial';
  }

  const getPhaseName = (): string => {
    const e = ((elongationDeg % 360) + 360) % 360;
    if (e < 12 || e >= 348) return lang === 'pt-BR' ? 'Lua Nova' : 'New Moon';
    if (e < 78) return lang === 'pt-BR' ? 'Côncava Crescente' : 'Waxing Crescent';
    if (e < 102) return lang === 'pt-BR' ? 'Quarto Crescente' : 'First Quarter';
    if (e < 168) return lang === 'pt-BR' ? 'Gibosa Crescente' : 'Waxing Gibbous';
    if (e < 192) return lang === 'pt-BR' ? 'Lua Cheia' : 'Full Moon';
    if (e < 258) return lang === 'pt-BR' ? 'Gibosa Minguante' : 'Waning Gibbous';
    if (e < 282) return lang === 'pt-BR' ? 'Quarto Minguante' : 'Third Quarter';
    return lang === 'pt-BR' ? 'Côncava Minguante' : 'Waning Crescent';
  };

  return (
    <div
      role="dialog"
      aria-label={
        lang === 'pt-BR'
          ? 'Laboratório de Fases Lunares e Eclipses'
          : 'Lunar Phases & Eclipses Laboratory'
      }
      data-ui-overlay="true"
      className="w-full max-w-5xl mx-auto rounded-2xl bg-slate-950/95 border border-indigo-400/50 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden flex flex-col max-h-[84vh]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-indigo-300" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                {lang === 'pt-BR'
                  ? 'Laboratório Sol–Terra–Lua: Fases Lunares e Geometria de Eclipses'
                  : 'Sun–Earth–Moon Laboratory: Lunar Phases & Eclipse Geometry'}
              </h2>
              {isHypotheticalTilt && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-200 text-[10px] font-bold uppercase">
                  {lang === 'pt-BR' ? 'Inclinação Hipotética' : 'Hypothetical Inclination'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'As fases normais vêm do ângulo de visão do hemisfério iluminado pelo Sol — não da sombra da Terra.'
                : 'Normal phases arise from viewing the Sun-lit hemisphere — not from Earth’s shadow.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'pt-BR' ? 'Voltar à Cena' : 'Return to Scene'}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
        {/* Left: External Orbital Geometry View with Shadow Cones */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
              {lang === 'pt-BR'
                ? '1. Visão Geométrica Externa (Polo Norte Eclíptico + Cones de Sombra)'
                : '1. External Geometric View (Ecliptic North + Shadow Cones)'}
            </span>
            <span className="font-mono text-slate-300">
              {lang === 'pt-BR' ? 'Elongação:' : 'Elongation:'} {Math.round(elongationDeg)}°
            </span>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 flex items-center justify-center">
            <svg
              viewBox="0 0 420 240"
              className="w-full max-w-[420px] h-auto"
              role="img"
              aria-label={
                lang === 'pt-BR'
                  ? 'Diagrama orbital Sol-Terra-Lua com umbra e penumbra'
                  : 'Sun-Earth-Moon orbital diagram with umbra and penumbra'
              }
            >
              {/* Sunlight from Left */}
              {[40, 120, 200].map((y) => (
                <line
                  key={y}
                  x1="8"
                  y1={y}
                  x2="92"
                  y2={y}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              ))}
              <text x="10" y="24" fill="#fbbf24" fontSize="11" fontWeight="bold">
                {lang === 'pt-BR' ? 'Luz do Sol ☀️' : 'Sunlight ☀️'}
              </text>

              {/* Earth Shadow Cone (Umbra & Penumbra extending to the right) */}
              <polygon
                points="210,102 395,88 395,152 210,138"
                fill="rgba(148, 163, 184, 0.12)"
              />
              <polygon
                points="210,102 365,120 210,138"
                fill="rgba(2, 6, 23, 0.75)"
              />
              <text x="315" y="102" fill="#94a3b8" fontSize="9">
                Penumbra
              </text>
              <text x="275" y="123" fill="#64748b" fontSize="9">
                Umbra
              </text>

              {/* Lunar Orbit Circle centered at (210, 120) */}
              <circle
                cx="210"
                cy="120"
                r="82"
                fill="none"
                stroke="#334155"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Earth at (210, 120) */}
              <circle cx="210" cy="120" r="18" fill="#2563eb" />
              <path d="M 210,102 A 18,18 0 0,1 210,138 Z" fill="rgba(2,6,23,0.75)" />
              <circle cx="196" cy="120" r="3" fill="#fde047" />

              {/* Moon at elongationDeg (0 deg = left toward Sun at x = 210 - 82*cos, y = 120 - 82*sin) */}
              {(() => {
                const mx = 210 - 82 * Math.cos(rad);
                const my = 120 - 82 * Math.sin(rad);
                return (
                  <g>
                    {/* Moon Shadow Cone */}
                    <polygon
                      points={`${mx},${my - 8} ${mx + 70},${my} ${mx},${my + 8}`}
                      fill="rgba(2, 6, 23, 0.55)"
                    />
                    <circle cx={mx} cy={my} r="9" fill="#e2e8f0" />
                    <path
                      d={`M ${mx},${my - 9} A 9,9 0 0,1 ${mx},${my + 9} Z`}
                      fill="#1e293b"
                    />
                    <circle
                      cx={mx}
                      cy={my}
                      r="12"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Schematic Presets */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setElongationDeg(0);
                setNodeOffsetDeg(0);
                setEarthMoonDistanceKm(365000);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 font-semibold"
            >
              {lang === 'pt-BR'
                ? 'Preset: Eclipse Solar Total (No Nó)'
                : 'Preset: Total Solar Eclipse (At Node)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setElongationDeg(0);
                setNodeOffsetDeg(0);
                setEarthMoonDistanceKm(404000);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-orange-500/20 border border-orange-400/50 text-orange-200 font-semibold"
            >
              {lang === 'pt-BR'
                ? 'Preset: Eclipse Solar Anular (Apogeu)'
                : 'Preset: Annular Solar Eclipse (Apogee)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setElongationDeg(180);
                setNodeOffsetDeg(180);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-200 font-semibold"
            >
              {lang === 'pt-BR'
                ? 'Preset: Eclipse Lunar Total (Na Umbra)'
                : 'Preset: Total Lunar Eclipse (In Umbra)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setElongationDeg(180);
                setNodeOffsetDeg(90);
                setInclinationDeg(5.145);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-200 font-semibold"
            >
              {lang === 'pt-BR'
                ? 'Preset: Lua Cheia Comum (Sem Eclipse)'
                : 'Preset: Ordinary Full Moon (No Eclipse)'}
            </button>
          </div>
        </div>

        {/* Right: View from Earth + Phase & Apparent Size Controls */}
        <div className="lg:col-span-5 space-y-3">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
                {lang === 'pt-BR'
                  ? '2. Visão Coordenada a partir da Terra'
                  : '2. Coordinated View as Seen from Earth'}
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 font-semibold">
                {getPhaseName()}
              </span>
            </div>

            {/* Phase Disk Renderer */}
            <div className="flex items-center justify-around py-3 bg-slate-950 rounded-xl border border-slate-800">
              <svg width="110" height="110" viewBox="-55 -55 110 110">
                <circle cx="0" cy="0" r="46" fill="#1e293b" />
                {(() => {
                  // Draw lit lunar limb based on elongationDeg
                  const cosE = Math.cos(rad);
                  const rx = Math.abs(cosE) * 46;
                  const sweepOuter = isWaxing ? 1 : 0;
                  const sweepInner =
                    (isWaxing && elongationDeg > 90) || (!isWaxing && elongationDeg < 270)
                      ? 1
                      : 0;
                  const pathD = `M 0,-46 A 46,46 0 0,${sweepOuter} 0,46 A ${rx},46 0 0,${sweepInner} 0,-46 Z`;
                  return (
                    <path
                      d={pathD}
                      fill={eclipseState === 'lunar_total' ? '#991b1b' : '#e2e8f0'}
                    />
                  );
                })()}
              </svg>

              <div className="space-y-1.5 tabular-nums">
                <div>
                  <div className="text-[10px] uppercase text-slate-400">
                    {lang === 'pt-BR' ? 'Fração Iluminada' : 'Illuminated Fraction'}
                  </div>
                  <div className="text-base font-bold text-white">
                    {formatNumber(illuminatedFraction * 100, lang, 1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">
                    {lang === 'pt-BR' ? 'Tendência do Ciclo' : 'Cycle Direction'}
                  </div>
                  <div className="text-xs font-semibold text-sky-300">
                    {isWaxing
                      ? lang === 'pt-BR'
                        ? 'Crescente (Waxing)'
                        : 'Waxing'
                      : lang === 'pt-BR'
                        ? 'Minguante (Waning)'
                        : 'Waning'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">
                    {lang === 'pt-BR' ? 'Tamanho Aparente Lua vs. Sol' : 'Apparent Size Moon vs. Sun'}
                  </div>
                  <div className="text-xs font-semibold text-amber-300">
                    {formatNumber(moonAngularDeg, lang, 3)}° vs. 0,533°
                  </div>
                </div>
              </div>
            </div>

            {/* Eclipse Status Banner */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="font-semibold text-white">
                {eclipseState === 'none'
                  ? lang === 'pt-BR'
                    ? `Sem Eclipse (Lua passa a ${formatNumber(
                        verticalAlignment,
                        lang,
                        2
                      )}° da linha de sombra)`
                    : `No Eclipse (Moon passes ${formatNumber(
                        verticalAlignment,
                        lang,
                        2
                      )}° off the shadow axis)`
                  : eclipseState === 'solar_total'
                    ? lang === 'pt-BR'
                      ? '🌑 Eclipse Solar Total (Umbra atinge a Terra)'
                      : '🌑 Total Solar Eclipse (Umbra reaches Earth)'
                    : eclipseState === 'solar_annular'
                      ? lang === 'pt-BR'
                        ? '💍 Eclipse Solar Anular (Lua menor que o disco solar)'
                        : '💍 Annular Solar Eclipse (Moon smaller than solar disk)'
                      : eclipseState === 'solar_partial'
                        ? lang === 'pt-BR'
                          ? '🌓 Eclipse Solar Parcial (Penumbra)'
                          : '🌓 Partial Solar Eclipse (Penumbra)'
                        : eclipseState === 'lunar_total'
                          ? lang === 'pt-BR'
                            ? '🌕 Eclipse Lunar Total (Lua dentro da Umbra terrestre)'
                            : '🌕 Total Lunar Eclipse (Moon inside Earth’s Umbra)'
                          : lang === 'pt-BR'
                            ? '🌖 Eclipse Lunar Parcial'
                            : '🌖 Partial Lunar Eclipse'}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between">
                  <label className="text-slate-300 font-medium">
                    {lang === 'pt-BR' ? 'Posição no Ciclo Lunar:' : 'Position in Lunar Cycle:'}
                  </label>
                  <span className="font-mono text-sky-300">{Math.round(elongationDeg)}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={elongationDeg}
                  onChange={(e) => setElongationDeg(Number(e.target.value))}
                  aria-label={lang === 'pt-BR' ? 'Elongação lunar' : 'Lunar elongation'}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="text-slate-300 font-medium">
                    {lang === 'pt-BR'
                      ? 'Inclinação do Plano Orbital Lunar:'
                      : 'Lunar Orbital Plane Inclination:'}
                  </label>
                  <span className="font-mono text-amber-300">
                    {formatNumber(inclinationDeg, lang, 2)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.05}
                  value={inclinationDeg}
                  onChange={(e) => setInclinationDeg(Number(e.target.value))}
                  aria-label={lang === 'pt-BR' ? 'Inclinação orbital lunar' : 'Lunar orbital inclination'}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="text-slate-300 font-medium">
                    {lang === 'pt-BR'
                      ? 'Distância Terra–Lua (Perigeu ↔ Apogeu):'
                      : 'Earth–Moon Distance (Perigee ↔ Apogee):'}
                  </label>
                  <span className="font-mono text-slate-200">
                    {formatNumber(earthMoonDistanceKm, lang, 0)} km
                  </span>
                </div>
                <input
                  type="range"
                  min={356500}
                  max={406700}
                  step={500}
                  value={earthMoonDistanceKm}
                  onChange={(e) => setEarthMoonDistanceKm(Number(e.target.value))}
                  aria-label={lang === 'pt-BR' ? 'Distância Terra-Lua em km' : 'Earth-Moon distance in km'}
                  className="w-full accent-indigo-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. GRAVITY, KEPLER & HYPOTHETICAL ORBIT SANDBOX (Section 34)
// ============================================================================
export const OrbitSandboxLaboratoryModal: React.FC<{
  preferences: UserPreferences;
  savedPresets: HypotheticalOrbitPreset[];
  onSavePreset: (preset: HypotheticalOrbitPreset) => void;
  onClose: () => void;
}> = ({ preferences, savedPresets, onSavePreset, onClose }) => {
  const lang = preferences.language;
  const [centralMassSolar, setCentralMassSolar] = useState<number>(1.0);
  const [semiMajorAxisAu, setSemiMajorAxisAu] = useState<number>(1.0);
  const [eccentricity, setEccentricity] = useState<number>(0.35);
  const [testMassKg, setTestMassKg] = useState<number>(100);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [meanAnomalyDeg, setMeanAnomalyDeg] = useState<number>(0);
  const [showEqualAreas, setShowEqualAreas] = useState<boolean>(true);
  const [gravityTargetId, setGravityTargetId] = useState<string>('jupiter');
  const [presetNameInput, setPresetNameInput] = useState<string>('');

  const sandboxResult = calculateTwoBodySandbox({
    centralMassSolar,
    semiMajorAxisAu,
    eccentricity,
    testMassKg,
  });

  const baselineEarthResult = calculateTwoBodySandbox({
    centralMassSolar: 1.0,
    semiMajorAxisAu: 1.0,
    eccentricity: 0.0167,
    testMassKg: 100,
  });

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setMeanAnomalyDeg((prev) => (prev + 2.5) % 360);
    }, 40);
    return () => clearInterval(id);
  }, [isRunning]);

  const gravBody = CATALOG_BY_ID[gravityTargetId] ?? CATALOG_BY_ID.earth;
  const gravCalc = calculateSphericalGravityAndWeight(
    gravBody.massKg ?? 5.972e24,
    gravBody.equatorialRadiusKm || gravBody.meanRadiusKm,
    testMassKg
  );

  return (
    <div
      role="dialog"
      aria-label={
        lang === 'pt-BR'
          ? 'Laboratório de Gravidade, Leis de Kepler e Órbita Hipotética'
          : 'Gravity, Kepler & Hypothetical Orbit Sandbox'
      }
      data-ui-overlay="true"
      className="w-full max-w-5xl mx-auto rounded-2xl bg-slate-950/95 border border-emerald-400/50 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden flex flex-col max-h-[84vh]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Orbit className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                {lang === 'pt-BR'
                  ? 'Sandbox de Dois Corpos: Gravidade, Kepler e Órbitas Hipotéticas'
                  : 'Two-Body Sandbox: Gravity, Kepler & Hypothetical Orbits'}
              </h2>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-[10px] font-bold uppercase">
                {lang === 'pt-BR' ? 'Modelo Hipotético Isolado' : 'Isolated Hypothetical Model'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Aproximação esférica de 2 corpos (T = 2π√(a³/GM), g = GM/r², W = mg). Não altera o catálogo real.'
                : 'Spherical 2-body approximation (T = 2π√(a³/GM), g = GM/r², W = mg). Never modifies the real catalog.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCentralMassSolar(1.0);
              setSemiMajorAxisAu(1.0);
              setEccentricity(0.0167);
              setTestMassKg(100);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'pt-BR' ? 'Linha de Base (Terra)' : 'Baseline (Earth)'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'pt-BR' ? 'Voltar à Cena' : 'Return to Scene'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
        {/* Left: Kepler Ellipse & Equal-Area Sweeps Diagram */}
        <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
              {lang === 'pt-BR'
                ? 'Órbita de Dois Corpos e 2ª Lei de Kepler (Áreas Iguais)'
                : 'Two-Body Orbit & Kepler’s 2nd Law (Equal Areas)'}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setIsRunning((v) => !v)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold flex items-center gap-1"
              >
                {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isRunning ? (lang === 'pt-BR' ? 'Pausar' : 'Pause') : lang === 'pt-BR' ? 'Executar' : 'Run'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEqualAreas((v) => !v)}
                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {lang === 'pt-BR' ? 'Setores de Área' : 'Area Sectors'}
              </button>
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 flex items-center justify-center">
            {(() => {
              const rx = 115;
              const ry = rx * Math.sqrt(Math.max(0.05, 1 - eccentricity * eccentricity));
              const cFocus = rx * eccentricity;
              // Solve simple eccentric anomaly for current meanAnomalyDeg
              const M = degToRad(meanAnomalyDeg);
              const E = M + eccentricity * Math.sin(M);
              const px = 190 + rx * Math.cos(E) - cFocus;
              const py = 115 - ry * Math.sin(E);

              return (
                <svg viewBox="0 0 380 230" className="w-full max-w-[380px] h-auto">
                  {/* Equal-Time Swept Area Wedges at Periapsis vs Apoapsis */}
                  {showEqualAreas && (
                    <>
                      <path
                        d={`M 190,115 L ${190 + rx - cFocus},115 A ${rx},${ry} 0 0,0 ${
                          190 + rx * Math.cos(0.45) - cFocus
                        },${115 - ry * Math.sin(0.45)} Z`}
                        fill="rgba(52, 211, 153, 0.22)"
                        stroke="#34d399"
                        strokeWidth="1"
                      />
                      <path
                        d={`M 190,115 L ${190 - rx - cFocus},115 A ${rx},${ry} 0 0,1 ${
                          190 + rx * Math.cos(Math.PI - 0.18) - cFocus
                        },${115 - ry * Math.sin(Math.PI - 0.18)} Z`}
                        fill="rgba(56, 189, 248, 0.22)"
                        stroke="#38bdf8"
                        strokeWidth="1"
                      />
                    </>
                  )}

                  {/* Orbit Ellipse centered at (190 - cFocus, 115) so central mass sits at focus (190, 115) */}
                  <ellipse
                    cx={190 - cFocus}
                    cy={115}
                    rx={rx}
                    ry={ry}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="1.8"
                  />

                  {/* Central Star at Focus (190, 115) */}
                  <circle cx="190" cy="115" r="11" fill="#fbbf24" />

                  {/* Periapsis & Apoapsis Markers */}
                  <circle cx={190 + rx - cFocus} cy={115} r="4" fill="#34d399" />
                  <text x={196 + rx - cFocus} y={118} fill="#34d399" fontSize="10">
                    q (Peri)
                  </text>
                  <circle cx={190 - rx - cFocus} cy={115} r="4" fill="#38bdf8" />
                  <text x={142 - rx - cFocus} y={118} fill="#38bdf8" fontSize="10">
                    Q (Apo)
                  </text>

                  {/* Orbiting Test Body */}
                  <line x1="190" y1="115" x2={px} y2={py} stroke="#94a3b8" strokeDasharray="2 2" />
                  <circle cx={px} cy={py} r="6.5" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
                </svg>
              );
            })()}
          </div>

          {/* Derived Orbital Quantities vs Baseline */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 tabular-nums">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">
                {lang === 'pt-BR' ? 'Período Derivado (T)' : 'Derived Period (T)'}
              </div>
              <div className="text-sm font-bold text-emerald-300 mt-0.5">
                {formatNumber(sandboxResult.orbitalPeriodDays, lang, 1)} d (
                {formatNumber(sandboxResult.orbitalPeriodYears, lang, 2)} a)
              </div>
              <div className="text-[10px] text-slate-400">
                Ref Terra: {formatNumber(baselineEarthResult.orbitalPeriodDays, lang, 1)} d
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">
                {lang === 'pt-BR' ? 'Periastro (q) / Apoastro (Q)' : 'Periapsis (q) / Apoapsis (Q)'}
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                {formatNumber(sandboxResult.periapsisAu, lang, 2)} /{' '}
                {formatNumber(sandboxResult.apoapsisAu, lang, 2)} UA
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">
                {lang === 'pt-BR' ? 'Velocidade (Peri / Apo)' : 'Speed (Peri / Apo)'}
              </div>
              <div className="text-sm font-bold text-sky-300 mt-0.5">
                {formatNumber(sandboxResult.periapsisVelocityKms, lang, 1)} /{' '}
                {formatNumber(sandboxResult.apoapsisVelocityKms, lang, 1)} km/s
              </div>
            </div>
          </div>
        </div>

        {/* Right: Independent Parameters + Gravity & Weight Tool */}
        <div className="lg:col-span-6 space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              {lang === 'pt-BR'
                ? 'Parâmetros Independentes de Entrada'
                : 'Independent Input Parameters'}
            </div>

            <div>
              <div className="flex justify-between">
                <label className="text-slate-300">
                  {lang === 'pt-BR' ? 'Massa Central (M):' : 'Central Mass (M):'}
                </label>
                <span className="font-mono text-amber-300 font-bold">
                  {formatNumber(centralMassSolar, lang, 2)} M☉
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={5.0}
                step={0.05}
                value={centralMassSolar}
                onChange={(e) => setCentralMassSolar(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between">
                <label className="text-slate-300">
                  {lang === 'pt-BR' ? 'Semieixo Maior (a):' : 'Semi-Major Axis (a):'}
                </label>
                <span className="font-mono text-sky-300 font-bold">
                  {formatNumber(semiMajorAxisAu, lang, 2)} UA
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={10.0}
                step={0.1}
                value={semiMajorAxisAu}
                onChange={(e) => setSemiMajorAxisAu(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>

            <div>
              <div className="flex justify-between">
                <label className="text-slate-300">
                  {lang === 'pt-BR'
                    ? 'Excentricidade Elíptica (0 ≤ e ≤ 0,92):'
                    : 'Elliptical Eccentricity (0 ≤ e ≤ 0.92):'}
                </label>
                <span className="font-mono text-emerald-300 font-bold">
                  {formatNumber(eccentricity, lang, 3)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.92}
                step={0.01}
                value={eccentricity}
                onChange={(e) => setEccentricity(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
              <p className="text-[10px] text-slate-400">
                {lang === 'pt-BR'
                  ? 'Nota: Este solucionador suporta órbitas elípticas ligadas (e < 1). Trajetórias parabólicas (e = 1) e hiperbólicas (e > 1) são desligadas e indisponíveis.'
                  : 'Note: This solver supports bound elliptical orbits (e < 1). Parabolic (e = 1) and hyperbolic (e > 1) trajectories are unbound and unavailable.'}
              </p>
            </div>

            {/* Save & Load Sandbox Presets */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5 items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {savedPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCentralMassSolar(p.centralMassSolar);
                      setSemiMajorAxisAu(p.semiMajorAxisAu);
                      setEccentricity(p.eccentricity);
                      setTestMassKg(p.testMassKg);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-emerald-500/20 border border-slate-800 text-[11px] text-slate-300"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name =
                    presetNameInput.trim() ||
                    `a=${semiMajorAxisAu}UA, e=${eccentricity}`;
                  onSavePreset({
                    id: `orb_${Date.now()}`,
                    name,
                    centralMassSolar,
                    semiMajorAxisAu,
                    eccentricity,
                    testMassKg,
                  });
                  setPresetNameInput('');
                }}
                className="flex gap-1"
              >
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder={lang === 'pt-BR' ? 'Salvar preset...' : 'Save preset...'}
                  className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-[11px] w-32"
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-[11px]"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Gravity & Weight Comparison Tool (g = GM/r^2, W = mg) */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                {lang === 'pt-BR'
                  ? 'Comparador de Massa (kg) vs. Peso (N = mg)'
                  : 'Mass (kg) vs. Weight (N = mg) Comparator'}
              </span>
              <select
                value={gravityTargetId}
                onChange={(e) => setGravityTargetId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              >
                {['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
                  (id) => (
                    <option key={id} value={id}>
                      {CATALOG_BY_ID[id]?.name[lang]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-slate-300">
                {lang === 'pt-BR' ? 'Massa do Objeto de Teste (m):' : 'Test Object Mass (m):'}
              </label>
              <input
                type="number"
                min={1}
                max={100000}
                value={testMassKg}
                onChange={(e) => setTestMassKg(Math.max(1, Number(e.target.value) || 100))}
                className="w-24 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-right"
              />
              <span className="text-slate-400">kg</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {lang === 'pt-BR' ? 'Massa Invariante' : 'Invariant Mass'}
                </div>
                <div className="text-sm font-bold text-white">
                  {formatNumber(testMassKg, lang, 1)} kg
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">g = GM/r²</div>
                <div className="text-sm font-bold text-sky-300">
                  {formatNumber(gravCalc.gravityMs2, lang, 2)} m/s²
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {lang === 'pt-BR' ? 'Peso (W = mg)' : 'Weight (W = mg)'}
                </div>
                <div className="text-sm font-bold text-amber-300">
                  {formatNumber(gravCalc.weightNewtons, lang, 1)} N
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400">
              {lang === 'pt-BR'
                ? 'Nota: Na aproximação de massa de teste desprezível (m ≪ M), alterar a massa m altera o peso W = mg em newtons, mas NÃO altera a aceleração orbital nem o período T. Achatamento, rotação e forças atmosféricas são omitidos.'
                : 'Note: In the negligible-test-mass approximation (m ≪ M), changing m changes weight W = mg in newtons, but does NOT change orbital acceleration or period T. Oblateness, rotation, and atmospheric forces are omitted.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. OUTER SYSTEM CONTEXT & BEYOND NEPTUNE DISTANCE JOURNEY (Section 35)
// ============================================================================
export const BeyondNeptuneModal: React.FC<{
  preferences: UserPreferences;
  onSelectBodyAndClose: (bodyId: string) => void;
  onClose: () => void;
}> = ({ preferences, onSelectBodyAndClose, onClose }) => {
  const lang = preferences.language;
  const [stageIndex, setStageIndex] = useState<number>(0);
  const [originRef, setOriginRef] = useState<'sun' | 'earth'>('sun');

  const stages = [
    {
      id: 'inner_and_giants',
      rangeAu: '0,39 – 30,1 UA',
      representativeAu: 30.07,
      scaleType: { 'pt-BR': 'Escala Linear (0–35 UA)', en: 'Linear Scale (0–35 AU)' },
      title: {
        'pt-BR': 'Etapa 1: O Domínio Planetário (Mercúrio a Netuno)',
        en: 'Stage 1: The Planetary Domain (Mercury to Neptune)',
      },
      description: {
        'pt-BR':
          'Todos os oito planetas principais orbitam dentro de apenas 30,1 UA do Sol (~4,1 horas-luz). Embora pareça imenso, esse domínio representa uma fração minúscula da vizinhança gravitacional solar.',
        en: 'All eight major planets orbit within just 30.1 AU of the Sun (~4.1 light-hours). Though vast, this planetary domain occupies only a tiny fraction of the Sun’s gravitational neighborhood.',
      },
      linkedBodyId: 'neptune',
    },
    {
      id: 'kuiper_belt_stage',
      rangeAu: '30 – 50 UA',
      representativeAu: 39.48,
      scaleType: { 'pt-BR': 'Escala Linear Regional (30–55 UA)', en: 'Regional Linear Scale (30–55 AU)' },
      title: {
        'pt-BR': 'Etapa 2: O Cinturão de Kuiper e os Planetas Anões',
        en: 'Stage 2: The Kuiper Belt & Dwarf Planets',
      },
      description: {
        'pt-BR':
          'Logo além de Netuno estende-se o Cinturão de Kuiper (30 a 50 UA), um disco gelado que abriga o sistema binário Plutão–Caronte (39,5 UA), Haumea (43,1 UA), Makemake (45,4 UA) e objetos primordiais como Arrokoth.',
        en: 'Just beyond Neptune lies the Kuiper Belt (30 to 50 AU), an icy circumstellar disc hosting the Pluto–Charon binary pair (39.5 AU), Haumea (43.1 AU), Makemake (45.4 AU), and primordial planetesimals like Arrokoth.',
      },
      linkedBodyId: 'pluto',
    },
    {
      id: 'scattered_disc_heliopause',
      rangeAu: '50 – 165+ UA',
      representativeAu: 121.0,
      scaleType: { 'pt-BR': 'Escala Logarítmica (10¹ – 10³ UA)', en: 'Logarithmic Scale (10¹ – 10³ AU)' },
      title: {
        'pt-BR': 'Etapa 3: Disco Disperso, Éris e a Heliopausa',
        en: 'Stage 3: Scattered Disc, Eris & the Heliopause',
      },
      description: {
        'pt-BR':
          'O planeta anão Éris percorre uma órbita excêntrica que chega a ~97 UA. A cerca de 120 UA situa-se a Heliopausa — a fronteira magnética onde o vento solar encontra o meio interestelar, cruzada pelas sondas Voyager 1 e 2. Porém, a gravidade do Sol vai muito além!',
        en: 'Dwarf planet Eris follows an eccentric orbit reaching ~97 AU. Around 120 AU lies the Heliopause — the magnetic boundary where the solar wind meets the interstellar medium, crossed by Voyagers 1 and 2. Yet solar gravity reaches much farther!',
      },
      linkedBodyId: 'eris',
    },
    {
      id: 'oort_cloud_stage',
      rangeAu: '2.000 – 100.000 UA',
      representativeAu: 25000,
      scaleType: {
        'pt-BR': 'Região Esquemática Logarítmica (10⁰ – 10⁵ UA)',
        en: 'Logarithmic Schematic Region (10⁰ – 10⁵ AU)',
      },
      title: {
        'pt-BR': 'Etapa 4: A Nuvem de Oort (~2.000 a ~100.000 UA)',
        en: 'Stage 4: The Oort Cloud (~2,000 to ~100,000 AU)',
      },
      description: {
        'pt-BR':
          'Não existe uma única "parede dura" marcando o fim do Sistema Solar: enquanto a heliopausa (~120 UA) é a fronteira do vento solar, a Nuvem de Oort é uma vasta região esférica conceitual que se estende até ~100.000 UA (~1,58 ano-luz), onde cometas de longo período permanecem ligados gravitacionalmente ao Sol.',
        en: 'There is no single hard wall marking the edge of the Solar System: while the heliopause (~120 AU) bounds the solar wind, the Oort Cloud is a vast conceptual spherical region extending to ~100,000 AU (~1.58 light-years), where long-period comets remain gravitationally bound to the Sun.',
      },
      linkedBodyId: 'oort_cloud',
    },
  ];

  const curStage = stages[stageIndex];
  const distAuFromOrigin =
    originRef === 'sun'
      ? curStage.representativeAu
      : Math.abs(curStage.representativeAu - 1.0);
  const lightTimeSec = (distAuFromOrigin * AU_IN_KM) / SPEED_OF_LIGHT_KMS;

  return (
    <div
      role="dialog"
      aria-label={
        lang === 'pt-BR'
          ? 'Jornada de Distância Além de Netuno'
          : 'Beyond Neptune Distance Journey'
      }
      data-ui-overlay="true"
      className="w-full max-w-4xl mx-auto rounded-2xl bg-slate-950/95 border border-purple-400/50 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden flex flex-col max-h-[84vh]"
    >
      {/* Header with Persistent Return to Planets Action */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              {lang === 'pt-BR'
                ? 'Além de Netuno: Cinturão de Kuiper, Heliopausa e Nuvem de Oort'
                : 'Beyond Neptune: Kuiper Belt, Heliopause & Oort Cloud'}
            </h2>
            <p className="text-[11px] text-purple-300 font-semibold">
              {curStage.scaleType[lang]}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {lang === 'pt-BR' ? 'Voltar aos Planetas' : 'Return to the Planets'}
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Stepper Milestones */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stages.map((st, idx) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStageIndex(idx)}
              className={`p-2.5 rounded-xl border text-left transition ${
                stageIndex === idx
                  ? 'bg-purple-500/25 border-purple-400 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] font-mono text-purple-300">{st.rangeAu}</div>
              <div className="font-bold truncate mt-0.5">{st.title[lang]}</div>
            </button>
          ))}
        </div>

        {/* Logarithmic Order-of-Magnitude Ruler (1 AU to 100,000 AU) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-200">
              {lang === 'pt-BR'
                ? 'Régua Logarítmica de Ordens de Grandeza (1 UA → 100.000 UA)'
                : 'Logarithmic Order-of-Magnitude Ruler (1 AU → 100,000 AU)'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {lang === 'pt-BR' ? 'Origem de Referência:' : 'Reference Origin:'}
              </span>
              <button
                type="button"
                onClick={() => setOriginRef(originRef === 'sun' ? 'earth' : 'sun')}
                className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 font-semibold"
              >
                {originRef === 'sun'
                  ? lang === 'pt-BR'
                    ? 'Sol (0 UA)'
                    : 'Sun (0 AU)'
                  : lang === 'pt-BR'
                    ? 'Terra (1 UA)'
                    : 'Earth (1 AU)'}
              </button>
            </div>
          </div>

          <div className="relative h-20 bg-slate-950 rounded-xl border border-slate-800 px-6 flex items-center">
            <div className="w-full h-2 bg-slate-800 rounded-full relative">
              {[
                { au: 1, label: 'Terra (1 UA)' },
                { au: 30, label: 'Netuno (30 UA)' },
                { au: 50, label: 'Kuiper (50 UA)' },
                { au: 120, label: 'Heliopausa (~120 UA)' },
                { au: 2000, label: 'Oort Int. (2.000 UA)' },
                { au: 100000, label: 'Oort Ext. (100.000 UA)' },
              ].map((m, i) => {
                const pct = (Math.log10(m.au) / 5) * 100;
                return (
                  <div
                    key={m.au}
                    style={{ left: `${pct}%` }}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <div className="w-3 h-3 rounded-full bg-purple-400 border border-white" />
                    <span
                      className={`absolute ${
                        i % 2 === 0 ? '-top-7' : 'top-4'
                      } left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-300 font-mono`}
                    >
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Stage Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h3 className="text-base font-bold text-white">{curStage.title[lang]}</h3>
          <p className="text-slate-200 leading-relaxed text-[13px]">
            {curStage.description[lang]}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 tabular-nums">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">
                {lang === 'pt-BR' ? 'Distância de Referência' : 'Reference Distance'}
              </div>
              <div className="text-sm font-bold text-purple-300">
                ~{formatNumber(distAuFromOrigin, lang, 1)} UA
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400">
                {lang === 'pt-BR' ? 'Tempo de Viagem da Luz' : 'Light-Travel Time'}
              </div>
              <div className="text-sm font-bold text-amber-300">
                {formatLightTime(lightTimeSec, lang)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
              <button
                type="button"
                onClick={() => onSelectBodyAndClose(curStage.linkedBodyId)}
                className="w-full py-1.5 rounded-lg bg-purple-500/25 hover:bg-purple-500/35 border border-purple-400/50 text-purple-200 font-semibold"
              >
                {lang === 'pt-BR'
                  ? `Inspecionar ${CATALOG_BY_ID[curStage.linkedBodyId]?.name[lang]} na Cena`
                  : `Inspect ${CATALOG_BY_ID[curStage.linkedBodyId]?.name[lang]} in Scene`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
