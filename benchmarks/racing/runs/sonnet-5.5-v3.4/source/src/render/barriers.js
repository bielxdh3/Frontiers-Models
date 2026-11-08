// Road furniture derived from the track sections (single source): guardrails, low walls, bridge parapets,
// start/finish gantry with countdown lamps, and flags along the start straight.
import * as THREE from 'three';
import { MeshBuilder } from './meshbuild.js';
import { BARRIER, SHOULDER } from '../world/track.js';
import { getProc, bannerTexture } from './proctex.js';
import { BUILD_ID } from './shaders.js';
import { chainPatch } from './common.js';

const WALL_PROFILE = [[0.34, 0], [0.34, 0.84], [0.38, 0.84], [0.38, 0.95], [-0.04, 0.95], [-0.04, 0.84], [0, 0.84], [0, 0]];
const PARAPET_PROFILE = [[0.40, 0], [0.40, 1.02], [0.46, 1.02], [0.46, 1.12], [-0.06, 1.12], [-0.06, 1.02], [0, 1.02], [0, 0]];
const WBEAM = [[0.02, 0.44], [0.06, 0.50], [0.015, 0.56], [0.06, 0.62], [0.015, 0.68], [0.06, 0.74], [0.015, 0.80], [0.03, 0.84]];

export function buildBarriers(world, materials, lighting) {
  const T = world.track, N = T.N;
  const group = new THREE.Group(); group.name = 'barriers';
  const procs = getProc();
  // materials
  const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.38, map: procs.metalA, normalMap: procs.grainN, normalScale: new THREE.Vector2(0.25, 0.25), side: THREE.DoubleSide, vertexColors: true });
  metal.name = 'guardrail-metal';
  chainPatch(metal, lighting, null, 'guard-v1');
  materials.audit.push({ name: 'guardrail', material: metal, near: true });
  const bmat = materials.makeBuilding('barrier-wall');
  const out = { group, gantry: null, flags: null };

  // ---- runs of barrier per side, split in chunks of <= 260 samples
  const CH = 260;
  const frames = (i0, i1, side, off, yAdd) => {
    const arr = [];
    for (let i = i0; i <= i1; i++) {
      const ii = i % N;
      const lat = side * off;
      const p = T.roadPoint(ii, lat, 0);
      const rx = side * T.rx[ii], rz = side * T.rz[ii];          // outward horizontal
      arr.push({ p: [p.x, p.y + yAdd, p.z], r: [rx, 0, rz], u: [0, 1, 0] });
    }
    return side > 0 ? arr : arr.reverse();
  };
  for (const side of [-1, 1]) {
    const typeArr = side < 0 ? T.barL : T.barR, offArr = side < 0 ? T.barOffL : T.barOffR;
    let i = 0;
    while (i < N) {
      const t = typeArr[i];
      if (t === BARRIER.NONE || t === BARRIER.ROCK || t === BARRIER.FENCE) { i++; continue; }
      let j = i; while (j + 1 < N && typeArr[j + 1] === t && T.zone[j + 1] === T.zone[i] && j + 1 - i < CH) j++;
      const off = offArr[i];
      const zone = T.zone[i];
      const mb = new MeshBuilder();
      const fr = frames(i, j + 1, side, off, 0);
      if (t === BARRIER.GUARDRAIL) {
        mb.sweep(WBEAM, fr, { color: [0.72, 0.74, 0.76], double: true });
        // posts every 4 m
        for (let k = i; k <= j; k += 4) {
          const ii = k % N, p = T.roadPoint(ii, side * (off + 0.12), 0);
          mb.cylinder(p.x, p.z, p.y - 0.5, p.y + 0.86, 0.055, 0.05, 8, { color: [0.5, 0.52, 0.54] });
          // cat-eye reflector
          if (k % 16 === 0) mb.cylinder(p.x - side * T.rx[ii] * -0.0, p.z, p.y + 0.80, p.y + 0.84, 0.045, 0.045, 8, { color: [1, 0.6, 0.1] });
        }
        const g = mb.toGeometry({ withInst: false });
        const m = new THREE.Mesh(g, metal); m.castShadow = true; m.receiveShadow = true; m.userData.barrier = 'guardrail'; group.add(m);
      } else if (t === BARRIER.WALL || t === BARRIER.PARAPET) {
        const para = t === BARRIER.PARAPET;
        const layer = para ? BUILD_ID.rustic_stone_wall : (zone === 0 ? BUILD_ID.concrete_wall_007 : BUILD_ID.stone_wall);
        const colFn = k => {
          const panel = Math.floor((i + k) / 8) % 2;
          if (zone === 0) return panel ? [0.97, 0.95, 0.90] : [0.86, 0.84, 0.80];
          return panel ? [1.0, 0.96, 0.88] : [0.92, 0.88, 0.80];
        };
        mb.sweep(para ? PARAPET_PROFILE : WALL_PROFILE, fr, { mat: layer, colorFn: colFn, inst: [0, 0, 0, T.py[i]] });
        if (para) for (let k = i; k <= j; k += 6) { const ii = k % N, p = T.roadPoint(ii, side * (off + 0.17), 0); mb.cylinder(p.x, p.z, p.y, p.y + 1.3, 0.26, 0.22, 14, { mat: BUILD_ID.rustic_stone_wall, color: [1, 0.96, 0.88], inst: [0, 0, 0, p.y] }); }
        const g = mb.toGeometry();
        const m = new THREE.Mesh(g, bmat); m.castShadow = true; m.receiveShadow = true; m.userData.barrier = para ? 'parapet' : 'wall'; group.add(m);
      }
      i = j + 1;
    }
  }

  // ---- start / finish gantry at s = 0 (spans the road)
  {
    const i = 0, half = T.w[i] * 0.5, p0 = T.roadPoint(i, 0, 0);
    const fx = T.tx[i], fz = T.tz[i], rx = T.rx[i], rz = T.rz[i];
    const g = new THREE.Group(); g.name = 'gantry';
    const span = half + 2.6;
    const dark = new THREE.MeshStandardMaterial({ color: 0xffffff, map: procs.metalA, normalMap: procs.grainN, metalness: 0.6, roughness: 0.45 });
    chainPatch(dark, lighting, null, 'gantry-v1'); materials.audit.push({ name: 'gantry', material: dark, near: true });
    const mb = new MeshBuilder();
    for (const s of [-1, 1]) {
      const px = p0.x + rx * s * span, pz = p0.z + rz * s * span, py = T.roadY(i, 0, s * span);
      mb.cylinder(px, pz, py - 0.4, py + 7.4, 0.50, 0.36, 20, { color: [0.55, 0.57, 0.6] });
      mb.cylinder(px, pz, py - 0.4, py + 0.5, 0.62, 0.55, 20, { color: [0.3, 0.3, 0.32], cap: true });
    }
    // top truss: round tube across the road, a lower banner rail
    const gx0 = p0.x - rx * span, gz0 = p0.z - rz * span, gx1 = p0.x + rx * span, gz1 = p0.z + rz * span;
    const yTop = p0.y + 7.0;
    const dir = new THREE.Vector3(gx1 - gx0, 0, gz1 - gz0); const len = dir.length(); dir.normalize();
    const tube = new THREE.CylinderGeometry(0.32, 0.32, len, 20, 6, false); tube.rotateZ(Math.PI / 2);
    const mat4 = new THREE.Matrix4().makeBasis(dir, new THREE.Vector3(0, 1, 0), new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).negate());
    mat4.setPosition((gx0 + gx1) / 2, yTop, (gz0 + gz1) / 2);
    mb.addGeo(tube, mat4, { color: [0.62, 0.64, 0.67] });
    const geo = mb.toGeometry({ withInst: false });
    const body = new THREE.Mesh(geo, dark); body.castShadow = true; body.receiveShadow = true; g.add(body);
    // banner (tessellated plane, textured)
    const bt = bannerTexture();
    const bm = new THREE.MeshStandardMaterial({ map: bt, normalMap: procs.clothN, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, emissive: new THREE.Color(0x111111) });
    chainPatch(bm, lighting, null, 'banner-v1'); materials.audit.push({ name: 'banner', material: bm, near: true });
    const bg = new THREE.PlaneGeometry(len - 1.6, 2.1, 24, 6);
    const banner = new THREE.Mesh(bg, bm); banner.castShadow = true;
    banner.position.set((gx0 + gx1) / 2, yTop - 1.5, (gz0 + gz1) / 2);
    banner.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, new THREE.Vector3(0, 1, 0), new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).negate()));
    g.add(banner);
    // countdown lamps (5), emissive spheres under the banner
    const lamps = [];
    for (let k = 0; k < 5; k++) {
      const lm = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(0x000000), emissiveIntensity: 0, roughness: 0.3, metalness: 0 });
      chainPatch(lm, lighting, null, 'lamp-v1');
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), lm);
      const t = (k - 2) * 1.0;
      s.position.set(p0.x + rx * t * 1.1 * 0 + dir.x * t * 1.3, yTop - 3.05, p0.z + dir.z * t * 1.3);
      g.add(s); lamps.push({ mesh: s, mat: lm });
    }
    group.add(g);
    out.gantry = { group: g, lamps, setLights(n, green = false) { lamps.forEach((l, k) => { const on = k < n; const c = green ? 0x30ff40 : 0xff2010; l.mat.emissive.setHex(on ? c : 0x000000); l.mat.emissiveIntensity = on ? 3.0 : 0; l.mat.color.setHex(on ? c : 0x220000); }); } };
    out.gantry.setLights(0);
  }

  // ---- flags along the start straight (instanced, waving in the vertex shader)
  {
    const poles = [], flagsPos = [];
    for (let s = -110; s <= 130; s += 12) {
      const i = T.indexAtS(s);
      for (const side of [-1, 1]) {
        const off = (side < 0 ? T.barOffL[i] : T.barOffR[i]) || (T.w[i] * 0.5 + SHOULDER - 0.35);
        const p = T.roadPoint(i, side * (off + 0.62), 0);
        poles.push({ x: p.x, y: p.y, z: p.z, i, side });
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.035, 0.05, 6.4, 8, 3);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: procs.metalA, normalMap: procs.grainN, metalness: 0.7, roughness: 0.4 });
    chainPatch(poleMat, lighting, null, 'pole-v1'); materials.audit.push({ name: 'flagpole', material: poleMat, near: true });
    const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, poles.length); poleMesh.castShadow = true;
    const m4 = new THREE.Matrix4();
    poles.forEach((p, k) => { m4.makeTranslation(p.x, p.y + 3.2, p.z); poleMesh.setMatrixAt(k, m4); });
    poleMesh.frustumCulled = false; group.add(poleMesh);
    // flags: 1.5 x 0.95, 12 x 6 segments, rooted at the pole top, flying along the road direction
    const fg = new THREE.PlaneGeometry(1.5, 0.95, 12, 6); fg.translate(0.75, -0.5, 0);
    const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: procs.clothA, normalMap: procs.clothN, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
    const uTime = { value: 0 };
    chainPatch(fm, lighting, (shader) => {
      shader.uniforms.uTimeF = uTime;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTimeF;').replace('#include <begin_vertex>', `#include <begin_vertex>
        float wf = position.x / 1.5;
        float ph = uTimeF * 5.5 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
        transformed.z += sin(position.x * 5.0 - ph) * 0.14 * wf + sin(position.x * 9.0 - ph * 1.7 + position.y * 3.0) * 0.045 * wf;
        transformed.y += sin(position.x * 4.0 - ph * 1.2) * 0.04 * wf;`);
    }, 'flag-v1');
    materials.audit.push({ name: 'flag', material: fm, near: true });
    const flagMesh = new THREE.InstancedMesh(fg, fm, poles.length); flagMesh.castShadow = true; flagMesh.frustumCulled = false;
    const pal = [0xe63946, 0xf1f1f1, 0x1d5fbf, 0xffc233, 0x2a9d8f, 0xff7a1a];
    const q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    poles.forEach((p, k) => {
      // flag extends along the travel direction
      const i = p.i; const yaw = Math.atan2(-T.tz[i], T.tx[i]);        // +x of the plane -> forward
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      pos.set(p.x, p.y + 6.15, p.z);
      m4.compose(pos, q, one); flagMesh.setMatrixAt(k, m4);
      c.setHex(pal[(k >> 1) % pal.length]); flagMesh.setColorAt(k, c);
    });
    group.add(flagMesh);
    out.flags = { mesh: flagMesh, update(t) { uTime.value = t; } };
  }
  out.update = t => out.flags.update(t);
  return out;
}
