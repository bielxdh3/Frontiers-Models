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
  <desc id="desc">${escaped(arena.map(x => x.model).join(', '))}. These are archived or pinned projects; their generating prompts may differ.</desc>
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
    <text x="76" y="478" font-size="15" fill="#91a4c8">Five current references · inspect the preserved source and provenance</text>
  </g>
</svg>
`;
writeFileSync(resolve(base, 'frontier-models-hero-v7.svg'), hero.replace(/^[ \t]+$/gm, ''));

console.log('Rendered five-current-reference hero.');
