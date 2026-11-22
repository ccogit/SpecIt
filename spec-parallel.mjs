/** Experimental independent chapter groups. Single-group generation remains the default. */
import { splitChapters } from './blocks.mjs';

export const chapterGroups = Object.freeze([
  Object.freeze(['Ziel und Nicht-Ziele', 'Nutzer und Rollen', 'Kernabläufe und Randfälle']),
  Object.freeze(['Funktionale Anforderungen', 'Projektspezifische nichtfunktionale Anforderungen']),
  Object.freeze(['UX und Gestaltung', 'Daten und Schnittstellen', 'Projektspezifische Risiken']),
]);

export function partPrompt(frame, titles) {
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
      : ' Umfang: knapp und dicht wie in einer Spezifikation aus einem Guss – alle Kapitel dieses Auftrags zusammen höchstens 350 Wörter, keine Einleitungen oder Wiederholungen.')
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
