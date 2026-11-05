// Test / verification harness (used by tools/verify.mjs through window.__game.harness).
// Everything here drives the real game: real races, real physics, real cameras.
// Screenshot camera positions S1–S12 are defined here so they are reproducible.
import * as THREE from 'three';
import { loadedTextures } from '../render/textures.js';
import { countTris } from '../car/carModel.js';

const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

export class Harness {
  constructor(G) { this.G = G; }

  async frames(n) { for (let i = 0; i < n; i++) await raf(); }
  /** wait for simulated time (fixed 120 Hz steps): the same car positions on any machine / frame rate */
  async simWait(seconds) {
    const sim = this.G.sim, t0 = sim.time;
    let guard = 0;
    while (sim.time - t0 < seconds - 1e-6 && guard++ < 100000) {
      await raf();
      // a teleported car settles on its springs in its first ~0.3 s: puffs from that are not gameplay
      if (this._placedAt != null && sim.time - this._placedAt > 0.3) { this.G.particles.clear(); this._placedAt = null; }
    }
    await raf();
  }

  /** start a race directly (used after the UI journey tests, for shots / sweep / perf) */
  quickRace(cfg = {}) {
    const G = this.G;
    G.flow.clear();
    G.startRace({ laps: 3, difficulty: 'normal', spec: 'gt', livery: 0, ...cfg });
    return G.race;
  }
  /** skip intro + countdown: race running now */
  goNow() {
    const G = this.G, R = G.race;
    if (R.state === 'intro' || R.state === 'countdown') { R.go(); G.flow.hideIntro(); G.hud.visible = true; G.camCtl.reset(); }
    R.messages.length = 0;
  }
  /** place car i at (s, d) with speed v along the track; keeps race bookkeeping consistent */
  place(i, s, d, v) {
    const G = this.G;
    G.teleport(i, s, d, v);
    G.particles.clear(); // no smoke left hanging where the cars were before
    this._placedAt = G.sim.time; // and again once the placed cars have settled (see simWait)
    const e = G.race && G.race.E[i];
    if (e) e.lastS = G.sim.progress[i].s;
  }
  autopilotAll(on = true) {
    const G = this.G;
    G.setAutopilot(on);
  }

  // ---------------------------------------------------------------- race monitor (tests 5 / 6), per physics step
  monitorStart() {
    const G = this.G, sim = G.sim;
    this.monitorStop();
    const M = this.mon = { cars: sim.cars.map(() => ({ stopRun: 0, offRun: 0, maxStop: 0, maxOff: 0, maxStopAt: 0, maxOffAt: 0 })), overtakes: [], stable: null, cand: null, candT: 0, t: 0, inv0: sim.invariantEvents.length, cam0: G.camCtl.insideGeometry, log0: sim.log.length };
    this._monPrev = sim.onStep;
    sim.onStep = (dt) => { if (this._monPrev) this._monPrev(dt); this._monStep(dt); };
    return true;
  }
  monitorStop() { if (this.mon && this._monPrev !== undefined) { this.G.sim.onStep = this._monPrev; this._monPrev = undefined; } }
  _monStep(dt) {
    const G = this.G, sim = G.sim, M = this.mon, R = G.race;
    if (!R || R.state !== 'running') return;
    M.t += dt;
    for (let i = 1; i < sim.cars.length; i++) {
      const c = sim.cars[i], pr = sim.progress[i], m = M.cars[i];
      if (R.E[i] && R.E[i].finished) { m.stopRun = 0; m.offRun = 0; continue; }
      m.stopRun = c.speed < 1.0 ? m.stopRun + dt : 0;
      m.offRun = Math.abs(pr.d || 0) > (pr.hw || 5) + 0.4 ? m.offRun + dt : 0;
      if (m.stopRun > m.maxStop) { m.maxStop = m.stopRun; m.maxStopAt = R.clock; }
      if (m.offRun > m.maxOff) { m.maxOff = m.offRun; m.maxOffAt = R.clock; }
    }
    // AI-vs-AI overtakes: compare orders that held for >= 2 s
    const order = R.standings().filter((e) => !e.isPlayer).map((e) => e.i).join(',');
    if (order !== M.cand) { M.cand = order; M.candT = 0; } else M.candT += dt;
    if (M.candT >= 2 && order !== M.stable) {
      if (M.stable) {
        const a = M.stable.split(',').map(Number), b = order.split(',').map(Number);
        for (let x = 0; x < a.length; x++) for (let y = x + 1; y < a.length; y++) if (b.indexOf(a[x]) > b.indexOf(a[y])) M.overtakes.push({ t: +R.clock.toFixed(1), by: a[y], on: a[x] });
      }
      M.stable = order;
    }
  }
  monitorReport() {
    const G = this.G, sim = G.sim, M = this.mon; if (!M) return null;
    return {
      simSeconds: +M.t.toFixed(1),
      ai: M.cars.slice(1).map((m, k) => ({ car: k + 1, maxStoppedS: +m.maxStop.toFixed(2), maxStoppedAt: +m.maxStopAt.toFixed(1), maxOffTrackS: +m.maxOff.toFixed(2), maxOffTrackAt: +m.maxOffAt.toFixed(1) })),
      aiOvertakes: M.overtakes.length, overtakeList: M.overtakes.slice(0, 30),
      invariantEvents: sim.invariantEvents.length - M.inv0, invariantList: sim.invariantEvents.slice(M.inv0, M.inv0 + 10),
      cameraInsideGeometry: G.camCtl.insideGeometry - M.cam0,
      resets: sim.log.slice(M.log0),
    };
  }

  fpsWindow(frames = 90) { const a = this.G.frameTimes.slice(-frames); return a.length / a.reduce((x, y) => x + y, 0); }

  // ---------------------------------------------------------------- sky fraction from the depth buffer
  skyFraction() { return this.G.R.post.skyFraction(); }

  // ---------------------------------------------------------------- screenshots S1–S12
  sunAlignedS(ranges) {
    const T = this.G.world.track, sd = this.G.R.sunDir; const l = Math.hypot(sd.x, sd.z);
    let best = null;
    for (const [a, b] of ranges) for (let s = a; s <= b; s += 5) {
      const f = T.frame(s, {}); const d = (f.tx * sd.x + f.tz * sd.z) / (Math.hypot(f.tx, f.tz) * l);
      if (!best || d > best.d) best = { s, d };
    }
    return best;
  }
  /** arrange shot `id`; returns { hud } — the verifier then waits and captures */
  async shot(id) {
    const G = this.G, T = G.world.track, F = T.features;
    G.camMode = null; G.camCtl.mode = 'chase';
    if (id !== 's10' && G.settings.quality !== 'alta') G.applyQuality('alta');
    G.scatterR.field.distScale = G.R.quality.vegDist;
    const race = () => { this.quickRace({ laps: 3, difficulty: 'normal', spec: 'gt', livery: 0 }); this.goNow(); G.setAutopilot(true); };
    // AI pack strictly ahead of s0 (nobody spawns behind the chase camera)
    const pack = (s0, gap = 10, lat = 2.6, v = 30, first = 1) => { for (let i = first; i < G.sim.cars.length; i++) this.place(i, s0 + (G.sim.cars.length - 1 - i) * gap, i % 2 ? lat : -lat, v); };
    switch (id) {
      case 's1': { // beach straight at speed, sun ahead
        race();
        const b = this.sunAlignedS([[2860, 3250], [10, 250]]);
        this.place(0, b.s - 40, -1.2, 46);
        this.place(1, b.s - 8, 2.6, 47); this.place(2, b.s + 10, -2.4, 47);
        for (let i = 3; i < 6; i++) this.place(i, b.s - 70 - i * 12, i % 2 ? 2.6 : -2.6, 44);
        await this.simWait(1.0);
        return { hud: true };
      }
      case 's2': { // car on the grid, low 3/4 front, no HUD
        this.quickRace({ laps: 3, difficulty: 'normal', spec: 'gt', livery: 0 });
        G.flow.clear(); G.race.phaseT = 0; G.race.update = () => {}; // freeze in pre-start (grid)
        await this.simWait(0.25);
        const car = G.sim.cars[0]; const r = car.right(new THREE.Vector3()), sd = G.R.sunDir;
        const side = r.x * sd.x + r.z * sd.z > 0 ? 1 : -1;
        G.carCamera(0, side * 2.6, 0.55, 4.2, 0.45, 0, 42);
        G.hud.visible = false;
        await this.simWait(0.125);
        return { hud: false };
      }
      case 's3': { // low camera on wet sand: foam around rocks
        race();
        pack(F.startS + 120, 12, 2.6, 34, 0);
        await this.simWait(0.375);
        const rk = this.rockShot();
        await this.simWait(0.25);
        return { hud: true, info: rk };
      }
      case 's4': { // serpentine with the sea below: viewpoint (mirante) or hillside camera above the road
        race();
        this.place(0, 1010, 0, 15); pack(1040, 12, 2.4, 15, 1);
        await this.simWait(1.2);
        let v = await this.serpentineShot();
        if (v) {
          this.place(0, v.sCars, 0, 13); pack(v.sCars + 14, 11, 2.2, 13, 1); // the race inside the frame
          G.setCam(...v.cam, v.fov); // (teleport resets the camera mode)
          await this.simWait(0.6);
          const info = { ...v }; delete info.cam;
          return { hud: true, info };
        }
        v = this.miranteShot();
        if (!v) {
          v = await this.cliffShot();
          if (v) { // bring the race into this stretch, then let it drive into the frame
            this.place(0, v.s - 45, 0, 15); pack(v.s - 20, 9, 2.4, 15, 1); // (teleport resets the camera mode)
            G.setCam(...v.cam, 55);
            await this.simWait(1.4);
          }
        }
        if (!v) { this.place(0, 1088, 0, 17); pack(1112, 11, 2.4, 17, 1); await this.simWait(1.875); return { hud: true, info: 'chase' }; }
        await this.simWait(0.3);
        return { hud: true, info: v };
      }
      case 's5': case 's10': { // village street with the church tower
        if (id === 's10') G.applyQuality('baixa');
        race();
        // the church tower (village landmark) must be in frame, clear of the HUD panels and not hidden by houses
        const sCar = this.towerVisibleS();
        this.place(0, sCar - 8, 0, 18); pack(sCar + 14, 10, 2.4, 18, 1);
        await this.simWait(0.45);
        return { hud: true, info: { sCar, tower: this.towerInFrame() } };
      }
      case 's6': { // forest with grazing sun
        race();
        this.place(0, 2600, 0, 22); pack(2620, 11, 2.4, 22, 1);
        await this.simWait(1.375);
        return { hud: true };
      }
      case 's7': { // bridge entrance tied to the terrain
        race();
        const b = F.bridge;
        this.place(0, b.s0 - 10, 0, 22); pack(b.s0 + 6, 9, 2.4, 22, 1);
        await this.simWait(0.375);
        const cam = await this.bridgeShot();
        await this.simWait(0.375);
        return { hud: true, info: cam };
      }
      case 's8': { // side by side with 2+ AIs
        race();
        const s0 = 3000;
        this.place(0, s0, 0, 40); this.place(1, s0 + 1.5, -3.6, 40); this.place(2, s0 + 3, 3.6, 40); this.place(3, s0 + 14, 0.5, 40);
        this.place(4, s0 - 30, -2, 38); this.place(5, s0 - 45, 2, 38);
        // keep the trio abreast: same driver skill, line offsets held
        for (const i of [1, 2]) { const d = G.sim.drivers[i]; if (d) { d.lateralTarget = (i === 1 ? -3.6 : 3.6) - G.world.racingLine.offsetAt(s0); d.lateral = d.lateralTarget; d.overtakeTimer = 99; } }
        const d0 = G.sim.drivers[0]; if (d0) { d0.lateralTarget = -G.world.racingLine.offsetAt(s0); d0.lateral = d0.lateralTarget; d0.overtakeTimer = 99; }
        await this.simWait(0.562);
        return { hud: true };
      }
      case 's9': { // close-up: asphalt, curb, guardrail
        race();
        const s = this.curbAndRail();
        this.place(0, s.s - 60, 0, 14); pack(s.s - 30, 9, 2.4, 14, 1);
        await this.simWait(0.375);
        const T2 = G.world.track;
        const p = T2.point(s.s, s.side * (s.hw - 1.0)), q = T2.point(s.s + 15, s.side * (s.hw + 0.4));
        G.setCam(p[0], p[1] + 0.6, p[2], q[0], q[1] + 0.35, q[2], 62);
        await this.simWait(0.188);
        return { hud: true, info: s };
      }
      case 's11': { // car stopped next to a house door
        race();
        const h = this.houseNearRoad();
        this.place(0, h.s, h.side * (h.hw - 1.4), 0);
        G.sim.cars[0].frozen = true;
        pack(h.s - 80, 12, 2.4, 14, 1);
        await this.simWait(0.375);
        const p = T.point(h.s - 9, -h.side * (h.hw - 0.8));
        const q = T.point(h.s + 1.0, h.side * (h.hw + 2.5));
        const g = G.world.groundHeight(p[0], p[2], p[1] + 5);
        G.setCam(p[0], g + 1.35, p[2], q[0], q[1] + 1.6, q[2], 50);
        await this.simWait(0.188);
        return { hud: true, info: h };
      }
      case 's12': { // whole lap from above (vegetation is distance-culled at ~1 km: lift the limit for the map view)
        race();
        G.setCameraMode('top');
        G.scatterR.field.distScale = 12;
        await this.simWait(0.375);
        return { hud: true };
      }
    }
    throw new Error('unknown shot ' + id);
  }
  curbAndRail() {
    // where a guardrail run ends and a zebra curb begins on the same side (both in one low frame)
    const W = this.G.world, T = W.track, runs = (W.barriers.runs || []).filter((r) => r.type === 'guardrail');
    let best = null;
    for (const c of W.road.curbRanges || []) {
      if (T.zoneAt(T.wrap((c.s0 + c.s1) / 2)) !== 2) continue;
      for (const r of runs) {
        if (r.side !== c.side) continue;
        const r0 = r.i0 * r.step, r1 = r.i1 * r.step;
        const gap = c.s0 - r1; // rail ends, curb starts
        if (gap < -25 || gap > 12) continue;
        const sCam = Math.max(r0 + 4, Math.min(r1, c.s0) - 12);
        const fr = T.frame(sCam, {});
        const score = -Math.abs(gap + 6);
        if (!best || score > best.score) best = { s: sCam, side: c.side, hw: fr.w / 2, score, rail: [r0, r1], curb: [c.s0, c.s1] };
      }
    }
    return best || { s: 700, side: 1, hw: 5 };
  }
  /** is the church tower (top + belfry) inside the frame of `cam` (clear of the HUD panels) and unoccluded? */
  _towerTest(cam, pos, look) {
    const G = this.G, ch = G.world.village && G.world.village.church;
    if (!ch || !ch.towerTop || !ch.bellPos) return null;
    cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const top = new THREE.Vector3(...ch.towerTop);
    // occlusion: a ray against the real village meshes (houses, church walls), stopping just short of the tower
    const rc = this._rc || (this._rc = new THREE.Raycaster());
    for (const p of [top, top.clone().add(new THREE.Vector3(0, -5, 0))]) {
      const q = p.clone().project(cam);
      if (q.z > 1 || q.x < -0.58 || q.x > 0.55 || q.y < -0.5 || q.y > 0.62) return false;
      const dir = p.clone().sub(pos); const dist = dir.length(); dir.normalize();
      rc.set(pos, dir); rc.near = 0.5; rc.far = dist - 4.0;
      if (rc.intersectObject(G.village, true).length) return false;
      for (let k = 1; k < 60; k++) { const t = k / 60; const x = pos.x + dir.x * dist * t, y = pos.y + dir.y * dist * t, z = pos.z + dir.z * dist * t; if (G.world.groundHeight(x, z, y + 2) > y) return false; }
    }
    return true;
  }
  /** car arc length whose chase camera sees the tower (camera 6 m behind, look 5 m ahead) */
  towerVisibleS() {
    const G = this.G, T = G.world.track, cam = new THREE.PerspectiveCamera(63, G.camera.aspect, 0.15, 3000);
    for (let s = 1430; s <= 1585; s += 3) {
      const a = T.point(s - 6, 0), b = T.point(s + 5, 0);
      if (this._towerTest(cam, new THREE.Vector3(a[0], a[1] + 2.3, a[2]), new THREE.Vector3(b[0], b[1] + 1.45, b[2]))) return s;
    }
    return 1520;
  }
  /** where the tower top lands in the final frame (normalised device coordinates, -1..1) */
  towerInFrame() {
    const ch = this.G.world.village.church; if (!ch || !ch.towerTop) return null;
    const q = new THREE.Vector3(...ch.towerTop).project(this.G.camera);
    return { ndcX: +q.x.toFixed(2), ndcY: +q.y.toFixed(2), inFrame: Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1 };
  }

  /** high camera above the serpentine, looking down over the hairpin legs to the beach and the sea */
  async serpentineShot() {
    const G = this.G, T = G.world.track, cam = new THREE.PerspectiveCamera(50, G.camera.aspect, 0.5, 6000);
    const samples = []; for (let s = 430; s <= 1400; s += 8) { const f = T.frame(s, {}); samples.push([s, new THREE.Vector3(f.x, f.y + 0.6, f.z)]); }
    let cx = 0, cy = 0, cz = 0; for (const [, p] of samples) { cx += p.x; cy += p.y; cz += p.z; } cx /= samples.length; cy /= samples.length; cz /= samples.length;
    const fr = new THREE.Frustum(), m = new THREE.Matrix4();
    const cands = [];
    for (const sC of [1390, 1340, 1300, 1250, 1180, 1120]) for (const off of [25, 45, 70]) for (const side of [-1, 1]) for (const up of [22, 38, 60]) {
      const p = T.point(sC, side * off), f = T.frame(sC, {});
      const g = G.world.groundHeight(p[0], p[2], 1e4);
      const pos = new THREE.Vector3(p[0], Math.max(g + 3, f.y + up), p[2]);
      if (G.camCtl._insideHouse(pos, 1)) continue;
      // aim at the serpentine centre pushed towards the sea (+z), never steeper than ~25 deg (sky + sea in frame)
      const tgt = new THREE.Vector3(cx, cy - 8, cz + 40);
      const dir = tgt.clone().sub(pos); const dl = dir.length(); dir.normalize();
      if (dir.y < -0.42) { dir.y = -0.42; dir.normalize(); }
      const look = pos.clone().addScaledVector(dir, dl);
      cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      fr.setFromProjectionMatrix(m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      let n = 0; const legs = new Set(); let sFirst = Infinity;
      for (const [s, q] of samples) {
        if (!fr.containsPoint(q)) continue;
        if (G.camCtl._clearance(q, pos) < 0.96) continue;
        n++; legs.add(s < 597 ? 1 : s < 889 ? 2 : s < 1181 ? 3 : 4);
        if (s > 640 && s < sFirst) sFirst = s;
      }
      cands.push({ pos, look, n, legs: legs.size, sFirst, score: n + legs.size * 25 });
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands.slice(0, 8)) {
      if (c.legs < 2) break;
      G.setCam(c.pos.x, c.pos.y, c.pos.z, c.look.x, c.look.y, c.look.z, 50);
      await this.frames(3);
      const sky = this.skyFraction();
      if (sky >= 0.14) return { cam: [c.pos.x, c.pos.y, c.pos.z, c.look.x, c.look.y, c.look.z], fov: 50, visibleSamples: c.n, legs: c.legs, sky: +sky.toFixed(3), sCars: isFinite(c.sFirst) ? c.sFirst : 760 };
    }
    return null;
  }
  miranteShot() {
    // standing at the viewpoint balustrade, looking down over the hairpins to the beach and the sea
    const G = this.G, T = G.world.track, M = T.features.mirante;
    if (!M) return null;
    const fr = T.frame(M.s, {});
    const base = T.point(M.s, M.side * (fr.w / 2 + M.depth * 0.55));
    const gy = G.world.groundHeight(base[0], base[2], base[1] + 5);
    const pos = new THREE.Vector3(base[0], Math.max(gy, base[1]) + 1.65, base[2]);
    let best = null;
    for (const sT of [1000, 960, 1060, 900, 1120]) {
      const q = T.point(sT, 0);
      const tgt = new THREE.Vector3(q[0], q[1] + 1, q[2]);
      const clear = G.camCtl._clearance(tgt, pos);
      if (clear >= 0.98) { best = { sT, tgt }; break; }
    }
    if (!best) return null;
    // aim a little above the hairpin so the beach, the sea and the horizon share the frame
    const dir = best.tgt.clone().sub(pos); const L = dir.length();
    const look = pos.clone().addScaledVector(dir.normalize(), L).add(new THREE.Vector3(0, L * 0.16, 0));
    G.setCam(pos.x, pos.y, pos.z, look.x, look.y, look.z, 50);
    return { s: best.sT };
  }
  async cliffShot() {
    // from the hillside above the serpentine, looking across the road and down to the sea
    const G = this.G, T = G.world.track, runs = (G.world.barriers.runs || []).filter((r) => r.type === 'guardrail' && T.zoneAt(r.i0 * r.step + 2) === 2);
    for (const r of runs) {
      const sMid = (r.i0 + r.i1) * r.step / 2;
      for (const off of [28, 40, 55]) for (const up of [10, 16]) for (const ds of [0, -25, 25]) {
        const s = sMid + ds, fr = T.frame(s, {});
        const p = T.point(s, -r.side * off);
        const g = G.world.groundHeight(p[0], p[2], 1e4);
        const pos = new THREE.Vector3(p[0], Math.max(g + 2.5, fr.y + up), p[2]);
        const q = T.point(s + 10, r.side * 35);
        const tgt = new THREE.Vector3(q[0], fr.y - 6, q[2]);
        if (G.camCtl._clearance(new THREE.Vector3(fr.x, fr.y + 1, fr.z), pos) < 0.98) continue;
        G.setCam(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, 55);
        await this.frames(3);
        const sky = this.skyFraction();
        if (sky >= 0.15) return { cliff: true, s: +s.toFixed(0), off, up, sky: +sky.toFixed(3), cam: [pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z] };
      }
    }
    return null;
  }
  rockShot() {
    // low camera on the wet sand: rocks + foam, sun from the side, horizon in frame
    const G = this.G, W = G.world;
    const rocks = (W.scatter.foamStamps || []).filter(([x, z, r]) => x > -160 && x < 240 && r > 0.9 && W.terrain.heightAt(x, z) < -0.1).sort((a, b) => b[2] - a[2]);
    const sd = G.R.sunDir; const l = Math.hypot(sd.x, sd.z), sx = sd.x / l, sz = sd.z / l;
    const T = W.terrain;
    for (const [x, z, r] of rocks.slice(0, 16)) {
      for (const sgn of [1, -1]) for (const along of [12, 18, 26]) {
        const px = x + sgn * along; const pz = T.coastZ(px) - 1.2; // just above the swash line
        const gh = T.heightAt(px, pz); if (gh < 0.02 || gh > 0.9) continue;
        const vx = x - px, vz = z - pz, vl = Math.hypot(vx, vz);
        const cosA = (vx * sx + vz * sz) / vl;
        if (cosA > 0.6 || cosA < -0.5) continue; // sun from the side
        G.setCam(px, gh + 1.15, pz, x, 0.1, z, 55);
        return [x, z, r, +cosA.toFixed(2)];
      }
    }
    return G.rockCam(-150, 200, 10, 0.9);
  }
  async bridgeShot() {
    // elevated side view (broadcast camera): the whole arch bridge, the ravine, the road running
    // into the terrain on both banks, and the horizon. Candidates are tried in a fixed order and the
    // first one with the sky in frame is kept (deterministic for a given world).
    const G = this.G, T = G.world.track, b = T.features.bridge;
    const mid = T.wrap((b.s0 + b.s1) / 2), fr = T.frame(mid, {});
    const sd = G.R.sunDir;
    const sunSide = (fr.rx * sd.x + fr.rz * sd.z) > 0 ? 1 : -1;
    let fallback = null;
    for (const side of [sunSide, -sunSide]) for (const off of [150, 120, 185]) for (const ds of [0, -45, 45]) for (const up of [9, 15]) {
      const p = T.point(mid + ds, side * off);
      const g = G.world.groundHeight(p[0], p[2], 1e4);
      const pos = new THREE.Vector3(p[0], Math.max(g + 8, fr.y + up), p[2]);
      const target = new THREE.Vector3(fr.x, fr.y + 1.5, fr.z);
      if (G.camCtl._clearance(new THREE.Vector3(fr.x, fr.y - 3, fr.z), pos) < 0.98) continue;
      G.setCam(pos.x, pos.y, pos.z, target.x, target.y, target.z, 42);
      await this.frames(3);
      const sky = this.skyFraction();
      if (!fallback) fallback = { side, off, ds, up, sky };
      if (sky >= 0.16) return { side, off, ds, up, sky: +sky.toFixed(3) };
    }
    if (fallback) { const p = T.point(mid + fallback.ds, fallback.side * fallback.off); const g = G.world.groundHeight(p[0], p[2], 1e4); G.setCam(p[0], Math.max(g + 8, fr.y + fallback.up), p[2], fr.x, fr.y + 1.5, fr.z, 42); return { ...fallback, fallback: true }; }
    G.trackCam(b.s0 - 14, -9.5, 1.6, 40, -1, 0, 64);
    return { fallback: 'trackCam' };
  }
  houseNearRoad() {
    const W = this.G.world, T = W.track;
    let best = null;
    for (const h of W.village.houses) {
      if (!h.obb) continue;
      const o = T.project(h.obb.cx, h.obb.cz, {});
      const fr = T.frame(o.s, {});
      const dist = Math.abs(o.d) - Math.max(h.obb.hx, h.obb.hz);
      if (Math.abs(fr.curv) > 0.01) continue;
      if (!best || dist < best.dist) best = { s: o.s, side: Math.sign(o.d), hw: fr.w / 2, dist };
    }
    return best;
  }

  // ---------------------------------------------------------------- sweep (chase camera every 25 m)
  async sweepPrepare() {
    this.quickRace({ laps: 3, difficulty: 'normal', spec: 'gt', livery: 0 });
    this.goNow(); this.G.setAutopilot(true);
    for (let i = 1; i < this.G.sim.cars.length; i++) this.place(i, 50 + i * 500, 0, 20);
  }
  async sweepAt(s) {
    const G = this.G, line = G.world.racingLine;
    this.place(0, s - 18, line.offsetAt(s - 18) * 0.6, Math.min(30, line.speedAt(s) * 0.8));
    await this.simWait(0.33);
    G.R.post.snapExposure(); // camera cut: exposure jumps instead of fading in
    await this.frames(3);
    return { s, sky: this.skyFraction(), inside: G.camCtl.insideGeometry };
  }

  // ---------------------------------------------------------------- perf (Z3 with 5 AIs)
  async perfRun(quality, seconds = 15) {
    const G = this.G;
    G.applyQuality(quality);
    this.quickRace({ laps: 3, difficulty: 'normal', spec: 'gt', livery: 0 });
    this.goNow(); G.setAutopilot(true);
    const v0 = G.world.track.features.village.s0 + 40; // well inside Z3 for the whole measurement
    this.place(0, v0, 0, 16);
    for (let i = 1; i < 6; i++) this.place(i, v0 + 14 + (i - 1) * 9, i % 2 ? 2.4 : -2.4, 16);
    await this.frames(60);
    G.frameLog = [];
    const t0 = performance.now();
    const zoneLog = [];
    while (performance.now() - t0 < seconds * 1000) { await this.frames(30); zoneLog.push(G.world.track.zoneAt(G.sim.progress[0].s)); }
    const ft = G.frameLog; G.frameLog = null;
    const sorted = [...ft].sort((a, b) => b - a);
    const n1 = Math.max(1, Math.floor(ft.length * 0.01));
    const worst = sorted.slice(0, n1);
    const avg = ft.length / ft.reduce((a, b) => a + b, 0);
    const low1 = worst.length / worst.reduce((a, b) => a + b, 0);
    const info = G.renderer.info;
    return { quality, frames: ft.length, seconds: +(ft.reduce((a, b) => a + b, 0)).toFixed(2), avgFps: +avg.toFixed(1), low1Fps: +low1.toFixed(1), zones: [...new Set(zoneLog)], calls: G.lastInfo.calls, tris: G.lastInfo.tris, scale: G.R.quality.scale, programs: info.programs ? info.programs.length : 0 };
  }

  gpuInfo() {
    const gl = this.G.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), ua: navigator.userAgent, dpr: devicePixelRatio, size: [innerWidth, innerHeight] };
  }

  // ---------------------------------------------------------------- video capture (canvas composite + master audio)
  startCapture({ width = 1280, height = 720, fps = 30, bitrate = 5e6 } = {}) {
    const G = this.G;
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d');
    const stream = c.captureStream(fps);
    if (G.audio.streamDest) for (const t of G.audio.streamDest.stream.getAudioTracks()) stream.addTrack(t);
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate, audioBitsPerSecond: 160000 });
    this.cap = { rec, chunks: [], mimeType, t0: performance.now() };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) this.cap.chunks.push(e.data); };
    G.onAfterFrame = () => { g.drawImage(G.canvas, 0, 0, width, height); g.drawImage(G.hudCanvas, 0, 0, width, height); };
    rec.start(1000);
    return mimeType;
  }
  async stopCapture() {
    const cap = this.cap; if (!cap) return null;
    const done = new Promise((r) => { cap.rec.onstop = r; });
    cap.rec.stop(); await done;
    this.G.onAfterFrame = null;
    cap.blob = new Blob(cap.chunks, { type: 'video/webm' });
    cap.buf = new Uint8Array(await cap.blob.arrayBuffer());
    return { bytes: cap.buf.length, seconds: (performance.now() - cap.t0) / 1000, mimeType: cap.mimeType };
  }
  captureSlice(i, size = 4 << 20) {
    const b = this.cap.buf; const a = i * size; if (a >= b.length) return null;
    const sub = b.subarray(a, Math.min(b.length, a + size)); let s = ''; const CH = 0x8000;
    for (let k = 0; k < sub.length; k += CH) s += String.fromCharCode.apply(null, sub.subarray(k, k + CH));
    return btoa(s);
  }

  // ---------------------------------------------------------------- scene audit (13.1 test 8)
  sceneAudit() {
    const G = this.G, W = G.world, T = W.track, scene = G.scene;
    const NEAR = 60;
    const out = { cars: [], boxes: [], flat: [], lowTex: [], counts: {}, audio: null, meshesChecked: 0, instancesChecked: 0, texturesChecked: 0 };
    // ---- cars (every view used in races)
    for (const v of G.viewPool.values()) {
      const lod0 = countTris(v.root, 0);
      const mats = new Set();
      v.bodyLods[0].traverse((o) => { if (o.isMesh) mats.add(o.material); });
      for (const w of v.wheels) w.lods[0].traverse((o) => { if (o.isMesh) mats.add(o.material); });
      v.root.traverse((o) => { if (o.isMesh && o.userData.audit && o.userData.audit.lod === 0) mats.add(o.material); });
      out.cars.push({ key: v.key, lod0Tris: lod0, materials: mats.size, materialNames: [...mats].map((m) => m.name || m.type), ok: lod0 >= 15000 && mats.size >= 6 });
    }
    // ---- helpers
    const _b = new THREE.Box3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
    const nearTrack = (x, z, r) => { const o = T.project(x, z, {}); return Math.abs(o.d) - r < NEAR + o.hw; };
    const trisOf = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    const exempt = (o, m) => {
      const a = (o.userData && o.userData.audit) || {}, ma = m.userData && m.userData.audit;
      if (a.invisible || a.exempt || a.kind === 'collider' || a.kind === 'sky' || a.kind === 'water' || a.kind === 'fx' || a.kind === 'decal') return true;
      if (m.colorWrite === false || m.visible === false) return true;
      if (ma === 'emissive' || ma === 'glass' || ma === 'water') return true;
      if (/glass/i.test(m.name || '')) return true;
      if (m.emissive && m.emissiveIntensity > 0.5 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.3 && !m.map) return true;
      return false;
    };
    const texOf = (m) => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap'].map((k) => m[k]).filter(Boolean);
    const seenTex = new Set();
    const checkTex = (m, label) => {
      for (const t of texOf(m)) {
        if (seenTex.has(t)) continue; seenTex.add(t); out.texturesChecked++;
        const img = t.image; if (!img) continue;
        const w = img.width || (img.data && img.width) || 0, h = img.height || 0;
        const isAsphalt = /asphalt/i.test(m.name || '') || (t.userData && /asphalt/i.test(t.userData.src || ''));
        const min = isAsphalt ? 2048 : 1024;
        if (w < min || h < min) out.lowTex.push({ material: m.name || m.type, mesh: label, src: (t.userData && t.userData.src) || t.name || '', size: [w, h], min });
      }
    };
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      let p = o; while (p) { if (p.visible === false) return; p = p.parent; }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const g = o.geometry; if (!g) return;
      if (!g.boundingBox) g.computeBoundingBox();
      const label = o.name || (o.parent && o.parent.name) || o.type;
      const instances = o.isInstancedMesh ? o.count : 1;
      let anyNear = false;
      for (let k = 0; k < instances; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, _m); _m.premultiply(o.matrixWorld); out.instancesChecked++; } else { _m.copy(o.matrixWorld); out.meshesChecked++; }
        _b.copy(g.boundingBox).applyMatrix4(_m); _b.getSize(_s); _b.getCenter(_c);
        if (!nearTrack(_c.x, _c.z, Math.hypot(_s.x, _s.z) / 2)) continue;
        anyNear = true;
        const isBox = (g.type === 'BoxGeometry') || trisOf(g) <= 12;
        if (isBox && Math.max(_s.x, _s.y, _s.z) > 1.0 && !mats.every((m) => exempt(o, m))) out.boxes.push({ mesh: label, type: g.type, tris: trisOf(g), size: [+_s.x.toFixed(2), +_s.y.toFixed(2), +_s.z.toFixed(2)], at: [+_c.x.toFixed(1), +_c.z.toFixed(1)] });
        if (o.isInstancedMesh && k > 0) break; // one instance near the track is enough for material checks
      }
      if (!anyNear) return;
      for (const m of mats) {
        if (exempt(o, m)) continue;
        if (m.isShaderMaterial && !(m.userData && m.userData.audit)) continue;
        const hasAlbedo = !!(m.map || (m.uniforms && (m.uniforms.map || m.uniforms.tAlbedo)));
        const hasNormal = !!(m.normalMap || (m.uniforms && m.uniforms.normalMap));
        if (!hasAlbedo && !hasNormal) out.flat.push({ mesh: label, material: m.name || m.type });
        checkTex(m, label);
      }
    });
    // dedupe
    const ded = (arr, key) => { const s = new Map(); for (const a of arr) { const k = key(a); if (!s.has(k)) s.set(k, { ...a, count: 1 }); else s.get(k).count++; } return [...s.values()]; };
    out.boxes = ded(out.boxes, (b) => b.mesh + ':' + b.size.join('x'));
    out.flat = ded(out.flat, (f) => f.mesh + ':' + f.material);
    // ---- counts (section 5)
    const S = W.scatter;
    const houses = W.village.houses;
    out.counts.houses = houses.length;
    out.counts.houseStyles = new Set(houses.map((h) => h.style)).size;
    out.counts.houseHeights = { max: Math.max(...houses.map((h) => h.height || 0)) };
    const veg = S.items.filter((i) => i.cat === 'tree' || i.cat === 'grass' || i.cat === 'shrub');
    out.counts.vegetationSpecies = [...new Set(veg.map((i) => i.type.replace(/[:\d]+$/, '')))];
    out.counts.vegetationInstances = veg.length;
    // props within 25 m of the road edge per 100 m window
    const props = W.placed.filter((o) => o.kind === 'prop' || o.kind === 'infra' || o.kind === 'barrierProp');
    const bins = new Array(Math.ceil(T.length / 100)).fill(0);
    for (const pr of props) { const o = T.project(pr.x, pr.z, {}); if (Math.abs(o.d) - o.hw < 25) bins[Math.min(bins.length - 1, Math.floor(o.s / 100))]++; }
    const fullBins = bins.slice(0, Math.floor(T.length / 100));
    out.counts.propsPer100m = { min: Math.min(...fullBins), avg: +(fullBins.reduce((a, b) => a + b, 0) / fullBins.length).toFixed(1), bins: fullBins };
    out.counts.loadedTextures = loadedTextures.size;
    // ---- audio: player engine from recorded samples
    out.audio = G.audio.playerEngineInfo();
    out.ok = {
      cars: out.cars.every((c) => c.ok),
      boxes: out.boxes.length === 0,
      flat: out.flat.length === 0,
      textures: out.lowTex.length === 0,
      houses: out.counts.houses >= 25 && out.counts.houseStyles >= 5,
      vegetation: out.counts.vegetationSpecies.length >= 4,
      props: out.counts.propsPer100m.min >= 12,
      audio: !!(out.audio && out.audio.sampleBased && out.audio.bands.length >= 4),
    };
    out.pass = Object.values(out.ok).every(Boolean);
    return out;
  }
}
