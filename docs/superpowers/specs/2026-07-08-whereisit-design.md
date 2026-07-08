# WhereIsIt.com — Design Spec (2026-07-08)

## What it is
A one-screen static web app. The user searches any place on Earth; a compass on
screen points at it. On phones the needle uses the device orientation sensor so it
physically points toward the destination as the user rotates. Shows distance,
cardinal direction, and a fun fact.

## User flow
1. Page loads → browser geolocation prompt. Fallback: "Choose starting location"
   (typed, geocoded). Standard app pattern.
2. User searches a place or taps a suggested chip (Everest, Tulum, Tokyo, Machu
   Picchu, Paris, New York — hardcoded coordinates so they work instantly).
3. On phones, compass/motion permission is requested (iOS needs a user tap).
   Needle rotation = bearing − device heading, smoothed.
4. Readout: place name, distance (km/mi toggle, persisted), cardinal direction,
   rotating fun fact.
5. Desktop / no sensor: north-up compass, needle fixed at the bearing.

## Math
- Direction: great-circle initial bearing.
- Distance: haversine.
- Both live in `js/geo.js` as pure functions with unit tests
  (`node --test`, known values: London→NYC ≈ 5,570 km / bearing ≈ 288°).

## Search & data
- Geocoding: OpenStreetMap Nominatim (`format=jsonv2`), no API key.
  Attribution line in footer. One request per submitted search (no autocomplete
  spam), which complies with the usage policy.
- No backend, no database.

## Features (v1)
- Search + suggested destination chips
- km/miles toggle (localStorage)
- Shareable links: `/?to=<name>&lat=<lat>&lng=<lng>` (coords embedded → instant load)
- Fun distance facts (flight time, football fields, marathons, Everests)
- Great-circle "why is it pointing there?" expandable note
- PWA: manifest + service worker (cache-first app shell; works offline for last state)
- Dark/light theme via `prefers-color-scheme`

## Architecture
```
index.html            page structure
css/style.css         styles + themes
js/geo.js             bearing/distance/facts (pure, tested)
js/compass.js         sensors + needle animation (iOS/Android differences, smoothing)
js/search.js          Nominatim geocoding, chips, share links
js/app.js             glue: state, URL params, geolocation, readout
manifest.webmanifest  PWA manifest
sw.js                 service worker
icons/                app icons
tests/geo.test.mjs    unit tests
```

## Error handling
- Location denied → prompt for manual starting location.
- Compass unavailable/denied → north-up mode with a notice.
- Place not found → suggest adding a country.
- Geocoding fetch failure → clear error message, app keeps working.

## Deployment
Static hosting (Cloudflare Pages / Netlify), free tier, free HTTPS (required for
geolocation + orientation APIs). Point whereisit.com at it.
