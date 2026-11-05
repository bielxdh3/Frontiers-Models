import { Game } from './game.js';

const loadFill = document.getElementById('loadFill');
const loadText = document.getElementById('loadText');
function progress(label, f) { loadFill.style.width = `${Math.round(f * 100)}%`; loadText.textContent = label; }

const game = new Game(document.getElementById('gl'), document.getElementById('hud'), document.getElementById('ui'));
window.__game = game;
game.init(progress).then(() => {
  document.getElementById('loading').classList.add('done');
}).catch((e) => {
  console.error(e);
  loadText.textContent = 'Erro: ' + e.message;
  window.__gameError = String(e && e.stack || e);
});
