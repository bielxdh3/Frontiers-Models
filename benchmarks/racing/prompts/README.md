# Racing-bench prompt archive

Benchmark prompts are immutable inputs. Preserve each version byte-for-byte once used, and record its provenance. The canonical prompt currently published is:

| Prompt | Version | Size | Lines | SHA-256 |
| --- | --- | ---: | ---: | --- |
| [racing-v2.6.md](./racing-v2.6.md) | V2.6 | 80,309 bytes | 429 | `8dc65f23a8eaa35a06a7833a7929763fd16aa3cde2ff563561bffac7d7d69248` |

Original supplied filename: `Racing-bench-v2.6-prompt.md`.

**Execution rule:** Every new Racing-bench V2.6 run must receive both the exact prompt above and the [Mandatory Execution Addendum](../EXECUTION-ADDENDUM.md) together. The addendum authorizes only the use of operational browser/build/debug/test skills and tools for the assigned project and does not modify the immutable prompt. Record in the run's provenance whether the addendum was provided at the beginning or introduced mid-run.

Run source files belong under a separately documented run/archive path only after their origin and prompt association can be verified. Earlier draft prompts and review handoffs have not been published here.
