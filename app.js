/* GEOWENGAS Quote Builder — the app (index.html). Everything is stored on this phone/browser. */
(function(){
"use strict";
const {BIZ, STD_CONDS, DEPOSIT_RATE, eventDates, esc, num, amt, money, iso, addDays, dmy, longDate, isFilled, totals, checkCode,
  encodeQuote, waNumber, paperHTML, buildPdf, readPdfRef, shareOrDownload, safeName, toast, logoReady} = window.GW;

const DEFAULT_CATALOG = [
  {desc:"White plastic chairs",price:3},
  {desc:"Gold chiavari chairs with cushion",price:15},
  {desc:"Round tables (seat 8–10)",price:25},
  {desc:"Table cloths with overlay",price:15},
  {desc:"Canopy with sides",price:150},
  {desc:"Marquee tent (per section)",price:800},
  {desc:"Chair covers & sashes",price:5},
  {desc:"Stage décor: backdrop, drapes & florals",price:2500},
  {desc:"Floral table centrepieces",price:80},
  {desc:"Sound system with operator",price:1200},
  {desc:"Lighting: uplighters & fairy lights",price:900},
  {desc:"Uniformed ushers (per person)",price:200}
];

const LS = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
};
const mergeName = o => { if(o && o.name != null){ const n=(o.name||"").trim(), d=(o.desc||"").trim(); o.desc = n && d && n!==d ? `${n}: ${d}` : (n||d); delete o.name; } return o; };
const migrateQuote = q => {
  if(!q) return q;
  if(Array.isArray(q.items)) q.items.forEach(mergeName);
  if(q.client && q.client.eventEnd == null) q.client.eventEnd = "";
  if(q.depositAuto == null) q.depositAuto = !num(q.deposit);
  return q;
};
/* Drafts still on the original six conditions get the new seventh one. */
/* Every quote that isn't signed yet gets condition 7 (items beyond repair). */
const COND7 = STD_CONDS[6];
const upgradeConds = q => {
  if(q && Array.isArray(q.conditions) && q.status !== "accepted" && !q.signed && !q.conditions.some(c => (c||"").trim() === COND7)) q.conditions.push(COND7);
  return q;
};

let catalog = LS.get("gw_catalog", null);
const catalogIsExample = !catalog;
catalog = catalog ? catalog.map(c => c.name != null ? {desc:c.name, price:c.price} : c) : DEFAULT_CATALOG.map(x => ({...x}));

const $ = id => document.getElementById(id);
const blankItem = () => ({desc:"", qty:"", price:""});
const savedQuotes = () => LS.get("gw_quotes", []);
const isSaved = q => savedQuotes().some(x => x.id === q.id);

/* ---------- numbering & count ---------- */
const NUM_DEFAULT = {prefix:"QT", yearly:true, start:1, pad:3};
const numCfg = () => ({...NUM_DEFAULT, ...LS.get("gw_numbering", {})});
const thisYear = () => new Date().getFullYear();
const seriesPrefix = (cfg=numCfg()) => { const p = (cfg.prefix||"QT").trim(); return cfg.yearly ? `${p}-${thisYear()}-` : `${p}-`; };
const counterKey = (cfg=numCfg()) => cfg.yearly ? "gw_counter_"+thisYear() : "gw_counter_"+(cfg.prefix||"QT")+"_all";
function seqOf(no, cfg=numCfg()){ const pre = seriesPrefix(cfg); if(!no || !no.startsWith(pre)) return 0; const r = no.slice(pre.length); return /^\d+$/.test(r) ? +r : 0; }
function usedMax(cfg=numCfg()){ let max = LS.get(counterKey(cfg), 0); savedQuotes().forEach(q => { max = Math.max(max, seqOf(q.no, cfg)); }); return max; }
const issuedCount = (cfg=numCfg()) => savedQuotes().filter(q => seqOf(q.no, cfg) > 0).length;
const formatNo = (n, cfg=numCfg()) => seriesPrefix(cfg) + String(n).padStart(+cfg.pad||1, "0");
const nextQuoteNo = (cfg=numCfg()) => formatNo(Math.max(usedMax(cfg)+1, +cfg.start||1), cfg);
function recordNo(no){ const n = seqOf(no); if(n){ const k = counterKey(); LS.set(k, Math.max(LS.get(k,0), n)); } }

/* ---------- quotes ---------- */
function blankQuote(){
  const today = iso(new Date());
  return {id:"q"+Date.now(), no:nextQuoteNo(), date:today, valid:addDays(today,14), status:"draft",
    client:{name:"",phone:"",email:"",event:"",eventDate:"",eventEnd:"",guests:"",venue:""},
    items:[blankItem()], setup:"", delivery:"", discount:"", deposit:"", depositAuto:true,
    scope:"", conditions:STD_CONDS.slice(), example:false};
}
function exampleQuote(){
  const q = blankQuote();
  q.example = true;
  q.client = {name:"Mr. & Mrs. Kwame Asante (example)", phone:"024 000 0000", email:"", event:"Wedding reception", eventDate:addDays(q.date,45), eventEnd:addDays(q.date,46), guests:"200", venue:"Trinity Hall, Dome"};
  q.items = [
    {desc:"Gold chiavari chairs with cushion",qty:"200",price:"15"},
    {desc:"Round tables (seat 8–10)",qty:"20",price:"25"},
    {desc:"Table cloths with gold overlay",qty:"20",price:"15"},
    {desc:"Floral table centrepieces",qty:"20",price:"80"},
    {desc:"Stage décor: backdrop, drapes & florals",qty:"1",price:"2500"},
    {desc:"Canopy with sides",qty:"4",price:"150"}
  ];
  q.setup = "400"; q.delivery = "200";
  q.scope = "Includes setup from 7:00 am on the event day and breakdown after the event.\nExcludes catering, drinks and venue hire.";
  return q;
}
(function(){ const qs = LS.get("gw_quotes", null); if(qs){ qs.forEach(q => upgradeConds(migrateQuote(q))); LS.set("gw_quotes", qs); } })();
let Q = upgradeConds(migrateQuote(LS.get("gw_draft", null))) || (savedQuotes().length ? blankQuote() : exampleQuote());

/* ---------- editor ---------- */
const fieldMap = {qNo:["no"],qDate:["date"],qValid:["valid"],qStatus:["status"],cName:["client","name"],cPhone:["client","phone"],cEmail:["client","email"],cEvent:["client","event"],cGuests:["client","guests"],cVenue:["client","venue"],chSetup:["setup"],chDelivery:["delivery"],chDiscount:["discount"],scope:["scope"]};
const getPath = p => p.length === 1 ? Q[p[0]] : Q[p[0]][p[1]];
const setPath = (p,v) => { if(p.length === 1) Q[p[0]] = v; else Q[p[0]][p[1]] = v; };
function fillFields(){
  for(const id in fieldMap) $(id).value = getPath(fieldMap[id]) ?? "";
  renderDates();
  $("chDepositAuto").checked = !!Q.depositAuto;
  syncDeposit(); renderNoHelp();
}
for(const id in fieldMap){
  $(id).addEventListener("input", e => {
    setPath(fieldMap[id], e.target.value);
    if(id === "qDate" && !Q._validTouched){ Q.valid = addDays(e.target.value,14); $("qValid").value = Q.valid; }
    if(id === "qValid") Q._validTouched = true;
    if(id === "qNo") Q._noEdited = e.target.value.trim() !== nextQuoteNo();
    changed();
  });
}

/* ---------- event date(s): one calendar, tap the first day then the last day ---------- */
function renderDates(){
  const t = eventDates(Q.client);
  $("cDatesText").textContent = t || "Choose one day or a range";
  $("cDates").classList.toggle("empty", !t);
}
$("cDates").onclick = () => openCalendar();
function openCalendar(){
  let start = Q.client.eventDate || "", end = Q.client.eventEnd || "";
  const today = iso(new Date());
  let view = new Date((start || today) + "T00:00:00"); view.setDate(1);
  const draw = () => {
    const y = view.getFullYear(), m = view.getMonth();
    const first = new Date(y, m, 1), days = new Date(y, m+1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday first
    let cells = "";
    for(let k=0;k<lead;k++) cells += `<span></span>`;
    for(let d=1; d<=days; d++){
      const ds = iso(new Date(y, m, d));
      const last = end || start;
      const cls = [ds === today ? "today" : "", ds === start ? "start" : "", ds === last && start ? "end" : "", start && end && ds > start && ds < end ? "mid" : ""].join(" ");
      cells += `<button type="button" class="${cls}" data-d="${ds}" aria-pressed="${ds === start || ds === last}">${d}</button>`;
    }
    const label = !start ? "Tap the first day of the event." : !end ? `${eventDates({eventDate:start})}. Tap the last day, or Done for one day.` : eventDates({eventDate:start, eventEnd:end});
    $("calBody").innerHTML = `
      <div class="cal-head"><button type="button" class="btn sm" data-nav="-1" aria-label="Previous month">‹</button>
        <b>${first.toLocaleDateString("en-GB",{month:"long", year:"numeric"})}</b>
        <button type="button" class="btn sm" data-nav="1" aria-label="Next month">›</button></div>
      <div class="cal-grid cal-wd">${["Mo","Tu","We","Th","Fr","Sa","Su"].map(w => `<span>${w}</span>`).join("")}</div>
      <div class="cal-grid">${cells}</div>
      <p class="cal-sel">${esc(label)}</p>`;
  };
  openModal(`<h3>Event date(s) <button class="btn sm ghost" id="mClose" type="button">Cancel</button></h3>
    <p class="hint">Tap the first day, then the last day. For a one-day event, tap the day once.</p>
    <div id="calBody"></div>
    <div class="confirm"><button class="btn primary" id="calDone" type="button">Done</button><button class="btn ghost" id="calClear" type="button">Clear dates</button></div>`);
  draw();
  $("mClose").onclick = closeModal;
  $("calBody").addEventListener("click", e => {
    const nav = e.target.closest("[data-nav]");
    if(nav){ view.setMonth(view.getMonth() + (+nav.dataset.nav)); draw(); return; }
    const b = e.target.closest("[data-d]"); if(!b) return;
    const d = b.dataset.d;
    if(!start || end){ start = d; end = ""; }          // first tap, or starting over
    else if(d < start){ start = d; }                   // tapped an earlier day: move the start
    else if(d === start){ end = ""; }                  // same day again: one-day event
    else { end = d; }                                  // second tap: the last day
    draw();
  });
  $("calDone").onclick = () => { Q.client.eventDate = start; Q.client.eventEnd = end && end !== start ? end : ""; closeModal(); renderDates(); changed(); };
  $("calClear").onclick = () => { start = ""; end = ""; draw(); };
}

/* ---------- refundable deposit: 15% of the items subtotal, added to the total ---------- */
function syncDeposit(){
  const d = $("chDeposit");
  if(Q.depositAuto){ d.readOnly = true; d.value = totals(Q).dep ? totals(Q).dep.toFixed(2) : ""; }
  else { d.readOnly = false; if(document.activeElement !== d) d.value = Q.deposit ?? ""; }
}
$("chDepositAuto").addEventListener("change", e => {
  Q.depositAuto = e.target.checked;
  if(!Q.depositAuto) Q.deposit = totals({...Q, depositAuto:true}).dep.toFixed(2);
  syncDeposit(); changed();
  if(!Q.depositAuto){ $("chDeposit").focus(); $("chDeposit").select(); }
});
$("chDeposit").addEventListener("input", e => { if(Q.depositAuto) return; Q.deposit = e.target.value; changed(); });

/* ---------- quote number: filled in automatically, can be typed over ---------- */
function ensureQuoteNo(){
  if(Q.example || isSaved(Q) || Q._noEdited) return;
  const next = nextQuoteNo();
  if(Q.no !== next){ Q.no = next; $("qNo").value = next; LS.set("gw_draft", Q); }
}
function renderNoHelp(){
  const h = $("qNoHelp"); if(!h) return;
  const clash = savedQuotes().find(x => x.no === Q.no && x.id !== Q.id);
  const next = nextQuoteNo();
  if(clash){ h.className = "field-help warn"; h.innerHTML = `${esc(Q.no)} is already used by ${esc(clash.client.name || "another quote")}. <button type="button" class="linkbtn" id="qNoFix">Use ${esc(next)}</button>`; }
  else if(!isSaved(Q) && Q.no !== next && !Q.example){ h.className = "field-help"; h.innerHTML = `Typed by hand. <button type="button" class="linkbtn" id="qNoFix">Use the next number (${esc(next)})</button>`; }
  else { h.className = "field-help"; h.innerHTML = isSaved(Q) ? "" : "Filled in automatically. You can type a different one."; }
  const b = $("qNoFix"); if(b) b.onclick = () => { Q.no = nextQuoteNo(); Q._noEdited = false; $("qNo").value = Q.no; changed(); };
}

function renderItems(){
  let h = `<div class="item item-h"><span>Description</span><span style="text-align:right">Qty</span><span style="text-align:right">Unit price</span><span style="text-align:right">Amount</span><span></span></div>`;
  Q.items.forEach((it,i) => {
    h += `<div class="item" data-i="${i}">
      <input class="i-desc" id="it-desc-${i}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="pick" aria-label="Line ${i+1} description" value="${esc(it.desc)}" placeholder="Description">
      <input class="i-qty" id="it-qty-${i}" type="number" min="0" inputmode="numeric" aria-label="Line ${i+1} quantity" value="${esc(it.qty)}" placeholder="Qty">
      <input class="i-price" id="it-price-${i}" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Line ${i+1} unit price" value="${esc(it.price)}" placeholder="Price GHC">
      <span class="amt" id="it-amt-${i}">${money(num(it.qty)*num(it.price))}</span>
      <button class="x" type="button" data-del="${i}" aria-label="Remove line ${i+1}">×</button>
    </div>`;
  });
  $("items").innerHTML = h;
}
$("items").addEventListener("input", e => {
  const row = e.target.closest(".item"); if(!row || row.classList.contains("item-h")) return;
  const i = +row.dataset.i, it = Q.items[i], t = e.target;
  if(t.classList.contains("i-desc")){ it.desc = t.value; openPick(t); }
  if(t.classList.contains("i-qty")) it.qty = t.value;
  if(t.classList.contains("i-price")) it.price = t.value;
  $("it-amt-"+i).textContent = money(num(it.qty)*num(it.price));
  changed();
});
$("items").addEventListener("click", e => {
  const b = e.target.closest("[data-del]"); if(!b) return;
  Q.items.splice(+b.dataset.del, 1);
  if(!Q.items.length) Q.items.push(blankItem());
  renderItems(); changed();
});
$("addRow").onclick = () => { Q.items.push(blankItem()); renderItems(); changed(); $("it-desc-"+(Q.items.length-1)).focus(); };

function renderCatalogBits(){
  $("quick").innerHTML = catalog.map((c,i) => `<button type="button" data-cat="${i}">+ ${esc(c.desc)}</button>`).join("");
}
/* ---------- searchable item picker for the description box ---------- */
const pick = $("pick"); let pickInput = null, pickSel = -1, pickList = [];
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function hl(text, words){
  let out = esc(text);
  words.filter(Boolean).forEach(w => { const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")", "ig"); out = out.replace(re, "<mark>$1</mark>"); });
  return out;
}
function openPick(input){
  pickInput = input;
  const words = norm(input.value).split(/\s+/).filter(Boolean);
  pickList = catalog.map((c,i) => ({c,i})).filter(({c}) => { const d = norm(c.desc); return words.every(w => d.includes(w)); });
  pickSel = -1;
  pick.innerHTML = `<div class="ph">${words.length ? `${pickList.length} matching item${pickList.length === 1 ? "" : "s"}` : "Price list · type to search"}</div>` +
    (pickList.length ? pickList.map((x,k) => `<button type="button" role="option" data-k="${k}" aria-selected="false"><span>${hl(x.c.desc, words)}</span><span>GHC ${amt(x.c.price)}</span></button>`).join("")
      : `<div class="none">Not in the price list. What you typed will be used as the description.</div>`);
  placePick(); pick.hidden = false; input.setAttribute("aria-expanded","true");
}
function placePick(){
  if(!pickInput || pick.hidden && !pickInput) return;
  const r = pickInput.getBoundingClientRect();
  const w = Math.max(r.width, Math.min(420, document.documentElement.clientWidth - 32));
  let left = r.left + window.scrollX; left = Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 16); left = Math.max(window.scrollX + 16, left);
  pick.style.left = left + "px"; pick.style.top = (r.bottom + window.scrollY + 4) + "px"; pick.style.width = w + "px";
}
function closePick(){ pick.hidden = true; if(pickInput) pickInput.setAttribute("aria-expanded","false"); pickInput = null; }
function choosePick(k){
  const x = pickList[k]; if(!x || !pickInput) return;
  const row = pickInput.closest(".item"), i = +row.dataset.i, it = Q.items[i];
  it.desc = x.c.desc; it.price = String(x.c.price); if(!num(it.qty)) it.qty = "1";
  closePick(); renderItems(); changed();
  const q = $("it-qty-"+i); q.focus(); q.select();
}
pick.addEventListener("mousedown", e => e.preventDefault());
pick.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if(b) choosePick(+b.dataset.k); });
$("items").addEventListener("focusin", e => { if(e.target.classList.contains("i-desc")) openPick(e.target); });
$("items").addEventListener("focusout", e => { if(e.target.classList.contains("i-desc")) setTimeout(() => { if(document.activeElement !== pickInput) closePick(); }, 150); });
$("items").addEventListener("keydown", e => {
  if(!e.target.classList.contains("i-desc") || pick.hidden) return;
  const opts = pick.querySelectorAll("[data-k]");
  if(e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); if(!opts.length) return; pickSel = (pickSel + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts.forEach((o,k) => o.setAttribute("aria-selected", k === pickSel)); opts[pickSel].scrollIntoView({block:"nearest"}); }
  else if(e.key === "Enter"){ if(pickSel >= 0){ e.preventDefault(); choosePick(pickSel); } else closePick(); }
  else if(e.key === "Escape"){ closePick(); }
});
window.addEventListener("resize", () => { if(!pick.hidden) placePick(); });
document.addEventListener("scroll", () => { if(!pick.hidden) placePick(); }, true);

$("quick").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if(!b) return;
  const c = catalog[+b.dataset.cat];
  const blank = Q.items.findIndex(it => !isFilled(it));
  const row = {desc:c.desc, qty:"1", price:String(c.price)};
  if(blank >= 0) Q.items[blank] = row; else Q.items.push(row);
  renderItems(); changed();
  const idx = blank >= 0 ? blank : Q.items.length-1; const q = $("it-qty-"+idx); q.focus(); q.select();
});

function renderConds(){
  $("conds").innerHTML = Q.conditions.map((c,i) => `<div class="cond"><span>${i+1}.</span><textarea id="cond-${i}" rows="2" data-c="${i}" aria-label="Condition ${i+1}">${esc(c)}</textarea><button class="x" type="button" data-cdel="${i}" aria-label="Remove condition ${i+1}">×</button></div>`).join("");
}
$("conds").addEventListener("input", e => { if(e.target.dataset.c != null){ Q.conditions[+e.target.dataset.c] = e.target.value; changed(); } });
$("conds").addEventListener("click", e => { const b = e.target.closest("[data-cdel]"); if(!b) return; Q.conditions.splice(+b.dataset.cdel,1); renderConds(); changed(); });
$("addCond").onclick = () => { Q.conditions.push(""); renderConds(); changed(); $("cond-"+(Q.conditions.length-1)).focus(); };
$("resetCond").onclick = () => { Q.conditions = STD_CONDS.slice(); renderConds(); changed(); toast("Standard conditions restored"); };

/* ---------- preview ---------- */
const STATUS_LABEL = {draft:"Draft", sent:"Sent", accepted:"Accepted", declined:"Declined"};
function renderPaper(){
  const t = totals(Q);
  $("paper").innerHTML = paperHTML(Q, Q.signed ? {signature:{name:Q.signed.name, date:Q.signed.date}} : {});
  $("miniSub").textContent = money(t.sub);
  $("miniTot").textContent = money(t.total);
  const chip = `<span class="chip ${Q.status}">${STATUS_LABEL[Q.status]||"Draft"}</span>`;
  $("statusChipWrap").innerHTML = chip; $("pvStatus").innerHTML = chip;
  const si = $("signedInfo");
  if(Q.signed){
    si.hidden = false;
    si.className = Q.signed.ok ? "okbox" : "alert";
    si.textContent = Q.signed.ok
      ? `Signed by ${Q.signed.name} on ${dmy(Q.signed.date)}. Prices match what you sent.`
      : `Signed by ${Q.signed.name} on ${dmy(Q.signed.date)}, but the prices or totals in their copy don't match what you sent. Check their PDF before accepting.`;
  } else si.hidden = true;
  const ii = $("invoiceInfo");
  if(Q.invoice && Q.invoice.sentAt){
    ii.hidden = false;
    ii.textContent = `Invoice ${Q.invoice.no} sent on ${new Date(Q.invoice.sentAt).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}` + (Q.invoice.drive === true ? " · saved to Google Drive" : Q.invoice.drive === false ? " · not yet in Google Drive (send it again to retry)" : "");
  } else ii.hidden = true;
}
function renderCount(){
  const cfg = numCfg(), n = issuedCount(cfg);
  $("cntIssued").textContent = n;
  $("cntLabel").textContent = (n === 1 ? "quote issued" : "quotes issued") + (cfg.yearly ? ` in ${thisYear()}` : " so far");
  $("cntNext").textContent = nextQuoteNo(cfg);
}
let draftTimer;
function changed(){ syncDeposit(); renderNoHelp(); renderPaper(); clearTimeout(draftTimer); draftTimer = setTimeout(() => LS.set("gw_draft", Q), 300); }
function renderAll(){ ensureQuoteNo(); fillFields(); renderItems(); renderConds(); renderCatalogBits(); renderPaper(); renderCount(); }

/* ---------- save / new ---------- */
function saveQuote(silent){
  const list = savedQuotes();
  const copy = JSON.parse(JSON.stringify(Q)); copy.example = false; copy.savedAt = Date.now();
  const i = list.findIndex(x => x.id === Q.id);
  if(i >= 0) list[i] = copy; else list.unshift(copy);
  recordNo(Q.no);
  Q.example = false;
  const ok = LS.set("gw_quotes", list); LS.set("gw_draft", Q); renderPaper(); renderCount(); renderNoHelp();
  if(!silent) toast(ok ? `Saved ${Q.no}` : "Couldn't save. The phone's storage may be full.");
  return ok;
}
$("btnSave").onclick = () => saveQuote(false);
function askNew(){
  openModal(`<h3>Start a new quote?</h3><p class="hint">Save ${esc(Q.no)} first if you want to keep it.</p>
   <div class="confirm"><button class="btn primary" id="mSaveNew" type="button">Save, then start new</button><button class="btn" id="mNew" type="button">Start new without saving</button><button class="btn ghost" id="mCancel" type="button">Cancel</button></div>`);
  $("mCancel").onclick = closeModal;
  $("mSaveNew").onclick = () => { if(!Q.example) saveQuote(true); startNew(); };
  $("mNew").onclick = startNew;
}
function startNew(){ Q = blankQuote(); LS.set("gw_draft", Q); renderAll(); closeModal(); toast(`New quote ${Q.no}`); setView("edit"); window.scrollTo(0,0); }

/* ---------- modal ---------- */
function openModal(html){ $("modalBody").innerHTML = html; $("modal").hidden = false; const f = $("modalBody").querySelector("button,input"); f && f.focus(); }
function closeModal(){ $("modal").hidden = true; $("modalBody").innerHTML = ""; }
$("modal").addEventListener("click", e => { if(e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("modal").hidden) closeModal(); });

/* ---------- More menu ---------- */
$("btnMore").onclick = () => {
  const items = [
    ["new","New quote","Start a fresh quote"],
    ["saved","Saved quotes",`${savedQuotes().length} saved on this phone`],
    ["sign","Send for signature","Client signs on their phone and sends it back"],
    ["signed","Record a signed quote","Open the PDF the client sent back"],
    ["copy","Copy text for WhatsApp","A short summary to paste in a chat"],
    ["download","Download quote PDF","Save the quote PDF on this phone"],
    ["invoice","Send invoice","The quote as an invoice, without signature lines"],
    ["catalog","Price list","Your usual items and rates"],
    ["numbering","Quote numbering","Prefix and where the count continues"],
    ["drive","Check Google Drive link","Signed quotes are saved to Drive"],
    ["backup","Back up everything","Save all quotes to one file"],
    ["restore","Restore a backup","Load quotes from a backup file"]
  ];
  openModal(`<h3>More <button class="btn sm ghost" id="mClose" type="button">Close</button></h3>
    <div class="menu">${items.map(i => `<button type="button" data-m="${i[0]}"><b>${i[1]}</b><span>${i[2]}</span></button>`).join("")}</div>`);
  $("mClose").onclick = closeModal;
  $("modalBody").querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    const m = b.dataset.m; closeModal();
    ({new:askNew, saved:showSaved, sign:sendForSignature, signed:() => $("fileSigned").click(), copy:copySummary,
      download:() => makePdf("download"), invoice:openInvoice, catalog:showCatalog, numbering:showNumbering, drive:checkDriveLink, backup:backup, restore:() => $("fileBackup").click()})[m]();
  });
};

/* ---------- saved quotes ---------- */
function showSaved(){
  const list = savedQuotes();
  const body = list.length ? list.map(q => { const t = totals(q); return `<div class="saved">
      <div style="min-width:0"><div class="t">${esc(q.no)} · ${esc(q.client.name||"No client name")} <span class="chip ${q.status}">${STATUS_LABEL[q.status]||"Draft"}</span></div>
      <div class="s">${esc(q.client.event||"Event")}${q.client.eventDate ? " · "+esc(eventDates(q.client)) : ""} · ${money(t.total)}</div></div>
      <div class="a" data-id="${q.id}"><button class="btn sm primary" data-act="open" type="button">Open</button><button class="btn sm" data-act="dup" type="button">Copy</button><button class="btn sm ghost danger" data-act="del" type="button">Delete</button></div>
    </div>`; }).join("") : `<div class="empty">No saved quotes yet. Fill in a quote and press Save.</div>`;
  openModal(`<h3>Saved quotes <button class="btn sm ghost" id="mClose" type="button">Close</button></h3>
    <p class="hint">Saved on this phone. Use "Back up everything" in More to keep a copy.</p><div class="saved-list">${body}</div>`);
  $("mClose").onclick = closeModal;
  $("modalBody").querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
    const id = b.parentElement.dataset.id, act = b.dataset.act, all = savedQuotes(), q = all.find(x => x.id === id); if(!q) return;
    if(act === "open"){ Q = upgradeConds(migrateQuote(JSON.parse(JSON.stringify(q)))); LS.set("gw_draft", Q); renderAll(); closeModal(); toast(`Opened ${Q.no}`); }
    if(act === "dup"){ const n = migrateQuote(JSON.parse(JSON.stringify(q))); n.id = "q"+Date.now(); n.no = nextQuoteNo(); n.date = iso(new Date()); n.valid = addDays(n.date,14); n.status = "draft"; delete n._validTouched; delete n._noEdited; delete n.invoice; upgradeConds(n); delete n.signed; delete n.sentCheck; Q = n; LS.set("gw_draft", Q); renderAll(); closeModal(); toast(`Copied into new quote ${Q.no}`); }
    if(act === "del"){
      const wrap = b.parentElement; wrap.innerHTML = `<span class="confirm">Delete ${esc(q.no)}? <button class="btn sm danger" type="button" data-yes>Delete</button><button class="btn sm ghost" type="button" data-no>Keep</button></span>`;
      wrap.querySelector("[data-yes]").onclick = () => { LS.set("gw_quotes", all.filter(x => x.id !== id)); renderCount(); showSaved(); toast(`Deleted ${q.no}`); };
      wrap.querySelector("[data-no]").onclick = showSaved;
    }
  });
}

/* ---------- price list ---------- */
function showCatalog(){
  const rows = catalog.map((c,i) => `<div class="cat" data-i="${i}"><input id="cat-d-${i}" data-k="desc" value="${esc(c.desc)}" aria-label="Description"><input id="cat-p-${i}" data-k="price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(c.price)}" aria-label="Unit price GHC"><button class="x" type="button" data-cx="${i}" aria-label="Remove">×</button></div>`).join("");
  openModal(`<h3>Price list <button class="btn sm ghost" id="mClose" type="button">Done</button></h3>
    <p class="hint">${catalogIsExample && !LS.get("gw_catalog", null) ? "These are example items and rates. Change them to your own." : "Your usual items and rates in GHC."}</p>
    <div class="cat item-h"><span>Description</span><span style="text-align:right">Price GHC</span><span></span></div>
    <div id="catRows" style="display:flex;flex-direction:column;gap:6px">${rows}</div>
    <div><button class="btn sm" id="catAdd" type="button">+ Add item</button></div>`);
  $("mClose").onclick = () => { catalog = catalog.filter(c => c.desc.trim()); LS.set("gw_catalog", catalog); renderCatalogBits(); closeModal(); };
  $("catRows").addEventListener("input", e => { const r = e.target.closest(".cat"), k = e.target.dataset.k; catalog[+r.dataset.i][k] = k === "price" ? num(e.target.value) : e.target.value; LS.set("gw_catalog", catalog); renderCatalogBits(); });
  $("catRows").addEventListener("click", e => { const b = e.target.closest("[data-cx]"); if(!b) return; catalog.splice(+b.dataset.cx,1); LS.set("gw_catalog", catalog); renderCatalogBits(); showCatalog(); });
  $("catAdd").onclick = () => { catalog.push({desc:"", price:0}); showCatalog(); $("cat-d-"+(catalog.length-1)).focus(); };
}

/* ---------- numbering ---------- */
$("btnNumbering").onclick = showNumbering;
function showNumbering(){
  const cfg = numCfg(), used = usedMax(cfg);
  openModal(`<h3>Quote numbering <button class="btn sm ghost" id="mClose" type="button">Cancel</button></h3>
    <p class="hint">Set the format and where the count continues from, for example after your paper quote books.</p>
    <div class="grid">
      <div class="f"><label for="nPrefix">Prefix</label><input id="nPrefix" value="${esc(cfg.prefix)}" maxlength="10"></div>
      <div class="f"><label for="nNext">Next number</label><input id="nNext" type="number" min="1" inputmode="numeric" value="${Math.max(used+1, +cfg.start||1)}"></div>
      <div class="f"><label for="nPad">Digits</label><select id="nPad">${[1,2,3,4,5].map(d => `<option value="${d}" ${+cfg.pad===d?"selected":""}>${d} (${String(7).padStart(d,"0")})</option>`).join("")}</select></div>
    </div>
    <label class="check"><input type="checkbox" id="nYearly" ${cfg.yearly?"checked":""}> Include the year and restart the count every January</label>
    <div><div style="font-size:13px;color:var(--muted)">Next quote will be</div><div class="num-preview" id="nPreview"></div></div>
    <p class="hint" id="nWarn" hidden></p>
    <div class="confirm"><button class="btn primary" id="nSave" type="button">Save numbering</button></div>`);
  $("mClose").onclick = closeModal;
  const read = () => ({prefix:($("nPrefix").value.trim()||"QT").replace(/\s+/g,"-"), yearly:$("nYearly").checked, pad:+$("nPad").value, start:Math.max(1, Math.floor(num($("nNext").value))||1)});
  const upd = () => {
    const c = read(), u = usedMax(c), n = Math.max(u+1, c.start);
    $("nPreview").textContent = formatNo(n, c);
    $("nWarn").hidden = !(c.start <= u);
    $("nWarn").textContent = `Numbers up to ${formatNo(u,c)} are already used, so the count continues from ${formatNo(u+1,c)}.`;
  };
  ["nPrefix","nNext","nPad","nYearly"].forEach(id => $(id).addEventListener("input", upd)); upd();
  $("nSave").onclick = () => {
    const c = read(); LS.set("gw_numbering", c);
    if(!isSaved(Q)){ Q.no = nextQuoteNo(c); $("qNo").value = Q.no; changed(); }
    renderCount(); closeModal(); toast(`Numbering saved. Next quote: ${nextQuoteNo(c)}`);
  };
}

/* ---------- PDF: send / download ---------- */
function pdfName(q){ return `${q.no}_${safeName(q.client.name)||"Client"}.pdf`; }
async function makePdf(mode){
  if(!window.jspdf || !window.jspdf.jsPDF){ toast("The PDF tool didn't load. Close the app and open it again."); return; }
  if(!Q.items.some(isFilled)){ toast("Add at least one item first."); return; }
  await logoReady;
  let doc;
  try{ doc = buildPdf(Q, {fillable:true}); }
  catch(e){ console.error(e); toast("Couldn't make the PDF. Check the quote for unusual characters."); return; }
  if(!Q.example){ if(Q.status === "draft" && mode === "send") Q.status = "sent"; saveQuote(true); fillFields(); renderPaper(); }
  const blob = doc.output("blob"), name = pdfName(Q);
  if(mode === "download"){ window.GW.downloadBlob(blob, name); toast(`Downloaded ${name}`); return; }
  const r = await shareOrDownload(blob, name, `Hello${Q.client.name ? " "+Q.client.name.replace(/\(example\)/i,"").trim() : ""}, please find your quotation ${Q.no} from GEOWENGAS Event Solutions.`);
  if(r === "downloaded") toast(`Downloaded ${name}. Attach it in WhatsApp.`, 4500);
}
$("btnSend").onclick = () => makePdf("send");
$("btnSend2").onclick = () => makePdf("send");

/* ---------- invoices: the quote without signature lines, numbered INV-… ---------- */
function invoiceNoFor(q){
  if(q.invoice && q.invoice.no) return q.invoice.no;
  const n = String(q.no||"").replace(/^[A-Za-z]+(?=-)/, "INV");
  return n === q.no ? "INV-" + q.no : n;
}
function invoiceFor(q){ return {no: invoiceNoFor(q), date: (q.invoice && q.invoice.date) || iso(new Date())}; }
$("btnInvoice").onclick = openInvoice;
$("btnInvoice2").onclick = openInvoice;
function openInvoice(){
  if(!Q.items.some(isFilled)){ toast("Add at least one item first."); return; }
  if(Q.example){ toast("This is the example quote. Start a new quote for a real client."); return; }
  const inv = invoiceFor(Q), t = totals(Q);
  const again = Q.invoice && Q.invoice.sentAt;
  openModal(`<h3>Send invoice <button class="btn sm ghost" id="mClose" type="button">Cancel</button></h3>
    <div class="inv-sum">
      <span>Invoice no.</span><b>${esc(inv.no)}</b>
      <span>For quote</span><b>${esc(Q.no)}</b>
      <span>Client</span><b>${esc(Q.client.name || "No client name")}</b>
      <span>Total</span><b>${money(t.total)}</b>
    </div>
    ${again ? `<p class="hint">This invoice was already sent on ${esc(new Date(Q.invoice.sentAt).toLocaleDateString("en-GB"))}. Sending again uses the same invoice number.</p>` : ""}
    <p class="hint">The invoice is the quote without the signature lines. A copy is saved to Google Drive.</p>
    <div class="confirm">
      <button class="btn primary" id="invSend" type="button">Send invoice</button>
      <button class="btn" id="invDownload" type="button">Download</button>
      <button class="btn ghost" id="invPrev" type="button">See invoice</button>
    </div>
    <div class="inv-paper" id="invPaper" hidden><div class="paper">${paperHTML(Q, {invoice:inv, minRows:0})}</div></div>`);
  $("mClose").onclick = closeModal;
  $("invPrev").onclick = () => { const p = $("invPaper"); p.hidden = !p.hidden; $("invPrev").textContent = p.hidden ? "See invoice" : "Hide invoice"; };
  $("invSend").onclick = () => sendInvoice("send");
  $("invDownload").onclick = () => sendInvoice("download");
}
async function sendInvoice(mode){
  if(!window.jspdf || !window.jspdf.jsPDF){ toast("The PDF tool didn't load. Close the app and open it again."); return; }
  await logoReady;
  const inv = invoiceFor(Q);
  let doc;
  try{ doc = buildPdf(Q, {invoice:inv}); }
  catch(e){ console.error(e); toast("Couldn't make the invoice. Check the quote for unusual characters."); return; }
  const blob = doc.output("blob");
  const check = checkCode(Q);
  const changed_ = Q.invoice && Q.invoice.check && Q.invoice.check !== check;
  const stamp = new Date(); const suffix = changed_ ? `_updated-${iso(stamp).replace(/-/g,"")}-${String(stamp.getHours()).padStart(2,"0")}${String(stamp.getMinutes()).padStart(2,"0")}` : "";
  const name = window.GW.invoiceFileName(inv.no, Q.client.name, suffix);
  Q.invoice = {...(Q.invoice||{}), no:inv.no, date:inv.date, sentAt:Date.now(), check};
  saveQuote(true); renderPaper();
  closeModal();
  if(mode === "download"){ window.GW.downloadBlob(blob, name); toast(`Downloaded ${name}`); }
  else {
    const first = (Q.client.name||"").trim();
    const r = await shareOrDownload(blob, name, `Hello${first ? " "+first : ""}, please find your invoice ${inv.no} from GEOWENGAS Event Solutions (total ${money(totals(Q).total)}). Payment details are on the invoice.`);
    if(r === "downloaded") toast(`Downloaded ${name}. Attach it in WhatsApp.`, 4500);
  }
  // copy to Google Drive
  if(window.GW.driveEnabled()){
    const id = Q.id;
    const up = await window.GW.uploadSigned(blob, name, {kind:"invoice", no:inv.no, quote:Q.no, name:Q.client.name||"", date:inv.date, total:totals(Q).total.toFixed(2), check, from:"Mum's app"});
    const list = savedQuotes(), i = list.findIndex(x => x.id === id);
    if(i >= 0){ list[i].invoice = {...(list[i].invoice||{}), drive: up.ok}; LS.set("gw_quotes", list); }
    if(Q.id === id){ Q.invoice.drive = up.ok; LS.set("gw_draft", Q); renderPaper(); }
    setTimeout(() => toast(up.ok ? `Invoice ${inv.no} saved to Google Drive.` : "Couldn't reach Google Drive. Send the invoice again later to save it there.", 4000), mode === "download" ? 1200 : 2500);
  }
}

/* ---------- send for signature ---------- */
$("btnSign2").onclick = sendForSignature;
async function sendForSignature(){
  if(!Q.items.some(isFilled)){ toast("Add at least one item first."); return; }
  if(Q.example){ toast("This is the example quote. Start a new quote for a real client."); return; }
  const enc = await encodeQuote(Q);
  const link = new URL("sign.html", location.href).href + "#q=" + enc;
  Q.sentCheck = checkCode(Q);
  if(Q.status === "draft") Q.status = "sent";
  saveQuote(true); fillFields(); renderPaper();
  const first = (Q.client.name||"").replace(/\(example\)/i,"").trim();
  const msg = `Hello${first ? " "+first : ""}, here is your quotation ${Q.no} from GEOWENGAS Event Solutions (total ${money(totals(Q).total)}).\n\nPlease open the link to review it, sign with your finger and send it back to us:\n${link}`;
  const wa = waNumber(Q.client.phone);
  openModal(`<h3>Send for signature <button class="btn sm ghost" id="mClose" type="button">Close</button></h3>
    <p class="hint">The client opens the link, signs on their phone and sends the signed PDF back to you. When it arrives, use <b>More → Record a signed quote</b>.</p>
    <div class="menu">
      ${wa ? `<a class="btn primary" style="text-align:center;text-decoration:none" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp to ${esc(Q.client.phone)}</a>` : ""}
      <button class="btn ${wa ? "" : "primary"}" id="sgShare" type="button">Share with another app</button>
      <button class="btn" id="sgCopy" type="button">Copy the message</button>
    </div>
    ${wa ? "" : '<p class="hint">Add the client\'s phone number to send it straight to their WhatsApp.</p>'}`);
  $("mClose").onclick = closeModal;
  $("sgShare").onclick = async () => {
    if(navigator.share){ try{ await navigator.share({text:msg}); return; }catch(e){ if(e.name === "AbortError") return; } }
    copyText(msg, "Message copied. Paste it into WhatsApp.");
  };
  $("sgCopy").onclick = () => copyText(msg, "Message copied. Paste it into WhatsApp.");
}
async function copyText(text, okMsg){
  try{ await navigator.clipboard.writeText(text); toast(okMsg); }
  catch(e){
    openModal(`<h3>Copy this <button class="btn sm ghost" id="mClose" type="button">Close</button></h3><p class="hint">Press and hold in the box, then choose Copy.</p><textarea id="copyBox" rows="12" readonly>${esc(text)}</textarea>`);
    $("mClose").onclick = closeModal; const b = $("copyBox"); b.focus(); b.select();
  }
}

/* ---------- record a signed quote ---------- */
$("fileSigned").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  const ref = await readPdfRef(f);
  if(!ref){ toast("That PDF wasn't made by this app, so it can't be matched to a quote.", 4500); return; }
  if(ref.kind === "invoice"){ toast(`That's invoice ${ref.invoice}, not a signed quote.`, 4500); return; }
  if(!ref.signed){ toast(`That's the unsigned copy of ${ref.no}. Ask the client to sign it using the link.`, 4500); return; }
  const list = savedQuotes();
  const i = list.findIndex(x => x.id === ref.id) >= 0 ? list.findIndex(x => x.id === ref.id) : list.findIndex(x => x.no === ref.no);
  if(i < 0){ toast(`Quote ${ref.no} isn't saved on this phone.`, 4500); return; }
  const q = migrateQuote(list[i]);
  const ok = ref.check === (q.sentCheck || checkCode(q));
  q.signed = {name:ref.name, date:ref.date, ok, at:Date.now()};
  if(ok) q.status = "accepted";
  list[i] = q; LS.set("gw_quotes", list);
  Q = JSON.parse(JSON.stringify(q)); LS.set("gw_draft", Q); renderAll();
  toast(ok ? `${q.no} marked Accepted. Signed by ${ref.name}.` : `${q.no} was signed, but the prices don't match. Please check it.`, 5000);
  if(window.GW.driveEnabled()){
    const r = await window.GW.uploadSigned(f, window.GW.signedFileName(ref.no, ref.name), {no:ref.no, name:ref.name, date:ref.date, check:ref.check, from:"Mum's app"});
    setTimeout(() => toast(r.ok ? (r.duplicate ? "Already saved in Google Drive." : "Saved to Google Drive.") : "Couldn't reach Google Drive. It's still recorded here; try again later.", 4000), 5200);
  }
});

async function checkDriveLink(){
  toast("Checking Google Drive…");
  const r = await window.GW.checkDrive();
  toast(r.ok ? `Google Drive is connected. Signed quotes go to "${r.folder}".` : "Can't reach Google Drive right now. Check the internet, or the Apps Script deployment.", 5000);
}

/* ---------- WhatsApp text ---------- */
function summaryText(){
  const t = totals(Q), c = Q.client;
  const lines = [`*${BIZ.name} EVENT SOLUTIONS*`, `Quotation ${Q.no}`, `Date: ${dmy(Q.date)} · Valid until: ${dmy(Q.valid)}`, ""];
  if(c.name) lines.push(`Client: ${c.name}`);
  if(c.event) lines.push(`Event: ${c.event}${c.eventDate ? " – "+eventDates(c) : ""}`);
  if(c.venue) lines.push(`Venue: ${c.venue}`);
  if(c.guests) lines.push(`Guests: ${c.guests}`);
  lines.push("", "*Items*");
  Q.items.filter(isFilled).forEach(i => lines.push(`• ${i.desc} — ${i.qty||0} × ${money(i.price)} = ${money(num(i.qty)*num(i.price))}`));
  lines.push("", `Subtotal: ${money(t.sub)}`, `Setup: ${money(t.setup)}`, `Transportation: ${money(t.del)}`, `Refundable deposit: ${money(t.dep)}`);
  if(t.disc) lines.push(`Discount: −${money(t.disc)}`);
  lines.push(`*ESTIMATED TOTAL: ${money(t.total)}*`);
  if((Q.scope||"").trim()) lines.push("", Q.scope.trim());
  lines.push("", "*Payment Methods*");
  window.GW.PAYMENT.forEach(m => { lines.push(`_${m.title}_`); m.accounts.forEach(a => lines.push(`• ${a.head}: ${a.lines.map(l => l[1]).join(", ")}`)); });
  lines.push("", "Full payment is required before delivery. Full conditions are on the PDF quote.", "", BIZ.phones.replace(/\s+\|\s+/, " / "), BIZ.tagline);
  return lines.join("\n");
}
function copySummary(){ copyText(summaryText(), "Summary copied. Paste it into WhatsApp."); }

/* ---------- backup / restore ---------- */
function allCounters(){ const out = {}; try{ for(let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if(k.startsWith("gw_counter_")) out[k] = LS.get(k,0); } }catch(e){} return out; }
async function backup(){
  const data = {app:"geowengas-quotes", version:1, exportedAt:new Date().toISOString(), quotes:savedQuotes(), catalog, numbering:LS.get("gw_numbering",null), counters:allCounters(), draft:Q};
  const blob = new Blob([JSON.stringify(data, null, 1)], {type:"application/json"});
  const name = `geowengas-backup-${iso(new Date())}.json`;
  const r = await shareOrDownload(blob, name, "GEOWENGAS quotes backup");
  if(r === "downloaded") toast(`Backup saved as ${name}`, 4000);
  else if(r === "shared") toast("Backup shared");
}
$("fileBackup").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  let data; try{ data = JSON.parse(await f.text()); }catch(err){ toast("That file isn't a GEOWENGAS backup."); return; }
  if(!data || data.app !== "geowengas-quotes"){ toast("That file isn't a GEOWENGAS backup."); return; }
  openModal(`<h3>Restore backup?</h3><p class="hint">This backup from ${esc(new Date(data.exportedAt).toLocaleString("en-GB"))} has ${data.quotes.length} quotes. They'll be added to the quotes on this phone; where both have the same quote, the newer copy is kept. The price list will be replaced with the one in the backup.</p>
    <div class="confirm"><button class="btn primary" id="rsYes" type="button">Restore</button><button class="btn ghost" id="rsNo" type="button">Cancel</button></div>`);
  $("rsNo").onclick = closeModal;
  $("rsYes").onclick = () => {
    const list = savedQuotes();
    data.quotes.forEach(q => { migrateQuote(q); const i = list.findIndex(x => x.id === q.id); if(i < 0) list.push(q); else if((q.savedAt||0) > (list[i].savedAt||0)) list[i] = q; });
    list.sort((a,b) => (b.savedAt||0) - (a.savedAt||0));
    LS.set("gw_quotes", list);
    if(Array.isArray(data.catalog)){ catalog = data.catalog.map(c => c.name != null ? {desc:c.name, price:c.price} : c); LS.set("gw_catalog", catalog); }
    if(data.numbering) LS.set("gw_numbering", data.numbering);
    Object.entries(data.counters||{}).forEach(([k,v]) => LS.set(k, Math.max(LS.get(k,0), +v||0)));
    if(Q.example) Q = blankQuote();
    renderAll(); closeModal(); toast(`Restored ${data.quotes.length} quotes`);
  };
});

/* ---------- tabs ---------- */
function setView(v){ document.body.dataset.view = v; $("tabEdit").setAttribute("aria-selected", v === "edit"); $("tabPrev").setAttribute("aria-selected", v === "preview"); }
$("tabEdit").onclick = () => { setView("edit"); window.scrollTo(0,0); };
$("tabPrev").onclick = () => { setView("preview"); window.scrollTo(0,0); };
$("btnSeeQuote").onclick = () => { setView("preview"); window.scrollTo(0,0); };

renderAll();
})();
