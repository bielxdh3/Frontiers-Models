// Road geometry derived from the track spline: asphalt, shoulders / sidewalks,
// skirts and zebra curbs. The drivable collider is built from the very same
// triangles (no separate collision plane).
import * as THREE from 'three';
import { TriangleGrid, SURF } from './collision.js';
import { curbHeight, shoulderWidth, shoulderFall } from './profile.js';

export function shoulderSurf(zone) { return zone === 1 ? SURF.SAND : zone === 3 ? SURF.SIDEWALK : zone === 4 ? SURF.GRASS : SURF.GRAVEL; }

export class Road {
  constructor(track, terrain, racingLine = null) {
    this.track = track; this.terrain = terrain; this.racingLine = racingLine;
    this.drivable = new TriangleGrid(4);
    this.chunks = [];
    this.curbs = [];
  }

  curbHeight(s) { return curbHeight(this.track, s); }
  shoulderWidth(s) { return shoulderWidth(this.track, s); }

  build() {
    const T = this.track, M = T.M, ds = T.ds;
    // section data
    const sec = [];
    const fr = {};
    for (let i = 0; i < M; i++) {
      const s = i * ds;
      T.frame(s, fr);
      const hw = fr.w * 0.5;
      const sh = this.shoulderWidth(s);
      const ch = this.curbHeight(s);
      const zone = T.zoneAt(s);
      const onBridge = T.inRange(s, T.features.bridge.s0 - 1, T.features.bridge.s1 + 1);
      sec.push({ s, hw, sh, ch, zone, onBridge, x: fr.x, y: fr.y, z: fr.z, rbx: fr.rbx, rby: fr.rby, rbz: fr.rbz, cb: Math.cos(fr.bank), line: this.racingLine ? this.racingLine.offsetAt(s) : 0 });
    }
    this.sec = sec;
    const P = (q, d, dy = 0) => { const dd = d / q.cb; return [q.x + q.rbx * dd, q.y + q.rby * dd + dy, q.z + q.rbz * dd]; };

    // chunk boundaries every ~100 m, also at zone changes
    const bounds = [0];
    for (let i = 1; i < M; i++) {
      const zc = sec[i].zone !== sec[i - 1].zone;
      if (zc || i - bounds[bounds.length - 1] >= 280) bounds.push(i);
    }
    bounds.push(M);

    for (let c = 0; c < bounds.length - 1; c++) {
      const a = bounds[c], b = bounds[c + 1];
      const idx = []; for (let i = a; i <= b; i++) idx.push(i % M);
      const zone = sec[a].zone;
      const asph = { pos: [], uv: [], road: [], ind: [] };
      const shoul = { pos: [], uv: [], ind: [] };
      const skirt = { pos: [], uv: [], ind: [] };
      for (let k = 0; k < idx.length; k++) {
        const q = sec[idx[k]];
        const sv = idx[k] === 0 && k > 0 ? T.length : q.s; // continuous v across the wrap
        // asphalt: 3 verts
        for (const d of [-q.hw, 0, q.hw]) {
          const p = P(q, d); asph.pos.push(...p); asph.uv.push(d, sv); asph.road.push(sv, d, q.hw, q.line);
        }
        // shoulders: per side 4 verts: edge(bottom of curb), curb top inner, curb top outer, outer
        for (const side of [-1, 1]) {
          const fall = shoulderFall(q.sh);
          const list = [[q.hw, 0], [q.hw + 0.002, q.ch], [q.hw + 0.25, q.ch], [q.hw + q.sh, q.ch - fall]];
          for (const [d, dy] of list) { const p = P(q, side * d, dy); shoul.pos.push(...p); shoul.uv.push(side * d, sv); }
          // skirt: outer edge -> down
          const o = P(q, side * (q.hw + q.sh), q.ch - fall);
          const deep = q.onBridge ? 1.5 : 0.7;
          const o2 = P(q, side * (q.hw + q.sh + 0.25), q.ch - fall - deep);
          skirt.pos.push(...o, ...o2); skirt.uv.push(0, sv, deep, sv);
        }
      }
      const n = idx.length;
      for (let k = 0; k < n - 1; k++) {
        // asphalt (3 verts per row)
        const r0 = k * 3, r1 = (k + 1) * 3;
        for (let j = 0; j < 2; j++) {
          const A = r0 + j, B = r0 + j + 1, C = r1 + j, D = r1 + j + 1;
          asph.ind.push(A, B, C, B, D, C);
        }
        // shoulders: 8 verts per row (4 left, 4 right)
        const s0 = k * 8, s1 = (k + 1) * 8;
        for (let side = 0; side < 2; side++) {
          for (let j = 0; j < 3; j++) {
            const A = s0 + side * 4 + j, B = s0 + side * 4 + j + 1, C = s1 + side * 4 + j, D = s1 + side * 4 + j + 1;
            if (side === 0) shoul.ind.push(A, C, B, B, C, D); else shoul.ind.push(A, B, C, B, D, C);
          }
        }
        // skirt: 4 verts per row
        const k0 = k * 4, k1 = (k + 1) * 4;
        skirt.ind.push(k0, k1, k0 + 1, k0 + 1, k1, k1 + 1); // left
        skirt.ind.push(k0 + 2, k0 + 3, k1 + 2, k0 + 3, k1 + 3, k1 + 2); // right
      }
      // collision triangles from the same buffers
      const addTris = (buf, type) => {
        const p = buf.pos;
        for (let t = 0; t < buf.ind.length; t += 3) {
          const i0 = buf.ind[t] * 3, i1 = buf.ind[t + 1] * 3, i2 = buf.ind[t + 2] * 3;
          this.drivable.add(p[i0], p[i0 + 1], p[i0 + 2], p[i1], p[i1 + 1], p[i1 + 2], p[i2], p[i2 + 1], p[i2 + 2], type);
        }
      };
      const bridgeChunk = sec[a].onBridge && sec[Math.min(M - 1, b - 1)].onBridge;
      addTris(asph, bridgeChunk ? SURF.BRIDGE : SURF.ASPHALT);
      addTris(shoul, shoulderSurf(zone));
      const toGeo = (buf, extra) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
        if (extra) g.setAttribute('aRoad', new THREE.Float32BufferAttribute(extra, 4));
        g.setIndex(buf.ind);
        g.computeVertexNormals();
        g.computeBoundingSphere(); g.computeBoundingBox();
        return g;
      };
      this.chunks.push({ zone, i0: a, i1: b, asphalt: toGeo(asph, asph.road), shoulder: toGeo(shoul), skirt: toGeo(skirt) });
    }
    this._buildCurbs();
    this.drivable.finalize();
    return this;
  }

  /** zebra curbs at corners, positioned by distance along the spline */
  _buildCurbs() {
    const T = this.track, M = T.M, ds = T.ds, sec = this.sec;
    const thr = 1 / 160;
    const ranges = [];
    let inC = false, start = 0, sign = 0;
    for (let i = 0; i <= M; i++) {
      const c = T.curv[i % M];
      const on = Math.abs(c) > thr;
      if (on && !inC) { inC = true; start = i; sign = Math.sign(c); }
      else if (inC && (!on || Math.sign(c) !== sign || i === M)) { inC = false; if ((i - start) * ds > 12) ranges.push({ a: start, b: i, sign }); }
    }
    this.curbRanges = [];
    for (const r of ranges) {
      if (sec[r.a % M].zone === 3) continue; // no zebras in the village street
      const inner = r.sign > 0 ? 1 : -1; // right turn -> inner side right
      const len = r.b - r.a;
      this._curbStrip(r.a - 6, r.b + 4, inner);
      this._curbStrip(r.a + Math.floor(len * 0.55), r.b + 22, -inner);
      this.curbRanges.push({ s0: (r.a - 6) * ds, s1: (r.b + 4) * ds, side: inner }, { s0: (r.a + Math.floor(len * 0.55)) * ds, s1: (r.b + 22) * ds, side: -inner });
    }
  }
  _curbStrip(a, b, side) {
    const T = this.track, M = T.M, sec = this.sec;
    const pos = [], uv = [], ind = [];
    const prof = [[-0.8, 0.0], [-0.62, 0.035], [0.25, 0.035], [0.42, 0.005]]; // relative to edge (d = hw + x*side)
    let n = 0;
    for (let i = a; i <= b; i++) {
      const q = sec[((i % M) + M) % M];
      if (q.onBridge || q.zone === 3) break;
      const ramp = Math.min(1, (i - a) / 3, (b - i) / 3);
      for (const [x, h] of prof) {
        const d = side * (q.hw + x);
        const dd = d / q.cb;
        pos.push(q.x + q.rbx * dd, q.y + q.rby * dd + h * Math.max(0, ramp) + 0.004, q.z + q.rbz * dd);
        uv.push((x + 0.8) / 1.22, i * T.ds);
      }
      n++;
    }
    if (n < 2) return;
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < 3; j++) {
      const A = k * 4 + j, B = A + 1, C = A + 4, D = C + 1;
      if (side > 0) ind.push(A, B, C, B, D, C); else ind.push(A, C, B, B, C, D);
    }
    for (let t = 0; t < ind.length; t += 3) {
      const i0 = ind[t] * 3, i1 = ind[t + 1] * 3, i2 = ind[t + 2] * 3;
      this.drivable.add(pos[i0], pos[i0 + 1], pos[i0 + 2], pos[i1], pos[i1 + 1], pos[i1 + 2], pos[i2], pos[i2 + 1], pos[i2 + 2], SURF.CURB);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind); g.computeVertexNormals(); g.computeBoundingSphere();
    this.curbs.push(g);
  }
}
