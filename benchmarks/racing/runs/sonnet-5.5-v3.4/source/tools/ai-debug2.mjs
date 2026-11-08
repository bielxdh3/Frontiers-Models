// Dev tool: fine-grained telemetry of several cars at the start.  node tools/ai-debug2.mjs --ids 1,3,5 --secs 5 --step 0.25
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]) : a), []));
const ids = String(args.ids || '1,3,5').split(',').map(Number), secs = +(args.secs || 5), step = +(args.step || 0.25), port = +(args.port || 8146);
const srv = await startServer(port, { quiet: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__RACING__ && (window.__RACING__.ready || window.__RACING__.errors.length), null, { timeout: 150000 });
await page.evaluate(() => { __RACING__.startRace({ car: 'gt', laps: 3 }); __RACING__.skipToRace(); __RACING__.autopilot(args => true); });
const n = Math.round(secs / step);
for (let k = 0; k < n; k++) {
  const r = await page.evaluate(({ ids, step }) => {
    __RACING__.advance(step);
    const R = __RACING__.race;
    return ids.map((id) => { const c = R.cars[id], v = c.v; const T = __RACING__.world.track, i = c.hint; const hd = T.heading[i];
      return `id${id} s${c.sTrack.toFixed(1)} lat${c.lat.toFixed(2)} ${(v.speed * 3.6).toFixed(0)}km/h g${v.gear} yaw-hd=${(Math.atan2(v.forward[0], -v.forward[2]) - hd).toFixed(2)} str${v.steer.toFixed(2)} slip${v.wheels.map((w) => w.skid.toFixed(1)).join('/')}`; });
  }, { ids, step });
  console.log((((k + 1) * step).toFixed(2)).padStart(5), r.join(' | '));
}
await browser.close(); srv.close();
