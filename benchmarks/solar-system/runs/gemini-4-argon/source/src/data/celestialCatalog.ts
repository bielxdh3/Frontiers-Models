import { CelestialBodyData, Language } from '../types/solarSystem';
import { PLANETS_AND_STAR } from './planetsAndStar';
import { MOONS_AND_SMALL_BODIES } from './moonsAndSmallBodies';

export const CELESTIAL_CATALOG: CelestialBodyData[] = [
  ...PLANETS_AND_STAR,
  ...MOONS_AND_SMALL_BODIES,
];

export const CATALOG_BY_ID: Record<string, CelestialBodyData> = Object.fromEntries(
  CELESTIAL_CATALOG.map((body) => [body.id, body])
);

export function getBodyById(id: string): CelestialBodyData | undefined {
  return CATALOG_BY_ID[id];
}

export function getChildMoons(parentId: string): CelestialBodyData[] {
  return CELESTIAL_CATALOG.filter(
    (body) => body.parentId === parentId && body.category === 'moon'
  );
}

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function searchCatalog(
  query: string,
  categoryFilter: string = 'all'
): CelestialBodyData[] {
  const normalized = normalizeSearchText(query);
  return CELESTIAL_CATALOG.filter((body) => {
    if (categoryFilter !== 'all' && body.category !== categoryFilter) {
      return false;
    }
    if (!normalized) return true;
    const ptName = normalizeSearchText(body.name['pt-BR']);
    const enName = normalizeSearchText(body.name.en);
    const idNorm = normalizeSearchText(body.id);
    const subtypePt = normalizeSearchText(body.subtype['pt-BR']);
    const subtypeEn = normalizeSearchText(body.subtype.en);
    const aliasMatch = body.aliases.some((alias) =>
      normalizeSearchText(alias).includes(normalized)
    );
    return (
      ptName.includes(normalized) ||
      enName.includes(normalized) ||
      idNorm.includes(normalized) ||
      subtypePt.includes(normalized) ||
      subtypeEn.includes(normalized) ||
      aliasMatch
    );
  });
}

export const CURATED_COMPARISON_PAIRS: Array<{
  id: string;
  label: Record<Language, string>;
  bodyIds: string[];
}> = [
  {
    id: 'earth_mars',
    label: { 'pt-BR': 'Terra vs. Marte', en: 'Earth vs. Mars' },
    bodyIds: ['earth', 'mars'],
  },
  {
    id: 'earth_venus',
    label: { 'pt-BR': 'Terra vs. Vênus', en: 'Earth vs. Venus' },
    bodyIds: ['earth', 'venus'],
  },
  {
    id: 'jupiter_saturn',
    label: { 'pt-BR': 'Júpiter vs. Saturno', en: 'Jupiter vs. Saturn' },
    bodyIds: ['jupiter', 'saturn'],
  },
  {
    id: 'earth_moon',
    label: { 'pt-BR': 'Terra vs. Lua', en: 'Earth vs. Moon' },
    bodyIds: ['earth', 'moon'],
  },
  {
    id: 'pluto_charon',
    label: { 'pt-BR': 'Plutão vs. Caronte', en: 'Pluto vs. Charon' },
    bodyIds: ['pluto', 'charon'],
  },
  {
    id: 'four_giants',
    label: { 'pt-BR': 'Os Quatro Gigantes', en: 'The Four Giants' },
    bodyIds: ['jupiter', 'saturn', 'uranus', 'neptune'],
  },
];

export const LOCAL_SYSTEM_PRESETS: Array<{
  id: string;
  parentId: string;
  focusId: string;
  label: Record<Language, string>;
  description: Record<Language, string>;
}> = [
  {
    id: 'earth_moon_pair',
    parentId: 'earth',
    focusId: 'moon',
    label: { 'pt-BR': 'Sistema Terra–Lua', en: 'Earth–Moon Pair' },
    description: {
      'pt-BR': 'A Terra e seu único satélite natural em rotação síncrona.',
      en: 'Earth and its single tidally locked natural satellite.',
    },
  },
  {
    id: 'jupiter_galilean',
    parentId: 'jupiter',
    focusId: 'jupiter',
    label: { 'pt-BR': 'Júpiter e Luas Galileanas', en: 'Jupiter & 4 Galilean Moons' },
    description: {
      'pt-BR': 'Io, Europa, Ganimedes e Calisto em órbita ao redor do maior gigante gasoso.',
      en: 'Io, Europa, Ganymede, and Callisto orbiting the largest gas giant.',
    },
  },
  {
    id: 'saturn_titan_enceladus',
    parentId: 'saturn',
    focusId: 'saturn',
    label: { 'pt-BR': 'Saturno, Anéis, Titã e Encélado', en: 'Saturn, Rings, Titan & Enceladus' },
    description: {
      'pt-BR': 'O sistema de anéis de gelo acompanhado por Titã e Encélado.',
      en: 'The icy ring system accompanied by hazy Titan and cryovolcanic Enceladus.',
    },
  },
  {
    id: 'pluto_charon_pair',
    parentId: 'pluto',
    focusId: 'pluto',
    label: { 'pt-BR': 'Par Plutão–Caronte', en: 'Pluto–Charon Pair' },
    description: {
      'pt-BR': 'O par binário em travamento de maré mútuo no Cinturão de Kuiper.',
      en: 'The mutually tidally locked binary-like pair in the Kuiper Belt.',
    },
  },
];
