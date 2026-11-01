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
    assert.equal(run.display_status, 'legacy-archived');
    assert.equal(run.live_url, null);
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
  assert.match(text('benchmarks/racing/README.md'), /required \*\*BOTH\*\*/);
  assert.match(text('benchmarks/racing/README-PT-BR.md'), /\*\*OS DOIS\*\*/);
  assert.match(text('benchmarks/racing/prompts/README.md'), /For historical V2\.6 reproduction, supply \*\*both\*\*/);
});

test('Racing-bench is discoverable from both repository homepages', () => {
  for (const p of ['README.md', 'README-PT-BR.md']) {
    assert.match(text(p), /\]\(\.\/benchmarks\/racing\/\)/);
  }
});


test('Racing-bench V3.1 remains byte-exact in the historical archive', () => {
  const p = registry.prompts['racing-v3.1'];
  assert.equal(p.status, 'historical-frozen-archived');
  assert.equal(p.required_attachment, 'prompts/racing-v3.1-attach.md');
  const content = text('benchmarks/racing/' + p.path).replace(/\r\n/g, '\n');
  assert.equal(Buffer.byteLength(content), p.bytes);
  assert.equal(content.split('\n').length - 1, p.lines);
  assert.equal(createHash('sha256').update(content).digest('hex'), p.sha256);
  assert.match(content, /Frozen execution contract/);
});

test('Racing-bench V3.2 remains byte-exact and historically archived', () => {
  assert.equal(registry.current_prompt, 'racing-v3.3');
  const p = registry.prompts['racing-v3.2'];
  assert.equal(p.status, 'historical-frozen-archived');
  assert.equal(p.required_attachment, 'prompts/racing-v3.2-attach.md');
  const note = text('benchmarks/racing/' + p.required_attachment);
  assert.match(note, /attach this text together with the complete, unchanged V3\.2 prompt/i);
  assert.match(note, /Playwright, DevTools, run builds, debug, and test/i);
  assert.match(note, /All other rules of the Racing-bench V3\.2 prompt remain unchanged/);
  const content = text('benchmarks/racing/' + p.path).replace(/\r\n/g, '\n');
  assert.equal(Buffer.byteLength(content), p.bytes);
  assert.equal(content.split('\n').length - 1, p.lines);
  assert.equal(createHash('sha256').update(content).digest('hex'), p.sha256);
  assert.match(content, /Frozen execution contract/);
  assert.doesNotMatch(content, /REVIEW DRAFT|NOT FROZEN/);
  assert.deepEqual([...content.matchAll(/^## (\d{2})\./gm)].map(m => Number(m[1])), Array.from({length:72}, (_, i) => i));
  for(let i=1;i<=16;i++) {
    const u='U'+String(i).padStart(2,'0');
    const e='E'+String(i).padStart(2,'0');
    assert.match(content,new RegExp('\\b'+u+'\\b'));
    assert.match(content,new RegExp('\\b'+e+'\\b'));
  }
  assert.match(content, /G12 — Premium/);
  assert.match(content, /28\+ (?:files|genuine images|distinct)/);
  assert.equal(p.ui_ux.ui_probes,16);
  assert.equal(p.ui_ux.minimum_screenshots,28);
  assert.equal(p.ui_ux.additional_ui_screenshots,12);
  assert.equal(registry.legacy_runs.length,3);
});


test('Racing V3.3 frozen prompt preserves all legacy scopes and requires coastal world art', () => {
  assert.equal(registry.current_prompt, 'racing-v3.3');
  const p=registry.prompts['racing-v3.3'];
  assert.equal(p.status,'current-frozen-standalone-with-required-operational-clarification');
  assert.equal(p.required_attachment,'prompts/racing-v3.3-attach.md');
  const note=text('benchmarks/racing/'+p.required_attachment);
  assert.match(note,/attach this text together with the complete, unchanged V3\.3 prompt/i);
  assert.match(note,/Playwright, DevTools, run builds, debug, and test/i);
  const content=text('benchmarks/racing/'+p.path).replace(/\r\n/g,'\n');
  assert.equal(Buffer.byteLength(content),p.bytes);
  assert.equal(content.split('\n').length-1,p.lines);
  assert.equal(createHash('sha256').update(content).digest('hex'),p.sha256);
  assert.deepEqual([...content.matchAll(/^## (\d{2})\./gm)].map(m=>Number(m[1])),Array.from({length:78},(_,i)=>i));
  for(let i=1;i<=16;i++){
    assert.match(content,new RegExp('\\bE'+String(i).padStart(2,'0')+'\\b'));
    assert.match(content,new RegExp('\\bU'+String(i).padStart(2,'0')+'\\b'));
  }
  for(let i=1;i<=10;i++)assert.match(content,new RegExp('\\bW'+String(i).padStart(2,'0')+'\\b'));
  assert.match(content,/G13 — Complete Premium Coastal-City Environment and Material Art/);
  assert.match(content,/at least 38 total genuine browser screenshots/);
  assert.match(content,/No first-person or cockpit-camera requirement/);
  assert.equal(p.environment_art.world_probes,10);
  assert.equal(p.minimum_screenshots,38);
  assert.equal(p.ui_ux.ui_probes,16);
});

test('Racing V3.3 Gemini-review corrections preserve real frozen-world and evidence invariants', () => {
  const content = text('benchmarks/racing/prompts/racing-v3.3.md').replace(/\r\n/g, '\n');
  assert.match(content, /Clock\/Photo Mode invariant/);
  assert.match(content, /performance\.now\(\)/);
  assert.match(content, /E15 progressive path-tracing samples/);
  assert.match(content, /Environmental audio lifecycle/);
  assert.match(content, /dispose without stacked\/doubled nodes/);
  assert.match(content, /59 mandatory independent verification records/);
  assert.match(content, /at least 38 distinct, genuine browser screenshot files/);
  assert.match(content, /Sections 72–76 coastal-city\/beach\/surf/);
  assert.match(content, /Sections `40–77` are an integral part/);
  assert.match(content, /premium reflective\/transmissive exterior glazing \(no modeled interior required\)/);
  assert.match(content, /under the Section 34 M1 recovery-and-continuation rule/);
  assert.doesNotMatch(content, /W01–W12|40\+ images|Section 80|Sections `00` through `80`/);
  assert.equal(registry.prompts['racing-v3.3'].minimum_screenshots, 38);
  assert.equal(registry.prompts['racing-v3.3'].environment_art.world_probes, 10);
});
