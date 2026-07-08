import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition, moonPosition, moonIllumination, moonPhasePath } from '../js/sky.js';

const LONDON = [51.5074, -0.1278];

test('sun: near solar noon in London on the June solstice, sun is due south and high', () => {
  const { azimuth, altitude } = sunPosition(new Date('2026-06-21T12:00:00Z'), ...LONDON);
  assert.ok(Math.abs(azimuth - 180) < 12, `az ${azimuth}`);
  assert.ok(altitude > 55 && altitude < 66, `alt ${altitude}`);
});

test('sun: below horizon at midnight in London', () => {
  const { altitude } = sunPosition(new Date('2026-06-21T00:00:00Z'), ...LONDON);
  assert.ok(altitude < -5, `alt ${altitude}`);
});

test('sun: rises due east on the equator at the equinox', () => {
  const { azimuth, altitude } = sunPosition(new Date('2026-03-20T06:00:00Z'), 0, 0);
  assert.ok(Math.abs(azimuth - 90) < 10, `az ${azimuth}`);
  assert.ok(Math.abs(altitude) < 10, `alt ${altitude}`);
});

test('moon: position is in valid ranges', () => {
  const { azimuth, altitude } = moonPosition(new Date('2026-07-08T18:00:00Z'), ...LONDON);
  assert.ok(azimuth >= 0 && azimuth < 360);
  assert.ok(altitude >= -90 && altitude <= 90);
});

test('moon illumination: fraction and phase are consistent', () => {
  for (const iso of ['2026-01-05', '2026-04-14', '2026-07-08', '2026-11-23']) {
    const { fraction, phase } = moonIllumination(new Date(iso + 'T12:00:00Z'));
    assert.ok(fraction >= 0 && fraction <= 1);
    assert.ok(phase >= 0 && phase < 1);
    const expected = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    assert.ok(Math.abs(fraction - expected) < 0.02, `f ${fraction} vs ${expected}`);
  }
});

test('moon illumination: phase advances over a week', () => {
  const p1 = moonIllumination(new Date('2026-07-01T00:00:00Z')).phase;
  const p2 = moonIllumination(new Date('2026-07-08T00:00:00Z')).phase;
  assert.ok(Math.abs(((p2 - p1 + 1) % 1) - 7 / 29.53) < 0.03, `Δ ${(p2 - p1 + 1) % 1}`);
});

test('moonPhasePath: quarter moon terminator is a straight-ish line (rx≈0)', () => {
  const path = moonPhasePath(0, 0, 10, 0.25);
  assert.match(path, /A 10 10 0 0 1 0 10/); // right semicircle lit
  const rx = parseFloat(path.split(' A ')[1].split(' ')[0] === '10' ? path.split(' A ')[2] : path.split(' A ')[1]);
  assert.ok(Math.abs(rx) < 0.01, path);
});

test('moonPhasePath: full moon covers whole disc', () => {
  const path = moonPhasePath(0, 0, 10, 0.5);
  assert.ok(path.includes('A 10 10 0 0 1') || path.includes('A 10 10 0 0 0'));
});
