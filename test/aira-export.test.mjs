import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportAira, verifyAira } from '../aira-export.mjs';
const fixture = name => JSON.parse(readFileSync(new URL('./fixtures/specit_v1/'+name+'.json', import.meta.url), 'utf8'));
function input(f) {
  return {...f.source,approved:true,spec:f.expected_files['SPEC.md'],artifacts:Object.fromEntries(Object.entries(f.expected_files).filter(([p])=>p.startsWith('artifacts/')))};
}
for (const name of ['linear','branched','blocked']) test('Aira V1 bytegenau: '+name,()=>{
  const f=fixture(name), i=input(f), actual=exportAira(i);
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(f.expected_files).sort());
  for(const [p,content] of Object.entries(f.expected_files)) assert.deepEqual(actual[p],Buffer.from(content),p);
  assert.deepEqual(actual,exportAira(i));
  assert.equal(verifyAira(actual),true);
});
for(const c of fixture('invalid').cases) test('Aira V1 reject: '+c.id,()=>{
  const f=fixture('linear'), root={source:f.source,manifest:JSON.parse(f.expected_files['manifest.json'])};
  const parts=c.pointer.slice(1).split('/').map(p=>p.replaceAll('~1','/').replaceAll('~0','~'));
  const key=parts.pop();
  parts.reduce((o,k)=>o[k],root)[key]=c.value;
  if(c.stage==='export') assert.throws(()=>exportAira(input(f)),/Aira-Export/);
  else {
    f.expected_files['manifest.json']=JSON.stringify(root.manifest,null,2)+'\n';
    assert.throws(()=>verifyAira(f.expected_files),/Aira-Export/);
  }
});
test('Freigabe und keine impliziten Punkte',()=>{
  const i=input(fixture('linear'));
  assert.throws(()=>exportAira({...i,approved:false}),/Freigabe/);
  delete i.confirmed_points.T01;
  assert.throws(()=>exportAira(i),/Aira-Export/);
});
