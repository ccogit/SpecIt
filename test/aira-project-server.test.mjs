import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';
import {inflateRawSync} from 'node:zlib';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/aira-v2/'+name+'.json',import.meta.url)));
function input(name){
  const {expected_files:f}=fixture(name), m=JSON.parse(f['manifest.json']), requirements=JSON.parse(f['requirements.json']);
  return {schema_version:2,plan_id:m.plan_id,repo:m.repo,revision:m.revision,plan:m.plan,target_minutes:m.target_minutes,
    spec:f['SPEC.md'],requirements,confirmed_ids:[...m.plan.tasks,...requirements.requirements,...requirements.criteria,...requirements.tests,...requirements.decisions].map(x=>x.id),
    confirmed_points:Object.fromEntries([...Object.entries(m.tasks),...m.blockers.map(b=>[b.id,b])].map(([id,b])=>[id,b.points])),mapping:{}};
}
function unzip(buf){
  const out={};let i=0;
  while(buf.readUInt32LE(i)===0x04034b50){
    const method=buf.readUInt16LE(i+8),size=buf.readUInt32LE(i+18),len=buf.readUInt16LE(i+26),extra=buf.readUInt16LE(i+28);
    const name=buf.subarray(i+30,i+30+len).toString(),start=i+30+len+extra,b=buf.subarray(start,start+size);
    out[name]=(method===8?inflateRawSync(b):b).toString();i=start+size;
  }
  return out;
}
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function withServer(archive,run){
  const port=await freePort(),base='http://127.0.0.1:'+port;
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
    await run(post);
  }finally{cp.kill('SIGTERM');await Promise.race([exited,pause(2000)]);}
}
const result=async(res,status=200)=>{assert.equal(res.status,status,await res.clone().text());return res.json()};
const context=({project,selection})=>({project_id:project.project_id,selection,...project.binding,expected_generation:project.generation,expected_head:project.manifest_sha256,expected_export_epoch:project.export_epoch});
const select=(post,mode,expected_selection,extra={})=>post('/api/aira/project',{action:'activate',mode,expected_selection,confirmed:true,...extra});
async function exportRevision(post,c,name){
  const payload={...input(name),...c};
  const preview=await result(await post('/api/aira/preview',payload));
  const res=await post('/api/aira/export',{...payload,approved:true,changes_approved:true,expected_manifest_sha256:preview.manifest_sha256,preview_id:preview.preview_id});
  assert.equal(res.status,200,await res.clone().text());
  assert.deepEqual(unzip(Buffer.from(await res.arrayBuffer())),fixture(name).expected_files);
  return preview;
}

test('T15 production server HTTP: bound run denied, exact V2 archive, restart and full-chain restore', {timeout:30000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'specit-s2-server-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const archive=join(dir,'archive'),other=join(dir,'other');mkdirSync(other);
  const first=input('linear'),binding={plan_id:first.plan_id,repo:first.repo},source={...binding,plan:first.plan,spec:first.spec};
  let backup;
  await withServer(archive,async post=>{
    // Claude is intentionally disabled, so a separate standalone request reaches the existing 503 gate, not an agent.
    assert.equal((await post('/api/run',{action:'start'})).status,503);
    assert.equal((await post('/api/aira/project',{action:'status'},'https://foreign.example')).status,403);
    const active=await result(await select(post,'aira',0,{binding,source})),c=context(active);
    assert.equal((await result(await post('/api/run',{action:'start',mode:'standalone',repo:'example/other'}),403)).code,'POLICY_DENIED');
    const p=await exportRevision(post,c,'linear');
    assert.equal((await post('/api/aira/preview',{...first,...c})).status,409);
    const h=await result(await post('/api/aira/history',c));assert.equal(h.project.manifest_sha256,p.manifest_sha256);
    await exportRevision(post,context(h),'revised');
    backup=await result(await post('/api/aira/history',{...c,action:'backup'}));assert.equal(backup.history.length,2);
    assert.equal((await post('/api/run/download',{dir:archive})).status,403);
  });
  await withServer(archive,async post=>{
    const active=await result(await post('/api/aira/project',{action:'status'})),c=context(active);
    assert.equal(active.project.mode,'aira');assert.equal(active.project.revision,2);
    assert.equal((await post('/api/run',{action:'start'})).status,403);
    const h=await result(await post('/api/aira/history',{...c,action:'backup'}));assert.deepEqual(h.packages,backup.packages);
    assert.equal((await post('/api/aira/v2/restore',{...c,packages:backup.packages.slice(1),records:backup.records.slice(1)})).status,409);
    const separate=await result(await select(post,'standalone',active.selection,{source:{spec:'Other project'}}));assert.equal(separate.project.mode,'standalone');
    assert.equal((await post('/api/run',{action:'start',...source})).status,403);
    assert.equal((await post('/api/run',{action:'start',repo:'example/other',spec:'Other project'})).status,503);
  });
  await withServer(join(dir,'restored'),async post=>{
    const active=await result(await select(post,'aira',0,{binding,source})),c=context(active);
    const restored=await result(await post('/api/aira/v2/restore',{...c,packages:backup.packages,records:backup.records}));
    assert.equal(restored.project.revision,2);assert.equal(restored.project.manifest_sha256,backup.project.manifest_sha256);
    const copy=await result(await post('/api/aira/history',{...context(restored),action:'backup'}));assert.deepEqual(copy.packages,backup.packages);
  });
});

test('T04 real server freezes confirmed V2 bytes and refuses stale approval', {timeout:15000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'specit-s2-preview-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  await withServer(dir,async post=>{
    const first=input('linear'),binding={plan_id:first.plan_id,repo:first.repo};
    const active=await result(await select(post,'aira',0,{binding,source:{...binding,plan:first.plan,spec:first.spec}})),c=context(active),payload={...first,...c};
    const preview=await result(await post('/api/aira/preview',payload));
    const approved={...payload,approved:true,changes_approved:true,preview_id:preview.preview_id,expected_manifest_sha256:preview.manifest_sha256};
    assert.equal((await post('/api/aira/export',{...approved,approved:false})).status,400);
    assert.equal((await post('/api/aira/export',{...approved,spec:approved.spec+' Änderung'})).status,409);
    const next=await result(await post('/api/aira/preview',payload));
    assert.equal((await post('/api/aira/export',approved)).status,409);
    const res=await post('/api/aira/export',{...approved,preview_id:next.preview_id});
    assert.equal(res.status,200,await res.clone().text());
    assert.deepEqual(unzip(Buffer.from(await res.arrayBuffer())),fixture('linear').expected_files);
    assert.equal((await post('/api/aira/export',{...approved,preview_id:next.preview_id})).status,409);
    const h=await result(await post('/api/aira/history',c));
    assert.equal(h.export_status,'archived');assert.equal(h.last_known_receipt,null);assert.equal(h.history.length,1);
    assert.equal((await post('/api/run',{action:'start'})).status,403);
  });
});
