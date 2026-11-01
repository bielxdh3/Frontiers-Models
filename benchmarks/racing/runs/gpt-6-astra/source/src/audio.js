import { clamp } from './config.js';
export class GameAudio {
  constructor(){this.ctx=null;this.available=true;this.lastEvent=0;}
  async enable(){
    try{
      if(!this.ctx){
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('AudioContext unavailable');
        this.ctx=new AC();const c=this.ctx;this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
        this.engineGain=c.createGain();this.engineGain.gain.value=0;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=600;this.engineGain.connect(filter);filter.connect(this.master);
        this.osc=c.createOscillator();this.osc.type='sawtooth';this.osc.frequency.value=45;this.osc.connect(this.engineGain);this.osc.start();
        this.sub=c.createOscillator();this.sub.type='triangle';this.sub.frequency.value=23;this.sub.connect(this.engineGain);this.sub.start();
        const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let seed=4;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
        this.noise=c.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;const nf=c.createBiquadFilter();nf.type='bandpass';nf.frequency.value=850;this.noiseGain=c.createGain();this.noiseGain.gain.value=0;this.noise.connect(nf);nf.connect(this.noiseGain);this.noiseGain.connect(this.master);this.noise.start();
      }
      await this.ctx.resume();return true;
    }catch{this.available=false;return false;}
  }
  update(state,active,settings){if(!this.ctx)return;const t=this.ctx.currentTime,p=state?.cars?.[0];this.master.gain.setTargetAtTime(settings.mute?0:settings.volume,t,.05);this.engineGain.gain.setTargetAtTime(active?.045:0,t,.06);this.noiseGain.gain.setTargetAtTime(active&&p?(p.drift?.035:p.boost?.018:state.climate.wet*.009):0,t,.04);if(p){const f=42+Math.abs(p.speed)*2.8+(p.boost?35:0);this.osc.frequency.setTargetAtTime(f,t,.08);this.sub.frequency.setTargetAtTime(f*.49,t,.08);}}
  silence(){if(!this.ctx)return;const t=this.ctx.currentTime;this.engineGain.gain.cancelScheduledValues(t);this.engineGain.gain.setValueAtTime(0,t);this.noiseGain.gain.cancelScheduledValues(t);this.noiseGain.gain.setValueAtTime(0,t);}
  cue(kind){if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=kind==='collision'?'triangle':'sine';o.frequency.setValueAtTime(kind==='collision'?75:kind==='finish'?660:kind==='gate'?880:440,t);o.frequency.exponentialRampToValueAtTime(kind==='collision'?25:kind==='finish'?1320:660,t+.15);g.gain.setValueAtTime(.065,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.24);o.onended=()=>{o.disconnect();g.disconnect();};}
}
