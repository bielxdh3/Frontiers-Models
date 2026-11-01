import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const archive = resolve(root, 'assets');
const orbitarium = JSON.parse(readFileSync(resolve(root, 'benchmarks/solar-system/RUNS.json'), 'utf8'));
const racing = JSON.parse(readFileSync(resolve(root, 'benchmarks/racing/RUNS.json'), 'utf8'));

const orbitById = new Map(orbitarium.runs.map(run => [run.id, run]));
const orbitRuns = orbitarium.current_arena.map(id => {
  const run = orbitById.get(id);
  if (!run) throw new Error('Missing Orbitarium reference: ' + id);
  return run;
});
const racingRuns = racing.runs;
if (orbitRuns.length !== 5 || new Set(orbitRuns.map(run => run.id)).size !== 5 ||
    !orbitRuns.some(run => run.model === 'Gemini 4 Argon') ||
    orbitRuns.some(run => run.model === 'Gemini 3.8 Flash') ||
    racingRuns.length !== 3 || new Set(racingRuns.map(run => run.id)).size !== 3 ||
    racingRuns[0].model !== 'GPT-6.1 Sol' ||
    racingRuns[1].model !== 'Gemini 3.8 Flash' ||
    racingRuns[2].model !== 'GPT-6 Astra' ||
    [...orbitRuns, ...racingRuns].some(run => !run.live_url?.startsWith('https://'))) {
  throw new Error('Hero expects 3 Racing runs and 5 current Orbitarium references with websites');
}

const escape = value => String(value).replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;').replaceAll('"', '&quot;');

function badge({ run, x, y, width, accent, benchmark }) {
  return `<g data-role="run" data-benchmark="${benchmark}" data-model="${escape(run.id)}">
    <rect x="${x}" y="${y}" width="${width}" height="56" rx="11" fill="#0e2034" stroke="#25415d"/>
    <rect x="${x + 1}" y="${y + 1}" width="4" height="54" rx="2" fill="${accent}"/>
    <circle cx="${x + 20}" cy="${y + 28}" r="4" fill="${accent}"/>
    <text x="${x + 36}" y="${y + 34}" font-size="18" font-weight="650" fill="#eef6ff">${escape(run.model)}</text>
  </g>`;
}

const racingBadges = racingRuns.map((run, i) =>
  badge({ run, x: 650 + i * 239, y: 173, width: 225, accent: ['#ffbb73', '#80e9f2', '#bda3ff'][i], benchmark: 'racing' })
).join('\n    ');
const orbitBadges = orbitRuns.map((run, i) =>
  badge({ run, x: i < 3 ? 650 + i * 239 : 769.5 + (i - 3) * 239, y: i < 3 ? 390 : 452,
    width: 225, accent: ['#facc6b', '#aaa7ff', '#d2a2ff', '#72dfbd', '#83caff'][i], benchmark: 'orbitarium' })
).join('\n    ');

const hero = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 560" role="img" aria-labelledby="title desc">
  <title id="title">Frontier Models — Racing and Orbitarium benchmark collection</title>
  <desc id="desc">Two independent benchmarks, eight current projects. Racing: ${escape(racingRuns.map(run => run.model).join(', '))}. Orbitarium current: ${escape(orbitRuns.map(run => run.model).join(', '))}. Historical and non-frontier runs remain available in the repository archive, not in this banner.</desc>
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#080f1d"/>
      <stop offset=".52" stop-color="#0b1726"/>
      <stop offset="1" stop-color="#101e35"/>
    </linearGradient>
    <linearGradient id="race" x1="0" y1="0" x2="1" y2=".35">
      <stop stop-color="#302337"/>
      <stop offset=".57" stop-color="#222235"/>
      <stop offset="1" stop-color="#142737"/>
    </linearGradient>
    <linearGradient id="orbit" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#17283b"/>
      <stop offset="1" stop-color="#14243a"/>
    </linearGradient>
    <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#ffb76b"/>
      <stop offset="1" stop-color="#80e9f2"/>
    </linearGradient>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M36 0H0V36" fill="none" stroke="#4b6386" stroke-opacity=".12" stroke-width=".8"/>
    </pattern>
    <clipPath id="canvas"><rect width="1440" height="560" rx="30"/></clipPath>
  </defs>
  <g clip-path="url(#canvas)" font-family="Inter,Segoe UI,Arial,sans-serif">
    <rect width="1440" height="560" fill="url(#base)"/>
    <rect width="1440" height="560" fill="url(#grid)"/>
    <path d="M0 0H12V560H0Z" fill="url(#rail)"/>
    <path d="M42 37H555" stroke="#33445b" stroke-width="1"/>
    <g opacity=".34" stroke="#50708f" stroke-width="1" fill="none">
      <path d="M0 485L585 -100M0 560L605 -45M115 560L675 0"/>
      <path d="M0 505H585M0 540H585"/>
    </g>
    <text x="66" y="220" font-size="88" font-weight="800" letter-spacing="-4" fill="#f1f6fd">FRONTIER</text>
    <text x="66" y="313" font-size="88" font-weight="800" letter-spacing="-4" fill="#f1f6fd">MODELS</text>
    <rect x="73" y="345" width="108" height="5" rx="2.5" fill="#ffb76b"/>
    <rect x="181" y="345" width="116" height="5" rx="2.5" fill="#85e4eb"/>
    <g data-benchmark="racing">
      <rect x="613" y="51" width="775" height="215" rx="22" fill="url(#race)" stroke="#7d5565" stroke-opacity=".8"/>
      <path d="M649 67H929" stroke="#fdaf6d" stroke-width="3" stroke-linecap="round"/>
      <g stroke="#ec9b70" fill="none" stroke-linecap="round" opacity=".27">
        <path d="M1050 88h283M1135 99h199M1224 111h111" stroke-width="2"/>
        <path d="M1000 143l29 -25 40 19 22 -17 46 19 32 -20 65 25 46 -20 46 20" stroke-width="1.4"/>
      </g>
      <text x="649" y="137" font-size="38" font-weight="800" fill="#fff5ed">Racing-bench</text>
      ${racingBadges}
    </g>
    <g data-benchmark="orbitarium">
      <rect x="613" y="280" width="775" height="250" rx="22" fill="url(#orbit)" stroke="#3e617f" stroke-opacity=".8"/>
      <path d="M649 297H929" stroke="#83caff" stroke-width="3" stroke-linecap="round"/>
      <g opacity=".25" fill="none" stroke="#8eb6f0" stroke-width="1.2">
        <path d="M1162 307l22 24 42 -10 26 28 39 -15 38 19"/>
        <path d="M1204 318l-12 34 46 21 31 -24"/>
        <circle cx="1184" cy="331" r="3" fill="#9fc9ff"/>
        <circle cx="1226" cy="321" r="3" fill="#9fc9ff"/>
        <circle cx="1252" cy="349" r="3" fill="#9fc9ff"/>
        <circle cx="1291" cy="334" r="3" fill="#9fc9ff"/>
      </g>
      <text x="649" y="362" font-size="38" font-weight="800" fill="#f0f8ff">Orbitarium-bench</text>
      ${orbitBadges}
    </g>
  </g>
</svg>
`;
writeFileSync(resolve(archive, 'frontier-models-hero-v7.svg'), hero);
console.log(`Rendered Frontier Models collection hero: Racing ${racingRuns.length} + Orbitarium ${orbitRuns.length}.`);
