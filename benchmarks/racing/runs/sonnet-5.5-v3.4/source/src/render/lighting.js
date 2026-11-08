// Sun (cascaded shadow maps) + haze colour that follows the view direction relative to the sun.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';

export const QUALITY = {
  high: { cascades: 3, shadowMap: 2048, maxFar: 420, msaa: 4, scale: 1.0, bloom: true, motionBlur: true, ao: true },
  low:  { cascades: 2, shadowMap: 1024, maxFar: 220, msaa: 0, scale: 0.75, bloom: true, motionBlur: false, ao: false },
};

export function createLighting(scene, camera, env, q) {
  // the visible sun disc stays where the HDRI puts it; the *light* uses a slightly higher elevation so shadows stay stable
  const lightEl = Math.max(env.sunElevation, 11 * Math.PI / 180);
  const sh0 = new THREE.Vector3(env.sunDir.x, 0, env.sunDir.z).normalize();
  const sunDir = new THREE.Vector3(sh0.x * Math.cos(lightEl), Math.sin(lightEl), sh0.z * Math.cos(lightEl)).normalize();
  const sunColor = new THREE.Color(1.0, 0.80, 0.58).multiply(new THREE.Color(env.sunColor.r ** 0.5, env.sunColor.g ** 0.5, env.sunColor.b ** 0.5));
  const csm = new CSM({
    maxFar: q.maxFar, cascades: q.cascades, mode: 'practical', parent: scene, shadowMapSize: q.shadowMap,
    lightDirection: sunDir.clone().negate(), camera, lightIntensity: 4.6, shadowBias: -0.0003,
  });
  csm.fade = true;
  for (const l of csm.lights) {
    l.color.copy(sunColor);
    l.shadow.normalBias = 0.045;
    l.shadow.radius = 1.6;
  }
  const baseIntensity = 4.6;
  const hazeCool = new THREE.Color(0.50, 0.62, 0.78).multiplyScalar(0.34), hazeWarm = new THREE.Color(1.0, 0.70, 0.42).multiplyScalar(0.85);
  const tmp = new THREE.Vector3(), tmpC = new THREE.Color();
  const sunH = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize();
  return {
    csm, sunDir, sunColor, sunH, hazeCool, hazeWarm,
    setIntensity(k) { for (const l of csm.lights) l.intensity = baseIntensity * k; },
    update(camera, fog) {
      csm.update();
      if (fog) {
        camera.getWorldDirection(tmp); tmp.y = 0; if (tmp.lengthSq() > 1e-6) tmp.normalize();
        const k = Math.pow(Math.max(0, tmp.dot(sunH)), 3);
        tmpC.copy(hazeCool).lerp(hazeWarm, k);
        fog.color.copy(tmpC);
      }
    },
    resize() { csm.updateFrustums(); },
    setupMaterial(mat) { csm.setupMaterial(mat); },
    dispose() { csm.remove(); csm.dispose(); },
  };
}
