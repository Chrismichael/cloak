// offscreen.js
// Runs in the offscreen document. Owns the model + engine. Receives jobs from
// the service worker, returns results. Keeps the (relatively heavy) model in
// one place, shared across every popup invocation for the install.

import { processText } from "./engine.js";
import { rehydrate } from "./pseudonymizer.js";
import { ensureNER, nerStatus } from "./ner.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen") return false;

  (async () => {
    try {
      switch (msg.type) {
        case "WARMUP": {
          // Preload the model so the first real cloak is fast. Stream progress.
          await ensureNER((p) => {
            if (p?.status === "progress") {
              chrome.runtime.sendMessage({
                target: "ui",
                type: "WARMUP_PROGRESS",
                progress: Math.round(p.progress || 0),
                file: p.file,
              });
            }
          });
          sendResponse({ ok: true, ner: nerStatus() });
          break;
        }
        case "CLOAK": {
          const result = await processText(msg.text, msg.settings, (p) => {
            if (p?.status === "progress") {
              chrome.runtime.sendMessage({
                target: "ui",
                type: "WARMUP_PROGRESS",
                progress: Math.round(p.progress || 0),
                file: p.file,
              });
            }
          });
          sendResponse({ ok: true, ...result });
          break;
        }
        case "REHYDRATE": {
          sendResponse({ ok: true, text: rehydrate(msg.text, msg.restore) });
          break;
        }
        default:
          sendResponse({ ok: false, error: "unknown message type" });
      }
    } catch (e) {
      // Surface the location so a remaining crash can be pinpointed.
      const where = (e?.stack || "").split("\n")[1]?.trim() || "";
      sendResponse({ ok: false, error: (e?.message || String(e)) + (where ? ` @ ${where}` : "") });
    }
  })();

  return true; // async response
});
