import * as THREE from 'three';
import {clamp,wrap} from './track.js';
export const FIXED_DT=1/120;
export class Vehicle{
 constructor(track,terrain,id=0){this.track=track;this.terrain=terrain;this.id=id;this.events=[];this.contacts=0;this.stuckTime=0;this.integrity={samples:0,minBodyClearance:Infinity,minWheelClearance:Infinity,maxOutside:0};this.reset(track.start-7-Math.floor(id/2)*7,id%2?2.3:-2.3);}
 reset(s,lane=0){const f=this.track.at(s,lane);this.position=f.p.clone();this.yaw=f.yaw;this.speed=0;this.lateralVelocity=0;this.steer=0;this.s=wrap(s,this.track.length);this.unwrapped=s;this.lane=lane;this.lastS=this.s;this.lastValidS=s;this.outsideTime=0;this.gear=1;this.rpm=1100;this.slip=0;this.brake=0;this.throttle=0;this.distance=0;this.pitch=0;this.roll=0;}
 driver(time,difficulty='normal'){
  const ahead=6+this.speed*.38,frame=this.track.at(this.s+ahead,this.lane),angle=Math.atan2(frame.p.x-this.position.x,frame.p.z-this.position.z);
  let error=Math.atan2(Math.sin(angle-this.yaw),Math.cos(angle-this.yaw));
  let bend=0;for(let j=12;j<100;j+=12)bend=Math.max(bend,this.track.curvature(this.s+j));
  const factor=difficulty==='easy'?.87:difficulty==='hard'?1.06:1;
  const target=Math.min(35,Math.sqrt(6.8/Math.max(.002,bend)))*factor*(this.pace||1);
  const distance=Math.hypot(frame.p.x-this.position.x,frame.p.z-this.position.z),wheelAngle=Math.atan2(2*2.7*Math.sin(error),distance),maximum=.58/(1+this.speed*.045);
  return{throttle:this.speed<target?1:.1,brake:this.speed>target+1?clamp((this.speed-target)*.2,0,1):0,steer:clamp(wheelAngle/maximum,-1,1)};
 }
 update(dt,input){
  const previous=this.position.clone(),previousS=this.s;this.throttle=input.throttle||0;this.brake=input.brake||0;
  this.steer=THREE.MathUtils.damp(this.steer,input.steer||0,7,dt);
  const n=this.track.nearest(this.position.x,this.position.z),offroad=Math.abs(n.offset)>this.track.width/2-.85;this.offroad=offroad;
  const accel=this.throttle*(7.8-this.speed*.1)-this.brake*13-.35-this.speed*this.speed*.0016-(offroad?this.speed*.6:0);
  this.speed=clamp(this.speed+accel*dt,0,50);
  const maxSteer=.58/(1+this.speed*.045);this.yaw+=this.steer*maxSteer*this.speed/2.7*dt;
  this.position.x+=Math.sin(this.yaw)*this.speed*dt;this.position.z+=Math.cos(this.yaw)*this.speed*dt;
  const now=this.track.nearest(this.position.x,this.position.z);this.s=now.s;
  this.constrain();
  this.position.y=this.track.roadHeight(this.position.x,this.position.z);
  let ds=this.s-previousS;if(ds>this.track.length/2)ds-=this.track.length;if(ds< -this.track.length/2)ds+=this.track.length;
  this.unwrapped+=ds;this.distance+=this.position.distanceTo(previous);this.lastValidS=this.s;
  this.slip=Math.abs(this.steer)*this.speed*.032;this.roll=THREE.MathUtils.damp(this.roll,-this.steer*this.speed*.0016,5,dt);this.pitch=THREE.MathUtils.damp(this.pitch,-accel*.004,5,dt);
  const newGear=clamp(1+Math.floor(this.speed/8.3),1,6);this.shift=newGear!==this.gear;this.gear=newGear;this.rpm=clamp(1300+(this.speed%8.3)*560+this.throttle*700,900,7500);
  this.checkIntegrity(dt);
 }
 constrain(){
  const n=this.track.nearest(this.position.x,this.position.z),f=this.track.at(n.s),angle=Math.atan2(Math.sin(this.yaw-f.yaw),Math.cos(this.yaw-f.yaw));
  const halfWidth=Math.abs(Math.cos(angle))*1.04+Math.abs(Math.sin(angle))*2.30,limit=6.63-halfWidth;
  this.contact=Math.abs(n.offset)>limit;
  if(this.contact){const p=this.track.at(n.s,clamp(n.offset,-limit,limit)).p;this.position.x=p.x;this.position.z=p.z;this.speed*=.985;this.yaw-=angle*.08;this.contacts++;}
  this.s=this.track.nearest(this.position.x,this.position.z).s;this.position.y=this.track.roadHeight(this.position.x,this.position.z);
 }
 checkIntegrity(dt){
  const f=this.track.at(this.s),forward=new THREE.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw)),right=new THREE.Vector3(forward.z,0,-forward.x),grade=f.t.y/Math.hypot(f.t.x,f.t.z);
  this.wheelContacts=[];let lift=0;
  for(const axle of[-1.34,1.34])for(const side of[-.87,.87]){const p=this.position.clone().addScaledVector(forward,axle).addScaledVector(right,side);const y=this.track.roadHeight(p.x,p.z);this.wheelContacts.push({x:p.x,z:p.z,y});lift=Math.max(lift,y-(this.position.y+grade*axle)-.025);}
  this.position.y+=lift;
  for(const axle of[-2.25,2.25])for(const side of[-1.02,1.02]){const p=this.position.clone().addScaledVector(forward,axle).addScaledVector(right,side);p.y+=grade*axle+.26;const clearance=p.y-Math.max(this.terrain.sample(p.x,p.z),this.track.roadHeight(p.x,p.z));this.integrity.minBodyClearance=Math.min(this.integrity.minBodyClearance,clearance);if(clearance<-.08)this.events.push({type:'body-below-surface',s:this.s,clearance});}
  for(const w of this.wheelContacts)this.integrity.minWheelClearance=Math.min(this.integrity.minWheelClearance,w.y-this.terrain.sample(w.x,w.z));
  this.integrity.samples++;const off=Math.abs(this.track.nearest(this.position.x,this.position.z).offset)>this.track.width/2;this.outsideTime=off?this.outsideTime+dt:0;this.stuckTime=this.throttle>.4&&this.speed<.5?this.stuckTime+dt:0;
  if(this.position.y<this.terrain.sample(this.position.x,this.position.z)-.1||!Number.isFinite(this.position.y)){this.events.push({type:'below-terrain',s:this.s});this.safeReset();}
  else if(this.outsideTime>3||this.stuckTime>3){this.events.push({type:'safety-reset',s:this.s,reason:this.outsideTime>3?'offroad':'stopped'});this.safeReset();}
 }
 safeReset(){const progress=this.unwrapped,s=this.lastValidS;this.reset(s,0);this.unwrapped=progress;this.stuckTime=0;}
}
export function resolveVehicles(vehicles){
 const contacts=[];
 for(let iteration=0;iteration<3;iteration++)for(let i=0;i<vehicles.length;i++)for(let j=i+1;j<vehicles.length;j++){
  const a=vehicles[i],b=vehicles[j],dx=b.position.x-a.position.x,dz=b.position.z-a.position.z;if(dx*dx+dz*dz>25)continue;
  const fa=[Math.sin(a.yaw),Math.cos(a.yaw)],ra=[fa[1],-fa[0]],fb=[Math.sin(b.yaw),Math.cos(b.yaw)],rb=[fb[1],-fb[0]];let depth=Infinity,normal=null;
  for(const axis of[fa,ra,fb,rb]){const projection=Math.abs(dx*axis[0]+dz*axis[1]);const extent=2.3*(Math.abs(fa[0]*axis[0]+fa[1]*axis[1])+Math.abs(fb[0]*axis[0]+fb[1]*axis[1]))+1.04*(Math.abs(ra[0]*axis[0]+ra[1]*axis[1])+Math.abs(rb[0]*axis[0]+rb[1]*axis[1]));const overlap=extent-projection;if(overlap<=0){normal=null;break;}if(overlap<depth){depth=overlap;const sign=Math.sign(dx*axis[0]+dz*axis[1])||1;normal=[axis[0]*sign,axis[1]*sign];}}
  if(!normal)continue;const shift=(depth+.003)*.5;a.position.x-=normal[0]*shift;a.position.z-=normal[1]*shift;b.position.x+=normal[0]*shift;b.position.z+=normal[1]*shift;
  const impact=(a.speed*fa[0]-b.speed*fb[0])*normal[0]+(a.speed*fa[1]-b.speed*fb[1])*normal[1];
  // Equal-mass impulse projected onto each car's forward axis. Keep the sign:
  // a rear impact accelerates the front car instead of braking both cars.
  if(impact>0){const impulse=impact*.52;a.speed=clamp(a.speed-impulse*(fa[0]*normal[0]+fa[1]*normal[1]),0,50);b.speed=clamp(b.speed+impulse*(fb[0]*normal[0]+fb[1]*normal[1]),0,50);}
  a.constrain();b.constrain();if(iteration===0)contacts.push({a:i,b:j,impact});
 }return contacts;
}

