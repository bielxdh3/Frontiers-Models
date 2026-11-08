// Diagnostic: which browser/GPU does Playwright get here?
import { chromium } from 'playwright';

const variants = [
  { name: 'chrome-channel', opts: { channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'] } },
  { name: 'bundled-chromium-newheadless', opts: { channel: 'chromium', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] } },
  { name: 'bundled-headless-shell', opts: { headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--use-gl=angle'] } },
];

for (const v of variants) {
  try {
    const t0 = Date.now();
    const browser = await chromium.launch(v.opts);
    const page = await browser.newPage();
    await page.setContent('<canvas id=c></canvas>');
    const info = await page.evaluate(() => {
      const gl = document.getElementById('c').getContext('webgl2', { antialias: true });
      if (!gl) return { error: 'no webgl2' };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '',
        maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxSamples: gl.getParameter(gl.MAX_SAMPLES),
        floatRT: !!gl.getExtension('EXT_color_buffer_float'),
        ua: navigator.userAgent,
      };
    });
    console.log(v.name, JSON.stringify(info), (Date.now() - t0) + 'ms');
    await browser.close();
  } catch (e) {
    console.log(v.name, 'FAILED:', String(e.message).split('\n')[0]);
  }
}
