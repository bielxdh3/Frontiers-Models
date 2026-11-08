// Image sanity metrics (spec 13.1 test 7). Used by the verifier and as a CLI: node tools/imgstats.mjs a.png b.png
//   mean/std luminance (0..1, sRGB-encoded Rec.709 luma), largest single-colour share (5 bits/channel bins),
//   plus thirds (top/middle/bottom mean luminance). Sky share comes from the game (depth mask) when available.
import fs from 'node:fs';
import { chromium } from 'playwright';

export const METRICS_FN = async (b64) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const bm = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
  const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bm, 0, 0);
  const d = g.getImageData(0, 0, bm.width, bm.height).data;
  const n = bm.width * bm.height;
  let s = 0, s2 = 0; const bins = new Map(); const third = [0, 0, 0], thirdN = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    const y = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
    s += y; s2 += y * y;
    const key = ((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3);
    bins.set(key, (bins.get(key) || 0) + 1);
    const t = Math.min(2, Math.floor((i / bm.width) / (bm.height / 3))); third[t] += y; thirdN[t]++;
  }
  const mean = s / n, std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  let maxBin = 0; for (const v of bins.values()) if (v > maxBin) maxBin = v;
  return { w: bm.width, h: bm.height, mean: +mean.toFixed(4), std: +std.toFixed(4), maxColorShare: +(maxBin / n).toFixed(4), thirds: third.map((v, i) => +(v / thirdN[i]).toFixed(3)) };
};

export async function computeMetrics(page, buf) {
  return page.evaluate(METRICS_FN, buf.toString('base64'));
}

if (process.argv[1] && process.argv[1].endsWith('imgstats.mjs')) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  for (const f of process.argv.slice(2)) console.log(f, JSON.stringify(await computeMetrics(page, fs.readFileSync(f))));
  await browser.close();
}
