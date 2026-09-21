# Solar System benchmark scorecard

> Status: Four frontier references are in the current arena. Astra Max and Fable 5.1 have complete preliminary weighted evaluations; Gemini 3.8 Flash High is pending hands-on scoring, while Grok 4.7 Solar is source-pinned and unevaluated.

## Current arena

| Model | Effort | Snapshot / source | Prompt | Evaluation state |
| --- | --- | --- | --- | --- |
| GPT-6 Astra Max | Max | `fca2ef51…` | [`frontier-v2.md`](../prompts/frontier-v2.md) | Preliminary scored |
| Grok 4.7 Solar | Source-pinned | commit `bcb1e820…` | — | **Pending source review** |
| Fable 5.1 | **Max** | `7e079669e41b…` | [`frontier-v2.md`](../prompts/frontier-v2.md) | Preliminary scored |
| Gemini 3.8 Flash | **High** | source commit `805cfe87a…` | [`frontier-v2.md`](../prompts/frontier-v2.md) | **Pending evaluation** |

The current arena mixes scored Frontier V2 runs with source-pinned references. Grok 4.7 Solar has no archived prompt provenance and is not numerically ranked.

Reasoning labels are recorded as run metadata and are not normalized across vendors. Fable 5.1 is the Max run; Gemini 3.8 Flash is the High run.

<details>
<summary><strong>Historical baseline</strong></summary>

GPT-5.6 Sun Max V1 (`67eb9fc…`) is preserved for prompt-leverage analysis, but it is excluded from the current weighted Frontier V2 arena because it used `sun-original.md`.

</details>

## Non-frontier or outdated models

| Model | Classification | Provenance | Evaluation state |
| --- | --- | --- | --- |
| GPT-5.6 Sun Max V2 | Outdated frontier run | commit `93d43ae…` | Historical preliminary score: **71.2/100** |
| GPT-5.6 Luna Max | Non-frontier | source commit `5fdc036884…` in `bielxdh3/orbitario-luna` | Not in main ranking |
| Grok 4.6 | Archived frontier run | archive SHA-256 `5d77eeb509…` | Historical score: **33.8/100** |

Sun Max V2 remains fully documented below as a historical scored run. Luna Max is source-pinned only and has no main-arena score.

## Scoring scale

Each dimension is rated from **0 to 10**. Decimal ratings are allowed to preserve the evaluator's intended precision. The rating is then converted into weighted points:

`weighted points = (rating / 10) × dimension weight`

Required benchmark behavior drives **Feature completeness**. Optional extras can improve polish or help in a tie-break, but they do not compensate for missing core requirements and cannot push a category above its maximum weight.

Cells show the raw 0–10 rating followed by the weighted contribution.

> ***AVALIAÇÃO PESSOAL NÃO 100% CONFIÁVEL E NÃO PROFUNDA SUFICIENTE.*** As notas atuais dos quatro modelos já pontuados foram feitas principalmente por **um único usuário**, em **poucos dispositivos/ambientes**, e carregam inevitavelmente **viés pessoal e subjetividade**. Elas devem ser tratadas como avaliações preliminares, não como medições definitivas ou revisões profissionais exaustivas.

## Weighted score — currently scored contenders

Grok 4.7 Solar and Gemini 3.8 Flash High are intentionally excluded from the numeric table until comparable hands-on evaluation is performed. **Pending is not zero** and does not affect the existing ordering.

| Dimension | Weight | Astra Max | Grok 4.6 XHIGH | Fable 5.1 Max |
| --- | ---: | ---: | ---: | ---: |
| Feature completeness | 20 | **9.6/10 → 19.2/20** | **1.0/10 → 2.0/20** | **10/10 → 20/20** |
| Interaction / UX | 15 | **9.8/10 → 14.7/15** | **0.3/10 → 0.45/15** | **10/10 → 15/15** |
| Visual execution | 15 | **9.7/10 → 14.55/15** | **1.1/10 → 1.65/15** | **9.9/10 → 14.85/15** |
| Scientific / simulation fidelity | 15 | **10/10 → 15/15** | **5.0/10 → 7.5/15** | **10/10 → 15/15** |
| Robustness | 10 | **9/10 → 9/10** | **2.0/10 → 2.0/10** | **5.0/10 → 5.0/10** |
| Performance | 10 | **9.3/10 → 9.3/10** | **8.0/10 → 8.0/10** | **10/10 → 10/10** |
| Code / architecture | 10 | **9.2/10 → 9.2/10*** | **8.7/10 → 8.7/10*** | **9.1/10 → 9.1/10*** |
| Accessibility / responsive behavior | 5 | **8.6/10 → 4.3/5** | **7.0/10 → 3.5/5** | **8.7/10 → 4.35/5** |
| **Total** | **100** | **95.25/100** | **33.8/100** | **93.3/100** |

\* `Code / architecture` uses provisional technical evaluator scores rather than user-entered hands-on ratings. Astra Max scores **9.2/10**: its implementation is split across dedicated data, model, scene, materials, tools, UI, content and storage modules and includes multiple automated test/acceptance/recovery/control paths; some major modules remain relatively large, so the architecture is strong rather than perfect. Grok 4.6 XHIGH scores **8.7/10**: its TypeScript implementation is cleanly separated across core, data, rendering, simulation, state and UI layers, but `ui/app.ts` still concentrates a substantial amount of logic and its automated test coverage is more limited than Astra's. Fable 5.1 Max scores **9.1/10**: it has a strong TypeScript/Preact modular split across app, content, data, i18n, rendering and simulation layers, plus dedicated Vitest coverage; however, some renderer/controller modules remain large and its automated validation surface is less extensive than Astra's.

### Historical scored run — Sun Max V2

The Sun Max V2 user-entered ratings currently recorded are: Feature completeness **8.6/10**, Interaction / UX **8.0/10**, Visual execution **6.0/10**, Scientific / simulation fidelity **4.0/10**, Robustness **8.0/10**, Performance **7.5/10**, and Accessibility / responsive behavior **7.0/10**. `Code / architecture` is evaluator-provisional.

The Astra Max user-entered ratings currently recorded are: Feature completeness **9.6/10**, Interaction / UX **9.8/10**, Visual execution **9.7/10**, Scientific / simulation fidelity **10/10**, Robustness **10/10**, Performance **9.3/10**, and Accessibility / responsive behavior **8.6/10**. `Code / architecture` is evaluator-provisional.

The Grok 4.6 XHIGH user-entered ratings currently recorded are: Feature completeness **1.0/10**, Interaction / UX **0.3/10**, Visual execution **1.1/10**, Scientific / simulation fidelity **5.0/10**, Robustness **2.0/10**, Performance **8.0/10**, and Accessibility / responsive behavior **7.0/10**. `Code / architecture` is evaluator-provisional at **8.7/10**.

> **Feature completeness note — Grok 4.6 XHIGH:** some requested features were technically implemented, but many were delivered in a lazy, broken or loophole-driven way that satisfied the wording of parts of the prompt without delivering the intended behavior well. Those implementations therefore received heavy penalties rather than full credit merely for existing.

The Fable 5.1 Max user-entered ratings currently recorded are: Feature completeness **10/10**, Interaction / UX **10/10**, Visual execution **9.9/10**, Scientific / simulation fidelity **10/10**, Robustness **5.0/10**, Performance **10/10**, and Accessibility / responsive behavior **8.7/10**. `Code / architecture` is evaluator-provisional at **9.1/10**. The Robustness score was reduced because basic behaviors broke during hands-on use despite the otherwise very strong result.

## Evidence checklist

### First-run experience
- visually strong initial state
- onboarding is understandable
- no broken or placeholder UI
- important actions are discoverable

### Solar System scene
- Sun and eight planets are present
- Earth–Moon hierarchy behaves coherently
- Saturn's rings remain attached/oriented correctly
- orbit visualization does not overwhelm the scene
- labels remain useful at different distances

### Simulation
- pause / resume
- reverse time
- multiple time rates
- high-speed behavior remains stable
- reset behavior is deterministic
- orbital state does not visibly break after time changes

### Camera
- orbit / rotate
- zoom
- pan where supported
- object selection
- smooth travel/focus
- follow moving body
- return to overview

### Information architecture
- searchable object navigation
- body details
- comparison mode
- guided tour
- scientific caveats / model explanation

### Responsive and access
- desktop
- tablet / medium viewport
- mobile portrait
- short landscape viewport
- keyboard navigation
- visible focus
- reduced-motion behavior where relevant

### Reliability
- no runtime errors during core flow
- no severe console errors
- fallback behavior is sensible
- local persistence does not corrupt the app
- export/download features, if present, produce valid data

## Prompt-specific acceptance expansion

The Frontier V2 evaluator should additionally verify:

- curated moons, dwarf planets, small bodies, asteroid belt, Kuiper Belt and outer-system context;
- deterministic clock semantics, date validity boundaries and approximate orbital model transparency;
- physical-vs-display coordinate separation;
- scale laboratory, measurement tools, seasons, Moon phases/eclipses and hypothetical orbit laboratory;
- reference frames, orientation map and motion trails;
- mission-history layer, multiple guided tours and at least twelve learning activities;
- glossary/encyclopedia, favorites, journal, bookmarks and saved viewpoints;
- photography/capture behavior and local export/import boundaries;
- Portuguese/English localization, keyboard ownership, reduced motion and responsive layouts;
- loading/recovery paths, resource behavior and integrated restoration scenarios.

A feature receives credit only when the requested behavior is actually present and supported by evidence.

## Qualitative verdict

### GPT-5.6 Sun Max — V2
**Strengths:** quantitative preliminary evaluation complete; qualitative summary pending

**Weaknesses:** qualitative summary pending

**Critical defects:** pending qualitative evaluation

### GPT-6 Astra Max
**Strengths:** exceptional completeness, scientific fidelity, robustness and overall polish

**Weaknesses:** small deductions in feature completeness, visual execution, performance and responsive/access behavior

**Critical defects:** no major critical defect recorded in the preliminary hands-on evaluation

### Grok 4.6 — XHIGH
**Strengths:** good raw performance and relatively solid underlying code organization

**Weaknesses:** very poor interaction/UX and visual execution; major feature-completeness penalties for shallow, broken or loophole-driven implementations

**Critical defects:** qualitative defect inventory still pending

### Fable 5.1 — Max
**Strengths:** complete feature set, excellent interaction/UX, visual execution, scientific fidelity and performance

**Weaknesses:** robustness was materially reduced by basic behaviors breaking during hands-on use; responsive/access behavior was also below its strongest categories

**Critical defects:** basic breakages materially affected robustness despite the very high overall score

### Gemini 3.8 Flash — High
**Evaluation state:** pending hands-on scoring under the same Frontier V2 rubric.

**Source:** pinned to `bielxdh3/gemini` commit `805cfe87a6b4dcc64961130d4f9d2738f1005790`.

No numeric or qualitative verdict is assigned before the run is evaluated.

## Current scored ranking

Among contenders with completed preliminary scores: **1. Astra Max — 95.25/100**, **2. Fable 5.1 Max — 93.3/100**, **3. Sun Max V2 — 71.2/100**, **4. Grok 4.6 XHIGH — 33.8/100**. **Grok 4.7 Solar and Gemini 3.8 Flash High are pending and are not ranked yet.**
