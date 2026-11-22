// Test-only shim, loaded with `node --import` in a child process. Never used in production.
const chapters=['Ziel und Nicht-Ziele','Nutzer und Rollen','Kernabläufe und Randfälle',
 'Funktionale Anforderungen','Projektspezifische nichtfunktionale Anforderungen',
 'UX und Gestaltung','Daten und Schnittstellen','Projektspezifische Risiken'];
const content=title=>title==='Funktionale Anforderungen'
 ?'**FR-001 Notizen erstellen** – Muss. Abnahme: Wenn die Eingabe gültig ist, wird eine Notiz gespeichert.'
 :'Anforderungsgemäße Beschreibung.';
const full=chapters.map(title=>'## '+title+'\n\n'+content(title)).join('\n\n');
const json=JSON.stringify({
 goals:['Notizen speichern'],nonGoals:['Keine Cloud'],
 roles:[{name:'Nutzer',rights:['Notizen lesen']}],
 flows:[{name:'Speichern',steps:['Notiz eingeben','Speichern'],errors:['Leere Eingabe wird abgelehnt']}],
 requirements:[{feature:'Notizen',title:'Speichern',priority:'Muss',origin:'bestätigt',detail:'Notiz wird gespeichert',acceptance:['Wenn die Eingabe gültig ist, wird eine Notiz gespeichert.']}],
 nfr:[],ux:['Mit Tastatur nutzbar'],data:[{entity:'Notiz',fields:['Titel','Text']}],
 interfaces:[],risks:['Datenverlust']
});
const target=(prompt)=>{
 if(prompt.includes('KOMPAKTES JSON'))return json;
 if(prompt.includes('Schreibe NUR die folgenden projektspezifischen Kapitel')){
  if(prompt.includes('Funktionale Anforderungen; Projektspezifische nichtfunktionale'))return chapters.slice(3,5).map(t=>'## '+t+'\n\n'+content(t)).join('\n\n');
  if(prompt.includes('UX und Gestaltung; Daten und Schnittstellen'))return chapters.slice(5).map(t=>'## '+t+'\n\n'+content(t)).join('\n\n');
  return chapters.slice(0,3).map(t=>'## '+t+'\n\n'+content(t)).join('\n\n');
 }
 return full;
};
const original=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 const address=String(url);
 if(!address.includes('api.anthropic.com/v1/messages')&&!address.includes('/v1/chat/completions'))
   return original(url,init);
 const body=JSON.parse(init.body);
 const prompt=JSON.stringify(body.messages||[]);
 const output=target(prompt);
 const sseText=address.includes('api.anthropic.com')?
   'data: '+JSON.stringify({type:'message_start',message:{usage:{input_tokens:22}}})+'\n\n'
   +'data: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text:output}})+'\n\n'
   +'data: '+JSON.stringify({type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:77}})+'\n\n'
   +'data: [DONE]\n\n':
   'data: '+JSON.stringify({choices:[{delta:{content:output},finish_reason:'stop'}]})+'\n\n'
   +'data: [DONE]\n\n';
 if(!body.stream)
   return new Response(JSON.stringify({content:[{type:'text',text:output}],usage:{input_tokens:20,output_tokens:55}}),{status:200,headers:{'content-type':'application/json'}});
 return new Response(sseText,{status:200,headers:{'content-type':'text/event-stream'}});
};
