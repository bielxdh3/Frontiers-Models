// Pooled soft-sprite particles: tyre smoke when sliding, dust off the asphalt, sand spray on the beach, impact sparks/debris puffs.
import * as THREE from 'three';
import { SURF } from '../physics/ground.js';

const MAX = 1400;

export class Particles {
  constructor(scene, lighting) {
    this.n = 0; this.head = 0;
    this.pos = new Float32Array(MAX * 3), this.vel = new Float32Array(MAX * 3), this.life = new Float32Array(MAX), this.age = new Float32Array(MAX).fill(999);
    this.size = new Float32Array(MAX), this.col = new Float32Array(MAX * 4), this.grow = new Float32Array(MAX);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aSize = new THREE.BufferAttribute(new Float32Array(MAX), 1); this.aCol = new THREE.BufferAttribute(new Float32Array(MAX * 4), 4);
    this.aPos.setUsage(THREE.DynamicDrawUsage); this.aSize.setUsage(THREE.DynamicDrawUsage); this.aCol.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize); g.setAttribute('aCol', this.aCol);
    const seed = new Float32Array(MAX); for (let i = 0; i < MAX; i++) seed[i] = Math.random() * 50; g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { uScale: { value: 900 }, uSun: { value: new THREE.Vector3(1, 0.8, 0.6) } },
      vertexShader: `attribute float aSize; attribute vec4 aCol; attribute float aSeed; varying vec4 vC; varying float vSeed; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.5), 0.0, 120.0); vC = aCol; vC.a *= smoothstep(1.2, 8.0, -mv.z); vSeed = aSeed; }`,
      fragmentShader: `varying vec4 vC; varying float vSeed;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p,p); if (r > 1.0) discard;
          float n = 0.55 * vn(p * 2.6 + vSeed) + 0.30 * vn(p * 5.7 + vSeed * 1.7) + 0.15 * vn(p * 11.0 + vSeed * 0.3);
          float a = vC.a * pow(1.0 - r, 1.6) * smoothstep(0.18, 0.78, n + 0.35 * (1.0 - r)); gl_FragColor = vec4(vC.rgb * (0.82 + 0.3 * n), a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
    this.mat = m; this.acc = new Map();
  }

  emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a) {
    const i = this.head; this.head = (this.head + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0; this.size[i] = size; this.grow[i] = grow;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
  }

  /** emit for one vehicle (called per render frame with the real dt) */
  emitVehicle(v, id, dt, camPos) {
    const dx = v.p[0] - camPos.x, dz = v.p[2] - camPos.z;
    if (dx * dx + dz * dz > 120 * 120) return;
    const speed = Math.hypot(v.v[0], v.v[2]);
    for (let wi = 0; wi < 4; wi++) {
      const w = v.wheels[wi];
      if (!w.contact) continue;
      const key = id * 4 + wi; let acc = (this.acc.get(key) || 0);
      const surf = w.surf;
      const offroad = surf === SURF.SAND || surf === SURF.GRASS || surf === SURF.GRAVEL;
      let rate = 0, kind = 0;
      if (w.skid > 0.42 && !offroad) { rate = 34 * w.skid; kind = 0; }
      else if (offroad && speed > 4) { rate = Math.min(90, speed * 2.4); kind = surf === SURF.SAND ? 1 : 2; }
      else if (surf === SURF.WATER && speed > 5) { rate = Math.min(80, speed * 2.5); kind = 3; }
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const jx = (Math.random() - 0.5), jz = (Math.random() - 0.5);
        const bvx = v.v[0] * -0.15 + jx * 1.6, bvz = v.v[2] * -0.15 + jz * 1.6;
        if (kind === 0) this.emit(w.cp[0], w.cp[1] + 0.12, w.cp[2], bvx * 0.6, 0.6 + Math.random() * 0.8, bvz * 0.6, 1.1 + Math.random() * 0.9, 0.30 + Math.random() * 0.22, 0.9, 0.86, 0.85, 0.83, 0.30);
        else if (kind === 1) this.emit(w.cp[0], w.cp[1] + 0.1, w.cp[2], bvx * 1.4, 1.4 + Math.random() * 2.0, bvz * 1.4, 0.9 + Math.random() * 0.9, 0.28 + Math.random() * 0.25, 0.9, 0.86, 0.74, 0.52, 0.55);
        else if (kind === 2) this.emit(w.cp[0], w.cp[1] + 0.1, w.cp[2], bvx * 1.2, 0.9 + Math.random() * 1.4, bvz * 1.2, 1.1 + Math.random() * 1.0, 0.3 + Math.random() * 0.3, 0.8, 0.62, 0.55, 0.42, 0.45);
        else this.emit(w.cp[0], w.cp[1] + 0.05, w.cp[2], bvx * 1.5, 1.2 + Math.random() * 2.5, bvz * 1.5, 0.7 + Math.random() * 0.6, 0.18 + Math.random() * 0.15, 0.4, 0.85, 0.92, 0.98, 0.5);
      }
      this.acc.set(key, acc);
    }
  }

  burst(x, y, z, n, strength) {
    for (let k = 0; k < n; k++) this.emit(x, y, z, (Math.random() - 0.5) * strength, Math.random() * strength * 0.8, (Math.random() - 0.5) * strength, 0.5 + Math.random() * 0.6, 0.12 + Math.random() * 0.12, 0.2, 1.0, 0.8, 0.45, 0.9);
  }

  update(dt, renderer, camera) {
    const p = this.pos, v = this.vel, A = this.aPos.array, S = this.aSize.array, C = this.aCol.array;
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] >= this.life[i]) { S[i] = 0; C[i * 4 + 3] = 0; continue; }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      v[i * 3 + 1] += 0.35 * dt; const dr = Math.exp(-dt * 1.4); v[i * 3] *= dr; v[i * 3 + 2] *= dr; v[i * 3 + 1] *= dr;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      S[i] = this.size[i] * (1 + this.grow[i] * t * 3);
      C[i * 4] = this.col[i * 4]; C[i * 4 + 1] = this.col[i * 4 + 1]; C[i * 4 + 2] = this.col[i * 4 + 2];
      C[i * 4 + 3] = this.col[i * 4 + 3] * (1 - t) * Math.min(1, t * 8);
    }
    this.aPos.needsUpdate = true; this.aSize.needsUpdate = true; this.aCol.needsUpdate = true;
    const h = renderer.domElement.height / renderer.getPixelRatio();
    this.mat.uniforms.uScale.value = (renderer.domElement.height / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 0.55;
  }
}
