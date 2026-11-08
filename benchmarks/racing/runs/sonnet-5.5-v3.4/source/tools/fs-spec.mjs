// dev helper: download spectrogram previews for a list of Freesound ids found via search (query + ids)
import fs from 'node:fs';
const [query, ids, out] = process.argv.slice(2);
const want = new Set(ids.split(','));
const UA = { 'User-Agent': 'Mozilla/5.0' };
fs.mkdirSync(out, { recursive: true });
const url = `https://freesound.org/search/?q=${encodeURIComponent(query)}&f=license%3A%22Creative+Commons+0%22&s=downloads+desc&advanced=0&g=1`;
const h = await (await fetch(url, { headers: UA })).text();
for (const p of h.split('class="bw-player"').slice(1)) {
  const g = k => (p.match(new RegExp(k + '="([^"]*)"')) || [])[1];
  const id = g('data-sound-id'); if (!want.has(id)) continue;
  const sp = g('data-spectrum');
  const r = await fetch(sp, { headers: UA });
  fs.writeFileSync(`${out}/${id}.jpg`, Buffer.from(await r.arrayBuffer()));
  console.log('spec', id, g('data-ogg'));
}
