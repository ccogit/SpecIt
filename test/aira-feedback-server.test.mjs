import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
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
  return {schema_version:2,plan_id,repo,revision:m.revision,plan:m.plan,target_minutes:m.target_minutes,spec:f['SPEC.md'],requirements,
    confirmed_ids:[...m.plan.tasks,...requirements.requirements,...requirements.criteria,...requirements.tests,...requirements.decisions].map(x=>x.id),
    confirmed_points:Object.fromEntries([...Object.entries(m.tasks),...m.blockers.map(b=>[b.id,b])].map(([id,b])=>[id,b.points])),mapping:{}};
};
async function withServer(archive,run){
  const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
  const base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),SPECIT_AIRA_STORE_DIR:archive,SPECIT_KEEP_RUNNING:'1',SPECIT_NO_CLAUDE_CODE:'1',SPECIT_NO_CODEX:'1',SPECIT_NO_GITHUB:'1',ANTHROPIC_API_KEY:''};
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
