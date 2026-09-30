# GEOWENGAS Quote Builder

A phone app (installable web app) for making GEOWENGAS Event Solutions quotations, sending them as PDFs on WhatsApp, and collecting client signatures.

Everything is stored on the phone that uses it. Nothing is sent to any server.

## What's in here

| File | What it is |
| --- | --- |
| `index.html`, `app.js` | The quote builder your mum uses |
| `sign.html` | The page clients open from the "Send for signature" link |
| `core.js` | Shared code: quote layout, PDF, totals, check code |
| `styles.css` | All styling |
| `sw.js`, `manifest.webmanifest`, icons | Offline support, auto-update and the home-screen icon |
| `vendor/` | The PDF library (jsPDF + AutoTable), kept here so it works offline |

## Turn on GitHub Pages (once)

1. Repo → **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**. Save.
3. After a minute or two the app is live at `https://<your-username>.github.io/geowengas-quotes/`.

## Install on Mum's phone (once)

**Android (Chrome):** open the link → tap **⋮** (top right) → **Add to Home screen** (or **Install app**) → **Install**.
**iPhone (Safari):** open the link → tap **Share** → **Add to Home Screen** → **Add**.

A GEOWENGAS icon appears on the home screen. It opens full-screen and works without internet after the first visit.

## How updates work

Change any file and commit it to `main`. GitHub Pages republishes in about a minute. The next time Mum opens the app with internet, she gets the new version automatically. Her quotes, price list and quote count stay on her phone.

**Don't** rename the repo or move the files into a subfolder. Her saved data is tied to the web address, so a new address starts with an empty app.

If you change the list of files the app needs offline, update `CORE` in `sw.js` and bump `CACHE` (e.g. `gw-quotes-v2`).

## Everyday use

- **Save** keeps the quote on the phone. **Send PDF** saves it, marks it Sent and opens the share menu so she can pick WhatsApp.
- **See quote** shows the finished quote exactly as the client will see it.
- **More → Send for signature** sends the client a link. They review the quote, sign with a finger and send the signed PDF back.
- **More → Record a signed quote** opens the signed PDF the client sent back. The quote is marked Accepted if the prices match what was sent, or flagged if they don't.
- **More → Back up everything** saves all quotes, the price list and the quote count to one file. Do this now and then and keep the file somewhere safe (e.g. send it to yourself on WhatsApp). **More → Restore a backup** loads it on a new phone.

## Business details

The business name, phone numbers, email, address and conditions are at the top of `core.js` (`BIZ` and `STD_CONDS`). The price list starts with example rates; change them in the app under **More → Price list**.
