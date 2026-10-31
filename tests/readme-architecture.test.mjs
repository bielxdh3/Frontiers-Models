import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');

for (const [path, arenaHeading, title, archivedHeading] of [
  ['README.md', '## ⚔️ Current reference arena', '## How it fits together', '## 🗂️ Non-frontier or outdated models'],
  ['README-PT-BR.md', '## ⚔️ Arena atual de referências', '## Como se organiza', '## 🗂️ Modelos non-frontier ou desatualizados'],
]) {
  test(path + ': Root.ark-style diagram is exactly between current and historical arena sections', () => {
    const content = read(path);
    const arenaStart = content.indexOf(arenaHeading);
    const diagramStart = content.indexOf(title);
    const archiveStart = content.indexOf(archivedHeading);
    assert.ok(arenaStart >= 0 && arenaStart < diagramStart && diagramStart < archiveStart,
      'diagram must come after the current arena and before historical models');
    assert.equal(content.indexOf(title, diagramStart + title.length), -1,
      'diagram appears only once');
    const section = content.slice(diagramStart, archiveStart);
    const start = section.indexOf('```text');
    const end = section.indexOf('```', start + 7);
    const drawing = start >= 0 && end > start ? section.slice(start + 7, end) : null;
    assert.ok(drawing, 'monospaced diagram exists');
    const lines = drawing.trimEnd().split(/\r?\n/).slice(1);
    assert.equal(lines.length, 25, 'same 25-line structure as the Root.ark diagram');
    assert.equal(lines[0], '          ┌──────────────────────┐   ┌──────────────────────┐');
    assert.equal(lines[3], '          └──────────┬───────────┘   └──────────┬───────────┘');
    assert.equal(lines[7], '                       ┌──────────▼───────────┐');
    assert.equal(lines[15], '                    ┌─────────▼───┐ ┌──▼──────────────────┐');
    assert.equal(lines[21], path === 'README.md'
      ? '                         ┌─────────────▼───────────┐'
      : '                         ┌────────────▼────────────┐');
    assert.equal(lines[24], '                         └─────────────────────────┘');
    for (const [indexes, width] of [[[0, 1, 2, 3], 61], [[7, 8, 9, 10, 11], 47],
      [[15, 16, 17, 18, 19], 59], [[21, 22, 23, 24], 52]]) {
      for (const i of indexes) assert.equal(lines[i].length, width, `diagram line ${i}`);
    }
    for (const evidence of [
      'RUNS.json',
      'Snapshots',
      'runs/',
      'SHA-256',
    ]) {
      assert.ok(drawing.includes(evidence), evidence);
    }
    assert.doesNotMatch(drawing, /\+[-]{3,}|\|/);
    assert.doesNotMatch(content, /repo-commit-history/);
  });
}

test('paths referenced by the architecture diagram are present', () => {
  for (const path of [
    'benchmarks/solar-system/prompts/frontier-v2.md',
    'benchmarks/solar-system/RUNS.json',
    'benchmarks/solar-system/runs',
    'docs/REPOSITORY-ARCHITECTURE.md',
    'scripts/verify-argon-archive.mjs',
    'scripts/verify-sol-archive.mjs',
  ]) {
    assert.ok(existsSync(resolve(root, path)), path);
  }
  assert.equal(existsSync(resolve(root, 'assets/repo-commit-history.gif')), false);
});
