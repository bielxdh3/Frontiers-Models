// Shared shader plumbing: distance haze whose colour follows the HDRI horizon (so fog, sea and sky meet seamlessly).
// Fog only starts beyond 150 m (spec 5.6). Every material of the game runs `applyCommon` from its onBeforeCompile.
import * as THREE from 'three';

export const HAZE = {
  uniforms: {
    tHaze: { value: null },
    uFogStart: { value: 150 },
    uFogDensity: { value: 0.00052 },
    uHazeGain: { value: 1.0 },
  },
};

export function installHaze(hazeRGB /* Float32Array(256*3), world-azimuth order */, gain = 1) {
  const n = hazeRGB.length / 3;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    // encode with a /4 range so HDR values up to 4 survive in 8 bits
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(hazeRGB[i * 3 + c] / 4 * 255)));
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  HAZE.uniforms.tHaze.value = t;
  HAZE.uniforms.uHazeGain.value = gain;
}

const FOG_VERT_PARS = `varying float vFogDepth2; varying vec3 vFogDir;`;
const FOG_VERT = `vFogDepth2 = -mvPosition.z; vFogDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;`;
const FOG_FRAG_PARS = `varying float vFogDepth2; varying vec3 vFogDir;
uniform sampler2D tHaze; uniform float uFogStart; uniform float uFogDensity; uniform float uHazeGain;
vec3 hazeColor(vec3 dir) {
  float az = atan(dir.z, dir.x) * 0.15915494 + 0.5;
  return texture2D(tHaze, vec2(az, 0.5)).rgb * 4.0 * uHazeGain;
}`;
const FOG_FRAG = `{
  float fd = max(vFogDepth2 - uFogStart, 0.0);
  float ff = 1.0 - exp(-pow(fd * uFogDensity, 1.5));
  vec3 hc = hazeColor(normalize(vFogDir));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hc, clamp(ff, 0.0, 0.985));
}`;

/** call from onBeforeCompile of every material: replaces three's linear fog by the horizon-matched haze */
export function applyCommon(shader) {
  Object.assign(shader.uniforms, HAZE.uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <fog_pars_vertex>', FOG_VERT_PARS)
    .replace('#include <fog_vertex>', FOG_VERT);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', FOG_FRAG_PARS)
    .replace('#include <fog_fragment>', FOG_FRAG);
}

/** chain: CSM patch (if any) -> common -> custom. `custom(shader, renderer)` may be null */
export function chainPatch(mat, lighting, custom, cacheKey) {
  if (lighting) lighting.setupMaterial(mat);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(mat, shader, renderer);
    if (custom) custom(shader, renderer);
    applyCommon(shader);
  };
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}
