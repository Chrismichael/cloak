// pseudonymizer.js
// Turns raw text + detected entities into cloaked text with consistent,
// reversible placeholders. The restore map is what makes the round-trip work:
// paste the AI's answer back in and real values are re-hydrated.
//
// Design goals:
//  - Same real value -> same placeholder, everywhere (coreference preserved).
//  - Placeholders survive a trip through an LLM (it won't rewrite "Person_A").
//  - Overlapping detections resolve by confidence, longest-match, then priority.
//  - Stats can be dummied to plausible-but-fake numbers so prompts stay coherent.

// Higher number = wins when spans overlap.
const TYPE_PRIORITY = {
  CREDIT_CARD: 100,
  IBAN: 95,
  SSN: 95,
  AWS_KEY: 90,
  API_KEY: 90,
  EMAIL: 80,
  PHONE: 70,
  IPV6: 65,
  IPV4: 60,
  URL: 55,
  // NER-supplied semantic types
  PER: 50,
  ORG: 48,
  LOC: 45,
  MISC: 30,
  ZIP: 20, // lowest — easily overridden by SSN/phone/card fragments
};

// Human-friendly label stems per type.
const LABELS = {
  CREDIT_CARD: "Card",
  IBAN: "Account",
  SSN: "SSN",
  AWS_KEY: "AWSKey",
  API_KEY: "ApiKey",
  EMAIL: "Email",
  PHONE: "Phone",
  IPV4: "IP",
  IPV6: "IP",
  URL: "URL",
  PER: "Person",
  ORG: "Company",
  LOC: "Location",
  MISC: "Item",
  ZIP: "Zip",
  NUMBER: "Number",
};

// Letter suffix for people (Person_A), numeric for everything else (Company_1).
function suffixFor(type, index) {
  if (type === "PER") {
    // A, B, ... Z, AA, AB ...
    let n = index;
    let s = "";
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  }
  return String(index + 1);
}

// Resolve overlapping spans into a clean, non-overlapping, left-to-right list.
function resolveOverlaps(matches) {
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA; // longer first
    return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
  });

  const kept = [];
  for (const m of sorted) {
    const conflict = kept.find((k) => m.start < k.end && m.end > k.start);
    if (!conflict) {
      kept.push(m);
      continue;
    }
    // Overlap: keep the higher-priority span; if equal, keep the longer one.
    const pNew = TYPE_PRIORITY[m.type] || 0;
    const pOld = TYPE_PRIORITY[conflict.type] || 0;
    if (pNew > pOld || (pNew === pOld && m.end - m.start > conflict.end - conflict.start)) {
      kept.splice(kept.indexOf(conflict), 1);
      kept.push(m);
    }
  }
  return kept.sort((a, b) => a.start - b.start);
}

// Generate a plausible dummy stat so numeric context stays believable.
// Deterministic per-value (same figure -> same dummy) and shape-preserving:
// keeps currency symbol, decimal places, and K/M/B magnitude suffixes so a
// prompt like "$4.2M" becomes "$7.8M", not "$96".
function dummyNumber(original) {
  const trimmed = original.trim();
  const currency = /^[$€£]/.test(trimmed) ? trimmed[0] : "";
  const isPercent = /%\s*$/.test(trimmed);
  const suffixMatch = trimmed.match(/([KMB])\s*$/i);
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : "";

  // stable seed from the original
  let seed = 0;
  for (let i = 0; i < original.length; i++) seed = (seed * 31 + original.charCodeAt(i)) >>> 0;
  const rnd = (max) => (seed = (seed * 1103515245 + 12345) >>> 0) % max;

  if (isPercent) {
    // mirror whether the original had a decimal
    const dec = /\.\d/.test(trimmed);
    const v = dec ? (1 + rnd(98)) + (rnd(10) / 10) : 1 + rnd(98);
    return `${v}%`;
  }

  // strip formatting to learn the shape
  const core = trimmed.replace(/[^\d.]/g, "");
  const [intPart, decPart] = core.split(".");

  if (suffix) {
    // abbreviated magnitude: keep one decimal like "7.8M"
    const whole = 1 + rnd(9);
    const frac = rnd(10);
    return `${currency}${whole}.${frac}${suffix}`;
  }

  // full number: preserve digit count and decimals, regenerate digits
  let newInt = (1 + rnd(9)).toString();
  for (let i = 1; i < Math.max(intPart.length, 1); i++) newInt += rnd(10).toString();
  let result = Number(newInt).toLocaleString();
  if (decPart !== undefined) {
    let newDec = "";
    for (let i = 0; i < decPart.length; i++) newDec += rnd(10).toString();
    result += "." + newDec;
  }
  return `${currency}${result}`;
}

// Main entry. Returns cloaked text + a restore map for re-hydration.
//   options.dummyStats: replace standalone NUMBER entities with fake figures.
function cloak(text, matches, options = {}) {
  const resolved = resolveOverlaps(matches);

  // value -> placeholder (so identical values reuse the same token)
  const valueToPlaceholder = new Map();
  // placeholder -> original value (the restore map)
  const restore = {};
  // per-type running counters
  const counters = {};

  for (const m of resolved) {
    const key = `${m.type}::${m.value.trim().toLowerCase()}`;
    if (!valueToPlaceholder.has(key)) {
      const idx = counters[m.type] || 0;
      counters[m.type] = idx + 1;
      let placeholder;
      if (m.type === "NUMBER" && options.dummyStats) {
        placeholder = dummyNumber(m.value);
      } else {
        const stem = LABELS[m.type] || "Item";
        placeholder = `[${stem}_${suffixFor(m.type, idx)}]`;
      }
      valueToPlaceholder.set(key, placeholder);
      // dummy numbers aren't reversible by design (they're fake), so skip restore
      if (!(m.type === "NUMBER" && options.dummyStats)) {
        restore[placeholder] = m.value;
      }
    }
  }

  // Rebuild text left-to-right, swapping spans for placeholders.
  let out = "";
  let cursor = 0;
  for (const m of resolved) {
    const key = `${m.type}::${m.value.trim().toLowerCase()}`;
    out += text.slice(cursor, m.start);
    out += valueToPlaceholder.get(key);
    cursor = m.end;
  }
  out += text.slice(cursor);

  return {
    cloaked: out,
    restore,
    entities: resolved.map((m) => ({
      type: m.type,
      value: m.value,
      placeholder: valueToPlaceholder.get(`${m.type}::${m.value.trim().toLowerCase()}`),
    })),
  };
}

// Re-hydrate: given an AI response containing placeholders, restore real values.
// Longest placeholders first so [Person_AA] isn't clobbered by [Person_A].
function rehydrate(text, restore) {
  const keys = Object.keys(restore).sort((a, b) => b.length - a.length);
  let out = text;
  for (const ph of keys) {
    // Escape regex metacharacters in the placeholder.
    const esc = ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(esc, "g"), restore[ph]);
  }
  return out;
}

export { cloak, rehydrate, resolveOverlaps, dummyNumber, TYPE_PRIORITY, LABELS };
