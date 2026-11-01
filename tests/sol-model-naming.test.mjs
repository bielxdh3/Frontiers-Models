import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const text = path => readFileSync(resolve(root, path), 'utf8');
const registry = JSON.parse(text('benchmarks/solar-system/RUNS.json'));

test('the GPT-5.6 model is called Sol consistently in public documentation', () => {
  for (const path of [
    'README.md', 'README-PT-BR.md',
    'benchmarks/solar-system/README.md',
    'benchmarks/solar-system/README-PT-BR.md',
    'benchmarks/solar-system/prompts/README.md',
    'docs/REPOSITORY-ARCHITECTURE.md',
  ]) {
    const content = text(path);
    assert.doesNotMatch(content, /GPT-5\.6 Sun\b|\[(?:Open|Abrir) Sun V[12]\]/, path);
    assert.match(content, /GPT-5\.6 Sol\b/, path);
  }
});

test('legacy IDs, archived prompt filename and source URLs stay valid', () => {
  const runs = registry.runs.filter(run => run.id.startsWith('gpt-5.6-sun-max-'));
  assert.equal(runs.length, 2);
  for (const run of runs) {
    assert.equal(run.model, 'GPT-5.6 Sol');
    assert.match(run.id, /^gpt-5\.6-sun-max-/);
    assert.match(run.target_path, /^runs\/gpt-5\.6-sun-max\//);
    assert.equal(run.live_url, run.role === 'historical-baseline'
      ? null
      : 'https://orbitarium-gpt-5.6-sol-v2.biel.dev.br');
    assert.ok(existsSync(resolve(root, 'benchmarks/solar-system', run.target_path)));
    assert.ok(existsSync(resolve(root, 'benchmarks/solar-system', run.prompt)));
  }
  assert.ok(registry.prompts['sun-original']);
  assert.match(text('benchmarks/solar-system/prompts/README.md'), /legacy identifiers retained/);
});
