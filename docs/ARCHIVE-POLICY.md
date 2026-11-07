# Benchmark archive policy

## English

- model output stays untouched inside archived `runs/` snapshots;
- archive metadata stays outside model output;
- exact prompts are archived separately and verbatim;
- Git commits are used when source Git metadata exists;
- cryptographic source-archive hashes are used when it does not;
- a source repository may be commit-pinned while its vendored snapshot is still pending;
- historical runs remain preserved without cluttering the current arena.

Original project outputs stay byte-preserved. Source-provenance statements and verification notes belong in benchmark/run-specific metadata and reports, never a showcase README. New benchmark imports link to the archived Frontiers copy, not to a repository that may be deleted.

## Português

- resultados dos modelos permanecem intocados dentro dos snapshots arquivados em `runs/`;
- metadados do arquivo ficam fora dos resultados dos modelos;
- prompts exatos são arquivados separadamente e sem alterações;
- commits Git são usados quando existem metadados Git da fonte;
- hashes criptográficos são usados quando não existem;
- uma fonte pode ficar fixada por commit enquanto o snapshot vendorizado ainda estiver pendente;
- execuções históricas continuam preservadas sem poluir a arena atual.

Resultados originais permanecem preservados. Ressalvas, auditorias, proveniência e medições pertencem aos arquivos especializados e relatórios próximos da execução, nunca aos READMEs de apresentação. Novos benchmarks referenciam a cópia arquivada no Frontiers, não um repositório de origem sujeito à exclusão.
