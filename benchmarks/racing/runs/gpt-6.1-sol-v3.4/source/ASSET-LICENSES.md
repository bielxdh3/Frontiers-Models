# Assets e licenças — Costa Dorada

Todos os arquivos usados pelo jogo estão em `public/assets/` e são copiados para `dist/assets/`. O jogo não consulta CDNs. Nenhum carro, cena ou código de jogo de terceiros foi usado.

| Arquivos locais | Origem e autoria | Licença | Uso / alteração |
| --- | --- | --- | --- |
| `sunset.hdr` | [Venice Sunset — Greg Zaal, Poly Haven](https://polyhaven.com/a/venice_sunset) | [CC0 — Poly Haven](https://polyhaven.com/license) | HDRI 1K, iluminação ambiente e reflexos. O céu visível é um shader original; a cidade fotografada não é reproduzida no cenário. |
| `engine-source.mp3` | [Car Starting and Accelerating — jackthemurray, Freesound #433584](https://freesound.org/people/jackthemurray/sounds/433584/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Preview HQ disponibilizado pelo autor no Freesound. Gravação de motor real. |
| `engine-0-0.wav` a `engine-1-3.wav` | Derivados da gravação anterior pelo script original `scripts/make-audio.mjs` | CC0 1.0 | Oito loops, quatro faixas por modelo. Recorte, normalização, filtragem e tratamento de timbre. As duas vozes têm a mesma gravação de origem. |
| `tires.mp3` | [R03-37-Old Auto Tire Skid Sequence — craigsmith, Freesound #481678](https://freesound.org/people/craigsmith/sounds/481678/) | CC0 1.0, indicada na página do arquivo | Preview HQ. Filtrado para rolamento e usado para derrapagem. |
| `collision.mp3` | [crashing.wav — smmassuda, Freesound #136629](https://freesound.org/people/smmassuda/sounds/136629/) | CC0 1.0, indicada na página do arquivo | Preview HQ. Recorte curto e ganho proporcional ao impacto. |
| `*-albedo.jpg`, `*-normal.png`, `*-roughness.jpg` | Texturas procedurais originais, `scripts/make-assets.mjs` | Criadas para este projeto | 2048² no asfalto; 1024² em areia, rocha, grama, reboco, telha, casca, pintura, metal, borracha, folhas e madeira. |
| Geometria de carros, casas, plantas, farol, ponte, props e pista | Código original em `src/` e dados em `track.json` | Criados para este projeto | Nenhum modelo pronto baixado. |
| Números dos carros, placas, bandeiras, tipografia da interface e símbolos | Canvas, SVG e CSS originais; fontes de sistema do navegador | Criados para este projeto | Não há logotipos ou marcas reais no cenário. Fontes não são redistribuídas. |
| Vento, ondas, pássaros/cigarras, sino e bipes de interface | Síntese original em `src/audio.js` | Criados para este projeto | Síntese utilizada na ambiência e na interface. Motor, pneus e colisões usam gravações. |

As licenças CC0 dos três sons foram conferidas nas páginas individuais antes do download. Não foi necessário login ou acesso a conta.

Bibliotecas de engine/ferramentas permitidas pelo enunciado: Three.js 0.180.0 (MIT), Vite 6.3.6 (MIT), Playwright 1.56.1 (Apache-2.0), Sharp 0.34.4 (Apache-2.0) e ffmpeg-static 5.3.0 (GPL-3.0-or-later; ferramenta de processamento, não incluída no build estático). O npm preserva as licenças em seus pacotes. Apenas Three.js e o código próprio entram no JavaScript do site.

As imagens comerciais de `benchmark/racing-v3.4/refs/` pertencem a seus titulares e são apenas referências fornecidas com o benchmark. Elas aparecem somente nas comparações solicitadas, fora de `dist/`; não são assets do jogo. Nenhum pixel dessas imagens foi usado na geração de textura, geometria, céu ou interface.
