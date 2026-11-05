// Two fictional car models (no real brands). Units: SI.
export const CAR_SPECS = {
  gt: {
    id: 'gt', name: 'Ponente GT', kind: 'Cupê GT',
    mass: 1380, length: 4.55, width: 1.94, height: 1.24,
    wheelbase: 2.66, trackF: 1.64, trackR: 1.66, cgHeight: 0.46, frontBias: 0.47,
    wheelRadius: 0.345, rest: 0.34, maxTravel: 0.16, spring: 52000, damper: 4800, antiRoll: 0.55,
    drive: 'rwd', idleRpm: 900, redline: 7700, shiftUp: 7350, shiftDown: 3600,
    torquePeak: 450, torqueRpm: 5300, gears: [3.15, 2.18, 1.62, 1.29, 1.06, 0.88], finalDrive: 4.4, reverse: 3.0,
    cdA: 0.82, clA: 0.95, gripF: 1.22, gripR: 1.26, brake: 10800, steerMax: 0.58,
    engineSound: 'v8',
  },
  hatch: {
    id: 'hatch', name: 'Maestrale R', kind: 'Hatch esportivo',
    mass: 1240, length: 4.15, width: 1.84, height: 1.42,
    wheelbase: 2.58, trackF: 1.56, trackR: 1.55, cgHeight: 0.52, frontBias: 0.58,
    wheelRadius: 0.33, rest: 0.34, maxTravel: 0.16, spring: 48000, damper: 4300, antiRoll: 0.62,
    drive: 'awd', idleRpm: 950, redline: 7200, shiftUp: 6900, shiftDown: 3400,
    torquePeak: 360, torqueRpm: 4600, gears: [3.4, 2.25, 1.68, 1.33, 1.08, 0.9], finalDrive: 4.19, reverse: 3.2,
    cdA: 0.86, clA: 0.6, gripF: 1.2, gripR: 1.2, brake: 10200, steerMax: 0.6,
    engineSound: 'i4',
  },
};

export const LIVERIES = [
  { id: 'rosso', name: 'Vermelho Coral', color: 0xb3121f, accent: 0xf2efe6, number: 7, metal: 0.55 },
  { id: 'blu', name: 'Azul Egeu', color: 0x123f8c, accent: 0xf5c33b, number: 12, metal: 0.6 },
  { id: 'bianco', name: 'Branco Pérola', color: 0xe9e6df, accent: 0x1c1c1c, number: 3, metal: 0.25 },
  { id: 'verde', name: 'Verde Oliva', color: 0x2f4f2a, accent: 0xe8d9b0, number: 21, metal: 0.5 },
  { id: 'arancio', name: 'Laranja Poente', color: 0xd9581a, accent: 0x161616, number: 44, metal: 0.45 },
  { id: 'nero', name: 'Grafite', color: 0x1b1d21, accent: 0xd8262e, number: 9, metal: 0.7 },
];
