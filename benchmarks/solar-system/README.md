<div align="center">

# Solar System / Orbitarium Benchmark

**Frontier Models · complete-product generation benchmark**

`3D / Canvas` · `simulation` · `product design` · `scientific honesty` · `responsive UX` · `robustness`

[![Português (Brasil)](https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-2563EB?style=for-the-badge)](./README-PT-BR.md)

</div>

## ⚔️ Current Frontier V2 arena

| Model | Effort | Live project | Snapshot / source |
| --- | --- | --- | --- |
| ✦ **GPT-6 Astra Max** | Max | [Open Astra](https://gpt-6-astra.biel.dev.br) | `fca2ef51b4…` |
| 𝕏 **Grok 4.6** | **XHIGH** | [Open Grok 4.6](https://grok-4-6-solar-system.vercel.app) | archive `5d77eeb509…` |
| ◆ **Fable 5.1** | **Max** | [Open Fable 5.1](https://fable-solar-system.vercel.app) | `7e079669e41b…` |
| ◈ **Gemini 3.8 Flash** | **High** | [Open Gemini 3.8 Flash](https://gemini-3.8-flash.biel.dev.br) | source commit `805cfe87a…` |

All four current contenders use the exact same [`frontier-v2.md`](./prompts/frontier-v2.md) input.

> Reasoning labels are preserved exactly as run metadata. `Max`, `XHIGH` and `High` are vendor/run settings and are not treated as directly equivalent compute scales.

## 🗂️ Non-frontier or outdated models

These projects remain visible, but they are outside the current frontier arena and are not shown in the main hero or ranking.

| Model | Classification | Project / source | Provenance | Score status |
| --- | --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sun Max V2** | Outdated frontier run | [Open Sun V2](https://gpt-5.6-sun-v2.biel.dev.br) | commit `93d43ae62f…` · [`runs/gpt-5.6-sun-max/rebuild`](./runs/gpt-5.6-sun-max/rebuild/) | **71.20/100** historical |
| 🌙 **GPT-5.6 Luna Max** | Non-frontier | [Source repository](https://github.com/bielxdh3/orbitario-luna) | source commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) | Not in main ranking |

Luna Max is source-pinned only for now; its prompt provenance is not archived here.

<details>
<summary><strong>Historical baseline — GPT-5.6 Sun Max V1</strong></summary>

GPT-5.6 Sun Max V1 is preserved only for prompt-leverage history. It is deliberately excluded from the current arena because it used [`sun-original.md`](./prompts/sun-original.md), not Frontier V2.

- [Open Sun V1](https://gpt-5.6-sun-v1.biel.dev.br)
- Snapshot: `67eb9fc51f…`
- Archive: [`runs/gpt-5.6-sun-max/original`](./runs/gpt-5.6-sun-max/original/)

</details>

## What this benchmark tests

The task asks a model to turn a dense product specification into a complete browser-based Solar System experience rather than a thin demo. It stresses interpretation of the specification, visual/product judgment, orbital and time state, nested systems such as Earth–Moon, camera/navigation, scale and measurement tools, performance, reliability, accessibility, scientific honesty and validation.

## Shared Frontier V2 input

```text
SHA-256  7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65
Size     115,983 bytes
Lines    1,153
```

## Run map

| Run | Model | Prompt | Provenance | Arena |
| --- | --- | --- | --- | --- |
| Historical baseline | GPT-5.6 Sun Max V1 | `sun-original.md` | commit `67eb9fc51f…` | hidden |
| Frontier V2 | GPT-5.6 Sun Max | `frontier-v2.md` | commit `93d43ae62f…` | non-frontier / outdated |
| Source-pinned reference | GPT-5.6 Luna Max | not archived here | source commit `5fdc036884…` | non-frontier |
| Frontier V2 | GPT-6 Astra Max | `frontier-v2.md` | commit `fca2ef51b4…` | current |
| Frontier V2 / XHIGH | Grok 4.6 | `frontier-v2.md` | archive SHA-256 `5d77eeb509…` | current |
| Frontier V2 / Max | Fable 5.1 | `frontier-v2.md` | commit `7e079669e41b…` | current |
| Frontier V2 / High | Gemini 3.8 Flash | `frontier-v2.md` | source commit `805cfe87a…` | current |

Machine-readable provenance lives in [`RUNS.json`](./RUNS.json). Gemini's detailed source record is in [`GEMINI-3.8-FLASH-PROVENANCE.md`](./GEMINI-3.8-FLASH-PROVENANCE.md).

## Frontier V2 scores

> **Preliminary evaluation:** the scores are mainly based on one evaluator and a limited number of devices/environments. Gemini 3.8 Flash High is in the arena but is **pending hands-on evaluation**.

<div align="center">

<img src="../../assets/frontier-v2-scores-v3.svg" alt="Frontier V2 overall score chart from 0 to 100: Astra Max 95.25, Fable 5.1 Max 93.30, Grok 4.6 XHIGH 33.80; Gemini 3.8 Flash High pending evaluation" width="100%" />

</div>

| Rank | Model | Score |
| ---: | --- | ---: |
| **1** | GPT-6 Astra Max | **95.25/100** |
| **2** | Fable 5.1 Max | **93.30/100** |
| **3** | Grok 4.6 XHIGH | **33.80/100** |
| — | Gemini 3.8 Flash High | **Pending** |

## Evaluation criteria — summary

- **Feature completeness — 20:** required features must exist and deliver the intended behavior; fake, shallow or loophole-driven implementations lose points.
- **Interaction / UX — 15:** clarity, discoverability, ergonomics and control flow when the product works as designed; ordinary implementation bugs belong to Robustness.
- **Visual execution — 15:** hierarchy, readability, coherence, rendering quality and polish.
- **Scientific / simulation fidelity — 15:** orbital, temporal, scale and astronomical correctness plus honest approximation boundaries.
- **Robustness — 10:** bugs, desynchronization, broken camera/follow state, exceptions, corrupted state and behaviors that stop working.
- **Performance — 10:** responsiveness, frame pacing, loading and resource efficiency.
- **Code / architecture — 10:** maintainability, modularity, state boundaries, dependency discipline, testability and validation quality.
- **Accessibility / responsive behavior — 5:** keyboard/focus access, reduced motion, semantic usability and layout adaptation.

**No double penalty:** a defect is scored in its primary category unless separate evidence proves an independent second violation. A broken Sun-follow/camera state, for example, is **Robustness**, not UX.

See [`comparison/SCORECARD.md`](./comparison/SCORECARD.md) for detailed evidence and per-category scores.

## Snapshot policy

Model-produced files are preserved inside vendored `runs/` snapshots without evaluator edits. Evaluator-authored material stays outside model output. A newly added run may be pinned to an exact source Git commit while the full vendored snapshot is still pending; that state is explicit in `RUNS.json` rather than being represented as a completed archive.

## Fairness

A contender should not receive another contender's implementation, score, critique or post-hoc hints while generating its own project. The benchmark is **generation first, evaluation second**.

---

<div align="center">

**Frontier Models · same task, inspectable outputs, explicit evidence.**

</div>
