import * as THREE from 'three';
import { CelestialBodyData, PresentationMode, QualityPreset } from '../types/solarSystem';

/**
 * Deterministic seeded PRNG (Mulberry32)
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simple 3D value noise for seamless spherical procedural textures (no UV seam at longitude 0/360)
 */
function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let n = ix * 15731 + iy * 789221 + iz * 1376312589 + seed * 374761393;
  n = (n << 13) ^ n;
  return 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function noise3D(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const fz = smoothstep(z - iz);

  const n000 = hash3(ix, iy, iz, seed);
  const n100 = hash3(ix + 1, iy, iz, seed);
  const n010 = hash3(ix, iy + 1, iz, seed);
  const n110 = hash3(ix + 1, iy + 1, iz, seed);
  const n001 = hash3(ix, iy, iz + 1, seed);
  const n101 = hash3(ix + 1, iy, iz + 1, seed);
  const n011 = hash3(ix, iy + 1, iz + 1, seed);
  const n111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const nx00 = lerp(n000, n100, fx);
  const nx10 = lerp(n010, n110, fx);
  const nx01 = lerp(n001, n101, fx);
  const nx11 = lerp(n011, n111, fx);

  const nxy0 = lerp(nx00, nx10, fy);
  const nxy1 = lerp(nx01, nx11, fy);

  return lerp(nxy0, nxy1, fz) * 0.5 + 0.5;
}

export function fbm3D(
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves = 4
): number {
  let value = 0;
  let amplitude = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(x * freq, y * freq, z * freq, seed + i * 97);
    norm += amplitude;
    amplitude *= 0.5;
    freq *= 2.05;
  }
  return value / norm;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export interface GeneratedBodyTextures {
  colorMap: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
  cloudsMap?: THREE.CanvasTexture;
  nightLightsMap?: THREE.CanvasTexture;
}

const textureCache = new Map<string, GeneratedBodyTextures>();

export function getOrCreateBodyTextures(
  body: CelestialBodyData,
  quality: QualityPreset,
  presentation: PresentationMode,
  venusRadarMode = false
): GeneratedBodyTextures {
  const effectiveType =
    body.id === 'venus' && venusRadarMode ? 'venus_radar' : body.visual.proceduralType;
  const cacheKey = `${body.id}_${effectiveType}_${quality}_${presentation}`;
  const existing = textureCache.get(cacheKey);
  if (existing) return existing;

  const width = quality === 'low' ? 256 : quality === 'high' ? 512 : 384;
  const height = width / 2;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpData = bumpCtx.createImageData(width, height);

  let cloudsMap: THREE.CanvasTexture | undefined;
  let nightLightsMap: THREE.CanvasTexture | undefined;

  let cloudsData: ImageData | undefined;
  let cloudsCanvas: HTMLCanvasElement | undefined;
  let cloudsCtx: CanvasRenderingContext2D | undefined;

  let nightData: ImageData | undefined;
  let nightCanvas: HTMLCanvasElement | undefined;
  let nightCtx: CanvasRenderingContext2D | undefined;

  if (body.id === 'earth') {
    cloudsCanvas = document.createElement('canvas');
    cloudsCanvas.width = width;
    cloudsCanvas.height = height;
    cloudsCtx = cloudsCanvas.getContext('2d')!;
    cloudsData = cloudsCtx.createImageData(width, height);

    nightCanvas = document.createElement('canvas');
    nightCanvas.width = width;
    nightCanvas.height = height;
    nightCtx = nightCanvas.getContext('2d')!;
    nightData = nightCtx.createImageData(width, height);
  }

  const c1 = hexToRgb(body.visual.primaryColor);
  const c2 = hexToRgb(body.visual.secondaryColor);
  const c3 = hexToRgb(body.visual.accentColor);
  const seed = body.visual.seed;
  const contrastBoost = presentation === 'enhanced' ? 1.22 : 1.0;

  // Pre-generate deterministic craters for cratered bodies
  const rng = createSeededRandom(seed);
  const craters: Array<{ x: number; y: number; z: number; r: number; depth: number }> = [];
  if (
    effectiveType === 'rocky_cratered' ||
    effectiveType === 'mars_rusty' ||
    effectiveType === 'irregular_asteroid' ||
    effectiveType === 'icy_moon'
  ) {
    const count = effectiveType === 'rocky_cratered' ? 55 : 28;
    for (let i = 0; i < count; i++) {
      const u = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      craters.push({
        x: s * Math.cos(theta),
        y: u,
        z: s * Math.sin(theta),
        r: 0.06 + rng() * 0.24,
        depth: 0.35 + rng() * 0.65,
      });
    }
  }

  for (let py = 0; py < height; py++) {
    const v = py / (height - 1);
    const lat = (0.5 - v) * Math.PI; // +PI/2 at north pole, -PI/2 at south pole
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let px = 0; px < width; px++) {
      const u = px / width;
      const lon = (u - 0.5) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      const idx = (py * width + px) * 4;
      let r = c1[0];
      let g = c1[1];
      let b = c1[2];
      let bump = 128;

      if (effectiveType === 'star') {
        const gran1 = fbm3D(nx * 6, ny * 6, nz * 6, seed, 4);
        const gran2 = noise3D(nx * 18, ny * 18, nz * 18, seed + 11);
        const sunspot = noise3D(nx * 3.2, ny * 3.2, nz * 3.2, seed + 55);
        const spotFactor = sunspot < 0.22 && Math.abs(ny) < 0.45 ? 0.55 : 1.0;
        const t = Math.min(1, Math.max(0, gran1 * 0.7 + gran2 * 0.3)) * spotFactor;
        r = lerp(c2[0], c3[0], t);
        g = lerp(c2[1], c1[1], t);
        b = lerp(30, c3[2] * 0.7, t * t);
      } else if (effectiveType === 'earth_living') {
        // Structured continents + oceans + ice caps
        const contBase = fbm3D(nx * 2.1 + 0.4, ny * 2.1, nz * 2.1 - 0.2, seed, 5);
        // Sculpt recognizable major continental basins
        const americas =
          Math.exp(-Math.pow((lon + 1.35) * 1.4, 2) - Math.pow((lat - 0.1) * 1.1, 2)) * 0.26;
        const eurasiaAfrica =
          Math.exp(-Math.pow((lon - 0.65) * 0.9, 2) - Math.pow((lat - 0.25) * 1.1, 2)) * 0.3;
        const australia =
          Math.exp(-Math.pow((lon - 2.2) * 2.2, 2) - Math.pow((lat + 0.45) * 2.4, 2)) * 0.25;
        const elevation = contBase * 0.78 + americas + eurasiaAfrica + australia;
        const isLand = elevation > 0.52;
        const polarIce = Math.abs(ny) + (contBase - 0.5) * 0.14 > 0.84;

        if (polarIce) {
          r = 238;
          g = 245;
          b = 252;
          bump = 165;
        } else if (isLand) {
          const moisture = fbm3D(nx * 4.5, ny * 4.5, nz * 4.5, seed + 301, 3);
          const desertBelt = Math.exp(-Math.pow((Math.abs(lat) - 0.42) * 4.2, 2)) * (1 - moisture);
          const mountain = Math.max(0, (elevation - 0.64) * 3.2);
          r = lerp(46, 188, desertBelt) + mountain * 45;
          g = lerp(118, 156, desertBelt) + mountain * 35;
          b = lerp(48, 96, desertBelt) + mountain * 30;
          bump = Math.min(255, 145 + Math.floor((elevation - 0.52) * 260));

          // Night lights on populated coastal / temperate land
          if (nightData && Math.abs(lat) < 1.05) {
            const cityNoise = noise3D(nx * 24, ny * 24, nz * 24, seed + 888);
            const coastalBoost = elevation < 0.61 ? 0.12 : 0;
            const lit = cityNoise + coastalBoost > 0.74 ? Math.min(255, (cityNoise - 0.68) * 900) : 0;
            nightData.data[idx] = lit;
            nightData.data[idx + 1] = lit * 0.78;
            nightData.data[idx + 2] = lit * 0.35;
            nightData.data[idx + 3] = 255;
          }
        } else {
          // Ocean depth variation
          const shelf = Math.max(0, (elevation - 0.38) / 0.14);
          r = lerp(12, 36, shelf);
          g = lerp(42, 108, shelf);
          b = lerp(98, 178, shelf);
          bump = 115;
          if (nightData) {
            nightData.data[idx] = 0;
            nightData.data[idx + 1] = 0;
            nightData.data[idx + 2] = 0;
            nightData.data[idx + 3] = 255;
          }
        }

        if (cloudsData) {
          const cNoise = fbm3D(nx * 3.8 + 1.2, ny * 5.2, nz * 3.8, seed + 555, 4);
          const alpha = cNoise > 0.51 ? Math.min(235, Math.floor((cNoise - 0.51) * 520)) : 0;
          cloudsData.data[idx] = 250;
          cloudsData.data[idx + 1] = 252;
          cloudsData.data[idx + 2] = 255;
          cloudsData.data[idx + 3] = alpha;
        }
      } else if (effectiveType === 'venus_clouds') {
        const swirl = fbm3D(nx * 2.5, ny * 5.5, nz * 2.5, seed, 4);
        const chevron = Math.sin(lat * 5 + Math.cos(lon + swirl * 2) * 1.4) * 0.5 + 0.5;
        const t = (swirl * 0.65 + chevron * 0.35) * contrastBoost;
        r = lerp(c2[0], c3[0], Math.min(1, t));
        g = lerp(c2[1], c3[1], Math.min(1, t));
        b = lerp(c2[2], c3[2], Math.min(1, t));
        bump = 128 + Math.floor((t - 0.5) * 30);
      } else if (effectiveType === 'venus_radar') {
        // Magellan-style radar altimetry representation
        const topo = fbm3D(nx * 3.2, ny * 3.2, nz * 3.2, seed + 77, 5);
        r = lerp(85, 255, topo);
        g = lerp(35, 175, topo * topo);
        b = lerp(12, 65, topo * 0.6);
        bump = Math.floor(topo * 255);
      } else if (effectiveType === 'mars_rusty') {
        const terrain = fbm3D(nx * 3.0, ny * 3.0, nz * 3.0, seed, 5);
        const darkBasalt = fbm3D(nx * 1.8 + 0.7, ny * 2.2, nz * 1.8, seed + 42, 3);
        const polarCap = Math.abs(ny) + (terrain - 0.5) * 0.1 > 0.88;
        if (polarCap) {
          r = 242;
          g = 235;
          b = 228;
          bump = 180;
        } else {
          const t = terrain * (darkBasalt < 0.43 ? 0.58 : 1.05);
          r = lerp(c2[0], c1[0] * 1.15, Math.min(1, t));
          g = lerp(c2[1], c1[1] * 1.12, Math.min(1, t));
          b = lerp(c2[2], c1[2] * 1.08, Math.min(1, t));
          bump = Math.floor(80 + terrain * 150);
        }
      } else if (effectiveType === 'gas_jupiter') {
        const turb = fbm3D(nx * 4.5, ny * 12.0, nz * 4.5, seed, 4);
        const bands = Math.sin(lat * 18 + (turb - 0.5) * 2.4) * 0.5 + 0.5;
        // Great Red Spot at ~22 deg south
        const grsDist = Math.hypot((lon - 0.4) * 1.5, (lat + 0.38) * 2.8);
        const inGrs = grsDist < 0.32;
        if (inGrs) {
          const vortex = Math.cos((grsDist / 0.32) * Math.PI * 0.5);
          r = lerp(c1[0], c3[0], vortex * 0.88);
          g = lerp(c1[1], c3[1], vortex * 0.88);
          b = lerp(c1[2], c3[2], vortex * 0.88);
        } else {
          const t = Math.min(1, Math.max(0, (bands * 0.72 + turb * 0.28) * contrastBoost));
          r = lerp(c2[0], c1[0], t);
          g = lerp(c2[1], c1[1], t);
          b = lerp(c2[2], c1[2], t);
        }
      } else if (effectiveType === 'gas_saturn') {
        const turb = fbm3D(nx * 3.0, ny * 10.0, nz * 3.0, seed, 3);
        const bands = Math.sin(lat * 14 + (turb - 0.5) * 0.9) * 0.5 + 0.5;
        const t = bands * 0.65 + turb * 0.35;
        r = lerp(c2[0], c3[0], t);
        g = lerp(c2[1], c3[1], t);
        b = lerp(c2[2], c3[2], t);
      } else if (effectiveType === 'ice_uranus' || effectiveType === 'ice_neptune') {
        const turb = fbm3D(nx * 3.2, ny * 8.0, nz * 3.2, seed, 3);
        const bandStrength = presentation === 'enhanced' ? 0.32 : 0.12;
        const bands = Math.sin(lat * 10 + turb * 1.2) * bandStrength + 0.5;
        r = lerp(c2[0], c3[0], bands);
        g = lerp(c2[1], c3[1], bands);
        b = lerp(c2[2], c3[2], bands);
      } else if (effectiveType === 'volcanic_io') {
        const sulfur = fbm3D(nx * 4.2, ny * 4.2, nz * 4.2, seed, 4);
        const patera = noise3D(nx * 9.5, ny * 9.5, nz * 9.5, seed + 19);
        if (patera < 0.2) {
          r = 65;
          g = 32;
          b = 20;
        } else {
          r = lerp(c2[0], c3[0], sulfur);
          g = lerp(c2[1], c1[1], sulfur);
          b = lerp(c2[2], c1[2] * 0.8, sulfur * sulfur);
        }
      } else if (effectiveType === 'dwarf_pluto') {
        const base = fbm3D(nx * 3.2, ny * 3.2, nz * 3.2, seed, 4);
        // Sputnik Planitia bright heart near equator
        const heartDist = Math.hypot((lon - 0.2) * 1.6, (lat - 0.08) * 1.8);
        if (heartDist < 0.42) {
          r = c3[0];
          g = c3[1];
          b = c3[2];
        } else {
          const eqDark = Math.abs(lat) < 0.35 && base < 0.48;
          r = eqDark ? c2[0] : lerp(c2[0], c1[0], base);
          g = eqDark ? c2[1] : lerp(c2[1], c1[1], base);
          b = eqDark ? c2[2] : lerp(c2[2], c1[2], base);
        }
      } else {
        // Rocky cratered, icy moon, Titan, asteroid, comet
        const base = fbm3D(nx * 3.5, ny * 3.5, nz * 3.5, seed, 4);
        let craterMod = 0;
        for (let c = 0; c < craters.length; c++) {
          const cr = craters[c];
          const dx = nx - cr.x;
          const dy = ny - cr.y;
          const dz = nz - cr.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < cr.r) {
            const normD = d / cr.r;
            if (normD > 0.78) {
              // Raised bright crater rim
              craterMod += (1 - (normD - 0.78) / 0.22) * 0.24 * cr.depth;
            } else {
              // Depressed crater bowl
              craterMod -= (1 - normD / 0.78) * 0.28 * cr.depth;
            }
          }
        }
        // Lunar maria on near side for the Moon
        let mariaDarken = 0;
        if (body.id === 'moon' && nx > 0.1) {
          const mariaNoise = fbm3D(nx * 2.2, ny * 2.2, nz * 2.2, seed + 99, 3);
          if (mariaNoise < 0.47) {
            mariaDarken = (0.47 - mariaNoise) * 1.2;
          }
        }
        const t = Math.max(0, Math.min(1, base + craterMod - mariaDarken));
        r = lerp(c2[0], c3[0], t);
        g = lerp(c2[1], c3[1], t);
        b = lerp(c2[2], c3[2], t);
        bump = Math.max(0, Math.min(255, Math.floor(128 + craterMod * 190 + (base - 0.5) * 70)));
      }

      imgData.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      imgData.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      imgData.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      imgData.data[idx + 3] = 255;

      bumpData.data[idx] = bump;
      bumpData.data[idx + 1] = bump;
      bumpData.data[idx + 2] = bump;
      bumpData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.needsUpdate = true;

  if (cloudsCanvas && cloudsCtx && cloudsData) {
    cloudsCtx.putImageData(cloudsData, 0, 0);
    cloudsMap = new THREE.CanvasTexture(cloudsCanvas);
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
    cloudsMap.wrapS = THREE.RepeatWrapping;
    cloudsMap.wrapT = THREE.ClampToEdgeWrapping;
    cloudsMap.needsUpdate = true;
  }

  if (nightCanvas && nightCtx && nightData) {
    nightCtx.putImageData(nightData, 0, 0);
    nightLightsMap = new THREE.CanvasTexture(nightCanvas);
    nightLightsMap.colorSpace = THREE.SRGBColorSpace;
    nightLightsMap.wrapS = THREE.RepeatWrapping;
    nightLightsMap.wrapT = THREE.ClampToEdgeWrapping;
    nightLightsMap.needsUpdate = true;
  }

  const generated: GeneratedBodyTextures = {
    colorMap,
    bumpMap,
    cloudsMap,
    nightLightsMap,
  };
  textureCache.set(cacheKey, generated);
  return generated;
}

/**
 * Generate a 1D radial ring texture (mapped along UV.x from innerRadius to outerRadius)
 * with genuine radial bands, transparency variation, and gaps like the Cassini Division.
 */
const ringTextureCache = new Map<string, THREE.CanvasTexture>();

export function getOrCreateRingTexture(
  body: CelestialBodyData,
  presentation: PresentationMode
): THREE.CanvasTexture | null {
  if (!body.rings) return null;
  const key = `${body.id}_ring_${presentation}`;
  const existing = ringTextureCache.get(key);
  if (existing) return existing;

  const width = 512;
  const height = 32;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);

  const bands = body.rings.bands;
  const minRatio = Math.min(...bands.map((b) => b.innerRadiusRatio));
  const maxRatio = Math.max(...bands.map((b) => b.outerRadiusRatio));
  const span = Math.max(0.01, maxRatio - minRatio);

  for (let x = 0; x < width; x++) {
    const u = x / (width - 1);
    const rRatio = minRatio + u * span;

    let r = 210;
    let g = 195;
    let b = 170;
    let alpha = 0;

    for (const band of bands) {
      if (rRatio >= band.innerRadiusRatio && rRatio <= band.outerRadiusRatio) {
        const rgb = hexToRgb(band.colorHex);
        const fineRipple = 0.85 + 0.15 * Math.sin(u * 140) * Math.cos(u * 53);
        r = rgb[0] * fineRipple;
        g = rgb[1] * fineRipple;
        b = rgb[2] * fineRipple;
        const boost =
          presentation === 'enhanced' && body.rings.isFaintEnhancedInNatural ? 2.4 : 1.0;
        alpha = Math.min(0.95, band.opacity * boost * fineRipple);
        // Encke gap inside Saturn's A ring
        if (body.id === 'saturn' && rRatio > 2.19 && rRatio < 2.21) {
          alpha *= 0.18;
        }
        break;
      }
    }

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      imgData.data[idx] = Math.round(r);
      imgData.data[idx + 1] = Math.round(g);
      imgData.data[idx + 2] = Math.round(b);
      imgData.data[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  ringTextureCache.set(key, tex);
  return tex;
}

/**
 * Create a soft radial glow texture for the solar corona and comet coma.
 */
let glowTextureCache: THREE.CanvasTexture | null = null;
export function getOrCreateRadialGlowTexture(): THREE.CanvasTexture {
  if (glowTextureCache) return glowTextureCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
  grad.addColorStop(0.25, 'rgba(255, 175, 70, 0.45)');
  grad.addColorStop(0.6, 'rgba(255, 110, 25, 0.12)');
  grad.addColorStop(1, 'rgba(255, 80, 10, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  glowTextureCache = new THREE.CanvasTexture(canvas);
  glowTextureCache.colorSpace = THREE.SRGBColorSpace;
  return glowTextureCache;
}
