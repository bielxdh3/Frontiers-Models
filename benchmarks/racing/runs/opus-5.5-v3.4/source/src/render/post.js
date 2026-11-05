// HDR post pipeline (own shaders): MSAA HDR scene target -> camera motion blur
// (player car masked, never blurred) -> physically based bloom (mip chain) ->
// lens flare from the sun (depth-tested) -> exposure, ACES filmic, grade,
// vignette, dither, sRGB. The HUD is a separate canvas and never blurred.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const MASK_LAYER = 5;
const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class PostPipeline {
  constructor(renderer, { msaa = 4, scale = 1, bloom = true, motionBlur = true, flare = true } = {}) {
    this.r = renderer; this.msaa = msaa; this.scale = scale;
    this.opts = { bloom, motionBlur, flare };
    this.prevVP = new THREE.Matrix4(); this.curVP = new THREE.Matrix4(); this.hasPrev = false;
    this.quad = new FullScreenQuad(null);
    this.maskScene = null; this.maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.exposure = 0.86; this.bloomStrength = 0.045; this.blurAmount = 0.32;
    this._build();
  }

  _build() {
    const r = this.r;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.round(size.x * this.scale)), h = Math.max(1, Math.round(size.y * this.scale));
    this.w = w; this.h = h;
    const dt = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.msaa, depthTexture: dt, depthBuffer: true });
    this.sceneRT.texture.generateMipmaps = false;
    this.maskRT = new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), { type: THREE.UnsignedByteType, depthBuffer: true });
    this.blurRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    // bloom chain
    this.bloomRTs = [];
    let bw = Math.ceil(w / 2), bh = Math.ceil(h / 2);
    for (let i = 0; i < 6; i++) { this.bloomRTs.push(new THREE.WebGLRenderTarget(Math.max(1, bw), Math.max(1, bh), { type: THREE.HalfFloatType, depthBuffer: false })); bw = Math.ceil(bw / 2); bh = Math.ceil(bh / 2); }
    this.visRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    // auto exposure: log-luminance at 64x64 (mip-mapped down to 1x1) -> temporally adapted 1x1 pair
    this.lumRT = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    this.adaptRT = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
    this.adaptIdx = 0; this.adaptInit = true;
    this._materials();
  }
  setSize() { this.dispose(); this._build(); }
  dispose() { for (const t of [this.sceneRT, this.maskRT, this.blurRT, this.visRT, this.lumRT, ...(this.adaptRT || []), ...this.bloomRTs]) t && t.dispose(); }
  /** jump the adapted exposure to the current frame (camera cuts / teleports) */
  snapExposure() { this.adaptInit = true; }

  _materials() {
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, tMask: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() }, uAmount: { value: 0.5 }, uReversed: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor, tDepth, tMask; uniform mat4 uInvVP, uPrevVP; uniform float uAmount; uniform int uReversed;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tColor, vUv);
          float m = texture2D(tMask, vUv).r;
          float depth = texture2D(tDepth, vUv).r;
          float zN = uReversed == 1 ? depth : depth * 2.0 - 1.0;
          bool sky = uReversed == 1 ? depth <= 0.0 : depth >= 1.0;
          if (m > 0.5) { gl_FragColor = c; return; }
          vec4 ndc = vec4(vUv * 2.0 - 1.0, zN, 1.0);
          vec4 wp = uInvVP * ndc; wp /= wp.w;
          if (sky) { wp = uInvVP * vec4(vUv * 2.0 - 1.0, uReversed == 1 ? 1e-7 : 0.9999999, 1.0); wp /= wp.w; }
          vec4 pp = uPrevVP * vec4(wp.xyz, 1.0); vec2 prevUv = pp.xy / pp.w * 0.5 + 0.5;
          vec2 vel = (vUv - prevUv) * uAmount;
          float len = length(vel);
          float maxLen = 0.022;
          if (len > maxLen) vel *= maxLen / len;
          if (len < 0.0006) { gl_FragColor = c; return; }
          vec4 acc = c; float wsum = 1.0;
          for (int i = 1; i <= 9; i++) {
            float t = (float(i) / 9.0 - 0.5);
            vec2 uv = vUv + vel * t;
            float mm = texture2D(tMask, uv).r;
            float w = 1.0 - mm; // never pull car pixels into the background blur
            acc += texture2D(tColor, uv) * w; wsum += w;
          }
          gl_FragColor = acc / wsum;
        }`,
      depthTest: false, depthWrite: false,
    });
    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform vec2 uTexel; uniform int uFirst; varying vec2 vUv;
        vec3 S(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
        float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
        void main() {
          vec3 a = S(vec2(-2, 2)), b = S(vec2(0, 2)), c = S(vec2(2, 2));
          vec3 d = S(vec2(-2, 0)), e = S(vec2(0, 0)), f = S(vec2(2, 0));
          vec3 g = S(vec2(-2, -2)), h = S(vec2(0, -2)), i = S(vec2(2, -2));
          vec3 j = S(vec2(-1, 1)), k = S(vec2(1, 1)), l = S(vec2(-1, -1)), m = S(vec2(1, -1));
          vec3 col;
          if (uFirst == 1) {
            vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
            float w0 = karis(g0), w1 = karis(g1), w2 = karis(g2), w3 = karis(g3), w4 = karis(g4);
            col = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
            col = min(col, vec3(60.0));
          } else {
            col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
        void main() {
          vec2 o = uTexel * uRadius;
          vec3 c = texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb;
          c += 2.0 * (texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb);
          c += 4.0 * texture2D(tSrc, vUv).rgb;
          gl_FragColor = vec4(c / 16.0, 1.0);
        }`,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    });
    this.visMat = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uReversed: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAspect; uniform int uReversed; varying vec2 vUv;
        void main() {
          float v = 0.0;
          for (int i = 0; i < 6; i++) for (int j = 0; j < 6; j++) {
            vec2 o = (vec2(float(i), float(j)) / 5.0 - 0.5) * vec2(0.012, 0.012 * uAspect);
            vec2 uv = uSun + o;
            float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
            float d = texture2D(tDepth, uv).r;
            float sky = uReversed == 1 ? step(d, 0.0) : step(1.0, d);
            v += sky * inside;
          }
          gl_FragColor = vec4(v / 36.0, 0.0, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.lumMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor; varying vec2 vUv;
        void main() {
          // 4 taps per 64x64 texel of the HDR frame; log luminance (geometric mean after the mip chain)
          vec2 o = vec2(0.25 / 64.0);
          float l = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 d = vec2(i == 0 || i == 2 ? -o.x : o.x, i < 2 ? -o.y : o.y);
            vec3 c = texture2D(tColor, vUv + d).rgb;
            l += log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4));
          }
          gl_FragColor = vec4(l * 0.25, 0.0, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.adaptMat = new THREE.ShaderMaterial({
      uniforms: { tLum: { value: null }, tPrev: { value: null }, uK: { value: 0.05 }, uInit: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tLum, tPrev; uniform float uK; uniform int uInit; varying vec2 vUv;
        void main() {
          float cur = exp(textureLod(tLum, vec2(0.5), 6.0).r);
          float prev = texture2D(tPrev, vec2(0.5)).r;
          float a = uInit == 1 ? cur : mix(prev, cur, uK);
          gl_FragColor = vec4(a, 0.0, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tBloom: { value: null }, tVis: { value: null }, uBloom: { value: 0.05 }, uExposure: { value: 1.0 },
        tAdapt: { value: null }, uAEKey: { value: 0.26 }, uAEAmt: { value: 0.5 }, uAEMin: { value: 0.9 }, uAEMax: { value: 1.45 }, uAEOn: { value: 1 },
        uSun: { value: new THREE.Vector2(-9, -9) }, uSunOn: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uFlare: { value: 1 },
        uSunColor: { value: new THREE.Color(1, 0.7, 0.4) },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor, tBloom, tVis, tAdapt; uniform float uBloom, uExposure, uAspect, uTime, uSunOn, uFlare; uniform vec2 uSun; uniform vec3 uSunColor;
        uniform float uAEKey, uAEAmt, uAEMin, uAEMax; uniform int uAEOn;
        varying vec2 vUv;
        vec3 aces(vec3 x) {
          // ACES fitted (RRT + ODT), sRGB primaries approximation
          const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
          const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
          x = inM * x;
          vec3 a = x * (x + 0.0245786) - 0.000090537;
          vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
          x = a / b;
          return clamp(outM * x, 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec3 flare(vec2 uv) {
          if (uSunOn < 0.5) return vec3(0.0);
          float vis = texture2D(tVis, vec2(0.5)).r;
          if (vis <= 0.001) return vec3(0.0);
          vec2 c = vec2(0.5);
          vec2 sv = uSun - c;
          vec3 acc = vec3(0.0);
          // ghosts along the sun-centre axis
          for (int i = 0; i < 5; i++) {
            float k = float(i);
            float pos = -0.35 - k * 0.32 + (k == 2.0 ? 0.9 : 0.0);
            vec2 gp = c + sv * pos;
            vec2 d = (uv - gp) * vec2(uAspect, 1.0);
            float rad = 0.018 + 0.03 * fract(k * 0.37 + 0.2);
            float g = smoothstep(rad, rad * 0.35, length(d));
            vec3 tint = mix(vec3(1.0, 0.55, 0.25), vec3(0.45, 0.7, 1.0), fract(k * 0.61));
            acc += tint * g * 0.035;
          }
          // halo ring
          vec2 dh = (uv - c - sv * -0.15) * vec2(uAspect, 1.0);
          float ring = smoothstep(0.03, 0.0, abs(length(dh) - 0.32)) * 0.02;
          acc += vec3(1.0, 0.6, 0.35) * ring;
          // soft glare around the sun
          vec2 ds = (uv - uSun) * vec2(uAspect, 1.0);
          float gl = exp(-length(ds) * 9.0) * 0.35 + exp(-abs(ds.y) * 220.0) * exp(-abs(ds.x) * 4.0) * 0.05;
          acc += uSunColor * gl;
          return acc * vis * uFlare;
        }
        void main() {
          vec3 col = texture2D(tColor, vUv).rgb;
          vec3 bl = texture2D(tBloom, vUv).rgb;
          col = mix(col, bl, uBloom);
          col += flare(vUv);
          // eye adaptation: partial (pow < 1) and clamped, so shade stays darker than sun but never murky
          float ae = 1.0;
          if (uAEOn == 1) { float La = max(texture2D(tAdapt, vec2(0.5)).r, 1e-4); ae = clamp(pow(uAEKey / La, uAEAmt), uAEMin, uAEMax); }
          col *= uExposure * ae;
          col = aces(col);
          // grade: contrast S-curve, saturation, warm highlights / cool shadows
          col = mix(col, col * col * (3.0 - 2.0 * col), 0.38);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, 1.18);
          col *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.15, 0.7, l));
          col = clamp(col, 0.0, 1.0);
          // vignette
          vec2 q = vUv - 0.5; float vig = 1.0 - dot(q * vec2(0.95, 1.1), q) * 0.55;
          col *= vig;
          col = toSRGB(clamp(col, 0.0, 1.0));
          col += (hash(vUv * 1013.0 + uTime) - 0.5) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
  }

  render(scene, camera, { maskObjects = null, sunDir = null, time = 0, dt = 1 / 60 } = {}) {
    const r = this.r;
    const prevAuto = r.autoClear;
    // 1) scene
    r.setRenderTarget(this.sceneRT); r.clear(); r.render(scene, camera);
    this.curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const reversed = r.state.buffers.depth.getReversed() ? 1 : 0;
    // 2) car mask (half res)
    r.setRenderTarget(this.maskRT); r.setClearColor(0x000000, 1); r.clear();
    if (maskObjects && this.opts.motionBlur) {
      // player car meshes are tagged with layer MASK_LAYER (in addition to layer 0)
      const au = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
      const bg = scene.background; scene.background = null;
      scene.overrideMaterial = this.maskMat;
      camera.layers.set(MASK_LAYER);
      r.render(scene, camera);
      camera.layers.set(0);
      scene.overrideMaterial = null; scene.background = bg; r.shadowMap.autoUpdate = au;
    }
    let src = this.sceneRT.texture;
    // 3) motion blur
    if (this.opts.motionBlur && this.hasPrev) {
      const m = this.blurMat;
      m.uniforms.tColor.value = src; m.uniforms.tDepth.value = this.sceneRT.depthTexture; m.uniforms.tMask.value = this.maskRT.texture;
      m.uniforms.uInvVP.value.copy(this.curVP).invert(); m.uniforms.uPrevVP.value.copy(this.prevVP);
      m.uniforms.uAmount.value = this.blurAmount * Math.min(2, (1 / 60) / Math.max(1e-3, dt)); m.uniforms.uReversed.value = reversed;
      this.quad.material = m; r.setRenderTarget(this.blurRT); this.quad.render(r);
      src = this.blurRT.texture;
    }
    this.prevVP.copy(this.curVP); this.hasPrev = true;
    // 4) bloom chain
    if (this.opts.bloom) {
      let prev = src;
      for (let i = 0; i < this.bloomRTs.length; i++) {
        const t = this.bloomRTs[i];
        this.downMat.uniforms.tSrc.value = prev; this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
        const pw = i === 0 ? this.w : this.bloomRTs[i - 1].width, ph = i === 0 ? this.h : this.bloomRTs[i - 1].height;
        this.downMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
        this.quad.material = this.downMat; r.setRenderTarget(t); this.quad.render(r);
        prev = t.texture;
      }
      r.autoClear = false;
      for (let i = this.bloomRTs.length - 1; i > 0; i--) {
        const s = this.bloomRTs[i], d = this.bloomRTs[i - 1];
        this.upMat.uniforms.tSrc.value = s.texture; this.upMat.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
        this.quad.material = this.upMat; r.setRenderTarget(d); this.quad.render(r);
      }
      r.autoClear = prevAuto;
    }
    // 5) sun visibility for flare
    const fm = this.finalMat.uniforms;
    fm.uSunOn.value = 0;
    if (sunDir && this.opts.flare) {
      const sp = _v.copy(camera.position).addScaledVector(sunDir, 5000).project(camera);
      const inFront = _v2.copy(sunDir).dot(camera.getWorldDirection(_v3)) > 0;
      if (inFront && Math.abs(sp.x) < 1.3 && Math.abs(sp.y) < 1.3) {
        fm.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); fm.uSunOn.value = 1;
        this.visMat.uniforms.tDepth.value = this.sceneRT.depthTexture; this.visMat.uniforms.uSun.value.copy(fm.uSun.value);
        this.visMat.uniforms.uAspect.value = this.w / this.h; this.visMat.uniforms.uReversed.value = reversed;
        this.quad.material = this.visMat; r.setRenderTarget(this.visRT); this.quad.render(r);
      }
    }
    // 5b) auto exposure
    this.lumMat.uniforms.tColor.value = src;
    this.quad.material = this.lumMat; r.setRenderTarget(this.lumRT); this.quad.render(r);
    const prevA = this.adaptRT[this.adaptIdx], nextA = this.adaptRT[1 - this.adaptIdx];
    this.adaptMat.uniforms.tLum.value = this.lumRT.texture; this.adaptMat.uniforms.tPrev.value = prevA.texture;
    this.adaptMat.uniforms.uK.value = 1 - Math.exp(-Math.min(0.1, dt) * 1.6); this.adaptMat.uniforms.uInit.value = this.adaptInit ? 1 : 0;
    this.quad.material = this.adaptMat; r.setRenderTarget(nextA); this.quad.render(r);
    this.adaptIdx = 1 - this.adaptIdx; this.adaptInit = false;
    fm.tAdapt.value = nextA.texture;
    // 6) final
    fm.tColor.value = src; fm.tBloom.value = this.opts.bloom ? this.bloomRTs[0].texture : src; fm.tVis.value = this.visRT.texture;
    fm.uBloom.value = this.opts.bloom ? this.bloomStrength : 0; fm.uExposure.value = this.exposure; fm.uAspect.value = this.w / this.h; fm.uTime.value = time % 100;
    this.quad.material = this.finalMat; r.setRenderTarget(null); this.quad.render(r);
    this.lastReversed = reversed;
  }

  /** adapted scene luminance (debug / tuning) */
  adaptedLuminance() {
    const buf = new Uint16Array(4);
    this.r.readRenderTargetPixels(this.adaptRT[this.adaptIdx], 0, 0, 1, 1, buf);
    return THREE.DataUtils.fromHalfFloat(buf[0]);
  }
  /** fraction of the last frame that shows sky (no geometry depth written), read from the depth buffer */
  skyFraction(W = 192, H = 108) {
    const r = this.r;
    if (!this.skyRT) {
      this.skyRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
      this.skyMat = new THREE.ShaderMaterial({
        uniforms: { tDepth: { value: null }, uReversed: { value: 1 } },
        vertexShader: VERT,
        fragmentShader: /* glsl */`uniform sampler2D tDepth; uniform int uReversed; varying vec2 vUv;
          void main() { float d = texture2D(tDepth, vUv).r; bool sky = uReversed == 1 ? d <= 0.0 : d >= 1.0; gl_FragColor = vec4(sky ? 1.0 : 0.0, 0.0, 0.0, 1.0); }`,
        depthTest: false, depthWrite: false,
      });
      this.skyBuf = new Uint8Array(W * H * 4);
    }
    this.skyMat.uniforms.tDepth.value = this.sceneRT.depthTexture; this.skyMat.uniforms.uReversed.value = this.lastReversed ?? 1;
    this.quad.material = this.skyMat; r.setRenderTarget(this.skyRT); this.quad.render(r); r.setRenderTarget(null);
    r.readRenderTargetPixels(this.skyRT, 0, 0, W, H, this.skyBuf);
    let n = 0; for (let i = 0; i < W * H; i++) if (this.skyBuf[i * 4] > 127) n++;
    return n / (W * H);
  }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
