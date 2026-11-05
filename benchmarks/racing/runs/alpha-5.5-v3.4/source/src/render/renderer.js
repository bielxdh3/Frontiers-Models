// Renderer setup: WebGL2 with reversed depth, HDRI environment, sun + CSM
// shadows, aerial fog, procedural sky, HDR post pipeline. Quality presets.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { loadEnvironment } from './env.js';
import { installFog } from './atmosphere.js';
import { createSky } from './sky.js';
import { PostPipeline, MASK_LAYER } from './post.js';
import { SHADOW_ONLY_LAYER } from './instancing.js';

export const QUALITY = {
  alta: { name: 'Alta', scale: 1.0, msaa: 4, shadowSize: 2048, cascades: 3, shadowFar: 520, motionBlur: true, bloom: true, flare: true, vegDist: 1.0, terrainLod: 1.0, carLod1Dist: 12, vegShadowR: 110 },
  baixa: { name: 'Baixa', scale: 0.72, msaa: 0, shadowSize: 1024, cascades: 2, shadowFar: 260, motionBlur: false, bloom: true, flare: false, vegDist: 0.55, terrainLod: 0.6, carLod1Dist: 10, vegShadowR: 60 },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', reversedDepthBuffer: true, stencil: false });
    r.setPixelRatio(1);
    r.setSize(innerWidth, innerHeight, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping; // tone mapping happens in the final post pass
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    this.r = r;
    this.reversed = r.capabilities.reversedDepthBuffer;
    this.materials = new Set();
    this.quality = QUALITY.alta;
    this.uTerrShadow = { value: null }; this.uTerrBox = { value: new THREE.Vector4(0, 0, 1, 1) };
  }

  /** baked terrain shadow-height texture (see Terrain.computeShadowHeight) */
  setTerrainShadow(terrain) {
    const S = terrain.computeShadowHeight(this.sunDir);
    const data = new Uint16Array(S.length);
    for (let i = 0; i < S.length; i++) data[i] = THREE.DataUtils.toHalfFloat(Math.max(-500, Math.min(2000, S[i])));
    const t = new THREE.DataTexture(data, terrain.shadowW, terrain.shadowHt, THREE.RedFormat, THREE.HalfFloatType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; t.userData.src = 'terrain-shadow';
    this.uTerrShadow.value = t;
    this.uTerrBox.value.set(terrain.x0, terrain.z0, terrain.x1 - terrain.x0, terrain.z1 - terrain.z0);
  }
  _patchChunks() {
    if (this._patched) return; this._patched = true;
    THREE.ShaderChunk.lights_pars_begin += `
#ifdef TERRAIN_SHADOW
uniform sampler2D tTerrShadow; uniform vec4 uTerrShadowBox;
float terrainShadowAt(vec3 wp) {
  vec2 uv = (wp.xz - uTerrShadowBox.xy) / uTerrShadowBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  float S = texture2D(tTerrShadow, uv).r;
  return smoothstep(S - 1.8, S + 0.5, wp.y);
}
#endif
`;
    let lf = THREE.ShaderChunk.lights_fragment_begin;
    lf = `
#ifdef TERRAIN_SHADOW
float terrShadowF = terrainShadowAt(transpose(mat3(viewMatrix)) * (-vViewPosition - viewMatrix[3].xyz));
#else
float terrShadowF = 1.0;
#endif
` + lf.split('getDirectionalLightInfo( directionalLight, directLight );').join('getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= terrShadowF;');
    THREE.ShaderChunk.lights_fragment_begin = lf;
  }

  async init(trackJson, onProgress) {
    const env = await loadEnvironment(this.r, './assets/hdri/kloppenheim_06_puresky_2k.hdr', trackJson.sun.azimuthDeg, onProgress);
    this.env = env;
    this.atmGLSL = installFog(env);
    const scene = new THREE.Scene();
    scene.environment = env.envMap;
    scene.environmentIntensity = 0.55;
    scene.fog = new THREE.Fog(0xffffff, 1, 2); // enables USE_FOG; parameters unused (own model)
    this.scene = scene;
    this.sky = createSky(this.atmGLSL);
    scene.add(this.sky);
    this.sunDir = env.sunDir.clone();
    // sun colour: HDRI sun hue, normalised, with physical-ish intensity
    const sc = env.sunColor.clone(); const m = Math.max(sc.r, sc.g, sc.b); sc.multiplyScalar(1 / m);
    this.sunColor = sc;
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.15, 16000);
    this._setupShadows();
    this.post = new PostPipeline(this.r, { msaa: this.quality.msaa, scale: this.quality.scale, motionBlur: this.quality.motionBlur, bloom: this.quality.bloom, flare: this.quality.flare });
    addEventListener('resize', () => this.resize());
  }

  _setupShadows() {
    if (this.csm) { this.csm.remove(); this.csm.dispose(); }
    const q = this.quality;
    this.csm = new CSM({
      maxFar: q.shadowFar, cascades: q.cascades, mode: 'practical', parent: this.scene, shadowMapSize: q.shadowSize,
      lightDirection: this.sunDir.clone().negate(), camera: this.camera, lightIntensity: 7.5, lightNear: 1, lightFar: 3000, lightMargin: 420, shadowBias: -0.00012, fade: true,
    });
    // lights also live on the car-mask layer: the mask pass then sees the same light set, so three's
    // lights-state version never changes between passes (otherwise every lit material re-derives its program each frame)
    for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.shadow.normalBias = 0.035; l.shadow.radius = 2.5; l.shadow.camera.layers.enable(SHADOW_ONLY_LAYER); l.layers.enable(MASK_LAYER); }
    for (const m of this.materials) this._csmMat(m);
  }

  /** register a lit material so it receives cascaded shadows (keeps its own onBeforeCompile) */
  register(mat) {
    if (!mat || this.materials.has(mat) || !(mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshLambertMaterial)) return mat;
    this.materials.add(mat);
    this._csmMat(mat);
    return mat;
  }
  _csmMat(mat) {
    this._patchChunks();
    this.csm.setupMaterial(mat);
    mat.defines.TERRAIN_SHADOW = '';
    const csmFn = mat.onBeforeCompile;
    const own = mat.userData.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => { csmFn(sh, r); sh.uniforms.tTerrShadow = this.uTerrShadow; sh.uniforms.uTerrShadowBox = this.uTerrBox; if (own) own(sh, r); };
    const key = (mat.userData.programKey || mat.name || mat.type) + (own ? ':own' : '') + ':csm' + this.quality.cascades;
    mat.customProgramCacheKey = () => key;
    mat.needsUpdate = true;
  }
  registerTree(root) { root.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => this.register(m)); } }); }

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.alta;
    this.quality = q;
    this.post.dispose();
    this.post = new PostPipeline(this.r, { msaa: q.msaa, scale: q.scale, motionBlur: q.motionBlur, bloom: q.bloom, flare: q.flare });
    this._setupShadows();
  }
  resize() { this.r.setSize(innerWidth, innerHeight, false); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.post.setSize(); }

  render(dt, time, maskObjects) {
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.uTime.value = time;
    this.camera.updateMatrixWorld();
    this.csm.update();
    this.post.render(this.scene, this.camera, { maskObjects, sunDir: this.sunDir, time, dt });
  }
}
export { MASK_LAYER };
