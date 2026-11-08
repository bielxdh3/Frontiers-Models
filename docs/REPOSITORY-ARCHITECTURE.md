# Repository architecture

**Frontier Models** is organized as **benchmark → prompts → runs → provenance**. Runs live side by side rather than on permanent per-model branches.

**Orbitarium-bench** is the current display name of the legacy `benchmarks/solar-system/` archive. Its existing path, source snapshots, and exact archived prompts remain unchanged for provenance and link stability.

```text
Frontiers-Models/
├─ README.md
├─ README-PT-BR.md
├─ assets/
│  └─ frontier-models-hero-v7.svg
├─ docs/
│  ├─ METHODOLOGY.md
│  └─ REPOSITORY-ARCHITECTURE.md
├─ scripts/
│  ├─ render-benchmark-assets.mjs
│  ├─ verify-argon-archive.mjs
│  └─ verify-sol-archive.mjs
└─ benchmarks/
   ├─ solar-system/
   │  ├─ README.md
   │  ├─ README-PT-BR.md
   │  ├─ RUNS.json
   │  ├─ *-PROVENANCE.md
   │  ├─ *-FILES.json
   │  ├─ prompts/
   │  │  ├─ sun-original.md
   │  │  └─ frontier-v2.md
   │  └─ runs/
   │     ├─ gpt-5.6-sun-max/
   │     ├─ gpt-6.1-sol/
   │     ├─ gpt-6-astra-max/
   │     ├─ grok-4.6/
   │     ├─ grok-4.7/
   │     ├─ fable/
   │     ├─ gemini-4-argon/
   │     └─ gemini-3.8-flash/
   └─ racing/
      ├─ README.md
      ├─ EXECUTION-ADDENDUM.md
      ├─ README-PT-BR.md
      ├─ RUNS.json
      ├─ prompts/
      │  ├─ README.md
      │  ├─ racing-v2.6.md  (legacy)
      │  ├─ racing-v3.1.md  (historical, frozen)
      │  ├─ racing-v3.2.md  (historical, frozen; premium UI/UX)
      │  ├─ racing-v3.3.md  (historical, frozen; coastal city and beach art)
      │  ├─ racing-v3.4/     (current prompt + 14 visual references)
      │  ├─ racing-v3.1-attach.md
      │  ├─ racing-v3.2-attach.md
      │  └─ racing-v3.3-attach.md  (historical operational note)
      └─ runs/
         ├─ gpt-6.1-sol/
         │  ├─ SOURCE-PROVENANCE.md
         │  ├─ SOURCE-FILES.json
         │  ├─ SOURCE-REPOSITORY.bundle
         │  └─ source/
          ├─ gemini-3.8-flash/
          │  ├─ SOURCE-PROVENANCE.md
          │  ├─ SOURCE-FILES.json
          │  ├─ SOURCE-REPOSITORY.bundle
          │  └─ source/
          ├─ gpt-6-astra/
          │  ├─ SOURCE-PROVENANCE.md
          │  ├─ SOURCE-FILES.json
          │  ├─ SOURCE-REPOSITORY.bundle
          │  └─ source/
          ├─ gemini-3.8-v3.4/ (current; 188-file snapshot)
          │  ├─ SOURCE-PROVENANCE.md
          │  ├─ SOURCE-FILES.json
          │  └─ source/
          ├─ gpt-6.1-sol-v3.4/ (current; 104-file snapshot)
          │  ├─ SOURCE-PROVENANCE.md
          │  ├─ SOURCE-FILES.json
          │  └─ source/
          ├─ gpt-6-astra-v3.4/ (current; 1183-file snapshot)
          │  ├─ SOURCE-PROVENANCE.md
          │  ├─ SOURCE-FILES.json
          │  └─ source/
          ├─ opus-5.5-v3.4/ (current; 2100-file snapshot; owner-provided URL HTTP 404)
          │  ├─ SOURCE-PROVENANCE.md
          │  ├─ SOURCE-FILES.json
          │  └─ source/
          └─ gemini-4-argon-v3.4/ (current; 450-file snapshot)
             ├─ SOURCE-PROVENANCE.md
             ├─ SOURCE-FILES.json
             └─ source/
```

## Run snapshots and source pins

A vendored run folder contains a self-contained copy of model-produced files from an exact pinned source. A source-pinned record can appear in `RUNS.json` before full vendoring; it must not be described as a complete snapshot.

## Current references and history

The Orbitarium-bench current arena contains GPT-6.1 Sol, GPT-6 Astra, Grok 4.7, Fable 5.1 and Gemini 4 Argon. Historical and non-frontier runs remain discoverable. GPT-5.6 Sol V1 uses a different prompt and is kept outside the current reference hero.

## Provenance and future benchmarks

`RUNS.json` records source commit or archive hash, model, prompt reference, local path, archival state, display grouping and live URL. Prompts and snapshots are not rewritten when presentation changes.

Add new benchmark directories under `benchmarks/`. Each should preserve its exact input, original output or pinned source, and verifiable provenance.

Racing-bench V3.4 is the current race-first specification with 14 required visual references and six current Racing runs: **Gemini 3.8 Flash (V3.4)** ([source](../benchmarks/racing/runs/gemini-3.8-v3.4/source/), [live site](https://racing-gemini-3.8-flash.biel.dev.br/)), **GPT-6.1 Sol (V3.4)** ([source](../benchmarks/racing/runs/gpt-6.1-sol-v3.4/source/), [owner-provided site](https://racing-gpt-6.1-sol.biel.dev.br/)), and **GPT-6 Astra (V3.4)** ([source archive](../benchmarks/racing/runs/gpt-6-astra-v3.4/source/), [owner-provided game URL](https://racing-gpt-6-astra.biel.dev.br/), HTTP 404 on 2026-11-05), and **Opus 5.5 (V3.4)** ([source archive](../benchmarks/racing/runs/opus-5.5-v3.4/source/), [owner-provided game URL](https://racing-opus-5.5.biel.dev.br/), HTTP 404 on 2026-11-05). Gemini's 188 Git-tracked files, Sol's 104 files, and Astra's 1,183 files and Opus 5.5's 2,100 files are archived separately with SHA-256 checksums at pinned commits (Gemini's external LFS video is not bundled). Opus 5.5's upstream report says its automated tests passed and 134.9 FPS High on RTX 3070 Ti, but the RTX 3060 and integrated-GPU targets were not measured. Astra's upstream report says 33/34 checks passed but the overall benchmark failed the High preset FPS target and visual gates P2–P4 were not demonstrated. Current-run membership does not imply benchmark acceptance. The Gemini site responded HTTP 200 on 2026-11-02; gameplay was not independently verified. V3.3 is a preserved frozen historical specification with complete premium UI/UX (G12), high-quality coastal-city and beach environmental art (G13), 10 dedicated W01–W10 world-art inspections, and 38+ screenshot requirements. V3.2 and V3.1 prompts and attachments remain intact for archival reproduction. The three prior V2.6 projects are legacy/archived with retired public-game links omitted from the index; their exact source trees, SHA-256 manifests and Git-history bundles remain unchanged. The Orbitarium/Solar System archive and its existing paths remain unchanged.

Gemini 4 Argon Racing V3.4 is current: [play](https://racing-gemini-4-argon.biel.dev.br/), [complete local source](../benchmarks/racing/runs/gemini-4-argon-v3.4/source/), [SHA-256 provenance](../benchmarks/racing/runs/gemini-4-argon-v3.4/SOURCE-PROVENANCE.md). The original source repository URL is intentionally not referenced. This run adds 450 Git-tracked blobs while its original prompt delivery and gameplay acceptance remain unverified. The [version-independent operational companion](../benchmarks/racing/EXECUTION-ADDENDUM.md) consists solely of the three owner-provided paragraphs; no copy of its former contents is retained.

Sonnet 5.5 is the sixth current Racing V3.4 entry, distinct from Opus 5.5. [Play the owner-designated site](https://racing-sonnet-5.5.biel.dev.br/), [browse the pinned local source](../benchmarks/racing/runs/sonnet-5.5-v3.4/source/), and [inspect its source provenance](../benchmarks/racing/runs/sonnet-5.5-v3.4/SOURCE-PROVENANCE.md). Source commit `f2400ade4bb8485c768adfa379fd1b4f0d958807` and tree `de894f9787d161fd35e96f0dd993eab3984ca453` contain 2,085 tracked regular files. Original prompt delivery and independent game acceptance are not established; the original source repository is not linked.
