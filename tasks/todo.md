# WhereIsIt.com — Build Plan

- [x] Project scaffolding (git, package.json, spec)
- [x] js/geo.js — bearing, haversine, cardinal, formatting, fun facts (pure)
- [x] tests/geo.test.mjs — unit tests against known values (12/12 pass)
- [x] index.html — structure: search, chips, compass, readout, footer
- [x] css/style.css — modern minimal, dark/light via prefers-color-scheme
- [x] js/compass.js — device orientation (iOS + Android), smoothing, north-up fallback
- [x] js/search.js — Nominatim geocoding, chips, share links
- [x] js/app.js — state, geolocation + manual origin, URL params, readout, units
- [x] PWA — manifest, service worker, icons
- [x] Verify — unit tests + headless-Chrome end-to-end drive
- [x] Commit

## Review
Built and verified 2026-07-08. End-to-end drive in headless Chrome (geolocation
fixture = London): chips, live Nominatim search, unit toggle + persistence,
share URL params, manual origin, not-found + bad-param handling — all pass with
zero page errors. Golden value held: London→NYC = 3,461 mi / 288° WNW.
One bug found & fixed during verification: `.search{display:flex}` overrode the
`hidden` attribute on the origin form → added `[hidden]{display:none!important}`.
Not verifiable headless: live needle rotation from the device sensor — needs a
real phone over HTTPS after deploy.
