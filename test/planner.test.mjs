import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan,demoPlan,renderTask,renderBacklog,renderSingle,estimate,recommendAgents } from '../planner.mjs';
import { validateRun } from '../runner.mjs';
test('more agents shorten the run only as far as tasks are ready in parallel',()=>{const p=demoPlan('Test');assert.equal(estimate(p,1),37);assert.equal(estimate(p,2),25);assert.equal(estimate(p,5),25)});
test('agent recommendation follows the target duration',()=>{
  const p=demoPlan('Test');
  assert.deepEqual(recommendAgents(p,40).agents,1,'one agent is enough when the time allows');
  const tight=recommendAgents(p,30);assert.equal(tight.agents,2);assert.equal(tight.fits,true);
  const impossible=recommendAgents(p,10);assert.equal(impossible.fits,false);assert.equal(impossible.agents,2);
  assert.equal(recommendAgents(p).fits,null);assert.equal(recommendAgents(p).options.length,2,'never more agents than the widest stage');
  const old=validatePlan({...p,tasks:p.tasks.map(({minutes,...t})=>t)});assert.ok(old.tasks.every(t=>t.minutes===10),'plans without estimates get a default');
});
test('a run needs an absolute target folder outside SpecIt',()=>{
  const p=demoPlan('Test'),base={spec:'S',plan:p,agents:9};
  assert.throws(()=>validateRun({...base,dir:''}),/Zielordner/);
  assert.throws(()=>validateRun({...base,dir:'relativ/ordner'}),/vollständigen Pfad/);
  assert.throws(()=>validateRun({...base,dir:new URL('../public',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')}),/SpecIt-Ordner/);
  const ok=validateRun({...base,dir:process.platform==='win32'?'C:\\Temp\\specit-ziel':'/tmp/specit-ziel',shell:'ja'});
  assert.equal(ok.agents,6);assert.equal(ok.shell,false);
});
test('single assignment holds every task as an ordered step and the spec once',()=>{const p=validatePlan({...demoPlan('Test'),tasks:demoPlan('Test').tasks.map((t,i)=>i?t:{...t,blockedBy:['Freigabe ausstehend']})});const m=renderSingle(p,'EXAMPLE',{agent:'Codex'});p.waves.flat().forEach((id,i)=>{const t=p.tasks.find(x=>x.id===id);assert.ok(m.includes('### Schritt '+(i+1)+': '+t.title+' ('+id+')'))});assert.equal(m.split('EXAMPLE').length,2);assert.ok(m.indexOf('Schritt 1:')<m.indexOf('Schritt 4:'));for(const s of ['# Gesamtauftrag','Akzeptanzkriterien','Codex',p.tasks[0].blockedBy[0]])assert.ok(m.includes(s))});
test('a chosen layout is passed on as the authoritative design, others only as reference',()=>{
  const p=demoPlan('Test'),url='https://stitch.withgoogle.com/projects/123456';
  for(const render of [c=>renderTask(p.tasks[0],p,'S',c),c=>renderSingle(p,'S',c)]){
    const chosen=render({layoutUrl:url,layoutChoice:'Variante 2 – Split-Layout',layoutFile:'design/layout.html'});
    assert.ok(chosen.includes('Gewählter UI-Entwurf')&&chosen.includes('Variante 2 – Split-Layout')&&chosen.includes('design/layout.html')&&chosen.includes(url));
    const plain=render({layoutUrl:url});
    assert.ok(plain.includes('keine verbindliche Vorgabe')&&!plain.includes('Gewählter UI-Entwurf'));
    assert.ok(!render({}).includes('Stitch'));
  }
});
const blockedPlan=()=>{const p=demoPlan('Test');p.tasks[0].blockedBy=['Freigabe ausstehend'];return validatePlan(p)};
test('DAG waves and blocked propagation',()=>{const p=blockedPlan();assert.deepEqual(p.waves,[['T01'],['T02','T03'],['T04']]);assert.equal(p.blocked.length,4)});
test('the demo plan asks nothing back: no blocked tasks, its own decisions stated as settled',()=>{const p=demoPlan('Test');assert.deepEqual(p.blocked,[]);assert.equal(p.decisions.length,1);const m=renderTask(p.tasks[1],p,'EXAMPLE');assert.ok(!m.includes('BLOCKIERT')&&m.includes('Festlegungen des Plans'));assert.ok(renderSingle(p,'EXAMPLE').includes('Diese Punkte sind entschieden')&&!renderSingle(p,'EXAMPLE').includes('zu klären'))});
test('cycle rejected',()=>{const p=demoPlan('Test');p.tasks[0].dependsOn=['T04'];assert.throws(()=>validatePlan(p),/Zyklisch/)});
test('unknown dependency rejected',()=>{const p=demoPlan('Test');p.tasks[1].dependsOn=['T99'];assert.throws(()=>validatePlan(p),/Unzulässige/)});
test('duplicate id rejected',()=>{const p=demoPlan('Test');p.tasks[1].id='T01';assert.throws(()=>validatePlan(p),/Doppelte/)});
test('missing acceptance criteria rejected',()=>{const p=demoPlan('Test');p.tasks[0].acceptance=[];assert.throws(()=>validatePlan(p),/acceptance/)});
test('unblocked DAG recomputed',()=>{const p=demoPlan('Test');p.tasks[0].blockedBy=[];assert.deepEqual(validatePlan(p).blocked,[])});
test('handoff includes spec, dependency and safety gate',()=>{const p=blockedPlan();const m=renderTask(p.tasks[1],p,'EXAMPLE');for(const s of ['T01','EXAMPLE','BLOCKIERT','Akzeptanzkriterien','Tests'])assert.ok(m.includes(s))});
test('backlog includes all tasks',()=>{const p=demoPlan('Test');const m=renderBacklog(p,'EXAMPLE');for(const t of p.tasks)assert.ok(m.includes(t.id+' – '+t.title))});
