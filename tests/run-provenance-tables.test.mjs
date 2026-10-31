import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const orbit = JSON.parse(read('benchmarks/solar-system/RUNS.json'));
const racing = JSON.parse(read('benchmarks/racing/RUNS.json'));
const currentOrbit = new Set(orbit.current_arena);
const expectedOrbit = [
  ...orbit.current_arena.map(id => orbit.runs.find(run => run.id === id)),
  ...orbit.runs.filter(run => !currentOrbit.has(run.id) && run.role !== 'non-frontier-run'),
  ...orbit.runs.filter(run => run.role === 'non-frontier-run'),
];
const expectedRacing = racing.runs;

function displayName(run) {
  if (run.id === 'gpt-5.6-sun-max-original') return 'GPT-5.6 Sol V1';
  if (run.id === 'gpt-5.6-sun-max-frontier-v2') return 'GPT-5.6 Sol V2';
  return run.model;
}

function classification(run, isRacing, pt) {
  if (isRacing || currentOrbit.has(run.id)) return pt ? 'Atual' : 'Current';
  if (run.role === 'non-frontier-run') return 'Non-frontier';
  return pt ? 'Histórico' : 'Historical';
}

function sourceStatus(run, isRacing, pt) {
  const archived = isRacing
    ? run.archival_status === 'complete-tracked-git-snapshot-and-full-history-bundle'
    : run.archive_status === 'self-contained';
  assert.ok(archived || run.archive_status === 'source-repository-pinned', run.id);
  if (archived) {
    const path = resolve(root, isRacing ? 'benchmarks/racing/' + run.archive_path : 'benchmarks/solar-system/' + run.target_path);
    assert.ok(existsSync(path) && statSync(path).isDirectory(), 'archived source must exist: ' + run.id);
    assert.ok(readdirSync(path).length > 1, 'archived source must contain files: ' + run.id);
  }
  return archived ? (pt ? 'Arquivado' : 'Archived') : (pt ? 'Apenas fonte fixada' : 'Pinned only');
}

function revision(run) {
  if (run.source_commit) return 'Git `' + run.source_commit.slice(0, 10) + '…`';
  assert.ok(run.source_archive_sha256, run.id);
  return 'ZIP SHA-256 `' + run.source_archive_sha256.slice(0, 10) + '…`';
}

function parseTable(content, label) {
  const index = content.indexOf('### ' + label);
  assert.ok(index >= 0, label + ' section exists');
  const rest = content.slice(index).replace(/\r\n/g, '\n');
  const match = rest.match(/\| (?:Model|Modelo) \| (?:Source revision|Revisão da fonte) \| (?:Classification|Classificação) \| (?:Source status|Status da fonte) \|[\s\S]*?(?=\n\n)/);
  assert.ok(match, 'provenance table exists for ' + label);
  const lines = match[0].split(/\r?\n/);
  assert.equal(lines[1], '| --- | --- | --- | --- |');
  return lines.slice(2).filter(line => line.startsWith('| ')).map(row => {
    const cells = row.split('|').slice(1, -1).map(s => s.trim());
    assert.equal(cells.length, 4, row);
    return cells;
  });
}

for (const [path, pt] of [
  ['README.md', false],
  ['README-PT-BR.md', true],
]) {
  test(path + ' has equivalent Racing and Orbitarium run-provenance tables and controlled vocabulary', () => {
    const content = read(path);
    const heading = pt ? '## Proveniência das execuções por benchmark' : '## Run provenance by benchmark';
    assert.ok(content.includes(heading));
    const section = content.slice(content.indexOf(heading),
      content.indexOf(pt ? '## Política do arquivo' : '## Archive policy'));
    assert.equal((section.match(/\| (?:Classification|Classificação) \|/g) || []).length, 2, 'both tables must have classification');
    assert.ok(section.indexOf('### Racing-bench') < section.indexOf('### Orbitarium-bench'));
    for (const [label, runs, isRacing] of [
      ['Racing-bench', expectedRacing, true],
      ['Orbitarium-bench', expectedOrbit, false],
    ]) {
      const rows = parseTable(section, label);
      assert.equal(rows.length, runs.length, 'correct full run count: ' + label);
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        assert.deepEqual(rows[i], [
          '**' + displayName(run) + '**',
          revision(run),
          classification(run, isRacing, pt),
          sourceStatus(run, isRacing, pt),
        ], path + ': ' + label + ' ' + run.id);
      }
    }
    assert.doesNotMatch(section, /Current reference|Current frontier|Historical baseline|Outdated frontier run|Archived frontier|Source pinned|Archived; prompt unverified|Referência atual|Frontier atual|Baseline histórico|Frontier arquivado|Arquivado; prompt não verificado/);
  });
}
