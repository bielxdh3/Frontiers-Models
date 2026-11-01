# Verification and delivery evidence

Delivery date: 2026-11-01 (America/Cuiaba). This describes the game and evidence,
not a rating of any model. All implementation was performed in the dedicated
project, without delegation, prior-project source, saved memories or private
connected sources. Tool-operation instructions were used only for Playwright.

## Executed checks

- `npm run build`: passed. Compiled static HTML/CSS/JavaScript and local notices.
- `npm test`: 12/12 passed. See `tests/simulation.test.js`.
- `npm run test:browser`: first broad run passed 12 journeys and exposed two
  asynchronous test-observation failures. The import test was setting files
  before the library finished rendering; the static test initially reloaded
  before the save commit, then asserted viewer visibility before file loading.
  The application did not report false save success or uncaught exceptions.
- Targeted import/save/export/refresh run: passed after waiting for the library
  and save completion.
- Targeted static-production run: passed after waiting for the saved viewer.
  This was resumed after the user's explicit request to continue. No further
  repetitions of the passing full browser suite were performed.
- Final visual inspection: 1440×900 and 800×680; menu, garage, daytime racing,
  wet/night racing, hills, results, settings, replay and postcard studio.
  Rendered test scenes used the same game physics and renderer. Large harness
  position changes exposed camera interpolation through terrain; the camera now
  resets on a recovery serial change or a large discontinuity. Ordinary driving
  retains smoothing. Rain particles and ground shadows use original soft sprites.

Raw evidence is retained in `output/playwright/acceptance.json`,
`acceptance-targeted.json`,
`acceptance-targeted-static-production.json` and `visual-inspection.json`.
The initial failure records are intentionally preserved rather than overwritten
as successes. `output/playwright/acceptance-final.json` combines those independent
runs into 14/14 passed browser checks and records SHA-256 hashes of the delivered
source and static assets. The 12 logic checks passed separately. Small final
presentation changes did not alter the already-tested simulation or storage code.

## Feature completeness

“Browser-verified” below distinguishes direct keyboard/UI actions from the
development input harness. No claim is made that a human drove full races.

| Mandatory subsystem | Status | Evidence and boundary |
| --- | --- | --- |
| Original 3D coastal world and three dedicated courses | Implemented + browser-verified | Menu/garage/day/wet/night/hills rendered and inspected; all three geometries traversed by the normal physics harness. |
| Three differentiated cars and garage | Implemented + browser-verified | All three selected through UI; all three completed Time Trial in logic checks with distinct physics. |
| Shared start/countdown/pause/results/restart/retirement | Implemented + browser-verified | Direct keyboard start, pause/resume, partial retirement; harness terminal states and fresh starts. |
| Three-lap Time Trial and valid lap records | Implemented + browser-verified | Harness completed exactly three valid laps in 139.75 simulation seconds; genuine record path exercised only in test storage. |
| Checkpoint/lap/shortcut integrity | Implemented + logic-tested only for full edge matrix | Reverse contact, skipped gates, repeated triggers, recovery rollback and three-invalid-lap completion tested as logic; recovery also exercised in browser. |
| Six-car race and fixed difficulties | Implemented + browser-verified | Three full harness races: approximately 197 seconds each. Easy/normal player finished first; hard finished fourth behind three genuinely finished rivals. Unfinished opponents retained null finish times. |
| Horizon Rush timer, 24 portals, combos and outcomes | Implemented + browser-verified | Harness success at 24/24 portals with 83,220 points; separate no-input timeout at 30.02 active seconds; both recorded honest outcomes. |
| Arcade handling, nitro and drift | Implemented + browser-verified | Direct throttle/nitro/steering/Space input; nitro decreased while accelerating. Wet/dry and drift movement differences also checked in logic. |
| Contacts, progressive damage and recovery | Implemented + browser-verified | Actual rival collisions in every race difficulty; bounded injected barrier contact changed damage; recovery cleared motion and replay restored historic damage. |
| Weather, daylight and surface response | Implemented + browser-verified | Dry daytime, rain/night and sunset scenes inspected; historic wetness changed from 0.746 to 0 in a recorded run; traction differences checked in logic. |
| Live chase camera and replay cameras | Implemented + browser-verified | Live driving, chase/orbit/aerial UI, recovery/large-position camera reset visually checked. |
| Real replay recording and seeking | Implemented + browser-verified | Actual completed/failed/partial runs recorded; seek backward/forward returned equal state at equal timestamps; recovery discontinuity and angles covered in logic. |
| Five-entry library and file exchange | Implemented + browser-verified | Save, refresh, reopen, export/import, sixth-save refusal, cancel and explicit replacement exercised. Imported entries were stamped imported. |
| Record authenticity | Implemented + browser-verified | Plausible imported metadata claiming a 0.001-second best did not change the local record list. |
| Concurrent/interrupted storage | Implemented + browser-verified | Two real tabs raced for one remaining slot: one succeeded, one refused. Injected quota failure preserved old entries; orphan at capacity required a choice. |
| Storage-unavailable behavior | Implemented + browser-verified | Injected denied storage left finished transient replay usable and showed a truthful export route. |
| Graphics quality, resolution and frame cap | Implemented + browser-verified | Low/medium/high changed real workload without changing paused race time. Resolution and cap controls are wired; broad GPU pacing not benchmarked. |
| Remappable physical keyboard controls | Implemented + browser-verified | Conflict rejected; throttle rebound to ArrowUp and moved the actual car; defaults restored. Focused HUD Space did not click/pause or scroll. |
| Resizing, UI focus and interruption | Implemented + browser-verified | Narrow menu/settings/driving inspected; injected blur cleared input and froze state. Focus trapping and semantic controls implemented. |
| GPU context loss/recovery | Implemented + browser-verified | WEBGL_lose_context injection paused the race and recovered without restarting it. Total initialization failure UI is implemented but not forced in a browser. |
| Audio, master volume and mute | Implemented but hardware output untested | Procedural engine/tire/nitro/event audio graph runs without uncaught errors. Audible quality, output-device routing and physical speakers were not independently verified. |
| Reduced motion and fullscreen | Implemented but untested for complete hardware paths | Controls are wired; reduced motion disables decorative smoothing. Browser/OS fullscreen entry and an actual foreign keyboard layout were not independently exercised. |
| Signature feature: Cartões do litoral | Implemented + browser-verified | Real replay frame, camera orbit, caption, frame choice and local PNG export exercised; output was a valid approximately 1.25 MB image. |
| Generic static production build | Implemented + browser-verified | Generic local HTTP server served `dist`; direct driving, save, refresh and saved replay opening passed; production harness absent. |
| Local-only execution and licenses | Implemented + browser-verified | No external runtime requests observed. Three.js MIT notice included; no database, backend, downloaded assets or runtime API. |

## Specific logic coverage

The 12 logic tests verify countdown/pause invariants; distinct complete routes;
all-car viability and AI difficulty effects; reverse/skipped/repeated gate
handling; recovery and independent lap validity; all-invalid/retired/timeout
outcomes; honest classification and stable ties; equivalent 30/60/120 Hz render
schedules; wetness/nitro/drift behavior; replay round-trip and direction-independent
seeking; malformed/incompatible/non-finite/oversized imports; and binding conflicts
with corrupt-preference fallback.

## Test isolation and performance limits

Chrome 150.0.7871.127 was used. Menu and garage were also opened in a headed
Playwright session. The broad automation ran in a fresh headless Chrome context
at 1440×900 and 800×680. Full races used a development-only autopilot issuing
normal player controls and multiple fixed 1/60-second steps. No larger physics
step, artificial lap finish or fabricated result was used.

Harness writes used isolated `mare-alta-test-*` storage and were purged. Test
artifacts are marked harness-origin and kept only as development evidence outside
`dist`. Production-origin direct-input testing used a separate disposable browser
context, which was closed. No player library was prepopulated.

The low preset demonstrably reduced geometry/shadow workload. A trial → race →
trial resource observation returned to the same geometry count; this is a bounded
lifecycle check, not a proof of unlimited-session stability. No 60 FPS claim,
consumer-GPU benchmark, mobile support or cross-browser compatibility is claimed.

Not independently verified: Firefox/Safari, physical ABNT2/AZERTY labels,
fullscreen on the user's desktop, audible output quality, long races beyond the
one-hour replay limit, actual browser/process termination during an OPFS write,
an OS quota exhaustion event, a physically minimized browser/tab lifecycle,
or first-ever offline load. Storage/context failures used controlled injection.
The application has no service worker and makes no first-load offline promise.

No commit, push, pull request, merge, publication or deployment was performed.
