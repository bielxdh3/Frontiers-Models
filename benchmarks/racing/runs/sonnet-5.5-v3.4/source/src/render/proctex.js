// Small procedural textures (all >= 1024 px): brushed galvanised metal, cloth, generic normal grain, start banner, foliage atlases.
import * as THREE from 'three';

function canvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); }
function mkTex(c, srgb, { repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true; return t;
}
let seedState = 1;
function rnd() { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; }
const cache = {};

/** tileable height noise -> normal map canvas */
export function normalFromNoise(size, octaves, strength, seed) {
  seedState = seed >>> 0;
  const c = canvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), h = new Float32Array(size * size);
  for (let o = 0; o < octaves; o++) {
    const cells = 8 << o, grid = new Float32Array((cells + 1) * (cells + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let i = 0; i <= cells; i++) { grid[i * (cells + 1) + cells] = grid[i * (cells + 1)]; grid[cells * (cells + 1) + i] = grid[i]; }
    const amp = Math.pow(0.55, o);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = grid[iy * (cells + 1) + ix], b = grid[iy * (cells + 1) + ix + 1], c2 = grid[(iy + 1) * (cells + 1) + ix], d = grid[(iy + 1) * (cells + 1) + ix + 1];
      h[y * size + x] += amp * (a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty);
    }
  }
  const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xm = h[y * size + (x + size - 1) % size], xp = h[y * size + (x + 1) % size], ym = h[((y + size - 1) % size) * size + x], yp = h[((y + 1) % size) * size + x];
    let nx = (xm - xp) * strength, ny = (ym - yp) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * size + x) * 4; d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function getProc() {
  if (cache.ready) return cache;
  cache.grainN = mkTex(normalFromNoise(1024, 4, 4.0, 77), false);
  cache.clothN = mkTex((() => {
    const c = canvas(1024, 1024), g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1024; i += 4) { g.fillStyle = (i / 4) % 2 ? 'rgb(120,128,250)' : 'rgb(136,128,250)'; g.fillRect(i, 0, 2, 1024); g.fillStyle = (i / 4) % 2 ? 'rgb(128,120,250)' : 'rgb(128,136,250)'; g.fillRect(0, i, 1024, 2); }
    return c;
  })(), false);
  cache.metalA = mkTex((() => {
    const c = canvas(1024, 1024), g = c.getContext('2d'); seedState = 91;
    g.fillStyle = 'rgb(176,180,184)'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 2400; i++) { const y = rnd() * 1024, l = 60 + rnd() * 500, x = rnd() * 1024, v = 150 + rnd() * 70; g.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.05 + rnd() * 0.12})`; g.fillRect(x, y, l, 1 + rnd() * 2); }
    for (let i = 0; i < 60; i++) { const x = rnd() * 1024, y = rnd() * 1024, r = 8 + rnd() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(90,70,50,0.18)'); gr.addColorStop(1, 'rgba(90,70,50,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    return c;
  })(), true);
  cache.clothA = mkTex((() => {
    const c = canvas(1024, 1024), g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1024; i += 4) { g.fillStyle = `rgba(0,0,0,${0.03 + ((i / 4) % 2) * 0.03})`; g.fillRect(i, 0, 2, 1024); g.fillRect(0, i, 1024, 2); }
    return c;
  })(), true);
  cache.ready = true;
  return cache;
}

/** start/finish banner (2048x1024): LARGADA / CHEGADA with chequered borders */
export function bannerTexture() {
  const c = canvas(2048, 1024), g = c.getContext('2d');
  g.fillStyle = '#14181f'; g.fillRect(0, 0, 2048, 1024);
  const grad = g.createLinearGradient(0, 0, 0, 1024); grad.addColorStop(0, '#1d2733'); grad.addColorStop(1, '#0d1118'); g.fillStyle = grad; g.fillRect(0, 0, 2048, 1024);
  const sq = 64;
  for (let x = 0; x < 2048; x += sq) for (let r = 0; r < 2; r++) { g.fillStyle = ((x / sq + r) % 2) ? '#f2f2f2' : '#0a0a0a'; g.fillRect(x, r * sq, sq, sq); g.fillStyle = ((x / sq + r) % 2) ? '#0a0a0a' : '#f2f2f2'; g.fillRect(x, 1024 - (r + 1) * sq, sq, sq); }
  g.fillStyle = '#ffb347'; g.font = 'bold 300px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LARGADA', 1024, 330); g.fillStyle = '#f2f2f2'; g.font = 'bold 240px "Arial Black", Impact, sans-serif'; g.fillText('CHEGADA', 1024, 700);
  g.fillStyle = '#ff6a3d'; g.fillRect(180, 470, 1688, 14);
  return mkTex(c, true, { repeat: false });
}
