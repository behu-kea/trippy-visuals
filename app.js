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

const scenes = ["Kaleido", "Plasma", "Tunnel"];
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

  const energy = 0.3 + a.level * 1.0;
  const spin = 0.16 + a.treble * 1.0;
  const pulse = 0.55 + a.beat * 1.2;

  const layers = 7;
  const petals = 10 + Math.floor(a.mids * 18);
  const baseR = Math.min(w, h) * (0.18 + 0.06 * pulse);

  for (let L = 0; L < layers; L++) {
    const k = L / (layers - 1);
    const ringR = baseR * (1.0 + k * (1.6 + a.level * 1.4));
    const thickness =
      (Math.min(w, h) * 0.004 + k * Math.min(w, h) * 0.009) *
      (0.6 + a.beat * 1.7);

    ctx.save();
    ctx.rotate(dt * spin * (0.6 + k * 1.2) * (L % 2 ? 1 : -1));

    for (let i = 0; i < petals; i++) {
      const p = i / petals;
      const ang = p * Math.PI * 2;
      const wobble =
        Math.sin(dt * (1.2 + k * 1.8) + p * 14) * (0.1 + 0.45 * a.wave);
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
  const maxR = Math.min(w, h) * (0.52 + a.level * 0.25);
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < grid; i++) {
    const p = i / (grid - 1);
    const ang = p * Math.PI * 2;
    const rr = maxR * (0.55 + 0.55 * Math.sin(dt * (0.6 + a.mids) + p * 7.0));
    const x = Math.cos(ang + dt * 0.22) * rr;
    const y = Math.sin(ang - dt * 0.18) * rr;

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
    const ang = dt * (0.35 + 0.8 * a.mids) + p * Math.PI * 2 * 3;
    const rad = s * (0.18 + 0.26 * p) * (0.85 + 0.35 * Math.sin(dt + p * 9));
    const cx = w * (0.5 + 0.33 * Math.cos(ang) * (0.65 + 0.35 * a.wave));
    const cy = h * (0.5 + 0.33 * Math.sin(ang * 0.9) * (0.65 + 0.35 * a.wave));
    const r = s * (0.06 + 0.12 * (1 - p)) * (0.75 + 0.65 * a.beat);

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
    const amp = (h / lines) * (0.35 + 0.9 * a.wave);
    const f = 0.008 + 0.012 * a.mids;
    for (let x = 0; x <= w; x += Math.max(10, Math.floor(w / 90))) {
      const y = y0 + Math.sin(dt * (1.5 + a.bass) + x * f + i) * amp;
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
  const rot = dt * (0.4 + a.treble * 0.9);
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < rings; i++) {
    const p = i / (rings - 1);
    const z = (p + ((dt * (0.12 + a.level * 0.16)) % 1)) % 1;
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

function renderScene(scene, w, h, dt, a, alpha) {
  if (scene === 0) return renderSceneKaleido(w, h, dt, a, alpha);
  if (scene === 1) return renderScenePlasma(w, h, dt, a, alpha);
  return renderSceneTunnel(w, h, dt, a, alpha);
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
});

// Initial setup
resizeCanvas();
updateOverlay();
setRunningUi(false);
setStatus("");
