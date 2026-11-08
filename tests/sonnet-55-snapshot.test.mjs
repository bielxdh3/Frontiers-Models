import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const bench = resolve(root, 'benchmarks/racing');
const registry = JSON.parse(readFileSync(resolve(bench, 'RUNS.json'), 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');
const gitBlob = data => createHash('sha1')
  .update(Buffer.from('blob ' + data.length + '\0')).update(data).digest('hex');

function walk(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes:true })) {
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    const path = join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), rel + ': unexpected symlink');
    if (entry.isDirectory()) found.push(...walk(path, rel));
    else {
      assert.ok(entry.isFile(), rel + ': not a regular file');
      found.push(rel);
    }
  }
  return found.sort();
}

test('Sonnet 5.5: complete Git-tracked source is byte-exact, self-contained, and linkable locally', () => {
  const id = 'sonnet-5.5-v3.4';
  const run = registry.runs.find(r => r.id === id);
  assert.ok(run && registry.current_arena.includes(id));
  assert.equal(run.model, 'Sonnet 5.5');
  assert.equal(run.source_repository, null);
  assert.equal(run.source_commit, 'f2400ade4bb8485c768adfa379fd1b4f0d958807');
  assert.equal(run.source_tree, 'de894f9787d161fd35e96f0dd993eab3984ca453');
  assert.equal(run.source_file_count, 2085);
  assert.equal(run.source_bytes, 460836454);
  assert.equal(run.git_bundle, null);
  assert.equal(run.archival_status, 'complete-tracked-git-snapshot-no-history-bundle');
  assert.equal(run.live_url, 'https://racing-sonnet-5.5.biel.dev.br/');
  assert.equal(run.site_url, run.live_url);

  const manifest = JSON.parse(readFileSync(resolve(bench, run.manifest), 'utf8'));
  assert.equal(manifest.source_repository, null);
  assert.equal(manifest.source_commit, run.source_commit);
  assert.equal(manifest.source_tree, run.source_tree);
  assert.equal(manifest.file_count, run.source_file_count);
  assert.equal(manifest.total_bytes, run.source_bytes);
  assert.equal(manifest.files.length, 2085);
  assert.deepEqual(manifest.lfs_pointer_paths, []);
  assert.equal(manifest.repository_bundle, null);
  const dir = resolve(bench, run.archive_path);
  const paths = new Set();
  let total = 0;
  for (const entry of manifest.files) {
    assert.ok(!entry.path.startsWith('/') && !entry.path.includes('\\') &&
      entry.path.split('/').every(part => part !== '' && part !== '.' && part !== '..'),
      'unsafe source filename: ' + entry.path);
    assert.ok(!paths.has(entry.path), 'duplicate source path: ' + entry.path);
    paths.add(entry.path);
    assert.equal(entry.mode, '100644', entry.path);
    const path = resolve(dir, ...entry.path.split('/'));
    assert.ok(path.startsWith(dir + sep), entry.path);
    assert.ok(lstatSync(path).isFile(), entry.path);
    const data = readFileSync(path);
    assert.equal(data.length, entry.bytes, entry.path);
    assert.equal(sha(data), entry.sha256, entry.path);
    assert.equal(gitBlob(data), entry.git_blob_sha1, entry.path);
    total += data.length;
  }
  assert.equal(total, 460836454);
  assert.deepEqual(walk(dir), [...paths].sort());
  const provenance = readFileSync(resolve(bench, run.provenance), 'utf8');
  assert.ok(provenance.includes('[Sonnet 5.5 source](./source/)'));
  assert.ok(!provenance.includes(['github.com/', 'bielxdh3/', 'sonnet55'].join('')));
  for (const file of ['README.md', 'README-PT-BR.md', 'benchmarks/racing/README.md',
    'benchmarks/racing/README-PT-BR.md']) {
    const content = readFileSync(resolve(root, file), 'utf8');
    const href = (file.startsWith('benchmarks/racing/') ? './runs/' : './benchmarks/racing/runs/') + id + '/source/';
    assert.ok(content.includes('[Sonnet 5.5](' + href + ')'), file);
    assert.ok(content.includes(run.live_url), file);
    assert.ok(!content.includes(['github.com/', 'bielxdh3/', 'sonnet55'].join('')), file);
    assert.doesNotMatch(content, /122\.8 FPS|174\.3 FPS|2,085 files|460,836,454 bytes/);
  }
});
