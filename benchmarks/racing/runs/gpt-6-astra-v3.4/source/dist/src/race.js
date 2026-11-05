import {Vehicle,resolveVehicles,FIXED_DT} from './physics.js';
import {clamp,wrap} from './track.js';
export const DRIVERS=['VOCÊ','L. COSTA','A. RIVA','M. SOL','N. VALE','I. MAR'];
export class Race{
 constructor(track,terrain){Object.assign(this,{track,terrain});this.vehicles=Array.from({length:6},(_,id)=>new Vehicle(track,terrain,id));this.status='menu';this.events=[];this.onEvent=()=>{};this.configure({laps:3,difficulty:'normal'});}
 configure(config){this.config={...this.config,...config};}
 emit(type,data={}){const event={time:this.elapsed||0,type,...data};this.events.push(event);this.onEvent(event);}
 start(){this.status='grid';this.playerOverride=null;this.lastBarrier=-2;this.phaseTime=0;this.elapsed=0;this.events=[];this.overtakes=0;this.maxStopped=0;this.finished=[];this.lastOrder=[0,1,2,3,4,5];this.records=this.vehicles.map((v,i)=>{v.reset(this.track.start-7-Math.floor(i/2)*7,i%2?2.3:-2.3);v.events=[];v.contacts=0;v.pace=[1,1,1.07,.98,1.025,1.04][i];v.stuckTime=0;return{id:i,nextGate:0,completed:0,lapStart:0,laps:[],best:Infinity,invalid:false,finish:null,maxStopped:0,progress:v.unwrapped-this.track.start};});this.emit('grid');}
 inputAI(v,dt){
  let lane=[-3.05,3.05,0,3.05,-3.05,0][v.id];const aggression=this.config.difficulty==='hard'?1:this.config.difficulty==='easy'?.65:.85;let targetAhead=null;
  for(const other of this.vehicles){if(other===v)continue;let gap=other.unwrapped-v.unwrapped;if(gap>0&&gap<30&&(!targetAhead||gap<targetAhead.gap))targetAhead={car:other,gap};}
  if(targetAhead&&targetAhead.car.speed<v.speed+2){const n=this.track.nearest(targetAhead.car.position.x,targetAhead.car.position.z);if(Math.abs(lane-n.offset)<2.2){const candidates=[-3.05,0,3.05].filter(l=>Math.abs(l-n.offset)>2.2);candidates.sort((a,b)=>{const penalty=l=>this.vehicles.reduce((sum,o)=>o===v?sum:sum+(Math.abs(o.unwrapped-v.unwrapped)<12&&Math.abs(this.track.nearest(o.position.x,o.position.z).offset-l)<2.1?10:0),0)+Math.abs(l-v.lane)*.1;return penalty(a)-penalty(b);});lane=candidates[0]??lane;}v.passing=true;}else v.passing=false;
  v.lane+=(lane-v.lane)*Math.min(1,dt*(1.2+aggression));const input=v.driver(this.elapsed,this.config.difficulty);
  if(targetAhead&&targetAhead.gap<7&&Math.abs(this.track.nearest(v.position.x,v.position.z).offset-this.track.nearest(targetAhead.car.position.x,targetAhead.car.position.z).offset)<2.2){input.throttle=0;input.brake=Math.max(input.brake,.65);}
  return input;
 }
 update(dt,input={},autopilot=false){
  if(this.status==='grid'||this.status==='countdown'){this.phaseTime+=dt;const next=this.phaseTime<5?'grid':this.phaseTime<8?'countdown':'racing';const beat=Math.floor(this.phaseTime);if(next==='countdown'&&beat!==this.beat){this.beat=beat;this.emit('countdown',{number:8-beat});}if(next==='racing'){this.emit('go');this.beat=null;}this.status=next;return;}
  if(this.status!=='racing')return;this.elapsed+=dt;
  for(const v of this.vehicles){const before=v.unwrapped,oldGear=v.gear,contacts=v.contacts;const controls=v.id||autopilot?this.inputAI(v,dt):input;v.update(dt,v.id===0&&this.playerOverride?this.playerOverride:controls);this.updateProgress(v,before,dt);if(v.id===0&&oldGear!==v.gear)this.emit('shift',{gear:v.gear});if(v.id===0&&v.contacts>contacts&&this.elapsed-(this.lastBarrier??-2)>.5){this.lastBarrier=this.elapsed;this.emit('barrier-contact',{speed:v.speed});}}
  const contacts=resolveVehicles(this.vehicles);for(const contact of contacts)if(contact.impact>1.5)this.emit('collision',contact);
  const order=this.order();if(this.elapsed>8){for(let i=1;i<6;i++)for(let j=i+1;j<6;j++)if(this.lastOrder.indexOf(i)<this.lastOrder.indexOf(j)&&order.indexOf(i)>order.indexOf(j)){this.overtakes++;this.emit('overtake',{from:j,to:i});}}
  this.lastOrder=order;
  if(this.records[0].completed>=this.config.laps){this.status='results';this.emit('finish');}
 }
 updateProgress(v,before,dt){
  const r=this.records[v.id],progress=v.unwrapped-this.track.start,delta=v.unwrapped-before,spacing=this.track.length/this.track.checkpoints.length;r.progress=progress;
  r.maxStopped=Math.max(r.maxStopped,v.stuckTime,v.outsideTime);this.maxStopped=Math.max(this.maxStopped,r.maxStopped);
  if(delta>Math.max(3,v.speed*dt*3)||delta< -4){r.invalid=true;this.emit('invalid-checkpoint',{id:v.id,delta});}
  if(r.finish!==null)return;
  // Every gate is crossed in order and close to the physical road. A discontinuity
  // invalidates the whole lap; the next start crossing only re-arms the sequence.
  if(r.invalid){const nextLine=(Math.floor((before-this.track.start)/this.track.length)+1)*this.track.length;if(progress>=nextLine){r.invalid=false;r.nextGate=Math.round(nextLine/spacing)+1;r.lapStart=this.elapsed;}return;}
  if(progress>=r.nextGate*spacing){
   const n=this.track.nearest(v.position.x,v.position.z);if(n.distance>this.track.width/2+1.2||progress-r.nextGate*spacing>5){r.invalid=true;this.emit('invalid-checkpoint',{id:v.id});return;}
   const gate=r.nextGate++;if(gate===0){r.lapStart=this.elapsed;}else if(gate%this.track.checkpoints.length===0){const lap=this.elapsed-r.lapStart;r.laps.push(lap);r.best=Math.min(r.best,lap);r.completed++;r.lapStart=this.elapsed;this.emit('lap',{id:v.id,lap:r.completed,seconds:lap});if(r.completed===this.config.laps){r.finish=this.elapsed;this.finished.push(v.id);}}
  }
 }
 order(){return [...this.records].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.progress-a.progress).map(r=>r.id);}
 results(){return this.order().map(id=>{const r=this.records[id],mean=r.laps.length?r.laps.reduce((a,b)=>a+b,0)/r.laps.length:this.track.length/24;return{id,name:DRIVERS[id],time:r.finish??this.elapsed+Math.max(0,this.config.laps*this.track.length-r.progress)/this.track.length*mean,projected:r.finish===null,best:r.best};});}
 simulate(seconds,autopilot=true){for(let i=0;i<Math.ceil(seconds/FIXED_DT)&&this.status!=='results';i++)this.update(FIXED_DT,{},autopilot);return this.snapshot();}
 snapshot(){return{status:this.status,elapsed:this.elapsed,overtakes:this.overtakes,maxStopped:this.maxStopped,records:this.records.map(r=>({...r})),events:this.vehicles.flatMap(v=>v.events.map(e=>({id:v.id,...e}))),contacts:this.vehicles.map(v=>v.contacts)};}
}


