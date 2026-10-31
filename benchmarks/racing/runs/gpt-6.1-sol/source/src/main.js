import './style.css';
import { ACTION_LABELS, CARS, COURSES, DAYLIGHT, DEFAULT_BINDINGS, DEFAULT_PREFS, DIFFICULTIES, WEATHER, bindingProblem } from './catalog.js';
import { clamp, makeTrack, timeLabel } from './math.js';
import { Simulation, STEP, createCar, environmentAt, standings } from './sim.js';
import { MAX_REPLAY_BYTES, parseReplay, sampleReplay } from './replay.js';
import { ReplayLibrary, loadPreferences, readRecords, savePreferences, writeRecord } from './storage.js';
import { GameRenderer } from './render.js';
import { Soundscape } from './audio.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name, size = 20) => {
  const paths = { arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>', back: '<path d="M20 12H4m6-6-6 6 6 6"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>', gear: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>', play: '<path d="m8 4 12 8-12 8Z"/>', pause: '<path d="M8 5v14M16 5v14"/>', photo: '<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>', library: '<path d="M4 4h16v16H4ZM4 9h16m-10 0v11"/>', flag: '<path d="M5 22V3q4-3 8 0t7 0v10q-4 3-7 0t-8 0"/>', volume: '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8q5 4 0 8m3-11q8 7 0 14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>', cloud: '<path d="M6 18a5 5 0 0 1 0-10 6 6 0 0 1 11-1 5.5 5.5 0 1 1 1 11Z"/>', rain: '<path d="M5 14a4 4 0 0 1 1-8 5 5 0 0 1 9-1 5 5 0 0 1 3 9M8 17l-2 4m8-4-2 4m8-4-2 4"/>', car: '<path d="m3 12 3-7h12l3 7v7H3ZM3 12h18M6 16h2m8 0h2M6 19v2m12-2v2"/>' };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};
const app = {
  screen: 'menu', setup: { course: 'coastal', car: 'tern', weather: 0, daylight: 1, difficulty: 1 },
  source: 'local', namespace: 'solstice.v1', held: new Set(), sim: null, menuTime: 0, accumulator: 0,
  lastReplay: null, dirty: false, playback: null, bindingAction: null, dialogOpen: false,
  photo: { photoAngle: .7, photoDistance: 9, photoHeight: 3.5, treatment: 'sand', caption: 'The long way home.' },
  audio: new Soundscape(), layoutLabels: new Map(), eventCursor: 0, uiClock: 0, generation: 0
};
const harnessEnabled = import.meta.env.DEV && new URLSearchParams(location.search).get('harness') === '1';
if (harnessEnabled) {
  const requested = new URLSearchParams(location.search).get('testcase') || 'acceptance';
  app.source = 'harness'; app.namespace = `solstice.test.${/^[a-z0-9-]{1,40}$/.test(requested) ? requested : 'acceptance'}`;
}
let kv;
try { kv = localStorage; } catch { kv = { getItem: () => null, setItem: () => { throw new Error('Storage denied'); }, removeItem: () => {} }; }
app.prefs = loadPreferences(kv, app.namespace); app.prefs.reducedMotion ||= matchMedia('(prefers-reduced-motion: reduce)').matches;
app.library = new ReplayLibrary({ kv, namespace: app.namespace });
app.library.init().then(() => { if (app.screen === 'library') showLibrary(); });
const tracks = new Map(COURSES.map(c => [c.id, makeTrack(c)]));
function course() { return COURSES.find(c => c.id === app.setup.course); }
function model() { return CARS.find(c => c.id === app.setup.car); }
function displayState() {
  if (app.screen === 'replay' || app.screen === 'photo' && app.photoBack === 'replay') {
    const s = sampleReplay(app.playback.data, app.playback.time); return { ...s, track: tracks.get(app.playback.data.setup.course) };
  }
  if (app.sim && ['race', 'pause', 'results', 'settings-race', 'photo'].includes(app.screen)) return { ...app.sim, track: app.sim.track };
  const track = tracks.get(app.setup.course);
  return { track, time: app.menuTime, cars: [createCar(track, app.setup.car, 0, 'You', track.length * .045, 0)], env: environmentAt(0, 0, 0) };
}
function notify(message, error = false) { const toast = $('#toast'); toast.textContent = message; toast.className = `visible${error ? ' error' : ''}`; clearTimeout(app.toastTimer); app.toastTimer = setTimeout(() => { toast.className = ''; }, 4700); }
function clearInput() { app.held.clear(); app.accumulator = 0; app.audio.silence(); }
function focusGame() { requestAnimationFrame(() => $('#world').focus({ preventScroll: true })); }
function keyLabel(code) { return app.layoutLabels.get(code) || ({ Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' })[code] || code.replace(/^Key|^Digit/, ''); }
function persistPrefs() { if (!savePreferences(kv, app.prefs, app.namespace)) notify('Settings applied for this visit. Browser storage is unavailable.', true); }
function nav() { return `<header class="site-header"><button class="wordmark" data-action="home" aria-label="Solstice home"><span class="sun-mark small"></span><span>SOLSTICE<small>COAST CLUB</small></span></button><nav aria-label="Main navigation"><button data-action="garage" class="nav-link ${app.screen === 'garage' ? 'active' : ''}">${icon('car')}<span>Garage</span></button><button data-action="library" class="nav-link ${app.screen === 'library' ? 'active' : ''}">${icon('library')}<span>Replays</span></button><button data-action="settings" class="nav-link ${app.screen.startsWith('settings') ? 'active' : ''}" aria-label="Settings">${icon('gear')}</button><button data-action="sound" class="nav-link" aria-label="${app.prefs.muted ? 'Unmute' : 'Mute'} sound">${icon('volume')}<span class="sound-state">${app.prefs.muted ? 'OFF' : 'ON'}</span></button></nav></header>`; }
function routeMap(track, cls = '') {
  const xs = track.samples.map(p => p.x), zs = track.samples.map(p => p.z), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs), scale = Math.min(155 / (maxX - minX), 76 / (maxZ - minZ));
  const path = track.samples.filter((_, i) => i % 8 === 0).map((p, i) => `${i ? 'L' : 'M'}${(20 + (p.x - minX) * scale).toFixed(1)},${(12 + (p.z - minZ) * scale).toFixed(1)}`).join('') + 'Z';
  return `<svg class="route-map ${cls}" viewBox="0 0 190 100" aria-label="${track.name} course map"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${20 + (track.samples[0].x - minX) * scale}" cy="${12 + (track.samples[0].z - minZ) * scale}" r="4" fill="currentColor"/></svg>`;
}
function setScreen(screen) { clearInput(); app.screen = screen; app.bindingAction = null; app.generation++; app.renderer.snap = true; renderUI(); }
function renderUI() {
  const root = $('#app'), c = course(), m = model();
  root.className = app.screen;
  if (app.screen === 'menu') {
    root.innerHTML = `${nav()}<main class="home-copy"><div class="eyebrow"><span class="live-dot"></span>THE COAST IS CALLING</div><h1>Take the<br><em>long way.</em></h1><p>Salt in the air. Sun on the asphalt.<br>Three roads to make your summer.</p><button class="primary big" data-action="setup">Let’s drive ${icon('arrow', 23)}</button><div class="key-hint"><span>${icon('sun', 15)} An endless summer, entirely yours.</span></div></main><aside class="car-caption"><span class="eyebrow">YOUR NEXT ESCAPE</span><strong>${m.name}</strong><span>${m.class} <span class="dot-sep">/</span> ${Math.round(m.top * 3.6)} km/h</span><button data-action="garage">Meet the collection ${icon('arrow', 16)}</button></aside><section class="route-grid" aria-label="Choose your road">${COURSES.map((r, i) => `<button class="route-card ${r.id === c.id ? 'selected' : ''}" data-action="course" data-value="${r.id}"><div class="route-meta"><span class="route-number">0${i + 1}</span><span>${r.label}</span>${icon('arrow', 18)}</div><div class="route-bottom"><div><h2>${r.name}</h2><p>${r.subtitle}</p></div>${routeMap(tracks.get(r.id))}</div></button>`).join('')}</section><footer class="home-footer"><span>THREE ROADS. ONE ENDLESS SUMMER.</span><span>ORIGINAL COASTAL ARCADE RACING <span class="dot-sep">/</span> LOCAL PLAY</span></footer>`;
  } else if (app.screen === 'setup') {
    root.innerHTML = `${nav()}<main class="side-panel setup-panel"><button class="text-button" data-action="home">${icon('back', 16)} Back to the coast</button><span class="eyebrow">${c.badge} / ${c.label.toUpperCase()}</span><h1>${c.name}</h1><p>${c.description}</p><div class="course-strip">${routeMap(tracks.get(c.id))}<div><strong>${(tracks.get(c.id).length / 1000).toFixed(2)} km</strong><span>${c.mode === 'rush' ? '16 ordered gates' : '3 complete laps'}</span></div></div><button class="selected-car" data-action="garage">${icon('car', 26)}<span><small>YOUR CAR</small><strong>${m.name}</strong></span><span>Change ${icon('arrow', 15)}</span></button><label class="field-label" for="weather">Starting weather</label><select id="weather" data-setup="weather">${WEATHER.map((v, i) => `<option value="${i}" ${i === app.setup.weather ? 'selected' : ''}>${v}</option>`).join('')}</select><label class="field-label" for="daylight">Starting light</label><select id="daylight" data-setup="daylight">${DAYLIGHT.map((v, i) => `<option value="${i}" ${i === app.setup.daylight ? 'selected' : ''}>${v}</option>`).join('')}</select>${c.mode === 'race' ? `<label class="field-label" for="difficulty">Rival difficulty</label><select id="difficulty" data-setup="difficulty">${DIFFICULTIES.map((v, i) => `<option value="${i}" ${i === app.setup.difficulty ? 'selected' : ''}>${v}</option>`).join('')}</select><p class="fine">Fixed racing skill. No catch-up boosts. The race closes when you finish; unfinished rivals keep their real progress.</p>` : '<p class="fine">Weather and daylight evolve while you drive. Recovery rewinds to your last gate and invalidates that lap.</p>'}<button class="primary big full" data-action="start">Start ${c.label.toLowerCase()} ${icon('flag')}</button><div class="control-brief"><kbd>${keyLabel(app.prefs.bindings.throttle)}</kbd> accelerate <kbd>${keyLabel(app.prefs.bindings.left)}</kbd><kbd>${keyLabel(app.prefs.bindings.right)}</kbd> steer <kbd>${keyLabel(app.prefs.bindings.pause)}</kbd> pause</div></main><div class="location-note"><span>01° &nbsp; THE SOLSTICE COAST</span><strong>A change of pace.</strong></div>`;
  } else if (app.screen === 'garage') {
    root.innerHTML = `${nav()}<main class="side-panel garage-panel"><button class="text-button" data-action="garage-back">${icon('back', 16)} Back to ${app.garageBack === 'setup' ? 'race setup' : 'the coast'}</button><span class="eyebrow">THE COLLECTION / ${m.number} OF 03</span><h1>${m.name}</h1><div class="tag">${m.class}</div><p>${m.description}</p><div class="stats">${['Top speed', 'Acceleration', 'Agility'].map((s, i) => `<div><span>${s}</span><div class="stat-track"><i style="width:${m.stats[i]}%"></i></div></div>`).join('')}</div><div class="car-choices">${CARS.map(car => `<button data-action="car" data-value="${car.id}" class="car-choice ${car.id === m.id ? 'selected' : ''}"><i style="background:${car.color}"></i><span>${car.name}</span>${car.id === m.id ? '<span class="check">✓</span>' : ''}</button>`).join('')}</div><button class="primary full" data-action="garage-back">Take the ${m.name} ${icon('arrow')}</button><button class="text-button studio-link" data-action="photo">${icon('photo', 18)} Make a coast postcard</button></main><div class="garage-label"><span>CRAFTED FOR THE COAST</span><strong>${m.number}</strong><span>ORIGINAL SERIES / ${m.design.toUpperCase()}</span></div>`;
  } else if (app.screen === 'race') {
    root.innerHTML = `<div class="race-top"><div class="race-title"><span class="eyebrow">${app.sim.track.label.toUpperCase()}</span><strong>${app.sim.track.name}</strong></div><div class="race-actions"><button class="icon-button" data-action="photo" aria-label="Open Postcard studio">${icon('photo')}</button><button class="icon-button" data-action="pause" aria-label="Pause race">${icon('pause')}</button></div></div><div id="mode-hud" class="mode-hud"></div><div id="countdown" role="status"></div><div id="race-message" role="status"></div><div class="race-bottom"><div class="map-wrap"><canvas id="minimap" width="400" height="280" aria-label="Course and car positions"></canvas><div id="weather-hud"></div></div><div class="speed-cluster"><div id="speed-value">0</div><div class="speed-unit">KM/H</div><div class="nitro-line"><span>NITRO <kbd>${keyLabel(app.prefs.bindings.nitro)}</kbd></span><span id="nitro-label">100%</span></div><div class="nitro-track"><i id="nitro-fill"></i></div><div class="drive-states" id="drive-states"></div></div></div><div class="race-help"><span><kbd>${keyLabel(app.prefs.bindings.drift)}</kbd> drift</span><span><kbd>${keyLabel(app.prefs.bindings.recover)}</kbd> recover</span><span><kbd>${keyLabel(app.prefs.bindings.pause)}</kbd> pause</span></div>${app.source === 'harness' ? '<div class="harness-label">DEVELOPMENT HARNESS · ISOLATED TEST DATA</div>' : ''}`;
    updateHUD(); focusGame();
  } else if (app.screen === 'pause') {
    root.innerHTML = `<div class="scrim"></div><main class="pause-panel"><span class="eyebrow">TAKE A BREATH</span><h1>A little<br><em>coast time.</em></h1><p>Race, rivals and weather are paused.<br>${escape(app.pauseReason || 'Your road will be here when you are ready.')}</p><button class="primary full" data-action="resume">Back on the road ${icon('play')}</button><button class="secondary full" data-action="photo">${icon('photo')} Postcard studio</button><button class="secondary full" data-action="settings">${icon('gear')} Settings</button><div class="button-pair"><button class="text-button" data-action="restart">Restart</button><button class="text-button" data-action="retire">Retire this run</button></div></main>`;
    requestAnimationFrame(() => $('[data-action="resume"]')?.focus());
  } else if (app.screen === 'results') { renderResults(root); }
  else if (app.screen.startsWith('settings')) { renderSettings(root); }
  else if (app.screen === 'library') { root.innerHTML = `${nav()}<main class="wide-panel"><span class="eyebrow">YOUR LOCAL COLLECTION</span><h1>Good roads.<br><em>Worth keeping.</em></h1><p>Opening your recordings…</p></main>`; }
  else if (app.screen === 'replay') {
    const p = app.playback, data = p.data, r = data.result;
    root.innerHTML = `<div class="replay-header"><div><span class="eyebrow">${p.origin === 'imported' ? 'IMPORTED · UNVERIFIED FILE CLAIMS' : p.origin === 'harness' ? 'HARNESS RECORDING · TEST DATA' : p.temporary ? 'TEMPORARY RECORDING · NOT SAVED' : 'LOCAL RECORDING'}</span><h2>${COURSES.find(c => c.id === data.setup.course).name}</h2><span>${CARS.find(c => c.id === data.setup.car).name} <span class="dot-sep">/</span> ${escape(r.outcome)} <span class="dot-sep">/</span> ${timeLabel(r.duration)}</span></div><button class="secondary" data-action="replay-back">${icon('back')} Back</button></div><div id="historic-hud" class="historic-hud"></div><div class="replay-toolbar"><div class="replay-cameras" role="group" aria-label="Replay camera">${['Chase', 'Trackside', 'Aerial'].map((n, i) => `<button data-action="camera" data-value="${i}" class="${app.renderer.cameraMode === i ? 'selected' : ''}">${n}</button>`).join('')}</div><div class="timeline"><button class="icon-button dark" data-action="rewind" aria-label="Jump to start">↤</button><button class="icon-button dark" data-action="replay-play" aria-label="${p.playing ? 'Pause' : 'Play'} replay">${icon(p.playing ? 'pause' : 'play')}</button><span id="replay-time">${timeLabel(p.time)}</span><input type="range" id="replay-seek" min="0" max="${r.duration}" step="0.01" value="${p.time}" aria-label="Replay timeline"><span>${timeLabel(r.duration)}</span><button class="icon-button dark" data-action="replay-end" aria-label="Jump to end">↦</button></div><div class="replay-tools"><button class="text-button" data-action="save-current">${icon('library', 17)} Save</button><button class="text-button" data-action="export-current">${icon('download', 17)} Export</button><button class="text-button" data-action="photo">${icon('photo', 17)} Postcard</button></div></div>`;
  } else if (app.screen === 'photo') {
    root.innerHTML = `<div class="photo-frame"></div><header class="photo-header"><div><span class="eyebrow">SIGNATURE FEATURE</span><h2>Postcard studio</h2><p>Find a view. Keep a little summer.</p></div><button class="secondary" data-action="photo-back">${icon('back')} Back</button></header><main class="photo-toolbar"><label>Orbit<input id="photo-angle" type="range" min="-3.14" max="3.14" step="0.01" value="${app.photo.photoAngle}"></label><label>Distance<input id="photo-distance" type="range" min="5" max="24" step=".1" value="${app.photo.photoDistance}"></label><label>Height<input id="photo-height" type="range" min="1.4" max="12" step=".1" value="${app.photo.photoHeight}"></label><label class="caption-field">Your caption<input id="photo-caption" maxlength="64" value="${escape(app.photo.caption)}"></label><label>Print<select id="photo-treatment">${['sand', 'midnight', 'coral'].map(t => `<option ${t === app.photo.treatment ? 'selected' : ''}>${t}</option>`).join('')}</select></label><button class="primary" data-action="photo-export">${icon('download')} Export postcard</button><span class="fine">PNG · saved to your device · no upload</span></main>`;
  }
}
function renderResults(root) {
  const s = app.sim, r = s.result, c = CARS.find(c => c.id === s.setup.car), position = r.standings.findIndex(c => c.id === 0) + 1;
  const title = r.outcome === 'partial' ? 'A road unfinished.' : r.outcome === 'failed' ? 'The coast will wait.' : s.track.mode === 'race' ? position === 1 ? 'Hello, first place.' : 'What a ride.' : s.track.mode === 'rush' ? 'Horizon, reached.' : 'Find your flow.';
  root.innerHTML = `${nav()}<main class="result-panel"><span class="eyebrow">${r.outcome === 'completed' ? 'SESSION COMPLETE' : r.outcome === 'partial' ? 'RETIRED · PARTIAL RUN' : 'TIME EXPIRED · FAILED RUN'}${app.source === 'harness' ? ' · HARNESS TEST DATA' : ''}</span><h1>${title}</h1><p>${s.track.name} <span class="dot-sep">/</span> ${c.name}</p><div class="result-metric"><strong>${s.track.mode === 'race' ? String(position).padStart(2, '0') : s.track.mode === 'rush' ? r.score.toLocaleString('en-US') : timeLabel(r.best)}</strong><span>${s.track.mode === 'race' ? 'OF SIX · CLASSIFICATION' : s.track.mode === 'rush' ? 'ARCADE POINTS' : r.best === null ? 'NO VALID BEST LAP' : 'BEST VALID LAP'}</span></div>${s.track.mode === 'trial' ? `<div class="lap-list">${Array.from({ length: 3 }, (_, i) => { const l = r.laps[i]; return `<div><span>Lap ${i + 1}</span><strong>${l ? timeLabel(l.time) : 'Not completed'}</strong><span class="${l && !l.valid ? 'invalid' : ''}">${l ? l.valid ? 'VALID' : escape(l.reason || 'INVALID') : '—'}</span></div>`; }).join('')}</div><p class="fine">${app.recordMessage || 'Records require a completed local run and valid laps.'}</p>` : s.track.mode === 'race' ? `<div class="standings-list">${r.standings.map((v, i) => `<div class="${v.id === 0 ? 'you' : ''}"><span>${i + 1}</span><strong>${v.name}</strong><span>${v.finishTime === null ? `Unfinished · ${Math.min(99, Math.floor(v.progress / (s.track.length * 3) * 100))}%` : timeLabel(v.finishTime)}</span></div>`).join('')}</div><p class="fine">Race closed at your ${r.outcome === 'completed' ? 'finish' : 'retirement'}. Unfinished rivals are sorted by validated progress.</p>` : `<p class="fine">${s.cars[0].p.passed} / 16 gates · ${timeLabel(r.duration)} elapsed · ${r.outcome === 'completed' ? s.remaining.toFixed(1) + 's to spare' : r.outcome === 'failed' ? 'The timer reached zero.' : 'Retired before the endpoint.'}</p>`}<div class="result-actions"><button class="primary" data-action="view-last">Watch your drive ${icon('play')}</button><button class="secondary" data-action="save-last">${icon('library')} Save replay</button></div><div class="button-pair"><button class="text-button" data-action="export-last">${icon('download', 17)} Export replay</button><button class="text-button" data-action="restart">Drive again</button><button class="text-button" data-action="home">Back to coast</button></div><p class="fine save-status">${app.dirty ? 'Your replay is temporary. Save or export it before leaving.' : 'Your recording has been saved or exported during this visit.'}</p></main>`;
}
function renderSettings(root) {
  const p = app.prefs;
  root.innerHTML = `<div class="scrim settings-scrim"></div><main class="settings-panel"><div class="panel-heading"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h1>Settings</h1></div><button class="icon-button dark" data-action="settings-back" aria-label="Close settings">${icon('close')}</button></div><div class="settings-columns"><section><h2>Picture & sound</h2><label class="field-label" for="quality">Graphics quality</label><select id="quality" data-pref="quality">${['Low', 'Medium', 'High'].map(v => `<option ${p.quality === v ? 'selected' : ''}>${v}</option>`).join('')}</select><p class="fine">Changes shadow resolution, scenery density, rain count and rendering resolution immediately.</p><div class="setting-row"><label for="scale">Render scale</label><select id="scale" data-pref="scale">${[.65, .8, 1, 1.25].map(v => `<option value="${v}" ${p.scale === v ? 'selected' : ''}>${Math.round(v * 100)}%</option>`).join('')}</select></div><div class="setting-row"><label for="fps">Frame cap</label><select id="fps" data-pref="fps">${[30, 60, 120].map(v => `<option value="${v}" ${p.fps === v ? 'selected' : ''}>${v} FPS</option>`).join('')}</select></div><p class="fine">Frame cap is an upper bound; display refresh and hardware determine actual frame rate.</p><label class="field-label" for="volume">Master volume</label><input id="volume" data-pref="volume" type="range" min="0" max="1" step=".01" value="${p.volume}"><label class="check-row"><input data-pref="muted" type="checkbox" ${p.muted ? 'checked' : ''}>Mute all audio</label><label class="check-row"><input data-pref="reducedMotion" type="checkbox" ${p.reducedMotion ? 'checked' : ''}>Reduced camera motion</label><button class="secondary full" data-action="fullscreen" ${!document.fullscreenEnabled ? 'disabled' : ''}>${document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'}</button>${!document.fullscreenEnabled ? '<p class="fine">Fullscreen is unavailable in this browser or embedded preview.</p>' : ''}</section><section><h2>Your controls</h2><p class="fine">Select a binding, then press a key. Uses physical keys; duplicate bindings are rejected. Press Escape to cancel.</p><div class="bindings">${Object.entries(ACTION_LABELS).map(([key, label]) => `<div><span>${label}</span><button class="binding ${app.bindingAction === key ? 'listening' : ''}" data-action="bind" data-value="${key}">${app.bindingAction === key ? 'Press a key…' : escape(keyLabel(p.bindings[key]))}</button></div>`).join('')}</div><button class="text-button" data-action="reset-bindings">Restore default controls</button><p class="fine">${app.layoutLabels.size ? 'Keyboard layout labels available.' : 'Physical key labels shown. Active layout names are unavailable here.'}</p></section></div><button class="primary settings-done" data-action="settings-back">All set ${icon('arrow')}</button></main>`;
}
function updateHUD() {
  const s = app.sim, c = s.cars[0], track = s.track; if (!$('#mode-hud')) return;
  const lap = Math.min(track.laps, Math.floor(c.p.passed / track.gates) + 1);
  const common = `<div class="hud-block"><small>${track.mode === 'rush' ? 'CHECKPOINT' : 'LAP'}</small><strong>${track.mode === 'rush' ? `${Math.min(track.gates, c.p.passed + 1)}<i> / ${track.gates}</i>` : `0${lap}<i> / 03</i>`}</strong></div>`;
  const previous = c.p.laps.filter(l => l.valid).map(l => l.time);
  $('#mode-hud').innerHTML = common + (track.mode === 'trial' ? `<div class="hud-block"><small>CURRENT LAP</small><strong class="timer">${timeLabel(s.time - c.p.lapStart)}</strong><span class="${c.p.valid ? '' : 'invalid'}">${c.p.valid ? `Best ${previous.length ? timeLabel(Math.min(...previous)) : '—'}` : `INVALID · ${escape(c.p.invalidReason)}`}</span></div><div class="lap-mini">${c.p.laps.map((l, i) => `<span>L${i + 1} ${timeLabel(l.time)} ${l.valid ? '✓' : 'INVALID'}</span>`).join('')}</div>` : track.mode === 'race' ? `<div class="hud-block"><small>POSITION</small><strong>${standings(s.cars, track).findIndex(v => v.id === 0) + 1}<i> / 6</i></strong></div><div class="live-standings">${standings(s.cars, track).map((car, i) => `<div class="${car.id === 0 ? 'you' : ''}"><span>${i + 1}</span><i style="background:${car.color}"></i><span>${car.name}</span>${car.p.finishTime !== null ? '<span>FIN</span>' : ''}</div>`).join('')}</div>` : `<div class="hud-block ${s.remaining < 8 ? 'time-warning' : ''}"><small>TIME LEFT</small><strong>${s.remaining.toFixed(1)}<i> s</i></strong></div><div class="hud-block score-block"><small>ARCADE SCORE</small><strong>${Math.floor(s.score).toLocaleString('en-US')}</strong><span>FLOW ×${s.combo.toFixed(2)}</span></div>`);
  $('#speed-value').textContent = Math.round(Math.abs(c.speed) * 3.6); $('#nitro-label').textContent = `${Math.floor(c.nitro)}%`; $('#nitro-fill').style.width = `${c.nitro}%`; $('#nitro-fill').className = c.boosting ? 'active' : '';
  $('#drive-states').textContent = c.ghost > 0 ? 'REJOINING · GHOST' : c.drifting ? 'DRIFTING' : c.boosting ? 'NITRO ACTIVE' : Math.max(...c.damage) > .4 ? 'BODY DAMAGE · COSMETIC' : '';
  $('#countdown').textContent = s.status === 'countdown' ? Math.ceil(s.countdown) : s.time < .7 ? 'GO' : '';
  $('#race-message').textContent = s.messageUntil > s.time ? s.lastMessage : '';
  const light = s.env.day, lightName = light < .20 ? 'Morning' : light < .40 ? 'Daytime' : light < .57 ? 'Sunset' : light < .90 ? 'Night' : 'Morning';
  $('#weather-hud').innerHTML = `${icon(s.env.wet > .3 ? 'rain' : s.env.cloud > .25 ? 'cloud' : 'sun', 16)}<span>${s.env.wet > .3 ? 'Rain' : s.env.cloud > .25 ? 'Cloud cover' : 'Clear skies'} · ${lightName}</span><span>${timeLabel(s.time)}</span>`;
  drawMap(s);
}
function drawMap(s) {
  const canvas = $('#minimap'); if (!canvas) return; const ctx = canvas.getContext('2d'), samples = s.track.samples;
  const minX = Math.min(...samples.map(p => p.x)), maxX = Math.max(...samples.map(p => p.x)), minZ = Math.min(...samples.map(p => p.z)), maxZ = Math.max(...samples.map(p => p.z)), k = Math.min(340 / (maxX - minX), 225 / (maxZ - minZ));
  const point = p => [30 + (p.x - minX) * k, 25 + (p.z - minZ) * k]; ctx.clearRect(0, 0, 400, 280); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(238,237,208,.35)'; ctx.beginPath(); samples.filter((_, i) => i % 5 === 0).forEach((p, i) => { const [x, y] = point(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
  if (s.track.mode === 'rush') { const [x, y] = point(s.track.at((s.cars[0].p.passed + 1) * s.track.length / s.track.gates)); ctx.fillStyle = '#ffc77d'; ctx.fillRect(x - 5, y - 5, 10, 10); }
  [...s.cars].reverse().forEach(c => { const [x, y] = point(c); ctx.beginPath(); ctx.arc(x, y, c.id ? 5 : 7, 0, Math.PI * 2); ctx.fillStyle = c.id ? c.color : '#ffffff'; ctx.fill(); ctx.strokeStyle = '#16434a'; ctx.lineWidth = 2; ctx.stroke(); });
}
async function startRace() {
  closeDialog(); clearInput(); app.screen = 'loading'; $('#app').innerHTML = '<div class="boot"><span class="sun-mark"></span><h1>THE ROAD AWAITS</h1><p>Preparing your course…</p></div>';
  // Browser audio permission can remain pending indefinitely. It never gates driving.
  app.audio.activate(); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  try { app.sim = new Simulation(app.setup, app.source); app.lastReplay = null; app.dirty = false; app.recordMessage = ''; app.eventCursor = 0; app.finished = false; app.audio.countBeat = 0; app.pauseReason = ''; setScreen('race'); }
  catch (error) { console.error(error); setScreen('menu'); notify('The race could not start. Try another course or reload.', true); }
}
function pause(reason = '') { if (app.screen !== 'race' || app.sim.status === 'done') return; app.pauseReason = reason; app.sim.pause(); setScreen('pause'); }
function finishRun() {
  if (app.finished) return; app.finished = true; clearInput(); app.lastReplay = app.sim.replay(); app.dirty = true; setScreen('results'); app.audio.tone('finish');
  const sim = app.sim;
  writeRecord(kv, navigator.locks, sim, app.namespace).then(written => { app.recordMessage = written ? app.source === 'harness' ? 'Harness record written to isolated test storage only.' : 'A new personal best, saved for this car and starting conditions.' : sim.result.best === null ? 'No valid best lap. No personal record was written.' : 'Personal best retained for this car and starting conditions.'; if (app.screen === 'results' && sim === app.sim) renderUI(); }).catch(() => { app.recordMessage = 'Record could not be saved. This run and its replay remain available.'; if (app.screen === 'results') renderUI(); });
}
function openReplay(data, { origin = 'local', back = 'results', temporary = false } = {}) {
  clearInput(); app.playback = { data, time: 0, playing: false, origin, back, temporary }; app.renderer.cameraMode = 0; setScreen('replay');
}
function modal(title, body, buttons) {
  clearInput(); app.dialogOpen = true; app.previousFocus = document.activeElement;
  $('#dialog-root').innerHTML = `<div class="dialog-scrim"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><span class="eyebrow">SOLSTICE / COAST CLUB</span><h2 id="dialog-title">${escape(title)}</h2><div class="dialog-body">${body}</div><div class="dialog-buttons">${buttons.map((b, i) => `<button class="${b.primary ? 'primary' : 'secondary'}" data-dialog="${i}">${escape(b.label)}</button>`).join('')}</div></section></div>`;
  app.dialogButtons = buttons; requestAnimationFrame(() => $('[data-dialog]')?.focus());
}
function closeDialog() { $('#dialog-root').innerHTML = ''; app.dialogOpen = false; app.dialogButtons = null; app.previousFocus?.focus?.({ preventScroll: true }); }
function exportReplay(data) {
  if (!data) return; downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `solstice-${data.setup.course}-${data.result.outcome}.solstice`); if (data === app.lastReplay) app.dirty = false; notify('Replay file download requested. Keep the file to reopen this drive.');
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
async function saveReplay(data, origin, after = () => {}, recoveredFile) {
  if (!data) return;
  try {
    const result = await app.library.save(data, { origin, recoveredFile });
    if (result.full) {
      modal('Five good roads, all kept.', '<p>Your library has five recordings. Choose one to replace explicitly, or cancel to keep them all.</p>', [...result.entries.map(e => ({ label: `Replace ${e.label}`, action: async () => {
        try { await app.library.save(data, { origin, recoveredFile, replaceId: e.id, expectedRevision: result.revision }); if (data === app.lastReplay) app.dirty = false; closeDialog(); notify('Recording saved. The selected entry was replaced.'); after(); }
        catch (e) { closeDialog(); notify(e.message, true); }
      } })), { label: 'Cancel · keep every recording', action: closeDialog }]);
    } else { if (data === app.lastReplay) app.dirty = false; closeDialog(); notify('Recording saved to this browser.'); after(); }
  } catch (e) {
    modal('Your drive is still here.', `<p>${escape(e.message)}</p><p>Export a portable file or keep watching the temporary recording.</p>`, [{ label: 'Export replay file', primary: true, action: () => { exportReplay(data); closeDialog(); after(); } }, { label: 'Keep here', action: closeDialog }]);
  }
}
function leaveRun(action) {
  if (!app.lastReplay || !app.dirty) { action(); return; }
  modal('Keep this stretch of coast?', '<p>This replay has no saved copy yet. Save it, export a portable file, or explicitly discard it before leaving.</p>', [
    { label: 'Save to library', primary: true, action: () => saveReplay(app.lastReplay, app.source, action) },
    { label: 'Export file & continue', action: () => { exportReplay(app.lastReplay); closeDialog(); action(); } },
    { label: 'Discard & continue', action: () => { app.dirty = false; closeDialog(); action(); } },
    { label: 'Stay here', action: closeDialog }
  ]);
}
async function showLibrary() {
  clearInput(); app.screen = 'library'; app.generation++; const generation = app.generation; renderUI();
  const listing = await app.library.list(); if (app.screen !== 'library' || app.generation !== generation) return;
  app.listing = listing;
  const entry = (e, orphan = false) => `<article class="replay-entry"><div class="entry-number">${orphan ? '↺' : String(listing.entries.indexOf(e) + 1).padStart(2, '0')}</div><div class="entry-info"><span class="eyebrow">${orphan ? 'RECOVERED FILE · NEEDS A CHOICE' : e.origin === 'imported' ? 'IMPORTED · UNVERIFIED CLAIMS' : e.origin === 'harness' ? 'HARNESS TEST DATA' : 'LOCALLY PLAYED'}</span><h3>${COURSES.find(c => c.id === e.replay.setup.course).name}</h3><p>${CARS.find(c => c.id === e.replay.setup.car).name} · ${timeLabel(e.replay.result.duration)} · ${escape(e.replay.result.outcome)} · ${new Date(e.replay.created).toLocaleDateString('en-GB')}</p></div><div class="entry-actions"><button class="secondary" data-action="open-entry" data-value="${e.id}" data-orphan="${orphan}">${icon('play', 16)} Watch</button>${orphan ? `<button class="secondary" data-action="recover-entry" data-value="${e.id}">Recover</button>` : ''}<button class="icon-button dark" data-action="export-entry" data-value="${e.id}" data-orphan="${orphan}" aria-label="Export recording">${icon('download', 18)}</button><button class="icon-button dark" data-action="delete-entry" data-value="${e.id}" data-orphan="${orphan}" aria-label="Delete recording">${icon('close', 18)}</button></div></article>`;
  $('#app').innerHTML = `${nav()}<main class="wide-panel library-panel"><div class="library-heading"><div><span class="eyebrow">YOUR LOCAL COLLECTION / ${listing.capacity} OF 5</span><h1>Good roads.<br><em>Worth keeping.</em></h1></div><button class="primary" data-action="import">Import replay ${icon('arrow')}</button></div><p>Portable recordings. No account. Just the roads you remember.</p>${listing.warning ? `<p class="storage-warning">${escape(listing.warning)}</p>` : ''}<section class="entries">${listing.entries.length ? listing.entries.map(e => entry(e)).join('') : `<div class="empty-library"><span class="sun-mark"></span><h2>The best roads are still ahead.</h2><p>Finish or retire a run, then choose Save replay.<br>Your five slots are waiting.</p><button class="secondary" data-action="setup">Find a road ${icon('arrow')}</button></div>`}</section>${listing.orphans.length ? `<h2 class="recovered-title">Recovered recordings</h2><p class="fine">Files from interrupted saves or replacements. They are preserved outside the five admitted slots. Export, recover with an explicit replacement, or delete.</p>${listing.orphans.map(e => entry(e, true)).join('')}` : ''}${listing.problems.length ? `<h2 class="recovered-title">Files needing attention</h2>${listing.problems.map(e => `<div class="problem-entry"><p>${escape(e.label || 'Unreadable recording')} · incomplete or missing</p><button class="secondary" data-action="remove-problem" data-value="${e.id}" data-orphan="${!!e.orphan}">${e.orphan ? 'Delete incomplete file' : 'Remove stale entry'}</button></div>`).join('')}` : ''}<div class="record-strip"><h2>Personal laps / Coastal Sprint</h2><p class="fine">Only completed local drives with valid laps qualify. Starting conditions and car remain part of each record.</p>${Object.values(readRecords(kv, app.namespace)).map(r => `<div><strong>${timeLabel(r.time)}</strong><span>${CARS.find(c => c.id === r.car)?.name || 'Car'} · ${WEATHER[r.weather]} · ${DAYLIGHT[r.daylight]}${r.source === 'harness' ? ' · HARNESS ONLY' : ''}</span></div>`).join('') || '<span class="fine">No locally validated personal laps yet.</span>'}</div><button class="text-button" data-action="home">${icon('back', 17)} Back to the coast</button></main>`;
}
function openPhoto() {
  if (app.screen === 'race') { app.sim.pause(); app.photoBack = 'pause'; }
  else { app.photoBack = app.screen; if (app.screen === 'replay') app.playback.playing = false; }
  setScreen('photo');
}
function input() { const b = app.prefs.bindings, held = app.held; return { throttle: +held.has(b.throttle), brake: +held.has(b.brake), steer: +held.has(b.right) - +held.has(b.left), drift: held.has(b.drift), nitro: held.has(b.nitro), recover: held.has(b.recover) }; }

const actions = {
  home: () => leaveRun(() => { app.sim = null; app.lastReplay = null; setScreen('menu'); }),
  setup: () => leaveRun(() => { app.sim = null; setScreen('setup'); }),
  course: el => { app.setup.course = el.dataset.value; app.sim = null; setScreen('setup'); },
  garage: () => leaveRun(() => { app.garageBack = app.screen === 'setup' ? 'setup' : 'menu'; app.sim = null; setScreen('garage'); }),
  'garage-back': () => setScreen(app.garageBack || 'setup'),
  car: el => { app.setup.car = el.dataset.value; renderUI(); app.renderer.snap = true; },
  start: startRace,
  pause: () => pause(),
  resume: () => { app.sim.resume(); app.pauseReason = ''; setScreen('race'); app.audio.activate(); },
  restart: () => {
    if (app.sim?.status === 'paused') modal('Start a fresh drive?', '<p>This unfinished attempt will be discarded. A new race starts with clean damage, full nitro and your original setup.</p>', [{ label: 'Restart this race', primary: true, action: startRace }, { label: 'Keep this run', action: closeDialog }]);
    else leaveRun(startRace);
  },
  retire: () => { app.sim.finish('partial'); finishRun(); },
  library: () => leaveRun(() => { app.sim = null; showLibrary(); }),
  settings: () => { const race = app.screen === 'pause' || app.screen === 'race'; if (app.screen === 'race') app.sim.pause(); app.settingsBack = race ? 'pause' : app.screen; setScreen(race ? 'settings-race' : 'settings-menu'); },
  'settings-back': () => { setScreen(app.settingsBack || 'menu'); if (app.screen === 'library') showLibrary(); },
  sound: () => { app.prefs.muted = !app.prefs.muted; app.audio.activate(); persistPrefs(); renderUI(); },
  fullscreen: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { notify('Fullscreen was refused by this browser. Windowed play is still available.', true); } },
  bind: el => { clearInput(); app.bindingAction = el.dataset.value; renderUI(); },
  'reset-bindings': () => { clearInput(); app.prefs.bindings = { ...DEFAULT_BINDINGS }; persistPrefs(); renderUI(); },
  'view-last': () => openReplay(app.lastReplay, { origin: app.source, temporary: app.dirty }),
  'save-last': () => saveReplay(app.lastReplay, app.source, renderUI),
  'export-last': () => { exportReplay(app.lastReplay); renderUI(); },
  'save-current': () => saveReplay(app.playback.data, app.playback.origin),
  'export-current': () => exportReplay(app.playback.data),
  'replay-back': () => { const back = app.playback.back; app.playback.playing = false; app.audio.silence(); if (back === 'library') showLibrary(); else setScreen(back); },
  'replay-play': () => { const p = app.playback; if (p.time >= p.data.result.duration) { p.time = 0; app.renderer.snap = true; } p.playing = !p.playing; app.audio.activate(); app.audio.silence(); renderUI(); },
  rewind: () => { app.playback.time = 0; app.playback.playing = false; app.renderer.snap = true; app.audio.silence(); renderUI(); },
  'replay-end': () => { app.playback.time = app.playback.data.result.duration; app.playback.playing = false; app.renderer.snap = true; app.audio.silence(); renderUI(); },
  camera: el => { app.renderer.cameraMode = Number(el.dataset.value); app.renderer.snap = true; renderUI(); },
  photo: openPhoto,
  'photo-back': () => setScreen(app.photoBack || 'pause'),
  'photo-export': () => { const print = app.renderer.postcard(displayState(), app.photo); print.toBlob(blob => { if (blob) { downloadBlob(blob, 'solstice-postcard.png'); notify('Your postcard download is ready. A little summer to keep.'); } else notify('The postcard could not be created. Try again.', true); }, 'image/png'); },
  import: () => $('#import-file').click(),
  'open-entry': el => { const list = el.dataset.orphan === 'true' ? app.listing.orphans : app.listing.entries, entry = list.find(e => e.id === el.dataset.value); if (entry) openReplay(entry.replay, { origin: entry.origin, back: 'library' }); },
  'export-entry': el => { const list = el.dataset.orphan === 'true' ? app.listing.orphans : app.listing.entries; exportReplay(list.find(e => e.id === el.dataset.value)?.replay); },
  'recover-entry': el => { const e = app.listing.orphans.find(e => e.id === el.dataset.value); if (e) saveReplay(e.replay, 'imported', showLibrary, e.file); },
  'delete-entry': el => { const orphan = el.dataset.orphan === 'true', e = (orphan ? app.listing.orphans : app.listing.entries).find(e => e.id === el.dataset.value); if (e) modal('Delete this recording?', '<p>This removes the browser copy. Export it first if you want to keep it.</p>', [{ label: 'Delete recording', action: async () => { try { await app.library.remove(e.id, orphan ? e.file : undefined); closeDialog(); await showLibrary(); notify('Recording deleted.'); } catch (error) { closeDialog(); notify(error.message, true); } } }, { label: 'Cancel', primary: true, action: closeDialog }]); },
  'remove-problem': el => { const e = app.listing.problems.find(e => e.id === el.dataset.value); if (e) modal('Remove this incomplete entry?', '<p>This action affects only the selected incomplete file or stale library label.</p>', [{ label: 'Remove selected entry', action: async () => { try { if (e.orphan) await app.library.remove(e.id, e.file); else await app.library.forgetMissing(e.id); closeDialog(); showLibrary(); } catch (error) { closeDialog(); notify(error.message, true); } } }, { label: 'Cancel', action: closeDialog }]); }
};
document.addEventListener('click', event => {
  const dialogButton = event.target.closest('[data-dialog]');
  if (dialogButton) { app.dialogButtons?.[Number(dialogButton.dataset.dialog)]?.action(); return; }
  const el = event.target.closest('[data-action]'); if (!el || app.dialogOpen) return;
  const handler = actions[el.dataset.action]; if (handler) Promise.resolve(handler(el)).catch(error => { console.error(error); notify(error.message || 'That action could not be completed.', true); });
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.setup) app.setup[el.dataset.setup] = Number(el.value);
  if (el.dataset.pref) {
    const key = el.dataset.pref; app.prefs[key] = el.type === 'checkbox' ? el.checked : ['scale', 'fps', 'volume'].includes(key) ? Number(el.value) : el.value;
    clearInput(); if (['quality', 'scale'].includes(key)) app.renderer.setQuality(app.prefs); persistPrefs(); app.audio.activate();
  }
  if (el.id === 'photo-treatment') app.photo.treatment = el.value;
});
document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'replay-seek' && app.playback) { app.playback.time = Number(el.value); app.playback.playing = false; app.renderer.snap = true; app.audio.silence(); const button = $('[data-action="replay-play"]'); button.innerHTML = icon('play'); button.setAttribute('aria-label', 'Play replay'); }
  const keys = { 'photo-angle': 'photoAngle', 'photo-distance': 'photoDistance', 'photo-height': 'photoHeight' }; if (keys[el.id]) app.photo[keys[el.id]] = Number(el.value);
  if (el.id === 'photo-caption') app.photo.caption = el.value.slice(0, 64);
  if (el.dataset.pref === 'volume') { app.prefs.volume = Number(el.value); persistPrefs(); }
});
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > MAX_REPLAY_BYTES) throw new Error('That file exceeds the 8 MiB replay limit.');
    const replay = parseReplay(await file.text());
    if (!app.library.available) { notify('Persistence is unavailable. This imported replay is temporary; export it before leaving.', true); openReplay(replay, { origin: 'imported', back: 'library', temporary: true }); }
    else await saveReplay(replay, 'imported', showLibrary);
  } catch (error) { notify(error.message, true); }
});
document.addEventListener('keydown', event => {
  if (app.dialogOpen) {
    if (event.key === 'Tab') {
      const list = [...$('#dialog-root').querySelectorAll('button')], i = list.indexOf(document.activeElement); event.preventDefault(); list[(i + (event.shiftKey ? list.length - 1 : 1)) % list.length]?.focus();
    }
    return;
  }
  if (app.bindingAction) {
    event.preventDefault(); event.stopPropagation(); if (event.code === 'Escape' && app.bindingAction !== 'pause') { app.bindingAction = null; renderUI(); return; }
    const problem = event.ctrlKey || event.metaKey || event.altKey ? 'Browser shortcuts cannot be assigned safely. Choose an ordinary key.' : bindingProblem(app.prefs.bindings, app.bindingAction, event.code);
    if (problem) notify(problem, true); else { app.prefs.bindings[app.bindingAction] = event.code; app.bindingAction = null; clearInput(); persistPrefs(); renderUI(); }
    return;
  }
  if (event.target.matches?.('input,select,textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
  const action = Object.keys(app.prefs.bindings).find(k => app.prefs.bindings[k] === event.code);
  if (app.screen === 'race' && action) {
    event.preventDefault(); event.stopPropagation(); if (event.repeat && ['pause', 'photo', 'recover'].includes(action)) return;
    if (action === 'pause') { pause(); return; } if (action === 'photo') { openPhoto(); return; } app.held.add(event.code);
  } else if (app.screen === 'pause' && action === 'pause') { event.preventDefault(); if (!event.repeat) actions.resume(); }
  else if (app.screen === 'replay' && event.code === 'Space') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) actions['replay-play'](); }
}, true);
document.addEventListener('keyup', event => { app.held.delete(event.code); if (app.screen === 'race' && Object.values(app.prefs.bindings).includes(event.code)) { event.preventDefault(); event.stopPropagation(); } }, true);
addEventListener('blur', () => { clearInput(); if (app.screen === 'race') pause('Focus left the game. Held controls were cleared.'); if (app.screen === 'replay') { app.playback.playing = false; renderUI(); } });
document.addEventListener('visibilitychange', () => { clearInput(); if (document.hidden && app.screen === 'race') pause('The tab was hidden. Simulation time stayed still.'); if (document.hidden && app.playback) app.playback.playing = false; });
addEventListener('resize', () => app.renderer?.resize());
addEventListener('storage', event => { if (event.key === `${app.namespace}.library` && app.screen === 'library') showLibrary(); });
try { const layout = await navigator.keyboard?.getLayoutMap?.(); if (layout) layout.forEach((value, code) => app.layoutLabels.set(code, value.length === 1 ? value.toUpperCase() : value)); } catch {}

try {
  app.renderer = new GameRenderer($('#world'), app.prefs); renderUI();
} catch (error) {
  console.error(error); $('#app').innerHTML = '<main class="fatal"><span class="sun-mark"></span><h1>The coast needs WebGL 2.</h1><p>Graphics could not initialize. Enable hardware acceleration in a modern desktop browser, close GPU-heavy tabs, then retry.</p><button class="primary" id="retry-graphics">Reload game</button></main>'; $('#retry-graphics').onclick = () => location.reload();
}
$('#world').addEventListener('webglcontextlost', event => {
  event.preventDefault(); if (!app.renderer) return; app.renderer.lost = true; clearInput(); if (app.sim && app.sim.status !== 'done') app.sim.pause();
  modal('Graphics connection interrupted.', '<p>The game has paused. If the browser restores graphics, you can return safely. You can also reload; unsaved progress will be lost.</p>', [{ label: 'Reload game', action: () => location.reload() }]);
});
$('#world').addEventListener('webglcontextrestored', () => {
  if (!app.renderer) return; app.renderer.lost = false; app.renderer.snap = true; closeDialog(); if (app.sim?.status === 'paused') setScreen('pause'); else renderUI(); notify('Graphics restored. The race stayed paused.');
});
let lastTime = performance.now(), lastRender = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(.1, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
  if (!app.renderer || app.renderer.lost || document.hidden) return;
  app.menuTime += elapsed;
  if (app.screen === 'race' && !app.dialogOpen && !app.harnessBusy) {
    app.accumulator = Math.min(.12, app.accumulator + elapsed);
    while (app.accumulator >= STEP && app.sim.status !== 'done') { app.sim.step(input(), STEP); app.accumulator -= STEP; }
    const beat = app.sim.status === 'countdown' ? Math.ceil(app.sim.countdown) : 0;
    if (beat !== app.audio.countBeat) { app.audio.tone(beat === 0 ? 'go' : 'countdown'); app.audio.countBeat = beat; }
    for (; app.eventCursor < app.sim.events.length; app.eventCursor++) { const event = app.sim.events[app.eventCursor]; if (event.car === 0) app.audio.tone(event.type); }
    if (app.sim.status === 'done') finishRun();
  }
  if (app.screen === 'replay' && app.playback.playing && !app.dialogOpen) {
    app.playback.time = Math.min(app.playback.data.result.duration, app.playback.time + elapsed);
    if (app.playback.time >= app.playback.data.result.duration) { app.playback.playing = false; renderUI(); app.audio.silence(); }
  }
  const interval = 1000 / app.prefs.fps;
  if (now - lastRender < interval - .6) return;
  const renderDelta = Math.min(.1, (now - lastRender) / 1000); lastRender = now;
  const state = displayState(); const mode = app.screen.startsWith('settings') ? app.screen : app.screen;
  app.renderer.render(state, mode, renderDelta, { menuTime: app.menuTime, ...app.photo });
  app.audio.update(state.cars[0], app.screen === 'race' && app.sim.status === 'racing' || app.screen === 'replay' && app.playback.playing, app.prefs);
  app.uiClock += elapsed;
  if (app.uiClock > .08) {
    app.uiClock = 0; if (app.screen === 'race') updateHUD();
    if (app.screen === 'replay') { $('#replay-time').textContent = timeLabel(app.playback.time); if (document.activeElement?.id !== 'replay-seek') $('#replay-seek').value = app.playback.time; const p = state.cars[0]; $('#historic-hud').textContent = `${Math.round(Math.abs(p.speed) * 3.6)} KM/H  ·  ${state.track.mode === 'rush' ? 'GATE' : 'LAP'} ${state.track.mode === 'rush' ? p.p.passed : Math.min(state.track.laps, Math.floor(p.p.passed / state.track.gates) + 1)} / ${state.track.mode === 'rush' ? state.track.gates : state.track.laps}  ·  NITRO ${Math.floor(p.nitro)}%  ·  ${p.p.valid ? 'VALID' : 'INVALID'}${state.track.mode === 'race' ? `  ·  POSITION ${standings(state.cars, state.track).findIndex(c => c.id === 0) + 1} / 6` : state.track.mode === 'rush' ? `  ·  ${state.remaining.toFixed(1)}s  ·  ${Math.floor(state.score)} pts  ×${state.combo.toFixed(2)}` : ''}`; }
  }
}
if (app.renderer) requestAnimationFrame(frame);
if (harnessEnabled) {
  const { installHarness } = await import('./dev-harness.js'); await installHarness(app, { kv, startRace, finishRun, setScreen, displayState, input, openReplay, showLibrary, saveReplay, exportReplay, updateHUD, actions });
}
