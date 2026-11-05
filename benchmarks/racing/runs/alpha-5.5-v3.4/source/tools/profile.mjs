// Dev helper: measure FPS while toggling subsystems (one page load).
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const query = process.argv[2] || 'dev=1&cars=6&auto=1';
const port = 8300 + Math.floor(Math.random() * 400);
const server = await startServer(port);
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?${query}`);
await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const measure = async (label, setup, undo) => {
  await page.evaluate(setup);
  await page.waitForTimeout(1200);
  const fps = await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); let n = 0; const f = () => { n++; if (performance.now() - t0 < 3500) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  const info = await page.evaluate(() => __game.lastInfo);
  console.log(label.padEnd(28), 'fps', fps.toFixed(1), JSON.stringify(info));
  if (undo) await page.evaluate(undo);
};
const pre = process.argv[3] || '';
if (pre) { await page.evaluate(pre); await page.waitForTimeout(2500); }
await page.evaluate(() => { __game.sim.timeScale = 0; });
await measure('baseline', '1');
await measure('no terrain shadow cast', "__game.terrainMesh.chunks.forEach(c=>c.mesh.castShadow=false)", "__game.terrainMesh.chunks.forEach(c=>c.mesh.castShadow=true)");
await measure('no shadows at all', '__game.renderer.shadowMap.enabled=false', '__game.renderer.shadowMap.enabled=true');
await measure('no sea', '__game.sea.visible=false', '__game.sea.visible=true');
await measure('no terrain', "__game.terrainMesh.group.visible=false", "__game.terrainMesh.group.visible=true");
await measure('no instances', "__game.scatterR.field.group.visible=false", "__game.scatterR.field.group.visible=true");
await measure('no cars', "__game.carViews.forEach(v=>v.root.visible=false)", "__game.carViews.forEach(v=>v.root.visible=true)");
await measure('no motion blur/mask', "__game.R.post.opts.motionBlur=false", "__game.R.post.opts.motionBlur=true");
await measure('no bloom', "__game.R.post.opts.bloom=false", "__game.R.post.opts.bloom=true");
await measure('baseline again', '1');
await browser.close(); server.close();
