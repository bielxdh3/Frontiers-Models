import {readFile,writeFile} from 'node:fs/promises';
import {Track,Terrain,validateWorld} from '../src/track.js';
import {Vehicle,FIXED_DT} from '../src/physics.js';
const track=new Track(JSON.parse(await readFile('track.json','utf8'))),terrain=new Terrain(track),report=validateWorld(track,terrain);
const car=new Vehicle(track,terrain);let time=0,contacts=0;
while(time<240&&car.distance<track.length+30){car.update(FIXED_DT,car.driver(time));if(car.contact)contacts++;time+=FIXED_DT;}
const drive={time,distance:car.distance,progress:car.unwrapped,events:car.events,barrierContacts:contacts};
await writeFile('verification/p1-world.json',JSON.stringify({report,drive},null,2));
console.log(JSON.stringify({report:{...report,errors:report.errors.slice(0,15)},drive},null,2));
if(!report.ok||drive.events.length||drive.progress<track.length)process.exitCode=1;
