import { Language } from '../types/solarSystem';
import { EARTH_MASS_KG, EARTH_RADIUS_KM } from '../engine/ephemeris';

const SUPERSCRIPTS: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function toSuperscript(exp: number): string {
  return String(exp)
    .split('')
    .map((ch) => SUPERSCRIPTS[ch] ?? ch)
    .join('');
}

export function formatNumber(
  value: number | null | undefined,
  lang: Language,
  decimals = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  return new Intl.NumberFormat(lang === 'pt-BR' ? 'pt-BR' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatScientificMass(
  massKg: number | null | undefined,
  lang: Language,
  unitSystem: 'metric' | 'familiar' = 'metric'
): string {
  if (massKg === null || massKg === undefined || !Number.isFinite(massKg) || massKg <= 0) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  const exp = Math.floor(Math.log10(massKg));
  const mantissa = massKg / Math.pow(10, exp);
  const formattedMantissa = formatNumber(mantissa, lang, 3);
  const sci = `${formattedMantissa} × 10${toSuperscript(exp)} kg`;

  if (unitSystem === 'familiar') {
    const earthMasses = massKg / EARTH_MASS_KG;
    const ratioStr =
      earthMasses >= 0.01
        ? formatNumber(earthMasses, lang, 2)
        : earthMasses.toExponential(2);
    const label = lang === 'pt-BR' ? 'M⊕' : 'M⊕';
    return `${sci} (${ratioStr} ${label})`;
  }
  return sci;
}

export function formatDiameter(
  diameterKm: number | null | undefined,
  lang: Language,
  unitSystem: 'metric' | 'familiar' = 'metric'
): string {
  if (diameterKm === null || diameterKm === undefined || !Number.isFinite(diameterKm)) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  const kmStr = `${formatNumber(diameterKm, lang, 1)} km`;
  if (unitSystem === 'familiar') {
    const earthDiameters = diameterKm / (EARTH_RADIUS_KM * 2);
    return `${kmStr} (${formatNumber(earthDiameters, lang, 2)}× ${lang === 'pt-BR' ? 'Terra' : 'Earth'})`;
  }
  return kmStr;
}

export function formatDistanceAuAndKm(
  au: number | null | undefined,
  km: number | null | undefined,
  lang: Language
): string {
  if (au === null || au === undefined || !Number.isFinite(au)) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  const unitAu = lang === 'pt-BR' ? 'UA' : 'AU';
  const auStr = `${formatNumber(au, lang, 3)} ${unitAu}`;
  if (km !== null && km !== undefined && Number.isFinite(km)) {
    if (km >= 1e6) {
      const millions = km / 1e6;
      const mLabel = lang === 'pt-BR' ? 'mi km' : 'M km';
      return `${auStr} (${formatNumber(millions, lang, 2)} ${mLabel})`;
    }
    return `${auStr} (${formatNumber(km, lang, 0)} km)`;
  }
  return auStr;
}

export function formatLightTime(seconds: number, lang: Language): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0 s';
  }
  if (seconds < 60) {
    return `${formatNumber(seconds, lang, 2)} ${lang === 'pt-BR' ? 's-luz' : 'light-sec'}`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s (${lang === 'pt-BR' ? 'tempo-luz' : 'light-time'})`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m (${lang === 'pt-BR' ? 'tempo-luz' : 'light-time'})`;
  }
  const days = seconds / 86400;
  return `${formatNumber(days, lang, 2)} ${lang === 'pt-BR' ? 'dias-luz' : 'light-days'}`;
}

export function formatPeriodDays(
  days: number | null | undefined,
  lang: Language
): string {
  if (days === null || days === undefined || !Number.isFinite(days)) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  const absDays = Math.abs(days);
  if (absDays < 2) {
    const hours = absDays * 24;
    return `${formatNumber(hours, lang, 2)} h (${formatNumber(absDays, lang, 2)} d)`;
  }
  if (absDays > 500) {
    const years = absDays / 365.25;
    const yrLabel = lang === 'pt-BR' ? 'anos julianos' : 'Julian yrs';
    return `${formatNumber(absDays, lang, 1)} d (${formatNumber(years, lang, 2)} ${yrLabel})`;
  }
  return `${formatNumber(absDays, lang, 2)} ${lang === 'pt-BR' ? 'dias' : 'days'}`;
}

export function formatRotationHours(
  hours: number | null | undefined,
  lang: Language
): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  const isRetrograde = hours < 0;
  const absHours = Math.abs(hours);
  const retroBadge = isRetrograde
    ? lang === 'pt-BR'
      ? ' (retrógrada)'
      : ' (retrograde)'
    : '';
  if (absHours >= 72) {
    const days = absHours / 24;
    return `${formatNumber(absHours, lang, 1)} h (${formatNumber(days, lang, 2)} d)${retroBadge}`;
  }
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  return `${h}h ${m}m (${formatNumber(absHours, lang, 2)} h)${retroBadge}`;
}

export function formatTemperatureK(
  kelvin: number | null | undefined,
  lang: Language
): string {
  if (kelvin === null || kelvin === undefined || !Number.isFinite(kelvin)) {
    return lang === 'pt-BR' ? 'Não aplicável' : 'Not applicable';
  }
  const celsius = Math.round(kelvin - 273.15);
  return `${formatNumber(kelvin, lang, 0)} K (${celsius >= 0 ? '+' : ''}${celsius} °C)`;
}

export function formatSimulationDateUtc(simTimeMs: number, lang: Language): string {
  if (!Number.isFinite(simTimeMs)) return 'UTC';
  const d = new Date(simTimeMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  const secs = String(d.getUTCSeconds()).padStart(2, '0');
  if (lang === 'pt-BR') {
    return `${day}/${month}/${year} ${hours}:${mins}:${secs} UTC`;
  }
  return `${year}-${month}-${day} ${hours}:${mins}:${secs} UTC`;
}

export function formatTimeRatePhrase(
  speedMultiplier: number,
  direction: 1 | -1,
  paused: boolean,
  lang: Language
): { multiplierText: string; phraseText: string } {
  const sign = direction < 0 ? '−' : '';
  const absRate = Math.max(0, speedMultiplier);
  const multiplierText = `${sign}${formatNumber(absRate, lang, absRate < 10 ? 1 : 0)}×`;

  let unitPhrase = '';
  if (absRate === 0) {
    unitPhrase = lang === 'pt-BR' ? '0 s/s (Parado)' : '0 s/s (Zero rate)';
  } else if (Math.abs(absRate - 1) < 0.01) {
    unitPhrase = lang === 'pt-BR' ? '1 seg simulado / s (Tempo real)' : '1 sim sec / s (Real time)';
  } else if (Math.abs(absRate - 60) < 1) {
    unitPhrase = lang === 'pt-BR' ? '1 min por segundo' : '1 min per second';
  } else if (Math.abs(absRate - 3600) < 10) {
    unitPhrase = lang === 'pt-BR' ? '1 hora por segundo' : '1 hour per second';
  } else if (Math.abs(absRate - 86400) < 100) {
    unitPhrase = lang === 'pt-BR' ? '1 dia por segundo' : '1 day per second';
  } else if (Math.abs(absRate - 604800) < 500) {
    unitPhrase = lang === 'pt-BR' ? '1 semana por segundo' : '1 week per second';
  } else if (Math.abs(absRate - 2592000) < 1000) {
    unitPhrase = lang === 'pt-BR' ? '30 dias (mês demo) / s' : '30 days (demo month) / s';
  } else if (Math.abs(absRate - 31557600) < 5000) {
    unitPhrase = lang === 'pt-BR' ? '1 ano juliano (365,25 d) / s' : '1 Julian year (365.25 d) / s';
  } else if (absRate < 3600) {
    unitPhrase = `${formatNumber(absRate, lang, 0)} ${lang === 'pt-BR' ? 's/s' : 's/s'}`;
  } else if (absRate < 86400) {
    unitPhrase = `${formatNumber(absRate / 3600, lang, 1)} ${lang === 'pt-BR' ? 'horas/s' : 'hours/s'}`;
  } else {
    unitPhrase = `${formatNumber(absRate / 86400, lang, 1)} ${lang === 'pt-BR' ? 'dias/s' : 'days/s'}`;
  }

  const dirPrefix =
    direction < 0
      ? lang === 'pt-BR'
        ? 'Reverso: '
        : 'Reverse: '
      : '';

  const phraseText = paused
    ? lang === 'pt-BR'
      ? `Pausado (retoma em ${dirPrefix}${unitPhrase})`
      : `Paused (resumes at ${dirPrefix}${unitPhrase})`
    : `${dirPrefix}${unitPhrase}`;

  return { multiplierText, phraseText };
}
