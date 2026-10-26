import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const benchmark = resolve(root, 'benchmarks/solar-system');
const source = resolve(benchmark, 'runs/gemini-4-argon/source');
const manifestFile = resolve(benchmark, 'GEMINI-4-ARGON-FILES.json');
const registry = JSON.parse(readFileSync(resolve(benchmark, 'RUNS.json'), 'utf8'));
const argonId = 'gemini-4-argon-source';
const oldId = 'gemini-3.8-flash-high-frontier-v2';
const sourceSha = '318aa80bb5c49cbbfdfd4c3d267ad88d56ae3f98';
const hash = data => createHash('sha256').update(data).digest('hex');

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in tracked source: ${path}`);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push({
      path: relative(source, path).split(sep).join('/'),
      bytes: statSync(path).size,
      sha256: hash(readFileSync(path))
    });
    else throw new Error(`Unsupported archived entry: ${path}`);
  }
}
walk(source);
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
if (files.length !== 35) throw new Error(`Argon snapshot expects 35 tracked files, got ${files.length}`);
if (process.argv.includes('--create-manifest')) {
  if (existsSync(manifestFile)) throw new Error('Never overwrite a pinned provenance manifest');
  writeFileSync(manifestFile, JSON.stringify({
    source_repository: 'bielxdh3/gemini-argon',
    source_commit: sourceSha,
    note: 'SHA-256 for each unchanged file in the source commit (including tracked dist files), excluding only .git.',
    files
  }, null, 2) + '\n');
}
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
if (manifest.source_repository !== 'bielxdh3/gemini-argon' || manifest.source_commit !== sourceSha ||
    JSON.stringify(manifest.files) !== JSON.stringify(files)) {
  throw new Error('Argon archived source integrity mismatch');
}
const argon = registry.runs.find(run => run.id === argonId);
const old = registry.runs.find(run => run.id === oldId);
if (!argon || !old || argon.model !== 'Gemini 4 Argon' ||
    argon.source_commit !== sourceSha || argon.prompt !== null ||
    argon.target_path !== 'runs/gemini-4-argon/source' ||
    argon.archive_status !== 'self-contained' || argon.status !== 'imported' ||
    argon.live_url !== 'https://gemini-4-argon.biel.dev.br/' ||
    argon.arena_visibility !== 'current' || old.source_commit !== '805cfe87a6b4dcc64961130d4f9d2738f1005790' ||
    old.archive_status !== 'source-repository-pinned' || old.status !== 'source-pinned' ||
    old.live_url !== 'https://gemini-3.8-flash.biel.dev.br' ||
    old.arena_visibility !== 'non-frontier-or-outdated') {
  throw new Error('Argon or historical Gemini 3.8 metadata mismatch');
}
if (registry.current_arena.length !== 5 ||
    !registry.current_arena.includes(argonId) ||
    registry.current_arena.includes(oldId) ||
    !registry.non_frontier_or_outdated.includes(oldId)) {
  throw new Error('Current vs historical arena classification mismatch');
}
const prompt = Buffer.from(readFileSync(resolve(benchmark, 'prompts/frontier-v2.md'), 'utf8').replaceAll('\r\n', '\n'), 'utf8');
if (hash(prompt) !== registry.prompts['frontier-v2'].sha256) {
  throw new Error('Historical shared input altered');
}
for (const path of ['README.md', 'README-PT-BR.md', 'benchmarks/solar-system/README.md',
  'benchmarks/solar-system/README-PT-BR.md']) {
  const text = readFileSync(resolve(root, path), 'utf8');
  if (!text.includes('Gemini 4 Argon') || !text.includes('Gemini 3.8 Flash') ||
      !text.includes('https://gemini-4-argon.biel.dev.br/')) {
    throw new Error(`Incomplete source links / historical preservation in ${path}`);
  }
}
console.log(`PASS: Argon ${files.length}/${files.length} SHA-256, current arena with 5 models, historical Gemini 3.8 retained, prompt unchanged.`);
