<div align="center">

<img src="./assets/frontier-models-hero-v7.svg" alt="Frontier Models — arquivo de benchmarks de modelos frontier" width="100%" />

<br/>

[![Benchmark](https://img.shields.io/badge/benchmark-frontier%20models-7C3AED?style=flat)](./benchmarks)
[![Arena](https://img.shields.io/badge/Arena-5%20refer%C3%AAncias%20atuais-2563EB?style=flat)](./benchmarks/solar-system/RUNS.json)
[![Arquivo](https://img.shields.io/badge/arquivo-8%20snapshots%20%2B%202%20fontes%20fixadas-DB2777?style=flat)](./benchmarks/solar-system/RUNS.json)

# Frontier Models

**Prompts exatos. Proveniência fixada. Snapshots completos dos projetos. Evidências explícitas.**

[![English](https://img.shields.io/badge/Idioma-English-2563EB?style=flat)](./README.md)

[Abrir benchmark](./benchmarks/solar-system/) · [Metodologia](./docs/METHODOLOGY.md)

</div>

## ⚔️ Arena atual de referências

| Modelo | Execução / origem | Projeto ao vivo | Execução arquivada / fixada |
| --- | --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | Fonte arquivada / prompt não verificado | [Abrir Sol](https://gpt-6.1-sol.biel.dev.br/) | [`runs/gpt-6.1-sol/source`](./benchmarks/solar-system/runs/gpt-6.1-sol/source/) |
| ✦ **GPT-6 Astra** | Frontier V2 | [Abrir Astra](https://gpt-6-astra.biel.dev.br) | [`runs/gpt-6-astra-max/frontier-v2`](./benchmarks/solar-system/runs/gpt-6-astra-max/frontier-v2/) |
| 𝕏 **Grok 4.7 Solar** | Referência com fonte fixada | [Abrir Observatório do Sistema Solar](https://grok-4.7.biel.dev.br/) | [`runs/grok-4.7/source`](./benchmarks/solar-system/runs/grok-4.7/source/) |
| ◆ **Fable 5.1** | Frontier V2 | [Abrir Fable 5.1](https://fable-solar-system.vercel.app) | [`runs/fable/frontier-v2`](./benchmarks/solar-system/runs/fable/frontier-v2/) |
| ◈ **Gemini 4 Argon** | Fonte arquivada / prompt não verificado | [Abrir Argon](https://gemini-4-argon.biel.dev.br/) | [`runs/gemini-4-argon/source`](./benchmarks/solar-system/runs/gemini-4-argon/source/) |

A arena atual reúne **cinco** referências. O Gemini 4 Argon e o GPT-6.1 Sol foram arquivados integralmente a partir de commits exatos, mas seus prompts de geração não foram comprovados; por isso não há comprovação de equivalência ao Frontier V2. O Gemini 3.8 Flash permanece no histórico.

## 🗂️ Modelos non-frontier ou desatualizados

Estas execuções continuam visíveis como referência, mas ficam intencionalmente separadas da arena frontier atual e do SVG principal.

| Modelo | Classificação | Projeto / fonte | Proveniência |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sun V1** | Baseline histórico | [Abrir Sun V1](https://gpt-5.6-sun-v1.biel.dev.br) | [`runs/gpt-5.6-sun-max/original`](./benchmarks/solar-system/runs/gpt-5.6-sun-max/original/) · commit `67eb9fc51f…` |
| ☀️ **GPT-5.6 Sun V2** | Frontier desatualizado | [Abrir Sun V2](https://gpt-5.6-sun-v2.biel.dev.br) | [`runs/gpt-5.6-sun-max/rebuild`](./benchmarks/solar-system/runs/gpt-5.6-sun-max/rebuild/) · commit `93d43ae62f…` |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Abrir Luna](https://gpt-5.6-luna.biel.dev.br/) | commit [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) |
| 𝕏 **Grok 4.6** | Execução frontier arquivada | [Abrir Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Frontier V2 arquivado | [Abrir Gemini 3.8 Flash](https://gemini-3.8-flash.biel.dev.br) | [`fonte fixada`](./benchmarks/solar-system/GEMINI-3.8-FLASH-PROVENANCE.md) · `805cfe87a…` |

O Luna está, por enquanto, apenas com a fonte fixada; a proveniência do prompt ainda não foi arquivada neste repositório.

## O que é Frontier Models?

**Frontier Models** é um arquivo de benchmarks para comparar sistemas de IA frontier em projetos completos e inspecionáveis, com prompts, código e proveniência verificáveis.

### Arquitetura em resumo

```text
   +--------------------------------+         +--------------------------------+
   | Prompts versionados            |         | Projetos gerados por IA        |
   | prompts/frontier-v2.md         |         | commits de fonte / hashes ZIP  |
   | apenas entradas verificadas    |         | arquivados ou fonte fixada     |
   +--------------------------------+         +--------------------------------+
                    |                                          |
                    +--------------------+---------------------+
                                         |
                                         v
                    +----------------------------------------+
                    | Registro do benchmark Sistema Solar    |
                    | benchmarks/solar-system/RUNS.json      |
                    | referencias atuais + historicas        |
                    +----------------------------------------+
                                         |
                    +--------------------+---------------------+
                    |                                          |
                    v                                          v
   +--------------------------------+         +--------------------------------+
   | Snapshots dos projetos         |         | Proveniencia e fontes fixadas  |
   | runs/<model>/<run>/            |         | *-PROVENANCE.md / *-FILES.json |
   | preservados sem alterar        |         | commits Git / SHA-256 / checks |
   +--------------------------------+         +--------------------------------+
                    |                                          |
                    +--------------------+---------------------+
                                         |
                                         v
                    +----------------------------------------+
                    | READMEs + links de projetos            |
                    | SVG principal + scripts de integridade |
                    +----------------------------------------+
```

O registro conecta evidências dos prompts, arquivos dos projetos ou fontes apenas fixadas e a proveniência imutável. Uma fonte fixada não é necessariamente um snapshot local; um prompt não verificado não é tratado como equivalente ao de outras execuções. Veja a [arquitetura do repositório](./docs/REPOSITORY-ARCHITECTURE.md).

## Benchmark 001 — Sistema Solar / Orbitário

O primeiro benchmark pede a cada modelo que construa um produto completo e interativo do Sistema Solar a partir de uma especificação extensa. Ele testa design de produto, simulação e lógica orbital, câmera/navegação, estado temporal, acessibilidade, desempenho, robustez, honestidade científica, ferramentas educacionais e QA.

## Proveniência das execuções

| Modelo | Proveniência | Classificação | Status da fonte |
| --- | --- | --- | --- |
| GPT-6.1 Sol | commit fonte [`7caaccc7f4…`](https://github.com/bielxdh3/6.1gptsol/commit/7caaccc7f462806de10a1981c9826d3151e85407) | Referência atual | Arquivado; prompt não verificado |
| GPT-6 Astra | commit `fca2ef51b4…` | Frontier atual | Arquivado |
| Grok 4.7 Solar | commit `bcb1e82012…` em `JouberthAlves/grok-4.7-solar` | Frontier atual | Fonte fixada |
| Fable 5.1 | commit `7e079669e41b…` | Frontier atual | Arquivado |
| Gemini 4 Argon | commit fonte [`318aa80bb5…`](https://github.com/bielxdh3/gemini-argon/commit/318aa80bb5c49cbbfdfd4c3d267ad88d56ae3f98) | Referência atual | Arquivado; prompt não verificado |
| Gemini 3.8 Flash | commit `805cfe87a…` em `bielxdh3/gemini` | Histórico / | Fonte fixada |
| GPT-5.6 Sun V1 | commit `67eb9fc51f…` | Baseline histórico | Arquivado |
| GPT-5.6 Sun V2 | commit `93d43ae62f…` | Desatualizado | Arquivado |
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
