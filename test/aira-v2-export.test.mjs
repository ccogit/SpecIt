import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {sha256} from '../aira-export.mjs';
import {buildAiraV2Export} from '../aira-v2-export.mjs';

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
    confirmed_points: Object.fromEntries(entries.map(([id, entry]) => [id, entry.points])),
  };
  if (base) {
    const predecessor = source(base);
    input.previous = {manifest: predecessor.manifest, requirements: predecessor.input.requirements};
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
    assert.deepEqual(input, snapshot);
  });
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
  });
}

for (const variant of fixture('revised.json').negative) {
  test('V2 revision rejects ' + variant.id, () => {
    const {input} = source('revised.json');
    replaceField(input, variant.field, variant.value);
    assert.throws(() => buildAiraV2Export(input), {code: variant.expected});
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
