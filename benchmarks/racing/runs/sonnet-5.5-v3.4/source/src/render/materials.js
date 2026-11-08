// Material factory: loads the CC0 PBR texture arrays and builds the ground materials (terrain / road / kerbs)
// as patched MeshStandardMaterials, wired into the cascaded shadow maps.
import * as THREE from 'three';
import { loadTextureArray, loadTexture2D } from './textures.js';
import { TERRAIN, ROAD, KERB, BUILD, BUILD_LAYERS } from './shaders.js';
import { chainPatch } from './common.js';

export const TERRAIN_LAYERS = ['coast_sand_03', 'damp_beach_sand', 'grass_ground', 'dry_ground_rocks', 'forest_leaves_04', 'marble_cliff_01', 'cliff_side', 'gravelly_sand', 'cobblestone_floor_01'];
export const ROAD_LAYERS = ['asphalt_02', 'asphalt_pit_lane'];

export class Materials {
  constructor(renderer, lighting, quality) {
    this.renderer = renderer; this.lighting = lighting; this.q = quality;
    this.time = { value: 0 };
    this.all = [];
    this.audit = [];           // {name, material, maps:[...]} for the scene statistics
  }

  async init(world, racingLine, onProgress = () => {}) {
    const aniso = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    let done = 0; const total = 9;
    const tick = () => onProgress(++done / total);
    const [terr, road, mapT, normT, mapR, normR, build, mapB, normB] = await Promise.all([
      loadTextureArray(TERRAIN_LAYERS, 1024, { aniso }).then(r => { tick(); return r; }),
      loadTextureArray(ROAD_LAYERS, 2048, { aniso }).then(r => { tick(); return r; }),
      loadTexture2D('grass_ground', 'albedo', { aniso }).then(r => { tick(); return r; }),
      loadTexture2D('grass_ground', 'normal', { aniso }).then(r => { tick(); return r; }),
      loadTexture2D('asphalt_02', 'albedo', { aniso }).then(r => { tick(); return r; }),
      loadTexture2D('asphalt_02', 'normal', { aniso }).then(r => { tick(); return r; }),
      loadTextureArray(BUILD_LAYERS, 1024, { aniso }).then(r => { tick(); return r; }),
      loadTexture2D('painted_plaster_wall', 'albedo', { aniso }).then(r => { tick(); return r; }),
      loadTexture2D('painted_plaster_wall', 'normal', { aniso }).then(r => { tick(); return r; }),
    ]);
    this.terr = terr; this.road = road; this.build = build;
    this.tex = { mapT, normT, mapR, normR, mapB, normB };
    this.lineTex = this._lineTexture(world.track, racingLine);
    this.len = world.track.length;
    this.terrain = this._terrain();
    this.roadMat = this._road();
    this.kerb = this._kerb();
  }

  _lineTexture(T, line) {
    const N = T.N, data = new Uint8Array(N * 4);
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < N; i++) {
      const off = line ? line.off[i] : 0;
      const k = line ? Math.min(1, Math.abs(line.kappa[i]) * 40) : 0.3;
      data[i * 4] = Math.max(0, Math.min(255, Math.round((off / 16 + 0.5) * 255)));
      data[i * 4 + 1] = Math.round(rnd() * 255);
      data[i * 4 + 2] = Math.round((0.35 + 0.65 * k) * 255);
      data[i * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    return t;
  }

  /** attach shader patch + CSM to a MeshStandardMaterial */
  patch(mat, def, uniforms, key) {
    chainPatch(mat, this.lighting, (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + def.vertHeader)
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + def.vertBody);
      let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + def.fragHeader).replace('#include <map_fragment>', def.fragMap);
      if (def.fragRough) fs = fs.replace('#include <roughnessmap_fragment>', def.fragRough);
      if (def.fragNormal) fs = fs.replace('#include <normal_fragment_maps>', def.fragNormal);
      shader.fragmentShader = fs;
    }, key);
    mat.userData.uniforms = uniforms;
    this.all.push(mat);
    return mat;
  }

  _terrain() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: this.tex.mapT, normalMap: this.tex.normT });
    m.name = 'terrain';
    const u = { tD: { value: this.terr.albedo }, tN: { value: this.terr.normal }, tA: { value: this.terr.arm }, uTime: this.time };
    this.audit.push({ name: 'terrain', material: m, arrays: [this.terr], near: true });
    return this.patch(m, TERRAIN, u, 'terrain-v1');
  }
  _road() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: this.tex.mapR, normalMap: this.tex.normR, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.name = 'road-asphalt';
    const u = {
      rD: { value: this.road.albedo }, rN: { value: this.road.normal }, rA: { value: this.road.arm },
      tD: { value: this.terr.albedo }, tN: { value: this.terr.normal }, tA: { value: this.terr.arm },
      tLine: { value: this.lineTex }, uLen: { value: this.len }, uTime: this.time,
    };
    this.audit.push({ name: 'road', material: m, arrays: [this.road, this.terr], near: true });
    return this.patch(m, ROAD, u, 'road-v1');
  }
  /** PBR material for buildings / walls / posts (texture-array layers chosen per vertex; plaster per instance) */
  makeBuilding(name = 'building', { instanced = true, side = THREE.FrontSide } = {}) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true, map: this.tex.mapB, normalMap: this.tex.normB, side });
    m.name = name;
    const u = { bD: { value: this.build.albedo }, bN: { value: this.build.normal }, bA: { value: this.build.arm }, uTime: this.time };
    this.audit.push({ name, material: m, arrays: [this.build], near: true });
    return this.patch(m, BUILD, u, 'build-v1' + (instanced ? 'i' : ''));
  }
  _kerb() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0, map: this.tex.mapR, normalMap: this.tex.normR, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    m.name = 'kerb';
    this.audit.push({ name: 'kerb', material: m, near: true });
    return this.patch(m, KERB, {}, 'kerb-v1');
  }
  update(t) { this.time.value = t; }
}
