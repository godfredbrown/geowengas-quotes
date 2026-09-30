/**
 * GEOWENGAS Quote Builder → Google Drive
 *
 * Saves every signed quotation PDF into the Drive folder
 * "Geowengas Quotations and Invoices" (created if it doesn't exist).
 *
 * Setup: see google-drive/SETUP.md in the repo.
 */

const FOLDER_NAME = "Geowengas Quotations and Invoices";
const FOLDER_ID = "";        // optional: paste the folder's ID here to pin it (from its Drive URL)
const UPLOAD_KEY = "XxkFTWluQnou906QKKYblu3s";   // must match DRIVE_UPLOAD.key in core.js
const MAX_BYTES = 10 * 1024 * 1024;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.key !== UPLOAD_KEY) return reply({ ok: false, error: "not allowed" });

    const name = String(data.filename || "");
    if (!/^[\w\-. ]{1,150}\.pdf$/i.test(name)) return reply({ ok: false, error: "bad file name" });

    const bytes = Utilities.base64Decode(String(data.pdf || ""));
    if (!bytes.length || bytes.length > MAX_BYTES) return reply({ ok: false, error: "bad size" });
    const head = String.fromCharCode.apply(null, bytes.slice(0, 5).map(function (b) { return b & 0xff; }));
    if (head !== "%PDF-") return reply({ ok: false, error: "not a pdf" });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const folder = getFolder();
      const existing = folder.getFilesByName(name);
      if (existing.hasNext()) {
        const f = existing.next();
        return reply({ ok: true, duplicate: true, url: f.getUrl() });
      }
      const file = folder.createFile(Utilities.newBlob(bytes, "application/pdf", name));
      file.setDescription(
        "Quote " + (data.no || "") + " signed by " + (data.name || "") +
        " on " + (data.date || "") + ". Check code " + (data.check || "") +
        ". Uploaded from " + (data.from || "app") + "."
      );
      return reply({ ok: true, url: file.getUrl() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, app: "geowengas-drive", folder: FOLDER_NAME });
}

function getFolder() {
  if (FOLDER_ID) return DriveApp.getFolderById(FOLDER_ID);
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run this once from the editor to grant Drive access and check the folder. */
function testSetup() {
  Logger.log("Signed quotes will be saved to: " + getFolder().getUrl());
}
