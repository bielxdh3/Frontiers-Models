/** Pure scientific helpers. No DOM and no Three.js. */

export const J2000_JD = 2451545.0;
export const UNIX_EPOCH_JD = 2440587.5;
export const AU_KM = 149597870.7;
export const C_KM_S = 299792.458;
export const G_SI = 6.6743e-11;
export const DAY_SECONDS = 86400;
export const JULIAN_YEAR_DAYS = 365.25;
export const WEEK_SECONDS = 7 * DAY_SECONDS;
export const DEMO_MONTH_SECONDS = 30 * DAY_SECONDS;
export const SESSION_JD = Date.UTC(2026, 0, 1, 12, 0, 0) / 86400000 + UNIX_EPOCH_JD;
export const JD_PRIMARY_START = Date.UTC(1800, 0, 1) / 86400000 + UNIX_EPOCH_JD;
export const JD_PRIMARY_END = Date.UTC(2050, 0, 1) / 86400000 + UNIX_EPOCH_JD;
export const REL_UNITS_PER_AU = 10;
export const MAX_RATE = 5e7;

const DEG = Math.PI / 180;

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const norm = (a) => {
  const l = len(a);
  return l ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 };
};

export function jdToUnixMs(jd) {
  return (jd - UNIX_EPOCH_JD) * 86400000;
}

export function unixMsToJd(ms) {
  return ms / 86400000 + UNIX_EPOCH_JD;
}

/** Proleptic Gregorian calendar to Julian Date. Hour is UTC. */
export function gregorianToJd(year, month, day, hour = 0) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const dayFrac = day + hour / 24;
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFrac + B - 1524.5;
}

export const JD_EXTENDED_START = gregorianToJd(-2999, 1, 1, 0);
export const JD_EXTENDED_END = gregorianToJd(3000, 1, 1, 0);

export function wrap180(deg) {
  const x = (((deg + 180) % 360) + 360) % 360;
  return x - 180;
}

export function wrap360(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Solve M = E − e sin E with M in degrees and e dimensionless.
 * Follows the JPL approximate-position iteration, implemented in radians.
 */
export function solveKepler(meanAnomalyDeg, eccentricity, { maxIter = 30, tolDeg = 1e-6 } = {}) {
  if (!Number.isFinite(meanAnomalyDeg) || !Number.isFinite(eccentricity)) {
    return { ok: false, reason: 'nonfinite', Edeg: NaN, Erad: NaN, iterations: 0 };
  }
  if (eccentricity < 0 || eccentricity >= 1) {
    return { ok: false, reason: 'eccentricity', Edeg: NaN, Erad: NaN, iterations: 0 };
  }
  const M = wrap180(meanAnomalyDeg) * DEG;
  let E = M + eccentricity * Math.sin(M);
  for (let i = 0; i < maxIter; i += 1) {
    const dM = M - (E - eccentricity * Math.sin(E));
    const denom = 1 - eccentricity * Math.cos(E);
    if (Math.abs(denom) < 1e-12) {
      return { ok: false, reason: 'denominator', Edeg: E / DEG, Erad: E, iterations: i + 1 };
    }
    const dE = dM / denom;
    E += dE;
    if (Math.abs(dE) <= tolDeg * DEG) {
      return { ok: true, Edeg: E / DEG, Erad: E, iterations: i + 1 };
    }
  }
  return { ok: false, reason: 'iteration', Edeg: E / DEG, Erad: E, iterations: maxIter };
}

/** Ecliptic coordinates (AU) from classical elements. Angles in degrees. */
export function orbitAtMeanAnomaly({ a, e, iDeg, varpiDeg, omegaNodeDeg, meanAnomalyDeg }) {
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(e)) {
    return { ok: false, reason: 'elements', au: null };
  }
  const solved = solveKepler(meanAnomalyDeg, e);
  if (!Number.isFinite(solved.Erad)) return { ok: false, reason: solved.reason, au: null, solved };
  const E = solved.Erad;
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xp = a * (cosE - e);
  const yp = a * Math.sqrt(Math.max(0, 1 - e * e)) * sinE;
  const w = (varpiDeg - omegaNodeDeg) * DEG;
  const O = omegaNodeDeg * DEG;
  const I = iDeg * DEG;
  const cosw = Math.cos(w);
  const sinw = Math.sin(w);
  const cosO = Math.cos(O);
  const sinO = Math.sin(O);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);
  const x = (cosw * cosO - sinw * sinO * cosI) * xp + (-sinw * cosO - cosw * sinO * cosI) * yp;
  const y = (cosw * sinO + sinw * cosO * cosI) * xp + (-sinw * sinO + cosw * cosO * cosI) * yp;
  const z = sinw * sinI * xp + cosw * sinI * yp;
  return { ok: solved.ok, reason: solved.ok ? null : solved.reason, au: { x, y, z }, solved, a, e };
}

export function jplElementsAt(el, jd) {
  const T = (jd - J2000_JD) / 36525;
  return {
    a: el.a0 + el.adot * T,
    e: el.e0 + el.edot * T,
    iDeg: el.I0 + el.Idot * T,
    L: el.L0 + el.Ldot * T,
    varpiDeg: el.w0 + el.wdot * T,
    omegaNodeDeg: el.O0 + el.Odot * T,
    T,
  };
}

export function jplPosition(el, jd, extra = null) {
  if (!Number.isFinite(jd)) return { ok: false, reason: 'nonfinite', au: null };
  const k = jplElementsAt(el, jd);
  let M = k.L - k.varpiDeg;
  if (extra) {
    const fT = extra.f * k.T * DEG;
    M += extra.b * k.T * k.T + extra.c * Math.cos(fT) + extra.s * Math.sin(fT);
  }
  const pos = orbitAtMeanAnomaly({
    a: k.a,
    e: k.e,
    iDeg: k.iDeg,
    varpiDeg: k.varpiDeg,
    omegaNodeDeg: k.omegaNodeDeg,
    meanAnomalyDeg: M,
  });
  return { ...pos, elements: { ...k, M } };
}

export function simplePosition(el, jd) {
  if (!Number.isFinite(jd)) return { ok: false, reason: 'nonfinite', au: null };
  const days = jd - J2000_JD;
  const periodDays = el.periodYears * JULIAN_YEAR_DAYS;
  const M = el.M0 + (360 * days) / periodDays;
  return orbitAtMeanAnomaly({
    a: el.a,
    e: el.e,
    iDeg: el.i,
    varpiDeg: el.varpi,
    omegaNodeDeg: el.Omega,
    meanAnomalyDeg: M,
  });
}

export function modelPeriodDaysFromLdot(ldotDegPerCentury) {
  return (360 * 36525) / ldotDegPerCentury;
}

export function circularOffset(orbit, jd, epochJd = J2000_JD) {
  const i = orbit.inclinationDeg * DEG;
  const direction = orbit.retrograde ? -1 : 1;
  const theta = orbit.phaseDeg * DEG + direction * ((2 * Math.PI) / orbit.periodDays) * (jd - epochJd);
  const r = orbit.radiusKm / AU_KM;
  const x = r * Math.cos(theta);
  const yPlane = r * Math.sin(theta);
  return {
    au: { x, y: yPlane * Math.cos(i), z: yPlane * Math.sin(i) },
    theta,
  };
}

/** Ecliptic +Z (north) becomes scene +Y. Scene +Z is ecliptic −Y. */
export function eclipticToScene(v) {
  return { x: v.x, y: v.z, z: -v.y };
}

export function exploreDistance(au) {
  return 36 * Math.log10(1 + Math.abs(au) * 11);
}

export function displayRadius(radiusKm, scaleMode) {
  if (scaleMode === 'relative') return (radiusKm / AU_KM) * REL_UNITS_PER_AU;
  if (radiusKm > 200000) return 4.6;
  const scaled = (radiusKm / 6378.1366) ** 0.4 * 0.9;
  return Math.max(0.15, Math.min(2.55, scaled));
}

export function localDisplayDistance(distanceKm, parentRadiusScene) {
  return parentRadiusScene * 3.1 + 2.15 * Math.log10(1 + distanceKm / 20000);
}

export function mapHeliocentric(auVec, scaleMode) {
  const scene = eclipticToScene(auVec);
  const r = len(scene);
  if (r < 1e-14) return { x: 0, y: 0, z: 0 };
  if (scaleMode === 'relative') return scale(scene, REL_UNITS_PER_AU);
  return scale(scene, exploreDistance(r) / r);
}

export function mapLocal(relAu, parentRadiusKm, scaleMode) {
  const scene = eclipticToScene(relAu);
  const r = len(scene);
  if (r < 1e-16) return { x: 0, y: 0, z: 0, exaggerated: true };
  const parentR = displayRadius(parentRadiusKm, scaleMode);
  const dist = localDisplayDistance(r * AU_KM, parentR);
  return { ...scale(scene, dist / r), exaggerated: true, parentRadiusScene: parentR, displayDistance: dist };
}

export function illumination(bodyAu, outwardNormal) {
  const toSun = norm(scale(bodyAu, -1));
  return dot(outwardNormal, toSun);
}

export function geometricDistanceKm(a, b) {
  if (!a || !b) return { ok: false, reason: 'missing' };
  const dAu = len(sub(a, b));
  if (!Number.isFinite(dAu)) return { ok: false, reason: 'nonfinite' };
  return { ok: true, au: dAu, km: dAu * AU_KM };
}

export function lightTimeSeconds(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return { ok: false, reason: 'invalid' };
  return { ok: true, seconds: distanceKm / C_KM_S };
}

export function surfaceSeparationKm(centerKm, radiusA, radiusB) {
  if (![centerKm, radiusA, radiusB].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, km: centerKm - radiusA - radiusB, radiusBasis: 'equatorial' };
}

export function angularSeparation(observer, a, b) {
  if (!observer || !a || !b) return { ok: false, reason: 'missing' };
  const va = sub(a, observer);
  const vb = sub(b, observer);
  if (len(va) < 1e-10 || len(vb) < 1e-10) return { ok: false, reason: 'degenerate' };
  const c = Math.min(1, Math.max(-1, dot(norm(va), norm(vb))));
  const radians = Math.acos(c);
  return { ok: true, radians, degrees: radians / DEG };
}

export function lunarPhase(sun, earth, moon) {
  const toSun = norm(sub(sun, moon));
  const toEarth = norm(sub(earth, moon));
  const phaseCos = Math.min(1, Math.max(-1, dot(toSun, toEarth)));
  const phaseAngle = Math.acos(phaseCos);
  const illuminated = (1 + Math.cos(phaseAngle)) / 2;
  const es = norm(sub(sun, earth));
  const em = norm(sub(moon, earth));
  const elongation = Math.atan2(cross(es, em).z, dot(es, em));
  return {
    phaseAngleDeg: phaseAngle / DEG,
    illuminated,
    elongationDeg: elongation / DEG,
  };
}

export function phaseIdFromElongation(elongationDeg) {
  const x = wrap360(elongationDeg);
  if (x < 22.5 || x >= 337.5) return 'new';
  if (x < 67.5) return 'waxing-crescent';
  if (x < 112.5) return 'first-quarter';
  if (x < 157.5) return 'waxing-gibbous';
  if (x < 202.5) return 'full';
  if (x < 247.5) return 'waning-gibbous';
  if (x < 292.5) return 'third-quarter';
  return 'waning-crescent';
}

export function sphereGravity(massKg, radiusKm) {
  const r = radiusKm * 1000;
  if (!(massKg > 0) || !(r > 0)) return { ok: false, reason: 'invalid' };
  return { ok: true, g: (G_SI * massKg) / (r * r) };
}

export function weightNewtons(massKg, g) {
  if (!(massKg >= 0) || !Number.isFinite(g)) return { ok: false, reason: 'invalid' };
  return { ok: true, newtons: massKg * g };
}

export function keplerPeriodSeconds(semiMajorKm, centralMassKg) {
  const a = semiMajorKm * 1000;
  if (!(a > 0) || !(centralMassKg > 0)) return { ok: false, reason: 'invalid' };
  return { ok: true, seconds: 2 * Math.PI * Math.sqrt(a ** 3 / (G_SI * centralMassKg)) };
}

export function visViva(semiMajorKm, radiusKm, centralMassKg) {
  const a = semiMajorKm * 1000;
  const r = radiusKm * 1000;
  if (!(a > 0) || !(r > 0) || !(centralMassKg > 0)) return { ok: false, reason: 'invalid' };
  const v2 = G_SI * centralMassKg * (2 / r - 1 / a);
  if (v2 < 0) return { ok: false, reason: 'unbound' };
  return { ok: true, mps: Math.sqrt(v2) };
}

export function ellipseApsisKm(semiMajorKm, eccentricity) {
  if (!(semiMajorKm > 0) || eccentricity < 0 || eccentricity >= 1) return { ok: false, reason: 'invalid' };
  return {
    ok: true,
    periapsisKm: semiMajorKm * (1 - eccentricity),
    apoapsisKm: semiMajorKm * (1 + eccentricity),
  };
}

export function daylightHours({ tiltDeg, orbitDeg, latitudeDeg }) {
  const tilt = tiltDeg * DEG;
  const lat = latitudeDeg * DEG;
  const decl = tilt * Math.cos(orbitDeg * DEG);
  const x = -Math.tan(lat) * Math.tan(decl);
  const assumptions = {
    pt: 'Horizonte geométrico, Sol pontual, sem refração atmosférica, órbita circular simplificada.',
    en: 'Geometric horizon, point-like Sun, no atmospheric refraction, simplified circular orbit.',
  };
  if (!Number.isFinite(x)) return { ok: false, reason: 'undefined', assumptions };
  if (x <= -1) return { ok: true, hours: 24, kind: 'polar-day', assumptions };
  if (x >= 1) return { ok: true, hours: 0, kind: 'polar-night', assumptions };
  const H = Math.acos(x);
  return { ok: true, hours: (H / Math.PI) * 24, kind: 'regular', assumptions };
}

export function temperatureRatioK(a, b) {
  if (!(a > 0) || !(b > 0)) return { ok: false, reason: 'absolute-required' };
  return { ok: true, ratio: a / b, scale: 'kelvin' };
}

export function cometActivity(distanceAu) {
  if (!Number.isFinite(distanceAu)) return 0;
  const bright = Math.exp(-((distanceAu - 0.8) ** 2) / (2 * 0.9 ** 2));
  return Math.min(1, Math.max(0.04, bright));
}

export function parseRate(raw) {
  if (raw == null) return { ok: false, reason: 'empty' };
  let s = String(raw).trim().replace(/\s/g, '').replace(/×/g, '');
  if (!s) return { ok: false, reason: 'empty' };
  if (/x$/i.test(s)) s = s.slice(0, -1);
  if (s.includes(',') && s.includes('.')) return { ok: false, reason: 'format' };
  s = s.replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return { ok: false, reason: 'format' };
  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, reason: 'nonfinite' };
  if (Math.abs(value) > MAX_RATE) return { ok: false, reason: 'range' };
  return { ok: true, value };
}

export function sliderToSignedRate(position) {
  const dead = 14;
  const d = position - 500;
  if (Math.abs(d) <= dead) return 0;
  const sign = d > 0 ? 1 : -1;
  const t = (Math.abs(d) - dead) / (500 - dead);
  const mag = 10 ** (t * Math.log10(MAX_RATE));
  return sign * Math.max(1, mag);
}

export function signedRateToSlider(rate) {
  if (!rate) return 500;
  const sign = rate < 0 ? -1 : 1;
  const mag = Math.min(MAX_RATE, Math.max(1, Math.abs(rate)));
  const t = Math.log10(mag) / Math.log10(MAX_RATE);
  return 500 + sign * (14 + t * (500 - 14));
}

export function shouldClearTrail(previousJd, nextJd, ratePerSecond, realDt) {
  if (!Number.isFinite(previousJd) || !Number.isFinite(nextJd)) return true;
  const actual = Math.abs(nextJd - previousJd);
  const expected = Math.abs((ratePerSecond * realDt) / DAY_SECONDS);
  return actual > Math.max(0.5, expected * 5 + 0.02);
}

export function clampJd(jd, allowExtended) {
  const lo = allowExtended ? JD_EXTENDED_START : JD_PRIMARY_START;
  const hi = allowExtended ? JD_EXTENDED_END : JD_PRIMARY_END;
  if (jd < lo || jd > hi) {
    return {
      jd: Math.min(hi, Math.max(lo, jd)),
      hit: true,
      kind: allowExtended ? 'hard' : 'primary',
    };
  }
  return { jd, hit: false, kind: null };
}

export function addCalendarMonths(jd, deltaMonths) {
  const d = new Date(jdToUnixMs(jd));
  const day = d.getUTCDate();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + deltaMonths, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const dim = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, dim));
  return unixMsToJd(next.getTime());
}

export function axisPosition(value, { mode, min, max, length }) {
  if (!(length > 0) || !(max > min)) return NaN;
  if (mode === 'log') {
    if (!(value > 0) || !(min > 0) || !(max > 0)) return NaN;
    const a = Math.log10(min);
    const b = Math.log10(max);
    return ((Math.log10(value) - a) / (b - a)) * length;
  }
  return ((value - min) / (max - min)) * length;
}

export function earthIfSize(earthDiameterMm, radiusEqKm, semiMajorAu) {
  if (!(earthDiameterMm > 0)) return { ok: false, reason: 'invalid' };
  const earthDiameterKm = 6378.1366 * 2;
  const kmPerMm = earthDiameterKm / earthDiameterMm;
  return {
    ok: true,
    diameterMm: (radiusEqKm * 2) / kmPerMm,
    sunDistanceMm: semiMajorAu == null ? null : (semiMajorAu * AU_KM) / kmPerMm,
    kmPerMm,
  };
}

export function densityFromMassRadius(massKg, radiusMeanKm) {
  const r = radiusMeanKm * 1000;
  if (!(massKg > 0) || !(r > 0)) return { ok: false };
  const volume = (4 / 3) * Math.PI * r ** 3;
  const kgM3 = massKg / volume;
  return { ok: true, gCm3: kgM3 / 1000, kgM3 };
}

export function locTag(lang) {
  return lang === 'en' ? 'en-US' : 'pt-BR';
}

export function formatNumber(value, lang, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locTag(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatSci(value, lang, digits = 4) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.01 || abs >= 1e6)) {
    return new Intl.NumberFormat(locTag(lang), {
      notation: 'scientific',
      maximumSignificantDigits: digits,
    }).format(value);
  }
  return formatNumber(value, lang, digits);
}

export function formatDuration(seconds, lang) {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.abs(seconds);
  if (s < 90) return `${formatNumber(s, lang, 1)} s`;
  if (s < 5400) return `${formatNumber(s / 60, lang, 1)} min`;
  if (s < 172800) return `${formatNumber(s / 3600, lang, 2)} h`;
  return `${formatNumber(s / DAY_SECONDS, lang, 2)} ${lang === 'en' ? 'days' : 'dias'}`;
}

export function formatJdUtc(jd, lang) {
  if (!Number.isFinite(jd)) return '—';
  const d = new Date(jdToUnixMs(jd));
  if (Number.isNaN(d.getTime())) return '—';
  const date = new Intl.DateTimeFormat(locTag(lang), {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return `${date} UTC`;
}

export function approximateSolarDay(siderealDays, orbitalDays) {
  const s = Math.abs(siderealDays);
  const y = Math.abs(orbitalDays);
  const denom = 1 - s / y;
  if (!(s > 0) || !(y > 0) || Math.abs(denom) < 1e-8) return { ok: false, reason: 'undefined' };
  return { ok: true, days: s / denom, progradeApproximation: true };
}

export function velocityAuPerDay(positionFn, jd) {
  const h = 0.01;
  const a = positionFn(jd - h);
  const b = positionFn(jd + h);
  if (!a?.au || !b?.au) return { ok: false, reason: 'position' };
  return { ok: true, auPerDay: scale(sub(b.au, a.au), 1 / (2 * h)) };
}

export function auPerDayToKmS(v) {
  return scale(v, AU_KM / DAY_SECONDS);
}

export function bulkStatus(value, status) {
  if (status === 'na' || status === 'unknown' || status === 'unavailable' || status === 'disputed') {
    return { status, value: null };
  }
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) {
    return { status: status || 'unavailable', value: null };
  }
  return { status: 'known', value };
}
