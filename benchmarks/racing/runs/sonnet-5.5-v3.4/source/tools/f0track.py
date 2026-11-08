"""Dev-time analysis: track the dominant periodicity (engine firing frequency) of a WAV over time.
usage: python tools/f0track.py file.wav [hop_s=0.1]
prints one row per hop: t, f0, strength, rms(dB)  + steady-segment candidates (>=0.7 s, f0 drift < 4%)."""
import sys, wave
import numpy as np

def load(p):
    w = wave.open(p, 'rb'); sr = w.getframerate(); ch = w.getnchannels()
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    if ch > 1: a = a.reshape(-1, ch).mean(axis=1)
    return a, sr

def lowpass(a, sr, fc):
    n = len(a); spec = np.fft.rfft(a); fr = np.fft.rfftfreq(n, 1 / sr)
    spec[fr > fc] = 0
    return np.fft.irfft(spec, n)

def track(a, sr, hop=0.1, win=0.12, fmin=35, fmax=520):
    a = lowpass(a, sr, 1800)
    wl = int(win * sr); hl = int(hop * sr)
    lagmin = int(sr / fmax); lagmax = int(sr / fmin)
    out = []
    for s in range(0, len(a) - wl - lagmax, hl):
        x = a[s:s + wl + lagmax]
        seg = x[:wl] * np.hanning(wl)
        n = 1 << (wl + lagmax - 1).bit_length()
        F = np.fft.rfft(x * np.hanning(len(x)), n)
        ac = np.fft.irfft(F * np.conj(F))[:lagmax + 1]
        ac /= (ac[0] + 1e-12)
        seg2 = ac[lagmin:lagmax]
        k = int(np.argmax(seg2)); lag = lagmin + k
        # parabolic refine
        if 1 <= k < len(seg2) - 1:
            y0, y1, y2 = seg2[k - 1], seg2[k], seg2[k + 1]
            d = (y0 - 2 * y1 + y2)
            if abs(d) > 1e-12: lag = lag + 0.5 * (y0 - y2) / d
        rms = np.sqrt((seg ** 2).mean() / 0.375) + 1e-9
        out.append((s / sr, sr / lag, float(seg2[k]), 20 * np.log10(rms)))
    return out

if __name__ == '__main__':
    p = sys.argv[1]; hop = float(sys.argv[2]) if len(sys.argv) > 2 else 0.1
    a, sr = load(p)
    tr = track(a, sr, hop)
    f0 = np.array([t[1] for t in tr]); st = np.array([t[2] for t in tr]); lv = np.array([t[3] for t in tr])
    print(f'{p}: dur={len(a)/sr:.1f}s hop={hop}')
    step = max(1, int(round(1.0 / hop)))
    print(' t(s)  f0(Hz) strength level(dB)')
    for i in range(0, len(tr), step):
        print(f'{tr[i][0]:6.1f} {f0[i]:7.1f} {st[i]:6.2f} {lv[i]:7.1f}')
    # steady segments
    print('steady segments (>=0.7s, strength>0.35, drift<4%):')
    i = 0; n = len(tr); need = int(0.7 / hop) + 1
    while i < n - need:
        j = i
        while j + 1 < n and st[j + 1] > 0.35 and abs(f0[j + 1] - f0[i]) / f0[i] < 0.04: j += 1
        if st[i] > 0.35 and j - i + 1 >= need:
            print(f'  {tr[i][0]:6.2f}-{tr[j][0]+0.12:6.2f}s  f0={np.mean(f0[i:j+1]):6.1f}Hz  level={np.mean(lv[i:j+1]):6.1f}dB')
            i = j + 1
        else:
            i += 1
