# Portões de verificação (seção 12)

Registro honesto de cada portão: o que foi construído, como foi verificado, o que ficou abaixo do alvo e o que foi corrigido antes de avançar.

---

## P1 — Esqueleto

**Construído:** `track.json` (spline Catmull-Rom centrípeta fechada, 337 pontos de controle `[x,y,z,largura,inclinação]`, gerada por `tools/make-track.mjs` a partir de retas/arcos com fechamento resolvido numericamente), malha da estrada + collider da estrada (mesmos triângulos), heightfield do terreno rebaixado/elevado até a estrada (prateleira plana + talude 6–15 m), collider do terreno (mesmo heightfield, mesma triangulação), barreiras posicionadas por distância ao longo da spline, checkpoints a cada ~100 m, linha de corrida, carro-placeholder dirigível (física final, caixa visual provisória), câmera de perseguição com colisão.

**Verificação:**
- `validateWorld()` (Node, `node tools/node-validate.mjs`, e no navegador em `?dev=1`): **0 erros**. Estatísticas: terreno máx. −0,044 m em relação à estrada (sempre abaixo), vão máx. borda/terreno 0,123 m (< 0,15), inclinação lateral máx. 5,6°, rampa máx. 9,39 %, raio mínimo 31,1 m, 33 checkpoints em sequência, comprimento 3 372 m.
- Volta dirigida: 6 carros no piloto automático (mesma física), 200 s simulados a 4× (timestep fixo 120 Hz): cada carro percorreu 5 990–6 328 m (≈1,8 volta), **0 resets, 0 eventos de invariante (abaixo do terreno / atravessou collider / caiu do mundo), câmera nunca dentro da geometria**.
- Screenshot vista de cima: `verification/gates/p1-top.png`.

**Abaixo do alvo / corrigido neste portão:**
1. *Falha real encontrada e corrigida:* na primeira versão a ravina sob a ponte estava deslocada (meandro) e estreita demais; o terreno ficava acima do tabuleiro perto dos encontros — carros capotavam e um registrou "abaixo do terreno". O `validateWorld()` também pulava a ponte nesse teste. Correções: meandro zerado junto à estrada, perfil da ravina ajustado ao vão, *clamp* do terreno sob o tabuleiro (≥ 1 m abaixo) e o teste "terreno acima da estrada" passou a cobrir também a ponte (só o teste de vão de borda é isento no tabuleiro).
2. A primeira pista tinha 2,62 km e a volta da IA levava ~83 s (fora de 1:45–2:30). Aderência reduzida para nível de carro de rua esportivo e o traçado alongado para 3,37 km (pernas da serpentina maiores, "S" na vila e no bosque). Volta da IA Normal agora 1:47–1:53.
3. Pendências conhecidas para os próximos portões: o litoral visto de cima ainda é quase reto (a praia curva e a falésia virão no P3); a borda do heightfield (±1,3 km) precisa de terreno distante para não aparecer; materiais e carro são provisórios.

---

## P2 — Luz e carro

**Construído:**
- HDRI CC0 de pôr do sol (Poly Haven *Kloppenheim 06 Pure Sky*, 2K) → PMREM para luz ambiente e reflexos. O código encontra o sol no HDRI (elevação 4,66°), gira o mapa para o azimute do `track.json` e usa **exatamente essa direção** e a cor do HDRI no sol direcional; o pico do sol é comprimido no mapa (para a luz direta vir só da luz com sombra) e o hemisfério inferior espelhado vira um chão quente.
- Sombras em cascata (CSM, 3 cascatas 2048² em Alta, *texel snapping*), luz ambiente em 0,55 (sombras nítidas).
- Céu procedural (gradiente referenciado no HDRI, disco do sol, glow, cúmulos esparsos com auto-sombra e cirros), névoa atmosférica própria em todos os materiais (começa a 160 m).
- Pós próprio em HDR: MSAA 4×, motion blur de câmera com máscara do carro do jogador (o carro e o HUD nunca borram), bloom físico (cadeia de mips), lens flare testado contra o depth, ACES fitted, grade quente, vinheta, dither, sRGB.
- **Carros finais**, 100 % procedurais: corpo implícito (perfis de silhueta/planta/seção, para-lamas, caixas de roda, capô com *fender peaks*, estufa com coluna A inclinada, espelhos, splitter, asa/spoiler, difusor com aletas, tomadas de ar) malhado por *surface nets* próprio e dividido em regiões com corte exato de triângulos: pintura clearcoat com livery projetada (número, faixas, marcas fictícias, frestas de painel), vidro (reflexo + 40 % de transparência), interior escuro (bancos, painel, volante), acabamento preto brilhante, plástico fosco, grade colmeia, faróis e lanternas emissivos (luz de freio ×6), cromo (escapes, espelhos). Rodas modeladas: pneu com lateral e banda de rodagem (normal map gerado), aro de 10 raios (GT) / 5 raios (hatch) extrudado com chanfro, disco ventilado/furado, pinça. Giram, esterçam e acompanham a suspensão. Sombra de contato.
- Triângulos LOD0: GT ≈ 95 mil, hatch ≈ 98 mil (corpo ≈ 64–67 mil); LOD1 ≈ 33 mil (usado > 35 m).

**Verificação:** `verification/gates/p2-s2-0.png` (carro no grid, 3/4 frontal baixa) comparado com a ref 11; `verification/gates/p2-s1-0.png` (perseguição na reta com o sol à frente) — sombras longas do carro visíveis no asfalto, céu com nuvens e sol visíveis, flare discreto.

**Bugs encontrados e corrigidos neste portão (olhando as imagens):**
1. Manchas pretas serrilhadas no para-lama: primeiro suspeitei de *shadow acne* e de *normal map* com UV descontínuo (testei os dois: não eram); um render de debug por região mostrou que **o arco da roda dianteira cortava o topo do para-lama** depois de eu baixar o capô — via-se a caixa de roda por um buraco. Corrigido com *fender peaks* mais altos, seção mais quadrada sobre a roda dianteira e arco limitado à zona da roda; criei `tools/_archcheck.mjs` que confirma pele acima de todos os arcos.
2. O carro do jogador estava borrado pelo motion blur (passe de máscara não era chamado). Corrigido; blur reduzido para "discreto".
3. Aros com 22 mil triângulos cada → reduzidos para 4,7 mil (LOD0) / 2,2 mil (LOD1).

**Diferenças concretas em relação à ref 11 (abaixo do alvo):**
- A ref tem raios de luz volumétricos e contraluz forte com *rim light* no carro; o meu S2 é iluminado de frente pelo sol baixo, sem volumetria.
- O asfalto ainda é um material liso sem textura (vem no P3) — na ref o chão tem textura, AO e sujeira.
- A carroceria é mais "macia": vincos e frestas menos marcados, faróis mais simples; pneus sem inscrições na lateral.
- O cenário atrás é provisório (terreno sem material); na ref há estrutura detalhada e vegetação.

---

## P3 — Orla completa (fatia vertical)

**Construído:** asfalto PBR 2K com segunda textura misturada por ruído (macrovariação), remendos, faixas pintadas com desgaste, faixa de largada quadriculada, boxes de grid pintados, borracha na linha de corrida e bordas empoeiradas; acostamentos por zona (concreto+areia na orla); zebras geradas; terreno com *splat* de 7 camadas (texture arrays 1024²), mistura por altura, biplanar em rocha, faixa de areia molhada com *swash* animado; mar com ondas de Gerstner em 5 frequências + ondulações procedurais, cor por profundidade (fundo do heightfield), transparência na rasa, reflexo do mesmo modelo de céu, trilha de brilho do sol, espuma em bandas na rebentação, linha de *swash* e anéis de espuma analíticos em volta das rochas; areia seca → molhada → espuma → mar; palmeiras, postes, bancos, lixeiras, guarda-sóis + espreguiçadeiras, cercas de praia, torres de salva-vidas, barcos, rochas na água; mureta de pedra (lado do mar) e muro rebocado (lado da encosta); encosta com pinheiros-mansos, oliveiras, ciprestes, arbustos e rochas semienterradas; pórtico de largada com treliça, faixa e luzes de largada.

**Verificação:** `validateWorld()` OK com 860 objetos colocados (0 na faixa de exclusão, 0 flutuando/enterrados). `verification/gates/p3-0.png` (S1: reta da orla, sol à frente) e `p3-1.png` (S3: câmera baixa na areia molhada com rochas). Sanidade de imagem do S1: luminância média 0,49, desvio 0,28.

**Corrigido neste portão (visto nas imagens):**
1. Faixa entre a pista e a praia texturizada como grama → regra de areia por distância ao litoral.
2. Mar leitoso/rosado (reflexo do céu dominando em ângulo rasante) → Fresnel suavizado com a distância, reflexo atenuado e corpo d'água mais profundo.
3. Espuma da praia quase invisível e máscara de espuma de 4 m grossa demais para rochas → bandas mais largas, linha de swash e anéis analíticos por rocha.
4. Imagem lavada (tudo pastel, risco de reprovar no desvio ≥ 0,12) → horizonte oposto ao sol mais azulado, zênite mais profundo, exposição 0,86, curva S de contraste, saturação.
5. Desempenho: 1 600–1 900 draw calls (sombras ×3) e ~66 FPS → sombra do terreno *bakeada* (mapa de altura de sombra calculado numa passada na ordem do sol, aplicado a todo material), terreno fora das cascatas, objetos pequenos sem sombra, sombra dos carros pelo LOD1 (proxy invisível), distância de sombra por tile, junção de malhas → ~1 000 draw calls e ~100 FPS nessa cena.

**Diferenças concretas em relação às refs 01 / 02 / 04 (abaixo do alvo):**
- Ref 01: o ar tem poeira/névoa volumétrica iluminada e as palmeiras têm motion blur forte; no meu S1 as palmeiras são nítidas, não há partículas de poeira nem *god rays*.
- Ref 02: a água rasa é turquesa saturada e a falésia é rocha esculpida com muita vegetação; no meu pôr do sol a água fica rosada/acinzentada e as encostas são lisas, com rochas e arbustos esparsos.
- Ref 04: água transparente com rochas nítidas e respingos brancos; minhas rochas são de baixa poligonagem, a espuma em volta delas é fraca e não há partículas de respingo.
- As folhas das palmeiras ainda mostram serrilhado de alpha-test a distância.

---

## P4 — Zonas 2–4

**Construído:**
- **Z2 Falésia:** serpentina de 3 grampos subindo 48 m; guardrail no lado do precipício (classificado pelo terreno natural), muro de arrimo de pedra + formações de rocha altas e semienterradas no lado do morro (paredão), ciprestes/oliveiras/pinheiros e arbustos nos taludes, balizadores a cada 12 m, placas de seta (chevron) por fora das curvas fechadas, mirante com plataforma (terreno nivelado a partir do `track.json`), balaustrada, bancos, lunetas e poste.
- **Z3 Vila:** terraços planos derivados da spline; **89 casas** (88 a < 30 m da pista) de 2–3 andares em **6 arquétipos** (caiada, sobrado ocre, salmão com loja, pedra, amarela, terracota), todas com janelas em recuo e moldura de pedra, peitoril, venezianas, portas recuadas com degrau, telhado de telha com beiral (quatro águas ou duas águas), e varanda com gradil / toldo / floreira / chaminé conforme o sorteio; igreja com torre sineira de 30 m (marco visível sobre os telhados), praça de pedra com chafariz, oliveiras, ciprestes, bancos, mesas de café, floreiras e postes; frades de pedra/ferro na linha do colisor diante das casas.
- **Z4 Bosque:** vale aberto ao redor da descida (o terreno natural é rebaixado a partir da spline — elimina o "corredor"), pinheiros-mansos em fila e floresta profunda, oliveiras, ciprestes, sub-bosque, rochas, balizadores, chevrons, mesas de piquenique; **ponte de pedra em arcos** com pilares até o fundo da ravina, parapeitos e riacho no fundo.

**Verificação:** `validateWorld()` OK com 4 805 objetos: 0 na faixa de exclusão, 0 bases fora do terreno, 0 casas sobrepostas. Densidade: **mín. 15 props a cada 100 m** (média 33), 6 espécies vegetais, 88 casas, 6 variações. Screenshots: `verification/gates/p4-s4.png` (serpentina com o mar abaixo), `p4-s5.png` (rua da vila com a torre), `p4-s6.png` (bosque com sol baixo à frente), `p4-s7.png` (entrada da ponte ligada ao terreno). Desempenho na vila com 6 carros: ~1 000 draw calls, ~80 FPS a 1080p Alta (RTX 3070 Ti).

**Corrigido neste portão:**
1. Validação pegou 13 arbustos em talude íngreme (base flutuando > 0,3 m) e 2 objetos a 2,9 m da borda numa curva: a dispersão passou a exigir pegada nivelada e a usar a mesma medida (todas as passagens da pista) que o validador.
2. Bosque parecia um corredor (pista num corte de ~20 m entre paredes nuas) → vale rebaixado ao redor da Z4 a partir da spline + rochas/arbustos/árvores nos taludes.
3. Densidade de props abaixo de 12/100 m na falésia e no bosque (7–9) → balizadores a cada 12 m, marcos quilométricos, bandeiras na mureta da orla.
4. Vila com ~1 500 draw calls → menos variantes de árvore, tiles maiores, materiais de casa unificados por cor de vértice.

**Diferenças concretas em relação às referências (abaixo do alvo):**
- Ref 05/06: as casas reais têm reboco manchado, pedras irregulares e muitos objetos pequenos (vasos, varais, fios); as minhas fachadas são limpas e as fileiras de casas são regulares demais (mesmo recuo, alturas parecidas).
- Ref 07: o reboco colorido tem desgaste e o fundo tem motion blur forte; aqui o blur é discreto e o reboco é uniforme.
- Ref 08/10: vegetação em camadas sem vazio e raios de sol volumétricos; meu bosque ainda tem chão aberto entre os pinheiros, copas em "cartões" visíveis de perto e nenhum *god ray*.
- Ref 14: a ponte real tem escala monumental e terreno detalhado; a minha é um viaduto de 3–4 arcos com textura de pedra repetida e o riacho tem traçado serrilhado.
- Ref 02: a falésia tem rocha esculpida em grande escala; meus paredões são rochas deformadas repetidas.

---

## P5 — Corrida

**Construído:**
- **Regras** (`src/race.js`): grid de 6 (jogador em 4º), apresentação do grid de ~5 s, 3-2-1 com as luzes do pórtico; até o "VAI!" todos ficam presos no freio com embreagem livre (o motor gira, o carro não anda) e no "VAI!" todos recebem o mesmo estado de partida, então acelerar antes não dá vantagem. 33 portões de checkpoint em sequência, passados pela projeção contínua do progresso na spline: sair largo da pista ainda conta, mas um salto de trecho não credita portão nenhum; cruzar a linha com portões faltando é **corte** (aviso na tela, a volta não conta e recomeça). Posição ao vivo pela distância de corrida, limitada ao próximo portão exigido. Volta, melhor volta, bandeirada; IAs que ainda não terminaram recebem tempo projetado pela média de velocidade, marcado com "≈".
- **IA:** a mesma física do jogador; habilidade por posição de largada (carros mais lentos largam na frente para o pelotão se reorganizar), ultrapassagem por troca de linha, desvio de colisão óbvia; Fácil/Normal/Difícil alteram velocidade-alvo e agressividade.
- **Interface** (`src/ui/`): menu com a pista ao vivo (6 carros correndo, câmeras de transmissão), garagem com o carro girando sob o sol baixo, configuração (voltas, dificuldade, qualidade), intro do grid, HUD em canvas (posição, classificação, volta, tempo atual e melhor, velocidade, marcha, conta-giros, minimapa, contagem e mensagens), pausa (continuar, reiniciar, configurações, menu), configurações (qualidade, volumes geral/efeitos/música, controles), resultados (correr de novo / menu). Teclado, mouse e gamepad no mesmo modelo de foco. Câmera de capô na tecla C.
- **Áudio** (`src/audio/`): banco com 26 gravações CC0. Motor do jogador com **6 (GT) e 7 (hatch) faixas de RPM** extraídas de gravações reais, crossfade de potência constante em log-RPM, `playbackRate = rpm / rpm da faixa`, camadas de carga e de alívio (filtro e nível), corte de ignição e estalo na troca de marcha, pulsação no limitador, estouros ao aliviar em alta. Pneus em duas camadas proporcionais ao escorregamento; rolagem por superfície (asfalto, zebra com modulação na frequência das faixas, ponte com ressonância oca e junta de dilatação, cascalho, areia, grama); vento crescente com a velocidade; colisões proporcionais ao impacto; raspão contínuo. Ambiências por zona com transição por distância (ondas e gaivotas, vento da falésia, vozes da vila e sinos posicionais na torre, pássaros e cigarras). IAs com panner HRTF, atenuação, Doppler leve (metade do físico), no máximo 5 vozes, as distantes silenciam e o bus das IAs abaixa quando o pelotão encosta. Buses separados → compressor → limitador → curva de saturação com teto de −1,6 dBFS (garantia de pico ≤ −1 dBFS). Música só no menu e nos resultados; sons de UI sintetizados; pausa abafa; reinício não duplica vozes. O áudio só é criado na primeira interação.
- **Partículas:** fumaça de pneu, poeira, areia e borrifos nas rochas.

**Verificação** (`npm run verify`, ver `REPORT.md` e `REPORT-dados.md`): jornadas de 3 e 6 voltas pela interface com 5 IAs, resultados e "correr de novo"; pausa/continuar, 3 reinícios no meio (vozes persistentes constantes, heap estável), volta ao menu; anticorte; IA (nenhuma parada/fora da pista por mais de 5 s, ultrapassagens entre IAs); integridade (0 eventos de invariante, câmera nunca dentro da geometria); gravação do master numa volta com pico ≤ −1 dBFS e todos os eventos pedidos em 13.2.

**Corrigido neste portão:**
1. O Chromium headless abria o `AudioContext` a 192 kHz (4× o custo de mixagem) → fixado em 48 kHz.
2. Corrida de pendência entre a primeira interação e o fim da decodificação do áudio: o modo "menu" começava depois da garagem → `endRace()` cancela pendências.
3. Portões de checkpoint como segmentos de reta: um carro que saía largo além da largura do portão perdia a volta inteira (uma volta de 221 s numa rodada de teste) → portões pela projeção contínua do progresso.
4. Ritmo: IA Normal fazia 1:43 (abaixo de 1:45 em ritmo bom) → menos aderência e potência, mais arrasto, velocidade-alvo da IA ajustada.
5. Bordas serrilhadas na parte baixa da carroceria (classificação de regiões dependente da normal) → fronteiras exatas por conjuntos de nível; a parte de baixo do carro não é mais recortada.
6. A bandeira da praia lembrava uma bandeira nacional → bandeira de clube fictícia.

**Diferenças concretas / abaixo do alvo:**
- A camada de alívio do motor é derivada das mesmas gravações (filtro + nível); jogos comerciais usam gravações separadas de desaceleração.
- Não há túnel no circuito (há ponte), então não há reverb de túnel.
- As IAs não têm pneus cantando próprios (só motor posicional e impactos perto do jogador).
- HUD sem parciais nem delta para o carro da frente.

---

## P6 — Verificação final

**Construído:** `tools/verify.mjs` (`npm run verify`) e o harness de teste `src/testing/harness.js` (posições de câmera S1–S12 no código, esperas por tempo de simulação para serem reproduzíveis em qualquer taxa de quadros, céu medido no depth buffer, auditoria da cena lida do scene graph, varredura a cada 25 m, captura de vídeo e de áudio, medição de desempenho). O verificador grava `results.json`, `REPORT-dados.md`, `image-metrics.json`, `scene-stats.json`, `screenshots/`, `compare/`, `sweep/`, `sweep-sheet.png`, `volta.webm`, `audio-volta.wav` e `logs/`, e sai com código 1 se qualquer teste falhar.

**Corrigido neste portão (encontrado pelo próprio verificador):**
1. **Desempenho Alta na Vila: 51 FPS** na primeira rodada completa. Perfilando: o passe de máscara do carro (motion blur) renderizava a cena sem as luzes, o estado de luzes do three mudava e todo material iluminado reavaliava o programa a cada quadro (~21% da CPU e 27 MB/s de lixo); materiais metálicos eram compartilhados entre malhas instanciadas e comuns; o material de profundidade padrão das sombras alternava de estado entre objetos; proxies de sombra dos carros com 29,5 mil triângulos; vegetação, rochas e props projetavam sombra por blocos de 420 m. Correções: luzes também na camada da máscara; cópias de material para malhas comuns; um material de profundidade por configuração; casco de sombra grosseiro (malha única) por carro; conjunto dinâmico só-sombra (camada 6) com o que está a até 110 m; grades de ferro sem sombra; LOD1 dos carros a partir de 12 m; árvores até 1,15 km. Resultado: ver 13.3.
2. **Sanidade de imagem na varredura:** 9 de 135 pontos com luminância média abaixo de 0,25 em trechos na sombra → adaptação parcial de exposição no pós-processamento (log-luminância média, fator 0,9–1,45×, salto instantâneo em cortes de câmera).
3. **Veto "mar sem espuma"/padrões estranhos no S3:** a areia rasa mostrava manchas — eram a interseção do mar com um fundo de areia com ±0,35 m de ruído bem na linha d'água (praia de 3,5%), mais espuma de crista em 10 cm de água → fundo liso perto da linha d'água, espuma de crista só em água funda, espuma de espraiamento em linhas finas, anéis de espuma maiores nas rochas e borrifos; rochas sem frestas.
4. **Auditoria da cena:** tufos de grama com 6 triângulos (detector de caixa), telhado e porta da igreja simples demais, 18 texturas procedurais abaixo de 1024² → tufos subdivididos e curvados, telhado em fiadas de telha com cumeeira, porta almofadada, texturas a ≥ 1024² (mesmo desenho, mais resolução).
5. **Reprodutibilidade das screenshots:** as esperas contavam quadros, então o carro andava distâncias diferentes conforme o FPS (o S5 perdeu a torre numa rodada) → esperas por tempo de simulação.
6. **Enquadramento do S4 e do S5:** o S4 mostrava só um lance da estrada; o S5 escondia a torre atrás das casas ou sob o HUD. Agora o S4 escolhe, entre candidatas acima da serpentina, a câmera que enxerga mais lances (teste de frustum + oclusão pelo terreno) com céu no quadro, e o S5 escolhe a posição do carro em que a torre fica no quadro, fora dos painéis do HUD, testando um raio contra as malhas reais da vila. Puffs de fumaça deixados pelo reposicionamento dos carros (rodas paradas a 60 km/h) → rodas e marcha já compatíveis com a velocidade no teleporte e limpeza das partículas depois que o carro assenta.
