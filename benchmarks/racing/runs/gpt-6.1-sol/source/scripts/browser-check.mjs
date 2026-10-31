import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('output/playwright'); await mkdir(out, { recursive: true });
const report = { started: new Date().toISOString(), browser: '', journeys: [], errors: [], externalRequests: [], screenshots: [], notes: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
report.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(12000);
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith('http://127.0.0.1:')) report.externalRequests.push(req.url()); });
const T = async (method, ...args) => page.evaluate(({ method, args }) => window.__solsticeTest[method](...args), { method, args });
const click = action => page.locator(`[data-action="${action}"]`).first().click();
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const shot = async name => { await settle(); await page.screenshot({ path: path.join(out, `${name}.png`) }); report.screenshots.push(name); };
async function journey(name, kind, fn) {
  try { const evidence = await fn(); report.journeys.push({ name, kind, status: 'passed', evidence }); console.log(`PASS ${name}: ${JSON.stringify(evidence)}`); }
  catch (e) { report.journeys.push({ name, kind, status: 'failed', error: e.message }); console.error(`FAIL ${name}: ${e.message}`); try { await shot(`failure-${report.journeys.length}`); } catch {} }
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
}
let exportedPath, exportedBody;
try {
  await page.goto('http://127.0.0.1:5173/?harness=1&testcase=browser-acceptance');
  await page.waitForFunction(() => !!window.__solsticeTest); await T('purge');
  await journey('first launch, all garage cars and setup', 'direct browser UI', async () => {
    await page.getByRole('heading', { name: 'Take the long way.' }).waitFor(); await shot('menu-desktop');
    await click('garage');
    for (const car of ['tern', 'mistral', 'solano']) { await page.locator(`[data-action="car"][data-value="${car}"]`).click(); await shot(`garage-${car}`); }
    await click('garage-back');
    await page.locator('[data-action="course"][data-value="riviera"]').click();
    await page.locator('#weather').selectOption('2'); await page.locator('#daylight').selectOption('3'); await page.locator('#difficulty').selectOption('2'); await shot('setup'); await click('start');
    const s = await T('state'); assert.equal(s.cars.length, 6); assert.equal(s.env.wet, 1); assert.equal(s.status, 'countdown');
    const x = s.cars[0].x; await page.keyboard.down('w'); await T('advance', 2, 'keyboard'); assert.equal((await T('state')).cars[0].x, x);
    await T('advance', 1.9, 'keyboard'); await page.keyboard.up('w'); const moving = await T('state'); assert.ok(moving.cars[0].speed > 8); await shot('race-night-grid');
    return { initialWeather: 'Rainy', initialLight: 'Night', cars: s.cars.length, countdownBlocksMotion: true, speedAfterKeyboard: moving.cars[0].speed };
  });
  await journey('keyboard nitro, drift, pause, focused HUD and remapping', 'direct keyboard + fixed-step harness', async () => {
    await T('begin', { course: 'coastal', car: 'tern', weather: 0, daylight: 1 }); await T('advance', 3.1, 'idle');
    await page.keyboard.down('w'); await T('advance', 1, 'keyboard'); await page.keyboard.down('Shift'); await T('advance', .35, 'keyboard'); assert.equal((await T('state')).cars[0].boosting, true);
    await page.keyboard.down('d'); await page.keyboard.down('Space'); await T('advance', .2, 'keyboard'); const slide = await T('state'); assert.equal(slide.cars[0].drifting, true); await shot('race-drift');
    await click('pause'); const frozen = await T('state'); await T('advance', 30, 'keyboard'); assert.equal((await T('state')).time, frozen.time); assert.equal(frozen.held.length, 0);
    await page.keyboard.up('w'); await page.keyboard.up('d'); await page.keyboard.up('Space'); await page.keyboard.up('Shift'); await click('settings');
    await page.locator('[data-action="bind"][data-value="throttle"]').click(); await page.keyboard.press('ArrowUp'); assert.equal((await T('state')).prefs.bindings.throttle, 'ArrowUp');
    await page.locator('[data-action="bind"][data-value="brake"]').click(); await page.keyboard.press('ArrowUp'); assert.match(await page.locator('#toast').innerText(), /Already used/); await page.keyboard.press('Escape');
    const before = (await T('state')).time; await page.locator('#quality').selectOption('High'); await settle(); const high = await T('graphics'); await page.locator('#quality').selectOption('Low'); await settle(); const low = await T('graphics'); assert.equal((await T('state')).time, before); assert.ok(high.sceneryInstances > low.sceneryInstances); assert.equal(high.shadows, true); assert.equal(low.shadows, false); assert.ok(high.rainBudget > low.rainBudget);
    await page.locator('#quality').selectOption('Medium'); await shot('settings'); await click('settings-back'); await click('resume');
    await page.keyboard.down('ArrowUp'); await T('advance', .2, 'keyboard'); assert.ok((await T('state')).held.includes('ArrowUp')); await page.keyboard.up('ArrowUp');
    await page.locator('[data-action="pause"]').focus(); await page.keyboard.press('Space'); assert.equal((await T('state')).screen, 'race');
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.equal((await T('state')).status, 'paused');
    await click('settings'); await click('reset-bindings'); assert.equal((await T('state')).prefs.bindings.throttle, 'KeyW'); await click('settings-back');
    return { nitroRemaining: slide.cars[0].nitro, drift: slide.cars[0].drifting, pauseFreeze: true, focusedSpaceDoesNotClickHUD: true, rebindAndConflict: true, high, low };
  });
  await journey('three-lap Time Trial with one invalid lap and qualified record', 'development harness, real physics and finish path', async () => {
    await T('begin', { course: 'coastal', weather: 0, daylight: 1, car: 'mistral' }); await T('advance', 15, 'auto');
    const prior = await T('state'); await page.keyboard.down('r'); await T('advance', .1, 'keyboard'); await page.keyboard.up('r'); const recovered = await T('state'); assert.equal(recovered.cars[0].progress.passed, prior.cars[0].progress.passed); assert.ok(recovered.cars[0].progress.unwrapped < prior.cars[0].progress.unwrapped);
    await T('advance', 700, 'auto'); const s = await T('state'); assert.equal(s.result.outcome, 'completed'); assert.equal(s.result.laps.length, 3); assert.equal(s.result.laps[0].valid, false); assert.ok(s.result.laps.slice(1).some(l => l.valid));
    await page.waitForFunction(() => Object.keys(__solsticeTest.records()).length > 0); const records = await T('records'); assert.ok(Object.values(records).every(r => r.source === 'harness'));
    await shot('results-trial'); await click('save-last'); await page.waitForFunction(async () => (await __solsticeTest.list()).entries.length === 1);
    const download = page.waitForEvent('download'); await click('export-last'); const file = await download; exportedPath = path.join(out, 'harness-trial.solstice'); await file.saveAs(exportedPath); exportedBody = await readFile(exportedPath, 'utf8'); assert.equal(JSON.parse(exportedBody).origin, 'harness');
    await click('view-last'); await page.getByRole('button', { name: 'Aerial', exact: true }).click(); await shot('replay-aerial');
    await page.locator('#replay-seek').evaluate((el) => { el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await shot('replay-trial');
    await click('replay-back'); await click('home'); await page.reload(); await page.waitForFunction(() => !!window.__solsticeTest);
    const loaded = await T('list'); assert.equal(loaded.entries.length, 1);
    await click('library'); await page.getByRole('heading', { name: 'Good roads. Worth keeping.' }).waitFor(); await page.locator('[data-action="open-entry"]').first().click(); await page.getByRole('button', { name: 'Trackside', exact: true }).click(); await shot('replay-after-refresh');
    return { laps: s.result.laps, qualifiedHarnessRecord: Object.values(records)[0].time, replayFrames: s.frames, persistedAfterReload: loaded.entries.length };
  });
  await journey('three competitive races on fixed Easy, Normal and Hard', 'development harness, six cars using the real simulation', async () => {
    const results = [];
    for (const difficulty of [0, 1, 2]) {
      await T('begin', { course: 'riviera', car: ['tern', 'mistral', 'solano'][difficulty], difficulty, weather: difficulty, daylight: difficulty === 2 ? 3 : 1 });
      await T('advance', 38, 'auto', 0); await shot(`race-${['easy', 'normal', 'hard'][difficulty]}`); await T('advance', 700, 'auto', 0);
      const s = await T('state'); assert.equal(s.result.outcome, 'completed'); assert.equal(s.result.laps.length, 3); assert.equal(s.result.standings.length, 6);
      results.push({ difficulty, time: s.time, carsFinished: s.result.standings.filter(c => c.finishTime !== null).length, actualOpponentFinishes: s.result.standings.filter(c => c.id > 0 && c.finishTime !== null).map(c => c.finishTime) });
    }
    await shot('results-race'); return results;
  });
  await journey('sixteen-gate Checkpoint Run success and genuine timeout', 'development harness, real progress/score/timer paths', async () => {
    await T('begin', { course: 'horizon', car: 'tern', weather: 0, daylight: 0 }); await T('advance', 46, 'auto'); const midway = await T('state'); assert.ok(midway.score > 0); assert.ok(midway.combo > 1); await shot('checkpoint-run');
    await T('advance', 600, 'auto'); const success = await T('state'); assert.equal(success.result.outcome, 'completed'); assert.equal(success.cars[0].progress.passed, 16); await shot('results-rush');
    await T('begin', { course: 'horizon' }); await T('advance', 35, 'idle'); const failure = await T('state'); assert.equal(failure.result.outcome, 'failed'); assert.equal(failure.remaining, 0); assert.equal(failure.cars[0].progress.passed, 0); assert.ok(failure.frames > 150); await shot('results-timeout');
    return { score: success.score, combo: success.combo, remaining: success.remaining, failedAt: failure.time, failedReplayFrames: failure.frames };
  });
  await journey('damage, recovery, climate change, retirement and faithful seeking', 'scripted real inputs + replay UI', async () => {
    await T('begin', { course: 'coastal', car: 'tern', weather: 2, daylight: 2 }); await T('advance', 23, { throttle: 1, steer: .5 }); const damaged = await T('state'); assert.ok(Math.max(...damaged.cars[0].damage) > 0); await shot('damage-wet');
    await page.keyboard.down('r'); await T('advance', .1, 'keyboard'); await page.keyboard.up('r'); await T('advance', 95, 'auto'); await click('pause'); await click('retire'); const retired = await T('state'); assert.equal(retired.result.outcome, 'partial'); assert.equal(retired.result.best, null);
    const replay = await T('replay'), collision = replay.events.find(e => e.type === 'collision'), recovery = replay.events.find(e => e.type === 'recover'); assert.ok(collision && recovery);
    const old = await T('inspectReplay', 0), after = await T('inspectReplay', collision.t + .1); assert.deepEqual(old.cars[0].damage, [0, 0, 0]); assert.ok(Math.max(...after.cars[0].damage) > 0);
    await T('inspectReplay', retired.time); assert.deepEqual(await T('inspectReplay', collision.t + .1), after); assert.notEqual((await T('inspectReplay', 0)).env.wet, (await T('inspectReplay', 90)).env.wet);
    await click('view-last');
    for (const [camera, time] of [['Chase', collision.t + .1], ['Trackside', recovery.t + .02], ['Aerial', 90]]) {
      await page.getByRole('button', { name: camera, exact: true }).click(); await page.locator('#replay-seek').evaluate((el, t) => { el.value = String(t); el.dispatchEvent(new Event('input', { bubbles: true })); }, time); await shot(`replay-${camera.toLowerCase()}-event`);
    }
    await click('replay-play'); await page.waitForTimeout(400); await click('replay-play'); const frozenTime = await page.locator('#replay-time').innerText(); await page.waitForTimeout(300); assert.equal(await page.locator('#replay-time').innerText(), frozenTime);
    return { damage: damaged.cars[0].damage, collisionTime: collision.t, recoveryTime: recovery.t, outcome: retired.result.outcome, duration: retired.time, seekDirectionIndependent: true };
  });
  await journey('Postcard studio produces an original downloadable PNG', 'direct browser UI and local file export', async () => {
    await click('photo'); await page.locator('#photo-caption').fill('A little summer to keep.'); await page.locator('#photo-treatment').selectOption('midnight');
    await page.locator('#photo-angle').evaluate(el => { el.value = '1.8'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await shot('postcard-studio');
    const promise = page.waitForEvent('download'); await click('photo-export'); const download = await promise; await download.saveAs(path.join(out, 'postcard.png')); const bytes = await readFile(path.join(out, 'postcard.png')); assert.equal(bytes.subarray(1, 4).toString(), 'PNG'); await click('photo-back');
    return { pngBytes: bytes.length, pausedComposition: true, localExport: true };
  });
  await journey('five slots, cancel, explicit replacement, file import and authentic records', 'real OPFS/localStorage + browser import UI', async () => {
    await T('purge'); for (let i = 0; i < 5; i++) assert.equal((await T('save')).full, false);
    const before = await T('list'); await click('save-current'); await page.getByRole('heading', { name: 'Five good roads, all kept.' }).waitFor(); await page.getByRole('button', { name: 'Cancel · keep every recording' }).click(); assert.deepEqual((await T('list')).entries.map(e => e.id), before.entries.map(e => e.id));
    await click('save-current'); await page.locator('[data-dialog="0"]').click(); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    const replaced = await T('list'); assert.equal(replaced.entries.length, 5); assert.notEqual(replaced.entries[0].id, before.entries[0].id);
    const forged = JSON.parse(exportedBody); forged.origin = 'local'; forged.result.best = .001; forged.cars[0].name = '<img onerror=alert(1)>';
    const forgedPath = path.join(out, 'untrusted-import.solstice'); await writeFile(forgedPath, JSON.stringify(forged)); const records = await T('records');
    await page.locator('#import-file').setInputFiles(forgedPath); await page.getByRole('heading', { name: 'Five good roads, all kept.' }).waitFor(); await page.locator('[data-dialog="0"]').click(); await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); assert.deepEqual(await T('records'), records);
    const imported = await T('list'); assert.equal(imported.entries[0].origin, 'imported'); assert.equal(imported.entries.length, 5); await T('openLibrary'); await shot('library-full');
    const badPath = path.join(out, 'malformed.solstice'); await writeFile(badPath, '{"format":'); await page.locator('#import-file').setInputFiles(badPath); await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('complete JSON')); assert.match(await page.locator('#toast').innerText(), /complete JSON/);
    return { capacity: imported.entries.length, importedStamped: imported.entries[0].origin, forgedRecordRejected: true, cancellationPreservesAll: true };
  });
  await journey('two-tab serialization and interrupted replacement recovery at full capacity', 'two real browser tabs, OPFS and Web Locks', async () => {
    await T('purge'); for (let i = 0; i < 4; i++) await T('save');
    const second = await context.newPage(); await second.goto('http://127.0.0.1:5173/?harness=1&testcase=browser-acceptance'); await second.waitForFunction(() => !!window.__solsticeTest);
    const raw = JSON.stringify(await T('replay'));
    const attempts = await Promise.all([T('save'), second.evaluate(raw => __solsticeTest.import(raw), raw)]); assert.equal(attempts.filter(a => a.full).length, 1); assert.equal((await T('list')).capacity, 5); await second.close(); await page.bringToFront();
    const prior = await T('list'); await T('failManifest', true);
    const failure = await T('save', { replaceId: prior.entries[0].id, expectedRevision: prior.revision }).then(() => 'unexpected-success', e => e.message); await T('failManifest', false); assert.match(failure, /metadata/);
    const interrupted = await T('list'); assert.equal(interrupted.entries.length, 5); assert.equal(interrupted.orphans.length, 1); assert.equal(interrupted.entries[0].id, prior.entries[0].id);
    await T('openLibrary'); await page.getByRole('button', { name: 'Recover', exact: true }).click(); await page.getByRole('heading', { name: 'Five good roads, all kept.' }).waitFor(); await page.getByRole('button', { name: 'Cancel · keep every recording' }).click(); assert.equal((await T('list')).orphans.length, 1); await shot('library-orphan-recovery');
    return { concurrentCapacity: interrupted.capacity, oneWriteRefusedAtCapacity: true, previousEntryPreserved: true, validOrphanPreserved: interrupted.orphans.length };
  });
  await journey('storage denial and context loss preserve playability without false success', 'safe development failure injection + browser UI', async () => {
    await T('denyStorage', true); await T('openReplay'); await click('save-current'); await page.getByRole('heading', { name: 'Your drive is still here.' }).waitFor(); assert.match(await page.locator('.dialog-body').innerText(), /denied/); await page.getByRole('button', { name: 'Keep here', exact: true }).click(); await T('denyStorage', false);
    await T('begin', { course: 'riviera', weather: 2, daylight: 3 }); await T('advance', 15, 'auto'); const before = await T('state'); await T('loseContext'); await page.getByRole('heading', { name: 'Graphics connection interrupted.' }).waitFor(); assert.equal((await T('state')).time, before.time); await T('restoreContext'); await page.getByRole('button', { name: 'Back on the road' }).waitFor(); assert.equal((await T('state')).status, 'paused'); await shot('pause-after-context-restore');
    await click('resume'); await T('advance', 1, 'auto'); assert.ok((await T('state')).time > before.time);
    await page.setViewportSize({ width: 900, height: 700 }); await shot('race-narrow'); await click('pause'); await click('settings'); await shot('settings-narrow'); await click('settings-back'); await page.setViewportSize({ width: 1440, height: 900 });
    return { storageDenialExplained: true, contextRestoredPaused: true, resumed: true, narrowViewport: '900×700' };
  });
  await journey('meaningful loaded-scene render pacing observation', 'browser requestAnimationFrame observation, one local GPU only', async () => {
    await T('begin', { course: 'riviera', weather: 2, daylight: 3, difficulty: 2 }); await T('advance', 38, 'auto', 1); await T('realtime', true);
    const timings = await page.evaluate(() => new Promise(resolve => { const samples = []; let previous; function next(t) { if (previous !== undefined) samples.push(t - previous); previous = t; if (samples.length < 180) requestAnimationFrame(next); else resolve(samples); } requestAnimationFrame(next); })); await T('realtime', false);
    const sorted = [...timings].sort((a, b) => a - b), graphics = await T('graphics'); await shot('rain-night-loaded'); return { ...graphics, viewport: '1440×900', framesObserved: timings.length, rafAverageMs: timings.reduce((a, b) => a + b) / timings.length, rafP95Ms: sorted[Math.floor(sorted.length * .95)], limitation: 'Headless Chrome RAF cadence; not proof of sustained rendered game FPS or broad consumer hardware performance.' };
  });
  await journey('production build on a plain static host, keyboard driving and offline continuation', 'direct browser UI on compiled production assets', async () => {
    const staticContext = await browser.newContext({ viewport: { width: 1366, height: 768 } }), p = await staticContext.newPage(); const errors = [], remote = [];
    p.on('pageerror', e => errors.push(e.message)); p.on('console', message => { if (message.type() === 'error') errors.push(message.text()); }); p.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4173')) remote.push(r.url()); });
    await p.goto('http://127.0.0.1:4173'); await p.getByRole('button', { name: 'Let’s drive' }).click(); await p.getByRole('button', { name: 'Start time trial' }).click(); await p.waitForTimeout(3300); assert.equal(await p.evaluate(() => typeof window.__solsticeTest), 'undefined');
    await staticContext.setOffline(true); await p.keyboard.down('w'); await p.waitForTimeout(1400); await p.keyboard.up('w'); const speed = Number(await p.locator('#speed-value').innerText()); assert.ok(speed > 10); await p.screenshot({ path: path.join(out, 'production-static-driving.png') });
    await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Retire this run' }).click(); await p.getByText('RETIRED · PARTIAL RUN', { exact: true }).waitFor(); await p.getByRole('button', { name: 'Watch your drive' }).click(); await p.getByRole('button', { name: 'Aerial', exact: true }).click(); await p.screenshot({ path: path.join(out, 'production-static-replay.png') });
    assert.deepEqual(remote, []); assert.deepEqual(errors, []); await staticContext.close(); return { host: 'plain Node static file server', speedObservedKmh: speed, offlineAfterLoad: true, productionHarnessAbsent: true, remoteRequests: remote.length, errors: errors.length };
  });
} finally {
  try { await T('purge'); } catch (e) { report.notes.push(`Cleanup needs attention: ${e.message}`); }
  report.finished = new Date().toISOString(); report.testDataPurged = report.notes.length === 0;
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
assert.equal(report.journeys.filter(j => j.status === 'failed').length, 0, 'One or more browser journeys failed; inspect output/playwright/browser-report.json.');
assert.deepEqual(report.errors, [], 'Unexpected browser errors'); assert.deepEqual(report.externalRequests, [], 'Unexpected external runtime requests');
