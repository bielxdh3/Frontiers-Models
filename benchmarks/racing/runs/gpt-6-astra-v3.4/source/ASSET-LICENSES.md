# Assets e licenças

Todos os assets necessários ao jogo são empacotados localmente. O jogo não faz requisições a serviços externos.

## Poly Haven — CC0

| Arquivos locais | Fonte original | Resolução / uso |
| --- | --- | --- |
| `assets/sunset.hdr` | [Noordhoek Sunset 2](https://polyhaven.com/a/noordhoek_sunset_2), Dario Barresi | HDRI 2K, iluminação e reflexos |
| `assets/textures/asphalt-*` | [Asphalt 01](https://polyhaven.com/a/asphalt_01), Charlotte Baglioni / Dario Barresi | Albedo, normal OpenGL e roughness 2048 × 2048 |
| `assets/textures/stone-*` | [Rock 01](https://polyhaven.com/a/rock_01), colaboradores Poly Haven identificados na página | Albedo, normal e roughness 1024 × 1024; rochas e alvenaria |
| `assets/textures/sand-*` | [Coast Sand 01](https://polyhaven.com/a/coast_sand_01), colaboradores Poly Haven identificados na página | Albedo, normal e roughness 1024 × 1024 |
| `assets/textures/plaster-*` | [White Plaster 02](https://polyhaven.com/a/white_plaster_02), colaboradores Poly Haven identificados na página | Albedo, normal e roughness 1024 × 1024 |
| `assets/textures/earth-*` | [Sparse Grass](https://polyhaven.com/a/sparse_grass), Amal Kumar | Albedo, normal e roughness 1024 × 1024 |
| `assets/textures/bark-*` | [Bark Brown 01](https://polyhaven.com/a/bark_brown_01), Rob Tuytel | Albedo, normal e roughness 1024 × 1024 |

Licença: [CC0 da Poly Haven](https://polyhaven.com/license). Downloads obtidos da API pública da Poly Haven. Metadados preservados em `assets/hdri-source.json`, `assets/asphalt-source.json` e `assets/sources/`. Normais e roughness JPEG foram reencodados em PNG localmente; os mapas não foram copiados das referências do benchmark.

## Freesound — gravações CC0

São usados os previews públicos HQ MP3 disponibilizados pelo Freesound. Não houve acesso a downloads autenticados. URLs exatas e licenças verificadas estão em `assets/audio/sources.json` e `assets/audio/fx-sources.json`. Os buffers são decodificados, normalizados e recebem crossfade nas extremidades para formar loops. A síntese original fica restrita à ambiência e aos avisos de interface.

| Asset | Autor e fonte | Utilização |
| --- | --- | --- |
| `gt-idle.mp3` | GiocoSound — [401552](https://freesound.org/people/GiocoSound/sounds/401552/) | Motor real gravado externamente, marcha lenta |
| `gt-low.mp3` | GiocoSound — [401556](https://freesound.org/people/GiocoSound/sounds/401556/) | Rotação baixa |
| `gt-mid.mp3` | GiocoSound — [401555](https://freesound.org/people/GiocoSound/sounds/401555/) | Rotação média |
| `gt-high.mp3` | GiocoSound — [401551](https://freesound.org/people/GiocoSound/sounds/401551/) | Rotação alta |
| `hatch-idle.mp3` | GiocoSound — [401550](https://freesound.org/people/GiocoSound/sounds/401550/) | Motor real gravado internamente, marcha lenta |
| `hatch-low.mp3` | GiocoSound — [401548](https://freesound.org/people/GiocoSound/sounds/401548/) | Rotação baixa |
| `hatch-mid.mp3` | GiocoSound — [401547](https://freesound.org/people/GiocoSound/sounds/401547/) | Rotação média |
| `hatch-high.mp3` | GiocoSound — [401549](https://freesound.org/people/GiocoSound/sounds/401549/) | Rotação alta |
| `tires.mp3` | therisingorder — [Car peels off, 271337](https://freesound.org/people/therisingorder/sounds/271337/) | Pneus gravados, trecho em loop |
| `impact.mp3` | harrisonlace — [Metal Impact, 798843](https://freesound.org/people/harrisonlace/sounds/798843/) | Batidas gravadas em carroceria; recorte de um impacto |
| `gravel.mp3` | loganzsound — [Car Drives Over Gravel, 874835](https://freesound.org/people/loganzsound/sounds/874835/) | Rolagem, cascalho e transição da ponte |

Todos os itens da tabela declaram [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) nas páginas de origem. Os dois timbres usam perspectivas de gravação externa/interna do mesmo veículo real, com mixagem e afinação diferentes; não se afirma que sejam gravações dos carros fictícios apresentados no jogo. Nenhuma marca comercial aparece nas carrocerias.

## Assets originais deste projeto

Geometria dos dois carros, pista, terreno, edifícios, igreja, ponte, vegetação, props, céu, mar, partículas, decalques e interface foram criados neste projeto. Os mapas `rubber`, `metal`, `paint`, `leaf` e `tile` foram gerados por `scripts/textures.mjs` a 1024 × 1024. Números de corrida, placas, transparência da folhagem e sombras de contato usam canvases originais de 1024 px ou mais. Não foram usados carros prontos, cenas prontas, código de outros jogos ou geração delegada a agentes.

## Bibliotecas

| Dependência | Versão | Licença | Uso |
| --- | --- | --- | --- |
| Three.js | 0.180.0 | MIT | Engine, geometria, carregamento HDR e pós-processamento |
| Playwright | 1.56.1 | Apache-2.0 | Automação de navegador para verificação |
| Sharp | 0.35.5 | Apache-2.0 | Codificação de texturas, métricas e pranchas de comparação |

Versões transitivas estão fixadas em `package-lock.json`. A licença Three.js é incluída em `vendor/LICENSE.three`. Playwright e Sharp não fazem parte do build estático.

## Referências do benchmark

`benchmark/racing-v3.4/refs/` contém material fornecido pelo usuário. As imagens são utilizadas somente nas pranchas de comparação solicitadas, não como texturas, mapas, projeções ou geometria do jogo. Não são incluídas em `dist/`.

