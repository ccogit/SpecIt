import assert from 'node:assert/strict';
import test from 'node:test';
import {allocateRequirementIdentity, checkRequirementCoverage} from '../aira-requirement-identities.mjs';

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
