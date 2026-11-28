import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportAira,previewAira,verifyAira,sha256 } from '../aira-export.mjs';
import { decisionsFor, pointSuggestions, parseAiraJson } from '../aira-identities.mjs';
import { validatePlan } from '../planner.mjs';
const fixture=n=>JSON.parse(readFileSync(new URL('./fixtures/specit_v1/'+n+'.json',import.meta.url),'utf8'));
const input=n=>{const f=fixture(n);return {...f.source,spec:f.expected_files['SPEC.md'],approved:true}};
const manifest=files=>JSON.parse(files['manifest.json'].toString());
test('Unverändert reproduzierbar, SPEC-Änderung erfordert neue Revision und Freigabe',()=>{
  const i=input('linear'),first=exportAira(i),history=[manifest(first)];
  const again={...i,history};
  assert.deepEqual(exportAira(again),first);
  assert.equal(previewAira(again).unchanged,true);
  const changed={...again,spec:i.spec+'\nÄnderung\n'};
  const p=previewAira(changed);
  assert.equal(p.manifest.revision,2);
  assert.equal(p.manifest.spec_sha256,sha256(Buffer.from(changed.spec)));
  assert.notEqual(p.manifest.spec_sha256,history[0].spec_sha256);
  assert.throws(()=>exportAira(changed),/Revision/);
  assert.throws(()=>exportAira({...changed,revision:2}),/Änderungsplan/);
  const second=exportAira({...changed,revision:2,changes_approved:true});
  assert.deepEqual(manifest(second).tasks,history[0].tasks);
  assert.equal(verifyAira(second,history),true);
  assert.deepEqual(exportAira({...changed,revision:2,history:[...history,manifest(second)]}),second);
  assert.throws(()=>exportAira({...changed,revision:2,history:[]}),/historie/i);
  assert.throws(()=>exportAira({...changed,revision:3,changes_approved:true}),/Revision/);
});
test('Entfernung, Umbenennung und entfernte Klärungsabhängigkeit blockieren',()=>{
  const i=input('blocked'),history=[manifest(exportAira(i))];
  const attempt=mutate=>{const p=structuredClone(i.plan);mutate(p);return previewAira({...i,history,plan:validatePlan(p)})};
  assert.throws(()=>attempt(p=>p.tasks.shift()),/T03: Task entfernt/);
  assert.throws(()=>attempt(p=>p.tasks[0].title='Neu'),/T03: Titel umbenannt/);
  assert.throws(()=>attempt(p=>p.tasks[2].blockedBy=[]),/Klärungsabhängigkeit entfernt/);
});
test('Neue Entscheidung erhält nächste B-ID trotz früherer Sortierung, bestehende bleiben',()=>{
  const i=input('blocked'),history=[manifest(exportAira(i))];
  const p=structuredClone(i.plan);p.tasks[0].blockedBy.push('A – neu?');
  const plan=validatePlan(p),confirmed_points={...i.confirmed_points,B03:3};
  assert.equal(decisionsFor(plan,history).at(-1).decision,'A – neu?');
  const next={...i,plan,confirmed_points,history,revision:2,changes_approved:true};
  const m=manifest(exportAira(next));assert.equal(m.blockers[2].id,'B03');
  assert.equal(m.blockers[0].decision,history[0].blockers[0].decision);
});
test('Änderungsplan nennt Referenzen, Abhängigkeiten und Punkte; keine Eingabewerte in Fehlern',()=>{
  const i=input('linear'),history=[manifest(exportAira(i))],p=structuredClone(i.plan);
  p.tasks[0].requirements.push('FR-99: neues Kriterium');p.tasks[0].dependsOn=[];
  const preview=previewAira({...i,history,plan:validatePlan(p),confirmed_points:{...i.confirmed_points,T01:8}});
  assert.equal(preview.manifest.spec_sha256,history[0].spec_sha256);
  assert.notEqual(preview.manifest_sha256,sha256(exportAira(i)['manifest.json']));
  for(const change of ['T02: requirements geändert','T02: dependsOn geändert','T01: Punkte geändert'])assert.ok(preview.changes.includes(change));
  for(const title of ['a|b','x'.repeat(161),'# geheim','x\\y','x;y','x\nz']){
    const plan=structuredClone(i.plan);plan.tasks[0].title=title;
    assert.throws(()=>exportAira({...i,plan}),e=>e.message.startsWith('Aira-Export:')&&!e.message.includes(title));
  }
  const plan=structuredClone(i.plan);plan.tasks[0].requirements=[];
  assert.throws(()=>exportAira({...i,plan}),/Aira-Export/);
  for(const artifacts of [{'artifacts/CON.txt':'x'},{'artifacts/../x':'x'},{'artifacts/x':'x','artifacts/X':'x'},{'artifacts/x':'x','artifacts/x/y':'y'}])assert.throws(()=>exportAira({...i,artifacts}),/Artefakt/);
});
test('Unicode und Tabellenzeichen in Inhalten bleiben bytegetreu; fehlende Artefakte blockieren',()=>{
  const i=input('linear'),p=structuredClone(i.plan);
  p.tasks[0].title='Übersicht 🏠';p.tasks[0].acceptance=['FR-01: | ä ß 🏠'];
  const files=exportAira({...i,plan:validatePlan(p),artifacts:{'artifacts/layout.txt':'ä | 🏠\r\n'}});
  assert.match(files['draft/02-T02.md'].toString(),/FR-01: \| ä ß 🏠/);
  assert.equal(verifyAira(files),true);
  delete files['artifacts/layout.txt'];assert.throws(()=>verifyAira(files),/Aira-Export/);
});

test('KI-Punktevorschläge sind separate, validierte Metadaten ohne Default',()=>{
  const plan=input('linear').plan;
  assert.deepEqual(pointSuggestions(plan,[{id:'T01',aira_points:3},{id:'T02',aira_points:4},{id:'T99',aira_points:8}]),{T01:3});
  assert.deepEqual(pointSuggestions(plan,[{id:'T01',aira_points:3},{id:'T01',aira_points:5}]),{});
  assert.deepEqual(pointSuggestions(plan,[]),{});
  assert.throws(()=>exportAira({...input('linear'),confirmed_points:{}}),/Punkte/);
});
test('Striktes JSON: auch verschachtelte und escaped doppelte Keys, nichtendliche Zahlen',()=>{
  assert.deepEqual(parseAiraJson(' { "a": [ {"b":1}, {"b":2} ] } '),{a:[{b:1},{b:2}]});
  for(const raw of ['{"a":1,"a":2}','{"a":{"b":1,"\\u0062":2}}','{"x":[1e999]}','{"x":NaN}'])assert.throws(()=>parseAiraJson(raw),/Aira-Export/);
});
