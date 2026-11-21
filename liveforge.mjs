// LiveForge Quick Win: deterministic, local concept and interactive preview.
// No network calls, user-supplied HTML, or new runtime dependencies.
const profiles = [
  {id:'pairs',match:/auslos|paarung|kennenlern|pair(?:ing| pressure)|zufalls.*(?:team|paar)/iu,title:'Team-Zuordnung',entity:'Teilnehmende',singular:'Person',field:'Team',rows:[['Mara','Vertrieb'],['Alex','Produkt'],['Sam','Entwicklung'],['Kim','Support']],primary:'pairs',extras:['list','calendar','analytics']},
  {id:'property',match:/immobil|exposé|makler|vermarktungsstatus|mietobjekt|wohnung|grundstück|real estate/iu,title:'Immobilienverwaltung',entity:'Objekte',singular:'Objekt',field:'Standort',rows:[['Wohnung am Park','Essen'],['Stadthaus','Bochum'],['Bürofläche','Duisburg']],primary:'list',extras:['cards','calendar','analytics']},
  {id:'crm',match:/\bcrm\b|kundenverwalt|vertrieb|interessent|lead|kontakte|akquise/iu,title:'Kontaktverwaltung',entity:'Kontakte',singular:'Kontakt',field:'Organisation',rows:[['Mara Beispiel','Nord GmbH'],['Alex Muster','Studio West'],['Sam Demo','Projekt Süd']],primary:'list',extras:['calendar','analytics','cards']},
  {id:'calendar',match:/termin|buchung|reservier|kalender|sprechstunde|schedule|appointment/iu,title:'Terminplanung',entity:'Termine',singular:'Termin',field:'Ort / Anlass',rows:[['Erstgespräch','Online'],['Abstimmung','Büro'],['Folgetermin','Online']],primary:'calendar',extras:['list','analytics']},
  {id:'tasks',match:/aufgab|kanban|projektmanagement|todo|to.do|backlog|task manager/iu,title:'Aufgabenplanung',entity:'Aufgaben',singular:'Aufgabe',field:'Projekt',rows:[['Anforderungen klären','Konzept'],['Entwurf prüfen','Design'],['Umsetzung testen','Entwicklung']],primary:'list',extras:['calendar','analytics']},
  {id:'catalog',match:/shop|produkt|inventar|lager|katalog|rezept|sammlung|marketplace/iu,title:'Katalog',entity:'Einträge',singular:'Eintrag',field:'Kategorie',rows:[['Beispiel A','Kategorie 1'],['Beispiel B','Kategorie 2'],['Beispiel C','Kategorie 1']],primary:'cards',extras:['list','analytics']},
  {id:'finance',match:/finanz|budget|ausgaben|einnahmen|buchhalt|kostenübersicht|expense/iu,title:'Finanzübersicht',entity:'Positionen',singular:'Position',field:'Kategorie',rows:[['Position A','Planung'],['Position B','Laufend'],['Position C','Sonstiges']],primary:'analytics',extras:['list','calendar']},
  {id:'form',match:/formular|umfrage|anmeld|registr|erfass|fragebogen|survey/iu,title:'Datenerfassung',entity:'Einträge',singular:'Eintrag',field:'Notiz',rows:[],primary:'form',extras:['list','analytics']},
];
const generic={id:'generic',title:'Anwendungsentwurf',entity:'Einträge',singular:'Eintrag',field:'Notiz',rows:[],primary:'list',extras:['form','analytics']};
const functions=[
  ['list',/liste|übersicht|verwalt|tabelle|bestand|search|suche|filter|list/iu],
  ['cards',/galerie|katalog|kartenansicht|produktkarten|exposé|cards/iu],
  ['form',/formular|erfass|eingabe|anmeld|umfrage|registr|form\b/iu],
  ['calendar',/kalender|termin|buchung|reservier|calendar/iu],
  ['analytics',/statistik|analyse|auswertung|kennzahl|dashboard|report|analytics/iu],
  ['pairs',/auslos|paarung|kennenlern|pairing/iu],
];
const stages=[4,1,2,3,4,5,6,7,8];
const maxViews=[0,1,2,2,3,3,4,5,6];
const toneLabels=['Privat und locker','Eher informell','Neutral','Eher formell','Formell und arbeitsbezogen'];
const autonomyLabels=['Alle Entscheidungen offen','Nur Nebensächliches selbst entscheiden','Wichtige Entscheidungen zurückfragen','Nur richtungsweisende Entscheidungen zurückfragen','Nur Grundlegendes zurückfragen','Alle offenen Entscheidungen selbst treffen und als Annahmen kennzeichnen'];
const creativityLabels=['Nur ausdrücklich Vorgegebenes','Nur zwingend Nötiges','Naheliegende Ergänzungen als Vorschläge','Eigene Ideen als Vorschläge','Auch ungewöhnliche Ideen als Vorschläge'];
const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
const integer=(v,min,max,def)=>Number.isInteger(v)?Math.max(min,Math.min(max,v)):def;
const titleFor=(kind,p,tone)=>({list:p.entity,cards:p.id==='property'?'Exposé-Übersicht':'Katalog',form:p.singular+' erfassen',calendar:'Termine',analytics:tone>=3?'Berichtswesen':tone===0?'So läuft’s!':'Auswertung',pairs:tone===0?'Wer mit wem?':'Auslosung'}[kind]);

// The canonical input remains SpecIt's state; this proposal is never a confirmed spec.
export function buildLiveConcept(s={},context={}){
  const idea=text(s.idea),name=text(s.project,100),tone=integer(s.tone,0,4,2),creativity=integer(s.creativity,0,4,2);
  const autonomy=integer(Math.round((s.autonomy??40)/20),0,5,2)*20;
  const durLevel=integer(s.durLevel,0,8,0),level=stages[durLevel],minutes=[0,15,30,60,120,240,480,960,2400][durLevel];
  const layoutCount=s.layoutOn?integer(s.layoutCount,1,5,1):0,logoCount=integer(s.logoCount,0,5,0),nameCount=integer(s.nameCount,0,5,3);
  const device=['DESKTOP','MOBILE','BOTH'].includes(s.layoutDevice)?s.layoutDevice:'DESKTOP';
  const theme=['LIGHT','DARK','BOTH'].includes(s.layoutTheme)?s.layoutTheme:'LIGHT';
  // A small conservative negation check; this is heuristic, not language understanding.
  const chunks=idea.split(/[.;\n]|\b(?:aber|sondern)\b/iu);
  const negative=(before)=>/\b(?:ohne|kein(?:e[nsrm]?)?|nicht)\s+(?:[\p{L}-]+\s+){0,2}$/iu.test(before);
  const polarity=re=>{let yes=false,no=false;for(const part of chunks){
    const found=part.match(re);if(!found)continue;
    const before=part.slice(Math.max(0,found.index-32),found.index);
    if(negative(before))no=true;else yes=true;
  }return {yes,no}};
  const requested=functions.filter(([,re])=>polarity(re).yes&&!polarity(re).no).map(([k])=>k);
  const excluded=new Set(functions.filter(([,re])=>polarity(re).no).map(([k])=>k));
  const p=profiles.find(x=>polarity(x.match).yes&&!polarity(x.match).no)||generic;
  const primary=p!==generic&&!excluded.has(p.primary)?p.primary:(requested[0]||['list','form','cards','calendar','analytics','pairs'].find(k=>!excluded.has(k))||'list');
  // Explicitly requested features never disappear when the target time is reduced.
  const kinds=[...new Set([primary,...requested])];
  const extras=p.extras.filter(k=>!kinds.includes(k)&&!excluded.has(k));
  const cap=maxViews[level];
  // A stricter setting never invents optional features; high creativity offers more,
  // but a tight scope does not silently swallow explicit user wishes.
  const extraCount=creativity<2?0:Math.min(extras.length,Math.max(0,cap-kinds.length),creativity-1);
  kinds.push(...extras.slice(0,extraCount));
  const views=kinds.map(k=>({id:k,title:titleFor(k,p,tone),source:requested.includes(k)?'erkannter Wunsch':k===primary?'vorläufiger Kern':'optionaler Vorschlag'}));
  const rows=p.rows.map(([label,detail],i)=>({id:'demo-'+i,label,detail,done:false}));
  const title=name||(nameCount?p.title:'Anwendung ohne Namen');
  const scopeConflict=minutes>0&&kinds.filter(k=>requested.includes(k)||k===primary).length>cap;
  const descriptions=[
    ['Idee',idea],
    ['Name',name?name+' (festgelegt) · '+nameCount+' Namensvorschläge gewünscht':nameCount?nameCount+' Namensvorschläge gewünscht; Arbeitstitel: '+p.title:'Keine Namensvorschläge; neutraler Platzhalter'],
    ['Entscheidungsmodus',autonomyLabels[autonomy/20]],
    ['Kreativität',creativityLabels[creativity]],
    ['Einsatzbereich',toneLabels[tone]],
    ['Zielzeit',minutes?minutes+' Agentenminuten · Komplexität '+level+'/8':'Keine Zeitvorgabe · Komplexität '+level+'/8'],
    ['Stitch-Layouts',layoutCount?layoutCount+' Entwürfe je Gerätekombination/Farbmodus':'Keine Stitch-Entwürfe'],
    ['Zielgerät / Farbmodus',({DESKTOP:'Desktop',MOBILE:'Mobil',BOTH:'Desktop und Mobil'}[device])+' · '+({LIGHT:'Hell',DARK:'Dunkel',BOTH:'Hell und Dunkel'}[theme])],
    ['Logo',logoCount?logoCount+' Logo-Entwürfe gewünscht':s.logos?.[s.logoChosen]?'Gewähltes Logo beibehalten':'Keine Logo-Entwürfe'],
    ['Review',s.reviewBy?text(s.reviewBy,50)+(s.reviewModel?' · '+text(s.reviewModel,100):''):'Kein Review'],
    ['Funktionsvorschau',views.map(v=>v.title+' ('+v.source+')').join(', ')],
  ];
  for(const f of Array.isArray(s.features)?s.features:[])if(f?.on===false&&text(f.name,80))descriptions.push(['Nicht-Ziel',text(f.name,80)]);
  for(const q of Array.isArray(s.questions)?s.questions:[])if(q?.state==='decided'||q?.state==='default'){
    const values=[...(Array.isArray(q.choice)?q.choice.map(i=>q.options?.[i]).filter(x=>typeof x==='string'):[]),text(q.custom,500)].filter(Boolean);
    if(values.length)descriptions.push([q.state==='decided'?'Entschieden':'Annahme / Standard',text(q.question,240)+' – '+values.join('; ')]);
  }
  for(const extra of Array.isArray(s.extras)?s.extras:[])if(text(extra,500))descriptions.push(['Zusatzanforderung',text(extra,500)]);
  if(scopeConflict)descriptions.push(['Offener Umfang','Die erkannten Wünsche überschreiten die grobe Zielstruktur. Nichts wird automatisch gestrichen; Umfang im Feature-Schritt klären.']);
  return {idea,title,domain:p.id,entity:p.entity,singular:p.singular,field:p.field,primary,views,rows,tone,creativity,autonomy,level,minutes,layoutCount,logo:logoCount>0||!!s.logos?.[s.logoChosen],device,theme,phone:context.phone===true||device==='MOBILE',scopeConflict,descriptions};
}

const css=String.raw`
.lfq{margin:12px 0 4px;border:1px solid var(--surface-mid,#ced8d5);border-radius:9px;overflow:hidden;background:var(--card,#fff)}
.lfq[hidden]{display:none!important}
.lfq>summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px}
.lfq>summary::marker{content:''}
.lfq-body{padding:10px 12px 12px;display:grid;gap:8px}
.lfq-app{--lf-accent:#19765b;--lf-bg:#f1f5f3;--lf-panel:#fff;--lf-line:#d9e3df;--lf-ink:#17352d;--lf-muted:#526b63;--lf-radius:8px;--lf-space:10px;color:var(--lf-ink);font-size:13px;background:var(--lf-bg);border:1px solid var(--lf-line);border-radius:var(--lf-radius);overflow:hidden}
.lfq-app[data-tone="0"]{--lf-accent:#8054b3;--lf-radius:16px;--lf-space:13px}
.lfq-app[data-tone="1"]{--lf-accent:#267d89;--lf-radius:12px}
.lfq-app[data-tone="3"],.lfq-app[data-tone="4"]{--lf-accent:#255a81;--lf-radius:4px;--lf-space:7px}
.lfq-app[data-theme="dark"]{--lf-bg:#162329;--lf-panel:#23363b;--lf-line:#40545a;--lf-ink:#f3f9f7;--lf-muted:#b7cbc8;--lf-accent:#80d8b7}
.lfq-app[data-phone="true"]{max-width:360px;width:100%;margin-inline:auto}
.lfq-top,.lfq-main{padding:var(--lf-space)}
.lfq-top{border-bottom:1px solid var(--lf-line);background:var(--lf-panel);display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.lfq-top strong{overflow-wrap:anywhere}
.lfq-nav{display:flex;gap:5px;flex-wrap:wrap;padding:6px var(--lf-space);border-bottom:1px solid var(--lf-line)}
.lfq-app button{font:inherit;cursor:pointer;padding:5px 8px;border:1px solid var(--lf-line);border-radius:var(--lf-radius);background:var(--lf-panel);color:var(--lf-ink);overflow-wrap:anywhere}
.lfq-app button[aria-pressed="true"],.lfq-app .lfq-primary{border-color:var(--lf-accent);color:var(--lf-accent);font-weight:700}
.lfq-main{display:grid;gap:7px;min-height:104px}
.lfq-main h3{margin:0;font-size:15px;color:var(--lf-ink)}
.lfq-app input{background:var(--lf-panel);color:var(--lf-ink);border:1px solid var(--lf-line);padding:6px;border-radius:var(--lf-radius);width:100%;min-width:0}
.lfq-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:7px;border:1px solid var(--lf-line);border-radius:var(--lf-radius);background:var(--lf-panel)}
.lfq-row>span:first-child{flex:1;min-width:80px;overflow-wrap:anywhere}
.lfq-muted{font-size:11px;color:var(--lf-muted);overflow-wrap:anywhere}
.lfq-list{display:grid;gap:4px;max-height:190px;overflow:auto}
.lfq-cards{grid-template-columns:repeat(auto-fit,minmax(min(145px,100%),1fr))}
.lfq-form{display:grid;gap:6px}
.lfq-brief{margin:0;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto}
.lfq-inline{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.lfq-status{color:var(--lf-muted);font-size:11px;margin:0}
.lfq-notice{font-size:12px;margin:0;line-height:1.4}
`;

// A stable session owns its demo data; style and name changes do not reset the workflow.
export function mountLivePreview(root){
  const doc=root.ownerDocument;
  const el=(tag,value,cls)=>{const n=doc.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n};
  if(!doc.getElementById('lfq-style')){const style=el('style',css);style.id='lfq-style';doc.head.append(style)}
  const app=el('div',undefined,'lfq-app'),brief=el('pre',undefined,'lfq-brief'),notice=el('p',undefined,'lfq-notice');
  const heading=el('div',undefined,'lfq-top'),brand=el('strong'),hint=el('span','Simulation · Beispieldaten','lfq-muted');heading.append(brand,hint);
  const nav=el('nav',undefined,'lfq-nav');nav.setAttribute('aria-label','Vorschau-Bereiche');
  const main=el('div',undefined,'lfq-main');app.append(heading,nav,main);
  const briefBox=el('details'),briefTitle=el('summary','Lokaler Entwurfsauftrag · live');briefBox.open=true;briefBox.append(briefTitle,brief);
  root.append(notice,app,briefBox);
  let model=null,rows=[],active='',signature='',contentKey='',counter=0,query='',selected=null,showForm=false,pairs=[],dark=false;
  const btn=(label,fn,primary=false)=>{const b=el('button',label,primary?'lfq-primary':undefined);b.type='button';b.onclick=fn;return b};
  const get=(id)=>rows.find(r=>r.id===id);
  function reset(m){rows=m.rows.map(r=>({...r}));active=m.primary;query='';selected=null;showForm=false;pairs=[];counter=0}
  function syncNav(){
    const key=JSON.stringify([active,model.views]);
    if(nav.dataset.key===key)return;
    nav.dataset.key=key;nav.replaceChildren();
    for(const v of model.views){const b=btn(v.title,()=>{active=v.id;selected=null;showForm=false;draw(true)});b.setAttribute('aria-pressed',String(v.id===active));b.title=v.source;nav.append(b)}
  }
  function addForm(parent){
    const form=el('form',undefined,'lfq-form'),name=el('input'),detail=el('input');
    name.type='text';name.required=true;name.maxLength=100;name.placeholder=model.singular+' – Bezeichnung';name.setAttribute('aria-label',name.placeholder);
    detail.type='text';detail.maxLength=100;detail.placeholder=model.field;detail.setAttribute('aria-label',model.field);
    const save=el('button','Lokal hinzufügen','lfq-primary');save.type='submit';
    form.append(name,detail,save);
    form.onsubmit=e=>{e.preventDefault();if(!name.value.trim())return;rows.push({id:'local-'+(++counter),label:name.value.trim(),detail:detail.value.trim(),done:false});showForm=false;query='';draw(true)};
    parent.append(form);
  }
  function draw(force=false){
    if(!model||!model.idea)return;
    app.dataset.tone=String(model.tone);
    app.dataset.theme=(model.theme==='DARK'||(model.theme==='BOTH'&&dark))?'dark':'light';
    app.dataset.phone=String(model.phone);
    brand.textContent=(model.logo?'◈  ':'')+model.title;
    syncNav();
    const themeKey=model.theme;
    if(heading.dataset.theme!==themeKey){heading.dataset.theme=themeKey;heading.querySelector('button')?.remove();if(themeKey==='BOTH')heading.append(btn('Hell / Dunkel',()=>{dark=!dark;draw()}))}
    // Re-render the active area only if its semantic content changed, not for tone,
    // theme, name, unrelated parameters, or the arrival of another SVG stream.
    const key=JSON.stringify([model.domain,active,model.entity,model.field,model.level>=4,model.views.find(v=>v.id===active)?.title]);
    if(!force&&key===contentKey)return;
    contentKey=key;main.replaceChildren();
    const v=model.views.find(x=>x.id===active);main.append(el('h3',v?.title||model.entity),el('p',v?.source||'vorläufig', 'lfq-status'));
    if(active==='analytics'){
      const done=rows.filter(r=>r.done).length;
      const stats=el('div',undefined,'lfq-row');
      stats.append(el('span','Einträge: '+rows.length),el('strong','Erledigt: '+done),el('span','Offen: '+(rows.length-done)));main.append(stats);
      const progress=el('progress');progress.max=Math.max(1,rows.length);progress.value=done;progress.setAttribute('aria-label','Erledigte Beispieldatensätze');main.append(progress);return;
    }
    if(active==='pairs'){
      main.append(el('p',rows.length+' Personen · Beispiel-Auslosung','lfq-status'));
      main.append(btn('Neu auslosen',()=>{const remaining=rows.slice();for(let i=remaining.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]]}pairs=[];for(let i=0;i<remaining.length;i+=2)pairs.push(remaining.slice(i,i+2).map(r=>r.label).join(' + '));draw(true)},true));
      for(const pair of pairs)main.append(el('div',pair,'lfq-row'));
      if(!rows.length||showForm)addForm(main);
      else main.append(btn('Person hinzufügen',()=>{showForm=true;draw(true)}));return;
    }
    if(active==='form'){addForm(main);main.append(el('p',rows.length+' lokale Einträge','lfq-status'));return}
    const tools=el('div',undefined,'lfq-inline');main.append(tools);
    if(model.level>=4||rows.length>3){
      const search=el('input');search.type='search';search.placeholder='Suchen';search.setAttribute('aria-label','Beispieldaten durchsuchen');search.value=query;
      search.oninput=()=>{query=search.value;renderRows()};tools.append(search);
    }else query='';
    tools.append(btn('+ '+model.singular,()=>{showForm=!showForm;draw(true)},true));
    if(showForm)addForm(main);
    const list=el('div',undefined,'lfq-list'+(active==='cards'?' lfq-cards':''));main.append(list);
    function renderRows(){
      list.replaceChildren();
      const visible=rows.filter(r=>(r.label+' '+r.detail).toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
      if(!visible.length)list.append(el('p','Keine Einträge. Füge einen lokalen Beispieldatensatz hinzu.','lfq-status'));
      for(const r of visible){
        const tile=el('div',undefined,'lfq-row'),label=el('span'),detail=el('span',r.detail,'lfq-muted');label.append(el('strong',r.label),doc.createElement('br'),detail);
        const open=btn(selected===r.id?'Schließen':'Details',()=>{selected=selected===r.id?null:r.id;renderRows()});
        open.setAttribute('aria-expanded',String(selected===r.id));
        const toggle=btn(r.done?'Erledigt':'Offen',()=>{const row=get(r.id);if(row){row.done=!row.done;renderRows()}});
        toggle.setAttribute('aria-pressed',String(r.done));tile.append(label,open,toggle);
        if(selected===r.id)tile.append(el('span',model.field+': '+(r.detail||'—')+' · '+(r.done?'Erledigt':'Offen'),'lfq-muted'));
        list.append(tile);
      }
    }
    renderRows();
  }
  return {update(next,context={}){
    const m=buildLiveConcept(next,context);
    const sig=JSON.stringify(m);if(signature===sig)return m;
    signature=sig;
    // Clearing the idea or changing the detected domain drops sandbox-only state.
    if(!model||model.domain!==m.domain||!m.idea||!model.idea)reset(m);
    model=m;const panel=root.closest('.lfq');if(panel)panel.hidden=!m.idea;else root.hidden=!m.idea;if(!m.idea){contentKey='';main.replaceChildren();brief.textContent='';return m}
    if(!m.views.some(v=>v.id===active)){active=m.primary;selected=null;showForm=false;query=''}
    notice.textContent=m.title+' · '+m.views.length+' '+(m.views.length===1?'Bereich':'Bereiche')+' · '+(m.scopeConflict?'Zielumfang prüfen · ':'')+(m.autonomy===0?'Alle nicht bestätigten Festlegungen bleiben offen. ':'')+'Vorläufiger Entwurf – keine echte Datenhaltung.';
    brief.textContent=m.descriptions.map(([k,v])=>k+': '+v).join('\n');
    draw();return m;
  }};
}
