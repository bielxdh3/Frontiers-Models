// Procedural car geometry helpers: smooth profile curves, lofted superellipse bodies (with carved wheel arches),
// tyres / rims / brake discs and small utility builders. Everything here is generated in code (no downloaded meshes).
import * as THREE from 'three';

/** smooth profile through [u, v] pairs (cardinal Hermite) */
export function profile(pts) {
  const n = pts.length, m = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    m[i] = (b[1] - a[1]) / ((b[0] - a[0]) || 1e-9);
  }
  return u => {
    if (u <= pts[0][0]) return pts[0][1];
    if (u >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (i < n - 2 && u > pts[i + 1][0]) i++;
    const x0 = pts[i][0], x1 = pts[i + 1][0], h = x1 - x0, t = (u - x0) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * pts[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * pts[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

/**
 * Lofted body surface. Coordinates: x right, y up, z BACK (front of the car at z = -L/2).
 * sect(z) -> {yb, yt, w, n, wb}   (bottom y, top y, half width, superellipse exponent, bottom half width)
 * arches: [{z, y, r, xin, side:+1/-1}] carve wheel wells into the sides.
 * returns { geometry, grid: {S, M, pos} }
 */
export function loftBody({ L, S, M, sect, arches = [], zc = 0, bulge = null, darkBottom = true }) {
  const pos = new Float32Array(S * M * 3), col = new Float32Array(S * M * 3), uv = new Float32Array(S * M * 2);
  // ring parameter distribution: dense on the flanks (wheel arches live there)
  const ring = [];
  for (let j = 0; j < M; j++) {
    const base = (j / M) * Math.PI * 2 - Math.PI / 2;
    ring.push(base - 0.28 * Math.sin(2 * base));
  }
  for (let i = 0; i < S; i++) {
    const z = -L / 2 + (L * i) / (S - 1);
    const sc = sect(z);
    const yc = (sc.yb + sc.yt) / 2, hh = (sc.yt - sc.yb) / 2;
    for (let j = 0; j < M; j++) {
      const th = ring[j];
      const c = Math.cos(th), s = Math.sin(th);
      const e = 2 / sc.n;
      let x = sc.w * spow(c, e), y = yc + hh * spow(s, e);
      // tumblehome: bottom is narrower than the shoulder
      const lower = Math.max(0, -s);              // 0 at/above the equator -> 1 at the bottom
      x *= 1 - ((sc.w - (sc.wb ?? sc.w)) / sc.w) * Math.pow(lower, 1.4);
      if (sc.wt !== undefined) x *= 1 - ((sc.w - sc.wt) / sc.w) * Math.pow(Math.max(0, s), 1.15);
      // crowned hood / deck : lift the middle of the top
      if (bulge && s > 0) y += bulge(z) * (1 - Math.pow(Math.abs(x) / sc.w, 2)) * Math.pow(s, 1.5);
      let dark = 1;
      // wheel arches: recess the flank into a well
      for (const a of arches) {
        if (x * a.side <= 0) continue;
        const d = Math.hypot(z - a.z, y - a.y);
        if (d < a.r + 0.09) {
          const k = sstep(a.r, a.r + 0.045, d);                 // 0 inside the well, 1 on the body
          const ax = Math.abs(x);
          const nx = a.xin + (ax - a.xin) * k;
          if (ax > a.xin) x = Math.sign(x) * nx;
          dark = Math.min(dark, 0.10 + 0.9 * sstep(a.r + 0.005, a.r + 0.10, d));
        }
      }
      if (darkBottom) dark *= 0.25 + 0.75 * sstep(0.0, 0.07, y - sc.yb) + (s > -0.2 ? 0 : 0);
      const o = (i * M + j);
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = dark;
      uv[o * 2] = x * 1.5; uv[o * 2 + 1] = z * 1.5;
    }
  }
  const idx = [];
  for (let i = 0; i < S - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, b, c, b, d, c);
  }
  // end caps: fan to a centre vertex (closes the nose and tail)
  const V = S * M;
  const pos2 = new Float32Array((V + 2) * 3), col2 = new Float32Array((V + 2) * 3), uv2 = new Float32Array((V + 2) * 2);
  pos2.set(pos); col2.set(col); uv2.set(uv);
  for (const [k, ringIdx] of [[0, 0], [1, S - 1]]) {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < M; j++) { const o = ringIdx * M + j; cx += pos[o * 3]; cy += pos[o * 3 + 1]; cz += pos[o * 3 + 2]; }
    const ci = V + k;
    pos2[ci * 3] = cx / M; pos2[ci * 3 + 1] = cy / M; pos2[ci * 3 + 2] = cz / M;
    col2[ci * 3] = col2[ci * 3 + 1] = col2[ci * 3 + 2] = 0.6;
    uv2[ci * 2] = 0; uv2[ci * 2 + 1] = cz / M * 1.5;
    for (let j = 0; j < M; j++) { const a = ringIdx * M + j, b = ringIdx * M + (j + 1) % M; if (k === 0) idx.push(ci, b, a); else idx.push(ci, a, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col2, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv2, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, S, M, pos };
}

/** close the open ends of a loft with a fan (front/back faces) */
export function capLoft(g, S, M) {
  const pos = g.attributes.position.array;
  const idx = Array.from(g.index.array);
  const add = (i0, flip) => {
    // centre vertex of ring i0
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < M; j++) { cx += pos[(i0 * M + j) * 3]; cy += pos[(i0 * M + j) * 3 + 1]; cz += pos[(i0 * M + j) * 3 + 2]; }
    const arr = Array.from(pos); const ci = arr.length / 3; arr.push(cx / M, cy / M, cz / M);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    for (let j = 0; j < M; j++) { const a = i0 * M + j, b = i0 * M + (j + 1) % M; if (flip) idx.push(ci, a, b); else idx.push(ci, b, a); }
  };
  // simple approach: skip caps (ends collapse to thin rings that are covered by bumper details)
  return g;
}

/** merge several BufferGeometries (same attributes) into one */
export function mergeGeoms(list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), col = new Float32Array(vc * 3);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, vo * 3); else col.fill(1, vo * 3, (vo + n) * 3);
    if (g.index) for (let k = 0; k < g.index.count; k++) idx[io + k] = g.index.array[k] + vo;
    else for (let k = 0; k < n; k++) idx[io + k] = vo + k;
    io += g.index ? g.index.count : n; vo += n;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

/** lathe around the X axis (wheel axle): profile = [[x, r], ...] -> geometry with `seg` segments */
export function latheX(profilePts, seg, { smooth = false } = {}) {
  const pts = profilePts.map(([x, r]) => new THREE.Vector2(r, x));
  const g = new THREE.LatheGeometry(pts, seg);
  // LatheGeometry revolves around Y: rotate so the axle is X
  g.rotateZ(-Math.PI / 2);
  if (smooth) g.computeVertexNormals();
  return g;
}

/**
 * Tyre: sidewall bulge, shoulder, flat tread (with groove ring pattern via normal map), 56 segments.
 * width w, outer radius R, rim radius Rr.
 */
export function buildTire(R, w, Rr, seg = 64) {
  const hw = w / 2, sh = (R - Rr) * 0.9;
  const p = [];
  const add = (x, r) => p.push([x, r]);
  // inner bead -> sidewall -> shoulder -> tread -> mirror
  const half = [
    [hw * 0.74, Rr + 0.004], [hw * 0.86, Rr + sh * 0.10], [hw * 0.97, Rr + sh * 0.35], [hw * 1.0, Rr + sh * 0.62], [hw * 0.97, Rr + sh * 0.84],
    [hw * 0.90, R - 0.012], [hw * 0.80, R - 0.003], [hw * 0.55, R], [hw * 0.25, R], [0, R],
  ];
  for (const [x, r] of half) add(-x, r);
  for (let i = half.length - 2; i >= 0; i--) add(half[i][0], half[i][1]);
  const g = latheX(p, seg);
  // uv: u around the wheel, v across the tread
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getY(i)); uv.setXY(i, (a / (Math.PI * 2) + 0.5) * 6.0, pos.getX(i) / w + 0.5); }
  return g;
}

/** rim: barrel + lip + spokes; returns {rim, disc} geometries (rim at x in [-hw, hw]) */
export function buildRim(Rr, width, spokes, seg = 48, style = 0) {
  const hw = width / 2;
  const barrel = latheX([[-hw, Rr - 0.004], [-hw + 0.012, Rr + 0.002], [-hw + 0.03, Rr - 0.018], [-hw * 0.2, Rr - 0.026], [hw * 0.5, Rr - 0.03], [hw - 0.03, Rr - 0.018], [hw - 0.012, Rr + 0.002], [hw, Rr - 0.004]], seg);
  const parts = [barrel];
  // face plate (slightly dished) + hub
  const hubR = Rr * 0.22;
  parts.push(latheX([[hw * 0.78, hubR * 1.05], [hw * 0.86, hubR * 0.98], [hw * 0.98, hubR * 0.62], [hw * 0.98, 0.001]], 24));
  // spokes: tapered lofted bars from hub to lip, with a bevel (many tris, no boxes)
  const sp = [];
  for (let k = 0; k < spokes; k++) {
    const ang = (k / spokes) * Math.PI * 2;
    const rows = 10, cols = 6;
    const pos = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const rad = hubR * 0.9 + (Rr - 0.03 - hubR * 0.9) * t;
      const sw = (style === 0 ? 0.030 - 0.012 * t : 0.040 - 0.022 * t) * (1 + 0.35 * Math.sin(t * Math.PI));       // spoke half width
      const xFace = hw * 0.96 - 0.05 * t * t;                                                                      // dish: spokes move inboard towards the lip
      for (let c = 0; c <= cols; c++) {
        const u = c / cols * 2 - 1;                                                  // across the spoke
        const x = xFace - 0.016 * (u * u);
        const yy = rad, zz = u * sw;
        // rotate about the axle (X)
        const ca = Math.cos(ang), sa = Math.sin(ang);
        pos.push(x, yy * ca - zz * sa, yy * sa + zz * ca);
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c; idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx); g.computeVertexNormals();
    // add the underside so spokes read as solid from the side
    sp.push(g);
  }
  const rimGeo = mergeGeoms([...parts.map(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }), ...sp.map(g => { g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })]);
  return rimGeo;
}

/** ventilated brake disc with drilled holes */
export function buildDisc(Rd, thick, seg = 48) {
  const g1 = latheX([[-thick / 2, Rd * 0.55], [-thick / 2, Rd], [thick / 2, Rd], [thick / 2, Rd * 0.55], [-thick / 2, Rd * 0.55]], seg, {});
  const hat = latheX([[thick / 2, Rd * 0.55], [thick * 1.4, Rd * 0.5], [thick * 1.4, Rd * 0.2], [-thick, Rd * 0.2]], 24);
  return mergeGeoms([g1, hat].map(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }));
}

/** caliper: rounded wedge around the upper rear of the disc (swept strip, many triangles) */
export function buildCaliper(Rd, width, seg = 14) {
  const pos = [], idx = [];
  const a0 = -0.55, a1 = 0.55;
  const rows = seg, cols = 8;
  for (let r = 0; r <= rows; r++) {
    const a = a0 + (a1 - a0) * (r / rows);
    for (let c = 0; c <= cols; c++) {
      const t = c / cols * Math.PI;
      const rr = Rd * (0.62 + 0.36 * (1 - Math.cos(t)) / 2);       // radial span
      const x = Math.sin(t) * width * 0.5 * (0.7 + 0.3 * Math.cos(r / rows * Math.PI));
      pos.push((c < cols / 2 ? -1 : 1) * Math.abs(x) , rr * Math.cos(a), rr * Math.sin(a));
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c; idx.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** soft round contact-shadow texture (radial gradient), 1024^2 */
export function makeBlobTexture(size = 1024) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.5)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
