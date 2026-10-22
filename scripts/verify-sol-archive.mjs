import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const benchmark = resolve(root, 'benchmarks/solar-system');
const source = resolve(benchmark, 'runs/gpt-6.1-sol/source');
const manifestFile = resolve(benchmark, 'GPT-6.1-SOL-FILES.json');
const registry = JSON.parse(readFileSync(resolve(benchmark, 'RUNS.json'), 'utf8'));
const id = 'gpt-6.1-sol-source';
const sha = '7caaccc7f462806de10a1981c9826d3151e85407';
const hash = data => createHash('sha256').update(data).digest('hex');
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in source archive: ${path}`);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push({
      path: relative(source, path).split(sep).join('/'),
      bytes: statSync(path).size,
      sha256: hash(readFileSync(path))
    });
    else throw new Error(`Unsupported entry in source archive: ${path}`);
  }
}
walk(source);
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const run = registry.runs.find(r => r.id === id);
if (!run || run.model !== 'GPT-6.1 Sol' || run.source_commit !== sha ||
    run.target_path !== 'runs/gpt-6.1-sol/source' || run.prompt !== null ||
    run.archive_status !== 'self-contained' || run.arena_visibility !== 'current' ||
    !registry.current_arena.includes(id)) throw new Error('Sol registry metadata mismatch');
if (registry.current_arena.length !== 5 || new Set(registry.current_arena).size !== 5) {
  throw new Error('Current arena should contain exactly five distinct references');
}
for (const other of registry.runs) {
  if ('reasoning_effort' in other || 'thinking_level' in other) {
    throw new Error(`Forbidden reasoning tier in registry: ${other.id}`);
  }
}
// A Windows clone may check out CRLF; verify canonical Git blob LF bytes.
const actualPromptBytes = Buffer.from(readFileSync(resolve(benchmark, 'prompts/frontier-v2.md'), 'utf8').replaceAll('\r\n', '\n'), 'utf8');
const actualPrompt = hash(actualPromptBytes);
if (actualPrompt !== registry.prompts['frontier-v2'].sha256) {
  throw new Error('Shared Frontier V2 prompt digest changed');
}
if (actualPromptBytes.length !== registry.prompts['frontier-v2'].bytes) {
  throw new Error('Shared Frontier V2 prompt byte count changed');
}
for (const path of ['README.md', 'README-PT-BR.md', 'benchmarks/solar-system/README.md',
  'benchmarks/solar-system/README-PT-BR.md']) {
  if (!readFileSync(resolve(root, path), 'utf8').includes('GPT-6.1 Sol')) {
    throw new Error(`Sol missing from ${path}`);
  }
}
if (process.argv.includes('--create-manifest')) {
  if (existsSync(manifestFile)) throw new Error('Manifest already exists; never overwrite provenance');
  if (files.length !== 45) throw new Error(`Expected 45 source files, saw ${files.length}`);
  writeFileSync(manifestFile, JSON.stringify({
    source_repository: 'bielxdh3/6.1gptsol',
    source_commit: sha,
    note: 'SHA-256 of each byte-identical tracked file from the pinned source commit; no .git directory.',
    files
  }, null, 2) + '\n');
  console.log(`Created provenance manifest with ${files.length} file digests.`);
} else {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (manifest.source_commit !== sha || manifest.source_repository !== 'bielxdh3/6.1gptsol') {
    throw new Error('Source provenance manifest header mismatch');
  }
  if (files.length !== 45 || JSON.stringify(files) !== JSON.stringify(manifest.files)) {
    const mismatch = files.find((f, i) => JSON.stringify(f) !== JSON.stringify(manifest.files[i]));
    throw new Error(`Archived file checksum or file count mismatch: ${JSON.stringify(mismatch)}`);
  }
  console.log(`PASS: ${files.length}/${files.length} archived source SHA-256 digests, source metadata, current arena and prompt integrity.`);
}
