import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExternalCore } from '../chat-backends.mjs';
import { chapterGroups } from '../spec-parallel.mjs';

test('stray heading marks and appended fixed chapters of small local models are tidied, not rejected', () => {
  const titles = chapterGroups.flat();
  const body = t => t === 'Funktionale Anforderungen' ? 'FR-001 Notizen\n\nAkzeptanzkriterium: sichtbar.' : 'Inhalt.';
  const raw = titles.map(t => '# ## ' + t + '\n\n' + body(t)).join('\n\n') + '\n\n# ## Abnahme\n\nDoppelt.';
  const core = validateExternalCore(raw, ['Notizen']);
  assert.ok(core.startsWith('## ' + titles[0]) && !core.includes('# ##') && !core.includes('Doppelt'));
  assert.throws(() => validateExternalCore(titles.slice(1).map(t => '## ' + t + '\n\n' + body(t)).join('\n\n'), []));
});
