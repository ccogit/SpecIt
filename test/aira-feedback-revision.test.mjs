import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFeedbackApi} from '../aira-feedback-api.mjs';
import {feedbackView} from '../public/aira-feedback-model.mjs';
import {projectRequirementsPlan} from '../planner.mjs';
import {previewAiraV2,exportAiraV2,verifyAiraV2} from '../aira-v2-export.mjs';
import {sha256} from '../aira-export.mjs';

test('T15 resolved B-ID needs confirmed points in real V2 preview, export and restore',t=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/aira-v2/blocked.json',import.meta.url)));
  const files=Object.fromEntries(Object.entries(fixture.expected_files).map(([path,text])=>[path,Buffer.from(text)]));
  const manifest=JSON.parse(files['manifest.json']),requirements=JSON.parse(files['requirements.json']);
  const manifestSha=fixture.expected_sha256['manifest.json'];
  assert.equal(sha256(files['manifest.json']),manifestSha);
  assert.equal(verifyAiraV2(files),true);
  const {plan_id,repo}=manifest,binding={plan_id,repo};
  const binding_id='b3fa1ac7-738e-44bb-a7b3-03ea0e35b30a',jira_project='DEMO';
  const root=mkdtempSync(join(tmpdir(),'specit-s3-revision-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const history=[{manifest_sha256:manifestSha,files}];
  const project={project_id:'P1',mode:'aira',binding,generation:1,export_epoch:1,manifest_sha256:manifestSha};
  const store={active:()=>({project:structuredClone(project),selection:1}),history:()=>structuredClone(history)};
  const api=createFeedbackApi({store,root,owner:'owner-test',now:()=>Date.parse('2026-11-28T12:03:00Z')});
  const context=()=>({project_id:project.project_id,selection:1,...binding,expected_generation:project.generation,expected_export_epoch:project.export_epoch,expected_head:project.manifest_sha256});
  const call=action=>api.dispatch({...context(),...action});
  call({action:'bind',binding_id,jira_project,confirmed:true});
  const feedback={schema_version:1,...binding,binding_id,jira_project,sequence:1,previous_feedback_sha256:null,observed_at:'2026-11-28T12:00:00Z',revision:1,manifest_sha256:manifestSha,import_state:'committed',
    tasks:[{id:'B01',jira_key:'DEMO-7',state:'done',assignment_id:null,pr_number:null,head_sha:null,base_sha:null,candidate_sha:null,merge_sha:null,acceptance_event_id:null,
      criteria:[{id:'AC-B01-001',state:'verified',evidence_ref:'evidence/decision.json'}],reason:null}],requirements:[],
    decisions:[{id:'B01',state:'resolved',evidence_ref:'evidence/decision.json',resolution:'JSON',reason:null}],measurements:[],findings:[]};
  const bytes=Buffer.from(JSON.stringify(feedback)),receipt=call({action:'import',source_confirmed:true,bytes:bytes.toString('base64'),sha256:sha256(bytes)});
  const proposal=feedbackView({projection:receipt.projection,manifest,requirements,manifestSha}).decisions[0].proposal;
  const approved=call({action:'confirm_decision',proposal,confirmation:{confirmed:true,actor:'owner-test',local_evidence_ref:'review/independent.json',jira_key:'DEMO-7',jira_confirmed:true}});
  const points=Object.fromEntries([...Object.entries(manifest.tasks),...manifest.blockers.map(b=>[b.id,b])].map(([id,b])=>[id,b.points]));
  const draft={...context(),schema_version:2,revision:2,plan:projectRequirementsPlan(manifest.plan,approved.requirements),requirements:approved.requirements,spec:files['SPEC.md'],target_minutes:manifest.target_minutes,
    previous:{manifest_bytes:files['manifest.json'],requirements_bytes:files['requirements.json']},previous_manifest_sha256:manifestSha,
    confirmed_points:points,confirmed_ids:approved.confirmed_ids,feedback_approval:approved.approval_id};
  const {B01,...withoutB}=points;
  assert.throws(()=>api.withExportApproval({...draft,confirmed_points:withoutB},()=>previewAiraV2({...draft,confirmed_points:withoutB})),e=>e.code==='INVALID_SCHEMA'&&e.message.includes('confirmed story points'));
  const preview=api.withExportApproval(draft,()=>previewAiraV2(draft));
  assert.equal(preview.manifest.revision,2);
  assert.deepEqual(preview.manifest.blockers,manifest.blockers);
  assert.match(preview.drafts['draft/EPICS.md'],/T01[^\n]*B01/);
  assert.deepEqual(preview.manifest.plan.tasks.find(t=>t.id==='T01').blockedBy,[]);
  assert.equal(history.length,1);assert.equal(JSON.parse(history[0].files['requirements.json']).decisions[0].state,'open');
  const next=api.withExportApproval(draft,()=>exportAiraV2({...draft,approved:true,changes_approved:true,expected_manifest_sha256:preview.manifest_sha256}));
  assert.equal(verifyAiraV2(next,[files]),true);
  assert.ok(next['SPEC.md'].equals(files['SPEC.md']));
  assert.deepEqual(JSON.parse(next['manifest.json']).tasks,manifest.tasks);
  history.push({manifest_sha256:sha256(next['manifest.json']),files:next});project.manifest_sha256=history.at(-1).manifest_sha256;project.export_epoch++;
  assert.equal(call({action:'status'}).projection.freshness,'stale');
  const backup=call({action:'backup'}).backup;assert.equal(backup.reviews.length,1);
  assert.equal(call({action:'restore',source_confirmed:true,backup}).status,'no_op');
});
