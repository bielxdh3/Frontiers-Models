// AudioWorklet: look-ahead brick-wall limiter (master) + PCM recorder tap that reads the limiter OUTPUT.
//
// Limiter maths (so the ceiling is guaranteed, not "usually respected"):
//   g_req[n]  = min(1, ceil / max(|L[n]|,|R[n]|))           gain that would make sample n touch the ceiling
//   g_min[n]  = min(g_req[n-N+1 .. n])                       sliding minimum over the look-ahead window
//   env[n]    = instant attack / one-pole release of g_min   (env[n] <= g_min[n])
//   g[n]      = mean(env[n-N+1 .. n])                         smooth ramp (boxcar) -> no zipper, no click
//   out[n]    = in[n-(N-1)] * g[n]
// For the delayed sample m = n-(N-1) every term of the boxcar is <= g_req[m], so |out| <= ceil.  A final hard clip at -1.0 dBFS
// stays as a safety net for numeric accidents (NaN/Inf are zeroed).
const CEIL = 0.85;        // -1.41 dBFS target
const HARD = 0.8912509;   // -1.00 dBFS absolute clip

class Limiter extends AudioWorkletProcessor {
  constructor() {
    super();
    const N = 128;
    this.N = N;
    this.dl = new Float32Array(N); this.dr = new Float32Array(N); this.w = 0;
    this.req = new Float32Array(N).fill(1);          // ring of g_req
    this.envr = new Float32Array(N).fill(1); this.sum = N; this.env = 1; this.tick = 0;
    this.rel = Math.exp(-1 / (0.14 * sampleRate));   // 140 ms release
    this.peak = 0; this.blockPeak = 0; this.reduction = 1; this.frames = 0;
    this.recOn = false; this.RL = new Float32Array(4096); this.RR = new Float32Array(4096); this.ri = 0; this.recFrames = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m === 'rec-start') { this.recOn = true; this.ri = 0; this.recFrames = 0; }
      else if (m === 'rec-stop') { this.flush(); this.recOn = false; this.port.postMessage({ type: 'rec-end', frames: this.recFrames, sampleRate }); }
      else if (m === 'peak-reset') { this.peak = 0; }
    };
  }
  flush() {
    if (this.ri > 0) {
      const L = this.RL.slice(0, this.ri), R = this.RR.slice(0, this.ri);
      this.port.postMessage({ type: 'rec', L, R }, [L.buffer, R.buffer]);
      this.ri = 0;
    }
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const inp = inputs[0];
    const n = out[0].length;
    const iL = inp && inp[0] ? inp[0] : null, iR = inp && inp[1] ? inp[1] : iL;
    const oL = out[0], oR = out[1] || out[0];
    const N = this.N, dl = this.dl, dr = this.dr, req = this.req, envr = this.envr, rel = this.rel;
    let w = this.w, sum = this.sum, env = this.env, bp = 0, minG = 1;
    for (let i = 0; i < n; i++) {
      let l = iL ? iL[i] : 0, r = iR ? iR[i] : 0;
      if (!(l === l) || l > 1e3 || l < -1e3) l = 0;     // NaN / Inf guard
      if (!(r === r) || r > 1e3 || r < -1e3) r = 0;
      const pk = l > 0 ? (r > 0 ? (l > r ? l : r) : (l > -r ? l : -r)) : (r > 0 ? (-l > r ? -l : r) : (-l > -r ? -l : -r));
      const g = pk > CEIL ? CEIL / pk : 1;
      req[w] = g; dl[w] = l; dr[w] = r;
      // sliding minimum over the window (N = 128 compares per sample: negligible)
      let gm = 1;
      for (let k = 0; k < N; k++) { const q = req[k]; if (q < gm) gm = q; }
      // instant attack, smooth release (envelope never above g_min)
      env = gm < env ? gm : env + (gm - env) * (1 - rel);
      if (env > gm) env = gm;
      sum += env - envr[w]; envr[w] = env;
      const gain = sum / N;
      // delayed sample (N-1 samples old)
      const rp = (w + 1) % N;
      let yl = dl[rp] * gain, yr = dr[rp] * gain;
      yl = yl > HARD ? HARD : yl < -HARD ? -HARD : yl;
      yr = yr > HARD ? HARD : yr < -HARD ? -HARD : yr;
      oL[i] = yl; oR[i] = yr;
      const a = (yl < 0 ? -yl : yl), b = (yr < 0 ? -yr : yr), m = a > b ? a : b;
      if (m > bp) bp = m;
      if (gain < minG) minG = gain;
      if (this.recOn) {
        this.RL[this.ri] = yl; this.RR[this.ri] = yr; this.ri++; this.recFrames++;
        if (this.ri >= 4096) this.flush();
      }
      w = rp;
    }
    this.w = w; this.sum = sum; this.env = env;
    if (bp > this.peak) this.peak = bp;
    if (bp > this.blockPeak) this.blockPeak = bp;
    if (minG < this.reduction) this.reduction = minG;
    this.frames += n;
    if (this.frames >= 4800) {            // ~100 ms
      this.port.postMessage({ type: 'meter', peak: this.peak, block: this.blockPeak, gr: this.reduction });
      this.blockPeak = 0; this.reduction = 1; this.frames = 0;
      if (++this.tick % 50 === 0) {       // resync the running sum against float drift
        let s = 0; for (let k = 0; k < N; k++) s += envr[k]; this.sum = s;
      }
    }
    return true;
  }
}
registerProcessor('limiter', Limiter);
