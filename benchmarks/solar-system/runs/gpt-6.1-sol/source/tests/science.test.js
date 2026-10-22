import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,byId} from '../src/data.js';
import {solveKepler,elementsAt,orbitPosition,positionsAt,localPosition,displayPositions,displayRadius,measure,angularSeparation,DAY,YEAR,AU,C,G,J2000,START,MIN_DATE,MAX_DATE,orbitalPeriod,gravity,daylight,lunarIllumination,solarDayHours,validateRate,validateTime,searchBodies,catalogProblems,distanceUnit,formatNumber,length,subtract} from '../src/science.js';
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b}, tol ${tolerance}`);
test('Catalog has all required worlds, unique identities, valid units and distinct content',()=>{
 assert.deepEqual(catalogProblems(),[]);assert.equal(catalog.length,35);
 for(const id of ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon','phobos','deimos','io','europa','ganymede','callisto','titan','enceladus','miranda','ariel','umbriel','titania','oberon','triton','charon','pluto','ceres','eris','haumea','makemake','vesta','comet','asteroidBelt','kuiperBelt','oortCloud'])assert.ok(byId[id]);
 assert.equal(new Set(catalog.map(b=>b.description.pt)).size,catalog.length);
 for(const b of catalog)for(const key of b.sources)assert.ok(key);
});
test('Bounded Kepler solver solves circular and eccentric orbits, including reverse anomalies',()=>{
 for(const e of [0,.0167,.2056,.65,.85,.95])for(const M of [-7,-Math.PI,-1,0,.4,Math.PI,12]){const E=solveKepler(M,e),normalized=((M+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;near(E-e*Math.sin(E),normalized,1e-10);}
 for(const args of [[1,1],[1,-.1],[NaN,.1],[1,Infinity]])assert.throws(()=>solveKepler(...args));
});
test('Physical positions are deterministic, finite at boundaries, independent of arrival and spin',()=>{
 for(const time of [MIN_DATE,J2000,START,MAX_DATE]){const p=positionsAt(time);assert.deepEqual(p,positionsAt(time));for(const v of Object.values(p))for(const x of v)assert.ok(Number.isFinite(x));}
 const p=positionsAt(START),spin=byId.earth.rotationDays;byId.earth.rotationDays=100;assert.deepEqual(positionsAt(START),p);byId.earth.rotationDays=spin;
 const forward=positionsAt(START+DAY*1000*80);positionsAt(START-DAY*1000*100);assert.deepEqual(positionsAt(START+DAY*1000*80),forward);
});
test('Satellite position is parent-relative for Earth and Jupiter and repeats over its stated period',()=>{
 for(const id of ['moon','io','titan','charon']){const b=byId[id],p=positionsAt(START),rel=localPosition(id,START);rel.forEach((x,i)=>near(p[id][i]-p[b.parent][i],x,1e-5));const later=localPosition(id,START+b.periodDays*DAY*1000);later.forEach((x,i)=>near(x,rel[i],.01));}
});
test('Earth-Moon center of mass agrees with the JPL barycenter approximation',()=>{
 const p=positionsAt(START),bary=orbitPosition(elementsAt(byId.earth,START)),total=byId.earth.massKg+byId.moon.massKg;
 bary.forEach((x,i)=>near((p.earth[i]*byId.earth.massKg+p.moon[i]*byId.moon.massKg)/total,x,1e-6));
});
test('Triton retrograde inclination reverses its orbit exactly once',()=>{const p=localPosition('triton',START),q=localPosition('triton',START+60000),hz=p[0]*(q[1]-p[1])-p[1]*(q[0]-p[0]);assert.ok(hz<0,'Retrograde angular momentum must point south of the ecliptic');});
test('J2000 documented JPL checkpoints agree with the published table within rounding',()=>{
 const mercury=orbitPosition(elementsAt(byId.mercury,J2000)).map(x=>x/AU);
 near(mercury[0],-.1300886,1e-6);near(mercury[1],-.4472923,1e-6);near(mercury[2],-.0245988,1e-6);
 const emb=orbitPosition(elementsAt(byId.earth,J2000)).map(x=>x/AU);
 near(emb[0],-.17717125,1e-6);near(emb[1],.96721448,1e-6);near(length(emb),.9833,.0001);
});
test('Kepler period relationships, periapsis, apoapsis and SI gravity are coherent',()=>{
 near(orbitalPeriod(1),365.25,.03);near(orbitalPeriod(2)/orbitalPeriod(1),Math.sqrt(8),1e-12);near(orbitalPeriod(1,4)/orbitalPeriod(1),.5,1e-12);
 near(gravity(byId.moon.massKg,byId.moon.radiusKm),1.6242,.001);near(gravity(byId.earth.massKg,byId.earth.radiusKm),9.82,.005);assert.equal(gravity(0,100),null);
 const el={a:AU,e:.65,i:0,node:0,w:0,M:0};near(length(orbitPosition(el,0)),AU*.35,1e-6);near(length(orbitPosition(el,Math.PI)),AU*1.65,1e-6);
 assert.throws(()=>orbitalPeriod(-1));assert.throws(()=>orbitalPeriod(1,0));
});
test('Presentation mapping never affects physical measurement, gravity or periods',()=>{
 const before=measure('earth','jupiter',START),physical=positionsAt(START),period=byId.earth.periodDays;
 const compressed=displayPositions(physical,'explore'),real=displayPositions(physical,'relative');assert.notDeepEqual(real,compressed);assert.deepEqual(measure('earth','jupiter',START),before);assert.equal(byId.earth.periodDays,period);
 near(displayRadius('jupiter','relative')/displayRadius('earth','relative'),byId.jupiter.radiusKm/byId.earth.radiusKm,1e-12);
 near(length(subtract(real.moon,real.earth))/length(subtract(physical.moon,physical.earth)),21/AU,1e-15);
 near(before.km/AU,before.au,1e-12);near(before.km/C,before.lightSeconds,1e-12);
});
test('Degenerate endpoints and observers are explicit rather than NaN',()=>{const m=measure('earth','earth',START);assert.equal(m.km,0);assert.equal(m.lightSeconds,0);assert.equal(angularSeparation('earth','earth','moon',START),null);near(angularSeparation('sun','earth','earth',START),0,1e-6);});
test('Absolute temperatures, length and duration conversions retain definitions',()=>{near(distanceUnit(1,'mi'),.621371192237334,1e-12);near(distanceUnit(AU,'au'),1);assert.equal(DAY,86400);assert.equal(YEAR,365.25);assert.equal(byId.sun.temp,5772);assert.ok(!formatNumber(5.97e24,'en').includes('NaN'));});
test('Solar day differs from sidereal rotation, including Venus retrograde rotation',()=>{near(solarDayHours('earth'),24,.001);near(solarDayHours('moon')/24,29.5306,.001);near(solarDayHours('venus')/24,116.75,.05);near(solarDayHours('mercury')/24,175.94,.1);assert.equal(solarDayHours('sun'),null);assert.equal(solarDayHours('eris'),null);});
test('Daylight handles equinox, zero tilt and polar day/night; phases match analytic geometry',()=>{
 near(daylight(0,30,90),12);near(daylight(23.44,0,90),12);near(daylight(23.44,30,0),12);near(daylight(23.44,30,90)+daylight(23.44,-30,90),24);
 assert.equal(daylight(23.44,90,90),24);assert.equal(daylight(23.44,90,270),0);near(daylight(0,90,0),12);
 assert.equal(lunarIllumination(0),0);near(lunarIllumination(90),.5);assert.equal(lunarIllumination(180),1);near(lunarIllumination(270),.5);
});
test('Date/rate guard rails and bilingual alias search reject bad input',()=>{
 for(const x of ['',Infinity,'NaN','100000000',{},'oops'])assert.throws(()=>validateRate(x));near(validateRate('1,5'),1.5);assert.equal(validateRate(-1000),-1000);assert.equal(validateRate(0),0);
 for(const x of [NaN,MIN_DATE-1,MAX_DATE+1,'garbage'])assert.throws(()=>validateTime(x));assert.equal(validateTime('2000-01-01T12:00:00Z'),J2000);
 assert.equal(searchBodies('Terra')[0].id,'earth');assert.equal(searchBodies('earth')[0].id,'earth');assert.equal(searchBodies('saturn')[0].id,'saturn');assert.equal(searchBodies('eris')[0].id,'eris');assert.equal(searchBodies('nothinghere').length,0);
});
