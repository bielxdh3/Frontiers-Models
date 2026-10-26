import {
  ActiveTool,
  LocalizedText,
  ScaleMode,
  TimeBookmark,
} from '../types/solarSystem';
import { PRIMARY_SOURCES } from './sources';

export interface TourStop {
  id: string;
  targetId: string;
  title: LocalizedText;
  narrative: LocalizedText;
  cameraDistanceMultiplier: number;
  cameraElevationDeg: number;
  temporaryScaleMode?: ScaleMode;
  deeperActionLabel: LocalizedText;
  deeperTool?: ActiveTool;
  readingSeconds: number;
}

export interface GuidedTourSpec {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  goal: LocalizedText;
  durationEstimate: LocalizedText;
  stops: TourStop[];
}

export const GUIDED_TOURS: GuidedTourSpec[] = [
  {
    id: 'grand_tour',
    title: {
      'pt-BR': 'Grand Tour do Sistema Solar',
      en: 'Grand Tour of the Solar System',
    },
    subtitle: {
      'pt-BR': 'Do Sol aos gigantes de gelo e ao Cinturão de Kuiper',
      en: 'From the Sun to the ice giants and the Kuiper Belt',
    },
    goal: {
      'pt-BR': 'Compreender a arquitetura geral do Sistema Solar, da estrela central aos mundos rochosos, gigantes gasosos, gigantes de gelo e planetas anões.',
      en: 'Understand the overall architecture of the Solar System, from the central star through rocky worlds, gas giants, ice giants, and dwarf planets.',
    },
    durationEstimate: { 'pt-BR': '4–6 min', en: '4–6 min' },
    stops: [
      {
        id: 'gt_sun',
        targetId: 'sun',
        title: { 'pt-BR': '1. O Sol: Motor Gravitacional e Luminoso', en: '1. The Sun: Gravitational & Luminous Engine' },
        narrative: {
          'pt-BR': 'Nossa jornada começa no Sol, uma estrela anã amarela que concentra 99,86% de toda a massa do Sistema Solar. Toda a luz que ilumina os hemisférios diurnos dos planetas e luas parte de sua fotosfera a ~5.772 K.',
          en: 'Our journey begins at the Sun, a yellow dwarf star holding 99.86% of the Solar System’s mass. All sunlight illuminating planetary day hemispheres radiates from its ~5,772 K photosphere.',
        },
        cameraDistanceMultiplier: 3.4,
        cameraElevationDeg: 18,
        deeperActionLabel: { 'pt-BR': 'Abrir Laboratório de Escala', en: 'Open Scale Laboratory' },
        deeperTool: 'scale_lab',
        readingSeconds: 10,
      },
      {
        id: 'gt_mercury_venus',
        targetId: 'venus',
        title: { 'pt-BR': '2. Mercúrio e Vênus: Extremos Internos', en: '2. Mercury & Venus: Inner Extremes' },
        narrative: {
          'pt-BR': 'Mercúrio é um mundo sem atmosfera densa e com enormes variações térmicas, enquanto Vênus, coberto por espessas nuvens de ácido sulfúrico e CO₂, atinge ~737 K devido ao efeito estufa extremo.',
          en: 'Mercury lacks a dense atmosphere and experiences huge thermal swings, whereas Venus, shrouded in sulfuric acid clouds and CO₂, reaches ~737 K under a runaway greenhouse effect.',
        },
        cameraDistanceMultiplier: 3.8,
        cameraElevationDeg: 14,
        deeperActionLabel: { 'pt-BR': 'Comparar Terra e Vênus', en: 'Compare Earth & Venus' },
        deeperTool: 'comparison',
        readingSeconds: 10,
      },
      {
        id: 'gt_earth_moon',
        targetId: 'earth',
        title: { 'pt-BR': '3. Terra e Lua: Nosso Sistema Oceânico', en: '3. Earth & Moon: Our Ocean System' },
        narrative: {
          'pt-BR': 'A 1 Unidade Astronômica (~149,6 milhões de km) do Sol, a Terra mantém oceanos líquidos, continentes dinâmicos e uma grande lua em rotação síncrona que estabiliza sua inclinação axial de 23,44°.',
          en: 'At 1 Astronomical Unit (~149.6 million km) from the Sun, Earth sustains liquid oceans, dynamic continents, and a large tidally locked Moon that stabilizes its 23.44° axial tilt.',
        },
        cameraDistanceMultiplier: 3.6,
        cameraElevationDeg: 20,
        deeperActionLabel: { 'pt-BR': 'Explorar Estações da Terra', en: 'Explore Earth Seasons' },
        deeperTool: 'seasons_lab',
        readingSeconds: 11,
      },
      {
        id: 'gt_mars_belt',
        targetId: 'mars',
        title: { 'pt-BR': '4. Marte e a Fronteira do Cinturão Principal', en: '4. Mars & the Main Belt Frontier' },
        narrative: {
          'pt-BR': 'Marte marca a borda externa dos planetas telúricos, acompanhado por Fobos e Deimos. Além dele estende-se o Cinturão Principal de Asteroides, onde residem o planeta anão Ceres e o asteroide diferenciado Vesta.',
          en: 'Mars marks the outer edge of the terrestrial planets, accompanied by Phobos and Deimos. Beyond it lies the Main Asteroid Belt, home to dwarf planet Ceres and differentiated asteroid Vesta.',
        },
        cameraDistanceMultiplier: 3.8,
        cameraElevationDeg: 16,
        deeperActionLabel: { 'pt-BR': 'Ver Missões a Marte', en: 'View Mars Missions' },
        deeperTool: 'missions',
        readingSeconds: 10,
      },
      {
        id: 'gt_jupiter',
        targetId: 'jupiter',
        title: { 'pt-BR': '5. Júpiter: O Colosso Gasoso e as Luas Galileanas', en: '5. Jupiter: Gas Colossus & Galilean Moons' },
        narrative: {
          'pt-BR': 'Com 11 vezes o diâmetro da Terra e rotação de apenas 9h 55m, Júpiter comanda um verdadeiro mini-sistema solar com 95 luas conhecidas, lideradas por Io, Europa, Ganimedes e Calisto.',
          en: 'With 11 times Earth’s diameter and a 9h 55m rotation, Jupiter commands a miniature solar system of 95 known moons, led by Io, Europa, Ganymede, and Callisto.',
        },
        cameraDistanceMultiplier: 3.5,
        cameraElevationDeg: 22,
        deeperActionLabel: { 'pt-BR': 'Comparar Terra e Júpiter', en: 'Compare Earth & Jupiter' },
        deeperTool: 'comparison',
        readingSeconds: 11,
      },
      {
        id: 'gt_saturn',
        targetId: 'saturn',
        title: { 'pt-BR': '6. Saturno: Arquitetura dos Anéis e Titã', en: '6. Saturn: Ring Architecture & Titan' },
        narrative: {
          'pt-BR': 'Os anéis principais de Saturno acompanham sua inclinação equatorial de 26,73°. Em seu sistema orbitam Titã — com densa atmosfera alaranjada — e a lua criovulcânica Encélado.',
          en: 'Saturn’s main rings track its 26.73° equatorial tilt. Within its system orbit Titan — with its dense orange atmosphere — and cryovolcanic Enceladus.',
        },
        cameraDistanceMultiplier: 4.5,
        cameraElevationDeg: 26,
        deeperActionLabel: { 'pt-BR': 'Capturar Fotografia dos Anéis', en: 'Capture Ring Photograph' },
        deeperTool: 'photo_mode',
        readingSeconds: 11,
      },
      {
        id: 'gt_uranus',
        targetId: 'uranus',
        title: { 'pt-BR': '7. Urano: O Gigante de Gelo Inclinado a 97,8°', en: '7. Uranus: The 97.8° Tilted Ice Giant' },
        narrative: {
          'pt-BR': 'Urano gira quase paralelo ao plano de sua órbita (97,77°). Seus anéis estreitos e suas cinco grandes luas (Miranda, Ariel, Umbriel, Titânia e Oberon) acompanham esse equador inclinado.',
          en: 'Uranus rotates nearly on its side (97.77°). Its narrow rings and five major moons (Miranda, Ariel, Umbriel, Titania, and Oberon) follow that tilted equatorial plane.',
        },
        cameraDistanceMultiplier: 4.0,
        cameraElevationDeg: 20,
        deeperActionLabel: { 'pt-BR': 'Testar Inclinação Axial no Laboratório', en: 'Test Axial Tilt in Lab' },
        deeperTool: 'seasons_lab',
        readingSeconds: 10,
      },
      {
        id: 'gt_neptune_pluto',
        targetId: 'neptune',
        title: { 'pt-BR': '8. Netuno, Tritão e a Porta para o Cinturão de Kuiper', en: '8. Neptune, Triton & Gateway to the Kuiper Belt' },
        narrative: {
          'pt-BR': 'A 30 UA do Sol, Netuno é orbitado em sentido retrógrado por Tritão. Mais além estende-se o Cinturão de Kuiper, lar do par binário Plutão–Caronte e de outros planetas anões.',
          en: 'At 30 AU from the Sun, Neptune is orbited in a retrograde direction by Triton. Beyond it stretches the Kuiper Belt, home to the Pluto–Charon pair and other dwarf planets.',
        },
        cameraDistanceMultiplier: 3.9,
        cameraElevationDeg: 18,
        deeperActionLabel: { 'pt-BR': 'Explorar Jornada Além de Netuno', en: 'Explore Beyond Neptune Journey' },
        deeperTool: 'outer_system',
        readingSeconds: 11,
      },
    ],
  },
  {
    id: 'earth_and_moon',
    title: {
      'pt-BR': 'Terra e Lua: Fases, Marés e Eclipses',
      en: 'Earth & Moon: Phases, Tides & Eclipses',
    },
    subtitle: {
      'pt-BR': 'Como a geometria Sol–Terra–Lua molda nosso céu',
      en: 'How Sun–Earth–Moon geometry shapes our sky',
    },
    goal: {
      'pt-BR': 'Distinguir rotação diária da Terra, órbita lunar de 27,3 dias, fases lunares e a inclinação orbital de 5,14°.',
      en: 'Distinguish Earth’s daily spin, the Moon’s 27.3-day orbit, lunar phases, and the 5.14° orbital inclination.',
    },
    durationEstimate: { 'pt-BR': '3 min', en: '3 min' },
    stops: [
      {
        id: 'em_earth',
        targetId: 'earth',
        title: { 'pt-BR': '1. O Dia Terrestre e o Terminador Solar', en: '1. Earth’s Day & the Solar Terminator' },
        narrative: {
          'pt-BR': 'A Terra gira em 23h 56m (dia sideral), mas leva 24h para alinhar o mesmo meridiano ao Sol (dia solar). A linha entre o dia e a noite é o terminador.',
          en: 'Earth spins in 23h 56m (sidereal day) but takes 24h to align the same meridian with the Sun (solar day). The boundary between day and night is the terminator.',
        },
        cameraDistanceMultiplier: 3.2,
        cameraElevationDeg: 15,
        deeperActionLabel: { 'pt-BR': 'Abrir Laboratório das Estações', en: 'Open Seasons Laboratory' },
        deeperTool: 'seasons_lab',
        readingSeconds: 9,
      },
      {
        id: 'em_moon',
        targetId: 'moon',
        title: { 'pt-BR': '2. A Lua em Travamento de Maré', en: '2. The Tidally Locked Moon' },
        narrative: {
          'pt-BR': 'A Lua orbita a uma distância média de 384.400 km (cerca de 30 diâmetros terrestres). Como gira exatamente no mesmo período em que orbita (27,32 dias), mantém sempre o hemisfério dos mares voltado para a Terra.',
          en: 'The Moon orbits at a mean distance of 384,400 km (about 30 Earth diameters). Rotating in the exact same period as it orbits (27.32 days), it keeps the maria hemisphere facing Earth.',
        },
        cameraDistanceMultiplier: 4.0,
        cameraElevationDeg: 18,
        deeperActionLabel: { 'pt-BR': 'Abrir Laboratório de Fases e Eclipses', en: 'Open Phases & Eclipses Lab' },
        deeperTool: 'moon_lab',
        readingSeconds: 10,
      },
    ],
  },
  {
    id: 'giant_planets_moons',
    title: {
      'pt-BR': 'Gigantes e Suas Luas: Mundos Oceânicos e Vulcânicos',
      en: 'Giant Planets & Their Moons: Ocean & Volcanic Worlds',
    },
    subtitle: {
      'pt-BR': 'Io, Europa, Ganimedes, Titã, Encélado e Tritão',
      en: 'Io, Europa, Ganymede, Titan, Enceladus, and Triton',
    },
    goal: {
      'pt-BR': 'Descobrir por que as luas dos planetas gigantes estão entre os ambientes mais dinâmicos do Sistema Solar.',
      en: 'Discover why the moons of the giant planets are among the most dynamic environments in the Solar System.',
    },
    durationEstimate: { 'pt-BR': '4 min', en: '4 min' },
    stops: [
      {
        id: 'gm_io_europa',
        targetId: 'europa',
        title: { 'pt-BR': '1. Io e Europa: Fogo de Maré e Oceano Subglacial', en: '1. Io & Europa: Tidal Fire & Subglacial Ocean' },
        narrative: {
          'pt-BR': 'A ressonância orbital entre Io, Europa e Ganimedes mantém suas órbitas ligeiramente elípticas. O aquecimento de maré resultante alimenta os vulcões de Io e mantém um oceano global líquido sob o gelo de Europa.',
          en: 'Orbital resonance among Io, Europa, and Ganymede keeps their orbits slightly elliptical. Resulting tidal heating powers Io’s volcanoes and maintains a global liquid ocean beneath Europa’s ice.',
        },
        cameraDistanceMultiplier: 4.2,
        cameraElevationDeg: 18,
        deeperActionLabel: { 'pt-BR': 'Inspecionar Ganimedes e Calisto', en: 'Inspect Ganymede & Callisto' },
        readingSeconds: 10,
      },
      {
        id: 'gm_titan_enceladus',
        targetId: 'titan',
        title: { 'pt-BR': '2. Titã e Encélado em Saturno', en: '2. Titan & Enceladus at Saturn' },
        narrative: {
          'pt-BR': 'Titã possui uma atmosfera de nitrogênio mais densa que a da Terra e mares de metano líquido, enquanto a pequena Encélado ejeta plumas de vapor de água de seu polo sul.',
          en: 'Titan holds a nitrogen atmosphere denser than Earth’s and liquid methane seas, while small Enceladus vents water-vapor plumes from its south pole.',
        },
        cameraDistanceMultiplier: 4.0,
        cameraElevationDeg: 20,
        deeperActionLabel: { 'pt-BR': 'Ver Missão Cassini-Huygens', en: 'View Cassini-Huygens Mission' },
        deeperTool: 'missions',
        readingSeconds: 10,
      },
      {
        id: 'gm_triton',
        targetId: 'triton',
        title: { 'pt-BR': '3. Tritão: O Viajante Capturado de Netuno', en: '3. Triton: Neptune’s Captured Traveler' },
        narrative: {
          'pt-BR': 'Tritão orbita em sentido oposto à rotação de Netuno (inclinação de 156,9°), forte evidência de que era um objeto do Cinturão de Kuiper capturado gravitacionalmente.',
          en: 'Triton orbits opposite to Neptune’s spin (156.9° inclination), strong evidence that it was a Kuiper Belt object gravitationally captured by Neptune.',
        },
        cameraDistanceMultiplier: 4.2,
        cameraElevationDeg: 22,
        deeperActionLabel: { 'pt-BR': 'Comparar Tritão e Plutão', en: 'Compare Triton & Pluto' },
        deeperTool: 'comparison',
        readingSeconds: 10,
      },
    ],
  },
  {
    id: 'understanding_scale',
    title: {
      'pt-BR': 'Compreendendo a Escala Cósmica',
      en: 'Understanding Cosmic Scale',
    },
    subtitle: {
      'pt-BR': 'Por que todo mapa do Sistema Solar precisa escolher uma escala',
      en: 'Why every Solar System map must choose a scale compromise',
    },
    goal: {
      'pt-BR': 'Comparar a Escala de Exploração com a Escala Relativa e entender o imenso vazio interplanetário.',
      en: 'Compare Exploration Scale with Relative Scale and grasp the immense interplanetary emptiness.',
    },
    durationEstimate: { 'pt-BR': '3 min', en: '3 min' },
    stops: [
      {
        id: 'us_sun_earth',
        targetId: 'earth',
        title: { 'pt-BR': '1. 109 Terras cabem no diâmetro do Sol', en: '1. 109 Earths Fit Across the Sun’s Diameter' },
        narrative: {
          'pt-BR': 'O Sol tem 1.391.400 km de diâmetro, enquanto a Terra tem 12.742 km. Se o Sol fosse uma bola de praia de 1 metro, a Terra seria uma bolinha de gude de 9 milímetros situada a 107 metros de distância!',
          en: 'The Sun is 1,391,400 km across while Earth is 12,742 km. If the Sun were a 1-meter beach ball, Earth would be a 9-millimeter marble sitting 107 meters away!',
        },
        cameraDistanceMultiplier: 3.5,
        cameraElevationDeg: 20,
        deeperActionLabel: { 'pt-BR': 'Abrir Laboratório de Escala', en: 'Open Scale Laboratory' },
        deeperTool: 'scale_lab',
        readingSeconds: 10,
      },
      {
        id: 'us_neptune',
        targetId: 'neptune',
        title: { 'pt-BR': '2. 30 Unidades Astronômicas até Netuno', en: '2. 30 Astronomical Units to Neptune' },
        narrative: {
          'pt-BR': 'Na mesma escala em que a Terra fica a 107 metros do Sol de 1 metro, Netuno estaria a 3,2 quilômetros de distância. Por isso oferecemos a Escala de Exploração e o Laboratório de Escala Verdadeira.',
          en: 'On that same scale where Earth sits 107 meters from a 1-meter Sun, Neptune would lie 3.2 kilometers away. That is why we provide both Exploration Scale and the True Scale Laboratory.',
        },
        cameraDistanceMultiplier: 4.0,
        cameraElevationDeg: 18,
        deeperActionLabel: { 'pt-BR': 'Experimentar "Se a Terra Tivesse Este Tamanho"', en: 'Try "If Earth Were This Size"' },
        deeperTool: 'scale_lab',
        readingSeconds: 10,
      },
    ],
  },
  {
    id: 'light_across_system',
    title: {
      'pt-BR': 'A Velocidade da Luz pelo Sistema Solar',
      en: 'Light Across the Solar System',
    },
    subtitle: {
      'pt-BR': 'De 1,28 segundo até a Lua a mais de 4 horas até Netuno',
      en: 'From 1.28 seconds to the Moon to over 4 hours to Neptune',
    },
    goal: {
      'pt-BR': 'Explorar o tempo de viagem da luz (c = 299.792,458 km/s) e como ele limita a comunicação com espaçonaves.',
      en: 'Explore light-travel time (c = 299,792.458 km/s) and how it constrains spacecraft communication.',
    },
    durationEstimate: { 'pt-BR': '3 min', en: '3 min' },
    stops: [
      {
        id: 'lt_moon',
        targetId: 'moon',
        title: { 'pt-BR': '1. Terra–Lua: 1,28 Segundo-Luz', en: '1. Earth–Moon: 1.28 Light-Seconds' },
        narrative: {
          'pt-BR': 'A luz percorre os ~384.400 km entre a Terra e a Lua em apenas 1,28 segundo. Durante as missões Apollo, o pequeno atraso de ~2,5 segundos de ida e volta era perceptível em cada conversa de rádio.',
          en: 'Light covers the ~384,400 km between Earth and the Moon in just 1.28 seconds. During Apollo missions, the ~2.5-second round-trip delay was audible in every radio exchange.',
        },
        cameraDistanceMultiplier: 3.8,
        cameraElevationDeg: 16,
        deeperActionLabel: { 'pt-BR': 'Disparar Pulso de Luz na Régua', en: 'Fire Light Pulse in Ruler' },
        deeperTool: 'measurement',
        readingSeconds: 10,
      },
      {
        id: 'lt_mars_saturn',
        targetId: 'saturn',
        title: { 'pt-BR': '2. Comunicações Interplanetárias: Minutos a Horas', en: '2. Interplanetary Links: Minutes to Hours' },
        narrative: {
          'pt-BR': 'Um sinal de rádio da Terra até Marte leva entre ~3 e ~22 minutos dependendo do alinhamento orbital. Até Saturno, leva cerca de 1 hora e 20 minutos; até Netuno, mais de 4 horas apenas de ida!',
          en: 'A radio signal from Earth to Mars takes ~3 to ~22 minutes depending on orbital alignment. To Saturn it takes ~1 hour 20 minutes; to Neptune, over 4 hours one way!',
        },
        cameraDistanceMultiplier: 4.4,
        cameraElevationDeg: 24,
        deeperActionLabel: { 'pt-BR': 'Medir Distância e Tempo-Luz Agora', en: 'Measure Distance & Light-Time Now' },
        deeperTool: 'measurement',
        readingSeconds: 10,
      },
    ],
  },
  {
    id: 'follow_discoveries',
    title: {
      'pt-BR': 'Seguindo as Descobertas Espaciais',
      en: 'Follow the Discoveries',
    },
    subtitle: {
      'pt-BR': 'Cronologia das missões históricas da Lua ao Cinturão de Kuiper',
      en: 'Chronological story of historic spacecraft from the Moon to the Kuiper Belt',
    },
    goal: {
      'pt-BR': 'Visitar os mundos transformados pela exploração robótica e humana com fontes históricas verificadas.',
      en: 'Visit the worlds transformed by robotic and human exploration with verified historical sources.',
    },
    durationEstimate: { 'pt-BR': '4 min', en: '4 min' },
    stops: [
      {
        id: 'fd_apollo',
        targetId: 'moon',
        title: { 'pt-BR': '1969 — Apollo 11 na Lua', en: '1969 — Apollo 11 at the Moon' },
        narrative: {
          'pt-BR': 'Em 20 de julho de 1969, o módulo Eagle pousou no Mare Tranquillitatis, trazendo amostras lunares que calibraram a cronologia de crateras de todo o Sistema Solar.',
          en: 'On July 20, 1969, the Lunar Module Eagle landed in Mare Tranquillitatis, returning lunar samples that calibrated crater chronology across the Solar System.',
        },
        cameraDistanceMultiplier: 3.6,
        cameraElevationDeg: 18,
        deeperActionLabel: { 'pt-BR': 'Abrir Histórico de Missões', en: 'Open Mission History' },
        deeperTool: 'missions',
        readingSeconds: 10,
      },
      {
        id: 'fd_voyager',
        targetId: 'neptune',
        title: { 'pt-BR': '1977–1989 — O Grand Tour das Voyager 1 e 2', en: '1977–1989 — The Voyager 1 & 2 Grand Tour' },
        narrative: {
          'pt-BR': 'Aproveitando um raro alinhamento geométrico que ocorre a cada 176 anos, a Voyager 2 visitou Júpiter (1979), Saturno (1981), Urano (1986) e Netuno (1989).',
          en: 'Using a rare geometric alignment occurring once every 176 years, Voyager 2 visited Jupiter (1979), Saturn (1981), Uranus (1986), and Neptune (1989).',
        },
        cameraDistanceMultiplier: 3.9,
        cameraElevationDeg: 20,
        deeperActionLabel: { 'pt-BR': 'Ver Detalhes da Voyager 2', en: 'View Voyager 2 Details' },
        deeperTool: 'missions',
        readingSeconds: 10,
      },
      {
        id: 'fd_new_horizons',
        targetId: 'pluto',
        title: { 'pt-BR': '2015 — New Horizons em Plutão e Caronte', en: '2015 — New Horizons at Pluto & Charon' },
        narrative: {
          'pt-BR': 'Em julho de 2015, a sonda New Horizons revelou geleiras ativas de nitrogênio em Plutão e cânions profundos em Caronte, antes de prosseguir até Arrokoth no Cinturão de Kuiper.',
          en: 'In July 2015, New Horizons revealed active nitrogen glaciers on Pluto and deep canyons on Charon before continuing to Arrokoth in the Kuiper Belt.',
        },
        cameraDistanceMultiplier: 4.0,
        cameraElevationDeg: 22,
        deeperActionLabel: { 'pt-BR': 'Explorar Missões Espaciais', en: 'Explore Space Missions' },
        deeperTool: 'missions',
        readingSeconds: 10,
      },
    ],
  },
];

export interface MissionHistoryEntry {
  id: string;
  name: string;
  agency: string;
  targetIds: string[];
  era: 'pioneer_apollo' | 'grand_tour_era' | 'modern_orbiters' | 'contemporary';
  missionType: 'flyby' | 'orbiter' | 'lander_rover' | 'crewed';
  launchDate: string;
  arrivalOrEncounterDate: string;
  endDateOrStatus: LocalizedText;
  statusReferenceDate: string;
  historicalSimTimeMs: number;
  achievement: LocalizedText;
  routeNote: LocalizedText;
  sourceUrl: string;
}

export const SPACECRAFT_MISSIONS: MissionHistoryEntry[] = [
  {
    id: 'apollo_11',
    name: 'Apollo 11',
    agency: 'NASA',
    targetIds: ['moon', 'earth'],
    era: 'pioneer_apollo',
    missionType: 'crewed',
    launchDate: '1969-07-16',
    arrivalOrEncounterDate: '1969-07-20',
    endDateOrStatus: {
      'pt-BR': 'Concluída em 24 de julho de 1969 (retorno seguro à Terra)',
      en: 'Completed July 24, 1969 (safe return to Earth)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(1969, 6, 20, 20, 17, 0),
    achievement: {
      'pt-BR': 'Primeiro pouso tripulado na Lua (Mare Tranquillitatis), coletando 21,55 kg de amostras lunares e instalando retrorrefletores laser.',
      en: 'First crewed lunar landing (Mare Tranquillitatis), returning 21.55 kg of lunar samples and deploying laser retroreflectors.',
    },
    routeNote: {
      'pt-BR': 'Rota esquemática de transferência translunar Terra–Lua (não representa telemetria em tempo real).',
      en: 'Schematic translunar injection route between Earth and Moon (not live telemetry).',
    },
    sourceUrl: 'https://science.nasa.gov/mission/apollo-11/',
  },
  {
    id: 'voyager_1',
    name: 'Voyager 1',
    agency: 'NASA / JPL',
    targetIds: ['jupiter', 'saturn', 'titan'],
    era: 'grand_tour_era',
    missionType: 'flyby',
    launchDate: '1977-09-05',
    arrivalOrEncounterDate: '1979-03-05 (Júpiter) / 1980-11-12 (Saturno)',
    endDateOrStatus: {
      'pt-BR': 'Ativa na Missão Interestelar (>165 UA do Sol; status verificado até mar/2025)',
      en: 'Active in Interstellar Mission (>165 AU from Sun; verified as of Mar 2025)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(1980, 10, 12, 12, 0, 0),
    achievement: {
      'pt-BR': 'Descobriu o anel tênue de Júpiter, o vulcanismo ativo em Io e a densa atmosfera rica em nitrogênio de Titã; cruzou a heliopausa em 2012.',
      en: 'Discovered Jupiter’s faint ring, active volcanism on Io, and Titan’s thick nitrogen-rich atmosphere; crossed the heliopause in 2012.',
    },
    routeNote: {
      'pt-BR': 'Trajetória esquemática de assistência gravitacional Terra → Júpiter → Saturno.',
      en: 'Schematic gravity-assist trajectory Earth → Jupiter → Saturn.',
    },
    sourceUrl: 'https://science.nasa.gov/mission/voyager/voyager-1/',
  },
  {
    id: 'voyager_2',
    name: 'Voyager 2',
    agency: 'NASA / JPL',
    targetIds: ['jupiter', 'saturn', 'uranus', 'neptune', 'triton'],
    era: 'grand_tour_era',
    missionType: 'flyby',
    launchDate: '1977-08-20',
    arrivalOrEncounterDate: '1979 (Júpiter), 1981 (Saturno), 1986-01-24 (Urano), 1989-08-25 (Netuno)',
    endDateOrStatus: {
      'pt-BR': 'Ativa na Missão Interestelar (>138 UA do Sol; status verificado até mar/2025)',
      en: 'Active in Interstellar Mission (>138 AU from Sun; verified as of Mar 2025)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(1989, 7, 25, 4, 0, 0),
    achievement: {
      'pt-BR': 'A única espaçonave a visitar os quatro planetas gigantes (Júpiter, Saturno, Urano e Netuno), descobrindo novas luas e os gêiseres ativos de Tritão.',
      en: 'The only spacecraft to visit all four giant planets (Jupiter, Saturn, Uranus, and Neptune), discovering new moons and Triton’s active geysers.',
    },
    routeNote: {
      'pt-BR': 'Trajetória esquemática do Grand Tour (Terra → Júpiter → Saturno → Urano → Netuno).',
      en: 'Schematic Grand Tour trajectory (Earth → Jupiter → Saturn → Uranus → Neptune).',
    },
    sourceUrl: 'https://science.nasa.gov/mission/voyager/voyager-2/',
  },
  {
    id: 'cassini_huygens',
    name: 'Cassini–Huygens',
    agency: 'NASA / ESA / ASI',
    targetIds: ['saturn', 'titan', 'enceladus'],
    era: 'modern_orbiters',
    missionType: 'orbiter',
    launchDate: '1997-10-15',
    arrivalOrEncounterDate: '2004-07-01 (Órbita de Saturno) / 2005-01-14 (Pouso em Titã)',
    endDateOrStatus: {
      'pt-BR': 'Encerrada em 15 de setembro de 2017 (entrada planejada na atmosfera de Saturno)',
      en: 'Ended September 15, 2017 (planned disposal entry into Saturn’s atmosphere)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(2005, 0, 14, 12, 0, 0),
    achievement: {
      'pt-BR': 'Orbitou Saturno por 13 anos, pousou a sonda Huygens em Titã e descobriu as plumas hidrotermais subsuperficiais de Encélado.',
      en: 'Orbited Saturn for 13 years, landed the Huygens probe on Titan, and discovered Enceladus’s subsurface hydrothermal plumes.',
    },
    routeNote: {
      'pt-BR': 'Linha temporal e rota esquemática Terra → Saturno.',
      en: 'Timeline and schematic route Earth → Saturn.',
    },
    sourceUrl: 'https://science.nasa.gov/mission/cassini/',
  },
  {
    id: 'dawn_mission',
    name: 'Dawn',
    agency: 'NASA / JPL',
    targetIds: ['vesta', 'ceres', 'asteroid_belt'],
    era: 'modern_orbiters',
    missionType: 'orbiter',
    launchDate: '2007-09-27',
    arrivalOrEncounterDate: '2011-07-16 (Vesta) / 2015-03-06 (Ceres)',
    endDateOrStatus: {
      'pt-BR': 'Encerrada em 1 de novembro de 2018 (em órbita estável ao redor de Ceres)',
      en: 'Ended November 1, 2018 (in stable quarantine orbit around Ceres)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(2015, 2, 6, 12, 0, 0),
    achievement: {
      'pt-BR': 'Primeira missão a orbitar dois destinos extraterrestres distintos usando propulsão iônica: o protoplaneta Vesta e o planeta anão Ceres.',
      en: 'First spacecraft to orbit two extraterrestrial destinations using ion propulsion: protoplanet Vesta and dwarf planet Ceres.',
    },
    routeNote: {
      'pt-BR': 'Rota esquemática de propulsão iônica Terra → Marte → Vesta → Ceres.',
      en: 'Schematic ion-propulsion route Earth → Mars → Vesta → Ceres.',
    },
    sourceUrl: 'https://science.nasa.gov/mission/dawn/',
  },
  {
    id: 'new_horizons',
    name: 'New Horizons',
    agency: 'NASA / APL / SwRI',
    targetIds: ['pluto', 'charon', 'kuiper_belt'],
    era: 'contemporary',
    missionType: 'flyby',
    launchDate: '2006-01-19',
    arrivalOrEncounterDate: '2015-07-14 (Plutão–Caronte) / 2019-01-01 (Arrokoth)',
    endDateOrStatus: {
      'pt-BR': 'Ativa explorando o Cinturão de Kuiper externo (~60 UA; status verificado até mar/2025)',
      en: 'Active exploring the outer Kuiper Belt (~60 AU; verified as of Mar 2025)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(2015, 6, 14, 11, 49, 0),
    achievement: {
      'pt-BR': 'Realizou o primeiro reconhecimento de perto do sistema Plutão–Caronte e do objeto primordial Arrokoth no Cinturão de Kuiper.',
      en: 'Performed the first close reconnaissance of the Pluto–Charon system and primordial Kuiper Belt object Arrokoth.',
    },
    routeNote: {
      'pt-BR': 'Rota esquemática Terra → assistência em Júpiter (2007) → Plutão (2015).',
      en: 'Schematic route Earth → Jupiter gravity assist (2007) → Pluto (2015).',
    },
    sourceUrl: 'https://science.nasa.gov/mission/new-horizons/',
  },
  {
    id: 'mars_perseverance',
    name: 'Mars 2020 (Perseverance & Ingenuity)',
    agency: 'NASA / JPL',
    targetIds: ['mars'],
    era: 'contemporary',
    missionType: 'lander_rover',
    launchDate: '2020-07-30',
    arrivalOrEncounterDate: '2021-02-18 (Pouso na Cratera Jezero)',
    endDateOrStatus: {
      'pt-BR': 'Perseverance ativo na Cratera Jezero; helicóptero Ingenuity concluiu 72 voos em jan/2024 (ref. mar/2025)',
      en: 'Perseverance active in Jezero Crater; Ingenuity helicopter completed 72 flights in Jan 2024 (ref. Mar 2025)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(2021, 1, 18, 20, 55, 0),
    achievement: {
      'pt-BR': 'Explora um antigo delta fluvial marciano coletando testemunhos de rocha e demonstrou o primeiro voo motorizado controlado em outro planeta.',
      en: 'Explores an ancient Martian river delta caching rock cores and demonstrated the first powered controlled flight on another planet.',
    },
    routeNote: {
      'pt-BR': 'Transferência esquemática Terra → Marte (2020–2021).',
      en: 'Schematic transfer Earth → Mars (2020–2021).',
    },
    sourceUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
  {
    id: 'juno_jupiter',
    name: 'Juno',
    agency: 'NASA / JPL / SwRI',
    targetIds: ['jupiter', 'ganymede', 'europa', 'io'],
    era: 'contemporary',
    missionType: 'orbiter',
    launchDate: '2011-08-05',
    arrivalOrEncounterDate: '2016-07-04 (Inserção Orbital em Júpiter)',
    endDateOrStatus: {
      'pt-BR': 'Em missão estendida no sistema de Júpiter (status verificado até mar/2025)',
      en: 'In extended mission across the Jovian system (verified as of Mar 2025)',
    },
    statusReferenceDate: '2025-03-15',
    historicalSimTimeMs: Date.UTC(2016, 6, 5, 3, 53, 0),
    achievement: {
      'pt-BR': 'Sondou a estrutura profunda, gravidade e magnetosfera polar de Júpiter, realizando sobrevoos próximos de Ganimedes, Europa e Io.',
      en: 'Probed Jupiter’s deep interior, gravity field, and polar magnetosphere while performing close flybys of Ganymede, Europa, and Io.',
    },
    routeNote: {
      'pt-BR': 'Rota esquemática Terra → Júpiter em órbita polar.',
      en: 'Schematic route Earth → Jupiter polar orbit.',
    },
    sourceUrl: 'https://science.nasa.gov/mission/juno/',
  },
];

export interface LearningActivitySpec {
  id: string;
  theme: string;
  title: LocalizedText;
  objective: LocalizedText;
  startingBodyId: string;
  recommendedTool?: ActiveTool;
  promptQuestion: LocalizedText;
  hint: LocalizedText;
  options: Array<{
    id: string;
    label: LocalizedText;
    isCorrect: boolean;
  }>;
  sceneTaskDescription: LocalizedText;
  explanation: LocalizedText;
}

export const LEARNING_ACTIVITIES: LearningActivitySpec[] = [
  {
    id: 'act_planetary_order',
    theme: 'planetary_order',
    title: { 'pt-BR': '1. Ordem Heliocêntrica e a Linha de Geada', en: '1. Heliocentric Order & the Frost Line' },
    objective: {
      'pt-BR': 'Identificar a transição entre os quatro planetas rochosos internos e os quatro planetas gigantes externos.',
      en: 'Identify the transition between the four inner rocky planets and the four outer giant planets.',
    },
    startingBodyId: 'ceres',
    promptQuestion: {
      'pt-BR': 'Qual região e planeta anão separam a órbita do último planeta telúrico (Marte, ~1,52 UA) do primeiro gigante gasoso (Júpiter, ~5,20 UA)?',
      en: 'Which region and dwarf planet lie between the outermost terrestrial planet (Mars, ~1.52 AU) and the first gas giant (Jupiter, ~5.20 AU)?',
    },
    hint: {
      'pt-BR': 'Inspecione a região em torno de 2,77 UA entre Marte e Júpiter.',
      en: 'Inspect the region around 2.77 AU between Mars and Jupiter.',
    },
    options: [
      {
        id: 'opt_ceres_main_belt',
        label: { 'pt-BR': 'O Cinturão Principal de Asteroides e o planeta anão Ceres (~2,77 UA)', en: 'The Main Asteroid Belt and dwarf planet Ceres (~2.77 AU)' },
        isCorrect: true,
      },
      {
        id: 'opt_kuiper_pluto',
        label: { 'pt-BR': 'O Cinturão de Kuiper e Plutão (~39,5 UA)', en: 'The Kuiper Belt and Pluto (~39.5 AU)' },
        isCorrect: false,
      },
      {
        id: 'opt_oort',
        label: { 'pt-BR': 'A Nuvem de Oort (>2.000 UA)', en: 'The Oort Cloud (>2,000 AU)' },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Selecione Ceres na cena ou no navegador para verificar sua distância média de 2,77 UA.',
      en: 'Select Ceres in the scene or navigator to verify its 2.77 AU semi-major axis.',
    },
    explanation: {
      'pt-BR': 'Entre Marte (1,52 UA) e Júpiter (5,20 UA) situa-se o Cinturão Principal de Asteroides, onde a gravidade de Júpiter impediu a coalescência de um planeta maior. Ceres (939 km de diâmetro) é o único planeta anão dessa região.',
      en: 'Between Mars (1.52 AU) and Jupiter (5.20 AU) lies the Main Asteroid Belt, where Jupiter’s gravity prevented a larger planet from coalescing. Ceres (939 km diameter) is the only dwarf planet in this region.',
    },
  },
  {
    id: 'act_size_comparison',
    theme: 'size_comparison',
    title: { 'pt-BR': '2. Luas Maiores que um Planeta', en: '2. Moons Larger Than a Planet' },
    objective: {
      'pt-BR': 'Comparar os diâmetros reais de Ganimedes, Titã e Mercúrio usando dados volumétricos.',
      en: 'Compare the true diameters of Ganymede, Titan, and Mercury using volumetric data.',
    },
    startingBodyId: 'ganymede',
    recommendedTool: 'comparison',
    promptQuestion: {
      'pt-BR': 'Ao comparar Ganimedes (lua de Júpiter) e Titã (lua de Saturno) com o planeta Mercúrio (4.879 km), o que observamos sobre seus diâmetros e massas?',
      en: 'When comparing Ganymede (Jupiter’s moon) and Titan (Saturn’s moon) with the planet Mercury (4,879 km), what do we find about their diameters and masses?',
    },
    hint: {
      'pt-BR': 'Abra a área de Comparação ou inspecione Ganimedes (5.268 km), Titã (5.149 km) e Mercúrio (4.879 km).',
      en: 'Open the Comparison workspace or inspect Ganymede (5,268 km), Titan (5,149 km), and Mercury (4,879 km).',
    },
    options: [
      {
        id: 'opt_larger_diam_lower_mass',
        label: {
          'pt-BR': 'Ganimedes e Titã são maiores em diâmetro que Mercúrio, mas têm menor massa por conterem muito gelo.',
          en: 'Ganymede and Titan are larger in diameter than Mercury, but less massive because they contain large amounts of ice.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_mercury_biggest',
        label: {
          'pt-BR': 'Mercúrio é maior em diâmetro que todas as luas do Sistema Solar.',
          en: 'Mercury is larger in diameter than every moon in the Solar System.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_same_density',
        label: {
          'pt-BR': 'Ganimedes tem o dobro da massa de Mercúrio.',
          en: 'Ganymede has twice the mass of Mercury.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Use a ferramenta de Comparação para alinhar Ganimedes, Titã e Mercúrio na mesma escala linear de diâmetro.',
      en: 'Use the Comparison tool to line up Ganymede, Titan, and Mercury on a shared linear diameter scale.',
    },
    explanation: {
      'pt-BR': 'Ganimedes (5.268 km) e Titã (5.149 km) superam Mercúrio (4.879 km) em diâmetro. Porém, Mercúrio tem densidade muito alta (5,43 g/cm³ devido ao enorme núcleo de ferro), tendo mais que o dobro da massa de Ganimedes (densidade 1,94 g/cm³).',
      en: 'Ganymede (5,268 km) and Titan (5,149 km) both exceed Mercury (4,879 km) in diameter. However, Mercury’s high iron-rich density (5.43 g/cm³) gives it more than twice the mass of ice-rich Ganymede (1.94 g/cm³).',
    },
  },
  {
    id: 'act_day_and_year',
    theme: 'day_and_year',
    title: { 'pt-BR': '3. Dia Sideral vs. Dia Solar e Rotação Retrógrada', en: '3. Sidereal vs. Solar Day & Retrograde Spin' },
    objective: {
      'pt-BR': 'Compreender a diferença entre o período de rotação sideral e o dia solar em Vênus e Mercúrio.',
      en: 'Understand the difference between sidereal rotation period and solar day on Venus and Mercury.',
    },
    startingBodyId: 'venus',
    promptQuestion: {
      'pt-BR': 'Em Vênus, a rotação sideral dura 243 dias terrestres em sentido retrógrado (inclinada a 177,36°), enquanto seu ano dura 224,7 dias. Quanto dura o dia solar venusiano (de um nascer do Sol ao seguinte)?',
      en: 'On Venus, sidereal rotation takes 243 Earth days retrograde (177.36° tilt), while its orbital year is 224.7 days. How long is a Venusian solar day (sunrise to sunrise)?',
    },
    hint: {
      'pt-BR': 'Consulte a aba Dados no inspetor de Vênus (2.802 horas ≈ 116,75 dias terrestres).',
      en: 'Check the Data tab in Venus’s inspector (2,802 hours ≈ 116.75 Earth days).',
    },
    options: [
      {
        id: 'opt_116_days',
        label: {
          'pt-BR': 'Cerca de 116,75 dias terrestres (2.802 h), pois a rotação retrógrada se combina com o movimento orbital.',
          en: 'About 116.75 Earth days (2,802 h), because retrograde spin combines with orbital motion.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_24_hours',
        label: {
          'pt-BR': 'Exatamente 24 horas como na Terra.',
          en: 'Exactly 24 hours like on Earth.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_infinite',
        label: {
          'pt-BR': 'Vênus está em travamento de maré permanente com o Sol.',
          en: 'Venus is permanently tidally locked to the Sun.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Inspecione os dados de rotação sideral (-5.832,5 h) e dia solar (2.802 h) de Vênus.',
      en: 'Inspect Venus’s sidereal rotation (-5,832.5 h) and solar day (2,802 h) data.',
    },
    explanation: {
      'pt-BR': 'Como Vênus gira em sentido retrógrado enquanto orbita o Sol, o ciclo dia-noite (dia solar de ~116,75 dias terrestres) é muito mais curto do que sua rotação sideral em relação às estrelas distantes (243 dias).',
      en: 'Because Venus spins retrograde while orbiting the Sun, its day-night cycle (~116.75 Earth days) is much shorter than its sidereal rotation relative to distant stars (243 days).',
    },
  },
  {
    id: 'act_moon_phases',
    theme: 'moon_phases',
    title: { 'pt-BR': '4. Fases da Lua vs. Eclipses', en: '4. Lunar Phases vs. Eclipses' },
    objective: {
      'pt-BR': 'Distinguir a causa geométrica das fases mensais da Lua da condição especial de um eclipse.',
      en: 'Distinguish the geometric cause of monthly lunar phases from the nodal alignment required for an eclipse.',
    },
    startingBodyId: 'moon',
    recommendedTool: 'moon_lab',
    promptQuestion: {
      'pt-BR': 'O que causa as fases normais da Lua (Nova, Quarto Crescente, Cheia, Quarto Minguante) a cada mês, e por que não há um eclipse em toda Lua Cheia?',
      en: 'What causes the Moon’s regular monthly phases, and why doesn’t a lunar eclipse happen at every Full Moon?',
    },
    hint: {
      'pt-BR': 'Abra o Laboratório da Lua e observe a inclinação orbital de 5,145°.',
      en: 'Open the Moon Laboratory and observe the 5.145° orbital inclination.',
    },
    options: [
      {
        id: 'opt_viewing_angle_inclination',
        label: {
          'pt-BR': 'As fases vêm do ângulo sob o qual vemos a metade da Lua iluminada pelo Sol; eclipses são raros porque a órbita lunar é inclinada em 5,145°.',
          en: 'Phases come from our viewing angle of the Sun-lit lunar hemisphere; eclipses are rare because the Moon’s orbit is inclined by 5.145°.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_earth_shadow_monthly',
        label: {
          'pt-BR': 'As fases mensais são causadas pela sombra da Terra cobrindo a Lua toda semana.',
          en: 'Monthly phases are caused by Earth’s shadow covering the Moon every week.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_moon_emits_light',
        label: {
          'pt-BR': 'A superfície lunar muda seu brilho próprio ao longo do mês.',
          en: 'The lunar surface changes its own emitted glow over the month.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Use o Laboratório de Fases e Eclipses para alternar a inclinação orbital lunar e comparar a visão externa com a visão da Terra.',
      en: 'Use the Phases & Eclipses Lab to toggle lunar orbital inclination and compare external vs. Earth views.',
    },
    explanation: {
      'pt-BR': 'Metade da Lua está sempre iluminada pelo Sol. As fases decorrem de qual fração desse hemisfério iluminado está voltada para a Terra. A sombra da Terra só atinge a Lua (eclipse lunar) quando a Lua Cheia coincide com um dos nós orbitais.',
      en: 'Half of the Moon is always sunlit. Phases result from how much of that sunlit hemisphere faces Earth. Earth’s shadow only hits the Moon (lunar eclipse) when Full Moon occurs near an orbital node.',
    },
  },
  {
    id: 'act_orbital_speed',
    theme: 'orbital_speed',
    title: { 'pt-BR': '5. Leis de Kepler e Velocidade Orbital', en: '5. Kepler’s Laws & Orbital Speed' },
    objective: {
      'pt-BR': 'Verificar como a velocidade orbital varia com a distância ao Sol e entre o periélio e o afélio.',
      en: 'Verify how orbital speed varies with solar distance and between perihelion and aphelion.',
    },
    startingBodyId: 'mercury',
    recommendedTool: 'orbit_lab',
    promptQuestion: {
      'pt-BR': 'De acordo com a 2ª e a 3ª Leis de Kepler, onde um planeta ou cometa se move mais rapidamente?',
      en: 'According to Kepler’s 2nd and 3rd Laws, where does a planet or comet move fastest?',
    },
    hint: {
      'pt-BR': 'Observe a velocidade orbital no inspetor ou teste uma órbita elíptica no Laboratório de Gravidade e Kepler.',
      en: 'Check orbital speed in the inspector or test an elliptical orbit in the Gravity & Kepler Lab.',
    },
    options: [
      {
        id: 'opt_perihelion_closer',
        label: {
          'pt-BR': 'No periélio (ponto mais próximo do Sol), varrendo áreas iguais em tempos iguais, e em órbitas de menor semieixo maior.',
          en: 'At perihelion (closest point to the Sun), sweeping equal areas in equal times, and in orbits with smaller semi-major axes.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_aphelion_faster',
        label: {
          'pt-BR': 'No afélio (ponto mais distante do Sol).',
          en: 'At aphelion (farthest point from the Sun).',
        },
        isCorrect: false,
      },
      {
        id: 'opt_constant_speed',
        label: {
          'pt-BR': 'Todos os planetas viajam exatamente na mesma velocidade em km/s.',
          en: 'All planets travel at the exact same speed in km/s.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Ative a visualização de áreas iguais no Laboratório de Kepler com excentricidade e > 0,4.',
      en: 'Enable the equal-areas visualization in the Kepler Lab with eccentricity e > 0.4.',
    },
    explanation: {
      'pt-BR': 'Pela conservação do momento angular (2ª Lei de Kepler), um corpo acelera ao se aproximar do periélio e desacelera rumo ao afélio. Além disso, Mercúrio orbita a ~47 km/s em média, enquanto Netuno viaja a ~5,4 km/s.',
      en: 'By conservation of angular momentum (Kepler’s 2nd Law), a body speeds up approaching perihelion and slows toward aphelion. Moreover, Mercury averages ~47 km/s while Neptune travels at ~5.4 km/s.',
    },
  },
  {
    id: 'act_seasons',
    theme: 'seasons',
    title: { 'pt-BR': '6. Inclinação Axial e Estações Opostas nos Hemisférios', en: '6. Axial Tilt & Opposite Hemisphere Seasons' },
    objective: {
      'pt-BR': 'Investigar o que acontece com as estações se a inclinação axial for zerada (0°).',
      en: 'Investigate what happens to seasonal variation if axial tilt is set to zero (0°).',
    },
    startingBodyId: 'earth',
    recommendedTool: 'seasons_lab',
    promptQuestion: {
      'pt-BR': 'Se a inclinação axial da Terra fosse alterada de 23,44° para 0° no Laboratório das Estações, o que aconteceria com a duração do dia e as estações?',
      en: 'If Earth’s axial tilt were changed from 23.44° to 0° in the Seasons Laboratory, what would happen to day length and the seasons?',
    },
    hint: {
      'pt-BR': 'Abra o Laboratório das Estações e mova o controle de inclinação axial experimental para 0°.',
      en: 'Open the Seasons Lab and move the experimental axial tilt slider to 0°.',
    },
    options: [
      {
        id: 'opt_no_seasons_12h',
        label: {
          'pt-BR': 'Não haveria estações sazonais por inclinação e todas as latitudes teriam ~12h de sol e ~12h de noite o ano inteiro.',
          en: 'Tilt-driven seasons would disappear and all latitudes would experience ~12h of daylight and ~12h of night year-round.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_extreme_seasons',
        label: {
          'pt-BR': 'Os polos teriam 6 meses de sol escaldante seguidos de 6 meses de noite.',
          en: 'The poles would have 6 months of scorching sun followed by 6 months of night.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_same_hemisphere',
        label: {
          'pt-BR': 'Ambos os hemisférios teriam verão simultaneamente.',
          en: 'Both hemispheres would experience summer simultaneously.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'No Laboratório das Estações, ajuste a inclinação para 0° e observe os hemisférios norte e sul.',
      en: 'In the Seasons Lab, set tilt to 0° and observe both northern and southern hemispheres.',
    },
    explanation: {
      'pt-BR': 'As estações da Terra são causadas pela inclinação de 23,44° do eixo de rotação em relação à normal da eclíptica: quando o hemisfério norte se inclina para o Sol (verão boreal), o hemisfério sul se inclina para longe (inverno austral). Com 0°, a iluminação seria simétrica o ano todo.',
      en: 'Earth’s seasons are caused by its 23.44° axial obliquity: when the northern hemisphere tilts toward the Sun (northern summer), the southern hemisphere tilts away (southern winter). At 0° tilt, illumination stays symmetric all year.',
    },
  },
  {
    id: 'act_rings',
    theme: 'rings',
    title: { 'pt-BR': '7. Anéis Planetários e Orientação Equatorial', en: '7. Planetary Rings & Equatorial Orientation' },
    objective: {
      'pt-BR': 'Comparar os sistemas de anéis de Saturno e Urano e entender seu alinhamento equatorial.',
      en: 'Compare the ring systems of Saturn and Uranus and understand their equatorial alignment.',
    },
    startingBodyId: 'saturn',
    promptQuestion: {
      'pt-BR': 'Como os anéis de Saturno e os anéis de Urano estão orientados no espaço?',
      en: 'How are the rings of Saturn and the rings of Uranus oriented in space?',
    },
    hint: {
      'pt-BR': 'Inspecione Saturno (inclinação 26,73°) e Urano (inclinação 97,77°) na cena 3D.',
      en: 'Inspect Saturn (26.73° tilt) and Uranus (97.77° tilt) in the 3D scene.',
    },
    options: [
      {
        id: 'opt_own_equator',
        label: {
          'pt-BR': 'Cada sistema de anéis orbita no plano equatorial do seu próprio planeta (26,73° em Saturno e 97,77° em Urano).',
          en: 'Each ring system orbits in its own planet’s equatorial plane (26.73° at Saturn and 97.77° at Uranus).',
        },
        isCorrect: true,
      },
      {
        id: 'opt_flat_ecliptic',
        label: {
          'pt-BR': 'Todos os anéis ficam perfeitamente planos a 0° no plano da eclíptica.',
          en: 'All planetary rings lie flat at 0° in the ecliptic plane.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_opaque_solid',
        label: {
          'pt-BR': 'Os anéis de Saturno são um disco sólido contínuo de rocha opaca.',
          en: 'Saturn’s rings are a continuous solid disk of opaque rock.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Enquadre Saturno e depois Urano para observar a diferença entre seus planos equatoriais.',
      en: 'Frame Saturn and then Uranus to observe the difference between their equatorial planes.',
    },
    explanation: {
      'pt-BR': 'Os anéis são formados por miríades de partículas em órbita equatorial estabilizadas pelo bojo gravitacional do planeta. Por isso, os anéis de Urano ficam quase verticais (97,77°), acompanhando o equador de Urano e suas cinco grandes luas.',
      en: 'Rings consist of countless particles in equatorial orbits stabilized by the planet’s oblate gravity field. Thus Uranus’s rings stand nearly vertical (97.77°), aligned with Uranus’s equator and its five major moons.',
    },
  },
  {
    id: 'act_moons_hierarchy',
    theme: 'moons',
    title: { 'pt-BR': '8. Sistemas de Luas e Contagem Real vs. Exibida', en: '8. Satellite Systems: Known vs. Displayed Moons' },
    objective: {
      'pt-BR': 'Compreender a diferença entre o conjunto curado de luas exibidas em cena e o total de luas confirmadas.',
      en: 'Understand the distinction between the curated moons rendered in the 3D scene and total confirmed satellite counts.',
    },
    startingBodyId: 'saturn',
    promptQuestion: {
      'pt-BR': 'Por que o inspetor de Saturno separa "Luas exibidas: 2 (Titã e Encélado)" de "Luas conhecidas: 274 (ref. março/2025)"?',
      en: 'Why does Saturn’s inspector separate "Displayed moons: 2 (Titan & Enceladus)" from "Known moons: 274 (ref. March 2025)"?',
    },
    hint: {
      'pt-BR': 'Abra a aba Sistema/Luas no inspetor de Saturno ou Júpiter.',
      en: 'Open the System/Moons tab in Saturn’s or Jupiter’s inspector.',
    },
    options: [
      {
        id: 'opt_curated_clarity',
        label: {
          'pt-BR': 'Porque centenas de luas externas são fragmentos irregulares de poucos quilômetros; exibir as principais preserva a clareza visual sem omitir a contagem científica datada.',
          en: 'Because hundreds of outer moons are tiny irregular fragments a few kilometers wide; rendering curated major moons preserves visual clarity while reporting the dated scientific tally.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_only_two_exist',
        label: {
          'pt-BR': 'Porque Saturno possui apenas 2 luas no mundo real.',
          en: 'Because Saturn only has 2 moons in reality.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_moons_orbit_sun_only',
        label: {
          'pt-BR': 'Porque as outras luas giram presas à superfície sólida de Saturno.',
          en: 'Because the other moons are attached to Saturn’s rotating surface.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Selecione Saturno e clique em "Explorar Luas" para enquadrar Titã e Encélado.',
      en: 'Select Saturn and click "Explore Moons" to frame Titan and Enceladus.',
    },
    explanation: {
      'pt-BR': 'Telescópios modernos descobriram centenas de pequenos satélites irregulares ao redor de Saturno (274) e Júpiter (95). Separar "Luas exibidas" de "Luas conhecidas (com data de referência)" garante transparência científica e navegação limpa.',
      en: 'Modern telescopes have discovered hundreds of tiny irregular satellites around Saturn (274) and Jupiter (95). Separating "Displayed moons" from "Known moons (with reference date)" ensures scientific honesty and readable navigation.',
    },
  },
  {
    id: 'act_gravity',
    theme: 'gravity',
    title: { 'pt-BR': '9. Massa vs. Peso e Gravidade Superficial', en: '9. Mass vs. Weight & Surface Gravity' },
    objective: {
      'pt-BR': 'Diferenciar massa (kg) de peso (N) usando g = GM/r² no Laboratório de Gravidade.',
      en: 'Differentiate mass (kg) from weight (N) using g = GM/r² in the Gravity Laboratory.',
    },
    startingBodyId: 'jupiter',
    recommendedTool: 'orbit_lab',
    promptQuestion: {
      'pt-BR': 'Um equipamento científico tem massa de 100 kg na Terra (peso ≈ 981 N). Se levado para a superfície da Lua (g = 1,622 m/s²), qual será sua massa e seu peso?',
      en: 'A scientific instrument has a mass of 100 kg on Earth (weight ≈ 981 N). On the Moon’s surface (g = 1.622 m/s²), what are its mass and weight?',
    },
    hint: {
      'pt-BR': 'Lembre-se de que a massa é uma propriedade intrínseca em kg, e o peso é W = m × g em newtons (N).',
      en: 'Remember that mass is an intrinsic property in kg, while weight is W = m × g in newtons (N).',
    },
    options: [
      {
        id: 'opt_mass_100_weight_162',
        label: {
          'pt-BR': 'Massa permanece 100 kg; o peso passa a ser 162,2 N.',
          en: 'Mass remains 100 kg; weight becomes 162.2 N.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_mass_changes',
        label: {
          'pt-BR': 'A massa cai para 16,5 kg e o peso desaparece.',
          en: 'Mass drops to 16.5 kg and weight becomes zero.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_both_unchanged',
        label: {
          'pt-BR': 'Tanto a massa quanto o peso permanecem iguais aos da Terra.',
          en: 'Both mass and weight remain identical to Earth.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Abra o Laboratório de Gravidade e Kepler para calcular massa (kg) e peso (N) em diferentes corpos.',
      en: 'Open the Gravity & Kepler Lab to calculate mass (kg) and weight (N) across different bodies.',
    },
    explanation: {
      'pt-BR': 'A massa (quantidade de matéria, medida em quilogramas) não muda com a localização. O peso é a força gravitacional W = mg (medida em newtons), proporcional a GM/r².',
      en: 'Mass (amount of matter, measured in kilograms) does not change with location. Weight is the gravitational force W = mg (measured in newtons), proportional to GM/r².',
    },
  },
  {
    id: 'act_light_travel',
    theme: 'light_travel',
    title: { 'pt-BR': '10. Medindo Distâncias Físicas e Tempo-Luz', en: '10. Measuring Physical Distance & Light-Time' },
    objective: {
      'pt-BR': 'Confirmar que as medições físicas e o tempo de viagem da luz independem da escala visual.',
      en: 'Confirm that physical distance and light-travel time are invariant under visual scale changes.',
    },
    startingBodyId: 'earth',
    recommendedTool: 'measurement',
    promptQuestion: {
      'pt-BR': 'Quando você alterna entre a Escala de Exploração e a Escala Relativa com a Régua de Distância ativa entre o Sol e a Terra, o que acontece com o valor medido em km, UA e minutos-luz?',
      en: 'When you switch between Exploration Scale and Relative Scale with the Distance Ruler active between the Sun and Earth, what happens to the measured km, AU, and light-minutes?',
    },
    hint: {
      'pt-BR': 'Abra a ferramenta Medição entre Sol e Terra (~1 UA ≈ 8m 19s de luz) e alterne o botão de Escala.',
      en: 'Open the Measurement tool between Sun and Earth (~1 AU ≈ 8m 19s light-time) and toggle the Scale mode.',
    },
    options: [
      {
        id: 'opt_invariant_physical',
        label: {
          'pt-BR': 'Permanece exatamente o mesmo (~1 UA / ~8m 19s), pois a régua lê as coordenadas físicas e não as coordenadas comprimidas de tela.',
          en: 'It remains invariant (~1 AU / ~8m 19s) because the ruler reads physical coordinates rather than compressed display coordinates.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_shrinks_with_mesh',
        label: {
          'pt-BR': 'Muda drasticamente porque a régua mede os pixels da tela.',
          en: 'It changes drastically because the ruler measures screen pixels.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_light_instant',
        label: {
          'pt-BR': 'O tempo de viagem da luz é zero no vácuo.',
          en: 'Light-travel time is zero in a vacuum.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Meça a distância Sol–Terra ou Terra–Saturno e dispare o pulso educativo de luz.',
      en: 'Measure the Sun–Earth or Earth–Saturn distance and trigger the educational light pulse.',
    },
    explanation: {
      'pt-BR': 'No Observatório, as coordenadas científicas (em UA e km) são mantidas separadas das coordenadas de apresentação 3D. Assim, mudar a escala visual altera apenas o mapeamento gráfico, preservando todas as grandezas físicas.',
      en: 'In the Observatory, scientific coordinates (in AU and km) are strictly separated from 3D presentation coordinates. Changing visual scale updates only the display mapping while preserving all physical quantities.',
    },
  },
  {
    id: 'act_distance_scale',
    theme: 'distance_scale',
    title: { 'pt-BR': '11. Jornada Além de Netuno e a Escala Logarítmica', en: '11. Beyond Neptune & Logarithmic Distance Scale' },
    objective: {
      'pt-BR': 'Compreender por que gráficos de distância do Sistema Solar externo usam escala logarítmica rotulada.',
      en: 'Understand why outer Solar System distance charts use an explicitly labeled logarithmic scale.',
    },
    startingBodyId: 'pluto',
    recommendedTool: 'outer_system',
    promptQuestion: {
      'pt-BR': 'Se Netuno está a ~30 UA do Sol e a Nuvem de Oort estende-se de ~2.000 UA a ~100.000 UA, o que acontece ao representar ambos em uma régua linear simples?',
      en: 'If Neptune orbits at ~30 AU and the Oort Cloud extends from ~2,000 AU to ~100,000 AU, what happens when plotting both on a single linear ruler?',
    },
    hint: {
      'pt-BR': 'Abra a jornada "Além de Netuno" ou alterne entre Linear e Logarítmica no Laboratório de Escala.',
      en: 'Open the "Beyond Neptune" journey or toggle between Linear and Logarithmic in the Scale Lab.',
    },
    options: [
      {
        id: 'opt_planets_compressed_origin',
        label: {
          'pt-BR': 'Todos os oito planetas ficam comprimidos nos primeiros 0,03% da régua linear! Por isso uma escala logarítmica rotulada ajuda a visualizar múltiplas ordens de grandeza.',
          en: 'All eight planets are squeezed into the first 0.03% of a 100,000 AU linear ruler! A clearly labeled logarithmic axis lets us inspect multiple orders of magnitude.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_oort_just_outside_pluto',
        label: {
          'pt-BR': 'A Nuvem de Oort fica logo ao lado de Plutão, a 45 UA.',
          en: 'The Oort Cloud sits right next to Pluto at 45 AU.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_hard_wall',
        label: {
          'pt-BR': 'Existe uma parede física sólida exatamente em 50 UA marcando o fim do Sistema Solar.',
          en: 'There is a solid physical wall at 50 AU marking the edge of the Solar System.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Percorra as etapas da jornada "Além de Netuno" desde 1 UA até a Nuvem de Oort.',
      en: 'Step through the "Beyond Neptune" distance journey from 1 AU out to the Oort Cloud.',
    },
    explanation: {
      'pt-BR': 'Os planetas principais ocupam apenas as primeiras 30 UA, enquanto a influência gravitacional do Sol alcança ~100.000 UA na Nuvem de Oort. Sempre rotulamos explicitamente quando um eixo é linear ou logarítmico.',
      en: 'The major planets occupy only the inner 30 AU, whereas the Sun’s gravitational neighborhood reaches ~100,000 AU in the Oort Cloud. We always label explicitly whether an axis is linear or logarithmic.',
    },
  },
  {
    id: 'act_scientific_uncertainty',
    theme: 'scientific_uncertainty',
    title: { 'pt-BR': '12. Limites do Modelo, Fontes e Incerteza Científica', en: '12. Model Boundaries, Sources & Scientific Uncertainty' },
    objective: {
      'pt-BR': 'Avaliar a diferença entre dados observados de perto, aproximações keplerianas e representações ilustrativas.',
      en: 'Evaluate the difference between close-up observations, Keplerian approximations, and illustrative representations.',
    },
    startingBodyId: 'eris',
    recommendedTool: 'encyclopedia',
    promptQuestion: {
      'pt-BR': 'Qual das afirmações abaixo descreve corretamente o modelo científico e visual deste Observatório?',
      en: 'Which statement accurately describes the scientific and visual model of this Observatory?',
    },
    hint: {
      'pt-BR': 'Consulte a aba Fontes de Éris ou o artigo "Sobre Este Modelo" na Enciclopédia.',
      en: 'Check Eris’s Sources tab or the "About This Model" article in the Encyclopedia.',
    },
    options: [
      {
        id: 'opt_transparent_limits',
        label: {
          'pt-BR': 'Usa elementos keplerianos JPL (1800–2050 EC) para os planetas e identifica claramente quando superfícies distantes (como Éris) ou efeitos visuais são ilustrativos.',
          en: 'Uses JPL Keplerian elements (1800–2050 CE) for planets and clearly identifies when distant surfaces (like Eris) or visual layers are illustrative.',
        },
        isCorrect: true,
      },
      {
        id: 'opt_live_telescope',
        label: {
          'pt-BR': 'Exibe imagens de vídeo ao vivo capturadas por telescópios em tempo real de todos os planetas anões.',
          en: 'Streams live real-time telescope video of every dwarf planet surface.',
        },
        isCorrect: false,
      },
      {
        id: 'opt_nbody_century_eclipse',
        label: {
          'pt-BR': 'Prevê eclipses solares ao segundo para qualquer milênio sem necessidade de efemérides N-corpos.',
          en: 'Predicts solar eclipses to the second across millennia without N-body ephemerides.',
        },
        isCorrect: false,
      },
    ],
    sceneTaskDescription: {
      'pt-BR': 'Abra o artigo "Sobre Este Modelo" na Enciclopédia ou a aba Fontes de qualquer corpo.',
      en: 'Open the "About This Model" article in the Encyclopedia or the Sources tab of any body.',
    },
    explanation: {
      'pt-BR': 'A ciência rigorosa exige transparência sobre o que é medido e o que é aproximado: posições planetárias seguem a aproximação kepleriana secular do JPL (válida entre 1800 e 2050 EC), enquanto corpos ainda não visitados por sondas (como Éris, Haumea e Makemake) exibem superfícies explicitamente rotuladas como ilustrativas.',
      en: 'Rigorous science requires transparency about what is measured versus approximated: planetary positions follow JPL’s secular Keplerian approximation (valid 1800–2050 CE), while unvisited worlds (like Eris, Haumea, and Makemake) use surfaces explicitly labeled as illustrative.',
    },
  },
];

export interface EncyclopediaArticle {
  id: string;
  title: LocalizedText;
  synonyms: string[];
  category: 'model' | 'orbital_mechanics' | 'physical_properties' | 'observation';
  shortDefinition: LocalizedText;
  deeperExplanation: LocalizedText;
  linkedBodyId?: string;
  linkedTool?: ActiveTool;
  linkedActionLabel?: LocalizedText;
  source: typeof PRIMARY_SOURCES[keyof typeof PRIMARY_SOURCES];
}

export const ENCYCLOPEDIA_ARTICLES: EncyclopediaArticle[] = [
  {
    id: 'about_this_model',
    title: { 'pt-BR': 'Sobre Este Modelo Científico e Visual', en: 'About This Scientific & Visual Model' },
    synonyms: ['modelo', 'model', 'precisao', 'accuracy', 'limites', 'escala', 'jpl'],
    category: 'model',
    shortDefinition: {
      'pt-BR': 'Resumo transparente das escolhas de escala, aproximação orbital kepleriana, datas de referência dos dados e limites de precisão do Observatório.',
      en: 'Transparent summary of the Observatory’s scale mappings, Keplerian orbital approximation, data reference dates, and accuracy boundaries.',
    },
    deeperExplanation: {
      'pt-BR':
        '1. Escalas: Na Escala de Exploração, raios e distâncias seguem um mapeamento radial monotônico para manter planetas e luas visíveis; na Escala Relativa, as distâncias heliocêntricas são lineares em UA e os planetas mantêm proporções reais de diâmetro. Todas as medições físicas lêem coordenadas científicas em UA e km.\n2. Órbitas e Época: Os oito planetas e Plutão usam os elementos keplerianos seculares J2000 da Tabela 1 do JPL (válidos entre 1800 EC e 2050 EC). A posição heliocêntrica da Terra na Tabela 1 representa o baricentro Terra–Lua (EMB), enquanto a Lua é avaliada no referencial posicional terrestre sem herdar a rotação diária da Terra. Perturbações N-corpos de curto prazo, relatividade geral e tempo de luz não são integrados na propagação visual.\n3. Populações e Aparência: As contagens de luas conhecidas têm data de referência março de 2025 (ex.: Saturno 274, Júpiter 95), separadas das luas exibidas em cena. Corpos sem imagens de sobrevoo próximo (Éris, Haumea, Makemake) e camadas como luzes noturnas terrestres ou radar venusiano são identificados como representações ilustrativas.',
      en:
        '1. Scales: In Exploration Scale, radii and distances follow a monotonic radial mapping to keep planets and moons legible; in Relative Scale, heliocentric distances are linear in AU and planets maintain true diameter ratios. All measurement tools read physical coordinates in AU and km.\n2. Orbits & Epoch: The eight planets and Pluto use JPL Table 1 J2000 secular Keplerian elements (valid 1800–2050 CE). Earth’s heliocentric table entry represents the Earth–Moon Barycenter (EMB), while the Moon is evaluated in Earth’s positional frame without inheriting Earth’s daily spin. Short-term N-body perturbations, general relativity, and light-time aberration are omitted.\n3. Populations & Appearance: Known moon counts carry a March 2025 reference date (e.g., Saturn 274, Jupiter 95), separated from rendered moon counts. Unvisited worlds (Eris, Haumea, Makemake) and layers like Earth night lights or Venus radar are explicitly labeled as illustrative representations.',
    },
    linkedBodyId: 'earth',
    linkedTool: 'scale_lab',
    linkedActionLabel: { 'pt-BR': 'Inspecionar Mapeamento no Laboratório de Escala', en: 'Inspect Mapping in Scale Laboratory' },
    source: PRIMARY_SOURCES.jpl_approx_pos,
  },
  {
    id: 'astronomical_unit',
    title: { 'pt-BR': 'Unidade Astronômica (UA)', en: 'Astronomical Unit (AU)' },
    synonyms: ['ua', 'au', 'unidade astronomica', 'astronomical unit', '149597870'],
    category: 'observation',
    shortDefinition: {
      'pt-BR': 'Unidade padrão de distância equivalente à distância média aproximada entre a Terra e o Sol: exatamente 149.597.870,7 km.',
      en: 'Standard distance unit equal to the approximate mean distance between Earth and the Sun: exactly 149,597,870.7 km.',
    },
    deeperExplanation: {
      'pt-BR': 'Desde a resolução da UAI de 2012, 1 UA é definida como uma constante exata do Sistema Internacional (149.597.870.700 metros). É a régua fundamental para comparar distâncias planetárias: Mercúrio orbita a ~0,39 UA, Júpiter a ~5,20 UA e Netuno a ~30,07 UA.',
      en: 'Since the 2012 IAU resolution, 1 AU is defined as an exact SI constant (149,597,870,700 meters). It serves as the natural yardstick for planetary distances: Mercury orbits at ~0.39 AU, Jupiter at ~5.20 AU, and Neptune at ~30.07 AU.',
    },
    linkedBodyId: 'earth',
    linkedTool: 'measurement',
    linkedActionLabel: { 'pt-BR': 'Medir Distâncias em UA na Régua', en: 'Measure Distances in AU with Ruler' },
    source: PRIMARY_SOURCES.jpl_phys_par,
  },
  {
    id: 'light_time',
    title: { 'pt-BR': 'Tempo-Luz (Velocidade da Luz)', en: 'Light-Time (Speed of Light)' },
    synonyms: ['tempo-luz', 'light-time', 'segundo-luz', 'minuto-luz', 'velocidade da luz'],
    category: 'observation',
    shortDefinition: {
      'pt-BR': 'O tempo que um pulso de luz ou sinal de rádio (viajando a 299.792,458 km/s no vácuo) leva para percorrer a distância entre dois corpos.',
      en: 'The time required for light or radio signals (traveling at 299,792.458 km/s in vacuum) to cross the distance between two bodies.',
    },
    deeperExplanation: {
      'pt-BR': 'A luz percorre 1 UA em cerca de 499 segundos (8 minutos e 19 segundos). Como nenhum sinal de comando pode superar a velocidade da luz, sondas em Marte ou nos planetas gigantes precisam operar com autonomia durante manobras críticas.',
      en: 'Light travels 1 AU in about 499 seconds (8 minutes 19 seconds). Because no command signal can exceed the speed of light, spacecraft at Mars or the outer planets must operate autonomously during critical maneuvers.',
    },
    linkedBodyId: 'saturn',
    linkedTool: 'measurement',
    linkedActionLabel: { 'pt-BR': 'Simular Pulso de Luz na Ferramenta de Medição', en: 'Simulate Light Pulse in Measurement Tool' },
    source: PRIMARY_SOURCES.nasa_solar_facts,
  },
  {
    id: 'diameter',
    title: { 'pt-BR': 'Diâmetro (Volumétrico Médio vs. Equatorial)', en: 'Diameter (Mean Volumetric vs. Equatorial)' },
    synonyms: ['diametro', 'diameter', 'raio', 'radius', 'achatamento'],
    category: 'physical_properties',
    shortDefinition: {
      'pt-BR': 'A extensão linear de uma esfera equivalente ao volume do corpo (diâmetro volumétrico médio) ou medida através do seu equador.',
      en: 'The linear span of a sphere of equivalent volume (mean volumetric diameter) or measured across its equator.',
    },
    deeperExplanation: {
      'pt-BR': 'Planetas de rotação rápida como Júpiter e Saturno apresentam achatamento polar significativo (o raio equatorial de Saturno é ~60.268 km, enquanto o raio volumétrico médio é ~58.232 km). Este catálogo utiliza o diâmetro volumétrico médio de forma consistente e documenta as dimensões triaxiais para corpos irregulares.',
      en: 'Fast-rotating planets like Jupiter and Saturn exhibit significant polar flattening (Saturn’s equatorial radius is ~60,268 km while its mean volumetric radius is ~58,232 km). This catalog uses mean volumetric diameter consistently and lists triaxial dimensions for irregular bodies.',
    },
    linkedBodyId: 'jupiter',
    linkedTool: 'comparison',
    linkedActionLabel: { 'pt-BR': 'Comparar Diâmetros na Área de Comparação', en: 'Compare Diameters in Comparison Workspace' },
    source: PRIMARY_SOURCES.jpl_phys_par,
  },
  {
    id: 'mass_and_gravity',
    title: { 'pt-BR': 'Massa, Gravidade e Nível de Referência de 1 bar', en: 'Mass, Gravity & 1-Bar Reference Level' },
    synonyms: ['massa', 'mass', 'gravidade', 'gravity', 'peso', 'weight', '1 bar'],
    category: 'physical_properties',
    shortDefinition: {
      'pt-BR': 'A massa (kg) mede a quantidade de matéria e inércia; a gravidade superficial (m/s²) mede a aceleração gravitacional a um raio de referência.',
      en: 'Mass (kg) measures matter and inertia; surface gravity (m/s²) measures gravitational acceleration at a defined reference radius.',
    },
    deeperExplanation: {
      'pt-BR': 'Na aproximação esférica, g = GM/r². Como gigantes gasosos e de gelo (Júpiter, Saturno, Urano, Netuno) não possuem superfície sólida, sua gravidade e temperatura de referência são definidas na altitude onde a pressão atmosférica equivale a 1 bar (aproximadamente a pressão ao nível do mar na Terra).',
      en: 'In a spherical approximation, g = GM/r². Because gas and ice giants (Jupiter, Saturn, Uranus, Neptune) have no solid surface, their reference gravity and temperature are defined at the altitude where atmospheric pressure equals 1 bar (roughly Earth sea-level pressure).',
    },
    linkedBodyId: 'jupiter',
    linkedTool: 'orbit_lab',
    linkedActionLabel: { 'pt-BR': 'Experimentar Gravidade e Peso no Laboratório', en: 'Test Gravity & Weight in Laboratory' },
    source: PRIMARY_SOURCES.jpl_phys_par,
  },
  {
    id: 'density',
    title: { 'pt-BR': 'Densidade Média (g/cm³)', en: 'Bulk Density (g/cm³)' },
    synonyms: ['densidade', 'density', 'rocha', 'gelo', 'gas'],
    category: 'physical_properties',
    shortDefinition: {
      'pt-BR': 'A razão entre a massa total de um corpo e seu volume, indicando se é composto predominantemente por metais/rochas, gelos ou hidrogênio/hélio.',
      en: 'The ratio of a body’s total mass to its volume, indicating whether it is composed primarily of rock/metal, ices, or hydrogen/helium gas.',
    },
    deeperExplanation: {
      'pt-BR': 'A água líquida tem densidade de 1,0 g/cm³. A Terra é o planeta mais denso (5,51 g/cm³) devido ao núcleo metálico e compressão gravitacional; Saturno tem a menor densidade (0,687 g/cm³), inferior à da água.',
      en: 'Liquid water has a density of 1.0 g/cm³. Earth is the densest planet (5.51 g/cm³) due to its metallic core and gravitational compression; Saturn has the lowest bulk density (0.687 g/cm³), less than water.',
    },
    linkedBodyId: 'saturn',
    linkedTool: 'comparison',
    linkedActionLabel: { 'pt-BR': 'Comparar Densidades de Terra e Saturno', en: 'Compare Densities of Earth & Saturn' },
    source: PRIMARY_SOURCES.jpl_phys_par,
  },
  {
    id: 'sidereal_vs_solar_day',
    title: { 'pt-BR': 'Rotação, Dia Sideral e Dia Solar', en: 'Rotation, Sidereal Day & Solar Day' },
    synonyms: ['rotacao', 'rotation', 'dia sideral', 'sidereal day', 'dia solar', 'solar day', 'retrogrado'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'O dia sideral é o tempo de um giro de 360° em relação às estrelas fixas; o dia solar é o intervalo entre duas passagens consecutivas do Sol pelo meridiano local.',
      en: 'A sidereal day is the time for a 360° spin relative to distant stars; a solar day is the interval between two successive local meridian transits of the Sun.',
    },
    deeperExplanation: {
      'pt-BR': 'Como a Terra avança ~1° por dia em sua órbita ao redor do Sol, ela precisa girar ~361° para que o Sol volte ao meio-dia no mesmo meridiano. Assim, o dia sideral dura 23h 56m 04s e o dia solar médio dura 24h 00m 00s.',
      en: 'Because Earth advances ~1° per day along its orbit around the Sun, it must rotate ~361° for the Sun to return to local noon. Thus Earth’s sidereal day is 23h 56m 04s while its mean solar day is 24h 00m 00s.',
    },
    linkedBodyId: 'mercury',
    source: PRIMARY_SOURCES.jpl_phys_par,
  },
  {
    id: 'revolution_and_period',
    title: { 'pt-BR': 'Revolução (Período Orbital)', en: 'Revolution (Orbital Period)' },
    synonyms: ['revolucao', 'revolution', 'periodo orbital', 'orbital period', 'ano'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'O tempo necessário para um corpo completar uma órbita inteira de 360° ao redor de seu corpo central (Sol ou planeta-pai).',
      en: 'The time required for a body to complete one full 360° orbit around its central primary (the Sun or parent planet).',
    },
    deeperExplanation: {
      'pt-BR': 'Pela 3ª Lei de Kepler, o quadrado do período orbital (T²) é proporcional ao cubo do semieixo maior (a³). Por isso Mercúrio completa uma órbita em ~88 dias, a Terra em ~365,26 dias e Netuno em ~164,8 anos terrestres.',
      en: 'By Kepler’s 3rd Law, the square of the orbital period (T²) is proportional to the cube of the semi-major axis (a³). Thus Mercury completes an orbit in ~88 days, Earth in ~365.26 days, and Neptune in ~164.8 Earth years.',
    },
    linkedBodyId: 'neptune',
    linkedTool: 'orbit_lab',
    linkedActionLabel: { 'pt-BR': 'Testar Período vs. Semieixo Maior no Laboratório', en: 'Test Period vs. Semi-Major Axis in Lab' },
    source: PRIMARY_SOURCES.jpl_approx_pos,
  },
  {
    id: 'eccentricity',
    title: { 'pt-BR': 'Excentricidade Orbital (e)', en: 'Orbital Eccentricity (e)' },
    synonyms: ['excentricidade', 'eccentricity', 'elipse', 'ellipse', 'circular'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'Parâmetro adimensional que mede o quanto uma órbita se afasta de um círculo perfeito (e = 0 é circular; 0 < e < 1 é elíptica).',
      en: 'Dimensionless parameter measuring how much an orbit departs from a perfect circle (e = 0 is circular; 0 < e < 1 is elliptical).',
    },
    deeperExplanation: {
      'pt-BR': 'A maioria dos planetas tem excentricidade baixa (Vênus 0,0068; Terra 0,0167), enquanto Mercúrio (0,2056), Plutão (0,2488) e Éris (0,436) têm órbitas visivelmente elípticas. Cometas periódicos como o modelo Halley têm alta excentricidade (~0,967).',
      en: 'Most major planets have low eccentricity (Venus 0.0068; Earth 0.0167), while Mercury (0.2056), Pluto (0.2488), and Eris (0.436) follow noticeably elliptical paths. Periodic comets like the Halley model have high eccentricity (~0.967).',
    },
    linkedBodyId: 'halley_model',
    linkedTool: 'orbit_lab',
    linkedActionLabel: { 'pt-BR': 'Abrir Laboratório de Órbita em Estado Elíptico', en: 'Open Orbit Lab in Elliptical State' },
    source: PRIMARY_SOURCES.jpl_approx_pos,
  },
  {
    id: 'inclination',
    title: { 'pt-BR': 'Inclinação Orbital (I)', en: 'Orbital Inclination (I)' },
    synonyms: ['inclinacao orbital', 'inclination', 'ecliptica', 'ecliptic', 'nodo'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'O ângulo entre o plano orbital de um corpo e um plano de referência (a eclíptica J2000 para planetas, ou o equador planetário para luas regulares).',
      en: 'The angle between a body’s orbital plane and a reference plane (the J2000 ecliptic for planets, or the parent planet’s equator for regular moons).',
    },
    deeperExplanation: {
      'pt-BR': 'Os oito planetas orbitam muito próximos ao plano da eclíptica (Mercúrio tem a maior inclinação planetária com 7,0°). Já objetos do Cinturão de Kuiper e Disco Disperso como Plutão (17,1°) e Éris (44,0°) possuem órbitas fortemente inclinadas. Inclinações acima de 90° indicam órbitas retrógradas (como Tritão a 156,9°).',
      en: 'The eight planets orbit closely within the ecliptic plane (Mercury has the highest planetary inclination at 7.0°). Kuiper Belt and Scattered Disc objects like Pluto (17.1°) and Eris (44.0°) have strongly tilted orbits. Inclinations above 90° indicate retrograde orbits (such as Triton at 156.9°).',
    },
    linkedBodyId: 'pluto',
    source: PRIMARY_SOURCES.jpl_approx_pos,
  },
  {
    id: 'axial_tilt',
    title: { 'pt-BR': 'Inclinação Axial (Obliquidade)', en: 'Axial Tilt (Obliquity)' },
    synonyms: ['inclinacao axial', 'axial tilt', 'obliquidade', 'obliquity', 'estacoes', 'seasons'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'O ângulo entre o eixo de rotação de um corpo e a perpendicular ao seu plano orbital.',
      en: 'The angle between a body’s rotational axis and the perpendicular to its orbital plane.',
    },
    deeperExplanation: {
      'pt-BR': 'A obliquidade da Terra (23,44°) e de Marte (25,19°) produz estações climáticas bem definidas. Mercúrio (0,03°) quase não tem inclinação axial, enquanto Urano (97,77°) gira praticamente deitado sobre sua órbita.',
      en: 'The obliquity of Earth (23.44°) and Mars (25.19°) drives pronounced seasonal cycles. Mercury (0.03°) has virtually no axial tilt, while Uranus (97.77°) rotates nearly on its side.',
    },
    linkedBodyId: 'earth',
    linkedTool: 'seasons_lab',
    linkedActionLabel: { 'pt-BR': 'Experimentar Inclinação Axial no Laboratório das Estações', en: 'Experiment with Axial Tilt in Seasons Lab' },
    source: PRIMARY_SOURCES.nasa_seasons,
  },
  {
    id: 'perihelion_aphelion',
    title: { 'pt-BR': 'Periélio e Afélio (Periastro e Apoastro)', en: 'Perihelion & Aphelion (Periapsis & Apoapsis)' },
    synonyms: ['perielio', 'afelio', 'perihelion', 'aphelion', 'periapsis', 'apoapsis'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'O periélio é o ponto da órbita mais próximo do Sol, r_p = a(1 − e); o afélio é o ponto mais distante, r_a = a(1 + e).',
      en: 'Perihelion is the point of an orbit closest to the Sun, r_p = a(1 − e); aphelion is the farthest point, r_a = a(1 + e).',
    },
    deeperExplanation: {
      'pt-BR': 'Ative os marcadores de Periélio e Afélio nas sobreposições científicas para ver na cena 3D onde cada órbita elíptica se aproxima ou se afasta do Sol.',
      en: 'Enable the Perihelion and Aphelion markers in the scientific overlays to see in the 3D scene where each elliptical orbit approaches or recedes from the Sun.',
    },
    linkedBodyId: 'mercury',
    linkedTool: 'orbit_lab',
    linkedActionLabel: { 'pt-BR': 'Ver Periastro e Apoastro no Laboratório de Kepler', en: 'View Periapsis & Apoapsis in Kepler Lab' },
    source: PRIMARY_SOURCES.jpl_approx_pos,
  },
  {
    id: 'tidal_locking',
    title: { 'pt-BR': 'Travamento de Maré (Rotação Síncrona)', en: 'Tidal Locking (Synchronous Rotation)' },
    synonyms: ['travamento de mare', 'tidal locking', 'rotacao sincrona', 'synchronous'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'Estado gravitacional em que o período de rotação de um satélite iguala seu período orbital, mantendo sempre o mesmo hemisfério voltado para o planeta-pai.',
      en: 'Gravitational state in which a satellite’s rotation period equals its orbital period, keeping the same hemisphere permanently facing its parent body.',
    },
    deeperExplanation: {
      'pt-BR': 'A Lua da Terra, as quatro luas galileanas de Júpiter, Titã, Encélado e Tritão estão em rotação síncrona com seus respectivos planetas. No sistema Plutão–Caronte, o travamento é mútuo: ambos os corpos mostram sempre a mesma face um para o outro.',
      en: 'Earth’s Moon, Jupiter’s four Galilean moons, Titan, Enceladus, and Triton are all in synchronous rotation with their parent planets. In the Pluto–Charon system, the lock is mutual: both bodies permanently present the same face to each other.',
    },
    linkedBodyId: 'moon',
    source: PRIMARY_SOURCES.jpl_satellites,
  },
  {
    id: 'phase_and_eclipse',
    title: { 'pt-BR': 'Fases Lunares e Eclipses', en: 'Lunar Phases & Eclipses' },
    synonyms: ['fase', 'phase', 'eclipse', 'umbra', 'penumbra', 'lua cheia', 'lua nova'],
    category: 'observation',
    shortDefinition: {
      'pt-BR': 'Fases resultam da geometria de observação do hemisfério iluminado pelo Sol; eclipses ocorrem apenas quando Sol, Terra e Lua se alinham próximo aos nós orbitais.',
      en: 'Phases arise from the viewing geometry of a body’s sunlit hemisphere; eclipses occur only when the Sun, Earth, and Moon align near the lunar orbital nodes.',
    },
    deeperExplanation: {
      'pt-BR': 'Em um eclipse solar, a Lua passa entre o Sol e a Terra projetando a umbra (sombra total) e a penumbra (sombra parcial). Em um eclipse lunar, a Lua atravessa o cone de sombra da Terra.',
      en: 'During a solar eclipse, the Moon passes between the Sun and Earth, casting its umbra (total shadow) and penumbra (partial shadow). During a lunar eclipse, the Moon passes through Earth’s shadow cone.',
    },
    linkedBodyId: 'moon',
    linkedTool: 'moon_lab',
    linkedActionLabel: { 'pt-BR': 'Abrir Laboratório de Fases e Eclipses', en: 'Open Phases & Eclipses Laboratory' },
    source: PRIMARY_SOURCES.nasa_eclipses,
  },
  {
    id: 'barycenter_and_frame',
    title: { 'pt-BR': 'Baricentro e Referencial de Coordenadas', en: 'Barycenter & Coordinate Reference Frame' },
    synonyms: ['baricentro', 'barycenter', 'referencial', 'reference frame', 'heliocentrico', 'geocentrico', 'retrogrado aparente'],
    category: 'orbital_mechanics',
    shortDefinition: {
      'pt-BR': 'O baricentro é o centro de massa comum de dois ou mais corpos em órbita; o referencial define qual ponto é tratado como origem da observação.',
      en: 'The barycenter is the shared center of mass of orbiting bodies; the reference frame defines which point serves as the origin of observation.',
    },
    deeperExplanation: {
      'pt-BR': 'Mudar o referencial de Heliocêntrico (Sol) para Geocêntrico (Terra) altera o ponto de vista e permite observar o movimento retrógrado aparente de planetas como Marte sem alterar o estado físico real do Sistema Solar.',
      en: 'Switching the reference frame from Heliocentric (Sun) to Geocentric (Earth) transforms the viewpoint and demonstrates apparent retrograde motion of planets like Mars without altering the underlying physical configuration.',
    },
    linkedBodyId: 'pluto',
    source: PRIMARY_SOURCES.jpl_approx_pos,
  },
];

export const PRESET_TIME_BOOKMARKS: TimeBookmark[] = [
  {
    id: 'bm_vernal_2025',
    title: 'Equinócio de Março de 2025 (Sessão Inicial)',
    simTimeMs: Date.UTC(2025, 2, 20, 12, 0, 0),
    targetId: 'earth',
    scaleMode: 'exploration',
    category: 'model_approximate',
    description: {
      'pt-BR': 'Instante padrão determinístico da sessão inicial (20 mar 2025 12:00 UTC), próximo ao equinócio vernal na aproximação kepleriana.',
      en: 'Deterministic session-start epoch (2025-03-20 12:00 UTC), near the March equinox in the Keplerian approximation.',
    },
  },
  {
    id: 'bm_voyager2_neptune_1989',
    title: 'Encontro da Voyager 2 com Netuno (25 Ago 1989)',
    simTimeMs: Date.UTC(1989, 7, 25, 4, 0, 0),
    targetId: 'neptune',
    scaleMode: 'exploration',
    category: 'historical_event',
    description: {
      'pt-BR': 'Data histórica real do sobrevoo da Voyager 2 por Netuno e Tritão (as posições planetárias são avaliadas pelo modelo kepleriano JPL, sem telemetria de sonda ao vivo).',
      en: 'Historically sourced date of Voyager 2’s flyby of Neptune and Triton (planetary positions evaluated by the JPL Keplerian model, not live spacecraft telemetry).',
    },
  },
  {
    id: 'bm_new_horizons_pluto_2015',
    title: 'Sobrevoo da New Horizons em Plutão (14 Jul 2015)',
    simTimeMs: Date.UTC(2015, 6, 14, 11, 49, 0),
    targetId: 'pluto',
    scaleMode: 'exploration',
    category: 'historical_event',
    description: {
      'pt-BR': 'Data histórica da máxima aproximação da sonda New Horizons ao sistema Plutão–Caronte.',
      en: 'Historical date of New Horizons’ closest approach to the Pluto–Charon system.',
    },
  },
  {
    id: 'bm_jupiter_saturn_2020',
    title: 'Grande Conjunção Aproximada Júpiter–Saturno (21 Dez 2020)',
    simTimeMs: Date.UTC(2020, 11, 21, 18, 0, 0),
    targetId: 'saturn',
    scaleMode: 'exploration',
    category: 'model_approximate',
    description: {
      'pt-BR': 'Configuração aproximada encontrada pelo modelo kepleriano para o alinhamento angular entre Júpiter e Saturno visto da Terra.',
      en: 'Approximate configuration produced by the Keplerian model for the close angular alignment of Jupiter and Saturn seen from Earth.',
    },
  },
  {
    id: 'bm_halley_perihelion_1986',
    title: 'Demonstração Esquemática de Periélio Cometário (9 Fev 1986)',
    simTimeMs: Date.UTC(1986, 1, 9, 12, 0, 0),
    targetId: 'halley_model',
    scaleMode: 'exploration',
    category: 'schematic_alignment',
    description: {
      'pt-BR': 'Demonstração esquemática de atividade cometária próxima ao Sol para inspeção das caudas iônica e de poeira.',
      en: 'Schematic demonstration of inner-system comet activity for inspecting the anti-solar ion tail and curved dust tail.',
    },
  },
];
