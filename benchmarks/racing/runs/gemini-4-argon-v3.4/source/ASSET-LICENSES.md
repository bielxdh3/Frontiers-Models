# ASSET-LICENSES.md — Licenças de Assets e Bibliotecas

Todos os assets externos empacotados neste projeto são **CC0 1.0 Universal (Domínio Público)**, obtidos exclusivamente das fontes aprovadas na Seção 7 (Poly Haven e Freesound CC0) e empacotados localmente em `assets/`. Os modelos 3D dos 2 carros, construções da vila, igreja, vegetação, ponte e pista são gerados proceduralmente por código próprio do projeto. Nenhuma imagem de `refs/` é incluída ou amostrada no build.

---

## 1. Bibliotecas Open Source de Engine e Verificação

| Pacote | Licença | Uso |
| --- | --- | --- |
| `three` (Three.js, empacotado em `vendor/three/`) | MIT | Renderização WebGL2 PBR, sombras, pós-processamento e carregador HDR |
| `playwright` (devDependency) | Apache-2.0 | Verificação automatizada (`npm run verify`), captura de vídeo, áudio e screenshots |
| `sharp` (devDependency) | Apache-2.0 | Composição das comparações lado a lado (`verification/compare/`) e métricas de imagem |

---

## 2. HDRI de Iluminação e Céu (Poly Haven — CC0 1.0)

| ID | Arquivo Local | Autores | Fonte Oficial | Licença |
| --- | --- | --- | --- | --- |
| `evening_road_01_puresky` | `assets/hdri/evening_road_01_puresky_2k.hdr` | Sergej Majboroda, Jarod Guest | https://polyhaven.com/a/evening_road_01_puresky | CC0 1.0 Universal |

---

## 3. Conjuntos de Texturas PBR (Poly Haven — CC0 1.0)

Cada conjunto inclui mapas de Albedo (`_diff_`), Normal OpenGL (`_nor_`) e Roughness (`_rough_`):

| ID | Resolução | Arquivos Locais | Fonte Oficial | Licença |
| --- | --- | --- | --- | --- |
| `asphalt_02` | 2048×2048 | `assets/textures/asphalt_02_*_2k.jpg` | https://polyhaven.com/a/asphalt_02 | CC0 1.0 Universal |
| `asphalt_04` | 2048×2048 | `assets/textures/asphalt_04_*_2k.jpg` | https://polyhaven.com/a/asphalt_04 | CC0 1.0 Universal |
| `coast_sand_01` | 1024×1024 | `assets/textures/coast_sand_01_*_1k.jpg` | https://polyhaven.com/a/coast_sand_01 | CC0 1.0 Universal |
| `damp_beach_sand` | 1024×1024 | `assets/textures/damp_beach_sand_*_1k.jpg` | https://polyhaven.com/a/damp_beach_sand | CC0 1.0 Universal |
| `cliff_side` | 1024×1024 | `assets/textures/cliff_side_*_1k.jpg` | https://polyhaven.com/a/cliff_side | CC0 1.0 Universal |
| `aerial_grass_rock` | 1024×1024 | `assets/textures/aerial_grass_rock_*_1k.jpg` | https://polyhaven.com/a/aerial_grass_rock | CC0 1.0 Universal |
| `forest_ground_04` | 1024×1024 | `assets/textures/forest_ground_04_*_1k.jpg` | https://polyhaven.com/a/forest_ground_04 | CC0 1.0 Universal |
| `painted_plaster_wall` | 1024×1024 | `assets/textures/painted_plaster_wall_*_1k.jpg` | https://polyhaven.com/a/painted_plaster_wall | CC0 1.0 Universal |
| `clay_plaster` | 1024×1024 | `assets/textures/clay_plaster_*_1k.jpg` | https://polyhaven.com/a/clay_plaster | CC0 1.0 Universal |
| `cobblestone_01` | 1024×1024 | `assets/textures/cobblestone_01_*_1k.jpg` | https://polyhaven.com/a/cobblestone_01 | CC0 1.0 Universal |
| `clay_roof_tiles` | 1024×1024 | `assets/textures/clay_roof_tiles_*_1k.jpg` | https://polyhaven.com/a/clay_roof_tiles | CC0 1.0 Universal |
| `bark_brown_02` | 1024×1024 | `assets/textures/bark_brown_02_*_1k.jpg` | https://polyhaven.com/a/bark_brown_02 | CC0 1.0 Universal |
| `brushed_concrete_03` | 1024×1024 | `assets/textures/brushed_concrete_03_*_1k.jpg` | https://polyhaven.com/a/brushed_concrete_03 | CC0 1.0 Universal |

---

## 4. Amostras de Áudio Gravadas (Freesound — Filtrado para CC0 1.0) e Síntese de Ambiência/UI

As faixas de RPM em loop sem clique (`assets/audio/loops/*.wav`) dos motores dos 2 carros e os efeitos de mundo foram derivados das seguintes gravações reais sob licença **CC0 1.0 Universal** no Freesound, complementadas por síntese própria exclusivamente em camadas de ambiência e sons de UI conforme permitido na Seção 6:

| Freesound ID | Título Original | Arquivos Derivados em `assets/audio/loops/` | Fonte Oficial | Licença |
| --- | --- | --- | --- | --- |
| `369054` | `car_idle_ext_loop.wav` | `gt_rpm1_idle.wav`, `gt_rpm2_low.wav` | https://freesound.org/s/369054/ | CC0 1.0 Universal |
| `401551` | `SFX_Car_Engine_Outside_RPMHigh.wav` | `gt_rpm3_mid.wav`, `gt_rpm4_high.wav`, `gt_rpm5_max.wav`, `hatch_rpm4_high.wav`, `hatch_rpm5_max.wav` | https://freesound.org/s/401551/ | CC0 1.0 Universal |
| `113217` | `Porsche off growl.aif` | `gt_off_decel.wav`, `hatch_off_decel.wav` | https://freesound.org/s/113217/ | CC0 1.0 Universal |
| `748027` | `Sedan engine loop` | `hatch_rpm1_idle.wav`, `hatch_rpm2_low.wav` | https://freesound.org/s/748027/ | CC0 1.0 Universal |
| `141240` | `Renault 19 underhood acceleration` | `hatch_rpm3_mid.wav` | https://freesound.org/s/141240/ | CC0 1.0 Universal |
| `71739` | `Chrysler LHS tire squeal 04` | `tire_squeal_loop.wav` | https://freesound.org/s/71739/ | CC0 1.0 Universal |
| `151624` | `Clank Car Crash Collision` | `crash_impact.wav` | https://freesound.org/s/151624/ | CC0 1.0 Universal |
| `852826` | `Gentle Ocean Waves Loop` | `ocean_waves_loop.wav` | https://freesound.org/s/852826/ | CC0 1.0 Universal |
| `263786` | `Seagull single call` | `seagull_call.wav` | https://freesound.org/s/263786/ | CC0 1.0 Universal |
| `426642` | `church bell ringing field recording` | `church_bell.wav` | https://freesound.org/s/426642/ | CC0 1.0 Universal |
| Própria | Síntese procedural (apenas ambiência e UI, Seção 6) | `forest_cicadas_loop.wav`, `village_murmur_loop.wav`, sons de UI/vento/rolagem | Código próprio do projeto | CC0 / Próprio |
