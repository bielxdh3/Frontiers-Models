// Sky + lighting from a CC0 sunset HDRI (Poly Haven "wasteland_clouds_puresky", 4k).
//  - visible background: the original HDRI
//  - image-based light: a 1024x512 copy with the sun disc clamped (the sun is a real directional light, so it is not counted twice)
//    and the (never visible) lower hemisphere replaced by a warm, dark ground colour => weak ambient, strong shadows.
//  - the directional sun is placed from the brightest pixels of the HDRI and rotated to point down the Z1 straight.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { DataUtils } from 'three';

const fromHalf = DataUtils.fromHalfFloat;

export async function loadEnvironment(renderer, scene, opts = {}) {
  const url = opts.url || './assets/hdri/wasteland_clouds_puresky_4k.hdr';
  const loader = new HDRLoader();
  loader.setDataType(THREE.HalfFloatType);
  const tex = await loader.loadAsync(url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const W = tex.image.width, H = tex.image.height, src = tex.image.data;
  // keep the visible sun disc bounded (HDR values of thousands would make the bloom swallow the frame)
  const toHalf = DataUtils.toHalfFloat, SKY_CLAMP = opts.skyClamp ?? 24;
  for (let k = 0; k < src.length; k += 4) {
    if ((src[k] & 0x7c00) >= 0x5400 || (src[k + 1] & 0x7c00) >= 0x5400 || (src[k + 2] & 0x7c00) >= 0x5400) {
      let r = fromHalf(src[k]), g = fromHalf(src[k + 1]), b = fromHalf(src[k + 2]);
      const m = Math.max(r, g, b);
      if (m > SKY_CLAMP) { const f = SKY_CLAMP / m; src[k] = toHalf(r * f); src[k + 1] = toHalf(g * f); src[k + 2] = toHalf(b * f); }
    }
  }

  // ---- downsampled float copy (stride sampling with a 2x2 average)
  const w2 = 2048, h2 = 1024, sx = W / w2, sy = H / h2;
  const small = new Float32Array(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = Math.min(W - 1, Math.floor(x * sx + dx * (sx / 2))), py = Math.min(H - 1, Math.floor(y * sy + dy * (sy / 2)));
        const k = (py * W + px) * 4;
        r += fromHalf(src[k]); g += fromHalf(src[k + 1]); b += fromHalf(src[k + 2]);
      }
      const o = (y * w2 + x) * 4;
      small[o] = r * 0.25; small[o + 1] = g * 0.25; small[o + 2] = b * 0.25; small[o + 3] = 1;
    }
  }
  // ---- find the sun: weighted centroid of the brightest pixels (row 0 = top of the sky)
  let maxL = 0;
  for (let i = 0; i < w2 * h2; i++) { const l = 0.2126 * small[i * 4] + 0.7152 * small[i * 4 + 1] + 0.0722 * small[i * 4 + 2]; if (l > maxL) maxL = l; }
  let sxw = 0, syw = 0, sw = 0, cr = 0, cg = 0, cb = 0;
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    const o = (y * w2 + x) * 4, l = 0.2126 * small[o] + 0.7152 * small[o + 1] + 0.0722 * small[o + 2];
    if (l > maxL * 0.5) { const wgt = l; sxw += x * wgt; syw += y * wgt; sw += wgt; cr += small[o]; cg += small[o + 1]; cb += small[o + 2]; }
  }
  const su = (sxw / sw + 0.5) / w2, sv = 1 - (syw / sw + 0.5) / h2;       // texture coords (v up)
  const phi = (su - 0.5) * Math.PI * 2, theta = (sv - 0.5) * Math.PI;
  const sunLocal = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
  const sunColor = new THREE.Color(cr, cg, cb); const lum = sunColor.r * 0.2126 + sunColor.g * 0.7152 + sunColor.b * 0.0722; sunColor.multiplyScalar(1 / lum);
  // ---- debug: mean luminance per elevation band, near the sun azimuth and opposite
  const bands = [[0, 5], [5, 15], [15, 30], [30, 60], [60, 90]].map(([a, b]) => ({ a, b, near: [0, 0], far: [0, 0] }));
  for (let y = 0; y < h2; y++) {
    const v = 1 - (y + 0.5) / h2, el = (v - 0.5) * 180;
    if (el < 0) continue;
    const bd = bands.find(q => el >= q.a && el < q.b); if (!bd) continue;
    for (let x = 0; x < w2; x += 4) {
      const o = (y * w2 + x) * 4, l = 0.2126 * small[o] + 0.7152 * small[o + 1] + 0.0722 * small[o + 2];
      let dphi = Math.abs(((x + 0.5) / w2 - su)); dphi = Math.min(dphi, 1 - dphi) * 360;
      const tgt = dphi < 40 ? bd.near : dphi > 120 ? bd.far : null; if (tgt) { tgt[0] += Math.min(l, 50); tgt[1]++; }
    }
  }
  const dbg = bands.map(b => `${b.a}-${b.b}deg near=${(b.near[0] / Math.max(1, b.near[1])).toFixed(2)} far=${(b.far[0] / Math.max(1, b.far[1])).toFixed(2)}`).join(' | ');
  // ---- clamp the sun disc + replace the lower hemisphere in the IBL copy
  const CLAMP = opts.clamp ?? 6.0;
  for (let y = 0; y < h2; y++) {
    const v = 1 - (y + 0.5) / h2, el = (v - 0.5) * Math.PI;          // elevation of this row
    for (let x = 0; x < w2; x++) {
      const o = (y * w2 + x) * 4;
      let r = small[o], g = small[o + 1], b = small[o + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l > CLAMP) { const k = CLAMP / l; r *= k; g *= k; b *= k; }
      if (el < 0.02) {
        const t = Math.min(1, (0.02 - el) / 0.25);                   // 0 at the horizon -> 1 below
        const gl = 0.075 * (1 - 0.55 * t);                           // dark warm ground
        const gr = gl * 1.18, gg = gl * 0.96, gb = gl * 0.72;
        r = r * (1 - t) + gr * t; g = g * (1 - t) + gg * t; b = b * (1 - t) + gb * t;
      }
      small[o] = r; small[o + 1] = g; small[o + 2] = b;
    }
  }
  const iblTex = new THREE.DataTexture(small, w2, h2, THREE.RGBAFormat, THREE.FloatType);
  iblTex.mapping = THREE.EquirectangularReflectionMapping; iblTex.colorSpace = THREE.LinearSRGBColorSpace;
  iblTex.magFilter = THREE.LinearFilter; iblTex.minFilter = THREE.LinearFilter; iblTex.flipY = true; iblTex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromEquirectangular(iblTex);
  pmrem.dispose(); iblTex.dispose();

  // ---- rotate the whole sky so the sun sits ahead of the Z1 straight (heading west, sea on the left)
  const desired = opts.sunAzimuth ?? Math.atan2(0.30, -0.95);          // world azimuth (atan2(z, x)) of the sun
  const phiSun = Math.atan2(sunLocal.z, sunLocal.x);
  const rotY = desired - phiSun;                                       // rotate content by this angle about +Y (sampling uses the inverse)
  scene.background = tex;
  scene.backgroundRotation.set(0, -rotY, 0);
  scene.backgroundIntensity = opts.bgIntensity ?? 0.17;
  scene.environment = rt.texture;
  scene.environmentRotation.set(0, -rotY, 0);
  scene.environmentIntensity = opts.envIntensity ?? 0.55;
  // horizon haze colour per world azimuth (average of the HDRI between 1.5 and 5 degrees of elevation)
  const haze = new Float32Array(256 * 3);
  const yA = Math.max(0, Math.floor((0.5 - 5 / 180) * h2)), yB = Math.min(h2 - 1, Math.floor((0.5 - 1.5 / 180) * h2));
  for (let k = 0; k < 256; k++) {
    const phiW = ((k + 0.5) / 256) * Math.PI * 2 - Math.PI, phiTex = phiW - rotY;
    let u = phiTex / (Math.PI * 2) + 0.5; u -= Math.floor(u);
    const xc = Math.floor(u * w2); let r = 0, g = 0, b = 0, n = 0;
    for (let dx = -10; dx <= 10; dx++) for (let y = yA; y <= yB; y++) {
      const o = (y * w2 + (((xc + dx) % w2) + w2) % w2) * 4; r += small[o]; g += small[o + 1]; b += small[o + 2]; n++;
    }
    haze[k * 3] = r / n; haze[k * 3 + 1] = g / n; haze[k * 3 + 2] = b / n;
  }
  const sunDir = new THREE.Vector3(Math.cos(theta) * Math.cos(desired), Math.sin(theta), Math.cos(theta) * Math.sin(desired)).normalize();
  return { sunDir, sunColor, sunElevation: theta, rotY, bgTexture: tex, envTarget: rt, maxL, debug: dbg, haze, bgIntensity: scene.backgroundIntensity };
}
