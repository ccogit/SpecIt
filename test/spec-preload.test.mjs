import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecPreloadCache, preloadFingerprint } from '../spec-preload.mjs';

test('fingerprints ignore only session ID and invalidate changed decisions', () => {
 const d = { mode:'final', idea:'App', questions:[{answer:'ja'}], preloadToken:'0'.repeat(32) };
 assert.equal(preloadFingerprint(d), preloadFingerprint({...d,preloadToken:'1'.repeat(32)}));
 assert.notEqual(preloadFingerprint(d), preloadFingerprint({...d,questions:[{answer:'nein'}]}));
});

test('completed preload is reused only in matching session and exact payload', async () => {
 let time=1000,count=0; const c=new SpecPreloadCache({ttlMs:100,now:()=>time});
 const key='a'.repeat(32), payload={idea:'One', features:['a']};
 const run=()=>{count++;return Promise.resolve('Complete SPEC.md')};
 await c.start(key,payload,run);
 assert.equal(await c.take(key,payload),'Complete SPEC.md');
 assert.equal(await c.take('b'.repeat(32),payload),null);
 assert.equal(await c.take(key,{...payload,features:['b']}),null);
 await c.start(key,payload,run);
 assert.equal(count,1);
 time=1200; assert.equal(await c.take(key,payload),null);
 await c.start(key,payload,run); assert.equal(count,2);
});

test('a changed preload cancels an outdated in-flight job, and abort is not cached', async () => {
 const c=new SpecPreloadCache(),key='a'.repeat(32),aborts=[];
 const deferred=payload=>signal=>new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>{aborts.push(payload);reject(Error('aborted'))},{once:true});
 });
 const old=c.start(key,{idea:'old'},deferred('old'));
 await Promise.resolve(); // let the first inference attach its abort listener
 const recent=c.start(key,{idea:'new'},async()=> 'new result');
 await assert.rejects(old,/aborted/);
 assert.deepEqual(aborts,['old']);
 assert.equal(await recent,'new result');
 assert.equal(await c.take(key,{idea:'old'}),null);
 assert.equal(await c.take(key,{idea:'new'}),'new result');
});

test('browser cancellation and invalid session IDs are rejected',async()=>{
 const c=new SpecPreloadCache(),ac=new AbortController(),key='c'.repeat(32);
 assert.throws(()=>c.key('unsafe session',{idea:'abc'}),/Sitzung/);
 let rejectRun;
 const running=c.start(key,{idea:'abc'},sig=>new Promise((r,rej)=>{rejectRun=rej;sig.addEventListener('abort',()=>rej(Error('aborted')),{once:true})}),ac.signal);
 await Promise.resolve(); ac.abort();
 await assert.rejects(running,/aborted/);
 assert.equal(await c.take(key,{idea:'abc'}),null);
});
