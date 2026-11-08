// World = everything derived from track.json (single source of truth): track samples, terrain, ground queries,
// and (later) the placed objects. Deterministic: same seed -> same world.
import { TrackData } from './track.js';
import { createTerrain } from './terrain.js';
import { Ground } from '../physics/ground.js';
import { Collisions } from '../physics/collisions.js';

export async function createWorld({ trackUrl = './track.json', onProgress = () => {}, json = null } = {}) {
  const data = json || await (await fetch(trackUrl)).json();
  onProgress(0.02, 'Lendo traçado');
  const track = new TrackData(data);
  onProgress(0.06, 'Esculpindo terreno');
  const terrain = createTerrain(track, data.seed);
  // yield to the browser occasionally so the loading screen stays alive
  terrain.build(p => onProgress(0.06 + p * 0.3, 'Esculpindo terreno'));
  onProgress(0.36, 'Terreno pronto');
  const ground = new Ground(track, terrain);
  const collisions = new Collisions(track);
  const world = {
    json: data, seed: data.seed, track, terrain, ground, collisions,
    objects: { houses: [], trees: [], props: [], rocks: [] },   // filled by populate()
    stats: {},
  };
  return world;
}
