import { BODY_BY_ID, JPL_ELEMENTS, MOON_MU, MOON_ORBITS, SIMPLE_ORBITS, getBody } from './catalog.js';
import {
  JD_PRIMARY_END,
  JD_PRIMARY_START,
  add,
  circularOffset,
  cometActivity,
  jplElementsAt,
  jplPosition,
  len,
  orbitAtMeanAnomaly,
  scale,
  simplePosition,
  sub,
} from './science.js';

const cache = new Map();

export function accuracyForJd(jd, allowExtended) {
  if (jd >= JD_PRIMARY_START && jd <= JD_PRIMARY_END) return 'primary';
  if (allowExtended) return 'extended';
  return 'blocked';
}

function planetAu(id, jd, accuracy) {
  const pack = JPL_ELEMENTS[id];
  const el = accuracy === 'extended' ? pack.extended : pack.primary;
  const extra = accuracy === 'extended' ? pack.extra || null : null;
  return jplPosition(el, jd, extra);
}

export function systemAt(jd, accuracy = 'primary') {
  if (!Number.isFinite(jd)) return { ok: false, reason: 'nonfinite', bodies: {} };
  const key = `${accuracy}:${Math.round(jd * 1e8)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bodies = {};
  bodies.sun = { id: 'sun', au: { x: 0, y: 0, z: 0 }, ok: true, kind: 'fixed' };

  const planetIds = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  for (const id of planetIds) {
    const pos = planetAu(id, jd, accuracy);
    bodies[id] = { id, au: pos.au, ok: pos.ok, reason: pos.reason, kind: 'jpl', elements: pos.elements };
  }

  const emb = planetAu('emb', jd, accuracy);
  const moonSep = circularOffset(MOON_ORBITS.moon, jd);
  const mu = MOON_MU['earth-moon'];
  const earthAu = sub(emb.au, scale(moonSep.au, mu));
  const moonAu = add(emb.au, scale(moonSep.au, 1 - mu));
  bodies.earth = {
    id: 'earth',
    au: earthAu,
    ok: emb.ok,
    reason: emb.reason,
    kind: 'emb-offset',
    embAu: emb.au,
    elements: emb.elements,
  };
  bodies.moon = {
    id: 'moon',
    au: moonAu,
    ok: true,
    kind: 'satellite',
    parent: 'earth',
    relativeAu: sub(moonAu, earthAu),
    theta: moonSep.theta,
  };

  for (const id of Object.keys(SIMPLE_ORBITS)) {
    if (id === 'pluto') continue;
    const pos = simplePosition(SIMPLE_ORBITS[id], jd);
    bodies[id] = { id, au: pos.au, ok: pos.ok, reason: pos.reason, kind: 'illustrative' };
  }

  const plutoBary = simplePosition(SIMPLE_ORBITS.pluto, jd);
  const charonSep = circularOffset(MOON_ORBITS.charon, jd);
  const muC = MOON_MU['pluto-charon'];
  const plutoAu = sub(plutoBary.au, scale(charonSep.au, muC));
  const charonAu = add(plutoBary.au, scale(charonSep.au, 1 - muC));
  bodies.pluto = { id: 'pluto', au: plutoAu, ok: plutoBary.ok, kind: 'barycenter-offset', baryAu: plutoBary.au };
  bodies.charon = {
    id: 'charon',
    au: charonAu,
    ok: true,
    kind: 'satellite',
    parent: 'pluto',
    relativeAu: sub(charonAu, plutoAu),
    theta: charonSep.theta,
  };

  for (const [id, orbit] of Object.entries(MOON_ORBITS)) {
    if (id === 'moon' || id === 'charon') continue;
    const parentId = getBody(id).parent;
    const parent = bodies[parentId];
    const sep = circularOffset(orbit, jd);
    if (!parent?.au) {
      bodies[id] = { id, au: null, ok: false, reason: 'parent', kind: 'satellite', parent: parentId };
      continue;
    }
    const au = add(parent.au, sep.au);
    bodies[id] = {
      id,
      au,
      ok: parent.ok !== false,
      kind: 'satellite',
      parent: parentId,
      relativeAu: sep.au,
      theta: sep.theta,
    };
  }

  if (bodies['classroom-comet']?.au) {
    bodies['classroom-comet'].activity = cometActivity(len(bodies['classroom-comet'].au));
    bodies['classroom-comet'].hypothetical = true;
  }

  const value = { ok: true, jd, accuracy, bodies };
  cache.set(key, value);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  return value;
}

export function bodyAu(id, jd, accuracy = 'primary') {
  const system = systemAt(jd, accuracy);
  return system.bodies[id] || null;
}

export function clearEphemerisCache() {
  cache.clear();
}

export function sampleOrbitAu(id, jd, accuracy = 'primary', count = 160) {
  const body = getBody(id);
  if (!body) return [];
  if (body.jpl && JPL_ELEMENTS[body.jpl]) {
    const pack = JPL_ELEMENTS[body.jpl];
    const el = accuracy === 'extended' ? pack.extended : pack.primary;
    const k = jplElementsAt(el, jd);
    const pts = [];
    for (let i = 0; i <= count; i += 1) {
      const pos = orbitAtMeanAnomaly({
        a: k.a,
        e: k.e,
        iDeg: k.iDeg,
        varpiDeg: k.varpiDeg,
        omegaNodeDeg: k.omegaNodeDeg,
        meanAnomalyDeg: (360 * i) / count,
      });
      if (pos.au) pts.push(pos.au);
    }
    return pts;
  }
  if (body.simple && SIMPLE_ORBITS[body.simple]) {
    const el = SIMPLE_ORBITS[body.simple];
    const pts = [];
    for (let i = 0; i <= count; i += 1) {
      const pos = orbitAtMeanAnomaly({
        a: el.a,
        e: el.e,
        iDeg: el.i,
        varpiDeg: el.varpi,
        omegaNodeDeg: el.Omega,
        meanAnomalyDeg: (360 * i) / count,
      });
      if (pos.au) pts.push(pos.au);
    }
    return pts;
  }
  return [];
}

export function parentRelativeAu(id, jd, accuracy = 'primary') {
  const row = bodyAu(id, jd, accuracy);
  if (!row) return { ok: false, reason: 'missing' };
  if (row.relativeAu) return { ok: true, au: row.relativeAu, parent: row.parent };
  const body = BODY_BY_ID[id];
  if (!body?.parent || body.parent === 'sun') {
    return { ok: true, au: row.au, parent: 'sun', heliocentric: true };
  }
  const parent = bodyAu(body.parent, jd, accuracy);
  if (!parent?.au || !row.au) return { ok: false, reason: 'missing' };
  return { ok: true, au: sub(row.au, parent.au), parent: body.parent };
}
