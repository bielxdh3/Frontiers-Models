// Procedural car models (own work): implicit body -> surface nets -> material
// regions (paint/glass/trim/plastic/grille/head/tail/chrome), modelled wheels
// (tyre with sidewall + tread, spoked rim, vented disc, caliper), simple dark
// interior, exhaust tips. Two LODs per design, geometry shared between cars.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeDesign, REGION } from './design.js';
import { surfaceNets, splitRegions } from './surfaceNets.js';
import * as TG from '../render/texgen.js';

const geoCache = new Map();
let shared = null;

function sharedTextures(pbr) {
  if (shared) return shared;
  shared = {
    flake: TG.flakeNormal(), plastic: TG.plasticNormal(), noise: TG.noiseAlbedo(), tread: TG.treadTextures(), honey: TG.honeycomb(),
    head: TG.lightTexture('head'), tail: TG.lightTexture('tail'), disc: TG.discTexture(), contact: TG.contactShadowTexture(),
    fabric: pbr.fabric, metal: pbr.metal, chrome: pbr.chrome, rubber: pbr.rubber,
  };
  return shared;
}

function uvProject(P, N, scale) {
  const n = P.length / 3, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const ax = Math.abs(N[i * 3]), ay = Math.abs(N[i * 3 + 1]), az = Math.abs(N[i * 3 + 2]);
    let u, v;
    if (ax >= ay && ax >= az) { u = P[i * 3 + 2]; v = P[i * 3 + 1]; } else if (ay >= az) { u = P[i * 3]; v = P[i * 3 + 2]; } else { u = P[i * 3]; v = P[i * 3 + 1]; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  return uv;
}

function regionGeometry(split, ids, uvFn) {
  // compact the vertex set used by these triangle ids
  const map = new Map(); const pos = [], nor = [], ind = [];
  for (const t of ids) {
    let k = map.get(t);
    if (k === undefined) { k = pos.length / 3; map.set(t, k); pos.push(split.P[t * 3], split.P[t * 3 + 1], split.P[t * 3 + 2]); nor.push(split.N[t * 3], split.N[t * 3 + 1], split.N[t * 3 + 2]); }
    ind.push(k);
  }
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(pos), N = new Float32Array(nor);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvFn(P, N), 2));
  g.setIndex(ind.length > 65535 ? new THREE.Uint32BufferAttribute(ind, 1) : new THREE.Uint16BufferAttribute(ind, 1));
  g.computeBoundingSphere();
  return g;
}

export function buildCarGeometry(id, lod) {
  const key = id + ':' + lod;
  if (geoCache.has(key)) return geoCache.get(key);
  const D = makeDesign(id);
  const h = lod === 0 ? 0.03 : 0.058;
  const mesh = surfaceNets(D.body, D.bounds, h, { project: lod === 0 ? 2 : 1 });
  const split = splitRegions(mesh, D.levelSets, (x, y, z, nx, ny, nz) => {
    return D.regionOf(x, y, z, nx, ny, nz);
  });
  const geos = {};
  for (const [r, ids] of split.groups) {
    let uvFn = (P, N) => uvProject(P, N, 6);
    if (r === REGION.HEAD) uvFn = (P) => { const n = P.length / 3, uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = (Math.abs(P[i * 3]) - (D.lightsPos.head[0] - 0.22)) / 0.44; uv[i * 2 + 1] = (P[i * 3 + 1] - (D.lightsPos.head[1] - 0.06)) / 0.12; } return uv; };
    if (r === REGION.TAIL) uvFn = (P) => { const n = P.length / 3, uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = P[i * 3] / 1.8 + 0.5; uv[i * 2 + 1] = (P[i * 3 + 1] - (D.lightsPos.tail[1] - 0.08)) / 0.16; } return uv; };
    if (r === REGION.GRILLE) uvFn = (P) => { const n = P.length / 3, uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = P[i * 3] * 3.2; uv[i * 2 + 1] = P[i * 3 + 1] * 3.2; } return uv; };
    geos[r] = regionGeometry(split, ids, uvFn);
  }
  const out = { design: D, geos, tris: Object.values(geos).reduce((a, g) => a + g.index.count / 3, 0) };
  geoCache.set(key, out);
  return out;
}

// ---------------- wheels ----------------
function tireGeometry(rw, rimR, tw, seg = 72) {
  const pts = [];
  const prof = [[-0.5, 0.0], [-0.53, 0.18], [-0.52, 0.42], [-0.46, 0.75], [-0.4, 0.93], [-0.32, 1.0], [0.32, 1.0], [0.4, 0.93], [0.46, 0.75], [0.52, 0.42], [0.53, 0.18], [0.5, 0.0]];
  for (const [x, r] of prof) pts.push(new THREE.Vector2(rimR + (rw - rimR) * r, x * tw));
  const g = new THREE.LatheGeometry(pts, seg);
  // lathe: radius in x/z around y axis -> rotate so axle = x
  g.rotateZ(Math.PI / 2);
  // remap uv: u around, v across
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 36, uv.getY(i));
  return g;
}
function rimGeometry(design, rimR, tw, lod = 0) {
  const parts = [];
  // barrel
  const bp = [[rimR * 0.97, -tw * 0.46], [rimR, -tw * 0.5], [rimR * 1.02, -tw * 0.5], [rimR * 1.02, -tw * 0.43], [rimR * 0.95, -tw * 0.38], [rimR * 0.93, tw * 0.32], [rimR * 1.0, tw * 0.4], [rimR * 1.03, tw * 0.47], [rimR * 1.0, tw * 0.5]];
  const barrel = new THREE.LatheGeometry(bp.map(([r, x]) => new THREE.Vector2(r, x)), lod ? 24 : 48);
  barrel.rotateZ(Math.PI / 2); parts.push(barrel);
  // spoke face (extruded shape with windows)
  const R = rimR * 0.94;
  const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  const nsp = design.id === 'gt' ? 10 : 5;
  for (let k = 0; k < nsp; k++) {
    const a0 = (k / nsp) * Math.PI * 2 + (design.id === 'gt' ? 0.14 : 0.26), a1 = ((k + 1) / nsp) * Math.PI * 2 - (design.id === 'gt' ? 0.14 : 0.26);
    const hole = new THREE.Path();
    const r0 = R * 0.34, r1 = R * 0.9;
    hole.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
    hole.lineTo(Math.cos(a0 - 0.05) * r1, Math.sin(a0 - 0.05) * r1);
    hole.absarc(0, 0, r1, a0 - 0.05, a1 + 0.05, false);
    hole.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
    hole.absarc(0, 0, r0, a1, a0, true);
    shape.holes.push(hole);
  }
  const center = new THREE.Path(); center.absarc(0, 0, R * 0.09, 0, Math.PI * 2, true); shape.holes.push(center);
  const face = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: lod ? 1 : 1, curveSegments: lod ? 4 : 10 });
  // dish: push spokes outward towards the rim
  const p = face.attributes.position;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)) / R; p.setZ(i, p.getZ(i) - 0.045 * (1 - r)); }
  face.rotateY(Math.PI / 2); face.translate(tw * 0.28, 0, 0);
  face.computeVertexNormals();
  parts.push(face);
  // hub + lug nuts
  const hub = new THREE.CylinderGeometry(R * 0.2, R * 0.24, 0.05, 24); hub.rotateZ(Math.PI / 2); hub.translate(tw * 0.26, 0, 0); parts.push(hub);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const nut = new THREE.CylinderGeometry(0.011, 0.012, 0.025, 8); nut.rotateZ(Math.PI / 2); nut.translate(tw * 0.29, Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15); parts.push(nut); }
  const merged = mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
  // uv by projection on the wheel plane
  const pp = merged.attributes.position; const uv = new Float32Array(pp.count * 2);
  for (let i = 0; i < pp.count; i++) { uv[i * 2] = pp.getY(i) * 4; uv[i * 2 + 1] = pp.getZ(i) * 4; }
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return merged;
}
function discGeometry(rimR) {
  const g = new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.028, 40, 1);
  g.rotateZ(Math.PI / 2);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) / (rimR * 1.56) + 0.5, p.getZ(i) / (rimR * 1.56) + 0.5);
  return g;
}
function caliperGeometry(rimR) {
  const s = new THREE.Shape();
  const r0 = rimR * 0.52, r1 = rimR * 0.84, a0 = 0.35, a1 = 1.25;
  s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 12 });
  g.rotateY(Math.PI / 2); g.translate(-0.03, 0, 0);
  return g;
}

function interiorGeometry(D) {
  const I = D.interior; const parts = [];
  const tub = new RoundedBoxGeometry(1.5, 0.5, 2.0, 2, 0.12); tub.translate(0, I.beltY - 0.33, I.zSeat + 0.05); parts.push(tub);
  const dash = new RoundedBoxGeometry(1.46, 0.2, 0.5, 2, 0.08); dash.translate(0, I.yDash - 0.04, I.zDash); parts.push(dash);
  for (const sx of [-I.seatX, I.seatX]) {
    const cush = new RoundedBoxGeometry(0.5, 0.14, 0.52, 2, 0.06); cush.translate(sx, I.ySeat, I.zSeat); parts.push(cush);
    const back = new RoundedBoxGeometry(0.5, 0.62, 0.14, 2, 0.06); back.rotateX(-0.28); back.translate(sx, I.ySeat + 0.34, I.zSeat + 0.3); parts.push(back);
    const head = new RoundedBoxGeometry(0.28, 0.2, 0.12, 2, 0.05); head.translate(sx, I.ySeat + 0.74, I.zSeat + 0.42); parts.push(head);
  }
  const cons = new RoundedBoxGeometry(0.22, 0.2, 0.7, 2, 0.05); cons.translate(0, I.ySeat + 0.02, I.zSeat - 0.25); parts.push(cons);
  const sw = new THREE.TorusGeometry(0.17, 0.018, 8, 28); sw.rotateX(-0.45); sw.translate(-I.seatX, I.wheelY, I.wheelZ); parts.push(sw);
  const col = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8); col.rotateX(Math.PI / 2 - 0.45); col.translate(-I.seatX, I.wheelY - 0.04, I.wheelZ - 0.12); parts.push(col);
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  const pp = merged.attributes.position; const uv = new Float32Array(pp.count * 2);
  for (let i = 0; i < pp.count; i++) { uv[i * 2] = (pp.getX(i) + pp.getZ(i)) * 3; uv[i * 2 + 1] = pp.getY(i) * 3; }
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return merged;
}

// ---------------- materials ----------------
function paintMaterial(liv, D, tex, carName) {
  const livery = TG.liveryTexture(liv, carName), stripe = TG.stripeTexture(liv);
  const m = new THREE.MeshPhysicalMaterial({
    color: liv.color, metalness: liv.metal, roughness: 0.32, clearcoat: 1.0, clearcoatRoughness: 0.035,
    map: livery, envMapIntensity: 1.25,
  });
  m.name = 'paint';
  const b = D.bounds;
  m.userData.uniforms = {
    uLivery: { value: livery }, uStripe: { value: stripe },
    uSide: { value: new THREE.Vector4(b.min[2] + 0.35, b.max[2] - 0.35, 0.16, D.id === 'gt' ? 0.92 : 1.0) },
    uTop: { value: new THREE.Vector4(b.min[2], b.max[2], 1.7, 0) },
  };
  m.userData.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjPos; varying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position; vObjN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vObjPos; varying vec3 vObjN; uniform sampler2D uLivery, uStripe; uniform vec4 uSide, uTop;
      float pline(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }`)
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 on = normalize(vObjN);
        float sideW = smoothstep(0.35, 0.65, abs(on.x));
        float u = vObjPos.x > 0.0 ? (uSide.y - vObjPos.z) / (uSide.y - uSide.x) : (vObjPos.z - uSide.x) / (uSide.y - uSide.x);
        vec2 suv = vec2(u, (vObjPos.y - uSide.z) / (uSide.w - uSide.z));
        float inb = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
        vec4 dec = texture2D(uLivery, suv) * inb * sideW;
        vec2 tuv = vec2(vObjPos.x / uTop.z + 0.5, (vObjPos.z - uTop.x) / (uTop.y - uTop.x));
        vec4 st = texture2D(uStripe, tuv) * smoothstep(0.55, 0.85, on.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, dec.rgb, dec.a);
        diffuseColor.rgb = mix(diffuseColor.rgb, st.rgb, st.a);
        // panel gaps (doors, hood, bumpers, hatch)
        float pl = 0.0;
        float side = step(0.5, abs(on.x));
        pl += pline(vObjPos.z - ${(D.id === 'gt' ? -0.56 : -0.86).toFixed(2)}, 0.006) * side * step(0.18, vObjPos.y) * step(vObjPos.y, ${(D.id === 'gt' ? 0.86 : 0.98).toFixed(2)});
        pl += pline(vObjPos.z - ${(D.id === 'gt' ? 0.62 : 0.42).toFixed(2)}, 0.006) * side * step(0.2, vObjPos.y) * step(vObjPos.y, ${(D.id === 'gt' ? 0.88 : 1.0).toFixed(2)});
        pl += pline(vObjPos.z - ${(D.id === 'gt' ? -0.66 : -0.96).toFixed(2)}, 0.006) * step(0.6, on.y) * step(abs(vObjPos.x), 0.78);
        pl += pline(abs(vObjPos.x) - 0.74, 0.006) * step(0.6, on.y) * step(vObjPos.z, ${(D.id === 'gt' ? -0.66 : -0.96).toFixed(2)}) * step(${(D.id === 'gt' ? -2.05 : -1.9).toFixed(2)}, vObjPos.z);
        pl += pline(vObjPos.y - 0.205, 0.006) * side * step(vObjPos.z, 1.2) * step(-1.6, vObjPos.z);
        diffuseColor.rgb *= 1.0 - 0.82 * clamp(pl, 0.0, 1.0);
      }`);
  };
  return m;
}

export function carMaterials(liv, D, pbr, carName) {
  const tex = sharedTextures(pbr);
  const paint = paintMaterial(liv, D, tex, carName);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c0f, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, depthWrite: false });
  glass.name = 'glass'; glass.userData.audit = 'glass';
  const trim = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0b, roughness: 0.2, metalness: 0.1, clearcoat: 0.7, map: tex.noise }); trim.name = 'trim-gloss-black';
  const plastic = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.8, metalness: 0.0, map: tex.noise, roughnessMap: tex.noise }); plastic.name = 'plastic-matte';
  const grille = new THREE.MeshStandardMaterial({ map: tex.honey.map, normalMap: tex.honey.normalMap, roughness: 0.55, metalness: 0.2 }); grille.name = 'grille';
  const head = new THREE.MeshStandardMaterial({ map: tex.head, emissiveMap: tex.head, emissive: 0xfff4e6, emissiveIntensity: 2.2, roughness: 0.08, metalness: 0.3 }); head.name = 'headlight'; head.userData.audit = 'emissive';
  const tail = new THREE.MeshStandardMaterial({ map: tex.tail, emissiveMap: tex.tail, emissive: 0xff2414, emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.1 }); tail.name = 'taillight'; tail.userData.audit = 'emissive';
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.07, map: tex.chrome.map, envMapIntensity: 1.4 }); chrome.name = 'chrome';
  const rubber = new THREE.MeshStandardMaterial({ map: tex.tread.map, normalMap: tex.tread.normalMap, roughness: 0.88, metalness: 0, color: 0xbbbbbb }); rubber.name = 'rubber';
  const rim = new THREE.MeshStandardMaterial({ color: D.id === 'gt' ? 0x2a2c30 : 0xb9bec6, metalness: 0.9, roughness: D.id === 'gt' ? 0.34 : 0.22, normalMap: tex.metal.normalMap, normalScale: new THREE.Vector2(0.2, 0.2), envMapIntensity: 1.2 }); rim.name = 'rim';
  const disc = new THREE.MeshStandardMaterial({ map: tex.disc.map, normalMap: tex.disc.normalMap, metalness: 0.85, roughness: 0.42 }); disc.name = 'brake-disc';
  const caliper = new THREE.MeshPhysicalMaterial({ color: D.id === 'gt' ? 0xd2a12a : 0xc4161c, roughness: 0.35, clearcoat: 0.8, normalMap: tex.plastic, normalScale: new THREE.Vector2(0.1, 0.1) }); caliper.name = 'caliper';
  const interior = new THREE.MeshStandardMaterial({ map: tex.fabric.map, normalMap: tex.fabric.normalMap, color: 0x3a3836, roughness: 0.9 }); interior.name = 'interior';
  const contact = new THREE.MeshBasicMaterial({ map: tex.contact, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.82 });
  contact.name = 'contact-shadow'; contact.userData.audit = 'decal';
  return { paint, glass, trim, plastic, grille, head, tail, chrome, rubber, rim, disc, caliper, interior, contact };
}

const REG_MAT = { [REGION.PAINT]: 'paint', [REGION.GLASS]: 'glass', [REGION.TRIM]: 'trim', [REGION.PLASTIC]: 'plastic', [REGION.GRILLE]: 'grille', [REGION.HEAD]: 'head', [REGION.TAIL]: 'tail', [REGION.CHROME]: 'chrome' };

/**
 * Build a car object. spec: physics spec (CAR_SPECS), liv: livery.
 * Returns { root, bodyLods:[g0,g1], wheels:[{pivot,spin}], mats, contact }
 */
export function buildCar(spec, liv, pbr, { lod1 = true } = {}) {
  const g0 = buildCarGeometry(spec.id, 0);
  const D = g0.design;
  const mats = carMaterials(liv, D, pbr, spec.name);
  const root = new THREE.Group(); root.name = 'car-' + spec.id;
  const zShift = -spec.wheelbase * (1 - spec.frontBias) + spec.wheelbase / 2;
  const model = new THREE.Group(); model.position.set(0, -spec.cgHeight, zShift); root.add(model);
  const lods = [];
  for (const level of lod1 ? [0, 1] : [0]) {
    const G = level === 0 ? g0 : buildCarGeometry(spec.id, 1);
    const grp = new THREE.Group(); grp.name = 'body-lod' + level;
    for (const [r, geo] of Object.entries(G.geos)) {
      const mesh = new THREE.Mesh(geo, mats[REG_MAT[r]]);
      mesh.castShadow = r !== String(REGION.GLASS); mesh.receiveShadow = true;
      mesh.name = REG_MAT[r]; mesh.userData.audit = { kind: 'car', lod: level };
      if (r === String(REGION.GLASS)) mesh.renderOrder = 2;
      grp.add(mesh);
    }
    grp.visible = level === 0;
    model.add(grp); lods.push(grp);
  }
  // shadow proxy: LOD1 body casts the shadow (never drawn in colour), LOD0 does not cast
  const shadowLod = lods[lods.length - 1];
  if (lods.length > 1) {
    for (const m of lods[0].children) m.castShadow = false;
    const proxy = new THREE.Group(); proxy.name = 'shadow-proxy';
    const pm = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); pm.name = 'shadow-proxy';
    // one coarse closed hull (surface nets at 10 cm) casts the car shadow: ~1/8 of the LOD1 triangles, one draw per cascade
    const p = new THREE.Mesh(shadowHullGeometry(spec.id), pm); p.name = 'shadow-proxy'; p.castShadow = true; p.receiveShadow = false; p.userData.audit = { kind: 'collider', invisible: true };
    proxy.add(p);
    model.add(proxy);
    for (const m of shadowLod.children) m.castShadow = false;
  }
  const inter = new THREE.Mesh(interiorGeometry(D), mats.interior); inter.name = 'interior'; inter.userData.audit = { kind: 'car', lod: 0 };
  model.add(inter);
  // exhaust tips
  for (const e of D.exhaust) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.12, 20, 1, true), mats.chrome);
    tip.rotation.x = Math.PI / 2; tip.position.set(e[0], e[1], e[2] - 0.03); tip.name = 'exhaust'; tip.userData.audit = { kind: 'car', lod: 0 };
    model.add(tip);
  }
  // wheels (two LODs: full detail near, simplified far)
  const rimR = spec.wheelRadius * 0.7;
  const WG = [wheelGeometries(spec, rimR, 0), wheelGeometries(spec, rimR, 1)];
  const wheels = [];
  const a = spec.wheelbase * (1 - spec.frontBias), b = spec.wheelbase * spec.frontBias;
  for (const [x, z, front] of [[-spec.trackF / 2, -a, true], [spec.trackF / 2, -a, true], [-spec.trackR / 2, b, false], [spec.trackR / 2, b, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, -spec.cgHeight + spec.wheelRadius, z);
    const side = x < 0 ? -1 : 1;
    const spin = new THREE.Group(); pivot.add(spin);
    const wl = [];
    for (let l = 0; l < 2; l++) {
      const wheelGeo = WG[l];
      const tw = front ? wheelGeo.twF : wheelGeo.twR;
      const grp = new THREE.Group(); grp.visible = l === 0; spin.add(grp);
      const tire = new THREE.Mesh(front ? wheelGeo.tireF : wheelGeo.tireR, mats.rubber); tire.castShadow = l === 0; tire.receiveShadow = true; tire.name = 'tire';
      const rim = new THREE.Mesh(wheelGeo.rim, mats.rim); rim.castShadow = false; rim.name = 'rim'; rim.scale.x = side;
      const disc = new THREE.Mesh(wheelGeo.disc, mats.disc); disc.position.x = -side * tw * 0.12; disc.name = 'disc';
      grp.add(tire, rim, disc);
      for (const m of [tire, rim, disc]) m.userData.audit = { kind: 'car', lod: l };
      wl.push(grp);
    }
    const cal = new THREE.Mesh(WG[0].caliper, mats.caliper); cal.position.x = -side * (front ? WG[0].twF : WG[0].twR) * 0.05; cal.rotation.x = front ? 0.2 : 2.7; cal.scale.x = side; cal.name = 'caliper';
    cal.userData.audit = { kind: 'car', lod: 0 };
    pivot.add(cal);
    root.add(pivot);
    wheels.push({ pivot, spin, side, lods: wl, caliper: cal });
  }
  // contact shadow (world-aligned, updated by the game)
  const cgeo = new THREE.PlaneGeometry(spec.width * 1.25, spec.length * 1.12, 4, 8); cgeo.rotateX(-Math.PI / 2);
  const contact = new THREE.Mesh(cgeo, mats.contact); contact.renderOrder = 1; contact.name = 'contact-shadow'; contact.userData.audit = { kind: 'decal' };
  const tris = countTris(root);
  return { root, bodyLods: lods, wheels, mats, contact, design: D, tris, zShift };
}

const hullCache = new Map();
function shadowHullGeometry(id) {
  if (hullCache.has(id)) return hullCache.get(id);
  const D = makeDesign(id);
  const m = surfaceNets(D.body, D.bounds, 0.1, { project: 1 });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setIndex(m.positions.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(m.indices, 1) : new THREE.Uint16BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  hullCache.set(id, g);
  return g;
}
const wheelCache = new Map();
function wheelGeometries(spec, rimR, lod = 0) {
  const key = spec.id + ':' + lod;
  if (wheelCache.has(key)) return wheelCache.get(key);
  const D = makeDesign(spec.id);
  const twF = spec.id === 'gt' ? 0.255 : 0.235, twR = spec.id === 'gt' ? 0.295 : 0.235;
  const seg = lod ? 28 : 64;
  const w = { twF, twR, tireF: tireGeometry(spec.wheelRadius, rimR, twF, seg), tireR: tireGeometry(spec.wheelRadius, rimR, twR, seg), rim: rimGeometry(D, rimR, twF, lod), disc: discGeometry(rimR), caliper: caliperGeometry(rimR) };
  wheelCache.set(key, w);
  return w;
}

export function countTris(obj, lodOnly = 0) {
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (o.userData.audit && o.userData.audit.lod !== undefined && o.userData.audit.lod !== lodOnly) return;
    if (o.name === 'contact-shadow') return;
    if (o.userData.audit && o.userData.audit.invisible) return; // shadow hull: never drawn in colour
    const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
}
