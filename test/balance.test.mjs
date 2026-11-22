import test from 'node:test';
import assert from 'node:assert/strict';
import { balance } from '../balance.mjs';

const q = (state, extra = {}) => ({ question: 'F', options: ['a', 'b'], state, choice: [], custom: '', ...extra });

test('an empty project has no inputs, no shares and no outputs', () => {
  const b = balance({});
  assert.deepEqual(b.user, { words: 0, clicks: 0, decisions: 0 });
  assert.deepEqual(b.shares, { user: 0, std: 0, ai: 0 });
  assert.deepEqual(b.outputs, []);
});

test('the three input sources are counted separately', () => {
  const b = balance({ idea: 'Eine App für Notizen', clicks: 7, extras: ['CSV Export'],
    questions: [q('decided', { custom: 'nur lokal' }), q('default', { auto: true }), q('default'), q('open')],
    features: [{ own: true, on: true }, { own: true, on: false }, { own: false, on: true }], usage: { context: 1200, ai: 800, calls: 3 } });
  assert.deepEqual(b.user, { words: 8, clicks: 7, decisions: 2 });
  assert.deepEqual(b.std, { decisions: 2, auto: 1, words: 1200 });
  assert.deepEqual(b.ai, { words: 800, calls: 3, suggestions: 1 });
  assert.equal(b.open, 1);
  assert.equal(b.shares.user + b.shares.std + b.shares.ai, 100);
  assert.equal(b.inWords, 2008);
});

test('answering more yourself shifts the share from the standard to the user', () => {
  const few = balance({ questions: [q('decided'), q('default'), q('default'), q('default')] });
  const many = balance({ questions: [q('decided'), q('decided'), q('decided'), q('default')] });
  assert.ok(many.shares.user > few.shares.user && many.shares.std < few.shares.std);
});

test('outputs follow the chosen way: download lists files, direct implementation the scanned target folder', () => {
  const plan = { tasks: [{}, {}], waves: [['T01'], ['T02']] }, spec = '# X\n\n## Ziel\nText hier\n\n## Regeln\nmehr';
  const dl = balance({ spec, plan, planWords: 500, nextStep: 'download', finished: true });
  assert.deepEqual(dl.outputs.map(o => o.key), ['spec', 'plan', 'files']);
  assert.equal(dl.outputs[0].detail, '2 Abschnitte');
  assert.equal(dl.outputs[2].pending, false);
  const waiting = balance({ spec, plan, nextStep: 'run' });
  assert.equal(waiting.outputs[2].pending, true);
  const run = balance({ spec, plan, nextStep: 'run', name: 'Notizio', logos: 2,
    output: { files: 12, lines: 900, truncated: false, groups: [{ key: 'code', label: 'Code', files: 8, lines: 700 }, { key: 'tests', label: 'Tests', files: 0, lines: 0 }, { key: 'docs', label: 'Dokumentation', files: 4, lines: 200 }] } });
  assert.deepEqual(run.outputs.map(o => o.key), ['spec', 'brand', 'plan', 'code']);
  assert.equal(run.outputs[3].value, 12);
  assert.deepEqual(run.outputs[3].groups.map(g => g.label), ['Code', 'Dokumentation']);
  assert.equal(run.outputs[1].value, 3, 'the name counts as a result next to the two logos');
  assert.equal(run.outputs[1].unit, 'Ergebnisse');
  assert.equal(balance({ name: 'Notizio', logos: 1 }).outputs[0].detail, 'Name „Notizio“ · 1 Logo-Entwurf');
});
