// Gameplay constants shared by the game, the AI and the headless tests.
export const PHYS = {
  dt: 1 / 120,
  maxSubSteps: 12,
  // racing-line speed profile (Hard AI == these limits; Normal/Easy scale them in DIFFICULTY)
  line: { aLat: 7.0, aBrake: 7.0, aAccel: 4.2, vTop: 50 },
};

export const GRID = {
  rowStart: 9.0, rowSpacing: 11.5, carOffset: 2.3, laneOffset: 2.9, rows: 3,
};

export const RULES = {
  offRoadReset: 3.0,        // s outside the road before an automatic reset
  stuckReset: 4.5,          // s almost stopped (during the race)
  flipReset: 1.6,           // s upside down
  countdown: 3,             // 3-2-1
  gridPresentation: 5.2,    // s
  checkpointTol: 18,        // m window around a checkpoint
  cutJump: 70,              // m: a jump in track position larger than this is a shortcut
};

export const AI_NAMES = ['Rafael Duarte', 'Inês Barros', 'Luca Marchetti', 'Maya Costa', 'Théo Lambert', 'Sofia Alves', 'Nico Ferreira'];
