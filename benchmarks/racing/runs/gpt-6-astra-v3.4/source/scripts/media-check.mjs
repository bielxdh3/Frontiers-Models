import {readFile,writeFile} from 'node:fs/promises';

export async function checkWav(directory='verification'){
 const bytes=await readFile(`${directory}/audio-volta.wav`);
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Not a RIFF/WAVE recording');
 let format,data;
 for(let offset=12;offset+8<=bytes.length;){
  const id=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),body=bytes.subarray(offset+8,offset+8+length);
  if(body.length!==length)throw Error('Truncated WAV chunk');
  if(id==='fmt ')format={codec:body.readUInt16LE(0),channels:body.readUInt16LE(2),sampleRate:body.readUInt32LE(4),sampleWidth:body.readUInt16LE(14)/8};
  if(id==='data')data=body;
  offset+=8+length+(length%2);
 }
 if(format?.codec!==1||format.sampleWidth!==2||!data?.length)throw Error('Expected non-empty 16-bit PCM');
 let peak=0,square=0;for(let offset=0;offset<data.length;offset+=2){const sample=data.readInt16LE(offset)/32768;peak=Math.max(peak,Math.abs(sample));square+=sample*sample;}
 const result={channels:format.channels,sampleRate:format.sampleRate,sampleWidth:format.sampleWidth,seconds:data.length/(format.sampleRate*format.channels*format.sampleWidth),peakDbFS:20*Math.log10(peak),rmsDbFS:10*Math.log10(square/(data.length/2)),silent:peak===0};
 await writeFile(`${directory}/media-check.json`,JSON.stringify(result,null,2));return result;
}
