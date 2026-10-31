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

for (const run of registry.runs) {
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

function requireSeparator() { return process.platform === 'win32' ? '\\' : '/'; }
