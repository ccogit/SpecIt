import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {IDEA_EXAMPLES,conceptSignals} from '../studio.mjs';

test('idea starters are distinct, substantial and actionable',()=>{
  assert.ok(IDEA_EXAMPLES.length >= 3);
  assert.equal(new Set(IDEA_EXAMPLES.map(x=>x.title)).size,IDEA_EXAMPLES.length);
  for(const example of IDEA_EXAMPLES){
    assert.ok(example.title.length > 2);
    assert.ok(example.text.length >= 35);
    assert.equal(conceptSignals(example.text).ready,true);
  }
});

test('concept signals are hints, not fabricated AI conclusions',()=>{
  assert.equal(conceptSignals('').ready,false);
  assert.equal(conceptSignals('Hi').ready,false);
  const x=conceptSignals('Eine Immobilien-App für Besichtigungen und Exposés');
  assert.equal(x.area,'Immobilien');
  assert.ok(x.ideas.includes('Interessenten-Journey'));
  assert.equal(x.ready,true);
  const unknown=conceptSignals('Ein Werkzeug für die besonderen internen Prozesse unseres Vereins');
  assert.equal(unknown.area,'Eigene Produktidee');
  assert.ok(unknown.ideas.length >= 2);
  assert.ok(!unknown.hint.toLowerCase().includes('ki-generiert'));
});

test('server serves complete Studio with safe types and honest demo status',async()=>{
  const port=31000+(process.pid%16000);
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:new URL('..',import.meta.url),
    env:{...process.env,PORT:String(port),SPECIT_NO_CLAUDE_CODE:'1',SPECIT_NO_CODEX:'1',SPECIT_KEEP_RUNNING:'1'},
    stdio:'ignore'
  });
  try{
    let ready=false;
    for(let attempt=0;attempt<100;attempt++){
      if(child.exitCode!==null)break;
      try{const r=await fetch(base+'/api/status');if(r.ok){ready=true;break}}catch{}
      await pause(80);
    }
    assert.ok(ready,'local app should start');
    const [page,css,js,api]=await Promise.all([
      fetch(base+'/'),fetch(base+'/studio.css'),fetch(base+'/studio.mjs'),fetch(base+'/api/status')
    ]);
    for(const r of [page,css,js,api])assert.equal(r.status,200);
    assert.match(page.headers.get('content-type'),/text\/html/);
    assert.match(css.headers.get('content-type'),/text\/css/);
    assert.match(js.headers.get('content-type'),/javascript/);
    const policy=page.headers.get('content-security-policy');
    assert.match(policy,/style-src 'self' 'unsafe-inline'/);
    assert.match(policy,/connect-src 'self'/);
    const markup=await page.text(),stylesheet=await css.text(),module=await js.text();
    assert.match(markup,/id="magicStart"/);
    assert.match(markup,/class="launch-stage"/);
    assert.match(markup,/id="advancedPanel"/);
    assert.match(markup,/id="briefSignal"/);
    assert.match(markup,/id="phase3"/);
    assert.match(markup,/href="\/studio.css"/);
    assert.match(markup,/from '\/studio.mjs'/);
    assert.match(stylesheet,/\.hero h1/);
    assert.match(stylesheet,/@media\(max-width:560px\)/);
    assert.match(stylesheet,/prefers-reduced-motion/);
    assert.match(module,/conceptSignals/);
    const status=await api.json();
    assert.equal(status.available,false);
  }finally{
    child.kill();
  }
});
