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
  const hero = read('assets/frontier-models-hero-v7.svg');
  assert.match(hero, /Racing-bench/);
  assert.match(hero, /Orbitarium-bench/);
  assert.ok(hero.indexOf('Racing-bench') < hero.indexOf('Orbitarium-bench'));
  assert.doesNotMatch(hero, /BENCHMARK ARCHIVE · ORBITARIUM-BENCH/);
});

test('legacy archive paths and exact prompt integrity remain unchanged', () => {
  const promptPath = 'benchmarks/solar-system/prompts/frontier-v2.md';
  assert.ok(existsSync(resolve(root, promptPath)));
  assert.ok(existsSync(resolve(root, 'benchmarks/solar-system/runs')));
  const digest = createHash('sha256').update(read(promptPath).replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(digest, registry.prompts['frontier-v2'].sha256);
});

test('Racing V3.1 appears first while the old three remain source-only legacy', () => {
  for (const path of ['README.md', 'README-PT-BR.md']) {
    const s = read(path);
    const first = s.indexOf('### Racing-bench V3.1');
    const second = s.indexOf('### Orbitarium-bench — ');
    assert.ok(first >= 0 && first < second);
    const section = s.slice(first, second);
    assert.match(section, /racing-v3\.1\.md/);
    assert.doesNotMatch(section, /https:\/\/racing-/);
    for (const name of ['GPT-6.1 Sol', 'Gemini 3.8 Flash', 'GPT-6 Astra']) assert.ok(section.includes(name));
    assert.ok(s.indexOf('## Benchmark 002 — Racing-bench') < s.indexOf('## Benchmark 001 — Orbitarium-bench'));
  }
});

test('all five current Orbitarium sites remain displayed', () => {
  for (const path of ['README.md', 'README-PT-BR.md']) {
    const s = read(path);
    const a = s.indexOf('### Orbitarium-bench — ');
    const b = s.indexOf(path === 'README.md' ? '## How it fits together' : '## Como se organiza', a);
    const section = s.slice(a, b);
    for (const id of registry.current_arena) {
      const run = registry.runs.find(r => r.id === id);
      assert.ok(section.includes('](' + run.live_url + ')'), id);
    }
  }
});
