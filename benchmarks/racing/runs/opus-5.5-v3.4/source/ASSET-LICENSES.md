# Licenças dos assets

Todo asset externo deste projeto é **CC0 1.0 (domínio público)** e está empacotado localmente (o jogo funciona offline). Nenhum carro pronto, cena, código de jogo de terceiros ou pixel das imagens de referência foi usado. Bibliotecas de engine estão listadas no fim.

Tudo o que não aparece abaixo é **trabalho próprio** gerado por código neste repositório: spline da pista (`track.json`, `tools/make-track.mjs`), terreno, estrada, barreiras, os dois carros (campo implícito → *surface nets* próprios, rodas modeladas, LODs), casas, igreja, ponte, vegetação, props, texturas procedurais (pintura/decalques dos carros, pneu, disco de freio, colmeia da grade, zebras, bandeiras, faixas, folhagens, persianas, toldos), todos os shaders (céu, névoa, mar, terreno, pós-processamento, partículas), a física, a IA, a interface e os **sons de interface** (síntese própria: navegação, confirmação, 3-2-1, bandeirada).

## HDRI (Poly Haven)

| Asset | Autores | Uso | Licença | Fonte |
| --- | --- | --- | --- | --- |
| Kloppenheim 06 (Pure Sky), 2K HDR — `assets/hdri/kloppenheim_06_puresky_2k.hdr` | Greg Zaal, Jarod Guest | luz ambiente (PMREM), reflexos, cor do sol; o céu visível é um shader próprio orientado pelo mesmo sol | CC0 1.0 | https://polyhaven.com/a/kloppenheim_06_puresky |

## Texturas PBR (ambientCG)

Cada material foi baixado do ambientCG e reempacotado por `tools/pack-textures.py` em `albedo.jpg` (sRGB), `normal.jpg` (convenção OpenGL) e `orm.jpg` (R = oclusão, G = rugosidade, B = metalicidade), em `assets/tex/<id>/`. Licença de todos: **CC0 1.0**. Página de cada um: `https://ambientcg.com/view?id=<id>`.

| ID | Resolução | Uso no jogo |
| --- | --- | --- |
| Asphalt025C | 2048² | asfalto da pista (camada principal) |
| Asphalt026C | 2048² | asfalto (segunda camada misturada por ruído, quebra a repetição) |
| Bark001 | 1024² | tronco das oliveiras |
| Bark012 | 1024² | tronco das palmeiras |
| Bark014 | 1024² | tronco dos pinheiros-mansos e ciprestes |
| Bricks089 | 1024² | pedra de muros, casas de pedra e igreja |
| Bricks100 | 1024² | pedra da ponte, parapeitos, borda da praça e do mirante |
| Concrete047A | 1024² | concreto do calçadão, guias e molduras |
| Fabric030 | 1024² | tecidos (bancos dos carros, guarda-sóis, toldos) |
| Grass004 | 1024² | camada de grama do terreno |
| Ground037 | 2048² | grama seca (camada do terreno) |
| Ground048 | 1024² | chão de bosque (terreno e acostamento da Z4) |
| Ground079S | 1024² | cascalho/terra dos acostamentos e da saia da estrada |
| Ground093C | 2048² | areia da praia (terreno e acostamento da orla) |
| Metal032 | 1024² | metais pintados e galvanizados (postes, guard-rail, pórtico, placas) |
| Metal049A | 1024² | cromados dos carros |
| PavingStones070 | 1024² | calçamento de pedra da praça e da rua da vila |
| PavingStones128 | 1024² | calçadas da vila |
| Planks037A | 1024² | tábuas (cercas de praia, bancos, mesas) |
| Plaster001 | 1024² | reboco das casas e muros rebocados |
| Rock030 | 1024² | rocha da falésia (segunda camada de rocha) |
| Rocks011 | 2048² | rocha do terreno e pedras do mar |
| RoofingTiles014A | 1024² | telhados |
| Rubber004 | 1024² | borracha (pneus, frisos) |
| Wood049 | 1024² | madeira (portas, persianas, beirais) |

## Sons (Freesound, somente CC0)

Baixados como *previews* HQ (`assets/audio/src/<id>.mp3`); `assets/audio/src/sources.json` guarda id, título, autor, URL e a confirmação CC0 de cada um. No carregamento cada som é decodificado, recortado, normalizado e — nos loops — fechado com *crossfade* de potência constante (`src/audio/bank.js`).

Os **loops de motor** (`assets/audio/engine/*.wav`, 6 faixas de RPM para o GT e 7 para o hatch) foram extraídos das gravações reais abaixo por `tools/engine-loops.mjs`: rastreamento da frequência de ignição, *time-warp* para altura constante, corte num número inteiro de ciclos e emenda sem clique. As gravações de origem ficam no repositório para que a extração seja reproduzível.

| ID | Título original | Autor | Uso | Licença | Fonte |
| --- | --- | --- | --- | --- | --- |
| 34180 | birds 1.wav | Dalibor | pássaros (Z4) | CC0 1.0 | https://freesound.org/people/Dalibor/sounds/34180/ |
| 71737 | Chrysler LHS tire squeal 02 (04-25-2009).wav | audible-edge | pneu cantando (camada B) | CC0 1.0 | https://freesound.org/people/audible-edge/sounds/71737/ |
| 71738 | Chrysler LHS tire squeal 03 (04-25-2009).wav | audible-edge | pneu cantando (camada A) | CC0 1.0 | https://freesound.org/people/audible-edge/sounds/71738/ |
| 105351 | BACKFIRE.ogg | CeebFrack | estouros ao aliviar | CC0 1.0 | https://freesound.org/people/CeebFrack/sounds/105351/ |
| 118243 | Column Gear Select Up (mono).wav | E-Audio | estalo da troca de marcha | CC0 1.0 | https://freesound.org/people/E-Audio/sounds/118243/ |
| 129344 | Outdoor crowd noise | Awesoman | vozes da vila (Z3) | CC0 1.0 | https://freesound.org/people/Awesoman/sounds/129344/ |
| 141240 | Renault 19 underhood acceleration | lovretta | motor hatch: faixas 800–4450 rpm (loops extraídos) | CC0 1.0 | https://freesound.org/people/lovretta/sounds/141240/ |
| 151624 | Clank Car Crash Collision | qubodup | batida leve / juntas da ponte | CC0 1.0 | https://freesound.org/people/qubodup/sounds/151624/ |
| 183654 | DynoJet Scion FR-S | dezoris | motor hatch: faixas 5300–7100 rpm (loops extraídos) | CC0 1.0 | https://freesound.org/people/dezoris/sounds/183654/ |
| 213665 | DynomometerPulls-1700HP-DR0000_0073-cutNamplified.mp3 | Ears68 | motor GT: faixas 3150–6900 rpm (loops extraídos) | CC0 1.0 | https://freesound.org/people/Ears68/sounds/213665/ |
| 237375 | Car Crash | squareal | colisão forte | CC0 1.0 | https://freesound.org/people/squareal/sounds/237375/ |
| 251662 | Tires on Gravel Road 2 | OBXJohn | rolagem em cascalho/areia/grama | CC0 1.0 | https://freesound.org/people/OBXJohn/sounds/251662/ |
| 272169 | Cicadas | dethrok | cigarras B (Z4) | CC0 1.0 | https://freesound.org/people/dethrok/sounds/272169/ |
| 341866 | ChurchBellKonstanz.wav | edschaefer | sinos da igreja (Z3, posicional) | CC0 1.0 | https://freesound.org/people/edschaefer/sounds/341866/ |
| 353416 | Seagull on beach | squashy555 | gaivotas (Z1) | CC0 1.0 | https://freesound.org/people/squashy555/sounds/353416/ |
| 376805 | Waves Up Close 3 | amholma | arrebentação próxima (Z1) | CC0 1.0 | https://freesound.org/people/amholma/sounds/376805/ |
| 398405 | Scrape | Caitlin_100 | raspão contínuo em barreira | CC0 1.0 | https://freesound.org/people/Caitlin_100/sounds/398405/ |
| 422048 | forest_cicada_loop.flac | Nimlos | cigarras A (Z4) | CC0 1.0 | https://freesound.org/people/Nimlos/sounds/422048/ |
| 530486 | Metal Impact | Rickplayer | impacto metálico | CC0 1.0 | https://freesound.org/people/Rickplayer/sounds/530486/ |
| 530699 | Water wave Beach Field-recording 200815_0036.wav | szegvari | ondas (Z1) | CC0 1.0 | https://freesound.org/people/szegvari/sounds/530699/ |
| 645305 | desert_wind.wav | DarkShroom | vento na falésia (Z2) | CC0 1.0 | https://freesound.org/people/DarkShroom/sounds/645305/ |
| 651533 | Airport Lounge | code_box | música dos resultados | CC0 1.0 | https://freesound.org/people/code_box/sounds/651533/ |
| 697217 | Looping Gentle Wind Ambience on an Open Desert Plain.wav | dhallcomposer | vento com a velocidade | CC0 1.0 | https://freesound.org/people/dhallcomposer/sounds/697217/ |
| 704972 | Lounge Piano Loop | NearTheAtmoshphere | música do menu | CC0 1.0 | https://freesound.org/people/NearTheAtmoshphere/sounds/704972/ |
| 712593 | Big Cam C6 Corvette | Angel_soto | motor GT: faixa de marcha lenta (loop extraído) | CC0 1.0 | https://freesound.org/people/Angel_soto/sounds/712593/ |
| 860717 | Interior sound of a moving car | artemditkovsky | rolagem no asfalto/zebra/ponte | CC0 1.0 | https://freesound.org/people/artemditkovsky/sounds/860717/ |

Os títulos de algumas gravações citam o veículo em que o som foi captado; isso é só a atribuição do arquivo de áudio. Os dois carros do jogo (Ponente GT e Maestrale R) são desenhos fictícios, sem marcas, logos ou formas de modelos reais.

## Bibliotecas

| Pacote | Versão | Licença | Uso |
| --- | --- | --- | --- |
| three.js (`vendor/three/`, cópia local + addons CSM, RoundedBoxGeometry, BufferGeometryUtils, HDRLoader, Pass/FullScreenQuad) | r187 / 0.187.0 | MIT | renderização WebGL2 |
| Playwright | 1.64.1 | Apache-2.0 | só no verificador (`npm run verify`) |
| pngjs | 7.0.0 | MIT | só no verificador (métricas e montagens de imagem) |
| jpeg-js | 0.4.4 | BSD-3-Clause | só no verificador (leitura das referências para `compare/`) |

As imagens de `refs/` (capturas de jogos comerciais) **não** fazem parte do build. Elas só são lidas pelo verificador, se presentes fora do projeto (variável `REFS_DIR` ou `../refs`), para montar `verification/compare/sN.png` lado a lado com as screenshots.
