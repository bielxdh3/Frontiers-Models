// Texture loading: CC0 PBR sets (Poly Haven) packed into texture ARRAYS so that the terrain/road/building shaders
// need only a handful of samplers (integrated GPUs expose just 16 units). Every set = albedo (sRGB) + normal (GL) + ARM (AO/Rough/Metal).
import * as THREE from 'three';

const base = './assets/textures/';

async function bitmap(url, convert = 'none') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('texture ' + url + ' -> ' + r.status);
  return createImageBitmap(await r.blob(), { colorSpaceConversion: convert, premultiplyAlpha: 'none' });
}

function drawTo(bm, size, ctx) {
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bm, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

/**
 * @param {string[]} names texture-set folder names
 * @param {number} size   layer resolution (square)
 * @param {object} opts   {aniso}
 * @returns {Promise<{albedo:DataArrayTexture, normal:DataArrayTexture, arm:DataArrayTexture, names:string[]}>}
 */
export async function loadTextureArray(names, size, { aniso = 8, onTick = () => {} } = {}) {
  const n = names.length;
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const D = new Uint8Array(size * size * 4 * n), N = new Uint8Array(size * size * 4 * n), A = new Uint8Array(size * size * 4 * n);
  const layer = size * size * 4;
  await Promise.all(names.map(async (name, i) => {
    const [d, nn, a] = await Promise.all([bitmap(`${base}${name}/diff.jpg`), bitmap(`${base}${name}/nor.jpg`).catch(() => bitmap(`${base}${name}/nor.png`)), bitmap(`${base}${name}/arm.jpg`).catch(() => bitmap(`${base}${name}/rough.jpg`))]);
    // drawing on a shared canvas must be sequential within this tick; each draw+read is synchronous
    D.set(drawTo(d, size, ctx), i * layer); N.set(drawTo(nn, size, ctx), i * layer); A.set(drawTo(a, size, ctx), i * layer);
    d.close(); nn.close(); a.close(); onTick(name);
  }));
  const mk = (data, srgb) => {
    const t = new THREE.DataArrayTexture(data, size, size, n);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = aniso; t.needsUpdate = true;
    t.userData = { size, layers: n, names };
    return t;
  };
  return { albedo: mk(D, true), normal: mk(N, false), arm: mk(A, false), names, size };
}

/** one ordinary 2D PBR set (used where a real material.map / normalMap must exist, e.g. the scene audit) */
export async function loadTexture2D(name, kind, { aniso = 8, size = 0 } = {}) {
  const ext = kind === 'normal' ? ['nor.jpg', 'nor.png'] : kind === 'arm' ? ['arm.jpg', 'rough.jpg'] : ['diff.jpg'];
  let bm = null;
  for (const e of ext) { try { bm = await bitmap(`${base}${name}/${e}`); break; } catch { /* next */ } }
  if (!bm) throw new Error('texture ' + name + ' ' + kind);
  const t = new THREE.Texture(bm);
  t.colorSpace = kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  t.userData = { src: name, kind };
  return t;
}
