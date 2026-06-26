# Cloak — Chrome Web Store Listing (copy/paste)

Everything below is ready to paste into the matching field in the Chrome Web Store
Developer Dashboard. Publisher: **yForest.ai**.

---

## Name (45 char max)
Cloak — Scrub PII before AI

## Summary (132 char max)
Strip names, emails, numbers & company data from text before you paste it into ChatGPT, Claude or Gemini. 100% on your device.

## Category
Productivity

## Language
English

---

## Description (up to 16,000 char)

Cloak removes sensitive information from your text before it ever reaches an AI tool — and runs entirely on your own device.

Pasting work into ChatGPT, Claude, or Gemini is easy to do without thinking. Client names, colleagues, email addresses, account numbers, internal figures — all of it can end up in a prompt. Cloak catches that data first.

HOW IT WORKS

1. Paste what you want to send to the AI into Cloak.
2. Cloak replaces sensitive details with consistent placeholders — "Sarah Chen" becomes [Person_A], "Meridian Capital" becomes [Company_1], and so on — everywhere they appear.
3. Copy the safe version and use it with any AI tool.
4. Paste the AI's reply back into Cloak's Reveal tab to restore your real values in one click.

Because the same value always maps to the same placeholder, the AI keeps track of who's who and gives you a coherent answer — unlike tools that just black everything out.

WHAT IT DETECTS

• Names, companies, and locations (via a local AI model)
• Email addresses and phone numbers
• Credit card numbers (validated, so it won't flag random digits)
• Bank account / IBAN numbers
• Social Security numbers
• IP addresses
• API keys and access tokens
• URLs and ZIP codes
• Numbers and statistics — optionally swapped for realistic dummy values

You choose which categories to cloak.

EVERYTHING STAYS ON YOUR DEVICE

Cloak has no servers, no accounts, no analytics, and no network access. The detection model is bundled inside the extension and runs locally. Nothing you type — and nothing Cloak detects — is ever sent anywhere. The mapping used to restore your values lives only in your current session and is never saved to disk.

FREE

Cloak is free, with no paid tiers and no ads.

Built by yForest.ai — https://yforest.ai

---

## Privacy policy URL
https://yforest.ai/cloak/privacy
(Host the included store/privacy-policy.html at this address before submitting.)

---

## Single purpose (required field)
Cloak detects and replaces sensitive personal and business information in user-provided text so it can be safely used with AI tools, with all processing performed locally on the user's device.

---

## Permission justifications (paste one per permission)

storage
Used to save the user's own preferences (which categories of data to detect) locally in the browser. No personal data is stored.

offscreen
Used to run the bundled, on-device detection model in a background document so the popup interface stays responsive during processing. The offscreen document has no network access.

contextMenus
Used to add a right-click "Cloak selected text" menu item so users can send selected text into the extension.

clipboardWrite
Used to copy the cloaked output to the user's clipboard when they click the Copy button.

(No host permissions are requested. The extension cannot read or modify the pages you visit.)

---

## Data usage disclosures (Privacy practices tab)

Answer these to match the build:

• Does this item collect or use personal/sensitive user data? — The extension processes
  user-entered text locally but does NOT collect, transmit, or store it remotely. Select
  the options indicating data is handled on-device and not sent to the developer or any
  third party.

• Sold to third parties? — No.
• Used or transferred for purposes unrelated to core functionality? — No.
• Used or transferred to determine creditworthiness / lending? — No.

Certifications (check all three — they are true for Cloak):
✓ I do not sell or transfer user data to third parties outside of approved use cases.
✓ I do not use or transfer user data for purposes unrelated to my item's single purpose.
✓ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Screenshots needed (1280×800 or 640×400, 1–5 of them)
Take real screenshots of the popup:
1. The Cloak tab with sample text entered.
2. The cloaked output with the placeholder legend showing [Person_A] ← Sarah Chen, etc.
3. The Reveal tab restoring an AI response.
4. The Settings panel showing the category toggles + the yForest.ai credit.

Tip: load the extension unpacked, open the popup, and use your OS screenshot tool. If the
popup is narrower than 640px wide, place the screenshot on a 1280×800 canvas with a solid
background so it meets the size requirement.
