# Repository architecture

**Frontier Models** is organized by **benchmark → inputs → runs → evaluation**, not by permanent branches per model.

```text
Frontier-Models/
├─ README.md
├─ assets/
│  └─ frontier-models-hero-v3.svg
├─ docs/
│  ├─ METHODOLOGY.md
│  └─ REPOSITORY-ARCHITECTURE.md
└─ benchmarks/
   └─ solar-system/
      ├─ README.md
      ├─ RUNS.json
      ├─ GROK-4.6-PROVENANCE.md
      ├─ FABLE-5.1-PROVENANCE.md
      ├─ GEMINI-3.8-FLASH-PROVENANCE.md
      ├─ prompts/
      │  ├─ README.md
      │  ├─ sun-original.md
      │  └─ frontier-v2.md
      ├─ runs/
      │  ├─ gpt-5.6-sun-max/
      │  │  ├─ original/          # historical baseline; hidden from current arena
      │  │  └─ rebuild/           # current Frontier V2 arena
      │  ├─ gpt-6-astra-max/
      │  │  └─ frontier-v2/
      │  ├─ grok-4.6/
      │  │  └─ frontier-v2/
      │  ├─ fable/
      │  │  └─ frontier-v2/       # Fable 5.1 Max
      │  └─ gemini-3.8-flash/
      │     └─ frontier-v2/        # source-pinned to exact Gemini commit
      └─ comparison/
         └─ SCORECARD.md
```

## Why folders instead of model branches?

Branches are development lines. Using them as permanent model categories makes the archive harder to browse, link and compare. Completed runs live side by side on canonical `main`; review branches are temporary.

## Current arena vs history

The current Solar System arena contains five Frontier V2 contenders:

- GPT-5.6 Sun Max V2;
- GPT-6 Astra Max;
- Grok 4.6 XHIGH;
- Fable 5.1 Max;
- Gemini 3.8 Flash High.

Sun V1 remains in the archive but is intentionally hidden from the current presentation because it used a different prompt.

## Run snapshots and source pins

A vendored run folder is an immutable, self-contained copy of the model output captured from pinned source provenance: a Git commit when available, or a verified source archive when Git metadata is absent. Evaluator-authored notes do not belong inside model snapshots.

A newly admitted run may first be represented by an **exact source commit pin** while full vendoring is pending. That state must be explicit in `RUNS.json`; it must not be described as a self-contained archived snapshot until the project files are actually vendored. Gemini 3.8 Flash High currently uses this source-pinned state.

## Provenance

`RUNS.json` records the strongest verifiable source provenance available alongside model label, run role, prompt reference, local run path, presentation state and live URL when one exists.

Reasoning-effort labels such as `Max`, `XHIGH` and `High` are preserved as run metadata where known. They are not normalized across model providers.

## Adding future benchmarks

Add a sibling under `benchmarks/`, for example:

```text
benchmarks/
├─ solar-system/
├─ full-stack-app/
├─ coding-agent/
├─ game-development/
└─ data-analysis/
```

Each benchmark should preserve the same contract: exact input, exact run or exact pinned source, explicit provenance, explicit evidence and explicit comparison.
