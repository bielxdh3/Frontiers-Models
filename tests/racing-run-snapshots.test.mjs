import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const racing = resolve(root, 'benchmarks/racing');
const registry = JSON.parse(readFileSync(join(racing, 'RUNS.json'), 'utf8'));
const sha256 = b => createHash('sha256').update(b).digest('hex');
const gitBlob = b => createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');

function walk(dir, prefix = '') {
  const out = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + item.name : item.name;
    const next = join(dir, item.name);
    assert.ok(!item.isSymbolicLink(), 'unexpected archive symlink: ' + rel);
    if (item.isDirectory()) out.push(...walk(next, rel));
    else { assert.ok(item.isFile(), 'unexpected archive file type: ' + rel); out.push(rel); }
  }
  return out.sort();
}

for (const run of registry.runs.filter(run =>
  run.archival_status === 'complete-tracked-git-snapshot-and-full-history-bundle')) {
  test('byte-exact full source and Git-history archive: ' + run.model, () => {
    const manifest = JSON.parse(readFileSync(resolve(racing, run.manifest), 'utf8'));
    assert.equal(manifest.source_commit, run.source_commit);
    assert.equal(manifest.source_tree, run.source_tree);
    assert.equal(manifest.source_repository, run.source_repository);
    assert.equal(manifest.file_count, run.source_file_count);
    assert.equal(manifest.total_bytes, run.source_bytes);
    assert.equal(manifest.files.length, run.source_file_count);
    const sourceDir = resolve(racing, run.archive_path);
    const recordedPaths = new Set();
    let totalBytes = 0;
    for (const file of manifest.files) {
      const rel = file.path;
      assert.match(rel, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\w./+@() -]+$/, 'unsafe or unexpected source path');
      assert.ok(!recordedPaths.has(rel), 'duplicated source path: ' + rel);
      recordedPaths.add(rel);
      const filepath = resolve(sourceDir, ...rel.split('/'));
      assert.ok(filepath.startsWith(sourceDir + requireSeparator()), 'path escaped archive root');
      assert.ok(lstatSync(filepath).isFile(), 'not regular file: ' + rel);
      const bytes = readFileSync(filepath);
      assert.equal(bytes.length, file.bytes, rel);
      assert.equal(sha256(bytes), file.sha256, rel);
      assert.equal(gitBlob(bytes), file.git_blob_sha1, rel);
      assert.equal(file.mode, '100644', 'original file mode changed: ' + rel);
      totalBytes += bytes.length;
    }
    assert.equal(totalBytes, run.source_bytes);
    assert.deepEqual(walk(sourceDir), [...recordedPaths].sort(), 'missing or extra archive files');
    assert.equal(run.git_bundle, run.manifest.replace(/SOURCE-FILES\.json$/, manifest.repository_bundle.path));
    const bundle = readFileSync(resolve(racing, run.git_bundle));
    assert.equal(bundle.length, manifest.repository_bundle.bytes);
    assert.equal(sha256(bundle), manifest.repository_bundle.sha256);
    assert.equal(run.gameplay_verification, 'not-independently-verified');
  });
}

test('Gemini 3.8 Flash V3.4: all 188 upstream Git-tracked blobs archived byte-exactly', () => {
  const run = registry.runs.find(run => run.id === 'gemini-3.8-v3.4');
  assert.ok(run, 'current Gemini V3.4 entry');
  assert.deepEqual(registry.current_arena, [run.id]);
  assert.equal(run.archival_status, 'complete-tracked-git-snapshot-lfs-pointer-no-history-bundle');
  const manifest = JSON.parse(readFileSync(resolve(racing, run.manifest), 'utf8'));
  assert.equal(manifest.source_commit, run.source_commit);
  assert.equal(manifest.source_tree, run.source_tree);
  assert.equal(manifest.source_repository, run.source_repository);
  assert.equal(manifest.file_count, 188);
  assert.equal(manifest.total_bytes, 196549258);
  assert.equal(run.source_file_count, manifest.file_count);
  assert.equal(run.source_bytes, manifest.total_bytes);
  assert.equal(run.git_bundle, null);
  assert.deepEqual(manifest.lfs_pointer_paths, ['verification/volta.webm']);
  const dir = resolve(racing, run.archive_path);
  let bytesTotal = 0;
  const paths = new Set();
  for (const entry of manifest.files) {
    assert.match(entry.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\w./+@() -]+$/, entry.path);
    assert.equal(entry.mode, '100644', entry.path);
    assert.ok(!paths.has(entry.path), 'duplicate ' + entry.path);
    paths.add(entry.path);
    const filePath = resolve(dir, ...entry.path.split('/'));
    assert.ok(filePath.startsWith(dir + requireSeparator()));
    assert.ok(lstatSync(filePath).isFile());
    const contents = readFileSync(filePath);
    assert.equal(contents.length, entry.bytes, entry.path);
    assert.equal(sha256(contents), entry.sha256, entry.path);
    assert.equal(gitBlob(contents), entry.git_blob_sha1, entry.path);
    bytesTotal += contents.length;
  }
  assert.equal(paths.size, 188);
  assert.equal(bytesTotal, 196549258);
  const extra = walk(dir).filter(name => !paths.has(name));
  assert.deepEqual(extra, ['verification/.gitattributes'], 'only archive transport override allowed');
  const pointer = readFileSync(resolve(dir, 'verification/volta.webm'), 'utf8');
  assert.match(pointer, /^version https:\/\/git-lfs.github.com\/spec\/v1\n/);
  assert.match(pointer, /size 276400779/);
  assert.match(readFileSync(resolve(dir, 'verification/.gitattributes'), 'utf8'), /volta\.webm -filter/);
});

function requireSeparator() { return process.platform === 'win32' ? '\\' : '/'; }
