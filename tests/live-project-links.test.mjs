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

test('Racing V3.4 includes Gemini, Sol, Astra and Opus; Opus remains unpublished', () => {
  assert.equal(racing.current_prompt, 'racing-v3.4');
  assert.deepEqual(racing.current_arena, ['gemini-3.8-v3.4', 'gpt-6.1-sol-v3.4', 'gpt-6-astra-v3.4', 'opus-5.5-v3.4']);
  assert.deepEqual(racing.legacy_runs, ['gpt-6.1-sol', 'gemini-3.8-flash', 'gpt-6-astra']);
  const current = racing.runs.find(run => run.id === racing.current_arena[0]);
  assert.equal(current.model, 'Gemini 3.8 Flash');
  assert.equal(current.source_commit, '8f1992b88c3771edae825f7ecc52f1499844cb0b');
  assert.equal(current.source_repository, 'https://github.com/bielxdh3/gemini-3.8');
  assert.equal(current.site_url, 'https://racing-gemini-3.8-flash.biel.dev.br/');
  assert.match(current.site_status, /http-200/);
  assert.equal(current.live_url, 'https://racing-gemini-3.8-flash.biel.dev.br/');
  const sol = racing.runs.find(run => run.id === 'gpt-6.1-sol-v3.4');
  assert.equal(sol.model, 'GPT-6.1 Sol');
  assert.equal(sol.source_repository, 'https://github.com/bielxdh3/6.1racinsol');
  assert.equal(sol.source_commit, '1ab34b18cbe30145a161b78674ce1b682a9750d0');
  assert.equal(sol.live_url, 'https://racing-gpt-6.1-sol.biel.dev.br/');
  assert.equal(sol.site_url, sol.live_url);
  assert.match(sol.site_status, /not-independently-verified/);
  const astra = racing.runs.find(run => run.id === 'gpt-6-astra-v3.4');
  assert.equal(astra.source_repository, 'https://github.com/bielxdh3/6-astra');
  assert.equal(astra.source_commit, 'daf0099699a0e8201b8bc4f1dca6909f92700b3b');
  assert.equal(astra.source_tree, 'b115486c104e25041bf2116865de91b6c4a31132');
  assert.equal(astra.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
  assert.equal(astra.live_url, 'https://racing-gpt-6-astra.biel.dev.br/');
  assert.equal(astra.site_url, astra.live_url);
  assert.match(astra.site_status, /owner-provided-url-http-404-on-2026-11-05/);
  assert.match(astra.site_status, /gameplay-not-independently-verified/);
  assert.equal(astra.reported_verification.integral_benchmark, 'failed');
  assert.equal(astra.reported_verification.passed, 33);
  assert.equal(astra.reported_verification.total, 34);
  const opus = racing.runs.find(run => run.id === 'opus-5.5-v3.4');
  assert.equal(opus.model, 'Opus 5.5');
  assert.equal(opus.source_repository, 'https://github.com/bielxdh3/opus55');
  assert.equal(opus.source_commit, 'e75f298d49bb1324aec329690dc56f53ed0ee643');
  assert.equal(opus.source_tree, 'ca06e6d07ea2e567597ead65726e1d6fe777630f');
  assert.equal(opus.live_url, null);
  assert.equal(opus.site_url, null);
  assert.equal(opus.site_status, 'owner-confirmed-not-yet-published');
  assert.equal(opus.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
  for (const run of racing.runs.filter(run => racing.legacy_runs.includes(run.id))) {
    assert.equal(run.live_url, null);
    assert.equal(run.display_status, 'legacy-archived');
  }
  for (const path of ['README.md', 'README-PT-BR.md',
    'benchmarks/racing/README.md', 'benchmarks/racing/README-PT-BR.md']) {
    const s = read(path);
    assert.match(s, /racing-v3\.1\.md/);
    assert.match(s, /racing-v3\.4/);
    assert.match(s, /racing-gemini-3\.8-flash\.biel\.dev\.br/);
    assert.match(s, /\[Source — gemini-3\.8\]\(https:\/\/github\.com\/bielxdh3\/gemini-3\.8\)/);
    const localSolSource = path.startsWith('benchmarks/racing/')
      ? './runs/gpt-6.1-sol-v3.4/source/'
      : './benchmarks/racing/runs/gpt-6.1-sol-v3.4/source/';
    assert.ok(s.includes('](' + localSolSource + ')'), path + ' must link to its local Sol source archive');
    const localAstraSource = path.startsWith('benchmarks/racing/')
      ? './runs/gpt-6-astra-v3.4/source/'
      : './benchmarks/racing/runs/gpt-6-astra-v3.4/source/';
    assert.ok(s.includes('](' + localAstraSource + ')'), path + ' must link to its local Astra source archive');
    const localOpusSource = path.startsWith('benchmarks/racing/')
      ? './runs/opus-5.5-v3.4/source/'
      : './benchmarks/racing/runs/opus-5.5-v3.4/source/';
    assert.ok(s.includes('](' + localOpusSource + ')'), path + ' must link to its local Opus 5.5 archive');
    assert.doesNotMatch(s, /https:\/\/racing-opus-5\.5\.biel\.dev\.br\//, path + ' must not invent an Opus URL');
    assert.ok(s.includes('](https://racing-gpt-6-astra.biel.dev.br/)'), path + ' Astra site link');
    assert.match(s, /HTTP 404/, path + ' discloses failed reachability');
    assert.doesNotMatch(s, /https:\/\/github\.com\/bielxdh3\/6\.1racinsol/);
    for (const run of racing.runs) assert.ok(s.includes(run.model));
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
