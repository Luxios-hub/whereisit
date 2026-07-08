// Geocoding via OpenStreetMap Nominatim, suggested destinations, share links.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Hardcoded coordinates: chips work instantly and offline.
export const SUGGESTIONS = [
  { name: 'Mount Everest', lat: 27.9881, lon: 86.925 },
  { name: 'Tulum', lat: 20.2114, lon: -87.4654 },
  { name: 'Tokyo', lat: 35.6764, lon: 139.65 },
  { name: 'Machu Picchu', lat: -13.1631, lon: -72.545 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
];

export class NotFoundError extends Error {}

// Resolve a free-text query to { name, lat, lon }.
// Throws NotFoundError when Nominatim has no match; rethrows network errors.
export async function geocode(query) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const results = await res.json();
  if (!results.length) throw new NotFoundError(query);
  const r = results[0];
  return {
    name: shortName(r),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  };
}

// "Tulum, Quintana Roo, Mexico" from Nominatim's verbose display_name.
function shortName(result) {
  const parts = (result.display_name || '').split(', ');
  if (parts.length <= 3) return result.display_name || result.name;
  return [parts[0], parts[parts.length - 1]].join(', ');
}

// Build a shareable URL for the current target.
export function shareUrl(target) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('to', target.name);
  url.searchParams.set('lat', target.lat.toFixed(5));
  url.searchParams.set('lng', target.lon.toFixed(5));
  return url.toString();
}

// Parse ?to=&lat=&lng= from the current URL → target or null.
export function targetFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const to = p.get('to');
  const lat = parseFloat(p.get('lat'));
  const lng = parseFloat(p.get('lng'));
  if (to && Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { name: to, lat, lon: lng };
  }
  return null;
}
