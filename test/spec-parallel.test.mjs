import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterGroups, partPrompt, joinParts, orderedChunks } from '../spec-parallel.mjs';

test('each chapter is generated in exactly one group', () => {
  const all = chapterGroups.flat(); assert.equal(all.length, 8);
  assert.equal(new Set(all).size, all.length);
  assert.match(partPrompt({ reserved: ['NFR-901'] }, chapterGroups[1]), /FR-001/);
  assert.throws(() => partPrompt({ reserved: [] }, ['Nicht vorhanden']));
});

test('joining accepts exactly ordered, complete chapters', () => {
  const parts = chapterGroups.map(group => group.map(name => `## ${name}\n\nInhalt`).join('\n\n'));
  const result = joinParts(parts);
  assert.equal((result.match(/## /g) || []).length, 8);
  assert.throws(() => joinParts(parts.slice(1)));
  assert.throws(() => joinParts([parts[0].replace('Ziel und Nicht-Ziele', 'Falsches Kapitel'), ...parts.slice(1)]));
  // Vorbemerkungen und nicht verlangte Kapitel eines Teils fallen weg; Titel dürfen in der Schreibweise leicht abweichen
  assert.equal(joinParts(['Hier ist der Text:\n\n' + parts[0].replace('## Ziel und Nicht-Ziele', '## Ziel und Nicht-Ziele:') + '\n\n## Nicht erlaubt\n\nText', ...parts.slice(1)]), result);
});

test('concurrent text arrives in order even when later groups finish first', () => {
  const emitted = []; const q = orderedChunks(3, s => emitted.push(s));
  q.chunk(2, 'C'); q.done(2); q.chunk(1, 'B'); q.done(1); q.chunk(0, 'A'); q.done(0);
  assert.equal(emitted.join(''), 'ABC');
});

test('the shared outline numbers one requirement list for all parts and only holds if every feature is covered', async () => {
  const { cleanOutline, partPrompt, chapterGroups } = await import('../spec-parallel.mjs');
  const features = [{ name: 'Namensliste pflegen' }, { name: 'Paare auslosen' }];
  const o = cleanOutline({ requirements: [{ id: 'X9', feature: 'paare auslosen', title: 'Zufällige Paare bilden', priority: 'Muss' }, { feature: 'Namensliste pflegen', title: 'Namen anlegen', priority: 'egal' }, { feature: 'Erfunden', title: 'x' }],
    roles: ['Teamleitung'], address: 'Du', data: [{ entity: 'Person', note: 'Name' }, 'kaputt'], decisions: ['Anwesenheit bleibt gespeichert.'] }, features);
  assert.deepEqual(o.requirements, [{ id: 'FR-001', feature: 'Paare auslosen', title: 'Zufällige Paare bilden', priority: 'Muss' }, { id: 'FR-002', feature: 'Namensliste pflegen', title: 'Namen anlegen', priority: 'Soll' }]);
  assert.deepEqual([o.address, o.roles, o.data.length, o.decisions.length], ['neutral', ['Teamleitung'], 1, 1]);
  assert.equal(cleanOutline({ requirements: [{ feature: 'Paare auslosen', title: 'x' }] }, features), null, 'a feature without requirement invalidates the outline');
  assert.equal(cleanOutline('kein Objekt', features), null);
  assert.match(partPrompt({ reserved: ['NFR-901'] }, chapterGroups[1], true), /genau die Anforderungen aus contract\.requirements/);
  assert.match(partPrompt({ reserved: ['NFR-901'] }, chapterGroups[0], true), /lege keine eigenen fest/);
  assert.doesNotMatch(partPrompt({ reserved: ['NFR-901'] }, chapterGroups[0]), /contract/);
});
