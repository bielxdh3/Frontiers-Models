"""Dev-time spectrogram renderer: python tools/spec.py in.wav out.png [fmax=1500] [width=1500]"""
import sys, wave
import numpy as np
from PIL import Image
p, out = sys.argv[1], sys.argv[2]
fmax = float(sys.argv[3]) if len(sys.argv) > 3 else 1500
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1500
w = wave.open(p, 'rb'); sr = w.getframerate(); ch = w.getnchannels()
a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
if ch > 1: a = a.reshape(-1, ch).mean(axis=1)
nfft = 4096; hop = max(256, int(len(a) / W))
frames = []
win = np.hanning(nfft)
for s in range(0, len(a) - nfft, hop):
    frames.append(np.abs(np.fft.rfft(a[s:s + nfft] * win)))
S = np.array(frames).T
fr = np.fft.rfftfreq(nfft, 1 / sr)
S = S[fr <= fmax]
S = 20 * np.log10(S + 1e-9)
S = np.clip((S - (S.max() - 80)) / 80, 0, 1)
img = (S[::-1] * 255).astype(np.uint8)
im = Image.fromarray(img).resize((img.shape[1], 360)).convert('L')
# simple heat colormap
lut = np.zeros((256, 3), np.uint8)
for i in range(256):
    t = i / 255
    lut[i] = [min(255, int(255 * max(0, 2 * t - 0.3))), min(255, int(255 * max(0, 2 * t - 0.9))), int(255 * max(0, 0.6 - abs(t - 0.25) * 2.4))]
arr = lut[np.array(im)]
Image.fromarray(arr).save(out)
print('saved', out, arr.shape, 'dur', len(a) / sr, 'hop_s', hop / sr)
