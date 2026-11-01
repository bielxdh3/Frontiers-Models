import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const orbitarium = JSON.parse(read('benchmarks/solar-system/RUNS.json')).runs;
const racing = JSON.parse(read('benchmarks/racing/RUNS.json'));

const orbitariumSites = new Map([
  ['gpt-5.6-sun-max-frontier-v2', 'https://orbitarium-gpt-5.6-sol-v2.biel.dev.br'],
  ['gpt-5.6-luna-max-orbitario', 'https://orbitarium-gpt-5.6-luna.biel.dev.br'],
  ['gpt-6-astra-max-frontier-v2', 'https://orbitarium-gpt-6-astra.biel.dev.br'],
  ['gpt-6.1-sol-source', 'https://orbitarium-gpt-6.1-sol.biel.dev.br'],
  ['grok-4.7-solar-source', 'https://orbitarium-grok-4.7.biel.dev.br'],
  ['gemini-3.8-flash-high-frontier-v2', 'https://orbitarium-gemini-3.8-flash.biel.dev.br'],
  ['gemini-4-argon-source', 'https://orbitarium-gemini-4-argon.biel.dev.br']
]);

test('all seven canonical Orbitarium sites retain their original links', () => {
  for (const [id, url] of orbitariumSites) {
    assert.equal(orbitarium.find(run => run.id === id)?.live_url, url, id);
  }
});

test('Racing V3.1 is current; all three V2.6 runs are legacy without live links', () => {
  assert.equal(racing.current_prompt, 'racing-v3.1');
  assert.deepEqual(racing.runs.map(run => run.id), ['gpt-6.1-sol', 'gemini-3.8-flash', 'gpt-6-astra']);
  for (const run of racing.runs) {
    assert.equal(run.live_url, null);
    assert.equal(run.display_status, 'legacy-archived');
  }
  for (const path of ['README.md', 'README-PT-BR.md',
    'benchmarks/racing/README.md', 'benchmarks/racing/README-PT-BR.md']) {
    const s = read(path);
    assert.match(s, /racing-v3\.1\.md/);
    for (const run of racing.runs) assert.ok(s.includes(run.model));
    assert.doesNotMatch(s, /https:\/\/racing-(?:gpt-6\.1-sol|gemini-3\.8-flash|gpt-6-astra)\.biel\.dev\.br/);
  }
});

test('Orbitarium homepage and archive links are unchanged', () => {
  for (const path of ['README.md', 'README-PT-BR.md',
    'benchmarks/solar-system/README.md', 'benchmarks/solar-system/README-PT-BR.md']) {
    const s = read(path);
    for (const [id, url] of orbitariumSites) assert.ok(s.includes('](' + url + ')'), path + ': ' + id);
    assert.doesNotMatch(s, /orbitarium-gpt-5\.6-sol\.v1\.biel\.dev\.br/);
    assert.ok(s.includes('GPT-5.6 Sol V1'));
  }
  assert.equal(orbitarium.find(run => run.id === 'gpt-5.6-sun-max-original')?.live_url, null);
});
