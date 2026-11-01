# RACING-BENCH V3.0 — PHOTOREAL CINEMATIC PREMIUM ARCADE RACER

**Version 3.0 — Complete, independent execution contract · 3-course / 4-car / 3-Signature-Feature edition**

**Continuity and provenance.** This version is a substantially elevated successor to V2.6, not a patch, silent rewrite or reinterpretation of the historical V2.6 artifact. All V3.0 runners must receive the *same complete frozen V3.0 text*. The V2.6 Mandatory Execution Addendum's browser/build/tool-operation permission is explicitly incorporated in V3.0 Section 01 and does **not** need to be attached to V3.0. Gemini's separate V3 review-context file is for **offline specification review only**; it is not a runner instruction and must not be supplied to contestants. V2.6 source, screenshots, results and archived runs remain unchanged.

**Controlling requirements:** Where a V2.6-derived requirement and a V3.0-specific clause could appear inconsistent, the explicit V3.0 commitments (four original vehicles, three mandatory Signature Features with no complexity ceiling, photoreal art direction, verification-driven visual quality, performance targets and expanded systems) govern. Mandatory privacy, security, clean-room, static/offline delivery, five AI opponents, mode integrity, replay integrity and honest testing are never weakened.

**Non-negotiable definition:** A functionally broad but visually crude greybox, a block-shaped car, a flat-textured coastal world, or an exaggerated UI blocking the view is **not** a finished V3.0 submission, however many menu entries or passing unit tests it contains. A feature cannot be declared implemented on the strength of a label, mock, screenshot or tutorial alone.

**Ambition versus honesty:** Target a premium, photoreal, AAA-inspired studio showcase in a modern desktop browser, with independent creative authorship and measurable evidence. This is a demanding creative target, **not a promise that browser hardware or a single agent can equal a commercial AAA production**; if a mandatory system is incomplete, disclose it, never claim it works.


## 00. The assignment and its boundaries

Build and deliver a **complete, original, polished, photoreal, cinematic, fully playable 3D arcade racing game in a modern desktop browser**. The outcome must be an actual game that a person can launch, control, complete, restart, and revisit—not a prototype, a technical showcase, a menu surrounding a small driving test, a cinematic video, or an explanation of how a game could be built.

The product is a colorful, coastal, cinematic arcade racer, with three distinct playable modes on three distinct dedicated courses, four substantially differentiated original cars, competitive local AI, nuanced but approachable vehicle handling, nitro, drift, dynamic weather and time of day, visual collision damage, and **real, navigable, persistable replays**. It includes at least THREE separately conceived, fully implemented, substantial creative Signature Features of your own conception, with no upper implementation-complexity ceiling. All runtime gameplay and data handling are local to the browser.

Read the complete brief before choosing an approach. Treat mandatory behavior as a delivery contract, while preserving freedom over creative expression, engineering techniques, level details, balance constants, and the additional creative feature. Do not substitute an attractive approximation for a required working subsystem.

This is a **game-building assignment**. Do not produce ratings, comparative scores, leaderboards, performance grades, or rankings of AI models. The game's own race placements, lap records, and arcade points are required gameplay data and do not violate that rule.

## 01. Clean-room instruction and filesystem isolation

Execute as if using a brand-new account with no personal or task history. This document is the only task-specific brief. Work exclusively inside the dedicated project directory explicitly supplied by the execution environment, using your own reasoning, permitted public documentation and visual references under Section 02, ordinary local build tools, properly obtained dependencies, and artifacts created for this project. Do not use information from unrelated workspace or account history.

**Strict project-directory boundary:** Do not browse, list, search, read, copy from, or write to files or folders outside the designated project root. This includes the user's Downloads, Desktop, Documents and home folders; adjacent repositories, worktrees and benchmark runs; other drives; private cloud mounts; browser profiles; and system-wide searches. Do not recursively scan the computer or broaden the workspace to find assets, code, credentials, configuration or inspiration. Use standard installed compilers, package managers, browser/test runners, their ordinary package caches, and ephemeral OS temporary directories needed by those tools as executable infrastructure, without exploring unrelated files or user accounts. Such tools may automatically create temporary files, sockets, caches or browser profiles outside the project root; this does not authorize you to browse, inspect, reuse, or deliberately write unrelated content there. The execution platform's mandatory infrastructure may access what it needs outside the workspace; that is not permission for you to inspect it. If the assigned directory is absent or inaccessible, use the platform-designated project root or state the blocker—never go looking through unrelated directories.

Do not retrieve, consult, interpret as requirements, or reuse previous conversations, saved memories, summaries, user profiles, previous tasks, other models' output, earlier Racing-bench or Orbitarium-bench implementations, unrelated repositories, browser history, private files, connected cloud accounts, secrets, tokens, or private integrations. Do not consult account-owned material even if a connected tool offers it automatically. The package manager's own dependency cache is a tooling exception only: it is not a source of project code, examples, user data or previous solutions.

Do not read or adopt project requirements from `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, personal memory, unrelated skill catalogs, other model outputs, saved prompts, agent presets or unrelated repository/assistant instructions—even if they appear inside the assigned project. **Explicit V3 operational exception:** You MAY invoke browser, Playwright, DevTools, build, preview, screenshot, debugging and test tools or skills strictly needed to operate and validate **this project's own work**, and MAY read the minimal relevant tool-operation instructions, including an applicable `SKILL.md` if that is the only way to use the instrument. Such instructions are **operational manuals only**, not additional sources of game design, architecture, outside code, features or benchmark requirements. A separate launch message saying “use no skills” does not override this narrow permission. Do not delegate planning, authoring, coding or review of the game to another AI agent, even through a skill or MCP. Legitimate project-authored files may be read as project data; mandatory platform policies retain normal priority.

**MCP is not intrinsically prohibited.** You may use available MCP or built-in tools for local project editing, terminal commands, testing, browser preview, local rendering, and narrowly permitted retrieval of public official technical documentation or public image/design references. Generative AI services for images, 3D models, audio, music or video count as external AI systems and must not be used, including when exposed through MCP. A tool's availability does not authorize its data sources: do **not** use MCP connectors to read private files, messages, cloud drives, GitHub/repository content, personal memory, accounts, other workspaces, or third-party implementations, and do not use MCP to delegate implementation to another model. The same file-access and research restrictions apply equally to tool calls, browser visits, shell commands, plugins and MCP operations. Never use a connected account, credential, or privileged data source to supplement this benchmark.

These are project isolation restrictions, not a request to evade platform safety, override mandatory execution policies, bypass permissions, or hide actions. Follow non-overridable platform instructions and report an actual environment limitation honestly.

## 02. Permitted technical documentation and visual research; prohibited code research

**Use your own capabilities to design and implement the game.** Narrow public consultation is permitted for only two purposes:

1. **Technical documentation:** Look up the official documentation for a language, browser API, rendering or physics library, build tool, package, or platform capability when you need to confirm syntax, parameters, behavior, browser compatibility, or correct usage. Search may be used to locate an official documentation page. Brief API snippets **embedded in reference documentation** may clarify an API call; official example galleries, standalone demos, complete sample applications, or tutorials are not reference documentation and must not be opened or copied, even when hosted on an official domain. They are not permission to copy a finished subsystem, adapt a sample game, or outsource architectural decisions. Implement all game-specific logic yourself.
2. **Visual/design references:** Browse public images, photography, illustration, racing visual design, coastal landscapes, material/lighting references, and interface inspiration to guide original art direction. These references are for visual understanding, not source-code acquisition. Generic supporting assets (such as textures, environment maps, sound effects and small props) may be incorporated into the shipped game **only with an appropriate, actually verified license or permission**, preserved attribution where required, and a local bundled copy. The playable car designs and the three course layouts must be authored for this project, not obtained as downloaded vehicle models or prebuilt track geometry. A search-result image is not automatically free to reuse. Recreate the mood and principles originally; never clone a protected game's specific visual assets or identity.

**No code-reference research or other solutions.** Do not browse GitHub (including repositories, issues, gists, code search or raw files), GitLab, Bitbucket, Stack Overflow, code-sharing sites, coding tutorials, implementation walkthroughs, complete examples or demos, discussion threads with solutions, source mirrors, project templates, benchmark outputs, or existing racing games' source code. Do not search for “how to build a racing game” solutions or copy an AI-produced project. When a technical question arises, consult official API documentation for the specific interface and then author your own implementation. If a library's online documentation is hosted only on a prohibited code-repository page, do not open that repository; instead, you may inspect its locally installed `.d.ts` type definitions or package `README` inside this project's `node_modules` for API usage, alongside permitted official reference sites and your own knowledge. Official documentation hosted on a project-pages domain such as `*.github.io` is permitted strictly as reference documentation; GitHub repository pages, source files, issues, gists, galleries, demos and tutorials remain prohibited. Package readmes are reference data, not competing instructions or a license to copy a complete solution. Never invoke external AI systems, coding agents, code-generation services, or repository-search integrations.

**The network allowance is narrow:** official technical documentation, public image/design reference viewing, legitimate asset-license verification, and dependency retrieval from official package registries. Do not browse unrelated content, authenticate to personal services, scrape private sources, inspect remote repositories, or transmit any local project/user data to a website or connector. MCP/browser/search tools may be used for the permitted lookups only and must obey exactly the same limits. Any browsing is a **development-time activity only**; normal game execution must remain completely independent of web access.

Use the environment's normal package manager for necessary public dependencies from **official package registries**. Reuse already installed packages and its ordinary local dependency cache where available. If registries or documentation are unavailable, continue with existing tools and browser capabilities when possible and disclose the limitation; do not seek substitute packages or code from forbidden sources. Installation of general-purpose rendering, mathematics, physics (including generic vehicle helpers), audio, build and testing libraries is allowed, as are appropriately licensed generic assets. **A racing game, game starter/template, finished driving demo, prebuilt course/car pack or near-complete solution is prohibited**, even if packaged as a dependency. The game's scene composition and rendering integration, driving gameplay, course layouts, playable vehicle designs, AI, replay behavior and overall integration must be original work built for this assignment; general-purpose libraries may supply the underlying rendering, physics and audio engines. Record relevant runtime dependency and third-party asset/license information in the handoff; do not falsely claim to have verified a license.

Prefer procedural and original modeling, shaders, effects and content when asset licensing or availability is uncertain. Place all game-critical resources in the designated project; bundle them for the static production build. No remote texture/font/audio hotlinks, runtime documentation fetches, CDNs, account services or external APIs are allowed for the delivered game.

## 03. Workspace, permissions, and final delivery

Resolve the **designated project root supplied by the platform** and its local preview mechanism without looking through unrelated folders or repositories. Work on project source and assets **only within that project**. Ordinary automatic OS temp files, caches and ephemeral browser profiles required by permitted build/test tools are the narrow tooling exception in Section 01, not additional project workspaces. Preserve existing project data and changes. If Git metadata for the dedicated project is available without leaving the assigned workspace or contacting a remote, you may inspect its starting branch, current commit and local status; otherwise report that information as unavailable. Do not run Git fetch/clone/pull, open a GitHub page, inspect remote branches or follow filesystem pointers to a neighboring repository or external worktree. Choose an implementation strategy compatible with the environment and deliver the playable game in the designated location.

Using a **local development/build/preview server** such as Vite is permitted. It is tooling for construction and static preview, not a gameplay backend. **Static delivery means compiled assets served through an ordinary static HTTP(S) host**, including a local preview at `localhost`; opening the built `index.html` through `file://` is not a guaranteed or required launch method because browser module, origin and storage restrictions may block it. Provide usable `dev`, `build`, `preview` and `test` commands for the chosen project tooling, with a lockfile when a package manager is used, and a short README with exact launch and static-preview instructions. The built output must work on a generic static host rather than depend on Vite's development process. All gameplay logic remains in the browser. Do not require credentials, a database, an application API server, external services or manual project assembly.

This brief does **not** authorize local Git commits, pushing, opening pull requests, merging, uploading, deploying, publishing, or emailing the result. Use non-committing local build/test checkpoints; obtain separate authorization before recording commits or changing remote state. Do not change other repositories or maintain the user's broader environment. If the execution platform provides an existing user-facing preview, deliver the complete product into that preview. Operational skills and tools for THIS project's local browser inspection, Playwright/DevTools automation, preview, screenshots, build, testing and debugging are expressly permitted throughout implementation; read only the minimal operating instructions where necessary, never turn them into additional design requirements or external project source. Platform delivery/preview tools remain permitted for presenting the result. Skill catalogs, unrelated skills and external AI agents remain prohibited. Some preview iframes restrict origin, module loading, or browser storage: keep the game playable there where possible with honest degradation and test persistence separately on the built app served from a proper static HTTP(S) origin. State which environment each observation comes from. Otherwise make the local runnable result and launch instructions clear; do not invent a live URL or claim a preview exists when it does not.

## 04. Scope, priorities, and artistic latitude

The three modes and three distinct courses, driving systems, **four** original playable cars, five race opponents, evolving weather/daylight, advanced graphics and lighting, photoreal world and vehicles, surface physics, vehicle damage, replay, local replay library and file exchange, settings, photo mode, and **at least three original fully integrated Signature Features of unrestricted ambition** are **mandatory**. They form one complete game, not a menu of alternatives. The development sequence may prioritize the playable vertical slice, but it does not authorize stopping early or removing later systems.

Preserve approximately **15–20% creative freedom** as an *artistic direction heuristic*, not an exact division of code, implementation time, screen area, or required features. Select original vehicle concepts, environment details, course geometry, UI composition, animation, effects, timing, balance, architecture, and techniques. Be ambitious and distinctive, not literal or template-like. The three mandatory Signature Features are **separate requirements** and does not consume or replace this creative freedom.

Descriptions of techniques, possible assets, environmental details, or game balance in this brief describe intended outcomes; they are not hidden demands for a specific engine, number of polygons, exact road lengths, exact driving coefficients, fixed nitro duration, prescribed AI algorithm, or predefined scoring formula. Where this brief leaves a design choice open, make a coherent, testable choice independently rather than asking for trivial creative approval.

## 05. Game identity and first impression

The visual identity is **photoreal cinematic coastal arcade**: evocative ocean views, curving coastal highways, dramatic cliffs, hills, a picturesque tourist settlement, attractive bridges, an expressive tunnel, bright color, changing skies and lighting, and a compelling sense of travel. The world should feel inviting, designed, and alive. Create memorable composition and silhouettes both while driving at speed and while stationary in the garage or menus.

The result should evoke the energy and finish of a modern arcade racer without copying any particular game's assets, characters, branded vehicle designs, HUD, typography, logo, soundtrack, or code. Do not drift into a drab gray driving simulator or an unrelated neon science-fiction city. The emphasis is a plausible, photographed-looking coastal holiday atmosphere, with cinematic presentation, physically credible materials and illumination, not plastic-flat stylization or a blockout. Photorealism is the target, subject to honest rendering support and performance choices.

The opening view must immediately communicate “playable racing game” through a substantial live 3D setting, an appealing car, thoughtful lighting, readable primary actions, and a coherent visual language. Do not conceal a barren track with enormous panels or rely on a title-screen illustration to create all the perceived quality. The game should continue to look intentionally composed when the UI is hidden and the camera is following a car.

Use real 3D drivable geometry and three-dimensional vehicle/world presentation. A flat billboard racer, a 2D impostor with a mock steering overlay, or a mostly empty grid with primitive boxes is not the requested experience. Original procedural geometry, authored art and licensed supporting textures are welcome only when the result presents convincing, materially rich forms; primitive-only or intentionally placeholder-looking final objects fail the visual quality floor.

## 06. World-building and road presentation

Build one geographically coherent coastal region with **three complete, meaningfully different, drivable primary course layouts**. The courses may share a visual vocabulary, terrain, reusable assets, or glimpses of landmarks, but they must not merely re-skin or reverse the same route. Their differences must be noticeable to someone actually driving them: changing road shapes, pace, spatial rhythms, visibility, hazards, and route landmarks.

Roads need believable continuity, appropriate width for their gameplay, clear edges, legible approaches to corners, predictable collisions and off-road behavior, usable elevation changes, and route guidance. The racing line must be understandable at speed under clear skies, rain, sunset, and night. Decorative scenery must not inexplicably block driving or hide required checkpoints. Tunnels, bridges, slopes, and village streets should be integrated into the geography rather than floating disconnected from it.

The surrounding world must have enough visual substance to support the camera, not just a road with a skybox. Material variety, scale cues, vegetation or architectural rhythm, roadside structures, coastline transitions, distance composition, and selected animated details may be achieved through any appropriate creative method. Prefer an authored sense of place over raw object quantity.

### Dedicated courses

**Coastal Sprint — Time Trial:** an expressive, faster coastal course emphasizing readable flowing curves, speed, braking decisions, ocean/cliff scenery, and a clear lap loop.

**Riviera Grand Prix — Race vs AI:** a course combining tourist-town sections and coastal driving with varied cornering and genuine passing opportunities, including meaningful landmarks such as a tunnel and/or bridge. Its geometry must accommodate six simultaneous cars without routine deadlocks.

**Horizon Rush — Checkpoint Run:** a distinct coastal/hills course emphasizing momentum, time pressure, route reading, scenic variation, checkpoint anticipation, and opportunities for arcade driving technique.

One dedicated primary course per mode is sufficient. Do not treat every mode-by-course permutation as an additional requirement. Extra courses or free driving are optional only if the complete contracted game remains intact.

## 07. Shared race flow and session completion

Provide an intuitive continuous journey:

**Main menu → garage / settings → pre-race setup → transition or loading → countdown → active race → pause or finish/failure → results → replay / restart / return.**

Menus must allow selecting each mode independently, choosing one of the playable cars, seeing the assigned course, configuring the initial weather and time of day, and selecting AI difficulty where it applies. The initial choices must actually affect the resulting race. Avoid navigation that requires browser refreshes, fragile hard-coded state resets, or dead-end dialogs.

All three modes must have a genuine start, visible progression, a well-defined finish or failure condition, correct results, and a way to replay or start again. Restart must yield a valid fresh run: no leftover drift/nitro input, prior damage, AI state, weather accumulator, timers, or stale replay recording. Returning to menus must clean up owned runtime work without corrupting local preferences or saved replays.

A countdown is not merely decorative. Player and AI motion, countdown display, race clock, and lap validity must agree on when the race begins. Finishing must produce a stable terminal state even if the player continues holding an input or presses pause at nearly the same moment. Only a legitimate completion should be displayed as a completed run.

## 08. Mode: Time Trial — Coastal Sprint

A Time Trial session consists of **exactly three consecutive laps** on Coastal Sprint. Measure lap times using the race simulation's authoritative progression, not text animation or a loosely coupled UI timer. Clearly display current lap, current lap time, previous valid laps, and the best valid lap when known.

**The best valid single lap of the three is the session result.** The result screen must show the three lap outcomes and indicate invalid laps without misrepresenting them as records. One invalid lap must not automatically invalidate other legitimate laps. If **all three laps are invalid**, the session still ends normally with three invalid lap outcomes, **no valid best lap and no new personal record**, and its completed-session replay is available with this status. Save personal-best lap records locally when storage is available; ordinary player records must come **only from legitimate, locally played, validated laps**, not partial sectors, wall-clock anomalies, replay playback, imported file metadata or test-harness fixtures. A development harness may exercise the real record-creation pathway only within an isolated disposable test namespace, never the player's record store. Preserve the car, course, starting weather/daylight conditions, and relevant run-condition context with each record so that visibly different conditions are not presented as strictly identical. Conditions remain dynamic during the three-lap session; do not freeze weather just to simplify records. The game may choose how records are grouped and presented; keep their provenance unambiguous.

Crossing start/finish only counts as completing a lap after the route's checkpoints have been passed in their correct sequence and the car has made legitimate forward progress. Shortcuts, reverse crossings, off-road respawn, and repeated finish-line contact must not generate false times. If the player makes a recoverable mistake, the session should remain understandable and allow subsequent valid laps without silently granting progression.

Time Trial is a complete playable mode, not a lap-time HUD attached to a free-driving sandbox. A normal finish transitions to a useful results screen and makes the completed drive available for replay.

## 09. Mode: Race vs AI — Riviera Grand Prix

Conduct **three-lap races against five concurrent AI-controlled cars**, six cars on the course including the player. All five opponents must be present, visible in appropriate circumstances, physically and competitively participating, and represented accurately in live classification and the recorded replay.

The intended normal-player race duration is **approximately 2–4 minutes**. Design and tune course scale, speed, and race flow toward that experience, but do **not** end, fast-forward, falsify, or declare failure solely because a slower player exceeds the target. The duration is a pacing goal for this mode, not a universal timer for Time Trial or Checkpoint Run.

Offer **three fixed difficulty settings: Easy, Normal, Hard**. Each must cause recognizable differences in racing competence or decisions (for example, anticipation, precision, risk, or resource use). The selected difficulty remains fixed throughout the race. **Do not implement rubber-banding or catch-up speed/skill boosts based on the player’s race position, distance gap, or performance.** Rivals may react naturally to changing road conditions, other cars, and overtaking opportunities; these ordinary racing decisions are not difficulty adaptation. Avoid differences that consist exclusively of changing top speed or teleporting rivals to change results. Opponents should have plausible opportunities to win, be overtaken, and make mistakes.

Positions must be derived from valid race progress along the course and completed laps. The player's apparent camera position, distance to finish in a straight line, or a scripted placement list is not adequate. Passing should change classification sensibly; results must distinguish actual finish order and times from **unfinished rivals' last valid progress** or clearly labeled projected placements. Never fabricate a finishing time for a car that did not finish. Define a consistent race-resolution rule and display it truthfully. The player may retire or abandon a race; a retired attempt is unfinished, cannot award a completed result or personal best, and may be replayed only as an honestly labeled partial run. The starting grid must be visible and restart with a consistent order for unchanged setup. Do not pretend unfinished rivals completed laps that were never recorded.

## 10. Mode: Checkpoint Run — Horizon Rush

Create a complete time-pressure arcade mode with a running countdown, ordered checkpoints that **grant additional time**, visible progress, driving-related combos and in-game score, and a legitimate route endpoint. Design a **substantial, complete checkpoint sequence**, not a trivial one-gate or brief single-loop demonstration. It may be an extended point-to-point route or a multi-lap ordered-gate sequence on the dedicated course; make progress toward the final gate easy to understand (for example, `Checkpoint X / N`). Completing the full sequence before time expires succeeds; running out of time fails, with coherent results and restart options. Exact course length, checkpoint count, and reward cadence remain creative decisions.

Combos and scoring should reward meaningful driving actions, potentially including drift, speed, clean lines, risk, or nitro control. **You decide the exact bonus economy and interactions.** Do not treat an illustrative combo example as a binding formula, and do not impose an arbitrary fixed number of seconds, points, or multipliers solely to satisfy the prompt. The game must nevertheless avoid trivial infinite-time, infinitely farmable points, or checkpoint-trigger exploits that make progression meaningless.

Checkpoint guidance must be legible while moving. Repeatedly crossing one trigger, skipping a mandatory section, respawning near a future marker, or reversing through checkpoints must not generate unlimited rewards. When a combo is lost or a run ends, provide comprehensible feedback rather than silently changing the score or timer.

## 11. Authoritative simulation state and timing

Use **one coherent source of truth for active-race simulation time and race progression**, with deliberate ownership of player inputs, cars, checkpoints, AI, weather, damage, nitro, and session status. Rendering cadence and UI update frequency must not independently control physical distance, lap time, or AI advancement. A fixed-step simulation with interpolated rendering is one valid method; other stable, frame-rate-independent approaches are allowed.

Driving at different rendering frame rates must not fundamentally change handling, timer speed, checkpoints, or recorded outcome. Constrain pathological frame deltas. Make start, pause, resume, focus loss, backgrounding, finish, restart, and replay transitions explicit enough to avoid multiple active race loops or accumulated real-time jumps.

When the game is paused or the tab becomes hidden, **freeze active-race simulation, AI, race timers, nitro consumption, environmental progression, and recording consistently**. On resumption, discard stale held inputs where appropriate and restore a usable state without a burst of unintended acceleration, a huge physics step, or several minutes of phantom elapsed race time.

The results screen and replay viewer must not continue an invisible competitive race behind the UI. Replay uses recorded states and time, not a second race simulation accidentally sharing control with the active one. Avoid contradictory copies of the same race result in UI components, save data, and recorder metadata.

## 12. Lap, checkpoint, and position integrity

Track meaningful progress along each designated route, with an ordered checkpoint scheme, forward progression, lap count, and start/finish validation. Technical implementation may use sectors, waypoints, splines, projections, or another representation, but it must handle normal racing and predictable errors.

At minimum, consider these cases: crossing the finish in the wrong direction; oscillating across a line; missing a gate then rejoining later; cutting across a loop; leaving the road; using recovery; two opponents passing close together; and a car reversing into an earlier sector. None may create a free lap, time bonus, impossible classification, or record from an invalid traversal.

Define what counts as legitimate recovery versus a reset that invalidates the current lap or requires rejoining an earlier valid location. Make that choice clear in gameplay. A player should not be punished by an incomprehensible invisible rule, but neither should a recovery button become an optimal shortcut.

Records and result metrics must use validated state. If a run is abandoned, failed, paused, or only partially completed, do not report an invented finished time or award progress that was never reached.

## 13. The garage and four differentiated cars

Supply a working garage with **at least four original, recognizably different selectable car designs**. Each should feel deliberately shaped and finished enough to belong in the game world. The selected car must carry through consistently into the race, camera, HUD where relevant, result, and replay.

Cars must differ materially in driving: acceleration, top speed, cornering, responsiveness, traction, braking behavior, or drift tendencies. Tradeoffs should keep all three viable and engaging; an agile car, a balanced car, and a speed-oriented car are examples of design directions, not forced model names or exact stat curves. Avoid offering four recolors with identical handling.

A physically lit, detailed car preview should clearly communicate selection and differentiating character without needing an external car configurator. The car body, wheels, suspension cues, lights, motion and collision response should read as an animated vehicle rather than a static cube moving through the environment. Photoreal, cohesive authored vehicle modeling is required; low-detail primitives do not count as final vehicle art.

## 14. Balanced arcade driving contract

Handling must be **approachable but expressive**. Keyboard steering and acceleration should respond promptly, while velocity, momentum, road curvature, braking, grip and sideways motion matter. Players should feel a difference between taking a curve at an appropriate speed and attempting the same turn at excessive speed. Recovering from a minor mistake should be possible without sim-racing expertise.

Maintain internally coherent controls for throttle, braking/reverse, steering, and vehicle heading. Speed and direction should not jump discontinuously without a meaningful event such as collision or deliberate recovery. Avoid purely visual turning in which wheels/vehicle orientation change but motion ignores the road, or a steering system that enables physically nonsensical instant direction reversal at high speed.

Surface and weather effects must alter handling in a controllable way. Curves, inclines, off-road shoulders, braking and impacts should contribute to an intelligible driving experience without forcing realistic tire modeling, a complicated powertrain, or a particular physics engine. The important requirement is a stable and enjoyable relationship among player input, vehicle state, scene geometry and feedback.

The chase camera must frame the road ahead, convey speed, and adapt gently to vehicle motion. Avoid excessive oscillation, snapping through geometry, or a camera that hides approaching bends. Additional live driving camera options are optional; the separate three-camera replay system is mandatory.

## 15. Nitro and drift as actual game mechanics

**Nitro** must be activated intentionally, consume a genuinely finite or otherwise bounded resource, and materially increase acceleration or provide a comparable temporary performance advantage. A truthful on-screen indicator shows available resource and active state. Engine sound, speed cues, camera treatment, and visual effects should make activation unmistakable. Recharge and balancing are creative design choices, provided nitro cannot remain permanently free or unlimited during ordinary play.

**Drift** must be a controllable arcade maneuver with intentional entry, an observable controlled slide and a recoverable exit. It should have meaningful effects on vehicle movement, not merely spawn tire smoke while ordinary steering continues unchanged. The exact initiation control, thresholds, steering assistance, traction model and benefits are open to design.

The two mechanics should feel integrated with racing and the three modes. A skillful drift may affect combo scoring, resource recovery, or exit speed depending on your design. Do not force a specific combo economy. Rain and different cars may alter how these mechanics feel, but neither may become unusably arbitrary or disconnected from its visible state.

Interrupting nitro or drift through pause, collision, recovery, restart, race finish, or a focus change must leave controls and resources consistent. Animation and sound must not remain permanently active after the underlying mechanic ends.

## 16. Collision response, off-track behavior, and recovery

Player and AI cars need contact handling that changes motion or progress sensibly. Vehicle collisions, roadside barriers, and major world geometry must not be invisible, visually penetrable by default, or capable of leaving cars permanently trapped during ordinary play. Do not make impacts completely irrelevant simply to protect perfect lap times.

Collision response should preserve the balanced arcade feel: readable slowdown, deflection, impact feedback and visible damage, with enough forgiveness to keep the game fun. Use coherent rules for player and AI; opponents must not become invulnerable ghosts whose movement ignores other cars unless a narrowly justified, visibly transparent recovery mechanism is used.

Provide an off-track or stuck recovery action or automatic recovery path that restores a sensible heading and nearby legitimate location. Recovery must not silently advance checkpoints, award time, teleport directly into an advantageous position, or destroy otherwise valid progress. Both human and AI cars should eventually return to a raceable state after plausible incidents. On recovery, clear residual linear and angular motion and any active nitro/drift state; rejoin with a sensible, non-advantageous restart rather than carrying pre-recovery momentum into a new heading. Avoid spawning a rigid body inside another car or obstacle: choose a clear re-entry location or use a short, clearly indicated non-collision rejoin phase without permitting progress exploits.

### Damage-state relationship

Immediate collision physics and accumulated visual damage are related but different concepts. A single impact may reduce speed and add visible damage; previously recorded damage should not vanish just because the car accelerates again. Damage may be predominantly visual and must not permanently render an arcade race undrivable.

## 17. Five competent simultaneous AI opponents

The Race mode must run **five concurrently active racing opponents**, each with actual progressing vehicle state and correct positions. Give each rival a stable recognizable identity, including a name and distinguishable livery or marker, used consistently in live standings, results and replay. The opponents should be visibly governed by the same track boundaries, surface conditions and broad performance envelope as the player. They must navigate corners and straights, manage braking/acceleration, respond to other cars, attempt plausible passes, defend position when useful, and recover from obstructions or missed turns.

Choose an AI implementation compatible with the browser's performance budget; waypoints, racing lines, local steering controllers and state machines are entirely legitimate. No remote inference, machine-learning service, or opaque cloud AI is expected. An authored strategy is acceptable, but simply animating five cars around a loop without collision response or race context is not.

Opponents must not stack at spawn indefinitely, freeze when overtaken, become stranded after a small collision, or finish impossible laps through teleports. Recovery may be assisted to keep races moving, provided it is not disguised as normal overtaking, does not generate fake checkpoints, and preserves credible classification.

Difficulty differences should be perceptible across valid races. No need to hard-code a universal lap-time advantage or an identical winner every time. The opponent system should remain consistent when the player changes car, initial weather, or race restart.

## 18. Dynamic weather and changing daylight

Support distinguishable **sunny, cloudy, and rainy** weather and **morning, daytime, sunset, and nighttime** lighting states. Before racing, the player can select the initial weather and time of day. Those choices must meaningfully affect the starting scene, not merely the menu text.

**Both weather and time of day progress during live gameplay.** Transitions should be smooth enough to read as evolving environmental conditions and perceptible within relatively short runs. Do not require every condition to occur in every single race or force an implausibly rapid full day/night cycle. The system can use artistic time compression, controlled transitions or designed environmental patterns, as long as the sky, illumination, scene materials and driving conditions evolve coherently.

As rain begins, grows or recedes, road wetness, reflections, spray, visibility cues, road lighting and **traction/braking behavior** must change meaningfully and progressively. Surface conditions affect the player and the AI under consistent rules. Driving on a wet section must feel different from an equivalent dry section; a color filter and particles alone do not satisfy dynamic weather.

Nighttime driving must remain playable: road edges, upcoming curves, checkpoints, rivals and obstacles are legible using plausible vehicle or environmental lighting and well-designed visual contrast. Weather and daylight updates must not change the race clock, invalidate saved laps, or reset the player's position.

## 19. Progressive visible collision damage

Represent **accumulating visual vehicle damage caused by actual collisions**, with distinguishable degrees of severity and a clear relationship to significant impacts. Appropriate solutions include localized scratches, material changes, stylized dents, body-panel displacement, damaged-light effects, smoke, sparks or other artistic choices. No exact mesh-deformation technique or mandatory damage-effect list is imposed.

Damage must not appear randomly unrelated to contact, vanish immediately after an impact, or reset between checkpoints of the same race. It should remain visible through the active run and clear on a genuine new run. Cars should remain playable even after severe cosmetic damage. Damage and collision effects should support the same artistic style in rain, daylight and night.

A replay must recover the correct accumulated damage for the replayed instant. Seeking backward to before an impact must remove its subsequent damage; seeking forward after that event must reproduce it. Do not simply retain the final damaged car model for the entirety of the replay.

## 20. Presentation, camera movement, and the sensation of speed

Use a polished third-person chase view for active racing. Frame the drivable route ahead, retain spatial context near tight corners, and smooth intentional camera movements without obscuring controls. Scale sense and speed should come from road motion, background parallax, car movement, sound, controlled field of view, particle feedback, wheel animation, lighting and other deliberate details rather than constant exaggerated camera shake.

Create coherent vehicle presentation: body posture, wheels, acceleration/braking response, contact cues and visual speed feedback should agree with motion. Build distinct visual moods for coastal sunlight, town driving, tunnel travel and rain/night conditions without losing the game's recognizable palette.

Menus, garage and result screens deserve the same intentional composition as gameplay. Avoid using temporary debug overlays as final interface, unstyled browser defaults everywhere, unreadable tiny text, massive bloom that conceals corners, or unrelated effect stacks solely to look complex.

Respect a reduced-motion preference where possible: limit decorative camera travel, large shakes and intrusive transitions while keeping essential driving feedback and full functionality. Avoid mandatory flashing effects for critical events.

## 21. Sound, feedback, and UI animation

Provide credible, cohesive local sound feedback for essential racing events through original, procedural or properly licensed bundled resources. Engine behavior, acceleration/nitro, tire movement, impacts, countdown, checkpoints and finish may be expressed using an appropriate cohesive sound design. A soundtrack is optional; meaningful feedback is not. The game must remain usable with sound muted or unavailable.

Respect browser autoplay and user-gesture restrictions. Audio must not generate errors that prevent a race from starting; use a discoverable activation or graceful muted state where necessary. Prevent layered engine sounds, multiple countdown instances, and leaked audio graphs after restarting, leaving a race, opening replay or switching tabs.

HUD and interface animation should clarify state transitions rather than replace working state. Use readable counters, position changes, progress feedback, nitro availability and clear results. Avoid a meter that updates cosmetically while the underlying state remains unchanged.

## 22. True gameplay-state replay: recording requirements

A required replay is a **recording of the actual race in every game mode**, not a canned camera flythrough, an unrelated deterministic demo, prerecorded video, or a collection of snapshots of the UI. Valid finished Time Trials, completed AI races and successful Checkpoint Runs must all yield full replays; a timed-out Checkpoint Run must also yield a replay labeled as a genuine failed run. A player-retired or otherwise abandoned run may produce only an explicitly partial replay. Record sufficient information to reconstruct meaningful race motion and state: the player's vehicle, the active AI opponents, timing and progression, nitro/drift state as represented, relevant collisions and damage, weather/wetness and daylight, and important course events.

The implementation is free to use state snapshots, event logs, keyframes, deterministic simulation with correction, or a suitable hybrid. It need not guarantee bit-for-bit identity of transient particle pixels or audio samples. It **must** faithfully show what happened: correct cars, order of events, positions, course progression, visible conditions, and damage at the selected replay instant.

The recording begins and ends at well-defined points in the race lifecycle. It must not capture menu time as racing time, continue writing indefinitely after finish, or merge two attempts into one replay after restart. A partial recording may be retained only if it is honestly identified and playable as partial; never mislabel an abandoned or corrupt attempt as a completed race.

Do not call a replay complete solely because its file can be parsed. The recorded scene must correspond to a real played run and make sense across all the important events.

## 23. Replay viewer: temporal consistency and cinematic control

Provide a distinct replay viewer with **at least three meaningfully different, usable camera perspectives**, cinematic yet readable framing, play/pause, a visible timeline, seeking forward and backward, and rewinding to an earlier moment. The viewer must work for a just-completed run and for a valid imported/saved replay.

Seeking may reconstruct state from snapshots or re-evaluate logged events, but the viewer must settle on the **same recorded historical state at a given time regardless of the direction of seeking**. Jumping to a pre-collision moment should restore undamaged presentation; jumping forward to the collision should restore the correct damage. Weather, daylight, nitro and AI positions should correspond to that replay instant, rather than adopting current live menu settings. Treat discontinuities such as respawn/teleport and rotation-angle wrap-around explicitly: interpolation must not fly a car through scenery or turn a small heading change into a full 360-degree spin. Replay HUD values, including elapsed time, lap/checkpoint state and standings, must reflect **the selected historical timestamp**, not the final race state.

Pause, play, scrub, jump to start/end, switch camera, leave and reopen replay without creating duplicate playback loops, changing recorded data, corrupting the active game's state, or causing time to advance while paused. Display useful playback status, duration, and mode/car metadata. Stop at the end rather than drifting into unrecorded motion. Scrubbing, pausing, seeking across collisions, or leaving the viewer must silence/reset transient engine or impact audio and particle emitters as appropriate; historical bursts must not repeatedly accumulate or continue sounding while time is paused.

Replay camera choice may be a viewing preference; it must not modify the recorded physical history. If a short race uses weather changes or AI passes, watching and seeking through those events should remain visually coherent.

## 24. Replay library: five entries, local only

Provide a browseable local library containing **no more than five saved replay entries**. Show meaningful labels or metadata, such as mode, car, date, duration and completion status where known; distinguish **locally played** recordings from **imported** ones by stamping every file-ingested entry as **imported**, regardless of origin flags inside the file. An imported file's claimed time, origin or completion status is untrusted metadata, not a verified local race result. Allow opening, deleting, exporting and importing recordings without an account or remote service. **The just-ended run remains available as a transient replay until the player explicitly chooses to save it**; viewing it does not consume a library slot. If leaving that replay or results view would discard the only copy, offer a clear save/export/discard decision or warning. When saved successfully, it can be revisited after a normal refresh when persistent browser storage is available.

A full library must not silently evict the oldest or newest replay. When the player attempts to save or import a sixth, explain the capacity and obtain a user choice to delete or replace an existing entry, or cancel. Do not destroy a previous valid replay until the new recording has been validated and the replacement can be completed safely. Show truthful outcomes for save, delete and import operations.

**Export and import as portable local files are mandatory.** Exported files must contain what is needed for meaningful playback under the intended game version and asset assumptions, rather than only a local storage key or a link to a private browser origin. Export must be user-initiated and work without external upload. Imported compatible recordings must appear in the same replay library or an explicitly temporary viewing flow when persistence is unavailable.

## 25. File format, storage integrity, and graceful degradation

Choose a documented versioned replay representation suitable for local file exchange. Validate incoming schema version, expected structure, numeric bounds, timestamps, sample counts, event types, identifiers, size limits and unreasonable duration/coordinate data before admitting an import. Treat all imported data as untrusted; do not evaluate it as code, load executable payloads, construct arbitrary resource URLs from it, or permit it to alter global settings without an explicit choice. If files are compressed or encoded, apply limits to **both raw input and expanded/parsed content**, including sample/event counts and bounded processing; stop before decompression or parsing can exhaust memory or freeze the tab.

Keep file size, memory cost and playback performance reasonable for short races. The engineering method is open: compression, sparse event records, interpolation and bounded sampling are permitted when they preserve required fidelity. Validate round-trip behavior: an exported replay should be importable into a compatible clean browser session and show the same recorded driving and events.

**No database technology of any kind is permitted for game data**, including IndexedDB, SQLite, cloud databases, database servers, or a disguised database accessed through another API. **Cache Storage and service-worker caches are not permitted for replay or record persistence.** Use small browser-local preference/metadata storage such as `localStorage` when appropriate. For larger replay recordings use ordinary browser file storage such as **OPFS when supported**, or another non-database file-oriented method compatible with these restrictions. OPFS availability, secure-context requirements, persistence policy and quota are browser-dependent; detect capabilities rather than assuming them.

Maintain consistency if multiple tabs or windows of the same origin try to modify replay storage concurrently. Serialize, detect conflicts or refuse one write with a useful message; never exceed the five-entry limit or silently overwrite a newer edit. Recover from interrupted writes and reconcile stale metadata or orphaned recording files on subsequent access without silently deleting valid user recordings. If a valid orphaned recording is found while the library already has five entries, do not silently admit a sixth or discard it: offer an explicit recovery/export, replacement or deletion choice while preserving the capacity invariant. A browser-specific locking mechanism is optional; the observable consistency is mandatory. Render all imported names and labels as bounded plain text, not executable markup; exported replay files must not contain device identifiers, private paths or browser-specific tokens. Imported or replayed recordings may be viewed and re-exported, but **must never create, update or overwrite legitimate personal-best records**, regardless of claimed metadata.

If persistent replay storage is unavailable, denied, or exhausted, **the race must remain playable**. Provide an honest transient replay and/or direct file-export path when possible, explain that the recording is not durably saved, and avoid success labels for failed writes. Browser site-data clearing can erase local records; do not claim otherwise. Validate saved metadata on reload and handle stale entries, incomplete writes or malformed local content without blanking the whole game.

## 26. Menu, garage, settings, and race HUD

Create a cohesive information architecture rather than a pile of modal dialogs. Important paths—play, choose mode and car, configure conditions, start, pause, restart, finish, replay, manage recordings, and return—should be easy to discover. State changes should be visible immediately and reflected in the actual next race.

The in-race HUD must communicate **speed, nitro, route/lap progress, and the mode's defining information**: lap times and best valid lap for Time Trial; running position, laps and competitors for Race; countdown, checkpoint status and arcade score/combos for Checkpoint Run. Place information so the player can still read the upcoming roadway. Display countdown, invalid-lap status, collision or recovery feedback, and finish/failure clearly.

Use a shared design language across menus, garage, HUD, settings, dialogs, results and replay. Build reliable focus, hover/active/disabled, loading, selected and error states. Do not show actionable-looking controls that do nothing. Choose a coherent interface language and use it consistently across core menus, controls, race HUD, results, errors and replay; localization into multiple languages is optional. Settings must cover at minimum **Low/Medium/High graphics quality, configurable keyboard bindings, master volume and mute, and reduced motion**. Include a practical fullscreen option, render resolution/scale and frame-rate cap when supported by the target browser; unavailable controls must disclose the limitation rather than pretend to apply. A setting that cannot safely change during a race may apply at the next race if that delay is clearly indicated. Settings should reflect actual runtime state and persisted values; applying quality or bindings must not surprise the player by resetting an unrelated race.

## 27. Keyboard control, rebinding, and focus ownership

**Keyboard driving is required.** At minimum the player can accelerate, brake/reverse, steer left/right, initiate drift, use nitro, pause, and request recovery. Provide sensible discoverable defaults. The principal driving actions must be **fully remappable** through the application, with conflict detection, understandable resolution or rejection, reset-to-defaults, and browser-local persistence when available.

Remapping must affect the actual gameplay input handler, not only labels. Store primary bindings by physical key identity (`KeyboardEvent.code`) so non-US layouts such as ABNT2 and AZERTY are usable; display localized key labels where the browser exposes the active layout, with an understandable fallback. Avoid default controls that require four or more simultaneous pressed keys for ordinary driving. Account for keys held before pause, loss of window focus, switching into an editable text field, remapping a key while it is pressed, and simultaneous movement commands. Inputs intended for menu navigation or typing must not accidentally accelerate the hidden vehicle. During active driving, take ownership of gameplay keys: prevent browser scrolling from relevant keys and prevent `Space`/`Enter` or another bound driving key from activating a still-focused HUD button. When transitioning from a menu, move focus to the game surface or otherwise prevent this conflict without breaking intentional menu/typing accessibility. Clear all held input immediately on blur, hidden tab, pause and modal open; give replay controls equivalent focus/scroll ownership while scrubbing. A browser-reserved shortcut that cannot safely be captured should be handled honestly rather than appearing to work.

Menus, settings and replay controls should be keyboard-operable with visible focus and appropriate accessible names. Gamepad support is **optional** and must not be treated as a substitute for working keyboard input. If implemented, it should coexist with the binding and pause model without stuck actions.

## 28. Readability, accessibility, and motion comfort

Support clear contrast and legibility for racing-critical HUD data and menus at realistic desktop sizes, resized windows, and browser zoom. Maintain road/checkpoint visibility under wet reflections, sunset glare, darkness and effects. Do not require distinguishing colors alone to understand a checkpoint, collision warning, selected setting or active action.

Provide keyboard-operable non-driving UI, useful focus behavior, readable errors and practical instructions for first-time players. Respect a reduced-motion preference when the platform provides it or offer an equivalent setting that reduces nonessential camera shake, large UI travel and flashing. Essential gameplay must remain fully possible without audio.

Desktop is the primary supported platform. Responsive layouts and smaller screens should fail gracefully without broken panels, but this brief does **not** add mandatory touch driving or gamepad support. Do not falsely advertise mobile playability without having implemented and checked a suitable control path.

## 29. Graphics quality settings and fallback paths

Provide **Low, Medium and High** quality presets with actual render-cost differences, not three menu labels pointing to identical graphics. Reasonable adjustable work includes shadows, reflection effects, vegetation density, lighting features, particle count, post-processing, visible-distance detail and internal render resolution. Preserve the essential track, cars, road edges, weather gameplay, HUD and finish logic in every preset.

Preset changes should preserve current race progress, game rules, replay integrity and input bindings. If a graphics capability is unavailable, disable or replace only the affected presentation feature where feasible, and explain the limitation instead of silently claiming an effect is active. Weather-related visuals should scale down intelligently while grip and braking effects remain correct.

**WebGL 2 is the practical baseline** for 3D compatibility. A WebGPU path is optional only if it includes an actual usable fallback. Do not demand GPU features or extensions unavailable in ordinary supported browser configurations without a recovery route. If required 3D capabilities are absent entirely, show a truthful explanatory error and relevant options rather than a fake fully playable experience.

## 30. Performance and resource ownership

Target **1920×1080 at 60 FPS** on a suitable named desktop GPU/CPU at a declared preset, with meaningful Low/Medium/High scaling, responsive driving and consistent frame pacing. **60 FPS is a target, not a performance result**: do not claim it without a measured browser/renderer/hardware scenario, settings, duration and methodology. Consistent simulation timing matters more than decorative maximum effects or a momentary unloaded-scene FPS number.

Separate high-frequency simulation updates from expensive UI rerenders where practical. Use reasonable detail scaling, culling, reuse of geometry/materials, bounded particles, and appropriate resource management for the chosen renderer. A technically simpler scene with convincing composition and stable performance is preferable to a dense scene that becomes unplayable whenever six cars and rain appear.

Manage the lifecycle of animation loops, resize listeners, keyboard subscriptions, sounds, particle systems, physics or collision structures, replay playback tasks, and GPU allocations. Repeatedly starting races, changing modes, visiting the garage, opening/closing replay, changing quality, and resizing the browser must not produce duplicate updates or unbounded memory growth.

Test performance in meaningful scenarios, including all five AI opponents, rain/wet road, damage and replay. Do not claim broad hardware performance from a single workstation or a single static menu; headless or software-rendered browser FPS is not evidence of real consumer-GPU performance. State the test environment and quality preset for any reported numbers. Report observed constraints honestly and reduce optional decoration before sacrificing core mechanics.

## 31. Static application, assets, privacy, and security

The delivered product is a **static client-side application**. It must not require any gameplay backend, matchmaking service, game server, account/login, subscription, cloud storage, API key, database, paid model, external model inference, analytics/telemetry, advertisement/tracking endpoint, remote CDN, remote font service, or runtime asset hotlink. Build-time package manager access, official documentation lookups and visual-reference browsing under Section 02 are distinct from runtime networking.

Bundle or locally produce everything needed for normal play. Once the application and its required assets have loaded, the complete game should continue to function if network access disappears. This does not mandate installing a PWA or service worker, nor claim that a page never visited can open offline from a fresh browser cache. Avoid misleading “offline-ready” claims not supported by the actual bundle and loading strategy.

Use original, locally produced or legitimately licensed material. Public online photographs and design examples may inform visual development, but viewing a picture never grants permission to redistribute it. Download and bundle only assets whose actual license authorizes the intended use, and retain source/author/license attribution when required; otherwise create an original alternative. Do not copy recognizable commercial car designs, proprietary track layouts, trademarked branding, unlicensed music, protected art or code. Record required third-party asset or package notices locally. Do not let user-supplied replay files become routes for code execution, remote resource fetching, arbitrary filesystem access or leaking browser identifiers.

## 32. Loading, recoverable failures, and honest capability reporting

Provide a useful loading experience and real error states. If progress cannot be measured reliably, show an honest indeterminate state rather than a fabricated percentage. A missing optional texture, unavailable audio output or unsupported fullscreen operation should not prevent all normal driving. If essential resources fail, show a specific retry/recovery path where possible.

Handle graphics initialization failure, recoverable GPU/context loss, resizing during play, a suspended/background tab, corrupted preference data, denied or full storage, malformed replay imports and interrupted writes. Do not restart an active race behind a loading overlay or claim that a save succeeded when it did not. Preserve unaffected gameplay and explain what was lost when full recovery is impossible.

A renderer context loss should not create endless resource reinitialization, duplicate controls, or phantom AI updates. If meaningful recovery cannot be supported under the actual browser, say so and offer a safe return to menu or reload path rather than silently fabricating continuity.

Make user-facing errors concise, actionable and relevant to the failed feature; retain technical diagnostics in development logs or a clearly separated diagnostics area.

## 33. THREE independently conceived, high-ambition Signature Features — no complexity ceiling

Conceive and deliver **at least three distinct, original, substantial, player-facing Signature Features**, each independently playable or usable and integrated with the game's actual state. **There is NO upper complexity limit and the previous 7/10 ceiling is REVOKED.** Aim for **10/10 ambition** where technically possible, without pretending that the number is an evaluation metric or mandating arbitrary size. Larger, deeper or fourth/fifth features are welcome if and only if they do not weaken *any* mandatory art, engineering, gameplay, performance, accessibility, privacy, replay or testing contract. There is no ceiling on creative imagination, but every shipped feature must be complete.

Each of the first three must be a **separate player value proposition**, not three names for one mechanic or three menu tabs of the same subsystem. Examples of *families* for inspiration, not prescribed answers: physically meaningful driving/vehicle systems, living-world interactions, social-free progression/personalization, cinematic/media creation, dynamic in-world activities, navigation/exploration, competition formats, meaningful garage interaction or emergent environment/gameplay systems. Do not reuse another game's branded implementation or a downloaded full-game feature. The model authors its own concepts.

For EACH Signature Feature, produce a concise design-and-proof card inside the project README: unique name and player purpose; trigger and expected visible state; interconnected subsystems; gameplay or media outcome; failure/edge handling; interaction with weather, vehicles, AI or course where relevant; replay/event/history requirements; input/accessibility handling; runtime cost and fallback; observable browser-test journey; and evidence artifact(s). At least one must meaningfully alter an actual **driving or competition decision**; at least one must enrich **world, presentation or player interaction**; the third is open. The categories may overlap technologically but the player-visible outcomes must remain distinct.

A feature that modifies in-run physics, AI, scoring, weather, progression, cameras, visuals or audio must be recorded or reconstructed faithfully in the timeline and must reset, pause and resume coherently. Distinct features do not waive restrictions on five opponents, the three standard modes, genuine local replays, no database, no online backend, no extra agents, or no copyrighted copying.

**Not qualifying:** a color variant, trivial widget, basic gamepad binding, cosmetic HUD counter, renamed nitro/drift, mandatory photo mode, a required replay viewer, ordinary rain/damage, a nonfunctional "coming soon" screen, a hidden debug console, or a feature that works only in screenshots. If real limits prevent shipping all three, be explicit about partiality; do not silently reinterpret the minimum.

The development approach must reserve meaningful integration and testing time for all three features while meeting the non-negotiable *visual first-class quality floor*. Scope is unlimited in ambition, **not** in authorization to ship broken mandatory requirements.

## 34. Implementation method and practical sequencing

Choose an appropriate local engine/framework and an understandable architecture without unnecessary platform building. Separate responsibilities sufficiently that race state, input, car dynamics, progress, AI, environment, rendering, replay, persistence and UI are not each maintaining inconsistent copies of state. Use explicit invariants for core race data and validate persisted/imported input at boundaries.

A sensible implementation progression is: establish a reliable playable race loop and appealing scene; complete usable track traversal and valid results; add the three course/mode identities and differentiated cars; integrate AI, nitro, drift, collision recovery, weather and damage; record and play authentic replays; implement local replay management and import/export; finish UI, settings and the Signature Features; then exercise complete flows, errors and presentation under realistic load. Adapt this order to actual engineering dependencies. **It is not permission to stop at an early vertical slice.**

**Milestone safety:** keep each coherent implementation milestone buildable, launchable and as playable as its current implemented scope permits. Avoid leaving the app broken while starting a broad refactor. Make a serious effort to complete all mandatory systems. If an actual execution limit blocks completion, favor restoring a playable build and delivering an explicitly incomplete, truthful handoff over claiming completion or leaving a known-broken build; a limit does not turn missing features into optional ones.

Prioritize end-to-end working behavior over decorative polish when a feature is broken, but do not use working mechanics as an excuse to ship an unfinished-looking technical demo. Deliver both a cohesive game and the specified functional depth.

## 35. Focused logic and regression verification

Write proportionate automated checks for logic where regressions would undermine correctness. Appropriate candidates include race start/finish transitions; three-lap validation; checkpoint sequencing and shortcut protection; ranking by legitimate progress; input binding conflicts; frame-rate-independent timing; pause/resume restoration; replay seek consistency; import size/schema validation; five-entry library replacement; and setting/race-state separation.

Tests must assert **observable invariants**, not simply repeat implementation details or always pass. Where pure logic can be tested without a browser renderer, prefer that separation. Do not claim an end-to-end game works because these unit checks succeed. A successful compile or type check is a foundation, not evidence that the car can complete three laps or that replay shows the actual race.

**Development-only test harness:** you may create a tool that exercises the same real player-input path with scripted input or a bounded autopilot for the player car, advances simulation deterministically, and injects safe failures such as denied storage, malformed replay files or context loss. For browser-based integration tests, it may advance the authoritative simulation faster than real time by executing **multiple normal fixed-size simulation steps per render frame**, or independently of rendering cadence—**never by enlarging a physics step `dt`**—so a full race can be checked with the same physics even when rendering is slow. Still inspect representative frames and primary flows in a real rendered preview. The harness may exercise the **actual post-race record creation, replay recording, playback and save/export/import pathways**, but its outputs must be **labeled as harness-origin and confined to isolated, disposable test storage that never shares the player's record or replay store**. Purge that test storage before delivery. Never present harness-generated fixtures as genuine player records or ordinary player replays, or leave pre-populated fake player data in the shipped product. It must not alter normal game rules and must be removed or inaccessible from normal production menus. Record whether each journey was checked by direct browser input, a development harness or automated logic only. A harness is not evidence that a human played it, and it does not replace inspecting the rendered game.

Run the automated checks that are actually available. If tooling prevents a check, report it as untested rather than passed. Correct failures before declaring completion, unless a genuine environment constraint makes the required behavior impossible; identify that constraint precisely.

## 36. Browser acceptance journeys

**Exercise the real application in the available browser preview.** Each journey below is a functional review of the *game*, not a procedure for rating an AI model. The scenarios are representative acceptance contracts; use the game's actual chosen controls and UI.

| Journey | Actions in a real browser | Evidence of completion |
| --- | --- | --- |
| First launch | Open the game, navigate menus, inspect garage, select a car and start | Meaningful 3D scene, usable controls and a real countdown; no missing primary assets |
| Time Trial | Drive all three laps; complete valid laps and attempt an invalid shortcut | Individual lap validity and best valid lap are correct; no fake or duplicated record |
| Competitive race | Start three laps on each available difficulty; observe all five rivals, passing and a collision | Six cars race, positions change from real progress, opponents finish/recover and results agree |
| Checkpoint Run | Follow the distinct course, collect checkpoints, earn an arcade combo and reach success or timeout | Timer, rewards, score and terminal state are coherent; repeated gate contact does not exploit the game |
| Weather/handling | Start with different initial weather/time choices and observe an in-race change; compare wet/dry handling | Lighting, scene and car/AI behavior respond; rain is not only visual |
| Nitro/drift/damage | Trigger and interrupt each mechanic; collide before and after a turn | Motion, HUD, sound, visual effects, damage persistence and fresh-run reset are coherent |
| Replay fidelity | Finish a race, open the viewer, play, pause, seek backward/forward through collision and climate changes, switch three cameras | Historical positions, AI, damage and weather match the chosen time; live simulation is isolated |
| Replay persistence | Save, refresh, reopen, export, import, fill five slots and try a sixth | Compatible replay round-trips, capacity requires a choice, no silent erasure or false save success |
| Record authenticity | Import a plausible-looking replay claiming an impossible best lap and inspect local records | No imported or replayed recording can write a personal-best record |
| Concurrent storage | With four of five slots filled, attempt saves from two tabs | Five-item limit and stored files remain consistent; a conflict is resolved or clearly refused |
| Static build | Serve production assets through a generic static HTTP(S) host rather than the development server | Core gameplay loads and works; persistent storage is exercised only when supported by the origin/browser |
| Retirement | Retire from an active race and inspect results/replay | No fabricated completion or record; partial status is preserved |
| Controls and settings | Rebind controls, test a conflicting binding, restore defaults, switch Low/Medium/High while racing | Real input mapping and graphics change without corrupting race state |
| Interruption and resilience | Pause, hide tab, regain focus, restart, leave to menu, try a bad import or unavailable storage | No phantom time/input, duplicate loops, crash or misleading success state |
| Three Signature Features | Independently access and exercise each of the three original player-facing systems | All three demonstrably work, have distinct outcomes and do not replace core requirements |

Complete primary visuals inspection in the menu, garage, daytime course, wet or nighttime racing, results, settings and replay viewer. Inspect representative desktop sizes including a narrowed browser window, and note what was actually observed versus presumed.

## 37. Adverse cases and consistency probes

Beyond the happy path, safely exercise failure cases that expose shallow implementations:

- Rapidly pause/resume while accelerating or using nitro; release focus and return; leave a tab hidden and resume without a time jump.
- Cross a start/finish line backward, skip an ordered checkpoint, use recovery near a checkpoint, and make repeated contact with a trigger; none should generate unearned progress.
- Collide with a rival or barrier, recover an off-track car, change quality and restart; damage, AI, classification and player controls should not leak into the next attempt.
- Seek repeatedly across the same recorded collision, recovery teleport, heading wrap-around, nitro event and weather transition; displayed state, historic HUD, audio and particle effects should not depend on seeking direction. If any Signature Feature affects race state, seek through its events and verify the corresponding historical state as well.
- Import an unsupported replay version, truncated file, absurd size, compressed expansion bomb or invalid numeric data; reject safely without corrupting existing saved replays or freezing the browser.
- Attempt a sixth saved replay; cancel and then explicitly replace an entry; verify the chosen old entry remains intact on cancellation or failed replacement. Recover an orphan at full capacity without silently creating a sixth entry.
- Deny persistence or simulate full storage where safe; keep the playable game and offer an honest ephemeral/export route.
- Enter and leave races, garage and replay repeatedly; watch for accumulating animation loops, sound duplication, stuck inputs or visible degradation. Exercise active driving after using a focused HUD button, and verify `Space`, arrows and other bound keys do not click UI controls or scroll the page. Include a foreign keyboard layout when available; verify physical key bindings and display labels. Check position ties near checkpoint boundaries and whether equivalent simulated inputs under different render frame rates preserve meaningful race outcomes.

Do not perform destructive tests against unrelated user data or bypass browser security to force an edge case. If a failure path cannot be exercised in the environment, identify it clearly as unverified.

## 38. Quality bar and acceptance boundaries

A feature is complete only when its **visible interface, player action, game-state effect and result** agree. In particular:

- An opponent is not functional merely because an AI-labeled car moves along a spline; it must participate in valid competition.
- Rain is not functional merely because particles and a dark road appear; driving response and timing must reflect wetness.
- Damage is not functional merely because an impact creates sparks; the accumulated vehicle state must be visible and replayable.
- A replay is not functional merely because a timeline scrubs a demonstration; it must reconstruct the actual complete or appropriately marked failed/partial run and support backward seeking without teleport interpolation or stale HUD/audio.
- A graphics setting is not functional merely because its button changes color; the rendering workload or visible fidelity must actually differ.
- A saved replay is not durable merely because a toast says “saved”; it must survive refresh when supported and support a successful file round-trip.
- None of the three required Signature Features is delivered merely because it has a name or a menu entry; players must be able to use each one independently.

If an optional enhancement is unsupported, provide an honest fallback and continue the core game. If a mandatory capability is truly blocked, do not silently relabel a mock as complete. Clearly state the gap and its effect on the finished product. No visible primary control should be a dead end.

## 39. Final handoff and definition of done

Deliver the **working playable game** in the available preview or dedicated workspace, not only a source excerpt, architectural plan, design document, screenshot, static animation, or collection of instructions for the user to perform the remaining work.

A genuinely completed delivery lets a person drive four distinctive cars through the three dedicated courses in their corresponding modes; finish a three-lap Time Trial and a three-lap six-car race; complete or fail a Checkpoint Run; experience balanced arcade physics, meaningful nitro and drift, changing weather/daylight, AI competition and progressive damage; watch faithful navigable replays from at least three cameras; manage a five-entry local history and file exports/imports; remap the keyboard; change actual graphics quality; and discover and use all three original Signature Features. The shipped product runs as a static client-side application without a gameplay backend or database.

The final report should be brief but truthful: identify how to open/play, primary controls, each of the three chosen Signature Features and its actual implemented scope (without an artificial complexity ceiling), technology and asset/license notes, checks actually run, browser journeys actually exercised **and by which means (direct browser interaction, development harness, or logic checks)**, real performance observations if measured, and precisely which features or hardware-dependent paths were not verified. Include a compact feature-completeness table with **Implemented + browser-verified / Implemented + logic-tested only / Implemented but untested / Partial / Missing**, plus one line of evidence for each mandatory subsystem. This describes the delivered product; it is **not a score, ranking or evaluation of any AI model**. Distinguish **implemented**, **tested**, and **not tested**. Never invent test results, FPS numbers, browser coverage, a publication, or capabilities not demonstrated.

Do not commit, push, open a pull request, merge, publish or deploy without separate explicit authorization. Preserve the user's other projects and private data.

**The V3-specific mandatory production gates and advanced requirements continue below.** Sections 40–59 are part of this same execution contract and must not be treated as optional appendices.

## 40. V3 photoreal mandate: real-looking game frames, not box-art promises

The finished game must demonstrate **photoreal visual intent at gameplay camera distance**, not merely high resolution or a polished title screen. The judgeable artifact is the actual moving, interactive build. This is not a demand for unavailable ray tracing, impossible hardware-independent fidelity or third-party premium assets; it is a demand that each visible element receive a convincing authored art pass and coherent material/lighting treatment. A deliberately stylized, toy-like, cel-shaded, flat-shaded or pastel-low-poly **final** result is out of scope for this photoreal edition. Temporary primitives during implementation are fine; they must not survive as obviously placeholder final art.

The art brief is a **premium sunlit and weather-changing coastal grand touring experience**: atmospheric Mediterranean-inspired coves, hillside architecture, believable road infrastructure, glancing sunlight on car paint, crisp but natural shadow transitions, water with convincing depth and motion, sightlines into geographic distance and naturally varied vegetation. Original geography and unbranded vehicle designs are required; avoid replicating a recognizable real resort, identifiable licensed racing brand or protected game art. Visual direction should feel premium at high speed **and when the car is stationary**.

**Production-grade criteria, not marketing language:**
- A car should still look like an actual designed car when viewed from the front, side, rear, three-quarter and close-up garage camera; wheel arches, greenhouse, bumper, lights, beltline, glazing and proportion must read correctly.
- Road, cliff, sand, concrete, foliage and water must not share a single flat color/material response. Texture frequency, surface normals, roughness and color breakup must respond credibly as the camera moves.
- The light source must be visible in its **effects**: oriented cast shadows, daylight contrast, plausible reflections, environment brightness and changes when the sun moves. Merely coloring the sky does not implement a dynamic sun.
- In rain, true visible wetness differences must exist for asphalt, painted road markings, metal, leaves and windshield/vehicle surfaces, alongside changes to actual grip. Rain alone as translucent streaks does not qualify.
- Distant architecture, terrain and landmarks must form a readable composition with realistic scale cues. No repeated identical palm trees as a stand-in for a lush environment.
- A paused gameplay frame, with the HUD hidden, must convincingly convey the same world fidelity as any promotional capture. No fake prerendered beauty screen can compensate for a crude racing view.
- Quality may scale for actual GPU performance, but the **High** preset must be demonstrably richer and aesthetically polished; **Low** must remain coherent rather than deleting all essential world information.
- Small UI alone does not mean good UI. The entire display must be legible at 1080p, with racing information and visual hierarchy balanced against the road view. Avoid giant arches or banners occluding the horizon.

**Disqualifying final-state patterns:** geometric box-car with four cylinders for wheels; rectangular start gate spanning much of the viewport; monotonous smooth asphalt strip; uniformly colored mountains and sand; paper-cutout palms; colored sky gradient without meaningful illumination; single-value opaque cyan water; six identical AI boxes; HUD meters that drown out the road; photo mode that only changes the background overlay; post effects that hide an undetailed base scene; 3D gameplay secretly replaced by a 2D video, static image or fake interaction. Do not relabel any of these as an artistic decision.

## 41. Original asset pipeline, authoring evidence and license discipline

### 41.1 Art pipeline is a first-class engineering subsystem

Choose a coherent rendering architecture and **actually author or assemble an art pipeline**, not merely a procedural placement loop. The product should have: documented material conventions, consistent texel density where practical, color-space-aware sampling, sensible normal/tangent handling, organized environment props, scene-specific lighting setup, art budgets by preset, reuse that does not look repetitive, and a deliberate way to inspect and adjust assets. No prescribed DCC program or file format is mandated.

**Four playable vehicle bodies and all three race-course layouts must be project-original.** They may be created procedurally, by manual mesh construction, through permitted non-AI local tools, or mixed techniques. Do not download finished third-party vehicle models or prebuilt tracks, even if they claim permissive licenses; this is an authorship test. Generic supporting environment props, PBR texture sets, HDR environment maps, ambience, sound effects and small non-brand-specific mesh assets may be locally bundled if their actual permissions were verified before use. Properly licensed sources do not waive original composition and integration. Never use generative AI services or image/model/music generators as supporting tools during the run.

For licensed items, retain a machine-readable or readable **ASSET-LICENSES.md** containing exact asset identifier/file, origin/license URL or bundled legal notice, the permission basis, attribution conditions, modifications and local destination. For procedural assets, state the generator/script and conceptual method. If permission cannot be established, omit the asset rather than assume it is free. A user-supplied visual reference is not a license to reuse pixels.

### 41.2 Texture realism without external asset dependence

Every major surface family requires a production-quality material appearance. Material realism can be achieved with authored images, correctly licensed maps, analytic shaders, procedural textures baked or sampled at runtime, or combinations. **Conventional bitmap texture files are not inherently mandatory**, but visually convincing texture/microstructure, physically credible response and variation **are mandatory**. Do not claim that a flat diffuse color is PBR because the shader exposes metalness and roughness constants.

The visual material library should include clearly distinct response classes: asphalt and aggregate; road line paint/curbs; sand/soil; strata-rich rock and weathered cliff faces; foliage/wood; painted automotive clearcoat; rubber/sidewalls; glass/tinted windows; chrome/metal; architectural stone/stucco/wood; wet variations; and water. Coordinate texture scale with geometric scale, curb size, car size, tire contact and road width.

For each representative material, inspect how it looks in high sun, grazing light, overcast conditions, rain and night. Provide enough visual separation that the player perceives the difference with the HUD hidden. Surface roughness and wetness should vary by physical category rather than become uniformly glossy.

### 41.3 Geometry and high-frequency scene detail

The silhouette and dimensional coherence of important objects matter more than an arbitrary polygon count. Still, avoid relying on a few cubes/cones/cylinders at the final art pass. Curves must be smooth at camera distance; road meshes must be smooth through camber/grade changes; wheels must remain rounded under rotation; buildings need roofs/openings/depth; large rocks should convey geological asymmetry; trees should exhibit branching and clustered leaves at gameplay distance.

Design asset LODs and instanced variants so detail can be sustained in a dense scene. Texture reuse and batching are encouraged; visible clone stamping is not. Mix close-view hero assets with appropriate distant proxies and terrain composition. Every major hero asset must remain convincing on a brief stopped-gameplay inspection, not just at high speed.

## 42. Physically based rendering, lights, color science and camera optics

Use a physically grounded material/render workflow suitable for a modern browser. At High quality:
- Ensure **sRGB/linear workflow** and correct handling of texture color spaces; avoid double gamma, blown whites, muddy blacks and unnatural fully saturated materials.
- Use a physically reasoned BRDF for principal lit surfaces, with energy-aware specular reflection and roughness variation. Car paint should have credible clearcoat-like response and shaped highlights where the chosen renderer supports it; do not fake a shiny car solely with a painted bright streak.
- Use one coherent, animated directional sun/moon lighting strategy, ambient sky/hemisphere fill, and local artificial lighting for night/tunnels. Atmospheric illumination and sky appearance must track the time-of-day state; shadows must rotate and change coherently with the sun's direction. Night requires headlights, tail/brake lamps, readable road and believable landmarks.
- Implement **visible dynamic cast shadows** for cars and meaningful nearby geometry; use appropriate cascades, filtering, contact treatment, baked/dynamic mix, or quality-scaled equivalents. Avoid cars floating above roads and light leaking absurdly through tunnel walls.
- Use stable, measured **tone mapping and exposure**. Reflections, headlamps, white buildings, ocean glints and bright sky should not be clamped into huge featureless white patches; shadow detail should survive where physically plausible.
- Apply **screen-space or geometric ambient occlusion** (or an honest equivalent based on the renderer) to strengthen contact and architectural depth. It must not produce dirty halos around cars or enormous black corners.
- Include a carefully tuned **postprocessing chain** with restrained bloom, tonemapping, antialiasing and a coherent camera-grade aesthetic. Chromatic aberration, vignette, film grain and motion blur are **optional and must be adjustable**, never substitutes for real geometry/material quality.
- Implement **convincing reflections** on paint, windows, wet pavement and water using appropriate environment maps, dynamic probes, planar, SSR or another supported approximation. Reflections must change with surface, viewpoint or environment in a physically meaningful way; do not claim full real-time path tracing if it is not implemented.
- Use robust **shadow, reflection, AO and postprocessing fallback modes** when extensions/capabilities are unavailable. Explicitly document which methods were actually used and which could not run.

**Grounded light-direction test:** In one daytime screenshot, select a visible sun/bright sky direction and point to the actual corresponding cast shadow on the vehicle or a nearby structure. In another time-of-day state, that direction/length and broader ambient exposure must visibly differ. A static dark blob under the car is not sufficient evidence for dynamic sun lighting.

**Grazing-material test:** Inspect wet and dry asphalt on a curved road at a low chase-camera angle; the material must show convincingly distinct highlights, microdetail, worn markings and changing contrast. A full-screen blue/dark overlay over dry geometry does not pass.

## 43. Atmospheric optics, sun, night, fog and high-quality water

The world requires intentional depth from near asphalt to distant ridgelines and the ocean horizon. Build a compatible sky/atmosphere system with plausible sky color gradients, horizon scattering/fog, distance haze and directional sunlight. Subtle light shafts or volumetric-looking fog/light scattering must be visible in a convincing context—such as a tunnel exit, coastal sunrise, dust/fog bank or tree canopy—without washing the entire scene into a fake white filter.

**Volumetric atmosphere:** An actual participating-media effect, correctly integrated froxel solution or a restrained quality-scaled approximation is acceptable if its spatially varying behavior is visible. Transparent gray billboard slabs or one uniform fog material across all depths do not qualify. At minimum, weather and time should meaningfully change visibility, atmospheric color and light shafts or fog structure on one documented route segment. Prefer correctness and stability over expensive fake density.

**Ocean:** Coastline is a primary image-quality target, not a teal polygon to the right of the road. Water must present view-dependent reflection/roughness, spatial/temporal wave motion, plausible horizon and color depth, sun glints, coherent shallow/shoreside transitions, and recognizable foam/shoreline activity. Detailed techniques are open: layered wave spectra, FFT-like waves, normal-map synthesis, procedural Gerstner waves, or another performant approach. A static opaque plane with a jittering normal is not enough when evaluated from a coastal overview. In rainy weather, water response should change in an intelligible way without becoming distracting.

**Sunset-to-night transitions:** Implement credible variation in sun position, horizon luminance, color temperature, long shadows, evening lamps, vehicle lighting, star/sky visibility where appropriate, and night road readability. Time can compress for demonstration, but the visual/physical evolution may not jump discontinuously or desynchronize from recorded race time.

**Wet weather:** Distinguish falling droplets, fine spray, puddles, road wetness, cloud shadow/overcast, evaporating/drying conditions and tire contact where appropriate. Rain transitions should be linked to driving physics and remain observable at lower quality settings through reduced-cost alternatives. Rain may not spawn identical full-screen streaks independent of camera speed and environment while the track never gets wet.

## 44. Three deeply authored courses and coastal region authenticity

Preserve **Coastal Sprint — Time Trial**, **Riviera Grand Prix — Race vs AI**, and **Horizon Rush — Checkpoint Run** exactly as three complete and distinct primary modes and routes, with all original lap/checkpoint/finish requirements intact. Make the world feel like a single coherent region, while each course has its own rhythm, recognizable geography, weather visibility challenges, road language and hero landmarks.

**Coastal Sprint**: demonstrate scale and speed by following a coastline with elevation, cliffs, glancing ocean views, roadside pullouts, safety rails, scenic road geometry and natural transition between exposed sun, cliff shade and vegetation. It should not be a flat oval with decor.

**Riviera Grand Prix**: an inhabited-feeling town/coastal circuit with credible building massing, street detail, curb and road surface transitions, a tunnel and/or bridge, technical corners with safe overtaking, lights/signage with a consistent language and room for six physically present cars. Architecture must not look like one cuboid building copied 30 times.

**Horizon Rush**: a pressure-focused route crossing distinctive terrain and landmarks, with clear ordered checkpoints, changing skyline/vegetation and road grades; visually show anticipation, momentum and completion. Gates should be artistically integrated into road environment and not huge UI-like obstructions that cover the horizon.

**Each course must contain, at minimum, all of the following categories in a convincingly authored form**, without imposing arbitrary object counts: a recognizable opening vista; more than one visually distinct biome or built-structure rhythm; a deliberate mid-course hero moment; a legible approach to tricky corners; a materially differentiated roadside/terrain border; relevant animated/environmental details; and an endpoint/finish framed intentionally in the racing world. This is a breadth-of-art checklist, not permission to scatter random objects.

**Environmental density:** Use scale-aware scenery composition at close, middle and far distances. A pretty sky cannot replace landforms. Realistic roads require guardrail mounting details, road signs/markings, drainage/retaining structures where plausible, shoulder transitions, bridge supports/tunnel portals, berms, rocks and local ecology. There should not be large stretches of anonymous uniformly colored geometry through normal racing camera views.

**Animated environment:** wind-responsive foliage with controlled variation, distant birds or maritime cues where appropriate, water movement, town lights/signage, ambient traffic/people only if safe and affordable and consistent with game traffic rules. Do not substitute a few particle sprites for an alive world. Decorative systems must clean up and scale with quality presets.

## 45. Four high-fidelity cars and believable automotive dynamics

Deliver **exactly four or more** playable car choices, with the first four constituting a complete and diverse baseline. The mandatory four should have original silhouettes and recognizably different body proportions; do not use recolors. All must work in all three modes, in all weather/lighting states and in recorded replays. Each requires high-quality exterior design, viable tuning, audio identity and realistic motion cues.

**Visual engineering of each car:**
- Detailed body volumes, bumpers, hood/roof/trunk, windows/glazing, wheel arches, spoiler/splitter when suited to its personality, mirrors and panel separations.
- Properly mounted rotating wheels and visibly separate tires/rims; wheelbase/track/ride height must match body scale; steering and wheel rotation must agree with movement.
- Credible headlights, brakelights/taillights, turn-style/side detailing where relevant, believable glass, chassis shadow/contact and material differentiation among paint, rubber, metal and trim.
- Suspension and body pose cues for acceleration, braking, turning, bumps, landings and collisions. Do not rely on moving a perfectly rigid cube around a path.
- High-quality garage presentation allowing visible front/side/rear views, with informative comparison of actual physics traits (not fake bars); original paint/livery choices are welcome if they do not replace distinct meshes.
- Distinct handling characteristics that remain balanced and viable; a high-speed car should require different corner decisions than a nimble chassis, not only a different displayed top speed.
- Audio and camera feedback that respond to the actual state of each model.

**Physics depth:** Use a coherent rigid-body or credible vehicle approximation with frame-rate-independent integration and stable collision handling. At minimum, model throttle/braking/inertia, longitudinal traction, lateral grip/slip, a meaningful drift regime, wheel response/steering, vehicle yaw dynamics, mass/load transfer effects and a suspension/contact model or valid convincing approximation. Road camber, grades, wetness and off-road materials must influence outcomes. An on-screen car with a realistic mesh but 2D arcade movement that ignores tires and road surfaces is insufficient.

**Transmission/engine cues:** Engine RPM and gear state or a functionally credible analog should drive sound and response. Gears, torque curve, simulated shift impulses and drive-wheel behavior are at the implementer's discretion. Avoid fake shifting sound effects unconnected to vehicle speed or acceleration. Steering may include arcade assists, but those assists must be explicit, understandable and compatible with difficulty, not a hidden cheat.

**Skillful driving:** Drifting needs controlled entry, sustained slip and recovery with trajectory consequences. Nitro needs genuine resource/use/cooldown behavior and physical response. When collisions occur, player and AI must experience fair contact interactions. Damage accumulation must be spatially or mechanically tied to collision direction and severity. If visual damage is artistic, it still needs temporal consistency and replay rewind correctness.

**Cockpit camera is expressly NOT mandatory for V3.0.** A high-quality third-person chase view and the required replay cameras are mandatory. Optional cockpit implementation is welcome if fully modeled, readable and performance-safe; missing cockpit is not noncompliance.

## 46. Five genuinely competitive AI rivals and reproducible fairness

Preserve **five simultaneously competing AI drivers** on Riviera Grand Prix and three fixed difficulties Easy/Normal/Hard, without position-dependent rubber-banding. Distinguish rivals by driving identity, stable names and appearance, rather than five scripted cars sharing exactly one behavior path. A skilled rival should look ahead, brake realistically for corners, preserve speed where safe, change lateral road positioning to pass/defend, account for wet surfaces and collisions, and recover from obstruction without teleporting to a manufactured lead.

Your local implementation may use route representation, lookahead steering, behavioral policies, overtaking opportunity evaluation, collision avoidance, limited tactical reasoning or other authored methods. Performance must remain acceptable with all five simultaneously present; a visually polished single-car screenshot is not an adequate racing implementation.

**AI acceptance events:** two opponents attempt or complete a credible overtake; changing difficulty has measurable behavioral consequences under same setup; a rain transition changes their grip/braking behavior; collisions or blocking do not permanently strand them; players can overtake and lose positions legitimately. AI must not get phantom lap progress, emit made-up finish times, ignore surface hazards, or teleport off-camera for better results. These events must be visible in a recorded run and survive replay seeking.

## 47. Weather and day/night as a coupled world simulation

This edition requires **both** dynamic meteorology **and** an evolving day/night cycle, not merely separate static presets. Support initial sunny/cloudy/rainy choices and morning/day/sunset/night starting points, with real progression in a continuous race. Maintain a single authoritative condition state with physically meaningful consumers: sky/illumination, clouds, fog/visibility, ambient/audio, wetness/drying, tire friction, braking distances, rival behavior, headlights, road lighting, water response and replay timeline.

Implement actual progression and internal consistency: wetness ramps after rainfall begins and dries over time; night headlights become visible as ambient light drops; cloud cover plausibly changes direct sunlight; dusk shadows rotate or soften as appropriate; AI and player share grip coefficients; geometry and UI do not randomly mutate. If transitions are compressed for short races, give them coherent rates and test them with simulation-time controls that do not bypass gameplay rules.

**Coupled-state probe:** start a race in clear daylight, drive through a documented weather change, pause mid-transition, inspect material and handling changes, resume, finish, and seek the replay backward and forward through the transition. The same moment must reconstruct the same world state and driving context regardless of seek direction.

## 48. Full cinematic presentation without HUD obstruction

At gameplay camera level, the experience must communicate speed using animated wheels, parallax, controlled FOV, sound pitch, physically plausible body motion, road surface travel, camera smoothing, winds/spray and nuanced motion effects. Never hide low-quality assets with heavy vignette, extreme blur or shake.

**Live camera:** a stable chase camera with appropriate road look-ahead, obstacle/tunnel occlusion handling, dynamically controlled framing, reasonable low/high-speed behavior and option to moderate camera effects. Transitions must not throw the camera through buildings or clip the vehicle.

**Replay camera:** at least three genuinely distinct and working views, including a chase/driver-near view and cinematic trackside/aerial-like perspectives. Trackside shots should frame cars and landmarks, use reasonable cuts/transitions, respect space at high speed, and never change the recorded state. A camera label switching between near-identical offsets does not qualify.

**Race-start/finish cinematics:** elegant brief staged moments with clear start position, countdown, arrival/result presentation and recoverable transition to player control. No giant slab or branding bar should cover the horizon for seconds during a race. Essential state remains readable during all effects and while skipping cinematics.

**Menus/HUD:** polished garage, readable selection, weather/time/quality choices, status and failure messages with unified visual design. Only task-relevant HUD should persist during racing; speed/nitro/timer/lap/position/checkpoint are arranged with thoughtful spacing and contrast. Avoid unreadably tiny type and billboard-scale overlay typography. Use flexible, tested layout at 1920×1080 and narrower desktop widths. Important UI controls must have true focus/disabled/selected states.

**Audio:** build a continuous soundscape with engine note from actual load/RPM, shifting, tire scrub, skids, collisions, rain, wind, ocean and environmental location cues. Stereo spatialization is desirable where supported; no mandatory third-party soundtrack. Browser autoplay restrictions and muting must be handled. A generic oscillator running at one pitch regardless of motion is not sufficient sound design.

## 49. Photo mode, authored composition and screenshot evidence

Implement a **fully functional Photo Mode** available in appropriate paused/noncompetitive contexts. At minimum, offer a free/orbit/dolly-like camera around the player car, camera movement, adjustable field of view/zoom, a UI-hiding clean view, basic exposure/lighting or photo-grade controls, reset/exit, and a working screenshot/export path when the browser allows capture. A physically justified depth-of-field control is desirable but can be a quality-supported enhancement; if unsupported, explain honestly rather than showing a fake slider.

Entering Photo Mode must **freeze the authoritative race state** and AI, timers, lap progress, nitro and recording. Adjusting camera/photographic settings must not alter competition or records. Leaving Photo Mode must restore the correct camera and input ownership without control leakage, unpausing unexpectedly, or leaving an extra render loop. It must work with normal browser permission constraints and not attempt to read arbitrary local files.

**Screenshot evidence gate — actual rendered frames.** Before claiming final visual completion, inspect and save genuine, unedited screenshots from the playable built application covering:
1. First-playable race/start vista in Coastal Sprint with a car and actual world visible, HUD present but not obstructive.
2. High-sun car three-quarter close-up/garage with material reflections and visible body geometry.
3. Sunrise or sunset on a visibly different portion of the coast, with directional illumination/shadows.
4. Rain and wet asphalt with visible material/reflection/visibility change.
5. Night section with plausible lights and clear driving route.
6. Riviera town/tunnel or bridge in active six-car race.
7. Horizon Rush mid-course with ordered checkpoint and authored landscape.
8. An opponent pass or contact event with real car identities.
9. Photo Mode with UI hidden and independent camera perspective.
10. Replay view at a recognizable historical event.
11. Low versus High quality screenshots at a comparable game state to show real visual differences.
12. A second original vehicle on a different route, so screenshots cannot conceal one polished hero model behind three rough alternatives.

Each capture must record course, car, weather, time-of-day, graphics preset and whether captured by **direct browser play or an isolated scripted harness**. Do not claim direct play if a harness drove it. Do not use synthetic mock screenshots, AI-generated images, static scene illustrations or screenshots from another game as proof of functioning gameplay. Do not fabricate evidence when screenshot tools are unavailable; disclose the untested gate explicitly. A screenshot is a visual sample, **not proof of physical/gameplay correctness**, which must be tested separately.

**Review without model scoring:** These are acceptance observations, not ratings or ranking criteria for comparing AI models. The submission's final documentation can include a simple **pass / blocked / not verified** checklist with factual links to frames and executed scenarios. Do not invent numerical “art scores,” “AAA percentages,” or model leaderboards.

## 50. Advanced actual gameplay systems and physical feedback

The advanced visuals must be underwritten by responsive, consistent racing systems. Mandatory features go beyond an attractive static 3D camera:

1. **Material-dependent grip and braking:** asphalt dry/wet, painted markings, shoulder/gravel/sand and other authored road conditions should produce distinguishable handling; cars and rivals obey shared material/condition semantics. Demonstrate a controlled same-corner wet/dry comparison; preserve fair controls.
2. **Suspension and load transfer:** credible visual and dynamic response on braking, accelerating, steering, bumps and grade changes. The tire contact and vehicle silhouette must not float or sink because road mesh and physics disagree.
3. **Tire slip and drift response:** a controlled drift initiation, maintainable yaw/slip, countersteer or exit assistance, audible tire behavior and physically connected skid traces/spray/smoke on applicable surfaces.
4. **Traction and brake assistance:** accessible default arcade assists are permitted, with clearly described effects and choices, but may not silently neutralize wet-surface handling. Distinct assists can be real user settings when integrated and tested; avoid introducing impossible “simulation modes” that are labels only.
5. **Traffic-aware collision:** barrier, vehicle and off-road contact should transfer motion, accumulate damage and produce appropriate sound/visual cues. Recovery has fair, anti-shortcut behavior and does not leave debris, nitro or replay glitches.
6. **Race-start and finish logic:** correctly place cars on a coherent grid, count down, release controls together, validate all route progress and stop only on legitimate terminal conditions. Race results and ghost/split data must originate from actual states.
7. **Driving feedback loop:** camera pose, body roll, gauge readings, wheel motion, RPM or engine state, audio, tire traces and race speed must agree. Do not animate five independent fake “speed” representations with inconsistent values.
8. **Visible rival identities:** each competitor should carry a stable name/livery/body identity through the grid, live race, results and historical replay, with nondeceptive positions.
9. **Race-resilient controls:** keyboard must work on physical key codes, support remapping and no stuck inputs; add functional gamepad support using standard browser APIs when available, with sensible dead zones, analog steering/throttle and an explicit fallback. Gamepad users must still be able to navigate menus or return to keyboard without dead ends.
10. **Competence-building UI:** show driving/braking/nitro/drift feedback without overwhelming road view; an optional brief tutorial or onboarding may assist but cannot replace required playable content.

**No invented extras are substitutes** for the three modes, four cars, five rivals, dynamic climate and daylight, replays, three Signature Features and photo mode. All required systems must work together, not only individually in isolation.

## 51. Durable full-race replay and state-reconstruction contract

All important V2.6 replay requirements remain binding, now expanded for the V3 systems. **Capture a genuine run and reproduce its actual chronology**, not a marketing flythrough or a scripted “best moment.” The recording must cover vehicle and rival positions/orientations, car identities, wheel/body state sufficient for faithful playback, collision/damage events, nitro/drift events, race progress/timing, weather/road wetness/time of day, road/landmark conditions where they materially change, and each Signature Feature's state or event stream when its effect is visible in replay.

**One source of authoritative simulated time** controls replay and game state. Historical playback cannot retroactively recalculate a record using a changed physics tune, invent missing AI passes, or show the final weather across the whole recording. If the simulation uses timestamps/snapshots, bound the gaps and test seeking across discontinuities. A death/recovery/teleport event must not interpolate a car visibly through a cliff. Steering angle wraps and time-of-day transitions must be reconstructed consistently.

**Replay viewer minimum:** three genuinely different, working cameras, pause/play, repeatable bidirectional scrubbing, a truthful timeline with total duration, seek-to-start/end, historical HUD/standings/checkpoint state, time-appropriate vehicle damage and an exit path that does not restart the live race. Cinematic transitions may be interpolated, but **recorded physical history is immutable**. Seek through at least two collision/damage events, one AI overtake, one weather change and a Signature Feature event when relevant.

**Local library:** exactly the V2.6 upper limit of five saved entries remains, with explicit capacity handling, user-chosen replacement, storage failure rollback, distinction between played/imported, local file export/import and no fabricated legitimate records from imports. No server/database/IndexedDB/Cloud backup. File inputs are untrusted. Implement schema versions, bounded decode size/count, robust bad-file rejection, correct relaunch/reopen behavior, browser-local fallback and concurrent-tab-safe capacity behavior. Incomplete race histories must remain marked partial or failed.

**Visual replay fidelity:** water/wind/background may use bounded procedural recreation when not material to historical correctness, but rain/daylight/track wetness/collision damage and visual features that change driving must reflect the recorded point in time. Photo Mode cannot alter replay history. Signature Features involving world state must either record or reconstruct that world state or explicitly limit themselves to nondriving contexts with truthful documented behavior.

**Export/round-trip proof:** Produce and import a real recording under a clean browser storage namespace; inspect at least its start, one mid-race event and finish. Deliberately feed a corrupt or oversized replay, and confirm the browser keeps the currently saved recordings intact. If this is untested, do not mark replay integrity verified.

## 52. Performance engineering and visual fidelity on real browser hardware

**Target:** a stable **1920×1080 desktop experience around 60 FPS** at a named graphics preset on an identified suitable consumer GPU/CPU. This is a measured ambition, not a guarantee on every integrated GPU, remote browser or software renderer. Record operating system, browser/version, GPU if available, resolution/device pixel ratio, renderer path, graphics preset, in-game situation and observed sample period before claiming performance. Distinguish an unloaded main menu from **an active six-car wet-weather race**.

### 52.1 Real quality presets and measurable tradeoffs

Provide Low, Medium and High presets with actual different workload and evident visual consequences. Relevant knobs include shadow map count/resolution, AO, reflection quality, volumetric steps, geometry LOD and culling, water simulation/normal detail, foliage density, anisotropic filtering, particle budgets, post effects and internal render scale. *Presets are not permission to drop gameplay systems, car identity, essential road details or input functionality.*

**High**: premium visuals on capable hardware. **Medium**: credible photoreal direction and stable gameplay with reduced costly effects. **Low**: correctly lit, coherently textured game retaining readable weather and all functional mechanics, with honest visible compromises.

Provide an actual resolution scale or dynamic quality knob, adaptive or manually selectable. Changing it must not retroactively change simulation time, car speed, AI placements, replay correctness or race result.

### 52.2 Workload and lifecycle controls

Use frustum/visibility culling, instancing of repeated prop families, appropriate LOD policy, object pooling, limited particles, compact geometry, texture/memory budgets, shader/material reuse and avoidance of repeated GPU uploads. Rendering should not recompile shaders or allocate large textures on every race restart. Driver inputs and simulation should remain responsive during temporary render hitches.

Include a strategy for renderer/device/context loss and recovery where the API permits; if the GPU is unsupported, provide a truthful capability error rather than a fake playable screen. Resizing the browser must not silently multiply drawing resolution beyond practical VRAM use. Avoid expensive effects with no visible benefit at supported camera distances.

**Performance inspection sequence:** (1) opening menu/garage with all car renders; (2) clear daytime driving; (3) heavy rain/wet road; (4) nighttime lights plus five AI cars; (5) replay scrubbing/camera switching; (6) a photo-mode captured frame; (7) repeated race restarts and quality changes. Observe sustained frame time and memory behavior. Do not call a single frame or a headless automation FPS sample proof of 60 FPS on real hardware.

### 52.3 No performance deception

Do not hard-code a fake 60 FPS display, skip physics steps silently to claim a number, present a simulated benchmark as a hardware benchmark, or reduce art/AI only for screenshot sessions without documenting the change. Actual performance bottlenecks and untested hardware must be reported. A visually convincing scene that legitimately runs at lower FPS should be disclosed as failing the requested performance target, not relabeled as a pass. Conversely, a high-FPS empty blockout is a **visual quality failure**.

## 53. Accessibility, control clarity, media comfort and robust UI state

**Desktop browser is the primary target.** Keyboard driving and fully remappable primary keys are mandatory; conflicts and defaults need real resolution. Menus, modal dialogs, garage, settings, replay, photo mode and export/import workflows must be navigable and usable with clear focus, readable text and practical instructions. Gamepad support is required where a standard accessible Gamepad API is present and testable, with keyboard fallback; unsupported hardware must be disclosed truthfully.

Provide settings for master/music/effects levels or at least meaningful master/mute, subtitles/captions or equivalent critical-event text cues, reduced-motion driving/camera/transition profile, fullscreen when available, brightness/exposure when supported, render-scale and actual graphical quality. A chosen setting should persist where browser storage permits, be reflected in the UI, and never corrupt a race when toggled.

Maintain comfortable contrast for HUD text and route guidance in all sun/rain/dusk/night conditions; test the 1080p layout and a narrowed desktop window. Important status messages must not be only color-coded. Inputs triggered while interacting with sliders/dialogs must not also cause vehicle nitro/drift, browser page scroll or inadvertent button activation. Hidden-tab/pause/resume must clear stale held inputs, avoid timer jumps and stop duplicate audio sources.

For flash-sensitive users, avoid repeated full-screen strobing, excessive camera shake, compulsory motion blur and blinding sun bloom. Respect `prefers-reduced-motion` or a functional in-app preference. Accessibility is part of production finish, not merely a label in the settings menu.

## 54. Three Signature Features — design-for-complexity and independence proof

This section supplements Section 33 rather than adding a fourth required creative feature. The **minimum remains THREE** fully implemented original, discoverable Signature Features, with **no maximum complexity ceiling** and no maximum number of extras. The request to pursue “10/10 complexity” means **high ambition**, not a quantitative grading scheme, a hard cap, a loophole for false completion or permission to ignore normal resource constraints.

### 54.1 Make three meaningfully different systems

The three chosen features must have **different triggers, state or data flows, and player-visible payoffs**. They may share an underlying engine or world model, but three skins for the same button count as one. Their complexity should be demonstrated by meaningful integration and real consequence—not by inflating code or inventing a fake feature taxonomy.

Suggested *example dimensions* (not required selections, benchmarks, or external research prompts):
- **Deep driving / competition innovation:** strategic tires or traction modes, meaningful vehicle-care dynamics, nuanced drafting/aerodynamics, route-dependent tactical decisions, competition-affecting environmental behavior.
- **Living coastal world / emergent interaction:** world state that changes with driving or weather; coherent dynamic road/landmark events; believable noncompetitive environmental systems that alter how the player experiences a location.
- **Player-controlled creation / expression:** richly integrated garage customization, meaningful race/photo scenario creation, documentary filmmaking tools, sophisticated local race analytics, bespoke weather/time visualization tied to recorded gameplay.
- **New mode-adjacent player experience:** an optional side activity, progression system or authentic world exploration extension, provided all THREE contracted primary modes are still first-class and no leaderboard of AI models is introduced.

The above are **families**, not feature recipes and not automatic passes. The model must author concepts independently. Any extra mode, additional vehicle, expanded world or cinematic system counts toward extra content only if fully implemented and the three core modes stay intact.

### 54.2 Originality, proof and replay contract

For each feature, maintain a simple written contract: **what the player does → what engine state changes → how that state is visible/audible → how it survives pause/restart/replay/storage where relevant → which browser journey demonstrates it**. State truthful limitations. A feature may be very complex and cross-cutting if it is complete; no arbitrary implementation-size number is applied.

At least one original feature must **change player driving or competitive choices** materially, not just visuals. At least one original feature must **change world interaction, environment storytelling, media creation or player agency** beyond passive scenery. The third should add its own player value independently of these. No feature may be a renamed core requirement, including ordinary nitro, drifting, rain, time of day, AI, original garage, photo mode, replay, collision damage, control rebinding or Low/Medium/High graphics settings.

For features affecting a live race, be rigorous about AI fairness, weather coupling, physical consequences, replay event/seek capture, pause/resume reset and performance. For nondriving features, require full real UI interaction, saved state if persistence is intrinsic, safe imports/exports if offered and proper exit/recovery. If a feature is not fully usable, **report it as partial**, not as an extra victory.

### 54.3 Ambition cannot cannibalize quality

There is **no creativity cap** but there is a non-negotiable acceptance floor. A fourth or fifth major feature does not compensate for an untextured road, a barely shaped car, broken six-car racing or a fake replay. Do not select easier features solely to satisfy a count. Do not multiply optional modes until primary production quality collapses.

**Meaningful quality sequence:** establish production-quality rendering/lighting/material/vehicle baseline early; prove all original gameplay and time/replay invariants; integrate the three conceptually distinct features end-to-end; improve their presentation; complete full-browser verification. Iterate these tracks throughout development rather than putting all visuals on the last day. A visual-only sprint at the end of a feature-bloated project is not a valid V3 work plan.

## 55. Browser-first development, actual inspection, and truthful claims

**Browser, Playwright, DevTools, screenshots, GPU inspection and operational skills are allowed and expected.** Their minimal manuals may be consulted for tool operation; operational guidance is not an extra task brief. A tool can load a project preview, automate inputs, take screenshots, report console/renderer failures and profile frame-time, but no one may inspect unrelated user data, source repositories or another AI model's implementation. Running a browser test is not an exception to clean-room boundaries.

Develop against actual rendered frames, not just source code. Use a stable preview and repeat the loop: build → launch → inspect daylight frame → inspect vehicle close-up → change weather/time → exercise driving/collision/replay → identify concrete visual defects → fix geometry/material/light/composition → recapture genuine frames. Reject art assets that look like primitive placeholders even if they technically satisfy type definitions.

**Required full-browser journeys:**
1. Cold start, clean static build (not only dev server), all menus and garage, four distinct vehicle previews, loading and countdown.
2. Three valid and invalid lap flows in Time Trial, including reset, best lap and no record for all-invalid session.
3. Riviera three-lap six-car race on Easy/Normal/Hard with full rival grid, at least one overtake, contact and truthful classification.
4. Complete Horizon Rush checkpoint sequence, time extension, score/combos, legitimate success and genuine timeout/failure.
5. Nitro and drifting under dry/wet surface conditions, different car handling, recovery, reverse/wrong checkpoint prevention.
6. Visible morning/day/sunset/night with actual sun/shadow/headlight behavior; cloudy/rainy transition, road drying and altered grip/AI.
7. Progressive collision damage and reset; rewind replay before and after damage, AI overtake, weather transition and relevant Signature Feature.
8. Three distinct replay cameras; timeline seek, pause, repeat, leave/reopen without simulation bleeding; local library export/import and five-entry cap.
9. Four car selections remain distinct in race, garage and replay; camera and audio cues are physically coherent.
10. Photo Mode freeze/camera/exposure/hide UI/capture/exit without changing competitive state or replays.
11. Original Signature Features 1, 2 and 3 independently triggered in actual gameplay/UI and verified with their real side effects.
12. High/Medium/Low comparison under comparable conditions, FPS observation with known hardware where available, loss/fallback behavior.
13. Keyboard remap, focus/reduced motion, gamepad if supported, bad input/replay, denial of storage and concurrent replay editing.
14. Full lifecycle: replay→garage→race→quit→race repeatedly, ensuring no duplicated render/audio systems or stale background updates.

**Evidence taxonomy** for every claim: **direct manual browser interaction**, **automated browser interaction**, **isolated deterministic harness**, **logic/unit only**, or **not verified**. Name the actual path used. A harness is allowed for long races and fault injection but may not fake human testing or prepopulate the user's permanent records. The tool may simulate multiple normal fixed-delta steps per frame; it must never enlarge `dt` to sprint through a race.

**Visual proof is non-optional for a claim of finished photoreal visuals.** If no usable graphics-capable browser preview is available, produce a truthful unverified/partial handoff rather than assert “photoreal verified”. A build that compiles, or tests that only check DOM text, do not verify the game’s imagery.

## 56. Adversarial probes tailored to high-complexity V3

Actively try to break integration without altering unrelated user data:

- **Render/simulation:** Run at 30/60/uncapped render frame rates, change resolution scale mid-race, hide tab for a while and return, trigger graphics context loss when safe, resize at night with rain and six cars. Timers, AI and physics must remain coherent.
- **Visual quality:** Stop the car at a coastline, a garage close-up and a town landmark; hide HUD and inspect normals/materials/light. Quality should not evaporate outside the introductory camera or at low speed.
- **Four-car consistency:** Swap cars during setup and replay, use all four through a controlled corner and compare real handling. A hidden “identical physics for every vehicle” shortcut is unacceptable.
- **AI/collisions:** Force a narrow road pass, a wet braking zone, stuck opponent recovery, close checkpoint positions and route reversal. No invulnerable ghosting, impossible AI classification, or indefinite deadlock.
- **Weather/visual coupling:** Transition sunny→rain while standing still and while driving; inspect water, asphalt, lighting, spray, tires and AI braking. Rain must not only be a screen effect.
- **Replay/event history:** Seek backward/forward through damage, nitro, drift, AI pass, light transitions, photo-mode entry and each feature's gameplay effect. Historical HUD and world state must be stable no matter how often or in which direction the timeline is scrubbed.
- **Persistence/security:** Import oversized/truncated/version-mismatched or maliciously shaped replay metadata, attempt concurrent writes at capacity, and test denied quota. No HTML injection, code execution, silent saved-data loss or false records.
- **Visual tradeoffs:** Change High→Low→High and compare scene/pixel results; ensure textures, objects, effects and resource lifecycle behave honestly. A dormant UI selection without actual renderer changes fails.
- **Photo and inputs:** Trigger pause/photos/replay while driving, mash buttons, switch focused elements, activate reduced-motion and gamepad input. Race state must not advance or stick incorrectly.
- **Signature isolation:** Disable one feature via its documented operation if user-facing, or reach its edge case without breaking the others. Verify all three produce independent real outcomes. If a feature touches gameplay, its replay and reset logic must work.
- **Offline delivery:** Disable internet after dependency build on a local static server and reload, navigate modes, view saved replays and use all bundled assets. No runtime dependency on a CDN or telemetry service.
- **Quality under load:** Run all five rivals while rain, dense vegetation, headlights and world animations are present, then open and exit a replay repeatedly. Check long-running stutter, textures not loading and memory/resource leaks.

Report failures as failures and include remediation or limitation; do not disguise unfinished work as an unsupported environment issue unless the limitation is reproducible and genuine.

## 57. Hard completion gates and unacceptable substitution

These gates are **binary observations**, not AI-model scores. No weighting, ranking, grade, or badge assigned to models. A complete V3.0 submission must satisfy ALL mandatory gate families:

**G1 — Real playable product:** a launchable, offline-capable 3D desktop-browser game with real input, movement, routes, start/finish and results in all three dedicated modes; no fake menu-only prototype.

**G2 — Photoreal visual floor:** screenshots and actual gameplay demonstrate credible original car geometry; detailed textured/materially varied road/land/vegetation/buildings; sunlight and cast shadows; coherent sky/atmosphere; reflective moving ocean; noninvasive HUD; meaningful mood in day/rain/night. Primitive-final scenes do not pass.

**G3 — Vehicle and physics floor:** four original vehicles all functional and differentiated; grounded wheel/suspension/body dynamics, weather/surface grip, braking, nitro/drift, damage, recovery and audible feedback.

**G4 — Race correctness:** three Time Trial laps and personal-best authenticity, three-lap AI race with five simultaneous rivals at fixed difficulty, complete time-pressure Checkpoint Run with progression and anti-exploits.

**G5 — World simulation:** weather and continuous day/night drive actual rendering, world and vehicle/AI response; start presets are real and evolution is observable.

**G6 — Three original advanced features:** at least three distinct functional, integrated Signature Features with their own live demonstrations and correct replay/reset behavior where relevant; no complexity ceiling, no replacement of core obligations.

**G7 — Media and replay:** proper photo mode, three replay cameras, truthful seek/rewind/weather/damage/AI events, no invented results, local library of at most five, safe export/import and truthful persistence.

**G8 — Production UI/accessibility:** coherent garage/menu/HUD/settings, full driving remap, reasonable reduced motion, mute, actual graphics presets, quality-aware resizing and keyboard/gamepad accessibility as supported.

**G9 — Execution/performance:** a production static build, no external gameplay dependency, correctly licensed bundled assets, no database, no external agents or code copying; 1080p/60 target measured when hardware is available and not falsely asserted otherwise.

**G10 — Proof:** genuine browser interactions and actual rendered screenshot collection, explicit distinction of manual/automated/harness tests, honest notes on untested subsystems and real limitations.

A failure in one mandatory family must be disclosed and cannot be compensated by success in another. **Complexity is not a substitute for completeness**, and a fully implemented but visually crude racer is not complete. Likewise a screenshot-perfect but unplayable scene is not complete.

If tool, time or hardware constraints prevent compliance, preserve a working artifact and truthfully describe gaps. Do not weaken gates by relabeling mandatory features optional, inventing test results, invoking prohibited external AI assets, copying a prebuilt game, skipping necessary browser visual inspection or hiding the lack of a functioning race.

## 58. Production handoff format and source integrity

Deliver the complete project under the assigned root with `README.md`, runnable `dev`, `build`, `preview`, `test` commands where applicable, dependency lockfile, bundled runtime assets, third-party asset/license notes and a genuinely working static output. Avoid leaving dev-only mock modes accessible from normal production UI. Do not require external services, authentication, a database or project assembly by the user.

**Short design/handoff notes:**
- Engine/framework and browser/rendering method actually used, with explicit WebGL 2 baseline and any working WebGPU fallback.
- Environment and quality preset tested, performance facts with the precise measurement context or “not measured”.
- The four authored vehicles with distinguishing *real* physics and visual traits, three courses and gameplay modes.
- The three (or more) independently conceived Signature Features and their distinct player-facing purposes, integration points and test observations.
- Exact rendering/material/lighting/reflection/water techniques used, with effects missing or approximated honestly.
- Required photo and replay behavior, recording format and local storage fallback.
- True asset origin and permission/attribution details; distinguish original procedural assets from licensed generic ones.
- Structured checklist for **implemented + browser-verified / implemented + logic-tested / implemented but unverified / partial / missing**, with one concrete evidence reference per mandatory subsystem; no scores/ratings of AI models.
- Real frame captures/links or clearly stated absence, plus reasons for unverified browser journeys.
- Running and navigating the game without a live internet connection once packaged.
- Limitations discovered, not a marketing narrative claiming everything is perfect.

**Version discipline:** V3 is a distinct historical benchmark version. Do not alter or replace the old V2.6 prompt, archived source snapshots, benchmark runs or original evidence. If the V3.0 specification receives material revisions after contestant runs begin, record a new exact version and attach the same instructions to all relevant contestants rather than silently changing acceptance terms mid-run. Gemini's reviewer context is a separate offline planning artifact and **must never act as a hidden runner prompt**.

**Authority and permissions:** The brief does not authorize git commits, push, pull requests, merge, publication, deployments or changes outside the assigned workspace. Tool-operation skills can be used for browser/build/tests of this project only. Follow mandatory platform rules.

## 59. Final acceptance walk-through, representative failure modes and completion language

Before final submission, actually launch a production preview and walk through this sequence as a player would:
1. See meaningful car and landscape immediately, not a title card hiding an empty world.
2. Enter garage and inspect *all four* cars from multiple angles. Their materials, lights, glass and tire geometry must withstand close-up viewing.
3. Select a course, start weather/time preset, choose a car and complete a true race countdown.
4. Drive Coastal Sprint three consecutive laps and record correct valid/invalid results.
5. Race Riviera against five visible rivals with sensible AI, three laps, no rubber-banding, valid placement and actual collision consequences.
6. Complete or genuinely fail the full Horizon Rush checkpoint/time route and observe score/combos linked to real driving.
7. Toggle nitro/drift, trigger weather/wetness/grip/lighting changes, and see credible suspension/weight transfer and damage.
8. Activate all three independently conceived Signature Features through real user controls and confirm actual distinct effects.
9. Enter and leave photo mode without changing any race clock/progress or replay data, and capture a real screenshot.
10. Replay the completed or failed run, use three different camera views, seek backward across impacts/weather/AI events, preserve historical HUD.
11. Save, export, import, reopen and test replay capacity of five; try a rejected invalid file and denied persistence.
12. Toggle graphics presets; check High is visibly rich and Low is visibly lighter while physics/records remain correct.
13. Review daylight, sunset, night and rain screenshots at a stopped point and while driving. Reject final low-poly/blockout artifacts, flat textures, absent sunlight or intrusive UI.
14. Inspect representative browser logs, video/GPU/frame time and resource cleanup where tools permit, and document tested vs untested claims.

**Examples that MUST NOT be called “complete”:** beautiful splash screen but flat gameplay; a screenshot of the car on a fake static road; visually rich vehicles but broken race progression; all three modes as renamed copies of one loop; one AI opponent visually duplicated five times; three “Signature Features” that are existing required mechanics; a photo mode lacking a real capture; a replay that ignores damage or changes state when scrubbing; local-storage toast without durable recording; screenshots copied from render references instead of the game; a claim of 60 FPS with no measured GPU/browser; a pristine README with no working static build.

The intended finish is a **premium, camera-worthy, mechanically substantial, fully interactive racing game**. Missing any required component remains a reported deficiency even when another feature is exceptional. The artifact, tests and screenshots must support what the final handoff says.
