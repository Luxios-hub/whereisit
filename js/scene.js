// Procedural night-sky scene: star sprites are generated once on offscreen
// canvases (a soft dot and a 4-point glint), then blitted with individual
// twinkle phases. Cheap to run, unique every load.

function makeDotSprite(size, hue) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `hsla(${hue}, 60%, 92%, 1)`);
  grad.addColorStop(0.4, `hsla(${hue}, 55%, 80%, 0.5)`);
  grad.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeGlintSprite(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = size / 22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(r, size * 0.06); g.lineTo(r, size * 0.94);
  g.moveTo(size * 0.06, r); g.lineTo(size * 0.94, r);
  g.stroke();
  return c;
}

export function initScene(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dot = makeDotSprite(24, 220);
  const warmDot = makeDotSprite(24, 40);
  const glint = makeGlintSprite(44);
  let stars = [];
  let w = 0, h = 0, dpr = 1;
  // Parallax: target offset set from outside, eased in the draw loop.
  // Bigger (closer) stars drift more.
  let px = 0, py = 0, tx = 0, ty = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.width = Math.round(innerWidth * dpr);
    h = canvas.height = Math.round(innerHeight * dpr);
    const count = Math.round((innerWidth * innerHeight) / 6500);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.9,
      s: (Math.random() ** 2.2) * 8 * dpr + 1.5 * dpr,
      a: 0.25 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 1.1,
      sprite: Math.random() < 0.06 ? glint : (Math.random() < 0.25 ? warmDot : dot),
    }));
  }

  function draw(t) {
    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;
    ctx.clearRect(0, 0, w, h);
    for (const st of stars) {
      const tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(st.phase + t * 0.001 * st.speed);
      const depth = st.s / (9 * dpr);
      ctx.globalAlpha = st.a * tw;
      ctx.drawImage(st.sprite, st.x - st.s / 2 + px * depth * dpr, st.y - st.s / 2 + py * depth * dpr, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }

  let raf;
  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  resize();
  addEventListener('resize', resize);

  // Desktop: follow the pointer. Mobile: follow device tilt (fires without
  // permission on Android; on iOS once the compass permission is granted).
  addEventListener('pointermove', (e) => {
    tx = (e.clientX / innerWidth - 0.5) * 26;
    ty = (e.clientY / innerHeight - 0.5) * 16;
  }, { passive: true });
  addEventListener('deviceorientation', (e) => {
    if (typeof e.gamma === 'number' && typeof e.beta === 'number') {
      tx = Math.max(-1, Math.min(1, e.gamma / 45)) * 22;
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 45)) * 14;
    }
  }, { passive: true });

  if (reduced) {
    draw(0);
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    });
  }
}
