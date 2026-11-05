import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {Track,Terrain} from '../src/track.js';
import {Vehicle,resolveVehicles,FIXED_DT} from '../src/physics.js';
import {Race} from '../src/race.js';

const track=new Track(JSON.parse(await readFile('track.json','utf8'))),terrain=new Terrain(track);
const front=new Vehicle(track,terrain,0),rear=new Vehicle(track,terrain,1);
front.reset(153,0);rear.reset(149.5,0);rear.speed=30;
resolveVehicles([front,rear]);
const rearImpact={frontSpeed:front.speed,rearSpeed:rear.speed};
const race=new Race(track,terrain);race.start();
const samples=[];
for(let step=0;step<200*120&&race.records[0].completed<1;step++){
 race.playerOverride=race.elapsed>=12.05&&race.elapsed<12.48?{throttle:1,brake:0,steer:1}:null;
 race.update(FIXED_DT,{},true);
 if(step%60===0&&race.elapsed>=11&&race.elapsed<=20){const p=race.vehicles[0];samples.push({time:race.elapsed,s:p.s,speed:p.speed,stuck:p.stuckTime,throttle:p.throttle,brake:p.brake,yaw:p.yaw,events:p.events.slice()});}
}
const result={rearImpact,completed:race.records[0].completed,maxStopped:race.maxStopped,events:race.snapshot().events,collisionCount:race.events.filter(e=>e.type==='collision').length,samples};
await writeFile('verification/physics-regression.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,samples:undefined},null,2));
assert(front.speed>10,'A rear impact must transfer forward momentum to the front car');
assert(front.speed+rear.speed<=30.01,'A rear impact must not add forward momentum');
assert.equal(result.completed,1,'The pack must complete the lap after a side contact');
assert.equal(result.events.length,0,'The side contact must not require a safety reset');
assert(result.collisionCount>0,'The regression must exercise actual vehicle contacts');
