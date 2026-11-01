import { cleanSettings } from './config.js';
import { validateReplay, parseReplay, MAX_BYTES } from './replay.js';
const safeId = id => typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export class LocalStore {
  constructor(namespace='mare-alta-v1') {this.ns=namespace;this.dir=null;this.error='';this.available=false;}
  loadSettings(){try{return cleanSettings(JSON.parse(localStorage.getItem(`${this.ns}:settings`)));}catch{return cleanSettings(null);}}
  saveSettings(settings){try{localStorage.setItem(`${this.ns}:settings`,JSON.stringify(settings));return true;}catch{this.error='Preferências temporárias: o navegador recusou a gravação.';return false;}}
  async init() {
    try {
      if(!navigator.storage?.getDirectory||!navigator.locks?.request)throw new Error('Armazenamento de arquivos ou bloqueio entre abas indisponível.');
      const root=await navigator.storage.getDirectory();this.dir=await root.getDirectoryHandle(this.ns,{create:true});
      const key=`${this.ns}:probe`;localStorage.setItem(key,'1');localStorage.removeItem(key);this.available=true;
    }catch(e){this.error=`Replays temporários. ${e.message} Você ainda pode exportar arquivos.`;this.available=false;}
    return this.available;
  }
  manifest() {
    const text=localStorage.getItem(`${this.ns}:library`);
    if(!text)return {rev:0,entries:[]};
    try{const m=JSON.parse(text);if(!Number.isSafeInteger(m.rev)||!Array.isArray(m.entries)||m.entries.length>5||new Set(m.entries.map(e=>e.id)).size!==m.entries.length||!m.entries.every(e=>safeId(e.id)&&typeof e.label==='string'&&e.label.length<=100&&['local','imported','harness'].includes(e.origin)))throw Error();return m;}catch{throw new Error('Índice local danificado. Os arquivos foram preservados; use a recuperação da biblioteca.');}
  }
  async exclusive(fn){if(!this.available)throw new Error(this.error||'Armazenamento indisponível. Exporte o replay.');return navigator.locks.request(`${this.ns}:files`,{mode:'exclusive'},fn);}
  commit(m){localStorage.setItem(`${this.ns}:library`,JSON.stringify(m));}
  async readEnvelope(id){if(!safeId(id))throw new Error('Identificador inválido.');const h=await this.dir.getFileHandle(`${id}.json`),f=await h.getFile();if(f.size>MAX_BYTES+1024)throw new Error('Arquivo local excede o limite.');const env=JSON.parse(await f.text());const replay=validateReplay(env.replay);return {replay,origin:['local','imported','harness'].includes(env.origin)?env.origin:'imported'};}
  metadata(id,replay,origin){return {id,label:replay.label,created:replay.created,mode:replay.setup.mode,car:replay.setup.car,duration:replay.duration,status:replay.status,origin};}
  async list() {
    if(!this.available)return {entries:[],orphans:[],errors:[this.error]};
    return this.exclusive(async()=>{
      let m,broken=false;const errors=[];
      try{m=this.manifest();}catch(e){m={rev:0,entries:[]};broken=true;errors.push(e.message);}
      const entries=[],orphans=[],known=new Set(m.entries.map(e=>e.id));
      for(const e of m.entries){try{const env=await this.readEnvelope(e.id);entries.push(this.metadata(e.id,env.replay,env.origin));}catch(err){entries.push({...e,broken:true});errors.push(`“${e.label}”: arquivo indisponível. Remova a entrada somente se desejar.`);}}
      for await(const [name,handle] of this.dir.entries())if(handle.kind==='file'&&name.endsWith('.json')&&safeId(name.slice(0,-5))&&!known.has(name.slice(0,-5))) {
        const id=name.slice(0,-5);try{const env=await this.readEnvelope(id);orphans.push(this.metadata(id,env.replay,env.origin));}catch{orphans.push({id,label:'Arquivo interrompido',broken:true,origin:'imported'});}
      }
      return {entries,orphans,errors,broken};
    });
  }
  async load(id){return this.exclusive(()=>this.readEnvelope(id));}
  async save(data,origin='local',replaceId=null) {
    const replay=validateReplay(data);
    if(data.origin==='harness'&&!this.ns.startsWith('mare-alta-test-'))throw new Error('Gravações de teste não podem entrar na biblioteca do jogador.');
    if(!['local','imported','harness'].includes(origin))throw new Error('Origem inválida.');
    return this.exclusive(async()=>{
      const m=this.manifest();
      if(replaceId&&!m.entries.some(e=>e.id===replaceId))throw new Error('A biblioteca mudou em outra aba. Atualize e escolha novamente.');
      if(!replaceId&&m.entries.length>=5){const e=new Error('A biblioteca está cheia. Escolha um replay para substituir ou cancele.');e.code='FULL';throw e;}
      const id=crypto.randomUUID(),text=JSON.stringify({origin,replay});
      if(new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Replay grande demais para a biblioteca. Use exportação.');
      const handle=await this.dir.getFileHandle(`${id}.json`,{create:true});
      const writer=await handle.createWritable();try{await writer.write(text);await writer.close();}catch(e){try{await writer.abort();}catch{}throw e;}
      await this.readEnvelope(id);
      const entry=this.metadata(id,replay,origin),next=m.entries.filter(e=>e.id!==replaceId);next.push(entry);
      // The old recording survives any failed file write or metadata commit.
      this.commit({rev:m.rev+1,entries:next});
      if(replaceId){try{await this.dir.removeEntry(`${replaceId}.json`);}catch{/* valid old file becomes recoverable orphan */}}
      return entry;
    });
  }
  async remove(id,orphan=false){return this.exclusive(async()=>{if(!safeId(id))throw new Error('Identificador inválido.');const m=this.manifest();if(!orphan){const old=m.entries.find(e=>e.id===id);if(!old)throw new Error('A entrada já foi alterada em outra aba.');this.commit({rev:m.rev+1,entries:m.entries.filter(e=>e.id!==id)});}try{await this.dir.removeEntry(`${id}.json`);}catch(e){if(e.name!=='NotFoundError')throw new Error('Índice atualizado; o arquivo permanece na recuperação.');}});}
  async recover(id,replaceId=null){return this.exclusive(async()=>{const env=await this.readEnvelope(id);const m=this.manifest();if(m.entries.some(e=>e.id===id))return;if(replaceId&&!m.entries.some(e=>e.id===replaceId))throw new Error('A biblioteca mudou.');if(!replaceId&&m.entries.length>=5){const e=new Error('Cinco espaços ocupados. Exporte ou escolha uma substituição.');e.code='FULL';throw e;}this.commit({rev:m.rev+1,entries:[...m.entries.filter(e=>e.id!==replaceId),this.metadata(id,env.replay,env.origin)]});if(replaceId)try{await this.dir.removeEntry(`${replaceId}.json`);}catch{}});}
  async repairManifest(){return this.exclusive(async()=>{try{this.manifest();}catch{localStorage.setItem(`${this.ns}:library-backup`,localStorage.getItem(`${this.ns}:library`)||'');this.commit({rev:1,entries:[]});}});}
  records(){try{const arr=JSON.parse(localStorage.getItem(`${this.ns}:records`)||'[]');return Array.isArray(arr)?arr.filter(r=>r&&Number.isFinite(r.time)&&r.time>0&&r.time<3600&&typeof r.car==='string'&&typeof r.weather==='string'&&typeof r.daylight==='string').slice(0,12):[];}catch{return [];}}
  async award(r) {
    if(r.status!=='finished'||r.setup.mode!=='trial'||r.cars[0].completed!==3||r.best===null)return false;
    if(r.origin==='harness'&&!this.ns.startsWith('mare-alta-test-'))return false;
    if(r.origin!=='local'&&r.origin!=='harness')return false;
    try{return await navigator.locks.request(`${this.ns}:records`,async()=>{const records=this.records(),key=`${r.setup.car}/${r.setup.weather}/${r.setup.daylight}`,old=records.find(v=>v.key===key);if(old&&old.time<=r.best)return false;const next=records.filter(v=>v.key!==key);next.push({key,time:r.best,car:r.setup.car,weather:r.setup.weather,daylight:r.setup.daylight,date:new Date().toISOString(),origin:r.origin});localStorage.setItem(`${this.ns}:records`,JSON.stringify(next.slice(-12)));return true;});}catch{this.error='Recorde não salvo: armazenamento indisponível.';return false;}
  }
}
export async function fileToReplay(file){if(!file||file.size>MAX_BYTES)throw new Error('Selecione um JSON de replay de até 32 MB.');return parseReplay(await file.text());}
export function downloadReplay(replay){downloadBlob(new Blob([JSON.stringify(replay)],{type:'application/json'}),`mare-alta-${replay.setup.mode}-${replay.origin==='harness'?'teste-':''}replay.json`);}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
