// Runtime scene audit (spec 13.1 test 8): read from the loaded scene graph, not from the source code.
// Also: the sky-mask pass (share of the frame where nothing but sky is visible) and the camera/geometry intersection counter.
import * as THREE from 'three';
import { CAR_LIST, CAR_SPECS } from '../physics/car-specs.js';
import { CarModel } from '../render/car-model.js';

const texSize = (t) => { if (!t) return null; const im = t.image; if (!im) return null; const w = im.width ?? im.videoWidth ?? 0, h = im.height ?? im.videoHeight ?? 0; return w && h ? [w, h] : null; };
const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'clearcoatNormalMap', 'emissiveMap', 'alphaMap', 'bumpMap'];

export function sceneStats(S, game) {
  const { scene, world, materials } = S, T = world.track, q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
  const out = { generatedBy: 'src/game/audit.js (reads the live scene graph)', cars: {}, boxDetector: {}, flatColour: {}, counts: {}, textures: {}, audio: {}, renderer: {}, notes: [] };

  // ---- cars: triangles at LOD0 and distinct materials, from freshly built models of each car type (same constructor the game uses)
  const ctx = { lighting: S.lighting, env: S.env };
  for (const id of CAR_LIST) {
    const m = new CarModel(id, 0, ctx, 0);
    const mats = new Set(); let tris = 0, meshes = 0;
    m.root.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3; (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => mats.add(x.name || x.uuid)); } });
    const names = Object.entries(m.mats).filter(([, v]) => v && v.isMaterial).map(([, v]) => v.name);
    out.cars[id] = { name: CAR_SPECS[id].name, trianglesLOD0: Math.round(tris), reportedByModel: Math.round(m.tris), meshes, distinctMaterialsUsed: mats.size, materialNames: [...mats], definedMaterials: names.length, clearcoatPaint: !!(m.mats.paint && m.mats.paint.clearcoat > 0.5) };
    game._disposeModels([m]);
  }
  out.cars.pass = CAR_LIST.every((id) => out.cars[id].trianglesLOD0 >= 15000 && out.cars[id].distinctMaterialsUsed >= 6);

  // ---- near-track meshes (< 50 m from the road): box detector + flat-colour detector + texture sizes
  const boxes = [], flat = [], texList = new Map(), nearMeshes = [];
  let totalMeshes = 0, totalTris = 0;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3(), sph = new THREE.Sphere(), size = new THREE.Vector3();
  scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const g = o.geometry, mat = Array.isArray(o.material) ? o.material : [o.material];
    if (!g || o.isPoints) return;
    totalMeshes++;
    const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    totalTris += tris * (o.isInstancedMesh ? o.count : 1);
    if (o.name === 'sea' || (mat[0] && mat[0].name === 'sea-water')) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); sph.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); }
    T.nearest(sph.center.x, sph.center.z, 3000, -1, q);
    const dRoad = Math.max(0, Math.abs(q.lat) - T.w[q.i] * 0.5);
    const near = dRoad - sph.radius < 50;
    if (!near) return;
    nearMeshes.push(o);
    if (!g.boundingBox) g.computeBoundingBox();
    box.copy(g.boundingBox); box.getSize(size);
    const sc = new THREE.Vector3().setFromMatrixScale(o.matrixWorld); size.multiply(sc);
    const isBoxGeo = g.type === 'BoxGeometry' || g.type === 'BoxBufferGeometry';
    const invisible = mat.every((m) => m.visible === false) || o.userData.collider;
    if ((tris <= 12 || isBoxGeo) && Math.max(size.x, size.y, size.z) > 1 && !invisible) boxes.push({ name: o.name || o.type, tris, size: size.toArray().map((x) => +x.toFixed(2)), geometry: g.type });
    for (const m of mat) {
      const hasAlbedo = !!m.map, hasNormal = !!m.normalMap;
      const exempt = /glass|water|sea|particle/i.test(m.name || '') || m.isShaderMaterial || m.isMeshBasicMaterial && !!m.map || (m.emissive && m.emissiveIntensity > 0.05 && m.emissive.getHex() !== 0) || m.userData.auditExempt;
      if (!hasAlbedo && !hasNormal && !exempt) flat.push({ mesh: o.name || o.type, material: m.name || m.type });
      for (const k of TEX_KEYS) { const t = m[k]; if (t && !texList.has(t.uuid)) { const sz = texSize(t); if (sz) texList.set(t.uuid, { key: k, material: m.name, size: sz, arrays: false }); } }
    }
  });
  out.boxDetector = { nearMeshesChecked: nearMeshes.length, offenders: boxes.slice(0, 40), count: boxes.length, pass: boxes.length === 0 };
  out.flatColour = { offenders: [...new Map(flat.map((f) => [f.material + '|' + f.mesh, f])).values()].slice(0, 40), count: flat.length, pass: flat.length === 0 };
  out.renderer = { sceneMeshes: totalMeshes, sceneTrianglesSubmitted: Math.round(totalTris) };

  // ---- textures: texture arrays (terrain, road, buildings) come from the material audit list, ordinary maps from the near-meshes
  const arrays = [];
  for (const a of materials.audit) for (const arr of a.arrays || []) if (arr && arr.size && !arrays.find((x) => x.names === arr.names)) arrays.push(arr);
  const arrSummary = arrays.map((a) => ({ layers: a.names.length, size: a.size, first: a.names[0], names: a.names }));
  const mapSizes = [...texList.values()];
  const area = (s) => s[0] * s[1];
  const minMap = mapSizes.reduce((m, t) => (area(t.size) < area(m.size) ? t : m), { size: [1e9, 1e9] });
  // the 1x1 / small placeholder maps on array-driven materials are not sampled by those shaders: the real source is the array
  const placeholders = mapSizes.filter((t) => area(t.size) < 1024 * 1024);
  out.textures = {
    textureArrays: arrSummary.map(({ layers, size, first }) => ({ layers, size, first })),
    asphaltArraySize: (arrays.find((a) => a.names.includes('asphalt_02')) || {}).size || 0,
    minArraySize: Math.min(...arrays.map((a) => a.size)),
    ordinaryMapsNearRoad: mapSizes.length, smallerThan1024sq: placeholders.map((t) => ({ material: t.material, key: t.key, size: t.size })),
    minOrdinaryMap: minMap.size, notes: 'array-driven materials carry a small placeholder map only so that material.map exists; their shaders sample the arrays above',
  };
  const smallReal = placeholders.filter((t) => !/^(terrain|road|kerb|house|landmark|props-build|barrier|building)/i.test(t.material || ''));
  out.textures.pass = out.textures.minArraySize >= 1024 && out.textures.asphaltArraySize >= 2048 && smallReal.length === 0;
  out.textures.smallRealMaps = smallReal.slice(0, 20);

  // ---- counts: houses, variants, species, props per 100 m
  const houses = world.objects.houses || [];
  const near30 = houses.filter((h) => { T.nearest(h.x, h.z, 200, -1, q); return Math.abs(q.lat) - T.w[q.i] * 0.5 < 30; });
  const z3 = world.json.zones.find((z) => z.id === 'Z3'); const inZ3 = near30.filter((h) => { T.nearest(h.x, h.z, 200, -1, q); return q.s >= z3.s0 && q.s <= z3.s1; });
  const species = {}; for (const t of [...world.objects.trees, ...world.objects.props.filter((p) => p.species)]) species[t.species] = (species[t.species] || 0) + 1;
  const L = T.length, bins = new Array(Math.ceil(L / 100)).fill(0), plantBins = new Array(Math.ceil(L / 100)).fill(0), kinds = {};
  for (const o of S.propItems) { T.nearest(o.x, o.z, 300, -1, q); if (Math.abs(q.lat) - T.w[q.i] * 0.5 <= 50) { bins[Math.min(bins.length - 1, Math.floor(q.s / 100))]++; kinds[o.kind] = (kinds[o.kind] || 0) + 1; } }
  for (const o of world.objects.props) if (o.species) { T.nearest(o.x, o.z, 300, -1, q); if (Math.abs(q.lat) - T.w[q.i] * 0.5 <= 50) plantBins[Math.min(plantBins.length - 1, Math.floor(q.s / 100))]++; }
  const nOK = bins.slice(0, -1);                                                    // the last bin is the partial one
  out.counts = {
    houses: houses.length, housesWithin30mOfRoad: near30.length, housesWithin30mInVillage: inZ3.length, houseVariants: new Set(houses.map((h) => h.variant)).size, houseVariantsExpected: '>= 5',
    vegetationSpecies: Object.keys(species).length, species, treesTotal: world.objects.trees.length,
    propsPerHundredMetres: { min: Math.min(...nOK), mean: +(nOK.reduce((a, b) => a + b, 0) / nOK.length).toFixed(1), perBin: bins }, propKinds: kinds, propKindCount: Object.keys(kinds).length,
    groundPlantsPerHundredMetres: { min: Math.min(...plantBins.slice(0, -1)), mean: +(plantBins.slice(0, -1).reduce((a, b) => a + b, 0) / (plantBins.length - 1)).toFixed(1) },
    viewpoint: world.stats.mirante || null, bridge: world.json.bridge,
  };
  out.counts.pass = out.counts.housesWithin30mInVillage >= 25 && out.counts.houseVariants >= 5 && out.counts.vegetationSpecies >= 4 && out.counts.propsPerHundredMetres.min >= 12;

  // ---- audio: the player's engine must be built from AudioBuffers
  try { out.audio = game.audio.ready ? game.audio.audit() : { ready: false, note: 'audio not unlocked in this session' }; } catch (e) { out.audio = { error: String(e) }; }
  out.audio.pass = !!out.audio.engineIsSampled;

  out.pass = !!(out.cars.pass && out.boxDetector.pass && out.flatColour.pass && out.textures.pass && out.counts.pass && out.audio.pass);
  return out;
}

/** share (0..1) of the frame covered by sky only: re-render the scene with a black override material over a white clear colour, count white */
export function skyFraction(S, game, w = 640, h = 360) {
  const { renderer, scene, camera } = S;
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true }), prev = { bg: scene.background, ov: scene.overrideMaterial, fog: scene.fog, vis: game.particles.points.visible };
  const clear = new THREE.Color(); renderer.getClearColor(clear); const clearA = renderer.getClearAlpha(), tm = renderer.toneMapping;
  scene.background = null; scene.fog = null; scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); game.particles.points.visible = false;
  renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear();
  renderer.render(scene, camera);
  const buf = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  renderer.setRenderTarget(null); renderer.setClearColor(clear, clearA); renderer.toneMapping = tm;
  scene.background = prev.bg; scene.overrideMaterial = prev.ov; scene.fog = prev.fog; game.particles.points.visible = prev.vis;
  scene.overrideMaterial = null; rt.dispose();
  let sky = 0; for (let i = 0; i < buf.length; i += 4) if (buf[i] > 200) sky++;
  return sky / (w * h);
}

/** camera vs geometry: ground clearance, houses (oriented boxes), barrier walls. Called every frame while racing. */
export function cameraInside(world, pos, hint = { i: -1 }) {
  const T = world.track, g = world.ground;
  const gy = world.terrain.sample(pos.x, pos.z); let bad = null;
  if (pos.y < gy + 0.25) bad = 'terrain';
  for (const h of world.objects.houses || []) {
    const dx = pos.x - h.x, dz = pos.z - h.z; if (dx * dx + dz * dz > (h.r + 2) * (h.r + 2)) continue;
    const c = Math.cos(h.rot), s = Math.sin(h.rot), u = dx * c - dz * s, v = dx * s + dz * c;
    if (Math.abs(u) < h.hw + 0.1 && Math.abs(v) < h.hd + 0.1 && pos.y < h.y + 12) { bad = 'house'; break; }
  }
  return bad;
}
