# Maré Alta

A complete local coastal arcade racer built for Racing-bench V2.6. Player-facing
menus and feedback are in Brazilian Portuguese. Desktop keyboard play is the
primary supported interface.

## Open and play

From PowerShell in `E:\codex bench`:

```powershell
npm ci
npm run dev -- --port 5173
```

Open <http://127.0.0.1:5173>. Choose a mode, visit the garage, select starting
weather/daylight and start. The countdown freezes cars until the actual start.

For the compiled static version:

```powershell
npm run build
npm run serve:static
```

Open <http://127.0.0.1:4173>. This small HTTP server serves only files from `dist`;
it has no game API or persistent state. The `dist` directory can also be served
by an ordinary static HTTP(S) host, including a subdirectory. `npm run preview`
is available as the standard Vite static-preview command. `file://` launch is
not supported. No publication or deployment was performed.

## Controls

| Action | Default physical key |
| --- | --- |
| Accelerate | W |
| Brake / reverse from standstill | S |
| Steer | A / D |
| Controlled drift while steering above 47 km/h | Space |
| Nitro | Left Shift |
| Recover behind the last valid gate | R |
| Pause / resume | Escape |

All eight actions are remappable in Ajustes, with duplicate/reserved-key
rejection and default restoration. The game stores `KeyboardEvent.code` and
uses the browser keyboard-layout map when available. Pause, focus loss and
hidden-tab events clear held inputs and freeze authoritative state. Recovery
invalidates the current lap, clears momentum and provides two seconds of
visibly indicated collision protection. It cannot award portals or time.

## Modes and cars

- **Contra o tempo / Coastal Sprint:** three laps on a 2.15 km flowing coast.
  The best valid single lap is the session result. Invalid laps remain visible.
  Personal records are grouped by car and initial weather/daylight.
- **Grande prêmio / Riviera Grand Prix:** three laps on a 2.77 km village,
  coast, bridge and tunnel route, with five named opponents. Three fixed
  difficulties change anticipation, precision, corner approach and resource
  use. No rubber-banding. When the player finishes, unfinished rivals are
  explicitly reported by their real last progress, without invented times.
- **Corrida de portais / Horizon Rush:** 24 ordered portals over two traversals
  of a 2.67 km hills course. Time bonuses are unique to each legitimate portal.
  New forward distance, speed, drift and nitro build bounded combos. Collision
  or loss of pace breaks the sequence. Timeout is a genuine failed recording.

Brisa R is agile and quick to accelerate; Maré GT balances grip and speed;
Solstice S trades cornering response for speed. Their geometry, performance,
damage and visual identities carry into the replay.

## Cartões do litoral

The signature feature is an original postcard studio built around an actual
recorded race moment. Open a replay, seek to a moment, click **Criar cartão**,
adjust orbit and distance, choose a frame, add a short caption and export a
1,600 × 1,000 PNG locally. It changes no race rules or historical state. The
scope was documented before implementation in `docs/design.md`; online sharing,
image generation, a second simulation and a persistent photo library are
deliberately excluded.

## Replays and local data

Every mode records actual state at 10 Hz plus event snapshots. Finished,
failed and retired attempts retain honest completion labels. The viewer offers
chase/orbit/aerial cameras, play/pause, start/end, backward jumps and a timeline.
Damage, climate, AI and HUD values come from the selected historical time.

The library holds up to five recordings. A sixth requires explicit replacement
or cancellation. Replays are files in OPFS; preferences, manifest and small
personal records use localStorage. Web Locks serialize cross-tab writes. There
is no database. Unsupported/denied storage leaves transient viewing/export
available. Site-data clearing may erase local data. Imported recordings are
always marked imported and never award records. See `docs/replay-format.md`.

Three quality presets change resolution, shadows, vegetation and particle
counts. Resolution scale, 30/60/120 render caps, master volume, mute, reduced
motion and fullscreen are provided. A render cap is not an FPS guarantee.

## Verification

```powershell
npm test
npm run test:browser
```

Browser tests require the dev server on 5173, the compiled static server on
4173, and installed Google Chrome. The browser suite uses a fresh, disposable
context and a development-only input harness at `?harness=1&case=acceptance`.
It advances normal 1/60-second steps, never enlarged physics steps. Test records
and replays use `mare-alta-test-acceptance`; the test storage is purged afterward.
The harness is absent from the production bundle and normal production menus.
Screenshots and detailed execution results are under `output/playwright` and
are not shipped in `dist`.

See `docs/verification.md` for what was observed, the means of verification,
the corrected asynchronous test observations and hardware-dependent paths
that were not checked. A working build or unit suite alone is not evidence of
a human-completed race.

## Technology and provenance

JavaScript ES modules, Three.js 0.187.0, WebGL 2, procedural Web Audio and Vite
8.3.5. All car/course geometry, artwork, shader, textures, signs, frames and
audio were authored for this project. There are no external fonts, downloaded
models, hotlinked assets, runtime web requests, AI services, account keys,
backend, telemetry or database. Once the assets load, gameplay does not require
a network connection; this does not claim first-load offline availability.

Three.js uses the MIT license; the full notice is copied into the static build
as `THIRD-PARTY-NOTICES.txt`. Test tools are development-only. The lockfile
records dependency versions. The initial workspace contained no application
files; local Git branch/HEAD were unavailable (`not a git repository`). No
commits, remote operations or deployment were made.

Official references consulted for APIs only:
[Three.js renderer reference](https://threejs.org/docs/),
[MDN OPFS reference](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system),
[MDN Web Locks reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

