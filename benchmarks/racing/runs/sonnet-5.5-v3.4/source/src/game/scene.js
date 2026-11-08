// Builds the whole render world once: renderer, HDRI sky, sun + shadows, PBR ground, sea, road furniture, village, vegetation, post chain.
import * as THREE from 'three';
import { createWorld } from '../world/world.js';
import { buildRoadGeometry } from '../world/road-geometry.js';
import { buildTerrainMeshes, buildRoadMeshes } from '../render/world-view.js';
import { assertWorld, validateWorld } from '../world/validate.js';
import { RacingLine } from '../ai/racingline.js';
import { loadEnvironment } from '../render/environment.js';
import { createLighting, QUALITY } from '../render/lighting.js';
import { createPost } from '../render/post.js';
import { Materials } from '../render/materials.js';
import { Sea } from '../render/sea.js';
import { installHaze } from '../render/common.js';
import { buildBarriers } from '../render/barriers.js';
import { Vegetation } from '../render/vegetation.js';
import { placeVegetation, SpatialHash } from '../world/populate.js';
import { placeHouses } from '../render/houses.js';
import { Village, findChurchSite } from '../render/village.js';
import { placeProps } from '../world/props-place.js';
import { Props } from '../render/props.js';
import { buildBridge } from '../render/bridge.js';
import { PHYS } from './config.js';

export async function createScene({ canvas, params, onProgress = () => {} }) {
  const qName = params.get('q') === 'low' ? 'low' : 'high';
  const q = { ...QUALITY[qName], name: qName };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const state = { dpr, quality: q, qName };
  renderer.setPixelRatio(dpr * q.scale);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = params.get('tm') === 'aces' ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
  renderer.toneMappingExposure = +(params.get('exp') || 0.95);
  renderer.info.autoReset = false;      // draw calls / triangles are totals of the whole frame (all passes), reset by the game each frame
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fb4c8, 160, 4200);   // USE_FOG only; real haze is the HDRI-matched shader (render/common.js)
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 9000);
  scene.add(camera);

  onProgress(0.02, 'Céu e iluminação (HDRI)');
  const env = await loadEnvironment(renderer, scene, { envIntensity: +(params.get('env') || 0.75) });
  installHaze(env.haze, env.bgIntensity);
  const lighting = createLighting(scene, camera, env, q);
  lighting.setIntensity(+(params.get('sun') || 1));

  const world = await createWorld({ onProgress: (p, m) => onProgress(0.06 + p * 0.28, m) });
  if (params.get('dev') === '1') assertWorld(world);
  onProgress(0.36, 'Linha de corrida');
  const racing = new RacingLine(world.track, PHYS.line);
  onProgress(0.4, 'Texturas PBR');
  const materials = new Materials(renderer, lighting, q);
  await materials.init(world, racing, p => onProgress(0.4 + p * 0.22, 'Texturas PBR'));

  onProgress(0.64, 'Terreno e estrada');
  scene.add(buildTerrainMeshes(world, materials.terrain));
  const road = buildRoadGeometry(world.track);
  scene.add(buildRoadMeshes(road, materials.roadMat, materials.kerb));
  const barriers = buildBarriers(world, materials, lighting); scene.add(barriers.group);
  const bridge = buildBridge(world, materials); if (bridge) scene.add(bridge.group);
  const sea = new Sea(world, lighting, env, q); scene.add(sea.mesh);

  onProgress(0.72, 'Vila');
  const blocked = new SpatialHash(6);
  const churchSite = findChurchSite(world, []);                 // the church and its plaza are reserved before the houses fill the street
  if (churchSite) blocked.add(churchSite.pp.x, churchSite.pp.z, 21, { kind: 'church-site' });
  const houseList = placeHouses(world, blocked, 9);
  world.objects.houses = houseList;
  const village = new Village(world, lighting, materials, houseList, q, { site: churchSite }); scene.add(village.group);
  onProgress(0.78, 'Props e rochas');
  const propItems = placeProps(world, blocked, 21);
  const props = new Props(world, lighting, materials, q).build(propItems); scene.add(props.group);
  sea.setRocks(props.seaRocks);
  onProgress(0.82, 'Vegetação');
  const vegItems = placeVegetation(world, blocked, 7);
  const veg = new Vegetation(world, lighting, materials, q);
  await veg.init(); veg.build(vegItems); scene.add(veg.group);
  onProgress(0.92, 'Pós-processamento');
  const w = Math.floor(window.innerWidth * dpr * q.scale), h = Math.floor(window.innerHeight * dpr * q.scale);
  const post = createPost(renderer, scene, camera, q, { w, h });
  state.size = { w, h };
  return { renderer, scene, camera, env, lighting, world, racing, materials, barriers, sea, village, veg, props, propItems, bridge, post, state, validate: () => validateWorld(world) };
}
