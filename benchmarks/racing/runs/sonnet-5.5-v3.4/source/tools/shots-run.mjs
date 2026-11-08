// Dev tool: run verifier screenshot scenarios. node tools/shots-run.mjs s1 s4 s5 [--out shots/s] [--q high]
import { startServer } from '../scripts/serve.mjs';
import { launchBrowser, Session } from '../scripts/verify/lib.mjs';
import { SHOTS } from '../scripts/verify/scenarios.mjs';
import { captureShot } from '../scripts/verify/shots.mjs';
const argv = process.argv.slice(2), ids = argv.filter((a) => !a.startsWith('--') && !/^(shots|verification)/.test(a)); const out = (argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'shots/s');
const port = 8151, srv = await startServer(port, { quiet: true });
const { browser } = await launchBrowser();
const q = argv.includes('--low') ? 'low' : 'high';
const s = await new Session(browser, { port, q, query: '&fps=1' }).open();
for (const shot of SHOTS.filter((x) => !ids.length || ids.includes(x.id))) {
  try { const r = await captureShot(s, shot, out); console.log(r.id, 'fps', r.fps, 'sky%', r.skyPct, JSON.stringify(r.metrics)); } catch (e) { console.log(shot.id, 'FAILED', String(e).slice(0, 300)); }
}
console.log(s.errors.slice(0, 5));
await browser.close(); srv.close();
