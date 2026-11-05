// World generation pipeline (pure data, no rendering). Order follows the
// single-source rule: spline -> road mesh -> road collider -> terrain ->
// terrain collider -> exclusion strips -> zebras/barriers/checkpoints ->
// racing line -> houses/vegetation/props (placed by raycast on terrain).
import { Track } from './track.js';
import { Terrain } from './terrain.js';
import { Road } from './road.js';
import { buildBarriers, buildCheckpoints } from './barriers.js';
import { CollisionWorld, CircleGrid, SURF } from './collision.js';
import { validateWorld } from './validate.js';

export function generateWorld(trackJson, { onProgress = () => {}, racingLine = null, scatter = null } = {}) {
  const t0 = performance.now();
  const timings = {};
  const mark = (k) => { timings[k] = +(performance.now() - t0).toFixed(1); };
  const track = new Track(trackJson); mark('track');
  onProgress('Pista (spline)', 0.05);
  const terrain = new Terrain(track);
  terrain.generate(); mark('terrain');
  onProgress('Terreno', 0.3);
  const rl = racingLine ? racingLine(track) : null; mark('racingLine');
  const road = new Road(track, terrain, rl).build(); mark('road');
  onProgress('Estrada', 0.4);
  const barriers = buildBarriers(track, terrain); mark('barriers');
  const circles = new CircleGrid(8);
  const collision = new CollisionWorld(terrain, road.drivable, barriers.grid, circles);
  terrain.surfaceTypeAt = (x, z) => terrainSurface(terrain, x, z);
  const checkpoints = buildCheckpoints(track, 100);
  const world = {
    track, terrain, road, barriers, collision, checkpoints, racingLine: rl, placed: [], timings,
    groundHeight(x, z, yMax = 1e9) { return collision.groundHeight(x, z, yMax); },
  };
  if (scatter) { scatter(world); mark('scatter'); }
  onProgress('Validação', 0.5);
  return world;
}

/** terrain surface type from height / slope (sand near the sea, rock on steep slopes) */
export function terrainSurface(terrain, x, z) {
  const h = terrain.heightAt(x, z);
  const zc = terrain.coastZ(x);
  if (h < 3.4 && zc - z < 75) return SURF.SAND;
  if (terrain.slopeAt(x, z) > 0.75) return SURF.ROCK;
  return SURF.GRASS;
}

export { validateWorld };
