import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('T04 integrated UI is mounted, uses server archive and separate receipt status',()=>{
  const ui=read('public/aira-project-ui.mjs'),app=read('public/app.mjs'),html=read('public/index.html');
  for(const id of ['airaProjectModeStatus','airaProjectOpen','airaStandaloneProject','airaV2Bind','airaV2History','airaV2ExportStatus','airaV2ReceiptStatus','airaV2PointRows','airaV2Conflict','airaV2Approve','airaV2Download'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(app,/import \{mountAiraV2\} from '\/aira-project-ui\.mjs'/);
  assert.match(app,/airaProjectUI\?\.blocksRun\(\)/);
  assert.doesNotMatch(ui,/\blocalStorage\b|\/api\/run|\/api\/repo|startRun/);
  for(const name of ['/api/aira/project','/api/aira/history','/api/aira/v2/restore','/api/aira/preview/invalidate','preview_id','expected_export_epoch','comparison','last_known_receipt'])assert.ok(ui.includes(name),name);
});

test('T04 served integrated UI imports only browser modules',()=>{
  const server=read('server.mjs'),served=new Map([...server.matchAll(/'([^']+\.mjs)':await readFile\(new URL\('\.(\/[^']+)',import\.meta\.url\)\)/g)].map(([,url,path])=>[url,path.slice(1)]));
  const seen=new Set();
  function visit(url){
    if(seen.has(url))return;seen.add(url);assert.ok(served.has(url),url);
    for(const [,specifier] of read(served.get(url)).matchAll(/^import\s+[^\n]*?\s+from\s+['"]([^'"]+)['"]/gm)){
      assert.ok(specifier.startsWith('/')||specifier.startsWith('./'),specifier);
      visit(new URL(specifier,'http://localhost'+url).pathname);
    }
  }
  visit('/aira-project-ui.mjs');
  assert.ok(seen.has('/aira-plan-proposal.mjs'));
  assert.doesNotMatch(read('planner.mjs'),/^import /m);
});
