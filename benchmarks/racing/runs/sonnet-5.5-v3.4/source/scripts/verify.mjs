// `npm run verify`: serves the game, runs every automated test, captures screenshots / video / audio / metrics and writes verification/.
// Usage: node scripts/verify.mjs [--only shots,sweep,...] [--fast]   (--fast shortens nothing that is measured; it only skips the 6-lap journey for quick dev runs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser, Session, hardware, write, mkdir } from './verify/lib.mjs';
import { SHOTS } from './verify/scenarios.mjs';
import { captureShot } from './verify/shots.mjs';
import { journey, pauseRestart, antiCut, audioVideoLap } from './verify/tests.mjs';
import { perf, sweep, sceneAudit, compares } from './verify/measure.mjs';
import { buildReports } from './verify/report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'verification'), LOGS = path.join(OUT, 'logs');
// reference pictures (verification only; the server never serves them and the game never loads them): ./refs, $RACING_REFS or a sibling folder
const REFS = [process.env.RACING_REFS, path.join(ROOT, 'refs'), path.join(ROOT, '..', 'refs'), path.join(ROOT, '..', 'racing-v3.4', 'refs')].filter(Boolean).find((d) => { try { return fs.readdirSync(d).some((f) => /\.jpg$/i.test(f)); } catch { return false; } }) || path.join(ROOT, 'refs');
const argv = process.argv.slice(2), only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null, fast = argv.includes('--fast');
const want = (k) => !only || only.includes(k);
if (argv.includes('--report-only')) {                       // rebuild GATES.md / REPORT.md from verification/results.json and the notes (no browser)
  const R0 = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8')), n0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/verify/notes.json'), 'utf8'));
  const { failures } = buildReports(R0, n0, OUT); console.log(`reports rebuilt (${failures.length} declared failure line(s))`); for (const f of failures) console.log('  - ' + f); process.exit(0);
}
const t0 = Date.now(); const say = (m) => console.log(`[verify ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${m}`);

if (!only) { fs.rmSync(OUT, { recursive: true, force: true }); }
mkdir(OUT); mkdir(LOGS); mkdir(path.join(OUT, 'compare'));
const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8')); } catch { return null; } })();
const R = prev && only ? prev : { meta: {}, tests: {} };
const notes = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/verify/notes.json'), 'utf8'));

if (!fs.existsSync(path.join(ROOT, 'lib/three/three.module.js'))) { say('vendoring three.js into lib/three'); const { execSync } = await import('node:child_process'); execSync('node scripts/vendor.mjs', { cwd: ROOT, stdio: 'inherit' }); }
const port = 8137 + Math.floor(Math.random() * 200);
const srv = await startServer(port, { quiet: true });
const { browser, how } = await launchBrowser();
say(`server on :${port}, browser ${how}`);

try {
  const probe = await new Session(browser, { port, q: 'high', w: 1920, h: 1080, name: 'probe' }).open();
  R.meta.hardware = await hardware(probe); R.meta.browser = `${how} ${browser.version()}`; R.meta.loadMsHigh = probe.loadMs; await probe.close();
  say(`hardware: ${R.meta.hardware.gpu} | ${R.meta.hardware.cpu}`);

  const store = (name, res, logFile) => { res.logFile = logFile; R.tests[name] = res; say(`${name}: ${res.ok ? 'PASS' : 'FAIL'}`); };
  if (want('audit')) { say('scene audit + validateWorld'); R.audit = await sceneAudit(browser, port); write(path.join(OUT, 'scene-stats.json'), JSON.stringify({ sceneAudit: R.audit.audit, validateWorld: R.audit.validate }, null, 1)); say(`audit pass=${R.audit.audit.pass} validate=${R.audit.validate.ok}`); }
  if (want('journey')) {
    say('test 1: journey, 3 laps'); store('journey3', await journey(browser, port, { laps: 3, car: 'gt', tag: '3laps', outDir: OUT }), 'journey-3laps.log');
    if (!fast) { say('test 2: journey, 6 laps'); store('journey6', await journey(browser, port, { laps: 6, car: 'hatch', tag: '6laps', outDir: OUT }), 'journey-6laps.log'); }
  }
  if (want('pause')) { say('test 3: pause / restart / heap'); store('pause', await pauseRestart(browser, port, { outDir: OUT }), 'pause-restart.log'); }
  if (want('anticut')) { say('test 4: anti-cut'); store('anticut', await antiCut(browser, port, { outDir: OUT }), 'anticut.log'); }
  if (want('audio')) { say('13.2: real-time lap with audio + video recording (~2.5 min)'); store('volta', await audioVideoLap(browser, port, { outDir: OUT }), 'audio-volta.log'); }
  // move per-test logs into logs/
  for (const f of fs.readdirSync(OUT)) if (/\.log$/.test(f) || /^journey-.*-results\.png$/.test(f)) fs.renameSync(path.join(OUT, f), path.join(LOGS, f));

  if (want('shots')) {
    say('screenshots S1..S12'); R.shots = []; R.imageMetrics = [];
    for (const f of fs.readdirSync(OUT)) if (/^s\d+-.*\.png$/.test(f)) fs.rmSync(path.join(OUT, f));        // no stale captures from earlier partial runs
    const hi = await new Session(browser, { port, q: 'high', w: 1920, h: 1080, query: '&fps=1', name: 'shots' }).open();
    await hi.page.mouse.click(900, 360); await hi.page.waitForFunction(() => __RACING__.audio.ready, null, { timeout: 30000 });
    for (const sh of SHOTS.filter((x) => x.quality === 'high')) { const r = await captureShot(hi, sh, OUT); r.dir = OUT; R.shots.push(r); say(`  ${sh.id} fps ${r.fps} sky ${r.skyPct}%`); }
    const hiErrors = hi.errors.slice(0, 5);
    const made = fs.existsSync(REFS) ? await compares(hi, R.shots, REFS, path.join(OUT, 'compare')) : []; say(`  compare images: ${made.length} (refs: ${REFS})`); if (!made.length) R.refsMissing = true;
    await hi.close();
    const lo = await new Session(browser, { port, q: 'low', w: 1920, h: 1080, query: '&fps=1', name: 'shots-low' }).open();
    for (const sh of SHOTS.filter((x) => x.quality === 'low')) { const r = await captureShot(lo, sh, OUT); r.dir = OUT; R.shots.push(r); say(`  ${sh.id} (low) fps ${r.fps}`); }
    await lo.close();
    R.shots.sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
    R.imageMetrics = R.shots.filter((x) => x.metrics && parseInt(x.id.slice(1)) <= 9).map((x) => ({ id: x.id, file: x.file, fpsAtCapture: x.fps, skyPct: x.skyPct, metrics: x.metrics, pass: x.skyPct >= 10 && x.metrics.lumMean >= 0.25 && x.metrics.lumMean <= 0.75 && x.metrics.lumStd >= 0.12 && x.metrics.maxColourShare <= 0.30 }));
    write(path.join(OUT, 'image-metrics.json'), JSON.stringify({ definition: { sky: 'share of the frame where only the sky is visible (in-game mask pass: scene re-rendered with a black override material over a white clear)', luminance: 'sRGB Rec.709 luma of the screenshot, 0..1', maxColourShare: 'share of the frame taken by the most frequent colour at 5 bits/channel' }, limits: { skyMinPct: 10, lumMean: [0.25, 0.75], lumStdMin: 0.12, maxColourShareMax: 0.30 }, shots: R.imageMetrics }, null, 1));
    for (const s of R.shots) delete s.dir;
  }
  if (want('sweep')) { say('test 9: camera sweep every 25 m'); R.sweep = await sweep(browser, port, path.join(OUT, 'sweep')); write(path.join(OUT, 'sweep-metrics.json'), JSON.stringify(R.sweep, null, 1)); say(`  sweep ${R.sweep.count - R.sweep.failures}/${R.sweep.count} pass`); }
  if (want('perf')) {
    say('13.3 performance (frame-rate limiter off)'); R.perf = [];
    const fb = await launchBrowser({ uncapped: true });
    for (const q of ['high', 'low']) { const p = await perf(fb.browser, port, q); R.perf.push(p); say(`  ${q}: ${p.perf && p.perf.avgFps} avg / ${p.perf && p.perf.low1Fps} 1%low`); }
    await fb.browser.close(); write(path.join(OUT, 'perf.json'), JSON.stringify(R.perf, null, 1));
  }
} catch (e) { console.error('[verify] aborted:', e); R.fatal = String(e && e.stack || e); }

R.meta.date = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
const spent = (Date.now() - t0) / 60000; R.meta.minutes = +((only ? (R.meta.minutes || 0) : 0) + spent).toFixed(1); if (only) R.meta.partialRuns = (R.meta.partialRuns || []).concat([only.join(',')]);
write(path.join(OUT, 'results.json'), JSON.stringify(R, null, 1));
const { failures } = buildReports(R, notes, OUT);
say(`reports written (${failures.length} declared failure line(s))`);
for (const f of failures.slice(0, 40)) console.log('  - ' + f);
await browser.close(); srv.close();
process.exit(0);
