# Save signed quotes to Google Drive (one-time setup, ~5 minutes)

Every signed quotation is saved to the Drive folder **Geowengas Quotations and Invoices**.

1. Go to **https://script.google.com** (signed in with the Google account that owns the folder) and click **New project**.
2. Name the project `GEOWENGAS Drive upload`.
3. Delete everything in `Code.gs`, then paste in the whole of `google-drive/Code.gs` from this repo. Save.
4. In the toolbar, choose the function **testSetup** and click **Run**. Google asks for permission:
   **Review permissions → your account → Advanced → Go to GEOWENGAS Drive upload (unsafe) → Allow.**
   (It says "unsafe" only because you wrote the script yourself and Google hasn't reviewed it.)
   The log then shows the folder link.
5. Click **Deploy → New deployment**. Click the gear next to "Select type" and pick **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. Send that URL to Claude, or paste it into `DRIVE_UPLOAD.url` at the top of `core.js` and commit.

## How it works

- When a client taps **Accept & send back**, the signed PDF is sent straight to the folder, as well as to WhatsApp.
- When Mum uses **More → Record a signed quote**, the PDF is sent to the folder too, as a backup in case the client's phone was offline. The same file is never saved twice.

## Changing the script later

Edit `Code.gs`, then **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**. The URL stays the same.

## Security note

The upload address and key are inside the public app, so the script only accepts real PDFs under 10 MB with a proper file name, and never overwrites existing files. Nobody can read, list or delete your Drive files through it.

## Receipts and QR verification (one-time, after updating the script)

Receipts are registered in a Google Sheet called **GEOWENGAS Receipts Register** (created automatically in the same folder). The QR code on each receipt opens `verify.html`, which checks the receipt number and code against that sheet.

1. Paste the latest `google-drive/Code.gs` into your Apps Script project.
2. Change `ISSUER_PIN = "CHANGE-ME"` to a PIN of your own. Keep it private; it is never stored in this public repo.
3. Run **testSetup** once and allow the new permission (Google Sheets). The log shows the register link.
4. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** The web app URL stays the same.
5. On Mum's phone, open the app → **More → Receipt PIN** and enter the same PIN.

To cancel a receipt, change its **Status** cell in the register to `Cancelled`. Its QR check will then say it is not genuine.
