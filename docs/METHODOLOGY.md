# Benchmark archive methodology

**Frontier Models** preserves model-generated projects, exact benchmark inputs and independently verifiable source provenance. It does not modify a model's output to fit a presentation.

## 1. Independent generation

Each model receives its designated input without access to other contenders' implementations or post-hoc hints. Differences between archived input prompts must be disclosed, not hidden.

## 2. Immutable project snapshots

Model-produced files are preserved verbatim under each benchmark's `runs/` directory. When available, each run records its original Git commit; otherwise, the archived source hash provides an immutable reference. A rebuild is a distinct run.

## 3. Exact prompt provenance

Preserve original prompts separately under `prompts/`, including byte counts and cryptographic checksums when known. If a run's generating prompt cannot be recovered, explicitly state that it is unverified instead of assuming it matches another run.

## 4. Run registry

`RUNS.json` records model label, source location and commit/hash, local archive path, prompt provenance, current/historical grouping and live URL when available. The current reference arena is a display grouping, not a claim that all inputs were identical.

## 5. Integrity and reproducibility

Keep source manifests and verification scripts executable. Preserve links to original repositories and public deployments. Record known gaps (such as source-only references) rather than inventing archive contents or missing prompt evidence.

## 6. Repository hygiene

- Do not rewrite or normalize files in archived `runs/` snapshots.
- Keep provenance records and scripts outside model-produced output.
- Preserve exact input prompts and hash/commit references.
- Retain historical runs separately from current reference presentation.
- Treat every run as an inspectable project; do not infer a universal ordering from archive membership.
