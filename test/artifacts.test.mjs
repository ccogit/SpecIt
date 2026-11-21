import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { classify, scanArtifacts, artifactGroups } from '../artifacts.mjs';

test('classify ordnet Dateien den Gruppen zu', () => {
  assert.equal(classify('test/app.test.mjs'), 'tests');
  assert.equal(classify('src/__tests__/a.js'), 'tests');
  assert.equal(classify('src/util_test.go'), 'tests');
  assert.equal(classify('test_app.py'), 'tests');
  assert.equal(classify('design/variante-1.html'), 'design');
  assert.equal(classify('public/logo.svg'), 'design');
  assert.equal(classify('README.md'), 'docs');
  assert.equal(classify('LICENSE'), 'docs');
  assert.equal(classify('docs/api.html'), 'docs');
  assert.equal(classify('package.json'), 'config');
  assert.equal(classify('.gitignore'), 'config');
  assert.equal(classify('run.sh'), 'config');
  assert.equal(classify('src/app.js'), 'code');
  assert.equal(classify('public/index.html'), 'code');
  assert.equal(classify('data.bin'), 'other');
});

test('scanArtifacts zählt je Gruppe und überspringt node_modules', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifacts-'));
  try {
    await fs.mkdir(path.join(dir, 'src'));
    await fs.mkdir(path.join(dir, 'test'));
    await fs.mkdir(path.join(dir, 'node_modules'));
    await fs.writeFile(path.join(dir, 'src/app.js'), 'a\nb\nc');
    await fs.writeFile(path.join(dir, 'test/app.test.js'), 'x\ny\n');
    await fs.writeFile(path.join(dir, 'README.md'), '# Titel\n');
    await fs.writeFile(path.join(dir, 'package.json'), '{}\n');
    await fs.writeFile(path.join(dir, 'blob.dat'), Buffer.from([1, 0, 2, 10]));
    await fs.writeFile(path.join(dir, 'node_modules/x.js'), 'ignoriert\n');
    const r = await scanArtifacts(dir);
    assert.equal(r.files, 5);
    assert.equal(r.lines, 3 + 2 + 1 + 1);
    assert.equal(r.truncated, false);
    assert.deepEqual(r.groups.map((g) => g.key), artifactGroups.map(([k]) => k));
    const g = Object.fromEntries(r.groups.map((x) => [x.key, x]));
    assert.deepEqual([g.code.files, g.code.lines], [1, 3]);
    assert.deepEqual([g.tests.files, g.tests.lines], [1, 2]);
    assert.deepEqual([g.docs.files, g.docs.lines], [1, 1]);
    assert.deepEqual([g.config.files, g.config.lines], [1, 1]);
    assert.deepEqual([g.other.files, g.other.lines], [1, 0]);
    assert.equal(g.design.files, 0);
    assert.equal(g.code.label, 'Code');
    assert.ok(r.bytes > 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('scanArtifacts liefert für fehlenden Ordner Nullen', async () => {
  const r = await scanArtifacts(path.join(os.tmpdir(), 'gibt-es-nicht-' + Date.now()));
  assert.equal(r.files, 0);
  assert.equal(r.lines, 0);
  assert.equal(r.bytes, 0);
  assert.equal(r.truncated, false);
  assert.equal(r.groups.length, 6);
  assert.ok(r.groups.every((g) => g.files === 0 && g.lines === 0));
});

test('scanArtifacts bricht bei maxFiles ab', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifacts-'));
  try {
    for (let i = 0; i < 5; i++) await fs.writeFile(path.join(dir, `f${i}.js`), 'x\n');
    const r = await scanArtifacts(dir, { maxFiles: 3 });
    assert.equal(r.truncated, true);
    assert.equal(r.files, 3);
    const ok = await scanArtifacts(dir, { maxFiles: 5 });
    assert.equal(ok.truncated, false);
    assert.equal(ok.files, 5);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
