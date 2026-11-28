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
  const postAllowlist=server.split('\n').find(line=>line.includes("req.method!=='POST'"));
  for(const route of ['/api/aira/migration','/api/aira/v2/restore'])assert.ok(postAllowlist?.includes("'"+route+"'"),route);
  assert.match(server,/verifyV1Migration\(body.migration,body\)/);
});

test('V2 proposal dependency graph is browser-safe and the planner stays import-free',()=>{
  const server=read('server.mjs');
  // Mirror the explicit static-module allowlist; do not assume a module that
  // works in Node will be available at the corresponding browser URL.
  const served=new Map([...server.matchAll(/'([^']+\.mjs)':await readFile\(new URL\('\.(\/[^']+)',import\.meta\.url\)\)/g)].map(([,url,path])=>[url,path.slice(1)]));
  const planner=read('planner.mjs');
  assert.doesNotMatch(planner,/^import /m);
  assert.doesNotMatch(planner,/\b(?:localStorage|readFile|writeFile|fetch)\s*\(/);
  assert.match(read('public/aira-v2-ui.mjs'),/import \{proposeRequirementPlan\} from '\/aira-plan-proposal\.mjs'/);
  const seen=new Set();
  function visit(path){
    if(seen.has(path))return;
    seen.add(path);
    assert.ok(served.has(path),'unserved browser module: '+path);
    const source=read(served.get(path));
    for(const match of source.matchAll(/^import\s+[^\n]*?\s+from\s+['"]([^'"]+)['"]/gm)){
      const specifier=match[1];
      assert.ok(specifier.startsWith('/')||specifier.startsWith('./'),'non-browser import: '+specifier);
      visit(new URL(specifier,'http://localhost'+path).pathname);
    }
  }
  visit('/aira-v2-ui.mjs');
  for(const path of ['/aira-plan-proposal.mjs','/planner.mjs','/aira-requirement-identities.mjs','/interview.mjs','/aira-requirement-revisions.mjs'])assert.ok(seen.has(path),path);
});
