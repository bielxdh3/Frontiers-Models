// Environment lighting from a CC0 sunset HDRI (Poly Haven "Kloppenheim 06 (Pure Sky)").
// - finds the sun in the HDRI and rotates the map so the sun sits at the azimuth
//   requested by track.json (the directional sun uses exactly that direction)
// - removes the sun peak from the map (direct sun comes only from the shadowed light)
// - replaces the mirrored lower hemisphere with a warm ground so reflections read correctly
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export async function loadEnvironment(renderer, url, sunAzimuthDeg, onProgress) {
  const loader = new HDRLoader();
  loader.setDataType(THREE.FloatType);
  const tex = await loader.loadAsync(url, onProgress);
  const { width: W, height: H, data } = tex.image;
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  // locate sun (brightest blurred spot)
  let best = 0, bx = 0, by = 0;
  for (let y = 2; y < H / 2; y += 1) for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4; const l = lum(i); if (l > best) { best = l; bx = x; by = y; }
  }
  const sunEl = (0.5 - (by + 0.5) / H) * Math.PI; // row 0 = zenith
  const sunU = (bx + 0.5) / W;
  // three's equirect lookup: u = atan(dir.z, dir.x) / 2pi + 0.5
  const az = (sunAzimuthDeg * Math.PI) / 180;
  const wantDir = new THREE.Vector3(Math.sin(az) * Math.cos(sunEl), Math.sin(sunEl), -Math.cos(az) * Math.cos(sunEl)).normalize();
  const wantU = Math.atan2(wantDir.z, wantDir.x) / (2 * Math.PI) + 0.5;
  const shift = Math.round(((wantU - sunU + 1) % 1) * W);
  // sun colour from the HDRI around the sun (slightly below the clipped core)
  const sunCol = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -10; dx <= 10; dx++) {
    const x = (bx + dx + W) % W, y = Math.min(H - 1, Math.max(0, by + dy)); const i = (y * W + x) * 4;
    sunCol.r += data[i]; sunCol.g += data[i + 1]; sunCol.b += data[i + 2]; n++;
  }
  sunCol.multiplyScalar(1 / n);
  const out = new Float32Array(W * H * 4);
  const groundCol = [0.30, 0.25, 0.20];
  for (let y = 0; y < H; y++) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const sx = (x - shift + W) % W;
      const si = (y * W + sx) * 4, di = (y * W + x) * 4;
      let r = data[si], g = data[si + 1], b = data[si + 2];
      // de-sun: compress peaks so env lighting does not duplicate the direct light
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const cap = 5.0;
      if (l > cap) { const k = (cap + Math.log(1 + (l - cap)) * 0.5) / l; r *= k; g *= k; b *= k; }
      // lower hemisphere -> warm ground (keeps a little horizon glow)
      const elDeg = (el * 180) / Math.PI;
      if (elDeg < -1.5) {
        const t = Math.min(1, (-1.5 - elDeg) / 10);
        const tt = t * t * (3 - 2 * t);
        r = r * (1 - tt) + groundCol[0] * tt; g = g * (1 - tt) + groundCol[1] * tt; b = b * (1 - tt) + groundCol[2] * tt;
      }
      out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 1;
    }
  }
  const env = new THREE.DataTexture(out, W, H, THREE.RGBAFormat, THREE.FloatType);
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.LinearSRGBColorSpace;
  env.flipY = tex.flipY;
  env.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromEquirectangular(env);
  pmrem.dispose(); tex.dispose();
  // horizon / zenith reference colours (for the procedural sky / fog)
  const sample = (u, elDeg) => { const x = Math.floor(((u % 1) + 1) % 1 * W), y = Math.max(0, Math.min(H - 1, Math.floor((0.5 - elDeg / 180) * H))); const i = (y * W + x) * 4; return new THREE.Color(out[i], out[i + 1], out[i + 2]); };
  const u0 = wantU;
  const colors = {
    horizonSun: sample(u0, 2), horizonSide: sample(u0 + 0.25, 3), horizonAnti: sample(u0 + 0.5, 3),
    zenith: sample(u0, 88), midSun: sample(u0, 15), midAnti: sample(u0 + 0.5, 20),
  };
  return { envMap: rt.texture, equirect: env, sunDir: wantDir, sunEl, sunColor: sunCol, colors, hdriSunU: sunU, shiftPx: shift };
}
