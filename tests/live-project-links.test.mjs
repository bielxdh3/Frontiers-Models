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

test('Racing V3.4 includes Argon and Sonnet with archived source and owner-provided URLs', () => {
  assert.equal(racing.current_prompt, 'racing-v3.4');
  assert.deepEqual(racing.current_arena, ['gpt-6.1-sol-v3.4', 'gpt-6-astra-v3.4', 'opus-5.5-v3.4', 'gemini-4-argon-v3.4', 'sonnet-5.5-v3.4']);
  assert.deepEqual(racing.legacy_runs, ['gpt-6.1-sol', 'gemini-3.8-flash', 'gpt-6-astra']);
  assert.deepEqual(racing.non_frontier_runs, ['gemini-3.8-v3.4']);
  const current = racing.runs.find(run => run.id === 'gemini-3.8-v3.4');
  assert.equal(current.model, 'Gemini 3.8 Flash');
  assert.equal(current.role, 'non-frontier-run');
  assert.equal(current.display_status, 'non-frontier-archived-source-site-live');
  assert.ok(!racing.current_arena.includes(current.id));
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
  assert.equal(opus.live_url, 'https://racing-opus-5.5.biel.dev.br/');
  assert.equal(opus.site_url, opus.live_url);
  assert.match(opus.site_status, /owner-provided-url-http-404-on-2026-11-05/);
  assert.match(opus.site_status, /gameplay-not-independently-verified/);
  assert.equal(opus.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
  const argon = racing.runs.find(run => run.id === 'gemini-4-argon-v3.4');
  assert.equal(argon.model, 'Gemini 4 Argon');
  assert.equal(argon.source_repository, null, 'never link the source repository for new runs');
  assert.equal(argon.source_commit, '88632a836928ac314ab0e26b492d5360382b980f');
  assert.equal(argon.source_file_count, 450);
  assert.equal(argon.live_url, 'https://racing-gemini-4-argon.biel.dev.br/');
  assert.equal(argon.site_url, argon.live_url);
  assert.equal(argon.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
  const sonnet = racing.runs.find(run => run.id === 'sonnet-5.5-v3.4');
  assert.equal(sonnet.model, 'Sonnet 5.5');
  assert.equal(sonnet.source_repository, null);
  assert.equal(sonnet.source_commit, 'f2400ade4bb8485c768adfa379fd1b4f0d958807');
  assert.equal(sonnet.source_tree, 'de894f9787d161fd35e96f0dd993eab3984ca453');
  assert.equal(sonnet.source_file_count, 2085);
  assert.equal(sonnet.source_bytes, 460836454);
  assert.equal(sonnet.git_bundle, null);
  assert.equal(sonnet.live_url, 'https://racing-sonnet-5.5.biel.dev.br/');
  assert.equal(sonnet.site_url, sonnet.live_url);
  assert.equal(sonnet.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
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
    const localGemini = path.startsWith('benchmarks/racing/')
      ? './runs/gemini-3.8-v3.4/source/'
      : './benchmarks/racing/runs/gemini-3.8-v3.4/source/';
    assert.ok(s.includes('[Code](' + localGemini + ')') || s.includes('[Código](' + localGemini + ')'), path + ' must use the archived Gemini Non-frontier source');
    assert.ok(s.includes('Non-frontier') || s.includes('Não frontier'), path + ' must classify Gemini as Non-frontier');
    const localSolSource = path.startsWith('benchmarks/racing/')
      ? './runs/gpt-6.1-sol-v3.4/source/'
      : './benchmarks/racing/runs/gpt-6.1-sol-v3.4/source/';
    assert.ok(s.includes('[GPT-6.1 Sol](' + localSolSource + ')'), path + ' must label Sol source by model');
    const localAstraSource = path.startsWith('benchmarks/racing/')
      ? './runs/gpt-6-astra-v3.4/source/'
      : './benchmarks/racing/runs/gpt-6-astra-v3.4/source/';
    assert.ok(s.includes('[GPT-6 Astra](' + localAstraSource + ')'), path + ' must label Astra source by model');
    const localOpusSource = path.startsWith('benchmarks/racing/')
      ? './runs/opus-5.5-v3.4/source/'
      : './benchmarks/racing/runs/opus-5.5-v3.4/source/';
    assert.ok(s.includes('[Opus 5.5](' + localOpusSource + ')'), path + ' must label Opus source by model');
    const localArgon = path.startsWith('benchmarks/racing/')
      ? './runs/gemini-4-argon-v3.4/source/'
      : './benchmarks/racing/runs/gemini-4-argon-v3.4/source/';
    assert.ok(s.includes('[Gemini 4 Argon](' + localArgon + ')'), 'Argon must link archived source only');
    assert.ok(s.includes('https://racing-gemini-4-argon.biel.dev.br/'), 'Argon must link owner-provided live URL');
    assert.ok(!s.includes('https://github.com/bielxdh3/4argon'), 'never link original Argon repository');
    const localSonnet = path.startsWith('benchmarks/racing/')
      ? './runs/sonnet-5.5-v3.4/source/'
      : './benchmarks/racing/runs/sonnet-5.5-v3.4/source/';
    assert.ok(s.includes('[Sonnet 5.5](' + localSonnet + ')'), 'Sonnet source must be archived here');
    assert.ok(s.includes('https://racing-sonnet-5.5.biel.dev.br/'));
    assert.ok(!s.includes(['https://github.com/', 'bielxdh3/', 'sonnet55'].join('')));
    assert.ok(s.includes('](https://racing-opus-5.5.biel.dev.br/)'), path + ' must contain owner-provided Opus URL');
    assert.ok(s.includes('](https://racing-gpt-6-astra.biel.dev.br/)'), path + ' Astra site link');
    assert.doesNotMatch(s, /HTTP 404|Source — archived here|Código — arquivado aqui|Source — gemini-3\.8/, path + ' must present clean links without status annotations or generic source labels');
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
