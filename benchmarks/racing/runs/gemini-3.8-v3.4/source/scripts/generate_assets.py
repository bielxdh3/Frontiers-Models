# scripts/generate_assets.py
# Generates all PBR textures (2048x2048 for asphalt, 1024x1024 for props/surfaces)
# and audio files (.wav 44.1kHz 16-bit) meeting all Racing-bench V3.4 specifications.

import os
import math
import struct
import wave
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

os.makedirs('assets/textures', exist_ok=True)
os.makedirs('assets/audio', exist_ok=True)

print("Starting asset generation...")

def normalize(arr):
    min_v, max_v = arr.min(), arr.max()
    if max_v > min_v:
        return (arr - min_v) / (max_v - min_v)
    return arr

def height_to_normal(height, strength=1.5):
    h, w = height.shape
    # Sobel / central difference gradient
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    dz = np.ones_like(height)
    
    # Normalize vector (dx, dy, dz)
    length = np.sqrt(dx*dx + dy*dy + dz*dz)
    nx = dx / length
    ny = dy / length
    nz = dz / length
    
    # Convert to RGB [0, 255] (tangent space: X=R, Y=G, Z=B)
    r = ((nx * 0.5 + 0.5) * 255).astype(np.uint8)
    g = (((-ny) * 0.5 + 0.5) * 255).astype(np.uint8) # Flip Y for standard OpenGL normal map
    b = ((nz * 0.5 + 0.5) * 255).astype(np.uint8)
    
    return np.stack([r, g, b], axis=-1)

# Noise generator helper
def generate_perlin_noise(width, height, octaves=6, persistence=0.5):
    np.random.seed(42)
    noise = np.zeros((height, width), dtype=np.float32)
    frequency = 1.0
    amplitude = 1.0
    for _ in range(octaves):
        grid_w = max(2, int(width * frequency / 64))
        grid_h = max(2, int(height * frequency / 64))
        small = np.random.rand(grid_h, grid_w).astype(np.float32)
        im = Image.fromarray(small)
        scaled = np.array(im.resize((width, height), Image.Resampling.BICUBIC))
        noise += scaled * amplitude
        frequency *= 2.0
        amplitude *= persistence
    return normalize(noise)

# -------------------------------------------------------------------------
# 1. ASPHALT (2048x2048) - Road surface
# -------------------------------------------------------------------------
print("Generating Asphalt PBR (2048x2048)...")
W, H = 2048, 2048
base_noise = generate_perlin_noise(W, H, octaves=6, persistence=0.55)
fine_noise = np.random.rand(H, W).astype(np.float32)

# Height for normal map
asphalt_h = base_noise * 0.4 + fine_noise * 0.6
asphalt_norm = height_to_normal(asphalt_h, strength=2.2)

# Albedo: Dark grey aggregate with stone specks
asphalt_gray = (45 + fine_noise * 25 + base_noise * 15).clip(0, 255).astype(np.uint8)
albedo_img = np.stack([asphalt_gray, asphalt_gray, (asphalt_gray * 0.96).astype(np.uint8)], axis=-1)

# Add painted markings: White continuous side lines and dashed center line
# Track width is mapped across X: X in [0.05, 0.08] is left edge, [0.92, 0.95] is right edge
# Center line is around X in [0.49, 0.51]
x_coords = np.linspace(0, 1, W)
y_coords = np.linspace(0, 1, H)
X, Y = np.meshgrid(x_coords, y_coords)

# Left and right white edge lines
edge_line_mask = ((X >= 0.04) & (X <= 0.07)) | ((X >= 0.93) & (X <= 0.96))
# Dashed center line: dashed along Y
dashed_center = ((X >= 0.485) & (X <= 0.515)) & ((Y % 0.2) < 0.12)

# Rubber groove darkening along racing line (around X=0.35 and X=0.65)
rubber_line1 = np.exp(-((X - 0.32) ** 2) / (2 * 0.05 ** 2))
rubber_line2 = np.exp(-((X - 0.68) ** 2) / (2 * 0.05 ** 2))
rubber_dark = (rubber_line1 + rubber_line2) * 0.35

for c in range(3):
    albedo_img[:, :, c] = (albedo_img[:, :, c] * (1.0 - rubber_dark)).astype(np.uint8)

# Paint markings with weathered worn edges
paint_mask = (edge_line_mask | dashed_center) & (fine_noise > 0.15)
albedo_img[paint_mask, 0] = (235 * (0.85 + 0.15 * fine_noise[paint_mask])).astype(np.uint8)
albedo_img[paint_mask, 1] = (230 * (0.85 + 0.15 * fine_noise[paint_mask])).astype(np.uint8)
albedo_img[paint_mask, 2] = (215 * (0.85 + 0.15 * fine_noise[paint_mask])).astype(np.uint8)

# Roughness map: Asphalt is rough (~0.85), painted lines are smoother (~0.4), rubber groove is ~0.65
roughness = (0.82 + base_noise * 0.12).clip(0, 1)
roughness[paint_mask] = 0.42
roughness -= rubber_dark * 0.2
rough_img = (roughness.clip(0, 1) * 255).astype(np.uint8)

Image.fromarray(albedo_img).save('assets/textures/asphalt_albedo.png')
Image.fromarray(asphalt_norm).save('assets/textures/asphalt_normal.png')
Image.fromarray(rough_img).save('assets/textures/asphalt_roughness.png')

# -------------------------------------------------------------------------
# 2. CURBS / ZEBRAS (1024x1024) - Red & White alternating apex strips
# -------------------------------------------------------------------------
print("Generating Curb PBR (1024x1024)...")
W, H = 1024, 1024
curb_noise = generate_perlin_noise(W, H, octaves=5, persistence=0.5)
curb_fine = np.random.rand(H, W).astype(np.float32)

# Serrated/ribbed 3D profile across Y
ribs = np.sin(np.linspace(0, 32 * np.pi, H))[:, None]
curb_h = curb_noise * 0.3 + curb_fine * 0.2 + ribs * 0.5
curb_norm = height_to_normal(curb_h, strength=2.5)

# Alternating red and white stripes along Y
stripe_pattern = ((np.linspace(0, 16, H) % 2) < 1.0)[:, None] # Red when True, White when False
stripe_mask = np.repeat(stripe_pattern, W, axis=1)

curb_r = np.zeros((H, W), dtype=np.uint8)
curb_g = np.zeros((H, W), dtype=np.uint8)
curb_b = np.zeros((H, W), dtype=np.uint8)

# Red
curb_r[stripe_mask] = (215 - curb_noise[stripe_mask] * 30).astype(np.uint8)
curb_g[stripe_mask] = (35 + curb_noise[stripe_mask] * 15).astype(np.uint8)
curb_b[stripe_mask] = (30 + curb_noise[stripe_mask] * 15).astype(np.uint8)

# White
white_mask = ~stripe_mask
curb_r[white_mask] = (235 - curb_noise[white_mask] * 30).astype(np.uint8)
curb_g[white_mask] = (230 - curb_noise[white_mask] * 30).astype(np.uint8)
curb_b[white_mask] = (220 - curb_noise[white_mask] * 30).astype(np.uint8)

# Add tire mark scuffs
scuffs = generate_perlin_noise(W, H, octaves=4, persistence=0.4)
scuff_mask = scuffs > 0.65
curb_r[scuff_mask] = (curb_r[scuff_mask] * 0.5).astype(np.uint8)
curb_g[scuff_mask] = (curb_g[scuff_mask] * 0.5).astype(np.uint8)
curb_b[scuff_mask] = (curb_b[scuff_mask] * 0.5).astype(np.uint8)

curb_albedo = np.stack([curb_r, curb_g, curb_b], axis=-1)
curb_rough = ((0.55 + curb_noise * 0.3) * 255).astype(np.uint8)

Image.fromarray(curb_albedo).save('assets/textures/curb_albedo.png')
Image.fromarray(curb_norm).save('assets/textures/curb_normal.png')
Image.fromarray(curb_rough).save('assets/textures/curb_roughness.png')

# -------------------------------------------------------------------------
# 3. CLIFF ROCK (1024x1024) - Mediterranean Limestone & Sandstone
# -------------------------------------------------------------------------
print("Generating Cliff Rock PBR (1024x1024)...")
rock_p1 = generate_perlin_noise(W, H, octaves=7, persistence=0.55)
rock_p2 = generate_perlin_noise(W, H, octaves=4, persistence=0.7)
# Horizontal strata bands
strata = np.sin(np.linspace(0, 18 * np.pi, H))[:, None] * 0.3
rock_h = rock_p1 * 0.5 + rock_p2 * 0.2 + strata
rock_norm = height_to_normal(rock_h, strength=3.0)

# Warm ochre, sienna, and limestone tones
r_chan = (175 + rock_p1 * 50 - strata * 25).clip(0, 255).astype(np.uint8)
g_chan = (145 + rock_p1 * 40 - strata * 20).clip(0, 255).astype(np.uint8)
b_chan = (115 + rock_p1 * 35 - strata * 15).clip(0, 255).astype(np.uint8)
rock_albedo = np.stack([r_chan, g_chan, b_chan], axis=-1)
rock_rough = ((0.85 + rock_p2 * 0.15) * 255).astype(np.uint8)

Image.fromarray(rock_albedo).save('assets/textures/rock_albedo.png')
Image.fromarray(rock_norm).save('assets/textures/rock_normal.png')
Image.fromarray(rock_rough).save('assets/textures/rock_roughness.png')

# -------------------------------------------------------------------------
# 4. BEACH SAND (1024x1024) - Golden Sand with Wind Ripples
# -------------------------------------------------------------------------
print("Generating Beach Sand PBR (1024x1024)...")
sand_ripples = np.sin(np.linspace(0, 24 * np.pi, W))[None, :] * 0.25
sand_noise = generate_perlin_noise(W, H, octaves=5, persistence=0.5)
sand_fine = np.random.rand(H, W).astype(np.float32) * 0.2
sand_h = sand_ripples + sand_noise * 0.5 + sand_fine
sand_norm = height_to_normal(sand_h, strength=1.8)

# Golden quartz sand
r_sand = (215 + sand_noise * 30).clip(0, 255).astype(np.uint8)
g_sand = (185 + sand_noise * 25).clip(0, 255).astype(np.uint8)
b_sand = (135 + sand_noise * 20).clip(0, 255).astype(np.uint8)
sand_albedo = np.stack([r_sand, g_sand, b_sand], axis=-1)
sand_rough = ((0.9 + sand_noise * 0.1) * 255).astype(np.uint8)

Image.fromarray(sand_albedo).save('assets/textures/sand_albedo.png')
Image.fromarray(sand_norm).save('assets/textures/sand_normal.png')
Image.fromarray(sand_rough).save('assets/textures/sand_roughness.png')

# -------------------------------------------------------------------------
# 5. MEDITERRANEAN VEGETATION / GRASS & SOIL (1024x1024)
# -------------------------------------------------------------------------
print("Generating Mediterranean Grass/Soil PBR (1024x1024)...")
grass_p = generate_perlin_noise(W, H, octaves=6, persistence=0.6)
grass_fine = np.random.rand(H, W).astype(np.float32)
grass_h = grass_p * 0.7 + grass_fine * 0.3
grass_norm = height_to_normal(grass_h, strength=2.2)

# Blend of summer dry olive grass, pine needles, and rich earth
r_gr = (95 + grass_p * 45).clip(0, 255).astype(np.uint8)
g_gr = (115 + grass_p * 55).clip(0, 255).astype(np.uint8)
b_gr = (45 + grass_p * 25).clip(0, 255).astype(np.uint8)
grass_albedo = np.stack([r_gr, g_gr, b_gr], axis=-1)
grass_rough = ((0.85 + grass_fine * 0.15) * 255).astype(np.uint8)

Image.fromarray(grass_albedo).save('assets/textures/grass_albedo.png')
Image.fromarray(grass_norm).save('assets/textures/grass_normal.png')
Image.fromarray(grass_rough).save('assets/textures/grass_roughness.png')

# -------------------------------------------------------------------------
# 6. VILLAGE STUCCO & STONE (1024x1024)
# -------------------------------------------------------------------------
print("Generating Village Stucco PBR (1024x1024)...")
stucco_p = generate_perlin_noise(W, H, octaves=6, persistence=0.5)
stucco_norm = height_to_normal(stucco_p, strength=1.4)
# Warm Mediterranean terracotta stucco
r_st = (220 - stucco_p * 35).clip(0, 255).astype(np.uint8)
g_st = (195 - stucco_p * 30).clip(0, 255).astype(np.uint8)
b_st = (165 - stucco_p * 25).clip(0, 255).astype(np.uint8)
stucco_albedo = np.stack([r_st, g_st, b_st], axis=-1)
stucco_rough = ((0.75 + stucco_p * 0.2) * 255).astype(np.uint8)

Image.fromarray(stucco_albedo).save('assets/textures/stucco_albedo.png')
Image.fromarray(stucco_norm).save('assets/textures/stucco_normal.png')
Image.fromarray(stucco_rough).save('assets/textures/stucco_roughness.png')

# -------------------------------------------------------------------------
# 7. TERRACOTTA ROOF TILES (1024x1024)
# -------------------------------------------------------------------------
print("Generating Terracotta Roof PBR (1024x1024)...")
tile_y = np.linspace(0, 16 * np.pi, H)[:, None]
tile_x = np.linspace(0, 24 * np.pi, W)[None, :]
tile_curves = np.abs(np.sin(tile_x)) * 0.4 + (np.sin(tile_y) * 0.3)
roof_p = generate_perlin_noise(W, H, octaves=4, persistence=0.5)
roof_h = tile_curves + roof_p * 0.3
roof_norm = height_to_normal(roof_h, strength=2.5)

r_rf = (190 + roof_p * 35).clip(0, 255).astype(np.uint8)
g_rf = (85 + roof_p * 25).clip(0, 255).astype(np.uint8)
b_rf = (50 + roof_p * 15).clip(0, 255).astype(np.uint8)
roof_albedo = np.stack([r_rf, g_rf, b_rf], axis=-1)
roof_rough = ((0.7 + roof_p * 0.25) * 255).astype(np.uint8)

Image.fromarray(roof_albedo).save('assets/textures/roof_albedo.png')
Image.fromarray(roof_norm).save('assets/textures/roof_normal.png')
Image.fromarray(roof_rough).save('assets/textures/roof_roughness.png')

# -------------------------------------------------------------------------
# 8. VILLAGE COBBLESTONE (1024x1024)
# -------------------------------------------------------------------------
print("Generating Village Cobblestone PBR (1024x1024)...")
cobble_p = generate_perlin_noise(W, H, octaves=6, persistence=0.6)
grid_x = np.abs(np.sin(np.linspace(0, 32 * np.pi, W)))[None, :]
grid_y = np.abs(np.sin(np.linspace(0, 32 * np.pi, H)))[:, None]
cobble_h = (grid_x * grid_y) * 0.6 + cobble_p * 0.4
cobble_norm = height_to_normal(cobble_h, strength=2.8)

r_cb = (140 + cobble_p * 40 - grid_x * grid_y * 30).clip(0, 255).astype(np.uint8)
g_cb = (135 + cobble_p * 35 - grid_x * grid_y * 30).clip(0, 255).astype(np.uint8)
b_cb = (130 + cobble_p * 30 - grid_x * grid_y * 30).clip(0, 255).astype(np.uint8)
cobble_albedo = np.stack([r_cb, g_cb, b_cb], axis=-1)
cobble_rough = ((0.65 + cobble_p * 0.25) * 255).astype(np.uint8)

Image.fromarray(cobble_albedo).save('assets/textures/cobblestone_albedo.png')
Image.fromarray(cobble_norm).save('assets/textures/cobblestone_normal.png')
Image.fromarray(cobble_rough).save('assets/textures/cobblestone_roughness.png')

# -------------------------------------------------------------------------
# 9. FOLIAGE ATLAS (1024x1024, RGBA) - Pine needles, olive, palm, shrub
# -------------------------------------------------------------------------
print("Generating Foliage Atlas (1024x1024 RGBA)...")
foliage_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(foliage_img)

# Quad 1 (Top-Left: Stone Pine Needle Cluster)
for _ in range(350):
    cx, cy = np.random.randint(60, 450), np.random.randint(60, 450)
    angle = np.random.uniform(0, 2 * math.pi)
    length = np.random.uniform(25, 60)
    ex = cx + math.cos(angle) * length
    ey = cy + math.sin(angle) * length
    color = (np.random.randint(40, 70), np.random.randint(90, 140), np.random.randint(30, 60), 255)
    draw.line([(cx, cy), (ex, ey)], fill=color, width=3)

# Quad 2 (Top-Right: Olive Leaf Sprigs - Silvery green)
for _ in range(120):
    cx, cy = np.random.randint(560, 960), np.random.randint(60, 450)
    rx, ry = np.random.randint(12, 28), np.random.randint(6, 14)
    color = (np.random.randint(100, 140), np.random.randint(130, 170), np.random.randint(90, 130), 255)
    draw.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=color)

# Quad 3 (Bottom-Left: Palm Frond blade)
for i in range(150):
    y = 550 + i * 3
    span = math.sin(i / 150.0 * math.pi) * 200
    color = (np.random.randint(60, 95), np.random.randint(120, 165), np.random.randint(35, 70), 255)
    draw.line([(256 - span, y), (256 + span, y)], fill=color, width=3)

# Quad 4 (Bottom-Right: Flowering Shrub - pink/white oleander)
for _ in range(160):
    cx, cy = np.random.randint(560, 960), np.random.randint(560, 960)
    r = np.random.randint(8, 22)
    # 80% leaves, 20% blossom
    if np.random.rand() > 0.2:
        col = (np.random.randint(45, 80), np.random.randint(110, 160), np.random.randint(35, 65), 255)
    else:
        col = (np.random.randint(220, 255), np.random.randint(140, 180), np.random.randint(170, 210), 255)
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=col)

foliage_img.save('assets/textures/foliage_albedo.png')
# Normal & Roughness
fol_arr = np.array(foliage_img)
fol_h = fol_arr[:, :, 3].astype(np.float32) / 255.0
fol_norm = height_to_normal(fol_h, strength=2.0)
Image.fromarray(fol_norm).save('assets/textures/foliage_normal.png')
fol_rough = ((0.6 + np.random.rand(H, W) * 0.2) * 255).astype(np.uint8)
Image.fromarray(fol_rough).save('assets/textures/foliage_roughness.png')

# -------------------------------------------------------------------------
# 10. TIRE PBR (1024x1024)
# -------------------------------------------------------------------------
print("Generating Tire PBR (1024x1024)...")
tire_v = np.linspace(0, 32 * np.pi, H)[:, None]
tire_grooves = (np.abs(np.sin(tire_v)) > 0.7).astype(np.float32) * 0.4
tire_h = tire_grooves + np.random.rand(H, W) * 0.05
tire_norm = height_to_normal(tire_h, strength=3.0)
tire_albedo = np.full((H, W, 3), 32, dtype=np.uint8)
tire_rough = np.full((H, W), 210, dtype=np.uint8)

Image.fromarray(tire_albedo).save('assets/textures/tire_albedo.png')
Image.fromarray(tire_norm).save('assets/textures/tire_normal.png')
Image.fromarray(tire_rough).save('assets/textures/tire_roughness.png')

# -------------------------------------------------------------------------
# 11. GUARDRAIL PBR (1024x1024)
# -------------------------------------------------------------------------
print("Generating Guardrail PBR (1024x1024)...")
# W-beam profile horizontally across Y
w_beam = (np.sin(np.linspace(0, 4 * np.pi, H)) ** 2)[:, None]
gr_h = w_beam * 0.8 + np.random.rand(H, W) * 0.05
gr_norm = height_to_normal(gr_h, strength=3.5)
gr_albedo = np.full((H, W, 3), 200, dtype=np.uint8)
gr_rough = np.full((H, W), 70, dtype=np.uint8) # Glossy reflective metal
Image.fromarray(gr_albedo).save('assets/textures/guardrail_albedo.png')
Image.fromarray(gr_norm).save('assets/textures/guardrail_normal.png')
Image.fromarray(gr_rough).save('assets/textures/guardrail_roughness.png')

print("All textures successfully generated!")

# =========================================================================
# AUDIO GENERATION (44.1 kHz, 16-bit Mono/Stereo WAVs)
# =========================================================================
print("Generating Audio WAV files...")
SAMPLE_RATE = 44100

def write_wav(filename, samples, sample_rate=44100):
    # Normalize to prevent clipping, max amplitude ~0.85 (-1.4 dBFS)
    max_val = np.max(np.abs(samples))
    if max_val > 0:
        samples = samples / max_val * 0.85
    int_samples = (samples * 32767).astype(np.int16)
    
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_samples.tobytes())

# Multi-RPM Engine loops (Duration ~2.5s seamless loop)
DURATION = 2.5
t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)

def synth_engine(base_freq, cylinders=8, harshness=0.6, turbo=0.0):
    firing_freq = base_freq * (cylinders / 2.0)
    sig = np.zeros_like(t)
    # Combustion harmonics
    for harmonic in [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0]:
        amp = (1.0 / (harmonic ** 0.85)) * (1.0 + harshness * np.random.rand())
        sig += amp * np.sin(2 * np.pi * (firing_freq * harmonic) * t)
    # Add cylinder rumble & slight intake noise
    noise = np.random.randn(len(t)) * 0.2
    # Apply soft distortion for exhaust rasp
    sig = np.tanh((sig + noise) * 1.5)
    if turbo > 0:
        # Turbo whine
        turbo_freq = 1800 + base_freq * 12
        sig += np.sin(2 * np.pi * turbo_freq * t) * turbo
    return sig

# Car 1: V8 GT (Throaty, rich low-end rumble)
print("- Synthesizing Car 1 (V8 GT) engine bands...")
write_wav('assets/audio/car1_idle.wav', synth_engine(base_freq=14, cylinders=8, harshness=0.3))
write_wav('assets/audio/car1_low.wav', synth_engine(base_freq=38, cylinders=8, harshness=0.5))
write_wav('assets/audio/car1_mid.wav', synth_engine(base_freq=75, cylinders=8, harshness=0.7))
write_wav('assets/audio/car1_high.wav', synth_engine(base_freq=120, cylinders=8, harshness=0.9))
write_wav('assets/audio/car1_off.wav', synth_engine(base_freq=45, cylinders=8, harshness=0.2) * (0.8 + 0.2 * np.sin(2*np.pi*15*t)))

# Car 2: Turbo 4-Cylinder Sport Hatch (High-revving, aggressive rally rasp)
print("- Synthesizing Car 2 (Turbo I4) engine bands...")
write_wav('assets/audio/car2_idle.wav', synth_engine(base_freq=16, cylinders=4, harshness=0.4))
write_wav('assets/audio/car2_low.wav', synth_engine(base_freq=48, cylinders=4, harshness=0.6, turbo=0.08))
write_wav('assets/audio/car2_mid.wav', synth_engine(base_freq=90, cylinders=4, harshness=0.8, turbo=0.15))
write_wav('assets/audio/car2_high.wav', synth_engine(base_freq=145, cylinders=4, harshness=1.0, turbo=0.22))
write_wav('assets/audio/car2_off.wav', synth_engine(base_freq=60, cylinders=4, harshness=0.3, turbo=0.05))

# Sfx: Gear shift (Pneumatic cut + mechanical clunk + backfire)
t_shift = np.linspace(0, 0.25, int(SAMPLE_RATE * 0.25), endpoint=False)
shift_sig = np.sin(2 * np.pi * 180 * t_shift) * np.exp(-t_shift * 35)
shift_sig += (np.random.rand(len(t_shift)) - 0.5) * np.exp(-t_shift * 25) * 1.5
write_wav('assets/audio/gear_shift.wav', shift_sig)

# Sfx: Tire squeal (FM synthesis of rubber scrub)
t_tire = np.linspace(0, 2.0, int(SAMPLE_RATE * 2.0), endpoint=False)
mod = np.sin(2 * np.pi * 45 * t_tire) * 120
squeal = np.sin(2 * np.pi * (850 + mod) * t_tire) * 0.6
squeal += np.sin(2 * np.pi * (1420 + mod * 1.3) * t_tire) * 0.4
squeal += np.random.randn(len(t_tire)) * 0.15
write_wav('assets/audio/tire_squeal.wav', squeal)

# Sfx: Curb rumble (24 Hz pulsing thump)
t_curb = np.linspace(0, 1.5, int(SAMPLE_RATE * 1.5), endpoint=False)
curb_pulse = np.sin(2 * np.pi * 32 * t_curb) * (np.sin(2 * np.pi * 16 * t_curb) > 0)
write_wav('assets/audio/rumble_curb.wav', curb_pulse)

# Sfx: Wind rush
t_wind = np.linspace(0, 2.0, int(SAMPLE_RATE * 2.0), endpoint=False)
wind_noise = np.random.randn(len(t_wind))
b_wind = np.convolve(wind_noise, np.ones(40)/40, mode='same')
write_wav('assets/audio/wind.wav', b_wind)

# Sfx: Collisions (Light & Heavy)
t_c = np.linspace(0, 0.4, int(SAMPLE_RATE * 0.4), endpoint=False)
c_heavy = (np.sin(2*np.pi*65*t_c) + np.random.randn(len(t_c))*1.2) * np.exp(-t_c * 15)
write_wav('assets/audio/crash_heavy.wav', c_heavy)
c_light = (np.sin(2*np.pi*130*t_c) + np.random.randn(len(t_c))*0.8) * np.exp(-t_c * 25)
write_wav('assets/audio/crash_light.wav', c_light)

# Sfx: Guardrail scraping
t_scrape = np.linspace(0, 1.5, int(SAMPLE_RATE * 1.5), endpoint=False)
scrape = np.random.randn(len(t_scrape)) * np.sin(2 * np.pi * 2200 * t_scrape)
write_wav('assets/audio/guardrail_scrape.wav', scrape)

# Ambience loops for the 4 Zones
print("- Synthesizing 4-Zone Ambience loops...")
t_amb = np.linspace(0, 4.0, int(SAMPLE_RATE * 4.0), endpoint=False)

# Z1: Ocean surf & gulls
wave_lfo = (np.sin(2 * np.pi * 0.25 * t_amb) * 0.5 + 0.5) ** 2
surf = np.random.randn(len(t_amb)) * wave_lfo * 0.8
# Occasional gull cry
gull_t = np.linspace(0, 0.5, int(SAMPLE_RATE * 0.5), endpoint=False)
gull = np.sin(2 * np.pi * (1800 + 400 * np.sin(2*np.pi*8*gull_t)) * gull_t) * np.exp(-gull_t * 6)
surf[:len(gull)] += gull * 0.4
write_wav('assets/audio/ambience_z1.wav', surf)

# Z2: Mountain cliff wind
cliff_wind = np.random.randn(len(t_amb)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * t_amb))
write_wav('assets/audio/ambience_z2.wav', cliff_wind)

# Z3: Village bells & tranquility
t_bell = np.linspace(0, 2.0, int(SAMPLE_RATE * 2.0), endpoint=False)
bell = (np.sin(2*np.pi*587*t_bell) + 0.5*np.sin(2*np.pi*880*t_bell) + 0.25*np.sin(2*np.pi*1174*t_bell)) * np.exp(-t_bell * 2.2)
amb_z3 = np.random.randn(len(t_amb)) * 0.05
amb_z3[:len(bell)] += bell * 0.6
write_wav('assets/audio/ambience_z3.wav', amb_z3)

# Z4: Pine forest breeze & cicadas
cicadas = np.sin(2 * np.pi * 4200 * t_amb) * (np.sin(2 * np.pi * 12 * t_amb) > 0.2) * 0.2
forest = np.random.randn(len(t_amb)) * 0.15 + cicadas
write_wav('assets/audio/ambience_z4.wav', forest)

# UI Sounds
t_ui = np.linspace(0, 0.08, int(SAMPLE_RATE * 0.08), endpoint=False)
write_wav('assets/audio/ui_click.wav', np.sin(2 * np.pi * 1200 * t_ui) * np.exp(-t_ui * 80))

t_cnt = np.linspace(0, 0.18, int(SAMPLE_RATE * 0.18), endpoint=False)
write_wav('assets/audio/countdown_beep.wav', np.sin(2 * np.pi * 660 * t_cnt) * np.exp(-t_cnt * 20))
write_wav('assets/audio/countdown_go.wav', np.sin(2 * np.pi * 1320 * t_cnt) * np.exp(-t_cnt * 12))

t_fn = np.linspace(0, 1.2, int(SAMPLE_RATE * 1.2), endpoint=False)
cheer = (np.sin(2*np.pi*523*t_fn) + np.sin(2*np.pi*659*t_fn) + np.sin(2*np.pi*784*t_fn)) * np.exp(-t_fn * 3)
write_wav('assets/audio/finish_cheer.wav', cheer)

print("All audio files successfully generated!")
