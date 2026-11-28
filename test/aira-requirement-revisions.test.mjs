import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmRequirementRevision} from '../aira-requirement-revisions.mjs';
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
