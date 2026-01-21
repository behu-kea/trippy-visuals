const canvas = document.getElementById("visuals");
const ctx = canvas.getContext("2d", { alpha: false });

const studentIn = document.getElementById("studentIn");
const trackIn = document.getElementById("trackIn");

const studentOut = document.getElementById("studentOut");
const trackOut = document.getElementById("trackOut");
const statusOut = document.getElementById("statusOut");

const startBtn = document.getElementById("startBtn");

const hud = document.querySelector(".hud");
const panel = document.querySelector(".panel");
const escHint = document.getElementById("escHint");

let rafId = null;
let startedAt = 0;

const scenes = [
  "Kaleido",
  "Plasma",
  "Tunnel",
  "Aurora",
  "Orbitals",
  "Moire",
  "Dots",
  "Spirals",
  "Waves",
  "Particles",
  "Grid",
  "Petals",
  "Nebula",
];
let sceneIndex = 0;
let sceneStartMs = 0;
let transitionFrom = 0;
let transitionTo = 0;
let transitionStartMs = null;
const sceneDurationMs = 32000;
const transitionDurationMs = 3800;

// Global pacing control (lower = slower / calmer)
const SPEED = 0.6;

let sceneBag = [];

let lastW = 0;
let lastH = 0;

function setStatus(text) {
  statusOut.textContent = text;
}

function setRunningUi(running) {
  panel.classList.toggle("hidden", running);
  escHint.classList.toggle("hidden", !running);
}

function now() {
  return performance.now();
}

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);

  if (w === lastW && h === lastH) return;

  lastW = w;
  lastH = h;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function fract(x) {
  return x - Math.floor(x);
}

function noise1(x) {
  return fract(Math.sin(x) * 43758.5453123);
}

function computeFeatures(dt) {
  // Time-driven “pseudo audio” features so visuals feel rhythmic without audio.
  const n = noise1(dt * 0.45) * 2 - 1;
  const n2 = noise1(dt * 1.05 + 10.0) * 2 - 1;

  const bass = clamp01(
    0.3 + 0.18 * Math.sin(dt * 0.75) + 0.08 * Math.sin(dt * 2.1) + 0.05 * n,
  );
  const mids = clamp01(
    0.26 +
      0.2 * Math.sin(dt * 0.62 + 1.2) +
      0.06 * Math.sin(dt * 1.7 + 0.4) +
      0.05 * n2,
  );
  const treble = clamp01(
    0.22 +
      0.22 * Math.sin(dt * 1.15 + 2.2) +
      0.06 * Math.sin(dt * 3.4) +
      0.06 * (n - n2),
  );

  const level = clamp01(0.52 * bass + 0.33 * mids + 0.15 * treble);
  const beat = smoothstep(0.48, 0.78, bass);
  const wave = clamp01(
    0.25 + 0.65 * Math.abs(Math.sin(dt * (1.05 + mids * 0.6))),
  );

  return { bass, mids, treble, level, beat, wave };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function refillSceneBag(excludeIndex) {
  sceneBag = [];
  for (let i = 0; i < scenes.length; i++) {
    if (i !== excludeIndex) sceneBag.push(i);
  }
  shuffleInPlace(sceneBag);
}

function pickRandomNextScene(excludeIndex) {
  // Avoid immediate repeats and cycle through all scenes before repeating.
  sceneBag = sceneBag.filter((i) => i !== excludeIndex);
  if (sceneBag.length === 0) refillSceneBag(excludeIndex);
  return sceneBag.pop();
}

function beginTransition(targetIndex, tMs) {
  if (transitionStartMs !== null) return;
  if (targetIndex === sceneIndex) return;

  transitionFrom = sceneIndex;
  transitionTo = targetIndex;
  transitionStartMs = tMs;
}

function renderSceneKaleido(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 24 + a.level * 100) % 360;
  ctx.fillStyle = hsl(hueBase, 50, 6, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  const energy = 0.25 + a.level * 0.6;
  const spin = 0.1 + a.treble * 0.5;
  const pulse = 0.5 + a.beat * 0.6;

  const layers = 7;
  const petals = 10 + Math.floor(a.mids * 12);
  const baseR = Math.min(w, h) * (0.18 + 0.04 * pulse);

  for (let L = 0; L < layers; L++) {
    const k = L / (layers - 1);
    const ringR = baseR * (1.0 + k * (1.4 + a.level * 0.9));
    const thickness =
      (Math.min(w, h) * 0.004 + k * Math.min(w, h) * 0.009) *
      (0.6 + a.beat * 0.9);

    ctx.save();
    ctx.rotate(dt * spin * (0.5 + k * 0.7) * (L % 2 ? 1 : -1));

    for (let i = 0; i < petals; i++) {
      const p = i / petals;
      const ang = p * Math.PI * 2;
      const wobble =
        Math.sin(dt * (0.7 + k * 1.0) + p * 14) * (0.06 + 0.25 * a.wave);
      const rr = ringR * (1 + wobble * (0.14 + a.bass * 0.25));

      const hue = (hueBase + 120 * k + p * 180 + a.treble * 90) % 360;
      const sat = 58 + a.treble * 18;
      const light = 42 + a.level * 18;
      const aa = 0.18 + 0.22 * (1 - k) + 0.12 * a.beat;

      ctx.strokeStyle = hsl(hue, sat, light, aa);
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.arc(0, 0, rr, ang - 0.1, ang + 0.1);
      ctx.stroke();

      ctx.strokeStyle = hsl(
        (hue + 40) % 360,
        sat,
        light + 8,
        0.06 + 0.1 * a.treble,
      );
      ctx.lineWidth = Math.max(1, thickness * 0.25);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      ctx.lineTo(
        Math.cos(ang) * (rr + thickness * 14 * energy),
        Math.sin(ang) * (rr + thickness * 14 * energy),
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  const grid = 42;
  const maxR = Math.min(w, h) * (0.52 + a.level * 0.2);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < grid; i++) {
    const p = i / (grid - 1);
    const ang = p * Math.PI * 2;
    const rr =
      maxR * (0.55 + 0.45 * Math.sin(dt * (0.4 + a.mids * 0.5) + p * 5.0));
    const x = Math.cos(ang + dt * 0.14) * rr;
    const y = Math.sin(ang - dt * 0.12) * rr;

    const hue = (hueBase + p * 260 + a.bass * 80) % 360;
    ctx.fillStyle = hsl(hue, 62, 52, 0.03 + 0.06 * a.level);
    const r =
      (Math.min(w, h) * 0.02 + a.beat * Math.min(w, h) * 0.012) *
      (0.7 + 0.9 * Math.sin(dt + p * 11));
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
  ctx.restore();
}

function renderScenePlasma(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 14 + 140 + a.level * 110) % 360;
  ctx.fillStyle = hsl(hueBase, 50, 6, 1);
  ctx.fillRect(0, 0, w, h);

  // soft plasma blobs
  ctx.globalCompositeOperation = "screen";
  const blobs = 70;
  const s = Math.min(w, h);
  for (let i = 0; i < blobs; i++) {
    const p = i / blobs;
    const ang = dt * (0.22 + 0.5 * a.mids) + p * Math.PI * 2 * 3;
    const rad =
      s * (0.18 + 0.26 * p) * (0.88 + 0.22 * Math.sin(dt * 0.7 + p * 6));
    const cx = w * (0.5 + 0.28 * Math.cos(ang) * (0.7 + 0.25 * a.wave));
    const cy = h * (0.5 + 0.28 * Math.sin(ang * 0.9) * (0.7 + 0.25 * a.wave));
    const r = s * (0.06 + 0.12 * (1 - p)) * (0.8 + 0.45 * a.beat);

    const hue = (hueBase + 220 * p + 70 * Math.sin(dt * 0.9 + p * 8)) % 360;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hsl(hue, 68, 60, 0.14 + 0.14 * a.level));
    g.addColorStop(0.6, hsl((hue + 40) % 360, 72, 54, 0.06));
    g.addColorStop(1, hsl(hue, 75, 40, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // wavy scanlines
  ctx.globalCompositeOperation = "overlay";
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0022);
  const lines = 28;
  for (let i = 0; i < lines; i++) {
    const y0 = (i + 0.5) * (h / lines);
    const hue = (hueBase + i * 12 + a.treble * 70) % 360;
    ctx.strokeStyle = hsl(hue, 62, 52, 0.06 + 0.1 * a.level);
    ctx.beginPath();
    const amp = (h / lines) * (0.28 + 0.6 * a.wave);
    const f = 0.006 + 0.008 * a.mids;
    for (let x = 0; x <= w; x += Math.max(10, Math.floor(w / 90))) {
      const y = y0 + Math.sin(dt * (0.9 + a.bass * 0.6) + x * f + i) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function renderSceneTunnel(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 18 + 320 + a.level * 110) % 360;
  ctx.fillStyle = hsl(hueBase, 55, 5, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  const s = Math.min(w, h);
  const rings = 70;
  const rot = dt * (0.28 + a.treble * 0.55);
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < rings; i++) {
    const p = i / (rings - 1);
    const z = (p + ((dt * (0.08 + a.level * 0.1)) % 1)) % 1;
    const rr = s * (0.06 + z * 0.62);
    const thickness = (1 - z) * (s * 0.01) + 1;
    const hue = (hueBase + 200 * (1 - z) + 60 * Math.sin(dt + p * 6)) % 360;

    ctx.save();
    ctx.rotate(rot + z * 2.2);
    ctx.strokeStyle = hsl(hue, 70, 56, 0.05 + 0.18 * (1 - z));
    ctx.lineWidth = thickness;
    const sides = 3 + Math.floor(6 * (0.5 + 0.5 * Math.sin(dt * 0.7)));
    ctx.beginPath();
    for (let k = 0; k <= sides; k++) {
      const a2 = (k / sides) * Math.PI * 2;
      const x = Math.cos(a2) * rr;
      const y = Math.sin(a2) * rr;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // star streaks
  ctx.globalCompositeOperation = "lighter";
  const streaks = 180;
  for (let i = 0; i < streaks; i++) {
    const p = i / streaks;
    const ang = p * Math.PI * 2 + dt * 0.08;
    const rr = s * (0.12 + 0.42 * noise1(i * 13.7));
    const x0 = Math.cos(ang) * rr;
    const y0 = Math.sin(ang) * rr;
    const len = s * (0.05 + 0.08 * a.beat) * (0.2 + 0.7 * noise1(i * 3.1 + dt));
    const x1 = x0 * (1 + len / (rr + 1));
    const y1 = y0 * (1 + len / (rr + 1));
    const hue = (hueBase + 180 * noise1(i * 4.2)) % 360;
    ctx.strokeStyle = hsl(hue, 72, 62, 0.05 + 0.08 * a.treble);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  ctx.restore();
}

function renderSceneAurora(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 10 + 170 + a.level * 70) % 360;
  ctx.fillStyle = hsl(hueBase, 35, 6, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "screen";
  const bands = 7;
  for (let i = 0; i < bands; i++) {
    const p = i / (bands - 1);
    const yCenter = h * (0.2 + 0.6 * p);
    const amp = h * (0.04 + 0.05 * (1 - p)) * (0.75 + 0.4 * a.wave);
    const freq = 0.003 + 0.004 * (1 - p);
    const phase = dt * (0.4 + 0.3 * a.mids) + i * 1.7;

    const hue = (hueBase + 70 * p + 40 * Math.sin(dt * 0.6 + i)) % 360;
    const grad = ctx.createLinearGradient(0, yCenter - amp, 0, yCenter + amp);
    grad.addColorStop(0, hsl((hue + 25) % 360, 70, 55, 0));
    grad.addColorStop(0.5, hsl(hue, 75, 62, 0.14 + 0.1 * a.level));
    grad.addColorStop(1, hsl((hue + 25) % 360, 70, 55, 0));

    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, h * (0.01 - 0.006 * p));
    ctx.beginPath();
    const step = Math.max(18, Math.floor(w / 70));
    for (let x = -step; x <= w + step; x += step) {
      const y =
        yCenter +
        Math.sin(x * freq + phase) * amp +
        Math.sin(x * freq * 2.2 + phase * 1.3) * (amp * 0.18);
      if (x <= 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // subtle vignette
  ctx.globalCompositeOperation = "source-over";
  const vg = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    0,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.7,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function renderSceneOrbitals(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 14 + 250 + a.level * 80) % 360;
  ctx.fillStyle = hsl(hueBase, 40, 5, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  const s = Math.min(w, h);
  const count = 260;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const n = noise1(i * 13.13);
    const n2 = noise1(i * 7.77 + 4.2);
    const rr = s * (0.08 + 0.42 * n);
    const speed = (0.05 + 0.14 * n2) * (0.6 + 0.5 * a.level);
    const ang = dt * speed + i * 0.13;
    const wob = Math.sin(dt * 0.5 + i) * (s * 0.006) * (0.35 + a.wave * 0.6);

    const x = Math.cos(ang) * (rr + wob);
    const y = Math.sin(ang * (0.9 + 0.25 * n2)) * (rr - wob);

    const hue = (hueBase + 160 * n + 40 * Math.sin(dt * 0.4 + i * 0.02)) % 360;
    ctx.fillStyle = hsl(hue, 72, 62, 0.05 + 0.1 * a.treble);
    const r = Math.max(
      1,
      s * (0.0016 + 0.0032 * (1 - n)) * (0.7 + 0.6 * a.beat),
    );
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // soft central glow
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.55);
  g.addColorStop(0, hsl((hueBase + 20) % 360, 65, 55, 0.09 + 0.08 * a.level));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  ctx.restore();
}

function renderSceneMoire(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 12 + 40 + a.level * 90) % 360;
  ctx.fillStyle = hsl(hueBase, 35, 6, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "screen";
  const lines = 140;
  const spacing = h / lines;
  const phase = dt * (0.6 + 0.35 * a.mids);
  const amp = spacing * (1.3 + 1.8 * a.wave);

  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0016);
  for (let i = -10; i < lines + 10; i++) {
    const y0 = i * spacing;
    const hue = (hueBase + i * 1.7 + a.treble * 70) % 360;
    ctx.strokeStyle = hsl(hue, 62, 55, 0.04 + 0.06 * a.level);
    ctx.beginPath();
    const step = Math.max(18, Math.floor(w / 80));
    for (let x = -step; x <= w + step; x += step) {
      const yy =
        y0 +
        Math.sin(x * (0.007 + 0.003 * a.bass) + phase + i * 0.12) * amp +
        Math.sin(x * (0.015 + 0.004 * a.treble) - phase * 0.8 + i * 0.06) *
          (amp * 0.45);
      if (x <= 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function renderSceneDots(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 10 + 200 + a.level * 90) % 360;
  ctx.fillStyle = hsl(hueBase, 35, 5, 1);
  ctx.fillRect(0, 0, w, h);

  const s = Math.min(w, h);
  const step = Math.max(18, Math.floor(s * 0.045));
  const r0 = Math.max(1, s * 0.002);
  const t = dt * 0.6;

  ctx.globalCompositeOperation = "screen";
  for (let y = -step; y <= h + step; y += step) {
    const row = Math.floor(y / step);
    const xOff = (row % 2) * (step * 0.5);
    for (let x = -step; x <= w + step; x += step) {
      const xx = x + xOff;
      const nx = (xx / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const d = Math.sqrt(nx * nx + ny * ny);
      const wob =
        Math.sin(t + d * 4.0 + row * 0.2 + x * 0.01) * (0.45 + 0.55 * a.wave);
      const rr = r0 * (0.7 + 1.4 * (0.5 + 0.5 * wob)) * (0.75 + 0.55 * a.beat);

      const hue = (hueBase + d * 160 + wob * 35) % 360;
      const aa = 0.03 + 0.07 * (1 - clamp01(d)) + 0.05 * a.level;
      ctx.fillStyle = hsl(hue, 60, 55, aa);
      ctx.beginPath();
      ctx.arc(xx, y, Math.max(1, rr), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

function renderSceneSpirals(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 16 + 300 + a.level * 90) % 360;
  ctx.fillStyle = hsl(hueBase, 40, 5, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  const s = Math.min(w, h);
  const arms = 5;
  const segs = 220;
  const spin = dt * (0.22 + 0.32 * a.treble);
  ctx.globalCompositeOperation = "screen";

  for (let arm = 0; arm < arms; arm++) {
    const pA = arm / arms;
    const baseAng = pA * Math.PI * 2 + spin;
    const hue = (hueBase + 220 * pA + 25 * Math.sin(dt * 0.4 + arm)) % 360;
    ctx.strokeStyle = hsl(hue, 68, 58, 0.07 + 0.08 * a.level);
    ctx.lineWidth = Math.max(1, s * 0.0022);
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const p = i / segs;
      const rr = s * (0.03 + p * 0.6);
      const twist = (p * 4.2 + 0.8 * a.wave) * Math.PI * 2;
      const ang = baseAng + twist * (0.1 + 0.12 * a.mids);
      const x = Math.cos(ang) * rr;
      const y = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // small floating motes
  const motes = 120;
  for (let i = 0; i < motes; i++) {
    const n = noise1(i * 9.2);
    const ang = dt * (0.1 + 0.22 * n) + i;
    const rr = s * (0.1 + 0.45 * noise1(i * 2.3 + 1.1));
    const x = Math.cos(ang) * rr;
    const y = Math.sin(ang * 0.9) * rr;
    const hue = (hueBase + 180 * n) % 360;
    ctx.fillStyle = hsl(hue, 60, 62, 0.04 + 0.06 * a.treble);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, s * 0.0018), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  ctx.restore();
}

function renderSceneWaves(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 12 + 80 + a.level * 80) % 360;
  ctx.fillStyle = hsl(hueBase, 45, 5, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "screen";
  const layers = 18;
  const s = Math.min(w, h);

  for (let i = 0; i < layers; i++) {
    const p = i / (layers - 1);
    const amp = s * (0.07 + 0.11 * (1 - p)) * (0.75 + 0.4 * a.wave);
    const freq = 0.005 + 0.006 * p;
    const phase = dt * (0.35 + 0.5 * a.mids) + i * 0.8;
    const yBase = h * (0.15 + 0.7 * p);

    const hue = (hueBase + 140 * p + 30 * Math.sin(dt * 0.5 + i * 0.3)) % 360;
    ctx.strokeStyle = hsl(hue, 70, 60, 0.06 + 0.08 * a.level * (1 - p * 0.5));
    ctx.lineWidth = Math.max(1, s * (0.004 - 0.002 * p));
    ctx.beginPath();

    const step = Math.max(14, Math.floor(w / 100));
    for (let x = -step; x <= w + step; x += step) {
      const y =
        yBase +
        Math.sin(x * freq + phase) * amp +
        Math.sin(x * freq * 1.4 - phase * 0.7) * (amp * 0.25);
      if (x <= 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function renderSceneParticles(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 8 + 280 + a.level * 90) % 360;
  ctx.fillStyle = hsl(hueBase, 30, 5, 1);
  ctx.fillRect(0, 0, w, h);

  const s = Math.min(w, h);
  const count = 800;
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < count; i++) {
    const n = noise1(i * 7.31 + 0.5);
    const n2 = noise1(i * 11.92 + 3.7);
    const angle = dt * (0.1 + 0.3 * n2) + i;
    const dist = s * (0.08 + 0.48 * n);
    const wobble =
      Math.sin(dt * (0.8 + 0.7 * n) + i * 0.11) * s * 0.016 * (0.5 + a.wave);

    const x = w * 0.5 + Math.cos(angle) * (dist + wobble);
    const y =
      h * 0.5 + Math.sin(angle * (0.85 + 0.3 * n2)) * (dist - wobble * 0.7);

    const hue = (hueBase + 200 * n + 40 * Math.sin(dt * 0.6 + i * 0.05)) % 360;
    const aa = 0.03 + 0.09 * (1 - n) * a.level + 0.04 * a.beat;
    ctx.fillStyle = hsl(hue, 65, 58, aa);

    const r = Math.max(
      1,
      s * (0.0012 + 0.002 * (1 - n * 0.6)) * (0.8 + 0.5 * a.treble),
    );
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function renderSceneGrid(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 14 + 30 + a.level * 100) % 360;
  ctx.fillStyle = hsl(hueBase, 35, 5, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  const s = Math.min(w, h);
  const rows = 16;
  const cols = 16;
  const spacing = (s * 0.85) / Math.max(rows, cols);
  const rot = dt * (0.08 + 0.12 * a.treble);

  ctx.rotate(rot);
  ctx.globalCompositeOperation = "screen";

  for (let i = -rows / 2; i <= rows / 2; i++) {
    for (let j = -cols / 2; j <= cols / 2; j++) {
      const x = j * spacing;
      const y = i * spacing;
      const d = Math.sqrt((i * i + j * j) / (rows * rows + cols * cols));
      const phase = dt * (0.65 + 0.4 * a.mids) + d * 6.0;
      const scale = 0.55 + 0.45 * Math.sin(phase) * (0.75 + 0.45 * a.wave);
      const sz = spacing * 0.38 * scale * (0.85 + 0.3 * a.beat);

      const hue = (hueBase + d * 180 + i * 6 + j * 4) % 360;
      const aa = 0.04 + 0.08 * (1 - d) * a.level;
      ctx.strokeStyle = hsl(hue, 68, 58, aa);
      ctx.lineWidth = Math.max(1, spacing * 0.05);

      ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  ctx.restore();
}

function renderScenePetals(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 10 + 330 + a.level * 80) % 360;
  ctx.fillStyle = hsl(hueBase, 40, 5, 1);
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);

  const s = Math.min(w, h);
  const rings = 6;
  const petalsPerRing = 12;
  ctx.globalCompositeOperation = "screen";

  for (let ring = 0; ring < rings; ring++) {
    const rp = ring / (rings - 1);
    const rr = s * (0.08 + rp * 0.45);
    const rot = dt * (0.16 + 0.22 * rp) * (ring % 2 ? 1 : -1);

    for (let petal = 0; petal < petalsPerRing; petal++) {
      const pp = petal / petalsPerRing;
      const ang = pp * Math.PI * 2 + rot;
      const petalLen =
        rr *
        (0.26 + 0.16 * Math.sin(dt * 0.7 + ring + petal)) *
        (0.85 + 0.3 * a.wave);
      const petalWidth = petalLen * (0.35 + 0.25 * a.beat);

      const cx = Math.cos(ang) * rr;
      const cy = Math.sin(ang) * rr;

      const hue =
        (hueBase + 180 * rp + 30 * pp + 20 * Math.sin(dt * 0.7)) % 360;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, petalLen);
      grad.addColorStop(0, hsl(hue, 70, 62, 0.16 + 0.12 * a.level));
      grad.addColorStop(0.7, hsl((hue + 20) % 360, 65, 55, 0.06));
      grad.addColorStop(1, hsl(hue, 60, 50, 0));

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, petalLen, petalWidth, ang, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  ctx.restore();
}

function renderSceneNebula(w, h, dt, a, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const hueBase = (dt * 6 + 220 + a.level * 60) % 360;
  ctx.fillStyle = hsl(hueBase, 35, 4, 1);
  ctx.fillRect(0, 0, w, h);

  const s = Math.min(w, h);
  const clouds = 120;
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < clouds; i++) {
    const n = noise1(i * 5.77);
    const n2 = noise1(i * 8.12 + 2.3);
    const phase = dt * (0.04 + 0.1 * n2) + i;
    const drift = s * 0.14 * Math.sin(phase) * (0.65 + 0.6 * a.wave);

    const cx = w * (0.25 + 0.5 * n) + drift;
    const cy = h * (0.25 + 0.5 * n2) + drift * 0.7;
    const rr = s * (0.04 + 0.18 * (1 - n * 0.5)) * (0.9 + 0.4 * a.beat);

    const hue = (hueBase + 140 * n + 50 * Math.sin(dt * 0.4 + i * 0.1)) % 360;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    grad.addColorStop(0, hsl(hue, 75, 60, 0.12 + 0.1 * a.level));
    grad.addColorStop(0.4, hsl((hue + 30) % 360, 70, 55, 0.06));
    grad.addColorStop(1, hsl(hue, 65, 45, 0));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Add some stars
  ctx.globalCompositeOperation = "lighter";
  const stars = 80;
  for (let i = 0; i < stars; i++) {
    const n = noise1(i * 13.5 + 10.0);
    const n2 = noise1(i * 7.8 + 5.5);
    const x = w * n;
    const y = h * n2;
    const twinkle = 0.5 + 0.5 * Math.sin(dt * (1.2 + 1.8 * n) + i);
    const hue = (hueBase + 60 * n) % 360;
    ctx.fillStyle = hsl(hue, 60, 70, 0.04 + 0.06 * twinkle * a.treble);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, s * 0.0012), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function renderScene(scene, w, h, dt, a, alpha) {
  if (scene === 0) return renderSceneKaleido(w, h, dt, a, alpha);
  if (scene === 1) return renderScenePlasma(w, h, dt, a, alpha);
  if (scene === 2) return renderSceneTunnel(w, h, dt, a, alpha);
  if (scene === 3) return renderSceneAurora(w, h, dt, a, alpha);
  if (scene === 4) return renderSceneOrbitals(w, h, dt, a, alpha);
  if (scene === 5) return renderSceneMoire(w, h, dt, a, alpha);
  if (scene === 6) return renderSceneDots(w, h, dt, a, alpha);
  if (scene === 7) return renderSceneSpirals(w, h, dt, a, alpha);
  if (scene === 8) return renderSceneWaves(w, h, dt, a, alpha);
  if (scene === 9) return renderSceneParticles(w, h, dt, a, alpha);
  if (scene === 10) return renderSceneGrid(w, h, dt, a, alpha);
  if (scene === 11) return renderScenePetals(w, h, dt, a, alpha);
  return renderSceneNebula(w, h, dt, a, alpha);
}

function draw(t) {
  resizeCanvas();
  const w = canvas.width;
  const h = canvas.height;

  const dt = ((t - startedAt) / 1000) * SPEED;
  const a = computeFeatures(dt);

  if (!sceneStartMs) sceneStartMs = t;

  if (transitionStartMs === null && t - sceneStartMs > sceneDurationMs) {
    beginTransition(pickRandomNextScene(sceneIndex), t);
  }

  if (transitionStartMs !== null) {
    const p = clamp01((t - transitionStartMs) / transitionDurationMs);
    const e = smoothstep(0, 1, p);
    renderScene(transitionFrom, w, h, dt, a, 1 - e);
    renderScene(transitionTo, w, h, dt, a, e);

    if (p >= 1) {
      sceneIndex = transitionTo;
      transitionStartMs = null;
      sceneStartMs = t;
    }
  } else {
    renderScene(sceneIndex, w, h, dt, a, 1);
  }

  rafId = requestAnimationFrame(draw);
}

function updateOverlay() {
  studentOut.textContent = (studentIn.value || "").trim() || "—";
  trackOut.textContent = (trackIn.value || "").trim() || "—";
  hud.classList.remove("hidden");
}

function lockControls(running) {
  startBtn.disabled = running;
  studentIn.disabled = running;
  trackIn.disabled = running;
}

function stopVisuals() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  setRunningUi(false);
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  setStatus("");
  lockControls(false);
}

async function startVisuals() {
  updateOverlay();
  lockControls(true);

  startedAt = now();
  sceneIndex = Math.floor(Math.random() * scenes.length);
  refillSceneBag(sceneIndex);
  sceneStartMs = 0;
  transitionStartMs = null;
  setStatus("");

  // Enter fullscreen and hide controls (must be triggered by user gesture)
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) {
    console.warn(e);
  }

  setRunningUi(true);

  if (!rafId) rafId = requestAnimationFrame(draw);
}

document.addEventListener("fullscreenchange", () => {
  // If the user hits Esc, we treat that as stopping the visuals.
  if (!document.fullscreenElement && rafId) {
    stopVisuals();
  }
});

window.addEventListener("resize", resizeCanvas);

startBtn.addEventListener("click", () => {
  startVisuals();
});

studentIn.addEventListener("input", updateOverlay);
trackIn.addEventListener("input", updateOverlay);

// Space to start/stop
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (rafId) stopVisuals();
    else startVisuals();
    return;
  }

  if (!rafId) return;

  if (e.code === "KeyN") {
    e.preventDefault();
    beginTransition(pickRandomNextScene(sceneIndex), performance.now());
    return;
  }

  if (e.code === "Digit1") beginTransition(0, performance.now());
  if (e.code === "Digit2") beginTransition(1, performance.now());
  if (e.code === "Digit3") beginTransition(2, performance.now());
  if (e.code === "Digit4") beginTransition(3, performance.now());
  if (e.code === "Digit5") beginTransition(4, performance.now());
  if (e.code === "Digit6") beginTransition(5, performance.now());
  if (e.code === "Digit7") beginTransition(6, performance.now());
  if (e.code === "Digit8") beginTransition(7, performance.now());
  if (e.code === "Digit9") beginTransition(8, performance.now());
  if (e.code === "Digit0") beginTransition(9, performance.now());
  if (e.code === "Minus") beginTransition(10, performance.now());
  if (e.code === "Equal") beginTransition(11, performance.now());
  if (e.code === "BracketLeft") beginTransition(12, performance.now());
});

// Initial setup
resizeCanvas();
updateOverlay();
setRunningUi(false);
setStatus("");
