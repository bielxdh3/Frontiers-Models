/**
 * TrackConfigs.ts
 * Authored node definitions for the three dedicated courses:
 * 1. coastal_sprint (Time Trial)
 * 2. riviera_gp (Race vs AI)
 * 3. horizon_rush (Checkpoint Run)
 */

import { TrackPoint } from './Track';

// Course 1: Coastal Sprint (Time Trial)
// Flowing coastal highway, sweeping seaside curves, cliffside braking zones.
export const COASTAL_SPRINT_NODES: TrackPoint[] = [
  { x: 0, y: 1.0, z: 0, type: 'normal' },
  { x: 120, y: 2.0, z: -80, type: 'normal' },
  { x: 280, y: 4.5, z: -140, type: 'normal' },
  { x: 440, y: 8.0, z: -110, type: 'normal' },
  { x: 580, y: 12.0, z: 20, type: 'normal' },
  { x: 640, y: 14.5, z: 180, type: 'normal' },
  { x: 560, y: 11.0, z: 340, type: 'normal' },
  { x: 410, y: 7.0, z: 460, type: 'normal' },
  { x: 220, y: 4.0, z: 490, type: 'bridge' },
  { x: 60, y: 3.0, z: 430, type: 'bridge' },
  { x: -100, y: 2.0, z: 310, type: 'normal' },
  { x: -200, y: 1.5, z: 160, type: 'normal' },
  { x: -150, y: 1.0, z: 40, type: 'normal' }
];

// Course 2: Riviera Grand Prix (Race vs AI)
// Wider course, coastal tourist village, stone bridge across bay, illuminated tunnel, harbor promenade.
export const RIVIERA_GP_NODES: TrackPoint[] = [
  { x: 0, y: 1.0, z: 0, type: 'town' },
  { x: 150, y: 1.5, z: -20, type: 'town' },
  { x: 300, y: 2.5, z: -80, type: 'town' },
  { x: 450, y: 5.0, z: -190, type: 'normal' },
  { x: 520, y: 8.0, z: -340, type: 'normal' },
  { x: 440, y: 11.0, z: -480, type: 'tunnel' },
  { x: 290, y: 13.0, z: -570, type: 'tunnel' },
  { x: 120, y: 11.5, z: -550, type: 'tunnel' },
  { x: -40, y: 9.0, z: -460, type: 'normal' },
  { x: -180, y: 6.5, z: -320, type: 'bridge' },
  { x: -290, y: 5.0, z: -170, type: 'bridge' },
  { x: -350, y: 3.5, z: 10, type: 'normal' },
  { x: -320, y: 2.0, z: 180, type: 'town' },
  { x: -200, y: 1.5, z: 260, type: 'town' },
  { x: -70, y: 1.0, z: 180, type: 'town' }
];

// Course 3: Horizon Rush (Checkpoint Run)
// Mountain & coastal hill-climb pass, checkpoints placed with urgency, elevation climb, grand vista.
export const HORIZON_RUSH_NODES: TrackPoint[] = [
  { x: 0, y: 1.0, z: 0, type: 'normal' },
  { x: 140, y: 5.0, z: -110, type: 'normal' },
  { x: 260, y: 11.0, z: -220, type: 'normal' },
  { x: 320, y: 18.0, z: -360, type: 'tunnel' },
  { x: 260, y: 25.0, z: -490, type: 'tunnel' },
  { x: 120, y: 32.0, z: -560, type: 'normal' },
  { x: -50, y: 36.0, z: -540, type: 'normal' },
  { x: -200, y: 38.0, z: -440, type: 'bridge' },
  { x: -310, y: 35.0, z: -300, type: 'bridge' },
  { x: -380, y: 29.0, z: -140, type: 'normal' },
  { x: -360, y: 20.0, z: 40, type: 'normal' },
  { x: -260, y: 12.0, z: 180, type: 'normal' },
  { x: -130, y: 5.0, z: 150, type: 'normal' }
];

export interface TrackMetadata {
  id: string;
  name: string;
  modeRecommended: 'time_trial' | 'race' | 'checkpoint';
  description: string;
  lengthMeters: number;
  lapsDefault: number;
  checkpointsCount: number;
  environmentFeatures: string[];
}

export const TRACK_METADATA: Record<string, TrackMetadata> = {
  coastal_sprint: {
    id: 'coastal_sprint',
    name: 'Coastal Sprint',
    modeRecommended: 'time_trial',
    description: 'A flowing, high-speed coastal highway along sheer cliffs and azure waters, engineered for clean racing lines and precision braking.',
    lengthMeters: 1780,
    lapsDefault: 3,
    checkpointsCount: 12,
    environmentFeatures: ['Cliffs', 'Ocean Views', 'Seaside Bridge']
  },
  riviera_gp: {
    id: 'riviera_gp',
    name: 'Riviera Grand Prix',
    modeRecommended: 'race',
    description: 'A glamorous seaside circuit weaving through a pastel tourist village, crossing an arched stone bay bridge, and plunging through a dynamic illuminated cliffside tunnel.',
    lengthMeters: 2350,
    lapsDefault: 3,
    checkpointsCount: 14,
    environmentFeatures: ['Village Streets', 'Stone Bay Bridge', 'Illuminated Tunnel', 'Harbor Promenade']
  },
  horizon_rush: {
    id: 'horizon_rush',
    name: 'Horizon Rush',
    modeRecommended: 'checkpoint',
    description: 'An exhilarating hill-climb pass carved into the coastal ridge with dramatic elevation climbs, mountain tunnels, and breathtaking vistas.',
    lengthMeters: 2120,
    lapsDefault: 3,
    checkpointsCount: 14,
    environmentFeatures: ['Hill Climb', 'Ridge Bridge', 'Mountain Tunnel', 'Horizon Arch']
  }
};
