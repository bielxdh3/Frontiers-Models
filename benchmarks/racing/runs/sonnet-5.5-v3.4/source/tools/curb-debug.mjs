import fs from 'node:fs';
import { createWorld } from '../src/world/world.js';
const json = JSON.parse(fs.readFileSync(new URL('../track.json', import.meta.url)));
const w = await createWorld({ json }); const T = w.track;
const out = {}; 
for (let i = 0; i < T.N; i++) { const s = Math.round(T.s[i]); for (const side of [-1, 1]) { const c = side < 0 ? T.curbL[i] : T.curbR[i], b = side < 0 ? T.barL[i] : T.barR[i]; if (c) { const k = `${side}:${b}`; (out[k] = out[k] || []).push(s); } } }
for (const [k, v] of Object.entries(out)) console.log(k, 'n=', v.length, 'range', v[0], '..', v[v.length - 1]);
const opp = []; for (let i = 0; i < T.N; i++) { const s = Math.round(T.s[i]); if ((T.curbR[i] && T.barL[i] === 1) || (T.curbL[i] && T.barR[i] === 1)) opp.push(s); }
console.log('kerb on one side + guardrail on the other: n=', opp.length, 'ranges', opp.filter((s, k) => k === 0 || s - opp[k - 1] > 8).join(','), 'last', opp[opp.length - 1]);
