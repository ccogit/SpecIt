/**
 * Lightweight, deterministic hints for the first screen.
 * These are expressly not AI-generated requirements: real generation is handled
 * by the existing /api/spec pipeline, which discloses its demo fallback.
 */
export const IDEA_EXAMPLES = Object.freeze([
  {title:'Team-Workspace',text:'Eine App, die kleine Teams dabei unterstützt, Aufgaben, Zuständigkeiten und Fortschritt ohne komplizierte Projektverwaltung zu organisieren.'},
  {title:'Immobilien-Cockpit',text:'Eine moderne App für Immobilienmakler, die Objekte, Interessenten, Besichtigungen und passende Exposés zentral organisiert.'},
  {title:'Lernbegleiter',text:'Eine App, die Lernenden aus ihrem Ziel einen persönlichen Lernplan mit kleinen Übungen und verständlichem Feedback erstellt.'},
  {title:'Event-Planer',text:'Eine App, mit der Freunde und Gruppen gemeinsame Aktivitäten vorschlagen, abstimmen und anschließend organisieren können.'}
]);
const DOMAINS=[
  {rx:/immobil|makler|wohnung|expos[eé]|besichtigung|mieter|objekte/i,title:'Immobilien',ideas:['Objektübersicht','Interessenten-Journey','Terminablauf']},
  {rx:/lern|kurs|schule|training|vokabel|unterricht|wissen/i,title:'Lernen',ideas:['Individuelle Lernpfade','Fortschrittsfeedback','Wiederholungen']},
  {rx:/team|aufgabe|projekt|zusammenarbeit|workflow|kanban/i,title:'Zusammenarbeit',ideas:['Klarer Workflow','Rollen & Rechte','Status auf einen Blick']},
  {rx:/event|veranstaltung|freunde|party|gruppe|treffen|termin/i,title:'Organisation',ideas:['Schnelle Planung','Einladungen','Gemeinsame Entscheidungen']},
  {rx:/shop|verkauf|bestell|kauf|handel|produkt|warenkorb/i,title:'Commerce',ideas:['Produktentdeckung','Bestellprozess','Vertrauen & Sicherheit']},
  {rx:/gesund|fitness|sport|lauf|ern[aä]hr|wellness/i,title:'Lifestyle',ideas:['Persönlicher Verlauf','Einfache Routinen','Nutzerkontrolle']},
  {rx:/finanz|budget|kosten|rechnung|sparen|ausgabe/i,title:'Finanzen',ideas:['Klarer Überblick','Automatisierung','Nachvollziehbarkeit']}
];
const GENERIC=['Nutzerbedürfnisse','Kernablauf','Qualität & Vertrauen'];
export function conceptSignals(raw){
  const idea=String(raw??'').trim();
  const wordCount=(idea.match(/\S+/g)||[]).length;
  if(!idea)return {ready:false,wordCount:0,title:'Dein Produkt, klarer gedacht',ideas:GENERIC,area:'Noch keine Idee',hint:'Ein Satz reicht, um den ersten Entwurf anzustoßen.'};
  const domain=DOMAINS.find(x=>x.rx.test(idea));
  return {
    ready:idea.length>=12,wordCount,
    title:domain?domain.title+'-Konzept':'Individuelles App-Konzept',
    area:domain?.title||'Eigene Produktidee',
    ideas:domain?.ideas||GENERIC,
    hint:wordCount<5?'Ein etwas konkreterer Satz hilft, das Ziel besser zu treffen.':'Erste Themen zur Orientierung – die tatsächlichen Anforderungen ermittelt SpecIt im nächsten Schritt.'
  };
}
