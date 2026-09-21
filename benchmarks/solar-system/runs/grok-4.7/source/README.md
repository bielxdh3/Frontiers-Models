# Observatório do Sistema Solar

Aplicação local no navegador. Não precisa de chave, conta ou servidor próprio.

```bash
npm install
npm test
npm run dev
```

Abra o endereço que o Vite mostrar. A data inicial é 1 jan 2026, 12:00 UTC. A velocidade padrão é 86 400×, um dia simulado por segundo real. 1× continua sendo tempo real.

## Notas de implementação

- Stack: Vite, JavaScript de módulos e Three.js r180. Um renderer, um ciclo de animação.
- Cores: texturas de cor em `SRGBColorSpace`, saída do renderer em sRGB, mapeamento ACES.
- Eixos: eclíptica J2000 com +Z para o norte vira +Y na cena. +Z da cena é o −Y eclíptico.
- Planetas: elementos Keplerianos de [JPL Approximate Positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html), Tabela 1 (1800–2050). Fora desse intervalo, e só depois de confirmação, a Tabela 2 vai até 3000 a.C.–3000 d.C.
- A Terra usa o baricentro Terra-Lua do ajuste e uma órbita circular média da Lua. Não é efeméride integrada.
- Luas, planetas anões, Vesta e o Cometa de aula usam órbitas educacionais. O cometa é hipotético.
- Escala de exploração comprime distâncias com logaritmo e aumenta raios. A escala relativa usa distâncias lineares (10 unidades por UA) e raios proporcionais. Medidas usam só coordenadas físicas.
- Relógio: um segundo de simulação por segundo real a 1×. Aba oculta não integra o intervalo, salvo a opção de recuperar no máximo 30 s.
- Texturas procedurais, sem imagens remotas, para a fotografia não depender de CORS.
- Contagens de luas consultadas na NASA Science em 2026-09-21: Júpiter 115, Saturno 293 e Urano 29 (agosto de 2026); Netuno 16; Marte 2; Terra 1; Plutão 5.
- Áudio, narração, gravação e tela cheia dependem do navegador e ficam desligados até um gesto.
- Dados locais em `localStorage`, chave `sso.observatory.v1`.
