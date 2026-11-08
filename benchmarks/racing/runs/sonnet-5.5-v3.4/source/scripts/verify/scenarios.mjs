// Screenshot scenarios S1..S12 (spec 13.4). Every camera pose is defined here, in code, and reproducible by script.
// `setup` runs inside the page with the __RACING__ API; shots happen during a real race (cars on the road, HUD on) unless noted.
export const SHOTS = [
  {
    id: 's1', file: 's1-reta-orla', title: 'Reta da orla em velocidade, sol à frente', refs: ['01', '02'], quality: 'high', hud: true, metrics: true,
    setup: (R) => { R.placePlayer(2900, 0, 52); R.pack([{ dS: 40, lat: -3.2 }, { dS: 74, lat: 3.4 }, { dS: -34, lat: 2.6 }, { dS: 105, lat: -2.2 }], 52); R.advance(0.4); R.cam.setMode('chase'); R.advance(0.2); },
  },
  {
    id: 's2', file: 's2-grid-3-4', title: 'Carro no grid, 3/4 frontal baixa (sem HUD)', refs: ['11'], quality: 'high', hud: false, metrics: true, freeze: true, grid: true,
    setup: (R) => {
      const p = R.player, v = p.v, f = v.forward, r = v.right, T = R.THREE;
      const pos = [v.p[0] + f[0] * 5.6 - r[0] * 3.3, v.p[1] - 0.18, v.p[2] + f[2] * 5.6 - r[2] * 3.3];
      R.setCamera(pos, [v.p[0] + f[0] * 0.2, v.p[1] - 0.05, v.p[2] + f[2] * 0.2], 34);
    },
  },
  {
    id: 's3', file: 's3-praia-espuma', title: 'Câmera baixa: areia molhada, espuma, rochas', refs: ['02', '04'], quality: 'high', hud: true, metrics: true, freeze: true,
    setup: (R) => {
      const T = R.world.track, terr = R.world.terrain, tmp = { x: 0, y: 0, z: 0 };
      let best = null;
      for (let s = 40; s < 760; s += 8) {
        const i = T.indexAtS(s);
        for (const side of [-1, 1]) {
          let lat = T.w[i] * 0.5 + 6, found = null;
          for (let k = 0; k < 90; k++, lat += 1) { T.roadPoint(i, side * lat, 0, tmp); const y = terr.sample(tmp.x, tmp.z); if (y < 1.0 && y > 0.25) { found = { x: tmp.x, z: tmp.z, y, lat }; break; } }
          if (!found) continue;
          let nearest = null, n = 0; for (const o of R.S.propItems) if (o.sea) { const d = Math.hypot(o.x - found.x, o.z - found.z); if (d < 80) n++; if (d > 9 && (!nearest || d < nearest.d)) nearest = { o, d }; }
          if (nearest && nearest.d < 40 && (!best || n > best.n)) best = { ...found, i, side, s, n, rock: nearest.o, d: nearest.d };
        }
      }
      R.shore = best && { s: best.s, rocks: best.n, d: +best.d.toFixed(1) };
      const cx = best.x + (best.x - best.rock.x) * 0.0, cz = best.z;
      R.setCamera([best.x, best.y + 0.5, best.z], [best.rock.x, 1.1, best.rock.z], 54);
      R.placePlayer(best.s + 20, 0, 24); R.pack([{ dS: 30, lat: -2.5 }, { dS: -14, lat: 2.5 }], 24);
    },
  },
  {
    id: 's4', file: 's4-falesia-mirante', title: 'Serpentina com o mar abaixo (do mirante)', refs: ['02'], quality: 'high', hud: true, metrics: true, freeze: true,
    setup: (R) => {
      const m = R.S.props.mirantePos, w = R.world.stats.mirante, T = R.world.track;
      let ox = Math.sin(m.yaw), oz = Math.cos(m.yaw);                                // local +z (the open side)
      // turn the view away from the sun (it is clamped + bloomed: keep its disc out of the frame)
      const sd = R.env.sunDir, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), th = Math.atan2(oz, ox), diff = wrap(th - Math.atan2(sd.z, sd.x));
      if (Math.abs(diff) < 1.15) { const na = th + Math.sign(diff || 1) * (1.15 - Math.abs(diff)); ox = Math.cos(na); oz = Math.sin(na); }
      const cam = [m.x + Math.sin(m.yaw) * 2.6, m.y + 3.2, m.z + Math.cos(m.yaw) * 2.6];
      R.setCamera(cam, [m.x + ox * 90, m.y - 16, m.z + oz * 90], 64);
      R.placePlayer(w.s + 6, 0, 30); R.pack([{ dS: 34, lat: -2 }, { dS: -22, lat: 2 }, { dS: 60, lat: 2 }], 30);
    },
  },
  {
    id: 's5', file: 's5-vila-rua', title: 'Rua da vila com o marco visível', refs: ['05', '06', '07'], quality: 'high', hud: true, metrics: true, freeze: true,
    setup: (R) => {
      const c = R.S.village.church, T = R.world.track, s = (c ? c.s : 1900) - 100;
      R.placePlayer(s, 0, 30); R.pack([{ dS: 34, lat: -2.4 }, { dS: 62, lat: 2.4 }, { dS: -28, lat: 2.4 }], 30); R.advance(0.6);
      const p = R.player.v, f = p.forward;
      // chase-like camera, aimed half-way between the street ahead and the church tower so both read in the frame
      const cam = [p.p[0] - f[0] * 9.6, p.p[1] + 3.3, p.p[2] - f[2] * 9.6], ahead = [p.p[0] + f[0] * 40, p.p[1] + 1.2, p.p[2] + f[2] * 40], tower = [c.x, c.y + c.height * 0.75, c.z];
      R.setCamera(cam, [(ahead[0] + tower[0]) / 2, (ahead[1] + tower[1]) / 2 - 3.0, (ahead[2] + tower[2]) / 2], 62);
      R.freeze(true);
    },
  },
  {
    id: 's6', file: 's6-bosque-luz', title: 'Bosque com sol rasante', refs: ['08', '10'], quality: 'high', hud: true, metrics: true,
    setup: (R) => {
      const T = R.world.track, z4 = R.world.json.zones.find((z) => z.id === 'Z4'), sd = R.env.sunDir, trees = R.world.objects.trees; let best = null;
      for (let s = z4.s0 + 20; s < z4.s1 - 150; s += 15) {
        const i = T.indexAtS(s), dot = T.tx[i] * sd.x + T.tz[i] * sd.z; let n = 0;
        const p = T.roadPoint(T.indexAtS(s + 40), 0, 0); for (const t of trees) if (Math.hypot(t.x - p.x, t.z - p.z) < 45) n++;
        const score = Math.max(0, dot) * 1.6 + Math.min(1, n / 40); if (!best || score > best.score) best = { s, score, n, dot };
      }
      R.forest = best; R.placePlayer(best.s, 0, 36); R.pack([{ dS: 30, lat: -2.2 }, { dS: 56, lat: 2.2 }, { dS: -28, lat: 2.2 }], 36); R.advance(0.4); R.cam.setMode('chase'); R.advance(0.2);
    },
  },
  {
    id: 's7', file: 's7-ponte-ou-tunel', title: 'Entrada da ponte ligada ao terreno', refs: ['14'], quality: 'high', hud: true, metrics: true, freeze: true,
    setup: (R) => {
      const T = R.world.track, b = R.world.json.bridge, tmp = { x: 0, y: 0, z: 0 };
      // from the ravine side, level with the piers, looking along the span from the entrance abutment
      const a = T.roadPoint(T.indexAtS(b.s0 + 8), -27, 0, tmp), ax = a.x, az = a.z, ay = Math.max(a.y - 9.0, R.world.terrain.sample(ax, az) + 2.2);
      const t = T.roadPoint(T.indexAtS(b.s0 + 62), 0, 0, { x: 0, y: 0, z: 0 });
      R.setCamera([ax, ay, az], [t.x, t.y - 5.5, t.z], 66);
      R.placePlayer(b.s0 + 14, 0, 20); R.pack([{ dS: 24, lat: -2 }, { dS: -18, lat: 2.2 }], 20);
    },
  },
  {
    id: 's8', file: 's8-disputa', title: 'Jogador lado a lado com 2+ IAs', refs: ['09', '13'], quality: 'high', hud: true, metrics: true,
    setup: (R) => {
      // a straight where the low sun comes from the side (60–83° off the road axis, outside the frame) so the pack is lit, not burnt out by the glare
      const T = R.world.track, sd = R.env.sunDir; let pick = 2780;
      for (let s = 60; s < T.length - 200; s += 20) {
        let straight = true; for (let k = -4; k <= 4; k++) { if (Math.abs(T.kappa[T.indexAtS(s + k * 15)]) > 1 / 260) { straight = false; break; } }
        const i = T.indexAtS(s), dot = Math.abs(T.tx[i] * sd.x + T.tz[i] * sd.z);
        if (straight && dot > 0.12 && dot < 0.5 && T.w[i] > 10) { pick = s; break; }
      }
      R.placePlayer(pick, 0.0, 46); R.pack([{ dS: 0.6, lat: -3.9 }, { dS: -0.4, lat: 3.9 }, { dS: -11, lat: -3.9 }, { dS: 13, lat: 3.9 }], 46); R.advance(1.6); R.cam.setMode('chase'); R.advance(0.15); R.s8s = pick;
    },
  },
  {
    id: 's9', file: 's9-close-pista', title: 'Close de asfalto, zebra e guardrail', refs: [], quality: 'high', hud: true, metrics: true, freeze: true,
    setup: (R) => {
      const T = R.world.track, z2 = R.world.json.zones.find((z) => z.id === 'Z2'), tmp = { x: 0, y: 0, z: 0 };
      // the longest stretch of the cliff road with a kerb (zebra) on one side and a guard-rail on the other
      const ok = (i) => (T.curbR[i] && T.barL[i] === 1) ? 1 : (T.curbL[i] && T.barR[i] === 1) ? -1 : 0;
      let best = null, run = null;
      for (let s = z2.s0; s < z2.s1; s += T.ds) {
        const i = T.indexAtS(s), k = ok(i);
        if (k && run && run.k === k) run.len += T.ds; else { run = k ? { s, k, len: T.ds } : null; }
        if (run && (!best || run.len > best.len)) best = { ...run };
      }
      const s0 = best ? best.s + Math.min(best.len * 0.25, 40) : 1300, kerbSide = best ? best.k : 1, i = T.indexAtS(s0), half = T.w[i] * 0.5;
      const p = T.roadPoint(i, kerbSide * (half - 1.5), 0, tmp), q = T.roadPoint(T.indexAtS(s0 + 24), -kerbSide * 0.8, 0, { x: 0, y: 0, z: 0 });
      R.setCamera([p.x, p.y + 0.55, p.z], [q.x, q.y + 0.5, q.z], 62);
      R.placePlayer(s0 + 20, -kerbSide * 1.6, 20); R.pack([{ dS: 36, lat: kerbSide * 1.0 }], 20);
    },
  },
  {
    id: 's10', file: 's10-baixa-vila', title: 'Posição de S5 em Baixa', refs: [], quality: 'low', hud: true, metrics: false, freeze: true,
    setup: null,                                  // same camera and cars as S5 (assigned below)
  },
  {
    id: 's11', file: 's11-escala', title: 'Carro parado ao lado de uma casa com porta', refs: [], quality: 'high', hud: false, metrics: false, freeze: true,
    setup: (R) => {
      const T = R.world.track, houses = R.world.objects.houses, q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
      let best = null;
      for (const h of houses) { T.nearest(h.x, h.z, 200, -1, q); const z3 = R.world.json.zones.find((z) => z.id === 'Z3'); if (q.s < z3.s0 + 60 || q.s > z3.s1 - 60) continue; const d = Math.abs(q.lat) - T.w[q.i] * 0.5; if (!best || d < best.d) best = { h, d, s: q.s, side: Math.sign(q.lat), i: q.i }; }
      const h = best.h, i = best.i, side = best.side;
      const carP = T.roadPoint(i, side * (T.w[i] * 0.5 - 2.6), 0, { x: 0, y: 0, z: 0 });
      R.placePlayer(best.s, side * (T.w[i] * 0.5 - 2.6), 0);
      const player = R.player; player.v.v.fill(0); player.driver.idx = -1;
      // camera across the road, level with the car roof, looking at the car with the house behind it
      const cam = T.roadPoint(i, -side * (T.w[i] * 0.5 - 0.6), 0, { x: 0, y: 0, z: 0 });
      const dx = h.x - carP.x, dz = h.z - carP.z, L = Math.hypot(dx, dz) || 1;
      R.setCamera([cam.x - (dx / L) * 1.5, cam.y + 1.25, cam.z - (dz / L) * 1.5], [(carP.x + h.x) / 2, carP.y + 1.5, (carP.z + h.z) / 2], 46);
      R.sceneInfo = { house: { x: h.x, z: h.z, variant: h.variant, W: h.W, D: h.D }, dist: +best.d.toFixed(1) };
    },
  },
  {
    id: 's12', file: 's12-mapa', title: 'Vista de cima da volta inteira', refs: [], quality: 'high', hud: false, metrics: false, freeze: true, topdown: true,
    setup: (R) => {
      const T = R.world.track; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < T.N; i += 4) { x0 = Math.min(x0, T.px[i]); x1 = Math.max(x1, T.px[i]); z0 = Math.min(z0, T.pz[i]); z1 = Math.max(z1, T.pz[i]); }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, fov = 40, asp = innerWidth / innerHeight, t = Math.tan(fov * Math.PI / 360);
      const h = Math.max((x1 - x0) / (2 * t * asp), (z1 - z0) / (2 * t)) * 1.12;
      R.scene.fog = null; R.topdown = true; R.S.camera.up.set(0, 0, -1);
      R.setCamera([cx, h, cz + 0.001], [cx, 0, cz], fov, [0, 0, -1]);
    },
  },
];
SHOTS.find((x) => x.id === 's10').setup = SHOTS.find((x) => x.id === 's5').setup;
