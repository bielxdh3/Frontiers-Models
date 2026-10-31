import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const bench = resolve(root, 'benchmarks/solar-system');
const catalog = JSON.parse(readFileSync(resolve(bench, 'RUNS.json'), 'utf8'));
const argon = catalog.runs.find(x => x.id === 'gemini-4-argon-source');
const old = catalog.runs.find(x => x.id === 'gemini-3.8-flash-high-frontier-v2');
const hero = readFileSync(resolve(root, 'assets/frontier-models-hero-v7.svg'), 'utf8');

test('Gemini 4 Argon replaces Gemini 3.8 in arena but preserves historical record', () => {
  assert.equal(catalog.current_arena.length, 5);
  assert.ok(catalog.current_arena.includes(argon.id));
  assert.ok(!catalog.current_arena.includes(old.id));
  assert.ok(catalog.non_frontier_or_outdated.includes(old.id));
  assert.equal(old.source_commit, '805cfe87a6b4dcc64961130d4f9d2738f1005790');
  assert.equal(old.target_path, 'runs/gemini-3.8-flash/frontier-v2');
  assert.equal(old.prompt, 'prompts/frontier-v2.md');
  assert.equal(old.status, 'source-pinned');
  assert.equal(old.live_url, 'https://orbitarium-gemini-3.8-flash.biel.dev.br');
  assert.equal(argon.prompt, null);
  assert.equal(argon.live_url, 'https://orbitarium-gemini-4-argon.biel.dev.br');
});

test('primary SVG shows Gemini Argon while the archived registry retains Gemini 3.8', () => {
  assert.ok(hero.includes('Gemini 4 Argon'));
  assert.ok(!hero.includes('Gemini 3.8 Flash'));
  assert.equal([...hero.matchAll(/data-role="planet"/g)].length, 5);
  assert.equal([...hero.matchAll(/data-role="orbit"/g)].length, 5);
  assert.equal(existsSync(resolve(root, 'assets/frontier-v2-scores-v6.svg')), false);
});

for (const path of ['README.md', 'README-PT-BR.md',
  'benchmarks/solar-system/README.md', 'benchmarks/solar-system/README-PT-BR.md']) {
  test(`${path}: Argon current, 3.8 historical, both direct websites`, () => {
    const text = readFileSync(resolve(root, path), 'utf8');
    const current = text.split('## ')[1];
    assert.ok(current.includes('Gemini 4 Argon'));
    assert.ok(!current.includes('**Gemini 3.8 Flash**'));
    assert.ok(text.includes('https://orbitarium-gemini-4-argon.biel.dev.br'));
    assert.ok(text.includes('https://orbitarium-gemini-3.8-flash.biel.dev.br'));
  });
}
