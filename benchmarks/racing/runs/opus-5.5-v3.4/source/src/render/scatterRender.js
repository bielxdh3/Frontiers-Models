// Builds instanced render data for scattered vegetation, props and rocks.
import * as THREE from 'three';
import { InstanceField } from './instancing.js';
import { buildSpecies, makeFoliageTextures, foliageMaterial } from '../world/vegetation.js';
import { buildProps, propMaterials, rockGeometry } from '../world/props.js';
import { withRepeat } from './textures.js';

export function buildScatterRender(scene, scatter, sets, quality) {
  const field = new InstanceField(scene);
  const foliageTex = makeFoliageTextures();
  const barkMat = {};
  for (const id of ['Bark012', 'Bark014', 'Bark001']) {
    const s = withRepeat(sets.bark[id], 1, 1);
    barkMat[id] = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.orm, roughness: 1, name: 'bark-' + id });
  }
  const folMat = {};
  for (const k of Object.keys(foliageTex)) folMat[k] = foliageMaterial(foliageTex[k], 'foliage-' + k);
  const VARIANTS = 2;
  const speciesInfo = {};
  const used = new Set(scatter.items.filter((i) => i.cat === 'tree' || i.cat === 'grass').map((i) => i.type));
  for (const kind of used) {
    for (let v = 0; v < VARIANTS; v++) {
      const sp = buildSpecies(kind, v);
      speciesInfo[kind] = sp;
      const parts = [];
      if (sp.trunk) parts.push({ geometry: sp.trunk, material: barkMat[sp.bark], name: 'trunk' });
      const casts = !(kind === 'grass' || kind.startsWith('shrub'));
      if (parts.length) parts[0].castShadow = casts;
      parts.push({ geometry: sp.foliage, material: folMat[sp.foliageTex], name: 'foliage', castShadow: casts });
      const dist = kind === 'grass' ? 160 : kind.startsWith('shrub') ? 420 : 1150;
      field.addType(`${kind}:${v}`, parts, { maxDist: dist, kind: 'vegetation', audit: { species: kind } });
    }
  }
  const pm = propMaterials(sets.prop);
  const builders = buildProps(pm);
  const builtProps = {};
  const propDist = { lamp: 650, flag: 650, bench: 300, bin: 260, umbrella: 500, lounger: 300, fence: 420, tower: 900, boat: 700, delineator: 350, chevron: 500, planter: 300, bollard: 250, cafe: 260, crate: 220, barrel: 220, picnic: 300, telescope: 260, tires: 300, kmstone: 260 };
  const rockMat = new THREE.MeshStandardMaterial({ ...pbrOf(withRepeat(sets.prop.rock, 0.6)), roughness: 1, name: 'rock' });
  for (let r = 0; r < 4; r++) field.addType('rock' + r, [{ geometry: rockGeometry(500 + r), material: rockMat, name: 'rock', castShadow: true }], { maxDist: 1200, kind: 'rock' });
  for (const it of scatter.items) {
    if (it.cat === 'prop' && !builtProps[it.type]) {
      const b = builders[it.type]; if (!b) continue;
      const built = b(); builtProps[it.type] = built;
      const bigProp = ['lamp', 'flag', 'umbrella', 'tower', 'boat', 'chevron', 'fence'].includes(it.type);
      field.addType(it.type, built.parts.map((p) => ({ ...p, castShadow: bigProp && p.castShadow !== false })), { maxDist: propDist[it.type] || 400, kind: 'prop' });
    }
  }
  for (const it of scatter.items) {
    if (it.cat === 'tree' || it.cat === 'grass') {
      const v = Math.abs(Math.floor(it.x * 13.37 + it.z * 7.1)) % VARIANTS;
      if (it.cat === 'tree') {
        // per-instance crown width / height / lean from a position hash: neighbours in a row never match
        const hh = (k) => { const q = Math.sin(it.x * 12.9898 * k + it.z * 78.233 + k * 3.17) * 43758.5453; return q - Math.floor(q); };
        const s = it.scale || 1, w = s * (0.86 + 0.28 * hh(1));
        field.add(`${it.type}:${v}`, it.x, it.y - 0.05, it.z, it.rot, [w, s * (0.84 + 0.32 * hh(2)), w * (0.9 + 0.2 * hh(3))], it.color, [(hh(4) - 0.5) * 0.09, (hh(5) - 0.5) * 0.09]);
      } else field.add(`${it.type}:${v}`, it.x, it.y - 0.05, it.z, it.rot, it.scale, it.color);
    } else if (it.cat === 'prop') {
      if (builtProps[it.type]) field.add(it.type, it.x, it.y, it.z, it.rot, it.scale, null);
    } else if (it.cat === 'rock') {
      field.add(it.type, it.x, it.y, it.z, it.rot, it.scale, null);
    }
  }
  return { field, pm, folMat, barkMat, rockMat, speciesInfo, foliageTex };
}

function pbrOf(s) { return { map: s.map, normalMap: s.normalMap, roughnessMap: s.orm }; }
