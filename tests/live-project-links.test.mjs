import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runs = JSON.parse(readFileSync(resolve(root, 'benchmarks/solar-system/RUNS.json'), 'utf8')).runs;
const expected = new Map([
  ['GPT-6.1 Sol', 'https://gpt-6.1-sol.biel.dev.br/'],
  ['GPT-5.6 Luna', 'https://gpt-5.6-luna.biel.dev.br/'],
]);

test('live project metadata points to the requested website, not the source repository', () => {
  for (const [name, url] of expected) {
    const matches = runs.filter(run => run.model === name);
    assert.equal(matches.length, 1, `${name} should have one registry record`);
    assert.equal(matches[0].live_url, url);
    assert.ok(!matches[0].live_url.includes('github.com'));
  }
});

for (const file of ['README.md', 'README-PT-BR.md',
  'benchmarks/solar-system/README.md', 'benchmarks/solar-system/README-PT-BR.md']) {
  test(`${file} renders live website URLs for Sol and Luna`, () => {
    const text = readFileSync(resolve(root, file), 'utf8');
    for (const [model, url] of expected) {
      const rows = text.split('\n').filter(line =>
        line.startsWith('|') && line.includes(`**${model}**`));
      assert.equal(rows.length, 1, `expected one table entry for ${model}`);
      const cells = rows[0].split('|').map(x => x.trim());
      const liveCell = cells[3];
      assert.ok(liveCell.includes(`](${url})`), `${model} live link must be ${url}`);
      assert.ok(!liveCell.includes('github.com'), `${model} live cell must not link to GitHub`);
    }
  });
}
