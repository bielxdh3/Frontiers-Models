// GLSL snippets patched into MeshStandardMaterial (via onBeforeCompile) for terrain, road, kerbs and sea.
// All ground surfaces are PBR (albedo + normal + roughness/AO from CC0 texture arrays) with anti-tiling.

export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + 9.3; a *= 0.5; } return s / 0.875; }
`;

// ------------------------------------------------------------------------------------------------ TERRAIN
export const TERRAIN = {
  vertHeader: /* glsl */`
attribute vec4 aInfo;
varying vec4 vInfo; varying vec3 vWPos; varying vec3 vWNor;
`,
  vertBody: /* glsl */`
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNor = normalize(mat3(modelMatrix) * objectNormal);
vInfo = aInfo;
`,
  fragHeader: /* glsl */`
uniform sampler2DArray tD; uniform sampler2DArray tN; uniform sampler2DArray tA;
uniform float uTime;
varying vec4 vInfo; varying vec3 vWPos; varying vec3 vWNor;
vec3 gNW; float gRough; float gAO;
${GLSL_NOISE}
// one layer with anti-tiling (two scales); nt = tangent-space normal, ra = (ao, roughness)
vec3 lay(float L, vec2 p, float sc, out vec3 nt, out vec2 ra) {
  vec2 a = p / sc, b = p / (sc * 3.17) + vec2(0.37, 0.61);
  float m = vnoise(p * 0.045);
  vec3 c1 = texture(tD, vec3(a, L)).rgb;
  vec3 c2 = texture(tD, vec3(b, L)).rgb;
  float l1 = dot(c1, vec3(0.333)), l2 = max(dot(c2, vec3(0.333)), 0.03);
  vec3 c = mix(c1, c2 * (l1 / l2), 0.25 + 0.35 * m);
  nt = texture(tN, vec3(a, L)).xyz * 2.0 - 1.0;
  vec3 arm = texture(tA, vec3(a, L)).rgb;
  ra = arm.rg;
  return c;
}
// tri-planar rock (steep faces): projections on X, Z and top
vec3 rockTri(float L, vec3 P, vec3 N, float sc, out vec3 nW, out vec2 ra) {
  vec3 w = pow(abs(N), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 ntx, nty, ntz; vec2 rx, ry, rz;
  vec3 cx = lay(L, P.zy, sc, ntx, rx);
  vec3 cy = lay(L, P.xz, sc, nty, ry);
  vec3 cz = lay(L, P.xy, sc, ntz, rz);
  // world-space normal perturbations (whiteout style)
  vec3 nx = vec3(0.0, ntx.y, ntx.x) * sign(N.x), ny = vec3(nty.x, 0.0, nty.y), nz = vec3(ntz.x, ntz.y, 0.0) * sign(N.z);
  nW = normalize(N + (nx * w.x + ny * w.y + nz * w.z) * 0.9);
  ra = rx * w.x + ry * w.y + rz * w.z;
  return cx * w.x + cy * w.y + cz * w.z;
}
`,
  fragMap: /* glsl */`
{
  vec3 N = normalize(vWNor);
  vec3 P = vWPos;
  float slope = 1.0 - N.y;
  float nMacro = fbm2(P.xz * 0.011);
  float nMid = fbm2(P.xz * 0.055 + 7.0);
  float nFine = vnoise(P.xz * 0.9);
  float zone = floor(vInfo.y + 0.25);
  float cut = vInfo.z;
  float dRoad = vInfo.x * 90.0;                       // metres from the corridor edge

  float wRock = smoothstep(0.24, 0.44, slope + (nMid - 0.5) * 0.10);
  wRock = max(wRock, smoothstep(0.12, 0.5, cut) * 0.9);
  float swash = 0.50 + 0.20 * sin(uTime * 0.55 + P.x * 0.021) + 0.10 * sin(uTime * 1.21 + P.x * 0.083 + 1.7);
  float hW = P.y + (nMid - 0.5) * 0.16;
  float wWet = smoothstep(swash + 0.10, swash - 0.14, hW);
  float wBeach = (1.0 - smoothstep(2.3, 3.5, P.y + (nMacro - 0.5) * 1.6)) * (1.0 - wRock);
  float rem = 1.0 - wRock;
  float wS = wBeach;
  float rem2 = max(rem - wS, 0.0);
  float wGv = (1.0 - smoothstep(0.0, 5.5, dRoad + nMid * 4.0)) * rem2 * 0.85;
  float rem3 = max(rem2 - wGv, 0.0);
  float wLit = smoothstep(0.38, 0.72, nMacro + (zone > 2.5 ? 0.28 : -0.22) + clamp((P.y - 8.0) / 90.0, -0.2, 0.25)) * rem3;
  float wGr = smoothstep(0.10, 0.42, nMid + (zone > 1.5 && zone < 2.5 ? 0.30 : 0.14)) * (rem3 - wLit);
  float wDt = max(rem3 - wLit - wGr, 0.0) * 0.45;

  vec3 col = vec3(0.0), nt = vec3(0.0, 0.0, 1.0), ntb; vec2 ra, rab; float rough = 0.0, ao = 0.0;
  vec3 nAcc = vec3(0.0); float rAcc = 0.0, aAcc = 0.0;
  vec3 c; vec3 nWr = N;
  if (wS > 0.01) {
    c = lay(0.0, P.xz, 5.5, nt, ra);
    vec3 cw = lay(1.0, P.xz, 5.0, ntb, rab);
    c = mix(c, cw * 0.72, wWet);
    nt = mix(nt, ntb, wWet); ra = mix(ra, vec2(ra.x, 0.16), wWet);
    c *= vec3(1.06, 0.97, 0.80);
    col += c * wS; nAcc += nt * wS; rAcc += ra.y * wS; aAcc += ra.x * wS;
  }
  if (wGv > 0.01) { c = lay(7.0, P.xz, 3.2, nt, ra); col += c * wGv; nAcc += nt * wGv; rAcc += ra.y * wGv; aAcc += ra.x * wGv; }
  if (wLit > 0.01) { c = lay(4.0, P.xz, 3.4, nt, ra); col += c * wLit; nAcc += nt * wLit; rAcc += ra.y * wLit; aAcc += ra.x * wLit; }
  if (wGr > 0.01) { c = lay(2.0, P.xz, 3.8, nt, ra) * vec3(0.96, 1.06, 0.66); col += c * wGr; nAcc += nt * wGr; rAcc += ra.y * wGr; aAcc += ra.x * wGr; }
  if (wDt > 0.01) { c = lay(3.0, P.xz, 4.4, nt, ra) * vec3(0.86, 0.84, 0.78); col += c * wDt; nAcc += nt * wDt; rAcc += ra.y * wDt; aAcc += ra.x * wDt; }
  float wPlanar = max(1.0 - wRock, 0.0001);
  vec3 ntP = nAcc / max(wS + wGv + wLit + wGr + wDt, 0.0001);
  vec3 nWP = normalize(N + vec3(ntP.x, 0.0, ntP.y) * 0.85);
  float rP = rAcc / max(wS + wGv + wLit + wGr + wDt, 0.0001), aP = aAcc / max(wS + wGv + wLit + wGr + wDt, 0.0001);
  vec3 cP = col / max(wS + wGv + wLit + wGr + wDt, 0.0001);
  // rock
  vec3 cR = cP; vec2 raR = vec2(aP, rP);
  if (wRock > 0.01) {
    vec3 cA = rockTri(5.0, P, N, 7.0, nWr, raR);
    vec3 nWr2; vec2 raR2;
    vec3 cB = rockTri(6.0, P + vec3(31.0, 5.0, 12.0), N, 6.0, nWr2, raR2);
    float mb = smoothstep(0.35, 0.65, fbm3(P.xz * 0.05 + P.y * 0.02));
    cR = mix(cA, cB, mb); nWr = normalize(mix(nWr, nWr2, mb)); raR = mix(raR, raR2, mb);
    cR *= vec3(1.0, 0.93, 0.84);
  }
  vec3 albedo = mix(cP, cR, wRock);
  gNW = normalize(mix(nWP, nWr, wRock));
  gRough = mix(rP, raR.y, wRock);
  gAO = mix(aP, raR.x, wRock);
  // macro colour variation so no area reads as one flat tone
  albedo *= 0.80 + 0.40 * nMacro;
  albedo *= 0.92 + 0.16 * nFine;
  albedo = mix(vec3(dot(albedo, vec3(0.2126, 0.7152, 0.0722))), albedo, 0.80);          // calmer palette: less 'orange desert'
  // sea-floor tint
  albedo = mix(albedo, albedo * vec3(0.55, 0.72, 0.78), smoothstep(0.0, -1.5, P.y));
  diffuseColor.rgb *= albedo * mix(1.0, gAO, 0.55);
}
`,
  fragRough: /* glsl */`
float roughnessFactor = clamp(gRough * 1.05, 0.18, 1.0);
`,
  fragNormal: /* glsl */`
normal = normalize((viewMatrix * vec4(gNW, 0.0)).xyz);
`,
};

// ------------------------------------------------------------------------------------------------ ROAD
export const ROAD = {
  vertHeader: /* glsl */`
attribute vec4 aRoad; attribute vec4 aRoad2;
varying vec4 vR1; varying vec4 vR2; varying vec3 vWPos; varying vec3 vWNor;
`,
  vertBody: /* glsl */`
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNor = normalize(mat3(modelMatrix) * objectNormal);
vR1 = aRoad; vR2 = aRoad2;
`,
  fragHeader: /* glsl */`
uniform sampler2DArray rD; uniform sampler2DArray rN; uniform sampler2DArray rA;
uniform sampler2DArray tD; uniform sampler2DArray tN; uniform sampler2DArray tA;
uniform sampler2D tLine; uniform float uLen; uniform float uTime;
varying vec4 vR1; varying vec4 vR2; varying vec3 vWPos; varying vec3 vWNor;
vec3 gNT; float gRough; float gAO; float gSpec;
${GLSL_NOISE}
vec3 layT(float L, vec2 p, float sc, out vec3 nt, out vec2 ra) {
  vec2 a = p / sc, b = p / (sc * 3.17) + vec2(0.37, 0.61);
  float m = vnoise(p * 0.045);
  vec3 c1 = texture(tD, vec3(a, L)).rgb;
  vec3 c2 = texture(tD, vec3(b, L)).rgb;
  vec3 c = mix(c1, c2 * (dot(c1, vec3(0.333)) / max(dot(c2, vec3(0.333)), 0.03)), 0.25 + 0.35 * m);
  nt = texture(tN, vec3(a, L)).xyz * 2.0 - 1.0;
  ra = texture(tA, vec3(a, L)).rg;
  return c;
}
float gridBox(float s, float lat) {
  // three rows of two slots behind the start line (d = metres before the line)
  float d = uLen - s;
  float m = 0.0;
  if (d > 0.0 && d < 48.0) {
    for (int r = 0; r < 3; r++) {
      float rowD = 9.0 + float(r) * 11.5;
      for (int k = 0; k < 2; k++) {
        float lc = (k == 0 ? -1.0 : 1.0) * 2.9;
        float dx = abs(lat - lc), dd = d - rowD;
        // front bar + two side ticks + back tick
        if (dd > -0.06 && dd < 0.14 && dx < 1.15) m = 1.0;
        if (dd > -0.06 && dd < 1.4 && dx > 1.05 && dx < 1.2) m = 1.0;
        if (dd > 4.7 && dd < 4.85 && dx < 0.35) m = 1.0;
      }
    }
  }
  return m;
}
`,
  fragMap: /* glsl */`
{
  float lat = vR1.x, s = vR1.y; float zone = floor(vR1.z + 0.5);
  float hw = vR2.x; float bridge = vR2.y;
  float al = abs(lat);
  vec2 P = vWPos.xz;
  float nMid = fbm2(vec2(s * 0.09, lat * 0.35));
  float nBig = fbm2(vec2(s * 0.012, lat * 0.05) + 3.0);
  float nFine = vnoise(vec2(s, lat) * 3.0);
  float edge = hw + (nMid - 0.5) * 0.35;
  float wA = 1.0 - smoothstep(edge - 0.05, edge + 0.22, al);        // asphalt mask with a worn, uneven edge
  // ---- asphalt: two 2k sets blended by large patches + scaled twice against repetition
  vec2 uvA = vec2(lat, s) / 8.0;
  vec2 uvB = vec2(lat * 0.78 - s * 0.35, s * 0.82 + lat * 0.31) / 19.0 + 0.5;
  float mixP = smoothstep(0.42, 0.62, nBig);
  vec3 a0 = texture(rD, vec3(uvA, 0.0)).rgb, a1 = texture(rD, vec3(uvB, 0.0)).rgb;
  vec3 b0 = texture(rD, vec3(uvA * 1.13 + 0.31, 1.0)).rgb, b1 = texture(rD, vec3(uvB * 0.9, 1.0)).rgb;
  vec3 asphA = mix(a0, a1 * (dot(a0, vec3(0.333)) / max(dot(a1, vec3(0.333)), 0.02)), 0.3 + 0.3 * nMid);
  vec3 asphB = mix(b0, b1, 0.35);
  vec3 asph = mix(asphA, asphB * 1.15, mixP * 0.55);
  vec3 ntA = texture(rN, vec3(uvA, 0.0)).xyz * 2.0 - 1.0;
  vec3 ntB = texture(rN, vec3(uvA * 1.13 + 0.31, 1.0)).xyz * 2.0 - 1.0;
  vec3 ntR = normalize(mix(ntA, ntB, mixP * 0.55));
  float rAsph = texture(rA, vec3(uvA, 0.0)).g;
  // ---- racing line rubber + wear (offset comes from a 1-D data texture along the lap)
  vec4 L = texture2D(tLine, vec2(fract(s / uLen), 0.5));
  float off = (L.r - 0.5) * 16.0;
  float tr1 = exp(-pow((lat - off - 0.85) / 0.42, 2.0)), tr2 = exp(-pow((lat - off + 0.85) / 0.42, 2.0));
  float rubber = clamp(max(tr1, tr2) * (0.35 + 0.65 * L.b) * (0.55 + 0.6 * nFine), 0.0, 1.0);
  float polish = exp(-pow((lat - off) / 2.4, 2.0)) * 0.5;
  // oil / patches
  float stain = smoothstep(0.62, 0.78, fbm2(vec2(s * 0.21, lat * 0.9) + 11.0)) * 0.45;
  asph *= (1.0 - rubber * 0.38) * (1.0 - stain) * (0.88 + 0.24 * nBig);
  float rough = mix(rAsph, 0.55, rubber * 0.7 + polish * 0.35);
  // ---- paint
  float paint = 0.0; vec3 paintCol = vec3(0.92, 0.92, 0.90);
  float eL = smoothstep(0.10, 0.04, abs(al - (hw - 0.40)));
  paint = max(paint, eL * step(0.5, 1.0 - bridge * 0.0));
  if (zone > 0.5) {                                              // centre dashes everywhere but the beach straight
    float dash = step(mod(s, 9.0), 3.2);
    paint = max(paint, smoothstep(0.11, 0.06, abs(lat)) * dash);
    paintCol = mix(paintCol, vec3(0.98, 0.82, 0.25), 0.0);
  }
  // start / finish line (chequered) and grid boxes
  float sl = step(0.0, s) * step(s, 1.2);
  float chk = mod(floor((lat + hw) / 0.6) + floor(s / 0.6), 2.0);
  float startLine = sl * step(al, hw - 0.3);
  paint = max(paint, gridBox(s, lat));
  float wear = 0.55 + 0.45 * smoothstep(0.35, 0.7, vnoise(vec2(s * 1.7, lat * 2.3)));      // chipped paint
  vec3 asphP = mix(asph, paintCol * 0.85, clamp(paint * wear, 0.0, 1.0) * wA);
  asphP = mix(asphP, vec3(mix(0.04, 0.9, chk)), startLine);
  rough = mix(rough, 0.6, clamp(paint, 0.0, 1.0) + startLine);
  // ---- shoulder by zone
  vec3 nts; vec2 ras; vec3 sh;
  float szone = zone;
  if (bridge > 0.5) szone = 3.0;
  if (szone < 0.5) { sh = layT(0.0, P, 5.0, nts, ras) * vec3(1.06, 0.97, 0.82); vec3 g2 = layT(7.0, P, 3.0, nts, ras); sh = mix(sh, g2 * 0.9, smoothstep(0.5, 0.8, nMid) * 0.6); }
  else if (szone < 1.5) { sh = layT(7.0, P, 3.0, nts, ras); }
  else if (szone < 2.5) { sh = layT(8.0, P, 2.2, nts, ras) * 1.15; }
  else { sh = layT(3.0, P, 4.0, nts, ras); }
  float shRough = ras.y;
  // sand / dust drifting on the asphalt near the edges
  float dust = smoothstep(hw - 1.6, hw + 0.2, al) * smoothstep(0.40, 0.75, nMid) * (zone < 0.5 ? 0.55 : 0.18);
  vec3 asphD = mix(asphP, sh * 0.9, dust * wA * (1.0 - paint));
  vec3 albedo = mix(sh, asphD, wA);
  gNT = normalize(mix(nts, ntR, wA));
  gRough = mix(shRough, rough, wA);
  gAO = 1.0;
  diffuseColor.rgb *= albedo;
}
`,
  fragRough: /* glsl */`
float roughnessFactor = clamp(gRough, 0.2, 1.0);
`,
  fragNormal: /* glsl */`
{
  // tangent frame from the (banked) surface: T along +lat is derived from screen-space derivatives of the world position
  vec3 Nw = normalize(vWNor);
  vec3 dpdx = dFdx(vWPos), dpdy = dFdy(vWPos);
  vec2 dux = dFdx(vR1.xy), duy = dFdy(vR1.xy);       // (lat, s) derivatives
  float det = dux.x * duy.y - dux.y * duy.x;
  vec3 Tw = normalize((dpdx * duy.y - dpdy * dux.y) * (det < 0.0 ? -1.0 : 1.0));   // direction of increasing lat
  Tw = normalize(Tw - Nw * dot(Nw, Tw));
  vec3 Bw = normalize(cross(Nw, Tw));
  vec3 nW = normalize(Tw * gNT.x * 0.9 + Bw * gNT.y * 0.9 + Nw * gNT.z);
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}
`,
};

// ------------------------------------------------------------------------------------------------ KERB (zebra)
export const KERB = {
  vertHeader: /* glsl */`attribute vec4 aRoad; varying vec4 vR1;`,
  vertBody: /* glsl */`vR1 = aRoad;`,
  fragHeader: /* glsl */`varying vec4 vR1;
${GLSL_NOISE}`,
  fragMap: /* glsl */`
{
  float s = vR1.y;
  float stripe = mod(floor(s / 1.4), 2.0);
  float wornN = fbm2(vec2(s * 0.8, vR1.x * 2.0));
  vec3 red = vec3(0.62, 0.06, 0.05), white = vec3(0.86, 0.85, 0.80);
  vec3 c = mix(white, red, stripe);
  c *= 0.75 + 0.35 * wornN;
  c = mix(c, vec3(0.35, 0.33, 0.30), smoothstep(0.55, 0.85, wornN) * 0.5);   // dirt / rubber
  diffuseColor.rgb *= c;
}
`,
};

// ------------------------------------------------------------------------------------------------ BUILD (houses, walls, guardrail posts, church, bridge...)
// Texture-array PBR; layer comes from a per-vertex id (aMat; -1 = per-instance plaster); UVs are in metres.
export const BUILD_LAYERS = ['painted_plaster_wall', 'yellow_plaster', 'red_plaster_weathered', 'blue_plaster_weathered', 'clay_roof_tiles_03', 'clay_roof_tiles_02', 'stone_wall', 'rustic_stone_wall', 'concrete_wall_007', 'wood_shutter', 'wooden_planks', 'pine_bark', 'palm_tree_bark', 'bark_brown_02', 'cobblestone_floor_01', 'seaside_rock', 'dry_ground_rocks'];
export const BUILD_ID = Object.fromEntries(BUILD_LAYERS.map((n, i) => [n, i]));
export const BUILD = {
  vertHeader: /* glsl */`
attribute float aMat; attribute vec4 aInst;
#ifdef USE_INSTANCING
  attribute vec4 aInstP;
#endif
varying float vLayer; varying vec4 vInst; varying vec2 vUvM; varying vec3 vWPos; varying vec3 vWNor;
`,
  vertBody: /* glsl */`
vLayer = aMat; vUvM = uv;
vec4 wp_ = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp_ = instanceMatrix * wp_;
  vInst = aInstP;
#else
  vInst = aInst;
#endif
vWPos = (modelMatrix * wp_).xyz;
vWNor = normalize(mat3(modelMatrix) * objectNormal);
`,
  fragHeader: /* glsl */`
uniform sampler2DArray bD; uniform sampler2DArray bN; uniform sampler2DArray bA; uniform float uTime;
varying float vLayer; varying vec4 vInst; varying vec2 vUvM; varying vec3 vWPos; varying vec3 vWNor;
vec3 gBN; float gBR; float gBAO;
${GLSL_NOISE}
float tileOf(float L) {
  if (L < 3.5) return 3.2;            // plaster
  if (L < 5.5) return 1.1;            // roof tiles
  if (L < 7.5) return 2.4;            // stone
  if (L < 8.5) return 3.0;            // concrete
  if (L < 10.5) return 1.4;           // wood
  if (L < 13.5) return 1.3;           // bark
  if (L < 14.5) return 1.6;           // cobble
  return 2.6;                         // rock
}
`,
  fragMap: /* glsl */`
{
  float L = vLayer < -0.5 ? floor(vInst.x + 0.5) : floor(vLayer + 0.5);
  float sc = tileOf(L);
  vec2 uv = vUvM / sc;
  vec2 uv2 = vUvM / (sc * 2.9) + vec2(0.31, 0.57);
  vec3 c1 = texture(bD, vec3(uv, L)).rgb, c2 = texture(bD, vec3(uv2, L)).rgb;
  vec3 c = mix(c1, c2 * (dot(c1, vec3(0.333)) / max(dot(c2, vec3(0.333)), 0.03)), 0.35);
  vec3 arm = texture(bA, vec3(uv, L)).rgb;
  gBR = arm.g; gBAO = arm.r;
  float n1 = fbm2(vWPos.xz * 0.35 + vWPos.y * 0.2);
  float dirt = smoothstep(0.45, 0.8, fbm2(vWPos.xz * 1.7 + vWPos.y * 2.0)) * (1.0 - smoothstep(0.0, 1.6, vWPos.y - vInst.w));
  c *= (0.86 + 0.28 * n1);
  c = mix(c, c * vec3(0.55, 0.5, 0.45), dirt * 0.5);
  diffuseColor.rgb *= c * mix(1.0, gBAO, 0.6);
}
`,
  fragRough: /* glsl */`float roughnessFactor = clamp(gBR * 1.05, 0.25, 1.0);`,
  fragNormal: /* glsl */`
{
  float L = vLayer < -0.5 ? floor(vInst.x + 0.5) : floor(vLayer + 0.5);
  vec2 uv = vUvM / tileOf(L);
  vec3 mapN = texture(bN, vec3(uv, L)).xyz * 2.0 - 1.0;
  mapN.xy *= 0.9;
  mat3 tbn = getTangentFrame(-vViewPosition, normal, uv);
  normal = normalize(tbn * mapN);
}
`,
};
