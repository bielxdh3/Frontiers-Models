import {
  CelestialBodyData,
  EvaluatedBodyState,
  KeplerianOrbitSpec,
  ScaleMode,
  Vector3Like,
} from '../types/solarSystem';
import { CELESTIAL_CATALOG, CATALOG_BY_ID } from '../data/celestialCatalog';

export const AU_IN_KM = 149597870.7;
export const SPEED_OF_LIGHT_KMS = 299792.458;
export const GRAVITATIONAL_CONSTANT_SI = 6.6743e-11;
export const SOLAR_MASS_KG = 1.98847e30;
export const EARTH_RADIUS_KM = 6371.0;
export const EARTH_MASS_KG = 5.97217e24;

export const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // JD 2451545.0
export const DEFAULT_SESSION_START_MS = Date.UTC(2025, 2, 20, 12, 0, 0);
export const MIN_SUPPORTED_DATE_MS = Date.UTC(1800, 0, 1, 0, 0, 0);
export const MAX_SUPPORTED_DATE_MS = Date.UTC(2050, 11, 31, 23, 59, 59);

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MS_PER_DAY = 86400000;
const DAYS_PER_JULIAN_CENTURY = 36525;

export function degToRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

export function radToDeg(rad: number): number {
  return rad * RAD_TO_DEG;
}

/**
 * Normalize angle in radians to [-PI, PI]
 */
export function normalizeAngleSignedRad(rad: number): number {
  let a = ((rad + Math.PI) % (2 * Math.PI));
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/**
 * Solve Kepler's equation M = E - e * sin(E) using Newton-Raphson with bounded iterations.
 */
export function solveKeplerEquation(
  meanAnomalyRad: number,
  eccentricity: number,
  maxIterations = 35,
  tolerance = 1e-9
): { eccentricAnomalyRad: number; iterations: number; converged: boolean } {
  const M = normalizeAngleSignedRad(meanAnomalyRad);
  const e = Math.max(0, Math.min(0.9999, Number.isFinite(eccentricity) ? eccentricity : 0));

  if (e < 1e-10) {
    return { eccentricAnomalyRad: M, iterations: 0, converged: true };
  }

  let E = e < 0.8 ? M + e * Math.sin(M) : M >= 0 ? Math.PI : -Math.PI;
  let converged = false;
  let iter = 0;

  for (iter = 1; iter <= maxIterations; iter++) {
    const f = E - e * Math.sin(E) - M;
    const fPrime = Math.max(1e-7, 1 - e * Math.cos(E));
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < tolerance) {
      converged = true;
      break;
    }
  }

  return { eccentricAnomalyRad: E, iterations: iter, converged };
}

/**
 * Astronomical J2000 Ecliptic (X_ecl, Y_ecl, Z_ecl) -> Three.js Display World Space (Y-up right-handed)
 * +X_three = +X_ecl (vernal equinox)
 * +Y_three = +Z_ecl (ecliptic north pole up)
 * +Z_three = -Y_ecl (completes right-handed system)
 */
export function eclipticToThreeVector(v: Vector3Like): Vector3Like {
  return {
    x: v.x,
    y: v.z,
    z: -v.y,
  };
}

/**
 * Global continuous radial mapping function for Exploration Scale (heliocentric AU -> world units)
 */
export function mapHeliocentricAuToExplorationUnits(rAu: number): number {
  if (!Number.isFinite(rAu) || rAu <= 0) return 0;
  return 18 * Math.pow(rAu, 0.52) + 6 * Math.log1p(rAu);
}

/**
 * Linear AU mapping for Relative Scale (heliocentric AU -> world units)
 */
export const RELATIVE_SCALE_UNITS_PER_AU = 42.0;

/**
 * In Relative Scale, planetary radii share one physical diameter scale (1 Earth radius = 0.22 units),
 * while the Sun is capped or scaled with an explicit disclosure so it doesn't engulf Mercury's orbit unless in Scale Lab.
 */
export function getBodyDisplayRadius(
  body: CelestialBodyData,
  scaleMode: ScaleMode
): number {
  if (scaleMode === 'exploration') {
    if (body.id === 'sun') return 5.2;
    return body.visual.explorationRadiusUnits;
  }
  // Relative Scale: proportional to true volumetric mean radius
  if (body.id === 'sun') {
    // True Sun/Earth ratio is 109.2; in the main 3D scene we use 1/5th of true solar ratio (4.8 units)
    // so inner orbits remain outside the solar mesh while all planets/moons keep exact 1:1 diameter ratios.
    // The Dedicated Scale Laboratory provides the un-capped 109.2x solar comparison and Combined True Scale.
    return 4.8;
  }
  const earthRatio = body.meanRadiusKm / EARTH_RADIUS_KM;
  return Math.max(0.015, earthRatio * 0.22);
}

export function isDateWithinValidityWindow(simTimeMs: number, orbit?: KeplerianOrbitSpec): boolean {
  if (!Number.isFinite(simTimeMs)) return false;
  if (!orbit) {
    return simTimeMs >= MIN_SUPPORTED_DATE_MS && simTimeMs <= MAX_SUPPORTED_DATE_MS;
  }
  const year = 1970 + simTimeMs / (MS_PER_DAY * 365.2425);
  return year >= orbit.validStartYear && year <= orbit.validEndYear;
}

/**
 * Evaluate orbital position and velocity at a given angle or time for a KeplerianOrbitSpec.
 */
export function evaluateKeplerianOrbitAtTime(
  orbit: KeplerianOrbitSpec,
  simTimeMs: number
): {
  position: Vector3Like; // in AU (or km if orbit.isParentKm)
  velocityPerDay: Vector3Like;
  meanAnomalyRad: number;
  eccentricAnomalyRad: number;
  trueAnomalyRad: number;
  radius: number;
} {
  const daysSinceJ2000 = (simTimeMs - J2000_UTC_MS) / MS_PER_DAY;
  const T = daysSinceJ2000 / DAYS_PER_JULIAN_CENTURY;

  const a = Math.max(1e-6, orbit.a0 + (orbit.aDot ?? 0) * T);
  const e = Math.max(0, Math.min(0.995, orbit.e0 + (orbit.eDot ?? 0) * T));
  const I_deg = orbit.I0 + (orbit.IDot ?? 0) * T;
  const longPeri_deg = orbit.longPeri0 + (orbit.longPeriDot ?? 0) * T;
  const longNode_deg = orbit.longNode0 + (orbit.longNodeDot ?? 0) * T;

  let L_deg: number;
  if (orbit.LDot !== undefined) {
    L_deg = orbit.L0 + orbit.LDot * T;
  } else {
    const direction = orbit.isRetrogradeOrbit ? -1 : 1;
    const meanMotionDegPerDay = direction * (360 / Math.max(1e-5, orbit.periodDays));
    L_deg = orbit.L0 + meanMotionDegPerDay * daysSinceJ2000;
  }

  const omega_rad = degToRad(longPeri_deg - longNode_deg);
  const Omega_rad = degToRad(longNode_deg);
  const I_rad = degToRad(I_deg);
  const M_rad = normalizeAngleSignedRad(degToRad(L_deg - longPeri_deg));

  const { eccentricAnomalyRad: E } = solveKeplerEquation(M_rad, e);

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtOneMinusE2 = Math.sqrt(Math.max(0, 1 - e * e));

  // Position in orbital plane
  const xPrime = a * (cosE - e);
  const yPrime = a * sqrtOneMinusE2 * sinE;
  const r = Math.hypot(xPrime, yPrime);
  const trueAnomalyRad = Math.atan2(yPrime, xPrime);

  // Velocity in orbital plane
  const meanMotionRadPerDay = (2 * Math.PI) / Math.max(1e-5, orbit.periodDays);
  const dEdt = meanMotionRadPerDay / Math.max(1e-6, 1 - e * cosE);
  const vxPrime = -a * sinE * dEdt;
  const vyPrime = a * sqrtOneMinusE2 * cosE * dEdt;

  const cosOmega = Math.cos(omega_rad);
  const sinOmega = Math.sin(omega_rad);
  const cosNode = Math.cos(Omega_rad);
  const sinNode = Math.sin(Omega_rad);
  const cosI = Math.cos(I_rad);
  const sinI = Math.sin(I_rad);

  // Transform orbital plane (xPrime, yPrime, 0) to reference frame (X, Y, Z)
  const Px = cosOmega * cosNode - sinOmega * sinNode * cosI;
  const Py = cosOmega * sinNode + sinOmega * cosNode * cosI;
  const Pz = sinOmega * sinI;

  const Qx = -sinOmega * cosNode - cosOmega * sinNode * cosI;
  const Qy = -sinOmega * sinNode + cosOmega * cosNode * cosI;
  const Qz = cosOmega * sinI;

  const position: Vector3Like = {
    x: Px * xPrime + Qx * yPrime,
    y: Py * xPrime + Qy * yPrime,
    z: Pz * xPrime + Qz * yPrime,
  };

  const velocityPerDay: Vector3Like = {
    x: Px * vxPrime + Qx * vyPrime,
    y: Py * vxPrime + Qy * vyPrime,
    z: Pz * vxPrime + Qz * vyPrime,
  };

  return {
    position,
    velocityPerDay,
    meanAnomalyRad: M_rad,
    eccentricAnomalyRad: E,
    trueAnomalyRad,
    radius: r,
  };
}

/**
 * Sample an entire closed orbit path (in Three.js display coordinates) for rendering orbit lines.
 */
export function sampleOrbitDisplayPath(
  body: CelestialBodyData,
  simTimeMs: number,
  scaleMode: ScaleMode,
  parentDisplayPosition: Vector3Like = { x: 0, y: 0, z: 0 },
  segments = 128
): Vector3Like[] {
  const orbit = body.orbit;
  if (!orbit) return [];

  const daysSinceJ2000 = (simTimeMs - J2000_UTC_MS) / MS_PER_DAY;
  const T = daysSinceJ2000 / DAYS_PER_JULIAN_CENTURY;

  const a = Math.max(1e-6, orbit.a0 + (orbit.aDot ?? 0) * T);
  const e = Math.max(0, Math.min(0.995, orbit.e0 + (orbit.eDot ?? 0) * T));
  const I_deg = orbit.I0 + (orbit.IDot ?? 0) * T;
  const longPeri_deg = orbit.longPeri0 + (orbit.longPeriDot ?? 0) * T;
  const longNode_deg = orbit.longNode0 + (orbit.longNodeDot ?? 0) * T;

  const omega_rad = degToRad(longPeri_deg - longNode_deg);
  const Omega_rad = degToRad(longNode_deg);
  const I_rad = degToRad(I_deg);
  const sqrtOneMinusE2 = Math.sqrt(Math.max(0, 1 - e * e));

  const cosOmega = Math.cos(omega_rad);
  const sinOmega = Math.sin(omega_rad);
  const cosNode = Math.cos(Omega_rad);
  const sinNode = Math.sin(Omega_rad);
  const cosI = Math.cos(I_rad);
  const sinI = Math.sin(I_rad);

  const Px = cosOmega * cosNode - sinOmega * sinNode * cosI;
  const Py = cosOmega * sinNode + sinOmega * cosNode * cosI;
  const Pz = sinOmega * sinI;

  const Qx = -sinOmega * cosNode - cosOmega * sinNode * cosI;
  const Qy = -sinOmega * sinNode + cosOmega * cosNode * cosI;
  const Qz = cosOmega * sinI;

  const parent = body.parentId ? CATALOG_BY_ID[body.parentId] : undefined;
  const parentTiltRad =
    orbit.frame === 'parent_equatorial' && parent?.axialTiltDeg
      ? degToRad(parent.axialTiltDeg)
      : 0;
  const cosTilt = Math.cos(parentTiltRad);
  const sinTilt = Math.sin(parentTiltRad);

  const points: Vector3Like[] = [];

  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * 2 * Math.PI;
    const xPrime = a * (Math.cos(E) - e);
    const yPrime = a * sqrtOneMinusE2 * Math.sin(E);

    let rx = Px * xPrime + Qx * yPrime;
    let ry = Py * xPrime + Qy * yPrime;
    let rz = Pz * xPrime + Qz * yPrime;

    if (parentTiltRad !== 0) {
      // Rotate around X axis in ecliptic coordinates by parent's axial obliquity
      const ryTilted = ry * cosTilt - rz * sinTilt;
      const rzTilted = ry * sinTilt + rz * cosTilt;
      ry = ryTilted;
      rz = rzTilted;
    }

    if (body.category === 'moon' && orbit.isParentKm) {
      const rKm = Math.hypot(rx, ry, rz);
      const ratio = rKm / Math.max(1, orbit.a0);
      const localRadiusUnits =
        scaleMode === 'exploration'
          ? body.visual.explorationDistanceUnits * ratio
          : Math.max(0.65, (rKm / 100000) * 1.35);
      const scaleFactor = rKm > 0 ? localRadiusUnits / rKm : 0;
      const localThree = eclipticToThreeVector({
        x: rx * scaleFactor,
        y: ry * scaleFactor,
        z: rz * scaleFactor,
      });
      points.push({
        x: parentDisplayPosition.x + localThree.x,
        y: parentDisplayPosition.y + localThree.y,
        z: parentDisplayPosition.z + localThree.z,
      });
    } else {
      const rAu = Math.hypot(rx, ry, rz);
      const displayR =
        scaleMode === 'exploration'
          ? mapHeliocentricAuToExplorationUnits(rAu)
          : rAu * RELATIVE_SCALE_UNITS_PER_AU;
      const scaleFactor = rAu > 0 ? displayR / rAu : 0;
      points.push(
        eclipticToThreeVector({
          x: rx * scaleFactor,
          y: ry * scaleFactor,
          z: rz * scaleFactor,
        })
      );
    }
  }

  return points;
}

/**
 * Evaluate the complete Solar System state at `simTimeMs` in stable parent-first hierarchy.
 */
export function evaluateSolarSystemState(
  simTimeMs: number,
  scaleMode: ScaleMode
): Record<string, EvaluatedBodyState> {
  const states: Record<string, EvaluatedBodyState> = {};
  const daysSinceJ2000 = (simTimeMs - J2000_UTC_MS) / MS_PER_DAY;
  const hoursSinceJ2000 = daysSinceJ2000 * 24;

  // Pass 1: Star, planets, dwarf planets, small bodies, and regions (heliocentric)
  for (const body of CELESTIAL_CATALOG) {
    if (body.category === 'moon') continue;

    const displayRadius = getBodyDisplayRadius(body, scaleMode);
    let spinAngleRad = 0;
    if (body.siderealRotationHours && Math.abs(body.siderealRotationHours) > 1e-5) {
      spinAngleRad =
        ((hoursSinceJ2000 / body.siderealRotationHours) * 2 * Math.PI) %
        (2 * Math.PI);
    }

    if (body.id === 'sun' || !body.orbit) {
      const rAu = body.semiMajorAxisAu ?? 0;
      const displayX =
        rAu > 0
          ? scaleMode === 'exploration'
            ? mapHeliocentricAuToExplorationUnits(rAu)
            : rAu * RELATIVE_SCALE_UNITS_PER_AU
          : 0;
      states[body.id] = {
        id: body.id,
        heliocentricPositionAu: { x: rAu, y: 0, z: 0 },
        parentRelativePositionKm: { x: rAu * AU_IN_KM, y: 0, z: 0 },
        sunDistanceAu: rAu,
        sunDistanceKm: rAu * AU_IN_KM,
        parentDistanceKm: rAu * AU_IN_KM,
        orbitalVelocityKms: 0,
        velocityVectorAuPerDay: { x: 0, y: 0, z: 0 },
        meanAnomalyRad: 0,
        trueAnomalyRad: 0,
        eccentricAnomalyRad: 0,
        spinAngleRad,
        withinValidityWindow: isDateWithinValidityWindow(simTimeMs, body.orbit),
        displayPosition: { x: displayX, y: 0, z: 0 },
        displayRadius,
      };
      continue;
    }

    const evalOrbit = evaluateKeplerianOrbitAtTime(body.orbit, simTimeMs);
    const posAu = evalOrbit.position;
    const rAu = evalOrbit.radius;
    const rKm = rAu * AU_IN_KM;

    const speedAuPerDay = Math.hypot(
      evalOrbit.velocityPerDay.x,
      evalOrbit.velocityPerDay.y,
      evalOrbit.velocityPerDay.z
    );
    const orbitalVelocityKms = (speedAuPerDay * AU_IN_KM) / 86400;

    const displayDist =
      scaleMode === 'exploration'
        ? mapHeliocentricAuToExplorationUnits(rAu)
        : rAu * RELATIVE_SCALE_UNITS_PER_AU;
    const factor = rAu > 0 ? displayDist / rAu : 0;
    const displayPosition = eclipticToThreeVector({
      x: posAu.x * factor,
      y: posAu.y * factor,
      z: posAu.z * factor,
    });

    states[body.id] = {
      id: body.id,
      heliocentricPositionAu: posAu,
      parentRelativePositionKm: {
        x: posAu.x * AU_IN_KM,
        y: posAu.y * AU_IN_KM,
        z: posAu.z * AU_IN_KM,
      },
      sunDistanceAu: rAu,
      sunDistanceKm: rKm,
      parentDistanceKm: rKm,
      orbitalVelocityKms,
      velocityVectorAuPerDay: evalOrbit.velocityPerDay,
      meanAnomalyRad: evalOrbit.meanAnomalyRad,
      trueAnomalyRad: evalOrbit.trueAnomalyRad,
      eccentricAnomalyRad: evalOrbit.eccentricAnomalyRad,
      spinAngleRad,
      withinValidityWindow: isDateWithinValidityWindow(simTimeMs, body.orbit),
      displayPosition,
      displayRadius,
    };
  }

  // Pass 2: Moons (evaluated in parent's positional frame, NEVER inheriting parent's surface spin)
  for (const body of CELESTIAL_CATALOG) {
    if (body.category !== 'moon' || !body.parentId || !body.orbit) continue;
    const parentState = states[body.parentId];
    const parentBody = CATALOG_BY_ID[body.parentId];
    if (!parentState || !parentBody) continue;

    const evalOrbit = evaluateKeplerianOrbitAtTime(body.orbit, simTimeMs);
    let rxKm = evalOrbit.position.x;
    let ryKm = evalOrbit.position.y;
    let rzKm = evalOrbit.position.z;

    if (body.orbit.frame === 'parent_equatorial' && parentBody.axialTiltDeg) {
      const tiltRad = degToRad(parentBody.axialTiltDeg);
      const cosT = Math.cos(tiltRad);
      const sinT = Math.sin(tiltRad);
      const ryRotated = ryKm * cosT - rzKm * sinT;
      const rzRotated = ryKm * sinT + rzKm * cosT;
      ryKm = ryRotated;
      rzKm = rzRotated;
    }

    const rKm = Math.hypot(rxKm, ryKm, rzKm);
    const helioPosAu: Vector3Like = {
      x: parentState.heliocentricPositionAu.x + rxKm / AU_IN_KM,
      y: parentState.heliocentricPositionAu.y + ryKm / AU_IN_KM,
      z: parentState.heliocentricPositionAu.z + rzKm / AU_IN_KM,
    };
    const sunDistanceAu = Math.hypot(helioPosAu.x, helioPosAu.y, helioPosAu.z);
    const sunDistanceKm = sunDistanceAu * AU_IN_KM;

    const speedKmPerDay = Math.hypot(
      evalOrbit.velocityPerDay.x,
      evalOrbit.velocityPerDay.y,
      evalOrbit.velocityPerDay.z
    );
    const orbitalVelocityKms = speedKmPerDay / 86400;

    // Display offset relative to parent display position
    const ratio = rKm / Math.max(1, body.orbit.a0);
    const localRadiusUnits =
      scaleMode === 'exploration'
        ? body.visual.explorationDistanceUnits * ratio
        : Math.max(0.65, (rKm / 100000) * 1.35);
    const scaleFactor = rKm > 0 ? localRadiusUnits / rKm : 0;
    const localThreeOffset = eclipticToThreeVector({
      x: rxKm * scaleFactor,
      y: ryKm * scaleFactor,
      z: rzKm * scaleFactor,
    });

    const displayPosition: Vector3Like = {
      x: parentState.displayPosition.x + localThreeOffset.x,
      y: parentState.displayPosition.y + localThreeOffset.y,
      z: parentState.displayPosition.z + localThreeOffset.z,
    };

    // Tidally locked moons orient toward their parent
    const spinAngleRad = body.isTidallyLocked
      ? Math.atan2(-localThreeOffset.z, -localThreeOffset.x)
      : body.siderealRotationHours
        ? ((hoursSinceJ2000 / body.siderealRotationHours) * 2 * Math.PI) % (2 * Math.PI)
        : 0;

    states[body.id] = {
      id: body.id,
      heliocentricPositionAu: helioPosAu,
      parentRelativePositionKm: { x: rxKm, y: ryKm, z: rzKm },
      sunDistanceAu,
      sunDistanceKm,
      parentDistanceKm: rKm,
      orbitalVelocityKms,
      velocityVectorAuPerDay: {
        x: parentState.velocityVectorAuPerDay.x + evalOrbit.velocityPerDay.x / AU_IN_KM,
        y: parentState.velocityVectorAuPerDay.y + evalOrbit.velocityPerDay.y / AU_IN_KM,
        z: parentState.velocityVectorAuPerDay.z + evalOrbit.velocityPerDay.z / AU_IN_KM,
      },
      meanAnomalyRad: evalOrbit.meanAnomalyRad,
      trueAnomalyRad: evalOrbit.trueAnomalyRad,
      eccentricAnomalyRad: evalOrbit.eccentricAnomalyRad,
      spinAngleRad,
      withinValidityWindow: isDateWithinValidityWindow(simTimeMs, body.orbit),
      displayPosition,
      displayRadius: getBodyDisplayRadius(body, scaleMode),
    };
  }

  return states;
}

/**
 * Physical distance and light-time calculation between two bodies (Section 31).
 * Always reads physical heliocentric coordinates, completely invariant to visual scale!
 */
export function calculatePhysicalMeasurement(
  fromId: string,
  toId: string,
  states: Record<string, EvaluatedBodyState>,
  observerId?: string
): {
  centerDistanceKm: number;
  surfaceDistanceKm: number;
  distanceAu: number;
  lightTimeSeconds: number;
  angularSeparationDeg?: number;
  valid: boolean;
} {
  const fromState = states[fromId];
  const toState = states[toId];
  const fromBody = CATALOG_BY_ID[fromId];
  const toBody = CATALOG_BY_ID[toId];

  if (!fromState || !toState || !fromBody || !toBody) {
    return {
      centerDistanceKm: 0,
      surfaceDistanceKm: 0,
      distanceAu: 0,
      lightTimeSeconds: 0,
      valid: false,
    };
  }

  const dxAu = toState.heliocentricPositionAu.x - fromState.heliocentricPositionAu.x;
  const dyAu = toState.heliocentricPositionAu.y - fromState.heliocentricPositionAu.y;
  const dzAu = toState.heliocentricPositionAu.z - fromState.heliocentricPositionAu.z;

  const distanceAu = Math.hypot(dxAu, dyAu, dzAu);
  const centerDistanceKm = distanceAu * AU_IN_KM;
  const combinedRadiiKm = (fromBody.meanRadiusKm || 0) + (toBody.meanRadiusKm || 0);
  const surfaceDistanceKm = Math.max(0, centerDistanceKm - combinedRadiiKm);
  const lightTimeSeconds = centerDistanceKm / SPEED_OF_LIGHT_KMS;

  let angularSeparationDeg: number | undefined;
  if (observerId && states[observerId] && observerId !== fromId && observerId !== toId) {
    const obs = states[observerId].heliocentricPositionAu;
    const v1 = {
      x: fromState.heliocentricPositionAu.x - obs.x,
      y: fromState.heliocentricPositionAu.y - obs.y,
      z: fromState.heliocentricPositionAu.z - obs.z,
    };
    const v2 = {
      x: toState.heliocentricPositionAu.x - obs.x,
      y: toState.heliocentricPositionAu.y - obs.y,
      z: toState.heliocentricPositionAu.z - obs.z,
    };
    const len1 = Math.hypot(v1.x, v1.y, v1.z);
    const len2 = Math.hypot(v2.x, v2.y, v2.z);
    if (len1 > 1e-9 && len2 > 1e-9) {
      const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (len1 * len2);
      const clampedDot = Math.max(-1, Math.min(1, dot));
      angularSeparationDeg = radToDeg(Math.acos(clampedDot));
    }
  }

  return {
    centerDistanceKm,
    surfaceDistanceKm,
    distanceAu,
    lightTimeSeconds,
    angularSeparationDeg,
    valid: true,
  };
}

/**
 * Two-body spherical approximation calculations for the Gravity & Kepler Sandbox (Section 34).
 * Uses SI units explicitly:
 * g = G * M / r^2
 * W = m * g
 * T = 2 * pi * sqrt(a^3 / (G * M))
 */
export function calculateTwoBodySandbox(params: {
  centralMassSolar: number;
  semiMajorAxisAu: number;
  eccentricity: number;
  testMassKg: number;
}): {
  orbitalPeriodSeconds: number;
  orbitalPeriodDays: number;
  orbitalPeriodYears: number;
  periapsisAu: number;
  apoapsisAu: number;
  periapsisVelocityKms: number;
  apoapsisVelocityKms: number;
} {
  const M_kg = Math.max(0.01, params.centralMassSolar) * SOLAR_MASS_KG;
  const a_au = Math.max(0.05, params.semiMajorAxisAu);
  const a_m = a_au * AU_IN_KM * 1000;
  const e = Math.max(0, Math.min(0.95, params.eccentricity));

  const mu = GRAVITATIONAL_CONSTANT_SI * M_kg;
  const T_sec = 2 * Math.PI * Math.sqrt(Math.pow(a_m, 3) / mu);
  const T_days = T_sec / 86400;
  const T_years = T_days / 365.25;

  const periapsisAu = a_au * (1 - e);
  const apoapsisAu = a_au * (1 + e);

  const rPeri_m = periapsisAu * AU_IN_KM * 1000;
  const rApo_m = apoapsisAu * AU_IN_KM * 1000;

  const vPeri_ms = Math.sqrt(mu * (2 / rPeri_m - 1 / a_m));
  const vApo_ms = Math.sqrt(mu * (2 / rApo_m - 1 / a_m));

  return {
    orbitalPeriodSeconds: T_sec,
    orbitalPeriodDays: T_days,
    orbitalPeriodYears: T_years,
    periapsisAu,
    apoapsisAu,
    periapsisVelocityKms: vPeri_ms / 1000,
    apoapsisVelocityKms: vApo_ms / 1000,
  };
}

export function calculateSphericalGravityAndWeight(
  bodyMassKg: number,
  referenceRadiusKm: number,
  testObjectMassKg: number
): { gravityMs2: number; weightNewtons: number } {
  const r_m = Math.max(1, referenceRadiusKm) * 1000;
  const g = (GRAVITATIONAL_CONSTANT_SI * Math.max(0, bodyMassKg)) / (r_m * r_m);
  const W = Math.max(0, testObjectMassKg) * g;
  return { gravityMs2: g, weightNewtons: W };
}
