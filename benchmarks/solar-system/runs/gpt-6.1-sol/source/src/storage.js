import {byId} from './data.js';
import {validateTime,START} from './science.js';
export const STORAGE_KEY='orbita-observatory-v1';
export const defaults={lang:'pt',quality:'auto',scale:'explore',labels:'major',orbits:'all',background:.65,presentation:'enhanced',exposure:1.12,reducedMotion:false,contrast:false,textSize:1,panelOpacity:.93,diameterUnit:'km',distanceUnit:'au',grid:false,axes:false,velocity:false,apsides:false,trail:false,trailDays:30,trailFade:true,smallBodies:false,tidal:false,frame:'sun',audio:false};
export const emptyCollection=()=>({version:1,settings:{...defaults},favorites:[],views:[],bookmarks:[],notes:[],experiments:[],completed:[],visited:[],onboarded:false,toursCompleted:[]});
const safeText=(v,max=3000)=>typeof v==='string'&&v.length<=max;
export function validateCollection(value){
 if(!value||typeof value!=='object'||value.version!==1)throw Error('Unsupported observatory file version');
 const out=emptyCollection();
 if(value.settings){for(const [key,def] of Object.entries(defaults))if(typeof value.settings[key]===typeof def)out.settings[key]=value.settings[key];}
 const choices={lang:['pt','en'],quality:['auto','low','medium','high'],scale:['explore','relative'],labels:['major','system','selected','favorites','none'],orbits:['all','selected','system','none'],presentation:['natural','enhanced'],diameterUnit:['km','mi'],distanceUnit:['au','km'],frame:['sun','earth']};
 for(const [k,v] of Object.entries(choices))if(!v.includes(out.settings[k]))throw Error(`Invalid setting: ${k}`);
 for(const [k,min,max] of [['background',0,1],['exposure',.3,2],['textSize',.9,1.4],['panelOpacity',.65,1],['trailDays',1,365]])if(!Number.isFinite(out.settings[k])||out.settings[k]<min||out.settings[k]>max)throw Error(`Invalid setting: ${k}`);
 for(const key of ['favorites','visited']){if(value[key]!=null&&(!Array.isArray(value[key])||value[key].length>100||value[key].some(id=>!byId[id])))throw Error(`Invalid ${key}`);out[key]=[...new Set(value[key]||[])];}
 for(const key of ['views','bookmarks','notes','experiments']){
  if(value[key]!=null&&(!Array.isArray(value[key])||value[key].length>200))throw Error(`Invalid ${key}`);
  out[key]=(value[key]||[]).map(v=>{
   if(!v||!safeText(v.id,100)||!safeText(v.title,160)||(v.target&&!byId[v.target])||(v.text!=null&&!safeText(v.text)))throw Error(`Invalid ${key} entry`);
   if(v.time!=null)validateTime(v.time);
   if(v.camera){if(!Array.isArray(v.camera.offset)||v.camera.offset.length!==3||v.camera.offset.some(x=>!Number.isFinite(x)||Math.abs(x)>1e6)||!Number.isFinite(v.camera.distance)||v.camera.distance<=0||v.camera.distance>1e6)throw Error('Invalid camera');}
   if(v.camera){if(v.camera.target&&!byId[v.camera.target])throw Error('Invalid camera target');for(const k of ['targetPosition','targetOffset'])if(v.camera[k]&&(!Array.isArray(v.camera[k])||v.camera[k].length!==3||v.camera[k].some(x=>!Number.isFinite(x)||Math.abs(x)>1e6)))throw Error('Invalid camera framing');}
   if(v.overlays&&(!['major','system','selected','favorites','none'].includes(v.overlays.labels)||!['all','system','selected','none'].includes(v.overlays.orbits)))throw Error('Invalid overlays');
   if(v.params){const p=v.params;if(!Number.isFinite(p.mass)||p.mass<.1||p.mass>5||!Number.isFinite(p.a)||p.a<.2||p.a>8||!Number.isFinite(p.e)||p.e<0||p.e>.85)throw Error('Invalid experiment');}
   if(v.scale&&!['explore','relative'].includes(v.scale))throw Error('Invalid saved scale');
   return {id:v.id,title:v.title,...(v.target?{target:v.target}:{}),time:v.time??START,...(v.text!=null?{text:v.text}:{}),...(v.camera?{camera:{offset:v.camera.offset,distance:v.camera.distance,mode:['focus','follow','free','overview','system'].includes(v.camera.mode)?v.camera.mode:'focus',...(v.camera.target?{target:v.camera.target}:{}),...(v.camera.targetPosition?{targetPosition:v.camera.targetPosition}:{}),...(v.camera.targetOffset?{targetOffset:v.camera.targetOffset}:{})}}:{}),...(v.scale?{scale:v.scale}:{}),...(v.overlays?{overlays:{labels:v.overlays.labels,orbits:v.overlays.orbits}}:{}),...(typeof v.restoreDate==='boolean'?{restoreDate:v.restoreDate}:{}),...(v.params?{params:{mass:v.params.mass,a:v.params.a,e:v.params.e}}:{})};
  });
 }
 out.completed=Array.isArray(value.completed)?value.completed.filter(x=>Number.isInteger(x)&&x>=0&&x<12):[];
 out.toursCompleted=Array.isArray(value.toursCompleted)?value.toursCompleted.filter(x=>typeof x==='string'&&x.length<60):[];
 out.onboarded=value.onboarded===true;return out;
}
export function loadCollection(storage=globalThis.localStorage){try{const raw=storage.getItem(STORAGE_KEY);return {data:raw?validateCollection(JSON.parse(raw)):emptyCollection(),error:null};}catch(e){return {data:emptyCollection(),error:e.message};}}
export function saveCollection(data,storage=globalThis.localStorage){try{storage.setItem(STORAGE_KEY,JSON.stringify(data));return {ok:true};}catch(e){return {ok:false,error:e.message};}}
export function parseImport(text){if(typeof text!=='string'||text.length>1e6)throw Error('File exceeds 1 MB');return validateCollection(JSON.parse(text));}
export function publicScene({selected,time,scale,camera,labels,orbits}){if(!byId[selected])throw Error('Invalid target');validateTime(time);return {version:1,title:'Observatory scene',target:selected,time,scale,camera,labels,orbits};}
export function parseScene(text){
 if(typeof text!=='string'||text.length>50000)throw Error('Scene file exceeds 50 KB');
 const v=JSON.parse(text),c=v?.camera;
 if(v?.version!==1||!byId[v.target]||!['explore','relative'].includes(v.scale)||!c||!['focus','follow','system','overview','free'].includes(c.mode))throw Error('Invalid scene');
 validateTime(v.time);
 for(const key of ['offset','targetPosition','targetOffset']){const a=c[key];if(key==='offset'||a!=null){if(!Array.isArray(a)||a.length!==3||a.some(x=>!Number.isFinite(x)||Math.abs(x)>1e6))throw Error('Invalid scene camera');}}
 if(Math.hypot(...c.offset)<1e-9||!Number.isFinite(c.distance)||c.distance<=0||c.distance>1e6||(c.target&&!byId[c.target])||(c.system&&!byId[c.system]))throw Error('Invalid scene target or distance');
 if(v.labels!=null&&!['major','system','selected','favorites','none'].includes(v.labels))throw Error('Invalid scene labels');
 if(v.orbits!=null&&!['all','system','selected','none'].includes(v.orbits))throw Error('Invalid scene orbits');
 return {version:1,target:v.target,time:v.time,scale:v.scale,camera:{target:c.target||v.target,mode:c.mode,offset:c.offset,distance:c.distance,...(c.system?{system:c.system}:{}),...(c.targetPosition?{targetPosition:c.targetPosition}:{}),...(c.targetOffset?{targetOffset:c.targetOffset}:{})},labels:v.labels,orbits:v.orbits};
}
