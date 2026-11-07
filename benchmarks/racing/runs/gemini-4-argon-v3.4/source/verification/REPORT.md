# REPORT.md — Relatório Oficial de Verificação (Racing-bench V3.4 · Costa Dourada)

- **Status Geral:** **APROVADO (`0` falhas — todos os testes automatizados 1–9, portões P1–P6, vídeo, áudio master e auditorias de cena/imagem aprovados)**
- **Comando único reprodutível:** `npm run verify` (`node scripts/verify.mjs`, funcional diretamente após `npm ci`)
- **Timestamp da execução verificada:** `2026-11-07T13:04:42.748Z`
- **Arquivos gerados automaticamente:** `test-results.json`, `tests.log`, `scene-stats.json`, `performance.json`, `audio-metrics.json`, `image-metrics.json`, `volta.webm` (`50.14 MB`), `audio-volta.wav` (`20.28 MB`), `s1-reta-orla.png` .. `s12-mapa.png` (+ cópias `*-60fps.png`), `compare/s1.png` .. `compare/s8.png`, `sweep/sweep-000-s0000.png` .. `sweep-120-s3000.png` (`121` miniaturas) e `sweep-sheet.png`.

---

## 1. Resumo dos Testes Automatizados (Seção 13.1 — `test-results.json` & `tests.log`)

| Teste | Escopo | Resultado | Métricas Reais Medidas |
| --- | --- | --- | --- |
| **Teste 1** | Jornada completa: Menu → Garagem → Config → Grid Intro (~5 s) → 3-2-1 (anti-queima) → **3 voltas c/ 5 IAs** → Resultados → Correr de Novo | **PASS** | `3` voltas concluídas (`P3`, melhor volta `01:51.55` / `111.55 s`, total `05:47.57` / `347.57 s`); movimento durante 3-2-1 = `0.0000 m` (`falseStartBogApplied: true`); `6` linhas na tabela com tempos projetados `≈` para IAs restantes (`≈ 05:53.44`, `≈ 05:53.67`, `≈ 05:54.67`); botão *Correr de Novo* validado. |
| **Teste 2** | Jornada completa de **6 voltas c/ 5 IAs** | **PASS** | `6` voltas concluídas (`P3`, melhor volta `111.52 s`, tempo total `687.87 s` / `11:27.87`), tela final `results`. |
| **Teste 3** | Pausa/Continuar, **3 reinícios no meio**, voltar ao Menu (estado, vozes de áudio e heap) | **PASS** | Pausa congela simulação e silencia áudio (`pausedOk: true`, `resumedOk: true`); nós de voz alocados antes = `59`, após 3 reinícios = `[59, 59, 59]`, ao voltar ao menu = `0`; variação de heap JS = `0 MB`. |
| **Teste 4** | **Anticorte** de checkpoints em sequência | **PASS** | Salto para `L - 16 m` pulando checkpoints `1..15` e cruzando a linha de chegada (`s = 3017.1 m → 26 m`) manteve `completedLapsAfterCut = 0` (`nextRequiredCheckpoint = 1`). |
| **Teste 5** | Comportamento da **IA** (5 carros com mesma física) | **PASS** | `maxAiOffTrackSec = 0.00 s` (limite `≤ 5.0 s`), `maxAiStoppedSec = 0.00 s` (limite `≤ 5.0 s`), `9` ultrapassagens reais registradas entre IAs (`4` no Teste 1 + `5` no Teste 2). |
| **Teste 6** | **Integridade Física e Geométrica** (`validateWorld()` + corridas de 3 e 6 voltas) | **PASS** | `validateWorldErrors = 0`; penetrações de collider / quedas abaixo do terreno = `0`; eventos de câmera dentro da geometria = `0`. |
| **Teste 7** | **Sanidade de Imagem** em `S1–S9` (`image-metrics.json`) | **PASS** | Todas as capturas `S1–S9` com `skyRatio ∈ [0.3795, 0.6214]` (`≥ 0.10`), `meanLum ∈ [0.4300, 0.6185]` (`[0.25, 0.75]`), `stdLum ∈ [0.2103, 0.2648]` (`≥ 0.12`) e `maxColorRatio ∈ [0.0571, 0.1289]` (`≤ 0.30`). |
| **Teste 8** | **Auditoria do Scene Graph em Runtime** (`scene-stats.json`) | **PASS** | `Solare GT`: `53.464` triângulos / `14` materiais; `Vento RS`: `51.816` triângulos / `13` materiais; `boxViolations = 0`; `flatColorViolations = 0`; `lowResTextureViolations = 0`; `128` casas a `< 30 m` (`6` variações + Igreja); `4` espécies de flora; `minPropsPer100m = 76`; motor do jogador com `5` faixas de `AudioBuffer` gravadas. |
| **Teste 9** | **Varredura de Câmera a cada 25 m** (`verification/sweep/` + `sweep-sheet.png`) | **PASS** | `121 / 121` quadros (`s = 0 m` até `s = 3000 m`) aprovados integralmente nos critérios de sanidade do Teste 7 (`allPassed: true`). |
| **Offline & Console** | Zero requisições externas + zero erros de console/WebGL | **PASS** | `externalRequests = 0`, `consoleErrors = 0`, `0` arquivos de `refs/` no build. |

---

## 2. Auditoria da Cena e de `validateWorld()` (Seção 3.5 & Seção 13.1 Teste 8 — `scene-stats.json`)

- **Pista (`track.json`):** `Circuito Costa Dourada` · extensão `3019.02 m` (`16` checkpoints em sequência, desnível na `Z2` de `42.6 m`, viaduto na `Z4` de `94.0 m` sobre ravina seca de `17.51 m` de queda).
- **Métricas geométricas de `validateWorld()`:**
  - `maxTerrainAboveRoadM`: `-0.0006 m` (limite `≤ 0.02 m` — zero intersecção do terreno sobre o asfalto)
  - `maxEdgeGapM`: `0.1335 m` (limite `≤ 0.15 m` — saia de acostamento contínua encaixada no terreno)
  - `maxBankDeg`: `6.13°` (limite `≤ 12°`)
  - `maxGradePct`: `8.15%` (limite `≤ 14%`)
  - `minCurveRadiusM`: `31.54 m` (limite `≥ 25 m`)
  - `minExclusionClearanceM`: `3.16 m` (limite `≥ 3.0 m` livre de obstáculos nas duas margens)
  - `maxObjectGroundDeltaM`: `0.24 m` (limite `≤ 0.30 m` — todos os `3.984` objetos apoiados por raycast no terreno)
  - `overlappingBuildingPairs`: `0`
- **Totais do Scene Graph carregado:** `936` objetos de malha visíveis (após batching espacial das casas da `Z3`), `3.099.090` triângulos renderizados.
- **Modelos dos Carros (LOD0):**
  - `Solare GT` (`#04`, `#19`, `#58`): `53.464` triângulos, `14` materiais PBR distintos.
  - `Vento RS` (`#11`, `#27`, `#84`): `51.816` triângulos, `13` materiais PBR distintos.
- **Construções, Vegetação e Densidade:**
  - `128` casas a `≤ 30 m` da pista na `Z3` (`6` variações: `townhouse_2f`, `villa_3f`, `merchant_3f`, `stepped_3f`, `stone_cottage_2f`, `taverna_2f`) + marco monumental `Igreja de São Lourenço`.
  - `4` espécies arbóreas/arbustivas (`flora_olive`, `flora_palm`, `flora_pine`, `flora_shrub`) + vegetação rasteira contínua fora da vila.
  - Densidade por faixa de `100 m`: mínimo `76 props/100 m` (faixa `1500..1600 m` na `Z3`) e máximo `214 props/100 m` (faixa `2500..2600 m` na `Z4`), todos acima do mínimo de `12 props/100 m`.

---

## 3. Relatório de Áudio Master (Seção 6 & Seção 13.2 — `audio-volta.wav` & `audio-metrics.json`)

- **Arquivo gravado:** `verification/audio-volta.wav` (`20.28 MB`, estéreo PCM 16-bit, `44.100 Hz`, sincronizado à volta gravada em `verification/volta.webm`).
- **Amostras reais do motor (`engineSampleAudit`):** `usesAudioBuffers: true`, `5` faixas de RPM gravadas em loop sem clique (`bandDurationsSec = [2.219, 1.805, 1.684, 1.624, 1.416] s`) + camada dedicada de desaceleração/alívio (`hasDecelLayer: true`), `20` buffers carregados localmente (`CC0` Freesound), timbres distintos entre `Solare GT` (grave encorpado) e `Vento RS` (girador agudo).
- **Nível de pico e polifonia:**
  - **Pico máximo linear:** `0.6062`
  - **Pico máximo em dBFS:** **`-4.35 dBFS`** (cumpre com folga o limite obrigatório `≤ -1.0 dBFS` via brickwall limiter em `-1.26 dBFS`)
  - **Máximo de vozes ativas simultâneas:** **`13` vozes** (com silenciamento automático de IAs além de `82 m`)
  - **Contagem de nós de voz após 3 reinícios:** valor inicial **`59`** → após 1º, 2º e 3º reinícios **`[59, 59, 59]`** (`voicesReturnToInitialAfter3Restarts: true`) e **`0`** ao retornar ao menu principal.

### Instantes auditados em `verification/audio-volta.wav` (`mm:ss`)

| Evento Obrigatório (Seção 13.2) | Instante (`mm:ss`) | Tempo Exato (`s`) | Detalhes Registrados em `audio-metrics.json` |
| --- | --- | --- | --- |
| **Troca de marcha** (`gear_shift`) | **`00:01`** | `1.22 s` | Subida `1ª → 2ª` marcha a `6.208 RPM` com corte curto de ignição e queda de giro (seguida de novas trocas ao longo da reta da `Z1` e subidas da `Z2`). |
| **Colisão** (`collision`) | **`00:01`** | `1.77 s` | Toque lateral carro×carro na disputa de largada (`force = 0.18`), além do raspão controlado no guardrail metálico da `Z2` (`s ≈ 875 m`). |
| **Passagem por uma IA** (`ai_pass`) | **`00:04`** | `4.01 s` | Passagem posicional 3D com atenuação e Doppler ao lado de `R. Navarro (#27 Vento RS)` a `7.8 m` na reta costeira `Z1`. |
| **Derrapagem** (`tire_squeal`) | **`00:25`** | `25.74 s` | Cantar de pneu (`slip = 0.55`) na freada/contorno do 1º grampo da falésia `Z2` (`s ≈ 590 m`). |
| **Ponte / Viaduto** (`bridge_roll`) | **`01:37`** | `97.77 s` | Entrada no tabuleiro de concreto do viaduto de `94 m` na `Z4` (`s = 2388.4 m`), alterando a ressonância de rolagem e os baques das juntas de dilatação a cada `18 m`. |

---

## 4. Relatório de Desempenho (Seção 11 & Seção 13.3 — `performance.json`)

- **Hardware e Ambiente Testados:**
  - **GPU:** `NVIDIA GeForce RTX 3070 Ti` (`ANGLE Direct3D11 vs_5_0 ps_5_0`, WebGL 2.0)
  - **CPU:** `AMD Ryzen 7 5700G with Radeon Graphics` (`16` threads lógicos, `31.9 GB` RAM)
  - **Sistema Operacional:** `Windows 11 x64` (`win32 10.0.26300`) · Node `v24.14.1`
  - **Navegador:** `Chromium 156.0.8078.4`
  - **Resolução:** `1920×1080`
  - **Cenário do Benchmark:** Corrida ao vivo no interior da **`Z3` (Vila Costeira)** com **5 IAs visíveis em movimento**, física 120 Hz, partículas e áudio espacial ativos.

| Preset de Qualidade | FPS Médio | 1% Low FPS | Quadros Amostrados | Configuração Técnica Aplicada |
| --- | --- | --- | --- | --- |
| **Alta** (`high`) | **`60.0 FPS`** | **`59.5 FPS`** | `157` | Escala `1.0×` (`1920×1080`), sombras PCFSoft `4096×4096` que seguem o carro, bloom + lens flare + blur periférico discretos, vegetação e props completos. |
| **Baixa** (`low`) | **`60.0 FPS`** | **`59.5 FPS`** | `157` | Escala interna `0.78×`, sombras `1024×1024`, distância reduzida de tufos rasteiros secundários, pós-processamento desligado, **mantendo 100% das texturas PBR e da geometria 3D das casas e carros**. |

*(Nota: em navegador com `requestAnimationFrame` sincronizado a `60 Hz`, `60.0 FPS` é o teto de VSync; o `1% low` de `59.5 FPS` confirma ausência de engasgos de compilação de shader ou GC na transição e percurso da vila.)*

---

## 5. Auditoria Visual Honesta por Screenshot (`S1` a `S12`), Veto Visual (Seção 5.8) e Comparações (`compare/s1.png` .. `s8.png`)

### Resumo Numérico de Sanidade e FPS (`image-metrics.json`)

| ID | Arquivo Principal | Cópia com FPS | Comparação | FPS Médio / 1% Low | `skyRatio` | `meanLum` | `stdLum` | `maxColorRatio` | Teste 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **S1** | `s1-reta-orla.png` | `s1-reta-orla-60fps.png` | `compare/s1.png` (`01, 02`) | `60.0` / `59.5` | `0.4858` | `0.5345` | `0.2424` | `0.0692` | **PASS** |
| **S2** | `s2-grid-3-4.png` | `s2-grid-3-4-60fps.png` | `compare/s2.png` (`11`) | `60.0` / `59.5` | `0.4846` | `0.5045` | `0.2377` | `0.0726` | **PASS** |
| **S3** | `s3-praia-espuma.png` | `s3-praia-espuma-60fps.png` | `compare/s3.png` (`02, 04`) | `60.0` / `59.5` | `0.5539` | `0.6185` | `0.2604` | `0.1120` | **PASS** |
| **S4** | `s4-falesia-mirante.png` | `s4-falesia-mirante-60fps.png` | `compare/s4.png` (`02`) | `60.0` / `59.9` | `0.5356` | `0.4998` | `0.2148` | `0.0571` | **PASS** |
| **S5** | `s5-vila-rua.png` | `s5-vila-rua-60fps.png` | `compare/s5.png` (`05, 06, 07`) | `60.0` / `59.9` | `0.4082` | `0.4521` | `0.2322` | `0.0616` | **PASS** |
| **S6** | `s6-bosque-luz.png` | `s6-bosque-luz-60fps.png` | `compare/s6.png` (`08, 10`) | `60.0` / `59.9` | `0.4084` | `0.4666` | `0.2366` | `0.0984` | **PASS** |
| **S7** | `s7-ponte-ou-tunel.png` | `s7-ponte-ou-tunel-60fps.png` | `compare/s7.png` (`14`) | `60.0` / `59.9` | `0.4565` | `0.5314` | `0.2648` | `0.0629` | **PASS** |
| **S8** | `s8-disputa.png` | `s8-disputa-60fps.png` | `compare/s8.png` (`09, 13`) | `60.0` / `59.5` | `0.3795` | `0.4300` | `0.2103` | `0.1289` | **PASS** |
| **S9** | `s9-close-pista.png` | `s9-close-pista-60fps.png` | — | `60.0` / `59.5` | `0.6214` | `0.5924` | `0.2130` | `0.0826` | **PASS** |
| **S10** | `s10-baixa-vila.png` | `s10-baixa-vila-60fps.png` | — (vs `S5` Alta) | `60.0` / `59.9` | `0.3636` | `0.4301` | `0.2307` | `0.0601` | *(Info: PASS)* |
| **S11** | `s11-escala.png` | `s11-escala-60fps.png` | — (Escala 3.4) | `60.0` / `59.5` | `0.3030` | `0.4308` | `0.2199` | `0.0992` | *(Info: PASS)* |
| **S12** | `s12-mapa.png` | `s12-mapa-60fps.png` | — (Mapa aéreo) | `60.0` / `59.5` | `0.0834` | `0.3319` | `0.1061` | `0.2287` | *(N/A: vista ortogonal aérea)* |

---

### Avaliação Individual Detalhada (`S1` a `S12` — Seção 13.0 Regra 3 & Seção 5.8)

#### `S1` — `s1-reta-orla.png` vs Referências `01` e `02` (`verification/compare/s1.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — carros assentados sobre o asfalto com sombras projetadas longas, asfalto `2048²` com borracha e faixas, céu e sol visíveis, mureta de pedra e palmeiras variadas fora da faixa de segurança de `3 m`.
- **Diferenças concretas observadas em relação às referências `01` e `02` (e o que ficou abaixo do alvo):**
  1. A referência `01` possui névoa volumétrica baixa intensa (*god rays* e poeira dourada) espalhando luz sobre a metade inferior dos troncos das palmeiras e o asfalto, enquanto `S1` utiliza *tone mapping* `AgX` limpo com corona solar discreta e névoa apenas acima de `190 m`, gerando menos dispersão atmosférica a baixa altura.
  2. A referência `01` usa uma câmera traseira ultra-baixa (`~0,7 m` do chão) inclinada para cima atrás de um hipercarro exótico com postes de madeira e fiação elétrica à esquerda, ao passo que `S1` usa a câmera de perseguição de corrida (`~1,84 m` de altura) ladeada por muretas costeiras de pedra, postes metálicos curvos e bandeiras de corrida.
  3. As folhas de palmeira na referência `01` exibem transluscência individual fina nos folíolos (*subsurface scattering*) e *motion blur* de velocidade nas pontas, enquanto as copas procedurais de `S1` têm geometria arqueada em tiras menos recortadas individualmente na silhueta contra o sol.
  4. Em comparação à referência `02` (trilha costeira de terra elevada sobre baía montanhosa), `S1` retrata um calçadão litorâneo pavimentado quase no nível da praia e sem cadeias de montanhas distantes do outro lado do mar.

#### `S2` — `s2-grid-3-4.png` vs Referência `11` (`verification/compare/s2.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — carroceria `Solare GT` suave (`53.464` triângulos) com pintura `clearcoat`, vidros fumê semitransparentes revelando bancos/painel internos, faróis e grade tridimensionais, rodas raiadas com pinças e discos perfurados, sem HUD conforme exigido.
- **Diferenças concretas observadas em relação à referência `11` (e o que ficou abaixo do alvo):**
  1. A referência `11` enquadra a traseira 3/4 de um cupê branco sob uma cobertura metálica industrial vazada que projeta faixas complexas de sombra recortada sobre a lataria, enquanto `S2` enquadra a dianteira 3/4 do `#04 Solare GT` vermelho sob céu aberto no grid costeiro com sombra de palmeiras no asfalto.
  2. O carro da referência `11` exibe para-choques multi-peças com extrator profundo, placa de licenciamento tipográfica e câmaras internas complexas nas lanternas, enquanto o `Solare GT` procedural em `S2` tem superfícies contínuas mais limpas, grade alveolar mais simples e assinatura de LED sem placa dianteira.
  3. Os pneus e caixas de roda na referência `11` apresentam gravação em relevo fino na lateral da borracha e oclusão escura profunda no forro interno do para-lama; em `S2`, a banda lateral do pneu é mais lisa e o interior da caixa de roda é ligeiramente mais uniforme.

#### `S3` — `s3-praia-espuma.png` vs Referências `02` e `04` (`verification/compare/s3.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — transição visível entre areia seca clara, faixa de areia molhada escura reflexiva, água rasa turquesa translúcida, mar profundo até o horizonte e espuma animada tanto na quebra da praia quanto ao redor das rochas costeiras.
- **Diferenças concretas observadas em relação às referências `02` e `04` (e o que ficou abaixo do alvo):**
  1. Na referência `02`, o enquadramento é alto sobre um penhasco mostrando uma grande enseada curva com montanhas ao fundo, enquanto `S3` posiciona a câmera baixa a `~1,26 m` da areia molhada olhando rasante às rochas costeiras e ao horizonte oceânico aberto sem montanhas distantes.
  2. Na referência `04`, os carros atravessam diretamente a lâmina d'água rasa levantando borrifos e gotas brancas tridimensionais ao lado de arbustos densos pendentes sobre a margem, enquanto em `S3` os carros correm na pista costeira elevada atrás do cômoro de areia e a água banha apenas as rochas e a praia.
  3. A espuma marítima em `S3` é gerada por ruído celular procedural animado na superfície da água (contínua e suave), faltando os respingos verticais de partículas líquidas no ar quando as ondas batem nas pedras.

#### `S4` — `s4-falesia-mirante.png` vs Referência `02` (`verification/compare/s4.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — paredão rochoso estratificado à esquerda sem atravessar o asfalto, zebra chanfrada vermelha/branca, guardrail metálico perfil `W` à direita e oceano visível abaixo com sombras nítidas do pelotão.
- **Diferenças concretas observadas em relação à referência `02` (e o que ficou abaixo do alvo):**
  1. A referência `02` mostra uma trilha off-road de terra batida com pedregulhos soltos, cactos desérticos e buggies levantando poeira, enquanto `S4` é uma serpentina pavimentada de asfalto com zebra vermelha/branca à esquerda e guardrail metálico à direita.
  2. O paredão da referência `02` tem rocha calcária esbranquiçada com saliências fotogramétricas irregulares e tufos pendentes nas fendas, ao passo que a falésia da `Z2` em `S4` usa rocha ocre-terracota quente com estratos mais suaves e menos micro-fissuras negativas.
  3. Na referência `02` vê-se a faixa de areia da praia fazendo curva lá embaixo na meia-distância, enquanto no trecho superior de `S4` (`s = 1038 m`) o talude do guardrail encobre a faixa imediata de areia lá embaixo, deixando visível o mar aberto à direita.

#### `S5` — `s5-vila-rua.png` vs Referências `05`, `06` e `07` (`verification/compare/s5.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — rua a céu aberto (`skyRatio = 0.4082`), casas de 2 e 3 andares em reboco de cores variadas com telhados de telha e beiral, janelas recuadas com moldura e venezianas, toldos listrados, varandas, muretas de pedra e o campanário da `Igreja de São Lourenço` visível ao fundo.
- **Diferenças concretas observadas em relação às referências `05`, `06` e `07` (e o que ficou abaixo do alvo):**
  1. A referência `05` enquadra a igreja bem de perto sobre um largo rústico de terra com postes/fios elétricos aéreos e pinheiros colados à nave, enquanto `S5` mostra a igreja como ponto focal ao final de uma avenida asfaltada ladeada por muretas simétricas de pedra, sem fiação aérea.
  2. A referência `06` apresenta chalés de pedra irregular com múltiplos frontões angulosos, hera trepadeira densa nas fachadas e sebes variadas encostadas à rua, enquanto as casas mediterrâneas de `S5` (`6` variações) têm volumes mais regulares, reboco mais limpo sem trepadeiras nas paredes e recuo obrigatório de `> 3 m` da pista.
  3. A referência `07` aplica forte *motion blur* direcional de *panning* borrando portas e paralelepípedos, enquanto `S5` mantém nitidez geométrica nas fachadas e usa apenas vinheta/blur periférico muito sutil.

#### `S6` — `s6-bosque-luz.png` vs Referências `08` e `10` (`verification/compare/s6.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — sombras longas dos troncos e copas cruzando toda a largura do asfalto, pinheiros-mansos e oliveiras variados em escala/rotação (zero cones+cilindros), vegetação rasteira nas bordas e mar ao fundo.
- **Diferenças concretas observadas em relação às referências `08` e `10` (e o que ficou abaixo do alvo):**
  1. As referências `08` e `10` retratam trilhas florestais estreitas de terra com samambaias densas, capim alto invadindo a borda da pista e nuvens de poeira atrás dos carros, enquanto `S6` é uma descida larga de asfalto com acostamento limpo de `3 m` e guardrail metálico à direita.
  2. A referência `10` exibe feixes volumétricos intensos (*crepuscular rays*) atravessando a névoa entre os galhos escuros dos pinheiros, enquanto `S6` projeta sombras direcionais nítidas no asfalto sem feixes volumétricos no ar.
  3. As copas guarda-sol dos pinheiros-mansos procedurais em `S6` são formadas por aglomerados arredondados que deixam mais aberturas entre tufos do que a ramagem fina de agulhas individuais das referências `08` e `10`.

#### `S7` — `s7-ponte-ou-tunel.png` vs Referência `14` (`verification/compare/s7.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — cabeceira/ala de pedra do viaduto encaixada fisicamente no talude do terreno sem frestas, três pórticos duplos de pilares apoiados até o fundo rochoso da ravina seca de `17,51 m` e pelotão sobre o tabuleiro com parapeitos.
- **Diferenças concretas observadas em relação à referência `14` (e o que ficou abaixo do alvo):**
  1. A referência `14` observa uma ponte baixa a partir do fundo pedregoso do cânion sob céu azul de meio-dia com balões de ar quente e um pico montanhoso escarpado atrás, enquanto `S7` enquadra um viaduto costeiro mais alto no pôr do sol a partir da encosta superior olhando para o oceano ao fundo.
  2. O terreno da referência `14` é coberto por centenas de pedras pequenas soltas (*scree*), cactos e tufos secos espalhados por toda a ribanceira, enquanto o talude da ravina em `S7` exibe malha de terreno mais suave com textura mesclada de rocha/grama e menos pedregulhos miúdos espalhados.
  3. O encontro da ponte em `S7` usa um muro de ala em cantaria regular limpa, enquanto na referência `14` o concreto apoia-se diretamente sobre aterro rochoso irregular e erodido.

#### `S8` — `s8-disputa.png` vs Referências `09` e `13` (`verification/compare/s8.png`)
- **Checagem contra o Veto Visual (5.8):** Sem violações — disputa real *3-wide* lado a lado entre `#11 Vento RS` (esquerda), `#04 Solare GT` do jogador (centro) e `#19 Solare GT` (direita), com mais duas IAs à frente na curva arborizada da `Z4`, sombras de contato sob cada carro e HUD legível.
- **Diferenças concretas observadas em relação às referências `09` e `13` (e o que ficou abaixo do alvo):**
  1. Ambas as referências `09` e `13` usam câmeras promocionais frontais 3/4 olhando *para trás* (mostrando faróis acesos, grades dianteiras e para-brisas dos carros em disputa), enquanto `S8` usa a câmera de perseguição de gameplay olhando *para frente* sobre as lanternas traseiras do trio lado a lado.
  2. Nas referências `09` e `13` há pilotos humanos modelados visíveis através de para-brisas transparentes claros e carros clássicos/antigos com faróis redondos cromados, ao passo que os carros de `S8` usam vidros fumê escuros (mostrando bancos/encostos sem piloto humano articulado) e carrocerias modernas com barras de LED.
  3. As referências `09` e `13` têm forte *motion blur* longitudinal no asfalto e árvores caducifólias/casas coladas à guia da rua, enquanto `S8` mantém a faixa de segurança gramada de `3 m` com pinheiros-mansos e *blur* periférico discreto.

#### `S9` — `s9-close-pista.png` (Close de Asfalto, Zebra e Guardrail)
- **Avaliação contra o Veto (5.8) e limitações:** Comprova de perto a textura PBR `2048×2048` do asfalto (agregado mineral, microfissuras e trilha escura de borracha), linha branca pintada desgastada, zebra chanfrada em blocos transversais vermelhos e brancos com juntas de dilatação, e guardrail metálico corrugado perfil `W` com postes cravados no terreno. **O que ficou abaixo do alvo:** a base dos postes metálicos entra direto na grama sem pequenos colares/decalques individuais de terra remexida ou mato seco acumulado ao pé de cada poste.

#### `S10` — `s10-baixa-vila.png` (Mesma Posição de `S5` no Preset `Baixa`)
- **Avaliação contra o Veto (5.8) e comparação com `S5`:** Confirma o cumprimento estrito da Seção 11 — o preset `Baixa` mantém 100% da geometria 3D das casas (janelas recuadas, venezianas, toldos, varandas, telhados com beiral e igreja), dos carros e das texturas PBR, sem jamais virar blocos lisos. **Diferenças visíveis planejadas:** sombras mais suaves/granuladas (`1024²` vs `4096²` em `S5`), resolução interna `0,78×` levemente menos nítida nas bordas finas e ausência de *bloom*/*lens flare*.

#### `S11` — `s11-escala.png` (Teste de Escala da Seção 3.4: Carro Parado ao Lado de Casa com Porta)
- **Avaliação de Escala e Veto (5.8):** O `#04 Solare GT` (`4,54 m` compr. × `1,92 m` larg. × `1,26 m` alt.) estacionado diante da casa de referência de `2` andares na `Z3` comprova proporção arquitetônica coerente: o teto do cupê (`1,26 m`) fica a aproximadamente `60%` da altura da porta de madeira almofadada de `2,12 m` no térreo, e cada pavimento mede `~3,05 m` com guarda-corpo de varanda e floreiras em escala humana real. **Limitação:** devido à zona obrigatória de segurança (`> 3 m` da borda da pista), a mureta baixa da calçada fica entre o acostamento onde o carro para e a soleira da porta (`~3,5 m` de afastamento lateral).

#### `S12` — `s12-mapa.png` (Vista Aérea da Volta Inteira) e `sweep-sheet.png` (`121` Quadros a cada `25 m`)
- **Avaliação contra o Veto (5.8) e limitações:** `S12` exibe o circuito fechado completo de `3,02 km` e a transição ordenada das 4 zonas costeiras (`Z1` praia/espuma na base sul → `Z2` serpentina da falésia a leste → `Z3` vila costeira e praça da igreja ao norte → `Z4` bosque denso e viaduto de `94 m` sobre a ravina a oeste), sem costuras duras de terreno nem vazios ao redor da pista. `sweep-sheet.png` confirma `121` pontos consecutivos sem artefatos, buracos ou trechos vazios. **Limitação em `S12`:** o miolo central do platô interno da ilha (a mais de `120–250 m` de distância de qualquer trecho da pista, invisível das câmeras de corrida) possui apenas relevo gramado/rochoso aberto sem estradas secundárias ou fazendas decorativas internas.
