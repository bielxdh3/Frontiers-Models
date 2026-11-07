<div align="center">

<img src="./assets/frontier-models-hero-v7.svg" alt="Frontier Models — independent Racing and Orbitarium benchmark collection with 10 current runs (5 Racing and 5 Orbitarium)" width="100%" />

<br/>

[![Benchmark](https://img.shields.io/badge/benchmark-frontier%20models-7C3AED?style=flat)](./benchmarks)
[![Benchmarks](https://img.shields.io/badge/benchmarks-2-2563EB?style=flat)](./docs/REPOSITORY-ARCHITECTURE.md)
[![Current runs](https://img.shields.io/badge/current%20runs-10-DB2777?style=flat)](./benchmarks/racing/RUNS.json)

# Frontier Models

**Exact prompts. Pinned provenance. Complete project snapshots. Explicit evidence.**

[![Português (Brasil)](https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-2563EB?style=flat)](./README-PT-BR.md)

[Open Racing-bench](./benchmarks/racing/) · [Open Orbitarium-bench](./benchmarks/solar-system/) · [Methodology](./docs/METHODOLOGY.md)

</div>

## ⚔️ Current benchmark runs

### Racing-bench V3.4 — current race-first benchmark

| Current model | Play | Source code |
| --- | --- | --- |
| **Gemini 3.8 Flash (V3.4)** | [Play racing](https://racing-gemini-3.8-flash.biel.dev.br/) | [Gemini 3.8 Flash](./benchmarks/racing/runs/gemini-3.8-v3.4/source/) |
| **GPT-6.1 Sol (V3.4)** | [Play racing](https://racing-gpt-6.1-sol.biel.dev.br/) | [GPT-6.1 Sol](./benchmarks/racing/runs/gpt-6.1-sol-v3.4/source/) |
| **GPT-6 Astra (V3.4)** | [Play racing](https://racing-gpt-6-astra.biel.dev.br/) | [GPT-6 Astra](./benchmarks/racing/runs/gpt-6-astra-v3.4/source/) |
| **Opus 5.5 (V3.4)** | [Play racing](https://racing-opus-5.5.biel.dev.br/) | [Opus 5.5](./benchmarks/racing/runs/opus-5.5-v3.4/source/) |
| **Gemini 4 Argon (V3.4)** | [Play racing](https://racing-gemini-4-argon.biel.dev.br/) | [Gemini 4 Argon](./benchmarks/racing/runs/gemini-4-argon-v3.4/source/) |

**V3.4 inputs:** [Racing prompt](./benchmarks/racing/prompts/racing-v3.4/racing-v3.4.md) · [14 reference images](./benchmarks/racing/prompts/racing-v3.4/refs/) · [Operational addendum](./benchmarks/racing/EXECUTION-ADDENDUM.md).

**Racing V2.6 archive:** [GPT-6.1 Sol](./benchmarks/racing/runs/gpt-6.1-sol/source/), [Gemini 3.8 Flash](./benchmarks/racing/runs/gemini-3.8-flash/source/) and [GPT-6 Astra](./benchmarks/racing/runs/gpt-6-astra/source/).

### Orbitarium-bench — current references

| Model | Live project | Source code |
| --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | [Open GPT-6.1 Sol](https://orbitarium-gpt-6.1-sol.biel.dev.br) | [Code: GPT-6.1 Sol](./benchmarks/solar-system/runs/gpt-6.1-sol/source/) |
| ✦ **GPT-6 Astra** | [Open GPT-6 Astra](https://orbitarium-gpt-6-astra.biel.dev.br) | [Code: GPT-6 Astra](./benchmarks/solar-system/runs/gpt-6-astra-max/frontier-v2/) |
| 𝕏 **Grok 4.7** | [Open Grok 4.7](https://orbitarium-grok-4.7.biel.dev.br) | [Code: Grok 4.7](./benchmarks/solar-system/runs/grok-4.7/source/) |
| ◆ **Fable 5.1** | [Open Fable 5.1](https://fable-solar-system.vercel.app) | [Code: Fable 5.1](./benchmarks/solar-system/runs/fable/frontier-v2/) |
| ◈ **Gemini 4 Argon** | [Open Gemini 4 Argon](https://orbitarium-gemini-4-argon.biel.dev.br) | [Code: Gemini 4 Argon](./benchmarks/solar-system/runs/gemini-4-argon/source/) |

## How it fits together

```text
FRONTIER MODELS                         2 benchmarks · 10 current runs
│
├── RACING-BENCH (V3.4)                 5 current runs
│   ├── inputs      racing-v3.4/ · 14 visual references
│   ├── current     Gemini 3.8 Flash · GPT-6.1 Sol · GPT-6 Astra · Opus 5.5 · Gemini 4 Argon
│   └── history     V2.6 runs + earlier prompts
│
├── ORBITARIUM-BENCH (Frontier V2)      5 current references
│   ├── inputs      frontier-v2.md
│   ├── current     Sol · Astra · Grok · Fable · Argon
│   └── history     earlier and non-frontier runs
│
└── ARCHIVE CONVENTIONS (per benchmark)
    ├── RUNS.json   current / historical index + live URLs
    ├── prompts/    original benchmark inputs
    ├── runs/       source snapshots or commit-pinned records
    └── provenance commits · SHA-256 manifests · prompt status
```

Browse [repository architecture](./docs/REPOSITORY-ARCHITECTURE.md) and the benchmark folders.

## 🗂️ Non-frontier or outdated models

These **Orbitarium** runs stay visible for reference but are separated from that benchmark's current arena. Racing-bench V3.4 features Gemini 3.8 Flash, GPT-6.1 Sol, GPT-6 Astra, Opus 5.5 and Gemini 4 Argon; the three V2.6 projects remain legacy archives.

| Model | Classification | Project / source | Provenance |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sol V1** | Historical baseline | Site removed | [Archive V1](./benchmarks/solar-system/runs/gpt-5.6-sun-max/original/) |
| ☀️ **GPT-5.6 Sol V2** | Outdated frontier run | [Open Sol V2](https://orbitarium-gpt-5.6-sol-v2.biel.dev.br) | [Archive V2](./benchmarks/solar-system/runs/gpt-5.6-sun-max/rebuild/) |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Open Luna](https://orbitarium-gpt-5.6-luna.biel.dev.br) | [Run record](./benchmarks/solar-system/RUNS.json) |
| 𝕏 **Grok 4.6** | Archived frontier run | [Open Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Archived Frontier V2 | [Open Gemini 3.8 Flash](https://orbitarium-gemini-3.8-flash.biel.dev.br) | [`source-pinned reference`](./benchmarks/solar-system/GEMINI-3.8-FLASH-PROVENANCE.md) |

## What is Frontier Models?

**Frontier Models** is a benchmark archive for comparing frontier AI systems on complete, inspectable projects with verified prompts, source snapshots and provenance.

```text
PROMPT → MODEL RUN → PROJECT SNAPSHOT / PINNED SOURCE → EVIDENCE → PROVENANCE → INSPECTABLE PROJECTS
```

[Racing records](./benchmarks/racing/RUN-PROVENANCE.md) · [Orbitarium records](./benchmarks/solar-system/RUN-PROVENANCE.md) · [Archive policy](./docs/ARCHIVE-POLICY.md).

## Benchmark 002 — Racing-bench

[Racing V3.4 prompt](./benchmarks/racing/prompts/racing-v3.4/racing-v3.4.md) · [14 visual references](./benchmarks/racing/prompts/racing-v3.4/refs/) · [Games and source](./benchmarks/racing/README.md).

Previous prompts: [V3.3](./benchmarks/racing/prompts/racing-v3.3.md), [V3.2](./benchmarks/racing/prompts/racing-v3.2.md), [V3.1](./benchmarks/racing/prompts/racing-v3.1.md) and [V2.6](./benchmarks/racing/prompts/racing-v2.6.md).

## Benchmark 001 — Orbitarium-bench

Orbitarium-bench asks each model to build a complete interactive Solar System product from a dense product specification. It stresses product design, simulation and orbital logic, camera/navigation, time state, accessibility, performance, robustness, scientific honesty, learning tools and QA.

---

<div align="center">

### Frontier Models

**Input · output · evidence · comparison — in one place.**

<sub>Independent benchmark archive. Model names identify the systems used for individual runs.</sub>

</div>
