// Screenshot capture for S1..S12: real race, High (S10: Low), 1920x1080, HUD on (except S2/S11/S12), FPS in the file name.
import fs from 'node:fs';
import path from 'node:path';
import { IMAGE_METRICS_JS, sleep, mkdir } from './lib.mjs';

/** make sure a live race is running (autopilot on) so every shot has AIs on the road */
export async function ensureRace(s, { laps = 3 } = {}) {
  await s.ev((laps) => {
    const R = __RACING__;
    if (!R.race || R.state !== 'racing') { R.startRace({ car: 'gt', laps, diff: 'normal' }); R.skipToRace(); }
    R.autopilot(true); R.freeze(false); R.clearCamera();
    if (!R._fog0) R._fog0 = R.scene.fog; R.scene.fog = R._fog0; R.S.camera.up.set(0, 1, 0);
  }, laps);
}

export async function captureShot(s, shot, outDir) {
  mkdir(outDir);
  if (shot.grid) {
    await s.ev(() => { const R = __RACING__; R.startRace({ car: 'gt', laps: 3, diff: 'normal' }); R.game.gridDur = 999; R.freeze(false); R.advance(1.2); R.cam.setMode('grid'); });
  } else await ensureRace(s);
  await s.ev(`(${shot.setup.toString()})(window.__RACING__)`);
  await s.ev((o) => { const R = __RACING__; R.hud(o.hud); R.freeze(!!o.freeze); }, { hud: shot.hud, freeze: shot.freeze });
  await sleep(1700);
  const info = await s.ev(() => { const R = __RACING__; return { fps: +R.fps.toFixed(0), cam: R.camInfo(), sky: +R.skyFraction().toFixed(4), render: R.renderInfo(), sceneInfo: R.sceneInfo || null, shore: R.shore || null }; });
  const tmp = path.join(outDir, `${shot.file}.png`);
  await s.page.screenshot({ path: tmp });
  const named = path.join(outDir, `${shot.file}-fps${info.fps}.png`);
  fs.copyFileSync(tmp, named);
  let metrics = null;
  if (shot.metrics !== undefined) metrics = await s.ev(IMAGE_METRICS_JS, fs.readFileSync(tmp).toString('base64'));
  // restore
  await s.ev(() => { const R = __RACING__; R.freeze(false); R.clearCamera(); R.hud(true); if (R._fog0) R.scene.fog = R._fog0; R.S.camera.up.set(0, 1, 0); R.sceneInfo = null; });
  return { id: shot.id, file: `${shot.file}.png`, fileWithFps: path.basename(named), fps: info.fps, skyPct: +(info.sky * 100).toFixed(1), metrics, camera: info.cam, render: info.render, sceneInfo: info.sceneInfo, shore: info.shore, title: shot.title, refs: shot.refs, quality: shot.quality };
}
