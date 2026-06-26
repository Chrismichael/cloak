# Cloak — Launch Kit (Chrome, Edge, Firefox, GitHub)

Everything to get Cloak live and free, everywhere. Do them in this order.
Store-listing copy and the privacy policy are in the `store/` folder.

────────────────────────────────────────────────────────
## BEFORE YOU START — make the upload zip
────────────────────────────────────────────────────────

The stores want a zip whose TOP LEVEL is `manifest.json` (not a folder).

1. Build fresh:  `npm install && npm run fetch-model && npm run build`
2. In Finder, open the `dist` folder.
3. Select ALL the items INSIDE dist (manifest.json, background.js, src, models, icons) — not the dist folder itself.
4. Right-click → Compress. You get `Archive.zip`. Rename it `cloak-1.0.2.zip`.
5. Verify: double-click the zip; manifest.json should be right there at the top.

You'll reuse this same zip for Chrome and Edge. Firefox needs a tiny tweak (see its section).

You also need (take tonight):
- 1–5 screenshots of the popup, sized 1280×800 or 640×400 (PNG/JPG).
  Tip: open the popup, screenshot it, paste onto a 1280×800 canvas (Preview/any editor) with a solid background.
- The privacy policy hosted at a public URL (see GitHub section for a free way to host it).


════════════════════════════════════════════════════════
## 1) CHROME WEB STORE   (biggest audience — do first)
════════════════════════════════════════════════════════

### A. One-time account setup
1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in. Use a dedicated Google account for the business if you can.
3. Pay the one-time **$5** registration fee (covers up to 20 extensions, forever).
4. Set Publisher name ("yForest.ai") and verify your contact email.

### B. Upload
1. Click **Add new item**.
2. Choose file → your `cloak-1.0.2.zip` → Upload.
3. It parses the manifest and pulls in name, version, icons.

### C. Store listing tab
Paste from `store/STORE-LISTING.md`:
- Name, Summary, Description
- Category: Productivity
- Language: English
- Upload your screenshots (and the 128px icon if asked)

### D. Privacy practices tab  (this is where Cloak wins)
- **Single purpose**: paste the line from STORE-LISTING.md.
- **Permission justifications**: paste the four (storage, offscreen, contextMenus, clipboardWrite) from STORE-LISTING.md.
- **Data usage**: certify you do NOT collect, sell, or transfer data (all true — it's on-device).
- **Privacy policy URL**: the public URL where you hosted `privacy-policy.html`.

### E. Submit
1. Click **Submit for review**.
2. In the dialog you can let it auto-publish after approval, or publish manually.
3. Review for a new developer + ML model: expect a few days, sometimes up to ~2 weeks.

**What helps you pass fast (you already do all of this):**
- No host permissions, no `<all_urls>`, no network access — low-risk profile.
- Code isn't obfuscated (bundled Transformers.js is fine).
- Honest, minimal permissions with clear justifications.

If rejected: you get an email saying why. Fix, re-upload, resubmit. Not a big deal.


════════════════════════════════════════════════════════
## 2) MICROSOFT EDGE ADD-ONS   (same zip, second audience)
════════════════════════════════════════════════════════

Edge runs Chrome extensions as-is. Same `cloak-1.0.2.zip`.

1. Go to: https://partner.microsoft.com/dashboard/microsoftedge
2. Register a developer account — **free** (no fee, unlike Chrome).
3. **Create new extension** → upload the same zip.
4. Fill in listing (reuse the Chrome copy from STORE-LISTING.md), add screenshots, privacy policy URL.
5. Submit. Edge review is usually faster than Chrome.

That's a second store with ~10 minutes of extra work.


════════════════════════════════════════════════════════
## 3) FIREFOX ADD-ONS (AMO)   (needs one small manifest tweak)
════════════════════════════════════════════════════════

Firefox supports MV3 but needs an `id`. Make a SEPARATE zip for Firefox:

1. Copy your project, and in `manifest.json` add this block (anywhere top-level):

   "browser_specific_settings": {
     "gecko": { "id": "cloak@yforest.ai", "strict_min_version": "121.0" }
   }

2. Rebuild and zip the same way (contents of dist, manifest at top level).
   Name it `cloak-1.0.2-firefox.zip`.
3. Go to: https://addons.mozilla.org/developers/
4. Register — **free**.
5. **Submit a New Add-on** → upload the Firefox zip.
6. Choose "On this site" (listed on AMO).
7. Fill listing (reuse copy), screenshots, privacy policy.
8. Submit. Firefox often reviews quickly; sometimes automated.

Note: the offscreen-document API differs slightly on Firefox. If NER misbehaves
there, the extension still falls back to regex detection (structured PII works),
so it remains useful while you tweak. Chrome/Edge are your primary targets.


════════════════════════════════════════════════════════
## 4) GITHUB   (free, open, and a free privacy-policy host)
════════════════════════════════════════════════════════

Two birds: publish the source AND host your privacy policy for free.

### A. Put the code up
1. Create a new public repo, e.g. `yforest/cloak`.
2. Push the project. IMPORTANT — do NOT commit these (they're huge/rebuildable):
   add a `.gitignore` with:
       node_modules/
       dist/
       models/
3. People build it themselves with the README steps (npm install / fetch-model / build).

### B. Host the privacy policy free with GitHub Pages
1. In the repo, put `store/privacy-policy.html` at `docs/privacy.html` (or repo root).
2. Repo Settings → Pages → Source: main branch, /docs folder → Save.
3. Your policy is now live at:
       https://yforest.github.io/cloak/privacy.html
   Use THAT as the privacy-policy URL in all three stores (or point yforest.ai/cloak/privacy at it).

### C. (optional) Attach a built zip as a Release
- Releases → Draft a new release → attach `cloak-1.0.2.zip` so non-developers can grab it.
  (They still can't one-click install from a zip — that's Chrome's side-load limit — but it's there for the curious and for Edge/Firefox manual installs.)


────────────────────────────────────────────────────────
## QUICK CHECKLIST
────────────────────────────────────────────────────────
[ ] Screenshots taken (1280×800)
[ ] privacy-policy.html hosted at a public URL
[ ] cloak-1.0.2.zip made (manifest at top level)
[ ] Chrome: $5 paid, uploaded, listing + privacy filled, submitted
[ ] Edge: free account, same zip uploaded, submitted
[ ] Firefox: id added, separate zip, submitted
[ ] GitHub: repo pushed with .gitignore, Pages hosting the policy

Built by yForest.ai · free, no ads, no paid tiers.
