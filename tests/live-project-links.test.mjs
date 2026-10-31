import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = file => readFileSync(resolve(root, file), 'utf8');
const orbitarium = JSON.parse(read('benchmarks/solar-system/RUNS.json')).runs;
const racing = JSON.parse(read('benchmarks/racing/RUNS.json')).runs;

// Exact owner-provided sites. In particular, Sol V1 has ".sol.v1." (not "-sol-v1.").
const orbitariumSites = new Map([
  ['gpt-5.6-sun-max-original', ['GPT-5.6 Sol', 'https://orbitarium-gpt-5.6-sol.v1.biel.dev.br']],
  ['gpt-5.6-sun-max-frontier-v2', ['GPT-5.6 Sol', 'https://orbitarium-gpt-5.6-sol-v2.biel.dev.br']],
  ['gpt-5.6-luna-max-orbitario', ['GPT-5.6 Luna', 'https://orbitarium-gpt-5.6-luna.biel.dev.br']],
  ['gpt-6-astra-max-frontier-v2', ['GPT-6 Astra', 'https://orbitarium-gpt-6-astra.biel.dev.br']],
  ['gpt-6.1-sol-source', ['GPT-6.1 Sol', 'https://orbitarium-gpt-6.1-sol.biel.dev.br']],
  ['grok-4.7-solar-source', ['Grok 4.7', 'https://orbitarium-grok-4.7.biel.dev.br']],
  ['gemini-3.8-flash-high-frontier-v2', ['Gemini 3.8 Flash', 'https://orbitarium-gemini-3.8-flash.biel.dev.br']],
  ['gemini-4-argon-source', ['Gemini 4 Argon', 'https://orbitarium-gemini-4-argon.biel.dev.br']],
]);

const racingSites = new Map([
  ['gpt-6.1-sol', ['GPT-6.1 Sol', 'https://racing-gpt-6.1-sol.biel.dev.br']],
  ['gemini-3.8-flash', ['Gemini 3.8 Flash', 'https://racing-gemini-3.8-flash.biel.dev.br']],
]);

test('all eight Orbitarium website URLs and model names match the supplied canonical list', () => {
  for (const [id, [model, url]] of orbitariumSites) {
    const runs = orbitarium.filter(run => run.id === id);
    assert.equal(runs.length, 1, id);
    assert.equal(runs[0].model, model, id);
    assert.equal(runs[0].live_url, url, id);
    assert.ok(!url.includes('github.com'));
  }
});

test('both Racing websites are registered independently of the Orbitarium sites', () => {
  for (const [id, [model, url]] of racingSites) {
    const runs = racing.filter(run => run.id === id);
    assert.equal(runs.length, 1, id);
    assert.equal(runs[0].model, model, id);
    assert.equal(runs[0].live_url, url, id);
  }
});

for (const file of ['README.md', 'README-PT-BR.md',
  'benchmarks/solar-system/README.md', 'benchmarks/solar-system/README-PT-BR.md']) {
  test(`${file} links to all eight canonical Orbitarium websites`, () => {
    const content = read(file);
    for (const [id, [model, url]] of orbitariumSites) {
      assert.ok(content.includes(`](${url})`), `${file}: missing live URL for ${id}`);
      assert.ok(content.includes(model), `${file}: missing name ${model}`);
    }
    assert.doesNotMatch(content, /Grok 4\.7 Solar|\*\*Gemini 3\.8\*\*|GPT-5\.6 Sun/);
  });
}

for (const file of ['README.md', 'README-PT-BR.md',
  'benchmarks/racing/README.md', 'benchmarks/racing/README-PT-BR.md']) {
  test(`${file} links to both canonical Racing websites`, () => {
    const content = read(file);
    for (const [id, [model, url]] of racingSites) {
      assert.ok(content.includes(`](${url})`), `${file}: missing site for ${id}`);
      assert.ok(content.includes(model));
    }
  });
}

test('the V1 host is exact, not a silently rewritten hyphen alias', () => {
  const url = orbitariumSites.get('gpt-5.6-sun-max-original')[1];
  assert.equal(url, 'https://orbitarium-gpt-5.6-sol.v1.biel.dev.br');
  assert.ok(!url.includes('-sol-v1.'));
});
