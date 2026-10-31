import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');

for (const [path, title] of [
  ['README.md', 'Architecture at a glance'],
  ['README-PT-BR.md', 'Arquitetura em resumo'],
]) {
  test(path + ': diagram depicts the real benchmark archive', () => {
    const content = read(path);
    const section = content.split('### ' + title)[1]?.split('## Benchmark 001')[0];
    assert.ok(section, 'architecture section exists');
    const start = section.indexOf('```text');
    const end = section.indexOf('```', start + 7);
    const drawing = start >= 0 && end > start ? section.slice(start + 7, end) : null;
    assert.ok(drawing, 'monospaced diagram exists');
    for (const evidence of [
      'prompts/frontier-v2.md',
      'benchmarks/solar-system/RUNS.json',
      'runs/<model>/<run>/',
      '*-PROVENANCE.md / *-FILES.json',
      'SHA-256',
    ]) {
      assert.ok(drawing.includes(evidence), evidence);
    }
    assert.ok(drawing.split(String.fromCharCode(10)).filter(line => line.includes('+---')).length >= 10);
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
