// Dev helper: print title / author / licence / page URL of an OpenGameArt entry (for ASSET-LICENSES.md).  node tools/oga-meta.mjs <slug>
const slug = process.argv[2];
const r = await fetch('https://opengameart.org/content/' + slug, { headers: { 'User-Agent': 'Mozilla/5.0 (racing-bench asset lookup; CC0 only)' } });
const h = await r.text();
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const title = strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ['', ''])[1]);
const by = strip((h.match(/Submitted by[\s\S]{0,300}?<a[^>]*>([\s\S]*?)<\/a>/i) || h.match(/<a href="\/users\/[^"]+"[^>]*>([\s\S]*?)<\/a>/) || ['', ''])[1]);
const lic = strip((h.match(/License\(s\):[\s\S]{0,200}/) || [''])[0]).slice(0, 60);
console.log(JSON.stringify({ slug, title, author: by, license: lic, url: 'https://opengameart.org/content/' + slug }));
