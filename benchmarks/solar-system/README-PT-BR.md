<div align="center">

# Orbitarium-bench

**Frontier Models · benchmark de geração de produto completo**

`3D / Canvas` · `simulação` · `design de produto` · `honestidade científica` · `UX responsiva` · `robustez`

[![English](https://img.shields.io/badge/Idioma-English-2563EB?style=for-the-badge)](./README.md)

</div>

## ⚔️ Arena atual de referências

| Modelo | Origem | Projeto ao vivo | Snapshot / fonte |
| --- | --- | --- | --- |
| ☀️ **GPT-6.1 Sol** | Fonte arquivada | [Abrir Sol](https://orbitarium-gpt-6.1-sol.biel.dev.br) | [`runs/gpt-6.1-sol/source`](./runs/gpt-6.1-sol/source/) · `7caaccc7f4…` |
| ✦ **GPT-6 Astra** | Archived | [Abrir Astra](https://orbitarium-gpt-6-astra.biel.dev.br) | `fca2ef51b4…` |
| 𝕏 **Grok 4.7** | Fonte fixada | [Abrir Grok 4.7](https://orbitarium-grok-4.7.biel.dev.br) | [Repositório fonte](https://github.com/JouberthAlves/grok-4.7-solar) · commit `bcb1e82012…` |
| ◆ **Fable 5.1** | Frontier V2 | [Abrir Fable 5.1](https://fable-solar-system.vercel.app) | `7e079669e41b…` |
| ◈ **Gemini 4 Argon** | Fonte arquivada | [Abrir Argon](https://orbitarium-gemini-4-argon.biel.dev.br) | [`runs/gemini-4-argon/source`](./runs/gemini-4-argon/source/) · `318aa80bb5…` |

A arena atual reúne **cinco** referências, incluindo o GPT-6.1 Sol, agora com código e recursos arquivados. A entrada exata usada para gerar o Sol não está verificada.


## 🗂️ Modelos non-frontier ou desatualizados

Estes projetos continuam visíveis fora da arena frontier atual e do SVG principal.

| Modelo | Classificação | Projeto / fonte | Proveniência |
| --- | --- | --- | --- |
| ☀️ **GPT-5.6 Sol V2** | Frontier desatualizado | [Abrir Sol V2](https://orbitarium-gpt-5.6-sol-v2.biel.dev.br) | commit `93d43ae62f…` · [Código V2](./runs/gpt-5.6-sun-max/rebuild/) |
| 🌙 **GPT-5.6 Luna** | Non-frontier | [Abrir Luna](https://orbitarium-gpt-5.6-luna.biel.dev.br) | commit fonte [`5fdc036884…`](https://github.com/bielxdh3/orbitario-luna/commit/5fdc036884bbeb712eb015c76db1b1eaf83c9e42) |
| 𝕏 **Grok 4.6** | Execução frontier arquivada | [Abrir Grok 4.6](https://grok-4-6-solar-system.vercel.app) | [`runs/grok-4.6/frontier-v2`](./benchmarks/solar-system/runs/grok-4.6/frontier-v2/) |
| ◈ **Gemini 3.8 Flash** | Frontier V2 arquivado / | [Abrir Gemini 3.8 Flash](https://orbitarium-gemini-3.8-flash.biel.dev.br) | [`fonte fixada`](./GEMINI-3.8-FLASH-PROVENANCE.md) · `805cfe87a…` |

O Luna está, por enquanto, apenas com a fonte fixada; a proveniência do prompt ainda não foi arquivada aqui.

<details>
<summary><strong>Baseline histórico — GPT-5.6 Sol V1</strong></summary>

O GPT-5.6 Sol V1 é preservado apenas para análise histórica do efeito do prompt. Ele é excluído da arena atual porque usou [`sun-original.md`](./prompts/sun-original.md), e não Frontier V2.

- [Abrir Sol V1](https://orbitarium-gpt-5.6-sol.v1.biel.dev.br)
- Snapshot: `67eb9fc51f…`
- Arquivo: [Código V1](./runs/gpt-5.6-sun-max/original/)

</details>

## O que este benchmark testa

A tarefa pede ao modelo que transforme uma especificação extensa em uma experiência completa do Sistema Solar no navegador, e não apenas em uma demo simples. Ela testa interpretação da especificação, julgamento visual/de produto, estado orbital e temporal, sistemas aninhados como Terra–Lua, câmera/navegação, ferramentas de escala e medição, desempenho, confiabilidade, acessibilidade, honestidade científica e validação.

## Entrada compartilhada Frontier V2

```text
SHA-256  7c2833a0486938c38671139807bd4a8c16371c3740175376ad02a6c0c3c06d65
Tamanho  115.983 bytes
Linhas   1.153
```

## Mapa das execuções

| Execução | Modelo | Prompt | Proveniência | Arena |
| --- | --- | --- | --- | --- |
| Baseline histórico | GPT-5.6 Sol V1 | `sun-original.md` | commit `67eb9fc51f…` | oculto |
| Frontier V2 | GPT-5.6 Sol | `frontier-v2.md` | commit `93d43ae62f…` | non-frontier / desatualizado |
| Referência com fonte fixada | GPT-5.6 Luna | não arquivado aqui | commit fonte `5fdc036884…` | non-frontier |
| Fonte arquivada | GPT-6.1 Sol | não verificado | commit `7caaccc7f4…` | atual |
| Frontier V2 | GPT-6 Astra | `frontier-v2.md` | commit `fca2ef51b4…` | atual |
| Fonte fixada | Grok 4.7 | não arquivado aqui | commit `bcb1e82012…` | atual |
| Frontier V2 | Fable 5.1 | `frontier-v2.md` | commit `7e079669e41b…` | atual |
| Fonte arquivada | Gemini 4 Argon | não verificado | commit `318aa80bb5…` | atual |
| Frontier V2 | Gemini 3.8 Flash | `frontier-v2.md` | commit fonte `805cfe87a…` | arquivado |

A proveniência legível por máquina fica em [`RUNS.json`](./RUNS.json). Consulte a [proveniência do Gemini 4 Argon](./GEMINI-4-ARGON-PROVENANCE.md) e o [registro histórico do Gemini 3.8](./GEMINI-3.8-FLASH-PROVENANCE.md).

## Política de snapshots

Arquivos produzidos pelos modelos são preservados dentro dos snapshots vendorizados em `runs/` sem alterações. Metadados mantidos pelo repositório ficam fora do resultado do modelo. Uma execução recém-adicionada pode ficar fixada em um commit Git exato enquanto o snapshot vendorizado completo ainda estiver pendente; esse estado fica explícito em `RUNS.json` em vez de ser apresentado como arquivo completo.

## Justiça da comparação

Um concorrente não deve receber a implementação de outro concorrente ou dicas posteriores durante a geração do próprio projeto. Os projetos são preservados sem alterações.

---

<div align="center">

**Frontier Models · mesma tarefa, resultados inspecionáveis, evidências explícitas.**

</div>
