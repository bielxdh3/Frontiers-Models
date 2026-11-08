// Natural landform G(x, z): the terrain BEFORE the road is carved into it.
// World axes: x = east, z = south (so north N = -z), y = up, sea level y = 0.
// Pure + deterministic (seeded). Used by the track generator (to lay the road on the hill)
// and by the runtime terrain builder (single source of truth for ground shape).
import { makeNoise } from '../core/noise.js';
import { clamp, smoothstep } from '../core/util.js';

export const SEA_LEVEL = 0;

export function createLandform(seed = 7) {
  const nz = makeNoise(seed);

  // shoreline curves (map coords X east / N north)
  const shoreS = X => -58 + 22 * Math.sin(X / 340 + 0.6) + 9 * Math.sin(X / 113 + 1.7);
  const shoreW = N => -450 + 26 * Math.sin(N / 140) + 12 * Math.sin(N / 53 + 0.8);

  // stream-bed centre line (dry ravine under the Z4 bridge), as X(N)
  const ravineX = N => 520 + 22 * Math.sin(N / 55 + 0.4);

  // south-facing hillside: 3.3 m at the beach road, up to 54 m on the village plateau (N >= 290)
  function ramp(N) {
    const t = clamp((N - 8) / 282, 0, 1);
    const s = t * t * (3 - 2 * t);
    return 3.3 + 51 * (0.7 * t + 0.3 * s);
  }
  // the plateau slopes down towards the east so the Z4 descent can stay under 9 %
  const ampF = X => 1 - 0.62 * smoothstep(200, 620, X);
  /** smooth (noise-free) ground used to lay out the road */
  function smoothGround(x, z) {
    const N = -z;
    return 3.3 + (ramp(N) - 3.3) * ampF(x);
  }

  /** natural ground height at world (x, z); negative = sea floor */
  function G(x, z) {
    const X = x, N = -z;
    const dS = N - shoreS(X);
    const dW = X - shoreW(N);

    // --- land height: concave beach apron (0 -> 3.3 m over 58 m) + hillside ramp ---
    const tb = clamp(dS / 58, 0, 1);
    let land = 3.3 * (1 - (1 - tb) * (1 - tb)) + (ramp(N) - 3.3) * ampF(X);
    // west sea cliff: height grows fast with distance from the west shore
    const cliffT = clamp(dW / 130, 0, 1);
    const cliff = 1 - Math.pow(1 - cliffT, 2.6);
    land *= cliff;
    // gentle large-scale undulation (stronger uphill) + micro relief
    const und = nz.fbm(X / 210, N / 210, 4) * (1.1 + 5.0 * smoothstep(40, 300, N));
    land += und * cliff * clamp(land / 2.5, 0, 1);
    land += nz.fbm(X / 23, N / 23, 3) * 0.28 * clamp(land / 3, 0, 1);

    // rolling forest hills behind the plateau (north) and inland to the east
    const farN = smoothstep(300, 760, N), farE = smoothstep(780, 1250, X);
    land += 70 * farN * (0.55 + 0.45 * nz.fbm(X / 330 + 4, N / 330, 3))
          + 55 * farE * (0.5 + 0.5 * nz.fbm(X / 300, N / 300 + 9, 3));

    // dry ravine under the Z4 bridge
    const rx = ravineX(N);
    const rl = smoothstep(34, 60, Math.abs(X - rx));            // 0 in the bed, 1 outside
    const rN = smoothstep(190, 235, N) * (1 - smoothstep(380, 440, N));
    land -= 14 * (1 - rl) * rN;
    if (rN > 0) land += (1 - rl) * rN * 1.1 * nz.ridged(X / 14, N / 14, 3);   // rocky bed

    // --- sea floor (continuous with the land at the waterline) ---
    const aS = Math.max(0, -dS), aW = Math.max(0, -dW);
    const seaS = -(0.05 * aS + 0.0009 * aS * aS) - 0.35 * nz.fbm(X / 40, N / 40, 2) * smoothstep(0, 30, aS);
    const seaW = -(0.12 * aW + 0.0015 * aW * aW);
    const south = dS >= 0 ? land : Math.min(land, seaS);
    const west = dW >= 0 ? land : Math.min(land, seaW);
    return Math.max(Math.min(south, west), -45);
  }

  return { G, smoothGround, shoreS, shoreW, ravineX, ramp, ampF, seed };
}
