import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmRequirementRevision, persistRequirementRevision, requirementCoverageReport} from '../aira-requirement-revisions.mjs';
import {allocateRequirementIdentity} from '../aira-requirement-identities.mjs';

function example() {
  return {
    plan: {tasks: [{id:'T01', title:'One', requirements:['FR-001']}]},
    data: {schema_version:2,plan_id:'example',revision:1,
      requirements:[{id:'FR-001',text:'A',mandatory:true,state:'approved'}],
      decisions:[], criteria:[{id:'AC-T01-001',task_id:'T01',requirement_ids:['FR-001'],text:'Works',verification:'test',decision_id:null}],
      tests:[{id:'TC-T01-001',task_id:'T01',criterion_ids:['AC-T01-001'],description:'Check'}],
      retired_ids:[],exceptions:[]},
  };
}
const ids = ['T01','FR-001','AC-T01-001','TC-T01-001'];
const initial = (plan,data) => confirmRequirementRevision(plan,data,{confirmedIds:ids});

test('identity snapshot survives reload; explicit title change keeps ID', () => {
  const {plan,data}=example();
  const previous=JSON.parse(JSON.stringify(initial(plan,data)));
  plan.tasks[0].title='Renamed'; data.revision++;
  assert.throws(()=>confirmRequirementRevision(plan,data,{previous}),/Unconfirmed identity change/);
  const next=confirmRequirementRevision(plan,data,{previous,confirmedIds:['T01']});
  assert.equal(next.plan.tasks[0].id,'T01');
  assert.equal(previous.plan.tasks[0].title,'One');
  assert.deepEqual(next.highWater,previous.highWater);
});

test('semantic replacement requires confirmation and tombstone and cannot reuse IDs', () => {
  const {plan,data}=example();
  const previous=initial(plan,data);
  data.revision++;
  data.criteria[0].id=allocateRequirementIdentity(previous.highWater,'AC','T01').id;
  data.tests[0].criterion_ids=[data.criteria[0].id];
  const confirmedIds=[data.criteria[0].id,'TC-T01-001'];
  assert.throws(()=>confirmRequirementRevision(plan,data,{previous,confirmedIds}),/Missing tombstone/);
  data.retired_ids=[{kind:'criterion',id:'AC-T01-001',reason:'Replaced',retired_revision:2}];
  const next=confirmRequirementRevision(plan,data,{previous,confirmedIds});
  assert.equal(allocateRequirementIdentity(next.highWater,'AC','T01').id,'AC-T01-003');
  data.revision++;
  data.criteria[0].id='AC-T01-001'; data.tests[0].criterion_ids=['AC-T01-001'];
  assert.throws(()=>confirmRequirementRevision(plan,data,{previous:next,confirmedIds:['AC-T01-001','TC-T01-001']}),/Duplicate historical identity/);
});

test('missing confirmation, unknown requirement, duplicate ID and mandatory gap are rejected', () => {
  const {plan,data}=example();
  assert.throws(()=>confirmRequirementRevision(plan,data),/Unconfirmed new identity/);
  const bad=structuredClone(data); bad.requirements.push(bad.requirements[0]);
  assert.throws(()=>initial(plan,bad),/duplicate identity/);
  const unknown=structuredClone(plan); unknown.tasks[0].requirements=['FR-002'];
  assert.throws(()=>initial(unknown,data),/unknown requirement/);
  const gap=structuredClone(data); gap.requirements[0].state='deferred';
  assert.throws(()=>initial(plan,gap),/Mandatory requirement/);
});

test('reordering keeps all IDs; decision text changes require explicit confirmation', () => {
  const {plan,data}=example();
  plan.tasks.push({id:'T02',title:'Two',requirements:['FR-001']});
  data.criteria.push({id:'AC-T02-001',task_id:'T02',requirement_ids:['FR-001'],text:'Also works',verification:'manual',decision_id:null});
  data.decisions.push({id:'B01',text:'Original question',state:'open',task_ids:['T01'],requirement_ids:[],resolution:null,evidence_ref:null,confirmed_by:null,confirmed_at:null});
  data.criteria.push({id:'AC-B01-001',task_id:'B01',requirement_ids:[],text:'Decide',verification:'manual',decision_id:'B01'});
  const previous=confirmRequirementRevision(plan,data,{confirmedIds:[...ids,'T02','AC-T02-001','B01','AC-B01-001']});
  plan.tasks.reverse(); data.criteria.reverse(); data.revision++;
  const reordered=confirmRequirementRevision(plan,data,{previous});
  assert.deepEqual(reordered.highWater,previous.highWater);
  data.revision++; data.decisions[0].text='Rephrased question';
  assert.throws(()=>confirmRequirementRevision(plan,data,{previous:reordered}),/Unconfirmed identity change: B01/);
  const next=confirmRequirementRevision(plan,data,{previous:reordered,confirmedIds:['B01']});
  assert.equal(next.requirements.decisions[0].id,'B01');
  assert.deepEqual(next.requirements.decisions[0].task_ids,['T01']);
});

test('V1 IDs require a complete explicit migration mapping; old IDs cannot be recycled', () => {
  const {plan,data}=example();
  const manifest=JSON.stringify({schema_version:1,plan_id:'example',repo:'example/repo',revision:1,
    plan:{tasks:[{id:'T01',title:'Old'},{id:'T09',title:'Retire'}]},blockers:[]});
  data.retired_ids=[{kind:'task',id:'T09',reason:'Replaced',retired_revision:1}];
  const migration={confirmed:true,evidence_ref:'local/migration',target:'confirmed target',repo:'example/repo',
    manifest_bytes:[manifest],mapping:[{id:'T01',action:'retain'},{id:'T09',action:'retire'}]};
  assert.throws(()=>confirmRequirementRevision(plan,data,{confirmedIds:ids,migration:{...migration,mapping:migration.mapping.slice(0,1)}}),/Incomplete V1/);
  const snapshot=confirmRequirementRevision(plan,data,{confirmedIds:ids,migration});
  assert.equal(snapshot.migration.manifest_bytes[0],manifest);
  assert.equal(allocateRequirementIdentity(snapshot.highWater,'T').id,'T10');
  assert.equal(snapshot.plan.tasks[0].id,'T01');
});

test('task cannot use a test namespace; required text cannot be empty', () => {
  const {plan,data}=example();
  plan.tasks[0].id='TC-T01-002';
  assert.throws(()=>initial(plan,data),/invalid or duplicate identity/);
  plan.tasks[0].id='T01'; data.requirements[0].text='';
  assert.throws(()=>initial(plan,data),/Missing requirement text/);
});

test('storage reload preserves predecessor and failed confirmation does not write', () => {
  const {plan,data}=example();
  let stored=null;
  const storage={getItem:()=>stored,setItem:(_key,value)=>{stored=value}};
  const previous=persistRequirementRevision(storage,'example',plan,data,{confirmedIds:ids});
  const before=stored;
  data.revision++; plan.tasks[0].title='New';
  assert.throws(()=>persistRequirementRevision(storage,'example',plan,data),/Unconfirmed identity change/);
  assert.equal(stored,before);
  const next=persistRequirementRevision(storage,'example',plan,data,{confirmedIds:['T01']});
  assert.deepEqual(next.highWater,previous.highWater);
  assert.equal(JSON.parse(stored).plan.tasks[0].title,'New');
});

test('coverage display distinguishes mandatory gaps and approved exceptions', () => {
  const {data}=example();
  data.requirements.push({id:'NFR-001',text:'Optional',mandatory:false,state:'deferred'});
  const report=requirementCoverageReport(data);
  assert.equal(report[0].state,'covered');
  assert.equal(report[1].state,'missing');
  data.exceptions.push({requirement_id:'NFR-001',reason:'Deferred for later',approved_by:'actor',approved_at:'2026-01-01T00:00:00Z'});
  assert.equal(requirementCoverageReport(data)[1].exception.reason,'Deferred for later');
  assert.equal(requirementCoverageReport(data)[1].state,'exception');
  data.requirements[0].state='deferred';
  assert.equal(requirementCoverageReport(data)[0].state,'missing');
});
