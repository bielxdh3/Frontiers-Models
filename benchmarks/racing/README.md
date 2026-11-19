# Racing-bench V3.4 / V3.4.1

**Benchmark 002 — current race-first specification**

## Current prompt and model

The [V3.4 prompt](./prompts/racing-v3.4/racing-v3.4.md) and its [14 reference images](./prompts/racing-v3.4/refs/) are the current benchmark input package: one coastal circuit, five AI opponents, 3/6 laps.

| Current model | Play | Source | Tokens | Time |
| --- | --- | --- | ---: | ---: |
| ☀️ **GPT-6.1 Sol** | [Play racing](https://racing-gpt-6.1-sol.biel.dev.br/) | [GPT-6.1 Sol](./runs/gpt-6.1-sol-v3.4/source/) | — | — |
| ✦ **GPT-6.2 Astra (V3.4.1)** | [Play racing](https://racing-gpt-6.2-astra.biel.dev.br/) | [GPT-6.2 Astra (V3.4.1)](./runs/gpt-astra-6.2-v3.4.1/source/) | ~21%\* | 5h 02m\* |
| ♬ **Opus 5.5** | [Play racing](https://racing-opus-5.5.biel.dev.br/) | [Opus 5.5](./runs/opus-5.5-v3.4/source/) | — | — |
| ✧ **Fable 5.2 (V3.4.1)** | [Play racing](https://racing-fable-5.2.biel.dev.br/) | [Fable 5.2 (V3.4.1)](./runs/fable-5.2-v3.4.1/source/) | ~475.74M | ~11h |
| ◈ **Gemini 4 Argon** | [Play racing](https://racing-gemini-4-argon.biel.dev.br/) | [Gemini 4 Argon](./runs/gemini-4-argon-v3.4/source/) | — | — |
| ⬡ **Gemini 4 Hydrogen** | [Play racing](https://racing-gemini-4-hydrogen.biel.dev.br/) | [Gemini 4 Hydrogen](./runs/gemini-4-hydrogen-v3.4/source/) | — | — |

*Since V3.4.1: total tokens (including cache) and estimated active execution time, when available. — = not recorded. [Metrics and limitations](./EXECUTION-METRICS.md).*

\* GPT-6.2 Astra: ~21% of the Plus weekly quota (owner-reported; no token count). 5h 02m is the observed elapsed interval, not verified active time. Report: 21.55% of the weekly quota for the chat, with 98% model share attributed to Astra; approximate.

**V3.5 (upcoming runs):** [Prompt](./prompts/racing-v3.5/racing_bench_v3_5.md) + [14 references](./prompts/racing-v3.5/refs/).

[V3.4.1 prompt](./prompts/racing-v3.4/racing-v3.4.1.md) · [Operational addendum](./EXECUTION-ADDENDUM.md) · [Source code metrics](./SOURCE-METRICS.md) · [Run provenance](./RUN-PROVENANCE.md) · [Earlier prompts](./prompts/README.md).

## Historical source archives — Racing V2.6

| Historical model | Archived source | Provenance | Git bundle |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Source](./runs/gpt-6.1-sol/source/) | [Provenance](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash (V2.6)** | [Source](./runs/gemini-3.8-flash/source/) | [Provenance](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Source](./runs/gpt-6-astra/source/) | [Provenance](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

For historical V2.6 reproduction, the [original prompt](./prompts/racing-v2.6.md) and [operational execution addendum](./EXECUTION-ADDENDUM.md) are required **BOTH** together. Prompts [V3.1](./prompts/racing-v3.1.md), [V3.2](./prompts/racing-v3.2.md) and [V3.3](./prompts/racing-v3.3.md) are preserved byte-for-byte.

## Non-frontier Racing

| Model | Category | Website | Source code |
| --- | --- | --- | --- |
| ◈ **Gemini 3.8 Flash** | Non-frontier | Deleted | [Code](./runs/gemini-3.8-v3.4/source/) |
| ✧ **Sonnet 5.5** | Non-frontier | [Play racing](https://racing-sonnet-5.5.biel.dev.br/) | [Sonnet 5.5](./runs/sonnet-5.5-v3.4/source/) |
| ✦ **GPT-6 Astra** | Non-frontier | [Play racing](https://racing-gpt-6-astra.biel.dev.br/) | [GPT-6 Astra](./runs/gpt-6-astra-v3.4/source/) |
