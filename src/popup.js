// popup.js
// UI controller. Talks to the background worker (which proxies to the offscreen
// engine). Holds the restore map in memory + chrome.storage.session only —
// never written to disk — so the round-trip works but nothing persists.

const ALL_TYPES = [
  ["PER", "Names"],
  ["ORG", "Companies"],
  ["LOC", "Locations"],
  ["EMAIL", "Emails"],
  ["PHONE", "Phones"],
  ["CREDIT_CARD", "Cards"],
  ["SSN", "SSNs"],
  ["IBAN", "Bank accts"],
  ["IPV4", "IP addresses"],
  ["URL", "URLs"],
  ["API_KEY", "API keys"],
  ["AWS_KEY", "AWS keys"],
  ["ZIP", "ZIP codes"],
  ["NUMBER", "Numbers"],
];

const DEFAULT_SETTINGS = {
  useNER: true,
  dummyStats: false,
  enabledTypes: ALL_TYPES.map(([t]) => t).filter((t) => t !== "NUMBER"),
};

let settings = { ...DEFAULT_SETTINGS };
let activeRestore = null; // current map for the Reveal tab

// ---- messaging ----
function send(payload) {
  return chrome.runtime.sendMessage({ target: "background", payload });
}

// ---- elements ----
const el = (id) => document.getElementById(id);
const input = el("input");
const output = el("output");
const outputWrap = el("outputWrap");
const legend = el("legend");
const cloakBtn = el("cloakBtn");
const warmup = el("warmup");

// ---- settings persistence ----
async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) settings = { ...DEFAULT_SETTINGS, ...stored.settings };
}
async function saveSettings() {
  await chrome.storage.local.set({ settings });
}

function settingsForEngine() {
  return {
    useNER: settings.useNER,
    dummyStats: settings.dummyStats,
    // Send as a plain array — a Set does NOT survive chrome.runtime.sendMessage
    // serialization (it arrives as {} on the other side). The engine re-Sets it.
    enabledTypes: Array.isArray(settings.enabledTypes)
      ? settings.enabledTypes
      : [...settings.enabledTypes],
  };
}

// ---- toast ----
let toastTimer;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 1600);
}

// ---- render cloaked output with highlighted placeholders ----
function renderOutput(text) {
  // Highlight [Anything_X] tokens.
  const html = text
    .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
    .replace(/\[[A-Za-z]+_[A-Za-z0-9]+\]/g, (m) => `<span class="ph">${m}</span>`);
  output.innerHTML = html;
}

function renderLegend(entities) {
  legend.innerHTML = "";
  const seen = new Set();
  const unique = entities.filter((e) => {
    if (seen.has(e.placeholder)) return false;
    seen.add(e.placeholder);
    return true;
  });
  if (!unique.length) {
    legend.innerHTML = `<div class="legend-empty">No sensitive data detected.</div>`;
    return;
  }
  for (const e of unique) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-ph">${e.placeholder}</span>
      <span class="legend-arrow">←</span>
      <span class="legend-val" title="${escapeAttr(e.value)}">${escapeHtml(e.value)}</span>
      <span class="legend-type">${e.type}</span>`;
    legend.appendChild(row);
  }
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, "&quot;");

// ---- cloak flow ----
async function doCloak() {
  const text = input.value.trim();
  if (!text) { toast("Nothing to cloak"); return; }

  cloakBtn.disabled = true;
  cloakBtn.textContent = "Cloaking…";
  warmup.hidden = false;
  warmup.textContent = settings.useNER ? "Loading on-device model…" : "Scanning…";

  try {
    const res = await send({ type: "CLOAK", text, settings: settingsForEngine() });
    if (!res?.ok) throw new Error(res?.error || "failed");

    activeRestore = res.restore;

    renderOutput(res.cloaked);
    renderLegend(res.entities);
    outputWrap.hidden = false;

    // Persist the whole working state so it survives closing the popup,
    // switching tabs, or navigating away — the user copies, leaves, comes
    // back, and pastes. Stored locally on-device only.
    await chrome.storage.local.set({
      lastState: {
        input: text,
        cloaked: res.cloaked,
        entities: res.entities,
        restore: res.restore,
      },
    });

    if (settings.useNER && !res.nerAvailable) {
      toast("Model unavailable — used pattern detection");
    }
  } catch (e) {
    toast("Error: " + (e.message || e));
  } finally {
    cloakBtn.disabled = false;
    cloakBtn.textContent = "Cloak it";
    warmup.hidden = true;
  }
}

// ---- clear flow ----
async function doClear() {
  input.value = "";
  output.innerHTML = "";
  legend.innerHTML = "";
  outputWrap.hidden = true;
  activeRestore = null;
  // also clear the reveal side
  const ai = el("aiInput");
  if (ai) ai.value = "";
  el("revealOut").textContent = "";
  el("revealOutWrap").hidden = true;
  await chrome.storage.local.remove("lastState");
  toast("Cleared");
}

// ---- reveal flow ----
async function doReveal() {
  const aiInput = el("aiInput");
  const text = aiInput.value;
  if (!text.trim()) { toast("Paste the AI's response first"); return; }
  if (!activeRestore || !Object.keys(activeRestore).length) {
    el("noMap").hidden = false;
    return;
  }
  el("noMap").hidden = true;
  const res = await send({ type: "REHYDRATE", text, restore: activeRestore });
  if (!res?.ok) { toast("Error: " + res?.error); return; }
  el("revealOut").textContent = res.text;
  el("revealOutWrap").hidden = false;
}

// ---- copy helpers ----
async function copy(text) {
  await navigator.clipboard.writeText(text);
  toast("Copied");
}

// ---- tabs ----
function switchTab(which) {
  const cloak = which === "cloak";
  el("tabCloak").classList.toggle("active", cloak);
  el("tabReveal").classList.toggle("active", !cloak);
  el("tabCloak").setAttribute("aria-selected", cloak);
  el("tabReveal").setAttribute("aria-selected", !cloak);
  el("cloakView").hidden = !cloak;
  el("revealView").hidden = cloak;
}

// ---- settings UI ----
function buildTypeGrid() {
  const grid = el("typeGrid");
  grid.innerHTML = "";
  for (const [type, label] of ALL_TYPES) {
    const chip = document.createElement("label");
    chip.className = "type-chip";
    const checked = settings.enabledTypes.includes(type);
    chip.innerHTML = `<input type="checkbox" data-type="${type}" ${checked ? "checked" : ""}/><span>${label}</span>`;
    grid.appendChild(chip);
  }
  grid.addEventListener("change", (e) => {
    const t = e.target.dataset.type;
    if (!t) return;
    const set = new Set(settings.enabledTypes);
    e.target.checked ? set.add(t) : set.delete(t);
    settings.enabledTypes = [...set];
    saveSettings();
  });
}

function syncSettingsUI() {
  el("optNER").checked = settings.useNER;
  el("optDummy").checked = settings.dummyStats;
  buildTypeGrid();
}

// ---- init ----
async function init() {
  await loadSettings();
  syncSettingsUI();

  // Restore the last cloak state so the workflow carries across tab switches,
  // navigation, and reopening the popup.
  const stored = await chrome.storage.local.get("lastState");
  if (stored.lastState) {
    const s = stored.lastState;
    if (s.input) input.value = s.input;
    if (s.cloaked) {
      renderOutput(s.cloaked);
      renderLegend(s.entities || []);
      outputWrap.hidden = false;
    }
    if (s.restore) activeRestore = s.restore;
  }

  // context-menu selection, if any (overrides restored input)
  const pending = await chrome.storage.session.get("pendingSelection");
  if (pending.pendingSelection) {
    input.value = pending.pendingSelection;
    await chrome.storage.session.remove("pendingSelection");
  }

  // wire events
  cloakBtn.addEventListener("click", doCloak);
  el("revealBtn").addEventListener("click", doReveal);
  el("clearBtn").addEventListener("click", doClear);
  el("copyOut").addEventListener("click", () => copy(output.textContent));
  el("copyReveal").addEventListener("click", () => copy(el("revealOut").textContent));
  el("tabCloak").addEventListener("click", () => switchTab("cloak"));
  el("tabReveal").addEventListener("click", () => switchTab("reveal"));
  el("settingsBtn").addEventListener("click", () => (el("settings").hidden = false));
  el("closeSettings").addEventListener("click", () => (el("settings").hidden = true));
  el("optNER").addEventListener("change", (e) => { settings.useNER = e.target.checked; saveSettings(); });
  el("optDummy").addEventListener("change", (e) => { settings.dummyStats = e.target.checked; saveSettings(); });

  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") doCloak();
  });

  // listen for warmup progress
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.target === "ui" && msg.type === "WARMUP_PROGRESS") {
      warmup.textContent = `Loading model… ${msg.progress}%`;
    }
  });

  // kick a warmup so first cloak is fast
  if (settings.useNER) send({ type: "WARMUP" }).catch(() => {});
}

init();
