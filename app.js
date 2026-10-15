(() => {
  'use strict';
  const data = window.BISON_DATA;
  const courses = data.Veranstaltungen;
  const $ = id => document.getElementById(id);
  const controls = {query:$('query'), program:$('program'), professor:$('professor'), teacher:$('teacher'), type:$('type')};
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de');
  const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unique = arr => [...new Set(arr.filter(Boolean))];
  const teacherNames = c => unique(c.Lehrpersonen.map(p=>p.Name).filter(n=>n!=='keine öffentliche Person'));
  function programName(name, degree=''){
    let clean=String(name||'').replace(/\s*\(PO\s*[^)]*\)/gi,'').replace(/,?\s*PV\s*\d+.*$/i,'').trim();
    const suffix=clean.match(/\(([BM]\.?\s*(?:Sc|A|F\.?\s*A)|Dipl)\.?\)$/i);
    if(suffix){degree=suffix[1];clean=clean.slice(0,suffix.index).trim();}
    const prefix=clean.match(/^([BM]\.\s*(?:Sc|A|F\.\s*A)\.)\s*/i);
    if(prefix){degree=prefix[1];clean=clean.slice(prefix[0].length);}
    if(clean==='Produkt-Design')clean='Produktdesign';
    if(/^Lehramt\b/.test(clean))degree='';
    degree=degree?degree.replace(/\s+/g,'').replace(/\.?$/,'.'):'';
    if(degree==='Diplom.')degree='Dipl.';
    if(clean==='Alle Studiengänge')return '';
    return [degree,clean].filter(Boolean).join(' ').trim();
  }
  const programsByCourse=new Map(courses.map(c=>[c.BISON_ID,unique([
    ...(c.Verzeichnispfade||[]).map(p=>p[1]).filter(p=>/^[BM]\.\s*(?:Sc|A|F\.\s*A)\./.test(p||'')).map(p=>programName(p)),
    ...c.Credits_je_Studiengang.filter(p=>p.Studiengang!=='Alle Studiengänge').map(p=>programName(p.Studiengang,p.Abschluss==='Leer'?'':p.Abschluss))
  ])]));
  // Only degree programmes listed directly under this faculty belong in the picker.
  // Credit assignments may also reference programmes from other faculties.
  const programNames=unique(courses.flatMap(c=>(c.Verzeichnispfade||[])
    .filter(p=>p[0]==='Fakultät Architektur und Urbanistik')
    .map(p=>p[1])
    .filter(p=>/^[BM]\.\s*(?:Sc|A|F\.\s*A)\./.test(p||''))
    .map(p=>programName(p))));
  function matchesProgram(c,query){
    if(!query)return true;
    return programNames.includes(query)&&(programsByCourse.get(c.BISON_ID).includes(query)||c.Credits_je_Studiengang.some(p=>p.Studiengang==='Alle Studiengänge'));
  }
  const list = (id, entries) => { for(const name of unique(entries).sort((a,b)=>a.localeCompare(b,'de'))){const o=document.createElement('option');o.value=name;o.textContent=name;$(id).append(o);} };
  list('professor',courses.flatMap(c=>c.Professur_Einrichtung));
  list('teacher',courses.flatMap(teacherNames));
  list('type',courses.map(c=>c.Grunddaten.Veranstaltungsart));
  list('program',programNames);
  const searchText = new Map(courses.map(c=>[c.BISON_ID,norm([c.Titel,c.Beschreibung,...c.Professur_Einrichtung,...teacherNames(c)].join(' '))]));
  function matches(c, state){return matchesProgram(c,state.program)&&(!state.professor||c.Professur_Einrichtung.includes(state.professor))&&(!state.teacher||teacherNames(c).includes(state.teacher))&&(!state.type||c.Grunddaten.Veranstaltungsart===state.type)&&norm(state.query).trim().split(/\s+/).filter(Boolean).every(term=>searchText.get(c.BISON_ID).includes(term));}
  function creditSummary(c){const values=unique(c.Credits_je_Studiengang.map(x=>x.Credits));if(values.length)return values.join(' / ')+' ECTS';if(c.Credits_Freitext?.length)return 'Angabe im Detail';return 'Nicht angegeben';}
  function card(c){
    const people = unique(c.Lehrpersonen.map(p=>p.Name==='keine öffentliche Person'?'Weitere Person nicht öffentlich':p.Name));
    const creditRows = c.Credits_je_Studiengang.map(x=>'<li>'+escape([x.Abschluss==='Leer'?'':x.Abschluss,x.Studiengang].filter(Boolean).join(' · '))+': '+escape(x.Credits?x.Credits+' ECTS':'nicht angegeben')+'</li>').join('');
    const notes=(c.Credits_Freitext||[]).map(n=>'<p>'+escape(n.Quellfeld)+': '+escape(n.Originaltext)+'</p>').join('');
    return '<article class="course"><div class="course-top"><span class="kind">'+escape(c.Grunddaten.Veranstaltungsart)+'</span><span>'+escape(c.Grunddaten.Veranstaltungsnummer||'BISON '+c.BISON_ID)+'</span></div><h3>'+escape(c.Titel)+'</h3><dl><dt>Professur</dt><dd>'+escape(c.Professur_Einrichtung.join(' · ')||'Nicht angegeben')+'</dd><dt>Lehrende</dt><dd>'+escape(people.join(' · ')||'Nicht angegeben')+'</dd><dt>Credits</dt><dd>'+escape(creditSummary(c))+'</dd></dl><p class="brief'+(!c.Beschreibung?' missing':'')+'">'+escape(c.Kurzbeschreibung||'Keine Beschreibung in BISON hinterlegt.')+'</p><details><summary>Beschreibung und Details</summary>'+(c.Beschreibung?'<p class="full-description">'+escape(c.Beschreibung)+'</p>':'')+'<p><strong>Credits je Studiengang</strong></p>'+(creditRows?'<ul class="credit-list">'+creditRows+'</ul>':(notes?'':'<p>Nicht angegeben.</p>'))+notes+'</details><div class="course-bottom"><a class="source-link" target="_blank" rel="noopener noreferrer" href="'+escape(c.Quelle)+'">In BISON ansehen<span class="sr-only"> (neuer Tab)</span></a></div></article>';
  }
  function state(){return Object.fromEntries(Object.entries(controls).map(([k,el])=>[k,el.value]));}
  function render(){const filtered=courses.filter(c=>matches(c,state()));$('count').textContent=filtered.length+' von '+courses.length+' Veranstaltungen';$('courses').innerHTML=filtered.map(card).join('');$('empty').hidden=filtered.length>0;return filtered;}
  $('filters').addEventListener('submit',e=>e.preventDefault());
  $('query').addEventListener('input',render);
  for(const key of ['program','professor','teacher','type'])controls[key].addEventListener('change',render);
  function reset(){Object.values(controls).forEach(el=>el.value='');render();}
  $('filters').addEventListener('reset',e=>{e.preventDefault();reset();});
  $('empty-reset').addEventListener('click',reset);
  render();
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    const tool={name:'filter_courses',description:'Filtert das sichtbare Lehrangebot nach Suchtext, exaktem Studiengang, exakter Professur, exaktem Lehrendennamen und Veranstaltungsart. Leere oder ausgelassene Felder heben den jeweiligen Filter auf.',inputSchema:{type:'object',properties:Object.fromEntries(Object.keys(controls).map(k=>[k,{type:'string'}])),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>!(k in controls)||typeof input[k]!=='string'))throw new Error('Ungültige Filter.');for(const key of ['program','professor','teacher','type'])if(input[key]&&![...controls[key].options].some(o=>o.value===input[key]))throw new Error('Unbekannter Filterwert: '+key);for(const [k,el] of Object.entries(controls))el.value=input[k]||'';const result=render();return {count:result.length,courses:result.map(c=>({id:c.BISON_ID,title:c.Titel}))};}};
    try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
