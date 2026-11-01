# Maré Alta

Original coastal arcade racer for Racing-bench V2.6. All game-specific implementation, vehicle geometry, tracks, textures, UI and sounds are authored inside this project. No external asset or model generation.

## Signature feature scope, established before implementation

**Cartões do litoral** is a replay-based photographic postcard studio. The player pauses a real recorded moment, chooses a camera, composes its orbit/zoom, selects one of three original postcard frames, writes a short caption and exports a local PNG. The image includes the actual mode and historical time. It connects the existing replay renderer, canvas capture and a small compositing UI. It does not modify race motion, scores, weather, records or replay data. Excluded: online sharing, image generation, image uploads, free-world editing, separate photo simulation, video rendering and a persistent image library. This bounded presentation tool stays well below the 7/10 complexity ceiling and has no effect on competitive integrity.

## Core rules

One 60 Hz fixed-step simulation owns input, all six cars, climate, timing, route gates, damage and recording. Three routes use independent authored control points. Every ordered sector must be driven forwards on the road. Off-road excursions and recovery invalidate the current lap, without removing other valid laps. Recovery returns behind the last legitimately passed gate and cannot award progress. Missing a gate requires returning to that gate. Three traversals finish Time Trial / Race even if all lap times are invalid; only valid locally played Time Trial laps can award a personal best at a completed session. The race resolves when the player finishes; unfinished rivals are explicitly classified by progress, without invented finish times. Horizon Rush uses two traversals of twelve gates, with bounded time rewards and distance-earned combos.

Replay snapshots at 10 Hz record every car and HUD state; significant collision, recovery, lap, gate and terminal events force additional snapshots. Discontinuities use a recovery serial, angles take the shortest arc, and discrete historical state comes from the preceding sample. Recordings are immutable in the viewer.

Replay persistence uses OPFS files and a small localStorage manifest, with exclusive Web Locks. Unsupported locking or file storage disables durable writes, preserving transient viewing/export. A write creates a new file, closes and validates it, then commits the manifest before deleting a replaced file. Interrupted file writes are reconciled as recoverable orphans; a full library never silently admits or discards one. Imported files can never invoke the personal-record path.

Portuguese is the consistent player-facing language. Desktop keyboard controls are primary. No runtime network calls, database, external fonts, telemetry or service worker.
