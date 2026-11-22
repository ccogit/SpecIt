import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('all generation strategies are visible in the SpecIt UI and forwarded with the request', () => {
  for(const name of ['classic','incremental','preload','parallel','turbo'])
    assert.match(html,new RegExp('<option value="'+name+'">'));
  assert.match(html,/strategy:s\.specStrategy/);
  assert.match(html,/specStrategy:'incremental'/);
  assert.match(html,/s\.specStrategy==='incremental'&&s\.spec\.trim\(\)/);
  assert.match(html,/spec\/preload/);
  assert.match(html,/preloadToken:preloadSession/);
});

test('browser module stays JavaScript-syntax-valid after UI changes', () => {
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script, 'missing UI script');
  const run=spawnSync(process.execPath,['--input-type=module','--check'],{input:script[1],encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});
