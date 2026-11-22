import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import { chapterGroups } from '../spec-parallel.mjs';
import { coreChapters, specFrame } from '../blocks.mjs';

async function freePort(){
 const server=net.createServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));return port;
}
async function serverSession(run){
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const env={...process.env,PORT:String(port),SPECIT_NO_CLAUDE_CODE:'1',SPECIT_NO_CODEX:'1',SPECIT_NO_GITHUB:'1',
  SPECIT_KEEP_RUNNING:'1',ANTHROPIC_API_KEY:'mock-key',
  SPECIT_GPU_MODEL:'Qwen/Qwen3-8B',SPECIT_PROMPT_CACHE:'1'};
 const cp=spawn(process.execPath,['--import',new URL('./mock-remote.mjs',import.meta.url).href,'server.mjs'],
  {cwd:fileURLToPath(new URL('../',import.meta.url)),env,stdio:['ignore','pipe','pipe']});
 let stderr='';cp.stderr.on('data',d=>{stderr+=d.toString().slice(0,1000)});
 try{
  let ready=false;
  for(let i=0;i<45;i++){
   if(cp.exitCode!==null)throw Error('Server exited: '+stderr);
   try{const res=await fetch(base+'/api/status',{signal:AbortSignal.timeout(800)});if(res.ok){ready=true;break}}catch{}
   await pause(100);
  }
  if(!ready)throw Error('SpecIt mock server did not start: '+stderr);
  await run(base);
 }finally{cp.kill('SIGTERM');await Promise.race([new Promise(resolve=>cp.once('exit',resolve)),pause(2000)])}
}
const payload=(strategy)=>({
 mode:'final',strategy,ai:true,project:'Notizio',idea:'Eine Notizen App',
 features:[{name:'Notizen',note:'Anlegen und bearbeiten',core:true}],
 questions:[],extras:[],autonomy:100,duration:'1 Stunde',minutes:60,creativity:2,tone:2,
 ...(strategy==='preload'?{preloadToken:'b'.repeat(32)}:{})
});
async function post(base,path,value){
 const res=await fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(value)});
 if(!res.ok)throw Error(path+' returned '+res.status+': '+(await res.text()).slice(0,200));
 return res;
}
async function generate(base,value){
 const res=await post(base,'/api/spec/stream',value);
 let rows=[],buffer='',decoder=new TextDecoder();for await(const chunk of res.body){
  buffer+=decoder.decode(chunk,{stream:true});
  let index;while((index=buffer.indexOf('\n'))>=0){
   const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
   if(line.trim())rows.push(JSON.parse(line));
  }
 }
 const error=rows.find(row=>row.error);if(error)throw Error(error.error);
 return rows.find(row=>row.done);
}
test('mocked end-to-end spec generation: classic, parallel, structured, and local GPU',async()=>{
 await serverSession(async base=>{
  const status=await (await fetch(base+'/api/status')).json();
  assert.equal(status.gpu,true);assert.equal(status.specModels.gpu.name,'Qwen/Qwen3-8B');assert.ok(status.specModels.classic.name);
  for(const [asset,mime] of [['/','text/html'],['/app.mjs','text/javascript'],['/base.css','text/css'],['/responsive.css','text/css'],['/ndjson.mjs','text/javascript'],['/work-session.mjs','text/javascript']]){
   const file=await fetch(base+asset);
   assert.equal(file.status,200,asset);
   assert.ok(file.headers.get('content-type')?.startsWith(mime),asset+' has incorrect content type');
   assert.ok((await file.text()).length>100,asset+' is unexpectedly empty');
  }
  for(const strategy of ['classic','parallel','structured','gpu']){
   const result=await generate(base,payload(strategy));
   assert.ok(result?.markdown,strategy);
   const actual=coreChapters(result.markdown,specFrame({...payload(strategy),scope:[{name:'Notizen',note:'Anlegen und bearbeiten',basis:true}]})).map(c=>c.title);
   assert.deepEqual(actual,chapterGroups.flat(),strategy);
   assert.match(result.markdown,/FR-001/,strategy);
   await pause(1600);
  }
 });
},{timeout:30000});
test('prepared result is reused with the exact project fingerprint',async()=>{
 await serverSession(async base=>{
  const input=payload('preload');
  const prep=await (await post(base,'/api/spec/preload',input)).json();
  assert.equal(prep.ready,true);
  const used=await generate(base,input);
  assert.equal(used?.preloaded,true);
  assert.match(used.markdown,/FR-001/);
  await pause(1600); // existing foreground rate limit is 1500 ms
  const changed=await generate(base,{...input,idea:'Andere Idee'});
  assert.equal(changed?.preloaded,undefined);
 });
},{timeout:20000});
