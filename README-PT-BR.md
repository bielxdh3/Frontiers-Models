<div align="center">

<img src="./assets/frontier-models-hero-v7.svg" alt="Frontier Models — coleção de benchmarks independentes Racing e Orbitarium com sete execuções atuais" width="100%" />

<br/>

[![Benchmark](https://img.shields.io/badge/benchmark-frontier%20models-7C3AED?style=flat)](./benchmarks)
[![Benchmarks](https://img.shields.io/badge/benchmarks-2-2563EB?style=flat)](./docs/REPOSITORY-ARCHITECTURE.md)
[![Execuções atuais](https://img.shields.io/badge/execu%C3%A7%C3%B5es%20atuais-7-DB2777?style=flat)](./benchmarks/racing/RUNS.json)

# Frontier Models

**Prompts exatos. Proveniência fixada. Snapshots completos dos projetos. Evidências explícitas.**

[![English](https://img.shields.io/badge/Idioma-English-2563EB?style=flat)](./README.md)

[Abrir Racing-bench](./benchmarks/racing/) · [Abrir Orbitarium-bench](./benchmarks/solar-system/) · [Metodologia](./docs/METHODOLOGY.md)

</div>

## ⚔️ Execuções atuais por benchmark

### Racing-bench — execuções atuais

| Modelo | Execução / origem | Jogo ao vivo | Código arquivado |
| --- | --- | --- | --- |
| 🏎️ **GPT-6.1 Sol** | Fonte completa + histórico Git restaurável | [Jogar GPT-6.1 Sol](https://racing-gpt-6.1-sol.biel.dev.br) | [Código e manifesto](./benchmarks/racing/runs/gpt-6.1-sol/) |
| 🏎️ **Gemini 3.8 Flash** | Fonte completa + histórico Git restaurável | [Jogar Gemini 3.8 Flash](https://racing-gemini-3.8-flash.biel.dev.br) | [Código e manifesto](./benchmarks/racing/runs/gemini-3.8-flash/) |

Os dois projetos Racing foram arquivados a partir de commits Git exatos. Isso comprova a preservação dos arquivos, **não a aprovação independente do gameplay**. Veja o [arquivo Racing](./benchmarks/racing/) e o [adendo obrigatório de execução](./benchmarks/racing/EXECUTION-ADDENDUM.md).

### Orbitarium-bench — referências atuais

| Modelo | Execução / origem | Projeto ao vivo | Execução arquivada / fixada |
| --- | --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | Fonte arquivada / prompt não verificado | [Abrir Sol](https://orbitarium-gpt-6.1-sol.biel.dev.br) | [`runs/gpt-6.1-sol/source`](./benchmarks/solar-system/runs/gpt-6.1-sol/source/) |
| ✦ **GPT-6 Astra** | Frontier V2 | [Abrir Astra](https://orbitarium-gpt-6-astra.biel.dev.br) | [`runs/gpt-6-astra-max/frontier-v2`](./benchmarks/solar-system/runs/gpt-6-astra-max/frontier-v2/) |
| 𝕏 **Grok 4.7** | Referência com fonte fixada | [Abrir Grok 4.7](https://orbitarium-grok-4.7.biel.dev.br) | [`runs/grok-4.7/source`](./benchmarks/solar-system/runs/grok-4.7/source/) |
| ◆ **Fable 5.1** | Frontier V2 | [Abrir Fable 5.1](https://fable-solar-system.vercel.app) | [`runs/fable/frontier-v2`](./benchmarks/solar-system/runs/fable/frontier-v2/) |
| ◈ **Gemini 4 Argon** | Fonte arquivada / prompt não verificado | [Abrir Argon](https://orbitarium-gemini-4-argon.biel.dev.br) | [`runs/gemini-4-argon/source`](./benchmarks/solar-system/runs/gemini-4-argon/source/) |

O Orbitarium reúne **cinco referências atuais**. O Gemini 4 Argon e o GPT-6.1 Sol foram arquivados integralmente a partir de commits exatos, mas seus prompts de geração não foram comprovados; por isso não há comprovação de equivalência ao Frontier V2. O Gemini 3.8 Flash permanece no histórico **do Orbitarium**, mas é uma execução **atual no Racing**.

## Como se organiza

```text
          ┌──────────────────────┐   ┌──────────────────────┐
          │ Prompts do benchmark │   │ Projetos dos modelos │
          │ entradas originais   │   │ fontes / snapshots   │
          └──────────┬───────────┘   └──────────┬───────────┘
                     │                          │
                     └────────────┬─────────────┘
                                  │
                       ┌──────────▼───────────┐
                       │   Frontier Models    │
                       │ RUNS.json · 2        │
                       │ atuais · históricos  │
                       └──────┬────────┬──────┘
                              │        │
                arquivos      │        │ dados de origem
                              │        │
                    ┌─────────▼───┐ ┌──▼──────────────────┐
                    │  Snapshots  │ │ Proveniência        │
                    │ runs/       │ │ commits · hashes ZIP│
                    │ originais   │ │ status dos prompts  │
                    └─────────────┘ └──┬──────────────────┘
                                      │ links e verificações
                         ┌────────────▼────────────┐
                         │ Links dos projetos      │
                         │ Checagens SHA-256       │
                         └─────────────────────────┘
```

O registro conecta prompts arquivados, projetos independentes, evidências de origem e referências públicas. Uma fonte fixada não significa necessariamente que exista um snapshot local, e prompts sem origem verificada permanecem distintos. Veja a [arquitetura do repositório](./docs/REPOSITORY-ARCHITECTURE.md).

## 🗂️ Modelos non-frontier ou desatualizados

Estas execuções **do Orbitarium** continuam visíveis como referência, mas ficam separadas da arena atual desse benchmark. Um mesmo modelo pode participar atualmente do Racing.

| Modelo | Classificação | Projeto / fonte | Proveniência |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sol V1** | Baseline histórico | [Abrir Sol V1](https://orbitarium-gpt-5.6-sol.v1.biel.dev.br) | [Código V1](./benchmarks/solar-system/runs/gpt-5.6-sun-max/original/) · commit `67eb9fc51f…` |
| ☀️ **GPT-5.6 Sol V2** | Frontier desatualizado | [Abrir Sol V2](https://orbitarium-gpt-5.6-sol-v2.biel.dev.br) | [Código V2](./benchmarks/solar-system/runs/gpt-5.6-sun-max/rebuild/) · commit `93d43ae62f…` |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Abrir Luna](https://orbitarium-gpt-5.6-luna.biel.dev.br) | commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) |
| 𝕏 **Grok 4.6** | Execução frontier arquivada | [Abrir Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Frontier V2 arquivado | [Abrir Gemini 3.8 Flash](https://orbitarium-gemini-3.8-flash.biel.dev.br) | [`fonte fixada`](./benchmarks/solar-system/GEMINI-3.8-FLASH-PROVENANCE.md) · `805cfe87a…` |

O Luna está, por enquanto, apenas com a fonte fixada; a proveniência do prompt ainda não foi arquivada neste repositório.

## O que é Frontier Models?

**Frontier Models** é um arquivo de benchmarks para comparar sistemas de IA frontier em projetos completos e inspecionáveis, com prompts, código e proveniência verificáveis.

```text
PROMPT → EXECUÇÃO DO MODELO → SNAPSHOT / FONTE FIXADA → EVIDÊNCIAS → PROVENIÊNCIA → PROJETOS INSPECIONÁVEIS
```

## Benchmark 002 — Racing-bench

O [Racing-bench](./benchmarks/racing/) é um benchmark independente de criação de um jogo de corrida arcade cinematográfico. **Toda execução deve receber o [prompt oficial V2.6](./benchmarks/racing/prompts/racing-v2.6.md) junto com o [adendo obrigatório sobre skills e ferramentas](./benchmarks/racing/EXECUTION-ADDENDUM.md).** Os códigos originais do [GPT-6.1 Sol](./benchmarks/racing/runs/gpt-6.1-sol/source/) e [Gemini 3.8 Flash](./benchmarks/racing/runs/gemini-3.8-flash/source/) foram arquivados com todos os arquivos rastreados e backups do histórico Git; isso não representa aprovação dos testes de gameplay.

**Sites do Racing-bench:** [GPT-6.1 Sol](https://racing-gpt-6.1-sol.biel.dev.br) · [Gemini 3.8 Flash](https://racing-gemini-3.8-flash.biel.dev.br).

## Benchmark 001 — Orbitarium-bench

O Orbitarium-bench pede a cada modelo que construa um produto completo e interativo do Sistema Solar a partir de uma especificação extensa. Ele testa design de produto, simulação e lógica orbital, câmera/navegação, estado temporal, acessibilidade, desempenho, robustez, honestidade científica, ferramentas educacionais e QA.

O caminho histórico `benchmarks/solar-system/` permanece inalterado para preservar links e a proveniência dos arquivos originais.

## Proveniência das execuções

| Modelo | Proveniência | Classificação | Status da fonte |
| --- | --- | --- | --- |
| GPT-6.1 Sol | commit fonte [`7caaccc7f4…`](https://github.com/bielxdh3/6.1gptsol/commit/7caaccc7f462806de10a1981c9826d3151e85407) | Referência atual | Arquivado; prompt não verificado |
| GPT-6 Astra | commit `fca2ef51b4…` | Frontier atual | Arquivado |
| Grok 4.7 | commit `bcb1e82012…` em `JouberthAlves/grok-4.7-solar` | Frontier atual | Fonte fixada |
| Fable 5.1 | commit `7e079669e41b…` | Frontier atual | Arquivado |
| Gemini 4 Argon | commit fonte [`318aa80bb5…`](https://github.com/bielxdh3/gemini-argon/commit/318aa80bb5c49cbbfdfd4c3d267ad88d56ae3f98) | Referência atual | Arquivado; prompt não verificado |
| Gemini 3.8 Flash | commit `805cfe87a…` em `bielxdh3/gemini` | Histórico / | Fonte fixada |
| GPT-5.6 Sol V1 | commit `67eb9fc51f…` | Baseline histórico | Arquivado |
| GPT-5.6 Sol V2 | commit `93d43ae62f…` | Desatualizado | Arquivado |
| Grok 4.6 | SHA-256 do ZIP `5d77eeb509…` | Frontier arquivado | Arquivado |
| GPT-5.6 Luna | commit `5fdc036884…` em `bielxdh3/orbitario-luna` | Non-frontier | Fonte fixada |

O prompt compartilhado exato é [`frontier-v2.md`](./benchmarks/solar-system/prompts/frontier-v2.md), SHA-256 `7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65`.

## Política do arquivo

- resultados dos modelos permanecem intocados dentro dos snapshots arquivados em `runs/`;
- metadados do arquivo ficam fora dos resultados dos modelos;
- prompts exatos são arquivados separadamente e sem alterações;
- commits Git são usados quando existem metadados Git da fonte;
- hashes criptográficos são usados quando não existem;
- uma fonte pode ficar fixada por commit enquanto o snapshot vendorizado ainda estiver pendente;
- execuções históricas continuam preservadas sem poluir a arena atual.

---

<div align="center">

### Frontier Models

**Entrada · resultado · evidência · comparação — tudo em um só lugar.**

<sub>Arquivo independente de benchmark. Os nomes dos modelos identificam os sistemas usados em cada execução.</sub>

</div>
