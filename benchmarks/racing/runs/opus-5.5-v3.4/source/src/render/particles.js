// Tyre smoke, dust and sand particles: one pooled THREE.Points cloud with a
// soft procedural puff shader (no textures), CPU-simulated (drag, rise, growth,
// fade). Emission comes from wheel slip on paved surfaces and from wheels
// rolling on gravel / dirt / grass / sand.
import * as THREE from 'three';
import { SURF } from '../world/collision.js';

const MAX = 1400;
const KIND = {
  smoke: { col: [0.86, 0.85, 0.83], life: 2.6, size0: 0.9, grow: 2.6, rise: 0.55, alpha: 0.42, drag: 1.6 },
  dust: { col: [0.62, 0.52, 0.38], life: 1.9, size0: 0.8, grow: 2.0, rise: 0.35, alpha: 0.36, drag: 2.0 },
  sand: { col: [0.86, 0.76, 0.58], life: 1.3, size0: 0.55, grow: 1.5, rise: 0.15, alpha: 0.42, drag: 2.6 },
  grass: { col: [0.5, 0.5, 0.36], life: 1.0, size0: 0.5, grow: 1.1, rise: 0.2, alpha: 0.22, drag: 2.4 },
  spray: { col: [0.97, 0.97, 0.98], life: 1.1, size0: 0.35, grow: 1.4, rise: -6.5, alpha: 0.55, drag: 0.9 },
};

export class Particles {
  constructor(scene, sunColor) {
    this.n = 0; this.next = 0;
    this.p = new Float32Array(MAX * 3); this.v = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX).fill(1e9); this.life = new Float32Array(MAX);
    this.kind = new Array(MAX).fill(null);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSeed = new THREE.BufferAttribute(new Float32Array(MAX).map(() => Math.random() * 100), 1);
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha); g.setAttribute('aCol', this.aCol); g.setAttribute('aSeed', this.aSeed);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 }, uSun: { value: new THREE.Color(sunColor || 0xffc890) } },
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aAlpha; attribute vec3 aCol; attribute float aSeed;
        uniform float uScale; varying float vA; varying vec3 vC; varying float vSeed;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(0.5, -mv.z), 0.0, 512.0);
          vA = aAlpha; vC = aCol; vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSun; varying float vA; varying vec3 vC; varying float vSeed;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float r = dot(q, q);
          if (r > 1.0) discard;
          float puff = n2(q * 2.3 + vSeed) * 0.6 + n2(q * 5.1 - vSeed) * 0.4;
          float a = (1.0 - r) * (1.0 - r) * (0.55 + 0.6 * puff) * vA;
          // light from the low sun on the upper-left, sky ambient elsewhere
          float lit = 0.62 + 0.38 * clamp(0.5 - q.y * 0.6 + q.x * 0.2, 0.0, 1.0);
          vec3 sunL = mix(vec3(1.0), uSun, 0.5) * 1.05; // low sun, but smoke/dust are not neon orange
          vec3 c = vC * mix(vec3(0.6, 0.64, 0.72), sunL, lit);
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 3; this.points.name = 'particles';
    this.points.userData.audit = { kind: 'fx' };
    scene.add(this.points);
    this.acc = new Map();
  }

  emit(kind, x, y, z, vx, vy, vz) {
    const i = this.next; this.next = (this.next + 1) % MAX;
    const K = KIND[kind];
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = K.life * (0.75 + Math.random() * 0.5); this.kind[i] = K;
    const c = this.aCol.array; const j = 0.94 + Math.random() * 0.12;
    c[i * 3] = K.col[0] * j; c[i * 3 + 1] = K.col[1] * j; c[i * 3 + 2] = K.col[2] * j;
  }

  /** emission from a car's wheels (call once per frame) */
  fromCar(car, dt, key) {
    const sp = car.speed;
    if (sp < 1.5) return;
    let acc = this.acc.get(key) || 0;
    const q = car.quat;
    for (const w of car.wheels) {
      if (!w.contact) continue;
      const paved = w.surf === SURF.ASPHALT || w.surf === SURF.CURB || w.surf === SURF.BRIDGE || w.surf === SURF.SIDEWALK;
      let kind = null, rate = 0;
      const slip = Math.max(0, w.slipLat - 3.0) * 0.5 + w.slipLong * 4;
      if (paved && slip > 0.8) { kind = 'smoke'; rate = Math.min(40, (slip - 0.8) * 22); }
      else if (!paved) {
        kind = w.surf === SURF.SAND ? 'sand' : w.surf === SURF.GRASS ? 'grass' : 'dust';
        rate = Math.min(30, sp * (kind === 'grass' ? 0.25 : 0.7)) + slip * 6;
      }
      if (!kind) continue;
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        // contact point in world space
        _v.set(w.x, w.y - (car.spec.rest - w.comp) - car.spec.wheelRadius + 0.12, w.z).applyQuaternion(q).add(car.pos);
        const back = _b.set(0, 0, 1).applyQuaternion(q);
        const k = kind === 'smoke' ? 0.18 : 0.32;
        this.emit(kind, _v.x + (Math.random() - 0.5) * 0.3, Math.max(_v.y, w.hitY + 0.08), _v.z + (Math.random() - 0.5) * 0.3,
          car.vel.x * k + back.x * 1.5 + (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.6, car.vel.z * k + back.z * 1.5 + (Math.random() - 0.5) * 1.2);
      }
    }
    this.acc.set(key, acc);
  }

  /** sea spray bursting on the rocks near the camera (pulses like the foam rings) */
  sprayRocks(rocks, cam, dt) {
    if (!rocks || !rocks.length || dt <= 0) return;
    for (const [x, z, r] of rocks) {
      const dx = x - cam.x, dz = z - cam.z;
      if (dx * dx + dz * dz > 70 * 70) continue;
      if (Math.random() > dt * 0.45) continue;
      const n = 5 + Math.floor(Math.random() * 7);
      const a0 = Math.random() * Math.PI * 2;
      for (let k = 0; k < n; k++) {
        const a = a0 + (Math.random() - 0.5) * 1.6, rr = r * (0.8 + Math.random() * 0.3);
        const ox = Math.cos(a), oz = Math.sin(a);
        this.emit('spray', x + ox * rr, 0.15, z + oz * rr, ox * (0.6 + Math.random()), 2.2 + Math.random() * 2.6, oz * (0.6 + Math.random()));
      }
    }
  }

  update(dt, camera, scale = 1) {
    const P = this.p, V = this.v, S = this.aSize.array, A = this.aAlpha.array;
    for (let i = 0; i < MAX; i++) {
      const K = this.kind[i];
      if (!K || this.age[i] >= this.life[i]) { A[i] = 0; S[i] = 0; continue; }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      const d = Math.exp(-K.drag * dt);
      V[i * 3] *= d; V[i * 3 + 2] *= d; V[i * 3 + 1] = V[i * 3 + 1] * d + K.rise * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      S[i] = K.size0 + K.grow * Math.sqrt(t);
      A[i] = K.alpha * Math.min(1, t * 8) * (1 - t) * (1 - t);
    }
    this.aPos.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true; this.aCol.needsUpdate = true;
    if (camera) this.mat.uniforms.uScale.value = (innerHeight * scale * 0.5) / Math.tan((camera.fov * Math.PI) / 360) * 0.5;
  }
  clear() { this.age.fill(1e9); }
}
const _v = new THREE.Vector3(), _b = new THREE.Vector3();
