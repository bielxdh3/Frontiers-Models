# Local acceptance evidence — 2026-10-22

The product is running at `http://localhost:5173/`, and its preview tab is retained as the deliverable. The workspace began empty and had no Git metadata. No remote publication was performed.

## Checks that were run

- `npm test`: **21 passed, 0 failed**. Covers the catalog, bounded Kepler solving, deterministic/reversible evaluation, supported dates, parent-relative satellite positions, Earth–Moon barycenter separation, Triton's retrograde direction, J2000 table checkpoints, SI gravity/periods, scale invariance, distance/light-time, degenerate angular measurements, solar versus sidereal days, seasons/polar cases, phases, localized aliases, validated storage, prototype-name rejection and portable-scene camera validation.
- `npm run build`: **passed**. Production output is in `dist/`. The main bundle is approximately 984 KB uncompressed / 280 KB gzip; Vite reports its normal large-chunk advisory for the essential 3D bundle.
- `tests/browser.mjs`: **18 of 18 integrated browser scenarios passed**, without captured runtime errors. After the final camera-restoration and scalable-text correction, the five affected scenarios (03, 10, 11, 14 and 15) were rerun and passed. Reports are `browser-validation-final.json` and `browser-validation-targeted.json`.
- `tests/extended-browser.mjs`: **all twelve activities were completed through their actual required scene/tool interactions**, including observing an Earth orbit. Touch/pinch was exercised in a fresh emulated mobile context. PNG options, scene-only WebM recording, private-free scene export and scene import were exercised. The final targeted photo/share run passed without runtime errors. The twelve-activity completion and mobile images are retained separately from the final targeted report.
- `tests/viewpoint-browser.mjs`: a saved Moon-follow view was restored after a discontinuous jump to 2040. The date and follow mode restored, with **0 px difference** in the Moon label projection at the saved instant. The 1.4× interface-text setting was checked at 390 × 844 and visually inspected.
- `tests/capabilities-browser.mjs`: checks visible button naming and exercises supported synthetic WebGL context loss/restoration. The exact outcome is in `capabilities-validation.json`; this is an API-induced failure test, not a physical GPU failure.

The initial failed development runs were used to correct accessible form names, checkbox hit targets, a same-endpoint numerical roundoff case and a camera-restoration discontinuity. Test fixture corrections included normalizing text extraction and using an actually out-of-range date instead of Unix epoch zero. These are not reported as successful checks from the earlier failing runs.

## Minimum release matrix

“Browser” below means controls were exercised in a real locally launched Chromium instance. “Visual” means an actual browser screenshot was opened and inspected. It does not imply physical-device or screen-reader testing.

| Area | Delivered behavior | Evidence / limit |
| --- | --- | --- |
| Startup | Opens directly into the running local preview | Browser 01; retained in-app tab |
| Opening composition | Seeded stars, luminous Sun, orbital structure, planets and restrained interface | Desktop and mobile opening images inspected |
| Core catalog | Sun, eight planets and Moon selectable and inspectable | Browser 02 visits all ten |
| Extended catalog | 35 entries with distinct identity, relationship, source and representation kind | Catalog test; navigator all-object and alias checks |
| Materials | Bundled distinct planet maps and body-specific procedural fallbacks | Earth/Saturn/overview visuals; forced Venus image failure |
| Rings | Real annuli tied to the planet's equatorial orientation and framing | Browser 04, scale switch and follow; polar/equatorial screenshots |
| Solar lighting | Physical Sun vector supplies each lit hemisphere | Earth, Moon and Saturn visuals; scientific coordinates used by shader |
| Scientific data | Mean diameter/radius, units, reference context and source routes | All core Data/Sources tabs; primary-source routes in catalog |
| Clock | Separate rate/direction/pause; all eight presets, signed custom rate, zero, steps and resets | Browser 07; rate/date guard tests |
| Orbits | Analytic reproducible Kepler motion with individual periods | Scientific tests, reverse playback and orbit observation |
| Satellite hierarchy | Moon and other satellites use positional parent frames independent of spin | Earth/Jupiter/Pluto numerical checks; local-system browser views |
| Scale modes | Compressed exploration and one common physical scale | Browser 03/06; numerical invariance tests |
| Scale laboratory | Size lineup, linear/log distance axis and combined true scale | Browser 08; combined mode forces linear distance axis |
| Camera | Focus/follow/free, system/overview, orientation presets, manual interruption and view history | Browser 03/04; Moon saved-view regression |
| Selection | Catalog, search, scene ray picking and visible locator labels; drag threshold and overlap chooser | Core catalog, moving selection, drag interruption and accessible alternatives exercised |
| Labels | Major/system/selection/favorites/none modes with priority and overlap handling | Opening/local-system visuals; shortcut and layer checks |
| Search | Portuguese/English aliases, diacritic folding, empty state, Enter and arrow routes | Browser 02/13; mathematical search checks |
| Inspector | Contextual overview, data, systems and sources; actions follow stable identity | All core bodies; Moon follow and date/scale changes |
| Calendar | UTC editor, bounded dates, zoom spans, scrubber and bookmarks | Browser 07 valid/invalid dates; saved historical mission date |
| Orbit overlays | Full/selected/system paths, bounded trails, axes, apsides, velocity and tidal arrows | Browser 17 and discontinuity invalidation |
| Reference frames | Heliocentric overview and parent-centered camera contexts, explicitly labeled | Camera/frame control and explanatory model; no observational sky chart claim |
| Comparison | 2–4 bodies, linear ratios, labeled log option, reference, reorder, units and CSV | Browser 05; measured rendered diameter ratio |
| Measurements | Physical center distance, surface context, AU, one-way light-time, frozen/live and observer angle | Browser 06 and numerical scale/degeneracy checks |
| Seasons | Hypothetical tilt/latitude/season angle, hemispheres, day/night and polar handling | Browser 09; zero-tilt activity and analytic tests |
| Moon laboratory | Linked external geometry and viewed phase, illumination, inclination and schematic eclipses | Browser 09; full-phase activity; analytic fractions |
| Orbit sandbox | Hypothetical mass/axis/eccentricity, period/apsides, equal-time area wedge, baseline and gravity | Browser 09; activities 05/09; canonical Earth unchanged |
| Outer system | Logarithmic distance journey, context markers and conceptual Oort Cloud | Browser 12 and actual outer-system screenshot |
| Missions | Five sourced mission timelines with distinct launch/encounter/end dates and filters | Browser 12 visits New Horizons' Pluto encounter date |
| Tours | Six itineraries, manual/automatic controls, retained stop, interruption, photo and exit | Browser 10 interrupts Saturn, exports PNG and resumes the same stop |
| Activities | Twelve state-evaluated activities with hints, retry and local progress | Extended run completed all twelve; completion screenshot retained |
| Encyclopedia | 21 linked concepts with short/deeper explanations and working scene tools | Browser 12 follows eccentricity to the orbit lab |
| Local collections | Favorites, viewpoints, dates, notes and experiments; schema and import review | Browser 11 save/export/import-cancel/reload; storage tests |
| Photography | FOV, exposure, aspect, labels/orbits, guides, freeze, caption and usable PNG | Browser 10; square PNG opened/inspected; actual exported files |
| Optional video | User-started/stopped, scene-only WebM, duration limit | Chromium recording produced a 57 KB test WebM; not universal support |
| Optional narration | Explicit activation only, stop cancellation and authoritative text route | Silent tours verified; voice availability/audio quality not tested |
| Keyboard | Search palette, owned inputs, Escape/modal focus route and camera alternatives | Browser 13; Space in a note leaves playback paused |
| Responsive | Coordinated drawers/sheets and scrollable dedicated workspaces | 360/390/768/1024/1440 widths, 844 × 390 landscape; draft survives rotation |
| Accessibility | Explicit control names, semantic forms, focus styling, reduced motion and scalable text | Form names fixed from real browser checks; 1.4× text inspected; no assistive-technology certification |
| Localization | Portuguese default and English data/actions/export context | Browser 05 changes language and units during a comparison |
| Quality | Four settings, coherent presets, DPR cap and hysteretic adaptation | Browser 14; physical state preserved; low-quality Earth screenshot |
| Recovery | Texture, storage and WebGL-unavailable fallbacks; versioned import rejection | Browser 18; parser tests; context test has its own report |
| Resources | One renderer, cached/disposed resources and bounded traces | Browser 14 opens/closes labs repeatedly and compares GPU geometry counts |
| Completion | Main tools and workflows are executable local product features | 18 integrated scenarios plus focused photo, activity, touch and viewpoint checks |

## Performance observations and practical limits

The automated browser uses Chromium 141 and **ANGLE SwiftShader software rendering**, not a hardware-GPU benchmark. At 1440 × 900 its recorded samples were 5 FPS for the opening, 25 for Saturn, 20 for comparison, 11 for a laboratory/Earth, 5 for a populated system and 18 for high-speed playback. These are short, scene-specific observations; shader warm-up and adaptation affect them. Mobile-width software-rendered screenshots showed substantially higher counters in the inspected frames. The actual in-app preview showed approximately **99–100 FPS** in the overview and about 100 FPS during the earlier Earth/Moon interaction, using the application's 1.5-second frame counter. None of these samples guarantees a device-wide rate.

No physical phone, real screen reader, real GPU failure, every browser engine or narration voice was tested. Mobile input and pinch were emulated. Offline installation is intentionally absent; the loaded application uses bundled data and images and exposes no fake install control. 2× photography is clearly labeled resampling rather than a claim of additional rendered detail. Real eclipse prediction, telemetry and precision satellite ephemerides are outside the declared scientific model.
