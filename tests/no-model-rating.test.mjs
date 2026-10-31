import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const registry = JSON.parse(read('benchmarks/solar-system/RUNS.json'));

test('no manual rating artifacts remain in the benchmark archive', () => {
  assert.equal(existsSync(resolve(root, 'benchmarks/solar-system/comparison/SCORECARD.md')), false);
  assert.deepEqual(readdirSync(resolve(root, 'assets')).filter(name => /scores|frontier-models-hero-v[1-6]\.svg|^frontier-models-hero\.svg$/.test(name)), []);
  assert.doesNotMatch(read('scripts/render-benchmark-assets.mjs'), /\b(score|rating|rank|weighted)s?\b/i);
  assert.doesNotMatch(read('assets/frontier-models-hero-v7.svg'), /\b(score|rating|rank|weighted)s?\b|pending evaluation/i);
});

test('readmes and methodology present runs without scores or rating criteria', () => {
  const files = [
    'README.md', 'README-PT-BR.md',
    'benchmarks/solar-system/README.md',
    'benchmarks/solar-system/README-PT-BR.md',
    'docs/METHODOLOGY.md', 'docs/REPOSITORY-ARCHITECTURE.md'
  ];
  for (const path of files) {
    assert.doesNotMatch(read(path), /SCORECARD|\bscore(s|d|card)?\b|\brank(ing)?\b|\brating(s)?\b|\bevaluation\b|\bavali(aç(ão|ões)|ador)\b|pontuaç(ão|ões)/i, path);
  }
});

test('retains the five current references and all historical records', () => {
  assert.equal(registry.current_arena.length, 5);
  assert.ok(registry.runs.length >= 9);
  const ids = new Set(registry.runs.map(run => run.id));
  for (const id of [...registry.current_arena, ...registry.non_frontier_or_outdated]) {
    assert.ok(ids.has(id), id);
  }
  for (const run of registry.runs) {
    assert.ok(run.model);
    assert.ok(run.target_path || run.source_commit || run.source_archive_sha256);
    assert.equal(Object.keys(run).some(key => /score|rating|rank|evaluation/i.test(key)), false);
  }
});
