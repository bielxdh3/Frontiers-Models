// Copies the exact three.js build + the few addons we use from node_modules into lib/ so the game is a
// self-contained static site (works offline, without node_modules). Run: npm run vendor
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'node_modules', 'three');
const DST = path.join(ROOT, 'lib', 'three');
if (!fs.existsSync(SRC)) { console.error('node_modules/three missing: run npm ci first'); process.exit(1); }

function copyFile(a, b) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); }
function copyDir(a, b, filter = () => true) {
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    const pa = path.join(a, e.name), pb = path.join(b, e.name);
    if (e.isDirectory()) copyDir(pa, pb, filter);
    else if (filter(pa)) copyFile(pa, pb);
  }
}
fs.rmSync(DST, { recursive: true, force: true });
for (const f of ['three.module.js', 'three.core.js']) copyFile(path.join(SRC, 'build', f), path.join(DST, f));
const ADD = path.join(SRC, 'examples', 'jsm');
for (const d of ['csm', 'postprocessing', 'shaders', 'utils', 'math', 'objects', 'geometries', 'curves', 'lights', 'environments', 'modifiers', 'materials', 'misc'])
  if (fs.existsSync(path.join(ADD, d))) copyDir(path.join(ADD, d), path.join(DST, 'addons', d), p => p.endsWith('.js'));
for (const f of ['RGBELoader.js', 'HDRLoader.js']) if (fs.existsSync(path.join(ADD, 'loaders', f))) copyFile(path.join(ADD, 'loaders', f), path.join(DST, 'addons', 'loaders', f));
fs.copyFileSync(path.join(SRC, 'LICENSE'), path.join(DST, 'LICENSE'));
const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(DST, 'VERSION.txt'), `three@${pkg.version} (MIT) vendored by scripts/vendor.mjs\n`);
let n = 0, bytes = 0; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } })(DST);
console.log(`vendored three@${pkg.version}: ${n} files, ${(bytes / 1048576).toFixed(1)} MB -> lib/three`);
