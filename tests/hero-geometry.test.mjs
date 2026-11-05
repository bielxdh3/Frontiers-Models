import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const svg = readFileSync(resolve(root, 'assets/frontier-models-hero-v7.svg'), 'utf8');
const renderer = readFileSync(resolve(root, 'scripts/render-benchmark-assets.mjs'), 'utf8');
const orbit = JSON.parse(readFileSync(resolve(root, 'benchmarks/solar-system/RUNS.json'), 'utf8'));
const racing = JSON.parse(readFileSync(resolve(root, 'benchmarks/racing/RUNS.json'), 'utf8'));
const orbitById = new Map(orbit.runs.map(run => [run.id, run]));
const models = benchmark => [...svg.matchAll(new RegExp('<g data-role="run" data-benchmark="' + benchmark + '" data-model="([^"]+)"', 'g'))].map(([, id]) => id);

test('hero presents a clean collection of two benchmarks with no microcopy or orbital diagram', () => {
  assert.match(svg, /<title id="title">Frontier Models — Racing and Orbitarium benchmark collection<\/title>/);
  assert.match(svg, /viewBox="0 0 1440 650"/);
  assert.doesNotMatch(svg, /BENCHMARK COLLECTION|02 CURRENT RUNS|05 CURRENT REFERENCES|OPEN PROJECT ARCHIVE|CURRENT RUNS|<text[^>]*>CURRENT<\/text>/);
  assert.doesNotMatch(svg, /BENCHMARK 002|BENCHMARK 001|GAMEPLAY ENGINEERING|PRODUCT &amp; SIMULATION|data-role="collection-counts"|HISTORICAL \/ NON-FRONTIER/);
  assert.doesNotMatch(svg, /<text[^>]*font-size="1[0-5]"/);
  assert.match(svg, />FRONTIER<\/text>/);
  assert.match(svg, />MODELS<\/text>/);
  assert.doesNotMatch(svg, /data-role="orbit"|data-role="planet"|data-role="sun"|<ellipse\b/);
  assert.doesNotMatch(renderer, /orbitSpecs|orbitRings|orbitCenter/);
});

test('Racing first: all four V3.4 current source runs are in the hero', () => {
  assert.deepEqual(models('racing'), racing.current_arena);
  assert.deepEqual(models('racing'), ['gemini-3.8-v3.4', 'gpt-6.1-sol-v3.4', 'gpt-6-astra-v3.4', 'alpha-5.5-v3.4']);
  const entries = racing.runs;
  for (const id of models('racing')) {
    const run = entries.find(run => run.id === id);
    assert.ok(run);
    assert.ok(run.display_status.startsWith('current-'));
    assert.match(svg, new RegExp('>' + run.model.replace(/[.*+?^$()|[\]{}]/g, '\\$&') + '<'));
  }
  for (const id of racing.legacy_runs) assert.ok(!models('racing').includes(id));
  assert.ok(svg.indexOf('<g data-benchmark="racing">') < svg.indexOf('<g data-benchmark="orbitarium">'));
  assert.match(svg, /V3\.4 CURRENT/);
  assert.match(svg, />Racing-bench V3\.4<\/text>/);
});

test('Orbitarium second: all five current references preserved in registry order', () => {
  assert.deepEqual(models('orbitarium'), orbit.current_arena);
  assert.equal(models('orbitarium').length, 5);
  assert.ok(models('orbitarium').includes('gemini-4-argon-source'));
  assert.ok(!models('orbitarium').includes('gemini-3.8-flash-high-frontier-v2'));
  for (const id of orbit.current_arena) {
    const name = orbitById.get(id)?.model;
    assert.ok(name);
    assert.ok(svg.includes('>' + name + '</text>'), name);
  }
});

test('all nine visible run badges stay inside their benchmark panels, without overlap', () => {
  const racingBadges = [...svg.matchAll(/<g data-role="run" data-benchmark="racing" data-model="[^"]+">\s*<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="56"/g)]
    .map(([, x, y, w]) => ({ x: Number(x), y: Number(y), w: Number(w) }));
  const orbitBadges = [...svg.matchAll(/<g data-role="run" data-benchmark="orbitarium" data-model="[^"]+">\s*<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="56"/g)]
    .map(([, x, y, w]) => ({ x: Number(x), y: Number(y), w: Number(w) }));
  assert.equal(racingBadges.length, 4);
  assert.equal(orbitBadges.length, 5);
  for (const b of racingBadges) {
    assert.ok(b.x >= 613 && b.x + b.w <= 1388 && b.y >= 51 && b.y + 56 <= 331);
  }
  assert.equal(racingBadges[0].y, racingBadges[1].y);
  assert.equal(racingBadges[2].y, racingBadges[3].y);
  assert.ok(racingBadges[2].y >= racingBadges[0].y + 56);
  assert.ok(racingBadges[0].x + racingBadges[0].w < racingBadges[1].x);
  assert.ok(racingBadges[2].x + racingBadges[2].w < racingBadges[3].x);
  for (const b of orbitBadges) {
    assert.ok(b.x >= 613 && b.x + b.w <= 1388 && b.y >= 345 && b.y + 56 <= 615);
  }
});

test('current-run SVG does not include Orbitarium historical/non-frontier IDs', () => {
  const current = new Set(orbit.current_arena);
  const orbitariumIds = models('orbitarium');
  for (const run of orbit.runs) {
    if (current.has(run.id)) continue;
    assert.ok(!orbitariumIds.includes(run.id), 'non-frontier run in current SVG: ' + run.id);
  }
  assert.equal(models('orbitarium').length + models('racing').length, 9);
});

test('hero is deterministic, source-driven and free of AI rankings', () => {
  assert.match(renderer, /orbitarium\.current_arena/);
  assert.match(renderer, /racing\.current_arena\.map/);
  assert.doesNotMatch(svg, /RANK|RATING|SCORE|BENCHMARK WINNER/i);
});
