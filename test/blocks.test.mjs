import test from 'node:test';
import assert from 'node:assert/strict';
import { specFrame, corePrompt } from '../blocks.mjs';
import { requirementIds } from '../traceability.mjs';

const q = (topic, state, question, answer) => ({ topic, state, question, options: [answer, 'anders'], choice: [0], custom: '' });
const base = { project: 'Notizio', idea: 'Eine App für Notizen', duration: '1 Stunde', tone: 2, minutes: 60,
  questions: [q(0, 'decided', 'Wofür?', 'Privat'), q(2, 'default', 'Suche?', 'Volltext'), q(4, 'open', 'Speicher?', 'Datei')],
  extras: ['CSV-Export'], scope: [{ name: 'Notizen anlegen', note: 'Text und Titel', basis: true }, { name: 'Export', note: '', basis: false }], excluded: ['Teilen'] };

test('the frame holds title, idea and the fixed sections without any AI', () => {
  const f = specFrame(base);
  assert.ok(f.head.startsWith('# Notizio\n\n> Eine App für Notizen'));
  assert.ok(f.head.includes('## Rahmen') && f.head.includes('1 Stunde'));
  for (const t of ['Umfang', 'Nichtfunktionale Standards', 'Betrieb und Übergabe', 'Standard-Risiken', 'Entscheidungen und Annahmen', 'Offene Entscheidungen', 'Abnahme']) {
    assert.ok(f.tail.includes('## ' + t), t); assert.ok(f.titles.includes(t), t);
  }
  assert.ok(f.tail.includes('**Notizen anlegen** – Text und Titel') && f.tail.includes('- Teilen'));
  assert.ok(f.tail.includes('Annahme') && f.tail.includes('- Speicher?') && f.tail.includes('- CSV-Export'));
});

test('the transferable standards grow with the target time and carry reserved, traceable IDs', () => {
  const small = specFrame({ ...base, minutes: 15 }), large = specFrame({ ...base, minutes: 2000 });
  assert.deepEqual(small.reserved, ['NFR-901', 'NFR-902', 'NFR-903']);
  assert.equal(large.reserved.length, 11);
  assert.deepEqual(requirementIds(large.tail), large.reserved);
  assert.ok(new Set(large.reserved).size === large.reserved.length);
});

test('a project without answers, scope or frame still yields a valid frame', () => {
  const f = specFrame({ idea: 'Etwas bauen' });
  assert.ok(f.head.startsWith('# Projektspezifikation'));
  assert.ok(!f.head.includes('## Rahmen') && !f.tail.includes('## Umfang') && !f.tail.includes('## Entscheidungen und Annahmen'));
  assert.ok(f.tail.includes('## Offene Entscheidungen\n\nKeine.'));
});

test('the core prompt names the fixed sections and the reserved IDs', () => {
  const f = specFrame(base), p = corePrompt(f);
  assert.ok(p.includes('Nichtfunktionale Standards') && p.includes('NFR-901') && p.includes('## Ziel und Nicht-Ziele'));
});

import { splitChapters, coreChapters, mergeSpec, updatePrompt } from '../blocks.mjs';

test('a specification is updated chapter by chapter: only rewritten chapters change, the frame is fresh', () => {
  const f = specFrame(base), old = f.head + '## Ziel und Nicht-Ziele\n\nAltes Ziel.\n\n## Nutzer und Rollen\n\nAlle gleich.\n\n## Funktionale Anforderungen\n\n**FR-001 A** – x' + f.tail;
  assert.deepEqual(coreChapters(old, f).map(c => c.title), ['Ziel und Nicht-Ziele', 'Nutzer und Rollen', 'Funktionale Anforderungen']);
  const f2 = specFrame({ ...base, project: 'Neuer Name' });
  const m = mergeSpec(old, f2, '## Nutzer und Rollen\n\nEin Admin.\n\n## Umfang\n\nNicht deine Sache.\n\n## Projektspezifische Risiken\n\n1. Neu.');
  assert.deepEqual(m.changed, ['Nutzer und Rollen', 'Projektspezifische Risiken']);
  assert.ok(m.markdown.startsWith('# Neuer Name'));
  assert.ok(m.markdown.includes('Altes Ziel.') && m.markdown.includes('Ein Admin.') && !m.markdown.includes('Alle gleich.') && !m.markdown.includes('Nicht deine Sache.'));
  assert.equal(m.markdown.split('## Umfang').length, 2);
  assert.deepEqual(mergeSpec(old, f, '## Keine Änderung').changed, []);
  assert.deepEqual(mergeSpec(old, f, '## Nutzer und Rollen\n\nAlle gleich.').changed, []);
});

test('headings inside code blocks do not split chapters; the update prompt lists the changes', () => {
  assert.equal(splitChapters('# T\n\n## A\n\n```\n## kein Kapitel\n```\n\n## B\n\nx').chapters.length, 2);
  const p = updatePrompt(specFrame(base), ['„Wer verwaltet?“: bisher Alle → jetzt Admin']);
  assert.ok(p.includes('bisher Alle → jetzt Admin') && p.includes('## Keine Änderung') && p.includes('NFR-901'));
});
