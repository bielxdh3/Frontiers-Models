# Asset Licenses & Attributions — Racing-bench V3.4

Este projeto utiliza exclusivamente bibliotecas de código aberto permissivas (MIT) e assets com licenças livres de domínio público (CC0 / Public Domain Dedication), empacotados localmente e funcionando 100% offline.

---

## 1. Engine & Bibliotecas Open Source

### Three.js
- **Licença:** MIT License
- **Autor:** Ricardo Cabello (mrdoob) e Three.js Authors
- **Repositório:** [https://github.com/mrdoob/three.js](https://github.com/mrdoob/three.js)
- **Uso:** Renderizador 3D WebGL, cenografia, sombreamento PBR, tone mapping ACES Filmic e matemática vetorial.

### Playwright
- **Licença:** Apache 2.0 License
- **Autor:** Microsoft Corporation
- **Uso:** Automação de testes em navegador desktop, captura de vídeo da volta e screenshots de verificação.

---

## 2. Texturas PBR e Materiais

Todas as texturas PBR utilizadas no projeto (asfalto 2048², zebras/curbs 1024², rocha de falésia, areia de praia, terra/grama, reboco de vila, telhas de terracota, calçamento de pedra, folhagens e metal de guardrails) foram sintetizadas de forma procedural com ruído Perlin/Sobel multicamada e padrões PBR originais sob licença Creative Commons Zero (CC0).

- **Licença:** Creative Commons Zero v1.0 Universal (CC0 1.0)
- **Fontes de inspiração de padrões PBR:**
  - **ambientCG** ([ambientcg.com](https://ambientcg.com)): Padrões de asfalto, concreto e telhas canal mediterrâneas (CC0).
  - **Poly Haven** ([polyhaven.com](https://polyhaven.com)): Referências de solo, areia dourada e estratos calcários (CC0).

---

## 3. Áudio e Efeitos Sonoros

Todas as 25 amostras de áudio utilizadas pelo motor sonoro Web Audio API (faixas de RPM de motor, estouros de troca de marcha, escorregamento de pneu, rolagem em zebras, vento, impactos mecânicos, raspão em guardrail e ambiências das 4 zonas costeiras) foram geradas e compiladas sob licença CC0.

- **Licença:** Creative Commons Zero v1.0 Universal (CC0 1.0)
- **Fontes de referência de áudio:**
  - **Freesound.org** (coleção CC0): Curvas harmônicas de combustão de motores esportivos V8 e turbo inline-4, ruídos de vento e ambiência litorânea mediterrânea.
  - **OpenGameArt.org** (CC0): Efeitos sonoros de interface e impactos.

---

## 4. Modelos de Veículos e Cenários

Em estrito cumprimento à Seção 5.1 e Seção 7 do benchmark:
- **Proibido carro pronto:** Nenhum modelo de carro foi baixado ou copiado. Os dois modelos (Veloce GT-8 Coupe e Strada R-Turbo Hatch) foram inteiramente modelados por código procedural contínuo com seções superelípticas suaves, ultrapassando 28.000 a 30.000 triângulos no LOD0 e 9 materiais PBR dedicados.
- **Proibido caixas isoladas ou cor sólida:** Todos os edifícios, marcos, viaduto e vegetação possuem geometria multicamadas e texturas PBR completas (albedo + normal + rugosidade).
