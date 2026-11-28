import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFeedbackApi} from '../aira-feedback-api.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/aira-v2/'+name+'.json',import.meta.url)));
const events=fixture('feedback').events;
const packageEntry=name=>{const f=fixture(name);return {manifest_sha256:f.expected_sha256['manifest.json'],files:Object.fromEntries(Object.entries(f.expected_files).map(([k,v])=>[k,Buffer.from(v)]))};};
const {binding_id,jira_project,repo,plan_id}=JSON.parse(events[0].text);
const binding={binding_id,jira_project};
const request=e=>({action:'import',source_confirmed:true,bytes:Buffer.from(e.text).toString('base64'),sha256:e.sha256});
function setup(t){
  const root=mkdtempSync(join(tmpdir(),'specit-s3-api-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const history=[packageEntry('linear'),packageEntry('revised')];
  const state={selection:1,project:{project_id:'P1',mode:'aira',binding:{repo,plan_id},generation:1,export_epoch:2,manifest_sha256:history.at(-1).manifest_sha256}};
  const store={active:()=>structuredClone(state),history:()=>structuredClone(history)};
  const body=()=>({project_id:state.project.project_id,selection:state.selection,repo,plan_id,expected_generation:state.project.generation,expected_head:state.project.manifest_sha256,expected_export_epoch:state.project.export_epoch});
  const open=()=>{const api=createFeedbackApi({store,root});return action=>api.dispatch({...body(),...action});};
  return {root,history,state,open,body};
}
test('T14 local project API: independently confirmed immutable binding, replay, restart, restore and no project writes',t=>{
  const e=setup(t),call=e.open(),before=structuredClone(e.history),state=structuredClone(e.state);
  assert.equal(call({action:'status'}).projection.freshness,'unknown');
  assert.throws(()=>call(request(events[0])),{code:'CONTEXT_UNAVAILABLE'});
  assert.throws(()=>call({action:'bind',...binding}),{code:'APPROVAL_REQUIRED'});
  assert.deepEqual(call({action:'bind',...binding,confirmed:true}).binding,binding);
  assert.throws(()=>call({action:'bind',...binding,jira_project:'OTHER',confirmed:true}),{code:'WRONG_TARGET'});
  assert.throws(()=>call({...request(events[0]),source_confirmed:false}),{code:'APPROVAL_REQUIRED'});
  assert.equal(call(request(events[0])).status,'accepted');
  assert.equal(call(request(events[1])).status,'accepted');
  const bytes=readFileSync(join(e.root,'feedback','P1','feedback.json'));
  const reopened=e.open();assert.equal(reopened(request(events[1])).status,'no_op');
  assert.equal(reopened(request(events[0])).projection.history[0].historical,true);
  assert.deepEqual(readFileSync(join(e.root,'feedback','P1','feedback.json')),bytes);
  const backup=reopened({action:'backup'}).backup;
  assert.equal(reopened({action:'restore',source_confirmed:true,backup}).status,'no_op');
  assert.throws(()=>reopened({action:'restore',source_confirmed:true,backup:{...backup,entries:backup.entries.slice(0,1)}}),{code:'HISTORY_CONFLICT'});
  assert.deepEqual(structuredClone(e.history),before);assert.deepEqual(e.state,state);
  // Package archive restored on a different machine, with separately confirmed binding.
  const target=setup(t),other=target.open();other({action:'bind',...binding,confirmed:true});
  assert.equal(other({action:'restore',source_confirmed:true,backup}).status,'restored');
  assert.equal(other({action:'status'}).projection.current.feedback.sequence,2);
});
test('T14 project API: stale CAS, competing lock, foreign project, stale source and invalid bytes',t=>{
  const e=setup(t),call=e.open();call({action:'bind',...binding,confirmed:true});
  assert.throws(()=>call({...request(events[0]),selection:0}),{code:'HISTORY_CONFLICT'});
  assert.throws(()=>call({...request(events[0]),repo:'other/repo'}),{code:'WRONG_TARGET'});
  assert.throws(()=>call({...request(events[0]),bytes:'@@'}),{code:'INVALID_HASH'});
  writeFileSync(join(e.root,'write.lock'),'');assert.throws(()=>call(request(events[0])),{code:'HISTORY_CONFLICT'});rmSync(join(e.root,'write.lock'));
  call(request(events[0]));call(request(events[1]));
  const old=e.body();e.state.project.export_epoch++;e.state.project.manifest_sha256='f'.repeat(64);e.history.push({manifest_sha256:'f'.repeat(64)});
  assert.equal(call({action:'status'}).projection.freshness,'stale');
  assert.equal(call({action:'status'}).projection.current,null);
  assert.throws(()=>call({...request(events[1]),...old}),{code:'HISTORY_CONFLICT'});
  e.state.project.mode='standalone';assert.throws(()=>call({action:'status'}),{code:'WRONG_TARGET'});
});
