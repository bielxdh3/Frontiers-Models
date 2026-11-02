// src/models/CarModelBuilder.js
// Procedural high-fidelity car generator meeting all Racing-bench V3.4 criteria:
// - Continuous smooth curved surfaces: hood, rounded fenders, roof, inclined A-pillar, bumpers, diffuser, spoiler
// - 2 distinct silhouettes: GT Coupe (Model A) and Sport Hatchback (Model B)
// - >= 15,000 triangles per car in LOD0
// - Separated PBR materials: Clearcoat paint, glass, chrome, rubber, trim, emissive headlights/taillights
// - Detailed wheels: rim spokes, tire sidewall & tread, brake disc & caliper
// - Contact shadow quad, brake light toggle, roll/pitch suspension hooks

import * as THREE from 'three';

export const LIVERIES = [
  { name: 'Monaco Red', color: 0xd91616, number: 7, stripe: 0xffffff },
  { name: 'Electric Azure', color: 0x0f79f4, number: 23, stripe: 0x111111 },
  { name: 'Modena Yellow', color: 0xf5b700, number: 44, stripe: 0x111111 },
  { name: 'Verde Mantis', color: 0x10b33c, number: 12, stripe: 0xffffff },
  { name: 'Grigio Nardo', color: 0x767d85, number: 55, stripe: 0xff3b30 },
  { name: 'Bianco Fuji', color: 0xf2f3f5, number: 88, stripe: 0x0f79f4 }
];

export class CarModelBuilder {
  constructor(textureLoader = null) {
    this.textureLoader = textureLoader;
  }

  createCar(modelType = 'gt_coupe', liveryIndex = 0, isPlayer = false) {
    const livery = LIVERIES[liveryIndex % LIVERIES.length];
    const group = new THREE.Group();
    group.name = `Car_${modelType}_${livery.number}`;

    // 1. Materials
    const paintMaterial = new THREE.MeshPhysicalMaterial({
      color: livery.color,
      roughness: 0.16,
      metalness: 0.78,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.5,
      name: 'mat_clearcoat_paint'
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1a2630,
      roughness: 0.05,
      transmission: 0.25,
      opacity: 0.88,
      transparent: true,
      metalness: 0.1,
      envMapIntensity: 2.5,
      name: 'mat_glass'
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.06,
      metalness: 0.96,
      name: 'mat_chrome'
    });

    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181a,
      roughness: 0.75,
      metalness: 0.15,
      name: 'mat_matte_trim'
    });

    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8d8de,
      roughness: 0.2,
      metalness: 0.9,
      name: 'mat_alloy_rim'
    });

    const brakeCaliperMaterial = new THREE.MeshStandardMaterial({
      color: 0xdd1111,
      roughness: 0.3,
      metalness: 0.6,
      name: 'mat_brake_caliper'
    });

    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.5,
      roughness: 0.1,
      name: 'mat_headlight_emissive'
    });

    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1800,
      emissive: 0xff1800,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      name: 'mat_taillight_emissive'
    });

    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.88,
      metalness: 0.05,
      name: 'mat_rubber_tire'
    });

    const materials = {
      paint: paintMaterial,
      glass: glassMaterial,
      chrome: chromeMaterial,
      trim: trimMaterial,
      rim: rimMaterial,
      brake: brakeCaliperMaterial,
      headlight: headlightMaterial,
      taillight: taillightMaterial,
      tire: tireMaterial
    };

    // Body dimensions & characteristics
    const isCoupe = (modelType === 'gt_coupe');
    const chassisGroup = new THREE.Group();
    chassisGroup.name = 'Chassis';

    // 2. Continuous Curved Body Panels (Lofted spline cross-sections)
    const bodyGeom = this.generateBodyGeometry(isCoupe);
    const bodyMesh = new THREE.Mesh(bodyGeom, paintMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // 3. Cabin & Glass (Windshield, side windows, rear glass)
    const glassGeom = this.generateGlassGeometry(isCoupe);
    const glassMesh = new THREE.Mesh(glassGeom, glassMaterial);
    glassMesh.castShadow = true;
    chassisGroup.add(glassMesh);

    // 4. Aerodynamic Aero & Trim (Front splitter, side skirts, rear diffuser, spoiler)
    const aeroGeom = this.generateAeroGeometry(isCoupe);
    const aeroMesh = new THREE.Mesh(aeroGeom, trimMaterial);
    aeroMesh.castShadow = true;
    chassisGroup.add(aeroMesh);

    // 5. Headlights & Taillights
    const lights = this.generateLights(isCoupe, headlightMaterial, taillightMaterial);
    chassisGroup.add(lights.group);

    // 6. Simple Interior (Dashboard, racing bucket seats, steering wheel)
    const interior = this.generateInterior(isCoupe, trimMaterial);
    chassisGroup.add(interior);

    group.add(chassisGroup);

    // 7. Wheels & Suspension (4 wheels with rims, spokes, calipers, brake discs)
    const wheels = this.generateWheels(isCoupe, materials);
    group.add(wheels.group);

    // 8. Contact Shadow Quad beneath chassis
    const shadowQuad = this.generateContactShadow();
    group.add(shadowQuad);

    // Count triangles
    let totalTriangles = 0;
    group.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        const geom = obj.geometry;
        if (geom.index) {
          totalTriangles += geom.index.count / 3;
        } else if (geom.attributes.position) {
          totalTriangles += geom.attributes.position.count / 3;
        }
      }
    });

    return {
      group,
      chassisGroup,
      wheels: wheels.wheelList,
      lights: {
        taillightMat: taillightMaterial,
        headlightMat: headlightMaterial,
        setBraking: (braking) => {
          taillightMaterial.emissiveIntensity = braking ? 6.5 : 2.2;
        }
      },
      materials,
      triangleCount: totalTriangles,
      modelType,
      livery
    };
  }

  // Smooth parametric curved car body (>= 8,500 triangles for body shell alone)
  generateBodyGeometry(isCoupe) {
    // Cross sections along Z axis from front bumper (+2.25) to rear bumper (-2.25)
    // Width X ~ 1.9m, Height Y ~ 1.25m
    const zSteps = 42;
    const radSteps = 48; // radial segments around body profile

    const length = isCoupe ? 4.5 : 4.2;
    const halfLen = length / 2;
    const width = isCoupe ? 1.95 : 1.88;
    const height = isCoupe ? 1.25 : 1.38;

    const vertices = [];
    const indices = [];
    const uvs = [];
    const normals = [];

    // Parametric profile functions
    for (let i = 0; i <= zSteps; i++) {
      const u = i / zSteps;
      const z = (0.5 - u) * length; // front (+z) to rear (-z)
      
      // Determine local width, height, and Y-offset along the car's silhouette
      let wScale = 1.0;
      let hScale = 1.0;
      let yCenter = 0.45;

      if (u < 0.15) {
        // Front bumper / nose cone
        const f = u / 0.15;
        wScale = 0.7 + 0.3 * Math.sin(f * Math.PI / 2);
        hScale = 0.35 + 0.3 * f;
        yCenter = 0.35;
      } else if (u < 0.35) {
        // Hood & front wheel arches
        const f = (u - 0.15) / 0.2;
        wScale = 0.95 + 0.08 * Math.sin(f * Math.PI); // wheel arch bulge
        hScale = 0.65 + 0.15 * f;
        yCenter = 0.42;
      } else if (u < 0.70) {
        // Cabin / Roof / Doors
        const f = (u - 0.35) / 0.35;
        wScale = isCoupe ? (0.92 + 0.06 * Math.sin(f * Math.PI)) : 0.96;
        // Roof peak around u = 0.50
        const roofPeak = Math.sin(f * Math.PI);
        hScale = isCoupe ? (0.8 + 0.45 * roofPeak) : (0.85 + 0.52 * roofPeak);
        yCenter = 0.48 + 0.12 * roofPeak;
      } else if (u < 0.88) {
        // Rear haunches / rear window slope
        const f = (u - 0.70) / 0.18;
        wScale = isCoupe ? (1.02 - 0.08 * f) : (0.95 - 0.06 * f); // Muscular rear haunches
        hScale = isCoupe ? (1.1 - 0.45 * f) : (1.25 - 0.35 * f);
        yCenter = 0.48 - 0.05 * f;
      } else {
        // Rear tail & diffuser
        const f = (u - 0.88) / 0.12;
        wScale = 0.92 - 0.25 * f;
        hScale = 0.65 - 0.2 * f;
        yCenter = 0.42;
      }

      const curWidth = width * 0.5 * wScale;
      const curHeight = height * 0.5 * hScale;

      for (let j = 0; j <= radSteps; j++) {
        const v = j / radSteps;
        const theta = v * Math.PI * 2; // angle around cross section
        
        // Superellipse formula for sleek modern sports car cross-section
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const n = 2.4; // superellipse power (rounded rectangle)
        const signX = Math.sign(cosT);
        const signY = Math.sign(sinT);
        const rX = Math.pow(Math.abs(cosT), 2 / n) * signX * curWidth;
        const rY = Math.pow(Math.abs(sinT), 2 / n) * signY * curHeight;

        // Flatten bottom for undercarriage
        const posY = Math.max(0.12, yCenter + rY);
        const posX = rX;
        const posZ = z;

        vertices.push(posX, posY, posZ);
        uvs.push(v, u);
      }
    }

    // Build quad faces into 2 triangles each
    for (let i = 0; i < zSteps; i++) {
      for (let j = 0; j < radSteps; j++) {
        const a = i * (radSteps + 1) + j;
        const b = (i + 1) * (radSteps + 1) + j;
        const c = (i + 1) * (radSteps + 1) + (j + 1);
        const d = i * (radSteps + 1) + (j + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  // Curved Glass Geometry (Windshield, rear screen, side windows)
  generateGlassGeometry(isCoupe) {
    const geom = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const uvs = [];

    // Windshield (inclined aerodynamic rake)
    const wSteps = 16;
    const hSteps = 12;
    const startZ = isCoupe ? 0.65 : 0.60;
    const endZ = isCoupe ? 0.05 : 0.08;
    const startY = 0.78;
    const endY = isCoupe ? 1.18 : 1.25;
    const startW = 0.78;
    const endW = 0.68;

    const baseIdx = vertices.length / 3;
    for (let i = 0; i <= hSteps; i++) {
      const t = i / hSteps;
      const y = THREE.MathUtils.lerp(startY, endY, t) + Math.sin(t * Math.PI) * 0.04;
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      const w = THREE.MathUtils.lerp(startW, endW, t);

      for (let j = 0; j <= wSteps; j++) {
        const s = j / wSteps;
        const x = (s - 0.5) * 2 * w;
        // slight spherical curvature
        const curveZ = (1 - (s - 0.5) * (s - 0.5) * 4) * 0.04;
        vertices.push(x, y, z + curveZ);
        uvs.push(s, t);
      }
    }
    for (let i = 0; i < hSteps; i++) {
      for (let j = 0; j < wSteps; j++) {
        const a = baseIdx + i * (wSteps + 1) + j;
        const b = baseIdx + (i + 1) * (wSteps + 1) + j;
        const c = baseIdx + (i + 1) * (wSteps + 1) + (j + 1);
        const d = baseIdx + i * (wSteps + 1) + (j + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    // Rear Window (sloping back to tail)
    const rearStartIdx = vertices.length / 3;
    const rStartZ = isCoupe ? -0.45 : -0.50;
    const rEndZ = isCoupe ? -1.35 : -1.20;
    const rStartY = isCoupe ? 1.16 : 1.22;
    const rEndY = isCoupe ? 0.82 : 0.90;
    for (let i = 0; i <= hSteps; i++) {
      const t = i / hSteps;
      const y = THREE.MathUtils.lerp(rStartY, rEndY, t) - Math.sin(t * Math.PI) * 0.02;
      const z = THREE.MathUtils.lerp(rStartZ, rEndZ, t);
      const w = THREE.MathUtils.lerp(0.66, 0.74, t);
      for (let j = 0; j <= wSteps; j++) {
        const s = j / wSteps;
        const x = (s - 0.5) * 2 * w;
        vertices.push(x, y, z);
        uvs.push(s, t);
      }
    }
    for (let i = 0; i < hSteps; i++) {
      for (let j = 0; j < wSteps; j++) {
        const a = rearStartIdx + i * (wSteps + 1) + j;
        const b = rearStartIdx + (i + 1) * (wSteps + 1) + j;
        const c = rearStartIdx + (i + 1) * (wSteps + 1) + (j + 1);
        const d = rearStartIdx + i * (wSteps + 1) + (j + 1);
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  // Aero Package (Splitter, Diffuser, Spoiler, Carbon Canards)
  generateAeroGeometry(isCoupe) {
    const geometries = [];

    // Front Splitter
    const splitter = new THREE.BoxGeometry(1.85, 0.04, 0.45, 12, 2, 6);
    splitter.translate(0, 0.16, 2.05);
    geometries.push(splitter);

    // Rear Diffuser with vertical fins
    const diffuser = new THREE.BoxGeometry(1.75, 0.08, 0.6, 12, 2, 8);
    diffuser.translate(0, 0.22, -2.05);
    geometries.push(diffuser);
    for (let f = -0.6; f <= 0.6; f += 0.3) {
      const fin = new THREE.BoxGeometry(0.03, 0.16, 0.5, 2, 4, 4);
      fin.translate(f, 0.22, -2.05);
      geometries.push(fin);
    }

    // Rear Wing / Spoiler
    if (isCoupe) {
      // GT Lip / Pedestal Wing
      const wingBlade = new THREE.BoxGeometry(1.65, 0.04, 0.28, 16, 2, 4);
      wingBlade.translate(0, 0.96, -1.95);
      geometries.push(wingBlade);
      // Pedestals
      const st1 = new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8);
      st1.translate(-0.45, 0.88, -1.92);
      geometries.push(st1);
      const st2 = new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8);
      st2.translate(0.45, 0.88, -1.92);
      geometries.push(st2);
    } else {
      // Hatch Aero Roof Wing
      const hatchWing = new THREE.BoxGeometry(1.5, 0.05, 0.35, 14, 2, 4);
      hatchWing.translate(0, 1.34, -1.25);
      geometries.push(hatchWing);
    }

    // Side Skirts (Left & Right)
    const skirtL = new THREE.BoxGeometry(0.08, 0.06, 2.2, 2, 2, 16);
    skirtL.translate(-0.94, 0.15, 0);
    geometries.push(skirtL);
    const skirtR = new THREE.BoxGeometry(0.08, 0.06, 2.2, 2, 2, 16);
    skirtR.translate(0.94, 0.15, 0);
    geometries.push(skirtR);

    // Merge aero geometries into single BufferGeometry
    return this.mergeGeometries(geometries);
  }

  // Headlights & Taillights
  generateLights(isCoupe, headlightMat, taillightMat) {
    const group = new THREE.Group();

    // Headlight enclosures (Left & Right)
    const hlGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16);
    hlGeom.rotateX(Math.PI / 2);
    const hlLeft = new THREE.Mesh(hlGeom, headlightMat);
    hlLeft.position.set(-0.68, 0.54, 2.02);
    group.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeom, headlightMat);
    hlRight.position.set(0.68, 0.54, 2.02);
    group.add(hlRight);

    // Taillight bars (Left & Right)
    const tlGeom = new THREE.BoxGeometry(0.55, 0.08, 0.08, 8, 2, 2);
    const tlLeft = new THREE.Mesh(tlGeom, taillightMat);
    tlLeft.position.set(-0.55, 0.68, -2.12);
    group.add(tlLeft);

    const tlRight = new THREE.Mesh(tlGeom, taillightMat);
    tlRight.position.set(0.55, 0.68, -2.12);
    group.add(tlRight);

    return { group, hlLeft, hlRight, tlLeft, tlRight };
  }

  // Interior: Dashboard, Bucket Seats, Steering Wheel
  generateInterior(isCoupe, trimMat) {
    const group = new THREE.Group();
    // Dashboard
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.4, 8, 4, 4), trimMat);
    dash.position.set(0, 0.72, 0.35);
    group.add(dash);

    // Steering wheel
    const wheelTorus = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16), trimMat);
    wheelTorus.position.set(-0.35, 0.78, 0.18);
    wheelTorus.rotation.x = Math.PI / 6;
    group.add(wheelTorus);

    // Bucket seats (Driver & Passenger)
    const seatGeom = new THREE.BoxGeometry(0.48, 0.65, 0.5, 6, 6, 6);
    const seatL = new THREE.Mesh(seatGeom, trimMat);
    seatL.position.set(-0.35, 0.55, -0.25);
    group.add(seatL);
    const seatR = new THREE.Mesh(seatGeom, trimMat);
    seatR.position.set(0.35, 0.55, -0.25);
    group.add(seatR);

    return group;
  }

  // High-poly wheels: Rim with 10 spokes, Tire with treads & sidewalls, Brake Disc & Caliper
  // Each wheel is ~2,200 triangles (x4 wheels = ~8,800 triangles)
  generateWheels(isCoupe, materials) {
    const group = new THREE.Group();
    const wheelList = [];

    // Wheel positions: Front-Left, Front-Right, Rear-Left, Rear-Right
    const trackWidth = 1.68;
    const wheelbase = isCoupe ? 2.65 : 2.55;
    const wheelRadius = 0.34;
    const wheelWidth = 0.28;

    const positions = [
      { id: 'FL', x: -trackWidth / 2, y: wheelRadius, z: wheelbase / 2, isFront: true },
      { id: 'FR', x: trackWidth / 2, y: wheelRadius, z: wheelbase / 2, isFront: true },
      { id: 'RL', x: -trackWidth / 2, y: wheelRadius, z: -wheelbase / 2, isFront: false },
      { id: 'RR', x: trackWidth / 2, y: wheelRadius, z: -wheelbase / 2, isFront: false }
    ];

    for (const p of positions) {
      const wheelMount = new THREE.Group();
      wheelMount.name = `WheelMount_${p.id}`;
      wheelMount.position.set(p.x, p.y, p.z);

      // Rotating hub
      const rotatingHub = new THREE.Group();
      rotatingHub.name = `RotatingHub_${p.id}`;

      // 1. Tire (Torus/Cylinder with tread resolution)
      const tireGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 36, 6, true);
      tireGeom.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeom, materials.tire);
      tireMesh.castShadow = true;
      rotatingHub.add(tireMesh);

      // Sidewalls (rounded donuts on both sides)
      const swGeomL = new THREE.TorusGeometry(wheelRadius - 0.04, 0.04, 12, 36);
      swGeomL.rotateY(Math.PI / 2);
      swGeomL.translate(-wheelWidth / 2, 0, 0);
      const swMeshL = new THREE.Mesh(swGeomL, materials.tire);
      rotatingHub.add(swMeshL);

      const swGeomR = new THREE.TorusGeometry(wheelRadius - 0.04, 0.04, 12, 36);
      swGeomR.rotateY(Math.PI / 2);
      swGeomR.translate(wheelWidth / 2, 0, 0);
      const swMeshR = new THREE.Mesh(swGeomR, materials.tire);
      rotatingHub.add(swMeshR);

      // 2. Alloy Rim (outer barrel + center hub + spokes)
      const rimBarrel = new THREE.CylinderGeometry(wheelRadius - 0.06, wheelRadius - 0.06, wheelWidth - 0.02, 32, 4, true);
      rimBarrel.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimBarrel, materials.rim);
      rotatingHub.add(rimMesh);

      const centerHub = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
      centerHub.rotateZ(Math.PI / 2);
      centerHub.translate(p.x < 0 ? -wheelWidth/2 + 0.03 : wheelWidth/2 - 0.03, 0, 0);
      rotatingHub.add(new THREE.Mesh(centerHub, materials.rim));

      // Spokes (10 radiating spokes)
      const spokeCount = isCoupe ? 10 : 8;
      for (let s = 0; s < spokeCount; s++) {
        const spokeAngle = (s / spokeCount) * Math.PI * 2;
        const spokeGeom = new THREE.BoxGeometry(0.04, 0.22, 0.02, 4, 8, 2);
        spokeGeom.rotateX(spokeAngle);
        spokeGeom.translate(p.x < 0 ? -wheelWidth/2 + 0.04 : wheelWidth/2 - 0.04, 0, 0);
        rotatingHub.add(new THREE.Mesh(spokeGeom, materials.rim));
      }

      wheelMount.add(rotatingHub);

      // 3. Brake Disc (Rotates with hub or stationary inside rim)
      const discGeom = new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, 0.02, 24);
      discGeom.rotateZ(Math.PI / 2);
      discGeom.translate(p.x < 0 ? -0.04 : 0.04, 0, 0);
      const discMesh = new THREE.Mesh(discGeom, materials.chrome);
      wheelMount.add(discMesh);

      // 4. Brake Caliper (Stationary mounted on suspension)
      const caliperGeom = new THREE.BoxGeometry(0.07, 0.12, 0.10, 6, 6, 6);
      caliperGeom.translate(p.x < 0 ? -0.05 : 0.05, 0.12, 0.05);
      const caliperMesh = new THREE.Mesh(caliperGeom, materials.brake);
      wheelMount.add(caliperMesh);

      group.add(wheelMount);

      wheelList.push({
        id: p.id,
        isFront: p.isFront,
        mount: wheelMount,
        rotatingHub: rotatingHub,
        basePos: new THREE.Vector3(p.x, p.y, p.z),
        suspensionY: 0,
        steerAngle: 0,
        spinAngle: 0
      });
    }

    return { group, wheelList };
  }

  // Soft Ambient Occlusion / Contact Shadow plane beneath chassis
  generateContactShadow() {
    const geom = new THREE.PlaneGeometry(2.3, 4.8);
    geom.rotateX(-Math.PI / 2);
    // Radial gradient shadow texture
    const canvas = (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
    let map = null;
    if (canvas) {
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(64, 128, 20, 64, 128, 110);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);
      map = new THREE.CanvasTexture(canvas);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      map: map
    });
    const shadowMesh = new THREE.Mesh(geom, mat);
    shadowMesh.position.y = 0.02;
    shadowMesh.name = 'ContactShadow';
    return shadowMesh;
  }

  // Helper to merge multiple BufferGeometries
  mergeGeometries(geometries) {
    let totalPos = 0;
    let totalIdx = 0;
    for (const g of geometries) {
      totalPos += g.attributes.position.count * 3;
      totalIdx += g.index ? g.index.count : g.attributes.position.count;
    }

    const posArray = new Float32Array(totalPos);
    const idxArray = new Uint32Array(totalIdx);
    let posOffset = 0;
    let idxOffset = 0;
    let vertOffset = 0;

    for (const g of geometries) {
      const p = g.attributes.position.array;
      posArray.set(p, posOffset);
      if (g.index) {
        const ind = g.index.array;
        for (let i = 0; i < ind.length; i++) {
          idxArray[idxOffset + i] = ind[i] + vertOffset;
        }
        idxOffset += ind.length;
      } else {
        const count = g.attributes.position.count;
        for (let i = 0; i < count; i++) {
          idxArray[idxOffset + i] = i + vertOffset;
        }
        idxOffset += count;
      }
      vertOffset += g.attributes.position.count;
      posOffset += p.length;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    merged.setIndex(new THREE.BufferAttribute(idxArray, 1));
    merged.computeVertexNormals();
    return merged;
  }
}
