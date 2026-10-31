/**
 * PhotoStudio.ts
 * Implementation of the Signature Feature: Riviera Photo Studio & Snapshot Suite.
 * - 6-DOF Orbital/Drone camera around the subject vehicle
 * - Real-time focal length / FOV, roll, elevation, and distance control
 * - Coastal cinematic color grading filters
 * - Stylized postcard stamps & framing
 * - One-click high-res PNG export directly to local disk
 */

import * as THREE from 'three';
import { Vehicle } from '../gameplay/Vehicle';

export type PhotoFilter = 'none' | 'golden_hour' | 'riviera_80s' | 'cyber_coastal' | 'monochrome' | 'vivid_tropical';
export type PostcardStamp = 'none' | 'riviera_gp' | 'coastal_apex' | 'horizon_rush';

export interface PhotoStudioSettings {
  fov: number;             // 25 to 85 deg
  distance: number;        // 3 to 22 meters
  height: number;          // -0.5 to 8 meters
  azimuth: number;         // 0 to 360 deg
  roll: number;            // -30 to +30 deg
  filter: PhotoFilter;
  stamp: PostcardStamp;
  vignette: boolean;
}

export class PhotoStudio {
  public camera: THREE.PerspectiveCamera;
  public settings: PhotoStudioSettings = {
    fov: 50,
    distance: 7.5,
    height: 1.8,
    azimuth: 45,
    roll: 0,
    filter: 'golden_hour',
    stamp: 'riviera_gp',
    vignette: true
  };

  private targetCenter = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1500);
  }

  public activate(targetVehicle: Vehicle): void {
    this.targetCenter.copy(targetVehicle.position);
    this.targetCenter.y += 0.6; // Focus on car chassis
    this.updateCameraTransform();
  }

  public updateCameraTransform(): void {
    const azRad = (this.settings.azimuth * Math.PI) / 180;
    const dist = this.settings.distance;

    const camX = this.targetCenter.x + Math.sin(azRad) * dist;
    const camZ = this.targetCenter.z + Math.cos(azRad) * dist;
    const camY = this.targetCenter.y + this.settings.height;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.targetCenter);

    // Apply roll
    this.camera.rotation.z = (this.settings.roll * Math.PI) / 180;

    // Apply FOV
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Captures the rendered Three.js canvas, composites color grading, vignette,
   * and stylized postcard stamps, and downloads a high-res PNG snapshot.
   */
  public captureAndExportSnapshot(sourceCanvas: HTMLCanvasElement): void {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    // Create high-res compositing canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d')!;

    // 1. Draw source 3D WebGL render
    ctx.drawImage(sourceCanvas, 0, 0);

    // 2. Apply Color Grading Filter
    this.applyColorFilter(ctx, w, h);

    // 3. Apply Vignette
    if (this.settings.vignette) {
      this.applyVignette(ctx, w, h);
    }

    // 4. Draw Postcard Stamp / Frame
    if (this.settings.stamp !== 'none') {
      this.drawPostcardFrame(ctx, w, h);
    }

    // 5. Trigger Native File Download
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `riviera_photo_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  private applyColorFilter(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    switch (this.settings.filter) {
      case 'golden_hour':
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = 'rgba(255, 170, 0, 0.35)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = 'rgba(255, 120, 0, 0.15)';
        ctx.fillRect(0, 0, w, h);
        break;
      case 'riviera_80s':
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(247, 37, 133, 0.2)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(67, 97, 238, 0.25)';
        ctx.fillRect(0, 0, w, h);
        break;
      case 'cyber_coastal':
        ctx.globalCompositeOperation = 'color-dodge';
        ctx.fillStyle = 'rgba(0, 245, 212, 0.2)';
        ctx.fillRect(0, 0, w, h);
        break;
      case 'monochrome':
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(220, 220, 220, 0.2)';
        ctx.fillRect(0, 0, w, h);
        break;
      case 'vivid_tropical':
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(0, 180, 216, 0.25)';
        ctx.fillRect(0, 0, w, h);
        break;
    }
    ctx.restore();
  }

  private applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    const radius = Math.max(w, h) * 0.75;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, radius * 0.4, w / 2, h / 2, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawPostcardFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    // Inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = Math.max(2, Math.floor(w * 0.003));
    const pad = Math.floor(w * 0.03);
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

    // Title badge
    let title = "RIVIERA GRAND PRIX";
    let sub = "CÔTE D'AZUR SPEEDWAY // 2026";

    if (this.settings.stamp === 'coastal_apex') {
      title = "COASTAL SPRINT";
      sub = "TIME TRIAL APEX // CLIFFSIDE HIGHWAY";
    } else if (this.settings.stamp === 'horizon_rush') {
      title = "HORIZON RUSH";
      sub = "COASTAL HILLCLIMB // CHECKPOINT PASS";
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(w * 0.024)}px sans-serif`;
    ctx.fillText(title, pad + 20, h - pad - 35);

    ctx.fillStyle = '#f4a261';
    ctx.font = `600 ${Math.floor(w * 0.013)}px sans-serif`;
    ctx.fillText(sub, pad + 20, h - pad - 15);

    ctx.restore();
  }
}
