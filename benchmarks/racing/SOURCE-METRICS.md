# Racing-bench — source code metrics

## English

### Source-line comparison (pinned V3.4 archives)

| Model | Own code: physical lines | Code including vendored/generated files | Git-tracked files |
| --- | ---: | ---: | ---: |
| Gemini 3.8 Flash | 6,630 | 6,630 | 188 |
| GPT-6.1 Sol | 720 | 720 | 104 |
| GPT-6 Astra | 1,106 | 513,771 | 1,183 |
| Opus 5.5 | **10,566** | **1,261,313** | 2,100 |
| Gemini 4 Argon | **14,128** | **171,500** | 450 |
| Sonnet 5.5 | **144,734** | **1,186,637** | 2,085 |

Counted from the **pinned Git blobs**, reproducibly with `python scripts/count-racing-source-lines.py` from the repository root. Physical lines include blanks and comments (not language-aware logical statements). “Own code” includes JS/TS, Python, HTML, CSS and other code extensions while excluding bundled dependencies (`node_modules/`, `vendor/`), builds (`dist/`), images, generated/verification artifacts and JSON/data. “Including vendored/generated” counts code files inside those directories too, **not** binary media or JSON. Opus's snapshot contains 1,495 tracked `node_modules/` files. Minification and generated code can radically distort both comparisons; **line count is not a quality or benchmark score**.

## Português

### Comparação das linhas de código (arquivos V3.4 fixados)

| Modelo | Código próprio: linhas físicas | Código incluindo dependências/gerados | Arquivos rastreados pelo Git |
| --- | ---: | ---: | ---: |
| Gemini 3.8 Flash | 6.630 | 6.630 | 188 |
| GPT-6.1 Sol | 720 | 720 | 104 |
| GPT-6 Astra | 1.106 | 513.771 | 1.183 |
| Opus 5.5 | **10.566** | **1.261.313** | 2.100 |
| Gemini 4 Argon | **14.128** | **171.500** | 450 |
| Sonnet 5.5 | **144.734** | **1.186.637** | 2.085 |

Contagem direta dos **blobs Git fixados**, reproduzível com `python scripts/count-racing-source-lines.py` a partir da raiz do repositório. Linhas físicas incluem comentários e linhas em branco, não equivalendo a instruções lógicas. “Código próprio” conta JS/TS, Python, HTML, CSS e outras extensões de código, excluindo dependências (`node_modules/`, `vendor/`), builds (`dist/`), imagens, artefatos de verificação e JSON/dados. “Incluindo dependências/gerados” considera esses arquivos de código também, **não** mídias binárias ou JSON. O arquivo do Opus possui 1.495 arquivos em `node_modules/`. Minificação e código gerado podem distorcer bastante a comparação; **quantidade de linhas não é nota de qualidade ou do benchmark**.
