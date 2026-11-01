# Racing-bench V3.0 — Gemini-only adversarial specification review context

**Audience:** Gemini, acting as the **sole external reviewer of the benchmark specification**. This is an editorial review brief, **not** a game implementation prompt, not an additional requirement to give contestants, and not an invitation to use other AI agents. **Do not send this file to benchmark runners.** The full, frozen V3.0 runner prompt is in [Racing-bench-v3.0-prompt.md](./Racing-bench-v3.0-prompt.md). The historical V2.6 prompt and its operational-tools addendum are preserved independently.

**Requested output:** an actionable, high-effort, skeptical review of the V3.0 prompt that identifies loopholes, contradictions, unverifiable demands, accidental simplifications and opportunities to raise fidelity without destroying executability. Prioritize concrete replacement language and enforceable invariants over applause or general advice. Review the **prompt**, not any participant, AI-company capability, ranking or measured game quality. Do **not** implement the game.

## 1. Why this redesign exists

V2.6 already required a real 3D coastal racer with three dedicated modes/courses, multiple selectable cars, six-car competition, local AI, nitro/drift, variable weather and daylight, visual collision damage, accurate replay with three camera views, a five-entry local replay library, file export/import and technical clean-room isolation. Nonetheless multiple independent model runs produced results that looked visibly unfinished.

A representative actual browser screenshot showed a large rectangular coastal start gate covering the sky, a rudimentary boxlike player car, low-detail repeated foliage, simplified terrain, uniform road/ground materials, muted flat lighting, a weakly differentiated water surface and an oversized starting overlay. This visually failed the user's concept of a premium photoreal coastal racer. A colorful sky, a large track and a functioning countdown did not compensate for lacking believable assets and direct sun/shadow/light response.

**Diagnosis, not proof:** The specifications appeared to reward feature checklists and allowed stylized/procedural primitives where the user had actually wanted far greater realism. This does **not** prove the prompt was the sole cause of each poor execution or that any named model is intrinsically incapable. Review whether V3.0 truly closes that gap while remaining executable.

## 2. Frozen user decisions

Treat these as owner decisions, not open questions for you to relax without strong justification:

| Dimension | V3.0 decision |
| --- | --- |
| Target | Photoreal, cinematic, premium AAA-*inspired* browser racing vertical slice; no false claim of commercial AAA parity |
| Courses | 3 independent complete authored courses: Coastal Sprint, Riviera Grand Prix, Horizon Rush |
| Modes | 3 complete modes: three-lap Time Trial, three-lap Race vs five AI, time-pressure Checkpoint Run |
| Vehicles | **At least 4** original, differentiated high-quality playable vehicles; no downloaded full car models |
| Visual pipeline | PBR/material and texture richness, sunlight/shadows, reflection, restrained post, volumetric-looking atmosphere, ocean fidelity |
| World | Dense authored coastline, varied terrain/vegetation/architecture, ambient living detail |
| Climate | Real dynamic weather plus a real evolving day/night cycle, coupled to visuals, physics, AI and replay |
| Gameplay | Substantial physical handling, wet grip, drift/nitro, collisions/recovery, accumulated damage, five competent AI |
| Media | Photo mode, real replay with three cameras, real event/seek fidelity, five saved local recordings and safe export/import |
| Audio/UI | Responsive engine/environment audio, cinematic camera, premium legible HUD and menus |
| Performance | 1920×1080/60 FPS **target**, not an unverified guarantee; real Low/Medium/High workload/fidelity differences |
| Accessibility | Real keyboard remapping, reduced motion, usable menus, gamepad where possible |
| Original features | **At least THREE separately conceived Signature Features**, not 1; **10/10 ambition**, **NO ceiling** on complexity or number of extras |
| Optional only | Cockpit camera; it must not be silently turned into a mandatory deliverable |
| Asset policy | Authored/procedural content plus legitimately licensed, locally bundled generic supporting assets; documented provenance |
| Clean room | No other projects, code examples, saved memory, other AI systems, external generated media, private accounts or related solutions |
| Tool access | Browser, Playwright, DevTools, screenshots, test/build tools and their minimal operational `SKILL.md` instructions **are allowed**; no blanket ban |
| Outcome documentation | Honest observed functionality and screenshots, no grades/rankings/scores of models |
| Delivery authority | Runner only builds locally; no git commits/push/deploy unless separately authorized |
| Versioning | V2.6 remains immutable and V3.0 must not be silently substituted into ongoing V2.6 executions |

**Important nuance:** “No complexity ceiling” means the old 7/10 cap is lifted and expansion is encouraged. It does **not** make time/resources infinite, allow useless feature inflation, relax visual quality or excuse broken mandatory systems. Gemini should review how V3.0 expresses this distinction.

## 3. Priority questions for your adversarial review

### P0 — Potentially invalid benchmark, systemic loophole or contradictory contract

1. **Photorealism enforceability.** Can a strong but opportunistic implementation still ship low-poly box cars, a flat sky/road, low-detail trees, uninteresting coast and oversized UI while technically arguing compliance? Identify exact loopholes. What objective, observable screenshot or gameplay requirement would close them without forcing one renderer/engine?
2. **Visual versus breadth collision.** Does demanding three modes, four cars, dynamic weather+day/night, elaborate rendering, photo mode, full replay, five AI and three arbitrary-complexity features practically guarantee another visually poor result? Propose a stronger sequencing/quality-gate design that protects the visual floor without secretly reducing scope.
3. **Conflated priorities.** Are any clauses simultaneously saying “prioritize visuals” and “prioritize functionality” without a clear escalation order? Should the prompt explicitly forbid declaring the art pass complete based only on technical code/tests? Suggest replacements.
4. **Three signature features.** Can the model cheat by relabeling nitro, drift, damage, weather, camera, photo mode, replay or one feature's three screens as three features? Examine the independence proof, test witnesses, replay state and no-limit language.
5. **Performance contradiction.** Is 1080p/60 FPS enforceable fairly across unknown execution environments? Ensure it is a measurable named-hardware target with honest unverified fallback, not an invitation to degrade the High-quality world or lie about performance.
6. **Browser skill access.** Does any leftover V2.6 blanket skills ban conflict with V3's explicit permission for browser automation or necessary operating manuals? Ensure the hierarchy is unambiguous, no hidden Gemini/agent instructions are required by runners, and no private workspace is unlocked.
7. **Replay physics and photo mode.** Could a replay merely play a scripted car camera while falsely claiming true state history? Does Photo Mode actually freeze timers/physics and leave recordings unchanged? Does multiple Signature Feature state remain correct through seek/reset?
8. **Data integrity and security.** Ensure no database remains permitted (including IndexedDB), no runtime network/private sources, malicious import/expanded-size protections, five-record capacity, user-authorized replacement and no imported personal-best records.
9. **Definition of done.** Are gates demonstrable, or do they rely on subjective praise? No numeric AI-model scoring or ordinal comparisons; “pass / partial / not verified” is for the artifact's implementation evidence, not grades of AI systems.

### P1 — Quality and test-design weaknesses

- **Cars:** Are four original vehicle bodies physically/visually differentiated enough to survive close-up inspection? Must original car models be project-authored versus permitting general-purpose modeling tools and generic licensed textures?
- **Materials:** Would a constant-color metallic/roughness shader technically count as “PBR”? Are sun shadows, wet roughness, normals, road wear and water appearance stated in a way that rejects fake screen overlays?
- **Coastal art:** Are geographic depth, hero landmarks, architecture, multiple depth planes and ocean-water optical qualities auditable in actual driving screenshots?
- **Day/night/rain:** Can color-changing skybox plus fog particle spam slip through while actual lighting, shadows, tire friction and AI braking remain static?
- **Camera/HUD:** Can a giant starting gate obscure the view while passing UI-focused checklist items? Check limits on screen obstruction without arbitrary pixel percentages.
- **AI:** Does the prompt distinguish five genuinely acting rivals from splined impostors, and prevent position-dependent rubber-banding?
- **Replays:** What minimal event/state recording is needed to cover weather, damage, AI, nitro, lap validity and three extra features? Are three camera views genuinely distinct?
- **Evidence:** Can a model fabricate passing claims by storing a dozen screenshots of a handcrafted static scene, or by counting harness-driven scripts as direct human gameplay?
- **Licensing:** Could unknown image references be treated as free textures? Does the prompt explicitly require proven licenses before bundling third-party generic assets, and prohibit external generative-AI asset services?
- **Fallbacks:** Are browser context loss, WebGL2 baseline, WebGPU optional path, OPFS/storage availability and headless/software-renderer performance honestly handled?
- **Complexity:** Are there redundant prescriptions or numerical targets that increase verbosity rather than improve actual results? Flag any mandatory “implementation theater.”

### P2 — Editorial, clarity and practical improvements

- Identify repeated sections or inherited V2.6 text that the V3 appendices make confusing.
- Point out terms that should be defined, such as “photoreal,” “physically based,” “cinematic,” “full replay,” “original model,” “current state” and “browser-verified.”
- Suggest a more readable order if it substantially reduces model misinterpretation without losing rigor.
- Check whether the required artifacts and file paths are unambiguous for a clean-room runner.
- Recommend better representative browser journeys and adversarial tests that actually distinguish a premium racer from a passable but crude demo.
- Check if the user-facing UI/garage promises are consistent with the absence of a mandatory cockpit camera.
- Make sure there is no accidentally duplicated “three cars” or “one Signature Feature capped at 7/10” leftover from the historical V2.6 prompt.

## 4. Design challenge: complexity without forfeiting cinematography

Propose refinements that would force models to behave as though they are producing a polished studio vertical slice, **not** a sprawling collection of toy-level tech demos.

We want both a **heavy technical scope** and a **hard visual finish bar**. Do not recommend dropping important systems merely to make the test easier. If you find that an arbitrary requirement is counterproductive, offer a precise *replacement* that increases the probability of a finished and attractive game while retaining the intended skill challenge.

Suggested questions to answer:
- Which initial browser captures should be required **before** a model expands the mode and feature checklist?
- Which art-direction commitments must stay stable across all three courses and all four cars?
- Which lighting/material failures are easiest for an agent to fake?
- How can a reviewer prove three extra features are truly independent without assigning AI model scores?
- What tests catch broken photo-mode pauses, imported replay exploits and weather material/physics desynchronization?
- What instruction would best prevent placing “final polish” at the end when the agent might run out of time?

## 5. Requested review method

1. Read the **entire** V3.0 file. Use its actual section numbers and exact statements, not an imagined generic racing benchmark.
2. Build a concise **requirements map**: visual, world, cars, physics/AI, mode logic, media/replay, signature features, technical/privacy and validation. Identify missing or conflicting obligations.
3. Perform a hostile “how would a model pass without doing real work?” red-team review and enumerate the most credible workarounds.
4. Assign **P0/P1/P2 priority to prompt defects only**, based on severity and demonstrability. These are editorial priorities, **not ratings or grades for AI models**.
5. For each P0/P1 issue, provide the exact clause/heading, an explanation of the potential failed outcome, and **copy-paste replacement wording in English**.
6. Propose at least **five adversarial visual acceptance journeys** and **five state/integration journeys** with observable success/failure evidence, without arbitrary scores.
7. Explicitly check the old 7/10 ceiling and single-feature relics are gone, four cars remain required, cockpit camera stays optional, and browser-operational skills are allowed.
8. Finish with a direct editorial verdict: **READY FOR OWNER REVIEW** or **NEEDS REVISION**, followed by a short prioritized change list. This is about readiness of the *prompt* for review, not passing/grade of any model.

## 6. Hard boundaries for Gemini's response

- **You are reviewing a benchmark prompt, not executing it.** Do not build game code, download/copy racing game implementations, or alter any contestant's project.
- Do not consult Claude or involve another AI agent. The owner requested a **Gemini-only specification review**.
- Do not access personal context, account data, other projects, histories or external model output to construct judgments.
- Do not fabricate measurements, runtime tests, licenses or screenshot evidence; none of these are verified merely by reading the prompt.
- Do not suggest AI-generated textures/3D/video/audio assets to the runner; clean-room prohibitions remain.
- Do not turn the work into comparative AI-model scoring or a benchmark leaderboard.
- Do not silently rewrite the archived V2.6 document.
- Do not automatically commit, push, merge or deploy; any follow-up edits to V3.0 are proposals for the owner to approve.
- Any technical claim about a renderer/library/browser that depends on version or platform should be labeled as needing verification, not asserted as universal.

## 7. Preferred response template

**Executive defect summary:** strongest 3–5 issues and why each matters.

**P0:** defects that could allow visually crude, nonfunctional, unfair, insecure or contradictory submission despite apparent prompt compliance. Include section references and exact fixes.

**P1:** material quality/engineering ambiguity, testability issues and feature-integration risk. Include exact fixes.

**P2:** wording/organization/efficiency improvements.

**Concrete replacements:** ready-to-insert English clauses grouped by target V3.0 section.

**Review journeys:** browser-visual and systems/state journey descriptions, each with specific observable evidence.

**Cross-version consistency check:** V2.6 frozen, V3.0 standalone, runner's skills permission, three advanced features, four cars, 3 courses/modes, five rivals, no mandatory cockpit, no AI scores.

**Verdict and next actions:** short, practical and explicit.

The owner wants ambitious, honest, demanding specifications, not generic compliments. If you believe some requirement is unrealistic or encourages surface-level demos, say so and provide a superior alternative—**without quietly relaxing the high visual bar**.
