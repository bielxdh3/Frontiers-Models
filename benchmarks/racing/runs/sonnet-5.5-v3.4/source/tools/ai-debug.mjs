// Dev tool: print per-second telemetry of selected cars during the first seconds of a race (fast-forward).
// node tools/ai-debug.mjs --car 3 --secs 40
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]) : a), []));
const id = +(args.car ?? 3), secs = +(args.secs || 40), port = +(args.port || 8145);
const srv = await startServer(port, { quiet: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).slice(0, 500)));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__RACING__ && (window.__RACING__.ready || window.__RACING__.errors.length), null, { timeout: 150000 });
await page.evaluate(() => { __RACING__.startRace({ car: 'gt', laps: 3 }); __RACING__.skipToRace(); __RACING__.autopilot(true); });
for (let k = 0; k < secs; k++) {
  const r = await page.evaluate((id) => {
    __RACING__.advance(1);
    const R = __RACING__.race, c = R.cars[id], v = c.v;
    const others = R.cars.filter((o) => o !== c).map((o) => Math.hypot(o.v.p[0] - v.p[0], o.v.p[2] - v.p[2]));
    return { t: +R.t.toFixed(1), s: +c.sTrack.toFixed(1), lat: +c.lat.toFixed(2), kmh: +(v.speed * 3.6).toFixed(1), thr: +v.throttle.toFixed(2), brk: +v.brake.toFixed(2), steer: +v.steer.toFixed(2), gear: v.gear, rpm: Math.round(v.rpm), near: +Math.min(...others).toFixed(1), yaw: +Math.atan2(v.forward[0], -v.forward[2]).toFixed(2), wheels: v.onGroundWheels, drvOff: +(c.driver.off || 0).toFixed(2), stuck: +c.stuckTime.toFixed(1) };
  }, id);
  console.log(JSON.stringify(r));
}
await browser.close(); srv.close();
