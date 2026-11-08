import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
  assert.deepEqual(registry.runs.map(r => r.id).sort(), ['gemini-3.8-flash', 'gpt-6-astra', 'gpt-6.1-sol', 'gemini-3.8-v3.4', 'gpt-6.1-sol-v3.4', 'gpt-6-astra-v3.4', 'opus-5.5-v3.4', 'gemini-4-argon-v3.4', 'sonnet-5.5-v3.4'].sort());
  for (const run of registry.runs) {
    assert.equal(run.gameplay_verification, 'not-independently-verified');
    assert.ok(run.source_commit);
    if (registry.legacy_runs.includes(run.id)) {
      assert.equal(run.live_url, null);
      assert.equal(run.display_status, 'legacy-archived');
      assert.ok(run.manifest);
      assert.ok(run.git_bundle);
    } else if (registry.non_frontier_runs.includes(run.id)) {
      assert.equal(run.id, 'gemini-3.8-v3.4');
      assert.equal(run.role, 'non-frontier-run');
      assert.equal(run.display_status, 'non-frontier-archived-source-site-live');
      assert.ok(!registry.current_arena.includes(run.id));
      assert.equal(run.live_url, 'https://racing-gemini-3.8-flash.biel.dev.br/');
      assert.equal(run.archival_status, 'complete-tracked-git-snapshot-lfs-pointer-no-history-bundle');
      assert.ok(run.manifest && run.provenance);
    } else {
      assert.ok(registry.current_arena.includes(run.id));
      if (run.id === 'gpt-6.1-sol-v3.4') {
        assert.equal(run.live_url, 'https://racing-gpt-6.1-sol.biel.dev.br/');
        assert.equal(run.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
      } else if (run.id === 'gpt-6-astra-v3.4') {
        assert.equal(run.id, 'gpt-6-astra-v3.4');
        assert.equal(run.live_url, 'https://racing-gpt-6-astra.biel.dev.br/', 'owner-provided Astra game URL');
        assert.match(run.site_status, /http-404-on-2026-11-05/);
        assert.equal(run.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
      } else if (run.id === 'sonnet-5.5-v3.4') {
        assert.equal(run.source_repository, null);
        assert.equal(run.live_url, 'https://racing-sonnet-5.5.biel.dev.br/');
        assert.equal(run.source_file_count, 2085);
        assert.equal(run.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
      } else if (run.id === 'gemini-4-argon-v3.4') {
        assert.equal(run.source_repository, null);
        assert.equal(run.live_url, 'https://racing-gemini-4-argon.biel.dev.br/');
        assert.equal(run.source_file_count, 450);
        assert.equal(run.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
      } else {
        assert.equal(run.id, 'opus-5.5-v3.4');
        assert.equal(run.live_url, 'https://racing-opus-5.5.biel.dev.br/', 'owner-provided Opus URL');
        assert.equal(run.site_url, run.live_url);
        assert.match(run.site_status, /http-404-on-2026-11-05/);
        assert.equal(run.source_repository, 'https://github.com/bielxdh3/opus55');
        assert.equal(run.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
      }
      assert.ok(run.manifest);
      assert.equal(run.git_bundle, null);
      assert.ok(run.provenance);
    }
  }
});

test('every Racing-bench execution can use the exact timeless operational tool addendum', () => {
  const record = registry.execution_addendum;
  assert.ok(record);
  assert.equal(record.required_with, 'racing-bench-any-version');
  assert.equal(record.path, 'EXECUTION-ADDENDUM.md');
  const content = file('benchmarks/racing/' + record.path);
  const canonical = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'));
  assert.equal(canonical.length, record.bytes);
  assert.equal(canonical.toString('utf8').split('\n').length - 1, record.lines);
  assert.equal(createHash('sha256').update(canonical).digest('hex'), record.sha256);
  assert.equal(canonical.toString('utf8').trim().split('\n').length, 3);
  assert.doesNotMatch(canonical.toString('utf8'), /V2\.6|V3\.4|^#/m);
  assert.match(canonical.toString('utf8'), /^You are authorized to use skills and tools needed/m);
  assert.match(canonical.toString('utf8'), /Playwright, DevTools, run builds/);
  assert.match(canonical.toString('utf8'), /delegating implementation to other AI agents/);
  assert.match(text('benchmarks/racing/README.md'), /EXECUTION-ADDENDUM\.md/);
  assert.match(text('benchmarks/racing/README-PT-BR.md'), /EXECUTION-ADDENDUM\.md/);
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
  assert.equal(registry.current_prompt, 'racing-v3.4');
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
  assert.equal(registry.current_prompt, 'racing-v3.4');
  const p=registry.prompts['racing-v3.3'];
  assert.equal(p.status,'historical-frozen-archived-unchanged');
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

test('Racing V3.4 prompt and 14 reference assets are present and pinned', () => {
  const p=registry.prompts['racing-v3.4'];
  const content=text('benchmarks/racing/'+p.path).replace(/\r\n/g,'\n');
  assert.equal(Buffer.byteLength(content),p.bytes);
  assert.equal(content.split('\n').length-1,p.lines);
  assert.equal(createHash('sha256').update(content).digest('hex'),p.sha256);
  const refDir=resolve(root,'benchmarks/racing',p.reference_directory);
  assert.ok(existsSync(refDir));
  assert.equal(readdirSync(refDir).filter(x=>x.endsWith('.jpg')).length,14);
  assert.deepEqual(registry.current_arena,['gpt-6.1-sol-v3.4', 'gpt-6-astra-v3.4', 'opus-5.5-v3.4', 'gemini-4-argon-v3.4', 'sonnet-5.5-v3.4']);
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
