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
          └─ gpt-6-astra-v3.4/ (current; 1183-file snapshot)
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

Racing-bench V3.4 is the current race-first specification with 14 required visual references and three current Racing runs: **Gemini 3.8 Flash (V3.4)** ([source](https://github.com/bielxdh3/gemini-3.8), [live site](https://racing-gemini-3.8-flash.biel.dev.br/)), **GPT-6.1 Sol (V3.4)** ([source](https://github.com/bielxdh3/6.1racinsol), [owner-provided site](https://racing-gpt-6.1-sol.biel.dev.br/)), and **GPT-6 Astra (V3.4)** ([source archive](../benchmarks/racing/runs/gpt-6-astra-v3.4/source/), no public game URL). Gemini's 188 Git-tracked files, Sol's 104 files, and Astra's 1,183 files are archived separately with SHA-256 checksums at pinned commits (Gemini's external LFS video is not bundled). Astra's upstream report says 33/34 checks passed but the overall benchmark failed the High preset FPS target and visual gates P2–P4 were not demonstrated. Current-run membership does not imply benchmark acceptance. The Gemini site responded HTTP 200 on 2026-11-02; gameplay was not independently verified. V3.3 is a preserved frozen historical specification with complete premium UI/UX (G12), high-quality coastal-city and beach environmental art (G13), 10 dedicated W01–W10 world-art inspections, and 38+ screenshot requirements. V3.2 and V3.1 prompts and attachments remain intact for archival reproduction. The three prior V2.6 projects are legacy/archived with retired public-game links omitted from the index; their exact source trees, SHA-256 manifests and Git-history bundles remain unchanged. The Orbitarium/Solar System archive and its existing paths remain unchanged.
