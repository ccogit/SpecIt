import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceStatic,workspaceViews,createWorkspaceClient,readWorkspaceProgress,mountWorkspaceView} from '../public/aira-workspace-ui.mjs';
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const context={workspace_id:uid(1),binding_id:uid(2),draft_id:'draft1'};
const h='a'.repeat(64);
function setup(){let n=10;const calls=[],overrides={};const client=createWorkspaceClient({context,instanceId:uid(3),mode:'integrated',requestId:()=>uid(n++),post:async(path,body)=>{
  const op=path.split('/').at(-1);calls.push({path,body});const data={capabilities:{adapter_version:1,package_versions:[2],feedback_versions:[1],mode:'integrated',instance_id:uid(3)},open_context:{...context,status:'ready'},prepare_package:{revision:1,manifest_sha256:h,staging_id:uid(4)}}[op];return {ok:true,schema_version:1,request_id:body.request_id,data:{...data,...overrides[op]}};}});return {client,calls,overrides};}
test('T18 fixed static namespace, relative navigation/assets and scoped theme; reject arbitrary routes',()=>{
  for(const view of workspaceViews){const result=workspaceStatic('GET','/workspace/specit/'+view);assert.match(result.body,/href="\.\/assets\/view\.css"/);assert.match(result.body,/href="\.\/plan"/);assert.doesNotMatch(result.body,/script|binding_id|workspace_id/);assert.match(result.headers['Content-Security-Policy'],/default-src 'none'/);}
  assert.match(workspaceStatic('GET','/workspace/specit/assets/view.css').body,/\.specit-workspace\{/);
  for(const path of ['/workspace/specit/plan?x=1','/workspace/specit/%70lan','/workspace/specit/../plan','/api/run','/workspace/specit/assets/app.mjs'])assert.equal(workspaceStatic('GET',path),null);
  assert.equal(workspaceStatic('POST','/workspace/specit/plan'),null);
});
test('T18/T21 exact version and context before explicit staging; no target selection or import approval',async()=>{
  const {client,calls,overrides}=setup();await assert.rejects(client.prepare({revision:1,manifest_sha256:h,confirmed:true}),{code:'CONTEXT_UNAVAILABLE'});
  overrides.capabilities={mode:'fake'};await assert.rejects(client.open(),{code:'VERSION_MISMATCH'});delete overrides.capabilities;
  overrides.open_context={binding_id:uid(9)};await assert.rejects(client.open(),{code:'WRONG_TARGET'});delete overrides.open_context;
  await client.open();await assert.rejects(client.prepare({revision:1,manifest_sha256:h}),{code:'APPROVAL_REQUIRED'});
  assert.equal(calls.filter(c=>c.path.endsWith('prepare_package')).length,0);
  assert.equal((await client.prepare({revision:1,manifest_sha256:h,confirmed:true})).staging_id,uid(4));
  const last=calls.at(-1);assert.equal(last.path,'../../api/workspace/specit/v1/prepare_package');assert.deepEqual(Object.keys(last.body).sort(),['draft_id','manifest_sha256','request_id','revision','schema_version','workspace_id']);
  assert.equal(new Set(calls.map(c=>c.body.request_id)).size,calls.length);client.close();await assert.rejects(client.prepare({revision:1,manifest_sha256:h,confirmed:true}),{code:'CONTEXT_UNAVAILABLE'});
});
const frame=(cursor,job_id=uid(5))=>`event: progress\ndata: ${JSON.stringify({cursor,state:'applying',job_id})}\n\n`;
async function* bytes(s){const b=new TextEncoder().encode(s);for(let i=0;i<b.length;i+=7)yield b.slice(i,i+7);}
const collect=async(stream)=>{const a=[];for await(const x of stream)a.push(x);return a;};
test('T21 POST progress handles chunking and rejects gaps, foreign jobs and truncated frames',async()=>{
  assert.deepEqual((await collect(readWorkspaceProgress(bytes(frame(2)+frame(3)),uid(5),1))).map(e=>e.cursor),[2,3]);
  for(const s of [frame(2),frame(1,uid(6)),frame(1).slice(0,-1),frame(1)+'event: log\ndata: {}\n\n'])await assert.rejects(collect(readWorkspaceProgress(bytes(s),uid(5))),{code:'EVIDENCE_MISMATCH'});
});
class Element{constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.attrs={};}setAttribute(k,v){this.attrs[k]=v;}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}querySelector(){return null;}}
const dom=()=>{const doc={createElement:tag=>new Element(tag,doc)};return new Element('main',doc);};
test('T18 views consume one confirmed context and reuse domain callbacks; preview is sandboxed and staging is click-only',async()=>{
  const root=dom(),calls=[];const selected={...context,status:'ready'};const draft={draft_id:'draft1',generation:1,idea:'idea',spec:'spec',prototype_html:'<script>bad()</script>',plan:{},requirements:{},approved_revision:1,manifest_sha256:h};
  const domain={readDraft:async c=>{assert.equal(c,selected);return draft;},saveDraft:async(c,p)=>calls.push(['save',c,p]),renderBacklog:()=>{calls.push(['plan']);return 'existing planner';},requirementCoverageReport:()=>{calls.push(['review']);return [];}};
  const client={prepare:async p=>calls.push(['prepare',p]),close:()=>{}};
  let stop=mountWorkspaceView(root,{view:'spec',context:selected,domain,client});await new Promise(setImmediate);
  const iframe=root.children[0].children.find(n=>n.tag==='iframe');assert.equal(iframe.attrs.sandbox,'');assert.match(iframe.srcdoc,/default-src 'none'/);assert.equal(calls.length,0);stop();
  stop=mountWorkspaceView(root,{view:'review',context:selected,domain,client});await new Promise(setImmediate);assert.deepEqual(calls,[['review']]);stop();
  stop=mountWorkspaceView(root,{view:'plan',context:selected,domain,client});await new Promise(setImmediate);assert.deepEqual(calls,[['review'],['plan']]);root.children[0].children.find(n=>n.tag==='button').onclick();await new Promise(setImmediate);assert.deepEqual(calls.at(-1),['prepare',{revision:1,manifest_sha256:h,confirmed:true}]);stop();
});
