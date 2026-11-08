// Road surface + kerb geometry derived ONLY from TrackData (same rings the collider uses).
// Vertex layout per ring: lateral offsets [-c, -h, +h, +c]  (shoulder | asphalt | shoulder).
import { SHOULDER } from './track.js';

export const RING_CHUNK = 192;          // rings per render chunk

/** lateral half-extent of the drivable/paved surface at ring i (bridge decks have a narrow kerb walk instead of a shoulder) */
export function surfaceHalf(T, i) {
  const h = T.w[i] * 0.5;
  return T.bridge[i] ? h + 0.8 : h + SHOULDER;
}

export function buildRoadGeometry(T) {
  const N = T.N;
  const chunks = [];
  const kerbs = [];
  const tmp = { x: 0, y: 0, z: 0 };
  const nrm = { x: 0, y: 1, z: 0 };
  for (let start = 0; start < N; start += RING_CHUNK) {
    const end = Math.min(N, start + RING_CHUNK) + 1;          // overlap one ring so chunks join
    const rings = end - start;
    const V = rings * 4;
    const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2);
    const a1 = new Float32Array(V * 4), a2 = new Float32Array(V * 4);
    const idx = [];
    let ymin = 1e9, ymax = -1e9;
    for (let r = 0; r < rings; r++) {
      const i = (start + r) % N;
      const h = T.w[i] * 0.5, c = surfaceHalf(T, i);
      const lats = [-c, -h, h, c];
      T.normalAt(i, nrm);
      for (let k = 0; k < 4; k++) {
        T.roadPoint(i, lats[k], 0, tmp);
        const v = r * 4 + k;
        pos[v * 3] = tmp.x; pos[v * 3 + 1] = tmp.y; pos[v * 3 + 2] = tmp.z;
        nor[v * 3] = nrm.x; nor[v * 3 + 1] = nrm.y; nor[v * 3 + 2] = nrm.z;
        const sCoord = (start + r) * T.ds;                    // monotonic along the chunk (wraps only at the last chunk end)
        uv[v * 2] = lats[k]; uv[v * 2 + 1] = sCoord;
        a1[v * 4] = lats[k]; a1[v * 4 + 1] = sCoord; a1[v * 4 + 2] = T.zone[i]; a1[v * 4 + 3] = T.surface[i];
        a2[v * 4] = h; a2[v * 4 + 1] = T.bridge[i]; a2[v * 4 + 2] = T.curbL[i]; a2[v * 4 + 3] = T.curbR[i];
        ymin = Math.min(ymin, tmp.y); ymax = Math.max(ymax, tmp.y);
      }
      if (r < rings - 1) {
        const b = r * 4;
        for (let k = 0; k < 3; k++) {
          // quad between ring r and r+1, lateral k..k+1 : CCW seen from above (right = +lat)
          const p0 = b + k, p1 = b + k + 1, q0 = b + 4 + k, q1 = b + 4 + k + 1;
          idx.push(p0, q1, q0, p0, p1, q1);
        }
      }
    }
    chunks.push({ positions: pos, normals: nor, uvs: uv, road1: a1, road2: a2, indices: new Uint32Array(idx), ymin, ymax, ring0: start, ring1: Math.min(N, start + RING_CHUNK) });
  }

  // kerb ("zebra") strips: runs of rings with curbL / curbR set. Profile: 5 points rising 4 cm with a rounded face.
  for (const side of [-1, 1]) {
    const flag = side < 0 ? T.curbL : T.curbR;
    let i = 0;
    while (i < N) {
      if (!flag[i] || T.bridge[i]) { i++; continue; }
      let j = i; while (j + 1 < N && flag[j + 1] && !T.bridge[j + 1]) j++;
      if (j - i >= 4) kerbs.push(buildKerbRun(T, i, j, side));
      i = j + 1;
    }
  }
  return { chunks, kerbs };
}

function buildKerbRun(T, i0, i1, side) {
  const rings = i1 - i0 + 1, prof = 5;
  const V = rings * prof;
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), a1 = new Float32Array(V * 4);
  const idx = [];
  const tmp = { x: 0, y: 0, z: 0 };
  // lateral offset from the asphalt edge outwards and height above the road plane
  const prf = [[-0.05, 0.0], [0.0, 0.035], [0.55, 0.045], [1.15, 0.035], [1.35, 0.0]];
  for (let r = 0; r < rings; r++) {
    const i = (i0 + r) % T.N;
    const h = T.w[i] * 0.5;
    // fade the kerb in/out at both ends so it does not start with a hard step
    const fade = Math.min(1, r / 6, (rings - 1 - r) / 6);
    for (let k = 0; k < prof; k++) {
      const lat = side * (h + prf[k][0]);
      T.roadPoint(i, lat, 0, tmp);
      const v = r * prof + k;
      pos[v * 3] = tmp.x; pos[v * 3 + 1] = tmp.y + prf[k][1] * fade; pos[v * 3 + 2] = tmp.z;
      nor[v * 3] = 0; nor[v * 3 + 1] = 1; nor[v * 3 + 2] = 0;
      a1[v * 4] = prf[k][0]; a1[v * 4 + 1] = i * T.ds; a1[v * 4 + 2] = k; a1[v * 4 + 3] = side;
    }
    if (r < rings - 1) {
      const b = r * prof;
      for (let k = 0; k < prof - 1; k++) {
        const p0 = b + k, p1 = b + k + 1, q0 = b + prof + k, q1 = b + prof + k + 1;
        if (side > 0) idx.push(p0, q1, q0, p0, p1, q1); else idx.push(p0, q0, q1, p0, q1, p1);
      }
    }
  }
  // recompute normals from geometry (cheap): accumulate face normals
  const acc = new Float32Array(V * 3);
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f], b = idx[f + 1], c = idx[f + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { acc[q * 3] += nx; acc[q * 3 + 1] += ny; acc[q * 3 + 2] += nz; }
  }
  for (let v = 0; v < V; v++) {
    const L = Math.hypot(acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]) || 1;
    nor[v * 3] = acc[v * 3] / L; nor[v * 3 + 1] = acc[v * 3 + 1] / L; nor[v * 3 + 2] = acc[v * 3 + 2] / L;
    if (nor[v * 3 + 1] < 0) { nor[v * 3] *= -1; nor[v * 3 + 1] *= -1; nor[v * 3 + 2] *= -1; }
  }
  return { positions: pos, normals: nor, road1: a1, indices: new Uint32Array(idx), side, i0, i1 };
}
