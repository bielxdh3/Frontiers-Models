import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS,DEFAULT_BINDINGS,bindingError,cleanSettings,angleDiff } from '../src/config.js';
import { courses } from '../src/course.js';
import { STEP,createRace,stepRace,aiInput,pauseRace,resumeRace,finishRace,recoverCar,advanceProgress,rankCars,FixedClock,climateAt } from '../src/simulation.js';
import { Recorder,validateReplay,parseReplay,sampleReplay,MAX_BYTES } from '../src/replay.js';

const base={mode:'trial',car:'brisa',weather:'sunny',daylight:'day',difficulty:'normal'};
function drive(r,seconds=350,recorder=null){for(let i=0;i<seconds*60&&!['finished','failed','retired'].includes(r.status);i++){stepRace(r,aiInput(r,r.cars[0],true));recorder?.capture(r);}return r;}
test('countdown gates all motion and timers; pause freezes every subsystem',()=>{
 const r=createRace(base),initial=structuredClone(r.cars);for(let i=0;i<120;i++)stepRace(r,{throttle:1,nitro:true});assert.deepEqual(r.cars,initial);assert.equal(r.time,0);pauseRace(r);const paused=structuredClone(r);for(let i=0;i<600;i++)stepRace(r,{throttle:1});assert.deepEqual(r,paused);resumeRace(r);for(let i=0;i<120;i++)stepRace(r,{throttle:1});assert(r.time>0);assert(r.cars[0].speed>0);assert.throws(()=>stepRace(r,{},.1));
});
test('three different courses can complete authentic three-lap/24-gate journeys',()=>{
 const shapes=new Set();for(const mode of ['trial','race','rush']){const r=drive(createRace({...base,mode}));assert.equal(r.status,'finished',mode);assert.equal(r.cars[0].completed,mode==='rush'?2:3);assert.equal(r.cars[0].recovery,0);assert(r.cars[0].laps.every(l=>l.valid));shapes.add(courses[mode].length);if(mode==='race'){assert.equal(r.cars.length,6);assert(r.time>120&&r.time<240);assert(r.cars.slice(1).every(c=>c.completed>=2&&c.nextGate>25));assert(r.result.classification.some(c=>c.time===null));}if(mode==='rush'){assert.equal(r.gates,24);assert(r.score>0);assert(r.remaining>0);}}assert.equal(shapes.size,3);
});
test('all cars are viable; hard/easy AI differ in anticipation/decisions and progress',()=>{
 for(const c of CARS){const r=drive(createRace({...base,car:c.id}));assert.equal(r.status,'finished',c.id);assert(r.cars[0].laps.some(l=>l.valid));}
 const results=[];for(const difficulty of ['easy','normal','hard']){const r=createRace({...base,mode:'race',difficulty});drive(r,90);results.push(r.cars[1].route);assert(r.cars.slice(1).every(c=>c.route>1000));}
 assert(results[2]>results[1]&&results[1]>results[0]);
});
test('reverse crossing, skipped checkpoint and repeated trigger never award progress',()=>{
 const r=createRace(base),c=r.cars[0],tr=courses.trial;c.route=tr.spacing+1;
 advanceProgress(r,c,tr.spacing+2,true,-1);assert.equal(c.nextGate,1);
 c.route=tr.spacing*2+2;advanceProgress(r,c,tr.spacing*2-1,true,3);assert.equal(c.nextGate,1);
 c.route=tr.spacing+1;advanceProgress(r,c,tr.spacing-1,true,2);assert.equal(c.nextGate,2);
 advanceProgress(r,c,tr.spacing-1,true,2);assert.equal(c.nextGate,2);
 const rush=createRace({...base,mode:'rush'});rush.cars[0].route=courses.rush.spacing+1;advanceProgress(rush,rush.cars[0],courses.rush.spacing-1,true,2);const remaining=rush.remaining;advanceProgress(rush,rush.cars[0],courses.rush.spacing-1,true,2);assert.equal(rush.remaining,remaining);assert.equal(rush.gates,1);
});
test('recovery cannot advance gates and clears momentum; one invalid lap leaves later laps valid',()=>{
 const r=createRace(base);drive(r,18);const c=r.cars[0],gate=c.nextGate,damage=.45;c.damage=damage;recoverCar(r,c);assert.equal(c.nextGate,gate);assert.equal(c.vx,0);assert.equal(c.vz,0);assert.equal(c.speed,0);assert.equal(c.boost,false);assert.equal(c.drift,false);assert.equal(c.damage,damage);assert.equal(c.valid,false);assert(c.route<(gate-1)*courses.trial.spacing||gate===1);drive(r);assert.equal(r.status,'finished');assert.equal(c.laps[0].valid,false);assert(c.laps.slice(1).every(l=>l.valid));assert.equal(r.best,Math.min(...c.laps.filter(l=>l.valid).map(l=>l.time)));
});
test('three invalid laps still finish without best; retirement and timeout remain distinct',()=>{
 const r=createRace(base);for(let i=0;i<24000&&r.status!=='finished';i++){r.cars[0].valid=false;r.cars[0].invalidReason='Fora da pista';stepRace(r,aiInput(r,r.cars[0],true));}assert.equal(r.status,'finished');assert.equal(r.cars[0].laps.length,3);assert.equal(r.best,null);
 const retired=createRace(base);drive(retired,20);finishRace(retired,'retired');assert.equal(retired.result.status,'retired');assert.equal(retired.result.best,null);
 const rush=createRace({...base,mode:'rush'});for(let i=0;i<60*40;i++)stepRace(rush,{});assert.equal(rush.status,'failed');assert.equal(rush.gates,0);
});
test('classification is based on valid progress with stable ties, never shortcut coordinates',()=>{
 const r=createRace({...base,mode:'race'});r.cars.forEach(c=>{c.nextGate=2;c.route=300;});r.cars[3].route=1e6;rankCars(r);assert.equal(r.cars[3].place,1);r.cars[2].nextGate=3;r.cars[2].route=470;rankCars(r);assert.equal(r.cars[2].place,1);r.cars[1].finishTime=130;rankCars(r);assert.equal(r.cars[1].place,1);const ties=r.cars.filter(c=>[0,4,5].includes(c.id));assert(ties[0].place<ties[1].place&&ties[1].place<ties[2].place);
});
test('fixed render schedules at 30/60/120 Hz produce equivalent physical outcomes',()=>{
 const outputs=[];for(const fps of [30,60,120]){const r=createRace(base),clock=new FixedClock();for(let n=0;n<fps*90;n++)clock.advance(1/fps,()=>stepRace(r,aiInput(r,r.cars[0],true)));outputs.push(r);}for(const r of outputs.slice(1)){assert(Math.abs(r.time-outputs[0].time)<STEP*1.01);assert(Math.abs(r.cars[0].route-outputs[0].cars[0].route)<1.5);assert.equal(r.cars[0].nextGate,outputs[0].cars[0].nextGate);}
});
test('wetness changes physical outcome, nitro consumes fuel, drift changes sideways motion',()=>{
 const dry=createRace(base),wet=createRace({...base,weather:'rainy'});dry.status=wet.status='running';
 for(let i=0;i<180;i++){stepRace(dry,{...aiInput(dry,dry.cars[0],true),nitro:true});stepRace(wet,{...aiInput(wet,wet.cars[0],true),nitro:true});}assert(dry.cars[0].nitro<50);assert(dry.cars[0].speed>20);
 for(let i=0;i<60;i++){stepRace(dry,{throttle:1,steer:.4,drift:true});stepRace(wet,{throttle:1,steer:.4,drift:true});}assert.notEqual(dry.cars[0].x,wet.cars[0].x);assert(climateAt(base,70).wet>.9);
 const fresh=createRace(base);assert.equal(fresh.cars[0].damage,0);assert.equal(fresh.cars[0].nitro,100);assert.equal(fresh.time,0);
});
test('replay export/import preserves historical physics and seeks are direction-independent',()=>{
 const r=createRace({...base,mode:'race'}),rec=new Recorder(r);drive(r,30,rec);recoverCar(r,r.cars[0]);rec.capture(r,true);drive(r,80,rec);finishRace(r,'retired');const rp=rec.finish(r),parsed=parseReplay(JSON.stringify(rp));assert.equal(parsed.frames.length,rp.frames.length);assert.equal(parsed.identities.length,6);
 const t=25.437,a=sampleReplay(parsed,t);sampleReplay(parsed,90);const b=sampleReplay(parsed,t);assert.deepEqual(a,b);assert.equal(a.cars[0].recovery,0);const recovery=parsed.events.find(e=>e.type==='recovery');const before=sampleReplay(parsed,recovery.t-.001),after=sampleReplay(parsed,recovery.t);assert.equal(before.cars[0].recovery,0);assert.equal(after.cars[0].recovery,1);assert.equal(after.cars[0].speed,0);assert(a.climate.wet<sampleReplay(parsed,75).climate.wet);assert.equal(sampleReplay(parsed,parsed.duration).time,parsed.duration);assert(Math.abs(angleDiff(.01,Math.PI*2-.01))<.03);
});
test('replay schema rejects malformed, unsupported, oversized and non-finite data',()=>{
 const r=createRace(base);r.status='running';const rec=new Recorder(r);rec.capture(r);stepRace(r,{throttle:1});finishRace(r,'retired');const rp=rec.finish(r);assert.doesNotThrow(()=>validateReplay(rp));
 for(const mutate of [x=>x.version=7,x=>x.frames[0].cars[0][0]=NaN,x=>x.frames[0].t=-1,x=>x.duration=1e9,x=>x.identities[0].color='url(https://invalid)',x=>x.events=[{type:'execute',t:0,car:0,detail:'x'}],x=>x.frames[0].cars[0][15]=99,x=>x.frames[0].cars=[]]){const bad=structuredClone(rp);mutate(bad);assert.throws(()=>validateReplay(bad));}
 assert.throws(()=>parseReplay('{'));assert.throws(()=>parseReplay('x'.repeat(MAX_BYTES+1)));
});
test('input rebinding rejects conflicts and corrupt preferences fall back safely',()=>{
 assert(bindingError('KeyW','brake',DEFAULT_BINDINGS));assert(bindingError('F5','throttle',DEFAULT_BINDINGS));assert.equal(bindingError('ArrowUp','throttle',DEFAULT_BINDINGS),'');const bad=cleanSettings({quality:'ultra',fps:10000,volume:8,bindings:{...DEFAULT_BINDINGS,brake:'KeyW'}});assert.equal(bad.quality,'medium');assert.equal(bad.volume,1);assert.deepEqual(bad.bindings,DEFAULT_BINDINGS);
});
