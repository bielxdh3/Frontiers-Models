/**
 * Renderer.ts
 * Manages Three.js WebGL2 renderer, shadow maps, quality presets (Low, Medium, High),
 * and canvas resizing.
 */

import * as THREE from 'three';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export class GraphicsRenderer {
  public renderer: THREE.WebGLRenderer;
  public canvas: HTMLCanvasElement;
  public currentQuality: GraphicsQuality = 'high';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Required for PhotoStudio snapshots
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.applyQuality(this.currentQuality);
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  public applyQuality(quality: GraphicsQuality): void {
    this.currentQuality = quality;

    switch (quality) {
      case 'low':
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(Math.min(0.75, window.devicePixelRatio));
        break;
      case 'medium':
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.setPixelRatio(Math.min(1.0, window.devicePixelRatio));
        break;
      case 'high':
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(Math.min(2.0, window.devicePixelRatio));
        break;
    }

    this.handleResize();
  }

  public handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }
}
