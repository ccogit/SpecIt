import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {sha256,exportAira,previewAira,verifyAira} from '../aira-export.mjs';
import {airaZip} from '../aira-zip.mjs';
import {inflateRawSync} from 'node:zlib';
import {buildAiraV2Export,validateV2Restore} from '../aira-v2-export.mjs';
import {restoreRequirementHighWater} from '../aira-requirement-identities.mjs';

const read = name => readFileSync(new URL('./fixtures/aira-v2/' + name, import.meta.url));
const fixture = name => JSON.parse(read(name));
const catalog = fixture('fixture-manifest.json').fixtures;

function source(name) {
  const {expected_files: files, base} = fixture(name);
  const manifest = JSON.parse(files['manifest.json']);
  const requirements = JSON.parse(files['requirements.json']);
  const entries = [...Object.entries(manifest.tasks), ...manifest.blockers.map(entry => [entry.id, entry])];
  const {schema_version, plan_id, repo, revision, plan, target_minutes, previous_manifest_sha256} = manifest;
  const input = {
    schema_version, plan_id, repo, revision, plan, target_minutes, previous_manifest_sha256,
    requirements, spec: files['SPEC.md'],
    approved:true,changes_approved:true,confirmed_ids:[...plan.tasks,...requirements.requirements,...requirements.criteria,...requirements.tests,...requirements.decisions].map(x=>x.id),
    confirmed_points: Object.fromEntries(entries.map(([id, entry]) => [id, entry.points])),
  };
  if (base) {
    const predecessor=fixture(base).expected_files;
    input.previous={manifest_bytes:predecessor['manifest.json'],requirements_bytes:predecessor['requirements.json']};
  }
  return {input, manifest};
}

for (const name of ['linear.json', 'branched.json', 'blocked.json', 'revised.json']) {
  test('V2 reproduces all bytes and hashes for ' + name, () => {
    const {expected_files, expected_sha256, expected_order} = fixture(name);
    const {input} = source(name);
    const snapshot = structuredClone(input);
    const {files, order} = buildAiraV2Export(input);
    assert.deepEqual(Object.keys(files).sort(), Object.keys(expected_files).sort());
    for (const [path, content] of Object.entries(expected_files)) {
      assert.deepEqual(files[path], Buffer.from(content), path);
      assert.equal(sha256(files[path]), expected_sha256[path], path);
    }
    if (expected_order) assert.deepEqual(order, expected_order);
    assert.deepEqual(buildAiraV2Export(input).files, files);
    assert.deepEqual(exportAira(input),files);
    assert.equal(previewAira({...input,approved:false}).manifest_sha256,sha256(files['manifest.json']));
    assert.equal(verifyAira(files,input.previous?[input.previous]:[]),true);
    const archive=airaZip(input);assert.deepEqual(archive,airaZip(input));assert.deepEqual(unzip(archive),Object.fromEntries(Object.entries(files)));
    assert.deepEqual(input, snapshot);
  });
}

function unzip(buf) {
  const result={};let i=0;
  while(buf.readUInt32LE(i)===0x04034b50){
    const method=buf.readUInt16LE(i+8),size=buf.readUInt32LE(i+18),len=buf.readUInt16LE(i+26),extra=buf.readUInt16LE(i+28);
    const name=buf.subarray(i+30,i+30+len).toString(),start=i+30+len+extra,data=buf.subarray(start,start+size);
    result[name]=method===8?inflateRawSync(data):Buffer.from(data);i=start+size;
  }
  return result;
}
function replaceField(target, path, value) {
  const keys = path.split('/');
  const key = keys.pop();
  keys.reduce((entry, part) => entry[part], target)[key] = value;
}

const invalid = fixture('invalid.json');
for (const variant of invalid.cases) {
  test('V2 rejects ' + variant.id, () => {
    const {input, manifest} = source(variant.base ?? invalid.base);
    if (variant.path === 'manifest.json') {
      input.draft_files = manifest.draft_files;
      replaceField(input, variant.field, variant.value);
    } else {
      replaceField(input.requirements, variant.field, variant.value);
    }
    assert.equal(variant.expected, catalog['invalid.json'].expected[variant.id]);
    assert.throws(() => buildAiraV2Export(input), {code: variant.expected});
    assert.throws(() => exportAira(input), {code: variant.expected});
    assert.throws(() => previewAira(input), {code: variant.expected});
    assert.throws(() => airaZip(input), {code: variant.expected});
    // Apply the same fixture mutation directly to original package bytes.
    const archived={...fixture(variant.base ?? invalid.base).expected_files};
    const value=JSON.parse(archived[variant.path]);
    replaceField(value,variant.field,variant.value);
    archived[variant.path]=JSON.stringify(value,null,2)+'\n';
    assert.throws(()=>verifyAira(archived,input.previous?[input.previous]:[]),{code:variant.expected});
  });
}

for (const variant of fixture('revised.json').negative) {
  test('V2 revision rejects ' + variant.id, () => {
    const {input} = source('revised.json');
    replaceField(input, variant.field, variant.value);
    assert.throws(() => buildAiraV2Export(input), {code: variant.expected});
    assert.throws(() => exportAira(input), {code: variant.expected});
    assert.throws(() => previewAira(input), {code: variant.expected});
    assert.throws(() => airaZip(input), {code: variant.expected});
  });
}

test('V2 manifest binds the feedback reference to the exported revision', () => {
  const feedback = fixture('feedback.json');
  const {input} = source(feedback.package);
  const {files, manifest} = buildAiraV2Export(input);
  for (const event of feedback.events) {
    assert.equal(sha256(event.text), event.sha256);
    const data = JSON.parse(event.text);
    assert.equal(data.manifest_sha256, sha256(files['manifest.json']));
    assert.equal(data.plan_id, manifest.plan_id);
    assert.equal(data.repo, manifest.repo);
    assert.equal(data.revision, manifest.revision);
  }
});

test('The six V2 references retain their upstream fixture bytes', () => {
  for (const [name, entry] of Object.entries(catalog)) {
    assert.equal(sha256(read(name)), entry.sha256, name);
  }
});

test('V2 keeps caller-owned byte buffers and export results independent', () => {
  const {input} = source('linear.json');
  input.spec = Buffer.from(input.spec);
  const path = 'artifacts/example.bin';
  const artifact = Buffer.from([0, 255]);
  input.artifacts = {[path]: artifact};
  const first = buildAiraV2Export(input);
  const second = buildAiraV2Export(input);
  assert.deepEqual(first.manifest.artifacts, [{path, sha256: sha256(artifact)}]);
  first.files[path].fill(0);
  first.files['SPEC.md'].fill(0);
  assert.deepEqual(second.files[path], Buffer.from([0, 255]));
  assert.deepEqual(artifact, second.files[path]);
  assert.deepEqual(input.spec, second.files['SPEC.md']);
});

test('V2 rejects reactivation of a retired criterion', () => {
  const {input} = source('revised.json');
  input.requirements.criteria[0].id = input.requirements.retired_ids[0].id;
  assert.throws(() => buildAiraV2Export(input), {code: 'ID_CONFLICT'});
});

test('V2 requires explicit approval, points, identity confirmation and exact preview hash',()=>{
  const {input}=source('linear.json');
  assert.throws(()=>exportAira({...input,approved:false}),{code:'APPROVAL_REQUIRED'});
  assert.throws(()=>exportAira({...input,confirmed_ids:[]}),{code:'APPROVAL_REQUIRED'});
  assert.throws(()=>exportAira({...input,confirmed_points:{}}),{code:'INVALID_SCHEMA'});
  assert.throws(()=>exportAira({...input,expected_manifest_sha256:'0'.repeat(64)}),{code:'APPROVAL_STALE'});
  const {input:revised}=source('revised.json');
  assert.throws(()=>exportAira({...revised,changes_approved:false}),{code:'APPROVAL_REQUIRED'});
});

test('V2 predecessor hash is over original bytes, not reserialized JSON',()=>{
  const {input}=source('revised.json');
  const raw=' '+input.previous.manifest_bytes;
  assert.throws(()=>exportAira({...input,previous:{...input.previous,manifest_bytes:raw}}),{code:'HISTORY_CONFLICT'});
  const next={...input,previous:{...input.previous,manifest_bytes:raw},previous_manifest_sha256:sha256(raw)};
  assert.equal(JSON.parse(exportAira(next)['manifest.json']).previous_manifest_sha256,sha256(raw));
  assert.throws(()=>exportAira({...input,previous:{manifest:JSON.parse(raw),requirements:JSON.parse(input.previous.requirements_bytes)}}),{code:'HISTORY_CONFLICT'});
  assert.throws(()=>exportAira({...input,previous:{...input.previous,requirements_bytes:' '+input.previous.requirements_bytes}}),{code:'HISTORY_CONFLICT'});
});

test('unchanged revision returns the original package; resolved blocker remains linked',()=>{
  const {input}=source('linear.json'),first=exportAira(input);
  const next={...input,revision:2,requirements:{...input.requirements,revision:2},
    previous:{manifest_bytes:first['manifest.json'],requirements_bytes:first['requirements.json']},
    previous_manifest_sha256:sha256(first['manifest.json']),confirmed_ids:[]};
  assert.equal(previewAira(next).unchanged,true);
  assert.deepEqual(exportAira(next),first);
  const blocked=source('blocked.json').input,d=blocked.requirements.decisions[0];
  Object.assign(d,{state:'resolved',resolution:'Confirmed',evidence_ref:'local/evidence',confirmed_by:'actor',confirmed_at:'2026-01-01T00:00:00Z'});
  blocked.plan.tasks.forEach(t=>t.blockedBy=[]);blocked.plan.blocked=[];
  const files=exportAira(blocked),m=JSON.parse(files['manifest.json']);
  assert.equal(m.blockers[0].id,'B01');assert.match(files['draft/EPICS.md'].toString(),/T01[^|]+\| SpecIt [^|]+ B01/);
});

test('V2 exact projection rejects drift, missing verification and extra fields',()=>{
  const {input}=source('linear.json');
  const bad=structuredClone(input);bad.plan.tasks[0].acceptance=['Different'];
  assert.throws(()=>exportAira(bad),{code:'INVALID_SCHEMA'});
  const extra=structuredClone(input);extra.requirements.criteria[0].unexpected=true;
  assert.throws(()=>exportAira(extra),{code:'INVALID_SCHEMA'});
  const missing=structuredClone(input);missing.requirements.tests=[];missing.plan.tasks[0].tests=['Different'];
  assert.throws(()=>exportAira(missing),{code:'INVALID_SCHEMA'});
  const files=exportAira(input);files['draft/01-T01.md']=Buffer.from('changed');
  assert.throws(()=>verifyAira(files),{code:'INVALID_HASH'});
});

test('V2 restore verifies original binding, byte hash and identity snapshot',()=>{
  const {input}=source('linear.json'),p=previewAira(input);
  const active=input.confirmed_ids;
  const record={repo:input.repo,manifest_bytes:p.manifest_bytes,requirements_bytes:p.requirements_bytes,manifest_sha256:p.manifest_sha256,
    mapping:{key:active[0]},snapshot:{plan:input.plan,requirements:input.requirements,highWater:restoreRequirementHighWater({},active,[])}};
  assert.equal(validateV2Restore(record,input),true);
  assert.throws(()=>validateV2Restore({...record,manifest_sha256:'0'.repeat(64)},input),{code:'HISTORY_CONFLICT'});
  const bad=structuredClone(record);bad.snapshot.highWater.T=900;
  assert.throws(()=>validateV2Restore(bad,input),{code:'HISTORY_CONFLICT'});
});

test('a B tombstone cannot release surviving tasks without an open replacement',()=>{
  const {input}=source('blocked.json'),files=exportAira(input);
  const next=structuredClone(input);next.revision=2;next.requirements.revision=2;
  next.previous={manifest_bytes:files['manifest.json'],requirements_bytes:files['requirements.json']};next.previous_manifest_sha256=sha256(files['manifest.json']);
  next.requirements.retired_ids=[{id:'AC-B01-001',kind:'criterion',reason:'retired',retired_revision:2},{id:'B01',kind:'decision',reason:'retired',retired_revision:2},{id:'TC-B01-001',kind:'test',reason:'retired',retired_revision:2}];
  next.requirements.decisions=[];next.requirements.criteria=next.requirements.criteria.filter(x=>x.task_id!=='B01');next.requirements.tests=next.requirements.tests.filter(x=>x.task_id!=='B01');
  delete next.confirmed_points.B01;next.confirmed_ids=next.confirmed_ids.filter(x=>!x.includes('B01'));next.plan.tasks.forEach(t=>t.blockedBy=[]);next.plan.blocked=[];
  assert.throws(()=>exportAira(next),{code:'HISTORY_CONFLICT'});
});
