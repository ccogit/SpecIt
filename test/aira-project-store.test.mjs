import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectStore } from '../aira-project-store.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(JSON.stringify(value) + '\n');
const binding = { plan_id: 'P1', repo: 'example/project' };
const fixture = (revision, previous_manifest_sha256 = null, spec = 'Synthetic SPEC') => {
  const files = {
    'SPEC.md': Buffer.from(spec),
    'requirements.json': bytes({ schema_version: 2, plan_id: 'P1', revision, requirements: [] }),
    'draft/EPICS.md': Buffer.from('Synthetic draft'),
  };
  files['manifest.json'] = bytes({ schema_version: 2, mode: 'aira', ...binding, revision, previous_manifest_sha256,
    spec_sha256: hash(files['SPEC.md']), requirements_sha256: hash(files['requirements.json']), artifacts: [],
    draft_files: [{ path: 'draft/EPICS.md', sha256: hash(files['draft/EPICS.md']) }] });
  return files;
};
// Storage-only fixture and stub: full V2 schema validation belongs to SI-5.
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'specit-s2-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const open = () => createProjectStore(root, { validatePackage: () => true });
  const store = open();
  store.create('local-1');
  store.setMode('local-1', { mode: 'aira', binding, expected_generation: 1, observation: 'idle' });
  return { root, store, open };
}
const add = (store, files, expected_head = null, expected_generation = 2) =>
  store.append('local-1', { files, expected_generation, expected_head });

test('T15 restart preserves original bytes, binding, index and chain; exact retry is idempotent', t => {
  const { store, open } = setup(t);
  const first = fixture(1), h1 = hash(first['manifest.json']);
  assert.equal(add(store, first).manifest_sha256, h1);
  const second = fixture(2, h1, 'changed'), h2 = hash(second['manifest.json']);
  assert.equal(add(open(), second, h1).revision, 2);
  const restarted = open();
  assert.equal(add(restarted, second, h2).revision, 2);
  assert.deepEqual(restarted.history('local-1').map(entry => entry.files), [first, second]);
  assert.equal(restarted.get('local-1').mode, 'aira');
});

test('T15 rejects stale head, revision jump, wrong predecessor and unchanged revision increment atomically', t => {
  const { store, root, open } = setup(t);
  const first = fixture(1), h1 = hash(first['manifest.json']);
  add(store, first);
  const before = readFileSync(join(root, 'projects.json'));
  for (const [files, head] of [[fixture(2, h1, 'changed'), null], [fixture(3, h1, 'changed'), h1],
    [fixture(2, 'a'.repeat(64), 'changed'), h1], [fixture(2, h1), h1]]) {
    assert.throws(() => add(store, files, head), { code: 'HISTORY_CONFLICT' });
    assert.deepEqual(readFileSync(join(root, 'projects.json')), before);
  }
  assert.equal(open().get('local-1').revision, 1);
});

test('T15 restores only complete original chain; conflicting, truncated and tampered restore cannot overwrite', t => {
  const { store, open } = setup(t);
  const first = fixture(1), h1 = hash(first['manifest.json']), second = fixture(2, h1, 'changed');
  const restore = (packages, expected_head = null) => store.restore('local-1', { packages, expected_head, expected_generation: 2 });
  assert.throws(() => restore([second]), { code: 'HISTORY_CONFLICT' });
  assert.equal(restore([first, second]).revision, 2);
  const h2 = hash(second['manifest.json']);
  assert.throws(() => restore([first], h2), { code: 'HISTORY_CONFLICT' });
  const other = fixture(1, null, 'other');
  assert.throws(() => restore([other, fixture(2, hash(other['manifest.json']), 'changed')], h2), { code: 'HISTORY_CONFLICT' });
  assert.throws(() => restore([first, { ...second, 'SPEC.md': Buffer.from('tampered') }], h2), { code: 'INVALID_HASH' });
  assert.deepEqual(open().history('local-1').map(entry => entry.files), [first, second]);
});

test('T15 explicit mode change fails for active and unknown tasks; binding survives switch', t => {
  const { store } = setup(t);
  for (const observation of ['running', 'unknown', undefined]) {
    assert.throws(() => store.setMode('local-1', { mode: 'standalone', expected_generation: 2, observation }), { code: 'CONTEXT_UNAVAILABLE' });
  }
  assert.equal(store.setMode('local-1', { mode: 'standalone', expected_generation: 2, observation: 'idle' }).generation, 3);
  assert.throws(() => store.assertStandalone({ project_id: 'local-1' }), { code: 'POLICY_DENIED' });
  store.create('local-2');
  assert.equal(store.assertStandalone({ project_id: 'local-2', repo: 'example/other' }), true);
  assert.throws(() => store.assertStandalone({ repo: 'EXAMPLE/project' }), { code: 'POLICY_DENIED' });
  assert.throws(() => store.setMode('local-2', { mode: 'aira', binding, expected_generation: 1, observation: 'idle' }), { code: 'WRONG_TARGET' });
});

test('T15 rejects foreign paths, wrong target, tampering, invalid validator and index corruption', t => {
  const { store, root } = setup(t);
  assert.throws(() => add(store, { ...fixture(1), '../foreign': Buffer.from('x') }), { code: 'INVALID_PATH' });
  assert.throws(() => add(store, { ...fixture(1), 'SPEC.md': Buffer.from('different') }), { code: 'INVALID_HASH' });
  const foreign = fixture(1);
  foreign['manifest.json'] = bytes({ ...JSON.parse(foreign['manifest.json']), repo: 'example/foreign' });
  assert.throws(() => add(store, foreign), { code: 'WRONG_TARGET' });
  assert.throws(() => add(createProjectStore(root), fixture(1)), { code: 'CONTEXT_UNAVAILABLE' });
  add(store, fixture(1));
  writeFileSync(join(root, 'projects.json'), '{}');
  assert.throws(() => store.assertStandalone({}), { code: 'INVALID_SCHEMA' });
});
