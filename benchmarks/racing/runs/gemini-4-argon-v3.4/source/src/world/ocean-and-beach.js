import * as THREE from 'three';

function buildAxisCoords(minBound, fineStart, fineEnd, maxBound, fineStep, midStep, farSteps) {
  const coords = [];
  // Far negative -> fineStart
  const negFar = [];
  let cur = fineStart;
  let step = midStep;
  while (cur - step > minBound) {
    cur -= step;
    negFar.push(cur);
    step *= 1.34;
  }
  negFar.push(minBound);
  negFar.reverse();
  for (const v of negFar) coords.push(v);

  // Fine coastal zone
  for (let v = fineStart; v <= fineEnd + 1e-4; v += fineStep) {
    coords.push(v);
  }

  // fineEnd -> Far positive
  cur = coords[coords.length - 1];
  step = midStep;
  let guard = 0;
  while (cur + step < maxBound && guard < farSteps) {
    cur += step;
    coords.push(cur);
    step *= 1.34;
    guard++;
  }
  coords.push(maxBound);
  return coords;
}

export class OceanSystem {
  constructor(terrain, trackData, coastalRocks = []) {
    this.terrain = terrain;
    this.trackData = trackData;
    this.coastalRocks = coastalRocks;

    this.domainMin = new THREE.Vector2(-920, -520);
    this.domainSize = new THREE.Vector2(1800, 1080);

    this.coastalFieldTex = this._bakeCoastalFieldTexture(512, 512);
    this.material = this._createOceanMaterial();
    this.mesh = this._buildOceanMesh();
  }

  _bakeCoastalFieldTexture(width, height) {
    const data = new Uint8Array(width * height * 4);
    const terrain = this.terrain;

    // Filter rocks near waterline/surf for fast distance evaluation
    const surfRocks = this.coastalRocks.filter((r) => r.waterline);

    for (let j = 0; j < height; j++) {
      const v = (j + 0.5) / height;
      const z = this.domainMin.y + v * this.domainSize.y;
      for (let i = 0; i < width; i++) {
        const u = (i + 0.5) / width;
        const x = this.domainMin.x + u * this.domainSize.x;

        // Sample terrain height (clamp outside terrain heightfield bounds to deep sea or land smoothly)
        let ty;
        if (x >= terrain.minX && x <= terrain.maxX && z >= terrain.minZ && z <= terrain.maxZ) {
          ty = terrain.sampleHeightAndNormal(x, z).y;
        } else {
          const zShore = terrain.shorelineZ(Math.max(-880, Math.min(840, x)));
          if (z > zShore || x > 760 || x < -800) {
            ty = -15.0;
          } else {
            ty = 12.0;
          }
        }

        // R: Macro depth 0..16m -> 0..1
        const depthNorm = Math.max(0, Math.min(1, -ty / 16.0));
        // G: High-precision shallow surf & swash ramp: ty = +0.55m -> 0.0, ty = 0.0m -> 0.20, ty = -2.20m -> 1.0
        const shallowNorm = Math.max(0, Math.min(1, (0.55 - ty) / 2.75));

        // B: Proximity to submerged/waterline surf rocks ONLY (ty < 0.08m), tight physical collar so nearshore water stays translucent!
        let rockFoam = 0;
        if (ty < 0.25 && ty > -3.5) {
          for (let r = 0; r < surfRocks.length; r++) {
            const rk = surfRocks[r];
            const dx = x - rk.x;
            const dz = z - rk.z;
            if (Math.abs(dx) > 5.0 || Math.abs(dz) > 5.0) continue;
            const dist = Math.hypot(dx, dz);
            const surfDist = Math.max(0, dist - rk.radius * 0.55);
            const falloff = 0.85 + rk.radius * 0.28;
            if (surfDist < falloff) {
              const p = 1.0 - surfDist / falloff;
              if (p > rockFoam) rockFoam = p;
            }
          }
        }

        const idx = (j * width + i) * 4;
        data[idx] = Math.round(depthNorm * 255);
        data[idx + 1] = Math.round(shallowNorm * 255);
        data[idx + 2] = Math.round(Math.max(0, Math.min(1, rockFoam)) * 255);
        data[idx + 3] = 255;
      }
    }

    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  _createOceanMaterial() {
    const sunArr = this.trackData.sunDirection || [0.905, 0.168, 0.39];
    const sunDir = new THREE.Vector3(sunArr[0], sunArr[1], sunArr[2]).normalize();

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: sunDir },
        uSunColor: { value: new THREE.Color('#ffbe73') },
        uSkyZenith: { value: new THREE.Color('#4a6e98') },
        uSkyHorizon: { value: new THREE.Color('#e9ae79') },
        uFogColor: { value: new THREE.Color('#dba273') },
        uCoastalField: { value: this.coastalFieldTex },
        uDomainMin: { value: this.domainMin },
        uDomainSize: { value: this.domainSize }
      },
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uCoastalField;
        uniform vec2 uDomainMin;
        uniform vec2 uDomainSize;

        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying vec2 vFieldUV;
        varying float vCrest;

        vec3 evalWaves(vec2 p, float ampScale, out vec3 outNorm, out float crest) {
          // 4 directional Mediterranean swell & wind-wave components
          vec2 d1 = normalize(vec2(-0.24, -0.97)); // primary swell rolling onshore (-Z)
          vec2 d2 = normalize(vec2( 0.38, -0.92));
          vec2 d3 = normalize(vec2(-0.68, -0.73));
          vec2 d4 = normalize(vec2( 0.81, -0.58));

          float ph1 = dot(p, d1) * 0.145 + uTime * 1.45;
          float ph2 = dot(p, d2) * 0.270 + uTime * 1.95;
          float ph3 = dot(p, d3) * 0.520 + uTime * 2.55;
          float ph4 = dot(p, d4) * 1.050 + uTime * 3.30;

          float a1 = 0.145 * ampScale;
          float a2 = 0.075 * ampScale;
          float a3 = 0.038 * ampScale;
          float a4 = 0.018 * ampScale;

          float h = sin(ph1) * a1 + sin(ph2) * a2 + sin(ph3) * a3 + sin(ph4) * a4;
          vec2 grad =
            d1 * (cos(ph1) * a1 * 0.145) +
            d2 * (cos(ph2) * a2 * 0.270) +
            d3 * (cos(ph3) * a3 * 0.520) +
            d4 * (cos(ph4) * a4 * 1.050);

          // Subtle horizontal Gerstner chop
          vec2 dispXZ = -(d1 * cos(ph1) * a1 * 0.45 + d2 * cos(ph2) * a2 * 0.35);
          outNorm = normalize(vec3(-grad.x, 1.0, -grad.y));
          crest = clamp((h / max(0.04, 0.24 * ampScale)) * 0.5 + 0.5, 0.0, 1.0);
          return vec3(dispXZ.x, h, dispXZ.y);
        }

        void main() {
          vec4 wp0 = modelMatrix * vec4(position, 1.0);
          vec2 fuv = (wp0.xz - uDomainMin) / uDomainSize;
          vFieldUV = fuv;

          float depthNorm = 1.0;
          if (fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0) {
            depthNorm = texture2D(uCoastalField, fuv).r;
          }

          // Shoaling damping right at the beach swash edge + far-horizon anti-aliasing fade
          float distCam = length(wp0.xz - cameraPosition.xz);
          float shoalAmp = smoothstep(0.005, 0.11, depthNorm);
          float farFade = 1.0 - smoothstep(1100.0, 4800.0, distCam);
          float ampScale = mix(0.14, 1.0, shoalAmp) * farFade;

          vec3 wNorm;
          float crest;
          vec3 disp = evalWaves(wp0.xz, ampScale, wNorm, crest);
          vec3 finalWorld = wp0.xyz + disp;

          vWorldPos = finalWorld;
          vWaveNormal = wNorm;
          vCrest = crest;

          gl_Position = projectionMatrix * viewMatrix * vec4(finalWorld, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyZenith;
        uniform vec3 uSkyHorizon;
        uniform vec3 uFogColor;
        uniform sampler2D uCoastalField;
        uniform vec2 uDomainMin;
        uniform vec2 uDomainSize;

        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying vec2 vFieldUV;
        varying float vCrest;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbmFoam(vec2 p) {
          float v = 0.0;
          float a = 0.52;
          mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
          for (int i = 0; i < 4; i++) {
            v += a * valueNoise(p);
            p = rot * p * 2.07 + vec2(17.1, 31.7);
            a *= 0.5;
          }
          return v;
        }

        // High-contrast lacy cellular sea-foam web: thin bright filaments with clear open turquoise water inside cells!
        float cellularFoam(vec2 p) {
          float n1 = valueNoise(p * 2.1 + vec2(uTime * 0.18, -uTime * 0.24));
          float n2 = valueNoise(p * 5.2 - vec2(uTime * 0.27, uTime * 0.15));
          float web1 = pow(1.0 - abs(n1 * 2.0 - 1.0), 3.2);
          float web2 = pow(1.0 - abs(n2 * 2.0 - 1.0), 3.6);
          return clamp(web1 * 0.85 + web2 * 0.48, 0.0, 1.0);
        }

        void main() {
          vec2 fuv = (vWorldPos.xz - uDomainMin) / uDomainSize;
          float depthNorm = 1.0;
          float shallowNorm = 1.0;
          float rockProx = 0.0;

          if (fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0) {
            vec4 cf = texture2D(uCoastalField, fuv);
            depthNorm = cf.r;
            shallowNorm = cf.g;
            rockProx = cf.b;
          }

          // Reconstruct water depth in meters near shore from high-precision G channel
          // shallowNorm = (0.55 - terrainY) / 2.75 => waterDepth = -terrainY = shallowNorm * 2.75 - 0.55
          float nearDepthM = shallowNorm * 2.75 - 0.55;
          float waterDepthM = mix(nearDepthM, depthNorm * 16.0, smoothstep(0.82, 0.99, shallowNorm));

          // Animated swash oscillation up and down the wet beach sand (+/- 0.09m) with organic shoreline curve
          float shoreWobble = (fbmFoam(vWorldPos.xz * 0.16) - 0.5) * 0.16;
          float swashWave = sin(uTime * 1.65 + vWorldPos.x * 0.075 + fbmFoam(vWorldPos.xz * 0.08) * 2.2) * 0.09;
          float effectiveDepth = waterDepthM + swashWave + shoreWobble;
          if (effectiveDepth <= -0.10) discard;

          vec3 V = normalize(cameraPosition - vWorldPos);
          float distCam = length(cameraPosition - vWorldPos);

          // Multi-frequency capillary ripple normals (animated in opposite drift directions)
          float rippleFade = 1.0 - smoothstep(180.0, 1800.0, distCam);
          vec2 pRip = vWorldPos.xz;
          float r1 = valueNoise(pRip * 1.45 + vec2(uTime * 0.65, -uTime * 0.95));
          float r2 = valueNoise(pRip * 3.60 + vec2(-uTime * 0.85, -uTime * 0.55));
          float r3 = valueNoise(pRip * 8.20 + vec2(uTime * 1.25, uTime * 0.75));
          vec3 microN = vec3(
            ((r1 - 0.5) * 0.26 + (r2 - 0.5) * 0.17 + (r3 - 0.5) * 0.09) * rippleFade,
            1.0,
            ((r2 - 0.5) * 0.26 - (r1 - 0.5) * 0.17 + (r3 - 0.5) * 0.09) * rippleFade
          );
          vec3 N = normalize(vec3(vWaveNormal.x + microN.x, vWaveNormal.y, vWaveNormal.z + microN.z));

          // 1. Depth-based Mediterranean water color gradient (Ref 02 & Ref 04)
          vec3 colSwash     = vec3(0.24, 0.60, 0.58); // translucent shallow aqua-jade (0..0.45m)
          vec3 colTurquoise = vec3(0.06, 0.48, 0.56); // vibrant shallow lagoon turquoise (0.45..2.4m)
          vec3 colMidTeal   = vec3(0.04, 0.26, 0.42); // mid-bay Aegean teal-blue (2.4..7.0m)
          vec3 colDeepAzure = vec3(0.02, 0.10, 0.24); // deep offshore cobalt-azure (>7.0m)

          vec3 waterBody = mix(colSwash, colTurquoise, smoothstep(0.06, 1.25, effectiveDepth));
          waterBody = mix(waterBody, colMidTeal, smoothstep(1.15, 4.8, effectiveDepth));
          waterBody = mix(waterBody, colDeepAzure, smoothstep(4.2, 12.5, effectiveDepth));

          // Subsurface turquoise glow when golden sun backlights wave crests
          float sss = pow(clamp(dot(V, -uSunDir + N * 0.45), 0.0, 1.0), 3.0) * vCrest;
          waterBody += vec3(0.07, 0.28, 0.27) * sss * (0.45 + 0.55 * (1.0 - depthNorm));

          // 2. Balanced Sky Fresnel reflection (preserving vivid depth color even at low S3 camera angles!) & Sun glitter
          float NdotV = clamp(dot(N, V), 0.001, 1.0);
          float fresnel = 0.03 + 0.50 * pow(1.0 - NdotV, 4.2);

          vec3 R = reflect(-V, N);
          float skyElev = clamp(R.y * 1.45, 0.0, 1.0);
          float sunAlign = pow(clamp(dot(normalize(vec3(R.x, 0.0, R.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0, 1.0), 3.0);
          vec3 skyRefl = mix(uSkyHorizon * 0.88, uSkyZenith, pow(skyElev, 0.55));
          skyRefl = mix(skyRefl, uSunColor * 1.05, sunAlign * (1.0 - skyElev) * 0.42);

          // Dual-lobe sun specular: tight mirror glitter + warm golden sheen
          vec3 H = normalize(uSunDir + V);
          float NdotH = clamp(dot(N, H), 0.0, 1.0);
          float specTight = pow(NdotH, 380.0) * 3.4;
          float specBroad = pow(NdotH, 42.0) * 0.24;
          vec3 sunSpec = uSunColor * (specTight + specBroad);

          vec3 surfaceCol = mix(waterBody, skyRefl, fresnel) + sunSpec;

          // 3. Animated Shoreline Surf Foam & Swash Lace (Section 5.5, Ref 02 & Ref 04)
          float foamNoise = fbmFoam(vWorldPos.xz * 0.46 + vec2(0.0, uTime * 0.16));
          float bubbleTex = cellularFoam(vWorldPos.xz * 1.45);

          // Rolling onshore wave trains breaking across shallow beach (0.1..2.2m depth)
          float surfZone = (1.0 - smoothstep(1.55, 2.55, effectiveDepth)) * smoothstep(0.02, 0.18, effectiveDepth);
          float wavePhase = effectiveDepth * 13.5 + uTime * 2.25 + foamNoise * 3.4;
          float crestEnvelope = pow(clamp(sin(wavePhase) * 0.5 + 0.5, 0.0, 1.0), 4.5);
          // Thin bright breaking crest line + trailing lacy foam web (leaving open turquoise water between wave crests!)
          float surfFoam = surfZone * clamp(crestEnvelope * 0.88 + crestEnvelope * bubbleTex * 0.75, 0.0, 1.0);

          // Delicate lacy shoreline swash rim right on the wet sand edge (0..0.18m depth)
          float swashRim = (1.0 - smoothstep(0.03, 0.19, effectiveDepth)) * smoothstep(-0.04, 0.03, effectiveDepth);
          float swashLip = swashRim * (0.35 + 0.65 * bubbleTex);

          // 4. Animated Coastal Rock Foam Rings & Splash Collars (Section 4 Z1 & Ref 04)
          float rockFoam = 0.0;
          if (rockProx > 0.01 && effectiveDepth > 0.02) {
            // Tight splash rim hugging submerged rock + 2 delicate animated concentric foam rings
            float innerCollar = smoothstep(0.62, 0.92, rockProx + (foamNoise - 0.5) * 0.18) * (0.45 + 0.55 * bubbleTex);
            float ringPhase = (1.0 - rockProx) * 18.0 - uTime * 3.25 + foamNoise * 2.6;
            float outerRings = pow(clamp(sin(ringPhase) * 0.5 + 0.5, 0.0, 1.0), 5.5) * smoothstep(0.08, 0.65, rockProx) * (0.4 + 0.6 * bubbleTex);
            rockFoam = clamp(max(innerCollar, outerRings * 0.85), 0.0, 1.0);
          }

          // Distant offshore whitecaps on high wave crests
          float whitecaps = smoothstep(0.76, 0.96, vCrest * 0.65 + foamNoise * 0.48) * smoothstep(2.5, 7.0, effectiveDepth) * 0.28;

          float totalFoam = clamp(max(max(surfFoam * 0.94, swashLip * 0.96), max(rockFoam, whitecaps)), 0.0, 1.0);

          // Crisp sunlit white/cream foam contrasting cleanly against turquoise/cobalt sea
          vec3 foamLit = mix(vec3(0.84, 0.89, 0.93), vec3(1.00, 0.97, 0.92), 0.55 + 0.45 * bubbleTex);
          surfaceCol = mix(surfaceCol, foamLit, totalFoam);

          // 5. Distant Horizon Atmospheric Fog (>150m only, Section 5.6, seamless horizon merge!)
          float fogDist = max(0.0, distCam - 165.0);
          float fogFactor = 1.0 - exp(-pow(fogDist * 0.00038, 1.35));
          vec3 horizonColor = mix(uFogColor, uSkyHorizon, 0.45);
          surfaceCol = mix(surfaceCol, horizonColor, clamp(fogFactor, 0.0, 1.0));

          // 6. Feathered Shoreline Edge + Shallow Water Transparency (ZERO sharp cutout line on wet sand!)
          float shoreEdgeFeather = smoothstep(-0.08, 0.14, effectiveDepth + (bubbleTex - 0.5) * 0.12);
          float baseAlpha = smoothstep(0.0, 0.42, effectiveDepth) * 0.92 + totalFoam * 0.94 + fresnel * 0.25 + fogFactor;
          float waterAlpha = clamp(baseAlpha * shoreEdgeFeather, 0.0, 0.99);

          gl_FragColor = vec4(surfaceCol, waterAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
  }

  _buildOceanMesh() {
    // Non-uniform grid: 2.4m spacing along Z1 coast & surf, expanding smoothly to 8,800m horizon in all directions!
    const xs = buildAxisCoords(-8800, -640, 620, 8800, 2.8, 12.0, 26);
    const zs = buildAxisCoords(-8800, 215, 385, 8800, 2.2, 12.0, 26);

    const nx = xs.length;
    const nz = zs.length;
    const positions = new Float32Array(nx * nz * 3);
    const uvs = new Float32Array(nx * nz * 2);
    const landHeights = new Float32Array(nx * nz);

    const terrain = this.terrain;
    for (let j = 0; j < nz; j++) {
      const z = zs[j];
      for (let i = 0; i < nx; i++) {
        const x = xs[i];
        const idx = j * nx + i;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = 0.0;
        positions[idx * 3 + 2] = z;
        uvs[idx * 2] = x * 0.05;
        uvs[idx * 2 + 1] = z * 0.05;

        if (x >= terrain.minX && x <= terrain.maxX && z >= terrain.minZ && z <= terrain.maxZ) {
          landHeights[idx] = terrain.sampleHeightAndNormal(x, z).y;
        } else {
          landHeights[idx] = -15.0;
        }
      }
    }

    const indices = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const i00 = j * nx + i;
        const i10 = i00 + 1;
        const i01 = i00 + nx;
        const i11 = i01 + 1;

        // Cull triangles strictly deep under the high inland peninsula (> 2.8m elevation at all 4 corners)
        if (
          landHeights[i00] > 2.8 &&
          landHeights[i10] > 2.8 &&
          landHeights[i01] > 2.8 &&
          landHeights[i11] > 2.8
        ) {
          continue;
        }

        indices.push(i00, i01, i10, i10, i01, i11);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.name = 'MediterraneanOceanMesh';
    mesh.frustumCulled = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 2;
    mesh.userData.auditRole = 'water';
    return mesh;
  }

  update(timeSeconds) {
    this.material.uniforms.uTime.value = timeSeconds;
  }
}
