// background.js
// Service worker. Manages the offscreen document lifecycle and proxies jobs
// from the popup to the offscreen engine. Also registers a context-menu entry
// so users can cloak selected text from any page.

const OFFSCREEN_PATH = "src/offscreen.html";

let creating = null; // concurrency guard — avoid double-creation races

async function ensureOffscreen() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });
  if (existing.length > 0) return;

  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["WORKERS"],
    justification: "Runs the local PII detection model off the main thread. No network access.",
  });
  try {
    await creating;
  } finally {
    creating = null;
  }
}

// Proxy a message to the offscreen document and await its reply.
async function callOffscreen(payload) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: "offscreen", ...payload });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "background") return false;
  (async () => {
    try {
      const res = await callOffscreen(msg.payload);
      sendResponse(res);
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true;
});

// Warm the model up shortly after install so first use is snappy.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cloak-selection",
    title: "Cloak selected text",
    contexts: ["selection", "editable"],
  });
  ensureOffscreen()
    .then(() => callOffscreen({ type: "WARMUP" }))
    .catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "cloak-selection" || !info.selectionText) return;
  // Open the popup pre-filled by stashing the selection.
  await chrome.storage.session.set({ pendingSelection: info.selectionText });
  if (chrome.action.openPopup) {
    chrome.action.openPopup().catch(() => {});
  }
});
