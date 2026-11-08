// Village scene objects: instanced houses (8 variants), church with bell tower, lighthouse, paved plaza with fountain.
import * as THREE from 'three';
import { buildHouse, buildChurch, buildLighthouse } from './houses.js';
import { MeshBuilder } from './meshbuild.js';
import { BUILD_ID } from './shaders.js';

/** the church / plaza site: the first flat, free spot 33 m beside the street in the middle of Z3 (search is repeatable: same world -> same site) */
export function findChurchSite(world, houses = []) {
  const T = world.track, z3 = world.json.zones.find(z => z.id === 'Z3');
  for (let s = z3.s0 + 140; s < z3.s1 - 160; s += 6) {
    for (const side of [1, -1]) {
      const i = T.indexAtS(s), half = T.w[i] * 0.5;
      const lat = side * (half + 3 + 30), pp = T.roadPoint(i, lat, 0);
      let ymin = 1e9, ymax = -1e9, free = true;
      for (const [dx, dz] of [[-12, -12], [12, -12], [12, 12], [-12, 12], [0, 0]]) { const y = world.terrain.sample(pp.x + dx, pp.z + dz); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      if (ymax - ymin > 1.6) continue;
      for (const h of houses) if (Math.hypot(h.x - pp.x, h.z - pp.z) < 20) { free = false; break; }
      if (free) return { i, side, pp, s };
    }
  }
  return null;
}

export class Village {
  constructor(world, lighting, materials, houses, quality, opts = {}) {
    this.world = world; this.houses = houses;
    this.group = new THREE.Group(); this.group.name = 'village';
    const mat = materials.makeBuilding('house-instanced');
    const matS = materials.makeBuilding('landmark', { instanced: false });
    this.stats = { houses: houses.length, variants: 0, tris: 0 };
    const geos = []; for (let v = 0; v < 8; v++) geos.push(buildHouse(v, 31));
    const by = new Map(); for (const h of houses) { if (!by.has(h.variant)) by.set(h.variant, []); by.get(h.variant).push(h); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    for (const [v, list] of by) {
      const g = geos[v].clone();
      const aP = new Float32Array(list.length * 4);
      const im = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((h, k) => {
        q.setFromAxisAngle(up, h.yaw); p.set(h.x, h.y, h.z); m4.compose(p, q, one); im.setMatrixAt(k, m4);
        c.setRGB(h.tint[0], h.tint[1], h.tint[2]); im.setColorAt(k, c);
        aP[k * 4] = h.plaster; aP[k * 4 + 3] = h.y;
      });
      g.setAttribute('aInstP', new THREE.InstancedBufferAttribute(aP, 4));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; im.name = 'houses-v' + v;
      this.group.add(im); this.stats.variants++; this.stats.tris += geos[v].userData.tris * list.length;
    }
    this.stats.trisPerHouse = Math.round(geos.reduce((a, g) => a + g.userData.tris, 0) / 8);
    // ---- landmarks: church on the plaza, lighthouse on the west headland
    const T = world.track;
    const z3 = world.json.zones.find(z => z.id === 'Z3');
    const best = opts.site || findChurchSite(world, houses);
    this.church = null; this.lighthouse = null;
    const registerLandmark = (kind, x, z, y, r) => world.objects.props.push({ kind, x, z, r, baseY: y, landmark: true });
    if (best) {
      const cg = buildChurch(5), cm = new THREE.Mesh(cg, matS); cm.castShadow = true; cm.receiveShadow = true; cm.name = 'church';
      const dirx = T.rx[best.i] * -best.side, dirz = T.rz[best.i] * -best.side;
      const yaw = Math.atan2(dirx, dirz);
      const y = world.terrain.sample(best.pp.x, best.pp.z);
      cm.position.set(best.pp.x, y, best.pp.z); cm.rotation.y = yaw; cm.updateMatrixWorld();
      this.group.add(cm); this.church = { mesh: cm, x: best.pp.x, y, z: best.pp.z, height: cg.userData.H, s: best.s, side: best.side };
      registerLandmark('church', best.pp.x, best.pp.z, y, 10);
      this.stats.tris += cg.userData.tris;
      this.group.add(this._plaza(world, best, yaw, matS));
    }
    const lx = -338, lz = -352;
    const ly = world.terrain.sample(lx, lz);
    const lg = buildLighthouse(), lm = new THREE.Mesh(lg, matS); lm.position.set(lx, ly, lz); lm.castShadow = true; lm.receiveShadow = true; lm.name = 'lighthouse';
    this.group.add(lm); this.lighthouse = { mesh: lm, x: lx, y: ly, z: lz, height: lg.userData.H };
    registerLandmark('lighthouse', lx, lz, ly, 4);
    this.stats.tris += lg.userData.tris;
  }

  _plaza(world, best, yaw, matS) {
    const mb = new MeshBuilder();
    const T = world.track, half = T.w[best.i] * 0.5;
    const cx = best.pp.x, cz = best.pp.z, c = Math.cos(yaw), s = Math.sin(yaw);
    const W = 34, D = 30, cell = 2.0, z0 = 8;
    const nx = Math.round(W / cell), nz = Math.round(D / cell);
    const P = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const lx = -W / 2 + i * cell, lz = z0 + j * cell;
      const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
      const y = world.terrain.sample(x, z) + 0.05;
      const q = T.nearest(x, z, 80, -1);
      P.push({ x, y, z, off: Math.abs(q.lat) < half + 3.3 });
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = P[j * (nx + 1) + i], b = P[j * (nx + 1) + i + 1], d = P[(j + 1) * (nx + 1) + i], e = P[(j + 1) * (nx + 1) + i + 1];
      if (a.off || b.off || d.off || e.off) continue;
      const u0 = i * cell, u1 = (i + 1) * cell, v0 = j * cell, v1 = (j + 1) * cell;
      mb.quad([a.x, a.y, a.z], [d.x, d.y, d.z], [e.x, e.y, e.z], [b.x, b.y, b.z], { mat: BUILD_ID.cobblestone_floor_01, color: [1.0, 0.96, 0.88], uvs: [[u0, v0], [u0, v1], [u1, v1], [u1, v0]], inst: [0, 0, 0, a.y] });
    }
    const fxl = 0, fzl = z0 + D * 0.52, fx = cx + fxl * c + fzl * s, fz = cz - fxl * s + fzl * c, fy = world.terrain.sample(fx, fz);
    const prof = [[0, 0.0], [2.6, 0.0], [2.7, 0.15], [2.7, 0.75], [2.45, 0.8], [2.45, 0.7], [2.3, 0.7], [2.3, 0.2], [0.5, 0.25], [0.4, 0.5], [0.3, 1.5], [0.7, 1.7], [0.9, 1.9], [0.55, 2.0], [0.15, 2.3], [0.05, 2.9]];
    for (let k = 0; k < prof.length - 1; k++) mb.cylinder(fx, fz, fy + prof[k][1] + 0.05, fy + prof[k + 1][1] + 0.05, prof[k][0] + 0.001, prof[k + 1][0] + 0.001, 28, { mat: BUILD_ID.stone_wall, color: [1, 0.97, 0.92], cap: false, inst: [0, 0, 0, fy] });
    mb.cylinder(fx, fz, fy + 0.7, fy + 0.72, 2.3, 2.3, 28, { mat: BUILD_ID.concrete_wall_007, color: [0.28, 0.55, 0.6] });
    const m = new THREE.Mesh(mb.toGeometry(), matS); m.castShadow = true; m.receiveShadow = true; m.name = 'plaza';
    return m;
  }
}
