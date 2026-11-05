// npm run verify — reproduces every verification artifact (section 13) into verification/:
// serves the static build, drives the real game in Chromium (GPU, headless) through
// Playwright: UI journeys (3 and 6 laps), pause/restart/menu, anti-cut, AI checks,
// integrity, screenshots S1–S12 (+ image metrics, comparisons with the refs), scene
// audit, chase-camera sweep every 25 m, one recorded lap (video + master audio),
// and performance in Alta/Baixa. Exit code 1 if any test fails.
// Options: --only=t1,t2,t3,t4,shots,audit,sweep,lap,perf   REFS_DIR=<folder with refs/*.jpg>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { execSync } from 'node:child_process';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'verification');
const argOnly = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (k) => !argOnly.length || argOnly.includes(k);
for (const d of ['', 'logs', 'screenshots', 'compare', 'sweep']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const RESULTS_FILE = path.join(OUT, 'results.json');
const results = fs.existsSync(RESULTS_FILE) && argOnly.length ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) : {};
const logFile = fs.createWriteStream(path.join(OUT, 'logs', argOnly.length ? `verify-${argOnly.join('-')}.log` : 'verify.log'));
const log = (...a) => { const s = `[${new Date().toISOString().slice(11, 19)}] ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}`; console.log(s); logFile.write(s + '\n'); };
const save = () => fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 1));
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

// ---------------------------------------------------------------- image helpers
function readPNG(buf) { return PNG.sync.read(buf); }
function downscale(img, f) {
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f), out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const k = ((y * f + j) * img.width + x * f + i) * 4; r += img.data[k]; g += img.data[k + 1]; b += img.data[k + 2]; }
    const o = (y * w + x) * 4, n = f * f; out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
  return out;
}
function resize(img, w, h) { // area-ish nearest for refs of arbitrary size
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx0 = Math.floor((x * img.width) / w), sy0 = Math.floor((y * img.height) / h);
    const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * img.width) / w)), sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * img.height) / h));
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = sy0; j < sy1; j++) for (let i = sx0; i < sx1; i++) { const k = (j * img.width + i) * 4; r += img.data[k]; g += img.data[k + 1]; b += img.data[k + 2]; n++; }
    const o = (y * w + x) * 4; out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
  return out;
}
function hstack(imgs) {
  const h = Math.max(...imgs.map((i) => i.height)), w = imgs.reduce((a, i) => a + i.width, 0);
  const out = new PNG({ width: w, height: h }); let x0 = 0;
  for (const im of imgs) { for (let y = 0; y < im.height; y++) im.data.copy(out.data, (y * w + x0) * 4, y * im.width * 4, (y + 1) * im.width * 4); x0 += im.width; }
  return out;
}
function imageMetrics(img) {
  const n = img.width * img.height; let s = 0, s2 = 0; const bins = new Map();
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 4] / 255, g = img.data[i * 4 + 1] / 255, b = img.data[i * 4 + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; s += y; s2 += y * y;
    const k = ((img.data[i * 4] >> 4) << 8) | ((img.data[i * 4 + 1] >> 4) << 4) | (img.data[i * 4 + 2] >> 4);
    bins.set(k, (bins.get(k) || 0) + 1);
  }
  const mean = s / n, std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  let top = 0, topK = 0; for (const [k, c] of bins) if (c > top) { top = c; topK = k; }
  const col = `#${((topK >> 8) & 15).toString(16)}${((topK >> 4) & 15).toString(16)}${(topK & 15).toString(16)}`;
  return { meanLuminance: +mean.toFixed(4), stdLuminance: +std.toFixed(4), maxSingleColorFraction: +(top / n).toFixed(4), dominantColor4bit: col };
}
function metricsPass(m, skyRequired = true) {
  const f = [];
  if (skyRequired && m.skyFraction < 0.1) f.push(`céu ${(m.skyFraction * 100).toFixed(1)}% < 10%`);
  if (m.meanLuminance < 0.25 || m.meanLuminance > 0.75) f.push(`luminância média ${m.meanLuminance} fora de 0,25–0,75`);
  if (m.stdLuminance < 0.12) f.push(`desvio ${m.stdLuminance} < 0,12`);
  if (m.maxSingleColorFraction > 0.3) f.push(`cor única ${(m.maxSingleColorFraction * 100).toFixed(1)}% > 30%`);
  return f;
}
function findRefs() {
  const cands = [process.env.REFS_DIR, path.join(ROOT, '..', 'refs'), path.join(ROOT, '..', 'racing-v3.4', 'refs'), path.join(process.cwd(), 'refs')].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c) && fs.readdirSync(c).some((f) => /^\d\d-.*\.jpe?g$/i.test(f))) return c;
  return null;
}
function writeWav(file, b64parts) { fs.writeFileSync(file, Buffer.concat(b64parts.map((p) => Buffer.from(p, 'base64')))); }
function wavPeak(file) {
  const b = fs.readFileSync(file); const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24); let off = 12;
  while (b.toString('ascii', off, off + 4) !== 'data') off += 8 + b.readUInt32LE(off + 4);
  const n = b.readUInt32LE(off + 4) / 2; let pk = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(b.readInt16LE(off + 8 + i * 2)); if (v > pk) pk = v; }
  return { sampleRate: sr, channels: ch, seconds: n / ch / sr, peak: pk / 32767, peakDb: 20 * Math.log10(Math.max(1, pk) / 32767) };
}

// ---------------------------------------------------------------- browser
const port = 8600 + Math.floor(Math.random() * 300);
const server = await startServer(port);
const LAUNCH = { channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-precise-memory-info'] };
let browser;
try { browser = await chromium.launch(LAUNCH); }
catch (e) {
  // clean machine without the Playwright browser: install it once, then retry
  if (!/Executable doesn't exist|playwright install/i.test(String(e))) throw e;
  log('Chromium do Playwright ausente: instalando (npx playwright install chromium)…');
  execSync('npx playwright install chromium', { stdio: 'inherit', cwd: ROOT });
  browser = await chromium.launch(LAUNCH);
}
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const cdp = await page.context().newCDPSession(page);
const consoleLog = [];
page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => consoleLog.push({ type: 'pageerror', text: e.message }));
const G = (fn, arg) => page.evaluate(fn, arg);
const key = async (k, wait = 260) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const until = (fn, timeout = 600000, arg) => page.waitForFunction(fn, arg, { timeout, polling: 250 });
const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(300); await cdp.send('HeapProfiler.collectGarbage'); const u = await cdp.send('Runtime.getHeapUsage'); return u.usedSize; };

const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?test`);
await until(() => (window.__game && window.__game.ready) || window.__gameError, 180000);
const loadErr = await G(() => window.__gameError || null);
if (loadErr) { log('LOAD ERROR', loadErr); process.exit(1); }
results.load = { ms: Date.now() - t0, phases: await G(() => window.__game.loadPhases) };
log('loaded in', results.load.ms, 'ms');
await page.waitForTimeout(1000);
// first interaction (audio starts here, never before)
const audioBefore = await G(() => ({ ctx: !!window.__game.audio.ctx }));
await page.mouse.click(960, 900);
await until(() => window.__game.audio.ready, 20000);
results.audioStart = { contextBeforeInteraction: audioBefore.ctx, readyAfterInteraction: true };

const tests = results.tests || (results.tests = {});
const pass = (id, ok, detail) => { tests[id] = { pass: !!ok, ...detail }; log(`TEST ${id}: ${ok ? 'PASS' : 'FAIL'}`, detail); save(); };

// ---------------------------------------------------------------- journey helper (real UI, keyboard)
async function journey(laps) {
  // menu -> garage
  await G(() => { if (window.__game.mode !== 'menu') { window.__game.quitToMenu(); window.__game.flow.menu(); } });
  await page.waitForTimeout(600);
  await key('Enter', 900); // Correr
  const inGarage = await G(() => window.__game.mode === 'garage');
  await key('ArrowDown'); await key('ArrowRight', 500); // paint -> next livery
  await key('ArrowDown'); await key('Enter', 600); // Continuar
  const inConfig = await G(() => !!document.querySelector('.config'));
  if (laps === 6) await key('ArrowRight'); // Voltas: 3 -> 6
  await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 600); // Largar
  const cfg = await G(() => window.__game.race && window.__game.race.cfg);
  // test-only: player autopilot + 4x simulation speed (same fixed 120 Hz physics steps)
  await G(() => { window.__game.setAutopilot(true); window.__game.sim.timeScale = 4; window.__game.harness.monitorStart(); });
  const tRace = Date.now();
  await until(() => window.__game.mode === 'results', 1200000);
  await page.waitForTimeout(1200);
  const race = await G(() => { const g = window.__game, r = g.race; return { clock: r.clock, laps: r.cfg.laps, playerLaps: r.E[0].lapsDone, finished: r.E.filter((e) => e.finished).length, results: r.results().map((x) => ({ name: x.name, time: +x.time.toFixed(3), projected: x.projected, best: +x.best.toFixed(3), laps: x.laps })), lapTimes: r.E.map((e) => e.lapTimes.map((t) => +t.toFixed(2))), cuts: r.cutCount }; });
  const rows = await G(() => document.querySelectorAll('table.res tr').length - 1);
  const mon = await G(() => window.__game.harness.monitorReport());
  // Correr de novo
  await key('Enter', 1200);
  const again = await G(() => { const g = window.__game, r = g.race; return { mode: g.mode, state: r && r.state, laps: r && r.cfg.laps, lapsDone: r && r.E.map((e) => e.lapsDone), clock: r && r.clock }; });
  await G(() => { window.__game.harness.monitorStop(); window.__game.sim.timeScale = 1; });
  return { inGarage, inConfig, cfg, wallSeconds: (Date.now() - tRace) / 1000, race, rows, mon, again };
}

// ---------------------------------------------------------------- 13.1 tests 1, 2 (+5, +6)
const integrity = { invariantEvents: 0, cameraInside: 0 };
if (want('t1')) {
  const j = await journey(3);
  const ok = j.inGarage && j.inConfig && j.cfg.laps === 3 && j.race.playerLaps === 3 && j.rows === 6 && j.again.mode === 'race' && j.again.state === 'intro' && j.again.lapsDone.every((l) => l === 0) && j.again.laps === 3;
  pass('1_journey_3_laps', ok, j);
  results.t1mon = j.mon;
}
if (want('t2')) {
  const j = await journey(6);
  const ok = j.inGarage && j.inConfig && j.cfg.laps === 6 && j.race.playerLaps === 6 && j.rows === 6 && j.again.mode === 'race' && j.again.state === 'intro' && j.again.lapsDone.every((l) => l === 0) && j.again.laps === 6;
  pass('2_journey_6_laps', ok, j);
  results.t2mon = j.mon;
}
if (want('t1') || want('t2')) {
  const mons = [results.t1mon, results.t2mon].filter(Boolean);
  const ai = mons.flatMap((m) => m.ai);
  const maxStop = Math.max(...ai.map((a) => a.maxStoppedS)), maxOff = Math.max(...ai.map((a) => a.maxOffTrackS));
  const overtakes = mons.reduce((a, m) => a + m.aiOvertakes, 0);
  pass('5_ai', maxStop <= 5 && maxOff <= 5 && overtakes >= 1, { maxStoppedS: maxStop, maxOffTrackS: maxOff, aiOvertakes: overtakes, perRace: mons.map((m) => ({ ai: m.ai, overtakes: m.aiOvertakes, sample: m.overtakeList.slice(0, 8), resets: m.resets })) });
  integrity.invariantEvents = mons.reduce((a, m) => a + m.invariantEvents, 0);
  integrity.cameraInside = mons.reduce((a, m) => a + m.cameraInsideGeometry, 0);
  integrity.invariantList = mons.flatMap((m) => m.invariantList);
}

// ---------------------------------------------------------------- test 3: pause / restart / menu, voices, heap
if (want('t3')) {
  await G(() => { const g = window.__game; g.quitToMenu(); g.flow.menu(); });
  await page.waitForTimeout(800);
  await key('Enter', 900); await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 600); // garage -> Continuar
  await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 800); // Largar
  await key('Enter', 400); // skip intro
  await G(() => window.__game.setAutopilot(true));
  await until(() => window.__game.race && window.__game.race.state === 'running', 30000);
  await page.waitForTimeout(4000);
  const voices0 = await G(() => window.__game.audio.voiceCounts());
  // pause
  await key('Escape', 500);
  const p1 = await G(() => ({ paused: window.__game.paused, t: window.__game.sim.time, modal: !!window.__game.flow.modal, muffled: window.__game.audio.paused }));
  await page.waitForTimeout(1200);
  const p2 = await G(() => ({ t: window.__game.sim.time, clock: window.__game.race.clock }));
  await key('Enter', 600); // Continuar
  const p3 = await G(() => ({ paused: window.__game.paused, modal: !!window.__game.flow.modal, muffled: window.__game.audio.paused }));
  await page.waitForTimeout(1000);
  const p4 = await G(() => ({ t: window.__game.sim.time }));
  const pauseOk = p1.paused && p1.modal && p1.muffled && Math.abs(p2.t - p1.t) < 1e-6 && !p3.paused && !p3.modal && !p3.muffled && p4.t > p2.t + 0.5;
  // restart mid race x3
  const restarts = [];
  const heap0 = await heap();
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(2500);
    const before = await G(() => ({ clock: window.__game.race.clock, dist: window.__game.race.E[0].dist }));
    await key('Escape', 400); await key('ArrowDown'); await key('Enter', 900); // Reiniciar
    const fresh = await G(() => { const g = window.__game, r = g.race; return { state: r.state, clock: r.clock, lapsDone: r.E.map((e) => e.lapsDone), dist: r.E.map((e) => +e.dist.toFixed(1)), held: g.sim.cars.every((c) => c.held), paused: g.paused, cars: g.sim.cars.length, sceneCars: g.scene.children.filter((o) => o.name && o.name.startsWith('car-')).length, events: r.events.length }; });
    await key('Enter', 400); // skip intro
    await G(() => window.__game.setAutopilot(true));
    await until(() => window.__game.race.state === 'running', 30000);
    await page.waitForTimeout(4000);
    const v = await G(() => window.__game.audio.voiceCounts());
    restarts.push({ before, fresh, voices: v, heap: await heap() });
  }
  const restartOk = restarts.every((r) => r.fresh.state === 'intro' && r.fresh.clock === 0 && r.fresh.lapsDone.every((l) => l === 0) && r.fresh.dist.every((d) => d <= 0) && r.fresh.held && r.fresh.cars === 6 && r.fresh.sceneCars === 6 && r.fresh.events === 0 && r.voices.persistent === voices0.persistent && r.voices.engineSources === voices0.engineSources);
  const heapOk = restarts[2].heap <= Math.max(restarts[0].heap, heap0) * 1.1 + 8e6;
  // back to menu
  await key('Escape', 400); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 1200);
  const menu = await G(() => ({ mode: window.__game.mode, race: !!window.__game.race, audioRace: window.__game.audio.race && window.__game.audio.race.attract, screen: !!document.querySelector('.menu'), voices: window.__game.audio.voiceCounts() }));
  const menuOk = menu.mode === 'menu' && !menu.race && menu.audioRace && menu.screen && menu.voices.engineSources === 0;
  pass('3_pause_restart_menu', pauseOk && restartOk && heapOk && menuOk, { pauseOk, restartOk, heapOk, menuOk, voicesAtStart: voices0, pause: [p1, p2, p3, p4], restarts, heap0, menu });
}

// ---------------------------------------------------------------- test 4: anti-cut
if (want('t4')) {
  const r = await G(async () => {
    const g = window.__game, H = g.harness, T = g.world.track;
    H.quickRace({ laps: 3 }); H.goNow(); g.setAutopilot(true); g.sim.timeScale = 4;
    const R = g.race, e = R.E[0];
    const wait = (fn) => new Promise((res) => { const t = setInterval(() => { if (fn()) { clearInterval(t); res(); } }, 100); });
    await wait(() => e.next >= 4);
    const before = { next: e.next, lapsDone: e.lapsDone };
    // the cut: jump ~2.6 km ahead (skips ~26 gates) as a car short-cutting across the map would
    const s = T.wrap(R.startS - 220);
    H.place(0, s, 0, 30);
    await wait(() => R.events.some((x) => x.type === 'cut' && x.car === 0));
    const afterCut = { lapsDone: e.lapsDone, next: e.next, cutEvents: R.events.filter((x) => x.type === 'cut').length };
    // now a clean full lap must count
    await wait(() => e.lapsDone >= 1);
    const after = { lapsDone: e.lapsDone, lapTime: e.lapTimes[0] };
    g.sim.timeScale = 1;
    return { before, afterCut, after };
  });
  pass('4_anticut', r.afterCut.lapsDone === 0 && r.afterCut.cutEvents >= 1 && r.after.lapsDone === 1 && r.after.lapTime > 60, r);
}

// ---------------------------------------------------------------- test 6: integrity
if (want('t1') || want('t2')) {
  const v = await G(() => { const r = window.__game.validate(); return { ok: r.ok, errors: r.errors.length, firstErrors: r.errors.slice(0, 5), stats: r.stats }; });
  pass('6_integrity', v.ok && v.errors === 0 && integrity.invariantEvents === 0 && integrity.cameraInside === 0, { validateWorld: v, ...integrity });
}

// ---------------------------------------------------------------- 13.4 screenshots + test 7
const SHOTS = [
  ['s1', 's1-reta-orla', ['01', '02']], ['s2', 's2-grid-3-4', ['11']], ['s3', 's3-praia-espuma', ['02', '04']], ['s4', 's4-falesia-mirante', ['02']],
  ['s5', 's5-vila-rua', ['05', '06', '07']], ['s6', 's6-bosque-luz', ['08', '10']], ['s7', 's7-ponte-ou-tunel', ['14']], ['s8', 's8-disputa', ['09', '13']],
  ['s9', 's9-close-pista', []], ['s10', 's10-baixa-vila', []], ['s11', 's11-escala', []], ['s12', 's12-mapa', []],
];
if (want('shots')) {
  const refs = findRefs();
  log('refs dir', refs || '(not found: compare/ skipped)');
  for (const f of fs.readdirSync(path.join(OUT, 'screenshots'))) fs.unlinkSync(path.join(OUT, 'screenshots', f));
  const metrics = {};
  const shots = {};
  for (const [id, name, refIds] of SHOTS) {
    const info = await G((i) => window.__game.harness.shot(i), id);
    await G(() => window.__game.R.post.snapExposure()); // camera cut
    await page.waitForTimeout(250);
    const sky = await G(() => window.__game.harness.skyFraction());
    const buf = await page.screenshot();
    // FPS of this view, measured over a steady 60-frame window right after the capture
    await page.waitForTimeout(1000);
    const fps = await G(() => window.__game.harness.fpsWindow(60));
    const file = `${name}-${Math.round(fps)}fps.png`;
    fs.writeFileSync(path.join(OUT, 'screenshots', file), buf);
    const st = await G(() => ({ quality: window.__game.settings.quality, cars: window.__game.sim.cars.length, hud: window.__game.hud.visible, mode: window.__game.mode, race: window.__game.race && window.__game.race.state }));
    shots[id] = { file, fps: +fps.toFixed(1), ...st, info: info.info || null };
    const img = readPNG(buf);
    if (['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'].includes(id)) {
      const m = { file, skyFraction: +sky.toFixed(4), ...imageMetrics(img) };
      m.failures = metricsPass(m, true); m.pass = m.failures.length === 0;
      metrics[id] = m;
    }
    if (refs && refIds.length) {
      const panels = [downscale(img, 2)];
      for (const r of refIds) {
        const f = fs.readdirSync(refs).find((x) => x.startsWith(r + '-'));
        if (!f) continue;
        const raw = jpeg.decode(fs.readFileSync(path.join(refs, f)), { useTArray: true, formatAsRGBA: true });
        panels.push(resize({ width: raw.width, height: raw.height, data: raw.data }, 960, 540));
      }
      fs.writeFileSync(path.join(OUT, 'compare', `${id}.png`), PNG.sync.write(hstack(panels)));
    }
    log('shot', id, file, JSON.stringify(metrics[id] || {}));
  }
  await G(() => window.__game.applyQuality('alta'));
  fs.writeFileSync(path.join(OUT, 'image-metrics.json'), JSON.stringify(metrics, null, 1));
  results.shots = shots;
  pass('7_image_sanity', Object.values(metrics).every((m) => m.pass), { metrics });
}

// ---------------------------------------------------------------- test 8: scene audit
if (want('audit')) {
  await G(() => { const H = window.__game.harness; H.quickRace({ laps: 3 }); H.goNow(); window.__game.setAutopilot(true); });
  await page.waitForTimeout(2500);
  const audit = await G(() => window.__game.harness.sceneAudit());
  fs.writeFileSync(path.join(OUT, 'scene-stats.json'), JSON.stringify(audit, null, 1));
  pass('8_scene_audit', audit.pass, { ok: audit.ok, cars: audit.cars.map((c) => [c.key, c.lod0Tris, c.materials]), boxes: audit.boxes.slice(0, 10), flat: audit.flat.slice(0, 10), lowTex: audit.lowTex.slice(0, 20), counts: { ...audit.counts, propsPer100m: { min: audit.counts.propsPer100m.min, avg: audit.counts.propsPer100m.avg } } });
}

// ---------------------------------------------------------------- test 9: sweep every 25 m
if (want('sweep')) {
  for (const f of fs.readdirSync(path.join(OUT, 'sweep'))) fs.unlinkSync(path.join(OUT, 'sweep', f));
  await G(() => window.__game.harness.sweepPrepare());
  const L = await G(() => window.__game.world.track.length);
  const rows = []; const tiles = [];
  for (let s = 0; s < L - 1; s += 25) {
    const r = await G((x) => window.__game.harness.sweepAt(x), s);
    const buf = await page.screenshot();
    const thumb = downscale(readPNG(buf), 5); // 384x216
    const m = { s, skyFraction: +r.sky.toFixed(4), ...imageMetrics(thumb) };
    m.failures = metricsPass(m, true); m.pass = m.failures.length === 0;
    const name = `sweep-${String(s).padStart(4, '0')}.png`;
    fs.writeFileSync(path.join(OUT, 'sweep', name), PNG.sync.write(thumb));
    rows.push({ file: name, ...m }); tiles.push(downscale(thumb, 2));
    if (!m.pass) log('sweep fail', s, m.failures.join('; '));
  }
  // contact sheet
  const cols = 12, tw = tiles[0].width, th = tiles[0].height, rowsN = Math.ceil(tiles.length / cols);
  const sheet = new PNG({ width: cols * tw, height: rowsN * th });
  tiles.forEach((t, k) => { const x0 = (k % cols) * tw, y0 = Math.floor(k / cols) * th; for (let y = 0; y < th; y++) t.data.copy(sheet.data, ((y0 + y) * sheet.width + x0) * 4, y * tw * 4, (y + 1) * tw * 4); });
  fs.writeFileSync(path.join(OUT, 'sweep-sheet.png'), PNG.sync.write(sheet));
  fs.writeFileSync(path.join(OUT, 'sweep', 'sweep-metrics.json'), JSON.stringify(rows, null, 1));
  const inside = await G(() => window.__game.camCtl.insideGeometry);
  pass('9_sweep', rows.every((r) => r.pass), { points: rows.length, failures: rows.filter((r) => !r.pass).map((r) => ({ s: r.s, f: r.failures })), cameraInsideCounter: inside });
}

// ---------------------------------------------------------------- 13.2 + video: one real-time lap in Alta, chase camera, AIs, audio
if (want('lap')) {
  await G(() => window.__game.applyQuality('alta'));
  await G(() => { const g = window.__game, H = g.harness; H.quickRace({ laps: 3, difficulty: 'normal' }); g.race.phaseT = 99; g.flow.hideIntro(); g.setAutopilot(true); g.sim.timeScale = 1; g.camCtl.mode = 'chase'; g.camMode = null; });
  const mime = await G(() => window.__game.harness.startCapture({ width: 1280, height: 720, fps: 30 }));
  await G(() => window.__game.audio.startRecording());
  log('recording lap…', mime);
  await until(() => window.__game.race.E[0].lapsDone >= 1, 400000);
  await page.waitForTimeout(1500);
  const rec = await G(() => window.__game.audio.stopRecording());
  const cap = await G(() => window.__game.harness.stopCapture());
  // video
  const parts = []; for (let i = 0; ; i++) { const p = await G((k) => window.__game.harness.captureSlice(k), i); if (!p) break; parts.push(p); }
  writeWav(path.join(OUT, 'volta.webm'), parts);
  // audio wav
  const info = await G(() => window.__game.audio.recordingWavB64());
  const wparts = []; for (let i = 0; i < info.slices; i++) wparts.push(await G((k) => window.__game.audio.recordingWavB64(k), i));
  writeWav(path.join(OUT, 'audio-volta.wav'), wparts);
  const wp = wavPeak(path.join(OUT, 'audio-volta.wav'));
  const last = await G(() => { const a = window.__game.audio.lastRecording; return { events: a.events, maxSources: a.maxSources, maxLogical: a.maxLogical, lapTime: window.__game.race.E[0].lapTimes[0] }; });
  const byType = {}; for (const e of last.events) (byType[e.type] ||= []).push(mmss(e.t) + (e.detail ? ` (${e.detail})` : ''));
  results.lap = { video: cap, audio: { ...rec, wav: wp }, maxVoicesLogical: last.maxLogical, maxSources: last.maxSources, lapTime: last.lapTime, events: byType, mime };
  const need = ['troca_marcha', 'derrapagem', 'colisao', 'ponte_entrada', 'passagem_ia'];
  pass('13_2_audio', wp.peakDb <= -1 && rec.peakDb <= -1 && need.every((k) => byType[k] && byType[k].length), { peakDbWav: +wp.peakDb.toFixed(2), peakDbTap: +rec.peakDb.toFixed(2), maxVoicesLogical: last.maxLogical, maxSources: last.maxSources, eventsFound: Object.fromEntries(need.map((k) => [k, (byType[k] || []).length])) });
  pass('video_lap', cap.bytes > 1e6 && cap.seconds > 60, { bytes: cap.bytes, seconds: cap.seconds, lapTime: last.lapTime });
}

// ---------------------------------------------------------------- 13.3 performance
if (want('perf')) {
  const gpu = await G(() => window.__game.harness.gpuInfo());
  const alta = await G(() => window.__game.harness.perfRun('alta', 15));
  const baixa = await G(() => window.__game.harness.perfRun('baixa', 15));
  await G(() => window.__game.applyQuality('alta'));
  results.perf = { alta, baixa, gpu, cpu: os.cpus()[0].model.trim(), cores: os.cpus().length, browser: `Chromium ${browser.version()} (Playwright, headless, ANGLE D3D11)`, resolution: '1920x1080', os: `${os.type()} ${os.release()}` };
  pass('13_3_perf', alta.avgFps >= 60 && baixa.avgFps >= 60, results.perf);
}

// ---------------------------------------------------------------- console errors
const errors = consoleLog.filter((m) => m.type === 'error' || m.type === 'pageerror');
fs.writeFileSync(path.join(OUT, 'logs', 'console.log'), consoleLog.map((m) => `[${m.type}] ${m.text}`).join('\n'));
results.consoleErrors = errors.length;
if (!argOnly.length) pass('console_no_errors', errors.length === 0, { errors: errors.slice(0, 10) });
results.finishedAt = new Date().toISOString();
results.machine = { cpu: os.cpus()[0].model.trim(), os: `${os.type()} ${os.release()}`, node: process.version };
save();
writeDataReport(results); // from the merged results.json (partial runs keep it consistent)
const failed = Object.entries(tests).filter(([, v]) => !v.pass).map(([k]) => k);
log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL TESTS PASSED');
await browser.close(); server.close(); logFile.end();
process.exit(failed.length ? 1 : 0);

// ---------------------------------------------------------------- machine-written data tables (REPORT-dados.md)
function writeDataReport(R) {
  const L = [];
  const T = R.tests || {};
  const yes = (k) => (T[k] ? (T[k].pass ? 'PASSOU' : '**FALHOU**') : 'não executado');
  L.push('# Dados gerados por `npm run verify`', '', `Gerado em ${R.finishedAt} — ${R.machine.cpu}, ${R.machine.os}, Node ${R.machine.node}.`, '');
  L.push('## Resumo dos testes', '', '| Teste | Resultado |', '| --- | --- |');
  for (const k of Object.keys(T)) L.push(`| ${k} | ${yes(k)} |`);
  L.push('', `Carregamento até "Pronto": ${R.load ? R.load.ms : '?'} ms.`, '');
  if (R.load && R.load.phases) { L.push('| Fase | início (ms) |', '| --- | --- |'); for (const [n, t] of R.load.phases.filter((p) => !/^Sons \d/.test(p[0]))) L.push(`| ${n} | ${t} |`); L.push(''); }
  if (T['1_journey_3_laps'] || T['2_journey_6_laps']) {
    L.push('## Jornadas (testes 1 e 2)', '');
    for (const k of ['1_journey_3_laps', '2_journey_6_laps']) {
      const t = T[k]; if (!t) continue;
      L.push(`**${k}** — ${t.race.laps} voltas, ${t.wallSeconds.toFixed(0)} s de relógio (simulação 4×), voltas do jogador: ${t.race.lapTimes[0].join(' / ')} s`, '');
      L.push('| Pos | Piloto | Tempo | Melhor volta |', '| --- | --- | --- | --- |');
      t.race.results.forEach((r, i) => L.push(`| ${i + 1} | ${r.name} | ${r.projected ? '≈ ' : ''}${r.time.toFixed(3)} s | ${r.best.toFixed(3)} s |`));
      L.push('');
    }
  }
  if (T['5_ai']) { const a = T['5_ai']; L.push('## IA (teste 5)', '', `Maior tempo parado: ${a.maxStoppedS} s; maior tempo fora da pista: ${a.maxOffTrackS} s; ultrapassagens entre IAs: ${a.aiOvertakes}.`, ''); }
  if (T['6_integrity']) { const a = T['6_integrity']; L.push('## Integridade (teste 6)', '', `validateWorld: ${a.validateWorld.errors} erros (${a.validateWorld.stats.objects} objetos); eventos abaixo do terreno/atravessou collider/caiu do mundo: ${a.invariantEvents}; câmera dentro de geometria: ${a.cameraInside}.`, ''); }
  if (R.lap) {
    const A = R.lap;
    L.push('## 13.2 Áudio (uma volta com as IAs)', '', `Duração gravada ${A.audio.wav.seconds.toFixed(1)} s, ${A.audio.wav.sampleRate} Hz estéreo. Pico do master: **${A.audio.wav.peakDb.toFixed(2)} dBFS** (WAV) / ${A.audio.peakDb.toFixed(2)} dBFS (medidor pós-limitador). Máximo de vozes simultâneas: ${A.maxVoicesLogical} lógicas (${A.maxSources} nós de fonte). Volta do vídeo: ${A.lapTime.toFixed(2)} s.`, '');
    L.push('| Evento | Instantes (mm:ss) |', '| --- | --- |');
    for (const [k, v] of Object.entries(A.events)) L.push(`| ${k} | ${v.slice(0, 14).join(', ')}${v.length > 14 ? ` … (+${v.length - 14})` : ''} |`);
    L.push('');
  }
  if (T['3_pause_restart_menu']) { const t = T['3_pause_restart_menu']; L.push('## Reinícios (teste 3)', '', `Vozes persistentes no início: ${t.voicesAtStart.persistent}; após cada reinício: ${t.restarts.map((r) => r.voices.persistent).join(', ')}. Heap JS: ${(t.heap0 / 1e6).toFixed(1)} MB → ${t.restarts.map((r) => (r.heap / 1e6).toFixed(1)).join(' → ')} MB.`, ''); }
  if (R.perf) {
    const P = R.perf;
    L.push('## 13.3 Desempenho (Vila/Z3, 5 IAs, 1920×1080)', '', `GPU: ${P.gpu.renderer}. CPU: ${P.cpu} (${P.cores} threads). Navegador: ${P.browser}. ${P.os}.`, '');
    L.push('| Qualidade | FPS médio | 1% low | quadros | draw calls | triângulos | escala interna |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const q of [P.alta, P.baixa]) L.push(`| ${q.quality} | ${q.avgFps} | ${q.low1Fps} | ${q.frames} | ${q.calls} | ${q.tris} | ${q.scale} |`);
    L.push('');
  }
  if (R.shots) {
    L.push('## 13.4 Screenshots', '', '| # | Arquivo | FPS | Céu | Lum. média | Desvio | Maior cor única |', '| --- | --- | --- | --- | --- | --- | --- |');
    const M = (T['7_image_sanity'] && T['7_image_sanity'].metrics) || {};
    for (const [id, sh] of Object.entries(R.shots)) { const m = M[id]; L.push(`| ${id.toUpperCase()} | ${sh.file} | ${sh.fps} | ${m ? (m.skyFraction * 100).toFixed(1) + '%' : '—'} | ${m ? m.meanLuminance : '—'} | ${m ? m.stdLuminance : '—'} | ${m ? (m.maxSingleColorFraction * 100).toFixed(1) + '%' : '—'} |`); }
    L.push('');
  }
  if (T['9_sweep']) L.push('## Varredura (teste 9)', '', `${T['9_sweep'].points} pontos a cada 25 m; falhas: ${T['9_sweep'].failures.length}. Métricas por ponto em \`sweep/sweep-metrics.json\`.`, '');
  fs.writeFileSync(path.join(OUT, 'REPORT-dados.md'), L.join('\n') + '\n');
}
