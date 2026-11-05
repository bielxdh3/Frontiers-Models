// Dev helper: render an SVG file to PNG with Playwright (inlines the SVG markup).
// Usage: node tools/svg2png.mjs <input.svg> <output.png>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , inp, out] = process.argv;
const svg = fs.readFileSync(inp, 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
