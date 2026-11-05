// Dev helper: open the game with URL params, optionally run a JS snippet, wait, screenshot.
// Usage: node tools/shot.mjs "<query>" <out.png> [waitSeconds] [jsSnippet] [width] [height]
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const [, , query = 'dev=1', out = 'shot.png', wait = '3', js = '', W = '1920', H = '1080'] = process.argv;
const port = 8300 + Math.floor(Math.random() * 400);
const server = await startServer(port);
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?${query}`);
try { await page.waitForFunction(() => (window.__game && window.__game.ready) || window.__gameError, null, { timeout: +(process.env.READY_TIMEOUT || 90000) }); }
catch (e) { console.log('READY TIMEOUT'); for (const l of logs.slice(0, 60)) console.log(l); await browser.close(); server.close(); process.exit(1); }
const err = await page.evaluate(() => window.__gameError);
if (err) console.log('GAME ERROR', err);
console.log('ready in', Date.now() - t0, 'ms');
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('js ->', typeof r === 'string' ? r : JSON.stringify(r)); }
await page.waitForTimeout(+wait * 1000);
const info = await page.evaluate(() => { const g = window.__game; return g && g.ready ? { fps: g.fps().toFixed(1), state: g.state ? g.state() : null } : null; });
console.log('info', JSON.stringify(info));
await page.screenshot({ path: out });
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
server.close();
