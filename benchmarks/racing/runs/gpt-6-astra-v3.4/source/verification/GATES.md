# Racing-bench V3.4 — registro dos portões

**Resultado integral: FAIL.** O jogo foi implementado até o fluxo completo de corrida e a geração de evidências, mas os portões visuais P2–P4 não foram comprovados antes do avanço. Isso também descumpre a ordem exigida pelo benchmark. O acabamento visual permanece abaixo do alvo em aspectos descritos por captura no `REPORT.md`. Aprovação numérica e implementação funcional não substituem esses requisitos.

## P1 — geometria

Foi executada a validação da spline, do heightfield e dos objetos, seguida de condução com a mesma física usada pelo jogador. As correções iniciais aumentaram o menor raio da curva, ajustaram a amostragem do terreno para 2 m e eliminaram terreno acima do asfalto.

Valores medidos: circuito de 2.849,275 m, menor raio de 25,509 m, inclinação máxima de 13,825% e maior diferença na borda de aproximadamente 0,099 m. `scene-stats.json` contém a validação completa atual. A vista superior S12 permite verificar o fechamento do circuito.

## P2 — luz e carros

As duas carrocerias foram reconstruídas com superfícies contínuas, arcos de roda abertos, cabine com vértices compartilhados, vidro, rodas, discos e pinças. A orientação das faces e as normais foram corrigidas após inspeção. Há HDRI local, sol, sombras, ACES, pintura com clearcoat e brake lights. O número é atualizado na textura original da carroceria.

A auditoria lê triângulos e materiais de cada carro diretamente da cena. S2 é a evidência visual atual. Persistem diferenças: a geometria da frente e das laterais é mais simples, os pneus têm menos microdetalhes e o interior/reflexo do vidro é menos rico que a referência 11. Esses pontos impedem afirmar equivalência artística com a referência.

## P3 — orla

Foram construídos o mar, a faixa de areia, a transição molhada, espuma na costa e nas rochas, palmeiras e mobiliário. O material de água recebeu ondas em múltiplas frequências e deformação espacial do padrão. O enquadramento de S3 foi corrigido para mostrar a margem, as rochas e a areia molhada. Texturas fotográficas CC0 substituíram mapas excessivamente uniformes de areia e asfalto.

S1 e S3 documentam a comparação. A espuma e as pequenas ondas ainda têm repetição mais perceptível que as referências, e a composição distante tem menos detalhes. Não se transforma a sanidade numérica da imagem em aprovação visual.

## P4 — falésia, vila, bosque e ponte

Foram adicionadas serpentinas com guardrails e zebras, 38 casas com seis variantes, igreja, pinheiros, oliveiras, arbustos e uma ponte com arcos e tirantes. Fundações usam a mesma consulta de altura do terreno. Casas têm portas e janelas recuadas, molduras, persianas, beirais e variações de sacada/toldo. A terraplenagem da vila foi ampliada para apoiar o marco sem uma fundação excessivamente alta.

S4–S7 e `scene-stats.json` registram o estado final. A validação não encontrou invasão da faixa de exclusão, sobreposição de casas ou bases flutuantes dentro de sua tolerância. As quatro espécies e a densidade por segmento são contadas a partir das instâncias reais no scene graph. Visualmente, árvores, rochas e fachadas continuam mais repetitivas que as referências.

## P5 — corrida, interface e áudio

O fluxo menu → garagem → configuração → grid → contagem → corrida → resultados está implementado. Cinco IAs usam a mesma classe de veículo e o mesmo passo de 1/120 s do jogador. O controlador foi corrigido para dirigir curvas por um cálculo de perseguição do ponto à frente, evitando os resets de segurança vistos na primeira versão. Os adversários escolhem linhas para ultrapassar sem alterar artificialmente o progresso.

Foram implementados checkpoints sequenciais, três/seis voltas, dificuldade, pausa, reinício, retorno ao menu, teclado, Gamepad API e duas câmeras. Os testes registram o progresso real, ultrapassagens, eventos de integridade e tempos. O teste de projeções foi corrigido: se todos os adversários já terminaram, nenhum tempo precisa de “≈”; quando ainda estão na pista, a marca é obrigatória.

O áudio usa oito gravações de motor CC0 em dois timbres de quatro bandas, pneus e impactos gravados, fontes posicionais, buses separados e limitador. Reiniciar encerra as vozes antigas antes de criar as novas. `restart-metrics.json` e `audio-metrics.json` são as evidências executadas.

A volta gravada revelou um defeito no impulso de colisão: o valor absoluto da projeção fazia uma batida traseira frear também o carro da frente. O sinal foi corrigido, com impulso igual e oposto projetado sobre cada direção. A reprodução antes da correção produzia um reset por parada; depois dela, o carro da frente recebeu velocidade de 15,60 m/s e o pelotão completou a volta sem reset. `scripts/physics-regression.mjs` reproduz os dois casos e grava `physics-regression.json`. A entrada de esterço da gravação usa o tempo da simulação, de 12,05 a 12,48 s, para não depender do tempo de resposta da automação.

## P6 — verificação e polimento

O verificador original de checkpoint foi substituído pela suíte completa. `npm run verify` gera as jornadas, auditoria, 12 capturas, comparações, 114 posições de câmera, desempenho e gravações. Uma falha real ou de infraestrutura retorna código diferente de zero. `--no-recording` é diagnóstico e não aprova a entrega.

Correções de desempenho agruparam materiais repetidos das fachadas e separaram instâncias em setores espaciais. A marcação do grid foi agrupada em uma única geometria de pintura após o detector estrito sinalizar seus pequenos meshes planos. O perfil na vila identificou aproximadamente 20,3 milhões de triângulos por quadro somando os passes. A redução das subdivisões nos chanfros de 22–25 mm de persianas, molduras e mobiliário preservou os volumes e reduziu essa contagem para cerca de 9,6 milhões no trecho medido. O preset Baixa mantém formas e mapas. Um fechamento externo do navegador interrompeu uma execução; isso foi registrado como falha de infraestrutura e a execução foi retomada.

Os resultados exatos da última execução estão em `results.json` e `REPORT.md`. A máquina disponível possui RTX 3070 Ti; não foi possível medir fisicamente os dois hardwares alvo indicados no benchmark. O relatório não atribui as medições desta GPU a uma RTX 3060 ou a uma integrada.
