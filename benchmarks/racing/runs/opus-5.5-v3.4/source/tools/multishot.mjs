// Dev helper: load the game once, then capture several views.
// Usage: node tools/multishot.mjs "<query>" <outPrefix> '<json array of js snippets>' [width height waitMs]
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const [, , query = 'dev=1', prefix = 'shot', snippetsJson = '[]', W = '1920', H = '1080', waitMs = '700'] = process.argv;
const snippets = JSON.parse(snippetsJson);
const port = 8300 + Math.floor(Math.random() * 400);
const server = await startServer(port);
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/index.html?${query}`);
try { await page.waitForFunction(() => (window.__game && window.__game.ready) || window.__gameError, null, { timeout: 120000 }); }
catch (e) { console.log('READY TIMEOUT'); for (const l of logs.slice(0, 60)) console.log(l); await browser.close(); server.close(); process.exit(1); }
const err = await page.evaluate(() => window.__gameError); if (err) console.log('GAME ERROR', err);
for (let i = 0; i < snippets.length; i++) {
  const r = await page.evaluate(snippets[i]);
  if (r !== undefined) console.log(i, 'js ->', typeof r === 'string' ? r : JSON.stringify(r));
  await page.waitForTimeout(+waitMs);
  await page.screenshot({ path: `${prefix}${i}.png` });
}
for (const l of logs.filter((l) => !l.includes('[warning]')).slice(0, 30)) console.log(l);
await browser.close(); server.close();
