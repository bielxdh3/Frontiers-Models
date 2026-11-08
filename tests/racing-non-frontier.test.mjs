import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = p => readFileSync(resolve(root,p),'utf8');
const runs = JSON.parse(read('benchmarks/racing/RUNS.json'));
const source = 'gemini-3.8-v3.4';
const site = 'https://racing-gemini-3.8-flash.biel.dev.br/';

test('Gemini 3.8 Flash V3.4 moves to Non-frontier, without deleting its archived source', () => {
  assert.deepEqual(runs.non_frontier_runs, [source]);
  assert.ok(!runs.current_arena.includes(source));
  assert.equal(runs.current_arena.length, 5);
  assert.deepEqual(runs.current_arena, [
    'gpt-6.1-sol-v3.4','gpt-6-astra-v3.4','opus-5.5-v3.4',
    'gemini-4-argon-v3.4','sonnet-5.5-v3.4'
  ]);
  const gemini = runs.runs.find(r => r.id === source);
  assert.equal(gemini.role, 'non-frontier-run');
  assert.equal(gemini.display_status, 'non-frontier-archived-source-site-live');
  assert.equal(gemini.source_commit, '8f1992b88c3771edae825f7ecc52f1499844cb0b');
  assert.equal(gemini.source_tree, '9ef8386e5961f81823cd51f5eb3f1c063922df94');
  assert.equal(gemini.source_file_count, 188);
  assert.equal(gemini.source_bytes, 196549258);
  assert.equal(gemini.site_url, site);
  assert.equal(gemini.live_url, site);
  assert.match(execFileSync('git',['-C',root,'ls-tree','HEAD',
    'benchmarks/racing/runs/gemini-3.8-v3.4/source'],{encoding:'utf8'}), /^040000 tree /);
});

test('both languages place the V3.4 Gemini only below the current Racing listing', () => {
  for (const [file,pt] of [
    ['README.md',false],['README-PT-BR.md',true],
    ['benchmarks/racing/README.md',false],['benchmarks/racing/README-PT-BR.md',true]
  ]) {
    const content=read(file);
    const title=pt?'| Modelo atual |':'| Current model |';
    const start=content.indexOf(title);
    assert.ok(start!==-1,file+' current table exists');
    const end=content.indexOf('\n\n',start);
    const current=content.slice(start,end);
    assert.doesNotMatch(current,/Gemini 3\.8 Flash|gemini-3\.8-v3\.4/);
    assert.equal([...current.matchAll(/\*\*[^*]+\(V3\.4\)\*\*/g)].length,5);
    const otherHeading=pt?'Racing não frontier':'Non-frontier Racing';
    const sectionStart=content.lastIndexOf(otherHeading);
    assert.ok(sectionStart>end,file+' Non-frontier section follows active table');
    const nonfrontier=content.slice(sectionStart);
    assert.ok(nonfrontier.includes('**Gemini 3.8 Flash (V3.4)**'));
    assert.ok(nonfrontier.includes(pt?'Não frontier':'Non-frontier'));
    const local=(file.startsWith('benchmarks/racing/')?'./runs/':'./benchmarks/racing/runs/')
      +source+'/source/';
    assert.ok(nonfrontier.includes(']('+local+')'),file+' source link');
    assert.ok(nonfrontier.includes(site),file+' game link');
    assert.ok(!content.includes('https://github.com/bielxdh3/4argon'));
    assert.ok(!content.includes(['https://github.com/','bielxdh3/','sonnet55'].join('')));
  }
});

test('SVG is current-only and excludes both Gemini 3.8 visible text and ID', () => {
  const svg=read('assets/frontier-models-hero-v7.svg');
  assert.equal([...svg.matchAll(/data-role="run" data-benchmark="racing"/g)].length,5);
  assert.equal([...svg.matchAll(/data-role="run" data-benchmark="orbitarium"/g)].length,5);
  assert.ok(!svg.includes('Gemini 3.8 Flash'));
  assert.ok(!svg.includes('gemini-3.8-v3.4'));
  assert.match(svg,/aria-label="10 current runs: 5 Racing and 5 Orbitarium"/);
});
