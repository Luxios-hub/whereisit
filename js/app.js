import { initialBearing, haversineKm, cardinal, formatDistance, funFacts } from './geo.js';
import { Compass, SmoothRotator } from './compass.js';
import { SUGGESTIONS, geocode, shareUrl, targetFromUrl, NotFoundError } from './search.js';
import { initScene } from './scene.js';

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

// Engraved dial: generated tick ring (2°/10°/30°), degree numerals, an
// 8-point compass rose, and embossed cardinal letters.
function buildDial() {
  const svg = $('dial');
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };
  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [100 + r * Math.sin(a), 100 - r * Math.cos(a)];
  };

  for (let deg = 0; deg < 360; deg += 2) {
    const major = deg % 30 === 0;
    const mid = !major && deg % 10 === 0;
    const r1 = major ? 74 : mid ? 77.5 : 79.5;
    const [x1, y1] = pt(r1, deg);
    const [x2, y2] = pt(82, deg);
    el('line', {
      x1, y1, x2, y2,
      stroke: major ? '#c9a961' : mid ? '#6d7894' : '#454f68',
      'stroke-width': major ? 1.5 : mid ? 1 : 0.55,
    });
  }

  for (let deg = 0; deg < 360; deg += 30) {
    if (deg % 90 === 0) continue;
    const [x, y] = pt(68, deg);
    el('text', {
      x, y, class: 'deg-num', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      transform: `rotate(${deg} ${x} ${y})`,
    }).textContent = String(deg);
  }

  // 8-point rose: long points at cardinals, short at intercardinals; each point
  // split into a lit and a shaded half for depth.
  for (const [deg, len] of [[0, 46], [90, 46], [180, 46], [270, 46], [45, 30], [135, 30], [225, 30], [315, 30]]) {
    const [tx, ty] = pt(len, deg);
    const [lx, ly] = pt(6.5, deg - 90);
    const [rx, ry] = pt(6.5, deg + 90);
    el('polygon', { points: `${tx},${ty} ${lx},${ly} 100,100`, fill: deg % 90 === 0 ? '#39435f' : '#2b344c' });
    el('polygon', { points: `${tx},${ty} ${rx},${ry} 100,100`, fill: deg % 90 === 0 ? '#222a40' : '#1a2136' });
  }
  el('circle', { cx: 100, cy: 100, r: 4.5, fill: 'none', stroke: '#c9a961', 'stroke-width': 0.8, opacity: 0.8 });

  for (const [label, deg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const [x, y] = pt(58, deg);
    const attrs = {
      x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      transform: `rotate(${deg} ${x} ${y})`,
    };
    el('text', { ...attrs, y: y + 0.9, class: 'cardinal-shadow' }).textContent = label;
    el('text', { ...attrs, class: label === 'N' ? 'cardinal north' : 'cardinal' }).textContent = label;
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
  initScene($('stars'));
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
