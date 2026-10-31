# Racing-bench

**Benchmark 002 — jogo completo de corrida arcade cinematográfica para navegador.**

O prompt oficial para implementação é o [Racing-bench V2.6](./prompts/racing-v2.6.md). Ele descreve uma experiência 3D original e completa para execução independente em um espaço de trabalho isolado. Os requisitos e as permissões estão no próprio prompt.

## Obrigatório em toda execução

**Sempre envie os DOIS documentos juntos** ao modelo quando iniciar uma execução do Racing-bench:

1. [Racing-bench V2.6 — prompt de implementação](./prompts/racing-v2.6.md)
2. [Adendo obrigatório de execução — esclarecimento sobre skills/ferramentas](./EXECUTION-ADDENDUM.md)

O adendo autoriza skills e ferramentas operacionais de navegador, build, depuração e teste **do próprio projeto**, sem liberar consultas a outros projetos, arquivos privados, soluções externas ou outros agentes. Não inicie a V2.6 usando apenas o prompt. Para execuções já iniciadas, envie a mesma nota a todos os participantes e registre que foi fornecida durante a execução.

## Estado do arquivo

- **Prompt:** V2.6, preservado integralmente com SHA-256 registrado no [arquivo de prompts](./prompts/README.md).
- **Complemento:** [Adendo obrigatório de execução](./EXECUTION-ADDENDUM.md), registrado separadamente para manter intactos o prompt original e seu hash.
- **Arquivos das execuções:** os dois repositórios foram preservados a partir de commits exatos, incluindo **todos os arquivos rastreados pelo Git** e um **backup restaurável do histórico Git completo**:

  | Origem | Jogar | Arquivos originais | Proveniência / manifesto | Backup do Git |
  | --- | --- | --- | --- | --- |
  | GPT-6.1 Sol (82 arquivos) | [Jogar GPT-6.1 Sol](https://racing-gpt-6.1-sol.biel.dev.br) | [Código e assets](./runs/gpt-6.1-sol/source/) | [Proveniência](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) · [Hashes](./runs/gpt-6.1-sol/SOURCE-FILES.json) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
  | Gemini 3.8 Flash (38 arquivos) | [Jogar Gemini 3.8 Flash](https://racing-gemini-3.8-flash.biel.dev.br) | [Código e assets](./runs/gemini-3.8-flash/source/) | [Proveniência](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) · [Hashes](./runs/gemini-3.8-flash/SOURCE-FILES.json) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |

- **Registro:** [RUNS.json](./RUNS.json) fixa os commits, URLs, manifestos e bundles. O arquivamento **não** significa que todos os testes de gameplay/navegador tenham sido aprovados.

Os arquivos originais, incluindo código, assets, builds e capturas presentes no Git, foram preservados sem modificações. Após verificar o arquivamento na branch principal, os repositórios separados podem ser excluídos sem perder esses arquivos e históricos Git; configurações do GitHub, issues e metadados externos não estão cobertos pelo backup.

Este arquivo documenta projetos e proveniência. **Não** atribui notas, rankings ou pontuações a modelos de IA.
