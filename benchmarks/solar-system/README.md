<div align="center">

# Orbitarium-bench

**Frontier Models · complete-product generation benchmark**

`3D / Canvas` · `simulation` · `product design` · `scientific honesty` · `responsive UX` · `robustness`

[![Português (Brasil)](https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-2563EB?style=for-the-badge)](./README-PT-BR.md)

</div>

## ⚔️ Current reference arena

| Model | Source status | Live project | Snapshot / source |
| --- | --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | Source archived | [Open Sol](https://orbitarium-gpt-6.1-sol.biel.dev.br) | [`runs/gpt-6.1-sol/source`](./runs/gpt-6.1-sol/source/) · `7caaccc7f4…` |
| ✦ **GPT-6 Astra** | Archived | [Open Astra](https://orbitarium-gpt-6-astra.biel.dev.br) | `fca2ef51b4…` |
| 𝕏 **Grok 4.7** | Source-pinned | [Open Grok 4.7](https://orbitarium-grok-4.7.biel.dev.br) | [Source repository](https://github.com/JouberthAlves/grok-4.7-solar) · commit `bcb1e82012…` |
| ◆ **Fable 5.1** | Frontier V2 | [Open Fable 5.1](https://fable-solar-system.vercel.app) | `7e079669e41b…` |
| ◈ **Gemini 4 Argon** | Source archived | [Open Argon](https://orbitarium-gemini-4-argon.biel.dev.br) | [`runs/gemini-4-argon/source`](./runs/gemini-4-argon/source/) · `318aa80bb5…` |

The archived Frontier V2 prompt is verified for runs that reference it. GPT-6.1 Sol and Grok 4.7 are independent source references with unverified exact prompt provenance.


## 🗂️ Non-frontier or outdated models

These projects remain visible outside the current frontier arena and main hero.

| Model | Classification | Project / source | Provenance |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sol V2** | Outdated frontier run | [Open Sol V2](https://orbitarium-gpt-5.6-sol-v2.biel.dev.br) | commit `93d43ae62f…` · [Archive V2](./runs/gpt-5.6-sun-max/rebuild/) |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Open Luna](https://orbitarium-gpt-5.6-luna.biel.dev.br) | source commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) |
| 𝕏 **Grok 4.6** | Archived frontier run | [Open Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Archived Frontier V2 | [Open Gemini 3.8 Flash](https://orbitarium-gemini-3.8-flash.biel.dev.br) | [`source-pinned reference`](./GEMINI-3.8-FLASH-PROVENANCE.md) · `805cfe87a…` |

Luna is source-pinned only for now; its prompt provenance is not archived here.

<details>
<summary><strong>Historical baseline — GPT-5.6 Sol V1</strong></summary>

GPT-5.6 Sol V1 is preserved only for prompt-leverage history. It is deliberately excluded from the current arena because it used [`sun-original.md`](./prompts/sun-original.md), not Frontier V2.

- [Open Sol V1](https://orbitarium-gpt-5.6-sol.v1.biel.dev.br)
- Snapshot: `67eb9fc51f…`
- Archive: [Archive V1](./runs/gpt-5.6-sun-max/original/)

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
| Historical baseline | GPT-5.6 Sol V1 | `sun-original.md` | commit `67eb9fc51f…` | hidden |
| Frontier V2 | GPT-5.6 Sol | `frontier-v2.md` | commit `93d43ae62f…` | non-frontier / outdated |
| Source-pinned reference | GPT-5.6 Luna | not archived here | source commit `5fdc036884…` | non-frontier |
| Archived source | GPT-6.1 Sol | not verified | commit `7caaccc7f4…` | current |
| Frontier V2 | GPT-6 Astra | `frontier-v2.md` | commit `fca2ef51b4…` | current |
| Source-pinned | Grok 4.7 | not archived here | commit `bcb1e82012…` | current |
| Frontier V2 | Fable 5.1 | `frontier-v2.md` | commit `7e079669e41b…` | current |
| Archived source | Gemini 4 Argon | not verified | commit `318aa80bb5…` | current |
| Frontier V2 | Gemini 3.8 Flash | `frontier-v2.md` | source commit `805cfe87a…` | archived |

Machine-readable provenance lives in [`RUNS.json`](./RUNS.json). See [Gemini 4 Argon provenance](./GEMINI-4-ARGON-PROVENANCE.md) for its archived source manifest and [Gemini 3.8 provenance](./GEMINI-3.8-FLASH-PROVENANCE.md) for the historical source pin.

## Snapshot policy

Model-produced files are preserved inside vendored `runs/` snapshots without modifications. Archive metadata stays outside model output. A newly added run may be pinned to an exact source Git commit while the full vendored snapshot is still pending; that state is explicit in `RUNS.json` rather than being represented as a completed archive.

## Fairness

A contender should not receive another contender's implementation or post-hoc hints while generating its own project. Generated projects are preserved unchanged.

---

<div align="center">

**Frontier Models · same task, inspectable outputs, explicit evidence.**

</div>
