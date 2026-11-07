import * as THREE from 'three';
import { makeCanvasTexture } from '../world/materials.js';
import { CAR_SPECS } from '../physics/vehicle-physics.js';

export const CAR_LIVERIES = [
  { number: '04', name: 'Rosso Solare',   primary: '#b81924', secondary: '#f4efe6', accent: '#ffb649', caliper: '#eab308' },
  { number: '11', name: 'Bianco Perla',   primary: '#ece8e0', secondary: '#1c222b', accent: '#d93829', caliper: '#dc2626' },
  { number: '19', name: 'Azzurro Costa',  primary: '#164ea6', secondary: '#f4efe6', accent: '#f5a638', caliper: '#f59e0b' },
  { number: '27', name: 'Giallo Amalfi',  primary: '#e08e14', secondary: '#1a1e24', accent: '#fff3db', caliper: '#dc2626' },
  { number: '58', name: 'Verde Oliva',    primary: '#14593f', secondary: '#efe7d6', accent: '#d89b3c', caliper: '#eab308' },
  { number: '84', name: 'Grigio Titanio', primary: '#5e6875', secondary: '#161a20', accent: '#eb5e38', caliper: '#ea580c' }
];

function smoothstep(e0, e1, x) {
  const denom = e1 - e0;
  if (Math.abs(denom) < 1e-6) return x >= e1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - e0) / denom));
  return t * t * (3 - 2 * t);
}

// Smooth C^inf maximum to blend wheel-arch clearance into fender beltline without a sharp ridge
function smax(a, b, k = 0.045) {
  const d = a - b;
  return 0.5 * (a + b + Math.sqrt(d * d + k * k));
}

// 1024x1024 Metallic Flake Base Paint Texture (clean solid metallic without decals, for mirrors/spoilers/trim)
function createSolidPaintTexture(primaryHex) {
  return makeCanvasTexture((ctx, S) => {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) {
      const px = (i * 7919) % S;
      const py = (i * 104729) % S;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(px, py, 2, 2);
    }
  }, 1024, true, 1, 1);
}

// 1024x1024 Racing Livery + Bilateral Non-Mirrored Door Number Roundel Texture
// Left side (+X): U = t * 0.5 in [0 .. 0.5] (0.5 = roof/hood centerline)
// Right side (-X): U = 1.0 - t * 0.5 in [0.5 .. 1.0] (0.5 = roof/hood centerline)
// V = u in [0..1] (0 = rear tail, 0.5 = mid-door, 1.0 = front nose)
function createLiveryTexture(livery) {
  return makeCanvasTexture((ctx, S) => {
    ctx.fillStyle = livery.primary;
    ctx.fillRect(0, 0, S, S);

    // Fine metallic clearcoat flake
    for (let i = 0; i < 6500; i++) {
      const px = (i * 7919) % S;
      const py = (i * 104729) % S;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.032)';
      ctx.fillRect(px, py, 2, 2);
    }

    // Center racing stripe + twin accent pinstripes along hood, roof & rear deck (U around 0.50)
    ctx.fillStyle = livery.secondary;
    ctx.fillRect(S * 0.482, S * 0.05, S * 0.036, S * 0.89);
    ctx.fillStyle = livery.accent;
    ctx.fillRect(S * 0.470, S * 0.05, S * 0.007, S * 0.89);
    ctx.fillRect(S * 0.523, S * 0.05, S * 0.007, S * 0.89);

    // Sculpted lower door / rocker aero graphic on BOTH left (U ~ 0.13) and right (U ~ 0.87) sides
    ctx.fillStyle = livery.secondary;
    ctx.fillRect(S * 0.118, S * 0.27, S * 0.022, S * 0.45);
    ctx.fillRect(S * 0.860, S * 0.27, S * 0.022, S * 0.45);
    ctx.fillStyle = livery.accent;
    ctx.fillRect(S * 0.143, S * 0.29, S * 0.008, S * 0.41);
    ctx.fillRect(S * 0.849, S * 0.29, S * 0.008, S * 0.41);

    // Subtle dark panel shutlines for hood & door seams
    ctx.fillStyle = 'rgba(10, 12, 16, 0.34)';
    ctx.fillRect(S * 0.09, S * 0.365, S * 0.18, 2);
    ctx.fillRect(S * 0.73, S * 0.365, S * 0.18, 2);
    ctx.fillRect(S * 0.09, S * 0.625, S * 0.18, 2);
    ctx.fillRect(S * 0.73, S * 0.625, S * 0.18, 2);

    // Upright, non-mirrored Door Number Roundel on Left Door (U=0.195) AND Right Door (U=0.805)
    const drawDoorRoundel = (uCenter, rotSign) => {
      const cx = S * uCenter;
      const cy = S * 0.49;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotSign * Math.PI * 0.5);
      ctx.scale(1.0, 0.54);
      ctx.beginPath();
      ctx.arc(0, 0, S * 0.066, 0, Math.PI * 2);
      ctx.fillStyle = '#f7f3eb';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = livery.accent;
      ctx.stroke();

      ctx.fillStyle = '#14181f';
      ctx.font = `900 ${Math.round(S * 0.074)}px Bahnschrift, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(livery.number, 0, 3);
      ctx.restore();
    };

    drawDoorRoundel(0.195, +1);
    drawDoorRoundel(0.805, -1);
  }, 1024, true, 1, 1);
}

function createDarkTrimTexture() {
  return makeCanvasTexture((ctx, S) => {
    ctx.fillStyle = '#191d24';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) {
      for (let x = 0; x < S; x += 8) {
        const odd = ((x + y) / 8) % 2 === 0;
        ctx.fillStyle = odd ? '#222730' : '#14171d';
        ctx.fillRect(x, y, 7, 7);
      }
    }
  }, 1024, true, 2, 2);
}

// 1024x1024 Deep Automotive Honeycomb Sport Intake Grille Texture
function createHoneycombGrilleTexture() {
  return makeCanvasTexture((ctx, S) => {
    ctx.fillStyle = '#090b0f';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#2d333f';
    ctx.lineWidth = 4;
    const stepX = 36;
    const stepY = 31;
    for (let row = -1; row < S / stepY + 2; row++) {
      for (let col = -1; col < S / stepX + 2; col++) {
        const cx = col * stepX + (row % 2 === 0 ? 0 : stepX * 0.5);
        const cy = row * stepY;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const px = cx + Math.cos(a) * 18;
          const py = cy + Math.sin(a) * 18;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }, 1024, true, 2, 1);
}

function createTireAlbedoTexture() {
  return makeCanvasTexture((ctx, S) => {
    ctx.fillStyle = '#181a1e';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 16) {
      ctx.fillStyle = i % 32 === 0 ? '#121417' : '#202329';
      ctx.fillRect(i, 0, 10, S);
    }
    ctx.fillStyle = '#292d35';
    ctx.fillRect(0, S * 0.14, S, 10);
    ctx.fillRect(0, S * 0.84, S, 10);
  }, 1024, true, 2, 2);
}

function createBrakeDiscTexture() {
  return makeCanvasTexture((ctx, S) => {
    ctx.fillStyle = '#9aa1aa';
    ctx.fillRect(0, 0, S, S);
    const cx = S * 0.5;
    const cy = S * 0.5;
    for (let r = S * 0.18; r < S * 0.48; r += 4) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = r % 8 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(30,35,42,0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#1c2026';
    for (let a = 0; a < 24; a++) {
      const baseA = (a / 24) * Math.PI * 2;
      for (let k = 0; k < 4; k++) {
        const rr = S * (0.25 + k * 0.052);
        const ang = baseA + k * 0.045;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 1024, true, 1, 1);
}

// Helper: Ensures every emitted triangle (i0, i1, i2) has normal pointing along desired outward reference vector
function pushOutwardTri(indices, positions, i0, i1, i2, refCenterX, refCenterY, refCenterZ) {
  const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
  const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
  const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const mx = (ax + bx + cx) / 3 - refCenterX;
  const my = (ay + by + cy) / 3 - refCenterY;
  const mz = (az + bz + cz) / 3 - refCenterZ;
  if (nx * mx + ny * my + nz * mz >= 0) {
    indices.push(i0, i1, i2);
  } else {
    indices.push(i0, i2, i1);
  }
}

function pushOutwardQuad(indices, positions, a, b, c, d, refCenterX, refCenterY, refCenterZ) {
  if (a !== b && b !== c && a !== c) {
    pushOutwardTri(indices, positions, a, b, c, refCenterX, refCenterY, refCenterZ);
  }
  if (b !== d && d !== c && b !== c) {
    pushOutwardTri(indices, positions, b, d, c, refCenterX, refCenterY, refCenterZ);
  }
}

// Parametric Automotive Profile Evaluators for Model A ("gt" Fastback Coupe) & Model B ("hatch" Sport Hot Hatch)
function evaluateBodyStation(modelId, u) {
  const spec = CAR_SPECS[modelId];
  const L = spec.length;
  // Slightly shorter core tube z span so curved nose/tail bows reach exact spec.length cleanly
  const z = (u - 0.5) * (L * 0.945);
  const halfWBase = spec.width * 0.5;
  const frontAxleZ = spec.wheelBase * 0.5;
  const rearAxleZ = -spec.wheelBase * 0.5;
  const wheelR = spec.wheelRadius;

  // Plan-view taper at nose (u->1) & tail (u->0) WITHOUT pinching to zero!
  // Keeps wide, planted European sports car front & rear bumper stance!
  const noseTaper = 0.77 + 0.23 * smoothstep(1.0, 0.80, u);
  const tailTaper = 0.85 + 0.15 * smoothstep(0.0, 0.14, u);
  const planEnvelope = noseTaper * tailTaper;

  const dFront = Math.abs(z - frontAxleZ);
  const dRear = Math.abs(z - rearAxleZ);
  const archR = wheelR + 0.068;
  const flareFront = Math.exp(-(dFront * dFront) / (archR * archR * 1.45)) * (modelId === 'hatch' ? 0.064 : 0.072);
  const flareRear = Math.exp(-(dRear * dRear) / (archR * archR * 1.55)) * (modelId === 'hatch' ? 0.072 : 0.088);
  const doorPinch = Math.exp(-(z * z) / 0.58) * 0.042;

  const halfW = (halfWBase - 0.048) * planEnvelope + flareFront + flareRear - doorPinch;

  // Circular wheel-arch cutout along lower rocker sill
  let archCutY = 0.0;
  let archLipFlare = 0.0;
  for (const axleZ of [frontAxleZ, rearAxleZ]) {
    const dz = Math.abs(z - axleZ);
    if (dz < archR) {
      const h = Math.sqrt(Math.max(0, archR * archR - dz * dz));
      archCutY = Math.max(archCutY, h);
      archLipFlare = Math.max(archLipFlare, smoothstep(archR, archR * 0.48, dz) * 0.024);
    }
  }

  // Smooth Gaussian arch clearance for beltline (eliminates sharp derivative ridge behind front wheel!)
  const archClearFront = Math.exp(-(dFront * dFront) / (archR * archR * 1.30)) * (archR + 0.335);
  const archClearRear = Math.exp(-(dRear * dRear) / (archR * archR * 1.35)) * (archR + 0.350);
  const smoothArchBeltMin = Math.max(archClearFront, archClearRear);

  const sillY = 0.135 + smoothstep(0.86, 1.0, u) * 0.042 + smoothstep(0.12, 0.0, u) * 0.065;
  let beltY, topY, roofHalfW, cabinMask = 0;

  if (modelId === 'gt') {
    // Sleek Low-Slung European GT Fastback Coupe (height ~1.25 m, long sculpted hood, muscular rear haunches)
    const noseDrop = smoothstep(0.66, 1.0, u);
    const rawBelt = 0.775 - noseDrop * 0.30 + flareRear * 0.85 + flareFront * 0.55 + smoothstep(0.28, 0.05, u) * 0.045
      - smoothstep(0.05, 0.0, u) * 0.045;
    beltY = smax(rawBelt, smoothArchBeltMin, 0.048);

    const cabinRise = smoothstep(0.685, 0.495, u);
    const cabinFall = 1.0 - smoothstep(0.37, 0.125, u);
    cabinMask = Math.max(0, Math.min(1, cabinRise * cabinFall));

    const hoodProfile = 0.45 + 0.345 * (1.0 - Math.pow(Math.max(0, (u - 0.66) / 0.34), 1.32));
    const rearDeck = 0.835 - 0.11 * Math.pow(Math.max(0, (0.08 - u) / 0.08), 1.5);
    const baseDeck = u >= 0.66 ? hoodProfile : (u <= 0.13 ? rearDeck : (rearDeck + (0.795 - rearDeck) * ((u - 0.13) / 0.53)));
    topY = smax(beltY + 0.036, baseDeck + cabinMask * (1.255 - baseDeck), 0.025);
    roofHalfW = halfW * (0.61 + 0.16 * (1.0 - cabinMask));
  } else {
    // Muscular Rally-Tarmac Hot Hatch (height ~1.38 m, compact hood, flat rally roof, steep hatch tailgate)
    const noseDrop = smoothstep(0.70, 1.0, u);
    const rawBelt = 0.835 - noseDrop * 0.29 + flareRear * 0.78 + flareFront * 0.55 - smoothstep(0.05, 0.0, u) * 0.055;
    beltY = smax(rawBelt, smoothArchBeltMin + 0.02, 0.048);

    const cabinRise = smoothstep(0.70, 0.525, u);
    const cabinFall = 1.0 - smoothstep(0.155, 0.038, u);
    cabinMask = Math.max(0, Math.min(1, cabinRise * cabinFall));

    const hoodProfile = 0.50 + 0.345 * (1.0 - Math.pow(Math.max(0, (u - 0.68) / 0.32), 1.28));
    const rearTail = 0.825 - 0.12 * Math.pow(Math.max(0, (0.06 - u) / 0.06), 1.45);
    const baseDeck = u >= 0.68 ? hoodProfile : rearTail;
    topY = smax(beltY + 0.038, baseDeck + cabinMask * (1.375 - baseDeck), 0.025);
    roofHalfW = halfW * (0.67 + 0.13 * (1.0 - cabinMask));
  }

  return { z, u, halfW, sillY, archCutY, archLipFlare, beltY, topY, roofHalfW, cabinMask };
}

// Evaluates pure smooth outer body surface at station `st` and cross-section parameter `t in [0..1]`
// t = 0.00: bottom undertray centerline
// t = 0.18: outer rocker sill / wheel-arch lip
// t = 0.54: shoulder beltline
// t = 0.76: A-pillar / roof-rail / C-pillar crown
// t = 1.00: hood / windshield / roof / rear-deck centerline
function evalHalfSectionPoint(st, t, modelId) {
  const wheelCenterY = 0.345;
  const sillOuterY = Math.max(st.sillY, wheelCenterY * 0.22 + st.archCutY * 0.98);

  let x, y;
  if (t < 0.18) {
    const f = t / 0.18;
    x = st.halfW * 0.88 * f;
    y = st.sillY + (sillOuterY - st.sillY) * smoothstep(0.65, 1.0, f);
  } else if (t < 0.54) {
    const f = (t - 0.18) / 0.36;
    const sideBulge = Math.sin(Math.PI * f) * (0.036 + st.archLipFlare);
    const coveIndent = (modelId === 'gt' && st.u > 0.28 && st.u < 0.62)
      ? Math.sin(Math.PI * f) * Math.sin(Math.PI * ((st.u - 0.28) / 0.34)) * 0.044
      : 0.0;
    x = st.halfW * (0.88 + 0.12 * smoothstep(0, 0.42, f)) + sideBulge - coveIndent;
    y = sillOuterY + (st.beltY - sillOuterY) * f;
  } else if (t < 0.76) {
    // Greenhouse tumblehome (side windows & pillars)
    const f = (t - 0.54) / 0.22;
    const ease = smoothstep(0, 1, f);
    x = st.halfW + (st.roofHalfW - st.halfW) * ease;
    y = st.beltY + (st.topY - 0.028 - st.beltY) * Math.pow(f, 0.88);
  } else {
    // Roof / Windshield / Hood crown to top centerline (x -> 0)
    const f = (t - 0.76) / 0.24;
    x = st.roofHalfW * (1.0 - f);
    const powerDome = (st.u > 0.69 && st.u < 0.95 && f > 0.30)
      ? Math.sin(((st.u - 0.69) / 0.26) * Math.PI) * Math.sin(((f - 0.30) / 0.70) * Math.PI) * 0.024
      : 0.0;
    y = (st.topY - 0.028) + 0.028 * Math.sin(f * Math.PI * 0.5) + powerDome;
  }

  // Smooth aerodynamic plan-view & side-view rounded nose (+Z) and tail (-Z): dz/dx === 0 at x = 0!
  const xNorm = Math.min(1.0, Math.abs(x) / Math.max(0.15, st.halfW));
  // Vertical nose crown peaks around bumper rub-strip (t ~ 0.42) so upper hood edge & lower splitter roll smoothly!
  const noseVertCrown = 0.35 + 0.65 * Math.sin(Math.max(0, Math.min(1, (t - 0.06) / 0.78)) * Math.PI);
  const noseBow = smoothstep(0.76, 1.0, st.u) * (0.35 + 0.65 * (1.0 - xNorm * xNorm)) * noseVertCrown * (modelId === 'gt' ? 0.135 : 0.105);
  const tailBow = smoothstep(0.15, 0.0, st.u) * (1.0 - xNorm * xNorm) * 0.052;
  const z = st.z + noseBow - tailBow;

  return [x, y, z];
}

// Determines whether a surface quad centered at (u, t) with station `st` is an open window pane!
// Notice t in [0.722 .. 0.792] is NEVER cut: it forms the unbroken painted A-pillar -> Roof-Rail -> C-pillar arch!
function isWindowAperture(modelId, u, t, st) {
  if (t < 0.562) return false;
  const ghHeight = st.topY - st.beltY;

  if (modelId === 'gt') {
    // 1. Raked Front Windshield (framed by left & right painted A-pillars at t <= 0.792)
    if (u > 0.505 && u < 0.665 && t > 0.792) return true;
    // 2. Side Front Door Window & Rear Coupe Quarter Window (separated by painted B-pillar at u in [0.352..0.382])
    if (t > 0.565 && t < 0.722 && ghHeight > 0.105) {
      const inFrontDoorWin = (u > 0.382 && u < 0.630);
      const inRearQuarterWin = (u > 0.220 && u < 0.352);
      if (inFrontDoorWin || inRearQuarterWin) return true;
    }
    // 3. Fastback Rear Glass (framed by left & right painted C-pillars at t <= 0.795)
    if (u > 0.150 && u < 0.335 && t > 0.795) return true;
  } else {
    // 1. Hot-Hatch Windshield
    if (u > 0.525 && u < 0.682 && t > 0.792) return true;
    // 2. Front & Rear Side Windows (separated by painted B-pillar at u in [0.342..0.372])
    if (t > 0.565 && t < 0.722 && ghHeight > 0.105) {
      const inFrontWin = (u > 0.372 && u < 0.645);
      const inRearWin = (u > 0.132 && u < 0.342);
      if (inFrontWin || inRearWin) return true;
    }
    // 3. Steep Hot-Hatch Tailgate Window
    if (u > 0.048 && u < 0.148 && t > 0.788 && ghHeight > 0.13) return true;
  }
  return false;
}

// Evaluates exact bumper fascia Z surface at any (x, y) on Front (isFront=true) or Rear (isFront=false)
// Matches the structured horizontal-strip bumper cap in buildCarShellGeometries!
function evalBumperSurfaceZ(modelId, stations, isFront, x, y) {
  const st = isFront ? stations[stations.length - 1] : stations[0];
  const signZ = isFront ? 1 : -1;
  // Find t in [0.18 .. 0.80] matching height y on the outer bumper edge
  let bestT = 0.36;
  let bestDist = 1e9;
  for (let i = 0; i <= 32; i++) {
    const candT = 0.16 + (i / 32) * 0.68;
    const [, py] = evalHalfSectionPoint(st, candT, modelId);
    const d = Math.abs(py - y);
    if (d < bestDist) {
      bestDist = d;
      bestT = candT;
    }
  }
  const [edgeX, , edgeZ] = evalHalfSectionPoint(st, bestT, modelId);
  const fx = Math.min(1.0, Math.abs(x) / Math.max(0.10, edgeX));
  const yFrac = Math.max(0, Math.min(1, (y - st.sillY) / Math.max(0.15, st.topY - st.sillY)));
  const vertArch = Math.sin(yFrac * Math.PI);
  const crown = (isFront ? 0.036 : 0.026) * (1.0 - fx * fx) * vertArch;
  return edgeZ + signZ * crown;
}

// Builds a curved 3D fascia detail (grille, intake, light housing, LED blade, rear valance) conformed strictly
// to the front or rear bumper curvature with bevel lip so it NEVER clips or splits!
function buildConformedBumperPanel(modelId, stations, isFront, xMin, xMax, yBotFn, yTopFn, zProtrude, bevelDepth = 0.014, nx = 16, ny = 6) {
  const signZ = isFront ? 1 : -1;
  const cols = nx + 1;
  const rows = ny + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);

  for (let iy = 0; iy < rows; iy++) {
    const fy = iy / ny;
    // Edge rows iy=0, iy=ny tuck back onto bumper; interior rows sit proud by zProtrude
    const edgeY = Math.min(fy, 1.0 - fy);
    const lipY = smoothstep(0.0, 0.22, edgeY);

    for (let ix = 0; ix < cols; ix++) {
      const fx = ix / nx;
      const edgeX = Math.min(fx, 1.0 - fx);
      const lipX = smoothstep(0.0, 0.14, edgeX);
      const lip = lipX * lipY;

      const x = xMin + (xMax - xMin) * fx;
      const y0 = yBotFn(fx, x);
      const y1 = yTopFn(fx, x);
      const y = y0 + (y1 - y0) * fy;

      const baseZ = evalBumperSurfaceZ(modelId, stations, isFront, x, y);
      const z = baseZ + signZ * (zProtrude * lip - bevelDepth * (1.0 - lip));

      const idx = iy * cols + ix;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = fx;
      uvs[idx * 2 + 1] = fy;
    }
  }

  const midX = 0.5 * (xMin + xMax);
  const midY = 0.5 * (yBotFn(0.5, midX) + yTopFn(0.5, midX));
  const refZ = evalBumperSurfaceZ(modelId, stations, isFront, midX, midY) - signZ * 0.35;

  const indices = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = (iy + 1) * cols + ix;
      const d = c + 1;
      pushOutwardQuad(indices, positions, a, b, c, d, midX, midY, refZ);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Builds a curved 3D detail (wrap-around aerodynamic headlight housing & LED DRL blade) conformed directly
// to the parametric outer body surface (u, t) so it wraps sleekly along the sloped front fender/hood corner!
function buildConformedBodySurfacePatch(modelId, uMin, uMax, tMinFn, tMaxFn, sideSign, normalOffset, bevelTuck = 0.006, nu = 12, nt = 6) {
  const cols = nu + 1;
  const rows = nt + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);

  for (let it = 0; it < rows; it++) {
    const ft = it / nt;
    const lipT = smoothstep(0.0, 0.24, Math.min(ft, 1.0 - ft));
    for (let iu = 0; iu < cols; iu++) {
      const fu = iu / nu;
      const lipU = smoothstep(0.0, 0.18, Math.min(fu, 1.0 - fu));
      const lip = lipT * lipU;

      const u = uMin + (uMax - uMin) * fu;
      const st = evaluateBodyStation(modelId, u);
      const t0 = tMinFn(fu);
      const t1 = tMaxFn(fu);
      const t = t0 + (t1 - t0) * ft;

      const [px, py, pz] = evalHalfSectionPoint(st, t, modelId);
      const wx = px * sideSign;

      // Outward vector from nose/fender core
      let nx = wx * 0.65;
      let ny = py - 0.30;
      let nz = u > 0.5 ? 0.45 : -0.45;
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      nx /= nLen; ny /= nLen; nz /= nLen;

      const disp = normalOffset * lip - bevelTuck * (1.0 - lip);
      const idx = it * cols + iu;
      positions[idx * 3] = wx + nx * disp;
      positions[idx * 3 + 1] = py + ny * disp;
      positions[idx * 3 + 2] = pz + nz * disp;
      uvs[idx * 2] = fu;
      uvs[idx * 2 + 1] = ft;
    }
  }

  const stMid = evaluateBodyStation(modelId, 0.5 * (uMin + uMax));
  const indices = [];
  for (let it = 0; it < nt; it++) {
    for (let iu = 0; iu < nu; iu++) {
      const a = it * cols + iu;
      const b = a + 1;
      const c = (it + 1) * cols + iu;
      const d = c + 1;
      pushOutwardQuad(indices, positions, a, b, c, d, 0, 0.32, stMid.z - 0.15);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Simultaneously builds:
// 1. bodyGeo: Outer clearcoat painted body shell with clean open window apertures & seamless horizontal-grid front/rear bumpers
// 2. glassGeo: Exact shared-topology flush curved window panes (zero gap, zero stair-step mismatch!)
// 3. linerGeo: Dark matte charcoal inner roof headliner & inner A/B/C pillars so cabin interior has zero backface voids!
function buildCarShellGeometries(modelId) {
  const U_STEPS = 116;
  const HALF_T = 43; // M = 42
  const M = HALF_T - 1;
  const RING = M * 2; // 84 vertices around closed perimeter ring
  const CAP_COLS = 12; // 11 interior columns bridging +X to -X across front & rear bumpers seamlessly!
  const INT_COLS = CAP_COLS - 1;

  const stations = [];
  for (let iu = 0; iu < U_STEPS; iu++) {
    stations.push(evaluateBodyStation(modelId, iu / (U_STEPS - 1)));
  }

  // Body vertices: main tube + rear bumper interior grid ((M-1)*INT_COLS) + front bumper interior grid ((M-1)*INT_COLS)
  const capVertCount = (M - 1) * INT_COLS;
  const totalBodyVerts = U_STEPS * RING + capVertCount * 2;
  const rearCapStart = U_STEPS * RING;
  const frontCapStart = rearCapStart + capVertCount;

  const bodyPos = new Float32Array(totalBodyVerts * 3);
  const bodyUvs = new Float32Array(totalBodyVerts * 2);

  // Glass & Inner Cabin Liner vertices share the exact tube grid shape, slightly offset along radial cabin outward direction
  const tubeVerts = U_STEPS * RING;
  const glassPos = new Float32Array(tubeVerts * 3);
  const glassUvs = new Float32Array(tubeVerts * 2);
  const linerPos = new Float32Array(tubeVerts * 3);
  const linerUvs = new Float32Array(tubeVerts * 2);

  const ringT = new Float32Array(RING);
  const ringSide = new Int8Array(RING);
  for (let ir = 0; ir < RING; ir++) {
    if (ir <= M) {
      ringSide[ir] = 1; // +X (Left)
      ringT[ir] = ir / M;
    } else {
      ringSide[ir] = -1; // -X (Right)
      ringT[ir] = (RING - ir) / M;
    }
  }

  for (let iu = 0; iu < U_STEPS; iu++) {
    const st = stations[iu];
    const cabCenterY = 0.58;
    for (let ir = 0; ir < RING; ir++) {
      const sideSign = ringSide[ir];
      const t = ringT[ir];
      const [px, py, pz] = evalHalfSectionPoint(st, t, modelId);
      const wx = px * sideSign;

      const idx = iu * RING + ir;
      bodyPos[idx * 3] = wx;
      bodyPos[idx * 3 + 1] = py;
      bodyPos[idx * 3 + 2] = pz;

      const uCoord = sideSign > 0 ? t * 0.5 : 1.0 - t * 0.5;
      bodyUvs[idx * 2] = uCoord;
      bodyUvs[idx * 2 + 1] = st.u;

      // Radial outward unit vector from cabin core for crisp 3.5 mm window recess & 18 mm inner headliner offset
      let rx = wx;
      let ry = py - cabCenterY;
      const rLen = Math.hypot(rx, ry) || 1.0;
      rx /= rLen;
      ry /= rLen;

      glassPos[idx * 3] = wx - rx * 0.0035;
      glassPos[idx * 3 + 1] = py - ry * 0.0035;
      glassPos[idx * 3 + 2] = pz;
      glassUvs[idx * 2] = uCoord;
      glassUvs[idx * 2 + 1] = st.u;

      linerPos[idx * 3] = wx - rx * 0.018;
      linerPos[idx * 3 + 1] = py - ry * 0.018;
      linerPos[idx * 3 + 2] = pz;
      linerUvs[idx * 2] = uCoord;
      linerUvs[idx * 2 + 1] = st.u;
    }
  }

  const bodyIndices = [];
  const glassIndices = [];
  const linerIndices = [];

  for (let iu = 0; iu < U_STEPS - 1; iu++) {
    const st0 = stations[iu];
    const st1 = stations[iu + 1];
    const uMid = 0.5 * (st0.u + st1.u);
    const midZ = 0.5 * (st0.z + st1.z);
    const stMid = {
      beltY: 0.5 * (st0.beltY + st1.beltY),
      topY: 0.5 * (st0.topY + st1.topY)
    };

    for (let ir = 0; ir < RING; ir++) {
      const nextIr = (ir + 1) % RING;
      const a = iu * RING + ir;
      const b = iu * RING + nextIr;
      const c = (iu + 1) * RING + ir;
      const d = (iu + 1) * RING + nextIr;

      // Careful across top centerline (ir = M-1 -> M and M -> M+1): both have t near 1.0
      const tMid = 0.5 * (ringT[ir] + ringT[nextIr]);
      const isWin = isWindowAperture(modelId, uMid, tMid, stMid);

      if (isWin) {
        pushOutwardQuad(glassIndices, glassPos, a, b, c, d, 0, 0.58, midZ);
      } else {
        pushOutwardQuad(bodyIndices, bodyPos, a, b, c, d, 0, 0.44, midZ);
        if (uMid > 0.035 && uMid < 0.705 && tMid > 0.52) {
          pushOutwardQuad(linerIndices, linerPos, a, b, c, d, 0, 0.56, midZ);
        }
      }
    }
  }

  // Seamless Horizontal-Strip Bumper Caps at Rear (iu = 0) & Front (iu = U_STEPS - 1)
  // Bridges Left perimeter L(k) = ringBase + k to Right perimeter R(k) = ringBase + (RING - k) % RING
  // with dz/dx === 0 across x = 0 so zero vertical seam can EVER exist!
  const buildSmoothBumperCap = (iu, capStartIdx, isFront) => {
    const st = stations[iu];
    const ringBase = iu * RING;
    const signZ = isFront ? 1 : -1;
    const maxCrown = isFront ? 0.036 : 0.026;

    // Populate interior vertices for k = 1 .. M - 1, c = 1 .. CAP_COLS - 1
    for (let k = 1; k < M; k++) {
      const lIdx = ringBase + k;
      const lx = bodyPos[lIdx * 3];
      const ly = bodyPos[lIdx * 3 + 1];
      const lz = bodyPos[lIdx * 3 + 2];
      const t = k / M;
      const yFrac = Math.max(0, Math.min(1, (ly - st.sillY) / Math.max(0.15, st.topY - st.sillY)));
      const vertArch = Math.sin(yFrac * Math.PI);

      for (let c = 1; c < CAP_COLS; c++) {
        const fx = 1.0 - (2.0 * c) / CAP_COLS; // +1 (Left) -> 0 (Center) -> -1 (Right)
        const vIdx = capStartIdx + (k - 1) * INT_COLS + (c - 1);
        bodyPos[vIdx * 3] = fx * lx;
        bodyPos[vIdx * 3 + 1] = ly;
        bodyPos[vIdx * 3 + 2] = lz + signZ * maxCrown * (1.0 - fx * fx) * vertArch;

        // Smooth bilateral UV across bumper face (U = 0.5 at centerline x = 0)
        bodyUvs[vIdx * 2] = 0.5 - fx * (0.5 - t * 0.5);
        bodyUvs[vIdx * 2 + 1] = st.u;
      }
    }

    const getCapVert = (k, c) => {
      if (k === 0) return ringBase; // Bottom centerline shared vertex
      if (k === M) return ringBase + M; // Top centerline shared vertex
      if (c === 0) return ringBase + k; // Left outer perimeter shared vertex
      if (c === CAP_COLS) return ringBase + (RING - k); // Right outer perimeter shared vertex
      return capStartIdx + (k - 1) * INT_COLS + (c - 1);
    };

    const refZ = st.z - signZ * 0.40;
    const refY = 0.5 * (st.sillY + st.topY);
    for (let k = 0; k < M; k++) {
      for (let c = 0; c < CAP_COLS; c++) {
        const a = getCapVert(k, c);
        const b = getCapVert(k, c + 1);
        const dTopL = getCapVert(k + 1, c);
        const dTopR = getCapVert(k + 1, c + 1);
        pushOutwardQuad(bodyIndices, bodyPos, a, b, dTopL, dTopR, 0, refY, refZ);
      }
    }
  };

  buildSmoothBumperCap(0, rearCapStart, false);
  buildSmoothBumperCap(U_STEPS - 1, frontCapStart, true);

  const makeGeo = (pos, uv, idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  return {
    stations,
    bodyGeo: makeGeo(bodyPos, bodyUvs, bodyIndices),
    glassGeo: makeGeo(glassPos, glassUvs, glassIndices),
    linerGeo: makeGeo(linerPos, linerUvs, linerIndices)
  };
}

// Dark Enclosed Lower Cabin Tub + Firewall + Dashboard + Center Console + Sport Bucket Seats + Steering Wheel + Parcel Shelf
function buildDarkInteriorGroup(modelId, matteMat) {
  const grp = new THREE.Group();

  // 1. Wide enclosed lower cabin tub up to beltline (seals underbody & wheel wells 100% from cabin view)
  const tubGeo = new THREE.CylinderGeometry(0.68, 0.72, modelId === 'gt' ? 1.95 : 2.10, 20, 2);
  tubGeo.rotateX(Math.PI * 0.5);
  const tub = new THREE.Mesh(tubGeo, matteMat);
  tub.position.set(0, 0.45, modelId === 'gt' ? -0.12 : -0.22);
  tub.scale.set(1.12, 0.44, 1.0);
  grp.add(tub);

  // 2. Sculpted Dashboard Cowl & Instrument Binnacle tucked cleanly inside windshield cowl
  const dashGeo = new THREE.CylinderGeometry(0.20, 0.24, 1.00, 20, 2);
  dashGeo.rotateZ(Math.PI * 0.5);
  const dash = new THREE.Mesh(dashGeo, matteMat);
  dash.position.set(0, modelId === 'gt' ? 0.68 : 0.74, 0.34);
  dash.scale.set(1.0, 0.62, 1.15);
  grp.add(dash);

  const binnacleGeo = new THREE.CapsuleGeometry(0.095, 0.20, 8, 14);
  binnacleGeo.rotateZ(Math.PI * 0.5);
  const binnacle = new THREE.Mesh(binnacleGeo, matteMat);
  binnacle.position.set(0.32, modelId === 'gt' ? 0.78 : 0.84, 0.32);
  binnacle.scale.set(1.0, 0.62, 1.15);
  grp.add(binnacle);

  // 3. Center Transmission Tunnel / Console
  const consoleGeo = new THREE.CapsuleGeometry(0.11, 1.15, 8, 14);
  consoleGeo.rotateX(Math.PI * 0.5);
  const centerConsole = new THREE.Mesh(consoleGeo, matteMat);
  centerConsole.position.set(0, 0.63, 0.0);
  grp.add(centerConsole);

  // 4. Left-Hand Sport Steering Wheel + Column (+X driver side)
  const wheelRimGeo = new THREE.TorusGeometry(0.155, 0.023, 10, 24);
  const stWheel = new THREE.Mesh(wheelRimGeo, matteMat);
  stWheel.position.set(0.34, modelId === 'gt' ? 0.84 : 0.89, 0.23);
  stWheel.rotation.x = -0.34;
  grp.add(stWheel);

  const colGeo = new THREE.CylinderGeometry(0.036, 0.042, 0.24, 12, 1);
  colGeo.rotateX(Math.PI * 0.5 - 0.34);
  const stCol = new THREE.Mesh(colGeo, matteMat);
  stCol.position.set(0.34, modelId === 'gt' ? 0.81 : 0.86, 0.33);
  grp.add(stCol);

  // 5. Twin Sculpted High-Back Racing Bucket Seats with Integrated Headrests (visible in silhouette through glass!)
  const seatTopY = modelId === 'gt' ? 0.83 : 0.89;
  for (const sx of [-0.34, 0.34]) {
    const backGeo = new THREE.CapsuleGeometry(0.175, 0.38, 10, 16);
    const back = new THREE.Mesh(backGeo, matteMat);
    back.position.set(sx, seatTopY, -0.18);
    back.rotation.x = -0.25;
    back.scale.set(1.06, 1.0, 0.44);
    grp.add(back);

    const headGeo = new THREE.CapsuleGeometry(0.105, 0.14, 8, 14);
    const headrest = new THREE.Mesh(headGeo, matteMat);
    headrest.position.set(sx, seatTopY + 0.23, -0.25);
    headrest.rotation.x = -0.18;
    headrest.scale.set(0.95, 1.0, 0.48);
    grp.add(headrest);
  }

  // 6. Rear Parcel Shelf / Trunk Bulkhead under Rear Fastback / Hatch Glass
  const shelfGeo = new THREE.CylinderGeometry(0.56, 0.62, 0.85, 16, 1);
  shelfGeo.rotateX(Math.PI * 0.5);
  const shelf = new THREE.Mesh(shelfGeo, matteMat);
  shelf.position.set(0, modelId === 'gt' ? 0.72 : 0.76, modelId === 'gt' ? -0.95 : -1.18);
  shelf.scale.set(1.12, 0.22, 1.0);
  grp.add(shelf);

  return grp;
}

// Sculpted Airfoil Wing / Spoiler with Verified Outward Winding
function buildCurvedAirfoilWing(span, chord, camber, sweepZ, segsSpan = 28, segsProfile = 18) {
  const positions = new Float32Array((segsSpan + 1) * segsProfile * 3);
  const uvs = new Float32Array((segsSpan + 1) * segsProfile * 2);
  const centers = [];

  for (let is = 0; is <= segsSpan; is++) {
    const fs = (is / segsSpan) * 2 - 1;
    const x = fs * span * 0.5;
    const archY = (1.0 - fs * fs) * camber;
    const zShift = -(fs * fs) * sweepZ;
    centers.push([x, archY + chord * 0.07, zShift]);

    for (let ip = 0; ip < segsProfile; ip++) {
      const ang = (ip / segsProfile) * Math.PI * 2;
      const uChord = 0.5 * (1 + Math.cos(ang));
      const thick = 0.13 * chord * Math.sin(ang) * (0.38 + 0.62 * uChord);
      const z = (uChord - 0.5) * chord + zShift;
      const y = archY + thick + (1.0 - uChord) * chord * 0.14;

      const idx = is * segsProfile + ip;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = (fs + 1) * 0.5;
      uvs[idx * 2 + 1] = ip / segsProfile;
    }
  }

  const indices = [];
  for (let is = 0; is < segsSpan; is++) {
    const cx = 0.5 * (centers[is][0] + centers[is + 1][0]);
    const cy = 0.5 * (centers[is][1] + centers[is + 1][1]);
    const cz = 0.5 * (centers[is][2] + centers[is + 1][2]);
    for (let ip = 0; ip < segsProfile; ip++) {
      const nip = (ip + 1) % segsProfile;
      const a = is * segsProfile + ip;
      const b = is * segsProfile + nip;
      const c = (is + 1) * segsProfile + ip;
      const d = (is + 1) * segsProfile + nip;
      pushOutwardQuad(indices, positions, a, b, c, d, cx, cy, cz);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sleek Swept Trapezoidal Carbon Aero Wing Endplate (replaces round paddle discs; matches Ref 11!)
function buildSweptWingEndplateGeometry() {
  const shape = new THREE.Shape();
  // Coordinates in (z, y) side-profile plane (+z = forward, -z = rearward)
  shape.moveTo(0.14, 0.03);
  shape.quadraticCurveTo(0.17, 0.08, 0.12, 0.105);
  shape.lineTo(-0.18, 0.125);
  shape.quadraticCurveTo(-0.23, 0.125, -0.24, 0.075);
  shape.lineTo(-0.20, -0.075);
  shape.quadraticCurveTo(-0.18, -0.105, -0.13, -0.10);
  shape.lineTo(0.08, -0.045);
  shape.quadraticCurveTo(0.13, -0.03, 0.14, 0.03);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    curveSegments: 8
  });
  // ExtrudeGeometry extrudes along +Z; rotate +90 deg around Y so plate lies in YZ plane with thickness along X!
  geo.rotateY(Math.PI * 0.5);
  geo.center();
  return geo;
}

// High-Detail Wheel + Rounded-Shoulder Tire + Forged Concave Multi-Spoke Rim + Lug Hub + Drilled Rotor + Brembo Caliper
function createWheelAssembly(modelId, wheelRadius, isLeft, mats) {
  const steerKnuckle = new THREE.Group();
  const spinGroup = new THREE.Group();
  steerKnuckle.add(spinGroup);

  const tireWidth = modelId === 'gt' ? 0.285 : 0.255;
  const rimRadius = wheelRadius * 0.68;
  const outSign = isLeft ? 1 : -1;
  const rimMat = modelId === 'gt' ? mats.satinGunmetal : mats.chrome;

  // 1. Rounded-Shoulder Performance Tire with Guaranteed Outward Normals
  const R_SEG = 40;
  const P_SEG = 22;
  const tirePos = new Float32Array(R_SEG * P_SEG * 3);
  const tireUv = new Float32Array(R_SEG * P_SEG * 2);
  const tireIdx = [];

  for (let ir = 0; ir < R_SEG; ir++) {
    const theta = (ir / R_SEG) * Math.PI * 2;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);

    for (let ip = 0; ip < P_SEG; ip++) {
      const fp = (ip / (P_SEG - 1)) * 2 - 1;
      const absFp = Math.abs(fp);
      let r, latX;
      if (absFp < 0.58) {
        const u = absFp / 0.58;
        latX = Math.sign(fp) * (tireWidth * 0.47) * u;
        r = wheelRadius - 0.011 * u * u;
      } else {
        const u = (absFp - 0.58) / 0.42;
        const bulge = Math.sin(u * Math.PI) * 0.017;
        latX = Math.sign(fp) * (tireWidth * 0.47 * (1.0 - 0.12 * u) + bulge);
        r = (wheelRadius - 0.011) * (1.0 - u) + rimRadius * u;
      }

      const idx = ir * P_SEG + ip;
      tirePos[idx * 3] = latX;
      tirePos[idx * 3 + 1] = r * ct;
      tirePos[idx * 3 + 2] = r * st;
      tireUv[idx * 2] = (ir / R_SEG) * 4.0;
      tireUv[idx * 2 + 1] = (fp + 1) * 0.5;
    }
  }

  for (let ir = 0; ir < R_SEG; ir++) {
    const nir = (ir + 1) % R_SEG;
    const midTheta = ((ir + 0.5) / R_SEG) * Math.PI * 2;
    const coreR = (wheelRadius + rimRadius) * 0.48;
    const refY = Math.cos(midTheta) * coreR;
    const refZ = Math.sin(midTheta) * coreR;
    for (let ip = 0; ip < P_SEG - 1; ip++) {
      const a = ir * P_SEG + ip;
      const b = a + 1;
      const c = nir * P_SEG + ip;
      const d = c + 1;
      pushOutwardQuad(tireIdx, tirePos, a, b, c, d, 0, refY, refZ);
    }
  }

  const tireGeo = new THREE.BufferGeometry();
  tireGeo.setAttribute('position', new THREE.BufferAttribute(tirePos, 3));
  tireGeo.setAttribute('uv', new THREE.BufferAttribute(tireUv, 2));
  tireGeo.setIndex(tireIdx);
  tireGeo.computeVertexNormals();
  const tireMesh = new THREE.Mesh(tireGeo, mats.rubber);
  tireMesh.castShadow = true;
  tireMesh.receiveShadow = true;
  spinGroup.add(tireMesh);

  // 2. Machined Outer Rim Lip + Dark Inner Alloy Barrel + Recessed Center Hub Bowl + 5 Chrome Lug Bolts + Concave Spokes
  const lipTorusGeo = new THREE.TorusGeometry(rimRadius - 0.008, 0.014, 12, 36);
  lipTorusGeo.rotateY(Math.PI * 0.5);
  const outerLip = new THREE.Mesh(lipTorusGeo, mats.chrome);
  outerLip.position.x = outSign * (tireWidth * 0.425);
  spinGroup.add(outerLip);

  const barrelGeo = new THREE.CylinderGeometry(rimRadius * 0.96, rimRadius * 0.92, tireWidth * 0.78, 32, 1, true);
  barrelGeo.rotateZ(Math.PI * 0.5);
  const barrelMesh = new THREE.Mesh(barrelGeo, mats.darkBarrel);
  spinGroup.add(barrelMesh);

  const hubGeo = new THREE.CylinderGeometry(0.050, 0.062, 0.048, 20, 1);
  hubGeo.rotateZ(Math.PI * 0.5);
  const hubMesh = new THREE.Mesh(hubGeo, rimMat);
  hubMesh.position.x = outSign * (tireWidth * 0.315);
  spinGroup.add(hubMesh);

  const capGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.054, 16, 1);
  capGeo.rotateZ(Math.PI * 0.5);
  const centerCap = new THREE.Mesh(capGeo, mats.mattePlastic);
  centerCap.position.x = outSign * (tireWidth * 0.320);
  spinGroup.add(centerCap);

  const lugGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 8, 1);
  lugGeo.rotateZ(Math.PI * 0.5);
  for (let l = 0; l < 5; l++) {
    const la = (l / 5) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, mats.chrome);
    lug.position.set(outSign * (tireWidth * 0.340), Math.cos(la) * 0.036, Math.sin(la) * 0.036);
    spinGroup.add(lug);
  }

  const spokeCount = modelId === 'gt' ? 10 : 7;
  const spokeLen = rimRadius - 0.044;
  for (let s = 0; s < spokeCount; s++) {
    const baseAng = (s / spokeCount) * Math.PI * 2 + (modelId === 'gt' ? (s % 2 === 0 ? -0.105 : 0.105) : 0);
    const spkGeo = new THREE.CylinderGeometry(0.011, 0.019, spokeLen, 10, 1);
    const spk = new THREE.Mesh(spkGeo, rimMat);
    const midR = 0.042 + spokeLen * 0.5;
    spk.position.set(outSign * (tireWidth * 0.358), Math.cos(baseAng) * midR, Math.sin(baseAng) * midR);
    spk.rotation.x = baseAng;
    spk.rotation.z = -outSign * 0.135; // Deep forged concave dish angle
    spk.scale.set(0.50, 1.0, modelId === 'gt' ? 1.08 : 1.48);
    spinGroup.add(spk);
  }

  // 3. Cross-Drilled Ventilated Steel Brake Disc Rotor
  const discR = rimRadius * 0.80;
  const discGeo = new THREE.CylinderGeometry(discR, discR, 0.026, 32, 1);
  discGeo.rotateZ(Math.PI * 0.5);
  const discMesh = new THREE.Mesh(discGeo, mats.brakeDisc);
  discMesh.position.x = outSign * (tireWidth * 0.21);
  spinGroup.add(discMesh);

  // 4. Painted 4-Piston Brake Caliper fixed to steering knuckle
  const calGeo = new THREE.TorusGeometry(discR * 0.82, 0.038, 12, 16, 1.12);
  calGeo.rotateY(Math.PI * 0.5);
  const calMesh = new THREE.Mesh(calGeo, mats.caliper);
  calMesh.position.x = outSign * (tireWidth * 0.235);
  calMesh.rotation.x = 0.45;
  steerKnuckle.add(calMesh);

  return { steerKnuckle, spinGroup };
}

export class CarBuilder {
  constructor(matLib) {
    this.matLib = matLib;
    this.darkTrimAlbedo = createDarkTrimTexture();
    this.honeycombAlbedo = createHoneycombGrilleTexture();
    this.tireAlbedo = createTireAlbedoTexture();
    this.brakeDiscAlbedo = createBrakeDiscTexture();

    this.contactShadowTex = makeCanvasTexture((ctx, S) => {
      const g = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.08, S * 0.5, S * 0.5, S * 0.5);
      g.addColorStop(0.0, 'rgba(3, 5, 9, 0.93)');
      g.addColorStop(0.58, 'rgba(4, 6, 11, 0.70)');
      g.addColorStop(0.84, 'rgba(4, 6, 11, 0.24)');
      g.addColorStop(1.0, 'rgba(4, 6, 11, 0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }, 1024, true);

    this.geoCache = {};
  }

  _getModelGeometries(modelId) {
    if (this.geoCache[modelId]) return this.geoCache[modelId];
    const spec = CAR_SPECS[modelId];
    const hw = spec.width * 0.5;

    const { stations, bodyGeo, glassGeo, linerGeo } = buildCarShellGeometries(modelId);
    const stFront = stations[stations.length - 1];
    const stRear = stations[0];
    const fw = stFront.halfW; // Exact front bumper half-width (~0.68m)
    const rw = stRear.halfW;  // Exact rear bumper half-width (~0.77m)

    const wingGeo = modelId === 'gt'
      ? buildCurvedAirfoilWing(1.64, 0.29, 0.030, 0.075, 28, 18)
      : buildCurvedAirfoilWing(1.26, 0.24, 0.018, 0.04, 24, 16);
    const endplateGeo = buildSweptWingEndplateGeometry();
    const splitterGeo = buildCurvedAirfoilWing(modelId === 'gt' ? fw * 2.04 : fw * 1.98, 0.26, -0.005, -0.075, 24, 14);

    // Conformed Front Fascia Meshes (strictly bounded inside `fw` + wrap-around fender/hood Headlights on `(u, t)`!)
    let mainGrilleGeo, upperSlotGeo = null;
    const sideIntakeGeos = [];
    const hlHousingGeos = [];
    const hlDrlGeos = [];

    if (modelId === 'gt') {
      mainGrilleGeo = buildConformedBumperPanel(
        modelId, stations, true, -fw * 0.56, fw * 0.56,
        (fx) => 0.195 + 0.012 * Math.sin(fx * Math.PI),
        (fx) => 0.340 + 0.026 * Math.sin(fx * Math.PI),
        0.011, 0.010, 20, 6
      );
      for (const s of [1, -1]) {
        const x0 = s > 0 ? fw * 0.61 : -fw * 0.87;
        const x1 = s > 0 ? fw * 0.87 : -fw * 0.61;
        sideIntakeGeos.push(buildConformedBumperPanel(
          modelId, stations, true, x0, x1,
          () => 0.210,
          (fx) => {
            const outF = s > 0 ? fx : (1.0 - fx);
            return 0.330 + 0.030 * outF;
          },
          0.010, 0.008, 10, 5
        ));
        // Sleek wrap-around GT headlamp housing + twin-blade LED DRL directly on sloped hood/fender corner (u in 0.895..0.988)
        hlHousingGeos.push(buildConformedBodySurfacePatch(
          modelId, 0.895, 0.988,
          (fu) => 0.49 + 0.06 * fu,
          (fu) => 0.72 + 0.06 * fu,
          s, 0.009, 0.005, 12, 6
        ));
        hlDrlGeos.push(buildConformedBodySurfacePatch(
          modelId, 0.905, 0.984,
          (fu) => 0.53 + 0.06 * fu,
          (fu) => 0.63 + 0.06 * fu,
          s, 0.015, 0.003, 12, 4
        ));
      }
    } else {
      // Hot Hatch: Bold rally hexagonal lower intake + upper radiator slot + wrap-around hot-hatch LED headlamps
      mainGrilleGeo = buildConformedBumperPanel(
        modelId, stations, true, -fw * 0.54, fw * 0.54,
        () => 0.210,
        (fx) => 0.385 + 0.018 * Math.sin(fx * Math.PI),
        0.011, 0.010, 18, 6
      );
      upperSlotGeo = buildConformedBumperPanel(
        modelId, stations, true, -fw * 0.44, fw * 0.44,
        () => 0.435,
        () => 0.482,
        0.010, 0.007, 14, 4
      );
      for (const s of [1, -1]) {
        const x0 = s > 0 ? fw * 0.60 : -fw * 0.86;
        const x1 = s > 0 ? fw * 0.86 : -fw * 0.60;
        sideIntakeGeos.push(buildConformedBumperPanel(
          modelId, stations, true, x0, x1,
          () => 0.225,
          () => 0.365,
          0.010, 0.008, 10, 5
        ));
        hlHousingGeos.push(buildConformedBodySurfacePatch(
          modelId, 0.900, 0.988,
          (fu) => 0.51 + 0.05 * fu,
          (fu) => 0.75 + 0.05 * fu,
          s, 0.009, 0.005, 12, 6
        ));
        hlDrlGeos.push(buildConformedBodySurfacePatch(
          modelId, 0.908, 0.984,
          (fu) => 0.56 + 0.05 * fu,
          (fu) => 0.66 + 0.05 * fu,
          s, 0.015, 0.003, 12, 4
        ));
      }
    }

    // Conformed Rear Fascia Meshes (strictly bounded inside `rw` so corners sit 100% flush!)
    const rearValanceGeo = buildConformedBumperPanel(
      modelId, stations, false, -rw * 0.78, rw * 0.78,
      () => modelId === 'gt' ? 0.44 : 0.52,
      (fx) => (modelId === 'gt' ? 0.61 : 0.68) + 0.02 * Math.sin(fx * Math.PI),
      0.010, 0.010, 22, 5
    );
    const rearDiffuserGeo = buildConformedBumperPanel(
      modelId, stations, false, -rw * 0.82, rw * 0.82,
      () => 0.195,
      (fx) => 0.345 + 0.032 * Math.sin(fx * Math.PI),
      0.013, 0.010, 22, 5
    );

    const tlHousingGeos = [];
    const tlLedGeos = [];
    for (const s of [1, -1]) {
      const tx0 = s > 0 ? rw * 0.28 : -rw * 0.88;
      const tx1 = s > 0 ? rw * 0.88 : -rw * 0.28;
      const baseY = modelId === 'gt' ? 0.650 : 0.735;
      const topY = modelId === 'gt' ? 0.725 : 0.815;
      tlHousingGeos.push(buildConformedBumperPanel(
        modelId, stations, false, tx0, tx1,
        (fx) => {
          const outF = s > 0 ? fx : (1.0 - fx);
          return baseY + 0.020 * outF;
        },
        (fx) => {
          const outF = s > 0 ? fx : (1.0 - fx);
          return topY + 0.024 * outF;
        },
        0.011, 0.007, 14, 4
      ));
      tlLedGeos.push(buildConformedBumperPanel(
        modelId, stations, false, tx0 + 0.015, tx1 - 0.015,
        (fx) => {
          const outF = s > 0 ? fx : (1.0 - fx);
          return baseY + 0.018 + 0.021 * outF;
        },
        (fx) => {
          const outF = s > 0 ? fx : (1.0 - fx);
          return topY - 0.015 + 0.023 * outF;
        },
        0.017, 0.003, 14, 3
      ));
    }

    this.geoCache[modelId] = {
      stations,
      bodyGeo,
      glassGeo,
      linerGeo,
      wingGeo,
      endplateGeo,
      splitterGeo,
      mainGrilleGeo,
      upperSlotGeo,
      sideIntakeGeos,
      hlHousingGeos,
      hlDrlGeos,
      rearValanceGeo,
      rearDiffuserGeo,
      tlHousingGeos,
      tlLedGeos
    };
    return this.geoCache[modelId];
  }

  createCar(modelId = 'gt', liveryIndex = 0) {
    const id = modelId in CAR_SPECS ? modelId : 'gt';
    const spec = CAR_SPECS[id];
    const livery = CAR_LIVERIES[((liveryIndex % CAR_LIVERIES.length) + CAR_LIVERIES.length) % CAR_LIVERIES.length];
    const geos = this._getModelGeometries(id);

    const liveryTex = createLiveryTexture(livery);
    const solidPaintTex = createSolidPaintTexture(livery.primary);

    // 12 distinct high-grade PBR automotive materials per car (>= 6 required; all non-glass/emissives carry 1024^2 albedo + normal maps!)
    const mats = {
      paint: new THREE.MeshPhysicalMaterial({
        map: liveryTex,
        normalMap: this.matLib.sharedMaps.microGrainNormal,
        normalScale: new THREE.Vector2(0.05, 0.05),
        roughness: 0.14,
        metalness: 0.46,
        clearcoat: 1.0,
        clearcoatRoughness: 0.035,
        envMapIntensity: 2.35
      }),
      paintSolid: new THREE.MeshPhysicalMaterial({
        map: solidPaintTex,
        normalMap: this.matLib.sharedMaps.microGrainNormal,
        normalScale: new THREE.Vector2(0.05, 0.05),
        roughness: 0.14,
        metalness: 0.46,
        clearcoat: 1.0,
        clearcoatRoughness: 0.035,
        envMapIntensity: 2.35
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0c1520'),
        roughness: 0.02,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.015,
        transparent: true,
        opacity: 0.50,
        envMapIntensity: 2.85
      }),
      chrome: new THREE.MeshStandardMaterial({
        map: this.matLib.sharedMaps.galvanizedAlbedo,
        normalMap: this.matLib.sharedMaps.brushedMetalNormal,
        color: new THREE.Color('#e8edf2'),
        metalness: 0.92,
        roughness: 0.14,
        envMapIntensity: 2.1
      }),
      satinGunmetal: new THREE.MeshStandardMaterial({
        map: this.matLib.sharedMaps.galvanizedAlbedo,
        normalMap: this.matLib.sharedMaps.brushedMetalNormal,
        color: new THREE.Color('#7c8490'),
        metalness: 0.88,
        roughness: 0.22,
        envMapIntensity: 1.95
      }),
      darkBarrel: new THREE.MeshStandardMaterial({
        map: this.darkTrimAlbedo,
        normalMap: this.matLib.sharedMaps.brushedMetalNormal,
        color: new THREE.Color('#222730'),
        metalness: 0.68,
        roughness: 0.35,
        side: THREE.DoubleSide
      }),
      rubber: new THREE.MeshStandardMaterial({
        map: this.tireAlbedo,
        normalMap: this.matLib.sharedMaps.tireNormal,
        roughness: 0.80,
        metalness: 0.04
      }),
      mattePlastic: new THREE.MeshStandardMaterial({
        map: this.darkTrimAlbedo,
        normalMap: this.matLib.sharedMaps.microGrainNormal,
        roughness: 0.58,
        metalness: 0.18
      }),
      cabinLiner: new THREE.MeshStandardMaterial({
        map: this.darkTrimAlbedo,
        normalMap: this.matLib.sharedMaps.microGrainNormal,
        color: new THREE.Color('#13161c'),
        roughness: 0.85,
        metalness: 0.05,
        side: THREE.DoubleSide
      }),
      honeycomb: new THREE.MeshStandardMaterial({
        map: this.honeycombAlbedo,
        normalMap: this.matLib.sharedMaps.microGrainNormal,
        roughness: 0.48,
        metalness: 0.28
      }),
      headlight: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff8eb'),
        emissive: new THREE.Color('#ffe6bd'),
        emissiveIntensity: 2.8,
        roughness: 0.08,
        metalness: 0.1
      }),
      taillight: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#6e070e'),
        emissive: new THREE.Color('#ff1622'),
        emissiveIntensity: 1.85,
        roughness: 0.12,
        metalness: 0.1
      }),
      brakeDisc: new THREE.MeshStandardMaterial({
        map: this.brakeDiscAlbedo,
        normalMap: this.matLib.sharedMaps.brushedMetalNormal,
        color: new THREE.Color('#c6cdd6'),
        metalness: 0.85,
        roughness: 0.28,
        envMapIntensity: 1.6
      }),
      caliper: new THREE.MeshStandardMaterial({
        map: this.matLib.sharedMaps.galvanizedAlbedo,
        normalMap: this.matLib.sharedMaps.microGrainNormal,
        color: new THREE.Color(livery.caliper),
        metalness: 0.32,
        roughness: 0.22
      })
    };

    const root = new THREE.Group();
    root.name = `Car_${id}_${livery.number}`;
    root.userData.isCarRoot = true;
    root.userData.carModelId = id;
    root.userData.liveryNumber = livery.number;

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // 1. Watertight Outward-Facing Clearcoat Body Shell with Clean Open Window Apertures & Seamless Bumpers
    const bodyMesh = new THREE.Mesh(geos.bodyGeo, mats.paint);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyGroup.add(bodyMesh);

    // 2. Dark Charcoal Inner Headliner & Inner Pillars + Sculpted Cockpit + Flush Reflective Tinted Glass
    const linerMesh = new THREE.Mesh(geos.linerGeo, mats.cabinLiner);
    bodyGroup.add(linerMesh);

    const interior = buildDarkInteriorGroup(id, mats.cabinLiner);
    bodyGroup.add(interior);

    const glassMesh = new THREE.Mesh(geos.glassGeo, mats.glass);
    glassMesh.renderOrder = 2;
    bodyGroup.add(glassMesh);

    // 3. Inboard Wheel-Well Liners (strictly tucked inboard of fender arch lips)
    const halfWB = spec.wheelBase * 0.5;
    const halfTW = spec.trackWidth * 0.5;
    const wellGeo = new THREE.CylinderGeometry(spec.wheelRadius - 0.048, spec.wheelRadius - 0.048, 0.14, 24, 1);
    wellGeo.rotateZ(Math.PI * 0.5);
    for (const wz of [halfWB, -halfWB]) {
      for (const sSign of [1, -1]) {
        const well = new THREE.Mesh(wellGeo, mats.mattePlastic);
        well.position.set(sSign * (halfTW - 0.21), spec.wheelRadius, wz);
        bodyGroup.add(well);
      }
    }

    // 4. Conformed Front Aero Splitter, Honeycomb Grille, Side Intakes, Flush Angular LED Headlights & Door Mirrors
    const splitter = new THREE.Mesh(geos.splitterGeo, mats.mattePlastic);
    splitter.position.set(0, 0.142, spec.length * 0.445);
    splitter.castShadow = true;
    bodyGroup.add(splitter);

    bodyGroup.add(new THREE.Mesh(geos.mainGrilleGeo, mats.honeycomb));
    if (geos.upperSlotGeo) {
      bodyGroup.add(new THREE.Mesh(geos.upperSlotGeo, mats.honeycomb));
    }
    for (const g of geos.sideIntakeGeos) bodyGroup.add(new THREE.Mesh(g, mats.honeycomb));
    for (const g of geos.hlHousingGeos) bodyGroup.add(new THREE.Mesh(g, mats.mattePlastic));
    for (const g of geos.hlDrlGeos) bodyGroup.add(new THREE.Mesh(g, mats.headlight));

    const mirrorCapGeo = new THREE.SphereGeometry(0.080, 16, 12);
    const stalkGeo = new THREE.CylinderGeometry(0.014, 0.021, 0.14, 10, 1);
    for (const sSign of [1, -1]) {
      const mPosZ = spec.length * 0.135;
      const mPosY = id === 'gt' ? 0.84 : 0.91;
      const mPosX = sSign * (spec.width * 0.49);
      const mCap = new THREE.Mesh(mirrorCapGeo, mats.paintSolid);
      mCap.position.set(mPosX, mPosY, mPosZ);
      mCap.scale.set(1.15, 0.56, 1.38);
      mCap.castShadow = true;
      bodyGroup.add(mCap);

      const stalk = new THREE.Mesh(stalkGeo, mats.mattePlastic);
      stalk.position.set(mPosX - sSign * 0.06, mPosY - 0.042, mPosZ + 0.02);
      stalk.rotation.z = sSign * 0.78;
      bodyGroup.add(stalk);
    }

    // 5. Rear Swan-Neck GT Wing with Swept Trapezoidal Carbon Endplates (GT) / Rally Roof Spoiler (Hatch)
    const wing = new THREE.Mesh(geos.wingGeo, id === 'gt' ? mats.mattePlastic : mats.paintSolid);
    if (id === 'gt') {
      wing.position.set(0, 1.07, -spec.length * 0.435);
      wing.castShadow = true;
      bodyGroup.add(wing);

      const pylonGeo = new THREE.CylinderGeometry(0.015, 0.026, 0.27, 10, 2);
      for (const sSign of [1, -1]) {
        const py = new THREE.Mesh(pylonGeo, mats.mattePlastic);
        py.position.set(sSign * 0.34, 0.935, -spec.length * 0.42);
        py.rotation.x = -0.32;
        py.scale.set(0.38, 1.0, 2.2);
        py.castShadow = true;
        bodyGroup.add(py);

        const ep = new THREE.Mesh(geos.endplateGeo, mats.mattePlastic);
        ep.position.set(sSign * 0.822, 1.075, -spec.length * 0.45);
        ep.castShadow = true;
        bodyGroup.add(ep);
      }
    } else {
      wing.position.set(0, 1.345, -spec.length * 0.425);
      wing.castShadow = true;
      bodyGroup.add(wing);
    }

    // 6. Conformed Rear Valance Mesh, Lower Aero Diffuser + Vertical Strakes + Twin Chrome Exhausts + Ruby LED Taillight Bars
    bodyGroup.add(new THREE.Mesh(geos.rearValanceGeo, mats.honeycomb));
    bodyGroup.add(new THREE.Mesh(geos.rearDiffuserGeo, mats.mattePlastic));
    for (const g of geos.tlHousingGeos) bodyGroup.add(new THREE.Mesh(g, mats.mattePlastic));
    for (const g of geos.tlLedGeos) bodyGroup.add(new THREE.Mesh(g, mats.taillight));

    const strakeGeo = new THREE.CylinderGeometry(0.010, 0.014, 0.16, 8, 1);
    for (const sx of [-0.40, -0.14, 0.14, 0.40]) {
      const zSurf = evalBumperSurfaceZ(id, geos.stations, false, sx, 0.24);
      const fin = new THREE.Mesh(strakeGeo, mats.mattePlastic);
      fin.position.set(sx, 0.225, zSurf - 0.022);
      fin.scale.set(0.50, 1.0, 2.6);
      bodyGroup.add(fin);
    }

    const exhGeo = new THREE.CylinderGeometry(0.048, 0.052, 0.16, 20, 1, true);
    exhGeo.rotateX(Math.PI * 0.5);
    const exhX = id === 'gt' ? 0.54 : 0.28;
    for (const sSign of [1, -1]) {
      const zSurf = evalBumperSurfaceZ(id, geos.stations, false, sSign * exhX, 0.24);
      const exh = new THREE.Mesh(exhGeo, mats.chrome);
      exh.position.set(sSign * exhX, 0.235, zSurf - 0.020);
      bodyGroup.add(exh);
    }

    // 7. Four Forged-Spoke Wheel + Tire + Drilled Rotor + Brembo Caliper Assemblies
    const wheelMounts = [
      { x:  halfTW, z:  halfWB, isLeft: true,  isFront: true },
      { x: -halfTW, z:  halfWB, isLeft: false, isFront: true },
      { x:  halfTW, z: -halfWB, isLeft: true,  isFront: false },
      { x: -halfTW, z: -halfWB, isLeft: false, isFront: false }
    ];
    const wheels = [];
    for (const wm of wheelMounts) {
      const wObj = createWheelAssembly(id, spec.wheelRadius, wm.isLeft, mats);
      wObj.steerKnuckle.position.set(wm.x, spec.wheelRadius, wm.z);
      root.add(wObj.steerKnuckle);
      wheels.push({ ...wObj, baseX: wm.x, baseY: spec.wheelRadius, baseZ: wm.z, isFront: wm.isFront });
    }

    // 8. Grounded Soft Contact Shadow Disc
    const shadowGeo = new THREE.CircleGeometry(1.0, 32);
    shadowGeo.rotateX(-Math.PI * 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.scale.set(spec.width * 0.66, 1.0, spec.length * 0.60);
    shadowMesh.position.y = 0.018;
    shadowMesh.userData.auditRole = 'contact_shadow';
    root.add(shadowMesh);

    return {
      root,
      bodyGroup,
      wheels,
      mats,
      spec,
      livery,
      syncFromVehicle(car) {
        const groundRefY = car.y - spec.wheelRadius - 0.16;
        root.position.set(car.x, groundRefY, car.z);
        root.rotation.order = 'YXZ';
        root.rotation.y = car.yaw;
        root.rotation.x = car.pitch;
        root.rotation.z = car.roll;

        // Sprung body roll, pitch & heave while wheels stay tangent to asphalt
        bodyGroup.rotation.x = car.bodyPitch;
        bodyGroup.rotation.z = -car.bodyRoll;
        const avgComp = (car.wheelCompression[0] + car.wheelCompression[1] + car.wheelCompression[2] + car.wheelCompression[3]) * 0.25;
        bodyGroup.position.y = -avgComp * 0.38;

        for (let i = 0; i < 4; i++) {
          const w = wheels[i];
          w.steerKnuckle.position.y = w.baseY + Math.max(0, car.wheelCompression[i]) * 0.12;
          if (w.isFront) {
            w.steerKnuckle.rotation.y = car.steerVisual;
          }
          w.spinGroup.rotation.x = car.wheelSpin;
        }

        const braking = car.brake > 0.08 && car.forwardSpeed > -0.5;
        mats.taillight.emissiveIntensity = braking ? 6.5 : 1.85;
      }
    };
  }
}
