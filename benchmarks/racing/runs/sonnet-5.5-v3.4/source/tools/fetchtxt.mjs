// dev helper: fetch a URL, print links matching a regex (arg2) and a text excerpt
const [url, rx] = process.argv.slice(2);
const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (asset lookup)' } });
const h = await r.text();
console.log('status', r.status, 'len', h.length);
if (rx) { const re = new RegExp(rx, 'g'); const seen = new Set(); let m; while ((m = re.exec(h))) { const s = m[0]; if (!seen.has(s)) { seen.add(s); console.log(s.replace(/\s+/g, ' ').slice(0, 220)); } } }
