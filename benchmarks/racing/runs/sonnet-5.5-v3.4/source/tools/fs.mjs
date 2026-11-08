// Dev-time Freesound lookup (CC0 only, no login: uses the public preview files).
//   node tools/fs.mjs search "<query>" [maxResults=15] [minDur] [maxDur]
//   node tools/fs.mjs get <soundId> <destFile>     (downloads the hq mp3 preview; needs id from search)
//   node tools/fs.mjs info <username> <soundId>    (license + description + tags)
import fs from 'node:fs';
import path from 'node:path';

const UA = { 'User-Agent': 'Mozilla/5.0 (racing-bench asset lookup; CC0 only)' };
const [cmd, a, b, c, d] = process.argv.slice(2);
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

if (cmd === 'search') {
  const max = +(b || 15), minD = +(c || 0), maxD = +(d || 1e9);
  const url = `https://freesound.org/search/?q=${encodeURIComponent(a)}&f=license%3A%22Creative+Commons+0%22&s=downloads+desc&advanced=0&g=1`;
  const h = await (await fetch(url, { headers: UA })).text();
  const parts = h.split('class="bw-player"').slice(1);
  let n = 0;
  for (const p of parts) {
    const g = k => (p.match(new RegExp(k + '="([^"]*)"')) || [])[1];
    const dur = parseFloat(g('data-duration'));
    if (dur < minD || dur > maxD) continue;
    const id = g('data-sound-id'), user = g('data-username');
    console.log(`${id}\t${dur.toFixed(1)}s\t${g('data-samplerate')}\t${g('data-num-downloads')}dl\t${user}\t${strip(g('data-title') || '')}\t${g('data-mp3')}`);
    if (++n >= max) break;
  }
} else if (cmd === 'info') {
  const h = await (await fetch(`https://freesound.org/people/${a}/sounds/${b}/`, { headers: UA })).text();
  const lic = (h.match(/Creative Commons 0|CC0|Attribution(?: NonCommercial)?|Sampling\+/) || ['?'])[0];
  const desc = strip((h.match(/id="soundDescriptionSection"[\s\S]{0,1800}/) || [''])[0]).slice(0, 500);
  const tags = [...h.matchAll(/href="\/browse\/tags\/([^\/"]+)\//g)].map(m => m[1]);
  console.log('license:', lic, '| tags:', [...new Set(tags)].slice(0, 14).join(','), '\n', desc);
} else if (cmd === 'get') {
  // a = full preview url (from search), b = dest
  const url = a.replace('-lq.', '-hq.');
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.writeFileSync(b, Buffer.from(await r.arrayBuffer()));
  console.log('saved', b, fs.statSync(b).size);
}

if (cmd === 'dl') {
  // node tools/fs.mjs dl <user> <id> <destBase>  -> destBase.ogg (hq preview) + appends to assets/audio/sources.json
  const user = a, id = b, dest = c;
  const html = await (await fetch(`https://freesound.org/people/${user}/sounds/${id}/`, { headers: UA })).text();
  const ogg = (html.match(/data-ogg="([^"]+)"/) || [])[1];
  const title = (html.match(/data-title="([^"]*)"/) || [])[1] || '';
  const lic = /creativecommons\.org\/publicdomain\/zero/.test(html) ? 'CC0 1.0' : 'UNKNOWN';
  if (!ogg) throw new Error('no preview for ' + id);
  const url = ogg.replace('-lq.', '-hq.');
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest + '.ogg', Buffer.from(await r.arrayBuffer()));
  const mf = path.resolve('assets/audio/sources.json');
  let m = {}; try { m = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch {}
  m['freesound-' + id] = { source: 'Freesound', url: `https://freesound.org/people/${user}/sounds/${id}/`, author: user, title: strip(title), license: lic, file: path.basename(dest) + '.ogg' };
  fs.writeFileSync(mf, JSON.stringify(m, null, 1));
  console.log('dl', id, lic, strip(title).slice(0, 50), fs.statSync(dest + '.ogg').size);
}
