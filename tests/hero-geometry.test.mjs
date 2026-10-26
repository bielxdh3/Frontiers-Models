import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const index = JSON.parse(readFileSync(resolve(root, 'benchmarks/solar-system/RUNS.json'), 'utf8'));
const svg = readFileSync(resolve(root, 'assets/frontier-models-hero-v7.svg'), 'utf8');

function elements(tag, role) {
  return [...svg.matchAll(new RegExp(`<${tag}\\b[^>]*data-role="${role}"[^>]*\\/>`, 'g'))]
    .map(([markup]) => Object.fromEntries(
      [...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])
    ));
}

test('five models have exactly five rings and five correctly colored markers', () => {
  const ids = index.current_arena;
  assert.equal(ids.length, 5);
  assert.equal(new Set(ids).size, 5);
  assert.ok(ids.includes('gemini-4-argon-source'));
  assert.ok(!ids.includes('gemini-3.8-flash-high-frontier-v2'));
  const rings = elements('ellipse', 'orbit');
  const planets = elements('circle', 'planet');
  assert.equal(rings.length, 5);
  assert.equal(planets.length, 5);
  assert.deepEqual(rings.map(x => x['data-model']), ids);
  assert.deepEqual(planets.map(x => x['data-model']), ids);
  assert.deepEqual(planets.map(x => x.fill), rings.map(x => x.stroke));
});

test('all planetary markers lie on their exact matching ellipse', () => {
  const rings = elements('ellipse', 'orbit');
  const planets = elements('circle', 'planet');
  for (let i = 0; i < rings.length; i++) {
    const orbit = rings[i];
    const planet = planets[i];
    const [whole, deg, rotationX, rotationY] = orbit.transform.match(
      /^rotate\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/
    ) || [];
    assert.ok(whole, 'explicit center-of-ellipse rotation is required');
    assert.equal(Number(rotationX), Number(orbit.cx));
    assert.equal(Number(rotationY), Number(orbit.cy));
    const theta = Number(deg) * Math.PI / 180;
    const dx = Number(planet.cx) - Number(orbit.cx);
    const dy = Number(planet.cy) - Number(orbit.cy);
    const unrotatedX = dx * Math.cos(theta) + dy * Math.sin(theta);
    const unrotatedY = -dx * Math.sin(theta) + dy * Math.cos(theta);
    const circleEquation = (unrotatedX / Number(orbit.rx)) ** 2 +
      (unrotatedY / Number(orbit.ry)) ** 2;
    assert.ok(Math.abs(circleEquation - 1) < 0.00005,
      `${orbit['data-model']}: point off orbit, equation=${circleEquation}`);
  }
});

test('sun and all five ellipses share a single center, inside the panel', () => {
  const rings = elements('ellipse', 'orbit');
  const suns = elements('circle', 'sun');
  const glows = elements('circle', 'sun-glow');
  assert.equal(suns.length, 1);
  assert.equal(glows.length, 1);
  const x = Number(suns[0].cx);
  const y = Number(suns[0].cy);
  assert.equal(x, Number(glows[0].cx));
  assert.equal(y, Number(glows[0].cy));
  assert.ok(x >= 1150 && x <= 1220 && y >= 220 && y <= 280);
  for (const ring of rings) {
    assert.equal(Number(ring.cx), x);
    assert.equal(Number(ring.cy), y);
    const deg = Number(ring.transform.match(/rotate\((-?\d+)/)?.[1]);
    const theta = deg * Math.PI / 180;
    const rx = Number(ring.rx);
    const ry = Number(ring.ry);
    const width = Math.hypot(rx * Math.cos(theta), ry * Math.sin(theta));
    const height = Math.hypot(rx * Math.sin(theta), ry * Math.cos(theta));
    assert.ok(x - width > 970 && x + width < 1400,
      `${ring['data-model']}: ring spills into text or off right edge`);
    assert.ok(y - height > 100 && y + height < 420,
      `${ring['data-model']}: ring spills vertically off illustration panel`);
  }
  const planets = elements('circle', 'planet');
  assert.ok(planets.some(p => Number(p.cx) < x));
  assert.ok(planets.some(p => Number(p.cx) > x));
  assert.ok(planets.some(p => Number(p.cy) < y));
  assert.ok(planets.some(p => Number(p.cy) > y));
});

test('five reference cards use a centered three-over-two arrangement', () => {
  const cards = [...svg.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\)">\s*<rect width="211"/g)]
    .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
  assert.equal(cards.length, 5);
  const top = cards.filter(c => c.y === 276);
  const bottom = cards.filter(c => c.y === 362);
  assert.equal(top.length, 3);
  assert.equal(bottom.length, 2);
  const center = row => (Math.min(...row.map(c => c.x)) +
    Math.max(...row.map(c => c.x)) + 211) / 2;
  assert.equal(center(top), center(bottom));
});
