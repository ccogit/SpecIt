import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorkspacePackageService } from '../aira-workspace-package.mjs';

const workspace_id='00000000-0000-0000-0000-000000000001';
const request_id='00000000-0000-0000-0000-000000000002';
const staging_id='00000000-0000-0000-0000-000000000003';
function setup() {
  const files={'manifest.json':Buffer.from('{"schema_version":2,"mode":"aira","revision":1,"repo":"example/project","plan_id":"P1"}\n'), 'SPEC.md':Buffer.from('original\r\n')};
  const manifest_sha256=createHash('sha256').update(files['manifest.json']).digest('hex');
  const context={workspace_id,draft_id:'draft1',project_id:'local1',repo:'example/project',plan_id:'P1'};
  const project={mode:'aira',binding:{repo:context.repo,plan_id:context.plan_id},revision:1,manifest_sha256,generation:1};
  const capability=Buffer.alloc(32,1), staged=[];
  const service=createWorkspacePackageService({capability,expiresAt:100,now:()=>10,resolveContext:async w=>w===workspace_id?context:null,
    store:{get:()=>project,history:()=>[{files,manifest_sha256}]},stage:async data=>{staged.push(data);return staging_id;}});
  const request={schema_version:1,request_id,workspace_id,draft_id:context.draft_id,revision:1,manifest_sha256};
  return {service,request,capability,files,context,project,staged};
}
test('T18/T20 private staging preserves original archived bytes and returns only opaque metadata', async()=>{
  const s=setup();const result=await s.service(s.request,s.capability);
  assert.deepEqual(result,{ok:true,schema_version:1,request_id,data:{staging_id,revision:1,manifest_sha256:s.request.manifest_sha256}});
  assert.deepEqual(s.staged[0].files,s.files);
  s.staged[0].files['SPEC.md'].fill(0);assert.equal(s.files['SPEC.md'].toString(),'original\r\n');
});
test('T21 wrong capability, version, workspace, draft, target, head and extra fields never stage', async()=>{
  const s=setup();
  await assert.rejects(s.service(s.request,Buffer.alloc(32,2)),{code:'POLICY_DENIED'});
  for(const [patch,code] of [[{schema_version:2},'VERSION_MISMATCH'],[{workspace_id:staging_id},'CONTEXT_UNAVAILABLE'],[{draft_id:'other'},'WRONG_TARGET'],[{revision:2},'HISTORY_CONFLICT'],[{manifest_sha256:'f'.repeat(64)},'HISTORY_CONFLICT'],[{path:'/tmp/file'},'INVALID_SCHEMA']])
    await assert.rejects(s.service({...s.request,...patch},s.capability),{code});
  s.project.binding.repo='example/other';await assert.rejects(s.service(s.request,s.capability),{code:'WRONG_TARGET'});
  assert.equal(s.staged.length,0);
});
