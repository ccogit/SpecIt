import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateRequirementIdentity, checkRequirementCoverage, restoreRequirementHighWater,
} from '../aira-requirement-identities.mjs';

test('identity counters survive reload and keep namespaces and owners independent', () => {
  const first = allocateRequirementIdentity({}, 'FR');
  assert.equal(first.id, 'FR-001');
  const restored = JSON.parse(JSON.stringify(first.highWater));
  const second = allocateRequirementIdentity(restored, 'FR');
  assert.equal(second.id, 'FR-002');
  assert.deepEqual(restored, {FR: 1});
  assert.equal(allocateRequirementIdentity(second.highWater, 'NFR').id, 'NFR-001');
  assert.equal(allocateRequirementIdentity({}, 'T').id, 'T01');
  assert.equal(allocateRequirementIdentity({}, 'B').id, 'B01');

  const criterion = allocateRequirementIdentity({}, 'AC', 'T01');
  assert.equal(criterion.id, 'AC-T01-001');
  assert.equal(allocateRequirementIdentity(criterion.highWater, 'AC', 'T01').id, 'AC-T01-002');
  assert.equal(allocateRequirementIdentity(criterion.highWater, 'AC', 'B01').id, 'AC-B01-001');
  assert.equal(allocateRequirementIdentity(criterion.highWater, 'TC', 'T01').id, 'TC-T01-001');
});

test('identity counters fail when exhausted or invalid', () => {
  assert.throws(() => allocateRequirementIdentity({B: 99}, 'B'), /exhausted/);
  assert.throws(() => allocateRequirementIdentity({FR: '1'}, 'FR'), /invalid/);
  assert.throws(() => allocateRequirementIdentity({}, 'AC', 'T00'), /owner/);
  assert.throws(() => allocateRequirementIdentity({}, 'FR', 'T01'), /owner/);
});

test('restore preserves counters and never reallocates retired IDs', () => {
  const active = ['FR-001', 'T01', 'B01', 'TC-T01-002'];
  const retired = ['FR-009', 'T104', 'AC-T01-011', 'AC-B01-003'];
  const stored = {FR: 12, 'AC-B01': 1};
  const restored = restoreRequirementHighWater(stored, active, retired);
  assert.deepEqual(restoreRequirementHighWater(stored, active.toReversed(), retired.toReversed()), restored);
  assert.deepEqual(stored, {FR: 12, 'AC-B01': 1});
  assert.equal(allocateRequirementIdentity(restored, 'FR').id, 'FR-013');
  assert.equal(allocateRequirementIdentity(restored, 'T').id, 'T105');
  assert.equal(allocateRequirementIdentity(restored, 'B').id, 'B02');
  assert.equal(allocateRequirementIdentity(restored, 'AC', 'T01').id, 'AC-T01-012');
  assert.equal(allocateRequirementIdentity(restored, 'AC', 'B01').id, 'AC-B01-004');
  assert.equal(allocateRequirementIdentity(restored, 'TC', 'T01').id, 'TC-T01-003');
});

test('restore rejects reuse of a tombstone and invalid historical namespaces', () => {
  assert.throws(() => restoreRequirementHighWater({}, ['FR-001'], ['FR-001']), /duplicate/i);
  for (const id of ['T00', 'B100', 'FR-000', 'TC-B100-001', 'AC-T01-000']) {
    assert.throws(() => restoreRequirementHighWater({}, [], [id]), /historical identity/i);
  }
  assert.throws(() => restoreRequirementHighWater({B: 100}, ['B01'], []), /persisted identity counter/);
  const exhausted = restoreRequirementHighWater({}, [], ['B99']);
  assert.throws(() => allocateRequirementIdentity(exhausted, 'B'), /exhausted/);
});

const mandatory = {id: 'FR-001', mandatory: true, state: 'approved'};
const optional = {id: 'NFR-001', mandatory: false, state: 'deferred'};

test('coverage requires active criteria or a permitted exception', () => {
  checkRequirementCoverage([mandatory, optional], [['FR-001'], ['FR-001']], ['NFR-001']);
  assert.throws(() => checkRequirementCoverage([mandatory], []), /active criterion/);
  assert.throws(() => checkRequirementCoverage([{...mandatory, state: 'deferred'}], [['FR-001']]), /approval/);
  assert.throws(() => checkRequirementCoverage([optional], []), /approved exception/);
  assert.throws(() => checkRequirementCoverage([mandatory], [], ['FR-001']), /coverage exception/);
});

test('coverage rejects repeated or unknown identities and references', () => {
  assert.throws(() => checkRequirementCoverage([mandatory, mandatory], []), /duplicate requirement/);
  assert.throws(() => checkRequirementCoverage([mandatory], [['FR-002']]), /unknown/i);
  assert.throws(() => checkRequirementCoverage([mandatory], [['FR-001', 'FR-001']]), /duplicate criterion/);
  assert.throws(() => checkRequirementCoverage([optional], [], ['NFR-001', 'NFR-001']), /duplicate coverage/);
});
