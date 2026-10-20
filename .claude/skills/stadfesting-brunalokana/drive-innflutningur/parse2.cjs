// Les niðurhalaðar docx-staðfestingar (tool-results) → parsed2.json (með föstum köflum, haus og lokum hvers skjals)
const fs = require('fs'), path = require('path'); const JSZip = require('jszip');
const DIR = 'C:/Users/Slokkvitaeki/.claude/projects/C--Users-Slokkvitaeki/5703e450-58b6-4dba-a31e-0cd005b56ac0/tool-results';
const isoDate = (s) => { const m = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(s || ''); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; };

// Aðeins texti úr <w:t>; <w:br/> og </w:p> verða línuskil; allt annað (tög og flækingstexti) er hent.
function lines(xml) {
  let o = '';
  const RX = /<w:br\/>|<w:tab\/>|<\/w:p>|<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<[^>]+>|[^<]+/g;
  xml.replace(RX, (m, t) => {
    if (t !== undefined) o += t;
    else if (m === '<w:br/>') o += '\n';
    else if (m === '<w:tab/>') o += ' ';
    else if (m === '</w:p>') o += '\n\n';
    return '';
  });
  o = o.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return o.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

(async () => {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.includes('download_file_content'))) {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (!/wordprocessingml/.test(j.mimeType)) continue;
    const zip = await JSZip.loadAsync(Buffer.from(j.content, 'base64'));
    const L = lines(await zip.file('word/document.xml').async('string'));
    const H = [];
    for (const n of Object.keys(zip.files).filter((n) => /^word\/header\d*\.xml$/.test(n))) H.push(...lines(await zip.file(n).async('string')));
    const hdr = H.join(' | ');
    const leyfi = (/Leyfisn[úu]mer\s*([0-9-]+)/i.exec(hdr) || [])[1] || '';
    const abyrg = (/[ÁA]byrg[ðd]ama[ðd]ur:?\s*([^|]+?)\s*(\||$)/i.exec(hdr) || [])[1] || '';
    const hausTitill = (/BRUNAHÓLF EHF\.?\s*\|?\s*([^|]*?Yfirl[^|]*?)\s*(\||$)/i.exec(hdr) || [])[1] || '';
    const iDate = L.findIndex((l) => /Dagsetning:/i.test(l));
    const iIntro = L.findIndex((l) => /lýsir yfir/i.test(l));
    const iHv = L.findIndex((l, i) => i >= iIntro && /^Hvað var gert/i.test(l));
    const iH2 = L.findIndex((l) => /^Framkvæmd og gæðaviðmið/i.test(l));
    const iH3 = L.findIndex((l) => /^Lög og reglugerð/i.test(l));
    const iH4 = L.findIndex((l) => /^Eftirlit og gæðaeftirlit/i.test(l));
    const iKv = L.findIndex((l) => /^Með fyrirfram þökk/i.test(l));
    const iKv2 = L.findIndex((l, i) => i > iKv && /^Með kveðju/i.test(l));
    const stadur = [...L.slice(0, iDate), L[iDate].replace(/Dagsetning:.*$/i, '').trim()].filter(Boolean).join(', ').replace(/,\s*$/, '');
    const intro = L.slice(iIntro, iHv >= 0 ? iHv : iIntro + 1).join(' ');
    const ok = [iHv, iH2, iH3, iH4, iKv, iKv2].every((i) => i >= 0);
    out.push({
      id: j.id, title: j.title, leyfi, abyrg, hausTitill, stadur, dags: isoDate(L[iDate]), medEftirf: /Eftirfarandi var unni/.test(intro),
      body: iHv >= 0 ? L.slice(iHv + 1, iH2) : [], h2: L[iH2], gaedavidmid: L.slice(iH2 + 1, iH3), h3: L[iH3], login: L.slice(iH3 + 1, iH4),
      h4: L[iH4], eftirlit: L.slice(iH4 + 1, iKv), kvedja: L.slice(iKv, iKv2), kvedja2: L[iKv2], eftir: L.slice(iKv2 + 1), ok,
    });
  }
  // Sama skjalið tvisvar (Fjörður 06.08.2025): halda þeirri fyrstu
  const seen = new Set();
  const uniq = out.filter((r) => { const k = r.stadur + '|' + r.dags + '|' + r.body.join('/'); if (seen.has(k)) { console.log('TVÍTAK sleppt:', r.title, r.id.slice(0, 6)); return false; } seen.add(k); return true; });
  fs.writeFileSync(path.join(__dirname, 'parsed2.json'), JSON.stringify(uniq, null, 1));
  uniq.sort((a, b) => String(a.dags).localeCompare(String(b.dags))).forEach((r) => console.log(r.dags, '|', r.stadur.slice(0, 40), '|', r.leyfi, '|', r.abyrg.slice(0, 12), '|ok', r.ok, '|', r.kvedja2, '|', r.eftir.join('/').slice(0, 45)));
  console.log(uniq.length, 'skjöl');
})();
