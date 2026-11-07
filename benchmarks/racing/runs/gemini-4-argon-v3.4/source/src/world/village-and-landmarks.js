import * as THREE from 'three';
import { mergeGeometriesSimple, mulberry32 } from './props-and-flora.js';

// 2D SAT OBB overlap check (identical convention to validateWorld.js, with optional clearance margin)
function obbOverlapWithMargin(a, b, margin = 0.75) {
  const axes = [
    [Math.cos(a.yaw), Math.sin(a.yaw)],
    [-Math.sin(a.yaw), Math.cos(a.yaw)],
    [Math.cos(b.yaw), Math.sin(b.yaw)],
    [-Math.sin(b.yaw), Math.cos(b.yaw)]
  ];
  const cornersOf = (box, m) => {
    const c = Math.cos(box.yaw);
    const s = Math.sin(box.yaw);
    const hw = box.halfW + m;
    const hd = box.halfD + m;
    return [
      [box.x + c * hw - s * hd, box.z + s * hw + c * hd],
      [box.x - c * hw - s * hd, box.z - s * hw + c * hd],
      [box.x - c * hw + s * hd, box.z - s * hw - c * hd],
      [box.x + c * hw + s * hd, box.z + s * hw - c * hd]
    ];
  };
  const ca = cornersOf(a, margin);
  const cb = cornersOf(b, 0);

  for (const [ax, az] of axes) {
    let minA = Infinity, maxA = -Infinity;
    let minB = Infinity, maxB = -Infinity;
    for (const [px, pz] of ca) {
      const p = px * ax + pz * az;
      if (p < minA) minA = p;
      if (p > maxA) maxA = p;
    }
    for (const [px, pz] of cb) {
      const p = px * ax + pz * az;
      if (p < minB) minB = p;
      if (p > maxB) maxB = p;
    }
    if (maxA <= minB || maxB <= minA) return false;
  }
  return true;
}

// ============================================================================
// Non-Box Architectural Primitive Builders (every piece >= 36..160 tris, clean UVs)
// ============================================================================

// 8-sided chamfered architectural masonry block (36 tris, NEVER BoxGeometry!)
function buildChamferedMasonryBlock(w, h, d, cx, y0, cz, bevel = 0.04, uvScale = 0.32, uvRect = null) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const b = Math.min(bevel, hw * 0.35, hd * 0.35);

  // Counter-clockwise 8-point octagonal ring in XZ so outward wall normals point strictly outward!
  const ring = [
    [-hw + b,  hd],
    [ hw - b,  hd],
    [ hw,      hd - b],
    [ hw,     -hd + b],
    [ hw - b, -hd],
    [-hw + b, -hd],
    [-hw,     -hd + b],
    [-hw,      hd - b]
  ];

  // Perimeter cumulative arc-length for seamless wrap-around masonry UVs
  const perim = [0];
  for (let i = 0; i < 8; i++) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % 8];
    perim.push(perim[i] + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
  }

  const mapU = (uRaw) => uvRect ? (uvRect.u0 + Math.max(0, Math.min(1, uRaw)) * (uvRect.u1 - uvRect.u0)) : uRaw;
  const mapV = (vRaw) => uvRect ? (uvRect.v0 + Math.max(0, Math.min(1, vRaw)) * (uvRect.v1 - uvRect.v0)) : vRaw;

  const positions = [];
  const uvs = [];
  const indices = [];

  // 8 vertical/chamfered side faces (each quad = 4 dedicated verts for crisp architectural creases)
  for (let i = 0; i < 8; i++) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % 8];
    const base = positions.length / 3;
    const u0 = uvRect ? 0 : perim[i] * uvScale;
    const u1 = uvRect ? 1 : perim[i + 1] * uvScale;
    const v0 = uvRect ? 0 : y0 * uvScale;
    const v1 = uvRect ? 1 : (y0 + h) * uvScale;

    positions.push(
      cx + p0[0], y0,     cz + p0[1],
      cx + p1[0], y0,     cz + p1[1],
      cx + p1[0], y0 + h, cz + p1[1],
      cx + p0[0], y0 + h, cz + p0[1]
    );
    uvs.push(
      mapU(u0), mapV(v0),
      mapU(u1), mapV(v0),
      mapU(u1), mapV(v1),
      mapU(u0), mapV(v1)
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Top & bottom octagonal caps
  for (const [isTop, yCap] of [[true, y0 + h], [false, y0]]) {
    const centerIdx = positions.length / 3;
    positions.push(cx, yCap, cz);
    uvs.push(mapU(0.5), mapV(0.5));
    for (let i = 0; i < 8; i++) {
      positions.push(cx + ring[i][0], yCap, cz + ring[i][1]);
      uvs.push(
        mapU(uvRect ? (ring[i][0] / Math.max(0.01, w) + 0.5) : ring[i][0] * uvScale),
        mapV(uvRect ? (ring[i][1] / Math.max(0.01, d) + 0.5) : ring[i][1] * uvScale)
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = centerIdx + 1 + i;
      const bIdx = centerIdx + 1 + ((i + 1) % 8);
      if (isTop) indices.push(centerIdx, a, bIdx);
      else indices.push(centerIdx, bIdx, a);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Pitched gable end-wall pedimentprism (ridge along X or Z) so walls meet roof underside with zero gap
function buildGablePedimentPrism(w, d, cx, yEave, cz, apexRise, ridgeAlongX = true, uvScale = 0.32) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const positions = [];
  const uvs = [];
  const indices = [];

  const pushTri = (a, b, c, uva, uvb, uvc) => {
    const base = positions.length / 3;
    positions.push(...a, ...b, ...c);
    uvs.push(...uva, ...uvb, ...uvc);
    indices.push(base, base + 1, base + 2);
  };
  const pushQuad = (a, b, c, dPt) => {
    const base = positions.length / 3;
    positions.push(...a, ...b, ...c, ...dPt);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  if (ridgeAlongX) {
    // Triangular pediments on Left (-X) and Right (+X) walls; ridge runs from (-hw, yEave+apexRise, 0) to (+hw, yEave+apexRise, 0)
    for (const sx of [-1, 1]) {
      const x = cx + sx * hw;
      const pFront = [x, yEave, cz + hd];
      const pBack = [x, yEave, cz - hd];
      const pTop = [x, yEave + apexRise, cz];
      if (sx > 0) {
        pushTri(pFront, pBack, pTop, [0, 0], [d * uvScale, 0], [hd * uvScale, apexRise * uvScale]);
      } else {
        pushTri(pBack, pFront, pTop, [0, 0], [d * uvScale, 0], [hd * uvScale, apexRise * uvScale]);
      }
    }
    // Sloped inner roof-bed faces closing the prism
    pushQuad(
      [cx - hw, yEave, cz + hd],
      [cx + hw, yEave, cz + hd],
      [cx + hw, yEave + apexRise, cz],
      [cx - hw, yEave + apexRise, cz]
    );
    pushQuad(
      [cx + hw, yEave, cz - hd],
      [cx - hw, yEave, cz - hd],
      [cx - hw, yEave + apexRise, cz],
      [cx + hw, yEave + apexRise, cz]
    );
  } else {
    // Triangular pediments on Front (+Z) and Back (-Z) walls; ridge runs along Z
    for (const sz of [-1, 1]) {
      const z = cz + sz * hd;
      const pL = [cx - hw, yEave, z];
      const pR = [cx + hw, yEave, z];
      const pTop = [cx, yEave + apexRise, z];
      if (sz > 0) {
        pushTri(pL, pR, pTop, [0, 0], [w * uvScale, 0], [hw * uvScale, apexRise * uvScale]);
      } else {
        pushTri(pR, pL, pTop, [0, 0], [w * uvScale, 0], [hw * uvScale, apexRise * uvScale]);
      }
    }
    pushQuad(
      [cx + hw, yEave, cz + hd],
      [cx + hw, yEave, cz - hd],
      [cx, yEave + apexRise, cz - hd],
      [cx, yEave + apexRise, cz + hd]
    );
    pushQuad(
      [cx - hw, yEave, cz - hd],
      [cx - hw, yEave, cz + hd],
      [cx, yEave + apexRise, cz + hd],
      [cx, yEave + apexRise, cz - hd]
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Overhanging pitched Mediterranean clay-tile roof with thickness, ridge cap ("cumeeira") & timber eave rafters
function buildPitchedClayRoof(w, d, cx, yEave, cz, apexRise, overhang = 0.48, ridgeAlongX = true) {
  const roofParts = [];
  const timberParts = [];
  const slabThick = 0.16;

  if (ridgeAlongX) {
    const spanX = w + overhang * 2.0;
    const halfSpanZ = d * 0.5 + overhang;
    const slopeLen = Math.hypot(halfSpanZ, apexRise);
    const slopeAng = Math.atan2(apexRise, halfSpanZ);
    const eaveDrop = overhang * (apexRise / Math.max(0.5, d * 0.5));

    for (const sz of [-1, 1]) {
      const slopeSlab = buildChamferedMasonryBlock(spanX, slabThick, slopeLen + 0.08, 0, 0, 0, 0.03, 0.42);
      slopeSlab.rotateX(sz * slopeAng);
      slopeSlab.translate(
        cx,
        yEave - eaveDrop + (apexRise + eaveDrop) * 0.5,
        cz + sz * (halfSpanZ * 0.5)
      );
      roofParts.push(slopeSlab);
    }

    // Half-round clay ridge tiles ("cumeeira")
    const ridgeCap = new THREE.CylinderGeometry(0.15, 0.16, spanX + 0.08, 10, 1);
    ridgeCap.rotateZ(Math.PI * 0.5);
    ridgeCap.translate(cx, yEave + apexRise + 0.12, cz);
    roofParts.push(ridgeCap);

    // Exposed wooden eave rafter tails beneath overhanging eaves
    const rafterCount = Math.max(5, Math.floor(spanX / 0.85));
    for (let i = 0; i <= rafterCount; i++) {
      const rx = cx - spanX * 0.46 + (i / rafterCount) * (spanX * 0.92);
      for (const sz of [-1, 1]) {
        const raf = new THREE.CylinderGeometry(0.038, 0.042, slopeLen * 0.96, 6, 1);
        raf.rotateX(Math.PI * 0.5 + sz * slopeAng);
        raf.translate(rx, yEave - eaveDrop + (apexRise + eaveDrop) * 0.48 - 0.09, cz + sz * (halfSpanZ * 0.5));
        timberParts.push(raf);
      }
    }
  } else {
    const spanZ = d + overhang * 2.0;
    const halfSpanX = w * 0.5 + overhang;
    const slopeLen = Math.hypot(halfSpanX, apexRise);
    const slopeAng = Math.atan2(apexRise, halfSpanX);
    const eaveDrop = overhang * (apexRise / Math.max(0.5, w * 0.5));

    for (const sx of [-1, 1]) {
      const slopeSlab = buildChamferedMasonryBlock(slopeLen + 0.08, slabThick, spanZ, 0, 0, 0, 0.03, 0.42);
      slopeSlab.rotateZ(-sx * slopeAng);
      slopeSlab.translate(
        cx + sx * (halfSpanX * 0.5),
        yEave - eaveDrop + (apexRise + eaveDrop) * 0.5,
        cz
      );
      roofParts.push(slopeSlab);
    }

    const ridgeCap = new THREE.CylinderGeometry(0.15, 0.16, spanZ + 0.08, 10, 1);
    ridgeCap.rotateX(Math.PI * 0.5);
    ridgeCap.translate(cx, yEave + apexRise + 0.12, cz);
    roofParts.push(ridgeCap);

    const rafterCount = Math.max(5, Math.floor(spanZ / 0.85));
    for (let i = 0; i <= rafterCount; i++) {
      const rz = cz - spanZ * 0.46 + (i / rafterCount) * (spanZ * 0.92);
      for (const sx of [-1, 1]) {
        const raf = new THREE.CylinderGeometry(0.038, 0.042, slopeLen * 0.96, 6, 1);
        raf.rotateZ(Math.PI * 0.5 - sx * slopeAng);
        raf.translate(cx + sx * (halfSpanX * 0.5), yEave - eaveDrop + (apexRise + eaveDrop) * 0.48 - 0.09, rz);
        timberParts.push(raf);
      }
    }
  }

  return { roofParts, timberParts };
}

// Recessed Framed & Shuttered Mediterranean Window + optional Terracotta Flower Box ("floreira")
function addFramedWindowAssembly(buckets, faceAxis, faceCoord, uPos, yBottom, winW = 1.08, winH = 1.46, {
  hasShutters = true,
  hasFlowerBox = false
} = {}) {
  // faceAxis: '+Z' (front), '-Z' (back), '+X' (right), '-X' (left)
  const groupRot =
    faceAxis === '+Z' ? 0 :
    faceAxis === '-Z' ? Math.PI :
    faceAxis === '+X' ? Math.PI * 0.5 : -Math.PI * 0.5;

  const orient = (geo) => {
    if (groupRot !== 0) geo.rotateY(groupRot);
    if (faceAxis === '+Z' || faceAxis === '-Z') {
      geo.translate(uPos, 0, faceCoord);
    } else {
      geo.translate(faceCoord, 0, uPos);
    }
    return geo;
  };

  // 1. Projecting stone/terracotta window surround frame (jambs + lintel + deep stone sill -> creates real 0.15m window recess!)
  const jambThick = 0.13;
  const frameDepth = 0.16;
  buckets.trim.push(
    orient(buildChamferedMasonryBlock(jambThick, winH + 0.12, frameDepth, -winW * 0.5 - jambThick * 0.4, yBottom, 0.05, 0.025)),
    orient(buildChamferedMasonryBlock(jambThick, winH + 0.12, frameDepth,  winW * 0.5 + jambThick * 0.4, yBottom, 0.05, 0.025)),
    orient(buildChamferedMasonryBlock(winW + jambThick * 2.2, 0.17, frameDepth + 0.04, 0, yBottom + winH + 0.02, 0.06, 0.03)),
    orient(buildChamferedMasonryBlock(winW + jambThick * 2.5, 0.12, frameDepth + 0.08, 0, yBottom - 0.10, 0.07, 0.03))
  );

  // 2. Recessed dark mullioned window pane sitting behind the outer frame
  buckets.window.push(
    orient(buildChamferedMasonryBlock(winW, winH, 0.05, 0, yBottom + 0.01, 0.015, 0.01, 1, { u0: 0, u1: 1, v0: 0, v1: 1 }))
  );

  // 3. Open louvered timber shutters flanking the window (angled slightly outward for 3D shadow relief)
  if (hasShutters) {
    const shW = winW * 0.47;
    for (const side of [-1, 1]) {
      const sh = buildChamferedMasonryBlock(shW, winH, 0.055, 0, yBottom + 0.01, 0, 0.015, 1, {
        u0: 0.02, u1: 0.48, v0: 0.02, v1: 0.98
      });
      sh.rotateY(side * -0.22);
      sh.translate(side * (winW * 0.5 + jambThick + shW * 0.46), 0, 0.09);
      buckets.timber.push(orient(sh));
    }
  }

  // 4. Optional terracotta flower box ("floreira") under sill
  if (hasFlowerBox) {
    buckets.trim.push(
      orient(buildChamferedMasonryBlock(winW + 0.16, 0.24, 0.26, 0, yBottom - 0.30, 0.15, 0.03))
    );
    // Lush little rounded shrub tuft inside flower box
    const bush = new THREE.IcosahedronGeometry(0.22, 2);
    bush.scale(winW * 1.9, 0.85, 0.85);
    bush.translate(0, yBottom - 0.04, 0.16);
    buckets.foliage.push(orient(bush));
  }
}

// Recessed 2.12m Street Entrance Door Assembly (Section 3.4: "Porta ~2,1 m")
function addStreetDoorAssembly(buckets, zFront, xPos, doorW = 1.12, doorH = 2.12) {
  // Stone threshold step + molded stone/terracotta door portal surround
  buckets.stone.push(
    buildChamferedMasonryBlock(doorW + 0.56, 0.45, 0.42, xPos, -0.32, zFront + 0.16, 0.04)
  );
  buckets.trim.push(
    buildChamferedMasonryBlock(0.16, doorH + 0.16, 0.20, xPos - doorW * 0.5 - 0.07, 0.06, zFront + 0.07, 0.03),
    buildChamferedMasonryBlock(0.16, doorH + 0.16, 0.20, xPos + doorW * 0.5 + 0.07, 0.06, zFront + 0.07, 0.03),
    buildChamferedMasonryBlock(doorW + 0.44, 0.24, 0.24, xPos, doorH + 0.08, zFront + 0.09, 0.03)
  );
  // Paneled timber door leaf inset inside stone surround (mapped to right half of archTimberAlbedo)
  buckets.timber.push(
    buildChamferedMasonryBlock(doorW, doorH, 0.07, xPos, 0.08, zFront + 0.01, 0.02, 1, {
      u0: 0.52, u1: 0.98, v0: 0.02, v1: 0.98
    })
  );
}

// Wrought-iron Mediterranean Balcony ("varanda")
function addWroughtIronBalcony(buckets, zFront, xPos, yFloor, balW = 2.6, balD = 0.92) {
  // Molded stone corbelled balcony slab
  buckets.stone.push(
    buildChamferedMasonryBlock(balW, 0.16, balD, xPos, yFloor - 0.14, zFront + balD * 0.5, 0.03)
  );
  for (const sx of [-1, 1]) {
    buckets.stone.push(
      buildChamferedMasonryBlock(0.18, 0.28, balD * 0.78, xPos + sx * (balW * 0.36), yFloor - 0.40, zFront + balD * 0.39, 0.03)
    );
  }
  // Wrought-iron handrail + vertical balusters
  const railH = 0.96;
  const topF = new THREE.CylinderGeometry(0.026, 0.026, balW, 8, 1);
  topF.rotateZ(Math.PI * 0.5);
  topF.translate(xPos, yFloor + railH, zFront + balD - 0.05);
  buckets.iron.push(topF);

  for (const sx of [-1, 1]) {
    const sideR = new THREE.CylinderGeometry(0.026, 0.026, balD, 8, 1);
    sideR.rotateX(Math.PI * 0.5);
    sideR.translate(xPos + sx * (balW * 0.5 - 0.05), yFloor + railH, zFront + balD * 0.5);
    buckets.iron.push(sideR);
  }

  const bars = Math.max(6, Math.floor(balW / 0.24));
  for (let i = 0; i <= bars; i++) {
    const bx = xPos - (balW * 0.5 - 0.06) + (i / bars) * (balW - 0.12);
    const post = new THREE.CylinderGeometry(0.016, 0.018, railH, 6, 1);
    post.translate(bx, yFloor + railH * 0.5, zFront + balD - 0.05);
    buckets.iron.push(post);
  }
}

// Striped Fabric Shopfront / Café Awning ("toldo")
function addStripedAwning(buckets, zFront, xPos, yMount, awnW = 3.4, projD = 1.25, dropH = 0.68) {
  const slopeLen = Math.hypot(projD, dropH);
  const slopeAng = Math.atan2(dropH, projD);
  const canopy = new THREE.PlaneGeometry(awnW, slopeLen, 8, 3);
  // Subtle natural fabric sag
  const pos = canopy.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const sag = -0.045 * Math.cos((py / (slopeLen * 0.5)) * Math.PI * 0.5);
    pos.setZ(i, sag);
  }
  canopy.rotateX(-Math.PI * 0.5 + slopeAng);
  canopy.translate(xPos, yMount - dropH * 0.5, zFront + projD * 0.5);
  canopy.computeVertexNormals();
  buckets.awning.push(canopy);

  // Scalloped front valence flap
  const valence = new THREE.PlaneGeometry(awnW, 0.22, 10, 1);
  valence.translate(xPos, yMount - dropH - 0.10, zFront + projD);
  buckets.awning.push(valence);

  // Wrought-iron support struts
  for (const sx of [-1, 1]) {
    const strutLen = Math.hypot(projD * 0.92, dropH * 0.85);
    const st = new THREE.CylinderGeometry(0.018, 0.018, strutLen, 6, 1);
    st.rotateX(Math.PI * 0.5 - Math.atan2(dropH * 0.85, projD * 0.92));
    st.translate(xPos + sx * (awnW * 0.45), yMount - dropH * 0.88, zFront + projD * 0.46);
    buckets.iron.push(st);
  }
}

// Masonry Chimney with Terracotta Flue Pots ("chaminé")
function addMasonryChimney(buckets, xPos, yBase, zPos, chH = 1.85) {
  buckets.wall.push(buildChamferedMasonryBlock(0.76, chH, 0.64, xPos, yBase, zPos, 0.04));
  buckets.trim.push(buildChamferedMasonryBlock(0.92, 0.14, 0.80, xPos, yBase + chH, zPos, 0.03));
  for (const ox of [-0.17, 0.17]) {
    const pot = new THREE.CylinderGeometry(0.09, 0.12, 0.34, 8, 1);
    pot.translate(xPos + ox, yBase + chH + 0.28, zPos);
    buckets.roof.push(pot);
  }
}

// ============================================================================
// 6 Distinct Multi-Story Mediterranean House Templates (Section 5.3: >= 5 variations)
// ============================================================================

const HOUSE_TEMPLATES = [
  {
    id: 'townhouse_2f',
    floors: 2,
    w: 7.4,
    d: 7.8,
    wallH: 6.25,
    apexRise: 1.55,
    ridgeAlongX: true,
    hasBalcony: true,
    hasAwning: false,
    hasFlowerBoxes: true,
    hasChimney: true
  },
  {
    id: 'villa_3f',
    floors: 3,
    w: 8.8,
    d: 8.2,
    wallH: 9.10,
    apexRise: 1.75,
    ridgeAlongX: true,
    hasBalcony: true,
    hasAwning: false,
    hasFlowerBoxes: true,
    hasChimney: true
  },
  {
    id: 'taverna_2f',
    floors: 2,
    w: 9.2,
    d: 7.6,
    wallH: 6.35,
    apexRise: 1.50,
    ridgeAlongX: true,
    hasBalcony: false,
    hasAwning: true,
    hasFlowerBoxes: true,
    hasChimney: true
  },
  {
    id: 'stepped_3f',
    floors: 3,
    w: 9.8,
    d: 8.0,
    wallH: 9.05,
    apexRise: 1.65,
    ridgeAlongX: true,
    isSteppedWing: true,
    hasBalcony: true,
    hasAwning: true,
    hasFlowerBoxes: false,
    hasChimney: true
  },
  {
    id: 'stone_cottage_2f',
    floors: 2,
    w: 7.8,
    d: 7.4,
    wallH: 6.15,
    apexRise: 1.65,
    ridgeAlongX: false, // Gable-front street facade!
    hasPorchCanopy: true,
    hasBalcony: false,
    hasAwning: false,
    hasFlowerBoxes: true,
    hasChimney: true
  },
  {
    id: 'merchant_3f',
    floors: 3,
    w: 6.8,
    d: 8.2,
    wallH: 9.15,
    apexRise: 1.60,
    ridgeAlongX: false, // Tall gable-front merchant house!
    hasBalcony: true,
    hasAwning: true,
    hasFlowerBoxes: true,
    hasChimney: true
  }
];

function buildHouseGroup(tpl, wallMat, matLib, shrubMat) {
  const buckets = {
    wall: [],
    stone: [],
    roof: [],
    trim: [],
    timber: [],
    window: [],
    iron: [],
    awning: [],
    foliage: []
  };

  if (tpl.isSteppedWing) {
    // Asymmetric 3-story main wing (left, w1 = 5.8m) + 2-story side wing (right, w2 = 4.2m)
    const w1 = 5.8, cx1 = -2.0, h1 = tpl.wallH;
    const w2 = 4.2, cx2 = 2.8, h2 = 6.15;

    buckets.stone.push(
      buildChamferedMasonryBlock(w1 + 0.18, 4.15, tpl.d + 0.18, cx1, -3.60, 0, 0.06),
      buildChamferedMasonryBlock(w2 + 0.18, 4.15, tpl.d - 0.5 + 0.18, cx2, -3.60, -0.15, 0.06)
    );
    buckets.wall.push(
      buildChamferedMasonryBlock(w1, h1 - 0.45, tpl.d, cx1, 0.48, 0, 0.05),
      buildGablePedimentPrism(w1, tpl.d, cx1, h1, 0, 1.50, true),
      buildChamferedMasonryBlock(w2, h2 - 0.45, tpl.d - 0.5, cx2, 0.48, -0.15, 0.05),
      buildGablePedimentPrism(w2, tpl.d - 0.5, cx2, h2, -0.15, 1.25, true)
    );

    const r1 = buildPitchedClayRoof(w1, tpl.d, cx1, h1, 0, 1.50, 0.48, true);
    const r2 = buildPitchedClayRoof(w2, tpl.d - 0.5, cx2, h2, -0.15, 1.25, 0.45, true);
    buckets.roof.push(...r1.roofParts, ...r2.roofParts);
    buckets.timber.push(...r1.timberParts, ...r2.timberParts);

    const zF1 = tpl.d * 0.5;
    const zF2 = (tpl.d - 0.5) * 0.5 - 0.15;
    addStreetDoorAssembly(buckets, zF1, cx1 - 1.15);
    addFramedWindowAssembly(buckets, '+Z', zF1, cx1 + 1.35, 0.92, 1.05, 1.40, { hasShutters: true, hasFlowerBox: true });
    addFramedWindowAssembly(buckets, '+Z', zF2, cx2 + 0.35, 0.92, 1.15, 1.40, { hasShutters: true });
    addStripedAwning(buckets, zF2, cx2 + 0.35, 2.75, 3.0, 1.15, 0.58);

    // 2nd & 3rd floor windows + balcony
    addStreetDoorAssembly(buckets, zF1, cx1, 1.04, 2.02); // wait: 2nd floor balcony French door!
    // Replace ground step of 2nd-floor balcony door with balcony at y = 3.25m:
    buckets.stone.pop();
    addWroughtIronBalcony(buckets, zF1, cx1, 3.30, 2.8, 0.90);
    addFramedWindowAssembly(buckets, '+Z', zF1, cx1, 3.36, 1.08, 1.92, { hasShutters: true });
    addFramedWindowAssembly(buckets, '+Z', zF2, cx2 + 0.35, 3.58, 1.08, 1.44, { hasShutters: true, hasFlowerBox: true });
    addFramedWindowAssembly(buckets, '+Z', zF1, cx1 - 1.3, 6.45, 1.02, 1.36, { hasShutters: true });
    addFramedWindowAssembly(buckets, '+Z', zF1, cx1 + 1.3, 6.45, 1.02, 1.36, { hasShutters: true });
    // Side windows
    addFramedWindowAssembly(buckets, '-X', cx1 - w1 * 0.5, 0, 3.65, 1.05, 1.42, { hasShutters: true });
    addFramedWindowAssembly(buckets, '+X', cx2 + w2 * 0.5, -0.15, 3.65, 1.05, 1.42, { hasShutters: true });
    addMasonryChimney(buckets, cx1 - 1.6, h1 + 0.45, -1.2, 1.85);
  } else {
    // Deep stone foundation plinth (-3.6m .. +0.54m) so house never floats on slopes!
    buckets.stone.push(
      buildChamferedMasonryBlock(tpl.w + 0.20, 4.14, tpl.d + 0.20, 0, -3.60, 0, 0.06)
    );
    // Main plastered/stone multi-story masonry volume + mid-story belt cornice + gable pediments
    buckets.wall.push(
      buildChamferedMasonryBlock(tpl.w, tpl.wallH - 0.48, tpl.d, 0, 0.50, 0, 0.05),
      buildGablePedimentPrism(tpl.w, tpl.d, 0, tpl.wallH, 0, tpl.apexRise, tpl.ridgeAlongX)
    );
    buckets.trim.push(
      buildChamferedMasonryBlock(tpl.w + 0.14, 0.14, tpl.d + 0.14, 0, 3.12, 0, 0.03)
    );
    if (tpl.floors >= 3) {
      buckets.trim.push(
        buildChamferedMasonryBlock(tpl.w + 0.14, 0.14, tpl.d + 0.14, 0, 6.08, 0, 0.03)
      );
    }

    // Overhanging pitched clay-tile roof with ridge tiles & eave rafters
    const roofRes = buildPitchedClayRoof(tpl.w, tpl.d, 0, tpl.wallH, 0, tpl.apexRise, 0.50, tpl.ridgeAlongX);
    buckets.roof.push(...roofRes.roofParts);
    buckets.timber.push(...roofRes.timberParts);

    const zF = tpl.d * 0.5;
    const zB = -tpl.d * 0.5;
    const xR = tpl.w * 0.5;
    const xL = -tpl.w * 0.5;

    // Ground floor: 2.12m entrance door + street windows
    const doorX = tpl.w >= 8.4 ? -tpl.w * 0.22 : 0.0;
    addStreetDoorAssembly(buckets, zF, doorX, 1.12, 2.12);

    if (tpl.w >= 8.4) {
      addFramedWindowAssembly(buckets, '+Z', zF, tpl.w * 0.24, 0.92, 1.14, 1.42, {
        hasShutters: true,
        hasFlowerBox: tpl.hasFlowerBoxes
      });
    } else {
      addFramedWindowAssembly(buckets, '+Z', zF, -tpl.w * 0.30, 0.96, 0.94, 1.32, {
        hasShutters: false,
        hasFlowerBox: tpl.hasFlowerBoxes
      });
      addFramedWindowAssembly(buckets, '+Z', zF, tpl.w * 0.30, 0.96, 0.94, 1.32, {
        hasShutters: false,
        hasFlowerBox: tpl.hasFlowerBoxes
      });
    }

    if (tpl.hasAwning) {
      addStripedAwning(buckets, zF, 0, 2.86, Math.min(tpl.w * 0.76, 5.4), 1.28, 0.64);
    }

    if (tpl.hasPorchCanopy) {
      // Sloped clay-tile porch canopy over the front door supported on timber posts
      const porchRoof = buildChamferedMasonryBlock(2.45, 0.14, 1.18, 0, 0, 0, 0.025, 0.45);
      porchRoof.rotateX(0.24);
      porchRoof.translate(doorX, 2.68, zF + 0.54);
      buckets.roof.push(porchRoof);
      for (const sx of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.065, 0.075, 2.68, 8, 1);
        post.translate(doorX + sx * 1.02, 1.22, zF + 1.02);
        buckets.timber.push(post);
      }
    }

    // Upper floors (2nd floor y = 3.58m, optional 3rd floor y = 6.48m)
    const cols = tpl.w >= 8.2 ? [-tpl.w * 0.27, 0, tpl.w * 0.27] : [-tpl.w * 0.24, tpl.w * 0.24];
    for (let fl = 2; fl <= tpl.floors; fl++) {
      const yWin = fl === 2 ? 3.58 : 6.48;
      if (fl === 2 && tpl.hasBalcony) {
        addWroughtIronBalcony(buckets, zF, 0, 3.26, Math.min(3.4, tpl.w * 0.52), 0.92);
      }
      for (let ci = 0; ci < cols.length; ci++) {
        const cxW = cols[ci];
        const isBalconyDoor = fl === 2 && tpl.hasBalcony && Math.abs(cxW) < 0.2;
        addFramedWindowAssembly(
          buckets,
          '+Z',
          zF,
          cxW,
          isBalconyDoor ? 3.32 : yWin,
          1.04,
          isBalconyDoor ? 1.94 : 1.44,
          {
            hasShutters: true,
            hasFlowerBox: !isBalconyDoor && tpl.hasFlowerBoxes && fl === 2
          }
        );
      }

      // Side & back facade windows so buildings look complete from every driving direction
      addFramedWindowAssembly(buckets, '+X', xR, -tpl.d * 0.18, yWin, 1.00, 1.38, { hasShutters: true });
      addFramedWindowAssembly(buckets, '-X', xL,  tpl.d * 0.18, yWin, 1.00, 1.38, { hasShutters: true });
      addFramedWindowAssembly(buckets, '-Z', zB,  cols[0],      yWin, 1.00, 1.38, { hasShutters: true });
    }

    if (tpl.hasChimney) {
      addMasonryChimney(buckets, tpl.w * 0.26, tpl.wallH + 0.35, -tpl.d * 0.22, 1.90);
    }
  }

  const group = new THREE.Group();
  const addMerged = (geos, mat, role) => {
    if (!geos || geos.length === 0) return;
    const m = new THREE.Mesh(mergeGeometriesSimple(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.auditRole = role;
    group.add(m);
  };

  addMerged(buckets.wall, wallMat, 'house_wall');
  addMerged(buckets.stone, matLib.materials.stoneWall, 'house_foundation');
  addMerged(buckets.roof, matLib.materials.roofTile, 'house_roof');
  addMerged(buckets.trim, matLib.materials.terracottaTrim, 'house_trim');
  addMerged(buckets.timber, matLib.materials.archTimber, 'house_timber');
  addMerged(buckets.window, matLib.materials.windowPane, 'house_window');
  addMerged(buckets.iron, matLib.materials.wroughtIron, 'house_iron');
  addMerged(buckets.awning, matLib.materials.awningFabric, 'house_awning');
  addMerged(buckets.foliage, shrubMat, 'flora_shrub');

  return group;
}

// ============================================================================
// Z3 Monumental Village Landmark: Bell-Tower Church ("Igreja de São Lourenço" — Ref 05)
// ============================================================================

function buildVillageChurchLandmark(matLib) {
  const buckets = {
    wall: [],
    stone: [],
    roof: [],
    trim: [],
    timber: [],
    window: [],
    iron: []
  };

  // Nave dimensions: 11.6m wide x 16.4m deep x 9.6m eave height (+ 3.0m gable rise = 12.6m)
  // Bell-tower ("campanário"): attached on left front (-5.8m .. -9.2m), rising to 21.8m total height!
  const naveW = 11.2;
  const naveD = 16.2;
  const naveH = 9.4;
  const naveRise = 2.85;

  // Deep terraced stone foundation plinth + broad front church steps
  buckets.stone.push(
    buildChamferedMasonryBlock(16.6, 4.30, naveD + 2.4, -1.6, -3.65, 0.4, 0.08),
    buildChamferedMasonryBlock(7.6, 0.28, 1.45, 0, 0.55, naveD * 0.5 + 0.72, 0.04),
    buildChamferedMasonryBlock(6.4, 0.26, 0.95, 0, 0.80, naveD * 0.5 + 0.45, 0.04)
  );

  // Main ochre plastered nave + front/back gable pediments (ridge along Z!)
  buckets.wall.push(
    buildChamferedMasonryBlock(naveW, naveH - 0.55, naveD, 0, 0.62, 0, 0.06),
    buildGablePedimentPrism(naveW, naveD, 0, naveH, 0, naveRise, false)
  );

  // Ref 05 Terracotta vertical facade pilasters & stepped gable coping
  const zFront = naveD * 0.5;
  for (const px of [-naveW * 0.48, -2.35, 2.35, naveW * 0.48]) {
    const pilH = Math.abs(px) < 3.0 ? naveH + naveRise * 0.62 : naveH + 0.25;
    buckets.trim.push(
      buildChamferedMasonryBlock(0.36, pilH - 0.6, 0.24, px, 0.62, zFront + 0.08, 0.03)
    );
  }
  // Stepped baroque parapet crown at nave apex + wrought-iron cross
  buckets.wall.push(
    buildChamferedMasonryBlock(3.4, 1.55, 0.52, 0, naveH + naveRise - 0.45, zFront - 0.22, 0.04)
  );
  buckets.trim.push(
    buildChamferedMasonryBlock(3.75, 0.22, 0.64, 0, naveH + naveRise + 1.08, zFront - 0.22, 0.03)
  );

  // Overhanging clay-tile nave roof (ridge along Z)
  const naveRoof = buildPitchedClayRoof(naveW, naveD, 0, naveH, 0, naveRise, 0.58, false);
  buckets.roof.push(...naveRoof.roofParts);
  buckets.timber.push(...naveRoof.timberParts);

  // Monumental 3.6m tall x 2.3m wide arched double-timber portal + upper rose/niche window on front facade
  buckets.trim.push(
    buildChamferedMasonryBlock(0.28, 3.85, 0.34, -1.28, 0.90, zFront + 0.14, 0.04),
    buildChamferedMasonryBlock(0.28, 3.85, 0.34,  1.28, 0.90, zFront + 0.14, 0.04),
    buildChamferedMasonryBlock(3.15, 0.42, 0.38,  0.00, 4.68, zFront + 0.16, 0.04)
  );
  buckets.timber.push(
    buildChamferedMasonryBlock(2.26, 3.65, 0.10, 0, 0.95, zFront + 0.03, 0.02, 1, {
      u0: 0.52, u1: 0.98, v0: 0.02, v1: 0.98
    })
  );
  // Circular rose window above church portal
  const roseRing = new THREE.TorusGeometry(0.98, 0.14, 10, 24);
  roseRing.translate(0, 7.35, zFront + 0.14);
  buckets.trim.push(roseRing);
  const roseGlass = new THREE.CylinderGeometry(0.92, 0.92, 0.08, 20, 1);
  roseGlass.rotateX(Math.PI * 0.5);
  roseGlass.translate(0, 7.35, zFront + 0.05);
  buckets.window.push(roseGlass);

  // Side nave buttresses & tall clerestory windows
  for (let b = -2; b <= 2; b++) {
    const bz = b * 3.1;
    for (const sx of [-1, 1]) {
      if (sx === -1 && b >= 1) continue; // Bell-tower occupies front-left corner
      buckets.trim.push(
        buildChamferedMasonryBlock(0.45, 7.8, 0.55, sx * (naveW * 0.5 + 0.18), 0.62, bz - 1.45, 0.04)
      );
      addFramedWindowAssembly(buckets, sx > 0 ? '+X' : '-X', sx * naveW * 0.5, bz, 3.65, 1.05, 2.65, {
        hasShutters: false
      });
    }
  }

  // Tall 21.6m Bell-Tower ("Campanário" — Ref 05 iconic open-arch belfry visible from afar!)
  const tx = -7.35;
  const tz = zFront - 2.15;
  // Lower tower base shaft (0.62m .. 12.6m)
  buckets.wall.push(
    buildChamferedMasonryBlock(3.85, 12.0, 3.85, tx, 0.62, tz, 0.06)
  );
  buckets.trim.push(
    buildChamferedMasonryBlock(4.15, 0.28, 4.15, tx, 7.20, tz, 0.04),
    buildChamferedMasonryBlock(4.25, 0.34, 4.25, tx, 12.55, tz, 0.04)
  );

  // Open 4-corner belfry piers rising from 12.85m to 18.85m + arched masonry crown + hanging bronze bell!
  for (const [ox, oz] of [[-1.32, -1.32], [1.32, -1.32], [-1.32, 1.32], [1.32, 1.32]]) {
    buckets.wall.push(
      buildChamferedMasonryBlock(0.84, 5.95, 0.84, tx + ox, 12.85, tz + oz, 0.04)
    );
  }
  // Belfry arch lintel & pyramidal clay-tile spire roof (18.8m .. 20.9m)
  buckets.wall.push(
    buildChamferedMasonryBlock(3.65, 0.85, 3.65, tx, 18.75, tz, 0.05)
  );
  buckets.trim.push(
    buildChamferedMasonryBlock(3.95, 0.24, 3.95, tx, 19.58, tz, 0.04)
  );
  const spire = new THREE.ConeGeometry(2.75, 2.15, 12, 2);
  spire.rotateY(Math.PI / 8);
  spire.translate(tx, 20.75, tz);
  buckets.roof.push(spire);

  // Hanging cast-iron/bronze church bells inside open belfry
  const bellBeam = new THREE.CylinderGeometry(0.10, 0.10, 2.8, 8, 1);
  bellBeam.rotateZ(Math.PI * 0.5);
  bellBeam.translate(tx, 17.85, tz);
  buckets.timber.push(bellBeam);

  const bellBody = new THREE.CylinderGeometry(0.28, 0.58, 0.88, 14, 1);
  bellBody.translate(tx, 17.20, tz);
  const bellLip = new THREE.TorusGeometry(0.58, 0.07, 8, 16);
  bellLip.rotateX(Math.PI * 0.5);
  bellLip.translate(tx, 16.78, tz);
  buckets.iron.push(bellBody, bellLip);

  // Tall wrought-iron cross finial crowning the bell-tower spire (reaches y = 23.1m!)
  const crossV = new THREE.CylinderGeometry(0.05, 0.06, 1.65, 8, 1);
  crossV.translate(tx, 22.45, tz);
  const crossH = new THREE.CylinderGeometry(0.045, 0.045, 0.98, 8, 1);
  crossH.rotateZ(Math.PI * 0.5);
  crossH.translate(tx, 22.72, tz);
  // Smaller cross atop nave gable
  const naveCrossV = new THREE.CylinderGeometry(0.04, 0.05, 1.15, 8, 1);
  naveCrossV.translate(0, naveH + naveRise + 1.72, zFront - 0.22);
  const naveCrossH = new THREE.CylinderGeometry(0.038, 0.038, 0.72, 8, 1);
  naveCrossH.rotateZ(Math.PI * 0.5);
  naveCrossH.translate(0, naveH + naveRise + 1.88, zFront - 0.22);
  buckets.iron.push(crossV, crossH, naveCrossV, naveCrossH);

  const group = new THREE.Group();
  group.name = 'VillageChurchLandmark';
  const ochreMat = matLib.materials.houseWalls[0]; // Warm golden ochre matching Ref 05!

  const addMerged = (geos, mat, role) => {
    if (!geos || geos.length === 0) return;
    const m = new THREE.Mesh(mergeGeometriesSimple(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.auditRole = role;
    group.add(m);
  };

  addMerged(buckets.wall, ochreMat, 'church_wall');
  addMerged(buckets.stone, matLib.materials.stoneWall, 'church_stone');
  addMerged(buckets.roof, matLib.materials.roofTile, 'church_roof');
  addMerged(buckets.trim, matLib.materials.terracottaTrim, 'church_trim');
  addMerged(buckets.timber, matLib.materials.archTimber, 'church_timber');
  addMerged(buckets.window, matLib.materials.windowPane, 'church_window');
  addMerged(buckets.iron, matLib.materials.wroughtIron, 'church_iron');

  return { group, halfW: 8.4, halfD: 9.2 };
}

// ============================================================================
// Z3 Plaza Fountain & Café Parasols + Z2 Mirante Scenic Overlook Builder
// ============================================================================

function buildPlazaFountain(matLib) {
  const stoneParts = [
    new THREE.CylinderGeometry(3.25, 3.55, 1.35, 12, 1), // Outer octagonal/12-sided stone basin rooted in ground
    (() => { const g = new THREE.CylinderGeometry(0.52, 0.68, 1.85, 10, 1); g.translate(0, 0.95, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(1.55, 1.15, 0.36, 12, 1); g.translate(0, 1.88, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.24, 0.34, 0.95, 10, 1); g.translate(0, 2.38, 0); return g; })()
  ];
  stoneParts[0].translate(0, -0.15, 0);

  const group = new THREE.Group();
  group.name = 'VillagePlazaFountain';
  const stoneMesh = new THREE.Mesh(mergeGeometriesSimple(stoneParts), matLib.materials.stoneWall);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.userData.auditRole = 'plaza_fountain';

  const waterGeo = new THREE.CylinderGeometry(2.92, 2.92, 0.08, 16, 1);
  waterGeo.translate(0, 0.44, 0);
  const waterMesh = new THREE.Mesh(waterGeo, matLib.materials.windowPane);
  waterMesh.userData.auditRole = 'water';

  group.add(stoneMesh, waterMesh);
  return group;
}

function buildCafeParasolTable(matLib) {
  const stoneParts = [];
  const ironParts = [];
  const fabricParts = [];

  // Round stone café table + 3 stools
  const tableTop = new THREE.CylinderGeometry(0.68, 0.66, 0.08, 12, 1);
  tableTop.translate(0, 0.76, 0);
  const tablePed = new THREE.CylinderGeometry(0.10, 0.26, 0.95, 8, 1);
  tablePed.translate(0, 0.32, 0);
  stoneParts.push(tableTop, tablePed);

  for (let c = 0; c < 3; c++) {
    const ang = (c / 3) * Math.PI * 2 + 0.4;
    const stool = new THREE.CylinderGeometry(0.22, 0.25, 0.56, 8, 1);
    stool.translate(Math.cos(ang) * 1.05, 0.18, Math.sin(ang) * 1.05);
    stoneParts.push(stool);
  }

  // Central wrought-iron parasol mast + 8-rib Mediterranean striped parasol canopy
  const pole = new THREE.CylinderGeometry(0.032, 0.036, 2.65, 8, 1);
  pole.translate(0, 1.32, 0);
  ironParts.push(pole);

  const canopy = new THREE.ConeGeometry(1.75, 0.56, 16, 2, true);
  canopy.translate(0, 2.42, 0);
  fabricParts.push(canopy);

  const g = new THREE.Group();
  const mStone = new THREE.Mesh(mergeGeometriesSimple(stoneParts), matLib.materials.stoneWall);
  const mIron = new THREE.Mesh(mergeGeometriesSimple(ironParts), matLib.materials.wroughtIron);
  const mFab = new THREE.Mesh(mergeGeometriesSimple(fabricParts), matLib.materials.awningFabric);
  for (const m of [mStone, mIron, mFab]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.auditRole = 'prop_cafe_table';
    g.add(m);
  }
  return g;
}

export class VillageAndLandmarksSystem {
  constructor(world, matLib, shrubMat = null) {
    this.world = world;
    this.matLib = matLib;
    this.shrubMat = shrubMat || new THREE.MeshStandardMaterial({
      map: matLib.sharedMaps.foliageClusterAlbedo,
      normalMap: matLib.sharedMaps.foliageNormal,
      roughnessMap: matLib.sets.forestGround.rough,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02
    });
    this.group = new THREE.Group();
    this.group.name = 'VillageAndLandmarksGroup';
    this.houseVariationsUsed = new Set();
    this.housesNear30mCount = 0;

    // Pre-build 6x3 = 18 reusable house prototypes (or clone lightweight mesh groups sharing BufferGeometries!)
    this.templateCache = new Map();

    this._buildZ3ChurchAndPlaza();
    this._populateZ3VillageHouses();
    this._buildZ2MiranteOverlook();
  }

  _getHousePrototype(tplIndex, wallIndex) {
    const key = `${tplIndex}_${wallIndex}`;
    if (!this.templateCache.has(key)) {
      const tpl = HOUSE_TEMPLATES[tplIndex % HOUSE_TEMPLATES.length];
      const wallMat = this.matLib.materials.houseWalls[wallIndex % this.matLib.materials.houseWalls.length];
      this.templateCache.set(key, buildHouseGroup(tpl, wallMat, this.matLib, this.shrubMat));
    }
    return this.templateCache.get(key);
  }

  // Checks 3.0m exclusion zone at center AND all 4 corners + OBB non-overlap against all existing buildings
  _tryPlaceBuilding({ id, kind, s, side, latCenterFromEdge, halfW, halfD, rotY, minMargin = 0.85, isHouse = true, templateId = '' }) {
    const { spline, terrain, buildings, placedObjects, obstacleColliders } = this.world;
    const ws = spline.wrapS(s);
    const smp = spline.sampleAt(ws);
    const pt = spline.roadPoint(ws, side * (smp.halfWidth + latCenterFromEdge), 0);
    const x = pt.x;
    const z = pt.z;

    if (
      x < terrain.minX + 14 || x > terrain.maxX - 14 ||
      z < terrain.minZ + 14 || z > terrain.maxZ - 14
    ) {
      return null;
    }

    const diagRadius = Math.hypot(halfW, halfD);
    const projCenter = spline.projectXZ(x, z);
    const centerClearance = (projCenter.absD - diagRadius) - projCenter.halfWidth;
    if (centerClearance < 3.18) {
      return null;
    }

    // Verify all 4 building corners + eave overhang (+0.55m) also stay >= 3.25m outside road edge!
    const yaw = -rotY; // Matches validateWorld.js OBB corner rotation convention!
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const chw = halfW + 0.55;
    const chd = halfD + 0.55;
    const corners = [
      [x + c * chw - sn * chd, z + sn * chw + c * chd],
      [x - c * chw - sn * chd, z - sn * chw + c * chd],
      [x - c * chw + sn * chd, z - sn * chw - c * chd],
      [x + c * chw + sn * chd, z + sn * chw - c * chd]
    ];
    for (const [cx, cz] of corners) {
      const cp = spline.projectXZ(cx, cz);
      if (cp.absD - cp.halfWidth < 3.25) return null;
    }

    const candidateObb = { id, x, z, halfW, halfD, yaw };
    for (let i = 0; i < buildings.length; i++) {
      if (obbOverlapWithMargin(candidateObb, buildings[i], minMargin)) {
        return null;
      }
    }

    const hit = terrain.raycastDown(x, z);
    const baseY = hit.y;

    const bRec = {
      id,
      kind,
      templateId,
      isHouse,
      s: projCenter.s,
      x,
      z,
      baseY,
      halfW,
      halfD,
      yaw,
      distFromTrackEdgeM: +(projCenter.absD - projCenter.halfWidth - Math.min(halfW, halfD)).toFixed(2)
    };
    buildings.push(bRec);

    placedObjects.push({
      id,
      kind,
      zone: projCenter.zone,
      s: projCenter.s,
      x,
      z,
      baseY,
      terrainY: hit.y,
      exclusionRadius: diagRadius
    });

    obstacleColliders.push({ x, z, radius: Math.min(halfW, halfD) * 0.92 });

    if (isHouse) {
      this.houseVariationsUsed.add(templateId);
      // Section 4 Z3: "Pelo menos 25 casas de 2–3 andares a menos de 30 m da pista"
      const nearDist = projCenter.absD - projCenter.halfWidth;
      if (nearDist < 30.0) {
        this.housesNear30mCount++;
      }
    }

    return bRec;
  }

  _buildZ3ChurchAndPlaza() {
    const { spline, terrain, trackData, placedObjects, obstacleColliders } = this.world;
    const churchS = trackData.landmarks?.churchAtS || 1685;
    const churchSide = trackData.landmarks?.churchSide || 1;
    const smp = spline.sampleAt(churchS);

    const { group: churchGroup, halfW, halfD } = buildVillageChurchLandmark(this.matLib);
    // Face front portal (+Z) toward the sunny plaza & street
    const rotY = Math.atan2(-churchSide * smp.rxz_x, -churchSide * smp.rxz_z);
    const latCenter = Math.max(trackData.landmarks?.churchOffset || 15.5, 3.6 + Math.hypot(halfW, halfD));

    const rec = this._tryPlaceBuilding({
      id: 'z3_church_landmark',
      kind: 'landmark_church',
      s: churchS,
      side: churchSide,
      latCenterFromEdge: latCenter,
      halfW,
      halfD,
      rotY,
      minMargin: 2.0,
      isHouse: false,
      templateId: 'church_campanario'
    });

    if (rec) {
      churchGroup.position.set(rec.x, rec.baseY, rec.z);
      churchGroup.rotation.y = rotY;
      this.group.add(churchGroup);
      this.world.churchLandmark = rec;
    }

    // Sunny Opposite Plaza ("Largo da Igreja") at s = churchS on -churchSide: stone fountain + 4 café parasol tables
    const fountSide = -churchSide;
    const fountPt = spline.roadPoint(churchS, fountSide * (smp.halfWidth + 9.2), 0);
    const fountProj = spline.projectXZ(fountPt.x, fountPt.z);
    if ((fountProj.absD - 3.6) - fountProj.halfWidth >= 3.2) {
      const fHit = terrain.raycastDown(fountPt.x, fountPt.z);
      const fountain = buildPlazaFountain(this.matLib);
      fountain.position.set(fountPt.x, fHit.y, fountPt.z);
      this.group.add(fountain);
      placedObjects.push({
        id: 'z3_plaza_fountain',
        kind: 'prop_fountain',
        zone: 'Z3',
        s: fountProj.s,
        x: fountPt.x,
        z: fountPt.z,
        baseY: fHit.y,
        terrainY: fHit.y,
        exclusionRadius: 3.55
      });
      obstacleColliders.push({ x: fountPt.x, z: fountPt.z, radius: 3.5 });
    }

    // Café parasol tables flanking both sides of the plaza outside 3m exclusion zone
    const parasolProto = buildCafeParasolTable(this.matLib);
    const cafeOffsets = [
      [churchS - 16, fountSide, 6.2],
      [churchS + 16, fountSide, 6.2],
      [churchS - 19, churchSide, 6.4],
      [churchS + 19, churchSide, 6.4]
    ];
    cafeOffsets.forEach(([cs, cSide, cLat], idx) => {
      const cSmp = spline.sampleAt(cs);
      const cPt = spline.roadPoint(cs, cSide * (cSmp.halfWidth + cLat), 0);
      const cp = spline.projectXZ(cPt.x, cPt.z);
      if ((cp.absD - 1.65) - cp.halfWidth < 3.18) return;
      const cHit = terrain.raycastDown(cPt.x, cPt.z);
      const inst = parasolProto.clone();
      inst.position.set(cPt.x, cHit.y, cPt.z);
      inst.rotation.y = idx * 0.9;
      this.group.add(inst);
      placedObjects.push({
        id: `z3_cafe_table_${idx}`,
        kind: 'prop_cafe_table',
        zone: 'Z3',
        s: cp.s,
        x: cPt.x,
        z: cPt.z,
        baseY: cHit.y,
        terrainY: cHit.y,
        exclusionRadius: 1.65
      });
      obstacleColliders.push({ x: cPt.x, z: cPt.z, radius: 1.4 });
    });
  }

  _populateZ3VillageHouses() {
    const { spline, trackData } = this.world;
    const rng = mulberry32((trackData.seed || 20261102) + 707);
    const plazaS = trackData.landmarks?.plazaAtS || 1685;
    const scaleHouseTargetS = trackData.landmarks?.scaleHouseAtS || 1528;

    // Find Z3 arc-length span dynamically
    let z3Start = Infinity, z3End = -Infinity;
    for (const smp of spline.samples) {
      if (smp.zone === 'Z3') {
        if (smp.s < z3Start) z3Start = smp.s;
        if (smp.s > z3End) z3End = smp.s;
      }
    }

    let houseCount = 0;
    const placedHouses = [];

    // 0. Place deterministic featured S11 Scale-Reference House right at scaleHouseTargetS (side = +1, sunlit front door!)
    {
      const tplIdx = 0; // 2-story townhouse with 2.12m front door, balcony & flower boxes
      const tpl = HOUSE_TEMPLATES[tplIdx];
      const smp = spline.sampleAt(scaleHouseTargetS);
      const halfW = tpl.w * 0.5;
      const halfD = tpl.d * 0.5;
      const diag = Math.hypot(halfW, halfD);
      const rotY = Math.atan2(-1 * smp.rxz_x, -1 * smp.rxz_z);
      const rec = this._tryPlaceBuilding({
        id: 'z3_house_scale_ref',
        kind: 'house',
        s: scaleHouseTargetS,
        side: 1,
        latCenterFromEdge: 3.45 + diag, // ~9.0m center -> front door ~5.1m from asphalt edge!
        halfW,
        halfD,
        rotY,
        minMargin: 1.0,
        isHouse: true,
        templateId: tpl.id
      });
      if (rec) {
        placedHouses.push({ tplIdx, wallIdx: 1, s: scaleHouseTargetS, x: rec.x, y: rec.baseY, z: rec.z, rotY });
        this.world.scaleReferenceHouse = { ...rec, rotY, frontDoorLocalZ: halfD };
        houseCount++;
      }
    }

    // 1. Primary street-front rows on both sides of Z3 (center at ~9.2..12.8m from track edge -> well within <30m!)
    for (let s = z3Start + 6; s <= z3End - 6; s += 16.5) {
      for (const side of [1, -1]) {
        // Keep open plaza vista around Largo da Igreja (plazaS +/- 26m)
        if (Math.abs(s - plazaS) < 26.5) continue;

        const tplIdx = (houseCount + (side > 0 ? 0 : 3)) % HOUSE_TEMPLATES.length;
        const wallIdx = (houseCount * 5 + (side > 0 ? 1 : 2)) % this.matLib.materials.houseWalls.length;
        const tpl = HOUSE_TEMPLATES[tplIdx];
        const halfW = tpl.w * 0.5;
        const halfD = tpl.d * 0.5;
        const diag = Math.hypot(halfW, halfD);

        const sJit = s + (rng() - 0.5) * 2.4;
        const smp = spline.sampleAt(sJit);
        const rotY = Math.atan2(-side * smp.rxz_x, -side * smp.rxz_z) + (rng() - 0.5) * 0.08;
        const latCenter = 3.55 + diag + rng() * 2.2; // ~9.2..11.8m from track edge

        const rec = this._tryPlaceBuilding({
          id: `z3_house_${houseCount}`,
          kind: 'house',
          s: sJit,
          side,
          latCenterFromEdge: latCenter,
          halfW,
          halfD,
          rotY,
          minMargin: 0.95,
          isHouse: true,
          templateId: tpl.id
        });
        if (!rec) continue;

        placedHouses.push({ tplIdx, wallIdx, s: sJit, x: rec.x, y: rec.baseY, z: rec.z, rotY });
        houseCount++;
      }
    }

    // 2. Second-tier staggered village terrace houses (center at ~21..26.5m from track edge -> still < 30m!)
    // Frames the plaza and creates rich layered hillside village depth like Refs 05 & 06
    for (let s = z3Start + 18; s <= z3End - 18; s += 28.0) {
      for (const side of [1, -1]) {
        // Don't block behind church on churchSide right at plazaS
        if (side === (trackData.landmarks?.churchSide || 1) && Math.abs(s - plazaS) < 24.0) continue;

        const tplIdx = (houseCount + 2) % HOUSE_TEMPLATES.length;
        const wallIdx = (houseCount * 3 + 4) % this.matLib.materials.houseWalls.length;
        const tpl = HOUSE_TEMPLATES[tplIdx];
        const halfW = tpl.w * 0.5;
        const halfD = tpl.d * 0.5;

        const smp = spline.sampleAt(s);
        const rotY = Math.atan2(-side * smp.rxz_x, -side * smp.rxz_z) + (rng() - 0.5) * 0.12;
        const latCenter = 21.5 + rng() * 4.5; // < 27m (< 30m limit!)

        const rec = this._tryPlaceBuilding({
          id: `z3_house_tier2_${houseCount}`,
          kind: 'house',
          s,
          side,
          latCenterFromEdge: latCenter,
          halfW,
          halfD,
          rotY,
          minMargin: 1.1,
          isHouse: true,
          templateId: tpl.id
        });
        if (!rec) continue;

        placedHouses.push({ tplIdx, wallIdx, s, x: rec.x, y: rec.baseY, z: rec.z, rotY });
        houseCount++;
      }
    }

    // Spatial material-bucket batching across 4 village sectors (~1,152 draw calls -> ~52 draw calls with frustum culling!)
    const chunkSpan = Math.max(80, (z3End - z3Start) / 4);
    const chunkBuckets = new Map();
    const xform = new THREE.Matrix4();
    const rotEuler = new THREE.Euler();
    const posVec = new THREE.Vector3();
    const scaleOne = new THREE.Vector3(1, 1, 1);

    for (const h of placedHouses) {
      const proto = this._getHousePrototype(h.tplIdx, h.wallIdx);
      const chunkIdx = Math.max(0, Math.min(3, Math.floor((h.s - z3Start) / chunkSpan)));
      posVec.set(h.x, h.y, h.z);
      rotEuler.set(0, h.rotY, 0);
      xform.compose(posVec, new THREE.Quaternion().setFromEuler(rotEuler), scaleOne);

      for (const child of proto.children) {
        if (!child.isMesh) continue;
        const bKey = `${chunkIdx}_${child.material.uuid}`;
        let bucket = chunkBuckets.get(bKey);
        if (!bucket) {
          bucket = { material: child.material, role: child.userData.auditRole, geos: [] };
          chunkBuckets.set(bKey, bucket);
        }
        const gClone = child.geometry.clone();
        gClone.applyMatrix4(xform);
        bucket.geos.push(gClone);
      }
    }

    for (const bucket of chunkBuckets.values()) {
      const merged = mergeGeometriesSimple(bucket.geos);
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.auditRole = bucket.role;
      mesh.name = `VillageBatch_${bucket.role}`;
      this.group.add(mesh);
    }

    this.world.villageStats = {
      totalHouses: houseCount,
      housesWithin30m: this.housesNear30mCount,
      houseVariationsCount: this.houseVariationsUsed.size,
      houseVariations: Array.from(this.houseVariationsUsed)
    };
  }

  _buildZ2MiranteOverlook() {
    // Section 4 Z2: "Mirante com a orla visível abaixo"
    const { spline, terrain, trackData, placedObjects, obstacleColliders } = this.world;
    const miranteS = trackData.landmarks?.miranteAtS || 765;
    // At s = 765, side = -1 looks directly South-East over the curved Z1 beach bay & sparkling ocean below!
    const smp = spline.sampleAt(miranteS);
    const side = -1;

    // Place stone viewing bench + coastal brass viewing scope + stone bollards outside 3m exclusion zone (lat = 4.4..6.2m)
    const benchParts = [
      buildChamferedMasonryBlock(2.2, 0.52, 0.58, 0, -0.35, 0, 0.04),
      buildChamferedMasonryBlock(2.35, 0.10, 0.66, 0, 0.42, 0, 0.025)
    ];
    const benchGeo = mergeGeometriesSimple(benchParts);

    for (const ds of [-7.5, 0.0, 7.5]) {
      const s = miranteS + ds;
      const ms = spline.sampleAt(s);
      const pt = spline.roadPoint(s, side * (ms.halfWidth + 4.85), 0);
      const proj = spline.projectXZ(pt.x, pt.z);
      if ((proj.absD - 1.25) - proj.halfWidth < 3.15) continue;

      const hit = terrain.raycastDown(pt.x, pt.z);
      const bench = new THREE.Mesh(benchGeo, this.matLib.materials.stoneWall);
      bench.position.set(pt.x, hit.y, pt.z);
      bench.rotation.y = Math.atan2(ms.fxz_x, ms.fxz_z) + Math.PI * 0.5;
      bench.castShadow = true;
      bench.receiveShadow = true;
      bench.userData.auditRole = 'mirante_bench';
      this.group.add(bench);

      placedObjects.push({
        id: `z2_mirante_bench_${ds}`,
        kind: 'prop_mirante_bench',
        zone: 'Z2',
        s: proj.s,
        x: pt.x,
        z: pt.z,
        baseY: hit.y,
        terrainY: hit.y,
        exclusionRadius: 1.25
      });
      obstacleColliders.push({ x: pt.x, z: pt.z, radius: 1.1 });
    }
  }
}
