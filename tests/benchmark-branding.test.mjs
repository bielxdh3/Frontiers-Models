import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const registry = JSON.parse(read('benchmarks/solar-system/RUNS.json'));

test('Orbitarium-bench is the canonical public benchmark name', () => {
  assert.equal(registry.benchmark, 'orbitarium-bench');
  for (const path of ['README.md', 'README-PT-BR.md']) {
    assert.match(read(path), /^## Benchmark 001 — Orbitarium-bench$/m);
    assert.match(read(path), /Orbitarium-bench/);
  }
  for (const path of ['benchmarks/solar-system/README.md', 'benchmarks/solar-system/README-PT-BR.md']) {
    assert.match(read(path), /^# Orbitarium-bench$/m);
  }
  assert.match(read('assets/frontier-models-hero-v7.svg'), /BENCHMARK ARCHIVE · ORBITARIUM-BENCH/);
  assert.match(read('scripts/render-benchmark-assets.mjs'), /BENCHMARK ARCHIVE · ORBITARIUM-BENCH/);
});

test('legacy archive paths and exact prompt integrity remain unchanged', () => {
  const promptPath = 'benchmarks/solar-system/prompts/frontier-v2.md';
  assert.ok(existsSync(resolve(root, promptPath)));
  assert.ok(existsSync(resolve(root, 'benchmarks/solar-system/runs')));
  const digest = createHash('sha256').update(read(promptPath).replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(digest, registry.prompts['frontier-v2'].sha256);
});
