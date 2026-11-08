// Shared helpers for the verifier: browser launch (Chrome -> Edge -> bundled Chromium), page factory with console capture, small utilities.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const mkdir = (p) => fs.mkdirSync(p, { recursive: true });
export const write = (p, data) => { mkdir(path.dirname(p)); fs.writeFileSync(p, data); };

export async function launchBrowser({ headless = true, uncapped = false } = {}) {
  const args = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'];
  if (process.platform === 'win32') args.push('--use-angle=d3d11');
  if (uncapped) args.push('--disable-frame-rate-limit', '--disable-gpu-vsync');       // performance runs: measure the real frame cost, not the display cadence
  const attempts = [{ channel: 'chrome' }, { channel: 'msedge' }, {}];
  let last = null;
  for (let round = 0; round < 2; round++) {
    for (const a of attempts) {
      try { const browser = await chromium.launch({ headless, args, ...a }); return { browser, how: a.channel || 'playwright-chromium' }; } catch (e) { last = e; }
    }
    if (round === 0) { try { console.log('[verify] no system browser found; installing Playwright Chromium...'); execSync('npx playwright install chromium', { stdio: 'inherit' }); } catch (e) { last = e; } }
  }
  throw last;
}

export class Session {
  constructor(browser, { w = 1920, h = 1080, port, q = 'high', name = 'session', query = '' }) {
    this.browser = browser; this.w = w; this.h = h; this.port = port; this.q = q; this.name = name; this.query = query;
    this.logs = []; this.errors = [];
  }
  async open() {
    this.ctx = await this.browser.newContext({ viewport: { width: this.w, height: this.h }, deviceScaleFactor: 1 });
    this.page = await this.ctx.newPage();
    this.page.on('console', (m) => {
      const t = m.type(), text = m.text();
      this.logs.push(`[${t}] ${text.slice(0, 500)}`);
      if (t === 'error') this.errors.push(text.slice(0, 500));
    });
    this.page.on('pageerror', (e) => { const t = String(e.stack || e).slice(0, 800); this.logs.push('[pageerror] ' + t); this.errors.push(t); });
    this.page.on('requestfailed', (r) => { this.logs.push(`[requestfailed] ${r.url()} ${r.failure() && r.failure().errorText}`); this.errors.push('requestfailed ' + r.url()); });
    const t0 = Date.now();
    await this.page.goto(`http://127.0.0.1:${this.port}/index.html?q=${this.q}${this.query}`);
    await this.page.waitForFunction(() => window.__RACING__ && (window.__RACING__.ready || window.__RACING__.errors.length), null, { timeout: 240000 });
    this.loadMs = Date.now() - t0;
    const e = await this.page.evaluate(() => window.__RACING__.errors);
    if (e.length) throw new Error('game failed to start: ' + e.join(' | '));
    return this;
  }
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  async close() { try { await this.ctx.close(); } catch {} }
  logText() { return this.logs.join('\n'); }
}

export async function hardware(session) {
  const web = await session.ev(() => {
    const gl = document.createElement('canvas').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', gpuVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown', ua: navigator.userAgent, cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory || null, dpr: window.devicePixelRatio, screen: [innerWidth, innerHeight] };
  });
  const cpus = os.cpus();
  return { ...web, cpu: cpus[0] ? cpus[0].model.trim() : 'unknown', cpuThreads: cpus.length, ramGB: +(os.totalmem() / 2 ** 30).toFixed(1), os: `${os.type()} ${os.release()} ${os.arch()}`, node: process.version };
}

/** image statistics computed in the page from a PNG (base64): luminance mean/std (sRGB, Rec.709), share of the most frequent colour (5 bits/channel) */
export const IMAGE_METRICS_JS = async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, bins = new Map(); let s = 0, s2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, y = 0.2126 * r + 0.7152 * gg + 0.0722 * b; s += y; s2 += y * y;
    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3); bins.set(k, (bins.get(k) || 0) + 1);
  }
  let max = 0; for (const v of bins.values()) if (v > max) max = v;
  const mean = s / n, std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  return { width: c.width, height: c.height, lumMean: +mean.toFixed(4), lumStd: +std.toFixed(4), maxColourShare: +(max / n).toFixed(4) };
};

/** side-by-side comparison (mine | reference), both drawn at the same size */
export const COMPARE_JS = async ({ mine, ref, w, h, labelA, labelB }) => {
  const load = async (b64, mime) => { const i = new Image(); i.src = `data:${mime};base64,${b64}`; await i.decode(); return i; };
  const a = await load(mine, 'image/png'), b = await load(ref, 'image/jpeg');
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h; const g = c.getContext('2d');
  g.drawImage(a, 0, 0, w, h); g.drawImage(b, w, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 360, 40); g.fillRect(w, 0, 420, 40); g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.fillText(labelA, 12, 28); g.fillText(labelB, w + 12, 28);
  g.fillStyle = '#fff'; g.fillRect(w - 1, 0, 2, h);
  return c.toDataURL('image/png').split(',')[1];
};

export const resizeJs = async ({ b64, w, h, mime = 'image/png' }) => {
  const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(i, 0, 0, w, h);
  return c.toDataURL(mime, 0.9).split(',')[1];
};
