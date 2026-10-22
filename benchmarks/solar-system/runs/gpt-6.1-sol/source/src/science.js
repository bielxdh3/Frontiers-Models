import {byId,catalog} from './data.js';
export const AU=149597870.7, DAY=86400, YEAR=365.25, C=299792.458, G=6.67430e-11;
export const J2000=Date.UTC(2000,0,1,12), START=Date.UTC(2026,0,1,12), MIN_DATE=Date.UTC(1800,0,1), MAX_DATE=Date.UTC(2050,0,1);
export const RAD=Math.PI/180, TAU=2*Math.PI;
export const length=v=>Math.hypot(...v);
export const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
export function solveKepler(M,e) {
  if(!Number.isFinite(M)||!Number.isFinite(e)||e<0||e>=1)throw Error('Elliptical orbit requires 0 ≤ e < 1 and finite anomaly');
  M=((M+Math.PI)%TAU+TAU)%TAU-Math.PI;
  let E=e<.8?M:Math.PI*Math.sign(M||1);
  for(let i=0;i<24;i++){const delta=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=delta;if(Math.abs(delta)<1e-12)return E;}
  throw Error('Kepler solver did not converge');
}
export function elementsAt(body,time) {
  if(body.model==='jpl'){
    const t=(time-J2000)/(DAY*1000*36525);
    const p=body.elements.map((v,i)=>v+body.rates[i]*t);
    return {a:p[0]*AU,e:p[1],i:p[2]*RAD,node:p[5]*RAD,w:(p[4]-p[5])*RAD,M:(p[3]-p[4])*RAD};
  }
  const inclination=(body.inclination||0)*RAD;
  // An inclination above 90 degrees already encodes a retrograde orbital plane.
  const direction=body.retrograde&&Math.cos(inclination)>=0?-1:1;
  return {a:body.aKm??body.aAU*AU,e:body.eccentricity||0,i:inclination,node:0,w:body.id==='moon'?318.15*RAD:0,M:(body.phase||0)*RAD+(time-J2000)/(DAY*1000)/body.periodDays*TAU*direction};
}
export function orbitPosition(el,E=solveKepler(el.M,el.e)){
  const x=el.a*(Math.cos(E)-el.e), y=el.a*Math.sqrt(1-el.e**2)*Math.sin(E);
  const cw=Math.cos(el.w),sw=Math.sin(el.w),cn=Math.cos(el.node),sn=Math.sin(el.node),ci=Math.cos(el.i),si=Math.sin(el.i);
  return [(cw*cn-sw*sn*ci)*x+(-sw*cn-cw*sn*ci)*y,(cw*sn+sw*cn*ci)*x+(-sw*sn+cw*cn*ci)*y,sw*si*x+cw*si*y];
}
export function localPosition(id,time){const b=byId[id];if(!b||b.type==='region'||id==='sun')return [0,0,0];return orbitPosition(elementsAt(b,time));}
export function positionsAt(time){
  if(!Number.isFinite(time)||time<MIN_DATE||time>MAX_DATE)throw Error('Date outside supported interval');
  const result={sun:[0,0,0]}, relative={};
  for(const b of catalog){if(b.id==='sun'||b.type==='region')continue;relative[b.id]=localPosition(b.id,time);if(b.parent==='sun')result[b.id]=relative[b.id];}
  // JPL Earth element set is the Earth–Moon barycenter, not Earth center.
  const fraction=byId.moon.massKg/(byId.earth.massKg+byId.moon.massKg);
  result.earth=result.earth.map((v,i)=>v-relative.moon[i]*fraction);
  for(const b of catalog.filter(x=>x.type==='moon'))result[b.id]=relative[b.id].map((v,i)=>v+result[b.parent][i]);
  return result;
}
export function displayRadius(id,mode='explore'){
 const b=byId[id];const r=b.radiusKm??(id==='haumea'?780:3);
 return mode==='relative'?r/AU*21:0.16+.76*Math.pow(r/6371,.44);
}
export function toDisplay(vector,mode='explore',satellite=false,parentId='earth'){
 const r=length(vector);if(!r)return [0,0,0];
 let distance=mode==='relative'?r/AU*21:21*Math.pow(r/AU,.42);
 if(satellite&&mode!=='relative')distance=displayRadius(parentId,mode)*3+2.2*Math.sqrt(r/384400);
 const f=distance/r;
 return [vector[0]*f,vector[2]*f,-vector[1]*f];
}
export function displayPositions(physical,mode='explore'){
 const out={sun:[0,0,0]};
 for(const b of catalog.filter(x=>x.parent==='sun'&&x.type!=='region'))out[b.id]=toDisplay(physical[b.id],mode);
 for(const b of catalog.filter(x=>x.type==='moon'))out[b.id]=toDisplay(subtract(physical[b.id],physical[b.parent]),mode,true,b.parent).map((v,i)=>v+out[b.parent][i]);
 return out;
}
export function measure(a,b,time){const p=positionsAt(time),km=length(subtract(p[a],p[b]));return {km,au:km/AU,lightSeconds:km/C,time,a,b};}
export function angularSeparation(observer,a,b,time){
 const p=positionsAt(time),x=subtract(p[a],p[observer]),y=subtract(p[b],p[observer]),den=length(x)*length(y);
 if(den>=1e-10&&a===b)return 0;
 return den<1e-10?null:Math.acos(Math.max(-1,Math.min(1,x.reduce((s,v,i)=>s+v*y[i],0)/den)))/RAD;
}
export function orbitalPeriod(aAU,massSolar=1){if(!Number.isFinite(aAU)||aAU<=0||!Number.isFinite(massSolar)||massSolar<=0)throw Error('Invalid two-body parameters');return TAU*Math.sqrt((aAU*AU*1000)**3/(G*byId.sun.massKg*massSolar))/DAY;}
export const gravity=(massKg,radiusKm)=>Number.isFinite(massKg)&&massKg>0&&Number.isFinite(radiusKm)&&radiusKm>0?G*massKg/(radiusKm*1000)**2:null;
export function daylight(tilt,latitude,longitude){
 const declination=Math.asin(Math.sin(tilt*RAD)*Math.sin(longitude*RAD));
 const p=latitude*RAD;
 if(Math.abs(Math.cos(p))<1e-10)return Math.abs(declination)<1e-10?12:Math.sign(p)===Math.sign(declination)?24:0;
 const x=-Math.tan(p)*Math.tan(declination);
 return x<=-1?24:x>=1?0:24*Math.acos(x)/Math.PI;
}
export const lunarIllumination=angle=>(1-Math.cos(angle*RAD))/2;
export function solarDayHours(id){const b=byId[id];if(!b?.rotationDays||!b.parent)return null;const orbitalPeriod=byId[b.parent]?.periodDays||b.periodDays;if(!orbitalPeriod)return null;const frequency=1/b.rotationDays-1/orbitalPeriod;return Math.abs(frequency)<1e-14?null:Math.abs(24/frequency);}
export const distanceUnit=(km,unit='km')=>unit==='mi'?km*.621371192237334:unit==='au'?km/AU:km;
export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function searchBodies(query){const q=normalize(query);return catalog.filter(b=>normalize([b.names.pt,b.names.en,b.id,b.id==='earth'?'Terra Earth Tellus':b.id==='sun'?'Sol Sun Solar':''].join(' ')).includes(q));}
export function validateRate(raw){const value=typeof raw==='number'?raw:Number(String(raw).trim().replace(',','.'));if(String(raw).trim()===''||!Number.isFinite(value)||Math.abs(value)>31557600)throw Error('Use a finite rate between −31,557,600× and 31,557,600×');return value;}
export function validateTime(raw){const time=typeof raw==='number'?raw:Date.parse(raw);if(!Number.isFinite(time)||time<MIN_DATE||time>MAX_DATE)throw Error('Supported dates: 1800-01-01 to 2050-01-01 UTC');return time;}
export function formatNumber(value,lang='pt',digits=2){if(value==null||!Number.isFinite(value))return '—';return new Intl.NumberFormat(lang==='pt'?'pt-BR':'en-US',{maximumFractionDigits:digits,notation:Math.abs(value)>=1e12?'scientific':'standard'}).format(value);}
export const formatDate=(time,lang='pt',seconds=false)=>new Intl.DateTimeFormat(lang==='pt'?'pt-BR':'en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}).format(time);
export const ratePhrase=(rate,lang='pt')=>rate===1?(lang==='pt'?'tempo real':'real time'):rate===DAY?(lang==='pt'?'1 dia por segundo':'1 day per second'):rate===DAY*7?(lang==='pt'?'1 semana por segundo':'1 week per second'):rate===DAY*30?(lang==='pt'?'30 dias por segundo':'30 days per second'):rate===3600?(lang==='pt'?'1 hora por segundo':'1 hour per second'):`${formatNumber(rate,lang)}×`;
export function catalogProblems(){const errors=[],seen=new Set();for(const b of catalog){if(seen.has(b.id))errors.push(`Duplicate ${b.id}`);seen.add(b.id);if(b.parent&&!byId[b.parent])errors.push(`Missing parent ${b.id}`);if(b.radiusKm!=null&&b.radiusKm<=0)errors.push(`Invalid radius ${b.id}`);if(b.massKg!=null&&b.massKg<=0)errors.push(`Invalid mass ${b.id}`);if(b.eccentricity!=null&&(b.eccentricity<0||b.eccentricity>=1))errors.push(`Invalid eccentricity ${b.id}`);if(!b.description.pt||!b.description.en)errors.push(`Missing description ${b.id}`);}return errors;}
