/* GEOWENGAS Quote Builder — shared logic for index.html (the app) and sign.html (client signing page). */
(function(global){
"use strict";

const BIZ = {
  name:"GEOWENGAS", sub:"EVENT SOLUTIONS",
  phones:"+233 531 099 939  |  +233 504 728 417",
  whatsapp:"233531099939",
  email:"geowenga3@gmail.com", addr:"Oman Junction, Dome Pillar 2", social:"@geowengas_events",
  tagline:"WE PLAN. YOU CELEBRATE."
};
const STD_CONDS = [
  "Full payment must be made before delivery of items.",
  "Hired items must be returned clean and in good condition.",
  "Cancellation less than 4 weeks will attract 50%, and less than 4 days will attract 100%.",
  "The hirer will be responsible for freight charges involved in the delivery or return of hired items.",
  "A refundable deposit must be paid for loss or damage, where applicable.",
  "Hired items must be returned on the agreed return date. Late returns may attract additional charges.",
  "If an item is beyond repair, the customer shall pay its full market value. If the refundable deposit does not cover the repair cost, the customer shall pay the balance."
];
const DEPOSIT_RATE = 0.15;

/* ---------- small helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const amt = n => (Number(n)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const money = n => "GHC " + amt(n);
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const addDays = (s,n) => { const d = s ? new Date(s+"T00:00:00") : new Date(); d.setDate(d.getDate()+n); return iso(d); };
const dmy = s => { if(!s) return "____/____/______"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const longDate = s => { if(!s) return ""; const d = new Date(s+"T00:00:00"); return d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"long",year:"numeric"}); };
const isFilled = i => i.desc || num(i.qty) || num(i.price);

function totals(q){
  const sub = (q.items||[]).reduce((s,i) => s + num(i.qty)*num(i.price), 0);
  const setup = num(q.setup), del = num(q.delivery), disc = num(q.discount);
  const total = Math.max(0, sub + setup + del - disc);
  const dep = q.depositAuto ? Math.round(total * DEPOSIT_RATE * 100) / 100 : num(q.deposit);
  return {sub, setup, del, disc, total, dep};
}
/* Event date, or a range like "Sat 14 Nov – Mon 16 Nov 2026". */
function eventDates(c){
  c = c || {};
  const a = c.eventDate, b = c.eventEnd;
  if(!a) return b ? longDate(b) : "";
  if(!b || b === a) return longDate(a);
  const da = new Date(a+"T00:00:00"), db = new Date(b+"T00:00:00");
  const f = (d, withYear) => d.toLocaleDateString("en-GB", withYear ? {weekday:"short",day:"numeric",month:"short",year:"numeric"} : {weekday:"short",day:"numeric",month:"short"});
  return `${f(da, da.getFullYear() !== db.getFullYear())} – ${f(db, true)}`;
}
function clientRows(c){
  c = c || {};
  return [["Client",c.name],["Phone",c.phone],["Event",c.event],[c.eventEnd && c.eventEnd !== c.eventDate ? "Event dates" : "Event date", eventDates(c)],["Venue",c.venue],["Guests",c.guests],["Email",c.email]].filter(x => x[1]);
}

/* ---------- check code: flags edits to prices, quantities or totals ---------- */
function cyrb53(str, seed=7){
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i=0;i<str.length;i++){ const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1>>>0));
}
function checkCode(q){
  const t = totals(q);
  const canon = [q.no, ...(q.items||[]).filter(isFilled).map(i => `${(i.desc||"").trim()}~${num(i.qty)}~${num(i.price).toFixed(2)}`),
    t.setup.toFixed(2), t.del.toFixed(2), t.disc.toFixed(2), t.total.toFixed(2), t.dep.toFixed(2)].join("|");
  return cyrb53(canon).toString(36).toUpperCase().padStart(10,"0").slice(-8);
}

/* ---------- quote <-> link ---------- */
const b64u = bytes => { let s = ""; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); };
const unb64u = str => { const s = atob(str.replace(/-/g,"+").replace(/_/g,"/")); const out = new Uint8Array(s.length); for(let i=0;i<s.length;i++) out[i] = s.charCodeAt(i); return out; };
async function pipe(bytes, stream){ const res = new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await res.arrayBuffer()); }
function linkPayload(q){
  return {id:q.id, no:q.no, date:q.date, valid:q.valid, client:q.client,
    items:(q.items||[]).filter(isFilled).map(i => ({desc:i.desc, qty:i.qty, price:i.price})),
    setup:q.setup, delivery:q.delivery, discount:q.discount, deposit:totals(q).dep ? totals(q).dep.toFixed(2) : "", depositAuto:false, scope:q.scope,
    conditions:(q.conditions||[]).filter(x => x.trim()), check:checkCode(q)};
}
async function encodeQuote(q){
  const bytes = new TextEncoder().encode(JSON.stringify(linkPayload(q)));
  if(typeof CompressionStream !== "undefined"){
    try{ return "z." + b64u(await pipe(bytes, new CompressionStream("deflate-raw"))); }catch(e){}
  }
  return "j." + b64u(bytes);
}
async function decodeQuote(str){
  const [kind, data] = [str.slice(0,1), str.slice(2)];
  let bytes = unb64u(data);
  if(kind === "z"){
    if(typeof DecompressionStream === "undefined") throw new Error("old-browser");
    bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* ---------- phone helpers ---------- */
function waNumber(p){
  let d = String(p||"").replace(/\D/g,"");
  if(!d) return "";
  if(d.startsWith("00")) d = d.slice(2);
  if(d.startsWith("0")) d = "233" + d.slice(1);
  if(d.length === 9) d = "233" + d;
  return d;
}

/* ---------- logo as data URL (for the PDF) ---------- */
let logoData = null;
const logoReady = (async () => {
  try{
    const blob = await (await fetch("logo.jpg")).blob();
    logoData = await new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  }catch(e){ logoData = null; }
})();
const LOGO_RATIO = 528/600;

/* ---------- paper (HTML preview) ---------- */
const boldPct = s => esc(s).replace(/(\d+%)/g,"<b>$1</b>");
function paperHTML(q, opt={}){
  const t = totals(q), cl = clientRows(q.client);
  const filled = (q.items||[]).filter(isFilled);
  let rows = filled.map(i => `<tr><td>${esc(i.desc)}</td><td class="q">${esc(i.qty)}</td><td class="n">${num(i.price)?amt(i.price):""}</td><td class="n">${amt(num(i.qty)*num(i.price))}</td></tr>`).join("");
  for(let k = filled.length; k < (opt.minRows ?? 6); k++) rows += `<tr><td></td><td></td><td></td><td></td></tr>`;
  const sig = opt.signature;
  return `
    ${q.example ? '<span class="p-example">EXAMPLE QUOTE — EDIT OR START A NEW ONE</span>' : ''}
    <div class="p-top">
      <img src="logo.jpg" alt="GEOWENGAS logo">
      <div class="p-brand"><b>${BIZ.name}</b><span class="sub">${BIZ.sub}</span>
        <div class="ct">${BIZ.phones}<br>${BIZ.email}  |  ${BIZ.addr}<br>${BIZ.social}</div></div>
    </div>
    <div class="p-title">QUOTATION / ESTIMATE</div>
    <div class="p-meta"><div>QUOTE NO:&nbsp; ${esc(q.no)}</div><div>DATE:&nbsp; ${dmy(q.date)}</div><div>VALID UNTIL:&nbsp; ${dmy(q.valid)}</div></div>
    <div class="p-label">CLIENT / EVENT DETAILS</div>
    <div class="p-client">${cl.map(x => `<div><em>${x[0]}:</em>${esc(x[1])}</div>`).join("")}</div>
    <div class="p-tbl-wrap"><table class="p-tbl"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th class="n">UNIT PRICE (GHC)</th><th class="n">AMOUNT (GHC)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="p-bottom">
      <div class="p-scope"><b>Scope / Inclusions / Exclusions</b><div>${esc(q.scope)}</div></div>
      <div class="p-tot">
        <div class="p-tot-box">
          <div><span>Subtotal (GHC)</span><span>${amt(t.sub)}</span></div>
          <div><span>Setup (GHC)</span><span>${amt(t.setup)}</span></div>
          <div><span>Delivery (GHC)</span><span>${amt(t.del)}</span></div>
          ${t.disc ? `<div><span>Discount (GHC)</span><span>− ${amt(t.disc)}</span></div>` : ""}
          <div class="grand"><span>Estimated Total (GHC)</span><span>${amt(t.total)}</span></div>
        </div>
        ${t.dep ? `<div class="dep">Refundable deposit (GHC), paid separately: ${amt(t.dep)}</div>` : ""}
      </div>
    </div>
    <div class="p-conds-h">Conditions</div>
    <ol class="p-conds">${(q.conditions||[]).filter(x => x.trim()).map((x,i) => `<li>${i+1}. ${boldPct(x)}</li>`).join("")}</ol>
    <div class="p-sign">
      <div>Client Signature:<span class="ln">${sig && sig.img ? `<img src="${sig.img}" alt="Client signature">` : ""}</span></div>
      <div>Date:<span class="ln d">${sig ? esc(dmy(sig.date)) : ""}</span></div>
    </div>
    ${sig ? `<div class="p-signed">Signed by ${esc(sig.name)} · check code ${esc(q.check || checkCode(q))}</div>` : ""}
    <div class="p-foot">${BIZ.tagline}</div>`;
}

/* ---------- PDF (A4, laid out like the Word template) ---------- */
function hex(str){ return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2,"0")).join(""); }
function unhex(h){ const out = new Uint8Array(h.length/2); for(let i=0;i<out.length;i++) out[i] = parseInt(h.substr(i*2,2),16); return new TextDecoder().decode(out); }

function buildPdf(q, opt={}){
  const { jsPDF } = global.jspdf;
  const doc = new jsPDF({unit:"mm", format:"a4"});
  const W = 210, M = 16, PURPLE=[91,30,109], HEAD=[91,27,112], GOLD=[200,157,60], INK=[31,26,34], GREY=[90,90,90], LINE=[217,217,217], FILL=[247,247,247];
  const t = totals(q), c = q.client || {};
  const sig = opt.signature;
  const S = (style,size,color) => { doc.setFont("times",style); doc.setFontSize(size); doc.setTextColor(...(color||INK)); };
  const A = (style,size,color) => { doc.setFont("helvetica",style); doc.setFontSize(size); doc.setTextColor(...(color||INK)); };
  const footer = () => { A("bold",8,PURPLE); doc.setCharSpace(0.3); doc.text(BIZ.tagline, W/2, 287, {align:"center"}); doc.setCharSpace(0); };

  doc.setProperties({title:`${q.no} ${BIZ.name} Quotation`, author:BIZ.name, subject:"Quotation / Estimate",
    keywords:"GWQ:" + hex(JSON.stringify({no:q.no, id:q.id, check:q.check || checkCode(q), signed:!!sig, name:sig?sig.name:"", date:sig?sig.date:""}))});

  // Header
  let y = 10;
  const lw = 30, lh = lw*LOGO_RATIO;
  if(logoData){ try{ doc.addImage(logoData, "JPEG", M, y, lw, lh); }catch(e){} }
  S("bold",22,PURPLE); doc.text(BIZ.name, W-M, y+9, {align:"right"});
  A("bold",8.5,GOLD); doc.text(BIZ.sub, W-M, y+14, {align:"right"});
  A("normal",7.5,[51,51,51]);
  doc.text(BIZ.phones, W-M, y+18.5, {align:"right"});
  doc.text(`${BIZ.email}  |  ${BIZ.addr}`, W-M, y+22, {align:"right"});
  doc.text(BIZ.social, W-M, y+25.5, {align:"right"});
  y += lh + 9;
  S("bold",21,PURPLE); doc.text("QUOTATION / ESTIMATE", M, y); y += 6;

  // Meta
  const cw = (W-2*M)/3;
  doc.setFillColor(...FILL); doc.setDrawColor(...GOLD); doc.setLineWidth(0.35);
  doc.rect(M,y,W-2*M,9,"FD"); doc.line(M+cw,y,M+cw,y+9); doc.line(M+2*cw,y,M+2*cw,y+9);
  S("normal",9);
  [["QUOTE NO:  ",q.no],["DATE:  ",dmy(q.date)],["VALID UNTIL:  ",dmy(q.valid)]].forEach((m,i) => doc.text(m[0]+(m[1]||""), M+i*cw+2.5, y+5.8));
  y += 15;

  // Client
  S("bold",9.5); doc.text("CLIENT / EVENT DETAILS", M, y); y += 2.5;
  const cl = clientRows(c);
  const rowsN = Math.max(2, Math.ceil(cl.length/2)); const boxH = rowsN*5+3;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.rect(M,y,W-2*M,boxH);
  cl.forEach((x,i) => { const col=i%2, row=Math.floor(i/2); const xx=M+2.5+col*(W-2*M)/2, yy=y+5+row*5;
    S("normal",8.8,GREY); doc.text(x[0]+":", xx, yy); const w = doc.getTextWidth(x[0]+": ");
    S("normal",8.8); doc.text(doc.splitTextToSize(String(x[1]), (W-2*M)/2-w-5)[0], xx+w, yy); });
  y += boxH + 5;

  // Items
  const items = (q.items||[]).filter(isFilled);
  const body = items.map(i => [i.desc, String(i.qty||""), num(i.price)?amt(i.price):"", amt(num(i.qty)*num(i.price))]);
  while(body.length < 8) body.push(["","","",""]);
  doc.autoTable({
    startY:y, margin:{left:M,right:M,bottom:18},
    head:[["DESCRIPTION","QTY","UNIT PRICE (GHC)","AMOUNT (GHC)"]],
    body, theme:"grid",
    styles:{font:"times",fontSize:9,textColor:INK,lineColor:LINE,lineWidth:0.25,cellPadding:1.8,minCellHeight:6},
    headStyles:{fillColor:HEAD,textColor:255,fontStyle:"bold",fontSize:8.5,halign:"center",lineColor:HEAD},
    columnStyles:{1:{halign:"center",cellWidth:18},2:{halign:"right",cellWidth:34},3:{halign:"right",cellWidth:36}},
    didDrawPage:footer
  });
  y = doc.lastAutoTable.finalY + 7;

  // Scope + totals box
  const half = (W-2*M)/2;
  S("normal",8.6);
  const scopeLines = doc.splitTextToSize(q.scope||"", half-8);
  const scopeH = Math.max(14, scopeLines.length*3.8+5);
  const RH = 6.6, totRows = 4 + (t.disc?1:0);
  const blockH = Math.max(scopeH+5, totRows*RH+2.5+(t.dep?6:0));
  if(y+blockH > 272){ doc.addPage(); footer(); y = 18; }
  S("bold",9.5); doc.text("Scope / Inclusions / Exclusions", M, y);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.rect(M, y+2.5, half-4, scopeH);
  S("normal",8.6); doc.text(scopeLines, M+2.5, y+7);
  const bx = M+half+4, bw = W-M-bx, by = y+2.5;
  const rowsT = [["Subtotal (GHC)",amt(t.sub)],["Setup (GHC)",amt(t.setup)],["Delivery (GHC)",amt(t.del)]];
  if(t.disc) rowsT.push(["Discount (GHC)","- "+amt(t.disc)]);
  doc.setFillColor(...FILL); doc.rect(bx, by+rowsT.length*RH, bw, RH, "F");
  rowsT.forEach((r,i) => { S("normal",9.2); doc.text(r[0], bx+3, by+i*RH+4.4); doc.text(r[1], bx+bw-3, by+i*RH+4.4, {align:"right"});
    if(i){ doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(bx, by+i*RH, bx+bw, by+i*RH); } });
  const gy = by + rowsT.length*RH;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.35); doc.line(bx, gy, bx+bw, gy);
  S("bold",10,PURPLE); doc.text("Estimated Total (GHC)", bx+3, gy+4.5); doc.text(amt(t.total), bx+bw-3, gy+4.5, {align:"right"});
  doc.rect(bx, by, bw, (rowsT.length+1)*RH);
  if(t.dep){ S("normal",8,GREY); doc.text(`Refundable deposit (GHC), paid separately: ${amt(t.dep)}`, bx+bw, gy+RH+4.5, {align:"right"}); }
  y += blockH + 7;

  // Conditions
  const conds = (q.conditions||[]).filter(x => x.trim());
  S("normal",8.8);
  const condLines = conds.map((x,i) => doc.splitTextToSize(`${i+1}. ${x}`, W-2*M));
  const condH = 6 + condLines.reduce((s,l) => s + l.length*3.9 + 1, 0) + (sig ? 30 : 18);
  if(y+condH > 280){ doc.addPage(); footer(); y = 18; }
  S("bold",9.8); doc.text("Conditions", M, y); y += 5.5;
  condLines.forEach(l => { S("normal",8.8); doc.text(l, M, y); y += l.length*3.9 + 1; });
  y += sig ? 16 : 10;

  // Signature line
  S("normal",9.2); doc.text("Client Signature:", M, y);
  doc.setDrawColor(68,68,68); doc.setLineWidth(0.25);
  const sx = M + doc.getTextWidth("Client Signature:") + 3, sw = 52;
  doc.line(sx, y+0.8, sx+sw, y+0.8);
  const dLabelX = sx + sw + 8; doc.text("Date:", dLabelX, y);
  const dx = dLabelX + doc.getTextWidth("Date:") + 3, dw = 36; doc.line(dx, y+0.8, dx+dw, y+0.8);
  if(sig){
    if(sig.img){ try{ const h = 13, w = Math.min(sw, h*sig.ratio); doc.addImage(sig.img, "PNG", sx+1, y-h+0.3, w, h); }catch(e){} }
    S("normal",9.2); doc.text(dmy(sig.date), dx+1.5, y-0.8);
    S("normal",7.8,GREY);
    doc.text(`Signed by ${sig.name} on ${new Date(sig.signedAt).toLocaleString("en-GB")}  ·  Check code ${q.check || checkCode(q)}`, M, y+6);
  } else if(opt.fillable && jsPDF.AcroForm){
    try{
      const F = jsPDF.AcroForm;
      const n = new F.TextField(); n.fieldName = "ClientSignature"; n.Rect = [sx+0.5, y-5.5, sw-1, 6]; n.fontSize = 10; n.value = ""; doc.addField(n);
      const d = new F.TextField(); d.fieldName = "SignDate"; d.Rect = [dx+0.5, y-5.5, dw-1, 6]; d.fontSize = 10; d.value = ""; doc.addField(d);
    }catch(e){}
  }
  return doc;
}

/* Reads the quote reference that buildPdf() stores inside every PDF it makes. */
async function readPdfRef(file){
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = ""; for(let i=0;i<buf.length;i+=8192) s += String.fromCharCode.apply(null, buf.subarray(i, i+8192));
  const m = /GWQ:([0-9a-f]+)/.exec(s);
  if(!m) return null;
  try{ return JSON.parse(unhex(m[1])); }catch(e){ return null; }
}

/* ---------- sharing ---------- */
async function shareOrDownload(blob, filename, text){
  const file = new File([blob], filename, {type: blob.type || "application/octet-stream"});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:filename, text}); return "shared"; }
    catch(e){ if(e && e.name === "AbortError") return "cancelled"; }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
}
const safeName = s => String(s||"").replace(/\(example\)/i,"").trim().replace(/[^\w\- ]+/g,"").replace(/\s+/g,"-");

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, ms=3000){
  let t = document.getElementById("toast");
  if(!t){ t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, ms);
}

/* ---------- offline + auto-update ---------- */
if("serviceWorker" in navigator && location.protocol === "https:"){
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}

global.GW = {BIZ, STD_CONDS, DEPOSIT_RATE, eventDates, esc, num, amt, money, iso, addDays, dmy, longDate, isFilled, totals, clientRows, checkCode,
  encodeQuote, decodeQuote, waNumber, paperHTML, buildPdf, readPdfRef, shareOrDownload, downloadBlob, safeName, toast, logoReady};
})(window);
