import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');

for (const [path, arenaHeading, title, archivedHeading, labels] of [
  ['README.md', '## ⚔️ Current benchmark runs', '## How it fits together',
    '## 🗂️ Non-frontier or outdated models', ['5 current runs', '5 current references', 'ARCHIVE CONVENTIONS']],
  ['README-PT-BR.md', '## ⚔️ Execuções atuais por benchmark', '## Como se organiza',
    '## 🗂️ Modelos non-frontier ou desatualizados', ['5 execuções atuais', '5 referências atuais', 'ORGANIZAÇÃO DO ACERVO']],
]) {
  test(path + ': benchmark-specific repository map sits between current and historical runs', () => {
    const content = read(path);
    const arenaStart = content.indexOf(arenaHeading);
    const diagramStart = content.indexOf(title);
    const archiveStart = content.indexOf(archivedHeading);
    assert.ok(arenaStart >= 0 && arenaStart < diagramStart && diagramStart < archiveStart,
      'repository map follows current runs and precedes historical models');
    assert.equal(content.indexOf(title, diagramStart + title.length), -1,
      'map appears only once');
    const section = content.slice(diagramStart, archiveStart);
    const matches = [...section.matchAll(/```text\r?\n([\s\S]*?)\r?\n```/g)];
    assert.equal(matches.length, 1, 'one text diagram per language');
    const drawing = matches[0][1];
    const racing = drawing.indexOf('RACING-BENCH');
    const orbitarium = drawing.indexOf('ORBITARIUM-BENCH');
    const archive = drawing.indexOf(labels[2]);
    assert.ok(drawing.startsWith('FRONTIER MODELS'));
    assert.ok(racing > 0 && orbitarium > racing && archive > orbitarium,
      'two benchmark branches followed by shared archive conventions');
    for (const required of [
      '2 benchmarks', ...labels.slice(0, 2), 'Gemini 3.8 Flash', 'GPT-6.1 Sol', 'GPT-6 Astra', 'Opus 5.5', 'Gemini 4 Argon',
      'V2.6', 'frontier-v2.md', 'racing-v3.4/', '14', 'RUNS.json', 'prompts/',
      'runs/', 'SHA-256',
    ]) {
      assert.ok(drawing.includes(required), 'missing ' + required);
    }
    assert.match(drawing, /├── RACING-BENCH/);
    assert.match(drawing, /├── ORBITARIUM-BENCH/);
    assert.match(drawing, /└── (?:ARCHIVE CONVENTIONS|ORGANIZAÇÃO DO ACERVO)/);
    assert.doesNotMatch(drawing, /┌|┬|▼/, 'must not reuse the old pipeline flowchart');
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
    assert.ok(existsSync(resolve(root, path)) ||
      /^040000 tree |^100644 blob /m.test(execFileSync('git', ['-C', root, 'ls-tree', 'HEAD', path], {encoding:'utf8'})),
      path);
  }
  assert.equal(existsSync(resolve(root, 'assets/repo-commit-history.gif')), false);
});
