# Racing-bench V2.6 — Mandatory Execution Addendum

**Required companion to `prompts/racing-v2.6.md` for every new execution of the benchmark.** Supply **both complete documents together** to the executing model at the start of the task. This is a clarification of tool access, not a replacement for or revision of the archived V2.6 prompt.

## Operational skills and tools: explicitly permitted

You **may use the skills, MCP tools, browser tools and their strictly necessary operational instructions** to open, interact with, inspect, debug and test **your own assigned Racing-bench project**. This includes browser/preview automation (for example Playwright or browser DevTools), screenshots, console inspection, local rendering, build tools, test runners and debugging. A platform skill or tool guide may be read **only to learn how to operate one of these permitted tools**, and only to the extent necessary for that operation.

These operational tools are permitted **during development and verification**, not just to deliver the final preview. **Do not interpret a blanket instruction such as “do not use any skills” as prohibiting these limited testing and tool-operation capabilities.** You do not have to invoke a skill when normal built-in tools suffice.

## Boundaries that remain unchanged

- **No additional project instructions:** Tool-operation documentation is not a second project brief. Do not use unrelated design, coding, planning, review or implementation skills as sources of project requirements, ideas, templates or solutions. Do not consult `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, personal instructions, saved skills, or memory files for project guidance.
- **No delegation:** Do not ask other AI agents, external generative systems or connectors to implement or review the game.
- **No other files or accounts:** Stay within the explicitly designated project root; do not browse Downloads, Desktop, other repositories/worktrees, private files, browser profiles or connected accounts. Ordinary tool-created OS temp files and package caches are allowed as described in V2.6, but their unrelated contents are not sources.
- **No prohibited code research:** Do not inspect GitHub repositories, other projects' implementations, code search, tutorials or completed examples. Only the narrowly permitted official API documentation, local installed package type definitions/README files, and public visual references described in V2.6 may be consulted.
- **No new permissions to publish:** This addendum does not permit commits, pushes, merges, external deployment, private-data access, runtime network dependencies, or any other action prohibited by V2.6.

The original V2.6 prompt still controls all product, gameplay, architecture, artistic, privacy and quality requirements. **If its blanket skill ban conflicts with the permission above for operating the project's local build, browser, debugging or tests, this addendum controls only that narrow conflict.** Mandatory platform and safety rules always take precedence.

## How to start or clarify a run

Attach `prompts/racing-v2.6.md` **and** `EXECUTION-ADDENDUM.md` in the same execution request. The following launch message may accompany the two files:

> Execute Racing-bench V2.6 using both attached documents. The Mandatory Execution Addendum expressly allows operational browser, build, debugging and testing skills/tools for this project's own implementation and verification, while all clean-room, privacy, code-research and non-delegation restrictions remain in force. Follow the complete benchmark prompt; use the addendum only for this tool-access clarification.

If a benchmark run **already started without this addendum**, send the **same complete clarification to every affected participant**, record that it was introduced mid-run, and do not claim those participants received it from the start. Keep the exact V2.6 prompt unchanged so the two inputs and their provenance remain distinguishable.
