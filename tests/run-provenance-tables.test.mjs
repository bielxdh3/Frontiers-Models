import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
const orbit = JSON.parse(read('benchmarks/solar-system/RUNS.json'));
const racing = JSON.parse(read('benchmarks/racing/RUNS.json'));
const currentOrbit = new Set(orbit.current_arena);
const expectedOrbit = [
  ...orbit.current_arena.map(id => orbit.runs.find(run => run.id === id)),
  ...orbit.runs.filter(run => !currentOrbit.has(run.id) && run.role !== 'non-frontier-run'),
  ...orbit.runs.filter(run => run.role === 'non-frontier-run'),
];
const expectedRacing = [
  ...racing.legacy_runs.map(id => racing.runs.find(run => run.id === id)),
  ...racing.current_arena.map(id => racing.runs.find(run => run.id === id)),
  ...racing.non_frontier_runs.map(id => racing.runs.find(run => run.id === id)),
];

function displayName(run) {
  if (run.id === 'gpt-5.6-sun-max-original') return 'GPT-5.6 Sol V1';
  if (run.id === 'gpt-5.6-sun-max-frontier-v2') return 'GPT-5.6 Sol V2';
  return run.model;
}

function classification(run, isRacing, pt) {
  if (isRacing) {
    if (racing.non_frontier_runs.includes(run.id)) return 'Non-frontier';
    return racing.current_arena.includes(run.id) ? (pt ? 'Atual' : 'Current') : (pt ? 'Legado' : 'Legacy');
  }
  if (currentOrbit.has(run.id)) return pt ? 'Atual' : 'Current';
  if (run.role === 'non-frontier-run') return 'Non-frontier';
  return pt ? 'Histórico' : 'Historical';
}

function sourceStatus(run, isRacing, pt) {
  const archived = isRacing
    ? ['complete-tracked-git-snapshot-and-full-history-bundle',
      'complete-tracked-git-snapshot-lfs-pointer-no-history-bundle',
      'complete-tracked-git-snapshot-no-history-bundle'].includes(run.archival_status)
    : run.archive_status === 'self-contained';
  assert.ok(archived || (isRacing ? run.archival_status === 'source-repository-pinned' :
    run.archive_status === 'source-repository-pinned'), run.id);
  if (archived) {
    const path = resolve(root, isRacing ? 'benchmarks/racing/' + run.archive_path : 'benchmarks/solar-system/' + run.target_path);
    if (existsSync(path)) {
      assert.ok(statSync(path).isDirectory(), 'archived path is a directory: ' + run.id);
      assert.ok(readdirSync(path).length > 1, 'archived path must contain files: ' + run.id);
    } else {
      // Sparse local checkouts still contain the archive in the tracked Git tree.
      const rel = relative(root, path).replaceAll('\\', '/');
      const result = execFileSync('git', ['-C', root, 'ls-tree', 'HEAD', rel], {encoding: 'utf8'});
      assert.match(result, /^040000 tree [0-9a-f]+\t/m, 'missing tracked archive tree: ' + run.id);
    }
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

for (const [lang, pt] of [['English', false], ['Português', true]]) {
  test(lang + ': benchmark-specific provenance records match both RUNS.json indexes', () => {
    for (const [label, runs, isRacing] of [
      ['Racing-bench', expectedRacing, true],
      ['Orbitarium-bench', expectedOrbit, false],
    ]) {
      const file = isRacing ? 'benchmarks/racing/RUN-PROVENANCE.md' : 'benchmarks/solar-system/RUN-PROVENANCE.md';
      const content = read(file);
      const region = content.split('## ' + lang + '\n')[1]?.split('\n## ')[0];
      assert.ok(region, 'language section for ' + label);
      const rows = parseTable(region, label);
      assert.equal(rows.length, runs.length, 'correct run count: ' + label);
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        assert.deepEqual(rows[i], [
          '**' + displayName(run) + '**',
          revision(run),
          classification(run, isRacing, pt),
          sourceStatus(run, isRacing, pt),
        ], lang + ': ' + label + ' ' + run.id);
      }
    }
  });
}

for (const file of ['README.md', 'README-PT-BR.md']) {
  test(file + ': README remains a showcase, not a technical provenance report', () => {
    const content = read(file);
    assert.doesNotMatch(content, /## Run provenance by benchmark|## Proveniência das execuções por benchmark/);
    assert.doesNotMatch(content, /## Archive policy|## Política do arquivo/);
    assert.doesNotMatch(content, /33\/34|prompt equivalence is not claimed|exact source commits|proveniência dos prompts não/);
    assert.match(content, /RUN-PROVENANCE.md/);
    assert.match(content, /ARCHIVE-POLICY.md/);
    assert.doesNotMatch(content, /https:\/\/github\.com\/bielxdh3\/4argon/);
  });
}
