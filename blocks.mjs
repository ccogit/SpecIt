// Bausteine der Spezifikation: alles, was sich ohne KI aus den vorhandenen Angaben zusammensetzen lässt oder
// von Projekt zu Projekt übertragbar ist. Die KI schreibt nur noch den projektspezifischen Kern dazwischen –
// das spart einen großen Teil der Schreibzeit, und der Anfang steht sofort da.
import { topics, specLine, complexityOf, toneLevels } from './interview.mjs';
import { partMark, mergeEntries, entryPrompt } from './entries.mjs';

// Übertragbare nichtfunktionale Standards, gestaffelt nach Komplexität (Stufe 1–8 aus der Ziel-Entwicklungsdauer).
// Die Kennungen NFR-901 ff. sind für die Bausteine reserviert; die KI vergibt NFR-001 ff.
const standards = [
  [1, 'NFR-901', 'Start', 'Die Anwendung startet mit einem einzigen, dokumentierten Befehl.', 'Auf einem frischen Checkout führt der Befehl aus der README ohne weitere Schritte zur laufenden Anwendung.'],
  [1, 'NFR-902', 'Eingaben', 'Jede Eingabe wird geprüft; ungültige oder leere Eingaben führen zu einer verständlichen Meldung, nie zu einem Absturz oder zu Datenverlust.', 'Je Eingabefeld gibt es einen Test mit leerem und mit ungültigem Wert.'],
  [1, 'NFR-903', 'Kernablauf getestet', 'Der Kernablauf ist von Anfang bis Ende automatisiert getestet.', 'Der dokumentierte Testbefehl läuft ohne Fehler durch.'],
  [3, 'NFR-904', 'Leere und Fehlerzustände', 'Jede Ansicht zeigt ohne Daten einen Hinweis mit dem nächsten Schritt; Fehlermeldungen nennen Ursache und Abhilfe.', 'Jede Ansicht ist einmal ohne Daten und einmal im Fehlerfall geprüft.'],
  [3, 'NFR-905', 'Bedienbarkeit', 'Alle Funktionen sind per Tastatur erreichbar, der Fokus ist sichtbar, Text hat einen Kontrast von mindestens 4,5:1, und die Oberfläche ist ab 360 px Breite benutzbar.', 'Der Kernablauf gelingt nur mit der Tastatur und auf 360 px Breite.'],
  [3, 'NFR-906', 'Konfiguration', 'Im Repository liegen keine Geheimnisse; Einstellungen kommen aus Umgebungsvariablen, eine Beispieldatei nennt alle.', 'Eine Suche im Repository findet keine Schlüssel oder Passwörter; die Beispieldatei ist vollständig.'],
  [5, 'NFR-907', 'Datenbestand', 'Gespeicherte Daten überstehen einen Neustart; eine abgebrochene Änderung hinterlässt keinen halben Stand.', 'Nach Neustart und nach einem abgebrochenen Schreibvorgang ist der Datenbestand vollständig und widerspruchsfrei.'],
  [5, 'NFR-908', 'Antwortzeit', 'Übliche Aktionen antworten bei 1.000 Datensätzen in unter einer Sekunde.', 'Eine Messung mit 1.000 Datensätzen auf einem üblichen Entwicklungsrechner bleibt unter einer Sekunde.'],
  [5, 'NFR-909', 'Protokoll', 'Fehler werden mit Zeitpunkt und Zusammenhang protokolliert, ohne personenbezogene Inhalte.', 'Ein ausgelöster Fehler erscheint im Protokoll; es enthält keine Namen, Adressen oder Inhalte von Nutzern.'],
  [7, 'NFR-910', 'Zugriff', 'Jede schreibende Aktion prüft die Berechtigung auf dem Server, nicht nur in der Oberfläche.', 'Ein direkter Aufruf ohne Berechtigung wird abgewiesen.'],
  [7, 'NFR-911', 'Abhängigkeiten', 'Abhängigkeiten sind auf feste Versionen gelegt; ihre Lizenzen sind aufgeführt.', 'Die Abhängigkeitsdatei nennt feste Versionen; eine Lizenzliste liegt bei.'],
];

const clean = v => String(v || '').replace(/\s+/g, ' ').trim();

/**
 * Baut den festen Rahmen der Spezifikation.
 * b: { project, idea, questions, extras, scope:[{name,note,basis}], excluded:[name], duration, tone, minutes }
 * Liefert { head, tail, titles, reserved } – head steht vor dem Teil der KI, tail danach;
 * titles sind die Abschnitte, die die KI nicht schreiben darf, reserved die vergebenen Kennungen.
 */
export function specFrame(b = {}) {
  const level = complexityOf(Number.isFinite(b.minutes) ? b.minutes : 0), questions = Array.isArray(b.questions) ? b.questions : [];
  const scope = Array.isArray(b.scope) ? b.scope : [], excluded = Array.isArray(b.excluded) ? b.excluded : [], extras = Array.isArray(b.extras) ? b.extras : [];
  const tone = Number.isInteger(b.tone) && toneLevels[b.tone] ? toneLevels[b.tone] : '';

  const head = ['# ' + (clean(b.project) || 'Projektspezifikation'), '> ' + clean(b.idea)];
  const rahmen = [...(b.duration ? ['- **Ziel-Entwicklungsdauer** ' + b.duration + ' (reine Laufzeit der Coding-Agenten)'] : []), ...(tone ? ['- **Einsatzbereich** ' + tone] : [])];
  if (rahmen.length) head.push('## Rahmen', rahmen.join('\n'));

  const tail = [];
  if (scope.length) {
    const line = f => '- **' + clean(f.name) + '**' + (clean(f.note) ? ' – ' + clean(f.note) : '');
    const basis = scope.filter(f => f.basis), more = scope.filter(f => !f.basis);
    tail.push('## Umfang', [basis.length ? '**Basis**\n\n' + basis.map(line).join('\n') : '', more.length ? '**Erweiterungen**\n\n' + more.map(line).join('\n') : '',
      excluded.length ? '**Nicht im Umfang (abgewählt)**\n\n' + excluded.map(x => '- ' + clean(x)).join('\n') : ''].filter(Boolean).join('\n\n'));
  }
  const mine = standards.filter(s => s[0] <= level);
  tail.push('## Nichtfunktionale Standards', 'Übertragbare Anforderungen, die für jede Anwendung dieser Größe gelten.\n\n'
    + mine.map(s => '- **' + s[1] + ' ' + s[2]) .map((start, i) => start + '** – ' + mine[i][3] + ' *Abnahme:* ' + mine[i][4]).join('\n'));
  tail.push('## Betrieb und Übergabe', ['- Eine README nennt Zweck, Start, Test und Konfiguration; sie stimmt mit dem ausgelieferten Stand überein.',
    '- Die Projektstruktur trennt Oberfläche, fachliche Logik und Datenhaltung erkennbar.', ...(level >= 4 ? ['- Bekannte Grenzen und offene Punkte stehen in der README.'] : []),
    ...(level >= 6 ? ['- Ein Befehl prüft vor der Übergabe alles zusammen: Tests, Build und Formatierung.'] : [])].join('\n'));
  tail.push('## Standard-Risiken', ['- **Umfang größer als die Zielzeit** – Basis-Features zuerst fertigstellen, Erweiterungen zuletzt; was nicht mehr passt, entfällt, statt halb gebaut zu bleiben.',
    '- **Annahmen treffen nicht zu** – jede Annahme ist als solche gekennzeichnet und an einer Stelle im Code änderbar gehalten.',
    ...(level >= 4 ? ['- **Abhängigkeit von fremden Diensten oder Bibliotheken** – hinter einer eigenen Schnittstelle kapseln, damit ein Wechsel den Rest nicht berührt.'] : [])].join('\n'));
  const answered = questions.filter(q => q.state !== 'open');
  if (answered.length || extras.length) {
    const parts = topics.map((name, i) => { const rows = answered.filter(q => q.topic === i); return rows.length ? '**' + name + '**\n\n' + rows.map(specLine).join('\n') : ''; }).filter(Boolean);
    if (extras.length) parts.push('**Zusätzliche Anforderungen**\n\n' + extras.map(x => '- ' + clean(x)).join('\n'));
    tail.push('## Entscheidungen und Annahmen', parts.join('\n\n'));
  }
  const open = questions.filter(q => q.state === 'open');
  tail.push('## Offene Entscheidungen', open.length ? open.map(q => '- ' + q.question).join('\n') : 'Keine.');
  tail.push('## Abnahme', ['- Jedes Akzeptanzkriterium der funktionalen und nichtfunktionalen Anforderungen ist erfüllt und nachgewiesen.', '- Alle Tests laufen ohne Fehler durch.',
    '- Die README stimmt; der Kernablauf enthält keinen bekannten Fehler.'].join('\n'));

  return { head: head.join('\n\n') + '\n\n', tail: '\n\n' + tail.join('\n\n') + '\n',
    titles: [...(rahmen.length ? ['Rahmen'] : []), ...tail.filter(x => x.startsWith('## ')).map(x => x.slice(3))], reserved: mine.map(s => s[1]) };
}

/** Anweisung an die KI: nur den projektspezifischen Kern schreiben, passend zu den festen Bausteinen. */
export function corePrompt(frame) {
  return '\n\nAbweichend von der Gliederung oben schreibst du nur den projektspezifischen Kern. Titel, Idee'
    + ' und diese Abschnitte stehen bereits fest und werden von SpecIt ergänzt – schreibe sie nicht und wiederhole ihren Inhalt nicht: ' + frame.titles.join('; ')
    + '. Ihr Wortlaut steht in den Projektdaten unter fixedSections; widersprich ihm nicht. Schreibe genau diese Abschnitte, jeden mit „## Titel“: Ziel und Nicht-Ziele; Nutzer und Rollen;'
    + ' Kernabläufe und Randfälle; Funktionale Anforderungen (FR-001 ff., je Anforderung Priorität, Herkunft und mindestens ein prüfbares Akzeptanzkriterium);'
    + ' Projektspezifische nichtfunktionale Anforderungen (NFR-001 ff., nur was über die Standards ' + frame.reserved[0] + ' bis ' + frame.reserved[frame.reserved.length - 1] + ' hinausgeht; sonst „Keine über die Standards hinaus.“);'
    + ' UX und Gestaltung; Daten und Schnittstellen; Projektspezifische Risiken (höchstens drei). Keine Hauptüberschrift, kein Inhaltsverzeichnis, keine Liste der Entscheidungen.'
    + ' Schreibe sofort los, ohne Vorüberlegung: Das erste Zeichen deiner Antwort ist „#“ von „## Ziel und Nicht-Ziele“; die Gedankenarbeit geschieht beim Schreiben, Abschnitt für Abschnitt.';
}

/** Zerlegt eine Spezifikation in Vorspann und Kapitel („## Titel“); Zeilen in Codeblöcken zählen nicht als Überschrift. */
export function splitChapters(md) {
  const intro = [], chapters = []; let cur = null, fence = false;
  for (const l of String(md || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^(```|~~~)/.test(l.trim())) fence = !fence;
    const h = !fence && /^##\s+(.+?)\s*$/.exec(l);
    if (h) { cur = { title: h[1].trim(), lines: [] }; chapters.push(cur); } else (cur ? cur.lines : intro).push(l);
  }
  return { intro: intro.join('\n').trim(), chapters: chapters.map(c => ({ title: c.title, body: c.lines.join('\n').trim() })) };
}

/** Die Kapitel des projektspezifischen Kerns einer Spezifikation – alles außer Rahmen, Bausteinen und Inhaltsverzeichnis. */
export const coreChapters = (md, frame) => { const fixed = new Set([...frame.titles, 'Inhaltsverzeichnis']); return splitChapters(md).chapters.filter(c => !fixed.has(c.title)); };

/**
 * Aktualisiert eine vorhandene Spezifikation kapitelweise: Der Rahmen kommt frisch aus specFrame, vom Kern werden nur
 * die Kapitel ersetzt, die in update neu geschrieben wurden (unbekannte Titel werden angehängt).
 * Liefert { markdown, changed } – changed nennt die Titel der tatsächlich geänderten Kapitel.
 */
export function mergeSpec(previous, frame, update) {
  const fixed = new Set([...frame.titles, 'Inhaltsverzeichnis']), core = coreChapters(previous, frame), changed = [], skipped = []; let entries = 0;
  for (const f of splitChapters(update).chapters) {
    if (fixed.has(f.title) || /^Keine Änderung/i.test(f.title) || !f.body) continue;
    const at = core.findIndex(c => c.title.toLowerCase() === f.title.toLowerCase());
    // „(nur geänderte Einträge)“ unter dem Titel: Dann werden nur die genannten Einträge ersetzt, ergänzt oder entfernt
    const lines = f.body.split('\n'), part = partMark.test(lines[0] || ''), body = part ? lines.slice(1).join('\n').trim() : f.body;
    if (at < 0) { if (body) { core.push({ title: f.title, body }); changed.push(f.title); } continue; }
    const next = part ? mergeEntries(core[at].body, body) : { body, entries: 0 };
    // Geliefert, aber ohne erkennbare Kennung: nicht einzuordnen – das wird gemeldet statt stillschweigend verworfen
    if (part && body && !next.entries) skipped.push(core[at].title);
    if (next.body !== core[at].body) { core[at] = { title: core[at].title, body: next.body }; changed.push(core[at].title); entries += next.entries; }
  }
  return { markdown: frame.head + core.map(c => '## ' + c.title + '\n\n' + c.body).join('\n\n') + frame.tail, changed, entries, skipped };
}

/** Anweisung für die kapitelweise Aktualisierung: nur ausgeben, was sich durch die genannten Änderungen ändern muss. */
export function updatePrompt(frame, changes) {
  return '\n\nEs gibt bereits eine Spezifikation (previous in den Projektdaten). Ihr projektspezifischer Kern besteht aus Kapiteln mit „## Titel“; Titel, Idee und diese Abschnitte ergänzt SpecIt selbst und sind nicht deine Aufgabe: '
    + frame.titles.join('; ') + ' (neuer Wortlaut unter fixedSections). Seit dem Stand der Spezifikation hat sich geändert:\n' + changes.map(c => '- ' + c).join('\n')
    + '\nGib ausschließlich die Kapitel des Kerns aus, die sich dadurch ändern müssen – jedes vollständig neu, mit seiner Zeile „## Titel“ im bisherigen Wortlaut des Titels und in der bisherigen Reihenfolge. Unveränderte Kapitel gibst du nicht aus.'
    + entryPrompt
    + ' Denke die Änderung zu Ende: Betrifft sie Rollen, Abläufe, Daten oder Anforderungen in anderen Kapiteln, gehören auch diese Kapitel dazu. Kennungen bestehender Anforderungen (FR-…, NFR-…) bleiben erhalten; neue Anforderungen bekommen die nächste freie Nummer, entfallende Nummern werden nicht neu vergeben; '
    + frame.reserved[0] + ' bis ' + frame.reserved[frame.reserved.length - 1] + ' sind vergeben. Muss sich kein Kapitel ändern, antworte nur mit der Zeile „## Keine Änderung“.'
    + ' Schreibe sofort los, ohne Vorüberlegung: Das erste Zeichen deiner Antwort ist „#“.';
}
