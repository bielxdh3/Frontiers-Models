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

test('Racing-bench source runs have provenance records, without claiming gameplay verification', () => {
  assert.deepEqual(registry.runs.map(r => r.id).sort(), ['gemini-3.8-flash', 'gpt-6-astra', 'gpt-6.1-sol'].sort());
  for (const run of registry.runs) {
    assert.equal(run.gameplay_verification, 'not-independently-verified');
    assert.ok(run.source_commit);
    assert.ok(run.manifest);
    assert.ok(run.git_bundle);
  }
});

test('every Racing-bench V2.6 execution requires the separate operational tool addendum', () => {
  const record = registry.execution_addendum;
  assert.ok(record);
  assert.equal(record.required_with, 'racing-v2.6');
  assert.equal(record.path, 'EXECUTION-ADDENDUM.md');
  const content = file('benchmarks/racing/' + record.path);
  const canonical = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'));
  assert.equal(canonical.length, record.bytes);
  assert.equal(canonical.toString('utf8').split('\n').length - 1, record.lines);
  assert.equal(createHash('sha256').update(canonical).digest('hex'), record.sha256);
  assert.match(canonical.toString('utf8'), /both complete documents together/i);
  assert.match(canonical.toString('utf8'), /Playwright or browser DevTools/);
  assert.match(canonical.toString('utf8'), /No delegation/);
  assert.match(text('benchmarks/racing/README.md'), /Always supply BOTH documents together/);
  assert.match(text('benchmarks/racing/README-PT-BR.md'), /Sempre envie os DOIS documentos juntos/);
  assert.match(text('benchmarks/racing/prompts/README.md'), /Every new Racing-bench V2.6 run must receive both/);
});

test('Racing-bench is discoverable from both repository homepages', () => {
  for (const p of ['README.md', 'README-PT-BR.md']) {
    assert.match(text(p), /\]\(\.\/benchmarks\/racing\/\)/);
  }
});
