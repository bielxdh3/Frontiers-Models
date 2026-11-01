export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = (x, m) => ((x % m) + m) % m;
export const angleDiff = (a, b) => wrap(a - b + Math.PI, TAU) - Math.PI;
export const CARS = [
  { id: 'brisa', name: 'Brisa R', kind: 'Leve. Ágil. Instintivo.', color: '#f27650', max: 59, accel: 15, grip: 9.4, brake: 30, steer: 1.16, shape: 0, stats: [68, 90, 96] },
  { id: 'mare', name: 'Maré GT', kind: 'Equilíbrio para ir além.', color: '#55d3c3', max: 65, accel: 13, grip: 8, brake: 29, steer: 1.02, shape: 1, stats: [83, 83, 83] },
  { id: 'sol', name: 'Solstice S', kind: 'Horizonte, sem limites.', color: '#f9c758', max: 73, accel: 11.5, grip: 6.8, brake: 26, steer: .93, shape: 2, stats: [99, 73, 69] },
];
export const MODES = {
  trial: { name: 'Contra o tempo', course: 'Coastal Sprint', short: 'Costa aberta', detail: 'Você, três voltas e a linha perfeita.', tag: '01 / Precisão', laps: 3, width: 18, gates: 12,
    points: [[-220,9,-240],[-200,12,-60],[-100,22,130],[100,30,250],[330,23,220],[470,17,80],[410,10,-90],[300,7,-160],[210,11,-320],[10,18,-430],[-150,13,-390]] },
  race: { name: 'Grande prêmio', course: 'Riviera Grand Prix', short: 'Riviera viva', detail: 'Cinco rivais. Três voltas. Um lugar ao sol.', tag: '02 / Disputa', laps: 3, width: 22, gates: 12,
    points: [[-290,12,-260],[-300,15,-70],[-200,24,160],[-30,28,250],[140,20,130],[240,12,230],[440,10,230],[520,16,50],[390,22,-70],[420,27,-280],[200,19,-410],[-30,12,-370],[-150,9,-470],[-270,10,-420]] },
  rush: { name: 'Corrida de portais', course: 'Horizon Rush', short: 'Serra do horizonte', detail: 'Ganhe tempo. Encadeie curvas. Vá mais longe.', tag: '03 / Adrenalina', laps: 2, width: 19, gates: 12,
    points: [[-260,10,-260],[-300,23,-50],[-230,45,160],[-90,54,280],[70,42,190],[30,30,40],[190,20,10],[340,13,130],[470,25,70],[430,40,-100],[290,53,-260],[100,33,-340],[-10,20,-220],[-130,10,-390]] },
};
export const WEATHER = { sunny: 'Ensolarado', cloudy: 'Nublado', rainy: 'Chuva' };
export const TIMES = { morning: 'Manhã', day: 'Dia', sunset: 'Pôr do sol', night: 'Noite' };
export const DIFFICULTIES = { easy: 'Tranquilo', normal: 'Ritmo de corrida', hard: 'Sem concessões' };
export const DEFAULT_BINDINGS = { throttle: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'Space', nitro: 'ShiftLeft', recover: 'KeyR', pause: 'Escape' };
export const ACTION_LABELS = { throttle: 'Acelerar', brake: 'Frear / ré', left: 'Esquerda', right: 'Direita', drift: 'Drift', nitro: 'Nitro', recover: 'Recuperar carro', pause: 'Pausar' };
export const DEFAULT_SETTINGS = { quality: 'medium', scale: 1, fps: 60, volume: .45, mute: false, reduced: false, bindings: { ...DEFAULT_BINDINGS } };
export function bindingError(code, action, bindings) {
  if (!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Escape|Enter|Backspace|Comma|Period|Semicolon|Slash|Quote|Bracket(Left|Right)|Minus|Equal)$/.test(code)) return 'Esta tecla é reservada ou não é compatível.';
  const conflict = Object.keys(bindings).find(k => k !== action && bindings[k] === code);
  return conflict ? `Já usada para ${ACTION_LABELS[conflict].toLowerCase()}. Escolha outra tecla.` : '';
}
export function cleanSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  if (!raw || typeof raw !== 'object') return s;
  if (['low','medium','high'].includes(raw.quality)) s.quality = raw.quality;
  if (Number.isFinite(raw.scale)) s.scale = clamp(raw.scale, .5, 1.5);
  if ([30,60,120].includes(raw.fps)) s.fps = raw.fps;
  if (Number.isFinite(raw.volume)) s.volume = clamp(raw.volume, 0, 1);
  for (const k of ['mute','reduced']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
  if (raw.bindings && Object.keys(DEFAULT_BINDINGS).every(k => typeof raw.bindings[k] === 'string' && !bindingError(raw.bindings[k], k, raw.bindings))) s.bindings = Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map(k => [k,raw.bindings[k]]));
  return s;
}
export const formatTime = (v, digits = 2) => Number.isFinite(v) ? `${Math.floor(v / 60)}:${(v % 60).toFixed(digits).padStart(digits + 3, '0')}` : '—';
export function seedRandom(seed = 19) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
