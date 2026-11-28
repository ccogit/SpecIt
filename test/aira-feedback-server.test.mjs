import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectRequirementsPlan} from '../planner.mjs';
import {feedbackView} from '../public/aira-feedback-model.mjs';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/aira-v2/'+name+'.json',import.meta.url)));
const events=fixture('feedback').events;
const {binding_id,jira_project,repo,plan_id}=JSON.parse(events[0].text);
const binding={repo,plan_id};
const input=name=>{
  const f=fixture(name).expected_files,m=JSON.parse(f['manifest.json']),requirements=JSON.parse(f['requirements.json']);
  return {schema_version:2,plan_id:m.plan_id,repo:m.repo,revision:m.revision,plan:m.plan,target_minutes:m.target_minutes,spec:f['SPEC.md'],requirements,
    confirmed_ids:[...m.plan.tasks,...requirements.requirements,...requirements.criteria,...requirements.tests,...requirements.decisions].map(x=>x.id),
    confirmed_points:Object.fromEntries([...Object.entries(m.tasks),...m.blockers.map(b=>[b.id,b])].map(([id,b])=>[id,b.points])),mapping:{}};
};
async function withServer(archive,run){
  const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
  const base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),SPECIT_AIRA_STORE_DIR:archive,SPECIT_KEEP_RUNNING:'1',SPECIT_NO_CLAUDE_CODE:'1',SPECIT_NO_CODEX:'1',SPECIT_NO_GITHUB:'1',SPECIT_AIRA_FEEDBACK_OWNER:'owner-test',ANTHROPIC_API_KEY:''};
  const cp=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let stderr='';cp.stdout.resume();cp.stderr.on('data',x=>{stderr+=x.toString().slice(0,2000)});
  const exited=new Promise(resolve=>cp.once('exit',resolve));
  try{
    let ready=false;for(let i=0;i<60;i++){
      if(cp.exitCode!==null)throw Error('SpecIt server exited: '+stderr);
      try{if((await fetch(base+'/api/status',{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{}
      await pause(100);
    }
    assert.ok(ready,'SpecIt server failed to start: '+stderr);
    const post=(path,body,origin=base)=>fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
    await run(post,path=>fetch(base+path));
  }finally{cp.kill('SIGTERM');await Promise.race([exited,pause(2000)]);}
}
const data=async(res,status=200)=>{assert.equal(res.status,status,await res.clone().text());return res.json()};
const ctx=({project,selection})=>({project_id:project.project_id,selection,...project.binding,expected_generation:project.generation,expected_head:project.manifest_sha256,expected_export_epoch:project.export_epoch});
const send=(post,c,action)=>post('/api/aira/feedback',{...c,...action});
const receipt=e=>({action:'import',source_confirmed:true,bytes:Buffer.from(e.text).toString('base64'),sha256:e.sha256});
async function exportRevision(post,c,name){
  const payload={...input(name),...c},p=await data(await post('/api/aira/preview',payload));
  const response=await post('/api/aira/export',{...payload,approved:true,changes_approved:true,preview_id:p.preview_id,expected_manifest_sha256:p.manifest_sha256});
  assert.equal(response.status,200,await response.clone().text());
  assert.equal(p.manifest_sha256,fixture(name).expected_sha256['manifest.json']);
  return data(await post('/api/aira/history',c));
}
test('T14 production HTTP: archived bytes, replay, isolation, restart and restore', {timeout:40000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'specit-s3-http-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const archive=join(dir,'archive'),target=join(dir,'restored');let backup,packages;
  const activate=async post=>data(await post('/api/aira/project',{action:'activate',mode:'aira',binding,confirmed:true,expected_selection:0,source:{plan:input('linear').plan,spec:input('linear').spec}}));
  await withServer(archive,async(post,get)=>{
    const before=await data(await get('/api/run'));
    let h=await activate(post);h=await exportRevision(post,ctx(h),'linear');h=await exportRevision(post,ctx(h),'revised');
    const c=ctx(h);
    packages=await data(await post('/api/aira/history',{...c,action:'backup'}));
    assert.equal((await data(await send(post,c,{action:'status'}))).projection.freshness,'unknown');
    assert.equal((await send(post,c,receipt(events[0]))).status,409);
    assert.equal((await post('/api/aira/feedback',{...c,action:'status'},'https://foreign.example')).status,403);
    await data(await send(post,c,{action:'bind',binding_id,jira_project,confirmed:true}));
    assert.equal((await data(await send(post,c,receipt(events[0])))).status,'accepted');
    assert.equal((await data(await send(post,c,receipt(events[1])))).status,'accepted');
    const changed={...JSON.parse(events[1].text),observed_at:'2026-11-28T12:16:00Z'};
    assert.equal((await send(post,c,{action:'import',source_confirmed:true,bytes:Buffer.from(JSON.stringify(changed)).toString('base64')})).status,409);
    const p=await data(await send(post,c,receipt(events[0])));
    assert.equal(p.status,'no_op');assert.equal(p.projection.current.feedback.sequence,2);assert.equal(p.projection.history[0].historical,true);
    const after=await data(await post('/api/aira/history',{...c,action:'backup'}));
    assert.deepEqual(after.packages,packages.packages);assert.deepEqual(after.records,packages.records);assert.deepEqual(after.project,packages.project);
    const run=await data(await get('/api/run'));assert.deepEqual(run.calib,before.calib);assert.deepEqual(run.items,before.items);assert.equal(run.active,before.active);
    assert.equal((await post('/api/run',{action:'start'})).status,403);
    backup=(await data(await send(post,c,{action:'backup'}))).backup;
  });
  await withServer(archive,async post=>{
    const c=ctx(await data(await post('/api/aira/project',{action:'status'})));
    assert.equal((await data(await send(post,c,receipt(events[1])))).status,'no_op');
    assert.equal((await data(await send(post,c,{action:'status'}))).projection.freshness,'current');
  });
  await withServer(target,async post=>{
    const a=await activate(post);
    const restored=await data(await post('/api/aira/v2/restore',{...ctx(a),packages:packages.packages,records:packages.records})),c=ctx(restored);
    await data(await send(post,c,{action:'bind',binding_id,jira_project,confirmed:true}));
    assert.equal((await data(await send(post,c,{action:'restore',source_confirmed:true,backup}))).status,'restored');
    assert.equal((await data(await send(post,c,{action:'status'}))).projection.current.feedback.sequence,2);
  });
});

test('T15 production HTTP: explicit owner diff produces new revision only after independent preview and export, with no automatic Jira or run mutation', {timeout:40000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'specit-s3-review-http-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const archive=join(dir,'archive'),target=join(dir,'restored'),first=input('blocked');
  const bound={plan_id:first.plan_id,repo:first.repo},binding_id='b3fa1ac7-738e-44bb-a7b3-03ea0e35b30a',jira_project='DEMO';
  const activate=async post=>data(await post('/api/aira/project',{action:'activate',mode:'aira',binding:bound,confirmed:true,expected_selection:0,source:{plan:first.plan,spec:first.spec}}));
  const hash=x=>createHash('sha256').update(x).digest('hex');
  let backup,packages;
  await withServer(archive,async(post,get)=>{
    const before=await data(await get('/api/run'));
    const h=await exportRevision(post,ctx(await activate(post)),'blocked'),c=ctx(h);
    const initial=await data(await post('/api/aira/history',{...c,action:'backup'}));
    const originalManifest=JSON.parse(h.record.manifest_bytes),originalRequirements=JSON.parse(h.record.requirements_bytes);
    await data(await send(post,c,{action:'bind',binding_id,jira_project,confirmed:true}));
    const f={schema_version:1,...bound,binding_id,jira_project,sequence:1,previous_feedback_sha256:null,observed_at:'2026-11-28T12:00:00Z',revision:1,manifest_sha256:h.project.manifest_sha256,import_state:'committed',
      tasks:[{id:'B01',jira_key:'DEMO-7',state:'done',assignment_id:null,pr_number:null,head_sha:null,base_sha:null,candidate_sha:null,merge_sha:null,acceptance_event_id:null,
        criteria:[{id:'AC-B01-001',state:'verified',evidence_ref:'evidence/decision.json'}],reason:null}],
      requirements:[],decisions:[{id:'B01',state:'resolved',evidence_ref:'evidence/decision.json',resolution:'JSON',reason:null}],measurements:[],findings:[]};
    const ingest=async value=>{const bytes=Buffer.from(JSON.stringify(value));return data(await send(post,c,{action:'import',source_confirmed:true,bytes:bytes.toString('base64'),sha256:hash(bytes)}));};
    const proposal=result=>feedbackView({projection:result.projection,manifest:originalManifest,requirements:originalRequirements,manifestSha:h.project.manifest_sha256}).decisions[0].proposal;
    const received=await ingest(f),diff=proposal(received);
    assert.equal(diff.after,'JSON');
    const confirmation={confirmed:true,actor:'owner-test',local_evidence_ref:'review/independent.json',jira_key:'DEMO-7',jira_confirmed:true};
    assert.equal((await send(post,c,{action:'confirm_decision',proposal:diff,confirmation:{...confirmation,confirmed:false}})).status,400);
    const confirm=async result=>data(await send(post,c,{action:'confirm_decision',proposal:proposal(result),confirmation}));
    const approved=await confirm(received);
    const still=await data(await post('/api/aira/history',{...c,action:'backup'}));assert.deepEqual(still.packages,initial.packages);assert.equal(still.project.revision,1);
    assert.equal(JSON.parse(still.record.requirements_bytes).decisions[0].state,'open');
    const payload=r=>({...first,...c,revision:2,requirements:r.requirements,plan:projectRequirementsPlan(first.plan,r.requirements),
      confirmed_points:{...first.confirmed_points},confirmed_ids:r.confirmed_ids,feedback_approval:r.approval_id});
    const draft=payload(approved),{feedback_approval,...missing}=draft;
    assert.equal((await post('/api/aira/preview',missing)).status,400);
    // Resolved B01 remains an active V2 work item; dropping its points is invalid.
    const withoutBlockerPoints={...draft,confirmed_points:Object.fromEntries(Object.entries(draft.confirmed_points).filter(([id])=>id!=='B01'))};
    assert.equal((await data(await post('/api/aira/preview',withoutBlockerPoints),400)).code,'INVALID_SCHEMA');
    const preview=await data(await post('/api/aira/preview',draft));
    assert.equal(preview.manifest.blockers.find(b=>b.id==='B01').points,first.confirmed_points.B01);
    assert.match(preview.drafts['draft/EPICS.md'],/T01[^\n]*B01/);
    const exportBody=(draft,p)=>({...draft,approved:true,changes_approved:true,preview_id:p.preview_id,expected_manifest_sha256:p.manifest_sha256});
    assert.equal((await post('/api/aira/export',{...exportBody(draft,preview),approved:false})).status,400);
    const next=await ingest({...f,sequence:2,previous_feedback_sha256:received.projection.current.sha256,observed_at:'2026-11-28T12:01:00Z',findings:[{code:'SOURCE_UNAVAILABLE',ref:'B01',state:'open'}]});
    assert.equal((await post('/api/aira/export',exportBody(draft,preview))).status,409);
    const revised=payload(await confirm(next)),newPreview=await data(await post('/api/aira/preview',revised));
    const exported=await post('/api/aira/export',exportBody(revised,newPreview));assert.equal(exported.status,200,await exported.clone().text());
    packages=await data(await post('/api/aira/history',{...c,action:'backup'}));assert.equal(packages.project.revision,2);
    assert.deepEqual(packages.packages[0],initial.packages[0]);assert.equal(packages.packages[1]['SPEC.md'],initial.packages[0]['SPEC.md']);
    const finalManifest=JSON.parse(packages.record.manifest_bytes),finalRequirements=JSON.parse(packages.record.requirements_bytes);
    assert.equal(finalRequirements.decisions[0].state,'resolved');assert.equal(finalRequirements.decisions[0].confirmed_by,'owner-test');
    assert.deepEqual(finalManifest.plan.tasks.find(t=>t.id==='T01').blockedBy,[]);
    for(const id of Object.keys(originalManifest.tasks))assert.equal(finalManifest.tasks[id].points,originalManifest.tasks[id].points);
    assert.deepEqual(finalManifest.blockers,originalManifest.blockers,'resolved decision retains its mapped B work item and confirmed points');
    assert.equal((await data(await send(post,ctx(packages),{action:'status'}))).projection.freshness,'stale');
    backup=(await data(await send(post,ctx(packages),{action:'backup'}))).backup;assert.equal(backup.reviews.length,1);
    const after=await data(await get('/api/run'));assert.deepEqual(after.calib,before.calib);assert.deepEqual(after.items,before.items);assert.equal(after.active,before.active);
    assert.equal((await post('/api/run',{action:'start'})).status,403);
    const ui=await get('/aira-feedback-ui.mjs');assert.equal(ui.status,200);assert.match(await ui.text(),/mountFeedbackPanel/);
    assert.equal((await get('/aira-feedback-model.mjs')).status,200);
  });
  await withServer(target,async post=>{
    const a=await activate(post),restored=await data(await post('/api/aira/v2/restore',{...ctx(a),packages:packages.packages,records:packages.records})),c=ctx(restored);
    await data(await send(post,c,{action:'bind',binding_id,jira_project,confirmed:true}));
    assert.equal((await data(await send(post,c,{action:'restore',source_confirmed:true,backup}))).status,'restored');
    assert.deepEqual((await data(await send(post,c,{action:'backup'}))).backup,backup);
  });
});
