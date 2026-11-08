// Builds the three.js scene objects for the world: terrain chunks, road, kerbs, sea.
// (P1 skeleton materials are plain; textured PBR materials replace them in materials.js.)
import * as THREE from 'three';

export function buildTerrainMeshes(world, material) {
  const group = new THREE.Group(); group.name = 'terrain';
  for (const c of world.terrain.chunks) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(c.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(c.normals, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(c.infos, 4));
    g.setIndex(new THREE.BufferAttribute(c.indices, 1));
    const b = c.bounds;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b.x0, b.y0 - 60, b.z0), new THREE.Vector3(b.x1, b.y1 + 2, b.z1));
    g.boundingSphere = new THREE.Sphere(); g.boundingBox.getBoundingSphere(g.boundingSphere);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true; m.castShadow = c.hi;
    m.userData.chunk = c.key;
    group.add(m);
  }
  return group;
}

export function buildRoadMeshes(road, material, kerbMaterial) {
  const group = new THREE.Group(); group.name = 'road';
  for (const c of road.chunks) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(c.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(c.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(c.uvs, 2));
    g.setAttribute('aRoad', new THREE.BufferAttribute(c.road1, 4));
    g.setAttribute('aRoad2', new THREE.BufferAttribute(c.road2, 4));
    g.setIndex(new THREE.BufferAttribute(c.indices, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true; m.userData.road = true;
    group.add(m);
  }
  for (const k of road.kerbs) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(k.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(k.normals, 3));
    g.setAttribute('aRoad', new THREE.BufferAttribute(k.road1, 4));
    g.setIndex(new THREE.BufferAttribute(k.indices, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, kerbMaterial);
    m.receiveShadow = true; m.userData.kerb = true;
    group.add(m);
  }
  return group;
}
