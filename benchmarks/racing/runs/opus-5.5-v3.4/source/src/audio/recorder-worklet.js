// Pass-through AudioWorklet that also records the master output (after the limiter)
// and tracks the absolute peak. Messages: {cmd:'start'|'stop'} -> posts chunks.
class MasterTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rec = false; this.peak = 0; this.bufL = []; this.bufR = []; this.count = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.cmd === 'start') { this.rec = true; this.peak = 0; this.bufL = []; this.bufR = []; this.count = 0; }
      else if (m.cmd === 'stop') { this.rec = false; this.flush(true); }
      else if (m.cmd === 'peak') { this.port.postMessage({ type: 'peak', peak: this.peak }); }
      else if (m.cmd === 'resetPeak') { this.peak = 0; }
    };
  }
  flush(final) {
    if (this.bufL.length) {
      const n = this.bufL.reduce((a, b) => a + b.length, 0);
      const L = new Float32Array(n), R = new Float32Array(n); let o = 0;
      for (let i = 0; i < this.bufL.length; i++) { L.set(this.bufL[i], o); R.set(this.bufR[i], o); o += this.bufL[i].length; }
      this.port.postMessage({ type: 'chunk', L, R }, [L.buffer, R.buffer]);
      this.bufL = []; this.bufR = []; this.count = 0;
    }
    if (final) this.port.postMessage({ type: 'done', peak: this.peak });
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    if (!inp || !inp.length) return true;
    const l = inp[0], r = inp[1] || inp[0];
    for (let c = 0; c < out.length; c++) out[c].set(inp[Math.min(c, inp.length - 1)]);
    for (let i = 0; i < l.length; i++) { const a = Math.abs(l[i]), b = Math.abs(r[i]); if (a > this.peak) this.peak = a; if (b > this.peak) this.peak = b; }
    if (this.rec) { this.bufL.push(new Float32Array(l)); this.bufR.push(new Float32Array(r)); this.count += l.length; if (this.count > 48000) this.flush(false); }
    return true;
  }
}
registerProcessor('master-tap', MasterTap);
