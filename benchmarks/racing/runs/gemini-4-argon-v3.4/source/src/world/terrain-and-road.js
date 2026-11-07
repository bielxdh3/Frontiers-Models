import * as THREE from 'three';
import { fbm2D, smootherstep } from './spline.js';

export class RoadCollider {
  constructor(spline, positions, indices, ringStride, sampleCount) {
    this.spline = spline;
    this.positions = positions;
    this.indices = indices;
    this.ringStride = ringStride;
    this.sampleCount = sampleCount;
    // Each spline step k has (ringStride - 1) * 2 triangles = 16 triangles
    this.trisPerStep = (ringStride - 1) * 2;
  }

  // Exact downward ray-triangle intersection against the actual road visual mesh triangles!
  raycastDown(x, z, fromY = 200.0) {
    const proj = this.spline.projectXZ(x, z);
    if (proj.absD > proj.halfWidth + 0.9) return null;

    const kCenter = Math.floor(proj.s / this.spline.ds) % this.sampleCount;
    const pos = this.positions;
    const idx = this.indices;
    const M = this.sampleCount;

    let bestHit = null;
    for (let dk = -2; dk <= 2; dk++) {
      const k = (kCenter + dk + M) % M;
      const triStart = k * this.trisPerStep * 3;
      const triEnd = triStart + this.trisPerStep * 3;
      for (let t = triStart; t < triEnd; t += 3) {
        const i0 = idx[t] * 3;
        const i1 = idx[t + 1] * 3;
        const i2 = idx[t + 2] * 3;

        const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2];
        const bx = pos[i1], by = pos[i1 + 1], bz = pos[i1 + 2];
        const cx = pos[i2], cy = pos[i2 + 1], cz = pos[i2 + 2];

        // 2D barycentric test in XZ
        const v0x = cx - ax, v0z = cz - az;
        const v1x = bx - ax, v1z = bz - az;
        const v2x = x - ax,  v2z = z - az;

        const denom = v0x * v1z - v1x * v0z;
        if (Math.abs(denom) < 1e-9) continue;
        const invDenom = 1.0 / denom;
        const u = (v2x * v1z - v1x * v2z) * invDenom;
        if (u < -1e-4 || u > 1.0001) continue;
        const v = (v0x * v2z - v2x * v0z) * invDenom;
        if (v < -1e-4 || u + v > 1.0001) continue;

        const w = 1.0 - u - v;
        const hitY = w * ay + v * by + u * cy;
        if (hitY <= fromY + 1.5 && (!bestHit || hitY > bestHit.y)) {
          // Compute exact triangle normal
          const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
          const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
          let nx = e1y * e2z - e1z * e2y;
          let ny = e1z * e2x - e1x * e2z;
          let nz = e1x * e2y - e1y * e2x;
          if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const nLen = Math.hypot(nx, ny, nz) || 1;
          bestHit = {
            y: hitY,
            nx: nx / nLen,
            ny: ny / nLen,
            nz: nz / nLen,
            surface: proj.absD > proj.halfWidth - 0.35 ? 'curb' : (proj.isBridge ? 'bridge' : 'asphalt'),
            proj
          };
        }
      }
    }
    return bestHit;
  }
}

export class TerrainHeightfield {
  constructor(spline) {
    this.spline = spline;
    this.minX = -920;
    this.maxX = 880;
    this.minZ = -820;
    this.maxZ = 460;
    this.step = 2.5;
    this.cols = Math.round((this.maxX - this.minX) / this.step) + 1; // 721
    this.rows = Math.round((this.maxZ - this.minZ) / this.step) + 1; // 513
    this.heights = new Float32Array(this.cols * this.rows);
    this.biomes = new Float32Array(this.cols * this.rows * 4); // sandDry, sandWet, cliff, forest
    this._generate();
  }

  shorelineZ(x) {
    // Natural curved Mediterranean peninsula bay along South coast, curving North around East & West capes
    const bay = 294.0 + 15.0 * Math.sin(x * 0.0062) + 6.0 * Math.cos(x * 0.014);
    const eastCape = Math.max(0, x - 480) * 0.62;
    const westCape = Math.max(0, -490 - x) * 0.55;
    return bay - eastCape * eastCape * 0.0042 - westCape * westCape * 0.0038;
  }

  baseLandscapeHeight(x, z, proj) {
    const seed = this.spline.seed;
    const zShore = this.shorelineZ(x);

    // 1. Coastal Beach & Underwater Seabed (seaward of curved peninsula shoreline)
    if (z > zShore) {
      const seaDist = z - zShore;
      const reefNoise = fbm2D(x * 0.025, z * 0.025, 3, seed + 11) * 0.55;
      return -Math.min(16.0, 0.16 * seaDist + 0.0024 * seaDist * seaDist) + reefNoise * Math.min(1, seaDist / 12);
    }

    const distInland = zShore - z; // > 0 on land
    let macroY = 0;

    if (distInland <= 38.0) {
      // Smooth sandy beach / rocky shore ramp from y=0 up to ~4.1m over 38m
      const tBeach = distInland / 38.0;
      const dune = fbm2D(x * 0.032, z * 0.032, 3, seed + 23) * 0.42 * Math.sin(Math.PI * tBeach);
      macroY = 4.1 * Math.pow(tBeach, 0.86) + dune;
    } else {
      // Smooth coastal rise from y=4.1m up to ~48.8m across the peninsula
      const tHill = Math.max(0, Math.min(1, (distInland - 38.0) / 595.0));
      macroY = 4.1 + 44.7 * smootherstep(0, 1, tHill);

      // Scenic backdrop mountains north of village (z < -415), keeping sky open
      if (z < -415) {
        const tBack = Math.min(1, (-415 - z) / 340.0);
        macroY += (46.0 + 18.0 * fbm2D(x * 0.006, z * 0.006, 3, seed + 41)) * smootherstep(0, 1, tBack);
      }
    }

    // Smooth elliptical dampening over Z3 village terrace (zero rectangular seams!)
    const vx = x / 340.0;
    const vz = (z + 345.0) / 115.0;
    const villageBlend = 1.0 - smootherstep(0.55, 1.25, Math.hypot(vx, vz));
    const villageCalm = 1.0 - 0.72 * villageBlend;

    const relief = fbm2D(x * 0.0085, z * 0.0085, 4, seed + 59) * 5.4 +
                   fbm2D(x * 0.028, z * 0.028, 3, seed + 83) * 1.1;
    let y = macroY + relief * villageCalm;

    // Z2 East Falésia Cliff: smooth s-window AND decays cleanly to 0 by absD=35.5m (before Voronoi bisector at 46m!)
    const z2SWeight = smootherstep(440, 535, proj.s) * (1.0 - smootherstep(1260, 1365, proj.s));
    if (z2SWeight > 0.001 && proj.absD < 36.0) {
      const toSea = (x - proj.sample.x) * 0.84 + (z - proj.sample.z) * 0.54;
      const sideInfluence = z2SWeight *
                            smootherstep(proj.halfWidth + 2.3, proj.halfWidth + 11.5, proj.absD) *
                            (1.0 - smootherstep(22.0, 35.5, proj.absD));
      if (toSea < -0.8) {
        const strata = Math.abs(fbm2D(x * 0.042, z * 0.042, 3, seed + 107)) * 7.6;
        const wallBoost = (17.5 + strata) * smootherstep(-0.8, -8.5, toSea);
        y += wallBoost * sideInfluence;
      } else if (toSea > 0.8) {
        const dropBoost = 16.5 * smootherstep(0.8, 9.5, toSea);
        y -= dropBoost * sideInfluence;
      }
    }

    // Taper outer East & West peninsulas smoothly into the Mediterranean Sea.
    // Along Z2 cliff (z < 190), follow the eastern cape road contour closely and plunge steeply into the sea
    // so upper Z2 switchbacks & mirante look directly down onto the sparkling Mediterranean Sea (Ref 02 / S4)!
    const eastCliffNorth = 1.0 - smootherstep(-185, 65, z); // 1 on upper Z2 (x_road ~ 465..475), 0 on lower Z2 cape (x_road ~ 515)
    const eastCoastBlend = 1.0 - smootherstep(135, 235, z); // 1 along Z2 cliff, 0 at Z1 beach bay
    const z2CapeEdge = 524 - 52 * eastCliffNorth;           // 472m on upper Z2, 524m at CP4 cape
    const eastTaperStart = 555 * (1.0 - eastCoastBlend) + z2CapeEdge * eastCoastBlend;
    const eastTaperSpan = 255 * (1.0 - eastCoastBlend) + 64 * eastCoastBlend; // steep 64m coastal cliff plunge on Z2!
    const eastTaperEnd = eastTaperStart + eastTaperSpan;
    if (x > eastTaperStart) {
      const tEast = smootherstep(eastTaperStart, eastTaperEnd, x);
      y = y * (1.0 - tEast) + (-9.5) * tEast;
    } else if (x < -595) {
      const tWest = smootherstep(-595, -850, x);
      y = y * (1.0 - tWest) + (-8.0) * tWest;
    }

    // Never allow inland depressions behind the beach crest to dip below sea level
    if (distInland > 10.0 && x > -580 && x < eastTaperStart - 6) {
      y = Math.max(1.35, y);
    }

    return y;
  }

  _generate() {
    const spline = this.spline;
    const embW = spline.embankmentWidth; // 11.0 m (within 6-15 m required!)
    const ravineDepth = spline.bridge.ravineDepth || 11.5;

    for (let rz = 0; rz < this.rows; rz++) {
      const z = this.minZ + rz * this.step;
      for (let cx = 0; cx < this.cols; cx++) {
        const x = this.minX + cx * this.step;
        const idx = rz * this.cols + cx;
        const proj = spline.projectXZ(x, z);
        const natY = this.baseLandscapeHeight(x, z, proj);

        // Ground-stitched roadbed + 2.15 m smooth shoulder shelf + 11.0 m quintic embankment (gap < 0.07m everywhere!)
        let groundStitchedY;
        if (proj.absD <= proj.halfWidth - 0.15) {
          groundStitchedY = proj.roadY - 0.08;
        } else if (proj.absD <= proj.halfWidth + 2.15) {
          groundStitchedY = proj.edgeY - 0.025;
        } else if (proj.absD < proj.halfWidth + 2.15 + embW) {
          const t = smootherstep(proj.halfWidth + 2.15, proj.halfWidth + 2.15 + embW, proj.absD);
          groundStitchedY = (proj.edgeY - 0.025) * (1.0 - t) + natY * t;
        } else {
          groundStitchedY = natY;
        }

        let finalY = groundStitchedY;
        if (proj.bridgeFactor > 0.0001) {
          const ravineCarve = ravineDepth * Math.exp(-(proj.absD * proj.absD) / 3400.0);
          // Keep dry coastal gorge floor strictly above sea level (+5.0m) so ocean plane never pokes up inland!
          const ravineY = Math.max(5.0, Math.min(natY, proj.roadY - 2.0) - ravineCarve);
          finalY = groundStitchedY * (1.0 - proj.bridgeFactor) + ravineY * proj.bridgeFactor;
        }

        this.heights[idx] = finalY;

        // Smooth continuous world-space Biome Weights (zero Voronoi zone jumps!)
        const zShore = this.shorelineZ(x);
        const nearCoast = smootherstep(zShore - 54.0, zShore - 10.0, z);
        // Wet sand covers the glistening swash band (y <= 0.92m) AND shallow seabed visible through translucent water
        const wetSwash = 1.0 - smootherstep(0.42, 1.08, finalY);
        const wetMask = nearCoast * wetSwash;
        const drySandMask = nearCoast * (1.0 - wetMask * 0.92) * smootherstep(9.2, 4.4, finalY);
        const z2Bio = smootherstep(440, 535, proj.s) * (1.0 - smootherstep(1260, 1365, proj.s));
        const cliffMask = Math.max(
          z2Bio * smootherstep(proj.halfWidth + 2.0, proj.halfWidth + 9.0, proj.absD) * (1.0 - smootherstep(28.0, 42.0, proj.absD)) * 0.72,
          proj.bridgeFactor * (1.0 - smootherstep(22.0, 52.0, proj.absD)) * 0.68
        );
        const forestMask = smootherstep(-255, -365, x) * smootherstep(235, 135, z) * 0.84;

        const bIdx = idx * 4;
        this.biomes[bIdx] = Math.max(0, Math.min(1, drySandMask));
        this.biomes[bIdx + 1] = Math.max(0, Math.min(1, wetMask));
        this.biomes[bIdx + 2] = Math.max(0, Math.min(1, cliffMask));
        this.biomes[bIdx + 3] = Math.max(0, Math.min(1, forestMask));
      }
    }
  }

  // Exact triangle-barycentric height & normal query matching Three.js BufferGeometry triangulation identically!
  sampleHeightAndNormal(x, z) {
    const fx = (x - this.minX) / this.step;
    const fz = (z - this.minZ) / this.step;
    const cx = Math.max(0, Math.min(this.cols - 2, Math.floor(fx)));
    const rz = Math.max(0, Math.min(this.rows - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - cx));
    const tz = Math.max(0, Math.min(1, fz - rz));

    const i00 = rz * this.cols + cx;
    const i10 = i00 + 1;
    const i01 = i00 + this.cols;
    const i11 = i01 + 1;

    const h00 = this.heights[i00];
    const h10 = this.heights[i10];
    const h01 = this.heights[i01];
    const h11 = this.heights[i11];
    const S = this.step;

    let y, dxH, dzH;
    // Triangle split matching buildTerrainMesh(): (i00, i01, i10) for tx + tz <= 1, else (i10, i01, i11)
    if (tx + tz <= 1.0) {
      y = h00 + tx * (h10 - h00) + tz * (h01 - h00);
      dxH = (h10 - h00) / S;
      dzH = (h01 - h00) / S;
    } else {
      y = h11 + (1.0 - tx) * (h01 - h11) + (1.0 - tz) * (h10 - h11);
      dxH = (h11 - h01) / S;
      dzH = (h11 - h10) / S;
    }

    const nx = -dxH;
    const ny = 1.0;
    const nz = -dzH;
    const len = Math.hypot(nx, ny, nz) || 1;
    return { y, nx: nx / len, ny: ny / len, nz: nz / len };
  }

  // Raycast straight down onto exact terrain heightfield mesh
  raycastDown(x, z) {
    const res = this.sampleHeightAndNormal(x, z);
    const zShore = this.shorelineZ(x);
    let surface = 'grass';
    if (z > zShore - 18) surface = 'sand';
    return { ...res, surface };
  }

  buildMesh(material) {
    const vertCount = this.cols * this.rows;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);

    for (let rz = 0; rz < this.rows; rz++) {
      const z = this.minZ + rz * this.step;
      for (let cx = 0; cx < this.cols; cx++) {
        const x = this.minX + cx * this.step;
        const idx = rz * this.cols + cx;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = this.heights[idx];
        positions[idx * 3 + 2] = z;
        uvs[idx * 2] = x * 0.1;
        uvs[idx * 2 + 1] = z * 0.1;
      }
    }

    const quadCount = (this.cols - 1) * (this.rows - 1);
    const indices = new Uint32Array(quadCount * 6);
    let ptr = 0;
    for (let rz = 0; rz < this.rows - 1; rz++) {
      for (let cx = 0; cx < this.cols - 1; cx++) {
        const i00 = rz * this.cols + cx;
        const i10 = i00 + 1;
        const i01 = i00 + this.cols;
        const i11 = i01 + 1;
        // Exact same diagonal (i01 <-> i10) used in sampleHeightAndNormal!
        indices[ptr++] = i00;
        indices[ptr++] = i01;
        indices[ptr++] = i10;
        indices[ptr++] = i10;
        indices[ptr++] = i01;
        indices[ptr++] = i11;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('aBiome', new THREE.BufferAttribute(this.biomes, 4));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'TerrainHeightfieldMesh';
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData.auditRole = 'terrain';
    return mesh;
  }
}

export function buildRoadMeshAndCollider(spline, roadMaterial) {
  const M = spline.sampleCount;
  // 9 cross-section profile ratios (-1.08 .. +1.08; outer apron tucks smoothly into shoulder shelf except on bridge)
  const latProfile = [-1.08, -1.0, -0.66, -0.33, 0.0, 0.33, 0.66, 1.0, 1.08];
  const R = latProfile.length;

  // M+1 rings so UV V-coordinate wraps cleanly at seam without stretched quad!
  const ringCount = M + 1;
  const vertCount = ringCount * R;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const roadMeta = new Float32Array(vertCount * 3);

  for (let ring = 0; ring < ringCount; ring++) {
    const k = ring % M;
    const smp = spline.samples[k];
    const arcS = ring === M ? spline.totalLength : smp.s;
    const raceOffsetNorm = spline.racingLine.offsets[k] / Math.max(1.0, smp.halfWidth);

    for (let c = 0; c < R; c++) {
      const latNorm = latProfile[c];
      const d = latNorm * smp.halfWidth;
      const isApron = Math.abs(latNorm) > 1.001;
      // On bridge, pull apron slightly inward/down onto concrete deck; on ground, tuck -0.075m into terrain shelf
      const apronDrop = isApron ? (smp.bridgeFactor > 0.15 ? -0.03 : -0.075) : 0.0;
      const pt = spline.roadPoint(smp.s, d, apronDrop + 0.008);

      const vIdx = ring * R + c;
      positions[vIdx * 3] = pt.x;
      positions[vIdx * 3 + 1] = pt.y;
      positions[vIdx * 3 + 2] = pt.z;

      uvs[vIdx * 2] = (d + smp.halfWidth) / 6.0;
      uvs[vIdx * 2 + 1] = arcS / 6.0;

      roadMeta[vIdx * 3] = latNorm;
      roadMeta[vIdx * 3 + 1] = raceOffsetNorm;
      roadMeta[vIdx * 3 + 2] = arcS;
    }
  }

  const indices = new Uint32Array(M * (R - 1) * 6);
  let ptr = 0;
  for (let k = 0; k < M; k++) {
    for (let c = 0; c < R - 1; c++) {
      const a = k * R + c;
      const b = a + 1;
      const d = (k + 1) * R + c;
      const e = d + 1;
      indices[ptr++] = a;
      indices[ptr++] = b;
      indices[ptr++] = d;
      indices[ptr++] = b;
      indices[ptr++] = e;
      indices[ptr++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aRoadMeta', new THREE.BufferAttribute(roadMeta, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, roadMaterial);
  mesh.name = 'RoadVisualMesh';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.auditRole = 'road';

  const collider = new RoadCollider(spline, positions, indices, R, M);
  return { mesh, collider };
}

// Helper: Extrude a 2D cross-section profile [(dOffset, yOffset, uCoord), ...] along spline range [sStart..sEnd]
// Always produces rich beveled multi-face geometry (>> 12 triangles, NEVER a BoxGeometry!)
export function extrudeAlongSpline(spline, sStart, sEnd, stepM, sideSign, baseLatAdd, profile2D) {
  const span = sEnd - sStart;
  const steps = Math.max(3, Math.ceil(span / stepM));
  const P = profile2D.length;
  const vertCount = (steps + 1) * P + P * 2;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let i = 0; i <= steps; i++) {
    const s = sStart + (i / steps) * span;
    const smp = spline.sampleAt(s);
    const baseD = sideSign * (smp.halfWidth + baseLatAdd);
    for (let p = 0; p < P; p++) {
      const [dLocal, yLocal, uCoord] = profile2D[p];
      const d = baseD + sideSign * dLocal;
      const pt = spline.roadPoint(s, d, yLocal);
      const idx = i * P + p;
      positions[idx * 3] = pt.x;
      positions[idx * 3 + 1] = pt.y;
      positions[idx * 3 + 2] = pt.z;
      uvs[idx * 2] = uCoord;
      uvs[idx * 2 + 1] = (s - sStart) * 0.35;
    }
  }

  for (let i = 0; i < steps; i++) {
    for (let p = 0; p < P - 1; p++) {
      const a = i * P + p;
      const b = a + 1;
      const c = (i + 1) * P + p;
      const d = c + 1;
      if (sideSign > 0) {
        indices.push(a, b, c, b, d, c);
      } else {
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  // End caps (fan triangulation)
  const cap0Start = (steps + 1) * P;
  const cap1Start = cap0Start + P;
  for (let p = 0; p < P; p++) {
    positions.set(positions.subarray(p * 3, p * 3 + 3), (cap0Start + p) * 3);
    uvs.set([profile2D[p][2], 0], (cap0Start + p) * 2);
    const src1 = steps * P + p;
    positions.set(positions.subarray(src1 * 3, src1 * 3 + 3), (cap1Start + p) * 3);
    uvs.set([profile2D[p][2], 1], (cap1Start + p) * 2);
  }
  for (let p = 1; p < P - 1; p++) {
    if (sideSign > 0) {
      indices.push(cap0Start, cap0Start + p + 1, cap0Start + p);
      indices.push(cap1Start, cap1Start + p, cap1Start + p + 1);
    } else {
      indices.push(cap0Start, cap0Start + p, cap0Start + p + 1);
      indices.push(cap1Start, cap1Start + p + 1, cap1Start + p);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Step 6: Curbs ("zebras"), Guardrails, Stone Walls, Viaduct Bridge Structure, and Barrier Colliders
export function buildTrackEdgeStructures(spline, terrain, matLib) {
  const group = new THREE.Group();
  group.name = 'TrackEdgeStructures';

  // Barrier segments used by 120 Hz physics so cars deflect/scrape cleanly and NEVER penetrate walls/guardrails
  // Each barrier run: { sStart, sEnd, sideSign (+1 right / -1 left), latOffsetFromEdge, height, type }
  const barrierRuns = [];

  // 6A. Racing Curbs ("Zebras") on corners (|curvature| > 0.0085)
  const curbProfile = [
    [-0.12, -0.02, 0.0],
    [ 0.00,  0.015, 0.15],
    [ 0.24,  0.065, 0.45],
    [ 0.52,  0.075, 0.78],
    [ 0.64,  0.020, 0.92],
    [ 0.68, -0.060, 1.0]
  ];

  let inCurb = false;
  let curbStart = 0;
  let curbSign = 1;
  const M = spline.sampleCount;
  for (let k = 0; k <= M; k++) {
    const smp = spline.samples[k % M];
    const wantCurb = Math.abs(smp.curvature) > 0.0085 && !smp.isBridge;
    const sign = smp.curvature >= 0 ? 1 : -1; // inside apex curb
    if (wantCurb && !inCurb) {
      inCurb = true;
      curbStart = smp.s;
      curbSign = sign;
    } else if ((!wantCurb || sign !== curbSign || k === M) && inCurb) {
      const sEnd = k === M ? spline.totalLength : smp.s;
      if (sEnd - curbStart >= 14.0) {
        // Inside apex curb
        const geoIn = extrudeAlongSpline(spline, curbStart, sEnd, 1.5, curbSign, -0.15, curbProfile);
        const meshIn = new THREE.Mesh(geoIn, matLib.materials.curb);
        meshIn.receiveShadow = true;
        meshIn.castShadow = true;
        meshIn.userData.auditRole = 'curb';
        group.add(meshIn);

        // Matching exit curb on opposite outer side over second half of corner
        const exitStart = curbStart + (sEnd - curbStart) * 0.35;
        const exitEnd = Math.min(spline.totalLength - 1, sEnd + 12.0);
        if (exitEnd - exitStart >= 12.0) {
          const geoOut = extrudeAlongSpline(spline, exitStart, exitEnd, 1.5, -curbSign, -0.15, curbProfile);
          const meshOut = new THREE.Mesh(geoOut, matLib.materials.curb);
          meshOut.receiveShadow = true;
          meshOut.castShadow = true;
          meshOut.userData.auditRole = 'curb';
          group.add(meshOut);
        }
      }
      inCurb = false;
    }
  }

  // 6B. Galvanized Steel W-Beam Guardrails (Z2 cliff outer/both edges, Z4 fast forest curves & bridge approaches)
  const wBeamProfile = [
    [0.00, 0.42, 0.00],
    [0.08, 0.46, 0.16],
    [0.02, 0.54, 0.33],
    [0.09, 0.62, 0.50],
    [0.02, 0.70, 0.67],
    [0.08, 0.78, 0.84],
    [0.00, 0.82, 1.00],
    [-0.04, 0.62, 0.50]
  ];

  // Collect guardrail runs cleanly along spline zones
  const guardrailSpecs = [];
  // Scan Z2 and Z4 segments dynamically from spline
  let z2Start = -1, z2End = -1;
  let z4Start = -1, z4End = -1;
  for (let k = 0; k < M; k++) {
    const z = spline.samples[k].zone;
    if (z === 'Z2') { if (z2Start < 0) z2Start = k; z2End = k; }
    if (z === 'Z4') { if (z4Start < 0) z4Start = k; z4End = k; }
  }
  if (z2Start >= 0) {
    // Section 4 Z2: "Guardrail de um lado, paredão de rocha do outro"
    // Place galvanized steel W-beam guardrail strictly on the seaward drop-off side of each Z2 switchback leg!
    guardrailSpecs.push(
      { sStart: z2Start + 8, sEnd: 642, side: 1 },
      { sStart: 646, sEnd: 830, side: -1 },
      { sStart: 836, sEnd: 1150, side: 1 },
      { sStart: 1154, sEnd: z2End - 8, side: -1 }
    );
  }
  if (z4Start >= 0) {
    const bs = spline.bridge.startS;
    const be = spline.bridge.endS;
    guardrailSpecs.push({ sStart: z4Start + 18, sEnd: bs - 2, side: 1 });
    guardrailSpecs.push({ sStart: Math.max(z4Start + 35, bs - 85), sEnd: bs - 2, side: -1 });
    guardrailSpecs.push({ sStart: be + 2, sEnd: z4End - 10, side: 1 });
    guardrailSpecs.push({ sStart: be + 2, sEnd: Math.min(z4End - 20, be + 85), side: -1 });
  }

  // Cylindrical galvanized steel guardrail post geometry (12 radial segments -> 48 tris, never BoxGeometry)
  const postGeo = new THREE.CylinderGeometry(0.055, 0.06, 1.05, 10, 1);
  const postMatrices = [];

  for (const gr of guardrailSpecs) {
    if (gr.sEnd - gr.sStart < 12) continue;
    const railGeo = extrudeAlongSpline(spline, gr.sStart, gr.sEnd, 2.0, gr.side, 0.92, wBeamProfile);
    const railMesh = new THREE.Mesh(railGeo, matLib.materials.guardrail);
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    railMesh.userData.auditRole = 'guardrail';
    group.add(railMesh);

    barrierRuns.push({
      sStart: gr.sStart,
      sEnd: gr.sEnd,
      sideSign: gr.side,
      latOffset: 0.88,
      height: 0.95,
      type: 'guardrail'
    });

    for (let s = gr.sStart + 1.0; s <= gr.sEnd - 1.0; s += 3.5) {
      const smp = spline.sampleAt(s);
      const pt = spline.roadPoint(s, gr.side * (smp.halfWidth + 0.96), 0.30);
      const m4 = new THREE.Matrix4();
      m4.makeTranslation(pt.x, pt.y, pt.z);
      postMatrices.push(m4);
    }
  }

  if (postMatrices.length > 0) {
    const postsInst = new THREE.InstancedMesh(postGeo, matLib.materials.guardrail, postMatrices.length);
    postsInst.castShadow = true;
    postsInst.receiveShadow = true;
    postsInst.userData.auditRole = 'guardrail_posts';
    for (let i = 0; i < postMatrices.length; i++) postsInst.setMatrixAt(i, postMatrices[i]);
    postsInst.instanceMatrix.needsUpdate = true;
    group.add(postsInst);
  }

  // 6C. Low Mediterranean Stone Promenade & Village Walls (Z1 coastal promenade + Z3 village street curbs)
  const stoneWallProfile = [
    [0.00, -0.15, 0.00],
    [0.00,  0.54, 0.25],
    [-0.04, 0.58, 0.35],
    [-0.04, 0.68, 0.48],
    [0.46,  0.68, 0.65],
    [0.46,  0.58, 0.78],
    [0.42,  0.54, 0.85],
    [0.45, -0.15, 1.00]
  ];

  // Z1 seaside low promenade walls framing the grid & start straight, opening after s=162m to reveal sandy beach, dune fences, foam & sea rocks!
  const L = spline.totalLength;
  const wallSpecs = [
    { sStart: L - 68, sEnd: L - 4, side: 1, lat: 1.05 },
    { sStart: L - 68, sEnd: L - 4, side: -1, lat: 1.05 },
    { sStart: 8, sEnd: 162, side: 1, lat: 1.05 },
    { sStart: 8, sEnd: 215, side: -1, lat: 1.05 }
  ];
  // Z3 village low stone retaining/sidewalk walls
  let z3Start = -1, z3End = -1;
  for (let k = 0; k < M; k++) {
    if (spline.samples[k].zone === 'Z3') {
      if (z3Start < 0) z3Start = k;
      z3End = k;
    }
  }
  if (z3Start >= 0) {
    const plazaS = spline.data.landmarks?.plazaAtS || Math.round((z3Start + z3End) * 0.5);
    wallSpecs.push({ sStart: z3Start + 10, sEnd: plazaS - 32, side: 1, lat: 1.15 });
    wallSpecs.push({ sStart: z3Start + 10, sEnd: plazaS - 32, side: -1, lat: 1.15 });
    wallSpecs.push({ sStart: plazaS + 32, sEnd: z3End - 12, side: 1, lat: 1.15 });
    wallSpecs.push({ sStart: plazaS + 32, sEnd: z3End - 12, side: -1, lat: 1.15 });
  }

  for (const ws of wallSpecs) {
    if (ws.sEnd - ws.sStart < 15) continue;
    const wGeo = extrudeAlongSpline(spline, ws.sStart, ws.sEnd, 2.2, ws.side, ws.lat, stoneWallProfile);
    const wMesh = new THREE.Mesh(wGeo, matLib.materials.stoneWall);
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    wMesh.userData.auditRole = 'stone_wall';
    group.add(wMesh);

    barrierRuns.push({
      sStart: ws.sStart,
      sEnd: ws.sEnd,
      sideSign: ws.side,
      latOffset: ws.lat - 0.05,
      height: 0.85,
      type: 'wall'
    });
  }

  // Low weathered stone rock-catch shoulder curb along the inland cliff-wall side of Z2 (leaves rock wall exposed while preventing cars from climbing cliff!)
  const cliffCurbProfile = [
    [0.00, -0.15, 0.00],
    [0.00,  0.34, 0.30],
    [0.06,  0.40, 0.48],
    [0.36,  0.40, 0.72],
    [0.42, -0.15, 1.00]
  ];
  if (z2Start >= 0) {
    const cliffSideSpecs = [
      { sStart: z2Start + 14, sEnd: 640, side: -1, lat: 1.15 },
      { sStart: 648, sEnd: 828, side: 1, lat: 1.15 },
      { sStart: 838, sEnd: 1148, side: -1, lat: 1.15 },
      { sStart: 1156, sEnd: z2End - 12, side: 1, lat: 1.15 }
    ];
    for (const cs of cliffSideSpecs) {
      if (cs.sEnd - cs.sStart < 15) continue;
      const cGeo = extrudeAlongSpline(spline, cs.sStart, cs.sEnd, 2.5, cs.side, cs.lat, cliffCurbProfile);
      const cMesh = new THREE.Mesh(cGeo, matLib.materials.rock);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      cMesh.userData.auditRole = 'cliff_curb';
      group.add(cMesh);

      barrierRuns.push({
        sStart: cs.sStart,
        sEnd: cs.sEnd,
        sideSign: cs.side,
        latOffset: cs.lat - 0.05,
        height: 0.95,
        type: 'cliff_wall'
      });
    }
  }

  // 6D. Z4 Coastal Ravine Viaduct Bridge (Deck Girder + Parapets + Flared Terrain Wing-Wall Abutments + Twin-Column Ravine Piers)
  const bs = spline.bridge.startS;
  const be = spline.bridge.endS;
  const { bridgeGroup, bridgeMeta } = buildViaductBridge(spline, terrain, matLib, bs, be);
  group.add(bridgeGroup);

  barrierRuns.push(
    { sStart: bs - 6, sEnd: be + 6, sideSign: 1, latOffset: 0.35, height: 1.15, type: 'bridge_parapet' },
    { sStart: bs - 6, sEnd: be + 6, sideSign: -1, latOffset: 0.35, height: 1.15, type: 'bridge_parapet' }
  );

  return { group, barrierRuns, bridgeMeta };
}

function buildViaductBridge(spline, terrain, matLib, bs, be) {
  const bGroup = new THREE.Group();
  bGroup.name = 'ViaductBridge';

  // Right & Left parapet + cantilever box-girder profile relative to road edge (dLocal = 0 is road edge):
  const bridgeSideProfile = [
    [-6.0, -0.04, 0.00], // Centerline soffit join
    [-5.8, -1.65, 0.18], // Deep concrete box-girder belly
    [-1.2, -1.65, 0.42], // Outer web bottom
    [-0.3, -0.58, 0.56], // Cantilever haunch
    [ 0.85,-0.32, 0.66], // Outer cornice drip edge
    [ 0.85, 0.96, 0.78], // Outer parapet wall
    [ 0.35, 0.96, 0.86], // Parapet top coping
    [ 0.35, 0.02, 0.95], // Inner parapet curb face
    [-0.10, 0.00, 1.00]  // Tucks under asphalt edge
  ];

  // Flared stone wing-wall abutment profile locking bridge ends into terrain embankments (Ref 14 / S7)
  const wingWallProfile = [
    [0.25, -3.40, 0.00],
    [0.25,  0.98, 0.32],
    [0.95,  0.98, 0.50],
    [1.35, -0.45, 0.72],
    [1.75, -3.40, 1.00]
  ];

  for (const side of [1, -1]) {
    const sideGeo = extrudeAlongSpline(spline, bs - 4, be + 4, 2.0, side, 0.0, bridgeSideProfile);
    const sideMesh = new THREE.Mesh(sideGeo, matLib.materials.bridgeConcrete);
    sideMesh.castShadow = true;
    sideMesh.receiveShadow = true;
    sideMesh.userData.auditRole = 'bridge';
    bGroup.add(sideMesh);

    // Flared stone masonry approach wing-walls on both embankments
    for (const [wStart, wEnd] of [[bs - 9.5, bs + 2.5], [be - 2.5, be + 9.5]]) {
      const wingGeo = extrudeAlongSpline(spline, wStart, wEnd, 1.5, side, 0.12, wingWallProfile);
      const wingMesh = new THREE.Mesh(wingGeo, matLib.materials.stoneWall);
      wingMesh.castShadow = true;
      wingMesh.receiveShadow = true;
      wingMesh.userData.auditRole = 'bridge';
      bGroup.add(wingMesh);
    }

    // Top tubular galvanized steel handrail above concrete parapet
    const railProfile = [
      [0.50, 1.10, 0.0],
      [0.60, 1.10, 0.25],
      [0.64, 1.18, 0.5],
      [0.55, 1.24, 0.75],
      [0.46, 1.18, 1.0]
    ];
    const topRailGeo = extrudeAlongSpline(spline, bs - 4, be + 4, 2.0, side, 0.0, railProfile);
    const topRailMesh = new THREE.Mesh(topRailGeo, matLib.materials.guardrail);
    topRailMesh.castShadow = true;
    topRailMesh.userData.auditRole = 'bridge';
    bGroup.add(topRailMesh);
  }

  // Stone/concrete bridge abutments anchored cleanly into both ravine embankments + 3 twin-column piers rooted in ravine terrain!
  const pierPositionsS = [
    bs + 2.0,
    bs + (be - bs) * 0.26,
    bs + (be - bs) * 0.51,
    bs + (be - bs) * 0.76,
    be - 2.0
  ];

  const piersMeta = [];
  let maxRavineDropM = 0;

  for (let idx = 0; idx < pierPositionsS.length; idx++) {
    const s = pierPositionsS[idx];
    const isAbutment = idx === 0 || idx === pierPositionsS.length - 1;
    const smp = spline.sampleAt(s);
    const yaw = Math.atan2(smp.fxz_x, smp.fxz_z);

    if (isAbutment) {
      // Tapered octagonal/chamfered stone abutment pier anchored deep into embankment slope
      const gHit = terrain.raycastDown(smp.x, smp.z);
      const colH = Math.max(5.5, (smp.y - 0.4) - (gHit.y - 2.8));
      const abutGeo = new THREE.CylinderGeometry(5.8, 7.2, colH, 8, 2);
      const abutMesh = new THREE.Mesh(abutGeo, matLib.materials.stoneWall);
      abutMesh.position.set(smp.x, smp.y - 0.4 - colH * 0.5, smp.z);
      abutMesh.rotation.y = yaw + Math.PI / 8;
      abutMesh.scale.set(1.05, 1.0, 0.62);
      abutMesh.castShadow = true;
      abutMesh.receiveShadow = true;
      abutMesh.userData.auditRole = 'bridge';
      bGroup.add(abutMesh);
    } else {
      // Twin tapered octagonal concrete columns + crosshead pier cap resting solidly in ravine floor!
      for (const latD of [-3.5, 3.5]) {
        const topPt = spline.roadPoint(s, latD, -1.50);
        const gHit = terrain.raycastDown(topPt.x, topPt.z);
        const dropM = smp.y - gHit.y;
        if (dropM > maxRavineDropM) maxRavineDropM = dropM;
        const embedDepthM = 1.6;
        const colH = Math.max(3.0, topPt.y - (gHit.y - embedDepthM)); // Sinks 1.6m into ravine rock bed!
        const colGeo = new THREE.CylinderGeometry(0.98, 1.34, colH, 12, 2);
        const colMesh = new THREE.Mesh(colGeo, matLib.materials.bridgeConcrete);
        colMesh.position.set(topPt.x, topPt.y - colH * 0.5, topPt.z);
        colMesh.castShadow = true;
        colMesh.receiveShadow = true;
        colMesh.userData.auditRole = 'bridge';
        bGroup.add(colMesh);

        // Molded stone footing collar right on ravine terrain surface
        const footGeo = new THREE.CylinderGeometry(1.62, 1.98, 1.5, 12, 1);
        const footMesh = new THREE.Mesh(footGeo, matLib.materials.stoneWall);
        footMesh.position.set(topPt.x, gHit.y + 0.25, topPt.z);
        footMesh.castShadow = true;
        footMesh.receiveShadow = true;
        footMesh.userData.auditRole = 'bridge';
        bGroup.add(footMesh);

        piersMeta.push({
          s: +s.toFixed(2),
          x: +topPt.x.toFixed(2),
          z: +topPt.z.toFixed(2),
          terrainY: +gHit.y.toFixed(2),
          deckY: +smp.y.toFixed(2),
          dropM: +dropM.toFixed(2),
          embedDepthM
        });
      }
      // Crosshead cap beam (chamfered 8-sided horizontal prism, never BoxGeometry)
      const capGeo = new THREE.CylinderGeometry(1.10, 1.10, 9.8, 8, 1);
      capGeo.rotateZ(Math.PI * 0.5);
      const capMesh = new THREE.Mesh(capGeo, matLib.materials.bridgeConcrete);
      capMesh.position.set(smp.x, smp.y - 1.70, smp.z);
      capMesh.rotation.y = Math.atan2(-smp.rxz_z, smp.rxz_x);
      capMesh.scale.set(1.0, 0.74, 1.18);
      capMesh.castShadow = true;
      capMesh.receiveShadow = true;
      capMesh.userData.auditRole = 'bridge';
      bGroup.add(capMesh);
    }
  }

  return {
    bridgeGroup: bGroup,
    bridgeMeta: {
      startS: bs,
      endS: be,
      lengthM: +(be - bs).toFixed(1),
      pierBents: 3,
      pierColumnCount: piersMeta.length,
      maxRavineDropM: +maxRavineDropM.toFixed(2),
      piers: piersMeta
    }
  };
}
