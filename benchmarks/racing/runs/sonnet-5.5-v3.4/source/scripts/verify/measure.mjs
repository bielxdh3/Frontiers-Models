// Performance (13.3), camera sweep every 25 m (13.1 test 9), scene audit (13.1 test 8), comparison images.
import fs from 'node:fs';
import path from 'node:path';
import { Session, sleep, write, mkdir, IMAGE_METRICS_JS, COMPARE_JS, resizeJs } from './lib.mjs';

export async function perf(browser, port, q, { seconds = 15 } = {}) {
  const s = await new Session(browser, { port, q, w: 1920, h: 1080, name: 'perf-' + q }).open();
  await s.page.mouse.click(900, 360); await s.page.waitForFunction(() => __RACING__.audio.ready, null, { timeout: 30000 });
  await s.ev(() => { const R = __RACING__; R.startRace({ car: 'gt', laps: 3, diff: 'normal' }); R.skipToRace(); R.autopilot(true); R.placePlayer(1670, 0, 26); R.pack([{ dS: 26, lat: -2.5 }, { dS: 50, lat: 2.5 }, { dS: -22, lat: 2.5 }, { dS: 80, lat: -2 }, { dS: -48, lat: -2 }], 26); R.advance(0.5); R.cam.setMode('chase'); });
  await sleep(2500);
  await s.ev(() => __RACING__.perfStart()); await sleep(seconds * 1000);
  const res = await s.ev(() => ({ perf: __RACING__.perfStop(), render: __RACING__.renderInfo(), zoneS: __RACING__.player.sTrack, kmh: __RACING__.player.v.speed * 3.6, quality: __RACING__.S.state.qName, pixelRatio: __RACING__.renderer.getPixelRatio(), canvas: [__RACING__.renderer.domElement.width, __RACING__.renderer.domElement.height] }));
  const loadMs = s.loadMs; const errors = s.errors.slice(0, 5);
  await s.close();
  return { quality: q, seconds, loadMs, ...res, errors };
}

/** camera sweep: chase camera behind a car placed every 25 m of the lap; every frame is checked with the image-sanity metrics */
export async function sweep(browser, port, outDir, { step = 25 } = {}) {
  mkdir(outDir);
  const s = await new Session(browser, { port, q: 'high', w: 1920, h: 1080, name: 'sweep' }).open();
  await s.ev(() => { const R = __RACING__; R.startRace({ car: 'gt', laps: 3, diff: 'normal' }); R.skipToRace(); R.autopilot(true); R.hud(false); R.pack([], 0); });
  const L = await s.ev(() => __RACING__.world.track.length);
  const rows = [], thumbs = [];
  for (let d = 0; d < L; d += step) {
    await s.ev((d) => { const R = __RACING__; R.freeze(false); R.placePlayer(d, 0, 24); R.pack([{ dS: 30, lat: -2.2 }, { dS: -24, lat: 2.2 }], 24); R.advance(0.25); R.cam.setMode('chase'); R.advance(0.2); R.freeze(true); }, d);
    await sleep(260);
    const sky = await s.ev(() => __RACING__.skyFraction());
    const png = await s.page.screenshot({ type: 'png' });
    const b64 = png.toString('base64');
    const m = await s.ev(IMAGE_METRICS_JS, b64);
    const thumb = await s.ev(resizeJs, { b64, w: 480, h: 270 });
    const name = `sweep-${String(Math.round(d)).padStart(4, '0')}m.png`;
    fs.writeFileSync(path.join(outDir, name), Buffer.from(thumb, 'base64'));
    const pass = sky >= 0.10 && m.lumMean >= 0.25 && m.lumMean <= 0.75 && m.lumStd >= 0.12 && m.maxColourShare <= 0.30;
    rows.push({ s: d, file: name, skyPct: +(sky * 100).toFixed(1), ...m, pass });
    thumbs.push({ b64: thumb, label: `${d}`, pass });
  }
  // contact sheet
  const sheet = await s.ev(async ({ items, cols, tw, th }) => {
    const rowsN = Math.ceil(items.length / cols), c = document.createElement('canvas'); c.width = cols * tw; c.height = rowsN * th; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    await Promise.all(items.map((it, k) => new Promise((res) => { const im = new Image(); im.onload = () => { const x = (k % cols) * tw, y = Math.floor(k / cols) * th; g.drawImage(im, x, y, tw, th); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 70, 20); g.fillStyle = it.pass ? '#8f8' : '#f88'; g.font = 'bold 14px Arial'; g.fillText(it.label + ' m', x + 4, y + 15); res(); }; im.src = 'data:image/png;base64,' + it.b64; })));
    return c.toDataURL('image/png').split(',')[1];
  }, { items: thumbs, cols: 11, tw: 240, th: 135 });
  fs.writeFileSync(path.join(outDir, 'sweep-sheet.png'), Buffer.from(sheet, 'base64'));
  const failures = rows.filter((r) => !r.pass);
  const out = { step, count: rows.length, failures: failures.length, failingAt: failures.map((f) => ({ s: f.s, skyPct: f.skyPct, lumMean: f.lumMean, lumStd: f.lumStd, maxColourShare: f.maxColourShare })), rows, errors: s.errors.slice(0, 5) };
  await s.close(); return out;
}

export async function sceneAudit(browser, port) {
  const s = await new Session(browser, { port, q: 'high', w: 1280, h: 720, name: 'audit' }).open();
  await s.page.mouse.click(900, 360); await s.page.waitForFunction(() => __RACING__.audio.ready, null, { timeout: 30000 });
  await s.ev(() => { const R = __RACING__; R.startRace({ car: 'gt', laps: 3 }); R.skipToRace(); R.autopilot(true); R.advance(3); });
  await sleep(500);
  const stats = await s.ev(() => ({ audit: __RACING__.sceneStats(), validate: __RACING__.validate() }));
  const errors = s.errors.slice(0, 5); await s.close(); return { ...stats, errors };
}

export async function compares(session, shots, refsDir, outDir) {
  mkdir(outDir); const made = [];
  for (const sh of shots) {
    if (!sh.refs || !sh.refs.length) continue;
    const mine = fs.readFileSync(path.join(sh.dir, sh.file)).toString('base64');
    for (let k = 0; k < sh.refs.length; k++) {
      const refName = fs.readdirSync(refsDir).find((f) => f.startsWith(sh.refs[k]));
      if (!refName) continue;
      const png = await session.ev(COMPARE_JS, { mine, ref: fs.readFileSync(path.join(refsDir, refName)).toString('base64'), w: 1280, h: 720, labelA: `${sh.id.toUpperCase()}  (jogo)`, labelB: `ref ${refName.slice(0, 2)}  ${refName.replace(/\.jpg$/, '').slice(3)}` });
      const out = k === 0 ? `${sh.id}.png` : `${sh.id}-ref${sh.refs[k]}.png`;
      fs.writeFileSync(path.join(outDir, out), Buffer.from(png, 'base64')); made.push(out);
    }
  }
  return made;
}
