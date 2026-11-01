# Racing-bench V3.2

**Benchmark 002 — current frozen standalone specification**

## Official current prompt

**[Racing-bench V3.2](./prompts/racing-v3.2.md)** is the only active execution contract. It specifies three dedicated tracks/modes, four high-detail cars, five local AI opponents, three additional orthogonal Signature Features, 16 mandatory expansion systems E01–E16, detailed photoreal PBR/GPU graphics, deep vehicle physics, Photo Mode and verified full-state replays.

**Attach both documents to every V3.2 run:** (1) the unchanged [Racing-bench V3.2 prompt](./prompts/racing-v3.2.md), and (2) the short [mandatory operational clarification](./prompts/racing-v3.2-attach.md). This clarification explicitly permits the tools needed for browsing, Playwright, DevTools, builds, debugging and testing this project. **Do not attach review contexts or the historical V2.6 addendum.** No V3.2 model run or live game is published yet.

**New mandatory V3.2 scope:** A premium game-specific visual and interaction experience for every menu, mode, garage, E04 tuning, E10 builder, E09 track editor, mode-specific HUD, pause/service, results, replays, Photo Mode, settings and error/recovery state. In addition to G1–G11, **G12** requires **16 U01–U16 experience probes** and **12 additional UI screenshots**, for at least **28 genuine screenshots** overall. A generic dashboard or unfinished browser-form interface fails G12.

The original [V3.1 prompt](./prompts/racing-v3.1.md) and its [historical short attachment](./prompts/racing-v3.1-attach.md) remain archived unchanged.

## Legacy archived runs — V2.6

The three former Racing projects are **legacy/archived**, not current V3.2 contestants. Their old live-game URLs have been removed from this index.

| Legacy model | Archived source | Provenance and checksums | Git-history bundle |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Source](./runs/gpt-6.1-sol/source/) | [Provenance](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) · [Manifest](./runs/gpt-6.1-sol/SOURCE-FILES.json) | [Git bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash** | [Source](./runs/gemini-3.8-flash/source/) | [Provenance](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) · [Manifest](./runs/gemini-3.8-flash/SOURCE-FILES.json) | [Git bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Source](./runs/gpt-6-astra/source/) | [Provenance](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) · [Manifest](./runs/gpt-6-astra/SOURCE-FILES.json) | [Git bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

The [original V2.6 prompt](./prompts/racing-v2.6.md) is preserved byte-for-byte. Historical V2.6 runs required **BOTH** the V2.6 prompt and the [separate Mandatory Execution Addendum](./EXECUTION-ADDENDUM.md). This separate addendum is not required for V3.2. The [registry](./RUNS.json) retains provenance but no retired public-game links. Archived code does not guarantee verified gameplay.

No review `context.md` is part of the current benchmark publication.
