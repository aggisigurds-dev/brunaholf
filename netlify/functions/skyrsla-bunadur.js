// skyrsla-bunadur.js — read the equipment breakdown out of an úttektarskýrslu PDF.
//
// The reports are app-generated PDFs with a real text layer listing each
// category with "Fjöldi: N": Slökkvitæki (léttvatn/duft/CO2 — all extinguisher
// types → Slk), Brunaslöngur (BSL), Reykskynjarar (Rs), Eldvarnarteppi. The
// uttaeki table is auto-generated junk, so the report PDF is the real source.
//
//   GET /api/skyrsla-bunadur?file=<drive_file_id>   → parse that one report
//   GET /api/skyrsla-bunadur?base=<id>              → parse the LATEST report of the base
//
//   GET /api/skyrsla-bunadur?batch=1[&dry=1][&limit=3][&offset=N]
//     → for every IN-SERVICE site that is NOT inspected in 2026 („óskoðuð 2026")
//       and has a connected úttektarskýrsla, read the LATEST report and write its
//       equipment (SLT/BSL/RS in the detailed keys Slökkvitæki's eqGroups reads)
//       + the inspection MONTH into app_settings.arsskodun_customers[fyrirtaeki_id],
//       so „Tæki" + „Skoðun" fill on Fyrirtæki í þjónustu. Batched (OCR is slow);
//       the caller loops offset→next_offset until done. dry=1 previews, no write.
//
// On-demand (one PDF per call) → fast, no batch, always live.

const { freshAccessToken } = require('./_google');
const pdf = require('pdf-parse');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cors(){ return { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,OPTIONS' }; }
function json(code, body){ return { statusCode:code, headers:Object.assign({'Content-Type':'application/json'},cors()), body:JSON.stringify(body) }; }
function sbHeaders(){ return { apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }; }

// Google-Doc OCR (copy → export text → delete) — the RELIABLE reader for these
// app-generated report PDFs (pdf-parse can drop table columns like the CO2 lines,
// so the Slk sum came out low). Same path drive-sort uses.
async function driveOcr(id, token){
  const cp = await fetch('https://www.googleapis.com/drive/v3/files/'+id+'/copy?supportsAllDrives=true&fields=id', {
    method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ name:'tmp-ocr-'+id, mimeType:'application/vnd.google-apps.document' }),
  });
  if(!cp.ok) return '';
  const doc = await cp.json().catch(()=>null); if(!doc||!doc.id) return '';
  let text='';
  try{ const ex=await fetch('https://www.googleapis.com/drive/v3/files/'+doc.id+'/export?mimeType=text/plain', { headers:{ Authorization:`Bearer ${token}` } }); if(ex.ok) text=await ex.text(); }catch(_){}
  fetch('https://www.googleapis.com/drive/v3/files/'+doc.id+'?supportsAllDrives=true', { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } }).catch(()=>{});
  return text;
}
async function pdfText(id, token){
  let text = await driveOcr(id, token).catch(()=>'');
  if((text||'').replace(/\s/g,'').length >= 25) return text;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!r.ok) throw new Error('Drive '+r.status);
  const d = await pdf(Buffer.from(await r.arrayBuffer())).catch(()=>null);
  return (d && d.text) || '';
}

// Sum the integers in a "Fjöldi" value: "1+1 ABF" → 2 · "x" → 0 · "2" → 2.
function sumNums(s){ const m=String(s||'').match(/\d+/g); return m ? m.reduce((a,b)=>a+ (+b),0) : 0; }

// Each category line: "<label> … Fjöldi: <value> [Í lagi: …]". Value is read up to
// "Í lagi" (or line end) so the "Já/nei/x" status never leaks into the count.
const CATS = [
  { key:'lettvatn', grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+l[ée]ttvatn[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'duft_2',   grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+duft\s*2[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'duft_6',   grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+duft\s*6[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'co2_2',    grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+(?:co2|kols[ýy]r)[^\n]*?2\s*kg[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'co2_5',    grp:'slk',   re:/sl[öo]kkvit[æa]ki\s+(?:co2|kols[ýy]r)[^\n]*?5\s*kg[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'bsl',      grp:'bsl',   re:/brunasl[öo]ng[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'teppi',    grp:'teppi', re:/eldvarnarteppi[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
  { key:'rs',       grp:'rs',    re:/reykskynjar[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|$)/i },
];

function parseBunadur(text){
  const t = String(text||'').replace(/\r/g,'');
  // Per-subtype (best effort, for the tooltip/detail).
  const detail={};
  for(const c of CATS){ const m=t.match(c.re); detail[c.key]= m ? sumNums(m[1]) : null; }
  // Slk total is computed ROBUSTLY from EVERY "Slökkvitæki … Fjöldi: N" line so a
  // CO2/kolsýra subtype whose exact-size regex misses is never dropped from the sum.
  let slk=0; const re=/sl[öo]kkvit[æa]ki\b[^\n]*?fj[öo]ldi:?\s*([^\n]*?)(?:[íi]\s*lagi|\n|$)/gi; let m;
  while((m=re.exec(t))){ slk += sumNums(m[1]); if(re.lastIndex===m.index) re.lastIndex++; }
  const rs=detail.rs||0, bsl=detail.bsl||0, teppi=detail.teppi||0;
  const matched=Object.values(detail).filter(v=>v!=null).length;
  return { slk, rs, bsl, teppi, detail, matched };
}

// Report month: prefer "Dags dd.mm.yyyy"; else "{mánuður} 20yy".
const MNUM = { 'janúar':1,'febrúar':2,'mars':3,'apríl':4,'maí':5,'júní':6,'júlí':7,'ágúst':8,'september':9,'október':10,'nóvember':11,'desember':12 };
function parseMonth(text){
  const t = String(text||'');
  let m = /Dags[^\d]{0,6}\d{1,2}[.\/](\d{1,2})[.\/]\d{2,4}/i.exec(t);
  if(m) return parseInt(m[1],10);
  m = /(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember)\s+20\d\d/i.exec(t);
  if(m) return MNUM[m[1].toLowerCase()] || null;
  return null;
}
// Map skyrsla-bunadur detail → the detailed equipment keys Slökkvitæki's
// eqGroups() sums (lettvatn+duft2+duft6_12+co2_2+co2_5 = SLT; brunaslongur = BSL;
// reykskynjarar = RS). Any Slk remainder the exact-size regex missed is dumped
// into duft6_12 so the SLT total always equals the robust `slk` count.
function toEquipment(b){
  const d = b.detail || {};
  const known = (d.lettvatn||0)+(d.duft_2||0)+(d.duft_6||0)+(d.co2_2||0)+(d.co2_5||0);
  const remainder = Math.max(0, (b.slk||0) - known);
  return {
    lettvatn: d.lettvatn||0, duft2: d.duft_2||0, duft6_12: (d.duft_6||0)+remainder,
    co2_2: d.co2_2||0, co2_5: d.co2_5||0,
    brunaslongur: b.bsl||0, reykskynjarar: b.rs||0, eldvarnarteppi: b.teppi||0,
  };
}
async function sbAll(path){
  const out=[];
  for(let from=0;;from+=1000){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:Object.assign(sbHeaders(),{Range:`${from}-${from+999}`})});
    if(!r.ok) throw new Error('sbAll '+r.status+' '+(await r.text()).slice(0,140));
    const rows=await r.json().catch(()=>[]); out.push(...rows);
    if(rows.length<1000) break;
  }
  return out;
}

// Batch: fill Tæki + Skoðunar-mánuð for óskoðuð-2026 in-service sites from their
// latest connected úttektarskýrsla. Paged (OCR is slow) — caller loops.
async function runBatch(p, token){
  const dry = p.dry==='1' || p.dry==='true';
  const limit = Math.min(parseInt(p.limit,10)||3, 6);
  const offset = parseInt(p.offset,10)||0;

  const asRow = (await sbAll('app_settings?id=eq.1&select=settings'))[0] || {};
  const ars = (asRow.settings && asRow.settings.arsskodun_customers) || {};
  const svc = await sbAll('fyrirtaeki?er_i_thjonustu=eq.true&deleted_at=is.null&select=id');
  const svcIds = new Set(svc.map(s=>s.id));
  const docs = await sbAll('customer_documents?doc_type=eq.uttektarskyrsla&fyrirtaeki_id=not.is.null&drive_file_id=not.is.null&is_duplicate=is.false&select=drive_file_id,fyrirtaeki_id,year');
  const latest = {};
  for(const d of docs){ const cur=latest[d.fyrirtaeki_id]; if(!cur || (d.year||0)>(cur.year||0)) latest[d.fyrirtaeki_id]=d; }

  const targets = Object.values(latest).filter(d=>{
    if(!svcIds.has(d.fyrirtaeki_id)) return false;
    const a = ars[String(d.fyrirtaeki_id)] || {};
    return (+a.last_year_inspected!==2026) && (+a.field_inspected_year!==2026);   // óskoðuð 2026
  }).sort((a,b)=>a.fyrirtaeki_id-b.fyrirtaeki_id);

  const total = targets.length;
  const slice = targets.slice(offset, offset+limit);
  const results = [];
  for(const d of slice){
    let text=''; try{ text = await pdfText(d.drive_file_id, token); }catch(_){}
    const b = parseBunadur(text);
    const month = parseMonth(text);
    results.push({ fyrirtaeki_id:d.fyrirtaeki_id, year:d.year, month, slk:b.slk, bsl:b.bsl, rs:b.rs, teppi:b.teppi, ok:b.matched>0, equipment: toEquipment(b) });
  }

  let wrote = 0;
  if(!dry && results.some(r=>r.ok)){
    const row = (await sbAll('app_settings?id=eq.1&select=settings'))[0] || {};
    const settings = row.settings || {};
    const A = settings.arsskodun_customers = settings.arsskodun_customers || {};
    for(const r of results){
      if(!r.ok) continue;
      const cur = A[String(r.fyrirtaeki_id)] = A[String(r.fyrirtaeki_id)] || {};
      cur.equipment = r.equipment;
      if(r.month) cur.inspect_month = r.month;
      wrote++;
    }
    const up = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1`, {
      method:'PATCH', headers:Object.assign(sbHeaders(),{'Content-Type':'application/json',Prefer:'return=minimal'}),
      body: JSON.stringify({ settings }),
    });
    if(!up.ok) throw new Error('app_settings PATCH '+up.status+' '+(await up.text()).slice(0,140));
  }
  return { total, offset, next_offset: offset+slice.length, done: offset+slice.length>=total, dry, wrote, results };
}

exports.handler = async (event) => {
  if(event.httpMethod==='OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  try{
    const p = event.queryStringParameters || {};
    if(p.batch){ const token = await freshAccessToken(); return json(200, await runBatch(p, token)); }
    let fileId = p.file || null, year=null, docId=null;
    if(!fileId && p.base){
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?customer_base_id=eq.${parseInt(p.base,10)}&doc_type=eq.uttektarskyrsla&drive_file_id=not.is.null&is_duplicate=is.false&select=id,drive_file_id,year&order=year.desc.nullslast&limit=1`, { headers:sbHeaders() });
      const rows = await r.json().catch(()=>[]);
      if(!rows.length) return json(200,{ ok:false, reason:'engin úttektarskýrsla með skrá' });
      fileId=rows[0].drive_file_id; year=rows[0].year; docId=rows[0].id;
    }
    if(!fileId) return json(400,{ error:'file eða base krafist' });

    const token = await freshAccessToken();
    const text = await pdfText(fileId, token);
    if((text||'').replace(/\s/g,'').length < 30) return json(200,{ ok:false, reason:'gat ekki lesið PDF-texta', file:fileId, year });
    const b = parseBunadur(text);
    return json(200, { ok:true, file:fileId, doc_id:docId, year, bunadur:b });
  }catch(e){
    return json(500,{ error:String(e.message||e) });
  }
};
