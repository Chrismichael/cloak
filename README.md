<div align="center">

# 🟧 Cloak

### Scrub PII & company data from text before you paste it into AI.

**100% on-device. Nothing you type ever leaves your browser.**

A free Chrome extension by [yForest.ai](https://yforest.ai)

</div>

---

## The problem

You paste work into ChatGPT, Claude, or Gemini without thinking — and client names, colleagues, emails, account numbers, and internal figures go right along with it. Once it's sent, it's gone.

**Cloak catches that data first.** It runs entirely on your own machine: no servers, no accounts, no network calls. The detection model is bundled inside the extension. Nothing you type — and nothing Cloak detects — is ever transmitted anywhere.

## How it works

1. **Paste** what you want to send to the AI into Cloak.
2. **Cloak** replaces sensitive details with consistent placeholders — `Sarah Chen` -> `[Person_A]`, `Meridian Capital` -> `[Company_1]` — everywhere they appear.
3. **Copy** the safe version into any AI tool.
4. **Reveal** — paste the AI's reply back into Cloak and your real values are restored in one click.

Because the same value always maps to the same placeholder, the AI keeps track of who's who and gives you a coherent answer — unlike tools that just black everything out.

```
Input:    Hi, this is Sarah Chen from Meridian Capital, john@acme.com,
          card 4532 0151 1283 0366
Cloaked:  Hi, this is [Person_A] from [Company_1], [Email_1], card [Card_1]
          (send to AI, get a reply that uses the placeholders)
Reveal:   ...restores Sarah Chen, Meridian Capital, john@acme.com, etc.
```

## What it detects

**Structured (regex + validation):** emails, phone numbers, credit cards (Luhn-checked), bank accounts / IBANs, Social Security numbers, IP addresses, API keys, AWS keys, URLs, ZIP codes.

**Semantic (on-device AI model):** names of people, company / organization names, locations.

Plus optional dummy-value replacement for numbers and statistics. You choose which categories to cloak.

## Why on-device matters

The whole point of Cloak is that it protects your data from leaving your machine — so it would defeat the purpose to send your text to *another* server to scan it. Cloak's detection model is bundled and runs locally via [Transformers.js](https://github.com/huggingface/transformers.js) and ONNX. The privacy guarantee is enforced in code:

```js
env.allowRemoteModels = false;                          // never fetch over the network
env.localModelPath = chrome.runtime.getURL("models/");  // load only bundled files
```

No telemetry. No analytics. No host permissions. The extension can't even read the pages you visit.

## Install

**From the Chrome Web Store:** _(link coming once published)_

**Build it yourself:**

```bash
git clone https://github.com/yforest/cloak.git
cd cloak
npm install
npm run fetch-model    # downloads the NER model + ONNX runtime (~85MB, one time)
npm run build          # bundles everything into dist/
```

Then load it in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. **Load unpacked** -> select the `dist/` folder

Also works in Microsoft Edge (same build) and Firefox (minor manifest tweak — see `LAUNCH-KIT.md`).

## How it's built

```
popup --> background (service worker) --> offscreen document --> engine
 UI            lifecycle + proxy            hosts the model        detection
                                                                       |
                              regex detectors - local NER - pseudonymizer
```

- **`src/detectors.js`** — structured PII via regex with Luhn / IBAN validation
- **`src/ner.js`** — names, orgs, locations via a quantized DistilBERT model, locked to offline
- **`src/pseudonymizer.js`** — consistent placeholders, overlap resolution, reversible re-hydration
- **`src/engine.js`** — orchestrates the layers
- Inference runs in an **offscreen document** so the UI never blocks

## Privacy

Cloak collects nothing. [Read the full privacy policy](https://yforest.github.io/cloak/privacy.html).

## License

MIT © [yForest.ai](https://yforest.ai)
