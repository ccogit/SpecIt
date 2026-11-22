/** Compact AI contract and deterministic Markdown renderer for one-file SPEC.md. */
const chapters=['Ziel und Nicht-Ziele','Nutzer und Rollen','Kernabläufe und Randfälle','Funktionale Anforderungen',
 'Projektspezifische nichtfunktionale Anforderungen','UX und Gestaltung','Daten und Schnittstellen','Projektspezifische Risiken'];
const txt=(v,max=600)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const strings=(v,max=30)=>Array.isArray(v)?v.slice(0,max).map(x=>txt(x)).filter(Boolean):[];
const asArray=(v,max)=>Array.isArray(v)?v.slice(0,max):[];
const bullet=lines=>lines.length?lines.map(x=>'- '+x).join('\n'):'- Keine.';
const nonempty=(v,label)=>{const value=txt(v);if(!value)throw Error('Strukturierte Spezifikation: '+label+' fehlt.');return value};
const heading=(title,content)=>'## '+title+'\n\n'+content;

export const structuredPrompt = `Schreibe eine vollständige, fachlich konsistente und präzise Projektspezifikation als KOMPAKTES JSON.
Die JSON-Daten werden lokal zu Markdown gerendert. Gib keine Markdown-Kapitel, Codeblöcke oder erläuternden Texte aus.
Verwende exakt das JSON-Schema mit kurzen Feldern:
{"goals":["Ziel"],"nonGoals":["Nicht-Ziel"],"roles":[{"name":"Rolle","rights":["Berechtigung"]}],
"flows":[{"name":"Ablauf","steps":["Schritt"],"errors":["Fehler-/Randfall"]}],
"requirements":[{"feature":"exakter Feature-Name","title":"Anforderung","priority":"Muss","origin":"bestätigt oder Annahme","detail":"Prüfbares Verhalten","acceptance":["Wenn ... dann ..."]}],
"nfr":[{"name":"Qualität","detail":"Messbares Verhalten","acceptance":"Prüfung"}],
"ux":["UX-Regel"],"data":[{"entity":"Entität","fields":["Feld"]}],
"interfaces":["Schnittstelle"],"risks":["Projektspezifisches Risiko"]}.
Mindestens ein Requirement für JEDES Feature aus features; feature muss den Namen aus features Zeichen für Zeichen übernehmen.
Keine anderen Features hinzufügen. Jede Anforderung hat einen kurzen Titel, Priorität, Herkunft und mindestens ein objektiv testbares Akzeptanzkriterium.
IDs vergibt SpecIt lokal (FR-001 ff. und NFR-001 ff.); erzeuge keine IDs.
Rollen und Berechtigungen müssen zu den Abläufen, Daten und Anforderungen passen.
Beschreibe Fehlerfälle, leere Zustände, Berechtigungen und Datenverhalten.
Die Standardanforderungen und feststehenden Abschnitte in fixedSections sind schon vorhanden und werden NICHT dupliziert.
Nicht spezifizierte Entscheidungen nur gemäß Entscheidungsmodus als Annahmen kennzeichnen. Keine zusätzlichen Funktionen erfinden.
Antworte sofort mit "{" und liefere ausschließlich gültiges JSON.`;

export function renderStructuredCore(value, features = []) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Strukturierte Spezifikation: kein JSON-Objekt.');
 const goals=strings(value.goals),nonGoals=strings(value.nonGoals),roles=asArray(value.roles,20);
 const flows=asArray(value.flows,30),req=asArray(value.requirements,120);
 const nfr=asArray(value.nfr,40),ux=strings(value.ux),data=asArray(value.data,30);
 const apis=strings(value.interfaces),risks=strings(value.risks,3);
 if(!goals.length||!roles.length||!flows.length||!req.length||!ux.length)
  throw Error('Strukturierte Spezifikation: wesentliche Abschnitte fehlen.');
 const featuresByName=new Map(features.map(f=>[txt(typeof f==='string'?f:f?.name).toLowerCase(),txt(typeof f==='string'?f:f?.name)]).filter(x=>x[0]));
 const covered=new Set();
 const requirements=req.map((r,i)=>{
  const feature=nonempty(r?.feature,'Feature-Name');
  const canonical=featuresByName.get(feature.toLowerCase());
  if(!canonical)throw Error('Strukturierte Spezifikation: unbekanntes Feature '+feature);
  covered.add(canonical.toLowerCase());
  const title=nonempty(r.title,'Anforderungstitel'),detail=nonempty(r.detail,'Verhalten');
  const acceptance=strings(r.acceptance,10);
  if(!acceptance.length)throw Error('Strukturierte Spezifikation: Akzeptanzkriterium fehlt für '+canonical);
  const priority=['Muss','Soll','Kann'].includes(r.priority)?r.priority:'Muss';
  const origin=r.origin==='bestätigt'?'bestätigt':'Annahme';
  const id='FR-'+String(i+1).padStart(3,'0');
  return '- **'+id+' '+title+'** – Feature: '+canonical+'; Priorität: '+priority+'; Herkunft: '+origin+'. '+detail
    +' **Abnahme:** '+acceptance.map((a,j)=>'('+String(j+1)+') '+a).join(' ');
 });
 const missing=[...featuresByName].filter(([key])=>!covered.has(key)).map(([,label])=>label);
 if(missing.length)throw Error('Strukturierte Spezifikation: Features ohne Anforderung: '+missing.join(', '));
 const nfrLines=nfr.map((x,i)=>'- **NFR-'+String(i+1).padStart(3,'0')+' '+nonempty(x.name,'NFR-Titel')+'** – '
  +nonempty(x.detail,'NFR-Beschreibung')+' **Abnahme:** '+nonempty(x.acceptance,'NFR-Akzeptanz'));
 const roleLines=roles.map(r=>'- **'+nonempty(r?.name,'Rolle')+'** – '+strings(r.rights,20).join('; '));
 const flowLines=flows.map(f=>'- **'+nonempty(f?.name,'Ablauf')+'** – '+strings(f.steps,30).join(' → ')
   +(strings(f.errors,20).length?' **Rand- und Fehlerfälle:** '+strings(f.errors,20).join('; '):''));
 const dataLines=data.map(d=>'- **'+nonempty(d?.entity,'Datenentität')+'** – '+strings(d.fields,30).join(', '));
 const parts=[
  heading(chapters[0],'**Ziele**\n\n'+bullet(goals)+'\n\n**Nicht-Ziele**\n\n'+bullet(nonGoals)),
  heading(chapters[1],bullet(roleLines)),
  heading(chapters[2],bullet(flowLines)),
  heading(chapters[3],bullet(requirements)),
  heading(chapters[4],bullet(nfrLines.length?nfrLines:['Keine über die Standards hinaus.'])),
  heading(chapters[5],bullet(ux)),
  heading(chapters[6],'**Daten**\n\n'+bullet(dataLines)+'\n\n**Schnittstellen**\n\n'+bullet(apis)),
  heading(chapters[7],bullet(risks))
 ];
 return parts.join('\n\n')+'\n';
}
