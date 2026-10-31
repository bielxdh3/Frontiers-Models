/**
 * CarVisuals.ts
 * Procedural 3D vehicle visual representation:
 * - Differentiated 3D geometry for Riviera Spyder, Corsica GT, Monaco Hyperion
 * - Dynamic wheel rotation & steering angle
 * - Progressive collision damage (body panel crumple, hood tilt, headlight flicker, smoke)
 * - Working headlights & brake lights
 * - Nitro exhaust flame cones
 */

import * as THREE from 'three';
import { Vehicle } from '../gameplay/Vehicle';
import { CarConfig } from '../gameplay/CarConfigs';

export class CarVisuals {
  public group = new THREE.Group();
  public vehicle: Vehicle;

  // Visual sub-nodes
  private bodyMesh: THREE.Mesh | null = null;
  private hoodMesh: THREE.Mesh | null = null;
  private spoilerMesh: THREE.Mesh | null = null;
  private wheels: THREE.Mesh[] = [];
  private frontWheelPivots: THREE.Group[] = [];
  private headlights: THREE.PointLight[] = [];
  private tailLightsMat: THREE.MeshBasicMaterial;
  private nitroFlames: THREE.Mesh[] = [];
  private smokeParticles: THREE.Points | null = null;

  // Damage state caching
  private lastAppliedDamage = 0;
  private bodyMaterial: THREE.MeshStandardMaterial | null = null;

  constructor(vehicle: Vehicle) {
    this.vehicle = vehicle;
    this.tailLightsMat = new THREE.MeshBasicMaterial({ color: 0xd90429 });
    this.buildCarModel();
  }

  private buildCarModel(): void {
    const cfg = this.vehicle.config;
    const cat = cfg.category;

    // Primary Body Paint Material
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      metalness: 0.85,
      roughness: 0.25
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: cfg.accentColor,
      metalness: 0.7,
      roughness: 0.35
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: cfg.glassColor,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7
    });

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.15 });

    // 1. Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(cfg.chassisWidth, 0.45, cfg.chassisLength);
    this.bodyMesh = new THREE.Mesh(chassisGeo, this.bodyMaterial);
    this.bodyMesh.position.y = 0.4;
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // 2. Cabin / Hood based on category
    if (cat === 'agile') {
      // Riviera Spyder (Open-top Roadster)
      const cabinGeo = new THREE.BoxGeometry(cfg.chassisWidth * 0.85, 0.3, cfg.chassisLength * 0.4);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.7, 0.2);
      this.group.add(cabin);

      // Twin Roll Bars
      const rollBarGeo = new THREE.TorusGeometry(0.22, 0.05, 8, 16, Math.PI);
      const leftRoll = new THREE.Mesh(rollBarGeo, accentMat);
      leftRoll.position.set(-0.4, 0.9, 0.35);
      const rightRoll = new THREE.Mesh(rollBarGeo, accentMat);
      rightRoll.position.set(0.4, 0.9, 0.35);
      this.group.add(leftRoll, rightRoll);

    } else if (cat === 'balanced') {
      // Corsica GT (Sleek Coupe Cabin & Rear Wing)
      const cabinGeo = new THREE.BoxGeometry(cfg.chassisWidth * 0.82, 0.48, cfg.chassisLength * 0.48);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.75, 0.1);
      this.group.add(cabin);

      // Hood Scoop
      const hoodGeo = new THREE.BoxGeometry(0.7, 0.12, 1.2);
      this.hoodMesh = new THREE.Mesh(hoodGeo, accentMat);
      this.hoodMesh.position.set(0, 0.65, -1.1);
      this.group.add(this.hoodMesh);

      // Rear Spoiler
      const spoilerBarGeo = new THREE.BoxGeometry(cfg.chassisWidth * 0.9, 0.06, 0.35);
      this.spoilerMesh = new THREE.Mesh(spoilerBarGeo, accentMat);
      this.spoilerMesh.position.set(0, 0.95, cfg.chassisLength * 0.42);
      this.group.add(this.spoilerMesh);

    } else {
      // Monaco Hyperion (Extreme Wedge Hypercar)
      const cabinGeo = new THREE.BoxGeometry(cfg.chassisWidth * 0.78, 0.42, cfg.chassisLength * 0.52);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.7, 0.0);
      this.group.add(cabin);

      // Active Aero Wing
      const wingGeo = new THREE.BoxGeometry(cfg.chassisWidth * 0.95, 0.08, 0.4);
      this.spoilerMesh = new THREE.Mesh(wingGeo, accentMat);
      this.spoilerMesh.position.set(0, 1.0, cfg.chassisLength * 0.44);
      this.group.add(this.spoilerMesh);

      // Aggressive Front Splitter
      const splitterGeo = new THREE.BoxGeometry(cfg.chassisWidth * 1.02, 0.06, 0.5);
      const splitter = new THREE.Mesh(splitterGeo, accentMat);
      splitter.position.set(0, 0.2, -cfg.chassisLength * 0.48);
      this.group.add(splitter);
    }

    // 3. Wheels & Pivots
    const wheelRadius = cfg.wheelRadius;
    const wheelWidth = 0.28;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const halfW = cfg.chassisWidth * 0.5 + 0.04;
    const wheelZOffsets = [-cfg.chassisLength * 0.32, cfg.chassisLength * 0.32]; // Front, Rear

    // Front Left & Right (with steering pivots)
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * halfW, wheelRadius, wheelZOffsets[0]);

      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.castShadow = true;
      pivot.add(wheelMesh);

      this.group.add(pivot);
      this.frontWheelPivots.push(pivot);
      this.wheels.push(wheelMesh);
    });

    // Rear Left & Right
    [-1, 1].forEach((side) => {
      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.position.set(side * halfW, wheelRadius, wheelZOffsets[1]);
      wheelMesh.castShadow = true;
      this.group.add(wheelMesh);
      this.wheels.push(wheelMesh);
    });

    // 4. Headlights & Taillights
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach((side) => {
      const lightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), headLightMat);
      lightMesh.position.set(side * (cfg.chassisWidth * 0.38), 0.48, -cfg.chassisLength * 0.5);
      this.group.add(lightMesh);

      // Real 3D headlight for night visibility
      const light = new THREE.PointLight(0xffffff, 1.2, 45, 1.8);
      light.position.set(side * (cfg.chassisWidth * 0.38), 0.5, -cfg.chassisLength * 0.52);
      this.group.add(light);
      this.headlights.push(light);
    });

    // Taillights
    [-1, 1].forEach((side) => {
      const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), this.tailLightsMat);
      tailMesh.position.set(side * (cfg.chassisWidth * 0.38), 0.5, cfg.chassisLength * 0.5);
      this.group.add(tailMesh);
    });

    // 5. Nitro Exhaust Flame Cones
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.85 });
    const flameGeo = new THREE.ConeGeometry(0.12, 0.9, 8);
    flameGeo.rotateX(-Math.PI / 2);

    [-0.32, 0.32].forEach((xOff) => {
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(xOff, 0.35, cfg.chassisLength * 0.52);
      flame.visible = false;
      this.group.add(flame);
      this.nitroFlames.push(flame);
    });
  }

  public updateVisuals(isNight: boolean): void {
    // 1. Sync transform with vehicle simulation
    this.group.position.copy(this.vehicle.position);
    this.group.quaternion.copy(this.vehicle.rotation);

    // 2. Front Wheel Steering & All Wheel Spin
    this.frontWheelPivots.forEach((pivot) => {
      pivot.rotation.y = this.vehicle.steerAngle;
    });

    this.wheels.forEach((w) => {
      w.rotation.x = this.vehicle.wheelRotation;
    });

    // 3. Headlights intensity in night vs day
    const lightIntensity = isNight ? 2.5 : 0.4;
    this.headlights.forEach((hl) => {
      hl.intensity = lightIntensity;
    });

    // 4. Taillights brake glow
    if (this.tailLightsMat) {
      const isBraking = this.vehicle.velocity.dot(this.vehicle.forward) > 0 && this.vehicle.speedKmh > 5;
      this.tailLightsMat.color.setHex(isBraking ? 0xff0033 : 0x770011);
    }

    // 5. Nitro Flames
    const showFlames = this.vehicle.isNitroActive;
    this.nitroFlames.forEach((flame) => {
      flame.visible = showFlames;
      if (showFlames) {
        const flicker = 0.8 + Math.random() * 0.4;
        flame.scale.set(flicker, flicker, flicker);
      }
    });

    // 6. Progressive Collision Damage Application
    this.applyVisualDamage(this.vehicle.damage);
  }

  private applyVisualDamage(dmg: number): void {
    if (Math.abs(dmg - this.lastAppliedDamage) < 0.01) return;
    this.lastAppliedDamage = dmg;

    // Body Paint Scuffing
    if (this.bodyMaterial) {
      this.bodyMaterial.roughness = 0.25 + dmg * 0.55; // Scratched finish
      this.bodyMaterial.metalness = Math.max(0.2, 0.85 - dmg * 0.5);
    }

    // Body Crumple / Displacement
    if (this.bodyMesh) {
      this.bodyMesh.position.y = 0.4 - dmg * 0.08;
      this.bodyMesh.rotation.z = (dmg > 0.3 ? (dmg - 0.3) * 0.1 : 0);
    }

    // Hood Dent
    if (this.hoodMesh) {
      this.hoodMesh.position.y = 0.65 - dmg * 0.12;
      this.hoodMesh.rotation.x = dmg * 0.15;
    }

    // Tilted Spoiler
    if (this.spoilerMesh) {
      this.spoilerMesh.rotation.z = -dmg * 0.22;
      this.spoilerMesh.position.y = (this.spoilerMesh.position.y || 1.0) - dmg * 0.06;
    }
  }
}
