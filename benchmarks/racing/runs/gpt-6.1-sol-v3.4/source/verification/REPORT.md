# Relatório — Costa Dorada

**NÃO APROVADO no alvo visual comercial da V3.4. O jogo e a verificação automatizada foram implementados, mas as comparações mostram uma linguagem procedural com acabamento abaixo das referências. Isso impede tratar a entrega como aprovação integral do benchmark.**

**Verificação automatizada: 22/22 testes. Nenhum teste automatizado falhou na execução final.**

Os critérios visuais comparativos não são demonstrados por contagens de triângulos ou métricas de imagem. P2–P4 não receberam aprovação independente de comparabilidade comercial. A construção prosseguiu até uma corrida funcional; portanto, a regra de somente avançar com portões visuais aprovados não foi plenamente satisfeita. Esta limitação faz parte do resultado, não é uma aprovação parcial do benchmark.

## Reprodução

`npm ci && npm run verify` gera build novo e substitui as evidências em verification/. As referências são lidas apenas do pacote em benchmark/racing-v3.4/refs/. O build não contém referências. A API de piloto e estações de teste exige ?verify=1. Screenshots S1–S9 vêm de estados produzidos pelo integrador da corrida; o script pausa para enquadrar a câmera, sem alterar posição dos carros. S11 aplica frenagem física até parar. A varredura, por definição, posiciona o grid em estações a cada 25m e não é evidência de dirigibilidade. As jornadas e o vídeo fornecem essa evidência separadamente.

## Integridade e cena

- Circuito: 2973.94 m. Inclinação máxima 13.59%; lateral 2.66°; raio mínimo 34.38 m.
- Intrusão de terreno: 0.00 m; maior diferença na borda 0.07 m.
- 52 casas, 6 variações e 4 espécies. Menor densidade: 14.88 props sem vegetação/100m.
- Carros: 115.334 triângulos / 19 materiais; 115.358 triângulos / 19 materiais; 115.334 triângulos / 19 materiais; 115.358 triângulos / 19 materiais; 115.334 triângulos / 19 materiais; 115.358 triângulos / 19 materiais. São contagens reais das malhas, sem alegar que essa contagem define qualidade visual.
- Jornada 3 voltas: 327.35 s; 0 eventos de integridade e 0 intrusões de câmera registradas.
- Jornada 6 voltas: 639.92 s; 0 eventos de integridade e 0 intrusões de câmera registradas.
- IA: 7 inversões de ordem entre adversários na jornada de três voltas, pela progressão real. Mesma física de 120 Hz para os seis veículos.

Os testes de colisão e contato usam a representação arcade de carro e superfícies do projeto; não representam uma simulação de suspensão independente ou validação de uma engine rígida completa. Não há salto planejado no traçado. O gamepad requer teste físico adicional se não estiver conectado.

## Desempenho medido

AMD Ryzen 7 5700G with Radeon Graphics; ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002482) Direct3D11 vs_5_0 ps_5_0, D3D11); 1920 × 1080 CSS pixels, DPR 1.

Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36

| Preset | FPS médio | 1% low | Amostras | Intervalo |
| --- | ---: | ---: | ---: | ---: |
| Alta | 99.89 | 88.67 | 900 | 9.01 s |
| Baixa | 99.23 | 56.18 | 900 | 9.07 s |

Medição na Z3 com cinco IAs visíveis. Não houve medição em RTX 3060 ou GPU integrada. O intervalo usa tempos reais de requestAnimationFrame, incluindo interrupções do navegador.

## Áudio e vídeo

- [Volta completa com áudio](volta.webm): 113.47 s de gravação em tempo real, sem aceleração da simulação.
- [Master PCM mono](audio-volta.wav): 48000 Hz, pico máximo -9.96 dBFS.
- Fontes máximas: 16; vozes posicionais de IA: 5, limitadas a cinco. Loops permanentes após reinício: 14.
- Troca de marcha: 0:01, 0:02, 0:04, 0:07, 0:22.
- Derrapagem: 0:18, 0:29, 0:30, 0:35, 0:35.
- Colisão: 0:25, 0:26, 0:27, 0:28, 0:28.
- Ponte: 1:34.
- Passagem por IA: 0:04, 0:17, 0:29, 0:40, 0:41.

Os instantes vêm dos eventos da gravação. A volta inclui uma intervenção de freio de mão e uma aproximação deliberada da barreira para tornar pneus e contato audíveis. A gravação usa um HUD de teste desenhado sobre o canvas com os mesmos dados da corrida; screenshots usam o HUD HTML do jogo. Os dois timbres de motor derivam de uma gravação real comum; a ambiência sintética da vila não contém conversa humana, e o resultado sonoro ainda é menos rico que o alvo.

## Comparação visual e veto

Cada comparação abre a imagem do jogo à esquerda e a referência à direita, em 960 × 540 cada. Havendo várias referências indicadas, os pares aparecem em linhas sucessivas. S10 usa S5/Alta à direita. S9 e S11–S12 não têm referência fornecida e repetem a imagem para conservar o formato; essa repetição não representa uma referência independente.

### S1 — s1-reta-orla-78fps.png

[Gameplay](s1-reta-orla-78fps.png) · [Comparação](compare/s1.png)

- As palmeiras têm folhas planas e coroas menos densas que a referência 01.
- A praia tem menos detritos, microvegetação e marcas de uso que a referência 02.
- A luz rasante produz sombras longas, mas não reproduz o recorte luminoso e a dispersão atmosférica da referência 01.

Métricas: céu 41.96%; luminância média 0.42, desvio 0.24, maior bin de cor 6.44%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S2 — s2-grid-3-4-77fps.png

[Gameplay](s2-grid-3-4-77fps.png) · [Comparação](compare/s2.png)

- A carroceria é curva e reflexiva, mas o para-choque e os recortes de farol são mais simples que na referência 11.
- As rodas têm raios, disco e pinça, porém faltam letras e microdetalhes laterais dos pneus da referência.
- O vidro reflete e deixa ver silhuetas internas, mas tem menos complexidade ótica e menos detalhes de vedação.

Métricas: céu 26.33%; luminância média 0.34, desvio 0.24, maior bin de cor 20.72%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S3 — s3-praia-espuma-94fps.png

[Gameplay](s3-praia-espuma-94fps.png) · [Comparação](compare/s3.png)

- A espuma forma faixas regulares, enquanto a referência 04 possui espuma quebrada e respingos ao redor de cada pedra.
- A água é menos transparente e a transição de profundidade é mais simples que nas referências 02 e 04.
- As rochas têm silhuetas menos orgânicas e há menos variação na areia molhada.
- A captura de praia não enquadra as IAs; isso deixa de cumprir a exigência de adversários visíveis nessa screenshot.

Métricas: céu 47.31%; luminância média 0.58, desvio 0.18, maior bin de cor 9.34%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S4 — s4-falesia-mirante-86fps.png

[Gameplay](s4-falesia-mirante-86fps.png) · [Comparação](compare/s4.png)

- O relevo é suave e tem menos estratificação de rocha exposta que a falésia da referência 02.
- A costa distante tem menos recortes, praia curva e detalhe de vegetação.
- As margens da serpentina têm menor variedade de material e formas que o alvo comercial.

Métricas: céu 37.25%; luminância média 0.43, desvio 0.27, maior bin de cor 6.99%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S5 — s5-vila-rua-88fps.png

[Gameplay](s5-vila-rua-88fps.png) · [Comparação](compare/s5.png)

- Há janelas recuadas, molduras, beirais e varandas, mas as fachadas têm menos desgaste e irregularidade que as referências 05–07.
- A rua tem menos elementos pequenos, cabos, vasos e vida de vila por quadro.
- O marco escolhido é um farol original; sua superfície é mais simples que a torre arquitetônica da referência 05.

Métricas: céu 33.25%; luminância média 0.36, desvio 0.23, maior bin de cor 10.30%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S6 — s6-bosque-luz-92fps.png

[Gameplay](s6-bosque-luz-92fps.png) · [Comparação](compare/s6.png)

- As copas mostram cartões geométricos e são menos volumosas que a vegetação da referência 08.
- Faltam as várias camadas de vegetação rasteira e ramos finos da referência.
- Há sombras rasantes, mas faltam os feixes volumétricos e a névoa quente entre árvores da referência 10.
- Os adversários estão fora do enquadramento legível nesta captura, apesar do estado de corrida conter as cinco IAs.

Métricas: céu 39.88%; luminância média 0.35, desvio 0.26, maior bin de cor 14.72%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S7 — s7-ponte-ou-tunel-90fps.png

[Gameplay](s7-ponte-ou-tunel-90fps.png) · [Comparação](compare/s7.png)

- A travessia é caracterizada por parapeitos, pilastras e encontros; não há um vão livre sob a estrada. O requisito de ponte estrutural não foi atendido.
- A alvenaria tem menos juntas e variação de desgaste.
- O vale e a paisagem em torno da ponte são mais simples e menos profundos que o alvo.
- Os adversários não são legíveis no quadro desta captura.

Métricas: céu 38.00%; luminância média 0.35, desvio 0.26, maior bin de cor 14.81%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S8 — s8-disputa-81fps.png

[Gameplay](s8-disputa-81fps.png) · [Comparação](compare/s8.png)

- O pelotão vem da simulação real, mas a câmera mais recuada enquadra duas filas em vez da composição baixa e comprimida da referência 13.
- As carrocerias refletem o céu, porém têm menos detalhes de painéis e aros que a referência.
- O blur do fundo é radial aproximado, sem o campo de movimento físico da referência 09.
- O jogador aparece adiante dos dois adversários em primeiro plano; a imagem não comprova o jogador lado a lado com duas IAs, como exigido para S8.

Métricas: céu 42.39%; luminância média 0.47, desvio 0.24, maior bin de cor 4.81%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S9 — s9-close-pista-86fps.png

[Gameplay](s9-close-pista-86fps.png) · [Comparação](compare/s9.png)

- Sem referência indicada: o asfalto tem mapas 2048², porém a distribuição de fissuras e remendos é simples.
- As zebras têm cor alternada e relevo discreto, mas pouca sujeira acumulada.
- O guardrail tem postes e seção arredondada; faltam parafusos e amassados.

Métricas: céu 41.12%; luminância média 0.38, desvio 0.26, maior bin de cor 13.04%. Dentro dos limites numéricos.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S10 — s10-baixa-vila-90fps.png

[Gameplay](s10-baixa-vila-90fps.png) · [Comparação](compare/s10.png)

- Sem referência externa: a comparação à direita é a posição S5 em Alta.
- Baixa preserva fachadas, texturas, rodas e folhagem, mas perde definição pela resolução interna menor.
- As sombras usam mapa 1024² e mostram bordas menos definidas que em Alta.

Não faz parte do conjunto S1–S9 de sanidade.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S11 — s11-escala-98fps.png

[Gameplay](s11-escala-98fps.png) · [Comparação](compare/s11.png)

- As casas em talude têm fundações altas e ainda faltam escadas de acesso às portas; o carro está parado e a porta tem 2,1 m no modelo.
- A porta e o carro ficam em profundidades diferentes; a perspectiva limita a comparação direta de alturas em pixels.
- A aproximação permite ver que reboco, porta e vegetação ainda têm menos detalhe de superfície que o alvo comercial.

Não faz parte do conjunto S1–S9 de sanidade.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

### S12 — s12-mapa-94fps.png

[Gameplay](s12-mapa-94fps.png) · [Comparação](compare/s12.png)

- A névoa distante reduz muito o contraste da pista na vista superior; o circuito completo é visível, mas pouco legível.
- O heightfield tem extensão retangular e não pretende representar um mundo aberto.
- A malha do mar mostra manchas triangulares junto à costa nesta vista; essa transição está abaixo do acabamento solicitado.

Não faz parte do conjunto S1–S9 de sanidade.

Veto: sem carro sob o chão, objeto na faixa de rodagem ou enquadramento fechado nesta captura. Permanecem limitações de acabamento e repetição de formas/material listadas acima; a imagem não é considerada equivalente ao alvo comercial.

## Falhas e limitações abertas

1. Acabamento visual inferior às referências em carroceria, folhagem, terreno, espuma e microdetalhes. A auditoria geométrica passar não elimina esse déficit.
2. A travessia decorativa não possui vão livre sob a estrada; o requisito de ponte estrutural permanece sem atendimento. Faltam feixes volumétricos no bosque. Blur aproximado, sem vetores de velocidade por objeto.
3. Ambiência sem vozes humanas na vila; os dois carros compartilham a gravação de origem dos motores. Há sons de gravação para motor, pneus e colisão; a síntese é restrita à ambiência/interface.
4. Preset Baixa foi medido na mesma GPU dedicada. A meta de GPU integrada permanece sem prova.
5. A rotina validateWorld é específica desta representação de mundo. Escala, raios, exclusões, bases, superfícies e sequência de checkpoints são verificadas, mas isso não certifica a qualidade artística.

A primeira execução teve seis estações do bosque abaixo de 0,25 de luminância; o ajuste de exposição motivou a segunda execução. A primeira evidência foi preservada em output/playwright/verification-first-run. Na inspeção seguinte foram ampliadas as verificações de apoio das casas no perímetro, densidade sem vegetação e malhas de baixa contagem. Fundações acompanham o terreno e a última execução usa essa auditoria mais rigorosa; a execução intermediária foi preservada em output/playwright/verification-second-run.
