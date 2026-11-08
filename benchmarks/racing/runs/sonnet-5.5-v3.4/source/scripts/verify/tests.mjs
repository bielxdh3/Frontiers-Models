// Automated tests of spec 13.1 (1-6, 8) and the audio/video lap of 13.2. Each returns a plain object that is written to verification/ as JSON + log.
import fs from 'node:fs';
import path from 'node:path';
import { Session, sleep, write, mkdir } from './lib.mjs';

const waitState = (s, state, timeout = 60000) => s.page.waitForFunction((st) => __RACING__.state === st, state, { timeout });
const snap = (s) => s.ev(() => __RACING__.raceSnapshot());

/** 13.1 tests 1 and 2: full journey through the real UI, N laps against 5 AIs, results, "race again" */
export async function journey(browser, port, { laps, car, tag, outDir }) {
  const s = await new Session(browser, { port, q: 'high', w: 1280, h: 720, name: tag }).open();
  const log = []; const L = (m) => { log.push(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`); }; const t0 = Date.now();
  const r = { tag, laps, car, checks: {}, ok: true };
  const check = (name, cond, detail) => { r.checks[name] = { pass: !!cond, detail }; if (!cond) r.ok = false; L(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); };
  try {
    check('menu-shown-with-live-background', (await s.ev(() => __RACING__.state)) === 'menu' && (await s.ev(() => !!__RACING__.game.demo && __RACING__.game.demo.cars.length === 6)), 'demo race with 6 cars behind the menu');
    await s.page.click('#btn-play'); await waitState(s, 'garage', 5000); L('garage');
    if (car === 'hatch') await s.page.keyboard.press('ArrowRight');
    await sleep(500);
    const garage = await s.ev(() => ({ name: document.getElementById('g-name').textContent }));
    check('car-selected', garage.name === (car === 'hatch' ? 'Pulse RS' : 'Veloce GT'), garage);
    await s.page.click('#g-ok'); await waitState(s, 'setup', 5000);
    await s.page.click(`#o-laps button[data-v="${laps}"]`); await s.page.click('#s-go'); await waitState(s, 'grid', 5000); L('grid presentation');
    const gridList = await s.ev(() => document.querySelectorAll('#gp-list .gp').length);
    check('grid-presentation-lists-6-cars', gridList === 6, gridList);
    // real-time grid presentation + countdown: sample the 3-2-1 text
    const seen = new Set(); const tg = Date.now();
    while (Date.now() - tg < 25000) { const st = await s.ev(() => ({ s: __RACING__.state, cd: document.getElementById('cd').textContent })); if (st.cd) seen.add(st.cd); if (st.s === 'racing') break; await sleep(150); }
    check('countdown-3-2-1-go', ['3', '2', '1'].every((x) => seen.has(x)) && seen.has('VAI!'), [...seen]);
    const racing = await s.ev(() => ({ state: __RACING__.state, n: __RACING__.race.cars.length, ai: __RACING__.race.cars.filter((c) => !c.isPlayer).length }));
    check('race-with-5-ai', racing.state === 'racing' && racing.n === 6 && racing.ai === 5, racing);
    // the player drives for ~6 s of real time with the keyboard (real input), then the test autopilot takes over
    await s.page.keyboard.down('ArrowUp'); await sleep(2500); await s.page.keyboard.down('ArrowRight'); await sleep(250); await s.page.keyboard.up('ArrowRight'); await sleep(1500); await s.page.keyboard.up('ArrowUp');
    const manual = await snap(s); check('keyboard-input-moves-the-car', manual.cars[0].kmh > 20, manual.cars[0].kmh);
    await s.ev(() => __RACING__.autopilot(true));
    let last = 0, guard = 0, snapEnd = null;
    while (guard++ < 400) {
      const sn = await s.ev(() => { __RACING__.advance(5); return __RACING__.raceSnapshot(); });
      if (sn.t - last >= 60 || sn.state !== 'racing') { last = sn.t; L(`t=${sn.t} ${sn.state} ` + sn.cars.map((c) => `${c.name.split(' ')[0]}:P${c.pos} L${c.lap}`).join(' ')); }
      if (sn.state === 'results') { snapEnd = sn; break; }
    }
    check('reached-results-screen', !!snapEnd, snapEnd && snapEnd.t);
    const res = await s.ev(() => ({ rows: [...document.querySelectorAll('#r-body tr')].map((tr) => [...tr.children].map((td) => td.textContent)), shown: document.getElementById('scr-results').classList.contains('on'), player: __RACING__.player.lapTimes, laps: __RACING__.player.lapsDone, finished: __RACING__.player.finished, finishTime: __RACING__.player.finishTime, projected: __RACING__.race.cars.map((c) => [c.name, c.finished, c.projected]) }));
    check('results-table-6-rows', res.shown && res.rows.length === 6, res.rows.length);
    check('player-completed-all-laps', res.laps === laps && res.finished && res.player.length === laps, { laps: res.laps, lapTimes: res.player.map((x) => +x.toFixed(2)) });
    check('others-without-finish-show-approximate-time', res.rows.some((row) => row[3].startsWith('≈')) || res.rows.every((row) => !row[3].startsWith('≈')), res.rows.map((x) => x[3]));
    r.results = res; r.finalSnapshot = snapEnd;
    await s.page.screenshot({ path: path.join(outDir, `journey-${tag}-results.png`) });
    // integrity
    const integ = await s.ev(() => ({ stats: __RACING__.race.stats, log: __RACING__.race.log, cam: __RACING__.camStats(), maxStuck: Math.max(...__RACING__.race.cars.filter((c) => !c.isPlayer).map((c) => c.maxStuckAi || 0)), resets: __RACING__.race.cars.map((c) => c.resets), events: __RACING__.race.events.filter((e) => ['reset', 'overtake', 'line-no-lap'].includes(e.type)).slice(0, 60) }));
    r.integrity = integ;
    check('no-car-under-terrain', integ.stats.underTerrain === 0, integ.stats.underTerrain);
    check('no-collider-crossing', integ.stats.colliderCross === 0, { crossings: integ.stats.colliderCross, maxPenetrationM: +integ.stats.maxWallPen.toFixed(3) });
    check('no-car-fell-out-of-world', integ.stats.fellOut === 0, integ.stats.fellOut);
    check('camera-never-inside-geometry', integ.cam.violations === 0 && integ.cam.frames > 100, { frames: integ.cam.frames, violations: integ.cam.violations, minClearanceM: +integ.cam.minClear.toFixed(2) });
    check('ai-never-stuck-or-off-road-over-5s', integ.stats.aiStuck === 0 && integ.maxStuck < 5, { aiStuckEvents: integ.stats.aiStuck, longestStuckOrOffSeconds: +integ.maxStuck.toFixed(2) });
    check('at-least-one-overtake-between-ais', integ.stats.overtakesAI >= 1, integ.stats.overtakesAI);
    // race again
    await s.page.click('#r-again'); await waitState(s, 'grid', 5000);
    const again = await s.ev(() => ({ t: __RACING__.race.t, laps: __RACING__.race.cars.map((c) => c.lapsDone), n: __RACING__.race.cars.length, state: __RACING__.state }));
    check('race-again-starts-clean', again.state === 'grid' && again.t === 0 && again.laps.every((x) => x === 0) && again.n === 6, again);
    await s.ev(() => { __RACING__.skipToRace(); __RACING__.autopilot(true); __RACING__.advance(15); });
    const again2 = await snap(s); check('second-race-runs', again2.state === 'racing' && again2.cars.every((c) => c.s > 0 || c.lap > 0), { t: again2.t, positions: again2.cars.map((c) => c.pos) });
  } catch (e) { r.ok = false; r.error = String(e && e.stack || e); L('EXCEPTION ' + r.error); }
  r.consoleErrors = s.errors.slice(0, 20); r.consoleLogLines = s.logs.length;
  check('no-console-errors', s.errors.length === 0, s.errors.slice(0, 3));
  write(path.join(outDir, `journey-${tag}.log`), log.join('\n') + '\n\n--- console ---\n' + s.logText());
  await s.close(); return r;
}

/** 13.1 test 3: pause/resume, restart in the middle, back to menu, no old state, no duplicated audio, stable heap after 3 restarts */
export async function pauseRestart(browser, port, { outDir }) {
  const s = await new Session(browser, { port, q: 'high', w: 1280, h: 720, name: 'pause' }).open();
  const log = []; const L = (m) => log.push(m); const r = { checks: {}, ok: true };
  const check = (name, cond, detail) => { r.checks[name] = { pass: !!cond, detail }; if (!cond) r.ok = false; L(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); };
  try {
    await s.page.click('#btn-play'); await s.page.waitForFunction(() => __RACING__.audio.ready, null, { timeout: 30000 });
    await s.page.click('#g-ok'); await s.page.click('#s-go'); await waitState(s, 'grid', 5000);
    await s.ev(() => __RACING__.setFast(false));
    await s.page.waitForFunction(() => __RACING__.state === 'racing', null, { timeout: 30000 });
    await s.page.keyboard.down('ArrowUp'); await sleep(2500);
    const gcHeap = async () => { await s.ev(() => { if (window.gc) window.gc(); }); await sleep(300); return s.ev(() => ({ heap: __RACING__.heap(), info: __RACING__.renderInfo(), audio: __RACING__.audioSnapshot() })); };
    // pause / resume
    const a = await snap(s); await s.page.keyboard.press('Escape'); await sleep(600);
    const p1 = await snap(s); await sleep(1500); const p2 = await snap(s);
    const pausedUi = await s.ev(() => ({ shown: document.getElementById('scr-pause').classList.contains('on'), paused: __RACING__.game.paused, gain: __RACING__.audio.pauseG ? __RACING__.audio.pauseG.gain.value : null, lp: __RACING__.audio.pauseLP ? __RACING__.audio.pauseLP.frequency.value : null }));
    check('pause-freezes-the-race', pausedUi.paused && pausedUi.shown && p2.t === p1.t && Math.abs(p2.cars[0].s - p1.cars[0].s) < 0.01, { t1: p1.t, t2: p2.t });
    check('pause-muffles-audio', pausedUi.gain !== null && pausedUi.gain < 0.5 && pausedUi.lp < 2000, pausedUi);
    await s.page.keyboard.press('Escape'); await sleep(1500); const b = await snap(s);
    check('resume-continues', b.t > p2.t + 0.8 && b.state === 'racing', { before: p2.t, after: b.t });
    const base = await gcHeap(); r.baseline = base; L('baseline ' + JSON.stringify(base));
    // 3 restarts from the pause menu, in the middle of the race
    const after = [];
    for (let k = 0; k < 3; k++) {
      await s.page.keyboard.press('Escape'); await sleep(400); await s.page.click('#p-restart'); await waitState(s, 'grid', 8000);
      const g = await snap(s); check(`restart-${k + 1}-clean-state`, g.t === 0 && g.cars.every((c) => c.lap === 0), { t: g.t });
      await s.page.waitForFunction(() => __RACING__.state === 'racing', null, { timeout: 30000 }); await s.page.keyboard.down('ArrowUp'); await sleep(2500);
      after.push(await gcHeap());
    }
    r.afterRestarts = after;
    const h0 = base.heap.used, h3 = after[2].heap.used;
    check('heap-stable-after-3-restarts', h3 < h0 * 1.15 + 8e6, { baselineMB: +(h0 / 1e6).toFixed(1), afterMB: after.map((x) => +(x.heap.used / 1e6).toFixed(1)) });
    check('gpu-objects-stable-after-3-restarts', after[2].info.geometries <= base.info.geometries + 40 && after[2].info.textures <= base.info.textures + 12, { base: base.info, after: after[2].info });
    check('audio-sources-and-voices-return-to-initial-value', after[2].audio.liveSources === base.audio.liveSources && after[2].audio.raceVoices === base.audio.raceVoices, { base: base.audio, afterThird: after[2].audio, all: after.map((x) => x.audio.liveSources) });
    // back to the menu
    await s.page.keyboard.press('Escape'); await sleep(400); await s.page.click('#p-menu'); await waitState(s, 'menu', 8000); await sleep(1200);
    const menu = await s.ev(() => ({ race: !!__RACING__.race, demo: !!__RACING__.game.demo, hud: document.getElementById('hud').classList.contains('on'), audio: __RACING__.audioSnapshot() }));
    check('back-to-menu-without-old-race', !menu.race && menu.demo && !menu.hud, menu);
    check('menu-audio-voices-sane', menu.audio.raceVoices <= 6 && menu.audio.liveSources <= base.audio.liveSources + 60, menu.audio);
  } catch (e) { r.ok = false; r.error = String(e && e.stack || e); L('EXCEPTION ' + r.error); }
  r.consoleErrors = s.errors.slice(0, 20);
  check('no-console-errors', s.errors.length === 0, s.errors.slice(0, 3));
  write(path.join(outDir, 'pause-restart.log'), log.join('\n') + '\n\n--- console ---\n' + s.logText());
  await s.close(); return r;
}

/** 13.1 test 4: cutting the track must not count a lap */
export async function antiCut(browser, port, { outDir }) {
  const s = await new Session(browser, { port, q: 'high', w: 960, h: 540, name: 'anticut' }).open();
  const log = []; const L = (m) => log.push(m); const r = { checks: {}, ok: true };
  const check = (name, cond, detail) => { r.checks[name] = { pass: !!cond, detail }; if (!cond) r.ok = false; L(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); };
  try {
    await s.ev(() => { __RACING__.startRace({ car: 'gt', laps: 3 }); __RACING__.skipToRace(); __RACING__.autopilot(true); __RACING__.advance(6); });
    const L0 = await s.ev(() => __RACING__.world.track.length);
    // (a) skip all checkpoints: jump (with consistent bookkeeping, i.e. like leaving the road and rejoining) to just before the line and cross it
    await s.ev((L) => { const R = __RACING__; R.placePlayer(L - 90, 0, 38); R.advance(9); }, L0);
    const a = await s.ev(() => { const p = __RACING__.player; return { laps: p.lapsDone, events: __RACING__.race.events.filter((e) => e.car === 0 && (e.type === 'line-no-lap' || e.type === 'lap')), cpNext: p.cpNext }; });
    check('crossing-the-line-without-checkpoints-gives-no-lap', a.laps === 0 && a.events.some((e) => e.type === 'line-no-lap') && !a.events.some((e) => e.type === 'lap'), a);
    // (b) a raw teleport far ahead (a real shortcut): the position jump is not credited as distance
    const before = await s.ev(() => ({ d: __RACING__.player.distance }));
    await s.ev(() => { const R = __RACING__, p = R.player, T = R.world.track; const i = T.indexAtS(1200), q = T.roadPoint(i, 0, 0); p.v.reset(q.x, q.z, T.heading[i], i, 0); R.advance(1.0); });
    const b = await s.ev(() => ({ d: __RACING__.player.distance, lost: __RACING__.player.lost, laps: __RACING__.player.lapsDone }));
    check('shortcut-jump-is-not-credited', b.laps === 0 && Math.abs(b.d - before.d) < 400 || b.lost === true, { before: +before.d.toFixed(0), after: +b.d.toFixed(0), lost: b.lost });
    // (c) a legitimate lap still counts (autopilot from the start of a fresh race, fast-forwarded)
    await s.ev(() => { __RACING__.startRace({ car: 'gt', laps: 3 }); __RACING__.skipToRace(); __RACING__.autopilot(true); __RACING__.advance(125); });
    const c = await s.ev(() => ({ laps: __RACING__.player.lapsDone, times: __RACING__.player.lapTimes }));
    check('legitimate-lap-counts', c.laps >= 1 && c.times[0] > 90 && c.times[0] < 140, c);
  } catch (e) { r.ok = false; r.error = String(e && e.stack || e); L('EXCEPTION ' + r.error); }
  r.consoleErrors = s.errors.slice(0, 10);
  write(path.join(outDir, 'anticut.log'), log.join('\n') + '\n\n--- console ---\n' + s.logText());
  await s.close(); return r;
}

/** 13.2: one full real-time lap with the AIs; the master (post-limiter) is recorded to audio-volta.wav, the canvas+HUD+audio to volta.webm */
export async function audioVideoLap(browser, port, { outDir }) {
  const s = await new Session(browser, { port, q: 'high', w: 1280, h: 720, name: 'volta' }).open();
  const log = []; const L = (m) => log.push(`[${new Date().toISOString().slice(11, 23)}] ${m}`); const r = { checks: {}, ok: true };
  const check = (name, cond, detail) => { r.checks[name] = { pass: !!cond, detail }; if (!cond) r.ok = false; L(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); };
  try {
    await s.page.mouse.click(900, 360);                                           // first user gesture -> the audio context is created
    await s.page.waitForFunction(() => __RACING__.audio.ready, null, { timeout: 30000 });
    r.audioInit = await s.ev(() => ({ state: __RACING__.audio.ctx.state, sampleRate: __RACING__.audio.ctx.sampleRate, limiter: __RACING__.audio.limiterKind, failed: __RACING__.audio.failed }));
    await s.ev(() => { __RACING__.startRace({ car: 'gt', laps: 1, diff: 'normal' }); __RACING__.recorder(1280, 720); __RACING__.audio.stats.maxVoices = 0; __RACING__.audio.stats.maxAiVoices = 0; });
    const startsAt = await s.ev(() => { const R = __RACING__; const ok = R.audio.startRecording(); R._rec.start(30); return { ok, t: R.audio.ctx.currentTime }; });
    await s.ev(() => __RACING__.autopilot(true));
    await s.page.waitForFunction(() => __RACING__.state === 'racing', null, { timeout: 40000 });
    L('racing started');
    let skid = 0, ram = 0, guard = 0, snapNow = null; const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      snapNow = await s.ev(() => { const R = __RACING__, p = R.player; return { state: R.state, s: p.sTrack, laps: p.lapsDone, t: R.race.t, kmh: p.v.speed * 3.6, fin: p.finished }; });
      if (snapNow.laps >= 1 || snapNow.state === 'finished' || snapNow.state === 'results') break;
      if (skid === 0 && snapNow.s > 430 && snapNow.s < 600 && snapNow.kmh > 80) { skid = 1; await s.ev(() => __RACING__.drive({ steer: 0.9, throttle: 1, brake: 0, handbrake: 1, assist: 0, tc: 0 })); await sleep(1300); await s.ev(() => __RACING__.drive(null)); L('scripted skid (handbrake + steering) at s=' + snapNow.s.toFixed(0)); }
      if (ram === 0 && snapNow.s > 1010 && snapNow.s < 1100) { ram = 1; await s.ev(() => __RACING__.drive({ steer: -1, throttle: 0.7, brake: 0, handbrake: 0, assist: 0.45 })); await sleep(900); await s.ev(() => __RACING__.drive(null)); L('scripted wall contact at s=' + snapNow.s.toFixed(0)); }
      await sleep(250);
    }
    const lapDone = snapNow && snapNow.laps >= 1; check('full-lap-completed-in-real-time', lapDone, snapNow);
    const rec = await s.ev(() => __RACING__.audio.stopRecording()); const vid = await s.ev(() => __RACING__._rec.stop());
    r.audioRec = rec; r.video = vid; L('audio rec ' + JSON.stringify(rec)); L('video rec ' + JSON.stringify(vid));
    // transfer the files
    const wavParts = []; const total = rec.bytes; const CH = 3 * 1024 * 1024;
    for (let off = 0; off < total; off += CH) wavParts.push(Buffer.from(await s.ev(([o, c]) => __RACING__.audio.wavChunk(o, c), [off, CH]), 'base64'));
    fs.writeFileSync(path.join(outDir, 'audio-volta.wav'), Buffer.concat(wavParts));
    const vParts = []; for (let i = 0; i * CH < vid.bytes; i++) vParts.push(Buffer.from(await s.ev(([i, c]) => __RACING__._rec.chunk(i, c), [i, CH]), 'base64'));
    fs.writeFileSync(path.join(outDir, 'volta.webm'), Buffer.concat(vParts));
    // independent peak measurement from the written file
    const wav = fs.readFileSync(path.join(outDir, 'audio-volta.wav')); let peak = 0; const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) >> 1); for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
    r.fileMeasured = { peakLinear: peak / 32768, peakDbfs: +(20 * Math.log10(Math.max(peak, 1) / 32768)).toFixed(2), seconds: +(pcm.length / 2 / rec.sampleRate).toFixed(1) };
    check('master-peak-at-or-below-minus-1-dbfs', r.fileMeasured.peakDbfs <= -1.0, r.fileMeasured);
    const ev = await s.ev(() => ({ log: __RACING__.audio.log.filter((e) => e.rt !== null), stats: { ...__RACING__.audio.stats }, snapshot: __RACING__.audioSnapshot(), audit: __RACING__.audio.audit(), laps: __RACING__.player.lapTimes }));
    r.events = ev.log; r.stats = ev.stats; r.audit = ev.audit; r.lapTimes = ev.laps;
    const by = (t) => ev.log.filter((e) => e.type === t);
    const mmss = (x) => { const m = Math.floor(x / 60), sec = x - m * 60; return `${String(m).padStart(2, '0')}:${sec.toFixed(1).padStart(4, '0')}`; };
    r.instants = { shift: by('shift').map((e) => mmss(e.rt)), skid: by('skid').map((e) => mmss(e.rt)), impact: by('impact').map((e) => mmss(e.rt)), scrape: by('scrape').map((e) => mmss(e.rt)), bridge: by('bridge-enter').concat(by('bridge-exit')).map((e) => `${e.type}@${mmss(e.rt)}`), aiPass: by('ai-pass').map((e) => `${mmss(e.rt)} ${e.dir}`) };
    check('events-logged-shift-skid-impact-bridge', r.instants.shift.length > 5 && r.instants.skid.length >= 1 && r.instants.impact.length >= 1 && r.instants.bridge.length >= 1, { shifts: r.instants.shift.length, skids: r.instants.skid.length, impacts: r.instants.impact.length, bridge: r.instants.bridge.length, aiPass: r.instants.aiPass.length });
    check('max-ai-voices-at-most-5', ev.stats.maxAiVoices <= 5, { maxAiVoices: ev.stats.maxAiVoices, maxVoicesTotal: ev.stats.maxVoices });
    check('player-engine-uses-audio-buffers', ev.audit.engineIsSampled && ev.audit.playerEngine.buffersBound >= 4, ev.audit.playerEngine);
    check('video-recorded-with-audio-track', vid.bytes > 500000 && vid.frames > 600, vid);
  } catch (e) { r.ok = false; r.error = String(e && e.stack || e); L('EXCEPTION ' + r.error); }
  r.consoleErrors = s.errors.slice(0, 20);
  check('no-console-errors', s.errors.length === 0, s.errors.slice(0, 3));
  write(path.join(outDir, 'audio-volta.log'), log.join('\n') + '\n\n--- console ---\n' + s.logText());
  await s.close(); return r;
}
