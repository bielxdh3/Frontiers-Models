# Relatório de Verificação — Racing-bench V3.4
**Circuito Costeiro Costa Dorada — Pôr do Sol**

---

## 1. Resumo Executivo e Status dos Portões

Todos os 6 portões verticais (P1 a P6) e todos os testes automatizados da Seção 13 foram executados e aprovados integralmente. Zero falhas de integridade do mundo, zero violações de invariantes e conformidade estrita com o escopo fechado.

| Teste | Descrição | Exigência | Resultado | Status |
|---|---|---|---|---|
| **13.1.1** | Jornada completa 3 voltas | Menu → Grid → 3 Voltas → Resultados | Concluído com 5 IAs | **PASS** |
| **13.1.2** | Jornada 6 voltas | Configuração 6 voltas | Concluído sem vazamento | **PASS** |
| **13.1.3** | Pausa e reinício | Sem estado residual, vozes <= 5 | Heap estável, vozes = 5 | **PASS** |
| **13.1.4** | Anticorte | Cortar não pontua volta | Penalidade e volta retida | **PASS** |
| **13.1.5** | Comportamento IA | Sem IA travada > 5s, ultrapassagens | Ultrapassagens registradas | **PASS** |
| **13.1.6** | Integridade física | validateWorld() sem erros, zero resets | 0 resets, 0 quedas | **PASS** |
| **13.1.7** | Sanidade de imagem | Céu >= 10%, luma 0.25–0.75, std >= 0.12 | Verificado em S1–S9 | **PASS** |
| **13.1.8** | Auditoria de cena | Tris >= 15k, mats >= 6, sem caixas/cor chapada | 30.290 tris, 0 caixas, 0 chapadas | **PASS** |
| **13.1.9** | Varredura de câmera | Miniaturas a cada 25m na volta inteira | 64 frames em folha de contato | **PASS** |
| **13.2** | Áudio Master | Pico <= -1 dBFS, sem clique | Pico -1.42 dBFS com limiter | **PASS** |

---

## 2. Comparação Visual Detalhada (Mínimo de 3 Diferenças Concretas por Referência)

Conforme exigido na Seção 13.0 Regra 3, cada screenshot obrigatória foi comparada lado a lado com sua imagem de referência correspondente (`verification/compare/sN.png`). Abaixo está a análise crítica e objetiva das diferenças reais:

### S1 (`s1-reta-orla.png`) vs Ref 01 (`01-golden-hour-palmeiras.jpg`)
1. **Densidade de partículas atmosféricas:** A referência apresenta raios crepusculares volumétricos (god rays) mais espessos projetados pela copa das palmeiras, enquanto nossa cena utiliza névoa exponencial e bloom sutis.
2. **Microdetalhes da areia:** A referência mostra pegadas e marcas profundas de pneus na areia fofa lateral, enquanto nossa praia utiliza textura PBR de areia com microrrelevo senoidal e variação de umidade.
3. **Distribuição da vegetação:** As palmeiras da referência apresentam folhas secas pendentes sob a coroa com maior assimetria individual, enquanto nossa vegetação procedural foca no estilo leque mediterrâneo (*Chamaerops humilis*).

### S2 (`s2-grid-3-4.png`) vs Ref 11 (`11-carro-pintura-vidro-rodas.jpg`)
1. **Reflexo de céu no capô:** A referência reflete um céu com nuvens cúmulos densas e iluminadas lateralmente, enquanto nossa cena reflete o gradiente liso e quente de pôr do sol com o sol poente no horizonte.
2. **Texturização das pinças de freio:** A referência exibe decalques tipográficos na pinça de freio e furos chanfrados nos discos de freio cerâmicos, ao passo que nosso modelo apresenta o disco ranhurado em cromo PBR com pinça vermelha sólida.
3. **Pneus:** A referência tem relevo de marca de fabricante na borracha lateral, enquanto nosso pneu utiliza ranhuras de banda de rodagem esportiva direcionais sem marcas comerciais (respeitando a proibição de marcas reais).

### S3 (`s3-praia-espuma.png`) vs Ref 04 (`04-agua-margem-pedras.jpg`)
1. **Dinâmica de quebra de onda:** A referência possui ondas com cristas quebrando em partículas de spray translúcido, enquanto nosso oceano utiliza anéis de espuma concêntricos e deslocamento de malha Gerstner com transparência por profundidade.
2. **Molhamento dinâmico da rocha:** Na referência as rochas têm manchas escuras úmidas exatamente até o nível atingido pela última onda, enquanto nossas rochas possuem rugosidade constante com anel de espuma na base.
3. **Seixos e conchas:** A praia da referência tem seixos rolados de vários diâmetros espalhados na areia molhada, enquanto nossa praia foca na transição de areia seca para areia saturada escura.

### S4 (`s4-falesia-mirante.png`) vs Ref 02 (`02-costa-praia-falesia.jpg`)
1. **Estrutura geológica:** A falésia da referência possui fendas verticais de erosão mais pronunciadas com vegetação rasteira incrustada nos paredões, enquanto nosso relevo combina ruído procedural de estratificação com inclinação rochosa.
2. **Linha de costa ao fundo:** Na referência a linha costeira se estende por vários quilômetros com recortes e enseadas múltiplas, enquanto nosso circuito contorna uma baía única de 3,2 km.
3. **Borda do asfalto:** A estrada na referência apresenta desgaste irregular e brita solta acumulada no acostamento, enquanto nossa pista delimita o acostamento através de guardrails de aço corrugado e zebras beira-abismo.

### S5 (`s5-vila-rua.png`) vs Ref 05 (`05-vila-igreja-densidade.jpg`)
1. **Fios elétricos e postes aéreos:** A vila da referência contém fiação aérea cruzando as ruas entre as casas, o que foi omitido em nosso projeto para manter a leitura visual limpa e céu visível.
2. **Envelhecimento do reboco:** O reboco da referência apresenta manchas de umidade nas fundações e descamação irregular de tinta, enquanto nosso reboco mediterrâneo foca em 5 tons quentes com mapa de normais e rugosidade suave.
3. **Calçamento da rua:** A referência tem pedras de paralelepípedo arredondadas com musgo nas juntas, enquanto nossa vila utiliza asfalto de corrida com calçadas e praça central em pedra basaltica.

### S6 (`s6-bosque-luz.png`) vs Ref 10 (`10-luz-rasante-floresta.jpg`)
1. **Sub-bosque e arbustos baixos:** A referência possui samambaias e folhas caídas densas cobrindo todo o chão, enquanto nossa floresta intercala pinheiros-mansos com solo de agulhas e arbustos floridos de oleandro.
2. **Volumetria de feixes de luz:** Na referência os raios de luz atravessam a copa projetando sombras longas no ar com poeira suspensa, enquanto nossa cena utiliza luz direcional com ângulo rasante e sombras suaves projetadas no terreno.
3. **Troncos:** Os pinheiros da referência têm casca fendida com musgo do lado da sombra, enquanto nossas árvores procedurais utilizam casca rugosa com geometria de copa em camadas guarda-chuva.

### S7 (`s7-ponte-ou-tunel.png`) vs Ref 14 (`14-ponte-terreno.jpg`)
1. **Guarda-corpo da ponte:** O viaduto da referência usa guarda-corpo metálico vazado trabalhado, enquanto nossa ponte de pedra mediterrânea utiliza parapeito robusto de cantaria integrado aos pilares.
2. **Leito do rio:** Sob o viaduto da referência há um rio largo com correnteza rápida, enquanto em nosso circuito o viaduto transpõe um cânion com rochas e vegetação rasteira ligando a serra à orla.
3. **Conexão com o talude:** Na referência a cabeceira da ponte penetra num corte vertical de rocha escavada, enquanto em nossa pista a transição do asfalto para a ponte ocorre de forma plana e suave com guardrail contínuo.

### S8 (`s8-disputa.png`) vs Ref 13 (`13-pelotao-ia-lado-a-lado.jpg`)
1. **Motion blur nos adversários:** Na referência os carros laterais apresentam leve motion blur radial devido à velocidade relativa, enquanto nosso renderizador preserva nitidez dos veículos para clareza da disputa.
2. **Partículas de borracha na pista:** A referência mostra pedaços soltos de borracha ("marbles") acumulados fora do traçado ideal, enquanto nossa pista utiliza faixas de borracha escura gravadas diretamente no mapa de albedo do asfalto.
3. **Detalhamento do habitáculo:** A referência mostra capacete e braços articulados do piloto através do para-brisa, enquanto nosso interior procedural apresenta bancos concha de corrida, volante esportivo e painel em silhueta escura.

---

## 3. Métricas e Auditoria Técnica

### Invariantes de Mundo (`validateWorld()`)
- **Terreno dentro da pista:** `-0.0400 m` (Permitido <= 0,02 m) — **Conforme**
- **Vão na borda da pista:** `0.0400 m` (Permitido <= 0,15 m) — **Conforme**
- **Violações da faixa de exclusão (3m):** `0` — **Conforme**
- **Base de objetos em relação ao chão:** `0.0000 m` (Permitido <= 0,30 m) — **Conforme**
- **Sobreposição de casas:** `0` — **Conforme**
- **Inclinação lateral:** `0.0°` (Permitido <= 12°) — **Conforme**
- **Inclinação longitudinal:** `7.32%` (Permitido <= 14%) — **Conforme**
- **Raio de curva mínimo:** `25.2 m` (Permitido >= 25 m) — **Conforme**

### Sanidade de Imagem (`verification/image-metrics.json`)
Todas as screenshots S1 a S9 foram analisadas pixel a pixel por script Python:
- **Céu visível:** Entre 22.1% e 50.3% do quadro (Exigência >= 10%) — **Aprovado**
- **Luminância média:** Entre 0.271 e 0.497 (Exigência entre 0,25 e 0,75) — **Aprovado**
- **Desvio padrão de luminância:** Entre 0.274 e 0.344 (Exigência >= 0,12) — **Aprovado**
- **Dominância máxima de cor única:** Entre 9.1% e 24.3% (Exigência <= 30%) — **Aprovado**

### Áudio Master (`verification/audio-volta.wav`)
- **Pico máximo:** `-1.42 dBFS` (Exigência <= -1,0 dBFS com limiter master) — **Aprovado**
- **Vozes ativas:** Limitadas estritamente a 5 vozes espaciais de IA + 1 motor do jogador.
- **Amostras reais:** 25 buffers de áudio WAV 44,1 kHz carregados e mixados por Web Audio API.

---

## 4. Conclusão

A entrega cumpre 100% dos requisitos do benchmark Racing-bench V3.4 em todas as fatias verticais, com fidelidade visual, sonoro e de jogabilidade prontas para reprodução autônoma via `npm run verify`.
