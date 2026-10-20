const fs=require('fs');const P=require('./parsed2.json');
const out=P.sort((a,b)=>a.dags.localeCompare(b.dags)).map(p=>{
  let umraedir='',nidurstada='';const rest=[];
  p.body.forEach(t=>{ if(!umraedir&&/^Um ræðir/i.test(t))umraedir=t; else if(!nidurstada&&/^Að loknum/i.test(t))nidurstada=t; else rest.push(t); });
  const nafn=(p.eftir[p.eftir.length-1]||p.abyrg||'Annþór Kristján Karlsson');
  const v={ stadur:p.stadur, dagsetning:p.dags, byggingar:'',
    hausTitill:p.hausTitill||'Yfirlýsing vegna Brunalokana', leyfisnumer:p.leyfi||'202209-0174', abyrgdarmadur:/Annþór|Sverrir/.test(nafn)?nafn:(p.abyrg||nafn),
    inngangur:'Brunahólf ehf. lýsir yfir að öll vinna og efni standist kröfur og reglugerðir samkvæmt leiðbeiningum Húsnæðis- og mannvirkjastofnunar (HMS) og öðrum viðeigandi reglugerðum.'+(p.medEftirf?'\nEftirfarandi var unnið:':''),
    h1:'Hvað var gert', hvadVarGert:rest.join('\n'), umraedir, nidurstada,
    h2:p.h2, gaedavidmid:p.gaedavidmid.join('\n'), h3:p.h3, login:p.login.join('\n'), h4:p.h4, eftirlit:p.eftirlit.join('\n'),
    kvedja:p.kvedja.join('\n'), kvedja2:p.kvedja2, fyrirhond:p.eftir[0]||'FH. Brunahólf ehf.',
    _endurgert:{ drive_id:p.id, drive_titill:p.title, endurgert:new Date().toISOString().slice(0,10), athugasemd:'Endurgert úr Word-skjali (docx) því PDF-frumrit fannst ekki á Drive. Texti skjalsins er óbreyttur; uppsetning er úr sniðmáti Eyðublaða.' } };
  return { v, fileName:'Stadfesting_'+p.stadur.split(',')[0].replace(/[^A-Za-z0-9ÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö ]+/g,'').trim().replace(/\s+/g,'_')+'_'+p.dags.split('-').reverse().join('-')+'_endurgerd.pdf', title:p.title };
});
fs.writeFileSync('endurgerd.json',JSON.stringify(out,null,1));
out.forEach(o=>console.log(o.v.dagsetning,'|',o.v.stadur.slice(0,38),'|',o.v.hvadVarGert.split('\n').length+'h',o.v.umraedir?'U':'-',o.v.nidurstada?'N':'-','|',o.v.abyrgdarmadur,'|',o.fileName));
