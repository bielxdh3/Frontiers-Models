// src/main.js
// Entry point for Costa Dorada Coastal Grand Prix

import { GameApp } from './game/GameApp.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas');
  const app = new GameApp(canvas);

  // Expose global instance for headless automation and verification tests
  window.gameApp = app;

  console.log('[Main] Loading track data and generating world...');
  await app.loadTrackAndWorld();
  window.isReady = true;
  console.log('[Main] World loaded and ready!');
});
