# Costa Dourada — corrida ao pôr do sol

Jogo de corrida 3D para navegador (desktop): você contra 5 IAs num circuito costeiro mediterrâneo fictício de **3,37 km**, na hora dourada. Quatro zonas em sequência — **Orla** (reta da largada à beira-mar), **Falésia** (serpentina de 3 grampos subindo 48 m, mirante), **Vila** (rua de casas de 2–3 andares, igreja com torre de 30 m, praça) e **Bosque** (descida rápida entre pinheiros-mansos, ponte de pedra em arcos) — e volta à orla.

Feito com Three.js (r187, cópia local em `vendor/`), sem engine de jogo. Pista, terreno, carros, casas, vegetação, física, IA, áudio e interface são código próprio; os assets externos são CC0 (lista completa em [ASSET-LICENSES.md](ASSET-LICENSES.md)).

## Como rodar

Site estático, funciona offline. Qualquer servidor estático na raiz serve; o projeto traz um sem dependências:

```bash
npm ci
```

```bash
npm run serve
```

Depois abra `http://127.0.0.1:8173/` no Chrome/Edge (WebGL2). O áudio começa no primeiro clique ou tecla (regra de autoplay do navegador). Carregamento: ~15–30 s nesta máquina (o mundo inteiro é gerado a partir do `track.json` no navegador; a barra mostra o progresso real de cada etapa).

Parâmetros de URL úteis: `?quality=baixa` força a qualidade Baixa; `?test` liga os logs de validação no console.

## Controles

| Ação | Teclado | Controle (gamepad) |
| --- | --- | --- |
| Acelerar | W / ↑ | RT |
| Frear / ré | S / ↓ | LT |
| Esterçar | A D / ← → | analógico esquerdo |
| Freio de mão | Espaço | A |
| Câmera perseguição / capô | C | Y |
| Pausa | Esc / P | Start |
| Reposicionar o carro | R | Back |
| Menus | ↑ ↓ ← → Enter Esc | direcional, A, B |

## Fluxo

Menu (pista ao vivo ao fundo: 6 carros correndo com câmeras de transmissão) → Garagem (2 carros × 6 pinturas, carro girando sob o sol baixo) → Corrida (3 ou 6 voltas, Fácil/Normal/Difícil, qualidade Baixa/Alta) → apresentação do grid (~5 s) → 3-2-1 com as luzes do pórtico → corrida → resultados (IAs que não terminaram recebem tempo projetado com "≈") → Correr de novo / Menu. Pausa: continuar, reiniciar, configurações (qualidade, volumes geral/efeitos/música, controles), menu.

HUD: posição e classificação ao vivo, volta, tempo da volta e melhor volta, velocidade, marcha e conta-giros, minimapa.

## Verificação

```bash
npm run verify
```

Sobe o servidor, abre o jogo no Chromium do Playwright (headless, GPU via ANGLE/D3D11 no Windows) e grava tudo em `verification/`:

- testes 13.1 (jornadas de 3 e 6 voltas pela interface, pausa/reinício/menu com contagem de vozes e heap, anticorte, IA, integridade, sanidade de imagem, auditoria da cena, varredura a cada 25 m) → `results.json`, `logs/`;
- `screenshots/` S1–S12 (1920×1080, Alta, com HUD e IAs, FPS no nome), `image-metrics.json`, `scene-stats.json`, `sweep/` + `sweep-sheet.png`;
- `volta.webm` (uma volta completa em tempo real, câmera de perseguição, com IAs e áudio) e `audio-volta.wav` (master gravado depois do limitador);
- desempenho Alta/Baixa na Vila (Z3) com 5 IAs;
- `REPORT-dados.md`: tabelas com os números da execução (testes, eventos de áudio, FPS, métricas das screenshots), regeneradas a cada execução. O `REPORT.md` é a autoavaliação escrita à mão sobre esses números.

Se o Chromium do Playwright não estiver instalado, o `postinstall` (ou o próprio verificador) roda `npx playwright install chromium`. Para gerar `verification/compare/sN.png` (screenshot ao lado da referência), aponte `REFS_DIR` para a pasta das referências (fora do build); sem ela, essa etapa é pulada. `node tools/verify.mjs --only=shots,audit` roda só algumas etapas.

Nos testes de jornada o carro do jogador usa piloto automático e a simulação roda a 4× (mesmos passos fixos de 120 Hz). A volta do vídeo/áudio e a medição de desempenho rodam em tempo real.

## Hardware testado e desempenho

| | |
| --- | --- |
| CPU | AMD Ryzen 7 5700G (16 threads) |
| GPU | NVIDIA GeForce RTX 3070 Ti |
| Sistema | Windows 11 Pro |
| Navegador | Chromium (Playwright 1.64.1), headless, ANGLE D3D11, vsync desligado |
| Resolução | 1920×1080 |

| Qualidade | FPS médio | 1% low | Onde | Detalhes |
| --- | --- | --- | --- | --- |
| Alta | 134.9 | 69.7 | Vila (Z3), 6 carros, 15 s | resolução interna 100%, MSAA 4×, CSM 3×2048², motion blur, bloom, flare; 506 draw calls |
| Baixa | 157.5 | 88.8 | Vila (Z3), 6 carros, 15 s | resolução interna 72%, sem MSAA, CSM 2×1024², sem motion blur/flare, vegetação a 55% da distância; 373 draw calls |

Medido por `npm run verify` (Chromium 156.0.8078.4 (Playwright, headless, ANGLE D3D11), 1920x1080, GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002482) Direct3D11 vs_5_0 ps_5_0, D3D11)). Valores de uma execução; variam alguns FPS entre execuções nesta máquina.

## Estrutura

```
index.html, track.json        página e fonte única do mundo (spline fechada, larguras, inclinação, zonas, features)
src/world/    pista (spline/frames), terreno (heightfield conformado), estrada+collider, barreiras, checkpoints,
              dispersão (vegetação, props, rochas), vila (casas, igreja, praça), validateWorld()
src/car/      física (raycast + atrito por elipse, câmbio automático), desenho dos 2 carros, surface nets, modelo
src/ai/       linha de corrida (curvatura mínima + perfil de velocidade) e piloto (mesma física do jogador)
src/render/   renderer (CSM, HDRI, névoa, céu), materiais do mundo, mar, pós-processamento próprio, partículas
src/audio/    banco de sons, motor de áudio (buses, limitador, faixas de RPM, posicional + Doppler), gravador
src/ui/       fluxo de telas, HUD
src/race.js   regras da corrida      src/sim.js   passo fixo, invariantes, resets de segurança
src/testing/  harness usado pelo verificador (posições de câmera S1–S12, varredura, auditoria, captura)
tools/        verify.mjs, serve.mjs e ferramentas de autoria (make-track, engine-loops, pack-textures, …)
```

## Limitações conhecidas

- **Iluminação:** sem raios de sol volumétricos (*god rays*) nem névoa volumétrica; o contraluz das referências é aproximado por bloom, flare e névoa analítica. Exposição com adaptação parcial (trechos na sombra ficam mais claros, mas sem o *tone mapping* local de um jogo AAA).
- **Vegetação:** copas em "cartões" com alpha-test — de perto as bordas aparecem e as palmeiras ainda serrilham à distância; o chão do bosque tem vazios entre os troncos.
- **Água e rochas:** a espuma em volta das rochas é um anel procedural com borrifos pequenos de partículas — sem respingos grandes nem água correndo entre as pedras; as rochas são poucas variações de uma forma deformada, sem seixos.
- **Carroceria:** as entradas de ar dianteiras do GT têm bordas em degrau (resolução de 3 cm da malha implícita).
- **Vila:** fachadas limpas (sem manchas, fios, varais), fileiras de casas regulares demais.
- **Carros:** pintura com reflexo do HDRI, mas sem *clearcoat* de verdade nem reflexo em tempo real do cenário; vidros sem interior detalhado; sem dano.
- **Riacho sob a ponte:** traçado serrilhado e água plana.
- **Áudio:** a camada "aliviando" do motor é derivada das mesmas gravações (filtro + nível), não de gravações separadas de desaceleração. Não há túnel (o circuito tem ponte), então não há reverb de túnel.
- **Gamepad:** mapeamento padrão (layout "standard" do navegador); controles não são remapeáveis.
- **Baixa em GPU integrada:** medida nesta máquina na RTX 3070 Ti com o preset Baixa; não foi medida numa GPU integrada (a iGPU do Ryzen não está ativa neste computador).
