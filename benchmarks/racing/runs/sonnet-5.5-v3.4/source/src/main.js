// Entry point: loads the world, boots the game, exposes the test/verification API on window.__RACING__.
import * as THREE from 'three';
import { createScene } from './game/scene.js';
import { Game } from './game/game.js';
import { installApi } from './game/api.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const setLoad = (p, msg) => { $('loadfill').style.width = (Math.min(1, p) * 100).toFixed(0) + '%'; if (msg) $('loadmsg').textContent = msg; };

window.__RACING__ = { ready: false, THREE, errors: [] };
window.addEventListener('error', (e) => window.__RACING__.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__RACING__.errors.push(String(e.reason && e.reason.message || e.reason)));

try {
  const t0 = performance.now();
  const S = await createScene({ canvas: $('game'), params, onProgress: (p, m) => setLoad(p * 0.9, m) });
  setLoad(0.92, 'Montando o jogo');
  const game = new Game(S, $('ui'), params);
  await game.init();
  addEventListener('resize', () => {
    const { renderer, camera, post, state, lighting } = S;
    renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    const w = Math.floor(innerWidth * state.dpr * state.quality.scale), h = Math.floor(innerHeight * state.dpr * state.quality.scale);
    renderer.setPixelRatio(state.dpr * state.quality.scale); post.setSize(w, h); lighting.resize();
  });
  installApi(window.__RACING__, game, S);
  setLoad(1, 'Pronto');
  game.start();
  window.__RACING__.loadMs = Math.round(performance.now() - t0);
  $('loading').style.display = 'none';
  window.__RACING__.ready = true;
  if (params.get('auto') === '1') window.__RACING__.autoStart({ car: params.get('car') || 'gt', laps: +(params.get('laps') || 3), skip: params.get('skip') !== '0' });
} catch (e) {
  console.error(e);
  $('loadmsg').textContent = 'Erro: ' + (e && e.message || e);
  window.__RACING__.errors.push(String(e && e.stack || e));
}
