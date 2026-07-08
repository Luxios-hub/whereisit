// Sun & moon ephemeris — azimuth/altitude for a time and place, plus moon
// phase. Formulas follow Astronomy Answers / SunCalc (accuracy ~0.5°, plenty
// for a compass marker). Pure functions, tested in tests/sky.test.mjs.

const RAD = Math.PI / 180;
const E = RAD * 23.4397; // obliquity of the ecliptic
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;

const toDays = (date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;

const rightAscension = (l, b) =>
  Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
const declination = (l, b) =>
  Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;

// Horizontal coordinates; azimuth here is from south, converted to
// degrees-from-north [0,360) at the API boundary.
const azimuthRad = (H, phi, dec) =>
  Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altitudeRad = (H, phi, dec) =>
  Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));

function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const L = M
    + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
    + RAD * 102.9372 + Math.PI;
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d) {
  const L = RAD * (218.316 + 13.176396 * d); // ecliptic longitude
  const M = RAD * (134.963 + 13.064993 * d); // mean anomaly
  const F = RAD * (93.272 + 13.229350 * d);  // mean distance
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const dist = 385001 - 20905 * Math.cos(M); // km
  return { dec: declination(l, b), ra: rightAscension(l, b), dist };
}

function toHorizontal(coords, date, lat, lng) {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const H = siderealTime(toDays(date), lw) - coords.ra;
  const az = (azimuthRad(H, phi, coords.dec) / RAD + 180 + 360) % 360;
  const alt = altitudeRad(H, phi, coords.dec) / RAD;
  return { azimuth: az, altitude: alt };
}

// { azimuth: deg from north cw, altitude: deg above horizon }
export function sunPosition(date, lat, lng) {
  return toHorizontal(sunCoords(toDays(date)), date, lat, lng);
}

export function moonPosition(date, lat, lng) {
  return toHorizontal(moonCoords(toDays(date)), date, lat, lng);
}

// { fraction: 0..1 illuminated, phase: 0 new → 0.25 first quarter → 0.5 full → 0.75 last }
export function moonIllumination(date) {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000; // km, earth–sun

  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec)
    + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec)
    - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));

  return {
    fraction: (1 + Math.cos(inc)) / 2,
    phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
  };
}

// SVG path for the lit part of a moon of radius r centered at (cx, cy).
// Standard two-arc construction: outer semicircle on the lit side, elliptical
// terminator whose x-semiaxis follows cos(2π·phase).
export function moonPhasePath(cx, cy, r, phase) {
  const f = Math.cos(2 * Math.PI * phase); // 1 new → 0 quarter → -1 full
  const rx = Math.abs(f) * r;
  const rightLit = phase <= 0.5; // waxing: right side lit (northern hemisphere)
  const outerSweep = rightLit ? 1 : 0;
  const termSweep = (f > 0) === rightLit ? 0 : 1;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r}`
    + ` A ${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
}
