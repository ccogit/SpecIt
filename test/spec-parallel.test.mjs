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
