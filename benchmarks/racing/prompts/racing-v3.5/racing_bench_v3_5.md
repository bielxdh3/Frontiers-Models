# Racing-bench V3.5 — Desktop Visual Fidelity Edition

> Status: V3.5, successor to V3.4.1. Preserves the tight scope, single-source-of-truth world generation, real-sample audio, and gated verification workflow, while fixing the structural causes that pushed previous builds toward a low-budget/mobile aesthetic.
> Executor package: this file + the 14 JPGs in `refs/`. Nothing else.
> Key changes from V3.4.1:
>
> 1. **End of forced procedural modeling:** Realistic open-license PBR 3D models (CC0 / CC-BY) are permitted and strongly encouraged for cars, Mediterranean architecture, trees, and props. Stylized / *low-poly* kits (such as Kenney) are prohibited.
> 2. **Ban on synthetic noise textures:** Procedurally generated `<canvas>` or shader noise textures may not be used as primary albedo/normal maps near the track. Scanned/photogrammetry PBR materials are required.
> 3. **Mandatory desktop rendering pipeline:** Cascaded Shadow Maps (CSM), Screen-Space Ambient Occlusion (GTAO / N8AO / SSAO), foliage translucency with smoothed canopy normals, directional aerial perspective, and depth-aware Fresnel water.
> 4. **Mandatory grounding and surface transitions:** Curbs, shoulders, wall-base grime, foundation sinking, and transition decals so the road and buildings integrate organically with the terrain.
> 5. **Verification focused on real visual quality:** Removed bureaucratic metrics that drained iteration time (4-bit RGB buckets, `f = L / 100` geometric plantable-area formulas, and the "compound-box" loophole) in favor of asset-provenance auditing, active-pipeline checks, and strict visual inspection.

---

## 0. Mission

Build, for desktop web browsers, **a 3D racing game against 5 AI opponents, on a single coastal sunset circuit, that looks like a commercial PC/console game in real gameplay screenshots and video.**

This is a benchmark of **visual fidelity, audio polish, and driving feel**. Feature count does not score points. A mobile/prototype aesthetic, synthetic noise textures, soap-bar procedural cars, or *low-poly* assets fail the build—even if physics and automated tests pass.

**Three rules that outweigh everything else:**

1. **The world comes from a single source of truth** (Section 3). A car sinking through the ground, a house intersecting the road, a gap between asphalt and terrain, or floating objects are critical failures, not minor bugs.
2. **Build in vertical slices with gates** (Section 12). Do not move on until the current gate matches the visual bar of the references.
3. **Look at what you built and iterate.** At every gate, generate side-by-side comparisons against the references, ruthlessly diagnose what still looks amateur or mobile, and fix it before proceeding.

---

## 1. Closed Scope

### In Scope

| Item | Exact Requirement |
| --- | --- |
| Mode | 1: Race against AI |
| Laps | 3 (default) or 6 |
| Opponents | 5 AI cars |
| Difficulty | Easy / Normal / Hard |
| Circuit | 1 closed loop, **2.5–3.5 km**, **1:45–2:30** lap time at good pace |
| Cars | **2 distinct realistic models** (different silhouettes); 6 liveries/numbers on the grid |
| Time / Weather | Fixed golden hour, clear sky with sparse clouds, dry |
| Cameras | Chase (default) + hood |
| Controls | Keyboard and gamepad |

### Out of Scope (Do Not Implement, Not Even Partially)

Other game modes, Director mode, replay, photo mode, track editor, car builder/tuning, mechanical damage, pit stops, tire thermal simulation, day/night cycle, rain, dynamic weather, nitro, multiplayer, backend, accounts, achievements, store, narrative cutscenes (only the ~5 s grid-intro camera flyby from Section 10 is allowed), invented "signature features", detailed playable cockpit interior, open world, indoor areas.

Implementing anything from this list counts against the submission.

---

## 2. Visual References

The `refs/` folder contains 14 screenshots from commercial racing games. They are **targets for lighting, materials, density, and composition**, never assets.

- **Forbidden:** using, cropping, tracing, projecting, or sampling pixels from them.
- **Forbidden:** displaying registered real-world car trademarks or commercial brand logos (remove manufacturer badges or replace them with fictional emblems).

| File | What to Study |
| --- | --- |
| `01-golden-hour-palmeiras.jpg` | **Lighting target.** Low sun, warm backlight, warm-sun vs. cool-shadow contrast, crisp specular rim on the car |
| `02-costa-praia-falesia.jpg` | Foreground cliff, curved beach, sea shifting from turquoise to deep blue with depth, atmospheric haze at the horizon |
| `03-areia-dunas-cercas.jpg` | Sand micro-relief and tracks, beach fencing, dust, organic transition along the road shoulder |
| `04-agua-margem-pedras.jpg` | Shallow-water transparency, animated foam and refraction around coastal rocks |
| `05-vila-igreja-densidade.jpg` | **Density target:** architectural massing, rooflines, and street props filling the frame |
| `06-vila-pedra-disputa.jpg` | Detailed stone/plaster houses, realistic car-to-building scale, firm ground contact |
| `07-vila-paredes-velocidade.jpg` | Weathered painted plaster, base dirt/grime, background motion blur with sharp car |
| `08-vegetacao-densa.jpg` | Multi-layered vegetation (canopy, shrubs, groundcover) with no bare voids |
| `09-vegetacao-curva-disputa.jpg` | Corner framed by dense foliage on both sides, wheel-to-wheel racing |
| `10-luz-rasante-floresta.jpg` | Grazing sunbeams and canopy translucency through trees, warm directional haze |
| `11-carro-pintura-vidro-rodas.jpg` | **Car target:** true automotive surfacing, clearcoat, reflective glass, detailed wheels/brakes, strong contact shadow |
| `12-carro-reflexo-motion-blur.jpg` | Environment reflections gliding across body paint in motion, motion blur on background only |
| `13-pelotao-ia-lado-a-lado.jpg` | Tight pack racing, low camera angle, sense of weight and speed |
| `14-ponte-terreno.jpg` | Structural bridge anchored cleanly into terrain, landscape scale |

Sources (Steam, accessed 2026-11-01): Forza Horizon 4 (app 1293830), 5 (1551360), and 6 (2483190), © Microsoft / Playground Games. URLs at the end of this file.

**Banned Aesthetics (Immediate Build Failure):**

- **Mobile / Low-Poly Prototype look:** faceted geometry, toy-like oversaturated colors, blurry or missing shadows, objects "floating" without ambient occlusion, flat ribbon roads pasted onto bare terrain, synthetic procedural noise textures.
- **"Backrooms" look:** enclosed corridor/indoor feel, hidden sky, flat uniform yellow lighting without crisp shadows, repetitive tiling stretching to the horizon, sterile empty spaces.

---

## 3. World Integrity (Single Source of Truth)

This section eliminates cars falling under the ground, houses clipping into the road, floating terrain, and physics/visual mismatches.

### 3.1 One Source of Truth

- The circuit is defined by **a single closed 3D spline** (control points with position, road width, and banking) stored in `track.json`.
- **Everything is derived from it**, strictly in this order:
  1. Visual road mesh + shoulders/curbs
  2. Road physics collider (built from the **exact same** mesh or geometry data; never a separate approximate plane)
  3. Terrain heightfield, **carved/raised to meet the road seamlessly**, with smooth 6–15 m side embankments
  4. Terrain physics collider (from the exact same heightfield)
  5. Exclusion corridors of ≥ 3 m beyond the road edge where no rigid obstacles may be placed
  6. Curbs/rumble strips, guardrails, stone walls, transition decals, and checkpoints placed by arc-length along the spline
  7. AI racing line
  8. Buildings, vegetation, and props placed relative to the spline and **grounded onto the terrain via raycast** (buildings on slopes must include extended foundations/plinths sunk into the terrain so no gap ever appears under a wall)
- **Forbidden:** placing world geometry with loose hardcoded coordinates outside this pipeline.
- Generation is deterministic: the same seed produces the exact same world.

### 3.2 Structural Invariants (Code-Verified)

Write a `validateWorld()` function that runs on load in dev mode and in automated tests. It fails with an explicit error if:

| Invariant | Threshold |
| --- | --- |
| Terrain poking above the road surface inside road width | > 0.02 m |
| Gap or step between road edge and terrain | > 0.15 m |
| Obstacle (building, tree, rigid prop) inside exclusion zone | any |
| Object base floating or buried relative to terrain | > 0.30 m (excluding rocks and building foundations designed to sink into slopes) |
| Overlapping buildings | any |
| Road banking (lateral slope) | > 12° |
| Longitudinal grade | > 14% |
| Corner radius below drivable minimum | < 25 m |
| Checkpoint off-track or out of sequence | any |

### 3.3 Runtime Invariants

Checked every frame in dev mode and logged during automated tests:

- Every wheel (player and AI) touches a valid surface or is within 1.5 m of one, except during genuine airtime; the chassis **never** penetrates below the road/terrain surface.
- If a car ever drops below terrain, clips through a collider, or leaves the world: **immediate safety reset** to the last valid spline position + log entry. In automated tests, **zero** occurrences are accepted.
- Camera collision: the camera never clips into terrain, walls, or buildings (smooth pullback).
- Grid spawn: cars are placed by raycasting onto the road mesh, never at a fixed Y coordinate.
- Fixed physics timestep (e.g., 120 Hz) with sub-stepping; nothing tunnels through barriers at top speed.

### 3.4 Scale

- 1 unit = 1 meter. Car ~4.5 × 1.9 × 1.3 m. Road width 10–12 m. Building floor ~3 m. Door ~2.1 m. Trees 4–15 m.
- Scale verification: include screenshot S11 showing a car parked directly beside a village building and its front door.

---

## 4. The Circuit

Fictional Mediterranean coastline. One lap flows through **4 distinct zones, in this order**:

**Z1 — Waterfront (Start/Finish)**
- Coastal straight facing the low sun near the horizon
- Painted starting grid, start gantry, low seaside walls with flags/banners
- Layered shoreline: dry sand → darker wet sand → animated foam → depth-shaded sea
- Coastal boulders in the water with crashing/lapping foam rings
- Sand drift decals softly invading the outer shoulder of the asphalt

**Z2 — Cliffside**
- Winding climb of 3 or more corners, elevation gain **≥ 40 m**
- Guardrail/stone parapet on the ocean side, sculpted layered rockface on the inner side
- Overlook vista with the Z1 shoreline visible below

**Z3 — Coastal Village**
- At least 400 m of street weaving through buildings, **always open-air**, with sky visible from every point
- Must read as **an inhabited, geographically coherent Mediterranean coastal town**, never isolated houses scattered on grass
- At least **50 distinct architectural units** (2–3 stories, houses, small shops, public buildings) within 30 m of the road, distributed continuously along the village so there are no sterile gaps (urbanize both sides wherever terrain allows; maintain neighborhood continuity even when one side opens to the sea)
- Continuous street fabric: sidewalks/curbs, stone walls, steps, small plazas, alleyways/side streets branching visually off the main road (non-playable), planters, awnings, streetlamps, shutters, and coastal street furniture
- Landmark: a church with a bell tower **or** a lighthouse, visible from afar
- At least 1 plaza, square, or roundabout with trees/foliage and urban framing

**Z4 — Coastal Woods & Descent**
- Fast sweeping descent through stone pines, olive trees, cypresses, and coastal scrub
- **Multi-strata flora**, never isolated trees on bare ground: tall canopy trees, mid-height trees/saplings, dense shrub masses, coastal grasses, ferns/groundcover, and dry needles/leaf-litter transitions along the road verge
- Irregular, organic clusters mixing heights, rotations, scales, and distances (foreground, midground, background). No rows of identical clones and no barren flat margins
- **One structural bridge or one tunnel** anchored naturally into the terrain (if tunnel: ≤ 150 m, warm interior lighting, visible exit)
- Sweeps cleanly back into Z1

**Readability:** From any point on the track in chase camera, the player sees sky, horizon/sea, or a landmark. No section feels like a boxed-in corridor.

---

## 5. Visual Craft & Desktop Rendering Pipeline

"Near" = within 50 m of the track.

### 5.1 Cars

- **Use high-quality realistic open-license PBR 3D car models** (CC0 / CC-BY, see Section 7) adapted and optimized for WebGL—or genuinely sculpted/authored automotive meshes of equivalent commercial quality. **Do not** fall back to code-generated lofted/subdivided "soap-bar" geometry or box-and-cylinder cars.
- 2 clearly distinct silhouettes (e.g., low GT coupe vs. widebody sports hatch/roadster).
- **≥ 20,000 triangles** per car at LOD0 with clean automotive surfacing, panel gaps, wheel arches, bumpers, mirrors, spoiler/diffuser, and separate sub-meshes for wheels and brake assemblies.
- Distinct physically-based materials: metallic/pearl clearcoat paint (`clearcoat: 1.0`, crisp envMap reflections, subtle metallic flake or roughness variation), dark tinted glass with strong Fresnel reflection and visible dark interior silhouette, chrome/brushed metal trim, matte rubber tires with tread normal map, matte black plastics, emissive headlights and brake lights.
- Wheels: multi-spoke rims, profiled tires, visible brake discs and calipers. Wheels spin, steer, and track suspension travel; body rolls and pitches under braking/acceleration/cornering.
- Strong dark contact shadow (baked/projected soft shadow card + real-time shadow + SSAO) anchored tightly beneath the chassis so the car looks heavy and planted.

### 5.2 Materials & Ban on Synthetic Noise

- Every surface near the track uses **real scanned/photogrammetry PBR texture sets** (albedo + normal + roughness + AO where available, from Poly Haven, ambientCG, or equivalent CC0 sources).
- **Strict ban on synthetic textures:** `<canvas>`-painted or shader-noise textures (Perlin/Simplex/Voronoi noise) are **forbidden** as primary albedo/normal maps for asphalt, stone, plaster, sand, cliffs, roof tiles, wood, or bark near the track. Procedural shaders are only allowed for water waves, sky/atmosphere, macro breakup overlays, and micro-detail blending on top of real textures.
- Minimum resolution: **1024²** near the track, **2048²** for road asphalt and primary cliff/terrain layers.
- Anti-tiling: break up large surfaces (asphalt, cliffs, terrain, sea) with macro-variation blending (2+ texture layers via vertex color/splatmap or world-space macro modulation) and placed decals.
- **Asphalt realism:** subtle aggregate grain, weathered painted lane lines, rubber buildup on the racing line, occasional tar cracks/patches, and worn edges.

### 5.3 Grounding & Surface Transitions (Anti-Mobile Rule)

A bare road mesh touching a bare heightfield immediately looks like a mobile game. Every zone must mask seams with physical transitions:

- **Z1 (Waterfront):** sand-drift decals encroaching on road edges, low masonry curbs/barriers with base weathering, wet-sand shoreline gradient.
- **Z2 (Cliffside):** gravel/dirt shoulder strips, drainage curbs, rockfall/scree stones tucked where cliff walls meet the road verge, guardrail posts with concrete footings.
- **Z3 (Village):** raised stone/concrete sidewalks and curbs bordering the street, subtle ambient darkening/grime along the bottom 0.5–1.0 m of building walls, recessed doorways/steps meeting the pavement cleanly.
- **Z4 (Woods):** dirt/pine-needle verges, grass tufts and low shrubs overlapping the edge of the road shoulder, dappled shadow patterns across the asphalt.

### 5.4 Architecture & Village Fabric

- Use realistic open-license Mediterranean architectural models/modular kits (CC0 / CC-BY) textured with scanned plaster, stone, terracotta tile, and weathered wood PBR sets.
- **No "compound-box" buildings:** assembling a house out of primitive `BoxGeometry` walls/frames/roofs fails visual review. Buildings must have genuine architectural detail: recessed windows with shutters/frames, terracotta roof tiles with eaves/overhangs, balconies, awnings, chimneys, stone quoins, and varied rooflines.
- At least **5 distinct building archetypes** with varied warm Mediterranean palettes (ochre, terracotta, sun-bleached white, limestone, muted sienna) and weathered plaster variations.
- Visible secondary streets/alleys (≥ 2) and at least 1 framed plaza with coastal props (planters, wooden shutters, café tables/umbrellas, lampposts, stone benches, utility/wall details).

### 5.5 Flora, Vegetation & Foliage Shading

- At least **4 distinct Mediterranean tree species** (e.g., umbrella/stone pine, olive, coastal palm, cypress) built with real branching trunks and alpha-tested/alpha-to-coverage leaf cards—never cones/spheres on cylinders.
- Complementary multi-strata vegetation: shrub clusters, coastal rosemary/maquis bushes, tall dry grasses, groundcover patches, and cliffside scrub.
- **Mandatory Foliage Shading:**
  - **Smoothed / transferred canopy normals** (radial/spherical normal blending) so tree canopies shade volumetrically rather than showing harsh flat intersecting cards.
  - **Subsurface / backlight translucency approximation** so low golden-hour sunlight glows warmly through leaves and grasses when backlit (compare against Ref 10).
  - Subtle vertex wind sway on leaves and grasses.
- **≥ 12 non-flora props per 100 m** (signs, bollards, lamps, benches, fences, stone walls, boats/moorings near Z1, etc.) integrated naturally into each zone.

### 5.6 Water, Beach & Sky

- **Sky & Atmosphere:** physical/HDRI golden-hour sky with visible glowing sun disk, soft sparse clouds, and **directional aerial perspective**—warm golden-amber atmospheric scattering toward the sun and cooler blue-violet haze in shadows and opposite the sun, creating natural depth separation across cliffs, village rooftops, and trees.
- **Water:**
  - Multi-frequency animated wave normals + gentle vertex swell.
  - **Physically plausible Fresnel reflections** of sky, sun specular glitter path, and coastal silhouette.
  - **Depth-based color absorption:** clear/turquoise in shallow water near the beach and rocks, transitioning smoothly to deep Mediterranean blue offshore.
  - **Animated shoreline and rock-edge foam** driven by water depth / shoreline distance, plus darker wet-sand band with low roughness reflecting the sky.
  - Ocean extends seamlessly to the horizon with no visible edge.

### 5.7 Desktop Lighting & Post-Processing Pipeline (Mandatory)

To achieve PC/console visual parity, the renderer **must** implement all of the following on the High preset:

1. **HDRI + Directional Sun:** High-res CC0 golden-hour EXR/HDR environment map driving IBL reflections and cool sky ambient, paired with a strong warm directional sun aligned to the HDRI sun position. **Keep ambient fill low enough that shadows are crisp, deep, and slightly cool-tinted** (warm key vs. cool shadow contrast).
2. **Cascaded Shadow Maps (CSM):** At least **3 cascades** covering near (0–20 m, razor-sharp around the car), mid (20–80 m), and far (80–250 m), ≥ 2048² per cascade, soft PCF filtering, zero shadow acne or swimming/shimmering.
3. **Screen-Space Ambient Occlusion (GTAO / N8AO / SSAO):** Active real-time AO darkening crevices, under-car contact, curb/wall junctions, and foliage bases.
4. **Tone Mapping & Color Pipeline:** **AgX** or **ACES Filmic** tone mapping, linear working space, accurate sRGB output, subtle filmic contrast (no washed-out grey shadows, no clipped neon highlights).
5. **Post-Processing:** subtle thresholded bloom on sun/highlights/brake lights, subtle sun lens flare/glare when looking toward the sun, and velocity-based or subtle radial **background motion blur** that **never blurs the player's car or HUD**.
6. **Anti-Aliasing:** MSAA (4x) or SMAA/TAA so thin cables, foliage edges, and car body lines are clean at 1080p.

### 5.8 Camera

- Chase camera: ~5.5–6.2 m behind, ~1.6–1.9 m high, horizon around the upper third, speed-reactive FOV (60–75°), damped spring lag that conveys cornering weight and acceleration punch.
- Smooth camera collision (Section 3.3).

### 5.9 Visual Veto

The build fails if any required screenshot or video segment shows:

car sunk below ground or floating · object intersecting the track · flat grey/procedural-noise asphalt · flat blue water or missing shoreline foam · soap-bar procedural car or black-void opaque car windows · primitive/boxy buildings · low-poly stylized assets · cone/cylinder trees or rows of identical tree clones · harsh unblended flat leaf cards · missing shadows, blurry single-frustum shadows, or shimmering shadow edges · floating objects lacking ambient occlusion · abrupt clean seam between road and bare terrain · flat uniform yellow lighting · blown-out bloom · visible pop-in ahead · barren trackside gaps · isolated village houses without street fabric · corridor/Backrooms look.

---

## 6. Audio

Audio carries the same weight as visuals. An engine that sounds like an oscillator buzz fails the build.

**Player Engine**
- **Real recorded engine loop samples across 4 or more RPM bands**, smoothly crossfaded and pitch-shifted by RPM. **Forbidden:** using an oscillator/synth as the primary engine sound.
- Distinct on-throttle (load) and off-throttle (deceleration) layers with smooth transitions.
- The 2 cars must have clearly distinct engine timbres.
- Audible gear shifts (brief torque cut, RPM drop, optional exhaust crackle) and rev limiter at redline.
- Seamless, click-free loops.

**World & Contact**
- Tires: slip-proportional screech; distinct surface rolling audio for asphalt, curbs/rumble strips, sand, and grass/dirt.
- Speed-proportional wind rush.
- Velocity-scaled impact sounds; continuous metallic scrape along guardrails.
- Zone-based ambience with distance crossfading: ocean surf & gulls (Z1), coastal wind (Z2), distant village ambience/bells (Z3), birds & cicadas (Z4).
- Tunnel reverb; bridge rolling resonance.

**AI Cars**
- Positional 3D engine audio with distance attenuation and subtle Doppler shift. Max 5 active voices; distant cars mute cleanly. AI never drowns out the player's engine.

**Mixing**
- Separate buses (player, AI, SFX, ambience, UI, music) with a master limiter.
- **Master peak ≤ −1 dBFS** under all conditions.
- Music optional: menus/results only, or very quiet during racing.
- Consistent UI sounds (navigate, confirm, 3-2-1 countdown, checkered flag).
- Audio initializes cleanly after first user gesture with zero console errors.
- Pause mutes/ducks cleanly; restarting never duplicates voices.
- Volume sliders: master, SFX, music.

**Sources:** Freesound filtered to CC0 / CC-BY (with attribution), OpenGameArt CC0, or custom synthesis (UI and subtle ambience beds only).

---

## 7. External Assets & Licensing

**Allowed (open-license, locally bundled in the build):**

- **Textures & HDRIs:** Poly Haven (CC0), ambientCG (CC0), TextureCan / CGBookcase (CC0).
- **Realistic 3D Models (Cars, Mediterranean Architecture, Trees, Rocks, Props):**
  - **Poly Haven** (CC0)
  - **Sketchfab** (filtered strictly to downloadable **CC0** or **CC-BY 4.0** realistic PBR models, with full attribution recorded)
  - **Quaternius / Fab / BlendSwap / OpenGameArt** — **ONLY** realistic PBR assets matching the target visual style.
- **Audio:** Freesound (CC0 / CC-BY), OpenGameArt (CC0).
- **Engine & Rendering Libraries:** Open-source libraries (Three.js, Babylon.js, `postprocessing`, `n8ao`, `three-csm`, Rapier, cannon-es, etc.).

**Strictly Forbidden:**

- **Low-poly / stylized asset packs** (including Kenney, KayKit, or untextured flat-shaded packs).
- Third-party game code, racing templates, complete pre-built scenes, or pirated/non-open-license models.
- External generative AI services to create assets during the run.
- Runtime CDNs or remote asset fetching: **the final build must run 100% offline** with all assets compressed (KTX2/Basis for textures, Draco/Meshopt for GLB) and bundled locally.

Document every single external asset, author, source URL, and license in `ASSET-LICENSES.md` (fulfilling all CC-BY attribution requirements). Total build size budget: **≤ 500 MB**.

**Network & Consultation Boundary:** During development, consulting official API/library documentation and downloading verified CC0/CC-BY assets from the authorized repositories above is permitted. Consulting or copying game implementations/benchmarks from code repositories (GitHub/GitLab), forums, or racing-game tutorials is forbidden.

---

## 8. Gameplay

- Weighty arcade-simcade handling: responsive acceleration, strong braking, speed-sensitive steering, controllable drift/oversteer. No overly complex tire/drivetrain simulation.
- Credible car-vs-car and car-vs-barrier collisions without tunneling or sticky walls.
- Automatic reset if flipped, stuck/off-track for > 3 s, or below terrain.
- Particles: tire smoke on heavy slip, sand/dust plumes off-asphalt, subtle sun-lit dust motes.

---

## 9. AI

- 5 AI cars driven by the **exact same physics** as the player. No teleporting, visible rubber-banding, or faked positions (the Section 3.3 safety reset is the only exception and must be logged).
- Spline-derived racing line with curvature-based target speeds, pre-corner braking, lane switching to overtake, and basic collision avoidance.
- Difficulty adjusts target pace and overtaking assertiveness.

---

## 10. Rules & UI

- Sequential checkpoints; corner-cutting does not count a lap.
- Real-time race standings computed from spline progress.
- 3-2-1 countdown; jumping the start yields no advantage.
- Race ends when the player finishes the final lap; remaining AI cars receive projected times marked with "≈".

Flow: **Main Menu (live track camera in background) → Garage (2 cars, 6 liveries, car rotating in golden-hour lighting) → Race Setup (laps, difficulty, quality) → Grid Intro (~5 s dynamic camera) → 3-2-1 → Race → Results → Race Again / Menu.**

Clean, modern commercial HUD: position, lap, current & best lap time, speed, gear/RPM tachometer, crisp minimap. Pause menu: resume, restart, main menu. Settings: graphics preset (Low/High), audio volumes, control bindings.

---

## 11. Performance

- **High:** ≥ 60 FPS average on an RTX 3060-class GPU at 1080p in Z3 with 5 AI cars active.
- **Low:** ≥ 60 FPS on a modern integrated GPU. Scales down shadow cascade resolution/count, AO quality, foliage draw distance, internal render scale, and post-processing. **Never** degrades into flat solid-color blocks or empty zones—keep textures, silhouettes, and near-track density intact.
- Pre-compile shaders during loading so there is zero zone-transition stutter.
- Loading screen with real progress reporting.

---

## 12. Gated Vertical-Slice Workflow

Build strictly in this order. At every gate: run `validateWorld()`, capture the required screenshots, place them side-by-side with the target references, write honest deficits in `verification/GATES.md`, and **fix visual defects before advancing**. Advancing past a visually weak gate counts heavily against the submission.

| Gate | Built | Must Pass Before Advancing |
| --- | --- | --- |
| **P1 — Skeleton** | `track.json`, road, terrain, colliders, drivable placeholder car, camera | `validateWorld()` clean; 1 full drivable lap without clipping; overhead map screenshot S12 |
| **P2 — Lighting, Pipeline & Hero Cars** | HDRI, sun, **CSM**, **SSAO/GTAO**, AgX/ACES, **final realistic cars** with PBR materials | S2 holds up side-by-side against Ref 11 (clearcoat, glass, wheels, contact shadow, crisp warm/cool light) |
| **P3 — Waterfront Vertical Slice (Z1)** | Complete Z1: depth-shaded ocean, foam, wet sand, scanned asphalt, sand decals, props | S1 and S3 hold up against Refs 01, 02, 04. **Z1 must look ship-ready before starting Z2** |
| **P4 — Zones 2–4** | Cliffside, Coastal Village (continuous street fabric), Woods (multi-strata foliage + translucency), Bridge/Tunnel | S4–S7 pass visual review against Refs 02, 05–10, 14; `validateWorld()` clean; zero mobile/empty seams in 25 m sweep |
| **P5 — Race, AI, Audio & UI** | AI physics racing, checkpoints, real-sample engine audio, full menu/HUD flow | Automated gameplay & audio tests (13.1 & 13.2) pass |
| **P6 — Polish & Optimization** | Low preset, shader pre-compilation, texture/mesh compression, final visual pass | Full Section 13 verification passes cleanly |

If time runs tight, shorten distant background scenery—**never** compromise the car models, lighting/CSM/AO pipeline, near-track scanned PBR materials, or engine audio.

---

## 13. Mandatory Verification

Run everything for real, save outputs to `verification/`, and never fabricate data.

### 13.0 Proof Rules

Self-praise does not count as proof. Evaluators will re-run verification on a clean machine.

1. **One command reproduces everything:** `npm ci && npm run verify` starts the local server, runs all automated tests, captures screenshots, video, audio, and scene/pipeline stats into `verification/`. If it fails on a clean machine, the submission fails.
2. **Divergence fails:** If re-running `npm run verify` produces results inconsistent with submitted artifacts (screenshots, stats, or FPS outside ±15%), the submission fails.
3. **Side-by-side visual critique:** For every screenshot with a reference, generate `verification/compare/sN.png` showing your capture beside the target reference at matching resolution. In `verification/REPORT.md`, list at least **3 concrete visual differences** per screenshot (e.g., "shadow under chassis is softer than Ref 11", "road shoulder lacks sand drift"). Generic praise like "looks great" or "matches reference" invalidates the report.
4. **Full-lap gameplay video:** Record `verification/volta.webm` — one complete lap on High in chase camera with all 5 AI cars and live audio.
5. **Runtime-extracted metrics:** `verification/scene-stats.json` must be emitted directly by runtime inspection of the loaded scene and renderer, never hand-written.
6. **Zero hidden failures:** Any failing test fails the build. If a defect cannot be resolved, declare it explicitly at the top of `verification/REPORT.md`.

### 13.1 Automated Tests (Playwright or Equivalent)

Save logs for every test:

1. **Full Race Journey (3 laps):** menu → garage → 3-lap race with 5 AI → results → race again (autopilot permitted for test execution only).
2. **Extended Race (6 laps):** same flow for 6 laps.
3. **State & Memory Hygiene:** pause/resume, mid-race restart, return to menu × 3 cycles — no stale state, no duplicated audio voices, stable JS heap.
4. **Anti-Cut:** cutting off-track does not increment lap count.
5. **AI Competence:** no AI stuck or off-track for > 5 s; at least 1 genuine AI overtake logged.
6. **World & Physics Integrity:** `validateWorld()` reports 0 errors; across tests 1 & 2, **zero** under-terrain, collider-tunneling, or out-of-world resets; camera never clips inside geometry.
7. **Scene, Asset & Pipeline Audit** (extracted from the live scene graph & renderer into `verification/scene-stats.json`). Fails if:
   - Either car has `< 20,000` LOD0 triangles or `< 6` distinct materials.
   - Any required desktop pipeline feature is inactive on High: **CSM** (≥ 3 cascades, ≥ 2048²), **SSAO/GTAO/N8AO**, **AgX/ACES tone mapping**, **HDRI environment map**, or **foliage translucency shader**.
   - Any primary material near the track lacks both a real image-based albedo map and a normal map (excluding glass, water, emissives), uses textures below minimum resolution (1024² near track / 2048² asphalt), or uses a `<canvas>`-generated procedural noise texture as primary albedo/normal.
   - Any village building or car is constructed as a bare primitive or simple composite of `BoxGeometry` primitives without real architectural/automotive mesh assets.
   - Village Z3 has `< 50` distinct buildings, `< 5` architectural archetypes, or gaps > 80 m of barren un-urbanized frontage inside Z3 (excluding intentional plazas or cliffside sea openings).
   - Woods Z4 has `< 4` tree species, lacks distinct tree + shrub + groundcover strata, or has barren un-vegetated margins inside plantable segments.
   - Player engine audio does not bind real `AudioBuffer` sample loops (≥ 4 RPM bands).
8. **25 m Track Sweep:** Capture chase-camera thumbnails every 25 m around the entire circuit into `verification/sweep/` plus a contact sheet `verification/sweep-sheet.png`. Inspect Z1–Z4 on both High and Low, explicitly documenting any visual seams, floating objects, barren voids, or pop-in in `verification/REPORT.md`.

### 13.2 Audio Capture

After unlocking Web Audio via a real user gesture, tap and record the **actual PCM output of the master bus post-limiter** during a full lap with AI cars directly from the browser audio graph (`AudioWorklet` or `MediaStreamAudioDestinationNode`), exporting `verification/audio-volta.wav`. Must work in headless Playwright without OS audio loopback devices. Do not synthesize a fake test file.

In `REPORT.md`, report: peak dBFS (must be ≤ −1.0 dBFS), max simultaneous voices, voice count before/after 3 restarts, and timestamps (`mm:ss`) for gear shift, tire slip, impact, tunnel/bridge transition, and AI pass-by.

### 13.3 Performance Metrics

Report average FPS and 1% low FPS on High and Low in Z3 (5 AI active), along with exact GPU, CPU, browser version, and resolution.

### 13.4 Mandatory Screenshots (1920×1080)

Use **exact filenames** below. S1 and S3–S9 are live gameplay captures on High (with HUD and AI as applicable); **S2** is grid showcase without HUD; **S10** matches S5 on Low preset; **S11** is static scale inspection; **S12** is overhead circuit map. Camera poses must be defined in code and reproducible via script.

| # | Filename | Shot Description | Compare Against |
| --- | --- | --- | --- |
| S1 | `s1-reta-orla.png` | Waterfront straight at speed, low sun ahead | 01, 02 |
| S2 | `s2-grid-3-4.png` | Hero car on grid, low front 3/4 angle (no HUD) | 11 |
| S3 | `s3-praia-espuma.png` | Low shoreline shot: wet sand, animated foam, rocks | 02, 04 |
| S4 | `s4-falesia-mirante.png` | Cliffside switchback overlooking the sea below | 02 |
| S5 | `s5-vila-rua.png` | Village street framing buildings, props, and landmark | 05, 06, 07 |
| S6 | `s6-bosque-luz.png` | Coastal woods with grazing golden-hour light & translucency | 08, 10 |
| S7 | `s7-ponte-ou-tunel.png` | Bridge or tunnel entrance anchored into terrain | 14 |
| S8 | `s8-disputa.png` | Wheel-to-wheel pack battle with 2+ AI cars | 09, 13 |
| S9 | `s9-close-pista.png` | Close-up of asphalt texture, curb, shoulder transition & guardrail | — |
| S10 | `s10-baixa-vila.png` | Exact S5 camera pose on Low preset | — |
| S11 | `s11-escala.png` | Car parked beside a village building and its front door | — |
| S12 | `s12-mapa.png` | Top-down overview of the entire circuit | — |

---

## 14. Deliverables

- Static web build with `index.html` at the root; runs offline from any local static file server
- `track.json` (single source of truth)
- `README.md`: run instructions, controls, tested hardware, FPS, known limitations
- `ASSET-LICENSES.md`: complete manifest of all external 3D models, textures, HDRIs, and audio with author, URL, and license (CC0 / CC-BY)
- `npm run verify` reproducible from a clean `npm ci`
- `verification/`: `GATES.md`, `REPORT.md`, test logs, `scene-stats.json`, `volta.webm`, `audio-volta.wav`, `s1`–`s12` screenshots, `compare/`, `sweep/`, `sweep-sheet.png`
- Zero files from `refs/` shipped inside the build

---

### Reference URLs

1. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_16be1ecc46e7c0a3aa68e646af904c66ea8e1c81.1920x1080.jpg
2. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_00f0090174380eeaf8753bd3d1028b6772c3aebf.1920x1080.jpg
3. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1293830/ss_e88792a0331f460d913ac05203f7c1b12112b14c.1920x1080.jpg
4. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_3c16188972c826942f47991d91b0f6dc17e01fc9.1920x1080.jpg
5. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_d26239d188301bb6f2475c6d323ae007195b7542.1920x1080.jpg
6. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1293830/ss_f79c110d699dadfdb6945984a65a2aa825787075.1920x1080.jpg
7. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_c8390c1e88ba5e660a58e8e435ebc77dcda5c91d.1920x1080.jpg
8. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_78e4f63e05d50e59b9966ba8da9a53dbf84fd8f4.1920x1080.jpg
9. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1293830/ss_ae4d2485f415b08ba4c00195d29680369e23405a.1920x1080.jpg
10. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/d4b81f0cafcfba410371e53bd696fb5cc9b434c0/ss_d4b81f0cafcfba410371e53bd696fb5cc9b434c0.1920x1080.jpg
11. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_cf56e25a0290556ba83229eb0ab370d10be0407c.1920x1080.jpg
12. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_1da0673f82eccc3c9d222237dec40e36bf10eef3.1920x1080.jpg
13. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/701382eb1431c978e0c7e2518f47aa02b3fe6583/ss_701382eb1431c978e0c7e2518f47aa02b3fe6583.1920x1080.jpg
14. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_af9712cbc5121307926cb3e7dfc7228d45940557.1920x1080.jpg