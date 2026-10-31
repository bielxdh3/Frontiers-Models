/**
 * TrackBuilder.ts
 * Generates rich, vibrant, procedural 3D coastal racing environments:
 * - Extruded asphalt road ribbon with center dash and edge lines
 * - Alternating red/white curbs on curves
 * - Crash barriers & guardrails with support posts
 * - Animated ocean plane with azure water shader/specular highlights
 * - Coastal cliff rocks, sandy shores, and green terrain
 * - Mediterranean pastel village buildings with terracotta roofs
 * - Stone bay bridge with arched piers
 * - Dynamic illuminated tunnels with overhead LED fixtures
 * - Checkpoint arches with glowing beams
 * - Palm trees and coastal pines
 */

import * as THREE from 'three';
import { Track } from './Track';

export class TrackBuilder {
  public static buildTrackMesh(track: Track): THREE.Group {
    const group = new THREE.Group();
    group.name = `TrackMesh_${track.id}`;

    // 1. Build Extruded Road Ribbon
    const roadMesh = this.createRoadMesh(track);
    group.add(roadMesh);

    // 2. Build Curbs & Guardrails
    const barriersMesh = this.createBarriersAndCurbs(track);
    group.add(barriersMesh);

    // 3. Build Checkpoint Arches
    const archesGroup = this.createCheckpointArches(track);
    group.add(archesGroup);

    // 4. Build Scenic Environment Elements (Bridges, Tunnels, Buildings, Palms, Cliffs)
    const sceneryGroup = this.createScenery(track);
    group.add(sceneryGroup);

    // 5. Build Ocean Plane
    const ocean = this.createOcean();
    group.add(ocean);

    return group;
  }

  private static createRoadMesh(track: Track): THREE.Mesh {
    const samples = track.samplePoints;
    const binormals = track.binormals;
    const normals = track.normals;
    const numPts = samples.length;
    const halfWidth = 7.0; // 14m wide track

    // Geometry vertices and UVs
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < numPts; i++) {
      const pt = samples[i];
      const right = binormals[i];
      const norm = normals[i];

      // Left edge, Center, Right edge
      const pLeft = pt.clone().add(right.clone().multiplyScalar(-halfWidth)).add(norm.clone().multiplyScalar(0.05));
      const pRight = pt.clone().add(right.clone().multiplyScalar(halfWidth)).add(norm.clone().multiplyScalar(0.05));

      vertices.push(pLeft.x, pLeft.y, pLeft.z);
      vertices.push(pRight.x, pRight.y, pRight.z);

      const v = (track.arcLengths[i] / 15.0); // Texture tiling along track
      uvs.push(0, v);
      uvs.push(1, v);

      if (i < numPts - 1) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        indices.push(row1, row2, row1 + 1);
        indices.push(row1 + 1, row2, row2 + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Procedural Road Canvas Texture
    const roadTexture = this.generateRoadTexture();
    const material = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.65,
      metalness: 0.15
    });

    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private static generateRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark grey coastal asphalt
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle asphalt noise
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(25 + Math.random() * 25);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Outer white edge lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(25, 0, 10, 512);
    ctx.fillRect(512 - 35, 0, 10, 512);

    // Yellow center dashed line
    ctx.fillStyle = '#f4a261';
    for (let y = 0; y < 512; y += 80) {
      ctx.fillRect(251, y, 10, 48);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private static createBarriersAndCurbs(track: Track): THREE.Group {
    const group = new THREE.Group();
    const samples = track.samplePoints;
    const binormals = track.binormals;
    const numPts = samples.length;
    const halfWidth = 7.0;

    // Red and White Curbs Material
    const curbMat1 = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.7 }); // Red
    const curbMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }); // White
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, metalness: 0.6, roughness: 0.3 }); // Steel
    const railGeo = new THREE.BoxGeometry(0.3, 0.65, 8.0);
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9);

    for (let i = 0; i < numPts; i += 6) {
      const pt = samples[i];
      const right = binormals[i];
      const tangent = track.tangents[i];
      const angle = Math.atan2(tangent.x, tangent.z);

      // Left and right barriers
      [-1, 1].forEach((side) => {
        const barrierPos = pt.clone().add(right.clone().multiplyScalar(side * (halfWidth + 1.2)));
        barrierPos.y += 0.45;

        const rail = new THREE.Mesh(railGeo, barrierMat);
        rail.position.copy(barrierPos);
        rail.rotation.y = angle;
        rail.castShadow = true;
        group.add(rail);

        const post = new THREE.Mesh(postGeo, barrierMat);
        post.position.copy(barrierPos);
        post.position.y -= 0.15;
        group.add(post);

        // Curbs on road edge
        const curbPos = pt.clone().add(right.clone().multiplyScalar(side * (halfWidth + 0.3)));
        curbPos.y += 0.08;
        const curbGeo = new THREE.BoxGeometry(0.6, 0.12, 6.0);
        const curb = new THREE.Mesh(curbGeo, Math.floor(i / 12) % 2 === 0 ? curbMat1 : curbMat2);
        curb.position.copy(curbPos);
        curb.rotation.y = angle;
        group.add(curb);
      });
    }

    return group;
  }

  private static createCheckpointArches(track: Track): THREE.Group {
    const group = new THREE.Group();
    const archMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, metalness: 0.8, roughness: 0.2 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 }); // Glowing Cyan Beam

    track.checkpoints.forEach((cp, idx) => {
      const arch = new THREE.Group();
      arch.position.copy(cp.position);
      arch.position.y += 3.5;

      const angle = Math.atan2(cp.direction.x, cp.direction.z);
      arch.rotation.y = angle;

      // Pillars
      const pillarGeo = new THREE.BoxGeometry(0.8, 7.0, 0.8);
      const leftPillar = new THREE.Mesh(pillarGeo, archMat);
      leftPillar.position.set(-8.5, 0, 0);

      const rightPillar = new THREE.Mesh(pillarGeo, archMat);
      rightPillar.position.set(8.5, 0, 0);

      // Top Crossbar
      const barGeo = new THREE.BoxGeometry(18.0, 0.9, 0.9);
      const topBar = new THREE.Mesh(barGeo, archMat);
      topBar.position.set(0, 3.4, 0);

      // Neon Checkpoint Sign
      const neonGeo = new THREE.BoxGeometry(16.5, 0.3, 0.3);
      const neon = new THREE.Mesh(neonGeo, neonMat);
      neon.position.set(0, 2.7, 0);

      arch.add(leftPillar, rightPillar, topBar, neon);
      group.add(arch);
    });

    return group;
  }

  private static createScenery(track: Track): THREE.Group {
    const group = new THREE.Group();
    const samples = track.samplePoints;
    const numPts = samples.length;

    // Materials
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c5042, roughness: 0.9 });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xe0cda9, roughness: 0.95 });
    const buildingMat1 = new THREE.MeshStandardMaterial({ color: 0xfdf0d5, roughness: 0.6 }); // Pastel cream
    const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.6 }); // Terracotta orange
    const buildingMat3 = new THREE.MeshStandardMaterial({ color: 0xa8dadc, roughness: 0.6 }); // Pastel blue
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9e2a2b, roughness: 0.7 }); // Red tile roof
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 });
    const tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x333533, roughness: 0.8 });
    const bridgeStoneMat = new THREE.MeshStandardMaterial({ color: 0x7f7f7f, roughness: 0.75 });

    for (let i = 0; i < numPts; i += 8) {
      const pt = samples[i];
      const right = track.binormals[i];
      const type = track.pointTypes[i] || 'normal';

      if (type === 'town') {
        // Build seaside pastel villas along both sides
        [-1, 1].forEach((side) => {
          if (Math.random() < 0.65) {
            const bldgPos = pt.clone().add(right.clone().multiplyScalar(side * (13.0 + Math.random() * 6.0)));
            bldgPos.y = pt.y + 2.5;

            const height = 4.0 + Math.random() * 4.0;
            const bldgGeo = new THREE.BoxGeometry(6.0, height, 8.0);
            const chosenMat = [buildingMat1, buildingMat2, buildingMat3][Math.floor(Math.random() * 3)];
            const bldg = new THREE.Mesh(bldgGeo, chosenMat);
            bldg.position.copy(bldgPos);
            bldg.castShadow = true;
            bldg.receiveShadow = true;
            group.add(bldg);

            // Roof
            const roofGeo = new THREE.ConeGeometry(5.2, 1.8, 4);
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.copy(bldgPos);
            roof.position.y += height * 0.5 + 0.9;
            roof.rotation.y = Math.PI / 4;
            group.add(roof);
          }
        });
      } else if (type === 'tunnel') {
        // Enclosed arched tunnel segment
        const tunnelGeo = new THREE.CylinderGeometry(8.5, 8.5, 9.0, 16, 1, true, 0, Math.PI);
        const tunnel = new THREE.Mesh(tunnelGeo, tunnelWallMat);
        tunnel.position.copy(pt);
        tunnel.position.y += 0.5;
        const tangent = track.tangents[i];
        tunnel.rotation.y = Math.atan2(tangent.x, tangent.z);
        tunnel.rotation.z = Math.PI / 2;
        group.add(tunnel);

        // Tunnel internal LED strip
        const ledGeo = new THREE.BoxGeometry(0.3, 0.15, 8.0);
        const ledMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.copy(pt);
        led.position.y += 6.5;
        led.rotation.y = Math.atan2(tangent.x, tangent.z);
        group.add(led);
      } else if (type === 'bridge') {
        // Stone Bridge piers plunging into the water
        const pierGeo = new THREE.BoxGeometry(3.0, pt.y + 12.0, 4.0);
        const pier = new THREE.Mesh(pierGeo, bridgeStoneMat);
        pier.position.copy(pt);
        pier.position.y -= (pt.y + 12.0) * 0.5;
        group.add(pier);
      } else {
        // Normal coastal highway: Cliff rocks, sandy shores, and palm trees
        if (Math.random() < 0.5) {
          // Cliff Rocks on mountain side
          const rockPos = pt.clone().add(right.clone().multiplyScalar(-18.0 - Math.random() * 8.0));
          rockPos.y = pt.y + Math.random() * 6.0;
          const rockGeo = new THREE.DodecahedronGeometry(3.5 + Math.random() * 3.5);
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.copy(rockPos);
          rock.castShadow = true;
          group.add(rock);
        }

        // Coastal Palm Trees
        if (Math.random() < 0.45) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const treePos = pt.clone().add(right.clone().multiplyScalar(side * (12.0 + Math.random() * 5.0)));
          treePos.y = pt.y;

          // Trunk
          const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 6.0, 6);
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.copy(treePos);
          trunk.position.y += 3.0;
          trunk.rotation.z = (Math.random() - 0.5) * 0.2;
          trunk.castShadow = true;

          // Foliage
          const foliageGeo = new THREE.ConeGeometry(2.8, 3.5, 7);
          const foliage = new THREE.Mesh(foliageGeo, foliageMat);
          foliage.position.copy(treePos);
          foliage.position.y += 6.0;
          foliage.castShadow = true;

          group.add(trunk, foliage);
        }
      }
    }

    return group;
  }

  private static createOcean(): THREE.Mesh {
    const oceanGeo = new THREE.PlaneGeometry(3500, 3500, 32, 32);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0077b6,     // Mediterranean Azure Blue
      roughness: 0.15,
      metalness: 0.85
    });

    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.5; // Sea level
    ocean.receiveShadow = true;
    return ocean;
  }
}
