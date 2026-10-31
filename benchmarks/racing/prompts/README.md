# Racing-bench prompt archive

Benchmark prompts are immutable inputs. Preserve each version byte-for-byte once used, and record its provenance. The canonical prompt currently published is:

| Prompt | Version | Size | Lines | SHA-256 |
| --- | --- | ---: | ---: | --- |
| [racing-v2.6.md](./racing-v2.6.md) | V2.6 | 80,309 bytes | 429 | `8dc65f23a8eaa35a06a7833a7929763fd16aa3cde2ff563561bffac7d7d69248` |

Original supplied filename: `Racing-bench-v2.6-prompt.md`.

## Mandatory companion for executions

Attach [execution-tooling-clarification-v1.md](./execution-tooling-clarification-v1.md) alongside the V2.6 prompt **for every new task**. It expressly permits operational browser/build/testing skills while preserving clean-room restrictions. For a run already started, send it as a documented follow-up instead. Keep the historical prompt's bytes and SHA-256 unchanged, and record whether and when each run received the clarification.

Companion SHA-256: `f7d453031e4ad86c6dd2053857e79b419c419fcb1bed4b8fd42e0be7e432b9bb` (3,248 UTF-8 bytes, 23 lines).

Run source files belong under a separately documented run/archive path only after their origin and prompt association can be verified. Earlier draft prompts and review handoffs have not been published here.
