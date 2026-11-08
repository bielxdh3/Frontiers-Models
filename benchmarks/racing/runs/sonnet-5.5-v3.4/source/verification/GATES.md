# GATES — status of each work gate (spec section 12)

Run: 2026-11-07 18:54:19 UTC. Each gate lists the automatic evidence and what is still below target.

## P1 — Esqueleto

- validateWorld(): PASS (4033 objects checked)
- A full lap driven (test 1): PASS; zero under-terrain events: PASS; zero collider crossings: PASS
- Top view of the whole lap: `s12-mapa.png`

**Below target:** Terrain outside the corridor is a generated height-field: slopes are smooth, there are no hand-modelled cliff faces, and the ravine under the viaduct is a plain eroded slope (S7).

## P2 — Luz e carro

- HDRI sunset (Poly Haven, CC0) + directional sun + cascaded shadows + AgX tone mapping + colour grade; final cars with clearcoat paint, glass, chrome, rubber, spoked rims, discs and calipers
- S2 (`s2-grid-3-4.png`) vs ref 11 (`compare/s2.png`); S1 shows shadows and sky

**Below target:** The car bodies are procedural (swept cross-sections + analytic lamp / grille / panel-gap shader). Continuous curved surfaces, but proportions are stylised; clearcoat reflections come from a 2048×1024 environment so they are softer than a real probe. S2 does not match ref 11 in detail, wing, vents or light.

## P3 — Orla completa

- Z1: sea with waves and foam, beach (dry → wet sand), rocks standing in the water with white-water rings, promenade props
- S1 and S3 vs refs 01, 02, 04 (`compare/`)

**Below target:** Z1 has sea with waves, foam, wet sand and rocks with white-water rings, but no AO at wall/road junctions, no lens flare and only a mild radial motion blur. The rocks are four displaced-icosahedron variants.

## P4 — Zonas 2–4

- Cliff serpentine with a viewpoint (mirante), village with 80 houses near the road and a church, forest descent with a bridge
- Props density: min 16 per 100 m; S4–S7 captured

**Below target:** Vegetation is alpha-card foliage with 5 species and a few variants each. The viaduct is a deck + piers + abutments (no arches, no tunnel). The village has 80 houses near the road and a church whose spire is visible in S5 but small.

## P5 — Corrida

- Tests 13.1: journey3=PASS, journey6=PASS, pause=PASS, anticut=PASS
- Audio 13.2: PASS

**Below target:** The test autopilot is the same driver code as the AIs; scripted skid / wall-contact manoeuvres are used only inside the audio lap to provoke those sounds. All 13.1 / 13.2 checks pass in this run.

## P6 — Polimento

- Performance (13.3): high 122.8 avg / 83.1 1%-low; low 174.3 avg / 125.8 1%-low
- Sweep every 25 m: 122/122 pass

**Below target:** Performance was measured on one desktop GPU (RTX 3070 Ti) with the frame-rate limiter off; the Low preset was never run on an integrated GPU.
