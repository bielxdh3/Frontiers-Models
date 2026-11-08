// Dev tool: run a full race headlessly in the page (fast-forward with the player on autopilot) and print the race log.
// node tools/race-test.mjs [--laps 3] [--car gt] [--diff normal]
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]) : a), []));
const laps = +(args.laps || 3), car = args.car || 'gt', diff = args.diff || 'normal', port = +(args.port || 8144);
const srv = await startServer(port, { quiet: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + String(e.stack || e).slice(0, 600)));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__RACING__ && (window.__RACING__.ready || window.__RACING__.errors.length), null, { timeout: 150000 });
const t0 = Date.now();
console.log(await page.evaluate((o) => { __RACING__.startRace({ car: o.car, laps: o.laps, diff: o.diff }); __RACING__.skipToRace(); __RACING__.autopilot(true); return __RACING__.state; }, { car, laps, diff }));
let last = 0;
for (let i = 0; i < 400; i++) {
  const r = await page.evaluate(() => { __RACING__.advance(5); const s = __RACING__.raceSnapshot(); return s; });
  if (logs.length && !globalThis.__lw) { globalThis.__lw = true; console.log('first warning after t=', r.t, r.state, logs[0]); }
  if (r.t - last >= 30 || r.state !== 'racing') {
    last = r.t;
    console.log(`t=${r.t} ${r.state} ` + r.cars.map((c) => `${c.name.split(' ')[0]}:P${c.pos} L${c.lap} s${c.s} ${c.kmh}km/h r${r.resets[c.id]}`).join(' | '));
  }
  if (r.state === 'results' || r.state === 'finished') { if (r.state === 'results') { console.log('RESULTS', JSON.stringify(r.cars.map((c) => [c.name, c.pos, c.finished, c.finishTime, c.best, c.projected]))); break; } }
}
console.log('wall ms', Date.now() - t0);
console.log(JSON.stringify(await page.evaluate(() => ({ stats: __RACING__.race.stats, log: __RACING__.race.log, events: __RACING__.race.events.filter((e) => e.type !== 'cp').slice(-30), audio: __RACING__.audioSnapshot() }))).slice(0, 3000));
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close(); srv.close();
