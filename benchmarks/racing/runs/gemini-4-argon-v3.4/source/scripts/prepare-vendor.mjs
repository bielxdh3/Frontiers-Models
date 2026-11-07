import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const threeSrc = path.join(rootDir, 'node_modules', 'three');
const vendorThree = path.join(rootDir, 'vendor', 'three');

if (!fs.existsSync(threeSrc)) {
  console.log('[prepare-vendor] node_modules/three not present yet, skipping.');
  process.exit(0);
}

function copyDirFiltered(src, dest, filterFn = () => true) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(s, d, filterFn);
    } else if (filterFn(entry.name)) {
      fs.copyFileSync(s, d);
    }
  }
}

fs.mkdirSync(path.join(vendorThree, 'build'), { recursive: true });
for (const file of ['three.module.js', 'three.core.js']) {
  const srcFile = path.join(threeSrc, 'build', file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(vendorThree, 'build', file));
  }
}

const addonFolders = [
  'loaders',
  'postprocessing',
  'shaders',
  'csm',
  'objects',
  'utils',
  'math',
  'environments'
];

for (const folder of addonFolders) {
  copyDirFiltered(
    path.join(threeSrc, 'examples', 'jsm', folder),
    path.join(vendorThree, 'addons', folder),
    (name) => name.endsWith('.js')
  );
}

console.log('[prepare-vendor] Synced Three.js runtime modules to ./vendor/three');
