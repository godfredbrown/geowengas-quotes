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
/* Payment methods printed on every quote. */
const PAYMENT_NOTE = "Cash payment is not accepted";
const PAYMENT = [
  {title:"Mobile Money", accounts:[
    {head:"Telecel Network", lines:[["Name on Account","GEOWENGA'S Events"],["Number","0504728417"]]},
    {head:"MTN Network",     lines:[["Name on Account","GEOWENGA'S Events"],["Number","0559146957"]]}
  ]},
  {title:"Bank Transfer", accounts:[
    {head:"ECOBANK", lines:[["Account Name","GEOWENGAS ENTERPRISE"],["Account No","1441005176208"],["Branch","Kissiman"]]},
    {head:"GT Bank", lines:[["Account Name","GEOWENGAS ENTERPRISE"],["Account No","3214001001618"],["Branch","Opera"]]}
  ]}
];
/* Signed quotes are saved to Google Drive through the Apps Script in google-drive/Code.gs.
   Paste the script's Web app URL (ends in /exec) below. Empty = Drive saving is off. */
const DRIVE_UPLOAD = {url:"https://script.google.com/macros/s/AKfycbz6LiP-WPvmOx3S0bxUIStImaqjovNWSEtpDNGT7gLIZOFVpH2TEBwkTDJbFL59Sj4ajg/exec", key:"XxkFTWluQnou906QKKYblu3s"};

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
  const base = Math.max(0, sub + setup + del - disc);
  const dep = q.depositAuto ? Math.round(sub * DEPOSIT_RATE * 100) / 100 : num(q.deposit); // 15% of the items only
  return {sub, setup, del, disc, base, dep, total: base + dep};
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
  const inv = opt.invoice;
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
    ${inv ? `<div class="p-title">INVOICE</div>
    <div class="p-meta"><div>INVOICE NO:&nbsp; ${esc(inv.no)}</div><div>DATE:&nbsp; ${dmy(inv.date)}</div><div>QUOTE REF:&nbsp; ${esc(q.no)}</div></div>`
    : `<div class="p-title">QUOTATION / ESTIMATE</div>
    <div class="p-meta"><div>QUOTE NO:&nbsp; ${esc(q.no)}</div><div>DATE:&nbsp; ${dmy(q.date)}</div><div>VALID UNTIL:&nbsp; ${dmy(q.valid)}</div></div>`}
    <div class="p-label">CLIENT / EVENT DETAILS</div>
    <div class="p-client">${cl.map(x => `<div><em>${x[0]}:</em>${esc(x[1])}</div>`).join("")}</div>
    <div class="p-tbl-wrap"><table class="p-tbl"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th class="n">UNIT PRICE (GHC)</th><th class="n">AMOUNT (GHC)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="p-bottom">
      <div class="p-scope"><b>Scope / Inclusions / Exclusions</b><div>${esc(q.scope)}</div></div>
      <div class="p-tot">
        <div class="p-tot-box">
          <div><span>Subtotal (GHC)</span><span>${amt(t.sub)}</span></div>
          <div><span>Setup (GHC)</span><span>${amt(t.setup)}</span></div>
          <div><span>Transportation (GHC)</span><span>${amt(t.del)}</span></div>
          <div><span>Refundable Deposit (GHC)</span><span>${amt(t.dep)}</span></div>
          ${t.disc ? `<div><span>Discount (GHC)</span><span>− ${amt(t.disc)}</span></div>` : ""}
          <div class="grand"><span>${inv ? "Total Due (GHC)" : "Estimated Total (GHC)"}</span><span>${amt(t.total)}</span></div>
        </div>
      </div>
    </div>
    <div class="p-conds-h">Payment Methods <span class="p-nocash">${esc(PAYMENT_NOTE)}</span></div>
    <div class="p-pay">${PAYMENT.map((m,i) => `<div><b>${i+1}. ${esc(m.title)}</b>${m.accounts.map(a => `<div class="acc"><i>${esc(a.head)}</i>${a.lines.map(l => `<span>${esc(l[0])}: <strong>${esc(l[1])}</strong></span>`).join("")}</div>`).join("")}</div>`).join("")}</div>
    <div class="p-conds-h">Conditions</div>
    <ol class="p-conds">${(q.conditions||[]).filter(x => x.trim()).map((x,i) => `<li>${i+1}. ${boldPct(x)}</li>`).join("")}</ol>
    ${inv ? "" : `<div class="p-sign">
      <div>Client Signature:<span class="ln">${sig && sig.img ? `<img src="${sig.img}" alt="Client signature">` : ""}</span></div>
      <div>Date:<span class="ln d">${sig ? esc(dmy(sig.date)) : ""}</span></div>
    </div>
    ${sig ? `<div class="p-signed">Signed by ${esc(sig.name)} · check code ${esc(q.check || checkCode(q))}</div>` : ""}`}
    <div class="p-foot">${BIZ.tagline}</div>`;
}

/* ---------- PDF (A4, laid out like the Word template) ---------- */
function hex(str){ return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2,"0")).join(""); }
function unhex(h){ const out = new Uint8Array(h.length/2); for(let i=0;i<out.length;i++) out[i] = parseInt(h.substr(i*2,2),16); return new TextDecoder().decode(out); }

/* Builds the quote/invoice PDF. Everything must fit on ONE A4 page: the layout is drawn at scale k,
   and if anything would run past the bottom, it is redrawn smaller (fonts and spacing) until it fits. */
function buildPdf(q, opt={}){
  for(let k = 1; k >= 0.42; k = Math.round((k - 0.04) * 100) / 100){
    const r = layoutPdf(q, opt, k);
    if(r.fits) return r.doc;
  }
  return layoutPdf(q, opt, 0.4, true).doc;   // last resort: smallest scale, still one page
}

function layoutPdf(q, opt, k, force){
  const { jsPDF } = global.jspdf;
  const doc = new jsPDF({unit:"mm", format:"a4"});
  const W = 210, M = 16, PURPLE=[91,30,109], HEAD=[91,27,112], GOLD=[200,157,60], INK=[31,26,34], GREY=[90,90,90], LINE=[217,217,217], FILL=[247,247,247], RED=[166,38,38];
  const t = totals(q), c = q.client || {};
  const sig = opt.signature, inv = opt.invoice;
  const v = n => n * k;                         // vertical distances
  const f = n => Math.max(4.6, n * k);          // font sizes
  const S = (style,size,color) => { doc.setFont("times",style); doc.setFontSize(f(size)); doc.setTextColor(...(color||INK)); };
  const A = (style,size,color) => { doc.setFont("helvetica",style); doc.setFontSize(f(size)); doc.setTextColor(...(color||INK)); };
  const FOOT_Y = 289, LIMIT = 283;
  let overflow = false;
  const need = (y) => { if(y > LIMIT) overflow = true; };

  doc.setProperties({title: inv ? `${inv.no} ${BIZ.name} Invoice` : `${q.no} ${BIZ.name} Quotation`, author:BIZ.name, subject: inv ? "Invoice" : "Quotation / Estimate",
    keywords:"GWQ:" + hex(JSON.stringify({kind: inv ? "invoice" : "quote", invoice: inv ? inv.no : "", no:q.no, id:q.id, check:q.check || checkCode(q), signed:!!sig, name:sig?sig.name:"", date:sig?sig.date:""}))});

  // Header
  let y = v(10);
  const lw = Math.max(16, 30*k), lh = lw*LOGO_RATIO;
  if(logoData){ try{ doc.addImage(logoData, "JPEG", M, y, lw, lh); }catch(e){} }
  const hs = lh / (30*LOGO_RATIO);              // header text follows the logo size
  S("bold",22*hs/k,PURPLE); doc.text(BIZ.name, W-M, y+9*hs, {align:"right"});
  A("bold",8.5*hs/k,GOLD); doc.text(BIZ.sub, W-M, y+14*hs, {align:"right"});
  A("normal",7.5*hs/k,[51,51,51]);
  doc.text(BIZ.phones, W-M, y+18.5*hs, {align:"right"});
  doc.text(`${BIZ.email}  |  ${BIZ.addr}`, W-M, y+22*hs, {align:"right"});
  doc.text(BIZ.social, W-M, y+25.5*hs, {align:"right"});
  y += lh + v(9);
  S("bold",21,PURPLE); doc.text(inv ? "INVOICE" : "QUOTATION / ESTIMATE", M, y); y += v(6);

  // Meta
  const cw = (W-2*M)/3, mh = v(9);
  doc.setFillColor(...FILL); doc.setDrawColor(...GOLD); doc.setLineWidth(0.35);
  doc.rect(M,y,W-2*M,mh,"FD"); doc.line(M+cw,y,M+cw,y+mh); doc.line(M+2*cw,y,M+2*cw,y+mh);
  S("normal",9);
  (inv ? [["INVOICE NO:  ",inv.no],["DATE:  ",dmy(inv.date)],["QUOTE REF:  ",q.no]] : [["QUOTE NO:  ",q.no],["DATE:  ",dmy(q.date)],["VALID UNTIL:  ",dmy(q.valid)]]).forEach((m,i) => doc.text(m[0]+(m[1]||""), M+i*cw+2.5, y+mh*0.64));
  y += mh + v(6);

  // Client
  S("bold",9.5); doc.text("CLIENT / EVENT DETAILS", M, y); y += v(2.5);
  const cl = clientRows(c);
  const rowsN = Math.max(2, Math.ceil(cl.length/2)), crh = v(5); const boxH = rowsN*crh+v(3);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.rect(M,y,W-2*M,boxH);
  cl.forEach((x,i) => { const col=i%2, row=Math.floor(i/2); const xx=M+2.5+col*(W-2*M)/2, yy=y+v(5)+row*crh;
    S("normal",8.8,GREY); doc.text(x[0]+":", xx, yy); const w = doc.getTextWidth(x[0]+": ");
    S("normal",8.8); doc.text(doc.splitTextToSize(String(x[1]), (W-2*M)/2-w-5)[0], xx+w, yy); });
  y += boxH + v(5);

  // Items
  const items = (q.items||[]).filter(isFilled);
  const body = items.map(i => [i.desc, String(i.qty||""), num(i.price)?amt(i.price):"", amt(num(i.qty)*num(i.price))]);
  while(body.length < 3) body.push(["","","",""]);
  doc.autoTable({
    startY:y, margin:{left:M,right:M,bottom:6},
    head:[["DESCRIPTION","QTY","UNIT PRICE (GHC)","AMOUNT (GHC)"]],
    body, theme:"grid",
    styles:{font:"times",fontSize:f(9),textColor:INK,lineColor:LINE,lineWidth:0.25,cellPadding:Math.max(0.6, 1.8*k),minCellHeight:v(6)},
    headStyles:{fillColor:HEAD,textColor:255,fontStyle:"bold",fontSize:f(8.5),halign:"center",lineColor:HEAD},
    columnStyles:{1:{halign:"center",cellWidth:18},2:{halign:"right",cellWidth:34},3:{halign:"right",cellWidth:36}}
  });
  if(doc.getNumberOfPages() > 1) overflow = true;
  y = doc.lastAutoTable.finalY + v(6);

  // Scope + totals box
  const half = (W-2*M)/2;
  S("normal",8.6);
  const scopeLines = doc.splitTextToSize(q.scope||"", half-8);
  const SL = v(3.8), scopeH = Math.max(v(14), scopeLines.length*SL+v(5));
  const RH = v(6.6), totRows = 5 + (t.disc?1:0);
  const blockH = Math.max(scopeH+v(5), totRows*RH+v(2.5));
  need(y + blockH);
  S("bold",9.5); doc.text("Scope / Inclusions / Exclusions", M, y);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.rect(M, y+v(2.5), half-4, scopeH);
  S("normal",8.6); doc.text(scopeLines, M+2.5, y+v(7), {lineHeightFactor:1.15});
  const bx = M+half+4, bw = W-M-bx, by = y+v(2.5);
  const rowsT = [["Subtotal (GHC)",amt(t.sub)],["Setup (GHC)",amt(t.setup)],["Transportation (GHC)",amt(t.del)],["Refundable Deposit (GHC)",amt(t.dep)]];
  if(t.disc) rowsT.push(["Discount (GHC)","- "+amt(t.disc)]);
  doc.setFillColor(...FILL); doc.rect(bx, by+rowsT.length*RH, bw, RH, "F");
  rowsT.forEach((r,i) => { S("normal",9.2); doc.text(r[0], bx+3, by+i*RH+RH*0.67); doc.text(r[1], bx+bw-3, by+i*RH+RH*0.67, {align:"right"});
    if(i){ doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(bx, by+i*RH, bx+bw, by+i*RH); } });
  const gy = by + rowsT.length*RH;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.35); doc.line(bx, gy, bx+bw, gy);
  S("bold",10,PURPLE); doc.text(inv ? "Total Due (GHC)" : "Estimated Total (GHC)", bx+3, gy+RH*0.68); doc.text(amt(t.total), bx+bw-3, gy+RH*0.68, {align:"right"});
  doc.rect(bx, by, bw, (rowsT.length+1)*RH);
  y += blockH + v(5);

  // Payment methods (two boxes side by side) + "Cash payment is not accepted"
  {
    const colW = (W-2*M-6)/2, LH = v(3.5);
    const colH = m => v(9) + m.accounts.reduce((s,a) => s + v(3.7) + a.lines.length*LH + v(1.2), 0) - v(2);
    const boxH = Math.max(...PAYMENT.map(colH));
    need(y + v(2.5) + boxH);
    S("bold",9.8); doc.text("Payment Methods", M, y);
    const hw = doc.getTextWidth("Payment Methods");
    S("bolditalic",9.2,RED); doc.text(PAYMENT_NOTE, M + hw + 4, y);
    y += v(2.5);
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.35);
    PAYMENT.forEach((m,i) => {
      const x = M + i*(colW+6); let yy = y + v(5);
      doc.setFillColor(...FILL); doc.rect(x, y, colW, boxH, "FD");
      S("bold",9.2,PURPLE); doc.text(`${i+1}. ${m.title}`, x+3, yy); yy += v(5);
      m.accounts.forEach(a => {
        S("bold",8.6); doc.text(a.head, x+3, yy); yy += v(3.7);
        a.lines.forEach(l => { S("normal",8.4,GREY); doc.text(l[0]+":", x+5, yy); const w = doc.getTextWidth(l[0]+": "); S("bold",8.4); doc.text(l[1], x+5+w, yy); yy += LH; });
        yy += v(1.2);
      });
    });
    y += boxH + v(5);
  }

  // Conditions — one column normally, two columns once the page is getting tight
  const conds = (q.conditions||[]).filter(x => x.trim());
  const twoCol = k < 0.92;
  const colW2 = twoCol ? (W-2*M-6)/2 : W-2*M;
  S("normal",8.6);
  const condLines = conds.map((x,i) => doc.splitTextToSize(`${i+1}. ${x}`, colW2));
  const CL = v(3.6), CG = v(0.7);
  const hOf = arr => arr.reduce((s,l) => s + l.length*CL + CG, 0);
  let split = condLines.length;
  if(twoCol){ // balance the two columns
    let best = 1, bestH = Infinity;
    for(let s2 = 1; s2 < condLines.length; s2++){ const h = Math.max(hOf(condLines.slice(0,s2)), hOf(condLines.slice(s2))); if(h < bestH){ bestH = h; best = s2; } }
    split = best;
  }
  const condH = Math.max(hOf(condLines.slice(0,split)), hOf(condLines.slice(split)));
  S("bold",9.8); doc.text("Conditions", M, y); y += v(5);
  [condLines.slice(0,split), condLines.slice(split)].forEach((block, ci) => {
    let yy = y; const x = M + ci*(colW2+6);
    block.forEach(l => { S("normal",8.6); doc.text(l, x, yy, {lineHeightFactor: CL / (f(8.6)*0.3528)}); yy += l.length*CL + CG; });
  });
  y += condH;
  need(y);

  if(!inv){
    y += v(sig ? 13 : 8);
    need(y + (sig ? v(7) : 1));
    // Signature line
    S("normal",9.2); doc.text("Client Signature:", M, y);
    doc.setDrawColor(68,68,68); doc.setLineWidth(0.25);
    const sx = M + doc.getTextWidth("Client Signature:") + 3, sw = 52;
    doc.line(sx, y+0.8, sx+sw, y+0.8);
    const dLabelX = sx + sw + 8; doc.text("Date:", dLabelX, y);
    const dx = dLabelX + doc.getTextWidth("Date:") + 3, dw = 36; doc.line(dx, y+0.8, dx+dw, y+0.8);
    if(sig){
      if(sig.img){ try{ const h = Math.max(8, 13*k), w = Math.min(sw, h*sig.ratio); doc.addImage(sig.img, "PNG", sx+1, y-h+0.3, w, h); }catch(e){} }
      S("normal",9.2); doc.text(dmy(sig.date), dx+1.5, y-0.8);
      S("normal",7.8,GREY);
      doc.text(`Signed by ${sig.name} on ${new Date(sig.signedAt).toLocaleString("en-GB")}  ·  Check code ${q.check || checkCode(q)}`, M, y+v(6));
    } else if(opt.fillable && jsPDF.AcroForm){
      try{
        const F = jsPDF.AcroForm;
        const n = new F.TextField(); n.fieldName = "ClientSignature"; n.Rect = [sx+0.5, y-5.5, sw-1, 6]; n.fontSize = 10; n.value = ""; doc.addField(n);
        const d = new F.TextField(); d.fieldName = "SignDate"; d.Rect = [dx+0.5, y-5.5, dw-1, 6]; d.fontSize = 10; d.value = ""; doc.addField(d);
      }catch(e){}
    }
  }

  // Footer
  A("bold",8,PURPLE); doc.setFontSize(8); doc.setCharSpace(0.3); doc.text(BIZ.tagline, W/2, FOOT_Y, {align:"center"}); doc.setCharSpace(0);
  if(doc.getNumberOfPages() > 1) overflow = true;
  return {doc, fits: !overflow || force};
}

/* Reads the quote reference that buildPdf() stores inside every PDF it makes. */
async function readPdfRef(file){
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = ""; for(let i=0;i<buf.length;i+=8192) s += String.fromCharCode.apply(null, buf.subarray(i, i+8192));
  const m = /GWQ:([0-9a-f]+)/.exec(s);
  if(!m) return null;
  try{ return JSON.parse(unhex(m[1])); }catch(e){ return null; }
}

/* ---------- save a signed PDF to Google Drive ---------- */
const driveEnabled = () => !!DRIVE_UPLOAD.url;
async function uploadSigned(blob, filename, meta={}){
  if(!DRIVE_UPLOAD.url) return {ok:false, off:true};
  try{
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
    const body = JSON.stringify({key:DRIVE_UPLOAD.key, filename, pdf:b64, ...meta});
    const res = await fetch(DRIVE_UPLOAD.url, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body, redirect:"follow"});
    const out = await res.json().catch(() => ({ok:res.ok}));
    return out && out.ok ? {ok:true, url:out.url, duplicate:!!out.duplicate} : {ok:false, error:(out && out.error) || "failed"};
  }catch(e){ return {ok:false, error:String(e)}; }
}
async function checkDrive(){
  if(!DRIVE_UPLOAD.url) return {ok:false, error:"not set up"};
  try{ const r = await fetch(DRIVE_UPLOAD.url, {redirect:"follow"}); const j = await r.json(); return j && j.app === "geowengas-drive" ? {ok:true, folder:j.folder} : {ok:false, error:"unexpected reply"}; }
  catch(e){ return {ok:false, error:String(e)}; }
}
const signedFileName = (no, name) => `${no}_${safeName(name)||"Client"}_SIGNED.pdf`;
const invoiceFileName = (no, name, suffix="") => `${no}_${safeName(name)||"Client"}_INVOICE${suffix}.pdf`;


/* ---------- receipts ---------- */
/* Amount in words, Ghana style: "One Thousand, Two Hundred and Seventy-Five Ghana Cedis, Fifty Pesewas Only" */
function amountInWords(n){
  n = Math.round((Number(n)||0) * 100) / 100;
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two = x => x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? "-" + ones[x%10] : "");
  const three = x => { const h = Math.floor(x/100), r = x%100; return (h ? ones[h] + " Hundred" + (r ? " and " : "") : "") + (r ? two(r) : ""); };
  const words = x => {
    if(x === 0) return "Zero";
    const parts = []; const scales = [[1e9,"Billion"],[1e6,"Million"],[1e3,"Thousand"]];
    for(const [v, name] of scales){ if(x >= v){ parts.push(three(Math.floor(x/v)) + " " + name); x %= v; } }
    if(x){ parts.push((parts.length && x < 100 ? "and " : "") + three(x)); }
    return parts.join(", ").replace(", and ", " and ");
  };
  const cedis = Math.floor(n), pes = Math.round((n - cedis) * 100);
  let s = words(cedis) + (cedis === 1 ? " Ghana Cedi" : " Ghana Cedis");
  if(pes) s += ", " + words(pes) + (pes === 1 ? " Pesewa" : " Pesewas");
  return s + " Only";
}

/* Description line for a receipt: event, dates, venue, guests. */
function receiptDescription(q){
  const c = q.client || {};
  const bits = [];
  bits.push((c.event || "Event") + (c.name ? ` for ${c.name}` : ""));
  const d = eventDates(c); if(d) bits.push(d);
  if(c.venue) bits.push(c.venue);
  if(c.guests) bits.push(`${c.guests} guests`);
  return bits.join(" · ");
}

function randomCode(len=8){
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const a = new Uint8Array(len);
  (global.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_,i) => a[i] = Math.floor(Math.random()*256));
  return Array.from(a, b => abc[b % abc.length]).join("");
}
function verifyUrl(r){
  const base = (global.location && /^https?:/.test(location.protocol)) ? new URL("verify.html", location.href).href : "https://godfredbrown.github.io/geowengas-quotes/verify.html";
  return `${base}#${encodeURIComponent(r.no)}.${r.code}`;
}

/* Receipt PDF — A5 landscape, laid out like 04_GEOWENGAS_Receipt_Template_A5_Landscape. */
function buildReceiptPdf(r){
  const { jsPDF } = global.jspdf;
  const doc = new jsPDF({unit:"mm", format:"a5", orientation:"landscape"});
  const W = 210, H = 148, M = 12;
  const PURPLE=[91,30,109], GOLD=[200,157,60], INK=[31,26,34], GREY=[90,90,90], LINE=[217,217,217], FILL=[247,247,247], LAV=[240,230,244];
  const A = (style,size,color) => { doc.setFont("helvetica",style); doc.setFontSize(size); doc.setTextColor(...(color||INK)); };
  const S = (style,size,color) => { doc.setFont("times",style); doc.setFontSize(size); doc.setTextColor(...(color||INK)); };
  doc.setProperties({title:`${r.no} ${BIZ.name} Receipt`, author:BIZ.name, subject:"Official Receipt",
    keywords:"GWQ:" + hex(JSON.stringify({kind:"receipt", receipt:r.no, code:r.code, no:r.quoteNo, id:r.quoteId}))});

  // Header
  const lw = 22, lh = lw*LOGO_RATIO;
  if(logoData){ try{ doc.addImage(logoData, "JPEG", M, 7, lw, lh); }catch(e){} }
  S("bold",12.5,PURPLE); doc.text(BIZ.name, W-M, 12.5, {align:"right"});
  A("bold",7.5,GOLD); doc.text(BIZ.sub, W-M, 16.5, {align:"right"});
  A("normal",6.4,[51,51,51]);
  doc.text(BIZ.phones, W-M, 20.3, {align:"right"});
  doc.text(`${BIZ.email}  |  ${BIZ.addr}`, W-M, 23.6, {align:"right"});
  doc.text(BIZ.social, W-M, 26.9, {align:"right"});

  // Title + meta row
  S("bold",15,PURPLE); doc.text("OFFICIAL RECEIPT", M, 36.5);
  let y = 39.5; const mh = 9, cw = (W-2*M)/3;
  doc.setFillColor(...FILL); doc.setDrawColor(...GOLD); doc.setLineWidth(0.35);
  doc.rect(M, y, W-2*M, mh, "FD"); doc.line(M+cw, y, M+cw, y+mh); doc.line(M+2*cw, y, M+2*cw, y+mh);
  [["RECEIPT NO:  ", r.no], ["DATE:  ", dmy(r.date)], ["PAYMENT METHOD:  ", r.method]].forEach((m,i) => {
    A("normal",7,GREY); doc.text(m[0], M+i*cw+3, y+5.7); const w = doc.getTextWidth(m[0]);
    let fz = 7.4; A("bold",fz); while(doc.getTextWidth(String(m[1]||"")) > cw-w-5 && fz > 5.2){ fz -= 0.2; A("bold",fz); }
    doc.text(doc.splitTextToSize(String(m[1]||""), cw-w-5)[0] || "", M+i*cw+3+w, y+5.7);
  });
  y += mh + 8;

  // Received from
  A("bold",8); doc.text("RECEIVED FROM:", M, y); const rw = doc.getTextWidth("RECEIVED FROM:  ");
  A("normal",8.6); doc.text(doc.splitTextToSize(r.from || "", W-2*M-rw)[0] || "", M+rw, y-0.4);
  doc.setDrawColor(...INK); doc.setLineWidth(0.25); doc.line(M+rw-1, y+1, W-M, y+1);
  y += 4.5;

  // Detail table
  const labW = 50, valW = W-2*M-labW;
  const rows = [
    ["Amount Received (figures)", `GHC ${amt(r.amount)}`, true],
    ["Amount Received in words", amountInWords(r.amount)],
    ["For / Description", r.desc || ""],
    ["Invoice / Quote No. / Ref No.", [r.invoiceNo, r.quoteNo, r.ref ? `Ref: ${r.ref}` : ""].filter(Boolean).join("  /  ")],
    ["Balance Due", r.balance > 0.004 ? `GHC ${amt(r.balance)}   (Total GHC ${amt(r.total)} · Paid to date GHC ${amt(r.paidToDate)})` : `GHC 0.00   (Paid in full · Total GHC ${amt(r.total)})`, true]
  ];
  let fs = 7.8;
  const lay = () => rows.map(rw2 => { A(rw2[2] ? "bold" : "normal", fs); const lines = doc.splitTextToSize(String(rw2[1]), valW-6); return {lines, h: Math.max(7.6, lines.length*3.4 + 3.6)}; });
  let L = lay(); while(L.reduce((s,x) => s + x.h, 0) > 46 && fs > 6.2){ fs -= 0.3; L = lay(); }
  rows.forEach((rw2, i) => {
    const h = L[i].h;
    doc.setFillColor(...LAV); doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
    doc.rect(M, y, labW, h, "FD"); doc.rect(M+labW, y, valW, h, "S");
    A("bold",7.2,PURPLE); doc.text(rw2[0], M+2.5, y+4.6);
    A(rw2[2] ? "bold" : "normal", fs, i === 4 && r.balance <= 0.004 ? [31,122,77] : INK);
    doc.text(L[i].lines, M+labW+3, y+4.6, {lineHeightFactor:1.2});
    y += h;
  });

  // Signature
  const sy = Math.max(y + 18, 123);
  A("normal",8); doc.text("Authorized Signature:", M, sy); const sx = M + doc.getTextWidth("Authorized Signature:  ");
  doc.setDrawColor(...INK); doc.setLineWidth(0.25); doc.line(sx, sy+0.8, sx+55, sy+0.8);
  if(r.sigImg){ try{ const h = 12, w = Math.min(55, h*(r.sigRatio||3)); doc.addImage(r.sigImg, "PNG", sx+1, sy-h+0.6, w, h); }catch(e){} }
  A("bold",8); doc.text("GEOWENGAS EVENT SOLUTIONS", M, sy+7);
  A("normal",6.3,GREY); doc.text(`Issued ${new Date(r.issuedAt||Date.now()).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}`, M, sy+10.6);

  // Stamp
  const paid = r.balance <= 0.004;
  const col = paid ? [31,122,77] : [178,106,0];
  doc.setTextColor(...col); doc.setFont("helvetica","bold"); doc.setFontSize(15);
  doc.text(paid ? "PAID IN FULL" : "PART PAYMENT", 118, sy+4, {angle:12});
  doc.setFontSize(7); doc.text(dmy(r.date), 128, sy+8.2, {angle:12});

  // QR code for verification
  if(r.code && global.qrcode){
    try{
      const qr = global.qrcode(0, "M"); qr.addData(verifyUrl(r)); qr.make();
      const n = qr.getModuleCount(), size = 22, cell = size/n, qx = W-M-size, qy = 98.5;
      doc.setFillColor(255,255,255); doc.rect(qx-1, qy-1, size+2, size+2, "F");
      doc.setFillColor(...INK);
      for(let rr=0; rr<n; rr++) for(let cc=0; cc<n; cc++) if(qr.isDark(rr,cc)) doc.rect(qx+cc*cell, qy+rr*cell, cell+0.02, cell+0.02, "F");
      A("bold",6,PURPLE); doc.text("Scan to verify", qx+size/2, qy+size+3.2, {align:"center"});
      A("normal",5.8,GREY); doc.text(`Code ${r.code.slice(0,4)}-${r.code.slice(4)}`, qx+size/2, qy+size+6, {align:"center"});
    }catch(e){}
  }

  // Footer
  A("bold",7,PURPLE); doc.setCharSpace(0.3); doc.text(BIZ.tagline, W/2, H-5, {align:"center"}); doc.setCharSpace(0);
  return doc;
}
async function verifyReceipt(no, code){
  if(!DRIVE_UPLOAD.url) return {ok:false, error:"not set up"};
  try{
    const r = await fetch(`${DRIVE_UPLOAD.url}?action=verify&no=${encodeURIComponent(no)}&code=${encodeURIComponent(code)}`, {redirect:"follow"});
    return await r.json();
  }catch(e){ return {ok:false, error:String(e)}; }
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

global.GW = {BIZ, PAYMENT, PAYMENT_NOTE, STD_CONDS, DEPOSIT_RATE, eventDates, esc, num, amt, money, iso, addDays, dmy, longDate, isFilled, totals, clientRows, checkCode,
  encodeQuote, decodeQuote, waNumber, paperHTML, buildPdf, readPdfRef, shareOrDownload, downloadBlob, safeName, toast, logoReady, uploadSigned, driveEnabled, signedFileName, invoiceFileName, checkDrive,
  amountInWords, receiptDescription, randomCode, verifyUrl, buildReceiptPdf, verifyReceipt};
})(window);
