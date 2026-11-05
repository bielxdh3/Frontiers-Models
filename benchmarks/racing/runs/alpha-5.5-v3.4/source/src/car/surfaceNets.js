// Naive surface nets mesher (own implementation) for implicit fields f(x,y,z)
// (negative inside). Produces smooth vertices projected onto the iso-surface
// and normals from the field gradient.

export function surfaceNets(field, bounds, h, { project = 2, skip = null } = {}) {
  const [x0, y0, z0] = bounds.min, [x1, y1, z1] = bounds.max;
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) { const z = z0 + k * h; for (let j = 0; j < ny; j++) { const y = y0 + j * h; for (let i = 0; i < nx; i++) F[(k * ny + j) * nx + i] = field(x0 + i * h, y, z); } }
  const id = (i, j, k) => (k * ny + j) * nx + i;
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const fv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = F[id(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; fv[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = fv[a], vb = fv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      n++;
    }
    cellV[cid(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }
  // project vertices onto the surface (Newton steps along the gradient)
  const e = h * 0.25;
  const grad = (x, y, z, out) => {
    out[0] = (field(x + e, y, z) - field(x - e, y, z)) / (2 * e);
    out[1] = (field(x, y + e, z) - field(x, y - e, z)) / (2 * e);
    out[2] = (field(x, y, z + e) - field(x, y, z - e)) / (2 * e);
    return out;
  };
  const g = [0, 0, 0];
  const nrm = new Float32Array(pos.length);
  for (let v = 0; v < pos.length; v += 3) {
    let x = pos[v], y = pos[v + 1], z = pos[v + 2];
    for (let it = 0; it < project; it++) {
      const f = field(x, y, z); grad(x, y, z, g);
      const gl2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
      if (gl2 < 1e-8) break;
      const step = Math.max(-h * 0.6, Math.min(h * 0.6, f / gl2));
      x -= g[0] * step; y -= g[1] * step; z -= g[2] * step;
    }
    pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
    grad(x, y, z, g); const l = Math.hypot(g[0], g[1], g[2]) || 1;
    nrm[v] = g[0] / l; nrm[v + 1] = g[1] / l; nrm[v + 2] = g[2] / l;
  }
  // quads for each sign-changing grid edge
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (skip && skip(pos, a, b, c, d)) return;
    if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = F[id(i, j, k)], b = F[id(i + 1, j, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellV[cid(i, j - 1, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i, j - 1, k)], a >= 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[id(i, j, k)], b = F[id(i, j + 1, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellV[cid(i - 1, j, k - 1)], cellV[cid(i - 1, j, k)], cellV[cid(i, j, k)], cellV[cid(i, j, k - 1)], a >= 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[id(i, j, k)], b = F[id(i, j, k + 1)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellV[cid(i - 1, j - 1, k)], cellV[cid(i, j - 1, k)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], a >= 0);
  }
  return { positions: new Float32Array(pos), normals: nrm, indices: idx };
}

/**
 * Split a triangle mesh along the zero set of region functions and group
 * triangles by region id. regionOf(x,y,z,nx,ny,nz) -> integer id; boundaries
 * are refined by splitting triangles on each provided level-set fn.
 */
export function splitRegions(mesh, levelSets, regionOf, field) {
  let P = Array.from(mesh.positions), N = Array.from(mesh.normals), I = mesh.indices.slice();
  for (const fn of levelSets) {
    const val = []; for (let v = 0; v < P.length; v += 3) val.push(fn(P[v], P[v + 1], P[v + 2]));
    const nI = [];
    const cache = new Map();
    const cut = (a, b) => {
      const key = a < b ? a * 1e7 + b : b * 1e7 + a;
      if (cache.has(key)) return cache.get(key);
      const t = val[a] / (val[a] - val[b]);
      const id = P.length / 3;
      for (let c = 0; c < 3; c++) { P.push(P[a * 3 + c] + (P[b * 3 + c] - P[a * 3 + c]) * t); N.push(N[a * 3 + c] + (N[b * 3 + c] - N[a * 3 + c]) * t); }
      const l = Math.hypot(N[id * 3], N[id * 3 + 1], N[id * 3 + 2]) || 1; N[id * 3] /= l; N[id * 3 + 1] /= l; N[id * 3 + 2] /= l;
      val.push(0);
      cache.set(key, id); return id;
    };
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const sa = val[a] >= 0, sb = val[b] >= 0, sc = val[c] >= 0;
      if (sa === sb && sb === sc) { nI.push(a, b, c); continue; }
      // rotate so that 'a' is the lone vertex
      let A = a, B = b, C = c;
      if (sa === sb) { A = c; B = a; C = b; } else if (sa === sc) { A = b; B = c; C = a; }
      const ab = cut(A, B), ac = cut(A, C);
      nI.push(A, ab, ac, ab, B, C, ab, C, ac);
    }
    I = nI;
  }
  // classify
  const groups = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    const r = regionOf(cx, cy, cz, nx / l, ny / l, nz / l);
    if (r < 0) continue;
    let g = groups.get(r); if (!g) { g = []; groups.set(r, g); } g.push(a, b, c);
  }
  return { P: new Float32Array(P), N: new Float32Array(N), groups };
}
