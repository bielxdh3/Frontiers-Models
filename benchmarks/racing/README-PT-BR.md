# Racing-bench V3.4

**Benchmark 002 — especificação atual, focada na corrida**

## Prompt e execução atual

O [prompt V3.4](./prompts/racing-v3.4/racing-v3.4.md), junto às [14 imagens de referência](./prompts/racing-v3.4/refs/), é o pacote atual: uma pista costeira, cinco rivais de IA e corridas de 3 ou 6 voltas.

| Modelo atual | Jogar | Código-fonte |
| --- | --- | --- |
| **Gemini 3.8 Flash (V3.4)** | [Jogar](https://racing-gemini-3.8-flash.biel.dev.br/) | [Source — gemini-3.8](https://github.com/bielxdh3/gemini-3.8) |
| **GPT-6.1 Sol (V3.4)** | [Jogar](https://racing-gpt-6.1-sol.biel.dev.br/) | [Código — arquivado aqui](./runs/gpt-6.1-sol-v3.4/source/) |
| **GPT-6 Astra (V3.4)** | [Jogar](https://racing-gpt-6-astra.biel.dev.br/) (HTTP 404 em 05/11) | [Código — arquivado aqui](./runs/gpt-6-astra-v3.4/source/) |
| **Alpha 5.5 (V3.4)** | Site pendente — ainda sem link público | [Código — arquivado aqui](./runs/alpha-5.5-v3.4/source/) |

**Proveniência das fontes V3.4:** [Gemini 3.8 Flash](./runs/gemini-3.8-v3.4/SOURCE-PROVENANCE.md) · [GPT-6.1 Sol](./runs/gpt-6.1-sol-v3.4/SOURCE-PROVENANCE.md) · [GPT-6 Astra](./runs/gpt-6-astra-v3.4/SOURCE-PROVENANCE.md) · [Alpha 5.5](./runs/alpha-5.5-v3.4/SOURCE-PROVENANCE.md). Prompts anteriores: [V3.3](./prompts/racing-v3.3.md), [V3.2](./prompts/racing-v3.2.md), [V3.1](./prompts/racing-v3.1.md).

O Astra informa **33/34 verificações automatizadas, mas benchmark integral REPROVADO**: o preset Alto não alcançou 60 FPS e os portões visuais P2–P4 não tiveram aprovação demonstrada. A execução é registrada sem simular aprovação; todos os arquivos Git de origem foram preservados em snapshot integral com manifesto SHA-256.

O Alpha 5.5 informa **todos os testes automatizados aprovados** e média de **134,9 FPS em Alta na RTX 3070 Ti**. As metas para RTX 3060 e GPU integrada não foram medidas, e a aceitação visual não foi verificada independentemente. O código completo está arquivado; **o link público ainda não está pronto**.

## Histórico arquivado — Racing V2.6

As três execuções históricas têm fontes, manifestos e históricos Git preservados, mas não aparecem na vitrine atual. Os endereços antigos não são promovidos.

| Modelo histórico | Código arquivado | Proveniência | Histórico Git |
| --- | --- | --- | --- |
| **GPT-6.1 Sol** | [Código](./runs/gpt-6.1-sol/source/) | [Proveniência](./runs/gpt-6.1-sol/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6.1-sol/SOURCE-REPOSITORY.bundle) |
| **Gemini 3.8 Flash (V2.6)** | [Código](./runs/gemini-3.8-flash/source/) | [Proveniência](./runs/gemini-3.8-flash/SOURCE-PROVENANCE.md) | [Bundle](./runs/gemini-3.8-flash/SOURCE-REPOSITORY.bundle) |
| **GPT-6 Astra** | [Código](./runs/gpt-6-astra/source/) | [Proveniência](./runs/gpt-6-astra/SOURCE-PROVENANCE.md) | [Bundle](./runs/gpt-6-astra/SOURCE-REPOSITORY.bundle) |

Para reproduzir a V2.6, forneça **OS DOIS** documentos: o [prompt original](./prompts/racing-v2.6.md) e o [adendo de execução](./EXECUTION-ADDENDUM.md). Os prompts [V3.1](./prompts/racing-v3.1.md), [V3.2](./prompts/racing-v3.2.md) e [V3.3](./prompts/racing-v3.3.md) permanecem intactos.
