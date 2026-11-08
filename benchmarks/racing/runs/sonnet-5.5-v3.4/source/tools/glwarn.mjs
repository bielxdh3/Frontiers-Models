// Dev tool: find who calls getProgramParameter on an invalid program. node tools/glwarn.mjs
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
const port = 8147, srv = await startServer(port, { quiet: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype, orig = P.getProgramParameter; window.__bad = [];
  P.getProgramParameter = function (p, pn) { if (!this.isProgram(p) && window.__bad.length < 3) window.__bad.push(new Error('bad program ' + pn).stack); return orig.call(this, p, pn); };
});
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__RACING__ && (window.__RACING__.ready || window.__RACING__.errors.length), null, { timeout: 150000 });
console.log('bad after load', await page.evaluate(() => window.__bad.length));
await page.evaluate(() => { __RACING__.startRace({ car: 'gt', laps: 3 }); __RACING__.skipToRace(); __RACING__.autopilot(true); });
for (let i = 0; i < 12; i++) { await page.evaluate(() => { __RACING__.advance(5); }); await page.waitForTimeout(200); }
await page.waitForTimeout(1500);
console.log('bad after startRace', await page.evaluate(() => window.__bad.length));
console.log((await page.evaluate(() => window.__bad.slice(0, 2))).join('\n---\n').slice(0, 2500));
await browser.close(); srv.close();
