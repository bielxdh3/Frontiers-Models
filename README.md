<div align="center">

<img src="./assets/frontier-models-hero-v3.svg" alt="Frontier Models — frontier model benchmark archive" width="100%" />

<br/>

[![Benchmark](https://img.shields.io/badge/benchmark-frontier%20models-7C3AED?style=for-the-badge)](./benchmarks)
[![Arena](https://img.shields.io/badge/Frontier%20V2-4%20current%20contenders-2563EB?style=for-the-badge)](./benchmarks/solar-system/RUNS.json)
[![Archive](https://img.shields.io/badge/archive-5%20snapshots%20%2B%202%20pinned%20sources-DB2777?style=for-the-badge)](./benchmarks/solar-system/RUNS.json)

# Frontier Models

**Exact prompts. Pinned provenance. Complete project snapshots. Explicit evidence.**

[![Português (Brasil)](https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-2563EB?style=for-the-badge)](./README-PT-BR.md)

[Open benchmark](./benchmarks/solar-system/) · [Methodology](./docs/METHODOLOGY.md)

</div>

## ⚔️ Frontier V2 live arena

| Model | Run / effort | Live project | Archived / pinned run |
| --- | --- | --- | --- |
| ✦ **GPT-6 Astra Max** | Frontier V2 / Max | [Open Astra](https://gpt-6-astra.biel.dev.br) | [`runs/gpt-6-astra-max/frontier-v2`](./benchmarks/solar-system/runs/gpt-6-astra-max/frontier-v2/) |
| 𝕏 **Grok 4.6** | Frontier V2 / **XHIGH** | [Open Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◆ **Fable 5.1** | Frontier V2 / **Max** | [Open Fable 5.1](https://fable-solar-system.vercel.app) | [`runs/fable/frontier-v2`](./benchmarks/solar-system/runs/fable/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Frontier V2 / **High** | [Open Gemini 3.8 Flash](https://gemini-3.8-flash.biel.dev.br) | [`runs/gemini-3.8-flash/frontier-v2`](./benchmarks/solar-system/runs/gemini-3.8-flash/frontier-v2/) |

All four current contenders use the **same exact Frontier V2 master prompt**. Reasoning labels are preserved as run metadata and are not normalized across vendors.

## 🗂️ Non-frontier or outdated models

These runs stay visible for reference, but they are intentionally separated from the current frontier arena, hero graphic and main ranking.

| Model | Classification | Project / source | Provenance | Score status |
| --- | --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sun Max V2** | Outdated frontier run | [Open Sun V2](https://gpt-5.6-sun-v2.biel.dev.br) | [`runs/gpt-5.6-sun-max/rebuild`](./benchmarks/solar-system/runs/gpt-5.6-sun-max/rebuild/) · commit `93d43ae62f…` | **71.20/100** historical |
| 🌙 **GPT-5.6 Luna Max** | Non-frontier | [Source repository](https://github.com/bielxdh3/orbitario-luna) | commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) | Not included in the main ranking |

Luna Max is currently source-pinned only; its prompt provenance is not archived in this repository.

## What is Frontier Models?

**Frontier Models** is a benchmark archive for comparing frontier AI systems on complete, inspectable projects rather than isolated screenshots or synthetic scores.

```text
PROMPT → MODEL RUN → PROJECT SNAPSHOT / PINNED SOURCE → EVIDENCE → SCORECARD → VERDICT
```

## Benchmark 001 — Solar System / Orbitarium

The first benchmark asks each model to build a complete interactive Solar System product from a dense product specification. It stresses product design, simulation and orbital logic, camera/navigation, time state, accessibility, performance, robustness, scientific honesty, learning tools and QA.

## Current run provenance

| Model | Provenance | Status |
| --- | --- | --- |
| GPT-6 Astra Max | commit `fca2ef51b4…` | archived |
| Grok 4.6 XHIGH | source ZIP SHA-256 `5d77eeb509…` | archived |
| Fable 5.1 Max | commit `7e079669e41b…` | archived |
| Gemini 3.8 Flash High | commit `805cfe87a…` in `bielxdh3/gemini` | source pinned |

The exact shared prompt is [`frontier-v2.md`](./benchmarks/solar-system/prompts/frontier-v2.md), SHA-256 `7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65`.

## Frontier V2 scores

> **Preliminary evaluation:** the current scores are mainly based on one evaluator and a limited number of devices/environments. Gemini 3.8 Flash High has joined the arena but is **not scored yet**.

<div align="center">

<img src="./assets/frontier-v2-scores-v3.svg" alt="Frontier V2 score chart: Astra Max 95.25, Fable 5.1 Max 93.30, Grok 4.6 XHIGH 33.80; Gemini 3.8 Flash High pending evaluation" width="100%" />

</div>

| Rank | Model | Score |
| ---: | --- | ---: |
| **1** | GPT-6 Astra Max | **95.25/100** |
| **2** | Fable 5.1 Max | **93.30/100** |
| **3** | Grok 4.6 XHIGH | **33.80/100** |
| — | Gemini 3.8 Flash High | **Pending** |

## Evaluation criteria — summary

- **Feature completeness — 20 pts:** required features must actually exist and deliver the intended behavior; fake, shallow or loophole-driven implementations lose credit.
- **Interaction / UX — 15 pts:** clarity, discoverability, ergonomics and control flow when the product is working as designed; implementation bugs do **not** automatically count as UX problems.
- **Visual execution — 15 pts:** hierarchy, readability, coherence, rendering quality and polish.
- **Scientific / simulation fidelity — 15 pts:** orbital, temporal, scale and astronomical correctness, including honest approximation boundaries.
- **Robustness — 10 pts:** bugs, state desynchronization, broken camera/follow behavior, exceptions, corrupted state and features that stop working.
- **Performance — 10 pts:** responsiveness, frame pacing, loading and resource efficiency.
- **Code / architecture — 10 pts:** maintainability, modularity, state boundaries, dependencies, testability and validation quality.
- **Accessibility / responsive behavior — 5 pts:** keyboard/focus access, reduced motion, semantic usability and layout adaptation across target viewports.

**No double penalty:** one defect should be charged to its primary category unless independent evidence shows a separate violation. Example: if the Sun follows the camera/user because scene or follow state is broken, that is **Robustness**, not UX.

See the detailed evidence and per-category scores in [`SCORECARD.md`](./benchmarks/solar-system/comparison/SCORECARD.md).

## Archive policy

- model output stays untouched inside archived `runs/` snapshots;
- evaluator material stays outside model output;
- exact prompts are archived separately and verbatim;
- Git commits are used when source Git metadata exists;
- cryptographic source-archive hashes are used when it does not;
- a source repository may be commit-pinned while its vendored snapshot is still pending;
- historical runs remain preserved without cluttering the current arena.

---

<div align="center">

### Frontier Models

**Input · output · evidence · comparison — in one place.**

<sub>Independent benchmark archive. Model names identify the systems used for individual runs.</sub>

</div>
