// Chunked instanced rendering for vegetation and props: instances are
// partitioned in spatial tiles; each tile/part is an InstancedMesh (frustum
// culled by three), with distance culling scaled by the quality preset.
// Vegetation shadows: the colour tiles never cast; a dynamic, shadow-only
// instanced set (layer SHADOW_ONLY_LAYER, seen by the CSM shadow cameras but
// not by the main camera) holds only the trees near the camera.
import * as THREE from 'three';

const TILE = 420;
export const SHADOW_ONLY_LAYER = 6;

export class InstanceField {
  constructor(scene) {
    this.scene = scene; this.types = new Map(); this.tiles = []; this.group = new THREE.Group(); this.group.name = 'instances';
    scene.add(this.group); this.distScale = 1; this.shadowDist = 150;
    this.vegShadowR = 110; this._shadowAt = null; this._shadowT = 0;
  }
  /** parts: [{geometry, material, castShadow, receiveShadow}], maxDist in metres */
  addType(key, parts, { maxDist = 900, kind = 'prop', audit = {} } = {}) {
    this.types.set(key, { key, parts, maxDist, kind, audit, items: [] });
  }
  add(key, x, y, z, rotY = 0, scale = 1, color = null, tilt = null) {
    const t = this.types.get(key); if (!t) throw new Error('unknown instance type ' + key);
    t.items.push({ x, y, z, rotY, scale, color, tilt });
  }
  build() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    for (const t of this.types.values()) {
      // vegetation, rocks and shadow-casting props: only the instances near the camera cast (dynamic set)
      const castsAny = t.parts.some((pt) => (t.kind === 'prop' ? pt.castShadow === true : pt.castShadow !== false));
      const dynShadow = (t.kind === 'vegetation' || t.kind === 'rock' || t.kind === 'prop') && castsAny;
      // per-item matrices (also used by the dynamic shadow set)
      t.mats = new Float32Array(t.items.length * 16);
      t.items.forEach((it, i) => {
        e.set(it.tilt ? it.tilt[0] : 0, it.rotY, it.tilt ? it.tilt[1] : 0, 'YXZ'); q.setFromEuler(e);
        s.set(it.scale, it.scale, it.scale); if (Array.isArray(it.scale)) s.set(it.scale[0], it.scale[1], it.scale[2]);
        p.set(it.x, it.y, it.z); m.compose(p, q, s); m.toArray(t.mats, i * 16);
      });
      const bins = new Map();
      t.items.forEach((it, i) => {
        const k = Math.floor(it.x / TILE) + ',' + Math.floor(it.z / TILE);
        let b = bins.get(k); if (!b) { b = []; bins.set(k, b); } b.push(i);
      });
      for (const [k, idx] of bins) {
        const [tx, tz] = k.split(',').map(Number);
        const tile = { cx: (tx + 0.5) * TILE, cz: (tz + 0.5) * TILE, meshes: [], type: t };
        for (const part of t.parts) {
          const im = new THREE.InstancedMesh(part.geometry, part.material, idx.length);
          im.castShadow = !dynShadow && part.castShadow !== false; im.receiveShadow = part.receiveShadow !== false; im.userData.castsShadow = im.castShadow;
          im.name = `${t.key}:${part.name || 'part'}`;
          im.userData.audit = { kind: t.kind, type: t.key, ...t.audit, ...(part.audit || {}) };
          idx.forEach((ii, j) => {
            m.fromArray(t.mats, ii * 16); im.setMatrixAt(j, m);
            const it = t.items[ii];
            if (it.color !== null && it.color !== undefined) { c.set(it.color); im.setColorAt(j, c); }
          });
          im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.computeBoundingSphere(); im.computeBoundingBox();
          this.group.add(im); tile.meshes.push(im);
        }
        this.tiles.push(tile);
      }
      if (dynShadow) {
        const cap = Math.min(t.items.length, 700);
        t.shadow = t.parts.filter((pt) => pt.castShadow !== false).map((pt) => {
          const im = new THREE.InstancedMesh(pt.geometry, pt.material, cap);
          im.count = 0; im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false;
          im.layers.set(SHADOW_ONLY_LAYER);
          im.name = `${t.key}:${pt.name || 'part'}:shadow`;
          im.userData.audit = { kind: 'collider', invisible: true, shadowOnly: true };
          this.group.add(im);
          return im;
        });
      }
    }
  }
  _rebuildShadows(camPos) {
    const R2 = this.vegShadowR * this.vegShadowR;
    for (const t of this.types.values()) {
      if (!t.shadow) continue;
      const cap = t.shadow[0].instanceMatrix.count;
      let n = 0;
      for (let i = 0; i < t.items.length && n < cap; i++) {
        const it = t.items[i]; const dx = it.x - camPos.x, dz = it.z - camPos.z;
        if (dx * dx + dz * dz > R2) continue;
        for (const im of t.shadow) im.instanceMatrix.array.set(t.mats.subarray(i * 16, i * 16 + 16), n * 16);
        n++;
      }
      for (const im of t.shadow) { im.count = n; im.instanceMatrix.needsUpdate = true; }
    }
  }
  update(camPos) {
    for (const t of this.tiles) {
      const d = Math.hypot(camPos.x - t.cx, camPos.z - t.cz) - TILE * 0.7;
      const vis = d < t.type.maxDist * this.distScale;
      const shadowOK = d < this.shadowDist;
      for (const m of t.meshes) { m.visible = vis; m.castShadow = m.userData.castsShadow && shadowOK; }
    }
    // shadow-only vegetation near the camera, refreshed when the camera moved ~12 m
    const now = performance.now();
    if (!this._shadowAt || Math.hypot(camPos.x - this._shadowAt.x, camPos.z - this._shadowAt.z) > 12 || now - this._shadowT > 1500) {
      this._shadowAt = { x: camPos.x, z: camPos.z }; this._shadowT = now;
      this._rebuildShadows(camPos);
    }
  }
  count(key) { const t = this.types.get(key); return t ? t.items.length : 0; }
}
