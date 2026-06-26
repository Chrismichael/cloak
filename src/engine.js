// engine.js
// Orchestrates the three detection layers into one cloak() call.
// Layer 1: regex structured PII (instant, deterministic)
// Layer 2: local NER semantic PII (people/orgs/locations)
// Layer 3: number/stat detection (optional dummying)

import { detectStructured, detectNumbers } from "./detectors.js";
import { detectSemantic } from "./ner.js";
import { cloak as cloakText } from "./pseudonymizer.js";

// settings: { useNER, dummyStats, enabledTypes: Set<string> }
async function processText(text, settings, progressCb) {
  const structured = detectStructured(text);

  let semantic = [];
  let nerAvailable = false;
  if (settings.useNER) {
    const res = await detectSemantic(text, progressCb);
    semantic = res.entities;
    nerAvailable = res.nerAvailable;
  }

  let numbers = [];
  if (settings.dummyStats) {
    numbers = detectNumbers(text);
  }

  const arr = (x) => (Array.isArray(x) ? x : []);
  let all = [...arr(structured), ...arr(semantic), ...arr(numbers)];

  // Respect per-type toggles. enabledTypes can be a Set, an array (from JSON
  // storage), or — if storage got weird — something non-iterable. Coerce safely.
  if (settings.enabledTypes != null) {
    let enabled;
    if (settings.enabledTypes instanceof Set) {
      enabled = settings.enabledTypes;
    } else if (Array.isArray(settings.enabledTypes)) {
      enabled = new Set(settings.enabledTypes);
    } else if (typeof settings.enabledTypes === "object") {
      // e.g. {0:"PER",1:"ORG"} rehydrated oddly — take the values
      enabled = new Set(Object.values(settings.enabledTypes));
    } else {
      enabled = null;
    }
    if (enabled) all = all.filter((m) => enabled.has(m.type));
  }

  const result = cloakText(text, all, { dummyStats: settings.dummyStats });
  return { ...result, nerAvailable };
}

export { processText };
