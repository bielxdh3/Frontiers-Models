import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p, 'utf8');
const registry = JSON.parse(read('benchmarks/racing/RUNS.json'));
test('Fable metrics are scoped to the benchmark, with explicit cache and time accounting', () => {
  const run = registry.runs.find(r => r.id === 'fable-5.2-v3.4.1');
  const m = run.execution_metrics;
  assert.equal(m.status, 'owner-reported-not-independently-verified');
  assert.deepEqual(m.excluded_models, ['Haiku 5.5', 'Sonnet 5.5']);
  assert.equal(m.scope, 'benchmark-only-target-model-until-delivery');
  assert.equal(m.model_calls, 817);
  assert.equal(m.wall_clock_minutes, (Date.parse(m.delivered_at_utc) - Date.parse(m.started_at_utc)) / 60000);
  assert.equal(m.wall_clock_minutes, 933);
  assert.equal(m.primary_time_metric, 'active_minutes_estimate');
  assert.equal(m.active_minutes_estimate, 660);
  assert.deepEqual(m.active_minutes_estimate_range, [582,714]);
  assert.ok(m.active_minutes_estimate_range[0] <= m.active_minutes_estimate && m.active_minutes_estimate <= m.active_minutes_estimate_range[1]);
  assert.ok(m.active_minutes_estimate_range[1] <= m.wall_clock_minutes);
  assert.deepEqual(m.tokens, {input_uncached:1654, output:1981943, cache_write:4531425, cache_read:469228912, total:475743934});
  const { total, ...parts } = m.tokens;
  assert.equal(total, Object.values(parts).reduce((a,b) => a+b,0));
  for(const run of registry.runs.filter(r => !['fable-5.2-v3.4.1','gpt-astra-6.2-v3.4.1'].includes(r.id))) assert.equal(run.execution_metrics, undefined);
  assert.match(read('benchmarks/racing/' + m.details), /475,743,934/);
});
test('both README languages show Fable execution metrics and unknown prior values', () => {
  for (const p of ['README.md', 'README-PT-BR.md','benchmarks/racing/README.md','benchmarks/racing/README-PT-BR.md']) {
    const s=read(p);
    const row=s.split('\n').find(l=>l.startsWith('|') && l.includes('**Fable 5.2 (V3.4.1)**'));
    assert.ok(row, p);
    assert.match(row, /475[.,]74/);
    assert.match(row, /~11\s*h/);
    assert.match(s, /\| (?:Time|Tempo) \|/);
    assert.doesNotMatch(row, /15\s*h\s*33/);
    assert.match(s, /EXECUTION-METRICS\.md/);
    const other=s.split('\n').find(l=>l.startsWith('|') && l.includes('**GPT-6.1 Sol**') && l.includes('gpt-6.1-sol-v3.4/source/'));
    assert.match(other, /\| — \| — \|$/);
  }
});

test('Astra quota is not a token count and elapsed interval is not active time', () => {
 const m = registry.runs.find(r => r.id === 'gpt-astra-6.2-v3.4.1').execution_metrics;
 assert.equal(m.tokens, null);
 assert.equal(m.weekly_quota_percent, 21.55);
 assert.equal(m.five_hour_quota_percent, 137.9);
 assert.equal(m.reported_model_usage_share_percent['GPT-6 Astra'], 98);
 assert.equal(m.active_minutes_estimate, null);
 assert.equal(m.observed_elapsed_minutes, 302);
 assert.equal((Date.parse(m.observed_end_local)-Date.parse(m.observed_start_local))/60000, 302);
 assert.equal(m.final_verification_seconds, 170.198);
 for (const p of ['README.md','README-PT-BR.md','benchmarks/racing/README.md','benchmarks/racing/README-PT-BR.md']) {
  const s=read(p), row=s.split('\n').find(l => l.startsWith('|') && l.includes('**GPT-6.2 Astra (V3.4.1)**'));
  assert.ok(row && row.includes('](https://racing-gpt-6.2-astra.biel.dev.br/)'),p);
  assert.ok(row && (row.includes('21.55%\\*') || row.includes('21,55%\\*')),p);
  assert.ok(row.includes('02') || (p === 'README.md' && row.includes('~5h')),p);
  assert.ok(s.includes('Plus'),p);
 }
});
