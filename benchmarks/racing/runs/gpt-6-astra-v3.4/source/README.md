# SOLMARE · Coastline Racing

Jogo de corrida 3D para navegador desktop, implementado para Racing-bench V3.4. Circuito fictício Costa Solmare de 2,849 km, com orla, serpentinas, vila e bosque com ponte. Dois carros originais, seis pinturas, cinco adversários e corridas de três ou seis voltas.

## Executar

Requer Node.js 22 ou mais recente e um navegador com WebGL 2. A máquina de desenvolvimento usa Node 24.14.1.

```powershell
npm ci
npm start
```

Abra [http://127.0.0.1:4173](http://127.0.0.1:4173). O áudio é ativado pela primeira interação com a interface. Depois de instalar as dependências, o jogo não precisa de internet: HDRI, texturas, amostras e engine estão no projeto.

O build estático está em `dist/`. Para recriá-lo:

```powershell
npm run build
```

Sirva `dist/` com qualquer servidor HTTP estático. Abrir `index.html` diretamente por `file://` não é suportado por causa dos módulos ES e das regras de carregamento do navegador. O build tem aproximadamente 68 MiB; o tamanho exato está em `verification/build.json`.

## Controles

| Ação | Teclado | Controle padrão Web Gamepad |
| --- | --- | --- |
| Acelerar | W / seta para cima | RT |
| Frear | S / seta para baixo / espaço | LT |
| Esterçar | A e D / setas laterais | Analógico esquerdo |
| Alternar perseguição/capô | C | Y |
| Reposicionar | R | X |
| Pausa | Esc | Menu / Start |

O fluxo completo passa por menu, garagem, configuração, apresentação do grid por cinco segundos, contagem 3–2–1, corrida e resultados. A pausa permite continuar, reiniciar ou voltar ao menu. As configurações oferecem Alta/Baixa e volumes. Música é opcional no benchmark e não há trilha musical empacotada; o bus de música permanece silencioso.

## Verificação reproduzível

```powershell
npm ci
npm run verify
```

O comando abre uma instância isolada do Chromium, sobe um servidor local, executa os testes e grava os resultados em `verification/`. Se o Chromium da versão fixada do Playwright não estiver instalado, o verificador o instala; essa primeira preparação precisa de internet. Deixe a janela de teste aberta até o comando terminar. A execução normalmente leva alguns minutos, incluindo uma volta gravada em tempo real.

O verificador testa a jornada de três e seis voltas, teclado, câmera de capô, pausa, reinícios, estabilidade de heap e vozes, anticorte, ultrapassagens, integridade física, auditoria dos meshes e texturas, 12 capturas e uma varredura a cada 25 m. O piloto automático do jogador é utilizado somente pela automação. A gravação inclui uma entrada breve de esterço para exercitar contato físico e derrapagem; ela não injeta sons nem posições fictícias.

Arquivos principais:

- `verification/REPORT.md`: testes, hardware, áudio e diferenças visuais por imagem.
- `verification/results.json`: resultados estruturados com evidências de cada verificação.
- `verification/volta.webm`: uma volta completa em Alta, com adversários e áudio.
- `verification/audio-volta.wav`: master estéreo PCM da mesma gravação.
- `verification/scene-stats.json`: auditoria obtida do scene graph carregado.
- `verification/image-metrics.json` e `sweep-metrics.json`: métricas das capturas e da varredura.
- `verification/compare/` e `sweep-sheet.png`: comparações e folha de contato.
- `verification/performance.json` e `hardware.json`: medições e ambiente reais.

O parâmetro `--no-recording` existe somente para diagnóstico e resulta deliberadamente em falha no requisito de gravação. O comando normal sempre grava vídeo e áudio. `--headless` é opcional; a entrega foi testada com navegador visível.

## Implementação

`track.json` fornece a spline, largura, linha de largada, zonas e localização da ponte. `src/track.js` gera estrada, heightfield visual, consulta de altura e checkpoints. A mesma amostragem de terreno é usada para apoiar os objetos. A física opera em passos de 1/120 s para jogador e adversários. A posição final resulta do movimento; não há rubber-band, posição fabricada nem teleporte de IA durante uma corrida normal.

Os carros são meshes originais com carroceria curva, caixas de roda, vidro, rodas detalhadas e vários materiais PBR. A vila tem 38 casas em seis variantes. A vegetação usa palmeiras, pinheiros, oliveiras e arbustos. A renderização usa Three.js, HDRI CC0, ACES, sombras e pós-processamento discreto. Baixa conserva os modelos e texturas, reduzindo resolução interna, sombras, distância de vegetação e pós.

O áudio usa quatro bandas de amostras reais por timbre, com mistura contínua por RPM, mudanças de carga, fontes posicionais de IA e buses separados. O master passa por compressor e limitador. O áudio do vídeo vem do mesmo grafo enviado à saída, e o WAV é capturado depois do limitador.

## Hardware e limites conhecidos

Hardware disponível: NVIDIA GeForce RTX 3070 Ti, AMD Ryzen 7 5700G e Windows. Consulte os arquivos de desempenho para os números da execução entregue. Não houve medição física em RTX 3060 ou GPU integrada; o comportamento nesses dois alvos não é afirmado como comprovado. O suporte a controle usa o mapeamento padrão do navegador; não foi conectado um controle físico durante esta implementação.

Medição entregue em Chromium 141, 1920 × 1080, na vila com cinco IAs, durante aproximadamente seis segundos por preset:

| Preset | FPS médio | 1% low |
| --- | ---: | ---: |
| Alta | 55,48 | 28,92 |
| Baixa | 91,29 | 50,04 |

**O benchmark integral está reprovado.** A suíte executada passou em 33 de 34 verificações; o requisito de 60 FPS no preset Alto falhou. A volta gravada tem 125,28 s, uma volta concluída e nenhum evento de integridade de veículo ou câmera. O pico do master foi −5,179 dBFS. Os portões visuais P2–P4 também não foram demonstrados como aprovados antes do avanço. Esses limites estão declarados no topo do relatório.

O acabamento permanece abaixo das referências comerciais em complexidade das carrocerias, densidade/variação da vegetação, desgaste arquitetônico, turbulência da água e iluminação volumétrica. Os testes numéricos não substituem essa avaliação visual. `REPORT.md` registra três diferenças concretas por captura e distingue a situação do benchmark integral dos testes automáticos.

As licenças e fontes estão em `ASSET-LICENSES.md`. As referências fornecidas pelo usuário ficam fora do build e são usadas apenas nas pranchas comparativas.

O pacote `solmare-racing.zip` inclui código, build, referências para a verificação e somente as evidências atuais. `verification/delivery-manifest.json` registra SHA-256 e tamanho de cada arquivo empacotado; o checksum do ZIP está em `solmare-racing.zip.sha256`. Para recriar o pacote após uma verificação, execute `python scripts/package.py`.
