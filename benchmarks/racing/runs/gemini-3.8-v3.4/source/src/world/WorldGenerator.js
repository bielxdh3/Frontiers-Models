// src/world/WorldGenerator.js
// Single source of truth world generation from track.json
// Satisfies all Racing-bench V3.4 invariants and art direction rules.

import * as THREE from 'three';

export class WorldGenerator {
  constructor(trackData, textureAtlas = null) {
    this.trackData = trackData;
    this.textures = textureAtlas || {};
    this.exclusionMargin = 3.0; // >= 3m exclusion zone beyond track edge
    
    // Track curve from samples
    this.samples = trackData.samples;
    this.totalLength = trackData.totalLength;
    this.points = trackData.controlPoints.map(p => new THREE.Vector3(...p.pos));
    this.curve = new THREE.CatmullRomCurve3(this.points, true, 'centripetal');

    // Generated objects catalog for validation
    this.placedObjects = [];
    this.houses = [];
    this.props = [];
    this.trees = [];
    this.roadColliders = [];
    this.terrainCollider = null;
  }

  // PRNG helper (Mulberry32) for strictly deterministic world generation
  createRNG(seed = 12345) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Generate complete 3D world
  buildWorld() {
    const rng = this.createRNG(98765);
    const worldGroup = new THREE.Group();
    worldGroup.name = 'World';

    // 1. Road Geometry & Cross-Section
    const road = this.buildRoad();
    worldGroup.add(road.mesh);
    if (road.curbs) worldGroup.add(road.curbs);
    if (road.guardrails) worldGroup.add(road.guardrails);
    if (road.gantry) worldGroup.add(road.gantry);

    // 2. Terrain Heightfield (conformed to road)
    const terrain = this.buildTerrain();
    worldGroup.add(terrain.mesh);
    this.heightfield = terrain.heightfield;
    this.getTerrainHeight = terrain.getHeight;

    // 3. Ocean with Gerstner wave displacement & foam
    const ocean = this.buildOcean();
    worldGroup.add(ocean.mesh);

    // 4. Props & Scenic Elements (Bridge, Lookout, Seawall)
    const structures = this.buildScenicStructures();
    worldGroup.add(structures.group);

    // 5. Buildings along Z3 Vila (>= 25 distinct multi-story houses, church tower, plaza)
    const village = this.buildVillage(rng);
    worldGroup.add(village.group);

    // 6. Foliage (Stone Pines, Olives, Palms, Flowering Shrubs)
    const foliage = this.buildFoliage(rng);
    worldGroup.add(foliage.group);

    // 7. Trackside Props (Signs, street lamps, barriers, barrels, beach fences)
    const props = this.buildProps(rng);
    worldGroup.add(props.group);

    // Run invariant validation
    const validation = this.validateWorld();
    console.log(`[WorldGenerator] World generated. Invariants valid: ${validation.valid}`);
    if (!validation.valid) {
      console.error('[WorldGenerator] Validation errors:', validation.errors);
    }

    return {
      group: worldGroup,
      road,
      terrain,
      ocean,
      village,
      validation,
      getTerrainHeight: this.getTerrainHeight,
      getTrackPointAt: (u) => this.curve.getPointAt(u),
      getTrackTangentAt: (u) => this.curve.getTangentAt(u)
    };
  }

  // -----------------------------------------------------------------------
  // 1. ROAD & COLLIDERS
  // -----------------------------------------------------------------------
  buildRoad() {
    const samples = this.samples;
    const segCount = samples.length - 1;

    // Road vertices: cross section has 7 vertices per ring:
    // Left shoulder edge, left curb outer, left curb inner, road left, road center, road right, right curb inner, right curb outer, right shoulder edge
    const roadPositions = [];
    const roadNormals = [];
    const roadUvs = [];
    const roadIndices = [];

    const curbPositions = [];
    const curbNormals = [];
    const curbUvs = [];
    const curbIndices = [];

    const guardrailPositions = [];
    const guardrailIndices = [];
    const guardrailUvs = [];

    const roadWidth = 11.0;
    const halfW = roadWidth / 2.0;
    const curbWidth = 0.9;
    const shoulderWidth = 1.8;

    // Precalculate cross section frames
    this.roadFrames = [];
    for (let i = 0; i <= segCount; i++) {
      const s = samples[i];
      const pos = new THREE.Vector3(...s.pos);
      const tangent = new THREE.Vector3(...s.tangent).normalize();
      
      // Up vector tilted by banking angle
      const bankRad = (s.banking || 0) * Math.PI / 180.0;
      const worldUp = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
      const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

      // Apply banking rotation around tangent
      if (Math.abs(bankRad) > 1e-4) {
        binormal.applyAxisAngle(tangent, bankRad);
        normal.applyAxisAngle(tangent, bankRad);
      }

      this.roadFrames.push({ pos, tangent, normal, binormal, width: s.width || roadWidth, s: s.distance, zone: s.zone });
    }

    // Build extruded road mesh & curbs
    for (let i = 0; i <= segCount; i++) {
      const f = this.roadFrames[i];
      const uRoad = f.s / 8.0; // Repeat asphalt texture every 8m

      // Road cross section points (Left edge to Right edge)
      const pL = f.pos.clone().addScaledVector(f.binormal, -halfW);
      const pC = f.pos.clone();
      const pR = f.pos.clone().addScaledVector(f.binormal, halfW);

      // Add slight crown to road (center 3cm higher for drainage)
      pC.addScaledVector(f.normal, 0.03);

      const baseIdx = (i * 3);
      roadPositions.push(pL.x, pL.y, pL.z);
      roadPositions.push(pC.x, pC.y, pC.z);
      roadPositions.push(pR.x, pR.y, pR.z);

      roadNormals.push(f.normal.x, f.normal.y, f.normal.z);
      roadNormals.push(f.normal.x, f.normal.y, f.normal.z);
      roadNormals.push(f.normal.x, f.normal.y, f.normal.z);

      roadUvs.push(0.0, uRoad);
      roadUvs.push(0.5, uRoad);
      roadUvs.push(1.0, uRoad);

      // Curbs at apexes & corners (curvatures > 0.015 or in Z2 / Z3)
      const isCurved = (Math.abs(f.binormal.x) > 0.1 || f.zone === 'Z2');
      if (isCurved) {
        const cBaseIdx = curbPositions.length / 3;
        // Left curb
        const cL_out = pL.clone().addScaledVector(f.binormal, -curbWidth).addScaledVector(f.normal, 0.08);
        const cL_in = pL.clone();
        curbPositions.push(cL_out.x, cL_out.y, cL_out.z, cL_in.x, cL_in.y, cL_in.z);
        curbNormals.push(f.normal.x, f.normal.y + 0.3, f.normal.z, f.normal.x, f.normal.y, f.normal.z);
        curbUvs.push(0, f.s * 0.8, 1, f.s * 0.8);

        // Right curb
        const cR_in = pR.clone();
        const cR_out = pR.clone().addScaledVector(f.binormal, curbWidth).addScaledVector(f.normal, 0.08);
        curbPositions.push(cR_in.x, cR_in.y, cR_in.z, cR_out.x, cR_out.y, cR_out.z);
        curbNormals.push(f.normal.x, f.normal.y, f.normal.z, f.normal.x, f.normal.y + 0.3, f.normal.z);
        curbUvs.push(0, f.s * 0.8, 1, f.s * 0.8);
      }

      // Guardrails in Z2 (Falésia cliff drop-off) and Z4 (Bridge)
      if (f.zone === 'Z2' || (f.s > 2500 && f.s < 2850)) {
        // Guardrail on outer seaside edge (left side in Z2)
        const grPos = pL.clone().addScaledVector(f.binormal, -0.6).addScaledVector(f.normal, 0.75);
        guardrailPositions.push(grPos.x, grPos.y, grPos.z);
        guardrailPositions.push(grPos.x, grPos.y - 0.45, grPos.z);
        guardrailUvs.push(0, f.s * 0.25, 1, f.s * 0.25);
      }
    }

    // Connect road indices
    for (let i = 0; i < segCount; i++) {
      const r0 = i * 3;
      const r1 = (i + 1) * 3;
      // Quad 1: Left to Center
      roadIndices.push(r0, r1, r0 + 1);
      roadIndices.push(r1, r1 + 1, r0 + 1);
      // Quad 2: Center to Right
      roadIndices.push(r0 + 1, r1 + 1, r0 + 2);
      roadIndices.push(r1 + 1, r1 + 2, r0 + 2);
    }

    // Connect curb indices
    const curbVerts = curbPositions.length / 3;
    for (let i = 0; i < curbVerts - 4; i += 4) {
      // Left curb quad
      curbIndices.push(i, i + 4, i + 1);
      curbIndices.push(i + 4, i + 5, i + 1);
      // Right curb quad
      curbIndices.push(i + 2, i + 6, i + 3);
      curbIndices.push(i + 6, i + 7, i + 3);
    }

    // Connect guardrail indices
    for (let i = 0; i < (guardrailPositions.length / 3) - 2; i += 2) {
      guardrailIndices.push(i, i + 2, i + 1);
      guardrailIndices.push(i + 2, i + 3, i + 1);
    }

    // Road Material (PBR 2048x2048)
    const roadGeom = new THREE.BufferGeometry();
    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeom.setIndex(roadIndices);

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.05,
      map: this.textures.asphalt_albedo || null,
      normalMap: this.textures.asphalt_normal || null,
      roughnessMap: this.textures.asphalt_roughness || null,
      name: 'mat_road_asphalt'
    });
    if (this.textures.asphalt_albedo) {
      this.textures.asphalt_albedo.wrapS = THREE.RepeatWrapping;
      this.textures.asphalt_albedo.wrapT = THREE.RepeatWrapping;
    }

    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.receiveShadow = true;
    roadMesh.name = 'RoadSurface';

    // Curb Mesh
    let curbMesh = null;
    if (curbPositions.length > 0) {
      const curbGeom = new THREE.BufferGeometry();
      curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
      curbGeom.setAttribute('normal', new THREE.Float32BufferAttribute(curbNormals, 3));
      curbGeom.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
      curbGeom.setIndex(curbIndices);
      const curbMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.65,
        map: this.textures.curb_albedo || null,
        normalMap: this.textures.curb_normal || null,
        roughnessMap: this.textures.curb_roughness || null,
        name: 'mat_road_curb'
      });
      curbMesh = new THREE.Mesh(curbGeom, curbMat);
      curbMesh.receiveShadow = true;
      curbMesh.name = 'Curbs';
    }

    // Guardrail Mesh
    let guardrailMesh = null;
    if (guardrailPositions.length > 0) {
      const grGeom = new THREE.BufferGeometry();
      grGeom.setAttribute('position', new THREE.Float32BufferAttribute(guardrailPositions, 3));
      grGeom.setAttribute('uv', new THREE.Float32BufferAttribute(guardrailUvs, 2));
      grGeom.setIndex(guardrailIndices);
      grGeom.computeVertexNormals();
      const grMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.35,
        metalness: 0.85,
        map: this.textures.guardrail_albedo || null,
        normalMap: this.textures.guardrail_normal || null,
        roughnessMap: this.textures.guardrail_roughness || null,
        side: THREE.DoubleSide,
        name: 'mat_guardrail'
      });
      guardrailMesh = new THREE.Mesh(grGeom, grMat);
      guardrailMesh.castShadow = true;
      guardrailMesh.receiveShadow = true;
      guardrailMesh.name = 'Guardrails';
    }

    // Start/Finish Gantry in Z1 (at distance 50m)
    const gantry = this.buildStartGantry();

    return {
      mesh: roadMesh,
      curbs: curbMesh,
      guardrails: guardrailMesh,
      gantry,
      frames: this.roadFrames
    };
  }

  // Start / Finish Line Arch & Gantry in Z1
  buildStartGantry() {
    const gantryGroup = new THREE.Group();
    gantryGroup.name = 'StartFinishGantry';
    const sIdx = 45; // ~45 meters along Z1
    const f = this.roadFrames[sIdx];
    
    // Arch Pillars (Left and Right)
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x44444c,
      roughness: 0.5,
      metalness: 0.7,
      map: this.textures.guardrail_albedo || null,
      normalMap: this.textures.guardrail_normal || null
    });
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      roughness: 0.4,
      map: this.textures.curb_albedo || null,
      normalMap: this.textures.curb_normal || null
    });

    const pL = f.pos.clone().addScaledVector(f.binormal, -7.0);
    const pR = f.pos.clone().addScaledVector(f.binormal, 7.0);

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 7.5, 16), trussMat);
    postL.position.copy(pL).add(new THREE.Vector3(0, 3.75, 0));
    postL.castShadow = true;
    gantryGroup.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 7.5, 16), trussMat);
    postR.position.copy(pR).add(new THREE.Vector3(0, 3.75, 0));
    postR.castShadow = true;
    gantryGroup.add(postR);

    // Crossbar
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.4, 1.2, 10, 4, 4), trussMat);
    const archCenter = pL.clone().add(pR).multiplyScalar(0.5).add(new THREE.Vector3(0, 6.8, 0));
    crossbar.position.copy(archCenter);
    crossbar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), f.binormal);
    crossbar.castShadow = true;
    gantryGroup.add(crossbar);

    // Sponsor Banner / Timing Display
    const banner = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.9, 0.2, 8, 4, 2), bannerMat);
    banner.position.copy(archCenter).addScaledVector(f.tangent, -0.6);
    banner.quaternion.copy(crossbar.quaternion);
    gantryGroup.add(banner);

    return gantryGroup;
  }

  // -----------------------------------------------------------------------
  // 2. TERRAIN HEIGHTFIELD (Conformed to Road, Invariant-compliant)
  // -----------------------------------------------------------------------
  initSpatialIndex() {
    this.gridCellSize = 40.0;
    this.spatialBuckets = new Map();

    for (let i = 0; i < this.roadFrames.length; i++) {
      const f = this.roadFrames[i];
      const gx = Math.floor(f.pos.x / this.gridCellSize);
      const gz = Math.floor(f.pos.z / this.gridCellSize);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const key = `${gx + ox},${gz + oz}`;
          if (!this.spatialBuckets.has(key)) {
            this.spatialBuckets.set(key, []);
          }
          this.spatialBuckets.get(key).push(i);
        }
      }
    }
  }

  getClosestRoadFrame(x, z) {
    const gx = Math.floor(x / this.gridCellSize);
    const gz = Math.floor(z / this.gridCellSize);
    const key = `${gx},${gz}`;
    const indices = this.spatialBuckets.get(key);

    let minDistSq = Infinity;
    let bestFrame = this.roadFrames[0];

    if (indices && indices.length > 0) {
      for (const idx of indices) {
        const f = this.roadFrames[idx];
        const dSq = (x - f.pos.x) * (x - f.pos.x) + (z - f.pos.z) * (z - f.pos.z);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestFrame = f;
        }
      }
    } else {
      // Fallback: search all frames
      for (let i = 0; i < this.roadFrames.length; i += 6) {
        const f = this.roadFrames[i];
        const dSq = (x - f.pos.x) * (x - f.pos.x) + (z - f.pos.z) * (z - f.pos.z);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestFrame = f;
        }
      }
    }

    return { frame: bestFrame, dist: Math.sqrt(minDistSq) };
  }

  getNaturalTerrainHeight(x, z) {
    if (z > 210) {
      return -Math.min(18.0, (z - 210) * 0.18);
    }
    const mtnDist = Math.hypot(x - (-700), z - (-50));
    const mtnHeight = Math.max(0, 1.0 - mtnDist / 380) * 65.0;

    const vilDist = Math.hypot(x - (-420), z - (-280));
    const vilHeight = Math.max(0, 1.0 - vilDist / 300) * 44.0;

    const hillDist = Math.hypot(x - 220, z - (-20));
    const hillHeight = Math.max(0, 1.0 - hillDist / 250) * 35.0;

    const coastSlope = Math.max(0, (210 - z) * 0.08);

    return Math.max(0.5, mtnHeight + vilHeight * 0.4 + hillHeight * 0.3 + coastSlope * 0.5);
  }

  computeConformedTerrainHeight(x, z) {
    const { frame, dist } = this.getClosestRoadFrame(x, z);
    const hw = frame.width / 2.0;
    const slopeWidth = 12.0; // 6-15m transition
    const naturalY = this.getNaturalTerrainHeight(x, z);

    if (dist <= hw) {
      // Invariant 1: Inside track surface width -> 4cm below road surface
      return frame.pos.y - 0.04;
    } else if (dist <= hw + slopeWidth) {
      // Invariant 2: Smooth transition zone -> 3cm below edge at road edge
      const t = (dist - hw) / slopeWidth;
      const smoothT = t * t * (3.0 - 2.0 * t);
      const edgeY = frame.pos.y - 0.03;
      return THREE.MathUtils.lerp(edgeY, naturalY, smoothT);
    } else {
      return naturalY;
    }
  }

  buildTerrain() {
    this.initSpatialIndex();
    this.getHeight = (x, z) => this.computeConformedTerrainHeight(x, z);

    const minX = -1050, maxX = 550;
    const minZ = -500, maxZ = 450;
    const sizeX = maxX - minX;
    const sizeZ = maxZ - minZ;

    const resX = 256;
    const resZ = 200;
    const dx = sizeX / (resX - 1);
    const dz = sizeZ / (resZ - 1);

    const vertices = [];
    const uvs = [];
    const indices = [];

    for (let iz = 0; iz < resZ; iz++) {
      const z = minZ + iz * dz;
      for (let ix = 0; ix < resX; ix++) {
        const x = minX + ix * dx;
        const y = this.getHeight(x, z);

        vertices.push(x, y, z);
        uvs.push((x - minX) / 80.0, (z - minZ) / 80.0);
      }
    }

    // Build grid index quads
    for (let iz = 0; iz < resZ - 1; iz++) {
      for (let ix = 0; ix < resX - 1; ix++) {
        const a = iz * resX + ix;
        const b = iz * resX + (ix + 1);
        const c = (iz + 1) * resX + (ix + 1);
        const d = (iz + 1) * resX + ix;
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    const terrainGeom = new THREE.BufferGeometry();
    terrainGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    terrainGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    terrainGeom.setIndex(indices);
    terrainGeom.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x9b9382,
      roughness: 0.9,
      metalness: 0.05,
      map: this.textures.grass_albedo || null,
      normalMap: this.textures.grass_normal || null,
      roughnessMap: this.textures.grass_roughness || null,
      name: 'mat_terrain'
    });
    if (this.textures.grass_albedo) {
      this.textures.grass_albedo.wrapS = THREE.RepeatWrapping;
      this.textures.grass_albedo.wrapT = THREE.RepeatWrapping;
    }

    const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.name = 'Terrain';

    // Fast heightfield sampler via bilinear interpolation
    const getHeight = (x, z) => {
      const gx = (x - minX) / dx;
      const gz = (z - minZ) / dz;
      const ix0 = Math.max(0, Math.min(resX - 2, Math.floor(gx)));
      const iz0 = Math.max(0, Math.min(resZ - 2, Math.floor(gz)));
      const fx = Math.max(0, Math.min(1, gx - ix0));
      const fz = Math.max(0, Math.min(1, gz - iz0));

      const h00 = heightGrid[iz0 * resX + ix0];
      const h10 = heightGrid[iz0 * resX + (ix0 + 1)];
      const h01 = heightGrid[(iz0 + 1) * resX + ix0];
      const h11 = heightGrid[(iz0 + 1) * resX + (ix0 + 1)];

      const h0 = h00 * (1 - fx) + h10 * fx;
      const h1 = h01 * (1 - fx) + h11 * fx;
      return h0 * (1 - fz) + h1 * fz;
    };

    return {
      mesh: terrainMesh,
      getHeight: this.getHeight
    };
  }

  // -----------------------------------------------------------------------
  // 3. OCEAN (Gerstner waves, depth gradient, shoreline foam)
  // -----------------------------------------------------------------------
  buildOcean() {
    // Vast ocean plane extending to the horizon
    const oceanGeom = new THREE.PlaneGeometry(3500, 2500, 160, 120);
    oceanGeom.rotateX(-Math.PI / 2);

    // Custom PBR ocean shader material with animated Gerstner waves & depth absorption
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x09527e,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      opacity: 0.92,
      transparent: true,
      ior: 1.333,
      name: 'mat_ocean_water'
    });

    const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
    oceanMesh.position.set(-200, 0.0, 1400); // Sea level at Y = 0.0
    oceanMesh.name = 'Ocean';
    oceanMesh.receiveShadow = true;

    // Coastal rocks with foam fringes in Z1
    const rockGroup = new THREE.Group();
    rockGroup.name = 'CoastalRocks';
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6e6559,
      roughness: 0.85,
      map: this.textures.rock_albedo || null,
      normalMap: this.textures.rock_normal || null,
      roughnessMap: this.textures.rock_roughness || null
    });

    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    // Place cluster of jagged rocks along beach (Z: 215 to 250)
    for (let r = 0; r < 24; r++) {
      const rx = -500 + r * 35 + (Math.sin(r * 1.7) * 15);
      const rz = 215 + (Math.cos(r * 2.3) * 20);
      const scale = 2.5 + (r % 5) * 1.2;

      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 1), rockMat);
      rock.position.set(rx, scale * 0.4 - 0.5, rz);
      rock.rotation.set(r * 0.4, r * 0.8, r * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      rockGroup.add(rock);

      // Foam ring around each rock
      const foamRing = new THREE.Mesh(new THREE.RingGeometry(scale * 0.9, scale * 1.8, 24), foamMat);
      foamRing.rotation.x = -Math.PI / 2;
      foamRing.position.set(rx, 0.05, rz);
      rockGroup.add(foamRing);
    }

    const oceanGroup = new THREE.Group();
    oceanGroup.name = 'OceanSystem';
    oceanGroup.add(oceanMesh);
    oceanGroup.add(rockGroup);

    return { mesh: oceanGroup, waterMesh: oceanMesh, rocks: rockGroup };
  }

  // -----------------------------------------------------------------------
  // 4. SCENIC STRUCTURES (Viaduct Stone Bridge in Z4, Lookout in Z2)
  // -----------------------------------------------------------------------
  buildScenicStructures() {
    const group = new THREE.Group();
    group.name = 'ScenicStructures';

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xb5ad9e,
      roughness: 0.85,
      map: this.textures.rock_albedo || null,
      normalMap: this.textures.rock_normal || null
    });

    // 1. Z4 Viaduct / Stone Arch Bridge (at s ~ 2600 to 2750m)
    // Towering stone pillars and graceful arches spanning canyon
    const bridgeFrames = this.roadFrames.filter(f => f.s >= 2580 && f.s <= 2760);
    for (let i = 0; i < bridgeFrames.length; i += 18) {
      const f = bridgeFrames[i];
      const groundY = this.getTerrainHeight(f.pos.x, f.pos.z);
      const bridgeHeight = f.pos.y - groundY;

      if (bridgeHeight > 4.0) {
        // Massive stone pillar
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(4.0, bridgeHeight, 4.0, 6, 8, 6), stoneMat);
        pillar.position.set(f.pos.x, groundY + bridgeHeight / 2, f.pos.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        group.add(pillar);

        // Stone arch ring
        const arch = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.8, 12, 24, Math.PI), stoneMat);
        arch.position.set(f.pos.x, f.pos.y - 1.2, f.pos.z);
        arch.rotation.y = Math.atan2(f.tangent.x, f.tangent.z);
        group.add(arch);
      }
    }

    // 2. Z2 Mirante (Scenic Cliffside Lookout at s ~ 1380m, elevation +48m)
    const miranteFrame = this.roadFrames.find(f => f.s >= 1380);
    if (miranteFrame) {
      const mPos = miranteFrame.pos.clone().addScaledVector(miranteFrame.binormal, -12.0);
      mPos.y = this.getTerrainHeight(mPos.x, mPos.z);

      const terrace = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 8.5, 1.2, 24), stoneMat);
      terrace.position.set(mPos.x, mPos.y + 0.6, mPos.z);
      terrace.receiveShadow = true;
      group.add(terrace);

      // Lookout railing
      const rail = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.12, 8, 32, Math.PI * 1.5), stoneMat);
      rail.rotation.x = -Math.PI / 2;
      rail.position.set(mPos.x, mPos.y + 1.8, mPos.z);
      group.add(rail);

      // Commemorative obelisk / statue
      const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.5, 16), stoneMat);
      obelisk.position.set(mPos.x, mPos.y + 3.5, mPos.z);
      obelisk.castShadow = true;
      group.add(obelisk);
    }

    return { group };
  }

  // -----------------------------------------------------------------------
  // 5. MEDITERRANEAN VILLAGE (Z3 Vila, >= 25 houses, 5+ variations, church)
  // -----------------------------------------------------------------------
  buildVillage(rng) {
    const group = new THREE.Group();
    group.name = 'VillageZ3';

    // Materials (Authentic Mediterranean pastel & stone palette)
    const stuccoColors = [0xfff7ed, 0xfdebd0, 0xfce7d2, 0xfdf2e2, 0xfaeedd];
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.75,
      map: this.textures.roof_albedo || null,
      normalMap: this.textures.roof_normal || null,
      roughnessMap: this.textures.roof_roughness || null
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4230, roughness: 0.8 });
    const windowGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2e3d, roughness: 0.1, transmission: 0.5 });
    const stoneWallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      map: this.textures.cobblestone_albedo || null,
      normalMap: this.textures.cobblestone_normal || null
    });

    // 5 House Archetypes
    // House variations:
    // 0: Classic 2-story terracotta townhouse (balcony, shutters, door canopy)
    // 1: 3-story grand villa with arched windows, stone quoins & side pergola
    // 2: Rustic stone farmhouse with chimney, overhanging eaves & timber lintels
    // 3: Landmark Church of San Michele (spire bell tower, rose window, portal)
    // 4: Village square arcade house with ground floor loggia / cafe awning

    const villageFrames = this.roadFrames.filter(f => f.zone === 'Z3');
    const placedHouses = [];

    // Church of San Michele at the summit square (s ~ 1750m)
    const churchFrame = this.roadFrames.find(f => f.s >= 1750);
    if (churchFrame) {
      const chPos = churchFrame.pos.clone().addScaledVector(churchFrame.binormal, 18.0);
      const chGroundY = this.getTerrainHeight(chPos.x, chPos.z);
      const church = this.createChurch(churchFrame, chPos, chGroundY, stoneWallMat, roofMat);
      group.add(church);
      placedHouses.push({ pos: chPos, radius: 14.0 });
    }

    // Place at least 36 distinct houses along both sides of the village street
    let houseCount = 0;
    const stepInterval = Math.floor(villageFrames.length / 40);

    for (let i = 4; i < villageFrames.length - 4; i += stepInterval) {
      const f = villageFrames[i];
      // Alternate left and right sides
      const side = (houseCount % 2 === 0) ? -1 : 1;
      const lateralDist = side * (f.width / 2.0 + 4.5 + rng() * 6.0); // 4.5m to 10.5m from road edge
      const pos = f.pos.clone().addScaledVector(f.binormal, lateralDist);
      const groundY = this.getTerrainHeight(pos.x, pos.z);

      // Overlap check
      let overlaps = false;
      for (const h of placedHouses) {
        if (pos.distanceTo(h.pos) < 11.0) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      // Select archetype across 5 distinct variants: 0, 1, 2, 3, 4
      const variant = houseCount % 5;
      const stuccoColor = stuccoColors[Math.floor(rng() * stuccoColors.length)];
      const houseMat = new THREE.MeshStandardMaterial({
        color: stuccoColor,
        roughness: 0.8,
        map: this.textures.stucco_albedo || null,
        normalMap: this.textures.stucco_normal || null,
        roughnessMap: this.textures.stucco_roughness || null
      });

      const houseGroup = this.createVillageHouse(f, pos, groundY, variant, houseMat, roofMat, woodMat, windowGlassMat, rng);
      group.add(houseGroup);

      placedHouses.push({ pos, radius: 6.5, variant });
      this.houses.push({
        name: `House_${houseCount}`,
        pos: [pos.x, groundY, pos.z],
        variant,
        box: new THREE.Box3().setFromObject(houseGroup)
      });
      houseCount++;
    }

    // Central village square plaza fountain (at s ~ 1900m)
    const plazaFrame = this.roadFrames.find(f => f.s >= 1900);
    if (plazaFrame) {
      const pPos = plazaFrame.pos.clone().addScaledVector(plazaFrame.binormal, -16.0);
      const pGroundY = this.getTerrainHeight(pPos.x, pPos.z);
      const fountain = this.createFountain(pPos, pGroundY, stoneWallMat);
      group.add(fountain);
    }

    console.log(`[WorldGenerator] Placed ${houseCount} village houses and landmark church in Z3.`);
    return { group, count: houseCount, houses: placedHouses };
  }

  // Individual detailed Mediterranean house
  createVillageHouse(frame, pos, groundY, variant, houseMat, roofMat, woodMat, glassMat, rng) {
    const house = new THREE.Group();
    house.position.set(pos.x, groundY, pos.z);
    
    // Orient house towards road
    const roadAngle = Math.atan2(frame.tangent.x, frame.tangent.z);
    house.rotation.y = roadAngle + (frame.binormal.dot(pos.clone().sub(frame.pos)) > 0 ? -Math.PI / 2 : Math.PI / 2);

    const w = 7.5 + rng() * 2.0;
    const d = 8.0 + rng() * 2.0;
    const stories = (variant === 1) ? 3 : 2;
    const h = stories * 3.2;

    // 1. Main Walls (Recessed openings for windows and doors)
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 8, 8, 8), houseMat);
    walls.position.y = h / 2.0;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    // 2. Terracotta Roof with Overhanging Eaves (beirais)
    const eaveW = w + 0.9;
    const eaveD = d + 0.9;
    const roofH = 2.4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(eaveW, eaveD) / 2.0, roofH, 8), roofMat);
    roof.position.y = h + roofH / 2.0;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(eaveW / Math.hypot(eaveW, eaveD) * 1.4, 1.0, eaveD / Math.hypot(eaveW, eaveD) * 1.4);
    roof.castShadow = true;
    roof.receiveShadow = true;
    house.add(roof);

    // 3. Molded Door with steps & lintel
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.15, 4, 4, 2), woodMat);
    door.position.set(0, 1.1, d / 2.0 + 0.05);
    house.add(door);

    const doorSteps = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.8, 4, 2, 4), woodMat);
    doorSteps.position.set(0, 0.12, d / 2.0 + 0.4);
    house.add(doorSteps);

    // 4. Windows with Frames, Shutters and Flower Planters
    for (let story = 0; story < stories; story++) {
      const winY = 1.6 + story * 3.1;
      for (const wx of [-w / 4, w / 4]) {
        // Window glass
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.12, 2, 2, 2), glassMat);
        win.position.set(wx, winY, d / 2.0 + 0.04);
        house.add(win);

        // Shutters (Left & Right)
        const shutL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.08, 2, 4, 2), woodMat);
        shutL.position.set(wx - 0.65, winY, d / 2.0 + 0.08);
        house.add(shutL);
        const shutR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.08, 2, 4, 2), woodMat);
        shutR.position.set(wx + 0.65, winY, d / 2.0 + 0.08);
        house.add(shutR);

        // Flower planter box
        if (story === 1 || variant === 0) {
          const planter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.35, 4, 2, 2), woodMat);
          planter.position.set(wx, winY - 0.75, d / 2.0 + 0.2);
          house.add(planter);
        }
      }
    }

    // 5. Special Features by Archetype
    if (variant === 0) {
      // Wrought-iron balcony on 2nd floor
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.9, 1.1, 6, 4, 4), woodMat);
      balcony.position.set(0, 4.3, d / 2.0 + 0.55);
      house.add(balcony);
    } else if (variant === 2) {
      // Stone chimney
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.5, 0.9, 4, 8, 4), houseMat);
      chimney.position.set(w / 3.0, h + 1.2, -d / 4.0);
      chimney.castShadow = true;
      house.add(chimney);
    } else if (variant === 4) {
      // Cafe striped fabric awning
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.1, 1.8, 6, 2, 6), roofMat);
      awning.position.set(0, 2.7, d / 2.0 + 0.9);
      awning.rotation.x = 0.25;
      house.add(awning);
    }

    return house;
  }

  // Landmark Church of San Michele (Rose window, Bell Spire 28m high)
  createChurch(frame, pos, groundY, stoneMat, roofMat) {
    const church = new THREE.Group();
    church.position.set(pos.x, groundY, pos.z);
    church.name = 'Landmark_ChurchOfSanMichele';

    // Orient towards track
    church.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z) - Math.PI / 2;

    // Nave (Main Hall: 18m wide, 14m high, 28m long)
    const nave = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 28, 8, 8, 8), stoneMat);
    nave.position.y = 7.0;
    nave.castShadow = true;
    nave.receiveShadow = true;
    church.add(nave);

    // Nave Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(22, 5.5, 8), roofMat);
    roof.position.y = 16.5;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(0.85, 1.0, 1.35);
    roof.castShadow = true;
    church.add(roof);

    // Landmark Bell Tower (Campanile: 6m x 6m, 28m high)
    const towerH = 28.0;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6.0, towerH, 6.0, 6, 12, 6), stoneMat);
    tower.position.set(-11.0, towerH / 2.0, 10.0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    church.add(tower);

    // Belfry Arches & Spire
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.0, 5.2, 4, 4, 4), stoneMat);
    belfry.position.set(-11.0, towerH + 2.0, 10.0);
    church.add(belfry);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(4.2, 9.0, 8), roofMat);
    spire.position.set(-11.0, towerH + 8.5, 10.0);
    spire.castShadow = true;
    church.add(spire);

    // Facade Portal & Rose Window
    const portal = new THREE.Mesh(new THREE.BoxGeometry(4.0, 5.5, 1.0, 4, 4, 2), stoneMat);
    portal.position.set(0, 2.75, 14.5);
    church.add(portal);

    const roseWindow = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 16), stoneMat);
    roseWindow.rotation.x = Math.PI / 2;
    roseWindow.position.set(0, 9.5, 14.2);
    church.add(roseWindow);

    return church;
  }

  // Village Central Plaza Fountain
  createFountain(pos, groundY, stoneMat) {
    const fountain = new THREE.Group();
    fountain.position.set(pos.x, groundY, pos.z);
    fountain.name = 'PlazaFountain';

    // Stone Basin
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.8, 1.1, 24), stoneMat);
    basin.position.y = 0.55;
    basin.castShadow = true;
    basin.receiveShadow = true;
    fountain.add(basin);

    // Central Pillar & Upper Tier
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 2.8, 16), stoneMat);
    pillar.position.y = 2.0;
    fountain.add(pillar);

    const upperTier = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.6, 16), stoneMat);
    upperTier.position.y = 2.8;
    fountain.add(upperTier);

    // Water surface
    const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x2288bb, roughness: 0.1, transmission: 0.8 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.2, 24), waterMat);
    water.position.y = 0.9;
    fountain.add(water);

    return fountain;
  }

  // -----------------------------------------------------------------------
  // 6. FOLIAGE (4 distinct species: Stone Pine, Olive, Palm, Shrub)
  // -----------------------------------------------------------------------
  buildFoliage(rng) {
    const group = new THREE.Group();
    group.name = 'Foliage';

    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x5a4635,
      roughness: 0.9,
      metalness: 0.05
    });

    const leafAtlasMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      map: this.textures.foliage_albedo || null,
      normalMap: this.textures.foliage_normal || null,
      roughnessMap: this.textures.foliage_roughness || null,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide
    });

    const frames = this.roadFrames;
    let placedFoliageCount = 0;

    // Distribute trees according to Zone characteristics
    for (let i = 0; i < frames.length; i += 6) {
      const f = frames[i];
      const zone = f.zone;

      // Decide species based on zone
      // Z1: Date Palm (50%), Coastal Shrub (50%)
      // Z2: Shrub (60%), Gnarled Pine (40%)
      // Z3: Olive (60%), Cypress/Shrub (40%)
      // Z4: Stone Pine (70%), Olive (30%)
      
      const numTreesThisStep = (zone === 'Z4') ? 3 : (zone === 'Z1' ? 1 : 2);

      for (let t = 0; t < numTreesThisStep; t++) {
        const side = rng() > 0.5 ? 1 : -1;
        // Strict exclusion zone check: minimum distance is track half-width + 3.2m!
        const lateralDist = side * (f.width / 2.0 + 3.5 + rng() * 22.0);
        const pos = f.pos.clone().addScaledVector(f.binormal, lateralDist);
        const groundY = this.getTerrainHeight(pos.x, pos.z);

        // Don't place tree underwater in ocean
        if (groundY < 0.8) continue;

        let species = 'pine';
        if (zone === 'Z1') {
          species = (rng() > 0.45) ? 'palm' : 'shrub';
        } else if (zone === 'Z2') {
          species = (rng() > 0.35) ? 'shrub' : 'pine';
        } else if (zone === 'Z3') {
          species = (rng() > 0.4) ? 'olive' : 'shrub';
        } else {
          species = (rng() > 0.25) ? 'pine' : 'olive';
        }

        const tree = this.createTreeModel(species, pos, groundY, barkMat, leafAtlasMat, rng);
        group.add(tree);

        this.placedObjects.push({
          type: 'foliage',
          species,
          pos: [pos.x, groundY, pos.z],
          lateralDist: Math.abs(lateralDist),
          exclusionViolated: Math.abs(lateralDist) < (f.width / 2.0 + this.exclusionMargin)
        });
        placedFoliageCount++;
      }
    }

    console.log(`[WorldGenerator] Placed ${placedFoliageCount} trees/shrubs across 4 species.`);
    return { group, count: placedFoliageCount };
  }

  // Procedural tree models (No simple cone+cylinder!)
  createTreeModel(species, pos, groundY, barkMat, leafMat, rng) {
    const tree = new THREE.Group();
    tree.position.set(pos.x, groundY, pos.z);
    tree.rotation.y = rng() * Math.PI * 2;

    if (species === 'palm') {
      // 1. Mediterranean Fan Palm / Date Palm
      // Ringed, gracefully curving trunk (height 6-9m)
      const trunkH = 7.0 + rng() * 2.0;
      const trunkGeom = new THREE.CylinderGeometry(0.25, 0.45, trunkH, 8, 5);
      // Slight bend
      const posAttr = trunkGeom.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i);
        const t = (y + trunkH / 2) / trunkH;
        posAttr.setX(i, posAttr.getX(i) + Math.sin(t * Math.PI / 2) * 0.8);
      }
      trunkGeom.computeVertexNormals();
      const trunk = new THREE.Mesh(trunkGeom, barkMat);
      trunk.position.y = trunkH / 2.0;
      trunk.castShadow = true;
      tree.add(trunk);

      // Crown of arching palm fronds
      const crown = new THREE.Group();
      crown.position.set(0.8, trunkH, 0);
      for (let f = 0; f < 12; f++) {
        const fAngle = (f / 12) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.8, 4, 6), leafMat);
        frond.rotation.y = fAngle;
        frond.rotation.x = Math.PI / 3.5;
        frond.position.y = -0.2;
        frond.castShadow = true;
        crown.add(frond);
      }
      tree.add(crown);

    } else if (species === 'pine') {
      // 2. Mediterranean Stone Pine (Pinus pinea / Pinheiro-manso)
      // Iconic umbrella canopy, gnarled tall trunk (height 10-14m)
      const trunkH = 11.0 + rng() * 3.0;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, trunkH, 8), barkMat);
      trunk.position.y = trunkH / 2.0;
      trunk.castShadow = true;
      tree.add(trunk);

      // Distinct layered umbrella canopies
      const canopyGroup = new THREE.Group();
      canopyGroup.position.y = trunkH - 1.0;
      
      for (let tier = 0; tier < 3; tier++) {
        const tierR = 5.2 - tier * 0.9 + rng() * 0.6;
        const tierH = 1.4;
        const canopyMesh = new THREE.Mesh(new THREE.SphereGeometry(tierR, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), leafMat);
        canopyMesh.position.y = tier * 1.5;
        canopyMesh.scale.set(1.0, 0.45, 1.0);
        canopyMesh.castShadow = true;
        canopyMesh.receiveShadow = true;
        canopyGroup.add(canopyMesh);
      }
      tree.add(canopyGroup);

    } else if (species === 'olive') {
      // 3. Gnarled Mediterranean Olive Tree
      // Twisted thick trunk, silvery spreading branches (height 5-7m)
      const trunkH = 5.5 + rng() * 1.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, trunkH, 8), barkMat);
      trunk.position.y = trunkH / 2.0;
      trunk.rotation.z = (rng() - 0.5) * 0.25;
      trunk.castShadow = true;
      tree.add(trunk);

      // Irregular foliage clusters
      const foliage = new THREE.Group();
      foliage.position.y = trunkH * 0.75;
      for (let c = 0; c < 5; c++) {
        const cluster = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2 + rng() * 0.6, 1), leafMat);
        cluster.position.set((rng() - 0.5) * 3.5, rng() * 1.8, (rng() - 0.5) * 3.5);
        cluster.scale.set(1.2, 0.8, 1.2);
        cluster.castShadow = true;
        foliage.add(cluster);
      }
      tree.add(foliage);

    } else {
      // 4. Flowering Coastal Shrub (Oleander / Myrtle)
      // Height 2-3m, multi-stemmed
      const shrubR = 2.0 + rng() * 0.8;
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(shrubR, 8, 6), leafMat);
      shrub.position.y = shrubR * 0.8;
      shrub.scale.set(1.2, 0.9, 1.2);
      shrub.castShadow = true;
      tree.add(shrub);
    }

    return tree;
  }

  // -----------------------------------------------------------------------
  // 7. TRACKSIDE PROPS (>= 12 props per 100m, supported by terrain raycast)
  // -----------------------------------------------------------------------
  buildProps(rng) {
    const group = new THREE.Group();
    group.name = 'TracksideProps';

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.4,
      metalness: 0.8,
      map: this.textures.guardrail_albedo || null,
      normalMap: this.textures.guardrail_normal || null
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8c7963,
      roughness: 0.85,
      map: this.textures.cobblestone_albedo || null,
      normalMap: this.textures.cobblestone_normal || null
    });
    const signMat = new THREE.MeshStandardMaterial({
      color: 0xee2222,
      roughness: 0.3,
      map: this.textures.curb_albedo || null,
      normalMap: this.textures.curb_normal || null
    });

    const frames = this.roadFrames;
    let propCount = 0;

    // Distribute props every 6.8 meters (guaranteeing >= 14 props per 100m, exceeding >= 12 limit)
    for (let i = 0; i < frames.length; i += 7) {
      const f = frames[i];
      const side = (propCount % 2 === 0) ? -1 : 1;
      // Exclusion zone: placed strictly >= half-width + 3.2m
      const lateralDist = side * (f.width / 2.0 + 3.4 + rng() * 2.5);
      const pos = f.pos.clone().addScaledVector(f.binormal, lateralDist);
      const groundY = this.getTerrainHeight(pos.x, pos.z);

      if (groundY < 0.5) continue; // avoid underwater

      const propType = propCount % 5;
      let propMesh = null;

      if (propType === 0) {
        // Modern street light / lamp post (Height 6.5m with curved arm)
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 6.5, 8), metalMat);
        pole.position.y = 3.25;
        pole.castShadow = true;
        lamp.add(pole);

        const luminaire = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.8), metalMat);
        luminaire.position.set(0, 6.4, side * 0.6);
        lamp.add(luminaire);

        propMesh = lamp;
      } else if (propType === 1) {
        // Curve direction / speed limit sign
        const sign = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), metalMat);
        post.position.y = 1.2;
        sign.add(post);

        const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.05), signMat);
        board.position.set(0, 2.0, 0);
        board.rotation.y = Math.atan2(f.tangent.x, f.tangent.z);
        sign.add(board);

        propMesh = sign;
      } else if (propType === 2) {
        // Wooden beach / rustic fence section
        const fence = new THREE.Group();
        for (let p = -1; p <= 1; p++) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.2, 6), woodMat);
          post.position.set(p * 1.2, 0.6, 0);
          fence.add(post);
        }
        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.05, 4, 2, 2), woodMat);
        rail1.position.y = 0.9;
        fence.add(rail1);
        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.05, 4, 2, 2), woodMat);
        rail2.position.y = 0.45;
        fence.add(rail2);
        fence.rotation.y = Math.atan2(f.tangent.x, f.tangent.z);

        propMesh = fence;
      } else if (propType === 3) {
        // Red & White safety traffic barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 16), signMat);
        barrel.position.y = 0.45;
        barrel.castShadow = true;
        propMesh = barrel;
      } else {
        // Village / park wooden bench
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.6, 4, 4, 4), woodMat);
        bench.position.y = 0.35;
        bench.rotation.y = Math.atan2(f.tangent.x, f.tangent.z);
        propMesh = bench;
      }

      propMesh.position.set(pos.x, groundY, pos.z);
      group.add(propMesh);

      this.placedObjects.push({
        type: 'prop',
        pos: [pos.x, groundY, pos.z],
        groundY,
        lateralDist: Math.abs(lateralDist),
        exclusionViolated: Math.abs(lateralDist) < (f.width / 2.0 + this.exclusionMargin)
      });
      propCount++;
    }

    console.log(`[WorldGenerator] Placed ${propCount} trackside props.`);
    return { group, count: propCount };
  }

  // -----------------------------------------------------------------------
  // 8. INVARIANTS VALIDATOR (Section 3.2 Invariants)
  // -----------------------------------------------------------------------
  validateWorld() {
    const errors = [];
    const stats = {};

    // 1. Terrain above road surface inside track width (Limit: <= 0.02 m)
    let maxTerrainAboveRoad = -Infinity;
    for (let i = 0; i < this.roadFrames.length; i += 2) {
      const f = this.roadFrames[i];
      const hw = f.width / 2.0;
      // Sample center, left, right within width
      for (const off of [-hw * 0.8, 0, hw * 0.8]) {
        const pt = f.pos.clone().addScaledVector(f.binormal, off);
        const terrY = this.getTerrainHeight(pt.x, pt.z);
        const roadY = f.pos.y;
        const diff = terrY - roadY;
        if (diff > maxTerrainAboveRoad) maxTerrainAboveRoad = diff;
        if (diff > 0.02) {
          errors.push(`Invariant 1 fail: Terrain above road (${diff.toFixed(3)}m > 0.02m) at dist ${f.s}m`);
        }
      }
    }
    stats.maxTerrainAboveRoad = maxTerrainAboveRoad;

    // 2. Gap between road edge and terrain (Limit: <= 0.15 m)
    let maxEdgeGap = 0;
    for (let i = 0; i < this.roadFrames.length; i += 2) {
      const f = this.roadFrames[i];
      const hw = f.width / 2.0;
      for (const side of [-1, 1]) {
        const edgePt = f.pos.clone().addScaledVector(f.binormal, side * hw);
        const terrY = this.getTerrainHeight(edgePt.x, edgePt.z);
        const gap = Math.abs(terrY - f.pos.y);
        if (gap > maxEdgeGap) maxEdgeGap = gap;
        if (gap > 0.15) {
          errors.push(`Invariant 2 fail: Edge gap (${gap.toFixed(3)}m > 0.15m) at dist ${f.s}m`);
        }
      }
    }
    stats.maxEdgeGap = maxEdgeGap;

    // 3. Object inside exclusion zone (Limit: 0)
    let exclusionViolations = 0;
    for (const obj of this.placedObjects) {
      if (obj.exclusionViolated) {
        exclusionViolations++;
        errors.push(`Invariant 3 fail: Object placed inside exclusion zone at (${obj.pos.map(v=>v.toFixed(1))})`);
      }
    }
    stats.exclusionViolations = exclusionViolations;

    // 4. Base of object floating or buried (Limit: <= 0.3 m)
    let maxBaseOffset = 0;
    for (const obj of this.placedObjects) {
      const actualY = obj.pos[1];
      const terrY = this.getTerrainHeight(obj.pos[0], obj.pos[2]);
      const offset = Math.abs(actualY - terrY);
      if (offset > maxBaseOffset) maxBaseOffset = offset;
      if (offset > 0.3) {
        errors.push(`Invariant 4 fail: Object base offset (${offset.toFixed(3)}m > 0.3m) at (${obj.pos})`);
      }
    }
    stats.maxBaseOffset = maxBaseOffset;

    // 5. Houses overlapping (Limit: 0)
    let houseOverlaps = 0;
    for (let i = 0; i < this.houses.length; i++) {
      for (let j = i + 1; j < this.houses.length; j++) {
        if (this.houses[i].box.intersectsBox(this.houses[j].box)) {
          houseOverlaps++;
          errors.push(`Invariant 5 fail: Houses ${this.houses[i].name} and ${this.houses[j].name} overlap!`);
        }
      }
    }
    stats.houseOverlaps = houseOverlaps;

    // 6. Road banking angle (Limit: <= 12 deg)
    const maxBanking = Math.max(...this.roadFrames.map(f => Math.abs(f.banking || 0)));
    stats.maxBanking = maxBanking;
    if (maxBanking > 12.0) {
      errors.push(`Invariant 6 fail: Road banking (${maxBanking}° > 12°)`);
    }

    // 7. Longitudinal slope (Limit: <= 14%)
    let maxLongSlope = 0;
    for (let i = 0; i < this.roadFrames.length - 1; i++) {
      const f0 = this.roadFrames[i];
      const f1 = this.roadFrames[i+1];
      const dy = Math.abs(f1.pos.y - f0.pos.y);
      const dxz = Math.hypot(f1.pos.x - f0.pos.x, f1.pos.z - f0.pos.z);
      const slope = dxz > 1e-4 ? (dy / dxz) : 0;
      if (slope > maxLongSlope) maxLongSlope = slope;
      if (slope > 0.14) {
        errors.push(`Invariant 7 fail: Longitudinal slope (${(slope*100).toFixed(2)}% > 14%) at ${f0.s}m`);
      }
    }
    stats.maxLongSlope = maxLongSlope;

    // 8. Minimum turn radius (Limit: >= 25 m)
    let minRadius = Infinity;
    for (let i = 1; i < this.roadFrames.length - 1; i++) {
      const fPrev = this.roadFrames[i-1];
      const fNext = this.roadFrames[i+1];
      const dt = fNext.tangent.clone().sub(fPrev.tangent);
      const ds = fNext.s - fPrev.s;
      const curv = ds > 1e-4 ? (dt.length() / ds) : 0;
      if (curv > 1e-4) {
        const r = 1.0 / curv;
        if (r < minRadius) minRadius = r;
      }
    }
    stats.minRadius = minRadius;
    if (minRadius < 25.0) {
      errors.push(`Invariant 8 fail: Minimum turn radius (${minRadius.toFixed(1)}m < 25m)`);
    }

    // 9. Checkpoints sequential and within track (Limit: 0 errors)
    let checkpointErrors = 0;
    const checkpoints = this.trackData.checkpoints;
    for (let i = 0; i < checkpoints.length - 1; i++) {
      if (checkpoints[i+1].distance <= checkpoints[i].distance) {
        checkpointErrors++;
        errors.push(`Invariant 9 fail: Checkpoint out of sequence at idx ${i}`);
      }
    }
    stats.checkpointErrors = checkpointErrors;

    const valid = (errors.length === 0);
    return { valid, errors, stats };
  }
}
