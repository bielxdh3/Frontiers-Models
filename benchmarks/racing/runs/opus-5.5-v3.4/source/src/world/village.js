// Village (Z3) layout derived from the spline: house rows on both sides of the
// street, church + bell tower on the plaza, paved plaza with fountain, trees,
// benches and cafe tables. Pure data (rendering in render/villageRender.js).
import { obbOverlap } from './validate.js';
import { EXCLUSION } from './profile.js';
import { TINT, yawAlong } from './scatter.js';

export function layoutVillage(S) {
  const T = S.T, R = S.rng, W = S.world;
  const F = T.features;
  const houses = [];
  const fronts = []; // {s0, s1, side} spans covered by house fronts (no street wall there)
  const v0 = F.village.s0 + 18, v1 = v0 + T.delta(v0, F.village.s1) - 22;
  const plaza = F.plaza;
  for (const side of [-1, 1]) {
    let s = v0 + R.range(0, 4);
    while (s < v1) {
      const Wd = R.range(6.5, 10.5);
      const sc = s + Wd / 2;
      if (side === plaza.side && T.inRange(sc, plaza.s0 - 6, plaza.s1 + 6)) { s = plaza.s1 + 7; continue; }
      const fr = T.frame(sc, {});
      const hw = fr.w / 2;
      const front = hw + 4.6 + R.range(0, 0.5);
      const D = R.range(6.5, 9.0);
      // local frame: +x along street, +z away from road
      let tx = fr.tx, tz = fr.tz; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      const ax = side > 0 ? tx : -tx, az = side > 0 ? tz : -tz; // local +x
      const nx = -az, nz = ax; // local +z = rotate(+x) ... (-sx, cx)
      // origin = front-left corner (local x=0,z=0)
      const cxw = fr.x + fr.rx * side * front, czw = fr.z + fr.rz * side * front;
      const ox = cxw - ax * Wd / 2, oz = czw - az * Wd / 2;
      // centre of footprint
      const mx = ox + ax * Wd / 2 + nx * D / 2, mz = oz + az * Wd / 2 + nz * D / 2;
      const obb = { cx: mx, cz: mz, hx: Wd / 2, hz: D / 2, ang: Math.atan2(az, ax) };
      const corners = [[0, 0], [Wd, 0], [0, D], [Wd, D]].map(([u, w]) => [ox + ax * u + nx * w, oz + az * u + nz * w]);
      let ok = true;
      for (const [x, z] of corners) if (S.edgeClear(x, z, 0) < EXCLUSION + 0.5) { ok = false; break; }
      const g = corners.map(([x, z]) => S.ground(x, z));
      const gmin = Math.min(...g), gmax = Math.max(...g);
      if (gmax - gmin > 0.5) ok = false;
      if (ok) for (const h of houses) if (obbOverlap(h.obb, obb)) { ok = false; break; }
      if (ok) {
        const y = (gmin + gmax) / 2;
        const style = Math.floor(R.float() * 6);
        const yaw = Math.atan2(az, ax);
        houses.push({ x: ox, y, z: oz, yaw, W: Wd, D, style, seed: Math.floor(R.float() * 1e9), obb, s: sc, side, front });
        fronts.push({ s0: sc - Wd / 2 - 0.3, s1: sc + Wd / 2 + 0.3, side });
        W.placed.push({ kind: 'house', name: 'house-' + style, x: mx, z: mz, radius: 0, baseY: y, obb, footprint: corners, plinth: 0.3, style });
        // bollards in front (match the street collider line) + planters / benches / cafe tables
        for (let u = 0.8; u < Wd - 0.5; u += 1.7) {
          const bx = ox + ax * u - nx * (front - hw - 3.3), bz = oz + az * u - nz * (front - hw - 3.3);
          S.place('prop', 'bollard', bx, bz, { radius: 0.15, minEdge: EXCLUSION, maxSlope: 1.2, gap: 0.05 });
        }
        const pr = R.float();
        const px = ox + ax * (Wd * R.range(0.2, 0.8)) - nx * 0.75, pz = oz + az * (Wd * R.range(0.2, 0.8)) - nz * 0.75;
        if (pr < 0.4) S.place('prop', 'planter', px, pz, { radius: 0.5, maxSlope: 1.2, gap: 0.1 });
        else if (pr < 0.6) S.place('prop', 'bench', px, pz, { radius: 0.95, rot: yaw, maxSlope: 1.2, gap: 0.1 });
        else if (pr < 0.8) S.place('prop', 'cafe', px - nx * 0.1, pz - nz * 0.1, { radius: 0.95, rot: yaw, maxSlope: 1.2, gap: 0.1 });
        else S.place('prop', 'barrel', px, pz, { radius: 0.35, maxSlope: 1.2, gap: 0.1 });
        if (R.chance(0.5)) { const qx = ox + ax * (Wd - 0.6) - nx * 0.6, qz = oz + az * (Wd - 0.6) - nz * 0.6; S.place('prop', 'planter', qx, qz, { radius: 0.5, maxSlope: 1.2, gap: 0.1 }); }
        // garden trees behind gaps
        s += Wd + R.range(0.8, 3.0);
      } else s += 2.0;
    }
  }
  // garden trees / cypresses behind the rows
  for (const h of houses) {
    if (R.chance(0.45)) {
      const gx = h.x + Math.cos(h.yaw) * (h.W + 1.6) - Math.sin(h.yaw) * (h.D * 0.6), gz = h.z + Math.sin(h.yaw) * (h.W + 1.6) + Math.cos(h.yaw) * (h.D * 0.6);
      S.place('tree', R.chance(0.5) ? 'cypress' : 'olive', gx, gz, { radius: 0.5, rot: R.range(0, 6.28), scale: R.range(0.8, 1.1), color: TINT(R, 0xffffff, 0.2), maxSlope: 0.8, gap: 0.3 });
    }
  }
  // ---- plaza + church
  const ps0 = plaza.s0 + 6, ps1 = ps0 + T.delta(ps0, plaza.s1) - 12;
  const cs = F.church.s;
  const cfr = T.frame(cs, {});
  let tx = cfr.tx, tz = cfr.tz; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
  const side = F.church.side;
  const ax = side > 0 ? tx : -tx, az = side > 0 ? tz : -tz, nx = -az, nz = ax;
  const hw = cfr.w / 2;
  const churchFront = hw + F.church.offset;
  const cW = 13, cD = 22;
  const cox = cfr.x + cfr.rx * side * churchFront - ax * cW / 2, coz = cfr.z + cfr.rz * side * churchFront - az * cW / 2;
  const cmx = cox + ax * cW / 2 + nx * cD / 2, cmz = coz + az * cW / 2 + nz * cD / 2;
  const cg = S.ground(cmx, cmz);
  const church = { x: cox, y: cg, z: coz, yaw: Math.atan2(az, ax), W: cW, D: cD, tower: { u: cW + 0.5, w: 5.5, h: 30 } };
  const cobb = { cx: cmx + ax * 2.5, cz: cmz + az * 2.5, hx: cW / 2 + 3, hz: cD / 2, ang: Math.atan2(az, ax) };
  W.placed.push({ kind: 'house', name: 'church', x: cobb.cx, z: cobb.cz, radius: 0, baseY: cg, obb: cobb, footprint: [[cox, coz], [cox + ax * cW, coz + az * cW], [cox + nx * cD, coz + nz * cD], [cox + ax * cW + nx * cD, coz + az * cW + nz * cD]], plinth: 0.3, style: 'church' });
  houses.push({ church: true, obb: cobb });
  // plaza paving region + furniture (between street and church)
  const plazaInfo = { s0: ps0, s1: ps1, side, d0: hw + 3.3, d1: churchFront - 0.5 };
  const fcS = cs, fcD = (plazaInfo.d0 + plazaInfo.d1) / 2 + 2;
  const fc = T.point(fcS, side * fcD);
  plazaInfo.fountain = { x: fc[0], z: fc[2], y: S.ground(fc[0], fc[2]), r: 3.2 };
  W.placed.push({ kind: 'prop', name: 'fountain', x: fc[0], z: fc[2], radius: 3.2, baseY: plazaInfo.fountain.y, footprint: [[fc[0], fc[2]]] });
  // block the fountain spot in the scatter hash
  S.items.push({ cat: 'block', x: fc[0], z: fc[2], radius: 3.4 }); S.hash.set(S._key(Math.floor(fc[0] / S.cell), Math.floor(fc[2] / S.cell)), [...(S.hash.get(S._key(Math.floor(fc[0] / S.cell), Math.floor(fc[2] / S.cell))) || []), { x: fc[0], z: fc[2], radius: 3.4 }]);
  for (let s = ps0 + 3; s < ps1 - 2; s += 9) {
    for (const d of [plazaInfo.d0 + 4.5, plazaInfo.d1 - 4]) {
      const [x, z] = S.at(s + R.range(-1, 1), side * d);
      S.place('tree', R.chance(0.6) ? 'olive' : 'cypress', x, z, { radius: 0.5, rot: R.range(0, 6.28), scale: R.range(0.9, 1.2), color: TINT(R, 0xffffff, 0.15), maxSlope: 0.5, gap: 1 });
    }
    const [bx, bz] = S.at(s + 4.5, side * (plazaInfo.d0 + 8));
    S.place('prop', 'bench', bx, bz, { radius: 0.95, rot: yawAlong(T, s) + (side > 0 ? 0 : Math.PI), maxSlope: 0.5, gap: 0.2 });
    const [lx, lz] = S.at(s, side * (plazaInfo.d0 + 1.2));
    S.place('prop', 'lamp', lx, lz, { radius: 0.25, rot: Math.atan2(-cfr.rz * -side, cfr.rx * -side) * 0, maxSlope: 0.5 });
  }
  for (let k = 0; k < 7; k++) {
    const [x, z] = S.at(ps0 + R.range(4, T.delta(ps0, ps1) - 4), side * R.range(plazaInfo.d0 + 10, plazaInfo.d1 - 6));
    S.place('prop', 'cafe', x, z, { radius: 1.0, rot: R.range(0, 6.28), maxSlope: 0.5, gap: 0.6 });
  }
  for (let k = 0; k < 6; k++) {
    const [x, z] = S.at(ps0 + R.range(2, T.delta(ps0, ps1) - 2), side * R.range(plazaInfo.d0 + 3, plazaInfo.d1 - 2));
    S.place('prop', 'planter', x, z, { radius: 0.55, maxSlope: 0.5, gap: 0.5 });
  }
  W.village = { houses: houses.filter((h) => !h.church), church, plaza: plazaInfo, fronts };
  return W.village;
}
