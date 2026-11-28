import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {originBackupPayload} from '../origin-backup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/aira-v2/linear.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function withServer(archive,extra,run){
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),SPECIT_AIRA_STORE_DIR:archive,SPECIT_ORIGIN_ARCHIVE_DIR:'',SPECIT_WORKSPACE_CONFIG:'',SPECIT_WORKSPACE_STAGE_DIR:'',
    SPECIT_KEEP_RUNNING:'1',SPECIT_NO_CLAUDE_CODE:'1',SPECIT_NO_CODEX:'1',SPECIT_NO_GITHUB:'1',ANTHROPIC_API_KEY:'',...extra};
  const cp=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let stderr='';cp.stdout.resume();cp.stderr.on('data',x=>{stderr+=x.toString().slice(0,2000)});
  const exited=new Promise(resolve=>cp.once('exit',resolve));
  try{
    let ready=false;for(let i=0;i<80;i++){
      if(cp.exitCode!==null)throw Error('SpecIt server exited: '+stderr);
      try{if((await fetch(base+(extra.SPECIT_WORKSPACE_CONFIG?'/workspace/specit/plan':'/api/status'),{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{}
      await pause(100);
    }
    assert.ok(ready,'SpecIt server failed to start: '+stderr);
    const post=(path,body,headers={origin:base})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
    await run({post,get:path=>fetch(base+path),base});
  }finally{cp.kill('SIGTERM');await Promise.race([exited,pause(2000)]);}
}
const result=async(res,status=200)=>{assert.equal(res.status,status,await res.clone().text());return res.json();};

test('T18/T19/T20/T21 production server: file ZIP equals private workspace stage; origin migration leaves project archive untouched', {timeout:45000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'specit-s5-server-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const archive=join(dir,'archive'),stageDir=join(dir,'stage'),configFile=join(dir,'scope.json');
  const f=fixture.expected_files,m=JSON.parse(f['manifest.json']),requirements=JSON.parse(f['requirements.json']);
  const binding={plan_id:m.plan_id,repo:m.repo},source={...binding,plan:m.plan,spec:f['SPEC.md']};
  let zip,project,manifest_sha256;
  await withServer(archive,{},async({post,get,base})=>{
    const active=await result(await post('/api/aira/project',{action:'activate',mode:'aira',expected_selection:0,confirmed:true,binding,source}));
    const payload={schema_version:2,...binding,revision:1,plan:m.plan,target_minutes:m.target_minutes,spec:f['SPEC.md'],requirements,mapping:{},
      confirmed_ids:[...m.plan.tasks,...requirements.requirements,...requirements.criteria,...requirements.tests,...requirements.decisions].map(x=>x.id),
      confirmed_points:Object.fromEntries(Object.entries(m.tasks).map(([id,v])=>[id,v.points])),
      project_id:active.project.project_id,selection:active.selection,expected_generation:active.project.generation,expected_head:active.project.manifest_sha256,expected_export_epoch:active.project.export_epoch};
    const preview=await result(await post('/api/aira/preview',payload));manifest_sha256=preview.manifest_sha256;
    assert.equal(manifest_sha256,fixture.expected_sha256['manifest.json']);
    const response=await post('/api/aira/export',{...payload,approved:true,changes_approved:true,expected_manifest_sha256:manifest_sha256,preview_id:preview.preview_id});
    assert.equal(response.status,200,await response.clone().text());zip=Buffer.from(await response.arrayBuffer());
    project=(await result(await post('/api/aira/project',{action:'status'}))).project;
    const index=readFileSync(join(archive,'projects.json'));
    assert.equal((await get('/origin-migration')).status,200);
    assert.equal((await get('/origin-migration-ui.mjs')).status,200);
    assert.equal((await get('/origin-backup.mjs')).status,200);
    const legacy={schema_version:1,source_origin:base,entries:[{key:'specit-v3',raw:JSON.stringify({idea:'synthetic',spec:f['SPEC.md'],plan_id:m.plan_id})}]};
    const backup={...legacy,sha256:hash(originBackupPayload(legacy))};
    assert.equal((await post('/api/origin-migration',{action:'list'},{origin:'http://foreign.invalid'})).status,403);
    const migration=await result(await post('/api/origin-migration',{action:'preview',operation:'import',backup}));
    await result(await post('/api/origin-migration',{action:'apply',operation:'import',backup,confirmed:true,resolution:'keep_separate',preview_sha256:migration.preview_sha256}));
    const rollback=await result(await post('/api/origin-migration',{action:'preview',operation:'rollback',backup_id:backup.sha256}));
    await result(await post('/api/origin-migration',{action:'apply',operation:'rollback',backup_id:backup.sha256,confirmed:true,resolution:'none',preview_sha256:rollback.preview_sha256}));
    assert.deepEqual((await result(await post('/api/origin-migration',{action:'read',backup_id:backup.sha256}))).backup,backup);
    assert.deepEqual(readFileSync(join(archive,'projects.json')),index);
  });
  const config={adapter_version:1,binding_id:uid(1),capability:'a'.repeat(64),draft_id:'draft1',expires_at:Date.now()+300000,
    instance_id:uid(2),jira_project:'SYN',mode:'integrated',plan_id:m.plan_id,project_id:project.project_id,repo:m.repo,site:'synthetic',workspace_id:uid(3)};
  writeFileSync(configFile,JSON.stringify(config),{mode:0o600});
  await withServer(archive,{SPECIT_WORKSPACE_CONFIG:configFile,SPECIT_WORKSPACE_STAGE_DIR:stageDir},async({post,get})=>{
    const headers={authorization:'Bearer '+config.capability},call=(op,n,fields={})=>post('/api/workspace/specit/v1/'+op,{schema_version:1,request_id:uid(n),...fields},headers);
    assert.equal((await get('/')).status,400);
    assert.equal((await post('/api/run',{action:'start'})).status,400);
    assert.equal((await result(await call('capabilities',10))).data.adapter_version,1);
    const scope={workspace_id:config.workspace_id,binding_id:config.binding_id,draft_id:config.draft_id};
    await result(await call('open_context',11,scope));
    const staged=(await result(await call('prepare_package',12,{workspace_id:scope.workspace_id,draft_id:scope.draft_id,revision:1,manifest_sha256}))).data;
    const record=JSON.parse(readFileSync(join(stageDir,staged.staging_id+'.json')));
    assert.deepEqual(Buffer.from(record.package_b64,'base64'),zip);
    assert.equal(record.package_sha256,hash(zip));
  });
});
