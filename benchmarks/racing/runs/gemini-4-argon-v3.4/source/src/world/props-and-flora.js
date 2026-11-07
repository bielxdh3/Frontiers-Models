import * as THREE from 'three';
import { fbm2D } from './spline.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dependency-free indexed/non-indexed BufferGeometry merger preserving position, normal, uv
export function mergeGeometriesSimple(geos) {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const vc = g.attributes.position.count;
    totalVerts += vc;
    totalIndices += g.index ? g.index.count : vc;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geos) {
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : null;
    const vc = g.attributes.position.count;

    positions.set(pos, vOffset * 3);
    normals.set(nor, vOffset * 3);
    if (uv) {
      uvs.set(uv, vOffset * 2);
    }

    if (g.index) {
      const idx = g.index.array;
      for (let k = 0; k < idx.length; k++) {
        indices[iOffset + k] = idx[k] + vOffset;
      }
      iOffset += idx.length;
    } else {
      for (let k = 0; k < vc; k++) {
        indices[iOffset + k] = k + vOffset;
      }
      iOffset += vc;
    }
    vOffset += vc;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

// ============================================================================
// Procedural Mesh Builders (NEVER BoxGeometry; always >> 48 tris + clean UVs)
// ============================================================================

export function buildPalmGeometries() {
  // 1. Curved, ringed organic palm trunk (18 rings x 10 radial segments = 360 tris) + crown-shaft bulb
  const rings = 18;
  const radSegs = 10;
  const trunkH = 7.8;
  const vertCount = (rings + 1) * (radSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let ir = 0; ir <= rings; ir++) {
    const t = ir / rings;
    const y = -0.25 + t * (trunkH + 0.25); // Sinks 0.25m below pivot so base never gaps on slopes
    const curveX = 0.42 * Math.pow(t, 1.75) - 0.08 * Math.sin(t * Math.PI);
    const curveZ = 0.16 * Math.sin(t * Math.PI * 1.3);

    // Taper from flared root base (0.31m) to slender upper neck (0.165m) then slight petiole crown swell (0.26m)
    let r = 0.30 * Math.pow(1.0 - t * 0.72, 0.65) + 0.04;
    if (t > 0.88) {
      const tc = (t - 0.88) / 0.12;
      r += 0.10 * Math.sin(tc * Math.PI * 0.85);
    }
    const ringScars = 1.0 + 0.055 * Math.sin(t * 54.0);
    r *= ringScars;

    for (let j = 0; j <= radSegs; j++) {
      const ang = (j / radSegs) * Math.PI * 2;
      const idx = ir * (radSegs + 1) + j;
      positions[idx * 3] = curveX + Math.cos(ang) * r;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = curveZ + Math.sin(ang) * r;
      uvs[idx * 2] = (j / radSegs) * 1.5;
      uvs[idx * 2 + 1] = t * 5.0;
    }
  }

  for (let ir = 0; ir < rings; ir++) {
    for (let j = 0; j < radSegs; j++) {
      const a = ir * (radSegs + 1) + j;
      const b = a + 1;
      const c = a + (radSegs + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const trunkGeo = new THREE.BufferGeometry();
  trunkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trunkGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  trunkGeo.setIndex(indices);
  trunkGeo.computeVertexNormals();

  // 2. Lush 36-frond 4-tier Mediterranean palm crown around crown top (Ref 01 silhouette)
  const crownX = 0.42;
  const crownY = trunkH - 0.12;
  const crownZ = 0.16 * Math.sin(Math.PI * 1.3);
  const frondGeos = [];

  const tiers = [
    { count: 8,  len: 2.35, width: 1.05, pitch0: -0.22, droop: 1.75, yOff: -0.26, phase: 0.05 }, // drooping lower skirt fronds
    { count: 11, len: 3.35, width: 1.28, pitch0:  0.16, droop: 1.65, yOff: -0.10, phase: 0.32 }, // mature arching fronds
    { count: 10, len: 3.60, width: 1.32, pitch0:  0.54, droop: 1.35, yOff:  0.02, phase: 0.71 }, // wide canopy fronds
    { count: 7,  len: 2.85, width: 1.12, pitch0:  0.96, droop: 0.88, yOff:  0.14, phase: 1.15 }  // ascending upper crown
  ];

  const segL = 7;
  for (const tier of tiers) {
    for (let f = 0; f < tier.count; f++) {
      const az = tier.phase + (f / tier.count) * Math.PI * 2 + Math.sin(f * 3.7) * 0.14;
      const dirX = Math.cos(az);
      const dirZ = Math.sin(az);
      const sideX = -dirZ;
      const sideZ = dirX;

      // 3 lateral vertices across frond (left wing, raised central rachis, right wing) x (segL + 1)
      const fPos = new Float32Array((segL + 1) * 3 * 3);
      const fUv = new Float32Array((segL + 1) * 3 * 2);
      const fIdx = [];

      for (let s = 0; s <= segL; s++) {
        const u = s / segL;
        const reach = tier.len * (u * (1.06 - 0.16 * u));
        const archY = Math.sin(tier.pitch0) * reach - tier.droop * Math.pow(u, 2.05);
        const halfW = tier.width * 0.5 * Math.sin(Math.pow(u, 0.65) * Math.PI * 0.96 + 0.08);
        const vFold = 0.13 * Math.sin(u * Math.PI);

        const cx = crownX + dirX * reach;
        const cy = crownY + tier.yOff + archY;
        const cz = crownZ + dirZ * reach;

        const pts = [
          [cx - sideX * halfW, cy - vFold, cz - sideZ * halfW, 0.0],
          [cx,                 cy + vFold * 0.45, cz,          0.5],
          [cx + sideX * halfW, cy - vFold, cz + sideZ * halfW, 1.0]
        ];

        for (let k = 0; k < 3; k++) {
          const vi = s * 3 + k;
          fPos[vi * 3] = pts[k][0];
          fPos[vi * 3 + 1] = pts[k][1];
          fPos[vi * 3 + 2] = pts[k][2];
          fUv[vi * 2] = pts[k][3];
          fUv[vi * 2 + 1] = u;
        }
      }

      for (let s = 0; s < segL; s++) {
        for (let k = 0; k < 2; k++) {
          const a = s * 3 + k;
          const b = a + 1;
          const c = a + 3;
          const d = c + 1;
          fIdx.push(a, b, c, b, d, c);
        }
      }

      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
      fg.setAttribute('uv', new THREE.BufferAttribute(fUv, 2));
      fg.setIndex(fIdx);
      fg.computeVertexNormals();
      frondGeos.push(fg);
    }
  }

  const crownGeo = mergeGeometriesSimple(frondGeos);
  return { trunkGeo, crownGeo };
}

export function buildShrubGeometry() {
  // Multi-layered dome of 12 curved botanical branchlet sheets (216 tris, zero cones/boxes!)
  const parts = [];
  const cards = 12;
  for (let i = 0; i < cards; i++) {
    const ring = i < 7 ? 0 : 1;
    const az = (i / (ring === 0 ? 7 : 5)) * Math.PI * 2 + ring * 0.55;
    const tilt = ring === 0 ? 0.62 : 0.28;
    const w = ring === 0 ? 1.35 : 1.15;
    const h = ring === 0 ? 1.25 : 1.05;

    const g = new THREE.PlaneGeometry(w, h, 3, 3);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const lx = pos.getX(v);
      const ly = pos.getY(v) + h * 0.42;
      // Convex botanical curvature so shrub catches directional sun & shadow in 3D
      const domeZ = 0.26 - (lx * lx) * 0.22 - Math.pow(ly - h * 0.45, 2) * 0.14;
      pos.setXYZ(v, lx, ly, domeZ);
    }
    g.rotateX(-tilt);
    g.rotateY(az);
    g.translate(Math.sin(az) * 0.18, -0.08 + ring * 0.22, Math.cos(az) * 0.18);
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeGeometriesSimple(parts);
}

export function buildGrassTuftGeometry() {
  // 16 curved 3D marram dune-grass blades radiating in an organic coastal clump (128 tris)
  const blades = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const az = (i / count) * Math.PI * 2 + Math.sin(i * 4.3) * 0.22;
    const r0 = 0.05 + (i % 4) * 0.045;
    const bladeH = 0.52 + (i % 5) * 0.11;
    const arch = 0.24 + (i % 3) * 0.11;
    const segs = 4;

    const pos = new Float32Array((segs + 1) * 2 * 3);
    const uv = new Float32Array((segs + 1) * 2 * 2);
    const idx = [];
    const dx = Math.cos(az);
    const dz = Math.sin(az);
    const sx = -dz;
    const sz = dx;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const reach = r0 + arch * Math.pow(t, 1.55);
      const y = -0.05 + bladeH * (t - 0.18 * t * t);
      const hw = 0.032 * (1.0 - t * 0.88);
      const cx = dx * reach;
      const cz = dz * reach;

      pos[(s * 2) * 3] = cx - sx * hw;
      pos[(s * 2) * 3 + 1] = y;
      pos[(s * 2) * 3 + 2] = cz - sz * hw;
      uv[(s * 2) * 2] = 0;
      uv[(s * 2) * 2 + 1] = t;

      pos[(s * 2 + 1) * 3] = cx + sx * hw;
      pos[(s * 2 + 1) * 3 + 1] = y;
      pos[(s * 2 + 1) * 3 + 2] = cz + sz * hw;
      uv[(s * 2 + 1) * 2] = 1;
      uv[(s * 2 + 1) * 2 + 1] = t;
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    blades.push(bg);
  }
  return mergeGeometriesSimple(blades);
}

export function buildBeachFenceGeometry() {
  // Ref 03 authentic 3.6m wooden slat sand-fence section: 11 weathered stakes + 2 twisted wire lines (> 320 tris)
  const parts = [];
  const span = 3.6;
  const slats = 11;
  for (let i = 0; i < slats; i++) {
    const x = -span * 0.5 + (i / (slats - 1)) * span;
    const h = 1.08 + Math.sin(i * 5.1) * 0.07;
    const tiltZ = Math.sin(i * 3.7) * 0.065;
    const tiltX = Math.cos(i * 2.9) * 0.045;

    const stake = new THREE.CylinderGeometry(0.026, 0.032, h + 0.24, 7, 1);
    stake.translate(0, (h - 0.24) * 0.5, 0);
    stake.rotateZ(tiltZ);
    stake.rotateX(tiltX);
    stake.translate(x, 0, Math.sin(i * 2.1) * 0.025);
    parts.push(stake);
  }

  for (const wireY of [0.36, 0.82]) {
    const wire = new THREE.CylinderGeometry(0.011, 0.011, span + 0.14, 6, 4);
    wire.rotateZ(Math.PI * 0.5);
    wire.translate(0, wireY, 0);
    parts.push(wire);
  }
  return mergeGeometriesSimple(parts);
}

export function buildRaceFlagGeometries() {
  // 1. Stone pedestal + tapered aluminum mast + outrigger arm
  const plinth = new THREE.CylinderGeometry(0.24, 0.30, 0.52, 8, 1);
  plinth.translate(0, 0.12, 0); // sinks 0.14m below ground
  const pole = new THREE.CylinderGeometry(0.028, 0.046, 4.85, 10, 1);
  pole.translate(0, 2.75, 0);
  const arm = new THREE.CylinderGeometry(0.018, 0.020, 0.96, 8, 1);
  arm.rotateZ(Math.PI * 0.5);
  arm.translate(0.48, 5.12, 0);
  const mastGeo = mergeGeometriesSimple([plinth, pole, arm]);

  // 2. Subdivided vertical motorsport pennant cloth (6 x 12 grid = 144 tris) for smooth coastal wind flutter
  const clothGeo = new THREE.PlaneGeometry(0.92, 2.35, 6, 12);
  clothGeo.translate(0.50, 3.92, 0);
  return { mastGeo, clothGeo };
}

export function buildCoastalLamppostGeometry() {
  const base = new THREE.CylinderGeometry(0.16, 0.22, 0.85, 10, 1);
  base.translate(0, 0.28, 0);
  const shaft = new THREE.CylinderGeometry(0.055, 0.105, 5.65, 10, 2);
  shaft.translate(0, 3.45, 0);

  // Curved swan-neck arm built from 5 angled tubular segments
  const parts = [base, shaft];
  let px = 0, py = 6.22;
  for (let s = 0; s < 5; s++) {
    const ang = 0.26 + s * 0.26;
    const len = 0.36;
    const nx = px + Math.sin(ang) * len;
    const ny = py + Math.cos(ang) * len * 0.72;
    const seg = new THREE.CylinderGeometry(0.042, 0.046, len + 0.04, 8, 1);
    seg.rotateZ(-ang);
    seg.translate((px + nx) * 0.5, (py + ny) * 0.5, 0);
    parts.push(seg);
    px = nx;
    py = ny;
  }

  // Tapered coastal lantern hood
  const hood = new THREE.CylinderGeometry(0.12, 0.28, 0.22, 10, 1);
  hood.translate(px + 0.10, py - 0.05, 0);
  parts.push(hood);
  return mergeGeometriesSimple(parts);
}

export function buildStoneBollardGeometry() {
  const body = new THREE.CylinderGeometry(0.15, 0.19, 0.88, 10, 1);
  body.translate(0, 0.30, 0);
  const cap = new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.translate(0, 0.73, 0);
  return mergeGeometriesSimple([body, cap]);
}

// Helper: curved organic limb tube between 3D waypoints (never cylinder+cone!)
function buildCurvedLimbTube(points, rStart, rEnd, radSegs = 8, fluteAmp = 0.04) {
  const rings = points.length - 1;
  const vertCount = (rings + 1) * (radSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const p = points[i];
    const pPrev = points[Math.max(0, i - 1)];
    const pNext = points[Math.min(rings, i + 1)];
    let tx = pNext[0] - pPrev[0];
    let ty = pNext[1] - pPrev[1];
    let tz = pNext[2] - pPrev[2];
    const tLen = Math.hypot(tx, ty, tz) || 1;
    tx /= tLen; ty /= tLen; tz /= tLen;

    // Orthonormal ring basis around tangent T
    let ux = Math.abs(ty) > 0.92 ? 1 : 0;
    let uy = Math.abs(ty) > 0.92 ? 0 : 1;
    let uz = 0;
    let bx = ty * uz - tz * uy;
    let by = tz * ux - tx * uz;
    let bz = tx * uy - ty * ux;
    const bLen = Math.hypot(bx, by, bz) || 1;
    bx /= bLen; by /= bLen; bz /= bLen;
    const nx = by * tz - bz * ty;
    const ny = bz * tx - bx * tz;
    const nz = bx * ty - by * tx;

    const baseR = rStart * (1 - t) + rEnd * t;
    for (let j = 0; j <= radSegs; j++) {
      const ang = (j / radSegs) * Math.PI * 2;
      const flute = 1.0 + fluteAmp * Math.sin(ang * 3.0 + t * 8.0);
      const r = baseR * flute;
      const ca = Math.cos(ang) * r;
      const sa = Math.sin(ang) * r;
      const idx = i * (radSegs + 1) + j;
      positions[idx * 3] = p[0] + bx * ca + nx * sa;
      positions[idx * 3 + 1] = p[1] + by * ca + ny * sa;
      positions[idx * 3 + 2] = p[2] + bz * ca + nz * sa;
      uvs[idx * 2] = (j / radSegs) * 1.4;
      uvs[idx * 2 + 1] = t * 4.5;
    }
  }

  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = i * (radSegs + 1) + j;
      const b = a + 1;
      const c = a + (radSegs + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildStonePineGeometries() {
  // Species 3: Mediterranean Umbrella Stone Pine ("pinheiro-manso", Refs 05, 08, 10)
  // Tall furrowed bark trunk branching into 4 spreading upper boughs + broad layered umbrella canopy (~900 tris, zero cones!)
  const trunkPts = [];
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -0.35 + t * 8.15; // reaches y = 7.80m before branching
    const leanX = 0.34 * Math.pow(t, 1.45) + 0.06 * Math.sin(t * Math.PI * 2);
    const leanZ = -0.22 * Math.pow(t, 1.35);
    trunkPts.push([leanX, y, leanZ]);
  }
  const topOrigin = trunkPts[trunkPts.length - 1];
  const barkParts = [buildCurvedLimbTube(trunkPts, 0.42, 0.24, 10, 0.06)];

  // 4 spreading upper umbrella boughs
  const boughTips = [];
  for (let b = 0; b < 4; b++) {
    const az = b * (Math.PI * 0.5) + 0.38;
    const reach = 2.15 + (b % 2) * 0.35;
    const tip = [
      topOrigin[0] + Math.cos(az) * reach,
      topOrigin[1] + 1.85 + (b % 2) * 0.28,
      topOrigin[2] + Math.sin(az) * reach
    ];
    const mid = [
      (topOrigin[0] + tip[0]) * 0.5 + Math.cos(az) * 0.35,
      topOrigin[1] + 0.82,
      (topOrigin[2] + tip[2]) * 0.5 + Math.sin(az) * 0.35
    ];
    barkParts.push(buildCurvedLimbTube([
      [topOrigin[0], topOrigin[1] - 0.35, topOrigin[2]],
      mid,
      tip
    ], 0.20, 0.08, 7, 0.04));
    boughTips.push(tip);
  }
  const trunkGeo = mergeGeometriesSimple(barkParts);

  // Broad umbrella pine canopy built from 26 curved 3D domed branchlet clusters across 3 tiers
  const crownParts = [];
  const addCanopyCard = (cx, cy, cz, w, h, az, tilt) => {
    const g = new THREE.PlaneGeometry(w, h, 3, 3);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const lx = pos.getX(v);
      const ly = pos.getY(v);
      const domeZ = 0.34 - (lx * lx) * 0.09 - (ly * ly) * 0.09;
      pos.setXYZ(v, lx, ly, domeZ);
    }
    g.rotateX(-tilt);
    g.rotateY(az);
    g.translate(cx, cy, cz);
    g.computeVertexNormals();
    crownParts.push(g);
  };

  // Tier 1: Volumetric multi-angle clusters anchored around each of the 4 spreading bough tips (visible from road eye-level & above!)
  for (let b = 0; b < boughTips.length; b++) {
    const [bx, by, bz] = boughTips[b];
    for (let k = 0; k < 6; k++) {
      const az = b * 1.57 + (k / 6) * Math.PI * 2;
      const isSteep = k % 2 === 1;
      addCanopyCard(
        bx + Math.cos(az) * (isSteep ? 0.55 : 0.85),
        by + 0.05 + (k % 3) * 0.28,
        bz + Math.sin(az) * (isSteep ? 0.55 : 0.85),
        3.15,
        2.45,
        az,
        isSteep ? 0.36 : 0.78
      );
    }
  }
  // Tier 2 & 3: Central overarching sunlit umbrella dome + vertical-oblique volume cards (y = 9.4 .. 11.4m)
  for (let k = 0; k < 14; k++) {
    const isTop = k >= 8;
    const az = (k / (isTop ? 6 : 8)) * Math.PI * 2 + (isTop ? 0.35 : 0.1);
    const rad = isTop ? 0.95 : 1.85;
    addCanopyCard(
      topOrigin[0] + Math.cos(az) * rad,
      topOrigin[1] + (isTop ? 2.85 : 2.05 + (k % 2) * 0.32),
      topOrigin[2] + Math.sin(az) * rad,
      isTop ? 3.35 : 3.25,
      2.55,
      az,
      isTop ? 1.08 : (k % 2 === 0 ? 0.44 : 0.86)
    );
  }

  const crownGeo = mergeGeometriesSimple(crownParts);
  return { trunkGeo, crownGeo };
}

export function buildOliveTreeGeometries() {
  // Species 4: Gnarled Mediterranean Olive Tree ("oliveira", Refs 05, 08, 09)
  // Twisted multi-fluted base trunk splitting into 3 spreading limbs + airy silvery-olive foliage lobes
  const basePts = [
    [0.00, -0.30, 0.00],
    [0.08,  0.45, 0.05],
    [-0.06, 1.15, 0.10],
    [0.04,  1.85, 0.02]
  ];
  const barkParts = [buildCurvedLimbTube(basePts, 0.36, 0.23, 9, 0.15)];
  const limbTips = [];

  for (let l = 0; l < 3; l++) {
    const az = l * ((Math.PI * 2) / 3) + 0.25;
    const reach = 1.45 + (l % 2) * 0.28;
    const mid = [Math.cos(az) * reach * 0.55, 2.65, Math.sin(az) * reach * 0.55];
    const tip = [Math.cos(az) * reach, 3.55 + (l % 2) * 0.25, Math.sin(az) * reach];
    barkParts.push(buildCurvedLimbTube([[0.04, 1.72, 0.02], mid, tip], 0.18, 0.075, 7, 0.10));
    limbTips.push(tip);
  }
  const trunkGeo = mergeGeometriesSimple(barkParts);

  const crownParts = [];
  for (let l = 0; l < limbTips.length; l++) {
    const [lx, ly, lz] = limbTips[l];
    for (let c = 0; c < 6; c++) {
      const az = l * 2.1 + (c / 6) * Math.PI * 2;
      const w = 1.95;
      const h = 1.65;
      const g = new THREE.PlaneGeometry(w, h, 3, 3);
      const pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const px = pos.getX(v);
        const py = pos.getY(v);
        pos.setZ(v, 0.26 - (px * px + py * py) * 0.12);
      }
      g.rotateX(-(0.58 + (c % 2) * 0.42));
      g.rotateY(az);
      g.translate(
        lx + Math.cos(az) * 0.48,
        ly + 0.22 + (c % 3) * 0.34,
        lz + Math.sin(az) * 0.48
      );
      g.computeVertexNormals();
      crownParts.push(g);
    }
  }
  const crownGeo = mergeGeometriesSimple(crownParts);
  return { trunkGeo, crownGeo };
}

export function buildChevronSignGeometries() {
  // Twin galvanized steel posts + stone collars + curved beveled chevron sign plate (>110 tris, never BoxGeometry)
  const postParts = [];
  for (const ox of [-0.58, 0.58]) {
    const foot = new THREE.CylinderGeometry(0.11, 0.14, 0.45, 8, 1);
    foot.translate(ox, 0.02, -0.05);
    const pole = new THREE.CylinderGeometry(0.036, 0.040, 2.05, 8, 1);
    pole.translate(ox, 0.92, -0.05);
    postParts.push(foot, pole);
  }
  const postGeo = mergeGeometriesSimple(postParts);

  // Curved front & back chevron plate (8 x 2 subdivisions each = 64 tris)
  const makeFace = (zOff, flip) => {
    const g = new THREE.PlaneGeometry(1.76, 0.86, 8, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      pos.setZ(i, 0.06 * Math.cos((px / 0.88) * Math.PI * 0.5));
    }
    if (flip) g.rotateY(Math.PI);
    g.translate(0, 1.44, zOff);
    g.computeVertexNormals();
    return g;
  };
  const plateGeo = mergeGeometriesSimple([makeFace(0.02, false), makeFace(-0.02, true)]);
  return { postGeo, plateGeo };
}

export function buildTerracottaPlanterGeometries() {
  // Molded 12-sided Mediterranean terracotta urn planter + domed shrub foliage crown
  const base = new THREE.CylinderGeometry(0.32, 0.26, 0.24, 12, 1);
  base.translate(0, -0.04, 0);
  const belly = new THREE.CylinderGeometry(0.46, 0.32, 0.46, 12, 2);
  belly.translate(0, 0.30, 0);
  const rim = new THREE.TorusGeometry(0.46, 0.055, 8, 14);
  rim.rotateX(Math.PI * 0.5);
  rim.translate(0, 0.54, 0);
  const potGeo = mergeGeometriesSimple([base, belly, rim]);

  const bushGeo = buildShrubGeometry();
  bushGeo.scale(0.58, 0.62, 0.58);
  bushGeo.translate(0, 0.52, 0);
  return { potGeo, bushGeo };
}

export function buildSculptedRockGeometry(variantSeed = 1, squashY = 0.65) {
  // Subdivided icosahedron (detail = 3 -> 1280 tris!) displaced by stratified coastal rock FBM
  const geo = new THREE.IcosahedronGeometry(1.0, 3);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const n1 = fbm2D(x * 1.45 + variantSeed * 7.1, z * 1.45 + y * 0.9, 3, 910 + variantSeed);
    const strata = Math.sin(y * 7.5 + n1 * 2.8) * 0.085;
    const facet = 1.0 + n1 * 0.28 + strata;

    x *= facet * (1.0 + 0.14 * Math.sin(variantSeed * 2.3));
    y *= facet * squashY;
    z *= facet * (1.0 + 0.12 * Math.cos(variantSeed * 1.9));

    // Flatten underside slightly so boulder beds naturally into sand/rock
    if (y < -0.42 * squashY) {
      y = -0.42 * squashY + (y + 0.42 * squashY) * 0.35;
    }

    pos.setXYZ(i, x, y, z);
    // Continuous 3D oblique projection UVs: zero atan2 branch-cut seam AND zero side-wall stretching!
    const uCont = (x * 0.78 + y * 0.42) * 0.52 + 0.5;
    const vCont = (z * 0.78 - y * 0.42) * 0.52 + 0.5;
    uv.setXY(i, uCont, vCont);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildStartFinishGantry(world, matLib) {
  const { spline, terrain } = world;
  const sGantry = 1.6;
  const smp = spline.sampleAt(sGantry);
  const group = new THREE.Group();
  group.name = 'StartFinishGantry';

  // Left & Right space-frame towers strictly outside 3m exclusion zone (latFromEdge = 3.95m, radius = 0.65m -> clearance = 3.30m >= 3.0m!)
  const latFromEdge = 3.95;
  const dSpan = smp.halfWidth + latFromEdge;
  const ptL = spline.roadPoint(sGantry, -dSpan, 0);
  const ptR = spline.roadPoint(sGantry, +dSpan, 0);
  const hitL = terrain.raycastDown(ptL.x, ptL.z);
  const hitR = terrain.raycastDown(ptR.x, ptR.z);

  // Register both grounded support towers in world.placedObjects & obstacleColliders
  for (const [id, pt, hit] of [
    ['z1_gantry_tower_L', ptL, hitL],
    ['z1_gantry_tower_R', ptR, hitR]
  ]) {
    world.placedObjects.push({
      id,
      kind: 'gantry_tower',
      zone: 'Z1',
      s: sGantry,
      x: pt.x,
      z: pt.z,
      baseY: hit.y,
      exclusionRadius: 0.65
    });
    world.obstacleColliders.push({ x: pt.x, z: pt.z, radius: 0.68 });
  }

  const deckTopY = smp.y + 6.45;
  const deckBotY = smp.y + 5.15;
  const yaw = Math.atan2(smp.fxz_x, smp.fxz_z);

  // Build tower + truss metalwork in gantry-local frame centered at (smp.x, 0, smp.z) oriented with track tangent
  // Wait: local frame with +Z along track forward (fxz_x, fxz_z) and +X along track right (rxz_x, rxz_z)
  const metalParts = [];
  const plinthParts = [];

  for (const [sideSign, hit] of [[-1, hitL], [+1, hitR]]) {
    const cx = sideSign * dSpan;
    const baseY = hit.y;
    const towerH = deckTopY - baseY;

    // Octagonal stone/concrete foundation pad rooted 0.45m into terrain
    const pad = new THREE.CylinderGeometry(0.76, 0.92, 0.90, 10, 1);
    pad.translate(cx, baseY + 0.05, 0);
    plinthParts.push(pad);

    // 4 tubular vertical steel columns + diagonal bracing rungs
    const offsets = [
      [-0.32, -0.34],
      [ 0.32, -0.34],
      [-0.32,  0.34],
      [ 0.32,  0.34]
    ];
    for (const [ox, oz] of offsets) {
      const col = new THREE.CylinderGeometry(0.068, 0.082, towerH, 8, 1);
      col.translate(cx + ox, baseY + towerH * 0.5, oz);
      metalParts.push(col);
    }

    const rungs = 6;
    for (let r = 0; r < rungs; r++) {
      const y0 = baseY + 0.45 + (r / rungs) * (towerH - 0.6);
      const y1 = baseY + 0.45 + ((r + 1) / rungs) * (towerH - 0.6);
      const diagLen = Math.hypot(0.68, y1 - y0);
      const diagAng = Math.atan2(0.68, y1 - y0) * (r % 2 === 0 ? 1 : -1);
      for (const ox of [-0.32, 0.32]) {
        const brace = new THREE.CylinderGeometry(0.032, 0.032, diagLen, 6, 1);
        brace.rotateX(diagAng);
        brace.translate(cx + ox, (y0 + y1) * 0.5, 0);
        metalParts.push(brace);
      }
    }
  }

  // Overhead horizontal tubular space-frame bridge spanning -dSpan .. +dSpan
  const fullSpan = dSpan * 2.0 + 0.7;
  for (const [ty, tz] of [
    [deckBotY, -0.38],
    [deckBotY,  0.38],
    [deckTopY, -0.38],
    [deckTopY,  0.38]
  ]) {
    const chord = new THREE.CylinderGeometry(0.072, 0.072, fullSpan, 10, 1);
    chord.rotateZ(Math.PI * 0.5);
    chord.translate(0, ty, tz);
    metalParts.push(chord);
  }

  // Overhead diagonal truss struts across the span
  const bays = 16;
  const bayW = fullSpan / bays;
  const trussH = deckTopY - deckBotY;
  const strutLen = Math.hypot(bayW, trussH);
  for (let b = 0; b < bays; b++) {
    const x0 = -fullSpan * 0.5 + b * bayW;
    const x1 = x0 + bayW;
    const ang = Math.atan2(bayW, trussH) * (b % 2 === 0 ? 1 : -1);
    for (const tz of [-0.38, 0.38]) {
      const st = new THREE.CylinderGeometry(0.034, 0.034, strutLen, 6, 1);
      st.rotateZ(ang);
      st.translate((x0 + x1) * 0.5, (deckBotY + deckTopY) * 0.5, tz);
      metalParts.push(st);
    }
  }

  const metalMesh = new THREE.Mesh(mergeGeometriesSimple(metalParts), matLib.materials.guardrail);
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  metalMesh.userData.auditRole = 'gantry_truss';

  const plinthMesh = new THREE.Mesh(mergeGeometriesSimple(plinthParts), matLib.materials.stoneWall);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  plinthMesh.userData.auditRole = 'gantry_plinth';

  // Curved aerodynamic front & rear championship banner fascia (>> 96 tris, 1024^2 PBR banner map + brushed normal)
  const bannerW = smp.halfWidth * 2.0 + 3.6;
  const bannerH = 1.46;
  const makeCurvedFascia = (zOffset, flipY) => {
    const g = new THREE.PlaneGeometry(bannerW, bannerH, 16, 3);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const archY = 0.16 * Math.cos((px / (bannerW * 0.5)) * Math.PI * 0.5);
      const curveZ = 0.08 * Math.cos((py / (bannerH * 0.5)) * Math.PI * 0.5);
      pos.setXYZ(i, px, py + archY, curveZ);
    }
    if (flipY) g.rotateY(Math.PI);
    g.translate(0, (deckBotY + deckTopY) * 0.5 + 0.05, zOffset);
    g.computeVertexNormals();
    return g;
  };

  const bannerMat = new THREE.MeshStandardMaterial({
    map: matLib.sharedMaps.gantryBannerAlbedo,
    normalMap: matLib.sharedMaps.brushedMetalNormal,
    roughnessMap: matLib.sets.concrete.rough,
    roughness: 0.36,
    metalness: 0.32
  });
  const bannerMesh = new THREE.Mesh(
    mergeGeometriesSimple([makeCurvedFascia(-0.44, true), makeCurvedFascia(0.44, false)]),
    bannerMat
  );
  bannerMesh.castShadow = true;
  bannerMesh.receiveShadow = true;
  bannerMesh.userData.auditRole = 'gantry_banner';

  // 5 Start-Light Pods beneath gantry beam (emissive amber/green race lights)
  const lightParts = [];
  for (let i = -2; i <= 2; i++) {
    const pod = new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12, 1);
    pod.rotateX(Math.PI * 0.5);
    pod.translate(i * 1.45, deckBotY - 0.24, -0.36);
    lightParts.push(pod);
  }
  const startLightMat = new THREE.MeshStandardMaterial({
    color: '#22140a',
    emissive: new THREE.Color('#ff9d2e'),
    emissiveIntensity: 2.4,
    roughness: 0.22,
    metalness: 0.1
  });
  const startLightsMesh = new THREE.Mesh(mergeGeometriesSimple(lightParts), startLightMat);
  startLightsMesh.userData.auditRole = 'emissive';

  // Right-handed basis (det = +1): local +Z = track forward, local +Y = world up, local +X = Up x Forward = -Right!
  // That prevents negative-determinant reflection so text & normals on the gantry never mirror!
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-smp.rxz_x, 0, -smp.rxz_z),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(smp.fxz_x, 0, smp.fxz_z)
  );
  basis.setPosition(smp.x, 0, smp.z);
  group.applyMatrix4(basis);

  group.add(plinthMesh, metalMesh, bannerMesh, startLightsMesh);
  return group;
}

// ============================================================================
// Deterministic Z1 Orla Completa Builder (Gate P3)
// ============================================================================

export class CoastalPropsAndFloraSystem {
  constructor(world, matLib) {
    this.world = world;
    this.matLib = matLib;
    this.group = new THREE.Group();
    this.group.name = 'PropsAndFloraGroup';
    this.coastalRocks = [];
    this.distantDetailMeshes = [];
    this.flagClothTimeUniform = { value: 0 };

    this._buildMaterials();
    this._populateZ1Coast();
    this._populateZ2Z3Z4();
    this._computeDensityAndFloraStats();
  }

  _buildMaterials() {
    const ml = this.matLib;
    const barkMaps = ml.cloneSet('bark', 1, 1);
    this.palmTrunkMat = new THREE.MeshStandardMaterial({
      ...barkMaps,
      color: new THREE.Color('#b69e82'),
      roughness: 0.88,
      metalness: 0.02
    });

    this.palmCrownMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.palmFrondAlbedo,
      normalMap: ml.sharedMaps.foliageNormal,
      roughnessMap: ml.sets.forestGround.rough,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.64,
      metalness: 0.02
    });

    this.shrubMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.foliageClusterAlbedo,
      normalMap: ml.sharedMaps.foliageNormal,
      roughnessMap: ml.sets.forestGround.rough,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02
    });

    this.grassTuftMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.grassBladeAlbedo,
      normalMap: ml.sharedMaps.foliageNormal,
      roughnessMap: ml.sets.forestGround.rough,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02
    });

    this.beachFenceMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.woodAlbedo,
      normalMap: ml.sharedMaps.microGrainNormal,
      roughnessMap: ml.sets.bark.rough,
      color: new THREE.Color('#cbb69b'),
      roughness: 0.86,
      metalness: 0.03
    });

    const flagTimeUniform = this.flagClothTimeUniform;
    this.raceFlagClothMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.raceFlagAlbedo,
      normalMap: ml.sharedMaps.microGrainNormal,
      roughnessMap: ml.sets.plasterA.rough,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02
    });
    this.raceFlagClothMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = flagTimeUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          // Pin inner mast edge (transformed.x <= 0.08), flutter outer pennant edge in coastal breeze!
          float pinWeight = clamp((transformed.x - 0.06) / 0.88, 0.0, 1.0);
          float instSeed = 0.0;
          #ifdef USE_INSTANCING
            instSeed = instanceMatrix[3][0] * 0.17 + instanceMatrix[3][2] * 0.23;
          #endif
          float wave = sin(transformed.x * 5.2 - uTime * 5.4 + transformed.y * 1.9 + instSeed) * 0.14
                     + sin(transformed.y * 4.4 - uTime * 3.8 + instSeed * 1.7) * 0.06;
          transformed.z += wave * pinWeight;`
        );
    };
    this.raceFlagClothMat.customProgramCacheKey = () => 'coastal-race-flag-flutter-v34';

    const wetCliffMaps = ml.cloneSet('cliff', 2, 2);
    this.wetRockMat = new THREE.MeshStandardMaterial({
      ...wetCliffMaps,
      color: new THREE.Color('#746e66'),
      roughness: 0.24,
      metalness: 0.05,
      envMapIntensity: 0.85
    });

    const pineBarkMaps = ml.cloneSet('bark', 1, 2);
    this.pineTrunkMat = new THREE.MeshStandardMaterial({
      ...pineBarkMaps,
      color: new THREE.Color('#8e684e'),
      roughness: 0.90,
      metalness: 0.02
    });

    this.pineCrownMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.pineNeedleAlbedo,
      normalMap: ml.sharedMaps.foliageNormal,
      roughnessMap: ml.sets.forestGround.rough,
      alphaTest: 0.26,
      side: THREE.DoubleSide,
      roughness: 0.68,
      metalness: 0.02
    });

    const oliveBarkMaps = ml.cloneSet('bark', 1, 1);
    this.oliveTrunkMat = new THREE.MeshStandardMaterial({
      ...oliveBarkMaps,
      color: new THREE.Color('#898072'),
      roughness: 0.92,
      metalness: 0.02
    });

    this.oliveCrownMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.oliveFoliageAlbedo,
      normalMap: ml.sharedMaps.foliageNormal,
      roughnessMap: ml.sets.forestGround.rough,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02
    });

    this.chevronPlateMat = new THREE.MeshStandardMaterial({
      map: ml.sharedMaps.chevronSignAlbedo,
      normalMap: ml.sharedMaps.brushedMetalNormal,
      roughnessMap: ml.sets.concrete.rough,
      roughness: 0.34,
      metalness: 0.28
    });
  }

  _overlapsAnyBuilding(x, z, padRadius = 0.6) {
    const buildings = this.world.buildings;
    if (!buildings || buildings.length === 0) return false;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const dx = x - b.x;
      const dz = z - b.z;
      const c = Math.cos(-b.yaw);
      const s = Math.sin(-b.yaw);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < b.halfW + padRadius + 0.45 && Math.abs(lz) < b.halfD + padRadius + 0.45) {
        return true;
      }
    }
    return false;
  }

  // Strict spline-relative placement enforcing >= 3.12m exclusion clearance & exact terrain raycast grounding
  _tryRegisterSplinePlacement(s, sideSign, latFromEdge, exclusionRadius, kind, id, { sinkY = 0, addCollider = false } = {}) {
    const { spline } = this.world;
    const ws = spline.wrapS(s);
    const smp = spline.sampleAt(ws);
    const pt = spline.roadPoint(ws, sideSign * (smp.halfWidth + latFromEdge), 0);

    return this._tryRegisterXZPlacement(pt.x, pt.z, exclusionRadius, kind, id, { sinkY, addCollider });
  }

  _tryRegisterXZPlacement(x, z, exclusionRadius, kind, id, { sinkY = 0, addCollider = false } = {}) {
    const { spline, terrain, placedObjects, obstacleColliders } = this.world;
    if (
      x < terrain.minX + 6 ||
      x > terrain.maxX - 6 ||
      z < terrain.minZ + 6 ||
      z > terrain.maxZ - 6
    ) {
      return null;
    }

    const proj = spline.projectXZ(x, z);
    const clearance = (proj.absD - exclusionRadius) - proj.halfWidth;
    if (clearance < 3.12) {
      return null; // Reject anything that could violate the 3.0m exclusion zone!
    }

    if (this._overlapsAnyBuilding(x, z, exclusionRadius)) {
      return null; // Never spawn trees, streetlamps, bollards, or planters inside Z3 buildings!
    }

    const hit = terrain.raycastDown(x, z);
    const baseY = hit.y - sinkY;

    const record = {
      id,
      kind,
      zone: proj.zone,
      s: proj.s,
      x,
      z,
      baseY,
      terrainY: hit.y,
      normal: hit,
      exclusionRadius
    };
    placedObjects.push(record);

    if (addCollider && proj.absD < proj.halfWidth + 16.0 && hit.y > 0.1) {
      obstacleColliders.push({ x, z, radius: Math.max(0.35, exclusionRadius * 0.85) });
    }
    return record;
  }

  _populateZ1Coast() {
    const { spline, terrain, trackData } = this.world;
    const rng = mulberry32((trackData.seed || 20261102) + 303);
    const L = spline.totalLength;

    // 1. Start/Finish Gantry at s = 1.6m
    const gantry = buildStartFinishGantry(this.world, this.matLib);
    this.group.add(gantry);

    // Collect Z1 arc-length ranges dynamically from spline samples (s in 0..458 and 2890..3019)
    const isZ1 = (s) => spline.sampleAt(s).zone === 'Z1';

    const dummy = new THREE.Object3D();
    const palmMatrices = [];
    const palmTints = [];
    const shrubMatrices = [];
    const shrubTints = [];
    const grassMatrices = [];
    const grassTints = [];
    const fenceMatrices = [];
    const flagMatrices = [];
    const flagTints = [];
    const lampMatrices = [];
    const bollardMatrices = [];

    const dryRockBuckets = [[], [], []];
    const wetRockBuckets = [[], [], []];

    // 2. Fluttering Coastal Race Flags along Z1 straight & grid approach (every 18m on both sides, outside 3m exclusion!)
    let flagIdx = 0;
    for (let s = 0; s < L; s += 18.0) {
      if (!isZ1(s)) continue;
      // Leave clean breathing room right at s=0..8 next to gantry towers
      if (s < 8.0 || s > L - 4.0) continue;
      for (const side of [-1, 1]) {
        // On open beach stretch (s > 175, side = +1), space flags every 36m so beach view stays wide open
        if (side === 1 && s > 175 && s < 460 && (Math.round(s / 18) % 2 === 1)) continue;
        const lat = 3.55 + (rng() - 0.5) * 0.18;
        const rec = this._tryRegisterSplinePlacement(s, side, lat, 0.30, 'prop_flag', `z1_flag_${flagIdx++}`, {
          addCollider: true
        });
        if (!rec) continue;
        // Prevent underwater flags
        if (rec.terrainY < 0.65) {
          this.world.placedObjects.pop();
          continue;
        }
        const smp = spline.sampleAt(s);
        const yaw = Math.atan2(smp.fxz_x, smp.fxz_z) + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        dummy.position.set(rec.x, rec.baseY, rec.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(0.95 + rng() * 0.12);
        dummy.updateMatrix();
        flagMatrices.push(dummy.matrix.clone());

        const palette = [
          new THREE.Color('#ffffff'),
          new THREE.Color('#ffd9a8'),
          new THREE.Color('#d9ecff')
        ];
        flagTints.push(palette[flagIdx % palette.length]);
      }
    }

    // 3. Coastal Promenade Streetlamps (inland side = -1 every 32m) & Stone Bollards (every 16m)
    let lampIdx = 0;
    let bolIdx = 0;
    for (let s = 14; s < L - 8; s += 16.0) {
      if (!isZ1(s)) continue;

      if (Math.round(s / 16) % 2 === 0) {
        const recLamp = this._tryRegisterSplinePlacement(s, -1, 3.85, 0.32, 'prop_lamppost', `z1_lamp_${lampIdx++}`, {
          addCollider: true
        });
        if (recLamp && recLamp.terrainY > 1.0) {
          const smp = spline.sampleAt(s);
          // Aim swan-neck arm toward the road (-1 side -> face +right of road)
          const yaw = Math.atan2(smp.rxz_z, smp.rxz_x);
          dummy.position.set(recLamp.x, recLamp.baseY, recLamp.z);
          dummy.rotation.set(0, -yaw, 0);
          dummy.scale.setScalar(1.0);
          dummy.updateMatrix();
          lampMatrices.push(dummy.matrix.clone());
        }
      }

      // Stone promenade bollards along outer shoulder
      for (const side of [-1, 1]) {
        if (side === 1 && s > 180 && s < 460) continue;
        const recBol = this._tryRegisterSplinePlacement(s + 6.0, side, 3.42, 0.22, 'prop_bollard', `z1_bol_${bolIdx++}`, {
          addCollider: true
        });
        if (recBol && recBol.terrainY > 0.9) {
          dummy.position.set(recBol.x, recBol.baseY, recBol.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.setScalar(0.94 + rng() * 0.14);
          dummy.updateMatrix();
          bollardMatrices.push(dummy.matrix.clone());
        }
      }
    }

    // 4. Mediterranean Palm Trees (Ref 01 backlit coastal palms lining both sides of Z1 straight & upper beach!)
    let palmIdx = 0;
    for (let s = 0; s < L; s += 14.5) {
      if (!isZ1(s)) continue;
      for (const side of [-1, 1]) {
        // Staggered natural groves (primary row at 5.2..9.5m + secondary grove row at 12..21m)
        const rows = side === -1 ? [5.4 + rng() * 3.8, 12.5 + rng() * 9.0] : [5.8 + rng() * 4.2];
        for (let r = 0; r < rows.length; r++) {
          if (r === 1 && rng() < 0.42) continue;
          if (side === 1 && rng() < 0.24) continue; // Keep clear ocean windows between seaside palms!
          const sJit = s + (rng() - 0.5) * 6.5;
          const rec = this._tryRegisterSplinePlacement(sJit, side, rows[r], 0.55, 'flora_palm', `z1_palm_${palmIdx++}`, {
            addCollider: true
          });
          if (!rec) continue;
          // Palms grow on dry sand & coastal soil (y > 1.15m), never in surf swash!
          if (rec.terrainY < 1.25) {
            this.world.placedObjects.pop();
            continue;
          }

          const sc = 0.78 + rng() * 0.52; // 6.1m .. 10.2m tall palms
          dummy.position.set(rec.x, rec.baseY, rec.z);
          dummy.rotation.set(
            (rng() - 0.5) * 0.08,
            rng() * Math.PI * 2,
            (rng() - 0.5) * 0.08
          );
          dummy.scale.set(sc * (0.94 + rng() * 0.12), sc, sc * (0.94 + rng() * 0.12));
          dummy.updateMatrix();
          palmMatrices.push(dummy.matrix.clone());

          const warmth = 0.86 + rng() * 0.28;
          palmTints.push(new THREE.Color(warmth, 0.90 + rng() * 0.20, 0.78 + rng() * 0.22));
        }
      }
    }

    // 5. Wooden Beach / Dune Slat Fences (Ref 03: continuous & broken dune fence lines on seaside sandy slope!)
    let fenceIdx = 0;
    const fenceLines = [
      { sStart: 42,  sEnd: 145, lat: 6.8 },
      { sStart: 166, sEnd: 318, lat: 4.8 },
      { sStart: 195, sEnd: 365, lat: 11.4 },
      { sStart: 2910, sEnd: 2998, lat: 6.4 }
    ];
    for (const fl of fenceLines) {
      for (let s = fl.sStart; s <= fl.sEnd; s += 3.72) {
        // Occasional natural footpath gap to the beach
        if (Math.sin(s * 0.095) > 0.84) continue;
        const lat = fl.lat + Math.sin(s * 0.05) * 0.75;
        const rec = this._tryRegisterSplinePlacement(s, 1, lat, 0.35, 'prop_beach_fence', `z1_fence_${fenceIdx++}`);
        if (!rec) continue;
        if (rec.terrainY < 0.95) {
          this.world.placedObjects.pop();
          continue;
        }
        const smp = spline.sampleAt(s);
        const yaw = Math.atan2(smp.fxz_x, smp.fxz_z) - Math.PI * 0.5 + (rng() - 0.5) * 0.06;
        // Tilt fence panel gently along terrain slope
        const slopePitch = Math.atan2(-rec.normal.nz, rec.normal.ny) * 0.45;
        const slopeRoll = Math.atan2(rec.normal.nx, rec.normal.ny) * 0.45;

        dummy.position.set(rec.x, rec.baseY, rec.z);
        dummy.rotation.set(slopePitch, yaw, slopeRoll);
        dummy.scale.setScalar(0.96 + rng() * 0.08);
        dummy.updateMatrix();
        fenceMatrices.push(dummy.matrix.clone());
      }
    }

    // 6. Coastal Mediterranean Shrubs ('flora_shrub') & Marram Dune Grass Undergrowth ('flora_undergrowth')
    let shrubIdx = 0;
    let grassIdx = 0;
    for (let s = 0; s < L; s += 7.5) {
      if (!isZ1(s)) continue;
      for (const side of [-1, 1]) {
        // Shrubs along inland hillside & upper beach dune crest
        if (rng() < 0.72) {
          const latShrub = 4.4 + rng() * 14.5;
          const recS = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 4.0,
            side,
            latShrub,
            0.45,
            'flora_shrub',
            `z1_shrub_${shrubIdx++}`
          );
          if (recS && recS.terrainY > 1.2) {
            const sc = 0.72 + rng() * 0.75;
            dummy.position.set(recS.x, recS.baseY, recS.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.set(sc * (0.9 + rng() * 0.25), sc * (0.78 + rng() * 0.3), sc * (0.9 + rng() * 0.25));
            dummy.updateMatrix();
            shrubMatrices.push(dummy.matrix.clone());
            shrubTints.push(new THREE.Color(0.84 + rng() * 0.28, 0.88 + rng() * 0.22, 0.76 + rng() * 0.22));
          } else if (recS) {
            this.world.placedObjects.pop();
          }
        }

        // Dense tufts of coastal marram grass along shoulders, fences & dunes (Section 5.4: vegetação rasteira nas bordas fora da vila)
        for (let g = 0; g < 2; g++) {
          const latGrass = 3.55 + rng() * 16.0;
          const recG = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 6.0,
            side,
            latGrass,
            0.22,
            'flora_undergrowth',
            `z1_grass_${grassIdx++}`
          );
          if (recG && recG.terrainY > 0.85) {
            const sc = 0.80 + rng() * 0.75;
            dummy.position.set(recG.x, recG.baseY, recG.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.set(sc, sc * (0.85 + rng() * 0.35), sc);
            dummy.updateMatrix();
            grassMatrices.push(dummy.matrix.clone());
            grassTints.push(new THREE.Color(0.88 + rng() * 0.24, 0.90 + rng() * 0.18, 0.78 + rng() * 0.22));
          } else if (recG) {
            this.world.placedObjects.pop();
          }
        }
      }
    }

    // 7. Coastal Rocks, Wet Shoreline Cobble Clusters & Surf Boulders with Foam (Section 4 Z1, Ref 02 & Ref 04)
    // Placed deterministically along the curved shoreline zShore(x) across Z1 (x in [-410 .. +455])
    let rockIdx = 0;
    const clusterAnchorsX = [];
    for (let x = -395; x <= 445; x += 22.0) {
      clusterAnchorsX.push(x + (rng() - 0.5) * 9.0);
    }
    // Guarantee a rich hero shoreline & surf rock cluster in the prime Z1 open-beach vista (x in [115..255]) for S1 & S3!
    clusterAnchorsX.push(138, 156, 174, 192, 212, 232);

    for (const ax of clusterAnchorsX) {
      const zShore = terrain.shorelineZ(ax);
      // Place 2-3 partially submerged surf boulders (z = zShore + 0.5..7.5m, shallow enough to protrude clearly with foam rings!)
      // + 4-6 wet-sand waterline boulders/cobbles (z = zShore - 4.8..+1.6m) matching Ref 04!
      const countInCluster = 6 + Math.floor(rng() * 4);
      for (let c = 0; c < countInCluster; c++) {
        const isOffshoreBoulder = c < 3;
        const rx = ax + (rng() - 0.5) * (isOffshoreBoulder ? 9.5 : 8.5);
        const rz = isOffshoreBoulder
          ? zShore + 0.4 + rng() * 6.8
          : zShore - 4.8 + rng() * 6.2;

        const rad = isOffshoreBoulder
          ? 1.05 + rng() * 1.55
          : 0.28 + Math.pow(rng(), 1.35) * 1.15;

        const sinkY = rad * (isOffshoreBoulder ? 0.14 : 0.22);
        const rec = this._tryRegisterXZPlacement(rx, rz, Math.min(0.85, rad * 0.7), 'rock', `z1_rock_${rockIdx++}`, {
          sinkY,
          addCollider: !isOffshoreBoulder
        });
        if (!rec) continue;

        let renderY = rec.baseY;
        const squashY = isOffshoreBoulder ? (0.74 + rng() * 0.28) : (0.52 + rng() * 0.34);
        const crownTop = renderY + rad * squashY * 0.90;
        if (rec.terrainY < 0.0 && crownTop < 0.35) {
          const maxAllowedLift = rec.terrainY + 0.24 - renderY;
          renderY += Math.max(0, Math.min(maxAllowedLift, 0.45 - crownTop));
          rec.baseY = renderY;
        }
        if (renderY + rad * squashY < -0.10) {
          this.world.placedObjects.pop();
          continue;
        }

        const isWet = rec.terrainY < 0.85;
        // Only register rocks genuinely in the water (terrainY < 0.08m) for ocean splash/foam collars!
        const isWaterline = rec.terrainY < 0.08 && rec.terrainY > -2.2;
        if (isWaterline) {
          this.coastalRocks.push({ x: rx, z: rz, radius: rad, waterline: true });
        }

        const variant = rockIdx % 3;
        dummy.position.set(rx, renderY, rz);
        dummy.rotation.set((rng() - 0.5) * 0.28, rng() * Math.PI * 2, (rng() - 0.5) * 0.28);
        dummy.scale.set(rad * (0.9 + rng() * 0.3), rad * squashY, rad * (0.9 + rng() * 0.3));
        dummy.updateMatrix();

        if (isWet) {
          wetRockBuckets[variant].push(dummy.matrix.clone());
        } else {
          dryRockBuckets[variant].push(dummy.matrix.clone());
        }
      }
    }

    // Build InstancedMeshes
    const addInstanced = (geo, mat, matrices, tints, name, role, castShadow = true) => {
      if (matrices.length === 0) return null;
      const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
      inst.name = name;
      inst.castShadow = castShadow;
      inst.receiveShadow = true;
      inst.userData.auditRole = role;
      for (let i = 0; i < matrices.length; i++) {
        inst.setMatrixAt(i, matrices[i]);
        if (tints && tints[i]) inst.setColorAt(i, tints[i]);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.group.add(inst);
      return inst;
    };

    const { trunkGeo, crownGeo } = buildPalmGeometries();
    addInstanced(trunkGeo, this.palmTrunkMat, palmMatrices, null, 'Z1PalmTrunks', 'flora_palm', true);
    addInstanced(crownGeo, this.palmCrownMat, palmMatrices, palmTints, 'Z1PalmCrowns', 'flora_palm', true);

    const shrubGeo = buildShrubGeometry();
    addInstanced(shrubGeo, this.shrubMat, shrubMatrices, shrubTints, 'Z1CoastalShrubs', 'flora_shrub', true);

    const grassGeo = buildGrassTuftGeometry();
    addInstanced(grassGeo, this.grassTuftMat, grassMatrices, grassTints, 'Z1DuneGrassTufts', 'flora_undergrowth', false);

    const fenceGeo = buildBeachFenceGeometry();
    addInstanced(fenceGeo, this.beachFenceMat, fenceMatrices, null, 'Z1BeachFences', 'prop_beach_fence', true);

    const { mastGeo, clothGeo } = buildRaceFlagGeometries();
    addInstanced(mastGeo, this.matLib.materials.guardrail, flagMatrices, null, 'Z1RaceFlagMasts', 'prop_flag', true);
    addInstanced(clothGeo, this.raceFlagClothMat, flagMatrices, flagTints, 'Z1RaceFlagCloths', 'prop_flag', true);

    const lampGeo = buildCoastalLamppostGeometry();
    addInstanced(lampGeo, this.matLib.materials.guardrail, lampMatrices, null, 'Z1CoastalLampposts', 'prop_lamppost', true);

    const bollardGeo = buildStoneBollardGeometry();
    addInstanced(bollardGeo, this.matLib.materials.stoneWall, bollardMatrices, null, 'Z1StoneBollards', 'prop_bollard', true);

    const rockGeos = [
      buildSculptedRockGeometry(1, 0.72),
      buildSculptedRockGeometry(2, 0.62),
      buildSculptedRockGeometry(3, 0.48)
    ];
    for (let v = 0; v < 3; v++) {
      addInstanced(rockGeos[v], this.matLib.materials.rock, dryRockBuckets[v], null, `Z1DryRocks_${v}`, 'rock', true);
      addInstanced(rockGeos[v], this.wetRockMat, wetRockBuckets[v], null, `Z1WetRocks_${v}`, 'rock', true);
    }
    this._sharedRockGeos = rockGeos;
    this._sharedPalmGeos = { trunkGeo, crownGeo };
    this._sharedShrubGeo = shrubGeo;
    this._sharedGrassGeo = grassGeo;
    this._sharedLampGeo = lampGeo;
    this._sharedBollardGeo = bollardGeo;
  }

  _populateZ2Z3Z4() {
    const { spline, trackData } = this.world;
    const rng = mulberry32((trackData.seed || 20261102) + 909);
    const L = spline.totalLength;
    const dummy = new THREE.Object3D();

    const pineMatrices = [];
    const pineTints = [];
    const pineFarMatrices = [];
    const pineFarTints = [];
    const oliveMatrices = [];
    const oliveTints = [];
    const palmMatrices = [];
    const palmTints = [];
    const shrubMatrices = [];
    const shrubTints = [];
    const grassMatrices = [];
    const grassTints = [];
    const chevronMatrices = [];
    const villageLampMatrices = [];
    const planterMatrices = [];
    const planterTints = [];
    const bollardMatrices = [];
    const rockBuckets = [[], [], []];

    let pineIdx = 0;
    let oliveIdx = 0;
    let palmIdx = 0;
    let shrubIdx = 0;
    let grassIdx = 0;
    let chevIdx = 0;
    let vLampIdx = 0;
    let plantIdx = 0;
    let bolIdx = 0;
    let rockIdx = 0;

    // ------------------------------------------------------------------------
    // A. Corner Chevron Warning Boards on Z2 Switchbacks & Z4 Fast Curves
    // ------------------------------------------------------------------------
    let lastChevronS = -999;
    for (let s = 12; s < L - 12; s += 11.0) {
      const smp = spline.sampleAt(s);
      if (smp.zone !== 'Z2' && smp.zone !== 'Z4') continue;
      if (smp.isBridge) continue;
      if (Math.abs(smp.curvature) < 0.0135) continue;
      if (s - lastChevronS < 11.5) continue;

      // Place on outer side of curve (positive curvature = right turn -> outer is left = -1)
      const outerSide = smp.curvature > 0 ? -1 : 1;
      const rec = this._tryRegisterSplinePlacement(s, outerSide, 3.65, 0.38, 'prop_chevron', `z24_chev_${chevIdx++}`, {
        addCollider: true
      });
      if (!rec || rec.terrainY < 1.2) {
        if (rec) this.world.placedObjects.pop();
        continue;
      }
      lastChevronS = s;
      // Face chevron sign toward approaching drivers (-track tangent) angled slightly inward
      const yaw = Math.atan2(-smp.fxz_x, -smp.fxz_z) + outerSide * 0.28;
      dummy.position.set(rec.x, rec.baseY, rec.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      chevronMatrices.push(dummy.matrix.clone());
    }

    // ------------------------------------------------------------------------
    // B. Z2 Falésia: Craggy Cliff Rock Outcrops, Talus Boulders, Cliff Shrubs,
    //    Marram Undergrowth & Upper-Cliff Pines/Olives (Ref 02)
    // ------------------------------------------------------------------------
    for (let s = 0; s < L; s += 7.0) {
      const smp = spline.sampleAt(s);
      if (smp.zone !== 'Z2') continue;

      // Determine which side is inland cliff wall vs seaward dropoff
      const rxDotSea = smp.rxz_x * 0.56 + smp.rxz_z * 0.83;
      const seaSide = rxDotSea >= 0 ? 1 : -1;
      const cliffSide = -seaSide;

      // 1. Massive stratified craggy rock formations & fallen talus boulders along the inland cliff face
      for (let c = 0; c < 3; c++) {
        const latRock = 4.6 + c * 4.4 + rng() * 3.2;
        const rad = c === 0 ? (1.15 + rng() * 1.35) : (2.4 + rng() * 2.8);
        const sinkY = rad * 0.34;
        const recR = this._tryRegisterSplinePlacement(
          s + (rng() - 0.5) * 4.5,
          cliffSide,
          latRock,
          Math.min(1.15, rad * 0.45),
          'rock',
          `z2_cliff_rock_${rockIdx++}`,
          { sinkY, addCollider: c === 0 }
        );
        if (recR && recR.terrainY > 1.5) {
          const variant = rockIdx % 3;
          const tallScale = c === 0 ? (0.75 + rng() * 0.35) : (1.15 + rng() * 0.65);
          dummy.position.set(recR.x, recR.baseY, recR.z);
          dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
          dummy.scale.set(rad * (0.9 + rng() * 0.3), rad * tallScale, rad * (0.9 + rng() * 0.3));
          dummy.updateMatrix();
          rockBuckets[variant].push(dummy.matrix.clone());
        } else if (recR) {
          this.world.placedObjects.pop();
        }
      }

      // Scattered weathered coastal boulders on seaward slope below guardrail
      if (rng() < 0.55) {
        const rad = 0.65 + rng() * 1.25;
        const recSeaR = this._tryRegisterSplinePlacement(
          s + (rng() - 0.5) * 3.5,
          seaSide,
          4.4 + rng() * 9.5,
          Math.min(0.75, rad * 0.5),
          'rock',
          `z2_sea_rock_${rockIdx++}`,
          { sinkY: rad * 0.28 }
        );
        if (recSeaR && recSeaR.terrainY > 1.2) {
          dummy.position.set(recSeaR.x, recSeaR.baseY, recSeaR.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.set(rad, rad * 0.68, rad * 0.92);
          dummy.updateMatrix();
          rockBuckets[rockIdx % 3].push(dummy.matrix.clone());
        } else if (recSeaR) {
          this.world.placedObjects.pop();
        }
      }

      // 2. Hardy Mediterranean cliff shrubs & dense roadside undergrowth on both shoulders
      for (const side of [cliffSide, seaSide]) {
        if (rng() < 0.68) {
          const recS = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 4.0,
            side,
            3.85 + rng() * 10.5,
            0.42,
            'flora_shrub',
            `z2_shrub_${shrubIdx++}`
          );
          if (recS && recS.terrainY > 1.5) {
            const sc = 0.68 + rng() * 0.72;
            dummy.position.set(recS.x, recS.baseY, recS.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.set(sc, sc * (0.75 + rng() * 0.3), sc);
            dummy.updateMatrix();
            shrubMatrices.push(dummy.matrix.clone());
            shrubTints.push(new THREE.Color(0.84 + rng() * 0.26, 0.88 + rng() * 0.20, 0.74 + rng() * 0.20));
          } else if (recS) {
            this.world.placedObjects.pop();
          }
        }

        const recG = this._tryRegisterSplinePlacement(
          s + (rng() - 0.5) * 5.0,
          side,
          3.48 + rng() * 8.5,
          0.22,
          'flora_undergrowth',
          `z2_grass_${grassIdx++}`
        );
        if (recG && recG.terrainY > 1.4) {
          const sc = 0.78 + rng() * 0.70;
          dummy.position.set(recG.x, recG.baseY, recG.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.set(sc, sc * (0.85 + rng() * 0.3), sc);
          dummy.updateMatrix();
          grassMatrices.push(dummy.matrix.clone());
          grassTints.push(new THREE.Color(0.88 + rng() * 0.22, 0.88 + rng() * 0.18, 0.74 + rng() * 0.20));
        } else if (recG) {
          this.world.placedObjects.pop();
        }
      }

      // 3. Upper Z2 transition olive trees & wind-sculpted stone pines (keeps seaward mirante view open!)
      if (smp.y > 26.0 && rng() < 0.26) {
        const isOlive = rng() < 0.62;
        const latTree = 6.5 + rng() * 11.0;
        const recT = this._tryRegisterSplinePlacement(
          s,
          cliffSide,
          latTree,
          0.62,
          isOlive ? 'flora_olive' : 'flora_pine',
          `z2_tree_${pineIdx + oliveIdx}`,
          { addCollider: true }
        );
        if (recT && recT.terrainY > 4.0) {
          const sc = isOlive ? (0.82 + rng() * 0.38) : (0.76 + rng() * 0.36);
          dummy.position.set(recT.x, recT.baseY, recT.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          const tint = new THREE.Color(0.88 + rng() * 0.22, 0.92 + rng() * 0.16, 0.84 + rng() * 0.18);
          if (isOlive) {
            oliveMatrices.push(dummy.matrix.clone());
            oliveTints.push(tint);
            oliveIdx++;
          } else {
            pineMatrices.push(dummy.matrix.clone());
            pineTints.push(tint);
            pineIdx++;
          }
        } else if (recT) {
          this.world.placedObjects.pop();
        }
      }
    }

    // ------------------------------------------------------------------------
    // C. Z3 Vila Costeira: Streetlamps, Terracotta Planters, Stone Bollards,
    //    Plaza & Courtyard Olive Trees, Palms, and Garden Shrubs (Refs 05, 06, 07)
    // ------------------------------------------------------------------------
    const scaleHouseS = trackData.landmarks?.scaleHouseAtS || 1528;
    for (let s = 0; s < L; s += 11.0) {
      const smp = spline.sampleAt(s);
      if (smp.zone !== 'Z3') continue;

      for (const side of [-1, 1]) {
        // Keep the pull-off pocket directly in front of the S11 Scale Reference House clear so car & 2.1m door are unobstructed!
        if (side === 1 && Math.abs(s - scaleHouseS) < 8.5) continue;

        // 1. Vintage village streetlamps every ~22m alternating/paired along sidewalks
        if (Math.round(s / 11) % 2 === (side > 0 ? 0 : 1)) {
          const recL = this._tryRegisterSplinePlacement(s, side, 3.62, 0.32, 'prop_lamppost', `z3_lamp_${vLampIdx++}`, {
            addCollider: true
          });
          if (recL) {
            // Aim lantern arm toward the village street
            const yaw = Math.atan2(smp.rxz_z, smp.rxz_x) + (side > 0 ? Math.PI : 0);
            dummy.position.set(recL.x, recL.baseY, recL.z);
            dummy.rotation.set(0, -yaw, 0);
            dummy.scale.setScalar(0.90);
            dummy.updateMatrix();
            villageLampMatrices.push(dummy.matrix.clone());
          }
        }

        // 2. Terracotta urn planters with shrubs along house fronts & plaza
        const recP = this._tryRegisterSplinePlacement(
          s + 3.5,
          side,
          3.95 + rng() * 1.4,
          0.46,
          'prop_planter',
          `z3_planter_${plantIdx++}`,
          { addCollider: true }
        );
        if (recP) {
          const sc = 0.88 + rng() * 0.28;
          dummy.position.set(recP.x, recP.baseY, recP.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          planterMatrices.push(dummy.matrix.clone());
          planterTints.push(new THREE.Color(0.86 + rng() * 0.26, 0.90 + rng() * 0.18, 0.80 + rng() * 0.20));
        }

        // 3. Stone village sidewalk bollards
        const recB = this._tryRegisterSplinePlacement(s + 5.5, side, 3.40, 0.22, 'prop_bollard', `z3_bol_${bolIdx++}`, {
          addCollider: true
        });
        if (recB) {
          dummy.position.set(recB.x, recB.baseY, recB.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.setScalar(0.95);
          dummy.updateMatrix();
          bollardMatrices.push(dummy.matrix.clone());
        }

        // 4. Courtyard & Plaza Olive Trees, Palms & Garden Shrubs in open pockets between houses (never blocking open sky!)
        const latGarden = 6.2 + rng() * 18.0;
        const choosePalm = rng() < 0.28;
        const recTree = this._tryRegisterSplinePlacement(
          s + (rng() - 0.5) * 4.5,
          side,
          latGarden,
          0.60,
          choosePalm ? 'flora_palm' : 'flora_olive',
          `z3_tree_${oliveIdx + palmIdx}`,
          { addCollider: true }
        );
        if (recTree) {
          const sc = choosePalm ? (0.76 + rng() * 0.34) : (0.85 + rng() * 0.38);
          dummy.position.set(recTree.x, recTree.baseY, recTree.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          const tint = new THREE.Color(0.90 + rng() * 0.20, 0.92 + rng() * 0.16, 0.84 + rng() * 0.18);
          if (choosePalm) {
            palmMatrices.push(dummy.matrix.clone());
            palmTints.push(tint);
            palmIdx++;
          } else {
            oliveMatrices.push(dummy.matrix.clone());
            oliveTints.push(tint);
            oliveIdx++;
          }
        }

        if (rng() < 0.65) {
          const recSh = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 5.0,
            side,
            4.8 + rng() * 13.0,
            0.44,
            'flora_shrub',
            `z3_shrub_${shrubIdx++}`
          );
          if (recSh) {
            const sc = 0.72 + rng() * 0.55;
            dummy.position.set(recSh.x, recSh.baseY, recSh.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.setScalar(sc);
            dummy.updateMatrix();
            shrubMatrices.push(dummy.matrix.clone());
            shrubTints.push(new THREE.Color(0.86 + rng() * 0.24, 0.90 + rng() * 0.18, 0.78 + rng() * 0.20));
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // D. Z4 Bosque e Ponte: Layered Umbrella Stone-Pine & Olive Forest,
    //    Grazing Sunlit Trunks, Dense Roadside Undergrowth & Gorge Boulders
    //    (Refs 08, 09, 10, 14)
    // ------------------------------------------------------------------------
    for (let s = 0; s < L; s += 6.0) {
      const smp = spline.sampleAt(s);
      if (smp.zone !== 'Z4') continue;
      const onBridge = smp.isBridge;
      const bs = spline.bridge.startS;

      for (const side of [-1, 1]) {
        // Keep scenic gorge-rim lookout pocket clear on sunlit East bank (side === -1, s in [bs - 14, bs + 26]) for unobstructed S7 viaduct vista!
        const inS7VistaPocket = side === -1 && s >= bs - 14 && s <= bs + 26;

        // 1. Near-track Stone Pines & Olive Trees (lat = 4.6..15.5m; on bridge span, push trees onto gorge rims lat = 11..28m!)
        const minTreeLat = onBridge ? 11.5 : 4.6;
        const nearLat = minTreeLat + rng() * 10.5;
        const isPine = rng() < 0.66;
        const recNear = inS7VistaPocket ? null : this._tryRegisterSplinePlacement(
          s + (rng() - 0.5) * 3.8,
          side,
          nearLat,
          0.62,
          isPine ? 'flora_pine' : 'flora_olive',
          `z4_tree_near_${pineIdx + oliveIdx}`,
          { addCollider: !onBridge }
        );
        if (recNear && recNear.terrainY > 2.5) {
          const sc = isPine ? (0.86 + rng() * 0.48) : (0.88 + rng() * 0.44);
          dummy.position.set(recNear.x, recNear.baseY, recNear.z);
          dummy.rotation.set((rng() - 0.5) * 0.06, rng() * Math.PI * 2, (rng() - 0.5) * 0.06);
          dummy.scale.set(sc * (0.94 + rng() * 0.14), sc, sc * (0.94 + rng() * 0.14));
          dummy.updateMatrix();
          const tint = new THREE.Color(0.86 + rng() * 0.28, 0.90 + rng() * 0.20, 0.78 + rng() * 0.22);
          if (isPine) {
            pineMatrices.push(dummy.matrix.clone());
            pineTints.push(tint);
            pineIdx++;
          } else {
            oliveMatrices.push(dummy.matrix.clone());
            oliveTints.push(tint);
            oliveIdx++;
          }
        } else if (recNear) {
          this.world.placedObjects.pop();
        }

        // 2. Deeper forest backdrop tier (lat = 16.5..34m -> toggled off in "Baixa" preset to save draw fillrate!)
        if (!inS7VistaPocket && rng() < 0.78) {
          const farLat = 16.5 + rng() * 18.5;
          const recFar = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 4.5,
            side,
            farLat,
            0.65,
            'flora_pine',
            `z4_pine_far_${pineIdx++}`
          );
          if (recFar && recFar.terrainY > 2.5) {
            const sc = 0.92 + rng() * 0.55;
            dummy.position.set(recFar.x, recFar.baseY, recFar.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.setScalar(sc);
            dummy.updateMatrix();
            pineFarMatrices.push(dummy.matrix.clone());
            pineFarTints.push(new THREE.Color(0.84 + rng() * 0.26, 0.88 + rng() * 0.20, 0.78 + rng() * 0.20));
          } else if (recFar) {
            this.world.placedObjects.pop();
          }
        }

        // 3. Layered forest shrubs (Ref 08: "Vegetação em camadas sem espaço vazio")
        for (let sh = 0; sh < (onBridge ? 1 : 2); sh++) {
          const shLat = (onBridge ? 6.5 : 3.85) + sh * 5.2 + rng() * 7.5;
          const recSh = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 4.5,
            side,
            shLat,
            0.44,
            'flora_shrub',
            `z4_shrub_${shrubIdx++}`
          );
          if (recSh && recSh.terrainY > 2.0) {
            const sc = 0.78 + rng() * 0.82;
            dummy.position.set(recSh.x, recSh.baseY, recSh.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.set(sc * (0.9 + rng() * 0.25), sc * (0.8 + rng() * 0.3), sc * (0.9 + rng() * 0.25));
            dummy.updateMatrix();
            shrubMatrices.push(dummy.matrix.clone());
            shrubTints.push(new THREE.Color(0.82 + rng() * 0.28, 0.88 + rng() * 0.22, 0.72 + rng() * 0.22));
          } else if (recSh) {
            this.world.placedObjects.pop();
          }
        }

        // 4. Continuous forest undergrowth along shoulders & ravine banks (Section 5.4: "Vegetação rasteira nas bordas fora da vila")
        for (let g = 0; g < 2; g++) {
          const gLat = (onBridge ? 5.2 : 3.45) + rng() * 12.5;
          const recGr = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 5.0,
            side,
            gLat,
            0.22,
            'flora_undergrowth',
            `z4_grass_${grassIdx++}`
          );
          if (recGr && recGr.terrainY > 2.0) {
            const sc = 0.85 + rng() * 0.80;
            dummy.position.set(recGr.x, recGr.baseY, recGr.z);
            dummy.rotation.set(0, rng() * Math.PI * 2, 0);
            dummy.scale.set(sc, sc * (0.85 + rng() * 0.35), sc);
            dummy.updateMatrix();
            grassMatrices.push(dummy.matrix.clone());
            grassTints.push(new THREE.Color(0.84 + rng() * 0.26, 0.90 + rng() * 0.18, 0.72 + rng() * 0.20));
          } else if (recGr) {
            this.world.placedObjects.pop();
          }
        }

        // 5. Mossy forest boulders & dramatic rocky ravine floor boulders under/around the viaduct bridge (Ref 14!)
        if (onBridge || rng() < 0.42) {
          const rad = onBridge ? (1.15 + rng() * 2.15) : (0.60 + rng() * 1.15);
          const rLat = (onBridge ? 4.5 : 4.2) + rng() * (onBridge ? 16.0 : 10.0);
          const recRk = this._tryRegisterSplinePlacement(
            s + (rng() - 0.5) * 4.0,
            side,
            rLat,
            Math.min(0.95, rad * 0.48),
            'rock',
            `z4_rock_${rockIdx++}`,
            { sinkY: rad * 0.28, addCollider: !onBridge }
          );
          if (recRk && recRk.terrainY > 2.0) {
            dummy.position.set(recRk.x, recRk.baseY, recRk.z);
            dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
            dummy.scale.set(rad * (0.9 + rng() * 0.28), rad * (0.62 + rng() * 0.32), rad * (0.9 + rng() * 0.28));
            dummy.updateMatrix();
            rockBuckets[rockIdx % 3].push(dummy.matrix.clone());
          } else if (recRk) {
            this.world.placedObjects.pop();
          }
        }
      }
    }

    // Build batched InstancedMeshes for Z2, Z3, Z4
    const addInstanced = (geo, mat, matrices, tints, name, role, castShadow = true, isDistant = false) => {
      if (matrices.length === 0) return null;
      const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
      inst.name = name;
      inst.castShadow = castShadow;
      inst.receiveShadow = true;
      inst.userData.auditRole = role;
      for (let i = 0; i < matrices.length; i++) {
        inst.setMatrixAt(i, matrices[i]);
        if (tints && tints[i]) inst.setColorAt(i, tints[i]);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.group.add(inst);
      if (isDistant) this.distantDetailMeshes.push(inst);
      return inst;
    };

    const pineGeos = buildStonePineGeometries();
    addInstanced(pineGeos.trunkGeo, this.pineTrunkMat, pineMatrices, null, 'Z24PineTrunks', 'flora_pine', true);
    addInstanced(pineGeos.crownGeo, this.pineCrownMat, pineMatrices, pineTints, 'Z24PineCrowns', 'flora_pine', true);
    addInstanced(pineGeos.trunkGeo, this.pineTrunkMat, pineFarMatrices, null, 'Z4FarPineTrunks', 'flora_pine', false, true);
    addInstanced(pineGeos.crownGeo, this.pineCrownMat, pineFarMatrices, pineFarTints, 'Z4FarPineCrowns', 'flora_pine', false, true);

    const oliveGeos = buildOliveTreeGeometries();
    addInstanced(oliveGeos.trunkGeo, this.oliveTrunkMat, oliveMatrices, null, 'Z234OliveTrunks', 'flora_olive', true);
    addInstanced(oliveGeos.crownGeo, this.oliveCrownMat, oliveMatrices, oliveTints, 'Z234OliveCrowns', 'flora_olive', true);

    addInstanced(this._sharedPalmGeos.trunkGeo, this.palmTrunkMat, palmMatrices, null, 'Z3PalmTrunks', 'flora_palm', true);
    addInstanced(this._sharedPalmGeos.crownGeo, this.palmCrownMat, palmMatrices, palmTints, 'Z3PalmCrowns', 'flora_palm', true);

    addInstanced(this._sharedShrubGeo, this.shrubMat, shrubMatrices, shrubTints, 'Z234Shrubs', 'flora_shrub', true);
    addInstanced(this._sharedGrassGeo, this.grassTuftMat, grassMatrices, grassTints, 'Z24Undergrowth', 'flora_undergrowth', false, true);

    const chevGeos = buildChevronSignGeometries();
    addInstanced(chevGeos.postGeo, this.matLib.materials.guardrail, chevronMatrices, null, 'Z24ChevronPosts', 'prop_chevron', true);
    addInstanced(chevGeos.plateGeo, this.chevronPlateMat, chevronMatrices, null, 'Z24ChevronPlates', 'prop_chevron', true);

    addInstanced(this._sharedLampGeo, this.matLib.materials.wroughtIron, villageLampMatrices, null, 'Z3VillageLamps', 'prop_lamppost', true);
    addInstanced(this._sharedBollardGeo, this.matLib.materials.stoneWall, bollardMatrices, null, 'Z3VillageBollards', 'prop_bollard', true);

    const planterGeos = buildTerracottaPlanterGeometries();
    addInstanced(planterGeos.potGeo, this.matLib.materials.terracottaTrim, planterMatrices, null, 'Z3PlanterPots', 'prop_planter', true);
    addInstanced(planterGeos.bushGeo, this.shrubMat, planterMatrices, planterTints, 'Z3PlanterBushes', 'flora_shrub', true);

    for (let v = 0; v < 3; v++) {
      addInstanced(this._sharedRockGeos[v], this.matLib.materials.rock, rockBuckets[v], null, `Z24DryRocks_${v}`, 'rock', true);
    }
  }

  _computeDensityAndFloraStats() {
    const { spline, placedObjects } = this.world;
    const L = spline.totalLength;
    const binCount = Math.floor(L / 100); // 30 bins covering 3019.02m (last bin = 119.02m normalized to per-100m!)
    const counts = new Array(binCount).fill(0);
    const speciesSet = new Set();

    for (let i = 0; i < placedObjects.length; i++) {
      const o = placedObjects[i];
      if (o.kind && o.kind.startsWith('flora_') && o.kind !== 'flora_undergrowth') {
        speciesSet.add(o.kind);
      }
      const b = Math.min(binCount - 1, Math.max(0, Math.floor((o.s || 0) / 100)));
      counts[b]++;
    }

    const bins = counts.map((cnt, idx) => {
      const s0 = idx * 100;
      const s1 = idx === binCount - 1 ? L : (idx + 1) * 100;
      const lenM = s1 - s0;
      return {
        bin: idx,
        rangeM: `${s0}..${s1.toFixed(0)}`,
        count: cnt,
        per100m: +((cnt / lenM) * 100).toFixed(1)
      };
    });

    let minPropsPer100m = Infinity;
    for (const b of bins) {
      if (b.per100m < minPropsPer100m) minPropsPer100m = b.per100m;
    }

    this.world.floraSpecies = Array.from(speciesSet).sort();
    this.world.propDensityBy100m = {
      minPropsPer100m,
      requiredMinPer100m: 12,
      bins
    };
  }

  setQualityPreset(quality = 'high') {
    const showDistant = quality !== 'low';
    for (const m of this.distantDetailMeshes) {
      m.visible = showDistant;
    }
  }

  update(timeSeconds) {
    this.flagClothTimeUniform.value = timeSeconds;
  }
}
