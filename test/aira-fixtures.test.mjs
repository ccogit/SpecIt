import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const fixture = name => JSON.parse(readFileSync(new URL('./fixtures/specit_v1/'+name+'.json', import.meta.url), 'utf8'));
test('Aira V1 Referenzfixtures: SPEC und Artefakt-Hashes', () => {
  for (const name of ['linear','branched','blocked']) {
    const {expected_files: files} = fixture(name);
    const manifest = JSON.parse(files['manifest.json']);
    const sha = s => createHash('sha256').update(s).digest('hex');
    assert.equal(sha(files['SPEC.md']), manifest.spec_sha256);
    for (const a of manifest.artifacts) assert.equal(sha(files[a.path]), a.sha256);
  }
  assert.ok(fixture('invalid').cases.length);
});
