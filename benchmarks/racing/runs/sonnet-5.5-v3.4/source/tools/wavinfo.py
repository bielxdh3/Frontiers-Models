import sys, wave, numpy as np
for p in sys.argv[1:]:
    try:
        w = wave.open(p, 'rb')
    except Exception as e:
        print(p, 'ERR', e); continue
    n = w.getnframes(); sr = w.getframerate(); ch = w.getnchannels(); sw = w.getsampwidth()
    raw = w.readframes(n)
    dt = {1: np.uint8, 2: np.int16, 4: np.int32}[sw]
    a = np.frombuffer(raw, dtype=dt).astype(np.float64)
    if sw == 1: a = (a - 128) / 128
    else: a = a / float(2 ** (8 * sw - 1))
    if ch > 1: a = a.reshape(-1, ch).mean(axis=1)
    spec = np.abs(np.fft.rfft(a * np.hanning(len(a))))
    fr = np.fft.rfftfreq(len(a), 1 / sr)
    top = fr[np.argsort(spec)[-3:][::-1]]
    print(f"{p.split('/')[-1]:28s} sr={sr} ch={ch} bits={sw*8} dur={n/sr:.3f}s peak={np.abs(a).max():.3f} rms={np.sqrt((a**2).mean()):.3f} topHz={[round(float(x)) for x in top]}")
