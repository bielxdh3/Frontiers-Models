// Tiny geometry accumulator used by the procedural builders (houses, barriers, props, trees).
// Attributes: position, normal, uv (metres), color (vertex tint), aMat (texture-array layer, -1 = per-instance plaster), aInst (vec4).
import * as THREE from 'three';

export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.mat = []; this.inst = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  get triangles() { return this.idx.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, c, mat, inst) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]); this.mat.push(mat); this.inst.push(inst[0], inst[1], inst[2], inst[3]);
    return this.pos.length / 3 - 1;
  }
  /** flat quad p0..p3 (CCW seen from the normal side). uv in metres, chosen from the quad edges unless given. */
  quad(p0, p1, p2, p3, { mat = -1, color = [1, 1, 1], inst = [0, 0, 0, 0], uvs = null, uvScale = 1, smooth = null } = {}) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const w = Math.hypot(ux, uy, uz) * uvScale, h = Math.hypot(vx, vy, vz) * uvScale;
    const t = uvs || [[0, 0], [w, 0], [w, h], [0, h]];
    const P = [p0, p1, p2, p3];
    const N = smooth || [[nx, ny, nz], [nx, ny, nz], [nx, ny, nz], [nx, ny, nz]];
    const i0 = this.pos.length / 3;
    for (let k = 0; k < 4; k++) this.vert(P[k][0], P[k][1], P[k][2], N[k][0], N[k][1], N[k][2], t[k][0], t[k][1], color, mat, inst);
    this.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  tri(p0, p1, p2, o = {}) {
    const { mat = -1, color = [1, 1, 1], inst = [0, 0, 0, 0], uvs = null } = o;
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const t = uvs || [[0, 0], [Math.hypot(ux, uy, uz), 0], [Math.hypot(ux, uy, uz) * 0.5, Math.hypot(vx, vy, vz)]];
    const i0 = this.pos.length / 3;
    [p0, p1, p2].forEach((p, k) => this.vert(p[0], p[1], p[2], nx, ny, nz, t[k][0], t[k][1], color, mat, inst));
    this.idx.push(i0, i0 + 1, i0 + 2);
  }
  /** append a three.js geometry transformed by `matrix` */
  addGeo(g, matrix, { mat = -1, color = [1, 1, 1], inst = [0, 0, 0, 0], uvScale = 1, uvU = null, uvV = null, planar = false } = {}) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      let tu = uv ? uv.getX(i) * (uvU ?? uvScale) : 0, tv = uv ? uv.getY(i) * (uvV ?? uvScale) : 0;
      if (planar) {                                    // box-projected UVs in metres (dominant axis of the normal)
        const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
        if (ay >= ax && ay >= az) { tu = v.x; tv = v.z; } else if (ax >= az) { tu = v.z; tv = v.y; } else { tu = v.x; tv = v.y; }
      }
      this.vert(v.x, v.y, v.z, nn.x, nn.y, nn.z, tu, tv, color, mat, inst);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.array[i]);
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }
  /**
   * sweep a 2D profile [[x,y]...] along a path. frames[i] = {p:[x,y,z], r:[x,y,z] (profile +x), u:[x,y,z] (profile +y)}.
   * Produces flat-shaded faces per profile segment (crisp edges), UV = (distance along path, profile length).
   */
  sweep(profile, frames, { mat = -1, color = [1, 1, 1], closed = false, uvAlong = 0, colorFn = null, inst = [0, 0, 0, 0], double = false } = {}) {
    const P = profile.length;
    let along = uvAlong;
    for (let i = 0; i < frames.length - 1; i++) {
      const A = frames[i], B = frames[i + 1];
      const dl = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]);
      const col = colorFn ? colorFn(i) : color;
      let v0 = 0;
      for (let k = 0; k < (closed ? P : P - 1); k++) {
        const k2 = (k + 1) % P;
        const pt = (F, q) => [F.p[0] + F.r[0] * q[0] + F.u[0] * q[1], F.p[1] + F.r[1] * q[0] + F.u[1] * q[1], F.p[2] + F.r[2] * q[0] + F.u[2] * q[1]];
        const a0 = pt(A, profile[k]), a1 = pt(A, profile[k2]), b0 = pt(B, profile[k]), b1 = pt(B, profile[k2]);
        const seg = Math.hypot(profile[k2][0] - profile[k][0], profile[k2][1] - profile[k][1]);
        // quad order: a0 -> b0 -> b1 -> a1 with the normal on the outward side of the profile (right-hand: along x(prof) then path)
        this.quad(a0, b0, b1, a1, { mat, color: col, inst, uvs: [[along, v0], [along + dl, v0], [along + dl, v0 + seg], [along, v0 + seg]] });
        if (double) this.quad(a0, a1, b1, b0, { mat, color: col, inst, uvs: [[along, v0], [along, v0 + seg], [along + dl, v0 + seg], [along + dl, v0]] });
        v0 += seg;
      }
      along += dl;
    }
    return along;
  }
  /** vertical-ish tube/prism with a taper: ring of `seg` points, from y0 (radius r0) to y1 (radius r1) */
  cylinder(cx, cz, y0, y1, r0, r1, seg, { mat = -1, color = [1, 1, 1], inst = [0, 0, 0, 0], cap = true, smooth = true, uvScale = 1 } = {}) {
    const base = this.pos.length / 3;
    const dy = y1 - y0, dr = r0 - r1, sl = Math.hypot(dy, dr) || 1;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const ny = dr / sl, nh = dy / sl;
      for (const [y, r] of [[y0, r0], [y1, r1]]) {
        this.vert(cx + c * r, y, cz + s * r, c * nh, ny, s * nh, (j / seg) * Math.PI * 2 * r0 * uvScale, (y - y0) * uvScale, color, mat, inst);
      }
    }
    for (let j = 0; j < seg; j++) { const a = base + j * 2; this.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    if (cap) {
      const ci = this.vert(cx, y1, cz, 0, 1, 0, 0, 0, color, mat, inst);
      const ring = [];
      for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; ring.push(this.vert(cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1, 0, 1, 0, Math.cos(a) * r1, Math.sin(a) * r1, color, mat, inst)); }
      for (let j = 0; j < seg; j++) this.idx.push(ci, ring[j + 1], ring[j]);
    }
  }
  toGeometry({ withInst = true } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    if (withInst) g.setAttribute('aInst', new THREE.Float32BufferAttribute(this.inst, 4));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
