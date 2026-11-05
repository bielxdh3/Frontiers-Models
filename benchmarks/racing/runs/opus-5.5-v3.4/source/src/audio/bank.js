// Runtime sound bank. Every sound is a CC0 field/studio recording from Freesound
// (see ASSET-LICENSES.md). At load time each one is decoded (OfflineAudioContext,
// so nothing is played before the first user interaction), trimmed to a window,
// optionally down-mixed, normalised and — for loops — made seamless by an
// equal-power crossfade of the tail into the head (no click at the wrap point).
// Engine bands come pre-cut from tools/engine-loops.mjs (assets/audio/engine).

const SRC = './assets/audio/src/';
const ENG = './assets/audio/engine/';

// win: [t0, t1] seconds; loop: crossfade length (s) -> seamless loop; rms/peak: dBFS target
export const SOUND_DEFS = {
  squealA: { src: '71738', win: [6.0, 9.3], loop: 0.35, mono: true, rms: -15 },
  squealB: { src: '71737', win: [3.95, 6.6], loop: 0.3, mono: true, rms: -15 },
  road: { src: '860717', win: [44, 58], loop: 1.0, mono: true, rms: -16, rate: 32000 },
  gravel: { src: '251662', win: [2, 14], loop: 0.8, mono: true, rms: -16, rate: 32000 },
  scrape: { src: '398405', win: [2.55, 3.4], loop: 0.15, mono: true, rms: -15 },
  wind: { src: '697217', win: [2, 20], loop: 1.5, rms: -18, rate: 32000 },
  gust: { src: '645305', win: [26, 46], loop: 1.5, mono: true, rms: -18, rate: 32000 },
  waves: { src: '530699', win: [0.5, 21.0], loop: 2.0, rms: -18, rate: 32000 },
  surf: { src: '376805', win: [5, 25], loop: 2.0, rms: -18, rate: 32000 },
  gulls: { src: '353416', win: [0, 28], loop: 2.5, mono: true, rms: -22, rate: 32000 },
  crowd: { src: '129344', win: [2, 22], loop: 1.5, rms: -18, rate: 32000 },
  bells: { src: '341866', win: [1.9, 18.6], mono: true, rms: -16, rate: 32000, fadeOut: 2.5 },
  birds: { src: '34180', win: [0, 30], loop: 2.0, mono: true, rms: -20, rate: 32000 },
  cicadaA: { src: '422048', win: [0, 14.4], loop: 1.5, rms: -20, rate: 32000 },
  cicadaB: { src: '272169', win: [10, 30], loop: 1.5, mono: true, rms: -20, rate: 32000 },
  crash: { src: '237375', win: [0, 3.6], mono: true, peak: -1, fadeOut: 0.8 },
  metal: { src: '530486', win: [0, 1.7], mono: true, peak: -1, fadeOut: 0.5 },
  clank: { src: '151624', win: [0, 0.5], mono: true, peak: -1, fadeOut: 0.1 },
  shift: { src: '118243', win: [0, 0.34], mono: true, peak: -2, fadeOut: 0.08 },
  backfire: { src: '105351', win: [0, 0.42], mono: true, peak: -1, fadeOut: 0.2 },
  music: { src: '704972', win: [0, 42.8], rms: -20, rate: 44100, fadeOut: 1.2 },
  music2: { src: '651533', win: [0, 30.2], rms: -20, rate: 44100, fadeOut: 1.2 },
};

function prep(buf, def) {
  const sr = buf.sampleRate;
  const i0 = Math.floor((def.win ? def.win[0] : 0) * sr);
  const i1 = Math.min(buf.length, Math.floor((def.win ? def.win[1] : buf.duration) * sr));
  const nIn = buf.numberOfChannels, nOut = def.mono ? 1 : Math.min(2, nIn);
  const n = i1 - i0;
  let ch = [];
  for (let c = 0; c < nOut; c++) {
    const d = new Float32Array(n);
    if (def.mono && nIn > 1) {
      for (let k = 0; k < nIn; k++) { const s = buf.getChannelData(k); for (let i = 0; i < n; i++) d[i] += s[i0 + i] / nIn; }
    } else d.set(buf.getChannelData(Math.min(c, nIn - 1)).subarray(i0, i1));
    // remove DC
    let m = 0; for (let i = 0; i < n; i++) m += d[i]; m /= n; for (let i = 0; i < n; i++) d[i] -= m;
    ch.push(d);
  }
  if (def.loop) {
    const xf = Math.round(def.loop * sr), L = n - xf;
    ch = ch.map((d) => {
      const o = d.slice(0, L);
      for (let k = 0; k < xf; k++) { const a = (k / xf) * Math.PI * 0.5; o[k] = d[k] * Math.sin(a) + d[L + k] * Math.cos(a); }
      return o;
    });
  } else {
    const fi = Math.round(0.003 * sr), fo = Math.round((def.fadeOut || 0.01) * sr);
    for (const d of ch) {
      for (let i = 0; i < fi && i < d.length; i++) d[i] *= i / fi;
      for (let i = 0; i < fo && i < d.length; i++) d[d.length - 1 - i] *= (i / fo) ** 1.5;
    }
  }
  // normalise
  let e = 0, pk = 0, cnt = 0;
  for (const d of ch) for (let i = 0; i < d.length; i++) { const v = d[i]; e += v * v; cnt++; if (Math.abs(v) > pk) pk = Math.abs(v); }
  const rms = Math.sqrt(e / cnt);
  let g = 1;
  if (def.rms != null) g = Math.pow(10, def.rms / 20) / Math.max(1e-7, rms);
  else if (def.peak != null) g = Math.pow(10, def.peak / 20) / Math.max(1e-7, pk);
  if (pk * g > 0.98) g = 0.98 / pk;
  for (const d of ch) for (let i = 0; i < d.length; i++) d[i] *= g;
  const ab = new AudioBuffer({ length: ch[0].length, numberOfChannels: ch.length, sampleRate: sr });
  ch.forEach((d, c) => ab.copyToChannel(d, c));
  return ab;
}

/** decode everything; progress(f) in [0,1]. Returns { engines: {gt:[{rpm,buffer}]}, sounds: {name: AudioBuffer}, manifest } */
export async function loadBank(progress = () => {}) {
  const manifest = await (await fetch(ENG + 'engine.json')).json();
  const ctxs = {};
  const dec = (rate) => (ctxs[rate] ||= new OfflineAudioContext(1, 1, rate));
  let done = 0, total = 0;
  const step = () => { done++; progress(done / total); };
  const engines = {};
  const jobs = [];
  for (const [car, bands] of Object.entries(manifest)) {
    engines[car] = [];
    for (const b of bands) {
      total++;
      jobs.push(fetch(ENG + b.file).then((r) => r.arrayBuffer()).then((a) => dec(44100).decodeAudioData(a)).then((buffer) => {
        engines[car].push({ rpm: b.rpm, buffer, src: b.src }); step();
      }));
    }
  }
  const sounds = {};
  const raw = new Map();
  for (const [name, def] of Object.entries(SOUND_DEFS)) {
    total++;
    const key = def.src + '@' + (def.rate || 44100);
    if (!raw.has(key)) raw.set(key, fetch(SRC + def.src + '.mp3').then((r) => r.arrayBuffer()).then((a) => dec(def.rate || 44100).decodeAudioData(a)));
    jobs.push(raw.get(key).then((buf) => { sounds[name] = prep(buf, def); step(); }));
  }
  await Promise.all(jobs);
  for (const car of Object.keys(engines)) engines[car].sort((a, b) => a.rpm - b.rpm);
  return { engines, sounds, manifest };
}
