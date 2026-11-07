# GATES.md — Registro de Portões Verticais (Racing-bench V3.4)

Este documento registra a execução sequencial dos 6 portões obrigatórios (Seção 12), incluindo métricas reais de `validateWorld()`, inspeção visual das capturas de cada portão, defeitos encontrados antes da aprovação e correções aplicadas antes de avançar.

---

## Portão P1 — Esqueleto (`track.json`, Estrada, Terreno, Colliders, Carro-Placeholder, Câmera)

- **Status:** APROVADO
- **Capturas inspecionadas:** `verification/gates/p1-mapa.png`, `verification/gates/p1-chase.png`
- **Resultado de `validateWorld()`:**
  - `valid: true`, `errorCount: 0`
  - `trackLengthM`: `3019.02 m` (dentro de 2,5–3,5 km)
  - `maxTerrainAboveRoadM`: `-0.0006 m` (limite ≤ `0.02 m`)
  - `maxEdgeGapM`: `0.1335 m` (limite ≤ `0.15 m`)
  - `maxBankDeg`: `6.13°` (limite ≤ `12°`)
  - `maxGradePct`: `8.15%` (limite ≤ `14%`)
  - `minCurveRadiusM`: `31.54 m` (limite ≥ `25 m`)
  - `checkpointCount`: `16` em sequência estrita
- **Volta completa dirigida (120 Hz com sub-stepping):**
  - Concluída sem atravessar barreiras ou terreno em `114.60 s` (`1:54.60`, dentro da janela exigida de `1:45–2:30`).
  - `integrityViolations`: `0` · `gameplayResets`: `0` · `cameraClips`: `0`.
- **O que estava abaixo do alvo na 1ª captura de P1 e foi corrigido antes de avançar:**
  1. *Concentração discreta de curvatura na reamostragem linear da spline:* corrigida avaliando a cúbica de Catmull-Rom diretamente no parâmetro exato `t(s)` a cada `1,0 m`, elevando o raio mínimo real para `31,54 m`.
  2. *Descontinuidade de Voronoi entre pernas da serpentina da Z2 e borda retangular no platô da Z3:* visível na primeira captura de `p1-mapa.png` e na silhueta esquerda de `p1-chase.png`. Corrigida substituindo condicionais abruptos de zona por pesos suaves (`smootherstep`) que decaem a zero em `absD ≤ 35,5 m` (antes da bissetriz de Voronoi de `46 m`) e perfil elíptico suave na Z3.
  3. *Fundo da ravina da ponte na Z4 cruzando `y = 0 m`:* elevado para piso rochoso seco (`y ≥ 5,0 m`), eliminando afloramento indevido do plano do mar sob o viaduto, e adicionado piso mínimo terrestre (`y ≥ 1,2 m` a montante da linha d'água) para impedir micro-poças de FBM atrás da orla.

---

## Portão P2 — Luz e Carro (HDRI CC0, Sol Golden Hour, Sombras 4096², AgX, 2 Carros Procedurais ≥ 15.000 triângulos)

- **Status:** APROVADO
- **Capturas inspecionadas (comparadas com `refs/11-carro-pintura-vidro-rodas.jpg` e `refs/01-golden-hour-palmeiras.jpg`):**
  - `verification/gates/p2-s2-gt-front.png` (3/4 frontal baixa do `Solare GT` no grid)
  - `verification/gates/p2-s2-gt-rear.png` (3/4 traseira baixa do `Solare GT` com aerofólio GT, lanternas rubi e difusor)
  - `verification/gates/p2-s2-hatch-front.png` (3/4 frontal baixa do `Vento RS` hot hatch)
  - `verification/gates/p2-s1-light.png` (grid de 6 carros na reta da orla voltada para o sol baixo)
- **Métricas reais medidas (`test_gate_p2.mjs`):**
  - `Solare GT` (`modelId: 'gt'`): `53.464` triângulos em LOD0 (mínimo exigido `15.000`), `14` materiais PBR distintos (mínimo exigido `6`: pintura metálica com `clearcoat: 1.0`, vidro fumê reflexivo sobre cabine escura, cromo/alumínio usinado, borracha com normal map radial de banda de rodagem, plástico/carbono acetinado, faróis e lanternas/freio emissivos, pinças pintadas, discos perfurados), `0` violações do detector de caixas (`BoxGeometry` / `≤ 12` triângulos).
  - `Vento RS` (`modelId: 'hatch'`): `51.816` triângulos em LOD0, `13` materiais PBR distintos, `0` violações do detector de caixas.
  - Sanidade de imagem:
    - `S1` rascunho: `meanLum = 0.5782` (`[0.12, 0.85]`), `stdLum = 0.2526` (`≥ 0.08`), `skyRatio = 0.5513` (`≤ 0.65`), `maxColorRatio = 0.0841` (`≤ 0.45`).
    - `S2` rascunho: `meanLum = 0.5485` (`[0.12, 0.85]`), `stdLum = 0.2435` (`≥ 0.08`), `skyRatio = 0.5336` (`≤ 0.65`), `maxColorRatio = 0.0912` (`≤ 0.45`).
  - `validateWorld()`: `valid: true`, `errorCount: 0` · `consoleErrors: 0`.
- **O que estava abaixo do alvo nas capturas iniciais de P2 e foi corrigido antes de avançar:**
  1. *Recuo interno dos vértices das janelas (`bodyGeo`) criando paredes pintadas atrás do para-brisa e interrompendo as colunas A/C:* corrigido gerando `bodyGeo`, `glassGeo` (`-3,5 mm` de recuo) e `linerGeo` (`-18 mm`, forro e colunas internas grafite-escuro) sobre a mesma malha paramétrica contínua `(iu, ir)`, preservando o arco estrutural pintado contínuo coluna A → trilho do teto → coluna C.
  2. *Fechamento em leque de vértice único em `u = 0` e `u = 1` criando vinco vertical no centro dos para-choques e engolindo a grade frontal:* corrigido mantendo largura plena dos para-choques (`fw`, `rw`), fechando as extremidades por tiras horizontais contínuas (`dz/dx = 0` em `x = 0`) e conformando grade alveolar, tomadas de ar, difusor e lanternas diretamente à superfície curva (`buildConformedBumperPanel`).
  3. *Pontas externas dos faróis projetadas além dos cantos afilados do para-choque, cilindro do painel tangenciando a base do para-brisa e endplates circulares no aerofólio GT:* corrigidos parametrizando os faróis diretamente sobre `(u, t)` da carroceria (`buildConformedBodySurfacePatch`), recuando/estreitando o painel interno (`1,00 m`, `z = 0,34`) e as caixas de roda internas, e substituindo os discos por endplates trapezoidais chanfrados em carbono (`buildSweptWingEndplateGeometry`).

---

## Portão P3 — Orla Completa (`Z1` Fatia Vertical: Mar, Praia, Espuma, Pórtico, Bandeiras, Palmeiras, Cercas e Rochas)

- **Status:** APROVADO
- **Capturas inspecionadas (comparadas com `refs/01-golden-hour-palmeiras.jpg`, `refs/02-costa-praia-falesia.jpg`, `refs/03-areia-dunas-cercas.jpg` e `refs/04-agua-margem-pedras.jpg`):**
  - `verification/gates/p3-grid-gantry.png` (grid pintado de 6 posições, pórtico de largada/chegada, muretas de pedra e palmeiras em contraluz)
  - `verification/gates/p3-s1-reta-orla.png` (reta da orla em velocidade rumo ao sol baixo, abertura para a praia com cercas de duna, espuma e mar ao fundo)
  - `verification/gates/p3-s3-praia-espuma.png` (câmera baixa na margem: areia seca → areia molhada escura → água rasa translúcida → espuma celular na praia e em volta das rochas costeiras)
- **Métricas reais medidas (`test_gate_p3.mjs`):**
  - `validateWorld()`: `valid: true`, `errorCount: 0`, `minExclusionClearanceM = 3.16 m` (`≥ 3.0 m`), `maxObjectGroundDeltaM = 0.24 m` (`≤ 0.30 m`).
  - Densidade na `Z1` (`777,0 m` de extensão): `1.254` objetos apoiados por raycast (`161,4 props/100 m`, muito acima do mínimo `12/100 m`), incluindo `119` palmeiras multi-copa, `142` arbustos costeiros, `370` tufos de vegetação rasteira, `114` módulos de cerca de praia, `80` bandeiras animadas ao vento, `24` postes costeiros, `81` balizadores de pedra, `322` rochas costeiras (`185` na linha d'água com colar de espuma) e as `2` torres treliçadas do pórtico.
  - Auditoria anti-placeholder: `boxViolations = 0`, `flatColorViolations = 0`, `consoleErrors = 0`.
  - Sanidade de imagem:
    - `S1` (`p3-s1-reta-orla.png`): `meanLum = 0.5560`, `stdLum = 0.2442`, `skyRatio = 0.5402`, `maxColorRatio = 0.0630`.
    - `S3` (`p3-s3-praia-espuma.png`): `meanLum = 0.6266`, `stdLum = 0.2558`, `skyRatio = 0.5505`, `maxColorRatio = 0.1118`.
- **O que estava abaixo do alvo nas capturas iniciais de P3 e foi corrigido antes de avançar:**
  1. *Texto espelhado na faixa do pórtico de largada:* causado por base matricial de determinante `-1` (`Right × Up = -Forward`). Corrigido para base destrógira `makeBasis(-Right, Up, Forward)` (`det = +1`) em `buildStartFinishGantry`.
  2. *IA #5 colando na traseira do jogador dentro da câmera de perseguição em `S1`:* corrigido em `ai-driver.js` mantendo compromisso lateral de faixa (`passRight` coerente com `latSep`) e modulação preventiva a `< 9,0 m`.
  3. *Recorte diagonal duro na linha d'água, excesso de espuma opaca nas pedras rasas e costura de UV `atan2` nas rochas costeiras em `S3`:* corrigidos suavizando o alpha da margem (`shoreEdgeFeather`), restringindo o campo de espuma de rocha às pedras efetivamente banhadas (`terrainY < 0,08 m`) com ruído celular em crista (`pow(1 - |2n - 1|, 3.2)`) e trocando o mapeamento esférico das rochas por projeção planar oblíqua contínua sem corte de ramo.


---

## Portão P4 — Zonas 2–4 (`Z2` Falésia, `Z3` Vila Costeira e Igreja, `Z4` Bosque de Pinheiros/Oliveiras e Viaduto)

- **Status:** APROVADO
- **Capturas inspecionadas (comparadas com `refs/02`, `05`, `06`, `07`, `08`, `09`, `10` e `14`):**
  - `verification/gates/p4-s4-falesia.png` (serpentina da `Z2` com paredão rochoso estratificado à esquerda, guardrail metálico e chevron à direita e o mar Mediterrâneo visível diretamente abaixo)
  - `verification/gates/p4-s5-vila.png` (rua a céu aberto da `Z3` com fachadas multi-andar, janelas recuadas com caixilhos e venezianas, portas de `2,12 m`, varandas, toldos, floreiras e a Igreja de São Lourenço com campanário ao fundo)
  - `verification/gates/p4-s6-bosque.png` (descida arborizada da `Z4` entre pinheiros-mansos em copa guarda-sol, oliveiras retorcidas, arbustos em camadas, luz dourada rasante e mar entre os troncos)
  - `verification/gates/p4-s7-ponte.png` (entrada do viaduto de `94 m` da `Z4` com ala de pedra encaixada no talude do terreno, 3 pórticos duplos de pilares apoiados no fundo rochoso da ravina de `17,51 m` e pelotão cruzando o tabuleiro)
  - `verification/gates/p4-s11-escala.png` (`Solare GT` estacionado diante da casa de referência na `Z3`, comprovando escala entre carro de `1,26 m` de altura, porta de `2,12 m` e andares de `~3,05 m`)
- **Métricas reais medidas (`test_gate_p4.mjs`):**
  - `validateWorld()`: `valid: true`, `errorCount: 0`, `placedObjectCount = 3.984` (`Z1: 1.254`, `Z2: 922`, `Z3: 585`, `Z4: 1.223`), `maxTerrainAboveRoadM = -0.0006 m`, `maxEdgeGapM = 0.1335 m`, `minExclusionClearanceM = 3.16 m`, `maxObjectGroundDeltaM = 0.24 m`.
  - Construções (`Z3`): `128` casas multi-andar a `≤ 30 m` da pista (mínimo `25`), `6` variações arquitetônicas (`townhouse_2f`, `villa_3f`, `merchant_3f`, `stepped_3f`, `stone_cottage_2f`, `taverna_2f`, mínimo `5`) em `6` paletas PBR de reboco/pedra + marco monumental `Igreja de São Lourenço` (`23,1 m` com campanário vazado e sino), `overlappingBuildingPairs = 0`.
  - Vegetação e densidade: `4` espécies arbóreas/arbustivas (`flora_olive`, `flora_palm`, `flora_pine`, `flora_shrub`) + vegetação rasteira contínua fora da vila; densidade mínima por faixa de `100 m` em toda a volta `minPropsPer100m = 76,0` (mínimo exigido `12`).
  - Auditoria anti-placeholder: `boxViolations = 0`, `flatColorViolations = 0`, `lowResTexViolations = 0`, `consoleErrors = 0`.
  - Sanidade de imagem:
    - `S4`: `meanLum = 0.5136`, `stdLum = 0.2049`, `skyRatio = 0.5520`, `maxColorRatio = 0.0639`.
    - `S5`: `meanLum = 0.4492`, `stdLum = 0.2313`, `skyRatio = 0.3869`, `maxColorRatio = 0.0664`.
    - `S6`: `meanLum = 0.4826`, `stdLum = 0.2274`, `skyRatio = 0.4244`, `maxColorRatio = 0.0693`.
    - `S7`: `meanLum = 0.5407`, `stdLum = 0.2614`, `skyRatio = 0.4712`, `maxColorRatio = 0.0676`.
    - `S11`: `meanLum = 0.4390`, `stdLum = 0.2192`, `skyRatio = 0.3691`, `maxColorRatio = 0.1053`.
- **O que estava abaixo do alvo nas capturas iniciais de P4 e foi corrigido antes de avançar:**
  1. *Guarda-sóis da praça (`buildCafeParasolTable`) com `10` triângulos (`≤ 12`, acionando o detector de caixas):* refinados para `ConeGeometry(1.75, 0.56, 16, 2, true)` (`64` triângulos), zerando `boxViolations`.
  2. *Vidraças, venezianas e portas amostrando apenas a borda creme (`u = 0`) em `S5` e `S11`:* causado por `(uRaw % 1 + 1) % 1` em `buildChamferedMasonryBlock`, que colapsava `u1 = 1` em `0`. Corrigido para interpolação linear direta em `[uvRect.u0, uvRect.u1]`, revelando os caixilhos escuros reflexivos, venezianas ripadas e portas almofadadas de `2,12 m`.
  3. *Crista leste da `Z2` ocultando o mar abaixo do guardrail e faixas de deformação de UV nas encostas íngremes em `S4`:* corrigidos aproximando a escarpa costeira (`eastTaperStart = 472..524 m` com mergulho de `64 m` até o mar) e trocando a interpolação de coordenadas UV por blend triplanar real das amostras de cor e normal (`mix(cCliffPlanar, cCliffVert, slopeRock)`).
  4. *Copas dos pinheiros-mansos finas vistas do nível da pista em `S6` e tronco em primeiro plano/parapeito encobrindo carros em `S7`:* adensadas as copas com `38` clusters abaulados multi-ângulo (`0,36..1,08 rad`) sobre base densa de agulhas (`alphaTest: 0.26`) e reposicionada `setS7Camera` na borda leste ensolarada (`bs - 7,5 m`, `y + 3,8 m`) enquadrando simultaneamente a ala de pedra ligada ao talude, os 6 carros sobre o viaduto e os 3 pares de pilares na ravina.


---

## Portão P5 — Corrida (IA, Checkpoints, Regras, Áudio, Fluxo Completo de UI)

- **Status:** **APROVADO**
- **`validateWorld()`:** `0` erros.
- **Testes Automatizados 13.1 e Áudio 13.2 executados (`test_gate_p5.mjs`):**
  - **Teste 1 (Jornada 3 voltas + 5 IAs + Resultados + Correr de Novo):** `3` voltas concluídas (`melhor volta = 01:53.73`, `total = 05:47.38`), `11` ultrapassagens entre IAs, `0` violações de integridade, `0` colisões de câmera com geometria, tabela de resultados com tempos projetados `≈` para IAs restantes (`≈ 05:53.13`, `≈ 05:53.74`).
  - **Teste 2 (Jornada 6 voltas + 5 IAs):** `6` voltas concluídas (`total = 11:27.87`), `5` ultrapassagens entre IAs, `0` violações de integridade, `0` colisões de câmera.
  - **Teste 3 (Pausa/Continuar, 3 Reinícios no meio, Voltar ao Menu, Heap e Áudio):** vozes/nós de corrida alocados idênticos antes e após `3` reinícios (`59 → [59, 59, 59]`), `0` nós de corrida no menu, variação de heap JS `0 MB`.
  - **Teste 4 (Anticorte):** corte de pista de `s = L - 16 m` até `s = 26,3 m` pulando checkpoints `2..15` resultou em `completedLaps = 0` (`nextCheckpoint = 1`).
  - **Áudio Multi-RPM com Amostras Reais (`RaceAudioEngine`):** `5` faixas de RPM gravadas (`AudioBuffer` CC0 de `1,416 s` a `2,219 s`) + camada de desaceleração (`hasDecelLayer = true`), `2` timbres distintos (`Solare GT` vs `Vento RS`), pico máximo medido `-6,87 dBFS` (`<= -1,0 dBFS`), máximo de `13` vozes simultâneas, eventos auditados de troca de marcha, passagem por IA, colisão e ressonância na ponte.
- **Inspeção Visual & Correções Realizadas Antes de Avançar para P6:**
  1. *Blocos da zebra (`curbAlbedo` / `curbNormal`) orientados longitudinalmente em `S9`:* corrigido o mapeamento UV procedural em `src/world/materials.js` do eixo `U` para o eixo transversal `V` (ao longo de `s`), gerando blocos vermelhos e brancos alternados com juntas de dilatação e marcas de borracha ao lado do asfalto `2048²` e do guardrail metálico perfil `W` (`s = 577,5 m`).
  2. *Capô da `IA 5` invadindo a borda inferior da câmera de perseguição em `S8` e rótulo `hud-laps-total` retendo valor anterior:* posicionada `IA 5` atrás da câmera de perseguição (`ds = -16,5 m`) na curva arborizada da `Z4` (`s = 2146 m`) mantendo o carro do jogador `#04` lado a lado 3-wide entre `#11 Vento RS` e `#19 Solare GT`, e sincronizado `#hud-laps-total` em `setLaps()` e `_updateHudDom()`.
  3. *Névoa de horizonte reduzindo contraste na vista aérea `S12` (`y = 835 m`):* ajustada distância da névoa exclusivamente na câmera `S12` (`1600..4200 m`, restaurada automaticamente para `190..1900 m` em todas as demais câmeras e modos) e centralizado o enquadramento em `(-10, 835, -60)` com margem limpa acima dos telhados da `Z3` e da praia da `Z1`.

---

## Portão P6 — Polimento, Otimização, Preset Baixa e Verificação Obrigatória Completa (Seção 13)

- **Status:** **APROVADO**
- **Comando único reprodutível:** `npm run verify` (`scripts/verify.mjs`) concluído com `EXIT 0` (`allTestsPassed: true` em `verification/test-results.json`).
- **Métricas finais auditadas em runtime (`scene-stats.json`, `performance.json`, `audio-metrics.json`, `image-metrics.json`):**
  - `validateWorld()`: `valid: true`, `errorCount: 0` (`3019.02 m`, `maxTerrainAboveRoadM = -0.0006 m`, `maxEdgeGapM = 0.1335 m`, `minExclusionClearanceM = 3.16 m`, `maxObjectGroundDeltaM = 0.24 m`, `bridgeMaxRavineDropM = 17.51 m`, `overlappingBuildingPairs = 0`).
  - **Desempenho na `Z3` com 5 IAs em `1920×1080` (`NVIDIA GeForce RTX 3070 Ti`, `AMD Ryzen 7 5700G`, `Chromium 156.0.8078.4`):**
    - Preset **Alta**: `60.0 FPS` médio · `59.5 FPS` 1% low (`157` quadros).
    - Preset **Baixa**: `60.0 FPS` médio · `59.5 FPS` 1% low (`157` quadros), mantendo 100% da geometria 3D das casas, texturas PBR e carros enquanto reduz sombras (`1024²`), distância de vegetação secundária, escala interna (`0.78×`) e desativa bloom/flare.
  - **Capturas `S1–S12` + `compare/s1.png..s8.png` + Varredura `sweep/` (`121` quadros a cada `25 m`):** todas as `12` capturas cravadas em `60fps` (`s1-reta-orla-60fps.png` .. `s12-mapa-60fps.png`), `100%` de aprovação no Teste 7 para `S1–S9` e para todos os `121/121` quadros de `verification/sweep/` (`sweep-sheet.png`).
  - **Vídeo e Áudio de Volta Completa (`volta.webm` `50.14 MB` + `audio-volta.wav` `20.28 MB`):** pico master `-4.35 dBFS` (`≤ -1.0 dBFS`), máximo de `13` vozes simultâneas, nós de áudio idênticos após 3 reinícios (`59 → [59, 59, 59]`, `0` no menu).
- **O que estava abaixo do alvo na 1ª execução de P6 e foi corrigido antes da aprovação final:**
  1. *Excesso de draw calls estáticos na vila `Z3` (`1.152` meshes individuais de casas causando quedas ocasionais de `60 FPS` para `55,4 FPS` / `1% low = 29,9 FPS` na `Z3` e `51,4 FPS` em `S12`):* otimizado em `src/world/village-and-landmarks.js` agrupando as `128` casas estáticas em `4` setores espaciais mesclados por material (`mergeGeometriesSimple`), reduzindo `visibleMeshObjects` da cena inteira de `1.942` para `936` sem alterar nenhum vértice, normal, UV ou sombra, estabilizando `Alta`, `Baixa` e `S1–S12` em `60,0 FPS` (`1% low = 59,5–59,9 FPS`).
  2. *Sobrescrita de `handbrake` no próximo quadro por `applyPlayerControls()` durante a demonstração de derrapagem na gravação da volta:* corrigido adicionando `setControlOverride` por tempo de simulação em `src/main.js`, garantindo derrapagem física real com fumaça e `tire_squeal` audível no grampo da `Z2` (`00:25` em `audio-volta.wav`).

