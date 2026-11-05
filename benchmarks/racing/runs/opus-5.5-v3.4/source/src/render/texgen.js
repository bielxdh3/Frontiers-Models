// Procedurally generated textures (own work): car details, curbs, decals.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { loadedTextures } from './textures.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/** >= 1024 px per side canvas whose 2D context draws in the logical (w, h) space */
function canvasHi(w, h) { const W = Math.max(1024, w), H = Math.max(1024, h); const c = canvas(W, H); c.getContext('2d').setTransform(W / w, 0, 0, H / h, 0, 0); return c; }
function tex(c, srgb, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.userData.src = 'generated';
  loadedTextures.add(t);
  return t;
}
/** height (Float32Array w*h, 0..1) -> normal map canvas */
export function heightToNormal(hgt, w, h, strength = 2, wrap = true) {
  const c = canvas(w, h); const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h);
  const H = (x, y) => { if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); } return hgt[y * w + x]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255; img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255; img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function flakeNormal() {
  const w = 1024, r = mulberry32(11); const hgt = new Float32Array(w * w);
  for (let i = 0; i < hgt.length; i++) hgt[i] = r();
  // blur slightly so flakes are ~2px
  const b = new Float32Array(hgt.length);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) s += hgt[((y + k + w) % w) * w + ((x + j + w) % w)]; b[y * w + x] = s / 9; }
  return tex(heightToNormal(b, w, w, 1.2), false);
}

export function noiseAlbedo() {
  const w = 1024, r = mulberry32(31); const c = canvas(w, w); const ctx = c.getContext('2d'); const img = ctx.createImageData(w, w);
  for (let i = 0; i < w * w; i++) { const v = 190 + r() * 50; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return tex(c, true);
}

export function plasticNormal() {
  const w = 1024, r = mulberry32(23); const hgt = new Float32Array(w * w);
  for (let i = 0; i < hgt.length; i++) hgt[i] = r() * 0.6;
  return tex(heightToNormal(hgt, w, w, 0.8), false);
}

/** tire tread: u = around, v = across the profile (lathe) */
export function treadTextures() {
  const w = 1024, h = 1024;
  const hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = y / h; // across profile (0 inner bead .. 1 outer bead)
    let ht = 0.6;
    const treadZone = v > 0.3 && v < 0.7;
    if (treadZone) {
      const across = (v - 0.3) / 0.4;
      // 4 circumferential grooves
      for (const g of [0.18, 0.4, 0.62, 0.84]) if (Math.abs(across - g) < 0.022) ht = 0.15;
      // lateral sipes on shoulders
      const phase = (x / w) * 64 + across * 2.2;
      if ((across < 0.16 || across > 0.88) && Math.abs((phase % 1) - 0.5) < 0.09) ht = 0.25;
      if (across > 0.4 && across < 0.62 && Math.abs(((x / w) * 96 + across * 4) % 1 - 0.5) < 0.04) ht = 0.35;
    } else {
      // sidewall: subtle ribs and raised lettering band
      const sw = v < 0.3 ? v / 0.3 : (1 - v) / 0.3;
      ht = 0.5 + 0.04 * Math.sin(sw * 40);
      if (sw > 0.45 && sw < 0.62 && ((x / w) * 24) % 1 < 0.55) ht += 0.08 * Math.sin(((x / w) * 24 % 1) * 40);
    }
    hgt[y * w + x] = ht;
  }
  const nrm = tex(heightToNormal(hgt, w, h, 3.0), false);
  const c = canvas(w, h); const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const g = 20 + hgt[i] * 18; img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g + 1; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, true), normalMap: nrm };
}

export function honeycomb() {
  const w = 1024; const hgt = new Float32Array(w * w);
  const s = 36;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const q = (x / s) * 1.1547, r2 = y / s - x / (2 * s) * 1.1547 * 0.5;
    const qi = Math.round(q), ri = Math.round(r2);
    const dq = Math.abs(q - qi), dr = Math.abs(r2 - ri);
    const d = Math.max(dq, dr, Math.abs(dq + dr - 0.0));
    hgt[y * w + x] = d < 0.42 ? 0.0 : 1.0;
  }
  const nrm = tex(heightToNormal(hgt, w, w, 1.5), false);
  const c = canvas(w, w); const ctx = c.getContext('2d'); const img = ctx.createImageData(w, w);
  for (let i = 0; i < w * w; i++) { const g = hgt[i] > 0.5 ? 34 : 6; img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, true), normalMap: nrm };
}

export function lightTexture(kind) {
  const w = 512, h = 256; const c = canvasHi(w, h); const ctx = c.getContext('2d');
  if (kind === 'head') {
    // dark housing with chrome reflector bowls, a long LED projector and a DRL blade
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a3d44'); g.addColorStop(0.5, '#15171b'); g.addColorStop(1, '#25282e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      const cx = w * (0.34 + i * 0.3), cy = h * 0.56, rx = w * 0.13, ry = h * 0.3;
      const rg = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.2, 2, cx, cy, rx);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.18, '#eef3ff'); rg.addColorStop(0.32, '#9aa4b4'); rg.addColorStop(0.7, '#4a505a'); rg.addColorStop(1, '#1b1d22');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.moveTo(w * 0.05, h * 0.2); ctx.lineTo(w * 0.95, h * 0.12); ctx.lineTo(w * 0.95, h * 0.2); ctx.lineTo(w * 0.05, h * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, h * 0.86, w, h * 0.06);
  } else {
    ctx.fillStyle = '#2a0204'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 48; i++) { const x = (i + 0.5) * (w / 48); const rg = ctx.createRadialGradient(x, h / 2, 1, x, h / 2, w / 60); rg.addColorStop(0, '#ff5a4a'); rg.addColorStop(0.5, '#d01010'); rg.addColorStop(1, '#3a0306'); ctx.fillStyle = rg; ctx.fillRect(x - w / 96, 0, w / 48, h); }
    ctx.fillStyle = 'rgba(255,120,100,0.35)'; ctx.fillRect(0, h * 0.42, w, h * 0.16);
  }
  return tex(c, true);
}

export function discTexture() {
  const w = 1024; const hgt = new Float32Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dx = x / w - 0.5, dy = y / w - 0.5; const r = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    let ht = 0.6 + 0.04 * Math.sin(r * 300);
    // curved slots
    const sl = ((a / (Math.PI * 2)) * 12 + r * 1.5) % 1;
    if (r > 0.6 && r < 0.92 && Math.abs(sl - 0.5) < 0.03) ht = 0.2;
    // drilled holes
    for (let k = 0; k < 24; k++) { const aa = (k / 24) * Math.PI * 2, rr = 0.66 + (k % 2) * 0.16; const hx = Math.cos(aa) * rr / 2, hy = Math.sin(aa) * rr / 2; if (Math.hypot(dx - hx, dy - hy) < 0.012) ht = 0.0; }
    if (r < 0.55) ht = 0.8;
    hgt[y * w + x] = ht;
  }
  const nrm = tex(heightToNormal(hgt, w, w, 2), false, false);
  const c = canvas(w, w); const ctx = c.getContext('2d'); const img = ctx.createImageData(w, w);
  for (let i = 0; i < w * w; i++) { const g = 70 + hgt[i] * 80; img.data[i * 4] = g; img.data[i * 4 + 1] = g * 0.98; img.data[i * 4 + 2] = g * 0.95; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, true, false), normalMap: nrm };
}

export function contactShadowTexture() {
  const w = 128, h = 256; const c = canvas(w, h); const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x / (w - 1)) * 2 - 1, v = (y / (h - 1)) * 2 - 1;
    const d = Math.pow(Math.pow(Math.abs(u), 2.6) + Math.pow(Math.abs(v), 2.6), 1 / 2.6);
    const a = Math.max(0, 1 - d); const aa = Math.pow(a, 1.6);
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = aa * 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true, false);
}

/** livery decals: side panel (number roundel, stripe, fictional sponsors) */
export function liveryTexture(liv, carName) {
  const w = 1024, h = 512; const c = canvasHi(w, h); const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const acc = '#' + liv.accent.toString(16).padStart(6, '0');
  // side stripe (lower body)
  ctx.fillStyle = acc; ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.moveTo(0, h * 0.78); ctx.lineTo(w, h * 0.68); ctx.lineTo(w, h * 0.74); ctx.lineTo(0, h * 0.86); ctx.closePath(); ctx.fill();
  // number roundel on doors
  const cx = w * 0.5, cy = h * 0.42, r = h * 0.2;
  ctx.globalAlpha = 1; ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 10; ctx.strokeStyle = acc; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.font = `bold ${Math.round(r * 1.25)}px Arial, Helvetica, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(liv.number), cx, cy + r * 0.06);
  // fictional sponsor marks
  ctx.font = `bold ${Math.round(h * 0.06)}px Arial, Helvetica, sans-serif`; ctx.fillStyle = acc;
  ctx.fillText('COSTA DOURADA', w * 0.22, h * 0.6);
  ctx.font = `italic bold ${Math.round(h * 0.055)}px Georgia, serif`; ctx.fillStyle = '#f4f1ea';
  ctx.fillText(carName.toUpperCase(), w * 0.8, h * 0.58);
  return tex(c, true, false);
}

/** hood/roof stripe (top projection) */
export function stripeTexture(liv) {
  const w = 256, h = 512; const c = canvasHi(w, h); const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const acc = '#' + liv.accent.toString(16).padStart(6, '0');
  ctx.fillStyle = acc; ctx.fillRect(w * 0.36, 0, w * 0.1, h); ctx.fillRect(w * 0.54, 0, w * 0.1, h);
  return tex(c, true, false);
}

/** zebra curb: red/white blocks with wear */
export function curbTextures() {
  const w = 1024, h = 1024; const r = mulberry32(5);
  const c = canvas(w, h); const ctx = c.getContext('2d');
  const blocks = 4;
  for (let i = 0; i < blocks; i++) { ctx.fillStyle = i % 2 ? '#e9e4da' : '#b8231c'; ctx.fillRect((i * w) / blocks, 0, w / blocks, h); }
  // wear, rubber marks, dirt
  const img = ctx.getImageData(0, 0, w, h);
  const hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const n = r();
    const dirt = 0.82 + 0.18 * n;
    const rub = Math.exp(-(((y / h) - 0.35) ** 2) / 0.02) * 0.25 * (0.5 + 0.5 * Math.sin(x * 0.02 + (y * 256 / h) * 0.01));
    for (let k = 0; k < 3; k++) img.data[i + k] = img.data[i + k] * dirt * (1 - rub);
    // ridged profile across (v): low inner edge, raised outer
    const v = y / h;
    hgt[y * w + x] = (v < 0.12 ? v / 0.12 : 1) * 0.6 + n * 0.08 + (((x % (w / blocks)) < 3) ? -0.3 : 0);
  }
  ctx.putImageData(img, 0, 0);
  const nrm = heightToNormal(hgt, w, h, 1.5);
  const orm = canvas(w, h); const oc = orm.getContext('2d'); const oi = oc.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { oi.data[i * 4] = 255; oi.data[i * 4 + 1] = 150 + 60 * hgt[i]; oi.data[i * 4 + 2] = 0; oi.data[i * 4 + 3] = 255; }
  oc.putImageData(oi, 0, 0);
  return { map: tex(c, true), normalMap: tex(nrm, false), orm: tex(orm, false) };
}
