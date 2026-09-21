import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseGrid(seed, size = 96) {
  const rand = mulberry32(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i += 1) g[i] = rand();
  return (u, v) => {
    const x = ((u % 1) + 1) % 1;
    const y = ((v % 1) + 1) % 1;
    const fx = x * size;
    const fy = y * size;
    const x0 = Math.floor(fx) % size;
    const y0 = Math.floor(fy) % size;
    const x1 = (x0 + 1) % size;
    const y1 = (y0 + 1) % size;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const a = g[y0 * size + x0];
    const b = g[y0 * size + x1];
    const c = g[y1 * size + x0];
    const d = g[y1 * size + x1];
    const ab = a + (b - a) * tx;
    const cd = c + (d - c) * tx;
    return ab + (cd - ab) * ty;
  };
}

function fbm(noise, u, v) {
  return noise(u, v) * 0.55 + noise(u * 2, v * 2) * 0.3 + noise(u * 4, v * 4) * 0.15;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  return { c, g, w, h };
}

function tex(c, color = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function fill(g, w, h, fn) {
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    const v = y / h;
    for (let x = 0; x < w; x += 1) {
      const u = x / w;
      const [r, gc, b, a] = fn(u, v, x, y);
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = gc;
      d[i + 2] = b;
      d[i + 3] = a ?? 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function latBand(v, period, shift = 0) {
  return Math.sin((v * period + shift) * Math.PI * 2);
}

export function makeTextures() {
  const out = {};
  const n1 = noiseGrid(11);
  const n2 = noiseGrid(29);
  const n3 = noiseGrid(47);
  const n4 = noiseGrid(71);

  {
    const { c, g, w, h } = canvas(512, 256);
    fill(g, w, h, (u, v) => {
      const gran = fbm(n1, u * 3, v * 2);
      const cell = n1(u * 18, v * 10);
      const r = 210 + gran * 40 + cell * 18;
      const gc = 120 + gran * 30 + cell * 10;
      const b = 40 + gran * 16;
      return [r, gc, b, 255];
    });
    out.sun = tex(c);
  }

  {
    const { c, g, w, h } = canvas(384, 192);
    fill(g, w, h, (u, v) => {
      let shade = 118 + fbm(n2, u * 4, v * 3) * 40;
      const craters = n2(u * 22, v * 12);
      if (craters > 0.72) shade -= 28;
      if (craters > 0.8) shade += 22;
      const basin = n3(u * 3, v * 2);
      if (basin > 0.62) shade -= 16;
      return [shade * 0.86, shade * 0.8, shade * 0.74, 255];
    });
    out.mercury = tex(c);
  }

  {
    const { c, g, w, h } = canvas(384, 192);
    fill(g, w, h, (u, v) => {
      const bands = latBand(v, 3.5, u * 0.2) * 12;
      const swirl = fbm(n3, u * 2 + v, v * 3) * 28;
      return [214 + bands + swirl, 188 + swirl * 0.4, 140, 255];
    });
    out.venus = tex(c);
    const radar = canvas(384, 192);
    fill(radar.g, radar.w, radar.h, (u, v) => {
      const hgt = fbm(n4, u * 5, v * 4);
      const shade = 90 + hgt * 80;
      return [shade * 0.7, shade * 0.45, shade * 0.32, 255];
    });
    out.venusRadar = tex(radar.c);
  }

  {
    const { c, g, w, h } = canvas(768, 384);
    g.fillStyle = '#1d4e86';
    g.fillRect(0, 0, w, h);
    const land = [
      [[-168, 66], [-140, 70], [-100, 73], [-85, 68], [-70, 60], [-64, 46], [-70, 42], [-74, 36], [-80, 25], [-90, 29], [-97, 26], [-110, 24], [-115, 32], [-125, 40], [-124, 49], [-130, 55], [-152, 60], [-166, 66]],
      [[-80, 12], [-77, 8], [-75, 6], [-77, -2], [-80, -6], [-78, -12], [-72, -16], [-70, -18], [-68, -22], [-70, -36], [-72, -52], [-68, -55], [-65, -50], [-62, -40], [-58, -28], [-48, -5], [-50, 2], [-60, 8], [-70, 12], [-77, 8]],
      [[-10, 36], [-8, 32], [-5, 36], [10, 32], [11, 37], [-5, 44], [-9, 42]],
      [[-6, 35], [-9, 32], [-17, 21], [-16, 12], [-8, 4], [8, 4], [10, 2], [15, -5], [12, -12], [14, -22], [20, -34], [19, -35], [28, -33], [32, -28], [35, -20], [40, -15], [42, -12], [51, 12], [43, 12], [39, 22], [33, 32], [25, 32], [10, 31], [3, 36]],
      [[28, 41], [36, 36], [44, 40], [52, 47], [60, 55], [80, 60], [100, 70], [140, 70], [170, 66], [180, 65], [190, 66], [160, 60], [142, 48], [128, 35], [122, 30], [110, 18], [100, 16], [90, 22], [80, 16], [72, 20], [60, 25], [48, 28], [40, 36]],
      [[100, 8], [105, 2], [108, -2], [114, -3], [128, 2], [140, -4], [150, -8], [146, -18], [140, -20], [130, -12], [114, -22], [114, -34], [124, -34], [146, -38], [150, -35], [146, -20], [138, -12], [120, 0]],
      [[-45, 72], [-40, 76], [-30, 80], [-20, 74], [-40, 68], [-50, 66], [-55, 70]],
      [[-62, -64], [-60, -78], [0, -78], [40, -72], [80, -68], [140, -70], [180, -72], [-180, -74], [-90, -70]],
    ];
    const project = (lon, lat) => [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
    g.fillStyle = '#6d8b45';
    for (const poly of land) {
      g.beginPath();
      poly.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.closePath();
      g.fill();
    }
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y += 1) {
      const v = y / h;
      const lat = 90 - v * 180;
      for (let x = 0; x < w; x += 1) {
        const u = x / w;
        const i = (y * w + x) * 4;
        const landish = d[i + 1] > d[i] && d[i + 1] > 90;
        const n = fbm(n2, u * 6, v * 4);
        if (Math.abs(lat) > 72) {
          d[i] = 230; d[i + 1] = 236; d[i + 2] = 242;
        } else if (landish) {
          d[i] = Math.min(255, d[i] + n * 30);
          d[i + 1] = Math.min(255, d[i + 1] + n * 20);
          d[i + 2] = Math.min(255, d[i + 2] + n * 10);
        } else {
          d[i] = 22 + n * 10;
          d[i + 1] = 70 + n * 24;
          d[i + 2] = 130 + n * 20;
        }
      }
    }
    g.putImageData(img, 0, 0);
    out.earth = tex(c);

    const night = canvas(768, 384);
    night.g.fillStyle = '#000';
    night.g.fillRect(0, 0, w, h);
    night.g.fillStyle = '#6d8b45';
    for (const poly of land) {
      night.g.beginPath();
      poly.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        if (i === 0) night.g.moveTo(x, y);
        else night.g.lineTo(x, y);
      });
      night.g.closePath();
      night.g.fill();
    }
    const ni = night.g.getImageData(0, 0, w, h);
    const nd = ni.data;
    const rand = mulberry32(99);
    for (let i = 0; i < nd.length; i += 4) {
      const onLand = nd[i + 1] > 80;
      nd[i] = 0; nd[i + 1] = 0; nd[i + 2] = 0; nd[i + 3] = 255;
      if (onLand && rand() > 0.992) {
        nd[i] = 255; nd[i + 1] = 220; nd[i + 2] = 140;
      }
    }
    night.g.putImageData(ni, 0, 0);
    out.earthNight = tex(night.c);

    const clouds = canvas(512, 256);
    fill(clouds.g, clouds.w, clouds.h, (u, v) => {
      const cl = fbm(n3, u * 3, v * 2);
      const a = cl > 0.58 ? (cl - 0.58) * 500 : 0;
      return [255, 255, 255, Math.min(160, a)];
    });
    out.clouds = tex(clouds.c);
  }

  {
    const { c, g, w, h } = canvas(512, 256);
    fill(g, w, h, (u, v) => {
      let shade = 168 + fbm(n4, u * 8, v * 5) * 36;
      const mare = n3(u * 2.2, v * 1.4);
      const inMare = (u > 0.35 && u < 0.72 && v > 0.28 && v < 0.62 && mare > 0.42)
        || (u > 0.15 && u < 0.4 && v > 0.35 && v < 0.7 && n2(u, v) > 0.55);
      if (inMare) shade -= 48;
      if (n4(u * 20, v * 12) > 0.78) shade += 20;
      return [shade, shade * 0.98, shade * 0.94, 255];
    });
    out.moon = tex(c);
  }

  {
    const { c, g, w, h } = canvas(384, 192);
    fill(g, w, h, (u, v) => {
      const lat = Math.abs(v - 0.5);
      let r = 176, gc = 96, b = 62;
      const n = fbm(n2, u * 4, v * 3);
      r += n * 30; gc += n * 16;
      if (lat > 0.42) { r = 220; gc = 220; b = 220; }
      if (u > 0.55 && u < 0.7 && v > 0.42 && v < 0.58) { r = 110; gc = 70; b = 52; }
      return [r, gc, b, 255];
    });
    out.mars = tex(c);
  }

  {
    const { c, g, w, h } = canvas(512, 256);
    fill(g, w, h, (u, v) => {
      const band = latBand(v, 9, 0.1);
      const turb = fbm(n1, u * 6, v * 8) * 18;
      const stripe = band > 0 ? 1 : 0;
      let r = stripe ? 214 : 176;
      let gc = stripe ? 176 : 140;
      let b = stripe ? 130 : 102;
      r += turb; gc += turb * 0.7;
      const dx = (u - 0.62) * 2.2;
      const dy = (v - 0.62) * 5;
      if (dx * dx + dy * dy < 0.08) { r = 186; gc = 92; b = 64; }
      return [r, gc, b, 255];
    });
    out.jupiter = tex(c);
  }

  {
    const { c, g, w, h } = canvas(512, 256);
    fill(g, w, h, (u, v) => {
      const band = latBand(v, 7) * 10;
      const n = fbm(n3, u * 3, v * 4) * 12;
      return [214 + band + n, 196 + n, 150, 255];
    });
    out.saturn = tex(c);
  }

  {
    const { c, g, w, h } = canvas(256, 128);
    fill(g, w, h, (u, v) => {
      const band = latBand(v, 4) * 6;
      return [150 + band, 214, 216, 255];
    });
    out.uranus = tex(c);
  }

  {
    const { c, g, w, h } = canvas(256, 128);
    fill(g, w, h, (u, v) => {
      const n = fbm(n4, u * 3, v * 3) * 16;
      const band = latBand(v, 5) * 8;
      let r = 40 + n, gc = 90 + band, b = 190;
      const dx = (u - 0.3);
      const dy = (v - 0.45) * 2;
      if (dx * dx + dy * dy < 0.02) { r = 30; gc = 60; b = 120; }
      return [r, gc, b, 255];
    });
    out.neptune = tex(c);
  }

  const simple = (key, seed, painter) => {
    const { c, g, w, h } = canvas(256, 128);
    const noise = noiseGrid(seed);
    fill(g, w, h, (u, v) => painter(u, v, fbm(noise, u * 4, v * 3), noise));
    out[key] = tex(c);
  };

  simple('io', 3, (u, v, n) => {
    let r = 220, gc = 190, b = 70;
    if (n > 0.62) { r = 80; gc = 50; b = 30; }
    if (n < 0.35) { r = 240; gc = 220; b = 120; }
    return [r, gc + n * 10, b, 255];
  });
  simple('europa', 4, (u, v, n, noise) => {
    const crack = Math.abs(noise(u * 8, v * 2) - 0.5) < 0.04;
    return crack ? [120, 150, 170, 255] : [230 + n * 10, 236, 242, 255];
  });
  simple('ganymede', 5, (u, v, n) => [150 + n * 40, 140 + n * 30, 120, 255]);
  simple('callisto', 6, (u, v, n) => {
    const crater = n > 0.72 ? 40 : 0;
    return [90 + n * 20 + crater, 84, 76, 255];
  });
  simple('titan', 7, (u, v, n) => [210 + n * 20, 140, 70, 255]);
  simple('enceladus', 8, (u, v, n, noise) => {
    const crack = Math.abs(noise(u * 10, v) - 0.5) < 0.03;
    return crack ? [150, 190, 210, 255] : [245, 250, 255, 255];
  });
  simple('triton', 9, (u, v, n) => [210 + n * 15, 180, 170, 255]);
  simple('charon', 10, (u, v, n) => (v < 0.28 ? [70, 60, 58, 255] : [180 + n * 10, 176, 170, 255]));
  simple('ceres', 12, (u, v, n) => [160 + n * 20, 150, 140, 255]);
  simple('pluto', 13, (u, v, n) => [214 + n * 16, 186, 160, 255]);
  simple('haumea', 14, () => [236, 240, 244, 255]);
  simple('makemake', 15, (u, v, n) => [210, 170 + n * 20, 130, 255]);
  simple('eris', 16, () => [245, 245, 242, 255]);
  simple('phobos', 17, (u, v, n) => [90 + n * 20, 84, 78, 255]);
  simple('deimos', 18, (u, v, n) => [130 + n * 16, 120, 110, 255]);
  simple('miranda', 19, (u, v, n) => (n > 0.6 ? [200, 190, 180, 255] : [120, 110, 100, 255]));
  simple('ariel', 20, () => [220, 216, 208, 255]);
  simple('umbriel', 21, (u, v, n) => [80 + n * 10, 76, 72, 255]);
  simple('titania', 22, (u, v, n) => [190 + n * 12, 180, 170, 255]);
  simple('oberon', 23, (u, v, n) => [160 + n * 14, 150, 140, 255]);

  out.saturnRing = ringTexture({ inner: 66900, outer: 140220, cassini: 119000, seed: 80, tone: [210, 190, 150] });
  out.uranusRing = ringTexture({ inner: 38000, outer: 51000, seed: 81, tone: [180, 210, 220], faint: true });
  out.jupiterRing = ringTexture({ inner: 92000, outer: 129000, seed: 82, tone: [180, 170, 150], faint: true });
  out.neptuneRing = ringTexture({ inner: 41000, outer: 63000, seed: 83, tone: [160, 180, 210], faint: true });
  out.marker = markerTexture();
  out.star = null;
  return out;
}

function ringTexture({ inner, outer, cassini, seed, tone, faint = false }) {
  const size = 1024;
  const { c, g } = canvas(size, size);
  const img = g.createImageData(size, size);
  const rand = noiseGrid(seed, 64);
  const innerN = inner / outer;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size * 2 - 1;
      const dy = (y + 0.5) / size * 2 - 1;
      const r = Math.hypot(dx, dy);
      const i = (y * size + x) * 4;
      if (r < innerN || r > 1) {
        img.data[i + 3] = 0;
        continue;
      }
      const t = (r - innerN) / (1 - innerN);
      const gap = cassini ? Math.abs(r * outer - cassini) < outer * 0.012 : false;
      const band = 0.55 + 0.45 * Math.sin(t * 48) ** 2;
      const grain = rand(t * 4, 0.2) * 0.25;
      let alpha = (faint ? 50 : 150) * (0.45 + band * 0.55) * (1 - grain);
      if (gap) alpha = 8;
      if (t < 0.04 || t > 0.98) alpha *= 0.2;
      img.data[i] = tone[0];
      img.data[i + 1] = tone[1];
      img.data[i + 2] = tone[2];
      img.data[i + 3] = Math.max(0, Math.min(255, alpha));
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

function markerTexture() {
  const { c, g } = canvas(64, 64);
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#d7f4ff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(32, 6);
  g.lineTo(58, 32);
  g.lineTo(32, 58);
  g.lineTo(6, 32);
  g.closePath();
  g.stroke();
  return tex(c);
}

export function irregularGeometry(seed, radius = 1, detail = 2) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const rand = mulberry32(seed);
  for (let i = 0; i < pos.count; i += 1) {
    const wobble = 0.82 + rand() * 0.36;
    pos.setXYZ(i, pos.getX(i) * wobble, pos.getY(i) * (0.78 + rand() * 0.3), pos.getZ(i) * wobble);
  }
  geo.computeVertexNormals();
  return geo;
}
