# Relatório de verificação — Costa Dourada (Racing-bench V3.4)

Execução de referência: `npm run verify` terminada em 2026-11-05T22:18:29.205Z (AMD Ryzen 7 5700G with Radeon Graphics, ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti Direct3D11 vs_5_0 ps_5_0, D3D11), Windows_NT 10.0.26300, Chromium 156.0.8078.4 (Playwright, headless, ANGLE D3D11), Node v24.14.1). Os números abaixo vêm de `verification/results.json`; as mesmas tabelas são regeneradas em `verification/REPORT-dados.md` a cada execução.

## Falhas e pendências (leia primeiro)

**Nenhum teste automatizado falhou nesta execução** (13.1 testes 1–9, 13.2, vídeo, 13.3, console sem erros).

Pendências que não são testes automatizados, declaradas para não parecerem resolvidas:
- **Baixa em GPU integrada não medida.** A especificação pede ≥ 60 FPS em Baixa numa GPU integrada recente; nesta máquina a Radeon integrada do Ryzen 7 5700G está desativada e só a RTX 3070 Ti está disponível. O número de Baixa abaixo é da RTX 3070 Ti.
- **Alta não medida numa RTX 3060.** A meta é ≥ 60 FPS numa RTX 3060; medi numa RTX 3070 Ti (mais rápida). A margem está em 13.3; o renderizador faz ~500 draw calls por quadro na vila, então CPUs mais lentas também pesam.
- **Sem luz volumétrica** (*god rays*, névoa iluminada): é a diferença visual mais recorrente contra as referências 01, 08, 10 e 11.
- **Sem túnel:** o circuito tem ponte; por isso não há reverb de túnel (na ponte a rolagem muda e há juntas de dilatação).
- **Volta em ritmo bom:** as voltas lançadas da IA Normal ficam em 1:45,6–1:50; o piloto automático usado nos testes (IA Difícil) faz 1:43,8–1:45,7, ou seja, a volta mais rápida fica ~1 s abaixo do início da faixa 1:45–2:30 (ver tabela das jornadas). A primeira volta inclui a largada parada.

## Como reproduzir

```
npm ci
npm run verify
```

`npm ci` instala three.js, Playwright, pngjs e jpeg-js e baixa o Chromium do Playwright (`postinstall`). `npm run verify` sobe um servidor estático local, abre o jogo no Chromium (headless, GPU via ANGLE/D3D11) e grava tudo em `verification/` (~15 min). As montagens `compare/` precisam das imagens de referência fora do build: `REFS_DIR=<pasta com 01-…jpg …> npm run verify`.

Nos testes de jornada (1 e 2) o jogador usa piloto automático e a simulação roda a 4× (os mesmos passos fixos de 120 Hz, apenas mais passos por quadro). A volta gravada (vídeo + áudio) e a medição de desempenho rodam em tempo real.

## 13.1 Testes automatizados

| # | Teste | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | Jornada menu → garagem → configuração → 3 voltas com 5 IAs → resultados → correr de novo | PASSOU | jogador completou 3 voltas; 6 linhas na tabela de resultados; "Correr de novo" voltou à intro com 0 voltas |
| 2 | Mesma jornada com 6 voltas | PASSOU | jogador completou 6 voltas; 6 linhas; reinício limpo |
| 3 | Pausa/continuar, reiniciar no meio (3×), voltar ao menu | PASSOU | simulação congelada na pausa e abafada; vozes persistentes 24 → 24, 24, 24; heap JS 26.9 → 27.3 → 27.2 → 27.2 MB |
| 4 | Anticorte | PASSOU | salto de ~2,6 km à frente: 1 evento de corte, voltas = 0; a volta seguinte completa contou (104.4 s) |
| 5 | IA: nenhuma parada/fora da pista > 5 s; ≥ 1 ultrapassagem entre IAs | PASSOU | maior tempo parado 3.26 s; maior tempo fora 3.01 s (o reset de segurança age aos 3 s); 21 ultrapassagens entre IAs (testes 1 e 2) |
| 6 | Integridade | PASSOU | validateWorld: 0 erros, 5144 objetos; eventos abaixo do terreno / atravessou collider / caiu do mundo nas corridas 1 e 2: 0; câmera dentro da geometria: 0 |
| 7 | Sanidade de imagem S1–S9 | PASSOU | céu 14.1–41.6%; luminância média 0.343–0.589; desvio ≥ 0.189; maior cor única ≤ 11.3% (`image-metrics.json`) |
| 8 | Auditoria da cena | PASSOU | carros: gt:rosso 128820 tris/13 mat … (GT e hatch, 12 pinturas); 0 caixas, 0 materiais chapados, 0 texturas abaixo do mínimo; 88 casas, 6 variações, 7 espécies, mín. 16 props/100 m; motor com amostras (`scene-stats.json`) |
| 9 | Varredura a cada 25 m | PASSOU | 135 pontos, 0 falhas nas métricas do teste 7 (`sweep/`, `sweep-sheet.png`) |
| — | Console sem erros | PASSOU | 0 erros de console em toda a execução (`logs/console.log`) |

### Jornadas (resultados)

**3 voltas** — voltas do jogador (piloto automático Difícil): 1:56.380 / 1:45.670 / 1:43.770

| Pos | Piloto | Tempo total | Melhor volta |
| --- | --- | --- | --- |
| 1 | Você | 5:25.817 | 1:43.767 |
| 2 | R. Moreau | 5:34.108 | 1:49.333 |
| 3 | M. Okafor | 5:34.600 | 1:47.592 |
| 4 | T. Andrade | 5:35.533 | 1:46.842 |
| 5 | S. Lindqvist | ≈ 5:44.990 | 1:47.617 |
| 6 | L. Castellano | ≈ 6:06.369 | 1:48.500 |

**6 voltas** — voltas do jogador (piloto automático Difícil): 2:04.060 / 1:46.070 / 2:03.340 / 1:45.220 / 1:43.820 / 1:44.450

| Pos | Piloto | Tempo total | Melhor volta |
| --- | --- | --- | --- |
| 1 | R. Moreau | 11:01.483 | 1:49.325 |
| 2 | T. Andrade | 11:04.558 | 1:46.833 |
| 3 | M. Okafor | 11:05.375 | 1:45.617 |
| 4 | Você | 11:06.958 | 1:43.825 |
| 5 | S. Lindqvist | ≈ 11:49.016 | 1:47.617 |
| 6 | L. Castellano | ≈ 11:57.476 | 1:48.517 |

## 13.2 Áudio

Master gravado depois do limitador durante uma volta completa com as 5 IAs, câmera de perseguição, Alta, tempo real: `verification/audio-volta.wav` (121.1 s, 48000 Hz, estéreo, 16 bits). A mesma volta está em `verification/volta.webm` (55.7 MB, 121.3 s, video/webm;codecs=vp9,opus).

- **Pico máximo do master: -3.38 dBFS** no WAV (-3.38 dBFS no medidor do worklet). A curva final de saturação tem teto de 0,83 (−1,6 dBFS), então o pico não passa de −1 dBFS em nenhuma situação.
- **Máximo de vozes simultâneas:** 33 vozes lógicas (motor do jogador, até 5 motores de IA, 9 camadas de pneu/rolagem/raspão/vento, 9 ambiências e os efeitos pontuais), 77 nós de fonte do Web Audio (cada motor usa 4–7 fontes, uma por faixa de RPM).
- **Após 3 reinícios** (teste 3) as vozes persistentes voltam ao valor inicial: 24 → 24, 24, 24.
- **Início do áudio:** o `AudioContext` não existe antes da primeira interação (verificado: nenhum contexto antes do primeiro clique); é criado no primeiro clique/tecla. 0 erros de console em toda a execução.
- **Vídeo:** o jogo renderiza em Alta a 1920×1080; o gravador compõe a tela 3D + HUD num canvas de 1280×720 a 30 quadros/s (VP9 + Opus a partir do mesmo master do WAV).

| Evento | Instantes na gravação (mm:ss) |
| --- | --- |
| Passagem por uma IA | 00:00.0 (IA 3 passou), 00:00.0 (IA 2 passou), 00:03.1 (IA 4 ultrapassada), 00:04.5 (IA 4 passou), 00:07.3 (IA 4 ultrapassada), 00:09.3 (IA 5 ultrapassada), 00:11.6 (IA 3 ultrapassada), 01:05.2 (IA 4 passou) |
| Derrapagem (pneus cantando) | 00:03.8 (20 km/h), 00:14.3 (181 km/h), 00:18.8 (142 km/h), 00:59.0 (125 km/h), 00:59.9 (122 km/h), 01:00.3 (118 km/h), 01:00.9 (93 km/h), 01:03.3 (84 km/h), 01:04.6 (70 km/h), 01:11.0 (116 km/h) … (19 no total) |
| Troca de marcha | 00:05.4 (+2), 00:07.4 (+3), 00:09.5 (+4), 00:12.4 (+5), 00:21.3 (-4), 00:21.4 (-3), 00:22.3 (-2), 00:29.9 (+3), 00:34.9 (-2), 00:43.3 (+3) … (27 no total) |
| Colisão / contato | 00:13.2 (car 2.8 m/s), 00:16.3 (promenade 8.8 m/s), 00:16.5 (promenade 2.3 m/s), 00:18.5 (car 6.1 m/s), 00:56.8 (car 1.0 m/s), 01:00.2 (car 1.1 m/s), 01:00.5 (streetwall 4.8 m/s), 01:03.7 (streetwall 5.3 m/s), 01:03.9 (streetwall 1.3 m/s), 01:04.6 (car 6.6 m/s) … (18 no total) |
| Sinos da igreja | 00:40.0 (178 m), 01:00.1 (122 m) |
| Raspão em barreira | 01:00.5 (streetwall) |
| Ponte — entrada | 01:33.1 (s=2446) |
| Ponte — saída | 01:35.6 (s=2534) |

Os eventos são registrados pelo próprio motor de áudio no momento em que o som correspondente é disparado (o mm:ss é contado do início da gravação, que inclui a contagem 3-2-1).

## 13.3 Desempenho

Cenário: corrida real na Vila (Z3), 6 carros (jogador no piloto automático + 5 IAs), câmera de perseguição, 15 s de medição após 1 s de aquecimento, 1920×1080, vsync desligado. GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002482) Direct3D11 vs_5_0 ps_5_0, D3D11); CPU: AMD Ryzen 7 5700G with Radeon Graphics (16 threads); navegador: Chromium 156.0.8078.4 (Playwright, headless, ANGLE D3D11); Windows_NT 10.0.26300.

| Qualidade | FPS médio | 1% low | Quadros | Draw calls | Triângulos/quadro | Resolução interna |
| --- | --- | --- | --- | --- | --- | --- |
| Alta | 134.9 | 69.7 | 2040 | 506 | 2.28 M | 100% |
| Baixa | 157.5 | 88.8 | 2370 | 373 | 1.64 M | 72% |

O 1% low (média dos 1% piores quadros) mostra picos ocasionais — coleta de lixo do JavaScript e reconstrução periódica do conjunto de sombras da vegetação; o FPS varia alguns quadros entre execuções nesta máquina. Carregamento até "Pronto": 24.9 s nesta execução (o mundo inteiro é gerado no navegador a partir do `track.json`).

## 13.4 Screenshots — autoavaliação contra o veto (5.8) e contra as referências

Todas em `verification/screenshots/`, 1920×1080, Alta (S10 em Baixa), corrida real com 6 carros e HUD (S2 sem HUD, como pedido). As montagens lado a lado estão em `verification/compare/sN.png` (minha imagem primeiro, depois as referências indicadas, todas a 960×540).

### S1 — `s1-reta-orla` (compare: refs 01 e 02)
**Veto 5.8:** passa — carro apoiado no asfalto com sombra longa, céu do laranja ao azul com o sol baixo à frente, estrada com textura/marcas, mar com ondas, palmeiras de alturas diferentes, sombras nítidas do muro e dos postes.
**Diferenças concretas:**
1. Ref 01 tem poeira/névoa volumétrica iluminada e raios de sol; no meu S1 o ar é limpo (névoa só analítica, sem *god rays*).
2. Ref 01 mostra o carro grande no quadro, com contorno de luz (*rim light*) na pintura; o meu carro ocupa uma área pequena e o contraluz na carroceria é fraco.
3. Ref 01 tem palmeiras com motion blur forte; as minhas ficam nítidas (o blur de câmera é discreto).
4. Ref 02 tem praia curva e mar mudando de turquesa para azul profundo; no S1 o mar aparece só como faixa em contraluz, quase sem cor de profundidade.
**Abaixo do alvo:** encosta à direita é um talude de terra pouco variado.

### S2 — `s2-grid-3-4` (compare: ref 11)
**Veto:** passa — vidro transparente com reflexo e interior visível (não é preto chapado), rodas modeladas, sombra de contato, carro sem caixas.
**Diferenças concretas:**
1. Ref 11 tem *clearcoat* com reflexos nítidos do ambiente; minha pintura reflete o HDRI de forma mais difusa.
2. Ref 11 tem raios volumétricos entrando pelo galpão; aqui não há luz volumétrica.
3. As rodas da ref mostram disco/pinça e pneu com detalhe de lateral; nas minhas o disco quase não aparece neste ângulo e o pneu é liso.
4. A grade dianteira da minha carroceria tem bordas em degrau na entrada de ar (resolução da malha implícita).

### S3 — `s3-praia-espuma` (compare: refs 02 e 04)
**Veto:** passa — mar com ondas, linha de espuma na beira, espuma e borrifos nas rochas, céu visível.
**Diferenças concretas:**
1. Ref 04 tem água transparente correndo entre pedras com respingos grandes; os meus borrifos são pequenos e a água rasa é quase parada.
2. Ref 04 tem muitas pedras pequenas e seixos na margem; aqui há poucas rochas grandes e nenhum seixo.
3. As minhas rochas são variações de uma mesma forma deformada, com facetas visíveis.
4. Ref 02 tem areia com microrrelevo e marcas; minha areia molhada é lisa.

### S4 — `s4-falesia-mirante` (compare: ref 02)
Câmera alta sobre a serpentina da falésia: três grampos e os lances da subida com guard-rails, rochas e árvores nos taludes, a praia curva lá embaixo e o mar passando de turquesa (raso) a azul profundo até o horizonte com névoa; carros na subida. **Veto:** passa (céu, mar com cor de profundidade e ondas, sombras longas, sem cor chapada perto da pista).
**Diferenças concretas:**
1. Ref 02 tem um paredão de rocha esculpida em primeiro plano; minha falésia é feita de taludes de grama com rochas soltas, sem uma parede de rocha alta.
2. A praia da ref 02 é larga, com dunas e marcas de pneu; a minha é uma faixa estreita e, desta distância, os guarda-sóis mal aparecem.
3. Ref 02 tem o mar turquesa claro sob sol alto; o meu é mais escuro (sol baixo em contraluz) e a névoa do horizonte é mais cinza.
4. Ref 02 tem vegetação densa em primeiro plano (arbustos, cactos); meus taludes têm pinheiros e ciprestes esparsos sobre grama aberta.

### S5 — `s5-vila-rua` (compare: refs 05, 06 e 07)
Rua da vila com casas de 2–3 andares dos dois lados (janelas em recuo, venezianas, varandas com gradil, toldos, chaminés, telhados com beiral), frades e floreiras na calçada; a torre sineira da igreja aparece como marco acima dos telhados, no centro-esquerda do quadro. A posição do carro é escolhida pelo harness com um raio contra as malhas da vila, para a torre não ficar escondida atrás das casas nem sob o HUD. **Veto:** passa (casas não são cubos, céu visível, sombras das casas na rua).
**Diferenças concretas:**
1. Ref 05 tem densidade muito maior (pessoas, carroças, fios, vasos, carros parados); minha rua tem frades, postes, bancos e floreiras, mas é bem mais vazia.
2. Ref 06 tem pedra irregular e reboco manchado; minhas fachadas são limpas e uniformes, com textura de pedra repetida.
3. Ref 07 tem motion blur forte no fundo com o carro nítido; o meu blur é discreto.
4. Na ref 05 a igreja domina o quadro; aqui a torre é um marco pequeno e distante, e as fileiras de casas têm recuos e alturas regulares demais.

### S6 — `s6-bosque-luz` (compare: refs 08 e 10)
**Veto:** passa — árvores com tamanhos/proporções diferentes por instância, sombras, céu.
**Diferenças concretas:**
1. Refs 08/10 têm vegetação em camadas sem vazio; meu bosque tem chão aberto e encostas de terra entre os pinheiros.
2. Ref 10 tem raios de sol entre as árvores e névoa quente; aqui não há luz volumétrica.
3. As copas são cartões com alpha-test, visíveis como planos de perto.
4. Não há poeira levantada pelos carros na pista asfaltada (só fora dela).

### S7 — `s7-ponte-ou-tunel` (compare: ref 14)
**Veto:** passa — ponte apoiada no terreno das duas margens, céu e horizonte.
**Diferenças concretas:**
1. Ref 14 tem escala monumental e paisagem detalhada; minha ponte tem 3–4 arcos com textura de pedra repetida.
2. O riacho sob a ponte é uma faixa de água plana com bordas serrilhadas.
3. As encostas da ravina são lisas, sem rochas expostas.

### S8 — `s8-disputa` (compare: refs 09 e 13)
**Veto:** passa — 3 carros lado a lado + outros à frente, sombras, céu.
**Diferenças concretas:**
1. Refs 09/13 usam câmera baixa frontal com os carros grandes no quadro; o meu S8 é a câmera de perseguição atrás do jogador.
2. As refs têm motion blur forte no chão; aqui é discreto.
3. Ref 09 tem vegetação dos dois lados da curva; minha disputa é na reta da orla, com o mar à esquerda e o talude à direita.

### S9 — `s9-close-pista`
Close de asfalto, zebra e guard-rail. **Veto:** passa (asfalto com textura e normal map, zebra com desgaste, guard-rail metálico com postes). Abaixo do alvo: o guard-rail é um perfil extrudado simples e os postes são retos.

### S10 — `s10-baixa-vila`
Mesma posição do S5 em Baixa: mantém texturas e formas (casas, torre, frades, árvores); muda resolução interna (72%), sombras (2 cascatas, 1024², 260 m), distância de vegetação e pós (sem motion blur nem flare).

### S11 — `s11-escala`
Carro parado ao lado de uma casa com porta: a porta (~2,1 m) e as janelas dão a escala do carro (1,24–1,42 m de altura).

### S12 — `s12-mapa`
Vista de cima da volta inteira: orla, serpentina da falésia, vila, bosque e ponte. O mar ocupa uma área grande e escura — é mar, não superfície perto da pista.

## Limitações conhecidas (abaixo do alvo, além das diferenças por screenshot)

- Iluminação sem volumetria; reflexos só do HDRI (sem reflexos em tempo real do cenário na pintura e no vidro).
- Vegetação em cartões com alpha-test (bordas visíveis de perto, serrilhado nas palmeiras à distância); chão do bosque com vazios.
- Rochas são poucas variações de uma forma deformada; sem seixos.
- Casas limpas demais e fileiras regulares; riacho da ponte com bordas serrilhadas.
- Bordas em degrau nas entradas de ar dianteiras do GT (resolução de 3 cm da malha implícita da carroceria).
- Camada de alívio do motor derivada das mesmas gravações; IAs sem pneus cantando próprios; sem túnel/reverb.
- Alta medida numa RTX 3070 Ti, não numa RTX 3060; Baixa não medida em GPU integrada.
