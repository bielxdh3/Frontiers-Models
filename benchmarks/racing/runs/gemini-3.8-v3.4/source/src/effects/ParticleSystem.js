// src/effects/ParticleSystem.js
// Procedural particle system for tire smoke and off-road dust/sand

import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene, maxParticles = 600) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    this.particles = [];

    // Pre-allocated BufferGeometry
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 4); // RGBA
    this.sizes = new Float32Array(maxParticles);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    geom.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Particle texture (soft radial blob)
    const canvas = (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
    let map = null;
    if (canvas) {
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.5, 'rgba(230, 230, 230, 0.4)');
      grad.addColorStop(1, 'rgba(200, 200, 200, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      map = new THREE.CanvasTexture(canvas);
    }

    const mat = new THREE.PointsMaterial({
      size: 1.5,
      map: map,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        r: 1, g: 1, b: 1,
        size: 1.0
      });
    }
  }

  emit(pos, velocity, type = 'smoke', count = 2) {
    let emitted = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.pos.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4));
        p.vel.copy(velocity).multiplyScalar(0.2).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8));
        p.life = 0;
        p.maxLife = 0.6 + Math.random() * 0.5;

        if (type === 'smoke') {
          // White tire smoke
          p.r = 0.95; p.g = 0.95; p.b = 0.95;
          p.size = 1.2 + Math.random() * 0.6;
        } else if (type === 'sand') {
          // Warm golden beach sand dust
          p.r = 0.85; p.g = 0.72; p.b = 0.52;
          p.size = 1.0 + Math.random() * 0.5;
        } else {
          // Earth/grass dust
          p.r = 0.65; p.g = 0.58; p.b = 0.42;
          p.size = 0.9 + Math.random() * 0.5;
        }

        emitted++;
        if (emitted >= count) break;
      }
    }
  }

  update(dt) {
    const posAttr = this.points.geometry.attributes.position;
    const colAttr = this.points.geometry.attributes.color;
    const sizeAttr = this.points.geometry.attributes.size;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          posAttr.setXYZ(i, 0, -999, 0);
          colAttr.setXYZW(i, 0, 0, 0, 0);
        } else {
          p.pos.addScaledVector(p.vel, dt);
          p.vel.multiplyScalar(0.96); // drag
          p.vel.y += 0.2 * dt; // slight upward rise

          const progress = p.life / p.maxLife;
          const alpha = (1.0 - progress) * 0.45;
          const currentSize = p.size * (1.0 + progress * 2.2);

          posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
          colAttr.setXYZW(i, p.r, p.g, p.b, alpha);
          sizeAttr.setX(i, currentSize);
        }
      } else {
        posAttr.setXYZ(i, 0, -999, 0);
        colAttr.setXYZW(i, 0, 0, 0, 0);
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }
}
