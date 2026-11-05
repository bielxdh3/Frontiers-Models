# Costa Dorada — Golden Coast Racing

Jogo de corrida 3D para navegador desktop, criado para o pacote Racing-bench V3.4 fornecido nesta tarefa. Um circuito mediterrâneo fictício de 2.973,94 m, cinco adversários, três ou seis voltas, dois carros procedurais e seis pinturas. Site estático, sem serviços remotos.

## Rodar

Node.js 22.12 ou posterior e npm. Nesta máquina foi usado Node.js 24.14.1.

```sh
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173/`. O áudio é liberado na primeira interação. O menu leva à garagem e à configuração de corrida. O jogo pode usar teclado ou gamepad padrão.

```sh
npm run build
npm run preview
```

O build está em `dist/`, com `index.html` na raiz. Pode ser servido por qualquer servidor estático; todas as dependências visuais e sonoras ficam locais. A pasta de referências não entra no build.

## Controles

| Ação | Teclado | Gamepad padrão |
| --- | --- | --- |
| Acelerar | W / ↑ | RT |
| Frear | S / ↓ | LT |
| Esterçar | A / D ou ← / → | Analógico esquerdo |
| Freio de mão | Espaço | A |
| Perseguição / capô | C | Y |
| Reposicionar na pista | R | — |
| Pausar / continuar | Esc | Menu |

Mouse e teclado operam os menus. Controles de gamepad foram implementados via Gamepad API; a verificação registra a disponibilidade do dispositivo, sem afirmar teste físico quando não conectado.

## Verificação reproduzível

```sh
npm ci
npm run verify
```

O comando gera um build novo, sobe seu próprio servidor em `127.0.0.1:4178`, abre Chrome instalado ou usa Chromium do Playwright, executa as jornadas, grava uma volta em tempo real com áudio, captura screenshots e varre o circuito a cada 25 m. Se não houver Chrome nem Chromium, o comando tenta instalar o Chromium do Playwright. A primeira instalação das ferramentas depende de internet; o site final funciona sem acesso externo.

O processo leva alguns minutos porque a volta do vídeo não é acelerada. A janela do navegador pertence ao verificador. Não interaja com ela durante a medição. O processo retorna erro se um teste automatizado falhar e escreve o resultado em `verification/tests.json` e `verification/RUN.md`.

Leia `verification/REPORT.md` para a avaliação visual e as limitações. Os dados de hardware, FPS médio e 1% low medidos ficam em `verification/performance.json`. O hardware disponível nesta tarefa é Ryzen 7 5700G e GeForce RTX 3070 Ti. Não foram medidos uma RTX 3060 nem um notebook com GPU integrada; não extrapole os resultados para esses equipamentos.

## Arquitetura

`track.json` é a entrada geométrica única. `src/track.js` deriva a spline fechada, quadros da estrada, faixa de exclusão, checkpoints, altura do terreno e consulta de contato. O terreno visual e o contato vertical usam os mesmos triângulos do heightfield. Os props passam pela exclusão e por interseção vertical com esse heightfield. A geração usa semente fixa.

`src/physics.js` implementa o integrador de 120 Hz usado pelos seis veículos, contato com estrada, barreiras, carros, checkpoints e ordem de corrida. A IA controla acelerador, freio e esterço desse integrador. Os tempos projetados nos resultados são marcados com ≈. O piloto automático de teste e as estações de câmera existem somente com `?verify=1`; não são um modo extra do jogo.

Materiais PBR, HDRI, atmosfera, espuma e água ficam em `src/world.js` e `src/scenery.js`. Os modelos de carro e construções são gerados em `src/car.js` e `src/village.js`. Há bloom discreto e blur radial do cenário com máscara para o carro, no preset Alta. O preset Baixa reduz resolução interna e sombras, preservando modelos e texturas.

## Limitações conhecidas

A entrega possui uma linguagem visual procedural, mais simples que os jogos comerciais das referências. Em particular, folhagem, praia, falésia e detalhes de carro ainda não atingem o acabamento fotográfico solicitado. O blur do cenário é radial aproximado; a oclusão de contato dos carros usa sombras e um decalque de contato. A travessia usa parapeitos e encontros, porém não possui vão livre sob a estrada; o requisito de ponte estrutural não foi atendido. A ambiência da vila tem sino, mas não conversa humana gravada. As duas vozes de motor derivam de uma mesma gravação e não representam dois motores independentemente gravados. A avaliação completa e as diferenças concretas estão no relatório; aprovação numérica não equivale à aprovação visual do benchmark.

## Snapshot no GitHub

Esta versao do repositorio inclui o codigo-fonte, recursos de execucao, requisitos do Racing-bench V3.4, relatorios e evidencias finais (screenshots, metricas, audio e video). Para manter o repositorio utilizavel, nao inclui `node_modules/`, `dist/`, `output/`, capturas de varredura individuais ou imagens comparativas redundantes. Elas podem ser regeneradas pelo verificador.

**Referencias externas:** as imagens comerciais fornecidas em `benchmark/racing-v3.4/refs/` nao sao redistribuidas neste repositorio, por nao haver permissao de redistribuicao identificada. Para reproduzir a verificacao visual integral, obtenha o pacote de referencias por meio autorizado e restaure essa pasta localmente antes de executar `npm run verify`. As screenshots de gameplay e as metricas de desempenho publicadas correspondem a execucao local documentada em `verification/REPORT.md`.