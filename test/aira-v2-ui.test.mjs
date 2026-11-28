import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('V2 UI is separate from V1 and uses explicit mapping, revision storage, preview and lock',()=>{
  const ui=read('public/aira-v2-ui.mjs'),app=read('public/app.mjs'),html=read('public/index.html'),server=read('server.mjs');
  for(const id of ['goAiraV2','airaV2Dialog','airaV2Mapping','airaV2Migration','airaV2Confirmations','airaV2Coverage','airaV2Approve','airaV2Points','airaV2Backup'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(app,/mountAiraV2\(\{getCurrent:airaCurrent/);
  for(const fn of ['proposeRequirementPlan','interviewDecisionDrafts','confirmRequirementRevision','requirementCoverageReport','navigator.locks.request','localStorage.setItem','/api/aira/preview','/api/aira/export','/api/aira/migration'])assert.ok(ui.includes(fn),fn);
  assert.doesNotMatch(ui,/\/api\/run|\/api\/repo|startRun/);
  assert.match(server,/verifyV1Migration\(body.migration,body\)/);
});
