import { CARS, MODES, clamp, lerp, angleDiff } from './config.js';
export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_FRAMES = 40000;
export const MAX_DURATION = 3600;
const round = n => Math.round(n*1000)/1000;
// x,y,z,heading,vx,vz,speed,steering,nitro,boost,drift,damage,recovery,ghost,
// route,nextGate,completed,valid,impact,finishTime,place,lapStart
export function snapshot(r) {
  return {t:round(r.time),env:Object.values(r.climate).map(round),cars:r.cars.map(c=>[c.x,c.y,c.z,c.heading,c.vx,c.vz,c.speed,c.steering,c.nitro,+c.boost,+c.drift,c.damage,c.recovery,c.ghost,c.route,c.nextGate,c.completed,+c.valid,c.impact,c.finishTime??-1,c.place,c.lapStart].map(round)),hud:[r.remaining,r.score,r.combo,r.gates].map(round),laps:r.cars[0].laps.map(l=>[round(l.time),+l.valid]),message:r.time<r.messageUntil?r.message:''};
}
export class Recorder {
  constructor(r) {this.setup={...r.setup};this.origin=r.origin;this.identities=r.cars.map(c=>({name:c.name,model:c.model,color:c.color}));this.frames=[];this.events=[];this.last=-Infinity;this.version=-1;this.limited=false;}
  capture(r,force=false) {
    if(r.status==='countdown'||r.status==='paused')return;
    if(r.time>MAX_DURATION || this.frames.length>=MAX_FRAMES){this.limited=true;return;}
    if(force||r.time-this.last>=.0999||r.version!==this.version) {
      const f=snapshot(r),last=this.frames.at(-1);
      if(last?.t===f.t)this.frames[this.frames.length-1]=f;else this.frames.push(f);
      this.last=r.time;this.version=r.version;
    }
  }
  finish(r) {
    this.capture(r,true);
    if(!this.frames.length)this.frames.push(snapshot(r));
    return {format:'mare-alta',version:1,label:`${MODES[r.setup.mode].course} · ${CARS.find(c=>c.id===r.setup.car).name}`,created:new Date().toISOString(),origin:this.origin,setup:{...this.setup},identities:this.identities,duration:this.frames.at(-1).t,status:this.limited?'partial':r.status==='retired'?'partial':r.status,frames:this.frames,events:r.events.filter(e=>e.t<=this.last).map(e=>({...e,t:round(e.t)})),result:r.result?{best:r.result.best,score:Math.floor(r.result.score)}:null};
  }
}
function assert(ok,message){if(!ok)throw new Error(message);}
const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export function validateReplay(raw) {
  assert(raw&&typeof raw==='object'&&raw.format==='mare-alta'&&raw.version===1,'Formato ou versão de replay incompatível.');
  const s=raw.setup;
  assert(s&&MODES[s.mode]&&CARS.some(c=>c.id===s.car)&&['sunny','cloudy','rainy'].includes(s.weather)&&['morning','day','sunset','night'].includes(s.daylight)&&['easy','normal','hard'].includes(s.difficulty),'Configuração de replay inválida.');
  assert(finite(raw.duration,0,MAX_DURATION)&&['finished','failed','partial'].includes(raw.status),'Duração ou estado inválido.');
  assert(typeof raw.label==='string'&&raw.label.length<=100&&typeof raw.created==='string'&&raw.created.length<=30&&Number.isFinite(Date.parse(raw.created)),'Identificação de replay inválida.');
  const count=s.mode==='race'?6:1;
  assert(Array.isArray(raw.identities)&&raw.identities.length===count,'Número de carros inválido.');
  const identities=raw.identities.map(c=>{assert(c&&typeof c.name==='string'&&c.name.length<=24&&CARS.some(v=>v.id===c.model)&&/^#[0-9a-fA-F]{6}$/.test(c.color),'Identidade de carro inválida.');return {name:c.name,model:c.model,color:c.color};});
  assert(Array.isArray(raw.frames)&&raw.frames.length>=1&&raw.frames.length<=MAX_FRAMES,'Quantidade de amostras inválida.');
  let last=-1;
  const frames=raw.frames.map(f=>{
    assert(f&&finite(f.t,0,raw.duration+.002)&&f.t>last,'Linha do tempo inválida.');last=f.t;
    assert(Array.isArray(f.env)&&f.env.length===4&&f.env.every(n=>finite(n,0,1)),'Clima inválido.');
    assert(Array.isArray(f.cars)&&f.cars.length===count,'Amostra de carros incompleta.');
    const cars=f.cars.map(c=>{
      assert(Array.isArray(c)&&c.length===22&&c.every(n=>finite(n,-20000,20000)),'Valores do carro inválidos.');
      assert(finite(c[0],-2000,2000)&&finite(c[1],-100,300)&&finite(c[2],-2000,2000)&&finite(c[3],-7,7)&&finite(c[4],-150,150)&&finite(c[5],-150,150)&&finite(c[6],-30,150)&&finite(c[7],-1,1)&&finite(c[8],0,100),'Movimento fora dos limites.');
      for(const j of [9,10,17])assert(c[j]===0||c[j]===1,'Estado booleano inválido.');
      assert(finite(c[11],0,1)&&integer(c[12],0,5000)&&finite(c[13],0,3)&&integer(c[15],1,37)&&integer(c[16],0,3)&&finite(c[18],0,1)&&finite(c[19],-1,MAX_DURATION)&&integer(c[20],1,count)&&finite(c[21],0,MAX_DURATION),'Progresso inválido.');
      return [...c];
    });
    assert(Array.isArray(f.hud)&&f.hud.length===4&&finite(f.hud[0],0,1000)&&finite(f.hud[1],0,1e9)&&integer(f.hud[2],1,5)&&integer(f.hud[3],0,24),'HUD inválido.');
    assert(Array.isArray(f.laps)&&f.laps.length<=3&&f.laps.every(l=>Array.isArray(l)&&l.length===2&&finite(l[0],0,MAX_DURATION)&&(l[1]===0||l[1]===1)),'Voltas inválidas.');
    assert(typeof f.message==='string'&&f.message.length<=160,'Mensagem inválida.');
    return {t:f.t,env:[...f.env],cars,hud:[...f.hud],laps:f.laps.map(l=>[...l]),message:f.message};
  });
  assert(Math.abs(last-raw.duration)<.01,'Duração não corresponde às amostras.');
  assert(Array.isArray(raw.events)&&raw.events.length<=20000,'Eventos inválidos.');
  let previous=-1;
  const events=raw.events.map(e=>{assert(e&&finite(e.t,0,raw.duration+.002)&&e.t>=previous&&['start','gate','lap','collision','recovery','finish','end'].includes(e.type)&&integer(e.car,0,count-1)&&typeof e.detail==='string'&&e.detail.length<=64,'Evento inválido.');previous=e.t;return {t:e.t,type:e.type,car:e.car,detail:e.detail};});
  // Metadata is display-only. Imported result claims are never used for records.
  return {format:'mare-alta',version:1,label:raw.label,created:raw.created,origin:raw.origin==='harness'?'harness':'local',setup:{mode:s.mode,car:s.car,weather:s.weather,daylight:s.daylight,difficulty:s.difficulty},identities,duration:raw.duration,status:raw.status,frames,events,result:null};
}
export function parseReplay(text) {
  if(typeof text!=='string'||text.length>MAX_BYTES||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Arquivo excede o limite de 32 MB.');
  let raw;try{raw=JSON.parse(text);}catch{throw new Error('Arquivo incompleto ou JSON inválido. Arquivos compactados não são aceitos.');}
  return validateReplay(raw);
}
export function sampleReplay(replay,time) {
  const frames=replay.frames,t=clamp(time,0,replay.duration);let lo=0,hi=frames.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].t<=t)lo=mid;else hi=mid-1;}
  const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],u=a===b?0:clamp((t-a.t)/(b.t-a.t),0,1);
  const env=a.env.map((v,i)=>lerp(v,b.env[i],u));
  const cars=a.cars.map((v,i)=>{
    const w=b.cars[i],continuous=v[12]===w[12],c=[...v];
    if(continuous){for(const k of [0,1,2,4,5,6,7,8,14])c[k]=lerp(v[k],w[k],u);c[3]=v[3]+angleDiff(w[3],v[3])*u;}
    return {...replay.identities[i],id:i,x:c[0],y:c[1],z:c[2],heading:c[3],vx:c[4],vz:c[5],speed:c[6],steering:c[7],nitro:c[8],boost:!!c[9],drift:!!c[10],damage:c[11],recovery:c[12],ghost:c[13],route:c[14],nextGate:c[15],completed:c[16],valid:!!c[17],impact:c[18],finishTime:c[19]===-1?null:c[19],place:c[20],lapStart:c[21],laps:a.laps.map(l=>({time:l[0],valid:!!l[1]}))};
  });
  return {setup:replay.setup,status:'replay',time:t,cars,climate:{weather:env[0],wet:env[1],daylight:env[2],light:env[3]},remaining:a.hud[0],score:a.hud[1],combo:a.hud[2],gates:a.hud[3],message:a.message,messageUntil:Infinity};
}
