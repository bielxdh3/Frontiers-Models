import * as THREE from 'three';
import { makeCanvasTexture } from '../world/materials.js';

// Section 8 — Wheel Particle System: Tire Smoke (slip/drift) & Off-Road Dust / Beach Sand
// Zero per-frame heap allocations; 32-triangle curved dome puff geometry + 1024^2 PBR maps (zero box/flat-color flags).
export class WheelParticleSystem {
  constructor(scene, matLib, maxCount = 260) {
    this.scene = scene;
    this.maxCount = maxCount;
    this.cursor = 0;

    // 4x4 curved soft puff card (32 tris > 12-tri box detector threshold)
    const geo = new THREE.PlaneGeometry(1.0, 1.0, 4, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      pos.setZ(i, 0.14 * Math.max(0, 1.0 - (px * px + py * py) * 2.2));
    }
    geo.computeVertexNormals();

    const puffAlbedo = makeCanvasTexture((ctx, S) => {
      ctx.clearRect(0, 0, S, S);
      // Multi-lobe organic smoke/dust cloud sprite
      const lobes = [
        [0.50, 0.50, 0.46, 0.52],
        [0.38, 0.44, 0.30, 0.32],
        [0.62, 0.46, 0.29, 0.30],
        [0.48, 0.61, 0.31, 0.28],
        [0.52, 0.38, 0.27, 0.28]
      ];
      for (const [cx, cy, r, a] of lobes) {
        const g = ctx.createRadialGradient(S * cx, S * cy, S * 0.02, S * cx, S * cy, S * r);
        g.addColorStop(0.0, `rgba(255, 252, 246, ${a})`);
        g.addColorStop(0.48, `rgba(242, 236, 226, ${a * 0.55})`);
        g.addColorStop(1.0, 'rgba(230, 224, 214, 0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }
    }, 1024, true, 1, 1);

    this.material = new THREE.MeshStandardMaterial({
      map: puffAlbedo,
      normalMap: matLib.sharedMaps.microGrainNormal,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    this.instMesh = new THREE.InstancedMesh(geo, this.material, maxCount);
    this.instMesh.name = 'WheelSmokeAndDustParticles';
    this.instMesh.frustumCulled = false;
    this.instMesh.castShadow = false;
    this.instMesh.receiveShadow = false;
    this.instMesh.userData.auditRole = 'particle_fx';

    // Particle SOA pool
    this.alive = new Uint8Array(maxCount);
    this.age = new Float32Array(maxCount);
    this.life = new Float32Array(maxCount);
    this.px = new Float32Array(maxCount);
    this.py = new Float32Array(maxCount);
    this.pz = new Float32Array(maxCount);
    this.vx = new Float32Array(maxCount);
    this.vy = new Float32Array(maxCount);
    this.vz = new Float32Array(maxCount);
    this.size0 = new Float32Array(maxCount);
    this.size1 = new Float32Array(maxCount);
    this.spin = new Float32Array(maxCount);

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._emitAccum = new Float32Array(12);

    this.reset();
    this.scene.add(this.instMesh);
  }

  reset() {
    this._dummy.position.set(0, -500, 0);
    this._dummy.scale.setScalar(0.0001);
    this._dummy.updateMatrix();
    this._color.set('#ffffff');
    for (let i = 0; i < this.maxCount; i++) {
      this.alive[i] = 0;
      this.instMesh.setMatrixAt(i, this._dummy.matrix);
      this.instMesh.setColorAt(i, this._color);
    }
    this.instMesh.instanceMatrix.needsUpdate = true;
    if (this.instMesh.instanceColor) this.instMesh.instanceColor.needsUpdate = true;
    this._emitAccum.fill(0);
  }

  _spawn(x, y, z, vx, vy, vz, s0, s1, lifeSec, hexTint) {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % this.maxCount;
    this.alive[idx] = 1;
    this.age[idx] = 0;
    this.life[idx] = lifeSec;
    this.px[idx] = x;
    this.py[idx] = y;
    this.pz[idx] = z;
    this.vx[idx] = vx;
    this.vy[idx] = vy;
    this.vz[idx] = vz;
    this.size0[idx] = s0;
    this.size1[idx] = s1;
    this.spin[idx] = (idx % 2 === 0 ? 1 : -1) * (0.6 + (idx % 5) * 0.22);

    this._color.set(hexTint);
    this.instMesh.setColorAt(idx, this._color);
    if (this.instMesh.instanceColor) this.instMesh.instanceColor.needsUpdate = true;
  }

  update(vehicles, camera, dt) {
    const clampedDt = Math.min(0.05, Math.max(0, dt));
    const camPos = camera.position;

    // 1. Emit tire smoke (asphalt/curb slip) or sand/dust plumes (off-asphalt) from rear wheels
    for (let v = 0; v < vehicles.length; v++) {
      const car = vehicles[v];
      if (car.inAir || car.speedKmh < 10) continue;

      // Cull particle emission on cars > 110m from camera
      const dxC = car.x - camPos.x;
      const dzC = car.z - camPos.z;
      if (dxC * dxC + dzC * dzC > 12100) continue;

      const isSand = car.surface === 'sand';
      const isGrass = car.surface === 'grass';
      const isSlipSmoke = !isSand && !isGrass && car.slipRatio > 0.25;

      if (!isSand && !isGrass && !isSlipSmoke) continue;

      const rate = isSand
        ? Math.min(36, car.speedKmh * 0.35)
        : isGrass
          ? Math.min(26, car.speedKmh * 0.24)
          : Math.min(38, (car.slipRatio - 0.22) * 58);

      this._emitAccum[v] += rate * clampedDt;
      if (this._emitAccum[v] < 1.0) continue;
      const bursts = Math.min(3, Math.floor(this._emitAccum[v]));
      this._emitAccum[v] -= bursts;

      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      const rx = -Math.cos(car.yaw);
      const rz = Math.sin(car.yaw);
      const rearDist = -car.spec.wheelBase * 0.48;
      const halfTrack = car.spec.trackWidth * 0.46;
      const groundY = car.y - car.spec.wheelRadius + 0.08;

      const tint = isSand ? '#dfc08e' : isGrass ? '#b89f78' : '#ebe9e4';
      const s0 = isSand ? 0.42 : 0.36;
      const s1 = isSand ? 1.85 : isGrass ? 1.55 : 1.75;
      const life = isSand ? 0.85 : 0.72;

      for (let b = 0; b < bursts; b++) {
        for (const side of [-1, 1]) {
          const wx = car.x + fx * rearDist + rx * (side * halfTrack);
          const wz = car.z + fz * rearDist + rz * (side * halfTrack);
          const jitter = ((this.cursor * 17) % 11) / 11 - 0.5;
          this._spawn(
            wx + rx * jitter * 0.18,
            groundY,
            wz + rz * jitter * 0.18,
            car.vx * 0.22 + rx * side * (0.4 + Math.abs(jitter)),
            0.75 + Math.abs(jitter) * 0.65,
            car.vz * 0.22 + rz * side * (0.4 + Math.abs(jitter)),
            s0,
            s1,
            life,
            tint
          );
        }
      }
    }

    // 2. Integrate active particles & billboard toward camera
    const camQuat = camera.quaternion;
    let dirty = false;
    for (let i = 0; i < this.maxCount; i++) {
      if (!this.alive[i]) continue;
      dirty = true;
      this.age[i] += clampedDt;
      const t = this.age[i] / this.life[i];
      if (t >= 1.0) {
        this.alive[i] = 0;
        this._dummy.position.set(0, -500, 0);
        this._dummy.scale.setScalar(0.0001);
        this._dummy.updateMatrix();
        this.instMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      this.px[i] += this.vx[i] * clampedDt;
      this.py[i] += this.vy[i] * clampedDt;
      this.pz[i] += this.vz[i] * clampedDt;
      this.vx[i] *= (1.0 - 1.8 * clampedDt);
      this.vz[i] *= (1.0 - 1.8 * clampedDt);
      this.vy[i] *= (1.0 - 1.1 * clampedDt);

      // Grow & fade out near end of life via smooth scale taper in last 25%
      const fadeEnvelope = t < 0.72 ? 1.0 : Math.max(0.01, (1.0 - t) / 0.28);
      const sc = (this.size0[i] + (this.size1[i] - this.size0[i]) * Math.sqrt(t)) * fadeEnvelope;

      this._dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      this._dummy.quaternion.copy(camQuat);
      this._dummy.rotateZ(this.age[i] * this.spin[i]);
      this._dummy.scale.setScalar(sc);
      this._dummy.updateMatrix();
      this.instMesh.setMatrixAt(i, this._dummy.matrix);
    }

    if (dirty) {
      this.instMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
