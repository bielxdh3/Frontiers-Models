// Two cars with clearly different character. Units: SI. Body frame: x right, y up, z BACK (forward = -z). Origin = centre of mass.
export const CAR_SPECS = {
  gt: {
    id: 'gt', name: 'Veloce GT', blurb: 'Coupé GT baixo, tração traseira, V8 de timbre grave.',
    mass: 1380, length: 4.55, width: 1.92, height: 1.28,
    wheelbase: 2.74, trackF: 1.64, trackR: 1.66, cgH: 0.46, frontWeight: 0.47,
    wheelR: 0.345, wheelI: 1.7,
    susp: { kF: 62000, kR: 66000, cF: 4300, cR: 4600, arbF: 26000, arbR: 18000, rest: 0.30, maxComp: 0.15, droop: 0.11 },
    engine: {
      idle: 900, redline: 7400, limiter: 7550,
      torque: [[0, 96], [900, 172], [2000, 276], [3500, 352], [5000, 392], [6200, 404], [7000, 364], [7600, 304]],
      inertia: 0.22,
    },
    gears: [3.55, 2.44, 1.82, 1.44, 1.17, 0.98], fd: 4.20, drivetrainEff: 0.9,
    drive: 'RWD', awdFront: 0.0, brakeTorque: 2300, brakeBias: 0.60,
    maxSteer: 0.54, steerRate: 2.6,
    cdA: 0.68, clA: 0.62, downFront: 0.42,
    tire: { mu: 1.22, peakK: 0.13, peakA: 0.16, loss: 0.20 },
    engineSound: 'v8',
  },
  hatch: {
    id: 'hatch', name: 'Pulse RS', blurb: 'Hatch esportivo compacto, tração integral, turbo agudo.',
    mass: 1240, length: 4.00, width: 1.84, height: 1.43,
    wheelbase: 2.52, trackF: 1.58, trackR: 1.58, cgH: 0.50, frontWeight: 0.58,
    wheelR: 0.325, wheelI: 1.35,
    susp: { kF: 54000, kR: 50000, cF: 3900, cR: 3600, arbF: 22000, arbR: 14000, rest: 0.28, maxComp: 0.14, droop: 0.11 },
    engine: {
      idle: 1000, redline: 7000, limiter: 7150,
      torque: [[0, 112], [1000, 184], [2000, 280], [3000, 336], [4500, 352], [5500, 344], [6500, 304], [7200, 256]],
      inertia: 0.16,
    },
    gears: [3.62, 2.28, 1.66, 1.30, 1.06, 0.89], fd: 4.35, drivetrainEff: 0.88,
    drive: 'AWD', awdFront: 0.38, brakeTorque: 2000, brakeBias: 0.64,
    maxSteer: 0.58, steerRate: 3.0,
    cdA: 0.74, clA: 0.38, downFront: 0.50,
    tire: { mu: 1.24, peakK: 0.12, peakA: 0.15, loss: 0.16 },
    engineSound: 'turbo',
  },
};

export const CAR_LIST = ['gt', 'hatch'];

// six livery colours / numbers on the grid
export const LIVERIES = [
  { name: 'Laranja Sol', paint: '#f2641a', accent: '#1a1a1a', number: 7 },
  { name: 'Azul Atlântico', paint: '#1f5fd6', accent: '#f2f2f2', number: 11 },
  { name: 'Branco Pérola', paint: '#ecebe6', accent: '#c4182d', number: 23 },
  { name: 'Verde Oliva', paint: '#3f7a46', accent: '#f4d03f', number: 34 },
  { name: 'Vermelho Rubi', paint: '#c1121f', accent: '#f2f2f2', number: 48 },
  { name: 'Amarelo Mel', paint: '#f2c230', accent: '#202020', number: 69 },
];
