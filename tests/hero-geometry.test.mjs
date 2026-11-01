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
  assert.match(svg, /viewBox="0 0 1440 560"/);
  assert.doesNotMatch(svg, /BENCHMARK COLLECTION|02 CURRENT RUNS|05 CURRENT REFERENCES|OPEN PROJECT ARCHIVE|CURRENT RUNS|<text[^>]*>CURRENT<\/text>/);
  assert.doesNotMatch(svg, /BENCHMARK 002|BENCHMARK 001|GAMEPLAY ENGINEERING|PRODUCT &amp; SIMULATION|data-role="collection-counts"|HISTORICAL \/ NON-FRONTIER/);
  assert.doesNotMatch(svg, /<text[^>]*font-size="1[0-5]"/);
  assert.match(svg, />FRONTIER<\/text>/);
  assert.match(svg, />MODELS<\/text>/);
  assert.doesNotMatch(svg, /data-role="orbit"|data-role="planet"|data-role="sun"|<ellipse\b/);
  assert.doesNotMatch(renderer, /orbitSpecs|orbitRings|orbitCenter/);
});

test('Racing first: three legacy runs from the Racing registry with correct names', () => {
  assert.deepEqual(models('racing'), ['gpt-6.1-sol', 'gemini-3.8-flash', 'gpt-6-astra']);
  const entries = racing.runs;
  for (const id of models('racing')) {
    const run = entries.find(run => run.id === id);
    assert.ok(run);
    assert.equal(run.display_status, 'legacy-archived');
    assert.match(svg, new RegExp('>' + run.model.replace(/[.*+?^$()|[\]{}]/g, '\\$&') + '<'));
  }
  assert.ok(svg.indexOf('<g data-benchmark="racing">') < svg.indexOf('<g data-benchmark="orbitarium">'));
  assert.match(svg, /V2\.6 LEGACY/);
  assert.match(svg, />Racing-bench V3\.1<\/text>/);
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

test('all eight visible run badges stay inside their benchmark panels', () => {
  const racingBadges = [...svg.matchAll(/<g data-role="run" data-benchmark="racing" data-model="[^"]+">\s*<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="56"/g)]
    .map(([, x, y, w]) => ({ x: Number(x), y: Number(y), w: Number(w) }));
  const orbitBadges = [...svg.matchAll(/<g data-role="run" data-benchmark="orbitarium" data-model="[^"]+">\s*<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="56"/g)]
    .map(([, x, y, w]) => ({ x: Number(x), y: Number(y), w: Number(w) }));
  assert.equal(racingBadges.length, 3);
  assert.equal(orbitBadges.length, 5);
  for (const b of racingBadges) {
    assert.ok(b.x >= 613 && b.x + b.w <= 1388 && b.y >= 51 && b.y + 56 <= 266);
  }
  for (const b of orbitBadges) {
    assert.ok(b.x >= 613 && b.x + b.w <= 1388 && b.y >= 280 && b.y + 56 <= 530);
  }
});

test('current-run SVG does not include Orbitarium historical/non-frontier IDs', () => {
  const current = new Set(orbit.current_arena);
  const orbitariumIds = models('orbitarium');
  for (const run of orbit.runs) {
    if (current.has(run.id)) continue;
    assert.ok(!orbitariumIds.includes(run.id), 'non-frontier run in current SVG: ' + run.id);
  }
  assert.equal(models('orbitarium').length + models('racing').length, 8);
});

test('hero is deterministic, source-driven and free of AI rankings', () => {
  assert.match(renderer, /orbitarium\.current_arena/);
  assert.match(renderer, /const racingRuns = racing\.runs;/);
  assert.doesNotMatch(svg, /RANK|RATING|SCORE|BENCHMARK WINNER/i);
});
