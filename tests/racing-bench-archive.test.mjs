import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const file = path => readFileSync(resolve(root, path));
const text = path => file(path).toString('utf8');
const registry = JSON.parse(text('benchmarks/racing/RUNS.json'));

test('Racing-bench V2.6 prompt is archived verbatim', () => {
  assert.equal(registry.benchmark, 'racing-bench');
  const record = registry.prompts['racing-v2.6'];
  assert.ok(record);
  assert.equal(record.path, 'prompts/racing-v2.6.md');
  const content = file('benchmarks/racing/' + record.path);
  // Windows checkouts may convert LF to CRLF; Git archives use LF.
  const canonical = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  assert.equal(canonical.length, record.bytes);
  assert.equal(canonical.toString('utf8').split('\n').length - 1, record.lines);
  assert.equal(createHash('sha256').update(canonical).digest('hex'), record.sha256);
  assert.match(canonical.toString('utf8'), /\*\*Version 2\.6 — Standalone implementation brief\*\*/);
});

test('Racing-bench runs are not claimed before provenance exists', () => {
  assert.deepEqual(registry.runs, []);
  assert.match(text('benchmarks/racing/README.md'), /no completed, independently verifiable run/i);
});

test('Racing-bench is discoverable from both repository homepages', () => {
  for (const p of ['README.md', 'README-PT-BR.md']) {
    assert.match(text(p), /\]\(\.\/benchmarks\/racing\/\)/);
  }
});
