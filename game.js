const canvas = document.getElementById("gameCanvas");
if (!canvas) {
  throw new Error('Missing <canvas id="gameCanvas"> in index.html');
}
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Could not get 2D canvas context");
}

const scratchCanvas = document.createElement("canvas");
const scratchCtx = scratchCanvas.getContext("2d");

/** Sprite in `art/hamester.png` (falls back to `art/hamster.png` if missing). */
const HAMSTER_ART_URLS = ["art/hamester.png", "art/hamster.png"];
const hamsterArt = { img: new Image(), ready: false, urlIndex: 0 };

function loadHamsterArt() {
  const tryNext = () => {
    hamsterArt.urlIndex += 1;
    if (hamsterArt.urlIndex < HAMSTER_ART_URLS.length) {
      hamsterArt.img.src = HAMSTER_ART_URLS[hamsterArt.urlIndex];
    }
  };
  hamsterArt.img.onload = () => {
    hamsterArt.ready = hamsterArt.img.naturalWidth > 0;
  };
  hamsterArt.img.onerror = tryNext;
  hamsterArt.img.src = HAMSTER_ART_URLS[0];
}
loadHamsterArt();

/**
 * Canvas backdrop: first URL that loads wins.
 * Put your file in hamster-runner/art/ as background.png (or .jpg / .webp).
 */
const BACKGROUND_ART_URLS = [
  "art/background.png",
  "art/background.jpg",
  "art/background.jpeg",
  "art/background.webp",
];

/** "cover" = fill 420×720 (may crop edges). "contain" = whole image visible (letterboxed). */
const BACKGROUND_FIT = "cover";

const bgArt = { img: new Image(), ready: false, urlIndex: 0 };

function loadBackgroundArt() {
  const tryNext = () => {
    bgArt.urlIndex += 1;
    if (bgArt.urlIndex < BACKGROUND_ART_URLS.length) {
      bgArt.img.src = BACKGROUND_ART_URLS[bgArt.urlIndex];
    } else {
      bgArt.ready = false;
    }
  };
  bgArt.img.onload = () => {
    bgArt.ready = bgArt.img.naturalWidth > 0;
  };
  bgArt.img.onerror = tryNext;
  bgArt.img.src = BACKGROUND_ART_URLS[0];
}
loadBackgroundArt();

const heartsValueEl = document.getElementById("heartsValue");
const bannerEl = document.getElementById("banner");
const hudSepBeforeGoalEl = document.getElementById("hudSepBeforeGoal");
const hudGoalPartEl = document.getElementById("hudGoalPart");
const hudSepBeforeHeartsEl = document.getElementById("hudSepBeforeHearts");
const goalMeterWrapEl = document.getElementById("goalMeterWrap");
const goalStageLabelEl = document.getElementById("goalStageLabel");
const goalTextEl = document.getElementById("goalText");
const goalFillEl = document.getElementById("goalFill");
const gameBgmEl = document.getElementById("gameBgm");

const BGM_VOLUME = 0.32;

function startOrResumeBgm() {
  if (!gameBgmEl) return;
  gameBgmEl.volume = BGM_VOLUME;
  const playPromise = gameBgmEl.play();
  if (playPromise !== undefined && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function pauseBgm() {
  gameBgmEl?.pause();
}

function syncBgmToGameState() {
  if (!gameBgmEl) return;
  if (isNameGateActive() || !state?.running || state?.gameOver || state?.paused) {
    pauseBgm();
    return;
  }
  startOrResumeBgm();
}
const nameModalEl = document.getElementById("nameModal");
const playerNameInputEl = document.getElementById("playerNameInput");
const startGameBtnEl = document.getElementById("startGameBtn");
const gameOverModalEl = document.getElementById("gameOverModal");
const leaderboardBodyGameOverEl = document.getElementById("leaderboardBodyGameOver");
const tryAgainBtnEl = document.getElementById("tryAgainBtn");

const LEADERBOARD_LS_KEY = "hamsterRunnerLeaderboard_v2";
const LEADERBOARD_MAX = 10;

/** Local Sunday 00:00:00 — leaderboard resets each new week at that instant. */
function getLocalWeekStartMs(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function readLeaderboardStore() {
  const ws = getLocalWeekStartMs();
  try {
    const raw = localStorage.getItem(LEADERBOARD_LS_KEY);
    if (!raw) return { weekStartMs: ws, entries: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { weekStartMs: ws, entries: [] };
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.weekStartMs === "number" &&
      parsed.weekStartMs === ws &&
      Array.isArray(parsed.entries)
    ) {
      return { weekStartMs: ws, entries: parsed.entries };
    }
    return { weekStartMs: ws, entries: [] };
  } catch {
    return { weekStartMs: ws, entries: [] };
  }
}

const LANES = 3;
const LANE_PADDING = 16;
const TRACK_TOP = 18;
const TRACK_BOTTOM = canvas.height - 18;
const TRACK_HEIGHT = TRACK_BOTTOM - TRACK_TOP;
/** Hamster anchor: pixels above track bottom (smaller value = lower on screen). */
const HAMSTER_ANCHOR_OFFSET = 46;
/** Sprite / emoji scale inside the glow ring (1.3 = 30% larger). */
const PICKUP_ICON_SCALE = 1.3;

const FOOD_TYPES = [
  { id: "sunflower", label: "Sunflower seeds", emoji: "🌻", color: "#5ef0b8", art: "art/sunflower_seed.png" },
  { id: "popcorn", label: "Popcorn", emoji: "🍿", color: "#86f7cd", art: "art/popcorn.png" },
  { id: "carrot", label: "Carrot", emoji: "🥕", color: "#fca65e", art: "art/carrot.png" },
];

const pickupArtCache = Object.create(null);

function ensurePickupArt(url) {
  if (!url) return null;
  let e = pickupArtCache[url];
  if (e) return e;
  e = { img: new Image(), ready: false };
  e.img.onload = () => {
    e.ready = e.img.naturalWidth > 0;
  };
  e.img.onerror = () => {
    e.ready = false;
  };
  e.img.src = url;
  pickupArtCache[url] = e;
  return e;
}

const HURT_TYPES = [
  { id: "meat", label: "Meat", emoji: "🥩", color: "#ff6b84", art: "art/meat.png" },
  { id: "candy", label: "Candy", emoji: "🍬", color: "#ff8fa3", art: "art/candy.png" },
  { id: "icecream", label: "Ice cream", emoji: "🍦", color: "#ff9fb0", art: "art/icecream.png" },
  { id: "chocolate", label: "Chocolate", emoji: "🍫", color: "#ff7f97", art: "art/chocolate.png" },
];

/** Pickup: restores 1 full heart (not counted as food for stages). */
const HEART_PICKUP = { id: "heart", label: "Heart", emoji: "❤️", art: "art/redheart.png" };

/** Barrier hazards (vector fallback if art missing). */
const BARRIER_TYPES = [
  { id: "rock", label: "Rock", art: "art/rocks.png" },
  { id: "tree", label: "Tree", art: "art/tree.png" },
  { id: "bush", label: "Bush", art: "art/bush.png" },
  { id: "cat", label: "Cat", art: "art/cat.png" },
];

function preloadPickupArt() {
  const urls = new Set();
  for (const f of FOOD_TYPES) {
    if (f.art) urls.add(f.art);
  }
  for (const h of HURT_TYPES) {
    if (h.art) urls.add(h.art);
  }
  if (HEART_PICKUP.art) urls.add(HEART_PICKUP.art);
  for (const b of BARRIER_TYPES) {
    if (b.art) urls.add(b.art);
  }
  urls.forEach((u) => ensurePickupArt(u));
}

preloadPickupArt();

const MAX_STAGE = 10;

/**
 * Cumulative total foods needed to leave stage N and enter stage N+1.
 * Stages 1–2: +10 each. Stages 3–5: +20 each. Stages 6–8: +40 each. Stage 9: +50 → stage 10.
 * Stage 10: no food goal (play until hearts run out).
 */
const LEAVE_STAGE_AT = [10, 20, 40, 60, 80, 120, 160, 200, 250];

/** Applied to every stage’s fall speed (+15%). */
const GLOBAL_SPEED_MULT = 1.15;

/** From stage 4: extra random spawn on a second row (same tick). */
const DOUBLE_SPAWN_CHANCE_FROM_STAGE_4 = 0.3;
const DOUBLE_SPAWN_Y_OFFSET = 52;

const STAGES = Array.from({ length: MAX_STAGE }, (_, i) => {
  const stage = i + 1;
  const t = (stage - 1) / (MAX_STAGE - 1);
  return {
    stage,
    speed: (220 + t * 340) * GLOBAL_SPEED_MULT,
    spawnEveryMs: Math.round(740 - t * 360),
    foodChance: 0.78 - t * 0.2,
    barrierChance: 0.22 + t * 0.12,
    /** ~50% less likely than before (was 0.04 + t * 0.025). */
    heartPickupChance: (0.04 + t * 0.025) * 0.5,
  };
});

/** After stage 6 (i.e. stage ≥ 7): multiply fall speed by this. */
const SPEED_BOOST_AFTER_STAGE_6 = 1.34;

/** Vertical offset (px) for second row of avoid-only spawns after stage 7. */
const AVOID_SECOND_LINE_OFFSET = 58;

/** Full hearts at “full health”; HUD shows current / this (can exceed when overhealing). */
const MAX_HEARTS = 5;
const MAX_HP_HALVES = MAX_HEARTS * 2; // 10 half-hearts = 5 hearts
const HEART_OVERHEAL_CAP_HALVES = 200; // sanity cap (100 overheal hearts)

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function laneX(laneIndex) {
  const trackW = canvas.width - LANE_PADDING * 2;
  const laneW = trackW / LANES;
  return LANE_PADDING + laneW * (laneIndex + 0.5);
}

function laneBounds(laneIndex) {
  const trackW = canvas.width - LANE_PADDING * 2;
  const laneW = trackW / LANES;
  const left = LANE_PADDING + laneW * laneIndex;
  return { left, right: left + laneW, center: left + laneW / 2, width: laneW };
}

function pathHeartShape(c, ox, oy, r) {
  const x = ox;
  const y = oy;
  c.beginPath();
  c.moveTo(x, y + r * 0.28);
  c.bezierCurveTo(x - r * 1.15, y - r * 0.42, x - r, y - r * 1.02, x, y - r * 0.52);
  c.bezierCurveTo(x + r, y - r * 1.02, x + r * 1.15, y - r * 0.42, x, y + r * 0.28);
  c.closePath();
}

/** Glowing ring under pickups: green = good, red = bad (not the top health bar). */
function drawPickupGlow(isGood, size) {
  const t = state.timeMs * 0.0035;
  const pulse = 0.05 * Math.sin(t + size * 0.08);
  const r = size * 0.63;

  ctx.save();
  const g = ctx.createRadialGradient(0, 0, r * 0.06, 0, 0, r);
  if (isGood) {
    g.addColorStop(0, "rgba(94, 240, 184, 0)");
    g.addColorStop(0.38, `rgba(94, 240, 184, ${0.2 + pulse})`);
    g.addColorStop(0.72, `rgba(64, 220, 170, ${0.1 + pulse * 0.4})`);
    g.addColorStop(1, "rgba(94, 240, 184, 0)");
  } else {
    g.addColorStop(0, "rgba(255, 90, 100, 0)");
    g.addColorStop(0.38, `rgba(255, 85, 95, ${0.22 + pulse})`);
    g.addColorStop(0.72, `rgba(255, 50, 70, ${0.11 + pulse * 0.4})`);
    g.addColorStop(1, "rgba(255, 80, 90, 0)");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isGood ? `rgba(160, 255, 215, ${0.65 + pulse})` : `rgba(255, 150, 160, ${0.68 + pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = isGood ? "rgba(94, 240, 184, 0.5)" : "rgba(255, 110, 120, 0.55)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPickupSpriteCentered(sprEntry, objSize) {
  if (!sprEntry || !sprEntry.ready) return false;
  const img = sprEntry.img;
  const pad = objSize * 0.1;
  const inner = objSize - pad * 2;
  const maxS = inner * PICKUP_ICON_SCALE;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const sc = Math.min(maxS / iw, maxS / ih);
  const dw = iw * sc;
  const dh = ih * sc;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  return true;
}

function showBanner(text, ms = 1200) {
  if (!bannerEl) return;
  bannerEl.textContent = text;
  bannerEl.classList.remove("hidden");
  window.clearTimeout(showBanner._t);
  if (ms == null) return;
  showBanner._t = window.setTimeout(() => {
    bannerEl?.classList.add("hidden");
  }, ms);
}

function hideBanner() {
  window.clearTimeout(showBanner._t);
  bannerEl?.classList.add("hidden");
}

/** Cumulative food count when this stage begins (after previous stage’s goal). */
function cumulativeFoodAtStartOfStage(stageNum) {
  if (stageNum <= 1) return 0;
  return LEAVE_STAGE_AT[stageNum - 2];
}

function stageGoalForHud(stage, foodCount) {
  if (stage >= MAX_STAGE) return { visible: false, current: foodCount, target: null };
  const start = cumulativeFoodAtStartOfStage(stage);
  const targetTotal = LEAVE_STAGE_AT[stage - 1];
  const target = targetTotal - start;
  const current = clamp(foodCount - start, 0, target);
  return { visible: true, current, target };
}

function startStageCountdown(nextStage) {
  state.stageCountdownMs = 3000;
  state.pendingStartStage = nextStage;
  // Keep state.stage at the stage you just completed until the 3s countdown ends.
  state.objects = [];
  state.spawnTimerMs = 0;
  state.invulnMs = 0;
  state.shakeMs = 0;
  hideBanner();
}

function isCountdownActive() {
  return state.stageCountdownMs > 0;
}

function isManualPauseActive() {
  return state.paused;
}

function isFrozen() {
  return (
    isNameGateActive() ||
    !state.running ||
    state.gameOver ||
    isManualPauseActive() ||
    isCountdownActive()
  );
}

function drawCenteredCountdown() {
  if (!isCountdownActive()) return;
  const secs = Math.max(1, Math.ceil(state.stageCountdownMs / 1000));
  const done = state.stage;
  const next = state.pendingStartStage;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.save();
  const panelPadX = 14;
  const panelW = canvas.width - panelPadX * 2;
  const panelTop = cy - 112;
  const panelH = 232;
  roundRect(ctx, panelPadX, panelTop, panelW, panelH, 20);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const shadow = "rgba(0,0,0,0.5)";
  const fill = "rgba(255,255,255,0.94)";

  ctx.fillStyle = shadow;
  ctx.font = "900 16px ui-sans-serif, system-ui";
  ctx.fillText(`Stage ${done} goal complete!`, cx + 1, cy - 88 + 1);
  ctx.fillStyle = fill;
  ctx.fillText(`Stage ${done} goal complete!`, cx, cy - 88);

  ctx.fillStyle = shadow;
  ctx.font = "900 15px ui-sans-serif, system-ui";
  ctx.fillText(`Pause — Stage ${next} starts in`, cx + 1, cy - 58 + 1);
  ctx.fillStyle = fill;
  ctx.fillText(`Pause — Stage ${next} starts in`, cx, cy - 58);

  ctx.fillStyle = shadow;
  ctx.font = "900 96px ui-sans-serif, system-ui";
  ctx.fillText(String(secs), cx + 3, cy + 28 + 3);
  ctx.fillStyle = fill;
  ctx.font = "900 96px ui-sans-serif, system-ui";
  ctx.fillText(String(secs), cx, cy + 28);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "800 13px ui-sans-serif, system-ui";
  ctx.fillText("seconds", cx, cy + 86);
  ctx.restore();
}

const MUNCH_SQUASH_DURATION_MS = 420;
const DAMAGE_FLOAT_DURATION_MS = 1000;
const DAMAGE_PER_HIT_HALVES = 2; // 1 full heart
const INVULN_AFTER_HIT_MS = 720;

function stageForFood(foodCount) {
  let stage = 1;
  for (let i = 0; i < LEAVE_STAGE_AT.length; i++) {
    if (foodCount >= LEAVE_STAGE_AT[i]) stage = i + 2;
  }
  return Math.min(stage, MAX_STAGE);
}

function stageConfig(stageNum) {
  return STAGES[clamp(stageNum, 1, MAX_STAGE) - 1];
}

/**
 * After heart roll fails, P(food)=foodChance and P(avoid)=1-foodChance.
 * Stages 1–7: +5% relative avoid. Stages 8–10 (last three): −10% relative avoid.
 */
function effectiveSpawnConfig(stageNum) {
  const base = stageConfig(stageNum);
  const f = base.foodChance;
  let foodChance = f;
  if (stageNum >= 1 && stageNum <= 7) {
    const avoidShare = 1 - f;
    foodChance = 1 - Math.min(1, avoidShare * 1.05);
  } else if (stageNum >= MAX_STAGE - 2 && stageNum <= MAX_STAGE) {
    const avoidShare = 1 - f;
    foodChance = 1 - avoidShare * 0.9;
  }
  return { ...base, foodChance: clamp(foodChance, 0.03, 0.97) };
}

let playerName = "";
let nameGateActive = true;
/** ISO `date` of the run just saved, if it appears in the top 10 (game-over row highlight). */
let lastGameOverLeaderboardHighlight = null;

function isNameGateActive() {
  return nameGateActive;
}

function loadLeaderboardEntries() {
  return readLeaderboardStore().entries;
}

function saveLeaderboardEntries(entries) {
  const ws = getLocalWeekStartMs();
  localStorage.setItem(
    LEADERBOARD_LS_KEY,
    JSON.stringify({ weekStartMs: ws, entries })
  );
}

function formatLeaderboardDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Active play time only (excludes pause and between-stage countdown). */
function formatLeaderboardTime(timeSec) {
  if (timeSec == null || !Number.isFinite(timeSec)) return "—";
  const s = Math.max(0, Math.floor(timeSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function renderLeaderboardInto(tbodyEl, highlightDateIso = null) {
  if (!tbodyEl) return;
  const rows = loadLeaderboardEntries()
    .sort(
      (a, b) =>
        b.score - a.score ||
        (Number(b.timeSec) || 0) - (Number(a.timeSec) || 0)
    )
    .slice(0, LEADERBOARD_MAX);
  tbodyEl.replaceChildren();
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "leaderboard-empty";
    td.textContent = "No scores yet";
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
    return;
  }
  for (const e of rows) {
    const tr = document.createElement("tr");
    if (highlightDateIso && e.date === highlightDateIso) {
      tr.classList.add("leaderboard-row--current");
    }
    const tdDate = document.createElement("td");
    tdDate.textContent = formatLeaderboardDate(e.date);
    const tdName = document.createElement("td");
    tdName.textContent = String(e.name || "—").slice(0, 24);
    const tdScore = document.createElement("td");
    tdScore.textContent = String(e.score ?? 0);
    const tdTime = document.createElement("td");
    tdTime.textContent = formatLeaderboardTime(e.timeSec);
    tr.append(tdDate, tdName, tdScore, tdTime);
    tbodyEl.appendChild(tr);
  }
}

function renderLeaderboard() {
  renderLeaderboardInto(leaderboardBodyGameOverEl, lastGameOverLeaderboardHighlight);
}

function hideGameOverModal() {
  document.getElementById("gameOverModal")?.classList.add("hidden");
}

function showGameOverModal() {
  const tbody = document.getElementById("leaderboardBodyGameOver");
  const modal = document.getElementById("gameOverModal");
  renderLeaderboardInto(tbody, lastGameOverLeaderboardHighlight);
  modal?.classList.remove("hidden");
  document.getElementById("tryAgainBtn")?.focus();
}

function recordLeaderboardScore(score, name, timeSec) {
  const ts =
    timeSec != null && Number.isFinite(timeSec)
      ? Math.max(0, Math.floor(timeSec))
      : null;
  const newEntry = {
    name: String(name || "Player").slice(0, 24),
    score: Math.max(0, Math.floor(score)),
    timeSec: ts,
    date: new Date().toISOString(),
  };

  const list = loadLeaderboardEntries();
  list.push(newEntry);
  list.sort(
    (a, b) =>
      b.score - a.score ||
      (Number(b.timeSec) || 0) - (Number(a.timeSec) || 0)
  );
  const top = list.slice(0, LEADERBOARD_MAX);
  const inTop10 = top.some((e) => e.date === newEntry.date);
  lastGameOverLeaderboardHighlight = inTop10 ? newEntry.date : null;
  saveLeaderboardEntries(top);
  renderLeaderboard();
}

function getHtml2Canvas() {
  return typeof html2canvas === "function"
    ? html2canvas
    : typeof window !== "undefined" && typeof window.html2canvas === "function"
      ? window.html2canvas
      : null;
}

async function blobPngFromGameOverShareCard() {
  const card = document.getElementById("gameOverShareCard");
  const h2c = getHtml2Canvas();
  if (!card || !h2c) {
    console.warn("Screenshot unavailable (missing card or html2canvas).");
    return null;
  }
  const c = await h2c(card, {
    scale: Math.min(2, window.devicePixelRatio || 1),
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  return await new Promise((resolve) => {
    c.toBlob((b) => resolve(b), "image/png", 0.92);
  });
}

async function onSaveLeaderboardImage() {
  try {
    const blob = await blobPngFromGameOverShareCard();
    if (!blob) return;
    const a = document.createElement("a");
    const u = URL.createObjectURL(blob);
    a.href = u;
    a.download = `hamester-run-leaderboard-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(u);
  } catch (e) {
    console.error(e);
  }
}

function initGameOverSaveButton() {
  document
    .getElementById("saveLeaderboardBtn")
    ?.addEventListener("click", () => void onSaveLeaderboardImage());
}

function hideNameModal() {
  nameModalEl?.classList.add("hidden");
}

function showNameModal() {
  nameModalEl?.classList.remove("hidden");
  playerNameInputEl?.focus();
}

function beginSessionFromModal() {
  const raw = playerNameInputEl?.value?.trim() || "Player";
  playerName = raw.slice(0, 24);
  nameGateActive = false;
  hideNameModal();
  resetGame(); // running true, Stage 1 banner
}

function returnToWelcomeFromGameOver() {
  lastGameOverLeaderboardHighlight = null;
  nameGateActive = true;
  if (playerNameInputEl) playerNameInputEl.value = "";
  pauseBgm();
  resetGame({ silent: true });
  showNameModal();
  syncBgmToGameState();
  renderLeaderboard();
}

function resetGame(options) {
  const silent = options?.silent === true;
  hideGameOverModal();
  state = {
    running: !silent,
    paused: false,
    gameOver: false,
    timeMs: 0,
    playTimeMs: 0,
    lastTs: null,
    foodCount: 0,
    hpHalves: MAX_HP_HALVES,
    stage: 1,
    objects: [],
    spawnTimerMs: 0,
    lane: 1, // start middle (0,1,2)
    laneAnim: 1,
    invulnMs: 0,
    shakeMs: 0,
    stageCountdownMs: 0,
    pendingStartStage: null,
    munchSquashMs: 0,
    floatTexts: [],
  };

  if (!silent) {
    showBanner("Slow & easy — collect food!", 1400);
    syncBgmToGameState();
  } else {
    hideBanner();
  }
  syncHud();
}

function syncHud() {
  const pauseBtn = document.getElementById("pauseToggleBtn");
  if (pauseBtn) {
    const ingame =
      state.running &&
      !state.gameOver &&
      !isNameGateActive() &&
      !isCountdownActive();
    pauseBtn.hidden = !ingame;
    if (ingame) {
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      pauseBtn.setAttribute("aria-label", state.paused ? "Resume game" : "Pause game");
    }
  }

  if (heartsValueEl) {
    const cur = Math.floor(state.hpHalves / 2);
    heartsValueEl.textContent = `${cur}/${MAX_HEARTS}`;
    if (cur < 2) {
      heartsValueEl.classList.add("hearts-value--low");
    } else {
      heartsValueEl.classList.remove("hearts-value--low");
    }
  }

  const goal = stageGoalForHud(state.stage, state.foodCount);
  if (!goalTextEl || !goalFillEl) return;
  if (goalStageLabelEl) goalStageLabelEl.textContent = `Stage ${state.stage}`;
  if (!goal.visible) {
    hudSepBeforeGoalEl?.classList.add("hidden");
    hudGoalPartEl?.classList.add("hidden");
    hudSepBeforeHeartsEl?.classList.remove("hidden");
    goalMeterWrapEl?.classList.add("hidden");
    return;
  }
  hudSepBeforeGoalEl?.classList.remove("hidden");
  hudGoalPartEl?.classList.remove("hidden");
  hudSepBeforeHeartsEl?.classList.remove("hidden");
  goalMeterWrapEl?.classList.remove("hidden");
  goalTextEl.textContent = `${goal.current} / ${goal.target}`;
  goalFillEl.style.width = `${clamp(goal.current / goal.target, 0, 1) * 100}%`;
}

function triggerMunchSquash() {
  state.munchSquashMs = MUNCH_SQUASH_DURATION_MS;
}

function spawnDamageFloatMinusOne() {
  state.floatTexts.push({
    x: laneX(state.laneAnim),
    y: TRACK_BOTTOM - HAMSTER_ANCHOR_OFFSET - 46,
    vx: (Math.random() - 0.5) * 55,
    vy: -88,
    text: "-1",
    tone: "bad",
    lifeMs: DAMAGE_FLOAT_DURATION_MS,
    maxLife: DAMAGE_FLOAT_DURATION_MS,
  });
}

function spawnHealFloatPlusOne() {
  state.floatTexts.push({
    x: laneX(state.laneAnim),
    y: TRACK_BOTTOM - HAMSTER_ANCHOR_OFFSET - 96,
    vx: (Math.random() - 0.5) * 45,
    vy: -102,
    text: "+1",
    tone: "good",
    lifeMs: DAMAGE_FLOAT_DURATION_MS,
    maxLife: DAMAGE_FLOAT_DURATION_MS,
  });
}

function healOneHeart() {
  state.hpHalves = clamp(state.hpHalves + DAMAGE_PER_HIT_HALVES, 0, HEART_OVERHEAL_CAP_HALVES);
  spawnHealFloatPlusOne();
}

/** Spawns only barrier or hurt (second “line” of hazards). Returns lane used. */
function spawnAvoidOnlyRow(yExtra, preferNotLane = null) {
  const cfg = stageConfig(state.stage);
  let lane = Math.floor(Math.random() * LANES);
  if (preferNotLane != null && LANES > 1) {
    let guard = 0;
    while (lane === preferNotLane && guard++ < 12) {
      lane = Math.floor(Math.random() * LANES);
    }
  }
  const { width } = laneBounds(lane);
  const size = clamp(width * 0.561, 54, 71);
  const y = TRACK_TOP - 90 + yExtra;
  const useBarrier = Math.random() < cfg.barrierChance;
  const kind = useBarrier ? "barrier" : "hurt";
  const def = useBarrier ? pick(BARRIER_TYPES) : pick(HURT_TYPES);
  const spin = (Math.random() * 2 - 1) * (useBarrier ? 0.25 : 0.6);
  state.objects.push({
    lane,
    y,
    size,
    kind,
    def,
    spin,
    rot: Math.random() * Math.PI * 2,
  });
  return lane;
}

/** Returns lane index of the primary spawn (for pairing a second avoid row). */
function spawnObject(yExtra = 0) {
  const cfg = effectiveSpawnConfig(state.stage);
  const lane = Math.floor(Math.random() * LANES);
  const { width } = laneBounds(lane);

  const size = clamp(width * 0.561, 54, 71);
  const y = TRACK_TOP - 90 + yExtra;

  let kind;
  let def;
  let spin;

  if (Math.random() < cfg.heartPickupChance) {
    state.objects.push({
      lane,
      y,
      size,
      kind: "heart",
      def: HEART_PICKUP,
      spin: (Math.random() * 2 - 1) * 0.45,
      rot: Math.random() * Math.PI * 2,
    });
    return lane;
  }

  if (Math.random() < cfg.foodChance) {
    kind = "food";
    def = pick(FOOD_TYPES);
    spin = (Math.random() * 2 - 1) * 0.6;
  } else if (Math.random() < cfg.barrierChance) {
    kind = "barrier";
    def = pick(BARRIER_TYPES);
    spin = (Math.random() * 2 - 1) * 0.25;
  } else {
    kind = "hurt";
    def = pick(HURT_TYPES);
    spin = (Math.random() * 2 - 1) * 0.6;
  }

  state.objects.push({
    lane,
    y,
    size,
    kind,
    def,
    spin,
    rot: Math.random() * Math.PI * 2,
  });
  return lane;
}

function damageOneHeart() {
  if (state.invulnMs > 0) return;
  state.hpHalves = Math.max(0, state.hpHalves - DAMAGE_PER_HIT_HALVES);
  state.invulnMs = INVULN_AFTER_HIT_MS;
  state.shakeMs = 280;
  spawnDamageFloatMinusOne();

  if (state.hpHalves <= 0) {
    state.gameOver = true;
    state.running = false;
    hideBanner();
    pauseBgm();
    try {
      recordLeaderboardScore(
        state.foodCount,
        playerName,
        state.playTimeMs / 1000
      );
    } catch (e) {
      console.error("Game over leaderboard error:", e);
    }
    // Show immediately (do not wait on Promise / .finally — missing on some WebViews and blocks the rAF loop if it throws).
    showGameOverModal();
  }
}

function eatFood() {
  state.foodCount += 1;
  const prevStage = state.stage;
  const nextStage = stageForFood(state.foodCount);
  if (nextStage !== prevStage) {
    startStageCountdown(nextStage);
  }
}

function tryCollide(obj) {
  if (obj.lane !== state.lane) return false;
  const hamsterY = TRACK_BOTTOM - HAMSTER_ANCHOR_OFFSET;
  const d = Math.abs(obj.y - hamsterY);
  return d < (obj.size * 0.5 + 26);
}

function update(dt) {
  if (isNameGateActive()) return;
  if (!state.running || state.gameOver) return;
  state.timeMs += dt * 1000;

  // Manual pause freezes everything (no popup).
  if (isManualPauseActive()) return;

  // Stage countdown freezes gameplay but still ticks down.
  if (isCountdownActive()) {
    state.stageCountdownMs = Math.max(0, state.stageCountdownMs - dt * 1000);
    if (state.stageCountdownMs <= 0) {
      const next = state.pendingStartStage;
      state.pendingStartStage = null;
      if (next != null) state.stage = next;
      state.lane = 1;
      state.laneAnim = 1;
      state.spawnTimerMs = 0;
      state.objects = [];
    }
    syncHud();
    return;
  }

  state.playTimeMs += dt * 1000;

  if (state.invulnMs > 0) state.invulnMs = Math.max(0, state.invulnMs - dt * 1000);
  if (state.shakeMs > 0) state.shakeMs = Math.max(0, state.shakeMs - dt * 1000);
  if (state.munchSquashMs > 0) state.munchSquashMs = Math.max(0, state.munchSquashMs - dt * 1000);

  for (const ft of state.floatTexts) {
    ft.lifeMs -= dt * 1000;
    ft.x += ft.vx * dt;
    ft.y += ft.vy * dt;
    ft.vy *= 0.985;
  }
  state.floatTexts = state.floatTexts.filter((ft) => ft.lifeMs > 0);

  // Smooth lane animation
  state.laneAnim = lerp(state.laneAnim, state.lane, clamp(dt * 16, 0, 1));

  // Spawning
  const cfg = stageConfig(state.stage);
  state.spawnTimerMs += dt * 1000;
  while (state.spawnTimerMs >= cfg.spawnEveryMs) {
    state.spawnTimerMs -= cfg.spawnEveryMs;
    const primaryLane = spawnObject();
    if (state.stage >= 4 && Math.random() < DOUBLE_SPAWN_CHANCE_FROM_STAGE_4) {
      spawnObject(DOUBLE_SPAWN_Y_OFFSET);
    }
    if (state.stage > 7) {
      spawnAvoidOnlyRow(AVOID_SECOND_LINE_OFFSET, primaryLane);
    }
  }

  // Move objects
  let speed = cfg.speed;
  if (state.stage > 6) {
    speed *= SPEED_BOOST_AFTER_STAGE_6;
  }
  for (const obj of state.objects) {
    obj.y += speed * dt;
    obj.rot += obj.spin * dt;
  }

  // Collisions & cleanup
  const kept = [];
  for (const obj of state.objects) {
    const out = obj.y > TRACK_BOTTOM + 120;
    const hit = !out && tryCollide(obj);
    if (hit) {
      if (obj.kind === "food") {
        eatFood();
        triggerMunchSquash();
      } else if (obj.kind === "heart") {
        healOneHeart();
        triggerMunchSquash();
      } else {
        damageOneHeart();
      }
      continue;
    }
    if (!out) kept.push(obj);
  }
  state.objects = kept;

  syncHud();
}

function drawCanvasBackground() {
  const cw = canvas.width;
  const ch = canvas.height;
  if (bgArt.ready) {
    const iw = bgArt.img.naturalWidth;
    const ih = bgArt.img.naturalHeight;
    let scale;
    if (BACKGROUND_FIT === "contain") {
      ctx.fillStyle = "#0b1224";
      ctx.fillRect(0, 0, cw, ch);
      scale = Math.min(cw / iw, ch / ih);
    } else {
      scale = Math.max(cw / iw, ch / ih);
    }
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(bgArt.img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#0b1224";
    ctx.fillRect(0, 0, cw, ch);
  }

  // Light dim (~5% black) over background; track & sprites draw on top.
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, cw, ch);
}

function drawTrack() {
  const trackW = canvas.width - LANE_PADDING * 2;
  const trackH = TRACK_HEIGHT;
  const x = LANE_PADDING;
  const y = TRACK_TOP;

  // When `background.png` loaded: very light wash so art stays visible.
  // Fallback (no image): stronger overlay so lanes read clearly on flat color.
  const g = ctx.createLinearGradient(0, y, 0, y + trackH);
  if (bgArt.ready) {
    g.addColorStop(0, "rgba(0,0,0,0.05)");
    g.addColorStop(0.5, "rgba(0,0,0,0.03)");
    g.addColorStop(1, "rgba(0,0,0,0.07)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.06)");
    g.addColorStop(0.5, "rgba(255,255,255,0.03)");
    g.addColorStop(1, "rgba(0,0,0,0.14)");
  }
  ctx.fillStyle = g;
  roundRect(ctx, x, y, trackW, trackH, 16);
  ctx.fill();

  if (!bgArt.ready) {
    const glow = ctx.createRadialGradient(canvas.width / 2, TRACK_BOTTOM, 12, canvas.width / 2, TRACK_BOTTOM, 300);
    glow.addColorStop(0, "rgba(94,240,184,0.12)");
    glow.addColorStop(1, "rgba(94,240,184,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, TRACK_BOTTOM - 160, canvas.width, 220);
  }
}

function drawBarrierShape(id, s) {
  const w = s * 0.42;
  const ink = "rgba(255,255,255,0.9)";
  const soft = "rgba(255,255,255,0.35)";
  ctx.strokeStyle = ink;
  ctx.fillStyle = "transparent";
  ctx.lineWidth = Math.max(2, s * 0.055);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (id === "rock") {
    ctx.beginPath();
    ctx.moveTo(-w * 0.9, w * 0.35);
    ctx.lineTo(-w * 0.45, -w * 0.75);
    ctx.lineTo(w * 0.15, -w * 0.55);
    ctx.lineTo(w * 0.95, w * 0.1);
    ctx.lineTo(w * 0.55, w * 0.85);
    ctx.lineTo(-w * 0.25, w * 0.95);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = soft;
    ctx.lineWidth *= 0.55;
    ctx.stroke();
    return;
  }

  if (id === "tree") {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.lineTo(-w * 0.95, w * 0.2);
    ctx.lineTo(w * 0.95, w * 0.2);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = soft;
    ctx.lineWidth *= 0.55;
    ctx.beginPath();
    ctx.moveTo(0, w * 0.2);
    ctx.lineTo(0, s * 0.48);
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, s * 0.055);
    ctx.strokeRect(-s * 0.08, s * 0.18, s * 0.16, s * 0.34);
    return;
  }

  if (id === "bush") {
    ctx.beginPath();
    ctx.arc(-w * 0.65, w * 0.05, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.1, -w * 0.25, w * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.75, w * 0.1, w * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = soft;
    ctx.lineWidth *= 0.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.95, w * 0.45);
    ctx.quadraticCurveTo(0, w * 0.75, w * 0.95, w * 0.45);
    ctx.stroke();
    return;
  }

  if (id === "cat") {
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -s * 0.28);
    ctx.lineTo(-w * 0.55, -s * 0.52);
    ctx.lineTo(-w * 0.2, -s * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.35, -s * 0.28);
    ctx.lineTo(w * 0.55, -s * 0.52);
    ctx.lineTo(w * 0.2, -s * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, s * 0.02, w * 0.95, w * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-w * 0.28, -s * 0.02, s * 0.07, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.28, -s * 0.02, s * 0.07, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, s * 0.22);
    ctx.lineTo(-w * 0.95, s * 0.12);
    ctx.moveTo(-w * 0.55, s * 0.3);
    ctx.lineTo(-w * 0.95, s * 0.32);
    ctx.moveTo(w * 0.55, s * 0.22);
    ctx.lineTo(w * 0.95, s * 0.12);
    ctx.moveTo(w * 0.55, s * 0.3);
    ctx.lineTo(w * 0.95, s * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, s * 0.28);
    ctx.quadraticCurveTo(0, s * 0.42, s * 0.05, s * 0.28);
    ctx.stroke();
  }
}

function drawObjects() {
  for (const obj of state.objects) {
    const { center } = laneBounds(obj.lane);
    const x = center;
    const y = obj.y;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.ellipse(x, y + obj.size * 0.42, obj.size * 0.34, obj.size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(obj.rot);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(0, 0, obj.size * 0.58, 0, Math.PI * 2);
    ctx.fill();

    if (obj.kind === "barrier") {
      drawPickupGlow(false, obj.size);
      ctx.rotate(-obj.rot);
      const spr = obj.def.art ? ensurePickupArt(obj.def.art) : null;
      if (!drawPickupSpriteCentered(spr, obj.size)) {
        drawBarrierShape(obj.def.id, obj.size);
      }
      ctx.rotate(obj.rot);
    } else if (obj.kind === "heart") {
      drawPickupGlow(true, obj.size);
      ctx.rotate(-obj.rot);
      const spr = obj.def.art ? ensurePickupArt(obj.def.art) : null;
      if (!drawPickupSpriteCentered(spr, obj.size)) {
        ctx.strokeStyle = "rgba(255, 80, 95, 0.95)";
        ctx.lineWidth = 2.5;
        pathHeartShape(ctx, 0, obj.size * 0.02, obj.size * 0.24 * PICKUP_ICON_SCALE);
        ctx.stroke();
      }
      ctx.rotate(obj.rot);
    } else {
      drawPickupGlow(obj.kind === "food", obj.size);

      ctx.rotate(-obj.rot);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const spr = obj.def.art ? ensurePickupArt(obj.def.art) : null;
      if (!drawPickupSpriteCentered(spr, obj.size)) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = `700 ${Math.floor(obj.size * 0.55 * PICKUP_ICON_SCALE)}px ui-sans-serif, system-ui, Apple Color Emoji, Segoe UI Emoji`;
        ctx.fillText(obj.def.emoji, 0, 1);
      }
      ctx.rotate(obj.rot);
    }

    ctx.restore();
  }
}

const HAMSTER_SPRITE_HEIGHT = 96;

function drawHamsterSprite() {
  const img = hamsterArt.img;
  const ih = img.naturalHeight;
  const iw = img.naturalWidth;
  if (!ih || !iw) return;
  const scale = HAMSTER_SPRITE_HEIGHT / ih;
  const dw = iw * scale;
  const dh = HAMSTER_SPRITE_HEIGHT;
  ctx.drawImage(img, -dw / 2, -dh / 2 - 6, dw, dh);
}

function drawHamsterVector() {
  const body = ctx.createLinearGradient(-40, -40, 40, 60);
  body.addColorStop(0, "#f6dcc2");
  body.addColorStop(1, "#caa07f");
  ctx.fillStyle = body;
  ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
  ctx.lineWidth = 2.2;
  roundRect(ctx, -36, -26, 72, 74, 32);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, -22, -6, 44, 48, 24);
  ctx.fill();
  ctx.restore();

  drawEar(-22, -30, 18, 18);
  drawEar(22, -30, 18, 18);

  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  ctx.beginPath();
  ctx.arc(-12, -2, 5.2, 0, Math.PI * 2);
  ctx.arc(12, -2, 5.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 107, 132, 0.9)";
  ctx.beginPath();
  ctx.arc(0, 10, 4.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(6 * dir, 12);
    ctx.lineTo(28 * dir, 6);
    ctx.moveTo(6 * dir, 14);
    ctx.lineTo(28 * dir, 14);
    ctx.moveTo(6 * dir, 16);
    ctx.lineTo(28 * dir, 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHamster() {
  const hamsterY = TRACK_BOTTOM - HAMSTER_ANCHOR_OFFSET;
  const x = laneX(state.laneAnim);
  const y = hamsterY;
  const wobble = Math.sin(state.timeMs / 140) * 1.2;

  const shakeX = state.shakeMs > 0 ? (Math.random() * 2 - 1) * 3.5 : 0;
  const shakeY = state.shakeMs > 0 ? (Math.random() * 2 - 1) * 2.2 : 0;

  ctx.save();
  ctx.translate(x + shakeX, y + wobble + shakeY);

  let sx = 1;
  let sy = 1;
  if (state.munchSquashMs > 0) {
    const u = 1 - state.munchSquashMs / MUNCH_SQUASH_DURATION_MS;
    const damp = Math.exp(-u * 5);
    sx = 1 + 0.22 * damp * Math.sin(u * Math.PI * 7);
    sy = 1 + 0.2 * damp * Math.cos(u * Math.PI * 6 + 0.65);
  }
  ctx.scale(sx, sy);

  if (hamsterArt.ready) {
    drawHamsterSprite();
  } else {
    drawHamsterVector();
  }

  if (state.invulnMs > 0) {
    const p = state.invulnMs / INVULN_AFTER_HIT_MS;
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.38 * Math.abs(Math.sin(state.timeMs / 80));
    ctx.strokeStyle = "rgba(255, 90, 110, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 8, 48 - 10 * p, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawEar(cx, cy, w, h) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#d2a786";
  ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
  ctx.lineWidth = 2;
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "rgba(255, 107, 132, 0.22)";
  roundRect(ctx, -w * 0.25, -h * 0.25, w * 0.5, h * 0.5, 6);
  ctx.fill();
  ctx.restore();
}

function drawFloatTexts() {
  for (const ft of state.floatTexts) {
    const lifeT = clamp(ft.lifeMs / ft.maxLife, 0, 1);
    const tone = ft.tone === "good" ? "good" : "bad";
    const fill = tone === "good" ? "#5ef0b8" : "#ff6b84";
    ctx.save();
    ctx.globalAlpha = clamp(lifeT * 1.35, 0, 1);
    ctx.font = "900 30px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(ft.text, ft.x + 2, ft.y + 2);
    ctx.fillStyle = fill;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawCanvasBackground();
  drawTrack();
  drawObjects();
  drawHamster();
  drawFloatTexts();

  if (isCountdownActive() && scratchCtx) {
    const w = canvas.width;
    const h = canvas.height;
    if (scratchCanvas.width !== w || scratchCanvas.height !== h) {
      scratchCanvas.width = w;
      scratchCanvas.height = h;
    }
    scratchCtx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.filter = "blur(7px)";
    ctx.drawImage(scratchCanvas, 0, 0);
    ctx.restore();
  }

  drawCenteredCountdown();
}

function roundRect(c, x, y, w, h, r) {
  const radius = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
  c.beginPath();
  c.moveTo(x + radius.tl, y);
  c.lineTo(x + w - radius.tr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
  c.lineTo(x + w, y + h - radius.br);
  c.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
  c.lineTo(x + radius.bl, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
  c.lineTo(x, y + radius.tl);
  c.quadraticCurveTo(x, y, x + radius.tl, y);
  c.closePath();
}

function onKeyDown(e) {
  if (isNameGateActive() && nameModalEl && !nameModalEl.classList.contains("hidden")) {
    if (e.key === "Enter") {
      e.preventDefault();
      beginSessionFromModal();
    }
    return;
  }

  if (gameOverModalEl && !gameOverModalEl.classList.contains("hidden")) {
    if (e.key === "Enter" || e.key.toLowerCase() === "r") {
      e.preventDefault();
      returnToWelcomeFromGameOver();
    }
    return;
  }

  const key = e.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    e.preventDefault();
    moveLane(-1);
  } else if (key === "arrowright" || key === "d") {
    e.preventDefault();
    moveLane(1);
  } else if (key === " " || key === "spacebar") {
    e.preventDefault();
    togglePause();
  } else if (key === "r") {
    e.preventDefault();
    resetGame();
  }
}

function moveLane(dir) {
  if (isFrozen()) return;
  state.lane = clamp(state.lane + dir, 0, LANES - 1);
}

function togglePause() {
  if (state.gameOver || isNameGateActive() || isCountdownActive()) return;
  state.paused = !state.paused;
  if (state.paused) {
    showBanner("Paused — tap Resume or the playfield, or press Space", null);
  } else {
    hideBanner();
  }
  syncHud();
  syncBgmToGameState();
}

function onPointerDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;

  if (!isNameGateActive() && !state.gameOver && state.paused) {
    togglePause();
    e.preventDefault();
    return;
  }

  if (x < rect.width * 0.5) moveLane(-1);
  else moveLane(1);
}

function loop(ts) {
  if (state.lastTs == null) state.lastTs = ts;
  const dt = clamp((ts - state.lastTs) / 1000, 0, 1 / 20);
  state.lastTs = ts;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", onKeyDown, { passive: false });
canvas.addEventListener("pointerdown", onPointerDown, { passive: false });

let state;
resetGame({ silent: true });
nameGateActive = true;

startGameBtnEl?.addEventListener("click", () => beginSessionFromModal());
playerNameInputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    beginSessionFromModal();
  }
});

tryAgainBtnEl?.addEventListener("click", () => returnToWelcomeFromGameOver());

document.getElementById("pauseToggleBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  togglePause();
});

initGameOverSaveButton();
renderLeaderboard();
showNameModal();

requestAnimationFrame(loop);
