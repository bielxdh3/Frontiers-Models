// Section 3.2 — Automated World Integrity Verifier (validateWorld)
// Runs on load in dev mode and inside automated Playwright verification tests.

function obbOverlap2D(a, b) {
  // Each building OBB: { x, z, halfW, halfD, yaw }
  const axes = [
    [Math.cos(a.yaw), Math.sin(a.yaw)],
    [-Math.sin(a.yaw), Math.cos(a.yaw)],
    [Math.cos(b.yaw), Math.sin(b.yaw)],
    [-Math.sin(b.yaw), Math.cos(b.yaw)]
  ];
  const cornersOf = (box) => {
    const c = Math.cos(box.yaw);
    const s = Math.sin(box.yaw);
    const hw = box.halfW;
    const hd = box.halfD;
    return [
      [box.x + c * hw - s * hd, box.z + s * hw + c * hd],
      [box.x - c * hw - s * hd, box.z - s * hw + c * hd],
      [box.x - c * hw + s * hd, box.z - s * hw - c * hd],
      [box.x + c * hw + s * hd, box.z + s * hw - c * hd]
    ];
  };
  const ca = cornersOf(a);
  const cb = cornersOf(b);

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
    if (maxA <= minB + 0.02 || maxB <= minA + 0.02) {
      return false; // Separated along this axis
    }
  }
  return true;
}

export function validateWorld(world, { throwOnError = true } = {}) {
  const { spline, terrain, roadCollider, placedObjects = [], buildings = [] } = world;
  const errors = [];

  let maxTerrainAboveRoad = -Infinity;
  let maxEdgeGap = 0;
  let maxBankDeg = 0;
  let maxGradePct = 0;
  let minCurveRadius = Infinity;
  let minExclusionClearance = Infinity;
  let maxGroundDelta = 0;

  const M = spline.sampleCount;
  const latRatios = [-0.92, -0.6, -0.3, 0.0, 0.3, 0.6, 0.92];

  // 1, 2, 6, 7, 8 — Spline, Road & Stitched Terrain Heightfield Invariants
  for (let k = 0; k < M; k++) {
    const smp = spline.samples[k];

    // Invariant 6: Lateral banking <= 12 deg
    const absBank = Math.abs(smp.bankDeg);
    if (absBank > maxBankDeg) maxBankDeg = absBank;
    if (absBank > 12.0) {
      errors.push(`Road lateral banking ${absBank.toFixed(2)}° > 12° at s=${smp.s.toFixed(1)}m`);
    }

    // Invariant 7: Longitudinal grade <= 14%
    const absGrade = Math.abs(smp.grade);
    if (absGrade * 100 > maxGradePct) maxGradePct = absGrade * 100;
    if (absGrade > 0.14) {
      errors.push(`Road longitudinal grade ${(absGrade * 100).toFixed(2)}% > 14% at s=${smp.s.toFixed(1)}m`);
    }

    // Invariant 8: Curve radius >= 25 m
    if (smp.radius < minCurveRadius) minCurveRadius = smp.radius;
    if (smp.radius < 25.0) {
      errors.push(`Curve radius ${smp.radius.toFixed(2)}m < 25m at s=${smp.s.toFixed(1)}m`);
    }

    // Invariant 1: Terrain above road surface inside track width <= 0.02 m
    for (const r of latRatios) {
      const d = r * smp.halfWidth;
      const rPt = spline.roadPoint(smp.s, d, 0.008);
      const rHit = roadCollider ? roadCollider.raycastDown(rPt.x, rPt.z, rPt.y + 5.0) : null;
      const roadSurfY = rHit ? rHit.y : rPt.y;
      const tHit = terrain.raycastDown(rPt.x, rPt.z);
      const diff = tHit.y - roadSurfY;
      if (diff > maxTerrainAboveRoad) maxTerrainAboveRoad = diff;
      if (diff > 0.02) {
        errors.push(`Terrain above road by ${diff.toFixed(3)}m (>0.02m) at s=${smp.s.toFixed(1)}m, d=${d.toFixed(2)}m`);
        break;
      }
    }

    // Invariant 2: Gap between road edge and terrain <= 0.15 m (on ground road & bridge abutments)
    if (smp.bridgeFactor === 0) {
      for (const side of [-1, 1]) {
        const edgePt = spline.roadPoint(smp.s, side * smp.halfWidth, 0.008);
        const tHit = terrain.raycastDown(edgePt.x, edgePt.z);
        const gap = Math.abs(edgePt.y - tHit.y);
        if (gap > maxEdgeGap) maxEdgeGap = gap;
        if (gap > 0.15) {
          errors.push(`Road-to-terrain edge gap ${gap.toFixed(3)}m (>0.15m) at s=${smp.s.toFixed(1)}m, side=${side}`);
        }
      }
    }
  }

  // 3 & 4 — Exclusion Zone (>= 3.0 m beyond road edge) and Terrain Grounding (<= 0.30 m)
  for (let i = 0; i < placedObjects.length; i++) {
    const obj = placedObjects[i];
    const proj = spline.projectXZ(obj.x, obj.z);
    const radius = obj.exclusionRadius ?? obj.footprintRadius ?? 0.35;
    const clearanceBeyondEdge = (proj.absD - radius) - proj.halfWidth;
    if (clearanceBeyondEdge < minExclusionClearance) minExclusionClearance = clearanceBeyondEdge;

    if (clearanceBeyondEdge < 3.0) {
      errors.push(
        `Object [${obj.kind}:${obj.id ?? i}] inside 3m exclusion zone (clearance=${clearanceBeyondEdge.toFixed(2)}m < 3.0m) at s=${proj.s.toFixed(1)}m`
      );
    }

    const tHit = terrain.raycastDown(obj.x, obj.z);
    const deltaY = obj.baseY - tHit.y;
    if (obj.kind === 'rock') {
      // Rocks may sink into ground/seabed, but must never float > 0.3m
      if (deltaY > maxGroundDelta) maxGroundDelta = deltaY;
      if (deltaY > 0.30) {
        errors.push(`Rock [${obj.id ?? i}] floating ${deltaY.toFixed(3)}m (>0.30m) above terrain`);
      }
    } else {
      const absDelta = Math.abs(deltaY);
      if (absDelta > maxGroundDelta) maxGroundDelta = absDelta;
      if (absDelta > 0.30) {
        errors.push(`Object [${obj.kind}:${obj.id ?? i}] base offset ${deltaY.toFixed(3)}m (|delta|>0.30m) from terrain`);
      }
    }
  }

  // 5 — Overlapping Houses / Buildings (OBB SAT check)
  let overlappingPairs = 0;
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      if (obbOverlap2D(buildings[i], buildings[j])) {
        overlappingPairs++;
        errors.push(`Houses overlapping: ${buildings[i].id} and ${buildings[j].id}`);
      }
    }
  }

  // 9 — Checkpoints strictly on track and strictly in sequence
  const cps = spline.checkpoints;
  if (!cps || cps.length < 6) {
    errors.push(`Insufficient checkpoints: ${cps ? cps.length : 0}`);
  } else {
    let prevS = -1;
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];
      if (cp.index !== i || cp.s <= prevS || cp.s >= spline.totalLength) {
        errors.push(`Checkpoint ${i} out of sequence (s=${cp.s})`);
      }
      prevS = cp.s;
      const proj = spline.projectXZ(cp.x, cp.z);
      if (proj.absD > proj.halfWidth * 0.5) {
        errors.push(`Checkpoint ${i} off track center (d=${proj.d.toFixed(2)}m)`);
      }
    }
  }

  // 10 — Gate P4+ World Content & Architectural Scale/Density Invariants (when populated)
  if (world.villageStats) {
    if (world.villageStats.housesWithin30m < 25) {
      errors.push(`Z3 houses within 30m of track = ${world.villageStats.housesWithin30m} (< 25 required)`);
    }
    if (world.villageStats.houseVariationsCount < 5) {
      errors.push(`Z3 house variations = ${world.villageStats.houseVariationsCount} (< 5 required)`);
    }
    if (!world.churchLandmark) {
      errors.push('Missing Z3 monumental landmark (church with bell-tower)');
    }
  }
  if (world.floraSpecies && world.floraSpecies.length < 4) {
    errors.push(`Vegetation species count = ${world.floraSpecies.length} (< 4 required)`);
  }
  if (world.propDensityBy100m && world.propDensityBy100m.minPropsPer100m < 12.0) {
    errors.push(`Prop density below 12/100m (min=${world.propDensityBy100m.minPropsPer100m}/100m)`);
  }
  if (world.bridge && world.bridge.maxRavineDropM < 4.0) {
    errors.push(`Bridge ravine depth ${world.bridge.maxRavineDropM}m < 4.0m`);
  }

  const report = {
    valid: errors.length === 0,
    errorCount: errors.length,
    errors: errors.slice(0, 25),
    metrics: {
      trackLengthM: +spline.totalLength.toFixed(2),
      maxTerrainAboveRoadM: +maxTerrainAboveRoad.toFixed(4),
      maxEdgeGapM: +maxEdgeGap.toFixed(4),
      maxBankDeg: +maxBankDeg.toFixed(2),
      maxGradePct: +maxGradePct.toFixed(2),
      minCurveRadiusM: +minCurveRadius.toFixed(2),
      minExclusionClearanceM: Number.isFinite(minExclusionClearance) ? +minExclusionClearance.toFixed(2) : null,
      maxObjectGroundDeltaM: +maxGroundDelta.toFixed(4),
      placedObjectCount: placedObjects.length,
      buildingCount: buildings.length,
      housesWithin30m: world.villageStats?.housesWithin30m ?? 0,
      houseVariationsCount: world.villageStats?.houseVariationsCount ?? 0,
      floraSpeciesCount: world.floraSpecies?.length ?? 0,
      floraSpecies: world.floraSpecies ?? [],
      minPropsPer100m: world.propDensityBy100m?.minPropsPer100m ?? null,
      bridgeMaxRavineDropM: world.bridge?.maxRavineDropM ?? null,
      overlappingBuildingPairs: overlappingPairs,
      checkpointCount: cps.length
    }
  };

  if (!report.valid && throwOnError) {
    throw new Error(`validateWorld() FAILED with ${report.errorCount} error(s):\n` + report.errors.join('\n'));
  }

  return report;
}
