// Dev screenshot tool: node tools/shot.mjs --q "?top=1" --out shots/a.png [--js "code"] [--w 1920 --h 1080] [--wait 1500]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../scripts/serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]) : a), []));
const out = args.out || 'shots/shot.png';
const W = +(args.w || 1920), H = +(args.h || 1080);
const port = +(args.port || 8139);
const srv = await startServer(port, { quiet: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-webgpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || args.verbose) logs.push(`[${m.type()}] ${t.slice(0, 300)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + String(e.stack || e).slice(0, 600)));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html${args.q || ''}`);
try { await page.waitForFunction(() => window.__RACING__ && window.__RACING__.ready === true, null, { timeout: +(args.timeout || 90000) }); }
catch (e) { logs.push('[timeout waiting for ready]'); }
console.log('ready in', Date.now() - t0, 'ms');
if (args.js) { const r = await page.evaluate(args.js); if (r !== undefined) console.log('js ->', JSON.stringify(r)); }
await page.waitForTimeout(+(args.wait || 1200));
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({ fps: window.__RACING__?.fps, calls: window.__RACING__?.renderer?.info?.render?.calls, tris: window.__RACING__?.renderer?.info?.render?.triangles, tex: window.__RACING__?.renderer?.info?.memory?.textures }));
console.log('saved', out, JSON.stringify(info));
for (const l of logs.slice(0, 25)) console.log(l);
await browser.close(); srv.close();
