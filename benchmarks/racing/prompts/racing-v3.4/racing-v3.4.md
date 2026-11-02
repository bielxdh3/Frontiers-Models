# Racing-bench V3.4 — Race-First Visual Edition

> Status: candidata. Arquivo novo; a V3.3 continua FROZEN e não é alterada.
> Pacote do executor: este arquivo + a pasta `refs/`. Nada mais.

---

## 0. Missão

Construa, para navegador desktop, **um jogo de corrida 3D contra 5 IAs, em um único circuito costeiro ao pôr do sol, que pareça um jogo comercial em screenshots de gameplay real.**

Este é um benchmark de **acabamento visual, sonoro e de jogabilidade**. Quantidade de sistemas não conta. Um item a mais mal acabado conta contra.

**Três regras que valem mais que o resto:**

1. **O mundo nasce de uma fonte única** (seção 3). Um carro andando debaixo do chão, uma casa dentro da pista ou um terreno flutuando são falhas graves, não detalhes.
2. **Você constrói em fatias verticais com portões** (seção 12). Só avance quando a fatia atual passar no portão.
3. **Você olha o que fez.** Em cada portão, capture as screenshots, compare com as referências e corrija antes de seguir.

---

## 1. Escopo fechado

### Dentro

| Item | Exigência exata |
| --- | --- |
| Modo | 1: Corrida contra IA |
| Voltas | 3 (padrão) ou 6 |
| Adversários | 5 IAs |
| Dificuldade | Fácil / Normal / Difícil |
| Circuito | 1, fechado, **2,5–3,5 km**, volta de **1:45–2:30** em ritmo bom |
| Carros | **2 modelos**, feitos por você; 6 pinturas/números no grid |
| Hora/clima | Golden hour fixo, céu limpo com nuvens esparsas, seco |
| Câmeras | Perseguição (padrão) + capô |
| Controles | Teclado e gamepad |

### Fora (não implementar, nem parcialmente)

Outros modos, modo Diretor, replay, photo mode, editor de pista, construtor/tuning de carro, dano mecânico, pit stop, simulação de pneus, ciclo dia/noite, chuva, clima dinâmico, nitro, multiplayer, backend, contas, conquistas, loja, cutscenes, "features assinatura" inventadas, cockpit/interior detalhado, mundo aberto, áreas internas.

Implementar algo desta lista conta contra a entrega.

---

## 2. Referências visuais

A pasta `refs/` traz 14 imagens de jogos comerciais. Elas são **alvo de qualidade e composição**, nunca assets.

- **Proibido** usar, recortar, traçar, projetar ou amostrar qualquer pixel delas.
- **Proibido** reproduzir carros reais, logos, marcas ou locais reconhecíveis.

| Arquivo | Observe |
| --- | --- |
| `01-golden-hour-palmeiras.jpg` | **Alvo de luz.** Sol baixo, contraluz quente, céu do laranja ao azul, contorno de luz no carro |
| `02-costa-praia-falesia.jpg` | Falésia em primeiro plano, praia curva, mar mudando de cor com a profundidade, névoa no horizonte |
| `03-areia-dunas-cercas.jpg` | Areia com microrrelevo e marcas, cercas de praia, poeira |
| `04-agua-margem-pedras.jpg` | Transparência da água, espuma e respingos em volta das pedras |
| `05-vila-igreja-densidade.jpg` | **Densidade:** quantidade de props num quadro |
| `06-vila-pedra-disputa.jpg` | Casas de pedra detalhadas, escala carro/casa, disputa |
| `07-vila-paredes-velocidade.jpg` | Reboco colorido, motion blur no fundo com o carro nítido |
| `08-vegetacao-densa.jpg` | Vegetação em camadas sem espaço vazio |
| `09-vegetacao-curva-disputa.jpg` | Curva com vegetação dos dois lados, carros lado a lado |
| `10-luz-rasante-floresta.jpg` | Raios de sol entre árvores, névoa quente |
| `11-carro-pintura-vidro-rodas.jpg` | **Alvo de carro:** clearcoat, vidro com reflexo, rodas, sombra de contato |
| `12-carro-reflexo-motion-blur.jpg` | Reflexo na pintura em movimento, blur só no fundo |
| `13-pelotao-ia-lado-a-lado.jpg` | Pelotão próximo, câmera baixa, velocidade |
| `14-ponte-terreno.jpg` | Ponte ligada ao terreno, escala da paisagem |

Fontes (Steam, acesso em 2026-11-01): Forza Horizon 4 (app 1293830), 5 (1551360) e 6 (2483190), © Microsoft / Playground Games. URLs no fim do arquivo.

**O que nunca deve acontecer**, mesmo que nenhuma referência mostre: ambiente que pareça interior, corredor ou labirinto; céu escondido; luz uniforme e amarelada sem sombras; textura repetida em parede/chão até o horizonte; lugar vazio e silencioso. É a estética "Backrooms", e ela reprova a build.

---

## 3. Integridade do mundo (fonte única)

Esta seção existe para eliminar carro debaixo da terra, casas dentro da pista, chão flutuando e física que não bate com o visual.

### 3.1 Uma fonte de verdade

- A pista é definida por **uma única spline 3D fechada** (pontos de controle com posição, largura e inclinação lateral), em um arquivo de dados (`track.json`).
- **Tudo é derivado dela**, nesta ordem:
  1. Malha da estrada (visual)
  2. Collider da estrada (da **mesma** malha ou do mesmo dado; nunca um plano separado)
  3. Terreno: um heightfield que é **rebaixado/elevado para encostar na estrada**, com taludes suaves de 6–15 m nas laterais
  4. Collider do terreno (do mesmo heightfield)
  5. Faixas de exclusão de ≥ 3 m além da borda da pista, onde nenhum objeto é colocado
  6. Zebras, guardrails, muros e checkpoints, posicionados por distância ao longo da spline
  7. Linha de corrida da IA
  8. Casas, vegetação e props, posicionados em relação à spline e **apoiados no terreno por raycast**
- É **proibido** posicionar objetos com coordenadas fixas soltas que não passem por esse processo.
- A geração é determinística: a mesma semente gera o mesmo mundo.

### 3.2 Invariantes (verificados por código)

Escreva uma função `validateWorld()` que roda na carga em modo dev e no teste automatizado. Ela falha (erro explícito) se:

| Invariante | Limite |
| --- | --- |
| Terreno acima da superfície da estrada dentro da largura da pista | > 0,02 m |
| Vão entre borda da estrada e terreno (buraco ou degrau) | > 0,15 m |
| Objeto (casa, árvore, prop) dentro da faixa de exclusão | qualquer |
| Base de objeto flutuando ou enterrada em relação ao terreno | > 0,3 m (exceto rochas, que podem afundar) |
| Casas se sobrepondo | qualquer |
| Inclinação lateral da estrada | > 12° |
| Inclinação longitudinal | > 14% |
| Raio de curva menor que o mínimo dirigível | < 25 m |
| Checkpoint fora da pista ou fora de sequência | qualquer |

### 3.3 Invariantes em tempo de jogo

Verificados a cada frame em modo dev e registrados no teste:

- Cada roda (do jogador e das IAs) tem contato com uma superfície ou está a menos de 1,5 m dela, exceto em salto real; a carroceria **nunca** fica abaixo da superfície da estrada/terreno.
- Se um carro ficar abaixo do terreno, atravessar um collider ou cair fora do mundo: **reset imediato** para o último ponto válido da spline e um registro no log. No teste, zero ocorrências são aceitas.
- A câmera nunca entra no terreno, em paredes ou em casas (colisão de câmera com recuo suave).
- Spawn do grid: carros posicionados por raycast na estrada, nunca em altura fixa.
- Timestep físico fixo (ex.: 120 Hz) com sub-stepping; nada atravessa barreira em velocidade máxima.

### 3.4 Escala

- 1 unidade = 1 metro. Carro ~4,5 × 1,9 × 1,3 m. Pista com 10–12 m de largura. Andar de casa ~3 m. Porta ~2,1 m. Árvores de 4–15 m.
- Teste de escala: no `REPORT.md`, inclua uma screenshot do carro parado ao lado de uma casa e uma porta.

---

## 4. O circuito

Litoral mediterrâneo fictício. A volta tem **4 zonas, nesta ordem**:

**Z1 — Orla (largada/chegada)**
- Reta beira-mar com o sol à frente, quase no horizonte
- Grid pintado, pórtico de largada, muretas com bandeiras
- Praia: areia seca → areia molhada mais escura → espuma → mar
- Rochas na água com espuma

**Z2 — Falésia**
- Serpentina de 3 ou mais curvas, ganho de altura **≥ 40 m**
- Guardrail de um lado, paredão de rocha do outro
- Mirante com a orla visível abaixo

**Z3 — Vila**
- Rua de 400 m ou mais entre casas, **sempre a céu aberto**, com o céu visível em qualquer ponto
- Pelo menos **25 casas** de 2–3 andares a menos de 30 m da pista
- Marco: igreja com torre **ou** farol, visível de longe
- Praça ou rotatória com vegetação

**Z4 — Bosque e descida**
- Descida rápida entre pinheiros-mansos e oliveiras
- **Uma ponte ou um túnel**; um túnel tem no máximo 150 m e precisa de iluminação interna e saída visível
- Volta para a Z1

**Leitura:** de qualquer ponto da pista, na câmera de perseguição, o jogador vê céu, horizonte ou mar, ou um marco. Nenhum trecho parece corredor fechado.

---

## 5. Padrões de arte

"Perto" = a menos de 50 m da pista.

### 5.1 Carros

- Feitos por você (modelagem procedural ou mesh própria). **Proibido** baixar carro pronto.
- Superfícies curvas contínuas: capô, para-lamas arredondados, teto, coluna A inclinada, para-choques, saias, spoiler/difusor. **Proibido** carro de caixas e cilindros visíveis.
- 2 silhuetas claramente diferentes (ex.: cupê GT baixo × hatch esportivo).
- **≥ 15.000 triângulos** por carro no LOD0.
- Materiais separados: pintura clearcoat, vidro (reflexo + leve transparência com interior escuro simples), cromo, borracha, plástico fosco, faróis e lanternas emissivos.
- Rodas: aro com raios, pneu com lateral, disco e pinça visíveis. Giram, esterçam e acompanham a suspensão.
- Sombra de contato; luz de freio acende; carroceria rola e arfa.

### 5.2 Materiais

- Toda superfície perto da pista usa PBR (albedo + normal + roughness). **Proibido** cor sólida em área grande perto da pista.
- Mínimo de 1024² perto da pista e 2048² no asfalto.
- Tiling disfarçado: macrovariação, blend de 2+ texturas e decalques.
- Asfalto com faixas pintadas, borracha na linha de corrida e bordas gastas.
- **Uma textura não pode cobrir mais que ~30% de um quadro de gameplay** sem variação visível.

### 5.3 Construções

Cada casa perto da pista tem: janelas com recuo e moldura, porta, telhado de telha com beiral, e pelo menos um entre varanda, toldo, floreira e chaminé. **≥ 5 variações**, com cores de reboco diferentes. **Proibido** caixa com textura de fachada colada.

### 5.4 Vegetação e props

- **≥ 4 espécies** (pinheiro-manso, oliveira, palmeira, arbusto), com folhagem alpha ou malha; variação de escala, rotação e tom.
- **Proibido** árvore cone + cilindro.
- Vegetação rasteira nas bordas fora da vila.
- **≥ 12 props a cada 100 m** de pista.

### 5.5 Mar, praia e céu

- Ondas animadas em várias frequências; reflexo do sol e do céu.
- Cor do mar varia com a profundidade.
- **Espuma animada** na praia e nas rochas; areia molhada escurece.
- O mar se estende até o horizonte, sem borda visível.
- Céu com gradiente coerente com o sol; sol visível; névoa atmosférica no horizonte.

### 5.6 Luz e imagem

- HDRI de pôr do sol CC0 para luz ambiente e reflexos + sol direcional na mesma direção e cor.
- **Luz ambiente fraca o bastante para que as sombras sejam claramente visíveis.** Luz ambiente alta e uniforme é proibida.
- Sombras dinâmicas suaves e estáveis (cascatas ou frustum que segue o carro).
- Oclusão ambiente nas junções.
- Tone mapping ACES ou AgX; saída sRGB correta.
- Névoa só na distância (começa a > 150 m); nunca uma névoa densa perto da câmera.
- Bloom, motion blur e flare discretos; o motion blur nunca borra o carro do jogador nem o HUD.

### 5.7 Câmera

- Perseguição: ~6 m atrás, ~1,8 m acima, horizonte no terço superior, FOV 60–75° pela velocidade, com mola suave.
- Colisão de câmera (seção 3.3).

### 5.8 Veto visual

Reprova se qualquer screenshot obrigatória mostrar:

carro abaixo do chão ou flutuando · objeto atravessando a pista · estrada como faixa cinza lisa · mar plano ou sem espuma · carro de caixas ou com vidro preto chapado · casas como cubos · árvores idênticas em fila · cor sólida em área grande perto da pista · textura repetida dominando o quadro · céu ausente · luz uniforme sem sombras · sombras cintilando · bloom estourado · pop-in à frente · trecho vazio à beira da pista · aparência de interior/corredor.

---

## 6. Áudio

O áudio tem o mesmo peso do visual. Um motor que soa como zumbido de oscilador reprova a build.

**Motor (jogador)**
- **Amostras gravadas de motor real em loop, em 4 ou mais faixas de RPM**, com crossfade pelo RPM. **Proibido** oscilador único como som principal.
- Camadas acelerando e aliviando, com transição suave.
- Os 2 carros com timbres diferentes.
- Troca de marcha audível (corte, queda de RPM, estalo opcional); limitador no RPM máximo.
- Loops sem clique.

**Mundo e contato**
- Pneus: cantar proporcional ao escorregamento; rolagem diferente em asfalto, zebra, areia e grama.
- Vento crescente com a velocidade.
- Colisões proporcionais à força; raspão contínuo no guardrail.
- Ambiente por zona: ondas e gaivotas (Z1), vento (Z2), vozes e sinos distantes (Z3), pássaros e cigarras (Z4), com transição por distância.
- Túnel com reverb; ponte com mudança de rolagem.

**IAs**
- Motores posicionais 3D com atenuação e Doppler leve. No máximo 5 vozes ativas; as distantes silenciam. O pelotão nunca abafa o jogador.

**Mixagem**
- Buses separados (jogador, IAs, efeitos, ambiente, UI, música) e limiter no master.
- **Pico do master ≤ −1 dBFS** em qualquer situação.
- Música opcional: só em menu/resultados, ou muito baixa na corrida.
- Sons de UI consistentes (navegação, confirmação, 3-2-1, bandeirada).
- Áudio inicia após a primeira interação, sem erro no console.
- Pausa silencia/abafa; reiniciar não duplica vozes.
- Volumes: master, efeitos, música.

**Fontes:** Freesound filtrado para CC0, OpenGameArt CC0 ou síntese própria (só ambiência e UI).

---

## 7. Assets externos

Permitido **somente** CC0, empacotado localmente:

- **Poly Haven** (polyhaven.com): HDRIs, texturas, rochas, plantas, props
- **ambientCG** (ambientcg.com): texturas PBR
- **Kenney** (kenney.nl): props, retexturizados para o estilo
- **Freesound** (freesound.org), apenas CC0: sons

Proibido carro pronto, código de jogos ou cenas de terceiros. Bibliotecas open source de engine são permitidas (Three.js, Babylon.js, Rapier, cannon-es, postprocessing etc.). Liste tudo em `ASSET-LICENSES.md`. Build de até **400 MB**; texturas comprimidas (KTX2/Basis) quando possível.

---

## 8. Jogabilidade

- Física arcade com peso: aceleração, frenagem, esterço dependente da velocidade, derrapagem controlável. Sem simulação detalhada de pneu/motor.
- Colisões carro×carro e carro×barreira críveis, sem atravessar.
- Reset automático: capotado, mais de 3 s fora da pista ou parado, ou abaixo do terreno.
- Partículas: fumaça de pneu, poeira e areia fora do asfalto.

## 9. IA

- 5 carros com a **mesma física** do jogador. Proibido teleporte, rubber-band visível e posição fabricada (o reset de segurança da seção 3.3 é a única exceção e é registrado no log).
- Linha de corrida derivada da spline, com velocidade-alvo por trecho; frenagem antes das curvas; troca de linha para ultrapassar; evitam colisões óbvias.
- A dificuldade altera a velocidade-alvo e a agressividade.

## 10. Regras e interface

- Checkpoints em sequência; cortar caminho não conta volta.
- Posição em tempo real pelo progresso na spline.
- Contagem 3-2-1; queimar a largada não dá vantagem.
- Fim quando o jogador completa a última volta; IAs restantes recebem tempo projetado com "≈".

Fluxo: **Menu (pista ao vivo no fundo) → Garagem (2 carros, 6 cores, carro girando na luz do pôr do sol) → Configuração (voltas, dificuldade, qualidade) → Apresentação do grid (~5 s) → 3-2-1 → Corrida → Resultados → Correr de novo / Menu.**

HUD discreto: posição, volta, tempo atual e melhor volta, velocidade, marcha/RPM, minimapa. Pausa: continuar, reiniciar, menu. Configurações: qualidade (Baixa/Alta), volumes, controles.

## 11. Desempenho

- **Alta:** ≥ 60 FPS médio em GPU classe RTX 3060, 1080p, na Z3 com 5 IAs.
- **Baixa:** ≥ 60 FPS em GPU integrada recente. Reduz sombras, distância de vegetação, resolução interna e pós. **Mantém** texturas e formas. Baixa nunca vira blocos lisos.
- Shaders pré-compilados na carga; sem travada ao mudar de zona.
- Tela de carregamento com progresso real.

---

## 12. Ordem de trabalho com portões

Construa nesta ordem. Em cada portão: rode `validateWorld()`, capture as screenshots indicadas, compare com as referências, escreva no `verification/GATES.md` o que está abaixo do alvo e **corrija antes de avançar**. Avançar com um portão reprovado conta contra a entrega.

| Portão | Construído | Precisa passar |
| --- | --- | --- |
| **P1 — Esqueleto** | `track.json`, estrada, terreno, colliders, carro-placeholder dirigível, câmera | `validateWorld()` sem erros; 1 volta dirigida sem atravessar nada; screenshot vista de cima mostrando a volta inteira |
| **P2 — Luz e carro** | HDRI, sol, sombras, tone mapping, **carro final** com materiais | S2 comparável à ref 11; S1 com sombras visíveis e céu à vista |
| **P3 — Orla completa** | Z1 com mar, praia, espuma, props | S1 e S3 comparáveis às refs 01, 02, 04. **Esta é a fatia vertical:** Z1 precisa parecer pronta antes de iniciar Z2 |
| **P4 — Zonas 2–4** | Falésia, vila, bosque, ponte/túnel | S4–S7 aprovadas; `validateWorld()` sem erros; densidade de props cumprida |
| **P5 — Corrida** | IA, checkpoints, regras, áudio, UI | Testes 13.1 e 13.2 passando |
| **P6 — Polimento** | Otimização, preset Baixa, ajustes finais | Seção 13 completa |

Se faltar tempo, reduza a extensão das zonas ou os props distantes. **Nunca** reduza o acabamento do carro, da pista próxima, da luz ou do áudio do motor.

---

## 13. Verificação obrigatória

Execute de verdade, salve em `verification/` e não invente números.

### 13.0 Regras de prova

Sua autoavaliação **não conta como prova**. Quem avalia o benchmark vai rodar tudo de novo. Por isso:

1. **Um comando reproduz tudo.** `npm run verify` sobe o servidor, roda todos os testes, captura screenshots, vídeo, áudio e métricas, e grava em `verification/`. Se o comando não rodar numa máquina limpa (`npm ci && npm run verify`), a entrega reprova inteira.
2. **Divergência reprova.** Se o que o avaliador gerar com `npm run verify` divergir dos arquivos que você entregou (screenshots, métricas, FPS fora de ±15%), a entrega reprova por relatório falso.
3. **Você precisa olhar.** Para cada screenshot, gere `verification/compare/sN.png`, com a sua imagem ao lado da referência indicada, no mesmo tamanho. Abra cada comparação e escreva no `REPORT.md` pelo menos **3 diferenças concretas** em relação à referência (ex.: "o mar não tem espuma nas rochas", "as casas não têm beiral"). Um relatório sem diferenças, ou com frases genéricas como "ficou ótimo" ou "parecido com a referência", é tratado como não feito.
4. **Vídeo obrigatório.** Grave `verification/volta.webm`, uma volta completa em Alta na câmera de perseguição, com as IAs e o áudio. Screenshot pode ser escolhida a dedo; o vídeo não.
5. **Métricas da cena vêm do código, não de você.** O verificador lê a cena carregada e grava `verification/scene-stats.json` (seção 13.1, teste 8).
6. **Qualquer teste falhando reprova.** Não há "passou parcialmente". Se algo falhar e você não conseguir corrigir, declare a falha no topo do `REPORT.md`. Esconder uma falha é pior que entregá-la.

**13.1 Testes automatizados** (Playwright ou equivalente), com logs salvos:

1. Jornada: menu → carro → 3 voltas com 5 IAs → resultados → correr de novo (piloto automático do jogador é permitido só no teste)
2. Mesma jornada com 6 voltas
3. Pausa/continuar, reiniciar no meio, voltar ao menu: sem estado antigo, sem áudio duplicado, heap estável após 3 reinícios
4. Anticorte: cortar a pista não conta volta
5. IA: nenhuma IA parada/fora da pista por mais de 5 s; ao menos 1 ultrapassagem entre IAs
6. **Integridade:** `validateWorld()` sem erros; durante as corridas dos testes 1 e 2, **zero** eventos de carro abaixo do terreno, atravessando collider ou caindo do mundo; câmera nunca dentro de geometria
7. **Sanidade de imagem**, calculada sobre cada screenshot S1–S9:
   - Céu visível ≥ 10% do quadro (exceto S7, se for túnel)
   - Luminância média entre 0,25 e 0,75; desvio padrão ≥ 0,12 (sem imagem chapada, escura demais ou estourada)
   - Nenhuma cor única ocupando > 30% do quadro
   - Valores salvos em `verification/image-metrics.json`
8. **Auditoria da cena** (lida do scene graph em runtime, gravada em `scene-stats.json`). Falha se:
   - Algum carro tiver < 15.000 triângulos no LOD0 ou < 6 materiais distintos
   - **Detector de caixa:** algum mesh perto da pista for uma caixa (≤ 12 triângulos, ou BoxGeometry) com mais de 1 m em qualquer eixo, exceto colliders invisíveis
   - **Detector de cor chapada:** algum material de superfície visível perto da pista estiver sem mapa de albedo **e** sem mapa de normal, exceto vidro, emissivos e água
   - A contagem de casas, de variações de casa, de espécies de vegetação ou de props a cada 100 m estiver abaixo da seção 5
   - Alguma textura perto da pista tiver resolução abaixo da mínima
   - O motor de áudio do jogador não usar amostras (nenhum `AudioBuffer` ligado ao motor)
9. **Varredura de câmera:** o verificador posiciona a câmera de perseguição a cada 25 m da volta inteira e captura uma miniatura de cada ponto (`verification/sweep/`, mais uma folha de contato `sweep-sheet.png`). Todas passam pelas métricas do teste 7. Assim nenhum trecho feio fica escondido entre as screenshots escolhidas.

**13.2 Áudio:** grave o master durante 1 volta com as IAs (`verification/audio-volta.wav`). No `REPORT.md`: pico máximo em dBFS (≤ −1), máximo de vozes simultâneas, e instantes (mm:ss) de troca de marcha, derrapagem, colisão, túnel/ponte e passagem por uma IA. Após 3 reinícios, o número de vozes volta ao valor inicial.

**13.3 Desempenho:** FPS médio e 1% low em Alta e Baixa na Z3, com GPU, CPU, navegador e resolução informados.

**13.4 Screenshots** durante corrida real, em Alta, 1920×1080, com HUD, IAs presentes e FPS no nome do arquivo. Posições de câmera definidas no código e reproduzíveis por script:

| # | Arquivo | Conteúdo | Compare com |
| --- | --- | --- | --- |
| S1 | `s1-reta-orla.png` | Reta da orla em velocidade, sol à frente | 01, 02 |
| S2 | `s2-grid-3-4.png` | Carro no grid, 3/4 frontal baixa (sem HUD) | 11 |
| S3 | `s3-praia-espuma.png` | Câmera baixa: areia molhada, espuma, rochas | 02, 04 |
| S4 | `s4-falesia-mirante.png` | Serpentina com o mar abaixo | 02 |
| S5 | `s5-vila-rua.png` | Rua da vila com o marco visível | 05, 06, 07 |
| S6 | `s6-bosque-luz.png` | Bosque com sol rasante | 08, 10 |
| S7 | `s7-ponte-ou-tunel.png` | Entrada da ponte/túnel ligada ao terreno | 14 |
| S8 | `s8-disputa.png` | Jogador lado a lado com 2+ IAs | 09, 13 |
| S9 | `s9-close-pista.png` | Close de asfalto, zebra e guardrail | — |
| S10 | `s10-baixa-vila.png` | Posição de S5 em Baixa | — |
| S11 | `s11-escala.png` | Carro parado ao lado de uma casa com porta | — |
| S12 | `s12-mapa.png` | Vista de cima da volta inteira | — |

Em `verification/REPORT.md`, para cada screenshot: autoavaliação honesta contra o veto (5.8) e contra a referência indicada, e o que ficou abaixo do alvo.

## 14. Entrega

- Site estático; `index.html` na raiz; abre com servidor estático local e funciona offline
- `track.json` (fonte única do mundo)
- `README.md`: como rodar, controles, hardware testado, FPS, limitações conhecidas
- `ASSET-LICENSES.md`
- `npm run verify` funcionando a partir de `npm ci`
- `verification/`: `GATES.md`, `REPORT.md`, logs, `scene-stats.json`, `image-metrics.json`, `volta.webm`, `audio-volta.wav`, screenshots, `compare/`, `sweep/`
- Nenhum arquivo de `refs/` dentro do build

---

### URLs das referências

1. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_16be1ecc46e7c0a3aa68e646af904c66ea8e1c81.1920x1080.jpg
2. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_00f0090174380eeaf8753bd3d1028b6772c3aebf.1920x1080.jpg
3. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1293830/ss_e88792a0331f460d913ac05203f7c1b12112b14c.1920x1080.jpg
4. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_3c16188972c826942f47991d91b0f6dc17e01fc9.1920x1080.jpg
5. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_d26239d188301bb6f2475c6d323ae007195b7542.1920x1080.jpg
6. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1293830/ss_f79c110d699dadfdb6945984a65a2aa825787075.1920x1080.jpg
7. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_c8390c1e88ba5e660a58e8e435ebc77dcda5c91d.1920x1080.jpg
8. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_78e4f63e05d50e59b9966ba8da9a53dbf84fd8f4.1920x1080.jpg
9. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1293830/ss_ae4d2485f415b08ba4c00195d29680369e23405a.1920x1080.jpg
10. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/d4b81f0cafcfba410371e53bd696fb5cc9b434c0/ss_d4b81f0cafcfba410371e53bd696fb5cc9b434c0.1920x1080.jpg
11. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_cf56e25a0290556ba83229eb0ab370d10be0407c.1920x1080.jpg
12. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_1da0673f82eccc3c9d222237dec40e36bf10eef3.1920x1080.jpg
13. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/701382eb1431c978e0c7e2518f47aa02b3fe6583/ss_701382eb1431c978e0c7e2518f47aa02b3fe6583.1920x1080.jpg
14. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/ss_af9712cbc5121307926cb3e7dfc7228d45940557.1920x1080.jpg
