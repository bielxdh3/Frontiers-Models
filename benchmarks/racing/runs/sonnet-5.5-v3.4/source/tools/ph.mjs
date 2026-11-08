// Poly Haven (CC0) asset fetcher. Dev-time tool only — the shipped game never touches the network.
//   node tools/ph.mjs tex  <id[,id...]> [res=2k]   -> assets/textures/<id>/{diff,nor,arm}.jpg
//   node tools/ph.mjs hdri <id> [res=4k]           -> assets/hdri/<id>.hdr
//   node tools/ph.mjs prev <id[,id...]> <outDir>   -> 1k diffuse previews for look-dev
// Every download is appended to assets/ph-manifest.json (used to write ASSET-LICENSES.md).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const API = 'https://api.polyhaven.com';
const UA = { 'User-Agent': 'racing-bench-asset-fetch/1.0 (CC0 asset download for a local game build)' };
const MANIFEST = path.join(ROOT, 'assets', 'ph-manifest.json');

async function getJson(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}
function record(entry) {
  let m = {};
  try { m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { /* new */ }
  m[entry.id] = entry;
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 1));
}
function pick(map, res, fmts) {
  if (!map) return null;
  const order = [res, '2k', '1k', '4k'];
  for (const r of order) for (const f of fmts) if (map[r] && map[r][f]) return map[r][f];
  return null;
}

const [cmd, ids, arg3] = process.argv.slice(2);
if (cmd === 'tex') {
  const res = arg3 || '2k';
  for (const id of ids.split(',')) {
    const files = await getJson(`${API}/files/${id}`);
    const info = await getJson(`${API}/info/${id}`);
    const dir = path.join(ROOT, 'assets', 'textures', id);
    const got = {};
    const diff = pick(files.Diffuse || files.diff, res, ['jpg']);
    const nor = pick(files.nor_gl, res, ['jpg', 'png']);
    const arm = pick(files.arm, res, ['jpg']);
    const rough = arm ? null : pick(files.Rough, res, ['jpg']);
    const tasks = [['diff', diff], ['nor', nor], ['arm', arm], ['rough', rough]].filter(t => t[1]);
    for (const [k, f] of tasks) {
      const ext = path.extname(new URL(f.url).pathname) || '.jpg';
      const n = await download(f.url, path.join(dir, `${k}${ext}`));
      got[k] = `${k}${ext}`;
      console.log(`  ${id}/${k}${ext}  ${(n / 1048576).toFixed(2)} MB`);
    }
    record({ id, kind: 'texture', res, url: `https://polyhaven.com/a/${id}`, license: 'CC0 1.0', authors: info.authors, files: got });
    console.log('ok', id);
  }
} else if (cmd === 'hdri') {
  const id = ids; const res = arg3 || '4k';
  const files = await getJson(`${API}/files/${id}`);
  const info = await getJson(`${API}/info/${id}`);
  const f = pick(files.hdri, res, ['hdr']);
  const dest = path.join(ROOT, 'assets', 'hdri', `${id}_${res}.hdr`);
  const n = await download(f.url, dest);
  record({ id, kind: 'hdri', res, url: `https://polyhaven.com/a/${id}`, license: 'CC0 1.0', authors: info.authors, files: { hdr: `${id}_${res}.hdr` } });
  console.log('ok', id, (n / 1048576).toFixed(2), 'MB');
} else if (cmd === 'prev') {
  const out = arg3;
  fs.mkdirSync(out, { recursive: true });
  for (const id of ids.split(',')) {
    try {
      const files = await getJson(`${API}/files/${id}`);
      const diff = pick(files.Diffuse || files.diff, '1k', ['jpg']);
      await download(diff.url, path.join(out, `${id}.jpg`));
      console.log('prev', id);
    } catch (e) { console.log('FAIL', id, e.message); }
  }
} else {
  console.log('usage: tex|hdri|prev');
}
