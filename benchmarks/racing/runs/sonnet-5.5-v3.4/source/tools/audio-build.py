"""Dev-time audio asset builder (numpy only). Turns the raw CC0 recordings in assets/audio/raw/wav into game-ready loops:
  * engine RPM bands: pitch-flattened, cycle-aligned, cross-faded loops cut from a real engine run-up/coast-down recording
  * tyre / wind / ambience loops with equal-power cross-faded seams
Run: python tools/audio-build.py   (outputs assets/audio/{engine,sfx,amb}/*.wav + engine-bank.json)
"""
import json, os, sys, wave
import numpy as np

RAW = 'assets/audio/raw/wav'
OUT = 'assets/audio'
SR = 44100

def read(name):
    w = wave.open(f'{RAW}/{name}.wav', 'rb'); sr = w.getframerate(); ch = w.getnchannels()
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    a = a.reshape(-1, ch) if ch > 1 else a.reshape(-1, 1)
    assert sr == SR, (name, sr)
    return a

def write(path, a):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = np.atleast_2d(a.T).T if a.ndim == 1 else a
    pk = np.max(np.abs(a)) + 1e-12
    if pk > 0.98: a = a * (0.98 / pk)
    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    w = wave.open(path, 'wb'); w.setnchannels(pcm.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
    return os.path.getsize(path)

def mono(a): return a.mean(axis=1)
def rms(a): return float(np.sqrt(np.mean(a ** 2)) + 1e-12)
def db(x): return 20 * np.log10(x + 1e-12)

def highpass(x, fc):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X[f < fc] *= (f[f < fc] / fc) ** 2; return np.fft.irfft(X, n)
def lowpass(x, fc):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); m = np.where(f > fc, (fc / np.maximum(f, 1)) ** 3, 1.0); return np.fft.irfft(X * m, n)

def xfade_loop(x, xf):
    """seamless loop: blend the tail into the head (equal power). x: (n,) or (n,ch)"""
    n = len(x); xf = min(xf, n // 3)
    t = np.linspace(0, np.pi / 2, xf)
    wi, wo = np.sin(t), np.cos(t)
    if x.ndim == 1:
        y = x[:n - xf].copy(); y[:xf] = x[:xf] * wi + x[n - xf:] * wo
    else:
        y = x[:n - xf].copy(); y[:xf] = x[:xf] * wi[:, None] + x[n - xf:] * wo[:, None]
    return y

# ------------------------------------------------------------------ f0 tracking by harmonic salience + Viterbi
def f0_track(x, hop=0.01, win=0.093, fmin=40, fmax=420):
    n = int(win * SR); n = 1 << (n - 1).bit_length(); hopn = int(hop * SR)
    cands = np.exp(np.linspace(np.log(fmin), np.log(fmax), 420))
    fr = np.fft.rfftfreq(n, 1 / SR); hw = np.hanning(n)
    frames = list(range(0, len(x) - n, hopn)); S = np.zeros((len(frames), len(cands)))
    for k, s in enumerate(frames):
        mag = np.abs(np.fft.rfft(x[s:s + n] * hw)); mag = np.log1p(mag * 40)
        for ci, f in enumerate(cands):
            sal = 0.0
            for h in range(1, 9):
                idx = (f * h) / (SR / n)
                if idx + 1 >= len(mag): break
                i0 = int(idx); fr_ = idx - i0; sal += (mag[i0] * (1 - fr_) + mag[i0 + 1] * fr_) / (h ** 0.4)
            S[k, ci] = sal
    # viterbi with jump penalty
    nC = len(cands); cost = np.zeros_like(S); back = np.zeros(S.shape, dtype=np.int32); cost[0] = -S[0]
    idxs = np.arange(nC); pen = 0.55 * np.abs(idxs[:, None] - idxs[None, :]) ** 1.0 * 0.02
    for k in range(1, len(frames)):
        tot = cost[k - 1][None, :] + pen
        back[k] = np.argmin(tot, axis=1); cost[k] = tot[idxs, back[k]] - S[k]
    path = np.zeros(len(frames), dtype=int); path[-1] = int(np.argmin(cost[-1]))
    for k in range(len(frames) - 1, 0, -1): path[k - 1] = back[k][path[k]]
    t = (np.array(frames) + n / 2) / SR
    return t, cands[path]

def smooth(v, k=7):
    p = np.pad(v, (k, k), mode='edge'); return np.convolve(p, np.ones(2 * k + 1) / (2 * k + 1), mode='valid')

def flatten_loop(x, t_f0, f0, t0, t1, f_target, loop_s=0.75, xf=0.09):
    """cut [t0,t1], make the pitch constant (varispeed warp) and return a cycle-aligned seamless loop at f_target Hz"""
    m = (t_f0 >= t0) & (t_f0 <= t1)
    tt = t_f0[m]; ff = smooth(f0[m], 4)
    # phase (cycles) as a function of time
    phase = np.concatenate([[0], np.cumsum((ff[1:] + ff[:-1]) / 2 * np.diff(tt))])
    cycles = int(max(4, round(f_target * loop_s)))
    need = cycles + xf * f_target + 1
    if phase[-1] < need: need = phase[-1] - 0.5; cycles = int(need - xf * f_target)
    tau = np.arange(0, int((cycles + xf * f_target) / f_target * SR)) / SR
    t_src = np.interp(tau * f_target, phase, tt)                 # warp: constant instantaneous frequency
    pos = t_src * SR
    seg = np.interp(pos, np.arange(len(x)), x)
    L = int(round(cycles / f_target * SR)); xfn = len(seg) - L
    y = seg[:L].copy(); t = np.linspace(0, np.pi / 2, xfn)
    y[:xfn] = seg[:xfn] * np.sin(t) + seg[L:L + xfn] * np.cos(t)
    return y, cycles / f_target

def resample(x, ratio):
    """varispeed: ratio > 1 plays faster/higher"""
    n = int(len(x) / ratio); return np.interp(np.arange(n) * ratio, np.arange(len(x)), x)

def acf_q(y, f0):
    n = len(y); X = np.fft.rfft(y, 2 * n); ac = np.fft.irfft(X * np.conj(X))[:n]; ac /= ac[0] + 1e-12
    lag = int(round(SR / f0)); return float(ac[max(1, lag - 3):lag + 4].max())

def best_window(x, t, f0s, target, tol=0.12, win=0.95, tmin=None, tmax=None):
    best = None
    for tc in np.arange(t[0] + win / 2, t[-1] - win / 2, 0.1):
        if tmin is not None and (tc < tmin or tc > tmax): continue
        k = (t >= tc - win / 2) & (t <= tc + win / 2); ff = f0s[k]
        if len(ff) < 8: continue
        med = float(np.median(ff))
        if abs(med - target) / target > tol or np.std(ff) / med > 0.05: continue
        try: y, dur = flatten_loop(x, t, f0s, tc - win / 2, tc + win / 2, med, loop_s=0.8)
        except Exception: continue
        if len(y) < 4000: continue
        q = acf_q(y, med); seam = abs(y[0] - y[-1]) / (rms(y) + 1e-9)
        score = q - 0.25 * min(1, seam)
        if best is None or score > best[0]: best = (score, tc, med, y, q)
    return best

def build_engines():
    R = {}
    for name in ('496171', '181460'):
        x = mono(read(name)); t, f0 = f0_track(x); R[name] = (x, t, smooth(f0, 3)); print('tracked', name)
    # (recording, target f0, optional time range)
    pick = [('496171', 56, 26.5, 31.0), ('181460', 58, None, None), ('181460', 70, None, None), ('181460', 85, None, None), ('181460', 97, None, None), ('181460', 105, None, None),
            ('496171', 165, 11.5, 17.5), ('496171', 183, 16.0, 19.0), ('496171', 205, 19.0, 21.5), ('496171', 238, 21.0, 24.0)]
    found = []
    for rec, target, lo, hi in pick:
        x, t, f0s = R[rec]
        bw = best_window(x, t, f0s, target, tmin=lo, tmax=hi)
        if bw is None: print('NO window for', rec, target); continue
        score, tc, med, y, q = bw
        print(f'{rec} target {target:5.0f} -> t={tc:5.2f}s f0={med:6.1f} Hz loop {len(y)/SR:.3f}s acf={q:.2f} score={score:.2f} centroid={float((np.abs(np.fft.rfft(y))*np.fft.rfftfreq(len(y),1/SR)).sum()/np.abs(np.fft.rfft(y)).sum()):.0f}')
        found.append({'rec': rec, 'f0': med, 'y': y, 'q': q, 'target': target})
    out_dir = f'{OUT}/engine'; meta = {'sources': ['Freesound 496171 (CC0) editboy23 - Import car revs on Chassis Dyno with Turbo', 'Freesound 181460 (CC0) erik90 - car rev.wav'], 'cars': {}}
    for car in ('turbo', 'v8'):
        entries = []
        for f in found:
            if f['q'] < 0.45: continue
            y = f['y'].copy()
            # car A (v8) uses the old-engine recording as is and slows the dyno loops down (deeper, heavier), car B (turbo) keeps the dyno as is and brightens the old-engine low end
            if car == 'v8':
                if f['rec'] == '496171':
                    ratio = 0.66; y = resample(y, ratio); ft = f['f0'] * ratio
                else: ft = f['f0']
                y = lowpass(y, 5200)
            else:
                ft = f['f0']
                y = highpass(y, 70) if f['rec'] == '181460' else y
                if f['rec'] == '181460': y = y * 1.0
            # keep an integer number of cycles
            cyc = int(round(ft * len(y) / SR)); L = int(round(cyc / ft * SR)); y = y[:L]
            y = highpass(y, 32) * (10 ** (-19 / 20) / rms(y)); y = np.tanh(y * 1.15) / 1.15
            fn = f"{car}-{int(round(ft)):03d}-{f['rec']}.wav"; sz = write(f'{out_dir}/{fn}', y)
            entries.append({'file': f'assets/audio/engine/{fn}', 'f0': round(float(ft), 2), 'dur': round(len(y) / SR, 4), 'src': f['rec'], 'acf': round(f['q'], 2), 'bytes': sz})
        entries.sort(key=lambda e: e['f0'])
        meta['cars'][car] = entries
        print(car, [e['f0'] for e in entries])
    json.dump(meta, open(f'{OUT}/engine-bank.json', 'w'), indent=1)
    print('engine bank written')

def loop_from(name, t0, t1, xf=1.5, ch=1, hp=None, lp=None, gain_db=None):
    a = read(name); seg = a[int(t0 * SR):int(t1 * SR)]
    seg = seg.mean(axis=1) if ch == 1 else (seg if seg.shape[1] == 2 else np.repeat(seg, 2, axis=1))
    if hp: seg = highpass(seg, hp) if seg.ndim == 1 else np.stack([highpass(seg[:, c], hp) for c in range(2)], 1)
    if lp: seg = lowpass(seg, lp) if seg.ndim == 1 else np.stack([lowpass(seg[:, c], lp) for c in range(2)], 1)
    y = xfade_loop(seg, int(xf * SR))
    if gain_db is not None: y = y * (10 ** (gain_db / 20) / rms(y))
    return y

def build_sfx():
    S = f'{OUT}/sfx'; A = f'{OUT}/amb'
    sz = {}
    a = read('squeal04'); a = mono(a); n = len(a)
    # find the steadiest loud 2.2 s window of the squeal
    best, bi = 0, 0
    for s in range(int(1.0 * SR), n - int(2.4 * SR), int(0.1 * SR)):
        w = a[s:s + int(2.2 * SR)]; e = rms(w); v = np.std([rms(w[k:k + 4410]) for k in range(0, len(w) - 4410, 4410)])
        sc = e / (v + 0.02)
        if sc > best: best, bi = sc, s
    y = xfade_loop(a[bi:bi + int(2.2 * SR)], int(0.25 * SR)); y = highpass(y, 500) * (10 ** (-18 / 20) / rms(y)); sz['squeal'] = write(f'{S}/squeal.wav', y)
    sz['rolling-asphalt'] = write(f'{S}/rolling-asphalt.wav', loop_from('tires-asphalt', 14.0, 24.0, 1.2, hp=60, gain_db=-24))
    sz['rolling-gravel'] = write(f'{S}/rolling-gravel.wav', loop_from('gravel2', 4.0, 15.0, 1.2, hp=80, gain_db=-22))
    sz['wind'] = write(f'{S}/wind.wav', loop_from('wind-trees', 8.0, 38.0, 3.0, hp=60, gain_db=-24))
    sz['scrape'] = write(f'{S}/scrape.wav', loop_from('metalscrape4', 1.0, 6.5, 0.5, hp=150, gain_db=-20))
    c1 = mono(read('crash1'))[:int(2.6 * SR)]; sz['crash-big'] = write(f'{S}/crash-big.wav', c1 * (10 ** (-8 / 20) / np.max(np.abs(c1))))
    c2 = mono(read('metalhit2')); sz['crash-med'] = write(f'{S}/crash-med.wav', c2 * (10 ** (-8 / 20) / np.max(np.abs(c2))))
    c3 = mono(read('crash-glass'))[:int(1.6 * SR)]; sz['crash-glass'] = write(f'{S}/crash-glass.wav', c3 * (10 ** (-8 / 20) / np.max(np.abs(c3))))
    g = mono(read('gearselect')); sz['gear'] = write(f'{S}/gear.wav', g * (10 ** (-10 / 20) / np.max(np.abs(g))))
    hb = mono(read('handbrake03')); sz['handbrake'] = write(f'{S}/handbrake.wav', hb * (10 ** (-8 / 20) / np.max(np.abs(hb))))
    # ambience beds (stereo where the source is)
    sz['ocean'] = write(f'{A}/ocean.wav', loop_from('ocean-loop', 2.0, 44.0, 3.0, ch=2, gain_db=-22))
    sz['village'] = write(f'{A}/village.wav', loop_from('village-street', 5.0, 50.0, 3.0, ch=1, hp=100, gain_db=-24))
    sz['chat'] = write(f'{A}/chat.wav', loop_from('piazza-chat', 1.0, 38.0, 2.5, ch=1, hp=120, gain_db=-24))
    sz['forest'] = write(f'{A}/forest.wav', loop_from('forest-birds', 6.0, 50.0, 3.0, ch=1, hp=150, gain_db=-24))
    sz['cicadas'] = write(f'{A}/cicadas.wav', loop_from('cicadas', 3.0, 34.0, 2.5, ch=1, hp=800, gain_db=-26))
    sz['crowd'] = write(f'{A}/crowd.wav', loop_from('crowd-medium', 4.0, 44.0, 3.0, ch=1, hp=120, gain_db=-24))
    gl = mono(read('seagull')); sz['gulls'] = write(f'{A}/gulls.wav', gl * (10 ** (-14 / 20) / np.max(np.abs(gl))))
    bl = mono(read('bells-distant')); sz['bells'] = write(f'{A}/bells.wav', bl * (10 ** (-14 / 20) / np.max(np.abs(bl))))
    for k, v in sz.items(): print(f'{k:18s} {v / 1024:8.0f} KB')
    json.dump({k: v for k, v in sz.items()}, open(f'{OUT}/sizes.json', 'w'))

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('all', 'engine'): build_engines()
    if what in ('all', 'sfx'): build_sfx()
