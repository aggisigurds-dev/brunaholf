// kerfi-kort.js — the "system map": one powerful live view of the whole customer
// database + how it's wired. Backs kerfiskort.html.
//
//   GET /api/kerfi-kort              → { customers:[…] }  (v_kerfi_kort, one row per base)
//   GET /api/kerfi-kort?base=ID      → { base, sites:[…], docs:[…], payday:[…] }
//   GET /api/kerfi-kort?counts=1     → { tables:{…}, health:{…} }  (schema graphic)
//
// Read-only. Service role (customer_documents / solur / payday are RLS-off but we
// keep the key server-side and never expose it).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cors(){ return { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,OPTIONS' }; }
function json(code, body){ return { statusCode:code, headers:Object.assign({'Content-Type':'application/json'},cors()), body:JSON.stringify(body) }; }
function sbHeaders(extra){ return Object.assign({ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }, extra||{}); }
async function sbGet(path){
  const out=[];
  for(let from=0;;from+=1000){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{ headers:sbHeaders({ Range:`${from}-${from+999}` }) });
    if(!r.ok) throw new Error('sbGet '+r.status+' '+(await r.text()).slice(0,140));
    const rows=await r.json().catch(()=>[]); out.push(...rows);
    if(rows.length<1000) break;
  }
  return out;
}
// single count via Content-Range header (head=true)
async function sbCount(table, filter){
  const q = `${table}?select=id`+(filter?('&'+filter):'');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${q}`,{ headers:sbHeaders({ Range:'0-0', Prefer:'count=exact' }) });
  const cr=r.headers.get('content-range')||'*/0'; const n=parseInt(cr.split('/')[1],10); return Number.isFinite(n)?n:0;
}
function digits(s){ return String(s||'').replace(/\D/g,''); }
function dash(kt){ const d=digits(kt); return d.length>=10 ? d.slice(0,6)+'-'+d.slice(6,10) : d; }

exports.handler = async (event) => {
  if(event.httpMethod==='OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(!SUPABASE_URL||!SUPABASE_KEY) return json(500,{ error:'Supabase env missing' });
  try{
    const p = event.queryStringParameters || {};

    // ── schema graphic: table row counts + health totals ──
    if(p.counts){
      const [customers_base, fyrirtaeki, fyrirtaeki_live, vidskiptavinir, uttaeki, customer_documents, docs_active, docs_dup, solur, payday, rekstr] = await Promise.all([
        sbCount('customers_base'), sbCount('fyrirtaeki'), sbCount('fyrirtaeki','deleted_at=is.null'),
        sbCount('vidskiptavinir'), sbCount('uttaeki'), sbCount('customer_documents'),
        sbCount('customer_documents','is_duplicate=is.false'), sbCount('customer_documents','is_duplicate=is.true'),
        sbCount('solur','status=eq.final'), sbCount('payday_invoices_slokk'),
        sbCount('customers_base','rekstrarfelag=not.is.null'),
      ]);
      const [eq_nosite, eq_nobase, fyr_nobase, fyr_nokt, docs_unlinked, docs_nobase] = await Promise.all([
        sbCount('uttaeki','worksite_id=is.null'), sbCount('uttaeki','customer_base_id=is.null'),
        sbCount('fyrirtaeki','customer_base_id=is.null&deleted_at=is.null'),
        sbCount('fyrirtaeki','kennitala=is.null&deleted_at=is.null'),
        sbCount('customer_documents','fyrirtaeki_id=is.null&is_duplicate=is.false'),
        sbCount('customer_documents','customer_base_id=is.null'),
      ]);
      return json(200,{
        tables:{ customers_base, fyrirtaeki, fyrirtaeki_live, vidskiptavinir, uttaeki, customer_documents, docs_active, docs_dup, solur, payday, rekstrarfelog:rekstr },
        health:{ eq_nosite, eq_nobase, fyr_nobase, fyr_nokt, docs_unlinked, docs_nobase },
      });
    }

    // ── one customer: sites + docs + payday ──
    if(p.base){
      const bid = parseInt(p.base,10);
      const base = (await sbGet(`customers_base?id=eq.${bid}&select=id,nafn,kennitala,rekstrarfelag,netfang,simi,heimilisfang,general_notes`))[0] || null;
      const sites = await sbGet(`fyrirtaeki?customer_base_id=eq.${bid}&select=id,nafn,heimilisfang,kennitala,er_i_thjonustu,deleted_at,banner_note&order=deleted_at.nullsfirst,heimilisfang`);
      const docs = await sbGet(`customer_documents?customer_base_id=eq.${bid}&select=id,doc_type,year,drive_file_id,invoice_number,amount,fyrirtaeki_id,is_duplicate,notes&order=doc_type,year.desc`);
      let payday=[];
      if(base && base.kennitala){ const d=dash(base.kennitala), dd=digits(base.kennitala);
        if(dd.length===10) payday = await sbGet(`payday_invoices_slokk?or=(kt.eq.${d},kt.eq.${dd})&select=number,amount_total,created_date,due_date,paid_date,status&order=created_date.desc`);
      }
      return json(200,{ base, sites, docs, payday });
    }

    // ── the whole map ──
    const customers = await sbGet('v_kerfi_kort?select=*&order=nafn.asc');
    return json(200,{ customers, generated_at:null });
  }catch(e){
    return json(500,{ error:String(e.message||e) });
  }
};
