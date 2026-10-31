<div align="center">

<img src="./assets/frontier-models-hero-v7.svg" alt="Frontier Models — frontier model benchmark archive" width="100%" />

<br/>

[![Benchmark](https://img.shields.io/badge/benchmark-frontier%20models-7C3AED?style=flat)](./benchmarks)
[![Arena](https://img.shields.io/badge/Arena-5%20current%20references-2563EB?style=flat)](./benchmarks/solar-system/RUNS.json)
[![Archive](https://img.shields.io/badge/archive-8%20snapshots%20%2B%202%20pinned%20sources-DB2777?style=flat)](./benchmarks/solar-system/RUNS.json)

# Frontier Models

**Exact prompts. Pinned provenance. Complete project snapshots. Explicit evidence.**

[![Português (Brasil)](https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-2563EB?style=flat)](./README-PT-BR.md)

[Open benchmark](./benchmarks/solar-system/) · [Methodology](./docs/METHODOLOGY.md)

</div>

## ⚔️ Current reference arena

| Model | Run / provenance | Live project | Archived / pinned run |
| --- | --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | Source-archived / prompt unverified | [Open Sol](https://gpt-6.1-sol.biel.dev.br/) | [`runs/gpt-6.1-sol/source`](./benchmarks/solar-system/runs/gpt-6.1-sol/source/) |
| ✦ **GPT-6 Astra** | Frontier V2 | [Open Astra](https://gpt-6-astra.biel.dev.br) | [`runs/gpt-6-astra-max/frontier-v2`](./benchmarks/solar-system/runs/gpt-6-astra-max/frontier-v2/) |
| 𝕏 **Grok 4.7 Solar** | Source-pinned reference | [Open Solar System Observatory](https://grok-4.7.biel.dev.br/) | [`runs/grok-4.7/source`](./benchmarks/solar-system/runs/grok-4.7/source/) |
| ◆ **Fable 5.1** | Frontier V2 | [Open Fable 5.1](https://fable-solar-system.vercel.app) | [`runs/fable/frontier-v2`](./benchmarks/solar-system/runs/fable/frontier-v2/) |
| ◈ **Gemini 4 Argon** | Source archived / prompt unverified | [Open Argon](https://gemini-4-argon.biel.dev.br/) | [`runs/gemini-4-argon/source`](./benchmarks/solar-system/runs/gemini-4-argon/source/) |

The current arena includes **five** references. Gemini 4 Argon and GPT-6.1 Sol are archived at exact source commits, but their generating prompts are not independently verified, so Frontier V2 prompt equivalence is not claimed. Gemini 3.8 Flash remains visible below as a historical source-pinned reference.

## 🗂️ Non-frontier or outdated models

These runs stay visible for reference, but they are intentionally separated from the current frontier arena and hero graphic.

| Model | Classification | Project / source | Provenance |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sun V1** | Historical baseline | [Open Sun V1](https://gpt-5.6-sun-v1.biel.dev.br) | [`runs/gpt-5.6-sun-max/original`](./benchmarks/solar-system/runs/gpt-5.6-sun-max/original/) · commit `67eb9fc51f…` |
| ☀️ **GPT-5.6 Sun V2** | Outdated frontier run | [Open Sun V2](https://gpt-5.6-sun-v2.biel.dev.br) | [`runs/gpt-5.6-sun-max/rebuild`](./benchmarks/solar-system/runs/gpt-5.6-sun-max/rebuild/) · commit `93d43ae62f…` |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Open Luna](https://gpt-5.6-luna.biel.dev.br/) | commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) |
| 𝕏 **Grok 4.6** | Archived frontier run | [Open Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Archived Frontier V2 | [Open Gemini 3.8 Flash](https://gemini-3.8-flash.biel.dev.br) | [`source-pinned reference`](./benchmarks/solar-system/GEMINI-3.8-FLASH-PROVENANCE.md) · `805cfe87a…` |

Luna is currently source-pinned only; its prompt provenance is not archived in this repository.

## What is Frontier Models?

**Frontier Models** is a benchmark archive for comparing frontier AI systems on complete, inspectable projects with verified prompts, source snapshots and provenance.

### Architecture at a glance

```text
   +--------------------------------+         +--------------------------------+
   | Versioned benchmark prompts    |         | Model-generated projects       |
   | prompts/frontier-v2.md         |         | source commits / ZIP hashes    |
   | only for verified inputs       |         | archived or source-pinned      |
   +--------------------------------+         +--------------------------------+
                    |                                          |
                    +--------------------+---------------------+
                                         |
                                         v
                    +----------------------------------------+
                    | Solar System run registry              |
                    | benchmarks/solar-system/RUNS.json      |
                    | current + historical references        |
                    +----------------------------------------+
                                         |
                    +--------------------+---------------------+
                    |                                          |
                    v                                          v
   +--------------------------------+         +--------------------------------+
   | Original project snapshots     |         | Provenance and source pins     |
   | runs/<model>/<run>/            |         | *-PROVENANCE.md / *-FILES.json |
   | preserved without rewrites     |         | Git commits / SHA-256 / checks |
   +--------------------------------+         +--------------------------------+
                    |                                          |
                    +--------------------+---------------------+
                                         |
                                         v
                    +----------------------------------------+
                    | READMEs + live project links           |
                    | hero SVG + integrity scripts           |
                    +----------------------------------------+
```

The registry links input evidence, archived outputs or source-only references, and immutable provenance. An external source pin is not presented as a complete local snapshot; an unverified prompt is not assumed to match another run. See [repository architecture](./docs/REPOSITORY-ARCHITECTURE.md).

## Benchmark 001 — Solar System / Orbitarium

The first benchmark asks each model to build a complete interactive Solar System product from a dense product specification. It stresses product design, simulation and orbital logic, camera/navigation, time state, accessibility, performance, robustness, scientific honesty, learning tools and QA.

## Run provenance

| Model | Provenance | Classification | Source status |
| --- | --- | --- | --- |
| GPT-6.1 Sol | source commit [`7caaccc7f4…`](https://github.com/bielxdh3/6.1gptsol/commit/7caaccc7f462806de10a1981c9826d3151e85407) | Current reference | Archived; prompt unverified |
| GPT-6 Astra | commit `fca2ef51b4…` | Current frontier | Archived |
| Grok 4.7 Solar | commit `bcb1e82012…` in `JouberthAlves/grok-4.7-solar` | Current frontier | Source pinned |
| Fable 5.1 | commit `7e079669e41b…` | Current frontier | Archived |
| Gemini 4 Argon | source commit [`318aa80bb5…`](https://github.com/bielxdh3/gemini-argon/commit/318aa80bb5c49cbbfdfd4c3d267ad88d56ae3f98) | Current reference | Archived; prompt unverified |
| Gemini 3.8 Flash | commit `805cfe87a…` in `bielxdh3/gemini` | Historical | Source pinned |
| GPT-5.6 Sun V1 | commit `67eb9fc51f…` | Historical baseline | Archived |
| GPT-5.6 Sun V2 | commit `93d43ae62f…` | Outdated | Archived |
| Grok 4.6 | source ZIP SHA-256 `5d77eeb509…` | Archived frontier | Archived |
| GPT-5.6 Luna | commit `5fdc036884…` in `bielxdh3/orbitario-luna` | Non-frontier | Source pinned |

The exact shared prompt is [`frontier-v2.md`](./benchmarks/solar-system/prompts/frontier-v2.md), SHA-256 `7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65`.

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
