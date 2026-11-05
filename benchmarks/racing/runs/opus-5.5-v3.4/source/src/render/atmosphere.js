// Shared atmosphere model (sky gradient, sun glow, aerial perspective fog).
// The same GLSL is used by the sky dome, the fog of every material and the
// water reflections, so the horizon, haze and reflections stay coherent with
// the sun and with the HDRI colours.
import * as THREE from 'three';

export const ATM = {
  fogStart: 160.0,      // fog never closer than this (spec: starts > 150 m)
  fogDensity: 0.00042,  // 1/m
  fogHeight: 220.0,     // m (exponential height falloff)
  exposure: 1.0,
};

const v3 = (c) => `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
const vv = (v) => `vec3(${v.x.toFixed(6)}, ${v.y.toFixed(6)}, ${v.z.toFixed(6)})`;

export function atmosphereGLSL(env) {
  const c = env.colors;
  // gently grade the HDRI references towards a warmer golden-hour palette
  const zen = c.zenith.clone().multiplyScalar(0.82);
  const hs = c.horizonSun.clone().multiplyScalar(0.95);
  const ha = c.horizonAnti.clone().lerp(new THREE.Color(0.5, 0.56, 0.78), 0.4).multiplyScalar(0.85);
  const side = c.horizonSide.clone().lerp(new THREE.Color(0.95, 0.66, 0.5), 0.35);
  const sun = env.sunColor.clone();
  const sl = Math.max(sun.r, sun.g, sun.b);
  sun.multiplyScalar(1 / sl);
  return /* glsl */`
  const vec3 ATM_SUN_DIR = normalize(${vv(env.sunDir)});
  const vec3 ATM_ZENITH = ${v3(zen)};
  const vec3 ATM_HOR_SUN = ${v3(hs)};
  const vec3 ATM_HOR_ANTI = ${v3(ha)};
  const vec3 ATM_HOR_SIDE = ${v3(side)};
  const vec3 ATM_SUN_TINT = ${v3(sun)};
  const float ATM_FOG_START = ${ATM.fogStart.toFixed(2)};
  const float ATM_FOG_DENS = ${ATM.fogDensity.toFixed(6)};
  const float ATM_FOG_H = ${ATM.fogHeight.toFixed(2)};
  vec3 atmHorizon(vec3 d) {
    vec2 hd = normalize(d.xz + vec2(1e-5));
    vec2 hs = normalize(ATM_SUN_DIR.xz);
    float c = dot(hd, hs);
    vec3 a = mix(ATM_HOR_SIDE, ATM_HOR_ANTI, smoothstep(0.0, -0.9, c));
    vec3 b = mix(ATM_HOR_SIDE, ATM_HOR_SUN, smoothstep(0.0, 0.95, c));
    return c < 0.0 ? a : b;
  }
  vec3 atmSky(vec3 d) {
    float el = clamp(d.y, -1.0, 1.0);
    float up = pow(clamp(el, 0.0, 1.0), 0.42);
    vec3 col = mix(atmHorizon(d), ATM_ZENITH, up);
    float cg = max(dot(d, ATM_SUN_DIR), 0.0);
    col += ATM_SUN_TINT * (0.22 * pow(cg, 6.0) + 0.55 * pow(cg, 32.0) + 1.4 * pow(cg, 420.0)) * (1.0 - 0.5 * up);
    return col;
  }
  // in-scattered fog colour for view direction d
  vec3 atmFogColor(vec3 d) {
    vec3 h = atmHorizon(vec3(d.x, 0.0, d.z));
    float cg = max(dot(normalize(vec3(d.x, max(d.y, 0.0) * 0.5, d.z)), ATM_SUN_DIR), 0.0);
    return h * 0.92 + ATM_SUN_TINT * (0.35 * pow(cg, 8.0) + 0.6 * pow(cg, 48.0));
  }
  float atmFogAmount(vec3 camPos, vec3 wp) {
    vec3 v = wp - camPos; float dist = length(v);
    float dd = max(dist - ATM_FOG_START, 0.0);
    // height-integrated exponential fog
    float h0 = max(camPos.y, 0.0), h1 = max(wp.y, 0.0);
    float hAvg = 0.5 * (h0 + h1);
    float dens = ATM_FOG_DENS * exp(-hAvg / ATM_FOG_H);
    return 1.0 - exp(-dd * dens);
  }
  `;
}

/** override three.js fog chunks with the aerial perspective model */
export function installFog(env) {
  const atm = atmosphereGLSL(env);
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG\n varying vec3 vFogWorldPos;\n#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG\n vFogWorldPos = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);\n#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG\n varying vec3 vFogWorldPos;\n ${atm}\n#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
    {
      vec3 fv = vFogWorldPos - cameraPosition;
      float fogF = atmFogAmount(cameraPosition, vFogWorldPos);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, atmFogColor(normalize(fv)), fogF);
    }
  #endif`;
  return atm;
}
