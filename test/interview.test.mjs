import test from 'node:test';
import assert from 'node:assert/strict';
import { topics, cleanQuestion, cleanQuestions, demoQuestions, demoSpec, acceptDefault, answerOf, summary, coverage } from '../interview.mjs';

test('demo catalog covers every topic with valid defaults', () => {
  const qs = demoQuestions();
  assert.ok(qs.length >= 10);
  topics.forEach((_, i) => assert.ok(qs.some(q => q.topic === i), 'topic ' + i));
  for (const q of qs) { assert.equal(q.state, 'open'); assert.ok(q.defaults.every(i => i < q.options.length)); assert.ok(q.multi || q.defaults.length === 1); }
});
test('already asked questions are not repeated', () => {
  const first = demoQuestions();
  assert.deepEqual(demoQuestions(first), []);
  assert.equal(demoQuestions(first.slice(0, 3)).length, first.length - 3);
});
test('unusable or malformed questions are dropped or repaired', () => {
  assert.equal(cleanQuestion({ question: 'Nur eine Option?', options: ['a'] }), null);
  assert.equal(cleanQuestion(null), null);
  const q = cleanQuestion({ topic: 'technik', question: ' Wo  speichern? ', options: ['Lokal', 'Server', 'Lokal'], defaults: [7, 1, 0], state: 'decided' });
  assert.equal(q.topic, 4);
  assert.equal(q.question, 'Wo speichern?');
  assert.deepEqual(q.options, ['Lokal', 'Server']);
  assert.deepEqual(q.defaults, [1]);
  assert.equal(q.state, 'open', 'decided without an answer falls back to open');
  assert.equal(cleanQuestions([q, q]).length, 1);
});
test('accepting a default answers the question as an assumption', () => {
  const q = acceptDefault(demoQuestions()[0]);
  assert.equal(q.state, 'default');
  assert.equal(answerOf(q), q.options[q.defaults[0]]);
  assert.equal(answerOf(demoQuestions()[0]), '');
});
test('coverage gauge rises with every answered question and reaches 100', () => {
  let qs = demoQuestions();
  assert.equal(coverage(qs).percent, 0);
  let last = 0;
  for (let i = 0; i < qs.length; i++) {
    qs = qs.map((q, j) => (j === i ? acceptDefault(q) : q));
    const now = coverage(qs).percent;
    assert.ok(now >= last);
    last = now;
  }
  assert.equal(last, 100);
  assert.deepEqual(summary(qs), { total: qs.length, decided: 0, defaults: qs.length, open: 0 });
  assert.equal(coverage([]).percent, 0);
});
test('demo spec marks defaults as assumptions and lists open decisions', () => {
  const qs = demoQuestions().map((q, i) => (i === 0 ? acceptDefault(q) : i === 1 ? { ...q, state: 'decided', choice: [1] } : q));
  const md = demoSpec('Pair Pressure', 'Kennenlerngespräche auslosen', qs);
  assert.ok(md.startsWith('# Pair Pressure'));
  assert.ok(md.includes('Kennenlerngespräche auslosen'));
  assert.ok(md.includes(qs[0].options[0] + ' _(Annahme – Standard)_'));
  assert.ok(md.includes('**' + qs[1].question + '** ' + qs[1].options[1] + '\n') || md.includes('**' + qs[1].question + '** ' + qs[1].options[1]));
  assert.ok(md.split('## Offene Entscheidungen')[1].includes(qs[2].question));
});
