import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeCanvasTexture } from '../world/materials.js';

// Discrete Peripheral Speed Motion Blur + Golden Hour Sun Corona + Warm Sunset Color Grading Pass
// Strictly masks out central player car & HUD (Section 5.6: "o motion blur nunca borra o carro do jogador nem o HUD")
const SpeedAndFlareShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeedBlur: { value: 0.0 },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.3) },
    uSunVisible: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSpeedBlur;
    uniform vec2 uSunScreenPos;
    uniform float uSunVisible;
    varying vec2 vUv;

    void main() {
      vec4 baseCol = texture2D(tDiffuse, vUv);
      vec3 col = baseCol.rgb;

      // Radial peripheral speed motion blur (zero blur over central player car silhouette)
      if (uSpeedBlur > 0.002) {
        vec2 carCenter = vec2(0.5, 0.67);
        vec2 dCar = (vUv - carCenter) * vec2(1.0, 1.45);
        float carProtectMask = smoothstep(0.22, 0.48, length(dCar));

        vec2 vanish = vec2(0.5, 0.37);
        vec2 radial = vUv - vanish;
        float edgeWeight = smoothstep(0.18, 0.72, length(radial));
        float blurAmt = uSpeedBlur * carProtectMask * edgeWeight * 0.018;

        if (blurAmt > 0.0002) {
          vec3 acc = col * 0.32;
          acc += texture2D(tDiffuse, clamp(vUv - radial * blurAmt * 0.5, 0.001, 0.999)).rgb * 0.26;
          acc += texture2D(tDiffuse, clamp(vUv - radial * blurAmt * 1.0, 0.001, 0.999)).rgb * 0.22;
          acc += texture2D(tDiffuse, clamp(vUv - radial * blurAmt * 1.5, 0.001, 0.999)).rgb * 0.20;
          col = acc;
        }
      }

      // Subtle Golden Hour warm-highlight / cool-shadow split-toning (keeps shadows crisp & sky warm amber-gold)
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float hiMask = smoothstep(0.32, 0.95, lum);
      float shMask = 1.0 - smoothstep(0.02, 0.36, lum);
      col *= mix(vec3(1.0), vec3(1.08, 0.98, 0.86), hiMask * 0.55);
      col *= mix(vec3(1.0), vec3(0.92, 0.95, 1.06), shMask * 0.42);

      // Discrete golden hour sun halo & anamorphic lens flare when facing the low sun
      if (uSunVisible > 0.01) {
        vec2 dSun = vUv - uSunScreenPos;
        dSun.x *= 1.77;
        float dist = length(dSun);
        float warmGlow = exp(-dist * 3.8) * 0.18 + exp(-abs(dSun.y) * 24.0) * exp(-abs(dSun.x) * 2.8) * 0.085;
        vec2 ghostPos = vec2(0.5) + (vec2(0.5) - uSunScreenPos) * 0.55;
        float dGhost = length((vUv - ghostPos) * vec2(1.77, 1.0));
        float ghost = exp(-pow((dGhost - 0.07) * 26.0, 2.0)) * 0.04;
        col += vec3(1.0, 0.62, 0.28) * (warmGlow + ghost) * uSunVisible;
      }

      gl_FragColor = vec4(col, baseCol.a);
    }
  `
};

export class LightingAndPostSystem {
  constructor(renderer, scene, camera, trackData) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = 'high';

    this.sunDir = new THREE.Vector3(...(trackData.sunDirection || [0.905, 0.168, 0.390])).normalize();

    // Directional Golden Hour Sun (aligned with CC0 Sunset HDRI peak at ~9.7° elevation)
    this.sunLight = new THREE.DirectionalLight('#ffa34d', 6.4);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);
    this.sunLight.shadow.camera.near = 15;
    this.sunLight.shadow.camera.far = 520;
    this.sunFrustumHalf = 66;
    this.sunLight.shadow.camera.left = -this.sunFrustumHalf;
    this.sunLight.shadow.camera.right = this.sunFrustumHalf;
    this.sunLight.shadow.camera.top = this.sunFrustumHalf;
    this.sunLight.shadow.camera.bottom = -this.sunFrustumHalf;
    this.sunLight.shadow.bias = -0.00028;
    this.sunLight.shadow.normalBias = 0.020;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Intentionally weak cool-sky fill so directional shadows remain crisp, deep, and unmistakable (Section 5.6!)
    this.skyFill = new THREE.HemisphereLight('#7289b5', '#1d222e', 0.14);
    this.scene.add(this.skyFill);

    // Distant Golden Hour atmospheric haze — strictly starts > 150 m (at 190 m!) per Section 5.6
    this.scene.fog = new THREE.Fog('#e8995e', 190, 1900);

    // Warm Golden Sun Disc + Atmospheric Corona Sprite at exact sunDir
    const sunTex = makeCanvasTexture((ctx, S) => {
      const g = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.02, S * 0.5, S * 0.5, S * 0.5);
      g.addColorStop(0.0, 'rgba(255, 252, 235, 1.0)');
      g.addColorStop(0.12, 'rgba(255, 224, 156, 0.95)');
      g.addColorStop(0.32, 'rgba(255, 162, 74, 0.45)');
      g.addColorStop(0.68, 'rgba(255, 124, 46, 0.14)');
      g.addColorStop(1.0, 'rgba(255, 110, 40, 0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }, 1024, true);

    const sunMat = new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    this.sunSprite = new THREE.Sprite(sunMat);
    this.sunSprite.scale.set(520, 520, 1);
    this.sunSprite.userData.auditRole = 'sky_sun';
    this.scene.add(this.sunSprite);

    this._lightFwd = this.sunDir.clone().negate();
    this._lightRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this._lightFwd).normalize();
    this._lightUp = new THREE.Vector3().crossVectors(this._lightFwd, this._lightRight).normalize();
    this._tmpVec = new THREE.Vector3();

    this.composer = null;
    this.bloomPass = null;
    this.speedFlarePass = null;
  }

  async loadHdri(url = './assets/hdri/evening_road_01_puresky_2k.hdr') {
    const rgbe = new RGBELoader();
    const hdrTex = await rgbe.loadAsync(url);

    // Warm-grade the CC0 evening sky HDRI data slightly toward Mediterranean sunset amber/rose-gold
    // while keeping dynamic range intact so reflections and sky match Golden Hour references!
    if (hdrTex.image && hdrTex.image.data) {
      const d = hdrTex.image.data;
      const w = hdrTex.image.width;
      const h = hdrTex.image.height;
      // RGBELoader returns HalfFloat (Uint16) or Float32 depending on DataTexture type; check DataUtils if Uint16
      if (d instanceof Float32Array) {
        for (let y = 0; y < h; y++) {
          const v = y / h; // 0 top .. 0.5 horizon
          const horizonWarmth = Math.exp(-Math.pow((v - 0.48) * 5.2, 2.0));
          const rMul = 1.06 + 0.34 * horizonWarmth;
          const gMul = 0.96 + 0.08 * horizonWarmth;
          const bMul = 0.86 - 0.16 * horizonWarmth;
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            d[idx] *= rMul;
            d[idx + 1] *= gMul;
            d[idx + 2] *= bMul;
          }
        }
      } else if (d instanceof Uint16Array && THREE.DataUtils) {
        for (let y = 0; y < h; y++) {
          const v = y / h;
          const horizonWarmth = Math.exp(-Math.pow((v - 0.48) * 5.2, 2.0));
          const rMul = 1.08 + 0.36 * horizonWarmth;
          const gMul = 0.96 + 0.08 * horizonWarmth;
          const bMul = 0.84 - 0.18 * horizonWarmth;
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = THREE.DataUtils.fromHalfFloat(d[idx]) * rMul;
            const g = THREE.DataUtils.fromHalfFloat(d[idx + 1]) * gMul;
            const b = THREE.DataUtils.fromHalfFloat(d[idx + 2]) * bMul;
            d[idx] = THREE.DataUtils.toHalfFloat(r);
            d[idx + 1] = THREE.DataUtils.toHalfFloat(g);
            d[idx + 2] = THREE.DataUtils.toHalfFloat(b);
          }
        }
      }
      hdrTex.needsUpdate = true;
    }

    hdrTex.mapping = THREE.EquirectangularReflectionMapping;

    const targetU = Math.atan2(this.sunDir.z, this.sunDir.x) / (Math.PI * 2) + 0.5;
    const peakU = 0.5959;
    const alignRotY = (targetU - peakU) * Math.PI * 2;

    this.scene.background = hdrTex;
    this.scene.environment = hdrTex;
    if (this.scene.backgroundRotation) this.scene.backgroundRotation.y = alignRotY;
    if (this.scene.environmentRotation) this.scene.environmentRotation.y = alignRotY;
    // Low global diffuse IBL so world shadows remain dark & crisp while car clearcoat/glass use envMapIntensity > 2.0!
    this.scene.environmentIntensity = 0.34;
    this.scene.backgroundIntensity = 0.94;

    this._initPostProcessing();
  }

  _initPostProcessing() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 4
    });

    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.38, 0.90);
    this.composer.addPass(this.bloomPass);

    this.speedFlarePass = new ShaderPass(SpeedAndFlareShader);
    this.composer.addPass(this.speedFlarePass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  setQuality(quality = 'high') {
    this.quality = quality;
    if (this.scene.fog) {
      this.scene.fog.near = 190;
      this.scene.fog.far = 1900;
    }
    const isLow = quality === 'low';
    const dpr = isLow ? Math.min(1.0, (window.devicePixelRatio || 1) * 0.78) : Math.min(2.0, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const targetMapSize = isLow ? 1024 : 4096;
    if (this.sunLight.shadow.mapSize.x !== targetMapSize) {
      this.sunLight.shadow.mapSize.set(targetMapSize, targetMapSize);
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null;
      }
    }
    this.sunFrustumHalf = isLow ? 52 : 66;
    this.sunLight.shadow.camera.left = -this.sunFrustumHalf;
    this.sunLight.shadow.camera.right = this.sunFrustumHalf;
    this.sunLight.shadow.camera.top = this.sunFrustumHalf;
    this.sunLight.shadow.camera.bottom = -this.sunFrustumHalf;
    this.sunLight.shadow.camera.updateProjectionMatrix();

    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(window.innerWidth, window.innerHeight);
      if (this.bloomPass) this.bloomPass.enabled = !isLow;
      if (this.speedFlarePass) this.speedFlarePass.enabled = !isLow;
    }
  }

  resize(width, height) {
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  update(focusPos, speedKmh = 0, cameraMode = 'chase') {
    this.sunSprite.position.copy(this.camera.position).addScaledVector(this.sunDir, 2400);

    const mapRes = this.sunLight.shadow.mapSize.x;
    const worldUnitsPerTexel = (this.sunFrustumHalf * 2.0) / mapRes;

    const u = Math.round(focusPos.dot(this._lightRight) / worldUnitsPerTexel) * worldUnitsPerTexel;
    const v = Math.round(focusPos.dot(this._lightUp) / worldUnitsPerTexel) * worldUnitsPerTexel;
    const w = Math.round(focusPos.dot(this._lightFwd) / 2.0) * 2.0;

    this._tmpVec.set(0, 0, 0)
      .addScaledVector(this._lightRight, u)
      .addScaledVector(this._lightUp, v)
      .addScaledVector(this._lightFwd, w);

    this.sunLight.target.position.copy(this._tmpVec);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.position.copy(this._tmpVec).addScaledVector(this.sunDir, 240);

    if (this.speedFlarePass && this.speedFlarePass.enabled) {
      const blurStrength = cameraMode === 'chase' || cameraMode === 'hood'
        ? Math.max(0, Math.min(1.0, (speedKmh - 75.0) / 125.0))
        : 0.0;
      this.speedFlarePass.uniforms.uSpeedBlur.value = blurStrength;

      const camFwd = new THREE.Vector3();
      this.camera.getWorldDirection(camFwd);
      const facing = camFwd.dot(this.sunDir);
      if (facing > 0.15) {
        const sunProj = this.sunSprite.position.clone().project(this.camera);
        const sx = sunProj.x * 0.5 + 0.5;
        const sy = sunProj.y * 0.5 + 0.5;
        const onScreen = (sx > -0.15 && sx < 1.15 && sy > -0.15 && sy < 1.15) ? 1.0 : 0.0;
        this.speedFlarePass.uniforms.uSunScreenPos.value.set(sx, sy);
        this.speedFlarePass.uniforms.uSunVisible.value = Math.max(0, (facing - 0.15) / 0.85) * onScreen;
      } else {
        this.speedFlarePass.uniforms.uSunVisible.value = 0.0;
      }
    }
  }

  render() {
    if (this.composer && this.quality === 'high') {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
