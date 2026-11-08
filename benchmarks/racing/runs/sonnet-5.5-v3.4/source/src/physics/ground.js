// Ground queries for physics, built on the SAME data the renderer uses:
//   road surface (rings of TrackData) + terrain grid (Terrain.sample).
import { SHOULDER } from '../world/track.js';

export const SURF = { ASPHALT: 0, KERB: 1, GRAVEL: 2, SAND: 3, GRASS: 4, COBBLE: 5, ROCK: 6, WATER: 7, BRIDGE: 8 };
export const SURF_NAME = ['asphalt', 'kerb', 'gravel', 'sand', 'grass', 'cobble', 'rock', 'water', 'bridge'];
// grip multiplier, rolling resistance coefficient, extra viscous drag (1/s)
export const SURF_PROPS = [
  { mu: 1.00, rr: 0.013, drag: 0.0 },   // asphalt
  { mu: 0.92, rr: 0.020, drag: 0.0 },   // kerb
  { mu: 0.68, rr: 0.045, drag: 0.02 },  // gravel
  { mu: 0.52, rr: 0.110, drag: 0.10 },  // sand
  { mu: 0.62, rr: 0.065, drag: 0.04 },  // grass / dirt
  { mu: 0.90, rr: 0.020, drag: 0.0 },   // cobble
  { mu: 0.80, rr: 0.040, drag: 0.0 },   // rock
  { mu: 0.35, rr: 0.250, drag: 0.35 },  // shallow water
  { mu: 1.00, rr: 0.013, drag: 0.0 },   // bridge deck
];

const ZONE_OFFROAD = [SURF.SAND, SURF.GRAVEL, SURF.GRASS, SURF.GRASS];

export class Ground {
  constructor(track, terrain) {
    this.T = track; this.terrain = terrain;
    this._q = { i: 0, t: 0, s: 0, lat: 0, d: 0, y: 0, dh: 0 };
    this._n = { x: 0, y: 1, z: 0 };
  }

  /**
   * height / normal / surface at (x,z). `hint` = previous nearest sample index (or -1).
   * Writes into `out` {y,nx,ny,nz,surf,onRoad,lat,s,i,mu,rr,drag}. `maxY` (optional) = ignore surfaces above it (bridge decks vs ravine floor).
   */
  query(x, z, hint, out, maxY = Infinity) {
    const T = this.T;
    const q = T.nearest(x, z, 400, hint, this._q);
    const i = q.i;
    const h = T.w[i] * 0.5;
    const bridge = T.bridge[i] === 1;
    const cS = bridge ? h + 0.8 : h + SHOULDER;
    const al = Math.abs(q.lat);
    out.i = i; out.lat = q.lat; out.s = q.s; out.onRoad = false;
    const yT = this.terrain.sample(x, z);
    let useRoad = false;
    if (al <= cS && q.y <= maxY + 0.3) {
      // the road plane is always above the corridor terrain; on bridge spans the terrain is far below
      useRoad = q.y >= yT - 0.15;
    }
    if (useRoad) {
      T.normalAt(i, this._n);
      out.y = q.y; out.nx = this._n.x; out.ny = this._n.y; out.nz = this._n.z;
      out.onRoad = al <= h;
      let surf = bridge ? SURF.BRIDGE : SURF.ASPHALT;
      if (al > h) {
        const kerbed = (q.lat < 0 ? T.curbL[i] : T.curbR[i]) && al < h + 1.35;
        surf = kerbed ? SURF.KERB : T.surface[i] === 1 ? SURF.COBBLE : ZONE_OFFROAD[T.zone[i]] === SURF.SAND ? SURF.GRAVEL : SURF.GRAVEL;
        if (bridge) surf = SURF.BRIDGE;
      } else if (T.surface[i] === 1) surf = SURF.COBBLE;
      out.surf = surf;
    } else {
      this.terrain.normal(x, z, this._n);
      out.y = yT; out.nx = this._n.x; out.ny = this._n.y; out.nz = this._n.z;
      let surf;
      if (yT < 0.05) surf = SURF.WATER;
      else if (this._n.y < 0.62) surf = SURF.ROCK;
      else {
        surf = ZONE_OFFROAD[T.zone[i]];
        // beach apron near the shore is sand, whatever the zone says
        if (yT < 3.9 && T.zone[i] === 0) surf = SURF.SAND;
      }
      out.surf = surf;
    }
    const p = SURF_PROPS[out.surf];
    out.mu = p.mu; out.rr = p.rr; out.drag = p.drag;
    return out;
  }

  /** barrier info on the side of `lat` at sample i: {type, off} or null */
  barrierAt(i, side) {
    const T = this.T;
    const type = side < 0 ? T.barL[i] : T.barR[i];
    if (!type) return null;
    return { type, off: side < 0 ? T.barOffL[i] : T.barOffR[i] };
  }
}
