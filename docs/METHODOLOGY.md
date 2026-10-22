# Benchmark methodology

**Frontier Models** is an archive of model-produced projects and the evidence needed to compare them fairly. The repository is designed around one principle: **evaluation should happen after generation, not inside the model's working context**.

## 1. Experimental isolation

Each model receives the intended benchmark prompt without being told about another contender's output, score, implementation choices or evaluator commentary. Model run folders therefore contain project artifacts, not hidden benchmark guidance.

## 2. Immutable run snapshots

Every evaluated run is pinned to the strongest exact source provenance available. Prefer an exact source commit when Git metadata exists; when a supplied artifact contains no Git history, pin the exact source archive with a cryptographic hash instead of inventing a commit. A rebuild is a new run even when it comes from the same model family.

## 3. Prompt provenance

The exact prompt text is archived separately under the benchmark's `prompts/` directory. Prompts are copied verbatim. A prompt that cannot be recovered exactly is marked pending rather than reconstructed.

## 4. Run configuration metadata

Record model/version, input provenance, source commit or archive hash, artifact state and evaluation status. Display labels omit provider-specific effort tiers.


## 5. Current arena and historical runs

A historical run may remain valuable without belonging in the current head-to-head. The Solar System reference arena includes verified Frontier V2 runs and source-pinned or source-archived references whose exact generating prompt is unknown. Membership alone never implies shared input or a comparable score. GPT-5.6 Sun V1 is preserved for prompt-leverage history but hidden from the current arena because it used a different input.

## 6. Evaluation dimensions

### Product quality
- visual hierarchy and first impression
- completeness of the requested experience
- interaction design and discoverability
- responsive behavior and accessibility
- error states, onboarding and polish

### Technical quality
- architecture and maintainability
- correctness of state and simulation logic
- performance characteristics
- dependency discipline
- robustness and graceful degradation
- testability and validation evidence

### Domain fidelity
For the Solar System benchmark this includes orbital behavior, time semantics, scale explanations, astronomical data handling, scientific caveats, object hierarchy, Moon/Earth behavior and the distinction between visualization and precise ephemerides.

### Instruction fidelity
A feature is not rewarded merely because it is impressive. The evaluator checks whether it was actually requested, whether required behavior works and whether optional additions damage usability or correctness.

## 7. Evidence before score

Scores should be derived from inspectable evidence: source files, screenshots, reproducible test reports, console/runtime checks, responsive captures and direct interaction. Claims without evidence are marked unverified.

## 8. Suggested scoring model

| Dimension | Weight |
| --- | ---: |
| Feature completeness | 20 |
| Interaction / UX | 15 |
| Visual execution | 15 |
| Correctness / domain fidelity | 15 |
| Robustness | 10 |
| Performance | 10 |
| Code / architecture | 10 |
| Accessibility / responsive behavior | 5 |

If a future benchmark uses different priorities, record a separate rubric instead of silently changing these weights.

## 9. Tie-breaking

When total scores are close, prefer the run with fewer critical defects, stronger instruction fidelity and more reproducible evidence. Avoid using subjective visual preference as the sole tie-breaker.

## 10. Repository hygiene

- keep generated runs separate from evaluator-authored files;
- preserve immutable source provenance: commit IDs where available, verified archive hashes where Git metadata is absent;
- do not edit a model's files merely to make the archive prettier;
- keep current-arena presentation separate from historical preservation;
- put screenshots and scorecards in evaluation directories, not inside model snapshots unless they were originally produced by that model;
- record missing information explicitly.

## 11. Interpretation

This repository measures performance on the documented tasks and conditions. It is not a universal ranking of model intelligence. A frontier model may dominate one benchmark and lose another because the tasks stress different capabilities.
