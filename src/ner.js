// ner.js
// Semantic detection (people, companies, locations) via a quantized BERT-NER
// model running 100% locally through Transformers.js. This is the layer that
// catches what regex structurally cannot.
//
// HARD PRIVACY CONTRACT (enforced below):
//   env.allowRemoteModels = false  -> never fetch a model over the network
//   env.localModelPath           -> load only from the bundled extension files
//   wasmPaths -> chrome.runtime.getURL  -> ONNX runtime served from the package
// If the model files aren't present, NER degrades gracefully and the regex
// layer still runs. Nothing ever leaves the device.

import { pipeline, env } from "@huggingface/transformers";

// --- Lock the runtime to local-only BEFORE anything loads. ---
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chromeURL("models/");
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chromeURL("models/");
  // Single-threaded, no proxy: most reliable in an offscreen/worker context.
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
}

function chromeURL(path) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return new URL(`../${path}`, self.location.href).toString();
}

const MODEL_ID = "distilbert-NER-ONNX"; // bundled at models/distilbert-NER-ONNX/ — distilled, small
let nerPipeline = null;
let loadState = "idle"; // idle | loading | ready | failed
let lastLoadError = null;

async function ensureNER(progressCb) {
  if (loadState === "ready") return nerPipeline;
  if (loadState === "loading") {
    // wait for in-flight load
    while (loadState === "loading") await new Promise((r) => setTimeout(r, 50));
    return loadState === "ready" ? nerPipeline : null;
  }
  loadState = "loading";

  // Transformers.js v4's dtype string maps to a filename. We bundle the int8
  // weights under both model_quantized.onnx and model_q8.onnx, so try the dtype
  // strings that map to those. First that loads wins.
  // We bundle the int8 weights as model_int8.onnx. Pin device to wasm and try
  // the dtype strings that map to that file.
  const dtypesToTry = ["int8", "q8", "quantized"];
  for (const dtype of dtypesToTry) {
    try {
      nerPipeline = await pipeline("token-classification", MODEL_ID, {
        dtype,
        device: "wasm",
        progress_callback: progressCb,
      });
      loadState = "ready";
      console.log(`[Cloak] NER model loaded (dtype: ${dtype})`);
      return nerPipeline;
    } catch (e) {
      lastLoadError = e;
      console.warn(`[Cloak] NER load failed for dtype '${dtype}':`, e?.message || e);
    }
  }
  console.warn("[Cloak] NER unavailable after all attempts:", lastLoadError?.message || lastLoadError);
  loadState = "failed";
  return null;
}

// BERT NER emits IOB-tagged word pieces (B-PER, I-PER, B-ORG ...). Merge
// consecutive pieces of the same entity back into whole spans, then locate them
// in the source text. Works whether or not the model provides char offsets.
function mergeTokens(rawTokens, text) {
  // Normalize to a flat array of token objects.
  let tokens = rawTokens;
  if (!Array.isArray(tokens)) {
    if (tokens && Array.isArray(tokens[0])) tokens = tokens[0];
    else if (tokens && typeof tokens === "object") tokens = Object.values(tokens);
    else tokens = [];
  }
  if (tokens.length && Array.isArray(tokens[0])) tokens = tokens.flat();

  // Group consecutive same-type tokens into entity word-groups.
  const groups = [];
  let cur = null;
  const flush = () => { if (cur) { groups.push(cur); cur = null; } };

  for (const t of tokens) {
    if (!t || typeof t !== "object") continue;
    const tag = t.entity || t.entity_group || "O";
    if (tag === "O" || tag === "0") { flush(); continue; }

    const [iob, rawType] = tag.includes("-") ? tag.split("-") : ["B", tag];
    const type = rawType; // PER | ORG | LOC | MISC
    const score = typeof t.score === "number" ? t.score : 1;
    // Word piece: prefer .word, fall back to .text. Strip BERT's "##" continuation.
    let piece = (t.word ?? t.text ?? "").toString();
    const isContinuation = piece.startsWith("##");
    piece = piece.replace(/^##/, "");

    if (iob === "B" || !cur || cur.type !== type) {
      flush();
      cur = { type, words: [piece], scores: [score], hasOffsets: t.start != null, start: t.start, end: t.end };
    } else {
      // same entity continues
      cur.words.push(isContinuation ? piece : " " + piece);
      cur.scores.push(score);
      if (t.end != null) cur.end = t.end;
    }
  }
  flush();

  // Resolve each group to a {type,start,end,value} span in the original text.
  const out = [];
  let searchFrom = 0;
  for (const g of groups) {
    const avgScore = g.scores.reduce((a, b) => a + b, 0) / g.scores.length;
    if (avgScore < 0.6) continue;

    // If the model gave reliable offsets, use them.
    if (g.hasOffsets && g.end != null && g.end > g.start) {
      const value = text.slice(g.start, g.end).trim();
      if (value.length > 1) out.push({ type: g.type, start: g.start, end: g.end, value });
      continue;
    }

    // Otherwise reconstruct the phrase and find it in the text.
    const phrase = g.words.join("").replace(/\s+/g, " ").trim();
    if (phrase.length < 2) continue;
    // Try to locate it (case-insensitive), progressing through the text so
    // repeated names map to successive occurrences.
    const idx = text.toLowerCase().indexOf(phrase.toLowerCase(), searchFrom);
    if (idx !== -1) {
      out.push({ type: g.type, start: idx, end: idx + phrase.length, value: text.slice(idx, idx + phrase.length) });
      searchFrom = idx + phrase.length;
    } else {
      // fall back to a global search if sequential search missed it
      const gidx = text.toLowerCase().indexOf(phrase.toLowerCase());
      if (gidx !== -1) {
        out.push({ type: g.type, start: gidx, end: gidx + phrase.length, value: text.slice(gidx, gidx + phrase.length) });
      }
    }
  }
  return out;
}

async function detectSemantic(text, progressCb) {
  const nlp = await ensureNER(progressCb);
  if (!nlp) return { entities: [], nerAvailable: false };
  try {
    const raw = await nlp(text);
    const entities = mergeTokens(raw, text);
    return { entities: Array.isArray(entities) ? entities : [], nerAvailable: true };
  } catch (e) {
    console.warn("[Cloak] NER inference failed, using regex only:", e?.message || e);
    return { entities: [], nerAvailable: false };
  }
}

function nerStatus() {
  return loadState;
}

export { detectSemantic, ensureNER, nerStatus, MODEL_ID };
