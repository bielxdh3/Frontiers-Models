import {clamp,random} from './track.js';
const ENGINE_FILES=['gt-idle','gt-low','gt-mid','gt-high','hatch-idle','hatch-low','hatch-mid','hatch-high'];
export class AudioEngine{
 constructor(){this.bytes={};this.buffers={};this.voices=[];this.oneshots=new Set();this.events=[];this.volumes={master:.75,effects:.85,music:.2};this.maxVoices=0;this.model='gt';this.active=false;this.lastImpact=-10;this.lastSlip=-10;this.lastBridge=false;}
 async load(progress=()=>{}){let n=0;await Promise.all([...ENGINE_FILES,'tires','impact','gravel'].map(async file=>{this.bytes[file]=await(await fetch(`assets/audio/${file}.mp3`)).arrayBuffer();progress(++n/11);}));}
 async unlock(){if(this.context){await this.context.resume();return;}
  const c=this.context=new AudioContext({sampleRate:48000});this.master=c.createGain();this.master.gain.value=this.volumes.master;
  const compressor=c.createDynamicsCompressor();compressor.threshold.value=-5;compressor.knee.value=3;compressor.ratio.value=20;compressor.attack.value=.003;compressor.release.value=.12;
  const limiter=c.createWaveShaper();limiter.curve=Float32Array.from({length:4097},(_,i)=>clamp(i/2048-1,-.88,.88));limiter.oversample='none';this.master.connect(compressor).connect(limiter);
  this.stream=c.createMediaStreamDestination();this.analyser=c.createAnalyser();limiter.connect(this.stream);limiter.connect(this.analyser);limiter.connect(c.destination);this.buses={};
  for(const key of['player','ai','effects','ambience','ui','music']){const bus=c.createGain();bus.gain.value=key==='ai'?.32:key==='ambience'?.20:1;bus.connect(this.master);this.buses[key]=bus;}
  await Promise.all(Object.keys(this.bytes).map(async name=>{const decoded=await c.decodeAudioData(this.bytes[name].slice(0));this.buffers[name]=this.prepare(decoded,name);}));
  await c.audioWorklet.addModule('src/audio-capture.js');this.capture=new AudioWorkletNode(c,'master-capture');const silent=c.createGain();silent.gain.value=0;limiter.connect(this.capture).connect(silent).connect(c.destination);this.captureChunks=[];this.capture.port.onmessage=e=>{if(e.data.samples)this.captureChunks.push(e.data.samples);if(e.data.done){this.capturePeak=e.data.peak;this.captureResolve?.();}};
  this.createAmbience();await c.resume();
 }
 prepare(source,name){
  if(name==='impact'){let peak=0,at=0;const data=source.getChannelData(0);for(let i=0;i<Math.min(data.length,source.sampleRate*3);i++)if(Math.abs(data[i])>peak){peak=Math.abs(data[i]);at=i;}return this.cut(source,Math.max(0,at/source.sampleRate-.025),Math.min(.85,source.duration-at/source.sampleRate),false);}
  const start=name==='gravel'?4:name==='tires'?.38:.09,end=name==='gravel'?10:name==='tires'?1.8:source.duration-.12;
  return this.cut(source,start,end-start,true);
 }
 cut(source,start,duration,loop){
  const rate=source.sampleRate,len=Math.max(128,Math.floor(Math.min(duration,source.duration-start)*rate)),fade=Math.min(Math.floor(rate*.07),Math.floor(len/5)),out=this.context.createBuffer(source.numberOfChannels,loop?len-fade:len,rate);
  let peak=0;for(let ch=0;ch<source.numberOfChannels;ch++){const input=source.getChannelData(ch).subarray(Math.floor(start*rate),Math.floor(start*rate)+len),data=out.getChannelData(ch);data.set(input.subarray(0,data.length));if(loop)for(let i=0;i<fade;i++){const t=i/fade;data[i]=input[len-fade+i]*(1-t)+input[i]*t;}for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}
  const gain=.72/Math.max(.001,peak);for(let ch=0;ch<out.numberOfChannels;ch++){const data=out.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]*=gain;}return out;
 }
 loop(buffer,bus,gain=0){const source=this.context.createBufferSource(),amp=this.context.createGain();source.buffer=buffer;source.loop=true;amp.gain.value=gain;source.connect(amp).connect(bus);source.start();return{source,amp};}
 start(model='gt'){if(!this.context)return;this.stop();this.model=model;this.active=true;this.events=[];this.relative={};this.lastSlip=-10;this.lastImpact=-10;this.lastBridge=false;const c=this.context;
  for(let id=0;id<6;id++){
   const engineGain=c.createGain(),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=6000;engineGain.gain.value=id?.35:.68;filter.connect(engineGain);
   let panner;if(id){panner=c.createPanner();panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=5;panner.maxDistance=85;panner.rolloffFactor=1.1;engineGain.connect(panner).connect(this.buses.ai);}else engineGain.connect(this.buses.player);
   const timbre=id?(id%2?'hatch':'gt'):model,layers=['idle','low','mid','high'].map(band=>this.loop(this.buffers[`${timbre}-${band}`],filter));this.voices.push({id,layers,filter,gain:engineGain,panner,timbre});
  }
  this.tires=this.loop(this.buffers.tires,this.buses.effects);this.rolling=this.loop(this.buffers.gravel,this.buses.effects);this.maxVoices=Math.max(this.maxVoices,6);this.setVolumes(this.volumes);this.pause(false);
 }
 stop(){for(const voice of this.voices){for(const layer of voice.layers){layer.source.stop();layer.source.disconnect();layer.amp.disconnect();}voice.filter.disconnect();voice.gain.disconnect();voice.panner?.disconnect();}this.voices=[];for(const loop of[this.tires,this.rolling])if(loop){loop.source.stop();loop.source.disconnect();loop.amp.disconnect();}this.tires=this.rolling=null;for(const source of this.oneshots){try{source.stop();}catch{}source.disconnect();}this.oneshots.clear();this.active=false;}
 pause(value){if(this.master)this.master.gain.setTargetAtTime(value?0:this.volumes.master,this.context.currentTime,.035);this.paused=value;}
 setVolumes(values){Object.assign(this.volumes,values);if(!this.context)return;this.pause(this.paused);for(const key of['player','effects','ui'])this.buses[key].gain.setTargetAtTime(this.volumes.effects,this.context.currentTime,.03);this.buses.ai.gain.setTargetAtTime(.32*this.volumes.effects,this.context.currentTime,.03);this.buses.music.gain.value=this.volumes.music;}
 update(race,dt){if(!this.context||!this.wind)return;const c=this.context,t=c.currentTime,player=race.vehicles[0],L=player.track.length;
  const listener=c.listener;listener.positionX.value=player.position.x;listener.positionY.value=player.position.y+1;listener.positionZ.value=player.position.z;listener.forwardX.value=Math.sin(player.yaw);listener.forwardY.value=0;listener.forwardZ.value=Math.cos(player.yaw);listener.upY.value=1;
  const zone=player.track.zone(player.s).id||Math.floor(player.s/L*4)+1;this.wind.amp.gain.setTargetAtTime(.055+player.speed*.0015,t,.2);this.wind.filter.frequency.setTargetAtTime(zone===1?850:zone===2?1600:zone===3?420:2400,t,.2);
  if(race.status==='racing'&&Math.floor(race.elapsed*2)%19===0&&t-this.lastBird>5){this.lastBird=t;if(zone===3)this.tone(540,.8,.06,'ambience');else if(zone===1||zone===4){this.tone(zone===1?1300:2500,.28,.025,'ambience',1.4);this.tone(1700,.15,.018,'ambience',.7,.24);}}
  if(!this.active)return;
  for(const voice of this.voices){const v=race.vehicles[voice.id],distance=v.position.distanceTo(player.position),rpm=v.rpm,centers=[1000,2400,4200,6500],weights=centers.map(center=>Math.max(0,1-Math.abs(Math.log(rpm/center))/Math.log(2.1))),sum=weights.reduce((a,b)=>a+b,0)||1;
   voice.layers.forEach((layer,i)=>{layer.amp.gain.setTargetAtTime(weights[i]/sum*(distance>85?0:1),t,.055);const doppler=voice.id?clamp(1+(player.speed-v.speed)*.001,.94,1.06):1;layer.source.playbackRate.setTargetAtTime(clamp(rpm/centers[i],.65,1.65)*doppler*(voice.timbre==='hatch'?1.14:1),t,.04);});
   voice.filter.frequency.setTargetAtTime(1100+v.throttle*5300+rpm*.3,t,.08);voice.gain.gain.setTargetAtTime((voice.id?.35:.68)*(.48+.52*v.throttle),t,.04);
   if(voice.panner){voice.panner.positionX.value=v.position.x;voice.panner.positionY.value=v.position.y+.6;voice.panner.positionZ.value=v.position.z;}
  }
  for(const v of race.vehicles.slice(1)){const delta=v.unwrapped-player.unwrapped;this.relative??={};if(this.relative[v.id]!==undefined&&Math.sign(delta)!==Math.sign(this.relative[v.id])&&Math.abs(delta)<10)this.events.push({type:'ai-pass',time:race.elapsed,id:v.id});this.relative[v.id]=delta;}
  const slip=clamp((player.slip-.13)*3,0,.34);this.tires.amp.gain.setTargetAtTime(slip,t,.06);this.tires.source.playbackRate.setTargetAtTime(.85+player.speed*.008,t,.1);
  const bridge=player.s/L>.88&&player.s/L<.92;this.rolling.amp.gain.setTargetAtTime((player.offroad?.26:bridge?.13:.035)*player.speed/35,t,.10);this.rolling.source.playbackRate.setTargetAtTime(clamp(player.speed/22,.4,1.8),t,.1);
  if(slip>.08&&race.elapsed-this.lastSlip>8){this.events.push({type:'skid',time:race.elapsed});this.lastSlip=race.elapsed;}if(bridge&&!this.lastBridge)this.events.push({type:'bridge',time:race.elapsed});this.lastBridge=bridge;
  if(player.contact&&race.elapsed-this.lastImpact>.55){this.impact(.18);this.events.push({type:'barrier-contact',time:race.elapsed});this.lastImpact=race.elapsed;}
 }
 event(event){if(!this.context)return;if(this.suppress)return;if(event.type==='countdown')this.tone(500,.18,.16);if(event.type==='go')this.tone(1000,.5,.18);if(event.type==='finish'){[660,880,1100].forEach((f,i)=>this.tone(f,.45,.10,'ui',1,i*.16));}if(event.type==='shift')this.play(this.buffers.impact,this.buses.effects,.035,1.8);if(event.type==='collision'){this.impact(clamp(event.impact*.025,.06,.32));}if(event.type==='barrier-contact'){this.impact(.18);}if(['shift','collision','barrier-contact','overtake','finish'].includes(event.type))this.events.push(event);}
 play(buffer,bus,gain=.2,rate=1){const c=this.context,source=c.createBufferSource(),amp=c.createGain();source.buffer=buffer;source.playbackRate.value=rate;amp.gain.value=gain;source.connect(amp).connect(bus);source.start();this.oneshots.add(source);source.onended=()=>{this.oneshots.delete(source);source.disconnect();amp.disconnect();};}
 impact(gain){this.play(this.buffers.impact,this.buses.effects,gain);}
 tone(frequency,duration,gain=.08,bus='ui',sweep=1,delay=0){const c=this.context;if(!c)return;const o=c.createOscillator(),g=c.createGain(),start=c.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(frequency,start);o.frequency.exponentialRampToValueAtTime(frequency*sweep,start+duration);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(gain,start+.012);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g).connect(this.buses[bus]);o.start(start);o.stop(start+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
 createAmbience(){const c=this.context,rng=random(3401),buffer=c.createBuffer(1,c.sampleRate*8,c.sampleRate),data=buffer.getChannelData(0);let sample=0;for(let i=0;i<data.length;i++){sample=(sample+(rng()*2-1)*.02)/1.02;data[i]=sample*5;}const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=850;filter.connect(this.buses.ambience);this.wind=this.loop(buffer,filter,.05);this.wind.filter=filter;this.lastBird=-10;}
 beginCapture(){this.captureChunks=[];this.capturePeak=0;this.capture.port.postMessage('start');}
 async endCapture(){await new Promise(resolve=>{this.captureResolve=resolve;this.capture.port.postMessage('stop');});const total=this.captureChunks.reduce((n,b)=>n+b.length,0),array=new ArrayBuffer(44+total*2),view=new DataView(array);const str=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};str(0,'RIFF');view.setUint32(4,36+total*2,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,this.context.sampleRate,true);view.setUint32(28,this.context.sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,total*2,true);let i=44;for(const chunk of this.captureChunks)for(const s of chunk){view.setInt16(i,Math.round(clamp(s,-1,1)*32767),true);i+=2;}return{array,peakDb:20*Math.log10(Math.max(this.capturePeak,1e-9)),duration:total/2/this.context.sampleRate};}
 stats(){return{engines:this.voices.length,aiVoices:this.voices.filter(v=>v.id).length,sampleSources:this.voices.reduce((n,v)=>n+v.layers.filter(l=>l.source.buffer instanceof AudioBuffer).length,0),maxEngineVoices:this.maxVoices,oneshots:this.oneshots.size,buffers:Object.keys(this.buffers),state:this.context?.state};}
}

