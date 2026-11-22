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
    + ' Beginne sofort mit „## ' + titles[0] + '“. Schreibe keine zusätzlichen Kapitel.';
}

export function joinParts(parts, groups = chapterGroups) {
  if (!Array.isArray(parts) || parts.length !== groups.length) throw Error('Unvollständige Parallel-Ausgabe.');
  return parts.map((part, i) => {
    const sections = splitChapters(part);
    const wanted = groups[i];
    if (sections.intro || sections.chapters.length !== wanted.length || sections.chapters.some((c, j) => c.title !== wanted[j] || !c.body)) {
      throw Error('Parallel-Ausgabe enthält fehlende, doppelte oder unerwartete Kapitel (Gruppe ' + (i + 1) + ').');
    }
    return sections.chapters.map(c => '## ' + c.title + '\n\n' + c.body).join('\n\n');
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
