import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFeedbackApi} from '../aira-feedback-api.mjs';
import {feedbackView} from '../public/aira-feedback-model.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const binding={plan_id:'P1',repo:'example/synthetic',binding_id:'b3fa1ac7-738e-44bb-a7b3-03ea0e35b30a',jira_project:'DEMO'};
const target={plan_id:binding.plan_id,repo:binding.repo};
const plan={tasks:[{id:'T01',blockedBy:['Format?']}]};
const requirements={schema_version:2,plan_id:binding.plan_id,revision:1,requirements:[{id:'FR-001',mandatory:true}],criteria:[
  {id:'AC-T01-001',task_id:'T01',requirement_ids:['FR-001']},{id:'AC-B01-001',task_id:'B01',requirement_ids:[]}
],decisions:[{id:'B01',text:'Format?',state:'open',task_ids:['T01'],requirement_ids:['FR-001'],resolution:null,evidence_ref:null,confirmed_by:null,confirmed_at:null}]};
function entry(req,plan,previous=null){
  const r=Buffer.from(JSON.stringify(req)),m=Buffer.from(JSON.stringify({schema_version:2,...target,revision:req.revision,plan,blockers:[{id:'B01'}],requirements_sha256:hash(r),previous_manifest_sha256:previous}));
  return {manifest_sha256:hash(m),files:{'manifest.json':m,'requirements.json':r}};
}
function setup(t,{owner='owner-test',history=[entry(requirements,plan)],project_id='P1'}={}){
  const root=mkdtempSync(join(tmpdir(),'specit-s3-review-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const state={selection:1,project:{project_id,mode:'aira',binding:target,generation:1,export_epoch:history.length,manifest_sha256:history.at(-1).manifest_sha256}};
  const store={active:()=>structuredClone(state),history:()=>structuredClone(history)};
  const api=createFeedbackApi({store,root,owner,now:()=>Date.parse('2026-11-28T12:03:00Z')});
  const ctx=()=>({project_id,selection:state.selection,...target,expected_generation:1,expected_export_epoch:state.project.export_epoch,expected_head:state.project.manifest_sha256});
  const call=action=>api.dispatch({...ctx(),...action});
  call({action:'bind',binding_id:binding.binding_id,jira_project:binding.jira_project,confirmed:true});
  return {api,call,ctx,root,state,history};
}
const payload=(manifest_sha256,extra={})=>({schema_version:1,...binding,sequence:1,previous_feedback_sha256:null,observed_at:'2026-11-28T12:00:00Z',revision:1,manifest_sha256,import_state:'committed',
  tasks:[{id:'B01',jira_key:'DEMO-7',state:'done',assignment_id:null,pr_number:null,head_sha:null,base_sha:null,candidate_sha:null,merge_sha:null,acceptance_event_id:null,
    criteria:[{id:'AC-B01-001',state:'verified',evidence_ref:'evidence/decision.json'}],reason:null}],
  requirements:[{id:'FR-001',state:'pending',criterion_ids:['AC-T01-001'],reason:null}],
  decisions:[{id:'B01',state:'resolved',evidence_ref:'evidence/decision.json',resolution:'JSON',reason:null}],measurements:[],findings:[],...extra});
function ingest(e,p){const bytes=Buffer.from(JSON.stringify(p));return e.call({action:'import',source_confirmed:true,bytes:bytes.toString('base64'),sha256:hash(bytes)});}
function proposal(e,result){const a=e.history[0];return feedbackView({projection:result.projection,manifest:JSON.parse(a.files['manifest.json']),requirements:JSON.parse(a.files['requirements.json']),manifestSha:a.manifest_sha256}).decisions[0].proposal;}
const confirmation={confirmed:true,actor:'owner-test',local_evidence_ref:'review/independent.json',jira_key:'DEMO-7',jira_confirmed:true};
const confirm=(e,p,c=confirmation)=>e.call({action:'confirm_decision',proposal:p,confirmation:c});
const exportBody=(e,r)=>({...e.ctx(),revision:r.requirements.revision,requirements:r.requirements,confirmed_ids:r.confirmed_ids,feedback_approval:r.approval_id});

test('T15 server-side owner, Jira observation, evidence and exact diff; frozen approval rejects missing, altered or superseded evidence',t=>{
  const e=setup(t),before=structuredClone(e.history),p=payload(e.state.project.manifest_sha256),result=ingest(e,p),diff=proposal(e,result);
  assert.equal(diff.after,'JSON');assert.equal(diff.before,null);
  for(const change of [{confirmed:false},{actor:'other'},{jira_confirmed:false},{jira_key:'OTHER-7'},{local_evidence_ref:'../secret'}])
    assert.throws(()=>confirm(e,diff,{...confirmation,...change}),{code:'APPROVAL_REQUIRED'});
  assert.throws(()=>confirm(e,diff,{...confirmation,jira_key:'DEMO-8'}),{code:'EVIDENCE_MISMATCH'});
  assert.throws(()=>confirm(e,{...diff,after:'other'}),{code:'APPROVAL_STALE'});
  const approved=confirm(e,diff),d=approved.requirements.decisions[0];
  assert.equal(approved.requirements.revision,2);assert.equal(d.state,'resolved');assert.equal(d.confirmed_by,'owner-test');
  assert.deepEqual(approved.confirmed_ids,['B01','T01']);assert.deepEqual(structuredClone(e.history),before);
  const proof=JSON.parse(readFileSync(join(e.root,d.evidence_ref),'utf8'));
  assert.equal(proof.confirmation.jira_key,'DEMO-7');assert.equal(proof.confirmation.local_evidence_ref,'review/independent.json');
  assert.equal(proof.proposal.receipt_sha256,result.projection.current.sha256);
  assert.deepEqual(e.call({action:'backup'}).backup.reviews,[],'uncommitted approvals must not travel');
  const body=exportBody(e,approved),{feedback_approval,...missing}=body;
  assert.throws(()=>e.api.withExportApproval(missing,()=>assert.fail('unauthorized export')),{code:'APPROVAL_REQUIRED'});
  assert.throws(()=>e.api.withExportApproval({...body,confirmed_ids:['B01']},()=>assert.fail()),{code:'APPROVAL_STALE'});
  const changed=structuredClone(body);changed.requirements.decisions[0].resolution='different';
  assert.throws(()=>e.api.withExportApproval(changed,()=>assert.fail()),{code:'APPROVAL_STALE'});
  assert.equal(e.api.withExportApproval(body,()=>{assert.throws(()=>e.call({action:'status'}),{code:'HISTORY_CONFLICT'});return 'preview';}),'preview');
  const next=payload(p.manifest_sha256,{sequence:2,previous_feedback_sha256:result.projection.current.sha256,observed_at:'2026-11-28T12:01:00Z',findings:[{code:'SOURCE_UNAVAILABLE',ref:'B01',state:'open'}]});
  ingest(e,next);
  assert.throws(()=>e.api.withExportApproval(body,()=>assert.fail('stale export')),{code:'APPROVAL_STALE'});
});

test('T15 committed decision audit backup and restore; historical receipt cannot approve another revision',t=>{
  const e=setup(t),result=ingest(e,payload(e.state.project.manifest_sha256)),approved=confirm(e,proposal(e,result));
  const body=exportBody(e,approved);
  e.api.withExportApproval(body,()=>{
    e.history.push(entry(approved.requirements,{tasks:[{id:'T01',blockedBy:[]}]},e.history[0].manifest_sha256));
    e.state.project.manifest_sha256=e.history.at(-1).manifest_sha256;e.state.project.export_epoch++;
  });
  const stale=e.call({action:'status'}).projection;assert.equal(stale.freshness,'stale');assert.equal(stale.current,null);
  const backup=e.call({action:'backup'}).backup;assert.equal(backup.reviews.length,1);
  const other=setup(t,{history:structuredClone(e.history),project_id:'P2'});
  assert.throws(()=>other.call({action:'restore',source_confirmed:true,backup:{...backup,reviews:[]}}),{code:'SOURCE_UNAVAILABLE'});
  const broken=structuredClone(backup);broken.reviews[0].proof.confirmation.actor='other';
  assert.throws(()=>other.call({action:'restore',source_confirmed:true,backup:broken}),{code:'INVALID_HASH'});
  assert.equal(other.call({action:'restore',source_confirmed:true,backup}).status,'restored');
  assert.deepEqual(other.call({action:'backup'}).backup,backup);
  assert.throws(()=>other.api.withExportApproval({...body,...other.ctx(),revision:3},()=>assert.fail()),{code:'APPROVAL_REQUIRED'});
  const unchanged={...other.ctx(),revision:3,requirements:{...approved.requirements,revision:3}};
  assert.equal(other.api.withExportApproval(unchanged,()=>true),true);
  assert.throws(()=>confirm(other,proposal(e,result)),{code:'APPROVAL_STALE'});
});

test('T15 unconfigured owner cannot authorize a proposal; imported result remains read-only',t=>{
  const e=setup(t,{owner:null}),r=ingest(e,payload(e.state.project.manifest_sha256));
  assert.equal(r.owner,null);assert.throws(()=>confirm(e,proposal(e,r)),{code:'CONTEXT_UNAVAILABLE'});
  assert.equal(JSON.parse(e.history[0].files['requirements.json']).decisions[0].state,'open');
});
