# Racing-bench V2.6 — mandatory execution tooling clarification

**Companion input, version 1.** Attach this file together with [the original V2.6 prompt](./racing-v2.6.md) **every time** a new Racing-bench V2.6 task is started. Supply both documents to every participant; do not rely on the model discovering this file independently. The archived V2.6 prompt must remain unmodified.

## Text to supply to the executing model

> **User-authorized clarification to Racing-bench V2.6 — tooling only.**
>
> You MAY use the skills and tools genuinely needed to build, open, inspect, debug, and test **your assigned Racing-bench project**, including browser control, browser preview, Playwright, DevTools, screenshots, build/test runners, and their corresponding MCP or platform tools. You MAY consult the minimal operational instructions for those tools or skills, including a relevant tool's `SKILL.md` where necessary. Use them to operate and verify the work, not as sources of game requirements, designs, architecture, implementation examples, or outside solutions.
>
> This clarification narrowly overrides the V2.6 prohibition on using or reading skills **for those operational purposes only**. It also supersedes any accompanying one-line instruction such as "do not consult any skill" **to that limited extent**. It does not authorize discovering unrelated skills, importing external coding/design recipes, or delegating implementation to another AI agent.
>
> Continue to obey all other Racing-bench V2.6 restrictions. In particular, do not inspect `AGENTS.md`, other assistant instruction files, memories, unrelated folders or projects, personal files, Downloads, connected accounts, private MCP data, GitHub repositories, third-party game code, implementation tutorials, or other models' outputs. Do not use external generative AI services or transfer project/user data to them. The original restrictions on permitted official API documentation, visual references, licenses, dependency registries, project-directory boundaries, and offline static gameplay remain in force.
>
> Test the actual playable build using the permitted tools when available. State truthfully what was directly inspected, exercised through an isolated test harness, or not tested. This clarification does not change game requirements or authorize commits, push, deployment, or publication by the executing model.

## Application and provenance

- **New executions:** provide the full V2.6 prompt and this full companion note in the same task handoff. If there is a separate launch message, it may simply identify both attachments; it must not prohibit the tooling this note permits.
- **Executions already in progress:** send this exact clarification to every participating model as an additional message, without restarting or pretending it was present at task start. Record which executions received it and when. Different execution conditions must not be mislabeled as identical.
- **Archive integrity:** do not insert this note into, replace, or edit `racing-v2.6.md`. Keep each run's precise prompt/addendum provenance alongside its eventual source snapshot or pinned commit.

This note clarifies **tool operation**, not the design or evaluation of the game.
