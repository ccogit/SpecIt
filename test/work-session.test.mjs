import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkSession, abortableDelay } from '../work-session.mjs';

test('reset invalidates earlier callbacks and gives new work a fresh active signal', () => {
  const session = createWorkSession();
  const stamp = session.generation;
  const old = session.signal;
  assert.ok(session.isCurrent(stamp));
  session.invalidate();
  assert.equal(old.aborted, true);
  assert.equal(session.isCurrent(stamp), false);
  assert.equal(session.isCurrent(session.generation), true);
  assert.equal(session.signal.aborted, false);
});

test('reset cancels a combined explicit request signal', () => {
  const session = createWorkSession(), job = new AbortController();
  const signal = session.combine(job.signal);
  assert.equal(signal.aborted, false);
  session.invalidate();
  assert.equal(signal.aborted, true);
  const independent = new AbortController();
  const newSignal = session.combine(independent.signal);
  assert.equal(newSignal.aborted, false);
  independent.abort();
  assert.equal(newSignal.aborted, true);
});

test('abortable backoff is interrupted promptly and cannot continue background retries', async () => {
  const job = new AbortController();
  const pending = abortableDelay(10_000, job.signal);
  job.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('abortable backoff resolves when the operation stays active', async () => {
  const session = createWorkSession();
  await abortableDelay(1, session.signal);
  assert.equal(session.signal.aborted, false);
});
