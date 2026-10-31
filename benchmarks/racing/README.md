# Racing-bench

**Benchmark 002 — a complete browser-based cinematic arcade racing game.**

The canonical implementation brief is [Racing-bench V2.6](./prompts/racing-v2.6.md). It specifies an original, complete 3D arcade racing experience intended for independent execution in an isolated project workspace. See the prompt for the actual requirements and permitted resources.

## Required for every execution

**Always supply BOTH documents together** to the model starting a Racing-bench run:

1. [Racing-bench V2.6 — implementation prompt](./prompts/racing-v2.6.md)
2. [Mandatory Execution Addendum — operational skills/tools clarification](./EXECUTION-ADDENDUM.md)

The addendum authorizes the operational browser, build, debugging and testing skills/tools needed to inspect **the model's own project** while keeping the clean-room, filesystem, research and non-delegation rules intact. It is **not** permission to use external coding assistance or inspect unrelated data. Do not distribute or launch V2.6 with the prompt alone. For an already-running attempt, communicate the same addendum to all participants and record that it was introduced after their start.

## Archive status

- **Prompt:** V2.6, published verbatim with a SHA-256 integrity record in [the prompt archive](./prompts/README.md).
- **Companion:** the separate, mandatory [Execution Addendum](./EXECUTION-ADDENDUM.md) is recorded independently so the original prompt's hash and provenance remain unchanged.
- **Source snapshots:** both participant repositories have been archived from exact Git commits, preserving **all Git-tracked files** and the **complete original Git history** in restorable bundles:

  | Source | Archived source | Provenance / SHA-256 manifest | Git-history backup |
  | --- | --- | --- | --- |
  | GPT-6.1 Sol (82 files) | [Source files](./runs/gpt-6.1-sol/source/) | [Provenance](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) · [File checksums](./runs/gpt-6.1-sol/SOURCE-FILES.json) | [Git bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
  | Gemini 3.8 Flash (38 files) | [Source files](./runs/gemini-3.8-flash/source/) | [Provenance](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) · [File checksums](./runs/gemini-3.8-flash/SOURCE-FILES.json) | [Git bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |

- **Registry:** [RUNS.json](./RUNS.json) pins both source commits, original URLs, manifests and restorable bundles. Source archival **does not** assert that gameplay or browser acceptance tests passed.

All original files, including source code and recorded screenshots/build output present in Git, remain unchanged. The original repositories may be removed after the archive has been verified on the merged main branch; note that GitHub-specific repository settings, issues, and other metadata are not part of these code archives.

This archive records projects and provenance. It does **not** grade, rank, or score AI models.
