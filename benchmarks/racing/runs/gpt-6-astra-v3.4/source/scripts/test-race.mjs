import fs from 'node:fs';
import {Track,Terrain} from '../src/track.js';
import {Race} from '../src/race.js';
const track=new Track(JSON.parse(fs.readFileSync(new URL('../track.json',import.meta.url)))),terrain=new Terrain(track),race=new Race(track,terrain);
race.start();race.simulate(600);console.log(JSON.stringify({snapshot:race.snapshot(),results:race.results(),integrity:race.vehicles.map(v=>v.integrity)},null,2));
