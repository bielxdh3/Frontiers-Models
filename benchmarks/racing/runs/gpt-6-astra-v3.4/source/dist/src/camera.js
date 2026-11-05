import * as THREE from 'three';
export class CameraRig{
 constructor(camera,track,terrain,world){Object.assign(this,{camera,track,terrain,world});this.mode='chase';this.snap=true;this.events=[];this.samples=0;this.minClearance=Infinity;}
 update(player,dt,mode,time=0){const camera=this.camera,f=this.track.at(player.s),forward=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw)),right=new THREE.Vector3(forward.z,0,-forward.x),p=player.position,target=p.clone().add(new THREE.Vector3(0,1,0)),desired=new THREE.Vector3();camera.up.set(0,1,0);let fov=60+Math.min(7,player.speed*.17);
  if(mode==='beauty'||mode==='garage'||mode==='menu'||mode==='config'||mode==='results'){const angle=mode==='garage'?time*.13:mode==='menu'?.8+Math.sin(time*.05)*.08:.67;desired.copy(p).addScaledVector(forward,Math.cos(angle)*(mode==='beauty'?6.4:8.8)).addScaledVector(right,-Math.sin(angle)*(mode==='beauty'?6.4:8.8));desired.y+=mode==='beauty'?1.1:1.8;target.y-=.35;fov=mode==='menu'?53:46;if(mode==='menu')target.addScaledVector(right,2.2);}
  else if(mode==='grid'){desired.copy(p).addScaledVector(forward,12).addScaledVector(right,-7);desired.y+=4.3;target.addScaledVector(forward,-5);fov=56;}
  else if(mode==='battle'){desired.copy(p).addScaledVector(forward,-11.5);desired.y+=3.8;target.addScaledVector(forward,6);fov=68;}
  else if(mode==='scale'){desired.copy(p).addScaledVector(forward,7).addScaledVector(right,-6);desired.y+=1.6;target.addScaledVector(right,1.1);fov=53;}
  else if(mode==='shore'){const a=this.track.at(341,this.world.shoreOffset(341,.6)+2).p,b=this.track.at(402,this.world.shoreOffset(402,0)-3).p;desired.set(a.x,this.terrain.sample(a.x,a.z)+.95,a.z);target.set(b.x,1.1,b.z);fov=65;}
  else if(mode==='close'){desired.copy(this.track.at(player.s+30,-6.10).p).add(new THREE.Vector3(0,.42,0));target.copy(this.track.at(player.s+46,-4.8).p).add(new THREE.Vector3(0,1.05,0));fov=64;}
  else if(this.mode==='hood'){desired.copy(p).addScaledVector(forward,1.4);desired.y+=1.02;target.copy(p).addScaledVector(forward,24);target.y+=1.4;fov=76+player.speed*.12;}
  else{desired.copy(p).addScaledVector(forward,-7.8);desired.y+=3.05;target.copy(p).addScaledVector(forward,8.5);target.y+=.84;}
  // Sweep the segment from the car to the desired camera against the actual
  // heightfield and building footprints. Shorten the arm before penetration.
  if(!['shore','close'].includes(mode)){const origin=p.clone().add(new THREE.Vector3(0,1.2,0));for(let i=1;i<=24;i++){const q=origin.clone().lerp(desired,i/24);let collision=q.y<this.terrain.sample(q.x,q.z)+.32;for(const box of this.world.colliders)if(q.y<box.position.y+box.height&&Math.hypot(q.x-box.position.x,q.z-box.position.z)<box.radius+.3)collision=true;if(collision){desired.copy(origin).lerp(desired,Math.max(.08,(i-1)/24));break;}}}
  desired.y=Math.max(desired.y,this.terrain.sample(desired.x,desired.z)+.34);if(this.snap||!['drive','grid'].includes(mode))camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*12));camera.position.y=Math.max(camera.position.y,this.terrain.sample(camera.position.x,camera.position.z)+.34);camera.lookAt(target);camera.fov=fov;camera.updateProjectionMatrix();this.snap=false;
  const clearance=camera.position.y-this.terrain.sample(camera.position.x,camera.position.z);this.minClearance=Math.min(this.minClearance,clearance);this.samples++;if(clearance<.3)this.events.push({type:'camera-terrain',s:player.s,clearance});
 }
}

