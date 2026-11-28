import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {canonicalV2Json, projectV2EvidenceLine} from '../aira-v2-projection.mjs';

// Aira A1 commit b69992f, docs/plan/specit-aira-v1.2/fixtures-v2/linear.json.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/aira-v2/linear.json', import.meta.url), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const files = fixture.expected_files;

test('V2 JSON projection matches Aira reference bytes and SHA-256', () => {
  for (const name of ['manifest.json', 'requirements.json']) {
    const value = JSON.parse(files[name]);
    const projected = canonicalV2Json(Object.fromEntries(Object.entries(value).reverse()));
    assert.deepEqual(Buffer.from(projected, 'utf8'), Buffer.from(files[name], 'utf8'), name);
    assert.equal(sha256(projected), fixture.expected_sha256[name], name);
  }

  for (const [name, bytes] of Object.entries(files)) {
    assert.equal(sha256(bytes), fixture.expected_sha256[name], name);
  }
});

test('V2 evidence lines match the reference projection with literal continuation indentation', () => {
  const requirements = JSON.parse(files['requirements.json']);
  const manifest = JSON.parse(files['manifest.json']);
  for (const entry of [...requirements.criteria, ...requirements.tests]) {
    const draft = files[manifest.tasks[entry.task_id].file];
    const line = projectV2EvidenceLine(entry.id, entry.text ?? entry.description);
    assert.ok(draft.includes(line), entry.id);
  }
});

test('V2 JSON uses codepoint order and decimal notation and rejects invalid values', () => {
  assert.equal(canonicalV2Json({'10': 10, '2': 0.05}), '{\n  "10": 10,\n  "2": 0.05\n}\n');
  assert.equal(canonicalV2Json([1e-7, 1e21]), '[\n  0.0000001,\n  1000000000000000000000\n]\n');
  for (const value of [NaN, Infinity, -0, '\ud800', undefined]) {
    assert.throws(() => canonicalV2Json(value), TypeError);
  }
});
