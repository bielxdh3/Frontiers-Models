# Dados gerados por `npm run verify`

Gerado em 2026-11-05T22:18:29.205Z — AMD Ryzen 7 5700G with Radeon Graphics, Windows_NT 10.0.26300, Node v24.14.1.

## Resumo dos testes

| Teste | Resultado |
| --- | --- |
| 1_journey_3_laps | PASSOU |
| 2_journey_6_laps | PASSOU |
| 5_ai | PASSOU |
| 3_pause_restart_menu | PASSOU |
| 4_anticut | PASSOU |
| 6_integrity | PASSOU |
| 7_image_sanity | PASSOU |
| 8_scene_audit | PASSOU |
| 9_sweep | PASSOU |
| 13_2_audio | PASSOU |
| video_lap | PASSOU |
| 13_3_perf | PASSOU |
| console_no_errors | PASSOU |

Carregamento até "Pronto": 24895 ms.

| Fase | início (ms) |
| --- | --- |
| Lendo track.json | 1 |
| Gerando pista e terreno | 26 |
| Validando mundo | 2261 |
| Iluminação (HDRI) | 2398 |
| Texturas | 3375 |
| Sombras do terreno | 3411 |
| Cenário | 3493 |
| Carros | 5454 |
| Sons | 11691 |
| Compilando shaders | 11691 |
| Pronto | 11942 |

## Jornadas (testes 1 e 2)

**1_journey_3_laps** — 3 voltas, 96 s de relógio (simulação 4×), voltas do jogador: 116.38 / 105.67 / 103.77 s

| Pos | Piloto | Tempo | Melhor volta |
| --- | --- | --- | --- |
| 1 | Você | 325.817 s | 103.767 s |
| 2 | R. Moreau | 334.108 s | 109.333 s |
| 3 | M. Okafor | 334.600 s | 107.592 s |
| 4 | T. Andrade | 335.533 s | 106.842 s |
| 5 | S. Lindqvist | ≈ 344.990 s | 107.617 s |
| 6 | L. Castellano | ≈ 366.369 s | 108.500 s |

**2_journey_6_laps** — 6 voltas, 179 s de relógio (simulação 4×), voltas do jogador: 124.06 / 106.07 / 123.34 / 105.22 / 103.82 / 104.45 s

| Pos | Piloto | Tempo | Melhor volta |
| --- | --- | --- | --- |
| 1 | R. Moreau | 661.483 s | 109.325 s |
| 2 | T. Andrade | 664.558 s | 106.833 s |
| 3 | M. Okafor | 665.375 s | 105.617 s |
| 4 | Você | 666.958 s | 103.825 s |
| 5 | S. Lindqvist | ≈ 709.016 s | 107.617 s |
| 6 | L. Castellano | ≈ 717.476 s | 108.517 s |

## IA (teste 5)

Maior tempo parado: 3.26 s; maior tempo fora da pista: 3.01 s; ultrapassagens entre IAs: 21.

## Integridade (teste 6)

validateWorld: 0 erros (5144 objetos); eventos abaixo do terreno/atravessou collider/caiu do mundo: 0; câmera dentro de geometria: 0.

## 13.2 Áudio (uma volta com as IAs)

Duração gravada 121.1 s, 48000 Hz estéreo. Pico do master: **-3.38 dBFS** (WAV) / -3.38 dBFS (medidor pós-limitador). Máximo de vozes simultâneas: 33 lógicas (77 nós de fonte). Volta do vídeo: 116.53 s.

| Evento | Instantes (mm:ss) |
| --- | --- |
| passagem_ia | 00:00.0 (IA 3 passou), 00:00.0 (IA 2 passou), 00:03.1 (IA 4 ultrapassada), 00:04.5 (IA 4 passou), 00:07.3 (IA 4 ultrapassada), 00:09.3 (IA 5 ultrapassada), 00:11.6 (IA 3 ultrapassada), 01:05.2 (IA 4 passou) |
| derrapagem | 00:03.8 (20 km/h), 00:14.3 (181 km/h), 00:18.8 (142 km/h), 00:59.0 (125 km/h), 00:59.9 (122 km/h), 01:00.3 (118 km/h), 01:00.9 (93 km/h), 01:03.3 (84 km/h), 01:04.6 (70 km/h), 01:11.0 (116 km/h), 01:16.8 (107 km/h), 01:20.3 (100 km/h), 01:23.3 (110 km/h), 01:26.0 (126 km/h) … (+5) |
| troca_marcha | 00:05.4 (+2), 00:07.4 (+3), 00:09.5 (+4), 00:12.4 (+5), 00:21.3 (-4), 00:21.4 (-3), 00:22.3 (-2), 00:29.9 (+3), 00:34.9 (-2), 00:43.3 (+3), 00:47.8 (-2), 00:56.5 (+3), 00:59.9 (+4), 01:00.5 (-3) … (+13) |
| colisao | 00:13.2 (car 2.8 m/s), 00:16.3 (promenade 8.8 m/s), 00:16.5 (promenade 2.3 m/s), 00:18.5 (car 6.1 m/s), 00:56.8 (car 1.0 m/s), 01:00.2 (car 1.1 m/s), 01:00.5 (streetwall 4.8 m/s), 01:03.7 (streetwall 5.3 m/s), 01:03.9 (streetwall 1.3 m/s), 01:04.6 (car 6.6 m/s), 01:04.9 (car 1.7 m/s), 01:05.7 (car 2.3 m/s), 01:17.7 (guardrail 5.3 m/s), 01:18.2 (guardrail 2.5 m/s) … (+4) |
| sinos | 00:40.0 (178 m), 01:00.1 (122 m) |
| raspao | 01:00.5 (streetwall) |
| ponte_entrada | 01:33.1 (s=2446) |
| ponte_saida | 01:35.6 (s=2534) |

## Reinícios (teste 3)

Vozes persistentes no início: 24; após cada reinício: 24, 24, 24. Heap JS: 26.9 MB → 27.3 → 27.2 → 27.2 MB.

## 13.3 Desempenho (Vila/Z3, 5 IAs, 1920×1080)

GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002482) Direct3D11 vs_5_0 ps_5_0, D3D11). CPU: AMD Ryzen 7 5700G with Radeon Graphics (16 threads). Navegador: Chromium 156.0.8078.4 (Playwright, headless, ANGLE D3D11). Windows_NT 10.0.26300.

| Qualidade | FPS médio | 1% low | quadros | draw calls | triângulos | escala interna |
| --- | --- | --- | --- | --- | --- | --- |
| alta | 134.9 | 69.7 | 2040 | 506 | 2282725 | 1 |
| baixa | 157.5 | 88.8 | 2370 | 373 | 1638808 | 0.72 |

## 13.4 Screenshots

| # | Arquivo | FPS | Céu | Lum. média | Desvio | Maior cor única |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | s1-reta-orla-153fps.png | 152.6 | 32.4% | 0.4509 | 0.2636 | 6.1% |
| S2 | s2-grid-3-4-200fps.png | 199.9 | 14.1% | 0.3498 | 0.2097 | 5.8% |
| S3 | s3-praia-espuma-171fps.png | 170.8 | 35.2% | 0.5886 | 0.2016 | 9.9% |
| S4 | s4-falesia-mirante-147fps.png | 147.3 | 16.9% | 0.3685 | 0.1889 | 4.7% |
| S5 | s5-vila-rua-143fps.png | 142.9 | 15.2% | 0.3428 | 0.2255 | 11.3% |
| S6 | s6-bosque-luz-183fps.png | 183.2 | 26.8% | 0.3634 | 0.2481 | 6.0% |
| S7 | s7-ponte-ou-tunel-143fps.png | 143.1 | 41.6% | 0.4139 | 0.2231 | 8.0% |
| S8 | s8-disputa-157fps.png | 157.4 | 35.1% | 0.4495 | 0.2746 | 7.3% |
| S9 | s9-close-pista-152fps.png | 152.1 | 18.8% | 0.3538 | 0.2158 | 8.8% |
| S10 | s10-baixa-vila-173fps.png | 172.7 | — | — | — | — |
| S11 | s11-escala-139fps.png | 138.7 | — | — | — | — |
| S12 | s12-mapa-152fps.png | 152 | — | — | — | — |

## Varredura (teste 9)

135 pontos a cada 25 m; falhas: 0. Métricas por ponto em `sweep/sweep-metrics.json`.

