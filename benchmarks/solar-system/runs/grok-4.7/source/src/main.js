import './styles.css';
import { createWorld } from './world.js';
import { mount } from './ui.js';
import { state } from './state.js';
import { applyBundle, loadLocal } from './persist.js';

const app = document.querySelector('#app');
const loaded = loadLocal();
if (loaded.ok) applyBundle(loaded.data, { merge: false });
else if (loaded.reason === 'malformed') state.storageNote = 'malformed';
else if (loaded.reason === 'unavailable') state.storageNote = 'unavailable';

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && loaded.reason === 'empty') {
  state.prefs.reducedMotion = true;
}
if (window.innerWidth < 900) state.navigatorOpen = false;

app.innerHTML = '<canvas id="scene" aria-label="Cena tridimensional do Sistema Solar"></canvas><div id="labels"></div><div id="ui"></div>';
const canvas = app.querySelector('#scene');
const hooks = {};
let world = null;
try {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('webgl');
  world = createWorld(canvas, hooks);
  state.webglOk = true;
} catch {
  state.webglOk = false;
}

const ui = mount(app.querySelector('#ui'), world, hooks);
hooks.onSelect = (id, extras) => ui.onSelect(id, extras);
hooks.onFocus = (id) => ui.onFocus(id);
hooks.onCameraGrab = () => ui.onCameraGrab();
hooks.onFramed = () => ui.announce(state.lang === 'en' ? 'Framing complete.' : 'Enquadramento concluído.');
hooks.onContext = (kind) => ui.announce(kind === 'lost'
  ? (state.lang === 'en' ? 'Graphics context lost.' : 'Contexto gráfico perdido.')
  : (state.lang === 'en' ? 'Graphics context restored.' : 'Contexto gráfico restaurado.'));

ui.start();
