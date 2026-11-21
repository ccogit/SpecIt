import test from 'node:test';
import assert from 'node:assert/strict';
import { skillStages, skillsFor, withSkills } from '../skills.mjs';
import { requirementIds, validateTraceability, traceGaps } from '../traceability.mjs';

test('all stages have valid, nonempty skill instructions and consistent contract skill', () => {
  for (const stage of ['questions', 'decisions', 'triage', 'revise', 'final', 'adjust', 'scope', 'features', 'plan', 'reuse']) {
    assert.ok(skillStages[stage].includes('traceability'));
    const selected = skillsFor(stage);
    assert.ok(selected.every(x => x.content.length > 100));
    const output = withSkills(stage, 'Original instruction');
    assert.ok(output.startsWith('Original instruction'));
    for (const skill of selected) assert.ok(output.includes('### Skill: ' + skill.name));
  }
  assert.throws(() => skillsFor('../secret'));
});

test('requirement references are extracted uniquely', () => {
  assert.deepEqual(requirementIds('FR-001, NFR-002, FR-001'), ['FR-001', 'NFR-002']);
});

const plan = tasks => ({tasks:tasks.map(([id,requirements]) => ({id,requirements}))});
test('traceability covers all declared requirements', () => {
  const p = plan([['T01',['FR-001']],['T02',['NFR-002']]]);
  assert.equal(validateTraceability('FR-001 and NFR-002',p),p);
  assert.throws(() => validateTraceability('FR-001 and NFR-002',plan([['T01',['FR-001']]])),/NFR-002/);
  assert.throws(() => validateTraceability('FR-001',plan([['T01',['FR-999']]])),/unbekannte Anforderung/);
  assert.throws(() => validateTraceability('FR-001',plan([['T01',['prose only']]])),/keinen Bezug/);
});

test('legacy specifications without requirement IDs are accepted', () => {
  const p = plan([['T01',['Produktziel']]]);assert.equal(validateTraceability('Ziel und Funktionen',p),p);
});

test('gaps in traceability are reported instead of discarding the plan', () => {
  const p = plan([['T01', ['FR-001']], ['T02', ['FR-009']], ['T03', ['nur Prosa']]]);
  assert.deepEqual(traceGaps('FR-001 und NFR-002', p), { ids: 2, missing: ['NFR-002'], unknown: ['FR-009'], untraced: ['T03'] });
  assert.deepEqual(traceGaps('ohne Kennungen', p), { ids: 0, missing: [], unknown: [], untraced: [] });
});
test('the planning skills ask nothing back: the concept is complete before planning', () => {
  const text = withSkills('plan', 'x');
  assert.ok(text.includes('Do not block tasks and do not ask back') && !text.includes('Flag any affected task blocked'));
});
