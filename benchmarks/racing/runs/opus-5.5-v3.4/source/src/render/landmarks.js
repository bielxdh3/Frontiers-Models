// Hand-built (procedural) landmarks positioned by distance along the spline:
// start/finish gantry with start lights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function nonIdx(g) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; }

export function buildGantry(world, pm) {
  const T = world.track, s = T.features.startS;
  const fr = T.frame(s, {});
  const hw = fr.w / 2;
  const g = new THREE.Group(); g.name = 'start-gantry';
  const yaw = Math.atan2(-fr.tz, fr.tx); // local X along the road
  const span = hw + 2.9;
  const H = 6.6;
  const cols = [], truss = [];
  for (const side of [-1, 1]) {
    const c = new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.42, 0.5], [0.3, 0.6], [0.26, H], [0.34, H + 0.1], [0, H + 0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
    c.translate(0, 0, side * span); cols.push(nonIdx(c));
  }
  // box truss: 4 chords + diagonals
  const L = span * 2;
  for (const [y, z] of [[H - 0.15, -0.45], [H - 0.15, 0.45], [H + 0.75, -0.45], [H + 0.75, 0.45]]) { const ch = new THREE.CylinderGeometry(0.06, 0.06, L, 8); ch.rotateX(Math.PI / 2); ch.rotateY(Math.PI / 2); ch.translate(0, y, 0); ch.rotateY(Math.PI / 2); ch.translate(0, 0, 0); truss.push(nonIdx(rotZtoAxis(ch, y, z, L))); }
  const n = 14;
  for (let i = 0; i < n; i++) {
    const z0 = -span + (i / n) * L, z1 = -span + ((i + 1) / n) * L;
    for (const zz of [-0.45, 0.45]) truss.push(nonIdx(strut(new THREE.Vector3(zz, H - 0.15, z0), new THREE.Vector3(zz, H + 0.75, z1))));
    truss.push(nonIdx(strut(new THREE.Vector3(-0.45, H + 0.75, z0), new THREE.Vector3(0.45, H + 0.75, z1))));
  }
  const banner = new THREE.PlaneGeometry(L - 1.2, 1.1, 8, 2); banner.rotateY(Math.PI / 2); banner.translate(0.5, H + 0.3, 0);
  const banner2 = banner.clone(); banner2.rotateY(Math.PI);
  const colMesh = new THREE.Mesh(mergeGeometries(cols), pm.whiteMetal); colMesh.castShadow = true; colMesh.receiveShadow = true;
  const trussMesh = new THREE.Mesh(mergeGeometries(truss), pm.galv); trussMesh.castShadow = true;
  const banMesh = new THREE.Mesh(mergeGeometries([nonIdx(banner), nonIdx(banner2)]), pm.banner); banMesh.castShadow = true;
  // start lights: 5 pods under the truss
  const lights = [];
  const lightMat = [];
  const pod = new RoundedBoxGeometry(0.34, 0.34, 0.34, 2, 0.06);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x220806, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.3, name: 'start-light' });
    m.userData.audit = 'emissive';
    const mesh = new THREE.Mesh(pod, m); mesh.position.set(-0.55, H - 0.55, (i - 2) * 0.55); lights.push(mesh); lightMat.push(m);
  }
  const housing = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 3.0, 2, 0.08), pm.greenMetal); housing.position.set(-0.5, H - 0.55, 0); housing.castShadow = true;
  g.add(colMesh, trussMesh, banMesh, housing, ...lights);
  for (const m of [colMesh, trussMesh, banMesh, housing, ...lights]) m.userData.audit = { kind: 'infra', type: 'gantry' };
  // orient: group local Z across the road, X along the road
  g.position.set(fr.x, fr.y, fr.z);
  g.rotation.y = yaw;
  world.placed.push({ kind: 'infra', name: 'gantry', x: fr.x, z: fr.z, radius: 0, baseY: fr.y });
  return { group: g, lights: lightMat };
}

function strut(a, b) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const c = new THREE.CylinderGeometry(0.035, 0.035, len, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  c.applyQuaternion(q); c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return c;
}
function rotZtoAxis(c, y, x, L) {
  const g = new THREE.CylinderGeometry(0.06, 0.06, L, 8); g.rotateX(Math.PI / 2); g.translate(x, y, 0); return g;
}
