import test from 'node:test';
import assert from 'node:assert/strict';
import { skillStages, skillsFor, withSkills } from '../skills.mjs';
import { requirementIds, validateTraceability, traceGaps } from '../traceability.mjs';

test('all operational stages have a concrete skill and a phase-specific quality gate', () => {
  const stages = ['concept','questions','decisions','triage','features','revise','final','adjust','scope','review','plan','reuse','implement'];
  assert.deepEqual(Object.keys(skillStages), stages);
  for (const stage of stages) {
    const selected = skillsFor(stage);
    assert.ok(selected.length > 0, 'no skill for ' + stage);
    for (const skill of selected) {
      assert.match(skill.content, /## Ablauf/);
      assert.match(skill.content, /## Ergebnis/);
      assert.match(skill.content, /## Qualitätsprüfung/);
      assert.ok(skill.content.length > 350);
    }
    const output = withSkills(stage, 'Original instruction');
    assert.ok(output.startsWith('Original instruction'));
    for (const skill of selected) assert.ok(output.includes('### Skill: ' + skill.name));
  }
  assert.deepEqual(skillStages.questions, ['discovery']);
  assert.deepEqual(skillStages.features, ['feature-scoping']);
  assert.deepEqual(skillStages.review, ['spec-review','traceability']);
  assert.deepEqual(skillStages.plan, ['execution','traceability']);
  assert.deepEqual(skillStages.reuse, ['reuse-discovery']);
  assert.deepEqual(skillStages.implement, ['implementation']);
  assert.ok(!skillStages.plan.includes('reuse-discovery'));
  assert.ok(!skillStages.questions.includes('traceability'));
  assert.throws(() => skillsFor('../secret'), /Unbekannte Skill-Phase/);
  assert.throws(() => withSkills('plan','  '), /Leere KI-Anweisung/);
});

test('coding agent skill is included in single tasks and overall execution, but only once in a backlog', async () => {
  const { demoPlan, renderTask, renderSingle, renderBacklog } = await import('../planner.mjs');
  const spec = 'Ziel: Nutzende können Einträge anlegen.';
  const plan = demoPlan(spec);
  const task = renderTask(plan.tasks[0],plan,spec);
  const single = renderSingle(plan,spec);
  const backlog = renderBacklog(plan,spec);
  assert.match(task,/### Skill: implementation/);
  assert.match(single,/### Skill: implementation/);
  assert.equal(backlog.split('### Skill: implementation').length-1,1);
  assert.match(task,/Validierung \(ausgeführt\/nicht ausgeführt\/fehlgeschlagen\)/);
});

test('server applies dedicated concept and review skills on actual AI calls', async () => {
  const { readFile } = await import('node:fs/promises');
  const server = await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(server,/withSkills\('concept',conceptPrompt\)/);
  assert.match(server,/codexAsk\(withSkills\('review',reviewPrompt\)/);
  assert.match(server,/ask\(withSkills\('review',reviewPrompt\)/);
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
  assert.ok(text.includes('Keine Rückfragen') && text.includes('blockedBy: []'));
  assert.ok(!text.includes('Flag any affected task blocked'));
  assert.ok(skillStages.plan.includes('execution'));
});
