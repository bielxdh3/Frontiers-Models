# Costa Dourada — corrida arcade 3D no navegador

A single-circuit arcade racing game for the desktop browser: **you and 5 AI drivers** on a 3.05 km Mediterranean coastal circuit at golden hour
(sea front → cliff serpentine → village → pine forest with a bridge → back to the sea front). Static site, no build step, works offline.

* Three.js r187 (WebGL2), procedural cars / houses / church / lighthouse / bridge / trees / props, CC0 PBR textures, CC0 HDRI sky, sampled engine audio.
* `track.json` is the single source of the world: road, terrain, colliders, barriers, AI racing line, props and landmarks are all derived from it.

## Run it

```bash
npm ci
npm start            # static server on http://localhost:8137   (any static server works: python -m http.server, npx serve, ...)
```

Open `http://localhost:8137/` in Chrome, Edge or Firefox (a GPU is strongly recommended). `?q=low` starts in the Low preset, `?fps=1` shows an FPS counter.
The site is fully static (`index.html` at the root, assets under `assets/`, three.js vendored in `lib/three/`): it also runs from any web server without Node.

## Controls

| | keyboard | gamepad |
| --- | --- | --- |
| accelerate / brake-reverse | ↑ W / ↓ S | RT / LT |
| steer | ← → / A D | left stick |
| hand-brake | Space | A |
| camera (chase ↔ bonnet) | C | Y |
| reset to the last checkpoint | R | X |
| pause | Esc / P | Start |

Flow: **menu (live race behind it) → garage (2 cars, 6 liveries) → setup (3 or 6 laps, difficulty, quality) → grid presentation → 3-2-1 → race → results → race again / menu**.
HUD: position, lap, lap time and best lap, speed, gear and RPM, mini-map. Settings: master / effects / music volume, graphics quality (Low reloads the game with `?q=low`).

## What is in the game

* **Cars** — *Veloce GT* (RWD coupé, V8 timbre) and *Pulse RS* (AWD hatch, turbo timbre): procedural curved bodies (≈ 62 k body triangles / 82–84 k for the whole model at LOD0, 10–11 materials: clearcoat paint, tinted glass with interior, chrome, rubber, matte plastic, emissive lamps…), spoked rims with discs and calipers, suspension, brake lights, contact shadow, 2 LODs.
* **Physics** — custom rigid-body vehicle at a fixed 120 Hz: ray-cast suspension, combined-slip tyres per surface, automatic gearbox with shift cut and rev limiter, aero, traction control, barrier and car-to-car collisions. The AIs drive the *same* vehicle model (no rubber-banding) with a minimum-curvature racing line, pure pursuit, overtaking and avoidance.
* **Rules** — ordered checkpoints (cutting the track gives no lap), live positions, "≈" projected times for cars that have not finished, automatic resets (under terrain / flipped / off road / stuck) written to a log.
* **World** — 4 zones (Orla, Falésia with a 45 m climb and a viewpoint, Vila with 80 houses near the road, a church and a lighthouse, Bosque with a viaduct), animated sea with foam and white-water rings around rocks, ~1 000 props (lamps, bollards, signs, benches, fences, parasols, tyre walls, hay bales, boulders…), 5 plant species.
* **Audio** — sampled real engine loops in 4+ RPM bands with two timbres, on/off-throttle layers, shift cut, limiter, tyre/wind/scrape/crash layers, per-zone ambience, positional AI engines (≤ 5 voices, light Doppler), church bells, bridge reverb, pause muffle, limiter on the master (peak ≤ −1 dBFS), UI sounds, menu/results music.

## Verification (`npm run verify`)

```bash
npm ci
npm run verify       # ~15 minutes; writes everything into ./verification
```

It serves the game, drives it with Playwright (Chrome → Edge → bundled Chromium; installs Chromium if none is found), runs the tests of spec §13.1–13.3, captures the S1–S12 screenshots, the 25 m camera sweep, the audio/video lap and the metrics, and rewrites `verification/` (`GATES.md`, `REPORT.md`, `scene-stats.json`, `image-metrics.json`, `volta.webm`, `audio-volta.wav`, `logs/`, `compare/`, `sweep/`).
The side-by-side comparison images read the reference pictures from `refs/` — they are used **only** by the verifier and never by the game.
Hand-written parts of the report (differences against each reference, self-assessment, limitations) live in `scripts/verify/notes.json`.

Useful partial runs: `node scripts/verify.mjs --only audit,journey,pause,anticut,audio,shots,sweep,perf` (any subset), `--fast` skips the 6-lap journey.

## Tested hardware and measured performance

Numbers are measured by `npm run verify` (see `verification/REPORT.md`, section 13.3) — Z3 village, 5 AIs in view, 1920×1080, frame-rate limiter off.

| preset | avg FPS | 1 % low FPS | median frame (ms) | p99 (ms) | draw calls | triangles | load time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alta (High) | 122.8 | 83.1 | 8.08 | 11.1 | 1269 | 4.43 M | 12.9 s |
| Baixa (Low) | 174.3 | 125.8 | 5.66 | 7.44 | 816 | 3.19 M | 11.4 s |

Hardware: ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002482) Direct3D11 vs_5_0 ps_5_0, D3D11) · AMD Ryzen 7 5700G with Radeon Graphics (16 threads) · 31.9 GB RAM · Windows_NT 10.0.26300 x64 · chrome 150.0.7871.127 (headless) · 1920×1080, DPR 1.

## Known limitations

Declared shortfalls against the spec (also listed at the top of `verification/REPORT.md`):

* Spec 5.6 — ambient occlusion in the junctions (wall/road, wall/house, car/ground) is NOT implemented: there is no SSAO and no baked AO; only the texture AO channel and the projected contact shadow under each car. Visible in S5/S9/S11.
* Spec 5.6 — lens flare is NOT implemented; the sun is a clamped HDRI disc plus bloom, so the sun disc is not crisply visible in S1 (the sun-facing shots burn out in the glare). S4 and S8 were framed with the sun outside the picture: that is a composition choice, not a fix.
* Spec 5.1 — the two cars are continuous curved procedural bodies (> 15 k triangles, 10–11 materials) but their design is stylised and far from the commercial references: bulbous nose, no mirrors/handles/vents/wing struts, tyres without sidewall detail.
* Spec 4 (Z4) — 'Bosque' is a pine-and-olive slope with a bridge, not a dense forest; S6 does not read as woodland the way refs 08/10 do.
* Spec 4 (Z1) — rocks standing in the water are few and small in frame (S3): 4 boulder variants with an animated white-water ring each; the beach has no dune vegetation tufts or puddles in that view.
* Spec 5.6 — motion blur is a speed-driven radial blur (car and HUD excluded), much weaker than refs 01/06/13; there is no depth of field.
* Spec 13.3 — the Low preset was not run on an integrated GPU; only this desktop was measured.

Other limitations:

* Single machine: every number in this report comes from one desktop (RTX 3070 Ti, Ryzen 7 5700G, headless Chrome). The ≥ 60 FPS target for an integrated GPU in the Low preset is unverified.
* The cars are procedural and stylised; they are not at the level of the commercial references (nose shape, arch edges, mirror/handle details, interior).
* No screen-space ambient occlusion, no lens flare; motion blur is a radial blur driven by speed with the player's car and the HUD excluded. Contact shadows under the cars are projected blobs.
* The circuit has a bridge, not a tunnel; the bridge changes the rolling sound and opens a reverb send.
* The AIs are slower than the test autopilot (Normal difficulty ≈ 113–117 s laps vs ≈ 103 s) and there is no rubber-banding; Hard uses the same limits as the autopilot.
* Music is two CC0 tracks (menu/garage/setup and results); nothing plays during the race. The engine loops come from two CC0 recordings, so the two timbres share raw material (pitched / filtered differently).
* Shadow shimmer, pop-in of vegetation LODs and the 'bloom estourado' veto are judged by eye on the screenshots and video; there is no automatic detector for them.
* The quality switch reloads the page (it re-creates the renderer, shadow maps and post chain), it does not hot-swap presets.
* Measured FPS depends on the machine: the verifier turns the browser frame-rate limiter off for the performance step, other steps run at the display cadence (≈ 100 Hz here), so the FPS in screenshot file names is capped by it.

## Project layout

```
index.html            entry (importmap, canvas, loader)           track.json   the world (single source)
src/world/            track, terrain, ground queries, populate, props placement, validateWorld()
src/physics/          vehicle, collisions, car specs               src/ai/       racing line + driver
src/render/           lighting, HDRI, sea, terrain/road shaders, cars, houses, village, bridge, props, vegetation, post
src/audio/            Web Audio engine + limiter AudioWorklet      src/game/     game loop, race rules, camera, UI glue, test API, audit
src/ui/               DOM interface                                scripts/      server, track generator, verifier
assets/               CC0 textures, HDRI, audio (see ASSET-LICENSES.md)       tools/   dev helpers (audio builder, screenshot tools)
```

Regenerating `track.json` (not needed to run): `node scripts/make-track.mjs`. World-only checks without a browser: `node scripts/check-world.mjs`.

### Rebuilding the audio loops

The shipped loops in `assets/audio/{engine,sfx,amb}` are derived from the original CC0 recordings in `assets/audio/raw/fs/` (see `ASSET-LICENSES.md`):

```bash
node tools/decode-audio.mjs && python tools/audio-build.py all    # needs Python 3 + numpy
```

## Licences

Code: this project. Libraries: three.js (MIT). Assets: CC0 (Poly Haven, Freesound CC0, OpenGameArt CC0) — full list with authors in `ASSET-LICENSES.md`.
