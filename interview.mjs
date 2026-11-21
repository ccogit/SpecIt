// Interview: aus einem Satz werden Fragen mit Antwortoptionen und vorbelegten Standards.
// Geteilt zwischen Server (Validierung, Demo, Prompt) und Browser (Darstellung, Fortschritt).
import { withToc } from './markdown.mjs';

export const topics =['Ziel', 'Nutzer', 'Funktionen', 'UX', 'Technik', 'Qualität'];
export const states = ['open', 'default', 'decided'];

const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Prüft und normalisiert eine Frage; liefert null, wenn sie unbrauchbar ist. */
export function cleanQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const question = text(q.question, 240);
  const options = [...new Set((Array.isArray(q.options) ? q.options : []).map(o => text(o, 140)).filter(Boolean))].slice(0, 5);
  if (!question || options.length < 2) return null;
  const topic = typeof q.topic === 'number' ? q.topic : topics.findIndex(t => t.toLowerCase() === String(q.topic || '').trim().toLowerCase());
  const multi = q.multi === true;
  const valid = xs => [...new Set((Array.isArray(xs) ? xs : []).filter(i => Number.isInteger(i) && i >= 0 && i < options.length))];
  let defaults = valid(q.defaults);
  if (!defaults.length) defaults = [0];
  if (!multi) defaults = defaults.slice(0, 1);
  const state = states.includes(q.state) ? q.state : 'open';
  let choice = valid(q.choice);
  if (!multi) choice = choice.slice(0, 1);
  const custom = text(q.custom, 500);
  return {
    topic: topic >= 0 && topic < topics.length ? topic : 2,
    question, options, multi, defaults,
    reason: text(q.reason, 240),
    state: state !== 'open' && !choice.length && !custom ? 'open' : state,
    choice, custom,
    // Vom Autonomiegrad selbst entschieden (nur solange es eine Annahme ist); so lässt es sich zurücknehmen.
    auto: q.auto === true && state === 'default' && (choice.length > 0 || !!custom),
  };
}

export function cleanQuestions(list, max = 40) {
  if (!Array.isArray(list)) throw Error('Ungültige Fragenliste.');
  const seen = new Set(), out = [];
  for (const raw of list) {
    const q = cleanQuestion(raw);
    if (!q || seen.has(q.question.toLowerCase())) continue;
    seen.add(q.question.toLowerCase());
    out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

/** Antwort als Text; leer, solange die Frage offen ist. */
export function answerOf(q) {
  if (q.state === 'open') return '';
  return [...q.choice.map(i => q.options[i]), q.custom].filter(Boolean).join('; ');
}

export const acceptDefault = q => ({ ...q, state: 'default', choice: [...q.defaults], custom: '' });

/**
 * Autonomiegrad 0–100: Anteil der Fragen, die SpecIt selbst mit dem Standard entscheidet. Die Fragen sind
 * nach Tragweite geordnet, also bleiben die ersten beim Menschen. 0 = alles fragen, 100 = nichts fragen.
 * Selbst Entschiedenes wird wieder geöffnet, wenn der Grad sinkt; Antworten des Menschen bleiben unberührt.
 */
export function applyAutonomy(questions, autonomy) {
  const ask = Math.round(questions.length * (1 - Math.min(100, Math.max(0, autonomy)) / 100));
  return questions.map((q, i) => (i >= ask && q.state === 'open' ? { ...acceptDefault(q), auto: true }
    : i < ask && q.auto && q.state === 'default' ? { ...q, state: 'open', choice: [], custom: '', auto: false } : q));
}

/**
 * Ohne KI: Welche offenen Entscheidungen bleiben beim Menschen? Die zu Ziel, Nutzern und Funktionen –
 * sie legen fest, was gebaut wird; UX, Technik und Qualität haben tragfähige Standards. Liefert Positionen.
 */
export const demoRelevant = questions => questions.map((q, i) => (q.state === 'open' && q.topic <= 2 ? i : -1)).filter(i => i >= 0);

export const triagePrompt = 'Die Liste open enthält offene Entscheidungen eines Softwareprojekts (id, Thema, Frage, Optionen, default = vorgeschlagener Standard). Bestimme, welche davon wirklich relevant sind und deshalb vom Menschen getroffen werden müssen: Entscheidungen, die Zweck, Zielgruppe oder Kernfunktion festlegen, die Kosten, Datenschutz oder Sicherheit berühren, die später nur mit großem Aufwand umkehrbar sind oder bei denen der Standard für genau diese Idee erkennbar riskant ist. Alle übrigen kann das Werkzeug mit dem Standard selbst entscheiden. Sei streng: im Zweifel ist eine Entscheidung nicht relevant. Liefere ausschließlich JSON ohne Markdown-Codeblock: {"relevant":[ids]}.';

/** Zusatz für die Prompts: wie viel Claude selbst entscheiden darf und wie viel Entwicklungszeit zur Verfügung steht. */
export function framePrompt(autonomy, duration) {
  const a = autonomy >= 100 ? 'Auto-Modus: Es wird nicht rückgefragt. Triff jede noch offene Entscheidung selbst, begründe sie knapp und kennzeichne sie als Annahme; der Abschnitt „Offene Entscheidungen“ bleibt leer.'
    : autonomy <= 0 ? 'Triff keinerlei eigene Annahmen und setze keine Standards: Alles, was Idee und Antworten nicht ausdrücklich festlegen, ist eine offene Entscheidung.'
    : (autonomy <= 20 ? 'Entscheide nur Nebensächliches selbst; alles andere, was Idee und Antworten nicht festlegen, bleibt eine offene Entscheidung.'
      : autonomy <= 40 ? 'Entscheide Detailfragen selbst; alle wichtigen Entscheidungen, die Idee und Antworten nicht festlegen, bleiben offene Entscheidungen.'
      : autonomy <= 60 ? 'Entscheide alles selbst, was Idee und Antworten nicht festlegen, außer richtungsweisenden Entscheidungen (Zweck, Zielgruppe, Kernfunktion, Datenhaltung, Kosten, schwer Umkehrbares); nur diese bleiben offene Entscheidungen.'
      : 'Entscheide nahezu alles selbst; offen bleiben nur die wenigen grundlegenden Entscheidungen, von denen das ganze Vorhaben abhängt.')
      + ' Kennzeichne jede eigene Entscheidung als Annahme. Erwähne diese Vorgabe selbst nicht in der Spezifikation.';
  return ' ' + a + (duration ? ' Ziel-Entwicklungsdauer (targetDuration): ' + duration + ' reine Entwicklungszeit mit KI und Coding-Agenten. Schneide den Umfang so zu, dass er in dieser Zeit umsetzbar ist, nenne die Dauer als Rahmenbedingung und verschiebe, was nicht hineinpasst, ausdrücklich in Nicht-Ziele oder eine spätere Version.' : '');
}

export function summary(questions) {
  const count = s => questions.filter(q => q.state === s).length;
  return { total: questions.length, decided: count('decided'), defaults: count('default'), open: count('open') };
}

/**
 * Pegel des Minimal-Konzepts in Prozent. Jedes der sechs Themen zählt gleich viel und gilt in dem Maß
 * als gedeckt, in dem seine Fragen beantwortet sind (entschieden oder Standard übernommen).
 * Ein Thema ohne Fragen ist noch nicht gedeckt.
 */
export function coverage(questions) {
  const perTopic = topics.map((_, i) => {
    const own = questions.filter(q => q.topic === i);
    return own.length ? own.filter(q => q.state !== 'open').length / own.length : 0;
  });
  return { percent: Math.round(perTopic.reduce((a, b) => a + b, 0) / topics.length * 100), perTopic };
}

// Demo ohne KI: generischer Katalog mit Standards, die für die meisten Projekte passen.
const catalog = [
  [0, 'Was ist das wichtigste Ergebnis der ersten Version?', ['Ein nutzbarer Kernablauf von Anfang bis Ende', 'Ein klickbarer Prototyp zum Testen der Idee', 'Vollständiger Funktionsumfang'], [0], 'Ein durchgängiger Kernablauf liefert am schnellsten echten Nutzen.'],
  [0, 'Woran wird der Erfolg gemessen?', ['Kernablauf gelingt ohne Hilfe', 'Regelmäßige Nutzung', 'Zeitersparnis gegenüber heute', 'Noch offen'], [0], 'Ohne Analytics prüfbar und für fast jedes Projekt sinnvoll.'],
  [1, 'Wer nutzt die Anwendung?', ['Eine einzelne Person', 'Ein kleines Team', 'Öffentliche Nutzer', 'Mehrere Rollen mit unterschiedlichen Rechten'], [1], 'Kleine Teams sind der häufigste Startpunkt.'],
  [1, 'Wie melden sich Nutzer an?', ['Keine Anmeldung', 'E-Mail und Passwort', 'Anmeldung über bestehenden Anbieter (SSO)'], [0], 'Ohne Konten entfällt viel Aufwand; später nachrüstbar.'],
  [2, 'Was passiert mit Eingaben beim Schließen?', ['Automatisch speichern', 'Nur auf ausdrücklichen Wunsch speichern', 'Nichts speichern'], [0], 'Automatisches Speichern verhindert Datenverlust.'],
  [2, 'Wie wird mit Fehleingaben umgegangen?', ['Direkt am Feld erklären und Korrektur anbieten', 'Sammelmeldung beim Absenden', 'Eingabe still verwerfen'], [0], 'Rückmeldung am Ort des Fehlers ist am verständlichsten.'],
  [3, 'Auf welchen Geräten wird die Anwendung genutzt?', ['Desktop und Mobil (responsiv)', 'Nur Desktop', 'Nur Mobil'], [0], 'Responsiv deckt die meisten Nutzungssituationen ab.'],
  [3, 'In welcher Sprache ist die Oberfläche?', ['Deutsch', 'Englisch', 'Mehrsprachig'], [0], 'Entspricht der Sprache der Idee.'],
  [3, 'Welches Maß an Barrierefreiheit gilt?', ['WCAG 2.2 AA: Tastatur, Kontrast, Screenreader', 'Nur grundlegende Tastaturbedienung', 'Keine besonderen Anforderungen'], [0], 'AA ist der übliche Standard und früh am günstigsten.'],
  [4, 'Wo werden Daten gespeichert?', ['Lokal im Browser', 'Auf einem eigenen Server mit Datenbank', 'In einem Cloud-Dienst'], [0], 'Lokal braucht weder Backend noch Datenschutzvertrag.'],
  [4, 'Welche Plattform wird gebaut?', ['Web-App im Browser', 'Native Mobile-App', 'Desktop-Anwendung', 'Kommandozeile oder API'], [0], 'Eine Web-App läuft ohne Installation überall.'],
  [4, 'Wie viel technische Abhängigkeit ist gewünscht?', ['So wenig wie möglich, Standardtechnik', 'Etabliertes Framework', 'Freie Wahl des Agenten'], [0], 'Wenige Abhängigkeiten halten Wartung und Risiko klein.'],
  [5, 'Wie wird die Qualität abgesichert?', ['Automatisierte Tests der Kernlogik', 'Manuelle Abnahme der Abläufe', 'Tests für Rand- und Fehlerfälle', 'Keine Tests'], [0, 2], 'Kernlogik und Randfälle fangen die teuersten Fehler ab.', true],
  [5, 'Wie wird die Anwendung betrieben?', ['Lokal starten, keine Veröffentlichung', 'Statisches Hosting', 'Eigener Server'], [0], 'Lokal genügt bis zur ersten Abnahme.'],
];

export function demoQuestions(existing = []) {
  const asked = new Set(existing.map(q => q.question.toLowerCase()));
  return cleanQuestions(catalog.map(([topic, question, options, defaults, reason, multi]) => ({ topic, question, options, defaults, reason, multi: multi === true })))
    .filter(q => !asked.has(q.question.toLowerCase()));
}

/** Demo-Spezifikation: Antworten je Thema, Standards als Annahmen markiert, Offenes gesammelt. */
export const cleanExtras = list => (Array.isArray(list) ? list.map(x => text(x, 500)).filter(Boolean).slice(0, 10) : []);

/** Zeile einer beantworteten Frage im Demo-Entwurf. */
export const specLine = q => '- **' + q.question + '** ' + answerOf(q) + (q.state === 'default' ? ' _(Annahme – Standard)_' : '');

export function demoSpec(project, idea, questions, extras = [], duration = '') {
  const parts = ['# ' + (project.trim() || 'Projektspezifikation'), '> Demo: Zusammenführung ohne KI-Konsolidierung.', '## Idee', idea.trim() || 'Offen'];
  if (duration) parts.push('## Rahmen', '- **Ziel-Entwicklungsdauer** ' + duration + ' (mit KI und Coding-Agenten)');
  topics.forEach((name, i) => {
    const rows = questions.filter(q => q.topic === i && q.state !== 'open');
    parts.push('## ' + name, rows.length ? rows.map(specLine).join('\n') : 'Offen');
  });
  if (extras.length) parts.push('## Zusätzliche Anforderungen', extras.map(x => '- ' + x).join('\n'));
  const open = questions.filter(q => q.state === 'open');
  parts.push('## Offene Entscheidungen', open.length ? open.map(q => '- ' + q.question).join('\n') : 'Keine.');
  return withToc(parts.join('\n\n'));
}

/**
 * Wendet Ersetzungen {find, replace} nacheinander an. Jede Fundstelle muss genau einmal vorkommen;
 * sonst (oder wenn sich nichts ändert) null, damit der Aufrufer die Spezifikation neu erzeugt.
 */
export function applyEdits(spec, edits) {
  if (!Array.isArray(edits) || !edits.length || edits.length > 40) return null;
  let out = spec;
  for (const e of edits) {
    if (!e || typeof e.find !== 'string' || typeof e.replace !== 'string' || !e.find.trim()) return null;
    const at = out.indexOf(e.find);
    if (at < 0 || out.indexOf(e.find, at + 1) >= 0) return null;
    out = out.slice(0, at) + e.replace + out.slice(at + e.find.length);
  }
  return out !== spec && out.trim() && out.length <= 50000 ? out : null;
}

/**
 * Passt eine Spezifikation ohne KI an eine geänderte Antwort an: Ist sie der unveränderte Demo-Entwurf,
 * wird er neu zusammengeführt; sonst wird genau die Zeile der Frage ersetzt. null, wenn beides nicht geht.
 */
export function reviseDemo(spec, project, idea, before, after, extras, index, duration = '') {
  if (spec === demoSpec(project, idea, before, extras, duration)) return demoSpec(project, idea, after, extras, duration);
  const a = before[index], b = after[index];
  if (!a || !b || a.state === 'open' || b.state === 'open') return null;
  return applyEdits(spec, [{ find: specLine(a), replace: specLine(b) }]);
}

export const revisePrompt = 'Im Interview wurden eine oder mehrere Antworten geändert (changes: je Frage die bisherige und die neue Antwort; „(offen)“ = bisher unbeantwortet). Passe die bestehende Spezifikation (spec) so an, dass sie den neuen Antworten entspricht: alle Stellen, die von den bisherigen Antworten abhängen, auch Folgerungen in anderen Abschnitten (z. B. Architektur, Risiken, Akzeptanzkriterien), und entferne beantwortete Punkte aus den offenen Entscheidungen. Eine neue Antwort mit assumption=true ist ein übernommener Standard und als Annahme zu kennzeichnen, sonst ist sie eine bestätigte Vorgabe. Alles Übrige bleibt wörtlich unverändert. Liefere ausschließlich JSON ohne Markdown-Codeblock: {"edits":[{"find":"...","replace":"..."}]}. find ist ein zeichengenauer Ausschnitt der Spezifikation, der dort genau einmal vorkommt (so kurz wie möglich, so lang wie für die Eindeutigkeit nötig); replace ersetzt ihn, ein leerer Wert löscht ihn. Die Ersetzungen werden nacheinander angewendet und dürfen sich nicht überlappen.';

export const questionPrompt = more => (more
  ? 'Prüfe Idee und bisherige Antworten. Stelle 0–5 weitere Fragen, nur wenn wesentliche Lücken für eine umsetzbare Spezifikation bleiben oder eine Antwort eine Folgeentscheidung auslöst. Keine bereits gestellte Frage wiederholen.'
  : 'Leite aus der Idee 10–14 Fragen ab, deren Antworten zusammen das Minimal-Konzept einer umsetzbaren Spezifikation ergeben. Die Fragen müssen genau auf diese Idee zugeschnitten sein: Denke die Idee zuerst zu Ende (Domäne, typische Abläufe, naheliegende Stolpersteine genau dieser Art von Anwendung) und frage dann nach den Entscheidungen, an denen sich solche Projekte tatsächlich unterscheiden. Verwende die Begriffe der Idee, nenne in den Optionen konkrete Ausprägungen statt Kategorien und frage nie etwas, das aus der Idee bereits hervorgeht oder für jedes beliebige Projekt gleich lauten würde. Decke jedes der Themen Ziel, Nutzer, Funktionen, UX, Technik und Qualität mit mindestens einer Frage ab und beginne mit den Entscheidungen mit der größten Wirkung.')
  + questionFormat;

const questionFormat = ' Jede Frage muss sich mit einem Klick beantworten lassen: 2–5 konkrete, sich ausschließende Antwortoptionen (kurz, ohne „Sonstiges“), dazu als Standard die Option, die für die meisten Projekte dieser Art passt, mit einem kurzen Grund. multi=true nur, wenn mehrere Optionen gleichzeitig sinnvoll sind.  Formuliere sachlich und knapp, ohne Werbesprache. Ausschließlich JSON ohne Markdown-Codeblock: {"questions":[{"topic":"Ziel|Nutzer|Funktionen|UX|Technik|Qualität","question":"...","options":["..."],"multi":false,"defaults":[0],"reason":"..."}]}';

/** Offene Entscheidungen der Spezifikation als Fragen mit Alternativen – gleicher Aufbau wie die Interviewfragen. */
export const decisionPrompt = 'Die Spezifikation (spec) nennt offene Entscheidungen: im Abschnitt „Offene Entscheidungen“ und überall, wo etwas als offen, ungeklärt oder noch zu entscheiden gekennzeichnet ist. Formuliere für jede dieser offenen Entscheidungen genau eine Frage mit den realistischen Entscheidungsalternativen, in der Reihenfolge der Spezifikation, höchstens 12. Lasse Entscheidungen aus, die eine bereits gestellte Frage (asked) abdeckt, und erfinde keine, die die Spezifikation nicht als offen nennt. Verwende die Begriffe der Spezifikation.' + questionFormat;
