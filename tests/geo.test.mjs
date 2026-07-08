import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialBearing,
  haversineKm,
  cardinal,
  formatDistance,
  angleDelta,
  funFacts,
} from '../js/geo.js';

const LONDON = [51.5074, -0.1278];
const NYC = [40.7128, -74.006];
const TOKYO = [35.6764, 139.65];

test('haversine: London → New York ≈ 5,570 km', () => {
  const d = haversineKm(...LONDON, ...NYC);
  assert.ok(Math.abs(d - 5570) < 20, `got ${d}`);
});

test('haversine: same point is 0', () => {
  assert.equal(haversineKm(...LONDON, ...LONDON), 0);
});

test('haversine: 10° along the equator ≈ 1,112 km', () => {
  const d = haversineKm(0, 0, 0, 10);
  assert.ok(Math.abs(d - 1112) < 2, `got ${d}`);
});

test('bearing: London → New York ≈ 288°', () => {
  const b = initialBearing(...LONDON, ...NYC);
  assert.ok(Math.abs(b - 288) < 1.5, `got ${b}`);
});

test('bearing: NYC → Tokyo points north-ish (great-circle surprise)', () => {
  const b = initialBearing(...NYC, ...TOKYO);
  assert.ok(b > 320 || b < 40, `got ${b}`);
});

test('bearing: due east on the equator is 90°', () => {
  assert.ok(Math.abs(initialBearing(0, 0, 0, 10) - 90) < 0.001);
});

test('bearing: due north is 0°', () => {
  assert.ok(Math.abs(initialBearing(0, 0, 10, 0)) < 0.001);
});

test('cardinal points', () => {
  assert.equal(cardinal(0), 'N');
  assert.equal(cardinal(359), 'N');
  assert.equal(cardinal(45), 'NE');
  assert.equal(cardinal(90), 'E');
  assert.equal(cardinal(135), 'SE');
  assert.equal(cardinal(180), 'S');
  assert.equal(cardinal(270), 'W');
  assert.equal(cardinal(292.5), 'WNW');
});

test('formatDistance', () => {
  assert.equal(formatDistance(1432, 'km'), '1,432 km');
  assert.equal(formatDistance(1432, 'mi'), '890 mi');
  assert.equal(formatDistance(3.14, 'km'), '3.1 km');
  assert.equal(formatDistance(0, 'km'), '0 km');
});

test('angleDelta shortest path', () => {
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(10, 350), -20);
  assert.equal(angleDelta(0, 180), 180);
  assert.equal(angleDelta(90, 90), 0);
});

test('funFacts: long haul has flight time and Earth %', () => {
  const facts = funFacts(9000);
  assert.ok(facts.some((f) => f.includes('by plane')));
  assert.ok(facts.some((f) => f.includes('around Earth')));
  assert.ok(facts.length >= 3);
});

test('funFacts: short distance uses car, no marathons if too short', () => {
  const facts = funFacts(20);
  assert.ok(facts.some((f) => f.includes('by car')));
  assert.ok(!facts.some((f) => f.includes('marathons')));
});
