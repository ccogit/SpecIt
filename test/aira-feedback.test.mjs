import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendFeedback, feedbackProjection, createFeedbackStore } from '../aira-feedback.mjs';

const fixture = name => JSON.parse(readFileSync(new URL('./fixtures/aira-v2/'+name+'.json',import.meta.url)));
const feedback=fixture('feedback'), revised=fixture('revised'), linear=fixture('linear');
const events=feedback.events.map(e=>({...e,bytes:Buffer.from(e.text)}));
const archive=f=>({manifest_sha256:f.expected_sha256['manifest.json'],files:Object.fromEntries(Object.entries(f.expected_files).map(([k,v])=>[k,Buffer.from(v)]))});
const binding=Object.fromEntries(['binding_id','repo','jira_project','plan_id'].map(k=>[k,JSON.parse(events[0].text)[k]]));
const context={binding,history:[archive(linear),archive(revised)]};
const importAll=()=>events.reduce((entries,e)=>appendFeedback(entries,e.bytes,context,e.sha256).entries,[]);
const mutate=(event,fn)=>{const v=JSON.parse(event.text);fn(v);return Buffer.from(JSON.stringify(v));};

test('T14 fixture original bytes, exact replay and all negative fixture cases',()=>{
  const first=appendFeedback([],events[0].bytes,context,events[0].sha256);
  assert.equal(first.status,'accepted');
  const second=appendFeedback(first.entries,events[1].bytes,context,events[1].sha256);
  assert.equal(second.status,'accepted');
  assert.equal(appendFeedback(second.entries,events[0].bytes,context).status,'no_op');
  for(const c of feedback.cases){
    const e=events.find(e=>e.sequence===c.sequence);
    if(c.expected==='no_op')assert.equal(appendFeedback(second.entries,e.bytes,context).status,'no_op');
    else {
      const entries=c.id==='same_sequence_different_hash'?second.entries:first.entries;
      assert.throws(()=>appendFeedback(entries,mutate(e,v=>v[c.field]=c.value),context),c.id);
    }
  }
});
test('T14 foreign binding, missing fields, bad ID, false verification and receipt hash rejected',()=>{
  for(const fn of [
    v=>v.binding_id='00000000-0000-0000-0000-000000000000',
    v=>v.repo='other/repo',v=>v.jira_project='OTHER',v=>delete v.findings,
    v=>v.tasks[0].criteria[0].id='AC-UNKNOWN',
    v=>v.requirements[0].state='verified',
    v=>v.tasks[0].state='invalid'
  ])assert.throws(()=>appendFeedback([],mutate(events[0],fn),context));
  const first=appendFeedback([],events[0].bytes,context).entries;
  for(const field of ['assignment_id','pr_number','head_sha','base_sha','candidate_sha','merge_sha','acceptance_event_id'])
    assert.throws(()=>appendFeedback(first,mutate(events[1],v=>v.tasks[0][field]=null),context),{code:'EVIDENCE_MISMATCH'});
  assert.throws(()=>appendFeedback([],events[0].bytes,context,'0'.repeat(64)),{code:'INVALID_HASH'});
  assert.throws(()=>appendFeedback([],Buffer.from(events[0].text.replace('"sequence": 1','"sequence": 1, "sequence": 1')),context));
  assert.throws(()=>appendFeedback([],Buffer.from([255]),context));
});
test('T14 unknown, historical and stale projection without changing package or input',()=>{
  const before=structuredClone(context);
  assert.equal(feedbackProjection([],context).freshness,'unknown');
  const entries=importAll(), p=feedbackProjection(entries,context);
  assert.equal(p.freshness,'current');
  assert.equal(p.history[0].historical,true);
  assert.equal(p.current.feedback.sequence,2);
  const advanced={...context,history:[...context.history,{manifest_sha256:'f'.repeat(64)}]};
  assert.equal(feedbackProjection(entries,advanced).freshness,'stale');
  assert.equal(feedbackProjection(entries,advanced).current,null);
  p.current.feedback.tasks[0].state='failed';
  assert.equal(feedbackProjection(entries,context).current.feedback.tasks[0].state,'done');
  assert.deepEqual(structuredClone(context),before);
});
test('T14 dedicated storage restart, restore, no-op and conflict protection',()=>{
  const dir=mkdtempSync(join(tmpdir(),'specit-feedback-')), other=mkdtempSync(join(tmpdir(),'specit-feedback-'));
  try{
    const s=createFeedbackStore(dir,()=>context);
    assert.equal(s.import(events[0].bytes),'accepted');
    assert.equal(s.import(events[1].bytes),'accepted');
    const reopened=createFeedbackStore(dir,()=>context);
    assert.equal(reopened.import(events[1].bytes),'no_op');
    const target=createFeedbackStore(other,()=>context);
    assert.equal(target.restore(reopened.backup()),'restored');
    assert.equal(target.projection().current.feedback.sequence,2);
    assert.throws(()=>target.restore([]),{code:'HISTORY_CONFLICT'});
    writeFileSync(join(dir,'feedback.lock'),'');
    assert.throws(()=>s.import(events[1].bytes),{code:'HISTORY_CONFLICT'});
    const corrupted=target.backup();corrupted[0].sha256='0'.repeat(64);
    assert.throws(()=>target.restore(corrupted),{code:'INVALID_HASH'});
  }finally{rmSync(dir,{recursive:true,force:true});rmSync(other,{recursive:true,force:true});}
});
