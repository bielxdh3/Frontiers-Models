// Single Source of Truth Spline & Deterministic Math derived strictly from track.json

export function createRng(seed = 20261102) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function noise2D(x, z, seed = 1337) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
}

export function fbm2D(x, z, octaves = 4, seed = 1337) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * (noise2D(x * freq, z * freq, seed + i * 97) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return val / (norm || 1);
}

export function smootherstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export class TrackSpline {
  constructor(trackData) {
    this.data = trackData;
    this.seed = trackData.seed || 20261102;
    this.exclusionMargin = Math.max(3.0, trackData.exclusionMargin || 3.2);
    this.embankmentWidth = trackData.embankmentWidth || 11.0;
    this.bridge = trackData.bridge || { startS: 2389, endS: 2483, ravineDepth: 11.5 };

    const cps = trackData.controlPoints;
    const N = cps.length;
    const SUB = 128; // High-density arc-length table for exact cubic evaluation
    const raw = [];

    const evalCubicAt = (segIdx, t) => {
      const p0 = cps[(segIdx - 1 + N) % N];
      const p1 = cps[segIdx % N];
      const p2 = cps[(segIdx + 1) % N];
      const p3 = cps[(segIdx + 2) % N];
      return {
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
        width: catmullRom(p0.width, p1.width, p2.width, p3.width, t),
        bankDeg: catmullRom(p0.bank, p1.bank, p2.bank, p3.bank, t),
        zone: t < 0.5 ? p1.zone : p2.zone
      };
    };

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < SUB; j++) {
        const pt = evalCubicAt(i, j / SUB);
        pt.segIdx = i;
        pt.segT = j / SUB;
        raw.push(pt);
      }
    }

    // Compute cumulative arc length
    const cumS = new Float64Array(raw.length + 1);
    cumS[0] = 0;
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i];
      const b = raw[(i + 1) % raw.length];
      cumS[i + 1] = cumS[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    this.totalLength = cumS[raw.length];

    // Uniform 1.0 m arc-length resampling evaluated directly on the smooth cubic curve
    this.sampleCount = Math.round(this.totalLength);
    this.ds = this.totalLength / this.sampleCount;
    this.samples = new Array(this.sampleCount);

    let rawIdx = 0;
    for (let k = 0; k < this.sampleCount; k++) {
      const targetS = k * this.ds;
      while (rawIdx < raw.length - 1 && cumS[rawIdx + 1] < targetS) {
        rawIdx++;
      }
      const segLen = Math.max(1e-8, cumS[rawIdx + 1] - cumS[rawIdx]);
      const alpha = Math.max(0, Math.min(1, (targetS - cumS[rawIdx]) / segLen));
      const a = raw[rawIdx];
      const exactT = a.segT + alpha * (1 / SUB);
      const exact = evalCubicAt(a.segIdx, exactT);

      this.samples[k] = {
        index: k,
        s: targetS,
        x: exact.x,
        y: exact.y,
        z: exact.z,
        width: exact.width,
        halfWidth: exact.width * 0.5,
        bankDeg: exact.bankDeg,
        zone: exact.zone
      };
    }

    // Compute frames, curvature, grade, bridge factor
    const M = this.sampleCount;
    for (let k = 0; k < M; k++) {
      const prev = this.samples[(k - 1 + M) % M];
      const curr = this.samples[k];
      const next = this.samples[(k + 1) % M];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const dz = next.z - prev.z;
      const len3d = Math.hypot(dx, dy, dz) || 1;
      const len2d = Math.hypot(dx, dz) || 1;

      curr.fx = dx / len3d;
      curr.fy = dy / len3d;
      curr.fz = dz / len3d;

      curr.fxz_x = dx / len2d;
      curr.fxz_z = dz / len2d;

      // Driver's horizontal right vector (+Z on Z1 heading +X)
      curr.rxz_x = -curr.fxz_z;
      curr.rxz_z = curr.fxz_x;

      const bankRad = (curr.bankDeg * Math.PI) / 180;
      curr.bankRad = bankRad;
      const cb = Math.cos(bankRad);
      const sb = Math.sin(bankRad);

      curr.rx = curr.rxz_x * cb;
      curr.ry = sb;
      curr.rz = curr.rxz_z * cb;

      // Surface normal N = normalize(R x F) -> points +UP
      const nx = curr.ry * curr.fz - curr.rz * curr.fy;
      const ny = curr.rz * curr.fx - curr.rx * curr.fz;
      const nz = curr.rx * curr.fy - curr.ry * curr.fx;
      const nLen = Math.hypot(nx, ny, nz) || 1;
      curr.nx = nx / nLen;
      curr.ny = ny / nLen;
      curr.nz = nz / nLen;

      curr.grade = (next.y - prev.y) / len2d;

      // Signed 2D curvature (+ = right turn, - = left turn)
      const ax = curr.x - prev.x, az = curr.z - prev.z;
      const bx = next.x - curr.x, bz = next.z - curr.z;
      const cx = next.x - prev.x, cz = next.z - prev.z;
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz), lc = Math.hypot(cx, cz);
      // Cross product in XZ: ax*bz - az*bx (>0 turns toward +rightXZ)
      const cross = ax * bz - az * bx;
      curr.curvature = (la * lb * lc) > 1e-8 ? (2 * cross) / (la * lb * lc) : 0;
      curr.radius = Math.abs(curr.curvature) > 1e-6 ? 1 / Math.abs(curr.curvature) : 99999;

      // Bridge factor (3.0m solid abutment collar at each end so terrain meets abutment with <0.03m gap!)
      const bs = this.bridge.startS;
      const be = this.bridge.endS;
      if (curr.s > bs && curr.s < be) {
        const rampIn = smootherstep(bs + 4.5, bs + 22.0, curr.s);
        const rampOut = 1.0 - smootherstep(be - 22.0, be - 4.5, curr.s);
        curr.bridgeFactor = Math.min(rampIn, rampOut);
        curr.isBridge = true;
      } else {
        curr.bridgeFactor = 0;
        curr.isBridge = false;
      }
    }

    this._buildSpatialGrid();
    this.checkpoints = this._buildCheckpoints();
    this.racingLine = this._buildRacingLine();
  }

  wrapS(s) {
    const L = this.totalLength;
    return ((s % L) + L) % L;
  }

  shortestDeltaS(fromS, toS) {
    const L = this.totalLength;
    let d = this.wrapS(toS) - this.wrapS(fromS);
    if (d > L * 0.5) d -= L;
    if (d < -L * 0.5) d += L;
    return d;
  }

  sampleAt(s) {
    const ws = this.wrapS(s);
    const fIdx = ws / this.ds;
    const i0 = Math.floor(fIdx) % this.sampleCount;
    const i1 = (i0 + 1) % this.sampleCount;
    const t = fIdx - Math.floor(fIdx);
    const a = this.samples[i0];
    const b = this.samples[i1];

    const width = a.width + (b.width - a.width) * t;
    return {
      s: ws,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      fx: a.fx + (b.fx - a.fx) * t,
      fy: a.fy + (b.fy - a.fy) * t,
      fz: a.fz + (b.fz - a.fz) * t,
      fxz_x: a.fxz_x + (b.fxz_x - a.fxz_x) * t,
      fxz_z: a.fxz_z + (b.fxz_z - a.fxz_z) * t,
      rxz_x: a.rxz_x + (b.rxz_x - a.rxz_x) * t,
      rxz_z: a.rxz_z + (b.rxz_z - a.rxz_z) * t,
      rx: a.rx + (b.rx - a.rx) * t,
      ry: a.ry + (b.ry - a.ry) * t,
      rz: a.rz + (b.rz - a.rz) * t,
      nx: a.nx + (b.nx - a.nx) * t,
      ny: a.ny + (b.ny - a.ny) * t,
      nz: a.nz + (b.nz - a.nz) * t,
      width,
      halfWidth: width * 0.5,
      bankDeg: a.bankDeg + (b.bankDeg - a.bankDeg) * t,
      bankRad: a.bankRad + (b.bankRad - a.bankRad) * t,
      grade: a.grade + (b.grade - a.grade) * t,
      curvature: a.curvature + (b.curvature - a.curvature) * t,
      bridgeFactor: a.bridgeFactor + (b.bridgeFactor - a.bridgeFactor) * t,
      isBridge: a.isBridge || b.isBridge,
      zone: t < 0.5 ? a.zone : b.zone
    };
  }

  roadCrown(d, halfWidth) {
    const u = Math.min(1, Math.abs(d) / Math.max(0.5, halfWidth));
    return 0.026 * (1 - u * u);
  }

  roadPoint(s, d = 0, extraUp = 0) {
    const smp = this.sampleAt(s);
    const crown = Math.abs(d) <= smp.halfWidth ? this.roadCrown(d, smp.halfWidth) : 0;
    const up = crown + extraUp;
    return {
      x: smp.x + d * smp.rx + up * smp.nx,
      y: smp.y + d * smp.ry + up * smp.ny,
      z: smp.z + d * smp.rz + up * smp.nz,
      nx: smp.nx,
      ny: smp.ny,
      nz: smp.nz,
      sample: smp
    };
  }

  _buildSpatialGrid() {
    this.cellSize = 28.0;
    this.grid = new Map();
    const M = this.sampleCount;
    const radiusCells = 3; // covers up to 84m directly in fast lookup

    for (let k = 0; k < M; k++) {
      const p = this.samples[k];
      const cx = Math.floor(p.x / this.cellSize);
      const cz = Math.floor(p.z / this.cellSize);
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        for (let dz = -radiusCells; dz <= radiusCells; dz++) {
          const key = `${cx + dx},${cz + dz}`;
          let arr = this.grid.get(key);
          if (!arr) {
            arr = [];
            this.grid.set(key, arr);
          }
          // Store every 2nd sample in grid cells; refine locally +/-2 around winner
          if (k % 2 === 0) arr.push(k);
        }
      }
    }
  }

  projectXZ(x, z) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const candidates = this.grid.get(`${cx},${cz}`);
    const M = this.sampleCount;

    let bestK = 0;
    let bestDistSq = Infinity;

    if (candidates && candidates.length > 0) {
      for (let i = 0; i < candidates.length; i++) {
        const k = candidates[i];
        const p = this.samples[k];
        const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestK = k;
        }
      }
    } else {
      // Coarse scan every 8m then refine
      for (let k = 0; k < M; k += 8) {
        const p = this.samples[k];
        const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestK = k;
        }
      }
    }

    // Refine within +/- 8 samples and project onto exact segment
    let minK = bestK;
    for (let dk = -8; dk <= 8; dk++) {
      const k = (bestK + dk + M) % M;
      const p = this.samples[k];
      const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        minK = k;
      }
    }

    // Check segment [minK-1 -> minK] and [minK -> minK+1]
    let bestS = this.samples[minK].s;
    let bestSegDistSq = Infinity;
    for (const k0 of [(minK - 1 + M) % M, minK]) {
      const k1 = (k0 + 1) % M;
      const a = this.samples[k0];
      const b = this.samples[k1];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const lenSq = vx * vx + vz * vz || 1e-8;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / lenSq));
      const px = a.x + vx * t;
      const pz = a.z + vz * t;
      const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d2 < bestSegDistSq) {
        bestSegDistSq = d2;
        bestS = this.wrapS(a.s + t * this.ds);
      }
    }

    const smp = this.sampleAt(bestS);
    const dx = x - smp.x;
    const dz = z - smp.z;
    // Signed lateral distance in horizontal plane (+ = driver right, - = driver left)
    // Divide by cos(bankRad) so lateral coordinate aligns with banked road width
    const dHoriz = dx * smp.rxz_x + dz * smp.rxz_z;
    const cosBank = Math.max(0.85, Math.cos(smp.bankRad));
    const d = dHoriz / cosBank;
    const absD = Math.abs(d);
    const clampedD = Math.max(-smp.halfWidth, Math.min(smp.halfWidth, d));
    const edgeSign = d >= 0 ? 1 : -1;

    const roadY = smp.y + clampedD * smp.ry + this.roadCrown(clampedD, smp.halfWidth) * smp.ny;
    const edgeY = smp.y + (edgeSign * smp.halfWidth) * smp.ry;

    return {
      s: bestS,
      d,
      absD,
      distXZ: Math.sqrt(bestSegDistSq),
      halfWidth: smp.halfWidth,
      roadY,
      edgeY,
      zone: smp.zone,
      bridgeFactor: smp.bridgeFactor,
      isBridge: smp.isBridge,
      sample: smp
    };
  }

  _buildCheckpoints() {
    const count = this.data.checkpointCount || 16;
    const list = [];
    for (let i = 0; i < count; i++) {
      const s = (i / count) * this.totalLength;
      const smp = this.sampleAt(s);
      const left = this.roadPoint(s, -smp.halfWidth);
      const right = this.roadPoint(s, smp.halfWidth);
      list.push({
        index: i,
        s,
        x: smp.x,
        y: smp.y,
        z: smp.z,
        fx: smp.fxz_x,
        fz: smp.fxz_z,
        width: smp.width,
        left,
        right,
        zone: smp.zone
      });
    }
    return list;
  }

  _buildRacingLine() {
    const M = this.sampleCount;
    const offsets = new Float32Array(M);
    const speeds = new Float32Array(M);

    // Smooth curvature over 18m window to place apex offsets cleanly inside track margins
    for (let k = 0; k < M; k++) {
      let sumK = 0;
      for (let j = -9; j <= 9; j++) {
        sumK += this.samples[(k + j + M) % M].curvature;
      }
      const avgK = sumK / 19;
      const maxOffset = Math.max(1.2, this.samples[k].halfWidth - 2.3);
      // Clip toward inside of corner (positive curvature = right turn -> positive d)
      offsets[k] = Math.max(-maxOffset, Math.min(maxOffset, avgK * 145.0));
    }

    // Smooth racing line offsets twice for gentle steering transitions
    const smoothed = new Float32Array(M);
    for (let pass = 0; pass < 2; pass++) {
      const src = pass === 0 ? offsets : smoothed;
      const dst = pass === 0 ? smoothed : offsets;
      for (let k = 0; k < M; k++) {
        let sum = 0;
        for (let j = -12; j <= 12; j++) sum += src[(k + j + M) % M];
        dst[k] = sum / 25;
      }
    }

    // Compute cornering max speed v_max = sqrt(a_lat_max / |effCurvature|), tuned for ~1:55 good pace
    const topSpeed = 52.0; // ~187 km/h on Z1 coastal straight
    const aLat = 12.2;     // m/s^2 arcade grip
    for (let k = 0; k < M; k++) {
      let maxAbsK = 0;
      for (let j = -6; j <= 6; j++) {
        const ak = Math.abs(this.samples[(k + j + M) % M].curvature);
        if (ak > maxAbsK) maxAbsK = ak;
      }
      // Reduced effective curvature due to racing-line apex cutting
      const effK = Math.max(1e-5, maxAbsK * 0.84);
      const bankBoost = 1.0 + Math.abs(this.samples[k].bankRad) * 0.6;
      const vCorner = Math.sqrt((aLat * bankBoost) / effK);
      speeds[k] = Math.max(16.0, Math.min(topSpeed, vCorner));
    }

    // Backward braking kinematics pass (2 loops around closed track): v_i <= sqrt(v_{i+1}^2 + 2 * a_brake * ds)
    const aBrake = 13.5;
    for (let loop = 0; loop < 2; loop++) {
      for (let k = M - 1; k >= 0; k--) {
        const nextV = speeds[(k + 1) % M];
        const maxEntry = Math.sqrt(nextV * nextV + 2 * aBrake * this.ds);
        if (maxEntry < speeds[k]) speeds[k] = maxEntry;
      }
    }

    // Forward acceleration pass
    const aAccel = 8.5;
    for (let loop = 0; loop < 2; loop++) {
      for (let k = 0; k < M; k++) {
        const prevV = speeds[(k - 1 + M) % M];
        const maxExit = Math.sqrt(prevV * prevV + 2 * aAccel * this.ds);
        if (maxExit < speeds[k]) speeds[k] = maxExit;
      }
    }

    return { offsets, speeds };
  }

  sampleRacingLine(s) {
    const ws = this.wrapS(s);
    const fIdx = ws / this.ds;
    const i0 = Math.floor(fIdx) % this.sampleCount;
    const i1 = (i0 + 1) % this.sampleCount;
    const t = fIdx - Math.floor(fIdx);
    const offset = this.racingLine.offsets[i0] + (this.racingLine.offsets[i1] - this.racingLine.offsets[i0]) * t;
    const targetSpeed = this.racingLine.speeds[i0] + (this.racingLine.speeds[i1] - this.racingLine.speeds[i0]) * t;
    const pt = this.roadPoint(ws, offset, 0.05);
    return { s: ws, offset, targetSpeed, x: pt.x, y: pt.y, z: pt.z };
  }
}
