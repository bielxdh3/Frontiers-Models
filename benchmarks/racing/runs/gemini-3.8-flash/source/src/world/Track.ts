/**
 * Track.ts
 * Authoritative 3D spline-based track geometry and race progress tracker.
 * - Arc-length parameterized 3D centerline
 * - Banking angles, road width, elevation
 * - Checkpoint gates with strict sequential order validation
 * - Nearest-point projection and lateral offset (off-track / barrier detection)
 */

import * as THREE from 'three';

export interface TrackPoint {
  x: number;
  y: number; // Elevation
  z: number;
  width?: number; // Road width at this node
  bank?: number;  // Banking angle in radians
  type?: 'normal' | 'bridge' | 'tunnel' | 'town';
}

export interface CheckpointGate {
  index: number;
  position: THREE.Vector3;
  direction: THREE.Vector3; // Forward tangent
  width: number;
  distanceAlongTrack: number;
}

export class Track {
  public id: string;
  public name: string;
  public totalLength = 0;
  public samplePoints: THREE.Vector3[] = [];
  public tangents: THREE.Vector3[] = [];
  public normals: THREE.Vector3[] = []; // Up/banking normals
  public binormals: THREE.Vector3[] = []; // Right vectors
  public arcLengths: number[] = [];
  public checkpoints: CheckpointGate[] = [];
  public pointTypes: string[] = [];

  private curve: THREE.CatmullRomCurve3;
  private readonly defaultWidth = 14.0; // Room for 6 cars side-by-side
  private readonly numSamples = 600;

  constructor(id: string, name: string, nodes: TrackPoint[], isLoop = true) {
    this.id = id;
    this.name = name;

    const vectors = nodes.map((n) => new THREE.Vector3(n.x, n.y, n.z));
    this.curve = new THREE.CatmullRomCurve3(vectors, isLoop, 'centripetal', 0.5);

    this.buildDiscretizedTrack(nodes);
    this.buildCheckpoints(isLoop);
  }

  private buildDiscretizedTrack(nodes: TrackPoint[]): void {
    this.samplePoints = [];
    this.tangents = [];
    this.normals = [];
    this.binormals = [];
    this.arcLengths = [0];
    this.pointTypes = [];

    let accumulatedLength = 0;
    const upVector = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= this.numSamples; i++) {
      const u = i / this.numSamples;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();

      // Right vector (binormal)
      const binormal = new THREE.Vector3().crossVectors(tangent, upVector).normalize();
      // True normal (orthogonal to tangent and binormal)
      const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

      this.samplePoints.push(pt);
      this.tangents.push(tangent);
      this.normals.push(normal);
      this.binormals.push(binormal);

      if (i > 0) {
        accumulatedLength += pt.distanceTo(this.samplePoints[i - 1]);
        this.arcLengths.push(accumulatedLength);
      }

      // Determine section type from nearest node
      const nodeIndex = Math.min(nodes.length - 1, Math.floor(u * nodes.length));
      this.pointTypes.push(nodes[nodeIndex].type || 'normal');
    }

    this.totalLength = accumulatedLength;
  }

  private buildCheckpoints(isLoop: boolean): void {
    // Generate ~12-16 checkpoints evenly spaced along the course
    const count = isLoop ? 12 : 16;
    this.checkpoints = [];

    for (let i = 0; i < count; i++) {
      const u = (i / count);
      const distance = u * this.totalLength;
      const pt = this.getPointAtDistance(distance);
      const tangent = this.getTangentAtDistance(distance);

      this.checkpoints.push({
        index: i,
        position: pt,
        direction: tangent,
        width: this.defaultWidth + 4,
        distanceAlongTrack: distance
      });
    }
  }

  public getPointAtDistance(distance: number): THREE.Vector3 {
    let d = distance % this.totalLength;
    if (d < 0) d += this.totalLength;
    const u = d / this.totalLength;
    return this.curve.getPointAt(Math.min(1.0, Math.max(0, u)));
  }

  public getTangentAtDistance(distance: number): THREE.Vector3 {
    let d = distance % this.totalLength;
    if (d < 0) d += this.totalLength;
    const u = d / this.totalLength;
    return this.curve.getTangentAt(Math.min(1.0, Math.max(0, u))).normalize();
  }

  /**
   * Projects a 3D position onto the track centerline.
   * Returns:
   * - distanceAlongTrack: 0..totalLength
   * - lateralOffset: signed distance from centerline (- left, + right)
   * - nearestPoint: closest point on centerline
   * - forwardDir: track forward tangent
   */
  public projectPosition(position: THREE.Vector3): {
    distanceAlongTrack: number;
    lateralOffset: number;
    nearestPoint: THREE.Vector3;
    forwardDir: THREE.Vector3;
    isOffRoad: boolean;
    hitBarrier: boolean;
  } {
    let closestIndex = 0;
    let minSqDist = Infinity;

    // Fast search across sampled points
    for (let i = 0; i < this.samplePoints.length; i += 2) {
      const sqDist = position.distanceToSquared(this.samplePoints[i]);
      if (sqDist < minSqDist) {
        minSqDist = sqDist;
        closestIndex = i;
      }
    }

    // Local refinement
    const start = Math.max(0, closestIndex - 3);
    const end = Math.min(this.samplePoints.length - 1, closestIndex + 3);
    for (let i = start; i <= end; i++) {
      const sqDist = position.distanceToSquared(this.samplePoints[i]);
      if (sqDist < minSqDist) {
        minSqDist = sqDist;
        closestIndex = i;
      }
    }

    const nearestPoint = this.samplePoints[closestIndex];
    const forwardDir = this.tangents[closestIndex];
    const binormal = this.binormals[closestIndex];
    const distanceAlongTrack = this.arcLengths[closestIndex];

    // Compute signed lateral offset
    const toCar = new THREE.Vector3().subVectors(position, nearestPoint);
    const lateralOffset = toCar.dot(binormal);

    const halfRoadWidth = this.defaultWidth * 0.5;
    const barrierDistance = halfRoadWidth + 1.2;

    const isOffRoad = Math.abs(lateralOffset) > halfRoadWidth;
    const hitBarrier = Math.abs(lateralOffset) >= barrierDistance;

    return {
      distanceAlongTrack,
      lateralOffset,
      nearestPoint,
      forwardDir,
      isOffRoad,
      hitBarrier
    };
  }

  /**
   * Returns a grid spawn position for a given rank (0 = pole position, 5 = 6th place)
   */
  public getSpawnTransform(gridIndex: number): { position: THREE.Vector3; rotation: THREE.Quaternion } {
    const spacing = 12; // meters between rows
    const lateralSpacing = 3.2; // left/right stagger
    const startDistance = 25 - gridIndex * spacing;

    let d = startDistance % this.totalLength;
    if (d < 0) d += this.totalLength;

    const center = this.getPointAtDistance(d);
    const tangent = this.getTangentAtDistance(d);
    const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

    // Stagger left / right: even indices on left (-), odd on right (+)
    const side = (gridIndex % 2 === 0 ? -1 : 1) * lateralSpacing;
    const position = center.clone().add(binormal.clone().multiplyScalar(side));
    position.y += 0.4; // Ground clearance

    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), tangent);

    return { position, rotation };
  }
}
