import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';
// These are edits of the locally packaged CC0 recording, never oscillators.
const decoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-i','public/assets/engine-source.mp3','-f','f32le','-ac','1','-ar','44100','pipe:1'],{maxBuffer:40e6});
if(decoded.status!==0)throw Error(decoded.stderr.toString());const pcm=new Float32Array(decoded.stdout.buffer,decoded.stdout.byteOffset,decoded.stdout.byteLength/4),sr=44100;
const segments=[3.3,8.1,11.8,15.3];
for(let model=0;model<2;model++)for(let band=0;band<4;band++){
 const start=Math.floor(segments[band]*sr),fade=2205,len=sr*2-fade;let data=new Float32Array(len);let peak=0;
 for(let i=0;i<len;i++){const p=start+Math.floor((i+fade)*(model?1.12:1)),a=pcm[Math.min(p,pcm.length-1)];data[i]=a;peak=Math.max(peak,Math.abs(a))}
 // Crossfade the tail into the original head, then wrap to the next head sample.
 for(let i=0;i<fade;i++){const a=i/(fade-1),head=pcm[start+Math.floor(i*(model?1.12:1))];data[len-fade+i]=data[len-fade+i]*(1-a)+head*a}
 const out=Buffer.alloc(44+len*2);out.write('RIFF',0);out.writeUInt32LE(36+len*2,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sr,24);out.writeUInt32LE(sr*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(len*2,40);let prev=data[len-1]/Math.max(.02,peak)*.65;
 for(let i=0;i<len;i++){const raw=data[i]/Math.max(.02,peak)*.65;prev=prev*.22+raw*.78;out.writeInt16LE(Math.max(-32767,Math.min(32767,prev*32767)),44+i*2)}
 await writeFile(`public/assets/engine-${model}-${band}.wav`,out);
}
console.log('8 sample loops derived from CC0 real car recording (2 timbre treatments x 4 bands).');
