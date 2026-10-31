/**
 * CarConfigs.ts
 * Defines the three differentiated playable cars and their performance envelopes.
 */

export interface CarConfig {
  id: string;
  name: string;
  subtitle: string;
  category: 'agile' | 'balanced' | 'speed';
  description: string;

  // Visual styling
  bodyColor: number;
  accentColor: number;
  interiorColor: number;
  glassColor: number;
  chassisLength: number;
  chassisWidth: number;
  chassisHeight: number;
  wheelRadius: number;

  // Physics & handling specs
  mass: number;             // kg (e.g. 1100 to 1500)
  maxSpeedKmh: number;      // base top speed km/h (e.g. 195 to 230)
  nitroMaxSpeedKmh: number; // top speed with nitro active
  accelForce: number;       // forward drive acceleration
  brakeForce: number;       // braking deceleration
  reverseSpeedKmh: number;  // reverse top speed
  steerSpeed: number;       // rad/s steering response
  maxSteerAngle: number;    // radians
  baseGrip: number;         // lateral cornering grip coefficient
  driftGrip: number;        // lateral grip when sliding
  driftControl: number;     // counter-steering responsiveness
  nitroThrust: number;      // nitro acceleration multiplier
  nitroRechargeRate: number;// points per second
  nitroCapacity: number;    // max tank (usually 100)
}

export const CAR_CONFIGS: Record<string, CarConfig> = {
  riviera_spyder: {
    id: 'riviera_spyder',
    name: 'Riviera Spyder',
    subtitle: 'Agile Roadster / Drift Specialist',
    category: 'agile',
    description: 'Ultra-lightweight open-top roadster tuned for razor-sharp turn-in, rapid drift transitions, and quick nitro replenishment.',
    bodyColor: 0xe63946,     // Vibrant Crimson Red
    accentColor: 0x1d3557,   // Deep Nautical Navy
    interiorColor: 0x2b2d42, // Charcoal Leather
    glassColor: 0xa8dadc,    // Tinted Cyan
    chassisLength: 4.1,
    chassisWidth: 1.85,
    chassisHeight: 1.15,
    wheelRadius: 0.36,

    mass: 1120,
    maxSpeedKmh: 198,
    nitroMaxSpeedKmh: 232,
    accelForce: 13.5,
    brakeForce: 22.0,
    reverseSpeedKmh: 45,
    steerSpeed: 4.2,
    maxSteerAngle: 0.58,
    baseGrip: 4.8,
    driftGrip: 2.4,
    driftControl: 1.35,
    nitroThrust: 14.0,
    nitroRechargeRate: 6.5,
    nitroCapacity: 100
  },

  corsica_gt: {
    id: 'corsica_gt',
    name: 'Corsica GT',
    subtitle: 'Balanced Grand Tourer',
    category: 'balanced',
    description: 'Aerodynamic grand touring coupe with balanced weight distribution, high cornering stability, and predictable high-speed grip.',
    bodyColor: 0x0077b6,     // Mediterranean Azure Blue
    accentColor: 0xf4a261,   // Sunset Amber
    interiorColor: 0x1f2421, // Slate Grey
    glassColor: 0x90e0ef,    // Crisp Sky Tint
    chassisLength: 4.45,
    chassisWidth: 1.92,
    chassisHeight: 1.22,
    wheelRadius: 0.38,

    mass: 1360,
    maxSpeedKmh: 215,
    nitroMaxSpeedKmh: 248,
    accelForce: 14.8,
    brakeForce: 20.0,
    reverseSpeedKmh: 50,
    steerSpeed: 3.6,
    maxSteerAngle: 0.50,
    baseGrip: 5.2,
    driftGrip: 2.1,
    driftControl: 1.15,
    nitroThrust: 16.5,
    nitroRechargeRate: 5.0,
    nitroCapacity: 100
  },

  monaco_hyperion: {
    id: 'monaco_hyperion',
    name: 'Monaco Hyperion',
    subtitle: 'Speed Champion / Hypercar',
    category: 'speed',
    description: 'Extreme mid-engine hypercar engineered for blistering straightaway velocity and monstrous nitro acceleration.',
    bodyColor: 0xfb8500,     // Electric Solar Orange
    accentColor: 0x023047,   // Carbon Onyx
    interiorColor: 0x111111, // Pure Carbon
    glassColor: 0x8ecae6,    // High-clarity Sapphire
    chassisLength: 4.65,
    chassisWidth: 2.02,
    chassisHeight: 1.10,
    wheelRadius: 0.40,

    mass: 1480,
    maxSpeedKmh: 236,
    nitroMaxSpeedKmh: 275,
    accelForce: 16.2,
    brakeForce: 19.0,
    reverseSpeedKmh: 55,
    steerSpeed: 3.2,
    maxSteerAngle: 0.45,
    baseGrip: 5.4,
    driftGrip: 1.8,
    driftControl: 0.95,
    nitroThrust: 20.0,
    nitroRechargeRate: 4.2,
    nitroCapacity: 100
  }
};
