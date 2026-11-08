# Racing-bench V3.4

**Benchmark 002 — current race-first specification**

## Current prompt and model

The [V3.4 prompt](./prompts/racing-v3.4/racing-v3.4.md) and its [14 reference images](./prompts/racing-v3.4/refs/) are the current benchmark input package: one coastal circuit, five AI opponents, 3/6 laps.

| Current model | Play | Source |
| --- | --- | --- |
| **Gemini 3.8 Flash (V3.4)** | [Play racing](https://racing-gemini-3.8-flash.biel.dev.br/) | [Gemini 3.8 Flash](./runs/gemini-3.8-v3.4/source/) |
| **GPT-6.1 Sol (V3.4)** | [Play racing](https://racing-gpt-6.1-sol.biel.dev.br/) | [GPT-6.1 Sol](./runs/gpt-6.1-sol-v3.4/source/) |
| **GPT-6 Astra (V3.4)** | [Play racing](https://racing-gpt-6-astra.biel.dev.br/) | [GPT-6 Astra](./runs/gpt-6-astra-v3.4/source/) |
| **Opus 5.5 (V3.4)** | [Play racing](https://racing-opus-5.5.biel.dev.br/) | [Opus 5.5](./runs/opus-5.5-v3.4/source/) |
| **Gemini 4 Argon (V3.4)** | [Play racing](https://racing-gemini-4-argon.biel.dev.br/) | [Gemini 4 Argon](./runs/gemini-4-argon-v3.4/source/) |
| **Sonnet 5.5 (V3.4)** | [Play racing](https://racing-sonnet-5.5.biel.dev.br/) | [Sonnet 5.5](./runs/sonnet-5.5-v3.4/source/) |

[Operational addendum](./EXECUTION-ADDENDUM.md) · [Source code metrics](./SOURCE-METRICS.md) · [Run provenance](./RUN-PROVENANCE.md) · [Earlier prompts](./prompts/README.md).

## Historical source archives — Racing V2.6

| Historical model | Archived source | Provenance | Git bundle |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Source](./runs/gpt-6.1-sol/source/) | [Provenance](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash (V2.6)** | [Source](./runs/gemini-3.8-flash/source/) | [Provenance](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Source](./runs/gpt-6-astra/source/) | [Provenance](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

For historical V2.6 reproduction, the [original prompt](./prompts/racing-v2.6.md) and [operational execution addendum](./EXECUTION-ADDENDUM.md) are required **BOTH** together. Prompts [V3.1](./prompts/racing-v3.1.md), [V3.2](./prompts/racing-v3.2.md) and [V3.3](./prompts/racing-v3.3.md) are preserved byte-for-byte.
