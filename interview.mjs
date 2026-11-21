// Interview: aus einem Satz werden Fragen mit Antwortoptionen und vorbelegten Standards.
// Geteilt zwischen Server (Validierung, Demo, Prompt) und Browser (Darstellung, Fortschritt).
export const topics = ['Ziel', 'Nutzer', 'Funktionen', 'UX', 'Technik', 'Qualität'];
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

export function demoSpec(project, idea, questions, extras = []) {
  const parts = ['# ' + (project.trim() || 'Projektspezifikation'), '> Demo: Zusammenführung ohne KI-Konsolidierung.', '## Idee', idea.trim() || 'Offen'];
  topics.forEach((name, i) => {
    const rows = questions.filter(q => q.topic === i && q.state !== 'open');
    parts.push('## ' + name, rows.length ? rows.map(q => '- **' + q.question + '** ' + answerOf(q) + (q.state === 'default' ? ' _(Annahme – Standard)_' : '')).join('\n') : 'Offen');
  });
  if (extras.length) parts.push('## Zusätzliche Anforderungen', extras.map(x => '- ' + x).join('\n'));
  const open = questions.filter(q => q.state === 'open');
  parts.push('## Offene Entscheidungen', open.length ? open.map(q => '- ' + q.question).join('\n') : 'Keine.');
  return parts.join('\n\n');
}

export const questionPrompt = more => (more
  ? 'Prüfe Idee und bisherige Antworten. Stelle 0–5 weitere Fragen, nur wenn wesentliche Lücken für eine umsetzbare Spezifikation bleiben oder eine Antwort eine Folgeentscheidung auslöst. Keine bereits gestellte Frage wiederholen.'
  : 'Leite aus der Idee 10–14 Fragen ab, deren Antworten zusammen das Minimal-Konzept einer umsetzbaren Spezifikation ergeben. Die Fragen müssen genau auf diese Idee zugeschnitten sein: Denke die Idee zuerst zu Ende (Domäne, typische Abläufe, naheliegende Stolpersteine genau dieser Art von Anwendung) und frage dann nach den Entscheidungen, an denen sich solche Projekte tatsächlich unterscheiden. Verwende die Begriffe der Idee, nenne in den Optionen konkrete Ausprägungen statt Kategorien und frage nie etwas, das aus der Idee bereits hervorgeht oder für jedes beliebige Projekt gleich lauten würde. Decke jedes der Themen Ziel, Nutzer, Funktionen, UX, Technik und Qualität mit mindestens einer Frage ab und beginne mit den Entscheidungen mit der größten Wirkung.')
  + ' Jede Frage muss sich mit einem Klick beantworten lassen: 2–5 konkrete, sich ausschließende Antwortoptionen (kurz, ohne „Sonstiges“), dazu als Standard die Option, die für die meisten Projekte dieser Art passt, mit einem kurzen Grund. multi=true nur, wenn mehrere Optionen gleichzeitig sinnvoll sind.  Formuliere sachlich und knapp, ohne Werbesprache. Ausschließlich JSON ohne Markdown-Codeblock: {"questions":[{"topic":"Ziel|Nutzer|Funktionen|UX|Technik|Qualität","question":"...","options":["..."],"multi":false,"defaults":[0],"reason":"..."}]}';
