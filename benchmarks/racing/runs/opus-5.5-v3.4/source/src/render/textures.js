// Texture loading (CC0 PBR sets packed as albedo / normal / ORM) with caching.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 8;
export function setAnisotropy(a) { maxAniso = a; }
export const loadedTextures = new Set();

function load(url, srgb) {
  const key = url + (srgb ? '|s' : '|l');
  if (cache.has(key)) return cache.get(key);
  const p = loader.loadAsync(url).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.userData.src = url;
    loadedTextures.add(t);
    return t;
  });
  cache.set(key, p);
  return p;
}

export async function loadPBR(id) {
  const base = `./assets/tex/${id}/`;
  const [map, normalMap, orm] = await Promise.all([load(base + 'albedo.jpg', true), load(base + 'normal.jpg', false), load(base + 'orm.jpg', false)]);
  return { id, map, normalMap, orm };
}

/** clone textures with an independent repeat */
export function withRepeat(set, rx, ry = rx) {
  const c = (t) => { const n = t.clone(); n.repeat.set(rx, ry); n.needsUpdate = true; n.userData.src = t.userData.src; loadedTextures.add(n); return n; };
  return { id: set.id, map: c(set.map), normalMap: c(set.normalMap), orm: c(set.orm) };
}

/** standard PBR material from a packed set */
export function pbrMaterial(set, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.orm, aoMap: opts.ao === false ? null : set.orm, metalnessMap: opts.metal ? set.orm : null,
    roughness: opts.roughness ?? 1, metalness: opts.metalness ?? 0, color: opts.color ?? 0xffffff, normalScale: new THREE.Vector2(opts.normal ?? 1, opts.normal ?? 1),
    envMapIntensity: opts.env ?? 1,
  });
  m.aoMapIntensity = opts.aoIntensity ?? 1;
  if (opts.side) m.side = opts.side;
  m.name = opts.name || set.id;
  return m;
}
