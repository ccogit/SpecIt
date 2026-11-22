import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MAX_SPEC_CHARS } from '../limits.mjs';
import { validateRun, targetDir, canonicalTargetDir } from '../runner.mjs';

const plan = {
  summary: 'Kleine Test-Umsetzung',
  tasks: [{
    id: 'T01', title: 'Grundgerüst', goal: 'Erster lauffähiger Stand',
    requirements: ['Kernfunktion'], dependsOn: [], scope: ['Projekt'],
    outOfScope: [], interfaces: [], deliverables: ['Quellcode'],
    acceptance: ['Der Einstieg funktioniert'], tests: ['Node-Test'], blockedBy: [],
    minutes: 1,
  }],
};
const dir = path.join(tmpdir(), 'specit-run-validation-tests');

test('the agent runner accepts the same 150,000-character specification as the editor and API', () => {
  const spec = 'A'.repeat(MAX_SPEC_CHARS);
  const result = validateRun({ dir, spec, plan });
  assert.equal(result.spec.length, MAX_SPEC_CHARS);
  assert.equal(result.plan.tasks.length, 1);
});

test('the agent runner rejects an oversized or empty specification', () => {
  assert.throws(() => validateRun({ dir, spec: 'A'.repeat(MAX_SPEC_CHARS + 1), plan }), /zu lang/);
  assert.throws(() => validateRun({ dir, spec: '   ', plan }), /Spezifikation fehlt/);
});

test('target directory validation rejects relative and filesystem root paths', () => {
  assert.throws(() => targetDir('relative/path'), /vollständigen Pfad/);
  assert.throws(() => targetDir(path.parse(dir).root), /Laufwerk/);
});

test('canonical target verification prevents following a symlink back into SpecIt', async t => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'specit-symlink-test-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  const alias = path.join(sandbox, 'alias');
  try { await symlink(repoRoot, alias, 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Symlinks nicht verfügbar');
    throw error;
  }
  assert.equal(targetDir(alias), alias);
  await assert.rejects(canonicalTargetDir(alias), /SpecIt-Ordner/);
});

test('canonical target verification accepts regular writable project directories', async t => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'specit-realpath-test-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  assert.equal(await canonicalTargetDir(sandbox), await import('node:fs/promises').then(fs => fs.realpath(sandbox)));
});
