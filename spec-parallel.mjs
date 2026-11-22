/** Experimental independent chapter groups. Single-group generation remains the default. */
import { splitChapters } from './blocks.mjs';

export const chapterGroups = Object.freeze([
  Object.freeze(['Ziel und Nicht-Ziele', 'Nutzer und Rollen', 'Kernabläufe und Randfälle']),
  Object.freeze(['Funktionale Anforderungen', 'Projektspezifische nichtfunktionale Anforderungen']),
  Object.freeze(['UX und Gestaltung', 'Daten und Schnittstellen', 'Projektspezifische Risiken']),
]);

export function partPrompt(frame, titles, hasContract = false) {
  if (!Array.isArray(titles) || !titles.length || titles.some(t => !chapterGroups.flat().includes(t))) throw Error('Ungültige Kapitel-Auswahl.');
  return '\n\nSchreibe NUR die folgenden projektspezifischen Kapitel in genau dieser Reihenfolge, mit vollständiger Überschrift „## Titel“: '
    + titles.join('; ') + '. Alle anderen Kapitel werden von anderen Aufträgen oder lokal erzeugt und dürfen nicht ausgegeben werden.'
    + ' Die Vorgaben in fixedSections sind verbindlich; widersprich ihnen nicht. Nutze dieselben Begriffe, Akteure, Daten und ausgewählten Features aus den Projektdaten.'
    + ' Für funktionale Anforderungen: FR-001 ff., je Anforderung Priorität, Herkunft und mindestens ein prüfbares Akzeptanzkriterium.'
    + ' Für projektspezifische nichtfunktionale Anforderungen: NFR-001 ff., ohne Wiederholung der Standards '
    + frame.reserved.join(', ') + '; sonst „Keine über die Standards hinaus.“'
    + ' Für Risiken höchstens drei konkrete projektspezifische Risiken. Kein Dokumenttitel, kein Inhaltsverzeichnis und keine Liste der Entscheidungen.'
    // Ohne Vorgabe schreibt jeder Teilauftrag deutlich mehr als derselbe Abschnitt in einer Spezifikation aus einem Guss –
    // gemessen gut doppelt so viel, und damit ist der Zeitgewinn der Parallelität dahin. Deshalb ein Umfang je Gruppe.
    + (titles.includes('Funktionale Anforderungen')
      ? ' Umfang: knapp und dicht wie in einer Spezifikation aus einem Guss – je Anforderung höchstens 45 Wörter einschließlich Akzeptanzkriterium, keine Einleitungen oder Wiederholungen.'
      // Die Teile kennen einander nicht: Im Vergleich legten sie Anforderungen mehrfach und abweichend fest. Anforderungen gehören nur in ihre Gruppe.
      : ' Umfang: knapp und dicht wie in einer Spezifikation aus einem Guss – alle Kapitel dieses Auftrags zusammen höchstens 350 Wörter, keine Einleitungen oder Wiederholungen.'
        + ' Lege in diesen Kapiteln keine Anforderungen fest und führe keine Listen mit FR- oder NFR-Kennungen: Die Anforderungen schreibt ein anderer Auftrag aus denselben Projektdaten. Beschreibe Abläufe, Rollen, Gestaltung und Daten so, dass sie zu den ausgewählten Features (features) passen, ohne ihnen Nummern zu geben.')
    // Gemeinsamer Vorlauf: Alle Teile halten sich an dieselbe Anforderungsliste, dieselben Rollen, Begriffe und Festlegungen
    + (hasContract ? ' In den Projektdaten steht unter contract die gemeinsame Grundlage aller Aufträge; sie ist verbindlich: Verwende Rollen, Begriffe, Anrede (address) und Festlegungen (decisions) genau so.'
      + (titles.includes('Funktionale Anforderungen')
        ? ' Schreibe genau die Anforderungen aus contract.requirements aus – mit diesen Kennungen, Titeln und Prioritäten, in dieser Reihenfolge, keine weiteren und keine weniger.'
        : ' Wo du dich auf eine Anforderung beziehst, nenne ihre Kennung aus contract.requirements; lege keine eigenen fest.') : '')
    + ' Beginne sofort mit „## ' + titles[0] + '“. Schreibe keine zusätzlichen Kapitel.';
}

// Titel vergleichen ohne Rücksicht auf Groß-/Kleinschreibung, Satzzeichen am Ende und Auszeichnung
const sameTitle = (a, b) => { const n = s => String(s).replace(/[*_`#]/g, '').replace(/[\s:.–—-]+$/, '').trim().toLowerCase(); return n(a) === n(b); };

/**
 * Fügt die parallel erzeugten Teile zusammen. Maßgeblich sind die verlangten Kapitel jeder Gruppe, in ihrer Reihenfolge:
 * Vorbemerkungen und nicht verlangte Kapitel eines Teils fallen weg (ein schnelles Modell hält sich nicht immer an die Form),
 * ein fehlendes oder leeres verlangtes Kapitel ist dagegen ein Fehler – mit Angabe, was stattdessen kam.
 */
export function joinParts(parts, groups = chapterGroups) {
  if (!Array.isArray(parts) || parts.length !== groups.length) throw Error('Unvollständige Parallel-Ausgabe.');
  return parts.map((part, i) => {
    const sections = splitChapters(part), wanted = groups[i];
    return wanted.map(title => {
      const hit = sections.chapters.find(c => sameTitle(c.title, title) && c.body);
      if (!hit) throw Error('Parallel-Ausgabe: Kapitel „' + title + '“ fehlt (Gruppe ' + (i + 1) + '; geliefert: ' + (sections.chapters.map(c => c.title).join(', ') || 'keine Kapitel') + ').');
      return '## ' + title + '\n\n' + hit.body;
    }).join('\n\n');
  }).join('\n\n') + '\n';
}

export function orderedChunks(count, emit) {
  const pending = Array.from({ length: count }, () => ''), complete = Array(count).fill(false);
  let next = 0;
  return {
    chunk(i, t) {
      if (!Number.isInteger(i) || i < next || i >= count) throw Error('Unzulässiger Parallel-Stream.');
      if (i === next) emit(t); else pending[i] += t;
    },
    done(i) {
      complete[i] = true;
      while (next < count && complete[next]) {
        next++;
        if (next < count && pending[next]) { emit(pending[next]); pending[next] = ''; }
      }
    },
  };
}

/* ---------- Gemeinsamer Vorlauf: die Grundlage, an die sich alle parallelen Teile halten ---------- */
// Die Teile kennen einander nicht. Ohne Vorlauf legten sie im Vergleich Anforderungen mehrfach und abweichend fest und
// widersprachen sich bei Anrede und Datenmodell. Der Vorlauf ist ein einzelner kurzer Aufruf vor den drei parallelen.

export const outlinePrompt = 'Lege die gemeinsame Grundlage fest, an die sich mehrere getrennt arbeitende Autoren derselben Spezifikation halten – knapp, keine Prosa. '
  + 'requirements: genau eine Anforderung je ausgewähltem Feature aus features, bei großen Features höchstens zwei – id fortlaufend FR-001, FR-002 …, feature = Name des Features Zeichen für Zeichen, title (höchstens 8 Wörter), priority = Muss für Basis-Features, sonst Soll oder Kann. '
  + 'roles: die Nutzerrollen (höchstens 4, je ein bis drei Wörter). address: die Anrede in der Oberfläche – "du", "Sie" oder "neutral" (ohne direkte Anrede), passend zum Einsatzbereich. '
  + 'data: die fachlichen Objekte mit je einem Halbsatz, was sie halten (höchstens 8). '
  + 'decisions: höchstens 8 kurze Festlegungen, die mehrere Kapitel betreffen und sonst leicht widersprüchlich beschrieben würden (z. B. was gespeichert wird und wie lange, wann etwas als abgeschlossen gilt, wie ein Sonderfall behandelt wird) – jede ein Satz. '
  + 'Halte dich an die Projektdaten und die bereits getroffenen Entscheidungen; erfinde keine zusätzlichen Features. '
  + 'Ausschließlich JSON ohne Markdown-Codeblock: {"requirements":[{"id":"FR-001","feature":"...","title":"...","priority":"Muss"}],"roles":["..."],"address":"neutral","data":[{"entity":"...","note":"..."}],"decisions":["..."]}';

const short = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Prüft den Vorlauf: Anforderungen fortlaufend nummeriert und nur zu ausgewählten Features. Liefert null, wenn er nicht trägt. */
export function cleanOutline(raw, features = []) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.requirements)) return null;
  const known = new Map(features.map(f => [short(typeof f === 'string' ? f : f?.name, 80).toLowerCase(), short(typeof f === 'string' ? f : f?.name, 80)]).filter(x => x[0]));
  const requirements = [];
  for (const r of raw.requirements) {
    if (!r || typeof r !== 'object' || requirements.length >= 40) continue;
    const feature = known.size ? known.get(short(r.feature, 80).toLowerCase()) : short(r.feature, 80), title = short(r.title, 90);
    if (!feature || !title) continue;
    requirements.push({ id: 'FR-' + String(requirements.length + 1).padStart(3, '0'), feature, title, priority: ['Muss', 'Soll', 'Kann'].includes(r.priority) ? r.priority : 'Soll' });
  }
  // Trägt nur, wenn jedes ausgewählte Feature vorkommt – sonst würde die Anforderungsgruppe Features auslassen
  if (!requirements.length || [...known.values()].some(name => !requirements.some(r => r.feature === name))) return null;
  const list = (v, max, len) => (Array.isArray(v) ? v : []).map(x => short(x, len)).filter(Boolean).slice(0, max);
  return {
    requirements, roles: list(raw.roles, 4, 40), address: ['du', 'Sie', 'neutral'].includes(raw.address) ? raw.address : 'neutral',
    data: (Array.isArray(raw.data) ? raw.data : []).map(d => d && typeof d === 'object' && short(d.entity, 40) ? { entity: short(d.entity, 40), note: short(d.note, 120) } : null).filter(Boolean).slice(0, 8),
    decisions: list(raw.decisions, 8, 200),
  };
}
