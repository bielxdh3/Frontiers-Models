# Racing-bench — execution metrics / métricas de execução

## English

Starting with **V3.4.1**, record token usage and execution time when evidence is available. These are descriptive resource measurements, not scores. Runs use different subscription plans and clients rather than a uniform metered API. Availability, precision, accounting and cache behavior can differ. Missing values are unknown, never zero. Do not infer API spend from subscription usage.

- Scope: target model's benchmark execution, from start to delivery. Exclude unrelated runs, post-delivery conversation, and usage attributed to other models from the target-model totals. If those components cannot be separated, report the limitation rather than claiming a precise total.
- Time: **active execution time is the primary displayed metric**. Estimate it from benchmark activity when necessary and report the method and uncertainty. Wall-clock duration, including idle periods, is supplementary context only. Do not substitute an API processing timer or an unrelated client session timer for active time.
- Tokens: report uncached input, output, cache writes and cache reads separately when exposed; total is their sum only when the counters are non-overlapping. Cache reads count repeated context reads, not newly generated text. If a client exposes only approximate or partial data, label it as such.
- Evidence: retain source, scope, units and confidence in the run registry. Do not treat different providers' totals as directly comparable without checking accounting definitions.

### Fable 5.2 (V3.4.1)

| Measurement | Reported value |
| --- | ---: |
| Start (UTC) | 2026-11-17 13:44 |
| Delivery (UTC) | 2026-11-18 05:17 |
| **Estimated active execution time** | **~11h (9.7–11.9h)** |
| Wall-clock time (supplementary) | 15h 33m (~15.5h) |
| Model calls | 817 |
| Uncached input tokens | 1,654 |
| Output tokens | 1,981,943 |
| Cache write tokens | 4,531,425 |
| Cache read tokens | 469,228,912 |
| **Total reported tokens** | **475,743,934** |

Source: owner-supplied summary of local Claude Code session usage records, scoped to November 17–18 through delivery. Active time is estimated from message gaps using different idle thresholds. The exact counters are transcribed from that summary, not independently audited against raw logs. Haiku 5.5 and Sonnet 5.5 usage and post-benchmark conversations are excluded; the scoped total already excludes them, so no second subtraction is performed. The separate rounded Claude Code usage report dated November 18 at 12:25 UTC has a different reporting scope, includes post-benchmark model usage, and does not reconcile to the scoped totals; it is not added to or subtracted from this record. Its API and wall timers and cost estimate are not benchmark-wide measurements. Earlier V3.4 runs have no execution metrics recorded here.

### GPT-6.2 Astra (V3.4.1)

| Measurement | Reported value |
| --- | ---: |
| Weekly Plus quota used (entire chat) | 21.55% (usage screenshot) |
| Five-hour quota used (entire chat) | 137.9% |
| Model share | Astra 98%; Terra 1%; Luna 1% |
| Credits used | 0 |
| Reliable token count | Unavailable |
| Active execution time | Unknown |
| Observed elapsed interval | 5h 02m (08:21 to 13:23, Cuiabá UTC-4, 2026-11-18) |
| Final verification | 2m 50s |

The elapsed interval is between the owner-reported creation of track.json and the final verification finish, not the entire run or an active-time estimate. Work may precede or follow these markers. The archived [run.json](./runs/gpt-astra-6.2-v3.4.1/source/verification/run.json) records final verification start 17:20:36.162 UTC and finish 17:23:26.360 UTC (170.198 seconds). The screenshot reports whole-chat quotas and model shares; no exact model-only quota can be derived from those fields. Quota percentage is a subscription-specific proxy, not a token count and not comparable directly with tokens or other plans.

## Português

A partir da **V3.4.1**, registrar tokens e tempo de execução quando houver evidência disponível. São métricas descritivas de recursos, não notas. As execuções utilizam cotas de diferentes assinaturas e clientes, e não uma API tarifada padronizada. Disponibilidade, precisão, contabilização e cache podem variar. Valores ausentes são desconhecidos, não zero. Não inferir custo de API a partir do uso da assinatura.

- Escopo: execução do benchmark pelo modelo avaliado, do início à entrega. Excluir outras execuções, conversas posteriores e uso atribuído a outros modelos do total do modelo avaliado. Se não for possível separar, declarar a limitação.
- Tempo: **o tempo ativo de execução é a métrica principal exibida**. Estimar pela atividade do benchmark quando necessário e informar método e incerteza. O tempo de relógio, incluindo ociosidade, serve somente como contexto complementar. Não substituir o tempo ativo por um contador de API ou de outra sessão.
- Tokens: separar entrada sem cache, saída, escrita e leitura de cache quando disponíveis. Somar apenas contadores sem sobreposição. Leitura de cache representa releitura de contexto, não texto novo. Identificar valores aproximados ou parciais.
- Evidência: registrar fonte, escopo, unidades e confiabilidade no catálogo. Não presumir comparabilidade direta entre provedores sem verificar as convenções de contabilização.

### Fable 5.2 (V3.4.1)

| Medida | Valor informado |
| --- | ---: |
| Início (UTC) | 17/11/2026 13:44 |
| Entrega (UTC) | 18/11/2026 05:17 |
| **Tempo ativo estimado de execução** | **~11 h (9,7–11,9 h)** |
| Tempo de relógio (complementar) | 15 h 33 min (~15,5 h) |
| Chamadas ao modelo | 817 |
| Tokens de entrada sem cache | 1.654 |
| Tokens de saída | 1.981.943 |
| Tokens de escrita em cache | 4.531.425 |
| Tokens de leitura de cache | 469.228.912 |
| **Total de tokens informado** | **475.743.934** |

Fonte: resumo fornecido pelo mantenedor dos registros locais de uso do Claude Code, limitado aos dias 17 e 18 de novembro até a entrega. O tempo ativo foi estimado por intervalos entre mensagens, com diferentes limiares de ociosidade. Os contadores foram transcritos do resumo, sem auditoria independente dos logs brutos. Haiku 5.5, Sonnet 5.5 e conversas pós-benchmark foram excluídos; o total delimitado já os exclui, portanto não há segundo desconto. O relatório separado e arredondado do Claude Code de 18/11 às 12:25 UTC tem outro escopo, inclui uso de modelos após o benchmark e não reconcilia com os totais delimitados; não foi somado nem subtraído. Seus contadores de tempo de API, sessão e estimativa de custo não representam a execução integral. Não constam métricas das execuções antigas V3.4.


### GPT-6.2 Astra (V3.4.1)

| Medida | Valor informado |
| --- | ---: |
| Cota semanal Plus consumida (chat completo) | 21,55% (print de uso) |
| Cota de 5 horas consumida (chat completo) | 137,9% |
| Participação dos modelos | Astra 98%; Terra 1%; Luna 1% |
| Créditos usados | 0 |
| Contagem confiável de tokens | Indisponível |
| Tempo ativo | Desconhecido |
| Intervalo decorrido observado | 5 h 02 min (08h21 a 13h23, Cuiabá UTC-4, 18/11/2026) |
| Verificação final | 2 min 50 s |

O intervalo vai da criação de track.json informada pelo mantenedor ao término da verificação final; pode haver trabalho antes ou depois. Não representa tempo ativo nem duração total exata. O [run.json](./runs/gpt-astra-6.2-v3.4.1/source/verification/run.json) arquivado registra a verificação de 17:20:36.162 UTC a 17:23:26.360 UTC (170,198 s). O print informa cotas do chat completo e participação dos modelos; não permite atribuir cota exata apenas ao Astra. Percentual de cota é uma medida alternativa específica da assinatura, não equivale a tokens nem permite comparação direta entre planos.
