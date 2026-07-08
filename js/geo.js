// Pure geo math + formatting. No DOM, no network — unit tested in tests/geo.test.mjs.

const R_EARTH_KM = 6371.0088;

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

// Great-circle initial bearing from point 1 to point 2, degrees clockwise from north [0, 360).
export function initialBearing(lat1, lon1, lat2, lon2) {
  const f1 = toRad(lat1);
  const f2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Great-circle distance in km (haversine).
export function haversineKm(lat1, lon1, lat2, lon2) {
  const f1 = toRad(lat1);
  const f2 = toRad(lat2);
  const df = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a =
    Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const WINDS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

// 16-wind compass point for a bearing in degrees.
export function cardinal(bearing) {
  const i = Math.round(((bearing % 360) + 360) % 360 / 22.5) % 16;
  return WINDS[i];
}

const KM_PER_MILE = 1.609344;

// "1,432 km" / "890 mi". Under 10 km/mi shows one decimal.
export function formatDistance(km, unit) {
  const value = unit === 'mi' ? km / KM_PER_MILE : km;
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  const text = rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 10 ? 1 : 0,
  });
  return `${text} ${unit === 'mi' ? 'mi' : 'km'}`;
}

// Shortest signed angular difference a→b in degrees, result in (-180, 180].
export function angleDelta(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function fmtInt(n) {
  return Math.round(n).toLocaleString('en-US');
}

// Human-scale comparisons for a distance. Returns a list; the app rotates through them.
export function funFacts(km) {
  const facts = [];

  if (km >= 150) {
    // ~900 km/h cruise + 45 min taxi/climb overhead.
    const hours = km / 900 + 0.75;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    facts.push(`≈ ${h > 0 ? `${h}h ` : ''}${m}m by plane`);
  } else if (km >= 1) {
    const hours = km / 80;
    const h = Math.floor(hours);
    const m = Math.max(1, Math.round((hours - h) * 60));
    facts.push(`≈ ${h > 0 ? `${h}h ` : ''}${m}m by car`);
  }

  if (km >= 0.105) {
    facts.push(`${fmtInt(km / 0.105)} football fields end to end`);
  }
  if (km >= 42.195) {
    facts.push(`${fmtInt(km / 42.195)} marathons back to back`);
  }
  if (km >= 8.849) {
    facts.push(`${fmtInt(km / 8.849)} Mount Everests stacked up`);
  }
  if (km >= 1000) {
    const pct = (km / 40075) * 100;
    facts.push(`${pct < 10 ? pct.toFixed(1) : Math.round(pct)}% of the way around Earth`);
  }

  return facts;
}
