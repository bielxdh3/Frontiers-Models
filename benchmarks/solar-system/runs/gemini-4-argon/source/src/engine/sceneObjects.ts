import * as THREE from 'three';
import {
  CelestialBodyData,
  PresentationMode,
  QualityPreset,
  ScaleMode,
} from '../types/solarSystem';
import {
  createSeededRandom,
  getOrCreateBodyTextures,
  getOrCreateRadialGlowTexture,
  getOrCreateRingTexture,
  noise3D,
} from './proceduralTextures';
import {
  degToRad,
  mapHeliocentricAuToExplorationUnits,
  RELATIVE_SCALE_UNITS_PER_AU,
} from './ephemeris';

export interface BodyRenderRig {
  id: string;
  body: CelestialBodyData;
  rootGroup: THREE.Group; // Positioned at displayPosition
  tiltGroup: THREE.Group; // Tilted by axialTiltDeg
  spinMesh: THREE.Mesh; // Spins by spinAngleRad
  cloudsMesh?: THREE.Mesh;
  nightLightsMesh?: THREE.Mesh;
  atmosphereMesh?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  axialArrow?: THREE.Group;
  tidalLockArrow?: THREE.Group;
  cometGroup?: THREE.Group;
  ionTailMesh?: THREE.Mesh;
  dustTailMesh?: THREE.Mesh;
  comaSprite?: THREE.Sprite;
}

/**
 * Create an irregular asteroid/moon geometry by displacing sphere vertices with seeded 3D noise.
 */
function createIrregularGeometry(seed: number, detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    const n1 = noise3D(dir.x * 2.2, dir.y * 2.2, dir.z * 2.2, seed);
    const n2 = noise3D(dir.x * 5.0, dir.y * 5.0, dir.z * 5.0, seed + 31);
    // Elongate slightly along X axis and roughen
    const radiusScale = 0.78 + n1 * 0.32 + n2 * 0.1;
    v.copy(dir).multiplyScalar(radiusScale);
    v.x *= 1.18;
    v.y *= 0.86;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create annular ring geometry with UV.x mapped radially from innerRadius (0) to outerRadius (1).
 */
function createRadialRingGeometry(
  innerRatio: number,
  outerRatio: number,
  segments = 96
): THREE.BufferGeometry {
  const geo = new THREE.RingGeometry(innerRatio, outerRatio, segments, 1);
  // Rotate from XY plane into XZ equatorial plane (so Y is axial pole)
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  const span = Math.max(0.001, outerRatio - innerRatio);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    const u = Math.max(0, Math.min(1, (r - innerRatio) / span));
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

export function createBodyRenderRig(
  body: CelestialBodyData,
  quality: QualityPreset,
  presentation: PresentationMode,
  venusRadarMode: boolean
): BodyRenderRig {
  const rootGroup = new THREE.Group();
  rootGroup.name = `rig_${body.id}`;

  const tiltGroup = new THREE.Group();
  if (body.axialTiltDeg !== null && Number.isFinite(body.axialTiltDeg)) {
    tiltGroup.rotation.z = -degToRad(body.axialTiltDeg);
  }
  rootGroup.add(tiltGroup);

  const segments = quality === 'low' ? 24 : quality === 'high' ? 48 : 32;
  const textures = getOrCreateBodyTextures(body, quality, presentation, venusRadarMode);

  let geometry: THREE.BufferGeometry;
  if (body.visual.proceduralType === 'irregular_asteroid') {
    geometry = createIrregularGeometry(body.visual.seed, quality === 'low' ? 2 : 3);
  } else {
    geometry = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75));
    // Haumea triaxial ellipsoid shape
    if (body.id === 'haumea') {
      geometry.scale(1.28, 0.68, 0.98);
    }
  }

  let material: THREE.Material;
  if (body.id === 'sun') {
    material = new THREE.MeshBasicMaterial({
      map: textures.colorMap,
      color: presentation === 'enhanced' ? 0xffddaa : 0xfff5df,
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      map: textures.colorMap,
      bumpMap: textures.bumpMap,
      bumpScale: body.rings ? 0.008 : 0.025,
      roughness: body.visual.roughness,
      metalness: body.visual.metalness,
    });
  }

  const spinMesh = new THREE.Mesh(geometry, material);
  spinMesh.userData = { bodyId: body.id };
  tiltGroup.add(spinMesh);

  // Solar corona sprite for Sun
  if (body.id === 'sun') {
    const glowMat = new THREE.SpriteMaterial({
      map: getOrCreateRadialGlowTexture(),
      color: presentation === 'enhanced' ? 0xff9d2e : 0xffcc77,
      transparent: true,
      opacity: presentation === 'enhanced' ? 0.85 : 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coronaSprite = new THREE.Sprite(glowMat);
    coronaSprite.scale.set(3.2, 3.2, 1);
    tiltGroup.add(coronaSprite);
  }

  let cloudsMesh: THREE.Mesh | undefined;
  let nightLightsMesh: THREE.Mesh | undefined;

  if (body.id === 'earth' && textures.cloudsMap) {
    const cloudsGeo = new THREE.SphereGeometry(1.014, segments, Math.round(segments * 0.75));
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: textures.cloudsMap,
      transparent: true,
      opacity: 0.78,
      roughness: 0.9,
      metalness: 0.0,
      depthWrite: false,
    });
    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    tiltGroup.add(cloudsMesh);
  }

  if (body.id === 'earth' && textures.nightLightsMap) {
    // Night-lights shell with custom shader hook so lights appear ONLY on the dark hemisphere (opposite the Sun)
    const nightGeo = new THREE.SphereGeometry(1.003, segments, Math.round(segments * 0.75));
    const nightMat = new THREE.ShaderMaterial({
      uniforms: {
        nightMap: { value: textures.nightLightsMap },
        sunDirWorld: { value: new THREE.Vector3(-1, 0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D nightMap;
        uniform vec3 sunDirWorld;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          float sunDot = dot(normalize(vWorldNormal), normalize(sunDirWorld));
          float nightMask = smoothstep(0.08, -0.22, sunDot);
          vec4 tex = texture2D(nightMap, vUv);
          float intensity = max(tex.r, max(tex.g, tex.b)) * nightMask;
          if (intensity < 0.02) discard;
          gl_FragColor = vec4(tex.rgb * 1.35, intensity * 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    nightLightsMesh = new THREE.Mesh(nightGeo, nightMat);
    spinMesh.add(nightLightsMesh);
  }

  // Atmosphere rim shell
  let atmosphereMesh: THREE.Mesh | undefined;
  if (body.id !== 'sun' && body.visual.atmosphereColor && body.visual.atmosphereIntensity) {
    const atmoGeo = new THREE.SphereGeometry(1.032, 28, 20);
    const atmoColor = new THREE.Color(body.visual.atmosphereColor);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: atmoColor },
        intensity: {
          value:
            body.visual.atmosphereIntensity * (presentation === 'enhanced' ? 1.25 : 0.9),
        },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.6);
          gl_FragColor = vec4(color, fresnel * intensity * 0.65);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
    tiltGroup.add(atmosphereMesh);
  }

  // Planetary rings (Saturn, Uranus, Jupiter, Neptune)
  let ringMesh: THREE.Mesh | undefined;
  if (body.rings) {
    const bands = body.rings.bands;
    const minRatio = Math.min(...bands.map((b) => b.innerRadiusRatio));
    const maxRatio = Math.max(...bands.map((b) => b.outerRadiusRatio));
    const ringGeo = createRadialRingGeometry(minRatio, maxRatio, quality === 'low' ? 64 : 112);
    const ringTex = getOrCreateRingTexture(body, presentation);
    const ringMat = new THREE.MeshStandardMaterial({
      map: ringTex,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.75,
      metalness: 0.0,
      depthWrite: false,
      alphaTest: 0.01,
    });
    ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.userData = { bodyId: body.id };
    tiltGroup.add(ringMesh);
  }

  // Axial orientation arrow (North +Y of tiltGroup)
  const axialArrow = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.8, 8);
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  const coneGeo = new THREE.ConeGeometry(0.09, 0.28, 10);
  const cone = new THREE.Mesh(coneGeo, shaftMat);
  cone.position.y = 1.45;
  axialArrow.add(shaft, cone);
  axialArrow.visible = false;
  tiltGroup.add(axialArrow);

  // Educational Tidal-Locking overlay for moons
  let tidalLockArrow: THREE.Group | undefined;
  if (body.isTidallyLocked && body.category === 'moon') {
    tidalLockArrow = new THREE.Group();
    const lockLineGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8);
    lockLineGeo.rotateZ(-Math.PI / 2);
    lockLineGeo.translate(1.2, 0, 0);
    const lockMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    const lockShaft = new THREE.Mesh(lockLineGeo, lockMat);
    const hemiGeo = new THREE.SphereGeometry(
      1.04,
      16,
      12,
      -Math.PI / 2,
      Math.PI,
      0,
      Math.PI
    );
    const hemiMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const hemiMesh = new THREE.Mesh(hemiGeo, hemiMat);
    tidalLockArrow.add(lockShaft, hemiMesh);
    tidalLockArrow.visible = false;
    rootGroup.add(tidalLockArrow);
  }

  // Educational Comet tails & coma (Section 12)
  let cometGroup: THREE.Group | undefined;
  let ionTailMesh: THREE.Mesh | undefined;
  let dustTailMesh: THREE.Mesh | undefined;
  let comaSprite: THREE.Sprite | undefined;

  if (body.id === 'halley_model') {
    cometGroup = new THREE.Group();
    const comaMat = new THREE.SpriteMaterial({
      map: getOrCreateRadialGlowTexture(),
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    comaSprite = new THREE.Sprite(comaMat);
    comaSprite.scale.set(3.5, 3.5, 1);
    cometGroup.add(comaSprite);

    // Ion tail: straight narrow blue-cyan cone pointing strictly anti-sunward (+Z in local tail group)
    const ionGeo = new THREE.ConeGeometry(0.55, 8.5, 16, 1, true);
    ionGeo.translate(0, -4.25, 0);
    ionGeo.rotateX(-Math.PI / 2); // Points along +Z
    const ionMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    ionTailMesh = new THREE.Mesh(ionGeo, ionMat);
    cometGroup.add(ionTailMesh);

    // Dust tail: broader yellowish-white cone slightly curved away from anti-solar toward orbital trail
    const dustGeo = new THREE.ConeGeometry(0.95, 6.8, 16, 1, true);
    dustGeo.translate(0, -3.4, 0);
    dustGeo.rotateX(-Math.PI / 2);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dustTailMesh = new THREE.Mesh(dustGeo, dustMat);
    cometGroup.add(dustTailMesh);

    rootGroup.add(cometGroup);
  }

  return {
    id: body.id,
    body,
    rootGroup,
    tiltGroup,
    spinMesh,
    cloudsMesh,
    nightLightsMesh,
    atmosphereMesh,
    ringMesh,
    axialArrow,
    tidalLockArrow,
    cometGroup,
    ionTailMesh,
    dustTailMesh,
    comaSprite,
  };
}

/**
 * Create seeded distant starfield and subtle Milky Way band (Section 13).
 */
export function createSeededStarfield(seed = 424242): THREE.Group {
  const group = new THREE.Group();
  group.name = 'seeded_starfield';
  const rng = createSeededRandom(seed);

  const starCount = 2600;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  const radius = 3200;

  for (let i = 0; i < starCount; i++) {
    // Mix isotropic stars (70%) and a tilted galactic band (30%)
    const isBand = i > starCount * 0.7;
    const theta = rng() * Math.PI * 2;
    let u = rng() * 2 - 1;
    if (isBand) {
      u = (rng() - 0.5) * 0.28; // concentrated near galactic plane
    }
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    let x = s * Math.cos(theta);
    let y = u;
    let z = s * Math.sin(theta);

    if (isBand) {
      // Tilt galactic plane ~60 deg relative to ecliptic
      const tilt = 1.05;
      const yRot = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zRot = y * Math.sin(tilt) + z * Math.cos(tilt);
      y = yRot;
      z = zRot;
    }

    positions[i * 3] = x * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = z * radius;

    // Subtle astronomical star color variation (warm K/M, solar G, blue-white A/B)
    const tint = rng();
    const brightness = 0.45 + Math.pow(rng(), 2.2) * 0.55;
    if (tint < 0.2) {
      colors[i * 3] = brightness * 1.0;
      colors[i * 3 + 1] = brightness * 0.86;
      colors[i * 3 + 2] = brightness * 0.72;
    } else if (tint < 0.75) {
      colors[i * 3] = brightness * 0.96;
      colors[i * 3 + 1] = brightness * 0.97;
      colors[i * 3 + 2] = brightness * 1.0;
    } else {
      colors[i * 3] = brightness * 0.8;
      colors[i * 3 + 1] = brightness * 0.9;
      colors[i * 3 + 2] = brightness * 1.0;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 1.85,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  group.add(points);
  return group;
}

/**
 * Create representative instanced particle belts for the Main Asteroid Belt and Kuiper Belt (Section 13).
 */
export function createBeltParticleSystem(
  type: 'asteroid_belt' | 'kuiper_belt',
  scaleMode: ScaleMode,
  seed: number
): THREE.Points {
  const rng = createSeededRandom(seed);
  const count = type === 'asteroid_belt' ? 950 : 1200;
  const minAu = type === 'asteroid_belt' ? 2.15 : 31.0;
  const maxAu = type === 'asteroid_belt' ? 3.25 : 49.0;
  const maxIncRad = degToRad(type === 'asteroid_belt' ? 11 : 17);

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const rAu = minAu + rng() * (maxAu - minAu);
    const displayR =
      scaleMode === 'exploration'
        ? mapHeliocentricAuToExplorationUnits(rAu)
        : rAu * RELATIVE_SCALE_UNITS_PER_AU;
    const angle = rng() * Math.PI * 2;
    const inc = (rng() - 0.5) * 2 * maxIncRad;

    positions[i * 3] = displayR * Math.cos(angle) * Math.cos(inc);
    positions[i * 3 + 1] = displayR * Math.sin(inc);
    positions[i * 3 + 2] = -displayR * Math.sin(angle) * Math.cos(inc);

    const shade = 0.5 + rng() * 0.4;
    if (type === 'asteroid_belt') {
      colors[i * 3] = shade * 0.78;
      colors[i * 3 + 1] = shade * 0.72;
      colors[i * 3 + 2] = shade * 0.65;
    } else {
      colors[i * 3] = shade * 0.62;
      colors[i * 3 + 1] = shade * 0.78;
      colors[i * 3 + 2] = shade * 0.95;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: type === 'asteroid_belt' ? 1.8 : 2.0,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}
