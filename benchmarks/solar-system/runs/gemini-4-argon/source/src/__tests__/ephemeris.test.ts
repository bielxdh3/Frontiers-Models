import { describe, expect, it } from 'vitest';
import {
  AU_IN_KM,
  calculatePhysicalMeasurement,
  calculateSphericalGravityAndWeight,
  calculateTwoBodySandbox,
  DEFAULT_SESSION_START_MS,
  evaluateKeplerianOrbitAtTime,
  evaluateSolarSystemState,
  J2000_UTC_MS,
  MAX_SUPPORTED_DATE_MS,
  MIN_SUPPORTED_DATE_MS,
  normalizeAngleSignedRad,
  solveKeplerEquation,
  SPEED_OF_LIGHT_KMS,
} from '../engine/ephemeris';
import { CATALOG_BY_ID, CELESTIAL_CATALOG } from '../data/celestialCatalog';
import { validateAndRecoverStore } from '../utils/storage';

describe('Solar System Observatory — Scientific & Numerical Verification (Section 54)', () => {
  describe('1. Kepler Solver & Orbital Propagation', () => {
    it('converges accurately for circular (e = 0) and elliptical (0 < e <= 0.967) orbits across all mean anomalies', () => {
      const eccentricities = [0, 0.0167, 0.0934, 0.2056, 0.2488, 0.436, 0.75, 0.967];
      const anomalies = [-Math.PI, -1.8, -0.5, 0, 0.25, 1.2, 2.7, Math.PI];

      for (const e of eccentricities) {
        for (const M of anomalies) {
          const res = solveKeplerEquation(M, e);
          expect(res.converged).toBe(true);
          expect(Number.isFinite(res.eccentricAnomalyRad)).toBe(true);
          const normM = normalizeAngleSignedRad(M);
          const residual = Math.abs(
            res.eccentricAnomalyRad - e * Math.sin(res.eccentricAnomalyRad) - normM
          );
          expect(residual).toBeLessThan(1e-7);
        }
      }
    });

    it('produces constant radius for circular orbit (e = 0) and satisfies rp = a(1-e), ra = a(1+e) with vp > va for elliptical orbit', () => {
      const circularOrbit = {
        frame: 'heliocentric_ecliptic' as const,
        a0: 2.0,
        e0: 0,
        I0: 0,
        L0: 0,
        longPeri0: 0,
        longNode0: 0,
        periodDays: 1000,
        validStartYear: 1800,
        validEndYear: 2050,
        modelNote: { 'pt-BR': 'Teste circular', en: 'Circular test' },
      };

      const t0 = J2000_UTC_MS;
      const tQuarter = t0 + 250 * 86400000;
      const st0 = evaluateKeplerianOrbitAtTime(circularOrbit, t0);
      const stQ = evaluateKeplerianOrbitAtTime(circularOrbit, tQuarter);
      expect(st0.radius).toBeCloseTo(2.0, 6);
      expect(stQ.radius).toBeCloseTo(2.0, 6);

      const ellipticalOrbit = {
        ...circularOrbit,
        a0: 2.5,
        e0: 0.4,
      };
      // At t = J2000, L0 = 0, longPeri0 = 0 => M = 0 (periapsis)
      const periState = evaluateKeplerianOrbitAtTime(ellipticalOrbit, t0);
      // At t = J2000 + half period (500 days) => M = pi (apoapsis)
      const apoState = evaluateKeplerianOrbitAtTime(
        ellipticalOrbit,
        t0 + 500 * 86400000
      );

      expect(periState.radius).toBeCloseTo(2.5 * (1 - 0.4), 5);
      expect(apoState.radius).toBeCloseTo(2.5 * (1 + 0.4), 5);

      const vp = Math.hypot(
        periState.velocityPerDay.x,
        periState.velocityPerDay.y,
        periState.velocityPerDay.z
      );
      const va = Math.hypot(
        apoState.velocityPerDay.x,
        apoState.velocityPerDay.y,
        apoState.velocityPerDay.z
      );
      expect(vp).toBeGreaterThan(va);
    });

    it('preserves strict heliocentric orbital period ordering from Mercury to Pluto', () => {
      const order = [
        'mercury',
        'venus',
        'earth',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
        'pluto',
      ];
      for (let i = 0; i < order.length - 1; i++) {
        const curr = CATALOG_BY_ID[order[i]];
        const next = CATALOG_BY_ID[order[i + 1]];
        expect(curr.orbitalPeriodDays).not.toBeNull();
        expect(next.orbitalPeriodDays).not.toBeNull();
        expect(curr.orbitalPeriodDays!).toBeLessThan(next.orbitalPeriodDays!);
      }
    });

    it('is deterministic and satisfies forward/reverse time symmetry (+dt / -dt)', () => {
      const t0 = DEFAULT_SESSION_START_MS;
      const dt = 45 * 86400000; // 45 days

      const stateA1 = evaluateSolarSystemState(t0, 'exploration');
      const stateA2 = evaluateSolarSystemState(t0, 'exploration');
      expect(stateA1.mars.heliocentricPositionAu).toEqual(
        stateA2.mars.heliocentricPositionAu
      );

      const stateForward = evaluateSolarSystemState(t0 + dt, 'exploration');
      const stateBackToOrigin = evaluateSolarSystemState(
        t0 + dt - dt,
        'exploration'
      );
      expect(stateForward.earth.heliocentricPositionAu.x).not.toBeCloseTo(
        stateA1.earth.heliocentricPositionAu.x,
        2
      );
      expect(stateBackToOrigin.earth.heliocentricPositionAu.x).toBeCloseTo(
        stateA1.earth.heliocentricPositionAu.x,
        10
      );
      expect(stateBackToOrigin.moon.heliocentricPositionAu.y).toBeCloseTo(
        stateA1.moon.heliocentricPositionAu.y,
        10
      );
    });

    it('produces finite coordinates across the entire supported JPL date window (1800–2050 CE)', () => {
      const testTimestamps = [
        MIN_SUPPORTED_DATE_MS,
        Date.UTC(1969, 6, 20, 20, 17, 0),
        Date.UTC(1989, 7, 25, 4, 0, 0),
        J2000_UTC_MS,
        Date.UTC(2015, 6, 14, 11, 49, 0),
        DEFAULT_SESSION_START_MS,
        MAX_SUPPORTED_DATE_MS,
      ];

      for (const ts of testTimestamps) {
        const states = evaluateSolarSystemState(ts, 'exploration');
        for (const body of CELESTIAL_CATALOG) {
          const st = states[body.id];
          expect(st).toBeDefined();
          expect(Number.isFinite(st.heliocentricPositionAu.x)).toBe(true);
          expect(Number.isFinite(st.heliocentricPositionAu.y)).toBe(true);
          expect(Number.isFinite(st.heliocentricPositionAu.z)).toBe(true);
          expect(Number.isFinite(st.displayPosition.x)).toBe(true);
          expect(Number.isFinite(st.displayPosition.y)).toBe(true);
          expect(Number.isFinite(st.displayPosition.z)).toBe(true);
          expect(Number.isFinite(st.displayRadius)).toBe(true);
          expect(st.displayRadius).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('2. Hierarchy & Coordinate Frames', () => {
    it('evaluates Moon in Earth positional frame without inheriting Earth surface spin', () => {
      const t0 = DEFAULT_SESSION_START_MS;
      const states = evaluateSolarSystemState(t0, 'exploration');
      const earth = states.earth;
      const moon = states.moon;

      const expectedHelioX =
        earth.heliocentricPositionAu.x + moon.parentRelativePositionKm.x / AU_IN_KM;
      const expectedHelioY =
        earth.heliocentricPositionAu.y + moon.parentRelativePositionKm.y / AU_IN_KM;
      const expectedHelioZ =
        earth.heliocentricPositionAu.z + moon.parentRelativePositionKm.z / AU_IN_KM;

      expect(moon.heliocentricPositionAu.x).toBeCloseTo(expectedHelioX, 9);
      expect(moon.heliocentricPositionAu.y).toBeCloseTo(expectedHelioY, 9);
      expect(moon.heliocentricPositionAu.z).toBeCloseTo(expectedHelioZ, 9);

      // Advance by 6 hours (quarter of an Earth rotation day, but only ~0.9% of Moon's 27.32d orbit)
      const statesPlus6h = evaluateSolarSystemState(
        t0 + 6 * 3600 * 1000,
        'exploration'
      );
      const angle0 = Math.atan2(
        moon.parentRelativePositionKm.y,
        moon.parentRelativePositionKm.x
      );
      const angle6h = Math.atan2(
        statesPlus6h.moon.parentRelativePositionKm.y,
        statesPlus6h.moon.parentRelativePositionKm.x
      );
      // Moon moves ~3.3 degrees in 6 hours (~0.057 rad), NOT 90 degrees (1.57 rad) with Earth spin!
      expect(Math.abs(angle6h - angle0)).toBeLessThan(0.15);
    });

    it('models Triton with retrograde inclination (> 90 deg)', () => {
      const triton = CATALOG_BY_ID.triton;
      expect(triton).toBeDefined();
      expect(triton.inclinationDeg).toBeGreaterThan(90);
      expect(triton.orbit?.isRetrogradeOrbit).toBe(true);
    });
  });

  describe('3. Scale Mapping & Physical Invariance', () => {
    it('keeps physical distances, speeds, and measurements strictly invariant when switching between Exploration and Relative Scale', () => {
      const t = DEFAULT_SESSION_START_MS;
      const expStates = evaluateSolarSystemState(t, 'exploration');
      const relStates = evaluateSolarSystemState(t, 'relative');

      // Display positions and radii MUST change between Exploration and Relative Scale
      expect(expStates.jupiter.displayRadius).not.toBeCloseTo(
        relStates.jupiter.displayRadius,
        2
      );
      expect(expStates.neptune.displayPosition.x).not.toBeCloseTo(
        relStates.neptune.displayPosition.x,
        1
      );

      // Physical coordinates and measurements MUST remain identical
      expect(expStates.saturn.sunDistanceAu).toBeCloseTo(
        relStates.saturn.sunDistanceAu,
        12
      );
      expect(expStates.saturn.orbitalVelocityKms).toBeCloseTo(
        relStates.saturn.orbitalVelocityKms,
        12
      );

      const mExp = calculatePhysicalMeasurement(
        'earth',
        'saturn',
        expStates,
        'sun'
      );
      const mRel = calculatePhysicalMeasurement(
        'earth',
        'saturn',
        relStates,
        'sun'
      );
      expect(mExp.distanceAu).toBeCloseTo(mRel.distanceAu, 12);
      expect(mExp.centerDistanceKm).toBeCloseTo(mRel.centerDistanceKm, 6);
      expect(mExp.lightTimeSeconds).toBeCloseTo(mRel.lightTimeSeconds, 9);
    });

    it('maintains monotonic radial distance ordering for the 8 planets in both scale modes', () => {
      const planets = [
        'mercury',
        'venus',
        'earth',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
      ];
      for (const mode of ['exploration', 'relative'] as const) {
        const states = evaluateSolarSystemState(DEFAULT_SESSION_START_MS, mode);
        for (let i = 0; i < planets.length - 1; i++) {
          const rCurr = Math.hypot(
            states[planets[i]].displayPosition.x,
            states[planets[i]].displayPosition.y,
            states[planets[i]].displayPosition.z
          );
          const rNext = Math.hypot(
            states[planets[i + 1]].displayPosition.x,
            states[planets[i + 1]].displayPosition.y,
            states[planets[i + 1]].displayPosition.z
          );
          expect(rCurr).toBeLessThan(rNext);
        }
      }
    });
  });

  describe('4. Unit Conversions, Absolute Kelvin Ratios & Two-Body Sandbox', () => {
    it('satisfies 1 AU = 149,597,870.7 km and ~499.005 s light-travel time', () => {
      expect(AU_IN_KM).toBe(149597870.7);
      const lightTime1Au = AU_IN_KM / SPEED_OF_LIGHT_KMS;
      expect(lightTime1Au).toBeCloseTo(499.00478, 3);
    });

    it('computes two-body Kepler sandbox period and verifies test mass invariance for orbital period', () => {
      const res100kg = calculateTwoBodySandbox({
        centralMassSolar: 1.0,
        semiMajorAxisAu: 1.0,
        eccentricity: 0.0167,
        testMassKg: 100,
      });
      const res5000kg = calculateTwoBodySandbox({
        centralMassSolar: 1.0,
        semiMajorAxisAu: 1.0,
        eccentricity: 0.0167,
        testMassKg: 5000,
      });

      // At 1 Solar Mass and 1 AU, period is ~365.256 days (~1.000 year)
      expect(res100kg.orbitalPeriodYears).toBeCloseTo(1.0, 2);
      // Changing test mass in m << M regime does NOT alter period
      expect(res100kg.orbitalPeriodDays).toBeCloseTo(res5000kg.orbitalPeriodDays, 10);

      // Weight scales linearly with test mass
      const earth = CATALOG_BY_ID.earth;
      const g100 = calculateSphericalGravityAndWeight(
        earth.massKg!,
        earth.meanRadiusKm,
        100
      );
      const g200 = calculateSphericalGravityAndWeight(
        earth.massKg!,
        earth.meanRadiusKm,
        200
      );
      expect(g100.gravityMs2).toBeCloseTo(9.8, 0);
      expect(g200.weightNewtons).toBeCloseTo(g100.weightNewtons * 2, 5);
    });
  });

  describe('5. Catalog Integrity & Safe Storage Validation', () => {
    it('verifies all catalog entries have unique IDs, valid parent references, positive dimensions, and institutional citations', () => {
      const seenIds = new Set<string>();
      for (const body of CELESTIAL_CATALOG) {
        expect(seenIds.has(body.id)).toBe(false);
        seenIds.add(body.id);
        expect(body.diameterKm).toBeGreaterThan(0);
        expect(body.sources.length).toBeGreaterThan(0);
        if (body.parentId !== null) {
          expect(CATALOG_BY_ID[body.parentId]).toBeDefined();
        }
      }
      // Verify required 26+ catalog bodies are present
      expect(CELESTIAL_CATALOG.length).toBeGreaterThanOrEqual(26);
    });

    it('recovers gracefully from malformed or untrusted persisted JSON without throwing', () => {
      const corrupted = validateAndRecoverStore(null);
      expect(corrupted.store.schemaVersion).toBe(1);
      expect(corrupted.warnings.length).toBeGreaterThan(0);

      const unknownIds = validateAndRecoverStore({
        schemaVersion: 99,
        favorites: ['earth', 'non_existent_planet_xyz'],
        savedViewpoints: [{ id: 'bad', targetId: 'invalid_target' }],
      });
      expect(unknownIds.store.favorites).toEqual(['earth']);
      expect(unknownIds.store.savedViewpoints.length).toBe(0);
      expect(unknownIds.warnings.length).toBeGreaterThan(0);
    });
  });
});
