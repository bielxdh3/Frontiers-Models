<div align="center">

<img src="./assets/frontier-models-hero-v7.svg" alt="Frontier Models — independent Racing and Orbitarium benchmark collection with five current Orbitarium runs" width="100%" />

<br/>

[![Benchmark](https://img.shields.io/badge/benchmark-frontier%20models-7C3AED?style=flat)](./benchmarks)
[![Benchmarks](https://img.shields.io/badge/benchmarks-2-2563EB?style=flat)](./docs/REPOSITORY-ARCHITECTURE.md)
[![Current runs](https://img.shields.io/badge/current%20runs-5-DB2777?style=flat)](./benchmarks/racing/RUNS.json)

# Frontier Models

**Exact prompts. Pinned provenance. Complete project snapshots. Explicit evidence.**

[![Português (Brasil)](https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-2563EB?style=flat)](./README-PT-BR.md)

[Open Racing-bench](./benchmarks/racing/) · [Open Orbitarium-bench](./benchmarks/solar-system/) · [Methodology](./docs/METHODOLOGY.md)

</div>

## ⚔️ Current benchmark runs

### Racing-bench V3.1 — current specification

**[Racing-bench V3.1 — frozen standalone prompt](./benchmarks/racing/prompts/racing-v3.1.md)** is the current Racing benchmark: AAA-inspired browser racing with three courses, four cars, five local rivals, three independently invented Signature Features and sixteen additional mandatory engineering systems. **No V3.1 model runs or live-game sites have been published yet.**

**Legacy archive — Racing-bench V2.6 (original code preserved, old play links removed):**

| Legacy model | Archived source |
| --- | --- |
| **GPT-6.1 Sol** | [Source](./benchmarks/racing/runs/gpt-6.1-sol/source/) |
| **Gemini 3.8 Flash** | [Source](./benchmarks/racing/runs/gemini-3.8-flash/source/) |
| **GPT-6 Astra** | [Source](./benchmarks/racing/runs/gpt-6-astra/source/) |

All three V2.6 executions are **legacy/archived**, not current V3.1 runs. Exact sources, manifests and Git-history bundles are preserved; this is not a gameplay quality claim.

### Orbitarium-bench — current references

| Model | Live project | Source code |
| --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | [Open GPT-6.1 Sol](https://orbitarium-gpt-6.1-sol.biel.dev.br) | [Code: GPT-6.1 Sol](./benchmarks/solar-system/runs/gpt-6.1-sol/source/) |
| ✦ **GPT-6 Astra** | [Open GPT-6 Astra](https://orbitarium-gpt-6-astra.biel.dev.br) | [Code: GPT-6 Astra](./benchmarks/solar-system/runs/gpt-6-astra-max/frontier-v2/) |
| 𝕏 **Grok 4.7** | [Open Grok 4.7](https://orbitarium-grok-4.7.biel.dev.br) | [Code: Grok 4.7](./benchmarks/solar-system/runs/grok-4.7/source/) |
| ◆ **Fable 5.1** | [Open Fable 5.1](https://fable-solar-system.vercel.app) | [Code: Fable 5.1](./benchmarks/solar-system/runs/fable/frontier-v2/) |
| ◈ **Gemini 4 Argon** | [Open Gemini 4 Argon](https://orbitarium-gemini-4-argon.biel.dev.br) | [Code: Gemini 4 Argon](./benchmarks/solar-system/runs/gemini-4-argon/source/) |

Orbitarium includes **five current references**. Gemini 4 Argon and GPT-6.1 Sol are archived at exact source commits, but their generating prompts are not independently verified, so Frontier V2 prompt equivalence is not claimed. Gemini 3.8 Flash remains a **historical Orbitarium** source-pinned reference and its V2.6 Racing project is also **legacy/archived**.

## How it fits together

```text
          ┌──────────────────────┐   ┌──────────────────────┐
          │ Benchmark prompts    │   │ Model project runs   │
          │ original inputs      │   │ sources / snapshots  │
          └──────────┬───────────┘   └──────────┬───────────┘
                     │                          │
                     └────────────┬─────────────┘
                                  │
                       ┌──────────▼───────────┐
                       │   Frontier Models    │
                       │ RUNS.json · 2        │
                       │ current · historical │
                       └──────┬────────┬──────┘
                              │        │
                snapshots     │        │ source evidence
                              │        │
                    ┌─────────▼───┐ ┌──▼──────────────────┐
                    │  Snapshots  │ │ Provenance records  │
                    │ runs/       │ │ commits · ZIP hashes│
                    │ model files │ │ prompt provenance   │
                    └─────────────┘ └──┬──────────────────┘
                                       │ published references
                         ┌─────────────▼───────────┐
                         │ Live project URLs       │
                         │ SHA-256 verification    │
                         └─────────────────────────┘
```

The registry connects archived inputs, independent project runs, source evidence, and public references. A pinned source is not necessarily a local snapshot, and prompts with unverified provenance are kept distinct. See [repository architecture](./docs/REPOSITORY-ARCHITECTURE.md).

## 🗂️ Non-frontier or outdated models

These **Orbitarium** runs stay visible for reference but are separated from that benchmark's current arena. Racing-bench V3.1 currently has no published model runs; its three V2.6 projects are legacy archives.

| Model | Classification | Project / source | Provenance |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sol V1** | Historical baseline | Site removed | [Archive V1](./benchmarks/solar-system/runs/gpt-5.6-sun-max/original/) · commit `67eb9fc51f…` |
| ☀️ **GPT-5.6 Sol V2** | Outdated frontier run | [Open Sol V2](https://orbitarium-gpt-5.6-sol-v2.biel.dev.br) | [Archive V2](./benchmarks/solar-system/runs/gpt-5.6-sun-max/rebuild/) · commit `93d43ae62f…` |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Open Luna](https://orbitarium-gpt-5.6-luna.biel.dev.br) | commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) |
| 𝕏 **Grok 4.6** | Archived frontier run | [Open Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Archived Frontier V2 | [Open Gemini 3.8 Flash](https://orbitarium-gemini-3.8-flash.biel.dev.br) | [`source-pinned reference`](./benchmarks/solar-system/GEMINI-3.8-FLASH-PROVENANCE.md) · `805cfe87a…` |

Luna is currently source-pinned only; its prompt provenance is not archived in this repository.

## What is Frontier Models?

**Frontier Models** is a benchmark archive for comparing frontier AI systems on complete, inspectable projects with verified prompts, source snapshots and provenance.

```text
PROMPT → MODEL RUN → PROJECT SNAPSHOT / PINNED SOURCE → EVIDENCE → PROVENANCE → INSPECTABLE PROJECTS
```

## Benchmark 002 — Racing-bench

**[Racing-bench V3.1](./benchmarks/racing/prompts/racing-v3.1.md) is the current frozen, standalone execution contract.** It requires a photoreal, GPU-intensive desktop-browser racer with deep mechanics, three tracks/modes, four cars, five offline rivals, three original Signature Features and sixteen integrated additional systems. No V3.1 game runs are published yet.

**V2.6 is legacy/archived.** Its [immutable original prompt](./benchmarks/racing/prompts/racing-v2.6.md), [historical V2.6 execution addendum](./benchmarks/racing/EXECUTION-ADDENDUM.md) and the source archives of [GPT-6.1 Sol](./benchmarks/racing/runs/gpt-6.1-sol/source/), [Gemini 3.8 Flash](./benchmarks/racing/runs/gemini-3.8-flash/source/) and [GPT-6 Astra](./benchmarks/racing/runs/gpt-6-astra/source/) remain preserved. Former Racing live-game links are no longer shown; this does not delete external sites.

## Benchmark 001 — Orbitarium-bench

Orbitarium-bench asks each model to build a complete interactive Solar System product from a dense product specification. It stresses product design, simulation and orbital logic, camera/navigation, time state, accessibility, performance, robustness, scientific honesty, learning tools and QA.

The historical archive path `benchmarks/solar-system/` is preserved to keep existing links and exact-source provenance stable.

## Run provenance by benchmark

### Racing-bench

| Model | Source revision | Classification | Source status |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | Git `6f55263669…` | Legacy | Archived |
| **Gemini 3.8 Flash** | Git `a18fcaee71…` | Legacy | Archived |
| **GPT-6 Astra** | Git `0c615e8dc3…` | Legacy | Archived |

All three Racing source snapshots include [SHA-256 manifests and restorable Git bundles](./benchmarks/racing/).

### Orbitarium-bench

| Model | Source revision | Classification | Source status |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | Git `7caaccc7f4…` | Current | Archived |
| **GPT-6 Astra** | Git `fca2ef51b4…` | Current | Archived |
| **Grok 4.7** | Git `bcb1e82012…` | Current | Archived |
| **Fable 5.1** | Git `7e079669e4…` | Current | Archived |
| **Gemini 4 Argon** | Git `318aa80bb5…` | Current | Archived |
| **GPT-5.6 Sol V1** | Git `67eb9fc51f…` | Historical | Archived |
| **GPT-5.6 Sol V2** | Git `93d43ae62f…` | Historical | Archived |
| **Grok 4.6** | ZIP SHA-256 `5d77eeb509…` | Historical | Archived |
| **Gemini 3.8 Flash** | Git `805cfe87a6…` | Historical | Pinned only |
| **GPT-5.6 Luna** | Git `5fdc036884…` | Non-frontier | Pinned only |

**Classification** refers to the run's status *within its benchmark*: Current, Historical (including superseded/archived runs), or Non-frontier. **Source status** refers only to source-file preservation: Archived (local snapshot) or Pinned only (source revision recorded, without a full local snapshot). It does not assert prompt equivalence or gameplay quality.

The exact shared Orbitarium prompt is [`frontier-v2.md`](./benchmarks/solar-system/prompts/frontier-v2.md), SHA-256 `7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65`.

## Archive policy

- model output stays untouched inside archived `runs/` snapshots;
- archive metadata stays outside model output;
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
