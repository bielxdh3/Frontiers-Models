import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const path = name => resolve(root, 'benchmarks/racing/prompts', name);
const text = name => readFileSync(path(name), 'utf8').replace(/\r\n/g, '\n');
const original = text('racing-v2.6.md');
const prompt = text('Racing-bench-v3.0-prompt.md');
const context = text('Racing-bench-v3-context.md');

test('original V2.6 input remains byte-for-byte frozen in canonical LF form', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '8dc65f23a8eaa35a06a7833a7929763fd16aa3cde2ff563561bffac7d7d69248');
  assert.match(original, /\*\*Version 2\.6/);
});

test('V3 is a standalone photoreal brief retaining every section through section 59', () => {
  assert.match(prompt, /\*\*Version 3\.0/);
  const sections = [...prompt.matchAll(/^## (\d\d)\./gm)].map(m => Number(m[1]));
  assert.deepEqual(sections, Array.from({ length: 60 }, (_, i) => i));
  assert.match(prompt, /photoreal/i);
  assert.match(prompt, /Coastal Sprint[\s\S]*Riviera Grand Prix[\s\S]*Horizon Rush/);
  assert.match(prompt, /Time Trial[\s\S]*Race vs AI[\s\S]*Checkpoint Run/);
});

test('V3 mandates four vehicles and three genuinely separate uncapped signature features', () => {
  assert.match(prompt, /at least four original, recognizably different selectable car designs/i);
  assert.match(prompt, /at least three distinct, original, substantial, player-facing Signature Features/);
  assert.match(prompt, /NO upper complexity limit/);
  assert.match(prompt, /10\/10 ambition/);
  assert.match(prompt, /three chosen Signature Features/);
  assert.doesNotMatch(prompt, /\*\*Absolute complexity ceiling: 7\/10\*\*/);
  assert.doesNotMatch(prompt, /garage and three differentiated cars|Supply a working garage with \*\*at least three original/);
  assert.match(prompt, /Cockpit camera is expressly NOT mandatory/i);
});

test('V3 art direction has an explicit anti-greybox visual quality gate', () => {
  for (const expression of [
    /physically based rendering/i, /materials? PBR|material and texture richness|material\/render workflow/i,
    /ocean/, /wet asphalt/i, /directional sun/i, /cast shadows/i,
    /volumetric atmosphere/i, /mode photography|Photo Mode/i,
    /screenshot evidence gate/i, /unacceptable substitution/i,
    /Low, Medium and High/, /1920×1080 at 60 FPS/,
  ]) assert.match(prompt, expression);
  assert.match(prompt, /Disqualifying final-state patterns/i);
});

test('V3 retains security and gameplay integrity without creating browser-skill ambiguity', () => {
  for (const expression of [
    /five concurrently active racing opponents/i,
    /three fixed difficulty settings: Easy, Normal, Hard/i,
    /without external|independent of web access/i,
    /No database technology of any kind/i,
    /no more than five saved replay entries/i,
    /strict project-directory boundary/i,
    /browser, Playwright, DevTools/i,
    /minimal relevant tool-operation instructions/i,
    /Do not commit, push/i,
    /Do not produce ratings/i,
  ]) assert.match(prompt, expression);
  assert.doesNotMatch(prompt, /Do not read, invoke or adopt instructions from [^\n]*SKILL\.md/);
});

test('Gemini-only context is a review handoff, never a runner or game implementation prompt', () => {
  assert.match(context, /Gemini-only adversarial specification review context/);
  assert.match(context, /not an additional requirement to give contestants/i);
  assert.match(context, /Do not send this file to benchmark runners/i);
  assert.match(context, /P0|P1|P2/);
  assert.match(context, /Do not build game code/i);
  assert.match(context, /no complexity ceiling/i);
  assert.match(context, /At least 4.*vehicles|four.*vehicles/i);
  assert.ok(existsSync(path('Racing-bench-v3.0-prompt.md')));
});
