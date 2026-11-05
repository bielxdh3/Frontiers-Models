# Racing-bench V3.4

**Benchmark 002 — current race-first specification**

## Current prompt and model

The [V3.4 prompt](./prompts/racing-v3.4/racing-v3.4.md) and its [14 reference images](./prompts/racing-v3.4/refs/) are the current benchmark input package: one coastal circuit, five AI opponents, 3/6 laps.

| Current model | Play | Source |
| --- | --- | --- |
| **Gemini 3.8 Flash (V3.4)** | [Play racing](https://racing-gemini-3.8-flash.biel.dev.br/) | [Source — gemini-3.8](https://github.com/bielxdh3/gemini-3.8) |
| **GPT-6.1 Sol (V3.4)** | [Play racing](https://racing-gpt-6.1-sol.biel.dev.br/) | [Source — 6.1racinsol](https://github.com/bielxdh3/6.1racinsol) |

The Gemini site returned HTTP 200 on 2026-11-02; gameplay remains unverified. GPT-6.1 Sol's site URL was provided by the owner and has not yet been independently tested. [Source provenance](./runs/gemini-3.8-v3.4/SOURCE-PROVENANCE.md) pins the exact source commit. All 188 Git-tracked files are archived here with hashes (the external Git LFS video is not bundled). V3.3 remains unchanged and frozen as a historical prompt; V3.2 and V3.1 are also archived.

## Historical source archives — Racing V2.6

These three source snapshots and their full Git history bundles are preserved unchanged; they are no longer current Racing-bench runs. No old game-site URLs are promoted.

| Historical model | Archived source | Provenance | Git bundle |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Source](./runs/gpt-6.1-sol/source/) | [Provenance](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash (V2.6)** | [Source](./runs/gemini-3.8-flash/source/) | [Provenance](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Source](./runs/gpt-6-astra/source/) | [Provenance](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

For historical V2.6 reproduction, the [original prompt](./prompts/racing-v2.6.md) and [mandatory execution addendum](./EXECUTION-ADDENDUM.md) are required **BOTH** together. Prompts [V3.1](./prompts/racing-v3.1.md), [V3.2](./prompts/racing-v3.2.md) and [V3.3](./prompts/racing-v3.3.md) are preserved byte-for-byte.
