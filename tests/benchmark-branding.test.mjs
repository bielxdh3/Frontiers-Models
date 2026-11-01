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

test('the homepages present Racing first and Orbitarium second, without mixing model run status', () => {
  for (const path of ['README.md', 'README-PT-BR.md']) {
    const content = read(path);
    const racing = content.indexOf('### Racing-bench — ');
    const orbitarium = content.indexOf('### Orbitarium-bench — ');
    const diagram = content.indexOf(path === 'README.md' ? '## How it fits together' : '## Como se organiza');
    assert.ok(0 <= racing && racing < orbitarium && orbitarium < diagram, path);
    const racingSection = content.slice(racing, orbitarium);
    assert.equal([...racingSection.matchAll(/\| 🏎️ \*\*/g)].length, 3, path);
    assert.ok(racingSection.includes('https://racing-gpt-6.1-sol.biel.dev.br'));
    assert.ok(racingSection.includes('https://racing-gemini-3.8-flash.biel.dev.br'));
    assert.ok(racingSection.includes('https://racing-gpt-6-astra.biel.dev.br'));
    const orbitariumSection = content.slice(orbitarium, diagram);
    assert.equal(orbitariumSection.split('\n').filter(line =>
      line.startsWith('|') && line.includes('**')).length, 5, path);
    assert.ok(!orbitariumSection.includes('**Gemini 3.8 Flash**'), path);
    assert.ok(content.indexOf('## Benchmark 002 — Racing-bench') <
      content.indexOf('## Benchmark 001 — Orbitarium-bench'), path);
  }
});

test('all current tables have the same three columns and full model names in both links', () => {
  const racing = JSON.parse(read('benchmarks/racing/RUNS.json'));
  const groups = [
    {
      marker: '### Racing-bench — ',
      runs: racing.runs,
      archiveRoot: 'benchmarks/racing/',
      archiveKey: 'archive_path',
    },
    {
      marker: '### Orbitarium-bench — ',
      runs: registry.current_arena.map(id => registry.runs.find(run => run.id === id)),
      archiveRoot: 'benchmarks/solar-system/',
      archiveKey: 'target_path',
    },
  ];
  for (const [path, expectedHeader, externalPrefix, sourcePrefix] of [
    ['README.md', '| Model | Live project | Source code |', 'Open ', 'Code: '],
    ['README-PT-BR.md', '| Modelo | Projeto ao vivo | Código-fonte |', 'Abrir ', 'Código: '],
  ]) {
    const content = read(path);
    for (const group of groups) {
      const start = content.indexOf(group.marker);
      assert.ok(start >= 0, path + ': missing ' + group.marker);
      const nextHeading = content.indexOf('\n### ', start + 4);
      const nextSection = content.indexOf('\n## ', start + 4);
      const end = Math.min(...[nextHeading, nextSection].filter(i => i > start));
      const section = content.slice(start, end);
      const lines = section.split(/\r?\n/);
      assert.equal(lines.filter(line => line === expectedHeader).length, 1, path);
      assert.ok(lines.includes('| --- | --- | --- |'), path);
      const rows = lines.filter(line => /^\| .+ \*\*.+\*\* \|/.test(line));
      assert.equal(rows.length, group.runs.length, path + ': incorrect run count');
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const run = group.runs[i];
        const cells = row.split('|').slice(1, -1).map(s => s.trim());
        assert.equal(cells.length, 3, row);
        assert.ok(cells[0].includes('**' + run.model + '**'), row);
        assert.equal(cells[1], `[${externalPrefix}${run.model}](${run.live_url})`, row);
        const archive = './' + group.archiveRoot + run[group.archiveKey] + '/';
        assert.equal(cells[2], `[${sourcePrefix}${run.model}](${archive})`, row);
        assert.ok(existsSync(resolve(root, archive)), row + ': missing archived source');
      }
    }
  }
});
