# Costa Dourada — Jogo de Corrida 3D Mediterrâneo (Racing-bench V3.4)

Jogo de corrida arcade 3D completo em **WebGL 2.0 (`Three.js` empacotado localmente)** ambientado no fim de tarde dourado (*golden hour*) de uma costa mediterrânea fictícia (**Circuito Costa Dourada**, `3,02 km` / `3019,02 m`), funcionando **100% offline** em servidor estático local e com suíte completa de verificação reproduzível por um único comando (`npm run verify`).

---

## 1. Como Rodar Localmente (100% Offline)

### Pré-requisitos
- **Node.js 20+** (testado em Node `v24.14.1`)

### Instalação e Execução do Jogo
```bash
npm ci
npm start
```
Abra a URL exibida no terminal (por padrão `http://127.0.0.1:8080`) em qualquer navegador moderno com WebGL 2.0 (Chrome, Edge, Chromium ou Firefox).  
*(Alternativamente, qualquer servidor estático apontado para a raiz onde está `index.html` — ex.: `npx serve .` — funciona sem acesso à internet; `Three.js` e todos os assets CC0 estão empacotados em `vendor/` e `assets/`.)*

### Reprodução Completa da Verificação Obrigatória (`Seção 13`)
```bash
npm ci
npm run verify
```
O comando `npm run verify` (`scripts/verify.mjs`) sobe o servidor estático offline, abre o navegador automatizado em `1920×1080`, executa os **Testes 1 a 9**, mede desempenho em `Alta` e `Baixa` na `Z3`, captura as `12` screenshots obrigatórias (`S1–S12` + cópias `*-60fps.png`), gera as comparações lado a lado (`verification/compare/s1.png..s8.png`), executa a varredura de `121` quadros a cada `25 m` (`verification/sweep/` + `sweep-sheet.png`), grava **1 volta completa em tempo real** em vídeo (`verification/volta.webm`) e áudio master (`verification/audio-volta.wav`), e salva todos os relatórios JSON e logs em `verification/`.

---

## 2. Controles

### Teclado
| Tecla | Ação |
| --- | --- |
| `W` ou `↑` | Acelerar |
| `S` ou `↓` | Frear / Marcha à ré (quando parado) |
| `A` / `D` ou `←` / `→` | Esterçar à esquerda / direita |
| `Espaço` | Freio de mão (derrapagem controlável em grampos) |
| `C` | Alternar câmera (Perseguição ↔ Capô) |
| `R` | Reposicionar carro manualmente no centro da pista |
| `Esc` ou `P` | Pausar / Continuar corrida |

### Gamepad (Padrão XInput / DualShock / DualSense — API HTML5 Gamepad)
| Controle | Ação |
| --- | --- |
| Gatilho Direito (`RT` / `R2`) | Acelerar |
| Gatilho Esquerdo (`LT` / `L2`) | Frear / Ré |
| Analógico Esquerdo (`LX`) | Direção |
| Botão `A` / `Cross` (`B0`) | Freio de mão |
| Botão `Y` / `Triangle` (`B3`) | Alternar câmera |
| Botão `Select` / `Back` (`B8`) | Reposicionar carro |
| Botão `Start` / `Options` (`B9`) | Pausar / Continuar |

---

## 3. Arquitetura e Fonte Única do Mundo (`track.json`)

- **`track.json`**: Fonte única da verdade do circuito fechado de `3019,02 m` (`16` checkpoints em sequência, larguras, inclinações laterais *banking* até `6,13°`, rampas até `8,15%`, viaduto de `94 m` e metadados das 4 zonas: `Z1` Orla/Praia, `Z2` Falésia/Mirante com `42,6 m` de subida, `Z3` Vila Costeira e Igreja de São Lourenço, `Z4` Bosque de Pinheiros-Mansos/Oliveiras e Viaduto).
- **`src/world/`**:
  - `spline.js` & `terrain.js`: Reamostragem por comprimento de arco a cada `1,0 m`, malha contínua da estrada + zebras chanfradas + guardrails metálicos perfil `W` / muretas de pedra + terreno costeiro esculpido sobre a spline (`maxTerrainAboveRoadM = -0,0006 m`, `maxEdgeGapM = 0,1335 m`).
  - `ocean.js`: Mar Mediterrâneo animado multi-frequência até o horizonte, variação de cor por profundidade, areia molhada escura e espuma celular animada na praia e ao redor das rochas costeiras.
  - `village-and-landmarks.js` & `props-and-flora.js`: `128` casas mediterrâneas multi-andar em `6` variações arquitetônicas (com batching espacial por material para alto FPS), `Igreja de São Lourenço` com campanário, mirante na `Z2`, viaduto em pilares duplos sobre ravina seca de `17,51 m`, e `4` espécies de vegetação (`3.984` objetos apoiados por raycast no terreno).
  - `validateWorld.js`: Validador geométrico determinístico executado automaticamente na carga (`0` erros).
- **`src/vehicles/car-builder.js`**: Dois carros procedurais de superfície curva subdividida (`Solare GT` com `53.464` triângulos / `14` materiais PBR e `Vento RS` com `51.816` triângulos / `13` materiais PBR, ambos com `6` pinturas/números `#04, #11, #19, #27, #58, #84`).
- **`src/physics/`**: Física arcade com transferência de peso, rolagem/arfagem de carroceria, derrapagem controlável, sub-stepping fixo a `120 Hz`, colisões carro×carro e carro×barreira, e `5` IAs rodando exatamente na mesma física do jogador.
- **`src/audio/audio-engine.js`**: Áudio Web Audio API com **amostras reais gravadas CC0 em 5 faixas de RPM em loop** + camada de desaceleração, timbres distintos para os 2 carros, 5 motores 3D posicionais das IAs com atenuação e Doppler, rolagem diferenciada por superfície (asfalto, zebra, areia, grama e ponte de concreto), cantar de pneu, vento, colisões, ambiências por zona e *brickwall limiter* garantindo pico master `≤ -1 dBFS`.

---

## 4. Hardware Testado e Desempenho Medido (`verification/performance.json`)

- **GPU:** `NVIDIA GeForce RTX 3070 Ti` (WebGL 2.0 / ANGLE D3D11)
- **CPU:** `AMD Ryzen 7 5700G` (`16` threads, `31,9 GB` RAM, Windows 11 x64)
- **Navegador e Resolução:** `Chromium 156.0.8078.4` em **`1920×1080`**
- **Cenário medido (`Z3` Vila Costeira com 5 IAs visíveis em corrida):**
  - **Qualidade Alta:** **`60,0 FPS` médio** · **`59,5 FPS` 1% low**
  - **Qualidade Baixa:** **`60,0 FPS` médio** · **`59,5 FPS` 1% low** (reduz sombras para `1024²`, escala interna `0,78×`, distância de tufos secundários e desliga pós-processamento, mantendo todas as texturas PBR e formas 3D).
- **Pico de Áudio Master na Volta Completa (`audio-volta.wav`):** **`-4,35 dBFS`** (`13` vozes simultâneas máx.).

---

## 5. Limitações Conhecidas

1. **Dispersão atmosférica volumétrica (*god rays*):** A iluminação usa HDRI CC0 + sol direcional com sombras `4096²`, *tone mapping* `AgX`, *bloom*/*flare* discretos e névoa de distância (`> 190 m`), mas não implementa *raymarching* volumétrico de feixes de luz no ar entre os troncos da `Z1`/`Z4`.
2. **Cabine sem piloto articulado:** Os carros possuem vidros fumê reflexivos semitransparentes sobre interior escuro modelado (bancos esportivos, encostos, painel, volante e coluna central), porém sem boneco humano animado ao volante.
3. **Espuma marítima planar:** A espuma na praia e em torno das rochas costeiras é animada via shader sobre a superfície da água, sem emissores de partículas 3D de borrifos verticais de água nas pedras.
4. **Miolo central distante da ilha (`S12`):** A área interna do platô a mais de `120–250 m` da pista (fora do campo de visão das câmeras de corrida, visível apenas na vista aérea ortogonal `S12`) contém relevo natural aberto sem estradas rurais decorativas internas.

---

## 6. Licenças

Consulte [`ASSET-LICENSES.md`](./ASSET-LICENSES.md) para a lista completa de texturas PBR, HDRI (Poly Haven CC0), amostras de áudio gravadas (Freesound CC0) e bibliotecas open source utilizadas.
