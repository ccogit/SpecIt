import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectStore } from '../aira-project-store.mjs';
import { createProjectApi, projectError } from '../aira-project-api.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(JSON.stringify(value)+'\n');
const binding={plan_id:'P1',repo:'example/project'}, source={...binding,spec:'Synthetic SPEC',plan:{tasks:[{id:'T01'}]}};
function filesFor(input) {
  const files={'SPEC.md':Buffer.from(input.spec),'requirements.json':bytes({schema_version:2,plan_id:input.plan_id,revision:input.revision}),'draft/EPICS.md':Buffer.from('Synthetic draft')};
  files['manifest.json']=bytes({schema_version:2,mode:'aira',plan_id:input.plan_id,repo:input.repo,revision:input.revision,
    plan:input.plan??source.plan,previous_manifest_sha256:input.previous_manifest_sha256,spec_sha256:hash(files['SPEC.md']),requirements_sha256:hash(files['requirements.json']),artifacts:[],draft_files:[{path:'draft/EPICS.md',sha256:hash(files['draft/EPICS.md'])}]});
  return files;
}
const fail=code=>{throw Object.assign(Error(code),{code})};
const makeRecord=(files,mapping)=>({manifest_sha256:hash(files['manifest.json']),manifest_bytes:files['manifest.json'].toString(),requirements_bytes:files['requirements.json'].toString(),mapping});
const validateRecord=()=>true; // storage/HTTP contract only; full-server fixture test uses real verifier
function setup(t) {
  const root=mkdtempSync(join(tmpdir(),'specit-s2-http-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  let run={active:false,items:[]}, starts=0, release;
  const open=async()=>{
    const api=createProjectApi({store:createProjectStore(root,{validatePackage:()=>true}),runStatus:()=>run,normalizePlan:x=>x,
      buildFiles:filesFor,preview:input=>({manifest:JSON.parse(filesFor(input)['manifest.json']),manifest_sha256:hash(filesFor(input)['manifest.json'])}),
      exportFiles:input=>{if(!input.approved||!input.changes_approved)fail('APPROVAL_REQUIRED');const files=filesFor(input);if(input.expected_manifest_sha256!==hash(files['manifest.json']))fail('APPROVAL_STALE');return files},
      zipFiles:files=>files['manifest.json'],makeRecord,validateRecord});
    const server=http.createServer(async(req,res)=>{
      try {
        if(req.headers.host!==server.address().address+':'+server.address().port||req.headers.origin!==base||req.headers['content-type']!=='application/json') {res.writeHead(403).end();return}
        let raw='';for await(const chunk of req)raw+=chunk;
        const body=JSON.parse(raw);
        const value=req.url==='/api/run'?await api.startRun(body,async()=>{starts++;if(body.hold)await new Promise(resolve=>{release=resolve});return {ok:true}}):api.dispatch(req.url,body);
        res.writeHead(200,{'content-type':Buffer.isBuffer(value)?'application/zip':'application/json'}).end(Buffer.isBuffer(value)?value:JSON.stringify(value));
      }catch(e){const {status,data}=projectError(e);res.writeHead(status,{'content-type':'application/json'}).end(JSON.stringify(data))}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
    const post=(path,body,origin=base)=>fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
    const close=()=>new Promise(resolve=>server.close(resolve));t.after(close);
    return {post,close};
  };
  return {open,root,setRun:value=>{run=value},starts:()=>starts,release:()=>release?.()};
}
const data=async(res,status=200)=>{assert.equal(res.status,status,await res.clone().text());return res.json()};
const select=(post,mode,expected_selection,extra={})=>post('/api/aira/project',{action:'activate',mode,expected_selection,confirmed:true,...extra});
const ctx=({project,selection})=>({project_id:project.project_id,selection,...project.binding,expected_head:project.manifest_sha256,expected_generation:project.generation,expected_export_epoch:project.export_epoch});
const input=(context,spec='Synthetic SPEC')=>({...context,schema_version:2,revision:context.expected_head?2:1,spec});
async function exported(post,payload){const p=await data(await post('/api/aira/preview',payload));const res=await post('/api/aira/export',{...payload,approved:true,changes_approved:true,expected_manifest_sha256:p.manifest_sha256,preview_id:p.preview_id});assert.equal(res.status,200,await res.clone().text());return p;}

test('T15 local HTTP: persistent active mode, trusted predecessor, restart, restore and conflicts',async t=>{
  const env=setup(t);let {post,close}=await env.open();
  assert.equal((await post('/api/run',{...source})).status,200);assert.equal(env.starts(),1);
  const active=await data(await select(post,'aira',0,{binding,source})), c=ctx(active);
  assert.equal((await post('/api/run',{})).status,403);
  assert.equal((await post('/api/run',{mode:'standalone',project_id:'other',repo:'example/other',spec:'x'})).status,403);
  const p1=await exported(post,input(c));
  assert.equal((await post('/api/aira/preview',input(c))).status,409);
  let h=await data(await post('/api/aira/history',c));assert.equal(h.history.length,1);assert.equal(h.export_status,'archived');assert.equal(h.last_known_receipt,null);
  const c2=ctx(h);assert.equal(c2.expected_head,p1.manifest_sha256);
  await exported(post,input(c2,'changed'));
  const backup=await data(await post('/api/aira/history',{...c,action:'backup'}));assert.equal(backup.history.length,2);
  await close();({post,close}=await env.open());
  const restored=await data(await post('/api/aira/project',{action:'status'}));assert.equal(restored.project.revision,2);assert.equal(restored.project.mode,'aira');
  assert.equal((await post('/api/run',{})).status,403);
  const request={...ctx(restored),packages:backup.packages,records:backup.records};
  assert.equal((await post('/api/aira/v2/restore',{...request,packages:request.packages.slice(0,1),records:request.records.slice(0,1)})).status,409);
  assert.equal((await post('/api/aira/v2/restore',{...request,packages:[{...request.packages[0],'../x':'eA=='},request.packages[1]]})).status,400);
  h=await data(await post('/api/aira/v2/restore',request));assert.equal(h.history.length,2);
  const standalone=await data(await select(post,'standalone',restored.selection,{source:{spec:'separate'}}));
  assert.equal(standalone.project.mode,'standalone');
  assert.equal((await post('/api/run',{...source})).status,403);
  assert.equal((await post('/api/run',{repo:'https://github.com/example/project.git',spec:'other',plan:{tasks:[{id:'T02'}]}})).status,403);
  await data(await post('/api/run',{repo:'example/other',spec:'separate',plan:{tasks:[{id:'T02'}]}}));
  assert.equal(env.starts(),2);
});

test('T15 local HTTP: explicit selection, unknown/running state, stale CAS and Origin protection',async t=>{
  const env=setup(t),{post}=await env.open();
  assert.equal((await post('/api/aira/project',{action:'activate',mode:'aira',expected_selection:0,binding,source})).status,400);
  assert.equal((await post('/api/aira/project',{action:'status'},'https://foreign.example')).status,403);
  env.setRun({active:false,items:[{state:'unknown'}]});assert.equal((await select(post,'aira',0,{binding,source})).status,409);
  env.setRun({active:true,items:[]});assert.equal((await select(post,'aira',0,{binding,source})).status,409);
  env.setRun({active:false,items:[]});
  const running=post('/api/run',{hold:true});while(!env.starts())await new Promise(r=>setTimeout(r,1));
  assert.equal((await select(post,'aira',0,{binding,source})).status,409);env.release();assert.equal((await running).status,200);
  const p=await data(await select(post,'aira',0,{binding,source}));
  assert.equal((await select(post,'standalone',0,{source:{spec:'other'}})).status,409);
  assert.equal((await select(post,'aira',p.selection,{binding:{...binding,repo:'example/foreign'},source})).status,403);
  assert.equal((await select(post,'standalone',p.selection,{source})).status,403);
});

test('T15 a restarted process cannot declare an interrupted local run idle',async t=>{
  const env=setup(t);const store=createProjectStore(env.root);
  store.reserveRun({},'previous-process');
  const {post}=await env.open();
  const status=await data(await post('/api/aira/project',{action:'status'}));
  assert.equal(status.run_observation,'unknown');assert.equal(Object.hasOwn(status,'local_run'),false);
  assert.equal((await select(post,'aira',0,{binding,source})).status,409);
  assert.equal((await post('/api/run',{})).status,409);assert.equal(env.starts(),0);
});

test('T04 frozen preview: approval, exact inputs, invalidation, competing export and replay',async t=>{
  const env=setup(t),{post}=await env.open();
  const c=ctx(await data(await select(post,'aira',0,{binding,source}))), payload={...input(c),mapping:{T01:'T01'},confirmed_points:{T01:3}};
  const prepare=async()=>data(await post('/api/aira/preview',payload));
  const approve=(p,extra={})=>post('/api/aira/export',{...payload,approved:true,changes_approved:true,expected_manifest_sha256:p.manifest_sha256,preview_id:p.preview_id,...extra});
  const first=await prepare();
  assert.equal((await approve(first,{approved:false})).status,400);
  assert.equal((await approve(first,{confirmed_points:{T01:5}})).status,409);
  assert.equal((await approve(first,{mapping:{}})).status,409);
  assert.equal((await post('/api/aira/preview/invalidate',{...c,preview_id:first.preview_id})).status,200);
  assert.equal((await approve(first)).status,409);
  const a=await prepare(),b=await prepare();
  assert.equal((await approve(a)).status,409);
  const outcomes=await Promise.all([approve(b),approve(b)]);
  assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,409]);
  const h=await data(await post('/api/aira/history',c));
  assert.equal(h.history.length,1);assert.equal(h.project.export_epoch,1);
  assert.equal(h.last_known_receipt,null);assert.equal(env.starts(),0);
});
