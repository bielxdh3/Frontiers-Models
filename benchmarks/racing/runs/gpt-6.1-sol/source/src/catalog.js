export const CARS = [
  { id: 'tern', name: 'Tern R', class: 'The corner artist', number: '01', color: '#f16f4e', accent: '#ffdb95', top: 51, acceleration: 15.8, grip: 13.5, steer: .40, width: 1.92, length: 4.15, design: 'compact', stats: [76, 94, 96], description: 'Light, eager and beautifully balanced through a bend. A short wheelbase with a big personality.' },
  { id: 'mistral', name: 'Mistral GT', class: 'A little of everything', number: '02', color: '#65cfc7', accent: '#16494f', top: 57, acceleration: 14.7, grip: 11.8, steer: .38, width: 2.02, length: 4.6, design: 'coupe', stats: [86, 87, 83], description: 'A sweeping grand tourer. Confident acceleration, fluid drifts and a composed ride along the coast.' },
  { id: 'solano', name: 'Solano S', class: 'Chasing the horizon', number: '03', color: '#f3c96a', accent: '#7b413b', top: 63, acceleration: 13.6, grip: 10.4, steer: .36, width: 2.12, length: 4.9, design: 'wedge', stats: [98, 78, 70], description: 'Low, wide and unhurried until it is very, very fast. Reward smooth inputs with a spectacular straight.' }
];
export const COURSES = [
  { id: 'coastal', mode: 'trial', name: 'Coastal Sprint', label: 'Time trial', subtitle: 'Find your perfect line.', badge: '01', width: 16, gates: 24, laps: 3, palette: '#edb271', description: 'Three flowing laps along the headland. Your best valid lap is the one that counts.', points: [[0,15,0],[0,18,210],[90,28,360],[310,31,450],[500,24,350],[580,16,100],[500,12,-130],[290,21,-270],[70,26,-200],[-65,20,-90]], village: [.40,.57], bridge: [.20,.28], tunnel: [.64,.70] },
  { id: 'riviera', mode: 'race', name: 'Riviera Grand Prix', label: 'Race vs AI', subtitle: 'Make the coast your own.', badge: '02', width: 20, gates: 28, laps: 3, palette: '#e6987b', description: 'Five rivals. Three laps. A village, a viaduct, and no time to admire either.', points: [[0,13,0],[0,14,210],[130,17,340],[340,25,310],[490,27,430],[700,22,370],[730,17,170],[620,14,80],[470,19,130],[340,24,-30],[380,29,-230],[170,23,-300],[-40,15,-190]], village: [.02,.17], bridge: [.30,.40], tunnel: [.68,.76] },
  { id: 'horizon', mode: 'rush', name: 'Horizon Rush', label: 'Checkpoint run', subtitle: 'A road worth chasing.', badge: '03', width: 17, gates: 16, laps: 1, palette: '#91b9a1', description: 'Sixteen gates into the hills. Keep your momentum, link clean driving and beat the clock.', points: [[0,16,0],[30,26,230],[-80,42,420],[80,60,570],[300,64,650],[510,47,500],[450,35,330],[630,24,250],[770,19,40],[650,16,-170],[420,25,-220],[270,46,-100],[90,34,-220],[-100,20,-140]], village: [.53,.65], bridge: [.72,.80], tunnel: [.20,.26] }
];
export const RIVALS = [
  { name: 'Mika', model: 'mistral', color: '#fcdf87', line: -3.8, skill: .99 },
  { name: 'Inez', model: 'tern', color: '#91c9fa', line: 3.8, skill: .96 },
  { name: 'Rio', model: 'solano', color: '#ad9bdf', line: -3.8, skill: 1.02 },
  { name: 'Jules', model: 'mistral', color: '#e993aa', line: 3.8, skill: .98 },
  { name: 'Noa', model: 'tern', color: '#e6eddb', line: -3.8, skill: 1.00 }
];
export const WEATHER = ['Sunny', 'Cloudy', 'Rainy'];
export const DAYLIGHT = ['Morning', 'Daytime', 'Sunset', 'Night'];
export const DIFFICULTIES = ['Easy', 'Normal', 'Hard'];
export const DEFAULT_BINDINGS = { throttle: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'Space', nitro: 'ShiftLeft', recover: 'KeyR', pause: 'Escape', photo: 'KeyP' };
export const ACTION_LABELS = { throttle: 'Accelerate', brake: 'Brake / reverse', left: 'Steer left', right: 'Steer right', drift: 'Drift', nitro: 'Nitro', recover: 'Recover car', pause: 'Pause', photo: 'Postcard studio' };
export const DEFAULT_PREFS = { quality: 'Medium', scale: 1, fps: 60, volume: .45, muted: false, reducedMotion: false, bindings: { ...DEFAULT_BINDINGS } };
export function bindingProblem(bindings, action, code) {
  if (!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Enter|Escape|Tab|Backspace|Bracket(Left|Right)|Comma|Period|Slash|Backslash|Semicolon|Quote|Minus|Equal)$/.test(code)) return 'That key is reserved or unsupported. Choose a letter, arrow or ordinary control key.';
  if (code === 'Tab' || code.startsWith('Control')) return 'Choose a key that does not reserve browser navigation or shortcuts.';
  const other = Object.keys(bindings).find(key => key !== action && bindings[key] === code);
  return other ? `Already used for ${ACTION_LABELS[other].toLowerCase()}. Change that binding first.` : '';
}
