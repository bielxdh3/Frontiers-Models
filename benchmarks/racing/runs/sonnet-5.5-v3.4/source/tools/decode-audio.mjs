// Dev-time helper: decode any browser-decodable audio file (ogg/mp3/wav) to a 16-bit PCM WAV using
// a headless browser's decodeAudioData (no ffmpeg on this machine).
//   node tools/decode-audio.mjs <in> <out.wav> [sampleRate=44100]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [inp, out, srArg] = process.argv.slice(2);
const sr = +(srArg || 44100);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setContent('<html></html>');
const b64 = fs.readFileSync(inp).toString('base64');
const res = await page.evaluate(async ({ b64, sr }) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ctx = new OfflineAudioContext(1, 1, sr);
  const buf = await ctx.decodeAudioData(bin.buffer);
  const chans = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const f = buf.getChannelData(c);
    const i16 = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)));
    chans.push(i16);
  }
  const n = chans[0].length, nc = chans.length;
  const inter = new Int16Array(n * nc);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) inter[i * nc + c] = chans[c][i];
  const u8 = new Uint8Array(inter.buffer);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { nc, n, sr: buf.sampleRate, data: btoa(s) };
}, { b64, sr });
await browser.close();

const pcm = Buffer.from(res.data, 'base64');
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(res.nc, 22); hdr.writeUInt32LE(res.sr, 24);
hdr.writeUInt32LE(res.sr * res.nc * 2, 28); hdr.writeUInt16LE(res.nc * 2, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([hdr, pcm]));
console.log('decoded', path.basename(inp), '->', path.basename(out), `${res.nc}ch ${res.sr}Hz ${(res.n / res.sr).toFixed(2)}s`);
