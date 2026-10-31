# Delivery verification — 31 October 2026

Project: Solstice — coast club, `E:\codex bench`. The supplied root was empty; no existing project or Git history was available. No commits, remote repository operations, publication or deployment were performed. The interface is in English.

## Checks completed

- `npm test`: **24 passed, zero failed**. Tests run on the actual fixed-step simulator, including individually invalid laps, all-invalid three-lap completion, reverse/repeated/skipped gates, legitimate ranking, five rivals finishing all three laps on each difficulty, both Checkpoint Run terminal states, wet braking, nitro/drift, collision damage, recovery, 30/60/144 Hz input schedules, replay seeking and heading wrap, malformed imports, capacity, replacement, concurrency, orphan recovery and record provenance.
- `npm run test:browser`: **12 journeys passed, zero page/console errors, zero external HTTP requests** in the final full run. Machine-readable evidence: `output/playwright/browser-report.json`. Test fixtures and lap records were explicitly labeled harness-origin and confined to `solstice.test.browser-acceptance`; that storage was purged in the finalizer.
- `npm run build`: production assets generated successfully. Vite reports a single JavaScript chunk above its 500 kB advisory threshold; this is an advisory, not a build failure. No code splitting or runtime CDN is required.
- Compiled assets were served by `scripts/static-server.mjs` on `http://127.0.0.1:4173`, a plain static HTTP file server. Direct browser UI/keyboard input started a real Time Trial, moved the car, retired honestly, and opened its actual replay after the browser context was put offline. The production harness was absent. This check used a disposable browser context.
- Additional visible-browser inspection covered the six-car countdown grid, village, garage designs, render scale (125% produced 1800 × 1125 pixels from 1440 × 900), fullscreen enter/exit, reduced-motion settings and the audio graph. Countdown framing and two-sided sign lettering received a focused final visual correction. The finish tone was verified to retain an active voice after the terminal screen transition.
- A focused RED-to-GREEN browser test made `AudioContext.resume()` remain pending indefinitely. It reproduced a blocked start, then verified that the corrected startup starts a race independently of audio permission. Evidence: `output/playwright/audio-red.json` and `audio-green.json`; reproducible with `node scripts/audio-resilience-check.mjs` while the dev server is running.

## What the browser journeys actually did

Direct Playwright interactions navigated the menu, every garage car, pre-race conditions, all control/quality UI, replay cameras/timeline, saving/replacement/cancellation, file export/import, Postcard studio and pause/retirement. Physical-key events exercised acceleration, nitro, drift, rebinding, recovery, focus clearing and Space while a HUD button had focus. These are automated browser interactions, not a human playthrough.

The development harness completed full three-lap Time Trials and races and both Checkpoint Run outcomes by feeding ordinary player input into the same physics in **1/60-second steps**. It never enlarged physics dt or set a finished result directly. One Time Trial used real recovery during its first lap; its outcomes were invalid/valid/valid, with a 49.283-second best lap written only in disposable harness storage. A separate logic test completed three invalid laps with no record.

The browser ran a six-car race at each fixed difficulty. Normal and Hard browser runs had all five opponents finish before the slower scripted player; the Easy run froze unfinished rivals truthfully when the player finished. Independent simulator checks let all five rivals finish on Easy as well. The browser's deliberately cautious scripted races lasted about 4½ minutes; a faster scripted run completed Riviera in 3min52s during initial tuning. These are harness observations, not measured normal-human pacing.

An actual collision run accumulated damage, recovered backward to an accepted gate, drove through a climate change and retired as partial. Repeated backward/forward replay seeks restored the same historical damage, positions and conditions; all three camera views were inspected. Replay saving survived refresh and reopening. A downloaded full Time Trial replay round-tripped through the file input. A file claiming an impossible 0.001-second record was stamped imported and did not write a personal record.

Actual OPFS and Web Locks were exercised with two browser tabs competing for the fifth slot: one admitted write, one explicit capacity response. An injected metadata-write failure retained all five old entries and exposed the new completed file as a recoverable orphan. Attempting recovery at full capacity required a replacement choice; cancellation preserved the orphan. Storage-denial injection kept replay viewing/export available. `WEBGL_lose_context` loss/restoration paused the race and allowed a controlled resume without a time jump.

## Subsystem completeness

| Mandatory subsystem | Status | Evidence |
| --- | --- | --- |
| Three dedicated 3D courses | Implemented + browser-verified | Distinct 2.15 / 2.65 / 3.13 km layouts; village, coast, elevation, tunnel and viaduct geometry; rendered driving and aerial views. |
| Time Trial | Implemented + browser-verified | Three laps, per-lap validity, best valid lap, actual completion/results/replay. All-invalid case also logic-tested. |
| Six-car race and three difficulties | Implemented + browser-verified | Five concurrent physical rivals, dynamic classification, three complete race journeys, truthful unfinished progress. |
| Checkpoint Run | Implemented + browser-verified | Sixteen ordered gates, time rewards, driving score and ×5 flow; success and 22-second idle timeout. |
| Three cars and garage | Implemented + browser-verified | Original compact/coupe/wedge meshes and different acceleration, top speed, grip and steering; all selected and driven in full harness runs. |
| Arcade handling, nitro and drift | Implemented + browser-verified | Keyboard nitro consumed resource and increased acceleration; controlled slide altered velocity. Wet/dry braking difference additionally logic-tested. |
| Collisions, off-road and recovery | Implemented + browser-verified | Barrier damage, slowdown, ghosted safe rejoin, cleared velocity, invalid lap and non-advancing gate count. Reverse/skip integrity checked by logic tests. |
| Weather and daylight | Implemented + browser-verified | Sunny/cloudy/rainy and initial morning/day/sunset/night settings; evolving clouds, wetness, traction, road sheen, rain and light in live/replay states. |
| Progressive damage | Implemented + browser-verified | Real impact accumulation, retained damage after recovery, clean restart, and before/after collision replay views. |
| Authentic navigable replay | Implemented + browser-verified | Live snapshots, pause/play/seek/start/end, Chase/Trackside/Aerial cameras, historical HUD and discontinuity handling. |
| Five-entry local library | Implemented + browser-verified | OPFS reload durability, full-capacity cancel/replace, two-tab serialization, failed-write orphan recovery. |
| Portable files and validation | Implemented + browser-verified | Download/upload round-trip, malformed-file UI rejection, forged metadata provenance. Size/version/number/event limits additionally logic-tested. |
| Legitimate local lap records | Implemented + browser-verified | Actual finish-time record pathway in isolated harness namespace; imported and retired runs cannot qualify. No pre-populated player records. |
| Remappable keyboard and focus | Implemented + browser-verified | Physical codes, conflict rejection, reset, persistence, ArrowUp acceleration, focused-HUD Space and blur clearing. |
| Graphics, scale, cap and comfort | Implemented + browser-verified | High/Low changed visible instance budgets, shadows and draw calls; 125% buffer resize; frame-cap and reduced-motion preferences applied without resetting a race. Cap is an upper bound. |
| Fullscreen | Implemented + browser-verified | Enter/exit succeeded in the visible Chrome session. Embedded iframe permission behavior is not verified. |
| Audio | Implemented + browser-verified | User-gesture context running, engine/nitro/drift and event graph integration, mute/volume controls, terminal voice survives screen transition. Audible balance by ear is unverified. |
| Pause, restart and failure handling | Implemented + browser-verified | Pause freezes cars/time/weather/recording; focus clearing, fresh runs, storage denial and GPU loss/restoration exercised. Native hidden-tab policy caveat below. |
| Signature Feature | Implemented + browser-verified | Postcard studio orbit/caption/treatment and a real 1600 × 1120 PNG download. Scope recorded before implementation in README. |
| Static/local architecture | Implemented + browser-verified | Generic static host, loaded game continues with network disabled, no backend/database/CDN/account service or runtime external requests. |

## Performance observation and limits

Browser: Chrome **150.0.7871.127** on Windows, ANGLE / NVIDIA GeForce RTX 3070 Ti / D3D11; Medium, 1440 × 900. The loaded scene contained the player and five active rivals in rain/night. It reported 481 draw calls and 114,463 triangles at the observed frame. High/Low checks in another scene reported 752/320 optional scenery instances, 1600/350 rain budget, shadows on/off and 173/94 draw calls respectively.

An observation of 180 browser `requestAnimationFrame` intervals averaged 10.0 ms with 10.1 ms p95. **This measures browser callback cadence, not game-rendered FPS.** Rendering is separately capped. No sustained 60 FPS result or broad hardware-performance claim is made. The measurements were automated/headless; screenshots and extra visual checks also used a visible browser.

Verified desktop viewport sizes: 1440 × 900, 1366 × 768 and 900 × 700. No mobile or touch-driving claim.

Not verified: Firefox/Safari, a physical ABNT2/AZERTY keyboard, audio mix by ear, embedded preview origin/storage restrictions, real full-disk quota exhaustion, OS/browser kill during a file close, very long recordings near the file limits, and sustained human play/handling balance. Quota/interruption failures were injected safely in owned test storage. In the extra automated visible-tab switch, Chrome still reported `document.hidden === false`; that attempt therefore does **not** verify native hidden-tab suspension. The pause and blur paths were exercised, and the actual visibility handler is implemented. Browser site-data clearing can erase saved data.

The game remains playable in memory when safe persistence is unavailable; export is the disclosed fallback. OPFS and Web Locks are detected at runtime. The product is a local desktop game, not a PWA installation or a promise to launch a never-visited page offline.
