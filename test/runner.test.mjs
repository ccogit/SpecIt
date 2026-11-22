import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { MAX_SPEC_CHARS } from '../limits.mjs';
import { validateRun, targetDir } from '../runner.mjs';

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
