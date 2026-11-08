// Dev-time helper to browse OpenGameArt (CC0 audio search) and fetch direct file links.
//   node tools/oga.mjs search "<keywords>"      -> lists CC0 audio results (title | slug)
//   node tools/oga.mjs files <slug>             -> lists downloadable files + license line
//   node tools/oga.mjs get <url> <destFile>     -> download a file
import fs from 'node:fs';
import path from 'node:path';

const UA = { 'User-Agent': 'Mozilla/5.0 (racing-bench asset lookup; CC0 only)' };
const [cmd, a, b] = process.argv.slice(2);

async function html(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.text();
}
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

if (cmd === 'search') {
  // art type 12 = Audio ; license tid 4 = CC0
  const url = `https://opengameart.org/art-search?keys=${encodeURIComponent(a)}&field_art_type_tid%5B0%5D=12&field_art_licenses_tid%5B0%5D=4`;
  const h = await html(url);
  const re = /<a href="\/content\/([^"#?]+)"[^>]*>([^<]{3,120})<\/a>/g;
  const seen = new Set(); let m;
  while ((m = re.exec(h))) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    console.log(strip(m[2]), '|', m[1]);
  }
} else if (cmd === 'files') {
  const h = await html('https://opengameart.org/content/' + a.split('content/').pop().replace(/^\//, ''));
  const lic = (h.match(/License\(s\):[\s\S]{0,300}/) || [''])[0];
  console.log('LICENSE:', strip(lic).slice(0, 120));
  const re = /href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g; let m; const seen = new Set();
  while ((m = re.exec(h))) { if (!seen.has(m[1])) { seen.add(m[1]); console.log(decodeURIComponent(m[1])); } }
  const dm = strip((h.match(/<div class="field-name-body"[\s\S]{0,1500}/) || [''])[0]).slice(0, 400);
  console.log('DESC:', dm);
} else if (cmd === 'get') {
  const r = await fetch(a, { headers: UA });
  if (!r.ok) throw new Error(a + ' -> ' + r.status);
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.writeFileSync(b, Buffer.from(await r.arrayBuffer()));
  console.log('saved', b, fs.statSync(b).size);
}
