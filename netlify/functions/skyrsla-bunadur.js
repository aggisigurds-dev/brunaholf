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
// On-demand (one PDF per call) → fast, no batch, always live.

const { freshAccessToken } = require('./_google');
const pdf = require('pdf-parse');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cors(){ return { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,OPTIONS' }; }
function json(code, body){ return { statusCode:code, headers:Object.assign({'Content-Type':'application/json'},cors()), body:JSON.stringify(body) }; }
function sbHeaders(){ return { apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }; }

async function pdfText(id, token){
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

exports.handler = async (event) => {
  if(event.httpMethod==='OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  try{
    const p = event.queryStringParameters || {};
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
