// detectors.js
// Deterministic, structured-PII detection. Pure regex + algorithmic validation.
// No network, no model — runs instantly. This is the high-confidence layer.
//
// Every detector returns matches as { start, end, value, type } so the
// pseudonymizer can build a consistent placeholder map across the whole text.

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

// Luhn check kills the overwhelming majority of false-positive "card numbers"
// (order IDs, tracking numbers, etc.) that happen to be 13-19 digits.
function luhnValid(numStr) {
  const digits = numStr.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ISO 7064 mod-97 check for IBANs.
function ibanValid(iban) {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 15 || clean.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => (c.charCodeAt(0) - 55).toString());
  // mod-97 over a long numeric string, processed in chunks to avoid BigInt cost
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    remainder = parseInt(String(remainder) + expanded.substr(i, 7), 10) % 97;
  }
  return remainder === 1;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------
// Order matters at the merge stage: more specific / higher-confidence types
// win when spans overlap (handled by the resolver in pseudonymizer.js).

const PATTERNS = [
  {
    type: "EMAIL",
    // Pragmatic email matcher — not RFC-complete, deliberately. Catches real-world addresses.
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "IPV4",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
  {
    type: "IPV6",
    regex: /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g,
  },
  {
    type: "SSN",
    // US SSN. Excludes obviously-invalid groups (000, 666, 900-999 area; 00 group; 0000 serial).
    regex: /\b(?!000|666|9\d\d)\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}\b/g,
  },
  {
    type: "PHONE",
    // North American + common international. Requires separators or country code to
    // avoid swallowing arbitrary 10-digit numbers.
    regex: /(?:\+?\d{1,3}[\s.\-]?)?(?:\(\d{3}\)|\d{3})[\s.\-]\d{3}[\s.\-]\d{4}\b/g,
  },
  {
    type: "CREDIT_CARD",
    candidate: /\b(?:\d[ \-]?){13,19}\b/g,
    validate: (m) => luhnValid(m),
  },
  {
    type: "IBAN",
    candidate: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g,
    validate: (m) => ibanValid(m),
  },
  {
    type: "AWS_KEY",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    type: "API_KEY",
    // Common secret-token shapes: sk-..., ghp_..., long hex, JWT-ish.
    regex: /\b(?:sk|pk|rk)[-_][A-Za-z0-9]{16,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
  },
  {
    type: "URL",
    regex: /\bhttps?:\/\/[^\s<>"'\)]+/g,
  },
  {
    type: "ZIP",
    // US ZIP / ZIP+4. Kept lower priority; often a false-positive magnet, so the
    // resolver lets more specific types override it.
    regex: /\b\d{5}(?:-\d{4})?\b/g,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Standalone numbers/stats (currency, percentages, large figures) for the
// optional dummy-stats feature. No model needed — pure pattern.
function detectNumbers(text) {
  const out = [];
  const re = /[$€£]\s?\d[\d,]*(?:\.\d+)?[KMB]?|\b\d[\d,]*(?:\.\d+)?\s?%|\b\d{4,}(?:\.\d+)?\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, value: m[0], type: "NUMBER" });
  }
  return out;
}

function detectStructured(text) {
  const matches = [];
  for (const def of PATTERNS) {
    if (def.regex) {
      let m;
      def.regex.lastIndex = 0;
      while ((m = def.regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, value: m[0], type: def.type });
        if (m.index === def.regex.lastIndex) def.regex.lastIndex++; // guard zero-width
      }
    } else if (def.candidate) {
      let m;
      def.candidate.lastIndex = 0;
      while ((m = def.candidate.exec(text)) !== null) {
        if (!def.validate || def.validate(m[0])) {
          matches.push({ start: m.index, end: m.index + m[0].length, value: m[0], type: def.type });
        }
        if (m.index === def.candidate.lastIndex) def.candidate.lastIndex++;
      }
    }
  }
  return matches;
}

export { detectStructured, detectNumbers, luhnValid, ibanValid, PATTERNS };
