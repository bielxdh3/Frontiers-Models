/**
 * Environment.ts
 * Manages dynamic daylight progression, skies, sun/moon positions,
 * and dynamic weather (Sunny, Cloudy, Rainy) with dynamic rain particles and wet road reflections.
 */

import * as THREE from 'three';

export interface LightingColors {
  sky: number;
  sun: number;
  ambient: number;
  fog: number;
  sunIntensity: number;
  ambientIntensity: number;
  fogDensity: number;
}

export class Environment {
  public scene: THREE.Scene;
  public dirLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemisphereLight: THREE.HemisphereLight;
  public rainParticles: THREE.Points | null = null;

  private rainCount = 2500;
  private rainGeo: THREE.BufferGeometry | null = null;
  private rainPositions: Float32Array | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Directional Sun/Moon Light
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(100, 200, 100);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 600;
    const d = 120;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    // Ambient and Hemisphere
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5a80, 0.35);
    this.scene.add(this.hemisphereLight);

    // Scene Fog
    this.scene.fog = new THREE.FogExp2(0x90e0ef, 0.0018);

    this.initRain();
  }

  private initRain(): void {
    this.rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 120;
      this.rainPositions[i * 3 + 1] = Math.random() * 50;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xcce3de,
      size: 0.35,
      transparent: true,
      opacity: 0.65
    });

    this.rainParticles = new THREE.Points(this.rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  public update(dt: number, daylightHours: number, weatherWetness: number, cameraPos: THREE.Vector3): void {
    // 1. Calculate Sun Angle from daylight hours (0..24, sunrise ~6.5, sunset ~19)
    const sunAngle = ((daylightHours - 6) / 24) * Math.PI * 2;
    const sunDist = 300;
    const sunY = Math.sin(sunAngle) * sunDist;
    const sunX = Math.cos(sunAngle) * sunDist;

    this.dirLight.position.set(cameraPos.x + sunX, Math.max(15, cameraPos.y + sunY), cameraPos.z + 120);
    this.dirLight.target.position.copy(cameraPos);
    this.dirLight.target.updateMatrixWorld();

    const isNight = daylightHours < 5.5 || daylightHours > 20.5;
    const isSunset = (daylightHours >= 17.5 && daylightHours <= 20.5);
    const isMorning = (daylightHours >= 5.5 && daylightHours <= 8.5);

    // 2. Adjust Colors based on Time of Day & Weather
    let skyColor: number;
    let sunColor: number;
    let sunIntensity: number;
    let ambientIntensity: number;
    let fogDensity: number;

    if (isNight) {
      skyColor = 0x050814;      // Deep midnight navy
      sunColor = 0x8ecae6;      // Moon glow
      sunIntensity = 0.35;
      ambientIntensity = 0.25;
      fogDensity = 0.0035;
    } else if (isSunset) {
      skyColor = 0xfb8500;      // Warm sunset orange
      sunColor = 0xffb703;      // Golden horizon
      sunIntensity = 1.2;
      ambientIntensity = 0.45;
      fogDensity = 0.0022;
    } else if (isMorning) {
      skyColor = 0xffd166;      // Soft golden sunrise
      sunColor = 0xffe8d6;
      sunIntensity = 1.3;
      ambientIntensity = 0.45;
      fogDensity = 0.0020;
    } else {
      // Crisp Daytime
      skyColor = 0x48cae4;      // Bright Mediterranean sky
      sunColor = 0xffffff;
      sunIntensity = 1.8;
      ambientIntensity = 0.55;
      fogDensity = 0.0016;
    }

    // Weather adjustments: rainy/cloudy dimming
    if (weatherWetness > 0.1) {
      sunIntensity *= (1.0 - weatherWetness * 0.45);
      ambientIntensity *= (1.0 - weatherWetness * 0.25);
      fogDensity += weatherWetness * 0.003;
    }

    this.scene.background = new THREE.Color(skyColor);
    this.dirLight.color.setHex(sunColor);
    this.dirLight.intensity = sunIntensity;
    this.ambientLight.intensity = ambientIntensity;

    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(skyColor);
      this.scene.fog.density = fogDensity;
    }

    // 3. Rain Particles Simulation
    if (this.rainParticles && this.rainPositions && this.rainGeo) {
      if (weatherWetness > 0.25) {
        this.rainParticles.visible = true;
        this.rainParticles.position.copy(cameraPos);

        const posAttr = this.rainGeo.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < this.rainCount; i++) {
          arr[i * 3 + 1] -= 85.0 * dt; // Fall speed
          if (arr[i * 3 + 1] < -5.0) {
            arr[i * 3 + 1] = 45.0 + Math.random() * 5.0;
          }
        }
        posAttr.needsUpdate = true;
      } else {
        this.rainParticles.visible = false;
      }
    }
  }

  public isNight(daylightHours: number): boolean {
    return daylightHours < 5.5 || daylightHours > 20.5;
  }
}
