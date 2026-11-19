# Racing-bench V3.4 / V3.4.1

**Benchmark 002 — especificação atual, focada na corrida**

## Prompt e execução atual

O [prompt V3.4](./prompts/racing-v3.4/racing-v3.4.md), junto às [14 imagens de referência](./prompts/racing-v3.4/refs/), é o pacote atual: uma pista costeira, cinco rivais de IA e corridas de 3 ou 6 voltas.

**Próximas execuções — V3.5:** [Prompt](./prompts/racing-v3.5/racing_bench_v3_5.md) · [14 referências](./prompts/racing-v3.5/refs/). Sem resultados V3.5 registrados ainda.

| Modelo atual | Jogar | Código-fonte | Tokens | Tempo |
| --- | --- | --- | ---: | ---: |
| ☀️ **GPT-6.1 Sol** | [Jogar](https://racing-gpt-6.1-sol.biel.dev.br/) | [GPT-6.1 Sol](./runs/gpt-6.1-sol-v3.4/source/) | — | — |
| ✦ **GPT-6.2 Astra (V3.4.1)** | [Jogar](https://racing-gpt-6.2-astra.biel.dev.br/) | [GPT-6.2 Astra (V3.4.1)](./runs/gpt-astra-6.2-v3.4.1/source/) | 21,55%\* | 5 h 02 min\* |
| ♬ **Opus 5.5** | [Jogar](https://racing-opus-5.5.biel.dev.br/) | [Opus 5.5](./runs/opus-5.5-v3.4/source/) | — | — |
| ✧ **Fable 5.2 (V3.4.1)** | [Jogar](https://racing-fable-5.2.biel.dev.br/) | [Fable 5.2 (V3.4.1)](./runs/fable-5.2-v3.4.1/source/) | ~475,74 M | ~11 h |
| ◈ **Gemini 4 Argon** | [Jogar](https://racing-gemini-4-argon.biel.dev.br/) | [Gemini 4 Argon](./runs/gemini-4-argon-v3.4/source/) | — | — |
| ⬡ **Gemini 4 Hydrogen** | [Jogar](https://racing-gemini-4-hydrogen.biel.dev.br/) | [Gemini 4 Hydrogen](./runs/gemini-4-hydrogen-v3.4/source/) | — | — |

*Desde a V3.4.1: tokens totais (incluindo cache) e tempo ativo estimado de execução, quando disponíveis. — = não registrado. [Métricas e limitações](./EXECUTION-METRICS.md).*

\* GPT-6.2 Astra: 21,55% da cota semanal do Plus (chat completo; 98% de participação do Astra) (informado pelo mantenedor; sem contagem de tokens). 5 h 02 min = intervalo decorrido observado, não tempo ativo comprovado.

[Prompt V3.4.1](./prompts/racing-v3.4/racing-v3.4.1.md) · [Anexo operacional](./EXECUTION-ADDENDUM.md) · [Métricas de código](./SOURCE-METRICS.md) · [Registros e proveniência](./RUN-PROVENANCE.md) · [Prompts anteriores](./prompts/README.md).

## Histórico arquivado — Racing V2.6

| Modelo histórico | Código arquivado | Proveniência | Histórico Git |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Código](./runs/gpt-6.1-sol/source/) | [Proveniência](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash (V2.6)** | [Código](./runs/gemini-3.8-flash/source/) | [Proveniência](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Código](./runs/gpt-6-astra/source/) | [Proveniência](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

Para reproduzir a V2.6, forneça **OS DOIS** documentos: o [prompt original](./prompts/racing-v2.6.md) e o [adendo operacional atemporal](./EXECUTION-ADDENDUM.md). Os prompts [V3.1](./prompts/racing-v3.1.md), [V3.2](./prompts/racing-v3.2.md) e [V3.3](./prompts/racing-v3.3.md) permanecem intactos.

## Racing não frontier

| Modelo | Categoria | Site | Código-fonte |
| --- | --- | --- | --- |
| ◈ **Gemini 3.8 Flash** | Não frontier | Deleted | [Código](./runs/gemini-3.8-v3.4/source/) |
| ✧ **Sonnet 5.5** | Não frontier | [Jogar](https://racing-sonnet-5.5.biel.dev.br/) | [Sonnet 5.5](./runs/sonnet-5.5-v3.4/source/) |
| ✦ **GPT-6 Astra** | Não frontier | [Jogar](https://racing-gpt-6-astra.biel.dev.br/) | [GPT-6 Astra](./runs/gpt-6-astra-v3.4/source/) |
