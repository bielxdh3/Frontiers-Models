import { SourceReference } from '../types/solarSystem';

export const PRIMARY_SOURCES: Record<string, SourceReference> = {
  jpl_phys_par: {
    id: 'jpl_phys_par',
    title: {
      'pt-BR': 'Parâmetros Físicos Planetários do JPL (NASA)',
      en: 'JPL Planetary Physical Parameters (NASA)',
    },
    institution: 'NASA / Jet Propulsion Laboratory (SSD)',
    url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
    referenceDate: '2024-11-01',
    note: {
      'pt-BR': 'Raio volumétrico médio, massa, densidade e gravidade equatorial (nível de 1 bar para gigantes gasosos).',
      en: 'Mean volumetric radius, mass, bulk density, and equatorial gravity (1-bar level for gas giants).',
    },
  },
  jpl_approx_pos: {
    id: 'jpl_approx_pos',
    title: {
      'pt-BR': 'Posições Planetárias Aproximadas do JPL (Tabela 1)',
      en: 'JPL Approximate Positions of the Planets (Table 1)',
    },
    institution: 'NASA / Jet Propulsion Laboratory (SSD)',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    referenceDate: '2024-11-01',
    note: {
      'pt-BR': 'Elementos keplerianos seculares J2000 válidos de 1800 EC a 2050 EC. Usa o baricentro Terra-Lua para a órbita heliocêntrica terrestre, com separação local explícita.',
      en: 'Secular J2000 Keplerian elements valid from 1800 CE to 2050 CE. Supplies Earth-Moon barycenter with explicit local separation.',
    },
  },
  jpl_satellites: {
    id: 'jpl_satellites',
    title: {
      'pt-BR': 'Parâmetros Físicos e Orbitais de Satélites Planetários (JPL)',
      en: 'Planetary Satellite Physical & Orbital Parameters (JPL)',
    },
    institution: 'NASA / Jet Propulsion Laboratory (SSD)',
    url: 'https://ssd.jpl.nasa.gov/sats/phys_par/',
    referenceDate: '2025-03-15',
    note: {
      'pt-BR': 'Raios médios, massas, períodos orbitais e contagens de luas confirmadas pela UAI/JPL.',
      en: 'Mean radii, masses, orbital periods, and IAU/JPL confirmed satellite counts.',
    },
  },
  nasa_solar_facts: {
    id: 'nasa_solar_facts',
    title: {
      'pt-BR': 'Fatos do Sistema Solar — NASA Science',
      en: 'Solar System Facts — NASA Science',
    },
    institution: 'NASA Science Editorial Team',
    url: 'https://science.nasa.gov/solar-system/solar-system-facts/',
    referenceDate: '2025-03-15',
    note: {
      'pt-BR': 'Contexto geral do sistema, classificações de planetas anões e contagens atualizadas de satélites.',
      en: 'System context, dwarf planet classifications, and updated satellite counts.',
    },
  },
  nasa_comets: {
    id: 'nasa_comets',
    title: {
      'pt-BR': 'Fatos sobre Cometas — NASA Science',
      en: 'Comet Facts — NASA Science',
    },
    institution: 'NASA Science',
    url: 'https://science.nasa.gov/solar-system/comets/facts/',
    referenceDate: '2024-10-01',
    note: {
      'pt-BR': 'Estrutura de núcleo, coma, cauda de poeira curvada e cauda iônica anti-solar.',
      en: 'Nucleus, coma, curved dust tail, and anti-solar ion tail structure.',
    },
  },
  nasa_seasons: {
    id: 'nasa_seasons',
    title: {
      'pt-BR': 'Rotação, Inclinação Axial e Órbita da Terra — NASA',
      en: 'Earth Spin, Tilt, and Orbit — NASA Science',
    },
    institution: 'NASA Science',
    url: 'https://science.nasa.gov/learn/heat/resource/earths-spin-tilt-and-orbit/',
    referenceDate: '2024-09-01',
    note: {
      'pt-BR': 'Geometria de iluminação solar e causa das estações pela obliquidade axial.',
      en: 'Solar illumination geometry and seasonal causation via axial obliquity.',
    },
  },
  nasa_eclipses: {
    id: 'nasa_eclipses',
    title: {
      'pt-BR': 'Eclipses Lunares e Solares — NASA Science',
      en: 'Moon Eclipses — NASA Science',
    },
    institution: 'NASA Science',
    url: 'https://science.nasa.gov/moon/eclipses/?lv=true',
    referenceDate: '2024-10-01',
    note: {
      'pt-BR': 'Distinção física entre fases lunares mensais e alinhamentos nodais de eclipse.',
      en: 'Physical distinction between monthly lunar phases and nodal eclipse alignments.',
    },
  },
};
