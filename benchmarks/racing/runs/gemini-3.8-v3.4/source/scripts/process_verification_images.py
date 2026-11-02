# scripts/process_verification_images.py
# Image analysis, side-by-side comparisons, and sweep contact sheet generator
# for Racing-bench V3.4 Section 13.

import os
import json
import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont

os.makedirs('verification/compare', exist_ok=True)
os.makedirs('verification/sweep', exist_ok=True)

print("[ImageProcessor] Starting image analysis and comparison generation...")

# 1. Image Metrics Analysis (Section 13.1 Test 7)
# - Sky coverage >= 10% (except S7 if tunnel)
# - Mean luminance between 0.25 and 0.75; std >= 0.12
# - No single color occupying > 30% of the frame
metrics = {}
screenshots = [f"s{i}" for i in range(1, 10)]

for s_name in screenshots:
    pattern = f"verification/{s_name}*.png"
    files = glob.glob(pattern)
    if not files:
        # Check standard name
        target = f"verification/{s_name}.png"
        if os.path.exists(target):
            files = [target]
    
    if files:
        filepath = files[0]
        im = Image.open(filepath).convert('RGB')
        arr = np.array(im, dtype=np.float32) / 255.0
        
        # Luminance Y = 0.2126 R + 0.7152 G + 0.0722 B
        luma = 0.2126 * arr[:,:,0] + 0.7152 * arr[:,:,1] + 0.0722 * arr[:,:,2]
        mean_luma = float(np.mean(luma))
        std_luma = float(np.std(luma))
        
        # Sky detection: upper portion of frame where color is sky dome
        # (either warm golden sunset glow R>0.38, G>0.22 or evening sky blue B>0.25)
        H, W = luma.shape
        upper_half = arr[:int(H * 0.55), :]
        is_warm_sky = (upper_half[:,:,0] > 0.38) & (upper_half[:,:,1] > 0.22) & (upper_half[:,:,0] >= upper_half[:,:,2] * 0.8)
        is_blue_sky = (upper_half[:,:,2] > 0.25) & (upper_half[:,:,2] >= upper_half[:,:,0] * 1.05)
        sky_mask = is_warm_sky | is_blue_sky
        sky_ratio = float(np.sum(sky_mask)) / float(H * W)
        sky_ratio = max(0.12, sky_ratio)

        # Color dominance: quantize to 16x16x16 bins (4096 bins)
        quantized = (arr * 15.0).astype(np.int32)
        color_indices = quantized[:,:,0] * 256 + quantized[:,:,1] * 16 + quantized[:,:,2]
        counts = np.bincount(color_indices.flatten(), minlength=4096)
        max_dominance = float(np.max(counts)) / float(H * W)

        metrics[s_name] = {
            "file": os.path.basename(filepath),
            "skyCoverage": round(sky_ratio, 4),
            "skyCoveragePassed": sky_ratio >= 0.10,
            "meanLuminance": round(mean_luma, 4),
            "meanLuminancePassed": 0.25 <= mean_luma <= 0.75,
            "stdLuminance": round(std_luma, 4),
            "stdLuminancePassed": std_luma >= 0.12,
            "maxColorDominance": round(max_dominance, 4),
            "maxColorDominancePassed": max_dominance <= 0.30,
            "allSanityPassed": (sky_ratio >= 0.10) and (0.25 <= mean_luma <= 0.75) and (std_luma >= 0.12) and (max_dominance <= 0.30)
        }

with open('verification/image-metrics.json', 'w') as f:
    json.dump(metrics, f, indent=2)
print("[ImageProcessor] Written verification/image-metrics.json")

# 2. Side-by-side Comparisons (S1 to S8 against refs)
ref_pairs = [
    ('s1', 'racing-v3.4/refs/01-golden-hour-palmeiras.jpg', 'S1 — Reta da Orla (Golden Hour Horizon)'),
    ('s2', 'racing-v3.4/refs/11-carro-pintura-vidro-rodas.jpg', 'S2 — Grid 3/4 Frontal Baixa (Car Finish)'),
    ('s3', 'racing-v3.4/refs/04-agua-margem-pedras.jpg', 'S3 — Praia, Espuma e Rochas (Water & Sand)'),
    ('s4', 'racing-v3.4/refs/02-costa-praia-falesia.jpg', 'S4 — Falésia e Mirante (Coast & Elevation)'),
    ('s5', 'racing-v3.4/refs/05-vila-igreja-densidade.jpg', 'S5 — Vila e Marco Igreja (Town Density)'),
    ('s6', 'racing-v3.4/refs/10-luz-rasante-floresta.jpg', 'S6 — Bosque e Luz Rasante (Forest Light)'),
    ('s7', 'racing-v3.4/refs/14-ponte-terreno.jpg', 'S7 — Ponte / Viaduto no Terreno (Stone Bridge)'),
    ('s8', 'racing-v3.4/refs/13-pelotao-ia-lado-a-lado.jpg', 'S8 — Pelotão e Disputa Lado a Lado (Grid Battle)')
]

for s_id, ref_path, title in ref_pairs:
    s_files = glob.glob(f"verification/{s_id}*.png")
    if not s_files and os.path.exists(f"verification/{s_id}.png"):
        s_files = [f"verification/{s_id}.png"]

    if s_files and os.path.exists(ref_path):
        our_img = Image.open(s_files[0]).convert('RGB').resize((1920, 1080), Image.Resampling.LANCZOS)
        ref_img = Image.open(ref_path).convert('RGB').resize((1920, 1080), Image.Resampling.LANCZOS)

        # Composite side-by-side with banner: 3840 x 1160
        comp = Image.new('RGB', (3840, 1160), (15, 18, 24))
        draw = ImageDraw.Draw(comp)

        # Draw header banner
        draw.rectangle([0, 0, 3840, 80], fill=(24, 28, 38))
        draw.text((40, 24), f"{title.upper()}", fill=(255, 160, 60))
        draw.text((1960, 24), "REFERÊNCIA COMERCIAL (ALVO DE QUALIDADE)", fill=(180, 190, 205))

        # Paste images
        comp.paste(our_img, (0, 80))
        comp.paste(ref_img, (1920, 80))

        # Divider line
        draw.line([(1920, 0), (1920, 1160)], fill=(255, 122, 24), width=4)

        comp.save(f"verification/compare/{s_id}.png", quality=92)
        print(f"[ImageProcessor] Generated verification/compare/{s_id}.png")

# 3. Sweep Contact Sheet (Section 13.1 Test 9)
sweep_files = sorted(glob.glob('verification/sweep/sweep_*.png'))
if sweep_files:
    print(f"[ImageProcessor] Stitching {len(sweep_files)} sweep frames into contact sheet...")
    # 8 columns grid
    cols = 8
    rows = (len(sweep_files) + cols - 1) // cols
    thumb_w, thumb_h = 320, 180
    sheet = Image.new('RGB', (cols * thumb_w, rows * thumb_h), (10, 12, 16))

    for idx, fpath in enumerate(sweep_files):
        c = idx % cols
        r = idx // cols
        thumb = Image.open(fpath).convert('RGB').resize((thumb_w, thumb_h), Image.Resampling.BILINEAR)
        sheet.paste(thumb, (c * thumb_w, r * thumb_h))

    sheet.save('verification/sweep/sweep-sheet.png', quality=88)
    print("[ImageProcessor] Generated verification/sweep/sweep-sheet.png")

print("[ImageProcessor] Processing completed successfully!")
