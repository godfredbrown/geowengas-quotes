/**
 * GEOWENGAS Quote Builder → Google Drive
 *
 * Saves every signed quotation, invoice and receipt PDF into the Drive folder
 * "Geowengas Quotations and Invoices" (created if it doesn't exist).
 *
 * Setup: see google-drive/SETUP.md in the repo.
 */

const FOLDER_NAME = "Geowengas Quotations and Invoices";
const FOLDER_ID = "";        // optional: paste the folder's ID here to pin it (from its Drive URL)
const UPLOAD_KEY = "XxkFTWluQnou906QKKYblu3s";   // must match DRIVE_UPLOAD.key in core.js
const MAX_BYTES = 10 * 1024 * 1024;

// Receipts: only phones that know this PIN can register a receipt for QR checks.
// Change it to your own PIN (and enter the same PIN in the app under More → Receipt PIN).
const ISSUER_PIN = "CHANGE-ME";
const REGISTER_NAME = "GEOWENGAS Receipts Register";
const REGISTER_HEAD = ["Receipt No", "Code", "Date", "Received From", "Amount (GHC)", "Payment Method", "Reference",
  "For / Description", "Invoice No", "Quote No", "Balance Due (GHC)", "Quote Total (GHC)", "Issued At", "PDF", "Status"];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.key !== UPLOAD_KEY) return reply({ ok: false, error: "not allowed" });
    if (data.action === "receipt" && (ISSUER_PIN === "CHANGE-ME" || String(data.pin || "") !== ISSUER_PIN)) {
      return reply({ ok: false, error: "wrong pin" });
    }

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
      if (data.action === "receipt") return reply(saveReceipt(folder, name, bytes, data.receipt || {}));
      const existing = folder.getFilesByName(name);
      if (existing.hasNext()) {
        const f = existing.next();
        return reply({ ok: true, duplicate: true, url: f.getUrl() });
      }
      const file = folder.createFile(Utilities.newBlob(bytes, "application/pdf", name));
      file.setDescription(data.kind === "invoice"
        ? "Invoice " + (data.no || "") + " (quote " + (data.quote || "") + ") for " + (data.name || "") +
          ", dated " + (data.date || "") + ", total GHC " + (data.total || "") + ". Uploaded from " + (data.from || "app") + "."
        : "Quote " + (data.no || "") + " signed by " + (data.name || "") +
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

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === "verify") return reply(verifyReceipt(String(p.no || ""), String(p.code || "")));
  return reply({ ok: true, app: "geowengas-drive", folder: FOLDER_NAME });
}

function getRegister(folder) {
  const it = folder.getFilesByName(REGISTER_NAME);
  let ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else {
    ss = SpreadsheetApp.create(REGISTER_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    const sh = ss.getSheets()[0];
    sh.setName("Receipts");
    sh.getRange(1, 1, 1, REGISTER_HEAD.length).setValues([REGISTER_HEAD]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return ss.getSheets()[0];
}

function saveReceipt(folder, name, bytes, r) {
  const no = String(r.no || "").toUpperCase(), code = String(r.code || "").toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(no) || !/^[A-Z0-9]{8}$/.test(code)) return { ok: false, error: "bad receipt" };
  const sh = getRegister(folder);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toUpperCase() === no) {
      return String(rows[i][1]).toUpperCase() === code ? { ok: true, duplicate: true } : { ok: false, error: "receipt number already used" };
    }
  }
  let url = "";
  const existing = folder.getFilesByName(name);
  url = existing.hasNext() ? existing.next().getUrl() : folder.createFile(Utilities.newBlob(bytes, "application/pdf", name)).getUrl();
  const t = v => String(v == null ? "" : v).slice(0, 500);
  sh.appendRow([no, code, t(r.date), t(r.receivedFrom), Number(r.amount) || 0, t(r.method), t(r.ref), t(r.desc),
    t(r.invoiceNo), t(r.quoteNo), Number(r.balance) || 0, Number(r.total) || 0, t(r.issuedAt), url, "Valid"]);
  return { ok: true, url: url };
}

function verifyReceipt(no, code) {
  no = no.trim().toUpperCase(); code = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!no || code.length !== 8) return { ok: true, valid: false };
  const sh = getRegister(getFolder());
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[0]).toUpperCase() === no && String(row[1]).toUpperCase() === code && String(row[14] || "Valid") !== "Cancelled") {
      const d = row[2] instanceof Date ? Utilities.formatDate(row[2], "GMT", "yyyy-MM-dd") : String(row[2]);
      return { ok: true, valid: true, receipt: { no: row[0], date: d, receivedFrom: row[3], amount: row[4], method: row[5], ref: row[6],
        desc: row[7], invoiceNo: row[8], quoteNo: row[9], balance: row[10], total: row[11] } };
    }
  }
  return { ok: true, valid: false };
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
  Logger.log("Receipts register: " + getRegister(getFolder()).getParent().getUrl());
}
