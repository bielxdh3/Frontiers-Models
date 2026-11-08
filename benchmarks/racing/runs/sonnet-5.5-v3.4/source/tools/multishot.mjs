// Dev tool: one page load, many screenshots. node tools/multishot.mjs --q "?dev=1" --shots shots.json [--w 1920 --h 1080]
// shots.json = [{ "out": "shots/a.png", "js": "code evaluated before the shot", "wait": 600 }, ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../scripts/serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]) : a), []));
const shots = JSON.parse(fs.readFileSync(args.shots, 'utf8'));
const W = +(args.w || 1920), H = +(args.h || 1080), port = +(args.port || 8141);
const srv = await startServer(port, { quiet: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || args.verbose) logs.push(`[${m.type()}] ${t.slice(0, 300)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + String(e.stack || e).slice(0, 600)));
await page.goto(`http://127.0.0.1:${port}/index.html${args.q || ''}`);
await page.waitForFunction(() => window.__RACING__ && window.__RACING__.ready === true, null, { timeout: 120000 });
for (const s of shots) {
  if (s.js) { const r = await page.evaluate(s.js); if (r !== undefined && r !== null) console.log(s.out, '->', JSON.stringify(r)); }
  await page.waitForTimeout(s.wait ?? 700);
  fs.mkdirSync(path.dirname(s.out), { recursive: true });
  await page.screenshot({ path: s.out });
  const info = await page.evaluate(() => ({ fps: +(window.__RACING__?.fps || 0).toFixed(1), calls: window.__RACING__?.renderer?.info?.render?.calls, tris: window.__RACING__?.renderer?.info?.render?.triangles }));
  console.log('saved', s.out, JSON.stringify(info));
}
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close(); srv.close();
