# Racing-bench V3.4

**Benchmark 002 — current race-first specification**

## Current prompt and model

The [V3.4 prompt](./prompts/racing-v3.4/racing-v3.4.md) and its [14 reference images](./prompts/racing-v3.4/refs/) are the current benchmark input package: one coastal circuit, five AI opponents, 3/6 laps.

| Current model | Play | Source |
| --- | --- | --- |
| **Gemini 3.8 Flash (V3.4)** | [Play racing](https://racing-gemini-3.8-flash.biel.dev.br/) | [Gemini 3.8 Flash](https://github.com/bielxdh3/gemini-3.8) |
| **GPT-6.1 Sol (V3.4)** | [Play racing](https://racing-gpt-6.1-sol.biel.dev.br/) | [GPT-6.1 Sol](./runs/gpt-6.1-sol-v3.4/source/) |
| **GPT-6 Astra (V3.4)** | [Play racing](https://racing-gpt-6-astra.biel.dev.br/) | [GPT-6 Astra](./runs/gpt-6-astra-v3.4/source/) |
| **Opus 5.5 (V3.4)** | [Play racing](https://racing-opus-5.5.biel.dev.br/) | [Opus 5.5](./runs/opus-5.5-v3.4/source/) |

**V3.4 source provenance:** [Gemini 3.8 Flash](./runs/gemini-3.8-v3.4/SOURCE-PROVENANCE.md) · [GPT-6.1 Sol](./runs/gpt-6.1-sol-v3.4/SOURCE-PROVENANCE.md) · [GPT-6 Astra](./runs/gpt-6-astra-v3.4/SOURCE-PROVENANCE.md) · [Opus 5.5](./runs/opus-5.5-v3.4/SOURCE-PROVENANCE.md). Earlier prompts: [V3.3](./prompts/racing-v3.3.md), [V3.2](./prompts/racing-v3.2.md), [V3.1](./prompts/racing-v3.1.md).

### Source-line comparison (pinned V3.4 archives)

| Model | Own code: physical lines | Code including vendored/generated files | Git-tracked files |
| --- | ---: | ---: | ---: |
| Gemini 3.8 Flash | 6,630 | 6,630 | 188 |
| GPT-6.1 Sol | 720 | 720 | 104 |
| GPT-6 Astra | 1,106 | 513,771 | 1,183 |
| Opus 5.5 | **10,566** | **1,261,313** | 2,100 |

Counted from the **pinned Git blobs**, reproducibly with `python scripts/count-racing-source-lines.py` from the repository root. Physical lines include blanks and comments (not language-aware logical statements). “Own code” includes JS/TS, Python, HTML, CSS and other code extensions while excluding bundled dependencies (`node_modules/`, `vendor/`), builds (`dist/`), images, generated/verification artifacts and JSON/data. “Including vendored/generated” counts code files inside those directories too, **not** binary media or JSON. Opus's snapshot contains 1,495 tracked `node_modules/` files. Minification and generated code can radically distort both comparisons; **line count is not a quality or benchmark score**.

The Astra source reports **33/34 automated checks passed but overall benchmark FAILED**: the High preset did not meet 60 FPS; visual gates P2–P4 lack demonstrated approval. This is a run record, not a passing score. The complete tracked source snapshot and SHA-256 manifest are now archived here at the pinned commit.

The Opus 5.5 source reports **all automated tests passing** and **134.9 FPS average in High** on an RTX 3070 Ti. The specified RTX 3060 and integrated-GPU targets were not measured, and visual approval was not independently verified. Its full tracked source snapshot is archived; the [game URL](https://racing-opus-5.5.biel.dev.br/) was provided by the owner.

## Historical source archives — Racing V2.6

These three source snapshots and their full Git history bundles are preserved unchanged; they are no longer current Racing-bench runs. No old game-site URLs are promoted.

| Historical model | Archived source | Provenance | Git bundle |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Source](./runs/gpt-6.1-sol/source/) | [Provenance](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash (V2.6)** | [Source](./runs/gemini-3.8-flash/source/) | [Provenance](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Source](./runs/gpt-6-astra/source/) | [Provenance](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

For historical V2.6 reproduction, the [original prompt](./prompts/racing-v2.6.md) and [mandatory execution addendum](./EXECUTION-ADDENDUM.md) are required **BOTH** together. Prompts [V3.1](./prompts/racing-v3.1.md), [V3.2](./prompts/racing-v3.2.md) and [V3.3](./prompts/racing-v3.3.md) are preserved byte-for-byte.
