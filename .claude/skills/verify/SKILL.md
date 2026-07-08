---
name: verify
description: How to build, run, and verify the whereisit static site end-to-end
---

# Verifying whereisit

Static site, no build step. Unit tests cover the geo math; everything else is
verified by driving the page in headless Chrome.

## Unit tests
```
node --test tests/geo.test.mjs
```

## Drive the real page
Playwright browsers are already installed on this machine; use `playwright-core`
pointed at system Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`).
Serve the repo root with any static server (a 15-line `node:http` server works;
`npx serve` also fine). Geolocation and clipboard need a browser context with
`permissions: ['geolocation']` and a `geolocation:` fixture (e.g. London
51.5074, -0.1278).

Flows worth driving:
- Load `/` → `#originLabel` becomes "From: your location", 6 chips render.
- Click a chip (offline coords) → readout: name, distance, direction, fun fact.
- Search a real place → hits live Nominatim (keep to a couple of requests).
- Unit toggle → distance flips km/mi, persists via localStorage across reload.
- Share params: `/?to=New%20York&lat=40.7128&lng=-74.006` from London must show
  **3,461 mi / 5,570 km, WNW (288°)** — golden value.
- Probes: gibberish search → "Couldn't find that" status; bad params
  (`lat=999&lng=abc`) → readout stays hidden; check `page.on('pageerror')` is clean.

## Gotchas
- `hidden` attribute is overridden by class display rules — a global
  `[hidden] { display: none !important; }` guards this; don't remove it.
- Compass sensor can't be tested headless (no DeviceOrientation in Chrome
  headless). Live-needle behavior needs a real phone over HTTPS.
