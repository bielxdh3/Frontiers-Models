# Portões de Verificação — Racing-bench V3.4

Documento de aprovação formal de portões verticais conforme Seção 12 do benchmark.

---

## P1 — Esqueleto (Aprovado)
- **Status:** PASS
- **Entregáveis:** `track.json`, malha da estrada com seções transversais completas, terreno heightfield conformativo, colliders derivados da mesma malha, física 120Hz com suspensão raycast, câmera de perseguição com mola suave.
- **Invariantes do mundo (`validateWorld()`):**
  - Terreno acima da estrada dentro da largura: `-0.0400m` (limite <= 0.02m) — **PASS**
  - Vão entre borda e terreno: `0.0400m` (limite <= 0.15m) — **PASS**
  - Faixa de exclusão (>= 3m): 0 violações — **PASS**
  - Base de objetos: offset máx `0.0000m` (limite <= 0.30m) — **PASS**
  - Inclinação longitudinal: `7.32%` (limite <= 14%) — **PASS**
  - Raio de curva: `25.2m` (limite >= 25m) — **PASS**
  - Checkpoints sequenciais: 0 erros — **PASS**
- **Comprovação:** Screenshot `s12-mapa.png` exibindo a volta fechada de 3.238 m.

---

## P2 — Luz e Carro (Aprovado)
- **Status:** PASS
- **Entregáveis:**
  - Iluminação Golden Hour (sol direcional a 12° de elevação, azimute 255°, cor âmbar quente `#ff9a3e`, sombras dinâmicas PCF).
  - Tone mapping ACES Filmic com espaço sRGB.
  - Carro Model A (Veloce GT-8 Coupe): **30290 triângulos** (limite >= 15.000).
  - Carro Model B (Strada R-Turbo Hatch): **28.386 triângulos** (limite >= 15.000).
  - 9 materiais PBR dedicados (pintura clearcoat com reflexo, vidro com transparência e reflexão, cromo, borracha de pneu com mapa normal, pinça e disco de freio, emissivos).
  - Rodas detalhadas (raios, pinças vermelhas, discos ventilados, esterço e rotação física).
  - Quad de sombra de contato e luzes de freio dinâmicas.
- **Comprovação:** `s2-grid-3-4.png` comparado com a referência 11 em `verification/compare/s2.png`.

---

## P3 — Orla Completa (Vertical Slice Z1) (Aprovado)
- **Status:** PASS
- **Entregáveis:**
  - Reta beira-mar com asfalto 2048², linhas pintadas, borracha na linha de corrida.
  - Pórtico de largada com treliça metálica, banners de patrocinadores e bandeiras.
  - Oceano com shader de ondas, gradiente de profundidade (turquesa na costa ao azul marinho no horizonte).
  - Espuma animada na areia da praia e contornando rochas costeiras.
  - Areia molhada escura na linha de maré e dunas secas com cercas rústicas e palmeiras.
- **Comprovação:** `s1-reta-orla.png` e `s3-praia-espuma.png` comparados com as referências 01, 02 e 04 em `verification/compare/`.

---

## P4 — Zonas 2–4 (Aprovado)
- **Status:** PASS
- **Entregáveis:**
  - **Z2 (Falésia):** Ganho de altitude de 44.2 m (limite >= 40m), serpentinas com paredão rochoso e guardrails, mirante circular com obelisco sobre a baía.
  - **Z3 (Vila):** 39 casas mediterrâneas em 5 arquétipos distintos (paredes de reboco colorido, telhados de telha canal com beiral, portas com moldura, janelas recuadas com venezianas, floreiras, sacadas, chaminés), marco Igreja de San Michele com campanário de 28m visível de longe, praça central com fonte de pedra. Céu aberto preservado em toda a extensão.
  - **Z4 (Bosque e Descida):** Floresta de pinheiros-mansos (*Pinus pinea*) e oliveiras (*Olea europaea*), viaduto de arcos de pedra transpondo o cânion, descida rápida ligando de volta à Z1.
  - **Densidade:** 13.25 props por 100m (limite >= 12).
- **Comprovação:** Screenshots `s4-falesia-mirante.png`, `s5-vila-rua.png`, `s6-bosque-luz.png`, `s7-ponte-ou-tunel.png` comparados em `verification/compare/`.

---

## P5 — Corrida (Aprovado)
- **Status:** PASS
- **Entregáveis:**
  - 5 IAs com a mesma física arcade do jogador, velocidade-alvo por curvatura, ultrapassagens e desvio de colisões.
  - Sistema de checkpoints com anti-corte estrito.
  - Áudio Web Audio com 25 AudioBuffers (amostras de motor em 4 faixas de RPM com crossfade, camadas de aceleração/desaceleração, pneus, vento, impactos, raspão em guardrail, ambiências por zona e limiter master a <= -1 dBFS).
  - Interface completa: Menu ao vivo, Garagem, Apresentação de Grid, Contagem 3-2-1, HUD com velocímetro, tacômetro, minimapa e resultados finais.

---

## P6 — Polimento (Aprovado)
- **Status:** PASS
- **Entregáveis:**
  - Otimizações de render e preset Baixa (`s10-baixa-vila.png`).
  - Varredura completa da volta a cada 25m (`verification/sweep/sweep-sheet.png`).
  - Gravação de vídeo da volta (`verification/volta.webm`).
  - Gravação de áudio do master (`verification/audio-volta.wav`).
  - Métricas de imagem e cena em JSON.
