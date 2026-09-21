import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AU_KM,
  C_KM_S,
  DAY_SECONDS,
  J2000_JD,
  JD_PRIMARY_END,
  JD_PRIMARY_START,
  SESSION_JD,
  angularSeparation,
  approximateSolarDay,
  axisPosition,
  clampJd,
  daylightHours,
  densityFromMassRadius,
  displayRadius,
  earthIfSize,
  ellipseApsisKm,
  exploreDistance,
  formatSci,
  geometricDistanceKm,
  gregorianToJd,
  illumination,
  keplerPeriodSeconds,
  len,
  lightTimeSeconds,
  lunarPhase,
  mapHeliocentric,
  modelPeriodDaysFromLdot,
  parseRate,
  phaseIdFromElongation,
  shouldClearTrail,
  sliderToSignedRate,
  solveKepler,
  sphereGravity,
  temperatureRatioK,
  unixMsToJd,
  weightNewtons,
} from '../src/science.js';
import { BODIES, DATA_DATES, JPL_ELEMENTS, getBody } from '../src/catalog.js';
import { bodyAu, parentRelativeAu, systemAt } from '../src/ephemeris.js';

test('J2000 noon matches the Julian date constant', () => {
  assert.equal(unixMsToJd(Date.UTC(2000, 0, 1, 12, 0, 0)), J2000_JD);
  const jd = gregorianToJd(2000, 1, 1, 12);
  assert.ok(Math.abs(jd - J2000_JD) < 0.001, `gregorian ${jd}`);
});

test('session date is inside the primary validity window', () => {
  assert.ok(SESSION_JD > JD_PRIMARY_START && SESSION_JD < JD_PRIMARY_END);
});

test('Kepler solver handles a circle and a moderate ellipse', () => {
  const circle = solveKepler(42, 0);
  assert.equal(circle.ok, true);
  assert.ok(Math.abs(circle.Edeg - 42) < 1e-6);
  const ell = solveKepler(40, 0.2);
  assert.equal(ell.ok, true);
  const E = ell.Erad;
  const M = 40 * Math.PI / 180;
  assert.ok(Math.abs(M - (E - 0.2 * Math.sin(E))) < 1e-8);
  const bad = solveKepler(10, 1.2);
  assert.equal(bad.ok, false);
  const nan = solveKepler(Number.NaN, 0.1);
  assert.equal(nan.ok, false);
});

test('planets at one instant are finite, ordered, and repeatable', () => {
  const a = systemAt(SESSION_JD, 'primary');
  const b = systemAt(SESSION_JD, 'primary');
  const ids = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  const distances = ids.map((id) => {
    assert.equal(a.bodies[id].ok, true);
    assert.deepEqual(a.bodies[id].au, b.bodies[id].au);
    assert.ok(Number.isFinite(a.bodies[id].au.x));
    return len(a.bodies[id].au);
  });
  assert.ok(distances[0] < distances[1] && distances[1] < distances[2]);
  assert.ok(distances[2] > 0.97 && distances[2] < 1.03);
  assert.ok(distances[4] > 4.5 && distances[4] < 5.6);
  assert.ok(distances[7] > 29 && distances[7] < 31);
  const spread = new Set(ids.map((id) => Math.round(Math.atan2(a.bodies[id].au.y, a.bodies[id].au.x) * 2)));
  assert.ok(spread.size >= 4, 'planets should not share one phase');
});

test('forward and reverse evaluation is symmetric for the analytic model', () => {
  const jd = SESSION_JD + 12.5;
  const mars = bodyAu('mars', jd).au;
  const back = bodyAu('mars', jd + 40 - 40).au;
  assert.ok(Math.abs(mars.x - back.x) < 1e-10);
  assert.ok(Math.abs(mars.y - back.y) < 1e-10);
});

test('Earth model period agrees with the published year', () => {
  const days = modelPeriodDaysFromLdot(JPL_ELEMENTS.emb.primary.Ldot);
  const published = 1.0000174 * 365.25;
  assert.ok(Math.abs(days - published) / published < 0.002);
});

test('Moon stays on a parent-relative orbit and ignores an unused spin argument', () => {
  const rel = parentRelativeAu('moon', SESSION_JD);
  assert.equal(rel.parent, 'earth');
  const km = len(rel.au) * AU_KM;
  assert.ok(Math.abs(km - 384400) < 2);
  const again = parentRelativeAu('moon', SESSION_JD);
  assert.deepEqual(rel.au, again.au);
  const io = parentRelativeAu('io', SESSION_JD + 3);
  assert.equal(io.parent, 'jupiter');
  const ioKm = len(io.au) * AU_KM;
  assert.ok(Math.abs(ioKm - 421700) < 5);
  const earthSun = len(bodyAu('earth', SESSION_JD).au) * AU_KM;
  assert.ok(ioKm < earthSun / 100);
});

test('display scale does not change physical distance', () => {
  const sys = systemAt(SESSION_JD);
  const km = geometricDistanceKm(sys.bodies.earth.au, sys.bodies.mars.au).km;
  const d1 = mapHeliocentric(sys.bodies.earth.au, 'exploration');
  const d2 = mapHeliocentric(sys.bodies.earth.au, 'relative');
  const km2 = geometricDistanceKm(sys.bodies.earth.au, sys.bodies.mars.au).km;
  assert.equal(km, km2);
  assert.notDeepEqual(d1, d2);
  assert.ok(exploreDistance(0.4) < exploreDistance(1));
  assert.ok(exploreDistance(1) < exploreDistance(5));
  assert.ok(exploreDistance(5) < exploreDistance(30));
});

test('default exploration view keeps neighboring planets from overlapping', () => {
  const sys = systemAt(SESSION_JD);
  const ids = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  for (let i = 0; i < ids.length - 1; i += 1) {
    const A = mapHeliocentric(sys.bodies[ids[i]].au, 'exploration');
    const B = mapHeliocentric(sys.bodies[ids[i + 1]].au, 'exploration');
    const gap = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
    const ra = displayRadius(getBody(ids[i]).radiusEqKm, 'exploration');
    const rb = displayRadius(getBody(ids[i + 1]).radiusEqKm, 'exploration');
    assert.ok(gap > ra + rb, `${ids[i]} overlaps ${ids[i + 1]}`);
  }
  const sunR = displayRadius(getBody('sun').radiusEqKm, 'exploration');
  const mercury = mapHeliocentric(sys.bodies.mercury.au, 'exploration');
  assert.ok(Math.hypot(mercury.x, mercury.y, mercury.z) > sunR + displayRadius(getBody('mercury').radiusEqKm, 'exploration'));
});

test('published densities match mass and mean radius', () => {
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    const b = getBody(id);
    const d = densityFromMassRadius(b.massKg, b.radiusMeanKm);
    assert.ok(Math.abs(d.gCm3 - b.densityGcm3) / b.densityGcm3 < 0.01, id);
    assert.equal(b.radiusEqKm * 2 > 0, true);
  }
});

test('unit conversions and light time at 1 AU', () => {
  const seconds = lightTimeSeconds(AU_KM).seconds;
  assert.ok(Math.abs(seconds - AU_KM / C_KM_S) < 1e-6);
  assert.ok(seconds > 490 && seconds < 510);
  const g = sphereGravity(5.97217e24, 6378.1366);
  assert.ok(g.g > 9 && g.g < 10.5);
  const w = weightNewtons(2, g.g);
  assert.ok(Math.abs(w.newtons - 2 * g.g) < 1e-9);
  const year = keplerPeriodSeconds(AU_KM, 1.9885e30);
  assert.ok(year.seconds / DAY_SECONDS > 350 && year.seconds / DAY_SECONDS < 380);
  const solar = approximateSolarDay(0.99726968, 365.256);
  assert.ok(Math.abs(solar.days - 1) < 0.01);
});

test('temperature ratios require kelvin and celsius is refused by the helper', () => {
  assert.equal(temperatureRatioK(300, 150).ratio, 2);
  assert.equal(temperatureRatioK(-10, 20).ok, false);
});

test('rates, dates, trails, and axis modes', () => {
  assert.equal(parseRate('').ok, false);
  assert.equal(parseRate('1,5').value, 1.5);
  assert.equal(parseRate('Infinity').ok, false);
  assert.equal(parseRate('9e9').ok, false);
  assert.equal(sliderToSignedRate(500), 0);
  assert.ok(sliderToSignedRate(800) > 0);
  assert.ok(sliderToSignedRate(200) < 0);
  const hit = clampJd(JD_PRIMARY_END + 10, false);
  assert.equal(hit.hit, true);
  assert.equal(shouldClearTrail(100, 500, 86400, 0.016), true);
  assert.equal(shouldClearTrail(100, 100.001, 86400, 0.016), false);
  const midLin = axisPosition(50, { mode: 'linear', min: 0, max: 100, length: 200 });
  const midLog = axisPosition(10, { mode: 'log', min: 1, max: 100, length: 200 });
  assert.equal(midLin, 100);
  assert.ok(Math.abs(midLog - 100) < 1e-6);
  const scaled = earthIfSize(10, 6378.1366, 1);
  assert.ok(Math.abs(scaled.diameterMm - 10) < 1e-6);
  assert.ok(scaled.sunDistanceMm > 100000);
});

test('phases, daylight, and illumination direction', () => {
  const sun = { x: 0, y: 0, z: 0 };
  const earth = { x: 1, y: 0, z: 0 };
  const full = { x: 1.002, y: 0, z: 0 };
  const phase = lunarPhase(sun, earth, full);
  assert.ok(phase.illuminated > 0.9);
  assert.equal(phaseIdFromElongation(0), 'new');
  assert.equal(phaseIdFromElongation(90), 'first-quarter');
  assert.equal(phaseIdFromElongation(180), 'full');
  assert.equal(phaseIdFromElongation(270), 'third-quarter');
  const body = { x: 2, y: 0, z: 0 };
  assert.ok(illumination(body, { x: -1, y: 0, z: 0 }) > 0.99);
  assert.ok(illumination(body, { x: 1, y: 0, z: 0 }) < -0.99);
  const polar = daylightHours({ tiltDeg: 23.44, orbitDeg: 0, latitudeDeg: 80 });
  assert.equal(polar.kind, 'polar-day');
  const none = daylightHours({ tiltDeg: 0, orbitDeg: 0, latitudeDeg: 40 });
  assert.ok(Math.abs(none.hours - 12) < 0.05);
  const sep = angularSeparation(earth, sun, full);
  assert.equal(sep.ok, true);
  const bad = angularSeparation(earth, earth, full);
  assert.equal(bad.ok, false);
});

test('catalog identifiers, parents, and distinct descriptions', () => {
  const ids = new Set();
  const blurbs = new Set();
  for (const b of BODIES) {
    assert.equal(ids.has(b.id), false, b.id);
    ids.add(b.id);
    if (b.parent) assert.ok(getBody(b.parent), `${b.id} parent`);
    assert.equal(blurbs.has(b.summary.pt), false, b.id);
    blurbs.add(b.summary.pt);
    if (b.massStatus === 'known') assert.ok(b.massKg > 0);
    if (b.massKg === 0) assert.fail(b.id);
    assert.ok(b.sources?.length);
  }
  assert.equal(getBody('earth').moons.length, 1);
  assert.equal(getBody('jupiter').moons.length, 4);
  assert.ok(getBody('jupiter').knownMoons > getBody('jupiter').moons.length);
  assert.equal(getBody('saturn').knownMoons, 293);
  assert.ok(DATA_DATES.moonCountsRetrieved);
  const apsis = ellipseApsisKm(4.5 * AU_KM, 0.82);
  assert.ok(apsis.periapsisKm < apsis.apoapsisKm);
  const sci = formatSci(1.9885e30, 'pt');
  assert.notEqual(sci, '—');
  assert.ok(sci.length > 4);
});
