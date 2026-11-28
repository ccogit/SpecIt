import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createOriginBackup,previewBrowserRestore,restoreBrowserBackup,verifyOriginBackup} from '../origin-backup.mjs';
import {createOriginArchive} from '../origin-archive.mjs';

class Storage {
  constructor(entries={}){this.data=new Map(Object.entries(entries));}
  get length(){return this.data.size;}
  key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){this.data.set(k,v);}
  removeItem(k){this.data.delete(k);}
}
const locks={request:async(_name,fn)=>fn()};
const origin='http://127.0.0.1:3000',other='http://localhost:3000';
const draft=idea=>JSON.stringify({idea,spec:'A\r\näöü',plan:{tasks:[{id:'T01'}]},binding_id:'synthetic-binding',plan_id:'P1'});
const hash=v=>createHash('sha256').update(v).digest('hex');
const manifest_bytes='{"schema_version":2,"plan_id":"P1","repo":"example/synthetic","revision":2,"requirements_sha256":"'+hash('{"plan_id":"P1","revision":2}')+'"}\n';
const history=JSON.stringify({P1:[{plan_id:'P1',revision:1},{plan_id:'P1',revision:2}]});
const record=JSON.stringify({repo:'example/synthetic',manifest_bytes,requirements_bytes:'{"plan_id":"P1","revision":2}',manifest_sha256:hash(manifest_bytes),snapshot:{requirements:{plan_id:'P1',revision:2}},mapping:{task:'T01'}});
const legacy=idea=>new Storage({'specit-v3':draft(idea),'specit-aira-history-v1':history,'specit-aira-v2:P1':record,'specit-theme':'dark','specit-ai':'1','other-origin-key':'excluded'});
function setup(t){
  const root=mkdtempSync(join(tmpdir(),'specit-origin-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const projects=[{project_id:'local1',mode:'aira',binding:{plan_id:'P1',repo:'example/synthetic'},revision:7}];
  const open=()=>createOriginArchive(root,{getProjects:()=>structuredClone(projects)});
  const archive=open();
  return {root,open,archive,projects};
}
const preview=(a,operation,value)=>a.dispatch({action:'preview',operation,...(operation==='import'?{backup:value}:{backup_id:value})});
const apply=(a,p,value,resolution='none')=>a.dispatch({action:'apply',operation:p.operation,...(p.operation==='import'?{backup:value}:{backup_id:value}),confirmed:true,resolution,preview_sha256:p.preview_sha256});

test('T19 multiple original drafts, full legacy history and IDs survive server import, restart and rollback/restore',async t=>{
  const {archive,open,root,projects}=setup(t),before=structuredClone(projects);
  const a=legacy('erstes \uD800'),b=legacy('zweites'),ba=await createOriginBackup(a,origin),bb=await createOriginBackup(b,other);
  assert.deepEqual(ba.entries.map(e=>e.key),['specit-aira-history-v1','specit-aira-v2:P1','specit-v3']);
  assert.equal(ba.entries.find(e=>e.key==='specit-v3').raw,a.getItem('specit-v3'));
  const p=preview(archive,'import',ba);assert.equal(existsSync(join(root,'origins.json')),false);
  assert.equal(p.conflicts[0].kind,'server_binding');assert.deepEqual(p.issues,[]);
  assert.throws(()=>apply(archive,p,ba),{code:'HISTORY_CONFLICT'});
  assert.equal(apply(archive,p,ba,'keep_separate').changed,true);
  const pb=preview(archive,'import',bb);assert.ok(pb.conflicts.some(x=>x.kind==='plan_id'));
  assert.throws(()=>apply(archive,pb,bb),{code:'HISTORY_CONFLICT'});
  apply(archive,pb,bb,'keep_separate');
  const restarted=open();assert.equal(restarted.dispatch({action:'list'}).records.length,2);
  for(const backup of [ba,bb])assert.deepEqual(restarted.dispatch({action:'read',backup_id:backup.sha256}).backup,backup);
  assert.deepEqual(projects,before);
  const rp=preview(restarted,'rollback',ba.sha256);apply(restarted,rp,ba.sha256);
  assert.equal(open().dispatch({action:'list'}).records[0].state,'rolled_back');
  assert.deepEqual(open().dispatch({action:'read',backup_id:ba.sha256}).backup,ba);
  const restore=preview(open(),'restore',ba.sha256);apply(open(),restore,ba.sha256,'keep_separate');
  assert.equal(open().dispatch({action:'list'}).records[0].state,'active');
  assert.deepEqual(open().dispatch({action:'read',backup_id:ba.sha256}).backup,ba);
  assert.deepEqual(projects,before);
  assert.equal(a.getItem('specit-v3'),draft('erstes \uD800'));assert.equal(b.getItem('specit-v3'),draft('zweites'));
});

test('T19 dry-run rejects tamper, unapproved, changed preview and conflicting origin; no destructive overwrite',async t=>{
  const {archive,root}=setup(t),a=await createOriginBackup(legacy('first'),origin),b=await createOriginBackup(legacy('second'),origin);
  const tampered=structuredClone(a);tampered.entries[0].raw+=' ';
  await assert.rejects(verifyOriginBackup(tampered),{code:'INVALID_HASH'});
  assert.throws(()=>preview(archive,'import',tampered),{code:'INVALID_HASH'});
  assert.throws(()=>preview(archive,'import',{...a,schema_version:2}),{code:'VERSION_MISMATCH'});
  const stale=preview(archive,'import',b),p=preview(archive,'import',a);
  assert.throws(()=>archive.dispatch({action:'apply',operation:'import',backup:a,confirmed:false,preview_sha256:p.preview_sha256,resolution:'keep_separate'}),{code:'APPROVAL_REQUIRED'});
  apply(archive,p,a,'keep_separate');
  const bytes=readFileSync(join(root,'origins.json'));
  assert.throws(()=>apply(archive,stale,b,'keep_separate'),{code:'HISTORY_CONFLICT'});
  const next=preview(archive,'import',b);assert.ok(next.conflicts.some(x=>x.kind==='origin_key'));
  assert.throws(()=>apply(archive,next,b),{code:'HISTORY_CONFLICT'});
  assert.deepEqual(readFileSync(join(root,'origins.json')),bytes);
  apply(archive,next,b,'keep_separate');
  const repeat=preview(archive,'import',a);assert.equal(apply(archive,repeat,a,'keep_separate').changed,false);
  assert.equal(archive.dispatch({action:'list'}).records.length,2);
});

test('T19 explicit browser change: dry-run is read-only, exact restore and idempotence, conflicts never overwrite',async()=>{
  const source=legacy('legacy'),backup=await createOriginBackup(source,origin),target=new Storage({'specit-theme':'light'});
  const p=await previewBrowserRestore(target,backup);assert.equal(p.can_restore,true);assert.equal(target.length,1);
  await assert.rejects(restoreBrowserBackup(target,backup,p,{locks}),{code:'APPROVAL_REQUIRED'});
  await assert.rejects(restoreBrowserBackup(target,backup,p,{confirmed:true}),{code:'CONTEXT_UNAVAILABLE'});
  assert.deepEqual(await restoreBrowserBackup(target,backup,p,{confirmed:true,locks}),{restored:3,identical:0});
  for(const e of backup.entries)assert.equal(target.getItem(e.key),e.raw);
  assert.equal(target.getItem('specit-theme'),'light');assert.equal(target.getItem('specit-ai'),null);
  const again=await previewBrowserRestore(target,backup);assert.deepEqual(await restoreBrowserBackup(target,backup,again,{confirmed:true,locks}),{restored:0,identical:3});
  const conflicted=new Storage({'specit-v3':draft('new')});const conflict=await previewBrowserRestore(conflicted,backup);assert.equal(conflict.can_restore,false);
  await assert.rejects(restoreBrowserBackup(conflicted,backup,conflict,{confirmed:true,locks}),{code:'HISTORY_CONFLICT'});
  assert.equal(conflicted.getItem('specit-v3'),draft('new'));assert.equal(conflicted.length,1);
  assert.equal(source.getItem('specit-v3'),draft('legacy'));
});

test('T19 browser storage failure rolls back only newly written keys; a stale preview is rejected',async()=>{
  const backup=await createOriginBackup(legacy('source'),origin),target=new Storage({'specit-aira-history-v1':history,'specit-theme':'dark'});
  const p=await previewBrowserRestore(target,backup);
  const set=target.setItem.bind(target);target.setItem=(k,v)=>{if(k==='specit-v3')throw Error('quota');set(k,v);};
  await assert.rejects(restoreBrowserBackup(target,backup,p,{confirmed:true,locks}),/quota/);
  assert.equal(target.getItem('specit-aira-v2:P1'),null);assert.equal(target.getItem('specit-aira-history-v1'),history);assert.equal(target.getItem('specit-theme'),'dark');
  set('specit-v3',draft('competing'));await assert.rejects(restoreBrowserBackup(target,backup,p,{confirmed:true,locks}),{code:'HISTORY_CONFLICT'});
  assert.equal(target.getItem('specit-v3'),draft('competing'));
});

test('T19 unreadable legacy records remain recoverable originals and are marked unverified',async t=>{
  const {archive}=setup(t),storage=new Storage({'specit-v3':'{broken','specit-aira-v2:P1':'{"legacy":true}'});
  const backup=await createOriginBackup(storage,origin),p=preview(archive,'import',backup);
  assert.equal(p.issues.length,2);apply(archive,p,backup,'keep_separate');
  assert.deepEqual(archive.dispatch({action:'read',backup_id:backup.sha256}).backup,backup);
});
