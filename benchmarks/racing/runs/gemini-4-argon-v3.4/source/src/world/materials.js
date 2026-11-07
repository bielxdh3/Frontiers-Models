import * as THREE from 'three';

// Generates a 1024x1024 procedural detail texture pair (albedo + normal + roughness) for props, car trim, foliage, liveries
// Guarantees >= 1024x1024 resolution everywhere near the track (Section 5.2 & 13.1 Test 8)
export function makeCanvasTexture(drawFn, size = 1024, isSRGB = true, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createMicroNormalMap(size = 1024, mode = 'grain', strength = 14) {
  return makeCanvasTexture((ctx, S) => {
    const img = ctx.createImageData(S, S);
    const d = img.data;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const idx = (y * S + x) * 4;
        let nx = 128;
        let ny = 128;
        if (mode === 'brushed') {
          const wave = Math.sin(y * 0.45 + Math.sin(x * 0.04) * 2.0) * strength;
          ny = 128 + wave;
          nx = 128 + (((x * 73 + y * 19) & 15) - 7.5) * 0.5;
        } else if (mode === 'tire') {
          // Radial/tread micro pattern
          const tread = Math.sin(x * 0.19) * Math.cos(y * 0.12) * strength;
          nx = 128 + tread;
          ny = 128 + Math.sin(y * 0.28) * strength;
        } else if (mode === 'curb') {
          const seam = (y % 256 < 7 || y % 256 > 249) ? (y % 256 < 7 ? -26 : 26) : 0;
          const grit = (((x * 131 + y * 257) ^ (x * y)) & 31) - 15.5;
          nx = 128 + grit * 0.45;
          ny = 128 + seam + grit * 0.45;
        } else if (mode === 'foliage') {
          const vein = Math.sin(x * 0.09) * Math.cos(y * 0.09) * strength;
          nx = 128 + vein;
          ny = 128 - vein * 0.8;
        } else {
          // Fine metallicflake / micro-grain
          const h1 = (((x * 374761 + y * 668265) >>> 4) & 31) - 15.5;
          const h2 = (((x * 198491 + y * 951277) >>> 4) & 31) - 15.5;
          nx = 128 + (h1 / 15.5) * strength;
          ny = 128 + (h2 / 15.5) * strength;
        }
        d[idx] = Math.max(0, Math.min(255, Math.round(nx)));
        d[idx + 1] = Math.max(0, Math.min(255, Math.round(ny)));
        d[idx + 2] = 255;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, size, false);
}

export class MaterialLibrary {
  constructor(loadingManager) {
    this.loader = new THREE.TextureLoader(loadingManager);
    this.sets = {};
    this.materials = {};
    this.sharedMaps = {};
  }

  async loadAll(onProgress) {
    const specs = [
      { key: 'asphaltA', id: 'asphalt_02', res: '2k' },
      { key: 'asphaltB', id: 'asphalt_04', res: '2k' },
      { key: 'sandDry', id: 'coast_sand_01', res: '1k' },
      { key: 'sandWet', id: 'damp_beach_sand', res: '1k' },
      { key: 'cliff', id: 'cliff_side', res: '1k' },
      { key: 'grassRock', id: 'aerial_grass_rock', res: '1k' },
      { key: 'forestGround', id: 'forest_ground_04', res: '1k' },
      { key: 'plasterA', id: 'painted_plaster_wall', res: '1k' },
      { key: 'plasterB', id: 'clay_plaster', res: '1k' },
      { key: 'stone', id: 'cobblestone_01', res: '1k' },
      { key: 'roofTile', id: 'clay_roof_tiles', res: '1k' },
      { key: 'bark', id: 'bark_brown_02', res: '1k' },
      { key: 'concrete', id: 'brushed_concrete_03', res: '1k' }
    ];

    let done = 0;
    const total = specs.length * 3;
    const loadTex = (url, isColor) => new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (tex) => {
          tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = 8;
          done++;
          if (onProgress) onProgress(done / total, url);
          resolve(tex);
        },
        undefined,
        (err) => reject(new Error(`Failed to load texture ${url}: ${err?.message || err}`))
      );
    });

    await Promise.all(specs.map(async (s) => {
      const [diff, nor, rough] = await Promise.all([
        loadTex(`./assets/textures/${s.id}_diff_${s.res}.jpg`, true),
        loadTex(`./assets/textures/${s.id}_nor_${s.res}.jpg`, false),
        loadTex(`./assets/textures/${s.id}_rough_${s.res}.jpg`, false)
      ]);
      this.sets[s.key] = { diff, nor, rough };
    }));

    this._buildProceduralDetailMaps();
    this._buildCoreWorldMaterials();
    return this;
  }

  cloneSet(key, repX, repY) {
    const src = this.sets[key];
    const cloneT = (t) => {
      const c = t.clone();
      c.wrapS = THREE.RepeatWrapping;
      c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(repX, repY);
      c.needsUpdate = true;
      return c;
    };
    return {
      map: cloneT(src.diff),
      normalMap: cloneT(src.nor),
      roughnessMap: cloneT(src.rough)
    };
  }

  _buildProceduralDetailMaps() {
    this.sharedMaps.microGrainNormal = createMicroNormalMap(1024, 'grain', 7);
    this.sharedMaps.brushedMetalNormal = createMicroNormalMap(1024, 'brushed', 12);
    this.sharedMaps.tireNormal = createMicroNormalMap(1024, 'tire', 18);
    this.sharedMaps.curbNormal = createMicroNormalMap(1024, 'curb', 16);
    this.sharedMaps.foliageNormal = createMicroNormalMap(1024, 'foliage', 14);

    // 1024x1024 Red & White weathered racing curb ("zebra") albedo — transverse blocks along V (track arc length s)
    this.sharedMaps.curbAlbedo = makeCanvasTexture((ctx, S) => {
      for (let i = 0; i < 4; i++) {
        const y0 = (i * S) / 4;
        const h = S / 4;
        ctx.fillStyle = i % 2 === 0 ? '#c93026' : '#ebe6dc';
        ctx.fillRect(0, y0, S, h);
        // Transverse concrete expansion joint between red & white curb blocks
        ctx.fillStyle = 'rgba(20,18,16,0.28)';
        ctx.fillRect(0, y0, S, 6);
        ctx.fillStyle = 'rgba(255,252,245,0.16)';
        ctx.fillRect(0, y0 + 6, S, 3);
      }
      // Subtle bevel edge highlight + tire rubber scuff marks along racing line edge
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(Math.round(S * 0.42), 0, Math.round(S * 0.06), S);
      for (let k = 0; k < 2400; k++) {
        const gx = (Math.sin(k * 12.9898) * 43758.5453 % 1 + 1) % 1 * S;
        const gy = (Math.sin(k * 78.233) * 19341.123 % 1 + 1) % 1 * S;
        ctx.fillStyle = k % 3 === 0 ? 'rgba(28,26,24,0.18)' : 'rgba(255,250,240,0.08)';
        ctx.fillRect(gx, gy, 4 + (k % 7), 10 + (k % 20));
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Galvanized steel guardrail & metalwork albedo
    this.sharedMaps.galvanizedAlbedo = makeCanvasTexture((ctx, S) => {
      const grad = ctx.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, '#b5bcc2');
      grad.addColorStop(0.5, '#cdd3d8');
      grad.addColorStop(1, '#9ba2a8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);
      for (let k = 0; k < 3500; k++) {
        const gx = ((k * 7919) % S);
        const gy = ((k * 104729) % S);
        ctx.fillStyle = k % 2 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(55,60,65,0.11)';
        ctx.fillRect(gx, gy, 14, 4);
      }
    }, 1024, true, 2, 1);

    // 1024x1024 Painted wood / shutters / doors / beach fences albedo
    this.sharedMaps.woodAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.fillStyle = '#9a7b5c';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 64; i++) {
        const y = (i / 64) * S;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(55,35,18,0.13)' : 'rgba(235,210,180,0.09)';
        ctx.fillRect(0, y, S, S / 96);
      }
      for (let p = 0; p < 8; p++) {
        ctx.fillStyle = 'rgba(25,16,10,0.28)';
        ctx.fillRect((p * S) / 8, 0, 4, S);
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Striped fabric awning / race banner albedo
    this.sharedMaps.fabricStripeAlbedo = makeCanvasTexture((ctx, S) => {
      const stripes = 8;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c84b31' : '#f3ece0';
        ctx.fillRect((i * S) / stripes, 0, S / stripes, S);
      }
      for (let y = 0; y < S; y += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(0, y, S, 3);
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Pinnate Palm Frond Albedo (RGBA alpha-cutout leaflets + central golden-olive rachis)
    this.sharedMaps.palmFrondAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.clearRect(0, 0, S, S);
      // Central rachis stem running bottom (y=S) to tip (y=24)
      const stemGrad = ctx.createLinearGradient(0, S, 0, 20);
      stemGrad.addColorStop(0, '#726a34');
      stemGrad.addColorStop(0.5, '#59732f');
      stemGrad.addColorStop(1, '#4c6829');
      ctx.fillStyle = stemGrad;
      ctx.beginPath();
      ctx.moveTo(S * 0.482, S);
      ctx.lineTo(S * 0.518, S);
      ctx.lineTo(S * 0.503, 18);
      ctx.lineTo(S * 0.497, 18);
      ctx.closePath();
      ctx.fill();

      // 46 pairs of lance-shaped pinnate leaflets radiating out along the rachis
      const pairs = 46;
      for (let i = 0; i < pairs; i++) {
        const t = i / (pairs - 1); // 0 base -> 1 tip
        const yBase = S * (0.96 - t * 0.91);
        const env = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.96);
        const reach = S * (0.09 + 0.39 * env);
        const droop = S * (0.04 + 0.08 * t);
        const bladeW = S * (0.016 * (1.0 - t * 0.45));

        for (const side of [-1, 1]) {
          const jitter = Math.sin(i * 7.13 + side * 2.1) * 6;
          const x0 = S * 0.5 + side * 4;
          const xTip = S * 0.5 + side * reach;
          const yTip = yBase - S * 0.055 + droop + jitter;

          const g = ctx.createLinearGradient(x0, yBase, xTip, yTip);
          g.addColorStop(0, '#5a7330');
          g.addColorStop(0.55, i % 3 === 0 ? '#486628' : '#53712d');
          g.addColorStop(1, '#7c7a38'); // sun-kissed tip
          ctx.fillStyle = g;

          ctx.beginPath();
          ctx.moveTo(x0, yBase - bladeW * 0.55);
          ctx.quadraticCurveTo(
            (x0 + xTip) * 0.52,
            (yBase + yTip) * 0.5 - bladeW * 1.15,
            xTip,
            yTip
          );
          ctx.quadraticCurveTo(
            (x0 + xTip) * 0.50,
            (yBase + yTip) * 0.5 + bladeW * 0.65,
            x0,
            yBase + bladeW * 0.55
          );
          ctx.closePath();
          ctx.fill();
        }
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Botanical Mediterranean Foliage Cluster Albedo (RGBA alpha-cutout olive/maquis/pine branchlet spray)
    this.sharedMaps.foliageClusterAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.clearRect(0, 0, S, S);
      // Woody twigs
      ctx.strokeStyle = '#5c4b37';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (let b = 0; b < 7; b++) {
        const ang = -Math.PI * 0.5 + (b - 3) * 0.34;
        ctx.beginPath();
        ctx.moveTo(S * 0.5, S * 0.90);
        ctx.quadraticCurveTo(
          S * 0.5 + Math.cos(ang) * S * 0.22,
          S * 0.62,
          S * 0.5 + Math.cos(ang) * S * 0.38,
          S * 0.5 + Math.sin(ang) * S * 0.38
        );
        ctx.stroke();
      }
      // 340 layered organic Mediterranean leaves with light/dark variation
      const palette = ['#3d572a', '#4c6733', '#5c763d', '#6b8048', '#344b24', '#748752'];
      for (let i = 0; i < 340; i++) {
        const r1 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const r2 = ((Math.sin(i * 78.233) * 19341.731) % 1 + 1) % 1;
        const r3 = ((Math.sin(i * 39.417) * 29173.119) % 1 + 1) % 1;
        const rad = Math.pow(r1, 0.58) * S * 0.43;
        const theta = r2 * Math.PI * 2;
        const lx = S * 0.5 + Math.cos(theta) * rad;
        const ly = S * 0.49 + Math.sin(theta) * rad * 0.92;
        const lw = 24 + r3 * 24;
        const lh = 10 + (i % 5) * 2.4;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(theta + (r3 - 0.5) * 1.1);
        ctx.fillStyle = palette[i % palette.length];
        ctx.beginPath();
        ctx.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,230,180,0.18)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-lw * 0.8, 0);
        ctx.lineTo(lw * 0.8, 0);
        ctx.stroke();
        ctx.restore();
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Coastal Dune & Roadside Grass Tuft Albedo (opaque rich golden-olive striated blade sheet)
    this.sharedMaps.grassBladeAlbedo = makeCanvasTexture((ctx, S) => {
      const g = ctx.createLinearGradient(0, S, 0, 0);
      g.addColorStop(0, '#445228');
      g.addColorStop(0.55, '#6d7a3e');
      g.addColorStop(1, '#a99d5c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 180; i++) {
        const x = (i / 180) * S;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(35,44,18,0.18)' : 'rgba(235,220,155,0.14)';
        ctx.fillRect(x, 0, 3, S);
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Start/Finish Gantry Banner Albedo
    this.sharedMaps.gantryBannerAlbedo = makeCanvasTexture((ctx, S) => {
      const bg = ctx.createLinearGradient(0, 0, 0, S);
      bg.addColorStop(0, '#18222f');
      bg.addColorStop(0.5, '#202e3f');
      bg.addColorStop(1, '#131b26');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Warm Mediterranean gold & terracotta racing stripes
      ctx.fillStyle = '#d95b38';
      ctx.fillRect(0, S * 0.08, S, S * 0.07);
      ctx.fillStyle = '#e7b053';
      ctx.fillRect(0, S * 0.16, S, S * 0.035);
      ctx.fillRect(0, S * 0.81, S, S * 0.035);

      // Subtle checkered motorsport end blocks
      const sq = 32;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#f0ebe1' : '#18202a';
          ctx.fillRect(24 + col * sq, S * 0.30 + row * sq, sq, sq);
          ctx.fillRect(S - 24 - (col + 1) * sq, S * 0.30 + row * sq, sq, sq);
        }
      }

      ctx.fillStyle = '#f5efe4';
      ctx.font = 'bold 74px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CIRCUITO COSTA DOURADA', S * 0.5, S * 0.49);
      ctx.fillStyle = '#e7b053';
      ctx.font = '600 38px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('LARGADA  •  CHEGADA', S * 0.5, S * 0.67);
    }, 1024, true, 1, 1);

    // 1024x1024 Coastal Pennant Flag Albedo
    this.sharedMaps.raceFlagAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.fillStyle = '#cb4a2f';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#f3eadb';
      ctx.fillRect(0, S * 0.34, S, S * 0.32);
      ctx.fillStyle = '#1b5f7a';
      ctx.fillRect(0, S * 0.43, S, S * 0.14);
      ctx.fillStyle = '#e6ad4c';
      ctx.fillRect(S * 0.12, 0, S * 0.09, S);
      // Subtle cloth weave
      for (let y = 0; y < S; y += 6) {
        ctx.fillStyle = 'rgba(0,0,0,0.045)';
        ctx.fillRect(0, y, S, 2);
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Mediterranean Stone-Pine (Pinheiro-Manso) Needle Spray Albedo (RGBA alpha-cutout)
    this.sharedMaps.pineNeedleAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.clearRect(0, 0, S, S);
      // Warm resinous pine twigs radiating into umbrella clusters
      ctx.strokeStyle = '#634832';
      ctx.lineCap = 'round';
      for (let b = 0; b < 9; b++) {
        const ang = -Math.PI * 0.5 + (b - 4) * 0.31;
        ctx.lineWidth = 11 - Math.abs(b - 4) * 1.1;
        ctx.beginPath();
        ctx.moveTo(S * 0.5, S * 0.92);
        ctx.quadraticCurveTo(
          S * 0.5 + Math.cos(ang) * S * 0.24,
          S * 0.62,
          S * 0.5 + Math.cos(ang) * S * 0.42,
          S * 0.46 + Math.sin(ang) * S * 0.36
        );
        ctx.stroke();
      }
      // Dense underlying Mediterranean pine-needle foliage body tufts so umbrella crowns look volumetric from below & afar
      const puffCols = ['#203918', '#2a4820', '#345827', '#406630', '#4f7539'];
      for (let p = 0; p < 320; p++) {
        const r1 = ((Math.sin(p * 31.713) * 43758.5453) % 1 + 1) % 1;
        const r2 = ((Math.sin(p * 57.193) * 24631.917) % 1 + 1) % 1;
        const rad = Math.pow(r1, 0.62) * S * 0.40;
        const theta = r2 * Math.PI * 2;
        const px = S * 0.5 + Math.cos(theta) * rad;
        const py = S * 0.47 + Math.sin(theta) * rad * 0.84;
        ctx.fillStyle = puffCols[p % puffCols.length];
        ctx.beginPath();
        ctx.ellipse(px, py, 24 + (p % 5) * 5, 16 + (p % 4) * 4, theta, 0, Math.PI * 2);
        ctx.fill();
      }
      // 540 radiating Mediterranean stone-pine needle fans with sunlit emerald/gold tips & deep shade bases
      const needleCols = ['#26421d', '#315224', '#3d632c', '#4c7335', '#5f823f', '#738f48'];
      for (let i = 0; i < 540; i++) {
        const r1 = ((Math.sin(i * 17.131) * 43758.5453) % 1 + 1) % 1;
        const r2 = ((Math.sin(i * 63.719) * 29431.193) % 1 + 1) % 1;
        const r3 = ((Math.sin(i * 91.413) * 15731.871) % 1 + 1) % 1;
        const rad = Math.pow(r1, 0.56) * S * 0.44;
        const theta = r2 * Math.PI * 2;
        const cx = S * 0.5 + Math.cos(theta) * rad;
        const cy = S * 0.48 + Math.sin(theta) * rad * 0.86;
        ctx.strokeStyle = needleCols[i % needleCols.length];
        ctx.lineWidth = 3.8;
        for (let n = -2; n <= 2; n++) {
          const a = theta + n * 0.24 + (r3 - 0.5) * 0.5;
          const len = 30 + r3 * 28;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          ctx.stroke();
        }
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Silvery-Sage Mediterranean Olive Tree (Oliveira) Leaf Spray Albedo (RGBA alpha-cutout)
    this.sharedMaps.oliveFoliageAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.clearRect(0, 0, S, S);
      ctx.strokeStyle = '#6d6253';
      ctx.lineCap = 'round';
      for (let b = 0; b < 8; b++) {
        const ang = -Math.PI * 0.5 + (b - 3.5) * 0.34;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(S * 0.5, S * 0.90);
        ctx.quadraticCurveTo(
          S * 0.5 + Math.cos(ang) * S * 0.20,
          S * 0.60,
          S * 0.5 + Math.cos(ang) * S * 0.40,
          S * 0.48 + Math.sin(ang) * S * 0.38
        );
        ctx.stroke();
      }
      // Characteristic narrow lanceolate silvery-green olive leaves
      const oliveCols = ['#556947', '#687c59', '#7d906d', '#8fa080', '#485b3c', '#9aa88c'];
      for (let i = 0; i < 420; i++) {
        const r1 = ((Math.sin(i * 23.717) * 43758.5453) % 1 + 1) % 1;
        const r2 = ((Math.sin(i * 81.193) * 19341.731) % 1 + 1) % 1;
        const r3 = ((Math.sin(i * 47.519) * 29173.119) % 1 + 1) % 1;
        const rad = Math.pow(r1, 0.60) * S * 0.43;
        const theta = r2 * Math.PI * 2;
        const lx = S * 0.5 + Math.cos(theta) * rad;
        const ly = S * 0.48 + Math.sin(theta) * rad * 0.90;
        const lw = 25 + r3 * 18;
        const lh = 6.5 + (i % 4) * 1.4;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(theta + (r3 - 0.5) * 1.3);
        ctx.fillStyle = oliveCols[i % oliveCols.length];
        ctx.beginPath();
        ctx.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }, 1024, true, 1, 1);

    // 1024x1024 High-Contrast Reflective Corner Chevron Sign Albedo
    this.sharedMaps.chevronSignAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.fillStyle = '#f2ede2';
      ctx.fillRect(0, 0, S, S);
      // Bold red motorsport/coastal road safety chevron arrows
      ctx.fillStyle = '#c92e22';
      const step = S / 2;
      for (let k = -1; k < 3; k++) {
        const x0 = k * step;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + step * 0.52, 0);
        ctx.lineTo(x0 + step * 0.86, S * 0.5);
        ctx.lineTo(x0 + step * 0.52, S);
        ctx.lineTo(x0, S);
        ctx.lineTo(x0 + step * 0.34, S * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      // Subtle weathered metal border & micro-scuffs
      ctx.strokeStyle = 'rgba(25,28,32,0.35)';
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, S - 18, S - 18);
      for (let i = 0; i < 900; i++) {
        const gx = ((i * 7919) % S);
        const gy = ((i * 104729) % S);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(30,26,22,0.07)';
        ctx.fillRect(gx, gy, 10, 4);
      }
    }, 1024, true, 1, 1);

    // 1024x1024 Mediterranean Louvered Shutters, Mullioned Dark Glass & Timber Door Albedo
    this.sharedMaps.archTimberAlbedo = makeCanvasTexture((ctx, S) => {
      // Rich weathered Mediterranean teal-green & walnut louver slats / door panels
      ctx.fillStyle = '#38584c';
      ctx.fillRect(0, 0, S * 0.5, S);
      ctx.fillStyle = '#68452c';
      ctx.fillRect(S * 0.5, 0, S * 0.5, S);

      // Left half (u in 0..0.5): Louvered window shutter slats
      for (let i = 0; i < 36; i++) {
        const y = (i / 36) * S;
        ctx.fillStyle = 'rgba(12,22,18,0.38)';
        ctx.fillRect(28, y, S * 0.5 - 56, 8);
        ctx.fillStyle = 'rgba(210,235,220,0.14)';
        ctx.fillRect(28, y + 8, S * 0.5 - 56, 5);
      }
      ctx.strokeStyle = '#284037';
      ctx.lineWidth = 24;
      ctx.strokeRect(12, 12, S * 0.5 - 24, S - 24);

      // Right half (u in 0.5..1.0): Paneled 2.1m Mediterranean timber street door + brass handle
      ctx.strokeStyle = '#472d1b';
      ctx.lineWidth = 26;
      ctx.strokeRect(S * 0.5 + 14, 14, S * 0.5 - 28, S - 28);
      const panels = [
        [S * 0.5 + 58, 64, 165, 360],
        [S * 0.5 + 288, 64, 165, 360],
        [S * 0.5 + 58, 490, 165, 440],
        [S * 0.5 + 288, 490, 165, 440]
      ];
      for (const [px, py, pw, ph] of panels) {
        ctx.strokeStyle = '#362012';
        ctx.lineWidth = 14;
        ctx.strokeRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(235,195,145,0.18)';
        ctx.lineWidth = 5;
        ctx.strokeRect(px + 8, py + 8, pw - 16, ph - 16);
      }
      // Brass doorknob & lockplate
      ctx.fillStyle = '#d4a84f';
      ctx.fillRect(S * 0.5 + 458, S * 0.48, 18, 68);
      ctx.beginPath();
      ctx.arc(S * 0.5 + 467, S * 0.51, 14, 0, Math.PI * 2);
      ctx.fill();
    }, 1024, true, 1, 1);

    // 1024x1024 Recessed Mullioned Window Pane Albedo (dark interior depth + subtle warm curtain/sky reflection)
    this.sharedMaps.windowPaneAlbedo = makeCanvasTexture((ctx, S) => {
      const g = ctx.createLinearGradient(0, 0, S * 0.4, S);
      g.addColorStop(0, '#2c3d4a');
      g.addColorStop(0.45, '#19232b');
      g.addColorStop(1, '#12171c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      // Subtle warm interior glow hint behind lower panes
      const warm = ctx.createRadialGradient(S * 0.5, S * 0.72, 20, S * 0.5, S * 0.72, S * 0.45);
      warm.addColorStop(0, 'rgba(225,165,95,0.24)');
      warm.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, S, S);
      // Cream timber window frame & cross mullions
      ctx.fillStyle = '#dfd6c5';
      ctx.fillRect(0, 0, S, 36);
      ctx.fillRect(0, S - 36, S, 36);
      ctx.fillRect(0, 0, 36, S);
      ctx.fillRect(S - 36, 0, 36, S);
      ctx.fillRect(S * 0.5 - 14, 0, 28, S);
      ctx.fillRect(0, S * 0.38 - 11, S, 22);
      ctx.fillRect(0, S * 0.70 - 11, S, 22);
    }, 1024, true, 1, 1);
  }

  _buildCoreWorldMaterials() {
    // 1. Road Asphalt Material (2048x2048 CC0 asphalt_02 + 2048x2048 asphalt_04 macro blend + lane paint + racing line rubber + edge wear)
    const a1 = this.sets.asphaltA;
    const a2 = this.sets.asphaltB;
    const roadMat = new THREE.MeshStandardMaterial({
      map: a1.diff,
      normalMap: a1.nor,
      roughnessMap: a1.rough,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.38,
      normalScale: new THREE.Vector2(1.15, 1.15)
    });

    roadMat.userData.totalLengthUniform = { value: 3019.02 };
    roadMat.onBeforeCompile = (shader) => {
      shader.uniforms.uAsphalt2Diff = { value: a2.diff };
      shader.uniforms.uAsphalt2Rough = { value: a2.rough };
      shader.uniforms.uTotalLength = roadMat.userData.totalLengthUniform;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec3 aRoadMeta; // x = lateralNorm (-1..+1, >1 on shoulder apron), y = racingOffsetNorm (-1..1), z = arcS
          varying vec3 vRoadMeta;
          varying vec3 vWorldPosRoad;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vRoadMeta = aRoadMeta;
          vWorldPosRoad = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uAsphalt2Diff;
          uniform sampler2D uAsphalt2Rough;
          uniform float uTotalLength;
          varying vec3 vRoadMeta;
          varying vec3 vWorldPosRoad;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec2 macroUV = vMapUv * 0.23 + vec2(0.17, 0.31);
          vec4 altAsphalt = texture2D(uAsphalt2Diff, vMapUv * 0.61);
          float macroPatch = smoothstep(0.32, 0.72, sin(vWorldPosRoad.x * 0.045) * cos(vWorldPosRoad.z * 0.045) * 0.5 + 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, altAsphalt.rgb * 1.06, macroPatch * 0.45);

          float lat = vRoadMeta.x; // -1..+1 across road width
          float absLat = abs(lat);
          float arcS = vRoadMeta.z;

          // Tire rubber darkening along AI/player racing line
          float distToLine = abs(lat - vRoadMeta.y);
          float rubberBand = exp(- (distToLine * distToLine) / 0.065) * smoothstep(1.0, 0.82, absLat);
          diffuseColor.rgb *= (1.0 - 0.24 * rubberBand);

          // Worn dusty road edges & gravel shoulder apron
          float edgeWear = smoothstep(0.76, 1.06, absLat);
          vec3 dustTint = vec3(0.54, 0.47, 0.38);
          diffuseColor.rgb = mix(diffuseColor.rgb, dustTint, edgeWear * 0.42);

          // Crisp slightly weathered white outer lane lines (|lat| ~ 0.88)
          float edgeLineMask = (1.0 - smoothstep(0.012, 0.028, abs(absLat - 0.885)));
          // Dashed center line (|lat| < 0.016, 4m dash every 10m; omitted across the starting grid zone)
          float inGridZone = step(uTotalLength - 42.0, arcS) + step(arcS, 5.0);
          float dashCycle = mod(arcS, 10.0);
          float centerDash = (1.0 - clamp(inGridZone, 0.0, 1.0)) * (1.0 - smoothstep(0.010, 0.022, absLat)) * smoothstep(0.2, 0.5, dashCycle) * (1.0 - smoothstep(3.7, 4.0, dashCycle));

          // 6 Painted Motorsport Starting Grid Boxes matching spawnGrid() slots (2 columns x 3 rows)
          float gridBoxMask = 0.0;
          if (arcS > uTotalLength - 40.0) {
            for (int gs = 0; gs < 6; gs++) {
              float rowF = floor(float(gs) * 0.5);
              float colF = mod(float(gs), 2.0);
              float slotCenterS = uTotalLength - (9.0 + rowF * 9.5 + colF * 3.8);
              float slotFrontS = slotCenterS + 2.42;
              float slotLat = (colF < 0.5 ? -2.45 : 2.45) / 6.0;
              float dFront = slotFrontS - arcS; // 0 at front line, + going backward
              float dLat = abs(lat - slotLat);
              float frontBar = (1.0 - smoothstep(0.07, 0.14, abs(dFront))) * step(dLat, 0.215);
              float sideWings = (1.0 - smoothstep(0.011, 0.024, abs(dLat - 0.205))) * step(0.0, dFront) * (1.0 - smoothstep(1.9, 2.1, dFront));
              gridBoxMask = max(gridBoxMask, max(frontBar, sideWings));
            }
          }

          // Start/Finish checkered line at s in [0.4..2.2]
          float sfBand = (1.0 - smoothstep(0.85, 0.96, abs(arcS - 1.3))) * step(absLat, 0.88);
          float checker = mod(floor((lat + 1.0) * 12.0) + floor(arcS * 3.2), 2.0);
          vec3 paintCol = vec3(0.90, 0.87, 0.80);
          float wearNoise = 0.82 + 0.18 * sin(arcS * 1.7 + lat * 19.0);
          float linePaint = clamp(max(max(edgeLineMask, centerDash), gridBoxMask) * wearNoise, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, paintCol, linePaint * 0.88);
          if (sfBand > 0.01) {
            vec3 chkCol = mix(vec3(0.11, 0.12, 0.13), vec3(0.93, 0.91, 0.86), checker);
            diffuseColor.rgb = mix(diffuseColor.rgb, chkCol, sfBand * 0.94);
          }`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float rubberGloss = exp(- ((vRoadMeta.x - vRoadMeta.y) * (vRoadMeta.x - vRoadMeta.y)) / 0.065);
          roughnessFactor = clamp(roughnessFactor - rubberGloss * 0.22 + smoothstep(0.82, 1.05, abs(vRoadMeta.x)) * 0.12, 0.28, 0.98);`
        );
    };
    roadMat.customProgramCacheKey = () => 'costa-dourada-asphalt-v34';
    this.materials.road = roadMat;

    // 2. Multi-Biome Terrain Material (blends 5 CC0 1024x1024 PBR sets seamlessly with zero repetition)
    const sGrass = this.sets.grassRock;
    const sSandDry = this.sets.sandDry;
    const sSandWet = this.sets.sandWet;
    const sCliff = this.sets.cliff;
    const sForest = this.sets.forestGround;

    const terrainMat = new THREE.MeshStandardMaterial({
      map: sGrass.diff,
      normalMap: sGrass.nor,
      roughnessMap: sGrass.rough,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.42,
      normalScale: new THREE.Vector2(1.1, 1.1)
    });

    terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uSandDryDiff = { value: sSandDry.diff };
      shader.uniforms.uSandDryNor = { value: sSandDry.nor };
      shader.uniforms.uSandWetDiff = { value: sSandWet.diff };
      shader.uniforms.uSandWetNor = { value: sSandWet.nor };
      shader.uniforms.uCliffDiff = { value: sCliff.diff };
      shader.uniforms.uCliffNor = { value: sCliff.nor };
      shader.uniforms.uForestDiff = { value: sForest.diff };
      shader.uniforms.uForestNor = { value: sForest.nor };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec4 aBiome; // x=sandDry, y=sandWet, z=cliff, w=forest (remainder = grassRock)
          varying vec4 vBiome;
          varying vec3 vTerrainWorldPos;
          varying vec3 vTerrainWorldNormal;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vBiome = aBiome;
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uSandDryDiff;
          uniform sampler2D uSandDryNor;
          uniform sampler2D uSandWetDiff;
          uniform sampler2D uSandWetNor;
          uniform sampler2D uCliffDiff;
          uniform sampler2D uCliffNor;
          uniform sampler2D uForestDiff;
          uniform sampler2D uForestNor;
          varying vec4 vBiome;
          varying vec3 vTerrainWorldPos;
          varying vec3 vTerrainWorldNormal;`
        )
        .replace(
          '#include <map_fragment>',
          `vec2 uvNear = vTerrainWorldPos.xz * 0.11;
          vec2 uvMacro = vTerrainWorldPos.xz * 0.027 + vec2(0.37, 0.19);
          // Slope-based cliff reinforcement on steep coastal rock faces
          float slopeRock = smoothstep(0.76, 0.45, abs(vTerrainWorldNormal.y));
          float wWet = clamp(vBiome.y, 0.0, 1.0);
          float wDry = clamp(vBiome.x * (1.0 - wWet), 0.0, 1.0);
          float wCliff = clamp(max(vBiome.z, slopeRock) * (1.0 - wWet - wDry * 0.7), 0.0, 1.0);
          float wForest = clamp(vBiome.w * (1.0 - wWet - wDry - wCliff), 0.0, 1.0);
          float wGrass = max(0.0, 1.0 - (wWet + wDry + wCliff + wForest));

          // Dual-scale anti-tiling sample
          vec3 cGrass = mix(texture2D(map, uvNear).rgb, texture2D(map, uvMacro).rgb, 0.38);
          vec3 cDry = mix(texture2D(uSandDryDiff, uvNear * 1.25).rgb, texture2D(uSandDryDiff, uvMacro * 1.1).rgb, 0.32);
          vec3 cWet = texture2D(uSandWetDiff, uvNear * 1.3).rgb * 0.50; // rich dark damp shoreline sand!
          // True triplanar cliff rock blend (blend sampled colors, NEVER blend disparate UV coords!)
          vec2 uvCliffPlanar = uvNear * 0.78;
          vec2 uvCliffSideX = vTerrainWorldPos.zy * vec2(0.088, 0.115);
          vec2 uvCliffSideZ = vTerrainWorldPos.xy * vec2(0.088, 0.115);
          float sideBlendX = abs(vTerrainWorldNormal.x) / max(0.001, abs(vTerrainWorldNormal.x) + abs(vTerrainWorldNormal.z));
          vec3 cCliffPlanar = mix(texture2D(uCliffDiff, uvCliffPlanar).rgb, texture2D(uCliffDiff, uvCliffPlanar * 0.31).rgb, 0.35);
          vec3 cCliffVert = mix(
            mix(texture2D(uCliffDiff, uvCliffSideZ).rgb, texture2D(uCliffDiff, uvCliffSideZ * 0.31).rgb, 0.35),
            mix(texture2D(uCliffDiff, uvCliffSideX).rgb, texture2D(uCliffDiff, uvCliffSideX * 0.31).rgb, 0.35),
            sideBlendX
          );
          vec3 cCliff = mix(cCliffPlanar, cCliffVert, slopeRock);
          vec3 cForest = mix(texture2D(uForestDiff, uvNear * 1.1).rgb, texture2D(uForestDiff, uvMacro).rgb, 0.35);

          vec3 blendedCol = cGrass * wGrass + cDry * wDry + cWet * wWet + cCliff * wCliff + cForest * wForest;
          // Macro sunlight warmth variation across hillsides
          float macroShade = 0.90 + 0.18 * sin(vTerrainWorldPos.x * 0.017 + cos(vTerrainWorldPos.z * 0.019) * 2.0);
          diffuseColor.rgb = blendedCol * macroShade;`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `vec2 uvN = vTerrainWorldPos.xz * 0.11;
          float sRockN = smoothstep(0.76, 0.45, abs(vTerrainWorldNormal.y));
          float sSideX = abs(vTerrainWorldNormal.x) / max(0.001, abs(vTerrainWorldNormal.x) + abs(vTerrainWorldNormal.z));
          vec3 nCliffVert = mix(
            texture2D(uCliffNor, vTerrainWorldPos.xy * vec2(0.088, 0.115)).xyz * 2.0 - 1.0,
            texture2D(uCliffNor, vTerrainWorldPos.zy * vec2(0.088, 0.115)).xyz * 2.0 - 1.0,
            sSideX
          );
          vec3 nCliffSample = mix(texture2D(uCliffNor, uvN * 0.78).xyz * 2.0 - 1.0, nCliffVert, sRockN);
          vec3 nTex = normalize(
            (texture2D(normalMap, uvN).xyz * 2.0 - 1.0) * (1.0 - clamp(vBiome.x + vBiome.y + max(vBiome.z, sRockN), 0.0, 0.95)) +
            (texture2D(uSandDryNor, uvN * 1.25).xyz * 2.0 - 1.0) * vBiome.x +
            (texture2D(uSandWetNor, uvN * 1.3).xyz * 2.0 - 1.0) * vBiome.y +
            nCliffSample * max(vBiome.z, sRockN) +
            (texture2D(uForestNor, uvN * 1.1).xyz * 2.0 - 1.0) * vBiome.w
          );
          nTex.xy *= normalScale;
          normal = normalize(tbn * nTex);`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          // Wet sand near shoreline glistens without harsh mirror blowout (roughness ~0.30)
          roughnessFactor = mix(0.92, 0.30, clamp(vBiome.y, 0.0, 1.0));`
        );
    };
    terrainMat.customProgramCacheKey = () => 'costa-dourada-terrain-v34';
    this.materials.terrain = terrainMat;

    // 3. Curbs ("zebras"), Guardrails, Stone Walls, Concrete Bridge
    this.materials.curb = new THREE.MeshStandardMaterial({
      map: this.sharedMaps.curbAlbedo,
      normalMap: this.sharedMaps.curbNormal,
      roughnessMap: this.sets.concrete.rough,
      roughness: 0.76,
      metalness: 0.05
    });

    this.materials.guardrail = new THREE.MeshStandardMaterial({
      map: this.sharedMaps.galvanizedAlbedo,
      normalMap: this.sharedMaps.brushedMetalNormal,
      roughnessMap: this.sets.concrete.rough,
      roughness: 0.42,
      metalness: 0.78
    });

    const stoneMaps = this.cloneSet('stone', 2, 1);
    this.materials.stoneWall = new THREE.MeshStandardMaterial({
      ...stoneMaps,
      roughness: 0.88,
      metalness: 0.03
    });

    const bridgeMaps = this.cloneSet('concrete', 3, 1);
    this.materials.bridgeConcrete = new THREE.MeshStandardMaterial({
      ...bridgeMaps,
      color: new THREE.Color('#ddd4c6'),
      roughness: 0.82,
      metalness: 0.05
    });

    const cliffMaps = this.cloneSet('cliff', 2, 2);
    this.materials.rock = new THREE.MeshStandardMaterial({
      ...cliffMaps,
      roughness: 0.88,
      metalness: 0.03
    });

    // 4. Z3 Mediterranean Village & Church Architectural PBR Materials (all >= 1024^2 albedo + normal + roughness)
    const roofMaps = this.cloneSet('roofTile', 3, 2);
    this.materials.roofTile = new THREE.MeshStandardMaterial({
      ...roofMaps,
      color: new THREE.Color('#c86d4b'),
      roughness: 0.78,
      metalness: 0.03
    });

    const trimPlasterMaps = this.cloneSet('plasterB', 2, 2);
    this.materials.terracottaTrim = new THREE.MeshStandardMaterial({
      ...trimPlasterMaps,
      color: new THREE.Color('#bc6b48'),
      roughness: 0.84,
      metalness: 0.03
    });

    this.materials.archTimber = new THREE.MeshStandardMaterial({
      map: this.sharedMaps.archTimberAlbedo,
      normalMap: this.sharedMaps.microGrainNormal,
      roughnessMap: this.sets.bark.rough,
      roughness: 0.76,
      metalness: 0.06
    });

    this.materials.windowPane = new THREE.MeshStandardMaterial({
      map: this.sharedMaps.windowPaneAlbedo,
      normalMap: this.sharedMaps.microGrainNormal,
      roughness: 0.18,
      metalness: 0.14,
      envMapIntensity: 1.15
    });

    this.materials.awningFabric = new THREE.MeshStandardMaterial({
      map: this.sharedMaps.fabricStripeAlbedo,
      normalMap: this.sharedMaps.microGrainNormal,
      roughnessMap: this.sets.plasterA.rough,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.02
    });

    this.materials.wroughtIron = new THREE.MeshStandardMaterial({
      map: this.sharedMaps.galvanizedAlbedo,
      normalMap: this.sharedMaps.brushedMetalNormal,
      roughnessMap: this.sets.concrete.rough,
      color: new THREE.Color('#35393e'),
      roughness: 0.44,
      metalness: 0.82
    });

    // 6 distinct Mediterranean house facade wall PBR materials (Section 5.3: >= 5 variations with varied plaster & stone colors)
    const wallPaletteSpecs = [
      { set: 'plasterA', rep: [2, 2], tint: '#e4c48e', name: 'plasterOchre' },      // Golden Mediterranean ochre (Ref 05/07)
      { set: 'plasterB', rep: [2, 2], tint: '#d8926f', name: 'plasterTerracotta' }, // Warm sunbaked terracotta
      { set: 'plasterA', rep: [2, 2], tint: '#efe6d5', name: 'plasterCream' },      // Coastal limewash cream
      { set: 'stone',    rep: [3, 2], tint: '#ccb99e', name: 'dressedLimestone' },  // Exposed golden stone masonry (Ref 06)
      { set: 'plasterB', rep: [2, 2], tint: '#dcb09f', name: 'plasterRose' },       // Warm coral/rose stucco
      { set: 'plasterA', rep: [2, 2], tint: '#cad0bc', name: 'plasterOliveCream' }  // Pale olive-limestone stucco
    ];
    this.materials.houseWalls = wallPaletteSpecs.map((spec) => {
      const maps = this.cloneSet(spec.set, spec.rep[0], spec.rep[1]);
      const mat = new THREE.MeshStandardMaterial({
        ...maps,
        color: new THREE.Color(spec.tint),
        roughness: 0.88,
        metalness: 0.02
      });
      mat.name = spec.name;
      return mat;
    });
  }
}
