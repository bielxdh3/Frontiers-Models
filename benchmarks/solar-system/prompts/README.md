# Orbitarium-bench prompt archive

Prompts are immutable benchmark inputs. A run is only fully auditable when the exact prompt used for that run is preserved verbatim and its provenance is explicit.

| Prompt | Used by | Status |
| --- | --- | --- |
| [`sun-original.md`](./sun-original.md) | GPT-5.6 Sol V1 historical baseline | ✅ Archived verbatim |
| [`frontier-v2.md`](./frontier-v2.md) | GPT-5.6 Sol V2; GPT-6 Astra; Grok 4.6; Fable 5.1 | ✅ Archived verbatim + integrity verified |

## Frontier V2 integrity record

The shared Frontier V2 prompt was supplied as `solar-system-master-prompt.md` and archived without summarization, normalization, rewriting or reconstruction.

| Property | Verified value |
| --- | --- |
| Repository path | `benchmarks/solar-system/prompts/frontier-v2.md` |
| SHA-256 | `7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65` |
| Size | `115,983 bytes` |
| Lines | `1,153` |
| First heading | `SOLAR SYSTEM OBSERVATORY — COMPLETE INTERACTIVE EXPERIENCE` |
| Current consumers | Sol V2 + Astra + Grok 4.6 + Fable 5.1 |
| Integrity check | byte-for-byte verification passed |

## Benchmark meaning

```text
                       EXACT SAME FRONTIER V2 PROMPT
               ↙                ↓               ↓               ↘
      SOL V2         ASTRA        GROK 4.6          FABLE 5.1
```

The older `sun-original.md` remains preserved separately for historical prompt-leverage analysis and is not part of the current Frontier V2 arena.

**Naming note:** The correct model display name is **GPT-5.6 Sol** (V1 and V2), not the former English-language label. The original `sun-original.md` filename, historical `gpt-5.6-sun-max` archive paths/registry IDs and source-repository name are legacy identifiers retained to preserve archival provenance and exact source integrity; they are not current model names. Live links now follow the owner's canonical `orbitarium-gpt-5.6-sol` domains (including the exact `.sol.v1.` hostname). The astronomical Sun in imagery and source assets is unrelated to this correction.

## Integrity rule

Prompt text must never be reconstructed from memory, summarized, improved after the fact or inferred from a produced application. If an exact source cannot be recovered, the benchmark must say so rather than fabricate certainty.

Model display names omit provider-specific effort tiers; exact archived prompt and source paths are unchanged.

## Why prompts live outside run folders

The run folders contain model-produced artifacts. Prompt inputs live here so that:

- the same input can be linked to multiple runs without duplication drift;
- comparisons can distinguish prompt quality from model output quality;
- later reviewers can reproduce the experiment without inspecting unrelated source files;
- prompt revisions are explicit benchmark versions rather than hidden edits inside model code;
- integrity metadata can be checked independently of the projects that consumed the prompt.
