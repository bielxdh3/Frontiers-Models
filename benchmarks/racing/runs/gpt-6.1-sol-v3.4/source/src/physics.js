import * as THREE from 'three';
import {clamp,mix} from './track.js';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class RacePhysics {
 constructor(track){this.track=track;this.cars=[];this.events=[];this.integrity=[];this.clock=0;this.overtakes=0;this.ranking=[];this.laps=3;this.difficulty='normal';this.running=false;this.finished=false;this.reset();}
 reset(laps=this.laps,difficulty=this.difficulty){this.laps=laps;this.difficulty=difficulty;this.clock=0;this.events=[];this.integrity=[];this.overtakes=0;this.finished=false;this.running=false;this.cars=[];for(let i=0;i<6;i++){const s=100-Math.floor(i/2)*7.5,f=this.track.at(s,(i%2?1:-1)*2.2);this.cars.push({id:i,x:f.p.x,z:f.p.z,y:f.p.y,yaw:f.yaw,s,prevS:s,d:(i%2?1:-1)*2.2,v:0,steer:0,throttle:0,brake:0,gear:1,rpm:1000,progress:-Math.floor(i/2)*7.5,nextCheckpoint:0,lap:1,started:false,lapStart:0,bestLap:Infinity,lastLap:0,finished:false,finishTime:0,offTime:0,stopped:0,lastValid:s,roll:0,pitch:0,slip:0,targetLane:(i%2?1:-1)*2,personality:.95+i*.023,collisions:0})}this.ranking=this.cars.map(c=>c.id);}
 controller(c){
  const t=this.track,f=t.at(c.s),look=clamp(8+c.v*.6,10,32);let lane=c.targetLane;
  for(const o of this.cars){if(o===c)continue;let ahead=(o.s-c.s+t.length)%t.length;if(ahead>0&&ahead<23&&Math.abs(o.d-c.d)<2.4){lane=c.d>0?-2.6:2.6;c.targetLane=lane}}
  const target=t.at(c.s+look,lane).p,desired=Math.atan2(target.x-c.x,target.z-c.z);const error=wrap(desired-c.yaw);
  let curvature=0;for(let s=5;s<90;s+=10)curvature=Math.max(curvature,Math.abs(t.at(c.s+s).curvature));
  const difficulty={easy:.86,normal:1,hard:1.09}[this.difficulty];let speed=clamp(Math.sqrt(6.8/Math.max(curvature,.001)),14,36)*difficulty*c.personality;
  // Independent pace profiles, with no reference to the player's progress.
  speed*=1+.045*Math.sin(c.s*.008+c.id*2.1);
  for(const o of this.cars){const ahead=(o.s-c.s+t.length)%t.length;if(o!==c&&ahead<7&&ahead>.1&&Math.abs(o.d-c.d)<1.8)speed=Math.min(speed,o.v*.9)}
  return {throttle:c.v<speed?1:.12,brake:c.v>speed+1?clamp((c.v-speed)/5,0,1):0,steer:clamp(error*2.65,-1,1),handbrake:false};
 }
 step(dt,input,autopilot=false){if(!this.running||this.finished)return;this.clock+=dt;
  for(const c of this.cars){const u=c.id===0&&!autopilot?input:this.controller(c);if(c.id===0&&autopilot&&input.handbrake)u.handbrake=true;c.throttle=u.throttle;c.brake=u.brake;c.steer=mix(c.steer,u.steer,1-Math.exp(-dt*10));
   const oldV=c.v;const off=Math.abs(c.d)>this.track.width/2;const accel=6.7*u.throttle-11.5*u.brake-.006*c.v*Math.abs(c.v)-.12-(off?1.8:0);c.v=clamp(c.v+accel*dt,0,45);
   const steerAngle=c.steer*(.47/(1+c.v/24));const yawRate=c.v/2.65*Math.tan(steerAngle)*(u.handbrake?1.6:1);c.yaw+=yawRate*dt;c.x+=Math.sin(c.yaw)*c.v*dt;c.z+=Math.cos(c.yaw)*c.v*dt;
   const n=this.track.project(c.x,c.z,c.s),f=this.track.at(n.s);let delta=n.s-c.s;if(delta>this.track.length/2)delta-=this.track.length;if(delta< -this.track.length/2)delta+=this.track.length;
   c.prevS=c.s;c.s=n.s%this.track.length;c.d=n.d;
   // Conservative swept side barriers at the same offsets as rendered rails/curbs.
   const limit=this.track.width/2+.55-.94;
   if(Math.abs(c.d)>limit){const side=Math.sign(c.d);c.d=side*limit;const p=this.track.at(c.s,c.d).p;c.x=p.x;c.z=p.z;c.v*=.78;c.yaw=f.yaw+clamp(wrap(c.yaw-f.yaw),-.12,.12);if(c.collisions===0||this.clock-c.lastCollision>.3){this.events.push({type:'collision',car:c.id,time:this.clock,force:oldV-c.v});c.lastCollision=this.clock;c.collisions++}}
   c.y=this.track.ground(c.x,c.z,c.s);c.pitch=mix(c.pitch,-(c.v-oldV)*.03+Math.asin(f.tan.y),.12);c.roll=mix(c.roll,clamp(-yawRate*c.v*.006,-.075,.075)+f.bank,.1);c.slip=Math.abs(yawRate*c.v)/18+(u.handbrake?.6:0);
   const oldGear=c.gear;c.gear=clamp(Math.floor(c.v/7.6)+1,1,6);c.rpm=clamp(1100+(c.v%7.6)/7.6*5400+u.throttle*500,900,7400);if(c.gear!==oldGear)this.events.push({type:'shift',car:c.id,time:this.clock,gear:c.gear});
   if(delta>0&&delta<5){c.progress+=delta;const cpDistance=this.track.length/this.track.checkpoints.length;const relative=s=>(s-111+this.track.length)%this.track.length;const checkpoint=Math.floor(relative(c.s)/cpDistance);const previous=Math.floor(relative(c.prevS)/cpDistance);if(checkpoint!==previous&&checkpoint===c.nextCheckpoint){c.nextCheckpoint=(c.nextCheckpoint+1)%this.track.checkpoints.length;if(checkpoint===0){if(!c.started){c.started=true;c.lapStart=this.clock}else{c.lastLap=this.clock-c.lapStart;c.bestLap=Math.min(c.bestLap,c.lastLap);c.lapStart=this.clock;c.lap++;this.events.push({type:'lap',car:c.id,time:this.clock,lap:c.lap});if(c.lap>this.laps&&!c.finished){c.finished=true;c.finishTime=this.clock;this.events.push({type:'finish',car:c.id,time:this.clock});if(c.id===0)this.finished=true}}}}}
   if(!Number.isFinite(c.y)||c.y< -30){this.integrity.push({car:c.id,time:this.clock,type:'outside-world'});this.safetyReset(c)}
   else c.lastValid=c.s;
   c.stopped=c.v<.2?c.stopped+dt:0;c.maxStopped=Math.max(c.maxStopped||0,c.stopped);c.offTime=Math.abs(c.d)>this.track.width/2?c.offTime+dt:0;c.maxOffTime=Math.max(c.maxOffTime||0,c.offTime);if(c.stopped>3.2){this.events.push({type:'safety-stop',car:c.id,time:this.clock});this.safetyReset(c)}
  }
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const a=this.cars[i],b=this.cars[j];let ds=a.s-b.s;if(ds>this.track.length/2)ds-=this.track.length;if(ds< -this.track.length/2)ds+=this.track.length;const dd=a.d-b.d;if(Math.abs(ds)<4.15&&Math.abs(dd)<1.84){const sign=dd>=0?1:-1,push=(1.84-Math.abs(dd))*.51;for(const [c,dir] of [[a,sign],[b,-sign]]){c.d=clamp(c.d+dir*push,-4.8,4.8);const f=this.track.at(c.s,c.d);c.x=f.p.x;c.z=f.p.z;c.y=f.p.y}const fast=ds>0?b:a,slow=ds>0?a:b;const rel=fast.v-slow.v;if(rel>0){slow.v+=rel*.28;fast.v-=rel*.5}if(this.clock-(a.lastBump||-1)>.6){this.events.push({type:'collision',car:i,time:this.clock,force:Math.abs(rel)});a.lastBump=this.clock}}}
  const rank=[...this.cars].sort((a,b)=>b.progress-a.progress).map(c=>c.id);for(let i=1;i<6;i++)for(let j=i+1;j<6;j++)if(this.ranking.indexOf(i)>this.ranking.indexOf(j)&&rank.indexOf(i)<rank.indexOf(j)){this.overtakes++;this.events.push({type:'overtake',car:i,other:j,time:this.clock})}this.ranking=rank;
 }
 safetyReset(c){const f=this.track.at(c.lastValid,0);Object.assign(c,{x:f.p.x,y:f.p.y,z:f.p.z,yaw:f.yaw,v:0,d:0,offTime:0,stopped:0})}
 validateFrame(){const errors=[];for(const c of this.cars){const ground=this.track.ground(c.x,c.z,c.s);if(c.y<ground-.02)errors.push({type:'below-surface',car:c.id,time:this.clock});if(Math.abs(c.y-ground)>1.5)errors.push({type:'wheel-contact',car:c.id,time:this.clock})}if(errors.length)this.integrity.push(...errors);return errors}
}
