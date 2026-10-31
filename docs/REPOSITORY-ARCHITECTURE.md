# Repository architecture

**Frontier Models** is organized as **benchmark → prompts → runs → provenance**. Runs live side by side rather than on permanent per-model branches.

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
      ├─ README-PT-BR.md
      ├─ RUNS.json
      └─ prompts/
         ├─ README.md
         └─ racing-v2.6.md
```

## Run snapshots and source pins

A vendored run folder contains a self-contained copy of model-produced files from an exact pinned source. A source-pinned record can appear in `RUNS.json` before full vendoring; it must not be described as a complete snapshot.

## Current references and history

The Solar System current arena contains GPT-6.1 Sol, GPT-6 Astra, Grok 4.7 Solar, Fable 5.1 and Gemini 4 Argon. Historical and non-frontier runs remain discoverable. GPT-5.6 Sun V1 uses a different prompt and is kept outside the current reference hero.

## Provenance and future benchmarks

`RUNS.json` records source commit or archive hash, model, prompt reference, local path, archival state, display grouping and live URL. Prompts and snapshots are not rewritten when presentation changes.

Add new benchmark directories under `benchmarks/`. Each should preserve its exact input, original output or pinned source, and verifiable provenance.

Racing-bench currently archives only its V2.6 prompt, with an empty run registry until source provenance for a completed execution becomes available. The Orbitarium/Solar System archive and its existing paths remain unchanged.
