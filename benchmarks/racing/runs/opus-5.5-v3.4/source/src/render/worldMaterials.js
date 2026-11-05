// World surface materials: asphalt (2K PBR + blend + markings + rubber + patches),
// shoulders/sidewalks, curbs, road skirts and the splatted terrain (texture arrays).
import * as THREE from 'three';
import { loadPBR, withRepeat, pbrMaterial, loadedTextures } from './textures.js';
import { curbTextures } from './texgen.js';
import { NOISE_GLSL } from './sky.js';

export async function buildWorldMaterials(world, renderer) {
  const T = world.track;
  const [asA, asB, sand, gravel, grassDry, forest, rock, rock2, concrete, paving, cobble, grass] = await Promise.all([
    loadPBR('Asphalt025C'), loadPBR('Asphalt026C'), loadPBR('Ground093C'), loadPBR('Ground079S'), loadPBR('Ground037'), loadPBR('Ground048'),
    loadPBR('Rocks011'), loadPBR('Rock030'), loadPBR('Concrete047A'), loadPBR('PavingStones128'), loadPBR('PavingStones070'), loadPBR('Grass004'),
  ]);
  const mats = {};
  mats.asphalt = asphaltMaterial(world, asA, asB);
  // shoulders per zone
  mats.shoulder = {
    1: blendShoulder(withRepeat(concrete, 1 / 2.2), withRepeat(sand, 1 / 3.5), 'shoulder-orla', 0.65),
    2: blendShoulder(withRepeat(gravel, 1 / 2.5), withRepeat(rock2, 1 / 4), 'shoulder-falesia', 0.35),
    3: sidewalkMaterial(withRepeat(paving, 1 / 2.0), withRepeat(concrete, 1 / 1.2)),
    4: blendShoulder(withRepeat(gravel, 1 / 2.5), withRepeat(forest, 1 / 3), 'shoulder-bosque', 0.55),
  };
  mats.skirt = pbrMaterial(withRepeat(gravel, 1 / 2.5), { name: 'road-skirt' });
  const ct = curbTextures();
  ct.map.repeat.set(1, 1 / 4.8); ct.normalMap.repeat.copy(ct.map.repeat); ct.orm.repeat.copy(ct.map.repeat);
  // curb uv: u across (0..1), v = s metres -> 4 blocks per 4.8 m
  mats.curb = new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normalMap, roughnessMap: ct.orm, roughness: 1, name: 'curb' });
  mats.curb.map.rotation = 0;
  mats.terrain = terrainMaterial(world, { sand, grassDry, rock, forest, gravel, grass, rock2 });
  mats.sets = { asA, asB, sand, gravel, grassDry, forest, rock, rock2, concrete, paving, cobble, grass };
  return mats;
}

function asphaltMaterial(world, A, B) {
  const T = world.track;
  const a = withRepeat(A, 1 / 6), b = withRepeat(B, 1 / 7.5);
  const m = new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normalMap, roughnessMap: a.orm, aoMap: a.orm, roughness: 1, metalness: 0, name: 'asphalt' });
  m.normalScale.set(0.9, 0.9);
  const f = T.features;
  const grid = [];
  for (let k = 0; k < f.gridSlots; k++) grid.push(T.wrap(f.startS - 9 - k * f.gridSpacing));
  m.userData.uniforms = {
    tB: { value: b.map }, tBn: { value: b.normalMap }, tBo: { value: b.orm },
    uStart: { value: f.startS }, uLen: { value: T.length }, uGrid: { value: grid }, uRubber: { value: 0.55 },
  };
  m.userData.programKey = 'asphalt';
  m.userData.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aRoad; varying vec4 vRoad; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = aRoad;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec4 vRoad; varying vec3 vWP;
      uniform sampler2D tB, tBn, tBo; uniform float uStart, uLen, uRubber; uniform float uGrid[6];
      ${NOISE_GLSL}
      float wrapD(float a, float b) { float d = a - b; d = mod(d + uLen * 0.5, uLen) - uLen * 0.5; return d; }
      float boxMask(vec2 p, vec2 c, vec2 hs, float soft) { vec2 q = abs(p - c) - hs; return 1.0 - smoothstep(-soft, soft, max(q.x, q.y)); }
      vec4 roadPaint;   // rgb, mask
      float roadRubber;
      float roadPatch;
      void computeRoad() {
        float s = vRoad.x, d = vRoad.y, hw = vRoad.z, line = vRoad.w;
        float ad = abs(d);
        float n1 = vnoise(vec2(s * 0.35, d * 1.7));
        float wear = smoothstep(0.35, 0.75, vnoise(vec2(s * 1.3, d * 3.1)) * 0.7 + n1 * 0.5);
        // edge lines (solid) and centre dashes
        float edge = (1.0 - smoothstep(0.0, 0.02, abs(ad - (hw - 0.36)) - 0.065));
        float dash = (1.0 - smoothstep(0.0, 0.015, ad - 0.065)) * step(fract(s / 9.0), 0.36);
        float paint = max(edge, dash) * (1.0 - wear * 0.55);
        // start / finish checkered band
        float ds = wrapD(s, uStart);
        float chk = step(abs(ds), 0.8) * step(ad, hw - 0.2);
        float cpat = mod(floor(ds / 0.8 + 10.0) + floor((d + 20.0) / 0.8), 2.0);
        // grid boxes
        float gridm = 0.0;
        for (int k = 0; k < 6; k++) {
          float gs = wrapD(s, uGrid[k]);
          float lat = (mod(float(k), 2.0) < 0.5 ? -2.6 : 2.6);
          vec2 p = vec2(d - lat, gs);
          float front = boxMask(p, vec2(0.0, 1.6), vec2(1.25, 0.06), 0.01);
          float sideL = boxMask(p, vec2(-1.25, 0.95), vec2(0.06, 0.7), 0.01);
          float sideR = boxMask(p, vec2(1.25, 0.95), vec2(0.06, 0.7), 0.01);
          gridm = max(gridm, max(front, max(sideL, sideR)));
        }
        roadPaint = vec4(vec3(0.82, 0.8, 0.74), paint);
        roadPaint.a = max(roadPaint.a, gridm * (1.0 - wear * 0.4));
        if (chk > 0.5) { roadPaint = vec4(mix(vec3(0.05), vec3(0.85, 0.84, 0.8), cpat), 0.95); }
        // rubber on the racing line (two tyre tracks)
        float tr = exp(-pow((d - line - 0.8) / 0.45, 2.0)) + exp(-pow((d - line + 0.8) / 0.45, 2.0));
        roadRubber = clamp(tr * uRubber * (0.6 + 0.4 * vnoise(vec2(s * 0.08, 0.0))), 0.0, 1.0);
        // repair patches (second asphalt)
        float cell = floor(s / 23.0);
        float r = hash12(vec2(cell, 7.0));
        float pc = cell * 23.0 + 4.0 + r * 14.0;
        float pl = 2.0 + hash12(vec2(cell, 3.0)) * 4.0;
        float pd = (hash12(vec2(cell, 9.0)) - 0.5) * (hw * 1.2);
        float pw = 0.8 + hash12(vec2(cell, 5.0)) * 1.8;
        roadPatch = step(0.45, r) * boxMask(vec2(d, s), vec2(pd, pc), vec2(pw, pl), 0.08);
      }`)
      .replace('#include <map_fragment>', `computeRoad();
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        vec2 bUv = vec2(vMapUv.x * 0.83 + 0.37, vMapUv.y * 0.8);
        vec3 colB = texture2D(tB, bUv).rgb;
        float macro = vnoise(vWP.xz * 0.045) * 0.6 + vnoise(vWP.xz * 0.009) * 0.4;
        float blendB = smoothstep(0.55, 0.8, macro + 0.15 * vnoise(vWP.xz * 0.35));
        blendB = max(blendB * 0.65, roadPatch);
        vec3 col = mix(sampledDiffuseColor.rgb, colB * vec3(0.92, 0.9, 0.88), blendB);
        col *= 0.86 + 0.28 * macro;
        // worn, dusty edges (sand blown in near the edge)
        float edgeW = smoothstep(vRoad.z - 1.0, vRoad.z + 0.05, abs(vRoad.y));
        col = mix(col, col * vec3(1.18, 1.1, 0.96) + vec3(0.05, 0.04, 0.02), edgeW * 0.55);
        col *= 1.0 - roadRubber * 0.32;
        col = mix(col, roadPaint.rgb, roadPaint.a);
        diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
        vec4 texelRoughness = texture2D(roughnessMap, vRoughnessMapUv);
        roughnessFactor *= mix(texelRoughness.g, texture2D(tBo, vec2(vRoughnessMapUv.x * 0.83 + 0.37, vRoughnessMapUv.y * 0.8)).g, roadPatch);
        roughnessFactor = mix(roughnessFactor, 0.55, roadPaint.a * 0.7);
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.78, roadRubber);`)
      .replace('#include <normal_fragment_maps>', `vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
        vec3 mapNB = texture2D(tBn, vec2(vNormalMapUv.x * 0.83 + 0.37, vNormalMapUv.y * 0.8)).xyz * 2.0 - 1.0;
        mapN = normalize(mix(mapN, mapNB, roadPatch));
        mapN.xy *= normalScale * (1.0 - roadPaint.a * 0.6);
        normal = normalize(tbn * mapN);`);
  };
  return m;
}

function blendShoulder(A, B, name, amount) {
  const m = new THREE.MeshStandardMaterial({ map: A.map, normalMap: A.normalMap, roughnessMap: A.orm, aoMap: A.orm, roughness: 1, name });
  m.userData.uniforms = { tB: { value: B.map }, tBn: { value: B.normalMap }, uAmt: { value: amount } };
  m.userData.programKey = 'shoulder-blend';
  m.userData.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D tB, tBn; uniform float uAmt; varying vec3 vWP2;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        float bw = smoothstep(0.3, 0.7, vnoise(vWP2.xz * 0.25) * 0.7 + vnoise(vWP2.xz * 1.3) * 0.3 + (uAmt - 0.5));
        vec3 cb = texture2D(tB, vMapUv * 0.73 + 0.11).rgb;
        diffuseColor.rgb *= mix(sampledDiffuseColor.rgb, cb, bw) * (0.9 + 0.2 * vnoise(vWP2.xz * 0.05));`)
      .replace('#include <normal_fragment_maps>', `vec3 mapN = mix(texture2D(normalMap, vNormalMapUv).xyz, texture2D(tBn, vNormalMapUv * 0.73 + 0.11).xyz, 0.5) * 2.0 - 1.0;
        mapN.xy *= normalScale; normal = normalize(tbn * mapN);`);
  };
  return m;
}

function sidewalkMaterial(P, C) {
  // uv.x = lateral metres: curb band (|d| in [hw, hw+0.25]) uses concrete, rest paving slabs
  const m = new THREE.MeshStandardMaterial({ map: P.map, normalMap: P.normalMap, roughnessMap: P.orm, aoMap: P.orm, roughness: 1, name: 'sidewalk' });
  m.userData.uniforms = { tC: { value: C.map }, tCn: { value: C.normalMap } };
  m.userData.programKey = 'sidewalk';
  m.userData.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP3;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP3 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D tC, tCn; varying vec3 vWP3;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        float curbBand = 1.0 - smoothstep(0.0, 0.05, abs(vNormal.y) - 0.6);
        diffuseColor.rgb *= sampledDiffuseColor.rgb * (0.88 + 0.24 * vnoise(vWP3.xz * 0.12));`);
  };
  return m;
}

// ---------------- terrain ----------------
const LAYERS = ['sand', 'grassDry', 'rock', 'forest', 'gravel', 'grass', 'rock2'];
const TILE = [4.5, 6.0, 9.0, 4.0, 3.0, 4.0, 7.0];

function packArray(sets, key, size) {
  const n = LAYERS.length;
  const data = new Uint8Array(size * size * 4 * n);
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  for (let i = 0; i < n; i++) {
    const s = sets[LAYERS[i]];
    if (key === 'albedo') {
      ctx.drawImage(s.map.image, 0, 0, size, size); const a = ctx.getImageData(0, 0, size, size).data;
      ctx.drawImage(s.orm.image, 0, 0, size, size); const o = ctx.getImageData(0, 0, size, size).data;
      for (let p = 0; p < size * size; p++) { const d = (i * size * size + p) * 4; data[d] = a[p * 4]; data[d + 1] = a[p * 4 + 1]; data[d + 2] = a[p * 4 + 2]; data[d + 3] = o[p * 4 + 1]; }
    } else {
      ctx.drawImage(s.normalMap.image, 0, 0, size, size); const nn = ctx.getImageData(0, 0, size, size).data;
      ctx.drawImage(s.orm.image, 0, 0, size, size); const o = ctx.getImageData(0, 0, size, size).data;
      for (let p = 0; p < size * size; p++) { const d = (i * size * size + p) * 4; data[d] = nn[p * 4]; data[d + 1] = nn[p * 4 + 1]; data[d + 2] = o[p * 4]; data[d + 3] = 255; }
    }
  }
  const t = new THREE.DataArrayTexture(data, size, size, n);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.colorSpace = key === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  t.userData.src = 'terrain-array-' + key + ' (' + LAYERS.map((l) => sets[l].id).join(',') + ')';
  t.userData.size = size;
  loadedTextures.add(t);
  return t;
}

function terrainMaterial(world, sets) {
  const tr = world.terrain;
  const albedo = packArray(sets, 'albedo', 1024), normal = packArray(sets, 'normal', 1024);
  if (!tr.splatA) tr.computeSplat();
  const mk = (d) => { const t = new THREE.DataTexture(d, tr.splatW, tr.splatH, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; t.userData.src = 'terrain-splat'; return t; };
  const splat = { a: mk(tr.splatA), b: mk(tr.splatB) };
  // the material keeps the dry-grass set as nominal albedo/normal map (auditable), the shader samples the arrays
  const m = new THREE.MeshStandardMaterial({ map: sets.grassDry.map, normalMap: sets.grassDry.normalMap, roughness: 1, metalness: 0, name: 'terrain' });
  m.userData.uniforms = {
    tAlb: { value: albedo }, tNrm: { value: normal }, tSplatA: { value: splat.a }, tSplatB: { value: splat.b },
    uTerr: { value: new THREE.Vector4(tr.x0, tr.z0, tr.x1 - tr.x0, tr.z1 - tr.z0) }, uTime: { value: 0 },
    uTile: { value: TILE.map((t) => 1 / t) },
  };
  m.userData.programKey = 'terrain';
  m.userData.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vTN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      precision highp sampler2DArray;
      uniform sampler2DArray tAlb, tNrm; uniform sampler2D tSplatA, tSplatB; uniform vec4 uTerr; uniform float uTime; uniform float uTile[7];
      varying vec3 vTW; varying vec3 vTN;
      ${NOISE_GLSL}
      vec4 tAcc; vec3 tNAcc; float tAO; float tWet;
      vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * p; }
      void terrainSample() {
        vec2 suv = (vTW.xz - uTerr.xy) / uTerr.zw;
        vec4 wa = texture2D(tSplatA, suv), wb = texture2D(tSplatB, suv);
        float w[7]; w[0] = wa.r; w[1] = wa.g; w[2] = wa.b; w[3] = wa.a; w[4] = wb.r; w[5] = wb.g; w[6] = wb.b;
        vec3 N = normalize(vTN);
        float macro = vnoise(vTW.xz * 0.012) * 0.6 + vnoise(vTW.xz * 0.06) * 0.4;
        float total = 0.0; vec4 acc = vec4(0.0); vec3 nacc = vec3(0.0); float ao = 0.0;
        vec2 dX = dFdx(vTW.xz), dY = dFdy(vTW.xz);
        vec2 dXs = abs(N.x) > abs(N.z) ? dFdx(vTW.zy) : dFdx(vTW.xy);
        vec2 dYs = abs(N.x) > abs(N.z) ? dFdy(vTW.zy) : dFdy(vTW.xy);
        vec2 uvSide = abs(N.x) > abs(N.z) ? vTW.zy : vTW.xy;
        float kSteep = smoothstep(0.8, 0.45, N.y);
        for (int i = 0; i < 7; i++) {
          float wi = w[i];
          if (wi > 0.01) {
            float sc = uTile[i];
            float L = float(i);
            vec2 uv1 = vTW.xz * sc;
            vec2 uv2 = rot(vTW.xz, 0.7) * sc * 0.31 + 0.37;
            vec4 a1 = textureGrad(tAlb, vec3(uv1, L), dX * sc, dY * sc);
            vec4 n1 = textureGrad(tNrm, vec3(uv1, L), dX * sc, dY * sc);
            vec4 a2 = textureGrad(tAlb, vec3(uv2, L), rot(dX, 0.7) * sc * 0.31, rot(dY, 0.7) * sc * 0.31);
            vec4 n2 = textureGrad(tNrm, vec3(uv2, L), rot(dX, 0.7) * sc * 0.31, rot(dY, 0.7) * sc * 0.31);
            if ((i == 2 || i == 6) && kSteep > 0.0) {
              vec4 aS = textureGrad(tAlb, vec3(uvSide * sc, L), dXs * sc, dYs * sc);
              vec4 nS = textureGrad(tNrm, vec3(uvSide * sc, L), dXs * sc, dYs * sc);
              a1 = mix(a1, aS, kSteep); n1 = mix(n1, nS, kSteep); a2 = mix(a2, aS, kSteep); n2 = mix(n2, nS, kSteep);
            }
            float bl = 0.35 + 0.3 * macro;
            vec4 a = mix(a1, a2, bl * 0.5);
            vec4 n = mix(n1, n2, bl * 0.5);
            float hgt = dot(a.rgb, vec3(0.33));
            float ww = pow(wi * (0.4 + hgt * 1.6), 2.2);
            acc += a * ww; nacc += (n.xyz * 2.0 - 1.0) * ww; ao += n.z * ww; total += ww;
          }
        }
        acc /= max(total, 1e-4); nacc /= max(total, 1e-4); ao /= max(total, 1e-4);
        acc.rgb *= 0.82 + 0.36 * macro;
        // wet sand band + swash near the waterline
        float swash = 0.32 + 0.22 * sin(uTime * 0.45 + vTW.x * 0.03 + vnoise(vTW.xz * 0.05) * 6.0);
        tWet = (1.0 - smoothstep(swash, swash + 0.5, vTW.y)) * smoothstep(-3.0, -0.2, vTW.y) * (w[0] > 0.2 ? 1.0 : 0.35);
        // wet sand: darker and satin (a mirror-like 0.2 roughness turned the HDRI clouds into blotches)
        acc.rgb *= 1.0 - tWet * 0.5; acc.a = mix(acc.a, 0.42, tWet);
        // underwater: darker, slightly blue
        acc.rgb *= mix(vec3(1.0), vec3(0.6, 0.75, 0.78), smoothstep(0.0, -2.0, vTW.y));
        tAcc = acc; tNAcc = nacc; tAO = ao;
      }`)
      .replace('#include <map_fragment>', 'terrainSample(); diffuseColor.rgb *= tAcc.rgb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * tAcc.a;')
      .replace('#include <normal_fragment_maps>', `{
        vec3 Nw = normalize(vTN);
        vec3 Tw = normalize(vec3(1.0, 0.0, 0.0) - Nw * Nw.x);
        vec3 Bw = normalize(cross(Nw, Tw));
        vec2 nxy = tNAcc.xy * (1.0 - tWet * 0.6);
        vec3 nt = vec3(nxy, sqrt(max(0.05, 1.0 - dot(nxy, nxy))));
        vec3 nw = normalize(Tw * nt.x - Bw * nt.y + Nw * nt.z);
        normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
      }`)
      .replace('#include <aomap_fragment>', `{ float ambientOcclusion = mix(1.0, tAO, 0.8);
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        #if defined( USE_ENVMAP ) && defined( STANDARD )
          float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
          reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
        #endif
      }`);
  };
  return m;
}
