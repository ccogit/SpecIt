import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Aira A1 merge 79cf37f41450e3fe420f261fe1090cebcaa98bd5.
// Independently pinned from upstream tests/fixtures/specit_v{1,2}, NOT the
// local manifest. Changing a fixture and its catalog together must fail.
const pins = {
  'specit_v1/blocked.json': '3f714c72fca2bea25d8a5f022caa7f8cd9a38d847c0959a52d31e67e127496fb',
  'specit_v1/branched.json': '10ea432f41b718d6d1d825c73271088bf2bb95cb3563d84e701635250f04c969',
  'specit_v1/invalid.json': '99867c3181800605ee24c07640cf7c3c549cdbdc0a1fb73f13038d2a0459a58e',
  'specit_v1/linear.json': '9d1ad44973966572e44431fdbeefb70e055a444f9f371c7475c679c68ddbf6d9',
  'aira-v2/blocked.json': 'cd5eadb4b96977c7d0f5b382b9f70112b647caaf046980365c83498861c39348',
  'aira-v2/branched.json': '3cde7440644e62ca46f0500ef3a93fd2aa186d3ff25fc874deb4cc70654c43b9',
  'aira-v2/feedback.json': 'c0a8ea38f2b25bb16f1d710852885aea09337a2dd3644f2c609336b8cbc99fff',
  'aira-v2/fixture-manifest.json': 'e214dd2b3e7f5c4fcab4a19a162292a8601ca094b542414ec62c540673817519',
  'aira-v2/invalid.json': '4b6e0565fd9310dca8fbfdd91facb17e830aaf7ca3a52e177d51ae7dd639bbc2',
  'aira-v2/linear.json': '2bd9c7d9fbfe7af7d734f25dccef8324ee49d48ab59ea569f63bc91c09fb4b75',
  'aira-v2/revised.json': 'b7e6c9c1d365e5bc19f92985412afd6b6149871c7fb534e94094784aa5075034',
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(new URL('./fixtures/' + path, import.meta.url));
const v2 = name => JSON.parse(read('aira-v2/' + name));
for (const [path, digest] of Object.entries(pins)) {
  test('Q11 pinned A1 bytes: ' + path, () => assert.equal(hash(read(path)), digest));
}

test('Q11 T14 pinned feedback receipt chain has independent original-byte hashes', () => {
  const {events} = v2('feedback.json');
  assert.equal(events.length, 2);
  let previous = null;
  for (const [i, event] of events.entries()) {
    assert.equal(hash(Buffer.from(event.text, 'utf8')), event.sha256);
    const receipt = JSON.parse(event.text);
    assert.equal(receipt.schema_version, 1);
    assert.equal(receipt.sequence, i + 1);
    assert.equal(receipt.previous_feedback_sha256, previous);
    previous = event.sha256;
  }
});

function exportInput(name, previous) {
  const {expected_files: files} = v2(name);
  const manifest = JSON.parse(files['manifest.json']);
  const requirements = JSON.parse(files['requirements.json']);
  const {schema_version, plan_id, repo, revision, plan, target_minutes, previous_manifest_sha256} = manifest;
  return {
    schema_version, plan_id, repo, revision, plan, target_minutes, previous_manifest_sha256,
    requirements, spec: files['SPEC.md'], approved: true, changes_approved: true,
    confirmed_ids: [...plan.tasks, ...requirements.requirements, ...requirements.criteria,
      ...requirements.tests, ...requirements.decisions].map(x => x.id),
    confirmed_points: Object.fromEntries([...Object.entries(manifest.tasks),
      ...manifest.blockers.map(entry => [entry.id, entry])].map(([id, entry]) => [id, entry.points])),
    ...(previous ? {previous: {manifest_bytes: previous['manifest.json'],
      requirements_bytes: previous['requirements.json']}} : {}),
  };
}

test('Q11 T01/T14/T15 exported revision feeds original receipts and rejects stale approval', async t => {
  const {exportAira, previewAira, verifyAira} = await import('../aira-export.mjs');
  // All calls are in-process; no server, network, Jira, runner or remote writes.
  t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected network call'); });
  const first = exportAira(exportInput('linear.json'));
  const input = exportInput('revised.json', first);
  const preview = previewAira({...input, approved: false});
  assert.throws(() => exportAira({...input, spec: input.spec + '\nChanged after preview\n',
    expected_manifest_sha256: preview.manifest_sha256}), {code: 'APPROVAL_STALE'});
  const second = exportAira({...input, expected_manifest_sha256: preview.manifest_sha256});
  for (const [name, files] of [['linear.json', first], ['revised.json', second]]) {
    const golden = v2(name);
    assert.deepEqual(Object.keys(files).sort(), Object.keys(golden.expected_files).sort());
    for (const [path, bytes] of Object.entries(files)) {
      assert.deepEqual(bytes, Buffer.from(golden.expected_files[path]), path);
      assert.equal(hash(bytes), golden.expected_sha256[path], path);
    }
  }
  assert.equal(verifyAira(second, [input.previous]), true);
  await checkReceipts(t, first, second);
});

// Independent consumer-side test, usable even without the exporter. The
// preceding test additionally exercises the same consumer with actual output.
test('Q11 T14/T15 pinned packages and receipts survive restart and restore', async t => {
  const packageBytes = name => Object.fromEntries(Object.entries(v2(name).expected_files)
    .map(([path, content]) => [path, Buffer.from(content)]));
  t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected network call'); });
  await checkReceipts(t, packageBytes('linear.json'), packageBytes('revised.json'));
});

async function checkReceipts(t, first, second) {
  const {createFeedbackStore} = await import('../aira-feedback.mjs');
  const {feedbackView} = await import('../public/aira-feedback-model.mjs');
  const history = [first, second].map(files => ({files, manifest_sha256: hash(files['manifest.json'])}));
  const {events, package: receiptPackage} = v2('feedback.json');
  assert.equal(receiptPackage, 'revised.json');
  const receipt = JSON.parse(events[0].text);
  // Synthetic fixture binding; production must confirm it independently.
  const binding = Object.fromEntries(['binding_id', 'repo', 'jira_project', 'plan_id'].map(k => [k, receipt[k]]));
  const context = {binding, history};
  const original = structuredClone(context);
  const dir = mkdtempSync(join(tmpdir(), 'specit-si16-'));
  const restored = mkdtempSync(join(tmpdir(), 'specit-si16-restore-'));
  t.after(() => {rmSync(dir, {recursive: true, force: true}); rmSync(restored, {recursive: true, force: true});});
  const store = createFeedbackStore(dir, () => context);
  assert.equal(store.projection().freshness, 'unknown');
  for (const event of events) {
    assert.equal(store.import(Buffer.from(event.text), event.sha256), 'accepted');
  }
  const reopened = createFeedbackStore(dir, () => context);
  assert.equal(reopened.import(Buffer.from(events[1].text), events[1].sha256), 'no_op');
  const target = createFeedbackStore(restored, () => context);
  assert.equal(target.restore(reopened.backup()), 'restored');
  const projection = target.projection();
  assert.equal(projection.current.feedback.sequence, 2);
  assert.equal(projection.current.sha256, events[1].sha256);
  const manifest = JSON.parse(second['manifest.json']);
  const requirements = JSON.parse(second['requirements.json']);
  const view = feedbackView({projection, manifest, requirements, manifestSha: hash(second['manifest.json'])});
  assert.equal(view.freshness, 'current');
  assert.equal(view.requirements.find(r => r.id === 'FR-001').fulfilled, true);
  assert.ok(!JSON.stringify(view).includes('assignment_to_merge_seconds'));
  assert.equal(feedbackView({projection, manifest, requirements, manifestSha: 'f'.repeat(64)}).requirements[0].fulfilled, false);
  assert.deepEqual(structuredClone(context), original);
}
