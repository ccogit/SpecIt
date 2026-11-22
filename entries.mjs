// Aktualisierung einer Spezifikation auf Eintragsebene: Ein Kapitel besteht oft aus benannten Einträgen
// („**FR-006 Titel** – …“, „**A3 Leihanfrage stellen.** …“, „- **Navigation:** …“). Statt das ganze Kapitel neu zu
// schreiben, liefert die KI nur die geänderten Einträge; hier werden sie anhand ihrer Kennung eingesetzt.

/** Zeile unter dem Kapiteltitel, die eine Lieferung auf Eintragsebene kennzeichnet. */
export const partMark = /^\s*\(?\s*nur geänderte Einträge\s*\)?\s*$/i;

/** Zerlegt einen Kapiteltext in Blöcke: Absätze (durch Leerzeilen getrennt), einzelne Listenpunkte und Zwischenüberschriften. */
export function splitBlocks(body) {
  const out = []; let cur = null, fence = false, blank = true;
  for (const line of String(body || '').replace(/\r\n?/g, '\n').split('\n')) {
    const mark = /^(```|~~~)/.test(line.trim());
    if (!fence && !mark && !line.trim()) { blank = true; continue; }
    const starts = !fence && (/^(?:[-*+]|\d+[.)])\s+/.test(line) || /^#{3,6}\s+/.test(line));
    if (!cur || (blank && !fence) || starts) { cur = { sep: blank || !cur ? '\n\n' : '\n', lines: [] }; out.push(cur); }
    cur.lines.push(line); blank = false;
    if (mark) fence = !fence;
  }
  return out;
}

const joinBlocks = blocks => blocks.map((b, i) => (i ? b.sep : '') + b.lines.join('\n')).join('');
const idKey = /^\s*(?:[-*+]\s+|\d+[.)]\s+|#{3,6}\s+)?(?:\*\*|__)?\s*((?:FR|NFR)-\d{3}|[A-Z]{1,2}\d{1,2})(?![\w-])/;
const labelKey = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?\*\*([^*\n]{2,80}?)\*\*/;

/** Kennung eines Eintrags: FR-/NFR-Nummer oder Kürzel wie A3, sonst das fett gesetzte Stichwort am Anfang; leer = kein benannter Eintrag. */
export function entryKey(text) {
  const id = idKey.exec(text); if (id) return id[1];
  const label = labelKey.exec(text);
  return label ? label[1].replace(/[\s.:–—-]+$/, '').trim().toLowerCase() : '';
}

// Ein Eintrag ist ein benannter Block samt den unbenannten Blöcken, die ihm folgen – etwa die Aufzählung unter
// „**Nicht-Ziele:**“ oder die Absätze unter einer Zwischenüberschrift mit Kennung. So geht beim Ersetzen nichts verloren.
function entriesOf(blocks) {
  const out = [];
  for (const b of blocks) {
    const first = b.lines[0], key = entryKey(first), head = /^#{3,6}\s+/.test(first), last = out[out.length - 1];
    if (!key && !head && last && last.key) last.blocks.push(b); else out.push({ key, head, blocks: [b] });
  }
  return out;
}

const numbered = key => { const m = /^([A-Z]+-?)(\d+)$/.exec(key); return m ? [m[1], Number(m[2])] : null; };

/**
 * Setzt geänderte Einträge in einen Kapiteltext ein: gleiche Kennung = ersetzen, „**FR-006** entfällt.“ = entfernen,
 * unbekannte Kennung = neu (Nummern in ihrer Folge einsortiert, Stichworte hinter den letzten benannten Eintrag).
 * Mehrdeutige Kennungen (im bisherigen Text mehrfach vorhanden) werden nicht angefasst. Liefert { body, entries }.
 */
export function mergeEntries(previous, update) {
  const prev = entriesOf(splitBlocks(previous)), upd = entriesOf(splitBlocks(update)).filter(e => e.key); let n = 0;
  const count = key => prev.filter(e => e.key === key).length;
  for (const u of upd) {
    const text = joinBlocks(u.blocks).trim(), gone = text.length < 90 && /entfällt\.?$/i.test(text), hits = count(u.key);
    if (hits === 1) {
      const at = prev.findIndex(e => e.key === u.key);
      if (gone) prev.splice(at, 1); else { u.blocks[0] = { ...u.blocks[0], sep: prev[at].blocks[0].sep }; prev[at] = u; }
      n++; continue;
    }
    if (gone || hits > 1) continue;
    const me = numbered(u.key); let pos = -1;
    if (me) {
      prev.forEach((e, i) => { const o = numbered(e.key); if (o && o[0] === me[0] && o[1] < me[1]) pos = i; });
      if (pos < 0) { const first = prev.findIndex(e => { const o = numbered(e.key); return o && o[0] === me[0]; }); pos = first >= 0 ? first - 1 : prev.length - 1; }
    } else prev.forEach((e, i) => { if (e.key) pos = i; });
    if (pos < 0 && !me) pos = prev.length - 1;
    const near = prev[pos >= 0 ? pos : 0];
    u.blocks[0] = { ...u.blocks[0], sep: near && near.key ? near.blocks[0].sep : '\n\n' };
    prev.splice(pos + 1, 0, u); n++;
  }
  return { body: joinBlocks(prev.flatMap(e => e.blocks)), entries: n };
}

/** Zusatz zur Anweisung der kapitelweisen Aktualisierung: innerhalb der Kapitel nur die geänderten Einträge liefern. */
export const entryPrompt = ' Viele Kapitel bestehen aus benannten Einträgen: Absätze oder Listenpunkte, die mit einer fett gesetzten Kennung oder einem fett gesetzten Stichwort beginnen (z. B. „**FR-006 Titel** – …“, „**A3 Leihanfrage stellen.** …“, „- **Navigation:** …“). In einem solchen Kapitel gibst du nicht das ganze Kapitel aus, sondern setzt unter die Kapitelzeile die Zeile „(nur geänderte Einträge)“ und danach ausschließlich die geänderten und neuen Einträge – jeden vollständig, im bisherigen Format, mit unveränderter Kennung bzw. unverändertem Stichwort. Entfällt ein Eintrag, schreibe dafür nur „**FR-006** entfällt.“. Nur wenn ein Kapitel keine solchen Einträge hat oder sich fast alles darin ändert, gibst du es vollständig aus (ohne diese Zeile). Schreibe so wenig wie möglich neu.';
