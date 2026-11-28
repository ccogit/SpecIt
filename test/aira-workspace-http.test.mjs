import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createWorkspaceHttp} from '../aira-workspace-http.mjs';
import {zip} from '../zip.mjs';
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const digest=b=>createHash('sha256').update(b).digest('hex');
const zipFiles=files=>zip(Object.keys(files).sort().map(name=>({name,data:files[name],mtime:new Date(1980,0,1)})));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/aira-v2/linear.json',import.meta.url)));
async function setup(t){
  const root=mkdtempSync(join(tmpdir(),'specit-workspace-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const files=Object.fromEntries(Object.entries(fixture.expected_files).map(([k,v])=>[k,Buffer.from(v)]));
  for(const [k,v] of Object.entries(files))assert.equal(digest(v),fixture.expected_sha256[k]);
  const manifest=JSON.parse(files['manifest.json']),manifest_sha256=digest(files['manifest.json']);
  const config={adapter_version:1,binding_id:uid(1),capability:'a'.repeat(64),draft_id:'draft1',expires_at:1000,instance_id:uid(2),jira_project:'SYN',mode:'integrated',plan_id:manifest.plan_id,project_id:'project1',repo:manifest.repo,site:'synthetic',workspace_id:uid(3)};
  const configFile=join(root,'scope.json'),stageDir=join(root,'stage');
  const write=()=>writeFileSync(configFile,JSON.stringify(config));write();
  const project={mode:'aira',binding:{repo:manifest.repo,plan_id:manifest.plan_id},generation:1,revision:1,manifest_sha256};
  const store={get:()=>project,history:()=>[{files,manifest_sha256}]};
  let handler;const server=createServer((q,s)=>handler(q,s));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const host='127.0.0.1:'+server.address().port,base='http://'+host;
  handler=createWorkspaceHttp({store,configFile,stageDir,zipFiles,host,now:()=>100});
  let n=10;
  const send=(op,fields={},headers={},raw)=>fetch(base+'/api/workspace/specit/v1/'+op,{method:'POST',headers:{authorization:'Bearer '+config.capability,'content-type':'application/json',...headers},body:raw??JSON.stringify({schema_version:1,request_id:uid(n++),...fields})});
  const scope={workspace_id:config.workspace_id,binding_id:config.binding_id,draft_id:config.draft_id};
  const prepare={workspace_id:scope.workspace_id,draft_id:scope.draft_id,revision:1,manifest_sha256};
  return {base,send,scope,prepare,config,write,stageDir,files,project};
}
const result=async(r,code=200)=>{assert.equal(r.status,code);return r.json();};
test('T18/T20 actual loopback HTTP: explicit scoped handshake and fixture ZIP identical to file path',async t=>{
  const s=await setup(t);
  const staticPage=await fetch(s.base+'/workspace/specit/plan');assert.equal(staticPage.status,200);assert.match(await staticPage.text(),/href="\.\/assets\/view\.css"/);
  assert.equal((await fetch(s.base+'/workspace/specit/assets/view.css')).status,200);
  assert.equal((await fetch(s.base+'/api/run')).status,400);
  assert.equal((await result(await s.send('capabilities'))).data.instance_id,s.config.instance_id);
  assert.deepEqual((await result(await s.send('open_context',s.scope))).data,{...s.scope,status:'ready'});
  const reply=await result(await s.send('prepare_package',s.prepare));
  const record=JSON.parse(readFileSync(join(s.stageDir,reply.data.staging_id+'.json')));
  assert.equal(record.manifest_sha256,s.prepare.manifest_sha256);
  assert.deepEqual(Buffer.from(record.package_b64,'base64'),zipFiles(s.files));
  assert.equal(record.package_sha256,digest(zipFiles(s.files)));
  assert.equal(record.context.binding_id,s.scope.binding_id);
  assert.equal(Object.hasOwn(record,'capability'),false);
});
test('T21 private HTTP rejects browser origin, bad capability, versions, replay, target, revoked scope and runner',async t=>{
  const s=await setup(t);
  for(const [op,fields,headers,code] of [
    ['capabilities',{}, {origin:s.base},403],['capabilities',{}, {authorization:'Bearer '+'b'.repeat(64)},403],
    ['capabilities',{schema_version:2},{},409],['prepare_package',s.prepare,{},409],
    ['capabilities?x=1',{}, {},400],['import_apply',{}, {},400]])await result(await s.send(op,fields,headers),code);
  const request_id=uid(99);
  await result(await s.send('capabilities',{request_id}));await result(await s.send('capabilities',{request_id}),409);
  await result(await s.send('open_context',{...s.scope,binding_id:uid(42)}),403);
  await result(await s.send('open_context',s.scope));
  await result(await s.send('prepare_package',{...s.prepare,draft_id:'other'}),403);
  await result(await s.send('prepare_package',s.prepare,{},'{"schema_version":1,"schema_version":1}'),400);
  s.config.workspace_id=uid(55);s.write();
  await result(await s.send('prepare_package',s.prepare),409);
  await result(await s.send('capabilities'));
  await result(await s.send('open_context',s.scope),403);
  s.project.binding.repo='example/other';await result(await s.send('capabilities'),403);
  assert.throws(()=>readdirSync(s.stageDir),{code:'ENOENT'});
});
