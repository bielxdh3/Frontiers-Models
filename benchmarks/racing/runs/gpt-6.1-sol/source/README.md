# Solstice — coast club

An original, browser-local coastal arcade racer. Project root: `E:\codex bench`.

## Signature Feature scope, written before implementation

**Postcard studio** lets the player stop at a memorable moment, orbit a photographic camera, choose a locally drawn print treatment and caption, and download a PNG travel postcard. It uses the existing renderer, the pause lifecycle and the current live or replay scene. It never changes race time, weather, scoring or progress. Excluded: a separate exploration game, editing imported photographs, cloud galleries, generative services and a second simulation. This is deliberately a compact photographic extension within the specified complexity ceiling.

## Launch

Requires Node.js 22.12+ or 24+ and a desktop browser with WebGL 2.

```
npm ci
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173`. For the actual static build:

```
npm run build
npm run serve:static
```

Open `http://127.0.0.1:4173`. `serve:static` is a plain file server for `dist`, with no Vite runtime or game API. `npm run preview -- --port 4174` is also available.

## Controls

W accelerate · S brake/reverse · A/D steer · Space drift · Left Shift nitro · R recover · Escape pause · P Postcard studio. All actions can be rebound in Settings using physical keyboard codes. Game menus use ordinary keyboard focus and Enter. Driving keys own their input while a race is active.

## Racing rules

Coastal Sprint: three laps; best valid lap is the result. Riviera Grand Prix: three laps against five rivals; classification freezes when the player finishes or retires. Only opponents that actually finished receive finish times. Horizon Rush: sixteen sequential gates on a dedicated loop; the final gate is the endpoint. Recovery rewinds to the last validated gate and invalidates the current lap. Leaving the paved road invalidates the current lap; only ordered gates crossed forward on the corridor advance progress. All-invalid Time Trials still finish without a record.

Difficulty is fixed for each race. Rivals differ in anticipation, precision, traffic decisions and nitro strategy, with no player-gap speed or skill adjustment.

## Local data and portable replays

Preferences and provenance-qualified lap records use small `localStorage` entries. Replay bodies use OPFS ordinary files, with a five-entry local metadata manifest. Writes require Web Locks; unsupported/denied storage keeps gameplay and temporary replay/export available. No IndexedDB, database, Cache Storage or service worker is used. Interrupted writes are offered as recovered files, including an explicit choice when all five slots are occupied. Browser site-data deletion can erase this data.

Replay format: UTF-8 JSON, `format: "solstice-replay"`, `version: 1`, maximum 8 MiB, maximum 22,002 frames and 30 minutes. Ten snapshots per second plus significant-event snapshots capture all cars, historical HUD, weather and discontinuity epochs. Inputs are strictly bounded and never evaluated. File imports are always marked imported and cannot write personal records. See `docs/replay-format.md` for the schema.

## Testing and handoff

`npm test` runs invariant and integration logic checks. `npm run test:browser` exercises rendered development/static builds using Playwright and isolated harness storage; outputs go to `output/playwright`. Harness journeys are not human driving. The harness is dynamically included only in Vite development mode with `?harness=1`, never in production menus or the production build. Test storage is disposable and separate from the player's data.

See `docs/verification.md` for checks actually completed, limitations and a subsystem evidence table. All visuals, car/track geometry and Web Audio sounds are authored procedurally for this project. No downloaded assets, remote fonts or runtime network services are needed. Runtime dependencies and verified license notices are in `THIRD_PARTY_NOTICES.md`.
