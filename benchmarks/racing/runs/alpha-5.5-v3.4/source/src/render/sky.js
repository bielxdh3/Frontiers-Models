// Procedural sky dome: HDRI-referenced gradient, visible sun disc with glow,
// sparse sunlit cumulus + thin cirrus (own GLSL noise), horizon haze.
import * as THREE from 'three';

export const NOISE_GLSL = /* glsl */`
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm5(vec2 p) { float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = m * p; a *= 0.5; } return s; }
  float fbm3(vec2 p) { float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = m * p; a *= 0.5; } return s; }
`;

export function createSky(atmGLSL) {
  const mat = new THREE.ShaderMaterial({
    name: 'sky',
    uniforms: { uTime: { value: 0 }, uSunIntensity: { value: 60 }, uCamPos: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uSunIntensity; uniform vec3 uCamPos;
      varying vec3 vDir;
      ${atmGLSL}
      ${NOISE_GLSL}
      float cloudDensity(vec2 p) {
        float base = fbm5(p * 0.00072 + vec2(uTime * 0.0012, 0.0));
        float detail = fbm3(p * 0.0031 - vec2(uTime * 0.004, uTime * 0.002));
        float d = base * 0.78 + detail * 0.3;
        return smoothstep(0.56, 0.86, d);
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = atmSky(d);
        float cg = dot(d, ATM_SUN_DIR);
        // clouds on a plane at 1900 m
        if (d.y > 0.012) {
          float t = 1900.0 / d.y;
          vec2 p = uCamPos.xz + d.xz * t;
          float den = cloudDensity(p);
          // self-shadow: sample towards the sun on the plane
          vec2 toSun = normalize(ATM_SUN_DIR.xz) * 260.0;
          float den2 = cloudDensity(p + toSun);
          float lit = clamp(1.0 - (den2 - den * 0.4) * 1.3, 0.0, 1.0);
          float fwd = pow(max(cg, 0.0), 5.0);
          vec3 shadowCol = mix(ATM_ZENITH * 1.4, ATM_HOR_ANTI * 0.85, 0.55) * 0.75;
          vec3 sunCol = ATM_SUN_TINT * 2.2;
          vec3 cc = mix(shadowCol, sunCol, lit * 0.75 + 0.1) + ATM_SUN_TINT * fwd * (1.0 - den) * 5.0;
          float fade = smoothstep(0.012, 0.13, d.y);
          // thin cirrus streaks
          float ci = smoothstep(0.55, 0.85, fbm3(vec2(p.x * 0.00025, p.y * 0.0012) + uTime * 0.0004)) * 0.35 * smoothstep(0.03, 0.3, d.y);
          vec3 cirrusCol = mix(ATM_HOR_ANTI * 1.2, ATM_SUN_TINT * 1.8, 0.4 + 0.6 * fwd);
          col = mix(col, cirrusCol, ci);
          col = mix(col, cc, den * fade * 0.92);
          // haze in front of distant clouds
          col = mix(col, atmFogColor(d), (1.0 - fade) * 0.6 * den);
        }
        // sun disc (limb darkened) - occluded by cloud density
        float r = acos(clamp(cg, -1.0, 1.0));
        float disc = smoothstep(0.0105, 0.0085, r);
        float limb = 1.0 - 0.45 * pow(r / 0.0095, 2.0);
        col += ATM_SUN_TINT * disc * limb * uSunIntensity;
        // below horizon: horizon haze (sea covers it in practice)
        if (d.y < 0.0) col = mix(col, atmFogColor(d) * 0.9, smoothstep(0.0, -0.05, d.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const geo = new THREE.SphereGeometry(9000, 64, 32);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky'; mesh.renderOrder = -1000; mesh.frustumCulled = false;
  mesh.userData.audit = { kind: 'sky', exempt: 'sky' };
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mat.uniforms.uCamPos.value.copy(cam.position); };
  return mesh;
}
