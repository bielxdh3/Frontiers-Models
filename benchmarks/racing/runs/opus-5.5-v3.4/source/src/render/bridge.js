// Stone arch viaduct under the bridge deck (span taken from track.json features).
// Each span is an extruded wall with a semicircular arch opening; piers reach the
// ravine floor (terrain raycast) so the bridge is tied to the terrain.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { withRepeat } from './textures.js';
import { shoulderWidth } from '../world/profile.js';

export function buildBridge(world, sets) {
  const T = world.track, b = T.features.bridge, tr = world.terrain;
  const L = T.delta(b.s0, b.s1);
  const sMid = T.wrap(b.s0 + L / 2);
  const f = T.frame(sMid, {});
  const hw = f.w / 2 + shoulderWidth(T, sMid);
  // the bridge segment is straight: use its tangent as the local axis
  const tx = f.tx, tz = f.tz; const tl = Math.hypot(tx, tz);
  const ax = tx / tl, az = tz / tl;
  const yaw = Math.atan2(az, ax);
  const extra = 10; // extend under the abutments
  const total = L + extra * 2;
  const nSpans = Math.max(3, Math.round(total / 19));
  const spanLen = total / nSpans;
  const geos = [];
  const deckBottom = (s) => T.heightAt(s, 0) - b.deck;
  let minFloor = Infinity;
  for (let k = 0; k < nSpans; k++) {
    const sA = b.s0 - extra + k * spanLen, sB = sA + spanLen;
    const pA = T.point(sA, 0), pB = T.point(sB, 0);
    const yTop = Math.min(deckBottom(sA), deckBottom(sB)) + 0.02;
    const floor = Math.min(tr.heightAt(pA[0], pA[2]), tr.heightAt(pB[0], pB[2]), tr.heightAt((pA[0] + pB[0]) / 2, (pA[2] + pB[2]) / 2)) - 1.5;
    minFloor = Math.min(minFloor, floor);
    const h = yTop - floor;
    if (h < 1.5) continue;
    const pier = 2.2;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(spanLen, 0); shape.lineTo(spanLen, h); shape.lineTo(0, h); shape.lineTo(0, 0);
    const archW = spanLen - pier, rad = archW / 2;
    const springY = Math.max(1.0, h - rad - 1.4);
    if (springY + rad < h - 0.6) {
      const hole = new THREE.Path();
      hole.moveTo(pier / 2, 0);
      hole.lineTo(pier / 2, springY);
      hole.absarc(spanLen / 2, springY, rad, Math.PI, 0, true);
      hole.lineTo(spanLen - pier / 2, 0);
      hole.lineTo(pier / 2, 0);
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: hw * 2 - 0.3, bevelEnabled: false, curveSegments: 18 });
    // local: x along bridge, y up, z across -> translate to centre across
    g.translate(0, 0, -(hw * 2 - 0.3) / 2);
    // uv: world-ish scale
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) * 0.45, p.getY(i) * 0.45);
    const m = new THREE.Matrix4().makeRotationY(-yaw);
    g.applyMatrix4(m);
    g.translate(pA[0], floor, pA[2]);
    geos.push(g.index ? g.toNonIndexed() : g);
    // pier buttresses (cutwaters) at the start of each span
    const cw = new THREE.CylinderGeometry(1.25, 1.5, h - 0.6, 6, 1);
    cw.translate(0, floor + (h - 0.6) / 2, 0);
    cw.applyMatrix4(new THREE.Matrix4().makeTranslation(pA[0], 0, pA[2]));
    for (const side of [-1, 1]) { const c2 = cw.clone(); c2.translate(-az * side * (hw - 0.2) * 0, 0, 0); }
    void cw;
  }
  const s = withRepeat(sets.stone, 1);
  const mat = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.orm, aoMap: s.orm, roughness: 1, name: 'bridge-stone' });
  const merged = mergeGeometries(geos.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
  merged.computeVertexNormals(); merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'bridge'; mesh.userData.audit = { kind: 'infra', type: 'bridge' };
  world.placed.push({ kind: 'infra', name: 'bridge', x: f.x, z: f.z, radius: 0, baseY: minFloor });
  // stream along the ravine floor
  const stream = streamMesh(world, f, ax, az);
  const grp = new THREE.Group(); grp.name = 'bridge-group'; grp.add(mesh); if (stream) grp.add(stream);
  return grp;
}

function streamMesh(world, f, ax, az) {
  const tr = world.terrain;
  // the ravine axis is perpendicular to the road: follow the lowest terrain along it
  const rx = -az, rz = ax;
  const pos = [], idx = [];
  let n = 0;
  for (let t = -150; t <= 150; t += 3) {
    // find the floor across a small window
    let best = null;
    for (let a = -14; a <= 14; a += 1) { const x = f.x + rx * t + ax * a, z = f.z + rz * t + az * a; const h = tr.heightAt(x, z); if (!best || h < best[2]) best = [x, z, h]; }
    const [x, z, h] = best;
    const y = h + 0.18;
    pos.push(x - ax * 1.6, y, z - az * 1.6, x + ax * 1.6, y, z + az * 1.6);
    if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t2 = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t2; } g.computeVertexNormals(); }
  const m = new THREE.MeshStandardMaterial({ color: 0x24434a, roughness: 0.06, metalness: 0.05, envMapIntensity: 1.4, name: 'stream-water' });
  m.userData.audit = 'water';
  const mesh = new THREE.Mesh(g, m); mesh.name = 'stream'; mesh.userData.audit = { kind: 'water' };
  return mesh;
}
