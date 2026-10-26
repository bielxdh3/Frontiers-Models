import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = resolve(root, 'assets');
const registry = JSON.parse(readFileSync(resolve(root, 'benchmarks/solar-system/RUNS.json'), 'utf8'));
const byId = new Map(registry.runs.map(run => [run.id, run]));
const arena = registry.current_arena.map(id => {
  const run = byId.get(id);
  if (!run) throw new Error(`Missing arena ID: ${id}`);
  return run;
});
if (arena.length !== 5 || !arena.some(run => run.model === 'GPT-6.1 Sol') ||
    !arena.some(run => run.model === 'Gemini 4 Argon') ||
    arena.some(run => run.model === 'Gemini 3.8 Flash')) {
  throw new Error('Expected five current references including Gemini 4 Argon and excluding archived Gemini 3.8 Flash');
}
const escaped = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const colors = ['#fbbf24', '#93c5fd', '#c084fc', '#34d399', '#38bdf8'];
const fillColors = ['#382a14', '#151a45', '#251447', '#152d35', '#132840'];
const cards = arena.map((run, i) => {
  // The final two cards form a centered second row beneath the first three.
  const x = 76 + (i % 3) * 225 + (i >= 3 ? 112.5 : 0);
  const y = 276 + Math.floor(i / 3) * 86;
  return `
    <g transform="translate(${x} ${y})">
      <rect width="211" height="71" rx="13" fill="${fillColors[i]}" stroke="${colors[i]}" stroke-opacity=".78"/>
      <text x="17" y="25" font-size="12" fill="${colors[i]}" letter-spacing=".6">CURRENT REFERENCE</text>
      <text x="17" y="51" font-size="18" font-weight="700" fill="#f8fafc">${escaped(run.model)}</text>
    </g>`;
}).join('');
// The five models have five nested, concentric orbits. Each marker is computed
// from its own ellipse rather than positioned with hand-picked coordinates.
// All five ellipses fit inside the right-hand illustration area (x 970..1400);
// a shared tilt keeps the sun, rings and markers visually aligned.
const orbitCenter = { x: 1187, y: 251 };
const orbitTilt = -15;
const orbitSpecs = [
  { rx: 112, ry: 48, phase: 215 },
  { rx: 130, ry: 59, phase: 307 },
  { rx: 148, ry: 70, phase: 5 },
  { rx: 166, ry: 81, phase: 125 },
  { rx: 185, ry: 92, phase: 72 }
];
const toRad = degrees => degrees * Math.PI / 180;
const tilt = toRad(orbitTilt);
const fmt = number => Number(number.toFixed(3));
const orbitGeometry = arena.map((run, i) => {
  const { rx, ry, phase } = orbitSpecs[i];
  const ex = rx * Math.cos(toRad(phase));
  const ey = ry * Math.sin(toRad(phase));
  const x = fmt(orbitCenter.x + ex * Math.cos(tilt) - ey * Math.sin(tilt));
  const y = fmt(orbitCenter.y + ex * Math.sin(tilt) + ey * Math.cos(tilt));
  return { run, color: colors[i], rx, ry, x, y };
});
const orbitRings = orbitGeometry.map(({ run, color, rx, ry }) =>
  `<ellipse data-role="orbit" data-model="${escaped(run.id)}" cx="${orbitCenter.x}" cy="${orbitCenter.y}" rx="${rx}" ry="${ry}" transform="rotate(${orbitTilt} ${orbitCenter.x} ${orbitCenter.y})" fill="none" stroke="${color}" stroke-opacity=".54" stroke-width="1.6"/>`
).join('\n    ');
const markers = orbitGeometry.map(({ run, color, x, y }) =>
  `<circle data-role="planet" data-model="${escaped(run.id)}" cx="${x}" cy="${y}" r="7.5" fill="${color}" stroke="#f8fafc" stroke-width="1.3"/>`
).join('\n    ');
const hero = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 520" role="img" aria-labelledby="title desc">
  <title id="title">Frontier Models — five current references</title>
  <desc id="desc">${escaped(arena.map(x => x.model).join(', '))}. These are archived projects, not all scored or prompt-equivalent.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070b1b"/><stop offset=".55" stop-color="#11133b"/><stop offset="1" stop-color="#061d2e"/></linearGradient>
    <radialGradient id="sun"><stop stop-color="#fff5bd"/><stop offset=".45" stop-color="#ffb84d"/><stop offset="1" stop-color="#ff6b3d" stop-opacity=".14"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1440" height="520" rx="34" fill="url(#bg)"/>
  <g>${orbitRings}</g>
  <circle data-role="sun-glow" cx="${orbitCenter.x}" cy="${orbitCenter.y}" r="44" fill="url(#sun)" filter="url(#glow)"/>
  <circle data-role="sun" cx="${orbitCenter.x}" cy="${orbitCenter.y}" r="10" fill="#fff7c2"/>
  <g>${markers}</g>
  <g font-family="Inter,Segoe UI,Arial,sans-serif">
    <text x="76" y="92" font-size="18" letter-spacing="4" fill="#67e8f9">BENCHMARK ARCHIVE · SOLAR SYSTEM</text>
    <text x="72" y="166" font-size="64" font-weight="800" fill="#f8fafc">FRONTIER MODELS</text>
    <text x="76" y="212" font-size="22" fill="#b9c6e4">Inspectable projects · pinned sources · explicit evidence</text>
    ${cards}
    <text x="76" y="478" font-size="15" fill="#91a4c8">Five current references · scores pending where not independently evaluated</text>
  </g>
</svg>
`;
writeFileSync(resolve(base, 'frontier-models-hero-v7.svg'), hero.replace(/^[ \t]+$/gm, ''));

// Existing numeric results are copied from SCORECARD.md; unscored models
// render dashed placeholders and never receive manufactured zeroes.
const rows = [
  ['gpt-6-astra-max-frontier-v2', 'Astra', 'GPT-6', 95.25, '#7c3aed', 'scored'],
  ['fable-5.1-frontier-v2', 'Fable 5.1', '', 93.30, '#f97316', 'scored'],
  ['gpt-5.6-sun-max-frontier-v2', 'Sun V2', 'GPT-5.6', 71.20, '#eab308', 'outdated'],
  ['grok-4.6-frontier-v2', 'Grok 4.6', '', 33.80, '#1f2937', 'archived'],
  ['gpt-6.1-sol-source', 'Sol', 'GPT-6.1', null, '#d97706', 'pending'],
  ['grok-4.7-solar-source', 'Grok 4.7', 'Solar', null, '#9333ea', 'pending'],
  ['gemini-4-argon-source', 'Gemini 4', 'Argon', null, '#2563eb', 'pending'],
  ['gemini-3.8-flash-high-frontier-v2', 'Gemini 3.8', 'Flash', null, '#94a3b8', 'archived'],
  ['gpt-5.6-luna-max-orbitario', 'Luna', 'GPT-5.6', null, '#0891b2', 'non-frontier']
];
for (const [id] of rows) if (!byId.has(id)) throw new Error(`Unknown chart run ${id}`);
const bars = rows.map(([id, name, version, score, color, status], i) => {
  const cx = 115 + i * 122;
  const x = cx - 37;
  const top = score === null ? 101 : 392 - score * 2.91;
  const bar = score === null
    ? `<rect x="${x}" y="101" width="74" height="291" rx="5" fill="#fff" stroke="${color}" stroke-width="2.5" stroke-dasharray="7 6"/><text x="${cx}" y="238" text-anchor="middle" font-size="11" fill="${color}" font-weight="800">PENDING</text>`
    : `<rect x="${x}" y="${top.toFixed(2)}" width="74" height="${(392 - top).toFixed(2)}" rx="5" fill="${color}"/><text x="${cx}" y="${(top - 11).toFixed(2)}" text-anchor="middle" font-size="14" font-weight="800" fill="#172033">${score.toFixed(2)}</text>`;
  return `<g>${bar}<text x="${cx}" y="420" text-anchor="middle" font-size="12" font-weight="700" fill="#172033">${escaped(name)}</text><text x="${cx}" y="437" text-anchor="middle" font-size="11" fill="#475569">${escaped(version)}</text><text x="${cx}" y="457" text-anchor="middle" font-size="10" fill="${color}">${status}</text></g>`;
}).join('');
const chart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" role="img" aria-labelledby="title desc">
  <title id="title">Frontier Models — preliminary scores out of 100</title>
  <desc id="desc">GPT-6 Astra 95.25, Fable 5.1 93.30, GPT-5.6 Sun V2 71.20 and Grok 4.6 33.80. GPT-6.1 Sol, Grok 4.7 Solar, Gemini 4 Argon, historical Gemini 3.8 Flash and GPT-5.6 Luna are unscored.</desc>
  <rect width="1200" height="500" rx="28" fill="#fff"/>
  <g font-family="Inter,Segoe UI,Arial,sans-serif">
    <text x="600" y="42" text-anchor="middle" font-size="27" font-weight="800" fill="#172033">Frontier Models · Scores / 100</text>
    <text x="600" y="67" text-anchor="middle" font-size="14" fill="#64748b">Scores are preliminary · unscored references are not ranked</text>
    <g stroke="#d9e0ea" stroke-width="1"><line x1="70" x2="1155" y1="101" y2="101"/><line x1="70" x2="1155" y1="159" y2="159"/><line x1="70" x2="1155" y1="217" y2="217"/><line x1="70" x2="1155" y1="275" y2="275"/><line x1="70" x2="1155" y1="334" y2="334"/></g>
    <line x1="70" x2="1155" y1="392" y2="392" stroke="#64748b"/>
    <g text-anchor="end" font-size="12" fill="#475569"><text x="61" y="105">100</text><text x="61" y="163">80</text><text x="61" y="221">60</text><text x="61" y="279">40</text><text x="61" y="338">20</text><text x="61" y="396">0</text></g>
    ${bars}
  </g>
</svg>
`;
writeFileSync(resolve(base, 'frontier-v2-scores-v6.svg'), chart.replace(/^[ \t]+$/gm, ''));

// Historical SVG versions are immutable: always create a new numbered graphic
// instead of touching previous versions with unrelated rendering changes.
console.log('Rendered five-current-reference hero and nine-run score overview.');
