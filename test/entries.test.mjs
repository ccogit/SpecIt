import test from 'node:test';
import assert from 'node:assert/strict';
import { splitBlocks, entryKey, mergeEntries } from '../entries.mjs';
import { specFrame, mergeSpec } from '../blocks.mjs';

const reqs = 'Alle Anforderungen: Herkunft = Annahme.\n\n**FR-001 Grundgerüst** – Basis. *Akzeptanz:* läuft.\n\n**FR-002 Einladung** – Link. *Akzeptanz:* einmalig.\n\n**FR-004 Kurse** – anlegen.';

test('blocks are paragraphs, single list items and sub-headings; code blocks stay whole', () => {
  assert.equal(splitBlocks('a\nb\n\n- x\n- y\n\n```\n\n- kein Punkt\n```\n\n### H\nz').length, 5);
  assert.equal(splitBlocks(reqs).length, 4);
});

test('an entry is identified by its ID or its bold label', () => {
  assert.equal(entryKey('**FR-006 Anmeldung** – x'), 'FR-006');
  assert.equal(entryKey('- **NFR-002** Text'), 'NFR-002');
  assert.equal(entryKey('**A3 Leihanfrage stellen.** Bewohner …'), 'A3');
  assert.equal(entryKey('### FR-010 Titel'), 'FR-010');
  assert.equal(entryKey('- **Navigation:** flach'), 'navigation');
  assert.equal(entryKey('Ein gewöhnlicher Absatz.'), '');
});

test('changed entries replace, new ones are sorted in, removed ones disappear, the rest stays verbatim', () => {
  const m = mergeEntries(reqs, '**FR-002 Einladung und Passwort** – neuer Text.\n\n**FR-003 Login** – neu.\n\n**FR-004** entfällt.\n\n**FR-005 Liste** – auch neu.');
  assert.equal(m.entries, 4);
  assert.equal(m.body, 'Alle Anforderungen: Herkunft = Annahme.\n\n**FR-001 Grundgerüst** – Basis. *Akzeptanz:* läuft.\n\n**FR-002 Einladung und Passwort** – neuer Text.\n\n**FR-003 Login** – neu.\n\n**FR-005 Liste** – auch neu.');
});

test('list items keep their tight spacing; bold labels work as keys; ambiguous keys are left alone', () => {
  const ux = 'Einleitung.\n\n- **Navigation:** flach\n- **Leerzustände:** freundlich\n- **Hinweis:** a\n- **Hinweis:** b';
  const m = mergeEntries(ux, '- **Navigation:** nach Kategorien\n- **Farben:** ruhig\n- **Hinweis:** c');
  assert.equal(m.body, 'Einleitung.\n\n- **Navigation:** nach Kategorien\n- **Leerzustände:** freundlich\n- **Hinweis:** a\n- **Hinweis:** b\n- **Farben:** ruhig');
  assert.equal(m.entries, 2);
});

test('an entry under a sub-heading is replaced together with its paragraphs', () => {
  const m = mergeEntries('### FR-001 A\n\nalt eins\n\nalt zwei\n\n### FR-002 B\n\nbleibt', '### FR-001 A\n\nneu');
  assert.equal(m.body, '### FR-001 A\n\nneu\n\n### FR-002 B\n\nbleibt');
});

test('a chapter delivered with the marker is merged entry by entry, one without it is replaced whole', () => {
  const f = specFrame({ idea: 'Etwas', minutes: 60 });
  const old = f.head + '## Ziel und Nicht-Ziele\n\nZiel.\n\n## Funktionale Anforderungen\n\n' + reqs + '\n\n## UX und Gestaltung\n\nAlt.' + f.tail;
  const m = mergeSpec(old, f, '## Funktionale Anforderungen\n(nur geänderte Einträge)\n\n**FR-005 Neu** – dazu.\n\n## UX und Gestaltung\n\nGanz neu.');
  assert.deepEqual(m.changed, ['Funktionale Anforderungen', 'UX und Gestaltung']);
  assert.equal(m.entries, 1);
  assert.ok(m.markdown.includes('**FR-001 Grundgerüst**') && m.markdown.includes('**FR-005 Neu** – dazu.') && m.markdown.includes('Ganz neu.') && !m.markdown.includes('nur geänderte Einträge') && !m.markdown.includes('Alt.'));
});

test('a list under a bold label belongs to that entry and is replaced with it', () => {
  const ziel = '**Ziel:** Verleih im Haus.\n\n**Nicht-Ziele:**\n\n- Fotos\n- Push-Mitteilungen\n\n**Erfolgsmaß:** Hälfte der Parteien.';
  const m = mergeEntries(ziel, '**Nicht-Ziele:**\n\n- Fotos\n- Versand von E-Mails\n- SMS');
  assert.equal(m.body, '**Ziel:** Verleih im Haus.\n\n**Nicht-Ziele:**\n\n- Fotos\n- Versand von E-Mails\n- SMS\n\n**Erfolgsmaß:** Hälfte der Parteien.');
  assert.equal(m.entries, 1);
});
