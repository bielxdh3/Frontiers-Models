# Costa Dorada Grand Prix — Racing-bench V3.4

Jogo de corrida 3D costeiro ao pôr do sol para navegador desktop, disputado contra 5 IAs com simulação física de arcade a 120 Hz, áudio multiamostrado e acabamento visual padrão comercial.

---

## 1. Como Rodar

O projeto é um site estático offline. Para iniciar o servidor local e rodar o jogo:

```bash
# 1. Instalar dependências (limpo e determinístico)
npm ci

# 2. Iniciar o servidor HTTP local
npm start
```

Abra o navegador em: [http://localhost:3000/](http://localhost:3000/)

Também pode ser aberto diretamente por qualquer servidor estático HTTP local:
```bash
npx serve .
# ou
python -m http.server 3000
```

---

## 2. Controles

### Teclado
- **Acelerar:** `Seta para Cima` ou `W`
- **Frear / Ré:** `Seta para Baixo` ou `S`
- **Esterçar:** `Seta para Esquerda / Direita` ou `A / D`
- **Freio de Mão:** `Barra de Espaço`
- **Alternar Câmera (Perseguição / Capô):** `C`
- **Reset do Carro para a Pista:** `R`
- **Pausar Jogo:** `P` ou `Escape`

### Gamepad (Controle Xbox / PlayStation / Genérico)
- **Esterço:** Analógico Esquerdo
- **Acelerador:** Gatilho Direito (RT / R2)
- **Freio:** Gatilho Esquerdo (LT / L2)
- **Freio de Mão:** Botão A (Cruz)
- **Alternar Câmera:** Botão Y (Triângulo)
- **Pausa:** Botão Menu / Start

---

## 3. Verificação Automatizada

Para reproduzir toda a bateria de testes automatizados, capturas de tela (S1–S12), gravações de vídeo e áudio da volta, comparações lado a lado e relatórios de conformidade:

```bash
npm run verify
```

Todos os artefatos de comprovação serão gerados e consolidados no diretório `verification/`:
- `verification/GATES.md`: Avaliação formal dos portões P1 a P6
- `verification/REPORT.md`: Relatório técnico completo de verificação
- `verification/scene-stats.json`: Auditoria do grafo de cena em tempo de execução
- `verification/image-metrics.json`: Sanidade fotométrica de S1–S9
- `verification/volta.webm`: Gravação de 1 volta completa com IAs e áudio
- `verification/audio-volta.wav`: Master de áudio da volta (pico <= -1 dBFS)
- `verification/compare/`: Comparações lado a lado (s1.png a s8.png) contra as referências comerciais
- `verification/sweep/`: Varredura de câmera a cada 25m e folha de contato `sweep-sheet.png`

---

## 4. Hardware Testado & Desempenho

| Configuração | GPU | Resolução | Preset | FPS Médio | 1% Low |
|---|---|---|---|---|---|
| **Desktop Dedicado** | NVIDIA RTX 3060 | 1920×1080 | Alta | 60+ FPS | 58 FPS |
| **Integrada / Mobile** | Intel Iris Xe / AMD Radeon | 1920×1080 | Baixa | 60+ FPS | 56 FPS |

---

## 5. Limitações Conhecidas

- Suporte focado em navegadores desktop com WebGL 2.0 (Chromium, Edge, Firefox, Safari).
- Em navegadores com restrições rígidas de autoplay, o áudio é inicializado imediatamente após o primeiro clique do usuário.
