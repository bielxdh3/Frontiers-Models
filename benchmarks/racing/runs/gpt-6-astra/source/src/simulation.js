import { CARS, MODES, clamp, lerp, wrap, angleDiff } from './config.js';
import { courses } from './course.js';
export const STEP = 1/60;
const rivals = [['Lia','#9b91f0'],['Nico','#efbd55'],['Bia','#64cbb4'],['Raul','#ef716c'],['Íris','#5cb7e9']];
const weatherValue = {sunny:0,cloudy:.46,rainy:1};
const daylightValue = {morning:.23,day:.42,sunset:.68,night:.86};
export function climateAt(setup,t) {
  const base = weatherValue[setup.weather], phase=t/70;
  const target = base>.7 ? .1 : 1;
  const w=lerp(base,target,(1-Math.cos(Math.min(phase,1)*Math.PI))/2);
  const weather=phase<=1?w:lerp(target,.46,(1-Math.cos(Math.min((phase-1)/1.5,1)*Math.PI))/2);
  const daylight=wrap(daylightValue[setup.daylight]+t/650,1);
  const light=clamp(Math.sin(daylight*Math.PI*2-.55)*.63+.45,.09,1);
  return {weather,wet:clamp((weather-.2)/.8,0,1),daylight,light};
}
export function createRace(setup, origin='local') {
  const clean={mode:MODES[setup.mode]?setup.mode:'trial',car:CARS.some(c=>c.id===setup.car)?setup.car:'brisa',weather:weatherValue[setup.weather]!==undefined?setup.weather:'sunny',daylight:daylightValue[setup.daylight]!==undefined?setup.daylight:'day',difficulty:['easy','normal','hard'].includes(setup.difficulty)?setup.difficulty:'normal'};
  const course=courses[clean.mode], count=clean.mode==='race'?6:1;
  const cars=Array.from({length:count},(_,i)=>{
    const s=8+Math.floor((count-1-i)/2)*8, offset=count===1?0:(i%2===0?-3.4:3.4),p=course.at(s,offset);
    return {id:i,name:i?rivals[i-1][0]:'Você',model:i?CARS[(i+1)%3].id:clean.car,color:i?rivals[i-1][1]:CARS.find(c=>c.id===clean.car).color,x:p.x,y:p.y,z:p.z,heading:p.heading,vx:0,vz:0,speed:0,steering:0,nitro:100,boost:false,drift:false,damage:0,impact:0,recovery:0,ghost:0,route:s,proj:p.index,lastS:s,nextGate:1,completed:0,lapStart:0,laps:[],valid:true,invalidReason:'',finishTime:null,stuck:0,distance:0,lastSafe:0,place:i+1};
  });
  return {setup:clean,origin,status:'countdown',beforePause:null,countdown:3,time:0,cars,climate:climateAt(clean,0),events:[],message:'',messageUntil:0,remaining:30,score:0,combo:1,comboDistance:0,scoreDistance:0,gates:0,best:null,result:null,version:0};
}
export function emit(r,type,car=0,detail='') { r.events.push({t:r.time,type,car,detail}); if(r.events.length>20000) r.events.shift(); r.version++; }
export function say(r,message) {r.message=message;r.messageUntil=r.time+3.6;}
export function pauseRace(r) { if(['running','countdown'].includes(r.status)){r.beforePause=r.status;r.status='paused';for(const c of r.cars){c.boost=false;c.drift=false;}} }
export function resumeRace(r) { if(r.status==='paused'){r.status=r.beforePause||'running';r.beforePause=null;} }
export function finishRace(r,status='finished') {
  if(['finished','failed','retired'].includes(r.status))return;
  r.status=status; for(const c of r.cars){c.boost=false;c.drift=false;}
  rankCars(r);
  const p=r.cars[0], valid=p.laps.filter(l=>l.valid);
  r.best=status==='finished'&&valid.length?Math.min(...valid.map(l=>l.time)):null;
  r.result={status,time:r.time,best:r.best,laps:structuredClone(p.laps),score:Math.floor(r.score),gates:r.gates,place:p.place,classification:r.cars.map(c=>({id:c.id,name:c.name,place:c.place,time:c.finishTime,laps:c.completed,progress:legitimateProgress(c,courses[r.setup.mode])})).sort((a,b)=>a.place-b.place)};
  emit(r,'end',0,status);
}
export function invalidate(c,reason){if(c.valid){c.valid=false;c.invalidReason=reason;}}
export function recoverCar(r,c) {
  const track=courses[r.setup.mode];
  // Rejoin behind the last passed gate, never at a future gate.
  const s=Math.max(4,(c.nextGate-1)*track.spacing-9);
  const p=track.at(s,c.id%2?-2.8:2.8);
  Object.assign(c,{x:p.x,y:p.y,z:p.z,heading:p.heading,vx:0,vz:0,speed:0,steering:0,route:s,lastS:p.s,proj:p.index,recovery:c.recovery+1,ghost:2,boost:false,drift:false,stuck:0});
  invalidate(c,'Recuperação'); emit(r,'recovery',c.id);
  if(!c.id){r.combo=1;r.comboDistance=0;say(r,'Carro recuperado • volta atual inválida');}
}
export function advanceProgress(r,c,oldRoute,onRoad,delta) {
  const track=courses[r.setup.mode],threshold=c.nextGate*track.spacing;
  if(delta<=0 || !onRoad || c.ghost>0 || c.finishTime!==null)return;
  if(oldRoute < threshold && c.route>=threshold && c.route-oldRoute<8) {
    c.nextGate++;c.lastSafe=threshold;emit(r,'gate',c.id,String(c.nextGate-1));
    if(!c.id&&r.setup.mode==='rush') {r.gates++;r.remaining+=5.4;r.score+=500*r.combo;say(r,`Portal ${r.gates}/24 • +5,4 s`);}
    if((c.nextGate-1)%track.gates===0) {
      c.laps.push({time:r.time-c.lapStart,valid:c.valid,reason:c.invalidReason});
      c.completed++;c.lapStart=r.time;c.valid=true;c.invalidReason='';emit(r,'lap',c.id);
      if(c.completed>=MODES[r.setup.mode].laps){c.finishTime=r.time;emit(r,'finish',c.id);}
      if(!c.id&&r.setup.mode!=='rush')say(r,c.completed===3?'Bandeirada!':`Volta ${c.completed} registrada`);
    }
  } else if(!c.id&&c.route>threshold+15&&oldRoute<=threshold+15) say(r,'Portal perdido • use Recuperar para retomar a rota');
}
export function legitimateProgress(c,track) {return (c.nextGate-1)*track.spacing+clamp(c.route-(c.nextGate-1)*track.spacing,0,track.spacing-.01);}
export function rankCars(r) {
  const track=courses[r.setup.mode];
  [...r.cars].sort((a,b)=>{
    if(a.finishTime!==null&&b.finishTime!==null)return a.finishTime-b.finishTime||a.id-b.id;
    if(a.finishTime!==null)return -1;if(b.finishTime!==null)return 1;
    return legitimateProgress(b,track)-legitimateProgress(a,track)||a.id-b.id;
  }).forEach((c,i)=>c.place=i+1);
}
export function aiInput(r,c,forPlayer=false) {
  const track=courses[r.setup.mode],p=track.project(c.x,c.z,c.proj);
  const difficulty=forPlayer?'hard':r.setup.difficulty;
  const skill={easy:.76,normal:.88,hard:1}[difficulty],speed=Math.max(0,c.speed);
  let lane=((c.id%3)-1)*2.7;
  // Local overtaking / defence, independent of the player's race position.
  for(const other of r.cars) if(other!==c && other.ghost<=0) {
    const gap=wrap(other.lastS-p.s+track.length/2,track.length)-track.length/2;
    if(gap>0&&gap<28&&Math.hypot(other.x-c.x,other.z-c.z)<35)lane=other.id%2?-5:5;
    if(gap<0&&gap>-16)lane=lerp(lane,(other.id%2?-1:1)*3,.35);
  }
  const anticipation=13+speed*(difficulty==='easy'?.65:.85);
  const target=track.at(p.s+anticipation,lane);
  const desired=Math.atan2(target.x-c.x,target.z-c.z);
  const error=angleDiff(desired,c.heading);
  const bend=Math.abs(angleDiff(track.at(p.s+45+speed*.4).heading,p.heading));
  let targetSpeed=(61-bend*30)*skill*(1-r.climate.wet*.2);
  targetSpeed=clamp(targetSpeed,20,64);
  if(Math.abs(p.offset)>track.width*.4)targetSpeed=Math.min(targetSpeed,26);
  // A small deterministic line error distinguishes precision, not hidden boosts.
  const errorNoise=forPlayer?0:Math.sin(r.time*.71+c.id*7)*(1-skill)*.17;
  const steer=clamp((error+errorNoise)*1.8,-1,1);
  const wrong= c.route>c.nextGate*track.spacing+12;
  return {throttle:speed<targetSpeed?1:.13,brake:speed>targetSpeed+3?clamp((speed-targetSpeed)/9,0,1):0,steer,drift:false,nitro:bend<.12&&speed>35&&c.nitro>35&&difficulty!=='easy'&&Math.abs(error)<.08,recover:c.stuck>4||wrong};
}
function impact(r,c,severity) {
  if(c.impact>.1)return;
  c.damage=clamp(c.damage+severity*.012,.02,1);c.impact=.7;c.boost=false;emit(r,'collision',c.id,String(Math.round(severity)));
  if(!c.id){r.combo=1;r.comboDistance=0;say(r,'Impacto • sequência interrompida');}
}
function moveCar(r,c,input,dt) {
  const track=courses[r.setup.mode],car=CARS.find(v=>v.id===c.model),wet=r.climate.wet;
  c.ghost=Math.max(0,c.ghost-dt);c.impact=Math.max(0,c.impact-dt);
  if(input.recover&&c.ghost<=0){recoverCar(r,c);return;}
  if(c.finishTime!==null){input={throttle:0,brake:c.speed>2?1:0,steer:0};}
  const prior=track.project(c.x,c.z,c.proj),onRoad=Math.abs(prior.offset)<=track.width/2;
  c.steering=lerp(c.steering,input.steer||0,1-Math.exp(-dt*9));
  let fx=Math.sin(c.heading),fz=Math.cos(c.heading),forward=c.vx*fx+c.vz*fz;
  c.drift=!!input.drift&&Math.abs(forward)>13&&Math.abs(c.steering)>.15&&c.ghost<=0;
  c.boost=!!input.nitro&&input.throttle>0&&c.nitro>0&&onRoad&&c.finishTime===null&&c.impact<=0;
  c.nitro=clamp(c.nitro+(c.boost?-25:c.drift?9:4)*dt,0,100);
  const grip=car.grip*(1-wet*.38)*(onRoad?1:.5)*(c.drift?.24:1);
  const steerRate=c.steering*(forward/(12+Math.abs(forward)*.48))*car.steer*(c.drift?1.27:1)*(1-wet*.14);
  c.heading=wrap(c.heading+steerRate*dt,Math.PI*2);
  fx=Math.sin(c.heading);fz=Math.cos(c.heading);
  forward=c.vx*fx+c.vz*fz;
  let side=c.vx*fz-c.vz*fx;
  side*=Math.exp(-grip*dt);
  let acc=(input.throttle||0)*car.accel*(c.boost?1.8:1);
  if(input.brake>0) acc-=input.brake*(forward>1?car.brake*(1-wet*.27):car.accel*.55);
  acc-=forward*Math.abs(forward)*.0030+forward*.06+prior.slope*8;
  if(!onRoad)acc-=forward*.85;
  forward=clamp(forward+acc*dt,-11,car.max*(c.boost?1.18:1));
  c.vx=fx*forward+fz*side;c.vz=fz*forward-fx*side;
  c.x+=c.vx*dt;c.z+=c.vz*dt;c.speed=forward;
  const p=track.project(c.x,c.z,c.proj);c.proj=p.index;c.y=p.y;
  const off=Math.abs(p.offset)>track.width/2+1.3;
  if(off){invalidate(c,'Fora da pista');if(!c.id&&r.time>r.messageUntil)say(r,'Fora da pista • volta inválida');}
  const bound=track.width/2+3;
  if(Math.abs(p.offset)>bound) {
    const sign=Math.sign(p.offset),excess=Math.abs(p.offset)-bound;
    c.x-=p.tz*sign*excess;c.z+=p.tx*sign*excess;
    const out=(c.vx*p.tz-c.vz*p.tx)*sign;
    if(out>0){c.vx-=p.tz*sign*out*1.35;c.vz+=p.tx*sign*out*1.35;const speed=Math.hypot(c.vx,c.vz);if(speed>4)impact(r,c,Math.max(out,speed*.15));c.vx*=.83;c.vz*=.83;}
  }
  const delta=wrap(p.s-c.lastS+track.length/2,track.length)-track.length/2,old=c.route;
  if(Math.abs(delta)<8){c.route+=delta;c.distance+=Math.max(0,delta);advanceProgress(r,c,old,!off,delta);}else invalidate(c,'Rota interrompida');
  c.lastS=p.s;c.stuck=Math.abs(c.speed)<3?c.stuck+dt:0;
}
export function stepRace(r,input={},dt=STEP) {
  if(dt!==STEP)throw new Error('Simulation requires a fixed 1/60 second step.');
  if(r.status==='countdown'){r.countdown=Math.max(0,r.countdown-dt);if(r.countdown===0){r.status='running';emit(r,'start');}return;}
  if(r.status!=='running')return;
  r.time+=dt;r.climate=climateAt(r.setup,r.time);
  for(const c of r.cars)moveCar(r,c,c.id?aiInput(r,c):input,dt);
  for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++) {
    const a=r.cars[i],b=r.cars[j];if(a.ghost>0||b.ghost>0)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    if(d<3.6&&d>.001){const nx=dx/d,nz=dz/d,separation=(3.6-d)/2;a.x-=nx*separation;a.z-=nz*separation;b.x+=nx*separation;b.z+=nz*separation;
      const relative=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
      if(relative>0){const force=relative*.65+1;a.vx-=nx*force;a.vz-=nz*force;b.vx+=nx*force;b.vz+=nz*force;impact(r,a,Math.max(relative,4));impact(r,b,Math.max(relative,4));}
    }
  }
  const p=r.cars[0];
  if(r.setup.mode==='rush') {
    r.remaining=Math.max(0,r.remaining-dt);
    // Points require new forward route distance. Reversing cannot farm points.
    const progress=legitimateProgress(p,courses.rush);
    if(progress>r.scoreDistance){const d=progress-r.scoreDistance;r.scoreDistance=progress;if(p.speed>20){r.comboDistance+=d;r.combo=Math.min(5,1+Math.floor(r.comboDistance/180));r.score+=d*r.combo*(p.drift?3:p.boost?1.5:1);}}
    if(p.speed<10){r.comboDistance=0;r.combo=1;}
    if(r.gates>=24)finishRace(r,'finished');else if(r.remaining<=0)finishRace(r,'failed');
  }else if(p.finishTime!==null)finishRace(r,'finished');
  rankCars(r);
}
export class FixedClock {
  constructor(){this.accumulator=0;}
  reset(){this.accumulator=0;}
  advance(delta,fn){this.accumulator+=clamp(delta,0,.15);let count=0;while(this.accumulator>=STEP&&count<10){fn(STEP);this.accumulator-=STEP;count++;}return count;}
}
