class Capture extends AudioWorkletProcessor{
 constructor(){super();this.active=false;this.buffer=new Float32Array(8192);this.offset=0;this.peak=0;this.port.onmessage=e=>{if(e.data==='start'){this.active=true;this.offset=0;this.peak=0;}if(e.data==='stop'){this.active=false;this.flush();this.port.postMessage({done:true,peak:this.peak});}};}
 flush(){if(!this.offset)return;const samples=this.buffer.slice(0,this.offset);this.port.postMessage({samples},[samples.buffer]);this.offset=0;}
 process(inputs){if(this.active&&inputs[0]?.length){const left=inputs[0][0],right=inputs[0][1]||left;for(let i=0;i<left.length;i++){this.peak=Math.max(this.peak,Math.abs(left[i]),Math.abs(right[i]));this.buffer[this.offset++]=left[i];this.buffer[this.offset++]=right[i];if(this.offset===this.buffer.length)this.flush();}}return true;}
}
registerProcessor('master-capture',Capture);
