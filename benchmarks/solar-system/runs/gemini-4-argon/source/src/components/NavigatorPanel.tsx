import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  Heart,
  CheckCircle2,
  ArrowUpDown,
  Command,
  X,
  Compass,
  Clock,
} from 'lucide-react';
import {
  BodyCategory,
  CelestialBodyData,
  Language,
  UserPreferences,
} from '../types/solarSystem';
import {
  CELESTIAL_CATALOG,
  LOCAL_SYSTEM_PRESETS,
  searchCatalog,
} from '../data/celestialCatalog';
import { formatDiameter, formatDistanceAuAndKm } from '../utils/formatters';

interface NavigatorPanelProps {
  selectedBodyId: string;
  favorites: string[];
  visitedBodies: string[];
  recentBodies: string[];
  preferences: UserPreferences;
  onSelectBody: (bodyId: string, initiateFocus?: boolean) => void;
  onSelectLocalPreset: (parentId: string, focusId: string) => void;
  onOpenCommandPalette: () => void;
  onCloseMobileDrawer?: () => void;
}

const CATEGORY_LABELS: Record<BodyCategory | 'all' | 'favorites' | 'recent', Record<Language, string>> = {
  all: { 'pt-BR': 'Todos', en: 'All' },
  favorites: { 'pt-BR': 'Favoritos', en: 'Favorites' },
  recent: { 'pt-BR': 'Recentes', en: 'Recent' },
  star: { 'pt-BR': 'Estrela', en: 'Star' },
  planet: { 'pt-BR': 'Planetas', en: 'Planets' },
  moon: { 'pt-BR': 'Luas', en: 'Moons' },
  dwarf_planet: { 'pt-BR': 'Planetas Anões', en: 'Dwarf Planets' },
  small_body: { 'pt-BR': 'Pequenos Corpos', en: 'Small Bodies' },
  region: { 'pt-BR': 'Regiões', en: 'Regions' },
};

export const NavigatorPanel: React.FC<NavigatorPanelProps> = ({
  selectedBodyId,
  favorites,
  visitedBodies,
  recentBodies,
  preferences,
  onSelectBody,
  onSelectLocalPreset,
  onOpenCommandPalette,
  onCloseMobileDrawer,
}) => {
  const lang = preferences.language;
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    BodyCategory | 'all' | 'favorites' | 'recent'
  >('all');
  const [sortBy, setSortBy] = useState<'default' | 'diameter' | 'distance'>('default');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const filteredBodies = useMemo(() => {
    let list: CelestialBodyData[];
    if (activeFilter === 'favorites') {
      list = searchCatalog(query, 'all').filter((b) => favorites.includes(b.id));
    } else if (activeFilter === 'recent') {
      list = recentBodies
        .map((id) => CELESTIAL_CATALOG.find((b) => b.id === id))
        .filter((b): b is CelestialBodyData => Boolean(b))
        .filter((b) =>
          query ? searchCatalog(query, 'all').some((m) => m.id === b.id) : true
        );
    } else {
      list = searchCatalog(query, activeFilter);
    }

    if (sortBy === 'diameter') {
      return [...list].sort((a, b) => b.diameterKm - a.diameterKm);
    }
    if (sortBy === 'distance') {
      return [...list].sort(
        (a, b) => (a.semiMajorAxisAu ?? 0) - (b.semiMajorAxisAu ?? 0)
      );
    }
    return list;
  }, [query, activeFilter, sortBy, favorites, recentBodies]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredBodies.length > 0 ? (prev + 1) % filteredBodies.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredBodies.length > 0
          ? (prev - 1 + filteredBodies.length) % filteredBodies.length
          : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredBodies[highlightedIndex] ?? filteredBodies[0];
      if (target) {
        onSelectBody(target.id, true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
      } else if (onCloseMobileDrawer) {
        onCloseMobileDrawer();
      }
    }
  };

  return (
    <nav
      aria-label={lang === 'pt-BR' ? 'Navegador de Corpos Celestes' : 'Celestial Object Navigator'}
      style={{ backgroundColor: `rgba(9, 14, 28, ${preferences.panelOpacity})` }}
      className="flex flex-col w-full h-full rounded-2xl border border-slate-700/70 backdrop-blur-md text-slate-100 shadow-2xl overflow-hidden"
    >
      {/* Top Header & Search Input */}
      <div className="p-3 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {lang === 'pt-BR' ? 'Catálogo Celeste' : 'Celestial Catalog'}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title={
                lang === 'pt-BR'
                  ? 'Abrir Paleta de Comandos Rápidos (Ctrl+K)'
                  : 'Open Quick Command Palette (Ctrl+K)'
              }
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[11px] text-sky-300 font-medium transition"
            >
              <Command className="w-3 h-3" />
              <span>{lang === 'pt-BR' ? 'Comandos' : 'Commands'}</span>
            </button>

            {onCloseMobileDrawer && (
              <button
                type="button"
                onClick={onCloseMobileDrawer}
                aria-label={lang === 'pt-BR' ? 'Fechar catálogo' : 'Close catalog'}
                className="p-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              lang === 'pt-BR'
                ? 'Buscar planeta, lua, planeta anão...'
                : 'Search planet, moon, dwarf planet...'
            }
            aria-label={
              lang === 'pt-BR' ? 'Buscar objeto celeste' : 'Search celestial object'
            }
            className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={lang === 'pt-BR' ? 'Limpar busca' : 'Clear search'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {(
            [
              'all',
              'planet',
              'moon',
              'dwarf_planet',
              'small_body',
              'region',
              'favorites',
              'recent',
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveFilter(cat);
                setHighlightedIndex(0);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition ${
                activeFilter === cat
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {CATEGORY_LABELS[cat][lang]}
            </button>
          ))}
        </div>

        {/* Sort Control with Named Physical Quantity (Section 24) */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5">
          <span className="flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" />
            <span>{lang === 'pt-BR' ? 'Ordenar por:' : 'Sort by:'}</span>
          </span>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'default' | 'diameter' | 'distance')
            }
            aria-label={lang === 'pt-BR' ? 'Critério de ordenação física' : 'Physical sort criterion'}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-sky-400"
          >
            <option value="default">
              {lang === 'pt-BR' ? 'Hierarquia do Sistema' : 'System Hierarchy'}
            </option>
            <option value="distance">
              {lang === 'pt-BR' ? 'Semieixo Maior Orbital (UA)' : 'Semi-Major Axis (AU)'}
            </option>
            <option value="diameter">
              {lang === 'pt-BR' ? 'Diâmetro Volumétrico (km)' : 'Mean Diameter (km)'}
            </option>
          </select>
        </div>
      </div>

      {/* Curated Local System Presets (Section 11) */}
      <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800/80">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          {lang === 'pt-BR' ? 'Sistemas Locais Rápidos' : 'Local System Presets'}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {LOCAL_SYSTEM_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectLocalPreset(preset.parentId, preset.focusId)}
              className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-sky-500/20 border border-slate-700/70 hover:border-sky-400/50 text-left text-[11px] text-slate-200 truncate transition"
              title={preset.description[lang]}
            >
              {preset.label[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1" role="listbox">
        {filteredBodies.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-xs text-slate-400">
              {lang === 'pt-BR'
                ? 'Nenhum corpo celeste encontrado para os filtros atuais.'
                : 'No celestial object matches the current search or filter.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveFilter('all');
              }}
              className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-200 text-xs font-medium hover:bg-sky-500/30"
            >
              {lang === 'pt-BR' ? 'Limpar Busca e Filtros' : 'Reset Search & Filters'}
            </button>
          </div>
        ) : (
          filteredBodies.map((body, idx) => {
            const isSelected = body.id === selectedBodyId;
            const isVisited = visitedBodies.includes(body.id);
            const isFav = favorites.includes(body.id);
            const isHighlighted = idx === highlightedIndex && Boolean(query);

            return (
              <div
                key={body.id}
                role="option"
                aria-selected={isSelected}
                className={`group flex items-center justify-between gap-2 p-2 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/20 border-sky-400/80 text-white'
                    : isHighlighted
                      ? 'bg-slate-800/90 border-sky-500/40 text-slate-100'
                      : 'bg-slate-900/50 border-slate-800/60 hover:bg-slate-800/70 text-slate-200'
                }`}
                data-testid={`nav-body-${body.id}`}
                onClick={() => onSelectBody(body.id, true)}
                onDoubleClick={() => onSelectBody(body.id, true)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 border border-white/20"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${body.visual.accentColor}, ${body.visual.primaryColor} 65%, ${body.visual.secondaryColor})`,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">
                        {body.name[lang]}
                      </span>
                      {isFav && (
                        <Heart
                          className="w-3 h-3 text-amber-400 shrink-0"
                          fill="currentColor"
                        />
                      )}
                      {isVisited && (
                        <span title={lang === 'pt-BR' ? 'Visitado' : 'Visited'}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400/80 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate tabular-nums">
                      {body.subtype[lang]}
                      {body.semiMajorAxisAu && body.category !== 'moon'
                        ? ` • ${formatDistanceAuAndKm(body.semiMajorAxisAu, null, lang)}`
                        : body.diameterKm && body.diameterDefinition !== 'region_extent'
                          ? ` • ${formatDiameter(body.diameterKm, lang, 'metric')}`
                          : ''}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBody(body.id, true);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 group-hover:bg-sky-500 group-hover:text-slate-950 text-[10px] font-semibold text-slate-300 transition shrink-0"
                >
                  {lang === 'pt-BR' ? 'Focar' : 'Focus'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
};
