import test from 'node:test';
import { estimate } from '../planner.mjs';
import assert from 'node:assert/strict';
import { topics, cleanQuestion, cleanQuestions, demoQuestions, demoSpec, acceptDefault, answerOf, summary, coverage, applyEdits, reviseDemo, specLine, applyAutonomy, framePrompt, demoRelevant, adjustDemo, cleanFeatures, demoFeatures, workPackages, suggestExtensions, featureDuration, mapAnswers } from '../interview.mjs';

test('autonomy decides a share of the questions itself and gives them back when lowered', () => {
  const qs = demoQuestions(), n = qs.length;
  assert.equal(summary(applyAutonomy(qs, 0)).open, n, 'question-led: nothing assumed');
  assert.equal(summary(applyAutonomy(qs, 100)).defaults, n, 'auto mode: nothing asked');
  const half = applyAutonomy(qs, 50);
  assert.equal(summary(half).open, Math.round(n / 2));
  assert.ok(half.slice(0, Math.round(n / 2)).every(q => q.state === 'open'), 'the first, weightiest questions stay with the user');
  // Eine eigene Antwort und ein von Hand übernommener Standard bleiben, wenn der Grad sinkt.
  const mine = applyAutonomy(qs, 100).map((q, i) => (i === n - 1 ? { ...q, state: 'decided' } : i === n - 2 ? { ...q, auto: false } : q));
  const back = applyAutonomy(cleanQuestions(mine), 0);
  assert.deepEqual(back.map(q => q.state).slice(-2), ['default', 'decided']);
  assert.equal(summary(back).open, n - 2);
});
test('without AI the decisions on goal, users and features stay with the user', () => {
  const qs = demoQuestions().map((q, i) => (i === 0 ? acceptDefault(q) : q));
  const relevant = demoRelevant(qs);
  assert.ok(relevant.length > 0 && !relevant.includes(0), 'answered questions are not open decisions');
  assert.ok(relevant.every(i => qs[i].topic <= 2) && qs.every((q, i) => relevant.includes(i) === (q.state === 'open' && q.topic <= 2)));
});
test('without AI a change request becomes an additional requirement', () => {
  const qs = demoQuestions().map(acceptDefault), spec = demoSpec('P', 'Idee', qs);
  assert.equal(adjustDemo(spec, 'P', 'Idee', qs, [], 'CSV-Export'), demoSpec('P', 'Idee', qs, ['CSV-Export']));
  const edited = adjustDemo(spec + '\n\n## Notizen\n\nBleibt.', 'P', 'Idee', qs, [], 'CSV-Export');
  assert.ok(edited.includes('## Zusätzliche Anforderungen\n\n- CSV-Export') && edited.includes('Bleibt.') && edited.includes('[Zusätzliche Anforderungen](#zusätzliche-anforderungen)'));
  const twice = adjustDemo(edited, 'P', 'Idee', qs, ['CSV-Export'], 'Druckansicht');
  assert.ok(twice.includes('- CSV-Export\n- Druckansicht') && twice.split('## Zusätzliche Anforderungen').length === 2);
});
test('target duration appears in the demo spec and in the prompt frame', () => {
  const qs = demoQuestions().map(acceptDefault);
  assert.ok(demoSpec('P', 'Idee', qs, [], '3 Tage').includes('**Ziel-Entwicklungsdauer** 3 Tage'));
  assert.ok(!demoSpec('P', 'Idee', qs).includes('Ziel-Entwicklungsdauer'));
  const changed = qs.map((q, i) => (i === 0 ? { ...q, state: 'decided' } : q));
  assert.equal(reviseDemo(demoSpec('P', 'Idee', qs, [], '3 Tage'), 'P', 'Idee', qs, changed, [], 0, '3 Tage'), demoSpec('P', 'Idee', changed, [], '3 Tage'));
  assert.ok(framePrompt(100, '').includes('Auto-Modus') && framePrompt(0, '').includes('keinerlei') && framePrompt(40, '2 Wochen').includes('2 Wochen'));
});

test('edits apply only when every find occurs exactly once', () => {
  assert.equal(applyEdits('a b c', [{ find: 'b', replace: 'x' }, { find: 'c', replace: '' }]), 'a x ');
  assert.equal(applyEdits('a b b', [{ find: 'b', replace: 'x' }]), null, 'ambiguous');
  assert.equal(applyEdits('a b c', [{ find: 'z', replace: 'x' }]), null, 'missing');
  assert.equal(applyEdits('a b c', [{ find: 'b', replace: 'b' }]), null, 'no change');
  assert.equal(applyEdits('a b c', []), null);
  assert.equal(applyEdits('a b c', [{ find: 'b' }]), null);
});
test('changing an answer revises the demo spec without regenerating edited text', () => {
  const before = demoQuestions().map(acceptDefault);
  const after = before.map((q, i) => (i === 2 ? { ...q, state: 'decided', choice: [0] } : q));
  const spec = demoSpec('P', 'Idee', before);
  const revised = reviseDemo(spec, 'P', 'Idee', before, after, [], 2);
  assert.equal(revised, demoSpec('P', 'Idee', after));
  assert.ok(revised.includes(specLine(after[2])) && !revised.includes(specLine(before[2])));
  // Von Hand ergänzter Entwurf: nur die Zeile der Frage wird ersetzt, der Zusatz bleibt.
  const edited = spec + '\n\n## Notizen\nBleibt stehen.';
  const partial = reviseDemo(edited, 'P', 'Idee', before, after, [], 2);
  assert.ok(partial.endsWith('Bleibt stehen.') && partial.includes(specLine(after[2])) && !partial.includes(specLine(before[2])));
  assert.equal(reviseDemo('# Ganz anderer Text', 'P', 'Idee', before, after, [], 2), null);
  // Offene Frage beantworten: wandert aus den offenen Entscheidungen in ihr Thema.
  const open = before.map((q, i) => (i === 2 ? { ...q, state: 'open', choice: [] } : q));
  const answered = reviseDemo(demoSpec('P', 'Idee', open), 'P', 'Idee', open, after, [], 2);
  assert.ok(answered.split('## Offene Entscheidungen')[1].includes('Keine.'));
});

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

test('features form a work breakdown structure whose widest stage limits parallel agents', () => {
  const f = cleanFeatures([
    { id: 'F01', name: 'Gerüst', minutes: 60, core: true },
    { id: 'F02', name: 'A', minutes: 60, dependsOn: ['F01'] },
    { id: 'F03', name: 'B', minutes: 30, dependsOn: ['F01', 'F99', 'F03'] },
    { name: 'C', minutes: 30, dependsOn: ['F02', 'F03'] },
  ]);
  assert.deepEqual(f.map(x => x.id), ['F01', 'F02', 'F03', 'F04']);
  assert.deepEqual(f[2].dependsOn, ['F01'], 'unknown and self references are dropped');
  const w = workPackages(f);
  assert.deepEqual(w.waves, [['F01'], ['F02', 'F03'], ['F04']]);
  assert.equal(w.width, 2);
  assert.equal(estimate(w, 1), 180);
  assert.equal(estimate(w, 2), 150);
  // Abgewähltes fällt heraus, samt der Abhängigkeit darauf
  const off = workPackages(f.map(x => (x.id === 'F02' ? { ...x, on: false } : x)));
  assert.deepEqual(off.waves, [['F01'], ['F03'], ['F04']]);
  // Ein Zyklus wird aufgelöst statt zu hängen
  const loop = workPackages(cleanFeatures([{ id: 'F01', name: 'X', dependsOn: ['F02'] }, { id: 'F02', name: 'Y', dependsOn: ['F01'] }]));
  assert.equal(loop.waves.flat().length, 2);
  const demo = workPackages(demoFeatures(demoQuestions().map(acceptDefault)));
  assert.deepEqual(demo.waves[0], ['F01']);
  assert.ok(demo.width >= 2 && demo.waves.length === 3, 'quality work follows the functions');
});

test('extensions are suggested only as far as the target duration allows; base features always stay', () => {
  const f = cleanFeatures([
    { id: 'F01', name: 'Gerüst', minutes: 60, core: true },
    { id: 'F02', name: 'Kernfunktion', minutes: 60, core: true, dependsOn: ['F01'] },
    { id: 'F03', name: 'Export', minutes: 90, dependsOn: ['F02'] },
    { id: 'F04', name: 'Suche', minutes: 30, dependsOn: ['F02'] },
    { id: 'F05', name: 'Suchfilter', minutes: 20, dependsOn: ['F04'] },
  ]);
  assert.equal(featureDuration(f, 1), 260);
  const tight = suggestExtensions(f, 180, 1);
  assert.equal(tight.base, 120);
  assert.deepEqual(tight.chosen, ['F04', 'F05'], 'the long export does not fit, the two short ones do');
  assert.equal(tight.total, 170);
  assert.ok(tight.features.filter(x => x.core).every(x => x.on));
  // Eine Erweiterung bringt die Erweiterung mit, auf der sie aufbaut
  const pair = suggestExtensions(f.filter(x => x.id !== 'F03'), 170, 1);
  assert.deepEqual(pair.chosen, ['F04', 'F05']);
  // Reicht die Zeit nicht einmal für die Basis, bleibt es bei der Basis
  const none = suggestExtensions(f, 60, 1);
  assert.deepEqual(none.chosen, []);
  assert.equal(none.total, 120);
  // Mit zwei Agenten passt mehr hinein
  assert.deepEqual(suggestExtensions(f, 210, 1).chosen, ['F03']);
  assert.deepEqual(suggestExtensions(f, 210, 2).chosen, ['F03', 'F04', 'F05']);
  const demo = demoFeatures(demoQuestions().map(acceptDefault));
  assert.ok(demo.filter(x => x.core).length >= 2 && demo.some(x => !x.core), 'demo separates base features from extensions');
});

test('decisions and features stay linked: features know their decisions, changed scope maps back to answers', () => {
  const qs = demoQuestions().map(acceptDefault);
  const feats = demoFeatures(qs);
  assert.ok(feats.filter(f => !f.name.startsWith('Grundgerüst')).every(f => f.from.length === 1 && answerOf(qs[f.from[0]]) === f.name));
  const single = qs.findIndex(q => !q.multi), multi = qs.findIndex(q => q.multi);
  const mapped = mapAnswers(qs, [
    { nr: single + 1, answer: qs[single].options[1].toUpperCase() },
    { nr: multi + 1, answer: 'Entfällt in dieser Version' },
    { nr: single + 1, answer: 'doppelt' }, { nr: 999, answer: 'x' }, { nr: 2, answer: answerOf(qs[1]) },
  ]);
  assert.deepEqual(mapped, [{ index: single, choice: [1], custom: '' }, { index: multi, choice: [], custom: 'Entfällt in dieser Version' }]);
});
