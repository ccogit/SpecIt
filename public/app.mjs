// Thema früh setzen: gespeicherte Wahl, sonst Systemeinstellung
let theme=null;try{theme=localStorage.getItem('specit-theme')}catch{}
if(theme!=='dark'&&theme!=='light')theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
function applyTheme(){document.documentElement.dataset.theme=theme;const b=document.getElementById('theme');b.textContent=theme==='dark'?'☼':'☾';b.title=theme==='dark'?'Helles Thema':'Dunkles Thema';b.setAttribute('aria-pressed',String(theme==='dark'));b.setAttribute('aria-label','Zum '+(theme==='dark'?'hellen':'dunklen')+' Thema wechseln')}
{let on=false;try{on=localStorage.getItem('specit-settings')==='1'}catch{}const b=document.getElementById('setToggle'),put=()=>{document.body.classList.toggle('showset',on);b.setAttribute('aria-pressed',String(on))};put();b.onclick=()=>{on=!on;try{localStorage.setItem('specit-settings',on?'1':'0')}catch{}put();window.dispatchEvent(new Event('resize'))}}
applyTheme();document.getElementById('theme').onclick=()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('specit-theme',theme)}catch{}applyTheme()};

import {validatePlan,renderTask,renderBacklog,renderSingle,recommendAgents,estimate,setAgentSkill} from '/planner.mjs';
import { modulators, cleanSvg, cleanLogos,conceptSections,conceptTopic,topics,cleanQuestions,cleanExtras,answerOf,acceptDefault,applyAutonomy,summary,coverage,cleanFeatures,featureMinutes,workPackages,featureDuration,suggestExtensions,cleanNames} from '/interview.mjs';
import {renderMarkdown} from '/markdown.mjs';
import {balance} from '/balance.mjs';
import {readNdjson} from '/ndjson.mjs';
import {createWorkSession,abortableDelay} from '/work-session.mjs';
import {cleanProto,protoDocument} from '/prototype.mjs';
import {cleanFlow,flowMermaid,layoutFlow,cleanArch,layoutStructure,structureMermaid,layoutData,dataMermaid} from '/diagrams.mjs';

const $=id=>document.getElementById(id),pageTitle=document.title;
const workSession=createWorkSession();
// Höhe der Kopfzeile (bricht bei schmalem Fenster um) für alles, was darunter haften bleibt
new ResizeObserver(([e])=>document.documentElement.style.setProperty('--top-h',Math.round(e.target.offsetHeight)+'px')).observe(document.querySelector('.top'));
// Es gibt nur noch eine Ansicht. Was darin zu sehen ist, folgt aus dem Stand der Arbeit – nicht aus einem gewählten Schritt.
const inQuestions=()=>!s.spec.trim()&&s.questions.length>0&&typeof streamText!=='string';
// Arbeitsfläche offen: Es gibt Fragen, Features oder ein Dokument (oder es entsteht gerade)
const wsOpen=()=>s.questions.length>0||s.features.length>0||!!s.spec.trim()||typeof streamText==='string'||specMode==='edit';
// An der Idee wird gefeilt, solange kein Dokument steht: Nur dann entsteht das Live-Konzept
const atIdea=()=>!s.spec.trim()&&typeof streamText!=='string';
// Modus in sechs Stufen (autonomy = Stufe × 20): von „fragt bei allem nach“ bis „entscheidet alles selbst“
const levels=[
  ['fragt bei allem nach','Keine Annahmen, keine Standards: Jede Frage beantwortest du selbst, nichts ist vorausgewählt.'],
  ['fragt bei fast allem nach','Nur Nebensächliches wird selbst entschieden und als Annahme gekennzeichnet.'],
  ['fragt bei allen wichtigen Entscheidungen nach','Detailfragen werden selbst entschieden und als Annahme gekennzeichnet.'],
  ['fragt nur bei richtungsweisenden Entscheidungen nach','Alles Übrige wird selbst entschieden und als Annahme gekennzeichnet.'],
  ['fragt nur bei den wenigen grundlegenden Entscheidungen nach','Fast alles wird selbst entschieden und als Annahme gekennzeichnet.'],
  ['entscheidet alles selbst','Auto-Modus ohne Rückfragen: Alles wird als Annahme gekennzeichnet und die Spezifikation direkt erstellt.']
];
// Ziel-Entwicklungsdauer in neun Stufen: Bezeichnung, Minuten reiner Laufzeit der Agenten (1 Tag = 8 h, 1 Woche = 5 Tage)
// und ein Richtwert, was in dieser Zeit ungefähr entsteht. Agenten arbeiten in Minuten, daher beginnt die Skala bei 15 Minuten.
const durations=[
  ['Keine Vorgabe',0,'Der Umfang richtet sich allein nach Idee und Antworten.'],
  ['15 Minuten',15,'Richtwert: ein einziger Kernablauf, benutzbar, ohne Extras.'],
  ['30 Minuten',30,'Richtwert: Kernablauf mit den nötigsten Eingaben und Prüfungen.'],
  ['1 Stunde',60,'Richtwert: kleines MVP – Kernablauf plus einige Zusatzfunktionen.'],
  ['2 Stunden',120,'Richtwert: solides MVP mit Tests und durchgestalteter Oberfläche.'],
  ['4 Stunden',240,'Richtwert: MVP mit mehreren Funktionsbereichen.'],
  ['1 Tag',480,'Richtwert: vollständige erste Version mit Rollen, Randfällen und Qualitätssicherung.'],
  ['2 Tage',960,'Richtwert: umfangreiche Anwendung mit Integrationen.'],
  ['1 Woche',2400,'Richtwert: großes Vorhaben, Umsetzung in Etappen.']
];
// Eigene Ideen der KI und Einsatzbereich: je fünf Stufen (0–4)
// Kurzfassungen für die Zeile rechts neben dem Regler (einzeilig); die lange Fassung bleibt im Tooltip und in der Übersicht
const shortAutonomy=['Fragt alles','Fragt fast alles','Fragt Wichtiges','Fragt Richtungsweisendes','Fragt nur Grundlegendes','Entscheidet alles selbst'];
const shortCreativity=['Nur Vorgegebenes','Nur das Nötigste','Naheliegende Ergänzungen','Eigene Ideen','Kreativ weitergedacht'];
const shortTone=['Privat und locker','Eher informell','Neutral','Eher formell','Formell'];
const creativityLevels=[
  ['setzt nur um, was du vorgibst','Keine eigenen Funktionen, Ideen oder Erweiterungen.'],
  ['ergänzt nur das Nötigste','Nur was zwingend nötig ist, damit das Vorgegebene funktioniert.'],
  ['bringt naheliegende Ergänzungen ein','Was Nutzer solcher Anwendungen üblicherweise erwarten – jeweils als „Vorschlag der KI“ gekennzeichnet.'],
  ['bringt eigene Ideen ein','Zusätzliche Funktionen und bessere Abläufe – jeweils als „Vorschlag der KI“ gekennzeichnet.'],
  ['denkt das Konzept kreativ weiter','Auch ungewöhnliche eigene Ideen sind erwünscht – jeweils als „Vorschlag der KI“ gekennzeichnet.']
];
const toneNames=[
  ['Privat und locker','Persönliche Ansprache (Du), lockere Formulierungen, verspielte, farbige Gestaltung. Dazu ein durchgängiges Branding mit Witz: Name mit Wortspiel, Claim und augenzwinkernde Bezeichnungen für alle Funktionen (die sachliche Funktion bleibt als Unterzeile erkennbar).'],
  ['Eher informell','Freundliche Ansprache (Du), helle, einladende Gestaltung. Dosiertes Augenzwinkern: Name und Claim dürfen spielen, witzige Bezeichnungen nur für die wichtigsten Funktionen.'],
  ['Neutral','Sachlich-freundliche Formulierungen, zurückhaltende Gestaltung. Eingängiger Name, Funktionen heißen sachlich.'],
  ['Eher formell, berufliches Umfeld','Sachliche Formulierungen, klare, ruhige Gestaltung. Beschreibender Name, kein Humor.'],
  ['Formell und arbeitsbezogen','Förmliche Ansprache (Sie), nüchterne, seriöse Gestaltung mit hoher Informationsdichte.']
];
const blank=()=>({ideaTidy:null,time:{req:0,spec:0,impl:0},aiLedger:{spec:{w:0,ms:0},impl:{w:0,ms:0}},concept:null,conceptAnswers:{},conceptWishes:[],usage:{context:0,ai:0,calls:0},flow:null,arch:null,proto:null,featPool:[],runOutput:null,own:{},sketch:null,logoCount:1,logos:[],logoChosen:-1,runModel:'',reviewBy:'',reviewModel:'',review:null,nameCount:1,names:[],nameAuto:'',featAgents:1,specStrategy:'incremental',strategyTimes:{},reuse:null,reuseSpec:'',planTrace:null,creativity:2,tone:2,features:[],featSource:'',layoutWish:'',layoutTheme:'LIGHT',runDir:'',runShell:false,nextStep:'download',finished:'',autonomy:40,durLevel:0,durScale:2,project:'',phase:0,idea:'',askedIdea:'',questions:[],qSource:'',extras:[],active:-1,last:-1,clicks:0,spec:'',specSource:'',dirty:false,repo:'',agent:'Agent-neutral',plan:null,planSource:'',planSpec:'',planContext:null,layoutOn:false,layoutCount:3,layoutDevice:'DESKTOP',layout:null});

let s=blank();
try{
  const saved=JSON.parse(localStorage.getItem('specit-v3'));
  if(saved&&typeof saved.idea==='string'&&typeof saved.spec==='string'){
    s={...s,...saved,questions:cleanQuestions(saved.questions||[]),extras:cleanExtras(saved.extras)};
    if(s.plan)s.plan=validatePlan(s.plan);
    if(![0,2,3].includes(s.phase))s.phase=s.phase===1?2:0;
    if(!Number.isInteger(s.active)||s.active>=s.questions.length)s.active=-1;
    if(!Number.isInteger(s.clicks)||s.clicks<0)s.clicks=0;
    if(!s.concept||typeof s.concept.text!=='string'||typeof s.concept.key!=='string')s.concept=null;
    if(!s.conceptAnswers||typeof s.conceptAnswers!=='object'||Array.isArray(s.conceptAnswers))s.conceptAnswers={};
    s.conceptWishes=(Array.isArray(s.conceptWishes)?s.conceptWishes:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,12);
    {const n=v=>Number.isFinite(v)&&v>0?v:0,tm=s.time&&typeof s.time==='object'?s.time:{},al=s.aiLedger&&typeof s.aiLedger==='object'?s.aiLedger:{},cell=c=>({w:n(c&&c.w),ms:n(c&&c.ms)});s.time={req:n(tm.req),spec:n(tm.spec),impl:n(tm.impl)};s.aiLedger={spec:cell(al.spec),impl:cell(al.impl)}}
    {const u=s.usage&&typeof s.usage==='object'?s.usage:{},n=v=>Number.isFinite(v)&&v>0?Math.round(v):0;s.usage={context:n(u.context),ai:n(u.ai),calls:n(u.calls)};if(!s.runOutput||typeof s.runOutput!=='object'||!Array.isArray(s.runOutput.groups))s.runOutput=null}
    s.last=-1;
    if(!Number.isInteger(s.layoutCount)||s.layoutCount<1||s.layoutCount>5)s.layoutCount=3;
    if(!['DESKTOP','MOBILE','BOTH'].includes(s.layoutDevice))s.layoutDevice='DESKTOP';
     if(!['classic','incremental','preload','structured','parallel','turbo','gpu'].includes(s.specStrategy))s.specStrategy='incremental';
     if(!s.strategyTimes||typeof s.strategyTimes!=='object'||Array.isArray(s.strategyTimes))s.strategyTimes={};
    if(!['LIGHT','DARK','BOTH'].includes(s.layoutTheme))s.layoutTheme='LIGHT';
    if(s.layout&&!Array.isArray(s.layout.chosen))s.layout.chosen=typeof s.layout.chosen==='string'&&s.layout.chosen?[s.layout.chosen]:[];
    s.autonomy=Number.isFinite(s.autonomy)&&s.autonomy>=0&&s.autonomy<=100?Math.round(s.autonomy/20)*20:40;
    if(!Number.isInteger(s.durLevel)||s.durLevel<0||s.durLevel>=durations.length){
      // Frühere Entwürfe hatten Zahl und Einheit: auf die nächstliegende Stufe abbilden
      const min=Number.isInteger(saved.durValue)&&saved.durValue>0?saved.durValue*({Stunden:60,Tage:480,Wochen:2400}[saved.durUnit]||480):0;
      s.durLevel=min?durations.reduce((best,d,i)=>i&&Math.abs(Math.log(d[1]/min))<Math.abs(Math.log(durations[best][1]/min))?i:best,1):0;
    }
    delete s.durValue;delete s.durUnit;
    // Die Skala begann früher bei 1 Stunde: gespeicherte Stufe auf die gleiche Dauer der neuen Skala abbilden
    if(saved.durScale!==2){const old=[0,60,120,240,480,960,2400,4800,9600][s.durLevel]||0;s.durLevel=old?durations.reduce((best,d,i)=>i&&Math.abs(Math.log(d[1]/old))<Math.abs(Math.log(durations[best][1]/old))?i:best,1):0;s.durScale=2}
    for(const k of ['creativity','tone'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>4)s[k]=2;
    s.features=cleanFeatures(saved.features);s.featPool=Array.isArray(saved.featPool)?saved.featPool.filter(f=>f&&typeof f.name==='string'&&Number.isFinite(f.minutes)).slice(0,24):[];
    if(!Number.isInteger(s.nameCount)||s.nameCount<0||s.nameCount>5)s.nameCount=3;
    s.names=cleanNames(saved.names);
    {const f=s.flow&&typeof s.flow.key==='string'?cleanFlow(s.flow):null;s.flow=f?{key:s.flow.key,...f}:null}
    {const a=s.arch&&typeof s.arch.key==='string'?cleanArch(s.arch):null;s.arch=a?{key:s.arch.key,...a}:null}
    {const p=s.proto&&typeof s.proto.key==='string'?cleanProto(s.proto):null;s.proto=p?{key:s.proto.key,...p}:null}
    s.logoCount=Number.isInteger(s.logoCount)?Math.min(5,Math.max(0,s.logoCount)):0;s.logos=cleanLogos(s.logos);s.logoChosen=Number.isInteger(s.logoChosen)&&s.logos[s.logoChosen]?s.logoChosen:-1;
    if(!s.own||typeof s.own!=='object'||Array.isArray(s.own))s.own={};
    if(!s.sketch||typeof s.sketch.svg!=='string'||!cleanSvg(s.sketch.svg))s.sketch=null;else s.sketch.pass=Number.isInteger(s.sketch.pass)?Math.min(2,Math.max(1,s.sketch.pass)):2;
    if(typeof s.runModel!=='string')s.runModel='';if(typeof s.reviewBy!=='string')s.reviewBy='';if(typeof s.reviewModel!=='string')s.reviewModel='';
    if(!s.review||!Array.isArray(s.review.findings))s.review=null;
    if(!Number.isInteger(s.featAgents)||s.featAgents<1)s.featAgents=1;
    if(!s.reuse||!Array.isArray(s.reuse.projects)||typeof s.reuseSpec!=='string'){s.reuse=null;s.reuseSpec=''}
    if(!s.planTrace||!Array.isArray(s.planTrace.missing)||!Array.isArray(s.planTrace.unknown)||!Array.isArray(s.planTrace.untraced))s.planTrace=null;
    if(!['download','run'].includes(s.nextStep))s.nextStep=saved.planForm==='run'?'run':'download';
    if(typeof s.finished!=='string')s.finished='';delete s.planForm;delete s.runAgents;
    if(typeof s.runDir!=='string')s.runDir='';
    if(typeof s.layoutWish!=='string')s.layoutWish='';
    s.runShell=s.runShell===true;
    if(!s.layout||typeof s.layout.url!=='string'||!s.layout.url.startsWith('https://stitch.withgoogle.com/projects/')||!Array.isArray(s.layout.screens))s.layout=null;
  }
}catch{s=blank()}

let available=false,provider=null,statusLoaded=false,gpuAvailable=false,specModels={},stitch=false,active=false,layoutBusy=false,runBusy=false,revision=0;
// Auswahl der gerade aktiven Frage, bis sie bestätigt wird
let pick=[],custom='',customOpen=false;
// Darstellung der Spezifikation: gerenderte Ansicht oder Markdown-Editor
let specMode='view';
// Entstehende Spezifikation, solange Claude schreibt (null = es wird gerade nichts gestreamt)
let streamText=null,paintAt=0;
// Fragen-Katalog in aufgeklappte Frage samt Auswahl; zuletzt geänderte Antwort mit dem Stand davor
let catOpen=-1,catPick=[],catCustom='',change=null;
// Aufgeklappte Unterrubriken der beiden Felder: 'a'+Thema (beantwortet) bzw. 'o'+Thema (offen)
const catGroups=new Set();

const strategyDescription={
 classic:'Erstellt die komplette Spezifikation jedes Mal neu, sequenziell mit dem konfigurierten Standardmodell.',
 incremental:'Bestehender Weg: Bei Änderungen nur betroffene Kapitel neu schreiben, sonst vollständig sequenziell.',
 preload:'Experimentell: Spezifikation wird nach stabilen Entscheidungen vorbereitet und beim Erstellen sofort übernommen.',
 structured:'Experimentell: Kompakte Fachinformationen als JSON, alle acht Markdown-Kapitel werden lokal aufgebaut.',
 parallel:'Experimentell: Erstellt die komplette Spezifikation mit drei parallelen Aufrufen. Qualität gesondert prüfen.',
 turbo:'Experimentell: Parallele Neuerstellung mit Haiku und niedrigem Denkaufwand. Qualität gesondert prüfen.',
 gpu:'Experimentell: Vollständige Erstellung über einen lokalen OpenAI-kompatiblen GPU-Inferenzserver.'
};
// Das Modell, das die gewählte Strategie tatsächlich benutzt – mit allem, was der Server darüber weiß
function modelUI(){
  const chip=$('specModel');let m=specModels[s.specStrategy];
  // Ohne Claude schreibt kein Modell: Dann setzt SpecIt das Dokument selbst aus den Antworten zusammen (das lokale Modell braucht Claude nicht)
  if(statusLoaded&&!$('ai').checked&&!(m&&m.local)){chip.classList.remove('hidden');chip.replaceChildren(node('span','Modell','soft'),node('b','keines'),node('span','· Demo'));chip.title='Der Schalter „Claude“ oben rechts ist aus: Es wird kein Sprachmodell aufgerufen; SpecIt setzt das Dokument selbst aus den Antworten zusammen.';return}
  chip.classList.toggle('hidden',!m);if(!m)return;
  const parts=m.local?[m.base,m.quant]:[m.id&&m.id!==m.name?m.id:''];
  chip.replaceChildren(node('span','Modell','soft'),node('b',m.name),...parts.filter(Boolean).map(p=>node('span','· '+p)));
  chip.title=m.local?'Lokales Modell „'+m.name+'“'+(m.base?', Basis '+m.base:'')+(m.size?', '+m.size+' Parameter':'')+(m.quant?', Quantisierung '+m.quant:'')+(m.modified?', eingerichtet am '+m.modified:'')+(m.server?', ausgeführt von '+m.server:'')+'. Die Daten bleiben auf diesem Rechner.'
    :'Dieses Modell schreibt die Spezifikation mit der gewählten Strategie'+(m.id?' (Kennung '+m.id+')':' (Kurzname „'+m.asked+'“ – die genaue Version steht nach dem ersten Aufruf fest)')+(m.effort?', Denkaufwand '+m.effort:'')+', Zugang über '+m.via+'.';
}
let modelsAt=0;
function refreshModels(){const now=Date.now();if(now-modelsAt<1500)return;modelsAt=now;fetch('/api/models').then(r=>r.json()).then(r=>{if(r&&typeof r==='object'){specModels=r;modelUI()}},()=>{})}
function strategyUI(){
 const select=$('specStrategy'),hasApi=available;
 if(statusLoaded&&((!hasApi&&['preload','parallel','turbo'].includes(s.specStrategy))
   ||(!gpuAvailable&&s.specStrategy==='gpu')))s.specStrategy='incremental';
 for(const option of select.options){
  if(['preload','parallel','turbo'].includes(option.value))option.disabled=statusLoaded&&!hasApi;
  if(option.value==='gpu')option.disabled=statusLoaded&&!gpuAvailable;
 }
 select.value=s.specStrategy;
 select.disabled=active;
 const ms=s.strategyTimes?.[s.specStrategy],last=Number.isFinite(ms)&&ms>0?' Letzte gemessene Erstellung: '+(ms/1000).toFixed(1)+' s.':'';
 const prep=s.specStrategy==='preload'&&preloadStatus.state==='ready'?' Vorbereitet – der nächste Klick kann den Entwurf übernehmen.':s.specStrategy==='preload'&&preloadStatus.state==='loading'?' Entwurf wird im Hintergrund vorbereitet …':s.specStrategy==='preload'&&preloadStatus.state==='error'?' Vorbereitung nicht verfügbar; Klick erstellt wie gewohnt.':'';
 const hint=strategyDescription[s.specStrategy]+last+prep+(statusLoaded&&!hasApi?' Vorbereitet, Parallel und Turbo benötigen Claude (API-Schlüssel oder Claude Code).':'');
 $('specStrategyHint').textContent=hint;select.title=hint;select.closest('label').title=hint;
 // Erklärung je Eintrag als Tooltip; gesperrte Einträge sagen, was fehlt
 for(const option of select.options)option.title=strategyDescription[option.value]+(option.disabled?(option.value==='gpu'?' Nicht eingerichtet: SPECIT_GPU_MODEL in .env setzen (siehe README).':' Benötigt Claude.'):'');
 modelUI();
 {const chip=$('specStrategyTime'),on=Number.isFinite(ms)&&ms>0;chip.classList.toggle('hidden',!on);chip.textContent=on?Math.round(ms/1000)+' s':'';chip.title='Zuletzt gemessene Dauer einer Erstellung mit dieser Strategie';}
}
$('specStrategy').onchange=e=>{
 if(active)return;
 s.specStrategy=e.target.value;
 save();strategyUI();stageUI();scheduleSpecPreload();
};
function save(){try{localStorage.setItem('specit-v3',JSON.stringify(s))}catch{$('busy').textContent='Lokales Speichern nicht möglich.'}}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function button(text,cls,onclick){const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b}
const words=t=>(t.trim().match(/\S+/g)||[]).length;
const digest=t=>{let h=5381;for(let i=0;i<t.length;i++)h=(h*33^t.charCodeAt(i))>>>0;return t.length+':'+h};
const plural=(n,one,many)=>n+' '+(n===1?one:many);
// Open-Source-Kandidaten, die der Nutzer ausdrücklich angehakt hat (nur solange die Recherche zur Spezifikation passt)
function selectedReuse(){return s.reuse&&s.reuseSpec===digest(s.spec)?s.reuse.projects.filter(p=>p.included).map(p=>({url:p.url,name:p.name,license:p.license,functions:p.functions})):[]}
function ctx(){return {repo:s.repo,agent:s.agent,reuse:selectedReuse()}}
// Rahmen für jede Anfrage: Autonomiegrad und Ziel-Entwicklungsdauer als Text („3 Tage“)
const duration=()=>s.durLevel?durations[s.durLevel][0]:'';
// … dazu: eigene Ideen der KI, Einsatzbereich (je 0–4) und die abgewählten Features
const frame=()=>({autonomy:s.autonomy,duration:duration(),creativity:s.creativity,tone:s.tone,excluded:s.features.filter(f=>!f.on).map(f=>f.name)});
// Bei 0 gibt es keine Standards: nichts ist vorausgewählt oder als Vorschlag markiert
const suggest=()=>s.autonomy>0;
function stale(){return s.plan&&(s.spec!==s.planSpec||JSON.stringify(ctx())!==JSON.stringify(s.planContext)||s.dirty)}
function layoutActive(){return !!(s.layoutOn&&s.layout&&s.layout.screens.length)}
function exportCtx(){const c=chosenLayout();return {...(s.planContext||{}),...(layoutActive()?{layoutUrl:s.layout.url,...(c?{layoutChoice:c.label}:{})}:{})}}
function firstOpen(from=0){const n=s.questions.length;for(let k=0;k<n;k++){const i=(from+k)%n;if(s.questions[i].state==='open')return i}return -1}

/* Aufwand des Menschen gegenüber dem Ergebnis – nur gezählte Tatsachen */
// Jeder echte Klick auf ein Bedienelement und jede Tasteneingabe in ein Feld zählt und aktualisiert die Anzeige sofort
let effortSave=null;
// Wächst ein Zähler durch eine Aktion, blitzt er kurz rot auf – wie ein Kurs, der sich gerade bewegt hat
// (Die Leiste wird je Aktion mehrfach neu gezeichnet; deshalb merkt sich tickAt den Zeitpunkt des Zuwachses.)
let effortPrev=null,resetAt=0;const tickAt={};
// Der feste Kontext von SpecIt und die Antworten der KI werden je Anfrage vom Server gezählt (usage) und hier aufsummiert.
// Was zum Ergebnis selbst wird (Spezifikation, Plan, Logos), zählt nicht als Input der KI.
function addUsage(mode,u){
  const n=v=>Number.isFinite(v)&&v>0?Math.round(v):0;
  s.usage.context+=n(u.context);s.usage.calls+=n(u.calls);
  // Für die Übersicht „wer trägt in welcher Phase was bei“: alle erzeugten Wörter und die Rechenzeit, getrennt nach Phase
  {const cell=s.aiLedger[mode==='plan'?'impl':'spec'];cell.w+=n(u.out);cell.ms+=(Array.isArray(u.timings)?u.timings:[]).reduce((a,x)=>a+n(x&&x.totalMs),0)}
  if(!['final','revise','adjust','scope','plan','logos','sketch'].includes(mode))s.usage.ai+=n(u.out);
  save();effortBar();
}
// Wörter aller Aufträge des aktuellen Plans (teuer zu rechnen, deshalb je Plan und Auftragsform gemerkt)
let planWordsKey=null,planWordsN=0;
function planWords(p){
  if(!p)return 0;const key=agentsNow()===1?'1':'n';
  if(planWordsKey!==p||planWordsN.key!==key){planWordsKey=p;planWordsN={key,n:words((key==='1'?renderSingle:renderBacklog)(p,'',exportCtx()))}}
  return planWordsN.n;
}
function bal(){
  const p=s.plan&&!stale()?s.plan:null;
  return balance({idea:s.idea,questions:s.questions,extras:s.extras,features:s.features,clicks:s.clicks,usage:s.usage,spec:s.spec,name:s.project,logos:s.logos.length,layouts:s.layout?s.layout.screens.length:0,
    plan:p,planWords:planWords(p),nextStep:s.nextStep,finished:!!p&&s.finished===finishKey(),output:s.runOutput});
}
const compact=n=>n>=10000?(n/1000).toLocaleString('de-DE',{maximumFractionDigits:n>=100000?0:1})+'k':n.toLocaleString('de-DE');
// Drei Akteure (du, KI, SpecIt) arbeiten in drei Phasen (Anforderung, Spezifikation, Umsetzung).
// Gemessen wird überall gleich: in Wörtern (was beigetragen wurde) und in Zeit (was es gekostet hat).
const PHASES=[['spec','Spezifikation'],['impl','Umsetzung']],ACTORS=[['user','Du'],['ai','KI'],['tool','SpecIt']];
const curPhase=()=>!wsOpen()&&!s.concept&&!conceptJob?'req':(s.plan||(typeof run==='object'&&run&&run.items&&run.items.length)||($('implPanel').open&&s.spec.trim()))?'impl':'spec';
function ledger(){
  const sum=a=>a.reduce((n,x)=>n+words(x),0),o=s.runOutput||{},p=s.plan&&!stale()?s.plan:null;
  // SpecIt steuert ohne KI bei: die Übersetzung der Einstellungen in Vorgaben, die festen Kapitel des Dokuments, den Rahmen der Aufträge
  const mods=s.idea.trim()?sum(modulators({autonomy:s.autonomy,duration:duration(),minutes:targetMinutes(),creativity:s.creativity,tone:s.tone}).map(m=>m.label+' '+m.text)):0;
  let fixed=0;{let on=false;for(const line of s.spec.split('\n')){const m=/^## (.+)$/.exec(line);if(m)on=fixedChapters.has(m[1].trim());else if(on)fixed+=words(line)}}
  const demoSpec=s.spec.trim()&&s.specSource==='demo'?Math.max(0,words(s.spec)-fixed):0,demoPlan=p&&s.planSource!=='claude'?planWords(p):0;
  const m={user:{req:{w:words(s.idea),s:s.time.req},spec:{w:sum(s.questions.map(q=>q.custom||''))+sum(s.extras)+sum(s.conceptWishes||[]),s:s.time.spec},impl:{w:words(s.repo||''),s:s.time.impl}},
    ai:{req:{w:0,s:0},spec:{w:Math.max(s.aiLedger.spec.w,s.usage.ai+(s.specSource==='claude'?Math.max(0,words(s.spec)-fixed):0)),s:s.aiLedger.spec.ms/1000},impl:{w:s.aiLedger.impl.w+(Number(o.words)||0),s:s.aiLedger.impl.ms/1000+(Number(o.seconds)||0)}},
    tool:{req:{w:mods,s:0},spec:{w:fixed+demoSpec,s:0},impl:{w:demoPlan,s:0}}};
  // Idee und Einstellungen gehören zur Spezifikation: Ihr Anteil zählt dort mit
  for(const [a] of ACTORS){m[a].spec.w+=m[a].req.w;m[a].spec.s+=m[a].req.s;delete m[a].req}
  const tot=(pick)=>Object.fromEntries(PHASES.map(([k])=>[k,ACTORS.reduce((n,[a])=>n+m[a][k][pick],0)]));
  return {m,w:tot('w'),s:tot('s')};
}
// Zeit kurz und einheitlich: 45 s · 3:20 min · 1:05 h
const clock=sec=>{sec=Math.round(sec);if(sec<60)return sec+' s';if(sec<3600)return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+' min';return Math.floor(sec/3600)+':'+String(Math.floor(sec%3600/60)).padStart(2,'0')+' h'};
function effortBar(){
  const now0=effort(),wiped=Date.now()-resetAt<2200,box=$('navHint'),L=ledger(),cur=curPhase();
  const legend=node('span',undefined,'lgd');for(const [a,name] of ACTORS){const x=node('span',undefined,a);x.append(node('i'),name);legend.append(x)}
  const parts=[];
  PHASES.forEach(([k,name],idx)=>{
    if(idx)parts.push(node('span','›','arr'));
    const g=node('span',undefined,'ph'+(L.w[k]?'':' empty')),bar=node('span',undefined,'pbar'),tot=L.w[k]||1;
    // Länge nach der Wurzel des Anteils am größten Beitrag der Phase: So bleibt auch ein kleiner Beitrag neben einem tausendfach größeren sichtbar
    {const top=Math.max(1,...ACTORS.map(([a])=>L.m[a][k].w));for(const [a,n] of ACTORS){const v=L.m[a][k].w,row=node('span',undefined,'prow '+a+(v?'':' zero')),track=node('span',undefined,'ptrack'),fill=node('i');fill.style.width=(v>0?Math.max(5,Math.round(100*Math.sqrt(v/top))):0)+'%';row.title=n+': '+compact(v)+' Wörter'+(L.m[a][k].s>=1?' in '+clock(L.m[a][k].s):'');track.append(fill);row.append(node('span',n,'pname'),track);bar.append(row)}}
    const cap=node('span',undefined,'pcap');cap.append(node('b',name),node('span',L.w[k]?compact(L.w[k])+' W · '+clock(L.s[k]):'noch nicht begonnen','pnum'));
    g.append(cap,bar);
    g.title=name+': '+ACTORS.map(([a,n])=>n+' '+compact(L.m[a][k].w)+' Wörter'+(L.m[a][k].s>=1?' in '+clock(L.m[a][k].s):'')).join(' · ');
    if(effortPrev&&(L.w[k]>(effortPrev['w'+k]||0)||wiped))g.classList.add('tick');
    parts.push(g);
  });
  box.className='effortbar phasebar';box.replaceChildren(...parts);
  effortPrev={typed:now0.typed,clicks:now0.clicks,facts:now0.facts,topics:now0.topics,specWords:now0.specWords,wreq:L.w.req,wspec:L.w.spec,wimpl:L.w.impl};
  box.classList.toggle('wiped',wiped);
  box.setAttribute('aria-label','Wer in welcher Phase was beiträgt – öffnet die Übersicht. '+PHASES.map(([k,n])=>n+': '+compact(L.w[k])+' Wörter, '+clock(L.s[k])).join('; ')+'.');
  if($('balance').open)balanceUI();
  fitBar();
}
// Reicht der Platz neben der Marke nicht, fallen erst die Legende, dann die Zahlen weg; die Balken bleiben
function fitBar(){

  const box=$('navHint'),nav=document.querySelector('.top .brand');box.classList.remove('tight','tighter','gone');
  const clash=()=>{const a=box.getBoundingClientRect(),n=nav.getBoundingClientRect();return a.width>0&&n.width>0&&a.left<n.right+16&&a.top<n.bottom&&a.bottom>n.top};
  if(clash()){box.classList.add('tight');if(clash()){box.classList.add('tighter');if(clash())box.classList.add('gone')}}
}
addEventListener('resize',fitBar);
// Übersicht: links die drei Quellen des Inputs, rechts die entstandenen Artefakte
function balanceUI(){
  const body=$('balanceBody'),L=ledger(),b=bal();body.replaceChildren();
  const all=k=>ACTORS.flatMap(([a])=>PHASES.map(([p])=>L.m[a][p][k])),maxW=Math.max(1,...all('w')),maxS=Math.max(1,...all('s'));
  // Balken wachsen mit der Wurzel: So bleibt auch ein kleiner Beitrag neben einem tausendfach größeren sichtbar
  const scale=(v,max)=>v>0?Math.max(4,Math.round(100*Math.sqrt(v/max))):0;
  const sum=(a,k)=>PHASES.reduce((n,[p])=>n+L.m[a][p][k],0);
  const du=sum('user','w'),dus=sum('user','s'),rest=sum('ai','w')+sum('tool','w'),ais=sum('ai','s');
  // Die Kernaussage steht oben: was du hineingibst und was daraus wird
  const hero=node('div',undefined,'mxhero'),side=(cls,cap,big,unit,sub)=>{const x=node('div',undefined,'mxside '+cls),n=node('div',undefined,'mxbig');n.append(node('b',big),node('span',unit));x.append(node('span',cap,'eyebrow'),n,node('span',sub,'meta'));return x};
  hero.append(side('user','Von dir',compact(du),du===1?'Wort':'Wörter',dus>=1?'in '+clock(dus)+' aktiver Zeit':'aktive Zeit wird ab jetzt gemessen'),node('span','→','mxarrow'),
    side('made','Von KI und SpecIt',compact(rest),'Wörter',ais>=1?'in '+clock(ais)+' Rechenzeit':'Rechenzeit wird ab jetzt gemessen'));
  if(du&&rest){const fx=node('div',undefined,'mxfactor');fx.append(node('b','× '+Math.round(rest/du).toLocaleString('de-DE')),node('span','so viel Text entsteht aus einem deiner Wörter','meta'));hero.append(fx)}
  body.append(hero);
  const metric=(val,unit,pct,cls)=>{const x=node('div',undefined,'mxm '+cls),n=node('div',undefined,'mxn'),bar=node('span',undefined,'mxbar'),fill=node('i');n.append(node('b',val),node('span',unit));fill.style.width=pct+'%';bar.append(fill);bar.title='Die Länge wächst mit der Wurzel des Werts, damit kleine Beiträge sichtbar bleiben.';x.append(n,bar);return x};
  const grid=node('div',undefined,'mx');grid.style.setProperty('--cols',PHASES.length);
  grid.append(node('span'));
  PHASES.forEach(([k,name],i)=>{const h=node('div',undefined,'mxhead'+(L.w[k]?'':' idle'));h.append(node('b',name),node('span',L.w[k]?['Idee, Entwurf, Entscheidungen, Dokument','Plan, Aufträge, Code'][i]:'noch nicht begonnen','meta'));grid.append(h)});
  const what={user:['Idee, eigene Antworten und Änderungswünsche','Vorgaben für die Umsetzung'],ai:['Entwurf, Fragen, Features, Kapitel, Review','Plan und alles, was die Agenten schreiben'],tool:['Einstellungen als Vorgaben, feste Kapitel und Standards','Aufträge, die ohne KI entstehen']};
  for(const [a,name] of ACTORS){
    const head=node('div',undefined,'mxactor '+a),nm=node('div',undefined,'mxname');nm.append(node('i'),node('b',name));head.append(nm,node('span',a==='user'?'das bist du':a==='ai'?'Claude und die Agenten':'das Werkzeug','meta'));grid.append(head);
    PHASES.forEach(([k],i)=>{
      const c=L.m[a][k],zero=!c.w&&c.s<1,cell=node('div',undefined,'mxcell '+a+(zero?' zero':''));
      if(zero)cell.append(node('span','–','mxnone'));
      else{
        const row=node('div',undefined,'mxrow');
        row.append(metric(compact(c.w),c.w===1?'Wort':'Wörter',scale(c.w,maxW),'w'),a==='tool'?metric('< 1 s','ohne Wartezeit',0,'s none'):metric(c.s>=1?clock(c.s):'–',c.s>=1?(a==='user'?'aktive Zeit':'Rechenzeit'):'noch nicht gemessen',scale(c.s,maxS),'s'));
        cell.append(row);
      }
      cell.append(node('p',what[a][i],'meta'));grid.append(cell);
    });
  }
  grid.append(node('div','Summe','mxactor sum'));
  PHASES.forEach(([k])=>{const c=node('div',undefined,'mxcell sum');if(L.w[k]){const w=node('span');w.append(node('b',compact(L.w[k])),' Wörter');const s2=node('span');s2.append(node('b',clock(L.s[k])),' gesamt');c.append(w,s2)}else c.append(node('span','–','mxnone'));grid.append(c)});
  body.append(grid);
  // Was entstanden ist: je Ergebnis eine Marke
  const made=[];
  for(const x of b.outputs){
    if(x.key==='brand'){for(const part of String(x.detail||'').split(' · ').filter(Boolean))made.push([part,'',x.pending])}
    else made.push([x.label,compact(x.value)+' '+x.unit+(x.detail?' · '+x.detail:''),x.pending]);
  }
  if(made.length){const out=node('div',undefined,'mxout');out.append(node('span','Entstanden','eyebrow'));for(const [label,detail,pending] of made){const chip=node('span',undefined,'mxchip'+(pending?' pending':''));chip.append(node('b',label));if(detail)chip.append(node('span',detail));out.append(chip)}body.append(out)}
}
$('protoClose').onclick=()=>{$('protoBox').close();$('protoBody').replaceChildren()};
$('navHint').onclick=()=>{balanceUI();if(!$('balance').open)$('balance').showModal()};
{let last=0,drawn=0;const beat=()=>{const now=Date.now();if(last){const d=now-last;if(d>400)s.time[curPhase()]+=Math.min(d,30000)/1000}last=now;if(now-drawn>4000){drawn=now;save();effortBar()}};
 for(const ev of ['pointerdown','keydown','input','wheel'])document.addEventListener(ev,beat,{passive:true,capture:true})}
$('navHint').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('navHint').click()}};
$('navHint2').onclick=()=>$('navHint').click();$('navHint2').onkeydown=$('navHint').onkeydown;
$('balanceClose').onclick=()=>$('balance').close();$('balance').onclick=e=>{if(e.target===$('balance'))$('balance').close()};
const effortNow=()=>{effortBar();clearTimeout(effortSave);effortSave=setTimeout(save,800)};
document.addEventListener('click',e=>{
  if(!e.isTrusted||!e.target.closest)return;
  // „Zurücksetzen“ zählt nicht als Klick; es setzt die Zähler zurück und lässt sie grün aufleuchten
  if(e.target.closest('#reset')){resetAt=Date.now();for(const k in tickAt)delete tickAt[k];setTimeout(effortNow,0);setTimeout(effortBar,2300);return}
  if(e.target.closest('button,a,input,select,summary,label,textarea')){s.clicks++;effortNow()}
},true);
document.addEventListener('input',e=>{if(e.isTrusted)setTimeout(effortNow,0)},true);
function effort(){
  const typed=words(s.idea)+s.questions.reduce((n,q)=>n+words(q.custom),0)+s.extras.reduce((n,x)=>n+words(x),0);
  const sum=summary(s.questions),cov=coverage(s.questions);
  return {typed,clicks:s.clicks,facts:sum.decided+sum.defaults+s.extras.length,topics:cov.perTopic.filter(x=>x>0).length,specWords:words(s.spec)};
}
function effortText(){
  const e=effort();
  return plural(e.typed,'Wort','Wörter')+' getippt · '+plural(e.clicks,'Klick','Klicks')+' → '+plural(e.facts,'Festlegung','Festlegungen')+' in '+e.topics+' von 6 Themen'+(e.specWords?' · '+e.specWords.toLocaleString('de-DE')+' Wörter Spezifikation':'');
}

/* ---------- Stand der Arbeit: bestimmt, was in der einen Ansicht zu sehen ist ---------- */
function stageUI(){
  {const ws=wsOpen(),has=!!s.spec.trim(),b=document.body;
   b.classList.toggle('stage0',!ws);b.classList.toggle('drafting',atIdea()&&specMode!=='edit');b.classList.toggle('hasspec',has);$('step1').classList.toggle('on',!has);$('step2').classList.toggle('on',has);b.classList.toggle('started',ws||!!s.concept||!!conceptJob);if(!b.classList.contains('started'))b.classList.remove('ideaedit');
   // Steht ein Dokument – als Entwurf oder ausgearbeitet –, nimmt das Feld den Änderungswunsch; die Idee selbst lässt sich hervorholen
   // Feld 2 ist von Anfang an da, aber gesperrt, bis es ein Dokument gibt – als Entwurf oder ausgearbeitet
   {const wish=has||($('ai').checked&&conceptLive()&&!needConcept()&&!conceptJob);b.classList.toggle('haswish',wish);$('wish').disabled=!wish;$('wishOpen').disabled=!wish;$('wishTitle').textContent=has?'Was soll an der Spezifikation anders werden?':'Was soll am Entwurf anders werden?';$('wishRun').disabled=!wish||active;
    $('wish').placeholder=!wish?'Sobald der Entwurf steht, sagst du hier in eigenen Worten, was an der Spezifikation anders werden soll.':has?'Was soll an der Spezifikation anders werden? z. B. „Zusätzlich ein CSV-Export der Notizen“':'Was soll am Entwurf anders werden? z. B. „Auch für Gruppen zu dritt“';$('wishRun').textContent=has||!wish?'✦ Einarbeiten':'✦ In den Entwurf einarbeiten';$('wishRun').classList.toggle('has',wish&&!!$('wish').value.trim())}
   $('implPanel').classList.toggle('hidden',!has);$('reviewPanel').classList.toggle('hidden',!has);$('reusePanel').classList.toggle('hidden',!has);$('implOut').classList.toggle('hidden',!has);
   $('implMeta').textContent=s.plan?(stale()?'Plan veraltet':plural(s.plan.tasks.length,'Auftrag','Aufträge')+(s.finished?' · abgeschlossen':'')):has?'noch kein Plan':'';
  }
  // Genau eine primäre Aktion je Ansicht
  const ready=!!s.spec.trim()&&!s.dirty,allAnswered=s.questions.length>0&&firstOpen()<0;
  $('generate').textContent=s.spec.trim()?(s.specStrategy==='incremental'?'↻ Spezifikation aktualisieren':'↻ Spezifikation neu erstellen'):'✦ Spezifikation erstellen';
  $('generate').classList.toggle('primary',!ready);
  navUI();
}
function setPhase(i){s.phase=i;if(inQuestions()&&s.active<0)activate(firstOpen(),false);renderAll();focusPart(i);if(i===2)ensureFeatures()}
// Führt den Blick zur passenden Stelle der einen Ansicht, statt die Ansicht zu wechseln
function focusPart(i){
  const left=document.querySelector('.split>div:first-child'),go=el=>el&&el.scrollIntoView({block:'start',behavior:'smooth'});
  if(i===0){left.scrollTo({top:0,behavior:'smooth'});window.scrollTo({top:0});$('idea').focus({preventScroll:true})}
  else if(i===3){if(!s.spec.trim())return;$('implPanel').open=true;go($('implPanel'));if(s.plan)go($('implOut'))}
  else go(!s.spec.trim()&&!$('qaPane').classList.contains('hidden')?$('decPanel'):document.querySelector('.specwrap'));
}
// Je Stand der Spezifikation höchstens ein selbsttätiger Versuch, damit ein Fehler keine Schleife auslöst
let featTried='';
function ensureFeatures(){
  if(active||s.features.length||!s.spec.trim()||s.dirty||specMode==='edit')return;
  const key=digest(s.spec);if(featTried===key)return;featTried=key;deriveFeatures();
}
function navUI(){
  // Grün heißt überall: Das Nötige für den nächsten Schritt ist da – der Knopf dafür steht jeweils an Ort und Stelle.
  const open=s.questions.some(q=>q.state==='open');
  {const d=$('derive'),ok=!!s.idea.trim()&&!scaleMissing().length&&!active;d.classList.toggle('ready',ok);d.classList.toggle('nudge',ok&&!wsOpen())}
  {const p=$('implPanel'),ok=!!s.spec.trim()&&!s.dirty&&!open&&!s.features.some(f=>f.on!==f.inSpec)&&!s.plan&&!active;p.classList.toggle('nudge',ok&&!p.open)}
  {const b=$('finish');b.classList.toggle('nudge',!!s.plan&&!stale()&&!s.finished&&!b.disabled&&!active)}
  // Derselbe Grundsatz über dem leeren Dokument: „Spezifikation erstellen“ wird grün, sobald der Umfang steht und in die Zielzeit passt
  {const can=!s.spec.trim()&&s.features.length>0&&!open&&!overTarget();$('generate').classList.toggle('nudge',(can||(!!s.spec.trim()&&!!s.dirty))&&!active)}
  $('generate').classList.toggle('ready',!s.spec.trim()&&s.features.length>0&&!open&&!overTarget()&&!active);
  suggestRunDir();
  sketchUI();
  scaleDots();
  panelsUI();
  alignRows();
  // Spezifikations-Ansicht: Die Seite selbst rollt nicht; Dokument und Festlegungen rollen je für sich
  document.body.classList.add('fitview');
  // Dein Aufwand: immer an derselben Stelle in der Fußleiste, bei jeder Eingabe und jedem Klick aktualisiert
  effortBar();
}
$('implPanel').addEventListener('toggle',()=>navUI());
function alignRows(){requestAnimationFrame(()=>{{const w=$('wishPane'),h=document.querySelector('.doccol>.dochead'),col=document.querySelector('.specwrap>.railcol');}const input=document.querySelector('#namePanel .namerow input'),group=document.querySelector('.brandgroup'),b=$('derive');if(!input||!group)return;const w=Math.round(group.getBoundingClientRect().right-input.getBoundingClientRect().right-12);const dp=$('durPick'),rest=w-(dp?Math.round(dp.getBoundingClientRect().width)+10:0);b.style.width=rest>=150?rest+'px':''})}
window.addEventListener('resize',alignRows);
new ResizeObserver(()=>alignRows()).observe(document.querySelector('.split>.side'));
// Name, Logo und Review klappen nicht: Sie sind feste Zeilen
for(const id of ['namePanel','logoPanel','reviewPanel','reusePanel']){const d=$(id);d.open=true;d.classList.add('fixrow');d.querySelector('summary').addEventListener('click',e=>e.preventDefault());d.addEventListener('toggle',()=>{if(!d.open)d.open=true})}
// Ein Eingabefeld, zwei Aufgaben: Mit Dokument steht dort der Änderungswunsch; die Idee selbst lässt sich auf Wunsch hervorholen
// Als Text steht die Idee in sauberer Schreibweise da (Claude korrigiert nur Rechtschreibung und Zeichensetzung); im Textfeld bleibt, was du getippt hast
const ideaShownText=()=>{const raw=s.idea.trim();if(!raw)return '– (Spezifikation direkt eingefügt)';const t=s.ideaTidy&&s.ideaTidy.src===raw&&s.ideaTidy.text?s.ideaTidy.text:raw;return t.charAt(0).toUpperCase()+t.slice(1)};
let tidyBusy='';
function tidyIdea(){
  const raw=s.idea.trim();
  if(!raw||!statusLoaded||!$('ai').checked||!document.body.classList.contains('started')||document.body.classList.contains('ideaedit')||tidyBusy===raw||(s.ideaTidy&&s.ideaTidy.src===raw))return;
  tidyBusy=raw;const epoch=workSession.generation;
  bgCall({mode:'tidy',idea:raw,ai:true},2).then(r=>{if(workSession.isCurrent(epoch)&&s.idea.trim()===raw){s.ideaTidy={src:raw,text:typeof r.text==='string'?r.text.trim().slice(0,2000):''};save();$('ideaText').textContent=ideaShownText()}},()=>{if(workSession.isCurrent(epoch)&&s.idea.trim()===raw)s.ideaTidy={src:raw,text:''}}).finally(()=>{if(workSession.isCurrent(epoch)&&tidyBusy===raw)tidyBusy=''});
}
// Die Idee steht nach dem Start als Text da; der Stift macht sie wieder zum Textfeld, beim Verlassen wird sie wieder Text
$('ideaPen').onclick=()=>{document.body.classList.add('ideaedit');const i=$('idea');i.focus();i.setSelectionRange(i.value.length,i.value.length)};
$('idea').addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==$('idea'))document.body.classList.remove('ideaedit')},180));


/* ---------- Idee ---------- */
// Das Konzept entsteht nur auf Knopfdruck. Fehlt es (oder passt es nicht mehr zu Idee und Einstellungen), ist es der nächste Schritt.
const ideaSame=()=>s.questions.length>0&&s.idea.trim()===s.askedIdea;
const needConcept=()=>$('ai').checked&&atIdea()&&!ideaSame()&&!(s.concept&&s.concept.key===conceptKey());
function mainUI(){
  const b=$('derive'),l=$('deriveLabel'),e=$('elaborate'),busy=!!conceptJob,ai=$('ai').checked,need=needConcept();
  const next=ideaSame()?(s.spec.trim()?'Zur Spezifikation ←':'Zu den Entscheidungen ↓'):s.autonomy===100?'✦ Spezifikation erstellen →':'✦ Spezifikation ausarbeiten →';
  const nextTitle=ideaSame()?'':s.autonomy===100?'SpecIt entscheidet alles selbst und schreibt die Spezifikation.':'Arbeitet den Grobentwurf aus: leitet die Features und die noch offenen Fragen ab. Sind sie beantwortet, entsteht aus dem Gerüst die vollständige Spezifikation.';
  // Im Eingabefeld: mit Claude nur der Schritt zum Konzept – über die ganze Breite und leise pulsierend, sobald etwas geschrieben ist.
  // Ohne Claude gibt es kein Konzept; dort führt der Knopf direkt zur Ausarbeitung.
  // Nichts zu tun: Der Entwurf passt zu Idee und Einstellungen (oder die Spezifikation steht schon)
  const idle=ai&&!need&&!busy;b.classList.remove('hidden');
  l.textContent=busy?'Entwurf entsteht …':need?(s.concept?'↻ Entwurf aktualisieren':'✦ Entwurf erstellen'):idle?(atIdea()?'✓ Entwurf aktuell':'✓ In der Spezifikation'):next;
  const empty=!s.idea.trim()||(need&&!Number($('durLevel').value));b.disabled=busy||idle||empty;b.classList.remove('wide');b.classList.toggle('idle',idle||(empty&&!busy));b.classList.toggle('pulse',need&&!busy&&!empty);
  b.title=busy?'':need?'Claude schreibt aus deiner Idee und den Einstellungen den Grobentwurf der Spezifikation: das Gerüst aller Kapitel mit ersten Inhalten – und den Stellen, an denen du entscheiden kannst.':nextTitle;
  // Beim Konzept: der Schritt vom Konzept zur Spezifikation
  // Sind die Entscheidungen schon abgeleitet, heißt der Schritt „Spezifikation erstellen“ (auch ohne Claude)
  const make=ideaSame(),show=atIdea()&&!busy&&specMode!=='edit'&&(make||(ai&&!need&&conceptLive()));e.classList.toggle('hidden',!show);e.textContent=make?'✦ Spezifikation erstellen →':next;e.title=make?'Schreibt aus Entwurf, Entscheidungen und Features die vollständige Spezifikation.':nextTitle;e.disabled=active;
  e.classList.toggle('nudge',show&&!active&&(!make||$('generate').classList.contains('nudge')));
}
function mainAction(){
  if(conceptJob)return;
  if(needConcept()){
    const miss=scaleMissing();
    if(!s.idea.trim()){$('ideaStatus').textContent='Bitte zuerst die Idee eingeben.';$('idea').focus();return}
    if(words(s.idea)<4){$('ideaStatus').textContent='Bitte die Idee etwas genauer beschreiben (mindestens vier Wörter).';$('idea').focus();return}
    if(miss.length){$('ideaStatus').textContent=miss.includes('Zieldauer')?'Bitte noch wählen, wie viel Zeit du hast.':'Noch nicht eingestellt: '+miss.join(', ')+'.';if(miss.includes('Zieldauer')){$('durPick').classList.add('warn');$('durPick').focus()}return}
    $('ideaStatus').textContent='';conceptPauseUntil=0;clearTimeout(conceptIdle);runConcept(conceptKey());mainUI();ensureBrand();return;
  }
  derive(false);
}
$('elaborate').onclick=()=>{if(ideaSame())$('generate').click();else derive(false)};
// Ist das Konzept fertig, leuchten einmal die Stellen auf, die geprüft werden wollen – und „Alles akzeptieren“
function conceptAttention(){
  const box=$('concept'),all=$('conceptAll');
  for(const el of [box,all]){el.classList.remove('attn');void el.offsetWidth}
  box.classList.add('attn');if(!all.classList.contains('hidden')&&!all.disabled)all.classList.add('attn');
  setTimeout(()=>{box.classList.remove('attn');all.classList.remove('attn')},2700);
}

function ideaUI(){
  const same=ideaSame();
  mainUI();
  // Modus als Stufe mit Bedeutung statt als Prozentwert
  const level=s.autonomy/20,[title,text]=levels[level],n=s.questions.length,ask=Math.round(n*(1-s.autonomy/100)),who=$('ai').checked?'Claude':'SpecIt';
  levelMark('autonomyValue',level+1,levels.length,(level+1)+'/'+levels.length,'Stufe '+(level+1)+' von '+levels.length);
  $('autonomy').setAttribute('aria-valuetext',who+' '+title);
  scalesUI();presetsUI();
  const d=durations[s.durLevel],fdur=s.features.length?featDuration():null,need=fdur?fdur.total:0;
  levelMark('durValueText',s.durLevel,durations.length-1,durations[s.durLevel][0],durations[s.durLevel][0]);$('durLevel').setAttribute('aria-valuetext',d[0]);
  // Kurz gehalten, damit die Zeile nicht umbricht; die ausführliche Fassung steht im Tooltip
  $('durText').replaceChildren(node('b',d[0]),need&&d[1]?(need<=d[1]?' · passt':' · '+hm(need-d[1])+' zu viel'):'');$('durText').title=need&&d[1]?'Features: '+hm(need)+(need<=d[1]?' – passt in die Zielvorgabe':' – '+hm(need-d[1])+' mehr als die Zielvorgabe'):'';
  tip('durInfo','Reine Laufzeit der Coding-Agenten, nicht menschliche Entwicklungszeit. '+d[2]+(d[1]?' Der Umfang der Spezifikation wird darauf zugeschnitten.':'')+(need&&d[1]?' Die derzeit gewählten Features brauchen mit '+(fdur.agents===1?'einem Agenten':fdur.agents+' parallelen Agenten')+' etwa '+hm(need)+(need<=d[1]?'.':'; dafür Features abwählen oder die Dauer erhöhen.'):''));
  $('autonomyText').replaceChildren(node('b',shortAutonomy[level]),n&&level>0&&level<5?' · '+ask+'/'+n+' Fragen':'');$('autonomyText').title=who+' '+title+(n&&level>0&&level<5?' · '+ask+' von '+n+' Fragen an dich':'');
  tip('autonomyInfo','Legt fest, wie viel '+who+' selbst entscheidet. '+text);
}
// Die beiden weiteren Skalen: Stufe mit Bedeutung anzeigen; eine Änderung macht eine vorhandene Spezifikation prüfbedürftig
// Text eines Info-Symbols setzen (sichtbar beim Überfahren, für Vorlesehilfen als Beschriftung)
function tip(id,text){const e=$(id);e.querySelector('.tip').textContent=text;e.setAttribute('aria-label',text)}
// Gewählter Wert eines Reglers als schlichte Textmarke (die Pegel-Balken sind wieder entfallen)
function levelMark(id,value,max,text,label){const el=$(id);el.classList.remove('lvlmark');el.textContent='gewählt: '+label;el.removeAttribute('title');el.removeAttribute('aria-label')}
function scalesUI(){
  const who=$('ai').checked?'Claude':'SpecIt',c=creativityLevels[s.creativity],t=toneNames[s.tone];
  levelMark('creativityValue',s.creativity+1,5,(s.creativity+1)+'/5','Stufe '+(s.creativity+1)+' von 5');$('creativity').setAttribute('aria-valuetext',who+' '+c[0]);
  $('creativityText').replaceChildren(node('b',shortCreativity[s.creativity]));$('creativityText').title=who+' '+c[0];
  tip('creativityInfo','Legt fest, wie viel Eigenes die KI ins Konzept einbringt. '+c[1]+($('ai').checked?'':' Wirkt nur mit Claude; im Demo-Modus kommen keine eigenen Ideen hinzu.'));
  levelMark('toneValue',s.tone+1,5,(s.tone+1)+'/5','Stufe '+(s.tone+1)+' von 5');$('tone').setAttribute('aria-valuetext',t[0]);
  $('toneText').replaceChildren(node('b',shortTone[s.tone]));$('toneText').title=t[0];
  tip('toneInfo','Bestimmt Ton und Gestaltung der Anwendung, die entsteht. '+t[1]);
}
for(const id of ['creativity','tone'])$(id).oninput=e=>{s[id]=Number(e.target.value);touched();scalesUI();presetsUI();statuses();save()};
// Voreinstellungen: Jede stellt Modus, eigene Ideen der KI, Zielvorgabe und Layout-Entwürfe ein. Einsatzbereich und Name
// bleiben, wie sie sind – sie beschreiben die Anwendung, nicht die Arbeitsweise.
const presets=[
  {name:'Schnellste Umsetzung',why:'Claude entscheidet alles selbst, bringt nichts Eigenes ein, 15 Minuten Zielzeit, keine Layout-Entwürfe.',autonomy:100,creativity:0,durLevel:1,layouts:0},
  {name:'Ausgewogen',why:'Rückfragen bei allen wichtigen Entscheidungen, naheliegende Ergänzungen, keine Zeitvorgabe, keine Layout-Entwürfe.',autonomy:40,creativity:2,durLevel:0,layouts:0},
  {name:'Bestes Ergebnis',why:'Rückfragen bei allen wichtigen Entscheidungen, eigene Ideen der KI, keine Zeitvorgabe, keine Layout-Entwürfe, Review der Spezifikation durch Claude Opus 5.5.',autonomy:40,creativity:3,durLevel:0,layouts:0,review:'claude-opus-5-5'},
  {name:'Überraschendes Ergebnis',why:'Claude entscheidet alles selbst und denkt das Konzept kreativ weiter, keine Zeitvorgabe, keine Layout-Entwürfe.',autonomy:100,creativity:4,durLevel:0,layouts:0},
  {name:'Volle Kontrolle',why:'Du entscheidest alles selbst: Rückfrage bei jeder Entscheidung, nur das Vorgegebene, keine Zeitvorgabe, keine Layout-Entwürfe.',autonomy:0,creativity:0,durLevel:0,layouts:0}
];
// Ohne Stitch-Zugang lässt sich die Layout-Zahl nicht setzen; dann zählt sie für die Übereinstimmung nicht mit
// Review: nur das Preset „Bestes Ergebnis“ sieht eines vor (gründliches Modell); ohne eingerichtetes Claude zählt es für die Übereinstimmung nicht mit
const claudeReview=()=>reviewers.find(r=>r.id==='claude')||null;
const presetReview=p=>{const c=claudeReview();return !c||(p.review?s.reviewBy==='claude'&&(s.reviewModel===p.review||!c.models.some(m=>m.id===p.review)):!s.reviewBy)};
const presetOn=p=>s.autonomy===p.autonomy&&s.creativity===p.creativity&&s.durLevel===p.durLevel&&(!stitch||(s.layoutOn?s.layoutCount:0)===p.layouts)&&presetReview(p);
function applyPreset(p){
  if(s.durLevel!==p.durLevel)goalChanged=true;
  s.autonomy=p.autonomy;s.creativity=p.creativity;s.durLevel=p.durLevel;
  {const o={...(s.own||{})};for(const k of ['autonomy','creativity','durLevel','layout','review'])delete o[k];s.own=o}
  if(stitch){s.layoutOn=p.layouts>0;if(p.layouts>0)s.layoutCount=p.layouts}
  const c=claudeReview();
  if(p.review&&c){s.reviewBy='claude';s.reviewModel=c.models.some(m=>m.id===p.review)?p.review:''}else if(c||!p.review){s.reviewBy='';s.reviewModel=''}
  const next=applyAutonomy(s.questions,s.autonomy);
  if(next.some((q,i)=>q.state!==s.questions[i].state)){s.questions=next;change=null;s.last=-1;activate(firstOpen(),false)}
  touched();renderAll();
}
function presetsUI(){
  const box=$('presets'),on=presets.findIndex(presetOn);box.replaceChildren();
  presets.forEach((p,i)=>{const b=button(p.name,'btn small',()=>{applyPreset(p);$('paramPreset').open=false});b.title=p.why;b.setAttribute('aria-pressed',String(i===on));box.append(b)});
}
$('autonomy').oninput=e=>{
  s.autonomy=Number(e.target.value)*20;
  const next=applyAutonomy(s.questions,s.autonomy);
  if(next.some((q,i)=>q.state!==s.questions[i].state)){s.questions=next;change=null;s.last=-1;touched();activate(firstOpen(),false)}
  renderAll();
};
$('durLevel').oninput=e=>{goalChanged=true;s.durLevel=Number(e.target.value);touched();ideaUI();featuresUI();statuses();save()};
async function derive(more){
  if(active)return;
  const idea=s.idea.trim(),status=more?$('busy'):$('ideaStatus');
  if(!idea){$('ideaStatus').textContent='Bitte die Idee in einem Satz beschreiben.';$('idea').focus();return}
  // Weiter geht es erst, wenn kein Regler mehr rot ist
  if(!more&&scaleMissing().length){$('ideaStatus').textContent='Noch nicht eingestellt (roter Punkt): '+scaleMissing().join(', ')+'.';return}
  if(!more&&s.questions.length&&idea===s.askedIdea){setPhase(2);return}
  if(!more&&s.questions.some(q=>q.state!=='open')&&!confirm('Die Idee wurde geändert. Vorhandene Fragen und Antworten ersetzen?'))return;
  const rev=revision;const lockId=lock(true,'Spezifikation wird ausgearbeitet');status.textContent='';
  let auto=false;
  try{
    const base=more?[]:conceptQuestions(),concept=conceptPlain();
    const r=await call({mode:'questions',idea,project:s.project,questions:more?s.questions:base,fill:base.length>0,...(concept?{concept}:{}),ai:$('ai').checked,...frame()});
    if(rev!==revision){status.textContent='Eingaben geändert. Erneut starten.';return}
    const fresh=cleanQuestions(r.questions);
    if(more){
      const known=new Set(s.questions.map(q=>q.question.toLowerCase())),added=fresh.filter(q=>!known.has(q.question.toLowerCase()));
      s.questions=[...s.questions,...added].slice(0,40);
      status.textContent=added.length?plural(added.length,'weitere Frage','weitere Fragen')+' ergänzt.':'Keine weiteren Fragen nötig.';
      if(added.length&&s.spec)s.dirty=true;
    }else{
      if(!fresh.length&&!base.length)throw Error('Die Ausarbeitung ist nicht gelungen. Bitte erneut versuchen.');
      // Zuerst die Entscheidungen aus dem Konzept (sie prägen das Produkt), dann die ergänzten Fragen
      for(const r0 of Array.isArray(r.rephrase)?r.rephrase:[]){
        const hit=base.find(q=>q.question===r0.from);if(!hit||typeof r0.to!=='string'||!r0.to.trim())continue;hit.question=r0.to.trim();
        if(s.concept)s.concept.text=s.concept.text.split('{{'+r0.from+'|').join('{{'+hit.question+'|');
        if(r0.from in s.conceptAnswers){s.conceptAnswers[hit.question]=s.conceptAnswers[r0.from];delete s.conceptAnswers[r0.from]}
      }
      {const known=new Set(base.map(q=>q.question.toLowerCase()));s.questions=[...base,...fresh.filter(q=>!known.has(q.question.toLowerCase()))].slice(0,40)}s.askedIdea=idea;s.extras=[];s.last=-1;change=null;catOpen=-1;status.textContent='';
      if(s.spec)s.dirty=true;
    }
    // Je nach Modus entscheidet SpecIt einen Teil der Fragen selbst; im Auto-Modus alle, dann geht es direkt zur Spezifikation.
    s.questions=applyAutonomy(s.questions,s.autonomy);auto=!more&&firstOpen()<0;
    s.qSource=r.source;s.phase=2;activate(firstOpen(),false);renderAll();if(!quietScope){if(firstOpen()>=0)$('decPanel').open=true;if(!more)focusPart(2)}
  }catch(e){status.textContent=e.message;flashNote(e.message)}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  // Auch im Auto-Modus wird nur der Umfang ermittelt; geschrieben wird erst auf „Spezifikation erstellen“
  if(auto)startSpec(false);
}
$('idea').oninput=e=>{s.idea=e.target.value;revision++;if(s.spec)s.dirty=true;ideaUI();statuses();save()};
$('idea').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mainAction()}};
$('derive').onclick=mainAction;
$('more').onclick=()=>derive(true);

/* ---------- Fragen ---------- */
function activate(i,focus=true){
  s.active=i;const q=s.questions[i];
  pick=q?(q.state!=='open'?[...q.choice]:suggest()?[...q.defaults]:[]):[];custom=q?q.custom:'';customOpen=!!custom;
  if(focus){questionsUI();document.querySelector('.opt[aria-checked=true],.opt')?.focus({preventScroll:true})}
}
function choose(i){
  const q=s.questions[s.active];if(!q)return;
  if(q.multi)pick=pick.includes(i)?pick.filter(x=>x!==i):[...pick,i].sort();
  else{pick=[i];customOpen=false;custom=''}
  questionsUI();document.querySelectorAll('.opt')[i]?.focus({preventScroll:true});
}
function touched(){revision++;if(s.spec)s.dirty=true}
// Woran sich messen lässt, ob die Spezifikation noch zum Stand der Eingaben passt – und was sich geändert hat
const basisNow=()=>({idea:s.idea.trim(),q:s.questions.map(q=>[q.question,q.state==='open'?'':answerOf(q)]),x:[...s.extras],d:duration(),n:s.project.trim()});
// null = kapitelweise nicht möglich (andere Idee, kein Stand, Spezifikation ohne Bausteine, Änderung an Reglern ohne erfassbaren Unterschied)
function specChanges(){
  const b=s.specBasis,now=basisNow();
  if(!b||!Array.isArray(b.q)||b.idea!==now.idea||s.specSource!=='claude'||!/^## Nichtfunktionale Standards\s*$/m.test(s.spec))return null;
  const out=[],old=new Map(b.q.map(([k,v])=>[k,v]));
  for(const [q,a] of now.q){
    if(!old.has(q)){if(a)out.push('Neue Entscheidung „'+q+'“: '+a)}
    else if(old.get(q)!==a)out.push('Entscheidung „'+q+'“: bisher '+(old.get(q)||'offen')+', jetzt '+(a||'wieder offen'));
    old.delete(q);
  }
  for(const [q,a] of old)if(a)out.push('Die Entscheidung „'+q+'“ ('+a+') entfällt.');
  const xOld=new Set(b.x||[]),xNow=new Set(now.x);
  for(const x of now.x)if(!xOld.has(x))out.push('Neue Zusatzanforderung: '+x);
  for(const x of xOld)if(!xNow.has(x))out.push('Die Zusatzanforderung „'+x+'“ entfällt.');
  if(b.d!==now.d)out.push('Ziel-Entwicklungsdauer: bisher '+(b.d||'keine Vorgabe')+', jetzt '+(now.d||'keine Vorgabe'));
  for(const f of s.features)if(f.on!==f.inSpec)out.push('Feature „'+f.name+'“ '+(f.on?'gehört jetzt zum Umfang'+(f.note?' ('+f.note+')':''):'entfällt aus dem Umfang'));
  // Nur der Name oder nichts Erfassbares: Dann genügt der frische Rahmen – es sei denn, es ist etwas anderes verstellt (Ton, Kreativität)
  if(!out.length&&!(b.n!==now.n))return null;
  return out;
}
function dirtyWhy(){
  const b=s.specBasis,now=basisNow(),out=[];if(!b||!Array.isArray(b.q))return out;
  const short=t=>'„'+(t.length>48?t.slice(0,48)+'…':t)+'“';
  if(b.idea!==now.idea)out.push('die Idee');
  const old=new Map(b.q.map(([k,v])=>[k,v])),changed=now.q.filter(([k,v])=>old.has(k)&&old.get(k)!==v).map(([k])=>k),added=now.q.filter(([k])=>!old.has(k)).length;
  if(changed.length)out.push((changed.length===1?'die Antwort auf ':changed.length+' Antworten, darunter ')+short(changed[0]));
  if(added)out.push(plural(added,'neue Frage','neue Fragen'));
  if((b.x||[]).join('\n')!==now.x.join('\n'))out.push('die Zusatzanforderungen');
  if(b.d!==now.d)out.push('die Zielvorgabe ('+(now.d||'keine')+')');
  if(b.n!==now.n&&now.n)out.push('der Name ('+now.n+')');
  return out;
}
function confirmAnswer(){
  const i=s.active,q=s.questions[i];if(!q)return;
  const text=customOpen?custom.trim():'';
  if(!pick.length&&!text){$('busy').textContent='Bitte eine Option wählen oder eine eigene Antwort eingeben.';return}
  // Gibt es schon eine Spezifikation, wird die geänderte Antwort sofort eingearbeitet und die Änderung markiert
  if(s.spec.trim()){$('busy').textContent='';applyAnswer(i,[...pick],text).then(()=>{activate(-1,false);renderAll()});return}
  s.questions[i]={...q,state:'decided',choice:[...pick],custom:text};s.last=i;touched();$('busy').textContent='';
  const next=firstOpen(i);activate(next,false);renderAll();
  (document.querySelector('.opt[aria-checked=true],.opt')||$('generate')).focus({preventScroll:true});
  document.querySelector('.active')?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function skip(){const n=s.questions.length;let next=-1;for(let k=1;k<n;k++){const i=(s.active+k)%n;if(s.questions[i].state==='open'){next=i;break}}if(next>=0)activate(next)}
function acceptAll(){
  if(firstOpen()<0)return;
  s.questions=s.questions.map(q=>q.state==='open'?acceptDefault(q):q);s.last=-1;touched();activate(-1,false);renderAll();$('generate').focus();
}
function optionButton(q,i){
  const on=pick.includes(i),b=button(undefined,'opt'+(q.multi?' multi':''),()=>choose(i)),body=node('span',undefined,'body'),head=node('span');
  b.setAttribute('role',q.multi?'checkbox':'radio');b.setAttribute('aria-checked',String(on));
  head.append(q.options[i]+' ');
  if(suggest()&&q.defaults.includes(i)){head.append(node('span','Standard','chip ok'));body.append(head);if(q.reason)body.append(node('span',q.reason,'why'))}else body.append(head);
  b.append(node('span',String(i+1),'key'),body,node('span','✓','mark'));return b;
}
function questionsUI(){
  const out=$('questions'),n=s.questions.length;out.replaceChildren();
  s.questions.forEach((q,i)=>{
    if(i===s.active){
      const card=node('section',undefined,'card active'+(needMark&&q.state==='open'?' need':'')),opts=node('div'),foot=node('div',undefined,'spread'),hints=node('span',undefined,'meta'),acts=node('div',undefined,'actions');
      // Kopfzeile mit „Einklappen“: schließt die Frage, ohne die Antwort zu ändern (auch mit Esc)
      const top=node('div',undefined,'spread'),fold=button('▴ Einklappen','link',()=>{activate(-1,false);questionsUI()});fold.title='Frage schließen, ohne die Antwort zu ändern (Esc)';
      top.append(node('span','Frage '+(i+1)+' von '+n+' · '+topics[q.topic]+(q.multi?' · Mehrfachauswahl':''),'eyebrow'),fold);
      card.append(top,node('h2',q.question));
      opts.setAttribute('role',q.multi?'group':'radiogroup');opts.setAttribute('aria-label',q.question);opts.style.cssText='display:flex;flex-direction:column;gap:8px';
      q.options.forEach((_,k)=>opts.append(optionButton(q,k)));
      const own=button(undefined,'opt'+(q.multi?' multi':''),()=>{customOpen=!customOpen;if(customOpen&&!q.multi)pick=[];if(!customOpen&&!pick.length&&suggest())pick=[...q.defaults];questionsUI();$('customAnswer')?.focus()});
      own.setAttribute('role',q.multi?'checkbox':'radio');own.setAttribute('aria-checked',String(customOpen));
      own.append(node('span',String(q.options.length+1),'key'),node('span','Eigene Antwort …','body'),node('span','✓','mark'));opts.append(own);
      if(customOpen){const input=node('input');input.type='text';input.id='customAnswer';input.maxLength=500;input.value=custom;input.placeholder='Eigene Antwort in einem Satz';input.setAttribute('aria-label','Eigene Antwort');input.oninput=()=>{custom=input.value};opts.append(input)}
      hints.append(node('kbd','1–'+(q.options.length+1)),' wählen  ',node('kbd','Enter'),' bestätigen');
      if(firstOpen(i+1)!==i&&s.questions.filter(x=>x.state==='open').length>(q.state==='open'?1:0))acts.append(button('Überspringen','btn',skip));
      acts.append(button(firstOpen(i+1)===i||firstOpen(i+1)<0?'Übernehmen':'Übernehmen & weiter →','btn primary',confirmAnswer));
      foot.append(hints,acts);card.append(opts,foot);out.append(card);
    }else if(q.state!=='open'){
      const row=node('div',undefined,'row'+(i===s.last?' fresh':''));
      const qa=node('span',undefined,'qa');qa.append(node('span',q.question,'q'),node('span',answerOf(q),'a'));
      {const done=q.state==='decided',mark=node('span',done?'✓':'?','chip sym'+(done?' ok':''));mark.title=done?'Von dir entschieden':'Annahme: der vorgeschlagene Standard, noch nicht von dir bestätigt';mark.setAttribute('aria-label',mark.title);row.append(mark,qa)}
      const edit=button('ändern','link',()=>activate(i));edit.setAttribute('aria-label',q.question+' ändern');row.append(edit);out.append(row);
    }else{
      const next=button(undefined,'upcoming'+(needMark?' need':''),()=>activate(i)),chips=node('span',undefined,'actions');
      q.options.forEach((o,k)=>{const std=suggest()&&q.defaults.includes(k);chips.append(node('span',o+(std?' · Standard':''),'chip'+(std?' ok':'')))});
      next.append(node('span','Frage '+(i+1)+' von '+n+' · '+topics[q.topic],'eyebrow'),node('span',q.question,'title'),chips);out.append(next);
    }
  });
}
function gaugeUI(){
  const cov=coverage(s.questions),sum=summary(s.questions),answered=sum.decided+sum.defaults;
  $('gaugeValue').textContent=cov.percent+' %';$('level').setAttribute('aria-valuenow',cov.percent);
  $('level').setAttribute('aria-valuetext',cov.percent+' Prozent des Minimal-Konzepts');
  $('gaugeCaption').textContent=answered+' von '+sum.total+' Fragen beantwortet'+(cov.percent===100?' · implementierungsfähig':sum.open?' · '+sum.open+' offen':'');
  const level=$('level');level.replaceChildren();
  topics.forEach((t,i)=>{
    const seg=node('div',undefined,'seg'+(cov.perTopic[i]===1?' full':'')),tube=node('div',undefined,'tube'),fill=node('div',undefined,'fill');
    fill.style.width=Math.round(cov.perTopic[i]*100)+'%';tube.append(fill);const name=node('span',undefined,'name');name.append(node('span',t),node('span',Math.round(cov.perTopic[i]*100)+'%'));seg.append(tube,name);level.append(seg);
  });
  const e=effort(),box=$('effort'),input=node('div'),result=node('div'),b=(n,label)=>{const x=node('span');x.append(node('b',String(n)),' '+label);return x};
  input.append(node('span','Deine Eingabe','eyebrow'),b(e.typed,e.typed===1?'Wort':'Wörter'),' · ',b(e.clicks,e.clicks===1?'Klick':'Klicks'));
  result.append(node('span','Daraus entstanden','eyebrow'),b(e.facts,e.facts===1?'Festlegung':'Festlegungen'),' · ',b(e.topics,'von 6 Themen'));
  box.replaceChildren(input,node('span','→','arrow'),result);
  $('acceptAll').textContent='✓ Alle Standards übernehmen'+(sum.open?' ('+sum.open+' offen)':'');$('acceptAll').disabled=!sum.open;
  $('acceptAll').classList.toggle('hidden',!suggest());
  $('quickHint').textContent=!sum.open?'Alle Fragen beantwortet. Antworten bleiben einzeln änderbar.':suggest()?'Vorschläge passen? Dann alle offenen Fragen auf einmal beantworten.':'Fragen-geleitet: Jede Frage beantwortest du selbst, ohne Vorauswahl.';
  $('more').classList.toggle('hidden',!$('ai').checked);
  // Bereiche der rechten Spalte
  catalogUI();featuresUI();reuseUI();reviewChoiceUI();specReviewUI();runModelUI();logoUI();
}

/* ---------- Open-Source-Bausteine: echte GitHub-Treffer, von Claude bewertet, Übernahme nur nach Auswahl ---------- */
function reuseUI(){
  const box=$('reuseBox'),r=s.reuse,current=r&&s.reuseSpec===digest(s.spec);box.replaceChildren();
  $('reuseCount').textContent=current?(r.projects.filter(p=>p.included).length+' von '+r.projects.length+' gewählt'):'';
  if(s.spec.trim()){
    const ai=$('ai').checked,go=button(current?'⌕ Erneut recherchieren':'⌕ Auf GitHub recherchieren','btn small',researchReuse);go.disabled=active||!ai;
    go.title=!ai?'Die Recherche braucht Claude: Es schlägt die Suchbegriffe vor und bewertet die Treffer.':r&&!current?'Die Spezifikation hat sich seit der letzten Recherche geändert.':'Sucht auf GitHub nach vorhandenen Projekten, die Teile der Spezifikation abdecken.';
    // Pulsiert, solange für diese Fassung noch nicht recherchiert wurde
    go.classList.toggle('nudge',!current&&!s.dirty&&!active&&ai);box.append(go);
  }
  if(!current)return;
  if(r.warning||(r.failures&&r.failures.length))box.append(node('p',[r.warning,r.failures&&r.failures.length?'Suchfehler: '+r.failures.join('; '):''].filter(Boolean).join(' '),'meta'));
  if(!r.projects.length&&!r.warning)box.append(node('p','Keine passenden Projekte gefunden. Das ist kein Beleg, dass eine Neuentwicklung nötig ist.','meta'));
  r.projects.forEach((p,i)=>{
    const row=node('div',undefined,'reuseitem'),head=node('div',undefined,'spread'),link=node('a',p.name||p.url),pick=node('label',undefined,'switch'),input=node('input');
    link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';
    head.append(link,node('span',p.decision,'chip'+(p.decision==='einbeziehen'?' ok':p.decision==='prüfen'?' warn':'')));
    input.type='checkbox';input.checked=!!p.included;input.dataset.r=i;
    input.onchange=()=>{s.reuse={...r,projects:r.projects.map((x,k)=>k===i?{...x,included:input.checked}:x)};revision++;renderAll();$('reuseBox').querySelector('[data-r="'+i+'"]')?.focus({preventScroll:true})};
    pick.append(input,node('span',undefined,'track'),node('span','Zur Prüfung in die Aufträge übernehmen'));
    row.append(head,node('p','Lizenz: '+p.license+' · '+(p.language||'Sprache unbekannt')+' · ★ '+(p.stars||0)+' · letzte Aktivität: '+(p.updated?p.updated.slice(0,10):'unbekannt'),'meta'),
      node('p','Deckt möglicherweise ab: '+p.functions.join('; ')),node('p',p.reason||'Weitergehende Prüfung erforderlich.','meta'),node('p','Risiken und Prüfbedarf: '+(p.risks||'Lizenz, Sicherheit, Funktionsfähigkeit und Passung prüfen.'),'meta'),pick);
    box.append(row);
  });
  if(r.projects.length)box.append(node('p','Die Angaben stammen aus den GitHub-Metadaten und der Bewertung durch Claude; sie ersetzen keine Prüfung von Code, Lizenz und Sicherheit.','meta'));
}
async function researchReuse(){
  if(active||!s.spec.trim()||!$('ai').checked)return;
  const rev=revision,spec=s.spec;const lockId=lock(true,'Open-Source-Projekte werden auf GitHub recherchiert und bewertet');
  let message='';
  try{
    const result=await post('/api/reuse',{spec});
    if(rev!==revision||spec!==s.spec)message='Die Spezifikation wurde geändert; bitte die Recherche erneut starten.';
    else{s.reuse={...result,projects:(result.projects||[]).map(p=>({...p,included:false}))};s.reuseSpec=digest(spec)}
  }catch(e){message='Recherche unvollständig: '+e.message+' Daraus folgt nicht, dass neu entwickelt werden muss.'}
  finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message)specNote(message,true);
}

/* ---------- Fragen-Katalog neben der Spezifikation ---------- */
function syncCat(){const q=s.questions[catOpen];if(!q){catOpen=-1;catPick=[];catCustom='';return}catPick=q.state!=='open'?[...q.choice]:q.multi&&suggest()?[...q.defaults]:[];catCustom=q.custom}
function catalogUI(){
  // Zwei gleich aufgebaute Felder: beantwortete Fragen (Katalog) und noch offene (Entscheidungen), beide nach Thema
  const cat=$('catalog'),pend=$('openList'),all=s.questions.map((q,i)=>[q,i]),nOpen=all.filter(([q])=>q.state==='open').length;
  cat.replaceChildren();pend.replaceChildren();
  if(catOpen>=s.questions.length)catOpen=-1;
  if(needMark&&!nOpen)needMark=false;
  $('decCount').textContent=all.length?nOpen+' offen · '+(all.length-nOpen)+' getroffen':'';
  $('openHead').textContent='Noch offen · '+nOpen;$('doneHead').textContent='Getroffen · '+(all.length-nOpen);$('openHead').classList.toggle('hidden',!all.length);$('doneHead').classList.toggle('hidden',!all.length);
  if(nOpen){
    // Sammelaktionen: alles oder nur das Unwichtige von SpecIt entscheiden lassen
    const acts=node('div',undefined,'catacts'),every=button('Triff alle selbst','btn small',()=>decideOpen(false)),minor=button('Triff die unwichtigen selbst, frag nur nach den relevanten','btn small',()=>decideOpen(true));
    every.title='SpecIt übernimmt für jede offene Entscheidung den Standard und kennzeichnet ihn als Annahme.';
    minor.title='SpecIt entscheidet alles von geringer Tragweite selbst; die wirklich relevanten Entscheidungen bleiben offen und bei dir.';
    every.disabled=minor.disabled=active;acts.append(every,minor);pend.append(acts);
  }
  for(const [out,pending] of [[cat,false],[pend,true]])topics.forEach((t,ti)=>{
    const own=all.filter(([q])=>q.topic===ti&&(q.state==='open')===pending);
    if(!own.length)return;
    // Unterrubrik je Thema, zunächst eingeklappt; die Rubrik der gerade bearbeiteten Frage bleibt offen
    const key=(pending?'o':'a')+ti,holds=own.some(([,i])=>i===catOpen);if(holds)catGroups.add(key);
    const shown=catGroups.has(key),group=button(undefined,'catgroup',()=>{
      if(shown){catGroups.delete(key);if(holds){catOpen=-1;syncCat()}}else catGroups.add(key);
      catalogUI();side().querySelector('[data-g="'+key+'"]')?.focus({preventScroll:true});
    });
    group.dataset.g=key;group.setAttribute('aria-expanded',String(shown));group.append(node('span',t,'eyebrow'),node('span',String(own.length),'meta'));out.append(group);
    if(!shown)return;
    for(const [q,i] of own){
      const open=i===catOpen,item=node('div',undefined,'catitem'+(open?' open':'')+(change&&change.ids.includes(i)?' fresh':'')+(needMark&&q.state==='open'?' need':'')),head=button(undefined,'cathd',()=>{catOpen=open?-1:i;syncCat();catalogUI();side().querySelector('[data-q="'+i+'"]')?.focus({preventScroll:true})}),body=node('span',undefined,'body'),answer=node('span');
      head.dataset.q=i;head.setAttribute('aria-expanded',String(open));
      if(q.state==='open')answer.append(node('span','offen','chip warn'),' ',node('span',plural(q.options.length,'Alternative','Alternativen'),'meta'));else{answer.append(node('b',answerOf(q)));if(q.state==='default')answer.append(' ',node('span','Annahme','chip'))}
      const linked=s.features.filter(f=>(f.from||[]).includes(i));
      if(linked.length){const off=linked.filter(f=>!f.on).length;answer.append(' ',node('span',off===linked.length?(linked.length===1?'Feature abgewählt':'Features abgewählt'):plural(linked.length,'Feature','Features'),'chip'+(off===linked.length?' warn':'')));head.title='Daraus folgt: '+linked.map(f=>f.name+(f.on?'':' (abgewählt)')).join(', ')}
      body.append(node('span',q.question,'q'),answer);head.append(body,node('span',open?'–':'+','sign'));item.append(head);
      if(open){
        const box=node('div',undefined,'catbody'),opts=node('div'),row=node('div',undefined,'own'),input=node('input');
        opts.setAttribute('role',q.multi?'group':'radiogroup');opts.setAttribute('aria-label',q.question);opts.style.cssText='display:flex;flex-direction:column;gap:6px';
        q.options.forEach((o,k)=>{
          const b=button(undefined,'opt'+(q.multi?' multi':''),()=>{
            if(!q.multi){applyAnswer(i,[k],'');return}
            catPick=catPick.includes(k)?catPick.filter(x=>x!==k):[...catPick,k].sort();catalogUI();side().querySelectorAll('.catbody .opt')[k]?.focus({preventScroll:true});
          }),label=node('span',undefined,'body');
          b.setAttribute('role',q.multi?'checkbox':'radio');b.setAttribute('aria-checked',String(catPick.includes(k)));b.disabled=active;
          const line=node('span',o+' ');if(suggest()&&q.defaults.includes(k))line.append(node('span','Standard','chip ok'));label.append(line);
          b.append(label,node('span','✓','mark'));opts.append(b);
        });
        input.type='text';input.maxLength=500;input.value=catCustom;input.placeholder='Eigene Antwort';input.setAttribute('aria-label','Eigene Antwort zu: '+q.question);input.oninput=()=>{catCustom=input.value};
        const text=()=>catCustom.trim().replace(/\s+/g,' '),ok=button('Übernehmen','btn small',()=>applyAnswer(i,q.multi||!text()?catPick:[],text()));
        ok.disabled=active;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ok.click()}};
        row.append(input,ok);box.append(opts,row);
        if(q.multi)box.append(node('span','Mehrfachauswahl – mit „Übernehmen“ bestätigen.','meta'));
        item.append(box);
      }
      out.append(item);
    }
  });
  if(!cat.children.length)cat.append(node('p',s.questions.length?'Noch keine beantworteten Fragen.':'Noch keine Fragen. Oben eine Idee eingeben und Fragen ableiten.','meta'));
  if(!nOpen)pend.append(node('p','Keine offenen Entscheidungen.','meta'));
  // Das Feld mit der gerade bearbeiteten Frage aufklappen (sie wechselt beim Beantworten das Feld)
  const panel=side().querySelector('.catitem.open')?.closest('details');if(panel)panel.open=true;
  if($('ai').checked&&s.spec.trim()){const more=button('+ Offene Entscheidungen aus der Spezifikation ableiten','link',deriveDecisions);more.style.marginTop='12px';more.disabled=active;pend.append(more)}
}
const side=()=>document.querySelector('#work .side');
function specNote(t,warn){$('specStatus').className=warn?'banner':'status';$('specStatus').textContent=t;$('specStatus').title=t}
// Offene Entscheidungen der Spezifikation als Fragen mit Alternativen in den Katalog holen (nur mit Claude)
async function deriveDecisions(keepChange){
  if(active||!$('ai').checked||!s.spec.trim())return;
  if(s.questions.length>=40){specNote('Der Fragen-Katalog ist voll (40 Fragen).');return}
  const rev=revision;const lockId=lock(true,'Spezifikation wird ausgearbeitet');catalogUI();specNote('');
  let message='';
  try{
    const r=await call({mode:'decisions',spec:s.spec,project:s.project,questions:s.questions,ai:true});
    if(rev!==revision)message='Eingaben geändert. Erneut starten.';
    else{
      const known=new Set(s.questions.map(q=>q.question.toLowerCase())),added=cleanQuestions(r.questions).filter(q=>!known.has(q.question.toLowerCase())).map(q=>({...q,state:'open',choice:[],custom:''}));
      const before=s.questions.length;s.questions=[...s.questions,...added].slice(0,40);const n=s.questions.length-before;
      if(n&&keepChange!==true)change=null;
      message=n?plural(n,'offene Entscheidung','offene Entscheidungen')+' mit Alternativen in den Fragen-Katalog übernommen.':'Keine weiteren offenen Entscheidungen in der Spezifikation gefunden.';
    }
  }catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();specNote(message);
}
// Antwort aus dem Katalog übernehmen und die Spezifikation nachziehen
async function applyAnswer(i,choice,text){
  const q=s.questions[i];if(!q||active)return;
  if(!choice.length&&!text){$('specStatus').className='status';$('specStatus').textContent='Bitte eine Option wählen oder eine eigene Antwort eingeben.';return}
  if(q.state==='decided'&&q.custom===text&&q.choice.join()===[...choice].join())return;
  const was=answerOf(q)||'offen';s.last=i;catOpen=i;
  await commitAnswers(s.questions.map((x,k)=>k===i?{...x,state:'decided',choice:[...choice],custom:text}:x),[i],()=>({title:q.question,detail:was+' → '+answerOf(s.questions[i])}));
}
// „Triff alle selbst“ / „Triff die unwichtigen selbst“: offene Entscheidungen mit ihrem Standard als Annahme übernehmen
async function decideOpen(onlyMinor){
  if(active)return;
  let ids=s.questions.map((q,i)=>i).filter(i=>s.questions[i].state==='open');if(!ids.length)return;
  if(onlyMinor){
    const lockId=lock(true,'Spezifikation wird ausgearbeitet');catalogUI();
    try{const relevant=new Set((await call({mode:'triage',idea:s.idea,project:s.project,questions:s.questions,ai:$('ai').checked,...frame()})).relevant);ids=ids.filter(i=>!relevant.has(i))}
    catch(e){lock(false,undefined,lockId);catalogUI();specNote(e.message,true);return}
    lock(false,undefined,lockId);
    if(!ids.length){catalogUI();specNote('Alle offenen Entscheidungen sind als relevant eingestuft – sie bleiben bei dir.');return}
  }
  const set=new Set(ids),left=s.questions.filter(q=>q.state==='open').length-ids.length;catOpen=-1;
  await commitAnswers(s.questions.map((q,i)=>set.has(i)?{...acceptDefault(q),auto:true}:q),ids,()=>({title:plural(ids.length,'Entscheidung','Entscheidungen')+' von SpecIt getroffen',detail:'als Annahme gekennzeichnet'+(left?' · '+plural(left,'relevante bleibt','relevante bleiben')+' bei dir':'')}));
}
// Geänderte Antworten übernehmen und die Spezifikation nachziehen; ids = geänderte Fragen, label = Text der Hinweisleiste
async function commitAnswers(next,ids,label){
  const prev={questions:s.questions,spec:s.spec,specSource:s.specSource,dirty:s.dirty},i=ids.length===1?ids[0]:-1;
  s.questions=next;revision++;change=null;
  syncCat();if(s.active>=0)activate(s.active,false);
  if(!prev.spec.trim()){renderAll();return}
  const rev=revision,ai=$('ai').checked,base={idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,...frame()};
  // Vollständig neu erzeugen nur, wo das den Entwurf nicht entwertet: nie bei von Hand geschriebenen Spezifikationen.
  const regen=prev.specSource==='demo'||(prev.specSource==='claude'&&ai);
  let md=null,source=prev.specSource,message='';
  const lockId=lock(true,'Spezifikation wird ausgearbeitet');renderAll();specNote('Spezifikation wird angepasst …');
  try{
    if(!prev.dirty)md=(await call({...base,mode:'revise',previous:prev.questions,index:i,spec:prev.spec,ai})).markdown??null;
    if(md===null&&regen){const r=await call({...base,mode:'final',ai:prev.specSource==='claude'});md=r.markdown;source=r.source}
  }catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  if(md!==null&&rev===revision){
    s.spec=md;s.specSource=source;s.dirty=false;$('spec').value=md;specMode='view';
    change={ids,...label(),prev,old:prev.spec,until:0,scroll:false};
    renderAll();flash();
    side().querySelector('.catitem.open')?.scrollIntoView({block:'nearest'});
    // Eine neue Antwort kann neue offene Entscheidungen aufwerfen; auch die bekommen Alternativen.
    if(source==='claude'&&ai&&s.autonomy<100)await deriveDecisions(true);
    // Der Feature-Katalog folgt aus den Entscheidungen: nach einer geänderten Antwort neu ermitteln (die Auswahl bleibt erhalten)
    if(s.features.length)await deriveFeatures();
  }else{
    s.dirty=true;renderAll();
    if(message){$('specStatus').className='banner';$('specStatus').textContent='⚠ Antwort übernommen, Spezifikation nicht angepasst: '+message}
  }
}
// Vergleicht die Textbausteine der alten und neuen Spezifikation und markiert neue oder geänderte.
const unitSel='h2,h3,h4,h5,h6,p,li,tr,pre';
function unitText(e){if(e.tagName!=='LI')return e.tagName+e.textContent.trim();const c=e.cloneNode(true);for(const x of c.querySelectorAll('ul,ol'))x.remove();return 'LI'+c.textContent.trim()}
// Die Schätzung gehört in den Rahmen der Spezifikation – in Ansicht, Download und PDF. Sie hängt an der aktuellen Feature-Auswahl
// und der Agentenzahl, steht deshalb nicht im gespeicherten Text, sondern wird beim Ausgeben eingesetzt (direkt unter der Zielvorgabe).
const estLabel='Geschätzte Entwicklungsdauer';
function estText(){if(!s.features.some(f=>f.on))return '';const fd=featDuration();return hm(fd.total)+' für die gewählten Features, '+(fd.agents===1?'mit einem Agenten':'mit '+fd.agents+' parallelen Agenten')}
function specOut(md){
  const est=estText(),lines=String(md||'').split('\n').filter(l=>!l.startsWith('- **'+estLabel+'**'));if(!est)return lines.join('\n');
  const at=lines.findIndex(l=>/^## Rahmen\s*$/.test(l));if(at<0)return lines.join('\n');
  let end=at+1;while(end<lines.length&&!/^#{1,2} /.test(lines[end]))end++;
  let pos=-1;for(let i=at+1;i<end;i++){if(lines[i].startsWith('- **Ziel-Entwicklungsdauer**'))pos=i+1;else if(pos<0&&lines[i].startsWith('- '))pos=i}
  if(pos<0)pos=at+1;
  lines.splice(pos,0,'- **'+estLabel+'** '+est);return lines.join('\n');
}
// Die heruntergeladene Datei trägt zusätzlich das gewählte Logo: als eingebettetes Bild über dem Titel, damit sie für sich allein vollständig ist
function specFile(){
  const md=withDiagrams(specOut(s.spec)),pick=s.logos[s.logoChosen];if(!pick)return md;
  let data='';try{data=btoa(unescape(encodeURIComponent(cleanSvg(pick.svg))))}catch{return md}
  return '!['+('Logo '+(s.project.trim()||pick.name)).replace(/[\[\]]/g,'')+'](data:image/svg+xml;base64,'+data+')\n\n'+md;
}
/* ---------- Schaubilder der Anwendung, aus der Spezifikation abgeleitet: Ablauf, Aufbau, Datenmodell ---------- */
// Maßgeblich bleibt der Text. Jedes Schaubild gehört zum Stand bestimmter Kapitel (key) und wird neu abgeleitet, wenn sich diese ändern.
// Zwei Quellen: „flow“ (Kapitel Kernabläufe → Ablauf) und „arch“ (UX, Daten und Schnittstellen → Aufbau und Datenmodell).
function chapterText(md,res){const lines=String(md||'').split('\n'),out=[];for(const re of res){const at=lines.findIndex(l=>re.test(l));if(at<0)continue;let end=at+1;while(end<lines.length&&!/^## /.test(lines[end]))end++;out.push(lines.slice(at,end).join('\n').trim())}return out.join('\n\n')}
const diagSrc={
  flow:{chapters:[/^## Kernabläufe/],clean:cleanFlow,field:'flow',fail:'Das Schaubild konnte nicht abgeleitet werden.'},
  arch:{chapters:[/^## UX und Gestaltung/,/^## Daten und Schnittstellen/],clean:cleanArch,field:'arch',fail:'Aufbau und Datenmodell konnten nicht abgeleitet werden.'},
  proto:{chapters:[/^## Ziel und Nicht-Ziele/,/^## Kernabläufe/,/^## UX und Gestaltung/,/^## Umfang/],clean:cleanProto,field:'proto',fail:'Der Prototyp konnte nicht gebaut werden.',extra:()=>s.project.trim()}
};
const diagKey=src=>{const d=diagSrc[src],t=chapterText(s.spec,d.chapters);return t?digest(t+(d.extra?'\n'+d.extra():'')):''};
const diagNow=src=>s[src]&&s[src].key===diagKey(src)?s[src]:null;
const diagBusy={flow:false,arch:false,proto:false},diagTried={flow:'',arch:'',proto:''},diagNote={flow:'',arch:'',proto:''};
async function bgCall(body,tries=10){
  const epoch=workSession.generation,signal=workSession.signal;
  for(let i=0;;i++){
    if(!workSession.isCurrent(epoch))throw Error('Abgebrochen.');
    const res=await fetch('/api/spec',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,bg:true}),signal});
    const r=await res.json().catch(()=>({}));
    if(!workSession.isCurrent(epoch))throw Error('Abgebrochen.');
    if(res.status===429&&i<tries){await abortableDelay(2000,signal);continue}
    if(!res.ok)throw Error(r.error||'Die Anfrage ist fehlgeschlagen.');
    if(r.usage)addUsage(body.mode,r.usage);
    return r;
  }
}

// Name und Logo entstehen von selbst, sobald man die Idee verlassen hat – im Hintergrund, neben Features und Spezifikation.
// Ein einzelner Vorschlag gilt ohne weiteren Klick als gewählt und steht überall, wo Name und Logo gebraucht werden.
const brandBusy={names:false,logos:false},brandTried={names:'',logos:''};
function ensureBrand(){
  // Name und Logo entstehen, sobald das Konzept angestoßen ist – nicht erst mit den Fragen
  if(!statusLoaded||!(wsOpen()||s.concept||conceptJob)||(!s.idea.trim()&&!s.spec.trim()))return;
  const base=[s.idea.trim(),s.tone,$('ai').checked].join('|');
  if(s.nameCount>0&&!s.project.trim()&&!s.names.length&&!brandBusy.names&&brandTried.names!==base+'|'+s.nameCount){
    const key=brandTried.names=base+'|'+s.nameCount,epoch=workSession.generation;brandBusy.names=true;namesUI();
    bgCall({mode:'names',idea:s.idea,spec:s.spec,count:s.nameCount,tone:s.tone,avoid:[],ai:$('ai').checked})
      .then(r=>{if(workSession.isCurrent(epoch)&&key===brandTried.names&&!s.project.trim()&&!s.names.length){s.names=cleanNames(r.names);save()}},()=>{})
      .finally(()=>{if(workSession.isCurrent(epoch)){brandBusy.names=false;renderAll()}});
  }
  if(s.logoCount>0&&!s.logos.length&&!brandBusy.logos&&brandTried.logos!==base+'|'+s.logoCount){
    const key=brandTried.logos=base+'|'+s.logoCount,epoch=workSession.generation;brandBusy.logos=true;logoUI();
    bgCall({mode:'logos',idea:s.idea,spec:s.spec,project:s.project,count:s.logoCount,tone:s.tone,ai:$('ai').checked})
      .then(r=>{if(workSession.isCurrent(epoch)&&key===brandTried.logos&&!s.logos.length){s.logos=cleanLogos(r.logos);s.logoChosen=s.logos.length===1?0:-1;save()}},()=>{})
      .finally(()=>{if(workSession.isCurrent(epoch)){brandBusy.logos=false;renderAll()}});
  }
  // Genau ein Namensvorschlag gewünscht und gekommen: übernehmen – einmal je Vorschlag, damit ein bewusst geleerter Name leer bleibt
  if(s.nameCount===1&&s.names.length===1&&!s.project.trim()&&!active&&s.nameAuto!==s.names[0].name){s.nameAuto=s.names[0].name;save();setTimeout(()=>applyName(s.names[0].name),0)}
}
async function deriveDiagram(src,force){
  const key=diagKey(src),def=diagSrc[src],epoch=workSession.generation;
  if(diagBusy[src]||!key||!$('ai').checked||(!force&&(diagTried[src]===key||diagNow(src))))return;
  diagTried[src]=key;diagBusy[src]=true;diagNote[src]='';if(force)specUI();
  try{
    const r=await bgCall({mode:src,spec:s.spec,project:s.project,ai:true}),m=def.clean(r[def.field]);
    if(workSession.isCurrent(epoch)&&m&&key===diagKey(src)){s[src]={key,...m};save()}
  }catch(e){if(workSession.isCurrent(epoch))diagNote[src]=e.message}
  if(workSession.isCurrent(epoch)){diagBusy[src]=false;if(specMode==='view'&&!active)specUI()}
}
// Die drei Schaubilder: Titel, Quelle, wie aus dem Stand das Modell wird, wie es gezeichnet und als Mermaid-Text ausgegeben wird
const diagKinds={
  proto:{title:'Prototyp',src:'proto',of:m=>m.body,svg:body=>protoFrame(body),busy:'wird aus der Spezifikation gebaut …',ready:'klickbar · aus der Spezifikation gebaut, kein Ersatz für die Umsetzung'},
  flow:{title:'Ablauf',src:'flow',of:m=>m,svg:m=>flowSvg(m),mermaid:flowMermaid},
  structure:{title:'Aufbau',src:'arch',of:m=>m.structure,svg:m=>structureSvg(m),mermaid:structureMermaid},
  data:{title:'Datenmodell',src:'arch',of:m=>m.data,svg:m=>dataSvg(m),mermaid:dataMermaid}
};
const diagModel=kind=>{const k=diagKinds[kind],m=diagNow(k.src);return m?k.of(m)||null:null};
const svgEl=(tag,attrs,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!==undefined)e.textContent=text;return e};
let arrowNo=0;
function svgStart(l,label){
  const arrow='flowArrow'+(++arrowNo),svg=svgEl('svg',{viewBox:'0 0 '+l.width+' '+l.height,width:l.width,height:l.height,role:'img','aria-label':label}),defs=svgEl('defs'),mark=svgEl('marker',{id:arrow,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});
  mark.append(svgEl('path',{d:'M0,0 L10,5 L0,10 z',class:'flowtip'}));defs.append(mark);svg.append(defs);svg._arrow='url(#'+arrow+')';return svg;
}
const svgLines=(g,n,size=15)=>n.lines.forEach((line,i)=>g.append(svgEl('text',{x:n.x+n.w/2,y:n.y+n.h/2+4.5+(i-(n.lines.length-1)/2)*size},line)));
// Verknüpfung mit dem Text: Ein Knoten, der Anforderungen nennt, trägt deren Kennung und springt per Klick dorthin.
// Nennt er mehrere, führt jeder weitere Klick zur nächsten.
let refTurn={key:'',i:0};
function refLink(g,n,key){
  const refs=(n.refs||[]).filter(id=>specHasReq(id));if(!refs.length)return;
  const label=refs[0]+(refs.length>1?' +'+(refs.length-1):''),wd=label.length*5.6+12;
  g.append(svgEl('rect',{x:n.x+10,y:n.y-8,width:wd,height:15,rx:7.5,class:'flowref'}),svgEl('text',{x:n.x+10+wd/2,y:n.y+3,class:'flowreftext'},label));
  g.classList.add('linked');g.setAttribute('tabindex','0');g.setAttribute('role','link');g.setAttribute('aria-label',n.label+' – zur Anforderung '+refs.join(', '));
  const go=()=>{const i=refTurn.key===key?(refTurn.i+1)%refs.length:0;refTurn={key,i};jumpToReq(refs[i])};
  g.addEventListener('click',go);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
}
// Wo eine Anforderung im Markdown festgelegt ist: die Zeile, die mit ihrer Kennung beginnt (als Absatz, Listenpunkt oder Zwischenüberschrift)
function reqChapter(id){
  let chap='';const start=new RegExp('^(?:[-*+] |\\d+[.)] |#{3,6} )?(?:\\*\\*|__)?'+id+'\\b');
  for(const l of s.spec.split('\n')){const m=/^## (.+?)\s*$/.exec(l);if(m)chap=m[1];else if(chap&&start.test(l.trim()))return chap}
  return '';
}
const specHasReq=id=>!!reqChapter(id);
function jumpToReq(id){
  const chap=reqChapter(id);if(!chap)return;
  // im ganzen Dokument bleiben, sonst ins Kapitel der Anforderung wechseln; die Anforderung aufklappen und kurz hervorheben
  if(specChapter!=='Alles')specChapter=chap;
  reqSet(id,true);specUI();
  const view=$('specView'),hit=[...view.querySelectorAll('.reqhead,li.req,p.req')].find(e=>e.offsetParent&&e.textContent.trim().startsWith(id))||[...view.querySelectorAll('h4,h5,li,p')].find(e=>e.offsetParent&&e.textContent.trim().startsWith(id));
  if(!hit)return;
  hit.scrollIntoView({block:'center',behavior:'smooth'});hit.classList.remove('reqflash');void hit.offsetWidth;hit.classList.add('reqflash');
}
// Ablauf: Stufen von oben nach unten, Verzweigungen als Sechseck, Rücksprünge gestrichelt außen
function flowSvg(flow){
  const l=layoutFlow(flow),svg=svgStart(l,'Ablaufdiagramm'+(flow.title?': '+flow.title:'')+' mit '+flow.nodes.length+' Schritten');
  for(const e of l.edges)svg.append(svgEl('path',{d:e.d,class:'flowedge'+(e.back?' back':''),'marker-end':svg._arrow}));
  for(const e of l.edges)if(e.label)svg.append(svgEl('text',{x:e.lx,y:e.ly+4,class:'flowlabel'},e.label));
  for(const n of l.nodes){
    const g=svgEl('g',{class:'flownode '+n.kind}),t=12;
    g.append(n.kind==='decision'?svgEl('polygon',{points:[[n.x,n.y+n.h/2],[n.x+t,n.y],[n.x+n.w-t,n.y],[n.x+n.w,n.y+n.h/2],[n.x+n.w-t,n.y+n.h],[n.x+t,n.y+n.h]].map(p=>p.join(',')).join(' ')}):svgEl('rect',{x:n.x,y:n.y,width:n.w,height:n.h,rx:n.kind==='start'||n.kind==='end'?n.h/2:8}));
    svgLines(g,n);g.append(svgEl('title',{},n.label+(n.refs.length?' · '+n.refs.join(', ')+' – klicken, um zur Anforderung zu springen':'')));refLink(g,n,'flow:'+n.id);svg.append(g);
  }
  return svg;
}
// Aufbau: Bausteine in Ebenen (Nutzer, Oberfläche, Logik, Daten und Schnittstellen)
function structureSvg(st){
  const l=layoutStructure(st),svg=svgStart(l,'Aufbau der Anwendung mit '+st.nodes.length+' Bausteinen');
  for(const r of l.rows)svg.append(svgEl('text',{x:4,y:r.y,class:'flowrow'},r.name));
  for(const e of l.edges)svg.append(svgEl('path',{d:e.d,class:'flowedge','marker-end':svg._arrow}));
  for(const e of l.edges)if(e.label)svg.append(svgEl('text',{x:e.lx,y:e.ly+4,class:'flowlabel'},e.label));
  for(const n of l.nodes){
    const g=svgEl('g',{class:'flownode k-'+n.kind});
    g.append(svgEl('rect',{x:n.x,y:n.y,width:n.w,height:n.h,rx:n.kind==='actor'?n.h/2:n.kind==='store'?3:8}));
    if(n.kind==='store')g.append(svgEl('path',{d:'M'+n.x+','+(n.y+7)+' h'+n.w,class:'flowrule'}));
    svgLines(g,n);g.append(svgEl('title',{},n.label+(n.note?' – '+n.note:'')+((n.refs||[]).length?' · '+n.refs.join(', ')+' – klicken, um zur Anforderung zu springen':'')));refLink(g,n,'arch:'+n.id);svg.append(g);
  }
  return svg;
}
// Datenmodell: je Objekt ein Kasten mit seinen Feldern, Beziehungen als Linien mit Mengenangabe
function dataSvg(d){
  const l=layoutData(d),svg=svgStart(l,'Datenmodell mit '+d.entities.length+' Objekten');
  for(const r of l.relations)svg.append(svgEl('path',{d:r.d,class:'flowedge'}));
  for(const r of l.relations){if(r.label)svg.append(svgEl('text',{x:r.lx,y:r.ly+4,class:'flowlabel'},r.label));svg.append(svgEl('text',{x:r.pa.x,y:r.pa.y,class:'flowcard'},r.ca),svgEl('text',{x:r.pb.x,y:r.pb.y,class:'flowcard'},r.cb))}
  for(const e of l.entities){
    const g=svgEl('g',{class:'flownode entity'});
    g.append(svgEl('rect',{x:e.x,y:e.y,width:e.w,height:e.h,rx:8}),svgEl('path',{d:'M'+e.x+','+(e.y+e.head)+' h'+e.w,class:'flowrule'}),svgEl('text',{x:e.x+e.w/2,y:e.y+e.head/2+4.5},e.name));
    e.attributes.forEach((a,i)=>g.append(svgEl('text',{x:e.x+12,y:e.y+e.head+15+i*e.line,class:'flowattr'},a)));
    if(!e.attributes.length)g.append(svgEl('text',{x:e.x+12,y:e.y+e.head+15,class:'flowattr none'},'–'));
    svg.append(g);
  }
  return svg;
}
// Der Rahmen um ein Schaubild: Titel, Herkunft, neu ableiten, Mermaid-Text kopieren. null = nichts zu zeigen.
function diagramFigure(kind){
  const k=diagKinds[kind],src=k.src,model=diagModel(kind),stale=!diagNow(src)&&s[src]?k.of(s[src]):null,busy=diagBusy[src],note=diagNote[src];
  if(!model&&!stale&&!busy&&!note)return null;
  // Während des Ableitens steht nur beim ersten Schaubild einer Quelle ein Platzhalter; das Datenmodell erscheint erst, wenn es eines gibt
  if(!model&&!stale&&kind==='data')return null;
  const box=node('div',undefined,'flowfig'),head=node('div',undefined,'flowhead'),tools=node('span',undefined,'flowtools'),info=node('span',undefined,'meta'),shown=model||stale;
  head.append(node('span',k.title+(kind==='flow'&&shown&&shown.title?' · '+shown.title:''),'eyebrow'));
  info.textContent=busy?(k.busy||'wird aus der Spezifikation abgeleitet …'):note?note:model?(k.ready||'aus der Spezifikation abgeleitet · maßgeblich bleibt der Text'):'Stand vor der letzten Änderung';
  if(!busy&&$('ai').checked)tools.append(button(kind==='proto'?'↻ neu bauen':'↻ neu ableiten','link',()=>deriveDiagram(src,true)));
  if(kind==='proto'&&model){tools.append(button('⤢ groß','link',()=>protoOpen(model)),button('↓ HTML','link',()=>download((repoSlug()||'prototyp')+'-prototyp.html',protoHtml(model))))}
  if(model&&k.mermaid){const copy=button('⧉ Mermaid','link',()=>copyText(k.mermaid(model),info));copy.title='Das Schaubild als Mermaid-Text kopieren (steht auch im heruntergeladenen Markdown)';tools.append(copy)}
  head.append(info,tools);box.append(head);
  if(shown){const wrap=node('div',undefined,'flowwrap'+(stale&&!model?' old':''));wrap.append(k.svg(shown));box.append(wrap)}
  return box;
}
// Prototyp: das vollständige Dokument mit Gerüst, Name und gewähltem Logo – angezeigt in einem abgeschotteten Rahmen
// (sandbox ohne same-origin: kein Zugriff auf SpecIt, seinen Speicher oder das Netz).
const protoHtml=body=>protoDocument(body,{name:s.project.trim(),logoSvg:s.logos[s.logoChosen]?cleanSvg(s.logos[s.logoChosen].svg):'',tone:s.tone});
function protoFrame(body,tall){const f=node('iframe',undefined,'protoframe'+(tall?' tall':''));f.setAttribute('sandbox','allow-scripts');f.setAttribute('title','Klickbarer Prototyp der Anwendung');f.setAttribute('loading','lazy');f.srcdoc=protoHtml(body);return f}
function protoOpen(body){$('protoBody').replaceChildren(protoFrame(body,true));if(!$('protoBox').open)$('protoBox').showModal()}
// Im Überblick: ein Schaubild auf einmal, mit Umschalter
let diagTab='flow',diagOpen=false;
function diagramPanel(){
  const kinds=Object.keys(diagKinds).filter(k=>k!=='proto'&&diagramFigure(k));if(!kinds.length)return null;
  // Gewünscht bleibt, was zuletzt gewählt wurde (Standard: der Prototyp); ist es noch nicht da, zeigt die Ansicht vorläufig das erste Vorhandene
  const shownTab=kinds.includes(diagTab)?diagTab:kinds[0];
  const box=node('div',undefined,'diagpanel'),tabs=node('div',undefined,'seg diagtabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Schaubilder');
  for(const k of kinds){const b=button(diagKinds[k].title,k===shownTab?'on':'',()=>{diagTab=k;specUI()});b.setAttribute('aria-pressed',String(k===shownTab));tabs.append(b)}
  if(kinds.length>1)box.append(tabs);box.append(diagramFigure(shownTab));return box;
}
// In den Kapiteln: der Ablauf unter „Kernabläufe“, Aufbau und Datenmodell unter „Daten und Schnittstellen“
function specDiagrams(view){
  const head=re=>[...view.querySelectorAll('h3')].find(e=>re.test(e.textContent.trim()));
  const a=head(/^Kernabläufe/),fig=a&&diagramFigure('flow');if(fig)a.after(fig);
  const b=head(/^Daten und Schnittstellen/);if(b)for(const kind of ['data','structure']){const f=diagramFigure(kind);if(f)b.after(f)}
}
// Markdown zum Herunterladen: dieselben Schaubilder als Mermaid-Blöcke in ihren Kapiteln
function withDiagrams(md){
  const lines=md.split('\n'),put=(re,kinds)=>{const at=lines.findIndex(l=>re.test(l));if(at<0)return;const add=[];for(const kind of kinds){const m=diagModel(kind);if(m)add.push('','```mermaid',diagKinds[kind].mermaid(m),'```')}lines.splice(at+1,0,...add)};
  put(/^## Kernabläufe/,['flow']);put(/^## Daten und Schnittstellen/,['structure','data']);return lines.join('\n');
}
function markChanges(view,oldSpec,show){
  const box=node('div'),left=new Map(),hits=[];box.append(renderMarkdown(specOut(oldSpec),document));
  for(const e of box.querySelectorAll(unitSel)){const t=unitText(e);left.set(t,(left.get(t)||0)+1)}
  for(const e of view.querySelectorAll(unitSel)){const t=unitText(e),n=left.get(t)||0;if(n)left.set(t,n-1);else hits.push(e)}
  drawMarks(view,show?hits:[]);
  let gone=0;for(const n of left.values())gone+=n;
  return {hits,removed:Math.max(0,gone-hits.length)};
}
// Geänderte Stellen hinterlegen; steckt eine Stelle in einer anderen (verschachtelte Listenpunkte), wird nur die äußere hinterlegt
let markHits=[];
function drawMarks(view,hits){
  for(const e of view.querySelectorAll('.chg'))e.classList.remove('chg');
  markHits=hits;const set=new Set(hits);
  for(const e of hits){let p=e.parentElement,inner=false;while(p&&p!==view){if(set.has(p)){inner=true;break}p=p.parentElement}if(!inner)e.classList.add('chg')}
}

// Zusammenfassung: geänderte Stellen je Kapitel, jeweils mit dem Anfang des Textes; ein Klick springt dorthin
function changeSummary(view,hits){
  const set=new Set(hits.filter(e=>!hits.some(h=>h!==e&&e.contains(h)))),groups=[];let head=null,cur=null;
  for(const e of view.querySelectorAll('h2,h3,'+unitSel)){
    if(/^H[23]$/.test(e.tagName)){head=e;cur=null}
    if(set.has(e)){if(!cur){cur={head,items:[]};groups.push(cur)}cur.items.push(e)}
  }
  const go=e=>e.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const list=node('ul',undefined,'changesum');
  for(const g of groups){
    const li=node('li'),sub=node('ul'),title=button((g.head?g.head.textContent.trim():'Vor dem ersten Kapitel')+' · '+plural(g.items.length,'Stelle','Stellen'),'chapter',()=>go(g.head||g.items[0]));
    for(const e of g.items){const t=e.textContent.trim().replace(/\s+/g,' '),row=node('li');row.append(button('▸ '+(e===g.head?'Überschrift (neu oder geändert)':t.length>130?t.slice(0,130)+' …':t),'',()=>go(e)));sub.append(row)}
    li.append(title,sub);list.append(li);
  }
  return list;
}
function flash(){
  if(!change)return;
  // kein Zeitablauf mehr: Die Markierung endet mit der nächsten Änderung, mit „×“ oder mit „Rückgängig“
  change.until=Number.MAX_SAFE_INTEGER;change.scroll=true;
  specUI();
}
function undoChange(){
  if(!change||active)return;
  const p=change.prev;s.questions=p.questions;if(p.extras)s.extras=p.extras;if(p.features)s.features=p.features;if(p.featAgents)s.featAgents=p.featAgents;s.spec=p.spec;s.specSource=p.specSource;s.dirty=p.dirty;revision++;change=null;
  $('spec').value=s.spec;syncCat();if(s.active>=0)activate(s.active,false);renderAll();
}
function changeUI(view){
  const bar=$('changeBar');bar.classList.toggle('hidden',!view||!change);
  if(!view||!change)return;
  const m=markChanges(view,change.old,Date.now()<change.until),what=node('span',undefined,'what'),acts=node('div',undefined,'actions');
  what.append(node('b',change.title),' '+change.detail+' · '+(m.hits.length?plural(m.hits.length,'Stelle','Stellen')+' geändert':'keine sichtbare Änderung')+(m.removed?', '+m.removed+' entfernt':''));
  if(m.hits.length){const sum=button(change.sum?'▾ Zusammenfassung':'▸ Zusammenfassung','btn small',()=>{change.sum=!change.sum;specUI()});sum.setAttribute('aria-expanded',String(!!change.sum));acts.append(sum,button('◎ Stellen zeigen','btn small',flash))}
  const close=button('× Markierung beenden','btn small',()=>{change=null;renderAll()});close.setAttribute('aria-label','Markierung der geänderten Stellen beenden');
  acts.append(button('↶ Rückgängig','btn small',undoChange),close);bar.replaceChildren(what,acts);
  if(change.sum&&m.hits.length)bar.append(changeSummary(view,m.hits));
  if(change.scroll&&m.hits[0]){
    change.scroll=false;const r=m.hits[0].getBoundingClientRect();
    if(r.top<150||r.bottom>innerHeight-24)m.hits[0].scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
}
$('acceptAll').onclick=acceptAll;
$('extraOpen').onclick=()=>{$('extraForm').classList.toggle('hidden');$('extraInput').focus()};
function addExtra(){const v=$('extraInput').value.trim();if(!v||s.extras.length>=10)return;s.extras.push(v.slice(0,500));$('extraInput').value='';touched();renderAll()}
$('extraAdd').onclick=addExtra;
$('extraInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();addExtra()}};
// Vor dem Konzept müssen alle Entscheidungen getroffen sein. Sind welche offen, fragt SpecIt nach: Die KI trifft sie
// (vorgeschlagener Standard, als Annahme gekennzeichnet) – oder der Nutzer bricht ab und sieht rot markiert, wo etwas fehlt.
let needMark=false,askNext=null;
// Umfang zuerst: Features und Zielzeit stehen fest, bevor die Spezifikation geschrieben wird – sonst entstünde ein
// Konzept, das nicht in die Zielzeit passt und noch einmal geschrieben werden müsste.
let askKind='';
const scopeBasis=()=>digest(s.idea+'\n'+JSON.stringify(s.questions.map(q=>[q.state,q.choice,q.custom]))+'\n'+JSON.stringify(s.extras));
const overTarget=()=>{const t=targetMinutes();return !!t&&s.features.length>0&&featDuration().total>t};
function ensureFits(next){
  if(!overTarget()){next();return}
  askNext=next;askKind='fit';
  $('askTitle').textContent='Der Umfang passt nicht in die Zielzeit';
  $('askText').textContent='Die gewählten Features brauchen '+hm(featDuration().total)+', die Zielvorgabe ist '+hm(targetMinutes())+'. Eine Spezifikation für diesen Umfang müsste später gekürzt und neu geschrieben werden. Besser zuerst unter „Features“ den Vorschlag für die Zielzeit übernehmen, Erweiterungen abwählen oder die Zielvorgabe ändern.';
  $('askYes').textContent='Trotzdem für diesen Umfang erstellen';
  if(!$('askBox').open)$('askBox').showModal();
}
// write=false: nur den Umfang (Features, Namen) vorbereiten – die Spezifikation selbst entsteht nie ohne Klick
// Kurze Meldung über der Fußleiste – dort, wo gerade geklickt wurde. Die Meldung am Ideenfeld steht oft außerhalb des Sichtbaren.
let flashTimer=0;
function flashNote(text){const t=$('toast');clearTimeout(flashTimer);t.replaceChildren(node('span',text));t.classList.remove('hidden');flashTimer=setTimeout(()=>t.classList.add('hidden'),7000)}
async function startSpec(write=true){
  if(active)return;
  if(!s.idea.trim()){generate();return}
  const basis=scopeBasis();
  // Bei einer kapitelweisen Aktualisierung bleibt der festgelegte Umfang stehen; er wird nur für eine neue Spezifikation neu ermittelt
  if(!s.features.length||(s.featBasis!==basis&&(s.dirty||!s.spec.trim())&&!(s.spec.trim()&&s.dirty&&specChanges()))){
    await deriveFeatures(true);
    if(!s.features.length)return;
    s.featBasis=basis;save();
    if(overTarget())await proposeFit();
    await deriveNames(false);
    if(overTarget()||fitProposal){renderAll();specNote('Features und Zielzeit links prüfen, dann „Spezifikation erstellen“.');return}
  }
  if(!write){renderAll();if(!s.spec.trim())specNote('Features links prüfen, dann „Spezifikation erstellen“.');return}
  ensureFits(generate);
}
function ensureDecided(next){
  const open=s.questions.filter(q=>q.state==='open').length;
  if(!open){needMark=false;next();return}
  askNext=next;
  $('askTitle').textContent=plural(open,'Entscheidung ist','Entscheidungen sind')+' noch offen';
  $('askText').textContent='Um das Konzept erstellen zu können, werden die noch offenen Entscheidungen von '+($('ai').checked?'Claude':'SpecIt')+' getroffen: jeweils der vorgeschlagene Standard, als Annahme gekennzeichnet und später änderbar.';
  $('askYes').textContent='✓ '+(open===1?'Die offene Entscheidung treffen lassen':'Alle '+open+' treffen lassen')+' und Konzept erstellen';
  if(!$('askBox').open)$('askBox').showModal();
}
$('askYes').onclick=()=>{
  if(askKind==='fit'){askKind='';$('askBox').close();const go=askNext;askNext=null;if(go)go();return}
  $('askBox').close();needMark=false;
  s.questions=s.questions.map(q=>q.state==='open'?{...acceptDefault(q),auto:true}:q);s.last=-1;touched();activate(-1,false);
  const next=askNext;askNext=null;renderAll();if(next)next();
};
function declineAsk(){
  if(askKind==='fit'){askKind='';if($('askBox').open)$('askBox').close();askNext=null;$('featPanel').open=true;renderAll();$('featPanel').scrollIntoView({block:'center'});return}
  if($('askBox').open)$('askBox').close();askNext=null;needMark=true;
  // Dorthin, wo die Angaben fehlen: die Fragenliste, bei der Spezifikation das Feld „Entscheidungen“
  const here=inQuestions();
  if(!here){$('decPanel').open=true;s.questions.forEach(q=>{if(q.state==='open')catGroups.add('o'+q.topic)})}
  if(here&&(s.active<0||s.questions[s.active]?.state!=='open'))activate(firstOpen(),false);
  renderAll();
  (!here?$('decPanel'):document.querySelector('#questions .need'))?.scrollIntoView({block:'center'});
}
$('askNo').onclick=declineAsk;
$('askBox').addEventListener('cancel',e=>{e.preventDefault();declineAsk()});
document.addEventListener('keydown',e=>{
  // Esc klappt die geöffnete Frage wieder ein – in der Fragenliste links wie im Feld „Entscheidungen“
  if(e.key==='Escape'&&s.active>=0&&!e.defaultPrevented&&!document.querySelector('dialog[open]')&&(e.target instanceof Element)&&(e.target===document.body||e.target.closest('#questions'))){activate(-1,false);questionsUI();return}
  if(!inQuestions()||s.active<0||e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented)return;
  const t=e.target instanceof Element?e.target:document.body,q=s.questions[s.active],typing=t.matches('input,textarea,select');
  if(e.key==='Enter'){
    if(t.id!=='customAnswer'&&(typing||(t.matches('button,a')&&!t.classList.contains('opt'))))return;
    e.preventDefault();confirmAnswer();return;
  }
  if(typing)return;
  const n=Number(e.key);
  if(Number.isInteger(n)&&n>=1&&n<=q.options.length){e.preventDefault();choose(n-1)}
});

/* ---------- Status ---------- */
// Kennungen wie FR-001 oder AK-012 werden nie am Bindestrich umbrochen; kurze Tabellenzellen bleiben einzeilig.
// Der Text selbst bleibt unverändert (nur eine Hülle um die Kennung), damit Vergleich und Kopieren nicht leiden.
function keepIds(root){
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let t;while((t=walk.nextNode()))if(/[A-Za-zÄÖÜ]{1,6}-\d{1,5}/.test(t.nodeValue)&&!t.parentElement.closest('pre,code,.nb'))nodes.push(t);
  for(const n of nodes){
    const frag=document.createDocumentFragment();let last=0;const re=/[A-Za-zÄÖÜ]{1,6}-\d{1,5}(?:\.\d+)*/g;let m;
    while((m=re.exec(n.nodeValue))){if(m.index>last)frag.append(n.nodeValue.slice(last,m.index));const sp=document.createElement('span');sp.className='nb';sp.textContent=m[0];frag.append(sp);last=re.lastIndex}
    if(last<n.nodeValue.length)frag.append(n.nodeValue.slice(last));n.replaceWith(frag);
  }
  for(const c of root.querySelectorAll('td,th'))if(c.textContent.trim().length<=18)c.style.whiteSpace='nowrap';
}
/* ---------- Ansicht der Spezifikation in Kapiteln ---------- */
// (Der Renderer setzt Überschriften eine Ebene tiefer: Kapitel „##“ sind im Dokument H3.)
// Das Dokument bleibt ein Stück Markdown; für die Ansicht wird nur ausgeblendet, was nicht zum gewählten Kapitel gehört.
// „Überblick“ zeigt die Kennzahlen und das Ziel, „Ganzes Dokument“ alles am Stück (so wird auch gedruckt).
const fixedChapters=new Set(['Rahmen','Umfang','Nichtfunktionale Standards','Betrieb und Übergabe','Standard-Risiken','Entscheidungen und Annahmen','Offene Entscheidungen','Abnahme']);
let specChapter='Überblick';const reqOpen=new Set(),specFresh=new Set();
// „Ganzes Dokument“ zeigt alles aufgeklappt; was dort einzeln zugeklappt wird, merkt sich reqShut (bis zum nächsten Aufruf)
const reqShut=new Set(),reqWhole=()=>specChapter==='Alles',reqIsOpen=id=>reqWhole()?!reqShut.has(id):reqOpen.has(id);
const reqSet=(id,open)=>{const set=reqWhole()?reqShut:reqOpen,add=reqWhole()?!open:open;if(add)set.add(id);else set.delete(id)};
function chaptersUI(view){
  const rail=$('specRail'),chapters=[];let cur=null,lastIntro=null;
  for(const el of [...view.children]){
    if(el.tagName==='H3'){cur={title:el.textContent.trim(),els:[el]};chapters.push(cur)}else if(cur)cur.els.push(el);else lastIntro=el;
  }
  const list=chapters.filter(c=>!/^Inhaltsverzeichnis$/i.test(c.title));
  // Kurze oder ungegliederte Dokumente bleiben, wie sie sind
  if(list.length<4){rail.classList.add('hidden');return}
  // Nach einer Änderung steht das ganze Dokument da, damit jede markierte Stelle zu sehen ist
  const all=!!change||specChapter==='Alles';
  if(!all&&specChapter!=='Überblick'&&!list.some(c=>c.title===specChapter))specChapter='Überblick';
  const overview=!all&&specChapter==='Überblick',go=title=>{specChapter=title;if(title==='Alles')reqShut.clear();specFresh.delete(title);specUI();$('specView').closest('.specwrap').scrollIntoView({block:'start'})};
  for(const c of chapters)for(const el of c.els)el.classList.toggle('chap-hidden',!list.includes(c)||!(all||c.title===specChapter||(overview&&!conceptLive()&&/^Ziel/i.test(c.title))));
  // Kennzahlen des Überblicks; jede führt in ihr Kapitel
  if(overview){
    const ids=[...new Set(s.spec.match(/\b(?:FR|NFR)-\d{3}\b/g)||[])],fr=ids.filter(x=>x.startsWith('FR')).length,sum=summary(s.questions),feats=s.features.filter(f=>f.on);
    const box=node('div',undefined,'specsum'),find=re=>(list.find(c=>re.test(c.title))||{}).title;
    // Vier Karten mit Schaubild statt vieler Zahlenkacheln; jede führt in ihr Kapitel. fill() zeichnet den Inhalt (auch später neu).
    const card=(label,target,fill)=>{const b=node('button');b.type='button';b._fill=()=>{b.replaceChildren(node('span',label,'eyebrow'));b.classList.remove('warn');fill(b)};b._fill();if(target)b.onclick=()=>go(target);else b.disabled=true;box.append(b);return b};
    const big=(b,n,unit)=>{const l=node('div',undefined,'sumline');l.append(node('b',String(n)),node('span',unit));b.append(l)};
    // Balken aus Anteilen: [Klasse, Wert, Beschriftung]; leere Anteile fallen weg
    const parts=(b,list,span,goal)=>{
      const bar=node('div',undefined,'sumbar'),cap=node('div',undefined,'sumcap'),total=span||list.reduce((n,x)=>n+x[1],0)||1;
      for(const [cls,v,text] of list){if(v>0){const e=node('i',undefined,cls);e.style.width=(v/total*100)+'%';bar.append(e)}const k=node('span');k.append(node('i',undefined,cls),text);cap.append(k)}
      if(goal){const g=node('i',undefined,'goal');g.style.left=Math.min(100,goal/total*100)+'%';bar.append(g)}
      b.append(bar,cap);
    };
    if(feats.length){
      // Zeit: geschätzte Dauer der gewählten Features auf dem Weg zur Zielvorgabe – was rechts frei bleibt, ist freie Zeit
      card('Entwicklungsdauer',find(/^Umfang/),b=>{
        const fd=featDuration(),tm=targetMinutes(),on=s.features.filter(x=>x.on),base=Math.min(fd.total,featureDuration(s.features.map(x=>({...x,on:x.core})),fd.agents)),over=!!tm&&fd.total>tm;
        big(b,hm(fd.total),tm?'von '+hm(tm):'geschätzt');b.classList.toggle('warn',over);
        parts(b,[['base',base,'Basis '+hm(base)],['ext',fd.total-base,'Erweiterungen '+hm(fd.total-base)],...(tm?[[over?'over':'free',0,over?hm(fd.total-tm)+' über dem Ziel':hm(tm-fd.total)+' frei']]:[])],Math.max(fd.total,tm,0.01),tm);
        b.title='Geschätzte Entwicklungsdauer der '+on.length+' gewählten Features mit '+(fd.agents===1?'einem Agenten':fd.agents+' parallelen Agenten')+(tm?' · Zielvorgabe '+hm(tm):'');
      }).id='estTile';
      // Umfang: ein Punkt je Feature – Basis kräftig, Erweiterung heller, Abgewähltes nur als Umriss
      card('Features',find(/^Umfang/),b=>{
        const all=s.features,core=all.filter(x=>x.core).length,ext=all.filter(x=>!x.core&&x.on).length,off=all.length-core-ext,dots=node('div',undefined,'sumdots'),cap=node('div',undefined,'sumcap');
        big(b,core+ext,core+ext===1?'Feature':'Features');
        for(const x of all){const d=node('i',undefined,x.core?'base':x.on?'ext':'off');d.title=x.name;dots.append(d)}
        const key=(cls,text)=>{const k=node('span');k.append(node('i',undefined,cls),text);cap.append(k)};key('base',core+' Basis');key('ext',ext+(ext===1?' Erweiterung':' Erweiterungen'));if(off)key('off',off+' abgewählt');
        b.append(dots,cap);
      }).id='featTile';
    }
    card('Anforderungen',find(/^Funktionale Anforderungen/),b=>{big(b,ids.length,ids.length===1?'Anforderung':'Anforderungen');parts(b,[['base',fr,fr+' funktional'],['ext',ids.length-fr,(ids.length-fr)+' nichtfunktional']])});
    card('Entscheidungen',find(sum.open?/^Offene Entscheidungen/:/^Entscheidungen/)||find(/^Entscheidungen/),b=>{
      const own=sum.decided+s.extras.length,n=own+sum.defaults+sum.open;big(b,n,n===1?'Entscheidung':'Entscheidungen');b.classList.toggle('warn',sum.open>0);
      parts(b,[['base',own,own+' selbst festgelegt'],['ext',sum.defaults,sum.defaults+(sum.defaults===1?' Annahme':' Annahmen')],['over',sum.open,sum.open+' offen']]);
    });
    {const all=button(words(s.spec).toLocaleString('de-DE')+' Wörter · ganzes Dokument zeigen','link sumall',()=>go('Alles'));box.append(all)}
    (lastIntro||view.firstElementChild).after(box);
    // Im Überblick steht kein Schaubild; die Schaubilder stehen in ihren Kapiteln
    // Kurzfassung: die Szene aus dem Grobentwurf
    if(conceptLive()){
      const head=node('h3','Kurzfassung'),short=node('div',undefined,'concept inspec'),drift=conceptMarks(s.concept.text).filter(m=>s.conceptAnswers[m.q]&&s.conceptAnswers[m.q]!==m.first).length;
      box.after(head,short);{const tx=s.concept.text;let cut=0;for(let n=0;n<3;n++){const at=tx.indexOf('\n## ',cut+3);if(at<0){cut=-1;break}cut=at}conceptRender(cut>0?tx.slice(0,cut):tx,false,null,short)}
      head.append(' ',node('span',plural(conceptMarks(s.concept.text).filter(m=>!s.conceptAnswers[m.q]).length,'Annahme','Annahmen')+' · anklicken, um selbst zu entscheiden'+(drift?' · '+plural(drift,'Festlegung weicht','Festlegungen weichen')+' vom Text ab':''),'meta'));
    }
  }
  // Anforderungen aufklappbar: Kennung und Titel stehen da, Einzelheiten und Abnahme auf Klick
  for(const c of list){
    if(!/Anforderungen|Standards/i.test(c.title)||!(all||c.title===specChapter))continue;
    const hasId=el=>/\b(?:FR|NFR)-\d{3}\b/.test(el.textContent),heads=c.els.filter(el=>/^H[45]$/.test(el.tagName)&&hasId(el)),items=[];
    if(heads.length){
      let open=false;
      for(const el of c.els.slice(1)){
        if(heads.includes(el)){const id=el.textContent.match(/\b(?:FR|NFR)-\d{3}\b/)[0];open=!!change||reqIsOpen(id);el.classList.add('reqhead');el.classList.toggle('open',open);el.tabIndex=0;el.setAttribute('role','button');
          const flip=()=>{reqSet(id,!reqIsOpen(id));specUI()};el.onclick=flip;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip()}};items.push(id)}
        else if(items.length&&!/^H[34]$/.test(el.tagName)){el.classList.add('reqbody');el.classList.toggle('shut',!open)}
      }
    }else for(const li of c.els.flatMap(el=>el.tagName==='UL'?[...el.children]:el.tagName==='P'?[el]:[])){
      const strong=li.firstElementChild&&li.firstElementChild.tagName==='STRONG'?li.firstElementChild:null;if(!strong||!hasId(strong))continue;
      const id=strong.textContent.match(/\b(?:FR|NFR)-\d{3}\b/)[0],d=node('details',undefined,'req'),sm=node('summary'),body=node('div');
      strong.remove();sm.append(...strong.childNodes);body.append(...li.childNodes);
      // Der Gedankenstrich hinter dem Titel gehört nicht in den aufgeklappten Text
      if(body.firstChild&&body.firstChild.nodeType===3)body.firstChild.nodeValue=body.firstChild.nodeValue.replace(/^\s*[–·-]\s*/,'');
      d.open=!!change||reqIsOpen(id);d.ontoggle=()=>reqSet(id,d.open);d.append(sm,body);li.classList.add('req');li.append(d);items.push(id);
      if(li.tagName==='P'){let nx;while((nx=li.nextElementSibling)&&!/^H[3-6]$/.test(nx.tagName)&&!(nx.tagName==='P'&&nx.firstElementChild&&nx.firstElementChild.tagName==='STRONG')&&!nx.classList.contains('reqtools'))body.append(nx)}
    }
    if(items.length>1&&!change){
      const bar=node('div',undefined,'reqtools'),allOpen=items.every(reqIsOpen);
      bar.append(button(allOpen?'Alle zuklappen':'Alle aufklappen','link',()=>{for(const id of items)reqSet(id,!allOpen);specUI()}));c.els[0].after(bar);
    }
  }
  // Kapitelliste
  rail.classList.remove('hidden');rail.replaceChildren();
  const entry=(title,label,extra,cls)=>{const b=node('button',undefined,cls||'');b.type='button';b.append(node('span',label));if(extra)b.append(node('span',extra,'n'));b.setAttribute('aria-current',String(all?title==='Alles':title===specChapter));b.onclick=()=>go(title);rail.append(b)};
  entry('Überblick','Überblick');rail.append(node('div',undefined,'sep'));
  for(const c of list){
    const n=new Set(c.els.map(el=>el.textContent).join(' ').match(/\b(?:FR|NFR)-\d{3}\b/g)||[]).size;
    entry(c.title,c.title,specFresh.has(c.title)&&c.title!==specChapter?'neu':/Anforderungen|Standards/i.test(c.title)&&n?String(n):'',(fixedChapters.has(c.title)?'fixed':'')+(specFresh.has(c.title)?' fresh':''));
  }
  rail.append(node('div',undefined,'sep'));entry('Alles','Ganzes Dokument');
  rail.title='▪ = Baustein von SpecIt (ohne KI zusammengesetzt)';
}
function specUI(){
  const qaPane=$('qaPane');
  {
    // Dieselbe Fragenliste an zwei Orten: links anstelle des Dokuments, solange es keines gibt; danach im Feld „Entscheidungen“
    const qa=false,inDec=s.questions.length>0,home=$('decQa');
    if(qaPane.parentElement!==home)home.append(qaPane);
    qaPane.classList.toggle('hidden',!(qa||inDec));document.body.classList.toggle('qa',qa);document.body.classList.toggle('decqa',inDec);
    $('decDerive').classList.toggle('hidden',!(inDec&&$('ai').checked));$('decDerive').disabled=active;
  }
  const edit=specMode==='edit';
  $('modeView').setAttribute('aria-pressed',String(!edit));$('modeEdit').setAttribute('aria-pressed',String(edit));
  $('spec').classList.toggle('hidden',!edit);$('specView').classList.toggle('hidden',edit);
  if(change&&(change.ids.some(i=>!s.questions[i])||!s.spec.trim()))change=null;
  if(edit){$('specRail').classList.add('hidden');changeUI(null);return}
  const view=$('specView');
  const live=typeof streamText==='string';view.classList.toggle('writing',live);
  if(live){
    if(streamText.trim()){view.replaceChildren(renderMarkdown(streamText,document));specLogo(view);keepIds(view);view.lastElementChild?.scrollIntoView({block:'nearest'})}
    else view.replaceChildren(node('p',$('ai').checked?'Claude beginnt zu schreiben …':'Spezifikation wird zusammengeführt …','placeholder'));
    {const rail=$('specRail'),hs=[...view.querySelectorAll('h3')];rail.classList.remove('hidden');rail.replaceChildren(node('span','Wird geschrieben','eyebrow'));
     hs.forEach((h,i)=>{const b=node('button');b.type='button';b.append(node('span',h.textContent.trim()));b.setAttribute('aria-current',String(i===hs.length-1));b.onclick=()=>h.scrollIntoView({block:'start'});rail.append(b)});
     if(!hs.length)rail.append(node('p','Die Kapitel erscheinen, sobald sie entstehen.','meta railnote'))}
    changeUI(null);return;
  }
  $('specRail').classList.add('hidden');
  if(s.spec.trim()){view.replaceChildren(renderMarkdown(specOut(s.spec),document));specLogo(view);keepIds(view);specDiagrams(view);chaptersUI(view);
    // Fehlt das Schaubild zum aktuellen Stand, wird es im Hintergrund abgeleitet (einmal je Stand)
    if(!s.dirty&&!active)setTimeout(()=>{deriveDiagram('flow',false);deriveDiagram('arch',false)},0)}
  else view.replaceChildren(node('p',s.features.length?'Die Features stehen links. Auswahl und Zielzeit prüfen, dann „Spezifikation erstellen“.':'Noch keine Spezifikation. „Spezifikation erstellen“ wählen oder über „Bearbeiten“ eine vorhandene Spezifikation einfügen.','placeholder'));
  changeUI(view);
}
function setSpecMode(mode,focus){specMode=mode;specUI();if(mode==='view')ensureFeatures();if(focus)(mode==='edit'?$('spec'):$('modeEdit')).focus()}
$('modeView').onclick=()=>setSpecMode('view');
$('modeEdit').onclick=()=>setSpecMode('edit',true);
function statuses(){
  // Stand, auf dem die Spezifikation beruht: wird mitgeführt, solange sie aktuell ist, und dient danach als Vergleich
  if(s.spec&&!s.dirty)s.specBasis=basisNow();
  if(s.spec&&s.dirty){
    // Ein schmaler Hinweis in der Leiste; aktualisiert wird mit dem Knopf links, der dafür grün wird
    const why=dirtyWhy(),more=why.length?'Geändert seit ihrem Stand: '+why.join(' · ')+'.':'Seit ihrem Stand haben sich Eingaben geändert.';
    $('specStatus').replaceChildren(node('b','⚠ Nicht mehr aktuell'),why.length?' · geändert: '+why.join(' · '):'');
    $('specStatus').title='Die Spezifikation ist nicht mehr aktuell. '+more+' „Spezifikation aktualisieren“ (links) arbeitet die Änderungen ein.';
  }else{$('specStatus').textContent='';$('specStatus').title=''}
  $('specStatus').className=s.spec&&s.dirty?'status stalehint':'status';
  $('specCount').textContent=s.spec.length>120000?s.spec.length.toLocaleString('de-DE')+' / 150.000 Zeichen':'';
  $('specDownload').disabled=!s.spec;$('specPdf').disabled=!s.spec;
  if(specMode==='view')specUI();
  planUI();layoutNote();stageUI();
}
// Welche Stufen ('S0' …) und Aufträge ('T01' …, 'Gesamt') aufgeklappt sind – bleibt über das Neuzeichnen hinweg erhalten
const planOpen=new Set();
// Auftrag zugeklappt = nur die Kopfzeile; ein Klick darauf (oder Enter/Leertaste) zeigt Ziel, vollen Auftrag und Knöpfe
function foldTask(box,head,key){
  const set=()=>{const open=planOpen.has(key);box.classList.toggle('closed',!open);head.setAttribute('aria-expanded',String(open))};
  const flip=()=>{planOpen.has(key)?planOpen.delete(key):planOpen.add(key);set()};
  head.tabIndex=0;head.setAttribute('role','button');head.classList.add('fold');head.onclick=flip;
  head.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip()}};set();
}
function planUI(){
  const p=s.plan,old=!!stale();
  for(const id of ['json','backlog','copyAll'])$(id).disabled=!p||old;
  $('planStale').classList.toggle('hidden',!old);$('plan').classList.toggle('nudge',old&&!active);
  // Auftragsform: ein Gesamtauftrag für einen Agenten oder mehrere einzeln delegierbare Teilaufträge – aus demselben Plan
  // Sperre: Solange Fragen oder Entscheidungen offen sind oder die Spezifikation fehlt bzw. nicht aktuell ist,
  // gibt es keine Aufträge. Offenes muss beantwortet oder ausdrücklich an SpecIt abgegeben werden.
  const openCount=s.questions.filter(q=>q.state==='open').length,gate=openCount?'open':!s.spec.trim()?'none':s.dirty?'dirty':s.features.some(f=>f.on!==f.inSpec)?'features':'';
  $('planGate').classList.toggle('hidden',!gate);
  for(const id of ['planConfig','planStatus','planOutput','nextCard','reviewCard'])$(id).classList.toggle('hidden',!!gate);
  if(gate){
    $('planStale').classList.add('hidden');
    const acts=$('gateActions');acts.replaceChildren();
    if(gate==='open'){
      $('gateTitle').textContent='Das Konzept ist noch nicht vollständig';
      $('gateText').textContent=plural(openCount,'Frage oder Entscheidung ist','Fragen oder Entscheidungen sind')+' noch offen. Aufträge aus einem unfertigen Konzept führen zu Rückfragen und blockierten Aufgaben. Entscheide sie selbst oder bestätige, dass SpecIt sie für dich trifft (jeweils der vorgeschlagene Standard, als Annahme gekennzeichnet).';
      const all=button('Alle '+openCount+' automatisch entscheiden lassen','btn primary',async()=>{await decideOpen(false);if(s.spec.trim()&&s.dirty)await generate();renderAll()}),minor=button('Nur die unwichtigen automatisch','btn',async()=>{await decideOpen(true);renderAll()});
      all.disabled=minor.disabled=active;
      acts.append(all,minor,button('Selbst entscheiden →','btn',()=>setPhase(2)));
    }else if(gate==='features'){
      $('gateTitle').textContent='Die Feature-Auswahl ist noch nicht übernommen';
      $('gateText').textContent='Du hast Features an- oder abgewählt, die Spezifikation enthält die Änderung aber noch nicht. Übernimm die Auswahl, bevor daraus Aufträge werden.';
      const take=button('✓ Auswahl in die Spezifikation übernehmen','btn primary',async()=>{await applyScope();renderAll()});take.disabled=active;
      acts.append(take,button('Spezifikation ansehen','btn',()=>setPhase(2)));
    }else{
      $('gateTitle').textContent=gate==='none'?'Es gibt noch keine Spezifikation':'Die Spezifikation ist nicht mehr aktuell';
      $('gateText').textContent=gate==='none'?'Aufträge entstehen aus der Spezifikation. Erstelle sie zuerst.':'Seit dem Erzeugen haben sich Eingaben oder Antworten geändert. Aktualisiere die Spezifikation, bevor daraus Aufträge werden.';
      const make=button(gate==='none'?'Spezifikation erstellen':'Spezifikation aktualisieren','btn primary',()=>{setPhase(2);startSpec()});make.disabled=active;
      acts.append(make,button('Spezifikation ansehen','btn',()=>setPhase(2)));
    }
    return;
  }
  // Das Konzept ist abgeschlossen: gewünschte Layout-Entwürfe jetzt einmal von selbst anstoßen
  if(s.spec.trim()&&!s.dirty)autoLayouts();
  // 1) Abarbeitung: nacheinander durch einen Agenten (ein Gesamtauftrag) oder parallel durch mehrere (Teilaufträge).
  // Die Agentenzahl ist dieselbe wie bei der Feature-Auswahl und wird von dort übernommen.
  const agents=agentsNow(),single=agents===1,direct=s.nextStep==='run',max=planMax(),current=p&&!old?p:null;
  $('formSingle').setAttribute('aria-pressed',String(single));$('formSplit').setAttribute('aria-pressed',String(!single));$('formSplit').disabled=max<2;
  $('formHint').textContent='Übernommen aus der Feature-Auswahl: '+(single?'ein Agent, der nacheinander arbeitet.':agents+' Agenten, die parallel arbeiten.')+' Hier änderbar; die Wahl gilt dann auch dort.';
  $('agentNote').textContent=max<2?'Die Aufträge bauen aufeinander auf; es kann nur nacheinander gearbeitet werden.':'Höchstens '+max+': So viele Aufträge stehen '+(current?'laut Plan':'laut Feature-Struktur')+' gleichzeitig bereit. 1 bedeutet: ein Agent arbeitet nacheinander.';
  $('agentPick').replaceChildren(agentSlider(agents,max,n=>{s.featAgents=n;renderAll()}));
  adviceUI(current,agents);
  $('plan').textContent=current?'↻ Plan neu erstellen':'⚙ Plan erstellen';$('plan').classList.toggle('primary',!current);
  // 2) Weiteres Vorgehen: bereitstellen oder direkt umsetzen
  $('nextDownload').setAttribute('aria-pressed',String(!direct));$('nextRun').setAttribute('aria-pressed',String(direct));
  $('nextRun').disabled=!agentsOk;$('nextRun').title=agentsOk?'':'Claude Code wurde auf diesem Rechner nicht gefunden.';
  $('runPanel').classList.toggle('hidden',!direct);
  if($('runDir').value!==s.runDir)$('runDir').value=s.runDir;$('runShell').checked=s.runShell;
  for(const id of ['runDir','runShell','nextDownload','nextRun','formSingle'])if(runBusy)$(id).disabled=true;else if(id!=='nextRun')$(id).disabled=false;
  $('backlog').textContent=single?'↓ AUFTRAG.md':'↓ BACKLOG.md';$('copyAll').textContent=single?'⧉ Auftrag kopieren':'⧉ Alle kopieren';
  $('planStatus').textContent=p?(s.planSource==='claude'?'Claude-Plan':'DEMO: generisches Arbeitsgerüst')+' · '+(single?'1 Gesamtauftrag mit '+plural(p.tasks.length,'Arbeitsschritt','Arbeitsschritten'):p.tasks.length+' Teilaufträge · '+p.waves.length+' Abhängigkeitsstufen')+(p.blocked.length?' · '+p.blocked.length+' durch Entscheidungen blockiert':''):'';
  // 3) Übersicht und Abschluss
  reviewUI(current,agents);
  const out=$('planOutput');out.replaceChildren();if(!p)return;
  const facts=node('div',undefined,'planfacts'),sumBox=node('details',undefined,'nested');
  sumBox.append(node('summary','Zusammenfassung des Plans'),node('p',p.summary,'muted'));facts.append(sumBox);
  // Nachverfolgung: Trägt die Spezifikation Anforderungs-IDs (FR-/NFR-), wird geprüft, ob jede einem Auftrag zugeordnet ist.
  const tr=s.planTrace;
  if(tr&&tr.ids){
    const gaps=tr.missing.length||tr.unknown.length||tr.untraced.length,note=node('p',undefined,gaps?'banner':'meta');
    note.textContent=gaps?'Nachverfolgung unvollständig'+(tr.missing.length?' · ohne Auftrag: '+tr.missing.join(', '):'')+(tr.unknown.length?' · unbekannte Kennungen im Plan: '+tr.unknown.join(', '):'')+(tr.untraced.length?' · ohne Anforderungsbezug: '+tr.untraced.join(', '):'')+'. Plan bei Bedarf neu erstellen.'
      :'Nachverfolgung: alle '+tr.ids+' Anforderungen der Spezifikation sind einem Auftrag zugeordnet.';
    if(gaps)out.append(note);else sumBox.append(note);
  }
  out.append(facts);
  if(p.decisions.length){
    // Keine Rückfragen: Was die Spezifikation für die Umsetzung offen ließ, hat der Plan selbst festgelegt und hier ausgewiesen.
    const box=node('details',undefined,'nested'),ul=node('ul');ul.style.cssText='margin:8px 0 0;padding-left:20px;font-size:13px';
    box.append(node('summary','Festlegungen des Plans ('+p.decisions.length+')'),ul);box.title='Vom Plan entschieden – keine Rückfragen';
    for(const d of p.decisions)ul.append(node('li',d));facts.append(box);
  }
  if(single){
    const order=p.waves.flat().map(id=>p.tasks.find(t=>t.id===id)),box=node('article',undefined,'card task'),top=node('div',undefined,'taskhead'),main=node('div',undefined,'taskmain'),ol=node('ol'),details=node('details'),row=node('div',undefined,'taskacts'),text=()=>renderSingle(p,s.planSpec,exportCtx());
    top.append(node('span','Gesamtauftrag','id'),node('h3',plural(order.length,'Arbeitsschritt','Arbeitsschritte')+' für einen Agenten'));if(p.blocked.length)top.append(node('span','OFFENE ENTSCHEIDUNGEN','chip warn'));
    box.title='Die Schritte stehen in der Reihenfolge ihrer Abhängigkeiten in einem einzigen Prompt, Spezifikation und Regeln nur einmal.';
    for(const t of order){const li=node('li',t.title);li.title=t.goal;ol.append(li)}
    details.append(node('summary','Vollständiger Agent-Auftrag'));
    details.ontoggle=()=>{if(details.open&&!details.querySelector('pre'))details.append(node('pre',text()))};
    const copy=button('⧉ Prompt kopieren','btn small',()=>copyText(text(),$('planStatus'))),dl=button('↓ Markdown','btn small',()=>download('AUFTRAG.md',text()));
    copy.disabled=dl.disabled=old;row.append(copy,dl);
    main.append(top,ol,details);box.append(main,row);foldTask(box,top,'Gesamt');
    out.append(box);return;
  }
  const byId=new Map(p.tasks.map(t=>[t.id,t]));
  // Stufen und Aufträge sind im Standard zugeklappt; ein Knopf klappt alles auf einmal auf oder zu
  const keys=[...p.waves.map((w,i)=>'S'+i),...p.tasks.map(t=>t.id)],allOpen=keys.every(k=>planOpen.has(k));
  const all=button(allOpen?'▾ Alles zuklappen':'▸ Alles aufklappen','link',()=>{for(const k of keys)allOpen?planOpen.delete(k):planOpen.add(k);planUI()});all.classList.add('foldall');out.append(all);
  p.waves.forEach((w,i)=>{
    const wave=node('details',undefined,'wave'),head=node('summary',undefined,'wavehead'),grid=node('div',undefined,'wavegrid');
    wave.open=planOpen.has('S'+i);wave.ontoggle=()=>{wave.open?planOpen.add('S'+i):planOpen.delete('S'+i)};
    head.append(node('h2','Stufe '+(i+1)),node('span',plural(w.length,'Aufgabe','Aufgaben'),'chip'),node('span',w.map(id=>id+' '+byId.get(id).title).join(' · '),'peek'));head.title='Gleiche Stufe bedeutet nur potenziell parallel. Dateikonflikte und Schnittstellen vor Start prüfen.';wave.append(head,grid);
    for(const id of w){
      const t=byId.get(id),blocked=p.blocked.includes(t.id),box=node('article',undefined,'card task'),top=node('div',undefined,'taskhead'),main=node('div',undefined,'taskmain'),details=node('details'),row=node('div',undefined,'taskacts'),goal=node('p',t.goal,'muted');
      top.append(node('span',t.id,'id'),node('h3',t.title));if(blocked)top.append(node('span','BLOCKIERT','chip warn'));
      if(t.dependsOn.length){top.append(node('span','nach','meta'));for(const d of t.dependsOn)top.append(node('span',d,'chip'))}
      goal.title=t.goal;
      const text=()=>renderTask(t,p,s.planSpec,exportCtx());
      details.append(node('summary','Vollständiger Agent-Auftrag'));
      details.ontoggle=()=>{if(details.open&&!details.querySelector('pre'))details.append(node('pre',text()))};
      const copy=button('⧉ Prompt kopieren','btn small',()=>copyText(text(),$('planStatus'))),dl=button('↓ Markdown','btn small',()=>download(t.id+'.md',text()));
      copy.disabled=dl.disabled=old;row.append(copy,dl);main.append(top,goal,details);box.append(main,row);foldTask(box,top,t.id);grid.append(box);
    }
    out.append(wave);
  });
}

/* ---------- Server ---------- */
// Sperrt die Aktionen und zeigt unter der Kopfzeile, dass und woran gerade gearbeitet wird (mit laufender Sekundenanzeige),
// damit eine längere Claude-Anfrage nicht wie ein Hänger aussieht.
let workTimer=0,showTimer=0,workSince=0;
function working(text,since){
  const bar=$('working');clearInterval(workTimer);clearTimeout(showTimer);
  if(!text){bar.classList.add('hidden');document.title=pageTitle;return}
  // since: Beginn eines länger laufenden Vorgangs (Umsetzung durch Agenten); die Uhr läuft dann von dort weiter.
  const who=since||($('ai').checked&&!text.startsWith('Stitch'))?'Claude arbeitet':'SpecIt arbeitet';workSince=since||Date.now();
  $('workingText').textContent=who+' · '+text+' …';
  const tick=()=>{
    const sec=Math.round((Date.now()-workSince)/1000),hint=since?'Kann je nach Umfang lange dauern · Fenster geöffnet lassen':sec>=8?'Kann eine Minute oder länger dauern · Fenster geöffnet lassen':'Fenster geöffnet lassen';
    $('workingTime').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
    if($('workingHint').textContent!==hint)$('workingHint').textContent=hint;
  };
  // Erst nach einem Augenblick einblenden: Antworten ohne KI kommen sofort und sollen nicht aufblitzen.
  tick();workTimer=setInterval(tick,1000);showTimer=setTimeout(()=>{bar.classList.remove('hidden');document.title='⏳ '+who+' – '+pageTitle},250);
}
let currentLockId=0;
function lock(v,text,releaseId){
  // Späte finally-Blöcke dürfen einen nach Reset begonnenen neuen Vorgang nicht entsperren.
  if(!v&&releaseId!==undefined&&releaseId!==currentLockId)return currentLockId;
  if(v)currentLockId++;
  active=v;aborter=v?new AbortController():null;
  for(const id of ['derive','more','generate','plan'])$(id).disabled=v;
  reviewUI(s.plan&&!stale()?s.plan:null,agentsNow());navUI();working(v?text||'Anfrage läuft':'');
  if(!v&&runBusy)pollRun();
  return currentLockId;
}
// Schließen oder Neuladen während einer laufenden Anfrage nur nach Rückfrage des Browsers
$('workingStop').onclick=()=>{
  if(aborter)aborter.abort();else if(layoutAbort)layoutAbort.abort();else if(runBusy)$('runStop').click();
};
addEventListener('beforeunload',e=>{if(active||layoutBusy||runBusy)e.preventDefault()});
// Laufende Anfrage (aborter) bzw. laufende Layout-Erstellung (layoutAbort); „Abbrechen“ beendet sie.
let aborter=null,layoutAbort=null;
const aborted=e=>e&&e.name==='AbortError'?Error('Abgebrochen.'):e;
async function post(url,data,signal){
  const requestSignal=workSession.combine(signal||aborter?.signal);
  let r;try{r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:requestSignal})}catch(e){throw aborted(e)}
  const x=await r.json();
  if(requestSignal.aborted)throw Error('Abgebrochen.');
  if(!r.ok)throw Error(x.error||'Anfrage fehlgeschlagen.');
  if(x&&x.usage)addUsage(data&&data.mode,x.usage);
  return x;
}
const call=data=>post('/api/spec',data).finally(refreshModels);
// Antwort zeilenweise lesen (je Zeile ein JSON-Objekt) und jede Zeile sofort weiterreichen
async function stream(url,data,onRow){
  const requestSignal=workSession.combine(aborter?.signal);
  let r;
  try { r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:requestSignal}); }
  catch(e) { throw aborted(e); }
  if(!r.ok){const x=await r.json().catch(()=>({}));throw Error(x.error||'Anfrage fehlgeschlagen.');}
  try {
    await readNdjson(r.body,m=>{
      if(requestSignal.aborted)return;
      if(m.done&&m.usage)addUsage(data&&data.mode,m.usage);
      onRow(m);
    });
    if(requestSignal.aborted)throw Error('Abgebrochen.');
  } catch(e) { throw aborted(e); }
}

// Same complete payload is used for speculative preparation and the foreground run.
// This ensures that the server's request fingerprint never accepts stale input.
const preloadSession=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
let preloadIdle=0,preloadTask=null,preloadStatus={key:'',state:''};
function finalPayload(extra={}){
 return {mode:'final',strategy:s.specStrategy,...extra,minutes:targetMinutes(),
  ...(conceptPlain()?{concept:conceptPlain()}:{}),
  idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,
  features:s.features.filter(f=>f.on),ai:$('ai').checked,...frame(),
  ...(s.specStrategy==='preload'?{preloadToken:preloadSession}:{})};
}
function scheduleSpecPreload(){
 clearTimeout(preloadIdle);
 const eligible=s.specStrategy==='preload'&&available&&$('ai').checked&&!active&&wsOpen()
   &&s.idea.trim()&&s.features.length&&firstOpen()<0&&(!s.spec.trim()||s.dirty);
 if(!eligible){
  if(preloadTask&&!active){preloadTask.ac.abort();preloadTask=null}
  return;
 }
 const payload=finalPayload(),key=JSON.stringify(payload);
 if(preloadTask?.key===key)return;
 if(preloadTask){preloadTask.ac.abort();preloadTask=null}
 if(preloadStatus.key===key&&preloadStatus.state==='error')return;
 if(preloadStatus.key===key&&preloadStatus.state==='ready'&&Date.now()-preloadStatus.when<120000)return;
 preloadIdle=setTimeout(()=>runSpecPreload(payload,key),1400);
}
async function runSpecPreload(payload,key){
 if(active||s.specStrategy!=='preload'||key!==JSON.stringify(finalPayload()))return;
 const ac=new AbortController(),task={ac,key};preloadTask=task;
 preloadStatus={key,state:'loading',when:Date.now()};strategyUI();
 try{
  const response=await fetch('/api/spec/preload',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:ac.signal});
  if(!response.ok)throw Error('Vorbereitung: HTTP '+response.status);
  const result=await response.json();
  if(!result.ready)throw Error('Vorbereitung nicht vollständig.');
  if(preloadTask===task){preloadStatus={key,state:'ready',when:Date.now()};strategyUI()}
 }catch(e){
  if(preloadTask===task&&!ac.signal.aborted){preloadStatus={key,state:'error',when:Date.now()};strategyUI()}
 }finally{if(preloadTask===task)preloadTask=null}
}
async function generate(){
  if(active)return;
  const note=t=>{$('specStatus').className='status';$('specStatus').textContent=t};
  if(!s.idea.trim()){note('Bitte zuerst eine Idee eingeben oder eine Spezifikation einfügen.');return}
  // Gibt es schon eine Spezifikation und ist klar, was sich geändert hat, werden nur die betroffenen Kapitel neu geschrieben
  const changes=s.specStrategy==='incremental'&&s.spec.trim()&&s.dirty?specChanges():null,partial=!!changes;
  const generatedAt=performance.now();
   const rev=revision;const lockId=lock(true,'Spezifikation wird ausgearbeitet');note(partial?'Geänderte Kapitel werden neu geschrieben …':'Spezifikation wird erstellt …');
  let message='',done=null;
  try{
    // Die Antwort kommt als Strom und wird beim Entstehen angezeigt
    let r=null;streamText='';specMode='view';specUI();statuses();
    await stream('/api/spec/stream',finalPayload(partial?{update:true,spec:s.spec,changes}:{}),m=>{
      if(typeof m.t==='string'){streamText+=m.t;const now=performance.now();if(now-paintAt>180){paintAt=now;specUI();$('specCount').textContent=streamText.length.toLocaleString('de-DE')+' Zeichen …'}}
      else if(m.error)throw Error(m.error);else if(m.done)r=m;
    });
    if(!r||typeof r.markdown!=='string')throw Error('Die Antwort ist unvollständig angekommen. Bitte erneut versuchen.');
    if(rev!==revision)message='Eingaben geändert. Erneut starten.';
    else{s.spec=r.markdown;s.specSource=r.source;s.specDuration=duration();goalChanged=false;s.dirty=false;change=null;s.features=s.features.map(f=>({...f,inSpec:f.on}));$('spec').value=s.spec;specMode='view';done=r;
      // Nach einer kapitelweisen Aktualisierung: geänderte Kapitel in der Liste kennzeichnen und das erste gleich zeigen
      specFresh.clear();if(r.update){for(const x of r.changed||[])specFresh.add(x);if(specFresh.size)specChapter=[...specFresh][0]}
      save()}
  }catch(e){message=e.message}finally{if(lockId===currentLockId)streamText=null;lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message){note(message);return}
   if(done){const elapsedMs=Math.round(performance.now()-generatedAt),models=done.usage?.timings||[];
     s.strategyTimes[s.specStrategy]=elapsedMs;save();strategyUI();
     console.info('[SpecIt performance]',{strategy:s.specStrategy,generationMs:elapsedMs,modelCalls:models});
     note('Spezifikation in '+(elapsedMs/1000).toFixed(1)+' s erstellt'+(models[0]?.model?' · '+models[0].model:'')+'.');
   }
  if(done&&done.update){const n=(done.changed||[]).length;note(n?(done.entries?plural(done.entries,'Eintrag','Einträge')+' in '+plural(n,'Kapitel','Kapiteln')+' geändert: ':plural(n,'Kapitel','Kapitel')+' neu geschrieben: ')+done.changed.join(', ')+'. Alles Übrige ist unverändert.'+((done.skipped||[]).length?' Nicht einzuordnen waren Änderungen in: '+done.skipped.join(', ')+' – dafür „Bearbeiten“ nutzen oder die Idee kurz ändern und ganz neu erstellen.':''):'Kein Kapitel musste sich ändern; Rahmen und Entscheidungen sind auf dem neuen Stand.');return}
  // Was Claude in der Spezifikation offen lässt, gleich als Fragen mit Alternativen anbieten
  // (nicht im Auto-Modus: dort entscheidet Claude sie selbst und es wird nicht rückgefragt)
  if(s.specSource==='claude'&&$('ai').checked&&s.autonomy<100)await deriveDecisions();
  // Der Umfang stand schon vor dem Schreiben fest; nur wenn es noch keine Feature-Liste gibt, wird sie aus der Spezifikation ermittelt
  if(!s.features.length){await deriveFeatures();if(overTarget())await proposeFit()}
  // Namensvorschläge, sofern gewünscht und kein eigener Name angegeben ist
  await deriveNames(false);
  // Logo-Entwürfe, sofern gewünscht
  await deriveLogos(false);
  // Zum Schluss das gewünschte Review der fertigen Spezifikation
  if(s.reviewBy&&$('ai').checked)await runReview();
}

/* ---------- Features der Spezifikation: an-/abwählen, Aufwand je Feature, Gesamtdauer ---------- */
async function deriveFeatures(early){
  if(active||(!s.spec.trim()&&!s.idea.trim()))return;
  const rev=revision;const lockId=lock(true,'Spezifikation wird ausgearbeitet');
  let message='';
  try{
    const r=await call({mode:'features',...(early&&conceptPlain()?{concept:conceptPlain()}:{}),spec:early?'':s.spec,idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,ai:$('ai').checked,...frame()});
    if(rev===revision){
      // Bisherige Auswahl bleibt: gleichnamige Features behalten ihren Zustand, bereits abgewählte bleiben in der Liste.
      const old=new Map(s.features.map(f=>[f.name.toLowerCase(),f])),fresh=cleanFeatures(r.features).map(f=>{const o=old.get(f.name.toLowerCase());return o?{...f,on:o.on,inSpec:o.inSpec}:{...f,on:true,inSpec:true}});
      const known=new Set(fresh.map(f=>f.name.toLowerCase()));
      const core=fresh.find(f=>f.core);
      s.features=cleanFeatures([...fresh,...s.features.filter(f=>!f.on&&!f.inSpec&&!known.has(f.name.toLowerCase())).map(f=>({...f,id:'',dependsOn:core?[core.id]:[]}))]);s.featSource=r.source;
    }
  }catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message)specNote(message,true);
}
// Dauer der gewählten Features: Arbeitspakete, Obergrenze der Parallelisierung und Schätzung für die gewählte Agentenzahl
function featDuration(){
  // Obergrenze aus der vollständigen Struktur (alle Features), damit sich die Agentenzahl auch vor dem Vorschlag wählen lässt;
  // gerechnet wird mit höchstens so vielen Agenten, wie in der aktuellen Auswahl Pakete gleichzeitig bereitstehen.
  const wbs=workPackages(s.features),max=workPackages(s.features.map(f=>({...f,on:true}))).width,agents=Math.min(Math.max(1,s.featAgents||1),max);
  return {wbs,max,agents,effort:featureMinutes(s.features),total:featureDuration(s.features,agents)};
}
// Schaubild der Work Breakdown Structure: Stufen von links nach rechts, Pfeile = „muss vorher fertig sein“
function showWbs(){
  const fd=featDuration(),w=fd.wbs,NS='http://www.w3.org/2000/svg',W=230,H=62,GX=70,GY=18,PAD=24,TOP=34;
  const el=(tag,attrs,text)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!==undefined)e.textContent=text;return e};
  const rows=Math.max(...w.waves.map(x=>x.length)),width=PAD*2+w.waves.length*W+(w.waves.length-1)*GX,height=TOP+PAD+rows*H+(rows-1)*GY+PAD;
  const svg=el('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'img','aria-label':'Work Breakdown Structure mit '+w.tasks.length+' Arbeitspaketen in '+w.waves.length+' Stufen'}),defs=el('defs'),mark=el('marker',{id:'wbsArrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});
  mark.append(el('path',{d:'M0,0 L10,5 L0,10 z',class:'wbshead'}));defs.append(mark);svg.append(defs);
  const at=new Map(),byId=new Map(w.tasks.map(t=>[t.id,t]));
  w.waves.forEach((wave,c)=>{
    const x=PAD+c*(W+GX),off=(rows-wave.length)*(H+GY)/2;
    svg.append(el('text',{x:x,y:22,class:'wbsstage'},'Stufe '+(c+1)+' · '+plural(wave.length,'Paket','Pakete')));
    wave.forEach((id,r)=>at.set(id,{x,y:TOP+PAD+off+r*(H+GY)}));
  });
  const edges=el('g'),nodes=el('g');
  // Nur direkte Abhängigkeiten zeichnen: Was schon über ein anderes Vorgängerpaket folgt, braucht keinen eigenen Pfeil.
  const before=new Map(),up=id=>{if(!before.has(id)){const set=new Set();before.set(id,set);for(const d of byId.get(id).dependsOn){set.add(d);for(const x of up(d))set.add(x)}}return before.get(id)};
  for(const t of w.tasks)for(const d of t.dependsOn.filter(d=>!t.dependsOn.some(e=>e!==d&&up(e).has(d)))){const a=at.get(d),b=at.get(t.id),x1=a.x+W,y1=a.y+H/2,x2=b.x,y2=b.y+H/2,m=(x1+x2)/2;edges.append(el('path',{d:'M'+x1+','+y1+' C'+m+','+y1+' '+m+','+y2+' '+(x2-3)+','+y2,class:'wbsedge','marker-end':'url(#wbsArrow)'}))}
  for(const t of w.tasks){
    const p=at.get(t.id),g=el('g',{class:'wbsnode'+(t.core?' core':'')}),name=t.name.length>30?t.name.slice(0,29)+'…':t.name;
    g.append(el('title',{},t.id+' – '+t.name+' · ≈ '+hm(t.minutes)+(t.dependsOn.length?' · baut auf '+t.dependsOn.join(', ')+' auf':'')),el('rect',{x:p.x,y:p.y,width:W,height:H,rx:8}),el('text',{x:p.x+12,y:p.y+20,class:'wbsid'},t.id+' · ≈ '+hm(t.minutes)),el('text',{x:p.x+12,y:p.y+42,class:'wbsname'},name));
    nodes.append(g);
  }
  svg.append(edges,nodes);
  $('wbsCap').textContent='Work Breakdown Structure · '+plural(w.tasks.length,'Arbeitspaket','Arbeitspakete')+' in '+plural(w.waves.length,'Stufe','Stufen')+' · höchstens '+fd.max+' gleichzeitig';
  $('wbsBody').replaceChildren(svg,node('p','Pfeile zeigen, was vorher fertig sein muss. Pakete derselben Stufe hängen nicht voneinander ab und lassen sich gleichzeitig entwickeln; die breiteste Stufe bestimmt die Obergrenze paralleler Agenten. Abgewählte Features sind nicht enthalten.','meta'));
  if(!$('wbs').open)$('wbs').showModal();
}
let featNote='',fitProposal=null;
// Wurde die Zielvorgabe geändert, seit zuletzt ein Vorschlag erzeugt wurde? Erst dann ist der Vorschlag-Knopf aktiv.
let goalChanged=false;
// Geänderte Zielvorgabe in die Spezifikation bringen: Demo-Entwurf neu zusammenführen, Claude-Entwurf gezielt anpassen
async function applyDuration(){
  if(active||!s.spec.trim())return;
  const now=duration();
  if(s.specSource==='demo'){await generate();return}
  if(!$('ai').checked){s.specDuration=now;save();featuresUI();specNote('Ohne Claude wird die Spezifikation nicht umgeschrieben. Bitte die Zielvorgabe dort von Hand anpassen.');return}
  const prev={questions:s.questions,extras:s.extras,features:s.features,spec:s.spec,specSource:s.specSource,dirty:s.dirty},rev=++revision;
  change=null;const lockId=lock(true,'Spezifikation wird ausgearbeitet');specNote('Zielvorgabe wird in die Spezifikation übernommen …');
  let md=null,message='';
  try{md=(await call({mode:'adjust',spec:s.spec,wish:'Die Ziel-Entwicklungsdauer (reine Laufzeit der Coding-Agenten) lautet jetzt: '+(now||'keine Vorgabe')+'. Passe die Angabe der Rahmenbedingung überall an; der Umfang bleibt unverändert.',idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,ai:true,...frame()})).markdown??null}
  catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  if(md===null||rev!==revision){renderAll();specNote(message||'Die Zielvorgabe konnte nicht übernommen werden. Bitte erneut versuchen.',true);return}
  s.spec=md;s.specDuration=now;$('spec').value=md;specMode='view';
  change={ids:[],title:'Zielvorgabe übernommen:',detail:now||'keine Vorgabe',prev,old:prev.spec,until:0,scroll:false};
  renderAll();flash();
}
// Vorschlag für die Zielzeit: zuerst rechnerisch (mehr Agenten, passende Erweiterungen); passt schon die Basis nicht,
// sucht Claude eine Lösung – verschlanken, herabstufen, vorhandenen Code nutzen, anders schneiden.
async function proposeFit(){
  const target=targetMinutes(),list=s.features;if(!target||active||!list.length)return;
  const fd=featDuration(),max=fd.max,opt=list.filter(f=>!f.core).length;fitProposal=null;goalChanged=false;
  for(let n=fd.agents;n<=max;n++){
    const r=suggestExtensions(list,target,n);
    if(r.base<=target){
      s.featAgents=n;s.features=r.features;
      featNote='Vorschlag: '+(n>fd.agents?'mit '+n+' parallelen Agenten – ':'')+r.chosen.length+' von '+plural(opt,'Erweiterung','Erweiterungen')+' zusätzlich zu den Basis-Features, zusammen '+hm(r.total)+' bei einer Zielvorgabe von '+hm(target)+'.';
      renderAll();return;
    }
  }
  const baseBest=featureDuration(list.map(f=>({...f,on:f.core})),max);
  // Sind Schlank-Fassungen vorbereitet, entsteht der Vorschlag sofort; Claude wird nur gefragt, wenn das nicht reicht
  const quick=localFit(list,target);
  if(!$('ai').checked||(list.some(f=>f.lean)&&quick.base<=target)){fitProposal=quick;renderAll();return}
  const lockId=lock(true,'Spezifikation wird ausgearbeitet');featNote='';let message='';
  try{
    const r=await call({mode:'fit',spec:s.spec,features:list,target,maxAgents:Math.min(6,max),idea:s.idea,project:s.project,ai:true});
    const feats=cleanFeatures(r.features).map(f=>({...f,on:true,inSpec:true}));
    if(!feats.length)throw Error('Claude hat keinen Vorschlag geliefert. Bitte erneut versuchen.');
    const agents=Math.min(6,workPackages(feats).width),fit=suggestExtensions(feats,target,agents);
    fitProposal={summary:r.summary||'',measures:Array.isArray(r.measures)?r.measures:[],features:fit.features,agents,base:fit.base,total:fit.total,chosen:fit.chosen.length,target};
  }catch(e){message=e.message;fitProposal=localFit(list,target)}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message)specNote(message+' Stattdessen steht ein rechnerischer Vorschlag bereit.',true);
}
// Rechnerischer Vorschlag ohne KI: Spätere Basis-Features werden zu Erweiterungen, bis die Basis in die Zielzeit passt
// (das erste Basis-Feature, das Grundgerüst, bleibt); danach kommen die Erweiterungen dazu, die noch hineinpassen.
function localFit(list,target){
  let feats=list.map(f=>({...f,on:true})),measures=[];
  const baseOf=()=>featureDuration(feats.map(f=>({...f,on:f.core})),Math.min(6,workPackages(feats).width));
  // 1. verschlanken: vorbereitete Schlank-Fassungen der Basis-Features, größte Ersparnis zuerst
  const slim=feats.map((f,i)=>i).filter(i=>feats[i].core&&feats[i].lean).sort((x,y)=>(feats[y].minutes-feats[y].lean.minutes)-(feats[x].minutes-feats[x].lean.minutes));
  for(const i of slim){
    if(baseOf()<=target)break;
    const f=feats[i];
    measures.push({kind:'verschlanken',feature:f.id,text:'„'+f.name+'“: '+f.lean.note,saves:f.minutes-f.lean.minutes,search:''});
    feats=feats.map((x,k)=>k===i?{...x,note:x.lean.note,minutes:x.lean.minutes,lean:undefined}:x);
  }
  // 2. herabstufen: das für den Grundzweck unwichtigste Basis-Feature zuerst (das Grundgerüst bleibt),
  //    bevorzugt eines, auf dem kein anderes Basis-Feature aufbaut
  const cores=()=>feats.map((f,i)=>i).filter(i=>feats[i].core).slice(1);
  while(baseOf()>target&&cores().length){
    const all=cores(),free=all.filter(i=>!feats.some(f=>f.core&&f.dependsOn.includes(feats[i].id))),pool=free.length?free:all;
    const i=pool.reduce((best,k)=>(feats[k].rank||0)>(feats[best].rank||0)||((feats[k].rank||0)===(feats[best].rank||0)&&k>best)?k:best,pool[0]);
    measures.push({kind:'herabstufen',feature:feats[i].id,text:'„'+feats[i].name+'“ wird Erweiterung und kommt erst hinzu, wenn Zeit bleibt.',saves:feats[i].minutes,search:''});
    feats=feats.map((f,k)=>k===i?{...f,core:false}:f);
  }
  const agents=Math.min(6,workPackages(feats).width),fit=suggestExtensions(feats,target,agents),slimmed=measures.some(m=>m.kind==='verschlanken');
  // local = es wurde nichts umformuliert; verschlankte Features müssen in einer vorhandenen Spezifikation nachgezogen werden
  return {local:!slimmed,summary:slimmed?'Sofort-Vorschlag aus den vorbereiteten Schlank-Fassungen der Features: Die Basis wird verschlankt'+(measures.some(m=>m.kind==='herabstufen')?' und auf das Nötigste verkleinert':'')+'.':'Die Basis wird auf das Nötigste verkleinert, indem die für den Grundzweck unwichtigsten Basis-Features zu Erweiterungen werden.',measures,
    features:fit.features.map(f=>({...f,inSpec:(list.find(x=>x.id===f.id)||{inSpec:true}).inSpec})),agents,base:fit.base,total:fit.total,chosen:fit.chosen.length,target};
}
// Vorschlag übernehmen: Feature-Liste und Agentenzahl ersetzen und den neuen Umfang in die Spezifikation einarbeiten
async function acceptFit(){
  const p=fitProposal;if(!p||active)return;
  if(!s.spec.trim()){
    // Noch keine Spezifikation: Der Vorschlag legt nur den Umfang fest, geschrieben wird danach
    s.features=p.features.map(f=>({...f,inSpec:f.on}));s.featAgents=p.agents;fitProposal=null;revision++;
    featNote='Vorschlag übernommen: '+hm(p.total)+' mit '+(p.agents===1?'einem Agenten':p.agents+' parallelen Agenten')+' bei einer Zielvorgabe von '+hm(p.target)+'.';
    renderAll();return;
  }
  if(p.local){
    // Ohne KI wird nichts umformuliert: Auswahl setzen und Abgewähltes über die Feature-Auswahl in die Spezifikation bringen
    s.features=p.features;s.featAgents=p.agents;fitProposal=null;revision++;
    featNote='Vorschlag übernommen: '+hm(p.total)+' mit '+(p.agents===1?'einem Agenten':p.agents+' parallelen Agenten')+' bei einer Zielvorgabe von '+hm(p.target)+'.';
    if(s.features.some(f=>f.on!==f.inSpec))await applyScope();else renderAll();
    return;
  }
  const prev={questions:s.questions,extras:s.extras,features:s.features,featAgents:s.featAgents,spec:s.spec,specSource:s.specSource,dirty:s.dirty},rev=++revision;
  const off=p.features.filter(f=>!f.on).map(f=>f.name);
  const wish=('Umfang an die Zielzeit von '+hm(p.target)+' anpassen. '+p.measures.map(m=>(m.feature?m.feature+': ':'')+m.text).join(' ')+(off.length?' Diese Erweiterungen gehören vorerst nicht zum Umfang und stehen nur bei den Nicht-Zielen: '+off.join(', ')+'.':'')).slice(0,1950);
  change=null;const lockId=lock(true,'Spezifikation wird ausgearbeitet');specNote('Vorschlag wird in die Spezifikation eingearbeitet …');
  let md=null,message='';
  try{md=(await call({mode:'adjust',spec:s.spec,wish,idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,ai:$('ai').checked,...frame()})).markdown??null}
  catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  if(md===null||rev!==revision){renderAll();specNote(message||'Der Vorschlag konnte nicht eingearbeitet werden. Bitte erneut versuchen.',true);return}
  s.spec=md;s.features=p.features.map(f=>({...f,inSpec:f.on}));s.featAgents=p.agents;$('spec').value=md;specMode='view';fitProposal=null;
  featNote='Vorschlag übernommen: '+hm(p.total)+' mit '+(p.agents===1?'einem Agenten':p.agents+' parallelen Agenten')+' bei einer Zielvorgabe von '+hm(p.target)+'.';
  change={ids:[],title:'Umfang an die Zielzeit angepasst:',detail:plural(p.measures.length,'Maßnahme','Maßnahmen'),prev,old:prev.spec,until:0,scroll:false};
  renderAll();flash();
}
// Schieberegler für die Parallelisierung: 1 = ein Agent arbeitet nacheinander, max = so viele Agenten gleichzeitig wie möglich.
// Beim Ziehen ändert sich nur die Anzeige; übernommen wird beim Loslassen (oder je Tastendruck).
function agentSlider(value,max,onPick){
  const wrap=node('div',undefined,'agentslider'),head=node('div',undefined,'spread'),now=node('span',undefined,'chip ok'),input=node('input'),ends=node('div',undefined,'spread meta');
  const label=n=>n===1?'1 Agent · nacheinander':n+' Agenten gleichzeitig';
  now.textContent=label(value);head.append(node('b','Parallelisierung'),now);
  input.type='range';input.min=1;input.max=Math.max(2,max);input.step=1;input.value=value;input.disabled=max<2||active;
  input.setAttribute('aria-label','Anzahl gleichzeitig arbeitender Agenten');input.setAttribute('aria-valuetext',label(value));
  input.oninput=()=>{now.textContent=label(Number(input.value));input.setAttribute('aria-valuetext',label(Number(input.value)))};
  input.onchange=()=>onPick(Math.min(max,Number(input.value)));
  ends.append(node('span','1 · nacheinander'),node('span',max<2?'keine Parallelisierung möglich':max+' · größtmögliche Parallelisierung'));
  wrap.append(head,input,ends);return wrap;
}
function setFeatures(change){s.features=s.features.map((f,i)=>f.core?f:{...f,on:change(f,i)});featuresUI();stageUI();save()}
async function applyScope(){
  if(active)return;
  const list=s.features,remove=list.filter(f=>!f.on&&f.inSpec).map(f=>f.name),restore=list.filter(f=>f.on&&!f.inSpec).map(f=>f.name);
  if(!remove.length&&!restore.length)return;
  if(!s.spec.trim()){specNote('Bitte zuerst eine Spezifikation erzeugen.');return}
  const prev={questions:s.questions,extras:s.extras,features:list,spec:s.spec,specSource:s.specSource,dirty:s.dirty},rev=++revision;
  change=null;const lockId=lock(true,'Spezifikation wird ausgearbeitet');specNote('Feature-Auswahl wird in die Spezifikation übernommen …');
  let md=null,message='',answers=[];
  try{const r=await call({mode:'scope',spec:s.spec,remove,restore,before:list.filter(f=>!f.inSpec).map(f=>f.name),idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,ai:$('ai').checked,...frame()});md=r.markdown??null;answers=Array.isArray(r.answers)?r.answers:[]}
  catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  if(md===null||rev!==revision){renderAll();specNote(message||'Die Auswahl konnte nicht übernommen werden. Bitte erneut versuchen oder die Spezifikation direkt bearbeiten.',true);return}
  s.spec=md;s.features=list.map(f=>({...f,inSpec:f.on}));$('spec').value=md;specMode='view';
  // Entscheidungen, die durch den geänderten Umfang nicht mehr stimmen, mitziehen – sonst widersprächen sie der Spezifikation
  const moved=answers.filter(a=>s.questions[a.index]&&Array.isArray(a.choice));
  if(moved.length)s.questions=s.questions.map((q,i)=>{const a=moved.find(x=>x.index===i);return a?{...q,state:'decided',choice:a.choice.filter(k=>k>=0&&k<q.options.length),custom:String(a.custom||'').slice(0,500),auto:false}:q});
  change={ids:moved.map(a=>a.index),title:'Feature-Auswahl übernommen:',detail:[remove.length?remove.length+' abgewählt':'',restore.length?restore.length+' wieder aufgenommen':'',moved.length?plural(moved.length,'Entscheidung angepasst','Entscheidungen angepasst'):''].filter(Boolean).join(', '),prev,old:prev.spec,until:0,scroll:false};
  renderAll();flash();
}
// Freie Zeit nutzen: Die KI schlägt weitere Features vor; übernommen wird der Reihe nach, was zusätzlich in die Zielzeit passt
// Vorrat an Feature-Vorschlägen: Solange in der Zielzeit Luft ist, holt SpecIt im Hintergrund weitere Vorschläge und hält sie bereit,
// bis sich die freie Zeit damit füllen ließe. Ein Klick auf das freie Stück des Zeitstrahls übernimmt dann sofort, was hineinpasst.
let poolBusy=false,poolDry='',poolTries=0,poolFor='';
const poolBase=()=>digest(s.idea.trim()+'|'+s.tone+'|'+s.creativity);
// Vorschläge, die es inzwischen als Feature gibt, fallen aus dem Vorrat
function poolNow(){const known=new Set(s.features.map(f=>f.name.toLowerCase()));if(s.featPool.some(f=>known.has(f.name.toLowerCase())))s.featPool=s.featPool.filter(f=>!known.has(f.name.toLowerCase()));return s.featPool}
// Was aus dem Vorrat der Reihe nach in die Zielzeit passt: { list, added, rest }
function poolFit(){
  const target=targetMinutes(),agents=featDuration().agents,added=[],rest=[];let list=s.features;
  for(const f of poolNow()){
    const trial=cleanFeatures([...list,{...f,core:false,own:true,on:true,inSpec:false}]);
    if(target&&featureDuration(trial,agents)<=target){list=trial;added.push(f)}else rest.push(f);
  }
  return {list,added,rest};
}
function ensurePool(){
  const target=targetMinutes();
  if(poolBusy||active||!statusLoaded||!$('ai').checked||!target||!s.features.length||!wsOpen())return;
  const base=poolBase();if(poolFor!==base){poolFor=base;poolTries=0;poolDry='';if(s.featPool.length){s.featPool=[];save()}}
  const fd=featDuration(),free=target-fd.total,pool=poolNow(),held=pool.reduce((n,f)=>n+f.minutes,0);
  // genug vorrätig, nichts mehr zu holen, oder die Zeit ist ohnehin ausgeschöpft
  if(free<Math.max(0.3,target*0.1)||held>=free||poolDry===base||poolTries>=5||pool.length>=20)return;
  poolBusy=true;poolTries++;featuresUI();const epoch=workSession.generation;
  bgCall({mode:'extend',project:s.project,idea:s.idea,spec:s.spec,features:[...s.features,...pool.map(f=>({...f,on:true}))].slice(0,30),target,free:Math.max(0.2,free-held),maxAgents:fd.agents,ai:true},3)
    .then(r=>{
      if(!workSession.isCurrent(epoch)||base!==poolBase())return;
      const known=new Set([...s.features,...s.featPool].map(f=>f.name.toLowerCase())),fresh=(Array.isArray(r.features)?r.features:[]).filter(f=>f&&typeof f.name==='string'&&Number.isFinite(f.minutes)&&!known.has(f.name.toLowerCase()));
      if(!fresh.length)poolDry=base;else{s.featPool=[...s.featPool,...fresh].slice(0,24);save()}
    },()=>{if(workSession.isCurrent(epoch))poolDry=base})
    .finally(()=>{if(workSession.isCurrent(epoch)){poolBusy=false;featuresUI();setTimeout(()=>{if(workSession.isCurrent(epoch))ensurePool()},300)}});
}
async function extendFeatures(){
  if(active)return;
  const target=targetMinutes(),fd=featDuration(),free=target-fd.total;if(!(free>0))return;
  const done=(names,list)=>{s.features=list;revision++;if(s.spec.trim())s.dirty=true;featNote=plural(names.length,'Feature','Features')+' ergänzt (als Erweiterung, abwählbar): '+names.join(', ')+'.'+(s.spec.trim()?' Ist die Feature-Liste fertig, arbeitet „Spezifikation aktualisieren“ sie ein.':'');save()};
  // Liegt ein Vorrat bereit, kommt er sofort – ohne Warten
  const fit=poolFit();
  if(fit.added.length){s.featPool=fit.rest;done(fit.added.map(f=>f.name),fit.list);renderAll();return}
  if(poolBusy){featNote='Vorschläge werden gerade geladen – gleich noch einmal klicken.';flashNote(featNote);featuresUI();return}
  const rev=revision;const lockId=lock(true,'Weitere Features werden gesucht');featNote='';
  try{
    const r=await call({mode:'extend',project:s.project,idea:s.idea,spec:s.spec,features:s.features,target,free,maxAgents:fd.agents,ai:$('ai').checked});
    if(rev!==revision){featNote='Eingaben geändert. Erneut starten.';return}
    const known=new Set(s.features.map(f=>f.name.toLowerCase())),added=[];let list=s.features;
    for(const f of Array.isArray(r.features)?r.features:[]){
      if(!f||typeof f.name!=='string'||known.has(f.name.toLowerCase()))continue;
      // Die Kennung kommt fortlaufend vom Server; in der Spezifikation steht das Feature noch nicht (inSpec=false) – „Spezifikation aktualisieren“ arbeitet es ein
      const trial=cleanFeatures([...list,{...f,core:false,own:true,on:true,inSpec:false}]);
      if(featureDuration(trial,fd.agents)>target)continue;
      list=trial;added.push(f.name);known.add(f.name.toLowerCase());
    }
    if(added.length)done(added,list);
    else{featNote=r.source==='demo'?'Weitere Features schlägt nur Claude vor (Schalter oben rechts).':'Kein weiteres Feature gefunden, das sinnvoll ist und noch in die Zielzeit passt – '+hm(free)+' bleiben frei.';poolDry=poolBase();flashNote(featNote)}
  }catch(e){featNote=e.message}finally{lock(false,undefined,lockId);if(lockId===currentLockId)renderAll()}
  // Eingearbeitet wird nicht von selbst: Meist wird mehrfach ergänzt, bis die Zielzeit ausgeschöpft ist – erst dann lohnt das Schreiben.
}
function featuresUI(){
  // Solange es keine Spezifikation gibt, ist die Auswahl selbst der Umfang – es gibt nichts einzuarbeiten
  if(!s.spec.trim()&&s.features.some(f=>f.on!==f.inSpec))s.features=s.features.map(f=>({...f,inSpec:f.on}));
  const box=$('featBox'),list=s.features;box.replaceChildren();
  // Kopfzeile: geplante Dauer, die Zahl der Agenten, mit der sie gerechnet ist, die Zielvorgabe und der Umfang
  const fdHead=list.length?featDuration():null,tHead=targetMinutes();
  $('featCount').textContent=list.length?'ca. '+hm(Math.max(1,Math.round(fdHead.total)))+(tHead?' von '+hm(tHead):'')+' · '+list.filter(f=>f.core).length+' Basis · '+list.filter(f=>!f.core&&f.on).length+'/'+list.filter(f=>!f.core).length+' Erweiterungen':'';
  if(!list.length){
    box.append(node('p',s.spec.trim()?'Für diese Spezifikation sind noch keine Features ermittelt.':'Die Features erscheinen, sobald eine Spezifikation erstellt ist.','meta'));
    if(s.spec.trim()){const get=button('✦ Features und Aufwand ermitteln','btn small nudge',deriveFeatures);get.style.marginTop='10px';get.disabled=active;box.append(get)}
    return;
  }
  // Gesamtdauer der gewählten Features, verglichen mit der Ziel-Entwicklungsdauer
  // Dauer nach der Work Breakdown Structure: so viele Agenten wie gewählt, höchstens so viele, wie Pakete gleichzeitig bereitstehen
  const fd=featDuration(),total=fd.total,target=targetMinutes(),over=target>0&&total>target,sum=node('div',undefined,'featsum'+(over?' over':'')),acts=node('div',undefined,'catacts'),par=node('div',undefined,'featpar'),pick=node('div',undefined,'seg');
  // Die Kachel im Überblick der Spezifikation zeigt dieselbe Schätzung und zieht bei jeder Änderung mit
  for(const id of ['estTile','featTile']){const e=$(id);if(e&&e._fill)e._fill()}
  // … und ebenso die Zeile im Kapitel „Rahmen“ der angezeigten Spezifikation
  for(const li of $('specView').querySelectorAll('li')){const b=li.firstElementChild;if(b&&b.tagName==='STRONG'&&b.textContent===estLabel&&li.firstChild===b){li.replaceChildren(b,' '+estText());break}}
  const head=node('div',undefined,'featline'),state=!target?null:node('span',over?hm(total-target)+' über dem Ziel':'passt','chip '+(over?'warn':'ok'));
  head.append(node('b',hm(total)),node('span',target?'von '+hm(target):'ohne Zielvorgabe','meta'));if(state)head.append(state);
  head.title='Geschätzte Entwicklungsdauer mit '+(fd.agents===1?'einem Agenten':fd.agents+' parallelen Agenten')+' · Arbeitsaufwand gesamt '+hm(fd.effort)+' · '+plural(fd.wbs.tasks.length,'Arbeitspaket','Arbeitspakete')+' in '+plural(fd.wbs.waves.length,'Stufe','Stufen');
  sum.append(head);
  // Aufteilung: Zeit für die Basis-Features allein und der Zuschlag durch die gewählten Erweiterungen, gemessen an der Zielvorgabe
  const baseMin=Math.min(total,featureDuration(list.map(f=>({...f,on:f.core})),fd.agents)),extMin=total-baseMin,span=Math.max(total,target,1),bar=node('div',undefined,'splitbar'),legend=node('div',undefined,'splitlegend');
  const seg=(cls,min)=>{const e=node('span',undefined,cls);e.style.width=(min/span*100)+'%';return e};
  bar.append(seg('base',baseMin),seg('ext',extMin));
  if(target){const mark=node('span',undefined,'goal');mark.style.left=Math.min(100,target/span*100)+'%';mark.title='Zielvorgabe: '+hm(target);bar.append(mark)}
  bar.setAttribute('role','img');bar.setAttribute('aria-label','Basis-Features '+hm(baseMin)+', Erweiterungen '+hm(extMin)+(target?', Zielvorgabe '+hm(target):''));
  const key=(cls,label,min)=>{const e=node('span');e.append(node('i',undefined,cls),label+' ',node('b',hm(min)));return e};
  legend.append(key('base','Basis',baseMin),key('ext','Erweiterungen',extMin));if(target)legend.append(key('goal','Ziel',target));
  sum.append(bar,legend);
  // Bleibt in der Zielzeit spürbar Luft, ist das freie Stück des Zeitstrahls ein Knopf: Die KI ergänzt Features, die zusätzlich hineinpassen
  if(target&&!over&&target-total>=Math.max(0.3,target*0.1)){
    const fit=poolFit().added,gain=fit.reduce((n,f)=>n+f.minutes,0),dry=!fit.length&&!poolBusy&&(poolDry===poolBase()||poolTries>=5),ready=fit.length?plural(fit.length,'Feature','Features')+' ergänzen':poolBusy?'Vorschläge werden geladen …':dry?'keine weiteren Vorschläge':'Features ergänzen';
    const share=(target-total)/span,more=button(share>.45?(dry?'':'＋ ')+hm(target-total)+' frei · '+ready:share>.2?(dry?hm(target-total)+' bleiben frei':'＋ '+hm(target-total)+' frei'):dry?'·':'＋','free',extendFeatures);
    more.style.width=(share*100)+'%';more.disabled=active||!$('ai').checked;more.setAttribute('aria-label',hm(target-total)+' frei: weitere Features ergänzen');
    more.title=$('ai').checked?(fit.length?hm(target-total)+' frei. Bereit zum Übernehmen (zusammen ≈ '+hm(gain)+'): '+fit.map(f=>f.name+' ≈ '+hm(f.minutes)).join(' · ')+'. Sie kommen als abwählbare Erweiterungen dazu.':hm(target-total)+' frei: Claude schlägt weitere nützliche Features vor, die zusätzlich in die Zielzeit passen. Sie kommen als abwählbare Erweiterungen dazu.'):hm(target-total)+' frei. Zum Ergänzen weiterer Features Claude einschalten (Schalter oben rechts).';
    more.classList.toggle('nudge',!more.disabled&&!dry);more.classList.toggle('loading',poolBusy&&!fit.length);more.classList.toggle('dry',dry);
    if(dry&&$('ai').checked)more.title=hm(target-total)+' bleiben frei: Es wurden keine weiteren Features gefunden, die sinnvoll sind und hineinpassen. Ein Klick sucht noch einmal.';bar.classList.add('tall');bar.removeAttribute('role');bar.insertBefore(more,bar.querySelector('.goal'));
  }
  // Zielvorgabe direkt hier ändern: Die Rechnung passt sich sofort an; die Spezifikation nennt die Vorgabe als Rahmen
  // und wird deshalb erst auf Wunsch nachgezogen.
  const goal=node('div',undefined,'goalpick'),gHead=node('div',undefined,'spread'),gNow=node('span',durations[s.durLevel][0],'chip'),gIn=node('input');
  gHead.append(node('b','Zielvorgabe'),gNow);
  gIn.type='range';gIn.min=0;gIn.max=durations.length-1;gIn.step=1;gIn.value=s.durLevel;gIn.disabled=active;gIn.setAttribute('aria-label','Ziel-Entwicklungsdauer');gIn.setAttribute('aria-valuetext',durations[s.durLevel][0]);
  gIn.oninput=()=>{gNow.textContent=durations[Number(gIn.value)][0];gIn.setAttribute('aria-valuetext',gNow.textContent)};
  gIn.onchange=()=>{goalChanged=Number(gIn.value)!==s.durLevel||goalChanged;s.durLevel=Number(gIn.value);featNote='';fitProposal=null;renderAll();if(targetMinutes()&&s.features.some(f=>f.lean)&&!active){const t=targetMinutes(),q=localFit(s.features,t);if(q.base<=t||!$('ai').checked)proposeFit()}$('featBox').querySelector('.goalpick input')?.focus({preventScroll:true})};
  // Zielvorgabe und Parallelisierung stehen nebeneinander in einer Zeile
  const pair=node('div',undefined,'sliderpair');goal.append(gHead,gIn);pair.append(goal);sum.append(pair);
  if(s.spec.trim()&&typeof s.specDuration==='string'&&s.specDuration!==duration()){
    const warn=node('div',undefined,'spread goalwarn'),take=button('In die Spezifikation übernehmen','btn small',applyDuration);take.disabled=active;
    warn.append(node('span','Die Spezifikation nennt noch „'+(s.specDuration||'keine Vorgabe')+'“.','meta'),take);sum.append(warn);
  }
  par.className='parbox';
  pair.append(agentSlider(fd.agents,fd.max,n=>{s.featAgents=n;featuresUI();ideaUI();save()}));
  pair.lastElementChild.title=fd.max<2?'Die Arbeitspakete bauen aufeinander auf; es kann nur nacheinander gearbeitet werden.':'Höchstens '+fd.max+': So viele Arbeitspakete sind unabhängig voneinander und lassen sich gleichzeitig entwickeln.';
  const allOn=button('✓ Alle Erweiterungen','btn small',()=>{featNote='';setFeatures(()=>true)}),allOff=button('✕ Keine Erweiterungen','btn small',()=>{featNote='';setFeatures(()=>false)});
  allOn.disabled=list.every(f=>f.on);allOff.disabled=list.every(f=>f.core||!f.on);
  // Vorschlag: Basis gesetzt, Erweiterungen der Reihe nach, solange die Zielzeit reicht
  const propose=button('✦ Vorschlag für die Zielzeit','btn small',proposeFit);
  const canPropose=!!target&&(goalChanged||over)&&!active;propose.disabled=!canPropose;propose.classList.toggle('primary',canPropose);
  propose.title=!target?'Dafür eine Zielvorgabe wählen.':!(goalChanged||over)?'Die Auswahl passt in die Zielvorgabe. Aktiv, sobald die Zielvorgabe geändert oder überschritten wird.':'Sucht eine Lösung, die in die Zielvorgabe passt: mehr parallele Agenten, passende Erweiterungen – und wenn die Basis zu groß ist, ein verschlankter Umfang.';const show=button('▤ Struktur anzeigen','btn small',showWbs);show.title='Work Breakdown Structure: Arbeitspakete, Stufen und Abhängigkeiten als Schaubild';if(canPropose)acts.append(propose);if(!allOn.disabled)acts.append(allOn);if(!allOff.disabled)acts.append(allOff);acts.append(show);box.append(sum,acts);
  if(featNote)box.append(node('p',featNote,'featnote'));
  // Lösungsvorschlag von Claude: Maßnahmen, Ergebnis und die Entscheidung des Nutzers
  if(fitProposal){
    const p=fitProposal,card=node('div',undefined,'fitbox'),ul=node('ul'),row=node('div',undefined,'actions');
    card.append(node('span','Lösungsvorschlag für '+hm(p.target),'eyebrow'),node('p',p.summary||'So passt der Umfang in die Zielzeit:'),
      node('p',(p.base<=p.target?'Basis-Features '+hm(p.base)+' mit '+(p.agents===1?'einem Agenten':p.agents+' parallelen Agenten')+(p.chosen?', dazu '+plural(p.chosen,'Erweiterung','Erweiterungen'):'')+' – zusammen '+hm(p.total)+'.':'Der Vorschlag kommt auf '+hm(p.base)+' für die Basis – noch '+hm(p.base-p.target)+' über der Zielvorgabe; weiter lässt sich der Grundzweck nicht kürzen.'),'meta'));
    for(const m of p.measures){const li=node('li');li.append(node('span',m.kind,'chip'+(m.kind==='wiederverwenden'?' ok':'')),' '+(m.feature?m.feature+': ':'')+m.text+(m.saves?' (spart etwa '+hm(m.saves)+')':'')+(m.search?' Suche: „'+m.search+'“.':''));ul.append(li)}
    const take=button('✓ Vorschlag übernehmen','btn primary small',acceptFit),drop=button('Verwerfen','btn small',()=>{fitProposal=null;featuresUI()});take.disabled=active;
    row.append(take,drop);
    if(p.measures.some(m=>m.kind==='wiederverwenden')){const find=button('⌕ Passenden Code auf GitHub suchen','btn small',()=>{$('reusePanel').open=true;researchReuse()});find.disabled=active;row.append(find)}
    card.append(ul,row);box.append(card);
  }
  const sumOf=xs=>xs.reduce((n,f)=>n+f.minutes,0),baseList=list.filter(f=>f.core),extList=list.filter(f=>!f.core);
  const group=(title,text)=>{const h=node('div',undefined,'featgroup');h.append(node('span',title,'eyebrow'),node('span',text,'meta'));box.append(h)};
  list.map((f,i)=>[f,i]).sort((a,b)=>Number(b[0].core)-Number(a[0].core)).forEach(([f,i],pos)=>{
    if(pos===0&&f.core)group('Basis-Features · '+baseList.length,'nötig für die grundsätzliche Funktionsweise · Aufwand '+hm(sumOf(baseList)));
    if(pos===baseList.length&&!f.core)group('Erweiterungen · '+extList.filter(x=>x.on).length+' von '+extList.length+' gewählt','optional · Aufwand der gewählten '+hm(sumOf(extList.filter(x=>x.on))));
    const row=node('label',undefined,'switch featrow'+(f.on?'':' off')+(f.core?' base':'')),input=node('input'),body=node('span',undefined,'body'),head=node('span');
    input.type='checkbox';input.checked=f.on;input.disabled=f.core||active;input.dataset.f=i;if(f.core)input.title='Basis-Feature: gehört zur grundsätzlichen Funktionsweise und lässt sich nicht abwählen.';
    input.onchange=()=>{featNote='';setFeatures((x,k)=>k===i?input.checked:x.on);$('featBox').querySelector('[data-f="'+i+'"]')?.focus({preventScroll:true})};
    head.append(node('b',f.name));if(f.own)head.append(' ',node('span','Idee der KI','chip ok'));if(f.on!==f.inSpec)head.append(' ',node('span',f.on?'wird aufgenommen':'wird entfernt','chip warn'));
    body.append(head);if(f.note)body.append(node('span',f.note,'note'));
    body.append(node('span',f.id+(f.dependsOn.length?' · baut auf '+f.dependsOn.join(', ')+' auf':' · unabhängig'),'meta'));
    const src=(f.from||[]).filter(n=>s.questions[n]);
    if(src.length){const why=node('span',undefined,'meta');why.append('folgt aus ');src.forEach((n,k)=>{if(k)why.append(', ');const go=button('Entscheidung '+(n+1),'link',e=>{e.preventDefault();catOpen=n;syncCat();$('decPanel').open=true;catalogUI();side().querySelector('[data-q="'+n+'"]')?.scrollIntoView({block:'nearest'})});go.title=s.questions[n].question;why.append(go)});body.append(why)}
    if(!(f.core&&i===list.findIndex(x=>x.core))){
      const flip=button(f.core?'↓ zur Erweiterung machen':'↑ zur Basis machen','link',e=>{e.preventDefault();s.features=s.features.map((x,k)=>k===i?{...x,core:!x.core,on:x.core?x.on:true}:x);featNote='';fitProposal=null;featuresUI();ideaUI();stageUI();save()});
      flip.title=f.core?'Dieses Feature ist nicht zwingend: Es wird wählbar und zählt nicht mehr zur Basis.':'Dieses Feature gehört zur grundsätzlichen Funktionsweise und lässt sich dann nicht mehr abwählen.';body.append(flip);
    }
    row.append(input,node('span',undefined,'track'),body,node('span','≈ '+hm(f.minutes),'chip mins'));box.append(row);
  });
  if(list.some(f=>f.on!==f.inSpec)){
    const apply=button('✓ Auswahl in die Spezifikation übernehmen','btn primary',applyScope);apply.className+=' featapply';apply.disabled=active;apply.title='Du hast Features an- oder abgewählt; die Spezifikation enthält die Änderung noch nicht.';box.prepend(apply);
  }
  const foot=node('p',(s.featSource==='claude'?'Aufwand von Claude geschätzt':'Aufwand: feste Demo-Annahmen')+'; die tatsächliche Dauer kann deutlich abweichen. ','meta'),again=button('Neu ermitteln','link',deriveFeatures);
  foot.style.marginTop='12px';again.disabled=active;foot.append(again);box.append(foot);
}
$('generate').onclick=()=>ensureDecided(()=>startSpec());
$('project').oninput=e=>{s.project=e.target.value;touched();namesUI();statuses();save()};
$('nameCount').oninput=e=>{s.nameCount=Number(e.target.value);namesUI();save()};

/* ---------- Review der Spezifikation durch einen gewählten Agenten ---------- */
let reviewers=[];
const reviewerNow=()=>reviewers.find(r=>r.id===s.reviewBy)||null;
const times=f=>String(f).replace('.',',')+'×',usd=n=>'$'+String(n).replace('.',',');
// Überall dieselbe Form: Name mit Version · Kosten · Laufzeit (beides im Verhältnis zu Sonnet 5.5)
const modelOption=m=>new Option(m.name+(m.factor!=null?' · Kosten '+times(m.factor):'')+(m.time!=null?' · Laufzeit '+times(m.time):''),m.id);
const modelHint=(m,codex)=>!m?'':m.factor!=null?'Tokenkosten '+times(m.factor)+' Sonnet 5.5 · '+usd(m.in)+' / '+usd(m.out)+' je Mio. Token (Eingabe / Ausgabe)'+(m.time!=null?' · Laufzeit etwa '+times(m.time)+' (grober Richtwert)':'')+(m.note?' · '+m.note:''):(m.note?m.note+' · ':'')+(codex?'Preise und Tempo nennt die Codex-CLI nicht':'');
// Modell der Agenten für die direkte Umsetzung
let agentModels=[];
function runModelUI(){
  const sel=$('runModel');sel.replaceChildren(new Option('Standard von Claude Code',''),...agentModels.map(modelOption));
  if(s.runModel&&agentModels.length&&!agentModels.some(m=>m.id===s.runModel))s.runModel='';
  sel.value=s.runModel;const m=agentModels.find(x=>x.id===s.runModel);
  $('runModelCost').textContent=m?modelHint(m):'Es gilt das in Claude Code eingestellte Modell. Kosten und Laufzeit gelten je Agent.';$('runModel').title=$('runModelCost').textContent;
}
$('runModel').onchange=e=>{s.runModel=e.target.value;save();renderAll()};
// Neues Repository auf GitHub anlegen und gleich als Repository eintragen
const repoSlug=()=>(s.project.trim()||s.idea).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'')||'neues-projekt';
$('repoNew').onclick=()=>{
  const f=$('repoForm'),open=f.classList.toggle('hidden')===false;$('repoNew').setAttribute('aria-expanded',String(open));$('repoStatus').textContent='';
  if(open){if(!$('repoName').value)$('repoName').value=repoSlug();$('repoName').focus()}
};
$('repoName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('repoCreate').click()}};
$('repoCreate').onclick=async()=>{
  const name=$('repoName').value.trim(),st=$('repoStatus'),vis=$('repoVis').value;if(!name)return;
  $('repoCreate').disabled=true;st.className='status';st.textContent='Repository wird angelegt …';
  try{
    const r=await post('/api/repo',{name,visibility:vis,description:s.project.trim()});
    $('repo').value=r.url;$('repo').dispatchEvent(new Event('input'));$('repoForm').classList.add('hidden');$('repoNew').setAttribute('aria-expanded','false');
    st.textContent='Angelegt ('+(vis==='public'?'öffentlich':'privat')+', leer) und oben eingetragen.';
  }catch(e){st.className='banner';st.textContent=e.message}finally{$('repoCreate').disabled=false}
};
const reviewModelNow=()=>(reviewerNow()?.models||[]).find(m=>m.id===s.reviewModel)||null;
const reviewModelName=()=>reviewModelNow()?.name||s.reviewModel;
function reviewChoiceUI(){
  const by=$('reviewBy'),mo=$('reviewModel'),r=reviewerNow();
  by.replaceChildren(new Option('Kein Review',''),...reviewers.map(x=>new Option(x.name,x.id)));
  // Ein gespeicherter, hier nicht eingerichteter Anbieter bleibt sichtbar, bis der Stand der Anbieter bekannt ist
  if(s.reviewBy&&!r)by.append(new Option(s.reviewBy+' (nicht eingerichtet)',s.reviewBy));
  by.value=s.reviewBy;
  const models=r?r.models:[];
  mo.replaceChildren(...(models.length?models.map(modelOption):[new Option('Standardmodell','')]));
  if(models.length&&!models.some(m=>m.id===s.reviewModel))s.reviewModel=(models.find(m=>m.preferred)||models[0]).id;if(!models.length)s.reviewModel='';
  mo.value=s.reviewModel;mo.disabled=models.length<2;mo.classList.toggle('hidden',!s.reviewBy);
  const m=reviewModelNow();
  $('reviewValue').textContent=!s.reviewBy?'gewählt: kein Review':'gewählt: '+(r?r.name:s.reviewBy)+(s.reviewModel?' · '+reviewModelName():'');
  // Entscheidungshilfe: Kostenverhältnis und Listenpreis, soweit bekannt
  $('reviewCost').textContent=modelHint(m,!!r&&r.id==='codex');
}
$('reviewBy').onchange=e=>{s.reviewBy=e.target.value;s.reviewModel='';reviewChoiceUI();specReviewUI();presetsUI();save()};
$('reviewModel').onchange=e=>{s.reviewModel=e.target.value;reviewChoiceUI();presetsUI();save()};
async function runReview(){
  const r=reviewerNow();
  if(active||!s.spec.trim()||!s.reviewBy)return;
  if(!r){specNote('Der gewählte Reviewer ist auf diesem Rechner nicht eingerichtet.',true);return}
  if(!$('ai').checked){specNote('Ein Review braucht einen Agenten: bitte Claude aktivieren.');return}
  const rev=revision,spec=s.spec;const lockId=lock(true,'Review der Spezifikation durch '+r.name+(s.reviewModel?' ('+reviewModelName()+')':''));let message='';
  try{
    const x=await call({mode:'review',spec,provider:s.reviewBy,model:s.reviewModel,ai:true,...frame()});
    if(rev===revision){s.review={by:r.name,model:reviewModelName(),summary:String(x.summary||''),findings:(Array.isArray(x.findings)?x.findings:[]).map(f=>({...f,done:false})),spec:digest(spec)}}
  }catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message)specNote('Review nicht möglich: '+message,true);
}
function specReviewUI(){
  const box=$('reviewBox'),v=s.review,r=reviewerNow();box.replaceChildren();
  $('reviewCount').textContent=v?plural(v.findings.filter(f=>!f.done).length,'offener Befund','offene Befunde'):s.reviewBy?'noch nicht geprüft':'';
  // Der Knopf steht vorn in der Zeile; ohne gewählten Agenten nimmt er den ersten eingerichteten
  {let slot=$('reviewGo');if(!slot){slot=node('span');slot.id='reviewGo';box.parentElement.querySelector('summary').after(slot)}slot.replaceChildren();
   if(s.spec.trim()){
     const fresh=!!v&&v.spec===digest(s.spec),go=button(v?'↻ Erneut prüfen':'✦ Review starten','btn small',()=>{if(!s.reviewBy&&reviewers.length){s.reviewBy=reviewers[0].id;s.reviewModel='';reviewChoiceUI();save()}runReview()});
     go.disabled=active||(!r&&!reviewers.length);go.title=reviewers.length?'Lässt die Spezifikation von einem zweiten Agenten prüfen: Widersprüche, Lücken, nicht prüfbare Anforderungen.':'Kein prüfender Agent eingerichtet.';
     // Kein Pulsieren: Review und Recherche sind freiwillig
     slot.append(go);
   }}
  if(!v)return;
  box.append(node('p',v.by+(v.model?' · '+v.model:'')+(v.spec!==digest(s.spec)?' · bezieht sich auf einen früheren Stand der Spezifikation':''),'meta'));
  if(v.summary)box.append(node('p',v.summary,'featnote'));
  if(!v.findings.length)box.append(node('p','Keine Befunde.','meta'));
  v.findings.forEach((f,i)=>{
    const row=node('div',undefined,'reuseitem'+(f.done?' donefind':'')),head=node('div',undefined,'actions');
    head.append(node('span',f.severity,'chip'+(f.severity==='hoch'?' warn':f.severity==='niedrig'?'':' ok')),node('b',f.section||'Allgemein'));
    row.append(head,node('p',f.issue));
    if(f.suggestion){
      row.append(node('p','Vorschlag: '+f.suggestion,'meta'));
      const take=button(f.done?'✓ Eingearbeitet':'✦ Einarbeiten','btn small',async()=>{s.review={...v,findings:v.findings.map((x,k)=>k===i?{...x,done:true}:x)};$('wish').value=f.suggestion;await adjustSpec()});
      take.disabled=active||f.done;take.style.alignSelf='flex-start';row.append(take);
    }
    box.append(row);
  });
}

/* ---------- Festlegungen in der rechten Spalte: Stand je Bereich als Punkt, Führung zum nächsten offenen Bereich ---------- */
// done = erledigt (grün), todo = hier ist noch etwas zu tun (gelb), idle = freiwillig und noch nicht genutzt (grau)
const panelNames={namePanel:'Name der Anwendung',layoutSection:'UI-Layouts',logoPanel:'Logo',featPanel:'Features',decPanel:'Entscheidungen',reviewPanel:'Review',reusePanel:'Open-Source-Bausteine'};
let panelBefore={};
function panelStates(){
  const open=s.questions.filter(q=>q.state==='open').length,v=s.review,left=v?v.findings.filter(f=>!f.done).length:0;
  return {
    namePanel:s.project.trim()?'done':'todo',
    logoPanel:s.logos[s.logoChosen]?'done':s.logoCount>0||s.logos.length?'todo':'idle',
    layoutSection:!(s.layoutOn&&stitch)?'idle':chosenLayout()?'done':'todo',
    featPanel:!s.features.length||overTarget()||(s.spec.trim()&&s.features.some(f=>f.on!==f.inSpec))?'todo':'done',
    decPanel:open?'todo':s.questions.length?'done':'idle',
    reviewPanel:v?(left?'todo':'done'):s.reviewBy&&s.spec.trim()?'todo':'idle',
    reusePanel:s.reuse?'done':'idle'
  };
}
function panelsUI(){
  const st=panelStates(),ids=Object.keys(panelNames).filter(id=>!$(id).classList.contains('hidden')),label={done:'erledigt',todo:'noch zu tun',idle:'freiwillig, noch nicht genutzt',locked:'noch nicht möglich'};
  // Bereiche, deren Voraussetzung fehlt, sind gesperrt und nennen, was fehlt
  const noSpec=!s.spec.trim()?'Erst möglich, sobald die Spezifikation erstellt ist':'',locks={featPanel:!s.features.length&&!s.idea.trim()?'Erst möglich, sobald eine Idee eingegeben ist':'',decPanel:!s.questions.length?'Erst möglich, sobald die Spezifikation ausgearbeitet wird':''};
  for(const id of ids){
    const d=$(id),why=locks[id]||'';d.classList.toggle('locked',!!why);if(why){d.open=false;st[id]='locked'}
    const s0=d.querySelector('summary');let hint=s0.querySelector('.lockwhy');
    if(!hint){hint=node('span',undefined,'meta lockwhy');s0.append(hint);s0.addEventListener('click',e=>{if(d.classList.contains('locked'))e.preventDefault()})}
    hint.textContent=why;s0.setAttribute('aria-disabled',String(!!why));
  }
  // Der Schritt dazwischen: Erst mit der Spezifikation werden die folgenden Bereiche möglich – der Knopf steht genau an dieser Stelle
  for(const id of ids){
    const sum=$(id).querySelector('summary');let dot=sum.querySelector('.dot');
    if(!dot){dot=node('span',undefined,'dot');sum.prepend(dot)}
    $(id).dataset.state=st[id];dot.className='dot '+st[id];dot.title=label[st[id]];dot.setAttribute('aria-label',label[st[id]]);dot.setAttribute('role','img');
  }
  // Ausgeschaltetes (keine Logo-Entwürfe, keine Layouts) ist ausgegraut, bleibt aber aufklappbar und dort einschaltbar
  $('logoPanel').classList.toggle('off',!(s.logoCount>0||s.logos.length));$('layoutSection').classList.toggle('off',!(s.layoutOn&&stitch));
  panelBefore=st;
}

/* ---------- Logo-Entwürfe: Anzahl auf der Idee-Seite, Auswahl und Download bei der Spezifikation ---------- */
// Ein Entwurf wird nur als geprüftes SVG eingefügt (dieselbe Bereinigung wie auf dem Server)
function logoNode(svg,size){
  const clean=cleanSvg(svg),doc=clean?new DOMParser().parseFromString(clean,'image/svg+xml'):null,root=doc&&doc.documentElement;
  if(!root||root.nodeName!=='svg'||doc.querySelector('parsererror'))return node('span','?','meta');
  const el=document.importNode(root,true);el.setAttribute('width',size);el.setAttribute('height',size);el.setAttribute('aria-hidden','true');return el;
}
// Das gewählte Logo steht ohne weiteres Zutun neben der Überschrift der Spezifikation – in der Ansicht und damit auch im PDF
function specLogo(view){
  // Der Titel der Spezifikation ist die erste Überschrift (der Renderer setzt „#“ eine Ebene tiefer, also H2)
  const pick=s.logos[s.logoChosen],h=view.querySelector('h1,h2');if(!pick||!h)return;
  const box=node('span',undefined,'speclogo');box.append(logoNode(pick.svg,44));box.title='Logo: '+pick.name;h.before(box);
}
function logoUI(){
  // Das gewählte Logo steht in der Kopfzeile vor dem Projektnamen
  const mark=$('brandLogo'),chosen=s.logos[s.logoChosen];mark.replaceChildren();mark.classList.toggle('hidden',!chosen);if(chosen){mark.append(logoNode(chosen.svg,30));mark.title='Gewähltes Logo: '+chosen.name}
  const n=s.logoCount;$('logoCount').value=n;
  levelMark('logoCountValue',n,5,String(n),n?plural(n,'Entwurf','Entwürfe'):'keine Entwürfe');$('logoCount').setAttribute('aria-valuetext',n?plural(n,'Entwurf','Entwürfe'):'keine Entwürfe');
  $('logoCountText').replaceChildren(node('b',n?plural(n,'Logo-Entwurf','Logo-Entwürfe'):'Keine Logo-Entwürfe'));
  const box=$('logoBox'),off=!(n>0||s.logos.length),pick=s.logos[s.logoChosen];box.replaceChildren();box.classList.toggle('hidden',off);
  $('logoMeta').textContent=off?'aus · Anzahl erhöhen':brandBusy.logos?'wird gezeichnet …':pick?pick.name:s.logos.length?plural(s.logos.length,'Entwurf','Entwürfe')+' · keiner gewählt':'noch keine Entwürfe';
  // Das gewählte Logo steht klein in der Kopfzeile des Bereichs, neben seinem Namen
  if(pick&&!off){const m=$('logoMeta'),mini=logoNode(pick.svg,22);mini.style.cssText='vertical-align:middle;margin-left:8px;border-radius:5px';m.append(mini)}
  const acts=$('logoActs');acts.replaceChildren();
  {const more=button(s.logos.length?'↻ Logo':'✦ Logo','btn small',()=>{if(!s.logoCount)s.logoCount=1;deriveLogos(true)});more.disabled=active||(!s.idea.trim()&&!s.spec.trim());more.title='Claude zeichnet ein Logo, das zur Idee passt.';acts.append(more)}
  if(pick){
    acts.append(button('⤢ Groß','btn small',()=>{
      let d=$('logoBig');if(!d){d=node('dialog',undefined,'logobig');d.id='logoBig';d.setAttribute('aria-label','Logo in voller Größe');d.onclick=()=>d.close();document.body.append(d)}
      d.replaceChildren(logoNode(pick.svg,360),node('p',pick.name+(pick.idea?' – '+pick.idea:''),'meta'));d.showModal();
    }),button('↓ SVG','btn small',()=>download('logo.svg',cleanSvg(pick.svg))));
  }
  if(off)return;
  const head=node('div',undefined,'namehead'),row=node('div',undefined,'namerow');
  s.logos.forEach((l,i)=>{
    const b=button('','logotile'+(i===s.logoChosen?' on':''),()=>{s.logoChosen=i===s.logoChosen?-1:i;save();logoUI();panelsUI();specUI()});
    b.append(logoNode(l.svg,72));b.title=l.name+(l.idea?' – '+l.idea:'')+' · Klicken, um diesen Entwurf zu wählen';b.setAttribute('aria-label','Logo-Entwurf '+l.name);b.setAttribute('aria-pressed',String(i===s.logoChosen));b.disabled=active;row.append(b);
  });
  if(pick&&pick.idea)row.append(node('p',pick.idea,'meta logoidea'));
  box.append(head,row);
}
/* ---------- Live-Skizze: sofort aus Stichwörtern der Idee, auf Wunsch von Claude verfeinert ---------- */
const sketchKinds=[
  ['pairs','Paarungen',/auslos|paar|kennenlern|match|zuordn|tandem|wichtel/i],
  ['calendar','Kalender',/kalender|termin|wöchentlich|woche|planung|schicht|buchung|reserv|dienstplan/i],
  ['chart','Auswertung',/statistik|auswert|dashboard|verlauf|kennzahl|diagramm|analyse|tracking|budget|ausgaben|fortschritt/i],
  ['chat','Nachrichten',/chat|nachricht|messenger|support|forum|kommentar/i],
  ['cards','Karten',/galerie|rezept|produkt|katalog|shop|fotos|bilder|portfolio|angebot/i],
  ['map','Karte',/landkarte|standort|route|gps|orte\b|in der nähe/i],
  ['timer','Timer',/timer|countdown|stoppuhr|pomodoro|minütig|\bminuten\b/i],
  ['form','Eingabe',/formular|anmeld|erfass|eingabe|umfrage|bewerb|registr|notiz|eintrag/i],
  ['list','Liste',/liste|verwalt|einträge|tagebuch|bücher|aufgabe|todo|inventar|sammlung|übersicht|teammitglied|teilnehmer|mitglieder/i],
];
// Was die Regler an der Skizze ändern: Zieldauer und Kreativität bestimmen, wie viele Bereiche sie zeigt,
// der Einsatzbereich die Formensprache (locker = runder und luftiger, formell = eckig und dichter).
let sketchPhone=false;
// Die Regler sind Prompt-Modulatoren: Aus derselben Tabelle (modulators in interview.mjs) kommen der Satz für den Prompt
// und die Wirkung auf die Skizze. Die Skizze setzt hier nur noch zusammen, was die Modulatoren vorgeben.
// Was die Options-Regler beitragen: Logo (auch ein schon gewähltes), Layouts über Stitch, Namensvorschläge bzw. ein feststehender Name
const modInput=()=>({logos:s.logos[s.logoChosen]?Math.max(1,s.logoCount):s.logoCount,layouts:s.layoutOn?s.layoutCount:0,names:s.nameCount,named:!!s.project.trim()});
const modsNow=()=>modulators({autonomy:s.autonomy,duration:duration(),minutes:targetMinutes(),creativity:s.creativity,tone:s.tone,...modInput()});
const modSig=()=>s.creativity+'|'+s.tone+'|'+duration()+'|'+JSON.stringify(modInput())+'|'+s.project.trim();
function sketchOpts(){
  const k=Object.assign({},...modsNow().map(m=>m.sketch)),max=Math.max(1,Math.min(6,k.areas+k.more));
  return {max:sketchPhone?Math.min(3,max):max,level:k.level,nav:k.nav,search:k.search,side:k.side,filters:k.filters,status:k.status,tone:k.tone,round:k.rough?0:k.round,dense:k.dense,extra:k.extra,logo:k.logo,rough:k.rough,placeholder:k.placeholder,phone:sketchPhone};
}
// „Wirksamer Prompt“: die Idee und je Regler der Satz, der sie moduliert – mit dem, was er an der Skizze bewirkt
let modBefore={};
function promptUI(){
  const body=$('promptBody'),idea=s.idea.trim(),mods=modsNow();body.replaceChildren();
  $('promptView').classList.toggle('hidden',!idea);if(!idea)return;
  $('promptMeta').textContent='Idee + '+mods.length+' Modulatoren';
  const row=(label,text,effect,changed)=>{const r=node('div',undefined,'modrow'+(changed?' tick':''));r.append(node('span',label,'eyebrow'),node('p',text));if(effect)r.append(node('span','→ Skizze: '+effect,'meta'));body.append(r)};
  row('Idee',idea);
  for(const m of mods){row(m.label,m.text,m.effect,modBefore[m.key]!==undefined&&modBefore[m.key]!==m.text);modBefore[m.key]=m.text}
}
// Jede Beschriftung der Skizze gibt es in fünf Tonlagen – von flapsig (privat und locker) bis förmlich (formell und arbeitsbezogen):
// [Name des Bereichs je Stufe], [Aktion je Stufe]. Der Regler „Einsatzbereich“ wählt die Spalte.
const sketchWords={
  pairs:[['Shuffle Happens','Wer mit wem?','Paarungen','Zuordnungen','Paarungsliste'],['Würfeln!','Neu mischen','Neu auslosen','Auslosen','Erzeugen']],
  list:[['The Usual Suspects','Wer ist dabei?','Liste','Übersicht','Bestandsliste'],['Noch wer!','+ Dazu','+ Neu','Anlegen','Erfassen']],
  calendar:[['Save the Date','Wann geht’s?','Kalender','Terminplan','Terminübersicht'],['Jetzt!','Heute','Heute','Woche','KW']],
  chart:[['Zahlen, bitte!','Wie läuft’s?','Auswertung','Kennzahlen','Berichtswesen'],['Zeig her','Monat','Monat','Zeitraum','Periode']],
  chat:[['Awkward Silence Kit','Schnack','Nachrichten','Mitteilungen','Korrespondenz'],['Raus damit','Senden','Senden','Absenden','Übermitteln']],
  cards:[['Eye Candy','Schau mal','Karten','Katalog','Bestandskatalog'],['Stöbern','Filter','Filter','Filtern','Selektion']],
  map:[['You Are Here','Wo ist was?','Karte','Standorte','Standortliste'],['Los!','Route','Route','Planen','Routing']],
  timer:[['Talk O’Clock','Zeit läuft','Timer','Zeitmessung','Zeiterfassung'],['Go!','Start','Start','Starten','Messen']],
  form:[['Fill Me In','Erzähl mal','Eingabe','Erfassung','Datenerfassung'],['Ab dafür','Speichern','Speichern','Übernehmen','Sichern']],
};
const sketchAct=(kind,tone)=>sketchWords[kind][1][tone];
// Bei lockerem Einsatzbereich tragen die Bereiche augenzwinkernde Namen (bei „eher informell“ nur der erste)
const sketchFun={pairs:'Shuffle Happens',list:'The Usual Suspects',chat:'Awkward Silence Kit',chart:'Social Coverage',timer:'Talk O’Clock',calendar:'Save the Date',form:'Fill Me In',cards:'Eye Candy',map:'You Are Here'};
// Baustein-Palette: Ein Klick ergänzt den Bereich in der Skizze, indem er die Idee um einen Halbsatz erweitert
const sketchPhrase={pairs:'mit Auslosung von Paaren',calendar:'mit Kalender',chart:'mit Statistik',chat:'mit Chat',cards:'mit Galerie',map:'mit Landkarte',timer:'mit Timer',form:'mit Formular zur Eingabe',list:'mit Liste'};
// Grobe Bauzeit je Bereich in Agenten-Minuten – nur für die Bau-Vorschau, keine Schätzung des Projekts
const sketchMinutes={pairs:7,calendar:9,chart:8,chat:10,cards:6,map:10,timer:4,form:5,list:6};
let sketchBoxes=[],sketchSeen=new Set();const sketchFresh=new Map();
// Bereiche, die dazukommen, wenn die Komplexitätsstufe mehr Bereiche vorsieht, als die Idee nennt
const sketchFill=['list','form','chart','calendar','cards','chat','timer','map','pairs'];
// Die Sofort-Skizze steht ohne Verzögerung vollständig. Nur was gegenüber dem vorigen Stand neu ist
// (ein Bereich, die Suche, die Seitenleiste …), blendet kurz ein.
function localSketch(idea,name,o){
  const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),stage=4,now=new Set();let grp='chrome';
  const el=(st,tag,attrs,text)=>{
    const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!=null)e.textContent=text;
    now.add(grp);if(!sketchSeen.has(grp)&&!sketchFresh.has(grp))sketchFresh.set(grp,performance.now());
    // Das Einblenden läuft über erneutes Zeichnen hinweg weiter, statt jedes Mal neu zu beginnen
    const age=sketchFresh.has(grp)?performance.now()-sketchFresh.get(grp):999;if(age<250){e.classList.add('sk-new');e.style.animationDelay=-Math.round(age)+'ms'}
    svg.append(e);
  };
  svg.setAttribute('viewBox','0 0 480 300');svg.setAttribute('role','img');
  let kinds=sketchKinds.filter(k=>k[2].test(idea));if(!kinds.length)kinds=[sketchKinds[8],sketchKinds[7]];
  // Mehr Zielzeit, mehr Anwendung: Nennt die Idee weniger Bereiche, als die Stufe vorsieht, kommen naheliegende dazu
  for(const fill of sketchFill){if(kinds.length>=o.max)break;if(!kinds.some(k=>k[0]===fill))kinds.push(sketchKinds.find(k=>k[0]===fill))}
  kinds=kinds.slice(0,o.max);
  // Seitenleiste ab Stufe 5; bei Verwaltungs- und Team-Anwendungen ersetzt sie schon ab Stufe 3 die Navigation in der Kopfzeile
  const side=!o.phone&&(o.side||(o.nav&&/admin|verwalt|dashboard|team|mitarbeit|kunden/i.test(idea))),nav=!o.phone&&o.nav&&!side;
  const nouns=(idea.match(/[A-ZÄÖÜ][a-zäöüß-]{3,}/g)||[]).filter(w=>!/^(Eine[rsnm]?|Diese[rsnm]?|App|Apps|Anwendung|Tool|Webapp|Web-App|Programm|Software|Plattform|Seite|Erstelle|Baue|Entwickle|Mache|Schreibe|Bitte|Soll|Sollte)$/.test(w)),title=(name||(o.placeholder?'‹ Name ›':nouns[0]||'Deine Anwendung')).slice(0,o.phone?16:nav?22:o.search?30:34);
  // Ohne gestaltetes Layout wirkt die Skizze roh: gestrichelte Kästen, keine Akzentfarbe, leicht schief
  if(o.rough)svg.classList.add('sk-rough');
  // Unterschiedliche Sichten oder Rollen („eine für die Teilnehmer, eine weitere für den Organisator“) werden zu Reitern
  const roles=/sicht|ansicht|rolle|bereich für|oberfläche für/i.test(idea)?[...new Set([...idea.matchAll(/für\s+(?:den|die|das|einen|eine|alle|jeden)?\s*([A-ZÄÖÜ][A-Za-zäöüß-]{3,})/g)].map(m=>m[1]))].slice(0,3):[];
  const tabs=roles.length>1,filters=!o.phone&&o.filters&&!tabs,foot=!o.phone&&o.status?18:0,top=tabs||filters?62:44,H=(tabs||filters?226:244)-foot;
  svg.setAttribute('aria-label','Skizze ('+(o.phone?'Handy':'Desktop')+'): '+title+' mit '+kinds.map(k=>k[1]).join(', ')+(tabs?'; Sichten: '+roles.join(', '):''));
  const R=o.round,r=Math.min(R,6),q=1,n=full=>Math.ceil(full*q),g=o.dense?6:10;
  let boxes;
  if(o.phone){
    // Handy: schmaler Rahmen, Bereiche untereinander, Leiste mit Tabs unten
    el(0,'rect',{x:160,y:3,width:160,height:294,rx:18,class:'sk-frame'});el(0,'rect',{x:161,y:4,width:158,height:28,rx:17,class:'sk-bar'});
    if(o.logo)el(1,'circle',{cx:176,cy:18,r:6,class:'sk-accent'});el(1,'text',{x:o.logo?188:172,y:22,class:'sk-title'},title);
    el(0,'rect',{x:161,y:268,width:158,height:28,rx:17,class:'sk-bar'});for(let i=0;i<4;i++)el(1,'circle',{cx:186+i*36,cy:282,r:5,class:i?'sk-dot':'sk-accent'});
    if(tabs)roles.slice(0,2).forEach((role,i)=>{el(0,'rect',{x:170+i*72,y:36,width:68,height:14,rx:7,class:i?'sk-input':'sk-accent'});el(1,'text',{x:204+i*72,y:46,class:i?'sk-link':'sk-btn','text-anchor':'middle'},role.slice(0,13))});
    const y0=tabs?56:38,h=(268-y0-2-g*(kinds.length-1)-4)/kinds.length;boxes=kinds.map((k,i)=>[170,y0+i*(h+g),140,h]);
  }else{
    el(0,'rect',{x:1,y:1,width:478,height:298,rx:Math.max(2,R),class:'sk-frame'});
    el(0,'rect',{x:1,y:1,width:478,height:30,rx:Math.max(2,R),class:'sk-bar'});
    if(o.logo)el(1,'circle',{cx:18,cy:16,r:7,class:'sk-accent'});
    el(1,'text',{x:o.logo?32:14,y:20,class:'sk-title'},title);
    el(1,'rect',{x:392,y:8,width:74,height:16,rx:Math.min(8,R+2),class:'sk-accent'});
    el(4,'text',{x:429,y:19.5,class:'sk-btn','text-anchor':'middle'},sketchAct(kinds[0][0],o.tone));
    // Was mit der Komplexität dazukommt: Navigation, Suche, Seitenleiste, Filter, Konto und Statusleiste
    if(nav){grp='nav';for(let i=0;i<3;i++)el(1,'rect',{x:196+i*38,y:13,width:28,height:6,rx:3,class:i?'sk-line':'sk-accent'})}
    if(o.search){grp='search';const sx=o.status?284:306;el(1,'rect',{x:sx,y:8,width:78,height:16,rx:Math.min(8,R+2),class:'sk-input'});el(1,'circle',{cx:sx+10,cy:16,r:3,class:'sk-dot'});el(1,'rect',{x:sx+18,y:14,width:34,height:4,rx:2,class:'sk-line'})}
    const x0=side?96:14;
    if(side){grp='side';el(0,'rect',{x:1,y:31,width:84,height:268-foot,class:'sk-side'});const items=Math.min(10,(o.dense?7:5)+Math.max(0,(o.level||0)-5));for(let i=0;i<items;i++)el(1,'rect',{x:12,y:46+i*(o.dense?18:22),width:i?44+((i*13)%20):60,height:8,rx:Math.min(4,r),class:i?'sk-line':'sk-accent'});
      if(o.side){grp='sidefoot';el(1,'line',{x1:10,y1:262-foot,x2:76,y2:262-foot,class:'sk-rule'});el(1,'circle',{cx:18,cy:280-foot,r:6,class:'sk-dot'});el(1,'rect',{x:30,y:277-foot,width:42,height:6,rx:3,class:'sk-line'})}}
    if(o.status){grp='status';el(1,'circle',{cx:377,cy:16,r:7,class:'sk-dot'});el(1,'circle',{cx:383,cy:10,r:3,class:'sk-accent'});
      el(0,'rect',{x:2,y:282,width:476,height:16,class:'sk-bar'});el(1,'rect',{x:14,y:288,width:70,height:5,rx:2,class:'sk-line'});el(1,'rect',{x:96,y:288,width:44,height:5,rx:2,class:'sk-line'});el(1,'circle',{cx:462,cy:290,r:3,class:'sk-accent'})}
    if(tabs){grp='tabs';let tx=x0;roles.forEach((role,i)=>{const tw=Math.max(58,role.length*5.4+18);el(0,'rect',{x:tx,y:38,width:tw,height:16,rx:Math.min(8,R+2),class:i?'sk-input':'sk-accent'});el(1,'text',{x:tx+tw/2,y:49,class:i?'sk-link':'sk-btn','text-anchor':'middle'},role);tx+=tw+6})}
    if(filters){grp='filters';for(let i=0;i<4;i++)el(1,'rect',{x:x0+i*50,y:39,width:44,height:14,rx:Math.min(7,R+2),class:i?'sk-input':'sk-accent'});el(1,'rect',{x:392,y:39,width:74,height:14,rx:Math.min(7,R+2),class:'sk-input'})}
    grp='chrome';
    const W=466-x0,half=(H-g)/2,rowOf=(count,y)=>Array.from({length:count},(_,i)=>[x0+i*(W+g)/count,y,(W+g)/count-g,half]);
    boxes=kinds.length===1?[[x0,top,W,H]]:kinds.length===2?[[x0,top,W*.56,H],[x0+W*.56+g,top,W*.44-g,H]]:kinds.length===3?[[x0,top,W*.56,H],[x0+W*.56+g,top,W*.44-g,half],[x0+W*.56+g,top+half+g,W*.44-g,half]]:kinds.length===4?[...rowOf(2,top),...rowOf(2,top+half+g)]:[...rowOf(kinds.length===5?2:3,top),...rowOf(3,top+half+g)];
  }
  sketchBoxes=kinds.map(([kind],k)=>({kind,x:boxes[k][0],y:boxes[k][1],w:boxes[k][2],h:boxes[k][3]}));
  kinds.forEach(([kind,label],k)=>{
    grp='box:'+kind;const [x,y,w,h]=boxes[k],step=o.dense?18:22,cap=sketchWords[kind][0][o.tone];
    el(0,'rect',{x,y,width:w,height:h,rx:r,class:'sk-box',...(o.rough?{transform:'rotate('+[-.7,.6,-.4,.8][k%4]+' '+(x+w/2)+' '+(y+h/2)+')'}:{})});el(1,'text',{x:x+10,y:y+16,class:'sk-cap'},cap.toUpperCase());
    if(k&&!o.phone&&w>150)el(4,'text',{x:x+w-10,y:y+16,class:'sk-link','text-anchor':'end'},sketchAct(kind,o.tone));
    const ix=x+10,iy=y+26,iw=w-20,ih=h-36;
    if(kind==='list')for(let i=0;i<n(Math.min(o.dense?10:7,Math.floor(ih/step)));i++){el(2,'circle',{cx:ix+5,cy:iy+8+i*step,r:4,class:i?'sk-dot':'sk-accent'});el(2,'rect',{x:ix+16,y:iy+4+i*step,width:iw*(.5+((i*37)%30)/100)-16,height:8,rx:Math.min(4,r),class:'sk-line'});el(4,'rect',{x:ix+iw-22,y:iy+3+i*step,width:22,height:10,rx:Math.min(5,r),class:'sk-input'})}
    if(kind==='form'){for(let i=0;i<n(Math.min(o.dense?4:3,Math.floor((ih-26)/34)));i++){el(2,'rect',{x:ix,y:iy+i*34,width:iw*.4,height:6,rx:3,class:'sk-line'});el(2,'rect',{x:ix,y:iy+10+i*34,width:iw,height:16,rx:Math.min(4,r),class:'sk-input'})}el(3,'rect',{x:ix,y:iy+ih-18,width:Math.min(90,iw),height:18,rx:Math.min(5,r),class:'sk-accent'});el(4,'text',{x:ix+Math.min(90,iw)/2,y:iy+ih-5.5,class:'sk-btn','text-anchor':'middle'},sketchAct('form',o.tone))}
    if(kind==='calendar'){const cw=iw/7,rows=Math.max(2,Math.min(o.dense?5:4,Math.floor(ih/26)));for(let rr=0;rr<n(rows);rr++)for(let c=0;c<7;c++)el(2,'rect',{x:ix+c*cw+1,y:iy+rr*(ih/rows)+1,width:cw-2,height:ih/rows-2,rx:Math.min(3,r),class:stage>=3&&(rr*7+c)%6===2?'sk-accent':'sk-input'})}
    if(kind==='chart'){const m=Math.max(4,Math.min(o.dense?10:8,Math.floor(iw/26))),bw=iw/m;for(let i=0;i<n(m);i++){const bh=ih*(.3+((i*53)%60)/100);el(2,'rect',{x:ix+i*bw+3,y:iy+ih-bh,width:bw-6,height:bh,rx:Math.min(3,r),class:i===m-2?'sk-accent':'sk-line'})}el(2,'line',{x1:ix,y1:iy+ih,x2:ix+iw,y2:iy+ih,class:'sk-rule'});el(4,'line',{x1:ix,y1:iy+ih*.35,x2:ix+iw,y2:iy+ih*.35,class:'sk-rule','stroke-dasharray':'3 3'})}
    if(kind==='chat')for(let i=0;i<n(Math.min(o.dense?6:4,Math.floor(ih/30)));i++){const bw=iw*(.45+((i*29)%25)/100);el(2,'rect',{x:i%2?ix+iw-bw:ix,y:iy+i*30,width:bw,height:20,rx:Math.min(10,R+2),class:i%2?'sk-accent':'sk-line'})}
    if(kind==='cards'){const cols=iw>170?3:2,rows=ih>120?2:1,cw=iw/cols,ch=ih/rows;for(let rr=0;rr<n(rows);rr++)for(let c=0;c<cols;c++){el(2,'rect',{x:ix+c*cw+2,y:iy+rr*ch+2,width:cw-4,height:ch-4,rx:r,class:'sk-input'});el(3,'rect',{x:ix+c*cw+8,y:iy+rr*ch+ch-16,width:(cw-16)*.7,height:6,rx:3,class:'sk-line'})}}
    if(kind==='map'){el(2,'rect',{x:ix,y:iy,width:iw,height:ih,rx:r,class:'sk-input'});el(3,'path',{d:'M'+ix+' '+(iy+ih*.7)+' C'+(ix+iw*.3)+' '+(iy+ih*.2)+','+(ix+iw*.6)+' '+(iy+ih*.9)+','+(ix+iw)+' '+(iy+ih*.3),class:'sk-rule',fill:'none'});el(3,'circle',{cx:ix+iw*.55,cy:iy+ih*.5,r:7,class:'sk-accent'})}
    if(kind==='timer'){const rad=Math.max(8,Math.min(iw,ih)/2-4),min=(idea.match(/(\d{1,3})\s*-?\s*min/i)||[])[1];el(2,'circle',{cx:ix+iw/2,cy:iy+ih/2,r:rad,class:'sk-ring'});el(3,'text',{x:ix+iw/2,y:iy+ih/2+6,class:'sk-big','text-anchor':'middle'},(min||'25')+':00')}
    if(kind==='pairs')for(let i=0;i<n(Math.min(o.dense?6:4,Math.floor(ih/(o.dense?28:34))));i++){const cy=iy+14+i*(o.dense?28:34);el(3,'line',{x1:ix+22,y1:cy,x2:ix+iw-22,y2:cy,class:'sk-rule'});el(2,'circle',{cx:ix+12,cy,r:o.dense?8:10,class:'sk-dot'});el(2,'circle',{cx:ix+iw-12,cy,r:o.dense?8:10,class:i?'sk-dot':'sk-accent'})}
    if(o.extra&&k===kinds.length-1&&!o.phone){el(3,'rect',{x:x+w-70,y:y+h-22,width:62,height:14,rx:Math.min(7,R+2),class:'sk-idea'});el(4,'text',{x:x+w-39,y:y+h-12,class:'sk-link','text-anchor':'middle'},'✦ Idee der KI')}
  });
  sketchSeen=now;for(const key of [...sketchFresh.keys()])if(!now.has(key))sketchFresh.delete(key);
  return {svg,kinds:kinds.map(k=>k[0]),sig:kinds.map(k=>k[0]).join()+'|'+side+'|'+roles.join()+'|'+[o.max,o.level,o.phone,o.extra,o.logo].join()};
}
// Bau-Vorschau: Agenten-Punkte ziehen zu den Bereichen und „bauen“ sie – erst gemeinsam das Grundgerüst, dann parallel.
// Eine Veranschaulichung mit groben Richtwerten je Bereich, keine Schätzung des Projekts.
let sketchPlaying=false;
function playBuild(){
  const svg=$('sketch').querySelector('svg');if(!svg||sketchPlaying||!sketchBoxes.length)return;
  const NS='http://www.w3.org/2000/svg',ms=170,scaffold=8,boxes=sketchBoxes,agents=Math.max(1,Math.min(boxes.length,s.featAgents>1?s.featAgents:targetMinutes()&&targetMinutes()<=30?3:2));
  const lanes=Array.from({length:agents},()=>({t:scaffold,jobs:[]}));
  // jeder Bereich geht an den Agenten, der am frühesten frei ist
  for(const bx of [...boxes].sort((p,q)=>sketchMinutes[q.kind]-sketchMinutes[p.kind])){const l=lanes.reduce((m,c)=>c.t<m.t?c:m,lanes[0]);l.jobs.push({bx,from:l.t,to:l.t+sketchMinutes[bx.kind]});l.t+=sketchMinutes[bx.kind]}
  const total=Math.max(...lanes.map(l=>l.t)),single=scaffold+boxes.reduce((m,bx)=>m+sketchMinutes[bx.kind],0),layer=document.createElementNS(NS,'g');
  sketchPlaying=true;svg.append(layer);$('sketchPlay').disabled=true;
  const add=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);layer.append(e);return e};
  const frame=sketchPhone?{x:160,w:160}:{x:1,w:478};
  add('rect',{x:frame.x,y:sketchPhone?30:29,width:0,height:3,class:'sk-accent'}).animate([{width:'0px'},{width:frame.w+'px'}],{duration:scaffold*ms,fill:'both'});
  for(const l of lanes)for(const j of l.jobs){
    add('rect',{x:j.bx.x,y:j.bx.y,width:j.bx.w,height:j.bx.h,rx:5,class:'sk-build'}).animate([{opacity:0},{opacity:.22}],{delay:j.from*ms,duration:(j.to-j.from)*ms,fill:'both'});
    add('rect',{x:j.bx.x,y:j.bx.y+j.bx.h-4,width:0,height:4,rx:2,class:'sk-accent'}).animate([{width:'0px'},{width:j.bx.w+'px'}],{delay:j.from*ms,duration:(j.to-j.from)*ms,fill:'both'});
  }
  lanes.forEach((l,i)=>{
    const dot=add('circle',{cx:0,cy:0,r:7,class:'sk-agent'}),start={x:frame.x+20+i*18,y:16},frames=[{transform:'translate('+start.x+'px,'+start.y+'px)',offset:0},{transform:'translate('+start.x+'px,'+start.y+'px)',offset:scaffold/total}];
    for(const j of l.jobs){const p='translate('+(j.bx.x+j.bx.w-14)+'px,'+(j.bx.y+14)+'px)';frames.push({transform:p,offset:Math.min(1,(j.from+.6)/total)},{transform:p,offset:Math.min(1,j.to/total)})}
    frames.push({transform:frames[frames.length-1].transform,offset:1});
    dot.animate(frames,{duration:total*ms,fill:'both',easing:'ease-in-out'});
  });
  let minute=0;const tick=setInterval(()=>{minute=Math.min(total,minute+1);$('sketchNote').textContent='Bau-Vorschau · Minute '+minute+' von '+total+(minute<=scaffold?' · Grundgerüst':' · '+agents+(agents===1?' Agent':' Agenten parallel'))},ms);
  setTimeout(()=>{clearInterval(tick);$('sketchNote').textContent='Bau-Vorschau: etwa '+total+' min mit '+(agents===1?'einem Agenten':agents+' Agenten')+(agents>1?' statt '+single+' min mit einem':'')+' (grobe Veranschaulichung)';
    setTimeout(()=>{sketchPlaying=false;sketchUI()},2600)},total*ms+200);
}
// Die Sofort-Skizze steht mit jedem Tastendruck und jeder Reglerbewegung ohne Verzögerung. Ist Claude eingeschaltet,
// zeichnet er nach einer halben Sekunde Ruhe darüber – als Strom, sichtbar vom Groben zum Feinen: erst das Drahtmodell,
// dann der gestaltete Entwurf. Jede Änderung an Idee oder Reglern bricht ab und beginnt von vorn; nichts sperrt die Seite.
let sketchSig='',sketchAuto=null,sketchIdle=null,sketchPauseUntil=0;
const sketchKey=()=>digest(s.idea.trim()+'|'+modSig());
// Aus dem bisher angekommenen Stück ein gültiges SVG machen: angefangenes Element abschneiden, offene Elemente schließen
function partialSvg(text){
  const a=text.indexOf('<svg');if(a<0)return '';
  let b=text.slice(a);if(b.includes('</svg>'))return b.slice(0,b.lastIndexOf('</svg>')+6);
  b=b.slice(0,b.lastIndexOf('>')+1);if(!b.startsWith('<svg'))return '';
  const open=[];for(const m of b.matchAll(/<(\/?)([A-Za-z]\w*)[^>]*?(\/?)>/g)){if(m[1])open.pop();else if(!m[3])open.push(m[2])}
  return b+open.reverse().map(tag=>'</'+tag+'>').join('');
}
function drawStream(){
  const job=sketchAuto;if(!job||!job.text)return;
  const svg=partialSvg(job.text);if(!svg)return;
  const fresh=logoNode(svg,'100%');if(fresh.nodeName!=='svg')return;
  const box=$('sketch'),old=box.querySelector('.sk-stream');fresh.classList.add('sk-stream');
  if(old)old.replaceWith(fresh);else{box.classList.add('streaming');for(const c of box.children)c.classList.add('sk-under');box.append(fresh)}
}
function scheduleAuto(){
  clearTimeout(sketchIdle);
  const key=sketchKey(),done=s.sketch&&s.sketch.idea===key?(s.sketch.pass||2):0;
  if(sketchAuto&&(sketchAuto.key!==key||!atIdea()||!$('ai').checked)){sketchAuto.ac.abort();sketchAuto=null}
  if(sketchAuto||!$('ai').checked||active||!atIdea()||done>=2||words(s.idea)<4||Date.now()<sketchPauseUntil)return;
  sketchIdle=setTimeout(()=>runAuto(key,done+1),done?50:500);
}
async function runAuto(key,pass){
  if(sketchAuto||active||!atIdea()||key!==sketchKey())return;
  const ac=new AbortController(),epoch=workSession.generation,job={key,ac,pass,text:'',timer:0};sketchAuto=job;sketchUI();
  try{
    const res=await fetch('/api/spec',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'sketch',bg:true,pass,prev:pass>1&&s.sketch?s.sketch.svg:'',idea:s.idea.trim(),project:s.project,ai:true,...frame(),minutes:targetMinutes(),...modInput()}),signal:workSession.combine(ac.signal)});
    if(!res.ok||!res.body)throw Error('Skizze nicht möglich.');
    let fin=null;
    await readNdjson(res.body,m=>{
      if(m.error)throw Error(m.error);
      if(m.done)fin=m;
      else if(m.t&&sketchAuto===job&&workSession.isCurrent(epoch)){job.text+=m.t;if(!job.timer)job.timer=setTimeout(()=>{job.timer=0;if(sketchAuto===job&&workSession.isCurrent(epoch))drawStream()},80);}
    });

    if(workSession.isCurrent(epoch)&&sketchAuto===job&&fin&&fin.svg&&key===sketchKey()){s.sketch={idea:key,svg:fin.svg,pass:fin.pass||pass};save()}
  }catch(e){if(workSession.isCurrent(epoch)&&!ac.signal.aborted)sketchPauseUntil=Date.now()+6000}
  finally{clearTimeout(job.timer);if(workSession.isCurrent(epoch)){if(sketchAuto===job)sketchAuto=null;sketchUI()}}
}
/* ---------- Live-Konzept: entsteht beim Tippen, Fragen stehen als anklickbare Stellen im Text ---------- */
// Die Skizze ist vorerst abgeschaltet; ihr Code bleibt für später stehen.
const SKETCH=false;
let conceptJob=null,conceptIdle=0,conceptPauseUntil=0,conceptAsk='',conceptAskShown='';const conceptFlash={};
// Was den Text bestimmt: Idee, Kreativität, Einsatzbereich, Zieldauer. Der Entscheidungsmodus ändert ihn nicht.
const conceptNow=()=>({idea:s.idea.trim(),creativity:s.creativity,tone:s.tone,duration:duration()});
const conceptKey=()=>JSON.stringify(conceptNow());
// Text in Abschnitte zerlegen, zusammensetzen und einzelne Abschnitte austauschen
const conceptSplit=text=>{const m=new Map();let cur=null;for(const line of text.split('\n')){const h=line.trim().match(/^##\s+(.+)$/);if(h){cur=h[1].trim();m.set(cur,[])}else if(cur!==null)m.get(cur).push(line)}return m};
const conceptJoin=m=>[...m].map(([k,v])=>'## '+k+'\n'+v.join('\n').trim()).join('\n\n');
const conceptMerge=(prev,part)=>{const a=conceptSplit(prev);for(const [k,v] of conceptSplit(part))if(a.has(k))a.set(k,v);return conceptJoin(a)};
// Welche Abschnitte eine Regleränderung betrifft; null = alles neu (andere Idee oder noch kein vollständiges Konzept)
const conceptAffects={tone:['Ziel und Nicht-Ziele','UX und Gestaltung'],duration:['Ziel und Nicht-Ziele','Funktionale Anforderungen','Projektspezifische nichtfunktionale Anforderungen','Daten und Schnittstellen'],creativity:['Funktionale Anforderungen','UX und Gestaltung']};
function conceptOnly(){
  const c=s.concept;if(!c||!c.parts||c.parts.idea!==s.idea.trim()||conceptSplit(c.text).size<conceptSections.length)return null;
  const now=conceptNow(),set=new Set();for(const k in conceptAffects)if(c.parts[k]!==now[k])conceptAffects[k].forEach(x=>set.add(x));
  return set.size?[...set]:null;
}
const CARET='\u2063';
// Zerlegt eine Zeile in Text und Markierungen {{Frage?|Annahme|Alternative…}}; eine noch nicht geschlossene Markierung am Ende bleibt weg
function conceptInline(line,into,seen){
  let last=0,ask=null;
  for(const m of line.matchAll(/\{\{([^{}|]+)\|([^{}]*)\}\}/g)){
    into.append(line.slice(last,m.index));last=m.index+m[0].length;
    const q=m[1].trim(),opts=m[2].split('|').map(x=>x.trim()).filter(Boolean);if(!opts.length){continue}
    if(seen.has(q)){into.append(s.conceptAnswers[q]||opts[0]);continue}seen.add(q);
    const mine=s.conceptAnswers[q],b=node('button',mine||opts[0],'cmark'+(mine?' own':'')+(mine&&Date.now()-(conceptFlash[q]||0)<1100?' flash':''));
    b.type='button';b.title=q+(mine?' – von dir entschieden':' – Annahme der KI; klicken, um selbst zu entscheiden');b.setAttribute('aria-expanded',String(conceptAsk===q));
    b.onclick=()=>{conceptAsk=conceptAsk===q?'':q;conceptRefresh()};into.append(b);
    if(conceptAsk===q){
      const box=node('span',undefined,'cask'),row=node('span',undefined,'actions'),own=node('input');
      const pick=a=>{if(a)s.conceptAnswers[q]=a;else delete s.conceptAnswers[q];conceptAsk='';save();if(conceptPush())renderAll();else conceptRefresh()};
      for(const o of opts){const x=button(o,'chip pickchip'+((mine||opts[0])===o?' ok':''),()=>pick(o));row.append(x)}
      own.type='text';own.maxLength=120;own.placeholder='Eigene Antwort …';own.setAttribute('aria-label','Eigene Antwort auf: '+q);
      own.onkeydown=e=>{if(e.key==='Enter'&&own.value.trim())pick(own.value.trim());else if(e.key==='Escape'){conceptAsk='';conceptRefresh()}};
      row.append(own);if(mine)row.append(button('Annahme wiederherstellen','link',()=>pick('')));
      box.append(node('b',q),row);ask=box;
    }
  }
  into.append(line.slice(last).replace(/\{\{[^}]*$/,''));
  // Die Frage steht unter dem ganzen Satz, damit er nicht zerrissen wird
  if(ask)into.append(ask);
}
// pending: Abschnitte, die gerade neu geschrieben werden und noch den alten Text zeigen (blass)
function conceptRender(text,live,pending,target){
  const out=target||$('concept'),frag=document.createDocumentFragment(),seen=new Set();let list=null,lastEl=null,dim=false,caretAt=null;
  const mark=el=>{if(dim)el.classList.add('dim');return el};
  for(const raw0 of text.split('\n')){
    const here=raw0.includes(CARET),line=raw0.replace(CARET,'').trim();
    if(line){
      if(line.startsWith('## ')){list=null;const title=line.slice(3).trim();dim=!!pending&&pending.has(title);lastEl=mark(node('h3',title));frag.append(lastEl)}
      else if(/^[-•]\s+/.test(line)){if(!list){list=mark(node('ul'));frag.append(list)}lastEl=node('li');conceptInline(line.replace(/^[-•]\s+/,''),lastEl,seen);list.append(lastEl)}
      else{list=null;lastEl=mark(node('p'));conceptInline(line,lastEl,seen);frag.append(lastEl)}
    }else list=null;
    if(here)caretAt=lastEl;
  }
  if(live&&(caretAt||lastEl))(caretAt||lastEl).append(node('span',undefined,'caret'));
  // Der Text wird bei jedem Stück neu aufgebaut; die Leseposition bleibt dabei stehen
  const top=out.scrollTop;out.replaceChildren(frag);out.scrollTop=top;
  // Eine gerade geöffnete Frage rückt samt Optionen in den sichtbaren Bereich
  if(target){if(conceptAsk)setTimeout(()=>target.querySelector('.cask')?.scrollIntoView({block:'center'}),0)}
  else{if(conceptAsk&&conceptAsk!==conceptAskShown)out.querySelector('.cask')?.scrollIntoView({block:'nearest'});conceptAskShown=conceptAsk}
}
// Nach dem Neuschreiben kann dieselbe Entscheidung unter einer anders formulierten Frage stehen:
// Steht deine Antwort dort als erste Option, wandert sie zu dieser Frage mit.
const conceptMarks=text=>[...text.matchAll(/\{\{([^{}|]+)\|([^{}]*)\}\}/g)].map(m=>({q:m[1].trim(),first:(m[2].split("|")[0]||"").trim()}));
function conceptAdopt(text){
  const marks=conceptMarks(text),here=new Set(marks.map(m=>m.q)),norm=x=>x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  for(const [q,a] of Object.entries(s.conceptAnswers)){
    if(here.has(q))continue;
    const hit=marks.find(m=>!s.conceptAnswers[m.q]&&norm(m.first)===norm(a));
    if(hit){s.conceptAnswers[hit.q]=a;delete s.conceptAnswers[q]}
  }
}
function conceptOwnUI(text){
  const here=new Set(conceptMarks(text||"").map(m=>m.q)),box=$("conceptOwn"),own=Object.entries(s.conceptAnswers).filter(([q])=>!here.has(q));
  box.classList.toggle("hidden",!own.length&&!s.conceptWishes.length);box.replaceChildren();if(!own.length&&!s.conceptWishes.length)return;
  box.append(node("span","Von dir festgelegt","eyebrow"));
  for(const [q,a] of own){
    const away=!here.has(q),chip=node("span",a,"ownchip"+(away?" away":"")),x=button("×",undefined,()=>{delete s.conceptAnswers[q];save();if(conceptPush())renderAll();else conceptRefresh()});
    chip.title=q+(away?" – steht im aktuellen Text nicht als eigene Stelle; gilt beim nächsten Neuschreiben weiter":"");x.setAttribute("aria-label","Festlegung entfernen: "+a);chip.append(x);box.append(chip);
  }
  // Eingearbeitete Wünsche: gelten bei jedem Neuschreiben weiter, bis du sie hier entfernst
  s.conceptWishes.forEach((w,i)=>{
    const chip=node("span","✎ "+(w.length>48?w.slice(0,46)+"…":w),"ownchip wish"),x=button("×",undefined,()=>{s.conceptWishes.splice(i,1);save();conceptUI()});
    chip.title="Dein Wunsch: "+w+" – gilt beim Neuschreiben weiter";x.setAttribute("aria-label","Wunsch entfernen: "+w);chip.append(x);box.append(chip);
  });
}
/* ---------- Konzept und Fragen sind dieselben Entscheidungen ---------- */
// Gilt das Konzept noch für die aktuelle Idee?
const conceptLive=()=>!!(s.concept&&s.concept.parts&&s.concept.parts.idea===s.idea.trim());
// Der Text des Konzepts mit eingesetzten Antworten – so geht er als Grundlage in Fragen, Umfang und Spezifikation ein
const conceptPlain=()=>conceptLive()?s.concept.text.replace(/\{\{([^{}|]+)\|([^{}]*)\}\}/g,(_,q,o)=>s.conceptAnswers[q.trim()]||(o.split('|')[0]||'').trim()):'';
// Jede markierte Stelle des Konzepts als Frage: Thema = Abschnitt, Standard = die Annahme im Text, deine Wahl = entschieden
function conceptQuestions(){
  if(!conceptLive())return [];
  const out=[],seen=new Set();
  for(const [title,lines] of conceptSplit(s.concept.text))for(const m of lines.join('\n').matchAll(/\{\{([^{}|]+)\|([^{}]*)\}\}/g)){
    const q=m[1].trim(),opts=[...new Set(m[2].split('|').map(x=>x.trim()).filter(Boolean))].slice(0,4);if(!opts.length||seen.has(q.toLowerCase()))continue;seen.add(q.toLowerCase());
    const mine=s.conceptAnswers[q],at=mine?opts.indexOf(mine):-1;
    if(opts.length<2)opts.push('Anders – noch festzulegen');
    out.push({topic:conceptTopic(title),question:q,options:opts,multi:false,defaults:[0],reason:'Annahme aus dem Entwurf',concept:true,
      state:mine?'decided':'open',choice:mine&&at>=0?[at]:[],custom:mine&&at<0?mine:''});
  }
  return cleanQuestions(out);
}
// Richtung Konzept → Fragen: eine Wahl im Text entscheidet die zugehörige Frage (oder öffnet sie wieder); neue Stellen werden zu neuen Fragen
function conceptPush(){
  if(!s.questions.length||s.askedIdea!==s.idea.trim()||!conceptLive())return;
  const byText=new Map(conceptQuestions().map(q=>[q.question.toLowerCase(),q])),known=new Set(s.questions.map(q=>q.question.toLowerCase()));let changed=false;
  s.questions=s.questions.map(q=>{
    if(!q.concept)return q;const c=byText.get(q.question.toLowerCase());if(!c)return q;
    const mine=s.conceptAnswers[c.question];
    if(mine&&(q.state!=='decided'||answerOf(q)!==mine)){changed=true;const at=q.options.indexOf(mine);return {...q,state:'decided',choice:at>=0?[at]:[],custom:at>=0?'':mine,auto:false}}
    if(!mine&&q.state==='decided'){changed=true;return {...q,state:'open',choice:[],custom:'',auto:false}}
    return q;
  });
  {const before=s.questions.length;s.questions=s.questions.filter(q=>!q.concept||q.state==='decided'||byText.has(q.question.toLowerCase()));if(s.questions.length!==before)changed=true}
  const added=[...byText.values()].filter(q=>!known.has(q.question.toLowerCase()));
  if(added.length){s.questions=[...s.questions,...added].slice(0,40);changed=true}
  // Bewusst ohne erneutes Verteilen nach dem Entscheidungsmodus: Sonst gingen dadurch andere, schon getroffene Annahmen wieder auf
  if(changed){touched();save()}
  return changed;
}
// Richtung Fragen → Konzept: Was bei den Fragen entschieden ist, steht im Text als deine Festlegung; was dort wieder offen oder nur Annahme ist, nicht
function conceptPull(){
  if(!s.questions.length||s.askedIdea!==s.idea.trim())return;
  for(const q of s.questions)if(q.concept){
    const a=q.state==='decided'?answerOf(q):'';
    if(a)s.conceptAnswers[q.question]=a;else delete s.conceptAnswers[q.question];
  }
}
const conceptRefresh=()=>{conceptUI();specUI()};
// Kapitel, die noch nicht geschrieben sind, stehen als Gerüst da: Überschrift und blasse Platzhalterzeilen
function conceptSkeleton(out,have){
  for(const title of conceptSections){
    if(have.has(title))continue;
    const body=node('div',undefined,'skel');body.append(node('i'),node('i'),node('i'));out.append(node('h3',title,'skelhead'),body);
  }
}
function conceptUI(){
  conceptPull();
  const out=$('concept'),note=$('conceptNote'),idea=s.idea.trim(),on=$('ai').checked,key=conceptKey(),own=s.concept;
  scheduleConcept();conceptOwnUI(conceptJob&&conceptJob.text?conceptJob.text:own?own.text:'');
  $('conceptRedo').classList.toggle('hidden',!on||!own||!!conceptJob);
  {const drift=own?conceptMarks(own.text).filter(m=>s.conceptAnswers[m.q]&&s.conceptAnswers[m.q]!==m.first).length:0;$('conceptRedo').classList.toggle('nudge',drift>0);$('conceptRedo').title=drift?plural(drift,'Festlegung weicht','Festlegungen weichen')+' vom Text ab – neu schreiben gleicht den ganzen Text an.':'Schreibt das Konzept neu und berücksichtigt dabei deine Antworten im ganzen Text.'}
  // „Alles akzeptieren“ steht immer da, sobald es ein Konzept gibt; ohne offene Annahmen ist es nicht anklickbar
  {const left=own&&!conceptJob?conceptMarks(own.text).filter(m=>m.first&&!s.conceptAnswers[m.q]).length:0;$('conceptAll').classList.toggle('hidden',!own);$('conceptAll').disabled=!left}
  out.classList.remove('empty','stale','idle');draftRail();
  $('conceptWishBox').classList.toggle('hidden',!on||!own);$('conceptWishRun').disabled=!!conceptJob||!$('conceptWish').value.trim();
  if(conceptJob&&conceptJob.wish){
    // Änderungswunsch: Der Text bleibt stehen; was sich ändert, wird an Ort und Stelle ersetzt
    const got=conceptJob.text.trimStart().startsWith('#')?conceptJob.text:'';
    conceptRender(got?conceptMerge(conceptJob.prev,got+CARET):conceptJob.prev,!!got);
    note.textContent='Claude arbeitet deinen Wunsch ein …';return;
  }
  if(conceptJob&&conceptJob.only){
    // Nur einzelne Abschnitte entstehen neu: Der alte Text bleibt stehen, die betroffenen Abschnitte sind blass, bis ihr neuer Text kommt
    const got=conceptJob.text.trimStart().startsWith('#')?conceptJob.text:'',done=new Set(conceptSplit(got).keys());
    conceptRender(got?conceptMerge(conceptJob.prev,got+CARET):conceptJob.prev,!!got,new Set(conceptJob.only.filter(x=>!done.has(x))));
    note.textContent='Claude schreibt neu: '+conceptJob.only.join(', ')+' …';return;
  }
  if(conceptJob&&conceptJob.text.trimStart().startsWith('#')){conceptRender(conceptJob.text+CARET,true);conceptSkeleton(out,new Set([...conceptJob.text.matchAll(/^## (.+)$/gm)].map(m=>m[1].trim())));note.textContent='Claude schreibt …';return}
  if(conceptJob){out.replaceChildren();conceptSkeleton(out,new Set());note.textContent='Claude beginnt zu schreiben …';return}
  if(own&&own.text){
    // Passt der Text nicht mehr zu Idee oder Reglern, steht er blass da, bis der neue kommt
    const part=own.key!==key?conceptOnly():null;
    out.classList.toggle('stale',(own.key!==key&&!part)||!!conceptJob);conceptRender(own.text,false,part?new Set(part):null);
    const marks=[...new Set([...own.text.matchAll(/\{\{([^{}|]+)\|/g)].map(m=>m[1].trim()))],mine=marks.filter(q=>s.conceptAnswers[q]).length;
    note.textContent=conceptJob?'Claude schreibt …':own.key!==key?(on?'passt nicht mehr zu Idee oder Einstellungen – „Entwurf aktualisieren“ klicken':'passt nicht mehr zur Idee – Claude einschalten'):plural(marks.length-mine,'Annahme','Annahmen')+' · '+Object.keys(s.conceptAnswers).length+' von dir entschieden';
    return;
  }
  // Noch nichts geschrieben: Das Blatt ist leer
  out.classList.add('idle');
  out.replaceChildren(node('p',!on?'Hier steht die Spezifikation. Mit Claude (Schalter oben rechts) entsteht zuerst ihr Grobentwurf; ohne Claude setzt SpecIt sie aus deinen Antworten zusammen.':'Hier entsteht die Spezifikation: links die Idee eingeben und „Entwurf erstellen“ klicken. Zuerst erscheint der Entwurf mit den Stellen, an denen du entscheidest.','drafthint'));
  note.textContent='';
}
// Navigation des Entwurfs: dieselben Kapitel wie später im Dokument; was noch nicht geschrieben ist, steht blass da
function draftRail(){
  const rail=$('draftRail'),text=conceptJob&&conceptJob.text?conceptJob.text:(s.concept&&s.concept.text)||'',have=new Set([...text.matchAll(/^## (.+)$/gm)].map(m=>m[1].trim()));
  // Ohne Entwurf gibt es noch keine Kapitel: Die Gliederung bleibt leer
  rail.classList.toggle('blank',!have.size&&!conceptJob);
  rail.replaceChildren(node('span',have.size||conceptJob?'Grobentwurf':'Gliederung','eyebrow'));if(!have.size&&!conceptJob){rail.append(node('p','Entsteht mit dem Entwurf.','meta railnote'));return}
  // Ältere Entwürfe haben andere Abschnitte: Dann zeigt die Gliederung diese, nicht die künftigen Kapitel
  const own=have.size&&![...have].every(x=>conceptSections.includes(x));
  for(const title of own?[...have]:conceptSections){
    const b=button(undefined,have.has(title)?'':'todo',()=>{const h=[...document.querySelectorAll('#concept h3')].find(x=>x.textContent===title);if(h)h.scrollIntoView({block:'start',behavior:'smooth'})});
    b.append(node('span',title));rail.append(b);
  }
}
function scheduleConcept(){
  clearTimeout(conceptIdle);const key=conceptKey();
  if(conceptJob&&(conceptJob.key!==key||!atIdea()||!$('ai').checked)){conceptJob.ac.abort();conceptJob=null}
  if(conceptJob||!$('ai').checked||active||!atIdea()||(s.concept&&s.concept.key===key)||words(s.idea)<4||Date.now()<conceptPauseUntil)return;
  // Geschrieben wird nur auf Knopfdruck („Konzept erstellen“ / „Konzept aktualisieren“)
  mainUI();
}
let quietScope=false;
async function scopeAfterDraft(){
  if(active||conceptJob||!atIdea()||!conceptLive()||s.questions.length)return;
  quietScope=true;
  try{await derive(false);if(s.questions.length&&!s.features.length&&!active&&atIdea())await startSpec(false)}finally{quietScope=false}
}
async function runConcept(key,wish=''){
  if(conceptJob||active||!atIdea()||key!==conceptKey())return;
  const only=wish?null:conceptOnly(),ac=new AbortController(),epoch=workSession.generation,job={key,ac,text:'',timer:0,only,wish,prev:only||wish?s.concept.text:''};conceptJob=job;conceptAsk='';conceptUI();mainUI();
  try{
    const res=await fetch('/api/spec',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'concept',idea:s.idea.trim(),project:s.project,ai:true,...frame(),minutes:targetMinutes(),answers:Object.entries(s.conceptAnswers).map(([q,a])=>({q,a})),wishes:s.conceptWishes,...(only?{only,prev:job.prev}:{}),...(wish?{wish,prev:job.prev}:{})}),signal:workSession.combine(ac.signal)});
    if(!res.ok||!res.body)throw Error('Entwurf nicht möglich.');
    let fin=null;
    await readNdjson(res.body,m=>{
      if(m.error)throw Error(m.error);
      if(m.done)fin=m;
      else if(m.t&&conceptJob===job&&workSession.isCurrent(epoch)){job.text+=m.t;if(!job.timer)job.timer=setTimeout(()=>{job.timer=0;if(conceptJob===job&&workSession.isCurrent(epoch))conceptUI()},80);}
    });

    if(workSession.isCurrent(epoch)&&fin&&fin.usage)addUsage('concept',fin.usage);
    if(workSession.isCurrent(epoch)&&conceptJob===job&&fin&&fin.text&&key===conceptKey()){const text=only||wish?conceptMerge(job.prev,fin.text):fin.text;conceptAdopt(text);s.concept={key,text,parts:conceptNow()};if(wish){s.conceptWishes=[...s.conceptWishes,wish].slice(-12);$('conceptWish').value=''}save();if(conceptPush())renderAll()}
  }catch(e){if(workSession.isCurrent(epoch)&&!ac.signal.aborted)conceptPauseUntil=Date.now()+6000}
  finally{clearTimeout(job.timer);if(workSession.isCurrent(epoch)){const fin=conceptJob===job&&!ac.signal.aborted;if(conceptJob===job)conceptJob=null;conceptUI();mainUI();stageUI();if(fin&&conceptLive())setTimeout(()=>{if(workSession.isCurrent(epoch))conceptAttention()},120);if(fin&&conceptLive()&&!only&&!wish&&!s.questions.length&&!s.features.length)setTimeout(()=>{if(workSession.isCurrent(epoch))scopeAfterDraft()},200)}}
}
// Änderungswunsch in eigenen Worten: nur bei aktuellem Konzept, sonst wird ohnehin gleich neu geschrieben
const sendWish=()=>{const w=$('conceptWish').value.trim();if(!w||conceptJob||!s.concept)return;clearTimeout(conceptIdle);if(s.concept.key!==conceptKey()){s.conceptWishes=[...s.conceptWishes,w].slice(-12);$('conceptWish').value='';save();conceptUI();return}runConcept(conceptKey(),w)};
$('conceptWishRun').onclick=sendWish;
$('conceptWish').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();sendWish()}};
$('conceptWish').oninput=()=>{$('conceptWishRun').disabled=!!conceptJob||!$('conceptWish').value.trim()};
$('conceptAll').onclick=()=>{
  if(!s.concept)return;const now=Date.now();
  for(const m of conceptMarks(s.concept.text))if(m.first&&!s.conceptAnswers[m.q]){s.conceptAnswers[m.q]=m.first;conceptFlash[m.q]=now}
  conceptAsk='';save();if(conceptPush())renderAll();else conceptRefresh();
};
$('conceptRedo').onclick=()=>{s.concept=null;conceptPauseUntil=0;save();clearTimeout(conceptIdle);runConcept(conceptKey())};
$('ai').addEventListener('change',()=>setTimeout(conceptUI,0));
function sketchUI(){
  const box=$('sketch'),idea=s.idea.trim(),note=$('sketchNote');
  $('sketchBox').classList.toggle('empty',!idea);promptUI();
  conceptUI();if(!SKETCH)return;
  const tools=[$('sketchPlay'),$('sketchDevice'),$('sketchPalette')];
  // zuerst: Ein laufender Strom, der nicht mehr zu Idee und Reglern passt, endet hier
  scheduleAuto();
  if(!idea){sketchSig='';delete box.dataset.shown;box.classList.remove('streaming');box.replaceChildren(node('p','Hier entsteht beim Tippen eine Skizze deiner Anwendung.','meta'));note.textContent='';$('sketchRefine').classList.add('hidden');tools.forEach(tool=>tool.classList.add('hidden'));return}
  const own=s.sketch&&s.sketch.idea===sketchKey()?s.sketch.svg:'';
  $('sketchRefine').classList.toggle('hidden',!$('ai').checked);$('sketchRefine').disabled=active;$('sketchRefine').textContent=own?'↻ Neu zeichnen':'✦ Jetzt von Claude zeichnen';
  tools.forEach(tool=>tool.classList.toggle('hidden',!!own));
  if(own){
    const p=s.sketch.pass||2,tag=s.sketch.idea+p;
    if(box.dataset.shown!==tag){box.classList.remove('streaming');box.replaceChildren(logoNode(own,'100%'));box.dataset.shown=tag}
    note.textContent='Claude · '+(p>=2?'gestalteter Entwurf':'Drahtmodell')+(sketchAuto?' · Gestaltung entsteht live …':'');
  }else{
    delete box.dataset.shown;
    const o=sketchOpts(),draft=localSketch(idea,s.project.trim(),o);
    if(draft.sig!==sketchSig){sketchSig=draft.sig;sketchPlaying=false}
    else if(sketchPlaying)return;
    box.classList.remove('streaming');box.replaceChildren(draft.svg);
    note.textContent='Sofort-Skizze · Komplexität '+o.level+' von 8 · '+plural(draft.kinds.length,'Bereich','Bereiche')+(sketchAuto?' · Claude zeichnet live …':'');
    $('sketchPlay').disabled=false;$('sketchDevice').textContent=sketchPhone?'▭ Desktop':'▯ Handy';$('sketchDevice').setAttribute('aria-pressed',String(sketchPhone));
    // Palette: Bausteine, die in der Idee noch fehlen
    const pal=$('sketchPalette');pal.replaceChildren(node('span','Baustein ergänzen','eyebrow'));
    for(const [kind,label] of sketchKinds)if(!sketchKinds.find(k=>k[0]===kind)[2].test(idea)){const b=button('＋ '+label,'chip pickchip',()=>{const field=$('idea');field.value=s.idea.replace(/[\s.]*$/,'')+' '+sketchPhrase[kind]+'.';field.dispatchEvent(new Event('input'))});b.title='Ergänzt „'+sketchPhrase[kind]+'“ in deiner Idee';pal.append(b);if(pal.children.length>5)break}
  }
  // Was Claude gerade zeichnet, liegt über dem bisherigen Stand
  if(sketchAuto&&sketchAuto.text)drawStream();
  else{box.classList.remove('streaming');box.querySelector('.sk-stream')?.remove();for(const c of box.children)c.classList.remove('sk-under')}
}
$('idea').addEventListener('input',()=>sketchUI());
$('sketchPlay').onclick=playBuild;
$('sketchDevice').onclick=()=>{sketchPhone=!sketchPhone;sketchUI()};
// Auch die Regler formen die Skizze: Zieldauer, Kreativität, Einsatzbereich, Logo
for(const id of ['durLevel','creativity','tone','logoCount','autonomy','nameCount'])$(id).addEventListener('input',()=>setTimeout(sketchUI,0));
// Sofort von vorn: ohne Sperre, die Skizze entsteht sichtbar im Strom
$('sketchRefine').onclick=()=>{
  if(active||!s.idea.trim())return;
  clearTimeout(sketchIdle);if(sketchAuto){sketchAuto.ac.abort();sketchAuto=null}
  s.sketch=null;sketchPauseUntil=0;save();sketchUI();clearTimeout(sketchIdle);runAuto(sketchKey(),1);
};
/* ---------- Stand je Regler ---------- */
// auto = aus Grundeinstellung oder Voreinstellung (gelb), own = selbst eingestellt (grün), missing = Wert fehlt (rot)
const scaleRows=[['autonomy','autonomy','Entscheidungsmodus'],['creativity','creativity','Kreativität der KI'],['tone','tone','Einsatzbereich'],['durLevel','durLevel','Zieldauer'],['logoCount','logoCount','Logo-Entwürfe'],['nameCount','nameCount','Name der Anwendung'],['reviewBy','review','Review der Spezifikation']];
const scaleState=key=>key==='durLevel'&&!s.durLevel?'missing':(s.own&&s.own[key])?'own':'auto';
// Die vier Regler der Einstellungen stehen als Kapseln unter dem Eingabefeld: Kurzname, aktueller Wert, Stand; der Regler selbst klappt darunter auf
const paramNames={autonomy:'Modus',creativity:'Kreativität',tone:'Einsatz',durLevel:'Zieldauer'};
const paramOptions={autonomy:()=>shortAutonomy.map((n,i)=>[n,levels[i][1]]),creativity:()=>shortCreativity.map((n,i)=>[n,creativityLevels[i][1]]),tone:()=>shortTone.map((n,i)=>[n,toneNames[i][1]]),durLevel:()=>durations.map(x=>[x[0],x[2]])};
{const box=$('paramScales'),bar=$('paramBar'),rowOf=id=>{let e=$(id);while(e&&e.parentElement!==box)e=e.parentElement;return e};
  for(const id of Object.keys(paramNames)){
    const row=rowOf(id);if(!row)continue;
    const d=node('details',undefined,'param'),sum=node('summary'),pop=node('div',undefined,'parampop scales');d.dataset.param=id;
    sum.append(node('span',paramNames[id],'pk'),node('b'),node('span',undefined,'pdot'));pop.append(row);d.append(sum,pop);bar.append(d);
    const menu=node('div',undefined,'parammenu');menu.setAttribute('role','listbox');
    paramOptions[id]().forEach(([name,why],v)=>{
      const b=button(undefined,'pmopt',()=>{const inp=$(id);inp.value=v;inp.dispatchEvent(new Event('input',{bubbles:true}));d.open=false;sum.focus()});
      b.dataset.v=v;b.setAttribute('role','option');b.append(node('b',name),node('span',why));menu.append(b);
    });
    pop.append(menu);
  }
  box.remove();
  {const dp=$('durPick');durations.forEach(([name,,why],v)=>{const o=document.createElement('option');o.value=v;o.textContent=v?name:'Bitte wählen';o.title=why;if(!v)o.disabled=true;dp.append(o)});
   dp.addEventListener('change',()=>{const inp=$('durLevel');inp.value=dp.value;inp.dispatchEvent(new Event('input',{bubbles:true}));dp.classList.remove('warn');$('ideaStatus').textContent='';mainUI()})}
  // Immer nur eine Kapsel offen; ein Klick daneben oder Esc schließt sie
  const all=()=>[...bar.querySelectorAll('details.param')];
  for(const d of all())d.addEventListener('toggle',()=>{if(d.open)for(const o of all())if(o!==d)o.open=false});
  // Nach der Auswahl klappt der Regler wieder zu: beim Loslassen der Maus, nach einer Auswahl in der Liste oder beim Bestätigen per Klick auf die Zeile.
  // Mit der Tastatur bleibt er offen, damit man mit den Pfeiltasten in Ruhe einstellen kann (Esc schließt).
  for(const d of all()){
    const shut=()=>setTimeout(()=>{d.open=false},260),pop=d.querySelector('.parampop');
    pop.addEventListener('pointerup',e=>{if(e.target.matches('input[type=range]'))shut()});
    pop.addEventListener('change',e=>{if(e.target.matches('select'))shut()});
    pop.addEventListener('click',e=>{if(!e.target.closest('input,select,button,a,.info,label'))shut()});
  }
  document.addEventListener('click',e=>{if(!bar.contains(e.target))for(const o of all())o.open=false});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const o of all())if(o.open){o.open=false;o.querySelector('summary').focus()}});
}
// Wert und Stand jeder Kapsel folgen dem Regler
function paramUI(){
  for(const d of document.querySelectorAll('#paramBar details.param[data-param]')){
    const id=d.dataset.param,row=d.querySelector('.scales>div'),key=(scaleRows.find(r=>r[0]===id)||[])[1],st=scaleState(key);
    const text=row.querySelector('.scaletext'),val=(text&&(text.querySelector('b')||text).textContent.trim())||'–';
    d.querySelector('summary b').textContent=val;for(const o of d.querySelectorAll('.pmopt'))o.setAttribute('aria-selected',String(Number(o.dataset.v)===Number($(id).value)));d.querySelector('.pdot').className='pdot '+st;d.classList.toggle('missing',st==='missing');
    d.querySelector('summary').title=row.querySelector('label').textContent+': '+(text?text.textContent.trim():val)+(st==='missing'?' – fehlt noch, bitte einstellen':st==='auto'?' – voreingestellt':'');
  }
  {const dp=$('durPick'),v=String($('durLevel').value);if(dp.value!==v)dp.value=v;dp.classList.toggle('missing',v==='0')}
  const on=document.querySelector('#presets .btn[aria-pressed=true]');$('paramPresetVal').textContent=on?on.textContent:'eigene';
}
const scaleMissing=()=>scaleRows.filter(([,key])=>scaleState(key)==='missing').map(([,,name])=>name);
function scaleDots(){
  paramUI();
  // Das Zeichen sagt, wer den Wert gesetzt hat – nicht, wie stark er ist: ? = voreingestellt und noch nicht bestätigt, ✓ = von dir bestätigt oder eingestellt, ! = fehlt
  const text={auto:'Voreingestellt und noch nicht bestätigt. Ein Klick auf die Zeile bestätigt den Wert; du kannst ihn auch ändern.',own:'Von dir bestätigt oder eingestellt.',missing:'Fehlt noch: Bitte einstellen, sonst geht es nicht weiter.'},sign={auto:'?',own:'✓',missing:'!'};
  for(const [id,key] of scaleRows){
    const row=$(id).closest('.scales>div');if(!row)continue;
    let dot=row.querySelector(':scope>.setdot');
    if(!dot){
      dot=node('span',undefined,'setdot');dot.setAttribute('role','img');row.append(dot);
      // Ein Klick auf die Zeile (nicht auf Regler, Auswahl oder Info) bestätigt den voreingestellten Wert
      row.addEventListener('click',e=>{if(e.target.closest('input,select,button,a,.info,label')||scaleState(key)!=='auto')return;s.own={...(s.own||{}),[key]:true};scaleDots();navUI();save()});
    }
    const st=scaleState(key);dot.className='setdot '+st;dot.textContent=sign[st];dot.title=text[st];dot.setAttribute('aria-label',text[st]);row.classList.toggle('confirmable',st==='auto');
  }
}
for(const [id,key] of scaleRows)$(id).addEventListener($(id).tagName==='SELECT'?'change':'input',()=>{s.own={...(s.own||{}),[key]:true};scaleDots();navUI();save()});
$('reviewModel').addEventListener('change',()=>{s.own={...(s.own||{}),review:true};scaleDots();save()});
$('decDerive').onclick=()=>deriveDecisions();
// Zielordner vorschlagen: Projektordner im Home-Verzeichnis (oder laut SPECIT_PROJECTS_DIR) plus Kurzname der Anwendung.
// Der Vorschlag folgt dem Namen, solange das Feld leer ist oder noch den letzten Vorschlag enthält.
let projectsDir='',pathSep='\\';
function suggestRunDir(){
  if(!projectsDir)return;
  const sug=projectsDir+pathSep+repoSlug();$('runDir').placeholder=sug;
  if(!s.runDir.trim()||s.runDir===s.runDirSuggested){if(s.runDir!==sug){s.runDir=sug;$('runDir').value=sug}s.runDirSuggested=sug}
}
// Umsetzung: Die Erklärtexte der Auswahlkacheln und Abschnitte stehen als Tooltip statt als Fließtext
for(const c of document.querySelectorAll('#implBody .choice'))c.title=c.querySelector('span')?.textContent||'';
for(const h of document.querySelectorAll('#implBody .stephead')){const p=h.querySelector('p');if(p&&!p.id&&p.textContent)h.querySelector('h2').title=p.textContent}
$('logoCount').oninput=e=>{s.logoCount=Number(e.target.value);save();logoUI();panelsUI()};
// Dieselbe Anzahl bei der Spezifikation: 0 schaltet das Logo aus, jede Zahl darüber wieder ein
async function deriveLogos(force){
  if(active||!s.logoCount||(!force&&(s.logos.length||brandBusy.logos)))return;
  if(!s.idea.trim()&&!s.spec.trim())return;
  const rev=revision;const lockId=lock(true,'Logo-Entwürfe werden gezeichnet');let message='';
  try{
    const r=await call({mode:'logos',idea:s.idea,spec:s.spec,project:s.project,count:s.logoCount,tone:s.tone,ai:$('ai').checked});
    if(rev===revision){s.logos=cleanLogos(r.logos);s.logoChosen=s.logos.length===1?0:-1}
  }catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message)specNote(message,true);
}

/* ---------- Name der Anwendung: eigener Name oder Vorschläge ---------- */
function namesUI(){
  const named=!!s.project.trim();
  // Die Marke im Kopf des Bereichs folgt immer dem Namen – auch wenn es (nach dem Zurücksetzen) noch keine Idee gibt
  $('nameMeta').textContent=named?'✓ '+s.project.trim():'noch kein Name gewählt';$('nameMeta').className=named?'chip ok namepick':'meta';
  // Der Regler bleibt bedienbar, auch wenn schon ein Name feststeht: Er gilt dann für „Neue Vorschläge“
  $('nameCountValue').textContent=s.nameCount?plural(s.nameCount,'Namensvorschlag','Namensvorschläge'):'Keine Namensvorschläge';
  $('nameCount').setAttribute('aria-valuetext',$('nameCountValue').textContent);
  // Name bei der Spezifikation: gut sichtbar, Vorschläge per Klick, eigener Name per Eingabe
  const box=$('nameBox');
  if(box.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;
  box.replaceChildren();
  const head=node('div',undefined,'namehead'),row=node('div',undefined,'namerow'),own=node('input');
  // Der gewählte Name steht einmal, gut sichtbar, in der Kopfzeile des Bereichs
  for(const n of s.names){
    const mine=n.name===s.project.trim(),b=button((mine?'✓ ':'')+n.name,'chip pickchip namechip'+(mine?' ok':''),()=>applyName(n.name));
    b.title=(n.claim?'„'+n.claim+'“ – ':'')+(n.why?n.why+' – ':'')+'Klicken, um diesen Namen zu übernehmen';b.disabled=active;b.setAttribute('aria-pressed',String(mine));row.append(b);
  }
  {const more=button(s.names.length?'↻ Name':'✦ Name','btn small',()=>{if(!s.nameCount)s.nameCount=1;deriveNames(true)});more.disabled=active||(!s.idea.trim()&&!s.spec.trim());more.title='Claude schlägt Namen vor, die zur Idee passen.';row.append(more)}
  own.type='text';own.maxLength=100;own.placeholder='Name der Anwendung';own.setAttribute('aria-label','Eigener Name der Anwendung');
  own.value=s.project.trim();own.disabled=active;
  own.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();own.blur()}};
  own.onchange=()=>{const v=own.value.trim().slice(0,100);if(v&&v!==s.project.trim())applyName(v)};
  row.append(own);box.append(head,row);
  // Der Claim zum gewählten Namen, sofern der Vorschlag einen mitbringt
  const claim=s.names.find(n=>n.name===s.project.trim())?.claim;if(claim)box.append(node('p','„'+claim+'“','meta'));
}
async function deriveNames(force){
  if(active||!s.nameCount||(!force&&(s.project.trim()||s.names.length||brandBusy.names)))return;
  if(!s.idea.trim()&&!s.spec.trim())return;
  const rev=revision;const lockId=lock(true,'Namensvorschläge werden erzeugt');let message='';
  try{
    const r=await call({mode:'names',idea:s.idea,spec:s.spec,count:s.nameCount,tone:s.tone,avoid:s.names,ai:$('ai').checked});
    if(rev===revision)s.names=cleanNames(r.names);
  }catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  renderAll();if(message)specNote(message,true);
}
// Vorschlag übernehmen: Name setzen und in der Spezifikation nachziehen
async function applyName(name){
  if(active||name===s.project.trim())return;
  const old=s.project.trim();s.project=name;revision++;
  if(!s.spec.trim()){renderAll();return}
  if(s.specSource==='demo'){await generate();return}
  if(!$('ai').checked){s.dirty=true;renderAll();return}
  const prev={questions:s.questions,extras:s.extras,features:s.features,spec:s.spec,specSource:s.specSource,dirty:s.dirty},rev=revision;
  change=null;const lockId=lock(true,'Spezifikation wird ausgearbeitet');let md=null,message='';
  try{md=(await call({mode:'adjust',spec:s.spec,wish:'Die Anwendung heißt „'+name+'“. Ersetze den bisherigen Namen oder Arbeitstitel'+(old?' („'+old+'“)':'')+' überall durch diesen Namen, auch in der Überschrift; sonst ändert sich nichts.',idea:s.idea,project:name,questions:s.questions,extras:s.extras,ai:true,...frame()})).markdown??null}
  catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  if(md===null||rev!==revision){s.dirty=true;renderAll();specNote(message||'Der Name ist gesetzt, die Spezifikation nennt ihn aber noch nicht. Bitte aktualisieren.',true);return}
  s.spec=md;$('spec').value=md;specMode='view';
  change={ids:[],title:'Name übernommen:',detail:name,prev,old:prev.spec,until:0,scroll:false};
  renderAll();flash();
}
function aiUI(){
  const on=$('ai').checked;
  $('mode').textContent=on?'Claude aktiv':available?'Demo-Modus · Claude verfügbar':statusLoaded?'Demo-Modus · kein Claude-Zugang':'Demo-Modus';
  $('mode').classList.toggle('hidden',on||available);
  $('mode').title=on?'Fragen und Spezifikation werden von Claude auf die Idee zugeschnitten'+(provider==='claude-code'?' (über das lokale Claude Code).':'.')
    :available?'Allgemeiner Fragenkatalog, für jede Idee gleich. Mit Claude werden die Fragen auf die Idee zugeschnitten.'
    :'Kein Claude-Zugang gefunden: ANTHROPIC_API_KEY in .env setzen oder Claude Code installieren und anmelden, dann SpecIt neu starten.';
  ideaUI();
  // Hinweis zum Datenfluss am Schalter selbst (die Fußzeile gibt es nicht mehr)
  $('aiSwitch').title=on?'Claude ist aktiv: Projektdaten werden an Anthropic gesendet. Keine vertraulichen Daten eingeben. Der Entwurf wird lokal im Browser gespeichert.':'Mit aktivem Claude werden Projektdaten an Anthropic gesendet. Keine vertraulichen Daten eingeben. Der Entwurf wird lokal im Browser gespeichert.';
  gaugeUI();
}
function setAi(on){
  if(on&&!available){$('ai').checked=false;aiUI();$('mode').textContent='Kein Claude-Zugang – siehe README';return}
  $('ai').checked=on;try{localStorage.setItem('specit-ai',on?'1':'0')}catch{}
  aiUI();
}
$('ai').onchange=()=>setAi($('ai').checked);
$('spec').oninput=e=>{revision++;change=null;s.spec=e.target.value;s.specSource='manual';s.dirty=false;statuses();save()};
for(const id of ['repo','agent'])$(id).oninput=e=>{revision++;s[id]=e.target.value;statuses();save()};
$('plan').onclick=async()=>{
  if(active)return;
  if(!s.spec.trim()||s.dirty){$('planStatus').textContent='Bitte eine aktuelle Spezifikation erzeugen oder manuell aktualisieren.';return}
  const rev=revision,context=ctx();const lockId=lock(true,'Arbeitsaufträge werden erstellt');$('planStatus').textContent='Arbeitsaufträge werden erstellt …';
  try{
    const r=await call({mode:'plan',spec:s.spec,...context,ai:$('ai').checked});
    if(rev!==revision){$('planStatus').textContent='Eingaben geändert. Erneut starten.';return}
    s.plan=validatePlan(r.plan);s.planSource=r.source;s.planSpec=s.spec;s.planContext=context;s.planTrace=r.trace||null;statuses();save();
  }catch(e){$('planStatus').textContent=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
};

/* ---------- Stitch-Layouts ---------- */
// Entwürfe einmal je Stand der Spezifikation von selbst erzeugen – erst hier, wenn das Konzept abgeschlossen ist,
// damit nicht für ein Konzept gestaltet wird, das sich noch ändert.
let layoutTried='';
function autoLayouts(){
  if(!s.layoutOn||!stitch||layoutBusy||active||(s.layout&&s.layout.screens.length))return;
  const key=digest(s.spec);if(layoutTried===key)return;layoutTried=key;setTimeout(()=>{if(!layoutBusy)$('layoutRun').click()},0);
}
// Der Entwurf, den der Nutzer zur Umsetzung gewählt hat
const comboName=(d,t)=>(d==='MOBILE'?'Mobil':'Desktop')+' · '+(t==='DARK'?'Dunkel':'Hell'),groupOf=x=>(x.device||'')+'/'+(x.theme||'');
// Welche Kombinationen aus Gerät und Farbmodus erzeugt werden
function layoutCombos(){const devices=s.layoutDevice==='BOTH'?['DESKTOP','MOBILE']:[s.layoutDevice],themes=s.layoutTheme==='BOTH'?['LIGHT','DARK']:[s.layoutTheme];return devices.flatMap(d=>themes.map(t=>[d,t]))}
function chosenLayout(){
  const l=s.layout,picked=l?l.screens.map((sc,i)=>[sc,i]).filter(([sc])=>(l.chosen||[]).includes(sc.id)):[];
  if(!picked.length)return null;
  return {label:picked.map(([sc,i])=>'Variante '+(i+1)+' – '+sc.title+(sc.device?' ('+comboName(sc.device,sc.theme)+')':'')).join('; '),htmls:picked.map(([sc])=>sc.html).filter(Boolean)};
}
function layoutNote(){
  const l=s.layout;if(layoutBusy||!l||!l.screens.length)return;
  $('layoutStatus').textContent=plural(l.screens.length,'Layout-Variante','Layout-Varianten')+(l.spec!==digest(s.spec)?' · basieren auf einer älteren Spezifikation – bei Bedarf neu generieren.':' · Verweis wird in die Agent-Aufträge übernommen.');
}
function layoutUI(){
  const on=s.layoutOn&&stitch,l=s.layout;
  $('layoutOn').disabled=!stitch;$('layoutOn').checked=on;
  presetsUI();
  $('layoutBody').classList.toggle('hidden',!on);$('layoutRun').disabled=layoutBusy;
  $('layoutMeta').textContent=!stitch?'kein Stitch-Schlüssel':!on?'aus · einschalten':chosenLayout()?'Entwurf gewählt':l&&l.screens.length?plural(l.screens.length,'Entwurf','Entwürfe')+' · keiner gewählt':'noch keine Entwürfe';
  $('layoutLinkRow').classList.toggle('hidden',!l);
  if(l){$('layoutLink').href=l.url;$('layoutLink').textContent=l.url}
  const out=$('layoutGallery');out.replaceChildren();
  (l?l.screens:[]).forEach((sc,i)=>{
    const src='/api/layout/file?name='+encodeURIComponent(sc.image),box=node('figure',undefined,'shot'),img=node('img'),cap=node('figcaption',undefined,'cap'),row=node('div',undefined,'actions'),open=node('a','Öffnen','btn small');
    box.style.margin='0';img.src=src;img.alt='Layout-Variante '+(i+1)+': '+sc.title;img.loading='lazy';
    // Klick auf den Entwurf zeigt ihn groß; „Öffnen“ lädt ihn in einem eigenen Tab
    const zoom=button(undefined,'shotbtn',()=>showShot(i));zoom.setAttribute('aria-label','Variante '+(i+1)+' groß anzeigen');zoom.append(img);
    open.href=src;open.target='_blank';open.rel='noopener';row.append(button('⤢ Groß anzeigen','btn small',()=>showShot(i)),open);
    if(sc.html){const html=node('a','↓ HTML','btn small');html.href='/api/layout/file?name='+encodeURIComponent(sc.html);html.download='layout-variante-'+(i+1)+'.html';row.append(html)}
    // je Kombination (Gerät · Farbmodus) lässt sich ein Entwurf wählen
    const chosen=l.chosen||[],mine=chosen.includes(sc.id),pick=button(mine?'✓ Gewählt':'Auswählen','btn small'+(mine?' primary':''),()=>{
      l.chosen=mine?chosen.filter(id=>id!==sc.id):[...chosen.filter(id=>{const o=l.screens.find(z=>z.id===id);return o&&groupOf(o)!==groupOf(sc)}),sc.id];
      revision++;save();layoutUI();planUI();navUI();panelsUI();
    });
    pick.setAttribute('aria-pressed',String(mine));pick.title='Diesen Entwurf zur Umsetzung auswählen';row.prepend(pick);if(mine)box.classList.add('chosen');
    const title=node('h3','Variante '+(i+1));if(sc.device)title.append(' ',node('span',comboName(sc.device,sc.theme),'chip'));
    cap.append(title,node('span',sc.title,'meta'),row);box.append(zoom,cap);out.append(box);
  });
  const choice=chosenLayout();$('layoutChoice').textContent=!(l&&l.screens.length)?'':choice?'Gewählt: '+choice.label+'. Geht als maßgebliche Vorlage in die Aufträge ein.':'Noch kein Entwurf gewählt. Wähle den, der umgesetzt werden soll – sonst gehen alle nur als unverbindliche Referenz in die Aufträge ein.';
  const combos=layoutCombos(),perCombo=Number($('layoutCount').value)||s.layoutCount,total=perCombo*combos.length;
  $('layoutPlan').textContent=plural(total,'Entwurf entsteht','Entwürfe entstehen')+': '+plural(perCombo,'Variante','Varianten')+' für '+combos.map(c=>comboName(c[0],c[1])).join(', ')+'. Jede Kombination dauert einige Minuten.'+(total>8?' Das ist zu viel für einen Lauf (höchstens 8).':'');
  $('layoutRun').classList.toggle('nudge',!!(l&&l.screens.length&&l.spec!==digest(s.spec))&&!layoutBusy&&!s.dirty);
  $('layoutRun').textContent=l&&l.screens.length?'▦ Layouts neu erstellen':'▦ Layouts generieren';
  if($('layoutWish').value!==s.layoutWish)$('layoutWish').value=s.layoutWish;
  if(!layoutBusy&&!(l&&l.screens.length))$('layoutStatus').textContent='';
  layoutNote();
}
$('layoutOn').onchange=e=>{s.layoutOn=e.target.checked;layoutUI();planUI();navUI();panelsUI();save()};
// Idee-Seite: Anzahl der Entwürfe per Schieberegler, 0 schaltet die Layout-Erstellung aus
$('layoutCount').oninput=e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=5){s.layoutCount=n;save()}};
$('layoutDevice').oninput=e=>{s.layoutDevice=e.target.value;save();layoutUI()};
$('layoutTheme').oninput=e=>{s.layoutTheme=e.target.value;save();layoutUI()};
$('layoutCount').addEventListener('input',()=>layoutUI());
$('layoutWish').oninput=e=>{s.layoutWish=e.target.value;save()};
// Großansicht der Entwürfe mit Blättern (Pfeiltasten) und Schließen (Esc oder Klick neben das Bild)
let shotAt=0;
function showShot(i){
  const list=s.layout?s.layout.screens:[];if(!list.length)return;
  shotAt=(i+list.length)%list.length;const sc=list[shotAt],box=$('lightbox');
  $('lightImg').src='/api/layout/file?name='+encodeURIComponent(sc.image);$('lightImg').alt='Layout-Variante '+(shotAt+1)+': '+sc.title;
  $('lightCap').textContent='Variante '+(shotAt+1)+' von '+list.length+' · '+sc.title;
  $('lightPrev').classList.toggle('hidden',list.length<2);$('lightNext').classList.toggle('hidden',list.length<2);
  if(!box.open)box.showModal();
}
$('wbsClose').onclick=()=>$('wbs').close();$('wbs').onclick=e=>{if(e.target===$('wbs'))$('wbs').close()};
$('lightPrev').onclick=()=>showShot(shotAt-1);$('lightNext').onclick=()=>showShot(shotAt+1);$('lightClose').onclick=()=>$('lightbox').close();
$('lightbox').onclick=e=>{if(e.target===$('lightbox'))$('lightbox').close()};
$('lightbox').onkeydown=e=>{if(e.key==='ArrowLeft')showShot(shotAt-1);else if(e.key==='ArrowRight')showShot(shotAt+1)};
$('layoutCopy').onclick=()=>{if(s.layout)copyText(s.layout.url,$('layoutStatus'),'Link kopiert.')};
$('layoutRun').onclick=async()=>{
  if(layoutBusy)return;
  const status=$('layoutStatus'),count=Number($('layoutCount').value);
  if(!Number.isInteger(count)||count<1||count>5){status.textContent='Bitte Anzahl Varianten zwischen 1 und 5 angeben.';$('layoutCount').focus();return}
  if(!s.spec.trim()||s.dirty){status.textContent='Bitte zuerst eine aktuelle Spezifikation erzeugen.';return}
  const spec=s.spec,project=s.project,wish=s.layoutWish.trim().slice(0,500),combos=layoutCombos();
  if(count*combos.length>8){status.textContent='Das wären '+count*combos.length+' Entwürfe. Bitte die Anzahl Varianten oder die Kombinationen verringern (höchstens 8 je Lauf).';return}
  layoutBusy=true;layoutAbort=new AbortController();const stop=layoutAbort.signal,epoch=workSession.generation;$('layoutRun').disabled=true;working('Stitch erzeugt Layouts');
  try{
    if(!s.layout){
      status.textContent='Stitch-Projekt wird angelegt …';
      const p=await post('/api/layout',{action:'project',project},stop);
      if(!workSession.isCurrent(epoch))return;
      s.layout={projectId:p.projectId,url:p.url,screens:[],known:[],spec:'',chosen:[]};save();layoutUI();
    }
    const l=s.layout,projectId=l.projectId;l.known=l.known||[];
    let all=[];
    for(const [k,[deviceType,theme]] of combos.entries()){
      const name=comboName(deviceType,theme),step=combos.length>1?'Kombination '+(k+1)+' von '+combos.length+' ('+name+'): ':'';
      status.textContent=step+'Erster Entwurf wird erzeugt. Das dauert meist einige Minuten …';working('Stitch erzeugt Layouts · '+name);
      const generated=await post('/api/layout',{action:'generate',projectId,project,spec,wish,tone:s.tone,theme,deviceType,known:l.known},stop);
      if(!workSession.isCurrent(epoch)||s.layout!==l)return;
      let screens=Array.isArray(generated.screens)?generated.screens.slice(0,count):[];
      if(!screens.length)throw Error('Stitch hat keinen verwendbaren Layout-Entwurf geliefert.');
      l.known=[...l.known,...screens.map(x=>x.id)].slice(-50);
      if(screens.length<count){
        status.textContent=step+plural(count-screens.length,'weitere Variante wird','weitere Varianten werden')+' erzeugt …';
        const more=(await post('/api/layout',{action:'variants',projectId,screenId:screens[0].id,count:count-screens.length,deviceType,known:l.known},stop)).screens.slice(0,count-screens.length);
        if(!workSession.isCurrent(epoch)||s.layout!==l)return;
        screens=[...screens,...more];l.known=[...l.known,...more.map(x=>x.id)].slice(-50);
      }
      // Entwürfe erscheinen, sobald ihre Kombination fertig ist; die bisherigen werden mit der ersten ersetzt
      all=[...all,...screens.map(x=>({...x,device:deviceType,theme}))];
      l.screens=all;l.chosen=[];l.spec=digest(spec);save();layoutUI();
    }
    if(workSession.isCurrent(epoch)){layoutBusy=false;layoutUI();planUI();navUI()}
  }catch(e){if(workSession.isCurrent(epoch)){layoutBusy=false;layoutUI();status.textContent=e.message}}
  finally{if(workSession.isCurrent(epoch)){layoutBusy=false;layoutAbort=null;$('layoutRun').disabled=false;if(!active)working('')}}
};

/* ---------- Export ---------- */
function download(name,content){const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function copyText(t,status,ok='Kopiert.'){try{await navigator.clipboard.writeText(t);status.textContent=ok}catch{status.textContent='Kopieren nicht möglich. Bitte manuell markieren oder herunterladen.'}}
$('specDownload').onclick=()=>{if(s.spec)download('SPEC.md',specFile())};
// PDF: Druckvorschau des Browsers mit eigenem Drucklayout (nur die Spezifikation, A4); der Dokumenttitel wird zum Dateinamen
const printTitle=document.title;
$('specPdf').onclick=()=>{if(!s.spec.trim())return;if(specMode!=='view')setSpecMode('view');document.title=s.project.trim()?s.project.trim()+' – Spezifikation':'Spezifikation';window.print()};
addEventListener('afterprint',()=>{document.title=printTitle});
$('json').onclick=()=>{if(s.plan&&!stale())download('tasks.json',JSON.stringify({source:s.planSource,form:agentsNow()===1?'single':'split',context:exportCtx(),spec:s.planSpec,...s.plan},null,2))};
const allText=()=>(agentsNow()===1?renderSingle:renderBacklog)(s.plan,s.planSpec,exportCtx());
$('backlog').onclick=()=>{if(s.plan&&!stale())download(agentsNow()===1?'AUFTRAG.md':'BACKLOG.md',allText())};
$('copyAll').onclick=()=>{if(s.plan&&!stale())copyText(allText(),$('finishHint'))};
$('specDl2').onclick=()=>{if(s.spec)download('SPEC.md',specFile())};
// Obergrenze paralleler Agenten: laut aktuellem Plan, sonst laut Feature-Struktur; technisch höchstens sechs
function planMax(){const p=s.plan&&!stale()?s.plan:null;return Math.max(1,Math.min(6,p?Math.max(...p.waves.map(w=>w.length)):s.features.length?featDuration().max:6))}
const agentsNow=()=>Math.min(Math.max(1,s.featAgents||1),planMax());
$('formSingle').onclick=()=>{s.featAgents=1;renderAll()};
$('formSplit').onclick=()=>{const p=s.plan&&!stale()?s.plan:null;s.featAgents=Math.min(planMax(),Math.max(2,p?recommendAgents(p,targetMinutes()).agents:2));renderAll()};
$('nextDownload').onclick=()=>{s.nextStep='download';renderAll()};
$('nextRun').onclick=()=>{s.nextStep='run';renderAll();pollRun()};
// Schätzung je Agentenzahl aus dem Plan, mit Empfehlung passend zur Zielvorgabe; ein Klick übernimmt die Zahl
function adviceUI(p,agents){
  const box=$('runAdvice');box.replaceChildren();
  if(!p){box.append(node('span',s.plan?'Der Plan ist veraltet. Nach dem Neu-Erstellen steht hier die geschätzte Dauer je Agentenzahl.':'Sobald der Plan erstellt ist, steht hier die geschätzte Dauer je Agentenzahl'+(s.features.length?' (laut Feature-Auswahl derzeit etwa '+hm(featDuration().total)+').':'.')));return}
  const target=targetMinutes(),rec=recommendAgents(p,target),line=node('div'),opts=node('div',undefined,'opts');
  line.append(node('b','Empfehlung: '+(rec.agents===1?'nacheinander mit einem Agenten':rec.agents+' parallele Agenten')+'.'),' '+(
    rec.fits===true?'Voraussichtlich '+hm(rec.minutes)+' – passt in die Zielvorgabe ('+hm(target)+').'
    :rec.fits===false?'Voraussichtlich '+hm(rec.minutes)+' – über der Zielvorgabe ('+hm(target)+'). Mehr Agenten helfen nicht; dafür müsste der Umfang kleiner werden.'
    :'Voraussichtlich '+hm(rec.minutes)+'.'));
  // Woran die Schätzung ausgerichtet ist: an gemessenen Läufen oder nur an Richtwerten
  const cal=run&&run.calib&&run.calib.plan;line.append(node('span',' '+(cal&&cal.runs?'Schätzung an '+plural(cal.runs,'gemessenen Lauf','gemessenen Läufen')+' ausgerichtet.':'Noch kein gemessener Lauf – die Schätzung beruht auf Richtwerten.'),'muted'));
  for(const o of rec.options){const b=button((o.agents===1?'1 Agent':o.agents+' Agenten')+' ≈ '+hm(o.minutes),'chip pickchip'+(o.agents===agents?' ok':''),()=>{s.featAgents=o.agents;renderAll()});b.setAttribute('aria-pressed',String(o.agents===agents));opts.append(b)}
  box.append(line,opts);box.title='Grundlage: geschätzte Bearbeitungszeit je Auftrag ('+(s.planSource==='claude'?'von Claude geschätzt':'Demo-Annahmen')+') und die Abhängigkeiten im Plan'+(rec.fits===null?'; ohne Ziel-Entwicklungsdauer ist die Empfehlung die kleinste Zahl, die kaum langsamer ist als die schnellste':'')+'. Die tatsächliche Dauer kann deutlich abweichen.';
}
// Stand aller Festlegungen als Schlüssel: Ändert sich etwas nach dem Abschluss, ist erneut zu bestätigen
function finishKey(){return digest(JSON.stringify([s.planSpec,s.plan?s.plan.tasks.map(t=>t.id):0,agentsNow(),s.nextStep,s.runDir,s.runShell,s.runModel,exportCtx()]))}
// Übersicht vor dem Abschluss: jede Festlegung mit Sprung zu der Stelle, an der sie sich ändern lässt
function reviewUI(p,agents){
  const box=$('review'),sum=summary(s.questions),c=chosenLayout(),direct=s.nextStep==='run',single=agents===1;box.replaceChildren();
  const jump=id=>()=>$(id).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const row=(label,value,go,warn)=>{const r=node('div',undefined,'reviewrow'+(warn?' warn':'')),b=button('Ändern','link',go);b.setAttribute('aria-label',label+' ändern');r.append(node('span',label,'eyebrow'),node('span',value,'val'),b);box.append(r)};
  row('Abarbeitung',single?'Nacheinander · ein Agent · ein Gesamtauftrag':'Parallel · '+agents+' Agenten · mehrere Teilaufträge',jump('planConfig'));
  row('Plan',p?plural(p.tasks.length,single?'Arbeitsschritt':'Teilauftrag',single?'Arbeitsschritte':'Teilaufträge')+' · voraussichtlich '+hm(estimate(p,agents)):s.plan?'veraltet – bitte neu erstellen':'noch nicht erstellt',jump('planConfig'),!p);
  row('Weiteres Vorgehen',direct?'Direkt umsetzen in '+(s.runDir.trim()||'– Zielordner fehlt –')+(s.runShell?' · Befehle erlaubt':' · ohne Befehle')+(s.runModel?' · '+(agentModels.find(m=>m.id===s.runModel)?.name||s.runModel):''):'Zum Download bereitstellen',jump('nextCard'),direct&&!s.runDir.trim());
  // Abschluss: der Knopf steht direkt unter der Übersicht
  const done=!!p&&s.finished===finishKey(),ready=!!p&&!active&&!runBusy&&!layoutBusy&&(!direct||(agentsOk&&!!s.runDir.trim())),f=$('finish');
  f.textContent=done&&!direct?'✓ Abgeschlossen':direct?'▸ Bestätigen und Umsetzung starten':'✓ Bestätigen und bereitstellen';f.disabled=!ready||(done&&!direct);
  $('finishHint').textContent=!p?'Zum Abschließen fehlt ein aktueller Plan – „Plan erstellen“ (rot markiert).':layoutBusy?'Die Layout-Entwürfe werden noch erzeugt.':direct&&!agentsOk?'Claude Code wurde auf diesem Rechner nicht gefunden; „Direkt umsetzen“ ist nicht möglich.':direct&&!s.runDir.trim()?'Zum Abschließen fehlt der Zielordner (Abschnitt 1, rot markiert).':done?(direct?'':'Abgeschlossen. Die Dateien stehen bereit; eine Änderung der Festlegungen erfordert eine neue Bestätigung.'):'Bitte prüfen. Bestätigt wird mit dem Knopf unten rechts.';
  // Was zum Abschließen fehlt, ist an Ort und Stelle rot markiert; der Hinweis führt per Klick dorthin
  const lacks=!p?'plan':direct&&!agentsOk?'nextRun':direct&&!s.runDir.trim()?'runDir':'';
  for(const id of ['plan','nextRun','runDir'])$(id).classList.toggle('need',lacks===id&&!active&&!runBusy);
  $('finishHint').classList.toggle('missing',!!lacks);$('finishHint').onclick=lacks?()=>{$(lacks).scrollIntoView({block:'center',behavior:'smooth'});$(lacks).focus({preventScroll:true})}:null;
  $('doneBox').classList.toggle('hidden',!(done||(direct&&run&&run.items.length)));
  $('downloads').classList.toggle('hidden',direct||!done);$('runBox').classList.toggle('hidden',!direct);
  for(const id of ['json','backlog','copyAll'])$(id).disabled=!p;
  runUI();
}
$('finish').onclick=async()=>{
  const p=s.plan&&!stale()?s.plan:null;if(!p||active||runBusy)return;
  if(s.nextStep!=='run'){s.finished=finishKey();save();renderAll();$('doneBox').scrollIntoView({block:'nearest'});return}
  if(!s.runDir.trim()){$('finishHint').textContent='Bitte einen Zielordner angeben.';$('runDir').focus();return}
  $('finish').disabled=true;runStarting=true;$('finishHint').textContent='Umsetzung wird gestartet …';runOpen.clear();
  try{
    run=await post('/api/run',{action:'start',featRaw:s.features.filter(f=>f.on).every(f=>f.raw>0)?s.features.filter(f=>f.on).reduce((n,f)=>n+f.raw,0):0,dir:s.runDir,agents:agentsNow(),shell:s.runShell,model:s.runModel,plan:p,spec:s.planSpec,repo:s.repo,reuse:selectedReuse(),...(s.logos[s.logoChosen]?{logo:cleanSvg(s.logos[s.logoChosen].svg)}:{}),...(layoutActive()?{layoutUrl:s.layout.url,...(chosenLayout()?{layoutChoice:chosenLayout().label,layoutHtmls:chosenLayout().htmls}:{})}:{})});
    s.finished=finishKey();save();runBusy=true;renderAll();pollRun();$('doneBox').scrollIntoView({block:'nearest'});
  }catch(e){renderAll();$('finishHint').textContent=e.message}
   finally{runStarting=false}
};

/* ---------- Änderungswunsch zur Spezifikation in eigenen Worten ---------- */
async function adjustSpec(){
  const wish=$('wish').value.trim().replace(/\s+/g,' ').slice(0,500);
  if(active)return;
  if(!wish){specNote('Bitte den Änderungswunsch eingeben.');$('wish').focus();return}
  if(!s.spec.trim()){specNote('Bitte zuerst eine Spezifikation erzeugen.');return}
  const prev={questions:s.questions,extras:s.extras,spec:s.spec,specSource:s.specSource,dirty:s.dirty},rev=++revision;
  change=null;const lockId=lock(true,'Spezifikation wird ausgearbeitet');specNote('Änderungswunsch wird eingearbeitet …');
  let md=null,message='';
  try{md=(await call({mode:'adjust',spec:s.spec,wish,idea:s.idea,project:s.project,questions:s.questions,extras:s.extras,ai:$('ai').checked,...frame()})).markdown??null}
  catch(e){message=e.message}finally{lock(false,undefined,lockId)}
  if(lockId!==currentLockId)return;
  if(md===null||rev!==revision){renderAll();specNote(message||'Der Änderungswunsch konnte nicht eingearbeitet werden. Bitte anders formulieren oder die Spezifikation direkt bearbeiten.',true);return}
  // Der Wunsch bleibt als zusätzliche Anforderung erhalten, damit er ein späteres Neu-Erzeugen übersteht.
  s.spec=md;if(s.extras.length<10)s.extras=[...s.extras,wish];$('spec').value=md;$('wish').value='';specMode='view';
  change={ids:[],title:'Änderungswunsch eingearbeitet:',detail:'„'+wish+'“',prev,old:prev.spec,until:0,scroll:false};
  renderAll();flash();
  if(s.specSource==='claude'&&$('ai').checked&&s.autonomy<100)await deriveDecisions(true);
}
// Mit Spezifikation wird sie angepasst; davor geht der Wunsch in den Entwurf
const wishGo=()=>{if(s.spec.trim())return adjustSpec();const w=$('wish').value.trim();if(!w){$('wish').focus();return}$('conceptWish').value=w;$('wish').value='';sendWish();mainUI();stageUI()};
$('wishRun').onclick=()=>{const had=!!$('wish').value.trim();wishGo();if(had&&$('wishDlg').open)$('wishDlg').close()};
$('wishOpen').onclick=()=>{if(!$('wishDlg').open)$('wishDlg').showModal();$('wish').focus()};
$('wishClose').onclick=()=>$('wishDlg').close();$('wishDlg').onclick=e=>{if(e.target===$('wishDlg'))$('wishDlg').close()};
// Grün wird der Knopf erst, wenn im Feld etwas steht, das noch nicht eingearbeitet ist
$('wish').addEventListener('input',()=>$('wishRun').classList.toggle('has',!$('wish').disabled&&!!$('wish').value.trim()));
$('wish').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('wishRun').click()}};

/* ---------- Direkte Umsetzung über Claude Code ---------- */
// Unter einer Minute in Sekunden, bis zehn Minuten mit einer Nachkommastelle – sonst ginge die Genauigkeit kurzer Laufzeiten verloren
const hm=min=>{if(min>0&&min<0.95)return Math.max(1,Math.round(min*60))+' s';if(min<9.95&&Math.round(min*10)%10)return (Math.round(min*10)/10).toLocaleString('de-DE')+' min';min=Math.round(min);const h=Math.floor(min/60),m=min%60;return (h?h+' h':'')+(h&&m?' ':'')+(m||!h?m+' min':'')};
// Ziel-Entwicklungsdauer in Minuten (Stufen siehe durations)
const targetMinutes=()=>durations[s.durLevel][1];
const dur=sec=>sec<60?sec+' s':hm(sec/60);
const stateNames={waiting:'wartet',running:'läuft',done:'fertig',failed:'Fehler',skipped:'übersprungen',stopped:'gestoppt'};
function runUI(){
  const r=run,busyRun=!!(r&&r.active),list=$('runList');list.replaceChildren();
  $('runStop').classList.toggle('hidden',!busyRun);
  // Übergabe: Sobald ein Lauf beendet ist (auch nach einem Neustart), lässt sich das Ergebnis laden und der Ordner öffnen
  const handover=!busyRun&&s.nextStep==='run'&&!!s.runDir.trim()&&(!!(r&&r.items.length)||s.finished===finishKey());
  $('runZip').classList.toggle('hidden',!handover);$('runZip').classList.toggle('nudge',handover&&zipTaken!==((r&&r.dir)||s.runDir.trim()));$('runOpen').classList.toggle('hidden',!handover);$('runWhere').textContent=handover?'Ergebnis in '+((r&&r.dir)||s.runDir.trim()):'';
  if(!r||!r.items.length){$('runStatus').textContent='';return}
  const done=r.items.filter(x=>x.state==='done').length,bad=r.items.filter(x=>['failed','skipped'].includes(x.state)).length;
  $('runStatus').textContent=(r.active?'Umsetzung läuft':r.stopped?'Umsetzung gestoppt':bad?'Umsetzung beendet – nicht alles abgeschlossen':'Umsetzung abgeschlossen')+' · '+done+' von '+r.items.length+' fertig'+(bad?' · '+bad+' nicht abgeschlossen':'')+' · '+(r.agents===1?'1 Agent, nacheinander':r.agents+' Agenten parallel')+' · '+dur(r.seconds)+' · '+r.dir;
  const item=it=>{
    const row=node('div',undefined,'runitem '+it.state),body=node('div',undefined,'body'),head=node('div');
    head.append(node('b',it.id+' · '),it.title+(it.seconds?' · '+dur(it.seconds):''));body.append(head);
    if(it.note&&it.state!=='running'){const d=node('details');d.open=runOpen.has(it.id);d.ontoggle=()=>{d.open?runOpen.add(it.id):runOpen.delete(it.id)};d.append(node('summary','Bericht des Agenten'),node('pre',it.note));body.append(d)}
    row.append(node('span',stateNames[it.state]||it.state,'chip'+(it.state==='done'?' ok':['failed','skipped'].includes(it.state)?' warn':'')),body);return row;
  };
  // Ein Agent: schlichte Liste. Mehrere: je Agent eine Spalte mit dem, woran er arbeitet und was er erledigt hat
  if(r.agents<2||!r.items.some(x=>x.agent)&&!r.active){for(const it of r.items)list.append(item(it));return}
  const lanes=node('div',undefined,'lanes'),total=Math.max(1,r.seconds);lanes.style.setProperty('--n',r.agents);
  for(let n=1;n<=r.agents;n++){
    const mine=r.items.filter(x=>x.agent===n).sort((a,b)=>b.from-a.from),now=mine.find(x=>x.state==='running'),lane=node('div',undefined,'lane'),head=node('div',undefined,'lanehead'+(now?' busy':'')),bar=node('div',undefined,'lanebar');
    head.append(node('b','Agent '+n),node('span',mine.filter(x=>x.state==='done').length+' fertig'),node('span',now?'arbeitet an '+now.id:r.active?'frei':'','now'));
    for(const it of mine){const seg=node('i',undefined,it.state);seg.style.left=(it.from/total*100)+'%';seg.style.width=(Math.max(1,it.seconds)/total*100)+'%';seg.title=it.id+' · '+dur(it.seconds);bar.append(seg)}
    lane.append(head,bar);if(!now&&r.active)lane.append(node('div','wartet auf den nächsten freien Auftrag','idle'));
    for(const it of mine)lane.append(item(it));
    lanes.append(lane);
  }
  list.append(lanes);
  // Was noch keinem Agenten zugeteilt ist: mit dem Grund, worauf es wartet
  const rest=r.items.filter(x=>!x.agent);
  if(rest.length){
    const q=node('div',undefined,'queue');
    for(const it of rest){const row=node('div',undefined,'runitem '+it.state),b=node('span');b.append(node('b',it.id+' · '),it.title);row.append(node('span',stateNames[it.state]||it.state,'chip'+(['failed','skipped'].includes(it.state)?' warn':'')),b);if(it.state==='waiting')row.append(node('span',(it.waitsFor||[]).length?'nach '+it.waitsFor.join(', '):'sobald ein Agent frei ist','why'));q.append(row)}
    list.append(node('div',r.active?'Warteschlange · '+rest.length:'Nicht begonnen · '+rest.length,'queuehead'),q);
  }
}
let run=null,runTimer=0,runPollId=0,agentsOk=false,runStarting=false;const runOpen=new Set();
// Stand des Laufs vom Server holen; solange er läuft, alle zwei Sekunden erneut
async function pollRun(){
  const pollId=++runPollId,epoch=workSession.generation;
  clearTimeout(runTimer);
  let next;
  try{next=await fetch('/api/run',{signal:workSession.signal}).then(r=>r.json())}catch{return}
  if(!workSession.isCurrent(epoch)||pollId!==runPollId)return;
  run=next;
  // Was im Zielordner entstanden ist, bleibt auch nach einem Neustart des Servers in der Bilanz stehen
  {const out=run.output&&run.output.files?{...run.output,seconds:run.items.reduce((a,x)=>a+(Number(x.seconds)||0),0)}:null;if(out&&JSON.stringify(out)!==JSON.stringify(s.runOutput)){s.runOutput=out;save();effortBar()}}
  const live=!!run.active,was=runBusy;
  if(live){const n=run.items.filter(x=>x.state==='done').length;if(!active)working('Umsetzung läuft · '+n+' von '+run.items.length+' Aufträgen fertig',Date.now()-run.seconds*1000)}
  else if(runBusy&&!active&&!layoutBusy)working('');
  runBusy=live;
  // Beim Wechsel des Zustands die ganze Seite nachziehen, sonst nur die Liste (damit aufgeklappte Aufträge offen bleiben)
  if(was!==live)renderAll();else{$('doneBox').classList.toggle('hidden',!(run.items.length&&s.nextStep==='run')&&s.finished!==finishKey());runUI()}
  if(live)runTimer=setTimeout(pollRun,2000);
}
$('runDir').oninput=e=>{s.runDir=e.target.value;save();reviewUI(s.plan&&!stale()?s.plan:null,agentsNow());navUI()};
$('runShell').onchange=e=>{s.runShell=e.target.checked;save();reviewUI(s.plan&&!stale()?s.plan:null,agentsNow());navUI()};
let zipTaken='';
$('runZip').onclick=async()=>{
  const b=$('runZip'),dir=(run&&run.dir)||s.runDir.trim();b.disabled=true;
  try{
    const res=await fetch('/api/run/download',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({dir})});
    if(!res.ok)throw Error((await res.json().catch(()=>({}))).error||'Download nicht möglich.');
    const url=URL.createObjectURL(await res.blob()),a=node('a');a.href=url;a.download=(repoSlug()||'implementierung')+'.zip';a.click();zipTaken=dir;b.classList.remove('nudge');setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){$('runWhere').textContent=e.message}
  b.disabled=false;
};
$('runOpen').onclick=async()=>{try{await post('/api/run',{action:'open',dir:(run&&run.dir)||s.runDir.trim()})}catch(e){$('runWhere').textContent=e.message}};
$('runStop').onclick=async()=>{try{run=await post('/api/run',{action:'stop'})}catch(e){$('runStatus').textContent=e.message}pollRun()};

function replaceState(next){revision++;next.autonomy=s.autonomy;next.specStrategy=s.specStrategy;next.layoutDevice=s.layoutDevice;next.layoutTheme=s.layoutTheme;s=next;pick=[];custom='';customOpen=false;change=null;catOpen=-1;renderAll()}
// Arbeitsstand zurücksetzen, ohne dass später eintreffende Antworten der vorherigen Sitzung Daten eintragen.
function cancelSessionWork(){
  workSession.invalidate();
  currentLockId++; // ausstehende lock(false)-Aufrufe alter Vorgänge ignorieren
  aborter?.abort();layoutAbort?.abort();conceptJob?.ac.abort();sketchAuto?.ac.abort();preloadTask?.ac.abort();
  clearTimeout(preloadIdle);clearTimeout(conceptIdle);clearTimeout(sketchIdle);clearTimeout(runTimer);
  runPollId++;run=null;runBusy=false;
  conceptJob=null;sketchAuto=null;preloadTask=null;preloadStatus={key:'',state:''};
  active=false;aborter=null;layoutBusy=false;layoutAbort=null;streamText=null;paintAt=0;
  tidyBusy='';featTried='';poolBusy=false;poolDry='';poolTries=0;poolFor='';
  brandBusy.names=brandBusy.logos=false;brandTried.names=brandTried.logos='';
  for(const kind of Object.keys(diagBusy)){diagBusy[kind]=false;diagTried[kind]='';diagNote[kind]=''}
  working('');
}
// Zurücksetzen bleibt widerrufbar; aktive Coding-Agenten müssen zuvor ausdrücklich gestoppt werden.
let undoTimer=0;
$('reset').onclick=()=>{
  if(runBusy||runStarting){
    $('implPanel').open=true;
    $('runStatus').textContent=runStarting?'Bitte warten, bis der Agentenlauf gestartet ist, und ihn dann stoppen.':'Bitte die laufende Umsetzung zuerst mit „Abbrechen“ stoppen.';
    if(runBusy)$('runStop').focus();
    return;
  }
  const before=s,fresh=blank(),toast=$('toast');
  cancelSessionWork();replaceState(fresh);lock(false);s.autonomy=blank().autonomy;s.phase=0;catGroups.clear();renderAll();window.scrollTo({top:0});$('idea').focus();
  const undo=button('↶ Rückgängig','btn small',()=>{clearTimeout(undoTimer);toast.classList.add('hidden');revision++;s=before;change=null;catOpen=-1;if(s.active>=0)activate(s.active,false);renderAll()});
  toast.replaceChildren(node('span','Alles zurückgesetzt.'),undo);toast.classList.remove('hidden');
  clearTimeout(undoTimer);undoTimer=setTimeout(()=>toast.classList.add('hidden'),20000);
};

function renderAll(){
  if($('project').value!==s.project)$('project').value=s.project;$('nameCount').value=s.nameCount;
  namesUI();
if($('idea').value!==s.idea)$('idea').value=s.idea;
  if($('spec').value!==s.spec)$('spec').value=s.spec;
  $('creativity').value=s.creativity;$('tone').value=s.tone;
  $('autonomy').value=s.autonomy/20;$('durLevel').value=s.durLevel;
  $('repo').value=s.repo;$('agent').value=s.agent;$('layoutCount').value=s.layoutCount;$('layoutDevice').value=s.layoutDevice;$('layoutTheme').value=s.layoutTheme;
  ideaUI();questionsUI();gaugeUI();specUI();statuses();layoutUI();strategyUI();save();scheduleSpecPreload();ensureBrand();ensurePool();
}
if(s.phase===1)s.phase=2;
if(inQuestions()&&s.active<0)activate(firstOpen(),false);else if(s.active>=0)activate(s.active,false);
renderAll();
fetch('/api/status').then(r=>r.json()).then(r=>{
  available=!!r.available;provider=r.provider||null;statusLoaded=true;gpuAvailable=!!r.gpu;specModels=r.specModels&&typeof r.specModels==='object'?r.specModels:{};stitch=!!r.stitch;agentsOk=!!r.agents;setAgentSkill(r.agentSkill);reviewers=Array.isArray(r.reviewers)?r.reviewers:[];agentModels=Array.isArray(r.models)?r.models:[];runModelUI();projectsDir=typeof r.projectsDir==='string'?r.projectsDir:'';pathSep=r.pathSep==='/'?'/':'\\';suggestRunDir();$('repoNew').disabled=!r.github;$('repoNew').title=r.github?'Legt über die GitHub-CLI ein leeres Repository in deinem Konto an.':'Dafür die GitHub-CLI einrichten: im Terminal „gh auth login“, dann SpecIt neu starten.';reviewChoiceUI();specReviewUI();pollRun();setTimeout(ensureFeatures,0);
  let wanted=false;try{wanted=localStorage.getItem('specit-ai')==='1'}catch{}
  $('ai').checked=available&&wanted;aiUI();
  if(!stitch)$('layoutHint').textContent='Kein STITCH_API_KEY konfiguriert. Schlüssel in .env setzen und neu starten, siehe README.';
  // Erst jetzt steht fest, ob Claude Code und Stitch verfügbar sind: alles nachziehen, was davon abhängt
  layoutUI();renderAll();
}).catch(()=>{$('mode').classList.remove('hidden');$('mode').textContent='Server nicht erreichbar'});
aiUI();
// Lebenszeichen: Solange diese Verbindung steht, läuft der Server. Wird die letzte Seite geschlossen, beendet er sich.
const live=new EventSource('/api/alive');let boot='';
live.addEventListener('hello',e=>{if(boot&&boot!==e.data)location.reload();boot=e.data});
