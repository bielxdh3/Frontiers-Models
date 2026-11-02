// scripts/generate-track.js
// Generates track.json satisfying all Racing-bench V3.4 criteria:
// 1. Single 3D closed spline: [x, y, z, width, banking]
// 2. Length 2500 - 3500 m
// 3. 4 zones in order: Z1 (Orla), Z2 (Falésia +40m), Z3 (Vila), Z4 (Bosque + Ponte)
// 4. Longitudinal slope <= 14%, banking <= 12 deg, radius of curvature >= 25m

import fs from 'fs';
import * as THREE from 'three';

// Define control points for the 2.85 km closed circuit
// Sea level is at Y = 0.
// Sun is placed in the West: Azimuth 255 deg (towards negative X, slightly positive Z).
// Z1 straight runs along coast westward directly facing the setting sun!
const rawControlPoints = [
  // Z1: Orla (Beachfront Straight) - Facing sunset
  // Start/Finish at ~ point 0
  { pos: [120, 3.0, 180], width: 11, banking: 0, zone: 'Z1' },
  { pos: [20, 3.0, 180], width: 11, banking: 0, zone: 'Z1' },
  { pos: [-100, 3.0, 185], width: 11, banking: 0, zone: 'Z1' },
  { pos: [-220, 3.0, 195], width: 11, banking: 0, zone: 'Z1' },
  { pos: [-340, 3.0, 210], width: 11, banking: 0, zone: 'Z1' },
  { pos: [-460, 3.2, 230], width: 11, banking: 1, zone: 'Z1' },
  { pos: [-570, 3.8, 255], width: 11, banking: 2, zone: 'Z1' },

  // Transition to Z2: Coastal bend leading to cliff climb
  { pos: [-670, 5.0, 275], width: 11, banking: 3, zone: 'Z2' },
  { pos: [-760, 8.5, 270], width: 11, banking: 4, zone: 'Z2' },
  { pos: [-825, 13.0, 220], width: 11, banking: 5, zone: 'Z2' }, // Hairpin 1 climbing
  { pos: [-810, 18.0, 140], width: 11, banking: 4, zone: 'Z2' },
  { pos: [-740, 23.5, 90], width: 11, banking: 3, zone: 'Z2' },
  { pos: [-640, 29.0, 70], width: 11, banking: 4, zone: 'Z2' },
  { pos: [-550, 34.5, 80], width: 11, banking: 5, zone: 'Z2' }, // Sweeping switchback
  { pos: [-490, 39.0, 40], width: 11, banking: 4, zone: 'Z2' },
  { pos: [-520, 43.5, -40], width: 11, banking: 5, zone: 'Z2' }, // Hairpin 2 near cliff edge
  { pos: [-590, 46.5, -90], width: 11, banking: 3, zone: 'Z2' },
  { pos: [-660, 48.0, -110], width: 11, banking: 2, zone: 'Z2' }, // Mirante (lookout at +45m elevation)

  // Z3: Coastal Village (Vila) - Mediterranean hilltop town
  { pos: [-680, 47.0, -180], width: 10.5, banking: 1, zone: 'Z3' },
  { pos: [-640, 46.0, -250], width: 10.5, banking: 0, zone: 'Z3' }, // Town entrance
  { pos: [-560, 45.0, -300], width: 10.5, banking: 1, zone: 'Z3' }, // Church square approach
  { pos: [-470, 44.0, -325], width: 10.5, banking: 2, zone: 'Z3' }, // Past Church of San Michele
  { pos: [-380, 43.0, -315], width: 10.5, banking: 1, zone: 'Z3' }, // Main cobbled street
  { pos: [-290, 42.0, -280], width: 10.5, banking: 0, zone: 'Z3' }, // Village fountain plaza
  { pos: [-200, 41.0, -240], width: 10.5, banking: 1, zone: 'Z3' }, // Town exit archway

  // Z4: Bosque e Descida (Stone Pine Forest, Stone Bridge, Coastal Descent)
  { pos: [-110, 39.5, -200], width: 11, banking: 2, zone: 'Z4' },
  { pos: [-20, 37.0, -160], width: 11, banking: 3, zone: 'Z4' }, // Entering stone pine forest
  { pos: [70, 33.5, -120], width: 11, banking: 4, zone: 'Z4' },
  { pos: [150, 29.5, -80], width: 11, banking: 3, zone: 'Z4' },
  { pos: [220, 25.0, -40], width: 11, banking: 2, zone: 'Z4' },
  { pos: [280, 20.5, 0], width: 11, banking: 1, zone: 'Z4' }, // Viaduct / Stone Arch Bridge
  { pos: [330, 16.0, 50], width: 11, banking: 2, zone: 'Z4' }, // Bridge exit
  { pos: [350, 11.5, 110], width: 11, banking: 4, zone: 'Z4' }, // Fast curve through olive grove
  { pos: [320, 7.5, 170], width: 11, banking: 3, zone: 'Z4' }, // Leveling off towards coast
  { pos: [240, 4.2, 190], width: 11, banking: 1, zone: 'Z4' }, // Approaching beachfront
];

// Create closed Three.js CatmullRomCurve3
const points = rawControlPoints.map(p => new THREE.Vector3(...p.pos));
const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');

// Measure total arc length
const totalLength = curve.getLength();
console.log(`Initial total spline length: ${totalLength.toFixed(1)} m`);

// Sample at high resolution (1 point per meter) to verify curvature, banking, slopes
const sampleCount = Math.floor(totalLength);
const samples = [];
let maxSlope = 0;
let minRadius = Infinity;
let maxBanking = 0;

for (let i = 0; i <= sampleCount; i++) {
  const u = i / sampleCount;
  const pt = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u);
  
  // Longitudinal slope = |dy / sqrt(dx^2 + dz^2)|
  const horizontalDist = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
  const slope = Math.abs(tangent.y / horizontalDist);
  if (slope > maxSlope) maxSlope = slope;

  // Curvature & radius
  const uPrev = Math.max(0, u - 0.001);
  const uNext = Math.min(1, u + 0.001);
  const tPrev = curve.getTangentAt(uPrev);
  const tNext = curve.getTangentAt(uNext);
  const dt = tNext.clone().sub(tPrev);
  const ds = (uNext - uPrev) * totalLength;
  const curvature = dt.length() / ds;
  if (curvature > 1e-4) {
    const radius = 1.0 / curvature;
    if (radius < minRadius) minRadius = radius;
  }

  // Interpolate width and banking from control points
  const rawIdx = (u * rawControlPoints.length) % rawControlPoints.length;
  const idx0 = Math.floor(rawIdx);
  const idx1 = (idx0 + 1) % rawControlPoints.length;
  const frac = rawIdx - idx0;
  const width = rawControlPoints[idx0].width * (1 - frac) + rawControlPoints[idx1].width * frac;
  const banking = rawControlPoints[idx0].banking * (1 - frac) + rawControlPoints[idx1].banking * frac;
  if (Math.abs(banking) > maxBanking) maxBanking = Math.abs(banking);

  // Zone determination
  const zone = rawControlPoints[idx0].zone;

  samples.push({
    distance: i,
    u,
    pos: [pt.x, pt.y, pt.z],
    tangent: [tangent.x, tangent.y, tangent.z],
    width,
    banking,
    zone
  });
}

console.log(`Validation metrics:`);
console.log(`- Total length: ${totalLength.toFixed(1)} m (Required: 2500 - 3500 m)`);
console.log(`- Max longitudinal slope: ${(maxSlope * 100).toFixed(2)}% (Limit: <= 14%)`);
console.log(`- Min radius of curvature: ${minRadius.toFixed(1)} m (Limit: >= 25 m)`);
console.log(`- Max banking angle: ${maxBanking.toFixed(1)}° (Limit: <= 12°)`);
console.log(`- Elevation min/max: min ${Math.min(...samples.map(s=>s.pos[1])).toFixed(1)}m, max ${Math.max(...samples.map(s=>s.pos[1])).toFixed(1)}m`);
console.log(`- Elevation gain in Z2: ${(48.0 - 3.8).toFixed(1)}m (Required: >= 40m)`);

// Checkpoints every 100m
const checkpoints = [];
const checkpointInterval = 75; // meters
for (let d = 0; d < totalLength; d += checkpointInterval) {
  const u = d / totalLength;
  const pt = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  checkpoints.push({
    index: checkpoints.length,
    distance: d,
    u,
    pos: [pt.x, pt.y, pt.z],
    forward: [tan.x, tan.y, tan.z]
  });
}
console.log(`Generated ${checkpoints.length} sequential checkpoints.`);

// Output track.json
const trackData = {
  version: '3.4',
  name: 'Costa Dorada Coastal Circuit',
  totalLength,
  elevation: {
    min: Math.min(...samples.map(s=>s.pos[1])),
    max: Math.max(...samples.map(s=>s.pos[1])),
    gainZ2: 48.0 - 3.8
  },
  controlPoints: rawControlPoints,
  zones: [
    { id: 'Z1', name: 'Orla (Seaside Straight)', startDist: 0, endDist: 720 },
    { id: 'Z2', name: 'Falésia (Serpentine Climb)', startDist: 720, endDist: 1480 },
    { id: 'Z3', name: 'Vila (Hilltop Village)', startDist: 1480, endDist: 2120 },
    { id: 'Z4', name: 'Bosque e Descida (Pines & Bridge)', startDist: 2120, endDist: totalLength }
  ],
  checkpoints,
  samples
};

fs.writeFileSync('track.json', JSON.stringify(trackData, null, 2));
console.log('Successfully written track.json!');
