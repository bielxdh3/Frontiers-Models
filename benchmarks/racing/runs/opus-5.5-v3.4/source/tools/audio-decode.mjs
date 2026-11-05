// Authoring tool: decode audio files with Chromium's decoder to mono Float32 PCM.
// Usage: node tools/audio-decode.mjs <outDir> <file1.mp3> [file2 ...]   (paths relative to project root)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';

const [, , outDir, ...files] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const port = 8800 + Math.floor(Math.random() * 100);
const server = await startServer(port);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html?decodeOnly`).catch(() => {});
for (const f of files) {
  const res = await page.evaluate(async (url) => {
    const buf = await (await fetch(url)).arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const ab = await ctx.decodeAudioData(buf);
    const n = ab.length, out = new Float32Array(n);
    for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ab.numberOfChannels; }
    // base64
    const bytes = new Uint8Array(out.buffer); let s = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return { sr: ab.sampleRate, n, ch: ab.numberOfChannels, b64: btoa(s) };
  }, '/' + f.replace(/\\/g, '/'));
  const name = path.basename(f).replace(/\.[^.]+$/, '');
  fs.writeFileSync(path.join(outDir, name + '.f32'), Buffer.from(res.b64, 'base64'));
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify({ sr: res.sr, n: res.n, ch: res.ch }));
  console.log(name, res.sr, res.ch, (res.n / res.sr).toFixed(2) + 's');
}
await browser.close(); server.close();
