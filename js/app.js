import { initialBearing, haversineKm, cardinal, formatDistance, funFacts } from './geo.js';
import { Compass, SmoothRotator } from './compass.js';
import { SUGGESTIONS, geocode, shareUrl, targetFromUrl, NotFoundError } from './search.js';

const $ = (id) => document.getElementById(id);

const state = {
  origin: null,   // { lat, lon, label }
  target: null,   // { lat, lon, name }
  heading: null,  // device heading or null (north-up)
  unit: localStorage.getItem('unit') || 'km',
  facts: [],
  factIndex: 0,
};

const dialRotator = new SmoothRotator($('dial'));
const needleRotator = new SmoothRotator($('needle'));

// ---------- compass dial (ticks + cardinal labels) ----------

function buildDial() {
  const svg = $('dial');
  const ns = 'http://www.w3.org/2000/svg';
  for (let deg = 0; deg < 360; deg += 6) {
    const major = deg % 90 === 0;
    const line = document.createElementNS(ns, 'line');
    const r1 = major ? 84 : 88;
    const a = (deg * Math.PI) / 180;
    line.setAttribute('x1', 100 + r1 * Math.sin(a));
    line.setAttribute('y1', 100 - r1 * Math.cos(a));
    line.setAttribute('x2', 100 + 93 * Math.sin(a));
    line.setAttribute('y2', 100 - 93 * Math.cos(a));
    if (major) line.setAttribute('class', 'major');
    svg.appendChild(line);
  }
  for (const [label, deg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const a = (deg * Math.PI) / 180;
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', 100 + 70 * Math.sin(a));
    text.setAttribute('y', 100 - 70 * Math.cos(a));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    if (label === 'N') text.setAttribute('class', 'north');
    text.textContent = label;
    svg.appendChild(text);
  }
}

// ---------- rendering ----------

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function update() {
  const { origin, target, heading } = state;

  // Rotate: dial mirrors the real world (counter-rotates with the device);
  // needle points at the target relative to the screen.
  dialRotator.set(heading === null ? 0 : -heading);

  if (!target) {
    needleRotator.set(heading === null ? 0 : -heading); // idle: point north
    return;
  }

  $('readout').hidden = false;
  $('placeName').textContent = target.name;

  if (!origin) {
    $('distance').textContent = '…';
    $('direction').textContent = 'waiting for your location';
    return;
  }

  const bearing = initialBearing(origin.lat, origin.lon, target.lat, target.lon);
  const km = haversineKm(origin.lat, origin.lon, target.lat, target.lon);

  needleRotator.set(heading === null ? bearing : bearing - heading);
  $('distance').textContent = formatDistance(km, state.unit);
  $('direction').textContent = `${cardinal(bearing)} (${Math.round(bearing)}°)`;

  state.facts = funFacts(km);
  state.factIndex = state.factIndex % Math.max(1, state.facts.length);
  renderFact();
}

function renderFact() {
  $('funFact').textContent = state.facts[state.factIndex] || '';
}

function nextFact() {
  if (state.facts.length > 1) {
    state.factIndex = (state.factIndex + 1) % state.facts.length;
    renderFact();
  }
}

// ---------- origin (geolocation + manual) ----------

function setOrigin(origin) {
  state.origin = origin;
  $('originLabel').textContent = `From: ${origin.label}`;
  update();
}

function requestGeolocation() {
  if (!('geolocation' in navigator)) {
    $('originLabel').textContent = 'Location unavailable.';
    $('originForm').hidden = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => setOrigin({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      label: 'your location',
    }),
    () => {
      $('originLabel').textContent = 'Location denied — choose a starting point:';
      $('originForm').hidden = false;
      $('originInput').focus();
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
  );
}

// ---------- target ----------

function setTarget(target) {
  state.target = target;
  state.factIndex = 0;
  setStatus('');
  update();
}

async function searchTarget(query) {
  setStatus(`Finding “${query}”…`);
  try {
    setTarget(await geocode(query));
  } catch (err) {
    if (err instanceof NotFoundError) {
      setStatus(`Couldn’t find that — try adding a country (e.g. “Tulum, Mexico”).`, true);
    } else {
      setStatus('Search is unreachable right now — check your connection and try again.', true);
    }
  }
}

// ---------- compass ----------

const compass = new Compass((heading) => {
  state.heading = heading;
  $('compassMode').hidden = heading !== null;
  update();
});

async function startCompass() {
  const live = await compass.start();
  $('compassMode').hidden = live;
  $('enableCompass').hidden = true;
}

function initCompass() {
  if (Compass.needsPermission()) {
    // iOS: needs a tap. Show the button; north-up until granted.
    $('enableCompass').hidden = false;
    $('compassMode').hidden = false;
    $('enableCompass').addEventListener('click', startCompass);
  } else {
    startCompass();
  }
}

// ---------- wiring ----------

function init() {
  buildDial();

  $('unitToggle').textContent = state.unit;
  $('unitToggle').addEventListener('click', () => {
    state.unit = state.unit === 'km' ? 'mi' : 'km';
    localStorage.setItem('unit', state.unit);
    $('unitToggle').textContent = state.unit;
    update();
  });

  const chips = $('chips');
  for (const s of SUGGESTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s.name;
    b.addEventListener('click', () => setTarget(s));
    chips.appendChild(b);
  }

  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('searchInput').value.trim();
    if (q) searchTarget(q);
  });

  $('changeOrigin').addEventListener('click', () => {
    $('originForm').hidden = false;
    $('originInput').focus();
  });
  $('originForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('originInput').value.trim();
    if (!q) return;
    setStatus(`Setting start to “${q}”…`);
    try {
      const place = await geocode(q);
      setOrigin({ lat: place.lat, lon: place.lon, label: place.name });
      $('originForm').hidden = true;
      setStatus('');
    } catch {
      setStatus('Couldn’t find that starting point — try another name.', true);
    }
  });

  $('funFact').addEventListener('click', nextFact);
  setInterval(nextFact, 6000);

  $('shareBtn').addEventListener('click', async () => {
    if (!state.target) return;
    const url = shareUrl(state.target);
    if (navigator.share) {
      try { await navigator.share({ title: `Which way is ${state.target.name}?`, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied to clipboard ✓');
      setTimeout(() => setStatus(''), 2500);
    }
  });

  const shared = targetFromUrl();
  if (shared) setTarget(shared);

  requestGeolocation();
  initCompass();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* PWA optional */ });
  }
}

init();
